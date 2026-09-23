import { contentTextHash } from "../planet/contentExportHash";
import type { BookyJourneyPlan, BookyJourneyPrerequisite } from "./bookyJourney";
import { createBookyJourneyCatalog, type BookyJourneyCatalog, type BookyJourneyCatalogOptions } from "./bookyJourneyCatalog";
import { createBookyJourneyProgressRecord, parseBookyJourneyProgress,
  type BookyJourneyProgressPreference, type BookyJourneyProgressRecord } from "./bookyJourneyProgress";
import { parseBookyReaderPolicy, serializeBookyReaderPolicy, type BookyReaderPolicy } from "./bookyReaderPolicy";

export type BookyJourneyCatalogWithProgressOptions = Readonly<Omit<BookyJourneyCatalogOptions, "completedPrerequisites"> & {
  progress: BookyJourneyProgressPreference | null;
}>;
export type BookyJourneyCatalogWithProgress = Readonly<{
  catalog: BookyJourneyCatalog;
  completedPrerequisites: readonly BookyJourneyPrerequisite[];
}>;

/** Both plans must come from freshly admitted catalogs. A language switch
 * cannot turn an edited or unreviewed saved definition into new progress.
 * Exact projected node equality includes the derived activity fingerprint;
 * the same prompt/routing key with changed factual authorship is not equivalent. */
export function matchesBookyJourneyProgress(record: BookyJourneyProgressRecord, policy: BookyReaderPolicy,
  currentPlan: BookyJourneyPlan, savedPlan: BookyJourneyPlan = currentPlan): boolean {
  if (savedPlan.id !== currentPlan.id || savedPlan.version !== currentPlan.version || savedPlan.locale !== record.locale) return false;
  const saved = createBookyJourneyProgressRecord(policy, savedPlan, record.acknowledgedNodeIds, record.resumeNodeId);
  const current = createBookyJourneyProgressRecord(policy, currentPlan, record.acknowledgedNodeIds, record.resumeNodeId);
  return !!saved && !!current && JSON.stringify(record) === JSON.stringify(saved)
    && JSON.stringify(saved.nodes) === JSON.stringify(current.nodes);
}

/** Saved completion is a semantic claim, never admission. Begin with no receipts
 * and admit each completed route through the whole current catalog before it
 * can unlock another route. Cycles cannot seed themselves. The progress codec
 * bounds this monotone calculation to 32 records and at most 32 growth passes.
 * No record, locale binding, version or acknowledgement is changed here. */
export function createBookyJourneyCatalogWithProgress(options: BookyJourneyCatalogWithProgressOptions): BookyJourneyCatalogWithProgress {
  let completedPrerequisites: readonly BookyJourneyPrerequisite[] = Object.freeze([]);
  const build = (locale = options.locale) => createBookyJourneyCatalog({ ...options, locale, completedPrerequisites });
  let catalog = build();
  const result = (): BookyJourneyCatalogWithProgress => Object.freeze({ catalog, completedPrerequisites });
  // Empty production content and unseeded dependency cycles need no extra pass.
  if (catalog.plans.length === 0) return result();
  const progress = parseBookyJourneyProgress(options.progress), policy = parseBookyReaderPolicy(options.policy);
  if (!progress?.records.length || !policy) return result();
  const fingerprint = contentTextHash(serializeBookyReaderPolicy(policy)!);
  const candidates = progress.records.filter(record => record.policyFingerprint === fingerprint
    && record.resumeNodeId === null && record.acknowledgedNodeIds.length === record.nodes.length);

  for (let pass = 0; pass < candidates.length; pass++) {
    const added: BookyJourneyPrerequisite[] = [];
    let alternate: BookyJourneyCatalog | null = null;
    for (const record of candidates) {
      if (completedPrerequisites.some(item => item.id === record.journeyId)) continue;
      const current = catalog.plans.find(plan => plan.id === record.journeyId && plan.version === record.journeyVersion);
      if (!current) continue;
      let saved = current;
      if (record.locale !== options.locale) {
        alternate ??= build(record.locale);
        const admitted = alternate.plans.find(plan => plan.id === record.journeyId && plan.version === record.journeyVersion);
        if (!admitted) continue;
        saved = admitted;
      }
      if (matchesBookyJourneyProgress(record, policy, current, saved)) {
        added.push(Object.freeze({ id: current.id, version: current.version }));
      }
    }
    if (added.length === 0) break;
    completedPrerequisites = Object.freeze([...completedPrerequisites, ...added]);
    catalog = build();
  }
  // Keep the actual final plans: sourceFor is bound to their object identity.
  return result();
}
