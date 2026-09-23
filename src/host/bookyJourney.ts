import { contentRecordHash } from "../planet/contentExportHash";
import { selectWriterDisplayName } from "../data/bookLocalization";
import type { ContentEntityRef } from "../planet/contentExportTypes";
import type { Country, BookArchiveEntry } from "../planet/types";
import type { BookyDialogueLocale, BookyDialogueReadingLevel, BookyDialogueRecord, BookyDialogueRegistry } from "./bookyDialogueRegistry";
import { getBookyJourneyActivityChecksum, resolveBookyJourneyActivity,
  type BookyJourneyActivitySpec, type BookyJourneyActivityResolved } from "./bookyJourneyActivity";

export type BookyJourneyPrerequisite = Readonly<{ id: string; version: number }>;
export type BookyJourneyOverview = Readonly<{
  /** Reviewed localized copy; trimmed plain text, 1–800 characters. */
  description: string;
  /** Explicit editorial estimate, 1–1440 whole minutes; never inferred from nodes. */
  estimatedDurationMinutes: number;
}>;
export type BookyJourneyPlanOverview = Readonly<BookyJourneyOverview & {
  /** All exact current node availability entries permit offline use. This is
   * not a cache audit, downloaded-route receipt or guarantee for a later session. */
  offlineAvailable: boolean;
}>;
export type BookyJourneyNode = Readonly<{
  id: string;
  entity: Readonly<ContentEntityRef> | null;
  kind: "country" | "writer" | "work" | "checkpoint" | "activity";
  screen: "globe" | "collection";
  dialogue: Readonly<{ id: string; version: number; contentChecksum: string }>;
  /** Present only for activity nodes; old navigation node fields stay exact. */
  activity?: BookyJourneyActivitySpec;
}>;
export type BookyJourneyDefinition = Readonly<{
  schemaVersion: 1;
  id: string;
  version: number;
  locale: BookyDialogueLocale;
  audience: "adult" | "child";
  ageRange: Readonly<{ min: number; max: number }>;
  readingLevel: BookyDialogueReadingLevel;
  title: string;
  /** Optional for byte-compatible legacy definitions; covered by their checksum. */
  overview?: BookyJourneyOverview;
  prerequisites: readonly BookyJourneyPrerequisite[];
  nodes: readonly BookyJourneyNode[];
}>;
export type BookyJourneyApproval = Readonly<{
  id: string; version: number; locale: BookyDialogueLocale;
  definitionChecksum: string; reviewer: string; reviewedAt: string;
}>;
export type BookyJourneyContext = Readonly<{
  audience: "adult" | "child";
  age: number;
  locale: BookyDialogueLocale;
  readingLevel: BookyDialogueReadingLevel;
  now: string;
  connectivity: "online" | "offline" | "unknown";
  completedPrerequisites: readonly BookyJourneyPrerequisite[];
  availability: readonly Readonly<{ nodeId: string; locale: BookyDialogueLocale; dialogueContentChecksum: string; available: boolean; offlineAvailable: boolean }>[];
}>;
export type BookyJourneyTrust = Readonly<{
  /** Current version of the requested route. Prerequisite receipts below must
   * match the definition's explicit version; they are never inferred/migrated. */
  currentVersions: readonly BookyJourneyPrerequisite[];
  approvedReviews: readonly BookyJourneyApproval[];
  dialogueRegistry: BookyDialogueRegistry;
  /** Already loaded, policy-filtered public views. Never pass the pre-quarantine
   * archive or use this membership check as child/editorial authorization. */
  publicCountries: readonly Country[];
  publicBooks: readonly BookArchiveEntry[];
}>;
export type BookyJourneyPlan = Readonly<{
  id: string; version: number; locale: BookyDialogueLocale; title: string; definitionChecksum: string;
  overview?: BookyJourneyPlanOverview;
  nodes: readonly Readonly<{
    id: string; kind: BookyJourneyNode["kind"]; screen: BookyJourneyNode["screen"]; entity: Readonly<ContentEntityRef> | null;
    coordinates: readonly [number, number] | null; dialogue: BookyDialogueRecord;
    activity?: BookyJourneyActivityResolved;
    activityChoices?: readonly Readonly<{ id: string; label: string }>[];
  }>[];
}>;

type Row = Record<string, unknown>;
const key = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9._:-]{0,95}$/.test(value);
const entityId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200 && !/[\s\u0000-\u001f\u007f]/u.test(value);
const hash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const choice = (value: unknown, allowed: readonly string[]) => typeof value === "string" && allowed.includes(value);
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value);
const row = (value: unknown, fields: string): value is Row => !!value && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).sort().join(" ") === fields.split(" ").sort().join(" ");
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const locale = (value: unknown) => choice(value, ["ru", "en"]);
const level = (value: unknown) => choice(value, ["plain", "developing", "fluent"]);
function uniqueRows(value: unknown, max: number, valid: (item: unknown) => boolean, identity = "id"): value is Row[] {
  return Array.isArray(value) && value.length <= max && value.every(valid)
    && new Set(value.map(item => (item as Row)[identity])).size === value.length;
}

/** Snapshot before hashing or calling injected services. Never retain caller
 * arrays, execute accessors/toJSON, or accept unbounded/deep candidate input. */
function snapshot(input: unknown): unknown {
  let nodes = 0, characters = 0;
  const active = new Set<object>();
  function visit(value: unknown, depth: number): unknown {
    if (++nodes > 8192 || depth > 10) throw new Error("bounds");
    if (typeof value === "string") {
      characters += value.length;
      if (value.length > 2048 || characters > 131072) throw new Error("bounds");
      return value;
    }
    if (value === null || typeof value === "boolean" || typeof value === "number" && Number.isFinite(value)) return value;
    if (!value || typeof value !== "object" || active.has(value)) throw new Error("shape");
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new Error("prototype");
    active.add(value);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
      if (keys.some(name => typeof name !== "string" || name.length > 64)) throw new Error("keys");
      if (array) {
        const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
        if (!integer(length, 0, 128) || keys.length !== length + 1) throw new Error("array");
        return Object.freeze(Array.from({ length }, (_, index) => {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("accessor");
          return visit(descriptor.value, depth + 1);
        }));
      }
      if (keys.length > 16) throw new Error("keys");
      const copy: Row = Object.create(null);
      for (const name of keys as string[]) {
        const descriptor = descriptors[name];
        if (!("value" in descriptor) || !descriptor.enumerable) throw new Error("accessor");
        copy[name] = visit(descriptor.value, depth + 1);
      }
      return Object.freeze(copy);
    } finally { active.delete(value); }
  }
  try { return visit(input, 0); } catch { return undefined; }
}

function prerequisite(value: unknown): value is BookyJourneyPrerequisite {
  return row(value, "id version") && key(value.id) && integer(value.version, 1, 1_000_000);
}
function entityRef(value: unknown): value is ContentEntityRef {
  if (!value || typeof value !== "object") return false;
  const v = value as Row;
  return v.kind === "country" ? row(v, "kind countryId") && entityId(v.countryId)
    : v.kind === "writer" ? row(v, "kind countryId writerId") && entityId(v.countryId) && entityId(v.writerId)
    : v.kind === "work" && row(v, "kind countryId writerId workId") && entityId(v.countryId) && entityId(v.writerId) && entityId(v.workId);
}
/** Identity uses the existing canonical tuple, never a title or locale label. */
export function bookyJourneyEntityId(ref: ContentEntityRef): string {
  return JSON.stringify(ref.kind === "country" ? [ref.kind, ref.countryId]
    : ref.kind === "writer" ? [ref.kind, ref.countryId, ref.writerId] : [ref.kind, ref.countryId, ref.writerId, ref.workId]);
}
/** Activity dialogue approval binds the exact authored task as well as its
 * journey/node. The compact context fits the existing registry's 96-char key. */
export function bookyJourneyDialogueContext(journeyId: string, node: BookyJourneyNode): string | null {
  if (!key(journeyId) || !key(node.id)) return null;
  if (node.kind !== "activity") return `${journeyId}:${node.id}`;
  const activityChecksum = getBookyJourneyActivityChecksum(node.activity);
  return activityChecksum ? `activity:${contentRecordHash({ journeyId, nodeId: node.id, activityChecksum })}` : null;
}
function overviewValid(value: unknown): value is BookyJourneyOverview {
  return row(value, "description estimatedDurationMinutes") && text(value.description, 800)
    && integer(value.estimatedDurationMinutes, 1, 1440);
}
/** Shared shape check for consumers of an already admitted compiled plan.
 * This parser validates data only; it never grants review or offline authority. */
export function parseBookyJourneyPlanOverview(input: unknown): BookyJourneyPlanOverview | null {
  const value = snapshot(input);
  return row(value, "description estimatedDurationMinutes offlineAvailable") && text(value.description, 800)
    && integer(value.estimatedDurationMinutes, 1, 1440) && typeof value.offlineAvailable === "boolean"
    ? Object.freeze({ description: value.description, estimatedDurationMinutes: value.estimatedDurationMinutes,
      offlineAvailable: value.offlineAvailable }) : null;
}
function definitionValid(value: unknown): value is BookyJourneyDefinition {
  const hasOverview = !!value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "overview");
  if (!row(value, `schemaVersion id version locale audience ageRange readingLevel title prerequisites nodes${hasOverview ? " overview" : ""}`) || value.schemaVersion !== 1
    || !key(value.id) || !integer(value.version, 1, 1_000_000) || !locale(value.locale) || !choice(value.audience, ["adult", "child"])
    || !row(value.ageRange, "min max") || !integer(value.ageRange.min, 0, 120) || !integer(value.ageRange.max, Number(value.ageRange.min), 120)
    || !level(value.readingLevel) || !text(value.title, 200) || hasOverview && !overviewValid(value.overview)
    || !uniqueRows(value.prerequisites, 16, prerequisite)
    || !uniqueRows(value.nodes, 32, node => !!node && typeof node === "object"
      && row(node, (node as Row).kind === "activity" ? "id entity kind screen dialogue activity" : "id entity kind screen dialogue") && key(node.id)
      && choice(node.kind, ["country", "writer", "work", "checkpoint", "activity"]) && choice(node.screen, ["globe", "collection"])
      && (node.kind === "checkpoint" || node.screen === (node.kind === "work" ? "collection" : "globe"))
      && (node.kind === "checkpoint" || node.kind === "activity" ? node.entity === null : entityRef(node.entity) && node.entity.kind === node.kind)
      && (node.kind !== "activity" || getBookyJourneyActivityChecksum(node.activity) !== null)
      && row(node.dialogue, "id version contentChecksum") && key(node.dialogue.id) && integer(node.dialogue.version, 1, 1_000_000)
      && hash(node.dialogue.contentChecksum)) || value.nodes.length < 2) return false;
  return value.nodes[0].kind === "country" && value.nodes[value.nodes.length - 1].kind === "checkpoint"
    && value.prerequisites.every(item => item.id !== value.id)
    && (value.audience === "adult" ? value.ageRange.min >= 18 : value.ageRange.max <= 17);
}
function approval(value: unknown): value is BookyJourneyApproval {
  return row(value, "id version locale definitionChecksum reviewer reviewedAt") && key(value.id) && integer(value.version, 1, 1_000_000)
    && locale(value.locale) && hash(value.definitionChecksum) && text(value.reviewer, 160) && timestamp(value.reviewedAt);
}
function contextValid(value: unknown): value is BookyJourneyContext {
  return row(value, "audience age locale readingLevel now connectivity completedPrerequisites availability")
    && value.audience === "adult" && integer(value.age, 18, 120) && locale(value.locale) && level(value.readingLevel) && timestamp(value.now)
    && choice(value.connectivity, ["online", "offline", "unknown"]) && uniqueRows(value.completedPrerequisites, 128, prerequisite)
    && uniqueRows(value.availability, 32, item => row(item, "nodeId locale dialogueContentChecksum available offlineAvailable") && key(item.nodeId)
      && locale(item.locale) && hash(item.dialogueContentChecksum) && typeof item.available === "boolean" && typeof item.offlineAvailable === "boolean", "nodeId");
}

export function getBookyJourneyChecksum(input: unknown): string | null {
  const definition = snapshot(input);
  return definitionValid(definition) ? contentRecordHash(definition) : null;
}

function activityChoices(activity: BookyJourneyActivityResolved, trust: BookyJourneyTrust, locale: BookyDialogueLocale) {
  const labels = new Set<string>();
  const choices: Readonly<{ id: string; label: string }>[] = [];
  for (const choice of activity.spec.choices) {
    const country = trust.publicCountries.find(country => country.id === choice.writer.countryId);
    const writer = country?.writers.find(writer => writer.id === choice.writer.writerId);
    if (!writer) return null;
    const names: { id: string; name?: string; fullName?: string } = { id: choice.writer.writerId };
    for (const field of ["name", "fullName"] as const) {
      const descriptor = Object.getOwnPropertyDescriptor(writer, field);
      if (!descriptor) continue;
      if (!descriptor.enumerable || !("value" in descriptor)) return null;
      if (descriptor.value === undefined) continue;
      if (typeof descriptor.value !== "string" || descriptor.value.length > 200 || /[\u0000-\u001f\u007f]/u.test(descriptor.value)) return null;
      names[field] = descriptor.value;
    }
    const label = selectWriterDisplayName(names, locale, "");
    const normalized = label.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(locale);
    if (!normalized || labels.has(normalized)) return null;
    labels.add(normalized); choices.push(Object.freeze({ id: choice.id, label }));
  }
  return Object.freeze(choices);
}

/** Pure admission of an entire ordered plan. No navigation, catalog creation,
 * progress mutation, audio, child authorization or production journey seeds. */
export function compileBookyJourney(input: unknown, inputContext: unknown, trust: BookyJourneyTrust): BookyJourneyPlan | null {
  try {
    const definition = snapshot(input), context = snapshot(inputContext);
    const policy = snapshot({ currentVersions: trust.currentVersions, approvedReviews: trust.approvedReviews });
    if (!definitionValid(definition) || !contextValid(context) || definition.audience !== "adult"
      || definition.locale !== context.locale || definition.readingLevel !== context.readingLevel
      || context.age < definition.ageRange.min || context.age > definition.ageRange.max || !row(policy, "currentVersions approvedReviews")
      || !uniqueRows(policy.currentVersions, 128, prerequisite) || !Array.isArray(policy.approvedReviews) || policy.approvedReviews.length > 128
      || !policy.approvedReviews.every(approval)) return null;
    const checksum = contentRecordHash(definition);
    if (!policy.currentVersions.some(item => item.id === definition.id && item.version === definition.version)
      || !policy.approvedReviews.some(item => item.id === definition.id && item.version === definition.version && item.locale === definition.locale
        && item.definitionChecksum === checksum && item.reviewedAt <= context.now)
      || !definition.prerequisites.every(required => context.completedPrerequisites.some(done => done.id === required.id && done.version === required.version))) return null;
    if (!Array.isArray(trust.publicCountries) || trust.publicCountries.length > 256 || !Array.isArray(trust.publicBooks)
      || trust.publicBooks.length > 50_000 || context.availability.length !== definition.nodes.length) return null;
    const nodes: BookyJourneyPlan["nodes"][number][] = [];
    let offlineAvailable = true;
    let activeCountry: string | null = null, activeWriter: string | null = null;
    for (const node of definition.nodes) {
      const available = context.availability.find(item => item.nodeId === node.id);
      if (!available || available.locale !== context.locale || available.dialogueContentChecksum !== node.dialogue.contentChecksum || !available.available
        || context.connectivity !== "online" && !available.offlineAvailable) return null;
      offlineAvailable = offlineAvailable && available.offlineAvailable;
      const ref = node.entity;
      let coordinates: readonly [number, number] | null = null;
      if (ref) {
        const countries = (trust.publicCountries as readonly Country[]).filter(country => country.id === ref.countryId);
        if (countries.length !== 1) return null;
        const country = countries[0];
        if (ref.kind === "country") {
          const position = country.coordinates;
          if (Array.isArray(position) && position.length !== 2) return null;
          const lat = Array.isArray(position) ? position[0] : position?.lat;
          const lng = Array.isArray(position) ? position[1] : position?.lng;
          if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)
            || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
          coordinates = Object.freeze([lat, lng]);
          activeCountry = ref.countryId; activeWriter = null;
        } else {
          if (!Array.isArray(country.writers) || country.writers.filter(writer => writer.id === ref.writerId).length !== 1
            || activeCountry !== ref.countryId) return null;
          if (ref.kind === "writer") activeWriter = ref.writerId;
          else {
            const books = (trust.publicBooks as readonly BookArchiveEntry[]).filter(book => book.countryId === ref.countryId && book.writerId === ref.writerId && book.id === ref.workId);
            if (activeWriter !== ref.writerId || books.length !== 1 || !choice(books[0].editorial?.status, ["reviewed", "verified"])) return null;
          }
        }
      }
      const activity = node.kind === "activity" ? resolveBookyJourneyActivity(node.activity, trust) : null;
      if (node.kind === "activity" && !activity) return null;
      const choices = activity ? activityChoices(activity, trust, context.locale) : null;
      if (activity && !choices) return null;
      const dialogueContext = bookyJourneyDialogueContext(definition.id, node);
      if (!dialogueContext) return null;
      const entityIds = activity ? [...new Set([activity.spec.targetWork, ...activity.spec.choices.map(choice => choice.writer)]
        .map(bookyJourneyEntityId))] : ref ? [bookyJourneyEntityId(ref)] : [];
      const dialogue = trust.dialogueRegistry.resolve({ id: node.dialogue.id, locale: context.locale, audience: "adult", age: context.age,
        readingLevel: context.readingLevel, intent: activity ? "activity" : "navigation", screen: node.screen, context: dialogueContext,
        entityIds, now: context.now });
      if (!dialogue || dialogue.payload.version !== node.dialogue.version || dialogue.review.contentChecksum !== node.dialogue.contentChecksum) return null;
      nodes.push(Object.freeze({ id: node.id, kind: node.kind, screen: node.screen, entity: ref, coordinates, dialogue,
        ...(activity ? { activity, activityChoices: choices! } : {}) }));
    }
    // Any injected dialogue callback, including a later checkpoint, may revoke
    // a relation or label. Never retain an earlier answer from changed input.
    for (const node of nodes) if (node.activity) {
      const current = resolveBookyJourneyActivity(node.activity.spec, trust);
      if (!current || current.semanticChecksum !== node.activity.semanticChecksum
        || JSON.stringify(activityChoices(current, trust, context.locale)) !== JSON.stringify(node.activityChoices)) return null;
    }
    return Object.freeze({ id: definition.id, version: definition.version, locale: definition.locale, title: definition.title,
      definitionChecksum: checksum, nodes: Object.freeze(nodes),
      ...(definition.overview ? { overview: Object.freeze({ ...definition.overview, offlineAvailable }) } : {}) });
  } catch { return null; }
}
