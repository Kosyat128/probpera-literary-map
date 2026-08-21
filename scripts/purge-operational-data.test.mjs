import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  operationalRetentionRules,
  purgeOperationalData,
  retentionCutoff,
  retentionDeletePath,
} from "./purge-operational-data.mjs";

const now = new Date("2026-08-22T00:00:00.000Z");

describe("operational data retention", () => {
  it("uses explicit retention windows for each operational dataset", () => {
    expect(operationalRetentionRules).toEqual([
      expect.objectContaining({
        id: "resolved-client-errors",
        retentionDays: 90,
      }),
      expect.objectContaining({ id: "open-client-errors", retentionDays: 180 }),
      expect.objectContaining({ id: "content-views", retentionDays: 365 }),
    ]);
    expect(retentionCutoff(90, now)).toBe("2026-05-24T00:00:00.000Z");
    expect(retentionCutoff(180, now)).toBe("2026-02-23T00:00:00.000Z");
    expect(retentionCutoff(365, now)).toBe("2025-08-22T00:00:00.000Z");
  });

  it("prepares a dry run without sending destructive requests", async () => {
    const fetchImpl = vi.fn();
    const result = await purgeOperationalData({
      environment: {
        SUPABASE_URL: "https://project.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
      },
      fetchImpl,
      now,
      apply: false,
    });

    expect(result.applied).toBe(false);
    expect(result.configured).toBe(true);
    expect(result.operations).toHaveLength(3);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("deletes only rows older than each cutoff with service-role authorization", async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, options) => {
      calls.push({ url: String(url), options });
      return {
        ok: true,
        status: 204,
        headers: new Headers({ "content-range": "*/7" }),
        text: async () => "",
      };
    });

    const result = await purgeOperationalData({
      environment: {
        SUPABASE_URL: "https://project.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: "service-key",
      },
      fetchImpl,
      now,
      apply: true,
    });

    expect(result.applied).toBe(true);
    expect(result.operations.map((operation) => operation.deleted)).toEqual([
      7, 7, 7,
    ]);
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.options.method).toBe("DELETE");
      expect(call.options.headers).toMatchObject({
        apikey: "service-key",
        Authorization: "Bearer service-key",
        Prefer: "count=exact,return=minimal",
      });
      expect(new URL(call.url).searchParams.get("created_at")).toMatch(
        /^lt\.\d{4}-\d{2}-\d{2}T/u
      );
    }
    expect(new URL(calls[0].url).searchParams.get("status")).toBe(
      "in.(resolved,ignored)"
    );
    expect(new URL(calls[1].url).searchParams.get("status")).toBe("eq.open");
    expect(new URL(calls[2].url).pathname).toEndWith("/content_views");
  });

  it("fails closed in Actions when the service credentials are absent", async () => {
    await expect(
      purgeOperationalData({
        environment: { GITHUB_ACTIONS: "true" },
        now,
        apply: true,
      })
    ).rejects.toThrow("Operational retention requires");
  });

  it("keeps the scheduled workflow narrow and explicitly destructive", () => {
    const workflow = readFileSync(
      path.join(
        process.cwd(),
        ".github",
        "workflows",
        "operational-retention.yml"
      ),
      "utf8"
    );
    expect(workflow).toContain('cron: "23 2 * * *"');
    expect(workflow).toContain("node scripts/purge-operational-data.mjs --apply");
    expect(workflow).toContain("SUPABASE_SERVICE_ROLE_KEY:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
  });

  it("encodes filters through URLSearchParams instead of string concatenation", () => {
    const pathValue = retentionDeletePath(operationalRetentionRules[0], now);
    const url = new URL(`https://example.test/${pathValue}`);
    expect(url.searchParams.get("status")).toBe("in.(resolved,ignored)");
    expect(url.searchParams.get("created_at")).toBe(
      "lt.2026-05-24T00:00:00.000Z"
    );
  });
});
