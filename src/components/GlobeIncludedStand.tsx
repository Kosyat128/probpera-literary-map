import { Component, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DEFAULT_GLOBE_STAND_ID, isIncludedGlobeStandId, type GlobeStandPresentation, type GlobeStandId } from "../planet/globeStands";
import { createIncludedGlobeStand, type OwnedGlobeStand } from "./globeStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";

type FrameProps = {
  presentation: GlobeStandPresentation;
  quality: GlobeQualityTier;
  canonicalFrame: ReactNode;
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

function StandFrame({ presentation, quality, canonicalFrame }: FrameProps) {
  const { invalidate, gl, scene, camera } = useThree();
  const [shown, setShown] = useState<{ key: string; resource: OwnedGlobeStand } | null>(null);
  const resources = useRef(new Map<string, OwnedGlobeStand>());
  const ownership = useRef<{ revision: number; id: GlobeStandId; key: string | null; alive: boolean; acknowledged: boolean } | null>(null);
  const callbacks = useRef(presentation);
  useLayoutEffect(() => { callbacks.current = presentation; }, [presentation]);

  useLayoutEffect(() => {
    const resourceKey = (id: GlobeStandId) => id === DEFAULT_GLOBE_STAND_ID ? null : `${id}:${quality}`;
    const targetKey = resourceKey(presentation.displayedId);
    const baselineKey = resourceKey(presentation.appliedId);
    const owner = { revision: presentation.renderRevision, id: presentation.displayedId,
      key: targetKey, alive: true, acknowledged: false };
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
      if (ownership.current === owner) ownership.current = null;
    };
  }, [presentation.appliedId, presentation.displayedId, presentation.renderRevision, quality, camera, gl, scene, invalidate]);

  useLayoutEffect(() => () => {
    for (const resource of resources.current.values()) resource.dispose();
    resources.current.clear();
  }, []);

  useFrame(() => {
    const owner = ownership.current;
    if (!owner?.alive || (owner.acknowledged && !callbacks.current.onFrameRendered)) return;
    if ((shown?.key ?? null) !== owner.key) return;
    const frame = gl.info.render.frame;
    // Fiber renders after useFrame. Confirm completion of that renderer frame,
    // rather than declaring success when React merely constructed the group.
    queueMicrotask(() => {
      if (!owner.alive || ownership.current !== owner) return;
      if (gl.info.render.frame <= frame || gl.getContext().isContextLost()) return;
      if (!owner.acknowledged) {
        owner.acknowledged = true;
        callbacks.current.onRendered(owner.revision, owner.id);
      }
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
