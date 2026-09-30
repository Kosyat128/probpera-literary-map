import { describe, expect, it } from "vitest";
import {
  bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
} from "../../../src/host/bookyJourney";
import {
  createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
} from "../../../src/host/bookyDialogueRegistry";
import { contentRecordHash, contentTextHash } from "../../../src/planet/contentExportHash";
import { createBookyJourneyDraft, type JourneyDraftCatalog, type JourneyDraftInput } from "./booky-journey-draft";

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
