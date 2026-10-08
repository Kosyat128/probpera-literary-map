import { describe, expect, it, vi } from "vitest";
import {
  createPronunciationEditorSession, previewPronunciationRequest, pronunciationCatalogFromJourneyCatalog,
} from "./pronunciation-editor-state";

import { PRONUNCIATION_DRAFT_MAX_BYTES, PRONUNCIATION_SOURCE_MAX_BYTES, PRONUNCIATION_ENVELOPE_MAX_BYTES,
  parsePronunciationEnvelope } from "../../../src/planet/pronunciationDictionaryProtocol.mjs";

const ref = { kind: "writer", countryId: "Country.One", writerId: "Writer.One" } as const;
const catalog = [{ ref, spelling: { ru: "Тестовый писатель", en: "Synthetic Writer" } }];
const dictionary = JSON.stringify({ schemaVersion: 1, kind: "literary-planet-pronunciation-dictionary-v1", status: "draft", version: 1,
  entries: [{ ...catalog[0], ru: { phonetic: "RU test notation", notes: "RU test note" }, en: { phonetic: "EN test notation", notes: "EN test note" } }] });
const held = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; };
const validPreview = async (request: string) => previewPronunciationRequest(request, catalog);

describe("current pronunciation editor draft owner", () => {
  it("requires the actual awaited current response before enabling draft export", async () => {
    const session = createPronunciationEditorSession(catalog), reply = held<unknown>(), port = vi.fn((_request: string) => reply.promise);
    session.edit({ dictionary, target: ref });
    const pending = session.preview(port);
    expect(port).toHaveBeenCalledTimes(1);
    expect(session.getSnapshot()).toMatchObject({ busy: true, validated: null, dirty: true });
    reply.resolve(previewPronunciationRequest(port.mock.calls[0][0], catalog));
    expect(await pending).toBe(true);
    expect(session.getSnapshot()).toMatchObject({ busy: false, dirty: true, narrationDraft: null });
    expect(session.getSnapshot().validated?.entries[0].en.phonetic).toBe("EN test notation");
  });
  it("keeps both raw locale documents after authentication refusal and forged approval replies", async () => {
    const session = createPronunciationEditorSession(catalog); session.edit({ dictionary, target: ref });
    expect(await session.preview(async () => ({ ok: false }))).toBe(false);
    expect(session.getSnapshot()).toMatchObject({ dictionary, validated: null, dirty: true, busy: false });
    expect(await session.preview(async request => ({ ...previewPronunciationRequest(request, catalog), humanReviewed: true }))).toBe(false);
    expect(session.getSnapshot().dictionary).toBe(dictionary);
  });
  it("ignores a late successful response after an intervening RU edit", async () => {
    const session = createPronunciationEditorSession(catalog), reply = held<unknown>();
    session.edit({ dictionary, target: ref });
    let request = ""; const pending = session.preview(async value => { request = value; return reply.promise; });
    const changed = dictionary.replace("RU test note", "RU later note"); session.edit({ dictionary: changed });
    reply.resolve(previewPronunciationRequest(request, catalog));
    expect(await pending).toBe(false);
    expect(session.getSnapshot()).toMatchObject({ dictionary: changed, busy: false, validated: null, dirty: true });
  });
  it("atomically roundtrips opaque RU/EN recovery work without calling preview or claiming save", () => {
    const first = createPronunciationEditorSession(catalog);
    first.edit({ dictionary: '{"ru":"unfinished RU","en":"unfinished EN"', provenance: "unfinished provenance", scriptText: "exact script", target: ref });
    const before = first.getSnapshot(), second = createPronunciationEditorSession(catalog);
    expect(second.importWorkspace(first.workspace(), 0)).toBe(true);
    expect(second.getSnapshot()).toMatchObject({ dictionary: before.dictionary, provenance: before.provenance,
      scriptText: before.scriptText, target: ref, validated: null, dirty: true });
    expect(first.getSnapshot()).toBe(before);
  });
  it("rejects malformed or stale workspace imports without partial locale replacement", () => {
    const session = createPronunciationEditorSession(catalog); session.edit({ dictionary, target: ref });
    const before = session.getSnapshot(), workspace = session.workspace();
    expect(session.importWorkspace(workspace, before.revision - 1)).toBe(false);
    expect(session.importWorkspace(workspace.replace('"status": "draft"', '"status": "approved"'), before.revision)).toBe(false);
    expect(session.importWorkspace('{"schemaVersion":1,"schemaVersion":1}', before.revision)).toBe(false);
    expect(session.getSnapshot()).toBe(before);
  });
  it("invalidates accepted preview on canonical name changes while retaining editor text", async () => {
    const session = createPronunciationEditorSession(catalog); session.edit({ dictionary, target: ref });
    expect(await session.preview(validPreview)).toBe(true);
    session.setCatalog([{ ...catalog[0], spelling: { ...catalog[0].spelling, en: "Changed canonical name" } }]);
    expect(session.getSnapshot()).toMatchObject({ dictionary, validated: null, busy: false, dirty: true });
    const port = vi.fn(validPreview);
    expect(await session.preview(port)).toBe(false); expect(port).not.toHaveBeenCalled();
  });
  it("refuses unknown catalogs and bad source hashes before calling any server port", async () => {
    const unavailable = createPronunciationEditorSession(null), port = vi.fn(validPreview);
    expect(await unavailable.preview(port)).toBe(false);
    const session = createPronunciationEditorSession(catalog); session.edit({ dictionary, target: ref, provenance: "{}", scriptText: "unbound script" });
    expect(await session.preview(port)).toBe(false); expect(port).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({ dictionary, provenance: "{}", scriptText: "unbound script", validated: null });
  });
  it("reactivates the original form owner without replaying a retired preview", async () => {
    const session = createPronunciationEditorSession(catalog), reply = held<unknown>();
    session.edit({ dictionary, target: ref });
    let request = ""; const pending = session.preview(async value => { request = value; return reply.promise; });
    session.dispose(); session.activate(); reply.resolve(previewPronunciationRequest(request, catalog));
    expect(await pending).toBe(false); expect(session.getSnapshot()).toMatchObject({ dictionary, busy: false, validated: null });
    expect(await session.preview(validPreview)).toBe(true);
  });
  it("recovers its own boundary workspace with escaped unfinished RU/EN and refuses field or envelope overflow", () => {
    const first = createPronunciationEditorSession(catalog), prefix = "RU/EN unfinished\n";
    const raw = prefix + "\u0000".repeat(PRONUNCIATION_DRAFT_MAX_BYTES - new TextEncoder().encode(prefix).length);
    first.edit({ dictionary: raw, provenance: "\u0000".repeat(PRONUNCIATION_SOURCE_MAX_BYTES),
      scriptText: "\n" + "\u0000".repeat(PRONUNCIATION_SOURCE_MAX_BYTES - 1), target: ref });
    const workspace = first.workspace(), size = new TextEncoder().encode(workspace).length;
    expect(size).toBeGreaterThan(PRONUNCIATION_DRAFT_MAX_BYTES); expect(size).toBeLessThanOrEqual(PRONUNCIATION_ENVELOPE_MAX_BYTES);
    const second = createPronunciationEditorSession(catalog);
    expect(second.importWorkspace(workspace, 0)).toBe(true);
    expect(second.getSnapshot()).toMatchObject({ dictionary: raw, provenance: first.getSnapshot().provenance,
      scriptText: first.getSnapshot().scriptText, target: ref, validated: null, narrationDraft: null, dirty: true });
    const before = second.getSnapshot(), overflow = JSON.parse(workspace); overflow.dictionary += "x";
    expect(second.importWorkspace(JSON.stringify(overflow), before.revision)).toBe(false);
    expect(second.getSnapshot()).toBe(before);
    expect(parsePronunciationEnvelope(" ".repeat(PRONUNCIATION_ENVELOPE_MAX_BYTES + 1))).toBeNull();
    expect(parsePronunciationEnvelope('{"dictionary":"a","dictio\\u006eary":"b"}')).toBeNull();
  });
  it("validates a large escaped bilingual dictionary through the current preview while retaining raw input", async () => {
    const many = Array.from({ length: 58 }, (_, i) => ({ ref: { ...ref, writerId: "Writer." + i },
      spelling: { ru: "Тест " + i, en: "Synthetic " + i } }));
    const notes = '"\\'.repeat(1024);
    const raw = JSON.stringify({ schemaVersion: 1, kind: "literary-planet-pronunciation-dictionary-v1", status: "draft", version: 1,
      entries: many.map(row => ({ ...row, ru: { phonetic: "RU test", notes }, en: { phonetic: "EN test", notes } })) });
    expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(PRONUNCIATION_DRAFT_MAX_BYTES);
    const session = createPronunciationEditorSession(many); session.edit({ dictionary: raw, target: many[0].ref });
    let requestSize = 0;
    expect(await session.preview(async request => {
      requestSize = new TextEncoder().encode(request).length;
      return previewPronunciationRequest(request, many);
    })).toBe(true);
    expect(requestSize).toBeGreaterThan(PRONUNCIATION_DRAFT_MAX_BYTES);
    expect(session.getSnapshot()).toMatchObject({ dictionary: raw, dirty: true, busy: false });
    expect(session.getSnapshot().validated?.entries).toHaveLength(58);
  });
  it("uses exact published relationship IDs and omits missing bilingual labels without inventing them", () => {
    const result = pronunciationCatalogFromJourneyCatalog({ countries: [{ id: "Country.One", label: { ru: "Страна", en: "Country" },
      writers: [{ id: "Writer.One", label: catalog[0].spelling, works: [{ id: "Work.One", label: { ru: "Книга", en: "Book" } }] },
        { id: "Writer.NoEnglish", label: { ru: "Писатель", en: "" }, works: [] }] }] });
    expect(result?.map(row => row.ref)).toEqual([{ kind: "country", countryId: "Country.One" }, ref,
      { kind: "work", countryId: "Country.One", writerId: "Writer.One", workId: "Work.One" }]);
    expect(result?.some(row => row.spelling.en === "Писатель")).toBe(false);
  });
});
