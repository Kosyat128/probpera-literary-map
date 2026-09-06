import {readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync, lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateRawSync, gunzipSync} from 'node:zlib';
import path from 'node:path';
const ROOT=realpathSync(process.cwd());
const OUT=path.join(ROOT,'.tmp/native-bootstrap/ios-binary-review');
const ARCHIVE=path.join(ROOT,'.tmp/native-bootstrap/ios-publication/success-run-artifacts.zip');
const EXPECTED={bytes:61574249,sha256:'696056655385e0fcc31df1e8068439ecc42691a9b24f49723821d10cd3a49416',source:'273f400d8f07a57269f391dfc13d7e802c9071f2'};
const check=(x,m)=>{if(!x)throw new Error(m);};
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const safeName=(name)=>{
 check(typeof name==='string'&&name.length>0&&name.length<1024&&!/^[\\/]/u.test(name)&&!/[\\:\x00-\x1f\x7f]/u.test(name),'Unsafe archive path');
 const p=name.replace(/\/$/u,'').split('/');
 check(p.every(x=>x&&x!=='.'&&x!=='..'&&!/[. ]$/u.test(x)&&!/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(x)),'Unsafe archive component');
 return name;
};
const save=(name,bytes)=>{
 safeName(name);const dest=path.resolve(OUT,name);
 check(dest.startsWith(OUT+path.sep),'Extraction escaped review root');
 mkdirSync(path.dirname(dest),{recursive:true});
 check(realpathSync(path.dirname(dest))===path.dirname(dest),'Linked extraction ancestor');
 if(existsSync(dest)){check(lstatSync(dest).isFile()&&!lstatSync(dest).isSymbolicLink()&&sha(readFileSync(dest))===sha(bytes),'Refuse changed existing review file');return;}
 writeFileSync(dest,bytes,{flag:'wx'});
};
const CRC=Array.from({length:256},(_,v)=>{for(let j=0;j<8;j++)v=(v>>>1)^((v&1)?0xedb88320:0);return v>>>0;});
const crc32=b=>{let c=0xffffffff;for(const v of b)c=CRC[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
function zip(buf,label){
 check(buf.length>=22&&buf.length<128*1024*1024,label+': archive size');
 let end=-1;for(let p=buf.length-22;p>=Math.max(0,buf.length-65557);p--)if(buf.readUInt32LE(p)===0x06054b50&&p+22+buf.readUInt16LE(p+20)===buf.length){end=p;break;}
 check(end>=0,label+': EOCD');
 check(buf.readUInt16LE(end+4)===0&&buf.readUInt16LE(end+6)===0,label+': multi-disk unsupported');
 const count=buf.readUInt16LE(end+10),size=buf.readUInt32LE(end+12),start=buf.readUInt32LE(end+16);
 check(count>0&&count<10000&&count===buf.readUInt16LE(end+8)&&start+size===end,label+': directory bounds/ZIP64 unsupported');
 const entries=new Map(),seen=new Set(),ranges=[];let at=start,total=0;
 for(let i=0;i<count;i++){
  check(at+46<=end&&buf.readUInt32LE(at)===0x02014b50,label+': central header');
  const flags=buf.readUInt16LE(at+8),method=buf.readUInt16LE(at+10),crc=buf.readUInt32LE(at+16),csize=buf.readUInt32LE(at+20),usize=buf.readUInt32LE(at+24),nlen=buf.readUInt16LE(at+28),xlen=buf.readUInt16LE(at+30),clen=buf.readUInt16LE(at+32),ext=buf.readUInt32LE(at+38),local=buf.readUInt32LE(at+42);
  check(at+46+nlen+xlen+clen<=end&&!(flags&1)&&[0,8].includes(method)&&usize<=96*1024*1024,label+': bounded supported entry');
  const rawName=buf.subarray(at+46,at+46+nlen),name=safeName(new TextDecoder('utf-8',{fatal:true}).decode(rawName));
  const collision=name.normalize('NFC').toLowerCase();check(!seen.has(collision),label+': duplicate/case-colliding name');seen.add(collision);
  const mode=(ext>>>16)&0xffff,kind=mode&0xf000;
  check(kind===0||kind===0x8000||kind===0x4000,label+': link/special entry forbidden');
  check(local+30<=start&&buf.readUInt32LE(local)===0x04034b50,label+': local header');
  const ln=buf.readUInt16LE(local+26),lx=buf.readUInt16LE(local+28),payload=local+30+ln+lx;
  check(buf.readUInt16LE(local+6)===flags&&buf.readUInt16LE(local+8)===method&&buf.subarray(local+30,local+30+ln).equals(rawName)&&payload+csize<=start,label+': local/central mismatch');
  ranges.push([local,payload+csize]);
  const compressed=buf.subarray(payload,payload+csize),data=method===0?compressed:inflateRawSync(compressed,{maxOutputLength:96*1024*1024});
  check(data.length===usize&&crc32(data)===crc,label+': length/CRC mismatch');
  total+=usize;check(total<=512*1024*1024,label+': inflated total limit');
  const directory=name.endsWith('/');check(!directory||usize===0,label+': directory payload');
  entries.set(name,{name,directory,mode:mode.toString(8),bytes:usize,sha256:sha(data),data});
  at+=46+nlen+xlen+clen;
 }
 check(at===end,label+': directory size mismatch');ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)check(ranges[i][0]>=ranges[i-1][1],label+': overlapping payload');
 return {entries,total};
}
const oct=b=>{const t=b.toString('ascii').replace(/\0.*$/su,'').trim();check(/^[0-7]*$/u.test(t),'Unsupported tar integer');return t?Number.parseInt(t,8):0;};
function tar(gz){
 const buf=gunzipSync(gz,{maxOutputLength:512*1024*1024}),entries=new Map(),seen=new Set(),metadata=[];let at=0,pax=null,total=0,terminator=false;
 const str=b=>new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,b.indexOf(0)<0?b.length:b.indexOf(0)));
 while(at+512<=buf.length){
  const h=buf.subarray(at,at+512);if(h.every(x=>x===0)){check(buf.subarray(at).every(x=>x===0),'Nonzero tar trailer');terminator=true;break;}
  const expected=oct(h.subarray(148,156));let checksum=0;for(let j=0;j<512;j++)checksum+=(j>=148&&j<156)?32:h[j];check(checksum===expected,'Tar header checksum');
  const length=oct(h.subarray(124,136)),type=String.fromCharCode(h[156]||48),mode=oct(h.subarray(100,108));
  check(length<=96*1024*1024&&at+512+length<=buf.length,'Tar payload bound');
  const data=buf.subarray(at+512,at+512+length);let name=str(h.subarray(0,100));const prefix=str(h.subarray(345,500));if(prefix)name=prefix+'/'+name;
  at+=512+Math.ceil(length/512)*512;
  if(type==='x'){
   check(!pax,'Consecutive unconsumed PAX headers');pax={};let p=0;
   while(p<data.length){const sep=data.indexOf(32,p);check(sep>p&&sep-p<12,'PAX length');const n=Number(data.subarray(p,sep).toString('ascii'));check(Number.isSafeInteger(n)&&n>sep-p+2&&p+n<=data.length&&data[p+n-1]===10,'PAX bounds');const value=data.subarray(sep+1,p+n-1),eq=value.indexOf(61);check(eq>0,'PAX pair');const key=value.subarray(0,eq).toString('utf8');check(!Object.hasOwn(pax,key),'Duplicate PAX key');pax[key]=value.subarray(eq+1).toString('utf8');p+=n;}
   metadata.push({header:name,keys:Object.keys(pax),bytes:length});continue;
  }
  check(['0','5'].includes(type),'Unsupported tar special/link type '+type);
  if(pax?.path)name=pax.path;check(!pax?.linkpath,'PAX link unsupported');if(pax?.size)check(Number(pax.size)===length,'PAX size mismatch');pax=null;
  safeName(name);const collision=name.normalize('NFC').toLowerCase();check(!seen.has(collision),'Tar duplicate/case collision');seen.add(collision);
  const directory=type==='5';check(!directory||length===0,'Tar directory payload');total+=length;check(total<=512*1024*1024,'Tar total bound');
  entries.set(name,{name,directory,mode:mode.toString(8),bytes:length,sha256:sha(data),data});
 }
 check(terminator&&!pax,'Tar missing complete trailer');return {entries,total,paxMetadata:metadata};
}
function plist(buf){
 check(buf.subarray(0,8).toString()==='bplist00','Expected actual binary plist');check(buf.length>=40,'Plist trailer');
 const end=buf.length-32,os=buf[end+6],rs=buf[end+7];
 const uint=(at,n)=>{check([1,2,4,8].includes(n)&&at>=0&&at+n<=buf.length,'Plist integer bounds');let v=0n;for(let i=0;i<n;i++)v=(v<<8n)|BigInt(buf[at+i]);check(v<=BigInt(Number.MAX_SAFE_INTEGER),'Plist oversized integer');return Number(v);};
 const count=uint(end+8,8),top=uint(end+16,8),table=uint(end+24,8);check(count<100000&&top<count&&table>=8&&table+count*os===end&&[1,2,4,8].includes(rs),'Plist trailer values');
 const offsets=Array.from({length:count},(_,i)=>uint(table+i*os,os));check(offsets.every(x=>x>=8&&x<table),'Plist offsets');const visiting=new Set(),cache=new Map();
 function value(ref,depth=0){check(ref<count&&depth<32&&!visiting.has(ref),'Plist recursive reference');if(cache.has(ref))return cache.get(ref);visiting.add(ref);let at=offsets[ref],tag=buf[at++],kind=tag>>4,n=tag&15;
  if([4,5,6,10,13].includes(kind)&&n===15){const t=buf[at++];check(t>>4===1&&(t&15)<=3,'Plist length marker');const bytes=2**(t&15);n=uint(at,bytes);at+=bytes;}
  check(n<=1000000,'Plist count bound');let result;
  if(kind===0){check([0,8,9].includes(n),'Plist simple marker');result=n===0?null:n===9;}
  else if(kind===1){const bytes=2**n;result=uint(at,bytes);}
  else if(kind===2){check([2,3].includes(n),'Plist real width');result=n===2?buf.readFloatBE(at):buf.readDoubleBE(at);}
  else if(kind===4){check(at+n<=table,'Plist data bound');result={base64:buf.subarray(at,at+n).toString('base64')};}
  else if(kind===5||kind===6){const bytes=n*(kind===6?2:1);check(at+bytes<=table,'Plist string bound');result=kind===5?buf.subarray(at,at+bytes).toString('ascii'):new TextDecoder('utf-16be',{fatal:true}).decode(buf.subarray(at,at+bytes));}
  else if(kind===10||kind===13){check(at+n*rs*(kind===13?2:1)<=table,'Plist refs bound');const refs=Array.from({length:n},(_,i)=>uint(at+i*rs,rs));
   if(kind===10)result=refs.map(x=>value(x,depth+1));else{result=Object.create(null);for(let i=0;i<n;i++){const k=value(refs[i],depth+1);check(typeof k==='string'&&!Object.hasOwn(result,k),'Plist duplicate/non-string key');result[k]=value(uint(at+(i+n)*rs,rs),depth+1);}}
  }else throw new Error('Unsupported plist marker '+kind);
  visiting.delete(ref);cache.set(ref,result);return result;
 }return value(top);
}
const version=v=>`${v>>>16}.${(v>>>8)&255}.${v&255}`;
function macho(buf,name){
 if(buf.length<4)return null;const magic=buf.readUInt32LE(0);
 if(magic===0xbebafeca){
  check(buf.length>=8,'Fat Mach-O header');const count=buf.readUInt32BE(4);check(count>0&&count<=8&&8+count*20<=buf.length,'Fat Mach-O slices');
  const slices=[],ranges=[];const seen=new Set();
  for(let i=0;i<count;i++){const at=8+i*20,cpu=buf.readUInt32BE(at),subtype=buf.readUInt32BE(at+4),offset=buf.readUInt32BE(at+8),bytes=buf.readUInt32BE(at+12),alignment=buf.readUInt32BE(at+16);
   check(!seen.has(cpu)&&offset>=8+count*20&&bytes>=32&&offset+bytes<=buf.length&&alignment<=24&&offset%(2**alignment)===0,'Fat slice bounds/alignment/duplicate');seen.add(cpu);ranges.push([offset,offset+bytes]);
   const slice=macho(buf.subarray(offset,offset+bytes),name+'#slice'+i);check(slice&&slice.cpuType===cpu&&slice.cpuSubtype===subtype&&!slice.slices,'Fat/thin CPU mismatch');slices.push({...slice,offset});
  }
  ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)check(ranges[i][0]>=ranges[i-1][1],'Overlapping fat slices');check(slices.every(x=>x.fileType===slices[0].fileType),'Fat file type mismatch');
  return {path:name,bytes:buf.length,sha256:sha(buf),format:'FAT_MAGIC',architecture:slices.map(x=>x.architecture),fileType:slices[0].fileType,builds:slices.flatMap(x=>x.builds),slices};
 }
 if(magic!==0xfeedfacf){check(![0xcefaedfe,0xcffaedfe,0xfeedface,0xbebafeca,0xcafebabe,0xbfbafeca].includes(magic),'Unsupported Mach-O variant '+name);return null;}
 check(buf.length>=32,'Mach-O header');const cpu=buf.readUInt32LE(4),subtype=buf.readUInt32LE(8),filetype=buf.readUInt32LE(12),ncmds=buf.readUInt32LE(16),size=buf.readUInt32LE(20);check([0x0100000c,0x01000007].includes(cpu)&&ncmds<=4096&&32+size<=buf.length,'Mach-O ARM64/x86_64/header bounds');
 const builds=[],codesign=[];let at=32;
 for(let i=0;i<ncmds;i++){check(at+8<=32+size,'Mach-O command header');const cmd=buf.readUInt32LE(at),length=buf.readUInt32LE(at+4);check(length>=8&&length%8===0&&at+length<=32+size,'Mach-O command bounds');
  if(cmd===0x32){check(length>=24,'LC_BUILD_VERSION bounds');const platform=buf.readUInt32LE(at+8),minos=buf.readUInt32LE(at+12),sdk=buf.readUInt32LE(at+16),ntools=buf.readUInt32LE(at+20);check(24+ntools*8<=length,'Mach-O build tools');builds.push({platform,platformName:platform===7?'IOSSIMULATOR':'OTHER',minOS:version(minos),sdk:version(sdk),tools:Array.from({length:ntools},(_,j)=>({tool:buf.readUInt32LE(at+24+j*8),version:version(buf.readUInt32LE(at+28+j*8))}))});}
  if(cmd===0x1d){check(length>=16,'Code signature command');const offset=buf.readUInt32LE(at+8),bytes=buf.readUInt32LE(at+12);check(offset+bytes<=buf.length,'Code signature range');codesign.push({offset,bytes,note:'Presence is not certificate validation or device signing proof.'});}
  at+=length;
 }check(at===32+size&&builds.length===1&&builds[0].platform===7,'Mach-O must have one IOSSIMULATOR build platform');
 return {path:name,bytes:buf.length,sha256:sha(buf),architecture:cpu===0x0100000c?'arm64':'x86_64',cpuType:cpu,cpuSubtype:subtype,fileType:filetype,loadCommands:ncmds,builds,codeSignatureCommands:codesign};
}

check(lstatSync(ARCHIVE).size===EXPECTED.bytes,'Download incomplete or unexpected size');
const outerBytes=readFileSync(ARCHIVE);check(sha(outerBytes)===EXPECTED.sha256,'Outer ZIP SHA mismatch');
check(OUT.startsWith(ROOT+path.sep)&&(!existsSync(OUT)||realpathSync(OUT)===OUT),'Unsafe review directory');mkdirSync(OUT,{recursive:true});check(realpathSync(OUT)===OUT,'Linked review directory');
const outer=zip(outerBytes,'outer'),get=(name)=>{const e=outer.entries.get(name);check(e&&!e.directory,'Missing outer evidence '+name);return e.data;};
const checksums=JSON.parse(get('checksums.json'));check(checksums.schemaVersion===1&&checksums.kind==='ios-simulator-ci-evidence','Checksums schema');
const expectedNames=new Set(['checksums.json']);for(const e of checksums.files){safeName(e.path);check(!expectedNames.has(e.path),'Duplicate checksum path');expectedNames.add(e.path);const b=get(e.path);check(e.bytes===b.length&&e.sha256===sha(b),'Evidence checksum mismatch '+e.path);}
check(expectedNames.size===outer.entries.size,'Unlisted outer evidence');
for(const e of outer.entries.values()){check(!e.directory&&expectedNames.has(e.name),'Unexpected outer entry');save('outer/'+e.name,e.data);}
const appzip=zip(get('App-simulator.app.zip'),'App ZIP'),apptar=tar(get('App-simulator.app.tar.gz'));
for(const [name,e]of appzip.entries)check(name==='App.app/'||name.startsWith('App.app/')||name.startsWith('__MACOSX/'),'Unexpected nested ZIP root');
for(const [name,e]of apptar.entries)check(name==='App.app/'||name.startsWith('App.app/'),'Unexpected nested TAR root');
const appFiles=x=>new Map([...x.entries].filter(([name,e])=>!e.directory&&name.startsWith('App.app/')&&!name.split('/').some(x=>x.startsWith('._'))));
const zipped=appFiles(appzip),tared=appFiles(apptar);check(zipped.size>300&&zipped.size===tared.size,'App archive inventory count');
for(const [name,e]of zipped){const t=tared.get(name);check(t&&t.bytes===e.bytes&&t.sha256===e.sha256,'App ZIP/TAR byte mismatch '+name);}
const appGet=n=>{const e=zipped.get('App.app/'+n);check(e,'Missing compiled App file '+n);return e.data;};
const info=plist(appGet('Info.plist')),infoJson=JSON.parse(get('app-info.json'));
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
check(json(canonical(info))===json(canonical(infoJson)),'Compiled plist differs from runner plutil export');
check(info.CFBundleIdentifier==='ru.probpera.literaryplanet'&&info.CFBundleExecutable==='App'&&info.CFBundlePackageType==='APPL'&&json(info.CFBundleSupportedPlatforms)===json(['iPhoneSimulator'])&&info.DTPlatformName==='iphonesimulator','Incorrect App identity/platform');
check(json(info.CFBundleLocalizations)===json(['en','ru'])&&json(info.UIDeviceFamily)===json([1,2])&&info.MinimumOSVersion==='15.0','Compiled locales/device family/deployment target');
const localized={};for(const lang of ['en','ru'])localized[lang]=plist(appGet(lang+'.lproj/InfoPlist.strings'));
const config=JSON.parse(appGet('capacitor.config.json'));check(config.webDir==='dist-native'&&!config.server?.url&&!config.server?.allowNavigation,'Remote Capacitor runtime configuration');
check(json(config.packageClassList)===json(['AppPlugin','AppLauncherPlugin','CAPBrowserPlugin','CAPNetworkPlugin','PreferencesPlugin']),'Unexpected Capacitor native plugin list');
const localConfigBytes=readFileSync(path.join(ROOT,'capacitor.config.json')),localConfig=JSON.parse(localConfigBytes),withoutPluginList={...config};delete withoutPluginList.packageClassList;
check(json(canonical(localConfig))===json(canonical(withoutPluginList)),'Bundled Capacitor config differs from current canonical local config');
const artifact=JSON.parse(appGet('public/artifact.json'));check(artifact.sourceCommit===EXPECTED.source&&artifact.platform==='ios'&&artifact.channel==='dev'&&artifact.releaseReady===false&&artifact.productionActionsAuthorized===false,'Wrong or release-ready public artifact');
check(sha(appGet('public/artifact.json'))===sha(get('artifact.json')),'Outer/inside artifact mismatch');
const publicFiles=new Map([...zipped].filter(([n])=>n.startsWith('App.app/public/')).map(([n,e])=>[n.slice('App.app/public/'.length),e]));
const inventoryPaths=new Set();check(Array.isArray(artifact.inventory)&&artifact.inventory.length>0,'Missing actual public inventory');
for(const record of artifact.inventory){safeName(record.path);check(!inventoryPaths.has(record.path),'Duplicate public inventory path');inventoryPaths.add(record.path);const e=publicFiles.get(record.path);check(e&&record.bytes===e.bytes&&record.sha256===e.sha256,'Public inventory SHA mismatch '+record.path);}
const publicExtras=[...publicFiles].filter(([n])=>!inventoryPaths.has(n));check(json(publicExtras.map(([n])=>n).sort())===json(['artifact.json','cordova.js','cordova_plugins.js']),'Unexpected public payload extra');
for(const n of ['cordova.js','cordova_plugins.js'])check(publicFiles.get(n).bytes===0,'Nonempty Cordova compatibility file');
const builtReceipt=JSON.parse(get('simulator-bundle.json')),syncReceipt=JSON.parse(get('sync-integrity.json'));
for(const receipt of [builtReceipt,syncReceipt])check(receipt.sourceCommit===EXPECTED.source&&receipt.buildId===artifact.buildId&&receipt.canonicalFiles===artifact.inventory.length+1&&receipt.additionalEmptyCompatibilityFiles===2&&receipt.artifactSha256===sha(get('artifact.json'))&&receipt.configSha256===sha(appGet('capacitor.config.json'))&&receipt.releaseReady===false,'Receipt versus actual bundle mismatch');
for(const n of ['audit-before-sync.json','audit-after-sync.json','audit-after-build.json']){const audit=JSON.parse(get(n));check(audit.pass===true&&audit.sourceFreshnessChecked===true&&audit.findings.length===0&&audit.identity.sourceCommit===EXPECTED.source&&audit.identity.buildId===artifact.buildId,'Cloud audit identity mismatch');}
check(get('source-commit.txt').toString('utf8').trim()===EXPECTED.source,'Source commit evidence mismatch');
const resolved=JSON.parse(get('Package.resolved'));check(resolved.pins.length===1&&resolved.pins[0].identity==='capacitor-swift-pm'&&resolved.pins[0].location==='https://github.com/ionic-team/capacitor-swift-pm.git'&&resolved.pins[0].state.version==='8.5.1'&&resolved.pins[0].state.revision==='6afa7424fd2fcd8ca1e577478e8a00af284b7e82','SwiftPM exact pin mismatch');
const binaries=[...zipped].map(([name,e])=>macho(e.data,name)).filter(Boolean);check(binaries.some(e=>e.path==='App.app/App'&&e.fileType===2),'Missing App Mach-O executable');
for(const e of binaries)check((Number.parseInt(tared.get(e.path).mode,8)&0o111)!==0,'TAR lost executable mode '+e.path);
const inventory=[...zipped].map(([name,e])=>({path:name,bytes:e.bytes,sha256:e.sha256,tarMode:tared.get(name).mode}));
save('app-inventory.json',Buffer.from(json(inventory)));
save('compiled-info.json',Buffer.from(json(info)));save('compiled-localizations.json',Buffer.from(json(localized)));save('compiled-capacitor-config.json',Buffer.from(json(config)));save('mach-o-independent.json',Buffer.from(json(binaries)));
const report={recordedAt:new Date().toISOString(),scope:'Independent read-only binary/archive review of actual unsigned iOS Simulator build; no executable launched.',runId:34003133006,jobId:101405451827,sourceCommit:EXPECTED.source,outer:{path:path.relative(ROOT,ARCHIVE).replaceAll('\\','/'),bytes:outerBytes.length,sha256:sha(outerBytes),entries:outer.entries.size,checksummedPayloadFiles:checksums.files.length,allChecksumsPass:true},
 app:{zip:{bytes:get('App-simulator.app.zip').length,sha256:sha(get('App-simulator.app.zip')),entries:appzip.entries.size},tar:{bytes:get('App-simulator.app.tar.gz').length,sha256:sha(get('App-simulator.app.tar.gz')),entries:apptar.entries.size,paxHeaders:apptar.paxMetadata.length},regularPayloadFiles:zipped.size,zipTarFileBytesEqual:true,parityScope:'All regular App payload files; directory entries and AppleDouble/__MACOSX resource metadata are separately identified, not claimed equivalent.',zipNonPayloadEntries:[...appzip.entries.keys()].filter(n=>!zipped.has(n)),tarNonPayloadEntries:[...apptar.entries.keys()].filter(n=>!tared.has(n)),binaries,info,localizedNames:localized,capacitor:config,canonicalConfigComparison:{sameSemanticFields:true,localSourceSha256:sha(localConfigBytes),bundledSha256:sha(appGet('capacitor.config.json')),additionalOnly:'Exact five generated packageClassList entries'},publicPayload:{inventoryFiles:artifact.inventory.length,canonicalFilesIncludingArtifact:artifact.inventory.length+1,actualPublicFiles:publicFiles.size,additionalEmptyFiles:['cordova.js','cordova_plugins.js'],everyInventoryShaMatched:true,unlistedFiles:[],inventoryReport:'ios-binary-review/app-inventory.json'},artifact:{buildId:artifact.buildId,sourceCommit:artifact.sourceCommit,platform:artifact.platform,channel:artifact.channel,releaseReady:artifact.releaseReady},resolvedPackages:resolved},
 extraction:{root:path.relative(ROOT,OUT).replaceAll('\\','/'),method:'Outer entries extracted only after exact download size/SHA, central/local ZIP bounds, UTF-8 canonical names, no traversal/links/case collisions, CRC32, size limits and every manifest SHA matched. Nested ZIP/TAR examined in memory; no App binary extracted/executed. Tar regular-file bytes matched ZIP; modes recorded from tar.'},
 officialSources:[{url:'https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/EXTERNAL_HEADERS/mach-o/loader.h',used:'LC_BUILD_VERSION layout; PLATFORM_IOSSIMULATOR = 7; mach_header_64, load command bounds',accessDate:'2026-09-06'},{url:'https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/EXTERNAL_HEADERS/mach-o/fat.h',used:'Big-endian FAT_MAGIC architecture/slice table',accessDate:'2026-09-06'},{url:'https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/osfmk/mach/machine.h',used:'CPU_TYPE_ARM64 and CPU_TYPE_X86_64 constants',accessDate:'2026-09-06'},{url:'https://raw.githubusercontent.com/swiftlang/swift-corelibs-foundation/main/Sources/CoreFoundation/CFBinaryPList.c',used:'Binary plist trailer, object marker and reference structure',accessDate:'2026-09-06'}],
 limitations:['This is historical source 273f400d8f07a57269f391dfc13d7e802c9071f2 compiled in the real reported cloud run; it is not the later integrated local source candidate.','No device execution, Simulator launch, WebKit/Safari behavior, screenshots, App Store/TestFlight distribution, certificate trust or release approval established.','Exact package resolution and metadata are checked against downloaded evidence; no network dependency is fetched and no native binary is executed.','The xcresult ZIP is authenticated by outer SHA and checksum inventory; this task does not interpret the opaque Xcode result database.','The app and app debug libraries were linked with Simulator SDK 26.5; prebuilt Capacitor/Cordova frameworks report SDK 26.0. Xcode metadata reports 26.6 build17F113. These distinct versions are recorded as observed.'],checks:['Exact outer ZIP byte size and externally supplied SHA256','All 28 payload checksums; no unlisted outer evidence','ZIP local/central names and bounds, CRC32, no traversal, no links, no duplicate/case collision; TAR header/bounds/PAX and no links','349 regular App payload file SHA256 parity between ZIP and TAR','Every discovered Mach-O architecture slice has LC_BUILD_VERSION platform7 IOSSIMULATOR; ARM64 slices present','Compiled Info.plist parsed independently and equals the plutil JSON; canonical ID, RU/EN, iPhone+iPad, minimum15.0','Compiled RU/EN InfoPlist.strings names parsed independently','Exact current canonical Capacitor configuration plus five generated plugin class entries; local runtime only','Every actual public inventory file byte length and SHA256; only artifact manifest and two empty Cordova compatibility files are outside self-excluding inventory','Synced/built receipts and three strict audit evidence records agree with actual bundled source/build identity','SwiftPM resolves only Capacitor8.5.1 at exact6afa7424fd2fcd8ca1e577478e8a00af284b7e82','TAR preserves executable bits for all five Mach-O payload files'],pass:true};
report.reviewerScript={path:'.tmp/native-bootstrap/ios-binary-verification.mjs',sha256:sha(readFileSync(new URL(import.meta.url)))};
writeFileSync(path.join(ROOT,'.tmp/native-bootstrap/ios-binary-verification.json'),json(report));
console.log(JSON.stringify({outer:report.outer,files:zipped.size,binaries:binaries.map(x=>({path:x.path,architecture:x.architecture,builds:x.builds})),artifactKeys:Object.keys(artifact),localized,config}));
