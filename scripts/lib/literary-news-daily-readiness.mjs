import { prepareNewsPost,newsNewPostRequiresPhoto } from './literary-news-social.mjs';
import { validatePreparedNewsMedia } from './literary-news-media.mjs';
import { NEWS_DAILY_TARGET } from './literary-news-pacing.mjs';
import {dailyPublicationEpoch} from './literary-news-daily-profile.mjs';

const dayAt = date => new Intl.DateTimeFormat('en-CA', { timeZone: NEWS_DAILY_TARGET.timeZone,
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

/** Counts describe verified supply and accepted first-post receipts separately.
 * Old acknowledgedAt timestamps may be edits, so cannot prove a daily create.
 * There is no network, runtime mutation, upload or delivery in this audit. */
export async function literaryNewsDailyReadiness({ feed, destination, mediaOptions, jobs = [], current = new Date(),
  publication = 'local_preparation' }) {
  if (!Array.isArray(feed?.items) || !feed.snapshot?.id || !feed.snapshot?.release
    || !Array.isArray(jobs) || !Number.isFinite(current.getTime())) throw Error('daily_readiness_input_invalid');
  const day = dayAt(current), cutoff = current.getTime() - 7 * 86400000;
  const relevantJobs = jobs.filter(job => job.destination?.platform === destination.platform && job.destination.id === destination.id);
  const byId = new Map(relevantJobs.map(job => [job.newsId, job]));
  const receipts = relevantJobs.filter(job => job.remoteId && Number.isFinite(Date.parse(job.firstAcknowledgedAt))
    && dayAt(new Date(job.firstAcknowledgedAt)) === day);
  const freshReceipts=receipts.filter(job=>['news','announcement'].includes(job.prepared?.temporal?.kind)
    && Number.isFinite(dailyPublicationEpoch(job.prepared.temporal.publishedAt))
    && dailyPublicationEpoch(job.prepared.temporal.publishedAt)>=cutoff&&dailyPublicationEpoch(job.prepared.temporal.publishedAt)<=current.getTime());
  const outcomes = [];
  for (const item of feed.items) {
    const publishedAt = dailyPublicationEpoch(item.publishedAt);
    const freshness = Number.isFinite(publishedAt) ? publishedAt >= cutoff && publishedAt <= current.getTime()
      ? 'published_within_seven_days' : 'older_publication' : 'publication_date_unknown';
    const existing = byId.get(item.id);
    if (existing?.remoteId) { outcomes.push({ newsId: item.id, status: 'already_posted', freshness }); continue; }
    if (existing && ['inflight','ambiguous','blocked','explicitly_closed'].includes(existing.status)) {
      outcomes.push({ newsId: item.id, status: 'runtime_held', reason: existing.lastError || existing.status, freshness }); continue;
    }
    try {
      const prepared = await prepareNewsPost(item, feed.snapshot, destination.platform, { destination, mediaOptions });
      if (!prepared.media) {
        const reason=prepared.fallbackReason||'no_destination_licensed_asset';
        const unsafe=/(?:invalid|changed|requires_review|not_allowlisted)/.test(reason);
        outcomes.push({ newsId:item.id,status:!newsNewPostRequiresPhoto(destination)&&!unsafe?'text_ready':'photo_held',
          reason,freshness,nativeMethod:destination.platform==='telegram'?'sendMessage':'wall.post',sourcePublishedAt:item.publishedAt });continue;
      }
      await validatePreparedNewsMedia(prepared, destination, mediaOptions);
      outcomes.push({ newsId: item.id, status: 'photo_ready', freshness, assetId: prepared.media.assetId,
        captionLength: prepared.payload.caption?.length || prepared.payload.message?.length,
        nativeMethod: destination.platform === 'telegram' ? 'sendPhoto' : 'wall.post',
        sourcePublishedAt: item.publishedAt });
    } catch (error) { outcomes.push({ newsId: item.id, status: 'photo_held', freshness,
      reason: /^(?:media|post|prepared)_[a-z_]+$/.test(error.message) ? error.message : 'photo_verification_unavailable' }); }
  }
  const ready = outcomes.filter(row => row.status === 'photo_ready');
  const recentReady = ready.filter(row => row.freshness === 'published_within_seven_days');
  const textReady=outcomes.filter(row=>row.status==='text_ready'),recentTextReady=textReady.filter(row=>row.freshness==='published_within_seven_days');
  const freshSupply=recentReady.length+recentTextReady.length;
  const reasons = {}; for (const row of outcomes.filter(row => row.reason)) reasons[row.reason] = (reasons[row.reason] || 0) + 1;
  return { schemaVersion: 1, checkedAt: current.toISOString(), day, timeZone: NEWS_DAILY_TARGET.timeZone,
    publication, destination: { platform: destination.platform, id: destination.id }, target: NEWS_DAILY_TARGET,
    scope: 'Fresh text and photo supply is separate from activation and accepted first-post receipts. Photos have separate readiness counts. Freshness uses source publication dates, never collector observation times.',
    counts: { currentFeedItems: feed.items.length,
      sourcePublishedToday: feed.items.filter(item => Number.isFinite(Date.parse(item.publishedAt))
        && dayAt(new Date(item.publishedAt)) === day).length,
      unknownSourcePublicationDates: feed.items.filter(item => !Number.isFinite(Date.parse(item.publishedAt))).length,
      photoReady: ready.length, recentPhotoReady: recentReady.length,
      textReady:textReady.length,recentTextReady:recentTextReady.length,recentReady:freshSupply,
      acceptedFirstPostsToday: receipts.length,
      acceptedFreshFirstPostsToday:freshReceipts.length,
      firstPostDatesUnknown: relevantJobs.filter(job => job.remoteId && !Number.isFinite(Date.parse(job.firstAcknowledgedAt))).length,
      minimumSupplyDeficit: Math.max(0, NEWS_DAILY_TARGET.minimum - freshReceipts.length - freshSupply),
      targetSupplyDeficit: Math.max(0, NEWS_DAILY_TARGET.maximum - freshReceipts.length - freshSupply),
      minimumPhotoSupplyDeficit:Math.max(0,NEWS_DAILY_TARGET.minimum-freshReceipts.filter(job=>job.remoteMediaKind==='photo').length-recentReady.length),
      targetPhotoSupplyDeficit:Math.max(0,NEWS_DAILY_TARGET.maximum-freshReceipts.filter(job=>job.remoteMediaKind==='photo').length-recentReady.length) },
    heldReasons: reasons, outcomes };
}
