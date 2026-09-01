import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { verifySupabaseStorageBackup } from "./verify-supabase-storage-backup.mjs";

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "probpera-storage-restore-"));
  const bytes = Buffer.from("verified-storage-object", "utf8");
  await mkdir(path.join(root, "editorial-media", "2026"), { recursive: true });
  await writeFile(path.join(root, "editorial-media", "2026", "image.webp"), bytes);
  await writeFile(
    path.join(root, "storage-manifest.json"),
    JSON.stringify({
      version: 2,
      objectCount: 1,
      totalBytes: bytes.length,
      objects: [{
        bucket: "editorial-media",
        path: "2026/image.webp",
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        ...overrides,
      }],
    })
  );
  return root;
}

describe("Supabase Storage restore verifier", () => {
  it("verifies every restored object by size and SHA-256", async () => {
    await expect(verifySupabaseStorageBackup(await fixture())).resolves.toEqual({
      objectCount: 1,
      totalBytes: 23,
    });
  });

  it("fails closed on corruption and path traversal", async () => {
    await expect(
      verifySupabaseStorageBackup(await fixture({ sha256: "0".repeat(64) }))
    ).rejects.toThrow("verification failed");
    await expect(
      verifySupabaseStorageBackup(await fixture({ path: "../escape.webp" }))
    ).rejects.toThrow("unsafe object path");
  });
});
