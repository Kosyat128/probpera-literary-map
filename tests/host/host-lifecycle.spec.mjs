import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Real Chrome/React, mountHostApp, canonical provider/control, host state and
// preference serialization. App is an explicit DOM/input probe; native plugins
// are structural doubles. This is not a native build or real globe/Canvas audit.
let browser, bundle, stylesheet;
test.beforeAll(async () => {
  const appFixture = `
    import React,{useEffect}from'react';
    import{useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
    import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
    export default function App(){const{language,t}=useInterfaceLanguage();
      useEffect(()=>{window.__hostMetrics.mounts++;return()=>{window.__hostMetrics.unmounts++}},[]);
      return <main data-host-child data-language={language}><header><h1>{t('Литературная планета')}</h1></header>
        <InterfaceLanguageControl/><input aria-label="Fixture selection" defaultValue="russia"/><canvas id="host-scene-probe"/></main>}
  `;
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import{mountHostApp}from'./src/host/mountHostApp';
      import{createHostPlatformServices}from'./src/host/HostPlatformServices';
      const input=window.__hostInitial;
      const state={connected:true,isActive:true};const handles=[];const writes=[];const calls=[];
      const memory=new Map(input.preference?[['probpera-interface-language',input.preference]]:[]);
      const counts=window.__hostMetrics={mounts:0,unmounts:0,appReads:0,networkReads:0,appRegistrations:0,networkRegistrations:0};
      const app={async getState(){counts.appReads++;return{isActive:state.isActive}},async addListener(event,callback){
        counts.appRegistrations++;const handle={event,callback,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle}};
      const network={async getStatus(){counts.networkReads++;return{connected:state.connected}},async addListener(event,callback){
        counts.networkRegistrations++;const handle={event,callback,removed:false,async remove(){handle.removed=true}};handles.push(handle);return handle}};
      const preferences={async get({key}){calls.push({method:'get',key});return{value:memory.get(key)??null}},
        set({key,value}){calls.push({method:'set',key,value});return new Promise((resolve,reject)=>writes.push({key,value,resolve,reject,settled:false}))},
        async remove({key}){calls.push({method:'remove',key});memory.delete(key)}};
      const failures=[];
      const services=createHostPlatformServices({kind:'android',channel:'dev',languages:[input.language],app,network,preferences,onFailure:failure=>failures.push(failure)});
      const initialized={services,initialization:{language:{status:'ready',value:input.language},preference:{status:input.preferenceStatus,value:input.preference}}};
      const mounted=mountHostApp(initialized);
      window.__hostHarness={
        metrics(){return{...counts,writes:writes.map(({key,value,settled})=>({key,value,settled})),calls,failures,
          activeHandles:handles.filter(handle=>!handle.removed).length,storage:window.__hostStorageAccess}},
        settleWrite(index,outcome){const request=writes[index];if(!request||request.settled)throw Error('Invalid fixture write');request.settled=true;
          if(outcome==='reject')request.reject(Error('Controlled native preference failure'));
          else{if(outcome==='success')memory.set(request.key,request.value);request.resolve()}},
        network(connected){state.connected=connected;for(const h of handles)if(h.event==='networkStatusChange')h.callback({connected})},
        visibility(isActive){state.isActive=isActive;for(const h of handles)if(h.event==='appStateChange')h.callback({isActive})},
        unmount(){mounted.unmount()},remount(){try{mountHostApp(initialized);return null}catch(error){return error.message}},
        drain(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
      };
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: "false" },
    loader: { ".css": "empty" }, logLevel: "silent",
    plugins: [{ name: "explicit-child-component-probe", setup(builder) {
      builder.onResolve({ filter: /^\.\.\/App$/ }, args => args.importer.replaceAll("\\", "/").endsWith("/src/host/mountHostApp.tsx")
        ? { path: "host-child-probe", namespace: "host-fixture" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "host-fixture" }, () => ({ contents: appFixture, loader: "jsx", resolveDir: fileURLToPath(new URL("../../", import.meta.url)) }));
    } }],
  });
  bundle = result.outputFiles[0].text;
  stylesheet = (await Promise.all(["src/index.css", "src/host/host.css"].map(path => readFile(new URL("../../" + path, import.meta.url), "utf8")))).join("\n");
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open(input = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 740 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url() === "https://native-host.test/"
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru"><head></head><body><div id="root"></div></body></html>' })
    : route.abort());
  await page.goto("https://native-host.test/");
  await page.evaluate(initial => {
    window.__hostInitial = { language: "ru-RU", preference: "ru", preferenceStatus: "ready", ...initial };
    const access = window.__hostStorageAccess = { reads: 0, writes: 0 };
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) { if (key === "probpera-interface-language") access.reads++; return get.call(this, key); };
    Storage.prototype.setItem = function(key, value) { if (key === "probpera-interface-language") access.writes++; return set.call(this, key, value); };
  }, input);
  await page.addStyleTag({ content: stylesheet });
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("[data-host-child]")).toBeVisible();
  await page.evaluate(() => window.__hostHarness.drain());
  return { page, errors };
}
async function choose(page, language) {
  await page.locator(".interface-language-control button").filter({ hasText: language.toUpperCase() }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}
async function writeCount(page, length) { await page.waitForFunction(value => window.__hostHarness.metrics().writes.length === value, length); }
async function sameChild(page, original, initialMetrics, language) {
  expect(await page.locator("#host-scene-probe").evaluate((node, first) => node === first, original)).toBe(true);
  await expect(page.getByRole("textbox", { name: "Fixture selection" })).toHaveValue("russia:tolstoy:war-and-peace");
  await expect(page.locator("[data-host-child]")).toHaveAttribute("data-language", language);
  const current = await page.evaluate(() => window.__hostHarness.metrics());
  expect(current.mounts).toBe(initialMetrics.mounts);
  expect(current.unmounts).toBe(initialMetrics.unmounts);
  expect(current.storage).toEqual({ reads: 0, writes: 0 });
  await expect(page.locator(".interface-language-control")).toHaveCount(1);
}

test("mount subscribes actual host state and keeps one language owner, title and child across RU/EN/RU", async () => {
  const { page, errors } = await open();
  try {
    const original = await page.locator("#host-scene-probe").elementHandle();
    const initial = await page.evaluate(() => window.__hostHarness.metrics());
    expect(initial.activeHandles).toBe(2);
    expect(initial.appReads).toBeGreaterThan(0);
    expect(initial.networkReads).toBeGreaterThan(0);
    await page.getByRole("textbox", { name: "Fixture selection" }).fill("russia:tolstoy:war-and-peace");
    await page.evaluate(() => window.__hostHarness.network(false));
    await expect(page.locator("[data-host-network-hint]")).toHaveText("Нет соединения с сетью.");
    await expect(page.locator(".host-runtime-status")).toHaveAttribute("role", "status");
    await expect(page.locator(".host-runtime-status")).toHaveAttribute("aria-live", "polite");
    await expect(page.locator(".host-runtime-status")).toHaveAttribute("aria-atomic", "true");
    for (const [index, language, title, offline] of [[0, "en", "Literary Planet", "No network connection."], [1, "ru", "Литературная планета", "Нет соединения с сетью."]]) {
      await choose(page, language);
      await writeCount(page, index + 1);
      await expect(page).toHaveTitle(title);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator("[data-host-network-hint]")).toHaveText(offline);
      await page.evaluate(value => window.__hostHarness.settleWrite(value, "success"), index);
      await expect(page.locator(".host-runtime-status")).toHaveAttribute("data-host-language-persistence", "idle");
      await sameChild(page, original, initial, language);
    }
    await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", { key: "probpera-interface-language", newValue: "en" })));
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await page.evaluate(() => { window.__hostHarness.visibility(false); window.__hostHarness.visibility(true); window.__hostHarness.network(true); });
    await expect(page.locator(".host-runtime-status")).toHaveCount(0);
    await sameChild(page, original, initial, "ru");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("an older failed write cannot replace the newest pending choice or successful status", async () => {
  const { page, errors } = await open();
  try {
    const original = await page.locator("#host-scene-probe").elementHandle();
    const initial = await page.evaluate(() => window.__hostHarness.metrics());
    await page.getByRole("textbox", { name: "Fixture selection" }).fill("russia:tolstoy:war-and-peace");
    await choose(page, "en"); await writeCount(page, 1);
    await choose(page, "ru");
    await page.evaluate(() => window.__hostHarness.settleWrite(0, "reject"));
    await writeCount(page, 2);
    await expect(page.locator("[data-host-language-notice]")).toHaveText("Сохраняем язык…");
    await sameChild(page, original, initial, "ru");
    await page.evaluate(() => window.__hostHarness.settleWrite(1, "success"));
    await expect(page.locator(".host-runtime-status")).toHaveCount(0);
    await sameChild(page, original, initial, "ru");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("latest write failure stays localized without reverting selection, and a current retry clears it", async () => {
  const { page, errors } = await open();
  try {
    await page.setViewportSize({ width: 320, height: 680 });
    const original = await page.locator("#host-scene-probe").elementHandle();
    const initial = await page.evaluate(() => window.__hostHarness.metrics());
    await page.getByRole("textbox", { name: "Fixture selection" }).fill("russia:tolstoy:war-and-peace");
    await choose(page, "en"); await writeCount(page, 1);
    await choose(page, "ru");
    await page.evaluate(() => window.__hostHarness.settleWrite(0, "success"));
    await writeCount(page, 2);
    await expect(page.locator("[data-host-language-notice]")).toHaveText("Сохраняем язык…");
    await page.evaluate(() => window.__hostHarness.settleWrite(1, "reject"));
    await expect(page.locator("[data-host-language-notice]")).toHaveText("Не удалось сохранить язык. Выбранный язык продолжает действовать.");
    await sameChild(page, original, initial, "ru");
    const bounds = await page.locator(".host-runtime-status").boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    await choose(page, "en"); await writeCount(page, 3);
    await page.evaluate(() => window.__hostHarness.settleWrite(2, "reject"));
    await expect(page.locator("[data-host-language-notice]")).toHaveText("The language choice could not be saved. Your selected language remains active.");
    await sameChild(page, original, initial, "en");
    await choose(page, "en"); await writeCount(page, 4);
    await page.evaluate(() => window.__hostHarness.settleWrite(3, "success"));
    await expect(page.locator(".host-runtime-status")).toHaveCount(0);
    await sameChild(page, original, initial, "en");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("uses native initialization precedence and explains unavailable saved preference without browser fallback", async () => {
  const preferred = await open({ language: "ru-RU", preference: "en" });
  try {
    await expect(preferred.page.locator("html")).toHaveAttribute("lang", "en");
    await expect(preferred.page).toHaveTitle("Literary Planet");
    expect(await preferred.page.evaluate(() => window.__hostHarness.metrics().storage)).toEqual({ reads: 0, writes: 0 });
    expect(preferred.errors).toEqual([]);
  } finally { await preferred.page.close(); }
  const unavailable = await open({ language: "fr-FR", preference: null, preferenceStatus: "timeout" });
  try {
    await expect(unavailable.page.locator("html")).toHaveAttribute("lang", "en");
    await expect(unavailable.page.locator("[data-host-language-notice]")).toHaveText("Your saved language could not be read. You can still change the language.");
    await choose(unavailable.page, "ru"); await writeCount(unavailable.page, 1);
    await unavailable.page.evaluate(() => window.__hostHarness.settleWrite(0, "success"));
    await expect(unavailable.page.locator(".host-runtime-status")).toHaveCount(0);
    expect(unavailable.errors).toEqual([]);
  } finally { await unavailable.page.close(); }
});

test("unmount removes owned native listeners and ignores late events and persistence completion", async () => {
  const { page, errors } = await open();
  try {
    await choose(page, "en"); await writeCount(page, 1);
    await page.evaluate(() => { window.__hostHarness.unmount(); window.__hostHarness.unmount(); });
    await expect(page.locator("#root")).toBeEmpty();
    expect(await page.evaluate(() => window.__hostHarness.metrics().activeHandles)).toBe(0);
    await page.evaluate(() => { window.__hostHarness.network(false); window.__hostHarness.visibility(false); window.__hostHarness.settleWrite(0, "reject"); });
    await page.evaluate(() => window.__hostHarness.drain());
    await expect(page.locator("#root")).toBeEmpty();
    expect(await page.evaluate(() => window.__hostHarness.remount())).toBe("The native product is already mounted.");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
