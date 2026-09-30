import { prepareNewsPost, newsNewPostRequiresPhoto, newsSemanticRevision, newsSocialPayloadDigest } from './literary-news-social.mjs';
import { dailyPublicationEpoch } from './literary-news-daily-profile.mjs';
import { newsAnnouncementEligible } from './literary-news-reviewed.mjs';

const unavailable = new Set(['media_source_unavailable','media_cache_unavailable','media_preparation_unavailable',
  'media_registered_asset_unavailable','delivery_media_bytes_unavailable','delivery_media_index_unavailable']);
const editorialDay = date => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);

export function newsNewCreateIsFresh(job,current=new Date()) {
  const temporal=job.prepared?.temporal,published=dailyPublicationEpoch(temporal?.publishedAt);
  return !job.withdrawal && ['news','announcement'].includes(temporal?.kind) && Number.isFinite(published)
    && published<=current.getTime() && current.getTime()-published<=7*86400000
    && newsAnnouncementEligible(temporal,editorialDay(current),'Europe/Moscow');
}

/** A bounded failed byte preparation may switch only an unsent, unchanged story
 * to its existing full-text formatter. Source/admission identity and both payload
 * hashes are rechecked; changed bytes, revoked rights and corrupt revisions remain
 * held. Known remote identities and ambiguous/inflight attempts never fall back. */
export async function fallbackUnsentNewsPhoto({store,row,reason,current=new Date()}) {
  const job=row?.state;
  if(!unavailable.has(reason)||!job?.prepared?.media||newsNewPostRequiresPhoto(job.destination)
    ||job.status!=='pending'||job.remoteId||job.dispatchStartedAt||job.withdrawal||!newsNewCreateIsFresh(job,current))return null;
  if(typeof job.prepared.payloadSha256!=='string'||typeof job.desiredRevision!=='string')return null;
  if(job.desiredRevision!==job.prepared.revision
    ||await newsSocialPayloadDigest(job.prepared.payload)!==job.prepared.payloadSha256)throw Error('text_fallback_revision_invalid');
  const admitted=(await store.read(`admission:news:${encodeURIComponent(job.newsId)}`)).state;
  const record=admitted?.record;
  if(record?.id!==job.newsId||record.verification!=='confirmed'
    ||await newsSemanticRevision(record)!==job.prepared.textRevision)throw Error('text_fallback_admission_invalid');
  const prepared=await prepareNewsPost(record,{id:job.prepared.publication?.snapshotId,release:job.prepared.publication?.release},job.destination.platform,
    {destination:job.destination,mediaOptions:{registry:{assets:[]},now:current}});
  if(prepared.media||prepared.textRevision!==job.prepared.textRevision)throw Error('text_fallback_revision_invalid');
  const state={...job,prepared,desiredRevision:prepared.revision,nextDueAt:current.toISOString(),
    mediaPreparationFailedAt:current.toISOString(),textFallbackReason:reason,lastError:null};
  const saved=await store.compareAppend(job.key,row.id,state);
  return {applied:saved.applied,key:job.key,reason,...(saved.applied?{state}: {})};
}
