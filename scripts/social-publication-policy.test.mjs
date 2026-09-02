import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publisher = readFileSync(
  new URL("./publish-social-content.mjs", import.meta.url),
  "utf8"
);
const deployWorkflow = readFileSync(
  new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
  "utf8"
);
const retryWorkflow = readFileSync(
  new URL("../.github/workflows/publish-social.yml", import.meta.url),
  "utf8"
);
const environmentExample = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8"
);
const articleBuilder = readFileSync(
  new URL("./build-article-pages.mjs", import.meta.url),
  "utf8"
);

describe("automatic publication channel policy", () => {
  it("keeps VK dormant unless an operator explicitly enables it", () => {
    expect(publisher).toContain(
      'process.env.SOCIAL_ENABLE_VK_AUTOPUBLISH === "true"'
    );
    expect(publisher).toContain(
      'process.env.SOCIAL_REQUIRED_PLATFORMS || "dzen"'
    );
    expect(environmentExample).toContain("SOCIAL_REQUIRED_PLATFORMS=dzen");
    expect(environmentExample).toContain("SOCIAL_ENABLE_VK_AUTOPUBLISH=false");
  });

  it("runs deployment and retry automation for Dzen only", () => {
    for (const workflow of [deployWorkflow, retryWorkflow]) {
      expect(workflow).toContain("SOCIAL_REQUIRED_PLATFORMS: dzen");
      expect(workflow).not.toContain("SOCIAL_REQUIRED_PLATFORMS: vk,dzen");
      expect(workflow).not.toContain("VK_ACCESS_TOKEN:");
    }
  });

  it("verifies that the selected Dzen cover reached the feed", () => {
    expect(publisher).toContain("dzenCoverForArticle(article)");
    expect(publisher).toContain("coverSource: dzenCover?.source");
    expect(publisher).toContain("typeof articleDocument.contentHtml");
    expect(publisher).toContain("latest.dzenImageAlt || latest.imageAlt");
    expect(articleBuilder).toContain("content_html: document.contentHtml");
  });

  it("keeps the Dzen RSS request on the canonical non-redirecting endpoint", () => {
    expect(publisher).toContain('const rssUrl = "https://probpera.ru/rss.xml"');
    expect(publisher).toContain("configuredRssUrl !== rssUrl");
    expect(publisher).toContain('redirect: "error"');
    expect(publisher).toContain("response.url !== rssUrl");
    expect(publisher).not.toContain("fetch(trustedHttpsUrl(rssUrl");
  });
});
