/** Local, explicit own-emulator/simulator checks. Imports and preflight never
 * enumerate devices, install, launch, reboot or call project services. A real
 * run is opt-in and remains separate from hardware/store/release acceptance. */
import { execFile, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { verifyNativeArtifact } from './verify-native-artifact.mjs';
import { DEVELOPER_DIR, selectSmokeTarget, simulatorLaunchPid, validateAppInfo, verifyCopiedPublic } from './ios-simulator-build.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const parseJson = bytes => { try { return JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Invalid native evidence JSON.'); } };
const within = (root, target) => { const relative = path.relative(root, target); return relative && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative); };
const relativePath = relative => typeof relative === 'string' && relative.length > 0 && relative.length < 1024 && !relative.includes('\\') && !relative.startsWith('/')
  && !/[\u0000-\u001f%?:#]/u.test(relative) && relative.split('/').every(part => part && part !== '.' && part !== '..');
async function regular(root, relative, maximum = 512 * 1024 * 1024) {
  check(relativePath(relative), 'Unsafe contained file path.');
  const target = path.resolve(root, relative), stat = await lstat(target);
  check(within(root, target) && stat.isFile() && !stat.isSymbolicLink() && stat.size <= maximum && await realpath(target) === target, 'Missing, linked or oversized input.');
  return readFile(target);
}
export async function nativeRuntimeSources(rootDir) {
  const root = await realpath(rootDir);
  const roots = ['src', 'apps/mobile/android', 'apps/mobile/ios', 'native.html', 'vite.native.config.ts', 'vite.config.ts',
    'tsconfig.json', 'package.json', 'package-lock.json', 'capacitor.config.json', 'scripts/mobile/build-native.mjs', 'scripts/mobile/native-base-assets.json', 'scripts/mobile/pwa-artifact.mjs'];
  const names = execFileSync('git', ['-c', 'safe.directory=' + root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots],
    { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).split('\0');
  const files = [];
  for (const filename of [...new Set(names.filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(name)))].sort())
    files.push({ path: filename, sha256: sha(await regular(root, filename)) });
  return { sha256: sha(json(files)), files };
}
export function validateRuntimeReceipt(value, platform) {
  check(value?.schemaVersion === 1 && value.kind === 'literary-planet-native-binary-preparation' && value.platform === platform
    && value.channel === 'dev' && value.releaseReady === false && value.deviceTested === false, 'An actual unreleased dev binary receipt is required.');
  check(commit(value.sourceCommit) && hash(value.sourceInputs?.sha256) && Array.isArray(value.sourceInputs.files) && value.sourceInputs.files.length > 0
    && value.sourceInputs.files.every(file => typeof file?.path === 'string' && hash(file.sha256)) && sha(json(value.sourceInputs.files)) === value.sourceInputs.sha256,
    'Binary receipt must bind exact raw source/configuration inputs.');
  check(hash(value.artifactSha256) && relativePath(value.artifactPath) && hash(value.webArtifactSha256)
    && typeof value.versionName === 'string' && value.versionName.length > 0 && Number.isSafeInteger(value.versionCode) && value.versionCode >= 1,
    'Binary receipt is missing package/digest/version identity.');
  if(value.webArtifactPath!==undefined)check(relativePath(value.webArtifactPath)&&value.webArtifactPath.endsWith('/artifact.json'),'Invalid retained web artifact path.');
  check(value.applicationId === (platform === 'android' ? 'ru.probpera.literaryplanet.dev' : 'ru.probpera.literaryplanet'), 'Wrong runtime application/channel.');
  if (platform === 'android') check(relativePath(value.testArtifactPath) && hash(value.testArtifactSha256), 'Exact synthetic instrumentation APK is required.');
  else check(relativePath(value.xctestrunPath) && hash(value.xctestrunSha256), 'Exact compiled XCTest run manifest is required.');
  return value;
}
export function validateOwnedAndroidTarget(serial, avdName, runId) {
  check(typeof runId === 'string' && /^[a-f0-9]{32}$/u.test(runId) && /^emulator-[1-9][0-9]{3,4}$/u.test(serial ?? '')
    && avdName === 'LiteraryPlanet-V12-' + runId, 'Only an explicitly owned run-specific Android emulator is permitted.');
}
export function parseAndroidPackage(text) {
  const packageLine = /^package: name='([^']+)' versionCode='([1-9][0-9]*)' versionName='([^']+)'/mu.exec(text);
  check(packageLine && Number.isSafeInteger(Number(packageLine[2])), 'aapt2 did not identify a single canonical package.');
  return { applicationId: packageLine[1], versionCode: Number(packageLine[2]), versionName: packageLine[3], debuggable: /^application-debuggable\s*$/mu.test(text) };
}
export function parseAndroidCertificate(text) {
  const certificates = [...text.matchAll(/^Signer #[0-9]+ certificate SHA-256 digest: ([a-f0-9]{64})\s*$/gmu)].map(match => match[1]);
  check(certificates.length === 1, 'Exactly one verified signing certificate is required.'); return certificates[0];
}
export function instrumentationPassed(text) {
  return typeof text === 'string' && /(?:^|\n)OK \(1 test\)\s*(?:\n|$)/u.test(text)
    && !/FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=/u.test(text);
}
export function xctestPassed(text) {
  return typeof text === 'string' && /Executed 1 test, with 0 failures/u.test(text)
    && /\*\* TEST EXECUTE SUCCEEDED \*\*/u.test(text) && !/Test Case .* skipped|TEST EXECUTE FAILED|\b(?:failed|error):/iu.test(text);
}
export function bindXctestrun(input, { templateDir, binary, runId, phase }) {
  check(input?.__xctestrun_metadata__?.FormatVersion === 2 && Array.isArray(input.TestConfigurations) && input.TestConfigurations.length === 1,
    'Expected one version-2 XCTest configuration.');
  const result = structuredClone(input);
  const relocate = (value, depth = 0) => {
    check(depth < 32, 'Oversized nested XCTest configuration.');
    if (typeof value === 'string') return value.replaceAll('__TESTROOT__', templateDir).replaceAll('__TESTHOST__', binary);
    if (Array.isArray(value)) return value.map(item => relocate(item, depth + 1));
    if (value && typeof value === 'object') for (const name of Object.keys(value)) value[name] = relocate(value[name], depth + 1);
    return value;
  };
  relocate(result);
  const configuration = result.TestConfigurations[0];
  check(configuration.IsEnabled !== false && Array.isArray(configuration.TestTargets) && configuration.TestTargets.length === 1,
    'Expected one enabled synthetic XCTest target.');
  const target = configuration.TestTargets[0];
  check(target.BlueprintName === 'AppSecureStorageTests' && target.IsUITestBundle !== true && target.IsAppHostedTestBundle === true,
    'Wrong compiled app-hosted XCTest target.');
  const host = value => {
    check(typeof value === 'string', 'Missing compiled XCTest path.');
    const resolved = value.replaceAll('__TESTROOT__', templateDir).replaceAll('__TESTHOST__', binary);
    check(!/__[A-Z_]+__/u.test(resolved) && path.isAbsolute(resolved), 'Unsupported unresolved XCTest path.');
    return path.normalize(resolved);
  };
  check(host(target.TestHostPath) === binary && host(target.TestBundlePath) === path.join(binary, 'PlugIns', 'AppSecureStorageTests.xctest'),
    'XCTest host/bundle differs from the pinned application.');
  target.TestHostPath = binary; target.TestBundlePath = host(target.TestBundlePath);
  if (target.DependentProductPaths) {
    check(Array.isArray(target.DependentProductPaths) && target.DependentProductPaths.length <= 32, 'Malformed XCTest product paths.');
    target.DependentProductPaths = target.DependentProductPaths.map(host);
  }
  const preference = phase.startsWith('preferences:'), selected = preference ? phase.slice('preferences:'.length) : phase;
  check(/^[a-f0-9]{32}$/u.test(runId) && (preference ? ['write', 'read', 'parallel', 'corrupt', 'remove', 'absent', 'clear', 'unsupported-language', 'unsupported-theme', 'plugin-failure', 'timeout']
    : ['write', 'read', 'parallel', 'corrupt', 'remove', 'absent']).includes(selected), 'Wrong synthetic XCTest phase.');
  target.EnvironmentVariables = { ...target.EnvironmentVariables, LITERARY_PLANET_SECURE_TEST_RUN_ID: runId };
  delete target.EnvironmentVariables.LITERARY_PLANET_SECURE_TEST_PHASE; delete target.EnvironmentVariables.LITERARY_PLANET_PREFERENCE_TEST_PHASE;
  target.EnvironmentVariables[preference ? 'LITERARY_PLANET_PREFERENCE_TEST_PHASE' : 'LITERARY_PLANET_SECURE_TEST_PHASE'] = selected;
  target.OnlyTestIdentifiers = ['PlanetSecureStoreRuntimeTests/' + (preference ? 'testPreferencePhase' : 'testSecureStoragePhase')];
  target.SkipTestIdentifiers = []; target.ParallelizationEnabled = false;
  return result;
}
async function appDigest(directory) {
  const files = [];
  async function walk(folder, prefix = '', depth = 0) {
    check(depth <= 12 && await realpath(folder) === path.resolve(folder), 'Linked/deep simulator bundle.');
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      check(!entry.isSymbolicLink() && files.length < 4096, 'Linked/oversized simulator bundle.');
      if (entry.isDirectory()) await walk(path.join(folder, entry.name), prefix + entry.name + '/', depth + 1);
      else { check(entry.isFile(), 'Nonregular simulator bundle entry.'); const bytes = await regular(directory, prefix + entry.name); files.push({ path: prefix + entry.name, sha256: sha(bytes) }); }
    }
  }
  await walk(directory); files.sort((a, b) => a.path.localeCompare(b.path)); return sha(json(files));
}
export async function simulatorAppDigest(directory) { return appDigest(await realpath(directory)); }

export async function runNativeInstallRuntime(options = {}) {
  const root = await realpath(options.rootDir ?? fileURLToPath(new URL('../../', import.meta.url)));
  const platform = options.platform; check(platform === 'android' || platform === 'ios', 'Use android or ios.');
  const runId = options.runId ?? randomUUID().replaceAll('-', '');
  check(/^[a-f0-9]{32}$/u.test(runId), 'Use one exact run UUID without separators.');
  const output = path.resolve(root, options.outDir ?? '.tmp/native-runtime/' + runId);
  check(within(root, output) && path.relative(root, output).split(path.sep)[0] === '.tmp', 'Evidence output must be an own .tmp directory.');
  let parent = root;
  for (const part of path.relative(root, path.dirname(output)).split(path.sep)) {
    parent = path.join(parent, part);
    try { const stat = await lstat(parent); check(stat.isDirectory() && !stat.isSymbolicLink() && await realpath(parent) === parent, 'Linked evidence parent.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await mkdir(parent); }
  }
  await mkdir(output); check(await realpath(output) === output, 'Linked evidence output.');
  const report = { schemaVersion: 1, kind: 'literary-planet-native-install-runtime', platform, channel: 'dev', runId,
    startedAt: new Date().toISOString(), status: 'NOT_RUN', releaseReady: false, installed: false, hardwareProtectionTested: false,
    checks: [], dependencies: [], commands: [], captures: [], cleanup: {},
    limits: ['No production/remote/store/payment authorization.', 'Emulator/simulator observations do not establish hardware protection.',
      'Screenshots and process liveness require UI review; neither proves full product/native acceptance.'] };
  const abort = new AbortController(), interrupt = () => abort.abort();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  let ownedAndroidInstall = false, ownedTestInstall = false, ownedSimulator = null, receipt, xctestrun;
  const toolRoot = path.join(root, '.tmp', 'native-tools');
  const extension = process.platform === 'win32' ? '.exe' : '';
  const tools = { adb: path.join(toolRoot, 'android-sdk', 'platform-tools', 'adb' + extension),
    aapt: path.join(toolRoot, 'android-sdk', 'build-tools', '36.0.0', 'aapt2' + extension),
    java: path.join(toolRoot, 'java', 'jdk-21.0.12.1+1', 'bin', 'java' + extension),
    signer: path.join(toolRoot, 'android-sdk', 'build-tools', '36.0.0', 'lib', 'apksigner.jar'),
    androidHome: path.join(toolRoot, 'android-user'), xcrun: '/usr/bin/xcrun' };
  const env = { ...process.env, ANDROID_USER_HOME: tools.androidHome, DEVELOPER_DIR };
  async function command(binary, args, timeoutMs = 30_000, cleanup = false) {
    const entry = { binary, args, startedAt: new Date().toISOString(), timeoutMs }; report.commands.push(entry);
    return new Promise((resolve, reject) => {
      let timer, timedOut = false;
      const child = execFile(binary, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, killSignal: 'SIGKILL', ...(cleanup ? {} : { signal: abort.signal }) }, (error, stdout, stderr) => {
        clearTimeout(timer); Object.assign(entry, { exitCode: error ? typeof error.code === 'number' ? error.code : null : 0,
          errorCode: typeof error?.code === 'string' ? error.code : null, signal: error?.signal ?? null, timedOut,
          stdout, stderr, finishedAt: new Date().toISOString() });
        if (error) reject(new Error('Native command failed: ' + path.basename(binary) + ' ' + args.slice(0, 2).join(' ')));
        else resolve(stdout + stderr);
      });
      timer = setTimeout(() => { if (child.exitCode === null && child.signalCode === null) { timedOut = true; child.kill('SIGKILL'); } }, timeoutMs);
    });
  }
  const adb = (args, timeoutMs, cleanup) => command(tools.adb, ['-s', options.serial, ...args], timeoutMs, cleanup);
  const sim = (args, timeoutMs, cleanup) => command(tools.xcrun, ['simctl', ...args], timeoutMs, cleanup);
  const record = (id, status, reason) => { report.checks.push({ id, status, ...(reason ? { reason } : {}) }); };
  async function androidInstrument(phase, cleanup = false, preference = false) {
    const text = await adb(['shell', 'am', 'instrument', '-w', '-r', '-e', 'class', 'ru.probpera.literaryplanet.' + (preference ? 'PlanetPreferencesRuntimeTest' : 'PlanetSecureStoreRuntimeTest'),
      '-e', 'literaryRunId', runId, '-e', 'literaryPhase', phase, 'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner'], 60_000, cleanup);
    check(instrumentationPassed(text), 'Synthetic secure-store instrumentation did not pass: ' + phase);
  }
  async function androidPreference(phase, label = phase) {
    await androidInstrument(phase, false, true);
    report.checks.push({ id: 'preferences-' + label, status: 'PASS', backend: phase === 'plugin-failure' || phase === 'timeout' ? 'synthetic-boundary' : 'native-os' });
  }
  async function capture(filename, simulator = false) {
    const target = path.join(output, filename);
    if (simulator) await sim(['io', ownedSimulator, 'screenshot', '--type=png', target]);
    else {
      const remote = '/sdcard/literary-planet-' + runId + '.png';
      try { await adb(['shell', 'screencap', '-p', remote]); await adb(['pull', remote, target]); }
      finally { await adb(['shell', 'rm', remote], 10_000, true); }
    }
    const bytes = await regular(output, filename, 32 * 1024 * 1024);
    check(bytes.length > 100 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Expected an actual PNG capture.');
    report.captures.push({ path: filename, sha256: sha(bytes), bytes: bytes.length, visuallyReviewed: false });
  }
  try {
    const required = platform === 'android' ? [tools.adb, tools.aapt, tools.java, tools.signer, tools.androidHome] : [tools.xcrun, DEVELOPER_DIR];
    for (const target of required) {
      let present = false; try { const stat = await lstat(target); present = !stat.isSymbolicLink() && (stat.isFile() || stat.isDirectory()) && await realpath(target) === target; } catch {}
      report.dependencies.push({ path: target, present });
    }
    if (platform === 'ios' && process.platform !== 'darwin') { record('ios-host', 'BLOCKED_EXTERNAL', 'Compatible macOS/Xcode/Simulator is required.'); report.status = 'BLOCKED_EXTERNAL'; return report; }
    if (report.dependencies.some(item => !item.present)) { record('native-tools', 'BLOCKED_EXTERNAL', 'Existing pinned project toolchain is incomplete; no SDK installation is attempted.'); report.status = 'BLOCKED_EXTERNAL'; return report; }
    if (!options.receiptPath) { record('exact-binary', 'NOT_RUN', 'Supply the actual local build receipt, package digest and input manifest.'); return report; }
    receipt = validateRuntimeReceipt(parseJson(await regular(root, options.receiptPath, 8 * 1024 * 1024)), platform);
    report.identity = { sourceCommit: receipt.sourceCommit, sourceFingerprint: receipt.sourceInputs.sha256, artifactSha256: receipt.artifactSha256,
      webArtifactSha256: receipt.webArtifactSha256, applicationId: receipt.applicationId, versionName: receipt.versionName, versionCode: receipt.versionCode };
    check(JSON.stringify(await nativeRuntimeSources(root)) === JSON.stringify(receipt.sourceInputs), 'The binary source/configuration fingerprint is stale.');
    const webArtifactPath=receipt.webArtifactPath??'dist-native/artifact.json',webArtifactDir=path.posix.dirname(webArtifactPath);
    const audit = await verifyNativeArtifact({ rootDir: root,artifactDir:webArtifactDir }); check(audit.pass && audit.identity?.platform === platform && audit.identity.channel === 'dev'
      && audit.identity.sourceCommit === receipt.sourceCommit, 'Current exact native web preparation audit/source failed.');
    check(sha(await regular(root, webArtifactPath)) === receipt.webArtifactSha256, 'Wrong prepared web artifact.');
    const binary = path.resolve(root, receipt.artifactPath);
    if (platform === 'android') {
      check(sha(await regular(root, receipt.artifactPath)) === receipt.artifactSha256 && sha(await regular(root, receipt.testArtifactPath)) === receipt.testArtifactSha256, 'Wrong main or instrumentation APK digest.');
      report.toolchain = { java: await command(tools.java, ['-version']), aapt: await command(tools.aapt, ['version']), node: process.version };
      const metadata = parseAndroidPackage(await command(tools.aapt, ['dump', 'badging', binary]));
      check(metadata.applicationId === receipt.applicationId && metadata.versionCode === receipt.versionCode && metadata.versionName === receipt.versionName && metadata.debuggable, 'Actual APK version/application/debug channel differs from the receipt.');
      const test = path.resolve(root, receipt.testArtifactPath), testMetadata = parseAndroidPackage(await command(tools.aapt, ['dump', 'badging', test]));
      check(testMetadata.applicationId === 'ru.probpera.literaryplanet.dev.test' && testMetadata.debuggable, 'Wrong debug instrumentation package.');
      const testManifest = await command(tools.aapt, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', test]);
      check(testManifest.includes('androidx.test.runner.AndroidJUnitRunner') && /android:targetPackage[^\n]*"ru\.probpera\.literaryplanet\.dev"/u.test(testManifest), 'Instrumentation does not target this dev application.');
      const certificate = parseAndroidCertificate(await command(tools.java, ['-jar', tools.signer, 'verify', '--verbose', '--print-certs', binary]));
      check(certificate === parseAndroidCertificate(await command(tools.java, ['-jar', tools.signer, 'verify', '--verbose', '--print-certs', test])), 'Instrumentation signing identity does not match the main APK.');
      report.signing = { certificateSha256: certificate, productionSigning: false };
      if (options.execute === true && options.serial && options.avdName) validateOwnedAndroidTarget(options.serial, options.avdName, runId);
    } else {
      check(await appDigest(binary) === receipt.artifactSha256, 'Wrong simulator app-tree digest.');
      const info = parseJson(await command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.join(binary, 'Info.plist')]));
      validateAppInfo(info, await command('/usr/bin/xcrun', ['vtool', '-show-build', path.join(binary, 'App')]));
      check(info.CFBundleShortVersionString === receipt.versionName && Number(info.CFBundleVersion) === receipt.versionCode, 'Wrong simulator bundle version.');
      await verifyCopiedPublic(path.join(root,webArtifactDir), path.join(binary, 'public'));
      check(sha(await regular(root, receipt.xctestrunPath, 4 * 1024 * 1024)) === receipt.xctestrunSha256, 'Wrong compiled XCTest manifest digest.');
      xctestrun = parseJson(await command('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path.resolve(root, receipt.xctestrunPath)]));
      bindXctestrun(xctestrun, { templateDir: path.dirname(path.resolve(root, receipt.xctestrunPath)), binary, runId, phase: 'write' });
      report.toolchain = { xcode: await command('/usr/bin/xcodebuild', ['-version']), node: process.version };
    }
    record('exact-binary-preflight', 'PASS');
    if (options.execute !== true) { record('installed-runtime', 'NOT_RUN', 'Preflight performs no device access. Supply --execute with the explicitly owned target.'); return report; }
    if (platform === 'android') {
      if (!options.serial || !options.avdName) { record('owned-emulator', 'NOT_RUN', 'Supply a fresh explicitly owned run-specific AVD and its emulator serial.'); return report; }
      validateOwnedAndroidTarget(options.serial, options.avdName, runId);
      report.toolchain.adb = await command(tools.adb, ['version']);
      check((await adb(['shell', 'getprop', 'ro.kernel.qemu'])).trim() === '1', 'Target is not an Android emulator.');
      check((await adb(['emu', 'avd', 'name'])).replaceAll('\r\n', '\n').trim() === options.avdName + '\nOK', 'Emulator is not the explicitly owned run AVD.');
      check((await adb(['shell', 'pm', 'list', 'packages', receipt.applicationId])).trim() === '', 'Refuse an already installed application; use a fresh own emulator.');
      check(Number((await adb(['shell', 'getprop', 'ro.build.version.sdk'])).trim()) >= 28, 'Synthetic instrumentation requires API 28 or newer.');
      await adb(['install', binary], 60_000); ownedAndroidInstall = true;
      await adb(['install', path.resolve(root, receipt.testArtifactPath)], 60_000); ownedTestInstall = true;
      const installed = (await adb(['shell', 'pm', 'path', receipt.applicationId])).trim();
      check(/^package:\/data\/app\/[^\n]+\/base\.apk$/u.test(installed), 'Expected one installed base APK.');
      await adb(['pull', installed.slice(8), path.join(output, 'installed-base.apk')], 60_000);
      check(sha(await regular(output, 'installed-base.apk')) === receipt.artifactSha256, 'Installed APK differs from the exact compiled package.');
      report.installed = true; record('installed-package-byte-equality', 'PASS');
      await androidInstrument('write'); record('secure-storage-write-ciphertext-readback', 'PASS');
      await androidPreference('write');
      const launch = async () => { await adb(['shell', 'am', 'start', '-W', '-n', receipt.applicationId + '/ru.probpera.literaryplanet.MainActivity']);
        await delay(2500, undefined, { signal: abort.signal });
        check(/^[1-9][0-9]*(?: [1-9][0-9]*)*$/u.test((await adb(['shell', 'pidof', receipt.applicationId])).trim()), 'Native process is not alive.'); };
      await launch(); await capture('first-launch.png'); record('first-launch', 'PASS');
      await adb(['shell', 'am', 'force-stop', receipt.applicationId]); await launch(); await androidInstrument('read'); record('new-process-secure-readback', 'PASS');
      await androidPreference('read', 'read-after-process');
      await adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME']); await launch(); record('background-return-liveness', 'PASS');
      if (options.reboot === true) {
        await adb(['reboot']); let booted = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          await delay(2000, undefined, { signal: abort.signal });
          try { if ((await adb(['shell', 'getprop', 'sys.boot_completed'], 5000)).trim() === '1') { booted = true; break; } } catch {}
        }
        check(booted, 'Owned emulator did not reboot within the bounded window.');
        await androidInstrument('read'); await launch(); record('system-restart-secure-readback', 'PASS');
        await androidPreference('read', 'read-after-system-restart');
      } else { record('system-restart-secure-readback', 'NOT_RUN', 'Use --reboot-owned-target for this own emulator only.');
        record('preferences-read-after-system-restart', 'NOT_RUN', 'Use --reboot-owned-target for this own emulator only.'); }
      for (const phase of ['unsupported-language', 'unsupported-theme', 'parallel', 'plugin-failure', 'timeout', 'corrupt', 'remove']) await androidPreference(phase);
      await androidInstrument('parallel'); record('secure-store-parallel', 'PASS');
      await androidInstrument('corrupt'); record('secure-store-corrupt', 'PASS');
      await androidInstrument('remove'); record('secure-store-remove', 'PASS');
      await androidInstrument('absent');
      await adb(['uninstall', receipt.applicationId]); ownedAndroidInstall = false;
      await adb(['install', binary], 60_000); ownedAndroidInstall = true;
      await adb(['install', '-r', path.resolve(root, receipt.testArtifactPath)], 60_000); ownedTestInstall = true;
      await androidInstrument('absent'); await launch(); await capture('clean-reinstall.png'); record('clean-reinstall-qa-key-absent', 'PASS');
      await androidPreference('absent', 'absent-after-clean-reinstall');
      record('previous-version-update', 'NOT_RUN', 'No separately identified compatible previous binary was supplied. This runner does not invent an update PASS.');
    } else {
      for (const name of ['list', 'create', 'boot', 'bootstatus', 'install', 'launch', 'terminate', 'shutdown', 'delete', 'uninstall', 'get_app_container', 'io'])
        check((await sim(['help', name])).includes(name), 'Installed simctl does not support required command: ' + name);
      const target = selectSmokeTarget(parseJson(await sim(['list', '--json']))); report.target = target;
      const id = (await sim(['create', 'LiteraryPlanet-V12-' + runId, target.deviceType.identifier, target.runtime.identifier])).trim();
      check(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(id), 'simctl did not create one own device.'); ownedSimulator = id;
      await sim(['boot', id], 60_000); await sim(['bootstatus', id, '-b'], 60_000); await sim(['install', id, binary], 60_000);
      const installed = (await sim(['get_app_container', id, receipt.applicationId, 'app'])).trim();
      check(path.isAbsolute(installed) && installed.split(path.sep).includes(id) && await appDigest(installed) === receipt.artifactSha256, 'Installed simulator bundle differs from the exact compiled application.');
      report.installed = true; record('installed-package-byte-equality', 'PASS');
      const instrument = async (phase, label = phase) => {
        const value = bindXctestrun(xctestrun, { templateDir: path.dirname(path.resolve(root, receipt.xctestrunPath)), binary, runId, phase });
        const own = path.join(output, 'secure-' + phase.replace(':', '-') + '-' + report.commands.length + '.xctestrun');
        await writeFile(own, json(value), { flag: 'wx' }); await command('/usr/bin/plutil', ['-convert', 'xml1', own]);
        const preference = phase.startsWith('preferences:'), method = preference ? 'testPreferencePhase' : 'testSecureStoragePhase';
        const result = await command('/usr/bin/xcodebuild', ['test-without-building', '-xctestrun', own,
          '-destination', 'platform=iOS Simulator,id=' + id, '-only-testing:AppSecureStorageTests/PlanetSecureStoreRuntimeTests/' + method,
          '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-simulator-destinations', '1'], 60_000);
        check(xctestPassed(result), 'Synthetic Keychain XCTest did not pass: ' + phase);
        const installedPath = (await sim(['get_app_container', id, receipt.applicationId, 'app'])).trim();
        check(path.isAbsolute(installedPath) && installedPath.split(path.sep).includes(id) && await appDigest(installedPath) === receipt.artifactSha256,
          'XCTest changed the exact installed application.');
        report.checks.push({ id: (preference ? 'preferences-' + label.replace('preferences:', '') : 'keychain-' + label), status: 'PASS',
          backend: phase === 'preferences:plugin-failure' || phase === 'preferences:timeout' ? 'synthetic-boundary' : 'native-os', xctestrunSha256: sha(await readFile(own)) });
      };
      await instrument('write');
      await instrument('preferences:write');
      const launch = async languageArgs => {
        const pid = simulatorLaunchPid(await sim(['launch', id, receipt.applicationId, ...languageArgs]));
        await delay(2500, undefined, { signal: abort.signal });
        const alive = (await command('/bin/ps', ['-p', String(pid), '-o', 'pid=,comm='])).trim();
        check(new RegExp('^' + pid + '\\s+.*(?:/|\\s)App$', 'u').test(alive), 'Simulator application process is not alive.');
      };
      for (const locale of ['ru', 'en']) {
        await launch(['-AppleLanguages', '(' + locale + ')', '-AppleLocale', locale === 'ru' ? 'ru_RU' : 'en_US']);
        await capture('simulator-' + locale + '.png', true); await sim(['terminate', id, receipt.applicationId]);
      }
      record('first-launch-ru-en-captures', 'PASS'); record('new-process-launch', 'PASS');
      await instrument('read', 'read-after-process');
      await instrument('preferences:read', 'read-after-process');
      await sim(['shutdown', id]); await sim(['boot', id], 60_000); await sim(['bootstatus', id, '-b'], 60_000);
      await launch([]); record('system-restart-launch', 'PASS');
      await sim(['terminate', id, receipt.applicationId]); await instrument('read', 'read-after-system-restart');
      await instrument('preferences:read', 'read-after-system-restart');
      for (const phase of ['unsupported-language', 'unsupported-theme', 'parallel', 'plugin-failure', 'timeout', 'corrupt', 'remove']) await instrument('preferences:' + phase);
      await instrument('parallel'); await instrument('corrupt'); await instrument('remove'); await instrument('absent');
      await sim(['uninstall', id, receipt.applicationId]); await sim(['install', id, binary], 60_000); await launch([]);
      record('clean-reinstall-launch', 'PASS');
      await sim(['terminate', id, receipt.applicationId]); await instrument('absent', 'absent-after-clean-reinstall');
      await instrument('preferences:absent', 'absent-after-clean-reinstall');
      record('keychain-locked-state-hardware', 'NOT_RUN', 'A separately authorized physical-device locked-state observation remains required. Simulator results do not attest hardware.');
      record('background-return', 'NOT_RUN', 'Simulator lifecycle UI automation is not supplied by simctl launch/liveness.');
      record('previous-version-update', 'NOT_RUN', 'No separately identified previous simulator binary is available.');
    }
    check(JSON.stringify(await nativeRuntimeSources(root)) === JSON.stringify(receipt.sourceInputs), 'Source/configuration changed during installed runtime verification.');
    record('source-fingerprint-after-runtime', 'PASS');
    report.status = report.checks.some(item => item.status !== 'PASS') ? 'NOT_RUN' : 'PASS';
    return report;
  } catch (error) { report.status = abort.signal.aborted ? 'NOT_RUN' : 'FAIL'; report.failure = error.message; return report; }
  finally {
    if (ownedAndroidInstall) {
      if (ownedTestInstall) { try { await androidInstrument('clear', true, true); report.cleanup.preferenceFixtureRemoved = true; } catch { report.cleanup.preferenceFixtureRemoved = false; } }
      try { if (ownedTestInstall) await androidInstrument('clear', true); await adb(['uninstall', receipt.applicationId], 30_000, true); report.cleanup.mainApplicationRemoved = true; }
      catch { report.cleanup.mainApplicationRemoved = false; }
    }
    if (ownedTestInstall) { try { await adb(['uninstall', 'ru.probpera.literaryplanet.dev.test'], 30_000, true); report.cleanup.testApplicationRemoved = true; } catch { report.cleanup.testApplicationRemoved = false; } }
    if (ownedSimulator) {
      try { await sim(['shutdown', ownedSimulator], 30_000, true); } catch {}
      try { await sim(['delete', ownedSimulator], 30_000, true); report.cleanup.simulatorDeleted = true; } catch { report.cleanup.simulatorDeleted = false; }
    }
    if (Object.values(report.cleanup).some(value => value === false)) { report.status = 'FAIL'; report.failure = 'Owned runtime cleanup incomplete.'; }
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); report.finishedAt = new Date().toISOString();
    await writeFile(path.join(output, 'result.json'), json(report), { flag: 'wx' });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), values = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--execute') values.execute = true;
    else if (name === '--reboot-owned-target') values.reboot = true;
    else if (['--platform', '--receipt', '--out', '--run-id', '--serial', '--avd-name'].includes(name) && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('--')) values[name.slice(2)] = args[++index];
    else throw new Error('Use --platform android|ios --receipt relative.json --out .tmp/... [--run-id 32hex --serial emulator-N --avd-name LiteraryPlanet-V12-32hex --execute --reboot-owned-target].');
  }
  const report = await runNativeInstallRuntime({ platform: values.platform, receiptPath: values.receipt, outDir: values.out,
    runId: values['run-id'], serial: values.serial, avdName: values['avd-name'], execute: values.execute, reboot: values.reboot });
  process.stdout.write(json({ status: report.status, platform: report.platform, runId: report.runId, releaseReady: false }));
  process.exitCode = report.status === 'PASS' ? 0 : 2;
}
