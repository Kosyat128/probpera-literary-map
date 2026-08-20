import {
  normalizeOutboxHighWater,
  normalizePublicationHeadSource,
} from "./cms-publication-state.mjs";

export const OUTBOX_PUBLICATION_HEAD = "outbox";
export const LEGACY_AUDIT_PUBLICATION_HEAD = "legacy-audit";

function headers(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
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

/**
 * Reads the transactional outbox head when the 20260814 migration is present.
 * During the bounded pre-migration compatibility window, the legacy audit
 * request sequence is the only durable publication head. Only PostgREST's
 * exact missing-relation response enables that fallback; auth, RLS, network,
 * cache, and malformed-response failures remain fail closed. The legacy head
 * is always read as a second component because admin clients can keep writing
 * compatibility requests during PostgREST's migration/schema-cache window.
 */
export async function fetchCmsPublicationHead({
  supabaseUrl,
  serviceKey,
  fetchImpl = fetch,
}) {
  const requestHeaders = headers(serviceKey);
  const query = new URLSearchParams({
    select: "id",
    action: "in.(public_build.requested,public_build.failed)",
    order: "id.desc",
    limit: "1",
  });
  const [outboxResponse, legacyRows] = await Promise.all([
    fetchImpl(
      `${supabaseUrl}/rest/v1/public_build_outbox?select=id&order=id.desc&limit=1`,
      { headers: requestHeaders }
    ),
    rows(
      await fetchImpl(
        `${supabaseUrl}/rest/v1/admin_audit_log?${query.toString()}`,
        { headers: requestHeaders }
      ),
      "Legacy CMS publication audit head"
    ),
  ]);

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
