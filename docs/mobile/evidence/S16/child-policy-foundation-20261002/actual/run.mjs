import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const logical = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
const ROOT = await fs.realpath(logical);
assert.equal(ROOT.toLowerCase(), "d:\\codexprojects\\работа по сайту\\literary-planet-v12-work");
const initialHead = "3ef3eb6eda231000ef9dd5401f17f5485a1fc2aa";
const files = ["src/child/childProfile.ts", "src/child/childProfile.test.ts",
  "src/child/childAccessPolicy.ts", "src/child/childAccessPolicy.test.ts"];
const witnesses = ["AGENTS.md", "docs/mobile/AUTOPILOT_STATE.json", "docs/mobile/REQUIREMENTS_TRACEABILITY.json",
  "docs/mobile/REQUIREMENTS_TRACEABILITY.csv", "docs/mobile/STATUS.md", "docs/mobile/DECISIONS.md",
  "docs/mobile/NEXT_CODEX_PROMPT.txt", "docs/mobile/BLOCKERS.md", "src/App.tsx", "src/main.tsx",
  "src/platform/ports.ts", "src/platform/PlatformServices.tsx", "src/i18n/InterfaceLanguage.tsx",
  "package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts",
  "docs/mobile/evidence/S03/booky-size-persistence-20261002/result.json",
  "docs/mobile/evidence/S03/booky-size-persistence-20261002/capture-review.json",
  "docs/mobile/evidence/S03/booky-size-persistence-20261002/verification-final.json",
  "docs/mobile/evidence/S03/booky-size-persistence-20261002/verification-input-correction.json",
  "docs/mobile/requirements/v12/11_CHILD_MODE_PARENT_GATE_AGE_ASSURANCE_RU.md",
  "docs/mobile/requirements/v12/62_CHILD_AGE_POLICY_MATRIX.csv"];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const git = args => execFileSync("git", ["-c", "safe.directory=" + ROOT, "-c", "core.autocrlf=false", ...args],
  { cwd: ROOT, encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 4 * 1024 * 1024 }).trim();
const ref = async filename => ({ path: filename, sha256: sha(await fs.readFile(path.join(ROOT, filename))) });
const fresh = async (name, value) => {
  const target = path.join(HERE, "actual", name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, typeof value === "string" || Buffer.isBuffer(value) ? value : json(value), { flag: "wx" });
};
const read = async name => JSON.parse(await fs.readFile(path.join(HERE, "actual", name), "utf8"));
async function equalRows(rows) {
  for (const row of rows) assert.deepEqual(await ref(row.path), row, row.path);
}
const mode = process.argv[2];
if (mode === "integrate") {
  assert.equal(git(["rev-parse", "HEAD"]), initialHead);
  assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
  const before = await Promise.all(witnesses.map(ref));
  const proposed = [];
  for (const filename of files) {
    const bytes = await fs.readFile(path.join(HERE, filename));
    assert.ok(bytes.length > 0);
    proposed.push({ path: filename, sha256: sha(bytes) });
  }
  await fs.mkdir(path.join(ROOT, "src/child"), { recursive: true });
  for (const filename of files) await fs.writeFile(path.join(ROOT, filename), await fs.readFile(path.join(HERE, filename)), { flag: "wx" });
  await equalRows(before); await equalRows(proposed);
  await fresh("integration.json", { initialHead, root: ROOT, witnesses: before, proposed });
  console.log(json({ integrated: files.length, unchangedWitnesses: before.length, initialHead }));
} else if (mode === "repair") {
  const plan = await read("integration.json"), failed = await read("typescript.execution.json");
  assert.equal(failed.exitCode, 2); assert.equal(git(["rev-parse", "HEAD"]), plan.initialHead);
  await equalRows(plan.witnesses); await equalRows(plan.proposed);
  for (const filename of files) await fresh("failed-a1/" + filename, await fs.readFile(path.join(ROOT, filename)));
  const updated = [], changed = [];
  for (const filename of files) {
    const bytes = await fs.readFile(path.join(HERE, filename)), next = { path: filename, sha256: sha(bytes) };
    updated.push(next);
    if (next.sha256 !== plan.proposed.find(row => row.path === filename).sha256) {
      changed.push(filename); await fs.writeFile(path.join(ROOT, filename), bytes);
    }
  }
  assert.deepEqual(changed.sort(), ["src/child/childAccessPolicy.test.ts", "src/child/childProfile.test.ts", "src/child/childProfile.ts"]);
  await equalRows(plan.witnesses); await equalRows(updated);
  await fresh("integration-a2.json", { ...plan, proposed: updated, initialProposed: plan.proposed,
    repair: "Two TypeScript typing fixes; policy table expanded from19 matrix kinds to all25 spec kinds before the first unit run.",
    preservedFailure: "typescript.execution.json", unitInvocationsBeforeRepair: 0 });
  console.log(json({ repaired: changed, originalFailureRetained: true, unitInvocationsBeforeRepair: 0 }));
} else if (mode === "test" || mode === "test-a2") {
  const prefix = mode === "test-a2" ? "a2/" : "";
  const plan = await read(mode === "test-a2" ? "integration-a2.json" : "integration.json");
  assert.equal(git(["rev-parse", "HEAD"]), plan.initialHead);
  await equalRows(plan.witnesses); await equalRows(plan.proposed);
  const unitOutput = path.join(HERE, "actual", prefix, "vitest.json");
  await fs.mkdir(path.dirname(unitOutput), { recursive: true });
  const commands = [
    { id: "typescript", args: [path.join(ROOT, "node_modules/typescript/bin/tsc"), "--noEmit", "--incremental", "false"] },
    { id: "units", args: [path.join(ROOT, "node_modules/vitest/vitest.mjs"), "run",
      "src/child/childProfile.test.ts", "src/child/childAccessPolicy.test.ts", "--reporter=json", "--outputFile=" + unitOutput] },
  ];
  for (const command of commands) {
    const startedAt = new Date().toISOString(), start = performance.now();
    const run = spawnSync(process.execPath, command.args, { cwd: ROOT, windowsHide: true, encoding: "utf8",
      timeout: 180_000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, CI: "1", NO_COLOR: "1" } });
    await fresh(prefix + command.id + ".stdout.txt", run.stdout ?? "");
    await fresh(prefix + command.id + ".stderr.txt", run.stderr ?? "");
    await fresh(prefix + command.id + ".execution.json", { command: [process.execPath, ...command.args],
      startedAt, finishedAt: new Date().toISOString(), elapsedMs: Math.round(performance.now() - start),
      exitCode: run.status, signal: run.signal, error: run.error?.message ?? null });
    assert.equal(run.status, 0, command.id + ": " + (run.stderr ?? "") + (run.stdout ?? ""));
  }
  const report = await read(prefix + "vitest.json");
  assert.equal(report.success, true); assert.equal(report.numFailedTests, 0);
  assert.equal(report.numPendingTests, 0); assert.equal(report.numTodoTests, 0);
  assert.equal(report.testResults.length, 2);
  await equalRows(plan.witnesses); await equalRows(plan.proposed);
  await fresh(prefix + "focused-result.json", { pass: true, totalTests: report.numTotalTests, passedTests: report.numPassedTests,
    failedTests: report.numFailedTests, unselectedSuites: true, typeScriptInvocations: 1, unitInvocations: 1,
    sourceRowsBeforeAfterEqual: true, sourceFiles: plan.proposed, unchangedWitnesses: plan.witnesses });
  console.log(json({ pass: true, tests: report.numPassedTests, typeScriptInvocations: 1, unitInvocations: 1 }));
} else if (mode === "commit-source") {
  const plan = await read("integration-a2.json"), checked = await read("a2/focused-result.json");
  assert.equal(checked.pass, true); assert.equal(git(["rev-parse", "HEAD"]), plan.initialHead);
  await equalRows(plan.witnesses); await equalRows(plan.proposed);
  const dirty = git(["status", "--porcelain=v1", "--untracked-files=all"]).split(/\r?\n/u);
  assert.deepEqual(dirty.map(row => row.slice(3)).sort(), [...files].sort());
  git(["add", "--", ...files]); git(["diff", "--cached", "--check"]);
  assert.deepEqual(git(["diff", "--cached", "--name-only"]).split(/\r?\n/u).sort(), [...files].sort());
  git(["commit", "-m", "feat: add exact-age child policy and local profile validation"]);
  const sourceCommit = git(["rev-parse", "HEAD"]);
  await equalRows(plan.witnesses); await equalRows(plan.proposed);
  for (const row of plan.proposed) {
    const bytes = execFileSync("git", ["-c", "safe.directory=" + ROOT, "show", sourceCommit + ":" + row.path],
      { cwd: ROOT, windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    assert.equal(sha(bytes), row.sha256, row.path);
  }
  assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]), "");
  await fresh("source-commit.json", { sourceCommit, originalTestHead: plan.initialHead,
    exactTestedFileRows: true, sourceFiles: plan.proposed, typeScriptInvocations: 2, unitInvocations: 1 });
  console.log(json({ sourceCommit, testedFileRowsEqual: true, clean: true }));
} else throw new Error("Unknown mode");
