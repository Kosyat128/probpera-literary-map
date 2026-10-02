/** Local, read-only evidence validation. Never builds, deploys or contacts a service. */
import path from 'node:path';
import { isLocalCliEntry } from './local-cli-entry.mjs';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nativeRuntimeSources, validateRuntimeReceipt, simulatorAppDigest } from './native-install-runtime.mjs';
import { containedFile, CANONICAL_BOOK_SOURCE_REGISTRY } from './pwa-artifact.mjs';
import { PWA_PORTRAIT_SELECTION_PATH } from './pwa-portrait-selection.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
const SHA = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const CHANNELS = { pwa: ['web-direct'], android: ['dev', 'googlePlay', 'ruStore'], ios: ['dev', 'appStore'] };
const STATUSES = new Set(['PASS', 'FAIL', 'BLOCKED_EXTERNAL', 'NOT_RUN', 'NOT_APPLICABLE']);
const COMMON = ['local-tests', 'content-preservation', 'ru-en-runtime', 'auth-deletion-local', 'auth-deletion-remote', 'editorial-legal', 'psp-commercial-decision', 'payment-sandbox', 'remote-authorization'];
const NATIVE = ['native-binary', 'installed-runtime', 'os-preferences', 'os-secret-storage', 'lifecycle-update'];
const STORE = ['owner-signing', 'store-payment-contract'];
export const OS_PREFERENCE_CASES = ['write','read-after-process','read-after-system-restart','remove','corrupt','unsupported-language','unsupported-theme','parallel','plugin-failure','timeout'];
export const SECRET_STORAGE_CASES = ['write','read-after-process','read-after-system-restart','remove','corrupt','parallel','plugin-failure','timeout','legacy-migration','interrupted-migration','logout','account-switch','account-deletion'];
const validCases = cases => Array.isArray(cases) && cases.length > 0 && cases.length <= 512 && Object.keys(cases).length === cases.length
  && cases.every(test => object(test) && typeof test.name === 'string' && test.name.length > 0 && test.status === 'PASS');
const hasCases = (facts, names) => validCases(facts.cases) && names.every(name => facts.cases.some(test => test.name === name));
const locales = value => Array.isArray(value) && value.length === 2 && value[0] === 'ru' && value[1] === 'en';
const BINDING_KEYS = ['sourceCommit', 'sourceFingerprint', 'lockSha256', 'toolsFingerprint', 'platform', 'channel', 'environment', 'artifactSha256'];
export function requiredGates(platform, channel) {
  if (!CHANNELS[platform]?.includes(channel)) throw new Error('Unsupported platform/channel');
  return [...COMMON, 'package-integrity', ...(platform === 'pwa' ? ['pwa-install-offline-update'] : NATIVE), ...(channel === 'dev' || platform === 'pwa' ? [] : STORE)];
}
export function validBinding(binding) {
  return object(binding) && typeof binding.sourceCommit === 'string' && COMMIT.test(binding.sourceCommit) && ['sourceFingerprint','lockSha256','toolsFingerprint','artifactSha256'].every(key => typeof binding[key] === 'string' && SHA.test(binding[key])) && typeof binding.platform === 'string' && Object.hasOwn(CHANNELS, binding.platform) && CHANNELS[binding.platform].includes(binding.channel) && ['local', 'sandbox', 'staging'].includes(binding.environment);
}
const sameBinding = (a, b) => validBinding(a) && validBinding(b) && BINDING_KEYS.every(key => a[key] === b[key]);
const object = value => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try { const prototype = Object.getPrototypeOf(value), descriptors = Object.getOwnPropertyDescriptors(value);
    return (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(descriptors).every(key => typeof key === 'string' && descriptors[key].enumerable && Object.hasOwn(descriptors[key], 'value'));
  } catch { return false; }
};
const safeRelative = value => typeof value === 'string' && value.length > 0 && value.length < 1024 && !/[\\:\u0000-\u001f]/u.test(value) && !value.startsWith('/') && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.env'));

/** Evidence is local/operator supplied, not an attestation of human approval. */
export function evaluateReadiness({ binding, gates = [], checkedFiles = new Map(), now = Date.now() }) {
  const result = { schemaVersion: 1, generatedAt: new Date(now).toISOString(), binding, releaseReady: false, productionActionsAuthorized: false, gates: [], errors: [] };
  if (!validBinding(binding)) { result.errors.push('INVALID_BINDING'); return result; }
  if (!(checkedFiles instanceof Map)) { result.errors.push('INVALID_CHECKED_FILES'); checkedFiles = new Map(); }
  const required = requiredGates(binding.platform, binding.channel);
  const byId = new Map();
  if (!Array.isArray(gates)) result.errors.push('INVALID_GATE_LIST');
  for (const gate of Array.isArray(gates) ? gates : []) {
    if (!object(gate) || typeof gate.id !== 'string' || byId.has(gate.id)) { result.errors.push('INVALID_OR_DUPLICATE_GATE'); continue; }
    byId.set(gate.id, gate);
  }
  for (const id of required) {
    const original = byId.get(id);
    const entry = { id, mandatory: true, status: original?.status ?? 'NOT_RUN', reason: original?.reason ?? 'No evidence supplied.' };
    const fail = code => { entry.status = 'FAIL'; entry.reason = code; result.errors.push(`${id}:${code}`); };
    if (!STATUSES.has(entry.status) || typeof entry.reason !== 'string' || !entry.reason.trim()) fail('INVALID_STATUS_OR_REASON');
    if (entry.status === 'NOT_APPLICABLE') fail('MANDATORY_GATE_IS_APPLICABLE');
    if (entry.status === 'PASS') {
      if (!sameBinding(original.binding, binding)) fail('STALE_OR_WRONG_BINDING');
      else if (typeof original.finishedAt !== 'string' || !Number.isFinite(Date.parse(original.finishedAt)) || Date.parse(original.finishedAt) > now + 60_000) fail('INVALID_EXECUTION_TIME');
      else if (!Array.isArray(original.files) || original.files.length === 0 || original.files.length > 64 || Object.keys(original.files).length !== original.files.length || original.files.some(file => !object(file) || !safeRelative(file.path) || typeof file.sha256 !== 'string' || !SHA.test(file.sha256) || checkedFiles.get(file.path) !== file.sha256)) fail('MISSING_OR_CHANGED_EVIDENCE');
      else if (!object(original.facts) || original.facts.completed !== true) fail('MISSING_COMPLETION_FACTS');
      else if (id === 'local-tests' && (original.facts.exitCode !== 0 || !Number.isInteger(original.facts.passed) || original.facts.passed <= 0 || original.facts.failed !== 0 || original.facts.typescript !== true)) fail('TESTS_NOT_SUCCESSFUL');
      else if (id === 'content-preservation' && (original.facts.changedCount !== 0 || original.facts.missingCount !== 0)) fail('PROTECTED_CONTENT_CHANGED');
      else if (['installed-runtime','os-preferences','os-secret-storage','lifecycle-update'].includes(id) && (original.facts.installed !== true || original.facts.ownedTarget !== true || original.facts.artifactSha256 !== binding.artifactSha256 || !validCases(original.facts.cases))) fail('MISSING_EXACT_INSTALLED_RUNTIME');
      else if (id === 'installed-runtime' && !hasCases(original.facts,['first-launch','process-restart','background-foreground'])) fail('MISSING_INSTALLED_CASE');
      else if (id === 'os-preferences' && !hasCases(original.facts,OS_PREFERENCE_CASES)) fail('MISSING_PREFERENCE_CASE');
      else if (id === 'os-secret-storage' && !hasCases(original.facts,SECRET_STORAGE_CASES)) fail('MISSING_SECRET_STORAGE_CASE');
      else if (id === 'ru-en-runtime' && (!locales(original.facts.locales) || original.facts.actualBuild !== true || !hasCases(original.facts,['first-launch','locale','globe','country','writer','work','material','back','search','collection','auth-login','auth-registration','auth-confirmation','auth-recovery','account-deletion','payment','settings','offline','errors']))) fail('INCOMPLETE_BILINGUAL_PRODUCT_CASES');
      else if (id === 'lifecycle-update' && !hasCases(original.facts,['first-launch','process-restart','system-restart','background-foreground','update','reinstall'])) fail('MISSING_LIFECYCLE_CASE');
      else if (id === 'os-secret-storage' && original.facts.backend !== (binding.platform === 'android' ? 'android-keystore' : 'ios-keychain')) fail('NOT_OS_SECRET_STORAGE');
      else if (id === 'payment-sandbox' && (original.facts.environment !== 'sandbox' || original.facts.realProvider !== true || original.facts.testMode !== true || original.facts.accountBound !== true || !hasCases(original.facts,['purchase','refund','restore','reconcile']))) fail('FIXTURE_IS_NOT_REAL_SANDBOX');
      else if (id === 'remote-authorization' && (original.facts.separateOwnerAuthorization !== true || original.facts.exactEnvironment !== true || typeof original.facts.authorizationSha256 !== 'string' || !SHA.test(original.facts.authorizationSha256))) fail('NO_EXACT_REMOTE_AUTHORIZATION');
      else if (id === 'auth-deletion-remote' && (original.facts.realConfiguredService !== true || original.facts.twoOrdinaryUsers !== true || original.facts.revokedTokenDenied !== true)) fail('REMOTE_AUTH_NOT_CONFIRMED');
      else if (id === 'editorial-legal' && (original.facts.humanApproved !== true || original.facts.exactVersionHashes !== true || !locales(original.facts.locales))) fail('NO_EXACT_HUMAN_APPROVAL');
      else if (id === 'psp-commercial-decision' && original.facts.ownerSelected !== true) fail('CANDIDATE_IS_NOT_OWNER_SELECTION');
      else if (id === 'owner-signing' && (original.facts.ownerKey !== true || original.facts.compatibleUpdate !== true || original.facts.storeArtifact !== true)) fail('DEBUG_KEY_IS_NOT_STORE_SIGNING');
      else if (id === 'store-payment-contract' && (original.facts.approvedChannel !== binding.channel || original.facts.storeVerified !== true)) fail('WRONG_PAYMENT_CHANNEL');
    }
    if (entry.status !== 'PASS') result.errors.push(`${id}:${entry.status}`);
    result.gates.push({ ...entry, ...(original?.files ? { files: original.files } : {}) });
  }
  result.errors = [...new Set(result.errors)];
  result.releaseReady = result.errors.length === 0 && result.gates.every(gate => gate.status === 'PASS');
  return result;
}

export async function captureReleaseInputs(rootDir = process.cwd()) {
  const root = await fs.realpath(rootDir);
  const git = args => execFileSync('git', ['-c','core.autocrlf=false',...args], { cwd: root, encoding: 'utf8', maxBuffer: 16*1024*1024 }).trimEnd();
  const paths = git(['ls-files','-z','--cached','--others','--exclude-standard','--','src','server/planet','apps/mobile','scripts/mobile','supabase/migrations','package.json','package-lock.json','tsconfig.json','native.html','capacitor.config.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts']).split('\0').filter(Boolean).sort();
  const files = [];
  for (const relative of [...new Set(paths)]) { const filename = path.resolve(root, relative); if (!filename.startsWith(root+path.sep) || !(await fs.lstat(filename)).isFile() || (await fs.lstat(filename)).isSymbolicLink()) throw new Error('Unsafe source input'); files.push({ path: relative, sha256: sha256(await fs.readFile(filename)) }); }
  const toolVersions = { node: process.version };
  for (const name of ['typescript','vite','vitest','@capacitor/core','@capacitor/cli','@capacitor/android','@capacitor/ios','@supabase/supabase-js']) toolVersions[name] = JSON.parse(await fs.readFile(path.join(root,'node_modules',name,'package.json'),'utf8')).version;
  return { sourceCommit: git(['log','-1','--format=%H','--','src','server/planet','apps/mobile','scripts/mobile','supabase/migrations','package.json','package-lock.json','tsconfig.json','native.html','capacitor.config.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts']), repositoryHead: git(['rev-parse','HEAD']), sourceStatus: git(['status','--porcelain=v1','--untracked-files=all','--','src','server/planet','apps/mobile','scripts/mobile','supabase/migrations','package.json','package-lock.json','tsconfig.json','native.html','capacitor.config.json','vite.config.ts','vite.native.config.ts','vite.pwa.config.ts']), sourceFingerprint: sha256(JSON.stringify(files)), lockSha256: sha256(await fs.readFile(path.join(root,'package-lock.json'))), toolsFingerprint: sha256(JSON.stringify(toolVersions)), sourceFiles: files, toolVersions };
}
/** Same exact source roots and raw-hash format as the nonexecuting native/PWA
 * audits/builders. containedFile is their shared escape-safe byte reader. */
export async function preparedSourceInputs(rootDir, kind) {
  const root = await fs.realpath(rootDir), pwa = kind === 'literary-planet-controlled-pwa-preparation';
  if (!pwa && kind !== 'literary-planet-bundled-native-preparation') throw new Error('Unknown preparation');
  const roots = pwa ? ['src','index.html','vite.config.ts','vite.pwa.config.ts','tsconfig.json','package.json','package-lock.json',
    'scripts/mobile/build-pwa.mjs','scripts/mobile/pwa-artifact.mjs','scripts/mobile/pwa-shell.mjs','scripts/mobile/pwa-portrait-selection.mjs',PWA_PORTRAIT_SELECTION_PATH,CANONICAL_BOOK_SOURCE_REGISTRY]
    : ['src','native.html','vite.native.config.ts','vite.config.ts','tsconfig.json','package.json','package-lock.json','capacitor.config.json',
      'scripts/mobile/build-native.mjs','scripts/mobile/native-base-assets.json','scripts/mobile/pwa-artifact.mjs',CANONICAL_BOOK_SOURCE_REGISTRY];
  const names = execFileSync('git',['-c','safe.directory='+root,'ls-files','-z','--cached','--others','--exclude-standard','--',...roots],
    {cwd:root,encoding:'utf8',maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']}).split('\0');
  const paths = [...new Set([...names,...(pwa ? [CANONICAL_BOOK_SOURCE_REGISTRY] : [])])]
    .filter(name=>name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(name)).sort();
  if (!pwa && roots.some(name=>name!=='src' && !paths.includes(name))) throw new Error('Missing required native source');
  const files = [];
  for(const name of paths) { if(!safeRelative(name))throw new Error('Unsafe source path'); const file=await containedFile(root,name); files.push({path:name,sha256:file.sha256}); }
  return {sha256:sha256(JSON.stringify(files,null,2)+'\n'),files};
}
const sameInputs = (a,b) => object(a) && Object.keys(a).sort().join(',')==='files,sha256' && a.sha256===b.sha256
  && Array.isArray(a.files) && a.files.length===b.files.length && Object.keys(a.files).length===a.files.length
  && a.files.every((file,index)=>object(file) && Object.keys(file).sort().join(',')==='path,sha256'
    && file.path===b.files[index].path && file.sha256===b.files[index].sha256);
const sourceFailure = () => { const error=new Error('Artifact source inputs do not match current bytes');error.code='ARTIFACT_SOURCE_INPUTS_MISMATCH';return error; };

export async function checkReleaseEvidence(rootDir, input) {
  const root = await fs.realpath(rootDir), current = await captureReleaseInputs(root), checkedFiles = new Map();
  if (!object(input)) input = {};
  const gates = Array.isArray(input.gates) ? input.gates : [];
  for (const gate of gates) {
    if (!object(gate) || !Array.isArray(gate.files)) continue;
    for (const item of gate.files) {
      if (!object(item) || !safeRelative(item.path)) continue;
      const filename = path.resolve(root, item.path);
      try { const stat = await fs.lstat(filename); if (!filename.startsWith(root+path.sep) || !stat.isFile() || stat.isSymbolicLink() || stat.size > 32*1024*1024 || await fs.realpath(filename) !== filename) continue; checkedFiles.set(item.path, sha256(await fs.readFile(filename))); } catch { /* missing proof stays NOT_RUN/FAIL */ }
    }
  }
  const binding = { ...(object(input.binding) ? input.binding : {}), ...Object.fromEntries(['sourceFingerprint','lockSha256','toolsFingerprint'].map(key => [key,current[key]])) };
  const result = evaluateReadiness({ binding, gates: input.gates, checkedFiles });
  result.currentInputs = current;
  // The artifact's exact build commit may precede operator-only or report
  // commits. Its complete raw preparation/binary manifests must still match
  // current files below, while all current tools/source fingerprints are bound.
  try { if(!COMMIT.test(binding.sourceCommit))throw new Error();execFileSync('git',['merge-base','--is-ancestor',binding.sourceCommit,current.repositoryHead],{cwd:root,stdio:['ignore','pipe','pipe']});result.artifactSourceCommit=binding.sourceCommit; }
  catch { result.errors.push('ARTIFACT_SOURCE_COMMIT_NOT_IN_CURRENT_HISTORY');result.releaseReady=false; }

  if (!sameBinding(input.binding, binding)) { result.errors.push('MANIFEST_INPUTS_CHANGED'); result.releaseReady = false; }
  let meta;
  if (!safeRelative(input.artifactMetadataPath)) { result.errors.push('ARTIFACT_METADATA_MISSING'); result.releaseReady=false; }
  else try {
    const file=path.resolve(root,input.artifactMetadataPath),stat=await fs.lstat(file);
    if(!file.startsWith(root+path.sep)||!stat.isFile()||stat.isSymbolicLink()||stat.size>16*1024*1024||await fs.realpath(file)!==file)throw new Error();
    meta=JSON.parse(await fs.readFile(file,'utf8'));
    const allowed=['literary-planet-native-binary-preparation','literary-planet-bundled-native-preparation','literary-planet-controlled-pwa-preparation'];
    if(!object(meta)||!allowed.includes(meta.kind)||meta.sourceCommit!==binding.sourceCommit||meta.releaseReady!==false)throw new Error();
    if(binding.platform==='pwa' ? meta.kind!=='literary-planet-controlled-pwa-preparation'||binding.channel!=='web-direct' : meta.platform!==binding.platform||meta.channel!==binding.channel)throw new Error();
    if(meta.kind==='literary-planet-native-binary-preparation') {
      validateRuntimeReceipt(meta,binding.platform);
      if(meta.artifactPath!==input.artifactPath||meta.artifactSha256!==binding.artifactSha256)throw new Error();
      if(!sameInputs(meta.sourceInputs,await nativeRuntimeSources(root)))throw sourceFailure();
      if(binding.platform==='android') { const test=await containedFile(root,meta.testArtifactPath);if(test.sha256!==meta.testArtifactSha256)throw new Error(); }
      else { const run=await containedFile(root,meta.xctestrunPath);if(run.sha256!==meta.xctestrunSha256)throw new Error(); }
      const web=await containedFile(root,meta.webArtifactPath??'dist-native/artifact.json');if(web.sha256!==meta.webArtifactSha256)throw new Error();
      const prepared=JSON.parse(web.bytes.toString('utf8'));
      if(prepared.kind!=='literary-planet-bundled-native-preparation'||prepared.platform!==binding.platform||prepared.channel!==binding.channel||prepared.sourceCommit!==binding.sourceCommit||prepared.releaseReady!==false)throw new Error();
      if(!sameInputs(prepared.sourceInputs,await preparedSourceInputs(root,prepared.kind)))throw sourceFailure();
    } else if(!sameInputs(meta.sourceInputs,await preparedSourceInputs(root,meta.kind)))throw sourceFailure();
    if(binding.platform!=='pwa'&&result.gates.some(gate=>gate.id==='native-binary'&&gate.status==='PASS')&&meta.kind!=='literary-planet-native-binary-preparation')throw new Error();
  } catch(error) { result.errors.push(error.code==='ARTIFACT_SOURCE_INPUTS_MISMATCH'?error.code:'ARTIFACT_METADATA_IDENTITY_MISMATCH');result.releaseReady=false; }
  if (!safeRelative(input.artifactPath)) { result.errors.push('ARTIFACT_PATH_MISSING'); result.releaseReady = false; }
  else try {
    const file=path.resolve(root,input.artifactPath),stat=await fs.lstat(file);
    if(!file.startsWith(root+path.sep)||stat.isSymbolicLink()||await fs.realpath(file)!==file)throw new Error();
    const simulator=binding.platform==='ios'&&binding.channel==='dev'&&meta?.kind==='literary-planet-native-binary-preparation'&&input.artifactPath.endsWith('.app');
    const digest=simulator&&stat.isDirectory()?await simulatorAppDigest(file):stat.isFile()&&stat.size<=512*1024*1024?sha256(await fs.readFile(file)):null;
    if(digest!==binding.artifactSha256)throw new Error();
  } catch { result.errors.push('ARTIFACT_MISSING_OR_DIGEST_MISMATCH'); result.releaseReady=false; }
  return result;
}
if (isLocalCliEntry(import.meta.url)) {
  const args = process.argv.slice(2); let report;
  try {
    if (args.length !== 4 || args[0] !== '--evidence' || args[2] !== '--report') throw new Error('Use --evidence <local-json> --report <new-local-json>');
    if (!safeRelative(args[1]) || !safeRelative(args[3])) throw new Error('Contained relative paths required');
    report = await checkReleaseEvidence(process.cwd(), JSON.parse(await fs.readFile(args[1],'utf8')));
    await fs.writeFile(args[3], JSON.stringify(report,null,2)+'\n', { flag: 'wx' });
    console.log(JSON.stringify({ report: args[3], releaseReady: report.releaseReady, gates: report.gates.map(({id,status})=>({id,status})), errors: report.errors }));
    process.exitCode = report.releaseReady ? 0 : 2;
  } catch (error) { console.error(JSON.stringify({ releaseReady:false, error: error.message, partial: report ? {errors:report.errors,gates:report.gates} : null })); process.exitCode = 2; }
}
