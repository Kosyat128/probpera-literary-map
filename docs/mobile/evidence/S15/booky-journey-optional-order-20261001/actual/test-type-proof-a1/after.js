import { describe, expect, it } from "vitest";
import {
  bookyJourneyDialogueContext,
  bookyJourneyEntityId,
  compileBookyJourney,
  getBookyJourneyChecksum
} from "../../../src/host/bookyJourney";
import {
  createBookyDialogueRegistry,
  getBookyDialogueChecksum,
  getBookyDialogueContentChecksum
} from "../../../src/host/bookyDialogueRegistry";
import { getBookyJourneyActivityChecksum } from "../../../src/host/bookyJourneyActivity";
import { getBookyJourneyFactChecksum, parseBookyJourneyFact } from "../../../src/host/bookyJourneyFact";
import { contentRecordHash, contentTextHash } from "../../../src/planet/contentExportHash";
import {
  BOOKY_JOURNEY_DRAFT_MAX_BYTES,
  createBookyJourneyDraft,
  parseBookyJourneyDraft,
  evaluateBookyJourneyDraftPreviewProfile
} from "./booky-journey-draft";
function catalog() {
  return { countries: [{ id: "test-country", label: { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430", en: "Test country" }, writers: [
    { id: "test-writer", label: { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Test writer" }, works: [
      { id: "test-work", label: { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043A\u043D\u0438\u0433\u0430", en: "Test work" } }
    ] },
    { id: "other-writer", label: { ru: "\u0414\u0440\u0443\u0433\u043E\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Other writer" }, works: [
      { id: "other-work", label: { ru: "\u0414\u0440\u0443\u0433\u0430\u044F \u043A\u043D\u0438\u0433\u0430", en: "Other work" } }
    ] }
  ] }] };
}
function input() {
  return {
    id: "test-route",
    version: 2,
    countryId: "test-country",
    writerId: "test-writer",
    workId: "test-work",
    ageRange: { min: 18, max: 120 },
    readingLevel: "plain",
    estimatedDurationMinutes: 15,
    copy: {
      ru: { title: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442", description: "\u041F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u043E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0443, \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044F \u0438 \u043A\u043D\u0438\u0433\u0443.", nodes: {
        country: { title: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u0442\u0440\u0430\u043D\u0443", body: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0443 \u043D\u0430 \u0433\u043B\u043E\u0431\u0443\u0441\u0435." },
        writer: { title: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044F", body: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044F." },
        work: { title: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043A\u043D\u0438\u0433\u0443", body: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u043A\u043D\u0438\u0433\u0443 \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438." },
        checkpoint: { title: "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0435 \u043C\u0430\u0440\u0448\u0440\u0443\u0442", body: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u0448\u0430\u0433\u043E\u0432." }
      } },
      en: { title: "Test route", description: "Open the country, writer and work in order.", nodes: {
        country: { title: "Open the country", body: "Select the indicated country on the globe." },
        writer: { title: "Open the writer", body: "Select the indicated writer." },
        work: { title: "Open the work", body: "Open the selected work in the collection." },
        checkpoint: { title: "Finish the route", body: "Confirm completion of the steps." }
      } }
    }
  };
}
function draft(value = input(), canonical = catalog()) {
  const result = createBookyJourneyDraft(value, canonical);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.draft;
}
function errors(value, canonical = catalog()) {
  const result = createBookyJourneyDraft(value, canonical);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors.map((error) => error.field);
}
describe("adult Booky journey draft authoring", () => {
  it("binds both locales and all eight dialogues to the real schemas, canonical chain and embedded source", () => {
    const exported = draft();
    expect(exported.authoringSourceChecksum).toBe(contentRecordHash(exported.authoringSource));
    expect(exported.definitions.map((definition) => [definition.id, definition.version, definition.locale])).toEqual([
      ["test-route", 2, "ru"],
      ["test-route", 2, "en"]
    ]);
    expect(exported.dialogues).toHaveLength(8);
    expect(exported.blockingReviewIssues).toEqual([]);
    for (const definition of exported.definitions) {
      expect(exported.definitionsChecksums.find((item) => item.locale === definition.locale)?.checksum).toBe(getBookyJourneyChecksum(definition));
      expect(definition.nodes.map((node) => [node.kind, node.screen, node.entity])).toEqual([
        ["country", "globe", { kind: "country", countryId: "test-country" }],
        ["writer", "globe", { kind: "writer", countryId: "test-country", writerId: "test-writer" }],
        ["work", "collection", { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" }],
        ["checkpoint", "collection", null]
      ]);
      for (const node of definition.nodes) {
        const record = exported.dialogues.find((record2) => record2.payload.id === node.dialogue.id && record2.payload.locale === definition.locale);
        expect(record.review).toEqual({ status: "draft", reviewer: null, reviewedAt: null, contentChecksum: node.dialogue.contentChecksum });
        expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
        expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
        expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
        expect(record.payload.entityIds).toEqual(node.entity ? [bookyJourneyEntityId(node.entity)] : []);
        expect(record.payload.provenance).toEqual({
          kind: "editorial",
          sourcePath: "authoringSource",
          sourceVersion: 1,
          sourceRef: `/input/copy/${definition.locale}/nodes/${node.kind}`,
          sourceSha256: exported.authoringSourceChecksum,
          copySha256: contentTextHash(JSON.stringify({ title: record.payload.copy.title, body: record.payload.copy.body }))
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
    value.copy.ru.nodes.work.body = "\u0414\u0440\u0443\u0433\u043E\u0439 \u044F\u0432\u043D\u043E \u0432\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442.";
    canonical.countries[0].label.ru = "\u0418\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u0430\u044F \u043C\u0435\u0442\u043A\u0430";
    expect(exported.authoringSource.input.copy.ru.nodes.work.body).toBe("\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u043A\u043D\u0438\u0433\u0443 \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438.");
    expect(exported.authoringSource.selection.country.label.ru).toBe("\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430");
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
    scoped.countries[0].writers[1].works = [{ id: "test-work", label: { ru: "\u0414\u0440\u0443\u0433\u0430\u044F \u043A\u043D\u0438\u0433\u0430", en: "Other work" } }];
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
    expect(exported.blockingReviewIssues.map((issue) => [issue.field, issue.code])).toEqual([
      ["countryId", "canonical-english-label-missing"],
      ["writerId", "canonical-english-label-missing"]
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
    expect([exported.status, exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved]).toEqual(["draft", false, false, false, false]);
    for (const list of [exported.dialogueApprovals, exported.journeyApprovals, exported.currentVersions, exported.availability]) expect(list).toEqual([]);
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: exported.definitions[0].nodes.flatMap((node) => node.entity ? [bookyJourneyEntityId(node.entity)] : []),
      approvedReviews: exported.dialogueApprovals
    });
    expect(registry.size).toBe(8);
    expect(registry.rejections).toEqual([]);
    for (const record of exported.dialogues) expect(registry.resolve({
      id: record.payload.id,
      locale: record.payload.locale,
      audience: "adult",
      age: 30,
      readingLevel: "plain",
      intent: record.payload.intent,
      screen: record.payload.screens[0],
      context: record.payload.context,
      entityIds: record.payload.entityIds,
      now: "2026-09-30T12:00:00.000Z"
    })).toBeNull();
    for (const definition of exported.definitions) expect(compileBookyJourney(definition, {
      audience: "adult",
      age: 30,
      locale: definition.locale,
      readingLevel: "plain",
      now: "2026-09-30T12:00:00.000Z",
      connectivity: "online",
      completedPrerequisites: [],
      availability: exported.availability
    }, {
      currentVersions: exported.currentVersions,
      approvedReviews: exported.journeyApprovals,
      dialogueRegistry: registry,
      publicCountries: [],
      publicBooks: []
    })).toBeNull();
  });
});
function activityValue() {
  return { ...input(), activity: {
    type: "match-work-author",
    choices: [
      { countryId: "test-country", writerId: "other-writer" },
      { countryId: "test-country", writerId: "test-writer" }
    ],
    copy: {
      ru: { title: "\u0421\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043A\u043D\u0438\u0433\u0443 \u0438 \u0430\u0432\u0442\u043E\u0440\u0430", body: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0432\u0442\u043E\u0440\u0430 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0439 \u043A\u043D\u0438\u0433\u0438 \u0438\u0437 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432." },
      en: { title: "Match the work and author", body: "Choose the author of the indicated work from the available choices." }
    }
  } };
}
describe("adult Booky journey draft activity authoring", () => {
  it("preserves the exact D223 downloaded no-activity bytes and original source/definition checksums", () => {
    const legacy = {
      id: "synthetic-journey",
      version: 2,
      countryId: "country-a",
      writerId: "writer-a",
      workId: "work-a",
      ageRange: { min: 18, max: 65 },
      readingLevel: "plain",
      estimatedDurationMinutes: 8,
      copy: {
        ru: { title: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043C\u0430\u0440\u0448\u0440\u0443\u0442 \u043E\u0431\u043D\u043E\u0432\u043B\u0451\u043D", description: "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430.", nodes: {
          country: { title: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0441\u043E \u0441\u0442\u0440\u0430\u043D\u044B", body: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0443 \u043D\u0430 \u0433\u043B\u043E\u0431\u0443\u0441\u0435." },
          writer: { title: "\u041F\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043A \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044E", body: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044F." },
          work: { title: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043A\u043D\u0438\u0433\u0443", body: "\u041F\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u043D\u0438\u0433\u0435 \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438." },
          checkpoint: { title: "\u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0442\u043E\u0433", body: "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u0430." }
        } },
        en: { title: "Synthetic journey", description: "A draft for testing the editor.", nodes: {
          country: { title: "Start with the country", body: "Open the selected country on the globe." },
          writer: { title: "Go to the writer", body: "Open the selected writer." },
          work: { title: "Open the book", body: "Go to the selected book in the collection." },
          checkpoint: { title: "Finish the journey", body: "Mark this journey as complete." }
        } }
      }
    };
    const canonical = { countries: [{ id: "country-a", label: { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430 \u0410", en: "Synthetic country A" }, writers: [
      { id: "writer-a", label: { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C \u0410", en: "Synthetic writer A" }, works: [
        { id: "work-a", label: { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043A\u043D\u0438\u0433\u0430 \u0410", en: "Synthetic work A" } }
      ] }
    ] }] };
    const exported = draft(legacy, canonical);
    expect(contentTextHash(JSON.stringify(exported, null, 2) + "\n")).toBe("7523ea0a6972991c6ff999b3d1f61a812c12179781b15b45022ccf1a3ee8c6d5");
    expect(exported.authoringSourceChecksum).toBe("07f1ac8a8337e8c3bcb712e43c46458494993f1758b29d998159a40b34373cee");
    expect(exported.definitionsChecksums).toEqual([
      { locale: "ru", checksum: "4ab845a9c3c153386a5252abac394a3d2cd46fe3d8fbf5ef0bba34a77b57a72d" },
      { locale: "en", checksum: "50ad521328a4d43c08afa68bc022a93c15d1ea29557cc1a28fc0bae55e189ac3" }
    ]);
    expect(Object.prototype.hasOwnProperty.call(exported.authoringSource.input, "activity")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(exported.authoringSource.selection, "activityChoices")).toBe(false);
    expect(exported.definitions.every((definition) => definition.nodes.every((node) => !Object.prototype.hasOwnProperty.call(node, "activity")))).toBe(true);
    expect(parseBookyJourneyDraft(JSON.stringify(exported), canonical).ok).toBe(true);
  });
  it("binds five nodes and ten RU/EN dialogues to canonical activity checksums, exact source copy and original choice labels", () => {
    const value = activityValue(), canonical = catalog(), before = JSON.stringify({ value, canonical });
    const exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    expect(exported.dialogues).toHaveLength(10);
    expect(exported.authoringSourceChecksum).toBe(contentRecordHash(exported.authoringSource));
    expect(exported.authoringSource.input.activity).toEqual(value.activity);
    expect(exported.authoringSource.selection.activityChoices?.map((choice) => [choice.country.id, choice.writer.id, choice.writer.label])).toEqual([
      ["test-country", "other-writer", { ru: "\u0414\u0440\u0443\u0433\u043E\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Other writer" }],
      ["test-country", "test-writer", { ru: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Test writer" }]
    ]);
    for (const definition of exported.definitions) {
      expect(definition.nodes.map((node2) => node2.kind)).toEqual(["country", "writer", "work", "activity", "checkpoint"]);
      expect(exported.definitionsChecksums.find((item) => item.locale === definition.locale)?.checksum).toBe(getBookyJourneyChecksum(definition));
      const node = definition.nodes[3], spec = node.activity;
      expect([node.id, node.kind, node.entity, node.screen]).toEqual(["activity", "activity", null, "globe"]);
      expect(spec).toEqual({
        schemaVersion: 1,
        id: "test-route.match-author",
        version: 2,
        type: "match-work-author",
        targetWork: { kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" },
        choices: [
          { id: "choice-1", writer: { kind: "writer", countryId: "test-country", writerId: "other-writer" } },
          { id: "choice-2", writer: { kind: "writer", countryId: "test-country", writerId: "test-writer" } }
        ]
      });
      const activityChecksum = getBookyJourneyActivityChecksum(spec);
      expect(activityChecksum).not.toBeNull();
      const record = exported.dialogues.find((record2) => record2.payload.locale === definition.locale && record2.payload.id === node.dialogue.id);
      const authored = value.activity.copy[definition.locale];
      expect(record.payload.intent).toBe("activity");
      expect(record.payload.context).toBe(`activity:${contentRecordHash({ journeyId: "test-route", nodeId: "activity", activityChecksum })}`);
      expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
      expect(record.payload.entityIds).toEqual([...new Set([spec.targetWork, ...spec.choices.map((choice) => choice.writer)].map(bookyJourneyEntityId))]);
      expect(record.payload.copy).toEqual({ title: authored.title, body: authored.body, caption: authored.title, reduced: authored.title });
      expect(record.payload.provenance).toEqual({
        kind: "editorial",
        sourcePath: "authoringSource",
        sourceVersion: 1,
        sourceRef: `/input/activity/copy/${definition.locale}`,
        sourceSha256: exported.authoringSourceChecksum,
        copySha256: contentTextHash(JSON.stringify(authored))
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
    value.activity.copy.ru.body = "\u0418\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0444\u043E\u0440\u043C\u044B.";
    canonical.countries[0].writers[1].label.en = "Changed canonical name";
    expect(exported.authoringSource.input.activity.copy.ru.body).toBe("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0430\u0432\u0442\u043E\u0440\u0430 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0439 \u043A\u043D\u0438\u0433\u0438 \u0438\u0437 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432.");
    expect(exported.authoringSource.selection.activityChoices?.[0].writer.label.en).toBe("Other writer");
    expect(Object.isFrozen(exported.authoringSource.input.activity.choices)).toBe(true);
  });
  it("accepts two to four scoped canonical writers without requiring the routing owner to be an answer choice", () => {
    const canonical = catalog();
    canonical.countries[0].writers = [
      ...canonical.countries[0].writers,
      { id: "third-writer", label: { ru: "\u0422\u0440\u0435\u0442\u0438\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Third writer" }, works: [] }
    ];
    canonical.countries = [
      ...canonical.countries,
      { id: "another-country", label: { ru: "\u0415\u0449\u0451 \u043E\u0434\u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0430", en: "Another country" }, writers: [
        { id: "other-writer", label: { ru: "\u0427\u0435\u0442\u0432\u0451\u0440\u0442\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Fourth writer" }, works: [] },
        { id: "fifth-writer", label: { ru: "\u041F\u044F\u0442\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C", en: "Fifth writer" }, works: [] }
      ] }
    ];
    const choices = [
      { countryId: "test-country", writerId: "other-writer" },
      { countryId: "test-country", writerId: "third-writer" },
      { countryId: "another-country", writerId: "other-writer" },
      { countryId: "another-country", writerId: "fifth-writer" }
    ];
    for (const length of [2, 3, 4]) {
      const value = activityValue();
      value.activity.choices = choices.slice(0, length);
      const exported = draft(value, canonical), spec = exported.definitions[0].nodes[3].activity;
      expect(spec.choices.map((choice) => choice.id)).toEqual(Array.from({ length }, (_, index) => `choice-${index + 1}`));
      expect(spec.choices.some((choice) => choice.writer.writerId === "test-writer")).toBe(false);
      expect(spec.targetWork).toEqual({ kind: "work", countryId: "test-country", writerId: "test-writer", workId: "test-work" });
    }
  });
  it("rejects repeated writer tuples, missing canonical writers and absent or normalization-ambiguous original RU/EN names", () => {
    const duplicate = activityValue();
    duplicate.activity.choices = [duplicate.activity.choices[0], duplicate.activity.choices[0]];
    expect(errors(duplicate)).toContain("activity.choices.1");
    for (const missing of [{ countryId: "missing-country", writerId: "other-writer" }, { countryId: "test-country", writerId: "missing-writer" }]) {
      const value = activityValue();
      value.activity.choices = [missing, value.activity.choices[1]];
      expect(errors(value)).toContain("activity.choices.0");
    }
    for (const locale of ["ru", "en"]) {
      for (const name of ["", " ", "a".repeat(201)]) {
        const canonical2 = catalog();
        canonical2.countries[0].writers[1].label[locale] = name;
        expect(errors(activityValue(), canonical2)).toContain(`activity.choices.0.label.${locale}`);
      }
      const canonical = catalog();
      canonical.countries[0].writers[0].label[locale] = locale === "ru" ? "\u0410\u0412\u0422\u041E\u0420  \u0422\u0415\u0421\u0422" : "AUTHOR  TEST";
      canonical.countries[0].writers[1].label[locale] = locale === "ru" ? "\u0430\u0432\u0442\u043E\u0440 \u0442\u0435\u0441\u0442" : "\uFF41\uFF55\uFF54\uFF48\uFF4F\uFF52 test";
      expect(errors(activityValue(), canonical)).toContain(`activity.choices.1.label.${locale}`);
    }
  });
  it("rejects null, missing or extra activity data, sparse choices, accessors and incomplete authored RU/EN copy", () => {
    const malformed = [
      null,
      void 0,
      {},
      [],
      { ...activityValue().activity, type: "unknown" },
      { ...activityValue().activity, correctChoiceId: "choice-1" },
      { ...activityValue().activity, choices: [] },
      { ...activityValue().activity, choices: [{ countryId: "test-country", writerId: "test-writer" }] },
      { ...activityValue().activity, choices: Array(2) },
      { ...activityValue().activity, choices: Array.from({ length: 5 }, () => ({ countryId: "test-country", writerId: "test-writer" })) },
      { ...activityValue().activity, choices: [{ countryId: "test-country", writerId: "other-writer", label: "Added name" }, { countryId: "test-country", writerId: "test-writer" }] }
    ];
    for (const change of [
      (activity) => {
        Object.assign(activity.choices, { extra: true });
      },
      (activity) => {
        Object.assign(activity.copy, { fr: activity.copy.en });
      },
      (activity) => {
        Object.assign(activity.copy.en, { extra: true });
      },
      (activity) => {
        activity.copy.ru.title = "";
      },
      (activity) => {
        activity.copy.en.body = "";
      },
      (activity) => {
        Object.defineProperty(activity, "type", { get: () => "match-work-author", enumerable: true });
      },
      (activity) => {
        Object.defineProperty(activity, /* @__PURE__ */ Symbol("extra"), { value: true });
      },
      (activity) => {
        Object.defineProperty(activity.choices[0], "writerId", { get: () => "other-writer", enumerable: true });
      }
    ]) {
      const activity = activityValue().activity;
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
    for (const locale of ["ru", "en"]) {
      const canonical = catalog();
      canonical.countries[0].writers[1].label[locale] += " changed";
      expect(importErrors(serialized, canonical)).toContain("file");
    }
    const missing = catalog();
    missing.countries[0].writers = missing.countries[0].writers.slice(0, 1);
    expect(importErrors(serialized, missing)).toContain("activity.choices.0");
    const changes = [
      (value) => {
        value.authoringSource.input.activity.copy.en.body = "Changed activity body";
      },
      (value) => {
        Object.assign(value.authoringSource.input.activity, { correctChoiceId: "choice-1" });
      },
      (value) => {
        value.authoringSource.selection.activityChoices[0].writer.label.en = "Changed imported name";
      },
      (value) => {
        value.definitions[0].nodes[3].activity.targetWork.workId = "other-work";
      },
      (value) => {
        value.definitions[0].nodes[3].activity.choices[0].writer.writerId = "missing-writer";
      },
      (value) => {
        value.dialogues[3].payload.copy.body = "\u041F\u043E\u0434\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0437\u0430\u0434\u0430\u043D\u0438\u044F.";
      },
      (value) => {
        value.dialogues[3].payload.entityIds = [];
      },
      (value) => {
        Reflect.deleteProperty(value.authoringSource.input, "activity");
      },
      (value) => {
        Object.assign(value, { humanReviewed: true, releaseReady: true });
      }
    ];
    for (const change of changes) {
      const value = JSON.parse(serialized);
      change(value);
      importErrors(JSON.stringify(value));
    }
  });
});
function modifiedExport(change) {
  const value = JSON.parse(JSON.stringify(draft()));
  change(value);
  return JSON.stringify(value);
}
function importErrors(serialized, canonical = catalog()) {
  const result = parseBookyJourneyDraft(serialized, canonical);
  expect(result.ok).toBe(false);
  if (result.ok) return [];
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.every((error) => /[А-Яа-яЁё]/u.test(error.message))).toBe(true);
  expect(Object.isFrozen(result.errors)).toBe(true);
  return result.errors.map((error) => error.field);
}
describe("adult Booky journey draft reopening", () => {
  it("round trips all RU/EN authored copy and ignores object key order while returning fresh frozen compiled snapshots", () => {
    const exported = draft();
    const reverseKeys = (value) => {
      if (Array.isArray(value)) return value.map(reverseKeys);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)]));
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
      expect([
        result.draft.status,
        result.draft.releaseReady,
        result.draft.humanReviewed,
        result.draft.childApproved,
        result.draft.narrationApproved
      ]).toEqual(["draft", false, false, false, false]);
      for (const list of [
        result.draft.journeyApprovals,
        result.draft.dialogueApprovals,
        result.draft.currentVersions,
        result.draft.availability
      ]) expect(list).toEqual([]);
    }
    expect(JSON.stringify(canonical)).toBe(before);
  });
  it("rejects stale selected canonical labels and removed countries, writers or works using the current scoped catalog", () => {
    const serialized = JSON.stringify(draft());
    for (const entity of ["country", "writer", "work"]) {
      for (const locale of ["ru", "en"]) {
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
    noWriter.countries[0].writers = noWriter.countries[0].writers.filter((writer) => writer.id !== "test-writer");
    expect(importErrors(serialized, noWriter)).toContain("writerId");
    const noWork = catalog();
    noWork.countries[0].writers[0].works = [];
    expect(importErrors(serialized, noWork)).toContain("workId");
  });
  it("rejects altered authored and derived copy, validly rehashed dialogue tampering, checksums and canonical references", () => {
    const changes = [
      (value) => {
        value.authoringSource.input.copy.ru.nodes.work.body = "\u0418\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u0430\u044F \u0438\u0441\u0445\u043E\u0434\u043D\u0430\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430.";
      },
      (value) => {
        value.authoringSource.input.copy.en.nodes.writer.title = "Changed writer title";
        value.authoringSourceChecksum = contentRecordHash(value.authoringSource);
      },
      (value) => {
        const record = value.dialogues[0];
        record.payload.copy.body = "\u0418\u0437\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0441 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u044C\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u043E\u0439.";
        record.payload.provenance.copySha256 = contentTextHash(JSON.stringify({ title: record.payload.copy.title, body: record.payload.copy.body }));
        const contentChecksum = getBookyDialogueContentChecksum(record.payload);
        expect(contentChecksum).not.toBeNull();
        record.review.contentChecksum = contentChecksum;
        const checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review });
        expect(checksum).not.toBeNull();
        record.checksum = checksum;
      },
      (value) => {
        value.authoringSourceChecksum = "0".repeat(64);
      },
      (value) => {
        value.definitionsChecksums[0].checksum = "0".repeat(64);
      },
      (value) => {
        value.dialogues[0].checksum = "0".repeat(64);
      },
      (value) => {
        value.definitions[0].title = "\u041F\u043E\u0434\u043C\u0435\u043D\u0451\u043D\u043D\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u0430";
      },
      (value) => {
        value.definitions[0].nodes[0].entity = { kind: "country", countryId: "other-country" };
      },
      (value) => {
        value.dialogues[0].payload.entityIds = ["other-country"];
      },
      (value) => {
        value.dialogues[0].payload.provenance.sourceRef = "/input/copy/en/nodes/work";
      },
      (value) => {
        value.authoringSource.selection.work.label.en = "Changed imported canonical title";
      }
    ];
    for (const change of changes) expect(importErrors(modifiedExport(change))).toContain("file");
  });
  it("rejects imported authority, unknown or missing fields and every extra nested input key including special names", () => {
    const changes = [
      (value) => {
        Object.assign(value, { releaseReady: true });
      },
      (value) => {
        Object.assign(value, { humanReviewed: true });
      },
      (value) => {
        Object.assign(value, { childApproved: true });
      },
      (value) => {
        Object.assign(value, { narrationApproved: true });
      },
      (value) => {
        Object.assign(value, { journeyApprovals: [{ reviewer: "imported" }] });
      },
      (value) => {
        Object.assign(value, { dialogueApprovals: [{ reviewer: "imported" }] });
      },
      (value) => {
        Object.assign(value, { currentVersions: [{ version: 2 }] });
      },
      (value) => {
        Object.assign(value, { availability: [{ available: true }] });
      },
      (value) => {
        Object.assign(value.dialogues[0].review, { status: "approved", reviewer: "imported", reviewedAt: "2026-09-30T12:00:00.000Z" });
      },
      (value) => {
        Object.assign(value, { extra: "unrecognized" });
      },
      (value) => {
        Reflect.deleteProperty(value, "dialogues");
      },
      (value) => {
        Object.assign(value.authoringSource, { extra: "unrecognized" });
      },
      (value) => {
        Object.assign(value.authoringSource.input, { extra: "unrecognized" });
      },
      (value) => {
        Object.assign(value.authoringSource.input.ageRange, { extra: "unrecognized" });
      },
      (value) => {
        Object.assign(value.authoringSource.input.copy, { fr: value.authoringSource.input.copy.en });
      },
      (value) => {
        Object.assign(value.authoringSource.input.copy.ru, { extra: "unrecognized" });
      },
      (value) => {
        Object.assign(value.authoringSource.input.copy.en.nodes, { extra: { title: "Extra", body: "Extra" } });
      },
      (value) => {
        Object.assign(value.authoringSource.input.copy.ru.nodes.country, { extra: "unrecognized" });
      },
      (value) => {
        Reflect.deleteProperty(value.authoringSource.input.copy.en.nodes.work, "body");
      },
      (value) => {
        Object.defineProperty(value.authoringSource.input.copy.en.nodes.checkpoint, "__proto__", { value: { approved: true }, enumerable: true });
      },
      (value) => {
        Object.assign(value.authoringSource.input.copy.en.nodes.writer, { constructor: "unrecognized" });
      }
    ];
    for (const change of changes) importErrors(modifiedExport(change));
  });
  it("rejects malformed roots, unsupported draft versions/statuses, invalid input values and byte-bounded UTF-8 oversize text", () => {
    for (const serialized of [
      "",
      "{",
      "null",
      "[]",
      "42",
      '"draft"',
      JSON.stringify({ schemaVersion: 2, status: "draft" }),
      JSON.stringify({ schemaVersion: 1, status: "approved" }),
      " ".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES + 1)
    ]) expect(importErrors(serialized)).toContain("file");
    const oversizedUtf8 = JSON.stringify({ text: "\u044F".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES / 2) });
    expect(oversizedUtf8.length).toBeLessThan(BOOKY_JOURNEY_DRAFT_MAX_BYTES);
    expect(new TextEncoder().encode(oversizedUtf8).byteLength).toBeGreaterThan(BOOKY_JOURNEY_DRAFT_MAX_BYTES);
    expect(importErrors(oversizedUtf8)).toContain("file");
    expect(importErrors(modifiedExport((value) => {
      value.authoringSource.input.ageRange.min = 17;
    }))).toContain("ageRange");
    expect(importErrors(modifiedExport((value) => {
      value.authoringSource.input.copy.en.nodes.work.body = "";
    }))).toContain("copy.en.nodes.work.body");
    const invalidCatalog = { countries: null };
    expect(importErrors(JSON.stringify(draft()), invalidCatalog)).toContain("catalog");
    const failedCatalog = { get countries() {
      throw new Error("Catalog unavailable");
    } };
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
    expect([result.draft.releaseReady, result.draft.humanReviewed, result.draft.childApproved, result.draft.narrationApproved]).toEqual([false, false, false, false]);
  });
});
function factValue() {
  return { ...input(), fact: { copy: {
    ru: { title: "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u0444\u0430\u043A\u0442", body: "\u042F\u0432\u043D\u043E \u0432\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0439 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0441\u043A\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u0445\u0435\u043C\u044B.\n\u0412\u0442\u043E\u0440\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430.", sources: [
      { id: "source-ru", url: "https://example.org/ru/work", accessedAt: "2026-09-29T10:00:00.000Z" }
    ] },
    en: { title: "Synthetic fact", body: "Explicit editorial text for checking the schema.", sources: [
      { id: "source-en", url: "https://example.org/en/work", accessedAt: "2026-09-28T11:30:00.000Z" }
    ] }
  } } };
}
function factRecord(exported, locale) {
  return exported.dialogues.find((record) => record.payload.intent === "sourced-fact" && record.payload.locale === locale);
}
describe("adult Booky journey draft sourced-fact authoring", () => {
  it("binds ten draft dialogues and the same ordered bilingual fact table to the selected work using the real schemas", () => {
    const value = factValue(), exported = draft(value);
    expect(exported.dialogues).toHaveLength(10);
    const expectedBindings = ["ru", "en"].map((locale) => ({
      locale,
      id: "test-route.sourced-fact",
      version: 2,
      contentChecksum: factRecord(exported, locale).review.contentChecksum
    }));
    for (const definition of exported.definitions) {
      expect(definition.nodes.map((node2) => node2.kind)).toEqual(["country", "writer", "work", "sourced-fact", "checkpoint"]);
      const node = definition.nodes[3], record = factRecord(exported, definition.locale), authored = value.fact.copy[definition.locale];
      expect([node.id, node.kind, node.screen]).toEqual(["sourced-fact", "sourced-fact", "collection"]);
      expect(node.entity).toEqual(definition.nodes[2].entity);
      expect(node.fact).toEqual({ schemaVersion: 1, id: "test-route.work-fact", version: 2, dialogues: expectedBindings });
      expect(parseBookyJourneyFact(node.fact)).toEqual(node.fact);
      expect(getBookyJourneyFactChecksum(node.fact, node.entity, node.screen)).not.toBeNull();
      expect(getBookyJourneyChecksum(definition)).toBe(exported.definitionsChecksums.find((item) => item.locale === definition.locale).checksum);
      expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
      expect(record.payload.context).toBe(`fact:${contentRecordHash({
        journeyId: "test-route",
        nodeId: "sourced-fact",
        factId: "test-route.work-fact",
        factVersion: 2,
        entity: node.entity,
        screen: "collection"
      })}`);
      expect(record.payload.entityIds).toEqual([bookyJourneyEntityId(node.entity)]);
      expect(record.payload.copy).toEqual({ title: authored.title, body: authored.body, caption: authored.title, reduced: authored.title });
      expect(record.payload.factualSources).toEqual(authored.sources);
      expect(record.payload.claimKind).toBe("factual");
      expect(record.payload.provenance).toEqual({
        kind: "editorial",
        sourcePath: "authoringSource",
        sourceVersion: 1,
        sourceRef: `/input/fact/copy/${definition.locale}`,
        sourceSha256: exported.authoringSourceChecksum,
        copySha256: contentTextHash(JSON.stringify({ title: authored.title, body: authored.body }))
      });
      expect(getBookyDialogueContentChecksum(record.payload)).toBe(node.dialogue.contentChecksum);
      expect(getBookyDialogueChecksum({ payload: record.payload, review: record.review })).toBe(record.checksum);
      expect(record.review).toEqual({ status: "draft", reviewer: null, reviewedAt: null, contentChecksum: node.dialogue.contentChecksum });
      expect(record.payload.narration).toBeNull();
      expect(record.payload.prohibitedTags).toEqual([]);
      expect(node.fact.dialogues.every((binding) => binding.contentChecksum !== "0".repeat(64))).toBe(true);
    }
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: [...new Set(exported.definitions[0].nodes.flatMap((node) => node.entity ? [bookyJourneyEntityId(node.entity)] : []))],
      approvedReviews: []
    });
    expect(registry.size).toBe(10);
    expect(registry.rejections).toEqual([]);
    for (const record of exported.dialogues) expect(registry.resolve({
      id: record.payload.id,
      locale: record.payload.locale,
      audience: "adult",
      age: 30,
      readingLevel: "plain",
      intent: record.payload.intent,
      screen: record.payload.screens[0],
      context: record.payload.context,
      entityIds: record.payload.entityIds,
      now: "2026-09-30T12:00:00.000Z"
    })).toBeNull();
    for (const definition of exported.definitions) expect(compileBookyJourney(definition, {
      audience: "adult",
      age: 30,
      locale: definition.locale,
      readingLevel: "plain",
      now: "2026-09-30T12:00:00.000Z",
      connectivity: "online",
      completedPrerequisites: [],
      availability: []
    }, { currentVersions: [], approvedReviews: [], dialogueRegistry: registry, publicCountries: [], publicBooks: [] })).toBeNull();
    expect([exported.releaseReady, exported.humanReviewed, exported.childApproved, exported.narrationApproved]).toEqual([false, false, false, false]);
    for (const entries of [exported.journeyApprovals, exported.dialogueApprovals, exported.currentVersions, exported.availability]) expect(entries).toEqual([]);
  });
  it("keeps locale copy and citations independent while rebinding both factual payloads to changed shared authoring bytes", () => {
    const original = draft(factValue()), changedInput = factValue();
    changedInput.fact.copy.ru.body = "\u0414\u0440\u0443\u0433\u043E\u0439 \u044F\u0432\u043D\u043E \u0432\u0432\u0435\u0434\u0451\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442.";
    changedInput.fact.copy.ru.sources = [{ id: "replacement-ru", url: "https://example.org/ru/changed", accessedAt: "2026-09-29T12:00:00.000Z" }];
    const changed = draft(changedInput);
    expect(factRecord(changed, "en").payload.copy).toEqual(factRecord(original, "en").payload.copy);
    expect(factRecord(changed, "en").payload.factualSources).toEqual(factRecord(original, "en").payload.factualSources);
    expect(factRecord(changed, "en").payload.provenance.copySha256).toBe(factRecord(original, "en").payload.provenance.copySha256);
    expect(factRecord(changed, "ru").payload.provenance.copySha256).not.toBe(factRecord(original, "ru").payload.provenance.copySha256);
    for (const locale of ["ru", "en"]) {
      const record = factRecord(changed, locale);
      expect(record.review.contentChecksum).not.toBe(factRecord(original, locale).review.contentChecksum);
      expect(record.payload.provenance.sourceSha256).toBe(changed.authoringSourceChecksum);
      expect(changed.definitions.every((definition) => definition.nodes[3].fact.dialogues.find((binding) => binding.locale === locale).contentChecksum === getBookyDialogueContentChecksum(record.payload))).toBe(true);
    }
    expect(changed.definitions[0].nodes[3].fact).toEqual(changed.definitions[1].nodes[3].fact);
    expect(getBookyJourneyFactChecksum(changed.definitions[0].nodes[3].fact, changed.definitions[0].nodes[3].entity, "collection")).not.toBe(getBookyJourneyFactChecksum(original.definitions[0].nodes[3].fact, original.definitions[0].nodes[3].entity, "collection"));
  });
  it("copies and freezes every factual source without retaining or mutating caller data", () => {
    const value = factValue(), canonical = catalog(), before = JSON.stringify({ value, canonical });
    const exported = draft(value, canonical);
    expect(JSON.stringify({ value, canonical })).toBe(before);
    expect(draft(value, canonical)).toEqual(exported);
    value.fact.copy.ru.sources[0].url = "https://example.org/changed";
    value.fact.copy.en.title = "Changed caller title";
    canonical.countries[0].writers[0].works[0].label.en = "Changed canonical work";
    expect(exported.authoringSource.input.fact.copy.ru.sources[0].url).toBe("https://example.org/ru/work");
    expect(factRecord(exported, "ru").payload.factualSources[0].url).toBe("https://example.org/ru/work");
    expect(exported.authoringSource.input.fact.copy.en.title).toBe("Synthetic fact");
    expect(exported.authoringSource.selection.work.label.en).toBe("Test work");
    expect(Object.isFrozen(exported.authoringSource.input.fact.copy.ru.sources)).toBe(true);
    expect(Object.isFrozen(factRecord(exported, "en").payload.factualSources[0])).toBe(true);
    expect(Object.isFrozen(exported.definitions[0].nodes[3].fact.dialogues)).toBe(true);
    expect(Object.isFrozen(value.fact)).toBe(false);
  });
  it("accepts one to sixteen explicit sources and registry text limits but rejects invalid IDs, URLs, timestamps and bounds", () => {
    for (const length of [1, 16]) {
      const value = factValue();
      for (const locale of ["ru", "en"]) {
        value.fact.copy[locale].title = "a".repeat(160);
        value.fact.copy[locale].body = "b".repeat(1600);
        value.fact.copy[locale].sources = Array.from({ length }, (_, index) => ({
          id: `source-${index}`,
          url: `https://example.org/${locale}/${index}`,
          accessedAt: "2024-02-29T12:00:00.000Z"
        }));
      }
      const exported = draft(value);
      expect(factRecord(exported, "ru").payload.factualSources).toHaveLength(length);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    }
    const invalidSources = [
      { id: "" },
      { id: "Uppercase" },
      { id: "a".repeat(97) },
      { id: "with space" },
      { url: "http://example.org/work" },
      { url: "file:///work" },
      { url: "not a URL" },
      { url: "https://user:secret@example.org/work" },
      { url: "https://user@example.org/work" },
      { url: "https://" },
      { url: "https://example.org/" + "a".repeat(1e3) },
      { url: " https://example.org/work" },
      { accessedAt: "2026-02-30T12:00:00.000Z" },
      { accessedAt: "2026-09-29T10:00:00Z" },
      { accessedAt: "2026-09-29T10:00:00.000+00:00" },
      { accessedAt: "2026-09-29" },
      { accessedAt: "" }
    ];
    for (const changedSource of invalidSources) {
      const value = factValue();
      Object.assign(value.fact.copy.en.sources[0], changedSource);
      expect(errors(value)).toContain("fact");
    }
    for (const change of [
      (value) => {
        value.fact.copy.en.title = "a".repeat(161);
      },
      (value) => {
        value.fact.copy.ru.body = "b".repeat(1601);
      },
      (value) => {
        value.fact.copy.ru.title = "";
      },
      (value) => {
        value.fact.copy.en.body = " ";
      },
      (value) => {
        value.fact.copy.ru.body = "Unsupported\vcontrol";
      },
      (value) => {
        value.fact.copy.en.sources = [];
      },
      (value) => {
        value.fact.copy.en.sources = Array.from({ length: 17 }, (_, index) => ({ id: `source-${index}`, url: "https://example.org/work", accessedAt: "2026-09-29T10:00:00.000Z" }));
      },
      (value) => {
        value.fact.copy.ru.sources = [value.fact.copy.ru.sources[0], { ...value.fact.copy.ru.sources[0] }];
      }
    ]) {
      const value = factValue();
      change(value);
      expect(errors(value)).toContain("fact");
    }
    const future = factValue();
    future.fact.copy.en.sources[0].accessedAt = "2099-01-01T00:00:00.000Z";
    expect(draft(future).humanReviewed).toBe(false);
  });
  it("rejects unknown fields, sparse arrays, exotic prototypes and accessors without invoking getters", () => {
    const malformed = [
      null,
      void 0,
      {},
      [],
      { ...factValue().fact, verified: true },
      { copy: { ru: factValue().fact.copy.ru } },
      { copy: { ...factValue().fact.copy, fr: factValue().fact.copy.en } }
    ];
    let getterCalls = 0;
    const getter = () => {
      getterCalls++;
      throw new Error("getter must not execute");
    };
    const changes = [
      (value) => {
        Object.assign(value.copy.ru, { approved: true });
      },
      (value) => {
        Object.assign(value.copy.en.sources[0], { verified: true });
      },
      (value) => {
        value.copy.ru.sources = Array(1);
      },
      (value) => {
        Object.assign(value.copy.en.sources, { extra: true });
      },
      (value) => {
        Object.defineProperty(value.copy.en.sources, /* @__PURE__ */ Symbol("extra"), { value: true });
      },
      (value) => {
        Object.defineProperty(value, "copy", { get: getter, enumerable: true });
      },
      (value) => {
        Object.defineProperty(value.copy, "ru", { get: getter, enumerable: true });
      },
      (value) => {
        Object.defineProperty(value.copy.en, "sources", { get: getter, enumerable: true });
      },
      (value) => {
        Object.defineProperty(value.copy.ru.sources, "0", { get: getter, enumerable: true });
      },
      (value) => {
        Object.defineProperty(value.copy.en.sources[0], "url", { get: getter, enumerable: true });
      },
      (value) => {
        Object.defineProperty(value.copy.ru.sources[0], "accessedAt", { get: getter, enumerable: true });
      },
      (value) => {
        Object.defineProperty(value.copy.en.sources[0], "hidden", { value: true });
      },
      (value) => {
        Object.setPrototypeOf(value.copy.ru.sources[0], { approved: true });
      }
    ];
    for (const change of changes) {
      const value = factValue().fact;
      change(value);
      malformed.push(value);
    }
    for (const fact of malformed) {
      const value = input();
      Object.assign(value, { fact });
      expect(errors(value)).toContain("fact");
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
    const changes = [
      (value) => {
        value.authoringSource.input.fact.copy.ru.sources[0].url = "https://example.org/changed";
      },
      (value) => {
        value.authoringSource.input.fact.copy.en.body = "Changed input fact";
        value.authoringSourceChecksum = contentRecordHash(value.authoringSource);
      },
      (value) => {
        value.definitions[0].nodes[3].fact.dialogues.reverse();
      },
      (value) => {
        value.definitions[1].nodes[3].fact.dialogues[0].contentChecksum = "0".repeat(64);
      },
      (value) => {
        value.definitions[0].nodes[3].entity = { kind: "work", countryId: "test-country", writerId: "other-writer", workId: "other-work" };
      },
      (value) => {
        const record = value.dialogues.find((record2) => record2.payload.intent === "sourced-fact" && record2.payload.locale === "en");
        record.payload.factualSources[0].url = "https://example.org/changed";
        const contentChecksum = getBookyDialogueContentChecksum(record.payload);
        expect(contentChecksum).not.toBeNull();
        record.review.contentChecksum = contentChecksum;
        record.checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review });
        value.definitions[1].nodes[3].dialogue.contentChecksum = contentChecksum;
        for (const definition of value.definitions) definition.nodes[3].fact.dialogues[1].contentChecksum = contentChecksum;
        value.definitionsChecksums = value.definitions.map((definition) => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition) }));
      },
      (value) => {
        value.dialogues.find((record) => record.payload.intent === "sourced-fact").payload.provenance.sourceRef = "/input/fact/copy/en";
      },
      (value) => {
        Object.assign(value, { humanReviewed: true, releaseReady: true });
      }
    ];
    for (const change of changes) {
      const value = JSON.parse(serialized);
      change(value);
      expect(importErrors(JSON.stringify(value))).toContain("file");
    }
    for (const invalidFact of [null, {}, { copy: { ru: factValue().fact.copy.ru } }, { ...factValue().fact, sourceVerified: true }]) {
      const value = JSON.parse(serialized);
      Object.assign(value.authoringSource.input, { fact: invalidFact });
      expect(importErrors(JSON.stringify(value))).toContain("fact");
    }
  });
  it("rejects fact drafts against stale or removed current canonical anchors and preserves missing country/writer EN issues", () => {
    const serialized = JSON.stringify(draft(factValue()));
    for (const entity of ["country", "writer", "work"]) {
      for (const locale of ["ru", "en"]) {
        const canonical = catalog(), country = canonical.countries[0], writer = country.writers[0];
        (entity === "country" ? country : entity === "writer" ? writer : writer.works[0]).label[locale] += " changed";
        expect(importErrors(serialized, canonical)).toContain("file");
      }
    }
    const removedWork = catalog();
    removedWork.countries[0].writers[0].works = [];
    expect(importErrors(serialized, removedWork)).toContain("workId");
    expect(errors({ ...factValue(), workId: "other-work" })).toContain("workId");
    const missingEnglish = catalog();
    missingEnglish.countries[0].label.en = "";
    missingEnglish.countries[0].writers[0].label.en = "";
    const exported = draft(factValue(), missingEnglish);
    expect(exported.blockingReviewIssues.map((issue) => issue.field)).toEqual(["countryId", "writerId"]);
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
      expect(definition.nodes.map((node) => node.kind)).toEqual(["country", "writer", "work", "sourced-fact", "activity", "checkpoint"]);
      const originalActivity = activityOnly.definitions.find((item) => item.locale === definition.locale).nodes[3];
      const activity = definition.nodes[4];
      expect(activity.activity).toEqual(originalActivity.activity);
      expect(getBookyJourneyActivityChecksum(activity.activity)).toBe(getBookyJourneyActivityChecksum(originalActivity.activity));
      expect(bookyJourneyDialogueContext(definition.id, activity)).toBe(bookyJourneyDialogueContext(definition.id, originalActivity));
      expect(definition.nodes.filter((node) => ["country", "writer", "work", "checkpoint"].includes(node.kind)).map((node) => [node.id, node.entity, node.screen])).toEqual(activityOnly.definitions[0].nodes.filter((node) => node.kind !== "activity").map((node) => [node.id, node.entity, node.screen]));
      expect(getBookyJourneyChecksum(definition)).not.toBeNull();
    }
    expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(activityOnly.authoringSource.input, "fact")).toBe(false);
    expect(activityOnly.definitions.every((definition) => definition.nodes.every((node) => !Object.prototype.hasOwnProperty.call(node, "fact")))).toBe(true);
  });
});
function variantValue() {
  const value = activityValue();
  value.fact = factValue().fact;
  return value;
}
function variantCopies(value) {
  return ["ru", "en"].flatMap((locale) => [
    ...["country", "writer", "work", "checkpoint"].map((kind) => ({ locale, kind, copy: value.copy[locale].nodes[kind] })),
    { locale, kind: "activity", copy: value.activity.copy[locale] },
    { locale, kind: "sourced-fact", copy: value.fact.copy[locale] }
  ]);
}
function variantRecord(exported, locale, kind) {
  return exported.dialogues.find((record) => record.payload.locale === locale && record.payload.id === `test-route.${kind}`);
}
describe("adult Booky journey draft optional copy variants", () => {
  it("binds explicit RU/EN variants on every navigation, factual and activity node to the existing registry schemas", () => {
    const value = variantValue();
    for (const { locale, kind, copy } of variantCopies(value)) {
      copy.caption = `${locale} ${kind} caption
Second line.`;
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
      canonicalEntityIds: [...new Set(exported.dialogues.flatMap((record) => record.payload.entityIds))],
      approvedReviews: []
    });
    expect(registry.size).toBe(12);
    expect(registry.rejections).toEqual([]);
    expect(exported.definitionsChecksums).toEqual(exported.definitions.map((definition) => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition) })));
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
      expect(Object.keys(copy)).toEqual(kind === "sourced-fact" ? ["title", "body", locale === "ru" ? "caption" : "reduced", "sources"] : ["title", "body", locale === "ru" ? "caption" : "reduced"]);
      expect(variantRecord(exported, locale, kind).payload.copy).toEqual(variantRecord(omitted, locale, kind).payload.copy);
      expect(Object.prototype.hasOwnProperty.call(copy, locale === "ru" ? "reduced" : "caption")).toBe(false);
      expect(Object.keys(variantCopies(omitted.authoringSource.input).find((item) => item.locale === locale && item.kind === kind).copy)).toEqual(kind === "sourced-fact" ? ["title", "body", "sources"] : ["title", "body"]);
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
    for (const { copy } of variantCopies(valid)) {
      copy.caption = "First\nSecond	line\r\nThird";
      copy.reduced = "Short\nSecond";
    }
    expect(parseBookyJourneyDraft(JSON.stringify(draft(valid)), catalog()).ok).toBe(true);
    for (let index = 0; index < 12; index++) {
      for (const field of ["caption", "reduced"]) {
        for (const invalid of [void 0, null, "", " ", " padded", "padded ", "bad\vcontrol", "bad\x7Fcontrol", 1, {}, "x".repeat(field === "caption" ? 1601 : 321)]) {
          const value2 = variantValue();
          Object.assign(variantCopies(value2)[index].copy, { [field]: invalid });
          expect(createBookyJourneyDraft(value2, catalog()).ok).toBe(false);
        }
      }
      const value = variantValue();
      variantCopies(value)[index].copy.body = "b".repeat(1601);
      expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
    }
  });
  it("rejects extra, hidden, inherited and accessor copy fields without evaluating authoring getters", () => {
    let getterCalls = 0;
    const getter = () => {
      getterCalls++;
      throw new Error("authoring getter must not execute");
    };
    const malformed = [
      (copy) => {
        Object.assign(copy, { audioApproved: true });
      },
      (copy) => {
        Object.defineProperty(copy, "caption", { value: "Hidden" });
      },
      (copy) => {
        Object.defineProperty(copy, /* @__PURE__ */ Symbol("extra"), { value: "Hidden" });
      },
      (copy) => {
        Object.setPrototypeOf(copy, { caption: "Inherited" });
      },
      (copy) => {
        Object.defineProperty(copy, "caption", { enumerable: true, get: getter });
      },
      (copy) => {
        Object.defineProperty(copy, "reduced", { enumerable: true, get: getter });
      },
      (copy) => {
        Object.defineProperty(copy, "body", { enumerable: true, get: getter });
      }
    ];
    for (let index = 0; index < 12; index++) for (const change of malformed) {
      const value = variantValue();
      change(variantCopies(value)[index].copy);
      expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
    }
    for (const change of [
      (value) => {
        Object.defineProperty(value, "copy", { enumerable: true, get: getter });
      },
      (value) => {
        Object.defineProperty(value.copy, "ru", { enumerable: true, get: getter });
      },
      (value) => {
        Object.defineProperty(value.copy.en, "nodes", { enumerable: true, get: getter });
      },
      (value) => {
        Object.defineProperty(value.copy.ru.nodes, "work", { enumerable: true, get: getter });
      },
      (value) => {
        Object.assign(value.copy.en, { caption: "Wrong level" });
      }
    ]) {
      const value = variantValue();
      change(value);
      expect(createBookyJourneyDraft(value, catalog()).ok).toBe(false);
    }
    expect(getterCalls).toBe(0);
  });
  it("round trips explicit variants into immutable independent clones and still rejects current canonical drift", () => {
    const value = variantValue();
    value.copy.ru.nodes.work.caption = "\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043A\u043D\u0438\u0433\u0438";
    value.activity.copy.en.reduced = "Choose an author";
    value.fact.copy.ru.caption = "\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u0444\u0430\u043A\u0442\u0430";
    value.fact.copy.en.reduced = "Short fact";
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
    value.activity.copy.en.reduced = "Changed caller";
    value.fact.copy.en.sources[0].url = "https://example.org/changed";
    expect(reopened.input.copy.ru.nodes.work.caption).toBe("\u041F\u043E\u0434\u043F\u0438\u0441\u044C \u043A\u043D\u0438\u0433\u0438");
    expect(reopened.input.activity.copy.en.reduced).toBe("Choose an author");
    expect(reopened.input.fact.copy.en.sources[0].url).toBe("https://example.org/en/work");
    const current = catalog();
    current.countries[0].writers[0].works[0].label.en = "Changed work";
    expect(importErrors(serialized, current)).toContain("file");
  });
  it("rebinds bilingual fact checksums for variants while preserving main-copy provenance, citations and factual identity", () => {
    const original = draft(factValue()), value = factValue();
    value.fact.copy.ru.caption = "\u042F\u0432\u043D\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0444\u0430\u043A\u0442\u0430";
    value.fact.copy.ru.reduced = "\u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0444\u0430\u043A\u0442";
    const exported = draft(value);
    for (const locale of ["ru", "en"]) {
      const record = factRecord(exported, locale), previous = factRecord(original, locale);
      expect(record.payload.provenance.copySha256).toBe(previous.payload.provenance.copySha256);
      expect(record.payload.context).toBe(previous.payload.context);
      expect(record.payload.factualSources).toEqual(previous.payload.factualSources);
      expect(record.review.contentChecksum).not.toBe(previous.review.contentChecksum);
      expect(record.payload.provenance.sourceSha256).toBe(exported.authoringSourceChecksum);
      for (const definition of exported.definitions) {
        const node = definition.nodes[3];
        expect(node.fact.dialogues.find((binding) => binding.locale === locale).contentChecksum).toBe(getBookyDialogueContentChecksum(record.payload));
        expect(getBookyJourneyFactChecksum(node.fact, node.entity, node.screen)).not.toBeNull();
      }
    }
    expect(factRecord(exported, "en").payload.copy).toEqual(factRecord(original, "en").payload.copy);
    expect(exported.definitions[0].nodes[3].fact).toEqual(exported.definitions[1].nodes[3].fact);
    expect(exported.authoringSourceChecksum).not.toBe(original.authoringSourceChecksum);
  });
  it("rejects independently rehashed derived variants and altered explicit source presence against full regeneration", () => {
    const value = variantValue();
    for (const { copy } of variantCopies(value)) {
      copy.caption = "Explicit caption";
      copy.reduced = "Explicit reduced";
    }
    const serialized = JSON.stringify(draft(value));
    for (const kind of ["work", "activity", "sourced-fact"]) for (const field of ["caption", "reduced"]) {
      const changed = JSON.parse(serialized);
      const record = changed.dialogues.find((item) => item.payload.id === `test-route.${kind}` && item.payload.locale === "ru");
      record.payload.copy[field] = "Tampered derived variant";
      const checksum = getBookyDialogueContentChecksum(record.payload);
      expect(checksum).not.toBeNull();
      record.review.contentChecksum = checksum;
      record.checksum = getBookyDialogueChecksum({ payload: record.payload, review: record.review });
      for (const definition of changed.definitions) {
        if (definition.locale === "ru") definition.nodes.find((node) => node.kind === kind).dialogue.contentChecksum = checksum;
        if (kind === "sourced-fact") definition.nodes.find((node) => node.kind === kind).fact.dialogues[0].contentChecksum = checksum;
      }
      changed.definitionsChecksums = changed.definitions.map((definition) => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition) }));
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
    for (const change of [
      (changed) => {
        changed.authoringSource.input.copy.ru.nodes.work.caption = "Changed input caption";
      },
      (changed) => {
        delete changed.authoringSource.input.fact.copy.ru.reduced;
      }
    ]) {
      const changed = JSON.parse(serialized);
      change(changed);
      changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource);
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
  });
  it("rejects malformed imported optional fields on all node kinds before they can grant any draft authority", () => {
    const serialized = JSON.stringify(draft(variantValue()));
    for (let index = 0; index < 12; index++) for (const invalid of [null, "", " padded", "x".repeat(1601)]) {
      const changed = JSON.parse(serialized);
      Object.assign(variantCopies(changed.authoringSource.input)[index].copy, { caption: invalid });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), catalog()).ok).toBe(false);
    }
    for (let index = 0; index < 12; index++) {
      const changed = JSON.parse(serialized);
      Object.assign(variantCopies(changed.authoringSource.input)[index].copy, { reduced: "x".repeat(321), narrationApproved: true });
      expect(parseBookyJourneyDraft(JSON.stringify(changed), catalog()).ok).toBe(false);
    }
    expect(parseBookyJourneyDraft(serialized, catalog()).ok).toBe(true);
  });
});
describe("adult Booky journey draft local profile evaluation", () => {
  it("matches the compiled age bounds inclusively and distinguishes an outside adult age from an invalid age", () => {
    const value = input();
    value.ageRange = { min: 18, max: 65 };
    const definition = draft(value).definitions[0];
    for (const age of [18, 30, 65]) expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age, readingLevel: "plain" })).toEqual({ status: "matches", ageMatches: true, readingLevelMatches: true });
    for (const age of [66, 120]) expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age, readingLevel: "plain" })).toEqual({ status: "outside", ageMatches: false, readingLevelMatches: true });
    for (const age of [17, 18.5, 121]) expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age, readingLevel: "plain" })).toEqual({ status: "invalid", ageMatches: null, readingLevelMatches: null });
    value.ageRange = { min: 30, max: 30 };
    const oneAge = draft(value).definitions[1];
    expect(evaluateBookyJourneyDraftPreviewProfile(oneAge, { age: 30, readingLevel: "plain" }).status).toBe("matches");
    for (const age of [29, 31]) expect(evaluateBookyJourneyDraftPreviewProfile(oneAge, { age, readingLevel: "plain" }).status).toBe("outside");
  });
  it("requires the exact compiled reading level and reports each adult condition independently", () => {
    for (const readingLevel of ["plain", "developing", "fluent"]) {
      const value = input();
      value.readingLevel = readingLevel;
      value.ageRange = { min: 26, max: 40 };
      for (const definition of draft(value).definitions) for (const candidate of ["plain", "developing", "fluent"]) {
        expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age: 30, readingLevel: candidate })).toEqual({
          status: candidate === readingLevel ? "matches" : "outside",
          ageMatches: true,
          readingLevelMatches: candidate === readingLevel
        });
        expect(evaluateBookyJourneyDraftPreviewProfile(definition, { age: 50, readingLevel: candidate })).toEqual({
          status: "outside",
          ageMatches: false,
          readingLevelMatches: candidate === readingLevel
        });
      }
    }
  });
  it("rejects malformed scenarios without coercion or accessor execution and returns immutable invalid results", () => {
    const definition = draft().definitions[0];
    let getterCalls = 0;
    const getter = () => {
      getterCalls++;
      throw new Error("profile getter must not execute");
    };
    const invalid = [
      null,
      void 0,
      [],
      {},
      "30",
      { age: 30 },
      { readingLevel: "plain" },
      { age: "30", readingLevel: "plain" },
      { age: new Number(30), readingLevel: "plain" },
      { age: NaN, readingLevel: "plain" },
      { age: Infinity, readingLevel: "plain" },
      { age: true, readingLevel: "plain" },
      { age: 30, readingLevel: "Plain" },
      { age: 30, readingLevel: " plain" },
      { age: 30, readingLevel: "" },
      { age: 30, readingLevel: null },
      { age: 30, readingLevel: new String("plain") },
      { age: 30, readingLevel: "plain", approved: true },
      /* @__PURE__ */ Object.create({ age: 30, readingLevel: "plain" })
    ];
    for (const change of [
      (scenario) => {
        Object.defineProperty(scenario, "age", { enumerable: true, get: getter });
      },
      (scenario) => {
        Object.defineProperty(scenario, "readingLevel", { enumerable: true, get: getter });
      },
      (scenario) => {
        Object.defineProperty(scenario, "age", { value: 30, enumerable: false });
      },
      (scenario) => {
        Object.defineProperty(scenario, /* @__PURE__ */ Symbol("extra"), { value: true });
      }
    ]) {
      const scenario = { age: 30, readingLevel: "plain" };
      change(scenario);
      invalid.push(scenario);
    }
    invalid.push(new Proxy({}, { ownKeys() {
      throw new Error("unreadable profile");
    } }));
    for (const scenario of invalid) {
      const result = evaluateBookyJourneyDraftPreviewProfile(definition, scenario);
      expect(result).toEqual({ status: "invalid", ageMatches: null, readingLevelMatches: null });
      expect(Object.isFrozen(result)).toBe(true);
    }
    expect(getterCalls).toBe(0);
    const plainData = Object.assign(/* @__PURE__ */ Object.create(null), { age: 30, readingLevel: "plain" });
    expect(evaluateBookyJourneyDraftPreviewProfile(definition, plainData).status).toBe("matches");
  });
  it("uses each newly compiled definition and leaves scenario, authoring data and serialized draft bytes unchanged", () => {
    const value = variantValue();
    value.ageRange = { min: 18, max: 65 };
    value.copy.ru.nodes.work.caption = "\u041F\u043E\u0434\u043F\u0438\u0441\u044C";
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
    for (const definition of draft(value).definitions) expect(evaluateBookyJourneyDraftPreviewProfile(definition, scenario)).toEqual({ status: "outside", ageMatches: false, readingLevelMatches: false });
    expect(evaluateBookyJourneyDraftPreviewProfile(exported.definitions[0], scenario).status).toBe("matches");
    expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    expect(Object.isFrozen(scenario)).toBe(false);
  });
  it("agrees with authored dialogue conditions in both locales while a matching profile confers no runtime admission", () => {
    const value = variantValue();
    value.ageRange = { min: 26, max: 65 };
    value.readingLevel = "developing";
    const exported = draft(value), scenario = { age: 40, readingLevel: "developing" };
    const registry = createBookyDialogueRegistry(exported.dialogues, {
      canonicalEntityIds: [...new Set(exported.dialogues.flatMap((record) => record.payload.entityIds))],
      approvedReviews: []
    });
    for (const definition of exported.definitions) {
      expect(evaluateBookyJourneyDraftPreviewProfile(definition, scenario)).toEqual({ status: "matches", ageMatches: true, readingLevelMatches: true });
      for (const record of exported.dialogues.filter((record2) => record2.payload.locale === definition.locale)) {
        expect(record.payload.ageRange).toEqual(definition.ageRange);
        expect(record.payload.readingLevel).toBe(definition.readingLevel);
        expect(registry.resolve({
          id: record.payload.id,
          locale: definition.locale,
          audience: "adult",
          age: scenario.age,
          readingLevel: "developing",
          intent: record.payload.intent,
          screen: record.payload.screens[0],
          context: record.payload.context,
          entityIds: record.payload.entityIds,
          now: "2026-10-01T12:00:00.000Z"
        })).toBeNull();
      }
      expect(compileBookyJourney(definition, {
        audience: "adult",
        age: scenario.age,
        locale: definition.locale,
        readingLevel: "developing",
        now: "2026-10-01T12:00:00.000Z",
        connectivity: "online",
        completedPrerequisites: [],
        availability: []
      }, { currentVersions: [], approvedReviews: [], dialogueRegistry: registry, publicCountries: [], publicBooks: [] })).toBeNull();
    }
    expect(exported.dialogueApprovals).toEqual([]);
    expect(exported.journeyApprovals).toEqual([]);
    expect(exported.releaseReady).toBe(false);
  });
});
const historicalOrderlessDownloads = [
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
          "title": "\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u0441 \u0447\u0435\u0440\u043D\u043E\u0432\u0438\u043A\u043E\u043C \u0444\u0430\u043A\u0442\u0430",
          "description": "\u0421\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 \u0438 \u043D\u0435\u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0444\u043E\u0440\u043C\u044B.",
          "nodes": {
            "country": {
              "title": "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0441\u043E \u0441\u0442\u0440\u0430\u043D\u044B",
              "body": "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0443 \u043D\u0430 \u0433\u043B\u043E\u0431\u0443\u0441\u0435."
            },
            "writer": {
              "title": "\u041F\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043A \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044E",
              "body": "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044F."
            },
            "work": {
              "title": "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043A\u043D\u0438\u0433\u0443",
              "body": "\u041F\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u043D\u0438\u0433\u0435 \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438.",
              "caption": "\u0410\u0432\u0442\u043E\u0440\u0441\u043A\u0430\u044F \u0441\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u0448\u0430\u0433\u0430 \u043A\u043D\u0438\u0433\u0438."
            },
            "checkpoint": {
              "title": "\u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0442\u043E\u0433",
              "body": "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u0430."
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
            "title": "\u0421\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C \u043E \u043A\u043D\u0438\u0433\u0435",
            "body": "\u042D\u0442\u043E \u0432\u044B\u043C\u044B\u0448\u043B\u0435\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430.\n\u042D\u0442\u043E \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043D\u044B\u0439 \u043B\u0438\u0442\u0435\u0440\u0430\u0442\u0443\u0440\u043D\u044B\u0439 \u0444\u0430\u043A\u0442.",
            "caption": "\u0421\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C.\n\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B.",
            "reduced": "\u041A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u0441\u0438\u043D\u0442\u0435\u0442\u0438\u0447\u0435\u0441\u043A\u0430\u044F \u0437\u0430\u043F\u0438\u0441\u044C; \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A\u0438 \u043D\u0435 \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B.",
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
            "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430 \u0410",
            "en": "Synthetic country A"
          },
          "writers": [
            {
              "id": "writer-a",
              "label": {
                "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C \u0410",
                "en": "Synthetic writer A"
              },
              "works": [
                {
                  "id": "work-a",
                  "label": {
                    "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043A\u043D\u0438\u0433\u0430 \u0410",
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
          "title": "\u041C\u0430\u0440\u0448\u0440\u0443\u0442 \u0441 \u0437\u0430\u0434\u0430\u043D\u0438\u0435\u043C",
          "description": "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u0437\u0430\u0434\u0430\u043D\u0438\u044F \u043F\u043E \u0442\u0435\u043A\u0443\u0449\u0435\u043C\u0443 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0443.",
          "nodes": {
            "country": {
              "title": "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0441\u043E \u0441\u0442\u0440\u0430\u043D\u044B",
              "body": "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0441\u0442\u0440\u0430\u043D\u0443 \u043D\u0430 \u0433\u043B\u043E\u0431\u0443\u0441\u0435."
            },
            "writer": {
              "title": "\u041F\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043A \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044E",
              "body": "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044F."
            },
            "work": {
              "title": "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043A\u043D\u0438\u0433\u0443",
              "body": "\u041F\u0435\u0440\u0435\u0439\u0434\u0438\u0442\u0435 \u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u043A\u043D\u0438\u0433\u0435 \u0432 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438."
            },
            "checkpoint": {
              "title": "\u041F\u043E\u0434\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0442\u043E\u0433",
              "body": "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435 \u044D\u0442\u043E\u0433\u043E \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u0430."
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
            "title": "\u041A\u0442\u043E \u0430\u0432\u0442\u043E\u0440 \u044D\u0442\u043E\u0439 \u043A\u043D\u0438\u0433\u0438?",
            "body": "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0438\u043C\u044F \u0430\u0432\u0442\u043E\u0440\u0430 \u0441\u0440\u0435\u0434\u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u043D\u044B\u0445 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u043E\u0432."
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
            "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430 \u0410",
            "en": "Synthetic country A"
          },
          "writers": [
            {
              "id": "writer-a",
              "label": {
                "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C \u0410",
                "en": "Synthetic writer A"
              },
              "works": [
                {
                  "id": "work-a",
                  "label": {
                    "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u043A\u043D\u0438\u0433\u0430 \u0410",
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
            "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u0430\u044F \u0441\u0442\u0440\u0430\u043D\u0430 \u0411",
            "en": "Synthetic country B"
          },
          "writers": [
            {
              "id": "writer-c",
              "label": {
                "ru": "\u0422\u0435\u0441\u0442\u043E\u0432\u044B\u0439 \u043F\u0438\u0441\u0430\u0442\u0435\u043B\u044C \u0412",
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
      expect(parseBookyJourneyDraft(JSON.stringify(exported), fixture.catalog).ok).toBe(true);
    }
    const combined = draft(variantValue());
    expect(combined.definitions[0].nodes.map((node) => node.kind)).toEqual(["country", "writer", "work", "sourced-fact", "activity", "checkpoint"]);
    expect(Object.prototype.hasOwnProperty.call(combined.authoringSource.input, "optionalNodeOrder")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(draft().authoringSource.input, "optionalNodeOrder")).toBe(false);
  });
  it("validates both optional orders with the real dialogue, activity, fact and definition schemas while preserving base anchors", () => {
    for (const optionalNodeOrder of [["sourced-fact", "activity"], ["activity", "sourced-fact"]]) {
      const value = variantValue();
      value.optionalNodeOrder = optionalNodeOrder;
      const exported = draft(value);
      expect(exported.dialogues).toHaveLength(12);
      expect(exported.authoringSource.input.optionalNodeOrder).toEqual(optionalNodeOrder);
      for (const definition of exported.definitions) {
        expect(definition.nodes.map((node) => node.kind)).toEqual(["country", "writer", "work", ...optionalNodeOrder, "checkpoint"]);
        expect(definition.nodes.slice(0, 3).map((node) => node.entity)).toEqual(draft().definitions[0].nodes.slice(0, 3).map((node) => node.entity));
        expect(definition.nodes[definition.nodes.length - 1].entity).toBeNull();
        const factNode = definition.nodes.find((node) => node.kind === "sourced-fact");
        const activityNode = definition.nodes.find((node) => node.kind === "activity");
        expect(factNode.entity).toEqual(definition.nodes[2].entity);
        expect(getBookyJourneyFactChecksum(factNode.fact, factNode.entity, factNode.screen)).not.toBeNull();
        expect(getBookyJourneyActivityChecksum(activityNode.activity)).not.toBeNull();
        for (const node of definition.nodes) {
          const record = exported.dialogues.find((item) => item.payload.locale === definition.locale && item.payload.id === node.dialogue.id);
          expect(node.dialogue.contentChecksum).toBe(getBookyDialogueContentChecksum(record.payload));
          expect(record.checksum).toBe(getBookyDialogueChecksum({ payload: record.payload, review: record.review }));
          expect(record.payload.context).toBe(bookyJourneyDialogueContext(definition.id, node));
        }
        expect(exported.definitionsChecksums.find((item) => item.locale === definition.locale).checksum).toBe(getBookyJourneyChecksum(definition));
      }
      const registry = createBookyDialogueRegistry(exported.dialogues, {
        canonicalEntityIds: [...new Set(exported.dialogues.flatMap((record) => record.payload.entityIds))],
        approvedReviews: []
      });
      expect(registry.size).toBe(12);
      expect(registry.rejections).toEqual([]);
      expect(parseBookyJourneyDraft(JSON.stringify(exported), catalog()).ok).toBe(true);
    }
  });
  it("accepts exactly the enabled optional set and rejects empty, omitted-node or disabled-node orders", () => {
    for (const [value, order] of [[factValue(), ["sourced-fact"]], [activityValue(), ["activity"]]]) {
      value.optionalNodeOrder = order;
      const exported = draft(value);
      expect(exported.definitions[0].nodes.map((node) => node.kind)).toEqual(["country", "writer", "work", ...order, "checkpoint"]);
      expect(exported.authoringSource.input.optionalNodeOrder).toEqual(order);
    }
    for (const base of [input, factValue, activityValue, variantValue]) for (const order of [[], ["sourced-fact"], ["activity"], ["sourced-fact", "activity"]]) {
      const value = base(), enabled = [value.fact ? "sourced-fact" : null, value.activity ? "activity" : null].filter(Boolean);
      if (order.length > 0 && order.length === enabled.length && order.every((kind) => enabled.includes(kind))) continue;
      Object.assign(value, { optionalNodeOrder: order });
      expect(errors(value)).toContain("optionalNodeOrder");
    }
  });
  it("rejects malformed order arrays and accessors without invoking getters or accepting extra data", () => {
    let getterCalls = 0;
    const getter = () => {
      getterCalls++;
      throw new Error("order getter must not execute");
    };
    const malformed = [
      void 0,
      null,
      "activity",
      {},
      [],
      ["activity", "activity"],
      ["sourced-fact", "sourced-fact"],
      ["activity", "sourced-fact", "activity"],
      ["country", "activity"],
      ["sourced-fact", "checkpoint"],
      [null, "activity"],
      [new String("activity"), "sourced-fact"],
      Array(2),
      [" activity", "sourced-fact"],
      ["Activity", "sourced-fact"]
    ];
    const changes = [
      (order) => {
        delete order[0];
      },
      (order) => {
        Object.assign(order, { extra: true });
      },
      (order) => {
        Object.defineProperty(order, /* @__PURE__ */ Symbol("extra"), { value: true });
      },
      (order) => {
        Object.defineProperty(order, "hidden", { value: true });
      },
      (order) => {
        Object.defineProperty(order, "0", { enumerable: true, get: getter });
      },
      (order) => {
        Object.defineProperty(order, "1", { value: "activity", enumerable: false });
      },
      (order) => {
        Object.setPrototypeOf(order, null);
      }
    ];
    for (const change of changes) {
      const order = ["sourced-fact", "activity"];
      change(order);
      malformed.push(order);
    }
    for (const order of malformed) {
      const value = variantValue();
      Object.assign(value, { optionalNodeOrder: order });
      expect(errors(value)).toContain("optionalNodeOrder");
    }
    for (const descriptor of [{ enumerable: true, get: getter }, { value: ["activity", "sourced-fact"], enumerable: false }]) {
      const value = variantValue();
      Object.defineProperty(value, "optionalNodeOrder", descriptor);
      expect(errors(value)).toContain("optionalNodeOrder");
    }
    expect(getterCalls).toBe(0);
  });
  it("clones and freezes authored order and fresh reopened drafts independently of the caller array", () => {
    const value = variantValue(), order = ["activity", "sourced-fact"];
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
    const original = draft(variantValue()), value = variantValue();
    value.optionalNodeOrder = ["activity", "sourced-fact"];
    const changed = draft(value);
    expect(changed.authoringSourceChecksum).not.toBe(original.authoringSourceChecksum);
    for (const record of changed.dialogues) {
      const prior = original.dialogues.find((item) => item.payload.id === record.payload.id && item.payload.locale === record.payload.locale);
      expect(record.payload.copy).toEqual(prior.payload.copy);
      expect(record.payload.factualSources).toEqual(prior.payload.factualSources);
      expect(record.payload.provenance.copySha256).toBe(prior.payload.provenance.copySha256);
      expect(record.payload.context).toBe(prior.payload.context);
      expect(record.payload.provenance.sourceSha256).toBe(changed.authoringSourceChecksum);
      expect(record.review.contentChecksum).not.toBe(prior.review.contentChecksum);
      expect(record.review.status).toBe("draft");
    }
    for (const definition of changed.definitions) {
      const fact = definition.nodes.find((node) => node.kind === "sourced-fact");
      for (const binding of fact.fact.dialogues) expect(binding.contentChecksum).toBe(factRecord(changed, binding.locale).review.contentChecksum);
      expect(definition.nodes.find((node) => node.kind === "activity").activity).toEqual(original.definitions[0].nodes.find((node) => node.kind === "activity").activity);
      expect(getBookyJourneyChecksum(definition)).not.toBe(getBookyJourneyChecksum(original.definitions.find((item) => item.locale === definition.locale)));
    }
    expect([changed.humanReviewed, changed.childApproved, changed.narrationApproved, changed.releaseReady]).toEqual([false, false, false, false]);
    for (const entries of [changed.journeyApprovals, changed.dialogueApprovals, changed.currentVersions, changed.availability]) expect(entries).toEqual([]);
  });
  it("rejects source-order and independently rehashed derived ordering tampering through full regeneration", () => {
    const value = variantValue();
    value.optionalNodeOrder = ["activity", "sourced-fact"];
    const serialized = JSON.stringify(draft(value));
    for (const change of [
      (changed) => {
        changed.authoringSource.input.optionalNodeOrder.reverse();
        changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource);
      },
      (changed) => {
        delete changed.authoringSource.input.optionalNodeOrder;
        changed.authoringSourceChecksum = contentRecordHash(changed.authoringSource);
      },
      (changed) => {
        for (const definition of changed.definitions) [definition.nodes[3], definition.nodes[4]] = [definition.nodes[4], definition.nodes[3]];
        changed.definitionsChecksums = changed.definitions.map((definition) => ({ locale: definition.locale, checksum: getBookyJourneyChecksum(definition) }));
      },
      (changed) => {
        [changed.dialogues[3], changed.dialogues[4]] = [changed.dialogues[4], changed.dialogues[3]];
      },
      (changed) => {
        Object.assign(changed, { releaseReady: true });
      }
    ]) {
      const changed = JSON.parse(serialized);
      change(changed);
      expect(importErrors(JSON.stringify(changed))).toContain("file");
    }
  });
  it("preserves strict order-field errors and rejects stale current canonical anchors and activity choices on reopen", () => {
    const value = variantValue();
    value.optionalNodeOrder = ["activity", "sourced-fact"];
    const serialized = JSON.stringify(draft(value));
    for (const invalid of [null, [], ["activity"], ["activity", "activity"], ["activity", "sourced-fact", "checkpoint"], ["writer", "sourced-fact"]]) {
      const changed = JSON.parse(serialized);
      Object.assign(changed.authoringSource.input, { optionalNodeOrder: invalid });
      expect(importErrors(JSON.stringify(changed))).toContain("optionalNodeOrder");
    }
    for (const entity of ["country", "writer", "work", "choice"]) {
      const current = catalog(), country = current.countries[0], writer = country.writers[0];
      (entity === "country" ? country : entity === "writer" ? writer : entity === "work" ? writer.works[0] : country.writers[1]).label.en += " changed";
      expect(importErrors(serialized, current)).toContain("file");
    }
    const removedWork = catalog();
    removedWork.countries[0].writers[0].works = [];
    expect(importErrors(serialized, removedWork)).toContain("workId");
    const removedChoice = catalog();
    removedChoice.countries[0].writers.pop();
    expect(parseBookyJourneyDraft(serialized, removedChoice).ok).toBe(false);
  });
});
