import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { lstat, realpath, mkdir, readFile, writeFile, readdir, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createRequire, builtinModules } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// Writer-only recovery proposal. ROOT supplies a clean fix commit after reviewing/pinning this producer.
const root = await realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
const visual = await realpath("D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94");
const review = path.join(visual, "s03-public-current-compiled-review");
const here = await realpath(path.dirname(fileURLToPath(import.meta.url)));
assert.equal(here, path.join(review, "proposed"));
assert.equal(process.argv.length, 2);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const portable = value => value.split(path.sep).join("/");
const git = args => execFileSync("git", ["--no-optional-locks", "-c", "safe.directory=" + root, ...args],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
const moduleAt = relative => import(pathToFileURL(path.join(root, relative)).href);
async function safeFile(base, relative, limit = 64 * 1024 * 1024) {
  assert.ok(relative && !path.isAbsolute(relative) && !relative.includes("\\") && !relative.includes("\0"));
  assert.ok(relative.split("/").every(part => part && ![".", ".."].includes(part) && !/^\.env(?:\.|$)/u.test(part)));
  let filename = base;
  for (const part of relative.split("/")) {
    filename = path.join(filename, part);
    assert.ok(!(await lstat(filename)).isSymbolicLink(), "Linked input: " + relative);
    assert.equal(await realpath(filename), filename, "Aliased input: " + relative);
  }
  const info = await lstat(filename);
  assert.ok(info.isFile() && info.size <= limit, "Invalid input: " + relative);
  return readFile(filename);
}
async function tree(base, prefix = "", skipNestedNodeModules = false) {
  const files = [];
  const start = path.join(base, prefix);
  assert.ok(!(await lstat(start)).isSymbolicLink());
  assert.equal(await realpath(start), start);
  async function walk(relative) {
    const directory = path.join(base, relative);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = [relative, entry.name].filter(Boolean).join("/");
      assert.ok(!/^\.env(?:\.|$)/u.test(entry.name), "Private env input excluded: " + name);
      assert.ok(!entry.isSymbolicLink(), "Unreviewed linked input: " + name);
      if (entry.isDirectory()) {
        if (!(skipNestedNodeModules && entry.name === "node_modules")) await walk(name);
      }
      else {
        assert.ok(entry.isFile(), "Non-file input: " + name);
        const bytes = await safeFile(base, name);
        files.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  await walk(prefix);
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { files };
}
const input = JSON.parse(await safeFile(here, "inputs.json"));
const resume = JSON.parse(await safeFile(here, "resume-a2.inputs.json"));
const recovery = JSON.parse(await safeFile(here, "writer-recover-a3.inputs.json"));
assert.equal(input.schemaVersion, 1);
assert.equal(resume.schemaVersion, 1);
assert.equal(resume.kind, "resume-only-external-public-compile");
assert.equal(resume.expectedBase, input.expectedBase);
assert.equal(resume.priorAttempt, "actual-a1");
assert.equal(resume.nextAttempt, "actual-a2");
assert.equal(resume.originalGateSha256, "2006140b1b7394144987adbecfe3fc8f9394dbc274054808a143bd1ef6e069e7");
assert.deepEqual(resume.repair, { path: "data/article-book-writer-identity-aliases.json", bytes: 2129,
  sha256: "8fa64e64f45cda8969165409b498fdaf27a3d5c8a70a6ada915d766282e79648" });
assert.match(input.expectedBase ?? "", /^[a-f0-9]{40}$/u);
assert.equal(recovery.schemaVersion, 1);
assert.equal(recovery.kind, "writer-only-current-compiled-public-recovery");
assert.equal(recovery.priorAttempt, "actual-a2"); assert.equal(recovery.nextAttempt, "actual-a3");
assert.equal(recovery.compiledSourceCommit, input.expectedBase);
assert.match(recovery.expectedSourceCommit ?? "", /^[a-f0-9]{40}$/u);
assert.notEqual(recovery.expectedSourceCommit, input.expectedBase);
assert.equal(git(["rev-parse", "HEAD"]).trim(), recovery.expectedSourceCommit);
assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim(), "");
assert.equal(path.resolve(recovery.fixManifest.path), path.join(review, "writer-fix/proposal-manifest.json"));
assert.equal(recovery.fixManifest.sha256, "60172db3b163b9188faf2689f5414969190e354ec2bb88f3f0ed0979a6e2d6e2");
const fix = JSON.parse(await pinned(recovery.fixManifest));
const fixChecks = JSON.parse(await pinned(recovery.writerFix.checks)), fixCommit = JSON.parse(await pinned(recovery.writerFix.commit));
const fixSource = JSON.parse(await pinned(recovery.writerFix.currentSourceManifest));
assert.equal(fixChecks.pass, true); assert.equal(fixChecks.test.exitCode, 0); assert.equal(fixChecks.testInvocations, 1);
assert.equal(fixChecks.appTypeScriptInvocations, 0); assert.equal(fixChecks.inputsUnchangedDuringChecks, true);
assert.deepEqual([fixChecks.summary.total, fixChecks.summary.passed, fixChecks.summary.failed, fixChecks.summary.pending, fixChecks.summary.todo], [107, 107, 0, 0, 0]);
assert.equal(fixCommit.pass, true); assert.equal(fixCommit.clean, true); assert.equal(fixCommit.base, input.expectedBase);
assert.equal(fixCommit.checkpoint, recovery.expectedSourceCommit);
assert.equal(fixCommit.checks.sha256, recovery.writerFix.checks.sha256);
assert.equal(fixCommit.currentSourceManifest.sha256, recovery.writerFix.currentSourceManifest.sha256);
const fixCheckRefs = [fixChecks.sourceManifest, fixChecks.sourceAfter, fixChecks.report, fixChecks.test.command, fixChecks.test.stdout, fixChecks.test.stderr];
for (const ref of fixCheckRefs) await pinned(ref);
const changedOwners = ["scripts/mobile/public-locale-review.mjs", "scripts/mobile/write-public-locale-pages.mjs",
  "scripts/mobile/public-locale-review.test.mjs", "scripts/mobile/public-locale-pages.test.mjs"];
assert.equal(fix.state, "FROZEN"); assert.equal(fix.expectedBase, input.expectedBase);
assert.deepEqual(fix.files.map(file => file.target), changedOwners);
const changedOwnerMap = new Map(fix.files.map(file => [file.target, file]));
const first = path.join(review, "actual-a1"), prior = path.join(review, "actual-a2");
assert.equal(await realpath(prior), prior);
const priorWitnesses = new Map();
assert.deepEqual(recovery.priorWitnesses.map(ref => ref.name), ["result.json", "source-before.json", "source-after.json",
  "inputs-before.json", "inputs-after.json", "dependencies-before.json", "dependencies-after.json",
  "output-after.json", "dossier-delivery.json", "compile.json", "copied-inputs-after.json", "prerequisite-inputs.json"]);
for (const ref of recovery.priorWitnesses) {
  assert.equal(path.resolve(ref.path), path.join(prior, ref.name));
  const manifestRef = fix.retainedAttemptReceipts.find(item => path.basename(item.path) === ref.name);
  if (manifestRef) assert.equal(ref.sha256, manifestRef.sha256);
  priorWitnesses.set(ref.name, JSON.parse(await pinned(ref)));
}
const priorResult = priorWitnesses.get("result.json");
assert.equal(priorResult.pass, false);
assert.equal(priorResult.sourceCommit, input.expectedBase);
assert.equal(priorResult.publicCompilesRun, 1);
assert.equal(priorResult.existingCasesPassed, undefined);
assert.equal(priorResult.noindexPreserved, false);
assert.deepEqual(priorResult.raw, []);
assert.equal(priorResult.canonicalSourceAndDependenciesUnchanged, true);
assert.equal(priorResult.originalAttemptRawEvidenceUnchanged, true);
assert.equal(priorResult.failure.message, "invalid-content-inventory");
assert.deepEqual(priorResult.commands.map(command => [command.name, command.exitCode]), [
  ["mentions-compare", 0], ["public-vite-compile", 0], ["public-article-postprocess", 0],
]);
assert.deepEqual(priorWitnesses.get("source-before.json"), priorWitnesses.get("source-after.json"));
assert.deepEqual(priorWitnesses.get("inputs-before.json"), priorWitnesses.get("inputs-after.json"));
assert.deepEqual(priorWitnesses.get("dependencies-before.json"), priorWitnesses.get("dependencies-after.json"));
const retainedOutput = priorWitnesses.get("output-after.json"); assert.equal(retainedOutput.files.length, 8473);
const dossier = priorWitnesses.get("dossier-delivery.json"); assert.equal(dossier.checked, 659); assert.deepEqual(dossier.issues, []);
const priorInputs = priorWitnesses.get("inputs-after.json"), priorInputMap = new Map(priorInputs.map(file => [file.path, file]));
const priorProjectInputs = priorWitnesses.get("copied-inputs-after.json");
assert.deepEqual(priorProjectInputs, priorWitnesses.get("prerequisite-inputs.json"));
assert.deepEqual(priorInputMap.get(resume.repair.path), resume.repair);
assert.deepEqual(priorProjectInputs.find(file => file.path === resume.repair.path), resume.repair);
assert.deepEqual(priorResult.resumedFrom.witnesses, resume.priorWitnesses);
const firstWitnesses = new Map();
for (const ref of resume.priorWitnesses) {
  assert.equal(path.resolve(ref.path), path.join(first, ref.name)); firstWitnesses.set(ref.name, JSON.parse(await pinned(ref)));
}
const firstResult = firstWitnesses.get("result.json");
assert.equal(firstResult.pass, false); assert.equal(firstResult.publicCompilesRun, 0); assert.equal(firstResult.existingCasesPassed, undefined);
assert.equal(firstResult.canonicalSourceAndDependenciesUnchanged, true);
assert.match(firstResult.failure.message, /^Prerequisite\/run failed: mentions-compare/u);
const priorCommandLogs = [];
for (const [attempt, record] of [[first, firstResult], [prior, priorResult]]) for (const command of record.commands) {
  assert.equal(await realpath(command.executable), await realpath(process.execPath));
  assert.equal(path.resolve(command.cwd), path.join(attempt, "vite-cache"));
  for (const stream of ["stdout", "stderr"]) {
    assert.equal(command[stream].path, "commands/" + command.name + "." + stream + ".txt");
    const ref = { path: path.join(attempt, command[stream].path), sha256: command[stream].sha256 };
    await pinned(ref); priorCommandLogs.push(ref);
  }
}
const { stagingSourceSnapshot, STAGING_SOURCE_ROOTS } = await moduleAt("scripts/mobile/pwa-staging-package.mjs");
const sourceBefore = await stagingSourceSnapshot(root);
assert.equal(sourceBefore.sourceCommit, recovery.expectedSourceCommit);
assert.deepEqual(sourceBefore, fixSource);
assert.equal(STAGING_SOURCE_ROOTS.length, 13);
const qualifiedSourceFiles = sourceBefore.files.map(file => {
  const changed = changedOwnerMap.get(file.path);
  if (!changed) return file;
  assert.equal(file.sha256, changed.proposed.sha256); return { ...file, sha256: changed.original.sha256 };
});
assert.deepEqual(qualifiedSourceFiles, priorWitnesses.get("source-after.json").files, "Changes exceed the four fixed Node owners");
assert.equal(changedOwners.filter(name => sourceBefore.files.some(file => file.path === name)).length, 4);
const require = createRequire(path.join(root, "package.json"));
const { load } = require("cheerio");
for (const helper of priorResult.helperPins) assert.equal(sha(await safeFile(here, helper.path)), helper.sha256);
assert.equal(sha(await safeFile(here, "gate.mjs")), resume.originalGateSha256);
const helperNames = ["gate-writer-recover-a3.mjs", "gate-resume-a2.mjs", "gate.mjs", "compile.mjs", "public.config.mjs", "public-fixtures.mjs", "inputs.json", "resume-a2.inputs.json", "writer-recover-a3.inputs.json"];
const helperBefore = await Promise.all(helperNames.map(async name => ({ path: name, sha256: sha(await safeFile(here, name)) })));
async function inputsSnapshot(source) {
  // Reuse hashes just measured by this phase's genuine source snapshot; public rows are measured once per phase.
  const rows = new Map(await Promise.all(source.files.map(async file => {
    const priorRow = priorInputMap.get(file.path);
    assert.ok(priorRow);
    const changed = changedOwnerMap.get(file.path);
    if (!changed) { assert.equal(file.sha256, priorRow.sha256); return [file.path, { ...priorRow }]; }
    assert.equal(file.sha256, changed.proposed.sha256);
    const bytes = await safeFile(root, file.path); assert.equal(sha(bytes), file.sha256);
    return [file.path, { path: file.path, bytes: bytes.length, sha256: file.sha256 }];
  })));
  for (const prefix of ["public", "apps/admin/catalog-assets"]) {
    for (const file of (await tree(root, prefix)).files) rows.set(file.path, file);
  }
  for (const name of ["reports/public-image-delivery.json", "playwright.config.mjs", resume.repair.path]) {
    const bytes = await safeFile(root, name);
    rows.set(name, { path: name, bytes: bytes.length, sha256: sha(bytes) });
  }
  return [...rows.keys()].sort().map(name => rows.get(name));
}
const inputsBefore = await inputsSnapshot(sourceBefore);
assert.deepEqual(inputsBefore.map(file => changedOwnerMap.has(file.path) ? priorInputMap.get(file.path) : file),
  priorInputs, "Compiled source/public input changes exceed the four fixed Node owners");
assert.deepEqual(inputsBefore.find(file => file.path === resume.repair.path), resume.repair);
async function dependenciesSnapshot() {
  // Bind installed compiler/helper packages and source imports, without traversing unused workspace/Next packages.
  const ts = require("typescript");
  const seeds = new Set(["vite", "@vitejs/plugin-react", "vitest", "typescript", "esbuild", "sharp", "cheerio", "@playwright/test"]);
  const builtins = new Set(builtinModules.flatMap(name => [name, "node:" + name]));
  const packageName = specifier => {
    if (typeof specifier !== "string" || /^[.#/]/u.test(specifier) || specifier.startsWith("@/") || builtins.has(specifier)) return null;
    return specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  };
  for (const file of sourceBefore.files.filter(item => item.path.startsWith("src/")
    && /\.(?:tsx?|m?js)$/u.test(item.path) && !/\.(?:test|spec)\./u.test(item.path))) {
    const bytes = await safeFile(root, file.path); assert.equal(sha(bytes), file.sha256);
    const syntax = ts.createSourceFile(file.path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true,
      file.path.endsWith("tsx") ? ts.ScriptKind.TSX : file.path.endsWith("js") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const add = literal => { if (literal && ts.isStringLiteralLike(literal)) { const name = packageName(literal.text); if (name) seeds.add(name); } };
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(node.expression) && node.expression.text === "require")) add(node.arguments[0]);
      ts.forEachChild(node, visit);
    };
    visit(syntax);
  }
  async function locate(name, importer = "") {
    assert.match(name, /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/u);
    let parent = path.join(root, importer);
    while (true) {
      const relative = portable(path.relative(root, path.join(parent, "node_modules", name)));
      try { await lstat(path.join(root, relative, "package.json")); return relative; }
      catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error; }
      if (parent === root) return null;
      const next = path.dirname(parent);
      assert.ok(next === root || !path.relative(root, next).startsWith(".." + path.sep));
      parent = next;
    }
  }
  const packages = new Set(), missingOptional = new Set(), pending = [];
  for (const name of [...seeds].sort()) {
    const found = await locate(name); assert.ok(found, "Required installed source/tool package absent: " + name); pending.push(found);
  }
  while (pending.length) {
    const relative = pending.shift(); if (packages.has(relative)) continue;
    assert.ok(!(await lstat(path.join(root, relative))).isSymbolicLink(), "Linked dependency package: " + relative);
    const metadata = JSON.parse(await safeFile(root, relative + "/package.json"));
    packages.add(relative);
    const optional = metadata.optionalDependencies ?? {};
    const names = new Set([...Object.keys(metadata.dependencies ?? {}), ...Object.keys(optional), ...Object.keys(metadata.peerDependencies ?? {})]);
    for (const name of names) {
      const found = await locate(name, relative);
      if (found) pending.push(found);
      else if (name in optional || !(name in (metadata.dependencies ?? {}))) missingOptional.add(relative + ":" + name);
      else throw new Error("Required installed dependency absent: " + relative + ":" + name);
    }
  }
  const rows = new Map();
  for (const relative of [...packages].sort()) {
    for (const file of (await tree(root, relative, true)).files) rows.set(file.path, file);
  }
  const admin = path.join(root, "node_modules/@probpera/admin");
  assert.ok((await lstat(admin)).isSymbolicLink());
  assert.equal(await realpath(admin), await realpath(path.join(root, "apps/admin")));
  return { seeds: [...seeds].sort(), packages: [...packages].sort(), missingOptional: [...missingOptional].sort(),
    files: [...rows.values()].sort((a, b) => a.path.localeCompare(b.path, "en")),
    excludedAdminJunction: { path: "node_modules/@probpera/admin", target: await realpath(admin), traversed: false } };
}
const dependenciesBefore = await dependenciesSnapshot();
assert.deepEqual(dependenciesBefore, priorWitnesses.get("dependencies-after.json"), "Retained compile installed dependency drift");
const compile = priorWitnesses.get("compile.json");
const compileRef = recovery.priorWitnesses.find(ref => ref.name === "compile.json");
assert.equal(compileRef.sha256, fix.retainedCompile.sha256);
const graphIds = [...compile.modules.flatMap(module => [module.id, ...(module.importedIds ?? []), ...(module.dynamicallyImportedIds ?? [])]),
  ...compile.resolved.configFileDependencies, ...compile.resolved.outputs.flatMap(output => [...(output.modules ?? []), ...(output.imports ?? []), ...(output.dynamicImports ?? [])])]
  .filter(id => typeof id === "string");
for (const id of graphIds) {
  const normalized = id.replaceAll("\\", "/").split("?")[0];
  assert.ok(!changedOwners.some(owner => normalized === owner || normalized.endsWith("/" + owner)), "Changed owner is a compile dependency");
}
const knownCompileInputs = new Set([...priorInputs, ...dependenciesBefore.files].map(file => path.join(root, file.path)));
for (const module of compile.modules) {
  if (module.id.startsWith("\0")) continue;
  const filename = module.id.split("?")[0];
  if (path.isAbsolute(filename)) assert.ok(knownCompileInputs.has(path.resolve(filename)), "Unbound retained compile module");
}
assert.equal(inputsBefore.find(file => file.path === "vite.config.ts").sha256, fix.viteConfig.sha256);
async function pinned(ref) {
  assert.ok(path.isAbsolute(ref.path)); assert.match(ref.sha256 ?? "", /^[a-f0-9]{64}$/u);
  const relative = path.relative(visual, ref.path);
  assert.ok(relative && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
  const bytes = await safeFile(visual, portable(relative)); assert.equal(sha(bytes), ref.sha256); return bytes;
}
const typecheckSource = JSON.parse(await pinned(input.appTypecheck.sourceManifest));
assert.deepEqual(typecheckSource.files, qualifiedSourceFiles, "D252 app input changes exceed four Node-only owners");
const typecheckReceipt = JSON.parse(await pinned(input.appTypecheck.receipt));
assert.equal(typecheckReceipt.pass, true);
assert.equal(typecheckReceipt.tsc.exitCode, 0);
assert.equal(typecheckReceipt.appTypeScriptInvocations, 1);
assert.equal(path.resolve(typecheckReceipt.sourceManifest.path), path.resolve(input.appTypecheck.sourceManifest.path));
assert.equal(typecheckReceipt.sourceManifest.sha256, input.appTypecheck.sourceManifest.sha256);
const tscCommand = JSON.parse(await pinned(typecheckReceipt.tsc.command));
assert.equal(await realpath(tscCommand.cwd), root);
assert.equal(await realpath(tscCommand.executable), await realpath(process.execPath));
assert.deepEqual(tscCommand.args, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json", "--noEmit"]);
assert.equal((await pinned(typecheckReceipt.tsc.stdout)).length, 0);
assert.equal((await pinned(typecheckReceipt.tsc.stderr)).length, 0);
const tsconfig = JSON.parse(await safeFile(root, "tsconfig.json"));
assert.equal(tsconfig.compilerOptions.noEmit, true); assert.deepEqual(tsconfig.include, ["src"]); assert.deepEqual(tsconfig.references, []);
assert.equal(sha(await safeFile(root, "tsconfig.json")), fix.appTypecheckQualification.tsconfigSha256);
const originalCases = await safeFile(root, "tests/e2e/public-locales.spec.mjs");
const importLine = 'import { expect, test } from "@playwright/test";';
assert.equal(originalCases.toString("utf8").split(importLine).length, 2);
const fixtureLine = "import { expect, test } from " + JSON.stringify(pathToFileURL(path.join(here, "public-fixtures.mjs")).href) + ";";
const derivedCases = originalCases.toString("utf8").replace(importLine, fixtureLine);
assert.equal(derivedCases.replace(fixtureLine, importLine), originalCases.toString("utf8"));
const expectedTitles = [
  "public RU/EN shells have matching metadata before JavaScript",
  "public locale switching keeps the globe and country while updating route metadata",
];
assert.deepEqual([...derivedCases.matchAll(/test\("([^"]+)"/gu)].map(match => match[1]), expectedTitles);

const project = path.join(first, "project"), output = path.join(project, "dist");
for (const directory of [project, output]) {
  assert.equal(await realpath(directory), directory); assert.ok(!(await lstat(directory)).isSymbolicLink());
}
for (const file of priorProjectInputs) assert.equal(sha(await safeFile(project, file.path)), file.sha256, "A2 copied input drift");
for (const base of [project, first, prior]) {
  const link = path.join(base, "node_modules"); assert.ok((await lstat(link)).isSymbolicLink());
  assert.equal(await realpath(link), await realpath(path.join(root, "node_modules")));
}
const actual = path.join(review, "actual-a3");
await mkdir(actual);
const cache = path.join(actual, "vite-cache");
for (const name of [cache, path.join(actual, "commands"), path.join(actual, "cases"), path.join(actual, "raw")]) await mkdir(name);
const writeActual = (name, value) => writeFile(path.join(actual, name), value, { flag: "wx" });
await writeActual("source-before.json", json(sourceBefore));
await writeActual("inputs-before.json", json(inputsBefore));
await writeActual("dependencies-before.json", json(dependenciesBefore));
const result = {
  schemaVersion: 1, kind: "current-public-compiled-local-working-validation", attempt: "actual-a3", sourceCommit: recovery.expectedSourceCommit,
  compiledSourceCommit: input.expectedBase,
  resumedFrom: { attempt: "actual-a2", witnesses: recovery.priorWitnesses, priorResultPass: false, priorPublicCompilesRun: 1,
    priorCasesPassed: 0, projectReused: project, retainedOutputFiles: 8473, freshProjectClaimed: false },
  retainedCompile: { ...compileRef, sourceCommit: input.expectedBase, executedInThisAttempt: false, changedNodeOwners: changedOwners,
    runtimeInputsEquivalent: true, recordedModuleIdsChecked: graphIds.length, wholeThirteenRootEqualityClaimed: false },
  reusedPrerequisites: priorResult.reusedPrerequisites,
  reusedCommands: priorResult.commands.map(command => ({ ...command, attempt: "actual-a2", executedInThisAttempt: false,
    stdout: { ...command.stdout, path: path.join(prior, command.stdout.path) },
    stderr: { ...command.stderr, path: path.join(prior, command.stderr.path) } })),
  reusedDossierAudit: { ...recovery.priorWitnesses.find(ref => ref.name === "dossier-delivery.json"), checked: dossier.checked, executedInThisAttempt: false },
  nodeOnlyFix: recovery.fixManifest, changedNodeOwners: changedOwners,
  writerFixEvidence: recovery.writerFix, writerFixTestsReused: { passed: 107, total: 107, executedInThisAttempt: false },
  pass: false, stageAccepted: false, releaseReady: false, editorialApproved: false, publicDeployed: false,
  productionEdgeAccepted: false, providerActivated: false, nativeInstalled: false,
  sourceRoots: STAGING_SOURCE_ROOTS, extraInputRoots: ["public", "apps/admin/catalog-assets", "reports/public-image-delivery.json", "playwright.config.mjs", resume.repair.path],
  helperPins: helperBefore, appTypecheckReused: input.appTypecheck, appTypechecksRun: 0,
  appTypecheckQualification: { include: ["src"], exactAppInputEquivalence: true, historicalEvidenceOnly: true,
    excludedChangedNodeOwners: changedOwners, wholeThirteenRootEqualityClaimed: false, currentApplicationTypecheckClaimed: false },
  packageBuildRun: false, cmsExportsRun: 0, publicCompilesRun: 0, pwaBuildsRun: 0,
  nativeSandboxClaimed: false, dependencyAdminJunctionTraversed: false, commands: [], raw: [],
  originalCaseSha256: sha(originalCases), derivedCaseSha256: sha(derivedCases), testBodiesUnchanged: true,
  capturesReviewed: false, noindexPreserved: false,
};
const envBase = {};
for (const key of ["PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "USERPROFILE", "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)"]) {
  if (process.env[key] !== undefined) envBase[key] = process.env[key];
}
Object.assign(envBase, {
  TEMP: actual, TMP: actual, NODE_ENV: "production",
  PUBLIC_SITE_ORIGIN: "https://probpera.ru", PUBLIC_SITE_BASE_PATH: "/",
  PUBLIC_SITE_URL: "https://probpera.ru", VITE_PUBLIC_SITE_URL: "https://probpera.ru",
});
async function run(name, args, extra = {}) {
  const record = { name, executable: process.execPath, args, cwd: cache };
  result.commands.push(record);
  let outcome;
  try { outcome = { ...(await promisify(execFile)(process.execPath, args, { cwd: cache, windowsHide: true,
    timeout: 600000, maxBuffer: 32 * 1024 * 1024, env: { ...envBase, ...extra } })), exitCode: 0 }; }
  catch (error) { outcome = { stdout: error.stdout ?? "", stderr: error.stderr ?? "", exitCode: error.code, failure: error.message }; }
  for (const stream of ["stdout", "stderr"]) {
    const filename = "commands/" + name + "." + stream + ".txt";
    await writeActual(filename, outcome[stream]); record[stream] = { path: filename, sha256: sha(outcome[stream]) };
  }
  record.exitCode = outcome.exitCode; assert.equal(outcome.exitCode, 0, "Prerequisite/run failed: " + name);
}
let server;
let projectInputs = priorProjectInputs;
try {
  // Copy exactly the four reviewed current Node owners into the existing external project; no canonical write.
  for (const file of fix.files) {
    const bytes = await safeFile(root, file.target); assert.equal(sha(bytes), file.proposed.sha256);
    assert.equal(sha(await safeFile(project, file.target)), file.original.sha256);
    await writeFile(path.join(project, file.target), bytes);
  }
  projectInputs = priorProjectInputs.map(file => changedOwnerMap.has(file.path) ? inputsBefore.find(input => input.path === file.path) : file);
  assert.deepEqual(projectInputs.map(file => changedOwnerMap.has(file.path) ? priorProjectInputs.find(prior => prior.path === file.path) : file), priorProjectInputs);
  await symlink(path.join(root, "node_modules"), path.join(actual, "node_modules"), "junction");
  for (const file of projectInputs) assert.equal(sha(await safeFile(project, file.path)), file.sha256,
    "Current copied Node fix/input mismatch: " + file.path);
  await writeActual("prerequisite-inputs.json", json(projectInputs));
  // The genuine writer requires a directory inside its own root. This byte-identical source copy satisfies that gate.
  const { writePublicLocalePages, capturePublicLocaleSourceSnapshot } = await import(pathToFileURL(path.join(project, "scripts/mobile/write-public-locale-pages.mjs")).href);
  const compiledSnapshot = await capturePublicLocaleSourceSnapshot({ directory: output });
  // The genuine exhaustive capture measures the retained base once; the copy record is virtual, not an output file.
  const baseOutput = { files: [...compiledSnapshot.assets, ...compiledSnapshot.content,
    { path: "index.html", ...compiledSnapshot.builtHtml }].sort((a, b) => a.path.localeCompare(b.path, "en")) };
  assert.deepEqual(baseOutput, retainedOutput, "Retained compiled/postprocessed output drift");
  await writeActual("output-initial.json", json(baseOutput)); result.retainedOutputAuthenticated = true;
  await writeActual("compiled-source-snapshot.json", json(compiledSnapshot));
  const manifest = await writePublicLocalePages({ directory: output });
  assert.equal(manifest.releaseReady, false); assert.equal(manifest.sitemap.reviewGate.indexingAllowed, false);
  assert.deepEqual(manifest.sitemap.entries, []);
  for (const item of manifest.artifacts) assert.equal(item.indexable, false);
  const outputBefore = await tree(output);
  const outputMap = new Map(outputBefore.files.map(file => [file.path, file]));
  for (const file of baseOutput.files) assert.deepEqual(outputMap.get(file.path), file, "Writer changed base compiled input");
  result.writerManifest = manifest; result.noindexPreserved = true;
  result.rootXmlGraphChecked = manifest.checkedSitemaps;
  await writeActual("output-before.json", json(outputBefore));
  const { createLocalizedNotFoundHandler } = await moduleAt("server/public-locales/handler.mjs");
  const logicalOrigin = "https://probpera.ru";
  const documents = Object.fromEntries(await Promise.all(["ru", "en"].map(async locale =>
    [locale, (await safeFile(output, locale + "/404.html")).toString("utf8")])));
  const mime = name => ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".xml": "application/xml; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
    ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".wasm": "application/wasm" }[path.extname(name)] ?? "application/octet-stream");
  const handler = createLocalizedNotFoundHandler({ documents, securityHeaders: {} }, async request => {
    const url = new URL(request.url); assert.equal(url.origin, logicalOrigin);
    let name = decodeURIComponent(url.pathname).slice(1);
    if (!name || name.endsWith("/")) name += "index.html";
    const file = outputMap.get(name), fallback = outputMap.get("404.html");
    const selected = file ?? fallback; assert.ok(selected);
    const bytes = await safeFile(output, selected.path); assert.equal(sha(bytes), selected.sha256);
    return new Response(request.method === "HEAD" ? null : bytes, { status: file ? 200 : 404,
      headers: { "content-type": mime(selected.path), "content-length": String(bytes.length), "cache-control": "no-store" } });
  });
  server = http.createServer(async (request, response) => {
    try {
      assert.ok(["GET", "HEAD"].includes(request.method)); assert.ok(result.raw.length < 5000);
      const logical = new Request(logicalOrigin + request.url, { method: request.method, headers: request.headers });
      const outgoing = await handler(logical), bytes = Buffer.from(await outgoing.arrayBuffer());
      const record = { method: request.method, pathname: new URL(logical.url).pathname, status: outgoing.status,
        headers: Object.fromEntries(outgoing.headers), bytes: bytes.length, sha256: sha(bytes) };
      result.raw.push(record);
      if (/^\/(?:sitemap\.xml|(?:ru|en)\/(?:$|structured-data\.json$|sitemap\.preparation\.json$|__d253_missing__$))/u.test(record.pathname)) {
        record.bodyPath = "raw/response-" + String(result.raw.length).padStart(4, "0") + ".body";
        await writeActual(record.bodyPath, bytes);
      }
      response.writeHead(outgoing.status, Object.fromEntries(outgoing.headers)); response.end(bytes);
    } catch (error) {
      result.transportFailure ??= error.message; response.writeHead(500); response.end("Local QA transport failed");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseURL = "http://127.0.0.1:" + server.address().port;
  await writeActual("cases/public-locales.spec.mjs", derivedCases);
  await run("public-locales-two-existing-cases", [require.resolve("@playwright/test/cli"), "test", "--config", path.join(here, "public.config.mjs")], {
    D253_CANONICAL_ROOT: root, D253_PUBLIC_ORIGIN: baseURL, D253_CASE_DIRECTORY: path.join(actual, "cases"),
    D253_PUBLIC_OUTPUT: path.join(actual, "playwright-output"), D253_PUBLIC_REPORT: path.join(actual, "playwright.json"),
  });
  const report = JSON.parse(await safeFile(actual, "playwright.json"));
  const cases = [];
  const visit = suites => { for (const suite of suites) { cases.push(...(suite.specs ?? [])); visit(suite.suites ?? []); } };
  visit(report.suites);
  assert.deepEqual(cases.map(item => item.title).sort(), [...expectedTitles].sort());
  for (const item of cases) { assert.equal(item.tests.length, 1); assert.deepEqual(item.tests[0].results.map(entry => entry.status), ["passed"]); }
  assert.equal(report.stats.expected, 2); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0);
  const attachments = cases.flatMap(item => item.tests[0].results[0].attachments ?? [])
    .filter(item => ["current public EN final", "local network fence"].includes(item.name));
  assert.equal(attachments.filter(item => item.name === "current public EN final").length, 1);
  result.captureAndNetworkEvidence = [];
  for (const item of attachments) {
    assert.ok(path.isAbsolute(item.path));
    const relative = path.relative(actual, item.path); assert.ok(relative && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
    const bytes = await safeFile(actual, portable(relative));
    result.captureAndNetworkEvidence.push({ name: item.name, path: item.path, bytes: bytes.length, sha256: sha(bytes) });
  }
  result.existingCasesPassed = 2;
  // Retained D249 oracle, now exercised against the actual current compiled output.
  for (const locale of ["ru", "en"]) {
    for (const filename of ["structured-data.json", "sitemap.preparation.json"]) {
      const response = await fetch(baseURL + "/" + locale + "/" + filename); assert.equal(response.status, 200);
      const value = await response.json();
      if (filename === "structured-data.json") assert.ok(value["@graph"].every(node => node.inLanguage === locale));
      else { assert.equal(value.locale, locale); assert.equal(value.reviewGate.indexingAllowed, false); assert.deepEqual(value.indexableEntries, []); }
    }
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(baseURL + "/" + locale + "/__d253_missing__", { method });
      assert.equal(response.status, 404); assert.equal(response.headers.get("content-language"), locale);
      assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
      const body = await response.text();
      if (method === "HEAD") assert.equal(body, "");
      else {
        assert.equal(body, documents[locale]); const $ = load(body);
        assert.equal($("html").attr("lang"), locale); assert.equal($("body").attr("lang"), locale); assert.equal($("script").length, 0);
      }
    }
  }
  assert.equal(result.transportFailure, undefined);
  result.pass = true;
  result.artifactDirectory = output;
} catch (error) {
  result.failure = { name: error.name, message: error.message }; process.exitCode = 1;
} finally {
  if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  try {
    const sourceAfter = await stagingSourceSnapshot(root), inputsAfter = await inputsSnapshot(sourceAfter), dependenciesAfter = await dependenciesSnapshot();
    await writeActual("source-after.json", json(sourceAfter)); await writeActual("inputs-after.json", json(inputsAfter));
    await writeActual("dependencies-after.json", json(dependenciesAfter));
    assert.deepEqual(sourceAfter, sourceBefore); assert.deepEqual(inputsAfter, inputsBefore); assert.deepEqual(dependenciesAfter, dependenciesBefore);
    for (const file of projectInputs) assert.equal(sha(await safeFile(project, file.path)), file.sha256, "Copied source/input drift: " + file.path);
    await writeActual("copied-inputs-after.json", json(projectInputs));
    for (const base of [project, first, prior, actual]) {
      const link = path.join(base, "node_modules"); assert.ok((await lstat(link)).isSymbolicLink());
      assert.equal(await realpath(link), await realpath(path.join(root, "node_modules")));
    }
    for (const helper of helperBefore) assert.equal(sha(await safeFile(here, helper.path)), helper.sha256);
    for (const ref of [...resume.priorWitnesses, ...recovery.priorWitnesses, ...priorCommandLogs, recovery.fixManifest,
      ...Object.values(recovery.writerFix), ...fixCheckRefs]) await pinned(ref);
    result.originalAttemptsRawEvidenceUnchanged = true;
    await pinned(input.appTypecheck.sourceManifest); await pinned(input.appTypecheck.receipt);
    await pinned(typecheckReceipt.tsc.command); await pinned(typecheckReceipt.tsc.stdout); await pinned(typecheckReceipt.tsc.stderr);
    assert.equal(git(["rev-parse", "HEAD"]).trim(), recovery.expectedSourceCommit);
    assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim(), "");
    let verifiedOutputAfter;
    if (result.noindexPreserved) {
      const before = JSON.parse(await safeFile(actual, "output-before.json")), after = await tree(output);
      assert.deepEqual(after, before); result.outputUnchangedAfterValidation = true; verifiedOutputAfter = after;
    }
    await writeActual("output-after.json", json(verifiedOutputAfter ?? await tree(output)));
    result.canonicalSourceAndDependenciesUnchanged = true;
  } catch (error) { result.pass = false; result.failure ??= { name: error.name, message: error.message }; process.exitCode = 1; }
  await writeActual("result.json", json(result));
  console.log(json({ pass: result.pass, publicCompilesRun: result.publicCompilesRun, casesPassed: result.existingCasesPassed, failure: result.failure }));
}
