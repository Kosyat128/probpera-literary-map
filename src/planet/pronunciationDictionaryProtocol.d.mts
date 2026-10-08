import type { ContentEntityRef } from "./contentExportTypes";
export type PronunciationReference = Readonly<ContentEntityRef>;
export type PronunciationSpelling = Readonly<{ ru: string; en: string }>;
export type PronunciationCatalog = readonly Readonly<{ ref: PronunciationReference; spelling: PronunciationSpelling }>[];
export type PronunciationAnnotation = Readonly<{ phonetic: string; notes: string }>;
export type PronunciationEntry = Readonly<{
  ref: PronunciationReference; spelling: PronunciationSpelling;
  ru: PronunciationAnnotation; en: PronunciationAnnotation;
}>;
export type PronunciationDictionary = Readonly<{
  schemaVersion: 1; kind: "literary-planet-pronunciation-dictionary-v1"; status: "draft"; version: number;
  entries: readonly PronunciationEntry[];
}>;
export type NarrationProvenanceFields = Readonly<{
  schemaVersion: 1; kind: "literary-planet-child-narration-provenance-v1";
  scriptId: string; scriptChecksum: string; performerId: string; licensorId: string; locale: "ru" | "en"; accent: string;
  pronunciationNotes: string; durationMs: number; loudnessReport: string; qualityReport: string;
  reducedAudioFallback: "same-locale-text"; voiceKind: "human-original" | "human-licensed";
}>;
export type NarrationPronunciationDraft = Readonly<{
  schemaVersion: 1; kind: "literary-planet-narration-pronunciation-draft-v1"; status: "draft";
  ref: PronunciationReference; dictionaryChecksum: string; originalProvenanceChecksum: string; locale: "ru" | "en";
  provenance: NarrationProvenanceFields; humanReviewed: false; narrationApproved: false; childApproved: false; releaseReady: false;
}>;
export const PRONUNCIATION_DRAFT_MAX_BYTES: number;
export const PRONUNCIATION_SOURCE_MAX_BYTES: number;
export const PRONUNCIATION_ENVELOPE_MAX_BYTES: number;
export function parsePronunciationEnvelope(serialized: unknown): unknown | null;
export function parsePronunciationJson(serialized: unknown, maximum?: number): unknown | null;
export function decodePronunciationReference(raw: unknown): PronunciationReference | null;
export function pronunciationReferenceKey(raw: unknown): string | null;
export function decodePronunciationCatalog(raw: unknown): PronunciationCatalog | null;
export function decodePronunciationDictionary(raw: unknown, catalog: unknown): PronunciationDictionary | null;
export function parsePronunciationDictionary(serialized: unknown, catalog: unknown): PronunciationDictionary | null;
export function decodeNarrationProvenanceFields(raw: unknown): NarrationProvenanceFields | null;
export function createNarrationPronunciationDraft(dictionary: unknown, catalog: unknown, ref: unknown,
  provenanceSerialized: unknown, scriptText: unknown): NarrationPronunciationDraft | null;
