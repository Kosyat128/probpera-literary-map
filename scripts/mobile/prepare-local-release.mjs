/** Explicit local preparation; never exports CMS, installs or contacts services. */
import fs from 'node:fs/promises';import path from 'node:path';import {spawn}from'node:child_process';import {randomUUID}from'node:crypto';import {fileURLToPath}from'node:url';import {captureReleaseInputs,sha256}from'./release-readiness.mjs';import {nativeRuntimeSourceRoots,nativeRuntimeSources,parseAndroidPackage,parseAndroidCertificate,inspectPreviousAndroidApk,createPreviousAndroidArtifact,validatePreviousAndroidArtifact}from'./native-install-runtime.mjs';
import {verifyNativeArtifact} from './verify-native-artifact.mjs';
import {isLocalCliEntry} from './local-cli-entry.mjs';
import {verifyCopiedPublic} from './ios-simulator-build.mjs';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);
const commit=value=>typeof value==='string'&&/^[a-f0-9]{40}$/u.test(value);
const ownData=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&Reflect.ownKeys(value).every(key=>typeof key==='string'&&Object.getOwnPropertyDescriptor(value,key)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key),'value'));
const dense=value=>Array.isArray(value)&&Object.keys(value).length===value.length&&Object.keys(value).every((key,index)=>key===String(index));
const requireTrue=(condition,message)=>{if(condition!==true)throw new Error(message);};
const resumePath=value=>typeof value==='string'&&/^\.tmp\/mobile-release-android-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\/preparation\.json$/u.test(value);

export function validateAndroidResumeSources(previousFiles,currentInputs){
 requireTrue(dense(previousFiles)&&previousFiles.length>0&&previousFiles.length<=12000&&ownData(currentInputs)&&dense(currentInputs.files)&&currentInputs.files.length>0&&currentInputs.files.length<=12000,'Missing bounded prior/current raw source set.');
 const validFile=file=>ownData(file)&&Object.keys(file).sort().join(',')==='path,sha256'&&typeof file.path==='string'&&hash(file.sha256);
 requireTrue(previousFiles.every(validFile)&&currentInputs.files.every(validFile),'Malformed source entry.');
 const previous=previousFiles.filter(file=>nativeRuntimeSourceRoots.some(prefix=>file.path===prefix||file.path.startsWith(prefix+'/'))&&!/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(file.path));
 requireTrue(JSON.stringify(previous)===JSON.stringify(currentInputs.files),'Compiled native app/config source set or raw bytes changed since the failed attempt.');
 return true;
}

/** Pure, bounded report validation. Importing this module never launches a build.
 * File ownership, current raw source bytes and native-copy integrity are checked
 * separately before any resumed command. Only the known cmd launch failure may
 * resume; a compilation or unrelated preparation failure cannot be relabelled. */
export function validateAndroidResumeReport(value, preparationPath) {
 requireTrue(resumePath(preparationPath),'Resume must name an owned Android preparation report.');
 requireTrue(ownData(value)&&value.schemaVersion===1&&value.kind==='literary-planet-local-release-preparation'&&value.mode==='android'&&value.pass===false&&value.error==='android-assemble failed; exact status and logs retained.'&&value.releaseReady===false&&value.deviceTested===false&&value.productionActionsAuthorized===false,'Only the failed unreleased Android preparation may resume.');
 requireTrue(!Object.hasOwn(value,'binaryReceipt')&&!Object.hasOwn(value,'packageIdentity')&&!Object.hasOwn(value,'instrumentationCompiled')&&typeof value.finishedAt==='string'&&Number.isFinite(Date.parse(value.finishedAt)),'Preparation already advanced beyond the supported launch failure.');
 const directory=preparationPath.slice(0,-'/preparation.json'.length),names=['native-build','native-audit','jdk-version','cap-sync','android-assemble'];
 requireTrue(dense(value.attempts)&&value.attempts.length===names.length,'Resume requires exactly the recorded five attempts.');
 for(let index=0;index<names.length;index++){
  const attempt=value.attempts[index],name=names[index];
  requireTrue(ownData(attempt)&&attempt.name===name&&attempt.exitCode===(index===4?1:0)&&attempt.signal===null&&attempt.errorCode===null&&attempt.deadline===false&&attempt.stdout===directory+'/'+name+'.stdout.txt'&&attempt.stderr===directory+'/'+name+'.stderr.txt'&&dense(attempt.command)&&attempt.command.length>0&&attempt.command.length<=16&&attempt.command.every(arg=>typeof arg==='string'&&arg.length<4096),'Missing, reordered, timed-out or otherwise failed prior attempt.');
 }
 requireTrue(value.attempts[4].command[0]==='cmd.exe','Only the recorded command-interpreter launch failure may resume.');
 requireTrue(ownData(value.inputs)&&commit(value.inputs.sourceCommit)&&dense(value.inputs.sourceFiles)&&value.inputs.sourceFiles.length>0&&value.inputs.sourceFiles.length<=12000,'Missing bounded source snapshot.');
 const sourcePaths=new Set();
 for(const file of value.inputs.sourceFiles){requireTrue(ownData(file)&&typeof file.path==='string'&&file.path.length<1024&&!/[\\:\u0000-\u001f]/u.test(file.path)&&file.path.split('/').every(part=>part&&part!=='.'&&part!=='..')&&hash(file.sha256)&&!sourcePaths.has(file.path),'Invalid prior raw source snapshot.');sourcePaths.add(file.path);}
 const bundle=value.nativeBundle;
 requireTrue(ownData(bundle)&&bundle.path===directory+'/native-bundle'&&bundle.artifactPath===bundle.path+'/artifact.json'&&hash(bundle.sha256)&&Number.isSafeInteger(bundle.files)&&bundle.files>0&&bundle.files<=4096,'Missing exact retained native bundle.');
 requireTrue(dense(value.outputs)&&value.outputs.length===1&&ownData(value.outputs[0])&&value.outputs[0].path===directory+'/native-artifact.json'&&value.outputs[0].sha256===bundle.sha256&&Number.isSafeInteger(value.outputs[0].bytes)&&value.outputs[0].bytes>0,'Prior outputs changed or include an unsupported APK.');
 if(value.previousApk!==null)requireTrue(ownData(value.previousApk)&&value.previousApk.path===directory+'/previous-dev-debug.apk'&&hash(value.previousApk.sha256)&&Number.isSafeInteger(value.previousApk.bytes)&&value.previousApk.bytes>0&&value.previousApk.bytes<=512*1024*1024,'Invalid preserved previous APK.');
 return Object.freeze({directory,bundlePath:bundle.path,artifactPath:bundle.artifactPath,artifactSha256:bundle.sha256,sourceCommit:value.inputs.sourceCommit,previousApk:value.previousApk});
}

// Exact output of this project's pinned Capacitor CLI without Cordova plugins.
// These ignored generated inputs were absent from the old Git snapshot; require
// the inspected canonical fixture rather than inventing historical hashes.
const generatedCordovaFiles=Object.freeze({
 'build.gradle':'28e3fa281f4d1e388bf98abc7f5bb31e672516e385c165c719d201ed54b8236e',
 'cordova.variables.gradle':'b13104b34f7738abceec358ae8226ba5e64855e97babde54a115880e9b9bd47b',
 'src/main/AndroidManifest.xml':'2e3e383475f0e6cb76f0a7b46017a546663fba8e5bd1ef2a537412afac2ee9b5',
 'src/main/java/.gitkeep':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
 'src/main/res/.gitkeep':'01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b',
});

export async function prepareLocalRelease(args=process.argv.slice(2)) {
const root=await fs.realpath(fileURLToPath(new URL('../../',import.meta.url))),mode=args[0],resume=args.length===3&&args[1]==='--resume'?args[2]:null;
if(!['android','ios-bundle','pwa'].includes(mode)||(args.length!==1&&!(mode==='android'&&resumePath(resume))))throw new Error('Usage: node scripts/mobile/prepare-local-release.mjs android|ios-bundle|pwa [android only: --resume .tmp/mobile-release-android-UUID/preparation.json]');
const out=path.join(root,'.tmp','mobile-release-'+mode+'-'+randomUUID());await fs.mkdir(out,{recursive:true});if(await fs.realpath(out)!==out)throw new Error('Linked output refused');
const relative=filename=>path.relative(root,filename).replaceAll('\\','/');const input=await captureReleaseInputs(root);const nativeInputs=mode==='android'?await nativeRuntimeSources(root):null;const attempts=[];const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^(VITE_|SUPABASE|PLANET_|TURNSTILE|YANDEX_|CMS_|CLOUDFLARE)/iu.test(key)));
const report={schemaVersion:1,kind:'literary-planet-local-release-preparation',startedAt:new Date().toISOString(),mode,inputs:input,attempts,outputs:[],deviceTested:false,iosCompiled:false,releaseReady:false,productionActionsAuthorized:false};
async function regular(relativePath,maximum=512*1024*1024){
 requireTrue(typeof relativePath==='string'&&relativePath.length<1024&&!/[\\:\u0000-\u001f]/u.test(relativePath)&&relativePath.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Unsafe preparation input.');
 const filename=path.resolve(root,relativePath),stat=await fs.lstat(filename);requireTrue(filename.startsWith(root+path.sep)&&stat.isFile()&&!stat.isSymbolicLink()&&stat.size<=maximum&&await fs.realpath(filename)===filename,'Missing, linked or oversized preparation input.');return fs.readFile(filename);
}
async function validateResume(){
 const previousBytes=await regular(resume,8*1024*1024),previous=JSON.parse(previousBytes.toString('utf8')),validated=validateAndroidResumeReport(previous,resume);
 const metadataBytes=await regular(validated.artifactPath,8*1024*1024),metadata=JSON.parse(metadataBytes.toString('utf8'));
 requireTrue(sha256(metadataBytes)===validated.artifactSha256&&sha256(await regular(previous.outputs[0].path,8*1024*1024))===validated.artifactSha256,'Retained bundle metadata or copied artifact changed.');
 requireTrue(metadata.schemaVersion===1&&metadata.kind==='literary-planet-bundled-native-preparation'&&metadata.platform==='android'&&metadata.channel==='dev'&&metadata.sourceCommit===validated.sourceCommit&&metadata.releaseReady===false&&metadata.productionActionsAuthorized===false,'Resume bundle is not the exact previous Android dev preparation.');
 for(const attempt of previous.attempts){await regular(attempt.stdout,1024*1024);await regular(attempt.stderr,1024*1024);}
 requireTrue((await regular(previous.attempts[4].stdout,1024*1024)).length===0&&(await regular(previous.attempts[4].stderr,1024*1024)).toString('utf8').trim()==='The network path was not found.','Previous failure was not the supported interpreter launch failure.');
 validateAndroidResumeSources(previous.inputs.sourceFiles,nativeInputs);
 const audit=await verifyNativeArtifact({rootDir:root,artifactDir:validated.bundlePath});await fs.writeFile(path.join(out,'resume-native-audit.json'),JSON.stringify(audit,null,2)+'\n',{flag:'wx'});
 requireTrue(audit.pass===true&&audit.identity?.platform==='android'&&audit.identity.channel==='dev'&&audit.identity.sourceCommit===validated.sourceCommit,'Retained bundle failed the current raw-source/artifact audit.');
 const copied=await verifyCopiedPublic(path.join(root,validated.bundlePath),path.join(root,'apps/mobile/android/app/src/main/assets/public'));
 requireTrue(sha256(await regular('dist-native/artifact.json',8*1024*1024))===validated.artifactSha256,'Active native bundle metadata differs from the retained audited bundle.');
 const canonicalConfig=JSON.parse((await regular('capacitor.config.json',65536)).toString('utf8')),copiedConfig=JSON.parse((await regular('apps/mobile/android/app/src/main/assets/capacitor.config.json',65536)).toString('utf8'));
 requireTrue(JSON.stringify(copiedConfig)===JSON.stringify(canonicalConfig),'Changed generated Capacitor runtime configuration.');
 const plugins=JSON.parse((await regular('apps/mobile/android/app/src/main/assets/capacitor.plugins.json',65536)).toString('utf8'));
 const expectedPlugins=[{pkg:'@capacitor/app',classpath:'com.capacitorjs.plugins.app.AppPlugin'},{pkg:'@capacitor/app-launcher',classpath:'com.capacitorjs.plugins.applauncher.AppLauncherPlugin'},{pkg:'@capacitor/browser',classpath:'com.capacitorjs.plugins.browser.BrowserPlugin'},{pkg:'@capacitor/network',classpath:'com.capacitorjs.plugins.network.NetworkPlugin'},{pkg:'@capacitor/preferences',classpath:'com.capacitorjs.plugins.preferences.PreferencesPlugin'}];
 requireTrue(JSON.stringify(plugins)===JSON.stringify(expectedPlugins),'Changed generated Capacitor plugin selection.');
 const cordovaRoot='apps/mobile/android/capacitor-cordova-android-plugins',found=[];
 async function walkCordova(prefix='',depth=0){requireTrue(depth<=8,'Generated plugin nesting exceeded.');const directory=path.join(root,cordovaRoot,prefix);requireTrue(await fs.realpath(directory)===directory,'Linked generated plugin directory.');for(const entry of await fs.readdir(directory,{withFileTypes:true})){const name=prefix+entry.name;requireTrue(!entry.isSymbolicLink(),'Linked generated plugin input.');if(entry.isDirectory())await walkCordova(name+'/',depth+1);else{requireTrue(entry.isFile()&&Object.hasOwn(generatedCordovaFiles,name),'Unexpected generated Cordova source or binary.');requireTrue(sha256(await regular(cordovaRoot+'/'+name,1024*1024))===generatedCordovaFiles[name],'Changed canonical generated Cordova input.');found.push(name);}}}
 await walkCordova();requireTrue(found.length===Object.keys(generatedCordovaFiles).length,'Missing canonical generated Cordova input.');
 requireTrue(sha256(await regular('apps/mobile/android/app/src/main/res/xml/config.xml',65536))==='e9dcda493e663c5c4db9e3cb3bd968477a6e90aa8840bcbba40d72ed54b767ce','Changed generated Cordova configuration.');
 const currentApk='apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk';
 if(validated.previousApk){const previousApk=await regular(validated.previousApk.path);requireTrue(sha256(previousApk)===validated.previousApk.sha256&&previousApk.length===validated.previousApk.bytes&&sha256(await regular(currentApk))===validated.previousApk.sha256,'Previous or current APK changed; cannot resume this launch failure.');await fs.writeFile(path.join(out,'previous-dev-debug.apk'),previousApk,{flag:'wx'});report.previousApk={path:relative(path.join(out,'previous-dev-debug.apk')),sha256:validated.previousApk.sha256,bytes:previousApk.length};}
 else {try{await fs.lstat(path.join(root,currentApk));throw new Error('Unexpected current APK after a preparation without a previous APK.');}catch(error){if(error.code!=='ENOENT')throw error;}report.previousApk=null;}
 report.resumedFrom={path:resume,sha256:sha256(previousBytes),sourceCommit:validated.sourceCommit,failedAttempt:'android-assemble',priorPass:false};
 report.reusedSteps=['native-build','cap-sync'];report.resumeAudit={path:relative(path.join(out,'resume-native-audit.json')),pass:true,reason:'The command-launch repair requires exact current raw-source, retained-bundle and copied-public verification before continuing.',copied};
 report.bundleSourceCommit=metadata.sourceCommit;report.outputs.push(await preserve(path.join(root,previous.outputs[0].path),'native-artifact.json'));report.nativeBundle=await retainBundle(validated.bundlePath,'native-bundle');requireTrue(report.outputs[0]?.sha256===validated.artifactSha256&&report.nativeBundle.sha256===validated.artifactSha256,'Retained bundle changed while copying the continuation evidence.');
 return metadata;
}
async function run(name,command,args,timeout=240000,extra={}){
 const stdout=await fs.open(path.join(out,name+'.stdout.txt'),'wx'),stderr=await fs.open(path.join(out,name+'.stderr.txt'),'wx');const began=new Date().toISOString();
 const result=await new Promise(resolve=>{let deadline=false;const child=spawn(command,args,{cwd:root,env:{...env,...extra},windowsHide:true,stdio:['ignore',stdout.fd,stderr.fd]});let termination=Promise.resolve();const timer=setTimeout(()=>{if(child.exitCode!==null||child.signalCode!==null)return;deadline=true;if(process.platform==='win32'&&child.pid){termination=new Promise(done=>{const kill=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});kill.once('error',()=>{child.kill();done();});kill.once('exit',()=>done());});}else child.kill();},timeout);child.once('error',error=>{clearTimeout(timer);resolve({exitCode:null,signal:null,errorCode:error.code,deadline});});child.once('exit',async(code,signal)=>{clearTimeout(timer);await termination;resolve({exitCode:code,signal,errorCode:null,deadline});});});await stdout.close();await stderr.close();
 attempts.push({name,command:[command,...args],startedAt:began,finishedAt:new Date().toISOString(),...result,stdout:relative(path.join(out,name+'.stdout.txt')),stderr:relative(path.join(out,name+'.stderr.txt'))});
 await fs.writeFile(path.join(out,'preparation.json'),JSON.stringify(report,null,2)+'\n');if(result.exitCode!==0)throw new Error(name+' failed; exact status and logs retained.');
}
async function preserve(filename,label){try{const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Unsafe previous artifact');const bytes=await fs.readFile(filename);const target=path.join(out,label);await fs.writeFile(target,bytes,{flag:'wx'});return{path:relative(target),sha256:sha256(bytes),bytes:bytes.length};}catch(error){if(error.code==='ENOENT')return null;throw error;}}
async function retainBundle(directory,label){
 const source=path.join(root,directory),metaBytes=await fs.readFile(path.join(source,'artifact.json')),meta=JSON.parse(metaBytes.toString('utf8')),target=path.join(out,label);await fs.mkdir(target);
 if(!Array.isArray(meta.inventory)||meta.inventory.length>10000)throw new Error('Invalid audited bundle inventory');
 for(const item of meta.inventory){if(typeof item.path!=='string'||/[\\:\u0000-\u001f]/u.test(item.path)||item.path.startsWith('/')||item.path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Unsafe retained resource');const filename=path.resolve(source,item.path);if(!filename.startsWith(source+path.sep)||(await fs.lstat(filename)).isSymbolicLink()||await fs.realpath(filename)!==filename)throw new Error('Linked retained resource');const bytes=await fs.readFile(filename);if(sha256(bytes)!==item.sha256||bytes.length!==item.bytes)throw new Error('Changed retained resource');await fs.mkdir(path.dirname(path.join(target,item.path)),{recursive:true});await fs.writeFile(path.join(target,item.path),bytes,{flag:'wx'});}
 await fs.writeFile(path.join(target,'artifact.json'),metaBytes,{flag:'wx'});return{path:relative(target),artifactPath:relative(path.join(target,'artifact.json')),sha256:sha256(metaBytes),files:meta.inventory.length};
}

try{
 if(mode==='pwa'){
  await run('pwa-build',process.execPath,['scripts/mobile/build-pwa.mjs']);
  await run('pwa-audit',process.execPath,['scripts/mobile/verify-pwa-artifact.mjs']);
  report.outputs.push(await preserve(path.join(root,'dist-pwa/artifact.json'),'pwa-artifact.json'));report.pwaBundle=await retainBundle('dist-pwa','pwa-bundle');
 }else{
  const platform=mode==='android'?'android':'ios';
  let preparedArtifact;
  if(resume)preparedArtifact=await validateResume();
  else{
   if(platform==='android')report.previousApk=await preserve(path.join(root,'apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk'),'previous-dev-debug.apk');
   await run('native-build',process.execPath,['scripts/mobile/build-native.mjs',platform,'dev']);
   await run('native-audit',process.execPath,['scripts/mobile/verify-native-artifact.mjs']);
   report.outputs.push(await preserve(path.join(root,'dist-native/artifact.json'),'native-artifact.json'));report.nativeBundle=await retainBundle('dist-native','native-bundle');
   preparedArtifact=JSON.parse(await regular(report.nativeBundle.artifactPath,8*1024*1024));report.bundleSourceCommit=preparedArtifact.sourceCommit;
  }
  if(platform==='android'){
   if(process.platform!=='win32')throw new Error('Reviewed Android preparation command currently requires Windows project toolchain.');
   const tools=path.join(root,'.tmp/native-tools'),jdk=path.join(tools,'java/jdk-21.0.12.1+1'),sdk=path.join(tools,'android-sdk'),bt=path.join(sdk,'build-tools/36.0.0');
   const java=path.join(jdk,'bin/java.exe'),wrapper=path.join(root,'apps/mobile/android/gradle/wrapper/gradle-wrapper.jar'),signer=path.join(bt,'lib/apksigner.jar');
   for(const file of [java,path.join(bt,'aapt2.exe'),path.join(bt,'zipalign.exe'),signer,wrapper,path.join(tools,'android-user/literary-planet-debug.keystore')]){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||await fs.realpath(file)!==file)throw new Error('Required existing project tool/signing key missing; no installation or key replacement.');}
   // --offline affects Gradle, not the wrapper's distribution bootstrap. Refuse
   // launch without the already extracted pinned local distribution and marker.
   const properties=(await regular('apps/mobile/android/gradle/wrapper/gradle-wrapper.properties',65536)).toString('utf8');
   requireTrue(/^distributionUrl=https\\:\/\/services\.gradle\.org\/distributions\/gradle-8\.14\.3-bin\.zip\r?$/mu.test(properties)&&/^distributionSha256Sum=bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531\r?$/mu.test(properties)&&/^distributionBase=GRADLE_USER_HOME\r?$/mu.test(properties)&&/^distributionPath=wrapper\/dists\r?$/mu.test(properties)&&/^zipStoreBase=GRADLE_USER_HOME\r?$/mu.test(properties)&&/^zipStorePath=wrapper\/dists\r?$/mu.test(properties),'Pinned Gradle distribution configuration changed.');
   const cacheRoot=path.join(tools,'gradle-user/wrapper/dists/gradle-8.14.3-bin');requireTrue(await fs.realpath(cacheRoot)===cacheRoot,'Linked or missing pinned Gradle cache.');
   const caches=(await fs.readdir(cacheRoot,{withFileTypes:true})).filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink());requireTrue(caches.length===1&&caches[0].name==='cv11ve7ro1n3o1j4so8xd9n66','Missing the exact existing cache for the pinned distribution URL.');
   const cache=path.join(cacheRoot,caches[0].name);for(const filename of [path.join(cache,'gradle-8.14.3-bin.zip.ok'),path.join(cache,'gradle-8.14.3/lib/gradle-launcher-8.14.3.jar')]){const stat=await fs.lstat(filename);requireTrue(stat.isFile()&&!stat.isSymbolicLink()&&await fs.realpath(filename)===filename,'Incomplete cached Gradle distribution; no download is allowed.');}
   const toolEnv={JAVA_HOME:jdk,ANDROID_HOME:sdk,ANDROID_SDK_ROOT:sdk,ANDROID_USER_HOME:path.join(tools,'android-user'),GRADLE_USER_HOME:path.join(tools,'gradle-user'),JAVA_OPTS:'',JAVA_TOOL_OPTIONS:'',_JAVA_OPTIONS:'',JDK_JAVA_OPTIONS:'',GRADLE_OPTS:''};
   const javaArgs=['-Duser.home='+path.join(tools,'tool-user'),'-Djava.io.tmpdir='+path.join(tools,'tool-temp')];
   const gradleArgs=task=>[...javaArgs,'-Dorg.gradle.java.home='+jdk,'-Dorg.gradle.jvmargs=-Xmx1536m -Dfile.encoding=UTF-8 -Duser.home="'+path.join(tools,'tool-user')+'" -Djava.io.tmpdir="'+path.join(tools,'tool-temp')+'"','-classpath',wrapper,'org.gradle.wrapper.GradleWrapperMain','-p',path.join(root,'apps/mobile/android'),task,'--offline','--no-daemon','--max-workers=2'];
   const signerArgs=apkPath=>[...javaArgs,'-jar',signer,'verify','--verbose','--print-certs',apkPath];
   await run('jdk-version',java,[...javaArgs,'-version'],10000,toolEnv);
   if(!resume)await run('cap-sync',process.execPath,['node_modules/@capacitor/cli/bin/capacitor','sync','android'],120000,toolEnv);
   await run('android-assemble',java,gradleArgs(':app:assembleDevDebug'),600000,toolEnv);
   const apk=await preserve(path.join(root,'apps/mobile/android/app/build/outputs/apk/dev/debug/app-dev-debug.apk'),'app-dev-debug.apk');if(!apk)throw new Error('Missing built APK');report.outputs.push(apk);
   try { await run('android-instrumentation-assemble',java,gradleArgs(':app:assembleDevDebugAndroidTest'),240000,toolEnv);const testOutput=await preserve(path.join(root,'apps/mobile/android/app/build/outputs/apk/androidTest/dev/debug/app-dev-debug-androidTest.apk'),'app-dev-debug-androidTest.apk');if(!testOutput)throw new Error('Missing compiled instrumentation APK');report.outputs.push(testOutput);report.instrumentationCompiled=true; } catch(error) { report.instrumentationCompiled=false;report.instrumentationError=error.message; }
   await run('apk-badging',path.join(bt,'aapt2.exe'),['dump','badging',path.join(root,apk.path)],10000,toolEnv);
   await run('apk-manifest',path.join(bt,'aapt2.exe'),['dump','xmltree',path.join(root,apk.path),'--file','AndroidManifest.xml'],10000,toolEnv);
   await run('apk-signature',java,signerArgs(path.join(root,apk.path)),30000,toolEnv);
   await run('apk-alignment',path.join(bt,'zipalign.exe'),['-c','-P','16','4',path.join(root,apk.path)],10000,toolEnv);
   const artifact=preparedArtifact;
   const badging=await fs.readFile(path.join(out,'apk-badging.stdout.txt'),'utf8');const identity=/^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/mu.exec(badging);if(!identity||identity[1]!=='ru.probpera.literaryplanet.dev'||identity[2]!=='1'||identity[3]!=='1.0-dev')throw new Error('Actual APK identity mismatch');
   const signature=await fs.readFile(path.join(out,'apk-signature.stdout.txt'),'utf8');const certificate=/certificate SHA-256 digest: ([a-f0-9]{64})/u.exec(signature);if(!certificate)throw new Error('Missing verified certificate digest');
   report.packageIdentity={applicationId:identity[1],versionCode:Number(identity[2]),versionName:identity[3],sourceCommit:artifact.sourceCommit,preparationSourceCommit:input.sourceCommit,sourceFingerprint:input.sourceFingerprint,buildId:artifact.buildId,artifactSha256:apk.sha256,channel:'dev',signing:'existing-project-debug-key',certificateSha256:certificate[1],storeArtifact:false};
   report.previousArtifact=null;
   if(report.previousApk){
    await run('previous-apk-badging',path.join(bt,'aapt2.exe'),['dump','badging',path.join(root,report.previousApk.path)],10000,toolEnv);
    await run('previous-apk-signature',java,signerArgs(path.join(root,report.previousApk.path)),30000,toolEnv);
    const oldBadging=await fs.readFile(path.join(out,'previous-apk-badging.stdout.txt'),'utf8'),oldSignature=await fs.readFile(path.join(out,'previous-apk-signature.stdout.txt'),'utf8'),oldMetadata=parseAndroidPackage(oldBadging),oldCertificate=parseAndroidCertificate(oldSignature),oldBytes=await regular(report.previousApk.path);
    requireTrue(sha256(oldBytes)===report.previousApk.sha256&&oldBytes.length===report.previousApk.bytes,'Preserved previous APK changed.');
    const inspected=await inspectPreviousAndroidApk(root,oldBytes);report.previousArtifact=createPreviousAndroidArtifact(report.previousApk,oldMetadata,oldCertificate,inspected);
    report.updateSignatureCompatible=oldMetadata.applicationId===identity[1]&&oldCertificate===certificate[1];
    const assessment=validatePreviousAndroidArtifact(report.previousArtifact,{artifactPath:apk.path,artifactSha256:apk.sha256,applicationId:identity[1],versionCode:Number(identity[2]),certificateSha256:certificate[1]},relative(path.join(out,'binary.json')));
    report.previousUpdateReady=assessment.ready;report.previousUpdateDependency=assessment.reason;report.updateRuntimeTested=false;
   }
   const currentNative=await nativeRuntimeSources(root);if(JSON.stringify(currentNative)!==JSON.stringify(nativeInputs))throw new Error('Native source/config changed during binary assembly');report.copiedPublicIntegrity=await verifyCopiedPublic(path.join(root,report.nativeBundle.path),path.join(root,'apps/mobile/android/app/src/main/assets/public'));if(report.resumedFrom)requireTrue(sha256(await regular(report.resumedFrom.path,8*1024*1024))===report.resumedFrom.sha256,'Original failed report changed during continuation.');const testApk=report.outputs.find(item=>item?.path.endsWith('/app-dev-debug-androidTest.apk'));const receipt={schemaVersion:1,kind:'literary-planet-native-binary-preparation',platform:'android',channel:'dev',sourceCommit:artifact.sourceCommit,preparationSourceCommit:input.sourceCommit,sourceInputs:nativeInputs,artifactPath:apk.path,artifactSha256:apk.sha256,webArtifactSha256:report.nativeBundle.sha256,webArtifactPath:report.nativeBundle.artifactPath,applicationId:identity[1],versionCode:Number(identity[2]),versionName:identity[3],certificateSha256:certificate[1],previousArtifact:report.previousArtifact,releaseReady:false,deviceTested:false,...(report.resumedFrom?{resumedFrom:report.resumedFrom}:{}),...(testApk?{testArtifactPath:testApk.path,testArtifactSha256:testApk.sha256}:{}),updateSignatureCompatible:report.updateSignatureCompatible??null};await fs.writeFile(path.join(out,'binary.json'),JSON.stringify(receipt,null,2)+'\n');report.binaryReceipt=relative(path.join(out,'binary.json'));

  }
 }
 const after=await captureReleaseInputs(root);if(after.sourceFingerprint!==input.sourceFingerprint||after.sourceCommit!==input.sourceCommit)throw new Error('Source/config changed during preparation; artifact is not final evidence.');
 report.mainBinaryPrepared=mode==='android';report.pass=mode!=='android'||report.instrumentationCompiled===true;if(!report.pass){report.error='Main Android APK prepared; instrumentation APK not prepared. See the preserved failed attempt.';process.exitCode=1;}
}catch(error){report.pass=false;report.error=error.message;process.exitCode=1;}
report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'preparation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output:relative(out),pass:report.pass,error:report.error,outputs:report.outputs,releaseReady:false,deviceTested:false}));
return report;
}
if(isLocalCliEntry(import.meta.url))await prepareLocalRelease();
