import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function source(name: string) {
  return readFileSync(new URL(name, import.meta.url), "utf8");
}

const article = source("../ArticleEditor.tsx");
const shell = source("./ArticleEditorShell.tsx");

describe("article editor shell boundaries", () => {
  it("keeps submit recovery ordering and save ownership in ArticleEditor", () => {
    expect(article).toContain("<ArticleEditorShell");
    expect(article).toContain("onSubmit={(event: ReactFormEvent<HTMLFormElement>) =>");
    expect(article).toContain('reason: "before-submit"');
    expect(article).toContain("PENDING_ARTICLE_SAVE_KEY");
    expect(article).toContain("<RecoveryController");
    expect(article).toContain("ref={saveSubmitButtonRef}");
    expect(article.indexOf('reason: "before-submit"')).toBeLessThan(
      article.indexOf("<RecoveryController")
    );

    expect(shell).not.toMatch(/RecoveryController|saveArticleAction/gu);
    expect(shell).not.toMatch(/useEffect|useState|useReducer|async /gu);
  });

  it("passes one grouped hidden model while preserving conditional tokens", () => {
    for (const group of ["identity", "publication", "russian", "english"]) {
      expect(article).toContain(`${group}: {`);
    }
    expect(article).toContain("id: article.id");
    expect(article).toContain('expectedUpdatedAt: article.updated_at || ""');
    expect(article).toContain(
      'englishExpectedUpdatedAt: englishTranslation?.updated_at || ""'
    );
    expect(article).toContain('override: "0"');

    expect(shell).toContain("{hidden.identity.id && (");
    expect(shell).toContain('name="expected_updated_at"');
    expect(shell).toContain('name="english_expected_updated_at"');
    expect(shell).toContain('name="publication_override"');
    expect(shell).toContain("{children}");
  });
});
