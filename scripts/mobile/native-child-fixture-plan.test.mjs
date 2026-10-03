import {describe,expect,it} from 'vitest';
import path from 'node:path';
import {bindXctestrun,childDataScenarioRunId,childDataFixtureArguments,childTransportFixtureArguments,createAndroidOfflineGate} from './native-install-runtime.mjs';

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
