import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function readNormalizedSource(url: URL) {
  return readFileSync(url, "utf8").replace(/\r\n?/gu, "\n");
}

const pageSource = readNormalizedSource(new URL("./page.tsx", import.meta.url));
const actionsSource = readNormalizedSource(new URL("./actions.ts", import.meta.url));
const autoTranslationSource = readNormalizedSource(
  new URL("../../../lib/auto-translate-writer-biography.ts", import.meta.url)
);
const adminWrangler = JSON.parse(
  readFileSync(new URL("../../../wrangler.jsonc", import.meta.url), "utf8")
);
const biographyActionSource = actionsSource.slice(
  actionsSource.indexOf("export async function saveWriterBiographyAction"),
  actionsSource.indexOf("export async function publishEditorialDatabaseAction")
);

describe("structured writer biography editor integration", () => {
  it("exposes editable RU and EN text with status, provenance and rights", () => {
    expect(pageSource).toContain("action={saveWriterBiographyAction}");
    for (const locale of ["ru", "en"]) {
      expect(pageSource).toContain("`${locale}_text`");
      expect(pageSource).toContain("`${locale}_status`");
      expect(pageSource).toContain("`${locale}_method`");
      expect(pageSource).toContain("`${locale}_reviewed_at`");
      expect(pageSource).toContain("`${locale}_source_text_rights`");
      expect(pageSource).toContain("`${locale}_sources_json`");
    }
    expect(pageSource).toContain("Строгий отбор для публикации");
    expect(pageSource).toContain('name="expected_updated_at"');
    expect(pageSource).toContain("overrideOwnsLocaleMap");
    expect(pageSource).toContain('name="confirm_manual_en_against_ru"');
    expect(pageSource).toContain(
      'Object.hasOwn(\n    overrideFields,\n    "biographyTranslations"'
    );
  });

  it("saves through the pure model, CAS, audit and public-build path", () => {
    expect(biographyActionSource).toContain("buildWriterBiographySaveModel({");
    expect(biographyActionSource).toContain('.from("writer_profile_overrides")');
    expect(biographyActionSource).toContain('.eq("updated_at", existing.updated_at)');
    expect(biographyActionSource).toContain("await ensureWriterEnglishBiography({");
    expect(biographyActionSource).toContain(
      "replaceEnglishTombstone: model.invalidatedMachineEnglish"
    );
    expect(biographyActionSource).toContain(
      'action: "writer_profile.biography.saved"'
    );
    expect(biographyActionSource).toContain(
      'reason: "writer_profile.biography.saved"'
    );
    expect(biographyActionSource).toContain("machineEnglishInvalidated");
    expect(biographyActionSource).toContain(
      "manualEnglishConfirmedAgainstRussianChange"
    );
    expect(actionsSource).toContain("resolveEditorialSourceFields(");
    expect(actionsSource).toContain("preserveProtectedEditorialField(");
    expect(actionsSource).toContain("edit.fields");
    expect(actionsSource).not.toContain("completeSource.fields");
    expect(actionsSource).toContain(
      "existing && expectedUpdatedAt !== existing.updated_at"
    );
    expect(actionsSource).toContain("!existing && Boolean(expectedUpdatedAt)");
  });

  it("durably queues RU before AI and queues a second release only for new EN", () => {
    const saveAudit = biographyActionSource.indexOf(
      'action: "writer_profile.biography.saved"'
    );
    const russianPublication = biographyActionSource.indexOf(
      'reason: "writer_profile.biography.saved"'
    );
    const translation = biographyActionSource.indexOf(
      "const translation = await ensureWriterEnglishBiography({"
    );
    const englishPublication = biographyActionSource.indexOf(
      'reason: "writer_profile.biography.english_generated"'
    );

    for (const position of [
      saveAudit,
      russianPublication,
      translation,
      englishPublication,
    ]) {
      expect(position).toBeGreaterThanOrEqual(0);
    }
    expect(saveAudit).toBeLessThan(translation);
    expect(russianPublication).toBeLessThan(translation);
    expect(englishPublication).toBeGreaterThan(translation);
    expect(biographyActionSource).toContain(
      'if (translation.state === "translated")'
    );
  });

  it("keeps profile auto-translation paused and tells editors the truth", () => {
    expect(adminWrangler.vars.OPENAI_AUTO_TRANSLATE_PROFILES).toBe("false");
    expect(pageSource).toContain("adminEnv.openAiAutoTranslateProfiles");
    expect(pageSource).toContain("Автоматический перевод биографий сейчас приостановлен");
    expect(pageSource).toContain("запускает новый двухпроходный перевод");
  });

  it("renders every automatic translation outcome", () => {
    for (const state of [
      "translated",
      "current",
      "manual",
      "skipped",
      "not-configured",
      "conflict",
      "failed",
    ]) {
      expect(pageSource).toContain(state);
    }
  });

  it("runs generated EN through the same strict text gate as manual saves", () => {
    expect(autoTranslationSource).toContain(
      "assertWriterBiographyEnglishFidelity({"
    );
    expect(autoTranslationSource).toContain("review: true");
    expect(autoTranslationSource).not.toContain("review: runtime.twoPassReview");
    expect(autoTranslationSource).toContain("if (!translated.reviewerModel)");
    expect(autoTranslationSource).toContain(
      "writerBiographySourceIdentity(effectiveFields, input.writerId)"
    );
    expect(autoTranslationSource).toContain(
      'englishOwnership === "tombstone"'
    );
    expect(autoTranslationSource).toContain(
      'if (englishOwnership === "human")'
    );
  });
});
