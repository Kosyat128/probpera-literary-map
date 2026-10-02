import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = await fs.realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
assert.equal(ROOT.toLowerCase(), "d:\\codexprojects\\работа по сайту\\literary-planet-v12-work");
const initialHead = "d4166a73ba3a94abb58429319db5f275316dc147";
const files = ["src/child/childDataNamespace.ts", "src/child/childDataNamespace.test.ts", "src/child/childStartup.ts", "src/child/childStartup.test.ts"];
const witnesses = ["AGENTS.md", "docs/mobile/AUTOPILOT_STATE.json", "docs/mobile/REQUIREMENTS_TRACEABILITY.json",
  "docs/mobile/REQUIREMENTS_TRACEABILITY.csv", "docs/mobile/STATUS.md", "docs/mobile/DECISIONS.md",
  "docs/mobile/NEXT_CODEX_PROMPT.txt", "docs/mobile/BLOCKERS.md", "src/App.tsx", "src/main.tsx",
  "src/platform/ports.ts", "src/platform/PlatformServices.tsx", "src/i18n/InterfaceLanguage.tsx",
  "package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts",
  "src/child/childProfile.ts", "src/child/childProfile.test.ts", "src/child/childAccessPolicy.ts", "src/child/childAccessPolicy.test.ts",
  ...["result.json", "capture-review.json", "verification-final.json", "remaining-gates.json", "verification-input-correction.json"]
    .map(name => "docs/mobile/evidence/S03/booky-size-persistence-20261002/" + name),
  ...["result.json", "verification-final.json", "record-recovery.json"]
    .map(name => "docs/mobile/evidence/S16/child-policy-foundation-20261002/" + name),
  "src/child/parentGate.ts", "src/child/parentGate.test.ts", "src/child/parentPinVerification.ts", "src/child/parentPinVerification.test.ts",
  ...["result.json", "verification-final.json", "record-recovery.json"].map(name => "docs/mobile/evidence/S16/parent-gate-foundation-20261002/" + name),
  "docs/mobile/requirements/v12/11_CHILD_MODE_PARENT_GATE_AGE_ASSURANCE_RU.md",
  "docs/mobile/requirements/v12/20_SECURITY_PRIVACY_COMPLIANCE_RU.md"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const git = args => execFileSync("git", ["-c", "safe.directory=" + ROOT, "-c", "core.autocrlf=false", ...args],
  { cwd: ROOT, windowsHide: true, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trimEnd();
const ref = async file => ({ path: file, sha256: sha(await fs.readFile(path.join(ROOT, file))) });
const fresh = async (name, value) => {
  const target = path.join(HERE, "actual", name); await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, typeof value === "string" || Buffer.isBuffer(value) ? value : json(value), { flag: "wx" });
};
const read = async name => JSON.parse(await fs.readFile(path.join(HERE, "actual", name), "utf8"));
const equal = async rows => { for (const row of rows) assert.deepEqual(await ref(row.path), row, row.path); };
const dirty = () => git(["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u).filter(Boolean).map(row => row.slice(3)).sort();
const mode = process.argv[2];
if (mode === "integrate") {
  assert.equal(git(["rev-parse", "HEAD"]), initialHead); assert.deepEqual(dirty(), []);
  const before = await Promise.all(witnesses.map(ref)), proposed = [];
  for (const file of files) proposed.push({ path: file, sha256: sha(await fs.readFile(path.join(HERE, file))) });
  for (const file of files) await fs.writeFile(path.join(ROOT, file), await fs.readFile(path.join(HERE, file)), { flag: "wx" });
  await equal(before); await equal(proposed); assert.deepEqual(dirty(), [...files].sort());
  await fresh("integration.json", { initialHead, root: ROOT, witnesses: before, proposed });
  console.log(json({ integrated: files.length, unchangedWitnesses: before.length, initialHead }));
} else if (mode === "test") {
  const plan = await read("integration.json");
  assert.equal(git(["rev-parse", "HEAD"]), plan.initialHead); await equal(plan.witnesses); await equal(plan.proposed);
  assert.deepEqual(dirty(), [...files].sort());
  const unitOutput = path.join(HERE, "actual/vitest.json");
  for (const command of [
    { id: "typescript", args: [path.join(ROOT, "node_modules/typescript/bin/tsc"), "--noEmit", "--incremental", "false"] },
    { id: "units", args: [path.join(ROOT, "node_modules/vitest/vitest.mjs"), "run", "src/child/childDataNamespace.test.ts",
      "src/child/childStartup.test.ts", "--reporter=json", "--outputFile=" + unitOutput] },
  ]) {
    const startedAt = new Date().toISOString(), start = performance.now();
    const run = spawnSync(process.execPath, command.args, { cwd: ROOT, windowsHide: true, encoding: "utf8", timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: "1", NO_COLOR: "1" } });
    await fresh(command.id + ".stdout.txt", run.stdout ?? ""); await fresh(command.id + ".stderr.txt", run.stderr ?? "");
    await fresh(command.id + ".execution.json", { command: [process.execPath, ...command.args], startedAt,
      finishedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start), exitCode: run.status,
      signal: run.signal, error: run.error?.message ?? null });
    assert.equal(run.status, 0, command.id + ": " + (run.stdout ?? "") + (run.stderr ?? ""));
  }
  const report = await read("vitest.json");
  assert.equal(report.success, true); assert.equal(report.numFailedTests, 0); assert.equal(report.numPendingTests, 0);
  assert.equal(report.numTodoTests, 0); assert.equal(report.testResults.length, 2);
  await equal(plan.witnesses); await equal(plan.proposed);
  await fresh("focused-result.json", { pass: true, totalTests: report.numTotalTests, passedTests: report.numPassedTests,
    failedTests: report.numFailedTests, unitFiles: 2, unitInvocations: 1, typeScriptInvocations: 1,
    noBrowserOrAppBuild: true, prior222UnitsRepeated: false, sourceRowsBeforeAfterEqual: true,
    sourceFiles: plan.proposed, unchangedWitnesses: plan.witnesses });
  console.log(json({ pass: true, tests: report.numPassedTests, unitInvocations: 1, typeScriptInvocations: 1 }));
} else if (mode === "commit-source") {
  const plan = await read("integration.json"), checked = await read("focused-result.json");
  assert.equal(checked.pass, true); assert.equal(git(["rev-parse", "HEAD"]), plan.initialHead);
  await equal(plan.witnesses); await equal(plan.proposed); assert.deepEqual(dirty(), [...files].sort());
  git(["add", "--", ...files]); git(["diff", "--cached", "--check"]);
  assert.deepEqual(git(["diff", "--cached", "--name-only"]).split(/\r?\n/u).sort(), [...files].sort());
  git(["commit", "-m", "feat: add sealed child startup and isolated child data scopes"]);
  const sourceCommit = git(["rev-parse", "HEAD"]); await equal(plan.witnesses); await equal(plan.proposed);
  for (const row of plan.proposed) {
    const blob = execFileSync("git", ["-c", "safe.directory=" + ROOT, "show", sourceCommit + ":" + row.path],
      { cwd: ROOT, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(sha(blob), row.sha256, row.path);
  }
  assert.deepEqual(dirty(), []);
  await fresh("source-commit.json", { sourceCommit, originalTestHead: plan.initialHead, sourceFiles: plan.proposed,
    exactTestedFileRows: true, unitInvocations: 1, typeScriptInvocations: 1 });
  console.log(json({ sourceCommit, testedFileRowsEqual: true, clean: true }));
} else throw new Error("Unknown mode");
