import { useLayoutEffect, useRef, useState } from "react";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { PlanetCompositionPresentation } from "../host/planetCompositionPresentation";
import type { GlobeAtlas, GlobeAtlasEditionLease } from "./globeAtlas";
import type { GlobeEditionId } from "./globeEditions";
import type { UseGlobeStyleStateResult } from "./useGlobeStyleState";

export type PreparedCompositionSource = Readonly<{
  revision: number; editionId: GlobeEditionId; language: InterfaceLanguage; generation: number;
}>;

/** Coordinates the existing atlas/hook tokens, never creates a renderer or canvas. */
export function useGlobeCompositionScene({ presentation, atlas, language, style }: {
  presentation?: PlanetCompositionPresentation;
  atlas: GlobeAtlas | null;
  language: InterfaceLanguage;
  style: UseGlobeStyleStateResult;
}): PreparedCompositionSource | null {
  const [prepared, setPrepared] = useState<PreparedCompositionSource | null>(null);
  const baseline = useRef<{ atlas: GlobeAtlas; lease: GlobeAtlasEditionLease } | null>(null);
  const operation = useRef(0);
  const failedEdition = useRef<GlobeEditionId | null>(null);
  const controller = presentation?.controller;
  const revision = presentation?.snapshot.renderRevision;
  const appliedId = presentation?.snapshot.applied.editionId;
  const targetId = presentation?.snapshot.displayed.editionId;
  const reason = presentation?.snapshot.reason;
  const { requestStyle, synchronizeRendered, reportFallback } = style;

  useLayoutEffect(() => () => {
    ++operation.current;
    baseline.current?.lease.release();
    baseline.current = null;
    failedEdition.current = null;
  }, [atlas, controller]);

  useLayoutEffect(() => {
    if (!controller || !atlas || revision === undefined || !appliedId || !targetId) {
      setPrepared(null);
      return;
    }
    const token = ++operation.current;
    let alive = true;
    const owns = () => alive && operation.current === token
      && controller.getSnapshot().renderRevision === revision;
    const cleanup = () => { alive = false; };
    setPrepared(null);

    const captureBaseline = () => {
      const lease = atlas.captureEditionSource();
      if (!lease || lease.editionId !== appliedId) {
        lease?.release();
        throw new Error("Baseline source unavailable");
      }
      baseline.current = { atlas, lease };
    };
    try {
      const currentSource = atlas.getEditionSourceState();
      if (!currentSource) throw new Error("Atlas source unavailable");
      // The unchanged atlas path fences its pending decode without a load or
      // repaint. Fence the hook too, even when a replacement atlas has no lease.
      void atlas.setEdition(currentSource.editionId, currentSource.language).catch(() => undefined);
      synchronizeRendered(currentSource.editionId);
      if (baseline.current?.atlas !== atlas || baseline.current.lease.editionId !== appliedId) {
        baseline.current?.lease.release();
        baseline.current = null;
      }
      if (baseline.current && (currentSource.editionId !== appliedId
        || (appliedId === "natural-earth-2026" && currentSource.language !== language
          && baseline.current.lease.language === language))) {
        if (!baseline.current.lease.restore()) {
          baseline.current = null;
          throw new Error("Baseline source unavailable");
        }
      }
      const restored = atlas.getEditionSourceState();
      if (!restored) throw new Error("Atlas source unavailable");
      if (restored.editionId === appliedId
        && (!baseline.current || baseline.current.lease.language !== restored.language)) captureBaseline();
      if (reason === "render-failed" && failedEdition.current) {
        reportFallback(failedEdition.current, restored.editionId);
      } else {
        failedEdition.current = null;
        synchronizeRendered(restored.editionId);
      }
    } catch {
      // A real canvas error must not escape a layout effect and unmount the
      // persistent scene. The outer owner retains its error until a new intent.
      if (owns()) controller.failRendering(revision);
      return cleanup;
    }

    // A failed EN refresh still has a valid RU source lease. Roll back once;
    // do not turn the error snapshot into an automatic localization retry loop.
    if (reason === "render-failed" || reason === "preview-timeout") return cleanup;

    const publishSource = () => {
      const source = atlas.getEditionSourceState();
      if (!owns() || !source || source.editionId !== targetId
        || (targetId === "natural-earth-2026" && source.language !== language)) return;
      setPrepared({ revision, ...source });
    };
    void (async () => {
      let attemptedEdition = appliedId;
      try {
        const source = atlas.getEditionSourceState();
        // A replaced or bootstrap-fallback atlas may have no applied source yet.
        // Prepare it before the candidate; never claim a lease for the fallback.
        // Localization replaces the old lease only after a successful refresh.
        if (source?.editionId !== appliedId
          || (appliedId === "natural-earth-2026" && source?.language !== language)) {
          const result = await requestStyle(appliedId, { force: true });
          if (!owns()) return;
          if (result !== "committed" && result !== "unchanged") throw new Error("Baseline source unavailable");
          const restored = atlas.getEditionSourceState();
          if (!restored || restored.editionId !== appliedId
            || (appliedId === "natural-earth-2026" && restored.language !== language)) {
            throw new Error("Baseline source unavailable");
          }
          captureBaseline();
        }
        if (targetId !== appliedId) {
          attemptedEdition = targetId;
          const result = await requestStyle(targetId, { force: true });
          if (!owns()) return;
          if (result !== "committed" && result !== "unchanged") throw new Error("Composition source unavailable");
        }
        publishSource();
      } catch {
        if (!owns()) return;
        failedEdition.current = attemptedEdition;
        controller.failRendering(revision);
      }
    })();
    return cleanup;
  }, [controller, atlas, revision, appliedId, targetId, language, reason,
    requestStyle, synchronizeRendered, reportFallback]);
  return prepared;
}
