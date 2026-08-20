import { createHash } from "node:crypto";

const CMS_ARTICLE_ID =
  /^cms-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/iu;

export function normalizeOutboxHighWater(value, label = "outbox high-water mark") {
  if (
    typeof value === "number" &&
    (!Number.isSafeInteger(value) || value < 0)
  ) {
    throw new Error(`${label} is not a safe integer.`);
  }
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/u.test(normalized)) {
    throw new Error(`${label} is missing or invalid.`);
  }
  const parsed = BigInt(normalized);
  if (parsed < 0n) throw new Error(`${label} cannot be negative.`);
  return parsed.toString();
}

export function normalizePublicationHeadSource(
  value,
  label = "publication head source"
) {
  const normalized = String(value || "").trim();
  if (normalized !== "outbox" && normalized !== "legacy-audit") {
    throw new Error(`${label} is missing or invalid.`);
  }
  return normalized;
}

export function normalizePublicationHead(value, label = "publication head") {
  if (typeof value === "string" || typeof value === "number") {
    return {
      source: "outbox",
      outboxHighWater: normalizeOutboxHighWater(value, `${label} outbox high-water`),
      legacyAuditHighWater: "0",
    };
  }
  const source = normalizePublicationHeadSource(value?.source, `${label} source`);
  const outboxHighWater = normalizeOutboxHighWater(
    value?.outboxHighWater ?? 0,
    `${label} outbox high-water`
  );
  if (source === "legacy-audit" && outboxHighWater !== "0") {
    throw new Error(`${label} cannot carry an outbox marker before the outbox exists.`);
  }
  return {
    source,
    outboxHighWater,
    legacyAuditHighWater: normalizeOutboxHighWater(
      value?.legacyAuditHighWater ?? 0,
      `${label} legacy audit high-water`
    ),
  };
}

export function publicationHeadMarker(value) {
  const head = normalizePublicationHead(value);
  return [
    head.source === "outbox" && head.outboxHighWater !== "0"
      ? `outbox:${head.outboxHighWater}`
      : "",
    head.legacyAuditHighWater !== "0"
      ? `legacy-audit:${head.legacyAuditHighWater}`
      : "",
  ]
    .filter(Boolean)
    .join(",");
}

export function publicationHeadProgress(previousValue, nextValue) {
  const previous = normalizePublicationHead(previousValue, "previous publication head");
  const next = normalizePublicationHead(nextValue, "next publication head");
  if (
    BigInt(next.legacyAuditHighWater) <
      BigInt(previous.legacyAuditHighWater) ||
    (previous.source === "outbox" && next.source === "legacy-audit") ||
    (previous.source === "outbox" &&
      next.source === "outbox" &&
      BigInt(next.outboxHighWater) < BigInt(previous.outboxHighWater))
  ) {
    throw new Error(
      `CMS publication head moved backwards (${publicationHeadMarker(previous) || `${previous.source}:0`} -> ${publicationHeadMarker(next) || `${next.source}:0`}).`
    );
  }
  const exact =
    previous.source === next.source &&
    previous.outboxHighWater === next.outboxHighWater &&
    previous.legacyAuditHighWater === next.legacyAuditHighWater;
  return { state: exact ? "current" : "advanced", previous, next };
}

export function cmsSourceArticleId(publicId) {
  return CMS_ARTICLE_ID.exec(String(publicId || ""))?.[1] || "";
}

export function articleIdSet(articles, label = "snapshot") {
  if (!Array.isArray(articles)) throw new Error(`${label} articles are not an array.`);
  const ids = new Set();
  for (const article of articles) {
    const id = String(article?.id || "").trim();
    if (!cmsSourceArticleId(id)) {
      throw new Error(`${label} contains an invalid CMS article identity: ${id || "<empty>"}.`);
    }
    if (ids.has(id)) throw new Error(`${label} contains duplicate article ${id}.`);
    ids.add(id);
  }
  return ids;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function contentPayload(snapshot) {
  const {
    generatedAt: _generatedAt,
    publication: _publication,
    ...content
  } = snapshot;
  return content;
}

export function publicationMetadata(
  snapshot,
  publicationHead,
  headSource = "outbox"
) {
  const head = normalizePublicationHead(
    typeof publicationHead === "object"
      ? publicationHead
      : {
          source: headSource,
          outboxHighWater:
            headSource === "outbox" ? publicationHead : 0,
          legacyAuditHighWater:
            headSource === "legacy-audit" ? publicationHead : 0,
        },
    "candidate publication head"
  );
  const ids = [...articleIdSet(snapshot.articles, "candidate snapshot")].sort();
  return {
    protocolVersion: 1,
    headSource: head.source,
    outboxHighWater: head.outboxHighWater,
    legacyAuditHighWater: head.legacyAuditHighWater,
    articleCount: ids.length,
    articleSetSha256: sha256(JSON.stringify(ids)),
    contentSha256: sha256(JSON.stringify(contentPayload(snapshot))),
  };
}

export function assertPublicationMetadata(snapshot, label = "candidate snapshot") {
  const metadata = snapshot?.publication;
  if (!metadata || metadata.protocolVersion !== 1) {
    throw new Error(`${label} has no supported publication metadata.`);
  }
  const expected = publicationMetadata(
    snapshot,
    {
      // Snapshots created before the compatibility rollout always used the
      // transactional outbox. Preserve that interpretation when validating a
      // deployed protocol-v1 baseline with no explicit source field.
      source: metadata.headSource ?? "outbox",
      outboxHighWater: metadata.outboxHighWater,
      legacyAuditHighWater: metadata.legacyAuditHighWater ?? 0,
    }
  );
  for (const field of ["articleCount", "articleSetSha256", "contentSha256"]) {
    if (metadata[field] !== expected[field]) {
      throw new Error(`${label} publication ${field} does not match its content.`);
    }
  }
  return expected;
}

export function assertStableOutboxWindow(startValue, endValue) {
  const start = normalizeOutboxHighWater(startValue, "starting outbox high-water mark");
  const end = normalizeOutboxHighWater(endValue, "ending outbox high-water mark");
  if (start !== end) {
    const error = new Error(
      `CMS changed during export (public build outbox ${start} -> ${end}); retrying from a fresh snapshot.`
    );
    error.code = "CMS_SNAPSHOT_CHANGED";
    throw error;
  }
  return end;
}

export function assertStablePublicationHeadWindow(startValue, endValue) {
  const start = normalizePublicationHead(startValue, "starting publication head");
  const end = normalizePublicationHead(endValue, "ending publication head");
  const progress = publicationHeadProgress(start, end);
  if (progress.state !== "current") {
    const error = new Error(
      `CMS changed during export (publication head ${publicationHeadMarker(start) || `${start.source}:0`} -> ${publicationHeadMarker(end) || `${end.source}:0`}); retrying from a fresh snapshot.`
    );
    error.code = "CMS_SNAPSHOT_CHANGED";
    throw error;
  }
  return start;
}

function baselineMarker(snapshot) {
  const value = snapshot?.publication?.outboxHighWater;
  return value === undefined || value === null || value === ""
    ? null
    : normalizePublicationHead(
        {
          source: snapshot.publication.headSource ?? "outbox",
          outboxHighWater: value,
          legacyAuditHighWater: snapshot.publication.legacyAuditHighWater ?? 0,
        },
        "baseline publication head"
      );
}

/**
 * Prevents a stale/partial candidate from replacing the currently deployed
 * article set. A real withdrawal is accepted only when the authoritative CMS
 * now says that every missing row is deleted or no longer published.
 */
export function assertCandidateCanReplaceBaseline({
  candidate,
  baseline,
  authoritativeStates = new Map(),
}) {
  const candidateMetadata = assertPublicationMetadata(candidate);
  const candidateIds = articleIdSet(candidate.articles, "candidate snapshot");
  if (!baseline?.articles) return { removedIds: [] };

  const baselineIds = articleIdSet(baseline.articles, "deployed baseline");
  const deployedMarker = baselineMarker(baseline);
  if (deployedMarker !== null) {
    const candidateMarker = {
      source: candidateMetadata.headSource,
      outboxHighWater: candidateMetadata.outboxHighWater,
      legacyAuditHighWater: candidateMetadata.legacyAuditHighWater,
    };
    try {
      publicationHeadProgress(deployedMarker, candidateMarker);
    } catch (error) {
      throw new Error(
        `Candidate ${publicationHeadMarker(candidateMarker) || `${candidateMarker.source}:0`} is older than deployed ${publicationHeadMarker(deployedMarker) || `${deployedMarker.source}:0`}.`,
        { cause: error }
      );
    }
  }

  const removedIds = [...baselineIds].filter((id) => !candidateIds.has(id)).sort();
  const stillPublished = removedIds.filter((publicId) => {
    const sourceId = cmsSourceArticleId(publicId);
    const state = authoritativeStates.get(sourceId);
    return state?.status === "published" && state.deleted_at == null;
  });
  const unknown = removedIds.filter((publicId) => {
    const sourceId = cmsSourceArticleId(publicId);
    return !authoritativeStates.has(sourceId);
  });

  if (stillPublished.length) {
    throw new Error(
      `Candidate would drop ${stillPublished.length} article(s) still published in CMS: ${stillPublished.join(", ")}.`
    );
  }
  // Missing source rows are authoritative hard deletions. The caller records
  // them explicitly with a null state so a failed/partial verification cannot
  // accidentally look like an intentional deletion.
  if (unknown.length) {
    throw new Error(
      `Candidate withdrawal state was not verified for: ${unknown.join(", ")}.`
    );
  }

  return { removedIds };
}
