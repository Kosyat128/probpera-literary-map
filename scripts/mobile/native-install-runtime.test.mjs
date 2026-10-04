import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bindXctestrun, xctestPassed, instrumentationPassed, nativeRuntimeCommandContext, parseAndroidCertificate, parseAndroidPackage, parseAndroidInstrumentationPackage, runNativeInstallRuntime,
  androidAdbServerArguments, parseOwnedAdbServerPort, createAndroidOfflineGate, parseAndroidOfflineState, validateOwnedAndroidTarget, validateRuntimeReceipt,
  nativeChildLocalV2ProfileEntryFixtureSourcePath, childLocalV2ProfileEntryTestMethods, childLocalV2ProfileEntryFixtureArguments,
  childLocalV2ProfileEntryFixturePassed, verifyNativeChildLocalV2ProfileEntryFixtureSource,
  childLocalV2PinOperationsFixtureArguments, childLocalV2PinOperationsFixturePassed } from './native-install-runtime.mjs';

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

describe('strict owned Android offline gates', () => {
  const wifiDisabled = 'Wifi is disabled\nWifi scanning is only available when wifi is enabled';
  const offline = () => ({ airplaneMode: '1\n', mobileData: '0\n', wifiStatus: wifiDisabled + '\n' });
  const launch = ['shell','am','start','-W','-n','ru.probpera.literaryplanet.dev/ru.probpera.literaryplanet.MainActivity'];
  const instrument = ['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetSecureStoreRuntimeTest',
    '-e','literaryRunId','a'.repeat(32),'-e','literaryPhase','read','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner'];
  const readArgs = [ ['shell','settings','get','global','airplane_mode_on'], ['shell','settings','get','global','mobile_data'], ['shell','cmd','wifi','status'] ];
  function fixture() {
    const state = { replies: offline(), calls: [], records: [] };
    const adb = async (args, timeoutMs, cleanup) => {
      state.calls.push({ args: [...args], timeoutMs, cleanup });
      const key = args[0] === 'shell' && args[1] === 'settings' ? args[4] === 'airplane_mode_on' ? 'airplaneMode' : 'mobileData'
        : args.join(',') === 'shell,cmd,wifi,status' ? 'wifiStatus' : null;
      return key ? state.replies[key] : 'synthetic-local-command-only';
    };
    return { state, adb, gate: createAndroidOfflineGate(adb, entry => { state.records.push(entry); }) };
  }
  it('binds an explicit local ADB server port without changing the historical optional default', () => {
    expect(androidAdbServerArguments()).toEqual([]);
    expect(parseOwnedAdbServerPort('5038')).toBe(5038);
    expect(androidAdbServerArguments(5038)).toEqual(['-H','127.0.0.1','-P','5038']);
    expect(Object.isFrozen(androidAdbServerArguments(5038))).toBe(true);
    expect(() => androidAdbServerArguments('5038')).toThrow();
  });
  it.each(['05038','5038; kill-server','1e4','5039','1022','65536','null'])
    ('rejects an ambiguous/out-of-range CLI ADB port before invocation %s', value => {
      expect(() => parseOwnedAdbServerPort(value)).toThrow();
    });
  it('requires all three exact disabled observations and canonical LF/CRLF line endings', () => {
    const expected = { airplaneMode: '1', mobileData: '0', wifiStatus: wifiDisabled };
    expect(parseAndroidOfflineState(offline())).toEqual(expected);
    expect(parseAndroidOfflineState(Object.fromEntries(Object.entries(offline()).map(([key,value]) => [key,value.replaceAll('\n','\r\n')])))).toEqual(expected);
    expect(Object.isFrozen(parseAndroidOfflineState(offline()))).toBe(true);
  });
  it.each([
    { airplaneMode: '0\n' }, { mobileData: '1\n' }, { mobileData: undefined },
    { wifiStatus: wifiDisabled.replace('Wifi is disabled','Wifi is enabled') },
    { wifiStatus: 'Wifi is disabled\nWifi scanning is always available\n' },
    { wifiStatus: wifiDisabled + '\nunknown extra reply\n' }, { airplaneMode: '1\n0\n' },
  ])('denies a connected, missing or ambiguous observation %j', patch => {
    expect(() => parseAndroidOfflineState({ ...offline(), ...patch })).toThrow();
  });
  it('rejects executable state accessors before invoking one', () => {
    let reads = 0; const value = offline();
    Object.defineProperty(value,'wifiStatus',{ enumerable:true, get() { reads++; return wifiDisabled; } });
    expect(() => parseAndroidOfflineState(value)).toThrow(); expect(reads).toBe(0);
  });
  it.each([['install',['install','/owned/synthetic.apk']],['launch',launch],['instrument',instrument]])
    ('checks exact read-only state immediately before the %s boundary', async (checkpoint,args) => {
      const f = fixture(); await f.gate.command(checkpoint,args,60_000);
      expect(f.state.calls.map(value => value.args)).toEqual([...readArgs,args]);
      expect(f.state.calls.slice(0,3).every(value => value.timeoutMs === 5000 && value.cleanup === false)).toBe(true);
      expect(f.state.records).toHaveLength(1);
      expect(f.state.records[0]).toMatchObject({ checkpoint, status:'PASS', state:{ airplaneMode:'1',mobileData:'0',wifiStatus:wifiDisabled } });
    });
  it('retains a failed read observation and never dispatches the guarded install', async () => {
    const calls = [], records = [], gate = createAndroidOfflineGate(async args => {
      calls.push([...args]); if(calls.length === 2) throw new Error('synthetic unavailable read'); return '1\n';
    }, entry => { records.push(entry); });
    await expect(gate.command('install',['install','/owned/synthetic.apk'])).rejects.toThrow(/not verifiably offline/u);
    expect(calls).toEqual(readArgs.slice(0,2)); expect(records).toMatchObject([{ status:'FAIL',reason:'android-offline-state-unavailable' }]);
    expect(JSON.stringify(records)).not.toContain('synthetic unavailable read');
  });
  it('rechecks after a prior successful launch and denies later Wi-Fi re-enablement', async () => {
    const f = fixture(); await f.gate.command('first-launch',launch);
    f.state.replies.wifiStatus = wifiDisabled.replace('Wifi is disabled','Wifi is enabled');
    await expect(f.gate.command('after-reboot-launch',launch)).rejects.toThrow(/not verifiably offline/u);
    expect(f.state.calls.filter(value => value.args[2] === 'start')).toHaveLength(1);
    expect(f.state.records.map(value => value.status)).toEqual(['PASS','FAIL']);
  });
  it('snapshots arguments before any awaited state read and cannot redirect an admitted command', async () => {
    let resolve; const pending = new Promise(done => { resolve = done; }); const calls = [], records = [];
    const gate = createAndroidOfflineGate(async args => {
      calls.push([...args]); if(calls.length === 1) return pending;
      return args.join(',') === 'shell,cmd,wifi,status' ? wifiDisabled : args[0] === 'install' ? 'synthetic-only' : '0';
    }, entry => { records.push(entry); });
    const args = ['install','/owned/synthetic.apk'], result = gate.command('install',args);
    args[1] = '/unreviewed/changed.apk'; resolve('1'); await result;
    expect(calls[3]).toEqual(['install','/owned/synthetic.apk']); expect(records[0].status).toBe('PASS');
  });
  it.each([
    ['shell','sh','-c','am start arbitrary'],
    [...launch.slice(0,5), launch[5] + '; cmd wifi set-wifi enabled'],
    [...instrument.slice(0,13),'read; cmd wifi set-wifi enabled',instrument[14]],
  ].map(args => [args]))('rejects unowned command/argument injection before any device access %j', async args => {
    const f = fixture(); await expect(f.gate.command('launch',args)).rejects.toThrow();
    expect(f.state.calls).toEqual([]); expect(f.state.records).toEqual([]);
  });
  it('provides a separate read-only post-reboot check and carries cleanup mode without setting network state', async () => {
    const f = fixture(); await f.gate.verify('owned-target-after-reboot',true);
    expect(f.state.calls.map(value => value.args)).toEqual(readArgs);
    expect(f.state.calls.every(value => value.cleanup === true)).toBe(true);
    expect(f.state.records[0]).toMatchObject({ checkpoint:'owned-target-after-reboot',status:'PASS' });
  });
  it('native child data command gates bind each exact candidate phase and fresh run before dispatch', async () => {
    for (const phase of ['write','read','atomic','retire','corrupt','missing-key','missing-cipher','clear']) {
      const f = fixture(), args = [...instrument]; args[7] = 'ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest'; args[12] = 'literaryChildDataPhase'; args[13] = phase;
      await f.gate.command('child-data-' + phase,args,60_000);
      expect(f.state.calls.map(call => call.args)).toEqual([...readArgs,args]);
      expect(f.state.records[0]).toMatchObject({ checkpoint:'child-data-' + phase,status:'PASS' });
    }
  });
  it('native child data command gates reject cross-class phase fields and unknown cases before any device access', async () => {
    const candidate = [...instrument]; candidate[7] = 'ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest'; candidate[12] = 'literaryChildDataPhase'; candidate[13] = 'atomic';
    const variants = [
      {index:12,value:'literaryPhase'}, {index:13,value:'parallel'}, {index:13,value:'unreviewed'},
      {index:7,value:'ru.probpera.literaryplanet.PlanetPreferencesRuntimeTest'}, {index:10,value:'a'.repeat(31)},
      {index:14,value:'foreign.test/androidx.test.runner.AndroidJUnitRunner'},
    ];
    for (const patch of variants) { const f = fixture(), args = [...candidate]; args[patch.index] = patch.value;
      await expect(f.gate.command('child-data-denied',args)).rejects.toThrow(); expect(f.state.calls).toEqual([]); expect(f.state.records).toEqual([]);
    }
  });
  it('native child data command gates still deny a connected target before candidate instrumentation', async () => {
    const f = fixture(), args = [...instrument]; args[7] = 'ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest'; args[12] = 'literaryChildDataPhase'; args[13] = 'read';
    f.state.replies.mobileData = '1\n';
    await expect(f.gate.command('child-data-connected',args)).rejects.toThrow(/not verifiably offline/u);
    expect(f.state.calls.map(call => call.args)).toEqual(readArgs); expect(f.state.records[0].status).toBe('FAIL');
  });
});

describe('exact-package local native runner gates', () => {
  it('removes ambient credential/JVM injection and keeps command homes/temp within this run without process mutation', () => {
    const keys = ['VITE_SUPABASE_URL', 'Supabase_SECRET_KEY', 'PLANET_PAYMENT_KEY', 'LITERARY_PLANET_TEST_TOKEN', 'TURNSTILE_SECRET',
      'YANDEX_METRIKA_COUNTER_ID', 'CMS_TOKEN', 'CLOUDFLARE_API_TOKEN', 'YOOKASSA_SECRET_KEY', 'PSP_KEY', 'PAYMENT_KEY', 'AUTH_TOKEN',
      'JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS', 'JAVA_OPTS', 'GRADLE_OPTS', 'java_tool_options', 'NODE_OPTIONS',
      'JAVA_HOME', 'GRADLE_USER_HOME', 'ADB_SERVER_SOCKET', 'ADB_SERVER_PORT', 'ADB_VENDOR_KEYS', 'adb_server_socket', 'ANDROID_ADB_SERVER_PORT',
      'ANDROID_EMULATOR_HOME', 'ANDROID_AVD_HOME', 'ANDROID_SDK_ROOT', 'ANDROID_USER_HOME', 'ANDROID_SDK_HOME', 'TMPDIR', 'TMP', 'TEMP', 'DEVELOPER_DIR'];
    const ambient = { PATH: 'synthetic-required-tool-path', SystemRoot: 'synthetic-os-root',
      ...Object.fromEntries(keys.map(key => [key, 'synthetic-private-or-redirected-value'])) }, before = { ...ambient };
    const output = path.resolve('/synthetic-own-runtime'), result = nativeRuntimeCommandContext(ambient, output);
    for (const key of keys.filter(key => !['ANDROID_USER_HOME', 'TMPDIR', 'TMP', 'TEMP', 'DEVELOPER_DIR'].includes(key)))
      expect(Object.prototype.hasOwnProperty.call(result.env, key)).toBe(false);
    expect(result.env.PATH).toBe(ambient.PATH); expect(result.env.SystemRoot).toBe(ambient.SystemRoot);
    expect(result.env.ANDROID_USER_HOME).toBe(path.join(output, 'android-user'));
    expect(result.env.TMPDIR).toBe(path.join(output, 'command-temp')); expect(result.env.TMP).toBe(result.env.TMPDIR); expect(result.env.TEMP).toBe(result.env.TMPDIR);
    expect(result.javaArgs).toEqual(['-Duser.home=' + path.join(output, 'command-user'), '-Djava.io.tmpdir=' + result.env.TMPDIR]);
    for (const directory of result.directories) expect(path.dirname(directory)).toBe(output);
    expect(JSON.stringify(result)).not.toContain('synthetic-private-or-redirected-value'); expect(ambient).toEqual(before);
  });
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
  describe('actual Android instrumentation package parser', () => {
    const badging = "package: name='ru.probpera.literaryplanet.dev.test' versionCode='' versionName='' platformBuildVersionCode='36'\nminSdkVersion:'24'\ntargetSdkVersion:'36'\napplication-debuggable\n";
    const manifest = 'E: instrumentation\n A: android:name(0x01010003)="androidx.test.runner.AndroidJUnitRunner"\n A: android:targetPackage(0x01010021)="ru.probpera.literaryplanet.dev"\n';
    it('accepts versionless actual test APK identity while preserving strict main package versions', () => {
      expect(parseAndroidInstrumentationPackage(badging, manifest)).toEqual({ applicationId: 'ru.probpera.literaryplanet.dev.test', versionCode: null, versionName: null, debuggable: true, minSdkVersion: 24, targetSdkVersion: 36 });
      expect(() => parseAndroidPackage(badging)).toThrow();
      expect(() => parseAndroidPackage(badging.replace('.dev.test', '.dev'))).toThrow();
    });
    it('retains optional positive test versions without borrowing main authority', () => {
      expect(parseAndroidInstrumentationPackage(badging.replace("versionCode='' versionName=''", "versionCode='1' versionName='1.0-test'"), manifest).versionCode).toBe(1);
    });
    it.each([
      ['main application', badging.replace('.dev.test', '.dev'), manifest],
      ['other test application', badging.replace('ru.probpera', 'other'), manifest],
      ['nondebuggable', badging.replace('application-debuggable\n', ''), manifest],
      ['wrong minimum SDK', badging.replace("minSdkVersion:'24'", "minSdkVersion:'23'"), manifest],
      ['wrong target SDK', badging.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'"), manifest],
      ['missing minimum SDK', badging.replace("minSdkVersion:'24'\n", ''), manifest],
      ['wrong runner', badging, manifest.replace('AndroidJUnitRunner', 'OtherRunner')],
      ['wrong target application', badging, manifest.replace('"ru.probpera.literaryplanet.dev"', '"other.app"')],
      ['ambiguous package lines', badging + badging, manifest],
      ['ambiguous target', badging, manifest + 'A: android:targetPackage="other.app"\n'],
      ['zero optional version', badging.replace("versionCode=''", "versionCode='0'"), manifest],
      ['unsafe optional version', badging.replace("versionCode=''", "versionCode='9007199254740992'"), manifest],
      ['malformed optional version', badging.replace("versionCode=''", "versionCode='1a'"), manifest],
      ['missing manifest', badging, null],
    ])('denies %s', (_label, text, xml) => {
      expect(() => parseAndroidInstrumentationPackage(text, xml)).toThrow();
    });
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

describe('native Local V2 profile entry selector', () => {
  const runId = 'a'.repeat(32), className = 'ru.probpera.literaryplanet.PlanetChildFirstInstallRuntimeTest';
  const fixture = (names = childLocalV2ProfileEntryTestMethods) => {
    const lines = [];
    for (const [index, name] of names.entries()) for (const status of [1,0]) lines.push(
      'INSTRUMENTATION_STATUS: class=' + className,
      'INSTRUMENTATION_STATUS: test=' + name,
      'INSTRUMENTATION_STATUS: numtests=8',
      'INSTRUMENTATION_STATUS: current=' + (index + 1),
      'INSTRUMENTATION_STATUS: id=AndroidJUnitRunner',
      'INSTRUMENTATION_STATUS_CODE: ' + status);
    return lines.join('\n') + '\nINSTRUMENTATION_RESULT: stream=\nOK (8 tests)\nINSTRUMENTATION_CODE: -1\n';
  };
  it('freezes exactly the new eight methods, original class, owned run and fixed phase', () => {
    const args = childLocalV2ProfileEntryFixtureArguments(runId);
    expect(Object.isFrozen(args)).toBe(true); expect(Object.isFrozen(childLocalV2ProfileEntryTestMethods)).toBe(true);
    expect(childLocalV2ProfileEntryTestMethods).toHaveLength(8); expect(new Set(childLocalV2ProfileEntryTestMethods).size).toBe(8);
    expect(args).toEqual(['shell','am','instrument','-w','-r','-e','class',
      childLocalV2ProfileEntryTestMethods.map(method => className + '#' + method).join(','),
      '-e','literaryRunId',runId,'-e','literaryFirstInstallPhase','first-install-v2',
      'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
  });
  it('rejects unowned or nonprimitive run identifiers before returning arguments', () => {
    for (const value of [null,undefined,0,'A'.repeat(32),'a'.repeat(31),runId + '\n',new String(runId)])
      expect(() => childLocalV2ProfileEntryFixtureArguments(value)).toThrow();
  });
  it('requires one exact raw fixture source and a complete source hash', () => {
    const row = { path: nativeChildLocalV2ProfileEntryFixtureSourcePath, sha256: 'b'.repeat(64) };
    expect(verifyNativeChildLocalV2ProfileEntryFixtureSource([{ path: 'src/other.ts', sha256: 'c'.repeat(64) },row])).toBe(true);
    for (const value of [[],[row,row],[{ ...row,sha256:'not-sha256' }],[{ ...row,path:row.path + '.old' }],null])
      expect(() => verifyNativeChildLocalV2ProfileEntryFixtureSource(value)).toThrow();
  });
  it('accepts only complete serial start and pass pairs with the exact terminal', () => {
    expect(childLocalV2ProfileEntryFixturePassed(fixture())).toBe(true);
    expect(childLocalV2ProfileEntryFixturePassed(fixture().replaceAll('\n','\r\n'))).toBe(true);
  });
  it('rejects omitted, duplicate and foreign method observations', () => {
    const methods = [...childLocalV2ProfileEntryTestMethods];
    for (const names of [methods.slice(1),[...methods,methods[0]],[...methods.slice(0,7),methods[0]],
      [...methods.slice(0,7),'localV2AdmittedOwnedPayloadClosureSupportsOriginalFourPurposes']])
      expect(childLocalV2ProfileEntryFixturePassed(fixture(names))).toBe(false);
  });
  it('rejects substituted class, totals, ordinal identity, summary and terminal', () => {
    const good = fixture();
    for (const changed of [good.replaceAll(className,'ru.probpera.literaryplanet.OtherFixture'),
      good.replaceAll('numtests=8','numtests=9'),good.replaceAll('current=8','current=1'),
      good.replace('current=1','current=0'),good.replace('OK (8 tests)','OK (9 tests)'),
      good.replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'),
      good.replace('INSTRUMENTATION_CODE: -1',''),good + 'INSTRUMENTATION_CODE: -1\n'])
      expect(childLocalV2ProfileEntryFixturePassed(changed)).toBe(false);
  });
  it('retains failed, skipped, aborted and unknown packet observations as refusal', () => {
    for (const suffix of ['FAILURES!!!','INSTRUMENTATION_FAILED: failed','INSTRUMENTATION_ABORTED',
      'Process crashed','AssumptionViolatedException','skipped','INSTRUMENTATION_STATUS: unknown=1','INSTRUMENTATION_STATUS_CODE: -3'])
      expect(childLocalV2ProfileEntryFixturePassed(fixture() + suffix + '\n')).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(fixture().replace('test=','unknown='))).toBe(false);
  });
  it('refuses summary-only, incomplete or overlapping operation packets', () => {
    expect(childLocalV2ProfileEntryFixturePassed('OK (8 tests)\nINSTRUMENTATION_CODE: -1\n')).toBe(false);
    const good = fixture();
    expect(childLocalV2ProfileEntryFixturePassed(good.replace('INSTRUMENTATION_STATUS_CODE: 0','INSTRUMENTATION_STATUS_CODE: 1'))).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(good.replace('INSTRUMENTATION_STATUS: current=1\n',''))).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(good + '\0')).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(good.replaceAll('INSTRUMENTATION_STATUS: current=1\n',''))).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(good.replaceAll('INSTRUMENTATION_STATUS: id=AndroidJUnitRunner\n',''))).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(good.replace('INSTRUMENTATION_RESULT: stream=\n',''))).toBe(false);
  });
  it('keeps the prior nine-method PIN selector separate from the new reduced proof', () => {
    expect(childLocalV2ProfileEntryFixtureArguments(runId)[7]).not.toBe(childLocalV2PinOperationsFixtureArguments(runId)[7]);
    expect(childLocalV2PinOperationsFixturePassed(fixture())).toBe(false);
    expect(childLocalV2ProfileEntryFixturePassed(fixture().replaceAll('numtests=8','numtests=9').replace('OK (8 tests)','OK (9 tests)'))).toBe(false);
  });
  it('allows only exact new selector argv after fresh read-only offline observations', async () => {
    const calls = [], records = [], expected = childLocalV2ProfileEntryFixtureArguments(runId);
    const port = async args => { calls.push(args); if (args.join(' ') === 'shell settings get global airplane_mode_on') return '1\n';
      if (args.join(' ') === 'shell settings get global mobile_data') return '0\n';
      if (args.join(' ') === 'shell cmd wifi status') return 'Wifi is disabled\nWifi scanning is only available when wifi is enabled\n';
      expect(args).toEqual(expected); return fixture(); };
    const gate = createAndroidOfflineGate(port,value => records.push(value));
    expect(childLocalV2ProfileEntryFixturePassed(await gate.command('profile-entry',expected,180_000))).toBe(true);
    expect(calls).toHaveLength(4); expect(records).toHaveLength(1); expect(records[0].status).toBe('PASS');
    const unknown = [...expected]; unknown[7] += ',' + className + '#unselectedMethod';
    await expect(gate.command('profile-entry',unknown,180_000)).rejects.toThrow();
    expect(calls).toHaveLength(4); expect(records).toHaveLength(1);
  });
  it('rejects mixed selectors before evidence creation or device commands', async () => {
    const root = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'literary-native-runtime-test-')); temporary.push(root);
    for (const selector of [{ pinVerificationInput:true },{ childLocalV2PinOperations:true }])
      await expect(runNativeInstallRuntime({ rootDir:root,platform:'android',childLocalV2ProfileEntry:true,...selector })).rejects.toThrow(/cannot be mixed/u);
  });
  it('refuses nonboolean selection, another platform or a reboot request', async () => {
    const root = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'literary-native-runtime-test-')); temporary.push(root);
    await expect(runNativeInstallRuntime({ rootDir:root,platform:'android',childLocalV2ProfileEntry:'true' })).rejects.toThrow(/Explicit/u);
    for (const options of [{ platform:'ios' },{ platform:'android',reboot:true }])
      await expect(runNativeInstallRuntime({ rootDir:root,childLocalV2ProfileEntry:true,...options })).rejects.toThrow(/Android-only/u);
  });
  it('keeps default preflight silent toward devices and records the actual reduced scope', async () => {
    const root = await mkdtemp(path.join(path.resolve(os.tmpdir()), 'literary-native-runtime-test-')); temporary.push(root);
    const result = await runNativeInstallRuntime({ rootDir:root,platform:'android',runId,outDir:'.tmp/profile-entry',childLocalV2ProfileEntry:true });
    expect(result.kind).toBe('literary-planet-child-local-v2-profile-entry-runtime'); expect(result.status).toBe('BLOCKED_EXTERNAL');
    expect(result.commands).toEqual([]); expect(result.installed).toBe(false); expect(result.releaseReady).toBe(false);
    expect(result.fixture.methods).toEqual(childLocalV2ProfileEntryTestMethods); expect(result.fixture.tests).toBe(8);
    expect(result.fixture.parentGateAdmission).toBe(false); expect(result.fixture.installedStorageAcceptance).toBe(false);
    const persisted = JSON.parse(await readFile(path.join(root,'.tmp/profile-entry/result.json'),'utf8'));
    expect(persisted.kind).toBe(result.kind); expect(persisted.fixture).toEqual(result.fixture); expect(persisted.commands).toEqual([]);
  });
});
