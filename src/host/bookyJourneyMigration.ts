import { contentRecordHash, contentTextHash } from "../planet/contentExportHash";
import { getBookyJourneyChecksum, parseBookyJourneyPlanOverview, type BookyJourneyDefinition, type BookyJourneyPlan } from "./bookyJourney";
import { getBookyJourneyFactChecksum, parseBookyJourneyFact } from "./bookyJourneyFact";
import { parseBookyJourneyActivity } from "./bookyJourneyActivity";
import { createBookyJourneyProgressRecord, DEFAULT_BOOKY_JOURNEY_PROGRESS, parseBookyJourneyProgress,
  type BookyJourneyProgressNode, type BookyJourneyProgressRecord } from "./bookyJourneyProgress";
import { parseBookyReaderPolicy, serializeBookyReaderPolicy, type BookyReaderPolicy } from "./bookyReaderPolicy";

export type BookyJourneyMigration = Readonly<{
  schemaVersion: 1;
  id: string;
  journeyId: string;
  locale: "ru" | "en";
  fromVersion: number;
  fromDefinitionChecksum: string;
  toVersion: number;
  toDefinitionChecksum: string;
  /** Every historical node has an explicit equivalent, or null if retired. */
  nodeMap: Readonly<Record<string, string | null>>;
  safeCheckpointId: string | null;
}>;
export type BookyJourneyMigrationReceipt = Readonly<{ id: string; checksum: string; reviewer: string; reviewedAt: string }>;
export type BookyJourneyMigrationInput = Readonly<{
  savedRecord: BookyJourneyProgressRecord;
  historicalDefinition: BookyJourneyDefinition;
  /** Freshly admitted by the host. This pure boundary cannot replace admission. */
  currentPlan: BookyJourneyPlan;
  currentPolicy: BookyReaderPolicy;
  migration: BookyJourneyMigration;
  approvedMigrationReceipts: readonly BookyJourneyMigrationReceipt[];
  now: string;
}>;
export type BookyJourneyMigrationResult = Readonly<{
  preservedRecord: BookyJourneyProgressRecord;
  targetRecord: BookyJourneyProgressRecord;
}>;

type Row = Record<string, unknown>;
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const version = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 1_000_000;
const row = (value: unknown, fields: string): value is Row => !!value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(" ") === fields.split(" ").sort().join(" ");
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

/** Bounded immutable snapshot before hashing or reading supplied properties.
 * Allows at most 32K values, depth 16, 128 array entries, 64 object fields,
 * 8192 characters per string and 256K string characters in total. */
function snapshot(input: unknown): unknown {
  let count = 0, characters = 0;
  const ancestors = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++count > 32_768 || depth > 16) throw Error("bounds");
    if (typeof value === "string") {
      characters += value.length;
      if (value.length > 8192 || characters > 262_144) throw Error("bounds");
      return value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object" || ancestors.has(value)) throw Error("shape");
    const isArray = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw Error("prototype");
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.some(name => typeof name !== "string" || name.length > 96)) throw Error("keys");
    ancestors.add(value);
    try {
      if (isArray) {
        const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
        if (!Number.isInteger(length) || length < 0 || length > 128 || keys.length !== length + 1) throw Error("array");
        return Object.freeze(Array.from({ length }, (_, index) => {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw Error("accessor");
          return visit(descriptor.value, depth + 1);
        }));
      }
      if (keys.length > 64) throw Error("fields");
      const result: Row = Object.create(null);
      for (const name of keys as string[]) {
        const descriptor = descriptors[name];
        if (!("value" in descriptor) || !descriptor.enumerable) throw Error("accessor");
        result[name] = visit(descriptor.value, depth + 1);
      }
      return Object.freeze(result);
    } finally { ancestors.delete(value); }
  }
  try { return visit(input, 0); } catch { return undefined; }
}
function validMigration(value: unknown): value is BookyJourneyMigration {
  if (!row(value, "schemaVersion id journeyId locale fromVersion fromDefinitionChecksum toVersion toDefinitionChecksum nodeMap safeCheckpointId")
    || value.schemaVersion !== 1 || !key(value.id) || !key(value.journeyId) || value.locale !== "ru" && value.locale !== "en"
    || !version(value.fromVersion) || !version(value.toVersion) || value.toVersion <= value.fromVersion
    || !hash(value.fromDefinitionChecksum) || !hash(value.toDefinitionChecksum)
    || value.safeCheckpointId !== null && !key(value.safeCheckpointId)
    || !value.nodeMap || typeof value.nodeMap !== "object" || Array.isArray(value.nodeMap)) return false;
  const entries = Object.entries(value.nodeMap);
  return entries.length >= 2 && entries.length <= 32 && entries.every(([id, target]) => key(id) && (target === null || key(target)));
}
function validReceipt(value: unknown): value is BookyJourneyMigrationReceipt {
  return row(value, "id checksum reviewer reviewedAt") && key(value.id) && hash(value.checksum) && timestamp(value.reviewedAt)
    && typeof value.reviewer === "string" && value.reviewer.trim() === value.reviewer && value.reviewer.length > 0
    && value.reviewer.length <= 160 && !/[\u0000-\u001f\u007f]/u.test(value.reviewer);
}
const entitySemantic = (node: Pick<BookyJourneyProgressNode, "kind" | "screen" | "entity">) => {
  const ref = node.entity;
  return JSON.stringify([node.kind, node.screen, ref === null ? null : ref.kind === "country" ? [ref.kind, ref.countryId]
    : ref.kind === "writer" ? [ref.kind, ref.countryId, ref.writerId] : [ref.kind, ref.countryId, ref.writerId, ref.workId]]);
};
const semantic = (node: BookyJourneyProgressNode) => JSON.stringify([entitySemantic(node),
  node.kind === "activity" ? node.activity : node.kind === "sourced-fact" ? node.fact : null]);
function matchesHistoricalNode(node: BookyJourneyDefinition["nodes"][number], saved: BookyJourneyProgressNode): boolean {
  if (node.id !== saved.id || entitySemantic(node) !== entitySemantic(saved)) return false;
  if (node.kind === "sourced-fact") {
    const spec = parseBookyJourneyFact(node.fact);
    return !!spec && !!node.entity && saved.fact?.id === spec.id && saved.fact.version === spec.version
      && saved.fact.semanticChecksum === getBookyJourneyFactChecksum(spec, node.entity, node.screen);
  }
  if (node.kind !== "activity") return true;
  // The historical definition binds the authored task, not a current factual
  // answer. Only saved/current resolved fingerprints can transfer an answer.
  const spec = parseBookyJourneyActivity(node.activity);
  return !!spec && saved.activity?.id === spec.id && saved.activity.version === spec.version;
}
export function getBookyJourneyMigrationChecksum(input: unknown): string | null {
  const value = snapshot(input);
  return validMigration(value) ? contentRecordHash(value) : null;
}

/** A single explicit version advance, never navigation, reading proof or review
 * creation. Caller preserves the old record and re-resolves current admission
 * at the gesture. Locale changes are a separate existing runtime operation.
 * Prefix-incompatible mappings fail without manufacturing acknowledgements. */
export function resolveBookyJourneyMigration(input: unknown): BookyJourneyMigrationResult | null {
  try {
    const value = snapshot(input);
    if (!row(value, "savedRecord historicalDefinition currentPlan currentPolicy migration approvedMigrationReceipts now")
      || !timestamp(value.now) || !validMigration(value.migration) || !Array.isArray(value.approvedMigrationReceipts)
      || value.approvedMigrationReceipts.length > 128 || !value.approvedMigrationReceipts.every(validReceipt)) return null;
    if (new Set(value.approvedMigrationReceipts.map(receipt => receipt.id)).size !== value.approvedMigrationReceipts.length) return null;
    const migration = value.migration, checksum = contentRecordHash(migration), now = value.now;
    if (!value.approvedMigrationReceipts.some(receipt => receipt.id === migration.id && receipt.checksum === checksum
      && receipt.reviewedAt <= now)) return null;
    const policy = parseBookyReaderPolicy(value.currentPolicy), serializedPolicy = serializeBookyReaderPolicy(policy);
    const saved = parseBookyJourneyProgress({ ...DEFAULT_BOOKY_JOURNEY_PROGRESS, records: [value.savedRecord] })?.records[0];
    if (!policy || !serializedPolicy || policy.confirmedAt > value.now || !saved
      || saved.policyFingerprint !== contentTextHash(serializedPolicy)
      || saved.journeyId !== migration.journeyId || saved.journeyVersion !== migration.fromVersion
      || saved.locale !== migration.locale || saved.definitionChecksum !== migration.fromDefinitionChecksum
      || getBookyJourneyChecksum(value.historicalDefinition) !== migration.fromDefinitionChecksum) return null;
    const historical = value.historicalDefinition as BookyJourneyDefinition;
    if (historical.id !== saved.journeyId || historical.version !== saved.journeyVersion || historical.locale !== saved.locale
      || historical.nodes.length !== saved.nodes.length
      || historical.nodes.some((node, index) => !matchesHistoricalNode(node, saved.nodes[index]))) return null;
    const plan = value.currentPlan;
    const hasOverview = !!plan && typeof plan === "object" && Object.prototype.hasOwnProperty.call(plan, "overview");
    if (!row(plan, `id version locale title definitionChecksum nodes${hasOverview ? " overview" : ""}`)
      || hasOverview && !parseBookyJourneyPlanOverview(plan.overview) || plan.id !== migration.journeyId
      || plan.version !== migration.toVersion || plan.locale !== migration.locale || plan.definitionChecksum !== migration.toDefinitionChecksum
      || !Array.isArray(plan.nodes) || !row(plan.nodes[0], "id kind screen entity coordinates dialogue") || !key(plan.nodes[0].id)) return null;
    const currentPlan = plan as unknown as BookyJourneyPlan;
    const current = createBookyJourneyProgressRecord(policy, currentPlan, [], plan.nodes[0].id);
    if (!current || Object.keys(migration.nodeMap).length !== saved.nodes.length
      || saved.nodes.some(node => !Object.prototype.hasOwnProperty.call(migration.nodeMap, node.id))) return null;
    const targets = Object.values(migration.nodeMap).filter((id): id is string => id !== null);
    if (new Set(targets).size !== targets.length || targets.some(id => !current.nodes.some(node => node.id === id))) return null;
    const checkpoint = current.nodes.find(node => node.id === migration.safeCheckpointId);
    if (migration.safeCheckpointId !== null && checkpoint?.kind !== "checkpoint") return null;
    const acknowledged: string[] = [];
    for (const id of saved.acknowledgedNodeIds) {
      const mapped = migration.nodeMap[id];
      if (mapped === null) continue;
      const source = saved.nodes.find(node => node.id === id)!, target = current.nodes.find(node => node.id === mapped)!;
      if (semantic(source) !== semantic(target) || current.nodes[acknowledged.length]?.id !== mapped) return null;
      acknowledged.push(mapped);
    }
    const nextId = current.nodes[acknowledged.length]?.id ?? null;
    const mappedCursor = saved.resumeNodeId === null ? null : migration.nodeMap[saved.resumeNodeId];
    if (nextId === null) {
      if (saved.resumeNodeId !== null) return null;
    } else if (mappedCursor !== null) {
      if (mappedCursor !== nextId) return null;
    } else if (!checkpoint || checkpoint.id !== nextId) return null;
    const targetRecord = createBookyJourneyProgressRecord(policy, currentPlan, acknowledged, nextId);
    return targetRecord ? Object.freeze({ preservedRecord: saved, targetRecord }) : null;
  } catch { return null; }
}
