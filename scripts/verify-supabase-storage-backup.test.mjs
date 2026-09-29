import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile,readFile,symlink,unlink } from "node:fs/promises";
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
  it('rejects unsafe manifest metadata without coercing arbitrary values into filesystem names',async()=>{
    for(const value of [{bucket:123},{path:{}},{path:'image.webp:stream'},{path:'CON.webp'},{path:'name.'},{path:'name '}])
      await expect(verifySupabaseStorageBackup(await fixture(value))).rejects.toThrow(/unsafe (?:bucket identifier|object path)/);
  });
  it('rejects a manifest symlink even when the outside manifest has otherwise valid hashes',async context=>{
    const root=await fixture(),outside=await fixture(),manifest=path.join(root,'storage-manifest.json');
    await unlink(manifest);
    try{await symlink(path.join(outside,'storage-manifest.json'),manifest,'file');}
    catch(error){if(['EPERM','EACCES','ENOTSUP','ENOSYS'].includes(error.code)){context.skip();return;}throw error;}
    await expect(verifySupabaseStorageBackup(root)).rejects.toThrow('storage_backup_unsafe_filesystem');
    expect(await readFile(path.join(outside,'storage-manifest.json'),'utf8')).toContain('"version":2');
  });
  it('rejects portable case aliases instead of counting the same Windows file twice',async()=>{
    const root=await fixture(),file=path.join(root,'storage-manifest.json'),manifest=JSON.parse(await readFile(file,'utf8'));
    manifest.objects.push({...manifest.objects[0],path:'2026/IMAGE.webp'});manifest.objectCount=2;manifest.totalBytes*=2;
    await writeFile(file,JSON.stringify(manifest));
    await expect(verifySupabaseStorageBackup(root)).rejects.toThrow('duplicate objects');
  });
});
