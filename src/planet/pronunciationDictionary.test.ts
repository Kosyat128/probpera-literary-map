import { describe, expect, it, vi } from "vitest";
import { contentPackageHash } from "./contentPackageProtocol.mjs";
import {
  decodePronunciationDictionary, decodePronunciationCatalog, parsePronunciationDictionary, parsePronunciationJson,
  createNarrationPronunciationDraft, decodeNarrationProvenanceFields,
} from "./pronunciationDictionaryProtocol.mjs";

// Synthetic manual annotations exercise transport only; none are editorial pronunciations.
const country = { kind: "country", countryId: "Country.One" } as const;
const writer = { kind: "writer", countryId: "Country.One", writerId: "Writer.One" } as const;
const work = { kind: "work", countryId: "Country.One", writerId: "Writer.One", workId: "Work.One" } as const;
const catalog = [country, writer, work].map((ref, i) => ({ ref, spelling: { ru: "Тест " + i, en: "Test " + i } }));
const dictionary = () => ({ schemaVersion: 1, kind: "literary-planet-pronunciation-dictionary-v1", status: "draft", version: 1,
  entries: catalog.map(item => ({ ...item, ru: { phonetic: "RU test notation", notes: "RU test note" },
    en: { phonetic: "EN test notation", notes: "EN test note" } })) });
function source(locale: "ru" | "en" = "en", script = catalog[1].spelling[locale]) {
  return { schemaVersion: 1, kind: "literary-planet-child-narration-provenance-v1", scriptId: "Synthetic.Script",
    scriptChecksum: contentPackageHash(script), performerId: "Synthetic.Performer", licensorId: "Synthetic.Licensor", locale,
    accent: "Synthetic accent record", pronunciationNotes: "Original manual notes", durationMs: 20,
    loudnessReport: "Synthetic report", qualityReport: "Synthetic report", reducedAudioFallback: "same-locale-text", voiceKind: "human-licensed" };
}

describe("canonical draft pronunciation dictionary", () => {
  it("roundtrips country writer and work RU/EN without changing canonical text", () => {
    const original = dictionary(), before = JSON.stringify(original);
    const decoded = parsePronunciationDictionary(JSON.stringify(original), catalog);
    expect(decoded).toEqual(original);
    expect(decoded?.entries.map(row => row.ref)).toEqual([country, writer, work]);
    expect(Object.isFrozen(decoded?.entries[0].ru)).toBe(true);
    expect(JSON.stringify(original)).toBe(before);
  });
  it("refuses case aliases and a different canonical owner tuple", () => {
    for (const ref of [{ ...writer, writerId: "writer.one" }, { ...writer, countryId: "Country.Other" },
      { ...work, writerId: "Writer.Other" }]) {
      const raw = dictionary(); raw.entries[1] = { ...raw.entries[1], ref: ref as typeof writer };
      expect(decodePronunciationDictionary(raw, catalog)).toBeNull();
    }
  });
  it("refuses edited displayed spelling and stale current catalog names", () => {
    const raw = dictionary(); raw.entries[1].spelling = { ...raw.entries[1].spelling, en: "Phonetic replacement" };
    expect(decodePronunciationDictionary(raw, catalog)).toBeNull();
    const fresh = catalog.map((row, i) => i === 1 ? { ...row, spelling: { ...row.spelling, ru: "Новое имя" } } : row);
    expect(decodePronunciationDictionary(dictionary(), fresh)).toBeNull();
  });
  it("requires both manual locale annotations and refuses approval or unsupported versions", () => {
    for (const change of [{ status: "approved" }, { humanReviewed: true }, { version: -0 }, { version: 1.5 }, { schemaVersion: 2 }])
      expect(decodePronunciationDictionary({ ...dictionary(), ...change }, catalog)).toBeNull();
    const raw = dictionary(); raw.entries[1].en.phonetic = "";
    expect(decodePronunciationDictionary(raw, catalog)).toBeNull();
    expect(decodePronunciationDictionary({ ...dictionary(), entries: [{ ...dictionary().entries[0], fr: {} }] }, catalog)).toBeNull();
  });
  it("refuses duplicate references sparse arrays and hostile collection fields", () => {
    const row = dictionary().entries[0];
    expect(decodePronunciationDictionary({ ...dictionary(), entries: [row, row] }, catalog)).toBeNull();
    const sparse = new Array(1);
    expect(decodePronunciationDictionary({ ...dictionary(), entries: sparse }, catalog)).toBeNull();
    expect(decodePronunciationCatalog([catalog[0], catalog[0]])).toBeNull();
    const added = [row]; Object.defineProperty(added, "extra", { value: true, enumerable: true });
    expect(decodePronunciationDictionary({ ...dictionary(), entries: added }, catalog)).toBeNull();
  });
  it("refuses escaped duplicate JSON keys oversized files and invalid limits", () => {
    expect(parsePronunciationJson('{"status":"draft","sta\\u0074us":"draft"}')).toBeNull();
    expect(parsePronunciationJson('{"entries":[{"ru":{"phonetic":"a","phonetic":"b"}}]}')).toBeNull();
    expect(parsePronunciationJson(" ".repeat(524289))).toBeNull();
    expect(parsePronunciationJson("{}", NaN)).toBeNull();
    expect(parsePronunciationJson("{}", -1)).toBeNull();
  });
  it("refuses reflection traps and accessor fields without invoking their getters", () => {
    const getter = vi.fn(() => "approved"), raw = dictionary();
    Object.defineProperty(raw, "status", { get: getter, enumerable: true });
    expect(decodePronunciationDictionary(raw, catalog)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"] as const) {
      const hostile = new Proxy(dictionary(), { [trap]: () => { throw new Error("reflection refusal"); } });
      expect(decodePronunciationDictionary(hostile, catalog)).toBeNull();
    }
    const annotation = { phonetic: "test", notes: "" };
    Object.defineProperty(annotation, "notes", { get: getter, enumerable: true });
    expect(decodePronunciationDictionary({ ...dictionary(), entries: [{ ...dictionary().entries[0], ru: annotation }] }, catalog)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
});

describe("pronunciation notes bound to existing narration source", () => {
  it("exports each locale as draft while preserving every original provenance field", () => {
    for (const locale of ["ru", "en"] as const) {
      const original = source(locale), serialized = JSON.stringify(original) + "\n";
      const draft = createNarrationPronunciationDraft(dictionary(), catalog, writer, serialized, catalog[1].spelling[locale]);
      expect(draft?.locale).toBe(locale);
      expect(draft?.originalProvenanceChecksum).toBe(contentPackageHash(serialized));
      expect(draft?.provenance).toEqual({ ...original, pronunciationNotes: original.pronunciationNotes + "\n"
        + catalog[1].spelling[locale] + " — " + dictionary().entries[1][locale].phonetic + "\n" + dictionary().entries[1][locale].notes });
      expect(draft).toMatchObject({ status: "draft", humanReviewed: false, narrationApproved: false, childApproved: false, releaseReady: false });
    }
  });
  it("refuses a changed script missing canonical term or noncurrent selected owner", () => {
    const original = source(), bytes = JSON.stringify(original);
    expect(createNarrationPronunciationDraft(dictionary(), catalog, writer, bytes, "Changed script")).toBeNull();
    const unrelated = "A script without the selected term";
    expect(createNarrationPronunciationDraft(dictionary(), catalog, writer, JSON.stringify(source("en", unrelated)), unrelated)).toBeNull();
    expect(createNarrationPronunciationDraft(dictionary(), catalog, { ...writer, countryId: "Other" }, bytes, catalog[1].spelling.en)).toBeNull();
  });
  it("refuses cloned voices missing licensor and caller approval fields", () => {
    for (const change of [{ voiceKind: "cloned-writer" }, { licensorId: "" }, { qualityReport: "" }, { approved: true }, { locale: "fr" }]) {
      const original = { ...source(), ...change };
      expect(decodeNarrationProvenanceFields(original)).toBeNull();
      expect(createNarrationPronunciationDraft(dictionary(), catalog, writer, JSON.stringify(original), catalog[1].spelling.en)).toBeNull();
    }
  });
  it("preserves raw provenance hashing and refuses duplicate or overflowing note records", () => {
    const original = source(), script = catalog[1].spelling.en;
    const a = createNarrationPronunciationDraft(dictionary(), catalog, writer, JSON.stringify(original), script);
    const b = createNarrationPronunciationDraft(dictionary(), catalog, writer, JSON.stringify(original, null, 2), script);
    expect(a?.provenance).toEqual(b?.provenance); expect(a?.originalProvenanceChecksum).not.toBe(b?.originalProvenanceChecksum);
    expect(createNarrationPronunciationDraft(dictionary(), catalog, writer, '{"schemaVersion":1,"schemaVersion":1}', script)).toBeNull();
    expect(createNarrationPronunciationDraft(dictionary(), catalog, writer, JSON.stringify({ ...original, pronunciationNotes: "x".repeat(8192) }), script)).toBeNull();
  });
});
