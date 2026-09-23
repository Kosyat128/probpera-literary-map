import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { Country, BookArchiveEntry } from "../planet/types";
import { resolveCountryGlobeCoordinates } from "../components/globeCoordinates";
import { createBookyJourneyCatalog } from "./bookyJourneyCatalog";
import { readBookyJourneyContent } from "./bookyJourneyContent";
import type { BookyJourneyPlan } from "./bookyJourney";
import type { BookyJourneyHostOffer } from "./bookyJourneyHost";
import { createBookyJourneyRuntime, type BookyJourneyRuntimeHost } from "./bookyJourneyRuntime";
import { serializeBookyReaderPolicy, type BookyReaderPolicy } from "./bookyReaderPolicy";
import type { createPlanetMascotController, PlanetMascotSnapshot } from "./planetMascot";
import type { PreferenceStore } from "../platform/ports";
import { createBookyJourneyProgressStore } from "./bookyJourneyProgressStore";
import { createBookyJourneyPersistence } from "./bookyJourneyPersistence";

const EMPTY_COUNTRIES: readonly Country[] = Object.freeze([]);
const EMPTY_BOOKS: readonly BookArchiveEntry[] = Object.freeze([]);
const NO_PREREQUISITES = Object.freeze([]);

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
}) {
  const content = useMemo(() => readBookyJourneyContent(), []);
  const countries = useMemo(() => content.definitions.length === 0 ? input.countries : input.countries.map(country => {
    // The public catalog often omits country coordinates. Reuse the globe's
    // canonical fallback/centroid resolver, never coordinates from route content.
    const point = resolveCountryGlobeCoordinates(country);
    return point ? { ...country, coordinates: { lat: point.latitude, lng: point.longitude } } : country;
  }), [content, input.countries]);
  const catalog = useMemo(() => createBookyJourneyCatalog({ content, policy: input.policy,
    locale: input.locale, connectivity: input.connectivity, now: new Date().toISOString(),
    publicCountries: input.countryReady ? countries : EMPTY_COUNTRIES,
    publicBooks: input.booksReady ? input.books : EMPTY_BOOKS, completedPrerequisites: NO_PREREQUISITES }),
  [content, input.policy, input.locale, input.connectivity, input.countryReady, input.booksReady, countries, input.books]);
  const profileKey = serializeBookyReaderPolicy(input.policy);
  const hostRef = useRef<BookyJourneyRuntimeHost | null>(null);
  const navigateRef = useRef(input.navigate);
  const sequence = useRef(0);
  const { mascot } = input;
  const storage = useMemo(() => createBookyJourneyProgressStore({ preferences: input.preferences }), [input.preferences]);
  const persistenceRef = useRef<ReturnType<typeof createBookyJourneyPersistence> | null>(null);
  const active = input.enabled && input.active && input.mascotSnapshot.available
    && input.mascotSnapshot.visibility === "shown" && input.mascotSnapshot.panel === "open";
  const host = useMemo<BookyJourneyRuntimeHost>(() => {
    const resolve = (plan: BookyJourneyPlan, nodeId: string) => {
      if (!active || !persistenceRef.current?.getSnapshot().canAct || !profileKey || serializeBookyReaderPolicy(input.readPolicy()) !== profileKey
        || serializeBookyReaderPolicy(mascot.getReaderPolicy()) !== profileKey) return null;
      const source = catalog.sourceFor(plan);
      if (!source) return null;
      return mascot.resolveJourneyNode({ journeyId: plan.id, version: plan.version, locale: plan.locale,
        definitionChecksum: plan.definitionChecksum, nodeId, hostRevision: mascot.getSnapshot().revision },
      () => hostRef.current?.resolve === resolve ? source : null);
    };
    return Object.freeze({ revision: ++sequence.current, active, profileKey, locale: input.locale,
      plans: catalog.plans, resolve, view: input.view });
  }, [active, profileKey, input.locale, catalog, input.view, input.readPolicy, mascot]);
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
      return isCurrent() && navigateRef.current(offer, signal, isCurrent);
    } }), []);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const persistence = useMemo(() => createBookyJourneyPersistence(controller, storage), [controller, storage]);
  const persistenceSnapshot = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot, persistence.getSnapshot);
  useLayoutEffect(() => {
    persistenceRef.current = persistence;
    hostRef.current = persistenceSnapshot.canAct ? host : { ...host, active: false };
    navigateRef.current = input.navigate; controller.refresh();
  }, [controller, host, input.navigate, input.mascotSnapshot.revision, persistence, persistenceSnapshot.canAct]);
  useLayoutEffect(() => {
    if (input.enabled && input.storageActive) persistence.start(); else persistence.stop();
    return () => persistence.stop();
  }, [persistence, input.enabled, input.storageActive]);
  useLayoutEffect(() => () => {
    // Reversible deactivation works with StrictMode's setup/cleanup replay.
    hostRef.current = null;
    controller.refresh();
  }, [controller]);
  return { controller, snapshot, persistence, persistenceSnapshot,
    needsBooks: !!input.policy && !input.booksReady && content.definitions.some(route => route.nodes.some(node => node.kind === "work")) };
}
