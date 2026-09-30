// Durable Object storage contains only this small lease/hash control record.
// The annual ledger remains in KV. A failed write is recovered only by its exact staged hash.
export const NEWS_PREPARATION_FENCE_KEY='daily-preparation-fence-v1';
export const NEWS_PREPARATION_LEASE_MS=7*60000;
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=code=>{throw Error(code);};
function checked(value){
  if(!value||value.schemaVersion!==1||value.expectedLedgerSha!==null&&!hash(value.expectedLedgerSha)
    ||value.pendingLedgerSha!==null&&!hash(value.pendingLedgerSha)
    ||value.pendingProfileSha!==null&&!hash(value.pendingProfileSha)
    ||value.lease!==null&&(!value.lease||typeof value.lease.id!=='string'||!Number.isFinite(value.lease.until)))
    fail('daily_preparation_fence_invalid');return value;
}
export async function acquireNewsPreparationLease(storage,{ledgerSha,profileSha=null,current=Date.now(),bootstrap=false,leaseId=crypto.randomUUID()}){
  if(ledgerSha!==null&&!hash(ledgerSha)||profileSha!==null&&!hash(profileSha)||!Number.isFinite(current))fail('daily_preparation_fence_input_invalid');
  return storage.transaction(async tx=>{
    let control=await tx.get(NEWS_PREPARATION_FENCE_KEY);
    if(control){checked(control);if(control.lease&&control.lease.until>current)return{acquired:false,reason:'daily_preparation_busy'};}
    else {if(!bootstrap)fail('daily_preparation_bootstrap_required');control={schemaVersion:1,expectedLedgerSha:ledgerSha,pendingLedgerSha:null,pendingProfileSha:null,lease:null};}
    if(control.pendingLedgerSha!==null){
      if(ledgerSha===control.pendingLedgerSha){control.expectedLedgerSha=control.pendingLedgerSha;control.pendingLedgerSha=null;}
      // KV reads can lag a successful write. Seeing the old digest is not proof
      // that the staged write failed: never discard potentially accepted records.
      else if(ledgerSha===control.expectedLedgerSha)fail('daily_preparation_checkpoint_visibility_pending');
      else fail('daily_preparation_ledger_hash_mismatch');
    }else if(ledgerSha!==control.expectedLedgerSha)fail('daily_preparation_ledger_hash_mismatch');
    if(control.pendingProfileSha!==null){
      if(profileSha!==control.pendingProfileSha)fail('daily_preparation_profile_visibility_pending');
      control.pendingProfileSha=null;
    }
    control.lease={id:leaseId,until:current+NEWS_PREPARATION_LEASE_MS};
    await tx.put(NEWS_PREPARATION_FENCE_KEY,control);return{acquired:true,leaseId,until:control.lease.until};
  });
}
export async function stageNewsPreparationPublication(storage,{leaseId,ledgerSha,profileSha,current=Date.now()}){
  if(!hash(ledgerSha)||!hash(profileSha))fail('daily_preparation_checkpoint_hash_invalid');
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));
    if(c.lease?.id!==leaseId||c.lease.until<=current)fail('daily_preparation_lease_lost');
    if(c.expectedLedgerSha!==ledgerSha||c.pendingLedgerSha!==null||c.pendingProfileSha!==null)fail('daily_preparation_checkpoint_pending');
    c.pendingProfileSha=profileSha;await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
export async function confirmNewsPreparationPublication(storage,{leaseId,profileSha,current=Date.now()}){
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));
    if(c.lease?.id!==leaseId||c.lease.until<=current)fail('daily_preparation_lease_lost');
    if(c.pendingProfileSha!==profileSha)fail('daily_preparation_checkpoint_hash_invalid');
    c.pendingProfileSha=null;await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
export async function stageNewsPreparationCheckpoint(storage,{leaseId,ledgerSha,current=Date.now()}){
  if(!hash(ledgerSha))fail('daily_preparation_checkpoint_hash_invalid');
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));
    if(c.lease?.id!==leaseId||c.lease.until<=current)fail('daily_preparation_lease_lost');
    if(c.pendingLedgerSha!==null)fail('daily_preparation_checkpoint_pending');
    c.pendingLedgerSha=ledgerSha;await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
export async function confirmNewsPreparationCheckpoint(storage,{leaseId,ledgerSha,current=Date.now()}){
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));
    if(c.lease?.id!==leaseId||c.lease.until<=current)fail('daily_preparation_lease_lost');
    if(c.pendingLedgerSha!==ledgerSha)fail('daily_preparation_checkpoint_hash_invalid');
    c.expectedLedgerSha=ledgerSha;c.pendingLedgerSha=null;await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
export async function releaseNewsPreparationLease(storage,leaseId){
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));
    if(c.lease?.id!==leaseId)return;
    c.lease=null;await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
