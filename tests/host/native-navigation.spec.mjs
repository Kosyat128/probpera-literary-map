import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Real Chrome, React StrictMode, navigation hook and canonical locale provider.
// Native plugins and the scene are explicit probes, not device/globe evidence.
let browser, bundle;
test.beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import React,{useEffect,useRef,useState}from'react';
      import{createRoot}from'react-dom/client';
      import{useNativeNavigation}from'./src/host/useNativeNavigation';
      import{nativeNavigationTarget}from'./src/host/nativeNavigationTarget';
      import{InterfaceLanguageProvider,useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
      import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
      const input=window.__nativeInitial;
      const handles=[],launches=[],resolutions=[],applied=[],outcomes=[];
      const counts={urlRegistrations:0,backRegistrations:0,launchReads:0,goBack:0,backChecks:0,mounts:0,unmounts:0};
      function subscribe(kind,callback){
        counts[kind==='url'?'urlRegistrations':'backRegistrations']++;
        const handle={kind,callback,removed:false,removals:0,remove(){handle.removed=true;handle.removals++}};
        handles.push(handle);
        if(input.deferHandles)return new Promise(resolve=>{handle.release=()=>resolve(handle)});
        return Promise.resolve(handle);
      }
      const source={
        subscribeUrl:callback=>subscribe('url',callback),subscribeBack:callback=>subscribe('back',callback),
        getLaunchUrl(){counts.launchReads++;return new Promise(resolve=>launches.push(resolve))}
      };
      const persistence={initialLanguage:'ru',persist:async()=>true};
      let setReadiness;
      function Probe(){
        const{language,setLanguage}=useInterfaceLanguage();
        const[readiness,changeReadiness]=useState({bootstrap:input.ready?'ready':'pending',policy:'allowed'});
        const controller=useRef(null);
        setReadiness=changeReadiness;
        useNativeNavigation({source,readiness,
          resolve:(intent,context)=>input.deferResolution
            ?new Promise(resolve=>resolutions.push(()=>resolve({status:'ready',value:intent.canonicalUrl})))
            :Promise.resolve({status:'ready',value:intent.canonicalUrl}),
          apply:(value,intent)=>{
            const target=nativeNavigationTarget(window.location.href,intent);
            window.history.replaceState(window.history.state,'',target.relative);
            if(intent.language)setLanguage(intent.language);
            applied.push({value,localeOnly:target.localeOnly});return'applied';
          },
          handleBack:()=>{counts.backChecks++;return'unhandled'},goBack:()=>{counts.goBack++},
          onOutcome:outcome=>outcomes.push(outcome.status)
        },controller);
        useEffect(()=>{counts.mounts++;return()=>{counts.unmounts++}},[]);
        return <main data-language={language} data-bootstrap={readiness.bootstrap}>
          <InterfaceLanguageControl/><input aria-label="Scene selection" defaultValue="russia:tolstoy:war-and-peace"/>
          <canvas id="navigation-scene-probe"/>
        </main>;
      }
      const root=createRoot(document.getElementById('root'));
      root.render(<React.StrictMode><InterfaceLanguageProvider hostLanguage={persistence}><Probe/></InterfaceLanguageProvider></React.StrictMode>);
      window.__nativeHarness={
        metrics(){return{...counts,activeUrl:handles.filter(h=>h.kind==='url'&&!h.removed).length,
          activeBack:handles.filter(h=>h.kind==='back'&&!h.removed).length,
          handles:handles.map(({kind,removed,removals})=>({kind,removed,removals})),
          applied:[...applied],outcomes:[...outcomes],resolutions:resolutions.length}},
        ready(value){setReadiness({bootstrap:value?'ready':'pending',policy:'allowed'})},
        launch(url){for(const resolve of launches.splice(0))resolve(url?{url}:undefined)},
        emit(url){for(const handle of handles)if(handle.kind==='url')handle.callback(url)},
        back(canGoBack){for(const handle of handles)if(handle.kind==='back')handle.callback({canGoBack})},
        releaseHandles(){for(const handle of handles)handle.release?.()},
        resolvePending(){for(const resolve of resolutions.splice(0))resolve()},
        unmount(){root.unmount()},
        drain(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
      };
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false }),
      __LITERARY_PLANET_EDITION__: '"native"', __LITERARY_PLANET_LOCAL_QA__: "false" },
    loader: { ".css": "empty" }, logLevel: "silent",
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open(input = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru"><body><div id="root"></div></body></html>' })
    : route.abort());
  await page.goto("https://native-host.test/ru/?country=russia&writer=tolstoy&book=russia%3Atolstoy%3Awar-and-peace&archiveShelf=my-shelf&atlasView=immersive#books");
  await page.evaluate(value => {
    window.__nativeInitial = value;
    window.history.replaceState({ sceneMarker: "preserved" }, "");
  }, input);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator("main")).toBeVisible();
  await page.evaluate(() => window.__nativeHarness.drain());
  return { page, errors };
}
async function metrics(page) { return page.evaluate(() => window.__nativeHarness.metrics()); }
async function drain(page) { await page.evaluate(() => window.__nativeHarness.drain()); }
function registrations(value) { return [value.urlRegistrations, value.backRegistrations, value.launchReads]; }

test("StrictMode keeps one live subscription per kind and preserves the same scene across cold/warm locale links", async () => {
  const { page, errors } = await open();
  try {
    const initial = await metrics(page);
    expect(registrations(initial)).toEqual([2, 2, 2]);
    expect([initial.activeUrl, initial.activeBack]).toEqual([1, 1]);
    expect([initial.mounts, initial.unmounts]).toEqual([2, 1]);
    const scene = await page.locator("#navigation-scene-probe").elementHandle();
    const original = await page.evaluate(() => ({ search: location.search, hash: location.hash, state: history.state }));
    await page.evaluate(() => { window.__nativeHarness.launch("https://probpera.ru/en/"); window.__nativeHarness.ready(true); });
    await expect(page.locator("main")).toHaveAttribute("data-language", "en");
    await page.evaluate(() => window.__nativeHarness.emit("https://probpera.ru/ru/"));
    await expect(page.locator("main")).toHaveAttribute("data-language", "ru");
    await page.evaluate(() => window.__nativeHarness.ready(false));
    await expect(page.locator("main")).toHaveAttribute("data-bootstrap", "pending");
    await page.getByRole("button", { name: "Английский язык", exact: true }).click();
    await page.evaluate(() => window.__nativeHarness.ready(true));
    await expect(page.locator("main")).toHaveAttribute("data-bootstrap", "ready");
    const current = await metrics(page);
    expect(registrations(current)).toEqual(registrations(initial));
    expect(current.applied).toHaveLength(2);
    expect(current.applied.every(value => value.localeOnly)).toBe(true);
    expect(current.outcomes.filter(value => value === "applied")).toHaveLength(2);
    expect([current.activeUrl, current.activeBack]).toEqual([1, 1]);
    expect([current.mounts, current.unmounts]).toEqual([2, 1]);
    expect(await page.locator("#navigation-scene-probe").evaluate((node, originalNode) => node === originalNode, scene)).toBe(true);
    expect(await page.evaluate(() => ({ search: location.search, hash: location.hash, state: history.state }))).toEqual(original);
    await expect(page.getByRole("textbox", { name: "Scene selection" })).toHaveValue("russia:tolstoy:war-and-peace");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("root Back cancels delayed launch and respects false native canGoBack despite browser history", async () => {
  const { page, errors } = await open();
  try {
    await page.evaluate(() => {
      history.pushState({}, "", location.href);
      window.__nativeHarness.back(false);
    });
    await drain(page);
    expect(await page.evaluate(() => history.length)).toBeGreaterThan(1);
    await page.evaluate(() => { window.__nativeHarness.launch("https://probpera.ru/en/"); window.__nativeHarness.ready(true); });
    await drain(page);
    let current = await metrics(page);
    expect(current.applied).toEqual([]);
    expect(current.goBack).toBe(0);
    expect(current.backChecks).toBe(1);
    expect(current.outcomes).toContain("launch-superseded");
    await expect(page.locator("main")).toHaveAttribute("data-language", "ru");
    await page.evaluate(() => window.__nativeHarness.back(true));
    await drain(page);
    current = await metrics(page);
    expect(current.goBack).toBe(1);
    expect(current.backChecks).toBe(2);
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("newer user language changes supersede both a delayed launch and an already queued warm link", async () => {
  const { page, errors } = await open();
  try {
    await page.getByRole("button", { name: "Английский язык", exact: true }).click();
    await expect(page.locator("main")).toHaveAttribute("data-language", "en");
    await page.evaluate(() => window.__nativeHarness.launch("https://probpera.ru/ru/"));
    await drain(page);
    await page.evaluate(() => window.__nativeHarness.emit("https://probpera.ru/ru/"));
    await page.locator(".interface-language-control button").filter({ hasText: "EN" }).click();
    await page.evaluate(() => window.__nativeHarness.ready(true));
    await drain(page);
    const current = await metrics(page);
    expect(current.applied).toEqual([]);
    expect(current.outcomes).toEqual(expect.arrayContaining(["launch-superseded", "queued", "cancelled"]));
    expect(registrations(current)).toEqual([2, 2, 2]);
    await expect(page.locator("main")).toHaveAttribute("data-language", "en");
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("unmount fences late native callbacks, resolution, launch and listener registration completion", async () => {
  const { page, errors } = await open({ ready: true, deferHandles: true, deferResolution: true });
  try {
    await page.evaluate(() => window.__nativeHarness.emit("https://probpera.ru/en/"));
    await expect.poll(async () => (await metrics(page)).resolutions).toBe(1);
    const original = await page.evaluate(() => location.href);
    await page.evaluate(() => window.__nativeHarness.unmount());
    await expect(page.locator("#root")).toBeEmpty();
    await page.evaluate(() => {
      window.__nativeHarness.resolvePending();
      window.__nativeHarness.launch("https://probpera.ru/en/");
      window.__nativeHarness.emit("https://probpera.ru/en/");
      window.__nativeHarness.back(true);
      window.__nativeHarness.releaseHandles();
    });
    await drain(page);
    const current = await metrics(page);
    expect([current.activeUrl, current.activeBack]).toEqual([0, 0]);
    expect(current.handles).toHaveLength(4);
    expect(current.handles.every(handle => handle.removed && handle.removals === 1)).toBe(true);
    expect(current.applied).toEqual([]);
    expect(current.goBack).toBe(0);
    expect(current.backChecks).toBe(0);
    expect(await page.evaluate(() => location.href)).toBe(original);
    await expect(page.locator("#root")).toBeEmpty();
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
