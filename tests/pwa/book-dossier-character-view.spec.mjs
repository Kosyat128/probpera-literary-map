import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const SITE = "https://dossier-character-view.test";
let script, css, graph;
test.beforeAll(async () => {
  test.setTimeout(120_000);
  const result = await build({ stdin: { resolveDir: root, loader: "jsx", contents: `
    import React,{useCallback,useState}from'react';import{createRoot}from'react-dom/client';
    import BookDossierReader from'./src/components/BookDossierReader';
    import{createBookDossierCharacterViewToken}from'./src/books/bookDossierCharacterView';
    import{bookDossierGraphDraftFixture}from'./scripts/lib/book-dossier-graph-fixture';
    import{bookDossierFixtureDesignProof}from'./scripts/lib/book-dossier-fixtures';
    import{BOOK_DOSSIER_REVIEW_STAGES,compileBookDossier}from'./src/books/bookDossierCompiler';
    import{saveBookDossierDraft,reviewBookDossier,publishBookDossier}from'./src/books/bookDossierWorkflow';
    import'./src/styles/book-dossier.css';
    async function published(locale){
      const now=Date.now(),draft=structuredClone(bookDossierGraphDraftFixture());
      draft.locale=locale;draft.requiredLocales=[locale];draft.translationReadyLocales=[locale];
      const section=draft.sections.find(x=>x.id==='graph-context');
      section.title=locale==='ru'?'Схема учебных персонажей':'Synthetic character map';
      for(const block of draft.blocks)for(const item of block.items)if(item.id.startsWith('character-')){
        item.label=(locale==='ru'?'Учебный персонаж ':'Synthetic character ')+item.id.slice(-1).toUpperCase();
        item.value=locale==='ru'?'Синтетические сведения для проверки интерфейса.':'Synthetic details for interface testing.';
      }
      const context=record=>({now,actor:{id:'11111111-1111-4111-8111-111111111111',role:'owner'},expectedRevision:record?.revision||0});
      const checked=result=>{if(!result.record||result.issues.length)throw Error(JSON.stringify(result.issues));return result.record;};
      let record=checked(await saveBookDossierDraft(draft,null,context(null)));
      for(const stage of BOOK_DOSSIER_REVIEW_STAGES)record=checked(await reviewBookDossier(record,stage,'APPROVED',true,
        {...context(record),...(stage==='design'?{designProof:bookDossierFixtureDesignProof(record,now)}:{})}));
      record=checked(await publishBookDossier(record,context(record)));
      const result=await compileBookDossier(record,{now,themeVersion:'synthetic-character-view'});
      if(!result.document||result.issues.length)throw Error(JSON.stringify(result.issues));return result.document;
    }
    const documents={ru:await published('ru'),en:await published('en')};
    const events=[],tokenNames=new WeakMap();let serial=0,lastRequest=null,currentView=null;
    const observations={pageNavigation:0,readingChanges:0,storageWrites:[],events,actions:[],selectionReceiptAtBubble:undefined};
    const setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){observations.storageWrites.push(key);return setItem.call(this,key,value);};
    function Harness(){
      const[locale,setLocale]=useState('ru'),[request,setRequest]=useState(null),[mounted,setMounted]=useState(true);
      const[busy,setBusy]=useState(false),[tick,setTick]=useState(0),[lease,setLease]=useState(null);
      const[actionMode,setActionMode]=useState('none'),[actionReceipt,setActionReceipt]=useState(null);
      const dossier=React.useMemo(()=>({...documents[locale],validUntil:lease||new Date(Date.now()+60000).toISOString()}),[locale,lease]);
      const page=dossier.pages.find(x=>x.id==='graph-context');
      const receipt=useCallback(view=>{
        currentView=view;setActionReceipt(view);
        const dialog=document.querySelector('.book-dossier-map-dialog');
        events.push(view?{token:tokenNames.get(view.token),bookKey:view.bookKey,cacheKey:view.cacheKey,anchor:view.anchor,
          committedOpen:!!dialog?.open,committedItem:dialog?.querySelector('[data-dossier-character-view]')?.dataset.dossierCharacterView}:null);
      },[]);
      window.__characterView={
        issue(change={}){
          const block=page.blocks.find(x=>x.id===(change.blockId||'graph-guests'));
          const token=createBookDossierCharacterViewToken();tokenNames.set(token,++serial);
          lastRequest={token,bookKey:change.bookKey||dossier.bookKey,cacheKey:change.cacheKey||dossier.cacheKey,
            anchor:{...block.anchor,itemId:change.itemId||'character-c',...(change.anchor||{})}};
          setRequest(lastRequest);return serial;
        },
        replay(){setRequest(lastRequest);setTick(x=>x+1);},clear(){setRequest(null);},
        locale:setLocale,mount:setMounted,busy:setBusy,lease:setLease,action:setActionMode,
        snapshot(){return{...observations,events:[...events],locale,mounted,busy,tick,view:currentView?{token:tokenNames.get(currentView.token),
          anchor:currentView.anchor,bookKey:currentView.bookKey,cacheKey:currentView.cacheKey}:null};}
      };
      return <main style={{maxWidth:920,margin:'12px auto',padding:8}}>
        <button id="outside-control" type="button" style={{minHeight:44}}>Outside control</button>
        {mounted?<BookDossierReader dossier={dossier} activeAnchor={page.anchor} characterRequest={request}
          characterAction={actionMode!=='none'&&actionReceipt?{
            receipt:actionMode==='mismatch'?{...actionReceipt,anchor:{...actionReceipt.anchor,itemId:'character-a'}}:actionReceipt,
            label:locale==='ru'?'Подтвердить шаг':'Confirm step',onAcknowledge:view=>{
              const dialog=document.querySelector('.book-dossier-map-dialog');
              observations.actions.push({sameReceipt:view===currentView,token:tokenNames.get(view.token),mode:actionMode,
                committedOpen:!!dialog?.open,item:dialog?.querySelector('[data-dossier-character-view]')?.dataset.dossierCharacterView});
              if(actionMode!=='accept')return false;setRequest(null);return true;
            }}:null}
          onCharacterViewChange={receipt} onNavigate={()=>{observations.pageNavigation++;setRequest(null);}}
          onProgressChange={()=>observations.readingChanges++} busy={busy}/>:null}
      </main>;
    }
    window.addEventListener('click',event=>{if(event.target.closest('.book-dossier-map__node,.book-dossier-map__group button'))
      observations.selectionReceiptAtBubble=currentView===null?'null':'present';});
    createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);
  ` }, bundle: true, platform: "browser", format: "esm", target: "es2022", jsx: "automatic", write: false,
    metafile: true, outdir: path.join(root, ".tmp/dossier-character-view-memory"), logLevel: "silent",
    loader: { ".css": "css", ".woff": "file", ".woff2": "file", ".svg": "file", ".png": "file", ".jpg": "file" },
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [{ name: "local-asset-only", setup(builder) {
      builder.onResolve({ filter: /^\// }, args => args.kind === "url-token" ? { path: args.path, external: true } : undefined);
    } }],
  });
  graph = Object.keys(result.metafile.inputs).map(value => value.replaceAll("\\", "/"));
  for (const file of ["src/components/BookDossierReader.tsx", "src/components/BookDossierMap.tsx", "src/books/bookDossierCharacterView.ts",
    "src/books/bookDossierCompiler.ts", "src/books/bookDossierWorkflow.ts"]) expect(graph).toContain(file);
  script = result.outputFiles.find(file => file.path.endsWith(".js")).text;
  css = result.outputFiles.find(file => file.path.endsWith(".css")).text;
});

async function open(testInfo, viewport = { width: 1440, height: 850 }) {
  const profileRoot = path.resolve(process.env.S15_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s15-dossier-character-view"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "view-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true, viewport, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [], remoteRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (["fetch", "xhr", "websocket"].includes(request.resourceType())) remoteRequests.push(request.url()); });
  await page.route("**/*", route => route.request().url() === SITE + "/"
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' })
    : route.abort());
  const evidence = { scenario: testInfo.title, syntheticPublishedWorkflowOnly: true, actualReaderAndNativeMap: true,
    journeyWiring: false, progressAcceptance: false, productionApprovalClaimed: false, nativeDeviceAcceptance: false,
    fullAccessibilityAcceptance: false, captures: [], pass: false };
  try {
    await page.goto(SITE + "/"); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script, type: "module" });
    await expect(page.locator(".book-dossier-map__preview")).toBeVisible();
    return { page, evidence, async capture(filename) {
      await page.locator(".book-dossier-map__detail").scrollIntoViewIfNeeded();
      const bounds = await page.locator(".book-dossier-map__detail").evaluate(element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height, item: element.dataset.dossierCharacterView };
      });
      await page.screenshot({ path: testInfo.outputPath(filename), animations: "disabled" });
      evidence.captures.push({ filename, viewport: page.viewportSize(), bounds });
    }, async verify() {
      const snapshot = await state(page);
      expect(snapshot.pageNavigation).toBe(0); expect(snapshot.readingChanges).toBe(0); expect(snapshot.storageWrites).toEqual([]);
      expect(snapshot.events.filter(Boolean).every(event => event.committedOpen && event.committedItem === event.anchor.itemId)).toBe(true);
      expect(errors).toEqual([]); expect(remoteRequests).toEqual([]);
      evidence.readOnlyObservation = true; evidence.committedExactItemOnly = true; evidence.pass = true;
    }, async close() {
      evidence.observations = await state(page); evidence.pageErrors = errors; evidence.remoteRequests = remoteRequests; evidence.sourceGraph = graph;
      await fs.writeFile(testInfo.outputPath("dossier-character-view.json"), JSON.stringify(evidence, null, 2) + "\n");
      await context.close();
    } };
  } catch (error) { await context.close(); throw error; }
}
const state = page => page.evaluate(() => window.__characterView.snapshot());
const command = (page, name, value) => page.evaluate(({ name, value }) => window.__characterView[name](value), { name, value });
const dialog = page => page.locator(".book-dossier-map-dialog");
async function expectNoView(page) { await expect.poll(async () => (await state(page)).view).toBeNull(); }
async function issue(page, change = {}) {
  const token = await command(page, "issue", change);
  await expect(dialog(page)).toBeVisible();
  await expect.poll(async () => (await state(page)).view?.anchor.itemId).toBe(change.itemId || "character-c");
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(dialog(page)).toBeVisible();
  await expect.poll(async () => (await state(page)).view?.token).toBe(token);
}

test("exact character requests open committed RU and EN native views without navigation or progress", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const f = await open(testInfo, { width: 320, height: 900 });
  try {
    await issue(f.page);
    await expect(dialog(f.page).locator(".book-dossier-map__detail h3")).toHaveText("Учебный персонаж C");
    await f.capture("dossier-character-view-ru-320.png");
    await f.page.keyboard.press("Escape"); await expectNoView(f.page); await expect(dialog(f.page)).toHaveCount(0);
    await expect(f.page.locator(".book-dossier-map__preview")).toBeFocused();
    await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    await command(f.page, "clear"); await f.page.locator(".book-dossier-map__preview").click();
    await expect(dialog(f.page)).toBeVisible(); await expectNoView(f.page);
    await f.page.keyboard.press("Escape");
    await f.page.setViewportSize({ width: 1440, height: 850 }); await command(f.page, "locale", "en");
    await issue(f.page, { blockId: "graph-team", itemId: "character-b" });
    await issue(f.page, { blockId: "graph-team", itemId: "character-a" });
    await issue(f.page, { blockId: "graph-team", itemId: "character-b" });
    await expect(dialog(f.page)).toHaveCount(1);
    await expect(dialog(f.page).locator(".book-dossier-map__detail h3")).toHaveText("Synthetic character B");
    await f.capture("dossier-character-view-en.png");
    f.evidence.exactSecondBlockTarget = true; f.evidence.closeConsumesToken = true; f.evidence.manualMapNeverGrantsView = true;
    f.evidence.openRequestReplacementSurvivesOldClose = true;
    await f.verify();
  } finally { await f.close(); }
});

test("StrictMode mount with issued character request commits once and never replays consumed token", async ({}, testInfo) => {
  const f = await open(testInfo, { width: 320, height: 900 }), { page } = f;
  const action = page.locator('[data-dossier-character-acknowledge]');
  try {
    await command(page, 'mount', false); await command(page, 'action', 'accept');
    const token = await command(page, 'issue', {});
    await expect(dialog(page)).toHaveCount(0); await expectNoView(page);
    await command(page, 'mount', true);
    await expect(dialog(page)).toBeVisible();
    await expect.poll(async () => (await state(page)).view?.token).toBe(token);
    await expect(page.locator('[data-dossier-character-view]')).toHaveAttribute('data-dossier-character-view', 'character-c');
    await expect(action).toBeVisible(); expect((await state(page)).actions).toEqual([]);
    // Component-only target setup; the actual-App fixture separately exercises
    // genuine mobile scrolling. Activation itself is a trusted touch.
    await action.scrollIntoViewIfNeeded();
    const box = await action.boundingBox(); expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(await action.evaluate(element => { const r=element.getBoundingClientRect();return [0,-.2,.2].every(offset=>element.contains(document.elementFromPoint(r.left+r.width*(.5+offset),r.top+r.height/2))); })).toBe(true);
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
    await expect.poll(async () => (await state(page)).actions.length).toBe(1);
    expect((await state(page)).actions[0]).toMatchObject({sameReceipt:true,token,committedOpen:true,item:'character-c',mode:'accept'});
    await expect(dialog(page)).toHaveCount(0); await expectNoView(page);
    await command(page, 'mount', false); await command(page, 'replay'); await command(page, 'mount', true);
    await expect(dialog(page)).toHaveCount(0); await expectNoView(page); await expect(action).toHaveCount(0);
    await issue(page); await expect(action).toBeVisible();
    await command(page, 'mount', false); await expectNoView(page); await command(page, 'mount', true);
    await expect(dialog(page)).toHaveCount(0); await expectNoView(page); await expect(action).toHaveCount(0);
    expect((await state(page)).actions).toHaveLength(1);
    Object.assign(f.evidence,{strictModeIssuedMountCommits:true,explicitModalAcknowledgement:true,
      consumedTokenUnmountCannotReplay:true,componentTargetScrollSetup:true,actualAppJourneyWiring:false});
    await f.verify();
  } finally { await f.close(); }
});

test("invalid targets and selection locale remount background invalidation never replay a consumed request", async ({}, testInfo) => {
  test.setTimeout(90_000); const f = await open(testInfo);
  try {
    for (const change of [{ itemId: "character-hidden" }, { bookKey: "test:writer:other" }, { cacheKey: "stale" }, { anchor: { locale: "en" } }]) {
      await command(f.page, "issue", change); await expect(dialog(f.page)).toHaveCount(0); await expectNoView(f.page);
    }
    await issue(f.page);
    await dialog(f.page).locator(".book-dossier-map__interactive-drawing").getByRole("button", { name: "Учебный персонаж A", exact: true }).click();
    await expectNoView(f.page); expect((await state(f.page)).selectionReceiptAtBubble).toBe("null");
    await command(f.page, "replay"); await expectNoView(f.page);
    await f.page.keyboard.press("Escape"); await issue(f.page);
    await command(f.page, "locale", "en"); await expectNoView(f.page); await expect(dialog(f.page)).toHaveCount(0);
    await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    await issue(f.page); await command(f.page, "mount", false); await expectNoView(f.page);
    await command(f.page, "mount", true); await expect(f.page.locator(".book-dossier-map__preview")).toBeVisible();
    await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    await issue(f.page);
    await f.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    await expectNoView(f.page); await expect(dialog(f.page)).toHaveCount(0);
    await f.page.evaluate(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    f.evidence.invalidTargetNeverFallsBack = true; f.evidence.selectionRevokesSynchronously = true;
    f.evidence.localeRemountBackgroundDiscardIntent = true; await f.verify();
  } finally { await f.close(); }
});

test("lease expiry and unavailable data revoke the open observation without restoring outside focus or replaying", async ({}, testInfo) => {
  test.setTimeout(90_000); const f = await open(testInfo);
  try {
    await issue(f.page);
    await command(f.page, "lease", new Date(Date.now() + 700).toISOString());
    await expectNoView(f.page); await expect(dialog(f.page)).toHaveCount(0);
    await command(f.page, "lease", new Date(Date.now() + 60_000).toISOString());
    await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    await issue(f.page);
    const outsideFocusedBeforeInvalidation = await f.page.evaluate(() => {
      // Native close makes outside focus possible; unavailability invalidates
      // the pending observation before the queued close event restores focus.
      document.querySelector('.book-dossier-map-dialog').close();
      const outside = document.getElementById('outside-control');
      outside.focus();
      const focused = document.activeElement === outside;
      window.__characterView.busy(true);
      return focused;
    });
    expect(outsideFocusedBeforeInvalidation).toBe(true);
    await expectNoView(f.page); await expect(dialog(f.page)).toHaveCount(0);
    await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(f.page.locator("#outside-control")).toBeFocused();
    await command(f.page, "busy", false); await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    await command(f.page, "busy", true); await command(f.page, "issue"); await expect(dialog(f.page)).toHaveCount(0);
    await command(f.page, "busy", false); await command(f.page, "replay"); await expect(dialog(f.page)).toHaveCount(0);
    await issue(f.page); await f.page.keyboard.press("Escape"); await expectNoView(f.page);
    f.evidence.liveExpiryRevokesView = true; f.evidence.unavailableRevokesView = true;
    f.evidence.outsideFocusRetained = true; f.evidence.freshExplicitTokenRequired = true; await f.verify();
    f.evidence.blockedAttemptConsumesToken = true;
  } finally { await f.close(); }
});


test("caller character action is explicit inside the exact committed modal and revocation never acknowledges", async ({}, testInfo) => {
  test.setTimeout(90_000); const f = await open(testInfo, { width: 320, height: 900 }), { page } = f;
  const action = page.locator('[data-dossier-character-acknowledge]');
  const touch = async locator => {
    // This component fixture positions the target for a trusted touch. Actual
    // App integration separately owns mobile scrolling and journey authority.
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox(); expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    const owns = await locator.evaluate(element => { const r = element.getBoundingClientRect();
      return [0, -.2, .2].every(offset => { const hit = document.elementFromPoint(r.left+r.width*(.5+offset),r.top+r.height/2); return hit && element.contains(hit); }); });
    expect(owns).toBe(true);
    await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
  };
  try {
    await command(page, "action", "reject"); await issue(page); await expect(action).toBeVisible();
    expect((await state(page)).actions).toEqual([]);
    await touch(action); await expect.poll(async () => (await state(page)).actions.length).toBe(1);
    expect((await state(page)).actions[0]).toMatchObject({sameReceipt:true,committedOpen:true,item:'character-c',mode:'reject'});
    await expect(dialog(page)).toBeVisible(); expect((await state(page)).view).not.toBeNull();
    await command(page, "action", "accept"); await touch(action); await expect(dialog(page)).toHaveCount(0); await expectNoView(page);
    expect((await state(page)).actions).toHaveLength(2); expect((await state(page)).actions[1]).toMatchObject({sameReceipt:true,committedOpen:true,item:'character-c',mode:'accept'});
    await command(page, "action", "mismatch"); await issue(page); await expect(action).toHaveCount(0);
    await command(page, "action", "reject"); await expect(action).toBeVisible();
    await touch(dialog(page).getByRole('button',{name:'Закрыть',exact:true})); await expectNoView(page); await command(page, "replay"); await expect(dialog(page)).toHaveCount(0);
    await issue(page); await expect(action).toBeVisible();
    await touch(dialog(page).locator('.book-dossier-map__group').getByRole('button',{name:'Учебный персонаж A',exact:true}));
    await expectNoView(page); await expect(action).toHaveCount(0); await expect(dialog(page)).toBeVisible();
    await touch(dialog(page).getByRole('button',{name:'Закрыть',exact:true}));
    await issue(page); await expect(action).toBeVisible(); await command(page, "lease", new Date(Date.now()+300).toISOString());
    await expectNoView(page); await expect(dialog(page)).toHaveCount(0); await expect(action).toHaveCount(0);
    await command(page, "lease", new Date(Date.now()+60_000).toISOString()); await command(page, "replay"); await expect(dialog(page)).toHaveCount(0);
    expect((await state(page)).actions).toHaveLength(2);
    Object.assign(f.evidence,{callerActionExactCommittedReceipt:true,rejectedActionKeepsModal:true,acceptedOwnerRetiresRequest:true,
      closeSelectionExpiryGrantNoAction:true,componentTargetScrollSetup:true,actualAppJourneyWiring:false});
    await f.verify();
  } finally { await f.close(); }
});
