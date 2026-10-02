import { isChildExactAge } from "./childProfile";

/** Entity boundaries from V12 child specification 11 and age-policy matrix 62. */
export const CHILD_ENTITY_KINDS = Object.freeze([
  "country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz",
  "narration", "image", "animation", "background", "skin", "stand", "accessory", "search-result",
  "recommendation", "favorite", "recent", "offline-package", "deep-link", "external-link", "store-preview",
] as const);
export type ChildEntityKind = typeof CHILD_ENTITY_KINDS[number];
export type ChildLocale = "ru" | "en";
export type ChildPlatform = "web-pwa" | "android-google" | "android-rustore" | "ios-ipados";
export type ChildReviewStatus = "approved" | "not-reviewed" | "rejected";
export type ChildRightsStatus = "approved" | "review-required" | "blocked";
export type ChildAccessReason = "approved" | "age-too-low" | "age-too-high" | "not-reviewed" | "rejected"
  | "topic-blocked" | "rights-blocked" | "territory-blocked" | "license-expired"
  | "missing-child-content" | "parent-gate-required";

/** Binding V12 decision shape; it is not a rights or review receipt. */
export interface ChildAccessDecision {
  readonly allowed: boolean;
  readonly reasonCode: ChildAccessReason;
  readonly profileAge: number;
  readonly entityMinAge?: number;
  readonly entityMaxAge?: number;
  readonly reviewStatus: ChildReviewStatus;
  readonly rightsStatus: ChildRightsStatus;
  readonly sourcePolicyVersion: string;
}
export interface ChildAccessInput {
  readonly profile: Readonly<{ exactAge: number; allowedTopics: readonly string[] | null;
    blockedTopics: readonly string[]; policyVersion: string }>;
  readonly entity: Readonly<{
    id: string;
    kind: ChildEntityKind;
    sourceVersion: string;
    policyVersion: string;
    minAge: number;
    maxAge: number;
    reviewStatus: ChildReviewStatus;
    localizedContent: readonly Readonly<{
      locale: ChildLocale;
      /** Exact reviewed localized payload, including its referenced media policy. */
      contentChecksum: string;
      reviewStatus: ChildReviewStatus;
      available: boolean;
      reviewerId: string;
      /** UTC epoch milliseconds; must not be in the caller's future. */
      reviewedAt: number;
    }>[];
    topics: readonly string[];
    topicTagsComplete: boolean;
    commercialAvailability: "included-in-base" | "optional";
    rights: Readonly<{
      status: ChildRightsStatus;
      basis: "original" | "public-domain" | "licensed";
      platforms: readonly ChildPlatform[];
      territories: readonly string[];
      /** UTC epoch milliseconds, inclusive. */
      validFrom: number;
      /** Exclusive UTC epoch milliseconds; explicit null declares no expiry. */
      expiresAt: number | null;
    }>;
  }>;
  readonly context: Readonly<{
    entityId: string;
    entityKind: ChildEntityKind;
    sourceVersion: string;
    contentChecksum: string;
    locale: ChildLocale;
    platform: ChildPlatform;
    territory: string;
    policyVersion: string;
    /** Independently established caller clock; there is no ambient time. */
    now: number;
  }>;
}

const entityKinds = new Set<string>(CHILD_ENTITY_KINDS);
const platforms = new Set<string>(["web-pwa", "android-google", "android-rustore", "ios-ipados"]);
const reviewStatuses = new Set<string>(["approved", "not-reviewed", "rejected"]);
const rightsStatuses = new Set<string>(["approved", "review-required", "blocked"]);
const identifier = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value);
const checksum = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const locale = (value: unknown): value is ChildLocale => value === "ru" || value === "en";
const territory = (value: unknown): value is string => typeof value === "string" && /^[A-Z]{2}$/u.test(value);
const topicKey = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value);
const milliseconds = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && value <= 8_640_000_000_000_000;
const member = (value: unknown, choices: ReadonlySet<string>): value is string => typeof value === "string" && choices.has(value);

/** Copy data descriptors only: do not invoke getters or accept inherited authority. */
function objectData(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key)
    || !("value" in descriptors[key]) || !descriptors[key].enumerable)) return null;
  const copy: Record<string, unknown> = Object.create(null);
  for (const field of fields) copy[field] = descriptors[field].value;
  return copy;
}
function arrayData(value: unknown, limit: number): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  // Bound ordinary arrays before creating a descriptor for every element.
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  const size: unknown = lengthDescriptor?.value;
  if (!lengthDescriptor || !("value" in lengthDescriptor) || typeof size !== "number"
    || !Number.isSafeInteger(size) || size < 0 || size > limit) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  if (Reflect.ownKeys(descriptors).length !== size + 1) return null;
  const copy: unknown[] = [];
  for (let index = 0; index < size; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return null;
    copy.push(descriptor.value);
  }
  return copy;
}
function strings(value: unknown, valid: (item: unknown) => boolean, limit: number): string[] | null {
  const items = arrayData(value, limit);
  return items && items.every(item => typeof item === "string" && valid(item)) && new Set(items).size === items.length
    ? items as string[] : null;
}
function parseInput(input: unknown): ChildAccessInput | null {
  const root = objectData(input, ["profile", "entity", "context"]);
  if (!root) return null;
  const profile = objectData(root.profile, ["exactAge", "allowedTopics", "blockedTopics", "policyVersion"]);
  const context = objectData(root.context, ["entityId", "entityKind", "sourceVersion", "contentChecksum", "locale",
    "platform", "territory", "policyVersion", "now"]);
  const entity = objectData(root.entity, ["id", "kind", "sourceVersion", "policyVersion", "minAge", "maxAge", "reviewStatus",
    "localizedContent", "topics", "topicTagsComplete", "commercialAvailability", "rights"]);
  if (!profile || !context || !entity) return null;
  const blockedTopics = strings(profile.blockedTopics, topicKey, 64), topics = strings(entity.topics, topicKey, 64);
  const allowedTopics = profile.allowedTopics === null ? null : strings(profile.allowedTopics, topicKey, 64);
  if (!isChildExactAge(profile.exactAge) || !identifier(profile.policyVersion) || !blockedTopics || !topics
    || profile.allowedTopics !== null && !allowedTopics
    || !identifier(context.entityId) || !member(context.entityKind, entityKinds) || !identifier(context.sourceVersion)
    || !checksum(context.contentChecksum) || !locale(context.locale) || !member(context.platform, platforms)
    || !territory(context.territory) || !identifier(context.policyVersion) || !milliseconds(context.now)
    || !identifier(entity.id) || !member(entity.kind, entityKinds) || !identifier(entity.sourceVersion) || !identifier(entity.policyVersion)
    || !isChildExactAge(entity.minAge) || !isChildExactAge(entity.maxAge) || entity.minAge > entity.maxAge
    || !member(entity.reviewStatus, reviewStatuses) || typeof entity.topicTagsComplete !== "boolean"
    || entity.commercialAvailability !== "included-in-base" && entity.commercialAvailability !== "optional") return null;
  const rights = objectData(entity.rights, ["status", "basis", "platforms", "territories", "validFrom", "expiresAt"]);
  if (!rights) return null;
  const allowedPlatforms = strings(rights.platforms, item => member(item, platforms), 4);
  const territories = strings(rights.territories, territory, 676);
  if (!member(rights.status, rightsStatuses) || rights.basis !== "original" && rights.basis !== "public-domain" && rights.basis !== "licensed"
    || !allowedPlatforms || !territories || !milliseconds(rights.validFrom)
    || rights.expiresAt !== null && (!milliseconds(rights.expiresAt) || rights.expiresAt <= rights.validFrom)
    || rights.basis === "licensed" && rights.expiresAt === null) return null;
  const rawContent = arrayData(entity.localizedContent, 2);
  if (!rawContent) return null;
  const localizedContent: ChildAccessInput["entity"]["localizedContent"][number][] = [];
  for (const raw of rawContent) {
    const entry = objectData(raw, ["locale", "contentChecksum", "reviewStatus", "available", "reviewerId", "reviewedAt"]);
    if (!entry || !locale(entry.locale) || !checksum(entry.contentChecksum) || !member(entry.reviewStatus, reviewStatuses)
      || typeof entry.available !== "boolean" || !identifier(entry.reviewerId) || !milliseconds(entry.reviewedAt)
      || localizedContent.some(item => item.locale === entry.locale)) return null;
    localizedContent.push(entry as unknown as ChildAccessInput["entity"]["localizedContent"][number]);
  }
  return { profile: { ...profile, allowedTopics, blockedTopics }, context,
    entity: { ...entity, topics, localizedContent, rights: { ...rights, platforms: allowedPlatforms, territories } } } as unknown as ChildAccessInput;
}

/**
 * Pure S16 foundation for already authenticated, current child-policy/review
 * projections from a future verified package adapter. These data fields do not
 * authenticate a reviewer, prove rights/ownership or verify package signatures.
 * No adapter, profile persistence, child startup/index boundary or UI activation
 * is delivered here. Never feed adult records, UI flags or arbitrary JSON into
 * this function as approval authority. Its decision concerns only the exact
 * requested entity, source version and selected localized payload checksum.
 * Optional/licensed admission and secure Parent Gate remain unavailable; this
 * foundation accepts no parent override or capability boolean.
 */
export function evaluateChildAccess(input: unknown): ChildAccessDecision {
  let parsed: ChildAccessInput | null;
  try { parsed = parseInput(input); } catch { parsed = null; }
  if (!parsed) return Object.freeze({ allowed: false, reasonCode: "not-reviewed", profileAge: 0,
    reviewStatus: "not-reviewed", rightsStatus: "review-required", sourcePolicyVersion: "" });
  const { profile, entity, context } = parsed;
  const content = entity.localizedContent.find(item => item.locale === context.locale);
  const reviewStatus: ChildReviewStatus = entity.reviewStatus === "rejected" || content?.reviewStatus === "rejected" ? "rejected"
    : entity.reviewStatus === "approved" && content?.reviewStatus === "approved" ? "approved" : "not-reviewed";
  const decision = (reasonCode: ChildAccessReason): ChildAccessDecision => Object.freeze({
    allowed: reasonCode === "approved", reasonCode, profileAge: profile.exactAge,
    entityMinAge: entity.minAge, entityMaxAge: entity.maxAge, reviewStatus,
    rightsStatus: entity.rights.status, sourcePolicyVersion: entity.policyVersion,
  });
  if (entity.id !== context.entityId || entity.kind !== context.entityKind || entity.sourceVersion !== context.sourceVersion
    || entity.policyVersion !== context.policyVersion || profile.policyVersion !== context.policyVersion) return decision("not-reviewed");
  if (entity.reviewStatus === "rejected") return decision("rejected");
  if (!content || !content.available) return decision("missing-child-content");
  if (content.contentChecksum !== context.contentChecksum || content.reviewedAt > context.now) return decision("not-reviewed");
  if (reviewStatus === "rejected") return decision("rejected");
  if (reviewStatus !== "approved" || !entity.topicTagsComplete) return decision("not-reviewed");
  if (profile.exactAge < entity.minAge) return decision("age-too-low");
  if (profile.exactAge > entity.maxAge) return decision("age-too-high");
  if (entity.topics.some(topic => profile.blockedTopics.includes(topic)
    || profile.allowedTopics !== null && !profile.allowedTopics.includes(topic))) return decision("topic-blocked");
  if (entity.rights.status !== "approved" || entity.commercialAvailability !== "included-in-base"
    || entity.rights.basis === "licensed" || !entity.rights.platforms.includes(context.platform)) return decision("rights-blocked");
  if (!entity.rights.territories.includes(context.territory)) return decision("territory-blocked");
  if (context.now < entity.rights.validFrom) return decision("rights-blocked");
  if (entity.rights.expiresAt !== null && context.now >= entity.rights.expiresAt) return decision("license-expired");
  if (entity.kind === "external-link" || entity.kind === "store-preview") return decision("parent-gate-required");
  return decision("approved");
}
