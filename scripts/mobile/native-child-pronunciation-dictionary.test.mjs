import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createChildNativeNarrationPronunciationDraft, validateChildNativeNarrationProvenance } from "./native-child-media-assets.mjs";

// Synthetic source fields and phonetic strings attest no actual recording,
// human pronunciation, licensed rights, signed reviewer or native acceptance.
const sha = value => createHash("sha256").update(value).digest("hex");
const ref = { kind: "writer", countryId: "Country.One", writerId: "Writer.One" };
const catalog = [{ ref, spelling: { ru: "Тестовый писатель", en: "Synthetic Writer" } }];
const dictionary = { schemaVersion: 1, kind: "literary-planet-pronunciation-dictionary-v1", status: "draft", version: 1,
  entries: [{ ...catalog[0], ru: { phonetic: "RU synthetic note", notes: "" }, en: { phonetic: "EN synthetic note", notes: "" } }] };
const encode = value => Buffer.from(JSON.stringify(value) + "\n");
function source(locale = "en") { return { schemaVersion: 1, kind: "literary-planet-child-narration-provenance-v1",
  scriptId: "Synthetic.Script", scriptChecksum: sha(catalog[0].spelling[locale]), performerId: "Synthetic.Performer",
  licensorId: "Synthetic.Licensor", locale, accent: "Synthetic documented accent", pronunciationNotes: "Original notes",
  durationMs: 20, loudnessReport: "Synthetic report", qualityReport: "Synthetic report",
  reducedAudioFallback: "same-locale-text", voiceKind: "human-original" }; }
function asset(bytes, original) { return { mime: "audio/wav", payload: { role: "narration", scriptId: original.scriptId,
  scriptChecksum: original.scriptChecksum, performerId: original.performerId, qualityChecksum: sha(bytes) } }; }

describe("pronunciation draft connection to native narration producer", () => {
  it("shares strict source fields while retaining existing locale and exact raw provenance pin checks", () => {
    for (const locale of ["ru", "en"]) {
      const original = source(locale), bytes = encode(original), current = asset(bytes, original);
      expect(validateChildNativeNarrationProvenance(bytes, current, locale, 20)).toEqual(original);
      expect(() => validateChildNativeNarrationProvenance(Buffer.concat([bytes, Buffer.from(" ")]), current, locale, 20)).toThrow();
      expect(() => validateChildNativeNarrationProvenance(bytes, current, locale === "en" ? "ru" : "en", 20)).toThrow();
    }
  });
  it("exports notes through the actual producer as unapproved draft without rebinding the signed asset", () => {
    const original = source(), bytes = encode(original), current = asset(bytes, original);
    const draft = createChildNativeNarrationPronunciationDraft(dictionary, catalog, ref, bytes.toString("utf8"), catalog[0].spelling.en);
    expect(draft).toMatchObject({ status: "draft", humanReviewed: false, narrationApproved: false, releaseReady: false });
    expect(draft.provenance).toEqual({ ...original, pronunciationNotes: "Original notes\nSynthetic Writer — EN synthetic note" });
    expect(current.payload.qualityChecksum).toBe(sha(bytes));
    const wrapper = encode(draft);
    expect(() => validateChildNativeNarrationProvenance(wrapper, asset(wrapper, original), "en", 20)).toThrow();
    expect(() => validateChildNativeNarrationProvenance(encode(draft.provenance), current, "en", 20)).toThrow();
  });
  it("retains native script performer and actual decoded duration refusals after the shared codec insertion", () => {
    const original = source();
    for (const change of [{ scriptId: "Other.Script" }, { scriptChecksum: "b".repeat(64) },
      { performerId: "Other.Performer" }, { durationMs: 23 }]) {
      const bytes = encode({ ...original, ...change });
      expect(() => validateChildNativeNarrationProvenance(bytes, asset(bytes, original), "en", 20)).toThrow();
    }
  });
  it("retains human voice licensor and report refusals without accepting approval flags", () => {
    const original = source();
    for (const change of [{ voiceKind: "cloned-writer" }, { licensorId: "" }, { qualityReport: "" }, { pronunciationNotes: "" }, { approved: true }]) {
      const bytes = encode({ ...original, ...change });
      expect(() => validateChildNativeNarrationProvenance(bytes, asset(bytes, original), "en", 20)).toThrow();
    }
  });
});
