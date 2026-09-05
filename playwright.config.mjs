import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

function builtPreviewBasePath() {
  const indexPath = new URL("./dist/index.html", import.meta.url);
  if (!existsSync(indexPath)) return "/probpera-literary-map/";
  const html = readFileSync(indexPath, "utf8");
  const assetPath = html.match(/(?:src|href)=["']([^"']*\/assets\/[^"']+)["']/u)?.[1];
  if (!assetPath?.startsWith("/")) return "/probpera-literary-map/";
  const marker = assetPath.indexOf("/assets/");
  return marker === 0 ? "/" : `${assetPath.slice(0, marker)}/`;
}

const previewBasePath = builtPreviewBasePath();
const previewPort = Number.parseInt(process.env.PLAYWRIGHT_PORT ?? "4173", 10);
const previewOrigin = `http://127.0.0.1:${previewPort}`;
const suite = process.env.PLAYWRIGHT_SUITE;
const premiumGlobeSpec = "**/premium-globe-exploration.spec.mjs";
// Homepage navigation and layout checks also activate the real globe while scrolling.
const webglRegressionSpecs = [
  "**/archive-search-calendar.spec.mjs",
  "**/globe-runtime.spec.mjs",
  "**/globe-visual-regression.spec.mjs",
  "**/literary-planet-immersion.spec.mjs",
  "**/navigation-layout.spec.mjs",
  "**/public-doc-refinements.spec.mjs",
  "**/public-smoke.spec.mjs",
  "**/responsive-reader-globe.spec.mjs",
  "**/stage5-baseline.spec.mjs",
  "**/stage5b-art-direction.spec.mjs",
  "**/stage5c-layout-community.spec.mjs",
  // The ten-width homepage matrix enters the shelf preload range while resizing.
  // Its real Canvas must share the serial GPU lane with the other WebGL checks.
  "**/typography-and-card-geometry.spec.mjs",
  "**/ui-foundation.spec.mjs",
];

function suiteSelectionFor(name) {
  if (name === "premium-globe") return { testMatch: premiumGlobeSpec };
  if (name === "globe-visual") {
    return { testMatch: "**/globe-visual-regression.spec.mjs" };
  }
  if (name === "webgl-regression") return { testMatch: webglRegressionSpecs };
  if (name === "regression") {
    return { testIgnore: [premiumGlobeSpec, ...webglRegressionSpecs] };
  }
  return {};
}

const suiteSelection = suiteSelectionFor(suite);

export default defineConfig({
  testDir: "tests/e2e",
  // Visual baselines use explicit desktop/mobile names, so keeping the path
  // platform-neutral lets the same approved PNGs run on Windows and Linux CI.
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  ...suiteSelection,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Multiple WebGL globes can starve the shared GitHub runner and turn
  // otherwise healthy interaction checks into unrelated 45-second timeouts.
  workers:
    process.env.CI &&
    (suite === "premium-globe" ||
      suite === "webgl-regression" ||
      suite === "globe-visual")
      ? 1
      : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: previewOrigin,
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${previewPort}`,
    url: previewOrigin,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 60_000,
    env: {
      ...process.env,
      PUBLIC_SITE_BASE_PATH: previewBasePath,
    },
  },
});
