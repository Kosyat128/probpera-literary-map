import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const outputRoot = path.resolve(
  process.env.BACKUP_OUTPUT_DIR?.trim() || "backup/storage"
);

if (!url || !serviceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listFolder(bucket, prefix = "") {
  const collected = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const entries = data || [];
    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) collected.push(objectPath);
      else collected.push(...(await listFolder(bucket, objectPath)));
    }
    if (entries.length < limit) break;
    offset += limit;
  }
  return collected;
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) throw bucketError;

const manifest = [];
for (const bucket of buckets || []) {
  const objects = await listFolder(bucket.id);
  for (const objectPath of objects) {
    const { data, error } = await supabase.storage.from(bucket.id).download(objectPath);
    if (error) throw error;
    const target = path.join(outputRoot, bucket.id, ...objectPath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    const bytes = Buffer.from(await data.arrayBuffer());
    await writeFile(target, bytes);
    manifest.push({ bucket: bucket.id, path: objectPath, bytes: bytes.length });
  }
}

await mkdir(outputRoot, { recursive: true });
await writeFile(
  path.join(outputRoot, "storage-manifest.json"),
  `${JSON.stringify({ createdAt: new Date().toISOString(), objects: manifest }, null, 2)}\n`,
  "utf8"
);
console.log(`Backed up ${manifest.length} storage objects.`);
