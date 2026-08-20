import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = process.cwd();
const counterPattern = /^[1-9]\d{0,14}$/u;

export function validateMetrikaCounterId(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return { configured: false, counterId: "" };
  if (!counterPattern.test(normalized) || !Number.isSafeInteger(Number(normalized))) {
    throw new Error(
      "YANDEX_METRIKA_COUNTER_ID must be a positive safe numeric counter identifier"
    );
  }
  return { configured: true, counterId: normalized };
}

async function sourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(entryPath));
    else if (/\.(?:ts|tsx)$/u.test(entry.name) && !/\.test\./u.test(entry.name)) {
      files.push(entryPath);
    }
  }
  return files;
}

async function main() {
  const requireEnvironment = process.argv.includes("--require-env");
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== "--require-env");
  if (unknownArguments.length) {
    throw new Error(`Unknown argument: ${unknownArguments[0]}`);
  }

  const config = validateMetrikaCounterId(
    process.env.YANDEX_METRIKA_COUNTER_ID
  );
  const [
    viteConfig,
    mainSource,
    trackerSource,
    consentSource,
    indexHtml,
    cloudflarePolicy,
  ] =
    await Promise.all([
      fs.readFile(path.join(projectRoot, "vite.config.ts"), "utf8"),
      fs.readFile(path.join(projectRoot, "src", "main.tsx"), "utf8"),
      fs.readFile(
        path.join(projectRoot, "src", "analytics", "yandexMetrika.ts"),
        "utf8"
      ),
      fs.readFile(
        path.join(projectRoot, "src", "analytics", "AnalyticsConsent.tsx"),
        "utf8"
      ),
      fs.readFile(path.join(projectRoot, "index.html"), "utf8"),
      fs.readFile(
        path.join(
          projectRoot,
          "scripts",
          "cloudflare",
          "configure-edge-security.mjs"
        ),
        "utf8"
      ),
    ]);
  const errors = [];
  const check = (condition, message) => {
    if (!condition) errors.push(message);
  };

  check(
    viteConfig.includes("process.env.YANDEX_METRIKA_COUNTER_ID") &&
      viteConfig.includes("__YANDEX_METRIKA_COUNTER_ID__"),
    "Vite must inject the public YANDEX_METRIKA_COUNTER_ID at build time"
  );
  check(
    mainSource.includes("startYandexMetrika()") &&
      mainSource.includes("!cmsEditMode && <AnalyticsConsent />") &&
      mainSource.includes("useAnalyticsConsent()") &&
      mainSource.includes("<ConsentAwareActivityTracker />") &&
      mainSource.includes("<ActivityTracker />"),
    "public analytics must stay outside CMS preview, expose a consent choice, and gate first-party tracking"
  );
  check(
    trackerSource.includes("defer: true") &&
      trackerSource.includes('"hit"') &&
      trackerSource.includes('"pushState"') &&
      trackerSource.includes('"replaceState"') &&
      trackerSource.includes("webvisor: false") &&
      trackerSource.includes("readAnalyticsConsent()"),
    "Metrika must track every SPA history transition, disable Webvisor, and wait for consent"
  );
  check(
    consentSource.includes('aria-controls="analytics-consent-panel"') &&
      consentSource.includes('setAnalyticsConsent("denied")'),
    "visitors must be able to reopen analytics settings and withdraw consent"
  );
  check(
    !/mc\.yandex\.ru\/(?:metrika\/tag\.js|watch\/)|\bym\s*\(/u.test(indexHtml),
    "index.html must not load Metrika before consent"
  );
  check(
    cloudflarePolicy.includes(
      "script-src 'self' https://mc.yandex.ru https://yastatic.net"
    ) && cloudflarePolicy.includes("https://mc.yandex.kz"),
    "production CSP must permit the documented Metrika script and regional endpoints"
  );

  const sources = await sourceFiles(path.join(projectRoot, "src"));
  let loaderOccurrences = 0;
  for (const sourcePath of sources) {
    const source = await fs.readFile(sourcePath, "utf8");
    loaderOccurrences += (
      source.match(/https:\/\/mc\.yandex\.ru\/metrika\/tag\.js/gu) || []
    ).length;
  }
  check(
    loaderOccurrences === 1,
    `exactly one production Metrika loader is allowed; found ${loaderOccurrences}`
  );
  if (requireEnvironment) {
    check(config.configured, "YANDEX_METRIKA_COUNTER_ID is required for production");
  }

  const summary = {
    status: errors.length ? "failed" : "ready",
    counterConfigured: config.configured,
    consentRequired: true,
    webvisorEnabled: false,
    loaderOccurrences,
    errors,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (errors.length) process.exitCode = 1;
}

const entryPoint = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : "";
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
