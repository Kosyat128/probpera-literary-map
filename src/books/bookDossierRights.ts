import type { BookDossierBlock, BookDossierDraft, BookDossierIssue, BookDossierRightsEnvelope } from "./bookDossierDocument";

export function canonicalBookDossierJson(value: unknown): string {
  const normalize = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(normalize);
    if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => [key, normalize(item)]));
    return entry;
  };
  return JSON.stringify(normalize(value));
}

export async function bookDossierChecksum(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalBookDossierJson(value)));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function bookDossierBlockChecksum(block: BookDossierBlock) {
  const { rightsId: _rightsId, ...content } = block;
  return bookDossierChecksum(content);
}

/** Review stamps are audit metadata; changing any text, source or grant term invalidates every review. */
export function bookDossierDraftChecksum(draft: BookDossierDraft) {
  return bookDossierChecksum({ ...draft,
    sources: draft.sources.map(({ reviewedBy: _actor, reviewedAt: _at, ...source }) => source),
    rights: draft.rights.map(({ reviewedBy: _actor, reviewedAt: _at, reviewKind: _kind, translation, ...grant }) => ({
      ...grant, ...(translation ? { translation: (({ reviewedBy: _translatorActor, reviewedAt: _translationAt, ...terms }) => terms)(translation) } : {}),
    })),
  });
}

export async function bookDossierRightsIssues(block: BookDossierBlock, grant: BookDossierRightsEnvelope | undefined, options: {
  now: number;
  bookKey: string;
  currentArticleVersions?: Readonly<Record<string, string>>;
  currentArticleReuseApprovals?: Readonly<Record<string, string>>;
}): Promise<BookDossierIssue[]> {
  const issues: BookDossierIssue[] = [];
  const fail = (code: string) => { issues.push({ code, path: `blocks.${block.id}` }); };
  if (["quote", "media", "full-text"].includes(block.kind)) {
    fail("hosted-protected-content-disabled"); return issues;
  }
  if (!grant) { fail("rights-missing"); return issues; }
  const expected = block.kind === "metadata" ? "FACTUAL_METADATA" :
    ["sources", "legal-links", "related-articles"].includes(block.kind) ? "EXTERNAL_LINK_ONLY" : "EDITORIAL_OWNED";
  if (grant.classification !== expected) fail("rights-classification-blocked");
  if (grant.reviewKind !== "HUMAN" || !grant.reviewedBy || !grant.reviewedAt || Date.parse(grant.reviewedAt) > options.now) fail("human-rights-review-required");
  if (!grant.evidenceIds.length || !grant.author || !grant.rightsHolder || !grant.rightsBasis) fail("rights-evidence-missing");
  if (!grant.territories.includes("WORLDWIDE")) fail("worldwide-scope-required");
  if (grant.revokedAt) fail("rights-revoked");
  if (!Number.isFinite(options.now) || Date.parse(grant.startsAt) > options.now ||
    Date.parse(grant.recheckAt) <= options.now || grant.expiresAt && Date.parse(grant.expiresAt) <= options.now) fail("rights-expired-or-not-active");
  if (grant.originalWork !== options.bookKey) fail("rights-work-mismatch");
  if (!grant.allowHTML || !grant.allow3D || !grant.allowedSurfaces.includes("HTML") || !grant.allowedSurfaces.includes("3D")) fail("shared-render-surface-not-approved");
  if (grant.allowDownload || grant.allowedSurfaces.includes("DOWNLOAD")) fail("download-delivery-disabled");
  const checksum = await bookDossierBlockChecksum(block);
  if (grant.contentChecksum !== checksum) fail("rights-checksum-mismatch");
  if (block.translationId || grant.translation) {
    const translation = grant.translation;
    if (!translation || block.translationId !== translation.id || translation.approvedTextChecksum !== checksum ||
      !translation.translator || !translation.rightsBasis || !translation.evidenceIds.length ||
      !translation.reviewedBy || !translation.reviewedAt || Date.parse(translation.reviewedAt) > options.now) fail("translation-rights-mismatch");
  }
  if (block.articleReuse) {
    const reuse = block.articleReuse;
    if (reuse.reuseInBookDossier !== true || !reuse.approvedBy || Date.parse(reuse.approvedAt) > options.now ||
      options.currentArticleVersions?.[reuse.articleId] !== reuse.sourceVersion ||
      options.currentArticleReuseApprovals?.[`${reuse.articleId}:${reuse.sourceBlockId}`] !== reuse.checksum ||
      block.paragraphs.join("\n\n") !== reuse.approvedExcerpt ||
      reuse.checksum !== await bookDossierChecksum(reuse.approvedExcerpt)) fail("article-reuse-re-review-required");
  }
  return issues;
}
