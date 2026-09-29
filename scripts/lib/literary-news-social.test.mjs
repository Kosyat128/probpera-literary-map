import { describe, expect, it, vi } from "vitest";
import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import { buildPublishedNewsFeed } from "./literary-news-publication.mjs";
import { pendingNewsSourceState } from "./literary-news-state.mjs";
import { dispatchNewsJob as dispatch, dispatchNewsBatch, newsPostKey, prepareNewsPost,
  reconcileNewsSnapshot, scheduleNewsJobs, newsSemanticRevision, newsSocialPayloadDigest } from "./literary-news-social.mjs";
import { createNewsSocialTransport } from "./literary-news-social-transport.mjs";

const now = new Date("2026-09-26T12:00:00Z");
const dispatchNewsJob = (options) => dispatch({...options,transport:{preflight:async()=>({ok:true}),...options.transport}});
const destinations = [{ platform: "telegram", id: "-100123", mode: "on" }, { platform: "vk", id: "-456", mode: "on" }];
const item = { ...reviewed.find((row) => row.kind === "news"), id: "social-fixture", eventKey: "social-fixture",
  eventDate: "2026-09-25", publishedAt: null, verifiedAt: "2026-09-25T12:00:00Z" };
const completeFeed = (records = [item], withdrawals = []) => buildPublishedNewsFeed({ records, withdrawals,
  current: now, release: "a".repeat(40), state: pendingNewsSourceState(), timeZone: "Europe/Moscow" });
function memoryStore() {
  const rows = new Map(); let sequence = 0;
  return {
    read: vi.fn(async (key) => structuredClone(rows.get(key) || { id: null, state: null })),
    compareAppend: vi.fn(async (key, expected, state, guard = null) => {
      if (guard) {
        const control = rows.get(guard.key);
        if (!control || control.id !== guard.id || control.state.paused
          || !["on", "canary"].includes(control.state.mode) || control.state.historyReconciled !== true)
          return { applied: false, reason: "destination_changed" };
      }
      const previous = rows.get(key) || { id: null, state: null };
      if (expected !== previous.id) return { applied: false, ...structuredClone(previous) };
      const row = { id: ++sequence, state: structuredClone(state) }; rows.set(key, row);
      return { applied: true, ...structuredClone(row) };
    }),
    async seed(key, state) { const previous = await this.read(key); return this.compareAppend(key, previous.id, state); },
    async list(prefix) {return [...rows].filter(([key])=>key.startsWith(prefix)).map(([,row])=>structuredClone(row));},
  };
}
async function setup(records = [item]) {
  const store = memoryStore();
  await reconcileNewsSnapshot(store, await completeFeed(records), destinations, now);
  for (const d of destinations) await store.seed(`destination:${d.platform}:${d.id}`, { mode: "on", paused: false, historyReconciled: true });
  return { store, key: newsPostKey(records[0].id, destinations[0]) };
}
const accepted = { kind: "accepted", remoteId: "17", remoteUrl: "https://t.me/c/123/17" };

describe("durable agenda delivery state machine (isolated, no live writes)", () => {
  it("holds an absent admitted news item with pending media and restores the identical record when it returns",async()=>{
    const store=memoryStore(),target=destinations[0],key=newsPostKey(item.id,target);
    const pendingOptions={mediaOptions:{registry:{assets:[],downloadHosts:[]},resolutions:{[item.id]:{status:"pending",reason:"budget"}},deferBytes:true}};
    await reconcileNewsSnapshot(store,await completeFeed(),[target],now,pendingOptions);
    await store.seed("destination:telegram:-100123",{mode:"on",paused:false,historyReconciled:true});
    const original=(await store.read(key)).state,admission=await store.read(`admission:news:${encodeURIComponent(item.id)}`);
    const later=new Date("2026-11-28T12:00:00Z"),feedAtLater=records=>buildPublishedNewsFeed({records,withdrawals:[],
      current:later,release:"a".repeat(40),state:pendingNewsSourceState(),timeZone:"Europe/Moscow"});
    expect((await feedAtLater([item])).items).toHaveLength(1); // Age alone never removes reviewed news.
    const absent=await reconcileNewsSnapshot(store,await feedAtLater([]),[target],later,pendingOptions);
    expect(absent.expectedThisSnapshot).toBe(0);expect(absent.heldArchivedMediaJobs).toBe(1);
    const held=(await store.read(key)).state;
    expect(held).toEqual({...original,status:"blocked",lastError:"archived_media_requires_source_resolution"});
    expect(await store.read(`admission:news:${encodeURIComponent(item.id)}`)).toEqual(admission);
    expect(await store.list("post:")).toHaveLength(1);
    const send=vi.fn();expect(await dispatchNewsJob({store,key,transport:{send},now:()=>later}))
      .toEqual({status:"blocked",reason:"archived_media_requires_source_resolution"});expect(send).not.toHaveBeenCalled();
    const restored=await reconcileNewsSnapshot(store,await feedAtLater([item]),[target],later,pendingOptions);
    expect(restored.newAdmissions).toBe(0);expect(restored.expectedThisSnapshot).toBe(1);
    const pending=(await store.read(key)).state;expect(pending.status).toBe("pending");expect(pending.lastError).toBeNull();
    expect(pending.desiredRevision).toBe(original.desiredRevision);expect(pending.originalAdmission).toBe(original.originalAdmission);
    expect(pending.prepared.mediaPending).toBe(true);expect(pending.prepared.temporal.verifiedAt).toBe(item.verifiedAt);
    const publishText=vi.fn(async()=>accepted);
    expect(await dispatchNewsJob({store,key,transport:{send:publishText},now:()=>later}))
      .toMatchObject({status:"sent_current",remoteId:"17",dispatchAttempted:true});
    expect(publishText).toHaveBeenCalledTimes(1);
  });
  it("media search cannot hide an expired announcement or keep a withdrawal pending",async()=>{
    const announcement={...item,kind:"announcement",eventDate:"2026-09-27"},f=await setup([announcement]);
    const pendingOptions={mediaOptions:{registry:{assets:[],downloadHosts:[]},resolutions:{[item.id]:{status:"pending",reason:"budget"}},deferBytes:true}};
    await reconcileNewsSnapshot(f.store,await completeFeed([announcement]),destinations,now,pendingOptions);
    expect((await f.store.read(f.key)).state.prepared.mediaPending).toBe(true);
    const later=new Date("2026-09-28T12:00:00Z");
    const empty=await buildPublishedNewsFeed({records:[],withdrawals:[],current:later,release:"a".repeat(40),state:pendingNewsSourceState(),timeZone:"Europe/Moscow"});
    await reconcileNewsSnapshot(f.store,empty,destinations,later,pendingOptions);
    const send=vi.fn();expect((await dispatchNewsJob({store:f.store,key:f.key,transport:{send},now:()=>later})).status).toBe("blocked");
    expect((await f.store.read(f.key)).state.lastError).toBe("expired_announcement_requires_source_resolution");expect(send).not.toHaveBeenCalled();
    const g=await setup();await reconcileNewsSnapshot(g.store,await completeFeed(),destinations,now,pendingOptions);
    await reconcileNewsSnapshot(g.store,await completeFeed([],[{id:item.id,withdrawnAt:now.toISOString(),reason:"Source correction"}]),destinations,now,pendingOptions);
    const withdrawn=(await g.store.read(g.key)).state;expect(withdrawn.status).toBe("explicitly_closed");expect(withdrawn.prepared.mediaPending).toBe(false);
  });
  it("replays eight complete admissions as eight expectations per destination without duplicate identities", async () => {
    const rows = Array.from({ length: 8 }, (_, n) => ({ ...item, id: `event-${n}`, eventKey: `event-${n}` }));
    const store = memoryStore(), feed = await completeFeed(rows);
    const first = await reconcileNewsSnapshot(store, feed, destinations, now);
    const replay = await reconcileNewsSnapshot(store, feed, destinations, now);
    expect(first.expectedThisSnapshot).toBe(16); expect(first.newAdmissions).toBe(8);
    expect(replay.newAdmissions).toBe(0); expect(new Set(replay.keys).size).toBe(16);
    expect(first.historyGap).toBe(true);
  });
  it("requires complete current live-release proof and an editorial timezone", async () => {
    const store = memoryStore(), feed = await completeFeed();
    for (const bad of [ { ...feed, generatedAt: "not-a-date" }, { ...feed, fallbackCapturedAt: feed.generatedAt },
      { ...feed, snapshot: { ...feed.snapshot, complete: false } } ]) {
      await expect(reconcileNewsSnapshot(store, bad, destinations, now)).rejects.toThrow();
    }
    expect(store.compareAppend).not.toHaveBeenCalled();
  });
  it("records the first accepted create once and preserves it across next-day corrections", async () => {
    const { store, key } = await setup();
    const send = vi.fn(async () => accepted);
    await dispatchNewsJob({ store, key, transport: { send }, now: () => now });
    expect((await store.read(key)).state).toMatchObject({
      firstAcknowledgedAt: now.toISOString(), acknowledgedAt: now.toISOString(),
    });
    const nextDay = new Date("2026-09-27T12:00:00Z");
    const updated = { ...item, summary: { ...item.summary, ru: "Уточнённый факт из первоисточника." } };
    const revisedFeed = await buildPublishedNewsFeed({ records: [updated], withdrawals: [], current: nextDay,
      release: "a".repeat(40), state: pendingNewsSourceState(), timeZone: "Europe/Moscow" });
    await reconcileNewsSnapshot(store, revisedFeed, destinations, nextDay);
    const edit = vi.fn(async ({ remoteId }) => { expect(remoteId).toBe("17"); return accepted; });
    await dispatchNewsJob({ store, key, transport: { send: edit }, now: () => nextDay });
    expect((await store.read(key)).state).toMatchObject({
      firstAcknowledgedAt: now.toISOString(), acknowledgedAt: nextDay.toISOString(), status: "sent_current",
    });
    expect(send).toHaveBeenCalledTimes(1); expect(edit).toHaveBeenCalledTimes(1);
  });
  it("keeps an older remote ID's original publication date unknown when accepting an edit", async () => {
    const { store, key } = await setup();
    const original = (await store.read(key)).state;
    await store.seed(key, { ...original, status: "correction_pending", remoteId: "17",
      acknowledgedAt: "2026-09-25T09:00:00Z" });
    const send = vi.fn(async ({ remoteId }) => { expect(remoteId).toBe("17"); return accepted; });
    await dispatchNewsJob({ store, key, transport: { send }, now: () => now });
    expect((await store.read(key)).state).toMatchObject({
      firstAcknowledgedAt: null, acknowledgedAt: now.toISOString(), status: "sent_current",
    });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("does not stamp a first publication for a rejected create", async () => {
    const { store, key } = await setup();
    await dispatchNewsJob({ store, key,
      transport: { send: async () => ({ kind: "blocked", code: "request_rejected" }) }, now: () => now });
    const state = (await store.read(key)).state;
    expect(state.firstAcknowledgedAt).toBeUndefined(); expect(state.acknowledgedAt).toBeUndefined();
    expect(state.remoteId).toBeFalsy();
  });
  it("two simultaneous runners produce one external call and keep an active claim inflight", async () => {
    const { store, key } = await setup(); let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const send = vi.fn(async () => { await gate; return accepted; });
    const first = dispatchNewsJob({ store, key, transport: { send }, now: () => now });
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("inflight");
    expect((await store.read(key)).state.status).toBe("inflight");
    release(); expect((await first).status).toBe("sent_current");
    await dispatchNewsJob({ store, key, transport: { send }, now: () => now }); expect(send).toHaveBeenCalledTimes(1);
  });
  it("a lost response remains ambiguous after lease expiry, with no blind create retry", async () => {
    const { store, key } = await setup(); const send = vi.fn(async () => { throw new Error("secret must not persist"); });
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("ambiguous");
    await dispatchNewsJob({ store, key, transport: { send }, now: () => new Date(now.getTime() + 3600000) });
    expect(send).toHaveBeenCalledTimes(1); expect(JSON.stringify((await store.read(key)).state)).not.toContain("secret");
  });
  it("an expired lease with durable dispatch_started is unresolved, while a pre-dispatch lease can be reclaimed", async () => {
    const { store, key } = await setup(); const job = (await store.read(key)).state;
    await store.seed(key, { ...job, status: "inflight", leaseUntil: "2026-09-25T12:00:00Z", dispatchStartedAt: "2026-09-25T12:00:00Z" });
    const send = vi.fn(async () => accepted);
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("ambiguous");
    expect(send).not.toHaveBeenCalled();
    await store.seed(key, { ...job, status: "inflight", leaseUntil: "2026-09-25T12:00:00Z", dispatchStartedAt: null });
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("sent_current");
  });
  it("checks pause again after claim and before possible platform writes", async () => {
    const { store, key } = await setup(); const original = store.compareAppend;
    store.compareAppend = vi.fn(async (...args) => {
      const result = await original(...args);
      if (args[0] === key && args[2].status === "inflight" && !args[2].dispatchStartedAt)
        await store.seed("destination:telegram:-100123", { mode: "on", paused: true, historyReconciled: true });
      return result;
    });
    const send = vi.fn(); await dispatchNewsJob({ store, key, transport: { send }, now: () => now });
    expect(send).not.toHaveBeenCalled();
  });
  it("checks current rights before dispatch and pauses a revoked destination", async () => {
    const {store,key}=await setup(),send=vi.fn();
    const result=await dispatchNewsJob({store,key,transport:{send,preflight:async()=>({ok:false})},now:()=>now});
    expect(result.reason).toBe("destination_rights_unverified");expect(send).not.toHaveBeenCalled();
    expect((await store.read("destination:telegram:-100123")).state.paused).toBe(true);
  });
  it("repairs a missing job from durable admission after it leaves the current projection", async () => {
    const store=memoryStore();
    await reconcileNewsSnapshot(store,await completeFeed(),[],now);
    const result=await reconcileNewsSnapshot(store,await completeFeed([]),destinations,now);
    expect(result.restoredMissingJobs).toBe(2);
    expect((await store.read(newsPostKey(item.id,destinations[0]))).state.originalAdmission).toBe(now.toISOString());
  });
  it("withdrawal during dispatch stays correction_pending after the old create receipt", async () => {
    const { store, key } = await setup();
    const withdrawal = { id: item.id, withdrawnAt: now.toISOString(), reason: "Correction by the source" };
    const send = vi.fn(async () => { await reconcileNewsSnapshot(store, await completeFeed([], [withdrawal]), destinations, now); return accepted; });
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("correction_pending");
    expect((await store.read(key)).state.withdrawal).toEqual(withdrawal);
    const edit = vi.fn(async ({ remoteId, prepared }) => {
      expect(remoteId).toBe("17"); expect(prepared.payload.text).toContain("отозвано"); return accepted;
    });
    expect((await dispatchNewsJob({ store, key, transport: { send: edit }, now: () => now })).status).toBe("explicitly_closed");
  });
  it("late old receipts retain a newer desired revision, and the next call edits the known ID", async () => {
    const { store, key } = await setup();
    const updated = { ...item, summary: { ...item.summary, ru: "Уточнённый факт из первоисточника." } };
    const send = vi.fn(async () => { await reconcileNewsSnapshot(store, await completeFeed([updated]), destinations, now); return accepted; });
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("correction_pending");
    const job = (await store.read(key)).state; expect(job.desiredRevision).not.toBe(job.acknowledgedRevision);
    const edit = vi.fn(async ({ remoteId, prepared }) => { expect(remoteId).toBe("17"); expect(prepared.payload.text).toContain("Уточнённый"); return accepted; });
    expect((await dispatchNewsJob({ store, key, transport: { send: edit }, now: () => now })).status).toBe("sent_current");
  });
  it("edits an existing news message to remove its event-date line without creating a new post", async () => {
    const { store, key } = await setup();
    const original = (await store.read(key)).state;
    const legacyRevision = await newsSemanticRevision(item);
    const { formatRevision, ...legacyPrepared } = original.prepared;
    const legacyPayload = { ...legacyPrepared.payload, text: legacyPrepared.payload.text.replace(
      "Источник:", "Дата события: 25 сентября 2026 г.\n\nИсточник:") };
    await store.seed(key, { ...original, status: "sent_current", remoteId: "17", remoteMediaKind: "text",
      desiredRevision: legacyRevision, acknowledgedRevision: legacyRevision,
      prepared: { ...legacyPrepared, revision: legacyRevision, payload: legacyPayload,
        payloadSha256: await newsSocialPayloadDigest(legacyPayload) } });
    await reconcileNewsSnapshot(store, await completeFeed(), destinations, now);
    const corrected = (await store.read(key)).state;
    expect(corrected.status).toBe("correction_pending");
    expect(corrected.remoteId).toBe("17");
    expect(corrected.desiredRevision).not.toBe(legacyRevision);
    const send = vi.fn(async ({ remoteId, prepared }) => {
      expect(remoteId).toBe("17");
      expect(prepared.payload.text).not.toContain("Дата события");
      return accepted;
    });
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("sent_current");
    expect(send).toHaveBeenCalledTimes(1);
    expect((await store.read(key)).state.remoteId).toBe("17");
  });
  it("rejects prepared bytes from an older revision", async () => {
    const { store, key } = await setup(); const job = (await store.read(key)).state;
    await store.seed(key, { ...job, desiredRevision: "newer" }); const send = vi.fn();
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => now })).status).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
  });
  it("definitive rejection clears dispatch markers, permitting a corrected revision without duplicate create ambiguity", async () => {
    const { store, key } = await setup();
    await dispatchNewsJob({ store, key, transport: { send: async () => ({ kind: "blocked", code: "request_rejected" }) }, now: () => now });
    expect((await store.read(key)).state.dispatchStartedAt).toBeNull();
    await reconcileNewsSnapshot(store, await completeFeed([{ ...item, summary: { ...item.summary, ru: "Исправленный текст." } }]), destinations, now);
    expect((await dispatchNewsJob({ store, key, transport: { send: async () => accepted }, now: () => now })).reason).toBe("destination_pacing");
    expect((await dispatchNewsJob({ store, key, transport: { send: async () => accepted }, now: () => new Date(now.getTime()+1800000) })).status).toBe("sent_current");
  });
  it("rate limits the whole destination while the other platform can proceed", async () => {
    const { store, key } = await setup(); const send = vi.fn(async () => ({ kind: "retry", scope: "retry", code: "rate_limit", retryAfterSeconds: 90 }));
    await dispatchNewsJob({ store, key, transport: { send }, now: () => now });
    await dispatchNewsJob({ store, key, transport: { send }, now: () => now }); expect(send).toHaveBeenCalledTimes(1);
    expect((await store.read("destination:telegram:-100123")).state.nextDueAt).toBe("2026-09-26T12:01:30.000Z");
    expect((await dispatchNewsJob({ store, key: newsPostKey(item.id, destinations[1]), transport: { send: async () => accepted }, now: () => now })).status).toBe("sent_current");
  });
  it("expiry is an explicit resolution state, not an assertion an event happened", async () => {
    const announcement = { ...item, kind: "announcement", eventDate: "2026-09-27" };
    const { store, key } = await setup([announcement]); const send = vi.fn();
    expect((await dispatchNewsJob({ store, key, transport: { send }, now: () => new Date("2026-09-28T12:00:00Z") })).status).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
  });
  it("a previous-day announcement is blocked on its event day, just as in the public selector", async () => {
    const announcement = { ...item, kind: "announcement", eventDate: "2026-09-27", verifiedAt: now.toISOString() };
    const { store, key } = await setup([announcement]); const send = vi.fn();
    const eventDay = new Date("2026-09-27T12:00:00Z");
    const publicFeed = await buildPublishedNewsFeed({ records: [announcement], current: eventDay,
      state: pendingNewsSourceState(), release: "a".repeat(40), timeZone: "Europe/Moscow" });
    expect(publicFeed.items).toHaveLength(0);
    expect((await dispatchNewsJob({store,key,transport:{send},now:()=>eventDay})).status).toBe("blocked");
    expect(send).not.toHaveBeenCalled();
  });
  it("a new event-day source verification renews an expired job without requiring invented text changes", async () => {
    const announcement={...item,kind:"announcement",eventDate:"2026-09-27",verifiedAt:now.toISOString()};
    const {store,key}=await setup([announcement]);
    const eventDay=new Date("2026-09-27T12:00:00Z"),send=vi.fn(async()=>accepted);
    await dispatchNewsJob({store,key,transport:{send},now:()=>eventDay});
    const renewed={...announcement,verifiedAt:eventDay.toISOString()};
    const feed=await buildPublishedNewsFeed({records:[renewed],current:eventDay,state:pendingNewsSourceState(),
      release:"a".repeat(40),timeZone:"Europe/Moscow"});
    await reconcileNewsSnapshot(store,feed,destinations,eventDay);
    expect((await store.read(key)).state.prepared.temporal.verifiedAt).toBe(eventDay.toISOString());
    expect((await store.read("admission:news:"+item.id)).state.record.verifiedAt).toBe(eventDay.toISOString());
    expect((await dispatchNewsJob({store,key,transport:{send},now:()=>eventDay})).status).toBe("sent_current");
    expect(send).toHaveBeenCalledTimes(1);
  });
  it.each(["paused", "off", "not-due"])("25 unavailable corrections (%s) cannot starve another platform", async (unavailable) => {
    const rows = Array.from({length:26},(_,index)=>({...item,id:`fairness-${index}`,eventKey:`fairness-${index}`}));
    const {store}=await setup(rows);
    const telegramControl = {mode:unavailable==="off"?"off":"on",paused:unavailable==="paused",historyReconciled:true};
    await store.seed("destination:telegram:-100123",telegramControl);
    const jobs=[];
    for(let index=0;index<25;index++) {
      const key=newsPostKey(rows[index].id,destinations[0]);
      const job={...(await store.read(key)).state,status:"correction_pending",remoteId:"17",
        nextDueAt:unavailable==="not-due"?"2026-09-27T12:00:00Z":now.toISOString()};
      await store.seed(key,job); jobs.push(job);
    }
    const vkKey=newsPostKey(rows[25].id,destinations[1]); jobs.push((await store.read(vkKey)).state);
    const send=vi.fn(async()=>accepted);
    const outcomes=await dispatchNewsBatch({store,jobs,transport:{preflight:async()=>({ok:true}),send},now:()=>now});
    expect(send).toHaveBeenCalledTimes(1);expect(send.mock.calls[0][0].destination.platform).toBe("vk");
    expect(outcomes.some(row=>row.key===vkKey&&row.status==="sent_current")).toBe(true);
  });
  it("the bounded runner never performs more than 25 existing-post edit attempts", async () => {
    const rows=Array.from({length:30},(_,index)=>({...item,id:`budget-${index}`,eventKey:`budget-${index}`}));
    const {store}=await setup(rows),send=vi.fn(async()=>accepted);
    for(const row of await store.list("post:")) await store.seed(row.state.key,{...row.state,status:"correction_pending",remoteId:"17"});
    await dispatchNewsBatch({store,jobs:(await store.list("post:")).map(row=>row.state),
      transport:{preflight:async()=>({ok:true}),send},now:()=>now});
    expect(send).toHaveBeenCalledTimes(25);
  });
  it("retains calendar NewsItem, no author date patches are part of this path", async () => {
    const store = memoryStore(); const row = { ...item, kind: "calendar" };
    expect((await reconcileNewsSnapshot(store, await completeFeed([row]), destinations, now)).expectedThisSnapshot).toBe(2);
  });
  it("alternates old and fresh backlog after corrections", () => {
    const rows = [1, 2, 3, 4].map((n) => ({ key: `${n}`, originalAdmission: `${n}`, status: "pending" }));
    expect(scheduleNewsJobs(rows).map((row) => row.key)).toEqual(["1", "4", "2", "3"]);
  });
});

describe("native prepared text and validated transport receipts", () => {
  it("omits the event date from Telegram and VK news while retaining useful announcement and calendar dates", async () => {
    const snapshot = (await completeFeed()).snapshot;
    for (const platform of ["telegram", "vk"]) {
      const news = await prepareNewsPost(item, snapshot, platform);
      expect(news.payload.text ?? news.payload.message).not.toContain("Дата события");
      expect(news.payload.text ?? news.payload.message).not.toContain("25 сентября 2026 г.");
      for (const [kind, label] of [["announcement", "Запланировано"], ["calendar", "Памятная дата"]]) {
        const dated = await prepareNewsPost({ ...item, kind }, snapshot, platform);
        expect(dated.payload.text ?? dated.payload.message).toContain(`${label}: 25 сентября 2026 г.`);
      }
    }
  });
  it("rejects token path/authority injection before any request and keeps exact native hosts",async()=>{
    const prepared=await prepareNewsPost(item,(await completeFeed()).snapshot,"telegram");
    for(const token of ["evil/../../sendMessage","evil?redirect=https://evil.example","evil#fragment","evil@evil.example/", "bad\\token"]){
      const fetchImpl=vi.fn(),transport=createNewsSocialTransport({mode:"live",telegramToken:token,fetchImpl});
      expect((await transport.send({destination:destinations[0],prepared,remoteId:null})).code).toBe("provider_endpoint_invalid");
      expect(fetchImpl).not.toHaveBeenCalled();
    }
    const fetchImpl=vi.fn(async(url)=>{const target=new URL(url);expect(target.origin).toBe("https://api.telegram.org");
      expect(target.pathname).toBe("/bot123:fixture_token/sendMessage");
      return Response.json({ok:true,result:{message_id:17,chat:{id:-100123}}});});
    expect((await createNewsSocialTransport({mode:"live",telegramToken:"123:fixture_token",fetchImpl})
      .send({destination:destinations[0],prepared,remoteId:null})).kind).toBe("accepted");
  });
  it("canonical payload checks ignore JSON object ordering but reject changed values", async () => {
    const prepared=await prepareNewsPost(item,(await completeFeed()).snapshot,"telegram");
    const reordered={link_preview_options:prepared.payload.link_preview_options,
      entities:prepared.payload.entities.map(({type,length,offset})=>({offset,length,type})),text:prepared.payload.text};
    expect(await newsSocialPayloadDigest(reordered)).toBe(prepared.payloadSha256);
    const fetchImpl=vi.fn();
    const transport=createNewsSocialTransport({mode:"live",telegramToken:"fixture",fetchImpl});
    const changed={...prepared,payload:{...reordered,text:reordered.text+" altered"}};
    expect((await transport.send({destination:destinations[0],prepared:changed,remoteId:null})).code).toBe("prepared_bytes_changed");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("uses exact UTF-16 title offsets and disables Telegram preview without truncating attribution", async () => {
    const prepared = await prepareNewsPost({ ...item, title: { ru: "📚 A & B: «Часть 10»", en: "A & B" } }, (await completeFeed()).snapshot, "telegram");
    expect(prepared.payload.entities[0].length).toBe("📚 A & B: «Часть 10»".length);
    expect(prepared.payload.link_preview_options.is_disabled).toBe(true);
    expect(prepared.payload.text).toContain(item.source.url);
    expect(prepared.payload.text).toContain("https://probpera.ru/#literary-news");
  });
  it("shadow cannot call any external write method", async () => {
    const fetchImpl = vi.fn();
    expect((await createNewsSocialTransport({ fetchImpl }).send({})).kind).toBe("blocked");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([{}, { ok: true }, { ok: true, result: { message_id: 9, chat: { id: -999 } } }])("HTTP200 without a correct destination receipt is ambiguous", async (body) => {
    const prepared = await prepareNewsPost(item, (await completeFeed()).snapshot, "telegram");
    const transport = createNewsSocialTransport({ mode: "live", telegramToken: "fixture-token", fetchImpl: async () => Response.json(body) });
    expect((await transport.send({ destination: destinations[0], prepared, remoteId: null })).kind).toBe("ambiguous");
  });
  it("validates Telegram IDs and native VK post IDs; edit never creates a second post", async () => {
    for (const destination of destinations) {
      const prepared = await prepareNewsPost(item, (await completeFeed()).snapshot, destination.platform);
      const fetchImpl = vi.fn(async () => Response.json(destination.platform === "telegram"
        ? { ok: true, result: { message_id: 17, chat: { id: Number(destination.id) } } } : { response: { post_id: 17 } }));
      const transport = createNewsSocialTransport({ mode: "live", telegramToken: "fixture", vkToken: "fixture", fetchImpl });
      expect((await transport.send({ destination, prepared, remoteId: null })).remoteId).toBe("17");
      expect((await transport.send({ destination, prepared, remoteId: "17" })).remoteId).toBe("17");
      expect(String(fetchImpl.mock.calls[1][0])).toContain(destination.platform === "telegram" ? "editMessageText" : "wall.edit");
    }
  });
});
