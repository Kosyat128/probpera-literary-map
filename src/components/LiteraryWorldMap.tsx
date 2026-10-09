import type { ChildCanonicalResources } from "../child/childNativeCanonicalResources";
import type { ChildEntityReference } from "../child/childPackage";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  type Ref,
  type ReactNode,
} from "react";
import type { Country, WriterProfile } from "../data/countries/types";
import type { WriterFilterState } from "../filters/filterTypes";
import type {
  GlobeCountrySelectionSource,
  GlobeExplicitFocusRequest,
  GlobeCameraViewReceipt,
  LiteraryGlobeMode,
} from "./LiteraryGlobe";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { GlobeViewSample } from "./GlobeViewObserver";
import type { GlobeQualityTier } from "./globeQuality";
import type { GlobeStandPresentation } from "../planet/globeStands";
import type { GlobeBackgroundPresentation } from "../planet/globeBackgrounds";
import type { PlanetCompositionPresentation } from "../host/planetCompositionPresentation";
import type { GlobeSceneInspectionBridge } from "../host/planetSceneInspectionBridge";
import type { GlobeStandInspectionBridge } from "./globeStandInspection";
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

import type { GlobeWebGlRecoveryObservation } from "./globePerformance";

interface Props {
  countries: Country[];
  /** Native compiled child text scope; reuse the canonical scene with sealed adult sources. */
  childPresentation?: boolean;
  childResources?: ChildCanonicalResources;
  onChildHotspot?: (target: ChildEntityReference)=>void;
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
  /** Current module/catalog fallback or the mounted globe's actual atlas state. */
  onLoadStatusChange?: (status: DeferredLoadStatus) => void;
  onSupportWebglObservation?: (value: GlobeWebGlRecoveryObservation | null) => void;
  onCameraViewChange?: (receipt: GlobeCameraViewReceipt) => void;
  onHoverCountryChange?: (country: Country | null) => void;
  focusRequest?: GlobeExplicitFocusRequest | null;
  economical?: boolean;
  qualityTier?: GlobeQualityTier;
  runtimeActive?: boolean;
  bookyCalmMotion?: boolean;
  standCustomization?: GlobeStandPresentation;
  backgroundCustomization?: GlobeBackgroundPresentation;
  composition?: PlanetCompositionPresentation;
  standControls?: ReactNode;
  sourceDialogRequestId?: number;
  sceneInspection?: GlobeSceneInspectionBridge;
  standInspection?: GlobeStandInspectionBridge;
  dataStatus?: DeferredLoadStatus;
  preserveSceneDuringReload?: boolean;
  forceLoad?: boolean;
  onLoadIntent?: () => void;
  onRetryData?: () => void;
}

export default function LiteraryWorldMap({
  countries,
  childPresentation = false,
  childResources,
  onChildHotspot,
  atlasCountries,
  selectedCountry,
  selectedWriter,
  onCountrySelect,
  onWriterSelect,
  showNobelLaureates,
  nobelCountryId,
  mode = "embedded",
  rootRef,
  onLoadStatusChange,
  onSupportWebglObservation,
  onViewSample,
  onCameraViewChange,
  onHoverCountryChange,
  focusRequest,
  economical = false,
  qualityTier,
  runtimeActive = true,
  bookyCalmMotion = true,
  standCustomization,
  backgroundCustomization,
  composition,
  standControls,
  sourceDialogRequestId,
  sceneInspection,
  standInspection,
  dataStatus = "ready",
  preserveSceneDuringReload = false,
  forceLoad = false,
  onLoadIntent,
  onRetryData,
}: Props) {
  const { language, t } = useInterfaceLanguage();
  const [hasRenderedReady, setHasRenderedReady] = useState(false);
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
    active && component !== null && moduleStatus === "ready" && dataStatus === "ready";
  // Latch only a committed ready render. A failed first load must keep its
  // original fallback, including when React Strict Mode replays effects.
  useLayoutEffect(() => {
    if (preserveSceneDuringReload && globeReady) setHasRenderedReady(true);
  }, [globeReady, preserveSceneDuringReload]);
  const retainScene = preserveSceneDuringReload && hasRenderedReady && active &&
    component !== null && moduleStatus === "ready" && dataStatus !== "ready";
  const failed = dataStatus === "error" || moduleStatus === "error";
  useLayoutEffect(() => {
    // Only the displayed fallback reports here. A mounted LiteraryGlobe owns
    // its atlas report; module/catalog readiness cannot stand in for it.
    if (!globeReady && !retainScene) {
      onLoadStatusChange?.(failed ? "error" : active ? "loading" : "idle");
    }
  }, [active, failed, globeReady, retainScene, onLoadStatusChange]);
  const LiteraryGlobe = component;
  const catalogNotice = language === "ru"
    ? dataStatus === "error" ? "Не удалось обновить каталог."
      : dataStatus === "loading" ? "Обновляем каталог…" : "Каталог ещё не готов."
    : dataStatus === "error" ? "The catalog could not be updated."
      : dataStatus === "loading" ? "Updating the catalog…" : "The catalog is not ready yet.";

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
      {(globeReady || retainScene) && LiteraryGlobe ? (
        <LiteraryGlobe
          countries={countries}
          childPresentation={childPresentation}
            childResources={childResources} onChildHotspot={onChildHotspot}
          atlasCountries={atlasCountries}
          selectedCountry={selectedCountry}
          selectedWriter={selectedWriter}
          onCountrySelect={onCountrySelect}
          onWriterSelect={onWriterSelect}
          showNobelLaureates={showNobelLaureates}
          nobelCountryId={nobelCountryId}
          mode={mode}
          onViewSample={onViewSample}
          onLoadStatusChange={onLoadStatusChange}
          onSupportWebglObservation={onSupportWebglObservation}
          onCameraViewChange={onCameraViewChange}
          onHoverCountryChange={onHoverCountryChange}
          focusRequest={focusRequest}
          economical={economical}
          qualityTier={qualityTier}
          runtimeActive={runtimeActive}
          bookyCalmMotion={bookyCalmMotion}
          standCustomization={standCustomization}
          backgroundCustomization={backgroundCustomization}
          composition={composition}
          standControls={standControls}
          sourceDialogRequestId={sourceDialogRequestId}
          sceneInspection={sceneInspection}
          standInspection={standInspection}
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
      {retainScene && (
        <div className="globe-catalog-notice" role="status" aria-live="polite"
          data-globe-catalog-notice={dataStatus}>
          <p>{catalogNotice}</p>
          {dataStatus === "error" && onRetryData && (
            <button type="button" onClick={retry} data-globe-catalog-retry>
              {t("Повторить загрузку")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
