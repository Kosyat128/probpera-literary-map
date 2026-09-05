import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Real Chrome, React StrictMode and canonical global RU/EN provider/control.
// Only the public dossier transport is controlled here; client validation has
// separate tests. No reviewed content, app artifact or release evidence claimed.
const SITE = "https://dossier-hook.test";
let browser;
const bundles = new Map();
test.beforeAll(async () => {
  for (const edition of ["site", "pwa"]) {
    const result = await build({
      stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
        import React,{useState} from 'react';import{createRoot}from'react-dom/client';
        import{InterfaceLanguageProvider,useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
        import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
        import{usePublishedBookDossier}from'./src/books/usePublishedBookDossier';
        let value,language,book,setBook;
        const root=createRoot(document.getElementById('root'));
        window.__dossier={snapshot:()=>({book,language,document:value.document?{bookKey:value.document.bookKey,locale:value.document.locale,readingMode:value.document.readingMode}:null,busy:value.busy,reached:value.reachedCount,spoilers:value.showingSpoilers}),
          book:key=>setBook(key),mode:mode=>value.changeMode(mode),spoilers:show=>value.changeSpoilers(show),progress:count=>value.changeProgress(count),unmount:()=>root.unmount()};
        function View(){const locale=useInterfaceLanguage();const state=useState('fixture:writer:first');language=locale.language;book=state[0];setBook=state[1];value=usePublishedBookDossier(book,language);
          return <main><InterfaceLanguageControl/><output data-dossier-state>{JSON.stringify(window.__dossier.snapshot())}</output></main>}
        root.render(<React.StrictMode><InterfaceLanguageProvider><View/></InterfaceLanguageProvider></React.StrictMode>);
      ` }, bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
      define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false, VITE_SUPABASE_URL: "https://fixture.supabase.invalid", VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-public-key" }), __LITERARY_PLANET_EDITION__: JSON.stringify(edition), __LITERARY_PLANET_LOCAL_QA__: "false" },
      plugins: [{ name: "controlled-dossier-transport", setup(builder) {
        builder.onResolve({ filter: /bookDossierPublicClient$/ }, args => args.importer.replaceAll("\\", "/").endsWith("/src/books/usePublishedBookDossier.ts") ? { path: "transport", namespace: "dossier-test" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "dossier-test" }, () => ({ contents: "export const fetchPublishedBookDossier=options=>window.__dossierTransport(options)", loader: "js" }));
      } }],
    });
    bundles.set(edition, result.outputFiles[0].text);
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });
async function open({ edition = "site", hold = false } = {}) {
  const page = await browser.newPage(); const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url() === SITE + "/ru/" ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru" data-route-language="ru"><body><div id="root"></div></body></html>' }) : route.abort());
  await page.goto(SITE + "/ru/");
  await page.evaluate(hold => {
    const calls = [], pending = new Map(), timers = new Set(), visibility = new Set();
    const originalSet = window.setTimeout.bind(window), originalClear = window.clearTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => { const token = originalSet(() => { timers.delete(token); callback(...args); }, delay); if (delay >= 1000) timers.add(token); return token; };
    window.clearTimeout = token => { timers.delete(token); originalClear(token); };
    const add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
    document.addEventListener = (name, listener, ...args) => { if (name === "visibilitychange") visibility.add(listener); return add(name, listener, ...args); };
    document.removeEventListener = (name, listener, ...args) => { if (name === "visibilitychange") visibility.delete(listener); return remove(name, listener, ...args); };
    const state = window.__transport = { hold, fail: false, calls: () => calls.map(({ signal, ...call }) => ({ ...call, aborted: signal.aborted })), effects: () => ({ timers: timers.size, visibility: visibility.size }), resolve(id, absent = false) { const resolve = pending.get(id); if (!resolve) throw Error("No pending transport " + id); pending.delete(id); resolve(absent ? null : projection(calls.find(call => call.id === id))); } };
    function projection(call) { return { bookKey: call.bookKey, locale: call.locale, readingMode: call.mode, validUntil: new Date(Date.now() + 60_000).toISOString(), progressSteps: [{ id: "chapter-one", label: call.locale === "ru" ? "Раздел 1" : "Section 1" }, { id: "chapter-two", label: call.locale === "ru" ? "Раздел 2" : "Section 2" }] }; }
    window.__dossierTransport = options => { const call = { ...options, reachedItemIds: [...options.reachedItemIds], id: calls.length + 1 }; calls.push(call); return state.hold ? new Promise(resolve => pending.set(call.id, resolve)) : Promise.resolve(state.fail ? null : projection(call)); };
  }, hold);
  await page.addScriptTag({ content: bundles.get(edition) });
  await expect(page.locator("[data-dossier-state]")).toBeVisible();
  return { page, errors };
}
const snapshot = page => page.evaluate(() => window.__dossier.snapshot());
const latest = page => page.evaluate(() => window.__transport.calls().filter(call => !call.aborted).slice(-1)[0]);
async function language(page, locale) { await page.locator(".interface-language-control button").filter({ hasText: locale.toUpperCase() }).click(); await expect.poll(async () => (await snapshot(page)).language).toBe(locale); }
async function prepared(page) {
  await expect.poll(async () => (await snapshot(page)).document?.readingMode).toBe("BEFORE_READING");
  await page.evaluate(() => window.__dossier.mode("DURING_READING"));
  await expect.poll(async () => (await snapshot(page)).document?.readingMode).toBe("DURING_READING");
  await page.evaluate(() => window.__dossier.progress(1)); await expect.poll(async () => (await snapshot(page)).reached).toBe(1);
  await page.evaluate(() => window.__dossier.spoilers(true)); await expect.poll(async () => (await snapshot(page)).spoilers).toBe(true);
}
test("same canonical book keeps mode, explicit spoilers and canonical progress across global RU/EN", async () => {
  const { page, errors } = await open();
  try {
    await prepared(page);
    for (const locale of ["en", "ru"]) {
      await language(page, locale);
      await expect.poll(async () => (await snapshot(page)).document?.locale).toBe(locale);
      expect(await latest(page)).toMatchObject({ bookKey: "fixture:writer:first", locale, mode: "DURING_READING", revealSpoilers: "ENDING", reachedItemIds: ["chapter-one"] });
      expect(await snapshot(page)).toMatchObject({ reached: 1, spoilers: true });
    }
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
test("a different book begins with no inherited spoiler/progress choice", async () => {
  const { page } = await open();
  try {
    await prepared(page); await page.evaluate(() => window.__dossier.book("fixture:writer:second"));
    await expect.poll(async () => (await snapshot(page)).document?.bookKey).toBe("fixture:writer:second");
    expect(await latest(page)).toMatchObject({ mode: "BEFORE_READING", revealSpoilers: "NONE", reachedItemIds: [] });
    expect(await snapshot(page)).toMatchObject({ reached: 0, spoilers: false });
  } finally { await page.close(); }
});
for (const change of ["locale", "book"]) test(`a late ${change} response cannot populate the current dossier`, async () => {
  const { page, errors } = await open({ hold: true });
  try {
    const first = await latest(page);
    if (change === "locale") await language(page, "en"); else await page.evaluate(() => window.__dossier.book("fixture:writer:second"));
    await expect.poll(async () => (await latest(page)).id).toBeGreaterThan(first.id);
    const second = await latest(page);
    await page.evaluate(id => window.__transport.resolve(id), second.id);
    await expect.poll(async () => (await snapshot(page)).document?.bookKey).toBe(second.bookKey);
    await expect.poll(async () => (await snapshot(page)).document?.locale).toBe(second.locale);
    await page.evaluate(id => window.__transport.resolve(id), first.id);
    expect((await snapshot(page)).document).toMatchObject({ bookKey: second.bookKey, locale: second.locale });
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
test("temporary unavailability preserves explicit progress and spoiler intent", async () => {
  const { page } = await open();
  try {
    await prepared(page); await page.evaluate(() => { window.__transport.fail = true; }); await language(page, "en");
    await expect.poll(async () => (await snapshot(page)).busy).toBe(false);
    expect(await snapshot(page)).toMatchObject({ reached: 1, document: null });
    await page.evaluate(() => { window.__transport.fail = false; }); await language(page, "ru");
    await expect.poll(async () => (await snapshot(page)).spoilers).toBe(true);
    expect(await latest(page)).toMatchObject({ mode: "DURING_READING", revealSpoilers: "ENDING", reachedItemIds: ["chapter-one"] });
  } finally { await page.close(); }
});
test("controlled PWA creates zero remote requests, refresh timers or visibility listeners", async () => {
  const { page, errors } = await open({ edition: "pwa" });
  try {
    await language(page, "en"); await language(page, "ru"); await page.evaluate(() => window.__dossier.book("fixture:writer:second"));
    await expect.poll(async () => (await snapshot(page)).book).toBe("fixture:writer:second");
    expect(await page.evaluate(() => window.__transport.calls())).toEqual([]);
    expect(await page.evaluate(() => window.__transport.effects())).toEqual({ timers: 0, visibility: 0 });
    expect(await snapshot(page)).toMatchObject({ busy: false, document: null }); expect(errors).toEqual([]);
  } finally { await page.close(); }
});
test("StrictMode supersession and unmount cancel all pending hook timeouts and listeners", async () => {
  const { page } = await open({ hold: true });
  try {
    await language(page, "en"); await page.evaluate(() => window.__dossier.unmount());
    expect(await page.evaluate(() => window.__transport.calls().every(call => call.aborted))).toBe(true);
    expect(await page.evaluate(() => window.__transport.effects())).toEqual({ timers: 0, visibility: 0 });
  } finally { await page.close(); }
});
