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

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run preview -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      ...process.env,
      PUBLIC_SITE_BASE_PATH: previewBasePath,
    },
  },
});
