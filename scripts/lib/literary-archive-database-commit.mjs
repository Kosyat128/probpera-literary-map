import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const safetyScript = fileURLToPath(new URL("../database/supabase-database-safety.sh", import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const receiptLimit = 128 * 1024;

function checkedArgs(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)
    || Object.keys(args).sort().join(",") !== "p_expected_manifest_sha256,p_release_id"
    || typeof args.p_release_id !== "string" || typeof args.p_expected_manifest_sha256 !== "string"
    || !UUID.test(args.p_release_id || "")
    || !SHA256.test(args.p_expected_manifest_sha256 || "")) {
    throw new Error("Native archive commit requires an exact release UUID and manifest SHA-256.");
  }
  return args;
}

export function parseNativeArchiveCommitReceipt(stdout, args) {
  checkedArgs(args);
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > receiptLimit) {
    throw new Error("Native archive commit returned an invalid receipt envelope.");
  }
  let envelope;
  try { envelope = JSON.parse(stdout.trim()); }
  catch { throw new Error("Native archive commit returned an invalid receipt envelope."); }
  if (!envelope || Object.keys(envelope).sort().join(",") !== "elapsedMs,receipt,transport"
    || envelope.transport !== "native-postgres"
    || !Number.isFinite(envelope.elapsedMs) || envelope.elapsedMs < 0
    || !envelope.receipt || Array.isArray(envelope.receipt)
    || envelope.receipt.status !== "committed"
    || envelope.receipt.releaseId !== args.p_release_id
    || envelope.receipt.manifestSha256 !== args.p_expected_manifest_sha256) {
    throw new Error("Native archive commit receipt does not match the requested release.");
  }
  // The caller retains the complete existing manifest/count/source/receipt gate.
  return envelope;
}

export function createNativeArchiveCommitClient(supabase, {
  env = process.env,
  execute = executeFile,
  logger = () => {},
} = {}) {
  if (!supabase || typeof supabase.rpc !== "function") {
    throw new TypeError("The existing archive RPC client is required.");
  }
  if (!String(env.SUPABASE_DB_URL || "").trim()) {
    throw new Error("SUPABASE_DB_URL is required for --commit-via-database.");
  }
  const nativeEnv = { ...env, SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL || "" };
  return Object.freeze({
    async rpc(name, args) {
      if (name !== "commit_literary_archive_release") return supabase.rpc(name, args);
      try {
        checkedArgs(args);
        // UUID and digest are separate arguments. The database URL stays in env;
        // the safety shell independently pins the project, TLS and Docker image.
        const { stdout } = await execute("bash", [
          safetyScript, "commit-archive", args.p_release_id, args.p_expected_manifest_sha256,
        ], {
          env: nativeEnv,
          encoding: "utf8",
          timeout: 330_000,
          maxBuffer: receiptLimit,
          windowsHide: true,
        });
        const envelope = parseNativeArchiveCommitReceipt(stdout, args);
        logger(`Native archive commit ${args.p_release_id}: ${envelope.elapsedMs} ms.`);
        return { data: envelope.receipt, error: null };
      } catch (error) {
        // Do not attach child-process diagnostics or environment to public logs.
        // A failed/uncertain commit is never retried over REST or partially saved.
        const sqlState = String(error?.stderr || "").match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5})(?:\s|$)/u)?.[1];
        const detail = sqlState ? `native SQLSTATE ${sqlState}`
          : error?.killed ? "bounded native timeout" : "native execution or receipt validation failed";
        return { data: null, error: new Error(`Archive commit ${detail}; inspect the release receipt before retrying.`) };
      }
    },
  });
}
