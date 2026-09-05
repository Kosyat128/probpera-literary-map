import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

const bundle = await build({ write: false, bundle: true, format: "iife", globalName: "DossierProgressAudit",
  define: { "process.env.NODE_ENV": '"production"' },
  stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { usePublishedBookDossier } from './src/books/usePublishedBookDossier';
import { createBookDossierGraphFixture } from './scripts/lib/book-dossier-graph-fixture';
export async function start() {
  const fixture = await createBookDossierGraphFixture({ now: Date.now() });
  window.progressRequests = [];
  window.expireResponse = false;
  window.failResponse = false;
  window.fetch = async (_url, options) => {
    const request = JSON.parse(options.body).p_request;
    window.progressRequests.push(request);
    if (window.failResponse) return new Response('null', {status:200});
    const document = structuredClone(fixture.document);
    document.readingMode = request.mode;
    document.bookKey = request.bookKey;
    document.validUntil = new Date(Date.now() + (window.expireResponse ? 350 : 60000)).toISOString();
    document.progressSteps = [{id:'identity-item',label:'Fixture identity'},{id:'passport-item',label:'Fixture passport'}];
    for (const page of document.pages) {
      page.anchor.readingMode = request.mode;
      for (const block of page.blocks) block.anchor.readingMode = request.mode;
    }
    for (const item of document.contents) item.anchor.readingMode = request.mode;
    return new Response(JSON.stringify(document), {status:200, headers:{'Content-Type':'application/json'}});
  };
  function Probe() {
    window.progressHook = usePublishedBookDossier('test:writer:book', 'ru');
    return createElement('p', null, window.progressHook.document?.readingMode || 'pending');
  }
  const root = createRoot(document.getElementById('root'));
  root.render(createElement(Probe));
  return () => root.unmount();
}` },
  plugins: [{ name: "synthetic-public-connection", setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)supabaseConfig$/ }, () => ({ path: "connection", namespace: "synthetic-connection" }));
    builder.onLoad({ filter: /.*/, namespace: "synthetic-connection" }, () => ({ contents: 'export const supabaseConnection = {url:"https://dossier.invalid",publishableKey:"synthetic-public-key"};', loader: "js" }));
  } }],
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://dossier-audit.invalid/", route => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.goto("https://dossier-audit.invalid/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.evaluate(() => DossierProgressAudit.start());
  await page.waitForFunction(() => window.progressHook.document?.readingMode === "BEFORE_READING");
  await page.evaluate(() => window.progressHook.changeMode("DURING_READING"));
  await page.waitForFunction(() => window.progressHook.document?.readingMode === "DURING_READING");
  await page.evaluate(() => window.progressHook.changeProgress(2));
  await page.waitForFunction(() => !window.progressHook.busy && window.progressRequests.at(-1).reachedItemIds.join() === "identity-item,passport-item");
  await page.evaluate(() => window.progressHook.changeMode("AFTER_READING"));
  await page.waitForFunction(() => window.progressHook.document?.readingMode === "AFTER_READING" && window.progressRequests.at(-1).reachedItemIds.length === 0);
  await page.evaluate(() => window.progressHook.changeMode("DURING_READING"));
  await page.waitForFunction(() => window.progressHook.document?.readingMode === "DURING_READING" && window.progressHook.reachedCount === 2 && !window.progressHook.busy);
  await page.evaluate(() => { window.expireResponse = true; window.progressHook.changeSpoilers(true); });
  await page.waitForFunction(() => window.progressHook.showingSpoilers);
  await page.evaluate(() => { window.failResponse = true; });
  await page.waitForFunction(() => !window.progressHook.document && !window.progressHook.showingSpoilers);
  // The failed refresh must clear a no-longer-valid checkpoint once, then stop.
  await page.waitForFunction(() => window.progressRequests.at(-1).reachedItemIds.length === 0 && !window.progressHook.busy);
  const requests = await page.evaluate(() => window.progressRequests);
  if (errors.length || requests.length > 12) throw new Error(JSON.stringify({ errors, requestCount: requests.length }));
  const report = { capturedAt: new Date().toISOString(), scope: "Actual React hook and public parser with a synthetic local RPC response; no live CMS writes.",
    orderedPrefix: true, afterModeEmptyPrefix: true, localProgressAcrossModes: true, expiredPayloadRemoved: true,
    expiredSpoilerIndicatorRemoved: true, invalidProgressReset: true, errors, requests };
  await mkdir("reports/bookshelf-owner-evidence", { recursive: true });
  await writeFile("reports/bookshelf-owner-evidence/dossier-progress-hook.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, requests: requests.length }));
} finally { await browser.close(); }
