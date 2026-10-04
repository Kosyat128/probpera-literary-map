import {describe,expect,it} from 'vitest';
import path from 'node:path';
import {bindXctestrun,childDataScenarioRunId,childDataFixtureArguments,childTransportFixtureArguments,childProtectedFixtureArguments,protectedEnvelopeFixturePassed,nativeProtectedFixtureSourcePaths,verifyNativeProtectedFixtureSources,createAndroidOfflineGate,
  nativePinVerificationInputFixtureSourcePath,verifyNativePinVerificationInputFixtureSource,pinVerificationInputFixtureArguments,pinVerificationInputFixturePassed,pinVerificationInputTestMethods} from './native-install-runtime.mjs';

import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {nativeChildLocalV2PinOperationsFixtureSourcePath,childLocalV2PinOperationsTestMethods,verifyNativeChildLocalV2PinOperationsFixtureSource,childLocalV2PinOperationsFixtureArguments,childLocalV2PinOperationsFixturePassed,runNativeInstallRuntime} from './native-install-runtime.mjs';

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

describe('native verification input runner', () => {
  const runId='7'.repeat(32), fixtureClass='ru.probpera.literaryplanet.PlanetChildNativePinVerificationInputRuntimeTest';
  const methods=[
    'oneDigitOriginalEnglishActionAndReply','explicitRussianLocaleAndAllSixteenFixedCaptions','emptyMaximumDeletionAndOwnedBufferWipe',
    'backRevokesWithoutChargeOrAdmission','actualActivityPauseRevokesOriginalHost','obscuredTouchRejectsAndWipes',
    'blockedCurrentRetainsActualInputWorkerUntilReturn','originalExpiryDuringSynchronousKdfNeverRefunds',
    'throwingRecipientNeverReceivesSecondCompletion','completedRecipientStillCannotAckBeforeFinalObserverCleanup',
    'retirementJoinsVisibleOriginalInputAndCleanup','foreignThreadCannotBindThroughOriginalVisibleSlot',
    'failureBeforeRecipientRetainsOriginalUncertainTransfer',
  ];
  const status=(name,code,owner=fixtureClass)=>`INSTRUMENTATION_STATUS: class=${owner}\nINSTRUMENTATION_STATUS: numtests=13\nINSTRUMENTATION_STATUS: test=${name}\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;
  const success=(names=methods)=>names.map(name=>status(name,1)+status(name,0)).join('')+'\nOK (13 tests)\nINSTRUMENTATION_CODE: -1\n';
  const readArgs=[['shell','settings','get','global','airplane_mode_on'],['shell','settings','get','global','mobile_data'],['shell','cmd','wifi','status']];
  function gateFixture(connected=false){
    const calls=[],records=[];const replies=['1\n',connected?'1\n':'0\n','Wifi is disabled\nWifi scanning is only available when wifi is enabled\n'];
    return {calls,records,gate:createAndroidOfflineGate(async(args)=>{
      calls.push([...args]);const index=readArgs.findIndex(row=>row.join(',')===args.join(','));return index>=0?replies[index]:'synthetic fixture not executed';
    },value=>records.push(value))};
  }
  it('binds only one exact class/phase and fresh run metadata with no generic PIN fixture',()=>{
    expect(pinVerificationInputTestMethods).toEqual(methods);expect(Object.isFrozen(pinVerificationInputTestMethods)).toBe(true);
    const args=pinVerificationInputFixtureArguments(runId);expect(Object.isFrozen(args)).toBe(true);
    expect(args).toEqual(['shell','am','instrument','-w','-r','-e','class',fixtureClass,'-e','literaryRunId',runId,'-e','literaryPinVerificationInputPhase','input','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
    for(const id of [undefined,null,{},'',runId.toUpperCase().replace('7','A'),'7'.repeat(31),runId+';',runId+'\n'])expect(()=>pinVerificationInputFixtureArguments(id)).toThrow();
  });
  it('requires the unique current fixture raw source hash rather than another PIN or storage class',()=>{
    const row={path:nativePinVerificationInputFixtureSourcePath,sha256:'a'.repeat(64)};
    expect(verifyNativePinVerificationInputFixtureSource([row,{path:'src/synthetic.ts',sha256:'b'.repeat(64)}])).toBe(true);
    for(const rows of [null,[],[{...row,path:row.path.replace('VerificationInput','Input')}],[{...row,sha256:'bad'}],[row,row]])expect(()=>verifyNativePinVerificationInputFixtureSource(rows)).toThrow();
  });
  it('accepts all thirteen original standard start/pass pairs with successful final minus-one code',()=>{
    expect(pinVerificationInputFixturePassed(success())).toBe(true);
    expect(pinVerificationInputFixturePassed(success([...methods].reverse()).replaceAll('\n','\r\n'))).toBe(true);
  });
  it('refuses missing or mixed summaries, wrong totals and an unsuccessful or ambiguous final code',()=>{
    for(const text of [success().replace('OK (13 tests)\n',''),success()+'OK (13 tests)\n',success()+'OK (12 tests)\n',
      success().replace('13 tests','12 tests'),success().replace('13 tests','14 tests'),success().replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'),
      success().replace('INSTRUMENTATION_CODE: -1\n',''),success()+'INSTRUMENTATION_CODE: -1\n',
      'OK (13 tests)\nINSTRUMENTATION_CODE: -1\n'+methods.map(name=>status(name,1)+status(name,0)).join(''),
      success().replace('\nOK (13 tests)\nINSTRUMENTATION_CODE: -1\n','\nINSTRUMENTATION_CODE: -1\nOK (13 tests)\n'),
      status(methods[0],1)+status(methods[0],0)+'OK (13 tests)\n'+success(methods.slice(1)),
      success().replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_STATUS: stream=late\nINSTRUMENTATION_CODE: -1'),
      success()+'INSTRUMENTATION_STATUS: id=late\n'])expect(pinVerificationInputFixturePassed(text)).toBe(false);
  });
  it('does not promote failed, skipped, crashed or malformed per-test statuses to the successful summary',()=>{
    for(const suffix of ['FAILURES!!!','INSTRUMENTATION_FAILED: unavailable','INSTRUMENTATION_ABORTED','Process crashed','shortMsg=error','skipped','error: unavailable'])expect(pinVerificationInputFixturePassed(success()+suffix)).toBe(false);
    for(const code of [-1,-2,-3,-4,2,'00','unknown'])expect(pinVerificationInputFixturePassed(success().replace('INSTRUMENTATION_STATUS_CODE: 0',`INSTRUMENTATION_STATUS_CODE: ${code}`))).toBe(false);
    expect(pinVerificationInputFixturePassed(null)).toBe(false);expect(pinVerificationInputFixturePassed('x'.repeat(4*1024*1024+1))).toBe(false);
  });
  it('requires every exact method once and its own started completion instead of foreign or duplicated identity',()=>{
    for(const text of [success([...methods.slice(0,-1),methods[0]]),success().replace(methods[0],'foreignMethod'),
      success().replace(fixtureClass,fixtureClass+'Foreign'),success().replace(status(methods[0],1),''),
      success().replace('INSTRUMENTATION_STATUS: numtests=13','INSTRUMENTATION_STATUS: numtests=12'),
      success().replace('INSTRUMENTATION_STATUS: test='+methods[0],'INSTRUMENTATION_STATUS: test='+methods[0]+'\nINSTRUMENTATION_STATUS: test='+methods[0]),
      success()+status(methods[0],1)])expect(pinVerificationInputFixturePassed(text)).toBe(false);
  });
  it('dispatches only after all three offline observations and copies the exact bounded instrumentation array',async()=>{
    const f=gateFixture(),args=[...pinVerificationInputFixtureArguments(runId)],expected=[...args];
    const pending=f.gate.command('pin-verification-input',args,180000);args[7]='foreign.class';await pending;
    expect(f.calls).toEqual([...readArgs,expected]);expect(f.records).toMatchObject([{checkpoint:'pin-verification-input',status:'PASS'}]);
  });
  it('rejects cross-class phase, foreign runner, replay-shaped IDs and appended arguments before any device access',async()=>{
    const patches=[[7,'ru.probpera.literaryplanet.PlanetChildNativePinInputRuntimeTest'],[7,'ru.probpera.literaryplanet.PlanetChildProtectedEnvelopeRuntimeTest'],
      [12,'literaryPhase'],[13,'codec'],[13,'input;'],[10,'7'.repeat(31)],[10,'A'.repeat(32)],[14,'foreign.test/androidx.test.runner.AndroidJUnitRunner']];
    for(const [index,value] of patches){const f=gateFixture(),args=[...pinVerificationInputFixtureArguments(runId)];args[index]=value;await expect(f.gate.command('pin-ui-denied',args)).rejects.toThrow();expect(f.calls).toEqual([]);expect(f.records).toEqual([]);}
    const f=gateFixture();await expect(f.gate.command('pin-ui-denied',[...pinVerificationInputFixtureArguments(runId),'-e','extra','value'])).rejects.toThrow();expect(f.calls).toEqual([]);
  });
  it('keeps connected-target denial ahead of the new UI fixture and records the actual failed offline observation',async()=>{
    const f=gateFixture(true);await expect(f.gate.command('pin-verification-input',pinVerificationInputFixtureArguments(runId),180000)).rejects.toThrow(/not verifiably offline/u);
    expect(f.calls).toEqual(readArgs);expect(f.records).toMatchObject([{status:'FAIL',reason:'android-offline-state-unavailable'}]);
  });
});

describe('native Local V2 PIN operations runner',()=>{
  const runId='8'.repeat(32),fixtureClass='ru.probpera.literaryplanet.PlanetChildFirstInstallRuntimeTest';
  const methods=[
    'localV2RawEnrollmentCannotUseEvenOriginalSampleWithoutNativeOwnerKdf',
    'localV2RawChargeCannotMutateFromAnchoredBooleanOrP1Receipt',
    'localV2SyntheticOutcomeFlagsCannotAuthorizeEnrollmentMutation',
    'localV2CanonicalAdultSnapshotCannotMasqueradeAsOriginalChildGate',
    'localV2OriginalOwnerTargetLocaleAndIterationSubstitutionAreRefused',
    'localV2RetirementJoinsActualPinWorkerAfterCounterDrain',
    'localV2StaleNativeOperationCannotTouchFreshLeaseAfterRetirement',
    'localV2OwnedPromptPauseIsNarrowAndActualBackgroundStillLatches',
    'localV2ClosedResultLatchesBackgroundUntilActualObserverCleanup',
  ];
  const selection=methods.map(method=>fixtureClass+'#'+method).join(',');
  const packet=(name,code,ordinal,owner=fixtureClass)=>`INSTRUMENTATION_STATUS: class=${owner}\nINSTRUMENTATION_STATUS: numtests=9\nINSTRUMENTATION_STATUS: test=${name}\n`
    +(ordinal===undefined?'':`INSTRUMENTATION_STATUS: current=${ordinal}\nINSTRUMENTATION_STATUS: id=AndroidJUnitRunner\nINSTRUMENTATION_STATUS: stream=${code===1?'':'.'}\n`)
    +`INSTRUMENTATION_STATUS_CODE: ${code}\n`;
  const success=(names=methods,standard=false)=>names.map((name,index)=>packet(name,1,standard?index+1:undefined)+packet(name,0,standard?index+1:undefined)).join('')
    +(standard?'INSTRUMENTATION_RESULT: stream=\n\nTime: 0.123\n':'')+'\nOK (9 tests)\nINSTRUMENTATION_CODE: -1\n';
  const readArgs=[['shell','settings','get','global','airplane_mode_on'],['shell','settings','get','global','mobile_data'],['shell','cmd','wifi','status']];
  function gateFixture(connected=false){const calls=[],records=[],replies=['1\n',connected?'1\n':'0\n','Wifi is disabled\nWifi scanning is only available when wifi is enabled\n'];
    return {calls,records,gate:createAndroidOfflineGate(async args=>{calls.push([...args]);const i=readArgs.findIndex(row=>row.join(',')===args.join(','));return i>=0?replies[i]:'synthetic selector only; no target exists';},value=>records.push(value))};}
  it('selects exactly nine fully qualified noninteractive methods and original first-install metadata',()=>{
    expect(childLocalV2PinOperationsTestMethods).toEqual(methods);expect(Object.isFrozen(childLocalV2PinOperationsTestMethods)).toBe(true);
    const args=childLocalV2PinOperationsFixtureArguments(runId);expect(Object.isFrozen(args)).toBe(true);
    expect(args).toEqual(['shell','am','instrument','-w','-r','-e','class',selection,'-e','literaryRunId',runId,'-e','literaryFirstInstallPhase','first-install-v2','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
    expect(args[7].split(',')).toHaveLength(9);expect(args[7]).not.toBe(fixtureClass);
    for(const id of [undefined,null,{},'',runId.slice(1),'A'.repeat(32),runId+';',runId+'\n'])expect(()=>childLocalV2PinOperationsFixtureArguments(id)).toThrow();
  });
  it('requires the unique first-install raw source hash rather than another PIN fixture',()=>{
    const row={path:nativeChildLocalV2PinOperationsFixtureSourcePath,sha256:'c'.repeat(64)};
    expect(row.path).toBe('apps/mobile/android/app/src/androidTest/java/ru/probpera/literaryplanet/PlanetChildFirstInstallRuntimeTest.java');
    expect(verifyNativeChildLocalV2PinOperationsFixtureSource([row,{path:'src/fixture.ts',sha256:'b'.repeat(64)}])).toBe(true);
    for(const rows of [null,[],[row,row],[{...row,sha256:'bad'}],[{...row,path:nativePinVerificationInputFixtureSourcePath}]])expect(()=>verifyNativeChildLocalV2PinOperationsFixtureSource(rows)).toThrow();
  });
  it('accepts original matching serial packets and standard AndroidJUnitRunner metadata in either locale line ending',()=>{
    expect(childLocalV2PinOperationsFixturePassed(success())).toBe(true);
    expect(childLocalV2PinOperationsFixturePassed(success([...methods].reverse(),true).replaceAll('\n','\r\n'))).toBe(true);
  });
  it('rejects missing starts or completions, foreign methods and reused original identity even with OK nine',()=>{
    for(const text of [success(methods.slice(1)),success().replace(packet(methods[0],1),''),success().replace(packet(methods[0],0),''),
      success([...methods.slice(0,-1),methods[0]]),success().replace(methods[0],'interactiveFirstInstall'),success().replace(fixtureClass,fixtureClass+'Foreign'),
      success().replace('INSTRUMENTATION_STATUS: numtests=9','INSTRUMENTATION_STATUS: numtests=48'),success()+packet(methods[0],1)])expect(childLocalV2PinOperationsFixturePassed(text)).toBe(false);
  });
  it('rejects crossed original packets and inconsistent runner ordinal or identity metadata',()=>{
    const crossed=packet(methods[0],1)+packet(methods[1],1)+packet(methods[0],0)+packet(methods[1],0)+success(methods.slice(2));
    for(const text of [crossed,success().replace(packet(methods[0],0),packet(methods[1],0)),success(methods,true).replace('current=1','current=0'),
      success(methods,true).replace('current=1','current=2'),success(methods,true).replace('id=AndroidJUnitRunner','id=ForeignRunner'),
      success(methods,true).replace('INSTRUMENTATION_STATUS: current=1\n','')])expect(childLocalV2PinOperationsFixturePassed(text)).toBe(false);
  });
  it('rejects extra or duplicate status fields instead of ignoring them as passing stream text',()=>{
    for(const field of ['INSTRUMENTATION_STATUS: extra=value\n','INSTRUMENTATION_STATUS: stack=ignored\n','INSTRUMENTATION_STATUS: current=1\nINSTRUMENTATION_STATUS: current=1\n',
      'INSTRUMENTATION_STATUS: test='+methods[0]+'\n','INSTRUMENTATION_STATUS: stream=x\nINSTRUMENTATION_STATUS: stream=y\n'])
      expect(childLocalV2PinOperationsFixturePassed(success().replace('INSTRUMENTATION_STATUS_CODE: 1',field+'INSTRUMENTATION_STATUS_CODE: 1'))).toBe(false);
    for(const suffix of ['INSTRUMENTATION_STATUS: id=late\n','INSTRUMENTATION_STATUS_CODE: 0\n','INSTRUMENTATION_RESULT: stream=late\n','INSTRUMENTATION_RESULT: extra=late\n'])
      expect(childLocalV2PinOperationsFixturePassed(success()+suffix)).toBe(false);
  });
  it('rejects skips, assumptions, failure codes, crashes and malformed or unbounded output',()=>{
    for(const code of [-1,-2,-3,-4,2,'00','+0','unknown'])expect(childLocalV2PinOperationsFixturePassed(success().replace('INSTRUMENTATION_STATUS_CODE: 0',`INSTRUMENTATION_STATUS_CODE: ${code}`))).toBe(false);
    for(const suffix of ['FAILURES!!!','INSTRUMENTATION_FAILED: unavailable','INSTRUMENTATION_ABORTED','Process crashed','shortMsg=error','skipped','AssumptionViolatedException','error: unavailable'])expect(childLocalV2PinOperationsFixturePassed(success()+suffix)).toBe(false);
    for(const value of [null,{},'x'.repeat(4*1024*1024+1),success()+'\0'])expect(childLocalV2PinOperationsFixturePassed(value)).toBe(false);
  });
  it('requires exact counts and complete original terminal order rather than partial or whole-fixture summaries',()=>{
    for(const text of [success().replace('OK (9 tests)\n',''),success().replace('9 tests','8 tests'),success().replace('9 tests','48 tests'),success().replace('9 tests','09 tests'),
      success()+'OK (9 tests)\n',success().replace('INSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: 0'),success().replace('INSTRUMENTATION_CODE: -1\n',''),
      success()+'INSTRUMENTATION_CODE: -1\n',success().slice(0,-2),'OK (9 tests)\nINSTRUMENTATION_CODE: -1\n'+success(),
      success().replace('OK (9 tests)\nINSTRUMENTATION_CODE: -1','INSTRUMENTATION_CODE: -1\nOK (9 tests)'),
      success().replace('OK (9 tests)','INSTRUMENTATION_STATUS: class='+fixtureClass+'\nOK (9 tests)')])expect(childLocalV2PinOperationsFixturePassed(text)).toBe(false);
  });
  it('copies the exact selection before offline observations and dispatches only after all three pass',async()=>{
    const f=gateFixture(),args=[...childLocalV2PinOperationsFixtureArguments(runId)],expected=[...args];const pending=f.gate.command('child-local-v2-pin-operations',args,180000);args[7]=fixtureClass;await pending;
    expect(f.calls).toEqual([...readArgs,expected]);expect(f.records).toMatchObject([{checkpoint:'child-local-v2-pin-operations',status:'PASS'}]);
  });
  it('refuses whole class, interactive extras, changed method order and foreign metadata before any device access',async()=>{
    const patches=[[7,fixtureClass],[7,selection+','+fixtureClass+'#explicitFirstInstall'],[7,methods.map(name=>fixtureClass+'#'+name).reverse().join(',')],
      [7,selection.replace(methods[0],'foreignMethod')],[12,'literaryPinVerificationInputPhase'],[13,'input'],[13,'first-install-v2;'],[10,'A'.repeat(32)],[14,'foreign.test/androidx.test.runner.AndroidJUnitRunner']];
    for(const [index,value]of patches){const f=gateFixture(),args=[...childLocalV2PinOperationsFixtureArguments(runId)];args[index]=value;await expect(f.gate.command('local-v2-denied',args)).rejects.toThrow();expect(f.calls).toEqual([]);expect(f.records).toEqual([]);}
    const f=gateFixture();await expect(f.gate.command('local-v2-denied',[...childLocalV2PinOperationsFixtureArguments(runId),'-e','literaryFirstInstallInteractive','true'])).rejects.toThrow();expect(f.calls).toEqual([]);
  });
  it('leaves a connected target untouched and records only the failed offline observation',async()=>{
    const f=gateFixture(true);await expect(f.gate.command('child-local-v2-pin-operations',childLocalV2PinOperationsFixtureArguments(runId),180000)).rejects.toThrow(/not verifiably offline/u);
    expect(f.calls).toEqual(readArgs);expect(f.records).toMatchObject([{status:'FAIL',reason:'android-offline-state-unavailable'}]);
  });
  it('rejects mixed, non-Android, reboot and nonboolean selectors before command or output creation',async()=>{
    for(const options of [{platform:'android',pinVerificationInput:true,childLocalV2PinOperations:true},{platform:'ios',childLocalV2PinOperations:true},
      {platform:'android',childLocalV2PinOperations:true,reboot:true},{platform:'android',childLocalV2PinOperations:'true'}])
      await expect(runNativeInstallRuntime({rootDir:process.cwd(),...options})).rejects.toThrow(/selector|selection/u);
  });
  it('imports and performs selected default preflight without device commands or invented whole-fixture acceptance',async()=>{
    const root=await mkdtemp(path.join(tmpdir(),'literary-local-v2-pin-preflight-'));
    try{const report=await runNativeInstallRuntime({rootDir:root,platform:'android',childLocalV2PinOperations:true,runId,outDir:'.tmp/local-v2-preflight'});
      expect(report.kind).toBe('literary-planet-child-local-v2-pin-operations-runtime');expect(report.commands).toEqual([]);expect(report.installed).toBe(false);expect(report.releaseReady).toBe(false);
      expect(report.fixture).toMatchObject({tests:9,phase:'first-install-v2',noninteractive:true,wholeFixtureAcceptance:false,realOsOwnerUiAcceptance:false,nativeKeyspacePersistenceAcceptance:false,installedStorageAcceptance:false,parentGateAdmission:false});expect(report.fixture).not.toHaveProperty('enclosingClassCompiledTests');
      expect(report.fixture.methods).toEqual(methods);expect(report.fixture.selection).toBe(selection);expect(report.status).toBe('BLOCKED_EXTERNAL');
      const saved=JSON.parse(await readFile(path.join(root,'.tmp','local-v2-preflight','result.json'),'utf8'));expect(saved.commands).toEqual([]);expect(saved.fixture.wholeFixtureAcceptance).toBe(false);
    }finally{await rm(root,{recursive:true,force:true});}
  });
});
