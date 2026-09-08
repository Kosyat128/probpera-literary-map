/** CI evidence gates and an explicit, bounded Simulator smoke command.
 * No signing, upload or remote dispatch. A captured screen is not UI approval.
 * Public-copy checks are not a native binary audit. */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const IOS_PROJECT = 'apps/mobile/ios/App/App.xcodeproj';
export const EVIDENCE_DIR = '.tmp/ios-simulator-ci';
export const EVIDENCE_FILES = Object.freeze([
  'macos.txt', 'architecture.txt', 'installed-xcodes.txt', 'xcode-version.txt',
  'xcode-sdks.txt', 'simulators.json', 'node-version.txt', 'npm-version.txt',
  'source-commit.txt', 'npm-ci.log', 'types.log', 'web-build.log',
  'audit-before-sync.json', 'artifact.json', 'audit-after-sync.json', 'cap-sync.log',
  'sync-integrity.json', 'schemes.json', 'package-resolution.log', 'Package.resolved',
  'xcode-build.log', 'app-info.json', 'mach-o-build.txt', 'audit-after-build.json',
  'simulator-bundle.json', 'App-simulator.app.zip', 'App-simulator.app.tar.gz',
  'ios-build.xcresult.zip', 'simctl-help.txt', 'simulator-runtime.json',
  'simulator-ru.log', 'simulator-en.log', 'simulator-ru.png', 'simulator-en.png',
  'checksums.json',
]);
export const DEVELOPER_DIR = '/Applications/Xcode_26.6.app/Contents/Developer';
// Official refs/tags/8.5.1, verified 2026-09-06 (lightweight tag, no dereference).
// https://github.com/ionic-team/capacitor-swift-pm/tree/6afa7424fd2fcd8ca1e577478e8a00af284b7e82
export const CAPACITOR_SWIFT_REVISION = '6afa7424fd2fcd8ca1e577478e8a00af284b7e82';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const check = (condition, message) => { if (!condition) throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateToolchain({ version, architecture, developerDir, sourceCommit, expectedCommit, node, npm }) {
  check(version.trim() === 'Xcode 26.6\nBuild version 17F113', 'Unexpected Xcode version; no automatic fallback.');
  check(architecture.trim() === 'arm64' && developerDir === DEVELOPER_DIR, 'Unexpected runner architecture or selected developer directory.');
  check(/^[a-f0-9]{40}$/u.test(expectedCommit) && sourceCommit.trim() === expectedCommit, 'Checkout must match the dispatched commit.');
  check(node.trim() === 'v24.20.0' && /^11\.[0-9]+\.[0-9]+$/u.test(npm.trim()), 'Unexpected Node/npm toolchain.');
}

export function validateSchemes(value) {
  check(object(value?.project) && ['targets', 'schemes', 'configurations'].every(key => Array.isArray(value.project[key]) && value.project[key].every(item => typeof item === 'string')) && value.project.targets.includes('App') && value.project.schemes.includes('App') && value.project.configurations.includes('Debug'), 'The actual Xcode project must expose App target, App scheme and Debug configuration.');
}

export function validatePreparation(artifact, audit, expectedCommit) {
  check(artifact?.kind === 'literary-planet-bundled-native-preparation' && artifact.platform === 'ios' && artifact.channel === 'dev' && artifact.releaseReady === false && artifact.productionActionsAuthorized === false, 'Only an unreleased ios/dev preparation is allowed.');
  check(/^[a-f0-9]{40}$/u.test(expectedCommit) && artifact.sourceCommit === expectedCommit && /^[a-f0-9]{64}$/u.test(artifact.buildId), 'Wrong source or build identity.');
  check(audit?.pass === true && audit.sourceFreshnessChecked === true && audit.releaseReady === false && Array.isArray(audit.findings) && audit.findings.length === 0, 'A passing current-source native artifact audit is required.');
  for (const key of ['buildId', 'sourceCommit', 'platform', 'channel']) check(audit.identity?.[key] === artifact[key], 'Audit identity mismatch.');
}

export function validateResolvedPackages(value) {
  check([2, 3].includes(value?.version) && Array.isArray(value.pins) && value.pins.length === 1, 'Review changed Swift package resolution before using it.');
  const pin = value.pins[0];
  check(pin.identity === 'capacitor-swift-pm' && pin.kind === 'remoteSourceControl' && pin.location === 'https://github.com/ionic-team/capacitor-swift-pm.git' && pin.state?.version === '8.5.1' && pin.state?.revision === CAPACITOR_SWIFT_REVISION, 'Unexpected Capacitor Swift package identity/version/revision.');
}

export function validateAppInfo(info, machO) {
  check(info?.CFBundleIdentifier === 'ru.probpera.literaryplanet' && info.CFBundleExecutable === 'App' && info.CFBundlePackageType === 'APPL' && JSON.stringify(info.CFBundleSupportedPlatforms) === '["iPhoneSimulator"]' && info.DTPlatformName === 'iphonesimulator', 'Expected the canonical simulator App bundle.');
  const platforms = [...machO.matchAll(/^\s*platform\s+(\S+)\s*$/gmu)].map(match => match[1]);
  check(platforms.length > 0 && platforms.every(value => value === 'IOSSIMULATOR'), 'Every reported Mach-O build platform must be IOSSIMULATOR.');
}

async function regular(base, relative, max = 64 * 1024 * 1024) {
  check(typeof relative === 'string' && relative.length > 0 && !/[\\%?#:\u0000-\u0020\u007f]/u.test(relative) && !relative.startsWith('/') && relative.split('/').every(part => part && part !== '.' && part !== '..'), 'Unsafe evidence path.');
  const filename = path.resolve(base, relative), stat = await lstat(filename);
  check(stat.isFile() && !stat.isSymbolicLink() && stat.size <= max && await realpath(filename) === filename, 'Expected a bounded regular file without links.');
  return readFile(filename);
}

async function tree(directory, prefix = '', depth = 0, files = new Map()) {
  check(depth <= 12 && await realpath(directory) === path.resolve(directory), 'Linked or deeply nested public payload.');
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    check(!entry.isSymbolicLink(), 'Linked public payload.');
    const relative = prefix + entry.name;
    if (entry.isDirectory()) await tree(path.join(directory, entry.name), relative + '/', depth + 1, files);
    else {
      check(entry.isFile() && files.size < 4096, 'Unexpected or oversized public payload.');
      const bytes = await regular(directory, entry.name);
      files.set(relative, { bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  return files;
}

/** Capacitor 8.5.1 adds two empty compatibility files when no Cordova plugins
 * are installed. No other additions or changed canonical output are allowed. */
export async function verifyCopiedPublic(artifactDirectory, copiedDirectory) {
  const source = await tree(artifactDirectory), copied = await tree(copiedDirectory);
  for (const [filename, expected] of source) check(JSON.stringify(copied.get(filename)) === JSON.stringify(expected), 'Changed or missing copied public file: ' + filename);
  const compatibility = new Set(['cordova.js', 'cordova_plugins.js']);
  for (const [filename, actual] of copied) if (!source.has(filename)) check(compatibility.delete(filename) && actual.bytes === 0, 'Unreviewed extra public file: ' + filename);
  check(compatibility.size === 0, 'Expected the exact empty Capacitor compatibility files.');
  return { canonicalFiles: source.size, additionalEmptyCompatibilityFiles: 2, artifactSha256: source.get('artifact.json')?.sha256 };
}

async function verifyConfig(root, copiedDirectory) {
  const canonical = JSON.parse(await regular(root, 'capacitor.config.json'));
  const bytes = await regular(copiedDirectory, 'capacitor.config.json');
  const actual = JSON.parse(bytes);
  check(JSON.stringify(actual.packageClassList) === '["AppPlugin","AppLauncherPlugin","CAPBrowserPlugin","CAPNetworkPlugin","PreferencesPlugin"]', 'Unexpected native plugins.');
  delete actual.packageClassList;
  check(JSON.stringify(actual) === JSON.stringify(canonical) && canonical.webDir === 'dist-native' && !canonical.server?.url && !canonical.server?.allowNavigation, 'Changed native runtime configuration.');
  return sha256(bytes);
}

export function selectSmokeTarget(value) {
  check(Array.isArray(value?.runtimes) && Array.isArray(value.devicetypes), 'Expected actual simctl inventory.');
  const runtimes = value.runtimes.filter(item => item.isAvailable === true && /^com\.apple\.CoreSimulator\.SimRuntime\.iOS-\d+-\d+(?:-\d+)?$/u.test(item.identifier) && /^\d+(?:\.\d+){1,2}$/u.test(item.version) && !/beta|preview|seed/iu.test(item.name ?? ''));
  runtimes.sort((a, b) => b.version.localeCompare(a.version, 'en', { numeric: true }));
  const types = value.devicetypes.filter(item => /^iPhone \d+$/u.test(item.name) && /^com\.apple\.CoreSimulator\.SimDeviceType\.iPhone-\d+$/u.test(item.identifier));
  types.sort((a, b) => b.name.localeCompare(a.name, 'en', { numeric: true }));
  check(runtimes.length > 0 && types.length > 0, 'No installed stable iOS runtime and standard iPhone device type.');
  return { runtime: { identifier: runtimes[0].identifier, version: runtimes[0].version, name: runtimes[0].name }, deviceType: { identifier: types[0].identifier, name: types[0].name } };
}

export function simulatorLaunchPid(output) {
  const match = /^ru\.probpera\.literaryplanet:\s*([1-9]\d*)\s*$/u.exec(output.trim());
  check(match && Number.isSafeInteger(Number(match[1])), 'simctl did not report the canonical application PID.');
  return Number(match[1]);
}

/** This command runs only on the authorized disposable GitHub macOS runner. */
export async function runSimulatorSmoke({ root, runnerTemp, expectedCommit, developerDir }) {
  check(process.platform === 'darwin' && process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY === 'Kosyat128/probpera-literary-map' && /^refs\/heads\/codex\/literary-planet-v12-(?:ios-ci|bilingual-final-autopilot)$/u.test(process.env.GITHUB_REF ?? ''), 'Simulator smoke requires the authorized macOS CI branch.');
  check(developerDir === DEVELOPER_DIR && typeof runnerTemp === 'string' && path.isAbsolute(runnerTemp), 'Expected the selected Xcode and real runner temporary directory.');
  const directory = path.join(root, EVIDENCE_DIR);
  const readJson = async filename => JSON.parse(await regular(directory, filename, 16 * 1024 * 1024));
  const artifact = await readJson('artifact.json');
  validatePreparation(artifact, await readJson('audit-after-build.json'), expectedCommit);
  validateAppInfo(await readJson('app-info.json'), (await regular(directory, 'mach-o-build.txt')).toString('utf8'));
  const app = path.join(await realpath(runnerTemp), 'ios-derived/Build/Products/Debug-iphonesimulator/App.app');
  const executableSha256 = sha256(await regular(app, 'App'));
  const artifactSha256 = sha256(await regular(directory, 'artifact.json'));
  check(sha256(await regular(app, 'public/artifact.json')) === artifactSha256, 'Built application does not contain this preparation.');
  const report = { schemaVersion: 1, kind: 'ios-simulator-runtime-smoke', sourceCommit: expectedCommit, buildId: artifact.buildId, executableSha256, artifactSha256, startedAt: new Date().toISOString(), locales: [], smokePassed: false, visibleUiVerified: false, localeUiVerified: false, exactRcScreenshots: false, releaseReady: false, productionActionsPerformed: false, limitations: ['Boot, install, process liveness and screenshot capture only. The captured images require visual review before claiming a visible localized application.', 'Historical authorized source projection; no current-main, physical-device, purchase, child-mode or store acceptance.'] };
  const help = [];
  const abort = new AbortController();
  const interrupted = () => abort.abort();
  process.once('SIGTERM', interrupted);
  process.once('SIGINT', interrupted);
  const command = async (binary, args, transcript, timeoutMs = 30_000, cleanup = false) => {
    const started = Date.now();
    const entry = { binary, args, startedAt: new Date(started).toISOString(), timeoutMs };
    transcript.push(entry);
    return new Promise((resolve, reject) => {
      let deadline, timedOut = false;
      const child = execFile(binary, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, killSignal: 'SIGKILL', ...(cleanup ? {} : { signal: abort.signal }) }, (error, stdout, stderr) => {
        clearTimeout(deadline);
        Object.assign(entry, { exitCode: error ? (typeof error.code === 'number' ? error.code : null) : 0, errorCode: typeof error?.code === 'string' ? error.code : null, signal: error?.signal ?? null, killed: error?.killed === true, timedOut, elapsedMs: Date.now() - started, stdout, stderr, finishedAt: new Date().toISOString() });
        if (error) reject(new Error('Simulator command failed: ' + args.slice(0, 3).join(' ') + ' (' + String(error.code ?? error.signal) + ')'));
        else resolve(stdout);
      });
      // Record our own deadline firing; a received SIGKILL alone is not a timeout diagnosis.
      deadline = setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          timedOut = true;
          child.kill('SIGKILL');
        }
      }, timeoutMs);
    });
  };
  const simctl = (args, transcript, timeoutMs, cleanup) => command('/usr/bin/xcrun', ['simctl', ...args], transcript, timeoutMs, cleanup);
  try {
    // Capture the actual installed CLI contract before using its subcommands.
    for (const name of ['list', 'create', 'boot', 'bootstatus', 'install', 'get_app_container', 'launch', 'io', 'shutdown', 'delete']) {
      await simctl(['help', name], help);
      const text = help.at(-1).stdout + help.at(-1).stderr;
      check(text.includes(name) && (name !== 'bootstatus' || /-b\b/u.test(text)) && (name !== 'io' || text.includes('screenshot')), 'Installed simctl help does not describe required command: ' + name);
    }
    report.target = selectSmokeTarget(JSON.parse(await simctl(['list', '--json'], help)));
    const { default: sharp } = await import('sharp');
    for (const locale of ['ru', 'en']) {
      const transcript = [];
      const result = { locale, languageArguments: ['-AppleLanguages', '(' + locale + ')', '-AppleLocale', locale === 'ru' ? 'ru_RU' : 'en_US'], booted: false, installed: false, launched: false, livenessChecks: [], screenshotCaptured: false, cleanup: { shutdown: false, deleted: false } };
      report.locales.push(result);
      let ownedDevice;
      try {
        const id = (await simctl(['create', 'LiteraryPlanet-' + expectedCommit.slice(0, 8) + '-' + locale, report.target.deviceType.identifier, report.target.runtime.identifier], transcript)).trim();
        check(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(id), 'simctl create did not return one device UUID.');
        ownedDevice = id;
        result.deviceId = id;
        await simctl(['boot', id], transcript, 60_000);
        await simctl(['bootstatus', id, '-b'], transcript, 180_000);
        result.booted = true;
        await simctl(['install', id, app], transcript, 240_000);
        const installed = (await simctl(['get_app_container', id, 'ru.probpera.literaryplanet', 'app'], transcript)).trim();
        check(path.isAbsolute(installed) && path.basename(installed) === 'App.app' && installed.split(path.sep).includes(id), 'Installed bundle must belong to the newly created simulator.');
        check(sha256(await regular(installed, 'App')) === executableSha256 && sha256(await regular(installed, 'public/artifact.json')) === artifactSha256, 'Installed application differs from the compiled preparation.');
        await verifyCopiedPublic(path.join(root, 'dist-native'), path.join(installed, 'public'));
        await verifyConfig(root, installed);
        result.installed = true;
        result.pid = simulatorLaunchPid(await simctl(['launch', id, 'ru.probpera.literaryplanet', ...result.languageArguments], transcript, 30_000));
        result.launched = true;
        // Bounded process observation is not a claim that the WebView UI is ready.
        for (let observation = 0; observation < 3; observation++) {
          await delay(4_000, undefined, { signal: abort.signal });
          const status = (await command('/bin/ps', ['-p', String(result.pid), '-o', 'pid=,comm='], transcript, 10_000)).trim();
          const match = /^(\d+)\s+(.+)$/u.exec(status);
          check(match && Number(match[1]) === result.pid && path.basename(match[2]) === 'App', 'Launched App did not remain alive.');
          result.livenessChecks.push({ observedAt: new Date().toISOString(), pid: result.pid });
        }
        const filename = 'simulator-' + locale + '.png';
        await simctl(['io', id, 'screenshot', '--type=png', path.join(directory, filename)], transcript, 30_000);
        const bytes = await regular(directory, filename, 32 * 1024 * 1024);
        const metadata = await sharp(bytes).metadata();
        const stats = await sharp(bytes).stats();
        check(metadata.format === 'png' && metadata.width >= 320 && metadata.height >= 320 && stats.channels.some(channel => channel.stdev > 0.1), 'Expected a decodable, nonuniform Simulator screenshot.');
        result.screenshot = { path: filename, bytes: bytes.length, sha256: sha256(bytes), width: metadata.width, height: metadata.height };
        result.screenshotCaptured = true;
      } finally {
        // Cleanup is restricted to the UUID returned by this iteration's create.
        if (ownedDevice) {
          try { await simctl(['shutdown', ownedDevice], transcript, 30_000, true); result.cleanup.shutdown = true; }
          catch { result.cleanup.shutdown = false; }
          try { await simctl(['delete', ownedDevice], transcript, 30_000, true); result.cleanup.deleted = true; }
          catch { result.cleanup.deleted = false; }
        }
        await writeFile(path.join(directory, 'simulator-' + locale + '.log'), json(transcript), { flag: 'wx' });
      }
      check(result.cleanup.deleted, 'The owned simulator was not deleted.');
    }
    report.smokePassed = report.locales.length === 2 && report.locales.every(result => result.booted && result.installed && result.launched && result.livenessChecks.length === 3 && result.screenshotCaptured && result.cleanup.deleted);
    check(report.smokePassed, 'Simulator runtime smoke incomplete.');
  } catch (error) {
    report.failure = error.message;
    throw error;
  } finally {
    process.removeListener('SIGTERM', interrupted);
    process.removeListener('SIGINT', interrupted);
    report.finishedAt = new Date().toISOString();
    await writeFile(path.join(directory, 'simctl-help.txt'), json(help), { flag: 'wx' });
    await writeFile(path.join(directory, 'simulator-runtime.json'), json(report), { flag: 'wx' });
  }
}

export async function runGate(step, { root, runnerTemp, expectedCommit, developerDir } = {}) {
  check(['toolchain', 'prepared', 'synced', 'scheme', 'resolved', 'built', 'smoke', 'evidence'].includes(step), 'Use one explicit iOS CI evidence gate.');
  root = await realpath(root);
  const directory = path.join(root, EVIDENCE_DIR);
  check(await realpath(directory) === directory && (await lstat(directory)).isDirectory(), 'Expected a real CI evidence directory.');
  const read = async filename => (await regular(directory, filename, 16 * 1024 * 1024)).toString('utf8');
  const readJson = async filename => JSON.parse(await read(filename));
  const save = (filename, value) => writeFile(path.join(directory, filename), json(value), { flag: 'wx' });
  if (step === 'smoke') await runSimulatorSmoke({ root, runnerTemp, expectedCommit, developerDir });
  else if (step === 'toolchain') {
    validateToolchain({ version: await read('xcode-version.txt'), architecture: await read('architecture.txt'), developerDir, sourceCommit: await read('source-commit.txt'), expectedCommit, node: await read('node-version.txt'), npm: await read('npm-version.txt') });
  } else if (step === 'scheme') validateSchemes(await readJson('schemes.json'));
  else if (step === 'resolved') {
    const bytes = await regular(root, IOS_PROJECT + '/project.xcworkspace/xcshareddata/swiftpm/Package.resolved');
    validateResolvedPackages(JSON.parse(bytes));
    await writeFile(path.join(directory, 'Package.resolved'), bytes, { flag: 'wx' });
  } else if (step === 'prepared' || step === 'synced' || step === 'built') {
    const artifactBytes = await regular(root, 'dist-native/artifact.json');
    const artifact = JSON.parse(artifactBytes);
    validatePreparation(artifact, await readJson('audit-before-sync.json'), expectedCommit);
    if (step === 'prepared') await writeFile(path.join(directory, 'artifact.json'), artifactBytes, { flag: 'wx' });
    else {
      check(sha256(artifactBytes) === sha256(await read('artifact.json')), 'Preparation identity changed during native integration.');
      validatePreparation(artifact, await readJson('audit-after-sync.json'), expectedCommit);
      let appDirectory = path.join(root, 'apps/mobile/ios/App/App');
      if (step === 'built') {
        validatePreparation(artifact, await readJson('audit-after-build.json'), expectedCommit);
        check(typeof runnerTemp === 'string' && path.isAbsolute(runnerTemp), 'Expected the real runner temporary directory.');
        appDirectory = path.join(await realpath(runnerTemp), 'ios-derived/Build/Products/Debug-iphonesimulator/App.app');
        validateAppInfo(await readJson('app-info.json'), await read('mach-o-build.txt'));
        const currentResolved = await regular(root, IOS_PROJECT + '/project.xcworkspace/xcshareddata/swiftpm/Package.resolved');
        check(sha256(currentResolved) === sha256(await read('Package.resolved')), 'Package resolution changed during build.');
      }
      const payload = await verifyCopiedPublic(path.join(root, 'dist-native'), path.join(appDirectory, 'public'));
      const configSha256 = await verifyConfig(root, appDirectory);
      await save(step === 'synced' ? 'sync-integrity.json' : 'simulator-bundle.json', { kind: 'ios-simulator-preparation', phase: step, sourceCommit: expectedCommit, buildId: artifact.buildId, ...payload, configSha256, releaseReady: false, limitations: ['Local copy and simulator build metadata checks only; not device execution, arbitrary native binary audit, signed release or store approval.'] });
    }
  } else {
    const files = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      check(EVIDENCE_FILES.includes(entry.name), 'Unrecognized diagnostic file; refuse extending the upload scope.');
      check(entry.isFile() && !entry.isSymbolicLink(), 'Evidence directory must contain regular files only.');
      const bytes = await regular(directory, entry.name, 1024 * 1024 * 1024);
      files.push({ path: entry.name, bytes: bytes.length, sha256: sha256(bytes) });
    }
    await save('checksums.json', { schemaVersion: 1, kind: 'ios-simulator-ci-evidence', files: files.sort((a, b) => a.path.localeCompare(b.path)), releaseReady: false });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    check(process.argv.length === 3, 'Use one explicit iOS CI evidence gate.');
    await runGate(process.argv[2], { root: fileURLToPath(new URL('../../', import.meta.url)), runnerTemp: process.env.RUNNER_TEMP, expectedCommit: process.env.GITHUB_SHA, developerDir: process.env.DEVELOPER_DIR });
    process.stdout.write(process.argv[2] === 'smoke' ? 'iOS Simulator launch/liveness/screenshots captured; visual review remains required.\n' : 'iOS CI evidence gate passed; no build is executed by this helper.\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
