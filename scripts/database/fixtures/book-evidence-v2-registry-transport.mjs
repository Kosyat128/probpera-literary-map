import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  BOOK_EVIDENCE_V2_REGISTRY_TRANSITION as transition,
  buildEvidenceV2ReviewedWriterReference,
  buildEvidenceV2DraftWriterReference,
  buildEvidenceV2RegistryRotation,
  evidenceV2ProfileFromLiveContent,
} from "../../lib/book-evidence-v2-registry-rotation.mjs";
import { encodeLiteraryArchiveReleaseItem } from "../../lib/literary-archive-atomic-release.mjs";

/** Shared by the isolated PostgreSQL CI test and a local in-memory SQL check. */
export async function exerciseRegistryTransport(query) {
  const content = { work: {
    legacyId: "england:fixture:transport", countryId: "england", writerId: "fixture",
    title: "Книга «Fixture»", metadata: { long: "a \\ quoted \" string", x: 1 },
    authorshipKind: null,
  }, translations: [], sources: [], externalIds: [], authors: [], editions: [], artworks: [] };
  // PostgreSQL preserves the scale in this numeric input. Parsing and
  // reserializing as JavaScript JSON loses it and must not replace the DB hash.
  const sourceText = JSON.stringify(content).replace('"x":1', '"x":1.00');
  const [database] = await query(`select jsonb_build_object(
    'content', value, 'contentText', value::text,
    'contentSha256', encode(sha256(convert_to(value::text, 'UTF8')), 'hex')
    )::text as result from (select $1::jsonb as value) input`, [sourceText]);
  assert.ok(database.contentText.includes('"x": 1.00'));
  const cms = { ...database, workId: "00000000-0000-4000-8000-000000000001",
    legacyId: content.work.legacyId, updatedAt: "2026-09-13T00:00:00Z", isCmsLocked: true };
  assert.equal(evidenceV2ProfileFromLiveContent(cms).title, content.work.title);
  assert.throws(() => evidenceV2ProfileFromLiveContent({ ...cms, contentText: JSON.stringify(cms.content) }));
  const altered = structuredClone(cms);
  altered.content.work.title += " altered";
  assert.throws(() => evidenceV2ProfileFromLiveContent(altered));

  const reviewedKey = "usa:harriet_beecher_stowe:uncle-toms-cabin";
  const reviewedItem = { ordinal: 0, legacyId: reviewedKey,
    work: { legacy_id: reviewedKey, country_id: "usa", writer_id: "harriet_beecher_stowe" },
    attestation: { evidence: { recordKey: reviewedKey, validation: { status: "passed", issues: [],
      validatorSha256: transition.validatorSha256, canonRegistrySha256: transition.targetSha256 } } },
    preserved: { numeric: 1e-7, text: "O'Brien: доказательство" },
  };
  const draftKey = "usa:louisa_may_alcott:little-women";
  const draftItem = { ordinal: 1, legacyId: draftKey,
    work: { legacy_id: draftKey, country_id: "usa", writer_id: "louisa_may_alcott", editorial_status: "draft", first_published: 1868 },
    expectedContent: { work: { legacyId: draftKey, firstPublished: 1868 } }, attestation: null,
  };
  for (const [item, reference] of [
    [reviewedItem, buildEvidenceV2ReviewedWriterReference([reviewedItem])],
    [draftItem, buildEvidenceV2DraftWriterReference([draftItem])],
  ]) {
    const envelope = encodeLiteraryArchiveReleaseItem(item);
    const [binding] = await query(`select jsonb_build_object(
      'storedPayloadSha256', encode(sha256(convert_to($1, 'UTF8')), 'hex'),
      'samePayload', $1::jsonb = $2::jsonb
      )::text as result`, [envelope.canonicalPayload, JSON.stringify(item)]);
    assert.equal(binding.samePayload, true);
    assert.equal(reference.stagedItemSha256, binding.storedPayloadSha256);
    const changedItem = { ...item, changedAfterReview: true };
    assert.notEqual(reference.stagedItemSha256, encodeLiteraryArchiveReleaseItem(changedItem).payloadSha256);
  }

  const rotation = buildEvidenceV2RegistryRotation({
    snapshot: { contract: transition.contract, priorPublicLegacyIds: [], cmsLockedWorks: [] },
    expectedCmsLegacyIds: [], releaseItems: [],
    canonRegistry: { registryVersion: transition.canonRegistryVersion },
    canonRegistrySha256: transition.targetSha256, validatorSha256: transition.validatorSha256,
    issuesForWork: () => { throw new Error("The empty fixture has no work to validate."); },
  });
  const expectedCoverage = { priorPublicLegacyIds: rotation.priorPublicLegacyIds, cmsLockedProofs: rotation.cmsLockedProofs };
  const [coverage] = await query(`select jsonb_build_object(
    'textSha256', encode(sha256(convert_to($1, 'UTF8')), 'hex'),
    'jsonbSha256', encode(sha256(convert_to(($1::jsonb)::text, 'UTF8')), 'hex'),
    'sameCoverage', $1::jsonb = $2::jsonb
    )::text as result`, [rotation.coverageText, JSON.stringify(expectedCoverage)]);
  assert.equal(coverage.sameCoverage, true);
  assert.equal(coverage.textSha256, rotation.coverageSha256);
  assert.notEqual(coverage.jsonbSha256, rotation.coverageSha256);
  assert.notEqual(createHash("sha256").update(`${rotation.coverageText} `).digest("hex"), rotation.coverageSha256);
  return { contentTextVerified: true, numericScalePreserved: true, writerReferencesVerified: 2,
    coverageTextVerified: true, staleTextAndContentRejected: true };
}
