import {
  useCallback,
  useEffect,
  useState,
  type Ref,
} from "react";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import type {
  GlobeCountrySelectionSource,
  GlobeExplicitFocusRequest,
  LiteraryGlobeMode,
} from "./LiteraryGlobe";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { GlobeViewSample } from "./GlobeViewObserver";
import {
  useNearViewportActivation,
  type DeferredLoadStatus,
} from "../loading/nearViewportActivation";

type LiteraryGlobeComponent = typeof import("./LiteraryGlobe")["default"];

let literaryGlobePromise: Promise<LiteraryGlobeComponent> | null = null;

function loadLiteraryGlobe() {
  if (literaryGlobePromise) return literaryGlobePromise;
  literaryGlobePromise = import("./LiteraryGlobe")
    .then((module) => module.default)
    .catch((error) => {
      literaryGlobePromise = null;
      throw error;
    });
  return literaryGlobePromise;
}

const GLOBE_HASH_TARGETS = ["atlas"] as const;

interface Props {
  countries: Country[];
  atlasCountries?: Country[];
  selectedCountry?: Country | null;
  selectedWriter?: WriterProfile | null;
  onCountrySelect?: (
    country: Country,
    source?: GlobeCountrySelectionSource
  ) => void;
  onWriterSelect?: (country: Country, writer: WriterProfile) => void;
  showNobelLaureates?: boolean;
  nobelCountryId?: string | null;
  filters?: WriterFilterState;
  onFiltersChange?: (filters: WriterFilterState) => void;
  mode?: LiteraryGlobeMode;
  rootRef?: Ref<HTMLElement>;
  onViewSample?: (sample: GlobeViewSample) => void;
  onHoverCountryChange?: (country: Country | null) => void;
  focusRequest?: GlobeExplicitFocusRequest | null;
  economical?: boolean;
  dataStatus?: DeferredLoadStatus;
  forceLoad?: boolean;
  onLoadIntent?: () => void;
  onRetryData?: () => void;
}

export default function LiteraryWorldMap({
  countries,
  atlasCountries,
  selectedCountry,
  selectedWriter,
  onCountrySelect,
  onWriterSelect,
  showNobelLaureates,
  nobelCountryId,
  mode = "embedded",
  rootRef,
  onViewSample,
  onHoverCountryChange,
  focusRequest,
  economical = false,
  dataStatus = "ready",
  forceLoad = false,
  onLoadIntent,
  onRetryData,
}: Props) {
  const { t } = useInterfaceLanguage();
  const [attempt, setAttempt] = useState(0);
  const [component, setComponent] =
    useState<LiteraryGlobeComponent | null>(null);
  const [moduleStatus, setModuleStatus] =
    useState<DeferredLoadStatus>("idle");
  const notifyLoadIntent = useCallback(
    () => onLoadIntent?.(),
    [onLoadIntent]
  );
  const { active, setActivationNode } = useNearViewportActivation({
    force: forceLoad,
    hashTargets: GLOBE_HASH_TARGETS,
    rootMargin: "520px 0px",
    onActivate: notifyLoadIntent,
  });

  useEffect(() => {
    if (!active) return undefined;
    let current = true;
    setModuleStatus("loading");
    loadLiteraryGlobe().then(
      (loadedComponent) => {
        if (!current) return;
        setComponent(() => loadedComponent);
        setModuleStatus("ready");
      },
      () => {
        if (current) setModuleStatus("error");
      }
    );
    return () => {
      current = false;
    };
  }, [active, attempt]);

  const setRootNode = useCallback(
    (node: HTMLElement | null) => {
      setActivationNode(node);
      if (typeof rootRef === "function") rootRef(node);
      else if (rootRef) {
        (rootRef as { current: HTMLElement | null }).current = node;
      }
    },
    [rootRef, setActivationNode]
  );

  const retry = useCallback(() => {
    if (dataStatus === "error") onRetryData?.();
    if (moduleStatus === "error") {
      setComponent(null);
      setAttempt((value) => value + 1);
    }
  }, [dataStatus, moduleStatus, onRetryData]);

  const globeReady =
    active && component && moduleStatus === "ready" && dataStatus === "ready";
  const failed = dataStatus === "error" || moduleStatus === "error";
  const LiteraryGlobe = component;

  return (
    <section
      ref={setRootNode}
      className="world-map-stage"
      aria-label={t("Интерактивный литературный глобус")}
      aria-busy={(active && !globeReady && !failed) || undefined}
      data-globe-mode={mode}
      data-loading-status={
        failed ? "error" : globeReady ? "ready" : active ? "loading" : "idle"
      }
    >
      {globeReady && LiteraryGlobe ? (
        <LiteraryGlobe
          countries={countries}
          atlasCountries={atlasCountries}
          selectedCountry={selectedCountry}
          selectedWriter={selectedWriter}
          onCountrySelect={onCountrySelect}
          onWriterSelect={onWriterSelect}
          showNobelLaureates={showNobelLaureates}
          nobelCountryId={nobelCountryId}
          mode={mode}
          onViewSample={onViewSample}
          onHoverCountryChange={onHoverCountryChange}
          focusRequest={focusRequest}
          economical={economical}
        />
      ) : (
        <div className="globe-loading" role="status" aria-live="polite">
          <span aria-hidden="true">✦</span>
          <p>
            {failed
              ? t("Литературную планету не удалось открыть")
              : active
                ? t("Открываем «Литературную планету»…")
                : t("Глобус загрузится при приближении")}
          </p>
          {failed && (
            <button type="button" onClick={retry}>
              {t("Повторить загрузку")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
