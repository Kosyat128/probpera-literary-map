import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync(
  path.join(
    process.cwd(),
    "apps/admin/app/(dashboard)/articles/atomic-standard-save-action.ts"
  ),
  "utf8"
);
const wrapperSource = readFileSync(
  path.join(
    process.cwd(),
    "apps/admin/app/(dashboard)/articles/save-article-action.ts"
  ),
  "utf8"
);
const publicationSource = readFileSync(
  path.join(process.cwd(), "apps/admin/lib/publication.ts"),
  "utf8"
);
const editAdapterSource = readFileSync(
  path.join(
    process.cwd(),
    "apps/admin/app/(dashboard)/articles/edit/page.tsx"
  ),
  "utf8"
);
const editPageSource = readFileSync(
  path.join(
    process.cwd(),
    "apps/admin/app/(dashboard)/articles/[id]/page.tsx"
  ),
  "utf8"
);

describe("canonical atomic article save", () => {
  it("routes ordinary, manual-English and auto-translated saves through one action", () => {
    expect(wrapperSource).toContain("saveStandardArticleAtomically");
    expect(wrapperSource).not.toContain("legacySaveArticleAction");
    expect(wrapperSource).not.toContain("saveAutoTranslatedArticleAtomically");
    expect(wrapperSource).not.toContain("atomicPersistenceAvailable");
  });

  it("keeps English optional and falls back to a Russian-only release", () => {
    const translationCall = wrapperSource.indexOf(
      "translateArticleSourceToEnglish({"
    );
    expect(wrapperSource).toContain(
      'const englishReleaseRequested = formData.get("english_enabled") === "on"'
    );
    expect(wrapperSource.indexOf("!englishReleaseRequested")).toBeLessThan(
      translationCall
    );
    expect(wrapperSource).toContain('formData.delete("english_enabled")');
    expect(wrapperSource).toContain(
      'formData.set("automatic_translation_deferred", "1")'
    );
    expect(wrapperSource).toContain(
      'formData.set("skip_automatic_translation", "1")'
    );
    expect(actionSource).toContain(
      "skipAutoTranslation: skipAutomaticTranslation"
    );
    expect(publicationSource).toContain("!skipAutoTranslation &&");
    expect(actionSource).toContain(
      'translation: automaticTranslationDeferred ? "deferred" : null'
    );
    expect(editAdapterSource).toContain("translation,");
    expect(editPageSource).toContain('query.translation === "deferred"');
  });

  it("uses only reconciled atomic RPCs as persistence paths", () => {
    expect(actionSource).toContain("saveArticleBundleRpc(supabase");
    expect(actionSource).toContain("saveArticleWorkingDraftRpc(supabase");
    expect(actionSource).toContain("promoteArticleWorkingDraftRpc(supabase");
    expect(actionSource).not.toContain("isArticleBundleRpcAvailable");
    expect(actionSource).not.toContain("legacySaveArticleAction");
    expect(actionSource).toContain("articleSchema.safeParse");
    expect(actionSource).toContain("articleTranslationSchema.safeParse");
  });

  it("preserves editorial and release validation before the transaction", () => {
    expect(actionSource).toContain("publicationFailureSavePolicy");
    expect(actionSource).toContain("englishTranslationReleaseIssues");
    expect(actionSource).toContain("publication_ready");
    expect(actionSource).toContain("добавьте не менее 250 слов");
    expect(actionSource).toContain("preserve-published");
    expect(actionSource).toContain("englishSourceIsCurrent");
  });

  it("commits RU, EN, redirect, homepage and audit through one RPC", () => {
    expect(actionSource).toContain("saveArticleBundleRpc(supabase");
    expect(actionSource).toContain('const englishMode = englishData && savedEnglishStatus');
    expect(actionSource).toContain('"stale"');
    expect(actionSource).toContain("redirectSourcePath");
    expect(actionSource).toContain("replaceHomepage");
    expect(actionSource).toContain("auditMetadata");
    expect(actionSource).toContain("socialPublishRequested");
    expect(actionSource).toContain('"atomic-article-bundle"');
    expect(actionSource).toContain('"atomic-working-draft-promotion"');
    expect(actionSource).not.toContain("compensateAfterEnglishFailure");
    expect(actionSource).not.toContain(".update(");
    expect(actionSource).not.toContain(".insert(");
    expect(actionSource).not.toContain(".upsert(");
  });

  it("preserves both page-load optimistic locks", () => {
    expect(actionSource).toContain("expectedArticleUpdatedAt");
    expect(actionSource).toContain("expectedEnglishUpdatedAt");
    expect(actionSource).toContain("english_expected_updated_at");
    expect(actionSource).toContain("expected_updated_at");
    expect(actionSource).toContain("existingEnglishTranslation.updated_at");
  });

  it("starts the durable public build only after the RPC succeeds", () => {
    const rpcIndex = actionSource.indexOf("saveArticleBundleRpc(supabase");
    const buildIndex = actionSource.indexOf("requestPublicBuild({");
    expect(rpcIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(rpcIndex);
  });
});
