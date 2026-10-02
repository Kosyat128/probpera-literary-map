import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bindXctestrun, xctestPassed, instrumentationPassed, parseAndroidCertificate, parseAndroidPackage, runNativeInstallRuntime,
  validateOwnedAndroidTarget, validateRuntimeReceipt } from './native-install-runtime.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
function receipt(platform = 'android') {
  const files = [{ path: 'src/synthetic-native.ts', sha256: 'a'.repeat(64) }];
  return { schemaVersion: 1, kind: 'literary-planet-native-binary-preparation', platform, channel: 'dev',
    sourceCommit: 'b'.repeat(40), sourceInputs: { files, sha256: hash(JSON.stringify(files, null, 2) + '\n') },
    artifactPath: platform === 'android' ? '.tmp/own-debug.apk' : '.tmp/own-simulator/App.app', artifactSha256: 'c'.repeat(64),
    testArtifactPath: '.tmp/own-debug-test.apk', testArtifactSha256: 'd'.repeat(64), webArtifactSha256: 'e'.repeat(64),
    xctestrunPath: '.tmp/own-simulator/native.xctestrun', xctestrunSha256: 'f'.repeat(64),
    applicationId: platform === 'android' ? 'ru.probpera.literaryplanet.dev' : 'ru.probpera.literaryplanet',
    versionCode: 1, versionName: '1.0-dev', releaseReady: false, deviceTested: false };
}
const temporary = [];
afterEach(async () => {
  for (const directory of temporary.splice(0)) {
    if (path.dirname(directory) !== path.resolve(os.tmpdir()) || !path.basename(directory).startsWith('literary-native-runtime-test-'))
      throw new Error('Refuse unowned test cleanup.');
    await rm(directory, { recursive: true, force: true });
  }
});

describe('exact-package local native runner gates', () => {
  it.each(['android', 'ios'])('accepts only a bound unreleased %s dev binary receipt', platform => {
    expect(validateRuntimeReceipt(receipt(platform), platform)).toEqual(receipt(platform));
  });
  it.each([{ channel: 'googlePlay' }, { channel: 'appStore' }, { releaseReady: true }, { deviceTested: true },
    { sourceCommit: 'unknown' }, { artifactSha256: 'wrong' }, { applicationId: 'other.app' }, { artifactPath: '../personal.apk' },
    { artifactPath: '.tmp/../../personal.apk' }, { artifactPath: 'C:/personal.apk' }, { artifactPath: '.tmp\\personal.apk' },
    { webArtifactSha256: null }, { versionCode: 0 }, { testArtifactSha256: 'wrong' }])
    ('rejects wrong channel, stale/unbound identity or unsafe artifact %j', patch => {
      expect(() => validateRuntimeReceipt({ ...receipt(), ...patch }, 'android')).toThrow();
    });
  it('binds a retained bundle independently of the later dist-native generation',()=>{
    const value={...receipt(),webArtifactPath:'.tmp/own-retained/native-bundle/artifact.json'};
    expect(validateRuntimeReceipt(value,'android')).toEqual(value);
    for(const webArtifactPath of ['../foreign/artifact.json','.tmp/../foreign/artifact.json','.tmp/file.json','C:/foreign/artifact.json'])
      expect(()=>validateRuntimeReceipt({...value,webArtifactPath},'android')).toThrow();
  });
  it('rejects a source digest that does not bind its actual manifest', () => {
    const value = receipt(); value.sourceInputs.files[0].sha256 = 'f'.repeat(64);
    expect(() => validateRuntimeReceipt(value, 'android')).toThrow(/source\/configuration/u);
  });
  it('requires an explicitly owned run-specific emulator, never a personal physical serial', () => {
    const run = 'a'.repeat(32);
    expect(() => validateOwnedAndroidTarget('emulator-5554', 'LiteraryPlanet-V12-' + run, run)).not.toThrow();
    for (const pair of [['personal-physical-device', 'LiteraryPlanet-V12-' + run], ['emulator-5554', 'Pixel_Personal'],
      ['emulator-5554', 'LiteraryPlanet-V12-' + 'b'.repeat(32)], [null, null]])
      expect(() => validateOwnedAndroidTarget(pair[0], pair[1], run)).toThrow(/owned/u);
  });
  it('reads actual APK metadata rather than a configured android label', () => {
    expect(parseAndroidPackage("package: name='ru.probpera.literaryplanet.dev' versionCode='1' versionName='1.0-dev'\napplication-debuggable\n"))
      .toEqual({ applicationId: 'ru.probpera.literaryplanet.dev', versionCode: 1, versionName: '1.0-dev', debuggable: true });
    expect(parseAndroidPackage("package: name='ru.probpera.literaryplanet' versionCode='1' versionName='1.0'\n").debuggable).toBe(false);
    expect(() => parseAndroidPackage('android dev configured')).toThrow();
  });
  it('requires one actual verified signing certificate and rejects ambiguous signers', () => {
    const line = 'Signer #1 certificate SHA-256 digest: ' + 'a'.repeat(64) + '\n';
    expect(parseAndroidCertificate(line)).toBe('a'.repeat(64));
    expect(() => parseAndroidCertificate('certificate: Android Debug')).toThrow();
    expect(() => parseAndroidCertificate(line + line.replace('#1', '#2'))).toThrow();
  });
  it.each(['INSTRUMENTATION_FAILED: unavailable\n', 'OK (1 test)\nFAILURES!!!\n',
    'OK (1 test)\nINSTRUMENTATION_ABORTED\n', 'OK (1 test)\nProcess crashed\n', 'OK (1 test)\nshortMsg=unavailable\n', 'OK (0 tests)\n'])
    ('does not promote failed/missing instrumentation to PASS %s', text => {
      expect(instrumentationPassed(text)).toBe(false);
    });
  it('recognizes the actual single synthetic instrumentation case', () => {
    expect(instrumentationPassed('INSTRUMENTATION_STATUS_CODE: 0\n\nOK (1 test)\n')).toBe(true);
  });
  it('binds one exact compiled XCTest host and phase without mutating the original manifest', () => {
    const binary = path.resolve('/synthetic/build/App.app'), templateDir = path.resolve('/synthetic/build');
    const input = { __xctestrun_metadata__: { FormatVersion: 2 }, TestConfigurations: [{ TestTargets: [{ BlueprintName: 'AppSecureStorageTests',
      IsAppHostedTestBundle: true, TestHostPath: '__TESTROOT__/App.app', TestBundlePath: '__TESTHOST__/PlugIns/AppSecureStorageTests.xctest',
      EnvironmentVariables: { DYLD_FRAMEWORK_PATH: '__TESTROOT__/Frameworks' } }] }] };
    const result = bindXctestrun(input, { binary, templateDir, runId: 'a'.repeat(32), phase: 'preferences:timeout' });
    expect(result.TestConfigurations[0].TestTargets[0]).toMatchObject({ TestHostPath: binary,
      OnlyTestIdentifiers: ['PlanetSecureStoreRuntimeTests/testPreferencePhase'],
      EnvironmentVariables: { LITERARY_PLANET_PREFERENCE_TEST_PHASE: 'timeout', DYLD_FRAMEWORK_PATH: templateDir + '/Frameworks' } });
    expect(input.TestConfigurations[0].TestTargets[0].TestHostPath).toBe('__TESTROOT__/App.app');
    expect(() => bindXctestrun(input, { binary: path.resolve('/personal/App.app'), templateDir, runId: 'a'.repeat(32), phase: 'write' })).toThrow();
  });
  it('requires actual single XCTest execution and retains failed/skipped observations', () => {
    const success = 'Executed 1 test, with 0 failures (0 unexpected)\n** TEST EXECUTE SUCCEEDED **\n';
    expect(xctestPassed(success)).toBe(true); expect(xctestPassed('** TEST EXECUTE SUCCEEDED **\n')).toBe(false);
    expect(xctestPassed(success + "Test Case 'fixture' skipped\n")).toBe(false);
    expect(xctestPassed(success.replace('0 failures', '1 failure'))).toBe(false);
  });
  it('preserves a partial blocked report without executing or enumerating devices', async () => {
    const root = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'literary-native-runtime-test-')); temporary.push(root);
    const result = await runNativeInstallRuntime({ rootDir: root, platform: 'android', runId: 'a'.repeat(32), outDir: '.tmp/own-evidence' });
    expect(result.status).toBe('BLOCKED_EXTERNAL'); expect(result.releaseReady).toBe(false); expect(result.installed).toBe(false);
    expect(result.commands).toEqual([]); expect(result.hardwareProtectionTested).toBe(false);
    const persisted = JSON.parse(await readFile(path.join(root, '.tmp/own-evidence/result.json'), 'utf8'));
    expect(persisted.status).toBe('BLOCKED_EXTERNAL'); expect(persisted.dependencies.some(item => !item.present)).toBe(true);
    expect(persisted.checks.some(item => item.status === 'BLOCKED_EXTERNAL')).toBe(true);
  });
});
