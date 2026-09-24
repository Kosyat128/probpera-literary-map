import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateRawSync, crc32 } from 'node:zlib';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--expected-build-id' || !/^[a-f0-9]{64}$/u.test(args[1])) {
  throw new Error('Usage: node verify-android-a1.mjs --expected-build-id <64 lowercase hex>');
}
const expectedBuildId = args[1];
if (process.cwd().replaceAll('\\', '/') !== 'C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work') throw new Error('Unexpected checkout');
const apkPath='apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk';
const sourceDirectory='dist-native';
const reportDirectory='docs/mobile/evidence/S15/booky-landscape-space-20260924/android-a1';
const rawReportDirectory='D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94/s15-booky-landscape-space-evidence/android-a1-raw';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const apk=await fs.readFile(apkPath), findings=[];
const add=(code,file,message)=>findings.push({code,path:file,message});
const files=new Map(),zipRecords=[],foldedNames=new Set();
let eocd=-1;
for(let i=apk.length-22;i>=Math.max(0,apk.length-65557);i--) if(apk.readUInt32LE(i)===0x06054b50 && i+22+apk.readUInt16LE(i+20)===apk.length){eocd=i;break;}
if(eocd<0)throw new Error('Missing standard ZIP end record');
const count=apk.readUInt16LE(eocd+10),centralSize=apk.readUInt32LE(eocd+12),centralOffset=apk.readUInt32LE(eocd+16);
if(apk.readUInt16LE(eocd+4)!==0||apk.readUInt16LE(eocd+6)!==0||count!==apk.readUInt16LE(eocd+8)||count===65535||count>10000||centralOffset+centralSize!==eocd)throw new Error('Unsupported multi-volume, ZIP64 or malformed central directory');
let offset=centralOffset,expanded=0;
for(let i=0;i<count;i++){
  if(apk.readUInt32LE(offset)!==0x02014b50)throw new Error('Invalid ZIP central record');
  const flags=apk.readUInt16LE(offset+8),method=apk.readUInt16LE(offset+10),crc=apk.readUInt32LE(offset+16),compressed=apk.readUInt32LE(offset+20),size=apk.readUInt32LE(offset+24),nameLength=apk.readUInt16LE(offset+28),extraLength=apk.readUInt16LE(offset+30),commentLength=apk.readUInt16LE(offset+32),attributes=apk.readUInt32LE(offset+38),local=apk.readUInt32LE(offset+42);
  const rawName=apk.subarray(offset+46,offset+46+nameLength),name=new TextDecoder('utf-8',{fatal:true}).decode(rawName);
  if(!name||/[\\%:\u0000-\u0020\u007f]/u.test(name)||name.startsWith('/')||name.split('/').some((part,index,list)=>part==='.'||part==='..'||(!part&&index!==list.length-1)))add('UNSAFE_ZIP_PATH',name,'Unsafe archive path');
  if(foldedNames.has(name.toLowerCase()))add('DUPLICATE_ZIP_PATH',name,'Duplicate or case-colliding archive path');
  foldedNames.add(name.toLowerCase());
  if((attributes>>>16&0xf000)===0xa000)add('ZIP_SYMLINK',name,'Symbolic links cannot enter this APK');
  if(flags&1||![0,8].includes(method)||size>128*1024*1024)throw new Error('Unsupported encrypted/compressed/oversized ZIP entry');
  expanded+=size;if(expanded>512*1024*1024)throw new Error('Expanded APK budget exceeded');
  if(apk.readUInt32LE(local)!==0x04034b50)throw new Error('Invalid local ZIP header');
  const localFlags=apk.readUInt16LE(local+6),localMethod=apk.readUInt16LE(local+8),localNameLength=apk.readUInt16LE(local+26),localExtraLength=apk.readUInt16LE(local+28);
  if(localFlags!==flags||localMethod!==method||!apk.subarray(local+30,local+30+localNameLength).equals(rawName))add('ZIP_HEADER_MISMATCH',name,'Local and central ZIP identity differ');
  const dataOffset=local+30+localNameLength+localExtraLength;
  if(dataOffset+compressed>centralOffset)throw new Error('ZIP payload crosses central directory');
  const payload=apk.subarray(dataOffset,dataOffset+compressed),bytes=method===0?payload:inflateRawSync(payload,{maxOutputLength:Math.max(1,size)});
  if(bytes.length!==size||crc32(bytes)!==crc)add('ZIP_CRC',name,'Expanded size or CRC32 differs');
  if(!name.endsWith('/'))files.set(name,bytes);
  zipRecords.push({path:name,bytes:size,compressedBytes:compressed,method,crc32:crc.toString(16).padStart(8,'0'),sha256:sha(bytes)});
  offset+=46+nameLength+extraLength+commentLength;
}
if(offset!==eocd)throw new Error('Central directory byte count mismatch');
const artifactBytes=await fs.readFile(path.join(sourceDirectory,'artifact.json')),artifact=JSON.parse(artifactBytes);
if(artifact.buildId!==expectedBuildId||artifact.platform!=='android'||artifact.channel!=='dev')throw new Error('Wrong archived Android reference');
const permittedOmissions=new Set(['.vite/manifest.json']),publicPrefix='assets/public/';
const expected=new Map(artifact.inventory.map(record=>[record.path,record]));
expected.set('artifact.json',{path:'artifact.json',bytes:artifactBytes.length,sha256:sha(artifactBytes)});
let matched=0;const omitted=[],extra=[];
for(const [relative,record]of expected){
  const source=await fs.readFile(path.join(sourceDirectory,relative));
  if(source.length!==record.bytes||sha(source)!==record.sha256)add('REFERENCE_CORRUPTION',relative,'Archived Android reference differs from inventory');
  const bytes=files.get(publicPrefix+relative);
  if(!bytes){if(permittedOmissions.has(relative))omitted.push(relative);else add('APK_MISSING_ASSET',relative,'Verified runtime asset is absent from APK');}
  else if(bytes.length!==record.bytes||sha(bytes)!==record.sha256)add('APK_ASSET_INTEGRITY',relative,'APK bytes differ from verified Android artifact');
  else matched++;
}
for(const [filename,bytes]of files)if(filename.startsWith(publicPrefix)&&!expected.has(filename.slice(publicPrefix.length))){
  const relative=filename.slice(publicPrefix.length);extra.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});
  if(!['cordova.js','cordova_plugins.js'].includes(relative)||bytes.length!==0)add('APK_EXTRA_RUNTIME',relative,'Unexpected extra runtime executable/asset');
}
const configBytes=files.get('assets/capacitor.config.json'),pluginsBytes=files.get('assets/capacitor.plugins.json');
const config=JSON.parse(configBytes),plugins=JSON.parse(pluginsBytes),currentConfig=JSON.parse(await fs.readFile('capacitor.config.json','utf8'));
if(JSON.stringify(config)!==JSON.stringify(currentConfig)||sha(await fs.readFile('capacitor.config.json'))!==artifact.sourceInputs.files.find(record=>record.path==='capacitor.config.json')?.sha256)add('APK_CONFIG','assets/capacitor.config.json','Compiled wrapper configuration differs from artifact source');
const expectedPlugins={
 '@capacitor/app':'com.capacitorjs.plugins.app.AppPlugin',
 '@capacitor/app-launcher':'com.capacitorjs.plugins.applauncher.AppLauncherPlugin',
 '@capacitor/browser':'com.capacitorjs.plugins.browser.BrowserPlugin',
 '@capacitor/network':'com.capacitorjs.plugins.network.NetworkPlugin',
 '@capacitor/preferences':'com.capacitorjs.plugins.preferences.PreferencesPlugin',
};
if(plugins.length!==5||new Set(plugins.map(p=>p.pkg)).size!==5||plugins.some(p=>expectedPlugins[p.pkg]!==p.classpath))add('APK_PLUGIN_REGISTRY','assets/capacitor.plugins.json','Unexpected additional native plugin registry');
const nativeBridgeSource='node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js';
const nativeBridgeIntake='.tmp/native-bootstrap/capacitor-packages/android-8.5.1/extracted/package/capacitor/src/main/assets/native-bridge.js';
const nativeBridge=files.get('assets/native-bridge.js'),nativeBridgeInstalled=await fs.readFile(nativeBridgeSource),nativeBridgeArchived=await fs.readFile(nativeBridgeIntake);
if(!nativeBridge||!nativeBridge.equals(nativeBridgeInstalled)||!nativeBridge.equals(nativeBridgeArchived))add('APK_CORE_BRIDGE','assets/native-bridge.js','Core bridge must exactly match the installed and previously verified official Capacitor8.5.1 package');
for(const name of files.keys())if(name.startsWith('assets/')&&!name.startsWith(publicPrefix)&&!['assets/capacitor.config.json','assets/capacitor.plugins.json','assets/native-bridge.js'].includes(name))add('APK_EXTRA_ASSET',name,'Unreviewed wrapper asset');

const classDefinitions=new Map(),dexFiles=[];
for(const [filename,bytes]of files)if(/^classes(?:[2-9]|[1-9]\d+)?.dex$/u.test(filename)){
  if(!/^dex\n0(?:35|37|38|39|40|41)\u0000$/u.test(bytes.subarray(0,8).toString('ascii'))||bytes.readUInt32LE(32)!==bytes.length||bytes.readUInt32LE(40)!==0x12345678)throw new Error('Unsupported or invalid DEX header');
  const stringCount=bytes.readUInt32LE(56),stringOffset=bytes.readUInt32LE(60),typeCount=bytes.readUInt32LE(64),typeOffset=bytes.readUInt32LE(68),classCount=bytes.readUInt32LE(96),classOffset=bytes.readUInt32LE(100);
  if(stringOffset+stringCount*4>bytes.length||typeOffset+typeCount*4>bytes.length||classOffset+classCount*32>bytes.length)throw new Error('DEX table range invalid');
  for(let i=0;i<classCount;i++){
    const type=bytes.readUInt32LE(classOffset+i*32);if(type>=typeCount)throw new Error('Invalid class type');
    const string=bytes.readUInt32LE(typeOffset+type*4);if(string>=stringCount)throw new Error('Invalid class descriptor');
    let start=bytes.readUInt32LE(stringOffset+string*4),prefix=0;while(bytes[start++]&0x80)if(++prefix>4)throw new Error('Invalid DEX ULEB128');
    const end=bytes.indexOf(0,start);if(end<start)throw new Error('Invalid DEX string');
    const descriptor=bytes.subarray(start,end).toString('utf8');
    if(classDefinitions.has(descriptor))add('DUPLICATE_DEX_CLASS',filename,'Duplicate class definition '+descriptor);
    classDefinitions.set(descriptor,filename);
  }
  dexFiles.push({path:filename,bytes:bytes.length,sha256:sha(bytes),classDefinitions:classCount});
}
const pluginClasses=plugins.map(plugin=>{const descriptor='L'+plugin.classpath.replaceAll('.','/')+';',dex=classDefinitions.get(descriptor)??null;if(!dex)add('MISSING_PLUGIN_CLASS',plugin.classpath,'Plugin is listed but has no actual DEX class definition');return {...plugin,descriptor,dex};});
for(const name of ['Lru/probpera/literaryplanet/MainActivity;','Lcom/getcapacitor/BridgeActivity;','Lru/probpera/literaryplanet/PlanetContentStorePlugin;','Landroidx/core/util/AtomicFile;'])if(!classDefinitions.has(name))add('MISSING_HOST_CLASS',name,'Canonical native host class definition absent');

const badging=await fs.readFile(path.join(rawReportDirectory,'android-dev-apk-aapt2-badging.txt'),'utf8'),manifest=await fs.readFile(path.join(rawReportDirectory,'android-dev-apk-manifest.txt'),'utf8'),locales=await fs.readFile(path.join(rawReportDirectory,'android-dev-apk-locales.txt'),'utf8'),signature=await fs.readFile(path.join(rawReportDirectory,'android-dev-apk-signature.txt'),'utf8'),alignment=await fs.readFile(path.join(rawReportDirectory,'android-dev-apk-zipalign.txt'),'utf8');
const checks={package:badging.includes("name='ru.probpera.literaryplanet.dev'"),minSdk24:badging.includes("minSdkVersion:'24'"),targetSdk36:badging.includes("targetSdkVersion:'36'"),englishLabel:badging.includes("application-label:'Literary Planet'"),russianLabel:badging.includes("application-label-ru:'Литературная планета'"),debuggable:manifest.includes('debuggable(0x0101000f)=true'),backupDisabled:manifest.includes('allowBackup(0x01010280)=false'),cleartextDisabled:manifest.includes('usesCleartextTraffic(0x010104ec)=false'),exactSelectableLocales:JSON.stringify([...locales.matchAll(/name\(0x01010003\)="([^"]+)"/gu)].map(match=>match[1]))===JSON.stringify(['en','ru']),signatureVerified:/^Verifies\r?$/mu.test(signature)&&signature.includes('Verified using v2 scheme (APK Signature Scheme v2): true'),debugCertificate:signature.includes('Signer #1 certificate DN: CN=Android Debug, O=Android, C=US'),alignmentVerified:alignment.includes('Verification successful')};
for(const[key,pass]of Object.entries(checks))if(!pass)add('COMPILED_BINARY_CHECK',key,'Required compiled metadata/tool verification failed');
const rawReports=['android-dev-apk-aapt2-badging.txt','android-dev-apk-manifest.txt','android-dev-apk-locales.txt','android-dev-apk-signature.txt','android-dev-apk-zipalign.txt'];
const report={pass:findings.length===0,scope:'Read-only inspection of the actual locally built Android devDebug APK',checkedAt:new Date().toISOString(),apk:{path:apkPath,bytes:apk.length,sha256:sha(apk)},sourceArtifact:{path:sourceDirectory,buildId:artifact.buildId,sourceCommit:artifact.sourceCommit,sha256:sha(artifactBytes)},zip:{entries:count,expandedBytes:expanded,pathsAndCrcChecked:true},bundledAssets:{expected:expected.size,matched,omittedValidationMetadata:omitted,permittedEmptyCordovaExtras:extra,configSha256:sha(configBytes),pluginRegistrySha256:sha(pluginsBytes)},dex:{files:dexFiles,classDefinitions:classDefinitions.size,requiredPluginClasses:pluginClasses},compiledChecks:checks,signing:{certificateSha256:signature.match(/certificate SHA-256 digest: ([a-f0-9]+)/u)?.[1]??null,kind:'Android Debug',productionSigning:false},tools:{buildTools:'36.0.0',java:'workspace JDK21.0.12.1+1',zipAlignment:'zipalign -c -P 16 -v 4; no native shared libraries does not constitute a native ABI compatibility test'},rawReports:await Promise.all(rawReports.map(async file=>({path:rawReportDirectory+'/'+file,sha256:sha(await fs.readFile(path.join(rawReportDirectory,file)))}))),findings,releaseReady:false,limitations:['No adb, installation, emulator or physical-device runtime was used.','This devDebug APK and local debug certificate are not a production/store package or an owner release approval.','Byte equality binds the archived audited Android bundle to APK assets. Source-to-binary reproducibility, native runtime/language-state behavior and later stage acceptance remain separate gates.','Library resource translations reported by aapt2 are not claims of additional supported app locales; compiled selectable locales are exactly en and ru.']};
report.dex.localContentStore={descriptor:'Lru/probpera/literaryplanet/PlanetContentStorePlugin;',dex:classDefinitions.get('Lru/probpera/literaryplanet/PlanetContentStorePlugin;'),registration:'MainActivity registers before BridgeActivity.onCreate',installedExecutionVerified:false};
report.bundledAssets.capacitorCoreBridge={apkPath:'assets/native-bridge.js',source:nativeBridgeSource,verifiedPackageIntake:nativeBridgeIntake,bytes:nativeBridge?.length??null,sha256:nativeBridge?sha(nativeBridge):null};
report.tools.nativeSharedLibraryCount=[...files.keys()].filter(name=>name.startsWith('lib/')&&name.endsWith('.so')).length;
const zipLedgerPath=path.join(rawReportDirectory,'android-dev-apk-zip-entries.json'),zipLedgerBytes=JSON.stringify(zipRecords,null,2)+'\n';
await fs.writeFile(zipLedgerPath,zipLedgerBytes,{flag:'wx'});
report.zip.ledger={path:zipLedgerPath,sha256:sha(zipLedgerBytes),entries:zipRecords.length};
await fs.writeFile(path.join(reportDirectory,'android-dev-apk-verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify(report,null,2)+'\n');if(!report.pass)process.exitCode=1;
