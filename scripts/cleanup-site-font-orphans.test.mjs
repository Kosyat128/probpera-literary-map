import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  assertServiceRoleCredential,
  cleanupSiteFontOrphans,
  isContentAddressedFontPath,
  listReferencedSiteFontPaths,
  listSiteFontObjects,
} from "./cleanup-site-font-orphans.mjs";

const environment = {
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test-only",
};
const now = new Date("2026-08-30T12:00:00.000Z");
const oldTimestamp = "2026-08-28T11:59:59.000Z";
const freshTimestamp = "2026-08-30T11:30:00.000Z";
const hashes = {
  referenced: "aa".repeat(32),
  orphan: "bb".repeat(32),
  fresh: "cc".repeat(32),
  secondOrphan: "dd".repeat(32),
};
const paths = {
  referenced: `sha256/aa/${hashes.referenced}.woff2`,
  orphan: `sha256/bb/${hashes.orphan}.woff`,
  fresh: `sha256/cc/${hashes.fresh}.woff2`,
  secondOrphan: `sha256/dd/${hashes.secondOrphan}.woff2`,
};

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

function folder(name) {
  return { name, id: null, metadata: null };
}

function objectEntry(objectPath, timestamp = oldTimestamp) {
  return {
    name: objectPath.split("/").at(-1),
    id: `id-${objectPath}`,
    metadata: { size: 123 },
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function storageTreeFetch({ invalidLeaf = null } = {}) {
  return vi.fn(async (url, options) => {
    expect(options.headers.apikey).toBe(environment.SUPABASE_SERVICE_ROLE_KEY);
    const body = JSON.parse(options.body);
    const byPrefix = {
      "": [folder("sha256")],
      sha256: [folder("aa"), folder("bb"), folder("cc"), folder("dd")],
      "sha256/aa": [objectEntry(paths.referenced)],
      "sha256/bb": [invalidLeaf || objectEntry(paths.orphan)],
      "sha256/cc": [objectEntry(paths.fresh, freshTimestamp)],
      "sha256/dd": [objectEntry(paths.secondOrphan)],
    };
    const entries = byPrefix[body.prefix] || [];
    return jsonResponse(entries.slice(body.offset, body.offset + body.limit));
  });
}

describe("site font orphan cleanup", () => {
  it("accepts only exact hash-addressed WOFF paths whose shard matches the hash", () => {
    expect(isContentAddressedFontPath(paths.referenced)).toBe(true);
    expect(isContentAddressedFontPath(paths.orphan)).toBe(true);
    expect(
      isContentAddressedFontPath(`sha256/ff/${hashes.referenced}.woff2`)
    ).toBe(false);
    expect(isContentAddressedFontPath(`/${paths.referenced}`)).toBe(false);
    expect(isContentAddressedFontPath(`${paths.referenced}.css`)).toBe(false);
    expect(isContentAddressedFontPath("sha256/aa/font.woff2")).toBe(false);
  });

  it("requires a service-role credential and never reflects a rejected key", () => {
    expect(assertServiceRoleCredential("sb_secret_value")).toBe(
      "sb_secret_value"
    );
    expect(() => assertServiceRoleCredential("sb_publishable_do-not-log")).toThrow(
      "publishable"
    );
    try {
      assertServiceRoleCredential("private-value-do-not-log");
    } catch (error) {
      expect(String(error)).not.toContain("private-value-do-not-log");
    }
  });

  it("lists storage recursively and paginates every prefix", async () => {
    const fetchImpl = storageTreeFetch();
    const objects = await listSiteFontObjects({
      ...environment,
      supabaseUrl: environment.SUPABASE_URL,
      serviceKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl,
      pageSize: 1,
    });

    expect(objects.map((entry) => entry.objectPath).sort()).toEqual(
      Object.values(paths).sort()
    );
    const calls = fetchImpl.mock.calls.map(([, options]) => JSON.parse(options.body));
    expect(calls).toContainEqual(
      expect.objectContaining({ prefix: "sha256", offset: 1, limit: 1 })
    );
    expect(calls).toContainEqual(
      expect.objectContaining({ prefix: "sha256/aa", offset: 1, limit: 1 })
    );
  });

  it("reads all font_assets pages without excluding archived rows", async () => {
    const fetchImpl = vi.fn(async (url, options) => {
      expect(options.method).toBe("GET");
      const parsed = new URL(url);
      expect(parsed.searchParams.get("storage_bucket")).toBe("eq.site-fonts");
      expect(parsed.searchParams.has("deleted_at")).toBe(false);
      const offset = Number(parsed.searchParams.get("offset"));
      return jsonResponse(
        offset === 0
          ? [{ object_path: paths.referenced }]
          : offset === 1
            ? [{ object_path: paths.orphan }]
            : []
      );
    });

    const references = await listReferencedSiteFontPaths({
      supabaseUrl: environment.SUPABASE_URL,
      serviceKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl,
      pageSize: 1,
    });
    expect([...references]).toEqual([paths.referenced, paths.orphan]);
  });

  it("defaults to dry-run and keeps referenced, archived, and fresh objects", async () => {
    const storageFetch = storageTreeFetch();
    const fetchImpl = vi.fn(async (url, options) => {
      if (String(url).includes("/storage/v1/object/list/")) {
        return storageFetch(url, options);
      }
      if (String(url).includes("/rest/v1/font_assets")) {
        return jsonResponse([{ object_path: paths.referenced }]);
      }
      throw new Error("DELETE must not run in dry-run mode");
    });

    const result = await cleanupSiteFontOrphans({
      environment,
      fetchImpl,
      now,
    });

    expect(result).toMatchObject({
      mode: "dry-run",
      scannedObjects: 4,
      referencedObjects: 1,
      eligibleOrphans: 2,
      planned: 2,
      deleted: 0,
      truncated: false,
      graceHours: 24,
    });
    expect(fetchImpl.mock.calls.some(([, options]) => options.method === "DELETE")).toBe(
      false
    );
  });

  it("rechecks references, applies the conservative age gate, and bounds deletion", async () => {
    const storageFetch = storageTreeFetch();
    let referenceSnapshot = 0;
    const deleteBodies = [];
    const fetchImpl = vi.fn(async (url, options) => {
      if (String(url).includes("/storage/v1/object/list/")) {
        return storageFetch(url, options);
      }
      if (String(url).includes("/rest/v1/font_assets")) {
        referenceSnapshot += 1;
        return jsonResponse(
          referenceSnapshot === 1
            ? [{ object_path: paths.referenced }]
            : [
                { object_path: paths.referenced },
                { object_path: paths.secondOrphan },
              ]
        );
      }
      if (options.method === "DELETE") {
        const body = JSON.parse(options.body);
        deleteBodies.push(body);
        return jsonResponse([]);
      }
      throw new Error("unexpected request");
    });

    const result = await cleanupSiteFontOrphans({
      environment,
      fetchImpl,
      now,
      apply: true,
      maxDeleteBatch: 1,
    });

    expect(referenceSnapshot).toBe(2);
    expect(deleteBodies).toEqual([{ prefixes: [paths.orphan] }]);
    expect(result).toMatchObject({
      mode: "apply",
      referencedObjects: 2,
      eligibleOrphans: 1,
      planned: 1,
      deleted: 1,
      truncated: false,
    });
  });

  it("never deletes more than the fixed maximum selected for one run", async () => {
    const storageFetch = storageTreeFetch();
    const deleteBodies = [];
    const fetchImpl = vi.fn(async (url, options) => {
      if (String(url).includes("/storage/v1/object/list/")) {
        return storageFetch(url, options);
      }
      if (String(url).includes("/rest/v1/font_assets")) {
        return jsonResponse([{ object_path: paths.referenced }]);
      }
      if (options.method === "DELETE") {
        const body = JSON.parse(options.body);
        deleteBodies.push(body);
        return jsonResponse(body.prefixes.map((name) => ({ name })));
      }
      throw new Error("unexpected request");
    });

    const result = await cleanupSiteFontOrphans({
      environment,
      fetchImpl,
      now,
      apply: true,
      maxDeleteBatch: 1,
    });

    expect(deleteBodies).toHaveLength(1);
    expect(deleteBodies[0].prefixes).toHaveLength(1);
    expect(result).toMatchObject({
      eligibleOrphans: 2,
      planned: 1,
      deleted: 1,
      truncated: true,
    });
  });

  it("fails closed before deletion on invalid object metadata or network errors", async () => {
    const invalidLeaf = {
      ...objectEntry(paths.orphan),
      name: "not-content-addressed.woff2",
    };
    const invalidFetch = storageTreeFetch({ invalidLeaf });
    await expect(
      cleanupSiteFontOrphans({
        environment,
        fetchImpl: invalidFetch,
        now,
        apply: true,
      })
    ).rejects.toThrow("non-canonical");
    expect(
      invalidFetch.mock.calls.some(([, options]) => options.method === "DELETE")
    ).toBe(false);

    const networkFetch = vi.fn(async () => {
      throw new Error("network including an internal token");
    });
    await expect(
      cleanupSiteFontOrphans({
        environment,
        fetchImpl: networkFetch,
        now,
        apply: true,
      })
    ).rejects.toThrow("request failed");
  });

  it("keeps the workflow read-only by default and schedules an explicit bounded apply", () => {
    const workflow = readFileSync(
      path.join(
        process.cwd(),
        ".github",
        "workflows",
        "cleanup-site-font-orphans.yml"
      ),
      "utf8"
    );
    expect(workflow).toContain('cron: "41 3 * * 0"');
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("default: false");
    expect(workflow).toContain("node scripts/cleanup-site-font-orphans.mjs\n");
    expect(workflow).toContain(
      "node scripts/cleanup-site-font-orphans.mjs --apply"
    );
    expect(workflow).toContain("SUPABASE_SERVICE_ROLE_KEY:");
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toContain("contents: write");
  });
});
