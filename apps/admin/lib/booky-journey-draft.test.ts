import { describe, expect, it } from "vitest";
import {
  bookyJourneyDialogueContext, bookyJourneyEntityId, compileBookyJourney, getBookyJourneyChecksum,
} from "../../../src/host/bookyJourney";
import {
  createBookyDialogueRegistry, getBookyDialogueChecksum, getBookyDialogueContentChecksum,
} from "../../../src/host/bookyDialogueRegistry";
import { getBookyJourneyActivityChecksum } from "../../../src/host/bookyJourneyActivity";
import { getBookyJourneyFactChecksum, parseBookyJourneyFact } from "../../../src/host/bookyJourneyFact";
import { contentRecordHash, contentTextHash } from "../../../src/planet/contentExportHash";
import {
  BOOKY_JOURNEY_DRAFT_MAX_BYTES, createBookyJourneyDraft, createBookyJourneyWorkspace, parseBookyJourneyDraft, parseBookyJourneyWorkspace, evaluateBookyJourneyDraftPreviewProfile,
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

function activityValue(): JourneyDraftInput {
  return { ...input(), activity: {
    type: "match-work-author",
    choices: [
      { countryId: "test-country", writerId: "other-writer" },
      { countryId: "test-country", writerId: "test-writer" },
    ],
    copy: {
      ru: { title: "Сопоставьте книгу и автора", body: "Выберите автора указанной книги из предложенных вариантов." },
      en: { title: "Match the work and author", body: "Choose the author of the indicated work from the available choices." },
    },
  } };
}

describe("adult Booky journey draft activity authoring", () => {
  it("preserves the exact D223 downloaded no-activity bytes and original source/definition checksums", () => {
    // Actual D223 browser-a2 download, not a regenerated expected fixture.
    // Original core SHA256: 5b1a6bbda53af7aed3fa9cff04833d7b09c5a86b07dd6002aa42870e6127c0e0.
    const legacy: JourneyDraftInput = {
      id: "synthetic-journey", version: 2, countryId: "country-a", writerId: "writer-a", workId: "work-a",
      ageRange: { min: 18, max: 65 }, readingLevel: "plain", estimatedDurationMinutes: 8,
      copy: {
        ru: { title: "Тестовый маршрут обновлён", description: "Черновик для проверки редактора.", nodes: {
          country: { title: "Начните со страны", body: "Откройте выбранную страну на глобусе." },
          writer: { title: "Перейдите к писателю", body: "Откройте выбранного писателя." },
          work: { title: "Откройте книгу", body: "Перейдите к выбранной книге в коллекции." },
          checkpoint: { title: "Подведите итог", body: "Отметьте завершение этого маршрута." },
        } },
        en: { title: "Synthetic journey", description: "A draft for testing the editor.", nodes: {
          country: { title: "Start with the country", body: "Open the selected country on the globe." },
          writer: { title: "Go to the writer", body: "Open the selected writer." },
          work: { title: "Open the book", body: "Go to the selected book in the collection." },
          checkpoint: { title: "Finish the journey", body: "Mark this journey as complete." },
        } },
      },
    };
    const canonical: JourneyDraftCatalog = { countries: [{ id: "country-a", label: { ru: "Тестовая страна А", en: "Synthetic country A" }, writers: [
      { id: "writer-a", label: { ru: "Тестовый писатель А", en: "Synthetic writer A" }, works: [
        { id: "work-a", label: { ru: "Тестовая книга А", en: "Synthetic work A" } },
      ] },
    ] }] };
    const exported = draft(legacy, canonical);
    expect(contentTextHash(JSON.stringify(exported, null, 2) + "\n"))
      .toBe("7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5");
    expect(exported.authoringSourceChecksum).toBe("07f1ac8a8337e8c3bcb712e43c46458494993f1758b29d998159a40b34373cee");
    expect(exported.definitionsChecksums).toEqual([
      { locale: "ru", checksum: "4ab845a9c3c153386a5252abac394a3d2cd46fe3d8fbf5ef0bba34a77b57a72d" },
      { locale: "en", checksum: "50ad521328a4d43c08afa68bc022a93c15d1ea29557cc1a28fc0bae55e189ac3" },
    ]);
    expect(Object.prototype.hasOwnProperty.call(exported.authoringSource.input, "activity")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(exported.authoringSource.selection, "activityChoices")).toBe(false);
    expect(exported.definitions.every(definition => definition.nodes.every(node => !Object.prototype.hasOwnProperty.call(node, "activity")))).toBe(true);
    expect(parseBookyJourneyDraft(JSON.stringify(exported), canonical).ok).toBe(true);
  });

  it("binds five nodes and ten RU/EN dialogues to canonical activity checksums, exact source copy and original choice labels", () => {
    const value = activityValue(), canonical = catalog(), before = JSON.stringify({ value, canonical });
    const exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    expect(exported.dialogues).toHaveLength(10);
    expect(exported.authoringSourceChecksum).toBe(contentRecordHash(exported.authoringSource));
    expect(exported.authoringSource.input.activity).toEqual(value.activity);
    expect(exported.authoringSource.selection.activityChoices?.map(choice => [choice.country.id, choice.writer.id, choice.writer.label])).toEqual([
      ["test-country", "other-writer", { ru: "Другой писатель", en: "Other writer" }],
      ["test-country", "test-writer", { ru: "Тестовый писатель", en: "Test writer" }],
    ]);
    for (const definition of exported.definitions) {
      expect(definition.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "activity", "checkpoint"]);
      expect(exported.definitionsChecksums.find(item => item.locale === definition.locale)?.checksum).toBe(getBookyJourneyChecksum(definition));
      const node = definition.nodes[3], spec = node.activity!;
      expect([node.id, node.kind, node.entity, node.screen]).toEqual(["activity", "activity", null, "globe"]);
      expect(spec).toEqual({ schemaVersion: 1, id: "test-route.match-author", version: 2, type: "match-work-author",
        targetWork: { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" },
        choices: [
          { id: "choice-1", writer: { kind: "writer", countryId: "test-country", writerId: "other-writer" } },
          { id: "choice-2", writer: { kind: "writer", countryId: "test-country", writerId: "test-writer" } },
        ],
      });
      const activityChecksum = getBookyJourneyActivityChecksum(spec);
      expect(activityChecksum).not.toBeNull();
      const record = exported.dialogues.find(record => record.payload.locale === definition.locale && record.payload.id === node.dialogue.id)!;
      const authored = value.activity!.copy[definition.locale];
      expect(record.payload.intent).toBe("activity");
      expect(record.payload.context).toBe(`activity:${contentRecordHash({ journeyId: "test-route", nodeId: "activity", activityChecksum })}`);
      expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
      expect(record.payload.entityIds).toEqual([...new Set([spec.targetWork, ...spec.choices.map(choice => choice.writer)].map(bookyJourneyEntityId))]);
      expect(record.payload.copy).toEqual({ title: authored.title, body: authored.body, caption: authored.title, reduced: authored.title });
      expect(record.payload.provenance).toEqual({ kind: "editorial", sourcePath: "authoringSource", sourceVersion: 1,
        sourceRef: `/input/activity/copy/${definition.locale}`, sourceSha256: exported.authoringSourceChecksum,
        copySha256: contentTextHash(JSON.stringify(authored)),
      });
      expect(record.payload.claimKind).toBe("interface-guidance");
      expect(record.payload.factualSources).toEqual([]);
      expect(record.payload.narration).toBeNull();
      expect(record.review.status).toBe("draft");
      expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
      expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
      for (const key of ["correctChoiceId", "semanticChecksum", "author"]) expect(Object.prototype.hasOwnProperty.call(spec, key)).toBe(false);
    }
    expect([exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved]).toEqual([false, false, false, false]);
    for (const list of [exported.journeyApprovals, exported.dialogueApprovals, exported.currentVersions, exported.availability]) expect(list).toEqual([]);
    value.activity!.copy.ru.body = "Изменённый текст формы.";
    canonical.countries[0].writers[1].label.en = "Changed canonical name";
    expect(exported.authoringSource.input.activity!.copy.ru.body).toBe("Выберите автора указанной книги из предложенных вариантов.");
    expect(exported.authoringSource.selection.activityChoices?.[0].writer.label.en).toBe("Other writer");
    expect(Object.isFrozen(exported.authoringSource.input.activity!.choices)).toBe(true);
  });

  it("accepts two to four scoped canonical writers without requiring the routing owner to be an answer choice", () => {
    const canonical = catalog();
    canonical.countries[0].writers = [...canonical.countries[0].writers,
      { id: "third-writer", label: { ru: "Третий писатель", en: "Third writer" }, works: [] },
    ];
    canonical.countries = [...canonical.countries,
      { id: "another-country", label: { ru: "Ещё одна страна", en: "Another country" }, writers: [
        { id: "other-writer", label: { ru: "Четвёртый писатель", en: "Fourth writer" }, works: [] },
        { id: "fifth-writer", label: { ru: "Пятый писатель", en: "Fifth writer" }, works: [] },
      ] },
    ];
    const choices = [
      { countryId: "test-country", writerId: "other-writer" },
      { countryId: "test-country", writerId: "third-writer" },
      { countryId: "another-country", writerId: "other-writer" },
      { countryId: "another-country", writerId: "fifth-writer" },
    ];
    for (const length of [2, 3, 4]) {
      const value = activityValue();
      value.activity!.choices = choices.slice(0, length);
      const exported = draft(value, canonical), spec = exported.definitions[0].nodes[3].activity!;
      expect(spec.choices.map(choice => choice.id)).toEqual(Array.from({ length }, (_, index) => `choice-${index + 1}`));
      expect(spec.choices.some(choice => choice.writer.writerId === "test-writer")).toBe(false);
      expect(spec.targetWork).toEqual({ kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" });
    }
  });

  it("rejects repeated writer tuples, missing canonical writers and absent or normalization-ambiguous original RU/EN names", () => {
    const duplicate = activityValue();
    duplicate.activity!.choices = [duplicate.activity!.choices[0], duplicate.activity!.choices[0]];
    expect(errors(duplicate)).toContain("activity.choices.1");
    for (const missing of [{ countryId: "missing-country", writerId: "other-writer" }, { countryId: "test-country", writerId: "missing-writer" }]) {
      const value = activityValue();
      value.activity!.choices = [missing, value.activity!.choices[1]];
      expect(errors(value)).toContain("activity.choices.0");
    }
    for (const locale of ["ru", "en"] as const) {
      for (const name of ["", " ", "a".repeat(201)]) {
        const canonical = catalog();
        canonical.countries[0].writers[1].label[locale] = name;
        expect(errors(activityValue(), canonical)).toContain(`activity.choices.0.label.${locale}`);
      }
      const canonical = catalog();
      canonical.countries[0].writers[0].label[locale] = locale === "ru" ? "АВТОР  ТЕСТ" : "AUTHOR  TEST";
      canonical.countries[0].writers[1].label[locale] = locale === "ru" ? "автор тест" : "ａｕｔｈｏｒ test";
      expect(errors(activityValue(), canonical)).toContain(`activity.choices.1.label.${locale}`);
    }
  });

  it("rejects null, missing or extra activity data, sparse choices, accessors and incomplete authored RU/EN copy", () => {
    const malformed: unknown[] = [null, undefined, {}, [], { ...activityValue().activity, type: "unknown" },
      { ...activityValue().activity, correctChoiceId: "choice-1" },
      { ...activityValue().activity, choices: [] }, { ...activityValue().activity, choices: [{ countryId: "test-country", writerId: "test-writer" }] },
      { ...activityValue().activity, choices: Array(2) },
      { ...activityValue().activity, choices: Array.from({ length: 5 }, () => ({ countryId: "test-country", writerId: "test-writer" })) },
      { ...activityValue().activity, choices: [{ countryId: "test-country", writerId: "other-writer", label: "Added name" }, { countryId: "test-country", writerId: "test-writer" }] },
    ];
    for (const change of [
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { Object.assign(activity.choices, { extra: true }); },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { Object.assign(activity.copy, { fr: activity.copy.en }); },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { Object.assign(activity.copy.en, { extra: true }); },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { activity.copy.ru.title = ""; },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { activity.copy.en.body = ""; },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { Object.defineProperty(activity, "type", { get: () => "match-work-author", enumerable: true }); },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { Object.defineProperty(activity, Symbol("extra"), { value: true }); },
      (activity: NonNullable<JourneyDraftInput["activity"]>) => { Object.defineProperty(activity.choices[0], "writerId", { get: () => "other-writer", enumerable: true }); },
    ]) {
      const activity = activityValue().activity!;
      change(activity);
      malformed.push(activity);
    }
    for (const activity of malformed) {
      const value = input();
      Object.assign(value, { activity });
      expect(errors(value)).toContain("activity");
    }
  });

  it("round trips activities and rejects current-choice drift, removed choices and activity copy/reference/authority tampering", () => {
    const exported = draft(activityValue()), serialized = JSON.stringify(exported);
    const result = parseBookyJourneyDraft(serialized, catalog());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input).toEqual(activityValue());
    expect(result.draft).toEqual(exported);
    for (const locale of ["ru", "en"] as const) {
      const canonical = catalog();
      canonical.countries[0].writers[1].label[locale] += " changed";
      expect(importErrors(serialized, canonical)).toContain("file");
    }
    const missing = catalog();
    missing.countries[0].writers = missing.countries[0].writers.slice(0, 1);
    expect(importErrors(serialized, missing)).toContain("activity.choices.0");
    const changes: ((value: Mutable<BookyJourneyDraft>) => void)[] = [
      value => { value.authoringSource.input.activity!.copy.en.body = "Changed activity body"; },
      value => { Object.assign(value.authoringSource.input.activity!, { correctChoiceId: "choice-1" }); },
      value => { value.authoringSource.selection.activityChoices![0].writer.label.en = "Changed imported name"; },
      value => { value.definitions[0].nodes[3].activity!.targetWork.workId = "other-work"; },
      value => { value.definitions[0].nodes[3].activity!.choices[0].writer.writerId = "missing-writer"; },
      value => { value.dialogues[3].payload.copy.body = "Подменённый текст задания."; },
      value => { value.dialogues[3].payload.entityIds = []; },
      value => { Reflect.deleteProperty(value.authoringSource.input, "activity"); },
      value => { Object.assign(value, { humanReviewed: true, releaseReady: true }); },
    ];
    for (const change of changes) {
      const value: Mutable<BookyJourneyDraft> = JSON.parse(serialized);
      change(value);
      importErrors(JSON.stringify(value));
    }
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

function factValue(): JourneyDraftInput {
  return { ...input(), fact: { copy: {
    ru: { title: "Тестовый факт", body: "Явно введённый редакторский текст для проверки схемы.\nВторая строка исходного текста.", sources: [
      { id: "source-ru", url: "https://example.org/ru/work", accessedAt: "2026-09-29T10:00:00.000Z" },
    ] },
    en: { title: "Synthetic fact", body: "Explicit editorial text for checking the schema.", sources: [
      { id: "source-en", url: "https://example.org/en/work", accessedAt: "2026-09-28T11:30:00.000Z" },
    ] },
  } } };
}
function factRecord(exported: BookyJourneyDraft, locale: "ru" | "en") {
  return exported.dialogues.find(record => record.payload.intent === "sourced-fact" && record.payload.locale === locale)!;
}

describe("adult Booky journey draft sourced-fact authoring", () => {
  it("binds ten draft dialogues and the same ordered bilingual fact table to the selected work using the real schemas", () => {
    const value = factValue(), exported = draft(value);
    expect(exported.dialogues).toHaveLength(10);
    const expectedBindings = (["ru", "en"] as const).map(locale => ({
      locale, id: "test-route.sourced-fact", version: 2, contentChecksum: factRecord(exported, locale).review.contentChecksum,
    }));
    for (const definition of exported.definitions) {
      expect(definition.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "sourced-fact", "checkpoint"]);
      const node = definition.nodes[3], record = factRecord(exported, definition.locale), authored = value.fact!.copy[definition.locale];
      expect([node.id, node.kind, node.screen]).toEqual(["sourced-fact", "sourced-fact", "collection"]);
      expect(node.entity).toEqual(definition.nodes[2].entity);
      expect(node.fact).toEqual({ schemaVersion: 1, id: "test-route.work-fact", version: 2, dialogues: expectedBindings });
      expect(parseBookyJourneyFact(node.fact)).toEqual(node.fact);
      expect(getBookyJourneyFactChecksum(node.fact, node.entity!, node.screen)).not.toBeNull();
      expect(getBookyJourneyChecksum(definition)).toBe(exported.definitionsChecksums.find(item => item.locale === definition.locale)!.checksum);
      expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
      expect(record.payload.context).toBe(`fact:${contentRecordHash({ journeyId: "test-route", nodeId: "sourced-fact",
        factId: "test-route.work-fact", factVersion: 2, entity: node.entity, screen: "collection" })}`);
      expect(record.payload.entityIds).toEqual([bookyJourneyEntityId(node.entity!)]);
      expect(record.payload.copy).toEqual({ title: authored.title, body: authored.body, caption: authored.title, reduced: authored.title });
      expect(record.payload.factualSources).toEqual(authored.sources);
      expect(record.payload.claimKind).toBe("factual");
      expect(record.payload.provenance).toEqual({ kind: "editorial", sourcePath: "authoringSource", sourceVersion: 1,
        sourceRef: `/input/fact/copy/${definition.locale}`, sourceSha256: exported.authoringSourceChecksum,
        copySha256: contentTextHash(JSON.stringify({ title: authored.title, body: authored.body })),
      });
      expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
      expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
      expect(record.review).toEqual({ status: "draft", reviewer: null, reviewedAt: null, contentChecksum: node.dialogue.contentChecksum });
      expect(record.payload.narration).toBeNull();
      expect(record.payload.prohibitedTags).toEqual([]);
      expect(node.fact!.dialogues.every(binding => binding.contentChecksum !== "0".repeat(64))).toBe(true);
    }
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: [...new Set(exported.definitions[0].nodes.flatMap(node => node.entity ? [bookyJourneyEntityId(node.entity)] : []))],
      approvedReviews: [],
    });
    expect(registry.size).toBe(10);
    expect(registry.rejections).toEqual([]);
    for (const record of exported.dialogues) expect(registry.resolve({
      id: record.payload.id, locale: record.payload.locale, audience: "adult", age: 30, readingLevel: "plain",
      intent: record.payload.intent, screen: record.payload.screens[0], context: record.payload.context,
      entityIds: record.payload.entityIds, now: "2026-09-30T12:00:00.000Z",
    })).toBeNull();
    for (const definition of exported.definitions) expect(compileBookyJourney(definition, {
      audience: "adult", age: 30, locale: definition.locale, readingLevel: "plain", now: "2026-09-30T12:00:00.000Z",
      connectivity: "online", completedPrerequisites: [], availability: [],
    }, { currentVersions: [], approvedReviews: [], dialogueRegistry: registry, publicCountries: [], publicBooks: [] })).toBeNull();
    expect([exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved]).toEqual([false, false, false, false]);
    for (const entries of [exported.journeyApprovals, exported.dialogueApprovals, exported.currentVersions, exported.availability]) expect(entries).toEqual([]);
  });

  it("keeps locale copy and citations independent while rebinding both factual payloads to changed shared authoring bytes", () => {
    const original = draft(factValue()), changedInput = factValue();
    changedInput.fact!.copy.ru.body = "Другой явно введённый текст.";
    changedInput.fact!.copy.ru.sources = [{ id: "replacement-ru", url: "https://example.org/ru/changed", accessedAt: "2026-09-29T12:00:00.000Z" }];
    const changed = draft(changedInput);
    expect(factRecord(changed, "en").payload.copy).toEqual(factRecord(original, "en").payload.copy);
    expect(factRecord(changed, "en").payload.factualSources).toEqual(factRecord(original, "en").payload.factualSources);
    expect(factRecord(changed, "en").payload.provenance.copySha256).toBe(factRecord(original, "en").payload.provenance.copySha256);
    expect(factRecord(changed, "ru").payload.provenance.copySha256).not.toBe(factRecord(original, "ru").payload.provenance.copySha256);
    for (const locale of ["ru", "en"] as const) {
      const record = factRecord(changed, locale);
      expect(record.review.contentChecksum).not.toBe(factRecord(original, locale).review.contentChecksum);
      expect(record.payload.provenance.sourceSha256).toBe(changed.authoringSourceChecksum);
      expect(changed.definitions.every(definition => definition.nodes[3].fact!.dialogues.find(binding => binding.locale === locale)!.contentChecksum
        === getBookyDialogueContentChecksum(record.payload))).toBe(true);
    }
    expect(changed.definitions[0].nodes[3].fact).toEqual(changed.definitions[1].nodes[3].fact);
    expect(getBookyJourneyFactChecksum(changed.definitions[0].nodes[3].fact, changed.definitions[0].nodes[3].entity!, "collection"))
      .not.toBe(getBookyJourneyFactChecksum(original.definitions[0].nodes[3].fact, original.definitions[0].nodes[3].entity!, "collection"));
  });

  it("copies and freezes every factual source without retaining or mutating caller data", () => {
    const value = factValue(), canonical = catalog(), before = JSON.stringify({ value, canonical });
    const exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    expect(draft(value, canonical)).toEqual(exported);
    value.fact!.copy.ru.sources[0].url = "https://example.org/changed";
    value.fact!.copy.en.title = "Changed caller title";
    canonical.countries[0].writers[0].works[0].label.en = "Changed canonical work";
    expect(exported.authoringSource.input.fact!.copy.ru.sources[0].url).toBe("https://example.org/ru/work");
    expect(factRecord(exported, "ru").payload.factualSources[0].url).toBe("https://example.org/ru/work");
    expect(exported.authoringSource.input.fact!.copy.en.title).toBe("Synthetic fact");
    expect(exported.authoringSource.selection.work.label.en).toBe("Test work");
    expect(Object.isFrozen(exported.authoringSource.input.fact!.copy.ru.sources)).toBe(true);
    expect(Object.isFrozen(factRecord(exported, "en").payload.factualSources[0])).toBe(true);
    expect(Object.isFrozen(exported.definitions[0].nodes[3].fact!.dialogues)).toBe(true);
    expect(Object.isFrozen(value.fact)).toBe(false);
  });

  it("accepts one to sixteen explicit sources and registry text limits but rejects invalid IDs, URLs, timestamps and bounds", () => {
    for (const length of [1, 16]) {
      const value = factValue();
      for (const locale of ["ru", "en"] as const) {
        value.fact!.copy[locale].title = "a".repeat(160);
        value.fact!.copy[locale].body = "b".repeat(1600);
        value.fact!.copy[locale].sources = Array.from({ length }, (_, index) => ({
          id: `source-${index}`, url: `https://example.org/${locale}/${index}`, accessedAt: "2024-02-29T12:00:00.000Z",
        }));
      }
      const exported = draft(value);
      expect(factRecord(exported, "ru").payload.factualSources).toHaveLength(length);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    }
    const invalidSources = [
      { id: "" }, { id: "Uppercase" }, { id: "a".repeat(97) }, { id: "with space" },
      { url: "http://example.org/work" }, { url: "file:///work" }, { url: "not a URL" },
      { url: "https://user:secret@example.org/work" }, { url: "https://user@example.org/work" },
      { url: "https://" }, { url: "https://example.org/" + "a".repeat(1000) }, { url: " https://example.org/work" },
      { accessedAt: "2026-02-30T12:00:00.000Z" }, { accessedAt: "2026-09-29T10:00:00Z" },
      { accessedAt: "2026-09-29T10:00:00.000+00:00" }, { accessedAt: "2026-09-29" }, { accessedAt: "" },
    ];
    for (const changedSource of invalidSources) {
      const value = factValue();
      Object.assign(value.fact!.copy.en.sources[0], changedSource);
      expect(errors(value)).toContain("fact");
    }
    for (const change of [
      (value: JourneyDraftInput) => { value.fact!.copy.en.title = "a".repeat(161); },
      (value: JourneyDraftInput) => { value.fact!.copy.ru.body = "b".repeat(1601); },
      (value: JourneyDraftInput) => { value.fact!.copy.ru.title = ""; },
      (value: JourneyDraftInput) => { value.fact!.copy.en.body = " "; },
      (value: JourneyDraftInput) => { value.fact!.copy.ru.body = "Unsupported\u000bcontrol"; },
      (value: JourneyDraftInput) => { value.fact!.copy.en.sources = []; },
      (value: JourneyDraftInput) => { value.fact!.copy.en.sources = Array.from({ length: 17 }, (_, index) => ({ id: `source-${index}`, url: "https://example.org/work", accessedAt: "2026-09-29T10:00:00.000Z" })); },
      (value: JourneyDraftInput) => { value.fact!.copy.ru.sources = [value.fact!.copy.ru.sources[0], { ...value.fact!.copy.ru.sources[0] }]; },
    ]) {
      const value = factValue(); change(value); expect(errors(value)).toContain("fact");
    }
    // Date syntax is checked without a fabricated review date or current clock.
    const future = factValue(); future.fact!.copy.en.sources[0].accessedAt = "2099-01-01T00:00:00.000Z";
    expect(draft(future).humanReviewed).toBe(false);
  });

  it("rejects unknown fields, sparse arrays, exotic prototypes and accessors without invoking getters", () => {
    const malformed: unknown[] = [null, undefined, {}, [],
      { ...factValue().fact, verified: true },
      { copy: { ru: factValue().fact!.copy.ru } },
      { copy: { ...factValue().fact!.copy, fr: factValue().fact!.copy.en } },
    ];
    let getterCalls = 0;
    const getter = () => { getterCalls++; throw new Error("getter must not execute"); };
    const changes: ((value: NonNullable<JourneyDraftInput["fact"]>) => void)[] = [
      value => { Object.assign(value.copy.ru, { approved: true }); },
      value => { Object.assign(value.copy.en.sources[0], { verified: true }); },
      value => { value.copy.ru.sources = Array(1); },
      value => { Object.assign(value.copy.en.sources, { extra: true }); },
      value => { Object.defineProperty(value.copy.en.sources, Symbol("extra"), { value: true }); },
      value => { Object.defineProperty(value, "copy", { get: getter, enumerable: true }); },
      value => { Object.defineProperty(value.copy, "ru", { get: getter, enumerable: true }); },
      value => { Object.defineProperty(value.copy.en, "sources", { get: getter, enumerable: true }); },
      value => { Object.defineProperty(value.copy.ru.sources, "0", { get: getter, enumerable: true }); },
      value => { Object.defineProperty(value.copy.en.sources[0], "url", { get: getter, enumerable: true }); },
      value => { Object.defineProperty(value.copy.ru.sources[0], "accessedAt", { get: getter, enumerable: true }); },
      value => { Object.defineProperty(value.copy.en.sources[0], "hidden", { value: true }); },
      value => { Object.setPrototypeOf(value.copy.ru.sources[0], { approved: true }); },
    ];
    for (const change of changes) { const value = factValue().fact!; change(value); malformed.push(value); }
    for (const fact of malformed) {
      const value = input(); Object.assign(value, { fact }); expect(errors(value)).toContain("fact");
    }
    const inputAccessor = input();
    Object.defineProperty(inputAccessor, "fact", { get: getter, enumerable: true });
    expect(errors(inputAccessor)).toContain("fact");
    expect(getterCalls).toBe(0);
  });

  it("round trips complete facts and rejects independently rehashed source, payload, bilingual binding and authority tampering", () => {
    const exported = draft(factValue()), serialized = JSON.stringify(exported), reopened = parseBookyJourneyDraft(serialized, catalog());
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.input).toEqual(factValue());
    expect(reopened.draft).toEqual(exported);
    const changes: ((value: Mutable<BookyJourneyDraft>) => void)[] = [
      value => { value.authoringSource.input.fact!.copy.ru.sources[0].url = "https://example.org/changed"; },
      value => { value.authoringSource.input.fact!.copy.en.body = "Changed input fact"; value.authoringSourceChecksum = contentRecordHash(value.authoringSource); },
      value => { value.definitions[0].nodes[3].fact!.dialogues.reverse(); },
      value => { value.definitions[1].nodes[3].fact!.dialogues[0].contentChecksum = "0".repeat(64); },
      value => { value.definitions[0].nodes[3].entity = { kind: "work", countryId: "test-country", writerId: "other-writer", workId: "other-work" }; },
      value => {
        const record = value.dialogues.find(record => record.payload.intent === "sourced-fact" && record.payload.locale === "en")!;
        record.payload.factualSources[0].url = "https://example.org/changed";
        const contentChecksum = getBookyDialogueContentChecksum(record.payload)!;
        expect(contentChecksum).not.toBeNull();
        record.review.contentChecksum = contentChecksum;
        record.checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review })!;
        value.definitions[1].nodes[3].dialogue.contentChecksum = contentChecksum;
        for (const definition of value.definitions) definition.nodes[3].fact!.dialogues[1].contentChecksum = contentChecksum;
        value.definitionsChecksums = value.definitions.map(definition => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition)! }));
      },
      value => { value.dialogues.find(record => record.payload.intent === "sourced-fact")!.payload.provenance.sourceRef = "/input/fact/copy/en"; },
      value => { Object.assign(value, { humanReviewed: true, releaseReady: true }); },
    ];
    for (const change of changes) {
      const value: Mutable<BookyJourneyDraft> = JSON.parse(serialized); change(value);
      expect(importErrors(JSON.stringify(value))).toContain("file");
    }
    for (const invalidFact of [null, {}, { copy: { ru: factValue().fact!.copy.ru } }, { ...factValue().fact, sourceVerified: true }]) {
      const value: Mutable<BookyJourneyDraft> = JSON.parse(serialized);
      Object.assign(value.authoringSource.input, { fact: invalidFact });
      expect(importErrors(JSON.stringify(value))).toContain("fact");
    }
  });

  it("rejects fact drafts against stale or removed current canonical anchors and preserves missing country/writer EN issues", () => {
    const serialized = JSON.stringify(draft(factValue()));
    for (const entity of ["country", "writer", "work"] as const) {
      for (const locale of ["ru", "en"] as const) {
        const canonical = catalog(), country = canonical.countries[0], writer = country.writers[0];
        (entity === "country" ? country : entity === "writer" ? writer : writer.works[0]).label[locale] += " changed";
        expect(importErrors(serialized, canonical)).toContain("file");
      }
    }
    const removedWork = catalog(); removedWork.countries[0].writers[0].works = [];
    expect(importErrors(serialized, removedWork)).toContain("workId");
    expect(errors({ ...factValue(), workId: "other-work" })).toContain("workId");
    const missingEnglish = catalog();
    missingEnglish.countries[0].label.en = ""; missingEnglish.countries[0].writers[0].label.en = "";
    const exported = draft(factValue(), missingEnglish);
    expect(exported.blockingReviewIssues.map(issue => issue.field)).toEqual(["countryId", "writerId"]);
    expect(exported.authoringSource.selection.country.label.en).toBe("");
    expect(exported.authoringSource.selection.writer.label.en).toBe("");
    expect(parseBookyJourneyDraft(JSON.stringify(exported), missingEnglish).ok).toBe(true);
    missingEnglish.countries[0].writers[0].works[0].label.en = "";
    expect(importErrors(JSON.stringify(exported), missingEnglish)).toContain("workId");
  });

  it("combines six nodes and twelve dialogues without changing the current activity spec, its choices or the four navigation steps", () => {
    const activityOnly = draft(activityValue()), value = activityValue();
    value.fact = factValue().fact;
    const exported = draft(value);
    expect(exported.dialogues).toHaveLength(12);
    expect(exported.authoringSource.input.activity).toEqual(activityOnly.authoringSource.input.activity);
    expect(exported.authoringSource.selection.activityChoices).toEqual(activityOnly.authoringSource.selection.activityChoices);
    for (const definition of exported.definitions) {
      expect(definition.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "sourced-fact", "activity", "checkpoint"]);
      const originalActivity = activityOnly.definitions.find(item => item.locale === definition.locale)!.nodes[3];
      const activity = definition.nodes[4];
      expect(activity.activity).toEqual(originalActivity.activity);
      expect(getBookyJourneyActivityChecksum(activity.activity)).toBe(getBookyJourneyActivityChecksum(originalActivity.activity));
      expect(bookyJourneyDialogueContext(definition.id, activity)).toBe(bookyJourneyDialogueContext(definition.id, originalActivity));
      expect(definition.nodes.filter(node => ["country", "writer", "work", "checkpoint"].includes(node.kind))
        .map(node => [node.id, node.entity, node.screen])).toEqual(activityOnly.definitions[0].nodes
        .filter(node => node.kind !== "activity").map(node => [node.id, node.entity, node.screen]));
      expect(getBookyJourneyChecksum(definition)).not.toBeNull();
    }
    expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(activityOnly.authoringSource.input, "fact")).toBe(false);
    expect(activityOnly.definitions.every(definition => definition.nodes.every(node => !Object.prototype.hasOwnProperty.call(node, "fact")))).toBe(true);
  });
});

type VariantCopy = JourneyDraftInput["copy"]["ru"]["nodes"]["work"];
type VariantKind = "country" | "writer" | "work" | "checkpoint" | "activity" | "sourced-fact";
function variantValue(): JourneyDraftInput {
  const value = activityValue();
  value.fact = factValue().fact;
  return value;
}
function variantCopies(value: JourneyDraftInput): { locale: "ru" | "en"; kind: VariantKind; copy: VariantCopy }[] {
  return (["ru", "en"] as const).flatMap(locale => [
    ...(["country", "writer", "work", "checkpoint"] as const).map(kind => ({ locale, kind, copy: value.copy[locale].nodes[kind] })),
    { locale, kind: "activity" as const, copy: value.activity!.copy[locale] },
    { locale, kind: "sourced-fact" as const, copy: value.fact!.copy[locale] },
  ]);
}
function variantRecord(exported: BookyJourneyDraft, locale: "ru" | "en", kind: VariantKind) {
  return exported.dialogues.find(record => record.payload.locale === locale && record.payload.id === `test-route.${kind}`)!;
}

describe("adult Booky journey draft optional copy variants", () => {
  it("binds explicit RU/EN variants on every navigation, factual and activity node to the existing registry schemas", () => {
    const value = variantValue();
    for (const { locale, kind, copy } of variantCopies(value)) {
      copy.caption = `${locale} ${kind} caption\nSecond line.`;
      copy.reduced = `${locale} ${kind} reduced`;
    }
    const exported = draft(value);
    expect(exported.authoringSource.input).toEqual(value);
    expect(exported.authoringSourceChecksum).toBe(contentRecordHash(exported.authoringSource));
    expect(exported.dialogues).toHaveLength(12);
    for (const { locale, kind, copy } of variantCopies(value)) {
      const record = variantRecord(exported, locale, kind);
      expect(record.payload.copy).toEqual({ title: copy.title, body: copy.body, caption: copy.caption, reduced: copy.reduced });
      expect(record.payload.provenance.copySha256).toBe(contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })));
      expect(record.payload.provenance.sourceSha256).toBe(exported.authoringSourceChecksum);
      expect(getBookyDialogueContentChecksum(record.payload)).toBe(record.review.contentChecksum);
      expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
      expect(record.review.status).toBe("draft");
      expect(record.payload.narration).toBeNull();
    }
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: [...new Set(exported.dialogues.flatMap(record => record.payload.entityIds))], approvedReviews: [],
    });
    expect(registry.size).toBe(12);
    expect(registry.rejections).toEqual([]);
    expect(exported.definitionsChecksums).toEqual(exported.definitions.map(definition => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition) })));
    expect([exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved]).toEqual([false, false, false, false]);
    expect(exported.journeyApprovals).toEqual([]);
    expect(exported.dialogueApprovals).toEqual([]);
  });

  it("keeps independent explicit presence while each omitted variant falls back to the original title", () => {
    const omitted = draft(variantValue()), value = variantValue();
    for (const { locale, copy } of variantCopies(value)) {
      if (locale === "ru") copy.caption = copy.title;
      else copy.reduced = copy.title;
    }
    const exported = draft(value);
    for (const { locale, kind, copy } of variantCopies(exported.authoringSource.input)) {
      expect(Object.keys(copy)).toEqual(kind === "sourced-fact"
        ? ["title", "body", locale === "ru" ? "caption" : "reduced", "sources"]
        : ["title", "body", locale === "ru" ? "caption" : "reduced"]);
      expect(variantRecord(exported, locale, kind).payload.copy).toEqual(variantRecord(omitted, locale, kind).payload.copy);
      expect(Object.prototype.hasOwnProperty.call(copy, locale === "ru" ? "reduced" : "caption")).toBe(false);
      expect(Object.keys(variantCopies(omitted.authoringSource.input).find(item => item.locale === locale && item.kind === kind)!.copy))
        .toEqual(kind === "sourced-fact" ? ["title", "body", "sources"] : ["title", "body"]);
    }
    expect(exported.authoringSourceChecksum).not.toBe(omitted.authoringSourceChecksum);
    expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
  });

  it("accepts bounded multiline variants and rejects missing text, nonstrings, controls and every over-limit variant", () => {
    const valid = variantValue();
    for (const { copy } of variantCopies(valid)) {
      copy.caption = "c".repeat(1600);
      copy.reduced = "r".repeat(320);
    }
    expect(draft(valid).dialogues).toHaveLength(12);
    for (const { copy } of variantCopies(valid)) { copy.caption = "First\nSecond\tline\r\nThird"; copy.reduced = "Short\nSecond"; }
    expect(parseBookyJourneyDraft(JSON.stringify(draft(valid)), catalog()).ok).toBe(true);
    for (let index = 0; index < 12; index++) {
      for (const field of ["caption", "reduced"] as const) {
        for (const invalid of [undefined, null, "", " ", " padded", "padded ", "bad\u000bcontrol", "bad\u007fcontrol", 1, {}, "x".repeat(field === "caption" ? 1601 : 321)]) {
          const value = variantValue();
          Object.assign(variantCopies(value)[index].copy, { [field]: invalid });
          expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
        }
      }
      const value = variantValue();
      variantCopies(value)[index].copy.body = "b".repeat(1601);
      expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
    }
  });

  it("rejects extra, hidden, inherited and accessor copy fields without evaluating authoring getters", () => {
    let getterCalls = 0;
    const getter = () => { getterCalls++; throw new Error("authoring getter must not execute"); };
    const malformed: ((copy: VariantCopy) => void)[] = [
      copy => { Object.assign(copy, { audioApproved: true }); },
      copy => { Object.defineProperty(copy, "caption", { value: "Hidden" }); },
      copy => { Object.defineProperty(copy, Symbol("extra"), { value: "Hidden" }); },
      copy => { Object.setPrototypeOf(copy, { caption: "Inherited" }); },
      copy => { Object.defineProperty(copy, "caption", { enumerable: true, get: getter }); },
      copy => { Object.defineProperty(copy, "reduced", { enumerable: true, get: getter }); },
      copy => { Object.defineProperty(copy, "body", { enumerable: true, get: getter }); },
    ];
    for (let index = 0; index < 12; index++) for (const change of malformed) {
      const value = variantValue(); change(variantCopies(value)[index].copy);
      expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
    }
    for (const change of [
      (value: JourneyDraftInput) => { Object.defineProperty(value, "copy", { enumerable: true, get: getter }); },
      (value: JourneyDraftInput) => { Object.defineProperty(value.copy, "ru", { enumerable: true, get: getter }); },
      (value: JourneyDraftInput) => { Object.defineProperty(value.copy.en, "nodes", { enumerable: true, get: getter }); },
      (value: JourneyDraftInput) => { Object.defineProperty(value.copy.ru.nodes, "work", { enumerable: true, get: getter }); },
      (value: JourneyDraftInput) => { Object.assign(value.copy.en, { caption: "Wrong level" }); },
    ]) {
      const value = variantValue(); change(value);
      expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
    }
    expect(getterCalls).toBe(0);
  });

  it("round trips explicit variants into immutable independent clones and still rejects current canonical drift", () => {
    const value = variantValue();
    value.copy.ru.nodes.work.caption = "Подпись книги";
    value.activity!.copy.en.reduced = "Choose an author";
    value.fact!.copy.ru.caption = "Подпись факта";
    value.fact!.copy.en.reduced = "Short fact";
    const before = JSON.stringify(value), exported = draft(value), serialized = JSON.stringify(exported);
    expect(JSON.stringify(value)).toBe(before);
    const reopened = parseBookyJourneyDraft(serialized, catalog());
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.input).toEqual(value);
    expect(reopened.input).not.toBe(value);
    expect(reopened.draft).toEqual(exported);
    expect(JSON.stringify(reopened.draft)).toBe(serialized);
    for (const { copy } of variantCopies(reopened.input)) expect(Object.isFrozen(copy)).toBe(true);
    value.copy.ru.nodes.work.caption = "Changed caller";
    value.activity!.copy.en.reduced = "Changed caller";
    value.fact!.copy.en.sources[0].url = "https://example.org/changed";
    expect(reopened.input.copy.ru.nodes.work.caption).toBe("Подпись книги");
    expect(reopened.input.activity!.copy.en.reduced).toBe("Choose an author");
    expect(reopened.input.fact!.copy.en.sources[0].url).toBe("https://example.org/en/work");
    const current = catalog(); current.countries[0].writers[0].works[0].label.en = "Changed work";
    expect(importErrors(serialized, current)).toContain("file");
  });

  it("rebinds bilingual fact checksums for variants while preserving main-copy provenance, citations and factual identity", () => {
    const original = draft(factValue()), value = factValue();
    value.fact!.copy.ru.caption = "Явная подпись факта";
    value.fact!.copy.ru.reduced = "Короткий факт";
    const exported = draft(value);
    for (const locale of ["ru", "en"] as const) {
      const record = factRecord(exported, locale), previous = factRecord(original, locale);
      expect(record.payload.provenance.copySha256).toBe(previous.payload.provenance.copySha256);
      expect(record.payload.context).toBe(previous.payload.context);
      expect(record.payload.factualSources).toEqual(previous.payload.factualSources);
      expect(record.review.contentChecksum).not.toBe(previous.review.contentChecksum);
      expect(record.payload.provenance.sourceSha256).toBe(exported.authoringSourceChecksum);
      for (const definition of exported.definitions) {
        const node = definition.nodes[3];
        expect(node.fact!.dialogues.find(binding => binding.locale === locale)!.contentChecksum).toBe(getBookyDialogueContentChecksum(record.payload));
        expect(getBookyJourneyFactChecksum(node.fact, node.entity!, node.screen)).not.toBeNull();
      }
    }
    expect(factRecord(exported, "en").payload.copy).toEqual(factRecord(original, "en").payload.copy);
    expect(exported.definitions[0].nodes[3].fact).toEqual(exported.definitions[1].nodes[3].fact);
    expect(exported.authoringSourceChecksum).not.toBe(original.authoringSourceChecksum);
  });

  it("rejects independently rehashed derived variants and altered explicit source presence against full regeneration", () => {
    const value = variantValue();
    for (const { copy } of variantCopies(value)) { copy.caption = "Explicit caption"; copy.reduced = "Explicit reduced"; }
    const serialized = JSON.stringify(draft(value));
    for (const kind of ["work", "activity", "sourced-fact"] as const) for (const field of ["caption", "reduced"] as const) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized);
      const record = changed.dialogues.find(item => item.payload.id === `test-route.${kind}` && item.payload.locale === "ru")!;
      record.payload.copy[field] = "Tampered derived variant";
      const checksum = getBookyDialogueContentChecksum(record.payload)!;
      expect(checksum).not.toBeNull();
      record.review.contentChecksum = checksum;
      record.checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review })!;
      for (const definition of changed.definitions) {
        if (definition.locale === "ru") definition.nodes.find(node => node.kind === kind)!.dialogue.contentChecksum = checksum;
        if (kind === "sourced-fact") definition.nodes.find(node => node.kind === kind)!.fact!.dialogues[0].contentChecksum = checksum;
      }
      changed.definitionsChecksums = changed.definitions.map(definition => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition)! }));
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
    for (const change of [
      (changed: Mutable<BookyJourneyDraft>) => { changed.authoringSource.input.copy.ru.nodes.work.caption = "Changed input caption"; },
      (changed: Mutable<BookyJourneyDraft>) => { delete changed.authoringSource.input.fact!.copy.ru.reduced; },
    ]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); change(changed);
      changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource);
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
  });

  it("rejects malformed imported optional fields on all node kinds before they can grant any draft authority", () => {
    const serialized = JSON.stringify(draft(variantValue()));
    for (let index = 0; index < 12; index++) for (const invalid of [null, "", " padded", "x".repeat(1601)]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized);
      Object.assign(variantCopies(changed.authoringSource.input)[index].copy, { caption: invalid });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), catalog()).ok).toBe(false);
    }
    for (let index = 0; index < 12; index++) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized);
      Object.assign(variantCopies(changed.authoringSource.input)[index].copy, { reduced: "x".repeat(321), narrationApproved: true });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), catalog()).ok).toBe(false);
    }
    expect(parseBookyJourneyDraft(serialized, catalog()).ok).toBe(true);
  });
});

describe("adult Booky journey draft local profile evaluation", () => {
  it("matches the compiled age bounds inclusively and distinguishes an outside adult age from an invalid age", () => {
    const value = input(); value.ageRange = { min: 18, max: 65 };
    const definition = draft(value).definitions[0];
    for (const age of [18, 30, 65]) expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age, readingLevel: "plain" }))
      .toEqual({ status: "matches", ageMatches: true, readingLevelMatches: true });
    for (const age of [66, 120]) expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age, readingLevel: "plain" }))
      .toEqual({ status: "outside", ageMatches: false, readingLevelMatches: true });
    for (const age of [17, 18.5, 121]) expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age, readingLevel: "plain" }))
      .toEqual({ status: "invalid", ageMatches: null, readingLevelMatches: null });
    value.ageRange = { min: 30, max: 30 };
    const oneAge = draft(value).definitions[1];
    expect(evaluateBookyJourneyDraftPreviewProfile(oneAge, { age: 30, readingLevel: "plain" }).status).toBe("matches");
    for (const age of [29, 31]) expect(evaluateBookyJourneyDraftPreviewProfile(oneAge, { age, readingLevel: "plain" }).status).toBe("outside");
  });

  it("requires the exact compiled reading level and reports each adult condition independently", () => {
    for (const readingLevel of ["plain", "developing", "fluent"] as const) {
      const value = input(); value.readingLevel = readingLevel; value.ageRange = { min: 26, max: 40 };
      for (const definition of draft(value).definitions) for (const candidate of ["plain", "developing", "fluent"] as const) {
        expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age: 30, readingLevel: candidate })).toEqual({
          status: candidate === readingLevel ? "matches" : "outside", ageMatches: true, readingLevelMatches: candidate === readingLevel,
        });
        expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age: 50, readingLevel: candidate })).toEqual({
          status: "outside", ageMatches: false, readingLevelMatches: candidate === readingLevel,
        });
      }
    }
  });

  it("rejects malformed scenarios without coercion or accessor execution and returns immutable invalid results", () => {
    const definition = draft().definitions[0];
    let getterCalls = 0;
    const getter = () => { getterCalls++; throw new Error("profile getter must not execute"); };
    const invalid: unknown[] = [null, undefined, [], {}, "30", { age: 30 }, { readingLevel: "plain" },
      { age: "30", readingLevel: "plain" }, { age: new Number(30), readingLevel: "plain" },
      { age: NaN, readingLevel: "plain" }, { age: Infinity, readingLevel: "plain" }, { age: true, readingLevel: "plain" },
      { age: 30, readingLevel: "Plain" }, { age: 30, readingLevel: " plain" }, { age: 30, readingLevel: "" },
      { age: 30, readingLevel: null }, { age: 30, readingLevel: new String("plain") },
      { age: 30, readingLevel: "plain", approved: true }, Object.create({ age: 30, readingLevel: "plain" }),
    ];
    for (const change of [
      (scenario: Record<string, unknown>) => { Object.defineProperty(scenario, "age", { enumerable: true, get: getter }); },
      (scenario: Record<string, unknown>) => { Object.defineProperty(scenario, "readingLevel", { enumerable: true, get: getter }); },
      (scenario: Record<string, unknown>) => { Object.defineProperty(scenario, "age", { value: 30, enumerable: false }); },
      (scenario: Record<string, unknown>) => { Object.defineProperty(scenario, Symbol("extra"), { value: true }); },
    ]) {
      const scenario = { age: 30, readingLevel: "plain" }; change(scenario); invalid.push(scenario);
    }
    invalid.push(new Proxy({}, { ownKeys() { throw new Error("unreadable profile"); } }));
    for (const scenario of invalid) {
      const result = evaluateBookyJourneyDraftPreviewProfile(definition, scenario);
      expect(result).toEqual({ status: "invalid", ageMatches: null, readingLevelMatches: null });
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(getterCalls).toBe(0);
    const plainData = Object.assign(Object.create(null), { age: 30, readingLevel: "plain" });
    expect(evaluateBookyJourneyDraftPreviewProfile(definition, plainData).status).toBe("matches");
  });

  it("uses each newly compiled definition and leaves scenario, authoring data and serialized draft bytes unchanged", () => {
    const value = variantValue(); value.ageRange = { min: 18, max: 65 }; value.copy.ru.nodes.work.caption = "Подпись";
    const scenario = { age: 30, readingLevel: "plain" }, exported = draft(value);
    const before = JSON.stringify({ value, scenario, exported });
    for (const definition of exported.definitions) {
      const result = evaluateBookyJourneyDraftPreviewProfile(definition, scenario);
      expect(result.status).toBe("matches");
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(JSON.stringify({ value, scenario, exported })).toBe(before);
    value.ageRange = { min: 40, max: 65 };
    value.readingLevel = "fluent";
    for (const definition of draft(value).definitions) expect(evaluateBookyJourneyDraftPreviewProfile(definition, scenario))
      .toEqual({ status: "outside", ageMatches: false, readingLevelMatches: false });
    expect(evaluateBookyJourneyDraftPreviewProfile(exported.definitions[0], scenario).status).toBe("matches");
    expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    expect(Object.isFrozen(scenario)).toBe(false);
  });

  it("agrees with authored dialogue conditions in both locales while a matching profile confers no runtime admission", () => {
    const value = variantValue(); value.ageRange = { min: 26, max: 65 }; value.readingLevel = "developing";
    const exported = draft(value), scenario = { age: 40, readingLevel: "developing" };
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: [...new Set(exported.dialogues.flatMap(record => record.payload.entityIds))], approvedReviews: [],
    });
    for (const definition of exported.definitions) {
      expect(evaluateBookyJourneyDraftPreviewProfile(definition, scenario)).toEqual({ status: "matches", ageMatches: true, readingLevelMatches: true });
      for (const record of exported.dialogues.filter(record => record.payload.locale === definition.locale)) {
        expect(record.payload.ageRange).toEqual(definition.ageRange);
        expect(record.payload.readingLevel).toBe(definition.readingLevel);
        expect(registry.resolve({ id: record.payload.id, locale: definition.locale, audience: "adult", age: scenario.age,
          readingLevel: "developing", intent: record.payload.intent, screen: record.payload.screens[0], context: record.payload.context,
          entityIds: record.payload.entityIds, now: "2026-10-01T12:00:00.000Z" })).toBeNull();
      }
      expect(compileBookyJourney(definition, { audience: "adult", age: scenario.age, locale: definition.locale,
        readingLevel: "developing", now: "2026-10-01T12:00:00.000Z", connectivity: "online", completedPrerequisites: [], availability: [],
      }, { currentVersions: [], approvedReviews: [], dialogueRegistry: registry, publicCountries: [], publicBooks: [] })).toBeNull();
    }
    expect(exported.dialogueApprovals).toEqual([]);
    expect(exported.journeyApprovals).toEqual([]);
    expect(exported.releaseReady).toBe(false);
  });
});

// Actual D228 downloaded activity and variant-bearing fact bytes, before authored order.
const historicalOrderlessDownloads: readonly { input: JourneyDraftInput; catalog: JourneyDraftCatalog; sha256: string }[] = [
  {
    "input": {
      "id": "synthetic-fact",
      "version": 4,
      "countryId": "country-a",
      "writerId": "writer-a",
      "workId": "work-a",
      "ageRange": {
        "min": 18,
        "max": 65
      },
      "readingLevel": "plain",
      "estimatedDurationMinutes": 10,
      "copy": {
        "ru": {
          "title": "Маршрут с черновиком факта",
          "description": "Синтетический текст и непроверенные ссылки для проверки формы.",
          "nodes": {
            "country": {
              "title": "Начните со страны",
              "body": "Откройте выбранную страну на глобусе."
            },
            "writer": {
              "title": "Перейдите к писателю",
              "body": "Откройте выбранного писателя."
            },
            "work": {
              "title": "Откройте книгу",
              "body": "Перейдите к выбранной книге в коллекции.",
              "caption": "Авторская синтетическая подпись шага книги."
            },
            "checkpoint": {
              "title": "Подведите итог",
              "body": "Отметьте завершение этого маршрута."
            }
          }
        },
        "en": {
          "title": "Journey with a draft fact",
          "description": "Synthetic text and unverified references for checking the form.",
          "nodes": {
            "country": {
              "title": "Start with the country",
              "body": "Open the selected country on the globe."
            },
            "writer": {
              "title": "Go to the writer",
              "body": "Open the selected writer."
            },
            "work": {
              "title": "Open the book",
              "body": "Go to the selected book in the collection."
            },
            "checkpoint": {
              "title": "Finish the journey",
              "body": "Mark this journey as complete."
            }
          }
        }
      },
      "fact": {
        "copy": {
          "ru": {
            "title": "Синтетическая запись о книге",
            "body": "Это вымышленный текст для проверки редактора.\nЭто не проверенный литературный факт.",
            "caption": "Синтетическая подпись.\nИсточники не проверены.",
            "reduced": "Короткая синтетическая запись; источники не проверены.",
            "sources": [
              {
                "id": "synthetic-ru-one",
                "url": "https://example.test/ru/unverified-work-note",
                "accessedAt": "2026-09-29T10:15:00.000Z"
              },
              {
                "id": "synthetic-ru-two",
                "url": "https://example.test/ru/unverified-second-note",
                "accessedAt": "2026-09-29T11:45:00.000Z"
              }
            ]
          },
          "en": {
            "title": "Synthetic work note",
            "body": "This is fictional text for checking the editor, not a verified literary fact.",
            "caption": "Synthetic caption.\nSources have not been reviewed.",
            "sources": [
              {
                "id": "synthetic-en-one",
                "url": "https://example.test/en/unverified-work-note",
                "accessedAt": "2026-09-28T09:30:00.000Z"
              }
            ]
          }
        }
      }
    },
    "catalog": {
      "countries": [
        {
          "id": "country-a",
          "label": {
            "ru": "Тестовая страна А",
            "en": "Synthetic country A"
          },
          "writers": [
            {
              "id": "writer-a",
              "label": {
                "ru": "Тестовый писатель А",
                "en": "Synthetic writer A"
              },
              "works": [
                {
                  "id": "work-a",
                  "label": {
                    "ru": "Тестовая книга А",
                    "en": "Synthetic work A"
                  }
                }
              ]
            }
          ]
        }
      ]
    },
    "sha256": "2aa86516bbd1c90ee2732b5d2130290a77019ae498410e69a5b9b1d566f63d18"
  },
  {
    "input": {
      "id": "synthetic-activity",
      "version": 3,
      "countryId": "country-a",
      "writerId": "writer-a",
      "workId": "work-a",
      "ageRange": {
        "min": 18,
        "max": 65
      },
      "readingLevel": "plain",
      "estimatedDurationMinutes": 10,
      "copy": {
        "ru": {
          "title": "Маршрут с заданием",
          "description": "Черновик задания по текущему каталогу.",
          "nodes": {
            "country": {
              "title": "Начните со страны",
              "body": "Откройте выбранную страну на глобусе."
            },
            "writer": {
              "title": "Перейдите к писателю",
              "body": "Откройте выбранного писателя."
            },
            "work": {
              "title": "Откройте книгу",
              "body": "Перейдите к выбранной книге в коллекции."
            },
            "checkpoint": {
              "title": "Подведите итог",
              "body": "Отметьте завершение этого маршрута."
            }
          }
        },
        "en": {
          "title": "Activity journey",
          "description": "A task draft checked against the current catalog.",
          "nodes": {
            "country": {
              "title": "Start with the country",
              "body": "Open the selected country on the globe."
            },
            "writer": {
              "title": "Go to the writer",
              "body": "Open the selected writer."
            },
            "work": {
              "title": "Open the book",
              "body": "Go to the selected book in the collection."
            },
            "checkpoint": {
              "title": "Finish the journey",
              "body": "Mark this journey as complete."
            }
          }
        }
      },
      "activity": {
        "type": "match-work-author",
        "choices": [
          {
            "countryId": "country-a",
            "writerId": "writer-a"
          },
          {
            "countryId": "country-b",
            "writerId": "writer-c"
          }
        ],
        "copy": {
          "ru": {
            "title": "Кто автор этой книги?",
            "body": "Выберите имя автора среди предложенных вариантов."
          },
          "en": {
            "title": "Who wrote this book?",
            "body": "Choose the author's name from the options."
          }
        }
      }
    },
    "catalog": {
      "countries": [
        {
          "id": "country-a",
          "label": {
            "ru": "Тестовая страна А",
            "en": "Synthetic country A"
          },
          "writers": [
            {
              "id": "writer-a",
              "label": {
                "ru": "Тестовый писатель А",
                "en": "Synthetic writer A"
              },
              "works": [
                {
                  "id": "work-a",
                  "label": {
                    "ru": "Тестовая книга А",
                    "en": "Synthetic work A"
                  }
                }
              ]
            }
          ]
        },
        {
          "id": "country-b",
          "label": {
            "ru": "Тестовая страна Б",
            "en": "Synthetic country B"
          },
          "writers": [
            {
              "id": "writer-c",
              "label": {
                "ru": "Тестовый писатель В",
                "en": "Synthetic writer C"
              },
              "works": []
            }
          ]
        }
      ]
    },
    "sha256": "e4a91f1919897785ae26abefc79cbddcefa8ba3da869d59db9a74529e7b6e3ff"
  }
];

describe("adult Booky journey draft optional node ordering", () => {
  it("preserves actual orderless activity and variant-bearing fact download bytes without serializing the new field", () => {
    for (const fixture of historicalOrderlessDownloads) {
      const exported = draft(fixture.input, fixture.catalog);
      expect(contentTextHash(JSON.stringify(exported, null, 2) + "\n")).toBe(fixture.sha256);
      expect(Object.prototype.hasOwnProperty.call(exported.authoringSource.input, "optionalNodeOrder")).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(exported.authoringSource.input, "prerequisites")).toBe(false);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), fixture.catalog).ok).toBe(true);
    }
    const combined = draft(variantValue());
    expect(combined.definitions[0].nodes.map(node => node.kind)).toEqual(["country", "writer", "work", "sourced-fact", "activity", "checkpoint"]);
    expect(Object.prototype.hasOwnProperty.call(combined.authoringSource.input, "optionalNodeOrder")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(draft().authoringSource.input, "optionalNodeOrder")).toBe(false);
  });

  it("validates both optional orders with the real dialogue, activity, fact and definition schemas while preserving base anchors", () => {
    for (const optionalNodeOrder of [["sourced-fact", "activity"], ["activity", "sourced-fact"]] as const) {
      const value = variantValue(); value.optionalNodeOrder = optionalNodeOrder;
      const exported = draft(value);
      expect(exported.dialogues).toHaveLength(12);
      expect(exported.authoringSource.input.optionalNodeOrder).toEqual(optionalNodeOrder);
      for (const definition of exported.definitions) {
        expect(definition.nodes.map(node => node.kind)).toEqual(["country", "writer", "work", ...optionalNodeOrder, "checkpoint"]);
        expect(definition.nodes.slice(0, 3).map(node => node.entity)).toEqual(draft().definitions[0].nodes.slice(0, 3).map(node => node.entity));
        expect(definition.nodes[definition.nodes.length - 1].entity).toBeNull();
        const factNode = definition.nodes.find(node => node.kind === "sourced-fact")!;
        const activityNode = definition.nodes.find(node => node.kind === "activity")!;
        expect(factNode.entity).toEqual(definition.nodes[2].entity);
        expect(getBookyJourneyFactChecksum(factNode.fact, factNode.entity!, factNode.screen)).not.toBeNull();
        expect(getBookyJourneyActivityChecksum(activityNode.activity)).not.toBeNull();
        for (const node of definition.nodes) {
          const record = exported.dialogues.find(item => item.payload.locale === definition.locale && item.payload.id === node.dialogue.id)!;
          expect(node.dialogue.contentChecksum).toBe(getBookyDialogueContentChecksum(record.payload));
          expect(record.checksum).toBe(getBookyDialogueChecksum({ payload: record.payload, review: record.review }));
          expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
        }
        expect(exported.definitionsChecksums.find(item => item.locale === definition.locale)!.checksum).toBe(getBookyJourneyChecksum(definition));
      }
      const registry = createBookyDialogueRegistry(exported.dialogues, {
        canonicalEntityIds: [...new Set(exported.dialogues.flatMap(record => record.payload.entityIds))], approvedReviews: [],
      });
      expect(registry.size).toBe(12);
      expect(registry.rejections).toEqual([]);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    }
  });

  it("accepts exactly the enabled optional set and rejects empty, omitted-node or disabled-node orders", () => {
    for (const [value, order] of [[factValue(), ["sourced-fact"]], [activityValue(), ["activity"]]] as const) {
      value.optionalNodeOrder = order;
      const exported = draft(value);
      expect(exported.definitions[0].nodes.map(node => node.kind)).toEqual(["country", "writer", "work", ...order, "checkpoint"]);
      expect(exported.authoringSource.input.optionalNodeOrder).toEqual(order);
    }
    for (const base of [input, factValue, activityValue, variantValue]) for (const order of [[], ["sourced-fact"], ["activity"], ["sourced-fact", "activity"]]) {
      const value = base(), enabled = [value.fact ? "sourced-fact" : null, value.activity ? "activity" : null].filter(Boolean);
      if (order.length > 0 && order.length === enabled.length && order.every(kind => enabled.includes(kind))) continue;
      Object.assign(value, { optionalNodeOrder: order });
      expect(errors(value)).toContain("optionalNodeOrder");
    }
  });

  it("rejects malformed order arrays and accessors without invoking getters or accepting extra data", () => {
    let getterCalls = 0;
    const getter = () => { getterCalls++; throw new Error("order getter must not execute"); };
    const malformed: unknown[] = [undefined, null, "activity", {}, [], ["activity", "activity"], ["sourced-fact", "sourced-fact"],
      ["activity", "sourced-fact", "activity"], ["country", "activity"], ["sourced-fact", "checkpoint"], [null, "activity"],
      [new String("activity"), "sourced-fact"], Array(2), [" activity", "sourced-fact"], ["Activity", "sourced-fact"]];
    const changes: ((order: unknown[]) => void)[] = [
      order => { delete order[0]; },
      order => { Object.assign(order, { extra: true }); },
      order => { Object.defineProperty(order, Symbol("extra"), { value: true }); },
      order => { Object.defineProperty(order, "hidden", { value: true }); },
      order => { Object.defineProperty(order, "0", { enumerable: true, get: getter }); },
      order => { Object.defineProperty(order, "1", { value: "activity", enumerable: false }); },
      order => { Object.setPrototypeOf(order, null); },
    ];
    for (const change of changes) { const order: unknown[] = ["sourced-fact", "activity"]; change(order); malformed.push(order); }
    for (const order of malformed) { const value = variantValue(); Object.assign(value, { optionalNodeOrder: order }); expect(errors(value)).toContain("optionalNodeOrder"); }
    for (const descriptor of [{ enumerable: true, get: getter }, { value: ["activity", "sourced-fact"], enumerable: false }]) {
      const value = variantValue(); Object.defineProperty(value, "optionalNodeOrder", descriptor);
      expect(errors(value)).toContain("optionalNodeOrder");
    }
    expect(getterCalls).toBe(0);
  });

  it("clones and freezes authored order and fresh reopened drafts independently of the caller array", () => {
    const value = variantValue(), order: ("activity" | "sourced-fact")[] = ["activity", "sourced-fact"];
    value.optionalNodeOrder = order;
    const before = JSON.stringify(value), exported = draft(value), serialized = JSON.stringify(exported);
    expect(JSON.stringify(value)).toBe(before);
    expect(exported.authoringSource.input.optionalNodeOrder).not.toBe(order);
    expect(Object.isFrozen(exported.authoringSource.input.optionalNodeOrder)).toBe(true);
    const reopened = parseBookyJourneyDraft(serialized, catalog());
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.input.optionalNodeOrder).toEqual(order);
    expect(reopened.input.optionalNodeOrder).not.toBe(exported.authoringSource.input.optionalNodeOrder);
    expect(Object.isFrozen(reopened.input.optionalNodeOrder)).toBe(true);
    expect(JSON.stringify(reopened.draft)).toBe(serialized);
    order.reverse();
    expect(exported.authoringSource.input.optionalNodeOrder).toEqual(["activity", "sourced-fact"]);
    expect(reopened.input.optionalNodeOrder).toEqual(["activity", "sourced-fact"]);
    expect(Object.isFrozen(order)).toBe(false);
  });

  it("rebinds all source, payload, bilingual fact and definition checksums while preserving factual identity and main-copy hashes", () => {
    const original = draft(variantValue()), value = variantValue(); value.optionalNodeOrder = ["activity", "sourced-fact"];
    const changed = draft(value);
    expect(changed.authoringSourceChecksum).not.toBe(original.authoringSourceChecksum);
    for (const record of changed.dialogues) {
      const prior = original.dialogues.find(item => item.payload.id === record.payload.id && item.payload.locale === record.payload.locale)!;
      expect(record.payload.copy).toEqual(prior.payload.copy);
      expect(record.payload.factualSources).toEqual(prior.payload.factualSources);
      expect(record.payload.provenance.copySha256).toBe(prior.payload.provenance.copySha256);
      expect(record.payload.context).toBe(prior.payload.context);
      expect(record.payload.provenance.sourceSha256).toBe(changed.authoringSourceChecksum);
      expect(record.review.contentChecksum).not.toBe(prior.review.contentChecksum);
      expect(record.review.status).toBe("draft");
    }
    for (const definition of changed.definitions) {
      const fact = definition.nodes.find(node => node.kind === "sourced-fact")!;
      for (const binding of fact.fact!.dialogues) expect(binding.contentChecksum).toBe(factRecord(changed, binding.locale).review.contentChecksum);
      expect(definition.nodes.find(node => node.kind === "activity")!.activity).toEqual(original.definitions[0].nodes.find(node => node.kind === "activity")!.activity);
      expect(getBookyJourneyChecksum(definition)).not.toBe(getBookyJourneyChecksum(original.definitions.find(item => item.locale === definition.locale)!));
    }
    expect([changed.humanReviewed, changed.childApproved, changed.narrationApproved, changed.releaseReady]).toEqual([false, false, false, false]);
    for (const entries of [changed.journeyApprovals, changed.dialogueApprovals, changed.currentVersions, changed.availability]) expect(entries).toEqual([]);
  });

  it("rejects source-order and independently rehashed derived ordering tampering through full regeneration", () => {
    const value = variantValue(); value.optionalNodeOrder = ["activity", "sourced-fact"];
    const serialized = JSON.stringify(draft(value));
    for (const change of [
      (changed: Mutable<BookyJourneyDraft>) => { changed.authoringSource.input.optionalNodeOrder!.reverse(); changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => { delete changed.authoringSource.input.optionalNodeOrder; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => {
        for (const definition of changed.definitions) [definition.nodes[3], definition.nodes[4]] = [definition.nodes[4], definition.nodes[3]];
        changed.definitionsChecksums = changed.definitions.map(definition => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition)! }));
      },
      (changed: Mutable<BookyJourneyDraft>) => { [changed.dialogues[3], changed.dialogues[4]] = [changed.dialogues[4], changed.dialogues[3]]; },
      (changed: Mutable<BookyJourneyDraft>) => { Object.assign(changed, { releaseReady: true }); },
    ]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); change(changed);
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
  });

  it("preserves strict order-field errors and rejects stale current canonical anchors and activity choices on reopen", () => {
    const value = variantValue(); value.optionalNodeOrder = ["activity", "sourced-fact"];
    const serialized = JSON.stringify(draft(value));
    for (const invalid of [null, [], ["activity"], ["activity", "activity"], ["activity", "sourced-fact", "checkpoint"], ["writer", "sourced-fact"]]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized);
      Object.assign(changed.authoringSource.input, { optionalNodeOrder: invalid });
      expect(importErrors(JSON.stringify(changed))).toContain("optionalNodeOrder");
    }
    for (const entity of ["country", "writer", "work", "choice"] as const) {
      const current = catalog(), country = current.countries[0], writer = country.writers[0];
      (entity === "country" ? country : entity === "writer" ? writer : entity === "work" ? writer.works[0] : country.writers[1]).label.en += " changed";
      expect(importErrors(serialized, current)).toContain("file");
    }
    const removedWork = catalog(); removedWork.countries[0].writers[0].works = [];
    expect(importErrors(serialized, removedWork)).toContain("workId");
    const removedChoice = catalog() as Mutable<JourneyDraftCatalog>; removedChoice.countries[0].writers.pop();
    expect(parseBookyJourneyDraft(serialized, removedChoice).ok).toBe(false);
  });
});

describe("adult Booky journey draft prerequisite references", () => {
  it("accepts one to sixteen explicit canonical references and the existing ID and version boundaries in both locales", () => {
    for (const count of [1, 16]) {
      const references = Array.from({ length: count }, (_, index) => ({ id: "required-" + index, version: index === count - 1 ? 1_000_000 : 1 }));
      references[0].id = "a";
      if (count === 16) {
        references[1].id = "z" + ".".repeat(95);
        references[2].id = "intro.route:v2_0-x";
        references[3] = Object.assign(Object.create(null), { id: "plain-null-record", version: 3 });
      }
      const value = input(); value.prerequisites = references;
      const exported = draft(value);
      expect(exported.authoringSource.input.prerequisites).toEqual(references);
      for (const definition of exported.definitions) {
        expect(definition.prerequisites).toEqual(references);
        expect(getBookyJourneyChecksum(definition)).not.toBeNull();
      }
      expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    }
  });

  it("rejects invalid IDs and versions, direct self-reference, duplicate IDs even across versions, and count limits", () => {
    for (const id of ["", "Bad", " bad", "bad ", "a/b", "a\nb", "a".repeat(97), "1wrong", "маршрут", null, new String("required")]) {
      const value = input(); Object.assign(value, { prerequisites: [{ id, version: 1 }] });
      expect(errors(value)).toContain("prerequisites.0.id");
    }
    for (const version of [0, -1, 1_000_001, 1.5, NaN, Infinity, null, "1", {}, undefined]) {
      const value = input(); Object.assign(value, { prerequisites: [{ id: "required", version }] });
      expect(errors(value)).toContain("prerequisites.0.version");
    }
    for (const version of [1, 3]) {
      const value = input(); value.prerequisites = [{ id: value.id, version }];
      expect(errors(value)).toContain("prerequisites.0.id");
      value.prerequisites = [{ id: "required", version: 1 }, { id: "required", version }];
      expect(errors(value)).toContain("prerequisites.1.id");
    }
    for (const references of [[], Array.from({ length: 17 }, (_, index) => ({ id: "required-" + index, version: 1 }))]) {
      const value = input(); value.prerequisites = references;
      expect(errors(value)).toContain("prerequisites");
    }
  });

  it("rejects sparse or exotic arrays, non-data rows and unknown properties without invoking any authoring getters", () => {
    let getterCalls = 0;
    const getter = () => { getterCalls++; throw new Error("prerequisite getter must not execute"); };
    const malformed: unknown[] = [undefined, null, "required", {}, Array(1), [null], [{ id: "required" }], [{ version: 1 }]];
    const arrayChanges: ((references: unknown[]) => void)[] = [
      references => { delete references[0]; },
      references => { Object.assign(references, { extra: true }); },
      references => { Object.defineProperty(references, "hidden", { value: true }); },
      references => { Object.defineProperty(references, Symbol("extra"), { value: true }); },
      references => { Object.defineProperty(references, "0", { enumerable: true, get: getter }); },
      references => { Object.defineProperty(references, "0", { value: { id: "required", version: 1 }, enumerable: false }); },
      references => { Object.setPrototypeOf(references, null); },
    ];
    for (const change of arrayChanges) { const references: unknown[] = [{ id: "required", version: 1 }]; change(references); malformed.push(references); }
    const rowChanges: ((reference: Record<string, unknown>) => void)[] = [
      reference => { Object.assign(reference, { completed: true }); },
      reference => { Object.defineProperty(reference, "hidden", { value: true }); },
      reference => { Object.defineProperty(reference, Symbol("extra"), { value: true }); },
      reference => { Object.defineProperty(reference, "id", { enumerable: true, get: getter }); },
      reference => { Object.defineProperty(reference, "version", { enumerable: true, get: getter }); },
      reference => { Object.defineProperty(reference, "id", { value: "required", enumerable: false }); },
      reference => { Object.setPrototypeOf(reference, { extra: true }); },
    ];
    for (const change of rowChanges) { const reference: Record<string, unknown> = { id: "required", version: 1 }; change(reference); malformed.push([reference]); }
    malformed.push([Object.create({ id: "required", version: 1 })]);
    for (const references of malformed) {
      const value = input(); Object.assign(value, { prerequisites: references });
      expect(errors(value)).toContain("prerequisites");
    }
    for (const descriptor of [{ enumerable: true, get: getter }, { value: [{ id: "required", version: 1 }], enumerable: false }]) {
      const value = input(); Object.defineProperty(value, "prerequisites", descriptor);
      expect(errors(value)).toContain("prerequisites");
    }
    expect(getterCalls).toBe(0);
  });

  it("clones and freezes every reference independently in source, both definitions and a reopened draft without mutating callers", () => {
    const references = [{ id: "required", version: 1 }, { id: "other.route", version: 7 }], value = input();
    value.prerequisites = references;
    const before = JSON.stringify(value), exported = draft(value), serialized = JSON.stringify(exported);
    expect(JSON.stringify(value)).toBe(before);
    const groups = [exported.authoringSource.input.prerequisites!, ...exported.definitions.map(definition => definition.prerequisites)];
    for (const group of groups) {
      expect(group).toEqual(references); expect(group).not.toBe(references); expect(Object.isFrozen(group)).toBe(true);
      for (let index = 0; index < group.length; index++) { expect(group[index]).not.toBe(references[index]); expect(Object.isFrozen(group[index])).toBe(true); }
    }
    expect(groups[0]).not.toBe(groups[1]); expect(groups[1]).not.toBe(groups[2]); expect(groups[1][0]).not.toBe(groups[2][0]);
    const reopened = parseBookyJourneyDraft(serialized, catalog()); expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.input.prerequisites).toEqual(references); expect(reopened.input.prerequisites).not.toBe(groups[0]);
    expect(Object.isFrozen(reopened.input.prerequisites)).toBe(true); expect(Object.isFrozen(reopened.input.prerequisites![0])).toBe(true);
    references[0].id = "changed"; references[1].version = 9; references.push({ id: "later", version: 2 });
    expect(JSON.stringify(exported)).toBe(serialized); expect(JSON.stringify(reopened.draft)).toBe(serialized);
    expect(Object.isFrozen(references)).toBe(false); expect(Object.isFrozen(references[0])).toBe(false);
    expect(draft(value).authoringSourceChecksum).not.toBe(exported.authoringSourceChecksum);
  });

  it("rebinds source, every dialogue, both factual payloads and definitions while preserving authored copy, citations and activity identity", () => {
    const original = draft(variantValue()), value = variantValue(); value.prerequisites = [{ id: "required.route", version: 4 }];
    const changed = draft(value);
    expect(changed.authoringSourceChecksum).not.toBe(original.authoringSourceChecksum);
    expect(changed.authoringSourceChecksum).toBe(contentRecordHash(changed.authoringSource));
    for (const record of changed.dialogues) {
      const prior = original.dialogues.find(item => item.payload.id === record.payload.id && item.payload.locale === record.payload.locale)!;
      expect(record.payload.copy).toEqual(prior.payload.copy); expect(record.payload.factualSources).toEqual(prior.payload.factualSources);
      expect(record.payload.context).toBe(prior.payload.context); expect(record.payload.provenance.copySha256).toBe(prior.payload.provenance.copySha256);
      expect(record.payload.provenance.sourceSha256).toBe(changed.authoringSourceChecksum);
      expect(record.review.contentChecksum).not.toBe(prior.review.contentChecksum); expect(getBookyDialogueContentChecksum(record.payload)).toBe(record.review.contentChecksum);
      expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
    }
    for (const definition of changed.definitions) {
      const prior = original.definitions.find(item => item.locale === definition.locale)!;
      expect(getBookyJourneyChecksum(definition)).not.toBe(getBookyJourneyChecksum(prior));
      expect(changed.definitionsChecksums.find(item => item.locale === definition.locale)!.checksum).toBe(getBookyJourneyChecksum(definition));
      const fact = definition.nodes.find(node => node.kind === "sourced-fact")!;
      expect(getBookyJourneyFactChecksum(fact.fact, fact.entity!, fact.screen)).not.toBeNull();
      for (const binding of fact.fact!.dialogues) expect(binding.contentChecksum).toBe(factRecord(changed, binding.locale).review.contentChecksum);
      expect(definition.nodes.find(node => node.kind === "activity")!.activity).toEqual(prior.nodes.find(node => node.kind === "activity")!.activity);
    }
  });

  it("rejects malformed imports and independently rehashed source or derived prerequisite tampering through complete regeneration", () => {
    const value = variantValue(); value.prerequisites = [{ id: "required.route", version: 4 }];
    const serialized = JSON.stringify(draft(value));
    for (const references of [null, [], [{ id: "required", version: 0 }], [{ id: value.id, version: 1 }], [{ id: "required", version: 1, completed: true }]]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); Object.assign(changed.authoringSource.input, { prerequisites: references });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), catalog()).ok).toBe(false);
    }
    for (const change of [
      (changed: Mutable<BookyJourneyDraft>) => { changed.authoringSource.input.prerequisites![0].version++; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => { delete changed.authoringSource.input.prerequisites; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => {
        for (const definition of changed.definitions) definition.prerequisites[0].version++;
        changed.definitionsChecksums = changed.definitions.map(definition => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition)! }));
      },
      (changed: Mutable<BookyJourneyDraft>) => { Object.assign(changed.definitions[0].prerequisites[0], { completed: true }); },
      (changed: Mutable<BookyJourneyDraft>) => { Object.assign(changed, { releaseReady: true }); },
    ]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); change(changed);
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
  });

  it("deletes the optional source field to restore both actual legacy download goldens exactly after adding references", () => {
    for (const fixture of historicalOrderlessDownloads) {
      const value = structuredClone(fixture.input); value.prerequisites = [{ id: "required.route", version: 4 }];
      expect(contentTextHash(JSON.stringify(draft(value, fixture.catalog), null, 2) + "\n")).not.toBe(fixture.sha256);
      delete value.prerequisites;
      const restored = draft(value, fixture.catalog);
      expect(contentTextHash(JSON.stringify(restored, null, 2) + "\n")).toBe(fixture.sha256);
      expect(Object.prototype.hasOwnProperty.call(restored.authoringSource.input, "prerequisites")).toBe(false);
      expect(restored.definitions.every(definition => definition.prerequisites.length === 0)).toBe(true);
    }
  });

  it("keeps unresolved references draft-only without changing adult profile matching or inventing availability and review authority", () => {
    const value = input(), ordinary = draft(value); value.prerequisites = [{ id: "unresolved.other-route", version: 6 }];
    const configured = draft(value);
    for (const definition of configured.definitions) {
      expect(definition.prerequisites).toEqual([{ id: "unresolved.other-route", version: 6 }]);
      expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age: 30, readingLevel: "plain" }))
        .toEqual(evaluateBookyJourneyDraftPreviewProfile(ordinary.definitions.find(item => item.locale === definition.locale)!, { age: 30, readingLevel: "plain" }));
    }
    for (const entries of [configured.journeyApprovals, configured.dialogueApprovals, configured.currentVersions, configured.availability]) expect(entries).toEqual([]);
    expect([configured.humanReviewed, configured.childApproved, configured.narrationApproved, configured.releaseReady]).toEqual([false, false, false, false]);
    expect(configured.dialogues.every(record => record.review.status === "draft")).toBe(true);
  });
});

function additionalWorkValue(base = input(), count = 2): JourneyDraftInput {
  return { ...base, additionalWorks: Array.from({ length: count }, (_, index) => ({ workId: `extra-work-${index + 1}`, copy: {
    ru: { title: `Откройте дополнение ${index + 1}`, body: `Просмотрите дополнительную книгу ${index + 1}.` },
    en: { title: `Open extra ${index + 1}`, body: `Explore additional work ${index + 1}.` },
  } })) };
}
function additionalWorkCatalog(value: JourneyDraftInput, base = catalog(), count = 8): JourneyDraftCatalog {
  const canonical = structuredClone(base), writer = canonical.countries.find(item => item.id === value.countryId)!.writers.find(item => item.id === value.writerId)!;
  writer.works = [...writer.works, ...Array.from({ length: count }, (_, index) => ({ id: `extra-work-${index + 1}`,
    label: { ru: `Дополнительная книга ${index + 1}`, en: `Additional work ${index + 1}` } }))];
  return canonical;
}

describe("adult Booky journey draft additional canonical works", () => {
  it("places one to eight distinct same-writer works before the unchanged main work with unique bilingual node and dialogue bindings", () => {
    for (const count of [1, 2, 8]) {
      const value = additionalWorkValue(input(), count), canonical = additionalWorkCatalog(value), exported = draft(value, canonical);
      expect(exported.dialogues).toHaveLength((4 + count) * 2);
      expect(exported.authoringSource.selection.additionalWorks?.map(item => [item.nodeId, item.work.id])).toEqual(
        Array.from({ length: count }, (_, index) => [`work-extra-${index + 1}`, `extra-work-${index + 1}`]));
      for (const definition of exported.definitions) {
        expect(definition.nodes.map(node => node.id)).toEqual(["country", "writer", ...Array.from({ length: count }, (_, index) => `work-extra-${index + 1}`), "work", "checkpoint"]);
        expect(new Set(definition.nodes.map(node => node.dialogue.id)).size).toBe(4 + count);
        expect(getBookyJourneyChecksum(definition)).toBe(exported.definitionsChecksums.find(item => item.locale === definition.locale)?.checksum);
        for (const [index, node] of definition.nodes.slice(2, 2 + count).entries()) {
          expect(node).toMatchObject({ kind: "work", screen: "collection", entity: { kind: "work", countryId: value.countryId, writerId: value.writerId, workId: `extra-work-${index + 1}` } });
          const record = exported.dialogues.find(item => item.payload.locale === definition.locale && item.payload.id === node.dialogue.id)!;
          expect(record.payload.context).toBe(bookyJourneyDialogueContext(value.id, node));
          expect(record.payload.entityIds).toEqual([bookyJourneyEntityId(node.entity!)]);
          expect(record.payload.copy.title).toBe(value.additionalWorks![index].copy[definition.locale].title);
          expect(record.payload.provenance.sourceRef).toBe(`/input/additionalWorks/${index}/copy/${definition.locale}`);
          expect(record.payload.provenance.sourceSha256).toBe(exported.authoringSourceChecksum);
          expect(record.payload.provenance.copySha256).toBe(contentTextHash(JSON.stringify({ title: record.payload.copy.title, body: record.payload.copy.body })));
          expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
          expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
        }
        expect(definition.nodes.at(-2)?.entity).toEqual({ kind: "work", countryId: value.countryId, writerId: value.writerId, workId: value.workId });
        expect(definition.nodes.at(-1)?.entity).toBeNull();
      }
      const registry = createBookyDialogueRegistry(exported.dialogues, { canonicalEntityIds: [...new Set(exported.dialogues.flatMap(item => item.payload.entityIds))], approvedReviews: [] });
      expect(registry.size).toBe((4 + count) * 2); expect(registry.rejections).toEqual([]);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), canonical).ok).toBe(true);
      expect([exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved]).toEqual([false, false, false, false]);
    }
  });

  it("rejects repeated, main, unknown or foreign work IDs, unavailable canonical labels and overlong entity bindings", () => {
    const canonical = additionalWorkCatalog(input());
    for (const workId of ["test-work", "other-work", "missing", "", "bad id", null, 1, undefined]) {
      const value = additionalWorkValue(); Object.assign(value.additionalWorks![0], { workId });
      expect(errors(value, canonical)).toContain("additionalWorks.0.workId");
    }
    const duplicate = additionalWorkValue(); duplicate.additionalWorks![1].workId = "extra-work-1";
    expect(errors(duplicate, canonical)).toContain("additionalWorks.1.workId");
    for (const locale of ["ru", "en"] as const) {
      const changed = structuredClone(canonical); changed.countries[0].writers[0].works[1].label[locale] = "";
      expect(errors(additionalWorkValue(), changed)).toContain("additionalWorks.0.workId");
    }
    const value = additionalWorkValue(), scoped = additionalWorkCatalog(value);
    scoped.countries[0].writers[1].works = [{ id: "extra-work-1", label: { ru: "Чужая локальная книга", en: "Foreign local work" } }];
    expect(draft(value, scoped).authoringSource.selection.additionalWorks![0].work.label.en).toBe("Additional work 1");
    const long = additionalWorkCatalog(value); long.countries[0].writers[0].works[1].id = "x".repeat(200); value.additionalWorks![0].workId = "x".repeat(200);
    expect(errors(value, long)).toContain("additionalWorks.0.workId");
  });

  it("rejects holes, exotic prototypes, non-data rows or copy records and hidden or unknown fields without executing getters", () => {
    let getterCalls = 0; const getter = () => { getterCalls++; throw new Error("additional work getter must not execute"); };
    const row = () => structuredClone(additionalWorkValue().additionalWorks![0]);
    const malformed: unknown[] = [undefined, null, {}, [], Array(1), [null], [{ workId: "extra-work-1" }], Array.from({ length: 9 }, row)];
    for (const change of [
      (rows: unknown[]) => { Object.defineProperty(rows, "0", { get: getter, enumerable: true }); },
      (rows: unknown[]) => { Object.defineProperty(rows, "0", { value: row(), enumerable: false }); },
      (rows: unknown[]) => { Object.defineProperty(rows, "hidden", { value: true }); },
      (rows: unknown[]) => { Object.assign(rows, { extra: true }); },
      (rows: unknown[]) => { Object.defineProperty(rows, Symbol("extra"), { value: true }); },
      (rows: unknown[]) => { Object.setPrototypeOf(rows, null); },
    ]) { const rows: unknown[] = [row()]; change(rows); malformed.push(rows); }
    for (const target of ["row", "copy", "ru"] as const) {
      for (const change of [
        (record: object) => { Object.assign(record, { extra: true }); },
        (record: object) => { Object.defineProperty(record, "hidden", { value: true }); },
        (record: object) => { Object.defineProperty(record, Symbol("extra"), { value: true }); },
        (record: object) => { Object.setPrototypeOf(record, { inherited: true }); },
      ]) { const item = row(); change(target === "row" ? item : target === "copy" ? item.copy : item.copy.ru); malformed.push([item]); }
    }
    for (const [target, key] of [["row", "workId"], ["row", "copy"], ["copy", "en"], ["ru", "title"], ["ru", "caption"]] as const) {
      const item = row(); Object.defineProperty(target === "row" ? item : target === "copy" ? item.copy : item.copy.ru, key, { enumerable: true, get: getter }); malformed.push([item]);
    }
    for (const rows of malformed) { const value = input(); Object.assign(value, { additionalWorks: rows }); expect(errors(value, additionalWorkCatalog(value))).toContain("additionalWorks"); }
    for (const property of [{ enumerable: true, get: getter }, { value: [row()], enumerable: false }]) {
      const value = input(); Object.defineProperty(value, "additionalWorks", property); expect(errors(value)).toContain("additionalWorks");
    }
    const plain = additionalWorkValue(); Object.assign(plain, { additionalWorks: [Object.assign(Object.create(null), row())] });
    expect(draft(plain, additionalWorkCatalog(plain)).authoringSource.input.additionalWorks).toHaveLength(1);
    expect(getterCalls).toBe(0);
  });

  it("applies existing separate RU EN main-copy and optional multiline variant bounds with precise actionable fields", () => {
    const canonical = additionalWorkCatalog(input());
    for (const locale of ["ru", "en"] as const) {
      for (const [field, max, paragraphs] of [["title", 160, false], ["body", 1600, true], ["caption", 1600, true], ["reduced", 320, true]] as const) {
        const bounded = additionalWorkValue(); bounded.additionalWorks![0].copy[locale][field] = "x".repeat(max);
        expect(createBookyJourneyDraft(bounded, canonical).ok).toBe(true);
        for (const bad of ["", " leading", "trailing ", "x".repeat(max + 1), "bad\u0000text", null, 4, undefined, ...(paragraphs ? [] : ["two\nlines"])]) {
          const value = additionalWorkValue(); Object.assign(value.additionalWorks![0].copy[locale], { [field]: bad });
          expect(errors(value, canonical)).toContain(`additionalWorks.0.copy.${locale}.${field}`);
        }
      }
      const value = additionalWorkValue(); value.additionalWorks![0].copy[locale].caption = "Первая строка\nВторая строка";
      value.additionalWorks![0].copy[locale].reduced = "First\nSecond";
      const exported = draft(value, canonical), record = exported.dialogues.find(item => item.payload.id === "test-route.work-extra-1" && item.payload.locale === locale)!;
      expect(record.payload.copy.caption).toBe(value.additionalWorks![0].copy[locale].caption);
      expect(record.payload.copy.reduced).toBe(value.additionalWorks![0].copy[locale].reduced);
      const omitted = additionalWorkValue(), old = draft(omitted, canonical).dialogues.find(item => item.payload.id === "test-route.work-extra-1" && item.payload.locale === locale)!;
      expect(record.payload.provenance.copySha256).toBe(old.payload.provenance.copySha256); expect(record.review.contentChecksum).not.toBe(old.review.contentChecksum);
      expect(exported.authoringSource.input.additionalWorks![1].copy[locale]).not.toHaveProperty("caption");
    }
  });

  it("keeps fact activity and checkpoint bound to the final main work through extra reordering and optional-step ordering while rehashing all source-bound payloads", () => {
    const value = additionalWorkValue(variantValue()), canonical = additionalWorkCatalog(value);
    value.optionalNodeOrder = ["activity", "sourced-fact"]; value.prerequisites = [{ id: "unresolved.route", version: 6 }];
    const ordinaryValue = structuredClone(value); delete ordinaryValue.additionalWorks;
    const ordinary = draft(ordinaryValue, canonical), exported = draft(value, canonical);
    for (const definition of exported.definitions) {
      expect(definition.nodes.map(node => node.id)).toEqual(["country", "writer", "work-extra-1", "work-extra-2", "work", "activity", "sourced-fact", "checkpoint"]);
      expect(definition.nodes[5].activity?.targetWork).toEqual(definition.nodes[4].entity);
      expect(definition.nodes[6].entity).toEqual(definition.nodes[4].entity);
      expect(definition.nodes[7].entity).toBeNull(); expect(definition.prerequisites).toEqual(value.prerequisites);
      expect(getBookyJourneyFactChecksum(definition.nodes[6].fact, definition.nodes[4].entity!, "collection")).toBeTruthy();
    }
    for (const old of ordinary.dialogues) {
      const next = exported.dialogues.find(item => item.payload.id === old.payload.id && item.payload.locale === old.payload.locale)!;
      expect(next.payload.copy).toEqual(old.payload.copy); expect(next.payload.context).toBe(old.payload.context);
      expect(next.payload.provenance.copySha256).toBe(old.payload.provenance.copySha256);
      expect(next.payload.provenance.sourceSha256).not.toBe(old.payload.provenance.sourceSha256);
      expect(next.review.contentChecksum).not.toBe(old.review.contentChecksum); expect(next.checksum).not.toBe(old.checksum);
      expect(next.payload.factualSources).toEqual(old.payload.factualSources);
    }
    value.additionalWorks = [...value.additionalWorks!].reverse(); const reordered = draft(value, canonical);
    expect(reordered.authoringSourceChecksum).not.toBe(exported.authoringSourceChecksum);
    expect(reordered.definitions[0].nodes[2].entity).toMatchObject({ workId: "extra-work-2" });
    expect(reordered.dialogues.find(item => item.payload.id === "test-route.work-extra-1" && item.payload.locale === "ru")?.payload.copy.title).toBe("Откройте дополнение 2");
    expect(reordered.definitions[0].nodes[5].activity?.targetWork).toEqual(exported.definitions[0].nodes[5].activity?.targetWork);
    expect(getBookyJourneyFactChecksum(reordered.definitions[0].nodes[6].fact, reordered.definitions[0].nodes[4].entity!, "collection"))
      .not.toBe(getBookyJourneyFactChecksum(exported.definitions[0].nodes[6].fact, exported.definitions[0].nodes[4].entity!, "collection"));
  });

  it("independently clones and freezes authored rows canonical snapshots and locale entities while leaving mutable callers untouched", () => {
    const value = additionalWorkValue(), canonical = additionalWorkCatalog(value), before = JSON.stringify({ value, canonical }), exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    const rows = exported.authoringSource.input.additionalWorks!, snapshots = exported.authoringSource.selection.additionalWorks!;
    expect(rows).not.toBe(value.additionalWorks); expect(rows[0]).not.toBe(value.additionalWorks![0]); expect(rows[0].copy.ru).not.toBe(value.additionalWorks![0].copy.ru);
    expect(snapshots[0].work.label).not.toBe(canonical.countries[0].writers[0].works[1].label);
    expect(exported.definitions[0].nodes[2].entity).not.toBe(exported.definitions[1].nodes[2].entity);
    for (const item of [rows, rows[0], rows[0].copy, rows[0].copy.ru, snapshots, snapshots[0], snapshots[0].work, snapshots[0].work.label, exported.definitions[0].nodes[2].entity]) expect(Object.isFrozen(item)).toBe(true);
    const reopened = parseBookyJourneyDraft(JSON.stringify(exported), canonical); expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error("additional work reopen failed");
    expect(reopened.input.additionalWorks).toEqual(rows); expect(reopened.input.additionalWorks).not.toBe(rows);
    expect(reopened.draft.authoringSource.selection.additionalWorks![0].work.label).not.toBe(snapshots[0].work.label);
    value.additionalWorks![0].copy.ru.body = "Изменённая подсказка."; canonical.countries[0].writers[0].works[1].label.en = "Changed canonical label";
    expect(rows[0].copy.ru.body).toBe("Просмотрите дополнительную книгу 1."); expect(snapshots[0].work.label.en).toBe("Additional work 1");
    expect(Object.isFrozen(value.additionalWorks)).toBe(false); expect(draft(value, canonical).authoringSourceChecksum).not.toBe(exported.authoringSourceChecksum);
    expect(parseBookyJourneyDraft(JSON.stringify(exported), canonical).ok).toBe(false);
  });

  it("rejects malformed imported rows and independently repaired source snapshot dialogue entity and sequence tampering through full regeneration", () => {
    const value = additionalWorkValue(variantValue()), canonical = additionalWorkCatalog(value), exported = draft(value, canonical), serialized = JSON.stringify(exported);
    for (const rows of [[], [{ workId: "extra-work-1" }], [{ ...value.additionalWorks![0], extra: true }], [{ ...value.additionalWorks![0], workId: "other-work" }]]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); Object.assign(changed.authoringSource.input, { additionalWorks: rows });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), canonical).ok).toBe(false);
    }
    for (const change of [
      (changed: Mutable<BookyJourneyDraft>) => { changed.authoringSource.input.additionalWorks![0].copy.ru.caption = "Changed source variant"; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => { changed.authoringSource.selection.additionalWorks![0].work.label.en = "Forged canonical label"; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => { changed.definitions[0].nodes[2].entity = { kind: "work", countryId: value.countryId, writerId: value.writerId, workId: value.workId }; changed.definitionsChecksums[0].checksum = getBookyJourneyChecksum(changed.definitions[0])!; },
      (changed: Mutable<BookyJourneyDraft>) => { const nodes = changed.definitions[0].nodes; [nodes[2], nodes[4]] = [nodes[4], nodes[2]]; changed.definitionsChecksums[0].checksum = getBookyJourneyChecksum(changed.definitions[0])!; },
      (changed: Mutable<BookyJourneyDraft>) => { const record = changed.dialogues.find(item => item.payload.id === "test-route.work-extra-1" && item.payload.locale === "en")!; record.payload.copy.reduced = "Forged derived variant"; record.review.contentChecksum = getBookyDialogueContentChecksum(record.payload)!; record.checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review })!; },
    ]) { const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); change(changed); expect(parseBookyJourneyDraft(JSON.stringify(changed), canonical).ok).toBe(false); }
    const removed = structuredClone(canonical); removed.countries[0].writers[0].works = removed.countries[0].writers[0].works.filter(item => item.id !== "extra-work-1");
    const failed = parseBookyJourneyDraft(serialized, removed); expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.errors.map(item => item.field)).toContain("additionalWorks.0.workId");
  });

  it("omits both optional source and selection keys and restores existing verified native download goldens after removing every additional row", () => {
    for (const fixture of historicalOrderlessDownloads) {
      const value = additionalWorkValue(structuredClone(fixture.input)), canonical = additionalWorkCatalog(value, fixture.catalog), configured = draft(value, canonical);
      expect(contentTextHash(JSON.stringify(configured, null, 2) + "\n")).not.toBe(fixture.sha256);
      delete value.additionalWorks; const restored = draft(value, canonical);
      expect(contentTextHash(JSON.stringify(restored, null, 2) + "\n")).toBe(fixture.sha256);
      expect(Object.hasOwn(restored.authoringSource.input, "additionalWorks")).toBe(false); expect(Object.hasOwn(restored.authoringSource.selection, "additionalWorks")).toBe(false);
      expect(restored.authoringSource).toEqual(draft(fixture.input, fixture.catalog).authoringSource);
      expect(restored.journeyApprovals).toEqual([]); expect(restored.availability).toEqual([]);
    }
  });
});

describe("adult Booky journey draft fact subjects", () => {
  it("keeps omitted subjects byte-identical to existing downloads and restores omission after an explicit country writer or main-work subject", () => {
    for (const fixture of historicalOrderlessDownloads) {
      const value = structuredClone(fixture.input);
      expect(contentTextHash(JSON.stringify(draft(value, fixture.catalog), null, 2) + "\n")).toBe(fixture.sha256);
      if (!value.fact) continue;
      const ordinary = draft(value, fixture.catalog);
      expect(Object.hasOwn(ordinary.authoringSource.input.fact!, "subject")).toBe(false);
      for (const subject of ["country", "writer", "work"] as const) {
        value.fact.subject = subject;
        const configured = draft(value, fixture.catalog);
        expect(configured.authoringSource.input.fact?.subject).toBe(subject);
        expect(configured.authoringSource.input.fact?.copy).toEqual(ordinary.authoringSource.input.fact?.copy);
        expect(configured.authoringSourceChecksum).not.toBe(ordinary.authoringSourceChecksum);
        if (subject === "work") {
          expect(configured.definitions[0].nodes.find(node => node.kind === "sourced-fact")?.entity).toEqual(ordinary.definitions[0].nodes.find(node => node.kind === "sourced-fact")?.entity);
          expect(factRecord(configured, "ru").payload.context).toBe(factRecord(ordinary, "ru").payload.context);
        }
        delete value.fact.subject;
        expect(contentTextHash(JSON.stringify(draft(value, fixture.catalog), null, 2) + "\n")).toBe(fixture.sha256);
      }
    }
  });

  it("binds independent RU EN factual contexts to the selected country writer or final main work without changing extra order activity or checkpoint targets", () => {
    for (const subject of ["country", "writer", "work"] as const) for (const optionalNodeOrder of [["sourced-fact", "activity"], ["activity", "sourced-fact"]] as const) {
      const value = additionalWorkValue(variantValue()), canonical = additionalWorkCatalog(value);
      value.fact!.subject = subject; value.optionalNodeOrder = optionalNodeOrder;
      value.fact!.copy.ru.caption = "Явная подпись\nо выбранном объекте"; value.fact!.copy.en.reduced = "Explicit subject note";
      const defaultValue = structuredClone(value); delete defaultValue.fact!.subject;
      const ordinary = draft(defaultValue, canonical), exported = draft(value, canonical);
      const entity = subject === "country" ? { kind: "country" as const, countryId: value.countryId }
        : subject === "writer" ? { kind: "writer" as const, countryId: value.countryId, writerId: value.writerId }
        : { kind: "work" as const, countryId: value.countryId, writerId: value.writerId, workId: value.workId };
      const screen = subject === "work" ? "collection" : "globe";
      for (const definition of exported.definitions) {
        expect(definition.nodes.map(node => node.id)).toEqual(["country", "writer", "work-extra-1", "work-extra-2", "work", ...optionalNodeOrder, "checkpoint"]);
        const node = definition.nodes.find(item => item.kind === "sourced-fact")!, record = factRecord(exported, definition.locale);
        expect(node.entity).toEqual(entity); expect(node.screen).toBe(screen); expect(node.fact?.id).toBe(`test-route.${subject}-fact`);
        expect(parseBookyJourneyFact(node.fact)).toEqual(node.fact); expect(getBookyJourneyFactChecksum(node.fact, entity, screen)).toBeTruthy();
        expect(record.payload.context).toBe(`fact:${contentRecordHash({ journeyId: value.id, nodeId: "sourced-fact", factId: `test-route.${subject}-fact`, factVersion: value.version, entity, screen })}`);
        expect(record.payload.context).toBe(bookyJourneyDialogueContext(value.id, node));
        expect(record.payload.entityIds).toEqual([bookyJourneyEntityId(entity)]); expect(record.payload.screens).toEqual([screen]);
        expect(record.payload.copy).toEqual(factRecord(ordinary, definition.locale).payload.copy);
        expect(record.payload.factualSources).toEqual(value.fact!.copy[definition.locale].sources);
        expect(record.payload.provenance.copySha256).toBe(factRecord(ordinary, definition.locale).payload.provenance.copySha256);
        expect(record.payload.provenance.sourceSha256).toBe(exported.authoringSourceChecksum);
        expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
        for (const binding of node.fact!.dialogues) expect(binding.contentChecksum).toBe(factRecord(exported, binding.locale).review.contentChecksum);
        expect(getBookyJourneyChecksum(definition)).toBe(exported.definitionsChecksums.find(binding => binding.locale === definition.locale)?.checksum);
        expect(definition.nodes.find(item => item.kind === "activity")?.activity?.targetWork).toEqual({ kind: "work", countryId: value.countryId, writerId: value.writerId, workId: value.workId });
        expect(definition.nodes.at(-1)?.entity).toBeNull();
      }
      for (const old of ordinary.dialogues) {
        const next = exported.dialogues.find(record => record.payload.id === old.payload.id && record.payload.locale === old.payload.locale)!;
        expect(next.payload.copy).toEqual(old.payload.copy); expect(next.payload.provenance.copySha256).toBe(old.payload.provenance.copySha256);
        expect(next.payload.provenance.sourceSha256).not.toBe(old.payload.provenance.sourceSha256);
        expect(next.review.contentChecksum).not.toBe(old.review.contentChecksum); expect(next.checksum).not.toBe(old.checksum);
      }
      const registry = createBookyDialogueRegistry(exported.dialogues, { canonicalEntityIds: [...new Set(exported.dialogues.flatMap(record => record.payload.entityIds))], approvedReviews: [] });
      expect(registry.size).toBe(16); expect(registry.rejections).toEqual([]);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), canonical).ok).toBe(true);
    }
  });

  it("rejects every non-enum subject and non-data hidden inherited or extra fact property without invoking subject getters or coercion", () => {
    let getterCalls = 0, coercions = 0;
    for (const subject of [undefined, null, "", " work", "WORK", "activity", "extra-work-1", 0, true, [], { toString() { coercions++; return "work"; } }]) {
      const value = factValue(); Object.assign(value.fact!, { subject }); expect(errors(value)).toContain("fact");
    }
    for (const change of [
      (fact: object) => { Object.defineProperty(fact, "subject", { enumerable: true, get() { getterCalls++; throw new Error("subject getter must not execute"); } }); },
      (fact: object) => { Object.defineProperty(fact, "subject", { value: "country", enumerable: false }); },
      (fact: object) => { Object.setPrototypeOf(fact, { subject: "country" }); },
      (fact: object) => { Object.assign(fact, { subject: "country", additionalWorkId: "extra-work-1" }); },
      (fact: object) => { Object.assign(fact, { subject: "writer" }); Object.defineProperty(fact, Symbol("extra"), { value: true }); },
    ]) { const value = factValue(); change(value.fact!); expect(errors(value)).toContain("fact"); }
    const plain = factValue(); Object.assign(plain, { fact: Object.assign(Object.create(null), plain.fact, { subject: "country" }) });
    expect(draft(plain).authoringSource.input.fact?.subject).toBe("country");
    expect(getterCalls).toBe(0); expect(coercions).toBe(0);
  });

  it("snapshots subjects without caller mutation and independently clones frozen fact bindings entities copy and sources in both locales and reopened inputs", () => {
    const value = factValue(), canonical = catalog(); value.fact!.subject = "writer";
    const before = JSON.stringify({ value, canonical }), exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    const ru = exported.definitions[0].nodes[3], en = exported.definitions[1].nodes[3];
    expect(ru.entity).not.toBe(en.entity); expect(ru.fact).not.toBe(en.fact); expect(ru.fact!.dialogues).not.toBe(en.fact!.dialogues);
    expect(ru.fact!.dialogues[0]).not.toBe(en.fact!.dialogues[0]);
    expect(exported.authoringSource.input.fact).not.toBe(value.fact);
    expect(exported.authoringSource.input.fact!.copy.ru.sources[0]).not.toBe(value.fact!.copy.ru.sources[0]);
    for (const item of [exported.authoringSource.input.fact, ru.entity, en.entity, ru.fact, en.fact, ru.fact!.dialogues, en.fact!.dialogues[0]]) expect(Object.isFrozen(item)).toBe(true);
    const reopened = parseBookyJourneyDraft(JSON.stringify(exported), canonical); expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error("fact subject reopen failed");
    expect(reopened.input.fact?.subject).toBe("writer"); expect(reopened.input.fact).not.toBe(exported.authoringSource.input.fact);
    value.fact!.subject = "country"; value.fact!.copy.ru.sources[0].url = "https://example.org/changed"; canonical.countries[0].writers[0].label.en = "Changed writer";
    expect(exported.authoringSource.input.fact?.subject).toBe("writer"); expect(reopened.input.fact?.subject).toBe("writer");
    expect(factRecord(exported, "ru").payload.factualSources[0].url).toBe("https://example.org/ru/work");
    expect(exported.authoringSource.selection.writer.label.en).toBe("Test writer"); expect(Object.isFrozen(value.fact)).toBe(false);
    expect(parseBookyJourneyDraft(JSON.stringify(exported), canonical).ok).toBe(false);
  });

  it("rejects malformed imports and independently rehashed source subject entity screen context and bilingual fact-table tampering through full regeneration", () => {
    const value = additionalWorkValue(variantValue()), canonical = additionalWorkCatalog(value); value.fact!.subject = "country";
    const serialized = JSON.stringify(draft(value, canonical));
    for (const subject of [null, "", "work-extra-1", "checkpoint", 4, {}]) {
      const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); Object.assign(changed.authoringSource.input.fact!, { subject });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), canonical).ok).toBe(false);
    }
    for (const change of [
      (changed: Mutable<BookyJourneyDraft>) => { changed.authoringSource.input.fact!.subject = "writer"; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => { delete changed.authoringSource.input.fact!.subject; changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource); },
      (changed: Mutable<BookyJourneyDraft>) => { const node = changed.definitions[0].nodes.find(item => item.kind === "sourced-fact")!; node.entity = { kind: "work", countryId: value.countryId, writerId: value.writerId, workId: "extra-work-1" }; node.screen = "collection"; changed.definitionsChecksums[0].checksum = getBookyJourneyChecksum(changed.definitions[0])!; },
      (changed: Mutable<BookyJourneyDraft>) => { const node = changed.definitions[0].nodes.find(item => item.kind === "sourced-fact")!; node.fact!.dialogues.reverse(); changed.definitionsChecksums[0].checksum = getBookyJourneyChecksum(changed.definitions[0])!; },
      (changed: Mutable<BookyJourneyDraft>) => { const record = changed.dialogues.find(item => item.payload.intent === "sourced-fact" && item.payload.locale === "ru")!; record.payload.entityIds = [bookyJourneyEntityId({ kind: "writer", countryId: value.countryId, writerId: value.writerId })]; record.payload.context = factRecord(draft({ ...value, fact: { ...value.fact!, subject: "writer" } }, canonical), "ru").payload.context; record.review.contentChecksum = getBookyDialogueContentChecksum(record.payload)!; record.checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review })!; },
    ]) { const changed: Mutable<BookyJourneyDraft> = JSON.parse(serialized); change(changed); expect(parseBookyJourneyDraft(JSON.stringify(changed), canonical).ok).toBe(false); }
    expect(parseBookyJourneyDraft(serialized, canonical).ok).toBe(true);
    expect(draft(value, canonical).journeyApprovals).toEqual([]); expect(draft(value, canonical).availability).toEqual([]);
  });
});

function unfinishedWorkspaceInput(): JourneyDraftInput {
  const value = additionalWorkValue(variantValue());
  value.id = " unfinished / route "; value.version = -1.5; value.ageRange = { min: 0, max: -3.25 }; value.estimatedDurationMinutes = 0.5;
  value.countryId = " missing country "; value.writerId = "missing-writer"; value.workId = "";
  value.copy.ru.title = ""; value.copy.en.title = "unfinished\nsingle-line\ttitle"; value.copy.en.description = " not yet finished ";
  value.copy.ru.nodes.work.caption = ""; value.fact!.subject = "writer";
  value.fact!.copy.ru.body = ""; value.fact!.copy.ru.sources = [{ id: "", url: " not a URL ", accessedAt: "not-a-date" }];
  value.fact!.copy.en.sources = []; value.activity!.choices = [{ countryId: "", writerId: "not-a-canonical-author" }];
  value.prerequisites = [{ id: value.id, version: -4.5 }, { id: value.id, version: 0 }];
  value.optionalNodeOrder = ["activity", "activity"];
  value.additionalWorks![0].workId = "unknown additional work"; value.additionalWorks![1].workId = value.additionalWorks![0].workId;
  value.additionalWorks![0].copy.en.reduced = "";
  return value;
}
function workspace(value: unknown = unfinishedWorkspaceInput()) {
  const result = createBookyJourneyWorkspace(value);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.workspace;
}

describe("adult Booky journey unfinished local workspace", () => {
  it("preserves unfinished strings finite semantic-invalid numbers optional own keys and row order in independent frozen snapshots without touching callers", () => {
    const value = unfinishedWorkspaceInput(), before = JSON.stringify(value), saved = workspace(value);
    expect(Object.keys(saved)).toEqual(["kind", "schemaVersion", "input"]); expect(saved.kind).toBe("booky-journey-workspace"); expect(saved.schemaVersion).toBe(1);
    expect(saved.input).toEqual(value); expect(JSON.stringify(value)).toBe(before); expect(saved.input).not.toBe(value);
    for (const [snapshot, original] of [[saved.input.fact, value.fact], [saved.input.fact!.copy.ru.sources, value.fact!.copy.ru.sources],
      [saved.input.additionalWorks![0].copy.en, value.additionalWorks![0].copy.en], [saved.input.prerequisites, value.prerequisites],
      [saved.input.optionalNodeOrder, value.optionalNodeOrder]] as const) { expect(snapshot).not.toBe(original); expect(Object.isFrozen(snapshot)).toBe(true); }
    expect(saved.input.fact!.copy.ru.sources[0].url).toBe(" not a URL "); expect(saved.input.copy.ru.nodes.work.caption).toBe("");
    expect(saved.input.copy.en.title).toBe("unfinished\nsingle-line\ttitle");
    expect(Object.hasOwn(saved.input.additionalWorks![0].copy.en, "reduced")).toBe(true); expect(Object.hasOwn(saved.input.additionalWorks![1].copy.en, "reduced")).toBe(false);
    const reopened = parseBookyJourneyWorkspace(JSON.stringify(saved)); expect(reopened.ok).toBe(true);
    if (!reopened.ok) throw new Error("unfinished workspace reopen failed");
    expect(reopened.workspace.input).toEqual(value); expect(reopened.workspace.input).not.toBe(saved.input);
    expect(reopened.workspace.input.fact!.copy.en.sources).toEqual([]); expect(Object.isFrozen(reopened.workspace.input.additionalWorks![1])).toBe(true);
    value.fact!.copy.ru.sources[0].url = "changed"; value.additionalWorks![0].copy.en.reduced = "changed"; (value.prerequisites![0] as { version: number }).version = 12;
    expect(saved.input.fact!.copy.ru.sources[0].url).toBe(" not a URL "); expect(reopened.workspace.input.additionalWorks![0].copy.en.reduced).toBe("");
    expect(reopened.workspace.input.prerequisites![0].version).toBe(-4.5); expect(Object.isFrozen(value)).toBe(false);
  });

  it("keeps workspace and compiled formats separate while later compilation rejects incomplete semantics and unchanged completed inputs retain existing native download goldens", () => {
    const saved = workspace(); expect(createBookyJourneyDraft(saved.input, catalog()).ok).toBe(false);
    expect(parseBookyJourneyDraft(JSON.stringify(saved), catalog()).ok).toBe(false);
    expect(parseBookyJourneyWorkspace(JSON.stringify(draft())).ok).toBe(false);
    expect(createBookyJourneyWorkspace(draft()).ok).toBe(false);
    for (const fixture of historicalOrderlessDownloads) {
      const reopened = parseBookyJourneyWorkspace(JSON.stringify(workspace(fixture.input))); expect(reopened.ok).toBe(true);
      if (!reopened.ok) throw new Error("complete workspace reopen failed");
      const compiled = draft(reopened.workspace.input, fixture.catalog);
      expect(contentTextHash(JSON.stringify(compiled, null, 2) + "\n")).toBe(fixture.sha256);
      expect(compiled.authoringSource).toEqual(draft(fixture.input, fixture.catalog).authoringSource);
      expect(compiled.journeyApprovals).toEqual([]); expect(compiled.availability).toEqual([]);
    }
    const valid = variantValue(), wrongRefs = structuredClone(valid); wrongRefs.activity!.choices = [{ countryId: "foreign", writerId: "unknown" }];
    expect(workspace(wrongRefs).input.activity!.choices).toEqual(wrongRefs.activity!.choices);
    expect(createBookyJourneyDraft(workspace(wrongRefs).input, catalog()).ok).toBe(false);
  });

  it("accepts dense zero-to-cap unfinished arrays but rejects overflow holes exotic prototypes accessors and hidden extras without invoking getters", () => {
    let getterCalls = 0;
    const value = unfinishedWorkspaceInput();
    const arrays = [
      { cap: 16, row: value.prerequisites![0], replace: (target: JourneyDraftInput, rows: unknown) => Object.assign(target, { prerequisites: rows }) },
      { cap: 8, row: value.additionalWorks![0], replace: (target: JourneyDraftInput, rows: unknown) => Object.assign(target, { additionalWorks: rows }) },
      { cap: 4, row: value.activity!.choices[0], replace: (target: JourneyDraftInput, rows: unknown) => Object.assign(target.activity!, { choices: rows }) },
      { cap: 16, row: value.fact!.copy.ru.sources[0], replace: (target: JourneyDraftInput, rows: unknown) => Object.assign(target.fact!.copy.ru, { sources: rows }) },
      { cap: 2, row: "activity", replace: (target: JourneyDraftInput, rows: unknown) => Object.assign(target, { optionalNodeOrder: rows }) },
    ];
    for (const config of arrays) {
      for (const length of [0, config.cap]) {
        const target = unfinishedWorkspaceInput(), rows = Array.from({ length }, () => structuredClone(config.row)); config.replace(target, rows);
        expect(workspace(target).input).toEqual(target);
      }
      const malformed: unknown[] = [null, {}, Array(1), Array.from({ length: config.cap + 1 }, () => structuredClone(config.row))];
      for (const change of [
        (rows: unknown[]) => { Object.defineProperty(rows, "0", { enumerable: true, get() { getterCalls++; throw new Error("workspace row getter"); } }); },
        (rows: unknown[]) => { Object.defineProperty(rows, "0", { value: structuredClone(config.row), enumerable: false }); },
        (rows: unknown[]) => { Object.setPrototypeOf(rows, null); },
        (rows: unknown[]) => { Object.defineProperty(rows, "hidden", { value: true }); },
        (rows: unknown[]) => { Object.assign(rows, { extra: true }); },
        (rows: unknown[]) => { Object.defineProperty(rows, Symbol("extra"), { value: true }); },
      ]) { const rows: unknown[] = [structuredClone(config.row)]; change(rows); malformed.push(rows); }
      for (const rows of malformed) { const target = unfinishedWorkspaceInput(); config.replace(target, rows); expect(createBookyJourneyWorkspace(target).ok).toBe(false); }
    }
    const targets = [
      (target: JourneyDraftInput) => target, (target: JourneyDraftInput) => target.ageRange,
      (target: JourneyDraftInput) => target.copy.en, (target: JourneyDraftInput) => target.copy.ru.nodes.work,
      (target: JourneyDraftInput) => target.fact!, (target: JourneyDraftInput) => target.fact!.copy.ru.sources[0],
      (target: JourneyDraftInput) => target.activity!.choices[0], (target: JourneyDraftInput) => target.prerequisites![0],
      (target: JourneyDraftInput) => target.additionalWorks![0].copy.en,
    ];
    for (const getTarget of targets) for (const change of [
      (record: object) => { Object.assign(record, { extra: true }); }, (record: object) => { Object.defineProperty(record, "hidden", { value: true }); },
      (record: object) => { Object.setPrototypeOf(record, { inherited: true }); },
      (record: object) => { const key = Object.keys(record)[0]; Object.defineProperty(record, key, { enumerable: true, get() { getterCalls++; throw new Error("workspace value getter"); } }); },
    ]) { const target = unfinishedWorkspaceInput(); change(getTarget(target)); expect(createBookyJourneyWorkspace(target).ok).toBe(false); }
    const plain = Object.assign(Object.create(null), unfinishedWorkspaceInput()); expect(workspace(plain).input).toEqual(plain);
    expect(getterCalls).toBe(0);
  });

  it("enforces only supported types enums maximum string lengths and finite numeric values while leaving domain integer syntax and catalog checks to the compiler", () => {
    const fields = [
      { max: 48, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value, { id: text }) },
      { max: 200, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value, { countryId: text }) },
      { max: 200, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value.copy.ru, { title: text }) },
      { max: 800, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value.copy.en, { description: text }) },
      { max: 96, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value.prerequisites![0], { id: text }) },
      { max: 1000, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value.fact!.copy.ru.sources[0], { url: text }) },
      { max: 24, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value.fact!.copy.ru.sources[0], { accessedAt: text }) },
      { max: 96, set: (value: JourneyDraftInput, text: unknown) => Object.assign(value.fact!.copy.ru.sources[0], { id: text }) },
    ];
    for (const field of fields) {
      for (const text of ["", " leading and trailing ", "x".repeat(field.max)]) { const value = unfinishedWorkspaceInput(); field.set(value, text); expect(workspace(value).input).toEqual(value); }
      for (const text of [undefined, null, 4, false, {}, "x".repeat(field.max + 1)]) { const value = unfinishedWorkspaceInput(); field.set(value, text); expect(createBookyJourneyWorkspace(value).ok).toBe(false); }
    }
    for (const kind of ["country", "writer", "work", "checkpoint", "activity", "sourced-fact", "additional"] as const) for (const [field, max] of [["title", 160], ["body", 1600], ["caption", 1600], ["reduced", 320]] as const) {
      const value = unfinishedWorkspaceInput(), copy = kind === "additional" ? value.additionalWorks![0].copy.ru : kind === "activity" ? value.activity!.copy.ru
        : kind === "sourced-fact" ? value.fact!.copy.ru : value.copy.ru.nodes[kind];
      copy[field] = "x".repeat(max); expect(createBookyJourneyWorkspace(value).ok).toBe(true);
      copy[field] = "x".repeat(max + 1); expect(createBookyJourneyWorkspace(value).ok).toBe(false);
    }
    for (const set of [
      (value: JourneyDraftInput, number: unknown) => Object.assign(value, { version: number }),
      (value: JourneyDraftInput, number: unknown) => Object.assign(value.ageRange, { min: number }),
      (value: JourneyDraftInput, number: unknown) => Object.assign(value.ageRange, { max: number }),
      (value: JourneyDraftInput, number: unknown) => Object.assign(value, { estimatedDurationMinutes: number }),
      (value: JourneyDraftInput, number: unknown) => Object.assign(value.prerequisites![0], { version: number }),
    ]) {
      for (const number of [-9.25, 0, 1.5, Number.MAX_VALUE]) { const value = unfinishedWorkspaceInput(); set(value, number); expect(workspace(value).input).toEqual(value); }
      for (const number of [NaN, Infinity, -Infinity, undefined, null, "3", true]) { const value = unfinishedWorkspaceInput(); set(value, number); expect(createBookyJourneyWorkspace(value).ok).toBe(false); }
    }
    for (const change of [
      (value: JourneyDraftInput) => Object.assign(value, { readingLevel: "" }),
      (value: JourneyDraftInput) => Object.assign(value.activity!, { type: "other" }),
      (value: JourneyDraftInput) => Object.assign(value.fact!, { subject: "additional-work" }),
      (value: JourneyDraftInput) => Object.assign(value, { optionalNodeOrder: ["checkpoint"] }),
      (value: JourneyDraftInput) => Object.assign(value.additionalWorks![0].copy.ru, { reduced: undefined }),
    ]) { const value = unfinishedWorkspaceInput(); change(value); expect(createBookyJourneyWorkspace(value).ok).toBe(false); }
  });

  it("rejects wrong discriminators versions missing fields extra authority and nested shapes before any workspace can replace form data", () => {
    const saved = workspace(), serialized = JSON.stringify(saved);
    for (const malformed of [null, [], {}, { ...saved, kind: "other" }, { ...saved, schemaVersion: 2 }, { kind: saved.kind, schemaVersion: 1 },
      { ...saved, definitions: [] }, { ...saved, approved: true }, { ...saved, answers: [] }, { ...saved, input: { ...saved.input, profile: {} } }]) {
      expect(parseBookyJourneyWorkspace(JSON.stringify(malformed)).ok).toBe(false);
    }
    for (const path of ["copy.ru", "copy.ru.nodes", "activity.copy", "fact.copy", "additionalWorks.0", "prerequisites.0", "fact.copy.ru.sources.0"]) {
      const malformed = JSON.parse(serialized); let row = malformed.input;
      for (const part of path.split(".")) row = row[part];
      row.unexpected = true; expect(parseBookyJourneyWorkspace(JSON.stringify(malformed)).ok).toBe(false);
    }
    for (const raw of ["", "{", JSON.stringify({ ...saved, input: null }), serialized.replace('"schemaVersion":1', '"schemaVersion":"1"')]) expect(parseBookyJourneyWorkspace(raw).ok).toBe(false);
    expect(parseBookyJourneyWorkspace(serialized).ok).toBe(true);
  });

  it("bounds actual UTF8 file bytes before parsing and formatted output after snapshot creation without relying on JavaScript string length", () => {
    const saved = workspace(input()), serialized = JSON.stringify(saved), size = new TextEncoder().encode(serialized).byteLength;
    const exactLimit = serialized + " ".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES - size);
    expect(parseBookyJourneyWorkspace(exactLimit).ok).toBe(true); expect(parseBookyJourneyWorkspace(exactLimit + " ").ok).toBe(false);
    const multiByte = "界".repeat(175000); expect(multiByte.length).toBeLessThan(BOOKY_JOURNEY_DRAFT_MAX_BYTES);
    const oversized = parseBookyJourneyWorkspace(multiByte); expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.errors[0].message).toContain("512");
    const value = additionalWorkValue(variantValue(), 8);
    for (const { copy } of variantCopies(value)) { copy.body = "\u0000".repeat(1600); copy.caption = "\u0000".repeat(1600); }
    for (const row of value.additionalWorks!) for (const locale of ["ru", "en"] as const) { row.copy[locale].body = "\u0000".repeat(1600); row.copy[locale].caption = "\u0000".repeat(1600); }
    for (const locale of ["ru", "en"] as const) value.fact!.copy[locale].sources = Array.from({ length: 16 }, () => ({ id: "", url: "\u0000".repeat(1000), accessedAt: "" }));
    expect(new TextEncoder().encode(JSON.stringify({ kind: "booky-journey-workspace", schemaVersion: 1, input: value }, null, 2) + "\n").byteLength).toBeGreaterThan(BOOKY_JOURNEY_DRAFT_MAX_BYTES);
    const result = createBookyJourneyWorkspace(value); expect(result.ok).toBe(false); if (!result.ok) expect(result.errors[0].message).toContain("512");
    expect(Object.isFrozen(value)).toBe(false);
  });
});
