import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";
import { generatePlanetAccountPages } from "../../scripts/mobile/account-pages.mjs";

// Real browser, React, AuthProvider, CommunityHub and account client. Only the
// external Supabase/service ports are controlled fixtures; no live authority,
// paid access, captcha, backend deletion or production screenshots are claimed.
const SUBJECT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const TOKEN = "fixture-existing-canonical-session";
const config = { v: 1, audience: "browser-fixture", product: "fixture-base", deletionDisclosure: {
  version: "fixture-not-legal-approval", ru: "Тестовое описание <script>window.bad=1</script>\nНе юридический документ.",
  en: "Controlled fixture <script>window.bad=1</script>\nNot a legal document.",
} };
let browser, bundle, stylesheet;
const flagAssets = new Map();
const accountAssets = new Map();
const productionStylesheets = [
  "src/pwa/pwa.css",
  "src/styles/editorial-fonts.css",
  "src/index.css",
  "src/community/community-accessibility.css",
  "src/styles/stage5-home-art-direction.css",
  "src/styles/stage5-home-layout.css",
  "src/styles/stage5-book-shelf.css",
  "src/styles/stage5f-responsive-accessibility.css",
  "src/styles/book-dossier.css",
  "src/styles/book-shelf-controls.css",
  "src/styles/book-reader-refinement.css",
  "src/styles/editorial-card-layout.css",
  "src/styles/community-editorial-layout.css",
  "src/styles/calendar-layout.css",
  "src/styles/navigation-panels.css",
  "src/styles/atlas-intro-layout.css",
  "src/styles/site-typography.css",
  "src/styles/article-reading-layout.css",
  "src/styles/search-account-layout.css",
  "src/styles/community-layout.css",
  "src/styles/header-preserved.css",
  "src/host/host.css",
  "src/pwa/account.css"
];
const productionAssets = [
  ["/brand/probpera-logo.png","image/png"],
  ["/fonts/editorial/onest-cyrillic-ext-variable.woff2","font/woff2"],
  ["/fonts/editorial/onest-cyrillic-variable.woff2","font/woff2"],
  ["/fonts/editorial/onest-latin-ext-variable.woff2","font/woff2"],
  ["/fonts/editorial/onest-latin-variable.woff2","font/woff2"],
  ["/fonts/editorial/source-sans-3-cyrillic-400-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-sans-3-latin-400-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-sans-3-cyrillic-600-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-sans-3-latin-600-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-sans-3-cyrillic-700-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-sans-3-latin-700-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-cyrillic-400-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-latin-400-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-cyrillic-400-italic.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-latin-400-italic.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-cyrillic-600-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-latin-600-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-cyrillic-700-normal.woff2","font/woff2"],
  ["/fonts/editorial/source-serif-4-latin-700-normal.woff2","font/woff2"],
];

test.beforeAll(async () => {
  const authFixture = `
    const listeners=new Set(); const calls=[];
    let session=window.__accountInitial.signedIn ? {access_token:'${TOKEN}',user:{id:'${SUBJECT}',email:'fixture@example.test'}} : null;
    function publish(next){session=next;for(const fn of listeners)fn(next?'SIGNED_IN':'SIGNED_OUT',next)}
    const auth={
      async getSession(){return {data:{session},error:null}},
      onAuthStateChange(fn){listeners.add(fn);return{data:{subscription:{unsubscribe(){listeners.delete(fn)}}}}},
      async signOut(options){calls.push({method:'signOut',options});publish(null);return{error:null}},
      async signInWithPassword(credentials){calls.push({method:'signInWithPassword',credentials});publish({access_token:'fixture-new-session',user:{id:'${SUBJECT}',email:credentials.email}});return{data:{session},error:null}},
      async signUp(credentials){calls.push({method:'signUp',credentials});return{data:{user:null,session:null},error:null}}
    };
    function query(){let proxy;proxy=new Proxy({}, {get(_,key){
      if(key==='then')return (resolve,reject)=>Promise.resolve({data:[],error:null,count:0}).then(resolve,reject);
      return ()=>proxy;
    }});return proxy}
    export const supabase={auth,from:()=>query()};
    export const isCommunityConfigured=true;
    export const isAuthTurnstileConfigured=false;
    export const supabaseConnection={url:'https://fixture.supabase.invalid',publishableKey:'fixture-public-key'};
    export async function loadSupabaseClient(){return supabase}
    window.__accountAuth={calls:()=>JSON.parse(JSON.stringify(calls)),setIdentity(subject,token){publish(subject?{access_token:token,user:{id:subject,email:'fixture@example.test'}}:null)}};
  `;
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import React from 'react';import{createRoot}from'react-dom/client';
      import{AuthProvider}from'./src/community/AuthContext';
      import{InterfaceLanguageProvider}from'./src/i18n/InterfaceLanguage';
      import PlanetAccountPage from'./src/pwa/PlanetAccountPage';
      createRoot(document.getElementById('root')).render(<React.StrictMode><InterfaceLanguageProvider><AuthProvider><PlanetAccountPage mode={window.__accountInitial.mode}/></AuthProvider></InterfaceLanguageProvider></React.StrictMode>);
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false }),
      __LITERARY_PLANET_LOCAL_QA__: "false", __LITERARY_PLANET_EDITION__: '"site"' },
    loader: { ".css": "empty" }, logLevel: "silent",
    plugins: [{ name: "explicit-supabase-test-port", setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)(?:supabase|supabaseConfig|loadSupabaseClient)$/ }, args =>
        args.path.startsWith(".") ? { path: "canonical-auth-port", namespace: "account-fixture" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "account-fixture" }, () => ({ contents: authFixture, loader: "js" }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  stylesheet = (await Promise.all(productionStylesheets.map(file => readFile(new URL("../../" + file, import.meta.url), "utf8")))).join("\n");
  for (const code of ["ru", "gb"]) {
    const pathname = "/assets/country-flags/" + code + ".svg";
    flagAssets.set(pathname, await readFile(new URL("../../public" + pathname, import.meta.url)));
  }
  for (const [pathname, contentType] of productionAssets) {
    accountAssets.set(pathname, { contentType, body: await readFile(new URL("../../public" + pathname, import.meta.url)) });
  }
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open(options = {}) {
  const mode = options.mode ?? "access", locale = options.locale ?? "en";
  const name = mode === "access" ? "planet-account" : "delete-account";
  const pathname = `/${locale}/${name}/`;
  const page = await browser.newPage({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 } });
  page.setDefaultTimeout(8000);
  const errors = [], calls = [];
  page.on("pageerror", error => errors.push(error.message));
  const state = { config: options.disclosure === false ? { ...config, deletionDisclosure: null } : config,
    bridgeSubject: options.bridgeSubject ?? SUBJECT, failFirstDeletion: options.failFirstDeletion ?? false,
    bridgePending: options.bridgePending ?? false, releaseBridge: null, request: options.request ?? null,
    statusFailure: options.statusFailure ?? false, dropFirstDeletion: options.dropFirstDeletion ?? false };
  const entries = generatePlanetAccountPages({ builtHtml: '<!doctype html><html><head><title>Fixture</title><script type="module" src="/assets/fixture.js"></script><link rel="manifest" href="/site.webmanifest"></head><body><div id="root"></div></body></html>' }).files;
  await page.addInitScript(initial => {
    window.__accountInitial = initial; history.replaceState({ retained: "navigation-state" }, "", location.href);
  }, { mode, signedIn: options.signedIn !== false });
  await page.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== "https://account-ui.test") return route.abort();
    const file = url.pathname.replace(/^\//u, "") + "index.html";
    if (Object.hasOwn(entries, file)) return route.fulfill({ contentType: "text/html", body: entries[file].replace("</head>", `<style>${stylesheet}</style></head>`) });
    if (url.pathname === "/assets/fixture.js") return route.fulfill({ contentType: "text/javascript", body: bundle });
    if (flagAssets.has(url.pathname)) return route.fulfill({ contentType: "image/svg+xml", body: flagAssets.get(url.pathname) });
    if (accountAssets.has(url.pathname)) return route.fulfill(accountAssets.get(url.pathname));
    if (url.pathname.startsWith("/planet/api/")) {
      const body = route.request().postDataJSON(); calls.push({ route: url.pathname, body, headers: route.request().headers() });
      if (url.pathname.endsWith("configuration")) return route.fulfill({ json: state.config });
      if (url.pathname.endsWith("account/deletion-status")) return state.statusFailure
        ? route.fulfill({ status: 503, json: { error: "fixture-status-unavailable" } }) : route.fulfill({ json: { request: state.request } });
      if (url.pathname.endsWith("license/bridge")) {
        if (state.request) return route.fulfill({ status: 403, json: { error: "access-denied" } });
        if (state.bridgePending) await new Promise(resolve => { state.releaseBridge = resolve; });
        return route.fulfill({ json: { subject: state.bridgeSubject } }).catch(() => {});
      }
      if (url.pathname.endsWith("account/deletion-request")) {
        if (state.failFirstDeletion) { state.failFirstDeletion = false; return route.fulfill({ status: 503, json: { error: "fixture-upstream-unavailable" } }); }
        state.request = { requestId: body.requestId, status: "requested" };
        if (state.dropFirstDeletion) { state.dropFirstDeletion = false; return route.abort("failed"); }
        return route.fulfill({ status: 202, json: { requestId: body.requestId, status: "requested" } });
      }
      return route.abort();
    }
    if (url.pathname.startsWith("/planet/")) return route.fulfill({ contentType: "text/html", body: '<!doctype html><main id="returned-to-planet"></main>' });
    return route.abort();
  });
  await page.goto(`https://account-ui.test${pathname}?returnTo=%2Fplanet%2Fru%2F%3Fcountry%3Drussia%26writer%3DQ123%23atlas#account-state`);
  await expect(page.locator("main[data-planet-account]")).toBeVisible();
  if (options.signedIn === false) await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  else if (mode === "access") await expect(page.getByRole("button", { name: locale === "en" ? "Restore access" : "Восстановить доступ", exact: true })).toBeEnabled();
  else if (options.request) await expect(page.locator(".planet-account__receipt")).toBeVisible();
  else if (options.statusFailure) await expect(page.getByRole("status").filter({ hasText: "status could not be checked" })).toBeVisible();
  else {
    await expect(page.locator(".planet-account__disclosure")).toContainText(options.disclosure === false ? "unavailable" : "fixture");
    if (options.disclosure !== false) await expect(page.locator('.planet-account__consent input')).toBeEnabled();
  }
  return { page, errors, calls, state };
}

async function productionAccountAppearance(page, locale) {
  const logo = page.locator('.planet-account__header > a img[src="/brand/probpera-logo.png"]');
  await expect.poll(() => logo.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
  const fonts = await page.evaluate(async language => {
    const text = language === "ru" ? "Удаление аккаунта" : "Account deletion";
    const loaded = await Promise.all([document.fonts.load('400 16px "Onest Local"', text), document.fonts.load('600 28px "Source Serif 4 Local"', text)]);
    await document.fonts.ready;
    return loaded.map(faces => faces.map(face => ({ family: face.family, status: face.status })));
  }, locale);
  expect(fonts.every(faces => faces.length > 0 && faces.every(face => face.status === "loaded"))).toBe(true);
  const panel = page.locator(".planet-account__panel");
  expect(await panel.evaluate(node => getComputedStyle(node).fontFamily)).toContain("Onest Local");
  expect(await panel.locator("h1").evaluate(node => getComputedStyle(node).fontFamily)).toContain("Source Serif 4 Local");
  for (const button of await panel.locator("button").all()) {
    await button.scrollIntoViewIfNeeded();
    const target = await button.boundingBox();
    expect(target).not.toBeNull();
    expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })).toBe(true);
    expect(await button.evaluate(node => getComputedStyle(node).fontFamily)).toContain("Onest Local");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo({ top: 0, left: 0, behavior: "instant" }));
}
async function loadedLanguageFlags(page, locale) {
  const control = page.locator('.planet-account__header [data-interface-language-presentation="flags"]');
  await expect(control).toHaveCount(1);
  for (const [language, code] of [["ru", "ru"], ["en", "gb"]]) {
    const button = control.locator('[data-interface-language="' + language + '"]');
    await expect(button).toHaveAccessibleName(locale === "ru"
      ? (language === "ru" ? "Русский язык" : "Английский язык")
      : (language === "ru" ? "Russian" : "English"));
    await expect(button).toHaveAttribute("aria-pressed", String(language === locale));
    const image = button.locator("img.interface-language-control__flag.country-flag-icon--round");
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("alt", "");
    await expect(image).toHaveAttribute("src", "/assets/country-flags/" + code + ".svg");
    await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    await expect(button.locator(".country-flag-icon--fallback")).toHaveCount(0);
    await expect(button.locator(".interface-language-control__selected")).toHaveCount(language === locale ? 1 : 0);
    const target = await button.boundingBox();
    expect(target).not.toBeNull();
    expect(target.width).toBeGreaterThanOrEqual(44); expect(target.height).toBeGreaterThanOrEqual(44);
  }
}
for (const mobile of [false, true]) test(`deletion remains the same bilingual form, plaintext disclosure and stable retry ID (${mobile ? "mobile" : "desktop"})`, async ({}, testInfo) => {
  const { page, calls, errors } = await open({ mode: "deletion", failFirstDeletion: true, mobile });
  try {
    await loadedLanguageFlags(page, "en");
    const consent = page.locator('.planet-account__consent input'); const original = await consent.elementHandle();
    await consent.check();
    await page.locator('[data-interface-language="ru"]').click();
    await expect(page.locator('html')).toHaveAttribute("lang", "ru");
    await expect(consent).toBeChecked();
    expect(await consent.evaluate((node, previous) => node === previous, original)).toBe(true);
    expect(new URL(page.url()).pathname).toBe("/ru/delete-account/");
    expect(new URL(page.url()).hash).toBe("#account-state");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/planet/ru/?country=russia&writer=Q123#atlas");
    expect(await page.evaluate(() => history.state)).toEqual({ retained: "navigation-state" });
    await expect(page.locator('.planet-account__disclosure')).toHaveText(config.deletionDisclosure.ru);
    await loadedLanguageFlags(page, "ru");
    if (mobile) { await productionAccountAppearance(page, "ru"); await page.screenshot({ path: testInfo.outputPath("planet-account-deletion-flags-ru.png"), fullPage: false }); }
    await page.locator('[data-interface-language="en"]').click();
    await expect(page.locator('.planet-account__disclosure')).toHaveText(config.deletionDisclosure.en);
    await loadedLanguageFlags(page, "en");
    if (mobile) {
      await productionAccountAppearance(page, "en");
      await expect(consent).toBeChecked(); await expect(consent).toBeEnabled(); await expect(consent).toBeVisible();
      expect(await consent.evaluate((node, previous) => node === previous, original)).toBe(true);
      const label = page.locator(".planet-account__consent"), observations = [], captures = ["planet-account-deletion-flags-en.png"];
      const settleNativePaint = () => page.evaluate(() => new Promise(resolve => {
        scrollTo({ top: 0, left: 0, behavior: "instant" });
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      const observeNativeConsent = async state => {
        const observation = await consent.evaluate(node => {
          const style = getComputedStyle(node), label = node.closest("label");
          const input = node.getBoundingClientRect(), target = label.getBoundingClientRect();
          const rect = value => ({ x: value.x, y: value.y, width: value.width, height: value.height });
          return {
            language: document.documentElement.lang, checked: node.checked, disabled: node.disabled,
            inputBounds: rect(input), labelBounds: rect(target),
            inputHit: document.elementFromPoint(input.left + input.width / 2, input.top + input.height / 2) === node,
            labelHit: label.contains(document.elementFromPoint(target.left + target.width / 2, target.top + target.height / 2)),
            style: { display: style.display, visibility: style.visibility, opacity: style.opacity,
              appearance: style.appearance, webkitAppearance: style.webkitAppearance,
              accentColor: style.accentColor, colorScheme: style.colorScheme },
            viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
          };
        });
        observations.push({ state, ...observation });
        expect(observation.labelBounds.height).toBeGreaterThanOrEqual(44);
        expect(observation.inputHit).toBe(true); expect(observation.labelHit).toBe(true);
      };
      await settleNativePaint(); await observeNativeConsent("checked-after-en-switch");
      await page.screenshot({ path: testInfo.outputPath("planet-account-deletion-flags-en.png"), fullPage: false });
      for (const checked of [false, true]) {
        await label.click();
        if (checked) await expect(consent).toBeChecked(); else await expect(consent).not.toBeChecked();
        await expect(consent).toBeEnabled(); await expect(consent).toBeVisible();
        expect(await consent.evaluate((node, previous) => node === previous, original)).toBe(true);
        await settleNativePaint(); await observeNativeConsent(checked ? "checked-after-label-click" : "unchecked-after-label-click");
        const filename = `planet-account-consent-en-${checked ? "checked" : "unchecked"}.png`;
        await page.screenshot({ path: testInfo.outputPath(filename), fullPage: false }); captures.push(filename);
      }
      const inputCapture = "planet-account-consent-en-native-input.png";
      await consent.screenshot({ path: testInfo.outputPath(inputCapture) }); captures.push(inputCapture);
      for (const filename of captures) await testInfo.attach(filename, { path: testInfo.outputPath(filename), contentType: "image/png" });
      const evidence = "planet-account-consent-en-observations.json";
      await writeFile(testInfo.outputPath(evidence), JSON.stringify({
        schemaVersion: 1, kind: "account-native-checkbox-paint-observations", language: "en",
        environmentChanged: false, interaction: "actual label.click", observations, captures,
        pixelsValidated: false, paintVerdict: "requires direct capture review",
        scope: "390x844 viewport React fixture with controlled Auth/API ports; no touch, OS, public-build or full visual acceptance",
      }, null, 2) + "\n", { flag: "wx" });
      await testInfo.attach("EN native checkbox observations", { path: testInfo.outputPath(evidence), contentType: "application/json" });
      await expect(consent).toBeChecked();
    }
    expect(await page.evaluate(() => window.bad)).toBeUndefined();
    await expect(page.locator('canvas,iframe,.site-header')).toHaveCount(0);
    await expect(page.locator('.interface-language-control')).toHaveCount(1);
    const submit = page.getByRole("button", { name: "Request account deletion", exact: true });
    await submit.click(); await expect(page.getByRole("status").filter({ hasText: "service is unavailable" })).toBeVisible();
    await submit.click();
    await expect(page.locator('.planet-account__receipt')).toContainText("Deletion is not yet complete");
    const requests = calls.filter(call => call.route.endsWith("account/deletion-request"));
    expect(requests).toHaveLength(2); expect(requests[0].body.requestId).toMatch(/^[a-f0-9-]{36}$/u);
    expect(requests[1].body).toEqual(requests[0].body); expect(requests[1].body.reauthToken).toBe(TOKEN);
    await expect(page.locator('.planet-account__receipt')).toContainText(requests[1].body.requestId);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole("button", { name: "Request account deletion", exact: true })).toHaveCount(0);
    expect(errors).toEqual([]); await original.dispose();
  } finally { await page.close(); }
});

test("missing server disclosure keeps deletion disabled and sends no authenticated mutation", async () => {
  const { page, calls, errors } = await open({ mode: "deletion", disclosure: false });
  try {
    await expect(page.locator('.planet-account__consent input')).toBeDisabled();
    await expect(page.getByRole("button", { name: "Request account deletion", exact: true })).toBeDisabled();
    expect(calls.filter(call => !call.route.endsWith("configuration") && !call.route.endsWith("deletion-status"))).toEqual([]); expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("a lost 202 is recovered without another bridge/mutation and survives actual browser reload", async () => {
  const { page, calls, state, errors } = await open({ mode: "deletion", dropFirstDeletion: true });
  try {
    await page.locator('.planet-account__consent input').check();
    await page.getByRole("button", { name: "Request account deletion", exact: true }).click();
    await expect(page.locator('.planet-account__receipt')).toHaveAttribute("data-deletion-status", "requested");
    const requestId = state.request.requestId;
    await expect(page.locator('.planet-account__receipt')).toContainText(requestId);
    await page.reload();
    await expect(page.locator('.planet-account__receipt')).toContainText(requestId);
    expect(calls.filter(call => call.route.endsWith("account/deletion-request"))).toHaveLength(1);
    expect(calls.filter(call => call.route.endsWith("license/bridge"))).toHaveLength(1);
    expect(new URL(page.url()).searchParams.has("requestId")).toBe(false);
    expect(await page.evaluate(() => Object.values(localStorage).some(value => value.includes("fixture-existing-canonical-session")))).toBe(false);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("unknown server status disables new deletion until explicit retry succeeds", async () => {
  const { page, calls, state, errors } = await open({ mode: "deletion", statusFailure: true });
  try {
    await expect(page.locator('.planet-account__consent input')).toBeDisabled();
    await expect(page.getByRole("button", { name: "Request account deletion", exact: true })).toBeDisabled();
    await expect(page.locator('.planet-account__receipt')).toHaveCount(0);
    expect(calls.filter(call => call.route.endsWith("account/deletion-request"))).toHaveLength(0);
    state.statusFailure = false;
    await page.getByRole("button", { name: "Check request status", exact: true }).click();
    await expect(page.locator('.planet-account__consent input')).toBeEnabled();
    await page.locator('.planet-account__consent input').check();
    await expect(page.getByRole("button", { name: "Request account deletion", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

for (const status of ["requested", "processing", "blocked", "completed"]) test(`shows exact existing server status ${status} and never submits another request`, async () => {
  const requestId = "33333333-3333-4333-8333-333333333333";
  const { page, calls, errors } = await open({ mode: "deletion", request: { requestId, status } });
  try {
    await expect(page.locator('.planet-account__receipt')).toHaveAttribute("data-deletion-status", status);
    await expect(page.locator('.planet-account__receipt')).toContainText(requestId);
    await expect(page.getByRole("button", { name: "Request account deletion", exact: true })).toHaveCount(0);
    expect(calls.filter(call => call.route.endsWith("account/deletion-request") || call.route.endsWith("license/bridge"))).toHaveLength(0);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("restoration returns to the selected locale preserving the existing country/writer/hash", async () => {
  const { page, calls, errors } = await open();
  try {
    await page.getByRole("button", { name: "Restore access", exact: true }).click();
    await expect(page.locator("#returned-to-planet")).toBeAttached();
    expect(page.url()).toBe("https://account-ui.test/planet/en/?country=russia&writer=Q123#atlas");
    const bridges = calls.filter(call => call.route.endsWith("license/bridge")); expect(bridges).toHaveLength(1);
    expect(bridges[0].headers.authorization).toBe("Bearer " + TOKEN); expect(bridges[0].body).not.toHaveProperty("subject");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("a mismatched bridge subject prevents restoration and never requests deletion", async () => {
  const { page, calls, errors } = await open({ bridgeSubject: OTHER });
  try {
    await page.getByRole("button", { name: "Restore access", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "could not be verified" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/en/planet-account/");
    expect(calls.filter(call => call.route.endsWith("deletion-request"))).toEqual([]); expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("changing the canonical account during an outstanding bridge prevents navigation", async () => {
  const { page, calls, state, errors } = await open({ bridgePending: true });
  try {
    await page.getByRole("button", { name: "Restore access", exact: true }).click();
    await expect.poll(() => !!state.releaseBridge).toBe(true);
    await page.evaluate(other => window.__accountAuth.setIdentity(other, "fixture-other-session"), OTHER);
    state.releaseBridge();
    await expect(page.getByRole("button", { name: "Restore access", exact: true })).toBeEnabled();
    expect(new URL(page.url()).pathname).toBe("/en/planet-account/");
    expect(calls.filter(call => call.route.endsWith("deletion-request"))).toEqual([]); expect(errors).toEqual([]);
  } finally { state.releaseBridge?.(); await page.close(); }
});

test("canonical CommunityHub accepts an existing short sign-in password and closes after the new session", async () => {
  const { page, errors } = await open({ signedIn: false });
  try {
    const recovery = page.locator('[data-password-recovery]');
    await recovery.locator('button[aria-expanded]').click();
    await expect(page.locator('form.auth-form')).toHaveCount(1);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator('[data-password-recovery]')).toHaveCount(0);
    const form = page.locator('.community-hub form.auth-form'); await expect(form).toBeVisible();
    await expect(page.locator('form.auth-form')).toHaveCount(1);
    const password = form.locator('input[autocomplete="current-password"]');
    await expect(password).toHaveAttribute("minlength", "1");
    await form.locator('input[type="email"]').fill("fixture@example.test"); await password.fill("short6");
    expect(await password.evaluate(node => node.validity.valid)).toBe(true);
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('.community-hub')).toHaveCount(0);
    const calls = await page.evaluate(() => window.__accountAuth.calls());
    expect(calls).toContainEqual({ method: "signInWithPassword", credentials: { email: "fixture@example.test", password: "short6" } });
    await expect(page.getByRole("button", { name: "Restore access", exact: true })).toBeEnabled();
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("signup retains the ten-character policy in browser constraints and the actual submit handler", async () => {
  const { page, errors } = await open({ signedIn: false });
  try {
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const form = page.locator('.community-hub form.auth-form'); await expect(form).toBeVisible();
    await form.locator('.auth-switch').click();
    await form.locator('input[autocomplete="nickname"]').fill("FixtureReader");
    await form.locator('input[type="email"]').fill("fixture@example.test");
    const passwords = form.locator('input[autocomplete="new-password"]');
    await expect(passwords).toHaveCount(2);
    for (const input of await passwords.all()) { await expect(input).toHaveAttribute("minlength", "10"); await input.fill("short6"); }
    await form.locator('input[type="checkbox"]').check();
    expect(await passwords.first().evaluate(node => node.validity.tooShort)).toBe(true);
    // Bypass HTML validation to exercise the unchanged signup rule in submitAuth.
    await form.evaluate(node => node.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await expect(form.locator('.auth-inline-message')).toContainText("10");
    expect(await page.evaluate(() => window.__accountAuth.calls())).toEqual([]); expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("deletion reauthentication signs out only the canonical local session before opening sign-in", async () => {
  const { page, errors } = await open({ mode: "deletion" });
  try {
    await page.getByRole("button", { name: "Sign in again", exact: true }).click();
    await expect(page.locator('.community-hub form.auth-form')).toBeVisible();
    expect(await page.evaluate(() => window.__accountAuth.calls())).toEqual([{ method: "signOut", options: { scope: "local" } }]);
    await expect(page.locator('[data-password-recovery]')).toHaveCount(0); await expect(page.locator('form.auth-form')).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
