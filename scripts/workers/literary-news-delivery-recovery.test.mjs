import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import worker, { scheduleNativeNewsDelivery } from './literary-news-delivery-worker.mjs';

function fixture({time='2026-10-09T13:25:00Z',recover=async()=>Response.json({status:'supply_degraded',publicationConfirmed:true}),
  dispatch=null,capture={status:'capture_not_due',deliveredThisRun:0}}={}) {
  const events=[],report={status:'daily_target_deficit',deliveredThisRun:1},controller={noRetry:vi.fn(),scheduledTime:0},log=vi.fn();
  let current=new Date(time);
  const delivery={fetch:vi.fn(async url=>{
    const phase=new URL(url).pathname.slice(1);events.push(phase);
    return phase==='capture'?Response.json(capture):dispatch?dispatch():Response.json(report);
  })};
  const recovery={fetch:vi.fn(async(...args)=>{events.push('recover');return recover(...args);})};
  const binding=stub=>({idFromName:vi.fn(name=>name),get:vi.fn(()=>stub)});
  const env={NEWS_DELIVERY_ENABLED:'true',DELIVERY_COORDINATOR:binding(delivery),NEWS_PREPARATION_RECOVERY:binding(recovery)};
  const run=()=>scheduleNativeNewsDelivery(controller,env,{log,now:()=>current});
  return {run,env,events,report,controller,log,delivery,recovery,setTime:value=>{current=new Date(value);}};
}

describe('private preparation recovery after native delivery',()=>{
  it.each([
    ['13:24:59.999',false],['13:25:00.000',true],['13:29:59.999',true],['13:30:00.000',false],
    ['13:54:59.999',false],['13:55:00.000',true],['13:59:59.999',true],['14:00:00.000',false],
  ])('uses actual UTC time after delivery at %s (due=%s)',async(time,due)=>{
    const f=fixture({time:`2026-10-09T${time}Z`});
    // A stale controller timestamp must never select the recovery window.
    f.controller.scheduledTime=Date.parse('2026-10-09T13:25:00Z');
    expect(await f.run()).toEqual(f.report);
    expect(f.events).toEqual(due?['capture','dispatch','recover']:['capture','dispatch']);
    expect(f.controller.noRetry).not.toHaveBeenCalled();
    if(due){
      expect(f.env.NEWS_PREPARATION_RECOVERY.idFromName).toHaveBeenCalledExactlyOnceWith('daily-news-preparation');
      expect(f.env.NEWS_PREPARATION_RECOVERY.get).toHaveBeenCalledExactlyOnceWith('daily-news-preparation');
      expect(f.recovery.fetch).toHaveBeenCalledExactlyOnceWith('https://coordinator.internal/recover',
        {method:'POST',signal:expect.any(AbortSignal)});
    }
  });
  it('waits for dispatch completion before checking the actual recovery time',async()=>{
    let finishDispatch;
    const finished=new Promise(resolve=>{finishDispatch=resolve;});
    const f=fixture({time:'2026-10-09T13:24:59Z',dispatch:async()=>{await finished;return Response.json(f.report);}});
    const running=f.run();
    await vi.waitFor(()=>expect(f.events).toEqual(['capture','dispatch']));
    expect(f.recovery.fetch).not.toHaveBeenCalled();
    f.setTime('2026-10-09T13:25:01Z');finishDispatch();
    expect(await running).toEqual(f.report);expect(f.events).toEqual(['capture','dispatch','recover']);
  });
  it('does not recover when a delivery starting in the window finishes outside it',async()=>{
    const f=fixture({dispatch:async()=>{f.setTime('2026-10-09T13:30:00Z');return Response.json(f.report);}});
    expect(await f.run()).toEqual(f.report);expect(f.recovery.fetch).not.toHaveBeenCalled();
  });
  it.each(['older-worker-404','service-503','throw','invalid-json','unknown-status','oversized-report'])(
    'isolates %s without another delivery call, retry or private error log',async failure=>{
      const f=fixture({recover:async()=>{
        if(failure==='throw')throw Error('PRIVATE secret error');
        if(failure==='older-worker-404')return new Response(null,{status:404});
        if(failure==='service-503')return new Response('PRIVATE secret body',{status:503});
        if(failure==='invalid-json')return new Response('PRIVATE invalid JSON');
        if(failure==='unknown-status')return Response.json({status:'PRIVATE',publicationConfirmed:true});
        return Response.json({status:'target_met',details:'PRIVATE'.repeat(12000)});
      }});
      expect(await f.run()).toEqual(f.report);expect(f.delivery.fetch).toHaveBeenCalledTimes(2);
      expect(f.recovery.fetch).toHaveBeenCalledOnce();expect(f.controller.noRetry).not.toHaveBeenCalled();
      expect(JSON.parse(f.log.mock.calls.at(-1)[0])).toMatchObject({component:'literary-news-preparation-recovery',status:'unavailable'});
      expect(JSON.stringify(f.log.mock.calls)).not.toContain('PRIVATE');
    });
  it('retains an ordinary blocked capture result and its retry decision',async()=>{
    const capture={status:'blocked',code:'delivery_public_feed_unavailable',deliveredThisRun:0};
    const f=fixture({capture,recover:async()=>{throw Error('recovery unavailable');}});
    expect(await f.run()).toEqual(capture);expect(f.events).toEqual(['capture','recover']);
    expect(f.controller.noRetry).toHaveBeenCalledOnce();
  });
  it('preserves an original delivery error when recovery also fails',async()=>{
    const error=Error('original delivery failure');
    const f=fixture({dispatch:async()=>{throw error;},recover:async()=>{throw Error('PRIVATE recovery failure');}});
    await expect(f.run()).rejects.toBe(error);expect(f.events).toEqual(['capture','dispatch','recover']);
    expect(f.delivery.fetch).toHaveBeenCalledTimes(2);expect(JSON.stringify(f.log.mock.calls)).not.toContain('PRIVATE');
  });
  it('disabled delivery and a missing optional recovery binding perform no recovery work',async()=>{
    const f=fixture();f.env.NEWS_DELIVERY_ENABLED='false';
    expect(await f.run()).toBeUndefined();expect(f.delivery.fetch).not.toHaveBeenCalled();expect(f.recovery.fetch).not.toHaveBeenCalled();
    f.env.NEWS_DELIVERY_ENABLED='true';delete f.env.NEWS_PREPARATION_RECOVERY;
    expect(await f.run()).toEqual(f.report);expect(f.recovery.fetch).not.toHaveBeenCalled();
  });
  it('keeps every public recovery and delivery URL unavailable',async()=>{
    const f=fixture();
    for(const method of ['GET','POST'])for(const path of ['/recover','/run','/capture','/dispatch']){
      const response=await worker.fetch(new Request('https://public.example'+path,{method}),f.env);
      expect(response.status).toBe(404);
    }
    expect(f.delivery.fetch).not.toHaveBeenCalled();expect(f.recovery.fetch).not.toHaveBeenCalled();
  });
  it('binds the existing preparation class without adding a new namespace, public route or AI credential',async()=>{
    const config=JSON.parse(await readFile(new URL('../wrangler.literary-news-delivery.jsonc',import.meta.url),'utf8'));
    expect(config.durable_objects.bindings).toEqual([
      {name:'DELIVERY_COORDINATOR',class_name:'LiteraryNewsDeliveryCoordinator'},
      {name:'NEWS_PREPARATION_RECOVERY',class_name:'DailyNewsPreparationCoordinator',script_name:'probpera-literary-news-preparation'},
    ]);
    expect(config.migrations).toEqual([{tag:'v1',new_sqlite_classes:['LiteraryNewsDeliveryCoordinator']}]);
    expect(config.workers_dev).toBe(false);expect(config.preview_urls).toBe(false);expect(config.routes).toBeUndefined();
    expect(config.ai).toBeUndefined();expect(config.vars).toEqual({NEWS_DELIVERY_ENABLED:'false'});
  });
});
