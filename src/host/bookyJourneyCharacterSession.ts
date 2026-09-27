import { bookDossierCharacterRequestToken, consumeBookDossierCharacterViewToken, createBookDossierCharacterViewToken,
  sameBookDossierCharacterView, type BookDossierCharacterViewReceipt, type BookDossierCharacterViewRequest } from "../books/bookDossierCharacterView";
import type { BookyDossierCharacterHostSnapshot } from "./bookyDossierCharacter";
import type { BookyJourneyPlan } from "./bookyJourney";
import { resolveBookyJourneyCharacter } from "./bookyJourneyCharacter";

export type BookyJourneyCharacterSessionCurrent = Readonly<{
  /** New ownership identity on route/node/policy/locale/document changes,
   * including A -> B -> A; stable across receipt-only rendering. */
  identity: object;
  profileKey: string;
  host: BookyDossierCharacterHostSnapshot;
}>;

type Owner = {
  plan: BookyJourneyPlan; nodeId: string; current: BookyJourneyCharacterSessionCurrent;
  request: BookDossierCharacterViewRequest; receipt: BookDossierCharacterViewReceipt | null;
};
const sameRoute = (left: BookyJourneyPlan, right: BookyJourneyPlan) => left.id === right.id && left.version === right.version
  && left.locale === right.locale && left.definitionChecksum === right.definitionChecksum;

/** Only the caller's current admitted node and trusted published observation.
 * No fetching, timers, persistence, navigation or editorial authority is owned.
 * readCurrent must re-admit supplied plan/node and deny inactive/noncurrent
 * ownership; it may read the runtime synchronously before React renders. */
export function createBookyJourneyCharacterSession({ readCurrent, readNow = Date.now }: {
  readCurrent: (plan: BookyJourneyPlan, nodeId: string) => BookyJourneyCharacterSessionCurrent | null;
  readNow?: () => number;
}) {
  let owner: Owner | null = null, disposed = false, reading = false, advancing = false, epoch = 0;
  function retire(expected = owner) {
    if (!expected || owner !== expected) return;
    owner = null; ++epoch; consumeBookDossierCharacterViewToken(expected.request.token);
  }
  function resolve(plan: BookyJourneyPlan, nodeId: string) {
    if (disposed || reading) return null;
    reading = true;
    const token = epoch;
    try {
      const node = plan.nodes.find(item => item.id === nodeId), current = readCurrent(plan, nodeId);
      if (!node || node.kind !== "character" || !node.character || !current || !current.identity
        || typeof current.identity !== "object" || !current.profileKey || plan.locale !== current.host.locale) return null;
      const revision = current.host.revision;
      const resolved = resolveBookyJourneyCharacter({ spec: node.character.spec, locale: plan.locale, hostRevision: revision },
        () => readCurrent(plan, nodeId) === current ? current.host : null, readNow);
      if (!resolved || resolved.semanticChecksum !== node.character.semanticChecksum || epoch !== token || disposed
        || readCurrent(plan, nodeId) !== current || current.host.revision !== revision) return null;
      const work = resolved.spec.work, entity = node.entity;
      if (node.screen !== "collection" || entity?.kind !== "work" || work.countryId !== entity.countryId
        || work.writerId !== entity.writerId || work.workId !== entity.workId) return null;
      return { current, projection: resolved.projection };
    } catch { return null; }
    finally { reading = false; }
  }
  function live(expected: Owner) {
    if (owner !== expected || disposed) return false;
    const resolved = resolve(expected.plan, expected.nodeId), current = resolved?.current;
    const valid = !!resolved && !!current && owner === expected
      && current.identity === expected.current.identity && current.profileKey === expected.current.profileKey
      && current.host.dossier === expected.current.host.dossier
      && resolved.projection.bookKey === expected.request.bookKey
      && current.host.dossier?.cacheKey === expected.request.cacheKey;
    if (!valid) retire(expected);
    return valid;
  }
  function exact(receipt: BookDossierCharacterViewReceipt, expected: Owner) {
    try { return bookDossierCharacterRequestToken(receipt) === expected.request.token
      && sameBookDossierCharacterView(receipt, expected.request); } catch { return false; }
  }
  function canAcknowledge(plan: BookyJourneyPlan, nodeId: string, receipt: BookDossierCharacterViewReceipt) {
    const expected = owner;
    return !!expected && sameRoute(expected.plan, plan)
      && expected.nodeId === nodeId && !!expected.receipt
      && exact(receipt, expected) && exact(expected.receipt, expected) && live(expected);
  }
  return Object.freeze({
    canOpen(plan: BookyJourneyPlan, nodeId: string) { return resolve(plan, nodeId) !== null; },
    request(plan: BookyJourneyPlan, nodeId: string, fromRequest?: BookDossierCharacterViewRequest): BookDossierCharacterViewRequest | null {
      const previous = owner;
      // Only the runtime's synchronous transition to the immediately following
      // character may replace an acknowledged owner. The caller verifies its
      // active target; this capability cannot reopen, skip or cross routes.
      if (advancing) {
        if (!previous || fromRequest !== previous.request || !previous.receipt || !sameRoute(previous.plan, plan)) return null;
        const index = plan.nodes.findIndex(node => node.id === previous.nodeId);
        if (index < 0 || plan.nodes[index + 1]?.id !== nodeId || plan.nodes[index + 1]?.kind !== "character"
          || !exact(previous.receipt, previous) || !live(previous)) return null;
      } else if (fromRequest !== undefined) return null;
      const resolved = resolve(plan, nodeId);
      if (!resolved) { retire(); return null; }
      if (advancing && owner !== previous) return null;
      retire();
      const { reference, bookKey, readingMode } = resolved.projection;
      const request = Object.freeze({ token: createBookDossierCharacterViewToken(), bookKey,
        cacheKey: resolved.current.host.dossier!.cacheKey,
        anchor: Object.freeze({ sectionId: reference.sectionId, blockId: reference.blockId, itemId: reference.itemId,
          dossierVersion: reference.dossierVersion, locale: reference.locale, readingMode }) });
      const next: Owner = { plan, nodeId, current: resolved.current, request, receipt: null };
      owner = next; ++epoch;
      return live(next) ? request : null;
    },
    canPresent(request: BookDossierCharacterViewRequest) {
      const expected = owner;
      return !!expected && request === expected.request && live(expected);
    },
    /** The owner argument is captured by the observing child callback. Initial
     * null is harmless; Close after a committed receipt retires this activation. */
    observe(request: BookDossierCharacterViewRequest, receipt: BookDossierCharacterViewReceipt | null) {
      const expected = owner;
      if (!expected || expected.request !== request) return false;
      if (!receipt) { if (expected.receipt) retire(expected); return true; }
      if (!exact(receipt, expected)) { retire(expected); return false; }
      if (!live(expected)) return false;
      expected.receipt = receipt; return true;
    },
    canAcknowledge,
    acknowledge(receipt: BookDossierCharacterViewReceipt, advance: () => boolean) {
      const expected = owner;
      if (advancing || !expected || !canAcknowledge(expected.plan, expected.nodeId, receipt)) return false;
      advancing = true;
      try {
        // Runtime revalidates this same receipt before committing semantic
        // credit. Do not close first: modal closure revokes observation.
        const accepted = advance() === true;
        if (accepted) retire(expected);
        return accepted;
      } catch { return false; }
      finally { advancing = false; }
    },
    getRequest() { const expected = owner; return expected && live(expected) ? expected.request : null; },
    clear() { retire(); },
    dispose() { if (!disposed) { retire(); disposed = true; ++epoch; } },
  });
}
export type BookyJourneyCharacterSession = ReturnType<typeof createBookyJourneyCharacterSession>;
