import { contentRecordHash, contentTextHash } from "../planet/contentExportHash";

export type BookyDialogueLocale = "ru" | "en";
export type BookyDialogueReadingLevel = "plain" | "developing" | "fluent";
export type BookyDialogueIntent = "navigation" | "activity" | "sourced-fact" | "offline-help" | "load-error" | "loading-help";
export type BookyDialogueScreen = "globe" | "collection";
export const BOOKY_DIALOGUE_PROHIBITED_TAGS = Object.freeze([
  "open-generative-chat", "unverified-facts", "mandatory-microphone", "voice-cloning",
  "ip-imitation", "child-profiling", "child-advertising", "purchase-pressure", "urgency-pressure", "personal-data-request",
] as const);
export type BookyDialoguePayload = Readonly<{
  id: string;
  locale: BookyDialogueLocale;
  version: number;
  audience: "adult" | "child";
  ageRange: Readonly<{ min: number; max: number }>;
  readingLevel: BookyDialogueReadingLevel;
  intent: BookyDialogueIntent;
  screens: readonly BookyDialogueScreen[];
  context: string;
  entityIds: readonly string[];
  claimKind: "interface-guidance" | "factual";
  factualSources: readonly Readonly<{ id: string; url: string; accessedAt: string }>[];
  copy: Readonly<{ title: string; body: string; caption: string; reduced: string }>;
  /** Metadata only: all narrated records remain unavailable until scoped asset/rights validation exists. */
  narration: Readonly<{
    assetId: string;
    rights: Readonly<{ status: "approved" | "unapproved"; holder: string; sourceUrl: string; expiresAt: string }>;
  }> | null;
  prohibitedTags: readonly (typeof BOOKY_DIALOGUE_PROHIBITED_TAGS)[number][];
  provenance: Readonly<{
    kind: "existing-interface-copy" | "editorial";
    sourcePath: string;
    sourceVersion: number;
    sourceRef: string;
    sourceSha256: string;
    copySha256: string;
  }>;
}>;
export type BookyDialogueReview = Readonly<{
  status: "draft" | "approved" | "rejected" | "stale";
  reviewer: string | null;
  reviewedAt: string | null;
  contentChecksum: string;
}>;
export type BookyDialogueRecord = Readonly<{
  payload: BookyDialoguePayload;
  review: BookyDialogueReview;
  checksum: string;
}>;
/** Trusted editorial input, supplied separately from imported records. Hashes prove integrity, not authorship. */
export type BookyDialogueApproval = Readonly<{
  id: string;
  locale: BookyDialogueLocale;
  version: number;
  contentChecksum: string;
  reviewer: string;
  reviewedAt: string;
}>;
export type BookyDialoguePolicy = Readonly<{
  canonicalEntityIds: readonly string[];
  approvedReviews: readonly BookyDialogueApproval[];
}>;
/** Age is an explicit local policy input; this module neither collects nor infers a date of birth. */
export type BookyDialogueRequest = Readonly<{
  id: string;
  locale: BookyDialogueLocale;
  audience: "adult" | "child";
  age: number;
  readingLevel: BookyDialogueReadingLevel;
  intent: BookyDialogueIntent;
  screen: BookyDialogueScreen;
  context: string;
  entityIds: readonly string[];
  now: string;
}>;
export type BookyDialogueRejection = Readonly<{
  index: number;
  reason: "invalid-input" | "invalid-policy" | "invalid-record" | "checksum" | "review-binding" | "unknown-entity" | "duplicate";
}>;
export type BookyDialogueRegistry = Readonly<{
  size: number;
  rejections: readonly BookyDialogueRejection[];
  resolve(request: unknown): BookyDialogueRecord | null;
}>;

type Row = Record<string, unknown>;
const locales = ["ru", "en"];
const levels = ["plain", "developing", "fluent"];
const intents = ["navigation", "activity", "sourced-fact", "offline-help", "load-error", "loading-help"];
const screens = ["globe", "collection"];
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max && v.trim() === v && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const key = (v: unknown): v is string => typeof v === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(v);
const entity = (v: unknown): v is string => text(v, 200) && !/\s/.test(v);
const integer = (v: unknown, min: number, max: number): v is number => Number.isInteger(v) && Number(v) >= min && Number(v) <= max;
const choice = (v: unknown, choices: readonly string[]): boolean => typeof v === "string" && choices.includes(v);
const row = (v: unknown, keys: string): v is Row => !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).sort().join(" ") === keys.split(" ").sort().join(" ");
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
function list(v: unknown, max: number, valid: (item: unknown) => boolean): v is unknown[] {
  return Array.isArray(v) && v.length <= max && v.every(valid) && new Set(v).size === v.length;
}
function https(v: unknown): boolean {
  if (!text(v, 1000)) return false;
  try { const url = new URL(v); return url.protocol === "https:" && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}

/** Bounded own-data snapshot: no accessors/toJSON, sparse arrays, exotic prototypes or retained references. */
function snapshot(input: unknown): unknown {
  let nodes = 0;
  let characters = 0;
  const active = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 32_768 || depth > 12) throw new Error("bounds");
    if (typeof value === "string") {
      characters += value.length;
      if (value.length > 16_384 || characters > 1_000_000) throw new Error("bounds");
      return value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object" || active.has(value)) throw new Error("shape");
    active.add(value);
    try {
      const array = Array.isArray(value);
      if (array && Object.getPrototypeOf(value) !== Array.prototype) throw new Error("prototype");
      if (!array && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("prototype");
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const names = Reflect.ownKeys(descriptors);
      if (names.some(name => typeof name !== "string" || name.length > 96)) throw new Error("key");
      if (array) {
        const length = descriptors.length?.value;
        if (!integer(length, 0, 512) || names.length !== length + 1) throw new Error("array");
        const output: unknown[] = [];
        for (let i = 0; i < length; i++) {
          const descriptor = descriptors[String(i)];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("accessor");
          output.push(visit(descriptor.value, depth + 1));
        }
        return Object.freeze(output);
      }
      if (names.length > 24) throw new Error("keys");
      const output: Row = Object.create(null);
      for (const name of names as string[]) {
        const descriptor = descriptors[name];
        if (!("value" in descriptor) || !descriptor.enumerable) throw new Error("accessor");
        output[name] = visit(descriptor.value, depth + 1);
      }
      return Object.freeze(output);
    } finally { active.delete(value); }
  }
  try { return visit(input, 0); } catch { return undefined; }
}

function payloadValid(v: unknown): v is BookyDialoguePayload {
  if (!row(v, "id locale version audience ageRange readingLevel intent screens context entityIds claimKind factualSources copy narration prohibitedTags provenance")) return false;
  if (!key(v.id) || !choice(v.locale, locales) || !integer(v.version, 1, 1_000_000) || !choice(v.audience, ["adult", "child"]) ||
    !row(v.ageRange, "min max") || !integer(v.ageRange.min, 0, 120) || !integer(v.ageRange.max, v.ageRange.min, 120) ||
    (v.audience === "adult" ? v.ageRange.min < 18 : v.ageRange.max > 17) ||
    !choice(v.readingLevel, levels) || !choice(v.intent, intents) || !list(v.screens, 2, item => choice(item, screens)) || !v.screens.length ||
    !key(v.context) || !list(v.entityIds, 32, entity) || !choice(v.claimKind, ["interface-guidance", "factual"])) return false;
  if (!list(v.factualSources, 16, item => row(item, "id url accessedAt") && key(item.id) && https(item.url) && timestamp(item.accessedAt)) ||
    new Set(v.factualSources.map(source => (source as Row).id)).size !== v.factualSources.length ||
    v.claimKind === "factual" && !v.factualSources.length) return false;
  if (!row(v.copy, "title body caption reduced") || !text(v.copy.title, 160) || !text(v.copy.body, 1600) ||
    !text(v.copy.caption, 1600) || !text(v.copy.reduced, 320)) return false;
  if (v.narration !== null && (!row(v.narration, "assetId rights") || !key(v.narration.assetId) ||
    !row(v.narration.rights, "status holder sourceUrl expiresAt") || !choice(v.narration.rights.status, ["approved", "unapproved"]) ||
    !text(v.narration.rights.holder, 160) || !https(v.narration.rights.sourceUrl) || !timestamp(v.narration.rights.expiresAt))) return false;
  if (!list(v.prohibitedTags, BOOKY_DIALOGUE_PROHIBITED_TAGS.length, tag => choice(tag, BOOKY_DIALOGUE_PROHIBITED_TAGS))) return false;
  const p = v.provenance;
  return row(p, "kind sourcePath sourceVersion sourceRef sourceSha256 copySha256") && choice(p.kind, ["existing-interface-copy", "editorial"]) &&
    text(p.sourcePath, 240) && !p.sourcePath.includes("..") && !p.sourcePath.startsWith("/") && !p.sourcePath.includes("\\") &&
    integer(p.sourceVersion, 1, 1_000_000) && text(p.sourceRef, 240) && hash(p.sourceSha256) && hash(p.copySha256) &&
    p.copySha256 === contentTextHash(JSON.stringify({ title: v.copy.title, body: v.copy.body })) &&
    (v.intent !== "sourced-fact" || v.claimKind === "factual" && p.kind === "editorial");
}
function reviewValid(v: unknown): v is BookyDialogueReview {
  if (!row(v, "status reviewer reviewedAt contentChecksum") || !choice(v.status, ["draft", "approved", "rejected", "stale"]) || !hash(v.contentChecksum)) return false;
  return v.status === "draft" ? v.reviewer === null && v.reviewedAt === null : text(v.reviewer, 160) && timestamp(v.reviewedAt);
}
function approvalValid(v: unknown): v is BookyDialogueApproval {
  return row(v, "id locale version contentChecksum reviewer reviewedAt") && key(v.id) && choice(v.locale, locales) &&
    integer(v.version, 1, 1_000_000) && hash(v.contentChecksum) && text(v.reviewer, 160) && timestamp(v.reviewedAt);
}
function requestValid(v: unknown): v is BookyDialogueRequest {
  return row(v, "id locale audience age readingLevel intent screen context entityIds now") && key(v.id) && choice(v.locale, locales) &&
    choice(v.audience, ["adult", "child"]) && integer(v.age, 0, 120) && choice(v.readingLevel, levels) && choice(v.intent, intents) &&
    choice(v.screen, screens) && key(v.context) && list(v.entityIds, 32, entity) && timestamp(v.now);
}

export function getBookyDialogueContentChecksum(input: unknown): string | null {
  const value = snapshot(input);
  return payloadValid(value) ? contentRecordHash(value) : null;
}
export function getBookyDialogueChecksum(input: unknown): string | null {
  const value = snapshot(input);
  return row(value, "payload review") && payloadValid(value.payload) && reviewValid(value.review) ? contentRecordHash(value) : null;
}

/** Offline, deterministic admission only. No fetching, locale fallback, approval creation, clock or runtime wiring. */
export function createBookyDialogueRegistry(input: unknown, trustedPolicy: BookyDialoguePolicy = { canonicalEntityIds: [], approvedReviews: [] }): BookyDialogueRegistry {
  const records = new Map<string, BookyDialogueRecord>();
  const rejections: BookyDialogueRejection[] = [];
  const policy = snapshot(trustedPolicy);
  const values = snapshot(input);
  const reject = (index: number, reason: BookyDialogueRejection["reason"]) => rejections.push(Object.freeze({ index, reason }));
  const validPolicy = row(policy, "canonicalEntityIds approvedReviews") && list(policy.canonicalEntityIds, 512, entity) &&
    list(policy.approvedReviews, 128, approvalValid);
  if (!validPolicy) reject(-1, "invalid-policy");
  else if (!Array.isArray(values) || values.length > 128) reject(-1, "invalid-input");
  else {
    const canonical = new Set(policy.canonicalEntityIds as string[]);
    const seen = new Set<string>();
    for (let index = 0; index < values.length; index++) {
      const value: unknown = values[index];
      if (!row(value, "payload review checksum") || !payloadValid(value.payload) || !reviewValid(value.review) || !hash(value.checksum)) { reject(index, "invalid-record"); continue; }
      const record = value as BookyDialogueRecord;
      const recordKey = `${record.payload.id}/${record.payload.locale}`;
      if (seen.has(recordKey)) { records.delete(recordKey); reject(index, "duplicate"); continue; }
      seen.add(recordKey);
      if (record.checksum !== contentRecordHash({ payload: record.payload, review: record.review })) { reject(index, "checksum"); continue; }
      if (record.review.contentChecksum !== contentRecordHash(record.payload)) { reject(index, "review-binding"); continue; }
      if (record.payload.entityIds.some(id => !canonical.has(id))) { reject(index, "unknown-entity"); continue; }
      records.set(recordKey, record);
    }
  }
  const approvals = validPolicy ? policy.approvedReviews as BookyDialogueApproval[] : [];
  function resolve(inputRequest: unknown): BookyDialogueRecord | null {
    const request = snapshot(inputRequest);
    if (!requestValid(request) || request.audience !== "adult" || request.age < 18) return null;
    const record = records.get(`${request.id}/${request.locale}`);
    if (!record) return null;
    const { payload: p, review: r } = record;
    if (p.audience !== "adult" || r.status !== "approved" || !r.reviewedAt || r.reviewedAt > request.now ||
      request.age < p.ageRange.min || request.age > p.ageRange.max || request.readingLevel !== p.readingLevel ||
      request.intent !== p.intent || !p.screens.includes(request.screen) || request.context !== p.context ||
      request.entityIds.length !== p.entityIds.length || request.entityIds.some(id => !p.entityIds.includes(id)) ||
      p.prohibitedTags.length || p.factualSources.some(source => source.accessedAt > r.reviewedAt!) ||
      p.narration !== null) return null;
    if (!approvals.some(a => a.id === p.id && a.locale === p.locale && a.version === p.version && a.contentChecksum === r.contentChecksum &&
      a.reviewer === r.reviewer && a.reviewedAt === r.reviewedAt)) return null;
    return record;
  }
  return Object.freeze({ size: records.size, rejections: Object.freeze(rejections), resolve });
}
