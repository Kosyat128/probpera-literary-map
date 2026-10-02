import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const root = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
const require = createRequire(pathToFileURL(root + "/package.json"));
const { defineConfig } = require("@playwright/test");
assert.equal(process.env.S03_BROWSER_CHANNEL, "msedge");
assert.match(process.env.PWA_QA_ORIGIN ?? "", /^http:\/\/127\.0\.0\.1:\d{1,5}$/u);
assert.match(process.env.PWA_QA_CONTROL_PATH ?? "", /^\.tmp\/pwa-qa\/[A-Za-z0-9._-]+\.json$/u);
assert.match(process.env.S03_D268_SOURCE_COMMIT ?? "", /^[a-f0-9]{40}$/u);
assert.ok(process.env.S03_PWA_OUTPUT && process.env.S03_PWA_REPORT);
assert.equal(execFileSync("git", ["-c", "safe.directory=D:/CodexProjects/Работа по сайту/literary-planet-v12-work", "rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(), process.env.S03_D268_SOURCE_COMMIT);
assert.equal(createHash("sha256").update(readFileSync(root + "/tests/pwa/controlled-pwa.spec.mjs")).digest("hex"), "ae759ca67eeed6aed33344c7a57777ae0b7ea29de8f2a5b570b17057798fb675");

// The ROOT-reviewed producer supplies one live QA authority/server; no webServer or build here.
export default defineConfig({
  testDir: root + "/tests/pwa", testMatch: ["controlled-pwa.spec.mjs"],
  grep: /saved Booky size survives a full persistent browser restart offline through the real Web preference port$/u,
  timeout: 240000, expect: { timeout: 15000 }, fullyParallel: false,
  workers: 1, retries: 0, forbidOnly: true, outputDir: process.env.S03_PWA_OUTPUT,
  reporter: [["json", { outputFile: process.env.S03_PWA_REPORT }]],
  projects: [{ name: "s03-d268-msedge-390", use: {
    baseURL: process.env.PWA_QA_ORIGIN, channel: "msedge", viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, hasTouch: true, serviceWorkers: "allow", reducedMotion: "reduce",
    screenshot: "only-on-failure", trace: "off", video: "off",
  } }],
});
