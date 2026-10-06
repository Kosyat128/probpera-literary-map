import { childRecord } from "./childPackage";
import { childNativeJourneyId as id, childNativeJourneyRevision as revision } from "./childNativeJourney";
import { decodeChildNativeDownloadedRoute, type ChildNativeDownloadedRoute, type ChildNativeRouteSave } from "./childNativePassportProgram";
import type { ChildNativeContext } from "./childNativeAppBridge";
import type { ChildNativePassportController } from "./childNativeDiscoveryPassport";

/** Presentation counters describe checked local storage only. Current native
 * package/review/rights/profile/parent claims independently own every read,
 * acquisition, activation and playback. No approval or acquisition URL enters JS. */
export const CHILD_NATIVE_ROUTE_OBJECT_LIMIT = 69;
export const CHILD_NATIVE_ROUTE_ACQUISITION_BYTES = 2_248_671_232;
export interface ChildNativeRouteAcquisition {
  readonly status: "absent" | "staging" | "ready" | "cancelled";
  readonly journeyId: string; readonly locale: "ru" | "en";
  readonly completedItems: number; readonly totalItems: number;
  readonly downloadedBytes: number; readonly totalBytes: number;
  readonly sharedItems: number; readonly reusedItems: number;
}
export interface ChildNativeRouteDownload {
  readonly profileId: string; readonly locale: "ru" | "en";
  readonly generation: number; readonly revision: number;
  readonly route: ChildNativeDownloadedRoute | null;
  readonly acquisition: ChildNativeRouteAcquisition;
}
export function decodeChildNativeRouteDownload(raw: unknown, c: ChildNativeContext, journeyId: string,
  expectedRevision?: number): ChildNativeRouteDownload | null {
  try {
    const row = childRecord(raw, ["profileId", "locale", "generation", "revision", "route", "acquisition"]);
    const a = row && childRecord(row.acquisition, ["status", "journeyId", "locale", "completedItems", "totalItems", "downloadedBytes", "totalBytes", "sharedItems", "reusedItems"]);
    if (!row || !a || !id(c.profileId) || !id(journeyId) || row.profileId !== c.profileId || row.locale !== c.locale
      || row.generation !== c.generation || !revision(row.generation) || row.generation < 1 || !revision(row.revision)
      || !["absent", "staging", "ready", "cancelled"].includes(a.status as string)
      || a.journeyId !== journeyId || a.locale !== c.locale
      || ![a.completedItems, a.totalItems, a.downloadedBytes, a.totalBytes, a.sharedItems, a.reusedItems].every(revision)
      || (a.totalItems as number) > CHILD_NATIVE_ROUTE_OBJECT_LIMIT || (a.totalBytes as number) > CHILD_NATIVE_ROUTE_ACQUISITION_BYTES
      || (a.completedItems as number) > (a.totalItems as number) || (a.downloadedBytes as number) > (a.totalBytes as number)
      || (a.sharedItems as number) > (a.completedItems as number) || (a.reusedItems as number) > (a.completedItems as number)) return null;
    if (expectedRevision !== undefined && (!revision(expectedRevision) || expectedRevision >= Number.MAX_SAFE_INTEGER - 136
      || row.revision <= expectedRevision || row.revision > expectedRevision + 136)) return null;
    let route: ChildNativeDownloadedRoute | null = null;
    if (a.status === "absent" || a.status === "cancelled") {
      if (row.route !== null || a.completedItems !== 0 || a.totalItems !== 0 || a.downloadedBytes !== 0 || a.totalBytes !== 0
        || a.sharedItems !== 0 || a.reusedItems !== 0) return null;
    } else {
      if ((a.totalItems as number) < 1 || (a.totalBytes as number) < 1
        || (a.completedItems === 0) !== (a.downloadedBytes === 0)
        || (a.totalBytes as number) < (a.totalItems as number)
        || (a.downloadedBytes as number) < (a.completedItems as number)) return null;
      if (a.status === "staging") { if (row.route !== null) return null; }
      else {
        if (a.completedItems !== a.totalItems || a.downloadedBytes !== a.totalBytes) return null;
        route = decodeChildNativeDownloadedRoute(row.route, c.package?.version ?? 0);
        if (!route || route.journeyId !== journeyId || route.media.locale !== c.locale) return null;
      }
    }
    return Object.freeze({ profileId: c.profileId, locale: c.locale, generation: c.generation, revision: row.revision,
      route, acquisition: Object.freeze({ ...a }) as unknown as ChildNativeRouteAcquisition });
  } catch { return null; }
}
export type ChildNativeRouteDownloadResult = Readonly<{ status: "saved" | "paused" | "cancelled" | "failed";
  value: ChildNativeRouteDownload | ChildNativeRouteSave | null }>;
/** One explicit user intent drives bounded native steps. A restart reads staged
 * facts and waits for another explicit intent. Uncertain null never replays a
 * mutation. Cancellation joins the in-flight step before using its actual CAS
 * revision; context retirement leaves native durable staged bytes untouched. */
export async function continueChildNativeRouteDownload(port: ChildNativePassportController, journeyId: string,
  expectedRevision: number, options: Readonly<{ resume: boolean; alive(): boolean; cancelled(): boolean;
    progress(value: ChildNativeRouteDownload): void }>): Promise<ChildNativeRouteDownloadResult> {
  let currentRevision = expectedRevision, last: ChildNativeRouteDownload | ChildNativeRouteSave | null = null;
  if (!options.alive()) return { status: "paused", value: null };
  for (let step = 0; step < CHILD_NATIVE_ROUTE_OBJECT_LIMIT + 3; step++) {
    if (!options.alive()) return { status: "paused", value: last };
    if (options.cancelled()) {
      const cancelled = await port.cancelJourneyRoute?.(journeyId, currentRevision) ?? null;
      if (!options.alive()) return { status: "paused", value: null };
      if (cancelled?.acquisition.status === "ready" && cancelled.route) return { status: "saved", value: cancelled };
      return cancelled?.acquisition.status === "cancelled" ? { status: "cancelled", value: cancelled } : { status: "failed", value: null };
    }
    const value = step === 0 && !options.resume
      ? await port.saveJourneyRoute?.(journeyId, currentRevision) ?? null
      : await port.resumeJourneyRoute?.(journeyId, currentRevision) ?? null;
    if (!options.alive()) return { status: "paused", value: null };
    if (!value) return { status: "failed", value: null };
    last = value; currentRevision = value.revision;
    if (!("acquisition" in value)) return { status: "saved", value };
    options.progress(value);
    if (!options.alive()) return { status: "paused", value: null };
    // A cancel linearizes after joining the active step. If activation already
    // committed, native reports ready; the UI must report that terminal fact.
    if (options.cancelled()) continue;
    if (value.acquisition.status === "ready" && value.route) return { status: "saved", value };
    if (value.acquisition.status === "cancelled") return { status: "cancelled", value };
    if (value.acquisition.status !== "staging") return { status: "failed", value: null };
  }
  return { status: "paused", value: last };
}
