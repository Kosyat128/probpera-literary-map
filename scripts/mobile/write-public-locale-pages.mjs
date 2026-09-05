import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { generatePublicLocalePages } from "./public-locale-pages.mjs";
import { generatePlanetAccountPages } from "./account-pages.mjs";
import { containedFile } from "./pwa-artifact.mjs";

const root = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
const ORIGIN = "https://probpera.ru";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

async function assertDraftsExcluded(directory, result) {
  const forbidden = new Set([
    ...result.sitemap.excluded.map(entry => entry.url),
    ...Object.keys(result.files).map(filename => `${ORIGIN}/${filename}`),
    ...Object.keys(result.files).filter(filename => filename.endsWith("/index.html"))
      .flatMap(filename => [`${ORIGIN}/${filename.slice(0, -10)}`, `${ORIGIN}/${filename.slice(0, -11)}`]),
    `${ORIGIN}/ru`, `${ORIGIN}/en`,
  ]);
  const pending = ["sitemap.xml"];
  const visited = new Set();
  let total = 0;
  while (pending.length) {
    const relative = pending.shift();
    if (visited.has(relative)) continue;
    if (visited.size >= 32) throw new Error("Public sitemap traversal exceeds its bound");
    visited.add(relative);
    const source = await containedFile(directory, relative);
    total += source.bytes.length;
    if (total > 8 * 1024 * 1024) throw new Error("Public sitemap input exceeds its bound");
    const $ = load(source.bytes.toString("utf8"), { xmlMode: true });
    if ($("sitemapindex").length + $("urlset").length !== 1) throw new Error("Expected a canonical sitemap or sitemap index");
    for (const entry of $("url > loc").get()) {
      const url = new URL($(entry).text().trim());
      url.pathname = decodeURIComponent(url.pathname);
      url.search = ""; url.hash = "";
      if (forbidden.has(url.href)) throw new Error("Unreviewed locale shell appears in the indexable sitemap");
    }
    for (const entry of $("sitemap > loc").get()) {
      const url = new URL($(entry).text().trim());
      if (url.origin !== ORIGIN || url.search || url.hash || !url.pathname.endsWith(".xml")) {
        throw new Error("Sitemap index must reference local canonical XML files");
      }
      pending.push(decodeURIComponent(url.pathname).replace(/^\/+/, ""));
    }
  }
  return visited.size;
}

async function assertOutputParent(directory, filename) {
  let parent = path.dirname(filename);
  while (true) {
    const relative = path.relative(directory, parent);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Locale output parent escapes its directory");
    try {
      if (await realpath(parent) !== parent) throw new Error("Linked locale output directory");
      return;
    } catch (error) {
      if (error.code !== "ENOENT" || parent === directory) throw error;
      parent = path.dirname(parent);
    }
  }
}

/** Writes only preparation artifacts inside a real checkout output directory. */
export async function writePublicLocalePages({ directory = path.join(root, "dist") } = {}) {
  directory = path.resolve(directory);
  const relativeDirectory = path.relative(root, directory);
  if (!relativeDirectory || relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)
    || await realpath(directory) !== directory) throw new Error("Public output must be a real checkout subdirectory");
  const home = await containedFile(directory, "index.html");
  const result = generatePublicLocalePages({ builtHtml: home.bytes.toString("utf8") });
  const accounts = generatePlanetAccountPages({ builtHtml: home.bytes.toString("utf8") });
  Object.assign(result.files, accounts.files);
  result.sitemap.excluded.push(...accounts.excluded);
  // Check the actual sitemap graph BEFORE writing any page or directory.
  const checkedSitemaps = await assertDraftsExcluded(directory, result);
  let previous = null;
  try { previous = JSON.parse((await containedFile(directory, "locale-routes.json")).bytes.toString("utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }

  for (const relative of Object.keys(result.files)) {
    const filename = path.join(directory, relative);
    await assertOutputParent(directory, filename);
    try {
      const prior = await containedFile(directory, relative);
      if (relative.endsWith(".html")) {
        const $ = load(prior.bytes.toString("utf8"));
        if ($("html[data-public-locale-entry]").length !== 1) throw new Error("Refuse replacing a non-generated public locale page");
      } else {
        const owned = previous?.generatedBy === "public-locale-pages" && previous?.artifacts?.find(entry => entry.path === relative);
        if (!owned || owned.sha256 !== hash(prior.bytes)) throw new Error("Refuse replacing an unowned or changed locale artifact");
      }
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }

  const artifacts = [];
  for (const [relative, content] of Object.entries(result.files)) {
    const filename = path.join(directory, relative);
    await assertOutputParent(directory, filename);
    await mkdir(path.dirname(filename), { recursive: true });
    if (await realpath(path.dirname(filename)) !== path.dirname(filename)) throw new Error("Linked locale output directory");
    await writeFile(filename, content);
    artifacts.push({ path: relative, sha256: hash(content), indexable: false });
  }
  const manifest = {
    schemaVersion: 1, generatedBy: "public-locale-pages", releaseReady: false, requiredLocales: ["ru", "en"],
    files: Object.keys(result.files), artifacts, sitemap: result.sitemap, notFound: result.notFound,
    accountRoutes: accounts.routes,
    checkedSitemaps,
  };
  await writeFile(path.join(directory, "locale-routes.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await writePublicLocalePages();
  console.log(JSON.stringify({ generatedPublicLocales: result.requiredLocales, files: result.files,
    checkedSitemaps: result.checkedSitemaps, releaseReady: false }));
}
