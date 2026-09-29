import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifySupabaseStorageBackup } from "../verify-supabase-storage-backup.mjs";

const digest = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
export function storageBackupTarget(root, bucket, objectPath) {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/iu.test(bucket)) throw Error("storage_backup_unsafe_bucket");
  const segments = String(objectPath || "").split("/");
  if (!segments.length || segments.some(segment => !segment || segment === "." || segment === ".." || /[\\\u0000-\u001f\u007f]/u.test(segment))) throw Error("storage_backup_unsafe_path");
  const target = path.resolve(root, bucket, ...segments);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) throw Error("storage_backup_path_escape");
  return target;
}
const etagForBytes = entry => {
  const value = String(entry.metadata?.eTag || entry.metadata?.etag || "").replace(/^"|"$/g, "");
  return /^[a-f0-9]{32}$/i.test(value) ? value.toLowerCase() : null;
};
function checkedError(error) {
  if (!error) return;
  if (Number(error.status ?? error.statusCode) === 402) throw Error("supabase_service_restricted_402");
  throw Error("storage_backup_request_failed");
}

/** Build a complete independent archive. Reuse only SHA-256 verified backup bytes
 * whose MD5 matches the live Storage ETag. Weak/multipart tags miss the cache.
 */
export async function backupSupabaseStorage({ supabase, outputRoot, reuseRoot = null }) {
  outputRoot = path.resolve(outputRoot);
  const previous = new Map();
  if (reuseRoot) {
    reuseRoot = path.resolve(reuseRoot);
    if (reuseRoot === outputRoot) throw Error("storage_backup_reuse_overlaps_output");
    await verifySupabaseStorageBackup(reuseRoot);
    const manifest = JSON.parse(await readFile(path.join(reuseRoot, "storage-manifest.json"), "utf8"));
    for (const row of manifest.objects) previous.set(`${row.bucket}\0${row.path}`, row);
  }
  const counters = { downloadedObjects: 0, reusedObjects: 0, downloadedBytes: 0, reusedBytes: 0 };
  const manifest = [];
  async function listFolder(bucket, prefix = "") {
    const collected = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      checkedError(error);
      if (!Array.isArray(data)) throw Error("storage_backup_listing_invalid");
      const entries = data;
      for (const entry of entries) {
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        storageBackupTarget(outputRoot, bucket, objectPath);
        if (entry.id) collected.push({ ...entry, path: objectPath });
        else collected.push(...await listFolder(bucket, objectPath));
      }
      if (entries.length < 100) break;
    }
    return collected;
  }
  const { data: buckets, error } = await supabase.storage.listBuckets();
  checkedError(error);
  if (!Array.isArray(buckets)) throw Error("storage_backup_listing_invalid");
  for (const bucket of buckets) {
    for (const entry of await listFolder(bucket.id)) {
      const target = storageBackupTarget(outputRoot, bucket.id, entry.path);
      await mkdir(path.dirname(target), { recursive: true });
      const expectedEtag = etagForBytes(entry);
      const old = previous.get(`${bucket.id}\0${entry.path}`);
      let bytes, reused = false;
      if (old && expectedEtag && old.bytes === Number(entry.metadata?.size)) {
        bytes = await readFile(storageBackupTarget(reuseRoot, bucket.id, entry.path));
        if (bytes.length !== old.bytes || digest(bytes) !== old.sha256) throw Error("storage_backup_reuse_corrupt");
        reused = digest(bytes, "md5") === expectedEtag;
      }
      if (reused) {
        await copyFile(storageBackupTarget(reuseRoot, bucket.id, entry.path), target);
        counters.reusedObjects++; counters.reusedBytes += bytes.length;
      } else {
        const { data, error } = await supabase.storage.from(bucket.id).download(entry.path);
        checkedError(error);
        bytes = Buffer.from(await data.arrayBuffer());
        if (expectedEtag && digest(bytes, "md5") !== expectedEtag) throw Error("storage_object_changed_during_backup");
        if (Number.isSafeInteger(entry.metadata?.size) && bytes.length !== entry.metadata.size) throw Error("storage_object_size_changed_during_backup");
        await writeFile(target, bytes);
        counters.downloadedObjects++; counters.downloadedBytes += bytes.length;
      }
      manifest.push({ bucket: bucket.id, path: entry.path, bytes: bytes.length, sha256: digest(bytes),
        sourceEtag: expectedEtag, sourceUpdatedAt: entry.updated_at || null });
    }
  }
  await mkdir(outputRoot, { recursive: true });
  const result = { version: 2, createdAt: new Date().toISOString(), objectCount: manifest.length,
    totalBytes: manifest.reduce((total, row) => total + row.bytes, 0), ...counters,
    objects: manifest.sort((a, b) => a.bucket.localeCompare(b.bucket, "en") || a.path.localeCompare(b.path, "en")) };
  await writeFile(path.join(outputRoot, "storage-manifest.json"), `${JSON.stringify(result, null, 2)}\n`);
  await verifySupabaseStorageBackup(outputRoot);
  return result;
}
