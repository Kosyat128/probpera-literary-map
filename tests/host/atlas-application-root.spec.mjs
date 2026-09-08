import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Real React/Chrome hook integration. The canvas is a DOM identity probe;
// these checks do not certify rendered globe content or native device geometry.
let browser, bundle;
test.beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import React,{useState}from'react';
      import{createRoot}from'react-dom/client';
      import{useAtlasExperience}from'./src/atlas/useAtlasExperience';
      const input=window.__atlasInitial;
      let controller,changeLanguage;
      const received=[];
      function Probe(){
        const[language,setLanguage]=useState('ru');
        changeLanguage=setLanguage;
        controller=useAtlasExperience({applicationRoot:input.applicationRoot,
          reducedMotion:input.reducedMotion??true,economical:true,directTransitionDurationMs:30,
          urlSelection:{filter:'all',countryId:'russia',writerId:'tolstoy'},
          onUrlStateChange:state=>received.push(state)});
        const c=controller;
        return <main data-language={language}>
          <button id="outside-before" ref={c.launchButtonRef} onClick={event=>c.enter('hero',event.currentTarget)}>Open</button>
          <div ref={c.placeholderRef} id="placeholder"/>
          <div ref={c.experienceRef} id="experience">
            <div ref={c.surfaceRef} id="surface" role="region" aria-label="Literary Planet">
              <button ref={c.closeButtonRef} id="close" onClick={()=>c.requestExit('close-button')}>Close</button>
              <button ref={c.searchButtonRef} id="search" onClick={()=>c.dispatch({type:'OPEN_SEARCH'})}>Search</button>
              <section ref={c.stageRef}><canvas id="atlas-scene-probe"/></section>
              <button ref={c.filtersButtonRef} id="filters" onClick={()=>c.dispatch({type:'OPEN_FILTERS'})}>Filters</button>
            </div>
          </div>
          <button id="outside-after">External panel action</button>
        </main>;
      }
      const root=createRoot(document.getElementById('root'));
      root.render(<React.StrictMode><Probe/></React.StrictMode>);
      window.__atlasHarness={
        snapshot(){return{state:controller.state,received:[...received],historyLength:history.length,
          historyState:history.state,url:location.pathname+location.search+location.hash,
          bodyStyle:document.body.getAttribute('style'),htmlStyle:document.documentElement.getAttribute('style')}},
        exit:reason=>controller.requestExit(reason),dispatch:event=>controller.dispatch(event),
        sync(url){history.replaceState(history.state,'',url);return controller.syncFromUrl()},
        commit:selection=>controller.commitUrlSelection(selection),language:value=>changeLanguage(value),
        unmount:()=>root.unmount(),drain:()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))
      };
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' }, logLevel: "silent",
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open(input = { applicationRoot: true }) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html><body style="padding-right: 7px"><div id="root"></div></body></html>' })
    : route.abort());
  await page.goto("https://atlas-host.test/ru/?country=russia&writer=tolstoy&book=known-book#atlas");
  await page.evaluate(value => {
    window.__atlasInitial = value;
    history.replaceState({ preserved: "entity-navigation" }, "");
  }, input);
  const before = await page.evaluate(() => ({ historyLength: history.length, historyState: history.state,
    url: location.pathname + location.search + location.hash, bodyStyle: document.body.style.cssText }));
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("#surface")).toHaveAttribute("data-atlas-transition", "idle");
  await page.evaluate(() => window.__atlasHarness.drain());
  return { page, errors, before };
}
const snapshot = page => page.evaluate(() => window.__atlasHarness.snapshot());
const drain = page => page.evaluate(() => window.__atlasHarness.drain());

test("native root starts fullscreen without history mutation, modal isolation or focus trapping", async () => {
  const { page, errors, before } = await open({ applicationRoot: true, reducedMotion: false });
  try {
    const initial = await snapshot(page);
    expect(initial.state.view).toBe("immersive");
    expect(initial.state.entrySource).toBe("url");
    expect(initial.historyLength).toBe(before.historyLength);
    expect(initial.historyState).toEqual(before.historyState);
    expect(initial.url).toBe(before.url);
    await expect(page.locator("#surface")).toHaveAttribute("role", "region");
    await expect(page.locator("#surface")).not.toHaveAttribute("aria-modal", "true");
    expect(await page.locator("[inert], [aria-hidden=true]").count()).toBe(0);
    expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");
    await page.locator("#filters").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#outside-after")).toBeFocused();
    await page.locator("#outside-before").focus();
    await expect(page.locator("#outside-before")).toBeFocused();
    const scene = await page.locator("#atlas-scene-probe").elementHandle();
    await page.evaluate(() => window.__atlasHarness.language("en"));
    await expect(page.locator("main")).toHaveAttribute("data-language", "en");
    expect(await page.locator("#atlas-scene-probe").evaluate((node, original) => node === original, scene)).toBe(true);
    expect(await page.locator("canvas").count()).toBe(1);
    await page.evaluate(() => window.__atlasHarness.unmount());
    expect(await page.evaluate(() => document.body.style.cssText)).toBe(before.bodyStyle);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("native entity sync preserves incoming state and all exit paths keep the same globe root", async () => {
  const { page, errors, before } = await open();
  try {
    const scene = await page.locator("#atlas-scene-probe").elementHandle();
    const url = "/en/?country=france&writer=hugo&atlas=nobel&book=incoming-book#books";
    expect(await page.evaluate(value => window.__atlasHarness.sync(value), url)).toEqual({
      countryId: "france", writerId: "hugo", filter: "nobel", view: "immersive",
    });
    await drain(page);
    expect((await snapshot(page)).url).toBe(url);
    expect((await snapshot(page)).received).toEqual([{ countryId: "france", writerId: "hugo", filter: "nobel", view: "immersive" }]);
    await page.locator("#search").click();
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-search-open", "true");
    await page.evaluate(() => window.__atlasHarness.exit("close-button"));
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-search-open", "false");
    await page.locator("#filters").click();
    await page.evaluate(() => window.__atlasHarness.dispatch({ type: "ESCAPE" }));
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-filters-open", "false");
    for (const reason of ["escape", "history", "programmatic", "close-button"]) {
      await page.evaluate(value => window.__atlasHarness.exit(value), reason);
      await drain(page);
      await expect(page.locator("#surface")).toHaveAttribute("data-atlas-view", "immersive");
    }
    for (const event of [{ type: "EXIT" }, { type: "ESCAPE" }, { type: "SYNC_VIEW", view: "embedded" }]) {
      await page.evaluate(value => window.__atlasHarness.dispatch(value), event);
      await drain(page);
      await expect(page.locator("#surface")).toHaveAttribute("data-atlas-view", "immersive");
    }
    expect((await snapshot(page)).url).toBe(url);
    await page.evaluate(() => window.__atlasHarness.commit({ countryId: "japan", writerId: null, filter: "verified" }));
    const current = await snapshot(page);
    expect(current.url).toBe("/en/?country=japan&atlas=verified&book=incoming-book#books");
    expect(current.historyLength).toBe(before.historyLength);
    expect(current.historyState).toEqual(before.historyState);
    expect(await page.locator("#atlas-scene-probe").evaluate((node, original) => node === original, scene)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("web default still opens a modal with history, traps focus and restores its embedded view", async () => {
  const { page, errors, before } = await open({});
  try {
    const scene = await page.locator("#atlas-scene-probe").elementHandle();
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-view", "embedded");
    await page.locator("#outside-before").click();
    await expect(page.locator("#surface")).toHaveAttribute("aria-modal", "true");
    await expect(page.locator("#surface")).toHaveAttribute("role", "dialog");
    await expect(page.locator("#outside-after")).toHaveAttribute("inert", "");
    expect((await snapshot(page)).historyLength).toBe(before.historyLength + 1);
    expect((await snapshot(page)).historyState.probperaAtlasImmersiveUiEntry).toEqual({ source: "hero", version: 1 });
    await page.locator("#filters").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#close")).toBeFocused();
    await page.locator("#search").click();
    await page.keyboard.press("Escape");
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-search-open", "false");
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-view", "immersive");
    await page.keyboard.press("Escape");
    await expect(page.locator("#surface")).toHaveAttribute("data-atlas-view", "embedded");
    await expect(page.locator("#surface")).toHaveAttribute("role", "region");
    await expect(page.locator("#outside-after")).not.toHaveAttribute("inert", "");
    await expect(page.locator("#outside-before")).toBeFocused();
    await expect.poll(async () => (await snapshot(page)).url).toBe(before.url);
    expect(await page.evaluate(() => document.body.style.cssText)).toBe(before.bodyStyle);
    expect(await page.locator("#atlas-scene-probe").evaluate((node, original) => node === original, scene)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
