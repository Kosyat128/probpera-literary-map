import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(projectRoot, "dist");
const expectedOrigin = (
  process.env.PUBLIC_SITE_ORIGIN || "https://probpera.ru"
).replace(/\/+$/u, "");
const errors = [];
const warnings = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(distDirectory, relativePath), "utf8");
}

function htmlFileForUrl(urlValue) {
  const url = new URL(urlValue);
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  return segments.length
    ? path.join(distDirectory, ...segments, "index.html")
    : path.join(distDirectory, "index.html");
}

function oneMeta($, selector, label) {
  const elements = $(selector);
  check(elements.length === 1, `${label}: expected one ${selector}, found ${elements.length}`);
  return elements.first().attr("content")?.trim() || "";
}

const [robots, sitemapText, rssText, homeHtml] = await Promise.all([
  read("robots.txt"),
  read("sitemap.xml"),
  read("rss.xml"),
  read("index.html"),
]);

check(
  robots.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`),
  "robots.txt points to the production sitemap"
);
check(
  robots.includes(
    "Clean-param: utm_source&utm_medium&utm_campaign&utm_content&utm_term&yclid&gclid&fbclid"
  ),
  "robots.txt removes only known tracking parameters"
);
check(!/Disallow:\s*\/(?:stati|stranitsy)/iu.test(robots), "public editorial routes are crawlable");

const sitemapDocument = load(sitemapText, { xmlMode: true });
const sitemapEntries = sitemapDocument("url").map((_index, element) => ({
  url: sitemapDocument(element).find("loc").text().trim(),
  lastmod: sitemapDocument(element).find("lastmod").text().trim(),
})).get();
const locations = sitemapEntries.map((entry) => entry.url);
check(locations.length > 1, "sitemap contains the homepage and editorial pages");
check(new Set(locations).size === locations.length, "sitemap URLs are unique");
check(
  locations.every((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === expectedOrigin && !parsed.search && !parsed.hash;
    } catch {
      return false;
    }
  }),
  "sitemap contains canonical production URLs without query strings or fragments"
);
const lastModifiedDates = sitemapEntries.map((entry) => entry.lastmod).filter(Boolean);
const tomorrow = Date.now() + 24 * 60 * 60 * 1000;
check(
  lastModifiedDates.every((value) => {
    const parsed = Date.parse(`${value}T00:00:00Z`);
    return /^\d{4}-\d{2}-\d{2}$/u.test(value) && Number.isFinite(parsed) && parsed <= tomorrow;
  }),
  "sitemap lastmod values are valid non-future dates"
);
check(
  sitemapEntries.length < 10 || new Set(lastModifiedDates).size >= 3,
  "sitemap does not pretend that every publication changed on the build date"
);

const canonicalOwners = new Map();
for (const location of locations) {
  let html;
  try {
    html = await fs.readFile(htmlFileForUrl(location), "utf8");
  } catch (error) {
    errors.push(`${location}: static HTML is missing (${error.message})`);
    continue;
  }
  const $ = load(html, { decodeEntities: false });
  const title = $("title").text().replace(/\s+/gu, " ").trim();
  const description = oneMeta($, 'meta[name="description"]', location);
  const robotsValue = oneMeta($, 'meta[name="robots"]', location);
  const ogUrl = oneMeta($, 'meta[property="og:url"]', location);
  const ogTitle = oneMeta($, 'meta[property="og:title"]', location);
  const ogDescription = oneMeta($, 'meta[property="og:description"]', location);
  const ogImage = oneMeta($, 'meta[property="og:image"]', location);
  const twitterCard = oneMeta($, 'meta[name="twitter:card"]', location);
  const canonicalLinks = $('link[rel="canonical"]');
  const canonical = canonicalLinks.first().attr("href")?.trim() || "";

  check(Boolean(title), `${location}: title is present`);
  check(description.length >= 40 && description.length <= 200, `${location}: description has a useful length`);
  check(!/noindex/iu.test(robotsValue), `${location}: sitemap URL is indexable`);
  check(canonicalLinks.length === 1 && canonical === location, `${location}: self canonical is exact`);
  check(ogUrl === canonical, `${location}: og:url matches canonical`);
  check(Boolean(ogTitle && ogDescription), `${location}: Open Graph title and description are present`);
  check(/^https:\/\//u.test(ogImage), `${location}: Open Graph image is absolute HTTPS`);
  check(twitterCard === "summary_large_image", `${location}: large social preview is declared`);
  check($("h1").length === 1, `${location}: static HTML contains one primary heading`);
  check($("main").text().replace(/\s+/gu, " ").trim().length >= 160, `${location}: meaningful content is available without JavaScript`);
  check(
    !/mc\.yandex\.ru\/(?:metrika\/tag\.js|watch\/)|\bym\s*\(/u.test(html),
    `${location}: Metrika is not loaded before consent`
  );
  for (const script of $('script[type="application/ld+json"]').toArray()) {
    try {
      JSON.parse($(script).text());
    } catch (error) {
      errors.push(`${location}: invalid JSON-LD (${error.message})`);
    }
  }
  const owners = canonicalOwners.get(canonical) || [];
  owners.push(location);
  canonicalOwners.set(canonical, owners);
}

for (const [canonical, owners] of canonicalOwners) {
  if (owners.length > 1) errors.push(`canonical ${canonical} is shared by ${owners.join(", ")}`);
}

const homeDocument = load(homeHtml);
check(homeDocument("[data-static-seo]").length === 1, "homepage ships a static search fallback");
check(homeDocument("[data-static-seo] a[href]").length >= 4, "homepage fallback links to editorial content");

const rssDocument = load(rssText, { xmlMode: true });
check(rssDocument("channel > link").first().text().trim() === `${expectedOrigin}/`, "RSS points to the canonical site");
check(rssDocument("item").length > 0, "RSS contains current publications");

const summary = {
  status: errors.length ? "failed" : "ready",
  checks,
  pages: locations.length,
  uniqueLastmodDates: new Set(lastModifiedDates).size,
  warnings,
  errors: errors.slice(0, 100),
};
console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
