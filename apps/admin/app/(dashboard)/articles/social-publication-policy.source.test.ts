import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (url: URL) =>
  readFileSync(url, "utf8").replace(/\r\n?/gu, "\n");
const actionsFacade = read(new URL("./actions.ts", import.meta.url));
const socialPublicationAction = read(
  new URL("./social-publication-action.ts", import.meta.url)
);
const atomicStandardSave = read(
  new URL("./atomic-standard-save-action.ts", import.meta.url)
);
const automaticSave = read(new URL("./save-article-action.ts", import.meta.url));
const articlePage = read(new URL("./[id]/page.tsx", import.meta.url));
const preview = read(new URL("./[id]/preview/page.tsx", import.meta.url));

describe("article publication presentation policy", () => {
  it("queues Dzen without automatic VK publication", () => {
    const publicationActions = `${atomicStandardSave}\n${socialPublicationAction}`;
    expect(publicationActions.match(/platforms: \["dzen"\]/gu)).toHaveLength(2);
    expect(publicationActions).not.toContain('platforms: ["vk", "dzen"]');
    expect(articlePage).toContain("Автопубликация отключена");
    expect(articlePage).toContain("первая\n          пригодная иллюстрация");
  });

  it("routes article saves through the automatic translation facade", () => {
    expect(actionsFacade).not.toContain("export *");
    expect(actionsFacade).toContain('from "./article-management-actions"');
    expect(actionsFacade).toContain(
      'export { importLegacyArticlesAction } from "./legacy-import-action"'
    );
    expect(actionsFacade).toContain(
      'export { saveArticleAction } from "./save-article-action"'
    );
    expect(actionsFacade).toContain(
      'export { requestSocialPublicationAction } from "./social-publication-action"'
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
      preview.indexOf("previewArticle.cover_external_url")
    );
  });
});
