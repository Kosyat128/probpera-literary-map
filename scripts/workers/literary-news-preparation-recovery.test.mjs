import {describe,expect,it,vi} from 'vitest';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
import {runNativeNewsPreparation} from './literary-news-preparation-worker.mjs';
import {acquireNewsPreparationLease,stageNewsPreparationCheckpoint,confirmNewsPreparationCheckpoint,
  stageNewsPreparationPublication,releaseNewsPreparationLease,readNewsPreparationPayload,
  NEWS_PREPARATION_FENCE_KEY,NEWS_PREPARATION_LEASE_MS,NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES} from '../lib/literary-news-preparation-fence.mjs';
import {emptyDailyLedger} from '../lib/literary-news-daily-automation.mjs';
import {DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_PROFILE_KEY,DAILY_NEWS_OWNER_KEY,
  dailyNewsDigest,makeDailyApprovedPayload} from '../lib/literary-news-daily-profile.mjs';

const at=new Date('2026-10-09T12:00:00Z');
const owner=JSON.stringify({schemaVersion:1,owner:'native',nativeEnabled:true,drained:false});
function storageFixture(){
  let values=new Map(),tail=Promise.resolve();const batches=[];
  return{batches,get:async key=>structuredClone(values.get(key)),async transaction(work){
    const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
    const draft=new Map(values);let count=0;
    try{const result=await work({get:async key=>structuredClone(draft.get(key)),put:async(key,value)=>{
      count++;if(value instanceof Uint8Array)expect(value.byteLength).toBeLessThanOrEqual(NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES);
      draft.set(key,structuredClone(value));}});expect(count).toBeLessThanOrEqual(32);batches.push(count);values=draft;return result;
    }finally{release();}
  }};
}
async function fixture(){
  const initial=emptyDailyLedger(at),storage=storageFixture(),values=new Map([
    [DAILY_NEWS_LEDGER_KEY,JSON.stringify(initial)],[DAILY_NEWS_OWNER_KEY,owner],
    [DAILY_NEWS_PROFILE_KEY,JSON.stringify(await makeDailyApprovedPayload([],at))]
  ]),events=[];
  const env={NEWS_AUTOMATION_ENABLED:'true',NEWS_AUTOMATION_WRITER:'native',NEWS_AUTOMATION_BOOTSTRAP:'true',AI:{run:vi.fn()},
    NEWS_STATE:{get:vi.fn(async key=>values.get(key)??null),put:vi.fn(async(key,value)=>{
      const text=value instanceof ReadableStream?await new Response(value).text():value;events.push(['put',key,text]);values.set(key,text);
    })}};
  const collect=vi.fn(async()=>{events.push(['collect']);return{details:[]};});
  const execute=vi.fn(async({previous,current})=>{events.push(['execute']);return{state:previous,
    profile:await makeDailyApprovedPayload(previous.accepted,current),report:{status:'supply_degraded'}};});
  const run=extra=>runNativeNewsPreparation(env,storage,{now:()=>at,collect,execute,waitImpl:async()=>{},...extra});
  await acquireNewsPreparationLease(storage,{ledgerSha:await dailyNewsDigest(initial),profileSha:await dailyNewsDigest(JSON.parse(values.get(DAILY_NEWS_PROFILE_KEY))),
    current:at.getTime(),bootstrap:true,leaseId:'seed'});
  await releaseNewsPreparationLease(storage,'seed');
  return{storage,values,events,env,initial,collect,execute,run};
}
async function stageLedger(f,{payload=true,release=true}={}){
  const state={...f.initial,inferenceBudgets:[{day:'2026-10-09',reservedCalls:8,draftRequests:4}]},sha=await dailyNewsDigest(state);
  await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'crashed'});
  await stageNewsPreparationCheckpoint(f.storage,{leaseId:'crashed',ledgerSha:sha,...(payload?{payload:state}:{}),current:at.getTime()});
  if(release)await releaseNewsPreparationLease(f.storage,'crashed');return{state,sha};
}
const control=f=>f.storage.get(NEWS_PREPARATION_FENCE_KEY);
const changedBudget=previous=>({...previous,inferenceBudgets:[{day:'2026-10-09',reservedCalls:12,draftRequests:6}]});

describe('Exact durable preparation payload recovery',()=>{
  it('recovers a crash after stage and before PUT, before any intake or inference',async()=>{
    const f=await fixture(),{state,sha}=await stageLedger(f);
    expect((await f.run()).publicationConfirmed).toBe(true);
    expect(f.events[0]).toEqual(['put',DAILY_NEWS_LEDGER_KEY,JSON.stringify(state)]);
    expect(f.execute.mock.calls[0][0].previous.inferenceBudgets).toEqual(state.inferenceBudgets);
    expect(await control(f)).toMatchObject({expectedLedgerSha:sha,pendingLedgerSha:null,pendingProfileSha:null,lease:null});
    expect(f.env.AI.run).not.toHaveBeenCalled();
  });
  it.each([false,true])('replays the exact ledger after failed PUT (remote accepted=%s), including a stale read',async accepted=>{
    const f=await fixture(),originalPut=f.env.NEWS_STATE.put.getMockImplementation();let stagedText=null,failOnce=true;
    f.env.NEWS_STATE.put.mockImplementation(async(key,value)=>{
      if(key===DAILY_NEWS_LEDGER_KEY&&failOnce){failOnce=false;stagedText=await new Response(value).text();
        if(accepted)f.values.set(key,stagedText);throw Error('lost_write_response');}
      return originalPut(key,value);
    });
    const execute=async({previous,saveCheckpoint,current})=>{const state=changedBudget(previous);await saveCheckpoint(state);
      return{state,profile:await makeDailyApprovedPayload([],current),report:{status:'supply_degraded'}};};
    await expect(f.run({execute})).rejects.toThrow('lost_write_response');
    const sha=(await control(f)).pendingLedgerSha;expect(sha).toBe(await dailyNewsDigest(JSON.parse(stagedText)));
    if(accepted)f.env.NEWS_STATE.get.mockImplementation(async key=>key===DAILY_NEWS_LEDGER_KEY?JSON.stringify(f.initial):f.values.get(key)??null);
    f.events.length=0;await f.run();
    expect(f.events[0]).toEqual(['put',DAILY_NEWS_LEDGER_KEY,stagedText]);
    expect(f.execute.mock.calls[0][0].previous.inferenceBudgets[0]).toEqual({day:'2026-10-09',reservedCalls:12,draftRequests:6});
    expect((await control(f)).pendingLedgerSha).toBeNull();
  });
  it('does not replay an already visible write when only confirmation was lost',async()=>{
    const f=await fixture(),{state}=await stageLedger(f);f.values.set(DAILY_NEWS_LEDGER_KEY,JSON.stringify(state));
    await f.run();expect(f.env.NEWS_STATE.put.mock.calls.filter(([key])=>key===DAILY_NEWS_LEDGER_KEY)).toHaveLength(0);
    expect(f.execute.mock.calls[0][0].previous.inferenceBudgets).toEqual(state.inferenceBudgets);
  });
  it('keeps the same staged payload through repeated recovery PUT failures',async()=>{
    const f=await fixture(),{sha}=await stageLedger(f),saved=await control(f),originalPut=f.env.NEWS_STATE.put.getMockImplementation();
    f.env.NEWS_STATE.put.mockImplementation(async(key,value)=>{if(key===DAILY_NEWS_LEDGER_KEY)throw Error('offline');return originalPut(key,value);});
    await expect(f.run()).rejects.toThrow('offline');await expect(f.run()).rejects.toThrow('offline');
    expect(await control(f)).toMatchObject({pendingLedgerSha:sha,pendingLedgerPayload:saved.pendingLedgerPayload,lease:null});
    expect(f.collect).not.toHaveBeenCalled();expect(f.execute).not.toHaveBeenCalled();
    f.env.NEWS_STATE.put.mockImplementation(originalPut);expect((await f.run()).publicationConfirmed).toBe(true);
  });
  it('never resets an unknown legacy ledger checkpoint, even with bootstrap and an expired lease',async()=>{
    const f=await fixture();await stageLedger(f,{payload:false,release:false});const saved=await control(f);
    await expect(f.run({now:()=>new Date(at.getTime()+NEWS_PREPARATION_LEASE_MS+1)})).rejects.toThrow('daily_preparation_checkpoint_visibility_pending');
    expect(await control(f)).toEqual(saved);expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();expect(f.collect).not.toHaveBeenCalled();
  });
  it('rejects unrelated ledger history even if an exact staged payload is present',async()=>{
    const f=await fixture();await stageLedger(f);f.values.set(DAILY_NEWS_LEDGER_KEY,JSON.stringify(changedBudget(f.initial)));
    await expect(f.run()).rejects.toThrow('daily_preparation_ledger_hash_mismatch');expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();
  });
  it('replays a durable profile before publishing new content, retaining its original generatedAt',async()=>{
    const f=await fixture(),profile=await makeDailyApprovedPayload([],at),sha=await dailyNewsDigest(profile);
    await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'crashed'});
    await stageNewsPreparationPublication(f.storage,{leaseId:'crashed',ledgerSha:await dailyNewsDigest(f.initial),profileSha:sha,payload:profile,current:at.getTime()});
    await releaseNewsPreparationLease(f.storage,'crashed');f.values.delete(DAILY_NEWS_PROFILE_KEY);
    await f.run({now:()=>new Date(at.getTime()+30*60000)});
    expect(f.events[0]).toEqual(['put',DAILY_NEWS_PROFILE_KEY,JSON.stringify(profile)]);
    expect((await control(f)).pendingProfileSha).toBeNull();
  });
  it.each([true,false])('recovers a legacy profile only if the validated ledger reproduces its exact digest (match=%s)',async match=>{
    const f=await fixture(),profile=await makeDailyApprovedPayload([],new Date(at.getTime()-(match?0:1000)));
    await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'crashed'});
    await stageNewsPreparationPublication(f.storage,{leaseId:'crashed',ledgerSha:await dailyNewsDigest(f.initial),profileSha:await dailyNewsDigest(profile),current:at.getTime()});
    await releaseNewsPreparationLease(f.storage,'crashed');f.values.delete(DAILY_NEWS_PROFILE_KEY);
    if(match){await f.run();expect(f.events[0]).toEqual(['put',DAILY_NEWS_PROFILE_KEY,JSON.stringify(profile)]);}
    else{const saved=await control(f);await expect(f.run()).rejects.toThrow('daily_preparation_profile_visibility_pending');
      expect(await control(f)).toEqual(saved);expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();expect(f.collect).not.toHaveBeenCalled();}
  });
  it.each(['missing','changed'])('refuses a %s durable payload chunk without writing or inferring',async corruption=>{
    const f=await fixture();await stageLedger(f);const key='daily-preparation-payload-v1:ledger:0';
    await f.storage.transaction(async tx=>{const chunk=await tx.get(key);if(corruption==='changed')chunk[chunk.length-2]^=1;
      await tx.put(key,corruption==='missing'?null:chunk);});
    await expect(f.run()).rejects.toThrow(corruption==='missing'?'daily_preparation_payload_invalid':'daily_preparation_payload_hash_mismatch');
    expect(f.env.NEWS_STATE.put).not.toHaveBeenCalled();expect(f.collect).not.toHaveBeenCalled();expect((await control(f)).pendingLedgerSha).not.toBeNull();
  });
  it('rejects false payload digests before granting the staged intent recovery authority',async()=>{
    const f=await fixture();await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'new'});
    await expect(stageNewsPreparationCheckpoint(f.storage,{leaseId:'new',ledgerSha:'a'.repeat(64),payload:changedBudget(f.initial),current:at.getTime()}))
      .rejects.toThrow('daily_preparation_payload_hash_mismatch');
    expect(await control(f)).toMatchObject({pendingLedgerSha:null});
  });
  it('persists and verifies multi-transaction Unicode payloads with bounded values and batch sizes',async()=>{
    const f=await fixture(),payload={accepted:[],text:'Ж😀'.repeat(380000)},sha=await dailyNewsDigest(payload);
    await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'large'});
    await stageNewsPreparationCheckpoint(f.storage,{leaseId:'large',ledgerSha:sha,payload,current:at.getTime()});
    const manifest=(await control(f)).pendingLedgerPayload;expect(manifest.chunks).toBeGreaterThan(32);expect(f.storage.batches).toContain(32);
    const stream=await readNewsPreparationPayload(f.storage,{leaseId:'large',kind:'ledger',sha256:sha,current:at.getTime()});
    expect(await new Response(stream).text()).toBe(JSON.stringify(payload));
  });
  it('does not treat an incomplete durable upload as a staged checkpoint after restart',async()=>{
    const f=await fixture(),transaction=f.storage.transaction.bind(f.storage);let failControl=false;
    f.storage.transaction=work=>transaction(tx=>work({...tx,put:async(key,value)=>{
      if(failControl&&key===NEWS_PREPARATION_FENCE_KEY&&value.pendingLedgerSha)throw Error('crash_before_manifest');return tx.put(key,value);
    }}));
    await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'crashed'});failControl=true;
    await expect(stageNewsPreparationCheckpoint(f.storage,{leaseId:'crashed',ledgerSha:await dailyNewsDigest(changedBudget(f.initial)),payload:changedBudget(f.initial),current:at.getTime()}))
      .rejects.toThrow('crash_before_manifest');
    expect((await control(f)).pendingLedgerSha).toBeNull();failControl=false;await releaseNewsPreparationLease(f.storage,'crashed');
    await f.run();expect(f.execute.mock.calls[0][0].previous.inferenceBudgets).toEqual([]);
  });
  it('rejects an expired uploader before it can overwrite replacement payload chunks',async()=>{
    const f=await fixture();await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime(),leaseId:'old'});
    await acquireNewsPreparationLease(f.storage,{ledgerSha:await dailyNewsDigest(f.initial),current:at.getTime()+NEWS_PREPARATION_LEASE_MS,leaseId:'new'});
    const payload=changedBudget(f.initial),sha=await dailyNewsDigest(payload);
    await stageNewsPreparationCheckpoint(f.storage,{leaseId:'new',ledgerSha:sha,payload,current:at.getTime()+NEWS_PREPARATION_LEASE_MS});
    const chunk=await f.storage.get('daily-preparation-payload-v1:ledger:0');
    await expect(stageNewsPreparationCheckpoint(f.storage,{leaseId:'old',ledgerSha:await dailyNewsDigest(f.initial),payload:f.initial,current:at.getTime()}))
      .rejects.toThrow('daily_preparation_lease_lost');
    expect(await f.storage.get('daily-preparation-payload-v1:ledger:0')).toEqual(chunk);
    await expect(confirmNewsPreparationCheckpoint(f.storage,{leaseId:'old',ledgerSha:sha,current:at.getTime()})).rejects.toThrow('daily_preparation_lease_lost');
  });
});

describe('Preparation live-writer exclusion across lease expiry',()=>{
  it('does not overlap a delayed PUT with recovery after its lease expires',async()=>{
    const f=await fixture(),originalPut=f.env.NEWS_STATE.put.getMockImplementation();let clock=at,unblock,started;
    const waiting=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{unblock=resolve;});
    f.env.NEWS_STATE.put.mockImplementation(async(key,value)=>{if(key===DAILY_NEWS_LEDGER_KEY){started();await gate;}return originalPut(key,value);});
    const execute=async({previous,saveCheckpoint})=>{await saveCheckpoint(changedBudget(previous));throw Error('must_not_continue');};
    const first=f.run({execute,now:()=>clock}),observed=expect(first).rejects.toThrow('daily_preparation_lease_lost');await waiting;
    clock=new Date(at.getTime()+NEWS_PREPARATION_LEASE_MS+1);
    expect(await f.run({now:()=>clock})).toMatchObject({status:'busy',reason:'daily_preparation_busy'});
    expect(f.env.NEWS_STATE.put).toHaveBeenCalledTimes(1);unblock();await observed;
    f.env.NEWS_STATE.put.mockImplementation(originalPut);expect((await f.run({now:()=>clock})).publicationConfirmed).toBe(true);
    expect(f.execute.mock.calls[0][0].previous.inferenceBudgets[0].reservedCalls).toBe(12);
  });
  it('rechecks the lease after throttling and never starts an expired old PUT',async()=>{
    const f=await fixture();let clock=at,unblock,started;
    const waiting=new Promise(resolve=>{started=resolve;}),gate=new Promise(resolve=>{unblock=resolve;});
    const execute=async({previous,saveCheckpoint})=>{
      await saveCheckpoint(changedBudget(previous));await saveCheckpoint({...changedBudget(previous),inferenceBudgets:[{day:'2026-10-09',reservedCalls:14,draftRequests:7}]});
      throw Error('must_not_continue');
    };
    const first=f.run({execute,now:()=>clock,waitImpl:async()=>{started();await gate;}}),observed=expect(first).rejects.toThrow('daily_preparation_lease_lost');await waiting;
    clock=new Date(at.getTime()+NEWS_PREPARATION_LEASE_MS+1);
    expect((await f.run({now:()=>clock})).status).toBe('busy');unblock();await observed;
    expect(f.env.NEWS_STATE.put.mock.calls.filter(([key])=>key===DAILY_NEWS_LEDGER_KEY)).toHaveLength(1);
    await f.run({now:()=>clock});expect(f.execute.mock.calls[0][0].previous.inferenceBudgets[0].reservedCalls).toBe(14);
  });
});

describe('Preparation recovery in the actual Workers durable storage runtime',()=>{
  it.each([true,false])('replays staged chunks through real DO transactions and KV (SQLite=%s)',async useSQLite=>{
    const built=await build({stdin:{resolveDir:fileURLToPath(new URL('.',import.meta.url)),contents:`
      import {runNativeNewsPreparation} from './literary-news-preparation-worker.mjs';
      import {acquireNewsPreparationLease,stageNewsPreparationCheckpoint,releaseNewsPreparationLease,NEWS_PREPARATION_FENCE_KEY}
        from '../lib/literary-news-preparation-fence.mjs';
      import {emptyDailyLedger} from '../lib/literary-news-daily-automation.mjs';
      import {DAILY_NEWS_LEDGER_KEY,DAILY_NEWS_OWNER_KEY,dailyNewsDigest,makeDailyApprovedPayload} from '../lib/literary-news-daily-profile.mjs';
      const at=new Date('${at.toISOString()}');
      export class PreparationFixture{
        constructor(state,env){this.storage=state.storage;this.env=env;}
        async fetch(request){
          if(new URL(request.url).pathname==='/stage'){
            const initial=emptyDailyLedger(at),state={...initial,inferenceBudgets:[{day:'2026-10-09',reservedCalls:8,draftRequests:4}],padding:'Ж'.repeat(70000)};
            await this.env.NEWS_STATE.put(DAILY_NEWS_LEDGER_KEY,JSON.stringify(initial));
            await this.env.NEWS_STATE.put(DAILY_NEWS_OWNER_KEY,JSON.stringify({schemaVersion:1,owner:'native',nativeEnabled:true,drained:false}));
            const lease=await acquireNewsPreparationLease(this.storage,{ledgerSha:await dailyNewsDigest(initial),current:at.getTime(),bootstrap:true});
            await stageNewsPreparationCheckpoint(this.storage,{leaseId:lease.leaseId,ledgerSha:await dailyNewsDigest(state),payload:state,current:at.getTime()});
            await releaseNewsPreparationLease(this.storage,lease.leaseId);
            return Response.json(await this.storage.get(NEWS_PREPARATION_FENCE_KEY));
          }
          const report=await runNativeNewsPreparation({...this.env,NEWS_AUTOMATION_ENABLED:'true',NEWS_AUTOMATION_WRITER:'native',NEWS_AUTOMATION_BOOTSTRAP:'true',
            AI:{run:async()=>{throw Error('unexpected_inference');}}},this.storage,{now:()=>at,collect:async()=>({details:[]}),waitImpl:async()=>{},
            execute:async({previous})=>({state:previous,profile:await makeDailyApprovedPayload(previous.accepted,at),report:{status:'supply_degraded'}})});
          const ledger=JSON.parse(await this.env.NEWS_STATE.get(DAILY_NEWS_LEDGER_KEY));
          return Response.json({report,control:await this.storage.get(NEWS_PREPARATION_FENCE_KEY),ledgerSha:await dailyNewsDigest(ledger),budgets:ledger.inferenceBudgets});
        }
      }
      export default{fetch:(request,env)=>env.FIXTURE.get(env.FIXTURE.idFromName('daily-news-preparation')).fetch(request)};
    `},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',external:['node:*'],logLevel:'silent'});
    const runtime=new Miniflare(convertV4MiniflareOptions({name:'isolated-news-preparation-recovery',modules:true,script:built.outputFiles[0].text,
      compatibilityDate:'2026-08-18',compatibilityFlags:['nodejs_compat'],cf:false,log:new Log(LogLevel.NONE),logRequests:false,
      kvNamespaces:['NEWS_STATE'],durableObjects:{FIXTURE:{className:'PreparationFixture',useSQLite}},
      outboundService:async()=>{throw Error('unexpected_outbound_request');}}));
    try{
      const staged=await (await runtime.dispatchFetch('https://fixture.internal/stage')).json();
      expect(staged.pendingLedgerPayload.chunks).toBeGreaterThan(1);
      const recovered=await (await runtime.dispatchFetch('https://fixture.internal/recover')).json();
      expect(recovered.report.publicationConfirmed).toBe(true);expect(recovered.ledgerSha).toBe(staged.pendingLedgerSha);
      expect(recovered.budgets).toEqual([{day:'2026-10-09',reservedCalls:8,draftRequests:4}]);
      expect(recovered.control).toMatchObject({lease:null,pendingLedgerSha:null,pendingProfileSha:null});
    }finally{await runtime.dispose();}
  },15000);
});
