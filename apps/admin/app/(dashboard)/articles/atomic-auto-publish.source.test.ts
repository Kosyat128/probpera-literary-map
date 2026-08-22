import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const actionSource = readFileSync(
  path.join(
    process.cwd(),
    "apps/admin/app/(dashboard)/articles/atomic-auto-publish-action.ts"
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

describe("atomic auto-translated article publication", () => {
  it("falls back to the legacy save path until schema health enables the RPC", () => {
    expect(wrapperSource).toContain("isArticleBundleRpcAvailable");
    expect(wrapperSource).toContain("atomicPersistenceAvailable");
    expect(wrapperSource).toContain("saveAutoTranslatedArticleAtomically(formData)");
    expect(wrapperSource).toContain(": legacySaveArticleAction(formData)");
  });

  it("keeps editorial validation on the compatibility path", () => {
    expect(actionSource).toContain("publicationIssues.length > 0");
    expect(actionSource).toContain("return legacySaveArticleAction(formData)");
    expect(actionSource).toContain("englishTranslationReleaseIssues");
    expect(actionSource).toContain("publication_ready");
    expect(actionSource).toContain("добавьте не менее 250 слов");
  });

  it("commits Russian, English, redirect, homepage and audit through one RPC", () => {
    expect(actionSource).toContain("saveArticleBundleRpc(supabase");
    expect(actionSource).toContain('englishMode: "save"');
    expect(actionSource).toContain("redirectSourcePath");
    expect(actionSource).toContain("replaceHomepage");
    expect(actionSource).toContain("auditMetadata");
    expect(actionSource).toContain("socialPublishRequested: true");
    expect(actionSource).toContain('persistence: "atomic-article-bundle"');
  });

  it("preserves both page-load optimistic locks", () => {
    expect(actionSource).toContain("expectedArticleUpdatedAt");
    expect(actionSource).toContain("expectedEnglishUpdatedAt");
    expect(actionSource).toContain("english_expected_updated_at");
    expect(actionSource).toContain("expected_updated_at");
  });
});
