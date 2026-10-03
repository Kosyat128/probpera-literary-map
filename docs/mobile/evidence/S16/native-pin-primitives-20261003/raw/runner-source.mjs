import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TextDecoder } from 'node:util';

// B-only evidence runner. No vault construction, native provider, OS or project registration.
const PROJECT = 'C:\\Users\\User\\Documents\\ChatGPT\\Работа по сайту\\literary-planet-v12-work';
const B = 'D:\\CodexData\\.codex\\visualizations\\2026\\10\\02\\01a0fd35-3865-7973-8f4c-0c7a0148df47\\release-completion';
const SOURCE = '17843151ab0624b2b17102440d0eeb464381bdcb';
const REPORT = 'd82b5219604689102c31f8e6206929975bb0153c';
const SOURCE_FINGERPRINT = '1c4bead7fae5cb3b3d9695c12520cb94865c9e91ec0831a2aef8d08677c99afe';
const CANDIDATE = path.join(B, 'next-native-pin-primitives-android-a2');
const OLD_CANDIDATE = path.join(B, 'next-native-pin-session-android-a2');
const GIT = 'C:\\Program Files\\Git\\cmd\\git.exe';
const OWN = path.join(B, 'next-native-pin-primitives-runner-a1');
const MAIN = 'apps/mobile/android/app/src/main/java/ru/probpera/literaryplanet/PlanetChildVault.java';
const INSTRUMENTATION = 'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildProtectedEnvelopeRuntimeTest.java';
const DRIVER = 'jvm/ru/probpera/literaryplanet/PlanetChildNativePinPrimitivesJvmDriver.java';
const CORE_DRIVER = 'jvm/ru/probpera/literaryplanet/PlanetChildNativePinSessionsJvmDriver.java';
const CORE_DRIVER_CLASS = 'ru.probpera.literaryplanet.PlanetChildNativePinSessionsJvmDriver';
const DRIVER_CLASS = 'ru.probpera.literaryplanet.PlanetChildNativePinPrimitivesJvmDriver';
const BEFORE_MAIN = '20d2514f5cc1be146bf86538dca1205ae26ef4bf280a743f39d987721ad266b1';
const PINNED = [
  { path: 'manifest.json', sha256: 'eac76d83d09f57c96dc455bf7bcd3bec710fc7582720e289654d04acb6b5ac5f', size: 5499 },
  { path: 'READY.json', sha256: 'c8d3662587bf71bc97ce2ec13f18512800103a869e881b6a884608e76518e32b', size: 1271 },
  { path: MAIN, sha256: '2bd6d4f14131d3c2db85b03c4226c78b2f0c37662673343071539f7fda1da7c0', size: 91155 },
  { path: DRIVER, sha256: '26664f82d1bfa47f496e80324cab9b1703a5b671ac11fafcc788e124cb5a6402', size: 28311 },
  { path: 'before/PlanetChildVault.java', sha256: BEFORE_MAIN, size: 65427 },
  { path: 'oracle-request.json', sha256: 'd66f7e6ca1f3654c8d407b67d0f12a54e682aceec1523ba8bf46ee47db595f96', size: 539 },
  { path: 'SCOPE.md', sha256: 'a238fd8739fdff7cd1ecf538ec802fa44ef1c0cce2db0e48a91852017ce3574b', size: 3777 },
  { path: 'source-preservation.json', sha256: '0af9e0c9f71d5927d5479b3d7d7fb375573ea85c0f8ac56f23827cf4fff7cb0c', size: 1118 },
  { base: 'prior-core', path: CORE_DRIVER, sha256: '211472613d2dd79c18366f247966fc95455d6edad8dd79bd892a0ae736565ca9', size: 27854 },
];
const EXPECTED_PRIMITIVE_CASE_NAMES = [
  'platform-malformed-native-pin-rejected',
  'independent-node-600000-oracle',
  'platform-input-and-signed-iteration-bounds',
  'platform-cancel-after-return-wipes-output',
  'production-primitives-factory-unsupported',
  'original-context-worker-before-first-callback',
  'three-exact-measured-calibration-samples',
  'production-policy-digit-budget-guards',
  'native-ascii-entry-owned-wipe-and-confirmation',
  'material-one-use-and-original-transfer',
  'foreign-and-reconstructed-originals-denied',
  'mutating-pin-and-salt-callbacks-denied',
  'whole-record-change-during-kdf-denied',
  'checkpoint-host-change-during-kdf-denied',
  'exclusive-deadline-and-clock-regression-denied',
  'measured-budget-and-zero-progress-denied',
  'cancel-blocked-kdf-retains-worker-and-buffers',
  'retire-blocked-clock-joins-actual-worker',
  'commit-denied-while-primitive-worker-live',
  'material-close-keeps-real-transfer-pending',
  'material-original-identity-and-settlement-fence',
  'production-platform-fixed-and-policy-floor',
  'callback-fault-and-material-mutation-wipes',
  'local-callback-fence-and-final-full-record-check',
];
const PRIMITIVE_SCOPE_MARKER = 'PRIVATE_PIN_PRIMITIVES_SCOPE synthetic-core=true platform-kdf=true native-input=false genuine-provider=false installed-os=false';
const EXPECTED_CASE_NAMES = [
  "production-factories-remain-unsupported",
  "enroll-captured-reset-later-time",
  "replace-captured-reset-later-time",
  "recover-captured-reset-later-time",
  "caller-epoch-denied",
  "caller-host-denied",
  "caller-boot-denied",
  "caller-deadline-denied",
  "whole-record-race-denied",
  "actual-epoch-denied",
  "actual-host-denied",
  "actual-boot-denied",
  "actual-deadline-denied",
  "actual-regression-denied",
  "known-refusal-retires-through-close",
  "ordinary-reset-not-recovery",
  "recovery-dependency-missing",
  "null-reset-witness-seals",
  "mutating-capture-denied",
  "mutating-current-denied",
  "mutating-authorizeMutation-denied",
  "mutating-recovery-denied",
  "mutating-write-denied",
  "close-does-not-settle-transfer",
  "unknown-close-sticky-capacity",
  "unknown-data-transfer-sticky-capacity",
  "lost-transfer-wipes-keeps-pending-identity",
  "sealed-secret-wipe-waits-actual-worker",
  "late-cancel-fenced-until-close",
  "cancel-before-begin-terminal",
  "cancel-during-capture-owned-settlement",
  "cancel-after-advance-seals-no-repair",
  "generic-dependency-fault-seals",
  "readback-mismatch-seals",
  "retirement-fault-retains-lane",
  "original-inspection-and-session-only",
  "constructor-lookalike-reply-not-pending",
  "commit-original-session-one-use",
  "no-eviction-capacity-and-replay"
];
let assertionCount = null;
let coreAssertionCount = null;
let coreDriverCount = null;
let oracleReference = null;
let primitiveExecution = null;
let sessionRegression = { status: 'NOT_RUN', driverCount: null, assertionCount: null, stdout: null, stderr: null };
const TOOLS = [
  { name: 'androidJar', relative: '.tmp/native-tools/android-sdk/platforms/android-36/android.jar', sha256: 'd9eb9da824d9e247a352f570f01e1169e725b2954bca9e283a71786c59b59f9a' },
  { name: 'javac', relative: '.tmp/native-tools/java/jdk-21.0.12.1+1/bin/javac.exe', sha256: '00f7c6f9ec89ebba4bb96cf8760403cccf1268df2eae8685900ba38e58a7aff9' },
  { name: 'java', relative: '.tmp/native-tools/java/jdk-21.0.12.1+1/bin/java.exe', sha256: '82051fdab26319d77d20cc0065045d05ec00b3e3d05f44935d7c06b96b621d55' },
];
const SOURCE_ROOTS = ['src', 'server/planet', 'apps/mobile', 'scripts/mobile', 'supabase/migrations', 'package.json', 'package-lock.json', 'tsconfig.json', 'native.html', 'capacitor.config.json', 'vite.config.ts', 'vite.native.config.ts', 'vite.pwa.config.ts'];
const PACKAGE_NAMES = ['typescript', 'vite', 'vitest', '@capacitor/core', '@capacitor/cli', '@capacitor/android', '@capacitor/ios', '@supabase/supabase-js'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const now = () => new Date().toISOString();
const assert = (value, message) => { if (!value) throw new Error(message); };
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const normalized = value => path.resolve(value).toLowerCase();
const inside = (base, target) => { const rel = path.relative(base, target); return rel !== '' && !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel); };
const decode = bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const errorData = error => ({ name: error?.name ?? 'Error', code: error?.code ?? null, message: String(error?.message ?? error) });
const scriptPath = fileURLToPath(import.meta.url);
const attemptId = crypto.randomUUID();
let attempt;
let project;
let env;
let sequence = 0;
let reportHead = REPORT;
let preflight = null;
let postflight = null;
let classesBefore = null;
let driverCount = null;
const commands = [];
const failures = [];
const checks = { preflight: 'NOT_RUN', versions: 'NOT_RUN', compilation: 'NOT_RUN', driver: 'NOT_RUN', marker: 'NOT_RUN', oracle: 'NOT_RUN', coreDriver: 'NOT_RUN', coreMarker: 'NOT_RUN', postflight: 'NOT_RUN', compiledBytesPreserved: 'NOT_RUN' };
const scope = {
  validation: 'PURE_JVM_PLATFORM_CRYPTO_WITH_SYNTHETIC_PRIVATE_PIN_SESSION_MECHANICS_ONLY',
  platformCrypto: 'HOST_JVM_JCA_PBKDF2_NOT_ANDROID_OS', nativeInputUI: 'NOT_RUN',
  primitiveCases: 'NEW24_SYNTHETIC_EXCEPT_PUBLIC_PLATFORM_CRYPTO_ORACLE',
  coreCases: 'AFFECTED39_SYNTHETIC_ORIGINAL_DRIVER',
  newInstrumentation: 'NOT_RUN', androidBuild: 'NOT_RUN', installedAndroid: 'NOT_RUN',
  vaultConstruction: 'NOT_RUN', androidStorage: 'NOT_RUN', nativeAuthority: 'NOT_RUN',
  providerActivation: 'NONE', appRegistration: 'NONE', admission: 'NONE', releaseAcceptance: 'NONE',
};

async function write(name, bytes) {
  assert(attempt && inside(attempt, path.join(attempt, name)), 'Evidence target must be inside this owned attempt');
  await fs.writeFile(path.join(attempt, name), bytes, { flag: 'wx' });
}
async function evidence(name, value) {
  const bytes = Buffer.from(json(value), 'utf8');
  await write(name, bytes);
  return { path: name, sha256: sha(bytes), size: bytes.length };
}
async function regularFile(filename) {
  const info = await fs.lstat(filename);
  assert(info.isFile() && !info.isSymbolicLink(), `Not an ordinary file: ${filename}`);
  const bytes = await fs.readFile(filename);
  return { path: filename, sha256: sha(bytes), size: bytes.length };
}
async function capturePinned() {
  const files = [];
  for (const pin of PINNED) {
    const file = await regularFile(path.join(pin.base === 'prior-core' ? OLD_CANDIDATE : CANDIDATE, pin.path));
    files.push({ base: pin.base ?? 'candidate', path: pin.path, sha256: file.sha256, size: file.size });
  }
  return files;
}
async function captureTools() {
  const files = [];
  for (const pin of TOOLS) {
    const file = await regularFile(path.join(project, pin.relative));
    files.push({ name: pin.name, ...file });
  }
  files.push({ name: 'git', ...await regularFile(GIT) });
  files.push({ name: 'node', ...await regularFile(process.execPath) });
  return files;
}
async function command(label, executable, args, timeoutMs = 60000) {
  const prefix = `${String(++sequence).padStart(2, '0')}-${label}`;
  const startedAt = now();
  const outcome = spawnSync(executable, args, { cwd: attempt, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024 });
  const stdout = outcome.stdout ?? Buffer.alloc(0);
  const stderr = outcome.stderr ?? Buffer.alloc(0);
  await write(`${prefix}.stdout.bin`, stdout);
  await write(`${prefix}.stderr.bin`, stderr);
  const record = {
    label, executable, args, cwd: attempt, shell: false, timeoutMs,
    startedAt, finishedAt: now(), exitCode: outcome.status, signal: outcome.signal,
    error: outcome.error ? errorData(outcome.error) : null,
    status: outcome.status === 0 && !outcome.signal && !outcome.error ? 'PASS' : 'FAIL',
    stdout: { path: `${prefix}.stdout.bin`, sha256: sha(stdout), size: stdout.length },
    stderr: { path: `${prefix}.stderr.bin`, sha256: sha(stderr), size: stderr.length },
  };
  await evidence(`${prefix}.command.json`, record);
  commands.push(record);
  return { record, stdout, stderr };
}
async function git(label, args) {
  const result = await command(label, GIT, ['--no-replace-objects', '-c', `safe.directory=${project}`, '-c', 'core.autocrlf=false', '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-C', project, ...args]);
  assert(result.record.status === 'PASS', `Git read failed: ${label}`);
  return decode(result.stdout);
}
async function captureSource(phase) {
  const gitRoot = (await git(`${phase}-git-root`, ['rev-parse', '--show-toplevel'])).trim();
  const gitRootReal = await fs.realpath(gitRoot);
  const repositoryHead = (await git(`${phase}-head`, ['rev-parse', 'HEAD'])).trim();
  const sourceCommit = (await git(`${phase}-source-commit`, ['log', '-1', '--format=%H', '--', ...SOURCE_ROOTS])).trim();
  const status = await git(`${phase}-status`, ['status', '--porcelain=v1', '--untracked-files=all']);
  const sourceStatus = await git(`${phase}-source-status`, ['status', '--porcelain=v1', '--untracked-files=all', '--', ...SOURCE_ROOTS]);
  const listed = await git(`${phase}-source-paths`, ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...SOURCE_ROOTS]);
  const paths = [...new Set(listed.split('\0').filter(Boolean))].sort();
  const sourceFiles = [];
  for (const rel of paths) {
    const filename = path.resolve(project, rel);
    assert(inside(project, filename), `Source path escaped checkout: ${rel}`);
    const file = await regularFile(filename);
    assert(inside(project, await fs.realpath(filename)), `Source realpath escaped checkout: ${rel}`);
    sourceFiles.push({ path: rel, sha256: file.sha256, size: file.size });
  }
  const packageVersions = {};
  for (const name of PACKAGE_NAMES) {
    const bytes = await fs.readFile(path.join(project, 'node_modules', name, 'package.json'));
    const pkg = JSON.parse(decode(bytes));
    assert(typeof pkg.version === 'string' && pkg.version.length > 0, `Missing package version: ${name}`);
    packageVersions[name] = pkg.version;
  }
  const projectMain = await regularFile(path.join(project, MAIN));
  let instrumentationExists = false;
  try { await fs.lstat(path.join(project, INSTRUMENTATION)); instrumentationExists = true; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return {
    phase, capturedAt: now(), project, gitRoot, gitRootReal, repositoryHead, sourceCommit, status, sourceStatus,
    sourceFingerprint: sha(Buffer.from(JSON.stringify(sourceFiles), 'utf8')),
    sourceFiles, lockSha256: sha(await fs.readFile(path.join(project, 'package-lock.json'))),
    packageVersions, projectMain, instrumentationExists,
  };
}
function guardSource(source) {
  assert(normalized(source.gitRootReal) === normalized(project), 'Git root differs from the real checkout');
  assert(source.repositoryHead === (reportHead ?? SOURCE), 'HEAD is neither exact source nor explicitly supplied report HEAD');
  assert(source.sourceCommit === SOURCE, 'Latest app-source commit changed');
  assert(source.sourceFiles.length === 1780, 'Exact current captured source closure count differs');
  assert(sha(Buffer.from(JSON.stringify(source.sourceFiles.map(({ path, sha256 }) => ({ path, sha256 }))), 'utf8')) === SOURCE_FINGERPRINT, 'Current normalized source fingerprint differs');
  assert(source.status === '' && source.sourceStatus === '', 'Checkout must be completely clean');
  assert(source.projectMain.sha256 === BEFORE_MAIN && source.projectMain.size === 65427, 'Project vault differs from original before bytes');
  assert(source.instrumentationExists === true, 'Existing codec fixture must remain present and unchanged in full source binding');
}
function guardPinned(snapshot) {
  for (const pin of PINNED) {
    const file = snapshot.candidate.find(item => item.path === pin.path && item.base === (pin.base ?? 'candidate'));
    assert(file?.sha256 === pin.sha256 && (pin.size === undefined || file.size === pin.size), `Frozen candidate mismatch: ${pin.path}`);
  }
  for (const pin of TOOLS) {
    const file = snapshot.tools.find(item => item.name === pin.name);
    assert(file?.sha256 === pin.sha256, `SDK/JDK byte mismatch: ${pin.name}`);
  }
  guardSource(snapshot.source);
}
async function capture(phase) {
  const candidate = await capturePinned();
  const candidateReference = await evidence(`${phase}-candidate.json`, candidate);
  const tools = await captureTools();
  const toolReference = await evidence(`${phase}-tools.json`, tools);
  const runner = await regularFile(scriptPath);
  const runnerManifest = await regularFile(path.join(OWN, 'manifest.json'));
  const source = await captureSource(phase);
  const value = { phase, capturedAt: now(), candidate, candidateReference, tools, toolReference, runner, runnerManifest, source };
  const reference = await evidence(`${phase}.json`, value);
  // Caller checks after storing all observed bytes so guard failures retain evidence.
  return { value, reference };
}
async function captureClasses() {
  const base = path.join(attempt, 'classes');
  const files = [];
  async function walk(folder) {
    const names = (await fs.readdir(folder)).sort();
    for (const name of names) {
      const filename = path.join(folder, name);
      const info = await fs.lstat(filename);
      assert(!info.isSymbolicLink(), 'Unexpected symlink in owned class output');
      if (info.isDirectory()) await walk(filename);
      else { assert(info.isFile(), 'Unexpected class output type'); const file = await regularFile(filename); files.push({ path: path.relative(base, filename).split(path.sep).join('/'), sha256: file.sha256, size: file.size }); }
    }
  }
  await walk(base);
  return files;
}
function sameBytes(left, right, label) {
  assert(JSON.stringify(left) === JSON.stringify(right), `${label} changed during this attempt`);
}
function parseArguments() {
  const args = process.argv.slice(2);
  if (args.length === 0) return;
  assert(args.length === 2 && args[0] === '--report-head' && /^[0-9a-f]{40}$/.test(args[1]), 'Usage: node run-jvm.mjs [--report-head FULL_40_LOWERCASE_HEX]');
  assert(args[1] === REPORT, 'Report HEAD must equal the exact frozen current report');
  reportHead = args[1];
}

try {
  assert(process.platform === 'win32', 'This pinned runner is for the current Windows checkout');
  assert(normalized(path.dirname(scriptPath)) === normalized(OWN), 'Runner must remain in its owned B directory');
  const ownReal = await fs.realpath(OWN);
  assert(normalized(ownReal) === normalized(OWN), 'Owned runner directory must not resolve outside B');
  const newAttempt = path.join(ownReal, `attempt-${attemptId}`);
  assert(inside(ownReal, newAttempt), 'Attempt escaped owned runner directory');
  await fs.mkdir(newAttempt, { recursive: false });
  attempt = newAttempt;
  for (const name of ['classes', 'tmp', 'home']) await fs.mkdir(path.join(attempt, name), { recursive: false });
  project = await fs.realpath(PROJECT);
  env = {};
  const allowedEnv = new Set(['SYSTEMROOT', 'WINDIR', 'PATH', 'PATHEXT', 'COMSPEC', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']);
  for (const [key, value] of Object.entries(process.env)) if (allowedEnv.has(key.toUpperCase())) env[key] = value;
  Object.assign(env, { TEMP: path.join(attempt, 'tmp'), TMP: path.join(attempt, 'tmp'), HOME: path.join(attempt, 'home'), USERPROFILE: path.join(attempt, 'home'), GIT_NO_LAZY_FETCH: '1', GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(attempt, 'empty-git-config'), GIT_CEILING_DIRECTORIES: project });
  await write('empty-git-config', Buffer.alloc(0));
  parseArguments();
  const manifestBytes = await fs.readFile(path.join(OWN, 'manifest.json'));
  const manifest = JSON.parse(decode(manifestBytes));
  assert(manifest.runnerSha256 === sha(await fs.readFile(scriptPath)), 'Runner hash differs from authored manifest');
  assert(manifest.frozenCandidateManifestSha256 === PINNED[0].sha256, 'Runner manifest names a different frozen candidate');
  await evidence('invocation.json', { schemaVersion: 1, attemptId, startedAt: now(), scriptPath, args: process.argv.slice(2), nodeVersion: process.version, nodeExecutable: process.execPath, nodeExecArgv: process.execArgv, expectedSourceCommit: SOURCE, allowedHead: reportHead ?? SOURCE, compilerRelease: 17, encoding: 'UTF-8', environmentPolicy: 'SUBPROCESS_ALLOWLIST_AND_OWNED_TEMP_HOME_NO_GLOBAL_ENV_MUTATION', scope });
  preflight = await capture('before');
  guardPinned(preflight.value);
  checks.preflight = 'PASS';
  const tool = Object.fromEntries(preflight.value.tools.map(item => [item.name, item.path]));
  const javaOwn = [`-Djava.io.tmpdir=${path.join(attempt, 'tmp')}`, `-Duser.home=${path.join(attempt, 'home')}`];
  checks.versions = 'FAIL';
  for (const [label, executable, args] of [['git-version', GIT, ['--version']], ['javac-version', tool.javac, [...javaOwn.map(value => `-J${value}`), '-version']], ['java-version', tool.java, [...javaOwn, '-version']]]) {
    const version = await command(label, executable, args);
    assert(version.record.status === 'PASS', `Version command failed: ${label}`);
  }
  checks.versions = 'PASS';
  const compiled = await command('javac', tool.javac, [...javaOwn.map(value => `-J${value}`), '-encoding', 'UTF-8', '--release', '17', '-proc:none', '-sourcepath', '', '-cp', tool.androidJar, '-d', path.join(attempt, 'classes'), path.join(CANDIDATE, MAIN), path.join(CANDIDATE, DRIVER), path.join(OLD_CANDIDATE, CORE_DRIVER)], 120000);
  checks.compilation = compiled.record.status;
  assert(checks.compilation === 'PASS', 'Compilation failed; driver remains NOT_RUN');
  classesBefore = await captureClasses();
  assert(classesBefore.some(file => file.path === `${DRIVER_CLASS.replaceAll('.', '/')}.class`), 'Compiled driver class is missing');
  assert(classesBefore.some(file => file.path === `${CORE_DRIVER_CLASS.replaceAll('.', '/')}.class`), 'Compiled affected session regression class is missing');
  await evidence('classes-before-driver.json', classesBefore);
  checks.oracle = 'FAIL';
  const oracleStartedAt = now();
  const oracleStartNs = process.hrtime.bigint();
  const publicPin = Buffer.from([49, 50, 51, 52, 53, 54, 55, 56]);
  const publicSalt = Buffer.from(Array.from({ length: 32 }, (_, index) => index));
  let oracleKey;
  let expectedHashHex;
  try {
    // Exactly one independent public-vector derivation. No private PIN is read.
    oracleKey = crypto.pbkdf2Sync(publicPin, publicSalt, 600000, 32, 'sha256');
    expectedHashHex = oracleKey.toString('hex');
    assert(/^[0-9a-f]{64}$/.test(expectedHashHex), 'Independent public oracle is malformed');
    oracleReference = await evidence('public-pbkdf2-oracle.json', {
      schemaVersion: 1, kind: 'literary-planet-public-independent-pbkdf2-oracle', status: 'PASS',
      algorithm: 'PBKDF2-HMAC-SHA256', iterations: 600000, keyLength: 32,
      passwordBytes: [49, 50, 51, 52, 53, 54, 55, 56],
      saltHex: Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(2, '0')).join(''),
      expectedHashHex, derivationsActuallyExecuted: 1,
      startedAt: oracleStartedAt, finishedAt: now(), elapsedNs: String(process.hrtime.bigint() - oracleStartNs),
      nodeVersion: process.version, nodeExecutable: process.execPath,
      nodeExecutableSha256: preflight.value.tools.find(item => item.name === 'node').sha256,
      purpose: 'Independent fixed public vector for host JVM comparison and a future separately executed Swift test.',
      installedDeviceCalibration: 'NOT_RUN', nativeInput: 'NOT_RUN', privateSecretsRead: false,
    });
    checks.oracle = 'PASS';
  } finally { publicPin.fill(0); publicSalt.fill(0); oracleKey?.fill(0); }
  const executed = await command('java-primitives-driver', tool.java, [...javaOwn, '-cp', [path.join(attempt, 'classes'), tool.androidJar].join(path.delimiter), DRIVER_CLASS, expectedHashHex], 120000);
  checks.driver = executed.record.status;
  primitiveExecution = { stdout: executed.record.stdout, stderr: executed.record.stderr, status: checks.driver };
  const stdout = decode(executed.stdout);
  const lines = stdout.trim().split(/\r?\n/);
  const cases = lines.filter(line => line.startsWith('PRIVATE_PIN_PRIMITIVE_CASE ')).map(line => line.slice('PRIVATE_PIN_PRIMITIVE_CASE '.length));
  const summaries = lines.map(line => /^PRIVATE_PIN_PRIMITIVES_OK cases=([1-9][0-9]*) assertions=([1-9][0-9]*)$/.exec(line)).filter(Boolean);
  const parsedCount = summaries.length === 1 ? Number(summaries[0][1]) : null;
  assertionCount = summaries.length === 1 ? Number(summaries[0][2]) : null;
  const expectedLines = [...EXPECTED_PRIMITIVE_CASE_NAMES.map(name => 'PRIVATE_PIN_PRIMITIVE_CASE ' + name),
    `PRIVATE_PIN_PRIMITIVES_OK cases=24 assertions=${assertionCount}`, PRIMITIVE_SCOPE_MARKER];
  const markerPassed = parsedCount===24 && Number.isSafeInteger(assertionCount) && assertionCount>=24
    && cases.length===24 && new Set(cases).size===24 && JSON.stringify(cases)===JSON.stringify(EXPECTED_PRIMITIVE_CASE_NAMES)
    && JSON.stringify(lines)===JSON.stringify(expectedLines);
  driverCount = markerPassed ? parsedCount : null;
  checks.marker = markerPassed ? 'PASS' : 'FAIL';
  await evidence('driver-count.json', { status:checks.marker,count:parsedCount,assertionCount,caseNames:cases,
    stdoutRawSha256:executed.record.stdout.sha256,scope:scope.primitiveCases });

  // This independent affected regression still runs if the new driver fails.
  // Its unmodified frozen39-case source is compiled with the candidate once.
  const coreExecuted = await command('java-session-regression-driver', tool.java, [...javaOwn, '-cp', [path.join(attempt, 'classes'), tool.androidJar].join(path.delimiter), CORE_DRIVER_CLASS], 60000);
  checks.coreDriver = coreExecuted.record.status;
  const coreLines = decode(coreExecuted.stdout).trim().split(/\r?\n/);
  const coreCases = coreLines.filter(line=>line.startsWith('PIN_SESSION_CASE_PASS=')).map(line=>line.slice('PIN_SESSION_CASE_PASS='.length));
  const countLines = coreLines.filter(line=>/^PIN_SESSION_SYNTHETIC_CASES=[1-9][0-9]*$/.test(line));
  const assertionLines = coreLines.filter(line=>/^PIN_SESSION_SYNTHETIC_ASSERTIONS=[1-9][0-9]*$/.test(line));
  const parsedCoreCount = countLines.length===1 ? Number(countLines[0].split('=')[1]) : null;
  coreAssertionCount = assertionLines.length===1 ? Number(assertionLines[0].split('=')[1]) : null;
  const expectedCoreLines = [countLines[0],assertionLines[0],...EXPECTED_CASE_NAMES.map(name=>'PIN_SESSION_CASE_PASS='+name),
    'PIN_SESSION_MECHANICS=PASS_PURE_JVM_SYNTHETIC','GENUINE_NATIVE_PROVIDER=NOT_IMPLEMENTED;VAULT_CONSTRUCTION=NOT_RUN;INSTALLED_OS=NOT_RUN'];
  const coreMarkerPassed = parsedCoreCount===39 && Number.isSafeInteger(coreAssertionCount) && coreAssertionCount>=39
    && coreCases.length===39 && new Set(coreCases).size===39 && JSON.stringify(coreCases)===JSON.stringify(EXPECTED_CASE_NAMES)
    && JSON.stringify(coreLines)===JSON.stringify(expectedCoreLines);
  coreDriverCount = coreMarkerPassed ? parsedCoreCount : null;
  checks.coreMarker = coreMarkerPassed ? 'PASS' : 'FAIL';
  sessionRegression = {
    status: checks.coreDriver === 'PASS' && coreMarkerPassed ? 'PASS_PURE_JVM_SYNTHETIC_PIN_SESSION_MECHANICS' : 'FAIL_PRESERVED_ATTEMPT',
    driverCount: coreDriverCount, assertionCount: coreAssertionCount,
    stdout: coreExecuted.record.stdout, stderr: coreExecuted.record.stderr,
    driverSourceSha256: '211472613d2dd79c18366f247966fc95455d6edad8dd79bd892a0ae736565ca9',
    scope: scope.coreCases,
  };
  await evidence('session-regression-count.json', { status: checks.coreMarker, count: parsedCoreCount,
    assertionCount: coreAssertionCount, caseNames: coreCases,
    stdoutRawSha256: coreExecuted.record.stdout.sha256, scope: scope.coreCases });
  assert(checks.driver === 'PASS', 'New native primitive JVM driver failed');
  assert(markerPassed, 'Primitive success markers missing, duplicate or malformed');
  assert(checks.coreDriver === 'PASS', 'Affected original39-case JVM driver failed');
  assert(coreMarkerPassed, 'Affected original39-case markers missing, duplicate or malformed');
} catch (error) {
  failures.push({ phase: 'preflight-or-execution', at: now(), ...errorData(error) });
  if (checks.preflight === 'NOT_RUN') checks.preflight = 'FAIL';
} finally {
  if (attempt && env && project) {
    try {
      postflight = await capture('after');
      guardPinned(postflight.value);
      checks.postflight = 'PASS';
      if (preflight) {
        sameBytes(preflight.value.candidate, postflight.value.candidate, 'Frozen candidate bytes');
        sameBytes(preflight.value.tools, postflight.value.tools, 'SDK/JDK/Git bytes');
        sameBytes(preflight.value.runner, postflight.value.runner, 'Runner bytes');
        sameBytes(preflight.value.runnerManifest, postflight.value.runnerManifest, 'Runner manifest bytes');
        sameBytes(preflight.value.source.sourceFiles, postflight.value.source.sourceFiles, 'Project app-source bytes');
        sameBytes(preflight.value.source.packageVersions, postflight.value.source.packageVersions, 'Package versions');
        assert(preflight.value.source.lockSha256 === postflight.value.source.lockSha256, 'Lock bytes changed');
        assert(preflight.value.source.repositoryHead === postflight.value.source.repositoryHead, 'Repository HEAD changed');
      }
      if (classesBefore) {
        const classesAfter = await captureClasses();
        await evidence('classes-after-driver.json', classesAfter);
        sameBytes(classesBefore, classesAfter, 'Compiled output bytes');
        checks.compiledBytesPreserved = 'PASS';
      }
    } catch (error) {
      checks.postflight = 'FAIL';
      failures.push({ phase: 'postflight', at: now(), ...errorData(error) });
    }
  }
  const success = failures.length === 0 && Object.values(checks).every(value => value === 'PASS');
  const result = {
    schemaVersion: 1, attemptId, finishedAt: now(), status: success ? 'PASS_PURE_JVM_NATIVE_PIN_PRIMITIVES' : 'FAIL_PRESERVED_ATTEMPT',
    checks, scope, driverCount, assertionCount, expectedSourceCommit: SOURCE, allowedHead: reportHead ?? SOURCE,
    oracle: oracleReference, primitiveExecution, sessionRegression,
    before: preflight?.reference ?? null, after: postflight?.reference ?? null,
    commands, failures,
    limitations: ['No installed Android/instrumentation/storage/lifecycle/native authority/provider/admission claim.', 'No source/project/baseline/global environment writes; only this new B attempt is written.', 'Raw outputs and failed attempts are retained; this runner does not overwrite or delete prior attempts.'],
  };
  if (attempt) {
    try { await evidence('result.json', result); }
    catch (error) { process.stderr.write(`${json({ status: 'EVIDENCE_WRITE_FAILED', attempt, error: errorData(error) })}`); process.exitCode = 1; }
  }
  process.stdout.write(json({ status: result.status, driverCount, attempt: attempt ?? null, result: attempt ? path.join(attempt, 'result.json') : null, checks }));
  if (!success) process.exitCode = 1;
}
