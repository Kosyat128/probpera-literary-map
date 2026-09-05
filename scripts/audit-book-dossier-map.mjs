import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const base = process.argv[2] || "http://127.0.0.1:4185/";
const output = path.resolve("reports/bookshelf-owner-evidence/public-map");
await mkdir(output, { recursive: true });
const source = `
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Reader from './src/components/BookDossierReader';
import {createBookDossierGraphFixture} from './scripts/lib/book-dossier-graph-fixture';
import {ensureBookTypographyReady} from './src/books/bookTypography';
import {toBookEditorialDocument} from './src/books/bookDossierLegacyAdapter';
import {paginateBookInspectionDocument,getBookInspectionPageLayout} from './src/books/bookInspectionPageLayout';
import {BookInspectionTextureStore} from './src/books/bookInspectionTextures';
(async()=>{
 if(!await ensureBookTypographyReady())throw Error('Local fonts unavailable');
 const {document:dossier}=await createBookDossierGraphFixture();
 const {document:during}=await createBookDossierGraphFixture({readingMode:'DURING_READING'});
 const mapPage=dossier.pages.find(page=>page.sectionId==='graph-context');
 window.graphEvidence={synthetic:true,publishedCatalogue:false,anchor:mapPage.anchor,navigations:[],parentEscapes:0};
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.defaultPrevented)window.graphEvidence.parentEscapes++});
 function Fixture(){const [anchor,setAnchor]=useState(mapPage.anchor);const [active,setActive]=useState(dossier);const [count,setCount]=useState(0);window.graphSetDuring=()=>{setActive(during);setAnchor(during.pages.find(page=>page.sectionId==='graph-context').anchor)};return <main style={{width:'min(760px, calc(100% - 24px))',margin:'24px auto'}}><h1>Синтетический проверочный пример</h1><p>Не опубликованное досье. Данные созданы только для проверки интерфейса.</p><Reader dossier={active} reachedCount={count} onProgressChange={next=>{window.graphEvidence.reachedCount=next;setCount(next)}} activeAnchor={anchor} onNavigate={next=>{window.graphEvidence.navigations.push(next);setAnchor(next)}}/></main>}
 createRoot(document.getElementById('fixture')).render(<Fixture/>);
 const layout=await paginateBookInspectionDocument(toBookEditorialDocument(dossier),{maximumPages:36});
 if(layout.status!=='ready')throw Error(layout.issues.join(';'));
 const map=layout.document.pages.find(page=>getBookInspectionPageLayout(page)?.diagram);
 const store=new BookInspectionTextureStore();
 const texture=await store.request({documentCacheKey:layout.document.cacheKey,page:map,quality:'HIGH'},store.beginGeneration());
 window.graphEvidence.paper={pages:layout.document.pages.length,diagram:getBookInspectionPageLayout(map).diagram,sourceRows:map.rows.length};
 window.graphEvidence.paperPng=texture.surface.toDataURL('image/png');
 store.dispose();window.graphEvidence.ready=true;
})();`;
const bundle = await build({ stdin: { contents: source, loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", target: "es2020", define: { "import.meta.env.BASE_URL": '"/"', "import.meta.env.PROD": "true", "process.env.NODE_ENV": '"production"' } });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = { synthetic: true, compiledPublicFixture: true, appBundleUsed: false, webGLCreated: false, started: new Date().toISOString(), cases: [] };
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},bypassCSP:true});
 const page=await context.newPage();
 const response=await page.request.get(base); const html=await response.text();
 const styles=[...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)].map(match=>match[0]).join('');
 assert(styles,'Production font/styles links unavailable');
 await page.route(base,route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body><div id="fixture"></div></body></html>`}));
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.addStyleTag({content:await readFile('src/styles/book-dossier.css','utf8')});
 await page.addScriptTag({content:bundle.outputFiles[0].text});await page.waitForFunction(()=>window.graphEvidence?.ready,{timeout:20000});
 await page.evaluate(()=>document.fonts.ready);
 const paper=await page.evaluate(()=>window.graphEvidence.paperPng);await writeFile(path.join(output,'synthetic-map-paper.png'),Buffer.from(paper.split(',')[1],'base64'));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  const trigger=page.locator('.book-dossier-map__preview');await trigger.focus();await page.keyboard.press('Enter');
  const dialog=page.locator('.book-dossier-map-dialog');await dialog.waitFor({state:'visible'});
  assert.equal(await dialog.locator('.book-dossier-map__group button').count(),5);
  assert.equal(await dialog.locator('.book-dossier-map__legend li').count(),3);
  assert.equal(await page.locator('.book-dossier-concepts li').count(),3);
  const node=dialog.locator('.book-dossier-map__node').nth(1);await node.focus();await page.keyboard.press('Enter');
  assert.equal(await node.getAttribute('aria-pressed'),'true');
  assert.match(await dialog.locator('.book-dossier-map__detail').innerText(),/Второй участник/);
  const relation=dialog.getByRole('button',{name:/Сотрудничество/});await relation.focus();await page.keyboard.press('Enter');
  assert.match(await dialog.locator('.book-dossier-map__detail').innerText(),/Работают вместе/);
  assert.equal(await dialog.locator('.book-dossier-map__detail a').first().getAttribute('href'),'https://probpera.ru/stati/test/');
  await relation.focus();
  const metrics=await dialog.evaluate(element=>{
   const controls=[...element.querySelectorAll('button,a')].map(control=>{const box=control.getBoundingClientRect();const style=getComputedStyle(control);return{text:control.textContent,width:box.width,height:box.height,font:style.fontSize}});
   return{overflow:element.scrollWidth-element.clientWidth,controls,hiddenName:element.textContent.includes('Скрытый персонаж'),focusOutline:getComputedStyle(document.activeElement).outlineWidth};
  });
  assert(metrics.overflow<=1,JSON.stringify(metrics));assert(metrics.controls.every(control=>control.height>=44&&control.width>=44));assert.equal(metrics.hiddenName,false);assert.notEqual(metrics.focusOutline,'0px');
  const axe=await new AxeBuilder({page}).include('.book-dossier-map-dialog').withRules(['color-contrast','aria-valid-attr-value','button-name','aria-dialog-name']).analyze();assert.deepEqual(axe.violations,[]);
  if(width===390)await dialog.locator('.book-dossier-map__detail').scrollIntoViewIfNeeded();
  await dialog.screenshot({path:path.join(output,`synthetic-map-${width}.png`)});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await trigger.evaluate(element=>element===document.activeElement));
  const state=await page.evaluate(()=>({navigations:window.graphEvidence.navigations,parentEscapes:window.graphEvidence.parentEscapes,paper:window.graphEvidence.paper}));
  assert.deepEqual(state.navigations,[]);assert.equal(state.parentEscapes,0);report.cases.push({width,...metrics,axeViolations:0,focusRestored:true,anchorPreserved:true,paper:state.paper});
 }
 await page.evaluate(()=>window.graphSetDuring());
 const progress=page.getByLabel('Прочитано до');await progress.selectOption('2');
 assert.equal(await page.evaluate(()=>window.graphEvidence.reachedCount),2);assert.equal(await progress.inputValue(),'2');
 const progressBox=await progress.boundingBox();assert(progressBox.height>=44);report.progress={count:2,height:progressBox.height,controlledValue:await progress.inputValue()};
 assert.deepEqual(errors,[]);report.finished=new Date().toISOString();report.status='passed';
} finally {await browser.close();await writeFile(path.join(output,'map-proof.json'),JSON.stringify(report,null,2)+'\n');}
process.stdout.write(JSON.stringify({status:report.status,cases:report.cases.length,output})+'\n');
