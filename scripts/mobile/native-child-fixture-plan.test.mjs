import {describe,expect,it} from 'vitest';
import path from 'node:path';
import {bindXctestrun,childDataScenarioRunId,childDataFixtureArguments,childTransportFixtureArguments,childProtectedFixtureArguments,protectedEnvelopeFixturePassed,nativeProtectedFixtureSourcePaths,verifyNativeProtectedFixtureSources,createAndroidOfflineGate} from './native-install-runtime.mjs';

const runId='a'.repeat(32), binary=path.resolve('/synthetic/build/App.app'), templateDir=path.dirname(binary);
const phases=['write','read','atomic','retire','corrupt','missing-key','missing-cipher','clear'];
function input(){return {__xctestrun_metadata__:{FormatVersion:2},TestConfigurations:[{TestTargets:[{
  BlueprintName:'AppSecureStorageTests',IsAppHostedTestBundle:true,TestHostPath:'__TESTROOT__/App.app',TestBundlePath:'__TESTHOST__/PlugIns/AppSecureStorageTests.xctest',
  EnvironmentVariables:{DYLD_FRAMEWORK_PATH:'__TESTROOT__/Frameworks',LITERARY_PLANET_SECURE_TEST_RUN_ID:'b'.repeat(32),
    LITERARY_PLANET_SECURE_TEST_PHASE:'corrupt',LITERARY_PLANET_PREFERENCE_TEST_PHASE:'write',LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID:'c'.repeat(32),LITERARY_PLANET_CHILD_DATA_TEST_PHASE:'missing-key',LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID:'d'.repeat(32),LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE:'wire'}
}]}]};}
describe('owned native child-data fixture dispatch',()=>{
  it('isolates every destructive namespace and changes all of them for a different parent run',()=>{
    const cases=['primary','corrupt','missing-key','missing-cipher','private-transport'];
    const one=cases.map(name=>childDataScenarioRunId(runId,name)),two=cases.map(name=>childDataScenarioRunId('d'.repeat(32),name));
    expect(new Set([...one,...two]).size).toBe(10);expect(one.every(value=>/^[a-f0-9]{32}$/u.test(value))).toBe(true);
  });
  it.each(phases)('binds Android %s to the owned data fixture and isolated phase field',phase=>{
    const id=childDataScenarioRunId(runId,'primary'),args=childDataFixtureArguments(id,phase);
    expect(args).toHaveLength(15);expect(args[7]).toBe('ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest');
    expect(args[10]).toBe(id);expect(args[12]).toBe('literaryChildDataPhase');expect(args[13]).toBe(phase);expect(Object.isFrozen(args)).toBe(true);
  });
  it.each(phases)('binds XCTest %s without leaking a previous secure/preferences/child test selection',phase=>{
    const original=input(),before=JSON.stringify(original),id=childDataScenarioRunId(runId,'primary');
    const result=bindXctestrun(original,{binary,templateDir,runId:id,phase:'child-data:'+phase}),target=result.TestConfigurations[0].TestTargets[0];
    expect(target.OnlyTestIdentifiers).toEqual(['PlanetChildDataStoreRuntimeTests/testDurableDataPhase']);
    expect(target.EnvironmentVariables).toEqual({DYLD_FRAMEWORK_PATH:templateDir+'/Frameworks',LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID:id,LITERARY_PLANET_CHILD_DATA_TEST_PHASE:phase});
    expect(target.SkipTestIdentifiers).toEqual([]);expect(target.ParallelizationEnabled).toBe(false);expect(JSON.stringify(original)).toBe(before);
  });
  it('removes child fixture state before selecting an unrelated secure or preference test',()=>{
    for(const phase of ['write','preferences:timeout']){
      const target=bindXctestrun(input(),{binary,templateDir,runId,phase}).TestConfigurations[0].TestTargets[0];
      expect(target.EnvironmentVariables).not.toHaveProperty('LITERARY_PLANET_CHILD_DATA_TEST_RUN_ID');
      expect(target.EnvironmentVariables).not.toHaveProperty('LITERARY_PLANET_CHILD_DATA_TEST_PHASE');
      expect(target.OnlyTestIdentifiers[0]).toMatch(/^PlanetSecureStoreRuntimeTests\//u);
    }
  });
  it('routes the private wire fixture to its separate XCTest class and run-owned environment',()=>{
    const target=bindXctestrun(input(),{binary,templateDir,runId,phase:'child-transport:wire'}).TestConfigurations[0].TestTargets[0];
    expect(target.OnlyTestIdentifiers).toEqual(['PlanetChildDataTransportRuntimeTests/testPrivateTransportPhase']);
    expect(target.EnvironmentVariables).toEqual({DYLD_FRAMEWORK_PATH:templateDir+'/Frameworks',LITERARY_PLANET_CHILD_TRANSPORT_TEST_RUN_ID:runId,LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE:'wire'});
    expect(()=>bindXctestrun(input(),{binary,templateDir,runId,phase:'child-transport:clear'})).toThrow();
  });
  it('admits only the exact private transport wire command and denies cross-fixture phase fields before ADB',async()=>{
    const calls=[],gate=createAndroidOfflineGate(async(args)=>{calls.push(args);if(args[1]==='settings')return args[4]==='airplane_mode_on'?'1\n':'0\n';if(args.join(',')==='shell,cmd,wifi,status')return 'Wifi is disabled\nWifi scanning is only available when wifi is enabled\n';return 'synthetic';},()=>{});
    const args=childTransportFixtureArguments(runId);expect(Object.isFrozen(args)).toBe(true);await gate.command('private-wire',args,60000);expect(calls).toHaveLength(4);
    calls.length=0;for(const [index,value]of [[12,'literaryChildDataPhase'],[13,'clear'],[7,'ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest']]){
      const denied=[...args];denied[index]=value;await expect(gate.command('private-wire-denied',denied,60000)).rejects.toThrow();expect(calls).toEqual([]);
    }
  });
  it('denies injected/unknown phases and invalid parent identifiers before producing commands or XCTest',()=>{
    for(const phase of ['remove','atomic; shutdown','read\n','child-data:read'])expect(()=>childDataFixtureArguments(runId,phase)).toThrow();
    for(const id of ['','A'.repeat(32),'a'.repeat(31),runId+';']){
      expect(()=>childDataScenarioRunId(id,'primary')).toThrow();expect(()=>childDataFixtureArguments(id,'read')).toThrow();
      expect(()=>bindXctestrun(input(),{binary,templateDir,runId:id,phase:'child-data:read'})).toThrow();
    }
    expect(()=>childDataScenarioRunId(runId,'../other')).toThrow();
    for(const phase of ['child-data:remove','child-data:read\n','child-data:'])expect(()=>bindXctestrun(input(),{binary,templateDir,runId,phase})).toThrow();
  });
});

describe('owned native structural envelope fixture dispatch',()=>{
  it('requires both exact structural fixture sources in the binary source fingerprint',()=>{
    expect(nativeProtectedFixtureSourcePaths).toEqual([
      'apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildProtectedEnvelopeRuntimeTest.java',
      'apps/mobile/ios/App/AppSecureStorageTests/PlanetChildProtectedEnvelopeRuntimeTests.swift',
    ]);
    expect(Object.isFrozen(nativeProtectedFixtureSourcePaths)).toBe(true);
    const rows=nativeProtectedFixtureSourcePaths.map(path=>({path,sha256:'a'.repeat(64)}));
    expect(verifyNativeProtectedFixtureSources(rows)).toBe(true);
    for(const index of [0,1])expect(()=>verifyNativeProtectedFixtureSources(rows.filter((_,selected)=>selected!==index))).toThrow();
    expect(()=>verifyNativeProtectedFixtureSources([{...rows[0],sha256:'invalid'},rows[1]])).toThrow();
    expect(()=>verifyNativeProtectedFixtureSources(null)).toThrow();
  });
  it('selects the exact Android structural class and phase while denying cross-fixture commands before ADB',async()=>{
    const args=childProtectedFixtureArguments(runId);
    expect(args).toEqual(['shell','am','instrument','-w','-r','-e','class','ru.probpera.literaryplanet.PlanetChildProtectedEnvelopeRuntimeTest',
      '-e','literaryRunId',runId,'-e','literaryProtectedEnvelopePhase','codec','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
    expect(Object.isFrozen(args)).toBe(true);
    const calls=[],gate=createAndroidOfflineGate(async(command)=>{calls.push(command);if(command[1]==='settings')return command[4]==='airplane_mode_on'?'1\n':'0\n';if(command.join(',')==='shell,cmd,wifi,status')return 'Wifi is disabled\nWifi scanning is only available when wifi is enabled\n';return 'synthetic';},()=>{});
    await gate.command('structural-envelope',args,60000);expect(calls).toHaveLength(4);expect(calls[3]).toEqual(args);
    calls.length=0;
    for(const [index,value]of [[7,'ru.probpera.literaryplanet.PlanetChildDataStoreRuntimeTest'],[12,'literaryChildDataPhase'],[13,'clear'],[13,'codec; shutdown'],[10,'A'.repeat(32)],[14,'unrelated.test/runner']]){
      const denied=[...args];denied[index]=value;await expect(gate.command('structural-denied',denied,60000)).rejects.toThrow();expect(calls).toEqual([]);
    }
    for(const id of ['','A'.repeat(32),'a'.repeat(31),runId+';'])expect(()=>childProtectedFixtureArguments(id)).toThrow();
  });
  it('selects the whole nine-test XCTest structural class and clears unrelated fixture state without mutating its template',()=>{
    const original=input(),before=JSON.stringify(original),target=bindXctestrun(original,{binary,templateDir,runId,phase:'child-protected:codec'}).TestConfigurations[0].TestTargets[0];
    expect(target.OnlyTestIdentifiers).toEqual(['PlanetChildProtectedEnvelopeRuntimeTests']);
    expect(target.EnvironmentVariables).toEqual({DYLD_FRAMEWORK_PATH:templateDir+'/Frameworks'});
    expect(target.SkipTestIdentifiers).toEqual([]);expect(target.ParallelizationEnabled).toBe(false);expect(JSON.stringify(original)).toBe(before);
    for(const phase of ['child-protected:clear','child-protected:wire','child-protected:codec\n','child-protected:'])expect(()=>bindXctestrun(input(),{binary,templateDir,runId,phase})).toThrow();
    expect(()=>bindXctestrun(input(),{binary,templateDir,runId:'A'.repeat(32),phase:'child-protected:codec'})).toThrow();
  });
  it('accepts exactly nine successful structural tests and refuses short, duplicate, skipped, failed or mixed summaries',()=>{
    const android='OK (9 tests)\n',ios='Executed 9 tests, with 0 failures (0 unexpected)\n** TEST EXECUTE SUCCEEDED **\n';
    expect(protectedEnvelopeFixturePassed(android,'android')).toBe(true);expect(protectedEnvelopeFixturePassed(ios,'ios')).toBe(true);
    expect(protectedEnvelopeFixturePassed(android+'INSTRUMENTATION_CODE: -1\n','android')).toBe(true);
    for(const count of [0,1,8,10]){
      expect(protectedEnvelopeFixturePassed(`OK (${count} tests)\n`,'android')).toBe(false);
      expect(protectedEnvelopeFixturePassed(`Executed ${count} tests, with 0 failures\n** TEST EXECUTE SUCCEEDED **\n`,'ios')).toBe(false);
    }
    for(const suffix of ['INSTRUMENTATION_FAILED','INSTRUMENTATION_STATUS_CODE: -1','INSTRUMENTATION_STATUS_CODE: -2','INSTRUMENTATION_STATUS_CODE: -3','INSTRUMENTATION_STATUS_CODE: -4','FAILURES!!!','Process crashed','skipped','OK (9 tests)\n','OK (8 tests)\n'])expect(protectedEnvelopeFixturePassed(android+suffix,'android')).toBe(false);
    for(const suffix of ['Test Case example skipped','TEST EXECUTE FAILED','error: unavailable','Executed 9 tests, with 1 failures','Executed 8 tests, with 0 failures'])expect(protectedEnvelopeFixturePassed(ios+suffix,'ios')).toBe(false);
    expect(protectedEnvelopeFixturePassed('Executed 9 tests, with 0 failures','ios')).toBe(false);
    expect(protectedEnvelopeFixturePassed(android,'unknown')).toBe(false);expect(protectedEnvelopeFixturePassed(null,'android')).toBe(false);
  });
  it('restores exact secure, preference, data and transport selections after a structural class selection',()=>{
    const structural=bindXctestrun(input(),{binary,templateDir,runId,phase:'child-protected:codec'});
    for(const [phase,identifier,key,value]of [
      ['write','PlanetSecureStoreRuntimeTests/testSecureStoragePhase','LITERARY_PLANET_SECURE_TEST_PHASE','write'],
      ['preferences:timeout','PlanetSecureStoreRuntimeTests/testPreferencePhase','LITERARY_PLANET_PREFERENCE_TEST_PHASE','timeout'],
      ['child-data:read','PlanetChildDataStoreRuntimeTests/testDurableDataPhase','LITERARY_PLANET_CHILD_DATA_TEST_PHASE','read'],
      ['child-transport:wire','PlanetChildDataTransportRuntimeTests/testPrivateTransportPhase','LITERARY_PLANET_CHILD_TRANSPORT_TEST_PHASE','wire']]){
      const target=bindXctestrun(structural,{binary,templateDir,runId,phase}).TestConfigurations[0].TestTargets[0];
      expect(target.OnlyTestIdentifiers).toEqual([identifier]);expect(target.EnvironmentVariables[key]).toBe(value);
    }
    expect(structural.TestConfigurations[0].TestTargets[0].OnlyTestIdentifiers).toEqual(['PlanetChildProtectedEnvelopeRuntimeTests']);
  });
});
