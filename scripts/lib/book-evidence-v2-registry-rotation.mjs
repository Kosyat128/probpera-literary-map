import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  bindEvidenceV2AttestationPayloads,
  evidenceV2AttestationCandidatesFromArchive,
} from "./book-evidence-v2-attestations.mjs";
import { canonicalLiteraryArchiveReleasePayload } from "./literary-archive-atomic-release.mjs";

export const BOOK_EVIDENCE_V2_REGISTRY_TRANSITION = Object.freeze({
  contract: "book-evidence-v2-registry-rotation-20260912",
  contractVersion: "book-evidence-v2",
  validator: "src/data/bookEvidence.ts#bookEvidenceV2Issues",
  validatorVersion: "book-evidence-v2-validator-v1",
  validatorSha256: "f2ef2c46ae78be553a190057f8833c5661dc1cbcc1902564708effa7f6db0026",
  canonRegistryVersion: "world-canon-2026-09-v2",
  expectedOldSha256: "d0428d265845b68d6d5ee2ad9828353c91456eb5e57baf0f639702b8656044ef",
  targetSha256: "c8d2b6862c47c3215295951d2c5d1c406913b9879c616f1d8b787c6e05029f6c",
});
const transition = BOOK_EVIDENCE_V2_REGISTRY_TRANSITION;
const hash = (value) => createHash("sha256")
  .update(canonicalLiteraryArchiveReleasePayload(value), "utf8").digest("hex");
const object = (value) => value && typeof value === "object" && !Array.isArray(value);
const cOrder = (a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b));

export const BOOK_EVIDENCE_V2_REVIEWED_WRITER_REFERENCE = Object.freeze({
  contract: "book-evidence-v2-reviewed-writer-reference-20260912",
  countryId: "usa", writerId: "harriet_beecher_stowe",
  nameRu: "Гарриет Бичер-Стоу", nameEn: "Harriet Beecher Stowe",
  workKey: "usa:harriet_beecher_stowe:uncle-toms-cabin",
});

export function buildEvidenceV2ReviewedWriterReference(releaseItems) {
  const identity = BOOK_EVIDENCE_V2_REVIEWED_WRITER_REFERENCE;
  const items = releaseItems.filter((item) => item.legacyId === identity.workKey);
  if (!items.length) return null;
  const item = items[0];
  const evidence = item.attestation?.evidence;
  if (items.length !== 1 || item.work?.country_id !== identity.countryId ||
      item.work?.writer_id !== identity.writerId || evidence?.recordKey !== identity.workKey ||
      evidence.validation?.status !== "passed" || !isDeepStrictEqual(evidence.validation.issues, []) ||
      evidence.validation.validatorSha256 !== transition.validatorSha256 ||
      evidence.validation.canonRegistrySha256 !== transition.targetSha256) {
    throw new Error("Reviewed Stowe writer reference requires the exact fresh staged work proof.");
  }
  return { ...identity, stagedProofSha256: hash(item.attestation) };
}

export const BOOK_EVIDENCE_V2_DRAFT_WRITER_REFERENCE = Object.freeze({
  contract: "book-evidence-v2-draft-writer-reference-20260912",
  countryId: "usa", writerId: "louisa_may_alcott",
  nameRu: "Луиза Мэй Олкотт", nameEn: "Louisa May Alcott",
  workKey: "usa:louisa_may_alcott:little-women",
  sourceRecordSha256: "b21364f9bb413707c39e6023ebec3de5fa0b1da41e38f2f670cef3795badd231",
});

/** This grants no evidence status: the first-part 1868 record stays draft. */
export function buildEvidenceV2DraftWriterReference(releaseItems) {
  const identity = BOOK_EVIDENCE_V2_DRAFT_WRITER_REFERENCE;
  const items = releaseItems.filter((item) => item.legacyId === identity.workKey);
  if (!items.length) return null;
  const item = items[0];
  if (items.length !== 1 || !/^[0-9a-f]{64}$/u.test(identity.sourceRecordSha256) ||
      item.work?.country_id !== identity.countryId || item.work?.writer_id !== identity.writerId ||
      item.work?.editorial_status !== "draft" || item.work?.first_published !== 1868 ||
      item.attestation !== null || item.expectedContent?.work?.legacyId !== identity.workKey) {
    throw new Error("Alcott draft reference requires the exact source-bound unverified 1868 work.");
  }
  return { ...identity, stagedContentSha256: hash(item.expectedContent) };
}

/** Accept only the installed, reviewed transition; health still uses the active pin. */
export function evidenceV2RegistryPreflightIdentity(control, target, capability) {
  if (!control || control.singleton !== true ||
      typeof control.enforcement_enabled !== "boolean" ||
      control.contract_version !== transition.contractVersion ||
      control.validator_id !== transition.validator ||
      control.validator_version !== transition.validatorVersion ||
      control.validator_sha256 !== target.validatorSha256 ||
      control.canon_registry_version !== target.canonRegistryVersion) {
    throw new Error("Evidence V2 active control identity is unknown.");
  }
  if (control.canon_registry_sha256 === target.canonRegistrySha256) {
    return { activeRegistrySha256: target.canonRegistrySha256, rotation: null };
  }
  if (control.canon_registry_sha256 !== transition.expectedOldSha256 ||
      target.canonRegistrySha256 !== transition.targetSha256 ||
      target.validatorSha256 !== transition.validatorSha256 ||
      target.canonRegistryVersion !== transition.canonRegistryVersion ||
      !isDeepStrictEqual(capability, transition)) {
    throw new Error("Evidence V2 registry mismatch is not the installed approved transition.");
  }
  return { activeRegistrySha256: transition.expectedOldSha256, rotation: { ...transition } };
}

/** Reconstruct the validator input exclusively from the server's complete projection. */
export function evidenceV2ProfileFromLiveContent(snapshot) {
  const content = snapshot?.content;
  if (!object(content) ||
      !isDeepStrictEqual(Object.keys(content).sort(),
        ["artworks", "authors", "editions", "externalIds", "sources", "translations", "work"]) ||
      !object(content.work) ||
      ["artworks", "authors", "editions", "externalIds", "sources", "translations"]
        .some((field) => !Array.isArray(content[field])) ||
      !/^[0-9a-f]{64}$/u.test(snapshot.contentSha256 || "") ||
      hash(content) !== snapshot.contentSha256 ||
      !/^[0-9a-f-]{36}$/u.test(snapshot.workId || "") ||
      !Number.isFinite(Date.parse(snapshot.updatedAt)) || snapshot.isCmsLocked !== true) {
    throw new Error("CMS rotation snapshot is incomplete or does not match its content hash.");
  }
  const work = content.work;
  const prefix = `${work.countryId}:${work.writerId}:`;
  if (work.legacyId !== snapshot.legacyId || !work.legacyId?.startsWith(prefix) ||
      !work.legacyId.slice(prefix.length) || !object(work.metadata) ||
      new Set(content.translations.map((row) => row.locale)).size !== content.translations.length) {
    throw new Error("CMS rotation snapshot has conflicting work or locale identity.");
  }
  return {
    id: work.legacyId.slice(prefix.length),
    countryId: work.countryId,
    writerId: work.writerId,
    title: work.title,
    originalTitle: work.originalTitle,
    firstPublished: work.firstPublished,
    originalLanguage: work.originalLanguage,
    genres: work.genres,
    tags: work.tags,
    description: work.description,
    sourceUrl: work.sourceUrl,
    editorial: { status: work.editorialStatus, reviewedAt: work.reviewedAt },
    localizedTitles: work.metadata.localizedTitles,
    canon: work.metadata.canon,
    ...(work.authorshipKind === null ? {} : {
      authorship: {
        kind: work.authorshipKind,
        authors: content.authors.map((author) => ({
          countryId: author.countryId,
          writerId: author.writerId,
          creditNames: { ru: author.creditNameRu, en: author.creditNameEn },
          attribution: author.attribution,
        })),
      },
    }),
    translations: Object.fromEntries(content.translations.map((row) => [row.locale, {
      locale: row.locale, title: row.title, description: row.description,
      sourceLanguage: row.sourceLanguage, method: row.method, status: row.status,
      sourceUrls: row.sourceUrls, reviewedAt: row.reviewedAt,
      titleEvidence: row.metadata?.titleEvidence,
      descriptionProvenance: row.metadata?.descriptionProvenance,
    }])),
    sources: content.sources.map((row) => ({
      ...row.metadata, provider: row.provider, url: row.url, fields: row.fields,
      license: row.license, usage: row.usage, retrievedAt: row.retrievedAt,
    })),
    externalIds: content.externalIds,
  };
}

export function buildEvidenceV2RegistryRotation({ snapshot, expectedCmsLegacyIds, releaseItems, ...options }) {
  if (!object(snapshot) || snapshot.contract !== transition.contract ||
      !Array.isArray(snapshot.priorPublicLegacyIds) || !Array.isArray(snapshot.cmsLockedWorks)) {
    throw new Error("Unknown registry rotation snapshot contract.");
  }
  const prior = snapshot.priorPublicLegacyIds;
  const cms = snapshot.cmsLockedWorks;
  const cmsKeys = cms.map((row) => row.legacyId);
  if (prior.some((key) => typeof key !== "string" || !key) ||
      new Set(prior).size !== prior.length || new Set(cmsKeys).size !== cms.length ||
      !isDeepStrictEqual([...cmsKeys].sort(cOrder), [...expectedCmsLegacyIds].sort(cOrder)) ||
      cmsKeys.some((key) => !prior.includes(key))) {
    throw new Error("Registry rotation snapshot has incomplete predecessor/CMS coverage.");
  }
  const staged = new Map(releaseItems.map((item) => [item.legacyId, item]));
  for (const key of prior) {
    if (cmsKeys.includes(key)) continue;
    const proof = staged.get(key)?.attestation?.evidence;
    if (!proof || proof.recordKey !== key ||
        proof.validation?.canonRegistrySha256 !== transition.targetSha256 ||
        proof.validation?.validatorSha256 !== transition.validatorSha256) {
      throw new Error(`Registry rotation lacks fresh staged predecessor evidence: ${key}`);
    }
  }
  const profiles = cms.map(evidenceV2ProfileFromLiveContent);
  const { candidates, rejected } = evidenceV2AttestationCandidatesFromArchive(profiles, options);
  if (rejected.length) {
    throw new Error(`CMS registry rotation validation failed: ${rejected
      .map((row) => `${row.recordKey}: ${row.issues.join(", ")}`).join("; ")}`);
  }
  const payloads = bindEvidenceV2AttestationPayloads(candidates,
    new Map(cms.map((row) => [row.legacyId, row.workId])),
    new Map(cms.map((row) => [row.workId, row.contentSha256])),
    new Map(cms.map((row) => [row.legacyId, row.content])));
  const cmsLockedProofs = payloads.map((proof, index) => ({
    ...proof, legacyId: cms[index].legacyId, expectedUpdatedAt: cms[index].updatedAt,
  })).sort((a, b) => cOrder(a.legacyId, b.legacyId));
  const coverage = { priorPublicLegacyIds: [...prior].sort(cOrder), cmsLockedProofs };
  return { ...transition, ...coverage, coverageSha256: hash(coverage) };
}
