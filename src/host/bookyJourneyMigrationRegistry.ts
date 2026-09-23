import { getBookyJourneyChecksum, type BookyJourneyDefinition, type BookyJourneyPlan } from "./bookyJourney";
import { getBookyJourneyMigrationChecksum, resolveBookyJourneyMigration,
  type BookyJourneyMigration, type BookyJourneyMigrationReceipt } from "./bookyJourneyMigration";
import type { BookyJourneyMigrationContent } from "./bookyJourneyMigrationContent";
import type { BookyJourneyProgressRecord } from "./bookyJourneyProgress";
import type { BookyJourneyMigrationOffer } from "./bookyJourneyRuntime";
import type { BookyReaderPolicy } from "./bookyReaderPolicy";

export type BookyJourneyMigrationRegistry = Readonly<{
  /** The caller must freshly admit currentPlan; this registry grants no access. */
  resolve(savedRecord: BookyJourneyProgressRecord, currentPlan: BookyJourneyPlan,
    currentPolicy: BookyReaderPolicy | null, now: string): BookyJourneyMigrationOffer | null;
}>;
type Row = Record<string, unknown>;
type Candidate = Readonly<{
  migration: BookyJourneyMigration;
  checksum: string;
  historicalDefinition: BookyJourneyDefinition;
  receipts: readonly BookyJourneyMigrationReceipt[];
}>;
const emptyRegistry: BookyJourneyMigrationRegistry = Object.freeze({ resolve: () => null });
const row = (value: unknown, fields: string): value is Row => !!value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(" ") === fields.split(" ").sort().join(" ");
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const definitionKey = (id: string, version: number, locale: string) => JSON.stringify([id, version, locale]);

/** Copy bounded own data once, without invoking accessors, toJSON or retaining
 * owner objects. Validation and resolution only read this frozen inventory. */
function snapshot(input: unknown): unknown {
  let count = 0, characters = 0;
  const visiting = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++count > 100_000 || depth > 16) throw new Error("bounds");
    if (typeof value === "string") {
      if (value.length > 8192 || (characters += value.length) > 1_000_000) throw new Error("bounds");
      return value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object" || visiting.has(value)) throw new Error("shape");
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("prototype");
    visiting.add(value);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(value), names = Reflect.ownKeys(descriptors);
      if (names.some(name => typeof name !== "string" || name.length > 96)) throw new Error("keys");
      if (array) {
        const length: unknown = descriptors.length?.value;
        if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > 128
          || names.length !== length + 1) throw new Error("array");
        return Object.freeze(Array.from({ length }, (_, index) => {
          const descriptor = descriptors[String(index)];
          if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("accessor");
          return visit(descriptor.value, depth + 1);
        }));
      }
      if (names.length > 64) throw new Error("keys");
      const result: Row = Object.create(null);
      for (const name of names as string[]) {
        const descriptor = descriptors[name];
        if (!descriptor.enumerable || !("value" in descriptor)) throw new Error("accessor");
        result[name] = visit(descriptor.value, depth + 1);
      }
      return Object.freeze(result);
    } finally { visiting.delete(value); }
  }
  try { return visit(input, 0); } catch { return undefined; }
}
function own(value: unknown, name: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor?.enumerable && "value" in descriptor ? descriptor.value : undefined;
}
function receiptValid(value: unknown): value is BookyJourneyMigrationReceipt {
  return row(value, "id checksum reviewer reviewedAt") && key(value.id) && hash(value.checksum)
    && typeof value.reviewer === "string" && value.reviewer.length > 0 && value.reviewer.length <= 160
    && value.reviewer.trim() === value.reviewer && !/[\u0000-\u001f\u007f]/u.test(value.reviewer) && timestamp(value.reviewedAt);
}

/** Independent version mappings remain inert until matched to a saved record,
 * a freshly admitted target plan, current confirmed policy and review time. */
export function createBookyJourneyMigrationRegistry(input: unknown): BookyJourneyMigrationRegistry {
  try {
    const copied = snapshot(input);
    if (!row(copied, "historicalDefinitions migrations approvedMigrationReceipts")
      || !Object.values(copied).every(value => Array.isArray(value) && value.length <= 128)) return emptyRegistry;
    const content = copied as unknown as BookyJourneyMigrationContent;
    const definitions = new Map<string, { definition: BookyJourneyDefinition; checksum: string }>();
    for (const definition of content.historicalDefinitions) {
      const checksum = getBookyJourneyChecksum(definition);
      if (!checksum || definition.audience !== "adult") return emptyRegistry;
      const id = definitionKey(definition.id, definition.version, definition.locale);
      if (definitions.has(id)) return emptyRegistry;
      definitions.set(id, { definition, checksum });
    }
    const migrations = new Map<string, { migration: BookyJourneyMigration; checksum: string; historicalDefinition: BookyJourneyDefinition }>();
    const pairs = new Set<string>();
    for (const migration of content.migrations) {
      const checksum = getBookyJourneyMigrationChecksum(migration);
      if (!checksum || migrations.has(migration.id)) return emptyRegistry;
      const origin = definitions.get(definitionKey(migration.journeyId, migration.fromVersion, migration.locale));
      if (!origin || origin.checksum !== migration.fromDefinitionChecksum) return emptyRegistry;
      const pair = JSON.stringify([migration.journeyId, migration.locale, migration.fromVersion, migration.fromDefinitionChecksum,
        migration.toVersion, migration.toDefinitionChecksum]);
      if (pairs.has(pair)) return emptyRegistry;
      pairs.add(pair); migrations.set(migration.id, { migration, checksum, historicalDefinition: origin.definition });
    }
    const receipts = new Map<string, BookyJourneyMigrationReceipt>();
    for (const receipt of content.approvedMigrationReceipts) {
      if (!receiptValid(receipt) || receipts.has(receipt.id) || migrations.get(receipt.id)?.checksum !== receipt.checksum) return emptyRegistry;
      receipts.set(receipt.id, receipt);
    }
    const candidates: readonly Candidate[] = Object.freeze([...migrations.values()].map(candidate => Object.freeze({
      ...candidate, receipts: Object.freeze(receipts.has(candidate.migration.id) ? [receipts.get(candidate.migration.id)!] : []),
    })));
    return Object.freeze({
      resolve(savedRecord: BookyJourneyProgressRecord, currentPlan: BookyJourneyPlan, currentPolicy: BookyReaderPolicy | null,
        now: string): BookyJourneyMigrationOffer | null {
        try {
          // Read only primitive own descriptors to select candidates; the pure
          // model snapshots and validates the complete caller-owned context.
          const id = own(savedRecord, "journeyId"), locale = own(savedRecord, "locale");
          const fromVersion = own(savedRecord, "journeyVersion"), fromChecksum = own(savedRecord, "definitionChecksum");
          if (id !== own(currentPlan, "id") || locale !== own(currentPlan, "locale")) return null;
          const toVersion = own(currentPlan, "version"), toChecksum = own(currentPlan, "definitionChecksum");
          let offer: BookyJourneyMigrationOffer | null = null;
          for (const candidate of candidates) {
            const migration = candidate.migration;
            if (migration.journeyId !== id || migration.locale !== locale || migration.fromVersion !== fromVersion
              || migration.fromDefinitionChecksum !== fromChecksum || migration.toVersion !== toVersion
              || migration.toDefinitionChecksum !== toChecksum || candidate.receipts.length !== 1) continue;
            const resolved = resolveBookyJourneyMigration({ savedRecord, historicalDefinition: candidate.historicalDefinition,
              currentPlan, currentPolicy, migration, approvedMigrationReceipts: candidate.receipts, now });
            if (!resolved) continue;
            if (offer) return null;
            offer = Object.freeze({ migrationId: migration.id, migrationChecksum: candidate.checksum,
              preservedRecord: resolved.preservedRecord, targetRecord: resolved.targetRecord });
          }
          return offer;
        } catch { return null; }
      },
    });
  } catch { return emptyRegistry; }
}
