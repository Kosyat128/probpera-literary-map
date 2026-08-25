import {
  normalizeOutboxHighWater,
  normalizePublicationHeadSource,
} from "./cms-publication-state.mjs";

export const OUTBOX_PUBLICATION_HEAD = "outbox";
export const LEGACY_AUDIT_PUBLICATION_HEAD = "legacy-audit";

const JWT_FUTURE_RETRY_DELAYS_MS = Object.freeze([1_000, 3_000, 6_000]);

function headers(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function rows(response, label) {
  if (!response.ok) {
    throw new Error(`${label} failed: ${response.status} ${await response.text()}`);
  }
  const value = await response.json();
  if (!Array.isArray(value)) {
    throw new Error(`${label} returned a non-array body.`);
  }
  return value;
}

export function isMissingPublicationOutbox(status, body) {
  if (status !== 404) return false;
  let error;
  try {
    error = JSON.parse(body);
  } catch {
    return false;
  }
  return (
    error?.code === "PGRST205" &&
    /public_build_outbox/u.test(
      [error?.message, error?.details, error?.hint].filter(Boolean).join(" ")
    )
  );
}

export function isJwtIssuedAtFutureResponse(status, body) {
  if (status !== 401) return false;
  let error;
  try {
    error = JSON.parse(body);
  } catch {
    return false;
  }
  return (
    error?.code === "PGRST303" &&
    String(error?.message || "").trim().toLowerCase() === "jwt issued at future"
  );
}

async function fetchWithJwtFutureRetry({
  url,
  init,
  fetchImpl,
  sleepImpl,
  retryDelaysMs,
}) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetchImpl(url, init);
    if (response.ok) return response;

    const body = await response.clone().text();
    const retryDelay = retryDelaysMs[attempt];
    if (
      !isJwtIssuedAtFutureResponse(response.status, body) ||
      !Number.isFinite(retryDelay) ||
      retryDelay < 0
    ) {
      return response;
    }

    await sleepImpl(retryDelay);
  }
}

/**
 * Reads the transactional outbox head when the 20260814 migration is present.
 * During the bounded pre-migration compatibility window, the legacy audit
 * request sequence is the only durable publication head. Only PostgREST's
 * exact missing-relation response enables that fallback; auth, RLS, network,
 * cache, and malformed-response failures remain fail closed. The legacy head
 * is always read as a second component because admin clients can keep writing
 * compatibility requests during PostgREST's migration/schema-cache window.
 *
 * PostgREST can transiently reject an otherwise valid service-role JWT with
 * PGRST303 / "JWT issued at future" when clocks briefly disagree. Retry only
 * that exact response for a bounded period; every other auth/error response
 * remains fail closed and the publication-head comparison is never bypassed.
 */
export async function fetchCmsPublicationHead({
  supabaseUrl,
  serviceKey,
  fetchImpl = fetch,
  sleepImpl = sleep,
  jwtFutureRetryDelaysMs = JWT_FUTURE_RETRY_DELAYS_MS,
}) {
  const requestHeaders = headers(serviceKey);
  const request = (url) =>
    fetchWithJwtFutureRetry({
      url,
      init: { headers: requestHeaders },
      fetchImpl,
      sleepImpl,
      retryDelaysMs: jwtFutureRetryDelaysMs,
    });
  const query = new URLSearchParams({
    select: "id",
    action: "in.(public_build.requested,public_build.failed)",
    order: "id.desc",
    limit: "1",
  });
  const [outboxResponse, legacyResponse] = await Promise.all([
    request(
      `${supabaseUrl}/rest/v1/public_build_outbox?select=id&order=id.desc&limit=1`
    ),
    request(`${supabaseUrl}/rest/v1/admin_audit_log?${query.toString()}`),
  ]);
  const legacyRows = await rows(
    legacyResponse,
    "Legacy CMS publication audit head"
  );

  let source;
  let outboxHighWater = "0";
  if (outboxResponse.ok) {
    const outboxRows = await rows(outboxResponse, "CMS publication outbox head");
    source = OUTBOX_PUBLICATION_HEAD;
    outboxHighWater = normalizeOutboxHighWater(
      outboxRows[0]?.id ?? 0,
      "CMS publication outbox head"
    );
  } else {
    const body = await outboxResponse.text();
    if (!isMissingPublicationOutbox(outboxResponse.status, body)) {
      throw new Error(
        `CMS publication outbox head failed: ${outboxResponse.status} ${body}`
      );
    }
    source = LEGACY_AUDIT_PUBLICATION_HEAD;
  }

  return {
    source: normalizePublicationHeadSource(source),
    outboxHighWater,
    legacyAuditHighWater: normalizeOutboxHighWater(
      legacyRows[0]?.id ?? 0,
      "legacy CMS publication audit head"
    ),
  };
}
