import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Real archive, accessible reader, physical session and reading-library storage.
// Only auth identity and asynchronous page measurement are controlled. These
// unreviewed QA identities exercise the honest fallback, never published facts.
const root = fileURLToPath(new URL("../../", import.meta.url));
const SITE = "https://dossier-navigation.test";
const A = "qa-country:qa-writer:qa-book-a", B = "qa-country:qa-writer:qa-book-b";
const VERSION = "book-dossier-v2-catalogue";
const storageKey = user => "probpera-reading-library" + (user ? ":user:" + encodeURIComponent(user) : "");
const progress = (sectionId, extras = {}) => ({
  anchor: { sectionId, blockId: sectionId + "-content", dossierVersion: VERSION, locale: "ru", readingMode: "BEFORE_READING", ...extras },
  pageId: sectionId, updatedAt: "2026-09-01T00:00:00.000Z",
});
const saved = (id, dossierProgress) => ({ id, kind: "book", title: "QA navigation fixture", sectionLabel: "QA",
  addedAt: "2026-09-01T00:00:00.000Z", status: "saved", ...(dossierProgress ? { dossierProgress } : {}) });
let script, css, graph, mentionIndex;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  mentionIndex = await fs.readFile(path.join(root, "public/articles/book-mentions.json"), "utf8");
  const result = await build({ stdin: { resolveDir: root, loader: "jsx", contents: `
    import React,{useCallback,useEffect,useState} from 'react';import{createRoot}from'react-dom/client';
    import{InterfaceLanguageProvider,useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
    import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
    import{ControlledAuthProvider}from'./src/community/AuthContext';
    import BookArchiveSection from'./src/components/BookArchiveSection';
    import './src/styles/book-dossier.css';
    const writer={id:'qa-writer',name:'QA fixture author',works:[]};
    const country={id:'qa-country',name:'QA fixture country',code:'ZZ',writers:[writer],coordinates:{lat:0,lng:0}};
    const countries=[country];
    const books=['qa-book-a','qa-book-b'].map(id=>({id,title:'QA unreviewed '+id,
      editorialStatus:'draft',countryId:country.id,countryName:country.name,writerId:writer.id,
      writerName:writer.name,writer,country}));
    const noop=()=>{};
    function Harness(){const {language}=useInterfaceLanguage();
      const [userId,setUserId]=useState(window.__navigationConfig.userId);
      const [generation,setGeneration]=useState(0),[bookIndex,setBookIndex]=useState(0);
      const [request,setRequest]=useState(books[0]);
      const handled=useCallback(()=>setRequest(null),[]);
      useEffect(()=>{window.__navigationHarness={
        book:index=>{setBookIndex(index);setRequest(books[index]);},
        remount:()=>{setRequest(books[bookIndex]);setGeneration(value=>value+1);},
        user:setUserId,snapshot:()=>({userId,generation,bookIndex,language})};
      },[userId,generation,bookIndex,language]);
      return <ControlledAuthProvider userId={userId}>
        <nav aria-label="QA harness"><InterfaceLanguageControl/></nav>
        <output data-navigation-harness>{JSON.stringify({userId,generation,bookIndex,language})}</output>
        <BookArchiveSection key={generation} books={books} countries={countries} onBookSelect={noop}
          embeddedInPlanet requestedBook={request} onRequestedBookHandled={handled}/>
      </ControlledAuthProvider>;
    }
    createRoot(document.getElementById('root')).render(<InterfaceLanguageProvider><Harness/></InterfaceLanguageProvider>);
  ` }, bundle: true, write: false, metafile: true, format: "iife", platform: "browser", target: "es2020", jsx: "automatic",
    outdir: path.join(root, ".tmp/book-dossier-navigation-memory"), publicPath: "/fixture/", logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false, PROD: true,
      VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "", VITE_TURNSTILE_SITE_KEY: "" }),
      __LITERARY_PLANET_EDITION__: '"pwa"', __LITERARY_PLANET_LOCAL_QA__: "false",
      __LITERARY_PLANET_LICENSE_AUTHORITY__: "null", __YANDEX_METRIKA_COUNTER_ID__: '""' },
    loader: { ".css": "css", ".png": "file", ".webp": "file", ".avif": "file", ".jpg": "file", ".jpeg": "file", ".svg": "file", ".woff": "file", ".woff2": "file" },
    plugins: [{ name: "dossier-navigation-boundaries", setup(builder) {
      builder.onResolve({ filter: /(?:^|\/)AuthContext$/ }, () => ({ path: "auth", namespace: "dossier-navigation" }));
      builder.onResolve({ filter: /bookInspectionPageLayout$/ }, args =>
        args.importer.replaceAll("\\", "/").endsWith("/src/components/BookArchiveSection.tsx")
          ? { path: "pagination", namespace: "dossier-navigation" } : undefined);
      builder.onLoad({ filter: /.*/, namespace: "dossier-navigation" }, args => ({ resolveDir: root, loader: "jsx", contents: args.path === "pagination"
        ? "export const paginateBookInspectionDocument=(source,options)=>window.__paginationPort.paginate(source,options);"
        : `import React,{createContext,useContext,useMemo}from'react';
          const Context=createContext({configured:false,user:null,loading:false,session:null,role:'reader',displayName:''});
          export const useAuth=()=>useContext(Context);
          export function ControlledAuthProvider({userId,children}){const value=useMemo(()=>({configured:false,
            user:userId?{id:userId}:null,loading:false,session:null,role:'reader',displayName:'QA identity'}),[userId]);
            return <Context.Provider value={value}>{children}</Context.Provider>;}` }));
      // This is Vite's existing lazy-import expansion, not a scene replacement.
      // The real catalog mode does not mount the Canvas; its module stays real.
      builder.onLoad({ filter: /[\\/]BookShelfScene\.tsx$/ }, async args => {
        const source = await fs.readFile(args.path, "utf8"), attempts = [];
        const contents = source.replace(/import\.meta\.glob<\s*ComponentType<BookShelfSceneCanvasProps>\s*>\("\.\/BookShelfSceneCanvas\.tsx",\s*\{\s*import: "default",\s*query: \{ stage5Load: "(primary|retry)" \},\s*\}\)/gu, (_match, attempt) => {
          attempts.push(attempt);
          return `({"./BookShelfSceneCanvas.tsx": () => import("./BookShelfSceneCanvas.tsx?stage5Load=${attempt}").then(module => module.default)})`;
        });
        if (attempts.join(",") !== "primary,retry" || contents.includes("import.meta.glob")) throw Error("Review changed Vite shelf imports");
        return { contents, loader: "tsx", resolveDir: path.dirname(args.path) };
      });
      builder.onResolve({ filter: /BookShelfSceneCanvas\.tsx\?stage5Load=(primary|retry)$/ }, args => {
        const [filename, query] = args.path.split("?"); return { path: path.resolve(args.resolveDir, filename), suffix: "?" + query };
      });
      builder.onResolve({ filter: /^\// }, args => args.kind === "url-token" ? { path: args.path, external: true } : undefined);
    } }],
  });
  graph = Object.keys(result.metafile.inputs).map(value => value.replaceAll("\\", "/"));
  for (const module of ["src/components/BookArchiveSection.tsx", "src/components/BookDossierReader.tsx",
    "src/hooks/useReadingLibrary.ts", "src/books/bookInspectionSession.ts", "src/books/bookDossierLegacyAdapter.ts"]) {
    expect(graph, "The actual source, not a navigation replica, must be bundled").toContain(module);
  }
  script = result.outputFiles.find(file => file.path.endsWith(".js")).text;
  css = result.outputFiles.find(file => file.path.endsWith(".css")).text;
});

async function open(testInfo, { userId = null, stores = { [storageKey(null)]: [saved(A), saved(B)] } } = {}) {
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? path.join(root, ".tmp/s11-content-browser"));
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "bd-"));
  const context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true,
    viewport: { width: 1100, height: 850 }, reducedMotion: "reduce" });
  const page = await context.newPage(), errors = [], remoteRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (["fetch", "xhr", "websocket"].includes(request.resourceType())
    && request.url() !== SITE + "/articles/book-mentions.json") remoteRequests.push(request.url()); });
  await page.route("**/*", route => route.request().url() === SITE + "/ru/"
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru" data-route-language="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA dossier navigation</title></head><body style="margin:20px;font-family:system-ui"><div id="root"></div></body></html>' })
    : route.request().url() === SITE + "/articles/book-mentions.json"
      ? route.fulfill({ contentType: "application/json", body: mentionIndex }) : route.abort());
  const evidence = { sourceFixture: true, qaUnreviewedIdentities: [A, B], actualArchive: true, actualAccessibleReader: true,
    actualInspectionSession: true, actualReadingLibraryAndStorage: true, controlledAuth: "configured:false; synthetic user IDs only",
    controlledPagination: "delayed/failing page-measurement port; no GPU or font-layout acceptance",
    servedStaticAsset: "public/articles/book-mentions.json (unchanged)", actualAuthBackend: false,
    actualNativeDevice: false, releaseReady: false, pass: false };
  try {
    await page.goto(SITE + "/ru/"); await page.addStyleTag({ content: css });
    await page.evaluate(({ userId, stores }) => {
      localStorage.setItem("probpera-interface-language", "ru");
      for (const [key, items] of Object.entries(stores)) localStorage.setItem(key, JSON.stringify(items));
      window.__navigationConfig = { userId };
      window.__libraryWrites = [];
      // Guest/legacy lists and current account schema-1 envelopes are both real
      // storage formats. Reject unknown shapes rather than hiding bad writes.
      window.__readingItemsFromStored = raw => {
        const stored = JSON.parse(raw ?? "[]");
        if (Array.isArray(stored)) return stored;
        if (stored && typeof stored === "object" && stored.schemaVersion === 1
          && Object.keys(stored).sort().join(",") === "items,pending,schemaVersion"
          && Array.isArray(stored.items) && Array.isArray(stored.pending)) return stored.items;
        throw Error("Unexpected reading-library storage shape in navigation fixture");
      };
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key.startsWith("probpera-reading-library")) {
          window.__libraryWrites.push({ key, items: window.__readingItemsFromStored(value), raw: value });
        }
        return setItem.call(this, key, value);
      };
      const calls = [], pending = new Map();
      window.__paginationPort = {
        calls: () => calls.map(({ source, options, ...call }) => ({ ...call, maximumPages: options.maximumPages })),
        paginate(source, options) {
          const call = { id: calls.length + 1, bookKey: source.bookKey, locale: source.locale, state: "pending", source, options };
          calls.push(call); return new Promise((resolve, reject) => pending.set(call.id, { resolve, reject }));
        },
        resolve(id, fragments = 2) {
          const call = calls.find(call => call.id === id), request = pending.get(id);
          if (!call || !request) throw Error("No pending QA layout " + id);
          pending.delete(id); call.state = "ready";
          const pages = call.source.pages.flatMap(page => Array.from({ length: page.id === "identity" ? fragments : 1 }, (_, index) => ({
            ...page, id: page.id + ":qa-layout-" + id + ":fragment-" + index,
          }))).map((page, index) => ({ ...page, index }));
          request.resolve({ status: "ready", sourceDocument: call.source,
            document: { ...call.source, cacheKey: call.source.cacheKey + "|qa-layout=" + id, pages }, issues: [] });
        },
        reject(id) {
          const call = calls.find(call => call.id === id), request = pending.get(id);
          if (!call || !request) throw Error("No pending QA layout " + id);
          pending.delete(id); call.state = "failed"; request.reject(Error("QA pagination unavailable"));
        },
      };
    }, { userId, stores });
    await page.addScriptTag({ content: script });
    await expect(page.locator(".book-dossier-reader")).toBeVisible();
    await expect.poll(() => page.evaluate(() => typeof window.__navigationHarness?.snapshot)).toBe("function");
    await expect(page.locator("#books canvas")).toHaveCount(0);
    return { page, evidence, async close() {
      evidence.paginationCalls = await page.evaluate(() => window.__paginationPort.calls());
      evidence.libraryWrites = await page.evaluate(() => window.__libraryWrites);
      evidence.remoteRequests = remoteRequests; evidence.pageErrors = errors;
      await fs.writeFile(testInfo.outputPath("dossier-navigation.json"), JSON.stringify(evidence, null, 2) + "\n");
      await context.close();
    }, verify() { expect(errors).toEqual([]); expect(remoteRequests).toEqual([]); evidence.pass = true; } };
  } catch (error) { await context.close(); throw error; }
}

const reader = page => page.locator(".book-dossier-reader");
const section = page => reader(page).locator(".book-dossier-reader__page");
const readProgress = (page, id = A, user = null) => page.evaluate(({ key, id }) =>
  window.__readingItemsFromStored(localStorage.getItem(key)).find(item => item.id === id)?.dossierProgress ?? null, { key: storageKey(user), id });
async function latest(page, bookKey = A, locale = "ru", after = 0) {
  await expect.poll(() => page.evaluate(({ bookKey, locale, after }) => window.__paginationPort.calls()
    .filter(call => call.bookKey === bookKey && call.locale === locale && call.id > after).length, { bookKey, locale, after })).toBeGreaterThan(0);
  return page.evaluate(({ bookKey, locale, after }) => window.__paginationPort.calls()
    .filter(call => call.bookKey === bookKey && call.locale === locale && call.id > after).slice(-1)[0], { bookKey, locale, after });
}
async function language(page, locale) {
  await page.locator(".interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
  await expect(reader(page)).toHaveAttribute("lang", locale);
}
async function chooseContents(page, index, locale = "ru") {
  const button = reader(page).getByRole("button", { name: locale === "ru" ? "Оглавление" : "Contents", exact: true });
  await button.focus(); await button.press("Enter");
  const navigation = reader(page).getByRole("navigation", { name: locale === "ru" ? "Оглавление досье" : "Dossier contents" });
  await navigation.getByRole("button").nth(index).focus(); await navigation.getByRole("button").nth(index).press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "false");
}
const physicalPage = (sectionId, call) => sectionId + ":qa-layout-" + call.id + ":fragment-0";

test("early next and contents choices survive delayed physical initialization and locale remapping without replaying another book", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await open(testInfo, { stores: { [storageKey(null)]: [saved(A), saved(B, progress("legal-reading", { dossierVersion: "qa-obsolete-version" }))] } });
  const { page } = fixture;
  try {
    const ru = await latest(page);
    await expect(section(page)).toHaveAttribute("data-section", "identity");
    await reader(page).getByRole("button", { name: "Следующий раздел", exact: true }).click();
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    await expect.poll(() => readProgress(page)).toMatchObject({ anchor: { sectionId: "legal-reading", locale: "ru" }, pageId: "legal-reading" });
    await page.evaluate(id => window.__paginationPort.resolve(id, 2), ru.id);
    await expect.poll(async () => (await readProgress(page))?.pageId).toBe(physicalPage("legal-reading", ru));
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");

    await language(page, "en");
    const en = await latest(page, A, "en");
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    // The old physical session still says legal-reading. New accessible intent
    // must win before the delayed EN result can remap that old session.
    await chooseContents(page, 0, "en");
    await expect(section(page)).toHaveAttribute("data-section", "identity");
    await expect.poll(() => readProgress(page)).toMatchObject({ anchor: { sectionId: "identity", locale: "en" }, pageId: "identity" });
    await page.evaluate(id => window.__paginationPort.resolve(id, 3), en.id);
    await expect.poll(async () => (await readProgress(page))?.pageId).toBe(physicalPage("identity", en));
    await expect(section(page)).toHaveAttribute("data-section", "identity");

    await language(page, "ru");
    const obsoleteA = await latest(page, A, "ru", ru.id);
    await page.evaluate(() => window.__navigationHarness.book(1));
    const b = await latest(page, B, "ru");
    await expect(section(page)).toHaveAttribute("data-section", "identity");
    // The B record contains the same section names, but an incompatible version.
    // A's outstanding layout must not restore that record or replace B's view.
    await page.evaluate(id => window.__paginationPort.resolve(id, 4), obsoleteA.id);
    await expect(section(page)).toHaveAttribute("data-section", "identity");
    await page.evaluate(id => window.__paginationPort.resolve(id, 2), b.id);
    await expect.poll(() => readProgress(page, B)).toMatchObject({ anchor: { sectionId: "identity", locale: "ru", dossierVersion: VERSION }, pageId: physicalPage("identity", b) });
    expect((await readProgress(page, A)).anchor).toMatchObject({ sectionId: "identity", locale: "en" });
    await reader(page).screenshot({ path: testInfo.outputPath("dossier-book-scope.png") });
    fixture.verify();
  } finally { await fixture.close(); }
});

test("failed physical pagination keeps accessible progress immediately and across archive remount", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await open(testInfo), { page } = fixture;
  try {
    const first = await latest(page);
    await chooseContents(page, 1);
    await expect.poll(() => readProgress(page)).toMatchObject({ anchor: { sectionId: "legal-reading", locale: "ru" }, pageId: "legal-reading" });
    await page.evaluate(id => window.__paginationPort.reject(id), first.id);
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    await page.evaluate(() => window.__navigationHarness.remount());
    const remounted = await latest(page, A, "ru", first.id);
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    await page.evaluate(id => window.__paginationPort.reject(id), remounted.id);
    await expect(reader(page)).toHaveAttribute("aria-busy", "false");
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    await reader(page).getByRole("button", { name: "Предыдущий раздел", exact: true }).click();
    await expect(section(page)).toHaveAttribute("data-section", "identity");
    await expect.poll(() => readProgress(page)).toMatchObject({ anchor: { sectionId: "identity", locale: "ru" }, pageId: "identity" });
    await reader(page).getByRole("button", { name: "Следующий раздел", exact: true }).click();
    await expect.poll(() => readProgress(page)).toMatchObject({ anchor: { sectionId: "legal-reading", locale: "ru" }, pageId: "legal-reading" });
    await reader(page).screenshot({ path: testInfo.outputPath("dossier-pagination-unavailable.png") });
    fixture.verify();
  } finally { await fixture.close(); }
});

test("switching adult identity restores its own dossier place without a transient previous-account write", async ({}, testInfo) => {
  test.setTimeout(90_000);
  const userA = "qa-reader-a", userB = "qa-reader-b";
  const fixture = await open(testInfo, { userId: userA, stores: {
    [storageKey(userA)]: [saved(A, progress("legal-reading"))],
    [storageKey(userB)]: [saved(A, progress("identity"))],
  } }), { page } = fixture;
  try {
    const layout = await latest(page);
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    await page.evaluate(id => window.__paginationPort.resolve(id, 2), layout.id);
    await expect.poll(async () => (await readProgress(page, A, userA))?.pageId).toBe(physicalPage("legal-reading", layout));
    const aBefore = await readProgress(page, A, userA);
    const boundary = await page.evaluate(() => { window.__archiveBeforeIdentityChange = document.getElementById("books"); return window.__libraryWrites.length; });
    await page.evaluate(user => window.__navigationHarness.user(user), userB);
    await expect.poll(() => page.evaluate(() => window.__navigationHarness.snapshot().userId)).toBe(userB);
    await expect(section(page)).toHaveAttribute("data-section", "identity");
    await expect.poll(() => readProgress(page, A, userB)).toMatchObject({ anchor: { sectionId: "identity", locale: "ru" }, pageId: physicalPage("identity", layout) });
    expect(await page.evaluate(() => document.getElementById("books") === window.__archiveBeforeIdentityChange)).toBe(true);
    const switchedWrites = await page.evaluate(boundary => window.__libraryWrites.slice(boundary), boundary);
    expect(switchedWrites.filter(write => write.key === storageKey(userB)).length).toBeGreaterThan(0);
    for (const write of switchedWrites) {
      expect(write.key, "The disposed personal scope must not receive any later write").not.toBe(storageKey(userA));
      if (write.key === storageKey(userB)) {
        expect(write.items.find(item => item.id === A)?.dossierProgress?.anchor.sectionId,
          "Even a subsequently corrected cross-account write is a failure").toBe("identity");
      }
    }
    expect(await readProgress(page, A, userA)).toEqual(aBefore);
    await page.evaluate(user => window.__navigationHarness.user(user), userA);
    await expect(section(page)).toHaveAttribute("data-section", "legal-reading");
    expect((await readProgress(page, A, userB)).anchor.sectionId).toBe("identity");
    await reader(page).screenshot({ path: testInfo.outputPath("dossier-personal-scope.png") });
    fixture.verify();
  } finally { await fixture.close(); }
});
