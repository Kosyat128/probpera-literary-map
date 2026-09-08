import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { PreferenceStore } from "../platform/ports";
import Button from "../ui/Button";
import IconButton from "../ui/IconButton";
import BrandCloseIcon from "../components/BrandCloseIcon";
import "./planetWelcome.css";

export const PLANET_WELCOME_PREFERENCE_KEY = "probpera-planet-welcome-v1";
export const PLANET_WELCOME_COMPLETED_VALUE = "completed";

/** Implementation drafts; synchronized editorial approval remains a release gate. */
export const planetWelcomeCopy = {
  reviewStatus: "draft", productionReady: false,
  ru: {
    title: "Начните путешествие",
    description: "Вращайте глобус, выбирайте страны и открывайте их писателей. Начните со случайной страны или воспользуйтесь поиском.",
    journey: "Случайная страна", search: "Найти автора", close: "Закрыть подсказку",
  },
  en: {
    title: "Begin your journey",
    description: "Rotate the globe, choose countries and discover their writers. Start with a random country or use search.",
    journey: "Random country", search: "Find a writer", close: "Dismiss welcome",
  },
} as const;

export interface PlanetWelcomeMemory {
  suppressed: boolean;
  eligibilityObserved: boolean;
}
export interface PlanetWelcomeSession {
  setAvailability(ready: boolean, eligible: boolean): void;
  complete(action?: () => void): boolean;
  dispose(): void;
}

/** One view session; preference IO cannot reopen a dismissed or navigated view.
 * The component creates it in an effect so StrictMode can release each instance.
 * Its small explicit seam permits real pending-IO/reentrancy lifecycle tests. */
export function createPlanetWelcomeSession(options: {
  preferences: PreferenceStore;
  memory: PlanetWelcomeMemory;
  ready: boolean;
  eligible: boolean;
  onVisibilityChange: (visible: boolean) => void;
}): PlanetWelcomeSession {
  const { preferences, memory, onVisibilityChange } = options;
  let disposed = false;
  let ready = options.ready;
  let eligible = options.eligible;
  let readSettled = false;
  let visible = false;

  function publish(next: boolean) {
    if (disposed || visible === next) return;
    visible = next;
    onVisibilityChange(next);
  }
  function reconcile() {
    publish(readSettled && ready && eligible && !memory.suppressed);
  }
  function setAvailability(nextReady: boolean, nextEligible: boolean) {
    if (disposed) return;
    ready = nextReady;
    eligible = nextEligible;
    if (eligible) memory.eligibilityObserved = true;
    else if (memory.eligibilityObserved) memory.suppressed = true;
    reconcile();
  }
  setAvailability(ready, eligible);
  void Promise.resolve().then(() => disposed ? null : preferences.get(PLANET_WELCOME_PREFERENCE_KEY)).then(value => {
    if (disposed) return;
    if (value === PLANET_WELCOME_COMPLETED_VALUE) memory.suppressed = true;
    readSettled = true;
    reconcile();
  }, () => {
    if (disposed) return;
    // A failed best-effort read cannot block the globe. A visible invitation can
    // still be dismissed immediately for this session without successful IO.
    readSettled = true;
    reconcile();
  });

  return {
    setAvailability,
    complete(action) {
      if (disposed || !visible || memory.suppressed) return false;
      // Commit session dismissal before notifying React or invoking navigation.
      // Reentrant handlers and a second click cannot issue a second action.
      memory.suppressed = true;
      publish(false);
      try { action?.(); }
      finally {
        void Promise.resolve().then(() => preferences.set(
          PLANET_WELCOME_PREFERENCE_KEY, PLANET_WELCOME_COMPLETED_VALUE
        )).catch(() => false);
      }
      return true;
    },
    dispose() { disposed = true; },
  };
}

export type PlanetWelcomeProps = {
  preferences: PreferenceStore;
  ready: boolean;
  eligible: boolean;
  journeyDisabled?: boolean;
  onJourney: () => void;
  onSearch: () => void;
  returnFocusRef: RefObject<HTMLButtonElement>;
};

export default function PlanetWelcome({
  preferences, ready, eligible, journeyDisabled = false, onJourney, onSearch, returnFocusRef,
}: PlanetWelcomeProps) {
  const { language } = useInterfaceLanguage();
  const copy = planetWelcomeCopy[language];
  const titleId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const memory = useRef<PlanetWelcomeMemory>({ suppressed: false, eligibilityObserved: false });
  const controller = useRef<PlanetWelcomeSession | null>(null);
  const availability = useRef({ ready, eligible });
  availability.current = { ready, eligible };
  const [view, setView] = useState<{ preferences: PreferenceStore; visible: boolean }>({ preferences, visible: false });

  useEffect(() => {
    setView({ preferences, visible: false });
    const session = createPlanetWelcomeSession({
      preferences, memory: memory.current, ...availability.current,
      onVisibilityChange: visible => setView({ preferences, visible }),
    });
    controller.current = session;
    return () => {
      session.dispose();
      if (controller.current === session) controller.current = null;
    };
  }, [preferences]);
  useEffect(() => { controller.current?.setAvailability(ready, eligible); }, [ready, eligible, preferences]);

  // The synchronous prop gate hides a view from the previous preference store
  // or newly opened route before the effect updates its session controller.
  if (!ready || !eligible || view.preferences !== preferences || !view.visible || memory.current.suppressed) return null;

  return <section ref={sectionRef} className="planet-welcome" data-planet-welcome="" aria-labelledby={titleId}>
    <div className="planet-welcome__header">
      <h2 id={titleId}>{copy.title}</h2>
      <IconButton
        className="planet-welcome__close" icon={<BrandCloseIcon />} aria-label={copy.close}
        data-planet-welcome-action="close" surface="light" size="md"
        onClick={() => {
          const focusWasInside = sectionRef.current?.contains(document.activeElement) === true;
          controller.current?.complete(() => {
            if (focusWasInside && returnFocusRef.current?.isConnected) {
              returnFocusRef.current.focus({ preventScroll: true });
            }
          });
        }}
      />
    </div>
    <div className="planet-welcome__content">
      <p>{copy.description}</p>
      <div className="planet-welcome__actions">
        <Button variant="primary" surface="light" data-planet-welcome-action="journey" disabled={journeyDisabled}
          onClick={() => { if (!journeyDisabled) controller.current?.complete(onJourney); }}>{copy.journey}</Button>
        <Button variant="secondary" surface="light" data-planet-welcome-action="search"
          onClick={() => { controller.current?.complete(onSearch); }}>{copy.search}</Button>
      </div>
    </div>
  </section>;
}
