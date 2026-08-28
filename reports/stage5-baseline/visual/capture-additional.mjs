import { createServer } from "node:http";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require(
  "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
);

const RELEASE_SHA = "8c24038510324d00086afe05b8de78b0f09ae52e";
const SITE = "C:/Users/User/AppData/Local/Temp/probpera-stage5a-artifact-9517505146/site";
const OUT = path.resolve("reports/stage5-baseline/visual");
const SESSION_PATH = path.join(OUT, "capture-session.json");
const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);

const run = {
  releaseSha: RELEASE_SHA,
  method: "exact official production artifact 9517505146 served read-only over loopback",
  createdArtifacts: [],
  blockedMutations: [],
  browserLogs: [],
  checks: {},
};

function contentPath(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]).replace(/^\/+/, "");
  const candidate = path.resolve(SITE, clean || "index.html");
  if (!candidate.toLowerCase().startsWith(path.resolve(SITE).toLowerCase())) return null;
  return candidate;
}

async function readStatic(urlPath) {
  let candidate = contentPath(urlPath);
  if (!candidate) return null;
  try {
    const stat = await fs.stat(candidate);
    if (stat.isDirectory()) candidate = path.join(candidate, "index.html");
    return { body: await fs.readFile(candidate), ext: path.extname(candidate).toLowerCase() };
  } catch {
    if (!path.extname(urlPath)) {
      const fallback = path.join(SITE, "index.html");
      return { body: await fs.readFile(fallback), ext: ".html" };
    }
    return null;
  }
}

async function startServer() {
  const server = createServer(async (request, response) => {
    const item = await readStatic(request.url || "/");
    if (!item) {
      response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    response.writeHead(200, {
      "content-type": MIME.get(item.ext) || "application/octet-stream",
      "cache-control": "no-store",
      "x-stage5a-release": RELEASE_SHA,
    });
    response.end(request.method === "HEAD" ? undefined : item.body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { server, baseUrl: `http://127.0.0.1:${address.port}/` };
}

function attachLogs(page, label) {
  const entry = {
    label,
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailures: [],
    responseErrors: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") entry.consoleErrors.push(message.text());
    if (message.type() === "warning") entry.consoleWarnings.push(message.text());
  });
  page.on("pageerror", (error) => entry.pageErrors.push(String(error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText || "unknown";
    entry.requestFailures.push(`${request.method()} ${request.url()} :: ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) entry.responseErrors.push(`${response.status()} ${response.url()}`);
  });
  run.browserLogs.push(entry);
  return entry;
}

async function newPage(browser, baseUrl, { locale = "ru", width = 1440, height = 900, label }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      run.blockedMutations.push({ label, method, url: request.url() });
      await route.abort("blockedbyclient");
      return;
    }
    const url = new URL(request.url());
    if (["www.googletagmanager.com", "www.google-analytics.com", "mc.yandex.ru"].includes(url.hostname)) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  const page = await context.newPage();
  attachLogs(page, label);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".site-header").waitFor({ state: "visible", timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1_000);
  if (locale === "en") {
    await page.locator(".interface-language-control button", { hasText: "EN" }).first().click();
    await page.waitForFunction(() => document.documentElement.lang === "en", null, { timeout: 10_000 });
    await page.waitForTimeout(350);
  }
  return { context, page };
}

async function ensureReady(page, selector, timeout = 60_000) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout });
  return locator;
}

async function screenshotLocator(page, selector, relativePath, extra = {}) {
  const locator = await ensureReady(page, selector);
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  const box = await locator.boundingBox();
  await locator.screenshot({ path: path.join(OUT, relativePath), type: "webp", quality: 76, animations: "disabled" });
  run.createdArtifacts.push({ path: relativePath.replaceAll("\\", "/"), selector, boundingBox: box, ...extra });
  return locator;
}

async function screenshotViewport(page, relativePath, extra = {}) {
  await page.screenshot({ path: path.join(OUT, relativePath), type: "webp", quality: 76, fullPage: false, animations: "disabled" });
  run.createdArtifacts.push({ path: relativePath.replaceAll("\\", "/"), ...extra });
}

async function bookDetail(browser, baseUrl, locale) {
  const label = `additional-book-detail-${locale}`;
  const { context, page } = await newPage(browser, baseUrl, { locale, label });
  try {
    await ensureReady(page, "#books .archive-book-detail");
    await page.locator("#books .archive-book-detail").first().click();
    await ensureReady(page, "#book-archive-detail");
    await screenshotLocator(page, "#book-archive-detail", `closeups/book-detail-${locale}.webp`, {
      kind: "closeup",
      locale,
      state: "first public archive book expanded; save/follow controls not activated",
    });
  } finally {
    await context.close();
  }
}

async function followWriter(browser, baseUrl) {
  const { context, page } = await newPage(browser, baseUrl, { label: "additional-follow-writer" });
  try {
    const index = await ensureReady(page, "details.atlas-country-index > summary");
    await index.click();
    const country = await ensureReady(page, "details.atlas-country-index > div > button");
    await country.click();
    await ensureReady(page, ".country-panel");
    const writer = await ensureReady(page, ".country-panel .writer-row");
    await writer.click();
    await ensureReady(page, ".writer-detail .archive-subscribe.is-writer");
    await screenshotLocator(page, ".writer-detail", "closeups/follow-writer.webp", {
      kind: "closeup",
      locale: "ru",
      state: "first listed country and writer selected; follow button not activated",
    });
  } finally {
    await context.close();
  }
}

async function stateCaptures(browser, baseUrl) {
  const { context, page } = await newPage(browser, baseUrl, { label: "additional-interaction-states" });
  try {
    await page.evaluate(() => scrollTo(0, 0));
    await screenshotViewport(page, "states/default-home-1440x900.webp", {
      kind: "state",
      state: "default",
      locale: "ru",
      viewport: { width: 1440, height: 900 },
    });

    const searchTrigger = await ensureReady(page, ".global-search-trigger");
    await searchTrigger.hover();
    await screenshotViewport(page, "states/hover-global-search-1440x900.webp", {
      kind: "state",
      state: "hover",
      target: ".global-search-trigger",
    });

    const box = await searchTrigger.boundingBox();
    if (!box) throw new Error("global search trigger has no bounding box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await screenshotViewport(page, "states/active-global-search-1440x900.webp", {
      kind: "state",
      state: "active",
      target: ".global-search-trigger",
      method: "real pointer down held during raster; released without click",
    });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const openSearch = page.locator(".global-search");
    if (await openSearch.isVisible().catch(() => false)) {
      await page.locator(".global-search button[aria-label]").first().click();
      await openSearch.waitFor({ state: "hidden", timeout: 5_000 });
    }

    const articlesSummary = await ensureReady(page, "details.articles-menu > summary");
    await articlesSummary.click();
    await ensureReady(page, ".articles-menu[open] .articles-mega-menu");
    await screenshotViewport(page, "states/expanded-articles-menu-1440x900.webp", {
      kind: "state",
      state: "expanded",
      target: "details.articles-menu",
    });

    if (await page.locator("details.articles-menu").evaluate((element) => element.open)) {
      await articlesSummary.click();
    }
    await searchTrigger.click();
    await ensureReady(page, ".global-search");
    const field = await ensureReady(page, ".global-search-field input");
    await field.fill("zzzzzz-stage5a-no-match-8c240385");
    await page.waitForTimeout(500);
    await screenshotLocator(page, ".global-search", "states/empty-search-results.webp", {
      kind: "state",
      state: "empty",
      method: "real read-only search with deterministic no-match query",
    });

    const disabled = page.locator("button:disabled, select:disabled, input:disabled");
    const disabledCount = await disabled.count();
    const visibleDisabled = [];
    for (let index = 0; index < disabledCount; index += 1) {
      const item = disabled.nth(index);
      if (await item.isVisible()) {
        visibleDisabled.push({
          tag: await item.evaluate((element) => element.tagName.toLowerCase()),
          className: await item.evaluate((element) => element.className || ""),
          ariaLabel: await item.getAttribute("aria-label"),
          text: (await item.innerText().catch(() => "")).trim().slice(0, 160),
        });
      }
    }
    run.checks.visibleDisabledControlsInDefaultAndSearch = visibleDisabled;
  } finally {
    await context.close();
  }
}

async function mobileSheet(browser, baseUrl) {
  const { context, page } = await newPage(browser, baseUrl, {
    width: 390,
    height: 844,
    label: "additional-mobile-sheet",
  });
  try {
    await (await ensureReady(page, "details.atlas-country-index > summary")).click();
    await (await ensureReady(page, "details.atlas-country-index > div > button")).click();
    const toggle = await ensureReady(page, ".atlas-country-sheet-toggle");
    const expandedBefore = await toggle.getAttribute("aria-expanded");
    if (expandedBefore !== "true") await toggle.click();
    await ensureReady(page, ".atlas-country-sheet-content:not([aria-hidden='true'])");
    await toggle.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    await screenshotViewport(page, "states/mobile-sheet-expanded-390x844.webp", {
      kind: "state",
      state: "mobile sheet expanded",
      locale: "ru",
      viewport: { width: 390, height: 844 },
      selectedCountry: (await toggle.innerText()).trim().replace(/\s+/g, " ").slice(0, 180),
    });
  } finally {
    await context.close();
  }
}

async function readingLibraryGate(browser, baseUrl) {
  const { context, page } = await newPage(browser, baseUrl, { label: "additional-reading-library-gate" });
  try {
    await (await ensureReady(page, ".reader-button")).click();
    await ensureReady(page, ".community-hub.is-account");
    const actualLibraryVisible = await page.locator(".account-library").isVisible().catch(() => false);
    run.checks.readingLibrary = {
      visibleWithoutAuthentication: actualLibraryVisible,
      evidence: actualLibraryVisible
        ? "account-library rendered"
        : "reader entry opens the account authentication gate; account-library is absent for an unauthenticated isolated context",
    };
    if (actualLibraryVisible) {
      await screenshotLocator(page, ".account-library", "closeups/reading-library.webp", {
        kind: "closeup",
        state: "authenticated/publicly available reading library",
      });
    } else {
      await screenshotLocator(page, ".community-hub.is-account", "closeups/reading-library-auth-gate.webp", {
        kind: "availability-evidence",
        state: "unauthenticated account gate; actual reading-library content NOT MEASURED",
      });
    }

    const disabled = page.locator("button:disabled, select:disabled, input:disabled");
    const candidates = [];
    for (let index = 0; index < (await disabled.count()); index += 1) {
      const item = disabled.nth(index);
      if (await item.isVisible()) {
        candidates.push({
          selector: await item.evaluate((element) => {
            const className = typeof element.className === "string" ? element.className.trim().split(/\s+/).join(".") : "";
            return `${element.tagName.toLowerCase()}${className ? `.${className}` : ""}`;
          }),
          text: (await item.innerText().catch(() => "")).trim().slice(0, 160),
          ariaLabel: await item.getAttribute("aria-label"),
        });
      }
    }
    run.checks.visibleDisabledControlsInAccountGate = candidates;
    if (candidates.length) {
      const first = disabled.filter({ visible: true }).first();
      await first.screenshot({ path: path.join(OUT, "states/disabled-natural-control.webp"), type: "webp", quality: 76, animations: "disabled" });
      run.createdArtifacts.push({
        path: "states/disabled-natural-control.webp",
        kind: "state",
        state: "disabled",
        target: candidates[0],
        method: "naturally rendered disabled control; no DOM injection",
      });
    }
  } finally {
    await context.close();
  }
}

async function artifactIdentity() {
  const head = JSON.parse(await fs.readFile(path.join(SITE, ".well-known/probpera-release-head.json"), "utf8"));
  const js = await fs.readFile(path.join(SITE, "assets/index-ko5WhBaQ.js"));
  const css = await fs.readFile(path.join(SITE, "assets/index-Cvad-RPW.css"));
  return {
    releaseHead: head,
    matches: head.commitSha === RELEASE_SHA,
    exactAssets: {
      js: { path: "assets/index-ko5WhBaQ.js", bytes: js.length, sha256: createHash("sha256").update(js).digest("hex") },
      css: { path: "assets/index-Cvad-RPW.css", bytes: css.length, sha256: createHash("sha256").update(css).digest("hex") },
    },
  };
}

async function main() {
  await fs.mkdir(path.join(OUT, "closeups"), { recursive: true });
  await fs.mkdir(path.join(OUT, "states"), { recursive: true });
  run.artifactIdentity = await artifactIdentity();
  if (!run.artifactIdentity.matches) throw new Error("exact artifact release marker mismatch");

  const { server, baseUrl } = await startServer();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    await stateCaptures(browser, baseUrl);
    await bookDetail(browser, baseUrl, "ru");
    await bookDetail(browser, baseUrl, "en");
    await followWriter(browser, baseUrl);
    await mobileSheet(browser, baseUrl);
    await readingLibraryGate(browser, baseUrl);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }

  const existing = JSON.parse(await fs.readFile(SESSION_PATH, "utf8"));
  const newPaths = new Set(run.createdArtifacts.map((item) => item.path));
  existing.createdArtifacts = [
    ...(existing.createdArtifacts || []).filter((item) => !newPaths.has(item.path)),
    ...run.createdArtifacts,
  ];
  existing.blockedMutations = [...(existing.blockedMutations || []), ...run.blockedMutations];
  existing.browserLogs = [...(existing.browserLogs || []), ...run.browserLogs];
  existing.additionalCapture = run;
  await fs.writeFile(SESSION_PATH, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
}

await main();
