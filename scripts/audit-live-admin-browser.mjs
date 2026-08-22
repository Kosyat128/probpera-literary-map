import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

const DEFAULT_ADMIN_URL = "https://admin.probpera.ru";
const ALLOWED_ADMIN_HOST = "admin.probpera.ru";
const OUTPUT_DIRECTORY = path.resolve("reports", "live-admin-browser");
const REPORT_PATH = path.join(OUTPUT_DIRECTORY, "report.json");
const NAVIGATION_TIMEOUT_MS = 45_000;

function normalizeAdminUrl(rawValue = DEFAULT_ADMIN_URL) {
  const url = new URL(String(rawValue).trim());
  if (url.protocol !== "https:" || url.hostname !== ALLOWED_ADMIN_HOST) {
    throw new Error("ADMIN_SITE_URL must be https://admin.probpera.ru");
  }
  url.search = "";
  url.hash = "";
  return url;
}

function includesDirective(policy, directive, requiredValue) {
  return policy
    .split(";")
    .map((part) => part.trim())
    .some(
      (part) =>
        part.startsWith(`${directive} `) && part.includes(requiredValue)
    );
}

function assertSecurityHeaders(headers) {
  const csp = headers["content-security-policy"] || "";
  const cacheControl = headers["cache-control"] || "";
  const robots = headers["x-robots-tag"] || "";
  const frameOptions = headers["x-frame-options"] || "";
  const hsts = headers["strict-transport-security"] || "";

  if (!csp) throw new Error("admin response is missing Content-Security-Policy");
  if (!includesDirective(csp, "script-src", "'nonce-")) {
    throw new Error("admin script-src is missing a request nonce");
  }
  if (!includesDirective(csp, "script-src", "'strict-dynamic'")) {
    throw new Error("admin script-src is missing strict-dynamic");
  }
  if (includesDirective(csp, "script-src", "'unsafe-eval'")) {
    throw new Error("production admin script-src permits unsafe-eval");
  }
  if (!includesDirective(csp, "frame-ancestors", "'none'")) {
    throw new Error("admin CSP does not deny framing");
  }
  if (!includesDirective(csp, "object-src", "'none'")) {
    throw new Error("admin CSP does not deny object plugins");
  }
  if (!/\bno-store\b/iu.test(cacheControl)) {
    throw new Error("admin HTML is not marked no-store");
  }
  if (!/\bnoindex\b/iu.test(robots)) {
    throw new Error("admin response is not marked noindex");
  }
  if (frameOptions.toUpperCase() !== "DENY") {
    throw new Error("admin response is missing X-Frame-Options: DENY");
  }
  if (!/max-age=\d+/iu.test(hsts)) {
    throw new Error("admin response is missing HSTS");
  }

  return { csp, cacheControl, robots, frameOptions, hsts };
}

function collectBrowserErrors(page, label, output) {
  page.on("pageerror", (error) => {
    output.push({ label, kind: "pageerror", message: error.message });
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!/uncaught|typeerror|referenceerror|securityerror|hydration/iu.test(text)) {
      return;
    }
    output.push({ label, kind: "console", message: text });
  });
}

async function auditLoginPage(browser, adminUrl, report, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    isMobile: mobile,
    hasTouch: mobile,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const label = mobile ? "mobile admin login" : "desktop admin login";
  collectBrowserErrors(page, label, report.browserErrors);

  const response = await page.goto(adminUrl.toString(), {
    waitUntil: "domcontentloaded",
    timeout: NAVIGATION_TIMEOUT_MS,
  });
  const status = response?.status() ?? 200;
  if (status >= 400) throw new Error(`${label} returned HTTP ${status}`);

  const finalUrl = new URL(page.url());
  if (finalUrl.protocol !== "https:" || finalUrl.hostname !== ALLOWED_ADMIN_HOST) {
    throw new Error(`${label} redirected outside the admin origin`);
  }
  await page.waitForFunction(
    () => document.body?.innerText.trim().length > 20,
    undefined,
    { timeout: NAVIGATION_TIMEOUT_MS }
  );
  const bodyText = await page.locator("body").innerText();
  if (!/Редакци|Проба Пера|Войти|Editorial|Sign in/iu.test(bodyText)) {
    throw new Error(`${label} did not render the editorial login shell`);
  }

  const email = page.locator('input[type="email"]').first();
  const password = page.locator('input[type="password"]').first();
  await email.waitFor({ state: "visible", timeout: NAVIGATION_TIMEOUT_MS });
  await password.waitFor({ state: "visible", timeout: NAVIGATION_TIMEOUT_MS });
  const emailAutocomplete = await email.getAttribute("autocomplete");
  const passwordAutocomplete = await password.getAttribute("autocomplete");
  if (emailAutocomplete !== "email") {
    throw new Error(`${label} email autocomplete is ${emailAutocomplete || "missing"}`);
  }
  if (passwordAutocomplete !== "current-password") {
    throw new Error(
      `${label} password autocomplete is ${passwordAutocomplete || "missing"}`
    );
  }

  const securityHeaders = assertSecurityHeaders(response?.headers() || {});
  let geometry = null;
  if (mobile) {
    await page.evaluate(() => document.fonts?.ready);
    geometry = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }));
    if (
      geometry.documentWidth > geometry.viewport + 2 ||
      geometry.bodyWidth > geometry.viewport + 2
    ) {
      throw new Error(
        `admin mobile overflow: viewport=${geometry.viewport}, document=${geometry.documentWidth}, body=${geometry.bodyWidth}`
      );
    }
  }

  await context.close();
  return {
    status,
    finalUrl: finalUrl.toString(),
    emailAutocomplete,
    passwordAutocomplete,
    securityHeaders,
    geometry,
  };
}

export async function runLiveAdminBrowserAudit({
  adminUrl: rawAdminUrl = process.env.ADMIN_SITE_URL || DEFAULT_ADMIN_URL,
} = {}) {
  const adminUrl = normalizeAdminUrl(rawAdminUrl);
  await fs.mkdir(OUTPUT_DIRECTORY, { recursive: true });
  const report = {
    status: "running",
    adminUrl: adminUrl.toString(),
    checkedAt: new Date().toISOString(),
    browserErrors: [],
    desktop: null,
    mobile: null,
    failure: null,
  };

  const browser = await chromium.launch({ headless: true });
  try {
    report.desktop = await auditLoginPage(browser, adminUrl, report, false);
    report.mobile = await auditLoginPage(browser, adminUrl, report, true);
    if (report.browserErrors.length) {
      throw new Error(
        `admin browser emitted ${report.browserErrors.length} fatal error event(s)`
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
  runLiveAdminBrowserAudit()
    .then((report) => console.log(JSON.stringify(report, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
