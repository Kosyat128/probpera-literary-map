import { expect } from "@playwright/test";

const sitemapCandidates = ["/sitemap.xml", "/probpera-literary-map/sitemap.xml"];

export async function articleFromSitemap(
  request,
  baseURL,
  preferredPath = ""
) {
  let sitemap = "";
  let previewBasePath = "";

  for (const candidate of sitemapCandidates) {
    const response = await request.get(new URL(candidate, baseURL).toString());
    const body = await response.text();
    if (response.ok() && body.includes("<urlset")) {
      sitemap = body;
      previewBasePath = candidate.replace(/\/sitemap\.xml$/u, "");
      break;
    }
  }

  const articleUrls = [
    ...sitemap.matchAll(/<loc>([^<]+\/stati\/[^<]+)<\/loc>/gu),
  ]
    .map((match) => match[1])
    .filter((candidate) => {
      const segments = new URL(candidate).pathname.split("/").filter(Boolean);
      const journalIndex = segments.lastIndexOf("stati");
      return journalIndex >= 0 && segments.length === journalIndex + 3;
    });
  expect(
    articleUrls.length,
    "The sitemap must contain at least one published article"
  ).toBeGreaterThan(0);

  const articleUrl =
    articleUrls.find((candidate) => candidate.includes(preferredPath)) ||
    articleUrls[0];
  const articlePath = new URL(articleUrl).pathname;
  const previewArticlePath =
    previewBasePath && !articlePath.startsWith(`${previewBasePath}/`)
      ? `${previewBasePath}${articlePath}`
      : articlePath;

  return new URL(previewArticlePath, baseURL).toString();
}
