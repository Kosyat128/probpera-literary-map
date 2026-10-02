import { describe, expect, it, vi } from 'vitest';
import { zipSync, unzipSync } from 'fflate';
import { createPreviousAndroidArtifact, inspectPreviousAndroidArchive, previousPreferencesDexClasses,
  validatePreviousAndroidArtifact, verifyPreviousAndroidBinding, androidPreviousUpdatePlan } from './native-install-runtime.mjs';

// Synthetic signed-identity/DEX/ZIP projections only. No command/device/OS access.
const directory='.tmp/mobile-release-android-12345678-1234-4234-8234-123456789abc', receiptPath=directory+'/binary.json';
const current={artifactPath:directory+'/app-dev-debug.apk',artifactSha256:'a'.repeat(64),applicationId:'ru.probpera.literaryplanet.dev',versionCode:1,certificateSha256:'b'.repeat(64)};
const embedded={schemaVersion:1,kind:'literary-planet-bundled-native-preparation',platform:'android',channel:'dev',sourceCommit:'c'.repeat(40),releaseReady:false,productionActionsAuthorized:false};
const plugin=[{pkg:'@capacitor/preferences',classpath:'com.capacitorjs.plugins.preferences.PreferencesPlugin'}];
const descriptors=['Lcom/capacitorjs/plugins/preferences/Preferences;','Lcom/capacitorjs/plugins/preferences/PreferencesConfiguration;','Lcom/capacitorjs/plugins/preferences/PreferencesPlugin;'];
function dex(defined=3){
  const encoder=new TextEncoder(), strings=descriptors.map(text=>encoder.encode(text)), stringOffset=112,typeOffset=124,classOffset=136,dataOffset=classOffset+defined*32;
  const bytes=new Uint8Array(dataOffset+strings.reduce((total,value)=>total+value.length+2,0)),view=new DataView(bytes.buffer);
  bytes.set(encoder.encode('dex\n035\0')); const u32=(at,value)=>view.setUint32(at,value,true);
  u32(32,bytes.length);u32(36,112);u32(40,0x12345678);u32(56,3);u32(60,stringOffset);u32(64,3);u32(68,typeOffset);u32(96,defined);u32(100,classOffset);
  let at=dataOffset; strings.forEach((value,index)=>{u32(stringOffset+index*4,at);u32(typeOffset+index*4,index);if(index<defined)u32(classOffset+index*32,index);bytes[at++]=value.length;bytes.set(value,at);at+=value.length+1;}); return bytes;
}
function archive(metadata=embedded, classes=dex()){
  const files={'assets/capacitor.plugins.json':new TextEncoder().encode(JSON.stringify(plugin)),'classes.dex':classes,'assets/private-ignore.bin':new Uint8Array([1,2,3])};
  if(metadata!==null)files['assets/public/artifact.json']=new TextEncoder().encode(JSON.stringify(metadata));
  return zipSync(files);
}
function previous(inspection=inspectPreviousAndroidArchive(archive(),unzipSync)){
  return createPreviousAndroidArtifact({path:directory+'/previous-dev-debug.apk',sha256:'d'.repeat(64),bytes:1000},
    {applicationId:current.applicationId,versionCode:1,versionName:'1.0-dev',debuggable:true},current.certificateSha256,inspection);
}
describe('exact own Android predecessor update programming',()=>{
  it('preserves actual embedded historical source and permits same-code debug replacement',()=>{
    const value=previous(),assessment=validatePreviousAndroidArtifact(value,current,receiptPath);
    expect(assessment.ready).toBe(true);expect(value.sourceCommit).toBe(embedded.sourceCommit);expect(value.webArtifactSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(value.preferencesProtocol).toBe('capacitor-preferences-v1-reflection');expect(Object.isFrozen(value)).toBe(true);
  });
  it('requires actual class definitions rather than incidental DEX descriptor strings',()=>{
    expect(previousPreferencesDexClasses(dex())).toEqual({preferences:true,configuration:true,plugin:true});
    expect(previousPreferencesDexClasses(dex(0))).toEqual({preferences:false,configuration:false,plugin:false});
    const assessment=validatePreviousAndroidArtifact(previous(inspectPreviousAndroidArchive(archive(embedded,dex(0)),unzipSync)),current,receiptPath);
    expect(assessment.reason).toBe('previous-capacitor-preferences-protocol-unavailable');
  });
  it.each([null,{...embedded,channel:'googlePlay'},{...embedded,sourceCommit:'unknown'}])('keeps absent or incompatible predecessor metadata unadmitted: %j',metadata=>{
    const value=previous(inspectPreviousAndroidArchive(archive(metadata),unzipSync)),assessment=validatePreviousAndroidArtifact(value,current,receiptPath);
    expect(assessment.ready).toBe(false);expect(value.sourceCommit).toBeNull();expect(assessment.reason).toBe('previous-embedded-metadata-'+(metadata===null?'missing':'incompatible'));
  });
  it.each([{certificateSha256:'e'.repeat(64)},{applicationId:'other.app'},{versionCode:2},{artifactSha256:current.artifactSha256},{debuggable:false}])('does not plan wrong certificate/app/downgrade or identical binary: %j',patch=>{
    const assessment=validatePreviousAndroidArtifact({...previous(),...patch},current,receiptPath);
    expect(assessment.ready).toBe(false);expect(()=>androidPreviousUpdatePlan(current,assessment,'f'.repeat(32))).toThrow();
  });
  it.each(['../foreign.apk','.tmp/other/previous-dev-debug.apk',directory+'/app-dev-debug.apk'])('rejects foreign/unbound predecessor copy %s',artifactPath=>{
    expect(()=>validatePreviousAndroidArtifact({...previous(),artifactPath},current,receiptPath)).toThrow(/preserved own/u);
  });
  it('rejects malformed source identity/accessors without invoking them',()=>{
    const getter=vi.fn(()=>embedded.sourceCommit);
    expect(()=>validatePreviousAndroidArtifact({...previous(),sourceCommit:'unknown'},current,receiptPath)).toThrow(/source binding/u);
    const value={...previous(),get sourceCommit(){return getter();}};
    expect(()=>validatePreviousAndroidArtifact(value,current,receiptPath)).toThrow();expect(getter).not.toHaveBeenCalled();
  });
  it('requires fresh actual archive/package/certificate/source equality despite valid relabelled identities',()=>{
    const value=previous();expect(verifyPreviousAndroidBinding(value,{...value})).toBe(true);
    for(const patch of [{sourceCommit:'f'.repeat(40)},{artifactSha256:'f'.repeat(64)},{webArtifactSha256:'f'.repeat(64)},{versionCode:2},{preferencesProtocol:null}])
      expect(()=>verifyPreviousAndroidBinding({...value,...patch},value)).toThrow(/bound predecessor/u);
  });
  it('rejects selected ZIP bombs and duplicate selected names before expansion',()=>{
    const oversized=(_bytes,{filter})=>{filter({name:'classes.dex',originalSize:32*1024*1024+1});return{};};
    const duplicate=(_bytes,{filter})=>{filter({name:'classes.dex',originalSize:112});filter({name:'classes.dex',originalSize:112});return{};};
    expect(()=>inspectPreviousAndroidArchive(new Uint8Array([1]),oversized)).toThrow(/oversized/u);
    expect(()=>inspectPreviousAndroidArchive(new Uint8Array([1]),duplicate)).toThrow(/Duplicate/u);
  });
  it('plans old installation, isolated legacy preference seed and replacement without downgrade/reset',()=>{
    const plan=androidPreviousUpdatePlan(current,validatePreviousAndroidArtifact(previous(),current,receiptPath),'f'.repeat(32));
    expect(plan.previousInstall).toEqual(['install',directory+'/previous-dev-debug.apk']);expect(plan.currentUpdate).toEqual(['install','-r',current.artifactPath]);
    expect(plan.seedArguments).toContain('ru.probpera.literaryplanet.PlanetPreviousPreferencesRuntimeTest');expect(plan.seedArguments).toContain('write');
    expect(JSON.stringify(plan)).not.toMatch(/(?:uninstall|clear|"-d"|secure|ParentPin)/u);expect(Object.isFrozen(plan.currentUpdate)).toBe(true);
  });
});
