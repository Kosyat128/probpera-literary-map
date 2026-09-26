import {chromium,expect} from "@playwright/test";
import {writeFile,readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
const browser=await chromium.launch({channel:"chrome",headless:true}),results=[];
const dir="reports/r10/showcase/",origin="http://127.0.0.1:5173";
try {
  const actual=await browser.newPage({viewport:{width:1280,height:600}});await actual.goto(origin);await actual.locator(".articles-menu>summary").click();await expect(actual.locator(".articles-mega-content a")).toHaveCount(7);
  const geometry=await actual.locator(".articles-mega-menu").evaluate(el=>({bottom:el.getBoundingClientRect().bottom,scroll:el.scrollHeight-el.clientHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  expect(geometry.bottom).toBeLessThanOrEqual(600);expect(geometry.scroll).toBeGreaterThanOrEqual(0);await actual.locator(".articles-mega-menu").evaluate(el=>el.scrollTop=el.scrollHeight);await expect(actual.locator(".articles-mega-menu>footer")).toBeInViewport();await actual.locator(".articles-mega-menu").evaluate(el=>el.scrollTop=0);expect(geometry.overflow).toBeLessThanOrEqual(1);
  await actual.screenshot({path:dir+"after-css-policy-real600.png"});results.push({name:"real 1+6 at1280x600",...geometry});
  const catalog=await actual.evaluate(async()=> (await import("/src/data/articles/catalog.ts")).articleCatalog);
  await actual.close();
  const entries=catalog.slice(0,7).map((row,index)=>({...row,id:`css-policy-${index}`,sectionId:`css-${index}`,publishedAt:"2026-09-01T00:00:00Z",imageUrl:"/r10-policy-missing.png",title:`Часть 10. ${"Длинное литературное название ".repeat(5)} ${"Длинноеслово".repeat(12)}`,description:"Полный авторский анонс. ".repeat(12),translations:{en:{...row.translations?.en,locale:"en",title:`Part 10. ${"Long literary title ".repeat(6)} ${"UnbrokenWord".repeat(12)}`,description:"Complete literary announcement. ".repeat(12),sectionLabel:"Literary studies",publishedAt:"2026-09-01T00:00:00Z",publishedLabel:"1 September 2026",translationStatus:"published"}}}));
  for(const language of ["ru","en"]){
    const page=await browser.newPage({viewport:{width:1280,height:600}});
    await page.route("**/src/data/articles/catalog.ts*",route=>route.fulfill({contentType:"application/javascript",body:`export const articleCatalog=${JSON.stringify(entries)};`}));
    await page.goto(origin);if(language==="en")await page.locator(".interface-language-control button").nth(1).click();await page.locator(".articles-menu>summary").click();
    await expect(page.locator(".articles-mega-content a")).toHaveCount(7);await expect(page.locator(".articles-mega-image-fallback")).toBeVisible();
    const m=await page.locator(".articles-mega-menu").evaluate(el=>({scroll:el.scrollHeight-el.clientHeight,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,textOverflow:[...el.querySelectorAll("strong,p")].filter(x=>x.clientWidth>0&&x.scrollWidth>x.clientWidth+1).length,fallbackFont:getComputedStyle(el.querySelector(".articles-mega-image-fallback")).fontFamily,wrap:getComputedStyle(el.querySelector("strong")).overflowWrap}));
    expect(m.scroll).toBeGreaterThan(0);expect(m.overflow).toBeLessThanOrEqual(1);expect(m.textOverflow).toBe(0);expect(m.wrap).toBe("break-word");
    await page.screenshot({path:dir+`after-css-policy-long-${language}.png`});await page.locator(".articles-mega-menu").evaluate(el=>el.scrollTop=el.scrollHeight);await expect(page.locator(".articles-mega-menu>footer")).toBeInViewport();results.push({name:`long ${language} and unbroken words`,...m});await page.close();
  }
  const evidence={checkedAt:new Date().toISOString(),browser:browser.version(),sourceCssSha256:createHash("sha256").update(await readFile("src/styles/header-showcase-r10.css")).digest("hex"),checks:results,failures:[],humanReview:false};
  await writeFile(dir+"css-policy-check.json",JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(evidence));
}finally{await browser.close();}
