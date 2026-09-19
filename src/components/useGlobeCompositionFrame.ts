import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PlanetCompositionPresentation } from "../host/planetCompositionPresentation";
import type { GlobeCompositionPart } from "../planet/globeComposition";
import type { GlobeStandPresentation } from "../planet/globeStands";
import type { GlobeBackgroundPresentation } from "../planet/globeBackgrounds";
import type { GlobeAtlas } from "./globeAtlas";
import type { GlobeEditionId } from "./globeEditions";
import type { PreparedCompositionSource } from "./useGlobeCompositionScene";

/** Each branch must be visible in the SAME completed renderer frame. */
export function useGlobeCompositionFrame({ presentation, atlas, prepared, editionId,
  stand, background, active }: {
  presentation?: PlanetCompositionPresentation;
  atlas: GlobeAtlas;
  prepared: PreparedCompositionSource | null;
  editionId: GlobeEditionId;
  stand?: GlobeStandPresentation;
  background?: GlobeBackgroundPresentation;
  active: boolean;
}) {
  const { gl, invalidate } = useThree();
  const latest = useRef({ presentation, prepared, editionId, active });
  const ledger = useRef<{ revision: number; frame: number; parts: Set<GlobeCompositionPart> } | null>(null);
  useLayoutEffect(() => {
    latest.current = { presentation, prepared, editionId, active };
    ledger.current = null;
    if (presentation?.snapshot.phase === "preparing") invalidate();
  }, [presentation, prepared, editionId, active, invalidate]);

  const recordFrame = useCallback((part: GlobeCompositionPart, revision: number, id: string, frame: number) => {
    const current = latest.current;
    const owner = current.presentation;
    if (!owner || !current.active || owner.snapshot.phase !== "preparing"
      || owner.snapshot.renderRevision !== revision || gl.getContext().isContextLost()) return;
    const { displayed } = owner.snapshot;
    const expected = part === "edition" ? displayed.editionId : part === "stand" ? displayed.standId : displayed.backgroundId;
    if (id !== expected || owner.controller.getSnapshot().renderRevision !== revision) return;
    if (!ledger.current || ledger.current.revision !== revision || ledger.current.frame !== frame) {
      ledger.current = { revision, frame, parts: new Set() };
    }
    ledger.current.parts.add(part);
    if (ledger.current.parts.size !== 3) return;
    const source = atlas.getEditionSourceState();
    if (!current.prepared || current.prepared.revision !== revision
      || source?.generation !== current.prepared.generation || source.editionId !== displayed.editionId
      || current.editionId !== displayed.editionId) return;
    // Three 0.178's actual texture upload version, not only canvas mutation.
    const uploaded = gl.properties.get(atlas.mapTexture) as { __version?: number };
    if (uploaded.__version !== atlas.mapTexture.version) return;
    owner.controller.acknowledgePartRendered("edition", revision, displayed.editionId);
    owner.controller.acknowledgePartRendered("stand", revision, displayed.standId);
    owner.controller.acknowledgePartRendered("background", revision, displayed.backgroundId);
    owner.controller.acknowledgeRendered(revision, displayed);
  }, [atlas, gl]);

  useFrame(() => {
    const current = latest.current;
    const owner = current.presentation;
    if (!owner || !current.active || owner.snapshot.phase !== "preparing") return;
    const source = atlas.getEditionSourceState();
    const candidate = current.prepared;
    if (!candidate || candidate.revision !== owner.snapshot.renderRevision
      || source?.generation !== candidate.generation || current.editionId !== candidate.editionId) {
      return;
    }
    const frame = gl.info.render.frame, textureVersion = atlas.mapTexture.version;
    queueMicrotask(() => {
      if (latest.current !== current || gl.info.render.frame <= frame
        || atlas.mapTexture.version !== textureVersion || gl.getContext().isContextLost()) return;
      recordFrame("edition", candidate.revision, candidate.editionId, gl.info.render.frame);
      if (owner.controller.getSnapshot().phase === "preparing") invalidate();
    });
  });
  const waiting = presentation?.snapshot.phase === "preparing";
  return {
    stand: useMemo(() => stand && ({ ...stand,
      onFrameRendered: waiting ? (revision: number, id: string, frame: number) => recordFrame("stand", revision, id, frame) : undefined,
    }), [stand, waiting, recordFrame]),
    background: useMemo(() => background && ({ ...background,
      onFrameRendered: waiting ? (revision: number, id: string, frame: number) => recordFrame("background", revision, id, frame) : undefined,
    }), [background, waiting, recordFrame]),
  };
}
