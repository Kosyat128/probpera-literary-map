import { newsDigest } from './literary-news-publication.mjs';
import { selectNativeNewsAdmissionIds } from './literary-news-native-admissions.mjs';

export const NEWS_CAPTURE_PROGRESS_KEY = 'literary-news:capture-progress-v1';
export const NEWS_CAPTURE_BATCH_SIZE = 4;
const MAX_ENTRIES = 24;
const REFRESH_MS = 3600000;
const FAILURE_RETRY_MS = 1800000;

export function checkedNewsCaptureProgress(value) {
  if (value == null) return { schemaVersion: 1, entries: [] };
  if (value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES
    || new Set(value.entries.map(row => row?.id)).size !== value.entries.length
    || value.entries.some(row => typeof row?.id !== 'string' || !row.id || row.id.length > 120
      || !/^[a-f0-9]{64}$/.test(row.revision) || !Number.isFinite(Date.parse(row.capturedAt))
      || row.retryAfterAt!==undefined && (!Number.isFinite(Date.parse(row.retryAfterAt))
        || Date.parse(row.retryAfterAt)-Date.parse(row.capturedAt)!==FAILURE_RETRY_MS)))
    throw Error('delivery_capture_progress_invalid');
  return value;
}

/** New/revised records take precedence over periodic refreshes. The complete
 * public snapshot remains the proof; this cursor contains only 24 IDs/hashes. */
export async function planNewsCapture(feed, current, previous) {
  previous = checkedNewsCaptureProgress(previous);
  const ids = selectNativeNewsAdmissionIds(feed, current), byId = new Map(feed.items.map(item => [item.id,item]));
  const old = new Map(previous.entries.map(row => [row.id,row]));
  const revisions = new Map();
  for (const id of ids) revisions.set(id,await newsDigest(byId.get(id)));
  const changed = ids.filter(id => old.get(id)?.revision !== revisions.get(id)
    || Date.parse(old.get(id)?.capturedAt)>current.getTime());
  const refresh = ids.filter(id => !changed.includes(id) && (old.get(id).retryAfterAt
    ?Date.parse(old.get(id).retryAfterAt)<=current.getTime():current.getTime()-Date.parse(old.get(id).capturedAt)>=REFRESH_MS))
    .sort((left,right) => Date.parse(old.get(left).capturedAt)-Date.parse(old.get(right).capturedAt));
  return { ids:[...changed,...refresh].slice(0,NEWS_CAPTURE_BATCH_SIZE), revisions, liveIds:ids, previous };
}

export function completedNewsCaptureProgress(plan, capturedIds, current, failedIds=[]) {
  const old = new Map(plan.previous.entries.map(row => [row.id,row]));
  const failed=new Set(failedIds);
  for (const id of [...capturedIds,...failedIds]) {
    if (!plan.ids.includes(id)) throw Error('delivery_capture_progress_invalid');
    old.set(id,{id,revision:plan.revisions.get(id),capturedAt:current.toISOString(),
      ...(failed.has(id)?{retryAfterAt:new Date(current.getTime()+FAILURE_RETRY_MS).toISOString()}:{} )});
  }
  return {schemaVersion:1,entries:plan.liveIds.filter(id=>old.has(id)).map(id=>old.get(id))};
}

export async function captureChangedNativeNews({storage,capture}) {
  let progress;
  const prior=await storage.get(NEWS_CAPTURE_PROGRESS_KEY);
  try{progress=checkedNewsCaptureProgress(prior);}catch{
    // This is only a reconciliation cursor, never a send receipt or pacing
    // fence. Re-reading jobs through CAS safely rebuilds it after corruption.
    progress={schemaVersion:1,entries:[]};
  }
  return capture({captureProgress:progress,saveCaptureProgress:value=>storage.put(NEWS_CAPTURE_PROGRESS_KEY,value)});
}
