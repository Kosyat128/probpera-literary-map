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

async function runQueueCommand({ args, csv, fetchImpl }) {
  vi.stubEnv("SUPABASE_URL", "https://publication-test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
  vi.stubEnv("GITHUB_OUTPUT", "mock-output");
  vi.stubEnv("CANDIDATE_PENDING_OUTBOX_IDS", csv);
  vi.stubEnv("GITHUB_RUN_ID", "123");
  vi.stubGlobal("fetch", fetchImpl);
  vi.spyOn(console, "log").mockImplementation(() => {});
  const originalArgv = process.argv;
  process.argv = [...originalArgv, ...args];
  try {
    await import("./check-public-build-requests.mjs");
  } finally {
    process.argv = originalArgv;
  }
}

const finalizeQueue = ({ marker, ...options }) => runQueueCommand({ ...options, args: [`--finalize=${marker}`] });

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

describe("public build acknowledgement", () => {
  it("keeps a lower ID committed after the snapshot pending until a later valid release", async () => {
    const rows = new Map([["9", "requested"], ["10", "dispatched"]]);
    const fetchImpl = vi.fn(async (input, options) => {
      const url = new URL(input);
      expect(url.pathname).toBe("/rest/v1/public_build_outbox");
      expect(options.method).toBe("PATCH");
      expect(options.redirect).toBe("error");
      expect(url.searchParams.get("status")).toBe("in.(requested,dispatched,failed)");
      expect(url.searchParams.get("id")).toMatch(/^in\.\([1-9][0-9,]*\)$/u);
      expect(JSON.parse(options.body)).toMatchObject({ status: "deployed", deployment_run_id: "123" });
      for (const id of url.searchParams.get("id").slice(4, -1).split(",")) rows.set(id, "deployed");
      return new Response(null, { status: 204 });
    });

    await finalizeQueue({ marker: "outbox:10", csv: "10", fetchImpl });
    expect(rows.get("9")).toBe("requested");
    expect(rows.get("10")).toBe("deployed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
    vi.resetModules();
    await finalizeQueue({ marker: "outbox:10", csv: "9", fetchImpl });
    expect(rows.get("9")).toBe("deployed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("finalizes exact IDs in small batches and does nothing for a present empty list", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await finalizeQueue({ marker: "outbox:150", csv: "", fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.resetModules();
    const ids = Array.from({ length: 150 }, (_, index) => String(index + 1));
    await finalizeQueue({ marker: "outbox:150", csv: ids.join(","), fetchImpl });
    const predicates = fetchImpl.mock.calls.map(([input]) => new URL(input).searchParams.get("id"));
    expect(predicates).toEqual([
      `in.(${ids.slice(0, 100).join(",")})`,
      `in.(${ids.slice(100).join(",")})`,
    ]);
  });

  it.each([undefined, "1,151"])("rejects invalid modern receipts before any mutation, including legacy %j", async (csv) => {
    const fetchImpl = vi.fn();
    await expect(finalizeQueue({ marker: "outbox:150,legacy-audit:5", csv, fetchImpl })).rejects.toThrow("outbox");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("capture pending public build acknowledgements", () => {
  it("emits only the exact modern IDs visible at capture", async () => {
    const fetchImpl = vi.fn(async (input, options) => {
      const url = new URL(input);
      expect(options.method ?? "GET").toBe("GET");
      expect(options.redirect).toBe("error");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      expect(url.pathname).toBe("/rest/v1/public_build_outbox");
      expect(url.searchParams.get("select")).toBe("request_id:id::text");
      expect(url.searchParams.get("status")).toBe("in.(requested,dispatched,failed)");
      if (url.searchParams.get("order") === "id.desc") return Response.json([{ request_id: "10" }]);
      expect(url.searchParams.get("and")).toBe("(id.gt.0,id.lte.10)");
      return Response.json([{ request_id: "8" }, { request_id: "10" }]);
    });
    await runQueueCommand({ args: ["--capture-outbox"], fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(console.log).toHaveBeenCalledExactlyOnceWith("pending_outbox_ids=8,10");
    expect(appendFile).not.toHaveBeenCalled();
  });

  it.each([
    () => Response.json([]),
    () => Response.json({ code: "PGRST205", message: "Missing public.public_build_outbox" }, { status: 404 }),
  ])("emits a verified empty list for an empty or absent modern queue", async (response) => {
    const fetchImpl = vi.fn(async () => response());
    await runQueueCommand({ args: ["--capture-outbox"], fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledExactlyOnceWith("pending_outbox_ids=");
    expect(appendFile).not.toHaveBeenCalled();
  });

  it("fails closed for restricted API responses and conflicting modes", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ message: "Restricted" }, { status: 402 }));
    await expect(runQueueCommand({ args: ["--capture-outbox", "--finalize=outbox:1"], fetchImpl })).rejects.toThrow("must run separately");
    expect(fetchImpl).not.toHaveBeenCalled();

    vi.restoreAllMocks();
    vi.resetModules();
    await expect(runQueueCommand({ args: ["--capture-outbox"], fetchImpl })).rejects.toThrow("402");
    expect(console.log).not.toHaveBeenCalled();
    expect(appendFile).not.toHaveBeenCalled();
  });
});
