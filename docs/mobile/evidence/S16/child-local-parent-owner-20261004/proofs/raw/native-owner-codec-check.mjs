import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { B, sha, json, requireFact, repositoryRoot, processContext, capture } from './parent-pin-checks-common.mjs';

// Actual final Android classes, pure structural grammar only. No OS/Keystore/
// device-owner prompt, authoritative clock or installed acceptance is tested.
const root = repositoryRoot(process.argv[2]);
const expectedSource = process.argv[3];
requireFact(/^[0-9a-f]{40}$/u.test(expectedSource), 'EXPLICIT_CURRENT_SOURCE_REQUIRED');
const { env, git } = processContext(root);
const input = await capture(root);
requireFact(input.sourceCommit === expectedSource && input.sourceStatus === '' && git(['diff','--cached','--name-only']) === '', 'CLEAN_CURRENT_SOURCE_REQUIRED');
const out = path.join(B, 'child-local-parent-owner-work-20261004', 'native-codec-jvm-a1');
fs.mkdirSync(out, { recursive: false });
const classes = path.join(root, 'apps/mobile/android/app/build/intermediates/javac/devDebug/compileDevDebugJavaWithJavac/classes');
const sdkJar = path.join(root, '.tmp/native-tools/android-sdk/platforms/android-36/android.jar');
const jdk = path.join(root, '.tmp/native-tools/java/jdk-21.0.12.1+1');
const vault = path.join(classes, 'ru/probpera/literaryplanet/PlanetChildVault.class');
for (const file of [vault,sdkJar,path.join(jdk,'bin/javac.exe'),path.join(jdk,'bin/java.exe')]) requireFact(fs.statSync(file).isFile(), 'EXISTING_COMPILED_TOOLCHAIN_REQUIRED');
const source = String.raw`package ru.probpera.literaryplanet;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
public final class NativeOwnerCodecJvm {
  static int assertions = 0, cases = 0;
  static final String VERSION="synthetic-codec-v1", POLICY="a".repeat(64);
  static final String CLOCK="{\"schemaVersion\":1,\"bootId\":\"00000000-0000-4000-8000-000000000001\",\"uptimeAnchorMs\":100,\"logicalAnchorMs\":1000,\"epochAnchor\":null}";
  static void check(boolean value) { assertions++; if(!value) throw new AssertionError("assertion "+assertions); }
  static String hash(String value) throws Exception { byte[] h=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder b=new StringBuilder();for(byte x:h)b.append(String.format("%02x",x&255));return b.toString(); }
  static String registry(String locale,String tail) { return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"activeProfileId\":\"synthetic-child\",\"profiles\":[{\"id\":\"synthetic-child\",\"label\":\""+(locale.equals("ru")?"Синтетический читатель":"Synthetic Reader")+"\",\"exactAge\":9,\"ageBand\":\"9-11\",\"locale\":\""+locale+"\",\"ageConfirmedAt\":\"2026-10-01T12:00:00.000Z\",\"readingLevel\":null,\"allowedTopics\":null,\"blockedTopics\":[\"violence\"],\"soundEnabled\":false,\"motion\":\"calm\",\"narrationEnabled\":false"+tail+"}]}"; }
  static String pin() { return "{\"schemaVersion\":1,\"policyVersion\":\""+VERSION+"\",\"revision\":1,\"credentialId\":\""+"e".repeat(64)+"\",\"verifier\":{\"algorithm\":\"PBKDF2-HMAC-SHA256\",\"iterations\":600000,\"saltHex\":\""+"f".repeat(64)+"\",\"hashHex\":\""+"d".repeat(64)+"\"},\"attempts\":{\"count\":0,\"blockedUntilMs\":0,\"lastObservedMs\":1010,\"pendingAttemptId\":null}}"; }
  static String record(long revision,String registry,String pin) throws Exception { return "{\"schemaVersion\":1,\"revision\":"+revision+",\"mode\":\"adult\",\"selectionRevision\":3,\"profileRevision\":2,\"policyChecksum\":\""+POLICY+"\",\"registryChecksum\":\""+hash(registry)+"\",\"registry\":"+registry+",\"pin\":"+pin+",\"clock\":"+CLOCK+"}"; }
  static PlanetChildVault.ProtectedEnvelope decode(String value) throws Exception { return PlanetChildVault.ProtectedEnvelope.decode(value.getBytes(StandardCharsets.UTF_8),VERSION,POLICY,600000); }
  static void reject(String value) throws Exception { boolean refused=false;try(var parsed=decode(value)){}catch(PlanetChildVault.Unavailable e){refused=true;}check(refused); }
  static void caseDone(String label) { cases++;System.out.println("PASS "+label); }
  public static void main(String[] args) throws Exception {
    for(String locale:new String[]{"ru","en"}) {
      for(String tail:new String[]{"",",\"localeLocked\":false",",\"localeLocked\":true"}) {
        String value=record(7,registry(locale,tail),"null");byte[] supplied=value.getBytes(StandardCharsets.UTF_8);
        try(var parsed=PlanetChildVault.ProtectedEnvelope.decode(supplied,VERSION,POLICY,600000)) { check(hash(value).equals(parsed.checksum));check(parsed.isUnenrolled());Arrays.fill(supplied,(byte)0);check(Arrays.equals(value.getBytes(StandardCharsets.UTF_8),parsed.copyCanonicalBytes())); }
      }
      caseDone(locale+" canonical absent/false/true remain exact-owned bytes");
    }
    for(String tail:new String[]{",\"localeLocked\":null",",\"localeLocked\":1",",\"localeLocked\":\"true\"",",\"localeLocked\":{}",",\"localeLocked\":true,\"localeLocked\":false",",\"localeLocked\":true,\"future\":true"}) reject(record(7,registry("en",tail),"null"));
    caseDone("nonBoolean duplicate unknown tail denied");
    reject(record(7,registry("en",",\"localeLocked\":true").replace("\"narrationEnabled\":false,\"localeLocked\":true","\"localeLocked\":true,\"narrationEnabled\":false"),"null"));
    caseDone("noncanonical field order denied");
    for(String locale:new String[]{"ru","en"}) {
      String reg=registry(locale,",\"localeLocked\":true");
      try(var before=decode(record(7,reg,"null"));var after=decode(record(8,reg,pin()))) { PlanetChildVault.ProtectedEnvelope.validateTransition(before,after,PlanetChildVault.PinLifecycleAction.enroll,1010);check(true); }
      boolean refused=false;try(var before=decode(record(7,reg,"null"));var after=decode(record(8,registry(locale,",\"localeLocked\":false"),pin()))) { try{PlanetChildVault.ProtectedEnvelope.validateTransition(before,after,PlanetChildVault.PinLifecycleAction.enroll,1010);}catch(PlanetChildVault.Unavailable e){refused=true;} }check(refused);
      caseDone(locale+" PIN-only preserves exact locale lock; simultaneous change denied");
    }
    System.out.println("RESULT cases="+cases+" assertions="+assertions+" platform=pure-JVM codecOnly=true installedOS=false");
  }
}
`;
const src = path.join(out,'NativeOwnerCodecJvm.java');fs.writeFileSync(src,source,{flag:'wx'});
const report = { schemaVersion:1,kind:'native-owner-locale-codec-jvm',inputs:input,expectedSource,startedAt:new Date().toISOString(),source:{path:src,sha256:sha(Buffer.from(source))},compiledVault:{path:vault,sha256:sha(fs.readFileSync(vault))},attempts:[],installedOS:'NOT_RUN',deviceOwner:'NOT_RUN',swift:'NOT_COMPILED_NOT_RUN',releaseReady:false };
const classpath=classes+path.delimiter+sdkJar;
for(const [name,exe,args] of [ ['compile',path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-cp',classpath,'-d',out,src]], ['runtime',path.join(jdk,'bin/java.exe'),['-cp',out+path.delimiter+classpath,'ru.probpera.literaryplanet.NativeOwnerCodecJvm']] ]) {
 const run=spawnSync(exe,args,{cwd:out,env:{...env,JAVA_OPTS:'',JAVA_TOOL_OPTIONS:'',_JAVA_OPTIONS:'',JDK_JAVA_OPTIONS:''},windowsHide:true,timeout:30_000,maxBuffer:2*1024*1024});
 const stdout=run.stdout??Buffer.alloc(0),stderr=run.stderr??Buffer.alloc(0);fs.writeFileSync(path.join(out,name+'-stdout.bin'),stdout,{flag:'wx'});fs.writeFileSync(path.join(out,name+'-stderr.bin'),stderr,{flag:'wx'});
 report.attempts.push({name,exitCode:run.status,signal:run.signal,error:run.error?.message??null,stdout:{path:name+'-stdout.bin',sha256:sha(stdout),bytes:stdout.length},stderr:{path:name+'-stderr.bin',sha256:sha(stderr),bytes:stderr.length}});
 if(run.status!==0){report.status='FAIL';report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),json(report),{flag:'wx'});throw new Error(name+' failed; original raw output preserved');}
 if(name==='runtime') { const match=stdout.toString('utf8').match(/RESULT cases=(\d+) assertions=(\d+) platform=pure-JVM codecOnly=true installedOS=false/u);requireFact(match&&Number(match[1])===6&&Number(match[2])===29,'EXACT_CODEC_COUNTS_REQUIRED');report.cases=Number(match[1]);report.assertions=Number(match[2]); }
}
const after=await capture(root);requireFact(after.sourceFingerprint===input.sourceFingerprint&&after.sourceStatus===''&&after.repositoryHead===input.repositoryHead,'SOURCE_CHANGED_DURING_CODEC_CHECK');report.status='PASS';report.endedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),json(report),{flag:'wx'});console.log(json({status:report.status,cases:report.cases,assertions:report.assertions,result:path.join(out,'result.json'),installedOS:report.installedOS}));
