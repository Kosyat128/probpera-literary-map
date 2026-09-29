import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { resolveNewsMediaBatch } from "./literary-news-media-discovery.mjs";
import { prepareNewsPost, dispatchNewsJob } from "./literary-news-social.mjs";
import { readNewsMediaBytes, selectNewsMedia, validatePreparedNewsMedia } from "./literary-news-media.mjs";
import newsLimits from "../../data/news/contract.json" with {type:"json"};
const now=new Date("2026-09-27T05:00:00Z"),destination={platform:"telegram",id:"-100123",mode:"off"};
const item={id:"virginia-news",category:"anniversaries",kind:"news",eventDate:"2026-09-26",verification:"confirmed",
  title:{ru:"Вирджиния Вулф: документальная публикация",en:"Virginia Woolf: a documented publication"},
  summary:{ru:"Опубликовано сообщение об архиве писательницы.",en:"A statement about the writer’s archive was published."},
  source:{name:"Archive",url:"https://archive.example/virginia-woolf"}};
const registry={assets:[],downloadHosts:[]},subject={qid:"Q40909",name:"Virginia Woolf",matchedField:"title.en",evidence:{method:"exact-reviewed-writer-name"}};
function storeFixture(){const rows=new Map();let sequence=0;return{rows,async list(){return [...rows.values()];},
  async compareAppend(key,expected,state){const previous=rows.get(key);if((previous?.id||null)!==expected)return{applied:false};const row={id:++sequence,state};rows.set(key,row);return{applied:true,...row};}};}
async function fixture(overrides={},fileName="Fixture.png"){
  const bytes=await sharp({create:{width:480,height:640,channels:3,background:"#a29285"}}).png().toBuffer();
  const metadata={Artist:{value:"<a>Fixture Author</a>"},LicenseShortName:{value:"CC BY 4.0"},
    LicenseUrl:{value:"https://creativecommons.org/licenses/by/4.0/"},UsageTerms:{value:"Creative Commons Attribution 4.0"},Copyrighted:{value:"True"},...overrides};
  const info={url:"https://upload.wikimedia.org/wikipedia/commons/a/ab/Fixture.png",mime:"image/png",size:bytes.length,
    sha1:createHash("sha1").update(bytes).digest("hex"),extmetadata:metadata};
  const fetchImpl=vi.fn(async(input,options)=>{expect(options.redirect).toBe("error");const url=new URL(input);
    if(url.hostname==="www.wikidata.org")return Response.json({entities:{Q40909:{id:"Q40909",claims:{
      P31:[{mainsnak:{datavalue:{value:{id:"Q5"}}}}],P18:[{rank:"normal",mainsnak:{snaktype:"value",datavalue:{value:fileName}}}]}}}});
    if(url.hostname==="commons.wikimedia.org")return Response.json({query:{pages:[{pageid:123,title:`File:${fileName}`,imageinfo:[info]}]}});
    if(url.hostname==="upload.wikimedia.org")return new Response(bytes,{headers:{"content-type":"image/png"}});
    throw Error("unexpected URL");});
  return{bytes,info,fetchImpl,options:{registry,now,fetchImpl,matchSubjects:()=>[subject],searchCandidates:()=>[]}};
}
describe("bounded actual-portrait discovery, no provider uploads",()=>{
  it('checks a newly available exact source photo before an already cached and manually supplied portrait',async()=>{
    const f=await fixture(),store=storeFixture();
    const portrait=await resolveNewsMediaBatch([item],[destination],{...f.options,store});
    const sourceUrl='https://upload.wikimedia.org/wikipedia/commons/a/ab/Associated_event.png';
    const photoItem={...item,thumbnail:{url:sourceUrl,sourceUrl:item.source.url,alt:item.title,displayOnly:true}};
    const matchSubjects=vi.fn(()=>[subject]);
    const fetchImpl=vi.fn(async(url,options)=>{
      const parsed=new URL(url);
      if(parsed.hostname==='commons.wikimedia.org'&&parsed.searchParams.get('titles')==='File:Associated_event.png')
        return Response.json({query:{pages:[{pageid:124,title:'File:Associated_event.png',imageinfo:[{...f.info,url:sourceUrl}]}]}});
      if(url===sourceUrl)return new Response(f.bytes,{headers:{'content-type':'image/png'}});
      return f.fetchImpl(url,options);
    });
    const actual=await resolveNewsMediaBatch([photoItem],[destination],{...f.options,store,fetchImpl,matchSubjects,
      registry:portrait.mediaOptions.registry});
    expect(actual.report.approved).toBe(1);expect(actual.report.cached).toBe(0);expect(actual.report.requests).toBe(2);
    expect(matchSubjects).not.toHaveBeenCalled();
    expect(actual.mediaOptions.registry.assets[0]).toMatchObject({mediaRole:'source-image',sourceUrl});
    const selected=await selectNewsMedia(item.id,destination,actual.mediaOptions);
    expect(selected.media.assetId).toBe(actual.mediaOptions.registry.assets[0].id);
    expect([...store.rows.values()][0].state.asset.mediaRole).toBe('source-image');
  });
  it('keeps a licensed exact writer portrait when the associated source photo has unsupported rights',async()=>{
    const f=await fixture(),sourceUrl='https://upload.wikimedia.org/wikipedia/commons/a/ab/Associated_event.png';
    const photoItem={...item,thumbnail:{url:sourceUrl,sourceUrl:item.source.url,alt:item.title,displayOnly:true}};
    const fetchImpl=vi.fn(async(url,options)=>{
      const parsed=new URL(url);
      if(parsed.hostname==='commons.wikimedia.org'&&parsed.searchParams.get('titles')==='File:Associated_event.png')
        return Response.json({query:{pages:[{pageid:124,title:'File:Associated_event.png',imageinfo:[{...f.info,url:sourceUrl,
          extmetadata:{...f.info.extmetadata,LicenseShortName:{value:'All rights reserved'}}}]}]}});
      return f.fetchImpl(url,options);
    });
    const result=await resolveNewsMediaBatch([photoItem],[destination],{...f.options,fetchImpl});
    expect(result.report.approved).toBe(1);expect(result.report.requests).toBe(4);
    expect(result.mediaOptions.registry.assets[0].subject).toBe('portrait');
    expect(result.report.outcomes[0].sourceImage).toEqual({status:'held',reason:'media_discovery_license_unsupported'});
    expect(fetchImpl.mock.calls.some(([url])=>url===sourceUrl)).toBe(false);
  });
  it('retries a transiently unavailable source photo after one hour while keeping the approved portrait available',async()=>{
    const f=await fixture(),store=storeFixture(),sourceUrl='https://upload.wikimedia.org/wikipedia/commons/a/ab/Associated_event.png';
    const photoItem={...item,thumbnail:{url:sourceUrl,sourceUrl:item.source.url,alt:item.title,displayOnly:true}};
    let sourceAvailable=false;
    const fetchImpl=vi.fn(async(url,options)=>{
      if(new URL(url).hostname==='commons.wikimedia.org'&&new URL(url).searchParams.get('titles')==='File:Associated_event.png'){
        if(!sourceAvailable)throw Error('temporarily unavailable');
        return Response.json({query:{pages:[{pageid:124,title:'File:Associated_event.png',imageinfo:[{...f.info,url:sourceUrl}]}]}});
      }
      if(url===sourceUrl)return new Response(f.bytes,{headers:{'content-type':'image/png'}});
      return f.fetchImpl(url,options);
    });
    const first=await resolveNewsMediaBatch([photoItem],[destination],{...f.options,store,fetchImpl});
    expect(first.report.approved).toBe(1);expect(first.mediaOptions.registry.assets[0].subject).toBe('portrait');
    expect([...store.rows.values()][0].state.nextCheckAt).toBe(new Date(now.getTime()+3600000).toISOString());
    sourceAvailable=true;fetchImpl.mockClear();
    const early=await resolveNewsMediaBatch([photoItem],[destination],{...f.options,store,fetchImpl,now:new Date(now.getTime()+1800000)});
    expect(early.report.cached).toBe(1);expect(early.report.requests).toBe(0);expect(fetchImpl).not.toHaveBeenCalled();
    const recovered=await resolveNewsMediaBatch([photoItem],[destination],{...f.options,store,fetchImpl,now:new Date(now.getTime()+3600001)});
    expect(recovered.report.approved).toBe(1);expect(recovered.report.requests).toBe(2);
    expect(recovered.mediaOptions.registry.assets[0].mediaRole).toBe('source-image');
  });
  it('shares the existing 24-request budget between source images and portrait fallback',async()=>{
    const f=await fixture(),sourceUrl='https://upload.wikimedia.org/wikipedia/commons/a/ab/Associated_event.png';
    const rows=Array.from({length:8},(_,index)=>({...item,id:`source-budget-${index}`,
      thumbnail:{url:sourceUrl,sourceUrl:item.source.url,alt:item.title,displayOnly:true}}));
    const fetchImpl=vi.fn(async(url,options)=>{
      if(new URL(url).hostname==='commons.wikimedia.org'&&new URL(url).searchParams.get('titles')==='File:Associated_event.png')
        return Response.json({query:{pages:[{title:'File:Associated_event.png',imageinfo:[{...f.info,url:sourceUrl,
          extmetadata:{...f.info.extmetadata,LicenseShortName:{value:'All rights reserved'}}}]}]}});
      return f.fetchImpl(url,options);
    });
    const result=await resolveNewsMediaBatch(rows,[destination],{...f.options,fetchImpl});
    expect(result.report.requests).toBe(24);expect(fetchImpl).toHaveBeenCalledTimes(24);
    expect(result.report.approved).toBe(6);expect(result.report.pending).toBe(2);
    expect(result.report.outcomes.at(-1).reason).toBe('media_discovery_request_budget');
  });
  it('retains a preverified manual portrait when the final source-photo download would exceed the shared request budget',async()=>{
    const f=await fixture(),sourceUrl='https://upload.wikimedia.org/wikipedia/commons/a/ab/Associated_event.png';
    const manual=(await resolveNewsMediaBatch([item],[destination],f.options)).mediaOptions.registry.assets[0];
    const rows=Array.from({length:7},(_,index)=>({...item,id:`manual-budget-${index}`,
      ...(index!==5?{thumbnail:{url:sourceUrl,sourceUrl:item.source.url,alt:item.title,displayOnly:true}}:{})}));
    manual.newsIds=[rows.at(-1).id];let sourceMetadataCount=0;
    const fetchImpl=vi.fn(async(url,options)=>{
      if(new URL(url).hostname==='commons.wikimedia.org'&&new URL(url).searchParams.get('titles')==='File:Associated_event.png'){
        sourceMetadataCount++;
        return Response.json({query:{pages:[{pageid:124,title:'File:Associated_event.png',imageinfo:[{...f.info,url:sourceUrl,
          extmetadata:sourceMetadataCount<6?{...f.info.extmetadata,LicenseShortName:{value:'All rights reserved'}}:f.info.extmetadata}]}]}});
      }
      if(url===sourceUrl)throw Error('must not spend a 25th request');
      return f.fetchImpl(url,options);
    });
    const store=storeFixture();
    const result=await resolveNewsMediaBatch(rows,[destination],{...f.options,store,fetchImpl,registry:{assets:[manual],downloadHosts:['upload.wikimedia.org']}});
    expect(result.report.requests).toBe(24);expect(fetchImpl).toHaveBeenCalledTimes(24);
    expect(result.report.approved).toBe(7);expect(result.report.pending).toBe(0);
    expect(result.mediaOptions.resolutions[rows.at(-1).id]).toMatchObject({status:'approved',reason:'manual_registry',
      sourceImage:{status:'pending',reason:'media_discovery_request_budget'}});
    const state=[...store.rows.values()].find(row=>row.state.newsId===rows.at(-1).id).state;
    expect(state.asset.id).toBe(manual.id);expect(state.nextCheckAt).toBe(new Date(now.getTime()+3600000).toISOString());
    const prepared=await prepareNewsPost(rows.at(-1),{id:'snapshot',release:'a'.repeat(40)},'telegram',{destination,mediaOptions:result.mediaOptions});
    expect(prepared.media.assetId).toBe(manual.id);expect(prepared.profile).toBe('literary-news-photo-v1');
    expect(fetchImpl.mock.calls.some(([url])=>url===sourceUrl)).toBe(false);
  });
  it("preserves the complete one-year feed above the former 5000-item boundary without unbounded photo discovery",async()=>{
    const rows=Array.from({length:5490},(_,index)=>({...item,id:`annual-${index}`}));
    const fetchImpl=vi.fn();
    const result=await resolveNewsMediaBatch(rows,[destination],{registry,now,fetchImpl,maxNews:0});
    expect(Object.keys(result.mediaOptions.resolutions)).toHaveLength(rows.length);
    expect(result.report.inspected).toBe(0);expect(fetchImpl).not.toHaveBeenCalled();
    await expect(resolveNewsMediaBatch(Array.from({length:newsLimits.maxItems+1},()=>item),[destination],{registry,now,maxNews:0}))
      .rejects.toThrow('media_discovery_input_invalid');
  });
  it("keeps all dynamic Commons filename delimiters encoded after the literal File namespace",async()=>{
    const fileName="Portrait:series:100% /Русский?#.png",f=await fixture({},fileName);
    const result=await resolveNewsMediaBatch([item],[destination],f.options);
    expect(result.report.approved).toBe(1);
    const evidence=result.mediaOptions.registry.assets[0].licenseEvidenceUrl,url=new URL(evidence);
    expect(evidence).toBe("https://commons.wikimedia.org/wiki/File:Portrait%3Aseries%3A100%25%20%2F%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9%3F%23.png");
    expect(url.search).toBe("");expect(url.hash).toBe("");
    expect(decodeURIComponent(url.pathname.slice("/wiki/File:".length))).toBe(fileName);
    expect(result.mediaOptions.registry.assets[0].permissions[0].evidenceUrl).toBe(evidence);
  });
  it("pins one exact human/P18/Commons license and bytes, persists metadata, and replays without a network request",async()=>{
    const f=await fixture(),store=storeFixture();
    const result=await resolveNewsMediaBatch([item],[destination],{...f.options,store});
    expect(result.report.approved).toBe(1);expect(result.report.requests).toBe(3);expect(store.rows.size).toBe(1);
    const asset=result.mediaOptions.registry.assets[0];expect(asset.subject).toBe("portrait");expect(asset.newsIds).toEqual([item.id]);
    expect(await readNewsMediaBytes(asset.derivative)).toBeInstanceOf(Buffer);
    const p=await prepareNewsPost(item,{id:"test",release:"a".repeat(40)},"telegram",{destination,mediaOptions:result.mediaOptions});
    expect(p.media).not.toBeNull();expect(p.payload.caption).toContain("Fixture Author");await validatePreparedNewsMedia(p,destination,result.mediaOptions);
    const replay=await resolveNewsMediaBatch([item],[destination],{...f.options,store,fetchImpl:vi.fn(()=>{throw Error("must not fetch");})});
    expect(replay.report.cached).toBe(1);expect(replay.report.requests).toBe(0);
    const changed=await resolveNewsMediaBatch([{...item,title:{...item.title,ru:item.title.ru+" - уточнение"}}],[destination],{...f.options,store,maxNews:0});
    expect(changed.mediaOptions.resolutions[item.id].status).toBe("pending");expect(changed.mediaOptions.registry.assets).toHaveLength(0);
  });
  it.each(["CC BY-SA 1.0","CC BY-NC 4.0","CC BY-ND 4.0"])("holds unsupported %s without downloading the image",async license=>{
    const f=await fixture({LicenseShortName:{value:license}}),r=await resolveNewsMediaBatch([item],[destination],f.options);
    expect(r.report.held).toBe(1);expect(r.report.requests).toBe(2);expect(r.mediaOptions.registry.assets).toHaveLength(0);
  });
  it('admits exact CC BY-SA 4.0 with same-license derivative and full visible attribution',async()=>{
    const f=await fixture({LicenseShortName:{value:'CC BY-SA 4.0'},LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},
      UsageTerms:{value:'Creative Commons Attribution-Share Alike 4.0'},ObjectName:{value:'Virginia Woolf portrait'}});
    const result=await resolveNewsMediaBatch([item],[destination],f.options),asset=result.mediaOptions.registry.assets[0];
    expect(result.report.approved).toBe(1);
    expect(asset).toMatchObject({license:'CC-BY-SA-4.0',derivativeLicense:'CC-BY-SA-4.0',additionalRestrictions:false,
      materialTitle:'Virginia Woolf portrait',materialUrl:'https://commons.wikimedia.org/?curid=123'});
    const p=await prepareNewsPost(item,{id:'test',release:'a'.repeat(40)},'telegram',{destination,mediaOptions:result.mediaOptions});
    expect(p.media).not.toBeNull();expect(p.payload.caption).toContain('Fixture Author');
    expect(p.payload.caption).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(p.payload.caption).toContain('дополнительных ограничений нет');
    await validatePreparedNewsMedia(p,destination,result.mediaOptions);
    delete asset.derivativeLicense;
    await expect(validatePreparedNewsMedia(p,destination,result.mediaOptions)).rejects.toThrow('media_sharealike_terms_missing');
  });
  it("rejects a cross-host image URL and metadata/image hash drift",async()=>{
    for(const bad of ["host","hash"]){const f=await fixture();if(bad==="host")f.info.url="https://private.example/photo.png";else f.info.sha1="0".repeat(40);
      const r=await resolveNewsMediaBatch([item],[destination],f.options);expect(r.report.held).toBe(1);expect(r.report.approved).toBe(0);
      expect(r.report.requests).toBe(bad==="host"?2:3);}
  });
  it("keeps unmatched/ambiguous identities negative-cached and rolls the bounded budget beyond the first eight",async()=>{
    const store=storeFixture(),fetchImpl=vi.fn(),rows=Array.from({length:12},(_,i)=>({...item,id:`news-${i}`}));
    const options={registry,now,store,fetchImpl,matchSubjects:()=>[],searchCandidates:()=>[]};
    const first=await resolveNewsMediaBatch(rows,[destination],options);expect(first.report.inspected).toBe(8);expect(first.report.pending).toBe(4);
    const second=await resolveNewsMediaBatch(rows,[destination],options);expect(second.report.cached).toBe(8);expect(second.report.inspected).toBe(4);
    expect(fetchImpl).not.toHaveBeenCalled();expect(store.rows.size).toBe(12);
    const ambiguous=await resolveNewsMediaBatch([item],[destination],{...options,store:null,matchSubjects:()=>[subject,{...subject,qid:"Q1"}]});
    expect(ambiguous.report.outcomes[0].reason).toBe("media_subject_ambiguous");
  });
  it("does not discard approved photo metadata, and pending search never blocks a text post",async()=>{
    const f=await fixture(),r=await resolveNewsMediaBatch([item],[destination],f.options);
    const missing=async()=>{throw Error("no JPEG on this runner");};
    expect((await selectNewsMedia(item.id,destination,{...r.mediaOptions,readBytes:missing})).media).not.toBeNull();
    const pending=await resolveNewsMediaBatch([item],[destination],{...f.options,maxNews:0});
    const p=await prepareNewsPost(item,{id:"s",release:"a".repeat(40)},"telegram",{destination,mediaOptions:pending.mediaOptions});
    expect(p.mediaPending).toBe(true);
    const key=`post:news:${item.id}:telegram:${destination.id}`,controlKey=`destination:telegram:${destination.id}`;
    const rows=new Map([[key,{id:1,state:{key,newsId:item.id,destination:{platform:"telegram",id:destination.id},
      prepared:p,desiredRevision:p.revision,status:"pending"}}],
      [controlKey,{id:2,state:{mode:"on",paused:false,historyReconciled:true}}]]);let sequence=2;
    const store={
      read:async name=>structuredClone(rows.get(name)||{id:null,state:null}),
      compareAppend:async(name,expected,state,guard=null)=>{
        const previous=rows.get(name)||{id:null,state:null};
        if(previous.id!==expected)return{applied:false,...structuredClone(previous)};
        if(guard&&rows.get(guard.key)?.id!==guard.id)return{applied:false};
        const row={id:++sequence,state:structuredClone(state)};rows.set(name,row);return{applied:true,...structuredClone(row)};
      },
    };
    const send=vi.fn(async()=>({kind:"accepted",remoteId:"17",remoteUrl:"https://t.me/c/100123/17"}));
    expect(await dispatchNewsJob({key,store,transport:{preflight:async()=>({ok:true}),send},now:()=>now}))
      .toMatchObject({status:"sent_current",remoteId:"17",dispatchAttempted:true});
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("manual exact-rights registry has priority and a cache CAS race stays pending",async()=>{
    const f=await fixture(),r=await resolveNewsMediaBatch([item],[destination],f.options);
    const fetchImpl=vi.fn();const manual=await resolveNewsMediaBatch([item],[destination],{...f.options,registry:r.mediaOptions.registry,fetchImpl});
    expect(manual.mediaOptions.resolutions[item.id].reason).toBe("manual_registry");expect(fetchImpl).not.toHaveBeenCalled();
    const conflict=await resolveNewsMediaBatch([item],[destination],{...f.options,store:{list:async()=>[],compareAppend:async()=>({applied:false})}});
    expect(conflict.mediaOptions.registry.assets).toHaveLength(0);expect(conflict.mediaOptions.resolutions[item.id].status).toBe("pending");
  });
  it("fresh lookup requires an exact full label plus human and literary occupation; homonyms stay held",async()=>{
    for(const kind of ["writer","nonliterary","homonyms"]){
      const f=await fixture(),base=f.fetchImpl;
      const fetchImpl=vi.fn(async(url,options)=>{const u=new URL(url);
        if(u.searchParams.get("action")==="wbsearchentities")return Response.json({search:[{id:"Q40909",label:"Virginia Woolf"}]});
        if(u.searchParams.get("props")==="claims|labels|aliases"){
          const response=await base(url,options),body=await response.json(),e=body.entities.Q40909;
          e.labels={en:{value:"Virginia Woolf"}};e.claims.P106=[{mainsnak:{datavalue:{value:{id:kind==="nonliterary"?"Q1":"Q36180"}}}}];
          return Response.json(body);
        }
        return base(url,options);
      });
      const guarded=kind==="homonyms"?async(url,options)=>new URL(url).searchParams.get("action")==="wbsearchentities"
        ?Response.json({search:[{id:"Q40909",label:"Virginia Woolf"}],"search-continue":5}):fetchImpl(url,options):fetchImpl;
      const r=await resolveNewsMediaBatch([item],[destination],{...f.options,fetchImpl:guarded,matchSubjects:()=>[],
        searchCandidates:()=>[{query:"Virginia Woolf",matchedField:"title.en"}]});
      expect(r.report.approved).toBe(kind==="writer"?1:0);expect(r.report.held).toBe(kind==="writer"?0:1);
      if(kind==="writer")expect(r.report.requests).toBe(4);
    }
  });
  it("never-checked identities progress despite an hour of transient failures at the start of a large feed",async()=>{
    const store=storeFixture(),rows=Array.from({length:60},(_,i)=>({...item,id:`retry-${i}`})),seen=new Set();
    for(let tick=0;tick<18;tick++){
      const result=await resolveNewsMediaBatch(rows,[destination],{registry,store,now:new Date(now.getTime()+tick*600000),
        matchSubjects:row=>{seen.add(row.id);return[subject];},searchCandidates:()=>[],fetchImpl:async()=>{throw Error("temporary offline");}});
      expect(result.report.inspected).toBeLessThanOrEqual(8);
    }
    expect(seen.size).toBe(60);
  });
  it("a known name cannot hide another headline person or replace the headline speaker with a secondary summary portrait",async()=>{
    const f=await fixture();
    const result=await resolveNewsMediaBatch([item],[destination],{...f.options,
      searchCandidates:()=>[{query:"Virginia Woolf",matchedField:"title.en"},{query:"Another Writer",matchedField:"title.en"}]});
    expect(result.report.approved).toBe(0);expect(result.report.outcomes[0].reason).toBe("media_subject_ambiguous");
    expect(result.report.requests).toBe(1);
  });
});
