import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { backupSupabaseStorage } from "./supabase-storage-backup.mjs";
import { verifySupabaseStorageBackup } from "../verify-supabase-storage-backup.mjs";

const hash = (bytes, type = "sha256") => createHash(type).update(bytes).digest("hex");
async function fixture(oldFiles, liveFiles) {
  const root = await mkdtemp(path.join(os.tmpdir(), "probpera-storage-reuse-"));
  const base = path.join(root, "old"), output = path.join(root, "new");
  await mkdir(path.join(base, "editorial-media"), { recursive: true });
  const objects = [];
  for (const [name, text] of Object.entries(oldFiles)) {
    const bytes = Buffer.from(text);
    await writeFile(path.join(base, "editorial-media", name), bytes);
    objects.push({ bucket: "editorial-media", path: name, bytes: bytes.length, sha256: hash(bytes) });
  }
  await writeFile(path.join(base, "storage-manifest.json"), JSON.stringify({ version: 2, objectCount: objects.length,
    totalBytes: objects.reduce((n, row) => n + row.bytes, 0), objects }));
  const download = vi.fn(async name => ({ data: new Blob([liveFiles[name]]), error: null }));
  const list = vi.fn(async (_, { offset, limit }) => ({ data: Object.entries(liveFiles).slice(offset, offset + limit)
    .map(([name, text]) => ({ id: name, name, updated_at: "2026-09-29T00:00:00Z", metadata: { size: Buffer.byteLength(text), eTag: hash(Buffer.from(text), "md5") } })), error: null }));
  const listBuckets = vi.fn(async () => ({ data: [{ id: "editorial-media" }], error: null }));
  return { base, output, download, list, listBuckets, supabase: { storage: { listBuckets, from: () => ({ list, download }) } } };
}
describe("quota-aware complete Storage backup", () => {
  it("reuses unchanged legacy v2 archive bytes without downloading any media", async () => {
    const f = await fixture({ "same.webp": "known-image" }, { "same.webp": "known-image" });
    const result = await backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output, reuseRoot: f.base });
    expect(f.download).not.toHaveBeenCalled();
    expect(result).toMatchObject({ objectCount: 1, downloadedBytes: 0, reusedObjects: 1, reusedBytes: 11 });
    expect(await verifySupabaseStorageBackup(f.output)).toEqual({ objectCount: 1, totalBytes: 11 });
  });
  it("downloads changed/new objects, excludes deletions and leaves the base unchanged", async () => {
    const f = await fixture({ "changed.webp": "old", "deleted.webp": "gone" }, { "changed.webp": "new", "added.webp": "added" });
    const result = await backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output, reuseRoot: f.base });
    expect(f.download.mock.calls.map(x => x[0])).toEqual(["changed.webp", "added.webp"]);
    expect(result).toMatchObject({ objectCount: 2, downloadedObjects: 2, downloadedBytes: 8, reusedObjects: 0 });
    expect(result.objects.some(row => row.path === "deleted.webp")).toBe(false);
    expect(await readFile(path.join(f.base, "editorial-media", "changed.webp"), "utf8")).toBe("old");
    expect(await verifySupabaseStorageBackup(f.output)).toEqual({ objectCount: 2, totalBytes: 8 });
  });
  it("fails on corrupt encrypted-backup contents before making a Storage request", async () => {
    const f = await fixture({ "same.webp": "correct" }, { "same.webp": "correct" });
    await writeFile(path.join(f.base, "editorial-media", "same.webp"), "corrupt");
    await expect(backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output, reuseRoot: f.base })).rejects.toThrow("verification failed");
    expect(f.listBuckets).not.toHaveBeenCalled();
    expect(f.download).not.toHaveBeenCalled();
  });
  it("stops immediately on 402 without retrying or declaring a complete backup", async () => {
    const f = await fixture({}, { "one.webp": "one", "two.webp": "two" });
    f.download.mockResolvedValue({ data: null, error: { statusCode: "402", message: "quota" } });
    await expect(backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output, reuseRoot: f.base })).rejects.toThrow("supabase_service_restricted_402");
    expect(f.download).toHaveBeenCalledTimes(1);
    await expect(readFile(path.join(f.output, "storage-manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("rejects a changed download and cannot mark it as the earlier listed version", async () => {
    const f = await fixture({}, { "one.webp": "first" });
    f.download.mockResolvedValue({ data: new Blob(["later"]), error: null });
    await expect(backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output })).rejects.toThrow("storage_object_changed_during_backup");
    await expect(readFile(path.join(f.output, "storage-manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("cannot mark a malformed successful listing as an empty healthy backup", async () => {
    const f = await fixture({}, {});
    f.listBuckets.mockResolvedValue({ data: null, error: null });
    await expect(backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output })).rejects.toThrow("storage_backup_listing_invalid");
    f.listBuckets.mockResolvedValue({ data: [{ id: "editorial-media" }], error: null });
    f.list.mockResolvedValue({ data: null, error: null });
    await expect(backupSupabaseStorage({ supabase: f.supabase, outputRoot: f.output })).rejects.toThrow("storage_backup_listing_invalid");
    await expect(readFile(path.join(f.output, "storage-manifest.json"))).rejects.toMatchObject({ code: "ENOENT" });
  });
});
