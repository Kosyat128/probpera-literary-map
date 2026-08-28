import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (url: URL) =>
  readFileSync(url, "utf8").replace(/\r\n?/gu, "\n");
const actionsFacade = read(new URL("./actions.ts", import.meta.url));
const legacyActions = read(new URL("./actions-legacy.ts", import.meta.url));
const automaticSave = read(new URL("./save-article-action.ts", import.meta.url));
const articlePage = read(new URL("./[id]/page.tsx", import.meta.url));
const preview = read(new URL("./[id]/preview/page.tsx", import.meta.url));

describe("article publication presentation policy", () => {
  it("queues Dzen without automatic VK publication", () => {
    expect(legacyActions.match(/platforms: \["dzen"\]/gu)).toHaveLength(2);
    expect(legacyActions).not.toContain('platforms: ["vk", "dzen"]');
    expect(articlePage).toContain("Автопубликация отключена");
    expect(articlePage).toContain("первая\n          пригодная иллюстрация");
  });

  it("routes article saves through the automatic translation facade", () => {
    expect(actionsFacade).toContain('export * from "./actions-legacy"');
    expect(actionsFacade).toContain(
      'export { saveArticleAction } from "./save-article-action"'
    );
    expect(automaticSave).toContain("translateArticleSourceToEnglish");
    expect(automaticSave).toContain('formData.set("english_status", "published")');
    expect(automaticSave).toContain(
      'formData.set("english_confirm_current_source", "on")'
    );
  });

  it("keeps responsive preview and puts the cover after the lead", () => {
    expect(preview).toContain('["desktop", "tablet", "mobile"]');
    expect(preview).toContain('className="preview-device-tabs"');
    expect(preview.indexOf("localizedArticle.excerpt")).toBeLessThan(
      preview.indexOf("article.cover_external_url")
    );
  });
});
