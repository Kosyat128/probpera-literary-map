// Primary and recovery requests share one persistent half-hour claim in the
// existing preparation Durable Object. Failed runs retain their claim: only a
// later slot may retry, while the separate lease/hash fence protects writes.
export const NEWS_PREPARATION_SLOT_KEY='daily-preparation-slot-v1';
export const NEWS_PREPARATION_SLOT_MS=30*60000;
const fail=code=>{throw Error(code);};
const timestamp=value=>Number.isSafeInteger(value)&&value>=0&&value<=8640000000000000;
function checked(value){
  if(!value||value.schemaVersion!==1||Object.keys(value).sort().join(',')!=='claimedAt,schemaVersion,slotStart'
    ||!timestamp(value.slotStart)||value.slotStart%NEWS_PREPARATION_SLOT_MS!==0
    ||!timestamp(value.claimedAt)||value.claimedAt<value.slotStart||value.claimedAt>=value.slotStart+NEWS_PREPARATION_SLOT_MS)
    fail('daily_preparation_slot_invalid');
  return value;
}
export async function claimNewsPreparationSlot(storage,{current=Date.now(),trigger='primary'}={}){
  if(!timestamp(current)||!['primary','recovery'].includes(trigger))fail('daily_preparation_slot_input_invalid');
  const slotStart=Math.floor(current/NEWS_PREPARATION_SLOT_MS)*NEWS_PREPARATION_SLOT_MS;
  // Use actual request time, not a caller-supplied scheduled timestamp. The
  // backup has a bounded chance after each :17/:47 primary Cron trigger.
  if(trigger==='recovery'&&new Date(current).getUTCMinutes()%30<25)
    return{acquired:false,reason:'daily_preparation_recovery_not_due'};
  return storage.transaction(async tx=>{
    const previous=await tx.get(NEWS_PREPARATION_SLOT_KEY);
    if(previous!==undefined){
      checked(previous);
      // A backward clock must not replay an earlier slot or replace its fence.
      if(previous.slotStart>=slotStart)return{acquired:false,reason:'daily_preparation_slot_already_claimed'};
    }
    await tx.put(NEWS_PREPARATION_SLOT_KEY,{schemaVersion:1,slotStart,claimedAt:current});
    return{acquired:true};
  });
}
