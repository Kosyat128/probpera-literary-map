import { buildNewsIngestion } from "./literary-news-ingestion.mjs";
import { syncNewsStorage } from "./literary-news-kv-sync.mjs";
import { validateDailyApprovedPayload } from "./literary-news-daily-profile.mjs";

/** Source URLs are accepted only from the full, privately read profile proof.
 * Neither a public machine flag nor a public-feed item can remove held evidence. */
export async function readApprovedDailyQueueProfile(storage, current = new Date()) {
  if (typeof storage?.readDailyApprovedProfile !== "function") throw Error("daily_queue_profile_reader_required");
  const raw = await storage.readDailyApprovedProfile();
  if (raw === null) return null;
  let value;
  try { value = JSON.parse(raw); } catch { throw Error("daily_queue_profile_invalid"); }
  return validateDailyApprovedPayload(value, current);
}

/** Read private approval evidence before any collector or remote mutation. */
export async function syncDailyAwareNewsStorage({ storage, collect, current = new Date() }) {
  const approvedReview = await readApprovedDailyQueueProfile(storage, current);
  return syncNewsStorage({ storage, collect: snapshots => collect({ ...snapshots, approvedReview }) });
}

/** Validate again at the collection boundary, before counts, byte bounds and
 * ingestion hashes are generated. Filtering covers old finds and fresh repeats. */
export async function buildDailyAwareNewsIngestion({ approvedReview = null, ...options }) {
  const profile = approvedReview === null ? null
    : await validateDailyApprovedPayload(approvedReview, options.current ?? new Date());
  return buildNewsIngestion({ ...options,
    approvedSourceUrls: profile ? profile.records.map(record => record.source.url) : [] });
}
