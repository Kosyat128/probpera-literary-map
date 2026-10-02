import { randomUUID } from "node:crypto";
import { newsDigest, verifyPublishedNewsSnapshot } from "./literary-news-publication.mjs";
import { newsAnnouncementEligible } from "./literary-news-reviewed.mjs";
import { dailyPublicationEpoch } from "./literary-news-daily-profile.mjs";
import { selectNewsMedia } from "./literary-news-media-policy.mjs";
import { reserveNewsDeliverySlot } from "./literary-news-pacing.mjs";
import socialConfiguration from "../../data/news/social-destinations.json" with { type: "json" };

/** JSONB may reorder every object, including objects inside Telegram entities.
 * Canonicalize social payloads only; the public snapshot wire contract is unchanged.
 */
export function canonicalNewsSocialValue(value) {
  if (Array.isArray(value)) return value.map(canonicalNewsSocialValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, canonicalNewsSocialValue(value[key])]));
  return value;
}
export const newsSocialPayloadDigest = (value) => newsDigest(canonicalNewsSocialValue(value));
const sameWithdrawal = (left, right) => JSON.stringify(canonicalNewsSocialValue(left))
  === JSON.stringify(canonicalNewsSocialValue(right));

export const NEWS_SECTION_URL = "https://probpera.ru/#literary-news";
export function checkedDestination(destination) {
  if (!["telegram", "vk"].includes(destination?.platform)
    || typeof destination.id !== "string" || !/^-[1-9]\d{0,15}$/.test(destination.id) || !Number.isSafeInteger(Number(destination.id))
    || !["off", "shadow", "canary", "on"].includes(destination.mode)
    || destination.requirePhotoForNewPosts !== undefined && typeof destination.requirePhotoForNewPosts !== "boolean") throw new Error("destination_invalid");
  return destination;
}
// A code-owned destination entry overrides stale durable flags in either
// direction. This lets an explicit text-fallback policy release jobs created
// under an older photo-required policy without changing their identity.
function destinationPhotoPolicy(destination) {
  const configured = socialConfiguration.destinations.find(row =>
    row.platform === destination?.platform && row.id === destination?.id);
  return configured ? configured.requirePhotoForNewPosts : destination?.requirePhotoForNewPosts;
}
export function newsNewPostRequiresPhoto(destination) {
  return destinationPhotoPolicy(destination) === true;
}
function runtimeDestination(destination) {
  const requirePhotoForNewPosts = destinationPhotoPolicy(destination);
  return { platform: destination.platform, id: destination.id,
    ...(requirePhotoForNewPosts !== undefined ? { requirePhotoForNewPosts } : {}) };
}
function missingRequiredNewPhoto(job) {
  return !job.remoteId && !job.withdrawal && job.prepared && !job.prepared.media && newsNewPostRequiresPhoto(job.destination);
}
export function newsPostKey(newsId, destination) {
  checkedDestination(destination);
  if (typeof newsId !== "string" || !newsId.trim() || newsId.length > 120) throw new Error("news_id_invalid");
  return `post:news:${encodeURIComponent(newsId)}:${destination.platform}:${destination.id}`;
}
export async function newsSemanticRevision(item) {
  const { id, title, summary, source, category, kind, eventDate, publishedAt, eventKey } = item;
  return newsSocialPayloadDigest({ id, title, summary, source, category, kind, eventDate, publishedAt, eventKey });
}
function telegramPostText({ title, summary, dateLine, source, credit }) {
  let text = `${title}\n\n${summary}${dateLine ? `\n\n${dateLine}` : ""}`;
  const entities = [{ type: "bold", offset: 0, length: title.length }];
  const visibleUrl = url => {
    entities.push({ type: "url", offset: text.length, length: url.length });
    text += url;
  };
  if (credit) text += `\n\nИзображение: ${credit}`;
  text += `\n\nИсточник: ${source.name}\n`; visibleUrl(source.url);
  text += "\n\nЛитературная повестка «Пробы пера»\n"; visibleUrl(NEWS_SECTION_URL);
  return { text, entities };
}
/** Exact native payload shared by preview and dispatch. No source HTML or invented details. */
export async function prepareNewsPost(item, snapshot, platform, { destination, mediaOptions } = {}) {
  if (!["telegram", "vk"].includes(platform) || item?.verification !== "confirmed"
    || !snapshot?.id || !snapshot?.release) throw new Error("published_news_required");
  const title = item.title.ru.trim(), summary = item.summary.ru.trim();
  const dateLabel = item.kind === "announcement" ? "Запланировано" : item.kind === "calendar" ? "Памятная дата" : null;
  const dateLine = dateLabel ? `${dateLabel}: ${new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", dateStyle: "long" })
    .format(new Date(`${item.eventDate}T12:00:00Z`))}` : null;
  const vkText = `${title}\n\n${summary}${dateLine ? `\n\n${dateLine}` : ""}\n\nИсточник: ${item.source.name}\n${item.source.url}\n\nЛитературная повестка «Пробы пера»\n${NEWS_SECTION_URL}`;
  const telegram = platform === "telegram" ? telegramPostText({ title, summary, dateLine, source: item.source }) : null;
  const text = telegram?.text || vkText;
  // Never cut a title, negation, attribution or URL. An oversized record is isolated.
  if (text.length > (platform === "telegram" ? 4096 : 16000)) throw new Error("post_text_too_long");
  let payload = platform === "telegram"
    ? { ...telegram, link_preview_options: { is_disabled: true } }
    : { message: text, attachments: "", from_group: 1, close_comments: 0 };
  let { media, reason: fallbackReason } = await selectNewsMedia(item.id, destination, mediaOptions);
  const resolution = mediaOptions?.resolutions?.[item.id];
  const mediaPending = !media && resolution && resolution.status !== "held";
  if (!media && resolution) fallbackReason = `media_discovery_${resolution.status}:${resolution.reason || "asset_unavailable"}`;
  if (media) {
    const photo = platform === "telegram" ? telegramPostText({ title, summary, dateLine, source: item.source, credit: media.credit }) : null;
    const caption = platform === "telegram" ? photo.text : `${text}\n\nИзображение: ${media.credit}`;
    if (caption.length > (platform === "telegram" ? 1024 : 16000)) {
      media = null; fallbackReason = "required_credit_or_caption_exceeds_limit";
    } else payload = platform === "telegram"
      ? { photo: "attach://news_photo", caption, caption_entities: photo.entities, show_caption_above_media: false }
      : { ...payload, message: caption, attachments: "prepared://news_photo" };
  }
  const textRevision = await newsSemanticRevision(item);
  // A template edit must update an already sent post at its existing remote ID.
  const formatRevision = platform === "telegram" ? "source-then-site-visible-urls-footer-v3" : "source-then-site-visible-links-v2";
  const messageRevision = formatRevision ? await newsSocialPayloadDigest({ textRevision, formatRevision }) : textRevision;
  // The durable identity is unchanged. A new asset or credit creates an edit revision.
  const revision = media ? await newsSocialPayloadDigest({ textRevision: messageRevision, media: {
    assetId: media.assetId, sha256: media.sha256, profile: media.profile, credit: media.credit,
    licenseEvidenceSha256: media.licenseEvidenceSha256, destination: media.destination,
  } }) : messageRevision;
  return { contentKind: "news", newsId: item.id, platform, locale: "ru", profile: media ? "literary-news-photo-v1" : "literary-news-text-v1",
    ...(item.sendable === false || snapshot.sendable === false ? {sendable:false} : {}),
    revision, textRevision, ...(formatRevision ? { formatRevision } : {}),
    publication: { snapshotId: snapshot.id, release: snapshot.release },
    temporal: { kind: item.kind, eventDate: item.eventDate, publishedAt: item.publishedAt, verifiedAt: item.verifiedAt },
    media, fallbackReason, payload: canonicalNewsSocialValue(payload),
    ...(mediaPending ? { mediaPending: true } : {}),
    payloadSha256: await newsSocialPayloadDigest(payload) };
}

async function prepareWithdrawal(prepared, withdrawal) {
  const text = `Сообщение отозвано редакцией.\n\n${withdrawal.reason}\n\n${NEWS_SECTION_URL}`;
  const payload = prepared.platform === "telegram" ? {text,link_preview_options:{is_disabled:true}}
    : {message:text,attachments:""};
  return {...prepared,profile:"literary-news-withdrawal-v1",media:null,mediaPending:false,payload:canonicalNewsSocialValue(payload),
    payloadSha256:await newsSocialPayloadDigest(payload),
    revision:await newsSocialPayloadDigest({newsId:prepared.newsId,withdrawal})};
}

export function isNewsRuntimeQuotaError(error) {
  return error?.message === "runtime_quota_exceeded";
}

/** No further request is issued by this runner after the project returns 402.
 * Errors stay explicit; an uncertain post-dispatch receipt is never retried here.
 */
export function createNewsRuntimeStore(supabase) {
  let quotaExceeded = false, latestRpcAvailable = true;
  const request = async (run, code, allowMissingRpc = false) => {
    if (quotaExceeded) throw new Error("runtime_quota_exceeded");
    let result;
    try { result = await run(); }
    catch (error) {
      if (Number(error?.status) === 402) quotaExceeded = true;
      throw new Error(quotaExceeded ? "runtime_quota_exceeded" : code);
    }
    if (result?.status === 402 || Number(result?.error?.status) === 402 || result?.error?.code === "402") {
      quotaExceeded = true; throw new Error("runtime_quota_exceeded");
    }
    if (result?.error && !(allowMissingRpc && ["PGRST202", "42883"].includes(result.error.code))) throw new Error(code);
    return result;
  };
  const read = async (key) => {
    const { data } = await request(() => supabase.from("admin_audit_log").select("id,metadata")
      .eq("entity_type", "literary_news_runtime").eq("entity_id", key).order("id", { ascending: false }).limit(1), "runtime_read_failed");
    return data?.[0] ? { id: data[0].id, state: data[0].metadata } : { id: null, state: null };
  };
  const compareAppend = async (key, expectedId, state, guard = null) => {
    const { data } = await request(() => supabase.rpc("compare_append_literary_news_runtime", {
      p_key: key, p_expected_id: expectedId, p_state: state,
      p_control_key: guard?.key || null, p_expected_control_id: guard?.id || null,
    }), "runtime_commit_failed");
    if (!data || typeof data.applied !== "boolean") throw new Error("runtime_commit_failed");
    return data;
  };
  // Before the additive latest-row RPC is installed, scan only journal IDs.
  // The immutable journal is retained; old prepared payloads/receipts no longer
  // cross the API merely to discard them in the client.
  const listLegacy = async (prefix) => {
    const latest = new Map(); let cursor = null, complete = false;
    const pattern = prefix.replace(/[\\%_]/g, "\\$&") + "%";
    for (let count = 0; count < 100000; count += 1000) {
      const { data } = await request(() => {
        let query = supabase.from("admin_audit_log").select("id,entity_id")
          .eq("entity_type", "literary_news_runtime").like("entity_id", pattern)
          .order("id", { ascending: false }).limit(1000);
        return cursor === null ? query : query.lt("id", cursor);
      }, "runtime_history_read_failed");
      if (!Array.isArray(data)) throw new Error("runtime_history_read_failed");
      for (const row of data) if (!latest.has(row.entity_id)) latest.set(row.entity_id, row.id);
      if (data.length < 1000) { complete = true; break; }
      cursor = data.at(-1).id;
    }
    if (!complete) throw new Error("runtime_history_capacity_requires_review");
    const ids = [...latest.values()], rows = [];
    for (let offset = 0; offset < ids.length; offset += 250) {
      const selected = ids.slice(offset, offset + 250);
      const { data } = await request(() => supabase.from("admin_audit_log").select("id,entity_id,metadata")
        .eq("entity_type", "literary_news_runtime").in("id", selected).limit(selected.length), "runtime_history_read_failed");
      if (!Array.isArray(data) || data.length !== selected.length
        || data.some(row => latest.get(row.entity_id) !== row.id)) throw new Error("runtime_history_read_failed");
      rows.push(...data.map(row => ({ id: row.id, key: row.entity_id, state: row.metadata })));
    }
    return rows;
  };
  const list = async (prefix = "post:") => {
    if (typeof prefix !== "string" || !/^(post|destination|admission|heartbeat|history):[A-Za-z0-9_%:.-]*$/.test(prefix)
      || prefix.length > 400) throw new Error("runtime_prefix_invalid");
    if (!latestRpcAvailable) return listLegacy(prefix);
    const rows = []; let cursor = null;
    for (let count = 0; count < 100000; count += 500) {
      const result = await request(() => supabase.rpc("read_latest_literary_news_runtime", {
        p_prefix: prefix, p_after_key: cursor, p_limit: 500,
      }), "runtime_history_read_failed", cursor === null);
      if (result.error) {
        latestRpcAvailable = false; return listLegacy(prefix);
      }
      const data = result.data;
      if (!Array.isArray(data) || data.length > 500 || data.some((row, index) =>
        typeof row.entity_id !== "string" || !row.entity_id.startsWith(prefix)
        || (index ? row.entity_id <= data[index - 1].entity_id : cursor !== null && row.entity_id <= cursor)))
        throw new Error("runtime_history_read_failed");
      rows.push(...data.map(row => ({ id: row.id, key: row.entity_id, state: row.metadata })));
      if (data.length < 500) return rows;
      cursor = data.at(-1).entity_id;
    }
    throw new Error("runtime_history_capacity_requires_review");
  };
  return { read, compareAppend, list };
}

/** This cache belongs only to one reconciliation, never to external dispatch.
 * CAS conflicts refresh its entry from the database result before the retry.
 */
async function reconciliationStore(store) {
  const rows = new Map();
  for (const row of await store.list("admission:"))
    rows.set(row.key || "admission:news:" + encodeURIComponent(row.state.newsId), row);
  for (const row of await store.list("post:"))
    rows.set(row.key || row.state.key || newsPostKey(row.state.newsId, row.state.destination), row);
  return {
    read: async key => {
      if (!rows.has(key) && !key.startsWith("admission:") && !key.startsWith("post:")) rows.set(key, await store.read(key));
      return structuredClone(rows.get(key) || { id: null, state: null });
    },
    compareAppend: async (key, expectedId, state) => {
      const result = await store.compareAppend(key, expectedId, state);
      // This store is never used for guarded dispatch. A malformed CAS response
      // cannot be turned into an absent state and then overwrite a receipt.
      if (result.applied || Object.hasOwn(result, "id") && Object.hasOwn(result, "state"))
        rows.set(key, { id: result.id, state: result.state });
      else rows.set(key, await store.read(key));
      return result;
    },
    list: async prefix => [...rows].filter(([key]) => key.startsWith(prefix))
      .map(([, row]) => structuredClone(row)),
  };
}
async function transition(store, key, mutate) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const prior = await store.read(key);
    const next = await mutate(prior.state);
    if (next === null) return { applied: false, ...prior };
    const result = await store.compareAppend(key, prior.id, next);
    if (result.applied) return result;
  }
  throw new Error("runtime_contention");
}

/** Only confirmed complete public snapshots can establish expectations. */
export async function reconcileNewsSnapshot(store, feed, destinations, now = new Date(), { mediaOptions, boundedCaptureIds } = {}) {
  await verifyPublishedNewsSnapshot(feed);
  if (feed.timeZone !== "Europe/Moscow" || feed.fallbackCapturedAt
    || Math.abs(now.getTime() - Date.parse(feed.generatedAt)) > 300000) throw new Error("public_snapshot_not_current");
  let items = feed.items;
  if (boundedCaptureIds !== undefined) {
    if (!Array.isArray(boundedCaptureIds) || boundedCaptureIds.length > 24
      || new Set(boundedCaptureIds).size !== boundedCaptureIds.length
      || !Array.isArray(destinations) || destinations.length !== 1 || destinations[0]?.platform !== 'telegram')
      throw Error('bounded_capture_invalid');
    checkedDestination(destinations[0]);
    const byId = new Map(feed.items.map(item => [item.id, item]));
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    items = boundedCaptureIds.map(id => {
      const item = byId.get(id), published = dailyPublicationEpoch(item?.publishedAt);
      if (typeof id !== 'string' || !item || !['news', 'announcement'].includes(item.kind)
        || !Number.isFinite(published) || published > now.getTime() || now.getTime() - published > 7 * 86400000
        || !newsAnnouncementEligible(item, today, 'Europe/Moscow')) throw Error('bounded_capture_invalid');
      return item;
    });
  } else store = await reconciliationStore(store);
  const result = { expectedThisSnapshot: 0, newAdmissions: 0, historyGap: true, keys: [], preparationFailures: [] };
  for (const item of items) {
    const revision = await newsSemanticRevision(item);
    const admissionKey = `admission:news:${encodeURIComponent(item.id)}`;
    let firstAdmission = false;
    const admission = await transition(store, admissionKey, (prior) => {
      firstAdmission = !prior;
      if (prior?.lastRevision === revision && prior.record?.verifiedAt === item.verifiedAt) return null;
      return {...prior,newsId:item.id,admittedAt:prior?.admittedAt || now.toISOString(),
        snapshotId:feed.snapshot.id,release:feed.snapshot.release,originalRevision:prior?.originalRevision || revision,
        lastRevision:revision,record:item};
    });
    if (admission.applied && firstAdmission) result.newAdmissions++;
    for (const destination of destinations) {
      const key = newsPostKey(item.id, destination);
      let prepared;
      try { prepared = await prepareNewsPost(item, feed.snapshot, destination.platform, {destination,mediaOptions:{...mediaOptions,now}}); }
      catch {
        result.preparationFailures.push({ newsId: item.id, platform: destination.platform, reason: "post_preparation_invalid" });
        await transition(store, key, (prior) => prior?.status === "explicitly_closed" ? null : ({ ...prior, key, newsId: item.id,
          destination: runtimeDestination(destination),
          originalAdmission: prior?.originalAdmission || now.toISOString(), desiredRevision: revision,
          status: "blocked", lastError: "post_preparation_invalid" }));
        result.expectedThisSnapshot++; result.keys.push(key); continue;
      }
      await transition(store, key, async (prior) => {
        if (prior?.status === "explicitly_closed") return null;
        // Adding the photo profile is not authorization to restyle old text posts.
        // Corrections retain the already published text profile; photo posts can
        // replace their own image/credit while keeping the same remote identity.
        if (prior?.remoteId && prior.prepared?.profile === "literary-news-text-v1" && prepared.media)
          prepared = await prepareNewsPost(item,feed.snapshot,destination.platform);
        if (prior?.remoteId && prior.prepared?.media && prepared.media
          && prior.prepared.textRevision === prepared.textRevision
          && prior.prepared.formatRevision === prepared.formatRevision
          && prior.prepared.media.profile !== prepared.media.profile
          && prior.prepared.media.sourceSha256 === prepared.media.sourceSha256
          && prior.prepared.media.credit === prepared.media.credit
          && prior.prepared.media.licenseEvidenceSha256 === prepared.media.licenseEvidenceSha256)
          prepared = {...prior.prepared,temporal:prepared.temporal,publication:prepared.publication};
        if (prior?.desiredRevision === prepared.revision) {
          // Same desired hash with a different text identity needs explicit
          // history review. A photo-policy renewal cannot silently repair it.
          if (prior.prepared?.textRevision !== prepared.textRevision) return null;
          if (prior.status === "blocked" && prior.lastError === "archived_media_requires_source_resolution")
            return {...prior,prepared,status:prior.remoteId?"correction_pending":"pending",nextDueAt:now.toISOString(),lastError:null};
          if (!prior.remoteId && (Boolean(prior.prepared?.mediaPending) !== Boolean(prepared.mediaPending)
            || prior.destination?.requirePhotoForNewPosts !== runtimeDestination(destination).requirePhotoForNewPosts))
            return { ...prior, destination: runtimeDestination(destination), prepared };
          if (prior.prepared?.temporal?.verifiedAt === item.verifiedAt) return null;
          const renewed = prior.status === "blocked" && prior.lastError === "expired_announcement_requires_source_resolution";
          return { ...prior, prepared, ...(renewed ? {
            status: prior.remoteId ? "correction_pending" : "pending", nextDueAt: now.toISOString(), lastError: null,
          } : {}) };
        }
        return { ...prior, key, newsId: item.id, destination: runtimeDestination(destination),
          originalAdmission: prior?.originalAdmission || now.toISOString(), desiredRevision: prepared.revision,
          prepared, status: prior?.status === "ambiguous" || prior?.status === "inflight" ? prior.status
            : prior?.remoteId ? "correction_pending" : "pending", nextDueAt: now.toISOString() };
      });
      result.expectedThisSnapshot++; result.keys.push(key);
    }
  }
  // A bounded capture cannot infer absence, repair archives, apply withdrawals or scan historical journals.
  if (boundedCaptureIds !== undefined) return { ...result, restoredMissingJobs: 0, heldArchivedMediaJobs: 0 };
  // Repair a crash between durable admission and per-destination job creation,
  // including items that have since expired from the current projection.
  let restoredMissingJobs = 0, heldArchivedMediaJobs = 0;
  const observedIds = new Set([...feed.items.map(item=>item.id),...feed.withdrawals.map(row=>row.id)]);
  for (const {state:admitted} of await store.list("admission:")) for (const destination of destinations) {
    const key = newsPostKey(admitted.newsId,destination);
    if ((await store.read(key)).state) {
      if (!observedIds.has(admitted.newsId)) {
        // An absent item cannot finish current-only image discovery. Keep its
        // durable expectation visible for source resolution, rather than leave
        // a hidden infinite pending loop or infer permission to send old text.
        // Announcements retain their separate expiry/source-resolution path.
        const held = await transition(store,key,prior=>prior?.status === "pending" && !prior.remoteId
          && !prior.dispatchStartedAt && !prior.withdrawal && prior.prepared?.mediaPending
          && prior.prepared.temporal?.kind !== "announcement"
          ? {...prior,status:"blocked",lastError:"archived_media_requires_source_resolution"} : null);
        if (held.applied) heldArchivedMediaJobs++;
      }
      continue;
    }
    let prepared = null;
    try {prepared = await prepareNewsPost(admitted.record,{id:admitted.snapshotId,release:admitted.release},destination.platform,
      {destination,mediaOptions:{...mediaOptions,now}});} catch { /* Retain a blocked expectation. */ }
    const repaired = await store.compareAppend(key,null,{key,newsId:admitted.newsId,
      destination:runtimeDestination(destination),originalAdmission:admitted.admittedAt,
      desiredRevision:prepared?.revision || admitted.lastRevision || admitted.originalRevision,prepared,
      status:prepared?"pending":"blocked",nextDueAt:now.toISOString(),
      lastError:prepared?null:"historical_preparation_invalid"});
    if (repaired.applied) restoredMissingJobs++;
  }
  result.restoredMissingJobs = restoredMissingJobs;
  result.heldArchivedMediaJobs = heldArchivedMediaJobs;
  for (const withdrawal of feed.withdrawals) for (const destination of destinations) {
    const key = newsPostKey(withdrawal.id, destination);
    await transition(store, key, async (prior) => {
      if (!prior || sameWithdrawal(prior.withdrawal, withdrawal)) return null;
      const prepared = prior.prepared ? await prepareWithdrawal(prior.prepared,withdrawal) : null;
      return {...prior,withdrawal,prepared,desiredRevision:prepared?.revision || prior.desiredRevision,
        status:["inflight","ambiguous"].includes(prior.status) ? prior.status
          : prior.remoteId ? "correction_pending" : "explicitly_closed",nextDueAt:now.toISOString()};
    });
  }
  // The earlier deployment did not record admissions. Never promise a complete historical replay.
  await transition(store, "history:coverage", (prior) => prior ? null : {
    status: "gap_before_first_observation", observedSince: now.toISOString(),
    reason: "Previous public release has no durable admission journal. Existing remote history must be reconciled before enablement.",
  });
  return result;
}

export async function dispatchNewsJob({ store, key, transport, now = () => new Date(), runnerId = randomUUID() }) {
  const prior = await store.read(key);
  if (!prior.state) return { status: "missing_job" };
  const initial = prior.state;
  if (["sent_current","ambiguous","blocked","explicitly_closed"].includes(initial.status))
    return {status:initial.status,...(initial.status === "blocked" && initial.lastError ? {reason:initial.lastError} : {})};
  const editorialToday = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Moscow",year:"numeric",month:"2-digit",day:"2-digit"}).format(now());
  // Image discovery is opportunistic. A missing or still-loading illustration
  // never holds an otherwise sendable news item; the prepared full text goes
  // out and the editor can add an image manually later.
  if (missingRequiredNewPhoto(initial) && !initial.dispatchStartedAt && initial.status !== "inflight"
    && (!initial.prepared.temporal || newsAnnouncementEligible(initial.prepared.temporal,editorialToday,"Europe/Moscow")))
    return { status: "pending", reason: "new_post_requires_photo", mediaReason: initial.prepared.fallbackReason || "media_unavailable" };
  const destinationKey = `destination:${initial.destination.platform}:${initial.destination.id}`;
  let control = (await store.read(destinationKey)).state;
  if (!control || !["on", "canary"].includes(control.mode) || control.paused || control.historyReconciled !== true)
    return { status: "blocked", reason: "destination_not_enabled_or_history_gap" };
  if (control.mode === "canary" && control.canaryNewsId !== initial.newsId) return { status: "blocked", reason: "outside_canary" };
  if (control.nextDueAt && Date.parse(control.nextDueAt) > now().getTime()) return { status: "pending", reason: "destination_rate_limit" };
  const claim = await transition(store, key, (job) => {
    if (!job || ["sent_current", "ambiguous", "blocked", "explicitly_closed"].includes(job.status)) return null;
    if (job.nextDueAt && Date.parse(job.nextDueAt) > now().getTime()) return null;
    if (job.status === "inflight" && Date.parse(job.leaseUntil) > now().getTime()) return null;
    if (job.dispatchStartedAt) return { ...job, status: "ambiguous", lastError: "dispatch_outcome_unknown" };
    if (job.withdrawal && !job.remoteId) return { ...job, status: "explicitly_closed" };
    if (!job.prepared || job.prepared.revision !== job.desiredRevision)
      return { ...job, status: "blocked", lastError: "prepared_revision_mismatch" };
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).format(now());
    if (job.prepared?.temporal && !newsAnnouncementEligible(job.prepared.temporal, today, "Europe/Moscow") && !job.withdrawal)
      return { ...job, status: "blocked", lastError: "expired_announcement_requires_source_resolution" };
    if (missingRequiredNewPhoto(job)) return { ...job, status: "pending", runnerId: null, leaseUntil: null,
      lastError: "new_post_requires_photo" };
    return { ...job, status: "inflight", runnerId, attemptId: randomUUID(),
      leaseUntil: new Date(now().getTime() + 120000).toISOString() };
  });
  if (!claim.applied || claim.state.status !== "inflight" || claim.state.runnerId !== runnerId)
    return { status: claim.state?.status || "pending", ...(claim.state?.lastError === "new_post_requires_photo"
      ? { reason: "new_post_requires_photo", mediaReason: claim.state.prepared?.fallbackReason || "media_unavailable" } : {}) };
  const job = claim.state;
  let claimId = claim.id;
  let rights;
  try { rights = await transport.preflight(job.destination, {control,requiresMedia:Boolean(job.prepared.media)}); } catch { rights = {ok:false}; }
  if (rights?.ok !== true) {
    await transition(store,destinationKey,(current) => ({...current,paused:true,pauseReason:"destination_rights_unverified"}));
    await store.compareAppend(key,claimId,{...job,status:job.remoteId?"correction_pending":"pending",runnerId:null,leaseUntil:null});
    return {status:"pending",reason:"destination_rights_unverified"};
  }
  // Uploading a VK attachment is not creating a wall post. Keep it before the
  // dispatch marker and acquire a NEW control/version fence after it completes.
  let delivery = null;
  if (job.prepared.media) {
    const beforeUpload = await store.read(destinationKey), currentJob = await store.read(key);
    const uploadControl = beforeUpload.state;
    if (uploadControl?.nextDueAt && Date.parse(uploadControl.nextDueAt)>now().getTime()) {
      await store.compareAppend(key,claimId,{...job,status:job.remoteId?"correction_pending":"pending",runnerId:null,leaseUntil:null});
      return {status:"pending",reason:"destination_rate_limit"};
    }
    if (currentJob.id !== claimId || !uploadControl || uploadControl.paused || !["on","canary"].includes(uploadControl.mode)
      || uploadControl.historyReconciled !== true || uploadControl.mode === "canary" && uploadControl.canaryNewsId !== job.newsId) {
      await store.compareAppend(key,claimId,{...job,status:job.remoteId?"correction_pending":"pending",runnerId:null,leaseUntil:null});
      return {status:"pending",reason:"changed_before_upload"};
    }
    let result;
    try { result = transport.prepareDelivery ? await transport.prepareDelivery({ destination:job.destination,prepared:job.prepared,
      providerAccountId:rights.providerAccountId,cachedMedia:job.mediaCache })
      : {kind:"blocked",code:"media_transport_unavailable"}; }
    catch { result = {kind:"retry",code:"media_upload_not_published",retryAfterSeconds:60}; }
    if (result.kind !== "ready") {
      await store.compareAppend(key,claimId,{...job,status:result.kind === "retry" ? job.remoteId?"correction_pending":"pending" : "blocked",
        lastError:result.code,runnerId:null,leaseUntil:null,
        ...(result.kind === "retry" ? {nextDueAt:new Date(now().getTime()+(result.retryAfterSeconds||60)*1000).toISOString()} : {})});
      if (["retry","auth"].includes(result.scope)) await transition(store,destinationKey,current=>({...current,
        ...(result.scope==="auth"?{paused:true,pauseReason:result.code}:{nextDueAt:new Date(now().getTime()+(result.retryAfterSeconds||60)*1000).toISOString()})}));
      return {status:result.kind === "retry"?"pending":"blocked",
        reason:result.scope==="retry"?"destination_rate_limit":result.scope==="auth"?"destination_rights_unverified":result.code};
    }
    delivery = result.delivery;
    if (delivery?.cache) {
      const cached = await store.compareAppend(key,claimId,{...job,mediaCache:delivery.cache});
      if (!cached.applied) return {status:"pending",reason:"changed_during_upload"};
      claimId = cached.id; job.mediaCache = delivery.cache;
    }
    const afterUploadControl = (await store.read(destinationKey)).state;
    try { rights = await transport.preflight(job.destination,{control:afterUploadControl,requiresMedia:true}); } catch { rights = {ok:false}; }
    if (rights?.ok !== true || delivery?.providerAccountId && rights.providerAccountId !== delivery.providerAccountId) {
      await transition(store,destinationKey,(current)=>({...current,paused:true,pauseReason:"destination_rights_unverified"}));
      await store.compareAppend(key,claimId,{...job,status:job.remoteId?"correction_pending":"pending",runnerId:null,leaseUntil:null});
      return {status:"pending",reason:"destination_rights_unverified"};
    }
  }
  const controlRow = await store.read(destinationKey);
  control = controlRow.state;
  const latest = await store.read(key);
  if (latest.id !== claimId || !control || control.paused || !["on", "canary"].includes(control.mode)
    || (control.mode === "canary" && control.canaryNewsId !== job.newsId) || control.historyReconciled !== true) {
    await store.compareAppend(key, claimId, { ...job, status: job.remoteId ? "correction_pending" : "pending", runnerId: null });
    return { status: "pending", reason: "changed_before_dispatch" };
  }
  if (await newsSocialPayloadDigest(job.prepared.payload) !== job.prepared.payloadSha256) {
    await store.compareAppend(key,claimId,{...job,status:"blocked",lastError:"prepared_bytes_changed",runnerId:null,leaseUntil:null});
    return {status:"blocked",reason:"prepared_bytes_changed"};
  }
  // Only new posts consume a channel slot. Corrections retain their existing
  // remote identity and remain available while the next create is waiting.
  if (!job.remoteId) {
    const slot = await reserveNewsDeliverySlot({store,destination:job.destination,now:now(),
      jobKey:key,attemptId:job.attemptId});
    if (!slot.applied) {
      await store.compareAppend(key,claimId,{...job,status:"pending",runnerId:null,leaseUntil:null,
        ...(slot.nextDueAt ? {nextDueAt:slot.nextDueAt} : {}),lastError:slot.reason});
      return {status:"pending",reason:"destination_pacing",nextDueAt:slot.nextDueAt};
    }
  }
  const started = await store.compareAppend(key, claimId, { ...job, dispatchStartedAt: now().toISOString() },
    { key: destinationKey, id: controlRow.id });
  if (!started.applied) return { status: "pending", reason: "claim_superseded" };
  let outcome;
  try { outcome = await transport.send({ destination: job.destination, prepared: job.prepared, remoteId: job.remoteId || null,
    remoteMediaKind:job.remoteMediaKind || "text",delivery }); }
  catch { outcome = { kind: "ambiguous", code: "transport_exception" }; }
  const acknowledgedAt = outcome.kind === "accepted" ? now().toISOString() : null;
  const receipt = await transition(store, key, (current) => {
    if (current.attemptId !== job.attemptId) return null;
    if (outcome.kind === "accepted") return { ...current, remoteId: outcome.remoteId, remoteUrl: outcome.remoteUrl,
      remoteMediaKind:outcome.remoteMediaKind || (job.prepared.media ? "photo" : "text"),
      mediaCache:outcome.mediaCache || current.mediaCache || null,
      acknowledgedRevision: job.desiredRevision, acknowledgedAt, acknowledgedUnchanged: outcome.unchanged === true,
      // Editing an old remote ID cannot prove its original publication date.
      firstAcknowledgedAt: current.firstAcknowledgedAt || (!job.remoteId ? acknowledgedAt : null),
      status: current.status === "blocked" && current.lastError === "post_preparation_invalid" ? "blocked"
        : current.withdrawal ? job.withdrawal && sameWithdrawal(job.withdrawal, current.withdrawal)
          ? "explicitly_closed" : "correction_pending"
        : current.desiredRevision === job.desiredRevision ? "sent_current" : "correction_pending",
      dispatchStartedAt: null, runnerId: null, leaseUntil: null,
      lastError: current.status === "blocked" && current.lastError === "post_preparation_invalid" ? current.lastError : null };
    if (outcome.kind === "retry") return { ...current, status: current.remoteId ? "correction_pending" : "pending",
      nextDueAt: new Date(now().getTime() + outcome.retryAfterSeconds * 1000).toISOString(),
      dispatchStartedAt: null, runnerId: null, leaseUntil: null, lastError: outcome.code };
    return { ...current, status: outcome.kind === "blocked" ? "blocked" : "ambiguous", lastError: outcome.code,
      ...(outcome.kind === "blocked" ? { dispatchStartedAt: null, runnerId: null, leaseUntil: null } : {}) };
  });
  if (["retry", "auth"].includes(outcome.scope)) await transition(store, destinationKey, (current) => ({ ...current,
    ...(outcome.scope === "auth" ? { paused: true, pauseReason: outcome.code }
      : { nextDueAt: new Date(now().getTime() + outcome.retryAfterSeconds * 1000).toISOString() }) }));
  return { status: receipt.state?.status || "ambiguous", remoteId: receipt.state?.remoteId || null, dispatchAttempted: true,
    ...(outcome.kind === "accepted" && outcome.unchanged === true ? { unchanged: true } : {}) };
}

/** Inspect at most the captured row count; unavailable destinations consume no send slots.
 * Dispatch still rechecks controls and uses the atomic SQL guard after this optimization.
 */
export async function dispatchNewsBatch({ store, jobs, transport, now = () => new Date(), limit = 25 }) {
  if (!Array.isArray(jobs) || !Number.isSafeInteger(limit) || limit < 1 || limit > 25) throw new Error("dispatch_budget_invalid");
  const controls = new Map(), outcomes = [];
  let attempts = 0;
  for (const job of scheduleNewsJobs(jobs)) {
    if (attempts >= limit) break;
    if (job.nextDueAt && Date.parse(job.nextDueAt) > now().getTime()
      || job.status === "inflight" && Date.parse(job.leaseUntil) > now().getTime()) continue;
    const controlKey = `destination:${job.destination.platform}:${job.destination.id}`;
    if (!controls.has(controlKey)) controls.set(controlKey, (await store.read(controlKey)).state);
    const control = controls.get(controlKey);
    if (!control || control.paused || !["on", "canary"].includes(control.mode) || control.historyReconciled !== true
      || control.mode === "canary" && control.canaryNewsId !== job.newsId
      || control.nextDueAt && Date.parse(control.nextDueAt) > now().getTime()) continue;
    try {
      const outcome = await dispatchNewsJob({ store, key: job.key, transport, now });
      outcomes.push({ key: job.key, ...outcome });
      if (outcome.dispatchAttempted) attempts++;
      if (["destination_not_enabled_or_history_gap", "destination_rate_limit", "destination_rights_unverified", "destination_pacing"].includes(outcome.reason))
        controls.set(controlKey, null);
    } catch (error) {
      if (isNewsRuntimeQuotaError(error)) throw error;
      // A storage failure may follow a real external call; count it conservatively.
      attempts++;
      outcomes.push({ key: job.key, status: "ambiguous", reason: "runtime_failure_requires_reconciliation" });
    }
  }
  return outcomes;
}

/** Corrections keep their identities and go first. New photos precede text;
 * each group interleaves oldest and newest arrivals without starving its tail. */
export function scheduleNewsJobs(jobs) {
  const byAge = (a, b) => a.originalAdmission.localeCompare(b.originalAdmission) || a.key.localeCompare(b.key);
  const corrections = jobs.filter((j) => j.status === "correction_pending").sort(byAge);
  const ordered = [];
  const pending=jobs.filter(j=>["pending","inflight"].includes(j.status));
  for(const hasPhoto of [true,false]){
    const group=pending.filter(job=>Boolean(job.prepared?.media)===hasPhoto).sort(byAge);
    while(group.length){ordered.push(group.shift());if(group.length)ordered.push(group.pop());}
  }
  return [...corrections, ...ordered];
}
