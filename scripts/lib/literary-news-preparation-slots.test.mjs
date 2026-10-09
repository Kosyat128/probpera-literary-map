import {describe,expect,it,vi} from 'vitest';
import {claimNewsPreparationSlot,NEWS_PREPARATION_SLOT_KEY,NEWS_PREPARATION_SLOT_MS} from './literary-news-preparation-slots.mjs';

const at=value=>Date.parse(`2026-10-09T${value}Z`);
function fixture(seed=[]){let values=new Map(seed),tail=Promise.resolve();return{values:()=>values,
  transaction:vi.fn(async work=>{const previous=tail;let release;tail=new Promise(resolve=>{release=resolve;});await previous;
    const next=new Map([...values].map(([key,value])=>[key,structuredClone(value)]));
    try{const result=await work({get:async key=>structuredClone(next.get(key)),put:async(key,value)=>next.set(key,structuredClone(value))});
      values=next;return result;}finally{release();}})};}
describe('Shared persistent preparation half-hour slots',()=>{
  it.each([['12:17:00','12:25:00'],['12:47:00','12:55:00']])('primary at %s suppresses recovery at %s',async(primary,recovery)=>{
    const storage=fixture();expect(await claimNewsPreparationSlot(storage,{current:at(primary)})).toEqual({acquired:true});
    const before=structuredClone(storage.values());
    expect(await claimNewsPreparationSlot(storage,{current:at(recovery),trigger:'recovery'})).toEqual({acquired:false,reason:'daily_preparation_slot_already_claimed'});
    expect(storage.values()).toEqual(before);
  });
  it('recovery wins a missed primary slot and suppresses a delayed primary',async()=>{
    const storage=fixture();expect(await claimNewsPreparationSlot(storage,{current:at('12:25:00'),trigger:'recovery'})).toEqual({acquired:true});
    expect(await claimNewsPreparationSlot(storage,{current:at('12:29:59.999')})).toMatchObject({acquired:false});
  });
  it('parallel primary and backup requests commit exactly one claim',async()=>{
    const storage=fixture(),results=await Promise.all(Array.from({length:20},(_,i)=>claimNewsPreparationSlot(storage,
      {current:at('12:25:00'),trigger:i%2?'recovery':'primary'})));
    expect(results.filter(result=>result.acquired)).toHaveLength(1);expect(storage.values().size).toBe(1);
  });
  it('allows a new slot and keeps only one bounded control record',async()=>{
    const storage=fixture();
    for(let n=0;n<100;n++)expect(await claimNewsPreparationSlot(storage,{current:at('12:17:00')+n*NEWS_PREPARATION_SLOT_MS})).toEqual({acquired:true});
    expect(storage.values().size).toBe(1);expect([...storage.values().keys()]).toEqual([NEWS_PREPARATION_SLOT_KEY]);
  });
  it.each(['12:00:00','12:17:00','12:24:59.999','12:30:00','12:47:00','12:54:59.999'])('early recovery at %s touches no storage',async(time)=>{
    const storage=fixture();expect(await claimNewsPreparationSlot(storage,{current:at(time),trigger:'recovery'}))
      .toEqual({acquired:false,reason:'daily_preparation_recovery_not_due'});expect(storage.transaction).not.toHaveBeenCalled();
  });
  it.each(['12:25:00','12:29:59.999','12:55:00','12:59:59.999'])('allows recovery at exact bounded time %s',async(time)=>{
    expect(await claimNewsPreparationSlot(fixture(),{current:at(time),trigger:'recovery'})).toEqual({acquired:true});
  });
  it('uses UTC even for an offset timestamp and permits the next half-hour after midnight',async()=>{
    const storage=fixture();
    expect(await claimNewsPreparationSlot(storage,{current:Date.parse('2026-10-09T15:25:00+03:00'),trigger:'recovery'})).toEqual({acquired:true});
    expect(storage.values().get(NEWS_PREPARATION_SLOT_KEY).slotStart).toBe(at('12:00:00'));
    expect(await claimNewsPreparationSlot(storage,{current:at('23:55:00'),trigger:'recovery'})).toEqual({acquired:true});
    expect(await claimNewsPreparationSlot(storage,{current:Date.parse('2026-10-10T00:17:00Z')})).toEqual({acquired:true});
  });
  it('retains a later committed slot when the clock moves backwards',async()=>{
    const storage=fixture();await claimNewsPreparationSlot(storage,{current:at('12:47:00')});const before=structuredClone(storage.values());
    expect(await claimNewsPreparationSlot(storage,{current:at('12:25:00'),trigger:'recovery'})).toMatchObject({acquired:false});
    expect(storage.values()).toEqual(before);
  });
  it.each([null,{},false,{schemaVersion:2,slotStart:at('12:00:00'),claimedAt:at('12:17:00')},
    {schemaVersion:1,slotStart:at('12:01:00'),claimedAt:at('12:17:00')},
    {schemaVersion:1,slotStart:at('12:00:00'),claimedAt:at('12:30:00')},
    {schemaVersion:1,slotStart:at('12:00:00'),claimedAt:at('11:59:59')},
    {schemaVersion:1,slotStart:at('12:00:00'),claimedAt:at('12:17:00'),extra:true}])('fails closed on corrupt persisted state %j',async(previous)=>{
    const storage=fixture([[NEWS_PREPARATION_SLOT_KEY,previous]]),before=structuredClone(storage.values());
    await expect(claimNewsPreparationSlot(storage,{current:at('12:55:00'),trigger:'recovery'})).rejects.toThrow('daily_preparation_slot_invalid');
    expect(storage.values()).toEqual(before);
  });
  it.each([NaN,Infinity,-1,1.5,8640000000000001])('rejects invalid actual timestamp %s before storage',async(current)=>{
    const storage=fixture();await expect(claimNewsPreparationSlot(storage,{current})).rejects.toThrow('daily_preparation_slot_input_invalid');
    expect(storage.transaction).not.toHaveBeenCalled();
  });
  it('rejects unknown trigger and propagates failed commit without claiming success',async()=>{
    const storage=fixture();await expect(claimNewsPreparationSlot(storage,{current:at('12:25:00'),trigger:'manual'})).rejects.toThrow('daily_preparation_slot_input_invalid');
    expect(storage.transaction).not.toHaveBeenCalled();
    storage.transaction.mockRejectedValue(Error('storage failure'));
    await expect(claimNewsPreparationSlot(storage,{current:at('12:25:00')})).rejects.toThrow('storage failure');
    expect(storage.values().size).toBe(0);
  });
});
