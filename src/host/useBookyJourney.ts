import { createBookyJourneyPassport } from "./bookyJourneyPassport";
import { contentTextHash } from "../planet/contentExportHash";
import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Country, BookArchiveEntry } from "../planet/types";
import { resolveCountryGlobeCoordinates } from "../components/globeCoordinates";
import { createBookyJourneyCatalogWithProgress, matchesBookyJourneyProgress } from "./bookyJourneyPrerequisites";
import { readBookyJourneyContent } from "./bookyJourneyContent";
import type { BookyJourneyPlan } from "./bookyJourney";
import type { BookyJourneyHostOffer } from "./bookyJourneyHost";
import { bookyJourneyRouteKey, createBookyJourneyRuntime, type BookyJourneyRuntimeHost } from "./bookyJourneyRuntime";
import { serializeBookyReaderPolicy, type BookyReaderPolicy } from "./bookyReaderPolicy";
import type { createPlanetMascotController, PlanetMascotSnapshot } from "./planetMascot";
import type { PreferenceStore } from "../platform/ports";
import { createBookyJourneyProgressStore } from "./bookyJourneyProgressStore";
import { createBookyJourneyPersistence } from "./bookyJourneyPersistence";
import { readBookyJourneyMigrationContent } from "./bookyJourneyMigrationContent";
import { createBookyJourneyMigrationRegistry } from "./bookyJourneyMigrationRegistry";

import { createBookyJourneyCharacterSession, type BookyJourneyCharacterSessionCurrent } from "./bookyJourneyCharacterSession";
import { isPublishedBookDossierAvailable } from "../books/bookDossierPublicClient";
import { sameBookDossierCharacterView, type BookDossierCharacterViewRequest,
  type BookDossierCharacterViewReceipt, type BookDossierCharacterViewAction } from "../books/bookDossierCharacterView";
import type { BookArchivePublishedDossierView } from "../components/BookArchiveSection";

const EMPTY_COUNTRIES: readonly Country[] = Object.freeze([]);
const EMPTY_BOOKS: readonly BookArchiveEntry[] = Object.freeze([]);

export type BookyJourneyNavigation = (offer: BookyJourneyHostOffer, signal: AbortSignal,
  isCurrent: () => boolean) => boolean;

/** App-owned session: explicit semantic checkpoints persist through the current
 * platform port. Restoring data never navigates or grants editorial approval. */
export function useBookyJourney(input: {
  mascot: ReturnType<typeof createPlanetMascotController>;
  mascotSnapshot: PlanetMascotSnapshot;
  enabled: boolean;
  active: boolean;
  storageActive: boolean;
  preferences: PreferenceStore;
  policy: BookyReaderPolicy | null;
  readPolicy: () => BookyReaderPolicy | null;
  locale: "ru" | "en";
  connectivity: "online" | "offline" | "unknown";
  countryReady: boolean;
  booksReady: boolean;
  countries: readonly Country[];
  books: readonly BookArchiveEntry[];
  view: BookyJourneyRuntimeHost["view"];
  navigate: BookyJourneyNavigation;
  publishedDossier: BookArchivePublishedDossierView | null;
}) {
  const content = useMemo(() => readBookyJourneyContent(), []);
  const characterPublicationAvailable = isPublishedBookDossierAvailable();
  const migrations = useMemo(() => createBookyJourneyMigrationRegistry(readBookyJourneyMigrationContent()), []);
  const countries = useMemo(() => content.definitions.length === 0 ? input.countries : input.countries.map(country => {
    // The public catalog often omits country coordinates. Reuse the globe's
    // canonical fallback/centroid resolver, never coordinates from route content.
    const point = resolveCountryGlobeCoordinates(country);
    return point ? { ...country, coordinates: { lat: point.latitude, lng: point.longitude } } : country;
  }), [content, input.countries]);
  const hostRef = useRef<BookyJourneyRuntimeHost | null>(null);
  const navigateRef = useRef(input.navigate);
  const sequence = useRef(0);
  const { mascot } = input;
  const storage = useMemo(() => createBookyJourneyProgressStore({ preferences: input.preferences }), [input.preferences]);
  const persistenceRef = useRef<ReturnType<typeof createBookyJourneyPersistence> | null>(null);
  const characterReader = useRef<((plan: BookyJourneyPlan, nodeId: string) => BookyJourneyCharacterSessionCurrent | null) | null>(null);
  const characterSession = useMemo(() => createBookyJourneyCharacterSession({
    readCurrent: (plan, nodeId) => characterReader.current?.(plan, nodeId) ?? null,
  }), []);
  const characterRequestRef = useRef<BookDossierCharacterViewRequest | null>(null);
  const acknowledgingRequest = useRef<BookDossierCharacterViewRequest | null>(null);
  const cancelledDuringAcknowledgement = useRef<BookDossierCharacterViewRequest | null>(null);
  const [characterRequest, setCharacterRequest] = useState<BookDossierCharacterViewRequest | null>(null);
  const [characterReceipt, setCharacterReceipt] = useState<BookDossierCharacterViewReceipt | null>(null);
  const retireCharacter = useCallback((owner?: BookDossierCharacterViewRequest) => {
    if (owner && characterRequestRef.current !== owner) return;
    characterSession.clear(); characterRequestRef.current = null;
    setCharacterRequest(null); setCharacterReceipt(null);
  }, [characterSession]);
  const controller = useMemo(() => createBookyJourneyRuntime({ readHost: () => hostRef.current,
    navigate: (offer, signal) => {
      const ownerProfile = hostRef.current?.profileKey;
      const isCurrent = () => {
        const current = hostRef.current;
        if (signal.aborted || !current?.active || current.profileKey !== ownerProfile) return false;
        const plan = current.plans.find(candidate => candidate.id === offer.journeyId && candidate.version === offer.version
          && candidate.locale === offer.locale && candidate.definitionChecksum === offer.definitionChecksum);
        return !!plan && !!current.resolve(plan, offer.nodeId);
      };
      if (!isCurrent()) return false;
      if (offer.node.kind === "character") {
        const current = hostRef.current, activeNode = controller.getSnapshot().active?.node;
        const plan = current?.plans.find(candidate => candidate.id === offer.journeyId && candidate.version === offer.version
          && candidate.locale === offer.locale && candidate.definitionChecksum === offer.definitionChecksum);
        if (!plan || activeNode?.id !== offer.nodeId || activeNode.kind !== "character") return false;
        const request = characterSession.request(plan, offer.nodeId, acknowledgingRequest.current ?? undefined);
        if (!request || !isCurrent()) { characterSession.clear(); return false; }
        characterRequestRef.current = request; setCharacterReceipt(null); setCharacterRequest(request);
        signal.addEventListener("abort", () => {
          // Advancing cancels its old navigation before the runtime's final
          // admission check. Keep this receipt until that synchronous decision;
          // real modal/host revocation still retires it immediately.
          if (acknowledgingRequest.current === request) cancelledDuringAcknowledgement.current = request;
          else retireCharacter(request);
        }, { once: true });
        return true;
      }
      return navigateRef.current(offer, signal, isCurrent);
    } }), [characterSession, retireCharacter]);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const progress = useSyncExternalStore(controller.subscribe, controller.getProgressIntent, controller.getProgressIntent).preference;
  const catalogs = useMemo(() => {
    const build = (preference: typeof progress, locale: "ru" | "en") => createBookyJourneyCatalogWithProgress({ content, policy: input.policy,
      locale, connectivity: input.connectivity, now: new Date().toISOString(),
      publicCountries: input.countryReady ? countries : EMPTY_COUNTRIES,
      publicBooks: input.booksReady ? input.books : EMPTY_BOOKS, characterPublicationAvailable, progress: preference }).catalog;
    const initial = build(progress, input.locale);
    let currentProgress = progress;
    const byLocale = new Map([[input.locale, initial]]);
    return { initial, forProgress(preference: typeof progress, locale = input.locale) {
      if (preference !== currentProgress) { byLocale.clear(); currentProgress = preference; }
      if (!byLocale.has(locale)) byLocale.set(locale, build(preference, locale));
      return byLocale.get(locale)!;
    } };
  }, [content, input.policy, input.locale, input.connectivity, input.countryReady, input.booksReady, countries, input.books, progress, characterPublicationAvailable]);
  const catalog = catalogs.initial;
  const profileKey = serializeBookyReaderPolicy(input.policy);
  const profileFingerprint = profileKey ? contentTextHash(profileKey) : null;
  const active = input.enabled && input.active && input.mascotSnapshot.available
    && input.mascotSnapshot.visibility === "shown" && input.mascotSnapshot.panel === "open";
  // Keep publication ownership independent of receipt/progress-only rendering.
  // A new book, locale, policy, document or lifecycle context cannot reuse an
  // old request, including an A -> B -> A return to the same semantic target.
  const characterSequence = useRef(0);
  const published = input.publishedDossier;
  const characterCurrent = useMemo<BookyJourneyCharacterSessionCurrent>(() => {
    const detail = published?.detail, view = input.view;
    const settled = view.screen === "collection" && view.settled && detail?.active === true && detail.settled
      && detail.countryId === view.countryId && detail.writerId === view.writerId && detail.workId === view.workId;
    const dossier = settled && published && published.document?.bookKey === published.bookKey ? published.document : null;
    return Object.freeze({ identity: Object.freeze({}), profileKey: profileKey ?? "",
      host: Object.freeze({ revision: ++characterSequence.current, enabled: input.enabled,
        active: active && !!settled && characterPublicationAvailable, access: input.policy?.audience === "adult" ? "adult" : "blocked",
        locale: input.locale, countryStatus: input.countryReady ? "ready" : "loading", booksStatus: input.booksReady ? "ready" : "loading",
        dossier, publicCountries: countries, publicBooks: input.books }) });
  }, [active, characterPublicationAvailable, input.enabled, profileKey, input.policy?.audience, input.locale,
    input.countryReady, input.booksReady, countries, input.books, published?.document, published?.bookKey,
    published?.detail.active, published?.detail.settled, published?.detail.countryId, published?.detail.writerId, published?.detail.workId,
    input.view.screen, input.view.settled, input.view.countryId, input.view.writerId, input.view.workId]);
  const readCharacter = useCallback((plan: BookyJourneyPlan, nodeId: string): BookyJourneyCharacterSessionCurrent | null => {
    const current = hostRef.current;
    if (!current?.active || !characterCurrent.host.active || !isPublishedBookDossierAvailable()
      || typeof document !== "undefined" && document.visibilityState === "hidden"
      || current.profileKey !== characterCurrent.profileKey || !current.resolve(plan, nodeId)
      || hostRef.current !== current) return null;
    return characterCurrent;
  }, [characterCurrent]);
  const host = useMemo<BookyJourneyRuntimeHost>(() => {
    const resolve = (plan: BookyJourneyPlan, nodeId: string) => {
      // A just-deleted prerequisite must revoke admission before React commits
      // a new catalog. Live intent also preserves local progress on write failure.
      if (!active || !persistenceRef.current?.getSnapshot().canAct || !profileKey || serializeBookyReaderPolicy(input.readPolicy()) !== profileKey
        || serializeBookyReaderPolicy(mascot.getReaderPolicy()) !== profileKey) return null;
      if (plan.nodes.some(node => node.kind === "character") && !isPublishedBookDossierAvailable()) return null;
      const intent = controller.getProgressIntent().preference, currentCatalog = catalogs.forProgress(intent);
      const currentPlan = currentCatalog.plans.find(candidate => bookyJourneyRouteKey(candidate) === bookyJourneyRouteKey(plan));
      if (!currentPlan) return null;
      const saved = intent.records.find(record => record.policyFingerprint === profileFingerprint
        && record.journeyId === plan.id && record.journeyVersion === plan.version);
      if (saved) {
        const savedPlan = catalogs.forProgress(intent, saved.locale).plans.find(candidate =>
          candidate.id === saved.journeyId && candidate.version === saved.journeyVersion);
        if (!input.policy || !savedPlan || !matchesBookyJourneyProgress(saved, input.policy, currentPlan, savedPlan)) return null;
      }
      const source = currentCatalog.sourceFor(currentPlan);
      if (!source) return null;
      return mascot.resolveJourneyNode({ journeyId: plan.id, version: plan.version, locale: plan.locale,
        definitionChecksum: plan.definitionChecksum, nodeId, hostRevision: mascot.getSnapshot().revision },
      () => hostRef.current?.resolve === resolve && controller.getProgressIntent().preference === intent ? source : null);
    };
    const resolveMigration: NonNullable<BookyJourneyRuntimeHost["resolveMigration"]> = (savedRecord, plan) => {
      const policy = input.readPolicy();
      if (!policy || serializeBookyReaderPolicy(policy) !== profileKey
        || hostRef.current?.resolveMigration !== resolveMigration || !resolve(plan, plan.nodes[0].id)) return null;
      const offer = migrations.resolve(savedRecord, plan, policy, new Date().toISOString());
      // The mapping supplies semantic equivalence, never authority to access
      // its target. Recheck the same currently reviewed whole journey.
      return hostRef.current?.resolveMigration === resolveMigration && resolve(plan, plan.nodes[0].id) ? offer : null;
    };
    return Object.freeze({ revision: ++sequence.current, active, profileKey, locale: input.locale,
      plans: catalog.plans, resolve, resolveMigration, view: input.view,
      canOpenCharacter: (plan, nodeId) => characterSession.canOpen(plan, nodeId),
      canAcknowledgeCharacter: (plan, nodeId, receipt) => characterSession.canAcknowledge(plan, nodeId, receipt) });
  }, [active, profileKey, profileFingerprint, input.policy, input.locale, catalog, migrations, input.view, input.readPolicy, mascot, controller, catalogs, characterSession, characterReceipt, characterCurrent]);
  const persistence = useMemo(() => createBookyJourneyPersistence(controller, storage), [controller, storage]);
  const persistenceSnapshot = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot, persistence.getSnapshot);
  const passportState = !input.policy ? "profile-required" as const
    : persistenceSnapshot.canAct && persistenceSnapshot.storage.state === "ready"
      && !persistenceSnapshot.unsaved && !persistenceSnapshot.clearing ? "ready" as const : "pending" as const;
  const passport = useMemo(() => createBookyJourneyPassport({ content, policy: input.policy,
    locale: input.locale, connectivity: input.connectivity, now: new Date().toISOString(),
    publicCountries: input.countryReady ? countries : EMPTY_COUNTRIES,
    publicBooks: input.booksReady ? input.books : EMPTY_BOOKS, characterPublicationAvailable,
    confirmedProgress: passportState === "ready" ? persistenceSnapshot.storage.preference : null,
  }), [content, input.policy, input.locale, input.connectivity, input.countryReady, input.booksReady,
    countries, input.books, passportState, persistenceSnapshot.storage.preference, characterPublicationAvailable]);
  useLayoutEffect(() => {
    persistenceRef.current = persistence; characterReader.current = readCharacter;
    hostRef.current = persistenceSnapshot.canAct ? host : { ...host, active: false };
    navigateRef.current = input.navigate; controller.refresh();
  }, [controller, host, input.navigate, input.mascotSnapshot.revision, persistence, persistenceSnapshot.canAct, readCharacter]);
  useLayoutEffect(() => {
    const request = characterRequestRef.current;
    if (request && !characterSession.canPresent(request)) retireCharacter(request);
  }, [characterCurrent, characterSession, retireCharacter, snapshot]);
  useLayoutEffect(() => {
    if (input.enabled && input.storageActive) persistence.start(); else persistence.stop();
    return () => persistence.stop();
  }, [persistence, input.enabled, input.storageActive]);
  useLayoutEffect(() => () => {
    // Reversible deactivation works with StrictMode's setup/cleanup replay.
    hostRef.current = null; characterReader.current = null;
    retireCharacter(); controller.refresh();
  }, [controller, retireCharacter]);
  const canPresentCharacter = useCallback((request: BookDossierCharacterViewRequest) =>
    request === characterRequestRef.current && characterSession.canPresent(request), [characterSession]);
  // Each observer belongs to one request. A queued null from the old child
  // cannot retire a replacement after reopening the same character.
  const observeCharacter = useCallback((receipt: BookDossierCharacterViewReceipt | null) => {
    if (!characterRequest || characterRequestRef.current !== characterRequest) return;
    const observed = characterSession.observe(characterRequest, receipt);
    if (!observed || !receipt) {
      if (characterSession.getRequest() !== characterRequest) retireCharacter(characterRequest);
      return;
    }
    setCharacterReceipt(previous => previous && sameBookDossierCharacterView(previous, receipt) ? previous : receipt);
  }, [characterRequest, characterSession, retireCharacter]);
  const characterAction = useMemo<BookDossierCharacterViewAction | null>(() => {
    if (!characterRequest || !characterReceipt || !sameBookDossierCharacterView(characterRequest, characterReceipt)
      || snapshot.active?.node?.kind !== "character" || snapshot.active.phase !== "ready") return null;
    const last = snapshot.active.index + 1 >= snapshot.active.total;
    return Object.freeze({ receipt: characterReceipt,
      label: input.locale === "ru" ? last ? "Подтвердить и завершить" : "Подтвердить шаг"
        : last ? "Acknowledge and finish" : "Acknowledge step",
      onAcknowledge: (receipt: BookDossierCharacterViewReceipt) => {
        if (characterRequestRef.current !== characterRequest || !persistenceRef.current?.getSnapshot().canAct) return false;
        if (acknowledgingRequest.current) return false;
        acknowledgingRequest.current = characterRequest;
        try {
          const accepted = characterSession.acknowledge(receipt, () =>
            controller.acknowledgeCharacter(receipt, controller.getSnapshot().revision));
          if (accepted) retireCharacter(characterRequest);
          return accepted;
        } finally {
          acknowledgingRequest.current = null;
          if (cancelledDuringAcknowledgement.current === characterRequest) {
            cancelledDuringAcknowledgement.current = null; retireCharacter(characterRequest);
          }
        }
      } });
  }, [characterRequest, characterReceipt, characterSession, controller, input.locale, retireCharacter, snapshot]);
  return { controller, snapshot, persistence, persistenceSnapshot, passport, passportState,
    characterRequest, characterAction, canPresentCharacter, observeCharacter,
    needsBooks: !!input.policy && !input.booksReady && content.definitions.some(route => route.nodes.some(node => node.entity?.kind === "work" || node.kind === "activity")) };
}
