import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

// External proposal: ROOT must fill and review root-binding.json before execution.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VISUAL = path.dirname(HERE);
const ROOT = await fs.realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
const RUN = path.join(HERE, "checkpoint-a1");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const inside = (base, target) => { const rel = path.relative(base, target); return rel === "" || (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel)); };
const at = filename => path.isAbsolute(filename) ? filename : path.join(ROOT, filename);
const git = args => execFileSync("git", ["-c", "safe.directory=" + ROOT, "-c", "core.autocrlf=true", "-c", "core.quotePath=false", "-c", "core.whitespace=cr-at-eol", ...args], { cwd: ROOT, windowsHide: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 }).trim();
async function checked(filename, hash) {
  const target = at(filename), stat = await fs.lstat(target), resolved = await fs.realpath(target);
  assert.ok((inside(ROOT, resolved) || inside(VISUAL, resolved)) && stat.isFile() && !stat.isSymbolicLink() && stat.size <= 16 * 1024 * 1024, filename);
  const bytes = await fs.readFile(target); if (hash) assert.equal(sha(bytes), hash, filename); return bytes;
}
const read = async filename => JSON.parse(await checked(filename));
const ref = async filename => ({ path: filename, sha256: sha(await checked(filename)) });
const push = (list, value) => { if (!list.includes(value)) list.push(value); };
const bindingPath = path.join(HERE, "root-binding.json");
assert.equal(process.argv.length, 5);
await checked(fileURLToPath(import.meta.url), process.argv[3]);
const binding = JSON.parse(await checked(bindingPath, process.argv[4]));
assert.equal(binding.bindingReady, true);
assert.match(binding.checkpointSourceCommit, /^[a-f0-9]{40}$/u);
const BASE = binding.checkpointSourceCommit;
assert.equal(binding.proposalInputs.length, 5);
for (const row of binding.proposalInputs) await checked(row.path, row.sha256);
const templates = await read(path.join(HERE, "results.template.json"));
const delta = await read(path.join(HERE, "doc-delta.template.json"));
const inputs = await read(path.join(HERE, "evidence-inputs.json"));
assert.equal(templates.D255.sourceCommit, binding.historicalSourceCommits.D255);
assert.equal(templates.D256.sourceCommit, binding.historicalSourceCommits.D256);
const amendment = await read(path.join(HERE, "root-current-amendment.json"));
const added = await read(path.join(HERE, "root-added-evidence-inputs.json"));
const records = { D255: templates.D255, D256: templates.D256, ...amendment.records };
const readyKeys = Object.keys(records).filter(key => records[key].recordReady !== false);
for (const key of readyKeys) assert.equal(records[key].sourceCommit, binding.historicalSourceCommits[key]);
for (const row of inputs.files) row.canonicalCopy = amendment.primaryOldCopyNames.includes(row.decision + "/" + row.name);
inputs.files.push(...added.files);
const pendingKeys = Object.keys(amendment.records).filter(key => amendment.records[key].recordReady === false);
const nextAction = pendingKeys.length ? pendingKeys.map(key => amendment.records[key].pendingAction).join(" ") : amendment.finalNextActionAfterActualRetries;
const notes = readyKeys.map(key => delta[key] ?? records[key].note);
for (const note of notes) assert.ok(typeof note === "string" && note.trim());
const FOLDER = templates.canonicalEvidenceFolder;
assert.equal(FOLDER, "docs/mobile/evidence/S03/account-deletion-and-mobile-globe-20261002");
const GLOBALS = binding.globalOwners.map(row => row.path);
assert.deepEqual(GLOBALS, ["AGENTS.md", "docs/mobile/AUTOPILOT_STATE.json", "docs/mobile/DECISIONS.md", "docs/mobile/STATUS.md", "docs/mobile/BLOCKERS.md", "docs/mobile/NEXT_CODEX_PROMPT.txt"]);
await checked(binding.verifyStateModule.path, binding.verifyStateModule.sha256);
async function fresh(filename, value) {
  const target = at(filename); assert.ok(inside(at(FOLDER), target) || inside(RUN, target));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, typeof value === "string" || Buffer.isBuffer(value) ? value : json(value), { flag: "wx" });
}
function protectedState(state) {
  const copy = structuredClone(state);
  delete copy.headSha; delete copy.updatedAt;
  for (const key of ["nextAction", "contextFiles", "doNotRepeat"]) delete copy.resume[key];
  const stage = copy.stages.find(row => row.id === "S03"); delete stage.artifacts;
  for (const row of stage.criteria.filter(row => ["S03.acceptance", "S03.MOD-030"].includes(row.id))) { delete row.evidence; delete row.notes; }
  return copy;
}
const find = (decision, name) => { const row = inputs.files.find(row => row.decision === decision && row.name === name); assert.ok(row, name); return row; };
const inputJson = async (decision, name) => { const row = find(decision, name); return JSON.parse(await checked(row.path, row.sha256)); };
async function authenticateHistoricalFacts() {
  const checks = await inputJson("D255", "source-a1/checks.json"), commit255 = await inputJson("D255", "source-a1/source-commit.json");
  assert.equal(checks.pass, true); assert.equal(checks.summary.total, 6); assert.equal(checks.summary.passed, 6); assert.equal(checks.summary.failed, 0); assert.equal(checks.testInvocations, 1);
  assert.equal(commit255.checkpoint, templates.D255.sourceCommit); assert.equal(commit255.clean, true);
  const commit256 = await inputJson("D256", "source-commit.json"), committed = await inputJson("D256", "runtime/current-source-manifest.json");
  assert.equal(commit256.sourceCommit, templates.D256.sourceCommit); assert.equal(committed.sourceCommit, templates.D256.sourceCommit); assert.equal(commit256.nativeBrowserFileRowsPreserved, true);
  for (const attempt of templates.D256.nativeAttempts) {
    const receipt = await inputJson("D256", attempt.id + "/receipt.json"), report = await inputJson("D256", attempt.id + "/results.json");
    assert.equal(receipt.exitCode, attempt.exitCode); assert.equal(report.stats.expected, attempt.expected); assert.equal(report.stats.unexpected, attempt.unexpected);
    assert.equal(receipt.sourceManifestSha256, attempt.sourceManifestSha256); assert.equal(receipt.sourceUnchanged, true);
    if (attempt.classification === "NO_TESTS") assert.ok(report.errors.some(row => row.message.includes("No tests found")));
    if (attempt.classification === "PASSED") for (const key of ["unexpected", "skipped", "flaky"]) assert.equal(report.stats[key], 0);
  }
  const finalNative = await inputJson("D256", "d256-compact-a4/source-before.json");
  assert.deepEqual(finalNative.files, committed.files); // Retain original working-tree sourceCommit; qualify equal file rows separately.
  const pwa = await inputJson("D256", "runtime/actual-a1/result.json");
  assert.equal(pwa.pass, true); assert.equal(pwa.failure, null); assert.equal(pwa.sourceCommit, templates.D256.sourceCommit); assert.equal(pwa.buildId, templates.D256.artifactId);
  assert.equal(pwa.buildInvocations, 1); assert.equal(pwa.browserInvocations, 1); assert.equal(pwa.smokeInvocations, 0); assert.equal(pwa.packagingInvocations, 0);
  assert.equal(pwa.browser.stats.expected, 1); for (const key of ["unexpected", "skipped", "flaky"]) assert.equal(pwa.browser.stats[key], 0);
  assert.equal(pwa.liveQaAuthority.signerClosed, true); assert.equal(pwa.liveQaAuthority.privateKeyPersisted, false);
  assert.equal(pwa.browser.capturesReviewed, false); assert.equal(pwa.scope.browserProfileReopened, false); assert.equal(pwa.scope.stageAccepted, false);
  const audit = await inputJson("D256", "runtime/actual-a1/strict-audit.json"); assert.equal(audit.pass, true); assert.equal(audit.identity.buildId, templates.D256.artifactId);
  return { pwa, committed };
}
async function record() {
  assert.equal(git(["rev-parse", "HEAD"]), BASE); assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
  for (const source of Object.values(binding.historicalSourceCommits)) git(["merge-base", "--is-ancestor", source, BASE]);
  await assert.rejects(fs.lstat(at(FOLDER)), { code: "ENOENT" }); await assert.rejects(fs.lstat(RUN), { code: "ENOENT" });
  const originals = new Map(); for (const row of binding.globalOwners) originals.set(row.path, await checked(row.path, row.sha256));
  const state = JSON.parse(originals.get(GLOBALS[1])); assert.equal(state.currentStageId, "S03"); assert.equal(state.currentCriterionId, "S03.acceptance");
  const stage = state.stages.find(row => row.id === "S03"); assert.equal(stage.status, "IN_PROGRESS");
  assert.equal(stage.criteria.length, 12); for (const row of stage.criteria) assert.equal(row.status, row.id === "S03.acceptance" ? "IN_PROGRESS" : "OPEN");
  const before = protectedState(state); await authenticateHistoricalFacts();
  for (const key of readyKeys.filter(key => key !== "D255" && key !== "D256")) {
    const record = records[key]; assert.equal(record.pass, true);
    assert.equal(record.stageAccepted, false); assert.equal(record.releaseReady, false);
    assert.ok(record.proof && Object.keys(record.proof.equals).length);
    for (const witness of [record.proof, ...(record.extraProofs ?? [])]) {
      const proof = await inputJson(witness.decision, witness.name);
      for (const [field, expected] of Object.entries(witness.equals)) assert.deepEqual(field.split(".").reduce((value, name) => value?.[name], proof), expected, key + "/" + field);
    }
  }
  const evidence = [], copies = new Map(), files = [];
  for (const row of inputs.files) {
    const bytes = await checked(row.path, row.sha256), entry = { ...row };
    if (row.canonicalCopy) {
      const target = copies.get(row.sha256) ?? FOLDER + "/actual/" + row.sha256 + path.extname(row.name);
      if (!copies.has(row.sha256)) { await fresh(target, bytes); copies.set(row.sha256, target); files.push(target); }
      entry.canonicalCopy = { path: target, sha256: row.sha256 };
    } else entry.canonicalCopy = null;
    evidence.push(entry);
  }
  const recordedAt = new Date().toISOString(), summaries = [];
  for (const key of readyKeys) {
    const filename = FOLDER + "/" + key.toLowerCase() + ".json";
    await fresh(filename, { schemaVersion: 1, ...records[key], recordedAt, evidence: evidence.filter(row => row.decision === key) });
    summaries.push({key, filename}); files.push(filename);
    for (const id of records[key].criterionIds) {
      assert.ok(["S03.acceptance", "S03.MOD-030"].includes(id));
      const criterion = stage.criteria.find(row => row.id === id); assert.ok(criterion);
      push(criterion.evidence, filename); criterion.notes += " " + (delta[key] ?? records[key].note);
    }
  }
  for (const filename of files) push(stage.artifacts, filename);
  state.headSha = BASE; state.updatedAt = recordedAt; state.resume.nextAction = nextAction;
  for (const {filename} of summaries) push(state.resume.contextFiles, filename);
  push(state.resume.doNotRepeat, delta.doNotRepeat + " " + amendment.doNotRepeatAddition);
  assert.deepEqual(protectedState(state), before);
  const marker = "<!-- " + delta.marker + ":begin -->";
  const note = marker + "\n" + notes.join("\n") + "\nEvidence: " + summaries.map(row => row.filename).join(", ") + "\nNext: " + nextAction + "\n<!-- " + delta.marker + ":end -->\n\n";
  const updates = new Map([[GLOBALS[1], json(state)]]);
  for (const filename of GLOBALS.filter(filename => !updates.has(filename))) {
    const old = originals.get(filename).toString("utf8"); assert.equal(old.includes(marker), false);
    if (filename === "AGENTS.md") { const index = old.indexOf("<!-- s15-"); assert.ok(index > 0); updates.set(filename, old.slice(0, index) + note + old.slice(index)); }
    else if (filename.endsWith("/DECISIONS.md")) updates.set(filename, old + "\n- " + notes.join("\n- ") + " Evidence: " + summaries.map(row => row.filename).join(", ") + ".\n");
    else updates.set(filename, note + old);
  }
  for (const [filename, bytes] of originals) await fresh(path.join(RUN, "originals", filename), bytes);
  const helperCopy = FOLDER + "/actual/checkpoint.mjs", readme = FOLDER + "/README.md";
  await fresh(helperCopy, await checked(fileURLToPath(import.meta.url))); await fresh(readme, note);
  files.push(helperCopy, readme);
  const checkpointInputs = FOLDER + "/checkpoint-inputs.json";
  await fresh(checkpointInputs, { binding, records, delta: {...delta, nextAction}, amendment, addedEvidenceInputs: added, evidenceInputs: inputs, helper: await ref(fileURLToPath(import.meta.url)), verificationExecutedAtRecordTime: false }); files.push(checkpointInputs);
  for (const [filename, bytes] of updates) await fs.writeFile(at(filename), bytes);
  const allFiles = [...GLOBALS, ...files].sort();
  await fresh(path.join(RUN, "plan.json"), { base: BASE, protectedBefore: before, files: await Promise.all(allFiles.map(ref)), copiedUniquePrimaryFiles: copies.size });
  console.log(json({ mode: "record", summaries, files: allFiles.length, copiedUniquePrimaryFiles: copies.size, historicalSourcesPreserved: true, focusedFlagsUiPass: true, historicalAggregatePwaPass: false, pendingKeys, allStatusesUnchanged: true }));
}
async function verify() {
  assert.equal(git(["rev-parse", "HEAD"]), BASE); assert.equal(git(["diff", "--cached", "--name-only"]), "");
  const plan = await read(path.join(RUN, "plan.json")); assert.equal(plan.base, BASE);
  for (const row of plan.files) await checked(row.path, row.sha256);
  assert.deepEqual(protectedState(await read(GLOBALS[1])), plan.protectedBefore);
  assert.deepEqual(git(["diff", "--name-only"]).split(/\r?\n/u).filter(Boolean).sort(), GLOBALS.slice().sort());
  assert.deepEqual(git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/u).filter(Boolean).sort(), plan.files.map(row => row.path).filter(filename => !GLOBALS.includes(filename)).sort());
  const verification = FOLDER + "/verification.json"; await assert.rejects(fs.lstat(at(verification)), { code: "ENOENT" });
  Object.assign(process.env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: ROOT, GIT_CONFIG_KEY_1: "core.autocrlf", GIT_CONFIG_VALUE_1: "true" });
  const { verifyExecutionFiles } = await import(pathToFileURL(path.join(ROOT, binding.verifyStateModule.path)));
  const report = await verifyExecutionFiles(ROOT); await fresh(verification, report);
  assert.equal(report.pass, true); assert.deepEqual(report.errors, []); assert.equal(report.releaseReady, false);
  for (const row of plan.files) await checked(row.path, row.sha256); git(["diff", "--check"]);
  await fresh(path.join(RUN, "verified-plan.json"), { base: BASE, files: [...plan.files.map(row => row.path), verification].sort(), verification: await ref(verification), allStatusesUnchanged: true, stageAccepted: false, releaseReady: false });
  console.log(json({ mode: "verify", pass: true, verification, commitNotExecuted: true }));
}
if (process.argv[2] === "record") await record(); else if (process.argv[2] === "verify") await verify(); else throw new Error("Expected record or verify");
