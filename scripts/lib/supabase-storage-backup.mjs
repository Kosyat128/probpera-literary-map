import { createHash } from "node:crypto";
import { readVerifiedSupabaseStorageBackup,verifySupabaseStorageBackup } from "../verify-supabase-storage-backup.mjs";
import { createStorageBackupRoot,storageBackupTarget,storageBackupIdentity,storageBackupRootsOverlap } from './storage-backup-filesystem.mjs';
export { storageBackupTarget } from './storage-backup-filesystem.mjs';

const digest = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
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
  const planned=await createStorageBackupRoot(outputRoot,{allowMissing:true});
  const reuse=reuseRoot===null?null:await createStorageBackupRoot(reuseRoot);
  if(reuse&&storageBackupRootsOverlap(planned.root,reuse.root))throw Error('storage_backup_reuse_overlaps_output');
  const previous = new Map();
  if (reuse) {
    const {manifest}=await readVerifiedSupabaseStorageBackup(reuse);
    for (const row of manifest.objects) previous.set(`${row.bucket}\0${row.path}`, row);
  }
  const output=await createStorageBackupRoot(planned.root,{create:true});
  await output.requireEmpty();
  const counters = { downloadedObjects: 0, reusedObjects: 0, downloadedBytes: 0, reusedBytes: 0 };
  const manifest = [];
  const identities=new Set(),folders=new Set();
  async function listFolder(bucket, prefix = "") {
    const folder=`${bucket}\0${prefix}`;if(folders.has(folder))throw Error('storage_backup_listing_duplicate');folders.add(folder);
    const collected = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      checkedError(error);
      if (!Array.isArray(data)) throw Error("storage_backup_listing_invalid");
      const entries = data;
      for (const entry of entries) {
        if(!entry||typeof entry!=='object'||Array.isArray(entry)||typeof entry.name!=='string')throw Error('storage_backup_listing_invalid');
        const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        storageBackupTarget(output.root, bucket, objectPath);
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
    if(!bucket||typeof bucket.id!=='string')throw Error('storage_backup_listing_invalid');
    for (const entry of await listFolder(bucket.id)) {
      const identity=storageBackupIdentity(bucket.id,entry.path);
      if(identities.has(identity))throw Error('storage_backup_listing_duplicate');identities.add(identity);
      const expectedEtag = etagForBytes(entry);
      const old = previous.get(`${bucket.id}\0${entry.path}`);
      let bytes, reused = false;
      if (old && expectedEtag && old.bytes === Number(entry.metadata?.size)) {
        bytes = await reuse.readObject(bucket.id, entry.path);
        if (bytes.length !== old.bytes || digest(bytes) !== old.sha256) throw Error("storage_backup_reuse_corrupt");
        reused = digest(bytes, "md5") === expectedEtag;
      }
      if (reused) {
        await output.writeObject(bucket.id,entry.path,bytes);
        counters.reusedObjects++; counters.reusedBytes += bytes.length;
      } else {
        const { data, error } = await supabase.storage.from(bucket.id).download(entry.path);
        checkedError(error);
        bytes = Buffer.from(await data.arrayBuffer());
        if (expectedEtag && digest(bytes, "md5") !== expectedEtag) throw Error("storage_object_changed_during_backup");
        if (Number.isSafeInteger(entry.metadata?.size) && bytes.length !== entry.metadata.size) throw Error("storage_object_size_changed_during_backup");
        await output.writeObject(bucket.id,entry.path,bytes);
        counters.downloadedObjects++; counters.downloadedBytes += bytes.length;
      }
      manifest.push({ bucket: bucket.id, path: entry.path, bytes: bytes.length, sha256: digest(bytes),
        sourceEtag: expectedEtag, sourceUpdatedAt: entry.updated_at || null });
    }
  }
  const result = { version: 2, createdAt: new Date().toISOString(), objectCount: manifest.length,
    totalBytes: manifest.reduce((total, row) => total + row.bytes, 0), ...counters,
    objects: manifest.sort((a, b) => a.bucket.localeCompare(b.bucket, "en") || a.path.localeCompare(b.path, "en")) };
  await output.writeManifest(`${JSON.stringify(result, null, 2)}\n`);
  // Every completed archive is verified, including a fresh backup with no reuse.
  await verifySupabaseStorageBackup(output);
  return result;
}
