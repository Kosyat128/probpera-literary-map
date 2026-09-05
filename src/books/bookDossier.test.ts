import { bookDossierFixture as fixture, bookDossierFixtureDesignProof, bookDossierHiddenProgressFixture } from "../../scripts/lib/book-dossier-fixtures";
import { describe, expect, it } from "vitest";
import { BOOK_DOSSIER_REVIEW_STAGES, compileBookDossier } from "./bookDossierCompiler";
import { compileBookDossierVariantBank, parseBookDossierPublicRequest, parsePublishedBookDossier, selectBookDossierVariant } from "./bookDossierDelivery";
import { addBookDossierDraftSection } from "./bookDossierDraftBuilder";
import type { BookDossierBlock, BookDossierRecord } from "./bookDossierDocument";
import { buildBookDossierFromEditorial, toBookEditorialDocument } from "./bookDossierLegacyAdapter";
import { buildBookEditorialDocument } from "./bookEditorialPages";
import type { WorkTranslationProfile } from "../data/countries/types";
import { bookDossierDraftChecksum } from "./bookDossierRights";
import { validateBookDossierDraft } from "./bookDossierValidation";
import { publishBookDossier, reviewBookDossier, saveBookDossierDraft, withdrawBookDossier } from "./bookDossierWorkflow";

const now = Date.parse("2026-09-05T10:00:00Z");
const actor = { id: "11111111-1111-4111-8111-111111111111", role: "owner" as const };
const context = (record: BookDossierRecord | null) => ({ now, actor, expectedRevision: record?.revision || 0 });
async function approved(input = fixture()) {
  let result = await saveBookDossierDraft(input, null, context(null));
  expect(result.issues).toEqual([]);
  let record = result.record!;
  for (const stage of BOOK_DOSSIER_REVIEW_STAGES) {
    result = await reviewBookDossier(record, stage, "APPROVED", true, { ...context(record), ...(stage === "design" ? { designProof: bookDossierFixtureDesignProof(record, now) } : {}) });
    expect(result.issues, stage).toEqual([]); record = result.record!;
  }
  result = await publishBookDossier(record, context(record));
  expect(result.issues).toEqual([]);
  return result.record!;
}

describe("finite dossier publication", () => {
  it("stops the available progress prefix at a hidden checkpoint and never skips ahead", async () => {
    const record = await approved(bookDossierHiddenProgressFixture());
    const { bank, issues } = await compileBookDossierVariantBank(record, { now });
    expect(issues).toEqual([]);
    expect(bank?.progressItemIds).toEqual(["identity-item"]);
    expect(bank?.variants).toHaveLength(13);
    const request = { bookKey: record.draft.bookKey, locale: "ru" as const, mode: "DURING_READING" as const, revealSpoilers: "NONE" as const, reachedItemIds: [] as string[] };
    const initial = selectBookDossierVariant(bank!, request, now)!;
    expect(initial.progressSteps).toEqual([{ id: "identity-item", label: "Fixture identity" }]);
    expect(JSON.stringify(initial)).not.toMatch(/hidden-progress-item|Secret checkpoint/u);
    const advanced = selectBookDossierVariant(bank!, { ...request, reachedItemIds: ["identity-item"] }, now)!;
    expect(advanced.pages.flatMap(page => page.blocks).some(block => block.id === "progress-block-0")).toBe(true);
    expect(advanced.pages.flatMap(page => page.blocks).some(block => block.id === "progress-block-2")).toBe(false);
    expect(selectBookDossierVariant(bank!, { ...request, reachedItemIds: ["identity-item", "passport-item"] }, now)).toBeNull();
    expect((await compileBookDossier(record, { now, themeVersion: "test", readingMode: "DURING_READING", revealSpoilers: "ENDING", reachedItemIds: ["identity-item", "hidden-progress-item"] })).document).toBeNull();
    expect(parsePublishedBookDossier({ ...initial, progressSteps: [{ id: "identity-item", label: "One" }, { id: "identity-item", label: "Duplicate" }] }, now)).toBeNull();
  });
  it("reserves the final audit slot so a published dossier can still be revoked", async () => {
    const record = await approved();
    const full = { ...record, audit: Array.from({ length: 255 }, (_, index) => ({ ...record.audit[0], id: `synthetic-${index}` })) };
    expect((await saveBookDossierDraft(full.draft, full, context(full))).issues[0]?.code).toBe("audit-capacity-review-required");
    const revoked = await withdrawBookDossier(full, "REVOKE", "Synthetic last-slot revocation", context(full));
    expect(revoked.issues).toEqual([]);
    expect(revoked.record?.status).toBe("BLOCKED");
    expect(revoked.record?.audit).toHaveLength(256);
    expect((await compileBookDossier(revoked.record!, { now, themeVersion: "test" })).document).toBeNull();
  });
  it("retains reviewed original descriptions from existing primary sources and puts meaning before technical details", () => {
    const profile: WorkTranslationProfile = { locale: "ru", title: "Synthetic work", description: "Synthetic original description.", sourceLanguage: "ru", status: "reviewed", method: "editorial-original", sourceUrls: ["https://www.orwellfoundation.com/"],
      descriptionProvenance: { origin: "official-source-synthesis", sourceLanguage: "ru", sourceCountry: "GB", sourceUrls: ["https://www.orwellfoundation.com/"], rights: { textOrigin: "project-original", copiedSourceText: false }, author: "Test author", createdAt: "2026-01-01T00:00:00Z", reviewedBy: "Test reviewer", reviewedAt: "2026-01-02T00:00:00Z" } };
    const legacy = buildBookEditorialDocument({ bookKey: "test:writer:book", locale: "ru", themeVersion: "test", title: profile.title, writer: "Test writer", year: { value: 1900, verified: true }, description: { value: profile.description, verified: true } });
    const result = buildBookDossierFromEditorial(legacy, { descriptionProfile: profile });
    expect(result.pages.map(page => page.id)).toEqual(["identity", "description", "details", "legal-reading"]);
    expect(result.pages.find(page => page.id === "description")?.paragraphs).toEqual([profile.description]);
    const adapted = { ...profile, descriptionProvenance: { ...profile.descriptionProvenance!, origin: "article-adapted" as const } };
    expect(buildBookDossierFromEditorial(legacy, { descriptionProfile: adapted }).pages.some(page => page.id === "description")).toBe(false);
    const unapproved = { ...profile, descriptionProvenance: { ...profile.descriptionProvenance!, sourceUrls: ["https://unreviewed.example/"] } };
    expect(buildBookDossierFromEditorial(legacy, { descriptionProfile: unapproved }).pages.some(page => page.id === "description")).toBe(false);
  });
  it("saves incomplete private form fields without making them reviewable", async () => {
    const input = fixture();
    const incomplete = addBookDossierDraftSection(input, { id: "new-context", title: "New context", purpose: "context", template: "essay" });
    const saved = await saveBookDossierDraft(incomplete, null, context(null));
    expect(saved.issues).toEqual([]);
    expect(saved.record?.draft.rights.slice(-1)[0].classification).toBe("BLOCKED");
    expect((await reviewBookDossier(saved.record!, "facts", "APPROVED", true, context(saved.record))).record).toBeNull();
  });
  it("rejects BEFORE spoiler escalation and expired or excessively long public leases", async () => {
    const record = await approved();
    expect(parseBookDossierPublicRequest({ bookKey: record.draft.bookKey, locale: "ru", mode: "BEFORE_READING", revealSpoilers: "ENDING" })).toBeNull();
    expect((await compileBookDossier(record, { now, themeVersion: "test", readingMode: "BEFORE_READING", revealSpoilers: "ENDING" })).document).toBeNull();
    const { document } = await compileBookDossier(record, { now, themeVersion: "test" });
    expect(parsePublishedBookDossier({ ...document, validUntil: new Date(now - 1).toISOString() }, now)).toBeNull();
    expect(parsePublishedBookDossier({ ...document, validUntil: new Date(now + 120000).toISOString() }, now)).toBeNull();
  });
  it("requires current content-bound measured design approval for every variant", async () => {
    const record = await approved();
    for (const change of [
      (proof: ReturnType<typeof bookDossierFixtureDesignProof>) => ({ ...proof, fontVersion: "outdated-fonts" }),
      (proof: ReturnType<typeof bookDossierFixtureDesignProof>) => ({ ...proof, variantPages: proof.variantPages.slice(1) }),
      (proof: ReturnType<typeof bookDossierFixtureDesignProof>) => ({ ...proof, variantPages: proof.variantPages.map(entry => ({ ...entry, pageCount: 99 })) }),
    ]) {
      const changed = { ...record, reviews: record.reviews.map(review => review.stage === "design" ? { ...review, designProof: change(review.designProof!) } : review) };
      const result = await compileBookDossier(changed, { now, themeVersion: "test" });
      expect(result.document).toBeNull();
      expect(result.issues.some(issue => issue.code === "measured-design-review-required")).toBe(true);
    }
  });
  it("requires actual ordered human approvals and strips private evidence from both renderers", async () => {
    const record = await approved();
    const result = await compileBookDossier(record, { now, themeVersion: "test" });
    expect(result.issues).toEqual([]);
    expect(result.document?.pages).toHaveLength(6);
    expect(parsePublishedBookDossier(result.document, now)).not.toBeNull();
    for (const marker of [actor.id, "private-test-evidence", "rightsBasis", "approvedExcerpt", "reviewKind"]) expect(JSON.stringify(result.document)).not.toContain(marker);
    expect(toBookEditorialDocument(result.document!).pages.map(page => page.id)).toEqual(result.document!.pages.map(page => page.id));
  });
  it("rejects forged stamps, stale CAS and skipped reviews", async () => {
    const input = fixture();
    const result = await saveBookDossierDraft({ ...input, rights: input.rights.map(grant => ({ ...grant, reviewKind: "HUMAN", reviewedBy: actor.id, reviewedAt: new Date(now).toISOString() })) }, null, context(null));
    const record = result.record!;
    expect(record.draft.rights.every(grant => grant.reviewKind === "UNREVIEWED")).toBe(true);
    expect((await reviewBookDossier(record, "final", "APPROVED", true, context(record))).issues[0].code).toBe("previous-human-review-required");
    expect((await reviewBookDossier(record, "facts", "APPROVED", false, context(record))).record).toBeNull();
    expect((await saveBookDossierDraft(input, record, { ...context(record), expectedRevision: 0 })).issues[0].code).toBe("revision-conflict");
    expect((await compileBookDossier({ ...record, status: "PUBLISHED" }, { now, themeVersion: "test" })).document).toBeNull();
  });
  it("edits and revocation immediately withdraw approved projections", async () => {
    const record = await approved();
    const edited = await saveBookDossierDraft({ ...record.draft, title: "Changed synthetic title" }, record, context(record));
    expect(edited.record?.reviews).toEqual([]);
    expect(edited.record?.status).toBe("RE_REVIEW_REQUIRED");
    expect((await compileBookDossier(edited.record!, { now, themeVersion: "test" })).document).toBeNull();
    const revoked = await withdrawBookDossier(record, "REVOKE", "Synthetic test withdrawal", context(record));
    expect((await compileBookDossier(revoked.record!, { now, themeVersion: "test" })).document).toBeNull();
    expect(revoked.record?.audit.slice(-1)[0]?.actorId).toBe(actor.id);
  });
  it.each(["quote", "media", "full-text"] as const)("never publishes hosted %s even with approvals and a permissive grant", async kind => {
    const record = await approved();
    const draft = { ...record.draft, blocks: record.draft.blocks.map((block, index) => index === 1 ? { ...block, kind } : block) };
    const result = await compileBookDossier({ ...record, draft, contentChecksum: await bookDossierDraftChecksum(draft) }, { now, themeVersion: "test" });
    expect(result.document).toBeNull();
    expect(result.issues.some(issue => issue.code === "hosted-protected-content-disabled")).toBe(true);
  });
  it("checks grant expiry, translations and changed content rather than trusting ready status", async () => {
    const record = await approved();
    expect((await compileBookDossier(record, { now: Date.parse("2028-01-01T00:00:00Z"), themeVersion: "test" })).issues.some(issue => issue.code === "rights-expired-or-not-active")).toBe(true);
    const draft = { ...record.draft, blocks: record.draft.blocks.map((block, index) => index === 1 ? { ...block, translationId: "unreviewed-translation" } : block) };
    const result = await compileBookDossier({ ...record, draft }, { now, themeVersion: "test" });
    expect(result.document).toBeNull(); expect(result.issues.some(issue => issue.code === "translation-rights-mismatch")).toBe(true);
  });
  it("fails closed on unknown fields, unsafe URLs, invalid calendar dates and dangling item references", async () => {
    const input = fixture();
    expect(validateBookDossierDraft({ ...input, ready: true }).draft).toBeNull();
    expect(validateBookDossierDraft({ ...input, sources: [{ ...input.sources[0], url: "javascript:alert(1)" }] }).draft).toBeNull();
    expect(validateBookDossierDraft({ ...input, rights: [{ ...input.rights[0], startsAt: "2026-02-30T00:00:00Z" }] }).draft).toBeNull();
    const record = (await saveBookDossierDraft({ ...input, blocks: input.blocks.map((block, i) => i === 1 ? { ...block, availableAfterItemId: "missing" } : block) }, null, context(null))).record!;
    expect((await reviewBookDossier(record, "facts", "APPROVED", true, context(record))).issues.some(issue => issue.code === "unknown-progress-anchor")).toBe(true);
  });
  it("keeps hidden spoilers entirely out of payloads, including section titles and graph edges", async () => {
    const input = fixture();
    const hidden: BookDossierBlock = { ...input.blocks[1], id: "secret-block", sectionId: "secret", title: "Secret heading", spoiler: "ENDING", availableAfterItemId: "identity-item", rightsId: "secret-rights" };
    const record = await approved({ ...input, sections: [...input.sections, { id: "secret", title: "Secret ending", purpose: "analysis", template: "essay", spoiler: "ENDING", blockIds: [hidden.id] }], blocks: [...input.blocks, hidden], rights: [...input.rights, { ...input.rights[1], id: "secret-rights" }] });
    const { bank, issues } = await compileBookDossierVariantBank(record, { now });
    expect(issues).toEqual([]);
    const request = { bookKey: input.bookKey, locale: input.locale, mode: "DURING_READING" as const, revealSpoilers: "NONE" as const, reachedItemIds: ["identity-item"] };
    expect(JSON.stringify(selectBookDossierVariant(bank!, request, now))).not.toContain("Secret");
    expect(selectBookDossierVariant(bank!, { ...request, reachedItemIds: ["unknown"] }, now)).toBeNull();
    expect(selectBookDossierVariant(bank!, { ...request, revealSpoilers: "ENDING" }, now)?.pages).toHaveLength(7);
    expect(selectBookDossierVariant(bank!, { ...request, revealSpoilers: "ENDING", reachedItemIds: [] }, now)?.pages).toHaveLength(6);
  });
  it("preserves every distinct item value, text and URL in the 3D adapter", async () => {
    const record = await approved();
    const { document } = await compileBookDossier(record, { now, themeVersion: "test" });
    const page = document!.pages[0], block = page.blocks[0];
    const amended = { ...document!, pages: [{ ...page, blocks: [{ ...block, items: [{ id: "fixture-link", label: "Label", value: "Value", text: "Additional text", href: "https://probpera.ru", sourceIds: [], spoiler: "NONE" as const }] }] }] };
    const row = toBookEditorialDocument(amended).pages[0].rows[0];
    expect(row.value).toBe("Value\n\nAdditional text");
    expect(row.href).toBe("https://probpera.ru");
    expect(parsePublishedBookDossier({ ...document, rights: record.draft.rights })).toBeNull();
  });
});
