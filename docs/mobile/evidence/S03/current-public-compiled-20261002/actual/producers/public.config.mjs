import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";

const root = process.env.D253_CANONICAL_ROOT;
assert.ok(root && path.isAbsolute(root));
const require = createRequire(path.join(root, "package.json"));
const { defineConfig, devices } = require("@playwright/test");
assert.match(process.env.D253_PUBLIC_ORIGIN ?? "", /^http:\/\/127\.0\.0\.1:\d{1,5}$/u);
for (const key of ["D253_CASE_DIRECTORY", "D253_PUBLIC_OUTPUT", "D253_PUBLIC_REPORT"]) assert.ok(path.isAbsolute(process.env[key] ?? ""));
export default defineConfig({
  testDir: process.env.D253_CASE_DIRECTORY, testMatch: "public-locales.spec.mjs",
  timeout: 45000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1, retries: 0,
  outputDir: process.env.D253_PUBLIC_OUTPUT,
  reporter: [["json", { outputFile: process.env.D253_PUBLIC_REPORT }]],
  use: { baseURL: process.env.D253_PUBLIC_ORIGIN, channel: "msedge", trace: "retain-on-failure", screenshot: "only-on-failure" },
  // Existing public desktop device profile; msedge is the previously authenticated installed QA channel.
  projects: [{ name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }],
});
