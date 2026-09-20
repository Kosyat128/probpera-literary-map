import { Component, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { Mesh, Texture } from "three";
import { useFrame, useThree } from "@react-three/fiber";
import {
  checkGlobeBackgroundCompatibility, DEFAULT_GLOBE_BACKGROUND_ID,
  type GlobeBackgroundId, type GlobeBackgroundPresentation,
} from "../planet/globeBackgrounds";
import { createIncludedGlobeBackground, type OwnedGlobeBackground } from "./globeBackgroundGeometry";
import type { GlobeQualityTier } from "./globeQuality";
import type { GlobeSceneInspectionBridge } from "../host/planetSceneInspectionBridge";
import GlobeSceneInspectionAnchor from "./GlobeSceneInspectionAnchor";

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
  inspection?: GlobeSceneInspectionBridge;
  globeRef?: RefObject<Mesh>;
  atlasMap?: Texture | null;
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
  active, autoRotate, reducedMotion, canonicalBackground, inspection, globeRef, atlasMap = null }: BackgroundProps) {
  const { invalidate, gl, scene, camera } = useThree();
  const [shown, setShown] = useState<{ key: string; resource: OwnedGlobeBackground } | null>(null);
  const resources = useRef(new Map<string, OwnedGlobeBackground>());
  const ownership = useRef<{
    revision: number; id: GlobeBackgroundId; key: string | null; baselineKey: string | null;
    alive: boolean; acknowledged: boolean;
  } | null>(null);
  const callbacks = useRef(presentation);
  const ambientTime = useRef(0);
  const displayedAtlasMap = useRef(atlasMap);
  useLayoutEffect(() => { callbacks.current = presentation; }, [presentation]);

  useLayoutEffect(() => {
    displayedAtlasMap.current = atlasMap;
    // Both visible and retained Cancel resources borrow the very same texture
    // as the globe. Edition pixel updates remain the atlas owner's operation.
    for (const resource of resources.current.values()) resource.setAtlasMap?.(atlasMap);
    invalidate();
  }, [atlasMap, invalidate]);

  useLayoutEffect(() => {
    const keyFor = (id: GlobeBackgroundId) => id === DEFAULT_GLOBE_BACKGROUND_ID ? null : `${id}:${quality}`;
    const owner = { revision: presentation.renderRevision, id: presentation.displayedId,
      key: keyFor(presentation.displayedId), baselineKey: keyFor(presentation.appliedId),
      alive: true, acknowledged: false };
    ownership.current = owner;
    const createdKeys: string[] = [];
    const prepare = (id: GlobeBackgroundId): OwnedGlobeBackground | null => {
      const compatibility = checkGlobeBackgroundCompatibility({
        backgroundId: id, editionId, standId, qualityTier: quality, access,
      });
      if (!compatibility.compatible) throw new Error("Incompatible globe background");
      if (id === DEFAULT_GLOBE_BACKGROUND_ID) return null;
      const key = `${id}:${quality}`;
      const existing = resources.current.get(key);
      if (existing) return existing;
      const candidate = createIncludedGlobeBackground(id, quality);
      try {
        candidate.setAtlasMap?.(displayedAtlasMap.current);
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
    if (!owner?.alive || (owner.acknowledged && !callbacks.current.onFrameRendered) || (shown?.key ?? null) !== owner.key) return;
    const frame = gl.info.render.frame;
    queueMicrotask(() => {
      if (!owner.alive || ownership.current !== owner) return;
      if (gl.info.render.frame <= frame || gl.getContext().isContextLost()) return;
      if (!owner.acknowledged) {
        owner.acknowledged = true;
        callbacks.current.onRendered(owner.revision, owner.id);
      }
      callbacks.current.onFrameRendered?.(owner.revision, owner.id, gl.info.render.frame);
      inspection?.controller.refreshTarget();
    });
  });

  const manuscript = shown?.resource.group.getObjectByName("writer-study-loose-paper");
  return shown ? <>
    <primitive object={shown.resource.group} dispose={null} />
    {inspection && globeRef && manuscript && <GlobeSceneInspectionAnchor
      bridge={inspection} resourceKey={shown.resource} target={manuscript} globeRef={globeRef}
      ready={() => {
        const owner = ownership.current;
        return access === "adult" && active && !gl.getContext().isContextLost()
          && owner?.alive === true && owner.acknowledged && owner.key === shown.key
          && owner.id === "background.base.writer-study" && callbacks.current.appliedId === owner.id
          && callbacks.current.displayedId === owner.id;
      }} />}
  </> : canonicalBackground;
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
