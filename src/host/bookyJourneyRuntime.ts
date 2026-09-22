import type { BookyJourneyPlan } from "./bookyJourney";
import type { BookyJourneyHostOffer } from "./bookyJourneyHost";

export type BookyJourneyRuntimeHost = Readonly<{
  /** Replace this immutable view after every policy, source or displayed-view change. */
  revision: number;
  active: boolean;
  profileKey: string | null;
  locale: "ru" | "en";
  plans: readonly BookyJourneyPlan[];
  resolve: (plan: BookyJourneyPlan, nodeId: string) => BookyJourneyHostOffer | null;
  /** New reference after a navigation command commits, including a no-op. */
  view: Readonly<{ screen: "globe" | "collection"; countryId: string | null;
    writerId: string | null; workId: string | null; settled: boolean }>;
}>;
type Phase = "navigating" | "ready" | "paused" | "unavailable" | "failed" | "complete";
export type BookyJourneyRuntimeSnapshot = Readonly<{
  revision: number;
  status: "profile-required" | "unavailable" | "ready";
  routes: readonly Readonly<{ key: string; title: string }>[];
  active: Readonly<{ title: string | null; node: BookyJourneyPlan["nodes"][number] | null;
    index: number; total: number; completedCount: number; phase: Phase; canOpen: boolean; canNext: boolean }> | null;
}>;
export function bookyJourneyRouteKey(plan: Pick<BookyJourneyPlan, "id" | "version" | "locale" | "definitionChecksum">): string {
  return JSON.stringify([plan.id, plan.version, plan.locale, plan.definitionChecksum]);
}
type Session = { id: string; version: number; locale: "ru" | "en"; definitionChecksum: string;
  topology: string; profileKey: string; index: number; total: number; completedCount: number; phase: Phase };
type Observation = { host: BookyJourneyRuntimeHost | null; plans: readonly BookyJourneyPlan[] };
type Navigation = { session: Session; controller: AbortController; accepted: boolean;
  originIndex: number; originCount: number; originView: BookyJourneyRuntimeHost["view"]; view: string };
const emptyRoutes = Object.freeze([]);
const entityKey = (node: BookyJourneyPlan["nodes"][number]) => {
  const entity = node.entity;
  return entity === null ? null : entity.kind === "country" ? [entity.kind, entity.countryId]
    : entity.kind === "writer" ? [entity.kind, entity.countryId, entity.writerId]
      : [entity.kind, entity.countryId, entity.writerId, entity.workId];
};
const topology = (plan: BookyJourneyPlan) => JSON.stringify(plan.nodes.map(node => [node.id, node.kind, entityKey(node), node.screen]));
const viewKey = (view: BookyJourneyRuntimeHost["view"]) => JSON.stringify(view);
function matches(node: BookyJourneyPlan["nodes"][number], view: BookyJourneyRuntimeHost["view"]) {
  if (!view.settled || node.screen !== view.screen) return false;
  const entity = node.entity;
  return entity === null ? node.kind === "checkpoint" : view.countryId === entity.countryId
    && (entity.kind === "country" || view.writerId === entity.writerId && (entity.kind === "writer" || view.workId === entity.workId));
}

/** An explicit adult navigation session, never proof of reading or storage.
 * Only semantic identity/counters survive suspension. Every displayed copy and
 * gesture is read from the current reviewed host; no timer or scene is owned. */
export function createBookyJourneyRuntime({ readHost, navigate }: {
  readHost: () => BookyJourneyRuntimeHost | null;
  navigate: (offer: BookyJourneyHostOffer, signal: AbortSignal) => boolean;
}) {
  let snapshot: BookyJourneyRuntimeSnapshot = Object.freeze({ revision: 0, status: "unavailable", routes: emptyRoutes, active: null });
  let session: Session | null = null, navigation: Navigation | null = null;
  let disposed = false, reading = false, epoch = 0;
  let renderedHost: BookyJourneyRuntimeHost | null = null, renderedRevision: number | null = null, renderedKey = "";
  const listeners = new Set<() => void>();

  function cancelNavigation() {
    const pending = navigation; navigation = null;
    if (!pending) return;
    if (!pending.accepted) { pending.session.index = pending.originIndex; pending.session.completedCount = pending.originCount; }
    pending.controller.abort();
  }
  function currentPlan(observed: Observation): BookyJourneyPlan | null {
    const host = observed.host, target = session;
    if (!target || !host?.active || host.profileKey !== target.profileKey) return null;
    return observed.plans.find(plan => bookyJourneyRouteKey(plan) === bookyJourneyRouteKey(target)
      && topology(plan) === target.topology) ?? null;
  }
  function publish(observed: Observation) {
    const host = observed.host, plan = currentPlan(observed);
    const status = host?.profileKey === null ? "profile-required" : observed.plans.length ? "ready" : "unavailable";
    const routes = Object.freeze(observed.plans.map(plan => Object.freeze({ key: bookyJourneyRouteKey(plan), title: plan.title })));
    const node = plan && session && session.phase !== "unavailable" ? plan.nodes[session.index] ?? null : null;
    const active = session ? Object.freeze({ title: node ? plan!.title : null, node, index: session.index, total: session.total,
      completedCount: session.completedCount, phase: session.phase,
      canOpen: !!node && (session.phase === "ready" || session.phase === "failed"),
      canNext: !!node && session.phase === "ready" && !!host && matches(node, host.view) }) : null;
    const key = JSON.stringify([status, routes, active && [active.title, session && bookyJourneyRouteKey(session), active.index,
      active.total, active.completedCount, active.phase, active.canOpen, active.canNext, !!active.node]]);
    if (key === renderedKey && host === renderedHost && (host?.revision ?? null) === renderedRevision) return;
    renderedKey = key; renderedHost = host; renderedRevision = host?.revision ?? null;
    const next = Object.freeze({ revision: snapshot.revision + 1, status, routes, active }); snapshot = next;
    for (const listener of [...listeners]) {
      if (snapshot !== next) break;
      if (listeners.has(listener)) { try { listener(); } catch { /* Views do not own admission. */ } }
    }
  }
  function failClosed() {
    ++epoch;
    if (session) session.phase = "unavailable";
    cancelNavigation(); publish({ host: null, plans: [] });
  }
  function validOffer(offer: BookyJourneyHostOffer | null, plan: BookyJourneyPlan, nodeId: string) {
    const node = plan.nodes.find(item => item.id === nodeId);
    return !!offer && !!node && offer.journeyId === plan.id && offer.version === plan.version && offer.locale === plan.locale
      && offer.definitionChecksum === plan.definitionChecksum && offer.nodeId === nodeId && offer.node.id === nodeId
      && Number.isSafeInteger(offer.hostRevision) && offer.hostRevision >= 0
      && offer.node.kind === node.kind && offer.node.screen === node.screen
      && JSON.stringify(entityKey(offer.node)) === JSON.stringify(entityKey(node))
      && offer.node.dialogue.checksum === node.dialogue.checksum;
  }
  function capture(token: number): Observation | null {
    if (reading || disposed) { failClosed(); return null; }
    reading = true;
    try {
      const host = readHost(), revision = host?.revision;
      if (epoch !== token || disposed) return null;
      if (host && (!Number.isSafeInteger(revision) || revision! < 0 || !Array.isArray(host.plans) || host.plans.length > 128)) return null;
      const plans: BookyJourneyPlan[] = [];
      if (host?.active && typeof host.profileKey === "string" && host.profileKey.length > 0) {
        const keys = new Set<string>();
        for (const plan of host.plans) {
          if (plan.locale !== host.locale || plan.nodes.length < 2 || plan.nodes.length > 32) continue;
          const key = bookyJourneyRouteKey(plan);
          if (keys.has(key)) return null;
          keys.add(key);
          const offer = host.resolve(plan, plan.nodes[0].id);
          if (epoch !== token || disposed) return null;
          if (validOffer(offer, plan, plan.nodes[0].id)) plans.push(plan);
        }
      }
      const current = readHost();
      return epoch === token && !disposed && current === host && current?.revision === revision ? { host, plans } : null;
    } catch { return null; }
    finally { reading = false; }
  }
  function resolve(observed: Observation, plan: BookyJourneyPlan, index: number, token: number): BookyJourneyHostOffer | null {
    if (!observed.host || reading || disposed) return null;
    reading = true;
    try {
      const host = observed.host, revision = host.revision;
      if (readHost() !== host || epoch !== token) return null;
      const offer = host.resolve(plan, plan.nodes[index].id);
      const current = readHost();
      return epoch === token && !disposed && current === host && current.revision === revision
        && validOffer(offer, plan, plan.nodes[index].id) ? offer : null;
    } catch { return null; }
    finally { reading = false; }
  }
  function refresh(): Observation | null {
    if (disposed) return null;
    if (reading) { failClosed(); return null; }
    const token = ++epoch, observed = capture(token);
    if (!observed) { if (epoch === token) failClosed(); return null; }
    if (session) {
      const host = observed.host;
      let plan = currentPlan(observed);
      if (!plan && host?.active && host.profileKey === session.profileKey && host.locale !== session.locale) {
        const alternatives = observed.plans.filter(candidate => candidate.id === session!.id && candidate.version === session!.version
          && candidate.locale === host.locale && topology(candidate) === session!.topology);
        if (alternatives.length === 1) {
          plan = alternatives[0]; session.locale = plan.locale; session.definitionChecksum = plan.definitionChecksum;
          if (session.phase === "navigating") session.phase = "paused";
          cancelNavigation();
        }
      }
      if (epoch !== token || disposed) return null;
      if (!plan) {
        session.phase = host && host.profileKey === session.profileKey && !host.active
          ? session.completedCount === session.total ? "complete" : "paused" : "unavailable";
        cancelNavigation();
      } else if (session.phase === "unavailable") session.phase = session.completedCount === session.total ? "complete" : "paused";
      else if (session.phase === "ready" && !matches(plan.nodes[session.index], host!.view)) {
        session.phase = "paused"; cancelNavigation();
      } else if (session.phase === "navigating" && navigation?.accepted) {
        // Reopening the current target can leave its old settled view visible
        // until the host commits the new command. Only a new view observation
        // can acknowledge this movement; unrelated host changes do not count.
        if (host!.view !== navigation.originView) {
          if (matches(plan.nodes[session.index], host!.view)) session.phase = "ready";
          else if (host!.view.settled && viewKey(host!.view) !== navigation.view) { session.phase = "paused"; cancelNavigation(); }
        }
      }
    }
    if (epoch !== token || disposed) return null;
    publish(observed);
    return epoch === token && !disposed ? observed : null;
  }
  function prepare(revision: number): Observation | null {
    if (!Number.isSafeInteger(revision) || revision !== snapshot.revision) return null;
    const observed = refresh();
    return observed && revision === snapshot.revision ? observed : null;
  }
  function move(observed: Observation, index: number, acknowledged: number): boolean {
    const target = session, plan = currentPlan(observed);
    if (!target || !plan || !observed.host) return false;
    const token = ++epoch, offer = resolve(observed, plan, index, token);
    if (!offer) { if (epoch === token) failClosed(); return false; }
    cancelNavigation();
    if (epoch !== token || disposed || session !== target) return false;
    const pending: Navigation = { session: target, controller: new AbortController(), accepted: false,
      originIndex: target.index, originCount: target.completedCount, originView: observed.host.view, view: viewKey(observed.host.view) };
    navigation = pending; target.index = index; target.phase = "navigating";
    publish(observed);
    if (epoch !== token || disposed || session !== target || navigation !== pending) return false;
    // A view observer may revoke the host without calling refresh itself.
    const finalOffer = resolve(observed, plan, index, token);
    if (!finalOffer) { if (epoch === token) failClosed(); return false; }
    let accepted = false;
    try { accepted = navigate(finalOffer, pending.controller.signal) === true; } catch { /* Explicit retry only. */ }
    if (disposed || session !== target || navigation !== pending || pending.controller.signal.aborted) return false;
    if (accepted) {
      // Navigation may synchronously update the host or revoke policy. A
      // successful port return alone cannot acknowledge a now-revoked step.
      const after = refresh(), current = after && currentPlan(after), confirmation = ++epoch;
      if (!after || !current || session !== target || navigation !== pending
        || !resolve(after, current, target.index, confirmation)) {
        if (session === target && navigation === pending) failClosed();
        return false;
      }
      pending.accepted = true; target.completedCount = acknowledged;
    } else { target.phase = "failed"; cancelNavigation(); }
    refresh();
    return accepted && session === target;
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { if (!disposed) listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() { refresh(); },
    start(routeKey: string, revision: number): boolean {
      const observed = prepare(revision), plan = observed?.plans.find(item => bookyJourneyRouteKey(item) === routeKey);
      if (!observed?.host?.profileKey || !plan) return false;
      const token = ++epoch;
      cancelNavigation(); if (epoch !== token || disposed) return false;
      session = { id: plan.id, version: plan.version, locale: plan.locale, definitionChecksum: plan.definitionChecksum,
        topology: topology(plan), profileKey: observed.host.profileKey, index: 0, total: plan.nodes.length, completedCount: 0, phase: "paused" };
      return move(observed, 0, 0);
    },
    open(revision: number): boolean {
      const observed = prepare(revision);
      return !!observed && !!session && (session.phase === "ready" || session.phase === "failed")
        && move(observed, session.index, session.completedCount);
    },
    next(revision: number): boolean {
      const observed = prepare(revision), plan = observed && currentPlan(observed);
      if (!observed?.host || !session || !plan || session.phase !== "ready" || !matches(plan.nodes[session.index], observed.host.view)) return false;
      const target = session, token = ++epoch;
      if (!resolve(observed, plan, target.index, token)) { if (epoch === token) failClosed(); return false; }
      if (target.index + 1 < target.total) return move(observed, target.index + 1, target.index + 1);
      cancelNavigation();
      if (epoch !== token || disposed || session !== target) return false;
      if (!resolve(observed, plan, target.index, token)) { if (epoch === token) failClosed(); return false; }
      target.completedCount = target.total; target.phase = "complete";
      publish(observed); return session === target && target.phase === "complete";
    },
    pause(revision: number): boolean {
      const observed = prepare(revision);
      if (!observed || !session || session.phase === "complete" || session.phase === "paused") return false;
      const token = ++epoch; session.phase = "paused"; cancelNavigation();
      if (epoch !== token || disposed) return false;
      publish(observed); return true;
    },
    resume(revision: number): boolean {
      const observed = prepare(revision);
      return !!observed && !!session && session.phase === "paused" && !!currentPlan(observed)
        && move(observed, session.index, session.completedCount);
    },
    reset(revision: number): boolean {
      const observed = prepare(revision);
      if (!observed || !session) return false;
      const token = ++epoch; session = null; cancelNavigation();
      if (epoch !== token || disposed) return false;
      publish(observed); return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; ++epoch; session = null; cancelNavigation(); publish({ host: null, plans: [] }); listeners.clear();
    },
  });
}
export type BookyJourneyRuntime = ReturnType<typeof createBookyJourneyRuntime>;
