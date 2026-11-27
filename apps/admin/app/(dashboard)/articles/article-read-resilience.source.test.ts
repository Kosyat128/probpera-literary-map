import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isHiddenArticleRead } from "./article-read-unavailable";

const edit = readFileSync(new URL("./[id]/page.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("./[id]/preview/page.tsx", import.meta.url), "utf8");

describe("article read resilience", () => {
  it.each([
    [402, "402"],
    [429, "PGRST003"],
    [503, "PGRST002"],
    [0, ""],
  ])("shows a dependency state for API or transport failure %s", (status, code) => {
    expect(isHiddenArticleRead(status, code)).toBe(false);
  });

  it.each([
    [401, "PGRST301"],
    [403, "42501"],
    [400, "22P02"],
  ])("keeps existing not-found behavior for unavailable article ID %s", (status, code) => {
    expect(isHiddenArticleRead(status, code)).toBe(true);
  });

  it.each([
    ["edit", edit],
    ["preview", preview],
  ])("checks the primary read failure before deciding the row is absent in %s", (_route, source) => {
    expect(source).toContain("if (!supabase) return <AdminDependencyState />");
    expect(source).toContain("{ data: article, error: articleLoadError, status: articleReadStatus }");
    expect(source).toMatch(
      /if \(articleLoadError\) \{\s*if \(isHiddenArticleRead\(articleReadStatus, articleLoadError\.code\)\) notFound\(\);\s*return <ArticleReadUnavailable retryHref=\{[^\n]+\} \/>;\s*\}\s*if \(!article\) notFound\(\);/,
    );
  });

  it("blocks editing with an unknown English version and retries the English preview when needed", () => {
    expect(edit).toMatch(
      /if \(englishTranslationLoadError\) \{\s*return <ArticleReadUnavailable retryHref=\{articleEditPath\(id, query\)\} \/>;/,
    );
    expect(preview).toMatch(
      /if \(locale === "en" && englishTranslationLoadError\) \{\s*return <ArticleReadUnavailable retryHref=\{previewHref\(\)\} \/>;/,
    );
  });
});
