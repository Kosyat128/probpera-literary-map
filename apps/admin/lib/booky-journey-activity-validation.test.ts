import { describe, expect, it } from "vitest";
import type { Country } from "../../../src/data/countries/types";
import type { BookArchiveEntry } from "../../../src/data/bookArchive";
import { contentRecordHash } from "../../../src/planet/contentExportHash";
import { resolveBookyJourneyActivity, type BookyJourneyActivityPublicData } from "../../../src/host/bookyJourneyActivity";
import {
  BOOKY_JOURNEY_DRAFT_MAX_BYTES, createBookyJourneyDraft,
  type JourneyDraftCatalog, type JourneyDraftInput,
} from "./booky-journey-draft";
import { validateBookyJourneyDraftActivity } from "./booky-journey-activity-validation";

function fixture() {
  // Synthetic factual data only. No independent approval receipt is fabricated.
  const country: Country = { id: "test-country", name: "Тестовая страна", writers: [
    { id: "draft-owner", name: "Владелец архива", fullName: "Archive Owner" },
    { id: "draft-author", name: "Указанный автор", fullName: "Credited Author" },
    { id: "draft-other", name: "Другой писатель", fullName: "Other Writer" },
  ] };
  const book: BookArchiveEntry = { id: "test-work", title: "Тестовая книга", countryId: country.id,
    countryName: country.name, writerId: "draft-owner", writerName: "Владелец архива",
    writer: country.writers[0], country, editorial: { status: "reviewed" },
    authorship: { kind: "single", authors: [{ countryId: country.id, writerId: "draft-author", attribution: "credited" }] } };
  const catalog: JourneyDraftCatalog = { countries: [{ id: country.id, label: { ru: country.name, en: "Test Country" },
    writers: country.writers.map(writer => ({ id: writer.id, label: { ru: writer.name!, en: writer.fullName! },
      works: writer.id === "draft-owner" ? [{ id: book.id, label: { ru: book.title, en: "Test Work" } }] : [] })) }] };
  const input: JourneyDraftInput = {
    id: "test-route", version: 2, countryId: country.id, writerId: "draft-owner", workId: book.id,
    ageRange: { min: 18, max: 99 }, readingLevel: "plain", estimatedDurationMinutes: 15,
    copy: {
      ru: { title: "Тестовый маршрут", description: "Откройте канонические записи по порядку.", nodes: {
        country: { title: "Страна", body: "Откройте страну." }, writer: { title: "Писатель", body: "Откройте писателя." },
        work: { title: "Книга", body: "Откройте книгу." }, checkpoint: { title: "Завершение", body: "Завершите маршрут." },
      } },
      en: { title: "Test Journey", description: "Open the canonical records in order.", nodes: {
        country: { title: "Country", body: "Open the country." }, writer: { title: "Writer", body: "Open the writer." },
        work: { title: "Work", body: "Open the work." }, checkpoint: { title: "Finish", body: "Finish the journey." },
      } },
    },
    activity: { type: "match-work-author", choices: ["draft-owner", "draft-author"].map(writerId => ({ countryId: country.id, writerId })),
      copy: { ru: { title: "Выберите автора", body: "Сопоставьте выбранную книгу и автора." },
        en: { title: "Choose the author", body: "Match the selected work and its author." } } },
  };
  const publicData = { publicCountries: [country], publicBooks: [book] } satisfies BookyJourneyActivityPublicData;
  const compile = () => {
    const result = createBookyJourneyDraft(input, catalog);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    return result.draft;
  };
  return { country, book, catalog, input, publicData, compile };
}
function rejected(serialized: string, f: ReturnType<typeof fixture>) {
  const result = validateBookyJourneyDraftActivity(serialized, f.catalog, f.publicData);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected validation error");
  expect(Object.keys(result).sort()).toEqual(["errors", "ok"]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.errors)).toBe(true);
  expect(result.errors.length).toBeGreaterThan(0);
  expect(result.errors.every(error => Object.isFrozen(error) && /[А-Яа-яЁё]/u.test(error.message))).toBe(true);
  return result.errors;
}

describe("current Booky draft activity semantic validation", () => {
  it("uses factual credit rather than routing ownership and returns only the draft response binding", () => {
    const f = fixture(), draft = f.compile(), serialized = JSON.stringify(draft);
    const activity = draft.definitions[0].nodes.find(node => node.kind === "activity")!.activity!;
    // Establish that this test really exercises the different credited author.
    expect(resolveBookyJourneyActivity(activity, f.publicData)?.correctChoiceId).toBe("choice-2");
    const before = JSON.stringify({ serialized, catalog: f.catalog, data: f.publicData });
    const result = validateBookyJourneyDraftActivity(serialized, f.catalog, f.publicData);
    expect(result).toEqual({ ok: true, draftChecksum: contentRecordHash(draft) });
    expect(Object.keys(result).sort()).toEqual(["draftChecksum", "ok"]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/correctChoiceId|semanticChecksum|publicCountries|publicBooks|approved/i);
    expect(JSON.stringify({ serialized, catalog: f.catalog, data: f.publicData })).toBe(before);
    expect(draft.journeyApprovals).toEqual([]);
    expect(draft.dialogueApprovals).toEqual([]);
  });

  it("rejects a structurally valid choice set that omits the actual credited author", () => {
    const f = fixture();
    f.input.activity!.choices = [{ countryId: f.country.id, writerId: "draft-owner" },
      { countryId: f.country.id, writerId: "draft-other" }];
    expect(rejected(JSON.stringify(f.compile()), f)[0].field).toBe("activity");
  });

  it("rejects duplicate or revoked current writer identities and duplicate current work tuples", () => {
    for (const change of ["duplicate-writer", "revoked-writer", "duplicate-work"] as const) {
      const f = fixture(), serialized = JSON.stringify(f.compile());
      if (change === "duplicate-writer") f.country.writers.push({ ...f.country.writers[1] });
      if (change === "revoked-writer") f.country.writers.splice(1, 1);
      if (change === "duplicate-work") f.publicData.publicBooks = [f.book, f.book];
      expect(rejected(serialized, f)[0].field).toBe("activity");
    }
  });

  it("rejects ambiguous or disputed author credit and work records no longer reviewed", () => {
    for (const kind of ["multiple", "anonymous", "collective", "traditional", "disputed"] as const) {
      const f = fixture(), serialized = JSON.stringify(f.compile());
      f.book.authorship = { kind, authors: [{ countryId: f.country.id, writerId: "draft-author" }] };
      expect(rejected(serialized, f)[0].field).toBe("activity");
    }
    for (const change of ["attributed", "unreviewed", "removed"] as const) {
      const f = fixture(), serialized = JSON.stringify(f.compile());
      if (change === "attributed") f.book.authorship!.authors[0].attribution = "attributed";
      if (change === "unreviewed") f.book.editorial = { status: "draft" };
      if (change === "removed") f.publicData.publicBooks = [];
      expect(rejected(serialized, f)[0].field).toBe("activity");
    }
  });

  it("preserves the documented current reviewed legacy-single fallback", () => {
    const f = fixture(), draft = f.compile();
    delete f.book.authorship;
    expect(validateBookyJourneyDraftActivity(JSON.stringify(draft), f.catalog, f.publicData))
      .toEqual({ ok: true, draftChecksum: contentRecordHash(draft) });
  });

  it("rejects an actually missing canonical English label without generating a replacement", () => {
    const f = fixture(), serialized = JSON.stringify(f.compile());
    delete f.country.writers[1].fullName;
    const errors = rejected(serialized, f);
    expect(errors[0].field).toBe("activity.choices.1.en");
    expect(errors[0].message).toMatch(/английские/);
    expect(f.catalog.countries[0].writers[1].label.en).toBe("Credited Author");
  });

  it("rejects both RU and EN labels that are ambiguous under runtime normalization", () => {
    for (const locale of ["ru", "en"] as const) {
      const f = fixture(), serialized = JSON.stringify(f.compile());
      if (locale === "ru") f.country.writers[1].name = "  ВЛАДЕЛЕЦ   АРХИВА  ";
      else f.country.writers[1].fullName = "  ＡＲＣＨＩＶＥ   ＯＷＮＥＲ  ";
      expect(rejected(serialized, f)[0].field).toBe(`activity.choices.1.${locale}`);
    }
  });

  it("matches actual source fields to saved labels and rejects changed current names", () => {
    const f = fixture(), serialized = JSON.stringify(f.compile());
    f.country.writers[1].fullName = "Changed Canonical Author";
    expect(rejected(serialized, f)[0].field).toBe("activity.choices.1.en");
    const stale = fixture(), saved = JSON.stringify(stale.compile());
    stale.catalog.countries[0].writers[1].label.en = "Changed Catalog Author";
    expect(rejected(saved, stale)[0].field).toBe("file");
  });

  it("applies source descriptor and 200-character rules without evaluating accessors", () => {
    for (const change of ["getter", "hidden", "too-long", "control"] as const) {
      const f = fixture(), serialized = JSON.stringify(f.compile());
      let reads = 0;
      if (change === "getter") Object.defineProperty(f.country.writers[1], "name", { enumerable: true,
        get() { reads += 1; return "Указанный автор"; } });
      if (change === "hidden") Object.defineProperty(f.country.writers[1], "name", { enumerable: false, value: "Указанный автор" });
      if (change === "too-long") f.country.writers[1].name = "А".repeat(201);
      if (change === "control") f.country.writers[1].name = "Указанный\nавтор";
      expect(rejected(serialized, f)[0].field).toBe("activity.choices.1.ru");
      expect(reads).toBe(0);
    }
  });

  it("rejects missing activities, malformed or oversized JSON before returning a response binding", () => {
    const f = fixture();
    delete f.input.activity;
    expect(rejected(JSON.stringify(f.compile()), f)[0].field).toBe("activity");
    for (const serialized of ["", "{", "null", "x".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES + 1),
      "я".repeat(BOOKY_JOURNEY_DRAFT_MAX_BYTES / 2 + 1)]) {
      expect(rejected(serialized, fixture())[0].field).toBe("file");
    }
  });

  it("rejects altered bilingual specs, authored answers and duplicated choices through exact regeneration", () => {
    for (const change of ["en-work", "answer", "duplicate-choice"] as const) {
      const f = fixture(), imported = JSON.parse(JSON.stringify(f.compile()));
      const node = imported.definitions.find((item: { locale: string }) => item.locale === "en").nodes
        .find((item: { kind: string }) => item.kind === "activity");
      if (change === "en-work") node.activity.targetWork.workId = "other-work";
      if (change === "answer") node.activity.correctChoiceId = "choice-1";
      if (change === "duplicate-choice") node.activity.choices[1] = node.activity.choices[0];
      expect(rejected(JSON.stringify(imported), f)[0].field).toBe("file");
    }
  });
});
