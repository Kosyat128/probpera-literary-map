import { contentPackageCanonicalJson, contentPackageHash } from "./contentPackageProtocol.mjs";

// Draft authoring data only. Neither a dictionary nor this export attests
// pronunciation, rights, script review, a voice, child policy or native admission.
export const PRONUNCIATION_DRAFT_MAX_BYTES = 512 * 1024;
export const PRONUNCIATION_SOURCE_MAX_BYTES = 64 * 1024;
// JSON can encode one raw UTF8 byte as six ASCII escape bytes. Metadata
// reserve includes the strict three-ID canonical target and envelope keys.
export const PRONUNCIATION_ENVELOPE_MAX_BYTES =
  6 * (PRONUNCIATION_DRAFT_MAX_BYTES + 2 * PRONUNCIATION_SOURCE_MAX_BYTES) + 16 * 1024;
const encoder = new TextEncoder();
const locales = ["ru", "en"];
const identifier = value => typeof value === "string" && value.length > 0 && value.length <= 256
  && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
const positive = value => Number.isSafeInteger(value) && !Object.is(value, -0) && value > 0 && value < Number.MAX_SAFE_INTEGER;
const hex = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const nativeId = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const text = (value, max, empty = false, multiline = false) => typeof value === "string"
  && value.length <= max && (empty || value.length > 0) && value.trim() === value
  && !(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(value);
function record(value) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.length > 32 || keys.some(key => typeof key !== "string" || !descriptors[key].enumerable
      || !Object.prototype.hasOwnProperty.call(descriptors[key], "value"))) return null;
    const copy = Object.create(null);
    for (const key of keys) copy[key] = descriptors[key].value;
    return Object.freeze(copy);
  } catch { return null; }
}
const exact = (row, keys) => !!row && Object.keys(row).length === keys.length
  && keys.every(key => Object.prototype.hasOwnProperty.call(row, key));
function array(value, maximum) {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value), size = descriptors.length?.value;
    if (!Number.isSafeInteger(size) || size < 0 || size > maximum || Reflect.ownKeys(descriptors).length !== size + 1) return null;
    const copy = [];
    for (let i = 0; i < size; i++) {
      const entry = descriptors[String(i)];
      if (!entry?.enumerable || !Object.prototype.hasOwnProperty.call(entry, "value")) return null;
      copy.push(entry.value);
    }
    return copy;
  } catch { return null; }
}
/** Reject duplicate keys, including escaped aliases, before interpreting a file. */
function parseBoundedPronunciationJson(serialized, maximum) {
  try {
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > PRONUNCIATION_ENVELOPE_MAX_BYTES
      || typeof serialized !== "string" || !serialized.length || encoder.encode(serialized).length > maximum) return null;
    const parsed = JSON.parse(serialized), stack = []; let tokens = 0;
    for (const match of serialized.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],]/gu)) {
      if (++tokens > 12000) return null;
      const token = match[0], current = stack[stack.length - 1];
      if (token === "{") stack.push({ keys: new Set(), expectingKey: true });
      else if (token === "[") stack.push(null);
      else if (token === "}" || token === "]") stack.pop();
      else if (token === "," && current) current.expectingKey = true;
      else if (token.startsWith('"') && current?.expectingKey) {
        const key = JSON.parse(token);
        if (current.keys.has(key)) return null;
        current.keys.add(key); current.expectingKey = false;
      }
      if (stack.length > 12) return null;
    }
    contentPackageCanonicalJson(parsed); return parsed;
  } catch { return null; }
}
export function parsePronunciationJson(serialized, maximum = PRONUNCIATION_DRAFT_MAX_BYTES) {
  if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > PRONUNCIATION_DRAFT_MAX_BYTES) return null;
  return parseBoundedPronunciationJson(serialized, maximum);
}
export function parsePronunciationEnvelope(serialized) {
  return parseBoundedPronunciationJson(serialized, PRONUNCIATION_ENVELOPE_MAX_BYTES);
}
export function decodePronunciationReference(raw) {
  const row = record(raw);
  if (!row || !["country", "writer", "work"].includes(row.kind)) return null;
  const keys = row.kind === "country" ? ["kind", "countryId"]
    : row.kind === "writer" ? ["kind", "countryId", "writerId"] : ["kind", "countryId", "writerId", "workId"];
  return exact(row, keys) && keys.filter(key => key !== "kind").every(key => identifier(row[key])) ? row : null;
}
export function pronunciationReferenceKey(raw) {
  const ref = decodePronunciationReference(raw);
  return ref ? contentPackageCanonicalJson(ref) : null;
}
function spelling(raw) {
  const row = record(raw);
  return exact(row, locales) && locales.every(locale => text(row[locale], 512)) ? row : null;
}
export function decodePronunciationCatalog(raw) {
  const rows = array(raw, 32768); if (!rows) return null;
  const copied = [], keys = new Set();
  for (const value of rows) {
    const row = record(value), ref = row && decodePronunciationReference(row.ref), names = row && spelling(row.spelling);
    if (!exact(row, ["ref", "spelling"]) || !ref || !names) return null;
    const key = pronunciationReferenceKey(ref); if (keys.has(key)) return null;
    keys.add(key); copied.push(Object.freeze({ ref, spelling: names }));
  }
  return Object.freeze(copied);
}
function annotation(raw) {
  const row = record(raw);
  return exact(row, ["phonetic", "notes"]) && text(row.phonetic, 160) && text(row.notes, 2048, true, true) ? row : null;
}
export function decodePronunciationDictionary(raw, currentCatalog) {
  try {
    const root = record(raw), catalog = decodePronunciationCatalog(currentCatalog);
    if (!exact(root, ["schemaVersion", "kind", "status", "version", "entries"]) || root.schemaVersion !== 1
      || root.kind !== "literary-planet-pronunciation-dictionary-v1" || root.status !== "draft" || !positive(root.version) || !catalog) return null;
    const rows = array(root.entries, 256); if (!rows) return null;
    const current = new Map(catalog.map(entry => [pronunciationReferenceKey(entry.ref), entry])), keys = new Set(), entries = [];
    for (const value of rows) {
      const row = record(value), ref = row && decodePronunciationReference(row.ref), names = row && spelling(row.spelling);
      const ru = row && annotation(row.ru), en = row && annotation(row.en), key = ref && pronunciationReferenceKey(ref), expected = current.get(key);
      if (!exact(row, ["ref", "spelling", "ru", "en"]) || !ref || !names || !ru || !en || !expected || keys.has(key)
        || names.ru !== expected.spelling.ru || names.en !== expected.spelling.en) return null;
      keys.add(key); entries.push(Object.freeze({ ref, spelling: names, ru, en }));
    }
    return Object.freeze({ schemaVersion: 1, kind: root.kind, status: "draft", version: root.version, entries: Object.freeze(entries) });
  } catch { return null; }
}
export function parsePronunciationDictionary(serialized, catalog) {
  return decodePronunciationDictionary(parsePronunciationJson(serialized), catalog);
}
/** Shared structural source-field contract; assets, signed source hash, decoded
 * PCM duration, script ownership and review still belong to the media producer. */
export function decodeNarrationProvenanceFields(raw) {
  const row = record(raw);
  const fields = ["schemaVersion", "kind", "scriptId", "scriptChecksum", "performerId", "licensorId", "locale", "accent",
    "pronunciationNotes", "durationMs", "loudnessReport", "qualityReport", "reducedAudioFallback", "voiceKind"];
  return exact(row, fields) && row.schemaVersion === 1 && row.kind === "literary-planet-child-narration-provenance-v1"
    && nativeId(row.scriptId) && hex(row.scriptChecksum) && nativeId(row.performerId) && nativeId(row.licensorId)
    && locales.includes(row.locale) && text(row.accent, 96) && text(row.pronunciationNotes, 8192, false, true)
    && text(row.loudnessReport, 8192, false, true) && text(row.qualityReport, 8192, false, true)
    && Number.isSafeInteger(row.durationMs) && !Object.is(row.durationMs, -0) && row.durationMs >= 1 && row.durationMs <= 60000
    && row.reducedAudioFallback === "same-locale-text" && ["human-original", "human-licensed"].includes(row.voiceKind) ? row : null;
}
/** Produces review input, never directly accepted production provenance. Existing
 * notes and every script/performer/licensor field survive. No source pin is updated. */
export function createNarrationPronunciationDraft(dictionaryRaw, currentCatalog, referenceRaw, provenanceSerialized, scriptText) {
  try {
    const dictionary = decodePronunciationDictionary(dictionaryRaw, currentCatalog), ref = decodePronunciationReference(referenceRaw);
    const source = decodeNarrationProvenanceFields(parsePronunciationJson(provenanceSerialized, 65536));
    if (!dictionary || !ref || !source || typeof scriptText !== "string" || !scriptText.length
      || encoder.encode(scriptText).length > 65536 || contentPackageHash(scriptText) !== source.scriptChecksum) return null;
    const entry = dictionary.entries.find(item => pronunciationReferenceKey(item.ref) === pronunciationReferenceKey(ref));
    if (!entry || !scriptText.includes(entry.spelling[source.locale])) return null;
    const note = entry.spelling[source.locale] + " — " + entry[source.locale].phonetic
      + (entry[source.locale].notes ? "\n" + entry[source.locale].notes : "");
    const notes = source.pronunciationNotes + "\n" + note;
    if (!text(notes, 8192, false, true)) return null;
    const provenance = Object.freeze({ ...source, pronunciationNotes: notes });
    return Object.freeze({
      schemaVersion: 1, kind: "literary-planet-narration-pronunciation-draft-v1", status: "draft",
      ref, dictionaryChecksum: contentPackageHash(contentPackageCanonicalJson(dictionary)),
      originalProvenanceChecksum: contentPackageHash(provenanceSerialized), locale: source.locale,
      provenance, humanReviewed: false, narrationApproved: false, childApproved: false, releaseReady: false,
    });
  } catch { return null; }
}
