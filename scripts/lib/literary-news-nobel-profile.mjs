import { validDate, validTimestamp } from "./literary-news-reviewed.mjs";
import { newsDigest, publicNewsItem } from "./literary-news-publication.mjs";

// Reviewed, code-owned profile. Source JSON can supply facts, never policy or endpoints.
export const NOBEL_PROFILE_KEY = "literary-news:v1:approved-profile:nobel-literature";
export const NOBEL_PROFILE_MAX_BYTES = 262144;
export const NOBEL_PROFILE_ID = "nobel-literature-single-winner";
export const NOBEL_PROFILE_VERSION = 1;
export const NOBEL_API_URL = "https://api.nobelprize.org/2.1/nobelPrizes?nobelPrizeCategory=lit&limit=2&sort=desc";
const DAY = 86400000;
const ADMISSION_DAYS = 60;
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;
const timestampBefore = (value, current) => validTimestamp(value) && Date.parse(value) <= current.getTime();
const validKnownName = (name) => typeof name === "string" && name.length <= 160 && name.trim() === name
  && /^[\p{L}\p{M}][\p{L}\p{M} .'’\-]+$/u.test(name);

function factsFromPrize(prize, current) {
  if (prize?.category?.en !== "Literature" || !/^\d{4}$/u.test(prize.awardYear || "")
    || Number(prize.awardYear) < 1901 || Number(prize.awardYear) > current.getUTCFullYear()
    || !validDate(prize.dateAwarded) || prize.dateAwarded.slice(0, 4) !== prize.awardYear
    || Date.parse(`${prize.dateAwarded}T00:00:00Z`) > current.getTime()
    || !Array.isArray(prize.laureates) || prize.laureates.length !== 1) throw new Error("unsupported_prize");
  const laureate = prize.laureates[0], name = laureate?.knownName?.en;
  if (typeof laureate.id !== "string" || !/^[1-9]\d{0,9}$/u.test(laureate.id) || laureate.portion !== "1"
    || !validKnownName(name)) throw new Error("unsupported_laureate");
  return { awardYear: prize.awardYear, dateAwarded: prize.dateAwarded, laureateId: laureate.id, knownName: name };
}
function checkedFacts(facts, current) {
  if (!facts || typeof facts !== "object" || Array.isArray(facts)) throw new Error("profile_facts_invalid");
  return factsFromPrize({awardYear:facts.awardYear,dateAwarded:facts.dateAwarded,category:{en:"Literature"},
    laureates:[{id:facts.laureateId,knownName:{en:facts.knownName},portion:"1"}]},current);
}
function sourceRecord(entry) {
  const facts = entry.sourceFacts, year = facts.awardYear, name = facts.knownName;
  const date = `${facts.dateAwarded.slice(8,10)}.${facts.dateAwarded.slice(5,7)}.${year}`;
  return {
    id:`nobel-literature-${year}`,eventKey:`nobel-literature-${year}`,category:"awards",kind:"news",
    eventDate:facts.dateAwarded,publishedAt:facts.dateAwarded,verifiedAt:entry.firstAcceptedAt,verification:"confirmed",
    title:{ru:`Нобелевская премия по литературе ${year}: ${name}`,en:`Nobel Prize in Literature ${year}: ${name}`},
    summary:{ru:`Лауреат Нобелевской премии по литературе за ${year} год - ${name}. Дата присуждения - ${date}, согласно официальным данным премии.`,
      en:`The Nobel Prize in Literature ${year} was awarded to ${name}. The official award date is ${facts.dateAwarded}.`},
    source:{name:"Nobel Prize",url:`https://www.nobelprize.org/prizes/literature/${year}/summary/`,language:"en"},region:"global",
  };
}

/** Validates durable admission evidence; old accepted entries do not age out. */
export async function validateNobelApprovedPayload(value, current = new Date()) {
  if (!Number.isFinite(current.getTime()) || !value || value.schemaVersion !== 1 || value.profile !== NOBEL_PROFILE_ID
    || value.profileVersion !== NOBEL_PROFILE_VERSION || value.endpoint !== NOBEL_API_URL
    || !timestampBefore(value.fetchedAt,current) || !hash(value.sourceDocumentSha256)
    || !Array.isArray(value.records) || value.records.length > 200 || bytes(value) > NOBEL_PROFILE_MAX_BYTES) throw new Error("profile_payload_invalid");
  const years = new Set(), records = [];
  for (const entry of value.records) {
    const facts = checkedFacts(entry?.sourceFacts,current);
    const start = Date.parse(`${facts.dateAwarded}T00:00:00Z`), admitted = Date.parse(entry?.firstAcceptedAt);
    if (years.has(facts.awardYear) || !timestampBefore(entry.firstAcceptedAt,current)
      || admitted < start || admitted > Date.parse(value.fetchedAt) || admitted-start > ADMISSION_DAYS*DAY || !hash(entry.factsSha256)
      || entry.factsSha256 !== await newsDigest(facts)) throw new Error("profile_record_invalid");
    years.add(facts.awardYear);
    records.push({sourceFacts:facts,factsSha256:entry.factsSha256,firstAcceptedAt:entry.firstAcceptedAt});
  }
  return {schemaVersion:1,profile:NOBEL_PROFILE_ID,profileVersion:NOBEL_PROFILE_VERSION,endpoint:NOBEL_API_URL,
    fetchedAt:value.fetchedAt,sourceDocumentSha256:value.sourceDocumentSha256,records};
}
export async function nobelPublishedRecords(value, current = new Date()) {
  return (await validateNobelApprovedPayload(value,current)).records.map(sourceRecord);
}

/** Verify the code-owned public projection without inventing private admission evidence. */
export function validateNobelPublishedItem(item, current = new Date()) {
  const year = /^nobel-literature-(\d{4})$/u.exec(item?.id || "")?.[1];
  const prefix = `Nobel Prize in Literature ${year}: `;
  const name = typeof item?.title?.en === "string" && item.title.en.startsWith(prefix) ? item.title.en.slice(prefix.length) : null;
  const awardedAt = Date.parse(`${item?.eventDate}T00:00:00Z`), admittedAt = Date.parse(item?.verifiedAt);
  if (!Number.isFinite(current.getTime()) || !year || Number(year) < 1901 || Number(year) > current.getUTCFullYear()
    || !validKnownName(name) || !validDate(item.eventDate) || item.eventDate.slice(0,4) !== year
    || awardedAt > current.getTime() || !timestampBefore(item.verifiedAt,current)
    || admittedAt < awardedAt || admittedAt - awardedAt > ADMISSION_DAYS * DAY) throw new Error("published_nobel_profile_invalid");
  const expected = publicNewsItem(sourceRecord({sourceFacts:{awardYear:year,dateAwarded:item.eventDate,knownName:name},firstAcceptedAt:item.verifiedAt}));
  const equal = (left,right) => left === right || Boolean(left && right && typeof left === "object" && typeof right === "object"
    && Array.isArray(left) === Array.isArray(right) && Object.keys(left).length === Object.keys(right).length
    && Object.keys(right).every(key=>Object.hasOwn(left,key) && equal(left[key],right[key])));
  if (!equal(item,expected)) throw new Error("published_nobel_profile_invalid");
  return expected;
}

/** Unsupported cases stay held. One new award per year, with stable replay identity. */
export async function buildNobelProfile({ document, previous = null, current = new Date(), sourceDocumentSha256 }) {
  const prior = previous === null ? null : await validateNobelApprovedPayload(previous,current);
  if (!document || !Array.isArray(document.nobelPrizes) || document.nobelPrizes.length < 1
    || document.nobelPrizes.length > 2 || bytes(document) > NOBEL_PROFILE_MAX_BYTES) throw new Error("nobel_shape_drift");
  const records = new Map((prior?.records || []).map(entry=>[entry.sourceFacts.awardYear,entry]));
  const held = [], seen = new Set(), candidates = new Map();
  for (const prize of document.nobelPrizes) {
    const suppliedYear = typeof prize?.awardYear === "string" && /^\d{4}$/u.test(prize.awardYear) ? prize.awardYear : null;
    if (suppliedYear && seen.has(suppliedYear)) { candidates.delete(suppliedYear); held.push({awardYear:suppliedYear,reason:"duplicate_year_conflict"}); continue; }
    if (suppliedYear) seen.add(suppliedYear);
    let facts;
    try { facts = factsFromPrize(prize,current); }
    catch { held.push({awardYear:/^\d{4}$/u.test(prize?.awardYear || "")?prize.awardYear:null,reason:"unsupported_or_future_prize"}); continue; }
    candidates.set(facts.awardYear,facts);
  }
  for (const [year,facts] of candidates) {
    const factsSha256 = await newsDigest(facts), existing = records.get(year);
    if (existing) {
      if (existing.factsSha256 !== factsSha256) held.push({awardYear:year,reason:"accepted_facts_conflict"});
      continue;
    }
    if (current.getTime()-Date.parse(`${facts.dateAwarded}T00:00:00Z`) > ADMISSION_DAYS*DAY) {
      held.push({awardYear:year,reason:"outside_initial_admission_window"}); continue;
    }
    records.set(year,{sourceFacts:facts,factsSha256,firstAcceptedAt:current.toISOString()});
  }
  const payload = await validateNobelApprovedPayload({schemaVersion:1,profile:NOBEL_PROFILE_ID,profileVersion:NOBEL_PROFILE_VERSION,
    endpoint:NOBEL_API_URL,fetchedAt:current.toISOString(),sourceDocumentSha256:sourceDocumentSha256 || await newsDigest(document),
    records:[...records.values()].sort((a,b)=>a.sourceFacts.awardYear.localeCompare(b.sourceFacts.awardYear))},current);
  return {payload,held};
}

export async function readNobelProfileText(response) {
  if (!response.body || Number(response.headers.get("content-length")) > NOBEL_PROFILE_MAX_BYTES) throw new Error("nobel_response_too_large");
  const reader=response.body.getReader(),decoder=new TextDecoder();let total=0,text="";
  try {
    while(true) {const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>NOBEL_PROFILE_MAX_BYTES)throw new Error("nobel_response_too_large");text+=decoder.decode(part.value,{stream:true});}
    return text+decoder.decode();
  } catch(error) {await reader.cancel().catch(()=>{});throw error;} finally {reader.releaseLock();}
}

/** Called only by the already authorized sync CLI, after the held collector commit. */
export async function syncNobelProfile({storage,fetchImpl=fetch,current=new Date()}) {
  const text=await storage.readApprovedProfile();
  const previous=text===null?null:await validateNobelApprovedPayload(JSON.parse(text),current);
  const response=await fetchImpl(NOBEL_API_URL,{redirect:"manual",signal:AbortSignal.timeout(15000),headers:{Accept:"application/json"}});
  if (!response.ok || (response.url && response.url!==NOBEL_API_URL)
    || !/^(application\/json)(;|$)/iu.test(response.headers.get("content-type")||"")) throw new Error("nobel_fetch_failed");
  const raw=await readNobelProfileText(response);
  const sourceDocumentSha256=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)))].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  const document=JSON.parse(raw),result=await buildNobelProfile({document,previous,current,sourceDocumentSha256});
  await storage.writeApprovedProfile(result.payload);
  return {...result,newlyAccepted:result.payload.records.length-(previous?.records.length||0),apiStatus:response.status,
    sourceCapture:{endpoint:NOBEL_API_URL,fetchedAt:current.toISOString(),sha256:sourceDocumentSha256,document}};
}
