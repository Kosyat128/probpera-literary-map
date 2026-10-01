import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, writeFile, readFile, readdir, lstat, realpath, rm, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_SMOKE_SUITES, preparePwaStaging, stagingSourceSnapshot } from "./pwa-staging-package.mjs";
import { parsePwaStagingArgs } from "./prepare-pwa-staging.mjs";

const roots = [];
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const head = "2".repeat(40), originalHead = "1".repeat(40), buildId = "a".repeat(64);
const draft = { $schema: "../../node_modules/wrangler/config-schema.json", name: "literary-planet-v12-preparation", main: "worker.ts",
  compatibility_date: "2026-09-05", compatibility_flags: ["nodejs_compat"], workers_dev: false, preview_urls: false, vars: {},
  assets: { directory: "../../dist-pwa", binding: "ASSETS", run_worker_first: true, html_handling: "none", not_found_handling: "none" }, observability: { enabled: false } };
afterEach(async () => {
  for (const entry of roots.splice(0)) {
    if (path.dirname(entry.root) !== entry.parent || !path.basename(entry.root).startsWith("pwa-staging-test-") || await realpath(entry.root) !== entry.root) throw new Error("Unsafe fixture cleanup");
    await rm(entry.root, { recursive: true, force: true });
  }
});
async function fixture() {
  const parent = await realpath(tmpdir()), root = await mkdtemp(path.join(parent, "pwa-staging-test-"));
  roots.push({ root, parent });
  const write = async (name, bytes) => { const filename = path.join(root, name); await mkdir(path.dirname(filename), { recursive: true }); await writeFile(filename, bytes); };
  const sourceNames = [...LOCAL_SMOKE_SUITES, "server/planet/worker.ts", "server/planet/wrangler.draft.jsonc", "package.json", "package-lock.json"].sort();
  for (const name of sourceNames) await write(name, name.endsWith(".jsonc") ? json(draft) : name.endsWith(".json") ? "{}\n" : "// Synthetic source; no actual provider or test execution.\n");
  const runGit = (_root, args) => args[0] === "ls-files" ? sourceNames.join("\0") + "\0" : args[0] === "rev-parse" ? head : "";
  const current = await stagingSourceSnapshot(root, runGit);
  const original = { ...current, sourceCommit: originalHead };
  const assets = { "index.html": Buffer.from("<html>synthetic preparation</html>"), "sw.js": Buffer.from("// synthetic fixture") };
  const artifact = { schemaVersion: 1, kind: "literary-planet-controlled-pwa-preparation", sourceCommit: head, buildId,
    profile: "SAFE_PAID_BILINGUAL_V1", commercialModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES", scopePath: "/planet/", requiredLocales: ["ru", "en"],
    releaseReady: false, productionActionsAuthorized: false, localQaAuthority: false, sourceInputs: { files: current.files },
    inventory: Object.entries(assets).map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) })) };
  for (const [name, bytes] of Object.entries(assets)) await write("dist-pwa/" + name, bytes);
  const verification = { pass: true, releaseReady: false, findings: [], identity: { sourceCommit: head, buildId, localQaAuthority: false } };
  const smoke = { success: true, numTotalTestSuites: 8, numPassedTestSuites: 8, numFailedTestSuites: 0, numPendingTestSuites: 0,
    numTotalTests: 4, numPassedTests: 4, numFailedTests: 0, numPendingTests: 0, numTodoTests: 0,
    testResults: LOCAL_SMOKE_SUITES.map(name => ({ name: path.join(root, name), status: "passed", assertionResults: [{ status: "passed", fullName: "synthetic receipt fixture" }] })) };
  const reference = async (name, value) => { const bytes = typeof value === "string" ? value : json(value); await write(name, bytes); return { path: name, sha256: sha(bytes) }; };
  const receipt = { schemaVersion: 1, kind: "planet-local-preparation-validation", sourceCommit: head, localOnly: true, stagingValidated: false, providerValidated: false, exitCode: 0,
    artifact: await reference("dist-pwa/artifact.json", artifact), pwaReport: await reference(".tmp/proofs/pwa.json", verification),
    sourceManifest: await reference(".tmp/proofs/original.json", original), currentSourceManifest: await reference(".tmp/proofs/current.json", current),
    smokeReport: await reference(".tmp/proofs/unit.json", smoke), stdout: await reference(".tmp/proofs/stdout.log", ""), stderr: await reference(".tmp/proofs/stderr.log", "") };
  receipt.smokeCommand = ["node", "node_modules/vitest/vitest.mjs", "run", ...LOCAL_SMOKE_SUITES, "--maxWorkers=1", "--reporter=json", "--outputFile=" + receipt.smokeReport.path];
  const options = { rootDir: root, validationRoot: path.join(root, ".tmp"), expectedHead: head, expectedBuildId: buildId, artifactDir: "dist-pwa", outputDir: ".tmp/package", writePackage: false, allowQa: false };
  const refresh = async () => { options.validationReceipt = await reference(".tmp/proofs/receipt.json", receipt); };
  await refresh();
  let bundleCalls = 0;
  const dependencies = { git: runGit, bundle: async () => { bundleCalls++; return { outputFiles: [{ contents: Buffer.from("export default {};") }], metafile: { inputs: { "server/planet/worker.ts": {} } } }; } };
  return { root, options, dependencies, artifact, receipt, smoke, verification, original, current, write, reference, refresh, bundleCalls: () => bundleCalls };
}
const absent = async filename => { try { await lstat(filename); return false; } catch (error) { if (error.code !== "ENOENT") throw error; return true; } };

describe("source-bound local staging preparation", () => {
  it("keeps dry-run read-only, preserves actual original report identity and writes only a closed local package", async () => {
    const f = await fixture();
    const result = await preparePwaStaging(f.options, f.dependencies);
    expect(result.dryRun).toBe(true); expect(result.packageWritten).toBe(false); expect(f.bundleCalls()).toBe(0);
    expect(await absent(path.join(f.root, ".tmp/package"))).toBe(true);
    const written = await preparePwaStaging({ ...f.options, writePackage: true }, f.dependencies);
    expect(written.localSmokeOriginalSourceCommit).toBe(originalHead); expect(written.sourceCommit).toBe(head);
    expect(written.stagingDeploymentExecuted).toBe(false); expect(written.realProviderWebhookValidated).toBe(false); expect(written.releaseReady).toBe(false);
    const config = JSON.parse(await readFile(path.join(f.root, ".tmp/package/wrangler.local-package.json"), "utf8"));
    expect(config.main).toBe("worker.mjs"); expect(config.assets.directory).toBe("./pwa"); expect(config.workers_dev).toBe(false); expect(config.preview_urls).toBe(false);
    expect(config.vars).toEqual({}); expect(config.routes).toBeUndefined(); expect(config.account_id).toBeUndefined();
    expect(await readFile(path.join(f.root, ".tmp/package/source/server/planet/wrangler.draft.jsonc"), "utf8")).toBe(json(draft));
    expect(await readFile(path.join(f.root, ".tmp/package/pwa/index.html"), "utf8")).toBe("<html>synthetic preparation</html>");
    for (const [key, name] of [["pwaReport", "pwa-report.json"], ["smokeReport", "smoke-report.json"], ["stdout", "smoke-stdout.log"], ["stderr", "smoke-stderr.log"]]) {
      const packagedPath = "validation/" + name, original = f.receipt[key];
      const copied = await readFile(path.join(f.root, ".tmp/package", packagedPath));
      expect(copied).toEqual(await readFile(path.join(f.root, original.path)));
      expect(sha(copied)).toBe(original.sha256);
      expect(written.inventory.find(file => file.path === packagedPath).sha256).toBe(original.sha256);
      expect(written.validationMappings.find(file => file.packagedPath === packagedPath)).toEqual({ packagedPath, sha256: original.sha256, originalReference: original });
    }
    await expect(preparePwaStaging({ ...f.options, writePackage: true }, f.dependencies)).rejects.toThrow("OUTPUT_EXISTS");
  });
  it("rejects wrong build and denies QA by default without compiling or writing", async () => {
    const f = await fixture();
    await expect(preparePwaStaging({ ...f.options, expectedBuildId: "b".repeat(64) }, f.dependencies)).rejects.toThrow("WRONG_ARTIFACT");
    f.artifact.localQaAuthority = true; f.verification.identity.localQaAuthority = true;
    f.receipt.artifact = await f.reference("dist-pwa/artifact.json", f.artifact); f.receipt.pwaReport = await f.reference(".tmp/proofs/pwa.json", f.verification); await f.refresh();
    await expect(preparePwaStaging(f.options, f.dependencies)).rejects.toThrow("WRONG_ARTIFACT");
    expect((await preparePwaStaging({ ...f.options, allowQa: true }, f.dependencies)).localQaAuthority).toBe(true);
    expect(f.bundleCalls()).toBe(0); expect(await absent(path.join(f.root, ".tmp/package"))).toBe(true);
  });
  it("rejects stale original and committed validation snapshots even when their ref checksums are genuine", async () => {
    for (const field of ["sourceManifest", "currentSourceManifest"]) {
      const f = await fixture(), manifest = { ...(field === "sourceManifest" ? f.original : f.current), files: f.current.files.slice(1) };
      f.receipt[field] = await f.reference(".tmp/proofs/stale.json", manifest); await f.refresh();
      await expect(preparePwaStaging(f.options, f.dependencies)).rejects.toThrow("STALE_VALIDATION_SOURCE");
      expect(await absent(path.join(f.root, ".tmp/package"))).toBe(true);
    }
  });
  it("rejects skipped assertions and a different test file in an otherwise passing local receipt", async () => {
    for (const mutation of ["skipped", "mixed"]) {
      const f = await fixture();
      if (mutation === "skipped") f.smoke.testResults[0].assertionResults[0].status = "pending";
      else f.smoke.testResults[0].name = path.join(f.root, "server/planet/not-the-required-suite.test.ts");
      f.receipt.smokeReport = await f.reference(".tmp/proofs/unit.json", f.smoke); await f.refresh();
      await expect(preparePwaStaging(f.options, f.dependencies)).rejects.toThrow("FAILED_LOCAL_SMOKE");
      expect(f.bundleCalls()).toBe(0);
    }
  });
  it("rejects traversal and linked evidence and has no deploy/upload/duplicate CLI route", async () => {
    const f = await fixture();
    await expect(preparePwaStaging({ ...f.options, outputDir: "../escape" }, f.dependencies)).rejects.toThrow();
    await f.write("artifacts/keep.txt", "fixture parent");
    const preflightGit = f.dependencies.git;
    await expect(preparePwaStaging({ ...f.options, outputDir: "artifacts/unignored" }, { ...f.dependencies, git: (root, args) => {
      if (args[0] === "check-ignore") throw new Error("not ignored");
      return preflightGit(root, args);
    } })).rejects.toThrow("UNIGNORED_OUTPUT");
    expect(await absent(path.join(f.root, "artifacts/unignored"))).toBe(true);
    await symlink(path.join(f.root, ".tmp/proofs"), path.join(f.root, ".tmp/linked"), "junction");
    f.options.validationReceipt = { ...f.options.validationReceipt, path: ".tmp/linked/receipt.json" };
    await expect(preparePwaStaging(f.options, f.dependencies)).rejects.toThrow("LINKED_INPUT");
    expect(() => parsePwaStagingArgs(["--deploy"])).toThrow("INVALID_COMMAND");
    expect(() => parsePwaStagingArgs(["--confirm-draft-upload"])).toThrow("INVALID_COMMAND");
    expect(() => parsePwaStagingArgs(["--write-package", "--write-package"])).toThrow("INVALID_COMMAND");
    const cliLink = path.join(f.root, ".tmp/cli-linked");
    await symlink(path.dirname(fileURLToPath(import.meta.url)), cliLink, process.platform === "win32" ? "junction" : "dir");
    const beforeRoot = await readdir(f.root), beforeTmp = await readdir(path.join(f.root, ".tmp"));
    const cli = spawnSync(process.execPath, [path.join(cliLink, "prepare-pwa-staging.mjs"), "--deploy"], { cwd: f.root, encoding: "utf8", timeout: 10_000, windowsHide: true });
    expect(cli.error).toBeUndefined(); expect(cli.status).toBe(1);
    expect(JSON.parse(cli.stdout.trim())).toEqual({ pass: false, code: "INVALID_COMMAND", productionActionsAuthorized: false, releaseReady: false });
    expect(await readdir(f.root)).toEqual(beforeRoot); expect(await readdir(path.join(f.root, ".tmp"))).toEqual(beforeTmp);
    expect(await absent(path.join(f.root, ".tmp/package"))).toBe(true);
  });
  it("detects source changes during validation, bundling and final assembly without a false success marker", async () => {
    const f = await fixture(), bundle = f.dependencies.bundle;
    f.dependencies.bundle = async options => { await f.write("server/planet/worker.ts", "// concurrent source edit"); return bundle(options); };
    await expect(preparePwaStaging({ ...f.options, writePackage: true }, f.dependencies)).rejects.toThrow("SOURCE_DRIFT");
    expect(await absent(path.join(f.root, ".tmp/package"))).toBe(true);
    const dry = await fixture(), dryGit = dry.dependencies.git;
    let reads = 0;
    dry.dependencies.git = (root, args) => args[0] === "rev-parse" && ++reads >= 3 ? "3".repeat(40) : dryGit(root, args);
    await expect(preparePwaStaging(dry.options, dry.dependencies)).rejects.toThrow("SOURCE_DRIFT");
    expect(dry.bundleCalls()).toBe(0); expect(await absent(path.join(dry.root, ".tmp/package"))).toBe(true);
    for (const mutation of ["head", "dirty"]) {
      const late = await fixture(), lateGit = late.dependencies.git;
      late.dependencies.git = (root, args) => {
        if (existsSync(path.join(late.root, ".tmp/package/worker.mjs"))) {
          if (mutation === "head" && args[0] === "rev-parse") return "3".repeat(40);
          if (mutation === "dirty" && args[0] === "status") return " M package.json\n";
        }
        return lateGit(root, args);
      };
      await expect(preparePwaStaging({ ...late.options, writePackage: true }, late.dependencies)).rejects.toThrow("SOURCE_DRIFT");
      expect(existsSync(path.join(late.root, ".tmp/package/worker.mjs"))).toBe(true);
      expect(await absent(path.join(late.root, ".tmp/package/result.json"))).toBe(true);
    }
  });
});
