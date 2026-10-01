import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile, realpath, readdir, lstat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import { generatePublicLocalePages, publicLocaleCopyInput, publicLocaleSitemapXml } from "./public-locale-pages.mjs";
import { createPublicLocaleReviewSnapshot, publicLocaleReviewDigest, MAX_PUBLIC_LOCALE_INVENTORY_ENTRIES } from "./public-locale-review.mjs";
import { generatePlanetAccountPages } from "./account-pages.mjs";
import { containedFile } from "./pwa-artifact.mjs";

const root = await realpath(fileURLToPath(new URL("../../", import.meta.url)));
const ORIGIN = "https://probpera.ru";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const OWNED_OUTPUTS = new Set(["locale-routes.json", "sitemap-locales.xml", ...["ru", "en"].flatMap(locale => [
  `${locale}/index.html`, `${locale}/404.html`, `${locale}/structured-data.json`, `${locale}/sitemap.preparation.json`,
  `${locale}/planet-account/index.html`, `${locale}/delete-account/index.html`,
])]);

async function outputDirectory(value) {
  const directory = path.resolve(value);
  const relative = path.relative(root, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || await realpath(directory) !== directory) {
    throw new Error("Public output must be a real checkout subdirectory");
  }
  return directory;
}

async function previousManifest(directory) {
  try {
    const previous = JSON.parse((await containedFile(directory, "locale-routes.json")).bytes.toString("utf8"));
    if (previous?.generatedBy !== "public-locale-pages" || previous.schemaVersion !== 1 || !Array.isArray(previous.artifacts)
      || previous.artifacts.length > 32 || previous.artifacts.some(entry => !OWNED_OUTPUTS.has(entry.path)
        || !/^[a-f0-9]{64}$/u.test(entry.sha256))
      || new Set(previous.artifacts.map(entry => entry.path)).size !== previous.artifacts.length) {
      throw new Error("Invalid prior locale artifact ownership");
    }
    return previous;
  } catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

async function verifyOwnedArtifact(directory, relative, previous) {
  const prior = await containedFile(directory, relative);
  if (relative.endsWith(".html") && load(prior.bytes.toString("utf8"))("html[data-public-locale-entry]").length !== 1) {
    throw new Error("Refuse replacing a non-generated public locale page");
  }
  const owned = previous?.artifacts?.find(entry => entry.path === relative);
  if (!owned || owned.sha256 !== prior.sha256) throw new Error("Refuse replacing an unowned or changed locale artifact");
  return prior;
}

/** Exhaustive actual build bytes, including lazy runtime/catalog assets. No
 * caller-selected file list can silently omit relevant current content. */
export async function capturePublicLocaleSourceSnapshot({ directory = path.join(root, "dist") } = {}) {
  directory = await outputDirectory(directory);
  const previous = await previousManifest(directory);
  const home = await containedFile(directory, "index.html");
  const assets = [], content = [], actualPaths = new Set();
  const pending = [""]; let bytes = 0, count = 0;
  while (pending.length) {
    const relativeDirectory = pending.pop();
    if (relativeDirectory.split("/").length > 24) throw new Error("Public build depth exceeds snapshot bound");
    for (const entry of await readdir(path.join(directory, relativeDirectory), { withFileTypes: true })) {
      const relative = [relativeDirectory, entry.name].filter(Boolean).join("/");
      if (++count > MAX_PUBLIC_LOCALE_INVENTORY_ENTRIES) throw new Error("Public build entries exceed snapshot bound");
      const filename = path.join(directory, relative);
      if ((await lstat(filename)).isSymbolicLink() || await realpath(filename) !== filename) throw new Error("Linked public build input");
      if (entry.isDirectory()) { pending.push(relative); continue; }
      if (!entry.isFile()) throw new Error("Non-file public build input");
      if (OWNED_OUTPUTS.has(relative)) {
        if (relative !== "locale-routes.json") await verifyOwnedArtifact(directory, relative, previous);
        continue;
      }
      const input = await containedFile(directory, relative);
      bytes += input.size;
      if (bytes > 1024 * 1024 * 1024) throw new Error("Public build bytes exceed snapshot bound");
      actualPaths.add(relative);
      if (relative === "index.html") continue;
      const record = { path: relative, bytes: input.size, sha256: input.sha256 };
      (relative.startsWith("assets/") || /\.(?:js|css|wasm)$/iu.test(relative) ? assets : content).push(record);
    }
  }
  const $ = load(home.bytes.toString("utf8"));
  for (const node of $('script[type="module"][src],link[rel="stylesheet"],link[rel="modulepreload"],link[rel="preload"],link[rel="manifest"],link[rel="icon"],link[rel="apple-touch-icon"],meta[property="og:image"],meta[name="twitter:image"]').get()) {
    const attribute = node.tagName === "script" ? "src" : node.tagName === "meta" ? "content" : "href";
    const url = new URL($(node).attr(attribute), `${ORIGIN}/`);
    if (url.origin !== ORIGIN || url.username || url.password || url.hash || !actualPaths.has(decodeURIComponent(url.pathname).replace(/^\//u, ""))) {
      throw new Error("Public entry references missing or noncanonical build input");
    }
  }
  return createPublicLocaleReviewSnapshot({ builtHtml: home.bytes.toString("utf8"), assets, content, copy: [publicLocaleCopyInput()] });
}

async function assertDraftsExcluded(directory, result) {
  const allowed = new Set(result.sitemap.entries.map(entry => entry.url));
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
    const source = result.files[relative] ?? (await containedFile(directory, relative)).bytes.toString("utf8");
    total += Buffer.byteLength(source);
    if (total > 8 * 1024 * 1024) throw new Error("Public sitemap input exceeds its bound");
    const $ = load(source, { xmlMode: true });
    if ($("sitemapindex").length + $("urlset").length !== 1) throw new Error("Expected a canonical sitemap or sitemap index");
    for (const entry of $("url > loc").get()) {
      const raw = $(entry).text().trim();
      const url = new URL(raw);
      url.pathname = decodeURIComponent(url.pathname);
      url.search = ""; url.hash = "";
      if ((forbidden.has(url.href) && !(allowed.has(url.href) && raw === url.href))
        || /^\/(?:ru\/|en\/)?(?:404(?:\.html)?|planet-account|delete-account)(?:\/|$)/u.test(url.pathname)
        || /^\/planet(?:\/|$)/u.test(url.pathname)) throw new Error("Unreviewed locale shell or private/error page appears in the indexable sitemap");
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

/** Local artifacts only. A provisioned source-exact review permits page
 * indexing; it grants no product release, deployment or reviewer identity. */
export async function writePublicLocalePages({ directory = path.join(root, "dist"), review, provisionedReviewSha256 } = {}) {
  directory = await outputDirectory(directory);
  const previous = await previousManifest(directory);
  for (const relative of OWNED_OUTPUTS) {
    if (relative === "locale-routes.json") continue;
    await assertOutputParent(directory, path.join(directory, relative));
    try { await verifyOwnedArtifact(directory, relative, previous); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const home = await containedFile(directory, "index.html");
  let sourceSnapshot, snapshotError;
  if (review !== undefined || provisionedReviewSha256 !== undefined) {
    try { sourceSnapshot = await capturePublicLocaleSourceSnapshot({ directory }); }
    catch (error) { snapshotError = `source-snapshot-unavailable: ${error.message}`; }
  }
  const result = generatePublicLocalePages({ builtHtml: home.bytes.toString("utf8"), sourceSnapshot, review, provisionedReviewSha256 });
  if (snapshotError) {
    result.sitemap.reviewGate.diagnostics.push(snapshotError);
    for (const locale of ["ru", "en"]) {
      const filename = `${locale}/sitemap.preparation.json`;
      result.files[filename] = JSON.stringify({ ...JSON.parse(result.files[filename]), reviewGate: result.sitemap.reviewGate }, null, 2) + "\n";
    }
  }
  const accounts = generatePlanetAccountPages({ builtHtml: home.bytes.toString("utf8") });
  Object.assign(result.files, accounts.files);
  result.sitemap.excluded.push(...accounts.excluded);
  if (!result.files["sitemap-locales.xml"] && previous?.artifacts?.some(entry => entry.path === "sitemap-locales.xml")) {
    result.files["sitemap-locales.xml"] = publicLocaleSitemapXml();
  }

  for (const relative of Object.keys(result.files)) {
    const filename = path.join(directory, relative);
    await assertOutputParent(directory, filename);
    try {
      await verifyOwnedArtifact(directory, relative, previous);
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  // Validate the complete future sitemap graph before writes. Only verified
  // owned localized XML can be substituted; the canonical sitemap is untouched.
  const checkedSitemaps = await assertDraftsExcluded(directory, result);

  const artifacts = [];
  for (const [relative, content] of Object.entries(result.files)) {
    const filename = path.join(directory, relative);
    await assertOutputParent(directory, filename);
    await mkdir(path.dirname(filename), { recursive: true });
    if (await realpath(path.dirname(filename)) !== path.dirname(filename)) throw new Error("Linked locale output directory");
    await writeFile(filename, content);
    artifacts.push({ path: relative, sha256: hash(content), indexable: result.sitemap.reviewGate.indexingAllowed
      && (relative === "ru/index.html" || relative === "en/index.html") });
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
  const args = process.argv.slice(2);
  let options = {};
  if (args.length === 1 && args[0] === "--snapshot-only") {
    const snapshot = await capturePublicLocaleSourceSnapshot();
    console.log(JSON.stringify({ snapshot, inputsSha256: publicLocaleReviewDigest(snapshot), releaseReady: false }, null, 2));
    process.exit(0);
  }
  if (args.length) {
    if (args.length !== 4 || args[0] !== "--review" || args[2] !== "--review-sha256" || !/^[a-f0-9]{64}$/u.test(args[3])) {
      throw new Error("Use --snapshot-only or --review <checkout-relative-json> --review-sha256 <independently-provisioned-canonical-digest>");
    }
    const source = await containedFile(root, args[1]);
    if (source.size > 4 * 1024 * 1024) throw new Error("Review artifact exceeds input bound");
    options = { review: JSON.parse(source.bytes.toString("utf8")), provisionedReviewSha256: args[3] };
  }
  const result = await writePublicLocalePages(options);
  console.log(JSON.stringify({ generatedPublicLocales: result.requiredLocales, files: result.files,
    checkedSitemaps: result.checkedSitemaps, reviewGate: result.sitemap.reviewGate, releaseReady: false }));
}
