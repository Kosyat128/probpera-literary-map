import {chromium,expect} from "@playwright/test";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {buildPublishedNewsFeed} from "./lib/literary-news-publication.mjs";
import {pendingNewsSourceState} from "./lib/literary-news-state.mjs";
const current=new Date(), records=JSON.parse(await readFile(new URL("../data/news/reviewed.json",import.meta.url),"utf8"));
const base={...records.find(row=>row.kind==="news"),eventDate:"2026-09-25",publishedAt:null,verifiedAt:"2026-09-25T12:00:00Z"};
const fixture=Array.from({length:1001},(_,i)=>({...base,id:`boundary-${i}`,eventKey:`browser-event-${i}`,
  title:{ru:`Проверка BoundaryMarker${i} книги`,en:`Book boundary BoundaryMarker${i}`}}));
const build=(items,withdrawals=[])=>buildPublishedNewsFeed({records:items,withdrawals,current,release:"b".repeat(40),state:pendingNewsSourceState()});
const origin="http://127.0.0.1:5173",dir=new URL("../reports/r10/publication/browser/withdrawal-hardening/",import.meta.url);
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true}),checks=[],errors=[];
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:"Europe/Moscow"});
const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
let feed=await build(fixture),offline=false;
const original=structuredClone(feed);
await page.route("https://news.probpera.ru/**",route=>offline?route.abort():route.fulfill({contentType:"application/json",body:JSON.stringify(feed),headers:{"Access-Control-Allow-Origin":"*"}}));
await page.route("**/literary-news-snapshot.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({...original,fallbackCapturedAt:original.generatedAt})}));
try {
  await page.goto(`${origin}/#literary-news`);const panel=page.locator("#literary-news");await panel.waitFor();
  await expect(panel.locator(".literary-news__item")).toHaveCount(3);checks.push("1001 complete records, initial DOM has 3 cards");
  await panel.getByRole("button",{name:/Все события \(1001\)/}).click();
  await expect(panel.locator(".literary-news__item")).toHaveCount(25);
  await panel.getByRole("button",{name:/Показать ещё/}).click();await expect(panel.locator(".literary-news__item")).toHaveCount(50);
  checks.push("bounded continuation 3 -> 25 -> 50");
  await panel.locator(".literary-news__search-toggle").click();await panel.getByRole("searchbox").fill("BoundaryMarker1000");
  await expect(panel.locator(".literary-news__item")).toHaveCount(1);
  await expect(panel.locator("[data-news-id='boundary-1000']")).toBeVisible();checks.push("search reaches item 1001 outside rendered prefix");
  await panel.getByRole("button",{name:/Сохранить новость/}).click();
  const withdrawals=[{id:"boundary-1000",withdrawnAt:current.toISOString(),reason:"Изолированная проверка отзыва"}];
  feed=await build(fixture,withdrawals);await panel.getByRole("button",{name:"Обновить ленту",exact:true}).click();
  await expect(panel.locator("[data-news-id='boundary-1000']")).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem("probpera-literary-news-withdrawals-v1"))).toContain("boundary-1000");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("probpera-literary-news-withdrawals-v1"))))
    .toMatchObject({schemaVersion:2,reliable:true,rows:[["boundary-1000",current.toISOString()]]});
  offline=true;await page.reload();await panel.locator(".literary-news__search-toggle").click();await panel.getByRole("searchbox").fill("BoundaryMarker1000");
  await expect(panel.locator("[data-news-id='boundary-1000']")).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.querySelector("#literary-news")?.getAttribute("data-news-mode"))).toBe("reviewed");
  expect(await page.evaluate(()=>localStorage.getItem("probpera-literary-news-saved-v1"))).toContain("boundary-1000");
  checks.push("explicit withdrawal survives reload and older origin fallback; saved identity is retained");
  await panel.screenshot({path:fileURLToPath(new URL("fallback-withdrawal.png",dir))});
  const quotaContext=await browser.newContext({viewport:{width:1280,height:900}});
  try {
    const seed=await page.evaluate(()=>localStorage.getItem("probpera-literary-news-withdrawals-v1"));
    await quotaContext.addInitScript(({seed})=>{
      const key="probpera-literary-news-withdrawals-v1",write=Storage.prototype.setItem;
      if(!localStorage.getItem("r10-quota-fixture-seeded")){write.call(localStorage,key,seed);write.call(localStorage,"r10-quota-fixture-seeded","1");}
      Storage.prototype.setItem=function(name,value){if(name===key && value.length>100)throw new DOMException("Fixture quota exhausted","QuotaExceededError");return write.call(this,name,value);};
    },{seed});
    const quotaPage=await quotaContext.newPage();let quotaOffline=false,fallbackRequests=0;
    const quotaFeed=await build(fixture,[...withdrawals,{id:"boundary-999",withdrawnAt:current.toISOString(),reason:"Quota fixture withdrawal"}]);
    await quotaPage.route("https://news.probpera.ru/**",route=>quotaOffline?route.abort():route.fulfill({contentType:"application/json",body:JSON.stringify(quotaFeed),headers:{"Access-Control-Allow-Origin":"*"}}));
    await quotaPage.route("**/literary-news-snapshot.json",route=>{fallbackRequests++;return route.fulfill({contentType:"application/json",body:JSON.stringify(original)});});
    await quotaPage.goto(`${origin}/#literary-news`);const quotaPanel=quotaPage.locator("#literary-news");
    await expect(quotaPanel.locator(".literary-news__item")).toHaveCount(3);
    await expect.poll(()=>quotaPage.evaluate(()=>JSON.parse(localStorage.getItem("probpera-literary-news-withdrawals-v1"))?.reliable)).toBe(false);
    quotaOffline=true;
    for(let repeat=0;repeat<2;repeat++){
      await quotaPage.reload();await expect(quotaPanel.getByText("Не удалось получить ленту",{exact:true})).toBeVisible();
      await expect(quotaPanel.locator(".literary-news__item")).toHaveCount(0);
    }
    expect(fallbackRequests).toBe(0);
    await quotaPanel.screenshot({path:fileURLToPath(new URL("dirty-history-blocked.png",dir))});
    checks.push("quota failure leaves compact dirty marker; two offline reloads block older fallback before fetching it");
  } finally {await quotaContext.close();}
  offline=false;feed=await build(records);await page.reload();await expect(panel.locator(".literary-news__item")).toHaveCount(3);
  await panel.screenshot({path:fileURLToPath(new URL("real-batch-ru.png",dir))});
  await page.locator(".interface-language-control button").nth(1).click();await expect(panel.locator("h2")).toHaveText("The literary briefing");
  await panel.screenshot({path:fileURLToPath(new URL("real-batch-en.png",dir))});
  await page.setViewportSize({width:390,height:844});await panel.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(2);
  await panel.screenshot({path:fileURLToPath(new URL("real-batch-mobile.png",dir))});
  checks.push("real local prepared records: RU, EN and 390px width");expect(errors).toEqual([]);
} finally {
  await writeFile(new URL("receipt.json",dir),JSON.stringify({checkedAt:new Date().toISOString(),browser:browser.version(),origin,
    production:false,fixtures:"1001 synthetic records never written into publication data",realPreparedPublicProjection:feed.items.length,checks,errors},null,2)+"\n");
  await browser.close();
}
console.log(JSON.stringify({checks,errors}));
