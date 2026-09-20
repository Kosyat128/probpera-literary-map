import { Component, useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Box3 } from "three";
import { DEFAULT_GLOBE_STAND_ID, isIncludedGlobeStandId, type GlobeStandPresentation, type GlobeStandId } from "../planet/globeStands";
import { createIncludedGlobeStand, type OwnedGlobeStand } from "./globeStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";
import type { GlobeRenderedStandBounds } from "./globeStandInspection";

type FrameProps = {
  presentation: GlobeStandPresentation;
  quality: GlobeQualityTier;
  canonicalFrame: ReactNode;
  onInspectionBounds?: (bounds: GlobeRenderedStandBounds | null) => void;
};

type FrameOwner = {
  revision: number; id: GlobeStandId; key: string | null; quality: GlobeQualityTier;
  alive: boolean; acknowledged: boolean; boundsPublished: boolean;
};

class StandRenderBoundary extends Component<{
  children: ReactNode;
  fallback: ReactNode;
  revision: string;
  onFailed: () => void;
}, { failed: boolean; revision: string }> {
  state = { failed: false, revision: this.props.revision };
  static getDerivedStateFromProps(props: { revision: string }, state: { revision: string }) {
    return props.revision === state.revision ? null : { failed: false, revision: props.revision };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailed(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function StandFrame({ presentation, quality, canonicalFrame, onInspectionBounds }: FrameProps) {
  const { invalidate, gl, scene, camera } = useThree();
  const [shown, setShown] = useState<{ key: string; resource: OwnedGlobeStand } | null>(null);
  const resources = useRef(new Map<string, OwnedGlobeStand>());
  const ownership = useRef<FrameOwner | null>(null);
  const callbacks = useRef(presentation);
  const inspectionCallback = useRef(onInspectionBounds);
  const inspectionLease = useRef<FrameOwner | null>(null);
  const contextEpoch = useRef(0);
  const clearInspectionBounds = useCallback((owner?: FrameOwner) => {
    if (!inspectionLease.current || (owner && inspectionLease.current !== owner)) return;
    inspectionLease.current = null;
    inspectionCallback.current?.(null);
  }, []);
  useLayoutEffect(() => { callbacks.current = presentation; }, [presentation]);
  useLayoutEffect(() => {
    if (inspectionCallback.current === onInspectionBounds) return;
    clearInspectionBounds();
    inspectionCallback.current = onInspectionBounds;
    if (ownership.current) ownership.current.boundsPublished = false;
    invalidate();
  }, [onInspectionBounds, clearInspectionBounds, invalidate]);

  useLayoutEffect(() => {
    const invalidateBounds = () => {
      contextEpoch.current += 1;
      clearInspectionBounds();
      if (ownership.current) ownership.current.boundsPublished = false;
    };
    const restored = () => { invalidateBounds(); invalidate(); };
    gl.domElement.addEventListener("webglcontextlost", invalidateBounds);
    gl.domElement.addEventListener("webglcontextrestored", restored);
    return () => {
      gl.domElement.removeEventListener("webglcontextlost", invalidateBounds);
      gl.domElement.removeEventListener("webglcontextrestored", restored);
    };
  }, [gl, clearInspectionBounds, invalidate]);

  useLayoutEffect(() => {
    const resourceKey = (id: GlobeStandId) => id === DEFAULT_GLOBE_STAND_ID ? null : `${id}:${quality}`;
    const targetKey = resourceKey(presentation.displayedId);
    const baselineKey = resourceKey(presentation.appliedId);
    const owner = { revision: presentation.renderRevision, id: presentation.displayedId,
      key: targetKey, quality, alive: true, acknowledged: false, boundsPublished: false };
    ownership.current = owner;
    const createdKeys: string[] = [];
    const prepare = (id: GlobeStandId): OwnedGlobeStand | null => {
      if (id === DEFAULT_GLOBE_STAND_ID) return null;
      if (!isIncludedGlobeStandId(id)) throw new Error("Invalid included globe stand");
      const key = `${id}:${quality}`;
      const existing = resources.current.get(key);
      if (existing) return existing;
      const candidate = createIncludedGlobeStand(id, quality);
      try {
        // Warm a bounded bundled group using the existing scene lights/camera.
        gl.compile(candidate.group, camera, scene);
        resources.current.set(key, candidate);
        createdKeys.push(key);
        return candidate;
      } catch (error) { candidate.dispose(); throw error; }
    };
    try {
      // Keep the committed baseline available for immediate Cancel, even after
      // several draft choices. There is no cache of the whole stand catalog.
      prepare(presentation.appliedId);
      const target = prepare(presentation.displayedId);
      setShown(target && targetKey ? { key: targetKey, resource: target } : null);
      for (const [key, resource] of resources.current) {
        if (key !== targetKey && key !== baselineKey) {
          resources.current.delete(key);
          resource.dispose();
        }
      }
      invalidate();
    } catch {
      owner.alive = false;
      // A preparation failure retains the previously visible group. Any new
      // baseline built before the failed candidate was never shown or committed.
      for (const key of createdKeys) {
        resources.current.get(key)?.dispose();
        resources.current.delete(key);
      }
      callbacks.current.onFailed(owner.revision, owner.id);
    }
    return () => {
      owner.alive = false;
      clearInspectionBounds(owner);
      if (ownership.current === owner) ownership.current = null;
    };
  }, [presentation.appliedId, presentation.displayedId, presentation.renderRevision, quality, camera, gl, scene, invalidate, clearInspectionBounds]);

  useLayoutEffect(() => () => {
    for (const resource of resources.current.values()) resource.dispose();
    resources.current.clear();
  }, []);

  useFrame(() => {
    const owner = ownership.current;
    if (!owner?.alive || (owner.acknowledged && owner.boundsPublished && !callbacks.current.onFrameRendered)) return;
    if ((shown?.key ?? null) !== owner.key) return;
    const frame = gl.info.render.frame;
    const epoch = contextEpoch.current;
    // Fiber renders after useFrame. Confirm completion of that renderer frame,
    // rather than declaring success when React merely constructed the group.
    queueMicrotask(() => {
      if (!owner.alive || ownership.current !== owner || contextEpoch.current !== epoch) return;
      if (gl.info.render.frame <= frame || gl.getContext().isContextLost()) return;
      if (!owner.boundsPublished) {
        let bounds: GlobeRenderedStandBounds | null = null;
        if (shown && isIncludedGlobeStandId(owner.id) && resources.current.get(shown.key) === shown.resource
          && shown.resource.group.parent && shown.resource.group.visible) {
          shown.resource.group.updateWorldMatrix(true, true);
          const box = new Box3().setFromObject(shown.resource.group, true);
          if (!box.isEmpty() && [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)) {
            bounds = Object.freeze({ standId: owner.id, renderRevision: owner.revision, qualityTier: owner.quality,
              min: Object.freeze([box.min.x, box.min.y, box.min.z] as const),
              max: Object.freeze([box.max.x, box.max.y, box.max.z] as const) });
          }
        }
        // This lease belongs to the shown resource, independently of the
        // composition frame callback. Cleanup cannot retire a newer lease.
        owner.boundsPublished = true;
        inspectionLease.current = owner;
        inspectionCallback.current?.(bounds);
      }
      if (!owner.alive || ownership.current !== owner) return;
      if (!owner.acknowledged) {
        owner.acknowledged = true;
        callbacks.current.onRendered(owner.revision, owner.id);
      }
      if (!owner.alive || ownership.current !== owner) return;
      callbacks.current.onFrameRendered?.(owner.revision, owner.id, gl.info.render.frame);
    });
  });

  return shown ? <primitive object={shown.resource.group} dispose={null} /> : canonicalFrame;
}

/** Only the stand branch changes; canonical geography and camera stay mounted. */
export default function GlobeIncludedStand(props: FrameProps) {
  return <StandRenderBoundary revision={`${props.presentation.renderRevision}:${props.quality}`}
    fallback={props.canonicalFrame}
    onFailed={() => props.presentation.onFailed(props.presentation.renderRevision, props.presentation.displayedId)}>
    <StandFrame {...props} />
  </StandRenderBoundary>;
}
