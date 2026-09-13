import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveBookCoverBatchProductionEnvironment } from "./verify-book-cover-batch-20260820.mjs";
import {
  BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES,
  evidenceV2ValidatorImplementationSha256,
  evidenceV2AttestationCandidatesFromArchive,
} from "../lib/book-evidence-v2-attestations.mjs";
import { evidenceV2ProfileFromLiveContent } from "../lib/book-evidence-v2-registry-rotation.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const WELLS_REPAIR = Object.freeze({
  contract: "wells-editorial-repair-20260913",
  workId: "d48b285b-8278-4551-91d7-30b3703df154",
  legacyId: "england:h_g_wells:when-the-sleeper-wakes",
  packetSha256: "fefe16526d951f0f1e0d1a35030cad80d1a1ab4b04ee76415dc2a2687b3123ec",
  beforeSha256: "d91a7f950bd540ffaf36f9566f343b4f5c20e83f24610c741e5430bda569872a",
  afterSha256: "2a4ed4469ce7d6dc2af7f29ff04a0b94a612fc26eba0849887ed0eb5dc8febf4",
  registrySha256: "d0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef",
  validatorSha256: "f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026",
});
const sha256 = value => createHash("sha256").update(value).digest("hex");

/** Local verification is the default. No network or credentials are needed. */
export async function verifyWellsRepairPacket({ root = ROOT, packetBytes } = {}) {
  const bytes = packetBytes ?? await readFile(path.join(root, "reports/wells-editorial-repair-20260913.json"));
  assert.equal(sha256(bytes), WELLS_REPAIR.packetSha256, "The exact reviewed Wells packet changed.");
  const packet = JSON.parse(bytes.toString("utf8"));
  assert.equal(packet.contract, WELLS_REPAIR.contract);
  assert.equal(packet.workId, WELLS_REPAIR.workId);
  assert.equal(packet.legacyId, WELLS_REPAIR.legacyId);
  assert.equal(packet.beforeContentSha256, WELLS_REPAIR.beforeSha256);
  assert.equal(packet.afterContentSha256, WELLS_REPAIR.afterSha256);
  const [contentText, registryBytes, validatorSources] = await Promise.all([
    readFile(path.join(root, "scripts/database/fixtures/wells-editorial-repair-content-20260913.jsonb.txt"), "utf8"),
    readFile(path.join(root, "scripts/database/fixtures/book-canon-source-registry-before-r49n.json")),
    Promise.all(BOOK_EVIDENCE_V2_VALIDATOR_SOURCE_FILES.map(async name => [name, await readFile(path.join(root, name))])),
  ]);
  assert.equal(sha256(contentText), WELLS_REPAIR.afterSha256);
  assert.deepEqual(JSON.parse(contentText), packet.afterContent);
  assert.equal(sha256(registryBytes), WELLS_REPAIR.registrySha256);
  assert.equal(evidenceV2ValidatorImplementationSha256(new Map(validatorSources)), WELLS_REPAIR.validatorSha256);
  const { build } = await import("esbuild");
  const compiled = await build({
    absWorkingDir: root, entryPoints: ["src/data/bookEvidence.ts"], bundle: true,
    platform: "node", format: "esm", write: false, logLevel: "silent",
  });
  const { bookEvidenceV2Issues } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);
  const profile = evidenceV2ProfileFromLiveContent({
    workId: packet.workId, legacyId: packet.legacyId, isCmsLocked: true,
    updatedAt: packet.expectedUpdatedAt, content: packet.afterContent,
    contentText, contentSha256: packet.afterContentSha256,
  });
  const result = evidenceV2AttestationCandidatesFromArchive([profile], {
    canonRegistry: JSON.parse(registryBytes.toString("utf8")),
    canonRegistrySha256: WELLS_REPAIR.registrySha256,
    validatorSha256: WELLS_REPAIR.validatorSha256, issuesForWork: bookEvidenceV2Issues,
  });
  assert.deepEqual(result.rejected, [], "The real validator rejected the reviewed Wells revision.");
  assert.equal(result.candidates.length, 1);
  assert.deepEqual(result.candidates[0].evidence, packet.evidence);
  assert.equal(packet.afterContent.work.description, packet.beforeContent.work.description);
  assert.deepEqual(packet.afterContent.work.metadata.wellsEditorialRepair20260913.previousTranslations, packet.beforeContent.translations);
  for (const key of ["authors", "externalIds", "editions", "artworks"]) {
    assert.deepEqual(packet.afterContent[key], packet.beforeContent[key]);
  }
  return packet;
}

export function verifyWellsRepairInvocation(environment, checkoutSha) {
  const expected = environment.EXPECTED_MAIN_SHA;
  assert.ok(typeof expected === "string" && /^[0-9a-f]{40}$/u.test(expected), "An exact main SHA is required.");
  assert.equal(environment.GITHUB_ACTIONS, "true", "Apply requires the protected reconciliation workflow.");
  assert.equal(environment.GITHUB_REPOSITORY, "Kosyat128/probpera-literary-map");
  assert.equal(environment.GITHUB_REF, "refs/heads/main");
  assert.equal(environment.GITHUB_WORKFLOW, "Reconcile production database");
  assert.equal(environment.GITHUB_SHA, expected);
  assert.equal(checkoutSha, expected);
  return expected;
}

export async function applyWellsRepair({ packet, environment, checkoutSha, fetchImpl = fetch }) {
  const mainSha = verifyWellsRepairInvocation(environment, checkoutSha);
  const { supabaseUrl, serviceRoleKey } = resolveBookCoverBatchProductionEnvironment(environment);
  // The sole write is the fixed one-work transaction: full before/after guards,
  // archival history and a successful old-registry attestation commit together.
  let response;
  try {
    response = await fetchImpl(`${supabaseUrl}/rest/v1/rpc/repair_wells_editorial_evidence_20260913`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json", Accept: "application/json", apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({ p_packet: packet }),
    });
  } catch { throw new Error("The guarded Wells transaction could not be confirmed; inspect the exact state before retrying."); }
  if (!response.ok) throw new Error(`The guarded Wells transaction was rejected (HTTP ${response.status}).`);
  let result;
  try { result = await response.json(); } catch { throw new Error("Invalid Wells transaction receipt."); }
  assert.equal(result.contract, WELLS_REPAIR.contract);
  assert.equal(result.workId, WELLS_REPAIR.workId);
  assert.equal(result.contentSha256, WELLS_REPAIR.afterSha256);
  assert.equal(result.attested, true);
  assert.ok(["repaired", "already-repaired"].includes(result.status));
  // Emit only locally known public identifiers and verified scalar results.
  return { contract: WELLS_REPAIR.contract, mainSha, workId: WELLS_REPAIR.workId,
    packetSha256: WELLS_REPAIR.packetSha256, contentSha256: WELLS_REPAIR.afterSha256,
    status: result.status, attested: true, originalDescriptionsArchived: true };
}

async function main() {
  const args = process.argv.slice(2);
  assert.ok(args.length === 0 || (args.length === 1 && args[0] === "--apply"), "Usage: node scripts/database/repair-wells-editorial-evidence-20260913.mjs [--apply]");
  const packet = await verifyWellsRepairPacket();
  if (args.length === 0) {
    console.log("Reviewed Wells repair: exact packet, preserved originals and real Evidence V2 validation passed. No database changes.");
    return;
  }
  const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], {cwd: ROOT, encoding: "utf8"}).trim();
  const receipt = await applyWellsRepair({ packet, environment: process.env, checkoutSha });
  const output = path.join(ROOT, "reconciliation");
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "wells-editorial-repair-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  console.log(`Wells editorial repair: ${receipt.status}; exact content attested and originals retained.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => { console.error("Wells repair stopped. No unverified result is accepted; inspect the guarded workflow step."); process.exitCode = 1; });
}
