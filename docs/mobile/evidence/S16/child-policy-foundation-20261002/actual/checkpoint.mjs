import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = await fs.realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
assert.equal(ROOT.toLowerCase(), "d:\\codexprojects\\работа по сайту\\literary-planet-v12-work");
const FOLDER = "docs/mobile/evidence/S16/child-policy-foundation-20261002";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const git = (args, conversion = "false") => execFileSync("git", ["-c", "safe.directory=" + ROOT,
  "-c", "core.autocrlf=" + conversion, ...args], { cwd: ROOT, windowsHide: true, encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 }).trim();
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
const note = "S16 local foundation: strict decoder for up to4 local profiles and integer ages3-17; per-entity access binds ID/kind/source/policy/selected RU/EN payload, review, topics including parent allowlist/blocklist, rights/platform/territory and exclusive expiry. Only synthetic policy records were tested. No UI/runtime/secure-storage/Parent Gate/content or stage/release activation.";
const nextAction = "S03.acceptance remains the first unresolved gate with all11 criteria OPEN and its recorded installation/PSP/editorial/legal/Auth/remote dependencies unchanged. Continue the documented parallel-safe S16 child implementation from the tested profile/access foundation: inspect and implement the secure Parent Gate capability and local verification/storage boundary, then sealed startup/profile/index/history/package integration before any child UI or content activation. Programming remains Codex work. Do not use PreferenceStore for PIN/verifier/parent authority, invent approved child materials, or infer child access from the decoder, a signature, a parent boolean or paid base. Preserve tested foundation and D267/D268 evidence without docs-only reruns; no deploy/push/merge/store actions.";
const mode = process.argv[2];
if (mode === "record") {
  const receipt = await read("actual/source-commit.json", true), plan = await read("actual/integration-a2.json", true);
  const checked = await read("actual/a2/focused-result.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), receipt.sourceCommit);
  assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
  assert.equal(checked.passedTests, 222);
  for (const row of [...plan.witnesses, ...plan.proposed]) assert.deepEqual(await ref(row.path), row);
  const recordedAt = new Date().toISOString();
  const originals = await Promise.all(["AGENTS.md", "docs/mobile/AUTOPILOT_STATE.json", "docs/mobile/STATUS.md",
    "docs/mobile/DECISIONS.md", "docs/mobile/NEXT_CODEX_PROMPT.txt", "docs/mobile/REQUIREMENTS_TRACEABILITY.json",
    "docs/mobile/REQUIREMENTS_TRACEABILITY.csv"].map(async file => ({ ...await ref(file), bytes: await fs.readFile(path.join(ROOT, file)) })));
  const input = name => originals.find(row => row.path === name);
  const sourceFiles = plan.proposed.map(row => ({ ...row, gitBlob: git(["rev-parse", receipt.sourceCommit + ":" + row.path]) }));
  const copied = [];
  async function copy(local, suffix) {
    const bytes = await fs.readFile(path.join(HERE, local)), destination = FOLDER + "/" + suffix;
    await fresh(destination, bytes); copied.push({ path: destination, sha256: sha(bytes) });
  }
  for (const local of ["integration.json", "integration-a2.json", "typescript.stdout.txt", "typescript.stderr.txt",
    "typescript.execution.json", "source-commit.json"]) await copy("actual/" + local, "actual/" + local);
  for (const local of ["typescript.stdout.txt", "typescript.stderr.txt", "typescript.execution.json", "units.stdout.txt",
    "units.stderr.txt", "units.execution.json", "vitest.json", "focused-result.json"]) await copy("actual/a2/" + local, "actual/a2/" + local);
  for (const row of plan.initialProposed) await copy("actual/failed-a1/" + row.path, "actual/failed-a1/" + row.path);
  await copy("run.mjs", "actual/run.mjs");
  await copy("checkpoint.mjs", "actual/checkpoint.mjs");
  const entry = { schemaVersion: 1, stageId: "S16", recordType: "parallel-safe-child-policy-foundation",
    sourceCommit: receipt.sourceCommit, originalHead: receipt.originalTestHead,
    authority: "User requested further uninterrupted local work; matrix69 explicitly permits documented parallel-safe entry.",
    reason: "Pure child profile/access contracts are original unfinished internal programming independent of OS/PSP/remote/human review inputs. Current App, globe, Booky, locale and paid-access source remain byte-identical; no child mode is activated.",
    routing: { genericRoute: "S16-S20", supplement: "Stage16 is Child mode and Parent Gate in matrix69 and CHILD requirements map. Its explicit binding11 and matrix62 supplement generic commercial routing without modifying immutable input.",
      bindingDocuments: ["docs/mobile/requirements/v12/11_CHILD_MODE_PARENT_GATE_AGE_ASSURANCE_RU.md", "docs/mobile/requirements/v12/62_CHILD_AGE_POLICY_MATRIX.csv"] },
    allowedScope: ["Strict local profile metadata decoder", "Pure per-entity exact-age access evaluator", "Synthetic focused tests"],
    protected: ["S03 admission and11 OPEN criteria", "All human/editorial/legal/owner approvals", "Native OS/storage and release gates", "Existing UI/canonical scene/content"],
    stageAccepted: false, releaseReady: false };
  await fresh(FOLDER + "/entry.json", entry);
  await fresh(FOLDER + "/result.json", { schemaVersion: 1, stage: "S16", kind: "child-profile-and-exact-age-policy-foundation",
    sourceCommit: receipt.sourceCommit, originalTestHead: receipt.originalTestHead, recordedAt,
    pass: true, criterionIds: ["S16.acceptance", "S16.CHILD-001", "S16.CHILD-002", "S16.CHILD-003", "S16.CHILD-004"],
    requirementIds: ["CHILD-001", "CHILD-002", "CHILD-003", "CHILD-004"], sourceFiles,
    checks: { typeScriptInvocations: 2, failedTypeScriptInvocations: 1, passedTypeScriptInvocations: 1,
      unitInvocations: 1, unitFiles: 2, passedUnitTests: 222, policyTests: 191, profileTests: 31, failedUnitTests: 0,
      skippedUnitTests: 0, todoUnitTests: 0, matrixEntityKinds: 19, testedEntityKinds: 25,
      browserRuns: 0, appBuilds: 0, sourceRowsBeforeAfterEqual: true, committedTestedFileRowsEqual: true },
    qualification: note, limitations: { runtimeIntegrated: false, childModeEnabled: false, secureParentGate: false,
      nativeOSStorage: false, profilePersistence: false, authenticatedChildPackageAdapter: false,
      actualHumanApproval: false, editorialLegalAdmission: false, installedDevice: false },
    initialFailure: { report: FOLDER + "/actual/typescript.execution.json", exitCode: 2,
      reason: "Two new-file TypeScript typing errors repaired before the first unit invocation; original files and failed report retained.",
      policyTestExpansion: "Final reviewed table was extended from19 matrix kinds to all25 spec kinds before the first unit run." },
    artifacts: copied, stageAccepted: false, releaseReady: false, productionActionsPerformed: false });
  await fresh(FOLDER + "/README.md", "# S16 child policy foundation\n\n" + note + "\n\n" +
    "Two TypeScript invocations: initial typing failure retained, corrected run passed. One focused Vitest invocation passed222/222 (31 profile,191 policy); no browser, app/PWA/native compilation or old suite repeated. Source" + receipt.sourceCommit + " exactly contains the tested four files.\n\n" +
    "S03 remains first unresolved; no criterion is accepted. Parallel entry is documented in entry.json. Next internal work is secure Parent Gate and sealed startup/index/storage integration, with reviewed child content still required before activation.\n");
  const stateName = "docs/mobile/AUTOPILOT_STATE.json", state = JSON.parse(input(stateName).bytes);
  const s16Index = state.stages.findIndex(row => row.id === "S16"), s16 = structuredClone(state.stages[s16Index]);
  assert.equal(s16.status, "NOT_STARTED"); assert.equal(state.currentStageId, "S03"); assert.equal(state.currentCriterionId, "S03.acceptance");
  const s03 = structuredClone(state.stages.find(row => row.id === "S03"));
  s16.status = "IN_PROGRESS"; s16.artifacts = [...new Set([...(s16.artifacts ?? []), FOLDER + "/entry.json", FOLDER + "/result.json"])];
  for (const criterion of s16.criteria.filter(row => ["S16.acceptance", "S16.CHILD-001", "S16.CHILD-002", "S16.CHILD-003", "S16.CHILD-004"].includes(row.id))) {
    assert.equal(criterion.status, "OPEN");
    criterion.evidence.push(FOLDER + "/result.json"); criterion.notes += " " + note;
  }
  const parallel = { ...state.verificationCache.parallelSafeStages, S16: { reason: entry.reason, evidence: [FOLDER + "/entry.json", FOLDER + "/result.json"] } };
  const contextFiles = [...new Set([...state.resume.contextFiles, FOLDER + "/entry.json", FOLDER + "/result.json"])];
  const doNotRepeat = [...state.resume.doNotRepeat, "S16 foundation source" + receipt.sourceCommit.slice(0, 8) +
    ": retain222 focused units and correctedTypeScript PASS; first TypeScript failure stays separate. No passing old PWA/native/public/Booky or foundation runs solely for reports. Child runtime, secure Parent Gate, OS storage and content approvals remain absent."];
  const updatedState = patchJson(input(stateName).bytes.toString("utf8"), [[["headSha"], receipt.sourceCommit], [["updatedAt"], recordedAt],
    [["stages", s16Index], s16], [["verificationCache", "parallelSafeStages"], parallel],
    [["resume", "nextAction"], nextAction], [["resume", "contextFiles"], contextFiles], [["resume", "doNotRepeat"], doNotRepeat]]);
  const afterState = JSON.parse(updatedState);
  assert.deepEqual(afterState.stages.find(row => row.id === "S03"), s03);
  assert.deepEqual(afterState.moderation, state.moderation); assert.deepEqual(afterState.ownerMinimal, state.ownerMinimal);
  assert.deepEqual(afterState.bilingual, state.bilingual);
  await existing(stateName, updatedState, input(stateName).sha256);
  const traceName = "docs/mobile/REQUIREMENTS_TRACEABILITY.json", trace = JSON.parse(input(traceName).bytes), tracePatches = [];
  for (const id of ["CHILD-001", "CHILD-002", "CHILD-003", "CHILD-004"]) {
    const index = trace.requirements.findIndex(row => row.id === id), item = structuredClone(trace.requirements[index]);
    assert.equal(item.status, "OPEN");
    item.implementationFiles = id === "CHILD-001" ? ["src/child/childProfile.ts"] :
      id === "CHILD-002" ? ["src/child/childProfile.ts", "src/child/childAccessPolicy.ts"] : ["src/child/childAccessPolicy.ts", "src/child/childProfile.ts"];
    item.tests = id === "CHILD-001" ? ["src/child/childProfile.test.ts"] :
      id === "CHILD-002" ? ["src/child/childProfile.test.ts", "src/child/childAccessPolicy.test.ts"] : ["src/child/childAccessPolicy.test.ts", "src/child/childProfile.test.ts"];
    item.evidence.push(FOLDER + "/result.json"); item.notes += " " + note;
    tracePatches.push([["requirements", index], item]);
  }
  const updatedTrace = patchJson(input(traceName).bytes.toString("utf8"), tracePatches);
  await existing(traceName, updatedTrace, input(traceName).sha256);
  const { parseCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/csv.mjs")));
  const { projectTraceabilityCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/verify-state.mjs")));
  const sources = parseCsv(await fs.readFile(path.join(ROOT, "docs/mobile/requirements/v12/68_REQUIREMENT_ID_INDEX.csv"), "utf8"));
  const projected = projectTraceabilityCsv(JSON.parse(updatedTrace), sources).trimEnd().split("\n");
  const oldCsv = input("docs/mobile/REQUIREMENTS_TRACEABILITY.csv").bytes.toString("utf8");
  const lines = oldCsv.match(/[^\r\n]*(?:\r\n|\n|$)/gu).filter(Boolean);
  const replacementIds = new Set(["CHILD-001", "CHILD-002", "CHILD-003", "CHILD-004"]);
  const csv = lines.map((line, index) => replacementIds.has(line.split(",", 1)[0])
    ? projected[index] + (line.endsWith("\r\n") ? "\r\n" : line.endsWith("\n") ? "\n" : "") : line).join("");
  assert.equal(csv.replaceAll("\r\n", "\n"), projectTraceabilityCsv(JSON.parse(updatedTrace), sources));
  await existing("docs/mobile/REQUIREMENTS_TRACEABILITY.csv", csv, input("docs/mobile/REQUIREMENTS_TRACEABILITY.csv").sha256);
  const block = "\n<!-- s16-child-policy-foundation-20261002:begin -->\n" + note + "\nEvidence: " + FOLDER + "/result.json\nNext: " + nextAction + "\n<!-- s16-child-policy-foundation-20261002:end -->\n\n";
  for (const file of ["AGENTS.md", "docs/mobile/STATUS.md", "docs/mobile/NEXT_CODEX_PROMPT.txt"]) {
    const bytes = input(file).bytes;
    const insert = file === "AGENTS.md" ? bytes.indexOf(Buffer.from("<!-- s03-booky-size-persistence-20261002:begin -->")) : 0;
    assert.ok(insert >= 0);
    await existing(file, Buffer.concat([bytes.subarray(0, insert), Buffer.from(block), bytes.subarray(insert)]), input(file).sha256);
  }
  const decisions = input("docs/mobile/DECISIONS.md");
  await existing(decisions.path, Buffer.concat([decisions.bytes, Buffer.from("\n- 2026-10-02 / S16 parallel-safe foundation: " + note + " Matrix69 permits independent internal programming while S03 remains first unresolved. Evidence: " + FOLDER + "/entry.json, " + FOLDER + "/result.json.\n")]), decisions.sha256);
  const changed = git(["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u).map(line => line.slice(3)).sort();
  const allowedExisting = originals.map(row => row.path).sort();
  assert.ok(changed.every(file => allowedExisting.includes(file) || file.startsWith(FOLDER + "/")));
  const protectedRows = plan.witnesses.filter(row => !allowedExisting.includes(row.path));
  for (const row of [...protectedRows, ...plan.proposed]) assert.deepEqual(await ref(row.path), row);
  await fs.writeFile(path.join(HERE, "actual/checkpoint-plan.json"), json({ sourceCommit: receipt.sourceCommit,
    files: await Promise.all(changed.map(ref)), protectedRows, testedRows: plan.proposed }), { flag: "wx" });
  console.log(json({ recorded: true, sourceCommit: receipt.sourceCommit, changedFiles: changed.length,
    s03Unchanged: true, allCriteriaAndRequirementStatusesPreserved: true }));
} else if (mode === "verify") {
  const plan = await read("actual/checkpoint-plan.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), plan.sourceCommit);
  for (const row of [...plan.files, ...plan.protectedRows, ...plan.testedRows]) assert.deepEqual(await ref(row.path), row);
  // Historical evidence uses Git clean conversion. Scope this to verification;
  // source/report commits continue to preserve existing raw mixed endings.
  Object.assign(process.env, { GIT_CONFIG_COUNT: "2", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: ROOT,
    GIT_CONFIG_KEY_1: "core.autocrlf", GIT_CONFIG_VALUE_1: "true" });
  const { verifyExecutionFiles } = await import(pathToFileURL(path.join(ROOT, "scripts/mobile/verify-state.mjs")));
  const report = await verifyExecutionFiles(ROOT);
  await fresh(FOLDER + "/verification-final.json", report);
  assert.equal(report.pass, true); assert.deepEqual(report.errors, []); assert.equal(report.releaseReady, false);
  for (const row of [...plan.files, ...plan.protectedRows, ...plan.testedRows]) assert.deepEqual(await ref(row.path), row);
  git(["-c", "core.whitespace=cr-at-eol", "diff", "--check"]);
  plan.files.push(await ref(FOLDER + "/verification-final.json"));
  await fs.writeFile(path.join(HERE, "actual/verified-plan.json"), json(plan), { flag: "wx" });
  console.log(json({ pass: true, errors: report.errors, releaseReady: false, historicalConversion: "per-process true",
    unchangedHistoricalInputs: true }));
} else if (mode === "commit") {
  const plan = await read("actual/verified-plan.json", true);
  assert.equal(git(["rev-parse", "HEAD"]), plan.sourceCommit);
  for (const row of [...plan.files, ...plan.protectedRows, ...plan.testedRows]) assert.deepEqual(await ref(row.path), row);
  assert.deepEqual(git(["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u).map(line => line.slice(3)).sort(),
    plan.files.map(row => row.path).sort());
  git(["add", "--", ...plan.files.map(row => row.path)]);
  assert.deepEqual(git(["diff", "--cached", "--name-only"]).split(/\r?\n/u).sort(), plan.files.map(row => row.path).sort());
  git(["commit", "-m", "docs: checkpoint parallel child policy foundation"]);
  const head = git(["rev-parse", "HEAD"]);
  for (const row of [...plan.files, ...plan.protectedRows, ...plan.testedRows]) assert.deepEqual(await ref(row.path), row);
  assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
  await fs.writeFile(path.join(HERE, "actual/final-checkpoint.json"), json({ head, sourceCommit: plan.sourceCommit,
    clean: true, releaseReady: false }), { flag: "wx" });
  console.log(json({ head, sourceCommit: plan.sourceCommit, clean: true, releaseReady: false }));
} else throw new Error("Unknown checkpoint mode");
