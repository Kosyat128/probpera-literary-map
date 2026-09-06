/** Local CI evidence gates. No subprocesses, signing, upload or remote dispatch.
 * The workflow performs the real commands; these checks never assert execution
 * merely from this file's presence. Public-copy checks are not a binary audit. */
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, realpath, writeFile } from 'node:fs/promises';
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
  'ios-build.xcresult.zip', 'checksums.json',
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

export async function runGate(step, { root, runnerTemp, expectedCommit, developerDir } = {}) {
  check(['toolchain', 'prepared', 'synced', 'scheme', 'resolved', 'built', 'evidence'].includes(step), 'Use one explicit iOS CI evidence gate.');
  root = await realpath(root);
  const directory = path.join(root, EVIDENCE_DIR);
  check(await realpath(directory) === directory && (await lstat(directory)).isDirectory(), 'Expected a real CI evidence directory.');
  const read = async filename => (await regular(directory, filename, 16 * 1024 * 1024)).toString('utf8');
  const readJson = async filename => JSON.parse(await read(filename));
  const save = (filename, value) => writeFile(path.join(directory, filename), json(value), { flag: 'wx' });
  if (step === 'toolchain') {
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
    process.stdout.write('iOS CI evidence gate passed; no build is executed by this helper.\n');
  } catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
