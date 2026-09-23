import { contentTextHash } from "../planet/contentExportHash";
import { parseBookyJourneyPlanOverview, type BookyJourneyPlan } from "./bookyJourney";
import { getBookyJourneyActivityChecksum, parseBookyJourneyActivity } from "./bookyJourneyActivity";
import { serializeBookyReaderPolicy, type BookyReaderPolicy } from "./bookyReaderPolicy";

export const BOOKY_JOURNEY_PROGRESS_KEY = "probpera-booky-journey-progress-v1";
/** UTF-8 bytes, including JSON syntax. Oversized input is preserved as unsupported. */
export const BOOKY_JOURNEY_PROGRESS_MAX_LENGTH = 262_144;
export const BOOKY_JOURNEY_PROGRESS_MAX_RECORDS = 32;
export const BOOKY_JOURNEY_PROGRESS_MAX_NODES = 32;
export type BookyJourneyProgressActivity = Readonly<{ id: string; version: number; semanticChecksum: string }>;
export type BookyJourneyProgressNode = Readonly<Pick<BookyJourneyPlan["nodes"][number], "id" | "kind" | "screen" | "entity"> & {
  /** Identity only. Unacknowledged choices and the answer key are never stored. */
  activity?: BookyJourneyProgressActivity;
}>;
export type BookyJourneyProgressRecord = Readonly<{
  recordId: string;
  /** Binding only: never proof of age, current policy, editorial review or access. */
  policyFingerprint: string;
  journeyId: string;
  journeyVersion: number;
  locale: "ru" | "en";
  definitionChecksum: string;
  nodes: readonly BookyJourneyProgressNode[];
  acknowledgedNodeIds: readonly string[];
  resumeNodeId: string | null;
}>;
export type BookyJourneyProgressPreference = Readonly<{
  schemaVersion: 1;
  audience: "adult";
  revision: number;
  activeRecordId: string | null;
  records: readonly BookyJourneyProgressRecord[];
}>;
export type BookyJourneyProgressDecoded = Readonly<{
  preference: BookyJourneyProgressPreference | null;
  error: "invalid" | "unsupported" | null;
}>;
export const DEFAULT_BOOKY_JOURNEY_PROGRESS: BookyJourneyProgressPreference = Object.freeze({
  schemaVersion: 1, audience: "adult", revision: 0, activeRecordId: null, records: Object.freeze([]),
});

type Data = Record<string, unknown>;
const invalid = Object.freeze({ preference: null, error: "invalid" as const });
const unsupported = Object.freeze({ preference: null, error: "unsupported" as const });
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const entityId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200
  && !/[\s\u0000-\u001f\u007f]/u.test(value);
const integer = (value: unknown, minimum: number, maximum: number): value is number => typeof value === "number"
  && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const fits = (value: string) => value.length <= BOOKY_JOURNEY_PROGRESS_MAX_LENGTH
  && new TextEncoder().encode(value).length <= BOOKY_JOURNEY_PROGRESS_MAX_LENGTH;

/** Strict own data only. Unknown fields and accessors never become persisted state. */
function data(value: unknown, fields?: readonly string[]): Data | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length > 12 || fields && (keys.length !== fields.length
    || fields.some(key => !Object.prototype.hasOwnProperty.call(descriptors, key)))) return null;
  const result: Data = Object.create(null);
  for (const key of keys) {
    if (typeof key !== "string") return null;
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || !descriptor.enumerable) return null;
    result[key] = descriptor.value;
  }
  return result;
}
function array(value: unknown, maximum: number): readonly unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!integer(length, 0, maximum) || Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result: unknown[] = [];
  for (let index = 0; index < length; ++index) {
    const item = descriptors[String(index)];
    if (!item || !("value" in item) || !item.enumerable) return null;
    result.push(item.value);
  }
  return result;
}
function node(value: unknown): BookyJourneyProgressNode | null {
  const item = data(value);
  if (!item || !id(item.id) || item.screen !== "globe" && item.screen !== "collection") return null;
  if (item.kind === "activity") {
    const activity = data(item.activity, ["id", "version", "semanticChecksum"]);
    return Object.keys(item).length === 5 && item.screen === "globe" && item.entity === null && activity
      && id(activity.id) && integer(activity.version, 1, 1_000_000) && hash(activity.semanticChecksum)
      ? Object.freeze({ id: item.id, kind: "activity", screen: "globe", entity: null,
        activity: Object.freeze({ id: activity.id, version: activity.version, semanticChecksum: activity.semanticChecksum }) }) : null;
  }
  if (Object.keys(item).length !== 4) return null;
  if (item.kind === "checkpoint") return item.entity === null
    ? Object.freeze({ id: item.id, kind: "checkpoint", screen: item.screen, entity: null }) : null;
  const entity = data(item.entity);
  if (!entity || entity.kind !== item.kind || !entityId(entity.countryId)) return null;
  if (item.kind === "country" && item.screen === "globe" && Object.keys(entity).length === 2) {
    return Object.freeze({ id: item.id, kind: "country", screen: "globe",
      entity: Object.freeze({ kind: "country", countryId: entity.countryId }) });
  }
  if (!entityId(entity.writerId)) return null;
  if (item.kind === "writer" && item.screen === "globe" && Object.keys(entity).length === 3) {
    return Object.freeze({ id: item.id, kind: "writer", screen: "globe",
      entity: Object.freeze({ kind: "writer", countryId: entity.countryId, writerId: entity.writerId }) });
  }
  return item.kind === "work" && item.screen === "collection" && entityId(entity.workId) && Object.keys(entity).length === 4
    ? Object.freeze({ id: item.id, kind: "work", screen: "collection",
      entity: Object.freeze({ kind: "work", countryId: entity.countryId, writerId: entity.writerId, workId: entity.workId }) }) : null;
}
function recordId(fingerprint: string, journeyId: string, version: number): string {
  return contentTextHash(JSON.stringify([fingerprint, journeyId, version]));
}
function record(value: unknown): BookyJourneyProgressRecord | null {
  const item = data(value, ["recordId", "policyFingerprint", "journeyId", "journeyVersion", "locale", "definitionChecksum",
    "nodes", "acknowledgedNodeIds", "resumeNodeId"]);
  if (!item || !hash(item.recordId) || !hash(item.policyFingerprint) || !id(item.journeyId) || !integer(item.journeyVersion, 1, 1_000_000)
    || item.locale !== "ru" && item.locale !== "en" || !hash(item.definitionChecksum)
    || item.resumeNodeId !== null && !id(item.resumeNodeId)
    || item.recordId !== recordId(item.policyFingerprint, item.journeyId, item.journeyVersion)) return null;
  const rawNodes = array(item.nodes, BOOKY_JOURNEY_PROGRESS_MAX_NODES), rawAcknowledged = array(item.acknowledgedNodeIds, BOOKY_JOURNEY_PROGRESS_MAX_NODES);
  if (!rawNodes || rawNodes.length < 2 || !rawAcknowledged) return null;
  const nodes: BookyJourneyProgressNode[] = [];
  for (const raw of rawNodes) { const parsed = node(raw); if (!parsed) return null; nodes.push(parsed); }
  if (nodes[0].kind !== "country" || nodes[nodes.length - 1].kind !== "checkpoint"
    || new Set(nodes.map(item => item.id)).size !== nodes.length || rawAcknowledged.length > nodes.length
    || rawAcknowledged.some((acknowledged, index) => acknowledged !== nodes[index].id)
    || item.resumeNodeId !== (nodes[rawAcknowledged.length]?.id ?? null)) return null;
  return Object.freeze({ recordId: item.recordId, policyFingerprint: item.policyFingerprint, journeyId: item.journeyId,
    journeyVersion: item.journeyVersion, locale: item.locale, definitionChecksum: item.definitionChecksum,
    nodes: Object.freeze(nodes), acknowledgedNodeIds: Object.freeze(rawAcknowledged as string[]), resumeNodeId: item.resumeNodeId });
}

function decode(input: unknown): BookyJourneyProgressDecoded {
  try {
    let value = input;
    if (typeof value === "string") {
      if (!fits(value)) return unsupported;
      value = JSON.parse(value);
    }
    // Schema classification is independent of today's required fields.
    if (value && typeof value === "object" && !Array.isArray(value)
      && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
      const schema = Object.getOwnPropertyDescriptor(value, "schemaVersion");
      if (schema && "value" in schema && schema.enumerable && integer(schema.value, 2, Number.MAX_SAFE_INTEGER)) return unsupported;
    }
    const item = data(value, ["schemaVersion", "audience", "revision", "activeRecordId", "records"]);
    if (!item || item.schemaVersion !== 1 || item.audience !== "adult" || !integer(item.revision, 0, Number.MAX_SAFE_INTEGER)
      || item.activeRecordId !== null && !hash(item.activeRecordId)) return invalid;
    const rawRecords = array(item.records, BOOKY_JOURNEY_PROGRESS_MAX_RECORDS);
    if (!rawRecords) return invalid;
    const records: BookyJourneyProgressRecord[] = [];
    for (const raw of rawRecords) { const parsed = record(raw); if (!parsed) return invalid; records.push(parsed); }
    if (new Set(records.map(item => item.recordId)).size !== records.length
      || item.activeRecordId !== null && !records.some(record => record.recordId === item.activeRecordId)) return invalid;
    const preference = Object.freeze({ schemaVersion: 1 as const, audience: "adult" as const, revision: item.revision,
      activeRecordId: item.activeRecordId, records: Object.freeze(records) });
    return fits(JSON.stringify(preference)) ? Object.freeze({ preference, error: null }) : invalid;
  } catch { return invalid; }
}

/** Structural data only: unknown route versions remain intact, never migrated or admitted. */
export function parseBookyJourneyProgress(input: unknown): BookyJourneyProgressPreference | null { return decode(input).preference; }
/** null means authoritative absence; every error protects the original stored bytes. */
export function decodeBookyJourneyProgress(serialized: unknown): BookyJourneyProgressDecoded {
  return serialized === null ? Object.freeze({ preference: null, error: null })
    : typeof serialized === "string" ? decode(serialized) : invalid;
}
export function serializeBookyJourneyProgress(input: unknown): string | null {
  const preference = parseBookyJourneyProgress(input);
  return preference ? JSON.stringify(preference) : null;
}

/** Caller supplies a freshly admitted plan and confirmed policy. This projection
 * cannot verify either authority, navigate, migrate locale/version, or award progress.
 * No history is evicted: callers must handle codec limits explicitly. */
export function createBookyJourneyProgressRecord(policy: BookyReaderPolicy, admittedPlan: BookyJourneyPlan,
  acknowledgedNodeIds: readonly string[], resumeNodeId: string | null): BookyJourneyProgressRecord | null {
  try {
    const serializedPolicy = serializeBookyReaderPolicy(policy), candidate = data(admittedPlan);
    const hasOverview = !!candidate && Object.prototype.hasOwnProperty.call(candidate, "overview");
    const plan = candidate && data(candidate, ["id", "version", "locale", "title", "definitionChecksum", "nodes",
      ...(hasOverview ? ["overview"] : [])]);
    if (!serializedPolicy || !plan || !id(plan.id) || !integer(plan.version, 1, 1_000_000)
      || hasOverview && !parseBookyJourneyPlanOverview(plan.overview)) return null;
    const rawNodes = array(plan.nodes, BOOKY_JOURNEY_PROGRESS_MAX_NODES);
    if (!rawNodes) return null;
    const nodes = rawNodes.map(value => {
      const item = data(value);
      if (!item || !data(value, item.kind === "activity"
        ? ["id", "kind", "screen", "entity", "coordinates", "dialogue", "activity", "activityChoices"]
        : ["id", "kind", "screen", "entity", "coordinates", "dialogue"])) return null;
      const semantic = { id: item.id, kind: item.kind, screen: item.screen, entity: item.entity };
      if (item.kind !== "activity") return semantic;
      const activity = data(item.activity, ["spec", "definitionChecksum", "semanticChecksum", "correctChoiceId"]);
      const spec = activity && parseBookyJourneyActivity(activity.spec);
      if (!activity || !spec || getBookyJourneyActivityChecksum(spec) !== activity.definitionChecksum
        || !hash(activity.semanticChecksum) || !spec.choices.some(choice => choice.id === activity.correctChoiceId)) return null;
      return { ...semantic, activity: { id: spec.id, version: spec.version, semanticChecksum: activity.semanticChecksum } };
    });
    const fingerprint = contentTextHash(serializedPolicy);
    return record({ recordId: recordId(fingerprint, plan.id, plan.version), policyFingerprint: fingerprint,
      journeyId: plan.id, journeyVersion: plan.version, locale: plan.locale, definitionChecksum: plan.definitionChecksum,
      nodes, acknowledgedNodeIds, resumeNodeId });
  } catch { return null; }
}
