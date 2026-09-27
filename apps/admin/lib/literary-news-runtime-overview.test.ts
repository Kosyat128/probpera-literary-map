import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loadLiteraryNewsRuntimeOverview, readLatestNewsRuntime, summarizeNewsRuntime } from "./literary-news-runtime-overview";
const rev = "a".repeat(64);
const job = (newsId: string, extra = {}) => ({ newsId, destination: { platform: "telegram", id: "-10012345" }, status: "pending", originalAdmission: "2026-09-20T12:00:00Z", desiredRevision: rev, prepared: { payload: { text: "Точный заголовок\n\nПолный подготовленный текст." } }, ...extra });
const row = (id: number, entity_id: string, metadata: unknown) => ({ id, entity_id, metadata });
const fetchRows = (rows: ReturnType<typeof row>[]) => async (cursor: string | null, limit: number) => ({ data: rows.filter(item => cursor === null || BigInt(item.id) < BigInt(cursor)).sort((a,b) => b.id-a.id).slice(0,limit), error: null });

describe("read-only literary news runtime overview", () => {
  it("reads older durable jobs beyond the first page and uses latest state per key", async () => {
    const rows = [row(8,"post:news:a:telegram:-10012345",job("a",{status:"sent_current",remoteId:"8",acknowledgedRevision:rev,acknowledgedAt:"2026-09-26T12:00:00Z",remoteUrl:"https://t.me/c/12345/8"})),row(7,"post:news:a:telegram:-10012345",job("a")),row(6,"heartbeat:scheduler",{finishedAt:"2026-09-26T13:00:00Z",mode:"--send",deliveredThisRun:999}),row(3,"destination:telegram:-10012345",{mode:"on",paused:false,historyReconciled:true}),row(1,"post:news:old:telegram:-10012345",job("old",{originalAdmission:"2026-01-01T00:00:00Z"}))];
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows(rows),{pageSize:2}));
    expect(result.complete).toBe(true); expect(result.posts).toHaveLength(2); expect(result.destinations[0].counts).toMatchObject({pending:1,sent_current:1});
    expect(result.lastSchedulerAt).toBe("2026-09-26T13:00:00Z"); expect(result.lastDeliveryAt).toBe("2026-09-26T12:00:00Z");
    expect(result.destinations[0].oldestBacklogAt).toBe("2026-01-01T00:00:00Z"); expect(result.posts[1].preparedText).toBe(job("a").prepared.payload.text);
  });
  it("keyset pagination does not skip old rows when new activity is appended", async () => {
    const rows=[row(4,"post:news:a:telegram:-10012345",job("a")),row(3,"post:news:b:telegram:-10012345",job("b")),row(2,"post:news:c:telegram:-10012345",job("c")),row(1,"post:news:d:telegram:-10012345",job("d"))];
    const cursors:(string|null)[]=[];
    const read=await readLatestNewsRuntime(async(cursor,limit)=>{cursors.push(cursor);if(cursor!==null)rows.push(row(100,"post:news:new:telegram:-10012345",job("new")));return fetchRows(rows)(cursor,limit);},{pageSize:2});
    expect(cursors).toEqual([null,"3","1"]);expect(read.rows.map(item=>item.state.newsId)).toEqual(["a","b","c","d"]);expect(read.complete).toBe(true);
  });
  it("labels row and byte caps incomplete without inventing destination controls",async()=>{
    const rows=[row(3,"post:news:a:telegram:-10012345",job("a")),row(2,"post:news:b:telegram:-10012345",job("b")),row(1,"destination:telegram:-10012345",{mode:"on",paused:false})];
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows(rows),{maxRows:2}));
    expect(result.complete).toBe(false);expect(result.posts).toHaveLength(2);expect(result.destinations[0]).toMatchObject({mode:"unknown",paused:null,historyReconciled:false});
    expect((await readLatestNewsRuntime(fetchRows(rows),{maxBytes:10})).complete).toBe(false);
  });
  it("does not turn heartbeat counters or unproven state labels into delivery",async()=>{
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows([row(2,"heartbeat:scheduler",{finishedAt:"2026-09-26T13:00:00Z",deliveredThisRun:100}),row(1,"post:news:a:telegram:-10012345",job("a",{status:"sent_current"}))])));
    expect(result.lastDeliveryAt).toBeNull();expect(result.posts[0].status).toBe("unknown");expect(result.destinations[0].counts.sent_current).toBe(0);
  });
  it("projects only public fields, preserves exact text and rejects hostile remote URLs",async()=>{
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows([row(1,"post:news:a:telegram:-10012345",job("a",{remoteId:"8",remoteUrl:"https://t.me/c/12345/8?token=SECRET_TOKEN",lastError:"https://api.telegram.org/botSECRET_TOKEN/",token:"SECRET_TOKEN",providerResponse:{token:"SECRET_TOKEN"}}))])));
    expect(result.posts[0].remoteUrl).toBeNull();expect(result.posts[0].error).toBeNull();expect(result.posts[0].preparedText).toBe(job("a").prepared.payload.text);expect(JSON.stringify(result)).not.toContain("SECRET_TOKEN");
  });
  it("retains partial readable history on errors and distinguishes missing configuration",async()=>{
    const read=await readLatestNewsRuntime(async(cursor)=>cursor?{data:null,error:{message:"private secret"}}:{data:[row(1,"post:news:a:telegram:-10012345",job("a"))],error:null},{pageSize:1});
    expect(summarizeNewsRuntime(read)).toMatchObject({readError:true,complete:false,hasRuntime:true});
    expect(await loadLiteraryNewsRuntimeOverview(null)).toMatchObject({configured:false,hasRuntime:false,complete:false});
  });
  it("preserves the actual photo caption and projects destination-bound media evidence",async()=>{
    const caption="Точный заголовок\n\nПодпись и credit: автор, CC0.";
    const media={destination:{platform:"telegram",id:"-10012345"},credit:"Автор, CC0",license:"CC0",sha256:rev,mime:"image/jpeg",width:1200,height:800,
      checkedAt:"2026-09-26T12:00:00Z",validUntil:"2026-10-01T12:00:00Z",sourceUrl:"https://upload.wikimedia.org/example.jpg",licenseEvidenceUrl:"https://commons.wikimedia.org/wiki/File:Example.jpg",privateToken:"SECRET_TOKEN"};
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows([row(1,"post:news:a:telegram:-10012345",job("a",{prepared:{payload:{photo:"attach://news_photo",caption},media}}))])));
    expect(result.posts[0].preparedText).toBe(caption);expect(result.posts[0].media).toMatchObject({credit:"Автор, CC0",sha256:rev,width:1200,height:800});
    expect(result.posts[0].mediaInvalid).toBe(false);expect(JSON.stringify(result)).not.toContain("SECRET_TOKEN");
  });
  it("does not render overlong captions, ambiguous text/photo payloads or foreign media evidence",async()=>{
    const rows=[row(3,"post:news:a:telegram:-10012345",job("a",{prepared:{payload:{photo:"attach://news_photo",caption:"я".repeat(1025)}}})),
      row(2,"post:news:b:telegram:-10012345",job("b",{prepared:{payload:{photo:"attach://news_photo",caption:"caption",text:"different text"}}})),
      row(1,"post:news:c:telegram:-10012345",job("c",{prepared:{payload:{text:"Текст"},media:{destination:{platform:"vk",id:"-10012345"},credit:"credit",license:"CC0",sha256:rev,mime:"image/jpeg",width:1000,height:1000}}}))];
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows(rows)));
    expect(result.posts[0].preparedText).toBeNull();expect(result.posts[1].preparedText).toBeNull();expect(result.posts[2].media).toBeNull();expect(result.posts[2].mediaInvalid).toBe(true);
  });
  it("keeps credential-bearing source links and service metadata out of the media projection",async()=>{
    const media={destination:{platform:"telegram",id:"-10012345"},credit:"credit",license:"CC0",sha256:rev,mime:"image/jpeg",width:1000,height:1000,
      sourceUrl:"https://upload.wikimedia.org/example.jpg?token=SECRET_TOKEN",licenseEvidenceUrl:"https://user:SECRET_TOKEN@example.org/license",internalPath:"PRIVATE_PATH"};
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows([row(1,"post:news:a:telegram:-10012345",job("a",{prepared:{payload:{text:"Текст"},media}}))])));
    expect(result.posts[0].media).toMatchObject({sourceUrl:null,licenseEvidenceUrl:null});expect(JSON.stringify(result)).not.toMatch(/SECRET_TOKEN|PRIVATE_PATH/);
  });
  it("marks malformed or mismatched durable records incomplete without showing unsafe controls",async()=>{
    const result=summarizeNewsRuntime(await readLatestNewsRuntime(fetchRows([row(3,"post:news:wrong:telegram:-10012345",job("actual")),row(2,"destination:telegram:-10012345:extra",{}),row(1,"post:news:good%3Aid:telegram:-10012345",job("good:id"))])));
    expect(result.complete).toBe(false);expect(result.invalidRows).toBe(2);expect(result.posts).toHaveLength(1);expect(result.posts[0].newsId).toBe("good:id");expect(result.destinations[0].expectedVersion).toBeNull();
  });
  it("checks staff before either private read and keeps the new component mutation-free",()=>{
    const page=readFileSync("apps/admin/app/(dashboard)/literary-news/page.tsx","utf8");
    expect(page.indexOf("await requireStaff()")).toBeLessThan(page.indexOf("await loadLiteraryNewsRuntimeOverview("));
    expect(page).toContain("session.mfa.checkError");
    const component=readFileSync("apps/admin/components/LiteraryNewsDeliveryOverview.tsx","utf8");
    expect(component).not.toMatch(/action=|dangerouslySetInnerHTML|use client/);
  });
});
