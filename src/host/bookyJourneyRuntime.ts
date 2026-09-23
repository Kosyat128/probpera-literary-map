import { parseBookyJourneyPlanOverview, type BookyJourneyPlan, type BookyJourneyPlanOverview } from "./bookyJourney";
import type { BookyJourneyHostOffer } from "./bookyJourneyHost";
import { contentTextHash } from "../planet/contentExportHash";
import { parseBookyReaderPolicy, serializeBookyReaderPolicy } from "./bookyReaderPolicy";
import { BOOKY_JOURNEY_PROGRESS_MAX_RECORDS, DEFAULT_BOOKY_JOURNEY_PROGRESS, createBookyJourneyProgressRecord, parseBookyJourneyProgress,
  type BookyJourneyProgressNode, type BookyJourneyProgressPreference, type BookyJourneyProgressRecord } from "./bookyJourneyProgress";

export type BookyJourneyMigrationOffer = Readonly<{ migrationId: string; migrationChecksum: string;
  preservedRecord: BookyJourneyProgressRecord; targetRecord: BookyJourneyProgressRecord }>;
export type BookyJourneyRuntimeHost = Readonly<{
  /** Replace this immutable view after every policy, source or displayed-view change. */
  revision: number;
  active: boolean;
  profileKey: string | null;
  locale: "ru" | "en";
  plans: readonly BookyJourneyPlan[];
  resolve: (plan: BookyJourneyPlan, nodeId: string) => BookyJourneyHostOffer | null;
  resolveMigration?: (savedRecord: BookyJourneyProgressRecord, currentPlan: BookyJourneyPlan) => BookyJourneyMigrationOffer | null;
  /** New reference after a navigation command commits, including a no-op. */
  view: Readonly<{ screen: "globe" | "collection"; countryId: string | null;
    writerId: string | null; workId: string | null; settled: boolean }>;
}>;
export type BookyJourneyActivityAnswer = Readonly<{ choiceId: string | null;
  status: "unanswered" | "incorrect" | "correct"; canAnswer: boolean }>;
type Phase = "navigating" | "ready" | "paused" | "unavailable" | "failed" | "complete";
export type BookyJourneyRuntimeSnapshot = Readonly<{
  revision: number;
  status: "profile-required" | "unavailable" | "ready";
  routes: readonly Readonly<{ key: string; title: string; canStart: boolean; overview?: BookyJourneyPlanOverview }>[];
  historyCapacity: Readonly<{ used: number; limit: number; full: boolean }>;
  migrations: readonly Readonly<{ key: string; title: string; fromVersion: number; toVersion: number }>[];
  history: readonly Readonly<{ key: string; title: string | null; journeyId: string; version: number; locale: "ru" | "en";
    completedCount: number; total: number; selected: boolean; canSelect: boolean; available: boolean }>[];
  active: Readonly<{ title: string | null; node: BookyJourneyPlan["nodes"][number] | null;
    index: number; total: number; completedCount: number; phase: Phase; canOpen: boolean; canNext: boolean; answer: BookyJourneyActivityAnswer | null }> | null;
}>;
export function bookyJourneyRouteKey(plan: Pick<BookyJourneyPlan, "id" | "version" | "locale" | "definitionChecksum">): string {
  return JSON.stringify([plan.id, plan.version, plan.locale, plan.definitionChecksum]);
}
type Session = { id: string; version: number; locale: "ru" | "en"; definitionChecksum: string;
  topology: string; profileKey: string | null; policyFingerprint: string | null; recordId: string | null;
  index: number; total: number; completedCount: number; phase: Phase };
export type BookyJourneyProgressIntent = Readonly<{ revision: number; preference: BookyJourneyProgressPreference }>;
type MigrationCandidate = { key: string; plan: BookyJourneyPlan; offer: BookyJourneyMigrationOffer };
type Observation = { host: BookyJourneyRuntimeHost | null; plans: readonly BookyJourneyPlan[]; migrations?: readonly MigrationCandidate[] };
type Navigation = { session: Session; controller: AbortController; accepted: boolean;
  originIndex: number; originCount: number; originView: BookyJourneyRuntimeHost["view"]; view: string; rollback?: Session };
const emptyRoutes = Object.freeze([]);
function routeOverview(plan: BookyJourneyPlan): BookyJourneyPlanOverview | null | undefined {
  const field = Object.getOwnPropertyDescriptor(plan, "overview");
  if (!field) return undefined;
  return "value" in field && field.enumerable ? parseBookyJourneyPlanOverview(field.value) : null;
}
const entityKey = (node: Pick<BookyJourneyProgressNode, "entity">) => {
  const entity = node.entity;
  return entity === null ? null : entity.kind === "country" ? [entity.kind, entity.countryId]
    : entity.kind === "writer" ? [entity.kind, entity.countryId, entity.writerId]
      : [entity.kind, entity.countryId, entity.writerId, entity.workId];
};
type IdentityNode = BookyJourneyProgressNode | BookyJourneyPlan["nodes"][number];
const activityKey = (node: IdentityNode) => {
  const activity = node.activity;
  if (node.kind !== "activity" || !activity) return null;
  return "spec" in activity ? [activity.spec.id, activity.spec.version, activity.semanticChecksum]
    : [activity.id, activity.version, activity.semanticChecksum];
};
const factKey = (node: IdentityNode) => {
  const fact = node.fact;
  if (node.kind !== "sourced-fact" || !fact) return null;
  return "spec" in fact ? [fact.spec.id, fact.spec.version, fact.semanticChecksum]
    : [fact.id, fact.version, fact.semanticChecksum];
};
const topology = (plan: { nodes: readonly IdentityNode[] }) => JSON.stringify(plan.nodes.map(node => {
  const fields = [node.id, node.kind, entityKey(node), node.screen];
  return node.kind === "activity" ? [...fields, activityKey(node)]
    : node.kind === "sourced-fact" ? [...fields, factKey(node)] : fields;
}));
const fingerprint = (profileKey: string | null) => {
  const serialized = serializeBookyReaderPolicy(profileKey);
  return serialized ? contentTextHash(serialized) : null;
};
const sameProfile = (target: Session, host: BookyJourneyRuntimeHost) => target.policyFingerprint !== null
  ? fingerprint(host.profileKey) === target.policyFingerprint : host.profileKey === target.profileKey;
const storedSession = (record: BookyJourneyProgressRecord): Session => ({ id: record.journeyId, version: record.journeyVersion,
  locale: record.locale, definitionChecksum: record.definitionChecksum, topology: topology(record), profileKey: null,
  policyFingerprint: record.policyFingerprint, recordId: record.recordId,
  index: Math.min(record.acknowledgedNodeIds.length, record.nodes.length - 1), total: record.nodes.length,
  completedCount: record.acknowledgedNodeIds.length, phase: "unavailable" });
const viewKey = (view: BookyJourneyRuntimeHost["view"]) => JSON.stringify(view);
const semanticKey = (node: BookyJourneyProgressNode) => JSON.stringify(node.kind === "activity"
  ? [node.kind, node.screen, entityKey(node), activityKey(node)]
  : node.kind === "sourced-fact" ? [node.kind, node.screen, entityKey(node), factKey(node)] : [node.kind, node.screen, entityKey(node)]);
function matches(node: BookyJourneyPlan["nodes"][number], view: BookyJourneyRuntimeHost["view"]) {
  if (!view.settled || node.screen !== view.screen) return false;
  const entity = node.entity;
  return entity === null ? node.kind === "checkpoint" || node.kind === "activity" : view.countryId === entity.countryId
    && (entity.kind === "country" || view.writerId === entity.writerId && (entity.kind === "writer" || view.workId === entity.workId));
}

/** An explicit adult navigation session, never proof of reading or storage.
 * Only semantic identity/counters survive suspension. Every displayed copy and
 * gesture is read from the current reviewed host; no timer or scene is owned. */
export function createBookyJourneyRuntime({ readHost, navigate }: {
  readHost: () => BookyJourneyRuntimeHost | null;
  navigate: (offer: BookyJourneyHostOffer, signal: AbortSignal) => boolean;
}) {
  let snapshot: BookyJourneyRuntimeSnapshot = Object.freeze({ revision: 0, status: "unavailable", routes: emptyRoutes,
    historyCapacity: Object.freeze({ used: 0, limit: BOOKY_JOURNEY_PROGRESS_MAX_RECORDS, full: false }),
    migrations: emptyRoutes, history: emptyRoutes, active: null });
  let session: Session | null = null, navigation: Navigation | null = null;
  let progressIntent: BookyJourneyProgressIntent = Object.freeze({ revision: 0, preference: DEFAULT_BOOKY_JOURNEY_PROGRESS });
  let progressViewRevision = 0;
  // An answer is a transient gesture, never a persisted acknowledgement. Its
  // binding includes the derived author as well as the reviewed raw task.
  let answer: { binding: string; choiceId: string; status: "incorrect" | "correct" } | null = null;
  function answerBinding(plan: BookyJourneyPlan, node: BookyJourneyPlan["nodes"][number]) {
    return JSON.stringify([bookyJourneyRouteKey(plan), session?.profileKey, session?.policyFingerprint,
      session?.index, node.id, node.activity, node.activityChoices]);
  }
  function correctAnswer(plan: BookyJourneyPlan, node: BookyJourneyPlan["nodes"][number]) {
    return node.kind !== "activity" || !!node.activity && answer?.binding === answerBinding(plan, node)
      && answer.status === "correct" && answer.choiceId === node.activity.correctChoiceId;
  }
  let disposed = false, reading = false, epoch = 0;
  let renderedHost: BookyJourneyRuntimeHost | null = null, renderedRevision: number | null = null, renderedKey = "";
  const listeners = new Set<() => void>();

  function progressFor(observed: Observation, plan: BookyJourneyPlan, acknowledged: number) {
    const policy = parseBookyReaderPolicy(observed.host?.profileKey);
    // Existing opaque host identities retain their ephemeral runtime contract.
    if (!policy) return undefined;
    const record = createBookyJourneyProgressRecord(policy, plan, plan.nodes.slice(0, acknowledged).map(node => node.id),
      plan.nodes[acknowledged]?.id ?? null);
    if (!record) return null;
    const previous = progressIntent.preference, records = [...previous.records];
    const index = records.findIndex(item => item.recordId === record.recordId);
    if (index < 0) records.push(record); else records[index] = record;
    const preference = parseBookyJourneyProgress({ ...previous, activeRecordId: record.recordId, records });
    return preference ? { preference, record } : null;
  }
  function commitProgress(preference: BookyJourneyProgressPreference, force = false) {
    if (!force && JSON.stringify(preference) === JSON.stringify(progressIntent.preference)) return;
    progressIntent = Object.freeze({ revision: progressIntent.revision + 1, preference });
    ++progressViewRevision;
  }

  function migrationCandidate(host: BookyJourneyRuntimeHost, plan: BookyJourneyPlan, saved: BookyJourneyProgressRecord,
    input: BookyJourneyMigrationOffer | null): MigrationCandidate | null {
    if (!input || !host.active || saved.locale !== host.locale || saved.locale !== plan.locale || saved.journeyId !== plan.id
      || saved.journeyVersion >= plan.version || saved.policyFingerprint !== fingerprint(host.profileKey)) return null;
    const prototype = Object.getPrototypeOf(input), descriptors = Object.getOwnPropertyDescriptors(input);
    const fields = ["migrationId", "migrationChecksum", "preservedRecord", "targetRecord"];
    if (prototype !== Object.prototype && prototype !== null || Reflect.ownKeys(descriptors).length !== fields.length
      || fields.some(key => !descriptors[key] || !("value" in descriptors[key]) || !descriptors[key].enumerable)) return null;
    const migrationId: unknown = descriptors.migrationId.value, migrationChecksum: unknown = descriptors.migrationChecksum.value;
    if (typeof migrationId !== "string" || !/^[a-z][a-z0-9._:-]{0,95}$/.test(migrationId)
      || typeof migrationChecksum !== "string" || !/^[a-f0-9]{64}$/.test(migrationChecksum)) return null;
    const pair = parseBookyJourneyProgress({ ...DEFAULT_BOOKY_JOURNEY_PROGRESS,
      records: [descriptors.preservedRecord.value, descriptors.targetRecord.value] });
    if (!pair || JSON.stringify(pair.records[0]) !== JSON.stringify(saved)) return null;
    const target = pair.records[1], policy = parseBookyReaderPolicy(host.profileKey);
    const canonical = policy && createBookyJourneyProgressRecord(policy, plan, target.acknowledgedNodeIds, target.resumeNodeId);
    if (!canonical || JSON.stringify(canonical) !== JSON.stringify(target)
      || target.resumeNodeId === null && saved.resumeNodeId !== null
      || saved.resumeNodeId === null && target.resumeNodeId !== null && target.nodes[target.acknowledgedNodeIds.length].kind !== "checkpoint"
      || progressIntent.preference.records.some(record => record.recordId === target.recordId)
      || !parseBookyJourneyProgress({ ...progressIntent.preference, records: [...progressIntent.preference.records, target] })) return null;
    // A forged resolver cannot manufacture progress: transferred target nodes
    // must be an ordered semantic subset of the old acknowledged prefix.
    let sourceIndex = 0;
    for (const id of target.acknowledgedNodeIds) {
      const node = target.nodes.find(node => node.id === id)!;
      while (sourceIndex < saved.acknowledgedNodeIds.length && semanticKey(saved.nodes[sourceIndex]) !== semanticKey(node)) ++sourceIndex;
      if (sourceIndex >= saved.acknowledgedNodeIds.length) return null;
      ++sourceIndex;
    }
    const offer = Object.freeze({ migrationId, migrationChecksum, preservedRecord: pair.records[0], targetRecord: target });
    return { key: JSON.stringify([saved.recordId, bookyJourneyRouteKey(plan), migrationId, migrationChecksum]), plan, offer };
  }

  function cancelNavigation() {
    answer = null;
    const pending = navigation; navigation = null;
    if (!pending) return;
    if (!pending.accepted) {
      pending.session.index = pending.originIndex; pending.session.completedCount = pending.originCount;
      if (pending.rollback && session === pending.session) session = pending.rollback;
    }
    pending.controller.abort();
  }
  function currentPlan(observed: Observation): BookyJourneyPlan | null {
    const host = observed.host, target = session;
    if (!target || !host?.active || !sameProfile(target, host)) return null;
    return observed.plans.find(plan => bookyJourneyRouteKey(plan) === bookyJourneyRouteKey(target)
      && topology(plan) === target.topology) ?? null;
  }
  function historyPlan(observed: Observation, record: BookyJourneyProgressRecord): BookyJourneyPlan | null {
    if (!observed.host?.active || record.policyFingerprint !== fingerprint(observed.host.profileKey)) return null;
    const plans = observed.plans.filter(plan => plan.id === record.journeyId && plan.version === record.journeyVersion
      && topology(plan) === topology(record) && (plan.locale !== record.locale || plan.definitionChecksum === record.definitionChecksum));
    return plans.length === 1 ? plans[0] : null;
  }
  function publish(observed: Observation) {
    const host = observed.host, plan = currentPlan(observed);
    const status = host?.profileKey === null ? "profile-required" : observed.plans.length ? "ready" : "unavailable";
    const used = progressIntent.preference.records.length;
    const historyCapacity = Object.freeze({ used, limit: BOOKY_JOURNEY_PROGRESS_MAX_RECORDS, full: used >= BOOKY_JOURNEY_PROGRESS_MAX_RECORDS });
    // This is only slot eligibility. Admission, retained history and current
    // authority are still checked again by Start; no history is evicted here.
    const routes = Object.freeze(observed.plans.map(plan => {
      const overview = routeOverview(plan);
      return Object.freeze({ key: bookyJourneyRouteKey(plan), title: plan.title,
        canStart: progressFor(observed, plan, 0) !== null, ...(overview ? { overview } : {}) });
    }));
    const migrations = Object.freeze(session?.phase === "unavailable" ? (observed.migrations ?? []).map(candidate => Object.freeze({
      key: candidate.key, title: candidate.plan.title, fromVersion: candidate.offer.preservedRecord.journeyVersion,
      toVersion: candidate.offer.targetRecord.journeyVersion })) : []);
    const currentFingerprint = host?.active ? fingerprint(host.profileKey) : null;
    const history = Object.freeze(progressIntent.preference.records.map(record => {
      const admitted = historyPlan(observed, record);
      return Object.freeze({ key: record.recordId, title: admitted?.title ?? null, journeyId: record.journeyId,
        version: record.journeyVersion, locale: record.locale, completedCount: record.acknowledgedNodeIds.length, total: record.nodes.length,
        selected: progressIntent.preference.activeRecordId === record.recordId,
        canSelect: currentFingerprint !== null && currentFingerprint === record.policyFingerprint, available: admitted !== null });
    }));
    const node = plan && session && session.phase !== "unavailable" ? plan.nodes[session.index] ?? null : null;
    const currentAnswer = node?.kind === "activity" && node.activity && plan ? answer?.binding === answerBinding(plan, node) ? answer : null : null;
    const activityAnswer = node?.kind === "activity" && node.activity ? Object.freeze({ choiceId: currentAnswer?.choiceId ?? null,
      status: currentAnswer?.status ?? "unanswered", canAnswer: session?.phase === "ready" && !!host && matches(node, host.view) }) : null;
    const active = session ? Object.freeze({ title: node ? plan!.title : null, node, index: session.index, total: session.total,
      completedCount: session.completedCount, phase: session.phase,
      canOpen: !!node && (session.phase === "ready" || session.phase === "failed"),
      canNext: !!node && session.phase === "ready" && !!host && matches(node, host.view) && correctAnswer(plan!, node), answer: activityAnswer }) : null;
    const key = JSON.stringify([progressViewRevision, status, routes, historyCapacity, migrations, history, active && [active.title, session && bookyJourneyRouteKey(session), active.index,
      active.total, active.completedCount, active.phase, active.canOpen, active.canNext, active.answer, !!active.node]]);
    if (key === renderedKey && host === renderedHost && (host?.revision ?? null) === renderedRevision) return;
    renderedKey = key; renderedHost = host; renderedRevision = host?.revision ?? null;
    const next = Object.freeze({ revision: snapshot.revision + 1, status, routes, historyCapacity, migrations, history, active }); snapshot = next;
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
      && offer.node.dialogue.checksum === node.dialogue.checksum
      && (node.kind === "activity" ? !!node.activity && JSON.stringify(offer.node.activity) === JSON.stringify(node.activity)
        && JSON.stringify(offer.node.activityChoices) === JSON.stringify(node.activityChoices)
        : offer.node.activity === undefined && offer.node.activityChoices === undefined)
      && (node.kind === "sourced-fact" ? !!node.fact && JSON.stringify(offer.node.fact) === JSON.stringify(node.fact)
        : offer.node.fact === undefined);
  }
  function validSemanticNodes(host: BookyJourneyRuntimeHost, plan: BookyJourneyPlan, token: number, checkedNodeId?: string): boolean {
    const revision = host.revision;
    for (const node of plan.nodes) {
      if (node.kind !== "activity" && node.kind !== "sourced-fact" || node.id === checkedNodeId) continue;
      if (epoch !== token || disposed || readHost() !== host) return false;
      const offer = host.resolve(plan, node.id), current = readHost();
      if (epoch !== token || disposed || current !== host || current.revision !== revision || !validOffer(offer, plan, node.id)) return false;
    }
    return true;
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
          if (plan.locale !== host.locale || plan.nodes.length < 2 || plan.nodes.length > 32 || routeOverview(plan) === null) continue;
          const key = bookyJourneyRouteKey(plan);
          if (keys.has(key)) return null;
          keys.add(key);
          const offer = host.resolve(plan, plan.nodes[0].id);
          if (epoch !== token || disposed) return null;
          if (!validOffer(offer, plan, plan.nodes[0].id)) continue;
          // An ordinary-node offer cannot establish every earlier activity or fact
          // binding. Recheck them all, including a node whose Next command has
          // already advanced the temporary navigation cursor.
          const semanticNodesValid = validSemanticNodes(host, plan, token, plan.nodes[0].id);
          if (epoch !== token || disposed) return null;
          if (semanticNodesValid) plans.push(plan);
        }
      }
      const migrations: MigrationCandidate[] = [];
      const saved = progressIntent.preference.records.find(record => record.recordId === progressIntent.preference.activeRecordId
        && record.recordId === session?.recordId);
      if (host?.active && host.resolveMigration && saved && !currentPlan({ host, plans })) {
        for (const plan of plans) {
          if (plan.id !== saved.journeyId || plan.version <= saved.journeyVersion || plan.locale !== saved.locale
            || saved.policyFingerprint !== fingerprint(host.profileKey)) continue;
          const candidate = migrationCandidate(host, plan, saved, host.resolveMigration(saved, plan));
          if (epoch !== token || disposed) return null;
          if (candidate) migrations.push(candidate);
        }
      }
      const current = readHost();
      return epoch === token && !disposed && current === host && current?.revision === revision ? { host, plans, migrations } : null;
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
        && validOffer(offer, plan, plan.nodes[index].id) && validSemanticNodes(host, plan, token, plan.nodes[index].id) ? offer : null;
    } catch { return null; }
    finally { reading = false; }
  }
  function resolveMigration(observed: Observation, expected: MigrationCandidate, token: number): boolean {
    if (!observed.host?.resolveMigration || reading || disposed) return false;
    reading = true;
    try {
      const host = observed.host, revision = host.revision, saved = expected.offer.preservedRecord;
      const plan = observed.plans.find(plan => bookyJourneyRouteKey(plan) === bookyJourneyRouteKey(expected.plan));
      if (epoch !== token || readHost() !== host || progressIntent.preference.activeRecordId !== saved.recordId
        || !plan || !progressIntent.preference.records.some(record => JSON.stringify(record) === JSON.stringify(saved))) return false;
      const candidate = migrationCandidate(host, plan, saved, host.resolveMigration!(saved, plan));
      const current = readHost();
      return epoch === token && !disposed && current === host && current.revision === revision && !!candidate
        && candidate.key === expected.key && JSON.stringify(candidate.offer) === JSON.stringify(expected.offer)
        && validSemanticNodes(host, plan, token);
    } catch { return false; }
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
      if (!plan && host?.active && sameProfile(session, host) && host.locale !== session.locale) {
        const alternatives = observed.plans.filter(candidate => candidate.id === session!.id && candidate.version === session!.version
          && candidate.locale === host.locale && topology(candidate) === session!.topology);
        if (alternatives.length === 1) {
          plan = alternatives[0]; session.locale = plan.locale; session.definitionChecksum = plan.definitionChecksum;
          if (session.phase === "navigating") session.phase = "paused";
          cancelNavigation();
        }
      }
      if (epoch !== token || disposed) return null;
      if (answer && (!plan || answer.binding !== answerBinding(plan, plan.nodes[session.index]))) answer = null;
      if (!plan) {
        session.phase = host && sameProfile(session, host) && !host.active
          ? session.phase === "complete" ? "complete" : "paused" : "unavailable";
        cancelNavigation();
      } else if (session.phase === "unavailable" || session.phase === "paused" && session.completedCount === session.total) {
        session.phase = session.completedCount === session.total ? "complete" : "paused";
      }
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
  function editHistory(key: string, revision: number, remove: boolean): boolean {
    const observed = prepare(revision), previous = progressIntent;
    const record = previous.preference.records.find(item => item.recordId === key);
    const currentFingerprint = observed?.host?.active ? fingerprint(observed.host.profileKey) : null;
    // Explicit deletion may recover capacity occupied by another profile, but
    // selecting it must never disclose copy or adopt its semantic progress.
    if (!observed || !record || !currentFingerprint || !remove && record.policyFingerprint !== currentFingerprint) return false;
    const selected = previous.preference.activeRecordId === key;
    const preference = parseBookyJourneyProgress({ ...previous.preference,
      activeRecordId: remove ? selected ? null : previous.preference.activeRecordId : key,
      records: remove ? previous.preference.records.filter(item => item.recordId !== key) : previous.preference.records });
    if (!preference) return false;
    const token = ++epoch;
    if (!remove || selected || navigation && !navigation.accepted) {
      cancelNavigation();
      if (epoch !== token || disposed || progressIntent !== previous) return false;
      if (session?.phase === "navigating") session.phase = "paused";
    }
    // Abort listeners and sources are external callbacks: recheck the exact
    // host and local intent before consuming the revision-bound user gesture.
    const current = capture(token);
    if (!current || current.host !== observed.host || current.host?.revision !== observed.host?.revision
      || epoch !== token || disposed || progressIntent !== previous) {
      if (epoch === token && !disposed) refresh();
      return false;
    }
    if (!remove) session = storedSession(record);
    else if (selected) session = null;
    commitProgress(preference, true);
    const committed = progressIntent;
    refresh();
    return !disposed && progressIntent === committed;
  }
  function move(observed: Observation, index: number, acknowledged: number, semantic = false,
    migration?: { candidate: MigrationCandidate; original: Session }): boolean {
    const target = session, plan = currentPlan(observed);
    if (!target || !plan || !observed.host) return false;
    if (progressFor(observed, plan, acknowledged) === null) return false;
    const token = ++epoch, offer = resolve(observed, plan, index, token);
    if (!offer) { if (epoch === token) failClosed(); return false; }
    cancelNavigation();
    if (epoch !== token || disposed || session !== target) return false;
    const pending: Navigation = { session: target, controller: new AbortController(), accepted: false,
      originIndex: target.index, originCount: target.completedCount, originView: observed.host.view, view: viewKey(observed.host.view),
      rollback: migration?.original };
    navigation = pending; target.index = index; target.phase = "navigating";
    publish(observed);
    if (epoch !== token || disposed || session !== target || navigation !== pending) return false;
    // A view observer may revoke the host without calling refresh itself.
    const finalOffer = resolve(observed, plan, index, token);
    if (!finalOffer || migration && !resolveMigration(observed, migration.candidate, token)) { if (epoch === token) failClosed(); return false; }
    let accepted = false;
    try { accepted = migration !== undefined && acknowledged === target.total || navigate(finalOffer, pending.controller.signal) === true; } catch { /* Explicit retry only. */ }
    if (disposed || session !== target || navigation !== pending || pending.controller.signal.aborted) return false;
    if (accepted) {
      // Navigation may synchronously update the host or revoke policy. A
      // successful port return alone cannot acknowledge a now-revoked step.
      const after = refresh(), current = after && currentPlan(after), confirmation = ++epoch;
      if (!after || !current || session !== target || navigation !== pending
        || !resolve(after, current, target.index, confirmation)
        || migration && !resolveMigration(after, migration.candidate, confirmation)) {
        if (session === target && navigation === pending) failClosed();
        return false;
      }
      const progress = progressFor(after, current, acknowledged);
      if (progress === null || migration && JSON.stringify(progress?.record) !== JSON.stringify(migration.candidate.offer.targetRecord)) {
        failClosed(); return false;
      }
      pending.accepted = true; target.completedCount = acknowledged;
      if (migration && acknowledged === target.total) target.phase = "complete";
      if (progress) target.recordId = progress.record.recordId;
      commitProgress(progress?.preference ?? progressIntent.preference, semantic);
    } else { target.phase = "failed"; cancelNavigation(); }
    refresh();
    return accepted && session === target;
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    getProgressIntent: () => progressIntent,
    subscribe(listener: () => void) { if (!disposed) listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh() { refresh(); },
    selectHistory(key: string, revision: number): boolean { return editHistory(key, revision, false); },
    deleteHistory(key: string, revision: number): boolean { return editHistory(key, revision, true); },
    migrate(key: string, revision: number): boolean {
      const observed = prepare(revision), candidate = observed?.migrations?.find(item => item.key === key), original = session;
      if (!observed || !candidate || !original || original.phase !== "unavailable") return false;
      const token = ++epoch;
      cancelNavigation(); if (epoch !== token || disposed || session !== original) return false;
      const target = storedSession(candidate.offer.targetRecord); target.phase = "paused"; session = target;
      const accepted = move(observed, target.index, target.completedCount, true, { candidate, original });
      if (!accepted) {
        if (session === target) session = original;
        if (session === original && !disposed) refresh();
      }
      return accepted;
    },
    restoreProgress(input: BookyJourneyProgressPreference, expectedIntentRevision: number): boolean {
      if (disposed || reading || !Number.isSafeInteger(expectedIntentRevision) || expectedIntentRevision !== progressIntent.revision) return false;
      const preference = parseBookyJourneyProgress(input);
      if (!preference) return false;
      const token = ++epoch;
      cancelNavigation();
      if (disposed || epoch !== token || expectedIntentRevision !== progressIntent.revision) return false;
      progressIntent = Object.freeze({ revision: progressIntent.revision, preference });
      ++progressViewRevision;
      const record = preference.records.find(item => item.recordId === preference.activeRecordId);
      session = record ? storedSession(record) : null;
      refresh();
      return !disposed && expectedIntentRevision === progressIntent.revision;
    },
    start(routeKey: string, revision: number): boolean {
      const observed = prepare(revision), plan = observed?.plans.find(item => bookyJourneyRouteKey(item) === routeKey);
      if (!observed?.host?.profileKey || !plan) return false;
      const progress = progressFor(observed, plan, 0);
      if (progress === null) return false;
      const retained = progress && progressIntent.preference.records.find(record => record.recordId === progress.record.recordId);
      const token = ++epoch;
      cancelNavigation(); if (epoch !== token || disposed) return false;
      session = retained ? storedSession(retained) : { id: plan.id, version: plan.version, locale: plan.locale, definitionChecksum: plan.definitionChecksum,
        topology: topology(plan), profileKey: observed.host.profileKey, policyFingerprint: fingerprint(observed.host.profileKey),
        recordId: progress?.record.recordId ?? null, index: 0, total: plan.nodes.length, completedCount: 0, phase: "paused" };
      if (retained) {
        // Same-version edits cannot silently replace an acknowledged history.
        if (session.topology !== topology(plan) || session.locale === plan.locale && session.definitionChecksum !== plan.definitionChecksum) {
          publish(observed); return false;
        }
        session.locale = plan.locale; session.definitionChecksum = plan.definitionChecksum; session.phase = "paused";
      }
      if (session.completedCount === session.total) {
        const target = session, completed = progressFor(observed, plan, target.total);
        if (completed === null || !resolve(observed, plan, target.index, token)) return false;
        target.phase = "complete";
        commitProgress(completed?.preference ?? progressIntent.preference, true);
        publish(observed); return session === target && target.phase === "complete";
      }
      return move(observed, session.index, session.completedCount, true);
    },
    open(revision: number): boolean {
      const observed = prepare(revision);
      return !!observed && !!session && (session.phase === "ready" || session.phase === "failed")
        && move(observed, session.index, session.completedCount);
    },
    answer(choiceId: string, revision: number): boolean {
      const observed = prepare(revision), plan = observed && currentPlan(observed), target = session;
      const node = plan && target ? plan.nodes[target.index] : null;
      if (!observed?.host || !target || !plan || !node || target.phase !== "ready" || node.kind !== "activity"
        || !node.activity || !matches(node, observed.host.view) || typeof choiceId !== "string"
        || !node.activity.spec.choices.some(choice => choice.id === choiceId)) return false;
      const token = ++epoch;
      if (!resolve(observed, plan, target.index, token)) { if (epoch === token) failClosed(); return false; }
      const selected = { binding: answerBinding(plan, node), choiceId,
        status: choiceId === node.activity.correctChoiceId ? "correct" as const : "incorrect" as const };
      answer = selected;
      publish(observed);
      // Subscribers may synchronously pause/revoke the task. Never report a
      // selection as accepted after that newer intent has invalidated it.
      if (disposed || epoch !== token || session !== target || answer !== selected) return false;
      if (!resolve(observed, plan, target.index, token)) { if (epoch === token) failClosed(); return false; }
      return true;
    },
    next(revision: number): boolean {
      const observed = prepare(revision), plan = observed && currentPlan(observed);
      if (!observed?.host || !session || !plan || session.phase !== "ready" || !matches(plan.nodes[session.index], observed.host.view)
        || !correctAnswer(plan, plan.nodes[session.index])) return false;
      const target = session, token = ++epoch;
      if (!resolve(observed, plan, target.index, token)) { if (epoch === token) failClosed(); return false; }
      if (target.index + 1 < target.total) return move(observed, target.index + 1, target.index + 1, true);
      const progress = progressFor(observed, plan, target.total);
      if (progress === null) return false;
      cancelNavigation();
      if (epoch !== token || disposed || session !== target) return false;
      if (!resolve(observed, plan, target.index, token)) { if (epoch === token) failClosed(); return false; }
      target.completedCount = target.total; target.phase = "complete";
      commitProgress(progress?.preference ?? progressIntent.preference, true);
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
      const target = navigation?.rollback && !navigation.accepted ? navigation.rollback : session, previous = progressIntent.preference;
      const preference = parseBookyJourneyProgress({ ...previous,
        activeRecordId: previous.activeRecordId === target.recordId ? null : previous.activeRecordId,
        records: previous.records.filter(record => record.recordId !== target.recordId) });
      if (!preference) return false;
      const token = ++epoch; session = null; cancelNavigation();
      if (epoch !== token || disposed) return false;
      commitProgress(preference, true);
      publish(observed); return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; ++epoch; session = null; cancelNavigation(); publish({ host: null, plans: [] }); listeners.clear();
    },
  });
}
export type BookyJourneyRuntime = ReturnType<typeof createBookyJourneyRuntime>;
