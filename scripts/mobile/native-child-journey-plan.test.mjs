import {describe,expect,it} from 'vitest';
import {childLocalV2JourneyTestMethods,childLocalV2JourneyFixtureSource,verifyNativeChildLocalV2JourneyFixtureSource,
 childLocalV2JourneyFixtureArguments,childLocalV2JourneyFixturePassed} from './native-install-runtime.mjs';
const runId='a'.repeat(32),klass='ru.probpera.literaryplanet.PlanetChildJourneyRuntimeTest';
const packet=(name,code,index)=>`INSTRUMENTATION_STATUS: class=${klass}\nINSTRUMENTATION_STATUS: numtests=6\nINSTRUMENTATION_STATUS: test=${name}\nINSTRUMENTATION_STATUS: current=${index}\nINSTRUMENTATION_STATUS: id=AndroidJUnitRunner\nINSTRUMENTATION_STATUS: stream=${code===1?'':'.'}\nINSTRUMENTATION_STATUS_CODE: ${code}\n`;
const success=()=>childLocalV2JourneyTestMethods.map((name,index)=>packet(name,1,index+1)+packet(name,0,index+1)).join('')+'INSTRUMENTATION_RESULT: stream=\n\nOK (6 tests)\nINSTRUMENTATION_CODE: -1\n';
describe('owned child semantic journey native selector',()=>{
 it('selects six exact own methods with metadata and never a broad class or approval argument',()=>{
  expect(childLocalV2JourneyTestMethods).toHaveLength(6);const args=childLocalV2JourneyFixtureArguments(runId);
  expect(args[7]).toBe(childLocalV2JourneyTestMethods.map(name=>klass+'#'+name).join(','));expect(args.slice(8)).toEqual(['-e','literaryRunId',runId,'-e','literaryChildJourneyPhase','local-v2-child-journey','ru.probpera.literaryplanet.dev.test/androidx.test.runner.AndroidJUnitRunner']);
  expect(Object.isFrozen(args)).toBe(true);for(const bad of ['','a'.repeat(31),'A'.repeat(32),runId+';'])expect(()=>childLocalV2JourneyFixtureArguments(bad)).toThrow();
 });
 it('requires the unique source hash rather than a similarly named fixture or assumed prerequisite',()=>{
  const row={path:childLocalV2JourneyFixtureSource,sha256:'b'.repeat(64)};expect(verifyNativeChildLocalV2JourneyFixtureSource([row])).toBe(true);
  for(const rows of [[],[row,row],[{...row,sha256:'bad'}],[{...row,path:row.path.replace('Journey','Appearance')}]])expect(()=>verifyNativeChildLocalV2JourneyFixtureSource(rows)).toThrow();
 });
 it('accepts only complete correlated six-case packets in LF or CRLF',()=>{
  expect(childLocalV2JourneyFixturePassed(success())).toBe(true);expect(childLocalV2JourneyFixturePassed(success().replaceAll('\n','\r\n'))).toBe(true);
 });
 it('refuses skipped genuine prerequisites reused ordinals foreign methods incomplete and failed packets',()=>{
  const good=success();for(const raw of [good+'AssumptionViolatedException',good+'skipped',good.replace('numtests=6','numtests=7'),good.replace('current=2','current=1'),good.replace(childLocalV2JourneyTestMethods[0],'foreignMethod'),good.replace(packet(childLocalV2JourneyTestMethods[0],0,1),''),good.replace('OK (6 tests)','OK (5 tests)'),good+'FAILURES!!!'])expect(childLocalV2JourneyFixturePassed(raw)).toBe(false);
 });
});