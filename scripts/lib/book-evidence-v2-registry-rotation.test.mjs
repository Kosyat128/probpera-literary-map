import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildBookArchive } from "../../src/data/bookArchive.ts";
import { bookArchiveCountries } from "../../src/data/countries/index.ts";
import { bookEvidenceV2Issues } from "../../src/data/bookEvidence.ts";
import { canonicalLiteraryArchiveReleasePayload } from "./literary-archive-atomic-release.mjs";
import {
  BOOK_EVIDENCE_V2_REGISTRY_TRANSITION as transition,
  BOOK_EVIDENCE_V2_REVIEWED_WRITER_REFERENCE as writerReference,
  BOOK_EVIDENCE_V2_DRAFT_WRITER_REFERENCE as draftReference,
  buildEvidenceV2RegistryRotation,
  buildEvidenceV2ReviewedWriterReference,
  buildEvidenceV2DraftWriterReference,
  evidenceV2ProfileFromLiveContent,
  evidenceV2RegistryPreflightIdentity,
} from "./book-evidence-v2-registry-rotation.mjs";

const canonRegistry = JSON.parse(readFileSync("data/book-canon-source-registry.json", "utf8"));
const target = { canonRegistrySha256: transition.targetSha256,
  canonRegistryVersion: transition.canonRegistryVersion, validatorSha256: transition.validatorSha256 };
const control = { singleton: true, enforcement_enabled: true,
  contract_version: transition.contractVersion, validator_id: transition.validator,
  validator_version: transition.validatorVersion, validator_sha256: transition.validatorSha256,
  canon_registry_version: transition.canonRegistryVersion,
  canon_registry_sha256: transition.expectedOldSha256 };
const hash = (value) => createHash("sha256").update(canonicalLiteraryArchiveReleasePayload(value)).digest("hex");
const book = buildBookArchive(bookArchiveCountries).find((work) =>
  work.countryId === "england" && work.writerId === "charles_dickens" && work.id === "great-expectations");

function snapshot() {
  if (!book) throw new Error("Missing reviewed Dickens fixture");
  const legacyId = `${book.countryId}:${book.writerId}:${book.id}`;
  const content = JSON.parse(JSON.stringify({
    work: { legacyId, countryId: book.countryId, writerId: book.writerId,
      title: book.title, slug: book.id, originalTitle: book.originalTitle,
      firstPublished: book.firstPublished, originalLanguage: book.originalLanguage,
      genres: book.genres, tags: book.tags || [], description: book.description,
      sourceUrl: book.sourceUrl, editorialStatus: book.editorial.status,
      reviewedAt: book.editorial.reviewedAt,
      metadata: { localizedTitles: book.localizedTitles, canon: book.canon },
      authorshipKind: book.authorship?.kind ?? null },
    translations: Object.values(book.translations).map((row) => ({
      locale: row.locale, title: row.title, description: row.description,
      sourceLanguage: row.sourceLanguage, method: row.method, status: row.status,
      sourceUrls: row.sourceUrls, reviewedAt: row.reviewedAt,
      metadata: { titleEvidence: row.titleEvidence, descriptionProvenance: row.descriptionProvenance },
    })),
    sources: book.sources.map(({ provider, url, fields, license, usage, retrievedAt, ...metadata }) => ({
      provider, url, fields, license: license ?? null, usage, retrievedAt, metadata,
    })),
    externalIds: book.externalIds || [],
    authors: (book.authorship?.authors || []).map((author, position) => ({
      position, countryId: author.countryId, writerId: author.writerId,
      creditNameRu: author.creditNames?.ru, creditNameEn: author.creditNames?.en,
      attribution: author.attribution || "credited", metadata: {},
    })),
    editions: [], artworks: [],
  }));
  return { workId: "00000000-0000-4000-8000-000000000001", legacyId,
    updatedAt: "2026-09-12T00:00:00Z", isCmsLocked: true,
    content, contentSha256: hash(content) };
}
function input(cms = snapshot()) {
  return { snapshot: { contract: transition.contract, priorPublicLegacyIds: [cms.legacyId], cmsLockedWorks: [cms] },
    expectedCmsLegacyIds: [cms.legacyId], releaseItems: [], canonRegistry,
    ...target, issuesForWork: bookEvidenceV2Issues, today: "2026-09-12" };
}

describe("exact Evidence V2 registry transition", () => {
  it("checks health at the old active pin only for the installed exact capability", () => {
    expect(evidenceV2RegistryPreflightIdentity(control, target, transition)).toEqual({
      activeRegistrySha256: transition.expectedOldSha256, rotation: transition,
    });
    expect(() => evidenceV2RegistryPreflightIdentity(control, target, null)).toThrow(/approved transition/u);
    expect(() => evidenceV2RegistryPreflightIdentity(control, target, { ...transition, unsafe: true })).toThrow();
  });
  it("returns the ordinary path once the target is active and rejects unknown identities", () => {
    expect(evidenceV2RegistryPreflightIdentity({ ...control, canon_registry_sha256: target.canonRegistrySha256 }, target, null).rotation).toBeNull();
    for (const field of ["validator_sha256", "canon_registry_sha256", "validator_version", "contract_version", "validator_id"]) {
      expect(() => evidenceV2RegistryPreflightIdentity({ ...control, [field]: "unknown" }, target, transition)).toThrow();
    }
    expect(() => evidenceV2RegistryPreflightIdentity(control, { ...target, canonRegistrySha256: "a".repeat(64) }, transition)).toThrow();
  });
  it("revalidates the actual CMS text with the real unchanged validator and retains its history", () => {
    const cms = snapshot();
    const before = structuredClone(cms);
    const result = buildEvidenceV2RegistryRotation(input(cms));
    expect(result.cmsLockedProofs).toHaveLength(1);
    const proof = result.cmsLockedProofs[0];
    expect(proof.expectedContent).toEqual(cms.content);
    expect(proof.evidence.validation.canonRegistrySha256).toBe(transition.targetSha256);
    expect(proof.evidence.descriptions.ru.reviewedBy).toBe(book.translations.ru.descriptionProvenance.reviewedBy);
    expect(proof.evidence.descriptions.ru.reviewedAt).toBe(book.translations.ru.descriptionProvenance.reviewedAt);
    expect(proof.evidence.descriptions.en.reviewedBy).toBe(book.translations.en.descriptionProvenance.reviewedBy);
    expect(cms).toEqual(before);
    expect(result.coverageSha256).toBe(hash({ priorPublicLegacyIds: result.priorPublicLegacyIds, cmsLockedProofs: result.cmsLockedProofs }));
  });
  it("blocks missing private CMS provenance even when the local reviewed card exists", () => {
    const cms = snapshot();
    cms.content.work.metadata = {};
    for (const row of cms.content.translations) row.metadata = {};
    cms.contentSha256 = hash(cms.content);
    expect(() => buildEvidenceV2RegistryRotation(input(cms))).toThrow(/CMS registry rotation validation failed/u);
  });
  it("rejects stale content hashes, unlocked rows, incomplete projections and duplicate locales", () => {
    for (const mutate of [
      (cms) => { cms.content.work.title = "Unexpected edit"; },
      (cms) => { cms.isCmsLocked = false; },
      (cms) => { delete cms.content.artworks; cms.contentSha256 = hash(cms.content); },
      (cms) => { cms.content.translations.push(cms.content.translations[0]); cms.contentSha256 = hash(cms.content); },
      (cms) => { cms.legacyId = "other:writer:book"; },
    ]) {
      const cms = snapshot(); mutate(cms);
      expect(() => evidenceV2ProfileFromLiveContent(cms)).toThrow();
    }
  });
  it("requires complete unique predecessor and CMS coverage", () => {
    const args = input();
    expect(() => buildEvidenceV2RegistryRotation({ ...args, expectedCmsLegacyIds: [] })).toThrow(/coverage/u);
    args.snapshot.cmsLockedWorks.push(args.snapshot.cmsLockedWorks[0]);
    expect(() => buildEvidenceV2RegistryRotation(args)).toThrow(/coverage/u);
    const missing = input(); missing.snapshot.priorPublicLegacyIds.push("england:writer:old-public");
    expect(() => buildEvidenceV2RegistryRotation(missing)).toThrow(/fresh staged predecessor/u);
  });
  it("rejects stale evidence for any previously public unlocked record", () => {
    const args = input(); const key = "england:writer:old-public";
    args.snapshot.priorPublicLegacyIds.push(key);
    args.releaseItems.push({ legacyId: key, attestation: { evidence: { recordKey: key,
      validation: { validatorSha256: transition.validatorSha256, canonRegistrySha256: transition.expectedOldSha256 } } } });
    expect(() => buildEvidenceV2RegistryRotation(args)).toThrow(/fresh staged predecessor/u);
    args.releaseItems[0].attestation.evidence.validation.canonRegistrySha256 = transition.targetSha256;
    expect(buildEvidenceV2RegistryRotation(args).priorPublicLegacyIds).toContain(key);
  });
  it("binds the sole new reviewed writer reference to its exact staged evidence", () => {
    expect(buildEvidenceV2ReviewedWriterReference([])).toBeNull();
    const item = { legacyId: writerReference.workKey,
      work: { country_id: writerReference.countryId, writer_id: writerReference.writerId },
      attestation: { evidence: { recordKey: writerReference.workKey,
        validation: { status: "passed", issues: [], validatorSha256: transition.validatorSha256,
          canonRegistrySha256: transition.targetSha256 } } } };
    expect(buildEvidenceV2ReviewedWriterReference([item])).toEqual({
      ...writerReference, stagedProofSha256: hash(item.attestation),
    });
    expect(() => buildEvidenceV2ReviewedWriterReference([{ ...item, attestation: null }])).toThrow(/exact fresh/u);
    expect(() => buildEvidenceV2ReviewedWriterReference([item, item])).toThrow(/exact fresh/u);
    expect(() => buildEvidenceV2ReviewedWriterReference([{ ...item, work: { ...item.work, country_id: "england" } }])).toThrow(/exact fresh/u);
  });
  it("binds Alcott only as the unverified 1868 draft, without inventing an attestation", () => {
    expect(buildEvidenceV2DraftWriterReference([])).toBeNull();
    const item = { legacyId: draftReference.workKey,
      work: { country_id: "usa", writer_id: "louisa_may_alcott", editorial_status: "draft", first_published: 1868 },
      expectedContent: { work: { legacyId: draftReference.workKey, firstPublished: 1868 } }, attestation: null };
    expect(buildEvidenceV2DraftWriterReference([item])).toEqual({ ...draftReference,
      stagedContentSha256: hash(item.expectedContent) });
    for (const patch of [{ editorial_status: "verified" }, { first_published: 1870 }, { writer_id: "other" }]) {
      expect(() => buildEvidenceV2DraftWriterReference([{ ...item, work: { ...item.work, ...patch } }])).toThrow(/unverified 1868/u);
    }
    expect(() => buildEvidenceV2DraftWriterReference([{ ...item, attestation: {} }])).toThrow();
    expect(() => buildEvidenceV2DraftWriterReference([item, item])).toThrow();
  });
});
