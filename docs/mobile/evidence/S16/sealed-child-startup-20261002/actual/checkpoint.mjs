import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = await fs.realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
assert.equal(ROOT.toLowerCase(), "d:\\codexprojects\\работа по сайту\\literary-planet-v12-work");
const FOLDER = "docs/mobile/evidence/S16/sealed-child-startup-20261002";
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
const note = "S16 local sealed startup/namespace foundation: child-only restore runs secure selection, authenticated profile, current policy, trusted reviewed package, child route and final secure selection recheck; before that only sealed/restoring observations exist, never adult-ready. Scope binds exact profile/revision/age, RU/EN, policy and package digests/versions. Background is latched until explicit foreground and a fresh restore; generations, timeout, trusted clock and exclusive validity fence delayed work and synchronous view revalidation. Eight pure namespaces are distinct and case-safe. All admission ports remain synthetic in tests; no actual OS adapters, reviewed content, runtime/UI/index query or frame guarantee is delivered.";
const nextAction = "S03.acceptance remains first unresolved with11 OPEN requirements; installed test device/VM is absent, PSP is unchosen and real payment/refund, RU/EN editorial/legal, Auth/deletion and authorized remote gates remain unchanged. Continue documented parallel-safe S16 from tested profile/access, Parent Gate and sealed startup/namespace foundations: implement a verified child-only package/index adapter with per-entity exact-age/locale/current rights review, separate query/history/cache/offline ports and atomic scope retirement; implement actual protected native mode/profile/PIN storage, restart-stable trusted time, enrollment/recovery and host lifecycle/route wiring as Codex programming. Do not activate child content or claim a frame/device/storage guarantee from mocked ports, namespace metadata, signatures or UI booleans. Preserve previous222 and96 case evidence plus the new focused checks without report-only repeats. No deploy/push/merge/store actions.";
const existingFiles = ["AGENTS.md", "docs/mobile/AUTOPILOT_STATE.json", "docs/mobile/STATUS.md", "docs/mobile/DECISIONS.md",
  "docs/mobile/NEXT_CODEX_PROMPT.txt", "docs/mobile/REQUIREMENTS_TRACEABILITY.json", "docs/mobile/REQUIREMENTS_TRACEABILITY.csv"];
const ids = ["CHILD-005", "CHILD-006", "CHILD-007"];
const dirty = () => git(["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u).filter(Boolean).map(line => line.slice(3)).sort();
const equal = async rows => { for (const row of rows) assert.deepEqual(await ref(row.path), row, row.path); };
const mode = process.argv[2];
if (mode === "record") {
  const receipt = await read("actual/source-commit.json", true), plan = await read("actual/integration.json", true),
    checked = await read("actual/focused-result.json", true), units = await read("actual/vitest.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), receipt.sourceCommit); assert.deepEqual(dirty(), []);
  assert.equal(checked.pass, true); assert.equal(checked.passedTests, 91); assert.equal(units.success, true);
  await equal([...plan.witnesses, ...plan.proposed]);
  const originals = await Promise.all(existingFiles.map(async file => ({ ...await ref(file), bytes: await fs.readFile(path.join(ROOT, file)) })));
  const input = name => originals.find(row => row.path === name), recordedAt = new Date().toISOString();
  const sourceFiles = plan.proposed.map(row => ({ ...row, gitBlob: git(["rev-parse", receipt.sourceCommit + ":" + row.path]) })), artifacts = [];
  for (const file of ["integration.json", "source-commit.json", "typescript.stdout.txt", "typescript.stderr.txt", "typescript.execution.json",
    "units.stdout.txt", "units.stderr.txt", "units.execution.json", "vitest.json", "focused-result.json"]) {
    const bytes = await fs.readFile(path.join(HERE, "actual", file)), destination = FOLDER + "/actual/" + file;
    await fresh(destination, bytes); artifacts.push({ path: destination, sha256: sha(bytes) });
  }
  for (const file of ["run.mjs", "checkpoint.mjs"]) {
    const bytes = await fs.readFile(path.join(HERE, file)), destination = FOLDER + "/actual/" + file;
    await fresh(destination, bytes); artifacts.push({ path: destination, sha256: sha(bytes) });
  }
  await fresh(FOLDER + "/entry.json", { schemaVersion: 1, stageId: "S16", recordType: "parallel-safe-sealed-child-startup",
    sourceCommit: receipt.sourceCommit, priorCheckpoint: receipt.originalTestHead,
    authority: "Continue the previously documented parallel-safe S16 under the user's uninterrupted programming instruction; matrix69 permits independent internal implementation. No additional D stage.",
    reason: "Orchestration and namespace contracts are unfinished original child programming independent of PSP, approved materials and an installed test device. Existing App/globe/Booky/locale/native adapters are byte-identical and child mode is not activated.",
    bindingDocuments: ["docs/mobile/requirements/v12/11_CHILD_MODE_PARENT_GATE_AGE_ASSURANCE_RU.md",
      "docs/mobile/requirements/v12/20_SECURITY_PRIVACY_COMPLIANCE_RU.md"],
    previousEntries: ["docs/mobile/evidence/S16/child-policy-foundation-20261002/entry.json",
      "docs/mobile/evidence/S16/parent-gate-foundation-20261002/entry.json"], stageAccepted: false, releaseReady: false });
  await fresh(FOLDER + "/result.json", { schemaVersion: 1, stageId: "S16", kind: "sealed-startup-and-child-data-namespace-foundation",
    sourceCommit: receipt.sourceCommit, originalTestHead: receipt.originalTestHead, recordedAt, pass: true, sourceFiles,
    criterionIds: ["S16.acceptance", ...ids.map(id => "S16." + id)], requirementIds: ids,
    checks: { typeScriptInvocations: 1, unitInvocations: 1, unitFiles: 2, passedUnitTests: 91, failedUnitTests: 0,
      skippedUnitTests: 0, todoUnitTests: 0, namespaceTests: 40, startupTests: 51, browserRuns: 0, appBuilds: 0,
      earlier222And96CasesRepeated: false, sourceRowsBeforeAfterEqual: true, committedTestedFileRowsEqual: true },
    qualification: note, limitations: { runtimeIntegrated: false, installedDevice: false, secureNativeModeProfileStorage: false,
      trustedNativeClock: false, genuineAuthenticatedProfileAdapter: false, genuineReviewedChildPackageAdapter: false,
      actualChildIndexQueries: false, atomicNativeScopeMigration: false, actualLifecycleWiring: false,
      noAdultFrameProven: false, editorialLegalRightsApproval: false, childModeEnabled: false },
    artifacts, stageAccepted: false, releaseReady: false, productionActionsPerformed: false });
  const stateName = "docs/mobile/AUTOPILOT_STATE.json", oldState = JSON.parse(input(stateName).bytes),
    oldS03 = oldState.stages.find(row => row.id === "S03"), index = oldState.stages.findIndex(row => row.id === "S16"), s16 = structuredClone(oldState.stages[index]);
  assert.equal(oldState.currentStageId, "S03"); assert.equal(oldState.currentCriterionId, "S03.acceptance");
  assert.equal(oldS03.criteria.find(row => row.id === "S03.acceptance").status, "IN_PROGRESS");
  assert.equal(oldS03.criteria.filter(row => row.status === "OPEN").length, 11);
  assert.equal(s16.status, "IN_PROGRESS"); assert.ok(s16.criteria.every(row => row.status === "OPEN"));
  await fresh(FOLDER + "/remaining-gates.json", { schemaVersion: 1, firstUnresolved: "S03.acceptance",
    s03OpenCriteria: oldS03.criteria.filter(row => row.status === "OPEN").map(row => row.id),
    previousGates: "docs/mobile/evidence/S16/parent-gate-foundation-20261002/remaining-gates.json",
    userInputsAlreadyKnown: { testDeviceOrVMAvailable: false, pspChosen: false },
    internalCodexWork: ["Trusted child-only package/index/query adapters", "Separate child search/history/cache/offline with atomic scope retirement",
      "Protected native mode/profile/PIN record storage", "Trusted restart-stable time and device calibration",
      "Native enrollment/recovery and host startup/lifecycle/route integration"],
    externalAcceptanceDependencies: ["Installed device/VM tests", "Approved exact RU/EN child editorial/rights/legal materials",
      "PSP selection and real payment/refund validation", "Configured Auth/deletion and separately authorized remote verification"],
    qualification: "Synthetic trusted ports are no OS or editorial approval proof. No actual index query or rendered frame was tested.", stageAccepted: false, releaseReady: false });
  await fresh(FOLDER + "/README.md", "# S16 sealed child startup and namespaces\n\n" + note + "\n\n" +
    "One TypeScript run and one focused unit run passed91/91 (40 namespace,51 startup). No prior222/96 cases, browser or builds repeated. Source" + receipt.sourceCommit +
    " exactly contains the tested four files. Native secure restore/clock, actual reviewed package and host rendering remain absent; snapshots do not grant permanent content authority.\n\nNext: " + nextAction + "\n");
  s16.artifacts.push(FOLDER + "/entry.json", FOLDER + "/result.json", FOLDER + "/remaining-gates.json");
  for (const criterion of s16.criteria.filter(row => ["S16.acceptance", ...ids.map(id => "S16." + id)].includes(row.id))) {
    criterion.evidence.push(FOLDER + "/result.json"); criterion.notes += " " + note;
  }
  const parallel = structuredClone(oldState.verificationCache.parallelSafeStages); parallel.S16.evidence.push(FOLDER + "/entry.json", FOLDER + "/result.json");
  const updatedState = patchJson(input(stateName).bytes.toString("utf8"), [[["headSha"], receipt.sourceCommit], [["updatedAt"], recordedAt],
    [["stages", index], s16], [["verificationCache", "parallelSafeStages"], parallel], [["resume", "nextAction"], nextAction],
    [["resume", "contextFiles"], [...oldState.resume.contextFiles, FOLDER + "/entry.json", FOLDER + "/result.json", FOLDER + "/remaining-gates.json"]],
    [["resume", "doNotRepeat"], [...oldState.resume.doNotRepeat, "S16 sealed startup source" + receipt.sourceCommit.slice(0, 8) +
      ": retain TypeScript and91 focusedunits PASS (40namespace/51startup); mocks prove no device/frame/OS/index/content approval. Do not repeat old222/96 or passing browser/build evidence for docs."]]]);
  const protectedState = JSON.parse(updatedState); protectedState.headSha = oldState.headSha; protectedState.updatedAt = oldState.updatedAt;
  protectedState.stages[index] = oldState.stages[index]; protectedState.verificationCache.parallelSafeStages = oldState.verificationCache.parallelSafeStages;
  for (const key of ["nextAction", "contextFiles", "doNotRepeat"]) protectedState.resume[key] = oldState.resume[key];
  assert.deepEqual(protectedState, oldState); await existing(stateName, updatedState, input(stateName).sha256);
  const traceName = "docs/mobile/REQUIREMENTS_TRACEABILITY.json", oldTrace = JSON.parse(input(traceName).bytes), changes = [];
  for (const id of ids) {
    const position = oldTrace.requirements.findIndex(row => row.id === id), item = structuredClone(oldTrace.requirements[position]);
    assert.equal(item.status, "OPEN"); item.implementationFiles = id === "CHILD-005" ? ["src/child/childDataNamespace.ts"] : ["src/child/childStartup.ts", "src/child/childDataNamespace.ts"];
    item.tests = id === "CHILD-005" ? ["src/child/childDataNamespace.test.ts"] : ["src/child/childStartup.test.ts", "src/child/childDataNamespace.test.ts"];
    item.evidence.push(FOLDER + "/result.json"); item.notes += " " + note; changes.push([["requirements", position], item]);
  }
  const updatedTrace = patchJson(input(traceName).bytes.toString("utf8"), changes); await existing(traceName, updatedTrace, input(traceName).sha256);
  const { parseCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/csv.mjs")));
  const { projectTraceabilityCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/verify-state.mjs")));
  const sources = parseCsv(await fs.readFile(path.join(ROOT, "docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv"), "utf8"));
  const projection = projectTraceabilityCsv(JSON.parse(updatedTrace), sources), rows = projection.trimEnd().split("\n");
  const lines = input("docs/mobile/REQUIREMENTS_TRACEABILITY.csv").bytes.toString("utf8").match(/[^\r\n]*(?:\r\n|\n|$)/gu).filter(Boolean);
  const csv = lines.map((line, position) => ids.includes(line.split(",", 1)[0]) ? rows[position] +
    (line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "") : line).join("");
  assert.equal(csv.replaceAll("\r\n", "\n"), projection); await existing("docs/mobile/REQUIREMENTS_TRACEABILITY.csv", csv, input("docs/mobile/REQUIREMENTS_TRACEABILITY.csv").sha256);
  const block = "\n<!-- s16-sealed-child-startup-20261002:begin -->\n" + note + "\nEvidence: " + FOLDER + "/result.json\nNext: " + nextAction + "\n<!-- s16-sealed-child-startup-20261002:end -->\n\n";
  for (const file of ["AGENTS.md", "docs/mobile/STATUS.md", "docs/mobile/NEXT_CODEX_PROMPT.txt"]) {
    const before = input(file).bytes, insert = file === "AGENTS.md" ? before.indexOf(Buffer.from("<!-- s16-parent-gate-foundation-20261002:begin -->")) : 0;
    assert.ok(insert >= 0); await existing(file, Buffer.concat([before.subarray(0, insert), Buffer.from(block), before.subarray(insert)]), input(file).sha256);
  }
  const decision = input("docs/mobile/DECISIONS.md");
  await existing(decision.path, Buffer.concat([decision.bytes, Buffer.from("\n- 2026-10-02 / S16 sealed startup continuation: " + note +
    " Source" + receipt.sourceCommit + ";91 focusedunits+TypeScript PASS. Evidence: " + FOLDER + "/result.json.\n")]), decision.sha256);
  const changed = dirty(); assert.ok(changed.every(file => existingFiles.includes(file) || file.startsWith(FOLDER + "/")));
  const protectedRows = plan.witnesses.filter(row => !existingFiles.includes(row.path)); await equal([...protectedRows, ...plan.proposed]);
  await fs.writeFile(path.join(HERE, "actual/checkpoint-plan.json"), json({ sourceCommit: receipt.sourceCommit, files: await Promise.all(changed.map(ref)),
    protectedRows, testedRows: plan.proposed }), { flag: "wx" });
  console.log(json({ recorded: true, changedFiles: changed.length, sourceCommit: receipt.sourceCommit, protectedStateEqual: true, s03Unchanged: true }));
} else if (mode === "verify") {
  const plan = await read("actual/checkpoint-plan.json", true); assert.equal(git(["rev-parse", "HEAD"]), plan.sourceCommit);
  await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]);
  Object.assign(process.env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: ROOT,
    GIT_CONFIG_KEY_1: "core.autocrlf", GIT_CONFIG_VALUE_1: "true" });
  const { verifyExecutionFiles } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/verify-state.mjs")));
  const report = await verifyExecutionFiles(ROOT); await fresh(FOLDER + "/verification-final.json", report);
  assert.equal(report.pass, true); assert.deepEqual(report.errors, []); assert.equal(report.releaseReady, false);
  await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]); git(["-c", "core.whitespace=cr-at-eol", "diff", "--check"]);
  plan.files.push(await ref(FOLDER + "/verification-final.json"));
  await fs.writeFile(path.join(HERE, "actual/verified-plan.json"), json(plan), { flag: "wx" });
  console.log(json({ pass: true, errors: [], releaseReady: false, unchangedHistoricalInputs: true, historicalConversion: "per-process true" }));
} else if (mode === "commit") {
  const plan = await read("actual/verified-plan.json", true); assert.equal(git(["rev-parse", "HEAD"]), plan.sourceCommit);
  await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]); assert.deepEqual(dirty(), plan.files.map(row => row.path).sort());
  git(["add", "--", ...plan.files.map(row => row.path)]);
  assert.deepEqual(git(["diff", "--cached", "--name-only"]).split(/\r?\n/u).sort(), plan.files.map(row => row.path).sort());
  git(["commit", "-m", "docs: checkpoint sealed child startup and namespace foundations"]);
  const head = git(["rev-parse", "HEAD"]); await equal([...plan.files, ...plan.protectedRows, ...plan.testedRows]); assert.deepEqual(dirty(), []);
  await fs.writeFile(path.join(HERE, "actual/final-checkpoint.json"), json({ head, sourceCommit: plan.sourceCommit, clean: true, releaseReady: false }), { flag: "wx" });
  console.log(json({ head, sourceCommit: plan.sourceCommit, clean: true, releaseReady: false }));
} else throw new Error("Unknown mode");
