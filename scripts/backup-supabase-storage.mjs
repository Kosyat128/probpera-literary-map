import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { backupSupabaseStorage } from "./lib/supabase-storage-backup.mjs";
import { trustedSupabaseOrigin } from "./lib/trusted-server-url.mjs";

const url = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) throw Error("storage_backup_credentials_missing");
const supabase = createClient(trustedSupabaseOrigin(url), serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
try {
  const result = await backupSupabaseStorage({ supabase,
    outputRoot: path.resolve(process.env.BACKUP_OUTPUT_DIR?.trim() || "backup/storage"),
    reuseRoot: process.env.BACKUP_REUSE_STORAGE_DIR?.trim() || null });
  console.log(JSON.stringify({ objectCount: result.objectCount, totalBytes: result.totalBytes,
    downloadedObjects: result.downloadedObjects, downloadedBytes: result.downloadedBytes,
    reusedObjects: result.reusedObjects, reusedBytes: result.reusedBytes }));
} catch (error) {
  console.error(JSON.stringify({ status: "blocked", code: /^[a-z_0-9]+$/.test(error.message) ? error.message : "storage_backup_failed" }));
  process.exitCode = 1;
}
