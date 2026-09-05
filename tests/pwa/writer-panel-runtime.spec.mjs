import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Real component, canonical records, global language control and normal
// providers in Chrome. Only the parent runtime's asynchronous completion is
// controlled. This is a component fixture, not app artifact/WebGL evidence.
const SITE = "https://writer-panel-runtime.test";
let browser, bundle;
test.beforeAll(async () => {
  const result = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), loader: "jsx", contents: `
      import React,{useCallback,useState} from 'react';import{createRoot}from'react-dom/client';
      import{InterfaceLanguageProvider,useInterfaceLanguage}from'./src/i18n/InterfaceLanguage';
      import InterfaceLanguageControl from'./src/components/InterfaceLanguageControl';
      import{AuthProvider}from'./src/community/AuthContext';
      import WriterPanel from'./src/components/WriterPanel';
      import{countries,bookArchiveCountries}from'./src/planet/catalog';
      import{buildBookArchive,isPublicBook}from'./src/planet/books';
      const country=countries.find(item=>item.id==='russia');
      const writer=country.writers.find(item=>item.id==='dostoevsky');
      const publicBooks=buildBookArchive(bookArchiveCountries).filter(isPublicBook);
      const crime=publicBooks.find(item=>item.countryId==='russia'&&item.writerId==='dostoevsky'&&item.id==='crime-and-punishment');
      if(!crime)throw new Error('Canonical publication-gated Crime and Punishment required');
      const log={loads:0,retries:0,selections:[],opens:[]},pending=[];
      let rendered;
      const root=createRoot(document.getElementById('root'));
      window.__writerPanelRuntime={snapshot:()=>({...rendered,...log,pending:pending.length}),
        settle:outcome=>{const request=pending.shift();if(!request)throw new Error('No pending runtime attempt');request(outcome)},
        unmount:()=>root.unmount()};
      function View(){
        const{language}=useInterfaceLanguage();
        const[selected,setSelected]=useState(window.__writerPanelInitial.nullWriter?null:writer);
        const[status,setStatus]=useState(window.__writerPanelInitial.readyEmpty?'ready':'idle');
        const[books,setBooks]=useState([]);
        const begin=useCallback(kind=>{log[kind]++;setStatus('loading');
          new Promise(resolve=>pending.push(resolve)).then(outcome=>{
            if(outcome==='error'){setStatus('error');return}
            setBooks(outcome==='empty'?[]:publicBooks);setStatus('ready');
          });
        },[]);
        const load=useCallback(()=>begin('loads'),[begin]);
        const retry=useCallback(()=>begin('retries'),[begin]);
        const select=useCallback(next=>{log.selections.push(next.id);setSelected(next)},[]);
        const open=useCallback((countryId,writerId,workId,trigger)=>log.opens.push({countryId,writerId,workId,button:trigger instanceof HTMLButtonElement}),[]);
        rendered={language,status,writer:selected?.id??null,books:books.length};
        return <main><InterfaceLanguageControl/><WriterPanel country={country} books={books} booksStatus={status}
          onLoadBooks={load} onRetryBooks={retry} selectedWriter={selected} onWriterSelect={select} onWorkSelect={open}/></main>;
      }
      root.render(<React.StrictMode><InterfaceLanguageProvider><AuthProvider><View/></AuthProvider></InterfaceLanguageProvider></React.StrictMode>);
    ` }, bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", jsx: "automatic", loader: { ".css": "empty" }, logLevel: "silent",
    define: { "process.env.NODE_ENV": '"development"', "import.meta.env": JSON.stringify({ BASE_URL: "/", DEV: false }), __LITERARY_PLANET_EDITION__: '"pwa"', __LITERARY_PLANET_LOCAL_QA__: "false" },
  });
  bundle = result.outputFiles[0].text;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});
test.afterAll(async () => { await browser?.close(); });

async function open(initial = {}) {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().url() === SITE + "/ru/"
    ? route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ru" data-route-language="ru"><body><div id="root"></div></body></html>' })
    : route.abort());
  await page.goto(SITE + "/ru/");
  await page.evaluate(value => { window.__writerPanelInitial = value; }, initial);
  await page.addScriptTag({ content: bundle });
  await expect(page.locator(".country-panel")).toBeVisible();
  return { page, errors };
}
const snapshot = page => page.evaluate(() => window.__writerPanelRuntime.snapshot());
const works = page => page.locator("#writer-biography-russia-panel-works .writer-record-section.is-works");
async function selectWorks(page) { await page.locator("#writer-biography-russia-tab-works").click(); }
async function locale(page, language) {
  await page.locator(".interface-language-control button").filter({ hasText: language.toUpperCase() }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
}
async function settle(page, outcome) {
  await expect.poll(async () => (await snapshot(page)).pending).toBe(1);
  await page.evaluate(value => window.__writerPanelRuntime.settle(value), outcome);
  await expect.poll(async () => (await snapshot(page)).status).toBe(outcome === "error" ? "error" : "ready");
}
const crimeButton = (page, language) => works(page).getByRole("button", {
  name: language === "ru" ? "Книжный архив: Преступление и наказание" : "Book archive: Crime and Punishment", exact: true,
});

test("idle biography does not load; works loads once and locale changes cannot repeat the pending request", async () => {
  const { page, errors } = await open();
  try {
    await expect(page.locator("#writer-biography-russia-tab-biography")).toHaveAttribute("aria-selected", "true");
    expect(await snapshot(page)).toMatchObject({ status: "idle", loads: 0, retries: 0, writer: "dostoevsky", selections: [], pending: 0 });
    await selectWorks(page);
    await expect(works(page).getByRole("status")).toContainText("Загружаем каталог произведений…");
    await expect(works(page).locator(".writer-record-open-book")).toHaveCount(0);
    for (const language of ["en", "ru"]) {
      await locale(page, language);
      await expect(page.locator("#writer-biography-russia-tab-works")).toHaveAttribute("aria-selected", "true");
      await expect(works(page).getByRole("status")).toContainText(language === "en" ? "Loading the works catalog…" : "Загружаем каталог произведений…");
      expect(await snapshot(page)).toMatchObject({ status: "loading", loads: 1, retries: 0, writer: "dostoevsky", selections: [], pending: 1 });
    }
    await settle(page, "ready");
    await expect(crimeButton(page, "ru")).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ status: "ready", loads: 1, retries: 0, pending: 0 });
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("runtime failure is explicit in RU/EN; only the retry button starts the next asynchronous attempt", async () => {
  const { page, errors } = await open();
  try {
    await selectWorks(page); await settle(page, "error");
    await expect(works(page).getByRole("status")).toContainText("Каталог произведений пока недоступен. Повторите попытку.");
    await expect(works(page).getByRole("button", { name: "Повторить загрузку", exact: true })).toBeVisible();
    await expect(works(page).locator(".writer-record-open-book")).toHaveCount(0);
    await locale(page, "en");
    await expect(works(page).getByRole("status")).toContainText("The works catalog is currently unavailable. Try again.");
    expect(await snapshot(page)).toMatchObject({ status: "error", loads: 1, retries: 0, pending: 0, selections: [] });
    await works(page).getByRole("button", { name: "Retry loading", exact: true }).click();
    await expect(works(page).getByRole("status")).toContainText("Loading the works catalog…");
    await expect(works(page).getByRole("button", { name: "Retry loading", exact: true })).toHaveCount(0);
    expect(await snapshot(page)).toMatchObject({ status: "loading", loads: 1, retries: 1, pending: 1 });
    await locale(page, "ru");
    expect(await snapshot(page)).toMatchObject({ status: "loading", loads: 1, retries: 1, pending: 1 });
    await settle(page, "ready");
    await expect(crimeButton(page, "ru")).toBeVisible();
    expect(await snapshot(page)).toMatchObject({ writer: "dostoevsky", loads: 1, retries: 1, selections: [], pending: 0 });
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});

test("a ready canonical record keeps writer and works DOM across RU/EN without a second load", async () => {
  const { page, errors } = await open();
  let original;
  try {
    await selectWorks(page); await settle(page, "ready");
    await expect(crimeButton(page, "ru")).toBeVisible();
    original = await page.evaluateHandle(() => ({ document, detail: document.querySelector(".writer-detail"),
      tab: document.getElementById("writer-biography-russia-tab-works"), panel: document.getElementById("writer-biography-russia-panel-works") }));
    for (const language of ["en", "ru"]) {
      await locale(page, language);
      await expect(crimeButton(page, language)).toBeVisible();
      await expect(page.locator("#writer-biography-russia-tab-works")).toHaveAttribute("aria-selected", "true");
      expect(await original.evaluate(previous => previous.document === document && previous.detail === document.querySelector(".writer-detail")
        && previous.tab === document.getElementById("writer-biography-russia-tab-works")
        && previous.panel === document.getElementById("writer-biography-russia-panel-works"))).toBe(true);
      expect(await snapshot(page)).toMatchObject({ status: "ready", writer: "dostoevsky", loads: 1, retries: 0, pending: 0, selections: [] });
    }
    await crimeButton(page, "ru").click();
    expect((await snapshot(page)).opens).toEqual([{ countryId: "russia", writerId: "dostoevsky", workId: "crime-and-punishment", button: true }]);
    expect(errors).toEqual([]);
  } finally { await original?.dispose(); await page.close(); }
});

test("explicit null writer and a ready empty catalog cannot resurrect an implicit author or raw works", async () => {
  const { page, errors } = await open({ nullWriter: true, readyEmpty: true });
  try {
    await expect(page.locator(".writer-detail")).toHaveCount(0);
    await locale(page, "en"); await locale(page, "ru");
    expect(await snapshot(page)).toMatchObject({ writer: null, loads: 0, retries: 0, selections: [] });
    await page.locator(".writer-row").filter({ hasText: "Достоевский" }).click();
    await expect(page.locator(".writer-detail h4")).toContainText("Достоевский");
    await selectWorks(page);
    await expect(works(page).locator(".writer-record-open-book")).toHaveCount(0);
    await expect(works(page).getByRole("status")).toContainText("Проверенные произведения этого автора пока не опубликованы.");
    expect(await snapshot(page)).toMatchObject({ status: "ready", writer: "dostoevsky", books: 0, loads: 0, retries: 0, selections: ["dostoevsky"] });
    expect(errors).toEqual([]);
  } finally { await page.close(); }
});
