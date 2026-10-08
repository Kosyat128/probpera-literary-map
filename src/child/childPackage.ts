import { CHILD_ENTITY_KINDS, evaluateChildAccess, type ChildAccessInput, type ChildEntityKind,
  type ChildPlatform } from "./childAccessPolicy";
import { decodeChildDataScope, type ChildDataScope } from "./childDataNamespace";
import { childProfileAllowsLocale, decodeChildProfiles } from "./childProfile";
import type { ChildPackageChallenge } from "./childStartup";

export const CHILD_PACKAGE_MAX_BYTES = 8 * 1024 * 1024;
export const CHILD_PACKAGE_MAX_ENTITIES = 4096;
export interface ChildEntityReference { readonly kind: ChildEntityKind; readonly id: string; readonly contentChecksum: string }
export interface ChildEntityPayload {
  readonly title: string; readonly text: string; readonly terms: readonly string[];
  readonly references: readonly ChildEntityReference[];
}
export interface ChildIndexedEntity {
  readonly reference: ChildEntityReference; readonly payload: ChildEntityPayload;
  readonly policy: ChildAccessInput["entity"];
}
export interface ChildCompiledPackage {
  readonly scope: ChildDataScope; readonly entities: readonly ChildIndexedEntity[];
  readonly home: ChildEntityReference; readonly validUntilEpochMs: number;
}
export interface ChildPackageDigestPort {
  /** Digest the supplied exact byte copy, not a filename, caller hash or approval flag. */
  sha256(bytes: Uint8Array): Promise<string>;
}
export interface ChildCompileContext {
  readonly challenge: ChildPackageChallenge; readonly platform: ChildPlatform; readonly territory: string;
  readonly nowEpochMs: number; readonly signal: AbortSignal; readonly digest: ChildPackageDigestPort;
}
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const epoch = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && value <= 8_640_000_000_000_000;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const kinds = new Set<string>(CHILD_ENTITY_KINDS);
const platforms = new Set<string>(["web-pwa", "android-google", "android-rustore", "ios-ipados"]);

/** Data descriptors only; an inherited property/getter never supplies authority. */
export function childRecord(value: unknown, fields: readonly string[]): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key)
    || !descriptors[key].enumerable || !("value" in descriptors[key]))) return null;
  const result: Record<string, unknown> = Object.create(null);
  for (const field of fields) result[field] = descriptors[field].value;
  return result;
}
export function childDataArray(value: unknown, limit: number): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptor = Object.getOwnPropertyDescriptor(value, "length"), size: unknown = descriptor?.value;
  if (!descriptor || !("value" in descriptor) || typeof size !== "number" || !Number.isInteger(size) || size < 0 || size > limit) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value as object);
  if (Reflect.ownKeys(descriptors).length !== size + 1) return null;
  const result: unknown[] = [];
  for (let index = 0; index < size; index++) {
    const item = descriptors[String(index)]; if (!item || !item.enumerable || !("value" in item)) return null;
    result.push(item.value);
  }
  return result;
}
export function decodeChildEntityReference(value: unknown): ChildEntityReference | null {
  try {
    const row = childRecord(value, ["kind", "id", "contentChecksum"]);
    if (!row || typeof row.kind !== "string" || !kinds.has(row.kind) || !id(row.id) || !hex(row.contentChecksum)) return null;
    return Object.freeze(row as unknown as ChildEntityReference);
  } catch { return null; }
}
const text = (value: unknown, limit: number, multiline = false): value is string => typeof value === "string"
  && value.length <= limit && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  && (multiline || !/[\r\n\t]/u.test(value));
export function decodeChildEntityPayload(value: unknown): ChildEntityPayload | null {
  const row = childRecord(value, ["title", "text", "terms", "references"]);
  if (!row || !text(row.title, 240) || !row.title || row.title.trim() !== row.title || !text(row.text, 32768, true)) return null;
  const rawTerms = childDataArray(row.terms, 64), rawReferences = childDataArray(row.references, 64);
  if (!rawTerms || !rawReferences || rawTerms.some(term => !text(term, 80) || !term || term.trim() !== term)
    || new Set(rawTerms).size !== rawTerms.length) return null;
  const references = rawReferences.map(decodeChildEntityReference);
  if (references.some(item => item === null) || new Set(references.map(item => `${item!.kind}/${item!.id}`)).size !== references.length) return null;
  return Object.freeze({ title: row.title, text: row.text, terms: Object.freeze(rawTerms as string[]),
    references: Object.freeze(references as ChildEntityReference[]) });
}
/** A deterministic payload representation whose digest is independently reviewed. */
export function childPayloadBytes(value: ChildEntityPayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ title: value.title, text: value.text, terms: value.terms,
    references: value.references.map(ref => ({ kind: ref.kind, id: ref.id, contentChecksum: ref.contentChecksum })) }));
}
const key = (reference: Pick<ChildEntityReference, "kind" | "id">) => `${reference.kind}/${reference.id}`;
/** Immutable snapshot before any asynchronous port receives mutable input. */
export function copyChildPackageChallenge(value: unknown, nowEpochMs: number): ChildPackageChallenge | null {
  try {
    const root = childRecord(value, ["generation", "request", "selection", "profile"]);
    const selection = root && childRecord(root.selection, ["schemaVersion", "mode", "selectionRevision", "profileId",
      "profileRevision", "profileChecksum", "policyVersion", "policyChecksum"]);
    const request = root && childRecord(root.request, ["locale", "route"]);
    const route = request && childRecord(request.route, ["kind", "entityId"]);
    if (!root || !selection || !request || !route || !positive(root.generation) || selection.schemaVersion !== 1
      || selection.mode !== "child" || !positive(selection.selectionRevision) || !positive(selection.profileRevision)
      || !id(selection.profileId) || !hex(selection.profileChecksum) || !id(selection.policyVersion) || !hex(selection.policyChecksum)
      || request.locale !== "ru" && request.locale !== "en" || typeof route.kind !== "string"
      || !["home", "country", "writer", "work", "storyworld"].includes(route.kind)
      || (route.kind === "home" ? route.entityId !== null : !id(route.entityId))) return null;
    const profile = decodeChildProfiles({ schemaVersion: 1, policyVersion: selection.policyVersion,
      activeProfileId: selection.profileId, profiles: [root.profile] }, { now: nowEpochMs, policyVersion: selection.policyVersion });
    if (!profile.registry || !childProfileAllowsLocale(profile.registry.profiles[0], request.locale)) return null;
    return Object.freeze({ generation: root.generation, request: Object.freeze({ locale: request.locale,
      route: Object.freeze(route) }), selection: Object.freeze(selection), profile: profile.registry.profiles[0] }) as unknown as ChildPackageChallenge;
  } catch { return null; }
}
export function childEntityAllowed(entity: ChildIndexedEntity, compiled: ChildCompiledPackage,
  context: Pick<ChildCompileContext, "challenge" | "platform" | "territory" | "nowEpochMs">): boolean {
  return evaluateChildAccess({ profile: { exactAge: context.challenge.profile.exactAge,
    allowedTopics: context.challenge.profile.allowedTopics, blockedTopics: context.challenge.profile.blockedTopics,
    policyVersion: compiled.scope.policyVersion }, entity: entity.policy, context: { entityId: entity.reference.id,
    entityKind: entity.reference.kind, sourceVersion: entity.policy.sourceVersion, contentChecksum: entity.reference.contentChecksum,
    locale: compiled.scope.locale, platform: context.platform, territory: context.territory,
    policyVersion: compiled.scope.policyVersion, now: context.nowEpochMs } }).allowed;
}

/** Text/reference package compiler only. It issues no human review receipt and
 * accepts no adult source, URL/media loader, licensed commerce or locale fallback.
 * Every included entity and reference must pass before any index exists. */
export async function compileChildPackage(input: unknown, context: ChildCompileContext): Promise<ChildCompiledPackage | null> {
  try {
    if (!(input instanceof Uint8Array) || input.byteLength < 1 || input.byteLength > CHILD_PACKAGE_MAX_BYTES || context.signal.aborted
      || !epoch(context.nowEpochMs) || !platforms.has(context.platform) || !/^[A-Z]{2}$/u.test(context.territory)) return null;
    const challenge = copyChildPackageChallenge(context.challenge, context.nowEpochMs);
    if (!challenge) return null;
    context = { ...context, challenge };
    const selection = challenge.selection, sourceProfile = challenge.profile, digest = context.digest.sha256.bind(context.digest);
    const bytes = input.slice(), checksum = await digest(bytes.slice());
    if (context.signal.aborted || !hex(checksum)) return null;
    const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const root = childRecord(raw, ["schemaVersion", "namespace", "packageId", "packageVersion", "locale", "exactAge",
      "policyVersion", "policyChecksum", "validFromEpochMs", "validUntilEpochMs", "home", "entities"]);
    if (!root || root.schemaVersion !== 1 || root.namespace !== "child" || !id(root.packageId) || !positive(root.packageVersion)
      || root.locale !== challenge.request.locale || root.exactAge !== sourceProfile.exactAge
      || root.policyVersion !== selection.policyVersion || root.policyChecksum !== selection.policyChecksum
      || !epoch(root.validFromEpochMs) || !epoch(root.validUntilEpochMs) || root.validFromEpochMs > context.nowEpochMs
      || root.validUntilEpochMs <= context.nowEpochMs || root.validUntilEpochMs <= root.validFromEpochMs
      || selection.schemaVersion !== 1 || selection.mode !== "child" || !positive(selection.selectionRevision)
      || !hex(selection.profileChecksum) || selection.profileId !== sourceProfile.id || !positive(challenge.generation)) return null;
    const decodedProfile = decodeChildProfiles({ schemaVersion: 1, policyVersion: selection.policyVersion,
      activeProfileId: sourceProfile.id, profiles: [sourceProfile] }, { now: context.nowEpochMs, policyVersion: selection.policyVersion });
    if (!decodedProfile.registry) return null;
    const scope = decodeChildDataScope({ schemaVersion: 1, namespace: "child", profileId: sourceProfile.id,
      profileRevision: selection.profileRevision, exactAge: root.exactAge, locale: root.locale, policyVersion: root.policyVersion,
      policyChecksum: root.policyChecksum, packageId: root.packageId, packageVersion: root.packageVersion, packageChecksum: checksum });
    const rawEntities = childDataArray(root.entities, CHILD_PACKAGE_MAX_ENTITIES), home = decodeChildEntityReference(root.home);
    if (!scope || !rawEntities?.length || !home || home.kind !== "activity") return null;
    const entities: ChildIndexedEntity[] = [], byKey = new Map<string, ChildIndexedEntity>();
    let validUntilEpochMs = root.validUntilEpochMs;
    for (const value of rawEntities) {
      if (context.signal.aborted) return null;
      const row = childRecord(value, ["policy", "payload"]), content = row && decodeChildEntityPayload(row.payload);
      if (!row || !content) return null;
      const policy = row.policy as ChildAccessInput["entity"];
      // JSON bytes are data, but the existing strict policy decoder is still
      // authoritative for all nested fields; no copied approval shortcuts.
      const contentChecksum = await digest(childPayloadBytes(content));
      if (context.signal.aborted || !hex(contentChecksum)) return null;
      const reference = decodeChildEntityReference({ kind: policy?.kind, id: policy?.id, contentChecksum });
      if (!reference || byKey.has(key(reference))) return null;
      const entity = Object.freeze({ reference, payload: content, policy });
      const provisional = { scope, entities: [], home, validUntilEpochMs };
      if (!childEntityAllowed(entity, provisional, context) || policy.localizedContent.length !== 1
        || policy.localizedContent[0].locale !== scope.locale) return null;
      if (policy.rights.expiresAt !== null) validUntilEpochMs = Math.min(validUntilEpochMs, policy.rights.expiresAt);
      entities.push(entity); byKey.set(key(reference), entity);
    }
    const wrappers = new Set<ChildEntityKind>(["search-result", "recommendation", "favorite", "recent", "deep-link"]);
    for (const entity of entities) {
      if (wrappers.has(entity.reference.kind) && entity.payload.references.length !== 1
        || entity.reference.kind === "offline-package" && entity.payload.references.length === 0) return null;
      for (const reference of entity.payload.references) {
        const target = byKey.get(key(reference));
        if (!target || target.reference.contentChecksum !== reference.contentChecksum) return null;
      }
    }
    if (byKey.get(key(home))?.reference.contentChecksum !== home.contentChecksum) return null;
    // Freeze the complete JSON policy graph after validation; a caller cannot
    // mutate future checks through the source bytes or a returned policy array.
    const freeze = (value: unknown): void => { if (value && typeof value === "object" && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child); Object.freeze(value);
    } };
    entities.forEach(entity => freeze(entity.policy));
    return Object.freeze({ scope, entities: Object.freeze(entities), home, validUntilEpochMs });
  } catch { return null; }
}

/** Real WebCrypto digest adapter; this is integrity, not review or OS authority. */
export function createChildWebCryptoDigest(subtle: SubtleCrypto): ChildPackageDigestPort {
  if (!subtle || typeof subtle.digest !== "function") throw new TypeError("Explicit digest provider required");
  return Object.freeze({ async sha256(bytes: Uint8Array) {
    const copy = new Uint8Array(bytes), digest = await subtle.digest("SHA-256", copy);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } });
}
