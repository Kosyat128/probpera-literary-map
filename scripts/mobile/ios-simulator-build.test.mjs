import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import { CAPACITOR_SWIFT_REVISION, DEVELOPER_DIR, EVIDENCE_DIR, EVIDENCE_FILES, IOS_PROJECT, runGate, validateAppInfo, validatePreparation, validateResolvedPackages, validateSchemes, validateToolchain, verifyCopiedPublic } from './ios-simulator-build.mjs';

// Real temporary files and YAML parsing; Xcode/audit JSON below are explicitly
// test fixtures. These tests neither compile nor launch an iOS application.
const checkout = fileURLToPath(new URL('../../', import.meta.url));
const tempParent = path.join(checkout, '.tmp');
const roots = [];
const SHA = 'a'.repeat(40), BUILD = 'b'.repeat(64);
const json = value => JSON.stringify(value, null, 2) + '\n';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const metadata = () => ({ kind: 'literary-planet-bundled-native-preparation', platform: 'ios', channel: 'dev', buildId: BUILD, sourceCommit: SHA, releaseReady: false, productionActionsAuthorized: false });
const audit = () => ({ pass: true, findings: [], releaseReady: false, sourceFreshnessChecked: true, identity: { buildId: BUILD, sourceCommit: SHA, platform: 'ios', channel: 'dev' } });
const resolution = () => ({ version: 3, pins: [{ identity: 'capacitor-swift-pm', kind: 'remoteSourceControl', location: 'https://github.com/ionic-team/capacitor-swift-pm.git', state: { version: '8.5.1', revision: CAPACITOR_SWIFT_REVISION } }] });
const appInfo = () => ({ CFBundleIdentifier: 'ru.probpera.literaryplanet', CFBundleExecutable: 'App', CFBundlePackageType: 'APPL', CFBundleSupportedPlatforms: ['iPhoneSimulator'], DTPlatformName: 'iphonesimulator' });
const config = { appId: 'ru.probpera.literaryplanet', appName: 'Literary Planet', webDir: 'dist-native', server: { hostname: 'localhost', iosScheme: 'capacitor' } };
const syncedConfig = () => ({ ...config, packageClassList: ['AppPlugin', 'AppLauncherPlugin', 'CAPBrowserPlugin', 'CAPNetworkPlugin', 'PreferencesPlugin'] });
async function put(root, relative, value) {
  const filename = path.join(root, relative);
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, typeof value === 'string' ? value : json(value));
}
async function fixture() {
  await mkdir(tempParent, { recursive: true });
  const root = await mkdtemp(path.join(tempParent, 'ios-ci-test-'));
  roots.push(root);
  await put(root, EVIDENCE_DIR + '/audit-before-sync.json', audit());
  await put(root, EVIDENCE_DIR + '/audit-after-sync.json', audit());
  await put(root, EVIDENCE_DIR + '/audit-after-build.json', audit());
  await put(root, 'dist-native/artifact.json', metadata());
  await put(root, 'dist-native/index.html', '<div id="root"></div>');
  await put(root, 'dist-native/.vite/manifest.json', { entry: 'assets/app.js' });
  await put(root, 'dist-native/assets/app.js', '/* canonical fixture */');
  await put(root, 'capacitor.config.json', config);
  const native = path.join(root, 'apps/mobile/ios/App/App');
  await cp(path.join(root, 'dist-native'), path.join(native, 'public'), { recursive: true });
  await put(native, 'public/cordova.js', '');
  await put(native, 'public/cordova_plugins.js', '');
  await put(native, 'capacitor.config.json', syncedConfig());
  await put(root, IOS_PROJECT + '/project.xcworkspace/xcshareddata/swiftpm/Package.resolved', resolution());
  return { root, native, options: { root, expectedCommit: SHA, developerDir: DEVELOPER_DIR }, evidence: path.join(root, EVIDENCE_DIR) };
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (path.dirname(root) !== tempParent || !path.basename(root).startsWith('ios-ci-test-')) throw new Error('Refuse unowned fixture cleanup');
    await rm(root, { recursive: true, force: true });
  }
});

describe('actual toolchain and preparation evidence gates', () => {
  const toolchain = () => ({ version: 'Xcode 26.6\nBuild version 17F113\n', architecture: 'arm64\n', developerDir: DEVELOPER_DIR, sourceCommit: SHA + '\n', expectedCommit: SHA, node: 'v24.20.0\n', npm: '11.17.0\n' });
  it('accepts only the selected actual toolchain and commit', () => expect(() => validateToolchain(toolchain())).not.toThrow());
  it.each([
    ['version', 'Xcode 27.0\nBuild version beta'], ['version', 'Xcode 26.6\nBuild version other'],
    ['architecture', 'x86_64'], ['developerDir', '/Applications/Xcode-beta.app/Contents/Developer'],
    ['sourceCommit', 'd'.repeat(40)], ['expectedCommit', ''], ['node', 'v24.18.0'], ['npm', '10.0.0'],
  ])('rejects unapproved %s toolchain drift', (key, value) => expect(() => validateToolchain({ ...toolchain(), [key]: value })).toThrow());
  it('requires the actual named scheme, target and Debug configuration', () => {
    expect(() => validateSchemes({ project: { targets: ['App'], schemes: ['App'], configurations: ['Debug', 'Release'] } })).not.toThrow();
  });
  it.each([
    { targets: ['App'], schemes: [], configurations: ['Debug'] },
    { targets: ['App'], schemes: 'App', configurations: ['Debug'] },
    { targets: ['Other'], schemes: ['App'], configurations: ['Debug'] },
    { targets: ['App'], schemes: ['App'], configurations: ['Release'] },
  ])('rejects an absent or malformed Xcode scheme report', project => expect(() => validateSchemes({ project })).toThrow());
  it('binds successful current-source audit to exact ios/dev metadata', () => expect(() => validatePreparation(metadata(), audit(), SHA)).not.toThrow());
  it.each([
    { platform: 'android' }, { channel: 'appStore' }, { releaseReady: true }, { productionActionsAuthorized: true }, { sourceCommit: 'e'.repeat(40) }, { buildId: 'unknown' },
  ])('rejects incompatible artifact identity %j', patch => expect(() => validatePreparation({ ...metadata(), ...patch }, audit(), SHA)).toThrow());
  it.each([
    { pass: false }, { sourceFreshnessChecked: false }, { findings: [{}] }, { identity: { ...audit().identity, buildId: 'd'.repeat(64) } }, { releaseReady: true },
  ])('rejects incomplete or mismatched audit %j', patch => expect(() => validatePreparation(metadata(), { ...audit(), ...patch }, SHA)).toThrow());
  it('captures the first resolve without pretending it was a checked-in lock', () => expect(() => validateResolvedPackages(resolution())).not.toThrow());
  it.each(['version', 'revision', 'location', 'identity'])('rejects changed Swift package %s', key => {
    const value = resolution();
    if (key === 'version' || key === 'revision') value.pins[0].state[key] = 'unreviewed';
    else value.pins[0][key] = 'unreviewed';
    expect(() => validateResolvedPackages(value)).toThrow();
  });
  it('rejects an unexpected second remote package', () => { const value = resolution(); value.pins.push(value.pins[0]); expect(() => validateResolvedPackages(value)).toThrow(); });
  it('rejects a syntactically valid but unreviewed exact-version revision', () => { const value = resolution(); value.pins[0].state.revision = 'a'.repeat(40); expect(() => validateResolvedPackages(value)).toThrow('revision'); });
  it('checks simulator plist and every reported Mach-O architecture', () => expect(() => validateAppInfo(appInfo(), '  platform IOSSIMULATOR\n  platform IOSSIMULATOR\n')).not.toThrow());
  it.each(['', '  platform IOS\n', '  platform IOSSIMULATOR\n  platform IOS\n'])('rejects absent or device Mach-O platform', binary => expect(() => validateAppInfo(appInfo(), binary)).toThrow());
  it('rejects a foreign bundle despite a simulator Mach-O report', () => expect(() => validateAppInfo({ ...appInfo(), CFBundleIdentifier: 'other.app' }, 'platform IOSSIMULATOR')).toThrow());
});

describe('real public-copy and integration evidence fixtures', () => {
  it('preserves hidden Vite metadata and all bytes, permits only both empty Cordova files', async () => {
    const { root, native } = await fixture();
    expect(await verifyCopiedPublic(path.join(root, 'dist-native'), path.join(native, 'public'))).toEqual({ canonicalFiles: 4, additionalEmptyCompatibilityFiles: 2, artifactSha256: digest(json(metadata())) });
  });
  it.each(['assets/app.js', 'index.html', '.vite/manifest.json', 'artifact.json'])('rejects changed copied %s', async relative => {
    const { root, native } = await fixture();
    await put(native, 'public/' + relative, 'changed');
    await expect(verifyCopiedPublic(path.join(root, 'dist-native'), path.join(native, 'public'))).rejects.toThrow('Changed or missing');
  });
  it.each(['cordova.js', 'cordova_plugins.js', 'private.json', 'extra.js'])('rejects nonempty or additional %s', async relative => {
    const { root, native } = await fixture();
    await put(native, 'public/' + relative, 'unexpected');
    await expect(verifyCopiedPublic(path.join(root, 'dist-native'), path.join(native, 'public'))).rejects.toThrow('Unreviewed extra');
  });
  it('rejects a missing compatibility file', async () => {
    const { root, native } = await fixture();
    await rm(path.join(native, 'public/cordova.js'));
    await expect(verifyCopiedPublic(path.join(root, 'dist-native'), path.join(native, 'public'))).rejects.toThrow('exact empty');
  });
  it('rejects a directory junction instead of trusting its contents', async () => {
    const { root, native } = await fixture();
    await symlink(path.join(root, 'dist-native/assets'), path.join(native, 'public/linked'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(verifyCopiedPublic(path.join(root, 'dist-native'), path.join(native, 'public'))).rejects.toThrow('Linked public');
  });
  it('writes actual hashes for the prepared/synced fixture and refuses overwriting evidence', async () => {
    const { options, evidence } = await fixture();
    await runGate('prepared', options);
    await runGate('synced', options);
    const report = JSON.parse(await readFile(path.join(evidence, 'sync-integrity.json')));
    expect(report).toMatchObject({ buildId: BUILD, sourceCommit: SHA, releaseReady: false, canonicalFiles: 4, artifactSha256: digest(json(metadata())), configSha256: digest(json(syncedConfig())) });
    await expect(runGate('prepared', options)).rejects.toThrow();
  });
  it('rejects changing artifact metadata after the first audit', async () => {
    const { root, options } = await fixture();
    await runGate('prepared', options);
    await put(root, 'dist-native/artifact.json', { ...metadata(), extra: 'different bytes' });
    await expect(runGate('synced', options)).rejects.toThrow('identity changed');
  });
  it('rejects a remote URL injected into the synchronized runtime config', async () => {
    const { native, options } = await fixture();
    await runGate('prepared', options);
    await put(native, 'capacitor.config.json', { ...syncedConfig(), server: { url: 'https://example.com/' } });
    await expect(runGate('synced', options)).rejects.toThrow('runtime configuration');
  });
  it('binds built fixture bytes, platform and unchanged generated resolution', async () => {
    const { root, native, options, evidence } = await fixture();
    await runGate('prepared', options);
    await runGate('resolved', options);
    const runnerTemp = path.join(root, 'runner');
    await cp(native, path.join(runnerTemp, 'ios-derived/Build/Products/Debug-iphonesimulator/App.app'), { recursive: true });
    await put(evidence, 'app-info.json', appInfo());
    await put(evidence, 'mach-o-build.txt', ' platform IOSSIMULATOR\n');
    await runGate('built', { ...options, runnerTemp });
    expect(JSON.parse(await readFile(path.join(evidence, 'simulator-bundle.json')))).toMatchObject({ phase: 'built', releaseReady: false, buildId: BUILD });
    await put(root, IOS_PROJECT + '/project.xcworkspace/xcshareddata/swiftpm/Package.resolved', { ...resolution(), extra: true });
    await expect(runGate('built', { ...options, runnerTemp })).rejects.toThrow('resolution changed');
  });
  it('failed audit cannot produce a successful preparation receipt', async () => {
    const { options, evidence } = await fixture();
    await put(evidence, 'audit-before-sync.json', { ...audit(), pass: false });
    await expect(runGate('prepared', options)).rejects.toThrow('passing current-source');
    await expect(readFile(path.join(evidence, 'artifact.json'))).rejects.toThrow();
  });
  it('hashes existing diagnostics after failure without claiming a build passed', async () => {
    const { options, evidence } = await fixture();
    await put(evidence, 'xcode-build.log', 'fixture: build failed\n');
    await runGate('evidence', options);
    const result = JSON.parse(await readFile(path.join(evidence, 'checksums.json')));
    expect(result.releaseReady).toBe(false);
    expect(result).not.toHaveProperty('pass');
    expect(result.files).toContainEqual({ path: 'xcode-build.log', bytes: 22, sha256: digest('fixture: build failed\n') });
    expect(result.files.some(file => file.path === 'simulator-bundle.json')).toBe(false);
  });
  it('unknown gate rejects before touching supplied paths', async () => {
    await expect(runGate('deploy', { root: 'does-not-exist' })).rejects.toThrow('explicit iOS CI evidence gate');
  });
  it('rejects unrelated diagnostics instead of extending the upload scope', async () => {
    const { options, evidence } = await fixture();
    await put(evidence, 'unrelated-private.txt', 'not part of the artifact');
    await expect(runGate('evidence', options)).rejects.toThrow('Unrecognized diagnostic');
    await expect(readFile(path.join(evidence, 'checksums.json'))).rejects.toThrow();
  });
  it('rejects an allowed diagnostic name linked to an outside directory', async () => {
    const { root, options, evidence } = await fixture();
    await symlink(path.join(root, 'dist-native'), path.join(evidence, 'npm-ci.log'), process.platform === 'win32' ? 'junction' : 'dir');
    await expect(runGate('evidence', options)).rejects.toThrow('regular files only');
    await expect(readFile(path.join(evidence, 'checksums.json'))).rejects.toThrow();
  });
  it('CLI has no implicit action and cannot reflect unrelated credentials', () => {
    const result = spawnSync(process.execPath, [path.join(checkout, 'scripts/mobile/ios-simulator-build.mjs'), '--run', '--secret=sentinel-secret'], { encoding: 'utf8', env: { ...process.env, UNUSED_SECRET: 'other-sentinel' } });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toMatch(/sentinel|other-sentinel/);
  });
});

describe('actual draft workflow safety contract', () => {
  async function workflow() {
    const document = parseDocument(await readFile(path.join(checkout, '.github/workflows/mobile-ios-simulator.yml'), 'utf8'), { uniqueKeys: true });
    expect(document.errors).toEqual([]);
    return document.toJS();
  }
  it('limits execution to the exact repository, branch and explicit dispatch/push events', async () => {
    const value = await workflow();
    expect(Object.keys(value.on).sort()).toEqual(['push', 'workflow_dispatch']);
    expect(value.on.push).toEqual({ branches: ['codex/literary-planet-v12-bilingual-final-autopilot', 'codex/literary-planet-v12-ios-ci'], paths: ['.github/workflows/mobile-ios-simulator.yml', 'scripts/mobile/ios-simulator-*'] });
    expect(value.permissions).toEqual({ contents: 'read' });
    const job = value.jobs.simulator;
    expect(job.if.replace(/\s+/gu, ' ')).toBe("github.repository == 'Kosyat128/probpera-literary-map' && (github.ref == 'refs/heads/codex/literary-planet-v12-bilingual-final-autopilot' || github.ref == 'refs/heads/codex/literary-planet-v12-ios-ci') && (github.event_name == 'workflow_dispatch' || github.event_name == 'push')");
    expect(job['runs-on']).toBe('macos-26');
    expect(job.env.DEVELOPER_DIR).toBe(DEVELOPER_DIR);
  });
  it('uses only verified immutable official actions and no persisted credentials/cache', async () => {
    const steps = (await workflow()).jobs.simulator.steps;
    expect(steps.filter(step => step.uses).map(step => step.uses)).toEqual([
      'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
      'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020',
      'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
    ]);
    expect(steps[0].with['persist-credentials']).toBe(false);
    expect(steps[1].with['package-manager-cache']).toBe(false);
    expect(steps.at(-1).with.path.trim().split('\n')).toEqual(EVIDENCE_FILES.map(name => EVIDENCE_DIR + '/' + name));
    expect(steps.at(-1).with.path).not.toContain('*');
    expect(steps.find(step => step.id === 'evidence').if).toBe('always()');
    expect(steps.at(-1).if).toBe("always() && steps.evidence.outcome == 'success'");
  });
  it('keeps strict audits around sync/build and contains no signing/distribution command', async () => {
    const runs = (await workflow()).jobs.simulator.steps.filter(step => step.run).map(step => step.run);
    const source = runs.join('\n');
    for (const run of runs) expect(run.startsWith('set -euo pipefail\n')).toBe(true);
    expect(source).toContain('npm ci --ignore-scripts');
    expect(source).toContain('node scripts/mobile/build-native.mjs ios dev');
    expect(source.match(/node scripts\/mobile\/verify-native-artifact.mjs --dir dist-native/g)).toHaveLength(3);
    expect(source).not.toMatch(/--no-source-freshness|allowProvisioning|\barchive\b|exportArchive|altool|notarytool|fastlane|gh workflow|secrets\.|git push/u);
    expect(source).toContain("CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY=''");
    expect(source).toContain("-destination 'generic/platform=iOS Simulator'");
    expect(source.indexOf('ios-simulator-build.mjs built')).toBeLessThan(source.indexOf('ditto -c -k --sequesterRsrc --keepParent'));
  });
});
