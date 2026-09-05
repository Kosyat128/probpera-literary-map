import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

let browser;
let bundle;
let stylesheet;

test.beforeAll(async () => {
  // Exercise real React effects and DOM identity without installing a second
  // renderer/DOM library. Only the identity/license service is a controlled port.
  // Chrome is the same channel used by the repository's Playwright configuration.
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import React, {useEffect, useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {PlatformServicesProvider} from './src/platform/PlatformServices';
      import {InterfaceLanguageProvider} from './src/planet/localization';
      import InterfaceLanguageControl from './src/components/InterfaceLanguageControl';
      import PwaEdition from './src/pwa/PwaEdition';
      const h=React.createElement;
      const listeners=new Set();
      let snapshot=Object.freeze({connectivity:'online',visibility:'active'});
      const services={kind:'web',channel:'web',preferences:{persistence:'best-effort',get:async()=>null,set:async()=>false,remove:async()=>false},
        getSnapshot:()=>snapshot,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)},getSystemLanguages:()=>['ru'],openExternalLink:()=> 'requested'};
      const counts={bootstrap:0,license:0,mounts:0,unmounts:0,error:null};
      const now=Math.floor(Date.now()/1000);
      const grant=Object.freeze({status:'authorized',validUntil:now+3600,claims:Object.freeze({v:1,iss:'test',aud:'test',sub:'independent-test-identity',product:'test',model:'one-time',status:'active',jti:'verified-test-port',iat:now-60,nbf:now-60,exp:now+3600,offlineUntil:now+1800})});
      const licenseQueue=[];
      const client={async check(request){counts.license++;const result=licenseQueue.shift();
        if(result)return{status:'denied',reason:result};
        return request.mode==='offline'?{...grant,validUntil:grant.claims.offlineUntil}:grant},getSnapshot:()=>grant};
      const queue=[window.__editionInitial||'ready'];
      const requests=[];
      const outcome=value=>value==='ready'?{client,reason:null}:{client:null,reason:'session-denied'};
      const runtime={getSnapshot:()=>({client:null,reason:'not-checked'}),bootstrap(request){
        counts.bootstrap++;
        const value=queue.shift()||'ready';
        if(value!=='pending'){requests.push({request});return Promise.resolve(outcome(value))}
        return new Promise(resolve=>requests.push({request,resolve}));
      }};
      let replace;
      function Child(){useEffect(()=>{counts.mounts++;return()=>{counts.unmounts++}},[]);
        return h('section',{'data-test-child':''},h(InterfaceLanguageControl),h('input',{id:'selection',defaultValue:'russia'}),h('canvas',{id:'scene-probe'}));}
      class CatchBoundary extends React.Component{
        state={failed:false};static getDerivedStateFromError(){return{failed:true}};
        componentDidCatch(error){counts.error=error.message};
        render(){return this.state.failed?h('div',{id:'fail-closed'},'closed'):this.props.children}
      }
      function App(){const [current,setCurrent]=useState(runtime);replace=()=>setCurrent({...runtime});
        return h(PlatformServicesProvider,{services},h(InterfaceLanguageProvider,null,h(CatchBoundary,null,h(PwaEdition,{runtime:current},h(Child)))))}
      window.__editionHarness={
        enqueue(value){queue.push(value)},
        enqueueLicense(...values){licenseQueue.push(...values)},connectivity(){return snapshot.connectivity},
        environment(next){snapshot=Object.freeze({...snapshot,...next});for(const fn of listeners)fn()},
        settle(index,value){requests[index].resolve(outcome(value))},replaceRuntime(){replace()},metrics(){return{...counts}},
        drain(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
      };
      createRoot(document.getElementById('root')).render(h(App));
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false }) },
    logLevel: "silent",
  });
  bundle = result.outputFiles[0].text;
  stylesheet = await readFile(new URL("../../src/pwa/pwa.css", import.meta.url), "utf8");
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open(initial = "ready") {
  const page = await browser.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  // A routed virtual origin provides real browser storage without a server or
  // external traffic; about:blank intentionally has no storage permission.
  await page.route("**/*", route => route.request().url() === "https://pwa-lifecycle.test/planet/ru/"
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru"><head></head><body><div id="root"></div></body></html>' })
    : route.abort());
  await page.goto("https://pwa-lifecycle.test/planet/ru/");
  await page.addStyleTag({ content: stylesheet });
  await page.evaluate(value => { window.__editionInitial = value; }, initial);
  await page.addScriptTag({ content: bundle });
  try { await page.waitForFunction(() => window.__editionHarness?.metrics().bootstrap === 1); }
  catch (error) { throw new Error("Lifecycle fixture failed: " + errors.join(" | ") + " / " + String(error)); }
  await page.evaluate(() => window.__editionHarness.drain());
  return page;
}

test.describe("PwaEdition browser lifecycle", () => {
  test("does not bootstrap when hidden and rechecks exactly once on visibility regain", async () => {
    const page = await open();
    try {
      await page.locator("#scene-probe").waitFor();
      await page.evaluate(() => { window.__editionHarness.environment({ visibility: "background" }); });
      await page.evaluate(() => window.__editionHarness.drain());
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({ bootstrap: 1, license: 1, mounts: 1, unmounts: 0 });
      await page.evaluate(() => { window.__editionHarness.environment({ visibility: "active" }); });
      await page.waitForFunction(() => window.__editionHarness.metrics().bootstrap === 2);
      await page.evaluate(() => window.__editionHarness.drain());
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({ bootstrap: 2, license: 2, mounts: 1, unmounts: 0 });
    } finally { await page.close(); }
  });
  test("keeps the same child DOM and semantic input across canonical RU/EN switching", async () => {
    const page = await open();
    try {
      await page.locator("#scene-probe").waitFor();
      const original = await page.locator("#scene-probe").elementHandle();
      await page.locator("#selection").fill("russia:tolstoy:war-and-peace");
      await page.getByRole("button", { name: "Английский язык", exact: true }).click();
      await page.waitForFunction(() => document.documentElement.lang === "en");
      expect(await page.locator("#scene-probe").evaluate((node, first) => node === first, original)).toBe(true);
      expect(await page.locator("#selection").inputValue()).toBe("russia:tolstoy:war-and-peace");
      expect(await page.locator(".interface-language-control").count()).toBe(1);
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({ bootstrap: 1, license: 1, mounts: 1, unmounts: 0 });
    } finally { await page.close(); }
  });
  test("shows truthful RU/EN saved verification with an online hint, preserving the child through recovery", async () => {
    // Controlled license outcomes exercise the product presentation path. This
    // does not emulate transport offline or replace the separate engine evidence.
    const page = await open();
    try {
      await page.setViewportSize({ width: 320, height: 680 });
      await page.locator("#scene-probe").waitFor();
      const original = await page.locator("#scene-probe").elementHandle();
      const status = page.locator('[data-pwa-access-verification="saved"]');
      await expect(status).toHaveCount(0);
      await page.locator("#selection").fill("russia:tolstoy:war-and-peace");
      await page.evaluate(() => { const h=window.__editionHarness; h.enqueueLicense('network-unavailable'); h.environment({visibility:'background'}); });
      await page.evaluate(() => window.__editionHarness.drain());
      await page.evaluate(() => window.__editionHarness.environment({visibility:'active'}));
      await expect(status).toHaveText("Используется сохранённое подтверждение доступа.");
      await expect(status).toHaveAttribute("role", "status");
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveAttribute("aria-atomic", "true");
      expect(await page.evaluate(() => window.__editionHarness.connectivity())).toBe("online");
      for (const [label, text] of [["Английский язык", "Using saved access verification."], ["Russian", "Используется сохранённое подтверждение доступа."]]) {
        await page.getByRole("button", { name: label, exact: true }).click();
        await expect(status).toHaveText(text);
        expect(await page.locator("#scene-probe").evaluate((node, first) => node === first, original)).toBe(true);
        await expect(page.locator("#selection")).toHaveValue("russia:tolstoy:war-and-peace");
        const box = await status.boundingBox();
        expect(box).not.toBeNull();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({bootstrap:2,license:3,mounts:1,unmounts:0});
      await page.evaluate(() => window.__editionHarness.environment({visibility:'background'}));
      await page.evaluate(() => window.__editionHarness.drain());
      await page.evaluate(() => window.__editionHarness.environment({visibility:'active'}));
      await expect(status).toHaveCount(0);
      await expect(page.locator('.pwa-access__refresh')).toHaveCount(0);
      expect(await page.locator("#scene-probe").evaluate((node, first) => node === first, original)).toBe(true);
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({bootstrap:3,license:4,mounts:1,unmounts:0});
      expect(await page.locator(".interface-language-control").count()).toBe(1);
    } finally { await page.close(); }
  });
  test("closes through an error boundary if the runtime identity is replaced", async () => {
    const page = await open();
    try {
      await page.locator("#scene-probe").waitFor();
      await page.evaluate(() => window.__editionHarness.replaceRuntime());
      await page.locator("#fail-closed").waitFor();
      expect(await page.locator("#scene-probe").count()).toBe(0);
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({
        bootstrap: 1, mounts: 1, unmounts: 1, error: "PWA identity runtime must remain stable for this application mount",
      });
    } finally { await page.close(); }
  });
  test("an old pending bootstrap cannot reopen after a newer connectivity denial", async () => {
    const page = await open("pending");
    try {
      await page.evaluate(() => { const h = window.__editionHarness; h.enqueue("denied"); h.environment({ connectivity: "offline" }); });
      await page.waitForFunction(() => window.__editionHarness.metrics().bootstrap === 2);
      await page.locator('[data-pwa-access-state="closed"]').waitFor();
      await page.evaluate(() => window.__editionHarness.settle(0, "ready"));
      await page.evaluate(() => window.__editionHarness.drain());
      expect(await page.locator("#scene-probe").count()).toBe(0);
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({ mounts: 0, license: 0 });
    } finally { await page.close(); }
  });
  test("an old pending bootstrap cannot close a newer successful retry", async () => {
    const page = await open("pending");
    try {
      await page.evaluate(() => { const h = window.__editionHarness; h.enqueue("denied"); h.environment({ connectivity: "offline" }); });
      await page.locator('[data-pwa-access-state="closed"]').waitFor();
      await page.getByRole("button", { name: "Проверить снова", exact: true }).click();
      await page.locator("#scene-probe").waitFor();
      const original = await page.locator("#scene-probe").elementHandle();
      await page.evaluate(() => window.__editionHarness.settle(0, "denied"));
      await page.evaluate(() => window.__editionHarness.drain());
      expect(await page.locator("#scene-probe").evaluate((node, first) => node === first, original)).toBe(true);
      expect(await page.evaluate(() => window.__editionHarness.metrics())).toMatchObject({ bootstrap: 3, license: 1, mounts: 1, unmounts: 0 });
    } finally { await page.close(); }
  });
});
