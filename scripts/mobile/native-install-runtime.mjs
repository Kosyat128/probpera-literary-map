/** Local, explicit own-emulator/simulator checks. Imports and preflight never
 * enumerate devices, install, launch, reboot or call project services. A real
 * run is opt-in and remains separate from hardware/store/release acceptance. */
import { execFile, execFileSync } from 'node:child_process';
import { isLocalCliEntry } from './local-cli-entry.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
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
const ownRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
  && Reflect.ownKeys(value).every(key => typeof key === 'string' && Object.getOwnPropertyDescriptor(value, key)?.enumerable === true
    && Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'));
const PREVIOUS_PREFERENCE_PROTOCOL = 'capacitor-preferences-v1-reflection';
const previousReceiptKeys = ['schemaVersion','artifactPath','artifactSha256','artifactBytes','applicationId','versionCode','versionName',
  'certificateSha256','debuggable','webArtifactSha256','sourceCommit','platform','channel','metadataStatus','preferencesProtocol'];

/** Read actual class definitions, not incidental descriptor strings. Only the
 * fixed old Preferences classes are inspected; no DEX execution/decompilation. */
export function previousPreferencesDexClasses(bytes) {
  try {
    check(bytes instanceof Uint8Array && bytes.length >= 112 && bytes.length <= 32 * 1024 * 1024, 'Bounded DEX required.');
    check(/^dex\n0(?:35|37|38|39|40)\0$/u.test(Buffer.from(bytes.subarray(0,8)).toString('ascii')), 'Unsupported DEX header.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), u32 = offset => view.getUint32(offset, true);
    check(u32(32) === bytes.length && u32(36) === 112 && u32(40) === 0x12345678, 'Invalid DEX bounds/endian.');
    const table = (countOffset, offsetOffset, width, maximum) => { const count = u32(countOffset), offset = u32(offsetOffset);
      check(count <= maximum && offset >= 112 && offset + count * width <= bytes.length, 'Invalid DEX table.'); return { count, offset }; };
    const strings = table(56,60,4,250_000), types = table(64,68,4,65_536), classes = table(96,100,32,65_536);
    const wanted = new Set(['Lcom/capacitorjs/plugins/preferences/Preferences;', 'Lcom/capacitorjs/plugins/preferences/PreferencesConfiguration;',
      'Lcom/capacitorjs/plugins/preferences/PreferencesPlugin;']), found = new Set();
    const text = index => { check(index < strings.count, 'Invalid descriptor index.'); let offset = u32(strings.offset + index * 4);
      check(offset >= 112 && offset < bytes.length, 'Invalid string offset.'); let ended = false;
      for (let index = 0; index < 5 && offset < bytes.length; index++) if ((bytes[offset++] & 128) === 0) { ended = true; break; }
      check(ended, 'Invalid string length.'); const start = offset;
      while (offset < bytes.length && bytes[offset] !== 0 && offset - start <= 512) offset++;
      check(offset < bytes.length && offset - start <= 512, 'Invalid descriptor length.');
      return Buffer.from(bytes.subarray(start, offset)).toString('ascii'); };
    for (let index = 0; index < classes.count; index++) { const type = u32(classes.offset + index * 32); check(type < types.count, 'Invalid class type.');
      const descriptor = text(u32(types.offset + type * 4)); if (wanted.has(descriptor)) found.add(descriptor); }
    return Object.freeze({ preferences: found.has('Lcom/capacitorjs/plugins/preferences/Preferences;'),
      configuration: found.has('Lcom/capacitorjs/plugins/preferences/PreferencesConfiguration;'),
      plugin: found.has('Lcom/capacitorjs/plugins/preferences/PreferencesPlugin;') });
  } catch { return Object.freeze({ preferences: false, configuration: false, plugin: false }); }
}

/** Bounded selected ZIP entries only. Embedded historical source is identity
 * evidence for these signed bytes, never a claim of current-source acceptance. */
export function inspectPreviousAndroidArchive(bytes, unzipSync) {
  check(bytes instanceof Uint8Array && bytes.length > 0 && bytes.length <= 512 * 1024 * 1024 && typeof unzipSync === 'function', 'Bounded APK reader required.');
  let selected = 0, total = 0; const names = new Set();
  const files = unzipSync(bytes, { filter(entry) {
    if (entry.name !== 'assets/public/artifact.json' && entry.name !== 'assets/capacitor.plugins.json' && !/^classes(?:[2-9]|[1-3][0-9])?\.dex$/u.test(entry.name)) return false;
    const maximum = entry.name.endsWith('.dex') ? 32 * 1024 * 1024 : 8 * 1024 * 1024;
    check(!names.has(entry.name) && ++selected <= 34 && Number.isSafeInteger(entry.originalSize) && entry.originalSize > 0
      && entry.originalSize <= maximum && (total += entry.originalSize) <= 64 * 1024 * 1024, 'Duplicate/oversized selected APK entries.');
    names.add(entry.name); return true;
  } });
  const metadataBytes = files['assets/public/artifact.json']; let metadata = null, plugins = null;
  try { if (metadataBytes) metadata = parseJson(Buffer.from(metadataBytes)); } catch {}
  try { if (files['assets/capacitor.plugins.json']) plugins = parseJson(Buffer.from(files['assets/capacitor.plugins.json'])); } catch {}
  const metadataValid = ownRecord(metadata) && metadata.schemaVersion === 1 && metadata.kind === 'literary-planet-bundled-native-preparation'
    && commit(metadata.sourceCommit) && metadata.platform === 'android' && metadata.channel === 'dev'
    && metadata.releaseReady === false && metadata.productionActionsAuthorized === false;
  const classes = Object.entries(files).filter(([name]) => name.endsWith('.dex')).map(([,value]) => previousPreferencesDexClasses(value));
  const plugin = Array.isArray(plugins) && plugins.length <= 64 && plugins.some(item => ownRecord(item)
    && item.pkg === '@capacitor/preferences' && item.classpath === 'com.capacitorjs.plugins.preferences.PreferencesPlugin');
  const protocol = plugin && ['preferences','configuration','plugin'].every(field => classes.some(item => item[field] === true));
  return Object.freeze({ webArtifactSha256: metadataBytes ? sha(metadataBytes) : null,
    sourceCommit: metadataValid ? metadata.sourceCommit : null, platform: metadataValid ? 'android' : null, channel: metadataValid ? 'dev' : null,
    metadataStatus: metadataValid ? 'valid' : metadataBytes ? 'incompatible' : 'missing',
    preferencesProtocol: protocol ? PREVIOUS_PREFERENCE_PROTOCOL : null });
}

export function validatePreviousAndroidArtifact(value, current, receiptPath) {
  check(ownRecord(value) && ownRecord(current) && Object.keys(value).sort().join(',') === [...previousReceiptKeys].sort().join(',') && value.schemaVersion === 1,
    'Malformed exact predecessor receipt.');
  check(typeof receiptPath === 'string' && /^\.tmp\/mobile-release-android-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\/binary\.json$/u.test(receiptPath)
    && value.artifactPath === path.posix.dirname(receiptPath) + '/previous-dev-debug.apk'
    && current.artifactPath === path.posix.dirname(receiptPath) + '/app-dev-debug.apk', 'Predecessor must be the exact preserved own preparation copy.');
  check(hash(value.artifactSha256) && Number.isSafeInteger(value.artifactBytes) && value.artifactBytes > 0 && value.artifactBytes <= 512 * 1024 * 1024
    && typeof value.applicationId === 'string' && value.applicationId.length <= 128 && Number.isSafeInteger(value.versionCode) && value.versionCode >= 1
    && typeof value.versionName === 'string' && value.versionName.length > 0 && value.versionName.length <= 128 && hash(value.certificateSha256)
    && typeof value.debuggable === 'boolean' && ['valid','missing','incompatible'].includes(value.metadataStatus)
    && (value.webArtifactSha256 === null || hash(value.webArtifactSha256)) && (value.preferencesProtocol === null || value.preferencesProtocol === PREVIOUS_PREFERENCE_PROTOCOL), 'Invalid predecessor identity.');
  if (value.metadataStatus === 'valid') check(hash(value.webArtifactSha256) && commit(value.sourceCommit) && value.platform === 'android' && value.channel === 'dev', 'Invalid historical embedded source binding.');
  else check(value.sourceCommit === null && value.platform === null && value.channel === null
    && (value.metadataStatus === 'missing' ? value.webArtifactSha256 === null : hash(value.webArtifactSha256)), 'Incompatible historical metadata must not fabricate source identity.');
  check(hash(current.certificateSha256), 'Current receipt must bind its actual certificate for an update.');
  let reason = null;
  if (!value.debuggable || value.applicationId !== current.applicationId) reason = 'previous-application-or-debug-channel-incompatible';
  else if (value.certificateSha256 !== current.certificateSha256) reason = 'previous-signing-certificate-incompatible';
  else if (value.versionCode > current.versionCode) reason = 'previous-version-is-newer-no-downgrade';
  else if (value.artifactSha256 === current.artifactSha256) reason = 'preserved-artifact-is-identical-not-a-previous-build';
  else if (value.metadataStatus !== 'valid') reason = 'previous-embedded-metadata-' + value.metadataStatus;
  else if (value.preferencesProtocol === null) reason = 'previous-capacitor-preferences-protocol-unavailable';
  return Object.freeze({ ready: reason === null, reason, previous: Object.freeze({ ...value }) });
}
export function verifyPreviousAndroidBinding(expected, actual) {
  check(ownRecord(expected) && ownRecord(actual) && previousReceiptKeys.every(key => Object.hasOwn(expected,key) && Object.hasOwn(actual,key)
    && expected[key] === actual[key]), 'Historical metadata/protocol/package/source differs from the bound predecessor.');
  return true;
}

/** Pure argument arrays, only consumed after exact own-target checks. No shell,
 * implicit downgrade, app reset, generic private-key seed or default execution. */
export function androidPreviousUpdatePlan(current, assessment, runId) {
  check(assessment?.ready === true && /^[a-f0-9]{32}$/u.test(runId), 'A verified compatible predecessor and run identity are required.');
  return Object.freeze({ previousInstall: Object.freeze(['install', assessment.previous.artifactPath]),
    currentUpdate: Object.freeze(['install','-r',current.artifactPath]),
    seedArguments: Object.freeze(['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetPreviousPreferencesRuntimeTest',
      '-e','literaryRunId',runId,'-e','literaryPhase','write','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']) });
}

export function createPreviousAndroidArtifact(artifact, metadata, certificateSha256, inspection) {
  check(relativePath(artifact?.path) && hash(artifact.sha256) && Number.isSafeInteger(artifact.bytes) && artifact.bytes > 0 && artifact.bytes <= 512 * 1024 * 1024
    && hash(certificateSha256) && ownRecord(metadata) && ownRecord(inspection), 'Exact inspected predecessor is required.');
  return Object.freeze({ schemaVersion: 1, artifactPath: artifact.path, artifactSha256: artifact.sha256, artifactBytes: artifact.bytes,
    applicationId: metadata.applicationId, versionCode: metadata.versionCode, versionName: metadata.versionName, debuggable: metadata.debuggable,
    certificateSha256, ...inspection });
}
export async function inspectPreviousAndroidApk(root, bytes) {
  const installed = parseJson(await regular(root, 'node_modules/fflate/package.json', 64 * 1024));
  check(installed.name === 'fflate' && installed.version === '0.8.3', 'Use the existing pinned APK ZIP reader.');
  const { unzipSync } = createRequire(path.join(root,'package.json'))('fflate');
  return inspectPreviousAndroidArchive(bytes, unzipSync);
}
export function validateOwnedAdbServerPort(value) {
  check(typeof value === 'number' && Number.isSafeInteger(value) && value >= 1024 && value <= 65535 && value % 2 === 0,
    'Use one explicit even owned ADB server port from 1024 through 65534.');
  return value;
}
export function parseOwnedAdbServerPort(value) {
  check(typeof value === 'string' && /^[1-9][0-9]{3,4}$/u.test(value), 'Use a canonical decimal owned ADB server port.');
  return validateOwnedAdbServerPort(Number(value));
}
export function androidAdbServerArguments(value) {
  return Object.freeze(value === undefined ? [] : ['-H','127.0.0.1','-P',String(validateOwnedAdbServerPort(value))]);
}
/** Pure per-run command configuration. Ambient JVM flags can print secrets to
 * stderr or redirect Java writes before even a read-only metadata command. */
export function nativeRuntimeCommandContext(ambient, output) {
  check(path.isAbsolute(output), 'An absolute owned runtime output is required.');
  const blocked = /^(?:VITE_|SUPABASE|PLANET_|LITERARY_PLANET_|TURNSTILE|YANDEX_|CMS_|CLOUDFLARE|YOOKASSA|PSP_|PAYMENT_|AUTH_|JAVA_TOOL_OPTIONS$|_JAVA_OPTIONS$|JDK_JAVA_OPTIONS$|JAVA_OPTS$|GRADLE_OPTS$|NODE_OPTIONS$|JAVA_HOME$|GRADLE_USER_HOME$|ADB_|ANDROID_ADB_SERVER_PORT$|ANDROID_EMULATOR_HOME$|ANDROID_AVD_HOME$|ANDROID_SDK_ROOT$|ANDROID_USER_HOME$|ANDROID_SDK_HOME$|TMPDIR$|TMP$|TEMP$|DEVELOPER_DIR$)/iu;
  const home = path.join(output, 'command-user'), temporary = path.join(output, 'command-temp'), android = path.join(output, 'android-user');
  const env = Object.fromEntries(Object.entries(ambient).filter(([key]) => !blocked.test(key)));
  Object.assign(env, { ANDROID_USER_HOME: android, TMPDIR: temporary, TMP: temporary, TEMP: temporary, DEVELOPER_DIR });
  return Object.freeze({ env: Object.freeze(env), javaArgs: Object.freeze(['-Duser.home=' + home, '-Djava.io.tmpdir=' + temporary]),
    directories: Object.freeze([home, temporary, android]) });
}
async function regular(root, relative, maximum = 512 * 1024 * 1024) {
  check(relativePath(relative), 'Unsafe contained file path.');
  const target = path.resolve(root, relative), stat = await lstat(target);
  check(within(root, target) && stat.isFile() && !stat.isSymbolicLink() && stat.size <= maximum && await realpath(target) === target, 'Missing, linked or oversized input.');
  return readFile(target);
}
export const nativeProtectedFixtureSourcePaths = Object.freeze([
  'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildProtectedEnvelopeRuntimeTest.java',
  'apps/mobile/ios/App/AppSecureStorageTests/PlanetChildProtectedEnvelopeRuntimeTests.swift',
]);
export function verifyNativeProtectedFixtureSources(files) {
  check(Array.isArray(files) && nativeProtectedFixtureSourcePaths.every(filename => files.some(file => file?.path === filename && hash(file.sha256))),
    'Missing required structural envelope fixture source binding.');
  return true;
}
export async function nativeRuntimeSources(rootDir) {
  const root = await realpath(rootDir);
  const roots = ['src', 'apps/mobile/android', 'apps/mobile/ios', 'native.html', 'vite.native.config.ts', 'vite.config.ts',
    'tsconfig.json', 'package.json', 'package-lock.json', 'capacitor.config.json', 'scripts/mobile/build-native.mjs', 'scripts/mobile/native-base-assets.json', 'scripts/mobile/pwa-artifact.mjs', 'scripts/mobile/native-child-package-assets.mjs'];
  const names = execFileSync('git', ['-c', 'safe.directory=' + root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...roots],
    { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).split('\0');
  const files = [];
  for (const filename of [...new Set(names.filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(name)))].sort())
    files.push({ path: filename, sha256: sha(await regular(root, filename)) });
  verifyNativeProtectedFixtureSources(files);
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
export function parseAndroidInstrumentationPackage(text, manifest) {
  check(typeof text === 'string' && text.length <= 1024 * 1024 && typeof manifest === 'string' && manifest.length <= 1024 * 1024, 'Bounded actual test badging and manifest are required.');
  const rows = [...text.matchAll(/^package: name='([^']+)' versionCode='([0-9]*)' versionName='([^']*)'[^\r\n]*$/gmu)];
  const minimum = [...text.matchAll(/^minSdkVersion:'([0-9]+)'\s*$/gmu)], target = [...text.matchAll(/^targetSdkVersion:'([0-9]+)'\s*$/gmu)];
  check(rows.length === 1 && rows[0][1] === 'ru.probpera.literaryplanet.dev.test' && /^application-debuggable\s*$/mu.test(text)
    && minimum.length === 1 && minimum[0][1] === '24' && target.length === 1 && target[0][1] === '36', 'Wrong actual debug instrumentation package or SDK boundary.');
  const targets = [...manifest.matchAll(/android:targetPackage[^"\r\n]*"([^"]+)"/gu)];
  const runners = [...manifest.matchAll(/android:name[^"\r\n]*"([^"]+)"/gu)].filter(row => row[1] === 'androidx.test.runner.AndroidJUnitRunner');
  check(targets.length === 1 && targets[0][1] === 'ru.probpera.literaryplanet.dev' && runners.length === 1, 'Instrumentation does not target this dev application with its one canonical runner.');
  const versionCode = rows[0][2] === '' ? null : Number(rows[0][2]);
  check(versionCode === null || Number.isSafeInteger(versionCode) && versionCode >= 1, 'Malformed optional instrumentation version.');
  return { applicationId: rows[0][1], versionCode, versionName: rows[0][3] || null, debuggable: true, minSdkVersion: 24, targetSdkVersion: 36 };
}
export function parseAndroidCertificate(text) {
  const certificates = [...text.matchAll(/^Signer #[0-9]+ certificate SHA-256 digest: ([a-f0-9]{64})\s*$/gmu)].map(match => match[1]);
  check(certificates.length === 1, 'Exactly one verified signing certificate is required.'); return certificates[0];
}
const ANDROID_WIFI_DISABLED = 'Wifi is disabled\nWifi scanning is only available when wifi is enabled';
function androidOfflineReply(value) {
  check(typeof value === 'string' && value.length <= 256, 'Bounded offline state reply required.');
  return value.replaceAll('\r\n', '\n').replace(/\n$/u, '');
}
/** Only exact read-only guest observations are accepted. Airplane mode alone
 * permits Wi-Fi re-enablement; disabled cellular and scanning are separate.
 * The owned AVD wrapper sets these beforehand. This operator never sets them. */
export function parseAndroidOfflineState(value) {
  check(ownRecord(value) && Object.keys(value).sort().join(',') === 'airplaneMode,mobileData,wifiStatus', 'Exact offline state fields required.');
  const airplaneMode = androidOfflineReply(value.airplaneMode), mobileData = androidOfflineReply(value.mobileData), wifiStatus = androidOfflineReply(value.wifiStatus);
  check(airplaneMode === '1' && mobileData === '0' && wifiStatus === ANDROID_WIFI_DISABLED, 'Owned Android target is not verifiably offline.');
  return Object.freeze({ airplaneMode, mobileData, wifiStatus });
}
function androidOfflineCommandArgs(value) {
  const length = Array.isArray(value) ? Object.getOwnPropertyDescriptor(value, 'length')?.value : null;
  check(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && Number.isSafeInteger(length) && length >= 2 && length <= 32
    && Reflect.ownKeys(value).length === length + 1, 'Exact bounded Android command array required.');
  const copied = [];
  for (let index = 0; index < length; index++) {
    const field = Object.getOwnPropertyDescriptor(value, String(index));
    check(field && Object.hasOwn(field, 'value') && field.enumerable && typeof field.value === 'string'
      && field.value.length > 0 && field.value.length <= 2048 && !/[\u0000-\u001f\u007f]/u.test(field.value), 'Primitive Android command arguments required.');
    copied.push(field.value);
  }
  const install = copied[0] === 'install' && (copied.length === 2 || copied.length === 3 && copied[1] === '-r')
    && !copied.at(-1).startsWith('-') && copied.at(-1).endsWith('.apk');
  const launch = copied.length === 6 && copied.slice(0, 5).join(',') === 'shell,am,start,-W,-n'
    && copied[5] === 'ru.probpera.literaryplanet.dev/ru.probpera.literaryplanet.MainActivity';
  const instrument = copied.length === 15 && copied.slice(0, 7).join(',') === 'shell,am,instrument,-w,-r,-e,class'
    && (copied[7] === 'ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest'
      ? copied[12] === 'literaryChildDataPhase' && ['write','read','atomic','retire','corrupt','missing-key','missing-cipher','clear'].includes(copied[13])
      : copied[7] === 'ru.probpera.literaryplanet.PlanetChildDataTransportRuntimeTest'
        ? copied[12] === 'literaryChildTransportPhase' && copied[13] === 'wire'
        : copied[7] === childLocalV2PinOperationsSelection || copied[7] === childLocalV2ProfileEntrySelection
          ? copied[12] === 'literaryFirstInstallPhase' && copied[13] === 'first-install-v2'
        : copied[7] === childLocalV2MediaSelection ? copied[12] === 'literaryChildMediaPhase' && copied[13] === 'local-v2-media'
        : copied[7] === childLocalV2ResourcesSelection ? copied[12] === 'literaryChildResourcesPhase' && copied[13] === 'local-v2-resources'
        : copied[7] === childLocalV2AppearanceSelection ? copied[12] === 'literaryChildAppearancePhase' && copied[13] === 'local-v2-profile-appearance'
        : copied[7] === childLocalV2CanonicalResourcesSelection ? copied[12] === 'literaryChildCanonicalResourcePhase' && copied[13] === 'local-v2-canonical-resource'
        : copied[7] === pinVerificationInputClass
          ? copied[12] === 'literaryPinVerificationInputPhase' && copied[13] === 'input'
        : copied[7] === 'ru.probpera.literaryplanet.PlanetChildProtectedEnvelopeRuntimeTest'
          ? copied[12] === 'literaryProtectedEnvelopePhase' && copied[13] === 'codec'
        : ['PlanetSecureStoreRuntimeTest','PlanetPreferencesRuntimeTest','PlanetPreviousPreferencesRuntimeTest'].some(name => copied[7] === 'ru.probpera.literaryplanet.' + name)
        && copied[12] === 'literaryPhase' && ['write','read','remove','clear','absent','parallel','corrupt','unsupported-language','unsupported-theme','plugin-failure','timeout'].includes(copied[13]))
    && copied[8] === '-e' && copied[9] === 'literaryRunId' && /^[a-f0-9]{32}$/u.test(copied[10])
    && copied[11] === '-e'
    && copied[14] === 'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner';
  const appBridge = copied.length === 18 && copied.slice(0,7).join(',') === 'shell,am,instrument,-w,-r,-e,class'
    && copied[7] === childLocalV2AppBridgeSelection && copied[8] === '-e' && copied[9] === 'literaryRunId' && /^[a-f0-9]{32}$/u.test(copied[10])
    && copied.slice(11).join(',') === '-e,literaryFirstInstallPhase,first-install-v2,-e,literaryChildDataPhase,local-v2-bootstrap,ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner';
  check(install || launch || instrument || appBridge, 'Only the existing exact Android install, launch or fixture command may cross this offline gate.');
  return Object.freeze(copied);
}
/** argv-bound gate; safe to import without device access. The adb port remains
 * responsible for exact owned-target binding, command deadlines and aborts.
 * Success records this observation only, never complete OS/product acceptance. */
export function createAndroidOfflineGate(adb, record) {
  check(typeof adb === 'function' && typeof record === 'function', 'Explicit owned Android command and record ports required.');
  let sequence = 0;
  async function verify(checkpoint, cleanup = false) {
    check(typeof checkpoint === 'string' && /^[a-z][a-z0-9-]{0,95}$/u.test(checkpoint) && typeof cleanup === 'boolean', 'Exact local offline checkpoint required.');
    const id = 'android-offline-' + ++sequence;
    try {
      const state = parseAndroidOfflineState({
        airplaneMode: await adb(['shell','settings','get','global','airplane_mode_on'], 5000, cleanup),
        mobileData: await adb(['shell','settings','get','global','mobile_data'], 5000, cleanup),
        wifiStatus: await adb(['shell','cmd','wifi','status'], 5000, cleanup),
      });
      record({ id, checkpoint, status: 'PASS', state, observedAt: new Date().toISOString() });
      return state;
    } catch {
      record({ id, checkpoint, status: 'FAIL', reason: 'android-offline-state-unavailable' });
      throw new Error('Owned Android target is not verifiably offline.');
    }
  }
  return Object.freeze({ verify, async command(checkpoint, args, timeoutMs = 30_000, cleanup = false) {
    const copied = androidOfflineCommandArgs(args);
    check(Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 180_000, 'Bounded Android command deadline required.');
    await verify(checkpoint, cleanup);
    return adb(copied, timeoutMs, cleanup);
  } });
}

export function instrumentationPassed(text) {
  return typeof text === 'string' && /(?:^|\n)OK \(1 test\)\s*(?:\n|$)/u.test(text)
    && !/FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=/u.test(text);
}
export function xctestPassed(text) {
  return typeof text === 'string' && /Executed 1 test, with 0 failures/u.test(text)
    && /\*\* TEST EXECUTE SUCCEEDED \*\*/u.test(text) && !/Test Case .* skipped|TEST EXECUTE FAILED|\b(?:failed|error):/iu.test(text);
}
/** Exact frozen nine-test structural class only. Its success establishes no
 * OS storage, PIN input, permission, checkpoint, clock or child admission. */
export function protectedEnvelopeFixturePassed(text, platform) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=|\bskipped\b|TEST EXECUTE FAILED|\b(?:failed|error):/iu.test(text)) return false;
  if (platform === 'android') {
    const summaries = [...text.matchAll(/^OK \(([0-9]+) tests?\)[ \t]*\r?$/gmu)];
    return summaries.length === 1 && summaries[0][1] === '9' && !/INSTRUMENTATION_STATUS_CODE:\s*-[1234]\b/u.test(text);
  }
  const summaries = [...text.matchAll(/^[ \t]*Executed ([0-9]+) tests?, with ([0-9]+) failures\b.*$/gmu)];
  return platform === 'ios' && summaries.length > 0 && /\*\* TEST EXECUTE SUCCEEDED \*\*/u.test(text)
    && summaries.every(row => row[1] === '9' && row[2] === '0');
}
const childDataPhases = Object.freeze(['write','read','atomic','retire','corrupt','missing-key','missing-cipher','clear']);
/** Each destructive fixture uses a separate deterministic, run-owned namespace.
 * These identifiers are isolation metadata, never native/PIN authority. */
export function childDataScenarioRunId(runId, scenario) {
  check(/^[a-f0-9]{32}$/u.test(runId) && ['primary','corrupt','missing-key','missing-cipher','private-transport'].includes(scenario), 'Exact own child-data scenario required.');
  return sha('literary-child-data-fixture-v1/' + runId + '/' + scenario).slice(0,32);
}
export function childDataFixtureArguments(runId, phase) {
  check(/^[a-f0-9]{32}$/u.test(runId) && childDataPhases.includes(phase), 'Exact own child-data phase required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest',
    '-e','literaryRunId',runId,'-e','literaryChildDataPhase',phase,'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
export function childTransportFixtureArguments(runId) {
  check(/^[a-f0-9]{32}$/u.test(runId), 'Exact own private transport fixture required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetChildDataTransportRuntimeTest',
    '-e','literaryRunId',runId,'-e','literaryChildTransportPhase','wire','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
export function childProtectedFixtureArguments(runId) {
  check(/^[a-f0-9]{32}$/u.test(runId), 'Exact own structural envelope fixture required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetChildProtectedEnvelopeRuntimeTest',
    '-e','literaryRunId',runId,'-e','literaryProtectedEnvelopePhase','codec','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
/** Fixed native UI fixture only. Run metadata grants no authority or storage proof. */
export const nativePinVerificationInputFixtureSourcePath = 'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildNativePinVerificationInputRuntimeTest.java';
const pinVerificationInputClass = 'ru.probpera.literaryplanet.PlanetChildNativePinVerificationInputRuntimeTest';
export const pinVerificationInputTestMethods = Object.freeze([
  'oneDigitOriginalEnglishActionAndReply', 'explicitRussianLocaleAndAllSixteenFixedCaptions', 'emptyMaximumDeletionAndOwnedBufferWipe',
  'backRevokesWithoutChargeOrAdmission', 'actualActivityPauseRevokesOriginalHost', 'obscuredTouchRejectsAndWipes',
  'blockedCurrentRetainsActualInputWorkerUntilReturn', 'originalExpiryDuringSynchronousKdfNeverRefunds',
  'throwingRecipientNeverReceivesSecondCompletion', 'completedRecipientStillCannotAckBeforeFinalObserverCleanup',
  'retirementJoinsVisibleOriginalInputAndCleanup', 'foreignThreadCannotBindThroughOriginalVisibleSlot',
  'failureBeforeRecipientRetainsOriginalUncertainTransfer',
]);
export function verifyNativePinVerificationInputFixtureSource(files) {
  check(Array.isArray(files) && files.filter(row => row?.path === nativePinVerificationInputFixtureSourcePath).length === 1
    && files.some(row => row?.path === nativePinVerificationInputFixtureSourcePath && hash(row.sha256)),
    'Missing exact native verification-input fixture source binding.');
  return true;
}
export function pinVerificationInputFixtureArguments(runId) {
  check(typeof runId === 'string' && /^[a-f0-9]{32}$/u.test(runId), 'Exact own native verification-input run required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class',pinVerificationInputClass,
    '-e','literaryRunId',runId,'-e','literaryPinVerificationInputPhase','input','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
/** Only all thirteen exact methods, original start/pass statuses and one successful
 * terminal summary count. No installed storage, real KDF or ParentGate claim. */
export function pinVerificationInputFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const summaries = [...text.matchAll(/^OK \(([0-9]+) tests?\)[ \t]*\r?$/gmu)];
  const terminals = [...text.matchAll(/^INSTRUMENTATION_CODE:[ \t]*(-?[0-9]+)[ \t]*\r?$/gmu)];
  if (summaries.length !== 1 || summaries[0][1] !== '13' || terminals.length !== 1 || terminals[0][1] !== '-1') return false;
  const expected = new Set(pinVerificationInputTestMethods), started = new Set(), completed = new Set();
  let fields = new Map(), summarySeen = false, terminalSeen = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (summarySeen || terminalSeen || fields.size !== 0 || started.size !== 13 || completed.size !== 13) return false;
      summarySeen = true; continue;
    }
    const terminal = /^INSTRUMENTATION_CODE:[ \t]*(-?[0-9]+)[ \t]*$/u.exec(line);
    if (terminal) {
      if (!summarySeen || terminalSeen || terminal[1] !== '-1') return false;
      terminalSeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) return false;
    if ((summarySeen || terminalSeen) && (line.startsWith('INSTRUMENTATION_STATUS:') || line.startsWith('INSTRUMENTATION_STATUS_CODE:'))) return false;
    const field = /^INSTRUMENTATION_STATUS: (class|test|numtests)=(.*)$/u.exec(line);
    if (field) { if (fields.has(field[1])) return false; fields.set(field[1],field[2]); continue; }
    const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*(-?[0-9]+)[ \t]*$/u.exec(line);
    if (!status) { if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) return false; continue; }
    const method = fields.get('test');
    if (fields.size !== 3 || fields.get('class') !== pinVerificationInputClass || fields.get('numtests') !== '13' || !expected.has(method)) return false;
    if (status[1] === '1') { if (started.has(method)) return false; started.add(method); }
    else if (status[1] === '0') { if (!started.has(method) || completed.has(method)) return false; completed.add(method); }
    else return false;
    fields = new Map();
  }
  return summarySeen && terminalSeen && fields.size === 0 && started.size === 13 && completed.size === 13;
}

/** Fixed NONINTERACTIVE V2 boundary methods only. Run metadata is a test
 * selector, never owner/PIN, durable keyspace or ParentGate admission proof. */
export const nativeChildLocalV2PinOperationsFixtureSourcePath = 'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildFirstInstallRuntimeTest.java';
const childLocalV2PinOperationsClass = 'ru.probpera.literaryplanet.PlanetChildFirstInstallRuntimeTest';
export const childLocalV2PinOperationsTestMethods = Object.freeze([
  'localV2RawEnrollmentCannotUseEvenOriginalSampleWithoutNativeOwnerKdf',
  'localV2RawChargeCannotMutateFromAnchoredBooleanOrP1Receipt',
  'localV2SyntheticOutcomeFlagsCannotAuthorizeEnrollmentMutation',
  'localV2CanonicalAdultSnapshotCannotMasqueradeAsOriginalChildGate',
  'localV2OriginalOwnerTargetLocaleAndIterationSubstitutionAreRefused',
  'localV2RetirementJoinsActualPinWorkerAfterCounterDrain',
  'localV2StaleNativeOperationCannotTouchFreshLeaseAfterRetirement',
  'localV2OwnedPromptPauseIsNarrowAndActualBackgroundStillLatches',
  'localV2ClosedResultLatchesBackgroundUntilActualObserverCleanup',
]);
const childLocalV2PinOperationsSelection = childLocalV2PinOperationsTestMethods.map(method => childLocalV2PinOperationsClass + '#' + method).join(',');
export function verifyNativeChildLocalV2PinOperationsFixtureSource(files) {
  check(Array.isArray(files) && files.filter(row => row?.path === nativeChildLocalV2PinOperationsFixtureSourcePath).length === 1
    && files.some(row => row?.path === nativeChildLocalV2PinOperationsFixtureSourcePath && hash(row.sha256)),
    'Missing unique exact Local V2 PIN operations fixture raw source binding.');
  return true;
}
export function childLocalV2PinOperationsFixtureArguments(runId) {
  check(typeof runId === 'string' && /^[a-f0-9]{32}$/u.test(runId), 'Exact own Local V2 PIN operations run required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2PinOperationsSelection,
    '-e','literaryRunId',runId,'-e','literaryFirstInstallPhase','first-install-v2','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
/** Nine exact matching serial start/pass pairs, one exact summary and terminal.
 * Standard AndroidJUnitRunner id/current/stream metadata is permitted inside
 * its original packet; unknown/duplicate fields and extra statuses fail closed.
 * This reduced fixture can never certify all 48 compiled methods. */
export function childLocalV2PinOperationsFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Set(childLocalV2PinOperationsTestMethods), started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summarySeen = false, terminalSeen = false, resultStreamSeen = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(9 tests\)[ \t]*$/u.test(line) || summarySeen || terminalSeen || active || fields.size !== 0 || completed.size !== 9 || started.size !== 9) return false;
      summarySeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summarySeen || terminalSeen || active || fields.size !== 0) return false;
      terminalSeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || resultStreamSeen || summarySeen || terminalSeen || active || fields.size !== 0 || completed.size !== 9) return false;
      resultStreamSeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summarySeen || terminalSeen) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false;
      fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test');
      if (!status || summarySeen || terminalSeen || fields.get('class') !== childLocalV2PinOperationsClass || fields.get('numtests') !== '9' || !expected.has(method)
        || fields.has('id') && fields.get('id') !== 'AndroidJUnitRunner' || fields.has('current') && !/^[1-9]$/u.test(fields.get('current'))) return false;
      const ordinal = fields.get('current');
      if (status[1] === '1') {
        if (active || started.has(method) || ordinal !== undefined && ordinals.has(ordinal)) return false;
        active = { method, ordinal, id: fields.get('id') }; started.add(method); if (ordinal !== undefined) ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.id !== fields.get('id') || completed.has(method)) return false;
        completed.add(method); active = null;
      }
      fields = new Map(); continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summarySeen && terminalSeen && active === null && fields.size === 0 && started.size === 9 && completed.size === 9;
}
/** Fixed new LOCAL v2 profile-entry leaves. This eight-method selector proves
 * native transition mechanics only; metadata is never Gate/profile authority. */
export const nativeChildLocalV2ProfileEntryFixtureSourcePath = 'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildFirstInstallRuntimeTest.java';
const childLocalV2ProfileEntryClass = 'ru.probpera.literaryplanet.PlanetChildFirstInstallRuntimeTest';
export const childLocalV2ProfileEntryTestMethods = Object.freeze([
  'localV2NativeAdultReentryUsesActualModeAndPreservesPinDebt',
  'localV2NativeCreationOwnsGeneratedUidBeforeOriginalChecksum',
  'localV2NativeCreationRejectsCallerUidMalformedProfileAndUnknownAction',
  'localV2NativeCreationAppendsAtMostFourAndNeverReusesUid',
  'localV2NativeAdultReentryRequiresRetainedKnownProfile',
  'localV2NativeContextBindingTracksAdultSelectionAndWholeRegistry',
  'localV2NativeReentryAndCreationCannotRefundOrRetargetCanonicalJournal',
  'localV2NativeAdultOriginalRequestKeepsSixteenActionsAndDeadline',
]);
const childLocalV2ProfileEntrySelection = childLocalV2ProfileEntryTestMethods.map(method => childLocalV2ProfileEntryClass + '#' + method).join(',');
export function verifyNativeChildLocalV2ProfileEntryFixtureSource(files) {
  check(Array.isArray(files) && files.filter(row => row?.path === nativeChildLocalV2ProfileEntryFixtureSourcePath).length === 1
    && files.some(row => row?.path === nativeChildLocalV2ProfileEntryFixtureSourcePath && hash(row.sha256)),
    'Missing unique exact Local V2 profile-entry fixture raw source binding.');
  return true;
}
export function childLocalV2ProfileEntryFixtureArguments(runId) {
  check(typeof runId === 'string' && runId.length === 32 && /^[a-f0-9]{32}$/u.test(runId), 'Exact own Local V2 profile-entry run required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2ProfileEntrySelection,
    '-e','literaryRunId',runId,'-e','literaryFirstInstallPhase','first-install-v2','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
/** Eight exact serial start/pass pairs with a complete unique terminal result. */
export function childLocalV2ProfileEntryFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Set(childLocalV2ProfileEntryTestMethods), started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summarySeen = false, terminalSeen = false, resultStreamSeen = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(8 tests\)[ \t]*$/u.test(line) || !resultStreamSeen || summarySeen || terminalSeen || active || fields.size !== 0 || completed.size !== 8 || started.size !== 8) return false;
      summarySeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summarySeen || terminalSeen || active || fields.size !== 0) return false;
      terminalSeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || resultStreamSeen || summarySeen || terminalSeen || active || fields.size !== 0 || completed.size !== 8) return false;
      resultStreamSeen = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summarySeen || terminalSeen) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false;
      fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test');
      if (!status || summarySeen || terminalSeen || fields.get('class') !== childLocalV2ProfileEntryClass || fields.get('numtests') !== '8' || !expected.has(method)
        || fields.get('id') !== 'AndroidJUnitRunner' || !/^[1-8]$/u.test(fields.get('current'))) return false;
      const ordinal = fields.get('current');
      if (status[1] === '1') {
        if (active || started.has(method) || ordinal !== undefined && ordinals.has(ordinal)) return false;
        active = { method, ordinal, id: fields.get('id') }; started.add(method); if (ordinal !== undefined) ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.id !== fields.get('id') || completed.has(method)) return false;
        completed.add(method); active = null;
      }
      fields = new Map(); continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summarySeen && terminalSeen && active === null && fields.size === 0 && started.size === 8 && completed.size === 8;
}

/** App bridge scope is selected independently of the retained profile and PIN
 * selectors. Imports/preflight never enumerate, install or launch a device. */
export const childLocalV2AppBridgeTestMethods = Object.freeze([
  'localV2AppPolicyIsFixedAndFactorySelectsNativeOwner',
  'localV2AppBootstrapRejectsUnknownSeedWithoutSignedInstallTerminal',
  'localV2AppWireKeepsOriginalV2ClockAndActionVocabulary',
  'localV2AppProfileDraftOwnsBirthFieldsAndRejectsCallerId',
  'localV2AppPinSuccessorKeepsSavedDebtAndNonPinBytes',
  'localV2AppKnownUnboundBirthExitRequiresExactSignedEmptyOrigin',
  'localV2AppWireRejectsV1AndCallerAuthorityFields',
  'localV2AppWireRejectsMediaReferencesAndUnsafeCollections',
  'localV2AppWireCorrelatesRetirementWithoutCallerAcknowledgement',
  'localV2AppCollectionTrailerKeepsLegacyBytesAndInactiveProfiles',
  'localV2AppCollectionTombstonesAdvanceRemovalAndReAddCAS',
  'localV2AppCollectionPendingDeniesUnknownReopen',
]);
export const childLocalV2AppBridgeFixtureSources = Object.freeze([
  'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildFirstInstallRuntimeTest.java',
  'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildDataTransportRuntimeTest.java',
  'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildDataStoreRuntimeTest.java',
]);
const childLocalV2AppBridgeClasses = childLocalV2AppBridgeTestMethods.map((_, index) =>
  'ru.probpera.literaryplanet.' + (index < 6 ? 'PlanetChildFirstInstallRuntimeTest' : index < 9 ? 'PlanetChildDataTransportRuntimeTest' : 'PlanetChildDataStoreRuntimeTest'));
const childLocalV2AppBridgeSelection = childLocalV2AppBridgeTestMethods.map((method,index) => childLocalV2AppBridgeClasses[index] + '#' + method).join(',');
export function verifyNativeChildLocalV2AppBridgeFixtureSources(files) {
  check(Array.isArray(files) && childLocalV2AppBridgeFixtureSources.every(source =>
    files.filter(row => row?.path === source).length === 1 && files.some(row => row?.path === source && hash(row.sha256))),
    'Missing unique exact native App bridge fixture source binding.'); return true;
}
export function childLocalV2AppBridgeFixtureArguments(runId) {
  check(typeof runId === 'string' && /^[a-f0-9]{32}$/u.test(runId), 'Exact own App bridge run required.');
  return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2AppBridgeSelection,
    '-e','literaryRunId',runId,'-e','literaryFirstInstallPhase','first-install-v2',
    '-e','literaryChildDataPhase','local-v2-bootstrap','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}
export function childLocalV2AppBridgeFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Map(childLocalV2AppBridgeTestMethods.map((method,index) => [method,childLocalV2AppBridgeClasses[index]])),
    started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summary = false, terminal = false, result = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(12 tests\)[ \t]*$/u.test(line) || !result || summary || terminal || active || fields.size || completed.size !== 12 || started.size !== 12) return false;
      summary = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summary || terminal || active || fields.size) return false;
      terminal = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || result || summary || terminal || active || fields.size || completed.size !== 12) return false;
      result = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summary || terminal) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false; fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test'), ordinal = fields.get('current');
      if (!status || summary || terminal || expected.get(method) !== fields.get('class') || fields.get('numtests') !== '12'
        || fields.get('id') !== 'AndroidJUnitRunner' || !/^(?:[1-9]|1[0-2])$/u.test(ordinal)) return false;
      if (status[1] === '1') {
        if (active || started.has(method) || ordinals.has(ordinal)) return false;
        active = {method,ordinal,klass:fields.get('class')};started.add(method);ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.klass !== fields.get('class') || completed.has(method)) return false;
        completed.add(method);active = null;
      }
      fields = new Map();continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summary && terminal && active === null && fields.size === 0 && started.size === 12 && completed.size === 12;
}


const childLocalV2MediaClass='ru.probpera.literaryplanet.PlanetChildMediaRuntimeTest';
export const childLocalV2MediaTestMethods=Object.freeze([
 'localV2MediaWireBindsExactOwnerAndRejectsCallerProofs',
 'localV2MediaLayoutRejectsOverflowFractionsAndNegativeZero',
 'localV2MediaNullReleaseIsRevocationOnlyAndExact',
 'localV2MediaActualPluginMethodsAndPrivatePermitAreRegistered',
 'localV2MediaEmptyCatalogRequiresExactSourceAndOutputClosure',
 'localV2MediaCatalogDeniesOrphansAndTextReviewKeyNamespace',
 'localV2MediaStaticPNGRejectsAnimationCRCAndOversizedPixels',
 'localV2MediaJPEGAndWebPRejectHiddenFramesAndContainerTails',
 'localV2MediaPCMRequiresBoundedDurationAlignmentAndActualContainer',
 'localV2MediaUnsupportedFormatsAndUnownedDecodeStayClosed',
]);
export const childLocalV2MediaFixtureSource='apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildMediaRuntimeTest.java';
const childLocalV2MediaClasses=childLocalV2MediaTestMethods.map(()=>childLocalV2MediaClass);
const childLocalV2MediaSelection=childLocalV2MediaTestMethods.map(method=>childLocalV2MediaClass+'#'+method).join(',');
export function verifyNativeChildLocalV2MediaFixtureSource(files){
 check(Array.isArray(files)&&files.filter(row=>row?.path===childLocalV2MediaFixtureSource).length===1&&files.some(row=>row?.path===childLocalV2MediaFixtureSource&&hash(row.sha256)),'Exact native media fixture source required.');return true;
}
export function childLocalV2MediaFixtureArguments(runId){
 check(typeof runId==='string'&&/^[a-f0-9]{32}$/u.test(runId),'Exact own media fixture run required.');
 return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2MediaSelection,
 '-e','literaryRunId',runId,'-e','literaryChildMediaPhase','local-v2-media','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}

export function childLocalV2MediaFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Map(childLocalV2MediaTestMethods.map((method,index) => [method,childLocalV2MediaClasses[index]])),
    started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summary = false, terminal = false, result = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(10 tests\)[ \t]*$/u.test(line) || !result || summary || terminal || active || fields.size || completed.size !== 10 || started.size !== 10) return false;
      summary = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summary || terminal || active || fields.size) return false;
      terminal = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || result || summary || terminal || active || fields.size || completed.size !== 10) return false;
      result = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summary || terminal) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false; fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test'), ordinal = fields.get('current');
      if (!status || summary || terminal || expected.get(method) !== fields.get('class') || fields.get('numtests') !== '10'
        || fields.get('id') !== 'AndroidJUnitRunner' || !/^(?:[1-9]|10)$/u.test(ordinal)) return false;
      if (status[1] === '1') {
        if (active || started.has(method) || ordinals.has(ordinal)) return false;
        active = {method,ordinal,klass:fields.get('class')};started.add(method);ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.klass !== fields.get('class') || completed.has(method)) return false;
        completed.add(method);active = null;
      }
      fields = new Map();continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summary && terminal && active === null && fields.size === 0 && started.size === 10 && completed.size === 10;
}


const childLocalV2ResourcesClass='ru.probpera.literaryplanet.PlanetChildResourcesRuntimeTest';
export const childLocalV2ResourcesTestMethods=Object.freeze([
 'localV2ResourcesEmptyCatalogRequiresExactProducerSourceAndOutput',
 'localV2ResourcesCatalogRejectsMissingInputsAndOrphanInventory',
 'localV2ResourcesCatalogRejectsUnknownFieldsAndAmbiguousBindings',
 'localV2ResourcesCanonicalOriginRejectsCallerAuthorityAndTraversal',
 'localV2ResourcesCanonicalPathBindsExactHashAndMime',
 'localV2ResourcesResponseRequiresExactStatusMimeAndLength',
 'localV2ResourcesBoundedBodyUsesActualBytesAndHash',
 'localV2ResourcesBoundedBodyRejectsZeroProgressAndOversizedInput',
 'localV2ResourcesBodyRefusalWipesActualOwnedBuffer',
    'localV2ResourcesTLSKeyHashRequiresActualP256PublicKey',
 'localV2ResourcesOriginalDeadlineNeverRenewsSourceLifetime',
 'localV2ResourcesDNSGateRejectsLocalAndReservedAddresses',
 'localV2ResourcesPrivateClaimAndWireCannotMintNativeAuthority',
]);
export const childLocalV2ResourcesFixtureSource='apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildResourcesRuntimeTest.java';
const childLocalV2ResourcesClasses=childLocalV2ResourcesTestMethods.map(()=>childLocalV2ResourcesClass);
const childLocalV2ResourcesSelection=childLocalV2ResourcesTestMethods.map(method=>childLocalV2ResourcesClass+'#'+method).join(',');
export function verifyNativeChildLocalV2ResourcesFixtureSource(files){
 check(Array.isArray(files)&&files.filter(row=>row?.path===childLocalV2ResourcesFixtureSource).length===1&&files.some(row=>row?.path===childLocalV2ResourcesFixtureSource&&typeof row.sha256==='string'&&row.sha256.length===64&&hash(row.sha256)),'Exact native resource fixture source required.');return true;
}
export function childLocalV2ResourcesFixtureArguments(runId){
 check(typeof runId==='string'&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),'Exact own resource fixture run required.');
 return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2ResourcesSelection,
 '-e','literaryRunId',runId,'-e','literaryChildResourcesPhase','local-v2-resources','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}

export function childLocalV2ResourcesFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|AssertionError|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Map(childLocalV2ResourcesTestMethods.map((method,index) => [method,childLocalV2ResourcesClasses[index]])),
    started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summary = false, terminal = false, result = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(13 tests\)[ \t]*$/u.test(line) || !result || summary || terminal || active || fields.size || completed.size !== 13 || started.size !== 13) return false;
      summary = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summary || terminal || active || fields.size) return false;
      terminal = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || result || summary || terminal || active || fields.size || completed.size !== 13) return false;
      result = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summary || terminal) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false; fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test'), ordinal = fields.get('current');
      if (!status || summary || terminal || expected.get(method) !== fields.get('class') || fields.get('numtests') !== '13'
        || fields.get('id') !== 'AndroidJUnitRunner' || !/^(?:[1-9]|1[0-3])$/u.test(ordinal)) return false;
      if (status[1] === '1') {
        if (active || started.has(method) || ordinals.has(ordinal) || Number(ordinal) !== started.size + 1) return false;
        active = {method,ordinal,klass:fields.get('class')};started.add(method);ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.klass !== fields.get('class') || completed.has(method)) return false;
        completed.add(method);active = null;
      }
      fields = new Map();continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summary && terminal && active === null && fields.size === 0 && started.size === 13 && completed.size === 13;
}



const childLocalV2CanonicalResourcesClass='ru.probpera.literaryplanet.PlanetChildCanonicalResourceRuntimeTest';
export const childLocalV2CanonicalResourcesTestMethods=Object.freeze([
 'closedWireRejectsCallerURLProofAndCleanupAcknowledgement','opaqueURIsAndNativeFactoriesRemainClosed',
 'sceneParserSupportsFractionsWithoutBroadeningOriginalPackageParser','realBoundWebViewDeniesUnknownWrongViewAndMainFrame',
 'genuineOriginalOutputDecodesUploadsAndRetiresAfterAcquisitionCommandReturned',
]);
export const childLocalV2CanonicalResourcesFixtureSource='apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildCanonicalResourceRuntimeTest.java';
const childLocalV2CanonicalResourcesClasses=childLocalV2CanonicalResourcesTestMethods.map(()=>childLocalV2CanonicalResourcesClass);
const childLocalV2CanonicalResourcesSelection=childLocalV2CanonicalResourcesTestMethods.map(method=>childLocalV2CanonicalResourcesClass+'#'+method).join(',');
export function verifyNativeChildLocalV2CanonicalResourcesFixtureSource(files){
 check(Array.isArray(files)&&files.filter(row=>row?.path===childLocalV2CanonicalResourcesFixtureSource).length===1
 &&files.some(row=>row?.path===childLocalV2CanonicalResourcesFixtureSource&&typeof row.sha256==='string'&&row.sha256.length===64&&hash(row.sha256)),'Exact canonical resource fixture source required.');return true;
}
export function childLocalV2CanonicalResourcesFixtureArguments(runId){
 check(typeof runId==='string'&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),'Exact own canonical resource fixture run required.');
 return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2CanonicalResourcesSelection,
 '-e','literaryRunId',runId,'-e','literaryChildCanonicalResourcePhase','local-v2-canonical-resource','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}

export function childLocalV2CanonicalResourcesFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|AssertionError|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Map(childLocalV2CanonicalResourcesTestMethods.map((method,index) => [method,childLocalV2CanonicalResourcesClasses[index]])),
    started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summary = false, terminal = false, result = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(5 tests\)[ \t]*$/u.test(line) || !result || summary || terminal || active || fields.size || completed.size !== 5 || started.size !== 5) return false;
      summary = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summary || terminal || active || fields.size) return false;
      terminal = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || result || summary || terminal || active || fields.size || completed.size !== 5) return false;
      result = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summary || terminal) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false; fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test'), ordinal = fields.get('current');
      if (!status || summary || terminal || expected.get(method) !== fields.get('class') || fields.get('numtests') !== '5'
        || fields.get('id') !== 'AndroidJUnitRunner' || !/^[1-5]$/u.test(ordinal)) return false;
      if (status[1] === '1') {
        if (active || started.has(method) || ordinals.has(ordinal) || Number(ordinal) !== started.size + 1) return false;
        active = {method,ordinal,klass:fields.get('class')};started.add(method);ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.klass !== fields.get('class') || completed.has(method)) return false;
        completed.add(method);active = null;
      }
      fields = new Map();continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summary && terminal && active === null && fields.size === 0 && started.size === 5 && completed.size === 5;
}

const childLocalV2AppearanceClass='ru.probpera.literaryplanet.PlanetChildAppearanceRuntimeTest';
export const childLocalV2AppearanceTestMethods=Object.freeze([
 "closedAppearanceWireDeniesCapabilitiesAndProfileOverride",
 "typedStableReferencesAndRevisionsRemainBounded",
 "legacyAndInactiveAppearanceSnapshotsRemainExact",
 "encryptedAppearancePersistsAcrossReopenWithoutImplicitSeed",
 "nativeSceneAuthorityAndFreshRestoreRemainRequired",
 "genuineAppearanceRestoreKeepsTriadAcrossContextRestartAndAllowedLocale"
]);
export const childLocalV2AppearanceFixtureSource='apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildAppearanceRuntimeTest.java';
const childLocalV2AppearanceClasses=childLocalV2AppearanceTestMethods.map(()=>childLocalV2AppearanceClass);
const childLocalV2AppearanceSelection=childLocalV2AppearanceTestMethods.map(method=>childLocalV2AppearanceClass+'#'+method).join(',');
export function verifyNativeChildLocalV2AppearanceFixtureSource(files){
 check(Array.isArray(files)&&files.filter(row=>row?.path===childLocalV2AppearanceFixtureSource).length===1
 &&files.some(row=>row?.path===childLocalV2AppearanceFixtureSource&&typeof row.sha256==='string'&&row.sha256.length===64&&hash(row.sha256)),'Exact protected appearance fixture source required.');return true;
}
export function childLocalV2AppearanceFixtureArguments(runId){
 check(typeof runId==='string'&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),'Exact own appearance fixture run required.');
 return Object.freeze(['shell','am','instrument','-w','-r','-e','class',childLocalV2AppearanceSelection,
 '-e','literaryRunId',runId,'-e','literaryChildAppearancePhase','local-v2-profile-appearance','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
}

export function childLocalV2AppearanceFixturePassed(text) {
  if (typeof text !== 'string' || text.length > 4 * 1024 * 1024 || text.includes('\0')
    || /FAILURES!!!|INSTRUMENTATION_FAILED|INSTRUMENTATION_ABORTED|Process crashed|AssertionError|shortMsg=|AssumptionViolatedException|\bskipped\b|\b(?:failed|error):/iu.test(text)) return false;
  const expected = new Map(childLocalV2AppearanceTestMethods.map((method,index) => [method,childLocalV2AppearanceClasses[index]])),
    started = new Set(), completed = new Set(), ordinals = new Set();
  let fields = new Map(), active = null, summary = false, terminal = false, result = false;
  for (const line of text.split(/\r?\n/u)) {
    if (/^OK \([0-9]+ tests?\)[ \t]*$/u.test(line)) {
      if (!/^OK \(6 tests\)[ \t]*$/u.test(line) || !result || summary || terminal || active || fields.size || completed.size !== 6 || started.size !== 6) return false;
      summary = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_CODE:')) {
      if (!/^INSTRUMENTATION_CODE:[ \t]*-1[ \t]*$/u.test(line) || !summary || terminal || active || fields.size) return false;
      terminal = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_RESULT:')) {
      if (!line.startsWith('INSTRUMENTATION_RESULT: stream=') || result || summary || terminal || active || fields.size || completed.size !== 6) return false;
      result = true; continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS:')) {
      if (summary || terminal) return false;
      const field = /^INSTRUMENTATION_STATUS: (class|test|numtests|current|id|stream)=(.*)$/u.exec(line);
      if (!field || fields.has(field[1])) return false; fields.set(field[1],field[2]); continue;
    }
    if (line.startsWith('INSTRUMENTATION_STATUS_CODE:')) {
      const status = /^INSTRUMENTATION_STATUS_CODE:[ \t]*([01])[ \t]*$/u.exec(line), method = fields.get('test'), ordinal = fields.get('current');
      if (!status || summary || terminal || expected.get(method) !== fields.get('class') || fields.get('numtests') !== '6'
        || fields.get('id') !== 'AndroidJUnitRunner' || !/^[1-6]$/u.test(ordinal)) return false;
      if (status[1] === '1') {
        if (active || started.has(method) || ordinals.has(ordinal) || Number(ordinal) !== started.size + 1) return false;
        active = {method,ordinal,klass:fields.get('class')};started.add(method);ordinals.add(ordinal);
      } else {
        if (!active || active.method !== method || active.ordinal !== ordinal || active.klass !== fields.get('class') || completed.has(method)) return false;
        completed.add(method);active = null;
      }
      fields = new Map();continue;
    }
    if (/^\s*INSTRUMENTATION_(?:STATUS|STATUS_CODE|CODE|RESULT)/u.test(line)) return false;
  }
  return summary && terminal && active === null && fields.size === 0 && started.size === 6 && completed.size === 6;
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
  const preference = phase.startsWith('preferences:'), childData = phase.startsWith('child-data:'), childTransport = phase.startsWith('child-transport:'), childProtected = phase.startsWith('child-protected:');
  const selected = preference ? phase.slice('preferences:'.length) : childData ? phase.slice('child-data:'.length) : childTransport ? phase.slice('child-transport:'.length) : childProtected ? phase.slice('child-protected:'.length) : phase;
  check(/^[a-f0-9]{32}$/u.test(runId) && (childProtected ? ['codec'] : childTransport ? ['wire'] : childData ? childDataPhases : preference ? ['write', 'read', 'parallel', 'corrupt', 'remove', 'absent', 'clear', 'unsupported-language', 'unsupported-theme', 'plugin-failure', 'timeout']
    : ['write', 'read', 'parallel', 'corrupt', 'remove', 'absent']).includes(selected), 'Wrong synthetic XCTest phase.');
  target.EnvironmentVariables = { ...target.EnvironmentVariables };
  for (const key of ['LITERARY_PLANET_SECURE_TEST_RUN_ID','LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID','LITERARY_PLANET_SECURE_TEST_PHASE','LITERARY_PLANET_PREFERENCE_TEST_PHASE','LITERARY_PLANET_CHILD_DATA_TEST_PHASE','LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID','LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE']) delete target.EnvironmentVariables[key];
  if (!childProtected) {
    target.EnvironmentVariables[childTransport ? 'LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID' : childData ? 'LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID' : 'LITERARY_PLANET_SECURE_TEST_RUN_ID'] = runId;
    target.EnvironmentVariables[childTransport ? 'LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE' : childData ? 'LITERARY_PLANET_CHILD_DATA_TEST_PHASE' : preference ? 'LITERARY_PLANET_PREFERENCE_TEST_PHASE' : 'LITERARY_PLANET_SECURE_TEST_PHASE'] = selected;
  }
  target.OnlyTestIdentifiers = [childProtected ? 'PlanetChildProtectedEnvelopeRuntimeTests' : childTransport ? 'PlanetChildDataTransportRuntimeTests/testPrivateTransportPhase' : childData ? 'PlanetChildDataStoreRuntimeTests/testDurableDataPhase' : 'PlanetSecureStoreRuntimeTests/' + (preference ? 'testPreferencePhase' : 'testSecureStoragePhase')];
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
  check(options.pinVerificationInput === undefined || typeof options.pinVerificationInput === 'boolean', 'Explicit verification-input selector required.');
  const pinVerificationInputOnly = options.pinVerificationInput === true;
  check(options.childLocalV2PinOperations === undefined || typeof options.childLocalV2PinOperations === 'boolean', 'Explicit Local V2 PIN operations selector required.');
  const childLocalV2PinOperationsOnly = options.childLocalV2PinOperations === true;
  check(options.childLocalV2ProfileEntry === undefined || typeof options.childLocalV2ProfileEntry === 'boolean', 'Explicit Local V2 profile-entry selector required.');
  const childLocalV2ProfileEntryOnly = options.childLocalV2ProfileEntry === true;
  check(options.childLocalV2AppBridge === undefined || typeof options.childLocalV2AppBridge === 'boolean', 'Explicit native App bridge selector required.');
  const childLocalV2AppBridgeOnly = options.childLocalV2AppBridge === true;
  check(options.childLocalV2Media===undefined||typeof options.childLocalV2Media==='boolean','Explicit media selector required.');const childLocalV2MediaOnly=options.childLocalV2Media===true;check(!childLocalV2MediaOnly||platform==='android'&&options.reboot!==true,'Media selector is Android-only and never reboots.');
  check(options.childLocalV2Appearance===undefined||typeof options.childLocalV2Appearance==='boolean','Explicit protected appearance selector required.');
  const childLocalV2AppearanceOnly=options.childLocalV2Appearance===true;
  check(!childLocalV2AppearanceOnly||platform==='android'&&(options.reboot===undefined||options.reboot===false),'Protected appearance selector is Android-only and never reboots.');
  check(options.childLocalV2CanonicalResources===undefined||typeof options.childLocalV2CanonicalResources==='boolean','Explicit canonical resource selector required.');
  const childLocalV2CanonicalResourcesOnly=options.childLocalV2CanonicalResources===true;
  check(!childLocalV2CanonicalResourcesOnly||platform==='android'&&(options.reboot===undefined||options.reboot===false),'Canonical resource selector is Android-only and never reboots.');
  check(options.childLocalV2Resources===undefined||typeof options.childLocalV2Resources==='boolean','Explicit native resource selector required.');
  const childLocalV2ResourcesOnly=options.childLocalV2Resources===true;
  check(!childLocalV2ResourcesOnly||platform==='android'&&(options.reboot===undefined||options.reboot===false),'Native resource selector is Android-only and never reboots.');
  check(!childLocalV2AppBridgeOnly || platform === 'android' && options.reboot !== true, 'Native App bridge selection is Android-only and does not reboot a target.');
  check([pinVerificationInputOnly,childLocalV2PinOperationsOnly,childLocalV2ProfileEntryOnly,childLocalV2AppBridgeOnly,childLocalV2MediaOnly,childLocalV2ResourcesOnly,childLocalV2CanonicalResourcesOnly,childLocalV2AppearanceOnly].filter(Boolean).length <= 1, 'Native private fixture selectors cannot be mixed.');
  check(!childLocalV2ProfileEntryOnly || platform === 'android' && options.reboot !== true, 'Local V2 profile-entry selection is Android-only and does not reboot a target.');
  check(!childLocalV2PinOperationsOnly || platform === 'android' && options.reboot !== true, 'Local V2 PIN operations selection is Android-only and does not reboot a target.');
  const privatePinFixtureOnly = pinVerificationInputOnly || childLocalV2PinOperationsOnly || childLocalV2ProfileEntryOnly || childLocalV2AppBridgeOnly || childLocalV2MediaOnly || childLocalV2ResourcesOnly || childLocalV2CanonicalResourcesOnly || childLocalV2AppearanceOnly;
  check(!pinVerificationInputOnly || platform === 'android' && options.reboot !== true, 'Verification-input selection is Android-only and does not reboot a target.');
  check(platform === 'android' || options.adbServerPort === undefined, 'An ADB server port applies only to Android.');
  const adbServerArgs = androidAdbServerArguments(options.adbServerPort);
  const runId = options.runId ?? randomUUID().replaceAll('-', '');
  check(!childLocalV2AppearanceOnly||typeof runId==='string'&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),'Exact own appearance fixture run identity required.');
  check(!childLocalV2CanonicalResourcesOnly||typeof runId==='string'&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),'Exact own canonical fixture run identity required.');
  check(!childLocalV2ResourcesOnly||typeof runId==='string'&&runId.length===32&&/^[a-f0-9]{32}$/u.test(runId),'Exact own resource fixture run identity required.');
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
  const report = { schemaVersion: 1, kind: childLocalV2AppearanceOnly ? 'literary-planet-child-local-v2-profile-appearance-runtime' : childLocalV2CanonicalResourcesOnly ? 'literary-planet-child-local-v2-canonical-resources-runtime' : childLocalV2ResourcesOnly ? 'literary-planet-child-local-v2-resources-runtime' : childLocalV2MediaOnly ? 'literary-planet-child-local-v2-media-runtime' : childLocalV2AppBridgeOnly ? 'literary-planet-child-local-v2-app-bridge-runtime' : childLocalV2ProfileEntryOnly ? 'literary-planet-child-local-v2-profile-entry-runtime' : childLocalV2PinOperationsOnly ? 'literary-planet-child-local-v2-pin-operations-runtime' : pinVerificationInputOnly ? 'literary-planet-native-pin-verification-input-runtime' : 'literary-planet-native-install-runtime', platform, channel: 'dev', runId,
    startedAt: new Date().toISOString(), status: 'NOT_RUN', releaseReady: false, installed: false, hardwareProtectionTested: false,
    checks: [], dependencies: [], commands: [], captures: [], cleanup: {},
    ...(adbServerArgs.length === 0 ? {} : { adbServer: { host: adbServerArgs[1], port: Number(adbServerArgs[3]) } }),
    limits: ['No production/remote/store/payment authorization.', 'Emulator/simulator observations do not establish hardware protection.',
      'Screenshots and process liveness require UI review; neither proves full product/native acceptance.'] };
  if (pinVerificationInputOnly) { report.fixture = { class: pinVerificationInputClass, tests: 13, phase: 'input', scope: 'native-ui-with-synthetic-authority-storage-kdf', runMetadataOnly: true, installedStorageAcceptance: false, parentGateAdmission: false };
    report.limits.push('Selected thirteen-case native UI fixture uses synthetic authority/storage/KDF; no ParentGate, installed-storage, genuine-provider or release acceptance.'); }
  if (childLocalV2PinOperationsOnly) {
    report.fixture = { class: childLocalV2PinOperationsClass, selection: childLocalV2PinOperationsSelection, methods: [...childLocalV2PinOperationsTestMethods], tests: 9,
      phase: 'first-install-v2', scope: 'private-native-local-v2-boundary-mechanics', noninteractive: true, runMetadataOnly: true,
      wholeFixtureAcceptance: false, realOsOwnerUiAcceptance: false, nativeKeyspacePersistenceAcceptance: false, installedStorageAcceptance: false, parentGateAdmission: false };
    report.limits.push('Selected nine noninteractive Local V2 methods prove private native boundary mechanics only; no real OS-owner UI, native keyspace persistence, ParentGate/admission, installed-storage or release acceptance. Unselected instrumentation methods remain a separate scope.');
  }
  if (childLocalV2ProfileEntryOnly) {
    report.fixture = { class: childLocalV2ProfileEntryClass, selection: childLocalV2ProfileEntrySelection, methods: [...childLocalV2ProfileEntryTestMethods], tests: 8,
      phase: 'first-install-v2', scope: 'private-native-local-v2-profile-entry-leaves', noninteractive: true, runMetadataOnly: true,
      wholeFixtureAcceptance: false, realOsOwnerUiAcceptance: false, nativeKeyspacePersistenceAcceptance: false, installedStorageAcceptance: false, parentGateAdmission: false };
    report.limits.push('Selected eight profile-entry leaves use synthetic canonical records only; no actual PIN/Gate host, approved release package, durable AES migration, App/UI, installed-device or release acceptance.');
  }
  if (childLocalV2AppBridgeOnly) {
    report.fixture = { selection:childLocalV2AppBridgeSelection,methods:[...childLocalV2AppBridgeTestMethods],sources:[...childLocalV2AppBridgeFixtureSources],tests:12,
      scope:'native-local-v2-sdk-bridge-mechanics',noninteractive:true,runMetadataOnly:true,wholeFixtureAcceptance:false,realOsOwnerUiAcceptance:false,
      nativeKeyspacePersistenceAcceptance:false,installedStorageAcceptance:false,parentGateAdmission:false };
    report.limits.push('These twelve authored native SDK/bridge/collection cases prove their actual selected observations only; no human OS-owner/PIN, genuine release-package admission, encrypted installed App or release acceptance.');
  }

  if(childLocalV2MediaOnly){
    report.fixture={class:childLocalV2MediaClass,selection:childLocalV2MediaSelection,methods:[...childLocalV2MediaTestMethods],
      source:childLocalV2MediaFixtureSource,tests:10,scope:'native-local-v2-media-compiler-codec-wire-mechanics',noninteractive:true,
      runMetadataOnly:true,wholeFixtureAcceptance:false,realOsMediaUiAcceptance:false,humanReviewAcceptance:false,
      installedStorageAcceptance:false,parentGateAdmission:false};
    report.limits.push('Ten selected media compiler/container/wire mechanics do not prove actual native pixel/audio lifecycle, saved-child admission, authentic human review/rights or device/release acceptance.');
  }

  if(childLocalV2ResourcesOnly){
    report.fixture={class:childLocalV2ResourcesClass,selection:childLocalV2ResourcesSelection,methods:[...childLocalV2ResourcesTestMethods],
      source:childLocalV2ResourcesFixtureSource,tests:childLocalV2ResourcesTestMethods.length,phase:'local-v2-resources',
      scope:'native-local-v2-resource-source-url-response-lifetime-ownership-mechanics',noninteractive:true,runMetadataOnly:true,
      wholeFixtureAcceptance:false,realTlsNetworkAcceptance:false,realOsMediaUiAcceptance:false,humanReviewAcceptance:false,
      authenticatedReleaseRightsAcceptance:false,paidAuthorityAcceptance:false,installedStorageAcceptance:false,parentGateAdmission:false};
    report.limits.push('Thirteen exact selected resource catalog/canonical URL/TLS-key/response/encoded-byte/lifetime/private-construction mechanics do not prove real TLS network, OS-owned media UI, authenticated release/rights/paid authority, installed storage or release acceptance.');
  }
  if(childLocalV2CanonicalResourcesOnly){
    report.fixture={class:childLocalV2CanonicalResourcesClass,selection:childLocalV2CanonicalResourcesSelection,methods:[...childLocalV2CanonicalResourcesTestMethods],source:childLocalV2CanonicalResourcesFixtureSource,tests:5,phase:'local-v2-canonical-resource',scope:'native-canonical-resource-wire-webview-decoder-gpu-ownership',runMetadataOnly:true,wholeFixtureAcceptance:false,genuinePositivePrerequisite:'Separately staged independently signed native package/media/scene/resource fixture and protected LOCAL2 child record on a native target; fixture metadata supplies no authority.',genuinePositiveAcceptance:false};
    report.limits.push('Positive native output requires real separately staged private native input; absent prerequisites or assumptions are NOT_RUN and never a five-method PASS. This selector does not create approvals or child records.');
  }
  if(childLocalV2AppearanceOnly){
    report.fixture={class:childLocalV2AppearanceClass,selection:childLocalV2AppearanceSelection,methods:[...childLocalV2AppearanceTestMethods],
      source:childLocalV2AppearanceFixtureSource,tests:6,phase:'local-v2-profile-appearance',
      scope:'native-protected-per-profile-selection-and-fresh-scene-restoration',runMetadataOnly:true,wholeFixtureAcceptance:false,
      installedStorageAcceptance:false,realOsOwnerUiAcceptance:false,genuinePositiveAcceptance:false,
      genuinePositivePrerequisite:'Separately staged authentic native package/media/scenes/review/rights and a protected LOCAL2 child record on a native target; this selector creates no authority or saved child.'};
    report.limits.push('Appearance codec/CAS fixtures and their synthetic inputs do not prove actual OS authority or release approval. Genuine positive restart/locale restoration remains NOT_RUN without separately owner-staged native prerequisites.');
  }
  const abort = new AbortController(), interrupt = () => abort.abort();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  let ownedAndroidInstall = false, ownedTestInstall = false, ownedSimulator = null, receipt, xctestrun;
  let previousAssessment = null, installedAndroidGeneration = null, legacyPreferenceSeeded = false;
  const childFixtureIds = new Set(), primaryChildId = childDataScenarioRunId(runId,'primary');
  let iosChildInstrument = null;
  const toolRoot = path.join(root, '.tmp', 'native-tools');
  const extension = process.platform === 'win32' ? '.exe' : '';
  const tools = { adb: path.join(toolRoot, 'android-sdk', 'platform-tools', 'adb' + extension),
    aapt: path.join(toolRoot, 'android-sdk', 'build-tools', '36.0.0', 'aapt2' + extension),
    java: path.join(toolRoot, 'java', 'jdk-21.0.12.1+1', 'bin', 'java' + extension),
    signer: path.join(toolRoot, 'android-sdk', 'build-tools', '36.0.0', 'lib', 'apksigner.jar'),
    androidHome: path.join(toolRoot, 'android-user'), xcrun: '/usr/bin/xcrun' };
  const commandContext = nativeRuntimeCommandContext(process.env, output), env = commandContext.env;
  let commandDirectoriesReady = false;
  async function command(binary, args, timeoutMs = 30_000, cleanup = false) {
    if (!commandDirectoriesReady) {
      for (const directory of commandContext.directories) {
        await mkdir(directory); const stat = await lstat(directory);
        check(within(output, directory) && stat.isDirectory() && !stat.isSymbolicLink() && await realpath(directory) === directory, 'Linked command cache.');
      }
      commandDirectoriesReady = true;
    }
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
  const adb = (args, timeoutMs, cleanup) => command(tools.adb, [...adbServerArgs, '-s', options.serial, ...args], timeoutMs, cleanup);
  const offline = createAndroidOfflineGate(adb, entry => { report.checks.push(entry); });
  const sim = (args, timeoutMs, cleanup) => command(tools.xcrun, ['simctl', ...args], timeoutMs, cleanup);
  const record = (id, status, reason) => { report.checks.push({ id, status, ...(reason ? { reason } : {}) }); };
  async function androidInstrument(phase, cleanup = false, preference = false) {
    const text = await offline.command('instrument-' + (preference ? 'preferences-' : 'secure-') + phase, ['shell', 'am', 'instrument', '-w', '-r', '-e', 'class', 'ru.probpera.literaryplanet.' + (preference ? 'PlanetPreferencesRuntimeTest' : 'PlanetSecureStoreRuntimeTest'),
      '-e', 'literaryRunId', runId, '-e', 'literaryPhase', phase, 'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner'], 60_000, cleanup);
    check(instrumentationPassed(text), 'Synthetic secure-store instrumentation did not pass: ' + phase);
  }
  async function androidPreference(phase, label = phase) {
    await androidInstrument(phase, false, true);
    report.checks.push({ id: 'preferences-' + label, status: 'PASS', backend: phase === 'plugin-failure' || phase === 'timeout' ? 'synthetic-boundary' : 'native-os' });
  }
  async function androidChildData(phase, fixtureId = primaryChildId, label = phase, cleanup = false) {
    if (phase === 'write') childFixtureIds.add(fixtureId);
    const text = await offline.command('instrument-child-data-' + label, childDataFixtureArguments(fixtureId,phase),60_000,cleanup);
    check(instrumentationPassed(text), 'Synthetic child-data instrumentation did not pass: ' + label);
    report.checks.push({id:'child-data-' + label,status:'PASS',backend:'native-os',scope:'synthetic-partition-only',fixtureRunId:fixtureId});
    if (phase === 'clear') childFixtureIds.delete(fixtureId);
  }
  async function finishChildDataFixtures(instrument) {
    await instrument('atomic',primaryChildId); await instrument('retire',primaryChildId); await instrument('clear',primaryChildId);
    for (const selected of ['corrupt','missing-key','missing-cipher']) {
      const fixtureId = childDataScenarioRunId(runId,selected);
      await instrument('write',fixtureId,selected + '-seed'); await instrument(selected,fixtureId); await instrument('clear',fixtureId,selected + '-clear');
    }
  }
  async function androidPreviousPreference(phase, cleanup = false) {
    check(['write','read','remove'].includes(phase), 'Exact historical preference fixture phase required.');
    const text = await offline.command('instrument-previous-' + phase, ['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetPreviousPreferencesRuntimeTest',
      '-e','literaryRunId',runId,'-e','literaryPhase',phase,'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner'],60_000,cleanup);
    check(instrumentationPassed(text), 'Historical isolated Preferences fixture did not pass: ' + phase);
  }
  async function installedAndroidBytes(expectedSha256, filename) {
    const installed = (await adb(['shell','pm','path',receipt.applicationId])).trim();
    check(/^package:\/data\/app\/[^\n]+\/base\.apk$/u.test(installed), 'Expected one installed base APK.');
    await adb(['pull',installed.slice(8),path.join(output,filename)],60_000);
    check(sha(await regular(output,filename)) === expectedSha256, 'Installed APK differs from the exact bound package.');
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
    if (pinVerificationInputOnly) verifyNativePinVerificationInputFixtureSource(receipt.sourceInputs.files);
    if (childLocalV2PinOperationsOnly) verifyNativeChildLocalV2PinOperationsFixtureSource(receipt.sourceInputs.files);
    if (childLocalV2ProfileEntryOnly) verifyNativeChildLocalV2ProfileEntryFixtureSource(receipt.sourceInputs.files);
    if (childLocalV2AppBridgeOnly) verifyNativeChildLocalV2AppBridgeFixtureSources(receipt.sourceInputs.files);
    if (childLocalV2MediaOnly) verifyNativeChildLocalV2MediaFixtureSource(receipt.sourceInputs.files);
    if (childLocalV2ResourcesOnly) verifyNativeChildLocalV2ResourcesFixtureSource(receipt.sourceInputs.files);
    if (childLocalV2CanonicalResourcesOnly) verifyNativeChildLocalV2CanonicalResourcesFixtureSource(receipt.sourceInputs.files);
    if (childLocalV2AppearanceOnly) verifyNativeChildLocalV2AppearanceFixtureSource(receipt.sourceInputs.files);
    const webArtifactPath=receipt.webArtifactPath??'dist-native/artifact.json',webArtifactDir=path.posix.dirname(webArtifactPath);
    const audit = await verifyNativeArtifact({ rootDir: root,artifactDir:webArtifactDir }); check(audit.pass && audit.identity?.platform === platform && audit.identity.channel === 'dev'
      && audit.identity.sourceCommit === receipt.sourceCommit, 'Current exact native web preparation audit/source failed.');
    check(sha(await regular(root, webArtifactPath)) === receipt.webArtifactSha256, 'Wrong prepared web artifact.');
    const binary = path.resolve(root, receipt.artifactPath);
    if (platform === 'android') {
      check(sha(await regular(root, receipt.artifactPath)) === receipt.artifactSha256 && sha(await regular(root, receipt.testArtifactPath)) === receipt.testArtifactSha256, 'Wrong main or instrumentation APK digest.');
      report.toolchain = { java: await command(tools.java, [...commandContext.javaArgs, '-version']), aapt: await command(tools.aapt, ['version']), node: process.version };
      const metadata = parseAndroidPackage(await command(tools.aapt, ['dump', 'badging', binary]));
      check(metadata.applicationId === receipt.applicationId && metadata.versionCode === receipt.versionCode && metadata.versionName === receipt.versionName && metadata.debuggable, 'Actual APK version/application/debug channel differs from the receipt.');
      const test = path.resolve(root, receipt.testArtifactPath), testBadging = await command(tools.aapt, ['dump', 'badging', test]);
      const testManifest = await command(tools.aapt, ['dump', 'xmltree', '--file', 'AndroidManifest.xml', test]);
      const testMetadata = parseAndroidInstrumentationPackage(testBadging, testManifest);
      const certificate = parseAndroidCertificate(await command(tools.java, [...commandContext.javaArgs, '-jar', tools.signer, 'verify', '--verbose', '--print-certs', binary]));
      check(certificate === parseAndroidCertificate(await command(tools.java, [...commandContext.javaArgs, '-jar', tools.signer, 'verify', '--verbose', '--print-certs', test])), 'Instrumentation signing identity does not match the main APK.');
      report.signing = { certificateSha256: certificate, productionSigning: false };
      if (receipt.certificateSha256 !== undefined) check(receipt.certificateSha256 === certificate, 'Current certificate differs from the receipt.');
      if (!privatePinFixtureOnly && receipt.previousArtifact !== undefined && receipt.previousArtifact !== null) {
        previousAssessment = validatePreviousAndroidArtifact(receipt.previousArtifact,receipt,options.receiptPath);
        const previous = previousAssessment.previous, bytes = await regular(root,previous.artifactPath);
        check(bytes.length === previous.artifactBytes && sha(bytes) === previous.artifactSha256, 'Preserved predecessor bytes changed.');
        const inspected = await inspectPreviousAndroidApk(root,bytes), oldPath = path.resolve(root,previous.artifactPath);
        const oldMetadata = parseAndroidPackage(await command(tools.aapt,['dump','badging',oldPath]));
        const oldCertificate = parseAndroidCertificate(await command(tools.java,[...commandContext.javaArgs,'-jar',tools.signer,'verify','--verbose','--print-certs',oldPath]));
        const actualPrevious = createPreviousAndroidArtifact({path:previous.artifactPath,sha256:sha(bytes),bytes:bytes.length},oldMetadata,oldCertificate,inspected);
        verifyPreviousAndroidBinding(previous,actualPrevious);
        report.previousArtifact = { ...previous, compatible: previousAssessment.ready, dependency: previousAssessment.reason,
          scope: 'nonsecret-preferences-update-only', runtimeTested: false };
      }
      record('previous-version-secure-storage-update','NOT_RUN','The historical binary has no admitted compatible secure-store migration fixture; nonsecret Preferences cannot attest secret update.');
      record('previous-version-parent-pin-update','NOT_RUN','Protected child PIN/full-record update and actual checkpoint admission remain unavailable.');
      if (!previousAssessment?.ready) record('previous-version-update','NOT_RUN',previousAssessment?.reason ?? 'No bound preserved predecessor receipt exists; current preparation must inspect its saved previous APK.');
      else if (options.execute !== true) record('previous-version-update','NOT_RUN','Verified preserved predecessor is available; an explicitly owned fresh Android target and --execute are required.');
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
    if(childLocalV2AppearanceOnly){report.status='NOT_RUN';record('child-local-v2-profile-appearance','NOT_RUN',report.fixture.genuinePositivePrerequisite);return report;}
    if(childLocalV2CanonicalResourcesOnly){report.status='NOT_RUN';record('child-local-v2-canonical-resources','NOT_RUN',report.fixture.genuinePositivePrerequisite);return report;}
    if (options.execute !== true) { record('installed-runtime', 'NOT_RUN', 'Preflight performs no device access. Supply --execute with the explicitly owned target.'); return report; }
    if (platform === 'android') {
      if (!options.serial || !options.avdName) { record('owned-emulator', 'NOT_RUN', 'Supply a fresh explicitly owned run-specific AVD and its emulator serial.'); return report; }
      validateOwnedAndroidTarget(options.serial, options.avdName, runId);
      report.toolchain.adb = await command(tools.adb, ['version']);
      check((await adb(['shell', 'getprop', 'ro.kernel.qemu'])).trim() === '1', 'Target is not an Android emulator.');
      check((await adb(['emu', 'avd', 'name'])).replaceAll('\r\n', '\n').trim() === options.avdName + '\nOK', 'Emulator is not the explicitly owned run AVD.');
      check((await adb(['shell', 'pm', 'list', 'packages', receipt.applicationId])).trim() === '', 'Refuse an already installed application; use a fresh own emulator.');
      check(Number((await adb(['shell', 'getprop', 'ro.build.version.sdk'])).trim()) >= 28, 'Synthetic instrumentation requires API 28 or newer.');
      await offline.verify('owned-target-before-install');

      if(childLocalV2CanonicalResourcesOnly){
        // Fresh-install runner cannot invent the genuine saved child/reviewed
        // positive fixture. Preserve exact preflight identity and authored
        // selection; separately owner-staged invocation remains required.
        report.status='NOT_RUN';
        record('child-local-v2-canonical-resources','NOT_RUN',report.fixture.genuinePositivePrerequisite);
        return report;
      }
      if(childLocalV2ResourcesOnly){
        await offline.command('install-child-local-v2-resources',['install',binary],60_000);ownedAndroidInstall=true;installedAndroidGeneration='current';
        await offline.command('install-child-local-v2-resources-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000);ownedTestInstall=true;
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-resources-installed-base.apk');report.installed=true;record('installed-package-byte-equality','PASS');
        const observed=await offline.command('instrument-child-local-v2-resources',childLocalV2ResourcesFixtureArguments(runId),180_000);
        check(childLocalV2ResourcesFixturePassed(observed),'Exact thirteen-method resource fixture did not pass.');
        report.checks.push({id:'child-local-v2-resources',status:'PASS',scope:'native-local-v2-resource-source-url-response-lifetime-ownership-mechanics',
          tests:childLocalV2ResourcesTestMethods.length,wholeFixtureAcceptance:false,realTlsNetworkAcceptance:false,realOsMediaUiAcceptance:false,
          authenticatedReleaseRightsAcceptance:false,paidAuthorityAcceptance:false,installedStorageAcceptance:false,fixtureRunId:runId});
        await offline.verify('child-local-v2-resources-after-fixture');await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-resources-after-base.apk');
        check(JSON.stringify(await nativeRuntimeSources(root))===JSON.stringify(receipt.sourceInputs),'Source/configuration changed during resource fixture.');
        record('source-fingerprint-after-child-local-v2-resources','PASS');report.status='PASS';return report;
      }
      if(childLocalV2MediaOnly){
        await offline.command('install-child-local-v2-media',['install',binary],60_000);ownedAndroidInstall=true;installedAndroidGeneration='current';
        await offline.command('install-child-local-v2-media-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000);ownedTestInstall=true;
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-media-installed-base.apk');report.installed=true;record('installed-package-byte-equality','PASS');
        const observed=await offline.command('instrument-child-local-v2-media',childLocalV2MediaFixtureArguments(runId),180_000);
        check(childLocalV2MediaFixturePassed(observed),'Exact ten-method media fixture did not pass.');
        report.checks.push({id:'child-local-v2-media',status:'PASS',scope:'native-local-v2-media-compiler-codec-wire-mechanics',tests:10,wholeFixtureAcceptance:false,fixtureRunId:runId});
        await offline.verify('child-local-v2-media-after-fixture');await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-media-after-base.apk');
        check(JSON.stringify(await nativeRuntimeSources(root))===JSON.stringify(receipt.sourceInputs),'Source/configuration changed during media fixture.');
        record('source-fingerprint-after-child-local-v2-media','PASS');report.status='PASS';return report;
      }

      if (childLocalV2AppBridgeOnly) {
        await offline.command('install-child-local-v2-app-bridge',['install',binary],60_000);ownedAndroidInstall=true;installedAndroidGeneration='current';
        await offline.command('install-child-local-v2-app-bridge-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000);ownedTestInstall=true;
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-app-bridge-installed-base.apk');report.installed=true;record('installed-package-byte-equality','PASS');
        const observed=await offline.command('instrument-child-local-v2-app-bridge',childLocalV2AppBridgeFixtureArguments(runId),180_000);
        check(childLocalV2AppBridgeFixturePassed(observed),'Exact twelve-method native App bridge fixture did not pass.');
        report.checks.push({id:'child-local-v2-app-bridge',status:'PASS',backend:'selected-native-mechanics',scope:'native-local-v2-sdk-bridge-mechanics',tests:12,wholeFixtureAcceptance:false,fixtureRunId:runId});
        await offline.verify('child-local-v2-app-bridge-after-fixture');await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-app-bridge-after-base.apk');
        check(JSON.stringify(await nativeRuntimeSources(root))===JSON.stringify(receipt.sourceInputs),'Source/configuration changed during native App bridge fixture.');
        record('source-fingerprint-after-child-local-v2-app-bridge','PASS');report.status='PASS';return report;
      }
      if (childLocalV2ProfileEntryOnly) {
        await offline.command('install-child-local-v2-profile-entry',['install',binary],60_000); ownedAndroidInstall = true; installedAndroidGeneration = 'current';
        await offline.command('install-child-local-v2-profile-entry-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000); ownedTestInstall = true;
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-profile-entry-installed-base.apk');
        report.installed = true; record('installed-package-byte-equality','PASS');
        const observed = await offline.command('instrument-child-local-v2-profile-entry',childLocalV2ProfileEntryFixtureArguments(runId),180_000);
        check(childLocalV2ProfileEntryFixturePassed(observed),'Exact eight-method noninteractive Local V2 profile-entry fixture did not pass.');
        report.checks.push({id:'child-local-v2-profile-entry',status:'PASS',backend:'synthetic-boundary',scope:'private-native-local-v2-profile-entry-leaves',tests:8,wholeFixtureAcceptance:false,fixtureRunId:runId});
        await offline.verify('child-local-v2-profile-entry-after-fixture');
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-profile-entry-after-base.apk');
        check(JSON.stringify(await nativeRuntimeSources(root)) === JSON.stringify(receipt.sourceInputs),'Source/configuration changed during Local V2 profile-entry fixture.');
        record('source-fingerprint-after-child-local-v2-profile-entry','PASS');
        report.status = 'PASS'; return report;
      }
      if (childLocalV2PinOperationsOnly) {
        await offline.command('install-child-local-v2-pin-operations',['install',binary],60_000); ownedAndroidInstall = true; installedAndroidGeneration = 'current';
        await offline.command('install-child-local-v2-pin-operations-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000); ownedTestInstall = true;
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-pin-operations-installed-base.apk');
        report.installed = true; record('installed-package-byte-equality','PASS');
        const observed = await offline.command('instrument-child-local-v2-pin-operations',childLocalV2PinOperationsFixtureArguments(runId),180_000);
        check(childLocalV2PinOperationsFixturePassed(observed),'Exact nine-method noninteractive Local V2 PIN operations fixture did not pass.');
        report.checks.push({id:'child-local-v2-pin-operations',status:'PASS',backend:'synthetic-boundary',scope:'private-native-local-v2-boundary-mechanics',tests:9,wholeFixtureAcceptance:false,fixtureRunId:runId});
        await offline.verify('child-local-v2-pin-operations-after-fixture');
        await installedAndroidBytes(receipt.artifactSha256,'child-local-v2-pin-operations-after-base.apk');
        check(JSON.stringify(await nativeRuntimeSources(root)) === JSON.stringify(receipt.sourceInputs),'Source/configuration changed during Local V2 PIN operations fixture.');
        record('source-fingerprint-after-child-local-v2-pin-operations','PASS');
        report.status = 'PASS'; return report;
      }
      if (pinVerificationInputOnly) {
        await offline.command('install-pin-verification-input',['install',binary],60_000); ownedAndroidInstall = true; installedAndroidGeneration = 'current';
        await offline.command('install-pin-verification-input-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000); ownedTestInstall = true;
        await installedAndroidBytes(receipt.artifactSha256,'pin-verification-input-installed-base.apk');
        report.installed = true; record('installed-package-byte-equality','PASS');
        const observed = await offline.command('instrument-pin-verification-input',pinVerificationInputFixtureArguments(runId),180_000);
        check(pinVerificationInputFixturePassed(observed),'Exact thirteen-method native verification-input fixture did not pass.');
        report.checks.push({id:'pin-verification-input',status:'PASS',backend:'synthetic-boundary',scope:'native-ui-with-synthetic-authority-storage-kdf',tests:13,fixtureRunId:runId});
        await offline.verify('pin-verification-input-after-fixture');
        await installedAndroidBytes(receipt.artifactSha256,'pin-verification-input-after-base.apk');
        check(JSON.stringify(await nativeRuntimeSources(root)) === JSON.stringify(receipt.sourceInputs),'Source/configuration changed during verification-input fixture.');
        record('source-fingerprint-after-pin-verification-input','PASS');
        report.status = 'PASS'; return report;
      }
      if (previousAssessment?.ready) {
        const plan = androidPreviousUpdatePlan(receipt,previousAssessment,runId);
        await offline.command('install-previous',plan.previousInstall,60_000); ownedAndroidInstall = true; installedAndroidGeneration = 'previous';
        await installedAndroidBytes(previousAssessment.previous.artifactSha256,'installed-previous-base.apk');
        record('previous-version-installed-byte-equality','PASS');
        await offline.command('install-previous-fixture',['install',path.resolve(root,receipt.testArtifactPath)],60_000); ownedTestInstall = true;
        legacyPreferenceSeeded = true;
        const seeded = await offline.command('instrument-previous-seed',plan.seedArguments,60_000); check(instrumentationPassed(seeded),'Previous application preference seed did not pass.');
        record('previous-version-preferences-seed','PASS');
        await adb(['shell','am','force-stop',receipt.applicationId]);
        await offline.command('install-current-update',plan.currentUpdate,60_000); installedAndroidGeneration = 'current';
      } else { await offline.command('install-current',['install', binary], 60_000); ownedAndroidInstall = true; installedAndroidGeneration = 'current';
        await offline.command('install-current-fixture',['install', path.resolve(root, receipt.testArtifactPath)], 60_000); ownedTestInstall = true; }
      await installedAndroidBytes(receipt.artifactSha256,'installed-base.apk');
      report.installed = true; record('installed-package-byte-equality', 'PASS');
      const protectedResult = await offline.command('instrument-child-protected-codec',childProtectedFixtureArguments(runId),60_000);
      check(protectedEnvelopeFixturePassed(protectedResult,'android'), 'Exact nine-test structural envelope fixture did not pass.');
      report.checks.push({id:'child-protected-codec',status:'PASS',backend:'synthetic-boundary',scope:'synthetic-structural-only',tests:9});
      if (previousAssessment?.ready) {
        await androidPreference('read','preserved-after-previous-update');
        report.previousArtifact.runtimeTested = true;
        report.checks.push({id:'previous-version-update',status:'PASS',backend:'native-os',scope:'nonsecret-preferences-only',
          previousArtifactSha256:previousAssessment.previous.artifactSha256,artifactSha256:receipt.artifactSha256,
          previousSourceCommit:previousAssessment.previous.sourceCommit,sourceCommit:receipt.sourceCommit});
      }
      await androidInstrument('write'); record('secure-storage-write-ciphertext-readback', 'PASS');
      await androidPreference('write');
      await androidChildData('write');
      const transportFixtureId = childDataScenarioRunId(runId,'private-transport'); childFixtureIds.add(transportFixtureId);
      check(instrumentationPassed(await offline.command('instrument-child-transport-wire',childTransportFixtureArguments(transportFixtureId),60_000)), 'Actual private transport fixture did not pass.');
      report.checks.push({id:'child-transport-wire',status:'PASS',backend:'native-os',scope:'synthetic-partition-only',fixtureRunId:transportFixtureId});
      await androidChildData('clear',transportFixtureId,'private-transport-clear');
      const launch = async () => { await offline.command('application-launch',['shell', 'am', 'start', '-W', '-n', receipt.applicationId + '/ru.probpera.literaryplanet.MainActivity']);
        await delay(2500, undefined, { signal: abort.signal });
        check(/^[1-9][0-9]*(?: [1-9][0-9]*)*$/u.test((await adb(['shell', 'pidof', receipt.applicationId])).trim()), 'Native process is not alive.'); };
      await launch(); await capture('first-launch.png'); record('first-launch', 'PASS');
      await adb(['shell', 'am', 'force-stop', receipt.applicationId]); await launch(); await androidInstrument('read'); record('new-process-secure-readback', 'PASS');
      await androidPreference('read', 'read-after-process');
      await androidChildData('read',primaryChildId,'read-after-process');
      await adb(['shell', 'input', 'keyevent', 'KEYCODE_HOME']); await launch(); record('background-return-liveness', 'PASS');
      if (options.reboot === true) {
        await offline.verify('owned-target-before-reboot');
        await adb(['reboot']); let booted = false;
        for (let attempt = 0; attempt < 20; attempt++) {
          await delay(2000, undefined, { signal: abort.signal });
          try { if ((await adb(['shell', 'getprop', 'sys.boot_completed'], 5000)).trim() === '1') { booted = true; break; } } catch {}
        }
        check(booted, 'Owned emulator did not reboot within the bounded window.');
        await offline.verify('owned-target-after-reboot');
        await androidInstrument('read'); await launch(); record('system-restart-secure-readback', 'PASS');
        await androidPreference('read', 'read-after-system-restart');
        await androidChildData('read',primaryChildId,'read-after-system-restart');
      } else { record('system-restart-secure-readback', 'NOT_RUN', 'Use --reboot-owned-target for this own emulator only.');
        record('preferences-read-after-system-restart', 'NOT_RUN', 'Use --reboot-owned-target for this own emulator only.');
        record('child-data-read-after-system-restart','NOT_RUN','Use --reboot-owned-target for this own emulator only.'); }
      for (const phase of ['unsupported-language', 'unsupported-theme', 'parallel', 'plugin-failure', 'timeout', 'corrupt', 'remove']) await androidPreference(phase);
      await androidInstrument('parallel'); record('secure-store-parallel', 'PASS');
      await androidInstrument('corrupt'); record('secure-store-corrupt', 'PASS');
      await androidInstrument('remove'); record('secure-store-remove', 'PASS');
      await androidInstrument('absent');
      await finishChildDataFixtures(androidChildData);
      await adb(['uninstall', receipt.applicationId]); ownedAndroidInstall = false;
      await offline.command('install-clean-current',['install', binary], 60_000); ownedAndroidInstall = true; installedAndroidGeneration = 'current';
      await offline.command('install-clean-fixture',['install', '-r', path.resolve(root, receipt.testArtifactPath)], 60_000); ownedTestInstall = true;
      await androidInstrument('absent'); await launch(); await capture('clean-reinstall.png'); record('clean-reinstall-qa-key-absent', 'PASS');
      await androidPreference('absent', 'absent-after-clean-reinstall');
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
      const instrument = async (phase, label = phase, fixtureId = runId, cleanup = false) => {
        const value = bindXctestrun(xctestrun, { templateDir: path.dirname(path.resolve(root, receipt.xctestrunPath)), binary, runId:fixtureId, phase });
        const own = path.join(output, 'secure-' + phase.replace(':', '-') + '-' + report.commands.length + '.xctestrun');
        await writeFile(own, json(value), { flag: 'wx' }); await command('/usr/bin/plutil', ['-convert', 'xml1', own],30_000,cleanup);
        const preference = phase.startsWith('preferences:'), childData = phase.startsWith('child-data:'), childTransport = phase.startsWith('child-transport:'), childProtected = phase.startsWith('child-protected:');
        const identifier = value.TestConfigurations[0].TestTargets[0].OnlyTestIdentifiers[0];
        const result = await command('/usr/bin/xcodebuild', ['test-without-building', '-xctestrun', own,
          '-destination', 'platform=iOS Simulator,id=' + id, '-only-testing:AppSecureStorageTests/' + identifier,
          '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-simulator-destinations', '1'], 60_000,cleanup);
        check(childProtected ? protectedEnvelopeFixturePassed(result,'ios') : xctestPassed(result), 'Synthetic XCTest did not pass: ' + phase);
        const installedPath = (await sim(['get_app_container', id, receipt.applicationId, 'app'])).trim();
        check(path.isAbsolute(installedPath) && installedPath.split(path.sep).includes(id) && await appDigest(installedPath) === receipt.artifactSha256,
          'XCTest changed the exact installed application.');
        report.checks.push({ id: (childProtected ? 'child-protected-' + label : childTransport ? 'child-transport-' + label : childData ? 'child-data-' + label : preference ? 'preferences-' + label.replace('preferences:', '') : 'keychain-' + label), status: 'PASS',
          ...(childProtected ? {scope:'synthetic-structural-only',tests:9} : childData || childTransport ? {scope:'synthetic-partition-only',fixtureRunId:fixtureId} : {}),
          backend: childProtected || phase === 'preferences:plugin-failure' || phase === 'preferences:timeout' ? 'synthetic-boundary' : 'native-os', xctestrunSha256: sha(await readFile(own)) });
      };
      iosChildInstrument = async (phase,fixtureId = primaryChildId,label = phase,cleanup = false) => {
        if (phase === 'write') childFixtureIds.add(fixtureId);
        await instrument('child-data:' + phase,label,fixtureId,cleanup);
        if (phase === 'clear') childFixtureIds.delete(fixtureId);
      };
      await instrument('child-protected:codec','codec');
      await instrument('write');
      await instrument('preferences:write');
      await iosChildInstrument('write');
      const transportFixtureId = childDataScenarioRunId(runId,'private-transport'); childFixtureIds.add(transportFixtureId);
      await instrument('child-transport:wire','wire',transportFixtureId);
      await iosChildInstrument('clear',transportFixtureId,'private-transport-clear');
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
      await iosChildInstrument('read',primaryChildId,'read-after-process');
      await sim(['shutdown', id]); await sim(['boot', id], 60_000); await sim(['bootstatus', id, '-b'], 60_000);
      await launch([]); record('system-restart-launch', 'PASS');
      await sim(['terminate', id, receipt.applicationId]); await instrument('read', 'read-after-system-restart');
      await instrument('preferences:read', 'read-after-system-restart');
      await iosChildInstrument('read',primaryChildId,'read-after-system-restart');
      for (const phase of ['unsupported-language', 'unsupported-theme', 'parallel', 'plugin-failure', 'timeout', 'corrupt', 'remove']) await instrument('preferences:' + phase);
      await instrument('parallel'); await instrument('corrupt'); await instrument('remove'); await instrument('absent');
      await finishChildDataFixtures(iosChildInstrument);
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
    for (const fixtureId of [...childFixtureIds]) {
      try {
        if (platform === 'android' && ownedTestInstall && installedAndroidGeneration === 'current') await androidChildData('clear',fixtureId,'cleanup-' + fixtureId,true);
        else if (platform === 'ios' && ownedSimulator && iosChildInstrument) await iosChildInstrument('clear',fixtureId,'cleanup-' + fixtureId,true);
        else throw new Error('Owned child-data fixture is no longer reachable.');
        report.cleanup['childDataFixtureRemoved-' + fixtureId] = true;
      } catch { report.cleanup['childDataFixtureRemoved-' + fixtureId] = false; }
    }
    if (ownedAndroidInstall) {
      if (ownedTestInstall && !privatePinFixtureOnly) { try { if (legacyPreferenceSeeded || installedAndroidGeneration === 'previous') await androidPreviousPreference('remove',true);
        else await androidInstrument('clear', true, true); report.cleanup.preferenceFixtureRemoved = true; } catch { report.cleanup.preferenceFixtureRemoved = false; } }
      if (ownedTestInstall && installedAndroidGeneration === 'current' && !privatePinFixtureOnly) {
        try { await androidInstrument('clear', true); report.cleanup.secureFixtureRemoved = true; }
        catch { report.cleanup.secureFixtureRemoved = false; }
      }
      try { await adb(['uninstall', receipt.applicationId], 30_000, true); report.cleanup.mainApplicationRemoved = true; }
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

if (isLocalCliEntry(import.meta.url)) {
  const args = process.argv.slice(2), values = {};
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--execute') values.execute = true;
    else if (name === '--pin-verification-input') values.pinVerificationInput = true;
    else if (name === '--child-local-v2-pin-operations') values.childLocalV2PinOperations = true;
    else if (name === '--child-local-v2-profile-entry') values.childLocalV2ProfileEntry = true;
    else if (name === '--child-local-v2-app-bridge') values.childLocalV2AppBridge = true;
    else if (name === '--child-local-v2-media') values.childLocalV2Media = true;
    else if (name === '--child-local-v2-resources') values.childLocalV2Resources = true;
    else if (name === '--child-local-v2-profile-appearance') values.childLocalV2Appearance = true;
    else if (name === '--child-local-v2-canonical-resources') values.childLocalV2CanonicalResources = true;
    else if (name === '--reboot-owned-target') values.reboot = true;
    else if (['--platform', '--receipt', '--out', '--run-id', '--serial', '--avd-name', '--adb-server-port'].includes(name) && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('--')) values[name.slice(2)] = args[++index];
    else throw new Error('Use --platform android|ios --receipt relative.json --out .tmp/... [--run-id 32hex --serial emulator-N --avd-name LiteraryPlanet-V12-32hex --adb-server-port EVENPORT --execute --reboot-owned-target --pin-verification-input|--child-local-v2-pin-operations|--child-local-v2-profile-entry|--child-local-v2-app-bridge|--child-local-v2-media|--child-local-v2-resources|--child-local-v2-canonical-resources|--child-local-v2-profile-appearance].');
  }
  const report = await runNativeInstallRuntime({ platform: values.platform, receiptPath: values.receipt, outDir: values.out,
    runId: values['run-id'], serial: values.serial, avdName: values['avd-name'], adbServerPort: values['adb-server-port'] === undefined ? undefined : parseOwnedAdbServerPort(values['adb-server-port']), execute: values.execute, reboot: values.reboot, pinVerificationInput: values.pinVerificationInput, childLocalV2PinOperations: values.childLocalV2PinOperations, childLocalV2ProfileEntry: values.childLocalV2ProfileEntry, childLocalV2AppBridge: values.childLocalV2AppBridge, childLocalV2Media:values.childLocalV2Media, childLocalV2Resources:values.childLocalV2Resources, childLocalV2CanonicalResources:values.childLocalV2CanonicalResources,childLocalV2Appearance:values.childLocalV2Appearance });
  process.stdout.write(json({ status: report.status, platform: report.platform, runId: report.runId, releaseReady: false }));
  process.exitCode = report.status === 'PASS' ? 0 : 2;
}
