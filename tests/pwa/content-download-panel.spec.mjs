import { test, expect, chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { contentPackageFixture } from "../support/content-package-fixtures.mjs";

// Real React panel + Web adapter + HTTP streaming + browser storage. This is a
// controlled source fixture, not an installed native app or release screenshot.
test("download panel keeps a real transfer across RUEN and remount, cancels, retries and verifies offline after browser restart", async ({}, testInfo) => {
  const f = contentPackageFixture(), requests = [], errors = []; let pauseEnglish = true;
  const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
    import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
    import {InterfaceLanguageProvider,useInterfaceLanguage} from './src/i18n/InterfaceLanguage';
    import PlanetDownloadsPanel from './src/host/PlanetDownloadsPanel';
    import {createWebContentDownloads} from './src/platform/adapters/web/WebContentDownloads';
    const downloads=createWebContentDownloads(window,window.__downloadConfig);
    window.__downloads=downloads;
    function Harness(){const [visible,setVisible]=useState(true);const {setLanguage}=useInterfaceLanguage();return <>
      <nav aria-label="Test harness"><button onClick={()=>setLanguage('ru')}>RU</button><button onClick={()=>setLanguage('en')}>EN</button>
      <button onClick={()=>setVisible(value=>!value)}>Toggle panel</button></nav>
      {visible&&<PlanetDownloadsPanel downloads={downloads}/>}</>}
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", jsx: "automatic",
  outdir: ".tmp/s11-panel-memory", metafile: true, define: { "process.env.NODE_ENV": '"development"' } });
  const js = bundle.outputFiles.find(file => file.path.endsWith(".js")).text, css = bundle.outputFiles.find(file => file.path.endsWith(".css")).text;
  expect(Object.keys(bundle.metafile.inputs).some(file => file.startsWith("scripts/") || file.startsWith("tests/"))).toBe(false);
  const server = http.createServer((request, response) => {
    if (request.url === "/harness") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Downloads source fixture</title></head><body style="margin:0;background:#efe5d4;font-family:system-ui"><div id="root"></div></body></html>'); return;
    }
    const file = f.files.find(file => request.url === "/package/" + file.path);
    if (!file) { response.writeHead(404); response.end(); return; }
    requests.push({ path: file.path, cookie: request.headers.cookie ?? null, referrer: request.headers.referer ?? null });
    const bytes = Buffer.from(file.bytes);
    response.writeHead(200, { "Content-Type": "application/json", "Content-Length": bytes.length });
    if (pauseEnglish && file.path === "en/catalog.json") response.write(bytes.subarray(0, 10));
    else response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? ".tmp/s11-content-browser");
  await fs.mkdir(profileRoot, { recursive: true }); const profile = await fs.mkdtemp(path.join(profileRoot, "panel-"));
  const configuration = { descriptors: [{ id: "test", title: { ru: "Проверочный пакет", en: "Test package" },
    envelope: f.envelope, expected: f.expected, manifestSha256: f.manifestSha256, previous: null, baseUrl: origin + "/package/" }], trustedKeys: f.trustedKeys };
  let context;
  async function open() {
    context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/harness"); await page.addStyleTag({ content: css });
    await page.evaluate(configuration => { window.__downloadConfig = configuration; }, configuration);
    await page.addScriptTag({ content: js });
    await page.locator('[data-planet-downloads] summary').click();
    return page;
  }
  const result = { sourceFixture: true, installedNative: false, exactRc: false, activationAllowed: false, releaseReady: false, pass: false };
  try {
    let page = await open(); const row = page.locator('[data-download-id="test"]');
    await page.getByRole("button", { name: "Загрузить", exact: true }).click();
    await expect.poll(() => requests.some(request => request.path === "en/catalog.json")).toBe(true);
    await expect(row).toHaveAttribute("data-download-phase", "downloading");
    await expect(page.getByRole("progressbar")).toHaveAttribute("max", String(f.envelope.manifest.files.reduce((sum, file) => sum + file.bytes, 0)));
    await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath("downloads-ru-source.png") });
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.locator('[data-planet-downloads] summary')).toHaveText("Downloads");
    await expect(row).toHaveAttribute("data-download-phase", "downloading");
    await page.getByRole("button", { name: "Toggle panel", exact: true }).click();
    expect(await page.evaluate(() => window.__downloads.getSnapshot().items[0].phase)).toBe("downloading");
    await page.getByRole("button", { name: "Toggle panel", exact: true }).click();
    await page.locator('[data-planet-downloads] summary').click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(row).toHaveAttribute("data-download-phase", "cancelled");
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    pauseEnglish = false;
    await page.getByRole("button", { name: "Retry download", exact: true }).click();
    await expect(row).toHaveAttribute("data-download-phase", "saved");
    await expect(page.getByRole("button", { name: "Download", exact: true })).toBeFocused();
    const accessibility = await new AxeBuilder({ page }).include('[data-planet-downloads]').analyze();
    expect(accessibility.violations).toEqual([]);
    const overflow = await page.locator('[data-planet-downloads]').evaluate(element => element.scrollWidth > element.clientWidth);
    expect(overflow).toBe(false);
    await page.locator('[data-planet-downloads]').screenshot({ path: testInfo.outputPath("downloads-en-source.png") });
    result.requests = [...requests];
    expect(requests.filter(request => request.path === "dependency-index.json")).toHaveLength(1);
    expect(requests.filter(request => request.path === "en/catalog.json")).toHaveLength(2);
    expect(requests.every(request => request.cookie === null && request.referrer === null)).toBe(true);
    await context.close(); context = undefined;
    page = await open(); await context.setOffline(true);
    await page.getByRole("button", { name: "EN", exact: true }).click();
    await page.getByRole("button", { name: "Check files", exact: true }).click();
    await expect(page.locator('[data-download-id="test"]')).toHaveAttribute("data-download-phase", "saved");
    expect(requests).toEqual(result.requests); expect(errors).toEqual([]);
    Object.assign(result, { cancelled: true, resumedVerifiedFiles: true, offlineAfterBrowserRestart: true, focusedButtonsRetained: true,
      accessibilityViolations: 0, mobileHorizontalOverflow: false, manifestSha256: f.manifestSha256, bundleInputs: Object.keys(bundle.metafile.inputs).sort(), pass: true });
  } finally {
    if (context) await context.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    await testInfo.attach("content-download-panel-result", { contentType: "application/json", body: JSON.stringify(result, null, 2) });
  }
});
