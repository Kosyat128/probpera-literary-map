import {describe,expect,it,vi} from 'vitest';
import {captureChangedNativeNews,planNewsCapture,completedNewsCaptureProgress,NEWS_CAPTURE_PROGRESS_KEY} from '../lib/literary-news-capture-progress.mjs';
import {scheduleNextNativeNewsAlarm,LiteraryNewsDeliveryCoordinator} from './literary-news-delivery-worker.mjs';
const current=new Date('2026-10-09T13:25:00Z');
const item=id=>({id,kind:'news',eventDate:'2026-10-09',publishedAt:current.toISOString(),verifiedAt:current.toISOString(),
  title:{ru:id,en:id},summary:{ru:'Описание',en:'Description'},source:{name:'Fixture',url:'https://fixture.example/'+id,language:'en'}});

describe('durable changed-item admission cursor',()=>{
  it('does not let four invalid newest records starve valid tail records and retries failed records later',async()=>{
    const feed={items:Array.from({length:8},(_,i)=>item('record-'+i))};
    const first=await planNewsCapture(feed,current);
    const progress=completedNewsCaptureProgress(first,[],current,first.ids);
    const at=new Date(current.getTime()+300000),second=await planNewsCapture(feed,at,progress);
    expect(second.ids).toEqual(['record-4','record-5','record-6','record-7']);
    const done=completedNewsCaptureProgress(second,second.ids,at);
    expect((await planNewsCapture(feed,new Date(current.getTime()+600000),done)).ids).toEqual([]);
    expect((await planNewsCapture(feed,new Date(current.getTime()+1800000),done)).ids).toEqual(first.ids);
    feed.items[0].summary.ru='Исправлено';
    expect((await planNewsCapture(feed,new Date(current.getTime()+600000),done)).ids).toEqual(['record-0']);
  });
  it('does not trust a future captured timestamp to hide an eligible current item',async()=>{
    const feed={items:[item('first')]},plan=await planNewsCapture(feed,current);
    const progress=completedNewsCaptureProgress(plan,plan.ids,new Date(current.getTime()+86400000));
    expect((await planNewsCapture(feed,current,progress)).ids).toEqual(['first']);
  });
  it('captures all 24 within six five-minute ticks and gives fresh arrivals priority immediately',async()=>{
    const feed={items:Array.from({length:24},(_,i)=>item('old-'+i))};let progress;
    const captured=new Set();
    for(let tick=0;tick<6;tick++){
      const at=new Date(current.getTime()+tick*300000),plan=await planNewsCapture(feed,at,progress);
      expect(plan.ids).toHaveLength(4);plan.ids.forEach(id=>captured.add(id));
      progress=completedNewsCaptureProgress(plan,plan.ids,at);
    }
    expect(captured.size).toBe(24);
    expect((await planNewsCapture(feed,new Date(current.getTime()+30*60000),progress)).ids).toEqual([]);
    feed.items.unshift({...item('brand-new'),publishedAt:new Date(current.getTime()+31*60000).toISOString()});
    const next=await planNewsCapture(feed,new Date(current.getTime()+32*60000),progress);
    expect(next.ids).toEqual(['brand-new']);
    expect(completedNewsCaptureProgress(next,next.ids,current).entries).toHaveLength(24);
  });
  it('captures a real correction, renewed verification and photo changes rather than every regenerated feed',async()=>{
    const feed={items:[item('first')]};const plan=await planNewsCapture(feed,current);
    const progress=completedNewsCaptureProgress(plan,plan.ids,current);
    expect((await planNewsCapture({...feed,generatedAt:new Date(current.getTime()+300000).toISOString()},current,progress)).ids).toEqual([]);
    for(const change of [{summary:{ru:'Уточнение',en:'Correction'}},{verifiedAt:'2026-10-09T13:26:00Z'},{thumbnail:{id:'photo'}}])
      expect((await planNewsCapture({items:[{...feed.items[0],...change}]},new Date(current.getTime()+300000),progress)).ids).toEqual(['first']);
  });
  it('refreshes oldest captured items after an hour and never advances on unsuccessful capture',async()=>{
    const feed={items:[item('first')]},plan=await planNewsCapture(feed,current);
    const progress=completedNewsCaptureProgress(plan,plan.ids,current);
    expect((await planNewsCapture(feed,new Date(current.getTime()+3600000),progress)).ids).toEqual(['first']);
    const storage={get:vi.fn(async()=>progress),put:vi.fn()},capture=vi.fn(async()=>({status:'blocked'}));
    expect(await captureChangedNativeNews({storage,capture})).toEqual({status:'blocked'});
    expect(storage.put).not.toHaveBeenCalled();
    const options=capture.mock.calls[0][0];await options.saveCaptureProgress(progress);
    expect(storage.put).toHaveBeenCalledExactlyOnceWith(NEWS_CAPTURE_PROGRESS_KEY,progress);
  });
  it.each([{schemaVersion:2,entries:[]},{schemaVersion:1,entries:[{id:'a',revision:'bad',capturedAt:current.toISOString()}]}])
    ('rebuilds malformed optimization cursor through the original guarded capture',async progress=>{
      const capture=vi.fn(async()=>({status:'admissions_captured'}));
      expect(await captureChangedNativeNews({storage:{get:async()=>progress},capture})).toEqual({status:'admissions_captured'});
      expect(capture.mock.calls[0][0].captureProgress).toEqual({schemaVersion:1,entries:[]});
    });
});

describe('durable timer supplements Cron through the same dispatch fence',()=>{
  const env={NEWS_DELIVERY_ENABLED:'true'};
  const storage=()=>({setAlarm:vi.fn(),deleteAlarm:vi.fn()});
  it('uses the advised next receipt eligibility to avoid rounding to another Cron tick',async()=>{
    const s=storage(),next='2026-10-09T15:10:29.592Z';
    await scheduleNextNativeNewsAlarm(s,env,{status:'daily_target_deficit',nextDispatchAt:next},current);
    expect(s.setAlarm).toHaveBeenCalledExactlyOnceWith(Date.parse(next));
  });
  it('backs off failed reads by five minutes and rolls closed hours to the next Moscow opening',async()=>{
    const s=storage();await scheduleNextNativeNewsAlarm(s,env,{status:'blocked'},current);
    expect(s.setAlarm).toHaveBeenLastCalledWith(current.getTime()+300000);
    await scheduleNextNativeNewsAlarm(s,env,{status:'daily_target_deficit',nextDispatchAt:'2026-10-09T20:05:00Z'},current);
    expect(s.setAlarm).toHaveBeenLastCalledWith(Date.parse('2026-10-10T05:00:00Z'));
    await scheduleNextNativeNewsAlarm(s,env,{status:'outside_publication_hours'},new Date('2026-10-09T21:00:00Z'));
    expect(s.setAlarm).toHaveBeenLastCalledWith(Date.parse('2026-10-10T05:00:00Z'));
  });
  it.each(['disabled','outside_authorized_window','destination_not_enabled_or_history_gap','dispatch_reconciliation_required'])
    ('does not arm automatic dispatch for %s',async status=>{
      const s=storage();await scheduleNextNativeNewsAlarm(s,env,{status},current);
      expect(s.setAlarm).not.toHaveBeenCalled();expect(s.deleteAlarm).toHaveBeenCalledOnce();
    });
  it('routes an alarm through the exact private dispatch method without any public dispatch capability',async()=>{
    const coordinator=new LiteraryNewsDeliveryCoordinator({storage:storage()},{});
    coordinator.dispatch=vi.fn(async()=>({status:'disabled'}));await coordinator.alarm({retryCount:3});
    expect(coordinator.dispatch).toHaveBeenCalledOnce();
    expect((await coordinator.fetch(new Request('https://internal/alarm',{method:'POST'}))).status).toBe(404);
  });
  it('coalesces concurrent Cron and alarm dispatch until timer persistence finishes',async()=>{
    let finish;
    const gate=new Promise(resolve=>{finish=resolve;});
    const s={setAlarm:vi.fn(),deleteAlarm:vi.fn(async()=>gate)};
    const coordinator=new LiteraryNewsDeliveryCoordinator({storage:s},{});
    const first=coordinator.dispatch(),second=coordinator.dispatch();
    await vi.waitFor(()=>expect(s.deleteAlarm).toHaveBeenCalledOnce());
    finish();expect(await first).toMatchObject({status:'disabled'});expect(await second).toMatchObject({status:'disabled'});
    expect(s.deleteAlarm).toHaveBeenCalledOnce();
    await coordinator.dispatch();expect(s.deleteAlarm).toHaveBeenCalledTimes(2);
  });
  it('exposes a safe retry when alarm persistence fails, retaining the same provider receipt guard on retry',async()=>{
    const coordinator=new LiteraryNewsDeliveryCoordinator({storage:storage()},{});
    coordinator.dispatch=vi.fn(async()=>{throw Error('PRIVATE storage diagnostic');});
    await expect(coordinator.alarm()).rejects.toThrow('delivery_alarm_retry_required');
    expect(coordinator.dispatch).toHaveBeenCalledOnce();
  });
});
