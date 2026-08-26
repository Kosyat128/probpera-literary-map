import { Component, lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ComponentType, ErrorInfo, ReactNode } from "react";

import type { BookShelfSceneCanvasProps } from "./BookShelfSceneCanvas";

export type BookShelfPresentationItem = {
  key: string;
  title: string;
  writer: string;
  coverUrl?: string;
  baseColor: string;
  accentColor: string;
  paperColor: string;
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
  | "render-error";

export type BookShelfSceneProps = {
  items: readonly BookShelfPresentationItem[];
  appearance: BookShelfSceneAppearance;
  focusedBookKey: string | null;
  selectedBookKey: string | null;
  active: boolean;
  economical: boolean;
  reducedMotion: boolean;
  loadAttempt: "primary" | "retry";
  onFocusBook: (key: string) => void;
  onOpenBook: (key: string) => void;
  onFailure: (reason: BookShelfSceneFailure) => void;
  sceneLabel: string;
  loadingLabel: string;
  emptyLabel: string;
};

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
    return Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true })
    );
  } catch {
    return false;
  }
}

export default function BookShelfScene(props: BookShelfSceneProps) {
  const [support, setSupport] = useState<"checking" | "ready" | "failed">(
    "checking"
  );
  const LazyBookShelfSceneCanvas = useMemo(
    () => lazy(() => loadSceneCanvas(props.loadAttempt)),
    [props.loadAttempt]
  );

  useEffect(() => {
    if (!props.active) return;
    const available = supportsWebGl();
    setSupport(available ? "ready" : "failed");
    if (!available) props.onFailure("unsupported");
  }, [props.active, props.onFailure]);

  const failureHandler = useMemo(
    () => () => props.onFailure("render-error"),
    [props.onFailure]
  );

  if (!props.items.length) {
    return <div className="book-shelf-scene__empty">{props.emptyLabel}</div>;
  }

  if (support === "failed") return null;

  return (
    <div
      className="book-shelf-scene"
      role="region"
      aria-label={props.sceneLabel}
    >
      <SceneErrorBoundary onFailure={failureHandler}>
        <Suspense
          fallback={
            <div className="book-shelf-scene__loading" role="status">
              {props.loadingLabel}
            </div>
          }
        >
          {support === "ready" ? (
            <LazyBookShelfSceneCanvas
              items={props.items}
              appearance={props.appearance}
              focusedBookKey={props.focusedBookKey}
              selectedBookKey={props.selectedBookKey}
              active={props.active}
              economical={props.economical}
              reducedMotion={props.reducedMotion}
              onFocusBook={props.onFocusBook}
              onOpenBook={props.onOpenBook}
              onContextLost={() => props.onFailure("context-lost")}
            />
          ) : null}
        </Suspense>
      </SceneErrorBoundary>
    </div>
  );
}
