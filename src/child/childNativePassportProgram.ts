import { childDataArray, childRecord, decodeChildEntityReference, type ChildEntityReference } from "./childPackage";
import { childNativeJourneyId as id, childNativeJourneyRevision as revision, decodeChildNativeJourneySummaries,
  type ChildNativeJourneySummary } from "./childNativeJourney";
import type { ChildNativeContext } from "./childNativeAppBridge";

/** These are closed source-material and presentation schemas. Native admission,
 * authentic human review, confirmed progress and protected file IO own awards
 * and route availability; none of these JavaScript values grants them. */
export interface ChildNativeBadgeRule {
  readonly badgeId: string; readonly ruleVersion: number; readonly displayReference: ChildEntityReference;
  readonly journeyId: string; readonly journeyVersion: number; readonly contentVersion: number;
  readonly trigger: "completed-journey" | "completed-learning"; readonly nodeIds: readonly string[];
}
export interface ChildNativePassportProgram {
  readonly schemaVersion: 1; readonly kind: "literary-planet-child-passport-program-v1";
  readonly programId: string; readonly programVersion: number; readonly packageId: string; readonly packageVersion: number;
  readonly packageChecksum: string; readonly policyVersion: string; readonly policyChecksum: string;
  readonly locale: "ru" | "en"; readonly exactAge: number; readonly awardRules: readonly ChildNativeBadgeRule[];
  readonly validFromEpochMs: number; readonly validUntilEpochMs: number;
}
export interface ChildNativePassportProgramPins {
  readonly schemaVersion: 1; readonly kind: "literary-planet-child-passport-program-release-pins-v1";
  readonly reviewKeys: readonly Readonly<{ keyId: string; reviewerId: string; publicKeyX963Hex: string }>[];
  readonly programs: readonly Readonly<{ programId: string; programVersion: number; programChecksum: string; reviewChecksum: string }>[];
}
export interface ChildNativeBadge {
  readonly badgeId: string; readonly ruleVersion: number; readonly programId: string; readonly programVersion: number;
  readonly programChecksum: string; readonly journeyId: string; readonly journeyVersion: number; readonly contentVersion: number;
  readonly title: string;
}
export interface ChildNativeDownloadedRoute extends ChildNativeJourneySummary {
  readonly snapshotChecksum: string; readonly byteLength: number;
  /** Native checked persisted bytes, separately from permission to play. */
  readonly media: ChildNativeRouteMediaDownload;
}
export interface ChildNativeRouteMediaDownload {
  readonly locale: "ru" | "en";
  readonly audioStatus: "downloaded" | "text-only";
  readonly audioItemCount: number; readonly imageItemCount: number;
  readonly transcriptByteLength: number; readonly mediaByteLength: number;
}
export interface ChildNativePassportSection<T> { readonly status: "ready" | "unavailable"; readonly items: readonly T[] }
export interface ChildNativeRouteSave {
  readonly profileId: string; readonly locale: "ru" | "en"; readonly generation: number; readonly revision: number;
  readonly route: ChildNativeDownloadedRoute;
}
export const childNativePassportHash = (raw: unknown): raw is string => typeof raw === "string" && /^[a-f0-9]{64}$/u.test(raw);
const positive = (raw: unknown): raw is number => revision(raw) && raw > 0;
const epoch = (raw: unknown): raw is number => revision(raw) && raw <= 8_640_000_000_000_000;
const title = (raw: unknown): raw is string => typeof raw === "string" && !!raw && raw.length <= 240
  && raw.trim() === raw && !/[\u0000-\u001f\u007f]/u.test(raw);

export function decodeChildNativePassportProgram(raw: unknown): ChildNativePassportProgram | null {
  try {
    const row = childRecord(raw, ["schemaVersion", "kind", "programId", "programVersion", "packageId", "packageVersion", "packageChecksum",
      "policyVersion", "policyChecksum", "locale", "exactAge", "awardRules", "validFromEpochMs", "validUntilEpochMs"]);
    if (!row || row.schemaVersion !== 1 || row.kind !== "literary-planet-child-passport-program-v1"
      || !id(row.programId) || !positive(row.programVersion) || !id(row.packageId) || !positive(row.packageVersion)
      || !childNativePassportHash(row.packageChecksum) || !id(row.policyVersion) || !childNativePassportHash(row.policyChecksum)
      || row.locale !== "ru" && row.locale !== "en" || !revision(row.exactAge) || row.exactAge < 3 || row.exactAge > 17
      || !epoch(row.validFromEpochMs) || !epoch(row.validUntilEpochMs) || row.validFromEpochMs >= row.validUntilEpochMs) return null;
    const rules = childDataArray(row.awardRules, 64); if (!rules) return null;
    const decoded: ChildNativeBadgeRule[] = [], seen = new Set<string>();
    for (const rawRule of rules) {
      const rule = childRecord(rawRule, ["badgeId", "ruleVersion", "displayReference", "journeyId", "journeyVersion", "contentVersion", "trigger", "nodeIds"]);
      const display = rule && decodeChildEntityReference(rule.displayReference), nodes = rule && childDataArray(rule.nodeIds, 64);
      if (!rule || !id(rule.badgeId) || seen.has(rule.badgeId) || !positive(rule.ruleVersion) || !display || display.kind !== "recommendation"
        || !id(rule.journeyId) || !positive(rule.journeyVersion) || !positive(rule.contentVersion)
        || rule.journeyVersion !== row.packageVersion || rule.contentVersion !== row.packageVersion
        || rule.trigger !== "completed-journey" && rule.trigger !== "completed-learning"
        || !nodes?.length || !nodes.every(id) || new Set(nodes).size !== nodes.length || nodes.includes(rule.journeyId)) return null;
      seen.add(rule.badgeId); decoded.push(Object.freeze({ ...rule, displayReference: display, nodeIds: Object.freeze(nodes as string[]) }) as unknown as ChildNativeBadgeRule);
    }
    return Object.freeze({ ...row, awardRules: Object.freeze(decoded) }) as unknown as ChildNativePassportProgram;
  } catch { return null; }
}
export function decodeChildNativePassportProgramPins(raw: unknown): ChildNativePassportProgramPins | null {
  try {
    const row = childRecord(raw, ["schemaVersion", "kind", "reviewKeys", "programs"]);
    if (!row || row.schemaVersion !== 1 || row.kind !== "literary-planet-child-passport-program-release-pins-v1") return null;
    const keys = childDataArray(row.reviewKeys, 16), programs = childDataArray(row.programs, 32);
    if (!keys || !programs) return null;
    const seenKeys = new Set<string>(), seenPoints = new Set<string>(), seenPrograms = new Set<string>(), seenHashes = new Set<string>();
    const keyRows: ChildNativePassportProgramPins["reviewKeys"][number][] = [], programRows: ChildNativePassportProgramPins["programs"][number][] = [];
    for (const rawKey of keys) {
      const key = childRecord(rawKey, ["keyId", "reviewerId", "publicKeyX963Hex"]);
      if (!key || typeof key.keyId !== "string" || !/^child-passport-review-[A-Za-z0-9_-]{1,48}$/u.test(key.keyId)
        || !id(key.reviewerId) || typeof key.publicKeyX963Hex !== "string" || !/^04[a-f0-9]{128}$/u.test(key.publicKeyX963Hex)
        || seenKeys.has(key.keyId) || seenPoints.has(key.publicKeyX963Hex)) return null;
      seenKeys.add(key.keyId); seenPoints.add(key.publicKeyX963Hex); keyRows.push(Object.freeze({ keyId: key.keyId, reviewerId: key.reviewerId, publicKeyX963Hex: key.publicKeyX963Hex }));
    }
    for (const rawPin of programs) {
      const pin = childRecord(rawPin, ["programId", "programVersion", "programChecksum", "reviewChecksum"]);
      if (!pin || !id(pin.programId) || !positive(pin.programVersion) || !childNativePassportHash(pin.programChecksum)
        || !childNativePassportHash(pin.reviewChecksum) || seenPrograms.has(pin.programId + "/" + pin.programVersion)
        || seenHashes.has(pin.programChecksum)) return null;
      seenPrograms.add(pin.programId + "/" + pin.programVersion); seenHashes.add(pin.programChecksum);
      programRows.push(Object.freeze({ programId: pin.programId, programVersion: pin.programVersion, programChecksum: pin.programChecksum, reviewChecksum: pin.reviewChecksum }));
    }
    return Object.freeze({ schemaVersion: 1, kind: "literary-planet-child-passport-program-release-pins-v1", reviewKeys: Object.freeze(keyRows), programs: Object.freeze(programRows) });
  } catch { return null; }
}
function section<T>(raw: unknown, maximum: number, decode: (raw: unknown) => T | null, identity: (item: T) => string): ChildNativePassportSection<T> | null {
  const row = childRecord(raw, ["status", "items"]), values = row && childDataArray(row.items, maximum);
  if (!row || row.status !== "ready" && row.status !== "unavailable" || !values || row.status === "unavailable" && values.length) return null;
  const items = values.map(decode);
  if (items.some(item => item === null) || new Set((items as T[]).map(identity)).size !== items.length) return null;
  return Object.freeze({ status: row.status, items: Object.freeze(items as T[]) });
}
export function decodeChildNativeBadges(raw: unknown, contentVersion: number): ChildNativePassportSection<ChildNativeBadge> | null {
  try { return section(raw, 64, value => {
    const row = childRecord(value, ["badgeId", "ruleVersion", "programId", "programVersion", "programChecksum", "journeyId", "journeyVersion", "contentVersion", "title"]);
    return row && id(row.badgeId) && positive(row.ruleVersion) && id(row.programId) && positive(row.programVersion)
      && childNativePassportHash(row.programChecksum) && id(row.journeyId) && positive(row.journeyVersion)
      && row.journeyVersion === contentVersion && row.contentVersion === contentVersion && title(row.title)
      ? Object.freeze({ ...row }) as unknown as ChildNativeBadge : null;
  }, item => item.programChecksum + "/" + item.badgeId + "/" + item.ruleVersion); } catch { return null; }
}
export function decodeChildNativeDownloadedRoute(raw: unknown, contentVersion: number): ChildNativeDownloadedRoute | null {
  try {
    const row = childRecord(raw, ["journeyId", "journeyVersion", "contentVersion", "title", "description", "nodeCount", "snapshotChecksum", "byteLength", "media"]);
    if (!row || !childNativePassportHash(row.snapshotChecksum) || !positive(row.byteLength) || row.byteLength > 524288) return null;
    const media = decodeChildNativeRouteMediaDownload(row.media, row.byteLength);
    if (!media) return null;
    const summaries = decodeChildNativeJourneySummaries([{ journeyId: row.journeyId, journeyVersion: row.journeyVersion, contentVersion: row.contentVersion,
      title: row.title, description: row.description, nodeCount: row.nodeCount }]);
    return summaries?.length === 1 && summaries[0].contentVersion === contentVersion && summaries[0].journeyVersion === contentVersion
      ? Object.freeze({ ...summaries[0], snapshotChecksum: row.snapshotChecksum, byteLength: row.byteLength, media }) : null;
  } catch { return null; }
}
export function decodeChildNativeRouteMediaDownload(raw: unknown, snapshotByteLength: number): ChildNativeRouteMediaDownload | null {
  try {
    const row = childRecord(raw, ["locale", "audioStatus", "audioItemCount", "imageItemCount", "transcriptByteLength", "mediaByteLength"]);
    if (!row || row.locale !== "ru" && row.locale !== "en" || row.audioStatus !== "downloaded" && row.audioStatus !== "text-only"
      || !revision(snapshotByteLength) || snapshotByteLength < 1 || snapshotByteLength > 524288
      || !revision(row.audioItemCount) || !revision(row.imageItemCount) || row.audioItemCount + row.imageItemCount > 64
      || !revision(row.transcriptByteLength) || !revision(row.mediaByteLength)
      || row.mediaByteLength + row.transcriptByteLength >= snapshotByteLength
      || (row.audioStatus === "downloaded") !== (row.audioItemCount > 0)
      || (row.audioItemCount > 0) !== (row.transcriptByteLength > 0)
      || (row.audioItemCount + row.imageItemCount > 0) !== (row.mediaByteLength > 0)) return null;
    return Object.freeze({ ...row }) as unknown as ChildNativeRouteMediaDownload;
  } catch { return null; }
}
export function decodeChildNativeDownloadedRoutes(raw: unknown, contentVersion: number): ChildNativePassportSection<ChildNativeDownloadedRoute> | null {
  try { return section(raw, 32, value => decodeChildNativeDownloadedRoute(value, contentVersion), item => item.journeyId); } catch { return null; }
}
export function decodeChildNativeRouteSave(raw: unknown, context: ChildNativeContext, journeyId: string, expectedRevision: number): ChildNativeRouteSave | null {
  try {
    const row = childRecord(raw, ["profileId", "locale", "generation", "revision", "route"]);
    const route = row && decodeChildNativeDownloadedRoute(row.route, context.package?.version ?? 0);
    return row && id(context.profileId) && row.profileId === context.profileId && row.locale === context.locale
      && row.generation === context.generation && positive(row.generation) && revision(expectedRevision)
      && expectedRevision < Number.MAX_SAFE_INTEGER - 1 && row.revision === expectedRevision + 1 && route?.journeyId === journeyId
      && route.media.locale === context.locale
      ? Object.freeze({ profileId: context.profileId, locale: context.locale, generation: context.generation, revision: row.revision, route }) : null;
  } catch { return null; }
}
