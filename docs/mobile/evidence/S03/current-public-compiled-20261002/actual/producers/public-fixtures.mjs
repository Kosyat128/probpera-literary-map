import assert from "node:assert/strict";
import path from "node:path";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";

const root = process.env.D253_CANONICAL_ROOT;
assert.ok(root && path.isAbsolute(root));
const require = createRequire(path.join(root, "package.json"));
const { test: base, expect } = require("@playwright/test");
const localOrigin = process.env.D253_PUBLIC_ORIGIN;
assert.match(localOrigin ?? "", /^http:\/\/127\.0\.0\.1:\d{1,5}$/u);

// Harness-only adaptation. The gate proves all original test bodies are unchanged.
export const test = base.extend({
  context: async ({ context }, use, info) => {
    const blocked = [];
    await context.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.origin === localOrigin || ["data:", "blob:"].includes(url.protocol)) await route.continue();
      else { blocked.push({ origin: url.origin, pathname: url.pathname }); await route.abort("blockedbyclient"); }
    });
    await use(context);
    const filename = info.outputPath("network-fence.json");
    await writeFile(filename, JSON.stringify({ allowedOrigin: localOrigin, blocked, queryOrHeadersRecorded: false }, null, 2) + "\n", { flag: "wx" });
    await info.attach("local network fence", { path: filename, contentType: "application/json" });
  },
  page: async ({ page }, use, info) => {
    await use(page);
    if (info.title !== "public locale switching keeps the globe and country while updating route metadata") return;
    if (info.status !== "passed") return;
    const screenshot = info.outputPath("current-public-en-final.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await info.attach("current public EN final", { path: screenshot, contentType: "image/png" });
  },
});
export { expect };
