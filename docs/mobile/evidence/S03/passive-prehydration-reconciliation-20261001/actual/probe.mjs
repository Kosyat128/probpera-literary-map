/** Passive, retained-candidate HTTP evidence only. Never builds, signs, installs, or executes HTML. */
import { createHash } from "node:crypto";
import { createServer, request } from "node:http";
import { lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REVIEW = path.dirname(fileURLToPath(import.meta.url));
const CANONICAL_REPO = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
const VISUAL = "D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94";
const CANDIDATE = Object.freeze({
  artifactRoot: VISUAL + "/s15-booky-exhausted-retry-runtime-build-evidence/attempt-a1/pwa/pwa-313940bc",
  record: "docs/mobile/evidence/S15/booky-exhausted-retry-20260930/builds/pwa/b7951ee9ba9e8e5d-603ef40ec561-result.json",
  recordSha: "b7951ee9ba9e8e5d00d6f3b5e11c2214a40f19dc68fc72d85cd4c4433147a2ac",
  manifest: "docs/mobile/evidence/S15/booky-exhausted-retry-20260930/actual/555b4c84f613941d-bbb22bb0c290-source-manifest.json",
  manifestSha: "555b4c84f613941df20da33259cf7880e5ef2737252e2810807143f311dea324",
  descriptorSha: "b04ebb7776ad556f9fd2e45ac786240077830ba38db5559ed1f9d5ac1c257465",
  buildId: "313940bce3ea3ecb46b73e63ec30bab0528c17453d197055b8f44f9938246ed4",
  sourceCommit: "aba461a774c125f9c38ea4c10aac9b3cc8024d2d",
  sourceInputsSha: "955b2625e93854f40a88334c54d2e480b10153c9cb85a7b097cd9de6e3d1f6c6",
});
const OWNERS = Object.freeze(["package.json", "package-lock.json", "scripts/mobile/pwa-shell.mjs",
  "src/i18n/PublicLocaleMetadata.tsx", "scripts/mobile/public-locale-pages.mjs",
  "scripts/mobile/public-locale-review.mjs", "scripts/mobile/write-public-locale-pages.mjs"]);
const COPY = Object.freeze({
  ru: { brand: "Литературная планета", opening: "Открываем «Литературную планету»…", recovery: "Если приложение не открывается",
    noScript: "Для работы приложения нужен JavaScript. Включите его в настройках браузера, затем откройте приложение снова.",
    notFound: "Страница не найдена. Вернитесь к «Литературной планете».", og: "ru_RU" },
  en: { brand: "Literary Planet", opening: "Opening Literary Planet…", recovery: "If the app does not open",
    noScript: "The app needs JavaScript. Enable it in your browser settings, then open the app again.",
    notFound: "Page not found. Return to Literary Planet.", og: "en_US" },
});
const HTML = Object.freeze([
  { route: "/planet/", file: "index.html", locale: null, notFound: false, status: 200 },
  ...["ru", "en"].map(locale => ({ route: `/planet/${locale}/`, file: `${locale}/index.html`, locale, notFound: false, status: 200 })),
  { route: "/planet/404.html", file: "404.html", locale: null, notFound: true, status: 404 },
  ...["ru", "en"].map(locale => ({ route: `/planet/${locale}/404.html`, file: `${locale}/404.html`, locale, notFound: true, status: 404 })),
]);
const MANIFESTS = Object.freeze([null, "ru", "en"].map(locale => ({
  route: `/planet/${locale ? locale + "/" : ""}manifest.webmanifest`, file: `${locale ? locale + "/" : ""}manifest.webmanifest`, locale,
})));
const MAX_RESPONSE = 128 * 1024, MAX_REPORT = 128 * 1024;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const ensure = (condition, message) => { if (!condition) throw new Error(message); };
const utf8 = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const inside = (root, target) => { const relative = path.relative(root, target); return relative !== "" && !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep); };

async function boundedFile(root, relative, limit) {
  ensure(typeof relative === "string" && !relative.includes("\\") && !relative.split("/").some(part => !part || part === "." || part === ".."), "Unsafe fixed input path");
  const filename = path.resolve(root, relative);
  ensure(inside(root, filename) && await realpath(filename) === filename, "Input escapes its authenticated root or uses a link");
  const stat = await lstat(filename);
  ensure(stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit, "Input is not a bounded regular file");
  const bytes = await readFile(filename);
  ensure(bytes.length === stat.size && bytes.length <= limit, "Input changed during bounded read");
  return bytes;
}

async function outputPath(argument) {
  ensure(typeof argument === "string" && path.isAbsolute(argument), "--out must be an absolute new result.json under this review directory");
  const target = path.resolve(argument), relative = path.relative(REVIEW, target), parts = relative.split(path.sep);
  ensure(inside(REVIEW, target) && parts.length === 2 && /^[a-z0-9][a-z0-9-]{0,63}$/u.test(parts[0]) && parts[1] === "result.json", "Use review/<new-attempt>/result.json");
  const reviewReal = await realpath(REVIEW);
  ensure(reviewReal === path.resolve(REVIEW), "Review directory must not be a link");
  const parent = path.dirname(target);
  try { const stat = await lstat(parent); ensure(stat.isDirectory() && !stat.isSymbolicLink() && await realpath(parent) === parent, "Output parent must be an ordinary review directory"); }
  catch (error) { if (error.code !== "ENOENT") throw error; await mkdir(parent); }
  try { await lstat(target); throw new Error("Refusing to overwrite earlier evidence"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return target;
}

function getRaw(origin, route) {
  return new Promise((resolve, reject) => {
    const req = request(origin + route, { method: "GET", agent: false }, response => {
      const parts = []; let length = 0;
      response.on("data", chunk => { length += chunk.length; if (length > MAX_RESPONSE) response.destroy(new Error("HTTP body exceeds bound")); else parts.push(chunk); });
      response.once("error", reject);
      response.once("end", () => resolve({ route, status: response.statusCode, contentType: response.headers["content-type"], headers: response.headers, bytes: Buffer.concat(parts) }));
    });
    req.setTimeout(2000, () => req.destroy(new Error("Loopback HTTP request timed out")));
    req.once("error", reject); req.end();
  });
}

function single($, selector, attribute) {
  const nodes = $(selector); ensure(nodes.length === 1, `Expected one ${selector}`);
  return attribute ? nodes.attr(attribute) : nodes.text().trim();
}

function htmlEvidence(load, response, entry, icons) {
  const text = utf8(response.bytes), $ = load(text, { scriptingEnabled: false });
  const locale = entry.locale, brand = locale ? COPY[locale].brand : COPY.ru.brand + " / " + COPY.en.brand;
  const canonical = "https://probpera.ru" + entry.route, title = entry.notFound ? "404 | " + brand : brand;
  ensure(/^<!doctype html>/iu.test(text) && single($, "html", "lang") === (locale ?? ""), "HTML language/doctype mismatch");
  ensure($("body").attr("lang") === undefined && $("#root").length === 1, "Body must inherit one canonical shell language");
  ensure(single($, "head title") === title && single($, 'meta[name="description"]', "content") === brand, "Localized title/description mismatch");
  ensure(single($, 'meta[name="robots"]', "content") === "noindex,nofollow", "Private/draft shell must stay non-indexable");
  ensure(single($, 'link[rel="canonical"]', "href") === canonical, "Self-canonical mismatch");
  const suffix = entry.notFound ? "404.html" : "", alternates = {};
  for (const language of ["ru", "en", "x-default"]) {
    const expected = `https://probpera.ru/planet/${language === "x-default" ? "" : language + "/"}${suffix}`;
    alternates[language] = single($, `link[rel="alternate"][hreflang="${language}"]`, "href");
    ensure(alternates[language] === expected, "Reciprocal hreflang mismatch");
  }
  ensure($('link[rel="alternate"]').length === 3, "Unexpected alternate route");
  const manifest = `/planet/${locale ? locale + "/" : ""}manifest.webmanifest`;
  ensure(single($, 'link[rel="manifest"]', "href") === manifest, "Locale manifest link mismatch");
  const social = {};
  for (const [key, expected] of Object.entries({ "og:type": "website", "og:title": title, "og:site_name": brand, "og:description": brand,
    "og:url": canonical, "og:image": "https://probpera.ru/planet/icons/icon-512.png", "og:image:alt": brand })) {
    social[key] = single($, `meta[property="${key}"]`, "content"); ensure(social[key] === expected, "Open Graph mismatch");
  }
  for (const [key, expected] of Object.entries({ "twitter:card": "summary", "twitter:title": title, "twitter:description": brand,
    "twitter:image": social["og:image"], "twitter:image:alt": brand })) {
    social[key] = single($, `meta[name="${key}"]`, "content"); ensure(social[key] === expected, "Twitter metadata mismatch");
  }
  if (locale) {
    ensure($("html").attr("data-route-language") === locale, "Prehydration route language mismatch");
    ensure(single($, 'meta[property="og:locale"]', "content") === COPY[locale].og && single($, 'meta[property="og:locale:alternate"]', "content") === COPY[locale === "ru" ? "en" : "ru"].og, "Social locale mismatch");
    ensure(single($, "body h1") === brand, "Localized raw body heading mismatch");
    const expectedText = entry.notFound ? COPY[locale].notFound : COPY[locale].opening;
    ensure($("body").text().includes(expectedText), "Localized pre-JS body text missing");
    if (!entry.notFound) ensure(single($, "body summary") === COPY[locale].recovery && $("noscript").text().includes(COPY[locale].noScript), "Localized native/noscript recovery missing");
  } else {
    ensure($("html").attr("data-pwa-neutral-entry") !== undefined, "x-default needs a real neutral shell");
    for (const language of ["ru", "en"]) ensure($(`body a[hreflang="${language}"][href="/planet/${language}/"]`).length === 1 && $(`body [lang="${language}"]`).text().includes(COPY[language].brand), "Neutral language choice missing");
  }
  const jsonLdBlocks = $('script[type="application/ld+json"]').length;
  ensure(jsonLdBlocks === 0 && $('link[rel="sitemap"]').length === 0, "Private shell unexpectedly advertises public discovery data");
  ensure(entry.notFound ? $("script").length === 0 : $('script[type="module"][src^="/planet/"]').length === 1, "Static recovery/module shape mismatch");
  return { route: response.route, file: entry.file, status: response.status, responseSha256: sha(response.bytes), bytes: response.bytes.length,
    rawBeforeJavaScript: true, htmlLang: locale ?? "", title, description: brand, heading: locale ? brand : $("body h1").text().trim(),
    localizedBodyText: locale ? (entry.notFound ? COPY[locale].notFound : COPY[locale].opening) : "Both language choices observed",
    canonical, alternates, manifest, robots: "noindex,nofollow", social, socialImageFile: icons[1], jsonLdBlocks,
    sitemapLinks: 0, runtimeLanguageSwitchVerified: false };
}

async function probe(repo, report) {
  const recordBytes = await boundedFile(repo, CANDIDATE.record, 128 * 1024);
  const manifestBytes = await boundedFile(repo, CANDIDATE.manifest, 512 * 1024);
  ensure(sha(recordBytes) === CANDIDATE.recordSha && sha(manifestBytes) === CANDIDATE.manifestSha, "Historical record/manifest pin mismatch");
  const record = JSON.parse(utf8(recordBytes)), sourceManifest = JSON.parse(utf8(manifestBytes));
  ensure(record.pass === true && record.localQaAuthority === true && record.installedDevice === false && record.sourceCommit === CANDIDATE.sourceCommit
    && record.buildId === CANDIDATE.buildId && record.sourceInputsSha256 === CANDIDATE.sourceInputsSha
    && record.sourceManifest.sha256 === CANDIDATE.manifestSha && record.artifact.artifactSha256 === CANDIDATE.descriptorSha, "Candidate record binding mismatch");
  const artifactRoot = await realpath(CANDIDATE.artifactRoot);
  ensure(artifactRoot === path.resolve(CANDIDATE.artifactRoot) && await realpath(record.artifact.path) === artifactRoot, "Unexpected artifact root");
  const descriptorBytes = await boundedFile(artifactRoot, "artifact.json", 512 * 1024);
  ensure(sha(descriptorBytes) === CANDIDATE.descriptorSha, "Artifact descriptor pin mismatch");
  const descriptor = JSON.parse(utf8(descriptorBytes));
  ensure(descriptor.kind === "literary-planet-controlled-pwa-preparation" && descriptor.releaseReady === false && descriptor.localQaAuthority === true
    && descriptor.buildId === CANDIDATE.buildId && descriptor.sourceCommit === CANDIDATE.sourceCommit && descriptor.sourceInputs.sha256 === CANDIDATE.sourceInputsSha
    && JSON.stringify(descriptor.requiredLocales) === '["ru","en"]' && Array.isArray(descriptor.inventory) && descriptor.inventory.length <= 2048, "Descriptor scope mismatch");
  ensure(Array.isArray(sourceManifest.files) && sourceManifest.files.length === record.sourceManifest.fileCount, "Source manifest shape mismatch");
  report.binding = { classification: "Retained D220 candidate; seven current listed owner identities only", buildId: CANDIDATE.buildId,
    runtimeSourceCommit: CANDIDATE.sourceCommit, sourceInputsSha256: CANDIDATE.sourceInputsSha, recordSha256: sha(recordBytes),
    sourceManifestSha256: sha(manifestBytes), descriptorSha256: sha(descriptorBytes), artifactRoot, currentOwners: [], fullDependencyClosureVerified: false, fullArtifactRehashed: false };
  for (const owner of OWNERS) {
    const rows = sourceManifest.files.filter(row => row.path === owner); ensure(rows.length === 1, "Missing/duplicate source owner binding");
    const bytes = await boundedFile(repo, owner, 8 * 1024 * 1024); ensure(sha(bytes) === rows[0].sha256, "Current listed owner changed: " + owner);
    report.binding.currentOwners.push({ path: owner, sha256: sha(bytes), matchedAuthenticatedD220Manifest: true });
  }
  const files = new Map();
  for (const file of [...HTML.map(row => row.file), ...MANIFESTS.map(row => row.file), "icons/icon-192.png", "icons/icon-512.png"]) {
    const rows = descriptor.inventory.filter(row => row.path === file); ensure(rows.length === 1, "Missing/duplicate fixed artifact route");
    const bytes = await boundedFile(artifactRoot, file, MAX_RESPONSE);
    ensure(bytes.length === rows[0].bytes && sha(bytes) === rows[0].sha256, "Fixed artifact entry hash mismatch: " + file); files.set(file, bytes);
  }
  const icons = [192, 512].map(size => {
    const file = `icons/icon-${size}.png`, bytes = files.get(file);
    ensure(bytes.length >= 24 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" && bytes.subarray(12, 16).toString("ascii") === "IHDR"
      && bytes.readUInt32BE(16) === size && bytes.readUInt32BE(20) === size, "Actual social/manifest PNG size mismatch");
    return { file, sha256: sha(bytes), width: size, height: size };
  });
  const require = createRequire(path.join(repo, "package.json")), { load } = require("cheerio");
  ensure(typeof load === "function", "Existing local Cheerio parser unavailable");
  const routes = new Map([...HTML.map(row => [row.route, { ...row, type: "text/html; charset=utf-8" }]),
    ...MANIFESTS.map(row => [row.route, { ...row, status: 200, type: "application/manifest+json; charset=utf-8" }])]);
  const seen = []; let origin, serverRequests = 0;
  const server = createServer((req, res) => {
    const send = (status, type, bytes) => { res.writeHead(status, { "Content-Type": type, "Content-Length": bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(req.method === "HEAD" ? undefined : bytes); };
    if (!origin || req.socket.remoteAddress !== "127.0.0.1" || req.headers.host !== new URL(origin).host) return send(403, "text/plain; charset=utf-8", Buffer.from("Forbidden\n"));
    if (++serverRequests > 24) return send(429, "text/plain; charset=utf-8", Buffer.from("Probe request bound reached\n"));
    if (!["GET", "HEAD"].includes(req.method)) return send(405, "text/plain; charset=utf-8", Buffer.from("Read-only probe\n"));
    seen.push({ method: req.method, route: req.url });
    const entry = routes.get(req.url);
    return entry ? send(entry.status, entry.type, files.get(entry.file)) : send(404, "text/plain; charset=utf-8", Buffer.from("Not found\n"));
  });
  server.requestTimeout = 2000; server.headersTimeout = 2000; server.keepAliveTimeout = 1000;
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    origin = "http://127.0.0.1:" + server.address().port;
    report.http = { origin, routingScope: "Probe-only exact allowlist. Status404 for named404 documents and unknown paths is this QA harness policy; production edge routing is not verified.", html: [], manifests: [], unsupportedRoutes: [] };
    for (const entry of HTML) {
      const response = await getRaw(origin, entry.route);
      ensure(response.status === entry.status && response.contentType === "text/html; charset=utf-8" && response.headers.location === undefined
        && sha(response.bytes) === sha(files.get(entry.file)), "Raw HTTP HTML status/type/bytes mismatch");
      report.http.html.push(htmlEvidence(load, response, entry, icons));
    }
    for (const entry of MANIFESTS) {
      const response = await getRaw(origin, entry.route); ensure(response.status === 200 && response.contentType === "application/manifest+json; charset=utf-8"
        && sha(response.bytes) === sha(files.get(entry.file)), "Raw manifest response mismatch");
      const value = JSON.parse(utf8(response.bytes)), brand = entry.locale ? COPY[entry.locale].brand : COPY.ru.brand + " / " + COPY.en.brand;
      ensure(value.id === "/planet/" && value.scope === "/planet/" && value.start_url === `/planet/${entry.locale ? entry.locale + "/" : ""}`
        && value.name === brand && value.short_name === brand && value.lang === (entry.locale ?? undefined) && value.display === "standalone"
        && value.dir === "ltr" && value.theme_color === "#f67518" && value.background_color === "#f67518", "Localized manifest contract mismatch");
      ensure(Array.isArray(value.icons) && value.icons.length === 2 && value.icons.every((icon, index) => icon.src === "/planet/" + icons[index].file
        && icon.sizes === `${icons[index].width}x${icons[index].height}` && icon.type === "image/png" && icon.purpose === "any"), "Manifest actual icon binding mismatch");
      report.http.manifests.push({ route: entry.route, file: entry.file, status: response.status, responseSha256: sha(response.bytes), ...value, actualIconFiles: icons });
    }
    for (const route of ["/planet/en/__s03_missing__.html", "/planet/sitemap.xml", "/planet/ru/sitemap.xml", "/planet/en/sitemap.xml"]) {
      const response = await getRaw(origin, route); ensure(response.status === 404 && utf8(response.bytes) === "Not found\n" && response.headers.location === undefined, "Unknown route must not receive a fake successful shell");
      report.http.unsupportedRoutes.push({ route, status: response.status, responseSha256: sha(response.bytes), harnessPolicyOnly: true, artifactCoverageClaimed: false });
    }
    const sitemapEntries = descriptor.inventory.filter(row => /(?:^|\/)(?:sitemap[^/]*|robots\.txt)$/iu.test(row.path)).map(row => row.path);
    ensure(sitemapEntries.length === 0, "Unexpected candidate discovery inventory requires explicit review");
    report.coverage = {
      jsonLd: { observedBlocks: 0, status: "INTENTIONALLY_ABSENT_PRIVATE_SHELL", sourceIntent: "Site structured data has no place in this unpublished app shell.", source: "scripts/mobile/pwa-shell.mjs:52", publicStructuredDataAcceptanceClaimed: false },
      sitemap: { descriptorEntries: sitemapEntries, status: "UNAVAILABLE_IN_CANDIDATE", noindexObservedOn: report.http.html.map(row => row.route), publicSitemapExclusionProven: false, unknownHttp404IsHarnessOnly: true },
      applicability: "152:20-34,77-92 applies public equivalent page discovery; this artifact is an unpublished noindex private app shell. Public schema/sitemap/edge coverage is not supplied by it.",
      requestedCoverageComplete: false,
    };
    report.http.requests = seen; ensure(seen.length === 13, "Unexpected HTTP probe request count");
    report.supportedSubsetPass = true; report.status = "SUPPORTED_SUBSET_PASS_WITH_EXPLICIT_COVERAGE_GAPS";
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

async function main() {
  const argumentsMap = new Map(); const args = process.argv.slice(2);
  ensure(args.length === 4, "Usage: node probe.mjs --repo <canonical-repo> --out <review/new-attempt/result.json>");
  for (let index = 0; index < args.length; index += 2) { ensure(["--repo", "--out"].includes(args[index]) && !argumentsMap.has(args[index]), "Unknown or duplicate option"); argumentsMap.set(args[index], args[index + 1]); }
  const out = await outputPath(argumentsMap.get("--out"));
  const report = { schemaVersion: 1, kind: "s03-passive-retained-candidate-prehydration-http", capturedAt: new Date().toISOString(),
    status: "FAILED_CLOSED", supportedSubsetPass: false, requestedCoverageComplete: false, probeSourceSha256: sha(await readFile(fileURLToPath(import.meta.url))),
    noClaims: { JavaScriptExecuted: false, browserStarted: false, serviceWorkerRegistered: false, browserStorageTouched: false, runtimeLanguageSwitchVerified: false,
      licenseSigned: false, newQaAuthorityCreated: false, built: false, installed: false, productionEdgeVerified: false, fullBIL079Passed: false, stageAccepted: false, releaseReady: false },
    mutationScope: "Only this new external report. Candidate, repository, state, prior evidence and artifact bytes are read-only." };
  try {
    const repo = await realpath(argumentsMap.get("--repo")); ensure(repo === await realpath(CANONICAL_REPO), "Use the existing canonical repository only");
    await probe(repo, report);
  } catch (error) { report.error = String(error.message).slice(0, 1600); process.exitCode = 1; }
  const encoded = JSON.stringify(report, null, 2) + "\n"; ensure(Buffer.byteLength(encoded) <= MAX_REPORT, "Report exceeds bound");
  await writeFile(out, encoded, { encoding: "utf8", flag: "wx" });
  process.stdout.write(JSON.stringify({ status: report.status, supportedSubsetPass: report.supportedSubsetPass, requestedCoverageComplete: false, output: out, reportSha256: sha(Buffer.from(encoded)) }) + "\n");
}
main().catch(error => { process.stderr.write(String(error.message).slice(0, 1600) + "\n"); process.exitCode = 1; });
