import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const expectedRoot = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
if (root.replaceAll("\\", "/") !== expectedRoot) throw new Error("Unexpected workspace");
const args = process.argv.slice(2);
const names = ['--source-commit', '--build-id', '--apk-sha256', '--apk-bytes'];
if (args.length !== 8 || names.some((name, index) => args[index * 2] !== name)
  || !/^[a-f0-9]{40}$/u.test(args[1]) || !/^[a-f0-9]{64}$/u.test(args[3])
  || !/^[a-f0-9]{64}$/u.test(args[5]) || !/^[1-9][0-9]*$/u.test(args[7])
  || !Number.isSafeInteger(Number(args[7]))) {
  throw new Error('Usage: node preserve-android.mjs --source-commit <40hex> --build-id <64hex> --apk-sha256 <64hex> --apk-bytes <positive exact integer>');
}
const sourceCommit = args[1], buildId = args[3], apkHash = args[5], expectedApkBytes = Number(args[7]);
const preserved = `.tmp/native-builds/android-dev/archive-search-${buildId.slice(0, 8)}`;
const evidence = "docs/mobile/evidence/S04/archive-search-android-20260914";
const reports = ".tmp/s10-opposite-locale-android-20260914";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const readJson = async file => JSON.parse((await fs.readFile(file, "utf8")).replace(/^\uFEFF/u, ""));
const safe = relative => {
  const target = path.resolve(root, relative);
  const local = path.relative(root, target);
  if (!local || local.startsWith("..") || path.isAbsolute(local)) throw new Error("Unsafe preservation path");
  return target;
};
const artifactBytes = await fs.readFile("dist-native/artifact.json");
const artifact = JSON.parse(artifactBytes);
const binary = await readJson(`${reports}/android-dev-apk-verification.json`);
const audit = await readJson(`${reports}/native-artifact-audit.json`);
const build = await readJson(`${reports}/build-run.json`);
if (artifact.buildId !== buildId || artifact.sourceCommit !== sourceCommit
  || artifact.platform !== "android" || artifact.channel !== "dev"
  || audit.identity.buildId !== buildId || audit.identity.sourceCommit !== sourceCommit
  || binary.sourceArtifact.buildId !== buildId || binary.sourceArtifact.sourceCommit !== sourceCommit
  || build.buildId !== buildId || build.sourceCommit !== sourceCommit
  || binary.pass !== true || audit.pass !== true || build.pass !== true
  || binary.apk.sha256 !== apkHash || binary.apk.bytes !== expectedApkBytes
  || binary.sourceArtifact.sha256 !== sha(artifactBytes)) throw new Error("Unexpected completed build evidence");
const registryBytes = await fs.readFile(safe('data/book-canon-source-registry.json'));
const registryInputs = artifact.sourceInputs.files.filter(file => file.path === 'data/book-canon-source-registry.json');
if (registryInputs.length !== 1 || registryInputs[0].sha256 !== sha(registryBytes) || build.registrySourceSha256 !== sha(registryBytes)) throw new Error('Canonical registry source provenance differs');
// These directories are unique immutable preservation targets. Never overwrite.
await fs.mkdir(safe(preserved));
await fs.mkdir(safe(`${preserved}/runtime`));
await fs.mkdir(safe(evidence));
const copiedFiles = [];
async function copyExact(source, destination) {
  const stat = await fs.lstat(safe(source));
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Only regular files may be preserved");
  const bytes = await fs.readFile(safe(source));
  await fs.writeFile(safe(destination), bytes, { flag: "wx" });
  const copied = await fs.readFile(safe(destination));
  if (!bytes.equals(copied)) throw new Error("Preserved bytes differ");
  return { source, path: destination, bytes: bytes.length, sha256: sha(bytes) };
}
async function copyRuntime(prefix = "") {
  const entries = await fs.readdir(safe(`dist-native/${prefix}`), { withFileTypes: true });
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error("Linked runtime source is forbidden");
    if (entry.isDirectory()) {
      await fs.mkdir(safe(`${preserved}/runtime/${relative}`));
      await copyRuntime(relative + "/");
    } else if (entry.isFile()) {
      const item = await copyExact(`dist-native/${relative}`, `${preserved}/runtime/${relative}`);
      const expected = artifact.inventory.find(file => file.path === relative);
      if (relative !== "artifact.json" && (!expected || expected.bytes !== item.bytes || expected.sha256 !== item.sha256)) {
        throw new Error("Preserved runtime differs from completed build inventory: " + relative);
      }
      copiedFiles.push({ path: relative, bytes: item.bytes, sha256: item.sha256 });
    } else throw new Error("Non-file runtime source");
  }
}
await copyRuntime();
if (copiedFiles.length !== artifact.inventory.length + 1) throw new Error("Incomplete runtime preservation");
const apk = await copyExact(binary.apk.path, `${preserved}/app-dev-debug.apk`);
if (apk.sha256 !== apkHash || apk.bytes !== expectedApkBytes) throw new Error("APK preservation identity mismatch");
const reportCopies = [];
for (const name of [
  "android-dev-apk-aapt2-badging.txt", "android-dev-apk-locales.txt", "android-dev-apk-manifest.txt",
  "android-dev-apk-signature.txt", "android-dev-apk-verification.json", "android-dev-apk-zip-entries.json",
  "android-dev-apk-zipalign.txt", "build-run.json", "native-artifact-audit.json", "apk-verifier-transcript.json",
]) reportCopies.push(await copyExact(`${reports}/${name}`, `${evidence}/${name}`));
reportCopies.push(await copyExact("dist-native/artifact.json", `${evidence}/native-artifact.json`));
for (const name of ["verify-android.mjs", "build-android.ps1", "preserve-android.mjs"]) {
  reportCopies.push(await copyExact(`.tmp/s10-opposite-locale-search-20260914/${name}`, `${evidence}/${name}`));
}
const transcripts = [];
for (const name of ["native-build.log", "sync-android.log", "assemble-dev-debug.log"]) {
  const bytes = await fs.readFile(safe(`${reports}/${name}`));
  const content = bytes.toString("utf8");
  if (!Buffer.from(content, "utf8").equals(bytes)) throw new Error("Transcript cannot be preserved losslessly as UTF-8");
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{25,}|\bsk-(?:proj-)?[A-Za-z0-9_-]{30,}/u.test(content)) {
    throw new Error("Unexpected sensitive material in build transcript");
  }
  const transcript = { schemaVersion: 1, source: `${reports}/${name}`, originalName: name,
    originalBytes: bytes.length, originalSha256: sha(bytes), encoding: "utf8", content };
  const filename = `${evidence}/${name.replace(/\.log$/u, "-transcript.json")}`;
  const wrapped = Buffer.from(json(transcript));
  await fs.writeFile(safe(filename), wrapped, { flag: "wx" });
  const checked = await readJson(filename);
  if (sha(Buffer.from(checked.content, checked.encoding)) !== checked.originalSha256) throw new Error("Transcript round trip differs");
  transcripts.push({ path: filename, bytes: wrapped.length, sha256: sha(wrapped),
    original: transcript.source, originalBytes: bytes.length, originalSha256: transcript.originalSha256 });
}
const copyVerification = { schemaVersion: 1, checkedAt: new Date().toISOString(),
  scope: "Preservation byte comparison only; original completed builds and audits were not rerun.",
  pass: true, sourceCommit, buildId, runtime: `${preserved}/runtime`,
  artifactSha256: sha(artifactBytes), files: copiedFiles, apk,
  historicalArtifactsOverwritten: false, deviceTested: false, releaseReady: false };
await fs.writeFile(safe(`${evidence}/copy-verification.json`), json(copyVerification), { flag: "wx" });
const result = {
  schemaVersion: 1, recordedAt: new Date().toISOString(), kind: "android-archive-search-dev-apk-preservation",
  status: "BUILD_AND_BINARY_INSPECTION_PASSED", stageAccepted: false, releaseReady: false,
  sourceCommit, buildId, sourceInputsSha256: artifact.sourceInputs.sha256,
  artifact: { path: `${preserved}/runtime`, metadata: `${evidence}/native-artifact.json`, sha256: sha(artifactBytes) },
  apk: { path: apk.path, bytes: apk.bytes, sha256: apk.sha256 },
  validation: {
    sourceBehavior: "docs/mobile/evidence/S10/opposite-locale-search-20260914",
    nativeStrictAudit: { path: `${evidence}/native-artifact-audit.json`, pass: true, files: audit.counts.files },
    build: { ...build, report: `${evidence}/build-run.json` },
    binaryAudit: { path: `${evidence}/android-dev-apk-verification.json`, pass: true,
      bundledAssetsExpected: binary.bundledAssets.expected, bundledAssetsMatched: binary.bundledAssets.matched,
      omittedValidationMetadata: binary.bundledAssets.omittedValidationMetadata,
      selectableLocales: ["en", "ru"], debugSignature: true, alignment: true },
    preservedCopies: `${evidence}/copy-verification.json`,
    completedBuildsOrTestsRepeated: false,
  },
  reports: reportCopies, transcripts,
  boundaries: [
    `Source ${sourceCommit} is this exact archive-card and cross-language author-search devDebug snapshot; all prior Android and iOS artifacts remain distinct and unmodified.`,
    "This exact devDebug APK was compiled and statically inspected; it was not installed or exercised on an Android emulator or physical device.",
    "Chrome native-binding fixtures and CDP safe-area overrides are not installed Android/iOS runtime evidence or exact-RC screenshots.",
    "Canonical opposite-locale author search and integrated archive-card navigation have separate source-bound unit/integration evidence under docs/mobile/evidence/S10/opposite-locale-search-20260914; it is not installed Android runtime validation, a physical-device graphics benchmark or exact-RC screenshots.",
    "S03/S04/S05/S06/S07/S10 and global bilingual/content/child/commerce/rights/owner/release gates remain open. No production signing, deploy, store action, merge or owner approval is implied.",
  ],
};
await fs.writeFile(safe(`${evidence}/result.json`), json(result), { flag: "wx" });
console.log(json({ preservedRuntimeFiles: copiedFiles.length, apk: result.apk, evidence: `${evidence}/result.json`,
  reportCopies: reportCopies.length, transcripts: transcripts.length, sourceCommit, buildId }));
