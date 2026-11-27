import { afterEach, describe, expect, it, vi } from "vitest";

const { appendFile } = vi.hoisted(() => ({ appendFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ appendFile }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
  appendFile.mockClear();
});

describe("scheduled editorial publication", () => {
  it("only publishes rows whose eligible state, timestamp and revision still match the due selection", async () => {
    const now = "2026-11-27T08:00:00.000Z";
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(now));
    vi.stubEnv("SUPABASE_URL", "https://scheduled-test.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "mock-service-key");
    vi.stubEnv("GITHUB_OUTPUT", "mock-output");
    vi.spyOn(console, "log").mockImplementation(() => {});

    const original = Object.fromEntries(["ready", "postponed", "moved", "hidden", "deleted", "edited"].map((name, index) => [name, {
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      status: "scheduled",
      scheduled_at: "2026-11-27T07:00:00+00:00",
      updated_at: "2026-11-27T06:00:00.123456+00:00",
      deleted_at: null,
    }]));
    const current = structuredClone(original);
    current.postponed.scheduled_at = "2026-11-27T09:00:00+00:00";
    current.moved.scheduled_at = "2026-11-27T07:30:00+00:00";
    current.hidden.status = "hidden";
    current.deleted.deleted_at = now;
    current.edited.updated_at = now;

    const fetchMock = vi.fn(async (input, options) => {
      const { pathname, searchParams } = new URL(input);
      if (pathname.endsWith("/site_design_change_sets")) return Response.json([]);
      expect(pathname).toBe("/rest/v1/articles");
      if (!options.method) {
        expect(Object.fromEntries(searchParams)).toMatchObject({
          select: "id,status,scheduled_at,updated_at",
          status: "in.(scheduled,published)",
          scheduled_at: `lte.${now}`,
          deleted_at: "is.null",
        });
        return Response.json(Object.values(original));
      }

      expect(options.method).toBe("PATCH");
      const selected = Object.values(original).find(({ id }) => searchParams.get("id") === `eq.${id}`);
      expect(selected).toBeDefined();
      const row = Object.values(current).find(({ id }) => id === selected.id);
      const patch = JSON.parse(options.body);
      expect(patch).toEqual({ status: "published", published_at: now, scheduled_at: null });
      const matches = [...searchParams].every(([name, filter]) => filter === "is.null"
        ? row[name] === null
        : filter === `eq.${row[name]}`);
      if (!matches) return Response.json([]);
      Object.assign(row, patch);
      return Response.json([{ id: row.id }]);
    });
    vi.stubGlobal("fetch", fetchMock);
    await import("./publish-scheduled-content.mjs");

    expect(fetchMock).toHaveBeenCalledTimes(Object.keys(original).length + 2);
    expect(current.ready).toMatchObject({ status: "published", scheduled_at: null });
    expect(current.postponed).toMatchObject({ status: "scheduled", scheduled_at: "2026-11-27T09:00:00+00:00" });
    expect(current.moved).toMatchObject({ status: "scheduled", scheduled_at: "2026-11-27T07:30:00+00:00" });
    expect(current.hidden.status).toBe("hidden");
    expect(current.deleted).toMatchObject({ status: "scheduled", deleted_at: now });
    expect(current.edited).toMatchObject({ status: "scheduled", updated_at: now });
    expect(appendFile.mock.calls).toEqual([
      ["mock-output", "published=1\n", "utf8"],
      ["mock-output", `ids=${original.ready.id}\n`, "utf8"],
    ]);
  });
});
