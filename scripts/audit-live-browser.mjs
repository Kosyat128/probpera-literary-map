import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const DEFAULT_SITE_URL = "https://probpera.ru";
const ALLOWED_HOSTS = new Set(["probpera.ru", "www.probpera.ru"]);
const OUTPUT_DIRECTORY = path.resolve("reports", "live-browser");
const REPORT_PATH = path.join(OUTPUT_DIRECTORY, "report.json");
const MAX_CRAWLED_ROUTES = 8;
const NAVIGATION_TIMEOUT_MS = 45_000;

function normalizeSiteUrl(rawValue = DEFAULT_SITE_URL) {
  const url = new URL(String(rawValue).trim());
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(
      "PUBLIC_SITE_URL must be https://probpera.ru or https://www.probpera.ru"
    );
  }
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function routeIsSafe(url, origin) {
  return (
    url.origin === origin &&
    !url.pathname.startsWith("/admin") &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/auth/") &&
    !url.pathname.startsWith("/reset-password") &&
    !url.pathname.startsWith("/.well-known/")
  );
}

function installErrorCollection(page, label, errors) {
  page.on("pageerror", (error) => {
    errors.push({ label, kind: "pageerror", message: error.message });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!/uncaught|typeerror|referenceerror|securityerror|quotaexceeded/iu.test(text)) {
      return;
    }
    errors.push({ label, kind: "console", message: text });
  });
}

async function assertPublicDocument(page, url, label, errors) {
  installErrorCollection(page, label, errors);
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: NAVIGATION_TIMEOUT_MS,
  });
  const status = response?.status() ?? 200;
  if (status >= 400) throw new Error(`${label} returned HTTP ${status}`);
  await page.waitForFunction(
    () => document.body?.innerText.trim().length > 20,
    undefined,
    { timeout: NAVIGATION_TIMEOUT_MS }
  );
  const bodyText = await page.locator("body").innerText();
  if (!/Проба Пера|Proba Pera/iu.test(bodyText)) {
    throw new Error(`${label} did not render the Proba Pera public shell`);
  }
  return status;
}

async function auditReleaseHead(request, siteUrl) {
  const endpoint = new URL("/.well-known/probpera-release-head.json", siteUrl);
  const response = await request.get(endpoint.toString(), {
    timeout: NAVIGATION_TIMEOUT_MS,
  });
  if (!response.ok()) {
    throw new Error(`release-head returned HTTP ${response.status()}`);
  }
  const payload = await response.json();
  const commitSha = String(payload?.commitSha || payload?.commit_sha || "");
  if (!/^[a-f0-9]{40}$/u.test(commitSha)) {
    throw new Error("release-head does not contain a valid 40-character commit SHA");
  }
  return commitSha;
}

async function auditDesktop(browser, siteUrl, report) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  const page = await context.newPage();
  const status = await assertPublicDocument(
    page,
    siteUrl.toString(),
    "desktop homepage",
    report.browserErrors
  );

  const fallbackState = await page.locator(".static-home-fallback").evaluateAll(
    (elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          width: rect.width,
          height: rect.height,
        };
      })
  );
  if (
    fallbackState.some(
      (entry) =>
        entry.display !== "none" &&
        entry.visibility !== "hidden" &&
        Number(entry.opacity) > 0 &&
        entry.width > 1 &&
        entry.height > 1
    )
  ) {
    throw new Error("the static SEO homepage fallback is visibly painted");
  }

  const routeCandidates = await page.locator("a[href]").evaluateAll(
    (anchors, expectedOrigin) =>
      anchors
        .map((anchor) => {
          try {
            const url = new URL(
              (anchor instanceof HTMLAnchorElement ? anchor.href : ""),
              window.location.href
            );
            return {
              href: url.href,
              origin: url.origin,
              pathname: url.pathname,
              search: url.search,
              hash: url.hash,
              download: anchor.hasAttribute("download"),
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .filter((entry) => entry.origin === expectedOrigin && !entry.download),
    siteUrl.origin
  );

  const routes = [
    ...new Set(
      routeCandidates
        .map((entry) => new URL(entry.href))
        .filter((url) => routeIsSafe(url, siteUrl.origin))
        .map((url) => `${url.pathname}${url.search}`)
    ),
  ]
    .filter((route) => route !== "/")
    .slice(0, MAX_CRAWLED_ROUTES);

  if (routes.length < 4) {
    throw new Error(`homepage exposed only ${routes.length} safe internal routes`);
  }

  const crawled = [];
  for (const route of routes) {
    const routePage = await context.newPage();
    try {
      const routeUrl = new URL(route, siteUrl);
      const routeStatus = await assertPublicDocument(
        routePage,
        routeUrl.toString(),
        `route ${route}`,
        report.browserErrors
      );
      crawled.push({ route, status: routeStatus });
    } finally {
      await routePage.close();
    }
  }

  await context.close();
  return { status, fallbackState, crawled };
}

async function auditBlockedStorage(browser, siteUrl, report) {
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addInitScript(() => {
    const blocked = (name) => {
      throw new DOMException(`${name} blocked by smoke audit`, "SecurityError");
    };
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => blocked("localStorage"),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      get: () => blocked("sessionStorage"),
    });
  });
  const page = await context.newPage();
  const status = await assertPublicDocument(
    page,
    siteUrl.toString(),
    "blocked-storage homepage",
    report.browserErrors
  );
  const bodyText = await page.locator("body").innerText();
  if (/не удалось запустить|application failed to start/iu.test(bodyText)) {
    throw new Error("blocked browser storage triggered the bootstrap failure view");
  }
  await context.close();
  return { status };
}

async function auditMobile(browser, siteUrl, report) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const status = await assertPublicDocument(
    page,
    siteUrl.toString(),
    "mobile homepage",
    report.browserErrors
  );
  await page.evaluate(() => document.fonts?.ready);
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  if (
    geometry.documentWidth > geometry.viewport + 2 ||
    geometry.bodyWidth > geometry.viewport + 2
  ) {
    throw new Error(
      `mobile horizontal overflow: viewport=${geometry.viewport}, document=${geometry.documentWidth}, body=${geometry.bodyWidth}`
    );
  }
  await context.close();
  return { status, geometry };
}

export async function runLiveBrowserAudit({
  siteUrl: rawSiteUrl = process.env.PUBLIC_SITE_URL || DEFAULT_SITE_URL,
} = {}) {
  const siteUrl = normalizeSiteUrl(rawSiteUrl);
  await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const report = {
    status: "running",
    siteUrl: siteUrl.toString(),
    checkedAt: new Date().toISOString(),
    releaseCommitSha: "",
    browserErrors: [],
    desktop: null,
    blockedStorage: null,
    mobile: null,
    failure: null,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const request = await browser.newContext({ serviceWorkers: "block" });
    try {
      report.releaseCommitSha = await auditReleaseHead(request.request, siteUrl);
    } finally {
      await request.close();
    }
    report.desktop = await auditDesktop(browser, siteUrl, report);
    report.blockedStorage = await auditBlockedStorage(browser, siteUrl, report);
    report.mobile = await auditMobile(browser, siteUrl, report);
    if (report.browserErrors.length) {
      throw new Error(
        `browser emitted ${report.browserErrors.length} fatal error event(s)`
      );
    }
    report.status = "ready";
  } catch (error) {
    report.status = "failed";
    report.failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await browser.close();
    await fs.writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return report;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  runLiveBrowserAudit()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
