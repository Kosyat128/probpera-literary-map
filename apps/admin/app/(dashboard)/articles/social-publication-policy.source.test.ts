import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const articlePage = readFileSync(
  new URL("./[id]/page.tsx", import.meta.url),
  "utf8"
);
const preview = readFileSync(
  new URL("./[id]/preview/page.tsx", import.meta.url),
  "utf8"
);

describe("article publication presentation policy", () => {
  it("queues Dzen without automatic VK publication", () => {
    expect(actions.match(/platforms: \["dzen"\]/gu)).toHaveLength(2);
    expect(actions).not.toContain('platforms: ["vk", "dzen"]');
    expect(articlePage).toContain("Автопубликация отключена");
    expect(articlePage).toContain("первая\n          пригодная иллюстрация");
  });

  it("keeps responsive preview and puts the cover after the lead", () => {
    expect(preview).toContain('["desktop", "tablet", "mobile"]');
    expect(preview).toContain('className="preview-device-tabs"');
    expect(preview.indexOf("localizedArticle.excerpt")).toBeLessThan(
      preview.indexOf("article.cover_external_url")
    );
  });
});
