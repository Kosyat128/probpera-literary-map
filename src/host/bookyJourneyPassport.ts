import type { ContentEntityRef } from "../planet/contentExportTypes";
import { contentTextHash } from "../planet/contentExportHash";
import { bookyJourneyEntityId } from "./bookyJourney";
import { createBookyJourneyCatalogWithProgress, matchesBookyJourneyProgress,
  type BookyJourneyCatalogWithProgressOptions } from "./bookyJourneyPrerequisites";
import { parseBookyJourneyProgress, type BookyJourneyProgressPreference } from "./bookyJourneyProgress";
import { parseBookyReaderPolicy, serializeBookyReaderPolicy } from "./bookyReaderPolicy";

export type BookyJourneyPassportOptions = Readonly<Omit<BookyJourneyCatalogWithProgressOptions, "progress"> & {
  /** Confirmed persistence only. A pending local intent is not a saved receipt. */
  confirmedProgress: BookyJourneyProgressPreference | null;
}>;
export type BookyJourneyPassport = Readonly<{
  /** Explicitly acknowledged navigation steps, not reading/study completion. */
  entities: readonly Readonly<ContentEntityRef>[];
  completedJourneys: readonly Readonly<{ id: string; version: number; locale: "ru" | "en"; title: string }>[];
}>;
const empty: BookyJourneyPassport = Object.freeze({ entities: Object.freeze([]), completedJourneys: Object.freeze([]) });

/** Read-only projection of at most 32 saved routes / 32 nodes per route. Saved
 * fingerprints are bindings, never authority. Both locale catalogs must freshly
 * admit the exact route, including prerequisites and derived activity semantics.
 * Opens, cursor movement, answer choices, checkpoints and inferred ancestors do
 * not create entity credit. Removing a contributor removes only its contribution.
 * No stored data, review, policy, progress, navigation or catalog is mutated. */
export function createBookyJourneyPassport(options: BookyJourneyPassportOptions): BookyJourneyPassport {
  try {
    const policy = parseBookyReaderPolicy(options.policy), progress = parseBookyJourneyProgress(options.confirmedProgress);
    if (!policy || !progress?.records.length) return empty;
    const fingerprint = contentTextHash(serializeBookyReaderPolicy(policy)!);
    const candidates = progress.records.filter(record => record.policyFingerprint === fingerprint);
    if (!candidates.length) return empty;
    const catalogOptions = { ...options, policy, progress };
    const current = createBookyJourneyCatalogWithProgress(catalogOptions).catalog;
    if (!current.plans.length) return empty;
    const catalogs = new Map([[options.locale, current]]);
    const entities = new Map<string, Readonly<ContentEntityRef>>();
    const completed = new Map<string, BookyJourneyPassport["completedJourneys"][number]>();
    for (const record of candidates) {
      const plan = current.plans.find(plan => plan.id === record.journeyId && plan.version === record.journeyVersion);
      if (!plan) continue;
      let savedCatalog = catalogs.get(record.locale);
      if (!savedCatalog) {
        savedCatalog = createBookyJourneyCatalogWithProgress({ ...catalogOptions, locale: record.locale }).catalog;
        catalogs.set(record.locale, savedCatalog);
      }
      const savedPlan = savedCatalog.plans.find(plan => plan.id === record.journeyId && plan.version === record.journeyVersion);
      if (!savedPlan || !matchesBookyJourneyProgress(record, policy, plan, savedPlan)) continue;
      for (const node of plan.nodes.slice(0, record.acknowledgedNodeIds.length)) {
        if ((node.kind === "country" || node.kind === "writer" || node.kind === "work") && node.entity) {
          const key = bookyJourneyEntityId(node.entity);
          if (!entities.has(key)) entities.set(key, Object.freeze({ ...node.entity }));
        }
      }
      if (record.resumeNodeId === null && record.acknowledgedNodeIds.length === plan.nodes.length) {
        const key = JSON.stringify([plan.id, plan.version]);
        if (!completed.has(key)) completed.set(key, Object.freeze({ id: plan.id, version: plan.version, locale: plan.locale, title: plan.title }));
      }
    }
    return Object.freeze({ entities: Object.freeze([...entities.values()]), completedJourneys: Object.freeze([...completed.values()]) });
  } catch { return empty; }
}
