import {createHash} from 'node:crypto';
import {newsJsonChunks} from './literary-news-json.mjs';
import {DAILY_NEWS_LIMITS} from './literary-news-daily-profile.mjs';

// Keep the deployed v1 control identity. Exact pending payloads live separately,
// in bounded slots small enough for both SQLite and legacy DO value limits.
export const NEWS_PREPARATION_FENCE_KEY='daily-preparation-fence-v1';
export const NEWS_PREPARATION_LEASE_MS=7*60000;
export const NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES=64*1024;
const PAYLOAD_PREFIX='daily-preparation-payload-v1:';
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const fail=code=>{throw Error(code);};
const payloadLimit=kind=>kind==='ledger'?DAILY_NEWS_LIMITS.ledgerBytes:kind==='profile'?DAILY_NEWS_LIMITS.profileBytes:fail('daily_preparation_payload_invalid');
const fields=kind=>kind==='ledger'?['pendingLedgerSha','pendingLedgerPayload']:kind==='profile'?['pendingProfileSha','pendingProfilePayload']:fail('daily_preparation_payload_invalid');
const chunkKey=(kind,index)=>PAYLOAD_PREFIX+kind+':'+index;
function checked(value){
  if(!value||value.schemaVersion!==1||value.expectedLedgerSha!==null&&!hash(value.expectedLedgerSha)
    ||value.pendingLedgerSha!==null&&!hash(value.pendingLedgerSha)
    ||value.pendingProfileSha!==null&&!hash(value.pendingProfileSha)
    ||value.lease!==null&&(!value.lease||typeof value.lease.id!=='string'||!value.lease.id||!Number.isFinite(value.lease.until)))
    fail('daily_preparation_fence_invalid');
  for(const kind of ['ledger','profile']){
    const [shaField,payloadField]=fields(kind),p=value[payloadField];
    if(p!==undefined&&(!p||p.sha256!==value[shaField]||!hash(p.sha256)||!Number.isSafeInteger(p.bytes)
      ||p.bytes<1||p.bytes>payloadLimit(kind)||!Number.isSafeInteger(p.chunks)
      ||p.chunks!==Math.ceil(p.bytes/NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES)))fail('daily_preparation_payload_invalid');
  }
  return value;
}
function checkLease(control,leaseId,current){
  if(!Number.isFinite(current)||control.lease?.id!==leaseId||control.lease.until<=current)fail('daily_preparation_lease_lost');
}
export async function acquireNewsPreparationLease(storage,{ledgerSha,profileSha=null,reconstructedProfileSha=null,current=Date.now(),bootstrap=false,leaseId=crypto.randomUUID()}){
  if(ledgerSha!==null&&!hash(ledgerSha)||profileSha!==null&&!hash(profileSha)
    ||reconstructedProfileSha!==null&&!hash(reconstructedProfileSha)||!Number.isFinite(current)||typeof leaseId!=='string'||!leaseId)
    fail('daily_preparation_fence_input_invalid');
  return storage.transaction(async tx=>{
    let control=await tx.get(NEWS_PREPARATION_FENCE_KEY);
    if(control){checked(control);if(control.lease&&control.lease.until>current)return{acquired:false,reason:'daily_preparation_busy'};}
    else {if(!bootstrap)fail('daily_preparation_bootstrap_required');control={schemaVersion:1,expectedLedgerSha:ledgerSha,pendingLedgerSha:null,pendingProfileSha:null,lease:null};}
    const recovery={};
    if(control.pendingLedgerSha!==null){
      if(ledgerSha===control.pendingLedgerSha){control.expectedLedgerSha=control.pendingLedgerSha;control.pendingLedgerSha=null;delete control.pendingLedgerPayload;}
      // Seeing the old digest cannot distinguish an unattempted write from a
      // successful but stale read. Only replay the exact durable staged payload.
      else if(ledgerSha===control.expectedLedgerSha){
        if(!control.pendingLedgerPayload)fail('daily_preparation_checkpoint_visibility_pending');
        recovery.ledgerSha=control.pendingLedgerSha;
      }else fail('daily_preparation_ledger_hash_mismatch');
    }else if(ledgerSha!==control.expectedLedgerSha)fail('daily_preparation_ledger_hash_mismatch');
    if(control.pendingProfileSha!==null){
      if(profileSha===control.pendingProfileSha){control.pendingProfileSha=null;delete control.pendingProfilePayload;}
      else if(control.pendingProfilePayload||reconstructedProfileSha===control.pendingProfileSha){
        recovery.profileSha=control.pendingProfileSha;
        recovery.reconstructProfile=!control.pendingProfilePayload;
      }else fail('daily_preparation_profile_visibility_pending');
    }
    control.lease={id:leaseId,until:current+NEWS_PREPARATION_LEASE_MS};
    await tx.put(NEWS_PREPARATION_FENCE_KEY,control);
    return{acquired:true,leaseId,until:control.lease.until,...(Object.keys(recovery).length?{recovery}:{})};
  });
}

// At most 32 small values per transaction (legacy DO transactions cap writes).
// Uncommitted uploads occupy fixed bounded slots and have no recovery authority.
// Each batch rechecks the lease; an expired uploader cannot damage newer bytes.
async function persistPayload(storage,{leaseId,kind,sha256,payload,current,now}){
  const limit=payloadLimit(kind),digest=createHash('sha256'),encoder=new TextEncoder();
  let bytes=0,index=0,filled=0,chunk=new Uint8Array(NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES),batch=[];
  const check=async tx=>{const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));checkLease(c,leaseId,now?now():current);
    if(c.pendingLedgerSha!==null||c.pendingProfileSha!==null)fail('daily_preparation_checkpoint_pending');};
  const flush=async()=>{
    if(!batch.length)return;const rows=batch;batch=[];
    await storage.transaction(async tx=>{await check(tx);for(const [key,value] of rows)await tx.put(key,value,{noCache:true});});
  };
  for(const text of newsJsonChunks(payload)){
    const raw=encoder.encode(text);bytes+=raw.byteLength;if(bytes>limit)fail('daily_preparation_payload_too_large');digest.update(raw);
    for(let offset=0;offset<raw.length;){
      const length=Math.min(raw.length-offset,chunk.length-filled);chunk.set(raw.subarray(offset,offset+length),filled);offset+=length;filled+=length;
      if(filled===chunk.length){batch.push([chunkKey(kind,index++),chunk]);filled=0;chunk=new Uint8Array(NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES);
        if(batch.length===32)await flush();}
    }
  }
  if(digest.digest('hex')!==sha256)fail('daily_preparation_payload_hash_mismatch');
  if(filled)batch.push([chunkKey(kind,index++),chunk.slice(0,filled)]);
  await flush();return{sha256,bytes,chunks:index};
}
async function stage(storage,{leaseId,kind,sha256,ledgerSha,payload,current=Date.now(),now}){
  if(!hash(sha256)||kind==='profile'&&!hash(ledgerSha))fail('daily_preparation_checkpoint_hash_invalid');
  // Preserve hash-only callers/old intents; they intentionally cannot recover an
  // invisible ledger. Production callers always stage the exact payload.
  const manifest=payload===undefined?null:await persistPayload(storage,{leaseId,kind,sha256,payload,current,now});
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));checkLease(c,leaseId,now?now():current);
    if(c.pendingLedgerSha!==null||c.pendingProfileSha!==null||kind==='profile'&&c.expectedLedgerSha!==ledgerSha)
      fail('daily_preparation_checkpoint_pending');
    const [shaField,payloadField]=fields(kind);c[shaField]=sha256;
    if(manifest)c[payloadField]=manifest;
    await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
export async function stageNewsPreparationCheckpoint(storage,{ledgerSha,...options}){
  return stage(storage,{...options,kind:'ledger',sha256:ledgerSha});
}
export async function stageNewsPreparationPublication(storage,{profileSha,...options}){
  return stage(storage,{...options,kind:'profile',sha256:profileSha});
}
export async function assertNewsPreparationWrite(storage,{leaseId,kind,sha256,current=Date.now()}){
  const c=checked(await storage.get(NEWS_PREPARATION_FENCE_KEY));checkLease(c,leaseId,current);
  if(c[fields(kind)[0]]!==sha256)fail('daily_preparation_checkpoint_hash_invalid');
}
export async function readNewsPreparationPayload(storage,{leaseId,kind,sha256,current=Date.now()}){
  const c=checked(await storage.get(NEWS_PREPARATION_FENCE_KEY));checkLease(c,leaseId,current);
  const [shaField,payloadField]=fields(kind),manifest=c[payloadField];
  if(c[shaField]!==sha256||!manifest)fail('daily_preparation_payload_missing');
  const digest=createHash('sha256');let index=0,bytes=0;
  return new ReadableStream({async pull(controller){
    try{
      const chunk=await storage.get(chunkKey(kind,index++),{noCache:true});
      const expected=Math.min(NEWS_PREPARATION_PAYLOAD_CHUNK_BYTES,manifest.bytes-bytes);
      if(!(chunk instanceof Uint8Array)||chunk.byteLength!==expected)fail('daily_preparation_payload_invalid');
      bytes+=chunk.byteLength;digest.update(chunk);
      if(index===manifest.chunks){if(bytes!==manifest.bytes||digest.digest('hex')!==sha256)fail('daily_preparation_payload_hash_mismatch');
        controller.enqueue(chunk);controller.close();}
      else controller.enqueue(chunk);
    }catch(error){controller.error(error);}
  }});
}
async function confirm(storage,{leaseId,kind,sha256,current=Date.now()}){
  if(!hash(sha256))fail('daily_preparation_checkpoint_hash_invalid');
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));checkLease(c,leaseId,current);
    const [shaField,payloadField]=fields(kind);
    if(c[shaField]!==sha256)fail('daily_preparation_checkpoint_hash_invalid');
    if(kind==='ledger')c.expectedLedgerSha=sha256;
    c[shaField]=null;delete c[payloadField];await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
export async function confirmNewsPreparationCheckpoint(storage,{ledgerSha,...options}){
  return confirm(storage,{...options,kind:'ledger',sha256:ledgerSha});
}
export async function confirmNewsPreparationPublication(storage,{profileSha,...options}){
  return confirm(storage,{...options,kind:'profile',sha256:profileSha});
}
export async function releaseNewsPreparationLease(storage,leaseId){
  await storage.transaction(async tx=>{
    const c=checked(await tx.get(NEWS_PREPARATION_FENCE_KEY));
    if(c.lease?.id!==leaseId)return;
    c.lease=null;await tx.put(NEWS_PREPARATION_FENCE_KEY,c);
  });
}
