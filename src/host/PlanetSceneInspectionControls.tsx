import { useId, useLayoutEffect, useRef, useSyncExternalStore, type RefObject, type SyntheticEvent } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import InterfaceLanguageControl from "../components/InterfaceLanguageControl";
import { beginGlobePointerGesture, isGlobePointerTap, updateGlobePointerGesture, type GlobePointerGesture } from "../components/globeInteraction";
import type { PlanetSceneInspectionController } from "./planetSceneInspection";
import "./PlanetSceneInspectionControls.css";

/** Original interface copy describing an authored decorative scene object. */
export const planetSceneInspectionCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      toggle: "Осмотреть сцену",
      heading: "Осмотр сцены",
      hint: "Вращайте глобус, чтобы рассмотреть кабинет. Набросок можно открыть здесь или по метке на столе.",
      sketch: "Лист с наброском",
      closeScene: "Закрыть осмотр сцены",
      title: "Авторский набросок",
      description: "На листе — набросок вымышленных островов. Загляните в коллекцию, чтобы выбрать следующую книгу для чтения.",
      closeObject: "Закрыть набросок",
      books: "Перейти к книгам",
    },
    en: {
      toggle: "Inspect scene",
      heading: "Scene inspection",
      hint: "Rotate the globe to look around the study. Open the sketch here or use the marker on the desk.",
      sketch: "Sketch sheet",
      closeScene: "Close scene inspection",
      title: "Original sketch",
      description: "The sheet shows a sketch of imaginary islands. Explore the collection to choose your next book to read.",
      closeObject: "Close sketch",
      books: "Explore books",
    },
  },
} as const;

type Props = {
  controller: PlanetSceneInspectionController;
  markerRef: RefObject<HTMLButtonElement>;
  onOpenBooks: () => void;
};

const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();

/** DOM controls share the existing scene; only the render adapter positions
 * the non-keyboard marker. The alternative button remains keyboard accessible. */
export default function PlanetSceneInspectionControls({ controller, markerRef, onOpenBooks }: Props) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { language } = useInterfaceLanguage();
  const copy = planetSceneInspectionCopy.locales[language];
  const id = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const alternativeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeObjectRef = useRef<HTMLButtonElement>(null);
  const markerGesture = useRef<GlobePointerGesture | null>(null);
  const markerTapTime = useRef<number | null>(null);
  const previousMode = useRef(snapshot.mode);
  const visible = snapshot.available || snapshot.mode !== "closed";

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (snapshot.mode === "object") {
      if (dialog && !dialog.open) {
        dialog.showModal();
        closeObjectRef.current?.focus({ preventScroll: true });
      }
    } else {
      if (dialog?.open) dialog.close();
      if (previousMode.current === "object" && snapshot.mode === "scene") {
        alternativeRef.current?.focus({ preventScroll: true });
      } else if (previousMode.current !== "closed" && snapshot.mode === "closed" && snapshot.available) {
        // External unavailability may already have moved focus to another
        // panel. Only restore this trigger while it remains an available UI.
        const active = document.activeElement;
        if (active === document.body || (active instanceof Element && active.closest(
          ".planet-scene-inspection, .planet-scene-inspection__dialog, .planet-scene-inspection__marker"))) {
          toggleRef.current?.focus({ preventScroll: true });
        }
      }
    }
    previousMode.current = snapshot.mode;
    if (snapshot.mode !== "scene" || !snapshot.available) {
      markerGesture.current = null;
      markerTapTime.current = null;
    }
    if (snapshot.mode !== "scene" && markerRef.current) markerRef.current.style.visibility = "hidden";
  }, [snapshot.mode, snapshot.available, markerRef, controller]);

  if (!visible) return null;

  return <>
    <div className="planet-scene-inspection" data-planet-scene-inspection="" data-planet-scene-mode={snapshot.mode}
      onPointerDown={stopPropagation} onPointerMove={stopPropagation} onPointerUp={stopPropagation}
      onClick={stopPropagation} onWheel={stopPropagation}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Escape" && snapshot.mode !== "closed") {
          event.preventDefault(); controller.close();
        }
      }}>
      <button ref={toggleRef} type="button" className="planet-scene-inspection__toggle" data-planet-scene-toggle=""
        aria-expanded={snapshot.mode !== "closed"} aria-controls={`${id}-panel`}
        onClick={() => snapshot.mode === "closed" ? controller.open() : controller.close()}>{copy.toggle}</button>
      {snapshot.mode !== "closed" && <section id={`${id}-panel`} className="planet-scene-inspection__panel"
        data-planet-scene-panel="" aria-labelledby={`${id}-heading`}>
        <div className="planet-scene-inspection__heading">
          <h2 id={`${id}-heading`}>{copy.heading}</h2>
          <button type="button" className="planet-scene-inspection__close" data-planet-scene-close=""
            aria-label={copy.closeScene} onClick={() => controller.close()}>×</button>
        </div>
        <p className="planet-scene-inspection__hint">{copy.hint}</p>
        <button ref={alternativeRef} type="button" className="planet-scene-inspection__alternative"
          data-planet-scene-object-trigger="" disabled={!snapshot.available} onClick={() => controller.openObject()}>{copy.sketch}</button>
      </section>}
    </div>

    <button ref={markerRef} type="button" className="planet-scene-inspection__marker" data-planet-scene-marker=""
      tabIndex={-1} aria-hidden="true" aria-label={copy.sketch} title={copy.sketch} disabled={!snapshot.available}
      style={{ visibility: "hidden", position: "absolute" }}
      onPointerDown={event => {
        event.stopPropagation();
        // The duplicate visual marker must not take focus from its accessible
        // alternative. Cancelling pointerdown still permits the native click.
        event.preventDefault();
        markerTapTime.current = null;
        markerGesture.current = snapshot.mode === "scene" && snapshot.available ? beginGlobePointerGesture(event) : null;
      }}
      onPointerMove={event => {
        event.stopPropagation();
        markerGesture.current = updateGlobePointerGesture(markerGesture.current, event);
      }}
      onPointerUp={event => {
        event.stopPropagation();
        markerTapTime.current = isGlobePointerTap(markerGesture.current, event) ? event.timeStamp : null;
        markerGesture.current = null;
      }}
      onPointerCancel={event => {
        event.stopPropagation();
        markerGesture.current = null;
        markerTapTime.current = null;
      }}
      onPointerLeave={event => {
        event.stopPropagation();
        // Touch pointers leave after a completed tap; only an unfinished
        // gesture is cancelled here so its subsequent click cannot activate.
        if (markerGesture.current) markerTapTime.current = null;
        markerGesture.current = null;
      }}
      onWheel={stopPropagation} onKeyDown={stopPropagation}
      onClick={event => {
        event.stopPropagation();
        const completedAt = markerTapTime.current;
        markerTapTime.current = null;
        if (completedAt === null || event.detail === 0) return;
        const elapsed = event.timeStamp - completedAt;
        if (elapsed >= 0 && elapsed <= 600) controller.openObject();
      }}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
        <path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12l2-1 2 2 2-1M9 16h6"
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>

    <dialog ref={dialogRef} className="planet-scene-inspection__dialog" data-planet-scene-object=""
      aria-labelledby={`${id}-object-title`} aria-describedby={`${id}-object-description`}
      onPointerDown={stopPropagation} onPointerMove={stopPropagation} onPointerUp={stopPropagation}
      onWheel={stopPropagation}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); controller.closeObject(); }
      }}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); controller.closeObject(); }}
      onClose={() => {
        // A queued native close event may arrive after the same dialog was
        // reopened. It must not close the newer controlled object view.
        if (!dialogRef.current?.open && controller.getSnapshot().mode === "object") controller.closeObject();
      }}
      onClick={event => {
        event.stopPropagation();
        if (event.target === event.currentTarget) controller.closeObject();
      }}>
      <article>
        <header className="planet-scene-inspection__heading">
          <h2 id={`${id}-object-title`}>{copy.title}</h2>
          <button ref={closeObjectRef} type="button" className="planet-scene-inspection__close"
            data-planet-scene-object-close="" aria-label={copy.closeObject} onClick={() => controller.closeObject()}>×</button>
        </header>
        <div data-planet-scene-object-language=""><InterfaceLanguageControl /></div>
        <p id={`${id}-object-description`}>{copy.description}</p>
        <button type="button" data-planet-scene-books="" disabled={!snapshot.available}
          onClick={() => controller.openBooks(onOpenBooks)}>{copy.books}</button>
      </article>
    </dialog>
  </>;
}
