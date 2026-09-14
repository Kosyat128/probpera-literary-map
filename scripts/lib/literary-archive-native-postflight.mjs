import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, promisify } from "node:util";
import {
  BOOK_EVIDENCE_V2_CONTRACT, BOOK_EVIDENCE_V2_SCHEMA_VERSION,
  BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES, BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
  canonicalUtf8ContentSha256, evidenceV2ValidatorImplementationSha256,
} from "./book-evidence-v2-attestations.mjs";
import {
  validateLiteraryArchiveChildEditPreservationReceipt,
  validateLiteraryArchiveReleasePrecondition,
} from "./literary-archive-atomic-release.mjs";

const executeFile = promisify(execFile);
const root = new URL("../../", import.meta.url);
const safetyScript = fileURLToPath(new URL("../database/supabase-database-safety.sh", import.meta.url));
const sqlTemplate = readFileSync(new URL("../database/literary-archive-native-postflight.sql", import.meta.url), "utf8");
const SHA = /^[0-9a-f]{64}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const limit = 128 * 1024;
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
  && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
const digest = value => typeof value === "string" && SHA.test(value);

export function validateNativeArchiveWorkflowReceipt(receipt) {
  if (!exactKeys(receipt, ["childEditPreservation", "committedManifestSha256", "expectedItems",
    "expectedPredecessorPublic", "expectedPredecessorPublicManifestSha256", "logicalTargetManifestSha256",
    "releaseId", "schemaVersion"])
    || receipt.schemaVersion !== "literary-archive-workflow-receipt-v2"
    || typeof receipt.releaseId !== "string" || !UUID.test(receipt.releaseId)
    || !digest(receipt.committedManifestSha256) || !digest(receipt.logicalTargetManifestSha256)
    || !digest(receipt.expectedPredecessorPublicManifestSha256)
    || !Number.isSafeInteger(receipt.expectedItems) || receipt.expectedItems < 1
    || !Number.isSafeInteger(receipt.expectedPredecessorPublic) || receipt.expectedPredecessorPublic < 0
    || !isDeepStrictEqual(validateLiteraryArchiveChildEditPreservationReceipt(receipt.childEditPreservation),
      receipt.childEditPreservation)) throw new Error("Native archive workflow receipt is invalid.");
  return receipt;
}

export function readNativeArchiveEvidenceIdentity() {
  const registrySource = readFileSync(new URL("data/book-canon-source-registry.json", root), "utf8");
  return {
    contractVersion: BOOK_EVIDENCE_V2_CONTRACT,
    validatorVersion: BOOK_EVIDENCE_V2_VALIDATOR_VERSION,
    validatorSha256: evidenceV2ValidatorImplementationSha256(new Map(
      BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES.map(file => [file, readFileSync(new URL(file, root), "utf8")])
    )),
    canonRegistryVersion: JSON.parse(registrySource).registryVersion,
    canonRegistrySha256: canonicalUtf8ContentSha256(registrySource),
  };
}

function checkedRequest(operation, args, identity) {
  if (operation === "precondition" && exactKeys(args, [])) return { operation, args, identity: null };
  if (operation !== "postflight") throw new Error("Native archive read operation is not allowed.");
  validateNativeArchiveWorkflowReceipt(args);
  if (!exactKeys(identity, ["contractVersion", "validatorVersion", "validatorSha256",
    "canonRegistryVersion", "canonRegistrySha256"])
    || identity.contractVersion !== BOOK_EVIDENCE_V2_CONTRACT
    || identity.validatorVersion !== BOOK_EVIDENCE_V2_VALIDATOR_VERSION
    || typeof identity.canonRegistryVersion !== "string"
    || !/^[a-z0-9][a-z0-9._:-]{1,120}$/u.test(identity.canonRegistryVersion)
    || !digest(identity.validatorSha256) || !digest(identity.canonRegistrySha256)) {
    throw new Error("Native archive evidence identity is invalid.");
  }
  return { operation, args, identity };
}

export function buildNativeArchiveReadSql(operation, args, identity) {
  const request = checkedRequest(operation, args, identity);
  const marker = "__NATIVE_ARCHIVE_READ_REQUEST__";
  if (sqlTemplate.split(marker).length !== 2) throw new Error("Fixed native archive read SQL is invalid.");
  return sqlTemplate.replace(marker, `'${JSON.stringify(request).replaceAll("'", "''")}'`);
}

export function parseNativeArchiveReadOutput(stdout, operation, args, identity) {
  checkedRequest(operation, args, identity);
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > limit) {
    throw new Error("Native archive read returned an invalid envelope.");
  }
  let envelope;
  try { envelope = JSON.parse(stdout.trim()); }
  catch { throw new Error("Native archive read returned an invalid envelope."); }
  if (!exactKeys(envelope, ["transport", "operation", "context", "elapsedMs", "result", "health"])
    || envelope.transport !== "native-postgres-read-only" || envelope.operation !== operation
    || !Number.isFinite(envelope.elapsedMs) || envelope.elapsedMs < 0
    || !isDeepStrictEqual(envelope.context, { readOnly: true, isolation: "repeatable read",
      role: "service_role", authRole: "service_role", uid: null,
      statementTimeoutMs: 300000, lockTimeoutMs: 15000 })) {
    throw new Error("Native archive read context or envelope is invalid.");
  }
  if (operation === "precondition") {
    if (envelope.health !== null) throw new Error("Unexpected precondition health payload.");
    validateLiteraryArchiveReleasePrecondition(envelope.result);
    return envelope;
  }
  const result = envelope.result, health = envelope.health;
  if (!exactKeys(result, ["childEditPreservation", "committedManifestSha256", "liveTargetManifestSha256",
    "predecessorPublic", "predecessorPublicManifestSha256", "releaseId", "unlockedWorks"])
    || result.releaseId !== args.releaseId
    || result.committedManifestSha256 !== args.committedManifestSha256
    || !isDeepStrictEqual(result.childEditPreservation, args.childEditPreservation)
    || result.unlockedWorks !== args.expectedItems
    || !digest(result.liveTargetManifestSha256)
    || result.predecessorPublic !== args.expectedPredecessorPublic
    || result.predecessorPublicManifestSha256 !== args.expectedPredecessorPublicManifestSha256) {
    throw new Error("Native archive postflight differs from the committed workflow receipt.");
  }
  if (!exactKeys(health, ["attestationsRlsForced", "canonRegistryVersion", "contractVersion",
    "controlsRlsForced", "enforcementEnabled", "invalidAttestationCount", "invalidationTriggerCount",
    "manifestSha256", "ok", "policyCount", "predecessorPublicCount", "rpcOnlyEvidenceWrites",
    "schemaVersion", "validatorVersion"])
    || health.ok !== true || health.schemaVersion !== BOOK_EVIDENCE_V2_SCHEMA_VERSION
    || health.contractVersion !== identity.contractVersion || health.validatorVersion !== identity.validatorVersion
    || health.canonRegistryVersion !== identity.canonRegistryVersion || health.enforcementEnabled !== true
    || health.rpcOnlyEvidenceWrites !== true || health.controlsRlsForced !== true
    || health.attestationsRlsForced !== true || health.policyCount !== 7 || health.invalidationTriggerCount !== 7
    || health.invalidAttestationCount !== 0 || health.predecessorPublicCount !== args.expectedPredecessorPublic
    || !digest(health.manifestSha256)) throw new Error("Native archive current Evidence V2 health is invalid.");
  return envelope;
}

export async function executeNativeArchiveRead(operation, args, {
  identity = operation === "postflight" ? readNativeArchiveEvidenceIdentity() : undefined,
  env = process.env, execute = executeFile, temporaryRoot = tmpdir(),
} = {}) {
  const sql = buildNativeArchiveReadSql(operation, args, identity);
  if (typeof env.SUPABASE_DB_URL !== "string" || !env.SUPABASE_DB_URL.trim()) {
    throw new Error("SUPABASE_DB_URL is required for native archive verification.");
  }
  const directory = await mkdtemp(path.join(path.resolve(temporaryRoot), "probpera-archive-read-"));
  try {
    const input = path.join(directory, "read.sql"), output = path.join(directory, "receipt.txt");
    await writeFile(input, "\\set QUIET 1\n\\set VERBOSITY sqlstate\n\\pset format unaligned\n\\pset tuples_only on\n" + sql, { mode: 0o600 });
    await execute(process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash", [
      safetyScript, "verify-production", input, output,
    ], { env: { ...env, SUPABASE_URL: env.SUPABASE_URL || env.VITE_SUPABASE_URL || "" },
      encoding: "utf8", timeout: 330_000, maxBuffer: limit, windowsHide: true });
    return parseNativeArchiveReadOutput(await readFile(output, "utf8"), operation, args, identity);
  } catch (error) {
    // Native process diagnostics may contain connection details or row values.
    const sqlState = typeof error?.stderr === "string"
      ? error.stderr.match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5})(?:\s|$)/u)?.[1] : undefined;
    const failure = new Error(`Native archive read ${sqlState ? `SQLSTATE ${sqlState}` : "execution or receipt validation failed"}; no write or REST fallback was attempted.`);
    if (sqlState) failure.sqlState = sqlState;
    throw failure;
  } finally {
    if (path.dirname(directory) !== path.resolve(temporaryRoot)
      || !path.basename(directory).startsWith("probpera-archive-read-")) throw new Error("Unexpected temporary directory.");
    await rm(directory, { recursive: true, force: true });
  }
}

export function createNativeArchiveReadClient(supabase, options = {}) {
  if (!supabase || typeof supabase.rpc !== "function") throw new TypeError("Archive RPC client is required.");
  return Object.freeze({
    async rpc(name, args) {
      if (name !== "get_literary_archive_release_precondition") return supabase.rpc(name, args);
      try {
        const envelope = await executeNativeArchiveRead("precondition", args, options);
        return { data: envelope.result, error: null };
      } catch (error) { return { data: null, error }; }
    },
  });
}
