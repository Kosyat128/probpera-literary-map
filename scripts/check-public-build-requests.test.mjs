import { afterEach, describe, expect, it, vi } from "vitest";

const { appendFile } = vi.hoisted(() => ({ appendFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ appendFile }));

const outboxUpload = (id) => ({ id, entity_type: "media", reason: "media.uploaded" });
const outboxInsert = (id) => ({ id, entity_type: "media_assets", reason: "database-insert" });
const legacyUpload = (id) => ({ id, entity_type: "media", metadata: { reason: "media.uploaded" } });
const stages = Array.from({ length: 1201 }, (_, index) => index + 100);

async function readQueue({ outbox, legacy, lastLegacyId = 0 }) {
  vi.stubEnv("SUPABASE_URL", "https://publication-test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
  vi.stubEnv("GITHUB_OUTPUT", "mock-output");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.stubGlobal("fetch", async (input, options) => {
    const { pathname, searchParams } = new URL(input);
    expect(options.method ?? "GET").toBe("GET");
    expect(searchParams.get("limit")).toBe("1");
    if (pathname.endsWith("/public_build_outbox")) {
      if (!outbox) {
        return Response.json({ code: "PGRST205", message: "Missing public.public_build_outbox" }, { status: 404 });
      }
      if (!searchParams.has("status")) return Response.json([]);
      expect(searchParams.get("status")).toBe("in.(requested,dispatched,failed)");
      expect(searchParams.get("order")).toBe("id.desc");
      let rows = outbox;
      if (searchParams.has("and")) {
        expect(searchParams.get("and")).toBe(
          "(not.and(entity_type.eq.media,reason.eq.media.uploaded),not.and(entity_type.eq.media_assets,reason.eq.database-insert))"
        );
        rows = rows.filter((row) => !(
          (row.entity_type === "media" && row.reason === "media.uploaded") ||
          (row.entity_type === "media_assets" && row.reason === "database-insert")
        ));
      }
      return Response.json([...rows].sort((a, b) => b.id - a.id).slice(0, 1).map(({ id }) => ({ id })));
    }
    expect(pathname).toBe("/rest/v1/admin_audit_log");
    if (searchParams.get("action") === "eq.public_build.deployed") {
      return Response.json(lastLegacyId ? [{ entity_id: String(lastLegacyId) }] : []);
    }
    expect(searchParams.get("action")).toBe("in.(public_build.requested,public_build.failed)");
    expect(searchParams.get("id")).toBe(`gt.${lastLegacyId}`);
    expect(searchParams.get("order")).toBe("id.desc");
    let rows = legacy.filter((row) => row.id > lastLegacyId);
    if (searchParams.has("or")) {
      expect(searchParams.get("or")).toBe(
        "(entity_type.neq.media,metadata->>reason.neq.media.uploaded,metadata->>reason.is.null)"
      );
      rows = rows.filter((row) => row.entity_type !== "media" || row.metadata?.reason !== "media.uploaded");
    }
    return Response.json([...rows].sort((a, b) => b.id - a.id).slice(0, 1).map(({ id }) => ({ id })));
  });

  await import("./check-public-build-requests.mjs");
  return Object.fromEntries(appendFile.mock.calls.map(([file, line]) => {
    expect(file).toBe("mock-output");
    return line.trimEnd().split("=");
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  appendFile.mockClear();
});

describe("public build request check", () => {
  it("keeps staged uploads in both queue markers without starting a release", async () => {
    expect(await readQueue({
      outbox: [outboxUpload(12), outboxInsert(13)],
      legacy: [{ id: 5, entity_type: "article" }, legacyUpload(11)],
      lastLegacyId: 5,
    })).toEqual({ requested: "0", max_id: "outbox:13,legacy-audit:11", queue: "outbox+legacy-audit" });
  });

  it.each([
    { entity_type: "articles", reason: "database-update" },
    { entity_type: "media_assets", reason: "database-update" },
    { entity_type: "media", reason: "media.uploaded.retry" },
  ])("finds $entity_type/$reason behind more than 1,000 staged outbox requests", async (event) => {
    expect(await readQueue({
      outbox: [{ id: 23, ...event }, ...stages.map(outboxUpload)],
      legacy: [legacyUpload(5003)],
    })).toEqual({ requested: "1", max_id: "outbox:1300,legacy-audit:5003", queue: "outbox+legacy-audit" });
  });

  it.each([{ reason: "media.uploaded.retry" }, {}])(
    "finds a real or unidentified legacy request behind staged uploads with no outbox (%j)",
    async (metadata) => {
      expect(await readQueue({
        outbox: null,
        legacy: [{ id: 24, entity_type: "media", metadata }, ...stages.map(legacyUpload)],
      })).toEqual({ requested: "1", max_id: "legacy-audit:1300", queue: "legacy-audit" });
    }
  );
});
