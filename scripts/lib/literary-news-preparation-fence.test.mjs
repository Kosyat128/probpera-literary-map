import {describe,expect,it} from 'vitest';
import {acquireNewsPreparationLease,stageNewsPreparationCheckpoint,confirmNewsPreparationCheckpoint,
  stageNewsPreparationPublication,confirmNewsPreparationPublication,
  releaseNewsPreparationLease,NEWS_PREPARATION_FENCE_KEY,NEWS_PREPARATION_LEASE_MS} from './literary-news-preparation-fence.mjs';

// Transactions serialize and roll back on error, matching the DO storage boundary.
export function transactionalFixture(seed=[]){
  let values=new Map(seed.map(([key,value])=>[key,structuredClone(value)])),tail=Promise.resolve();
  return{get:async key=>structuredClone(values.get(key)),async transaction(work){
    const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
    const draft=new Map([...values].map(([key,value])=>[key,structuredClone(value)]));
    try{const result=await work({get:async key=>structuredClone(draft.get(key)),
      put:async(key,value)=>draft.set(key,structuredClone(value))});values=draft;return result;}finally{release();}
  }};
}
const old='a'.repeat(64),next='b'.repeat(64),other='c'.repeat(64),now=1000000;
const acquire=(storage,extra={})=>acquireNewsPreparationLease(storage,{ledgerSha:old,current:now,bootstrap:true,leaseId:'first',...extra});

describe('Durable Object preparation lease and staged KV hash fence',()=>{
  it('serializes competing runs and stores only lease/hash metadata',async()=>{
    const storage=transactionalFixture();
    const results=await Promise.all([acquire(storage),acquire(storage,{leaseId:'second'})]);
    expect(results.filter(row=>row.acquired)).toHaveLength(1);
    expect(results[1]).toMatchObject({acquired:false,reason:'daily_preparation_busy'});
    const control=await storage.get(NEWS_PREPARATION_FENCE_KEY);
    expect(control).toEqual({schemaVersion:1,expectedLedgerSha:old,pendingLedgerSha:null,pendingProfileSha:null,lease:{id:'first',until:now+NEWS_PREPARATION_LEASE_MS}});
    expect(JSON.stringify(control).length).toBeLessThan(512);
  });
  it('requires explicit first bootstrap and fails closed on corrupt or changed history',async()=>{
    const storage=transactionalFixture();
    await expect(acquire(storage,{bootstrap:false})).rejects.toThrow('daily_preparation_bootstrap_required');
    await acquire(storage);await releaseNewsPreparationLease(storage,'first');
    await expect(acquire(storage,{ledgerSha:next})).rejects.toThrow('daily_preparation_ledger_hash_mismatch');
    expect((await storage.get(NEWS_PREPARATION_FENCE_KEY)).expectedLedgerSha).toBe(old);
    const corrupt=transactionalFixture([[NEWS_PREPARATION_FENCE_KEY,{schemaVersion:1,expectedLedgerSha:'broken',pendingLedgerSha:null,lease:null}]]);
    await expect(acquire(corrupt)).rejects.toThrow('daily_preparation_fence_invalid');
  });
  it('recovers an acknowledged KV write whose DO confirmation was interrupted',async()=>{
    const storage=transactionalFixture();await acquire(storage);
    await stageNewsPreparationCheckpoint(storage,{leaseId:'first',ledgerSha:next,current:now});
    await releaseNewsPreparationLease(storage,'first');
    await acquire(storage,{ledgerSha:next,leaseId:'recovery',current:now+1});
    expect(await storage.get(NEWS_PREPARATION_FENCE_KEY)).toMatchObject({expectedLedgerSha:next,pendingLedgerSha:null,lease:{id:'recovery'}});
  });
  it('a stale KV read after a lost confirmation cannot erase the pending accepted ledger',async()=>{
    const storage=transactionalFixture();await acquire(storage);
    await stageNewsPreparationCheckpoint(storage,{leaseId:'first',ledgerSha:next,current:now});
    await releaseNewsPreparationLease(storage,'first');
    await expect(acquire(storage,{ledgerSha:other})).rejects.toThrow('daily_preparation_ledger_hash_mismatch');
    await expect(acquire(storage,{leaseId:'stale-reader'})).rejects.toThrow('daily_preparation_checkpoint_visibility_pending');
    expect(await storage.get(NEWS_PREPARATION_FENCE_KEY)).toMatchObject({expectedLedgerSha:old,pendingLedgerSha:next,lease:null});
    await acquire(storage,{ledgerSha:next,leaseId:'visible-recovery'});
    expect(await storage.get(NEWS_PREPARATION_FENCE_KEY)).toMatchObject({expectedLedgerSha:next,pendingLedgerSha:null});
  });
  it('rejects overlapping checkpoint intents and expired confirmation',async()=>{
    const storage=transactionalFixture();await acquire(storage);
    await stageNewsPreparationCheckpoint(storage,{leaseId:'first',ledgerSha:next,current:now});
    await expect(stageNewsPreparationCheckpoint(storage,{leaseId:'first',ledgerSha:other,current:now})).rejects.toThrow('daily_preparation_checkpoint_pending');
    await expect(confirmNewsPreparationCheckpoint(storage,{leaseId:'first',ledgerSha:next,current:now+NEWS_PREPARATION_LEASE_MS})).rejects.toThrow('daily_preparation_lease_lost');
    expect((await storage.get(NEWS_PREPARATION_FENCE_KEY)).pendingLedgerSha).toBe(next);
  });
  it('an old finally handler cannot release the lease acquired by a later run',async()=>{
    const storage=transactionalFixture();await acquire(storage);
    await acquire(storage,{leaseId:'new',current:now+NEWS_PREPARATION_LEASE_MS});
    await releaseNewsPreparationLease(storage,'first');
    expect((await storage.get(NEWS_PREPARATION_FENCE_KEY)).lease.id).toBe('new');
    await stageNewsPreparationCheckpoint(storage,{leaseId:'new',ledgerSha:next,current:now+NEWS_PREPARATION_LEASE_MS});
    await confirmNewsPreparationCheckpoint(storage,{leaseId:'new',ledgerSha:next,current:now+NEWS_PREPARATION_LEASE_MS});
    expect((await storage.get(NEWS_PREPARATION_FENCE_KEY)).expectedLedgerSha).toBe(next);
  });
  it('a late public-profile write remains fenced after lease expiry until its exact bytes are visible',async()=>{
    const storage=transactionalFixture();await acquire(storage);
    await stageNewsPreparationPublication(storage,{leaseId:'first',ledgerSha:old,profileSha:next,current:now});
    await expect(acquire(storage,{current:now+NEWS_PREPARATION_LEASE_MS,profileSha:old})).rejects.toThrow('daily_preparation_profile_visibility_pending');
    expect((await storage.get(NEWS_PREPARATION_FENCE_KEY)).pendingProfileSha).toBe(next);
    await acquire(storage,{current:now+NEWS_PREPARATION_LEASE_MS,profileSha:next,leaseId:'later'});
    await expect(confirmNewsPreparationPublication(storage,{leaseId:'first',profileSha:next,current:now+NEWS_PREPARATION_LEASE_MS})).rejects.toThrow('daily_preparation_lease_lost');
    await releaseNewsPreparationLease(storage,'first');
    expect((await storage.get(NEWS_PREPARATION_FENCE_KEY)).lease.id).toBe('later');
  });
});
