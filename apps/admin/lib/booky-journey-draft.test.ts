import { describe, expect, it } from "vitest";
import {
  bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
} from "../../../src/host/bookyJourney";
import {
  createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
} from "../../../src/host/bookyDialogueRegistry";
import { contentRecordHash, contentTextHash } from "../../../src/planet/contentExportHash";
import {
  BOOKY_JOURNEY_DRAFT_MAX_BYTES, createBookyJourneyDraft, parseBookyJourneyDraft,
  type BookyJourneyDraft, type JourneyDraftCatalog, type JourneyDraftInput,
} from "./booky-journey-draft";

function catalog(): JourneyDraftCatalog {
  return { countries: [{ id: "test-country", label: { ru: "Тестовая страна", en: "Test country" }, writers: [
    { id: "test-writer", label: { ru: "Тестовый писатель", en: "Test writer" }, works: [
      { id: "test-work", label: { ru: "Тестовая книга", en: "Test work" } },
    ] },
    { id: "other-writer", label: { ru: "Другой писатель", en: "Other writer" }, works: [
      { id: "other-work", label: { ru: "Другая книга", en: "Other work" } },
    ] },
  ] }] };
}
function input(): JourneyDraftInput {
  return {
    id: "test-route", version: 2, countryId: "test-country", writerId: "test-writer", workId: "test-work",
    ageRange: { min: 18, max: 120 }, readingLevel: "plain", estimatedDurationMinutes: 15,
    copy: {
      ru: { title: "Тестовый маршрут", description: "Последовательно откройте страну, писателя и книгу.", nodes: {
        country: { title: "Откройте страну", body: "Выберите указанную страну на глобусе." },
        writer: { title: "Откройте писателя", body: "Выберите указанного писателя." },
        work: { title: "Откройте книгу", body: "Откройте выбранную книгу в коллекции." },
        checkpoint: { title: "Завершите маршрут", body: "Подтвердите завершение шагов." },
      } },
      en: { title: "Test route", description: "Open the country, writer and work in order.", nodes: {
        country: { title: "Open the country", body: "Select the indicated country on the globe." },
        writer: { title: "Open the writer", body: "Select the indicated writer." },
        work: { title: "Open the work", body: "Open the selected work in the collection." },
        checkpoint: { title: "Finish the route", body: "Confirm completion of the steps." },
      } },
    },
  };
}
function draft(value = input(), canonical = catalog()) {
  const result = createBookyJourneyDraft(value, canonical);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.draft;
}
function errors(value: JourneyDraftInput, canonical = catalog()) {
  const result = createBookyJourneyDraft(value, canonical);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors.map(error => error.field);
}

describe("adult Booky journey draft authoring", () => {
  it("binds both locales and all eight dialogues to the real schemas, canonical chain and embedded source", () => {
    const exported = draft();
    expect(exported.authoringSourceChecksum).toBe(contentRecordHash(exported.authoringSource));
    expect(exported.definitions.map(definition => [definition.id, definition.version, definition.locale])).toEqual([
      ["test-route", 2, "ru"], ["test-route", 2, "en"],
    ]);
    expect(exported.dialogues).toHaveLength(8);
    expect(exported.blockingReviewIssues).toEqual([]);
    for (const definition of exported.definitions) {
      expect(exported.definitionsChecksums.find(item => item.locale === definition.locale)?.checksum).toBe(getBookyJourneyChecksum(definition));
      expect(definition.nodes.map(node => [node.kind, node.screen, node.entity])).toEqual([
        ["country", "globe", { kind: "country", countryId: "test-country" }],
        ["writer", "globe", { kind: "writer", countryId: "test-country", writerId: "test-writer" }],
        ["work", "collection", { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" }],
        ["checkpoint", "collection", null],
      ]);
      for (const node of definition.nodes) {
        const record = exported.dialogues.find(record => record.payload.id === node.dialogue.id && record.payload.locale === definition.locale)!;
        expect(record.review).toEqual({ status: "draft", reviewer: null, reviewedAt: null, contentChecksum: node.dialogue.contentChecksum });
        expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
        expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
        expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
        expect(record.payload.entityIds).toEqual(node.entity ? [bookyJourneyEntityId(node.entity)] : []);
        expect(record.payload.provenance).toEqual({
          kind: "editorial", sourcePath: "authoringSource", sourceVersion: 1,
          sourceRef: `/input/copy/${definition.locale}/nodes/${node.kind}`,
          sourceSha256: exported.authoringSourceChecksum,
          copySha256: contentTextHash(JSON.stringify({ title: record.payload.copy.title, body: record.payload.copy.body })),
        });
        expect(record.payload.copy.caption).toBe(record.payload.copy.title);
        expect(record.payload.copy.reduced).toBe(record.payload.copy.title);
        expect(record.payload.claimKind).toBe("interface-guidance");
        expect(record.payload.factualSources).toEqual([]);
        expect(record.payload.narration).toBeNull();
      }
    }
  });

  it("copies inputs without mutation or retained references, and hashes changed authoring bytes deterministically", () => {
    const value = input(), canonical = catalog();
    const before = JSON.stringify({ value, canonical });
    const exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    expect(draft(value, canonical)).toEqual(exported);
    value.copy.ru.nodes.work.body = "Другой явно введённый текст.";
    canonical.countries[0].label.ru = "Изменённая метка";
    expect(exported.authoringSource.input.copy.ru.nodes.work.body).toBe("Откройте выбранную книгу в коллекции.");
    expect(exported.authoringSource.selection.country.label.ru).toBe("Тестовая страна");
    expect(Object.isFrozen(exported.authoringSource.input.copy.ru.nodes.work)).toBe(true);
    expect(Object.isFrozen(value)).toBe(false);
    const changed = draft(value, canonical);
    expect(changed.authoringSourceChecksum).not.toBe(exported.authoringSourceChecksum);
    expect(changed.definitionsChecksums[0].checksum).not.toBe(exported.definitionsChecksums[0].checksum);
  });

  it("rejects duplicate canonical IDs within their owner instead of picking an arbitrary match", () => {
    const duplicateCountry = catalog();
    duplicateCountry.countries = [...duplicateCountry.countries, duplicateCountry.countries[0]];
    expect(errors(input(), duplicateCountry)).toContain("catalog.countries.1");
    const duplicateWriter = catalog();
    duplicateWriter.countries[0].writers = [...duplicateWriter.countries[0].writers, duplicateWriter.countries[0].writers[0]];
    expect(errors(input(), duplicateWriter)).toContain("catalog.countries.0.writers.2");
    const duplicateWork = catalog();
    const writer = duplicateWork.countries[0].writers[0];
    writer.works = [...writer.works, writer.works[0]];
    expect(errors(input(), duplicateWork)).toContain("catalog.countries.0.writers.0.works.1");
  });

  it("rejects a work from another writer but permits the same local work ID under a different canonical owner", () => {
    expect(errors({ ...input(), workId: "other-work" })).toContain("workId");
    const scoped = catalog();
    scoped.countries[0].writers[1].works = [{ id: "test-work", label: { ru: "Другая книга", en: "Other work" } }];
    expect(draft(input(), scoped).authoringSource.selection.writer.id).toBe("test-writer");
  });

  it("rejects incomplete authored EN copy and a missing selected work translation", () => {
    const value = input();
    value.copy.en.nodes.work.body = "";
    expect(errors(value)).toContain("copy.en.nodes.work.body");
    const canonical = catalog();
    canonical.countries[0].writers[0].works[0].label.en = "";
    expect(errors(input(), canonical)).toContain("workId");
  });

  it("preserves missing country/writer English labels and exports explicit blocking review issues without fallback", () => {
    const canonical = catalog();
    canonical.countries[0].label.en = "";
    canonical.countries[0].writers[0].label.en = "";
    const exported = draft(input(), canonical);
    expect(exported.authoringSource.selection.country.label.en).toBe("");
    expect(exported.authoringSource.selection.writer.label.en).toBe("");
    expect(exported.blockingReviewIssues.map(issue => [issue.field, issue.code])).toEqual([
      ["countryId", "canonical-english-label-missing"], ["writerId", "canonical-english-label-missing"],
    ]);
    expect(exported.releaseReady).toBe(false);
    expect(exported.journeyApprovals).toEqual([]);
  });

  it("rejects child or reversed age ranges and non-explicit version/duration/ID values", () => {
    expect(errors({ ...input(), ageRange: { min: 17, max: 120 } })).toContain("ageRange");
    expect(errors({ ...input(), ageRange: { min: 30, max: 29 } })).toContain("ageRange");
    expect(errors({ ...input(), ageRange: { min: 18, max: 121 } })).toContain("ageRange");
    expect(errors({ ...input(), estimatedDurationMinutes: 0 })).toContain("estimatedDurationMinutes");
    expect(errors({ ...input(), estimatedDurationMinutes: 1.5 })).toContain("estimatedDurationMinutes");
    expect(errors({ ...input(), version: 0 })).toContain("version");
    expect(errors({ ...input(), id: "a".repeat(49) })).toContain("id");
  });

  it("admits valid draft records for review but leaves resolution and compilation unavailable without independent approvals", () => {
    const exported = draft();
    expect([exported.status, exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved])
      .toEqual(["draft", false, false, false, false]);
    for (const list of [exported.dialogueApprovals, exported.journeyApprovals, exported.currentVersions, exported.availability]) expect(list).toEqual([]);
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: exported.definitions[0].nodes.flatMap(node => node.entity ? [bookyJourneyEntityId(node.entity)] : []),
      approvedReviews: exported.dialogueApprovals,
    });
    expect(registry.size).toBe(8);
    expect(registry.rejections).toEqual([]);
    for (const record of exported.dialogues) expect(registry.resolve({
      id: record.payload.id, locale: record.payload.locale, audience: "adult", age: 30, readingLevel: "plain",
      intent: record.payload.intent, screen: record.payload.screens[0], context: record.payload.context,
      entityIds: record.payload.entityIds, now: "2026-09-30T12:00:00.000Z",
    })).toBeNull();
    for (const definition of exported.definitions) expect(compileBookyJourney(definition, {
      audience: "adult", age: 30, locale: definition.locale, readingLevel: "plain", now: "2026-09-30T12:00:00.000Z",
      connectivity: "online", completedPrerequisites: [], availability: exported.availability,
    }, {
      currentVersions: exported.currentVersions, approvedReviews: exported.journeyApprovals,
      dialogueRegistry: registry, publicCountries: [], publicBooks: [],
    })).toBeNull();
  });
});

type Mutable<T> = T extends readonly (infer Item)[] ? Mutable<Item>[]
  : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
function modifiedExport(change: (value: Mutable<BookyJourneyDraft>) => void): string {
  const value: Mutable<BookyJourneyDraft> = JSON.parse(JSON.stringify(draft()));
  change(value);
  return JSON.stringify(value);
}
function importErrors(serialized: string, canonical = catalog()) {
  const result = parseBookyJourneyDraft(serialized, canonical);
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.every(error => /[А-Яа-яЁё]/u.test(error.message))).toBe(true);
  expect(Object.isFrozen(result.errors)).toBe(true);
  return result.errors.map(error => error.field);
}

describe("adult Booky journey draft reopening", () => {
  it("round trips all RU/EN authored copy and ignores object key order while returning fresh frozen compiled snapshots", () => {
    const exported = draft();
    const reverseKeys = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse()
        .map(([key, child]) => [key, reverseKeys(child)]));
      return value;
    };
    const canonical = catalog(), before = JSON.stringify(canonical);
    for (const serialized of [JSON.stringify(exported, null, 2) + "\n", JSON.stringify(reverseKeys(exported))]) {
      const result = parseBookyJourneyDraft(serialized, canonical);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.input).toEqual(input());
      expect(result.draft).toEqual(exported);
      expect(result.draft).not.toBe(exported);
      expect(result.input).toBe(result.draft.authoringSource.input);
      expect(result.input).not.toBe(exported.authoringSource.input);
      expect(Object.isFrozen(result)).toBe(true);
      expect(Object.isFrozen(result.input.copy.en.nodes.work)).toBe(true);
      expect([result.draft.status, result.draft.releaseReady, result.draft.humanReviewed,
        result.draft.childApproved, result.draft.narrationApproved]).toEqual(["draft", false, false, false, false]);
      for (const list of [result.draft.journeyApprovals, result.draft.dialogueApprovals,
        result.draft.currentVersions, result.draft.availability]) expect(list).toEqual([]);
    }
    expect(JSON.stringify(canonical)).toBe(before);
  });

  it("rejects stale selected canonical labels and removed countries, writers or works using the current scoped catalog", () => {
    const serialized = JSON.stringify(draft());
    for (const entity of ["country", "writer", "work"] as const) {
      for (const locale of ["ru", "en"] as const) {
        const current = catalog(), country = current.countries[0], writer = country.writers[0];
        const selected = entity === "country" ? country : entity === "writer" ? writer : writer.works[0];
        selected.label[locale] += " changed";
        expect(importErrors(serialized, current)).toContain("file");
      }
    }
    const noCountry = catalog();
    noCountry.countries = [];
    expect(importErrors(serialized, noCountry)).toContain("countryId");
    const noWriter = catalog();
    noWriter.countries[0].writers = noWriter.countries[0].writers.filter(writer => writer.id !== "test-writer");
    expect(importErrors(serialized, noWriter)).toContain("writerId");
    const noWork = catalog();
    noWork.countries[0].writers[0].works = [];
    expect(importErrors(serialized, noWork)).toContain("workId");
  });

  it("rejects altered authored and derived copy, validly rehashed dialogue tampering, checksums and canonical references", () => {
    const changes: ((value: Mutable<BookyJourneyDraft>) => void)[] = [
      value => { value.authoringSource.input.copy.ru.nodes.work.body = "Изменённая исходная подсказка."; },
      value => {
        value.authoringSource.input.copy.en.nodes.writer.title = "Changed writer title";
        value.authoringSourceChecksum = contentRecordHash(value.authoringSource);
      },
      value => {
        const record = value.dialogues[0];
        record.payload.copy.body = "Изменённый текст с согласованной контрольной суммой.";
        record.payload.provenance.copySha256 = contentTextHash(JSON.stringify({ title: record.payload.copy.title, body: record.payload.copy.body }));
        const contentChecksum = getBookyDialogueContentChecksum(record.payload);
        expect(contentChecksum).not.toBeNull();
        record.review.contentChecksum = contentChecksum!;
        const checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review });
        expect(checksum).not.toBeNull();
        record.checksum = checksum!;
      },
      value => { value.authoringSourceChecksum = "0".repeat(64); },
      value => { value.definitionsChecksums[0].checksum = "0".repeat(64); },
      value => { value.dialogues[0].checksum = "0".repeat(64); },
      value => { value.definitions[0].title = "Подменённое название маршрута"; },
      value => { value.definitions[0].nodes[0].entity = { kind: "country", countryId: "other-country" }; },
      value => { value.dialogues[0].payload.entityIds = ["other-country"]; },
      value => { value.dialogues[0].payload.provenance.sourceRef = "/input/copy/en/nodes/work"; },
      value => { value.authoringSource.selection.work.label.en = "Changed imported canonical title"; },
    ];
    for (const change of changes) expect(importErrors(modifiedExport(change))).toContain("file");
  });

  it("rejects imported authority, unknown or missing fields and every extra nested input key including special names", () => {
    const changes: ((value: Mutable<BookyJourneyDraft>) => void)[] = [
      value => { Object.assign(value, { releaseReady: true }); },
      value => { Object.assign(value, { humanReviewed: true }); },
      value => { Object.assign(value, { childApproved: true }); },
      value => { Object.assign(value, { narrationApproved: true }); },
      value => { Object.assign(value, { journeyApprovals: [{ reviewer: "imported" }] }); },
      value => { Object.assign(value, { dialogueApprovals: [{ reviewer: "imported" }] }); },
      value => { Object.assign(value, { currentVersions: [{ version: 2 }] }); },
      value => { Object.assign(value, { availability: [{ available: true }] }); },
      value => { Object.assign(value.dialogues[0].review, { status: "approved", reviewer: "imported", reviewedAt: "2026-09-30T12:00:00.000Z" }); },
      value => { Object.assign(value, { extra: "unrecognized" }); },
      value => { Reflect.deleteProperty(value, "dialogues"); },
      value => { Object.assign(value.authoringSource, { extra: "unrecognized" }); },
      value => { Object.assign(value.authoringSource.input, { extra: "unrecognized" }); },
      value => { Object.assign(value.authoringSource.input.ageRange, { extra: "unrecognized" }); },
      value => { Object.assign(value.authoringSource.input.copy, { fr: value.authoringSource.input.copy.en }); },
      value => { Object.assign(value.authoringSource.input.copy.ru, { extra: "unrecognized" }); },
      value => { Object.assign(value.authoringSource.input.copy.en.nodes, { extra: { title: "Extra", body: "Extra" } }); },
      value => { Object.assign(value.authoringSource.input.copy.ru.nodes.country, { extra: "unrecognized" }); },
      value => { Reflect.deleteProperty(value.authoringSource.input.copy.en.nodes.work, "body"); },
      value => { Object.defineProperty(value.authoringSource.input.copy.en.nodes.checkpoint, "__proto__", { value: { approved: true }, enumerable: true }); },
      value => { Object.assign(value.authoringSource.input.copy.en.nodes.writer, { constructor: "unrecognized" }); },
    ];
    for (const change of changes) importErrors(modifiedExport(change));
  });

  it("rejects malformed roots, unsupported draft versions/statuses, invalid input values and byte-bounded UTF-8 oversize text", () => {
    for (const serialized of ["", "{", "null", "[]", "42", '"draft"',
      JSON.stringify({ schemaVersion: 2, status: "draft" }), JSON.stringify({ schemaVersion: 1, status: "approved" }),
      " ".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES + 1)]) expect(importErrors(serialized)).toContain("file");
    const oversizedUtf8 = JSON.stringify({ text: "я".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES / 2) });
    expect(oversizedUtf8.length).toBeLessThan(BOOKY_JOURNEY_DRAFT_MAX_BYTES);
    expect(new TextEncoder().encode(oversizedUtf8).byteLength).toBeGreaterThan(BOOKY_JOURNEY_DRAFT_MAX_BYTES);
    expect(importErrors(oversizedUtf8)).toContain("file");
    expect(importErrors(modifiedExport(value => { value.authoringSource.input.ageRange.min = 17; }))).toContain("ageRange");
    expect(importErrors(modifiedExport(value => { value.authoringSource.input.copy.en.nodes.work.body = ""; })))
      .toContain("copy.en.nodes.work.body");
    const invalidCatalog = { countries: null } as unknown as JourneyDraftCatalog;
    expect(importErrors(JSON.stringify(draft()), invalidCatalog)).toContain("catalog");
    const failedCatalog = { get countries() { throw new Error("Catalog unavailable"); } } as unknown as JourneyDraftCatalog;
    expect(importErrors(JSON.stringify(draft()), failedCatalog)).toContain("file");
  });

  it("preserves missing canonical country/writer EN labels and blocking issues without translation or approval fallback", () => {
    const current = catalog();
    current.countries[0].label.en = "";
    current.countries[0].writers[0].label.en = "";
    const exported = draft(input(), current), serialized = JSON.stringify(exported);
    const result = parseBookyJourneyDraft(serialized, current);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.authoringSource.selection.country.label.en).toBe("");
    expect(result.draft.authoringSource.selection.writer.label.en).toBe("");
    expect(result.input.copy.en).toEqual(input().copy.en);
    expect(result.draft.blockingReviewIssues).toEqual(exported.blockingReviewIssues);
    expect(result.draft.blockingReviewIssues).toHaveLength(2);
    const removedIssues = JSON.parse(serialized);
    removedIssues.blockingReviewIssues = [];
    expect(importErrors(JSON.stringify(removedIssues), current)).toContain("file");
    const noWorkEnglish = catalog();
    noWorkEnglish.countries[0].writers[0].works[0].label.en = "";
    expect(importErrors(serialized, noWorkEnglish)).toContain("workId");
    expect([result.draft.releaseReady, result.draft.humanReviewed, result.draft.childApproved, result.draft.narrationApproved])
      .toEqual([false, false, false, false]);
  });
});
