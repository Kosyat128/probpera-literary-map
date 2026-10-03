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
        : ['PlanetSecureStoreRuntimeTest','PlanetPreferencesRuntimeTest','PlanetPreviousPreferencesRuntimeTest'].some(name => copied[7] === 'ru.probpera.literaryplanet.' + name)
        && copied[12] === 'literaryPhase' && ['write','read','remove','clear','absent','parallel','corrupt','unsupported-language','unsupported-theme','plugin-failure','timeout'].includes(copied[13]))
    && copied[8] === '-e' && copied[9] === 'literaryRunId' && /^[a-f0-9]{32}$/u.test(copied[10])
    && copied[11] === '-e'
    && copied[14] === 'ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner';
  check(install || launch || instrument, 'Only the existing exact Android install, launch or fixture command may cross this offline gate.');
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
  const preference = phase.startsWith('preferences:'), childData = phase.startsWith('child-data:'), childTransport = phase.startsWith('child-transport:');
  const selected = preference ? phase.slice('preferences:'.length) : childData ? phase.slice('child-data:'.length) : childTransport ? phase.slice('child-transport:'.length) : phase;
  check(/^[a-f0-9]{32}$/u.test(runId) && (childTransport ? ['wire'] : childData ? childDataPhases : preference ? ['write', 'read', 'parallel', 'corrupt', 'remove', 'absent', 'clear', 'unsupported-language', 'unsupported-theme', 'plugin-failure', 'timeout']
    : ['write', 'read', 'parallel', 'corrupt', 'remove', 'absent']).includes(selected), 'Wrong synthetic XCTest phase.');
  target.EnvironmentVariables = { ...target.EnvironmentVariables };
  for (const key of ['LITERARY_PLANET_SECURE_TEST_RUN_ID','LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID','LITERARY_PLANET_SECURE_TEST_PHASE','LITERARY_PLANET_PREFERENCE_TEST_PHASE','LITERARY_PLANET_CHILD_DATA_TEST_PHASE','LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID','LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE']) delete target.EnvironmentVariables[key];
  target.EnvironmentVariables[childTransport ? 'LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID' : childData ? 'LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID' : 'LITERARY_PLANET_SECURE_TEST_RUN_ID'] = runId;
  target.EnvironmentVariables[childTransport ? 'LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE' : childData ? 'LITERARY_PLANET_CHILD_DATA_TEST_PHASE' : preference ? 'LITERARY_PLANET_PREFERENCE_TEST_PHASE' : 'LITERARY_PLANET_SECURE_TEST_PHASE'] = selected;
  target.OnlyTestIdentifiers = [childTransport ? 'PlanetChildDataTransportRuntimeTests/testPrivateTransportPhase' : childData ? 'PlanetChildDataStoreRuntimeTests/testDurableDataPhase' : 'PlanetSecureStoreRuntimeTests/' + (preference ? 'testPreferencePhase' : 'testSecureStoragePhase')];
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
  check(platform === 'android' || options.adbServerPort === undefined, 'An ADB server port applies only to Android.');
  const adbServerArgs = androidAdbServerArguments(options.adbServerPort);
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
    ...(adbServerArgs.length === 0 ? {} : { adbServer: { host: adbServerArgs[1], port: Number(adbServerArgs[3]) } }),
    limits: ['No production/remote/store/payment authorization.', 'Emulator/simulator observations do not establish hardware protection.',
      'Screenshots and process liveness require UI review; neither proves full product/native acceptance.'] };
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
      if (receipt.previousArtifact !== undefined && receipt.previousArtifact !== null) {
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
        const preference = phase.startsWith('preferences:'), childData = phase.startsWith('child-data:'), childTransport = phase.startsWith('child-transport:');
        const identifier = childTransport ? 'PlanetChildDataTransportRuntimeTests/testPrivateTransportPhase' : childData ? 'PlanetChildDataStoreRuntimeTests/testDurableDataPhase' : 'PlanetSecureStoreRuntimeTests/' + (preference ? 'testPreferencePhase' : 'testSecureStoragePhase');
        const result = await command('/usr/bin/xcodebuild', ['test-without-building', '-xctestrun', own,
          '-destination', 'platform=iOS Simulator,id=' + id, '-only-testing:AppSecureStorageTests/' + identifier,
          '-parallel-testing-enabled', 'NO', '-maximum-concurrent-test-simulator-destinations', '1'], 60_000,cleanup);
        check(xctestPassed(result), 'Synthetic Keychain XCTest did not pass: ' + phase);
        const installedPath = (await sim(['get_app_container', id, receipt.applicationId, 'app'])).trim();
        check(path.isAbsolute(installedPath) && installedPath.split(path.sep).includes(id) && await appDigest(installedPath) === receipt.artifactSha256,
          'XCTest changed the exact installed application.');
        report.checks.push({ id: (childTransport ? 'child-transport-' + label : childData ? 'child-data-' + label : preference ? 'preferences-' + label.replace('preferences:', '') : 'keychain-' + label), status: 'PASS',
          ...(childData || childTransport ? {scope:'synthetic-partition-only',fixtureRunId:fixtureId} : {}),
          backend: phase === 'preferences:plugin-failure' || phase === 'preferences:timeout' ? 'synthetic-boundary' : 'native-os', xctestrunSha256: sha(await readFile(own)) });
      };
      iosChildInstrument = async (phase,fixtureId = primaryChildId,label = phase,cleanup = false) => {
        if (phase === 'write') childFixtureIds.add(fixtureId);
        await instrument('child-data:' + phase,label,fixtureId,cleanup);
        if (phase === 'clear') childFixtureIds.delete(fixtureId);
      };
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
      if (ownedTestInstall) { try { if (legacyPreferenceSeeded || installedAndroidGeneration === 'previous') await androidPreviousPreference('remove',true);
        else await androidInstrument('clear', true, true); report.cleanup.preferenceFixtureRemoved = true; } catch { report.cleanup.preferenceFixtureRemoved = false; } }
      if (ownedTestInstall && installedAndroidGeneration === 'current') {
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
    else if (name === '--reboot-owned-target') values.reboot = true;
    else if (['--platform', '--receipt', '--out', '--run-id', '--serial', '--avd-name', '--adb-server-port'].includes(name) && typeof args[index + 1] === 'string' && !args[index + 1].startsWith('--')) values[name.slice(2)] = args[++index];
    else throw new Error('Use --platform android|ios --receipt relative.json --out .tmp/... [--run-id 32hex --serial emulator-N --avd-name LiteraryPlanet-V12-32hex --adb-server-port EVENPORT --execute --reboot-owned-target].');
  }
  const report = await runNativeInstallRuntime({ platform: values.platform, receiptPath: values.receipt, outDir: values.out,
    runId: values['run-id'], serial: values.serial, avdName: values['avd-name'], adbServerPort: values['adb-server-port'] === undefined ? undefined : parseOwnedAdbServerPort(values['adb-server-port']), execute: values.execute, reboot: values.reboot });
  process.stdout.write(json({ status: report.status, platform: report.platform, runId: report.runId, releaseReady: false }));
  process.exitCode = report.status === 'PASS' ? 0 : 2;
}
