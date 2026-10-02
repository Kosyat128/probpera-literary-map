import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = await fs.realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
assert.equal(ROOT.toLowerCase(), "d:\\codexprojects\\работа по сайту\\literary-planet-v12-work");
const FOLDER = "docs/mobile/evidence/S16/parent-gate-foundation-20261002";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const git = (args, conversion = "false") => execFileSync("git", ["-c", "safe.directory=" + ROOT,
  "-c", "core.autocrlf=" + conversion, ...args], { cwd: ROOT, windowsHide: true, encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 }).trimEnd();
const read = async (file, local = false) => JSON.parse(await fs.readFile(path.join(local ? HERE : ROOT, file), "utf8"));
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(path.join(ROOT, file))) });
async function fresh(file, data) {
  const target = path.join(ROOT, file);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, typeof data === "string" || Buffer.isBuffer(data) ? data : json(data), { flag: "wx" });
}
async function existing(file, bytes, priorSha) {
  assert.equal((await ref(file)).sha256, priorSha, "Changed checkpoint input: " + file);
  await fs.writeFile(path.join(ROOT, file), bytes);
}
/** Replace selected JSON values while retaining all bytes outside their spans,
 * including mixed newline endings in the established checkpoint. */
function patchJson(raw, changes) {
  const ranges = new Map(); let cursor = 0;
  const space = () => { while (/\s/u.test(raw[cursor] ?? "") && cursor < raw.length) cursor++; };
  function string() {
    const start = cursor++;
    while (cursor < raw.length) {
      if (raw[cursor] === "\\") { cursor += 2; continue; }
      if (raw[cursor++] === '"') return JSON.parse(raw.slice(start, cursor));
    }
    throw new Error("Invalid JSON string");
  }
  function value(address) {
    space(); const start = cursor, token = raw[cursor];
    if (token === "{") {
      cursor++; space();
      if (raw[cursor] !== "}") while (true) {
        space(); const key = string(); space(); assert.equal(raw[cursor++], ":");
        value([...address, key]); space();
        if (raw[cursor] !== ",") break;
        cursor++;
      }
      assert.equal(raw[cursor++], "}");
    } else if (token === "[") {
      cursor++; space(); let index = 0;
      if (raw[cursor] !== "]") while (true) {
        value([...address, index++]); space();
        if (raw[cursor] !== ",") break;
        cursor++;
      }
      assert.equal(raw[cursor++], "]");
    } else if (token === '"') string();
    else { while (cursor < raw.length && !/[\s,\]}]/u.test(raw[cursor])) cursor++; }
    ranges.set(JSON.stringify(address), { start, end: cursor });
  }
  value([]); space(); assert.equal(cursor, raw.length);
  const patches = changes.map(([address, next]) => {
    const range = ranges.get(JSON.stringify(address)); assert.ok(range, JSON.stringify(address));
    const lineStart = raw.lastIndexOf("\n", range.start - 1) + 1;
    const indent = raw.slice(lineStart, range.start).match(/^\s*/u)[0].replace(/[\r\n]/gu, "");
    const eol = raw.slice(Math.max(0, lineStart - 2), lineStart) === "\r\n" ? "\r\n" : "\n";
    const serialized = JSON.stringify(next, null, 2).split("\n").map((line, index) => index ? indent + line : line).join(eol);
    return { ...range, serialized };
  }).sort((a, b) => b.start - a.start);
  for (let i = 1; i < patches.length; i++) assert.ok(patches[i].end <= patches[i - 1].start, "Overlapping JSON patches");
  for (const patch of patches) raw = raw.slice(0, patch.start) + patch.serialized + raw.slice(patch.end);
  JSON.parse(raw); return raw;
}
const note = "S16 local Parent Gate foundation: one-use opaque action/target/profile/policy/revision/generation authority; revoke/cancel/background/dispose and exclusive monotonic deadlines. PIN verification charges increasing backoff with trusted full-record atomic durable CAS before salted slow derivation, then rereads and durably finalizes before proof. All secure-store/time/input ports used in tests are explicit synthetic fixtures; WebCrypto PBKDF2-SHA256 has one independent real600k comparison. No installed secure OS adapter, calibrated native timing, enrollment/recovery, App/routes/lifecycle/UI or child activation is proved.";
const nextAction = "S03.acceptance remains first unresolved with11 OPEN criteria and unchanged installation, unchosen PSP/integration, real payments/refunds, RU/EN editorial/legal, Auth/deletion and authorized remote-check dependencies. Continue documented parallel-safe S16 from the tested profile/access and Parent Gate foundations: implement sealed startup/profile/policy/package/route orchestration and strict separate child indexes/cache/history/offline namespaces before content can render; implement actual native atomic secure-store, protected restart-stable time, PIN input/enrollment/recovery and lifecycle action adapters as Codex programming work. Device availability and platform timing calibration remain necessary for installed Parent Gate acceptance. Never substitute Preferences/browser storage/UI booleans for parent authority, auto-reset missing/corrupt credentials or fabricate child/rights/human approval. Preserve earlier222 units, current focused evidence and D267/D268 without docs-only reruns; no deploy/push/merge/store actions.";
const existingFiles = ["AGENTS.md", "docs/mobile/AUTOPILOT_STATE.json", "docs/mobile/STATUS.md", "docs/mobile/DECISIONS.md",
  "docs/mobile/NEXT_CODEX_PROMPT.txt", "docs/mobile/REQUIREMENTS_TRACEABILITY.json", "docs/mobile/REQUIREMENTS_TRACEABILITY.csv"];
const requirements = ["CHILD-008", "CHILD-009"];
const dirty = () => git(["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u).filter(Boolean).map(line => line.slice(3)).sort();
const equal = async rows => { for (const row of rows) assert.deepEqual(await ref(row.path), row, row.path); };
const mode = process.argv[2];
if (mode === "record-recover") {
  const strictFresh = fresh;
  fresh = async (file, data) => {
    let prior;
    try { prior = await fs.readFile(path.join(ROOT, file)); }
    catch (error) { if (error.code !== "ENOENT") throw error; return strictFresh(file, data); }
    const content = typeof data === "string" || Buffer.isBuffer(data) ? data : json(data);
    assert.deepEqual(prior, Buffer.isBuffer(content) ? content : Buffer.from(content), "Existing recovery artifact changed: " + file);
  };
}
if (mode === "record" || mode === "record-recover") {
  const receipt = await read("actual/source-commit.json", true), plan = await read("actual/integration-a3.json", true),
    checked = await read("actual/focused-final.json", true), units = await read("actual/a2/vitest.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), receipt.sourceCommit);
  if (mode === "record") assert.deepEqual(dirty(), []);
  else assert.ok(dirty().every(file => file.startsWith(FOLDER + "/")));
  assert.equal(checked.pass, true); assert.equal(receipt.unitInvocations, 2); assert.equal(receipt.typeScriptInvocations, 3);
  assert.equal(checked.uniqueCasesValidated, 96); assert.equal(units.success, false); assert.equal(units.numFailedTests, 5);
  await equal([...plan.witnesses, ...plan.proposed]);
  const originals = await Promise.all(existingFiles.map(async file => ({ ...await ref(file), bytes: await fs.readFile(path.join(ROOT, file)) })));
  const input = name => originals.find(row => row.path === name);
  const recordedAt = mode === "record-recover" ? (await read(FOLDER + "/result.json")).recordedAt : new Date().toISOString(),
    sourceFiles = plan.proposed.map(row => ({ ...row,
    gitBlob: git(["rev-parse", receipt.sourceCommit + ":" + row.path]) }));
  const copied = [];
  async function copy(local, suffix) {
    const content = await fs.readFile(path.join(HERE, local)), destination = FOLDER + "/" + suffix;
    await fresh(destination, content); copied.push({ path: destination, sha256: sha(content) });
  }
  for (const file of ["integration.json", "integration-a2.json", "integration-a3.json", "focused-final.json", "source-commit.json", "typescript.stdout.txt",
    "typescript.stderr.txt", "typescript.execution.json", "run-a1.mjs", "run-a2.mjs"]) await copy("actual/" + file, "actual/" + file);
  for (const file of ["typescript.stdout.txt", "typescript.stderr.txt", "typescript.execution.json", "units.stdout.txt",
    "units.stderr.txt", "units.execution.json", "vitest.json"]) {
    await copy("actual/a2/" + file, "actual/a2/" + file); await copy("actual/a3/" + file, "actual/a3/" + file);
  }
  for (const row of plan.initialProposed) await copy("actual/failed-a1/" + row.path, "actual/failed-a1/" + row.path);
  for (const row of plan.priorProposed) await copy("actual/failed-a2/" + row.path, "actual/failed-a2/" + row.path);
  await copy("run.mjs", "actual/run.mjs");
  await copy(mode === "record-recover" ? "actual/checkpoint-record-a1.mjs" : "checkpoint.mjs", "actual/checkpoint.mjs");
  const entry = { schemaVersion: 1, stageId: "S16", recordType: "parallel-safe-parent-gate-foundation",
    sourceCommit: receipt.sourceCommit, priorCheckpoint: receipt.originalTestHead,
    authority: "Continuation of already documented parallel-safe S16 under user's uninterrupted local programming instruction; matrix69 permits it. No new D stage.",
    reason: "Pure action authority and secure-port verification logic are unfinished original S16 programming independent of PSP, approved child materials and installed-device availability. No product runtime is activated.",
    bindingDocuments: ["docs/mobile/requirements/v12/11_CHILD_MODE_PARENT_GATE_AGE_ASSURANCE_RU.md",
      "docs/mobile/requirements/v12/20_SECURITY_PRIVACY_COMPLIANCE_RU.md"],
    previousEntry: "docs/mobile/evidence/S16/child-policy-foundation-20261002/entry.json",
    allowedScope: ["Constructor-owned one-use action authority", "Durable secure CAS verifier engine boundary", "Standard WebCrypto KDF", "Synthetic targeted boundary tests"],
    stageAccepted: false, releaseReady: false };
  await fresh(FOLDER + "/entry.json", entry);
  const unitCounts = units.testResults.map(suite => ({ file: suite.name.replace(ROOT + path.sep, "").replaceAll("\\", "/"),
    firstRunPassedTests: suite.assertionResults.filter(test => test.status === "passed").length,
    correctedFailedCases: suite.assertionResults.filter(test => test.status === "failed").length,
    uniqueCasesValidated: suite.assertionResults.length }));
  await fresh(FOLDER + "/result.json", { schemaVersion: 1, stageId: "S16", kind: "parent-gate-and-durable-pin-boundary",
    sourceCommit: receipt.sourceCommit, originalTestHead: receipt.originalTestHead, recordedAt, pass: true,
    criterionIds: ["S16.acceptance", ...requirements.map(id => "S16." + id)], requirementIds: requirements,
    sourceFiles, checks: { typeScriptInvocations: 3, failedTypeScriptInvocations: 1, passedTypeScriptInvocations: 2,
      unitInvocations: 2, fullUnitInvocations: 1, targetedUnitInvocations: 1, unitFiles: 2,
      uniqueCasesValidated: 96, firstUnitRunPassed: 91, firstUnitRunFailed: 5, correctedFailedCasesPassed: 5,
      unresolvedFailedCases: 0, passing91CasesRepeated: false, realKdfComparisonRepeated: false,
      targetedUnselectedCases: 22, todoUnitTests: 0, unitCounts, standardKdfComparisons: 1, browserRuns: 0, appBuilds: 0, prior222TestsRepeated: false,
      sourceRowsBeforeAfterEqual: true, committedTestedFileRowsEqual: true },
    qualification: note,
    cryptoReferences: [{ url: "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html",
      purpose: "PBKDF2-HMAC-SHA256 iteration floor600000, checked2026-10-02; not device calibration or PIN entropy acceptance." },
      { url: "https://www.w3.org/TR/WebCryptoAPI/", purpose: "Standard non-extractable PBKDF2 importKey/deriveBits and strong random values." }],
    limitations: { runtimeIntegrated: false, secureNativeStore: false, trustedNativeTime: false, nativePinInput: false,
      pinEnrollmentRecovery: false, calibratedTimingPolicy: false, installedDevice: false, childModeEnabled: false,
      actualHumanApproval: false, rightsContentApproval: false, asyncProtectedExecutor: false,
      runtimeCryptoKeyExplicitErasure: false },
    initialTypeScriptFailure: { report: FOLDER + "/actual/typescript.execution.json", exitCode: 2,
      reason: "Two ArrayBuffer generic type errors in one synthetic KDF mock fixed by explicit Uint8Array return annotation. Product behavior unchanged; no units ran before repair.",
      originalSourceRows: plan.initialProposed, unitInvocationsBeforeRepair: 0 },
    initialUnitFailure: { report: FOLDER + "/actual/a2/vitest.json", pass: false, passedTests: 91, failedTests: 5,
      reason: "The clock test erroneously created a fresh verifier for its permanent-seal assertion. Reuse the same instance in only that five-parameter case; no product source changed.",
      correctedTargetedReport: FOLDER + "/actual/a3/vitest.json", correctedCasesPassed: 5,
      originalSourceRows: plan.priorProposed, passingCasesAndRealKdfNotRepeated: true },
    artifacts: copied, stageAccepted: false, releaseReady: false, productionActionsPerformed: false });
  const oldState = JSON.parse(input("docs/mobile/AUTOPILOT_STATE.json").bytes), oldS03 = oldState.stages.find(row => row.id === "S03");
  assert.equal(oldState.currentStageId, "S03"); assert.equal(oldState.currentCriterionId, "S03.acceptance");
  assert.equal(oldS03.criteria.find(row => row.id === "S03.acceptance").status, "IN_PROGRESS");
  assert.equal(oldS03.criteria.filter(row => row.status === "OPEN").length, 11);
  await fresh(FOLDER + "/remaining-gates.json", { schemaVersion: 1, stageAccepted: false, releaseReady: false,
    firstUnresolved: "S03.acceptance", s03OpenCriteria: oldS03.criteria.filter(row => row.status === "OPEN").map(row => row.id),
    retainedS03Evidence: "docs/mobile/evidence/S03/booky-size-persistence-20261002/remaining-gates.json",
    userInputsAlreadyKnown: { installedTestDeviceOrVMAvailable: false, pspChosen: false },
    internalCodexWork: ["Sealed startup and separate child data namespaces", "Actual Keychain/Keystore atomic record store and rollback safeguards",
      "Protected restart-stable clock and device-calibrated policy", "Native PIN entry, explicit enrollment and secure recovery",
      "App/route/Back/background/deep-link/notification/callback integration", "Cancellable executor for asynchronous protected actions"],
    externalAcceptanceDependencies: ["Installed device/VM for secure OS storage and lifecycle tests", "Approved RU/EN child editorial, rights and legal data",
      "Explicit parent/reviewer admission of exact materials", "PSP selection, integration and actual payments/refunds",
      "Configured Auth/deletion and separately authorized remote verification"],
    nativeFixtureQualification: "Current secure-store/time/input fixtures are synthetic CAS and clock implementations; they establish no actual OS storage behavior." });
  await fresh(FOLDER + "/README.md", "# S16 Parent Gate foundation\n\n" + note + "\n\n" +
    "Focused checks: final TypeScript PASS;96 unique cases validated by91 first-run PASS plus5 corrected-case PASS. The first full unit report91/96 remains FAIL. Only its5 failing clock parameters repeated after a three-line fixture repair; the69 controller cases, other22 PIN cases and real KDF comparison were not repeated. Initial TypeScript typing FAIL, all original proposal files and helpers are retained. Total3 TypeScript calls (1FAIL/2PASS),2 unit calls (1full/1targeted). No old222 units, browser or app builds repeated.\n\n" +
    "This gate issues action authority only; it cannot approve child content, rights, purchases or entitlements. Protected callbacks are synchronous; async actions still need a cancellation-aware host executor. Tokens and PINs are never persisted by the controller. Engine attempts use trusted atomic durable CAS; mocks do not establish installed native protection. Managed buffers are wiped, while non-extractable CryptoKey lifetime belongs to WebCrypto.\n\n" +
    "Next: " + nextAction + "\n");
  const stateName = "docs/mobile/AUTOPILOT_STATE.json", index = oldState.stages.findIndex(row => row.id === "S16"),
    s16 = structuredClone(oldState.stages[index]);
  assert.equal(s16.status, "IN_PROGRESS"); assert.ok(s16.criteria.every(row => row.status === "OPEN"));
  s16.artifacts = [...new Set([...s16.artifacts, FOLDER + "/entry.json", FOLDER + "/result.json", FOLDER + "/remaining-gates.json"])];
  for (const criterion of s16.criteria.filter(row => ["S16.acceptance", ...requirements.map(id => "S16." + id)].includes(row.id))) {
    criterion.evidence.push(FOLDER + "/result.json"); criterion.notes += " " + note;
  }
  const parallel = structuredClone(oldState.verificationCache.parallelSafeStages);
  parallel.S16.evidence.push(FOLDER + "/entry.json", FOLDER + "/result.json");
  const updatedState = patchJson(input(stateName).bytes.toString("utf8"), [[["headSha"], receipt.sourceCommit], [["updatedAt"], recordedAt],
    [["stages", index], s16], [["verificationCache", "parallelSafeStages"], parallel], [["resume", "nextAction"], nextAction],
    [["resume", "contextFiles"], [...new Set([...oldState.resume.contextFiles, FOLDER + "/entry.json", FOLDER + "/result.json", FOLDER + "/remaining-gates.json"])]],
    [["resume", "doNotRepeat"], [...oldState.resume.doNotRepeat, "S16 Parent Gate source" + receipt.sourceCommit.slice(0, 8) +
      ": retain96 unique validated cases (91 first-run PASS +5 corrected PASS) and finalTypeScript PASS; initial typingFAIL and firstunit91/96 FAIL separate. Only5 failing cases repeated, no passing91/KDF repeat. Synthetic secure ports are not OS acceptance. No docs-only old/foundation/browser/build reruns."]]]);
  const afterState = JSON.parse(updatedState), protectedState = structuredClone(afterState);
  protectedState.headSha = oldState.headSha; protectedState.updatedAt = oldState.updatedAt;
  protectedState.stages[index] = oldState.stages[index]; protectedState.verificationCache.parallelSafeStages = oldState.verificationCache.parallelSafeStages;
  for (const key of ["nextAction", "contextFiles", "doNotRepeat"]) protectedState.resume[key] = oldState.resume[key];
  assert.deepEqual(protectedState, oldState); assert.deepEqual(afterState.stages.find(row => row.id === "S03"), oldS03);
  await existing(stateName, updatedState, input(stateName).sha256);
  const traceName = "docs/mobile/REQUIREMENTS_TRACEABILITY.json", oldTrace = JSON.parse(input(traceName).bytes), changes = [];
  for (const id of requirements) {
    const position = oldTrace.requirements.findIndex(row => row.id === id), item = structuredClone(oldTrace.requirements[position]);
    assert.equal(item.status, "OPEN"); item.implementationFiles = plan.proposed.filter(row => !row.path.endsWith(".test.ts")).map(row => row.path);
    item.tests = plan.proposed.filter(row => row.path.endsWith(".test.ts")).map(row => row.path);
    item.evidence.push(FOLDER + "/result.json"); item.notes += " " + note;
    changes.push([["requirements", position], item]);
  }
  const updatedTrace = patchJson(input(traceName).bytes.toString("utf8"), changes), protectedTrace = JSON.parse(updatedTrace);
  for (const id of requirements) { const position = oldTrace.requirements.findIndex(row => row.id === id); protectedTrace.requirements[position] = oldTrace.requirements[position]; }
  assert.deepEqual(protectedTrace, oldTrace); await existing(traceName, updatedTrace, input(traceName).sha256);
  const { parseCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/csv.mjs")));
  const { projectTraceabilityCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/verify-state.mjs")));
  const sources = parseCsv(await fs.readFile(path.join(ROOT, "docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv"), "utf8"));
  const projection = projectTraceabilityCsv(JSON.parse(updatedTrace), sources), rows = projection.trimEnd().split("\n");
  const lines = input("docs/mobile/REQUIREMENTS_TRACEABILITY.csv").bytes.toString("utf8").match(/[^\r\n]*(?:\r\n|\n|$)/gu).filter(Boolean);
  const csv = lines.map((line, position) => requirements.includes(line.split(",", 1)[0])
    ? rows[position] + (line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "") : line).join("");
  assert.equal(csv.replaceAll("\r\n", "\n"), projection);
  await existing("docs/mobile/REQUIREMENTS_TRACEABILITY.csv", csv, input("docs/mobile/REQUIREMENTS_TRACEABILITY.csv").sha256);
  const block = "\n<!-- s16-parent-gate-foundation-20261002:begin -->\n" + note + "\nEvidence: " + FOLDER +
    "/result.json\nNext: " + nextAction + "\n<!-- s16-parent-gate-foundation-20261002:end -->\n\n";
  for (const file of ["AGENTS.md", "docs/mobile/STATUS.md", "docs/mobile/NEXT_CODEX_PROMPT.txt"]) {
    const before = input(file).bytes, insert = file === "AGENTS.md" ? before.indexOf(Buffer.from("<!-- s16-child-policy-foundation-20261002:begin -->")) : 0;
    assert.ok(insert >= 0); await existing(file, Buffer.concat([before.subarray(0, insert), Buffer.from(block), before.subarray(insert)]), input(file).sha256);
  }
  const decision = input("docs/mobile/DECISIONS.md");
  await existing(decision.path, Buffer.concat([decision.bytes, Buffer.from("\n- 2026-10-02 / S16 Parent Gate continuation: " + note +
    " Source" + receipt.sourceCommit + ";96 unique validated cases via91 first-run PASS and5 corrected-case PASS; initialTypeScriptFAIL and firstunit91/96 FAIL retained separately. Evidence: " + FOLDER + "/result.json.\n")]), decision.sha256);
  if (mode === "record-recover") {
    await copy("checkpoint.mjs", "actual/checkpoint-recovered.mjs");
    await fresh(FOLDER + "/record-recovery.json", { schemaVersion: 1, sourceCommit: receipt.sourceCommit,
      originalGuardFailure: "Reporting helper counted the S03.acceptance IN_PROGRESS milestone with its11 OPEN requirements, resulting in12 versus an incorrectly asserted11 total criteria.",
      correctedGuard: "Require S03.acceptance IN_PROGRESS plus exactly11 OPEN requirement criteria and preserve the entire S03 object unchanged.",
      checkpointInputsWereUnchangedAtRecovery: true, partialEvidenceArtifactsComparedAndRetainedWithoutRewrite: true,
      originalHelperRetained: FOLDER + "/actual/checkpoint.mjs", productChecksRepeated: false,
      stageAccepted: false, releaseReady: false });
  }
  const changed = dirty(); assert.ok(changed.every(file => existingFiles.includes(file) || file.startsWith(FOLDER + "/")));
  const protectedRows = plan.witnesses.filter(row => !existingFiles.includes(row.path));
  await equal([...protectedRows, ...plan.proposed]);
  await fs.writeFile(path.join(HERE, "actual/checkpoint-plan.json"), json({ sourceCommit: receipt.sourceCommit,
    files: await Promise.all(changed.map(ref)), protectedRows, testedRows: plan.proposed }), { flag: "wx" });
  console.log(json({ recorded: true, changedFiles: changed.length, sourceCommit: receipt.sourceCommit,
    s03Unchanged: true, protectedStateEqual: true, allCriterionAndRequirementStatusesPreserved: true }));
} else if (mode === "verify") {
  const plan = await read("actual/checkpoint-plan.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), plan.sourceCommit); await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]);
  Object.assign(process.env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: ROOT,
    GIT_CONFIG_KEY_1: "core.autocrlf", GIT_CONFIG_VALUE_1: "true" });
  const { verifyExecutionFiles } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/verify-state.mjs")));
  const report = await verifyExecutionFiles(ROOT); await fresh(FOLDER + "/verification-final.json", report);
  assert.equal(report.pass, true); assert.deepEqual(report.errors, []); assert.equal(report.releaseReady, false);
  await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]);
  git(["-c", "core.whitespace=cr-at-eol", "diff", "--check"]);
  plan.files.push(await ref(FOLDER + "/verification-final.json"));
  await fs.writeFile(path.join(HERE, "actual/verified-plan.json"), json(plan), { flag: "wx" });
  console.log(json({ pass: true, errors: [], releaseReady: false, historicalConversion: "per-process true", unchangedHistoricalInputs: true }));
} else if (mode === "commit") {
  const plan = await read("actual/verified-plan.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), plan.sourceCommit); await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]);
  assert.deepEqual(dirty(), plan.files.map(row => row.path).sort());
  git(["add", "--", ...plan.files.map(row => row.path)]);
  assert.deepEqual(git(["diff", "--cached", "--name-only"]).split(/\r?\n/u).sort(), plan.files.map(row => row.path).sort());
  git(["commit", "-m", "docs: checkpoint Parent Gate verification foundation"]);
  const head = git(["rev-parse", "HEAD"]); await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]); assert.deepEqual(dirty(), []);
  await fs.writeFile(path.join(HERE, "actual/final-checkpoint.json"), json({ head, sourceCommit: plan.sourceCommit, clean: true, releaseReady: false }), { flag: "wx" });
  console.log(json({ head, sourceCommit: plan.sourceCommit, clean: true, releaseReady: false }));
} else throw new Error("Unknown mode");
