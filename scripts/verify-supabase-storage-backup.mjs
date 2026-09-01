import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const shaPattern = /^[0-9a-f]{64}$/u;

function safeTarget(root, bucket, objectPath) {
  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/iu.test(bucket)) {
    throw new Error("Storage manifest contains an unsafe bucket identifier.");
  }
  const segments = String(objectPath || "").split("/");
  if (
    !segments.length ||
    segments.some((segment) =>
      !segment || segment === "." || segment === ".." ||
      /[\\\u0000-\u001f\u007f]/u.test(segment)
    )
  ) throw new Error("Storage manifest contains an unsafe object path.");
  const target = path.resolve(root, bucket, ...segments);
  if (!target.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error("Storage manifest path escaped the restore directory.");
  }
  return target;
}
export async function verifySupabaseStorageBackup(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "storage-manifest.json"), "utf8")
  );
  if (
    manifest?.version !== 2 || !Array.isArray(manifest.objects) ||
    !Number.isSafeInteger(manifest.objectCount) ||
    manifest.objectCount !== manifest.objects.length
  ) throw new Error("Storage manifest has an unsupported contract.");
  let totalBytes = 0;
  const identities = new Set();
  for (const item of manifest.objects) {
    if (
      !item || typeof item !== "object" ||
      !Number.isSafeInteger(item.bytes) || item.bytes < 0 ||
      typeof item.sha256 !== "string" || !shaPattern.test(item.sha256)
    ) throw new Error("Storage manifest object metadata is invalid.");
    const identity = `${item.bucket}\u0000${item.path}`;
    if (identities.has(identity)) throw new Error("Storage manifest contains duplicate objects.");
    identities.add(identity);
    const bytes = await fs.readFile(safeTarget(root, item.bucket, item.path));
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== item.bytes || digest !== item.sha256) {
      throw new Error(`Storage restore verification failed for ${item.bucket}/${item.path}.`);
    }
    totalBytes += bytes.length;
  }
  if (manifest.totalBytes !== totalBytes) {
    throw new Error("Storage manifest total byte count does not match restored objects.");
  }
  return { objectCount: manifest.objects.length, totalBytes };
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
