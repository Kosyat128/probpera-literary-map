import { childDataArray, childRecord, decodeChildEntityPayload, decodeChildEntityReference, type ChildEntityReference } from "./childPackage";
import { childNativeJourneyId, childNativeJourneyRevision, decodeChildNativeJourneySummaries, type ChildNativeJourneySummary } from "./childNativeJourney";
import type { ChildNativeRouteDownload } from "./childNativeOfflinePackages";
import type { ChildNativeContext, ChildNativeEntity } from "./childNativeAppBridge";
import { decodeChildNativeBadges, decodeChildNativeDownloadedRoutes, type ChildNativeBadge, type ChildNativeDownloadedRoute,
  type ChildNativePassportSection, type ChildNativeRouteSave } from "./childNativePassportProgram";

/** Native already admits every row independently. These strict presentation
 * DTOs validate structure and correlation, never reproduce age/rights policy. */
export type ChildNativeDiscoveryShelf = "writers" | "books" | "collections";
export interface ChildNativeDiscoveryResult {
  readonly profileId: string; readonly locale: "ru" | "en"; readonly generation: number;
  readonly shelf: ChildNativeDiscoveryShelf; readonly items: readonly ChildNativeEntity[];
}
export interface ChildNativePassport {
  readonly schemaVersion: 1 | 2; readonly profileId: string; readonly locale: "ru" | "en"; readonly generation: number;
  readonly revision: number; readonly countries: readonly ChildNativeEntity[];
  readonly writers: readonly ChildNativeEntity[]; readonly works: readonly ChildNativeEntity[];
  readonly journeys: readonly ChildNativeJourneySummary[]; readonly unresolvedCompletedNodeIds: readonly string[];
  readonly badges: ChildNativePassportSection<ChildNativeBadge>;
  readonly downloadedRoutes: ChildNativePassportSection<ChildNativeDownloadedRoute>;
}
export interface ChildNativeCountryOpen {
  readonly profileId: string; readonly locale: "ru" | "en"; readonly generation: number;
  readonly revision: number; readonly country: ChildNativeEntity;
}
export interface ChildNativeDiscoveryController {
  list(shelf: ChildNativeDiscoveryShelf): Promise<ChildNativeDiscoveryResult | null>;
}
export interface ChildNativePassportController {
  read(): Promise<ChildNativePassport | null>;
  /** Explicit user navigation only; reads, hydration and label prefetch never
   * call this protected native transaction. Null cannot confirm a credit. */
  recordCountryOpen(reference: ChildEntityReference): Promise<ChildNativeCountryOpen | null>;
  /** Explicit save intent. Native resolves the complete route and writes its
   * exact local bytes; the caller supplies no approval, files or receipt. */
  saveJourneyRoute?(journeyId: string, expectedRevision: number): Promise<ChildNativeRouteSave | ChildNativeRouteDownload | null>;
  /** Read-only facts; never starts/resumes background acquisition. */
  readJourneyRouteDownload?(journeyId: string): Promise<ChildNativeRouteDownload | null>;
  resumeJourneyRoute?(journeyId: string, expectedRevision: number): Promise<ChildNativeRouteDownload | null>;
  cancelJourneyRoute?(journeyId: string, expectedRevision: number): Promise<ChildNativeRouteDownload | null>;
}
export interface ChildNativeRemovalTarget { readonly profileId: string; readonly scope: "history" | "profile" | "downloads" }
export function decodeChildNativeRemovalTarget(raw: unknown): ChildNativeRemovalTarget | null {
  try {
    const row = childRecord(raw, ["profileId", "scope"]);
    return row && childNativeJourneyId(row.profileId) && (row.scope === "history" || row.scope === "profile" || row.scope === "downloads")
      ? Object.freeze({ profileId: row.profileId, scope: row.scope }) : null;
  } catch { return null; }
}
export function childNativeDiscoveryShelf(raw: unknown): raw is ChildNativeDiscoveryShelf {
  return raw === "writers" || raw === "books" || raw === "collections";
}
const bindingFields = ["profileId", "locale", "generation"];
function correlated(row: Record<string, unknown>, c: Pick<ChildNativeContext, "profileId" | "locale" | "generation">) {
  return childNativeJourneyId(c.profileId) && row.profileId === c.profileId && row.locale === c.locale
    && childNativeJourneyRevision(row.generation) && row.generation > 0 && row.generation === c.generation;
}
function entity(raw: unknown, kind: ChildEntityReference["kind"]): ChildNativeEntity | null {
  const row = childRecord(raw, ["reference", "payload"]), ref = row && decodeChildEntityReference(row.reference);
  const payload = row && decodeChildEntityPayload(row.payload);
  if (!row || !ref || ref.kind !== kind || !payload) return null;
  // A recommendation is a reviewed native wrapper around one concrete target;
  // it cannot stand in for an unimplemented shelf or approve its target in JS.
  if (kind === "recommendation" && (payload.references.length !== 1
    || !["country", "writer", "work", "activity"].includes(payload.references[0].kind))) return null;
  return Object.freeze({ reference: ref, payload });
}
function entities(raw: unknown, kind: ChildEntityReference["kind"], maximum: number): readonly ChildNativeEntity[] | null {
  const list = childDataArray(raw, maximum); if (!list) return null;
  const values = list.map(value => entity(value, kind));
  return values.every(value => value !== null) && new Set(values.map(value => value!.reference.id)).size === values.length
    ? Object.freeze(values as ChildNativeEntity[]) : null;
}
export function decodeChildNativeDiscovery(raw: unknown, c: ChildNativeContext, shelf: ChildNativeDiscoveryShelf): ChildNativeDiscoveryResult | null {
  try {
    const row = childRecord(raw, [...bindingFields, "shelf", "items"]);
    if (!row || !childNativeDiscoveryShelf(shelf) || row.shelf !== shelf || !correlated(row, c)) return null;
    const items = entities(row.items, shelf === "writers" ? "writer" : shelf === "books" ? "work" : "recommendation", 64);
    return items ? Object.freeze({ profileId: c.profileId!, locale: c.locale, generation: c.generation, shelf, items }) : null;
  } catch { return null; }
}
export function decodeChildNativePassport(raw: unknown, c: ChildNativeContext): ChildNativePassport | null {
  try {
    const row = childRecord(raw, ["schemaVersion", ...bindingFields, "revision", "countries", "writers", "works", "journeys",
      "unresolvedCompletedNodeIds", "badges", "downloadedRoutes"]);
    if (!row || row.schemaVersion !== 1 && row.schemaVersion !== 2 || !correlated(row, c) || !childNativeJourneyRevision(row.revision)) return null;
    const countries = entities(row.countries, "country", 2048), writers = entities(row.writers, "writer", 2048), works = entities(row.works, "work", 2048);
    const journeys = decodeChildNativeJourneySummaries(row.journeys), unresolved = childDataArray(row.unresolvedCompletedNodeIds, 2048);
    const badges = decodeChildNativeBadges(row.badges, c.package?.version ?? 0), downloadedRoutes = decodeChildNativeDownloadedRoutes(row.downloadedRoutes, c.package?.version ?? 0);
    if (!countries || !writers || !works || !journeys || journeys.length > 32
      || journeys.some(value => value.contentVersion !== c.package?.version)
      || !unresolved || !unresolved.every(childNativeJourneyId) || new Set(unresolved).size !== unresolved.length
      || !badges || !downloadedRoutes || row.schemaVersion === 1 && (badges.status !== "unavailable" || downloadedRoutes.status !== "unavailable")
      || downloadedRoutes.items.some(route => route.media.locale !== c.locale)
      || downloadedRoutes.items.reduce((sum, route) => sum + route.byteLength, 0) > 2097152) return null;
    return Object.freeze({ schemaVersion: row.schemaVersion, profileId: c.profileId!, locale: c.locale, generation: c.generation, revision: row.revision,
      countries, writers, works, journeys, unresolvedCompletedNodeIds: Object.freeze(unresolved as string[]), badges, downloadedRoutes });
  } catch { return null; }
}
export function decodeChildNativeCountryOpen(raw: unknown, c: ChildNativeContext, expected: ChildEntityReference): ChildNativeCountryOpen | null {
  try {
    const row = childRecord(raw, [...bindingFields, "revision", "country"]), country = row && entity(row.country, "country");
    if (!row || !correlated(row, c) || !childNativeJourneyRevision(row.revision) || !country || expected.kind !== "country"
      || country.reference.id !== expected.id || country.reference.contentChecksum !== expected.contentChecksum) return null;
    return Object.freeze({ profileId: c.profileId!, locale: c.locale, generation: c.generation, revision: row.revision, country });
  } catch { return null; }
}
