import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const phase=process.argv[2]||'after';
const base=process.argv[3]||'http://127.0.0.1:4185/';
assert(['before','source','after'].includes(phase));
const out=path.resolve('reports/bookshelf-owner-evidence/navigation-alignment',phase);
await mkdir(out,{recursive:true});
const report={phase,base,started:new Date().toISOString(),cases:[],sourceInjection:phase==='source'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:900},bypassCSP:true,reducedMotion:'reduce'});
 const page=await context.newPage();
 for(const kind of ['sections','articles']){
  await page.setViewportSize({width:1440,height:900});await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.magazine-hero').waitFor({state:'visible'});
  await page.locator(`.${kind}-menu > summary`).click();
  await page.locator(kind==='sections'?'.sections-mega-groups a':'.articles-mega-content > section a').first().waitFor({state:'visible'});
  await page.evaluate(()=>document.fonts.ready);
  if(phase==='after'){
   const localFaces=await page.evaluate(async()=>{
    const faces=await Promise.all([400,500,600].map(weight=>document.fonts.load(`${weight} 16px "Onest Local"`,'Навигация по разделам')));
    return faces.map(group=>group.map(face=>({family:face.family,status:face.status})));
   });
   assert(localFaces.every(group=>group.length>0&&group.every(face=>face.status==='loaded')),'Actual local Onest faces must load; a CSS fallback declaration is insufficient');
   report.loadedLocalFaces=localFaces;
  }
  if(phase==='source'){
   await page.addStyleTag({content:await readFile('src/styles/navigation-panels.css','utf8')});
   await page.addStyleTag({content:await readFile('src/styles/site-typography.css','utf8')});
   await page.locator('.sections-mega-groups').evaluate(grid=>grid.style.setProperty('--menu-group-rows',String(1+2*Math.max(...[...grid.children].map(group=>group.querySelectorAll('a').length)))));
  }
  const originalText=await page.locator(`.${kind}-mega-menu`).textContent();
  for(const width of [1440,1024,390]){
   if(width===1024){
    await page.locator(`.${kind}-mega-menu`).evaluate(panel=>{
     const host=document.createElement('details');host.className=`nav-layout-fixture ${panel.classList.contains('sections-mega-menu')?'sections':'articles'}-menu`;host.open=true;
     host.append(panel.cloneNode(true));document.body.replaceChildren(host);
    });
    await page.addStyleTag({content:'.nav-layout-fixture{display:block;padding:16px 0}.nav-layout-fixture > div{position:relative;left:auto;top:auto;width:calc(100vw - 32px);margin:0 auto;opacity:1;visibility:visible;pointer-events:auto;transform:none}'});
   }
   await page.setViewportSize({width,height:900});
   const panel=page.locator(`.${kind}-mega-menu`);
   const metrics=await panel.evaluate((element,{kind,width})=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const textBoxes=e=>{const range=document.createRange();range.selectNodeContents(e);return [...range.getClientRects()].filter(r=>r.width>0).map(r=>({x:r.x,y:r.y,right:r.right,bottom:r.bottom}))};
    const font=e=>{const s=getComputedStyle(e);return{family:s.fontFamily,size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight}};
    const items=[...element.querySelectorAll(kind==='sections'?'.sections-mega-groups a':'.articles-mega-content > section a')].map(a=>({box:rect(a),title:textBoxes(a.querySelector('strong')),description:textBoxes(a.querySelector(kind==='sections'?'small':'span')),titleFont:font(a.querySelector('strong')),descriptionFont:font(a.querySelector(kind==='sections'?'small':'span')),text:a.textContent}));
    const rowSpreads=[];
    if(kind==='sections'){
     const groups=[...element.querySelectorAll('.sections-mega-groups > section')].map(group=>[...group.querySelectorAll('a')]);
     const columns=width>1040?4:width>600?2:1;
     for(let start=0;start<groups.length;start+=columns)for(let index=0;index<Math.max(...groups.slice(start,start+columns).map(group=>group.length));index++){
      const anchors=groups.slice(start,start+columns).flatMap(group=>group[index]?[group[index]]:[]);
      rowSpreads.push({group:start,index,title:Math.max(...anchors.map(a=>textBoxes(a.querySelector('strong'))[0].y))-Math.min(...anchors.map(a=>textBoxes(a.querySelector('strong'))[0].y)),description:Math.max(...anchors.map(a=>textBoxes(a.querySelector('small'))[0].y))-Math.min(...anchors.map(a=>textBoxes(a.querySelector('small'))[0].y))});
     }
    }else for(let index=0;index<items.length;index+=width>600?2:1){const row=items.slice(index,index+(width>600?2:1));rowSpreads.push({index,title:Math.max(...row.map(item=>item.title[0].y))-Math.min(...row.map(item=>item.title[0].y)),description:Math.max(...row.map(item=>item.description[0].y))-Math.min(...row.map(item=>item.description[0].y))})}
    const scroller=element.querySelector(kind==='sections'?'.sections-mega-groups':'.articles-mega-content');
    return{kind,width,panel:rect(element),items,rowSpreads,overflow:scroller.scrollWidth-scroller.clientWidth,fullHeight:scroller.scrollHeight,viewportHeight:scroller.clientHeight,menuRows:kind==='sections'?getComputedStyle(scroller).getPropertyValue('--menu-group-rows').trim():null};
   },{kind,width});
   assert.equal(await panel.textContent(),originalText,'A responsive state changed authored text');
   const clipping=metrics.items.flatMap((item,index)=>[...item.title,...item.description].filter(box=>box.x<item.box.x-1||box.right>item.box.right+1||box.y<item.box.y-1||box.bottom>item.box.bottom+1).map(box=>({index,box,bounds:item.box})));
   const overlaps=metrics.items.filter(item=>Math.max(...item.title.map(box=>box.bottom))>Math.min(...item.description.map(box=>box.y))+1);
   if(phase!=='before'){
    assert(metrics.rowSpreads.every(row=>row.title<=1&&row.description<=1),JSON.stringify(metrics.rowSpreads));
    assert.equal(metrics.overflow,0);assert.deepEqual(clipping,[]);assert.deepEqual(overlaps,[]);
    assert(metrics.items.every(item=>item.titleFont.family.includes('Onest Local')&&item.titleFont.weight==='500'));
    assert(metrics.items.every(item=>item.descriptionFont.family.includes('Onest Local')&&item.descriptionFont.weight==='400'));
    if(kind==='sections')assert(metrics.items.every(item=>parseFloat(item.descriptionFont.size)>=15));
   }
   await panel.screenshot({path:path.join(out,`${kind}-${width}.png`),animations:'disabled'});
   const last=panel.locator(kind==='sections'?'.sections-mega-groups a':'.articles-mega-content > section a').last();
   await last.scrollIntoViewIfNeeded();
   const lastReachable=await last.evaluate((anchor,kind)=>{const box=anchor.getBoundingClientRect();const scroller=anchor.closest(kind==='sections'?'.sections-mega-groups':'.articles-mega-content').getBoundingClientRect();return box.top>=scroller.top-1&&box.bottom<=scroller.bottom+1},kind);
   assert(lastReachable,'Last menu link cannot be reached through the scrolling content');
   await panel.locator(kind==='sections'?'.sections-mega-groups':'.articles-mega-content').evaluate(element=>element.scrollTop=0);
   report.cases.push({...metrics,clipping,overlapCount:overlaps.length,fullTextPreserved:true,lastLinkReachable:true,surface:width===1440?'normal production navigation':'isolated actual-menu DOM; compiled responsive layout, fixture position only'});
  }
 }
 if(phase==='after'){
  const before=JSON.parse(await readFile(path.join(out,'../before/metrics.json'),'utf8'));
  for(const entry of report.cases){const original=before.cases.find(candidate=>candidate.kind===entry.kind&&candidate.width===entry.width);assert.deepEqual(entry.items.map(item=>item.text),original.items.map(item=>item.text),'Authored menu text changed since baseline')}
 }
 report.status=phase==='before'?'baseline captured':'passed';
}finally{await browser.close();report.finished=new Date().toISOString();await writeFile(path.join(out,'metrics.json'),JSON.stringify(report,null,2)+'\n')}
process.stdout.write(JSON.stringify({phase,status:report.status,cases:report.cases.length,rowSpread:report.cases.map(c=>({kind:c.kind,width:c.width,max:Math.max(...c.rowSpreads.flatMap(r=>[r.title,r.description]))}))})+'\n');
