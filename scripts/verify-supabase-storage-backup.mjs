import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {createStorageBackupRoot,isStorageBackupRoot,storageBackupIdentity} from './lib/storage-backup-filesystem.mjs';

const shaPattern = /^[0-9a-f]{64}$/u;

export async function readVerifiedSupabaseStorageBackup(rootDirectory) {
  const root=isStorageBackupRoot(rootDirectory)?rootDirectory:await createStorageBackupRoot(rootDirectory);
  const manifest=JSON.parse((await root.readManifest()).toString('utf8'));
  if (
    manifest?.version !== 2 || !Array.isArray(manifest.objects) ||
    !Number.isSafeInteger(manifest.objectCount) ||
    manifest.objectCount !== manifest.objects.length||!Number.isSafeInteger(manifest.totalBytes)||manifest.totalBytes<0
  ) throw new Error("Storage manifest has an unsupported contract.");
  let totalBytes = 0;
  const identities = new Set();
  for (const item of manifest.objects) {
    if (
      !item || typeof item !== "object" ||
      !Number.isSafeInteger(item.bytes) || item.bytes < 0 ||
      typeof item.sha256 !== "string" || !shaPattern.test(item.sha256)
    ) throw new Error("Storage manifest object metadata is invalid.");
    let identity;
    try{identity=storageBackupIdentity(item.bucket,item.path);}catch(error){
      throw Error(error.message==='storage_backup_unsafe_bucket'?'Storage manifest contains an unsafe bucket identifier.':'Storage manifest contains an unsafe object path.');
    }
    if (identities.has(identity)) throw new Error("Storage manifest contains duplicate objects.");
    identities.add(identity);
    const bytes = await root.readObject(item.bucket,item.path);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== item.bytes || digest !== item.sha256) {
      throw new Error(`Storage restore verification failed for ${item.bucket}/${item.path}.`);
    }
    totalBytes += bytes.length;
    if(!Number.isSafeInteger(totalBytes))throw Error('Storage manifest total byte count is invalid.');
  }
  if (manifest.totalBytes !== totalBytes) {
    throw new Error("Storage manifest total byte count does not match restored objects.");
  }
  return { objectCount: manifest.objects.length, totalBytes,manifest };
}
export async function verifySupabaseStorageBackup(rootDirectory){
  const {objectCount,totalBytes}=await readVerifiedSupabaseStorageBackup(rootDirectory);return{objectCount,totalBytes};
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2];
  if (!root) throw new Error("Usage: node scripts/verify-supabase-storage-backup.mjs <storage-root>");
  const result = await verifySupabaseStorageBackup(root);
  console.log(
    `Verified ${result.objectCount} restored storage object(s), ${result.totalBytes} byte(s).`
  );
}
