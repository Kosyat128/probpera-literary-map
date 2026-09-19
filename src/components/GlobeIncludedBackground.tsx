import { Component, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  checkGlobeBackgroundCompatibility, DEFAULT_GLOBE_BACKGROUND_ID,
  type GlobeBackgroundId, type GlobeBackgroundPresentation,
} from "../planet/globeBackgrounds";
import { createGlobeLibrary, type OwnedGlobeLibrary } from "./globeLibraryGeometry";
import type { GlobeQualityTier } from "./globeQuality";

type BackgroundProps = {
  presentation: GlobeBackgroundPresentation;
  quality: GlobeQualityTier;
  editionId: string;
  standId: string;
  access: "adult" | "blocked";
  active: boolean;
  autoRotate: boolean;
  reducedMotion: boolean;
  canonicalBackground: ReactNode;
};

class BackgroundRenderBoundary extends Component<{
  children: ReactNode; fallback: ReactNode; revision: string; onFailed: () => void;
}, { failed: boolean; revision: string }> {
  state = { failed: false, revision: this.props.revision };
  static getDerivedStateFromProps(props: { revision: string }, state: { revision: string }) {
    return props.revision === state.revision ? null : { failed: false, revision: props.revision };
  }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailed(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function BackgroundFrame({ presentation, quality, editionId, standId, access,
  active, autoRotate, reducedMotion, canonicalBackground }: BackgroundProps) {
  const { invalidate, gl, scene, camera } = useThree();
  const [shown, setShown] = useState<{ key: string; resource: OwnedGlobeLibrary } | null>(null);
  const resources = useRef(new Map<string, OwnedGlobeLibrary>());
  const ownership = useRef<{
    revision: number; id: GlobeBackgroundId; key: string | null; baselineKey: string | null;
    alive: boolean; acknowledged: boolean;
  } | null>(null);
  const callbacks = useRef(presentation);
  const ambientTime = useRef(0);
  useLayoutEffect(() => { callbacks.current = presentation; }, [presentation]);

  useLayoutEffect(() => {
    const keyFor = (id: GlobeBackgroundId) => id === DEFAULT_GLOBE_BACKGROUND_ID ? null : `${id}:${quality}`;
    const owner = { revision: presentation.renderRevision, id: presentation.displayedId,
      key: keyFor(presentation.displayedId), baselineKey: keyFor(presentation.appliedId),
      alive: true, acknowledged: false };
    ownership.current = owner;
    const createdKeys: string[] = [];
    const prepare = (id: GlobeBackgroundId): OwnedGlobeLibrary | null => {
      const compatibility = checkGlobeBackgroundCompatibility({
        backgroundId: id, editionId, standId, qualityTier: quality, access,
      });
      if (!compatibility.compatible) throw new Error("Incompatible globe background");
      if (id === DEFAULT_GLOBE_BACKGROUND_ID) return null;
      const key = `${id}:${quality}`;
      const existing = resources.current.get(key);
      if (existing) return existing;
      const candidate = createGlobeLibrary(quality);
      try {
        candidate.setAmbientTime(ambientTime.current);
        // A small bundled room is prepared synchronously. This uses the current
        // camera/lights without an uncancellable compileAsync resource queue.
        gl.compile(candidate.group, camera, scene);
        resources.current.set(key, candidate);
        createdKeys.push(key);
        return candidate;
      } catch (error) { candidate.dispose(); throw error; }
    };
    try {
      prepare(presentation.appliedId);
      const target = prepare(presentation.displayedId);
      setShown(target && owner.key ? { key: owner.key, resource: target } : null);
      invalidate();
    } catch {
      owner.alive = false;
      for (const key of createdKeys) {
        resources.current.get(key)?.dispose();
        resources.current.delete(key);
      }
      // Failed quality preparation keeps the previous visible room, including
      // when the applied selection is idle and there is no pending preview.
      callbacks.current.onFailed(owner.revision, owner.id);
    }
    return () => {
      owner.alive = false;
      if (ownership.current === owner) ownership.current = null;
    };
  }, [presentation.appliedId, presentation.displayedId, presentation.renderRevision,
    quality, editionId, standId, access, camera, gl, scene, invalidate]);

  useLayoutEffect(() => {
    // Release only after React committed the new shown branch. Keep the applied
    // room for Cancel, never a growing cache of previously previewed scenes.
    const owner = ownership.current;
    for (const [key, resource] of resources.current) {
      if (key !== shown?.key && key !== owner?.key && key !== owner?.baselineKey) {
        resources.current.delete(key);
        resource.dispose();
      }
    }
  }, [shown, presentation.appliedId, presentation.displayedId, presentation.renderRevision, quality]);

  useLayoutEffect(() => () => {
    for (const resource of resources.current.values()) resource.dispose();
    resources.current.clear();
  }, []);

  useFrame((_, delta) => {
    if (shown && active && autoRotate && !reducedMotion) {
      ambientTime.current += Math.min(Math.max(delta, 0), 0.1);
      shown.resource.setAmbientTime(ambientTime.current);
    }
    const owner = ownership.current;
    if (!owner?.alive || owner.acknowledged || (shown?.key ?? null) !== owner.key) return;
    const frame = gl.info.render.frame;
    queueMicrotask(() => {
      if (!owner.alive || ownership.current !== owner || owner.acknowledged) return;
      if (gl.info.render.frame <= frame || gl.getContext().isContextLost()) return;
      owner.acknowledged = true;
      callbacks.current.onRendered(owner.revision, owner.id);
    });
  });

  return shown ? <primitive object={shown.resource.group} dispose={null} /> : canonicalBackground;
}

/** Background ownership never includes the surface, stand, common lights or camera. */
export default function GlobeIncludedBackground(props: BackgroundProps) {
  return <BackgroundRenderBoundary
    revision={`${props.presentation.renderRevision}:${props.quality}:${props.editionId}:${props.standId}:${props.access}`}
    fallback={props.canonicalBackground}
    onFailed={() => props.presentation.onFailed(props.presentation.renderRevision, props.presentation.displayedId)}>
    <BackgroundFrame {...props} />
  </BackgroundRenderBoundary>;
}
