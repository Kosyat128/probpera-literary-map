import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { buildPublishedNewsFeed } from "./lib/literary-news-publication.mjs";
import { pendingNewsSourceState } from "./lib/literary-news-state.mjs";
import { dispatchNewsJob, newsPostKey, newsSocialPayloadDigest, reconcileNewsSnapshot } from "./lib/literary-news-social.mjs";
import { createNewsSocialTransport } from "./lib/literary-news-social-transport.mjs";
import { normalizeNewsMedia, mediaByteHash } from "./lib/literary-news-media.mjs";
import sharp from "sharp";

const modulePath = process.argv.find((arg) => arg.startsWith("--pglite="))?.slice(9);
if (!modulePath) throw new Error("Provide the isolated PGlite module with --pglite=path; this checker never connects to a remote DB.");
const { PGlite } = await import(pathToFileURL(path.resolve(modulePath)).href);
const db = new PGlite();
const checks = [];
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.role() returns text language sql as
      'select current_setting(''request.jwt.claim.role'',true)';
    create table public.admin_audit_log(id bigint generated always as identity primary key,
      action text not null, entity_type text not null, entity_id text, metadata jsonb not null default '{}');
    grant usage on schema auth to authenticated, service_role;
    grant insert,select on public.admin_audit_log to authenticated;
    grant usage on sequence public.admin_audit_log_id_seq to authenticated;`);
  await db.exec(await readFile(new URL("../supabase/migrations/20260926_literary_news_runtime_cas.sql", import.meta.url), "utf8"));
  await db.exec("select set_config('request.jwt.claim.role','service_role',false)");
  const cas = async (expected, state, key = "post:news:test:telegram:-1001", guard = null) => (await db.query(
    "select public.compare_append_literary_news_runtime($1,$2,$3::jsonb,$4,$5) as result", [key, expected, JSON.stringify(state), guard?.key || null, guard?.id || null]
  )).rows[0].result;
  const first = await cas(null, { status: "pending" }); assert.equal(first.applied, true); checks.push("first durable append");
  const collision = await cas(null, { status: "inflight" }); assert.equal(collision.applied, false);
  assert.equal(collision.id, first.id); checks.push("stale expected ID rejected");
  const [left, right] = await Promise.all([cas(first.id, { status: "inflight", runner: "left" }), cas(first.id, { status: "inflight", runner: "right" })]);
  assert.equal([left, right].filter((row) => row.applied).length, 1); checks.push("two same-version claims only one applied");
  await assert.rejects(cas(null, {}, "articles:anything")); checks.push("namespace restriction");
  await assert.rejects(cas(null, { text: "x".repeat(262144) })); checks.push("state byte bound");
  const log = await db.query("select count(*)::int as n from public.admin_audit_log"); assert.equal(log.rows[0].n, 2); checks.push("conflicts append nothing");
  const controlKey = "destination:telegram:-1001";
  const control = await cas(null, {mode:"on",paused:false,historyReconciled:true}, controlKey);
  const jobKey = "post:news:guard-fixture:telegram:-1001";
  const job = {newsId:"guard-fixture",destination:{platform:"telegram",id:"-1001"},status:"inflight"};
  const claim = await cas(null, job, jobKey);
  const started = {...job,dispatchStartedAt:new Date().toISOString()};
  await assert.rejects(cas(claim.id, started, jobKey)); checks.push("dispatch without atomic destination guard rejected");
  const pause = await cas(control.id, {mode:"on",paused:true,historyReconciled:true}, controlKey);
  assert.equal((await cas(claim.id, started, jobKey, {key:controlKey,id:control.id})).applied,false);
  assert.equal((await cas(claim.id, started, jobKey, {key:controlKey,id:pause.id})).applied,false);
  checks.push("pause and stale control version prevent dispatch");
  await assert.rejects(cas(claim.id, {status:"inflight",dispatchStartedAt:started.dispatchStartedAt}, jobKey, {key:controlKey,id:pause.id}));
  checks.push("missing destination cannot bypass guard with SQL null");
  const resume = await cas(pause.id, {mode:"on",paused:false,historyReconciled:true}, controlKey);
  assert.equal((await cas(claim.id, started, jobKey, {key:controlKey,id:resume.id})).applied,true);
  checks.push("current enabled destination permits guarded dispatch");
  // Exercise the real JSONB representation, not a structuredClone memory substitute.
  {
    const current = new Date("2026-09-26T12:00:00Z");
    const destinations = [{platform:"telegram",id:"-10098765",mode:"on"},{platform:"vk",id:"-98765",mode:"on"}];
    const item = {id:"jsonb-delivery",eventKey:"jsonb-delivery",category:"releases",kind:"news",eventDate:"2026-09-25",
      publishedAt:null,verifiedAt:"2026-09-25T12:00:00Z",verification:"confirmed",
      title:{ru:"Проверенная книга",en:"A verified book"},summary:{ru:"Сообщение издательства.",en:"A publisher announcement."},
      source:{name:"Fixture publisher",url:"https://publisher.example/news/book",language:"en"}};
    const snapshot = (records=[],withdrawals=[]) => buildPublishedNewsFeed({records,withdrawals,current,
      timeZone:"Europe/Moscow",release:"a".repeat(40),state:pendingNewsSourceState([])});
    const store = {
      async read(key) {
        const row=(await db.query("select id,metadata as state from public.admin_audit_log where entity_type='literary_news_runtime' and entity_id=$1 order by id desc limit 1",[key])).rows[0];
        return row || {id:null,state:null};
      },
      compareAppend:(key,expected,state,guard)=>cas(expected,state,key,guard),
      async list(prefix) {
        // The primitive CAS rejection fixtures above intentionally lack complete
        // social-job shapes. Keep their rows intact while isolating this scenario
        // to its two destinations and its own durable admissions.
        return (await db.query("select distinct on(entity_id) id,metadata as state from public.admin_audit_log where entity_type='literary_news_runtime' and entity_id like $1 and (entity_id like '%:telegram:-10098765' or entity_id like '%:vk:-98765' or entity_id in ('admission:news:jsonb-delivery','admission:news:jsonb-photo')) order by entity_id,id desc",[prefix+"%"])).rows;
      },
    };
    await reconcileNewsSnapshot(store,await snapshot([item]),[],current);
    const restored=await reconcileNewsSnapshot(store,await snapshot(),destinations,current);
    assert.equal(restored.restoredMissingJobs,2); checks.push("JSONB admission reconstructs missing Telegram and VK jobs");
    let writes=0;
    for(const destination of destinations) {
      await store.compareAppend(`destination:${destination.platform}:${destination.id}`,null,{mode:"on",paused:false,historyReconciled:true});
      const key=newsPostKey(item.id,destination),prepared=(await store.read(key)).state.prepared;
      assert.equal(prepared.revision,(await store.read(key)).state.desiredRevision);
      assert.equal(await newsSocialPayloadDigest(prepared.payload),prepared.payloadSha256);
      const native=createNewsSocialTransport({mode:"live",telegramToken:"fixture",vkToken:"fixture",fetchImpl:async(url,options)=>{
        writes++;
        const sent=destination.platform==="telegram"?JSON.parse(options.body):Object.fromEntries(new URLSearchParams(options.body));
        for(const [field,value] of Object.entries(prepared.payload))
          assert.deepEqual(sent[field],destination.platform==="telegram"?value:String(value));
        return Response.json(destination.platform==="telegram"?{ok:true,result:{message_id:17,chat:{id:Number(destination.id)}}}:{response:{post_id:17}});
      }});
      const outcome=await dispatchNewsJob({store,key,now:()=>current,transport:{preflight:async()=>({ok:true,providerAccountId:"42"}),send:native.send}});
      assert.equal(outcome.status,"sent_current"); checks.push(`JSONB ${destination.platform} payload hash and exact native send survive reload`);
    }
    assert.equal(writes,2);
    const withdrawal={id:item.id,withdrawnAt:current.toISOString(),reason:"Editorial source correction"};
    const withdrawnFeed=await snapshot([],[withdrawal]);
    await reconcileNewsSnapshot(store,withdrawnFeed,destinations,current);
    for(const destination of destinations) {
      const key=newsPostKey(item.id,destination);
      const result=await dispatchNewsJob({store,key,now:()=>current,transport:{preflight:async()=>({ok:true,providerAccountId:"42"}),send:async({remoteId,prepared})=>{
        assert.equal(remoteId,"17");assert.equal(prepared.profile,"literary-news-withdrawal-v1");
        return {kind:"accepted",remoteId:"17"};
      }}});
      assert.equal(result.status,"explicitly_closed");
    }
    const before=await Promise.all(destinations.map(d=>store.read(newsPostKey(item.id,d))));
    await reconcileNewsSnapshot(store,withdrawnFeed,destinations,current);
    const after=await Promise.all(destinations.map(d=>store.read(newsPostKey(item.id,d))));
    assert.deepEqual(after,before);checks.push("JSONB withdrawal reload remains closed without duplicate correction jobs");
    // Images remain outside JSONB. Reloaded refs, permissions and the exact
    // caption/native attachment survive PostgreSQL key ordering, then edit one ID.
    const source=await sharp({create:{width:320,height:400,channels:3,background:"#887766"}}).png().toBuffer();
    const normalized=await normalizeNewsMedia(source,"image/png"),mediaItem={...item,id:"jsonb-photo",eventKey:"jsonb-photo"};
    const asset={id:"jsonb-photo",status:"approved",newsIds:[mediaItem.id],sourceUrl:"https://publisher.example/fixture.png",sourceSha256:mediaByteHash(source),subject:"book",
      entityEvidence:"Isolated synthetic SQL test; no remote publication",author:"Test",rightsholder:"Test",credit:"Synthetic SQL test",
      license:"owned",licenseEvidenceUrl:"https://publisher.example/fixture-license",licenseEvidenceSha256:"a".repeat(64),checkMethod:"ownership-record",
      checkedAt:current.toISOString(),validUntil:"2026-10-20T00:00:00Z",transformations:{resize:true,reencode:true,metadataRemoval:true,crop:false},
      permissions:destinations.map(d=>({platform:d.platform,destinationId:d.id,publish:true,providerProcessing:true,evidenceUrl:"https://publisher.example/fixture-license"})),derivative:normalized.descriptor};
    const mediaOptions={registry:{assets:[asset],downloadHosts:[]},now:current,readBytes:async()=>normalized.bytes};
    await reconcileNewsSnapshot(store,await snapshot([mediaItem]),destinations,current,{mediaOptions});
    for(const destination of destinations){
      const key=newsPostKey(mediaItem.id,destination),calls=[];
      const transport=createNewsSocialTransport({mode:"live",telegramToken:"fixture",vkToken:"fixture",mediaOptions,
        uploadImpl:async()=>Response.json({server:1,photo:"fixture",hash:"fixture-hash"}),fetchImpl:async(url,options)=>{
          const method=url.split("/").at(-1);calls.push(method);
          if(method==="photos.getWallUploadServer")return Response.json({response:{upload_url:"https://pu.vk.com/upload.php"}});
          if(method==="photos.saveWallPhoto")return Response.json({response:[{owner_id:Number(destination.id),id:19}]});
          const prepared=(await store.read(key)).state.prepared;
          assert.equal(await newsSocialPayloadDigest(prepared.payload),prepared.payloadSha256);
          if(destination.platform==="telegram"){
            if(options.body instanceof FormData){
              assert.deepEqual(Buffer.from(await options.body.get("news_photo").arrayBuffer()),normalized.bytes);
              const caption=options.body.get("caption")||JSON.parse(options.body.get("media")).caption;assert.equal(caption,prepared.payload.caption);
            }else{const reused=JSON.parse(options.body);assert.equal(reused.media.media,"fixture-photo");assert.equal(reused.media.caption,prepared.payload.caption);}
            return Response.json({ok:true,result:{message_id:27,chat:{id:Number(destination.id)},photo:[{file_id:"fixture-photo"}]}});
          }
          const sent=Object.fromEntries(new URLSearchParams(options.body));assert.equal(sent.attachments,`photo${destination.id}_19`);assert.equal(sent.message,prepared.payload.message);
          return Response.json({response:{post_id:27}});
        }});
      const runtimeTransport={...transport,preflight:async()=>({ok:true,providerAccountId:"42"})};
      assert.equal((await dispatchNewsJob({store,key,transport:runtimeTransport,now:()=>current})).reason,"destination_pacing");
      assert.equal(calls.filter(method=>["sendPhoto","wall.post"].includes(method)).length,0);
      const nextSlot=new Date(current.getTime()+3600000);
      assert.equal((await dispatchNewsJob({store,key,transport:runtimeTransport,now:()=>nextSlot})).status,"sent_current");
      checks.push(`JSONB ${destination.platform} durable pacing blocks a second create until the reserved slot`);
      assert.equal((await store.read(key)).state.remoteMediaKind,"photo");
      assert.equal((await store.read(key)).state.mediaCache.providerAccountId,"42");
      assert.equal((await store.read(key)).state.mediaCache.sha256,normalized.descriptor.sha256);
      asset.credit="Corrected synthetic SQL credit";
      await reconcileNewsSnapshot(store,await snapshot([mediaItem]),[destination],current,{mediaOptions});
      assert.equal((await dispatchNewsJob({store,key,transport:runtimeTransport,now:()=>nextSlot})).status,"sent_current");
      assert.equal((await store.read(key)).state.remoteId,"27");
      assert.equal(calls.filter(method=>["sendPhoto","wall.post"].includes(method)).length,1);
      assert.equal(calls.filter(method=>["editMessageMedia","wall.edit"].includes(method)).length,1);
      if(destination.platform==="vk")assert.equal(calls.filter(method=>method==="photos.saveWallPhoto").length,1);
      checks.push(`JSONB ${destination.platform} exact media and scoped uploaded resource reuse create once then edit same remote ID`);
      asset.credit="Synthetic SQL test";
    }
  }
  await db.exec("set role authenticated; select set_config('request.jwt.claim.role','authenticated',false)");
  await assert.rejects(cas(null, { status: "sent_current" })); checks.push("authenticated cannot call service CAS");
  await assert.rejects(db.exec("insert into public.admin_audit_log(action,entity_type,entity_id,metadata) values('forged','literary_news_runtime','destination:telegram:-1001','{}')"));
  checks.push("direct staff runtime forgery rejected");
  await db.exec("insert into public.admin_audit_log(action,entity_type,entity_id,metadata) values('existing-editorial-action','article','fixture','{}')");
  checks.push("existing non-news audit writes preserved");
  const receipt = { checkedAt: new Date().toISOString(), engine: "PGlite 0.3.10 isolated PostgreSQL WASM", remoteDatabase: false,
    realConcurrentProcesses: false, checks, passed: checks.length, deployment: "not_applied" };
  await mkdir(new URL("../reports/r10/social/", import.meta.url), { recursive: true });
  await writeFile(new URL("../reports/r10/social/sql-check.json", import.meta.url), JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
} finally { await db.close(); }
