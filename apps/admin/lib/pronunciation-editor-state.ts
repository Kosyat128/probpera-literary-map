import { contentPackageCanonicalJson, contentPackageHash } from "../../../src/planet/contentPackageProtocol.mjs";
import {
  PRONUNCIATION_DRAFT_MAX_BYTES, PRONUNCIATION_SOURCE_MAX_BYTES, decodePronunciationCatalog, parsePronunciationDictionary, parsePronunciationEnvelope,
  pronunciationReferenceKey, createNarrationPronunciationDraft,
  type PronunciationCatalog, type PronunciationDictionary, type PronunciationReference, type NarrationPronunciationDraft,
} from "../../../src/planet/pronunciationDictionaryProtocol.mjs";
import type { JourneyDraftCatalog } from "./booky-journey-draft";

export type PronunciationPreviewPort = (serializedRequest: string) => Promise<unknown>;
export type PronunciationEditorSnapshot = Readonly<{
  dictionary: string; provenance: string; scriptText: string; target: PronunciationReference | null;
  revision: number; dirty: boolean; busy: boolean; error: string;
  validated: PronunciationDictionary | null; narrationDraft: NarrationPronunciationDraft | null;
}>;
const seed = JSON.stringify({ schemaVersion: 1, kind: "literary-planet-pronunciation-dictionary-v1", status: "draft", version: 1, entries: [] }, null, 2);
const same = (a: unknown, b: unknown) => contentPackageCanonicalJson(a) === contentPackageCanonicalJson(b);
const byteLength = (value: string) => new TextEncoder().encode(value).length;

/** Reuse exact current public relationships; missing bilingual source spelling
 * is ineligible, never translated or synthesized by this adapter. */
export function pronunciationCatalogFromJourneyCatalog(source: JourneyDraftCatalog): PronunciationCatalog | null {
  const rows: { ref: PronunciationReference; spelling: { ru: string; en: string } }[] = [];
  const add = (ref: PronunciationReference, label: { ru: string; en: string }) => {
    if (label.ru && label.en) rows.push({ ref, spelling: { ru: label.ru, en: label.en } });
  };
  for (const country of source.countries) {
    add({ kind: "country", countryId: country.id }, country.label);
    for (const writer of country.writers) {
      add({ kind: "writer", countryId: country.id, writerId: writer.id }, writer.label);
      for (const work of writer.works)
        add({ kind: "work", countryId: country.id, writerId: writer.id, workId: work.id }, work.label);
    }
  }
  const parsed = decodePronunciationCatalog(rows);
  // Next server components/actions require ordinary serializable objects.
  return parsed ? JSON.parse(contentPackageCanonicalJson(parsed)) as PronunciationCatalog : null;
}

export function previewPronunciationRequest(serialized: unknown, catalog: PronunciationCatalog) {
  const request = parsePronunciationEnvelope(serialized);
  if (!request || typeof request !== "object" || Array.isArray(request)) return null;
  const row = request as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "dictionary,provenance,scriptText,target"
    || typeof row.dictionary !== "string" || typeof row.provenance !== "string" || typeof row.scriptText !== "string"
    || byteLength(row.dictionary) > PRONUNCIATION_DRAFT_MAX_BYTES
    || byteLength(row.provenance) > PRONUNCIATION_SOURCE_MAX_BYTES || byteLength(row.scriptText) > PRONUNCIATION_SOURCE_MAX_BYTES) return null;
  const dictionary = parsePronunciationDictionary(row.dictionary, catalog);
  if (!dictionary) return null;
  const needsNarration = row.provenance.length > 0 || row.scriptText.length > 0;
  const narrationDraft = needsNarration
    ? createNarrationPronunciationDraft(dictionary, catalog, row.target, row.provenance, row.scriptText) : null;
  if (needsNarration && !narrationDraft) return null;
  return { ok: true as const, dictionary, dictionaryChecksum: contentPackageHash(contentPackageCanonicalJson(dictionary)), narrationDraft };
}

/** Memory-only form owner. Only a matching current server response enables
 * exports. A refused/late response cannot replace text or claim a saved draft. */
export function createPronunciationEditorSession(initialCatalog: unknown) {
  let catalog = decodePronunciationCatalog(initialCatalog), active = true, sequence = 0;
  let state: PronunciationEditorSnapshot = Object.freeze({
    dictionary: seed, provenance: "", scriptText: "", target: null, revision: 0, dirty: false, busy: false,
    error: catalog ? "" : "Канонический каталог недоступен.", validated: null, narrationDraft: null,
  });
  const listeners = new Set<() => void>();
  const publish = (next: PronunciationEditorSnapshot) => { state = Object.freeze(next); for (const fn of listeners) fn(); };
  const invalidate = (values: Partial<PronunciationEditorSnapshot>) => {
    ++sequence; publish({ ...state, ...values, revision: state.revision + 1, busy: false, validated: null, narrationDraft: null });
  };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    edit(values: Pick<Partial<PronunciationEditorSnapshot>, "dictionary" | "provenance" | "scriptText" | "target">) {
      if (!active) return;
      const next: { dictionary?: string; provenance?: string; scriptText?: string; target?: PronunciationReference | null } = {};
      for (const key of ["dictionary", "provenance", "scriptText"] as const)
        if (Object.prototype.hasOwnProperty.call(values, key) && typeof values[key] === "string") next[key] = values[key];
      if (Object.prototype.hasOwnProperty.call(values, "target"))
        next.target = values.target === null ? null : catalog?.find(item => pronunciationReferenceKey(item.ref) === pronunciationReferenceKey(values.target))?.ref ?? null;
      invalidate({ ...next, dirty: true, error: "" });
    },
    setCatalog(raw: unknown) {
      if (!active) return;
      const next = decodePronunciationCatalog(raw);
      if (catalog && next && same(catalog, next)) return;
      catalog = next; invalidate({ error: next ? "Каталог изменился. Форма сохранена; повторите проверку." : "Каталог недоступен. Форма сохранена." });
    },
    importWorkspace(serialized: string, expectedRevision: number): boolean {
      if (!active || state.revision !== expectedRevision) return false;
      const value = parsePronunciationEnvelope(serialized);
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      const row = value as Record<string, unknown>;
      if (Object.keys(row).sort().join(",") !== "dictionary,kind,provenance,schemaVersion,scriptText,status,target"
        || row.schemaVersion !== 1 || row.kind !== "literary-planet-pronunciation-workspace-v1" || row.status !== "draft"
        || typeof row.dictionary !== "string" || typeof row.provenance !== "string" || typeof row.scriptText !== "string"
        || byteLength(row.dictionary) > PRONUNCIATION_DRAFT_MAX_BYTES || byteLength(row.provenance) > PRONUNCIATION_SOURCE_MAX_BYTES || byteLength(row.scriptText) > PRONUNCIATION_SOURCE_MAX_BYTES) return false;
      // Invalid/stale raw dictionary text remains recoverable work, never a validated record.
      const target = row.target === null ? null : catalog?.find(item => pronunciationReferenceKey(item.ref) === pronunciationReferenceKey(row.target))?.ref;
      if (row.target !== null && !target) return false;
      invalidate({ dictionary: row.dictionary, provenance: row.provenance, scriptText: row.scriptText,
        target: target ?? null, dirty: true, error: "" }); return true;
    },
    workspace() {
      return JSON.stringify({ schemaVersion: 1, kind: "literary-planet-pronunciation-workspace-v1", status: "draft",
        dictionary: state.dictionary, provenance: state.provenance, scriptText: state.scriptText, target: state.target }, null, 2) + "\n";
    },
    async preview(port: PronunciationPreviewPort): Promise<boolean> {
      if (!active || state.busy || !catalog) return false;
      const original = state, originalCatalog = catalog, attempt = ++sequence;
      const serialized = JSON.stringify({ dictionary: original.dictionary, provenance: original.provenance,
        scriptText: original.scriptText, target: original.target });
      const expected = previewPronunciationRequest(serialized, originalCatalog);
      if (!expected) { publish({ ...state, error: "Проверьте RU/EN, каноническое написание, источник и хеш сценария.", validated: null, narrationDraft: null }); return false; }
      publish({ ...state, busy: true, error: "", validated: null, narrationDraft: null });
      try {
        const reply = await port(serialized);
        if (!active || sequence !== attempt || state.revision !== original.revision || catalog !== originalCatalog) return false;
        if (!same(reply, expected)) throw new Error("Current draft preview refused");
        publish({ ...state, busy: false, validated: expected.dictionary, narrationDraft: expected.narrationDraft, error: "" }); return true;
      } catch {
        if (active && sequence === attempt && state.revision === original.revision)
          publish({ ...state, busy: false, error: "Серверная проверка недоступна или отклонена. Форма сохранена.", validated: null, narrationDraft: null });
        return false;
      }
    },

    activate() {
      if (!active) { active = true; ++sequence; publish({ ...state, busy: false, validated: null, narrationDraft: null }); }
    },
    dispose() { active = false; ++sequence; listeners.clear(); },
  };
}
