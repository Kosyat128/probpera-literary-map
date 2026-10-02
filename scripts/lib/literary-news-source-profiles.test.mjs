import {test} from 'vitest';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNewsService } from './literary-news-feed.mjs';
import { LITERARY_NEWS_SOURCES, LEGACY_LITERARY_NEWS_SOURCES } from './literary-news-sources.mjs';
import { R10_SOURCE_PROFILES } from './literary-news-source-profiles.mjs';
import { safeAddress } from '../research-literary-news-sources.mjs';

const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
test('expanded registry retains every legacy ID, separates source country/coverage and publisher families',()=>{
  const byId=new Map(LITERARY_NEWS_SOURCES.map(x=>[x.id,x]));
  assert.equal(byId.size,LITERARY_NEWS_SOURCES.length);
  for(const old of LEGACY_LITERARY_NEWS_SOURCES)assert.ok(byId.has(old.id));
  assert.equal(byId.get('prh').sourceFamilyId,byId.get('prh-library').sourceFamilyId);
  assert.equal(byId.get('virago').sourceFamilyId,byId.get('hachette-book-group').sourceFamilyId);
  assert.deepEqual(byId.get('hay-festival-queretaro').countryCodes,['GB']);
  assert.deepEqual(byId.get('hay-festival-queretaro').coverageCountryCodes,['MX']);
  assert.deepEqual(byId.get('penbelarus-org').countryCodes,[]);
  assert.equal(byId.get('netflix-book-adaptations').discoveryEnabled,false);
  assert.equal(byId.get('netflix-book-adaptations').disabledReason,'robots_disallowed');
  for(const source of LITERARY_NEWS_SOURCES){
    assert.ok(Object.isFrozen(source));
    assert.match(source.sourceFamilyId,/^[a-z0-9][a-z0-9_-]+$/);
    for(const code of [...source.countryCodes,...source.coverageCountryCodes])assert.match(code,/^[A-Z]{2}$/);
    assert.equal(new URL(source.url).protocol,'https:');
    if(source.evidenceReport){assert.equal(source.autoPublication,false);assert.ok(source.exampleArticleUrls.length);}
  }
});
test('all promoted profiles parse their actual observed item URL with the production parser',async()=>{
  for(const profile of R10_SOURCE_PROFILES){
    const source=LITERARY_NEWS_SOURCES.find(row=>row.id===profile.id);
    const r=JSON.parse(await readFile(source.evidenceReport,'utf8'));
    assert.equal(r.status,'runtime_verified',source.id);
    assert.ok(r.sample.detail.articleEvidence,source.id);
    assert.ok(r.requests.every(x=>x.status===200&&x.sha256&&x.accessedAt),source.id);
    const title=xml(r.sample.title),url=xml(r.sample.source.url);
    const text=source.format==='rss'?`<rss version="2.0"><channel><item><title>${title}</title><link>${url}</link></item></channel></rss>`
      :source.format==='atom'?`<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>${title}</title><link href="${url}"/></entry></feed>`
      :`<html><main><div class="articles page-press--teaser"><article class="article"><h2 class="news-item"><a class="news-item event_card" rel="bookmark" href="${url}"><span class="news-item__title">${title}</span></a></h2><div class="news-item"><div class="news-description"><h3><a href="${url}">${title}</a></h3></div></div></article></div></main></html>`;
    const service=createNewsService({sources:[source],readReviewed:()=>[],fetchImpl:async()=>new Response(text,{headers:{'content-type':source.format==='html'?'text/html':'application/xml'}})});
    try{await service.refresh();assert.ok(service.getReviewQueue().some(x=>x.source.url===r.sample.source.url),source.id+' sample identity must survive parsing');}
    finally{service.close();}
  }
});
test('candidate JSON cannot grant runtime destinations and source network research rejects private addresses',()=>{
  assert.throws(()=>createNewsService({sources:[{...LITERARY_NEWS_SOURCES[0],url:'https://example.com/'}],readReviewed:()=>[]}),/approved code-owned registry/);
  for(const ip of ['127.0.0.1','10.2.3.4','172.31.4.2','192.168.1.2','169.254.169.254','100.64.0.1','198.18.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fe80::1','fd00::123'])assert.equal(safeAddress(ip),false,ip);
  for(const ip of ['1.1.1.1','8.8.8.8','192.0.78.13','192.0.66.2','2606:4700:4700::1111'])assert.equal(safeAddress(ip),true,ip);
  for(const ip of ['192.0.0.8','192.0.2.1','198.51.100.1','203.0.113.1','2001:db8::1'])assert.equal(safeAddress(ip),false,ip);
});
