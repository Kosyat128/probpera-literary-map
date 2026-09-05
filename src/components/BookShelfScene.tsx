import { Component, lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";

import type { BookShelfPhase } from "../books/bookShelfState";
import type { BookShelfPresentationProfile } from "../books/bookShelfPresentationProfiles";
import type { BookEditorialDocument } from "../books/bookEditorialPages";
import type {
  BookInspectionPageDirection,
  BookInspectionSession,
} from "../books/bookInspectionSession";
import {
  resolveBookShelfQualitySettings,
  type BookShelfQualitySettings,
} from "../books/bookShelfQualityController";
import BookShelfBrandLoader from "./BookShelfBrandLoader";
import type { BookShelfSceneCanvasProps } from "./BookShelfSceneCanvas";
import type { BookShelfViewportInsets } from "../books/bookInspectionCamera";
import { EMPTY_BOOK_SHELF_INSETS, measureBookShelfViewportInsets } from "../books/bookShelfViewportInsets";
import type { BookShelfSpineHit } from "../books/bookShelfPointer";
import { ensureBookTypographyReady } from "../books/bookTypography";

export type BookShelfSpineHover = BookShelfSpineHit;

export type BookShelfPresentationItem = {
  key: string;
  title: string;
  writer: string;
  year?: number;
  coverUrl?: string;
  presentationProfile?: BookShelfPresentationProfile;
  baseColor: string;
  accentColor: string;
  paperColor: string;
  ownerPaletteSlot?: number;
};

export type BookShelfSceneAppearance = {
  shelfColor: string;
  ambientColor: string;
  lightColor: string;
  materialRoughness: number;
  intensity: number;
};

export type BookShelfSceneFailure =
  | "unsupported"
  | "context-lost"
  | "texture-error"
  | "render-error";

export type BookShelfSceneProps = {
  items: readonly BookShelfPresentationItem[];
  appearance: BookShelfSceneAppearance;
  focusedBookKey: string | null;
  selectedBookKey: string | null;
  viewportInsets?: BookShelfViewportInsets;
  onHoveredBookChange?: (hover: BookShelfSpineHover | null) => void;
  onPressedBookChange?: (key: string | null) => void;
  phase: BookShelfPhase;
  requestId: number;
  active: boolean;
  qualitySettings?: BookShelfQualitySettings;
  /** Compatibility signals until the archive controller supplies qualitySettings. */
  economical: boolean;
  reducedMotion: boolean;
  editorialDocument: BookEditorialDocument | null;
  inspectionSession: BookInspectionSession | null;
  loadAttempt: "primary" | "retry";
  onFocusBook: (key: string) => void;
  onOpenBook: (key: string) => void;
  onRequestCoverOpen: (key: string) => void;
  onRequestPageTurn: () => void;
  onRequestPreviousPage: () => void;
  onRequestKeyboardPage: (key: string, shiftKey?: boolean) => boolean;
  onRequestInspectionClose: () => void;
  onRequestSceneCenter: () => void;
  onCrackCover: () => void;
  onStartPageDrag: (direction: BookInspectionPageDirection) => void;
  onUpdatePageDrag: (progress: number) => void;
  onRequestPageSettle: (velocity: number) => void;
  onMotionReached: (requestId: number) => void;
  onMotionSettled: (requestId: number) => void;
  onInspectionEntered: (requestId: number) => void;
  onCoverOpened: (requestId: number) => void;
  onPageSettled: (requestId: number) => void;
  onInspectionClosed: (requestId: number) => void;
  onShelfRestored: (requestId: number) => void;
  onContextRestored?: () => void;
  onFailure: (reason: BookShelfSceneFailure) => void;
  sceneLabel: string;
  loadingLabel: string;
  emptyLabel: string;
  openBookLabel?: string;
  pageTurnLabel?: string;
  closeInspectionLabel?: string;
};

export function resolveBookShelfSceneQualitySettings({
  qualitySettings,
  economical,
  reducedMotion,
  viewportWidth,
  viewportHeight,
  devicePixelRatio,
  deviceMemoryGb,
  hardwareConcurrency,
}: Readonly<{
  qualitySettings?: BookShelfQualitySettings;
  economical: boolean;
  reducedMotion: boolean;
  viewportWidth: number;
  viewportHeight?: number;
  devicePixelRatio?: number;
  deviceMemoryGb?: number;
  hardwareConcurrency?: number;
}>) {
  if (qualitySettings) return qualitySettings;
  return resolveBookShelfQualitySettings({
    viewportWidth,
    viewportHeight,
    devicePixelRatio,
    deviceMemoryGb,
    hardwareConcurrency,
    saveData: economical,
    reducedMotion,
    preference: economical ? "ECONOMY" : "auto",
  });
}

const primarySceneCanvasModules = import.meta.glob<
  ComponentType<BookShelfSceneCanvasProps>
>("./BookShelfSceneCanvas.tsx", {
  import: "default",
  query: { stage5Load: "primary" },
});

const retrySceneCanvasModules = import.meta.glob<
  ComponentType<BookShelfSceneCanvasProps>
>("./BookShelfSceneCanvas.tsx", {
  import: "default",
  query: { stage5Load: "retry" },
});

function loadSceneCanvas(attempt: BookShelfSceneProps["loadAttempt"]) {
  const modules =
    attempt === "retry" ? retrySceneCanvasModules : primarySceneCanvasModules;
  const importer = Object.values(modules)[0];
  if (!importer) {
    return Promise.reject(new Error("Book shelf Canvas module is unavailable"));
  }
  return importer().then((component) => ({ default: component }));
}


class SceneErrorBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGl() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

export default function BookShelfScene(props: BookShelfSceneProps) {
  const sceneElementRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsInset, setActionsInset] = useState(0);
  const [support, setSupport] = useState<"checking" | "ready" | "failed">(
    "checking"
  );
  const onFailureRef = useRef(props.onFailure);
  onFailureRef.current = props.onFailure;
  const LazyBookShelfSceneCanvas = useMemo(
    () => lazy(() => loadSceneCanvas(props.loadAttempt)),
    [props.loadAttempt]
  );
  const qualitySettings = useMemo(() => {
    const device =
      typeof navigator === "undefined"
        ? null
        : (navigator as Navigator & { deviceMemory?: number });
    return resolveBookShelfSceneQualitySettings({
      qualitySettings: props.qualitySettings,
      economical: props.economical,
      reducedMotion: props.reducedMotion,
      viewportWidth:
        typeof window === "undefined" ? 1024 : Math.max(1, window.innerWidth),
      viewportHeight:
        typeof window === "undefined" ? undefined : window.innerHeight,
      devicePixelRatio:
        typeof window === "undefined" ? 1 : window.devicePixelRatio,
      deviceMemoryGb: device?.deviceMemory,
      hardwareConcurrency: device?.hardwareConcurrency,
    });
  }, [props.economical, props.qualitySettings, props.reducedMotion]);

  useEffect(() => {
    if (!props.active) return;
    let current = true;
    const available = supportsWebGl();
    if (!available) {
      setSupport("failed");
      onFailureRef.current("unsupported");
      return;
    }
    void ensureBookTypographyReady().then((ready) => {
      if (!current) return;
      setSupport(ready ? "ready" : "failed");
      if (!ready) onFailureRef.current("texture-error");
    });
    return () => { current = false; };
  }, [props.active]);

  const failureHandler = useMemo(
    () => () => onFailureRef.current("render-error"),
    []
  );

  const inspectionActive =
    props.phase === "INSPECTION_ENTERING" ||
    props.phase === "INSPECTION_CLOSED" ||
    props.phase === "COVER_CRACKED" ||
    props.phase === "COVER_OPENING" ||
    props.phase === "BOOK_OPEN" ||
    props.phase === "PAGE_DRAGGING" ||
    props.phase === "PAGE_SETTLING" ||
    props.phase === "INSPECTION_CLOSING";
  const coverCanOpen =
    props.phase === "INSPECTION_CLOSED" || props.phase === "COVER_CRACKED";
  const pageNavigationActive =
    props.phase === "BOOK_OPEN" ||
    props.phase === "PAGE_DRAGGING" ||
    props.phase === "PAGE_SETTLING";
  const pageNavigationBusy = props.phase !== "BOOK_OPEN";
  useLayoutEffect(() => {
    const scene = sceneElementRef.current;
    const actions = actionsRef.current;
    if (!inspectionActive || !scene || !actions) {
      setActionsInset(previous => previous === 0 ? previous : 0);
      return;
    }
    const measure = () => {
      const rect = actions.getBoundingClientRect();
      const next = rect.height > 0 && getComputedStyle(actions).visibility !== "hidden"
        ? measureBookShelfViewportInsets({
            scene: scene.getBoundingClientRect(),
            overlays: [{ edge: "bottom", rect: { left: rect.left, right: rect.right, top: rect.top - 12, bottom: rect.bottom } }],
          }).bottom
        : 0;
      setActionsInset(previous => previous === next ? previous : next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (scene) observer?.observe(scene);
    if (actions) observer?.observe(actions);
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [inspectionActive, coverCanOpen, pageNavigationActive, props.viewportInsets, support]);
  // Controls keep the base viewport/panel placement. Their measured footprint
  // reserves camera space only, so measuring them cannot push them upward again.
  const cameraViewportInsets = useMemo(() => ({
    ...(props.viewportInsets || EMPTY_BOOK_SHELF_INSETS),
    bottom: Math.max(props.viewportInsets?.bottom || 0, actionsInset),
  }), [props.viewportInsets, actionsInset]);
  const requestCoverOpen = () => {
    if (props.selectedBookKey) {
      props.onRequestCoverOpen(props.selectedBookKey);
    }
  };

  if (!props.items.length) {
    return <div className="book-shelf-scene__empty">{props.emptyLabel}</div>;
  }
  if (support === "failed") return null;

  return (
    <div
      ref={sceneElementRef}
      className="book-shelf-scene"
      role="region"
      aria-label={props.sceneLabel}
      tabIndex={-1}
      data-book-shelf-phase={props.phase}
      onKeyDown={(event) => {
        if (
          props.phase === "BOOK_OPEN" &&
          props.onRequestKeyboardPage(event.key, event.shiftKey)
        ) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <SceneErrorBoundary onFailure={failureHandler}>
        <Suspense fallback={<BookShelfBrandLoader label={props.loadingLabel} />}>
          {props.active && support === "ready" ? (
            <LazyBookShelfSceneCanvas
              items={props.items}
              appearance={props.appearance}
              focusedBookKey={props.focusedBookKey}
              selectedBookKey={props.selectedBookKey}
              viewportInsets={cameraViewportInsets}
              onHoveredBookChange={props.onHoveredBookChange}
              onPressedBookChange={props.onPressedBookChange}
              phase={props.phase}
              requestId={props.requestId}
              active={props.active}
              qualitySettings={qualitySettings}
              editorialDocument={props.editorialDocument}
              inspectionSession={props.inspectionSession}
              onFocusBook={props.onFocusBook}
              onOpenBook={props.onOpenBook}
              onRequestCoverOpen={props.onRequestCoverOpen}
              onRequestInspectionClose={props.onRequestInspectionClose}
              onRequestSceneCenter={props.onRequestSceneCenter}
              onCrackCover={props.onCrackCover}
              onStartPageDrag={props.onStartPageDrag}
              onUpdatePageDrag={props.onUpdatePageDrag}
              onRequestPageSettle={props.onRequestPageSettle}
              onMotionReached={props.onMotionReached}
              onMotionSettled={props.onMotionSettled}
              onInspectionEntered={props.onInspectionEntered}
              onCoverOpened={props.onCoverOpened}
              onPageSettled={props.onPageSettled}
              onInspectionClosed={props.onInspectionClosed}
              onShelfRestored={props.onShelfRestored}
              onContextLost={() => props.onFailure("context-lost")}
              onContextRestored={() => props.onContextRestored?.()}
              onTextureFailure={() => props.onFailure("texture-error")}
            />
          ) : (
            <BookShelfBrandLoader label={props.loadingLabel} />
          )}
        </Suspense>
      </SceneErrorBoundary>
      {inspectionActive ? (
        <div ref={actionsRef} className="book-shelf-scene__accessible-actions" style={{
          left: (props.viewportInsets?.left || 0) + 16,
          right: (props.viewportInsets?.right || 0) + 16,
          bottom: (props.viewportInsets?.bottom || 0) + 16,
          maxWidth: "none", justifyContent: "center",
        }}>
          {coverCanOpen && props.selectedBookKey && props.openBookLabel ? (
            <button className="book-shelf-scene__open" type="button" onClick={requestCoverOpen}>
              {props.openBookLabel}
            </button>
          ) : null}
          {pageNavigationActive && props.pageTurnLabel ? (
            <div aria-busy={pageNavigationBusy}>
              <button
                className="book-shelf-scene__page"
                type="button"
                onClick={props.onRequestPreviousPage}
                disabled={
                  pageNavigationBusy || !props.inspectionSession?.pageIndex
                }
              >
                {"←"} {props.pageTurnLabel}
              </button>
              <span role="status" aria-live="polite">
                {props.inspectionSession
                  ? `${props.inspectionSession.pageIndex + 1} / ${props.inspectionSession.pageCount}`
                  : null}
              </span>
              <button
                className="book-shelf-scene__page"
                type="button"
                onClick={props.onRequestPageTurn}
                disabled={
                  pageNavigationBusy ||
                  !props.inspectionSession ||
                  props.inspectionSession.pageIndex >=
                    props.inspectionSession.pageCount - 1
                }
              >
                {props.pageTurnLabel} {"→"}
              </button>
            </div>
          ) : null}
          {props.closeInspectionLabel &&
          props.phase !== "INSPECTION_CLOSING" &&
          props.phase !== "SHELF_RESTORING" ? (
            <button className="book-shelf-scene__close" type="button" onClick={props.onRequestInspectionClose}>
              {props.closeInspectionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
