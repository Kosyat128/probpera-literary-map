import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {prepareNewsPost} from '../../../../scripts/lib/literary-news-social.mjs';
import {validatePreparedNewsMedia} from '../../../../scripts/lib/literary-news-media.mjs';
import {createSyntheticFixtures} from './synthetic-fixtures.mjs';

const dir=new URL('./',import.meta.url),x=await createSyntheticFixtures(),posts=[],checks=[];
const escaped=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const sha=b=>createHash('sha256').update(b).digest('hex');
const css=`*{box-sizing:border-box}body{margin:0;background:#fffaf2;color:#271538;font:16px/1.5 Arial,sans-serif}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:26px;line-height:1.2;margin:0 0 12px}h2{font-size:20px;margin:22px 0 12px}p{margin:8px 0}.notice{background:#300a4f;color:#fffaf2;padding:14px 18px;border-left:8px solid #f67518}.profiles{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:18px}.card{background:white;border:1px solid #dccde7;border-radius:12px;overflow:hidden;min-width:0}.platform{padding:12px 16px;background:#f5eadb;display:flex;justify-content:space-between;gap:10px;font-size:14px;font-weight:bold}.fixture-image{padding:12px;background:#fffaf2;display:flex;justify-content:center}.fixture-image img{display:block;max-width:100%;width:auto;height:auto;max-height:380px;object-fit:contain}.payload{padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.55}.meta{border-top:1px solid #eee;padding:10px 16px;color:#72667a;font-size:13px;overflow-wrap:anywhere}.empty{padding:20px;background:#faf6fd;color:#4b087c}.note{margin:16px 0 0;color:#72667a;font-size:14px}.extra{border-top:3px solid #f67518;margin-top:24px;padding-top:12px}a{color:#4b087c}b{font-weight:700}@media(max-width:600px){main{padding:16px}h1{font-size:23px}.profiles{grid-template-columns:1fr;gap:18px}.payload{padding:15px}.fixture-image img{max-height:420px}.platform{font-size:13px}}`;
const renderPost=p=>{
  const body=p.payload.caption??p.payload.text??p.payload.message;
  const ent=(p.payload.caption_entities??p.payload.entities??[])[0];
  const content=ent?`<b>${escaped(body.slice(0,ent.length))}</b>${escaped(body.slice(ent.length))}`:escaped(body);
  const media=p.media?`<div class="fixture-image"><img alt="Синтетический тестовый образец - не реальная новость" src="data:image/jpeg;base64,${x.bytesByHash.get(p.media.sha256).toString('base64')}" width="${p.media.width}" height="${p.media.height}"></div>`:`<div class="empty">Текстовый вариант. Изображение не прикреплено.</div>`;
  return `<article class="card" data-platform="${p.platform}"><div class="platform"><span>${p.platform==='telegram'?'Telegram':'VK'} / локальный макет</span><span>sendable: false</span></div>${media}<div class="payload">${content}</div><div class="meta">${p.profile}; UTF-16: ${body.length}${p.fallbackReason?`; fallback: ${escaped(p.fallbackReason)}`:''}</div></article>`;
};
for(const f of x.fixtures){
  const pair=[];
  for(const destination of x.fixtureDestinations){
    const prepared=await prepareNewsPost(f.news,x.fixtureSnapshot,destination.platform,{destination,mediaOptions:{registry:x.registry,now:x.fixtureNow,readBytes:x.readBytes}});
    expect(prepared.sendable).toBe(false);
    const p={...prepared,fixtureOnly:true,sendable:false};
    const body=p.payload.caption??p.payload.text??p.payload.message;
    expect(body).toContain(f.news.title.ru);expect(body).toContain(f.news.summary.ru);expect(body).toContain(f.news.source.url);
    if(p.media){expect(body).toContain(p.media.credit);await validatePreparedNewsMedia(p,destination,{registry:x.registry,now:x.fixtureNow,readBytes:x.readBytes});}
    if(destination.platform==='telegram'){
      const entity=(p.payload.caption_entities??p.payload.entities)[0];expect(body.slice(entity.offset,entity.offset+entity.length)).toBe(f.news.title.ru);expect(body.length).toBeLessThanOrEqual(p.media?1024:4096);
    }else{expect(p.payload.entities).toBeUndefined();expect(body).not.toContain('<b>');expect(body).not.toContain('**');}
    pair.push(p);posts.push(p);
  }
  checks.push({fixture:f.id,platforms:pair.map(p=>({platform:p.platform,hasMedia:!!p.media,profile:p.profile,fallbackReason:p.fallbackReason,payloadSha256:p.payloadSha256,sendable:false}))});
  f.posts=pair;
}
// Required credit cannot be shortened to squeeze a Telegram image caption.
const longRegistry={...x.registry,assets:[x.longCreditAsset]},noPhoto=x.fixtures.find(f=>f.id==='no-photo'),extra=[];
for(const destination of x.fixtureDestinations){
  const p={...await prepareNewsPost(noPhoto.news,x.fixtureSnapshot,destination.platform,{destination,mediaOptions:{registry:longRegistry,now:x.fixtureNow,readBytes:x.readBytes}}),fixtureOnly:true,sendable:false};
  if(destination.platform==='telegram'){expect(p.media).toBeNull();expect(p.fallbackReason).toBe('required_credit_or_caption_exceeds_limit');expect(p.payload.text).toContain(noPhoto.news.summary.ru);}
  else{expect(p.media).not.toBeNull();expect(p.payload.message).toContain(x.longCreditAsset.credit);}
  extra.push(p);
}
noPhoto.extra=extra;posts.push(...extra);
const pageFor=f=>`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ТЕСТ / ${escaped(f.label)}</title><style>${css}</style></head><body><main><h1>ТЕСТОВЫЙ ОБРАЗЕЦ: ${escaped(f.label)}</h1><div class="notice">СИНТЕТИЧЕСКИЕ ДАННЫЕ. Это не новость, не реальная обложка и не событие. Отправка отключена: sendable: false.</div><p class="note">Ниже фактический payload локального production builder. Это проверочный HTML, а не снимок приложения Telegram или VK.</p><section class="profiles">${f.posts.map(renderPost).join('')}</section>${f.extra?`<section class="extra"><h2>Дополнительный тест: длинный обязательный кредит</h2><p>Telegram сохраняет одно полное текстовое сообщение без фото. VK сохраняет изображение и полный кредит в допустимом размере сообщения.</p><div class="profiles">${f.extra.map(renderPost).join('')}</div></section>`:''}</main></body></html>`;
if(process.argv.includes('--recheck')){
  const previousBytes=await readFile(new URL('verification.json',dir));
  const previous=JSON.parse(previousBytes);
  const priorPreparedBytes=await readFile(new URL('prepared-fixtures.json',dir));
  const priorPosts=JSON.parse(priorPreparedBytes).posts;
  expect(priorPosts).toHaveLength(posts.length);
  const payloadComparisons=posts.map((p,i)=>{
    const prior=priorPosts[i],oldBytes=Buffer.from(JSON.stringify(prior.payload)),newBytes=Buffer.from(JSON.stringify(p.payload));
    expect([p.newsId,p.platform]).toEqual([prior.newsId,prior.platform]);
    expect(newBytes.equals(oldBytes)).toBe(true);expect(p.payloadSha256).toBe(prior.payloadSha256);expect(p.sendable).toBe(false);
    return{index:i,newsId:p.newsId,platform:p.platform,byteEqual:true,previousPayloadSha256:prior.payloadSha256,currentPayloadSha256:p.payloadSha256,sendable:false};
  });
  const templateComparisons=[];
  for(const f of x.fixtures){
    const filename=`${f.id}.html`,oldBytes=await readFile(new URL(filename,dir)),newBytes=Buffer.from(pageFor(f));
    expect(newBytes.equals(oldBytes)).toBe(true);
    templateComparisons.push({filename,byteEqual:true,previousSha256:sha(oldBytes),currentSha256:sha(newBytes)});
  }
  const retainedScreens=[];
  for(const screen of previous.screens){
    const currentSha256=sha(await readFile(new URL(screen.filename,dir)));
    expect(currentSha256).toBe(screen.sha256);
    retainedScreens.push({filename:screen.filename,previousSha256:screen.sha256,currentSha256,byteEqual:true});
  }
  const paths=[...new Set([...previous.sourceHashes.map(row=>row.path),'reports/r10/social/quality/render-synthetic-previews.mjs'])];
  const currentSourceHashes=await Promise.all(paths.map(async path=>({path,sha256:sha(await readFile(path))})));
  const preparedBytes=Buffer.from(JSON.stringify({schemaVersion:1,fixtureOnly:true,sendable:false,posts},null,2)+'\n');
  const recheckAt=new Date().toISOString();
  const report={...previous,status:'passed-local-fixtures-rechecked',recheckAt,
    initialRenderingSourceHashes:previous.initialRenderingSourceHashes??previous.sourceHashes,
    sourceHashes:currentSourceHashes,
    sourceHashesCurrent:currentSourceHashes.map(row=>({...row,currentSha256:row.sha256})),
    checks,longCredit:extra.map(p=>({platform:p.platform,hasMedia:!!p.media,fallbackReason:p.fallbackReason,sendable:false})),
    postFreezeRecheck:{checkedAt:recheckAt,status:'payload-equal after transport-only changes',
      scope:'Current builder and media validators executed locally. All 14 payload byte strings and six rendered HTML templates are identical. Existing 18 visually inspected PNG bytes retained. No new screenshot or visual-review claim.',
      previousReceiptSha256:sha(previousBytes),previousPreparedFileSha256:sha(priorPreparedBytes),currentPreparedFileSha256:sha(preparedBytes),
      payloadComparisons,templateComparisons,retainedScreens,
      retainedVisualReviewAt:previous.visualInspection.checkedAt,newVisualReview:false,newScreenshots:0,apiWrites:0,externalRequests:0,
      inheritedSendableFalseChecked:true,sourceHashes:currentSourceHashes}};
  await writeFile(new URL('prepared-fixtures.json',dir),preparedBytes);
  await writeFile(new URL('verification.json',dir),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,payloadsByteEqual:payloadComparisons.length,templatesByteEqual:templateComparisons.length,retainedScreens:retainedScreens.length,newScreenshots:0,sourceHashes:currentSourceHashes,verificationSha256:sha(Buffer.from(JSON.stringify(report,null,2)+'\n'))}));
  process.exit(0);
}
await mkdir(dir,{recursive:true});
for(const f of x.fixtures)await writeFile(new URL(`${f.id}.html`,dir),pageFor(f));
await writeFile(new URL('index.html',dir),`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Синтетические Q previews</title><style>${css}</style><main><h1>Шесть тестовых профилей</h1><div class="notice">SYNTHETIC / SENDABLE: FALSE. Только локальная проверка.</div>${x.fixtures.map(f=>`<p><a href="${f.id}.html">${escaped(f.label)}</a></p>`).join('')}</main></html>`);
await writeFile(new URL('prepared-fixtures.json',dir),JSON.stringify({schemaVersion:1,fixtureOnly:true,sendable:false,posts},null,2)+'\n');
const browser=await chromium.launch({channel:'chrome',headless:true}),screens=[];
try{
  for(const width of [1200,360,430])for(const f of x.fixtures){
    const p=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
    await p.route(/^https?:/,r=>r.abort());
    await p.setContent(pageFor(f));await p.evaluate(()=>document.fonts.ready);await p.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
    const measurements=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,height:document.documentElement.scrollHeight,images:[...document.images].map(i=>{const b=i.getBoundingClientRect();return{natural:[i.naturalWidth,i.naturalHeight],visible:[b.width,b.height],fit:getComputedStyle(i).objectFit};}),cards:[...document.querySelectorAll('.card')].map(c=>({overflow:c.scrollWidth-c.clientWidth}))}));
    expect(measurements.overflow).toBeLessThanOrEqual(1);for(const card of measurements.cards)expect(card.overflow).toBeLessThanOrEqual(1);
    for(const i of measurements.images){expect(i.fit).toBe('contain');expect(i.visible[0]/i.visible[1]).toBeCloseTo(i.natural[0]/i.natural[1],2);}
    const filename=`${f.id}-${width}.png`;await p.screenshot({path:fileURLToPath(new URL(filename,dir)),fullPage:true});
    screens.push({fixture:f.id,width,filename,sha256:sha(await readFile(new URL(filename,dir))),...measurements});await p.close();
  }
}finally{await browser.close();}
const report={checkedAt:new Date().toISOString(),status:'passed-local-fixtures',sendable:false,fixtureOnly:true,humanReview:false,visualInspection:'pending',
  externalRequests:0,apiWrites:0,productionRegistryChanged:false,profiles:6,preparedVariants:posts.length,
  sourceHashes:await Promise.all(['scripts/lib/literary-news-social.mjs','scripts/lib/literary-news-media.mjs','reports/r10/social/quality/synthetic-fixtures.mjs'].map(async path=>({path,sha256:sha(await readFile(path))}))),
  limits:{telegramPhotoCaption:1024,telegramText:4096,vkText:16000},checks,longCredit:extra.map(p=>({platform:p.platform,hasMedia:!!p.media,fallbackReason:p.fallbackReason,sendable:false})),screens};
await writeFile(new URL('verification.json',dir),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,profiles:6,preparedVariants:posts.length,screens:screens.length,longCredit:report.longCredit,overflows:screens.filter(s=>s.overflow>1).length}));
