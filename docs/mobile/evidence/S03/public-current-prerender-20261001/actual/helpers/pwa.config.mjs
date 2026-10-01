import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const root = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
const require = createRequire(pathToFileURL(root + "/package.json"));
const { defineConfig } = require("@playwright/test");
assert.match(process.env.D249_PUBLIC_ORIGIN ?? "", /^http:\/\/127\.0\.0\.1:\d{1,5}$/u);
assert.ok(process.env.D249_PUBLIC_OUTPUT && process.env.D249_PUBLIC_REPORT);
export default defineConfig({
  testDir: root + "/tests/e2e", testMatch: "public-locales.spec.mjs",
  grep: /public RU\/EN shells have matching metadata before JavaScript$/u,
  timeout: 60000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: process.env.D249_PUBLIC_OUTPUT,
  reporter: [["json", { outputFile: process.env.D249_PUBLIC_REPORT }]],
  projects: [{ name: "s03-public-prerender-request-only", use: { baseURL: process.env.D249_PUBLIC_ORIGIN } }],
});
