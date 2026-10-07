import * as THREE from "three";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";
import type { ChildNativeScene, ChildNativeSceneRecipient, ChildNativeModelWebResource } from "./childNativeScene";
import { childNativeAppearanceFromScene, sameChildNativeAppearance } from "./childNativeAppearance";
import { importCommon3dModel, type Common3dImported } from "./childCommon3dImport";
import type { Common3dTierId, Common3dResource } from "./childCommon3d";
import { CHILD_ENGINE_FIXED_RESIDENT_BYTES, ChildSceneBudgetError, ChildSceneCleanupError, canonicalChildEngineJson, childEngineBaseDecodedBytes, childEngineCompatible, childEngineTierCandidates, childEngineTextureBytes, type ChildEngineEnvironment } from "./childSceneEngine";
import { createChildSceneEncodedCache } from "./childSceneEncodedCache";
import type { ChildSceneCommitOptions } from "../components/childSceneTransition";

export interface ChildCanonicalTextures { readonly skin: THREE.Texture; readonly stand: THREE.Texture | null; readonly background: THREE.Texture }
export interface ChildCanonicalBundle {
  readonly scene: ChildNativeScene; readonly textures: ChildCanonicalTextures;
  readonly models: ReadonlyMap<"stand" | "background", Common3dImported>; readonly tier: Common3dTierId;
  readonly staticFallback?: boolean;
  readonly preparation?: ChildSceneCommitOptions;
  readonly residency?: Readonly<{ maxResidentBytes: number; candidateBytes: number; priorBytes: number; cacheBytes: number }>;
}
export interface ChildCanonicalRenderStage {
  commit(options?: ChildSceneCommitOptions): void | Promise<void>;
  presentPreview?(): void | Promise<void>;
  rollback(): void | Promise<void>; finalize?(): void; join?(): Promise<void>; readonly residentBytes?: number;
}
export type ChildCanonicalEnvironment = Omit<ChildEngineEnvironment, "exactAge" | "contentVersion">;
export interface ChildCanonicalPreviewSnapshot {
  readonly revision: number; readonly phase: "preparing" | "ready" | "applying"; readonly scene: ChildNativeScene | null;
}
export interface ChildCanonicalSnapshot {
  readonly phase: "empty" | "preparing" | "ready" | "unavailable"; readonly revision: number; readonly scene: ChildNativeScene | null; readonly textures: ChildCanonicalTextures | null;
  readonly models?: ChildCanonicalBundle["models"]; readonly renderClass?: "geometry" | "3d-lite" | "static";
  readonly persistence?: "restoring" | "saving" | "saved" | "restore-failed" | "save-failed" | null;
  /** Top-level resources remain the applied baseline until explicit apply. */
  readonly preview?: ChildCanonicalPreviewSnapshot | null;
}
export interface ChildCanonicalResources {
  getSnapshot(): ChildCanonicalSnapshot; subscribe(listener: () => void): () => void; isCurrent(): boolean;
  select(owner: ChildEntityReference, sceneId: string): Promise<boolean>; restore?(): Promise<boolean>;
  preview(owner: ChildEntityReference, sceneId: string): Promise<boolean>;
  applyPreview(expectedRevision?: number): Promise<boolean>; cancelPreview(expectedRevision?: number): Promise<boolean>;
  /** Navigation joins the private transaction even after Cancel hides its UI. */
  cancelAndWait(): Promise<boolean>;
  attachRenderer?(tier: Common3dTierId, stage: (bundle: ChildCanonicalBundle) => Promise<ChildCanonicalRenderStage | null>, environment?: () => ChildCanonicalEnvironment): () => void;
  setTier?(tier: Common3dTierId): void; refreshEnvironment?(): void;
  attachRecipient(recipient: ChildNativeSceneRecipient): () => void; clear(): void; join(): Promise<void>; dispose(): Promise<void>; activate(): () => void;
}
type Owned = { bundle: ChildCanonicalBundle; deadline: number; decodedBytes: number; residentBytes: number; textures: Set<THREE.Texture>; bytes: Set<Uint8Array> };
type Intent = { kind: "select" | "restore" | "preview"; entity?: ChildEntityReference; sceneId?: string };
type Retry = { tier: Common3dTierId; staticFallback: boolean; deadline: number; intent: Intent };
type PreviewRequest = {
  revision: number; ticket: number; phase: ChildCanonicalPreviewSnapshot["phase"]; owned: Owned | null; cancelled: boolean;
  ready(value: boolean): void; decision: Promise<boolean>; decide(apply: boolean): void;
  completion: Promise<boolean>; complete(value: boolean): void;
};
class ChildSceneTierError extends Error {}
const digest = async (value: Uint8Array) => {
  if (!(value.buffer instanceof ArrayBuffer)) throw new Error("Owned unshared hash input required");
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", value as Uint8Array<ArrayBuffer>))].map(b => b.toString(16).padStart(2, "0")).join("");
};
/** Previous valid composition remains live through warm, native CAS and the
 * bounded same-renderer transition. Presentation metadata/cache never grants
 * authority, renews a native lease or supplies another composition owner. */
export function createChildCanonicalResources(controller: ChildNativeAppController, contextToken: string, clock: () => number = () => performance.now()): ChildCanonicalResources {
  let state: ChildCanonicalSnapshot = Object.freeze({ phase: "empty", revision: 0, scene: null, textures: null });
  let epoch = 0, clearSequence = 0, active: Owned | null = null, disposed = false, broken = false, lastNow = -1;
  let tier: Common3dTierId = "balanced", renderer: ((bundle: ChildCanonicalBundle) => Promise<ChildCanonicalRenderStage | null>) | null = null;
  let environment: (() => ChildCanonicalEnvironment) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null, pendingAbort: AbortController | null = null, tail = Promise.resolve();
  let latestIntent: Intent | null = null, lastEnvironmentKey = "";
  let previewRequest: PreviewRequest | null = null;
  // A fresh native context can publish before React's separate Canvas root
  // attaches its recipient. Only this pre-acquisition restore may join that
  // attachment; it never opens a second lease or relaxes signed admission.
  let rendererAdmission: { abort: AbortController; wake?: () => void } | null = null;
  const listeners = new Set<() => void>(), recipients = new Set<ChildNativeSceneRecipient>(), workers = new Set<Promise<unknown>>(), cancels = new Set<() => void>();
  const parent = controller.getSnapshot().context;
  function now() { const at = clock(); if (!Number.isFinite(at) || at < lastNow) { broken = true; throw new Error("Child monotonic clock unavailable"); } lastNow = at; return at; }
  const cache = createChildSceneEncodedCache(contextToken, now);
  function admitted() { const s = controller.getSnapshot(); return !broken && !disposed && s.phase === "ready" && s.status === "child" && s.context === parent && parent?.token === contextToken; }
  function valid(ticket?: number, deadline = Infinity) { try { return admitted() && (ticket === undefined || ticket === epoch) && now() < deadline; } catch { return false; } }
  function currentEnvironment(): ChildEngineEnvironment | null {
    const view = environment?.(), profile = controller.getSnapshot().profiles.find(p => p.id === parent?.profileId);
    return view && profile && parent?.package ? { ...view, exactAge: profile.exactAge, contentVersion: parent.package.version } : null;
  }
  function environmentKey() { const v = environment?.(); return v ? JSON.stringify([v.editionId, v.platform, v.exploring, v.visible, v.reducedMotion]) : ""; }
  function awaitRenderer(admission: NonNullable<typeof rendererAdmission>, ticket: number, deadline: number): Promise<boolean> {
    return new Promise(resolve => {
      let finished = false, timeout: ReturnType<typeof setTimeout> | undefined;
      const finish = (ready: boolean) => {
        if (finished) return; finished = true;
        if (timeout !== undefined) clearTimeout(timeout);
        admission.abort.signal.removeEventListener("abort", cancelled);
        if (admission.wake === wake) admission.wake = undefined;
        resolve(ready);
      };
      const cancelled = () => finish(false);
      const wake = () => {
        try {
          if (admission !== rendererAdmission || admission.abort.signal.aborted || !valid(ticket, deadline)) finish(false);
          else if (renderer && environment?.().visible) finish(true);
        } catch { finish(false); }
      };
      admission.wake = wake; admission.abort.signal.addEventListener("abort", cancelled, { once: true });
      // This bound is contained inside the original dispatch-based lease.
      // Expiry releases that exact scene; a late attachment cannot replay it.
      try { timeout = setTimeout(cancelled, Math.max(1, Math.min(5000, deadline - now()))); wake(); }
      catch { finish(false); }
    });
  }
  async function preloadReady(ticket: number, deadline: () => number, signal: AbortSignal): Promise<boolean> {
    while (!signal.aborted && valid(ticket, deadline()) && environment?.().preloadPaused) {
      await new Promise<void>(resolve => {
        const done = () => { clearTimeout(wait); signal.removeEventListener("abort", done); resolve(); };
        const wait = setTimeout(done, 25); signal.addEventListener("abort", done, { once: true });
      });
    }
    return !signal.aborted && valid(ticket, deadline());
  }
  function compatible(bundle: ChildCanonicalBundle, retained = false) {
    const engine = bundle.scene.modelPackage?.engineComposition;
    if (!engine) return true; const view = currentEnvironment();
    return !!view && childEngineCompatible(engine, bundle.scene, retained ? { ...view, exploring: false } : view, bundle.tier);
  }
  function publish(phase: ChildCanonicalSnapshot["phase"], owned: Owned | null = null, persistence: ChildCanonicalSnapshot["persistence"] = null) {
    const engine = owned?.bundle.scene.modelPackage?.engineComposition;
    state = Object.freeze({ phase, revision: epoch, scene: owned?.bundle.scene ?? null, textures: owned?.bundle.textures ?? null,
      ...(owned ? { models: owned.bundle.models } : {}), ...(engine && owned ? { renderClass: owned.bundle.staticFallback ? "static" as const : owned.bundle.tier === "economy" ? "3d-lite" as const : "geometry" as const } : {}), persistence,
      preview: previewRequest && !previewRequest.cancelled ? Object.freeze({ revision: previewRequest.revision, phase: previewRequest.phase, scene: previewRequest.owned?.bundle.scene ?? null }) : null });
    for (const listener of [...listeners]) if (listeners.has(listener)) try { listener(); } catch { broken = true; }
  }
  function retireParts(sceneToken: string | undefined, models: ChildCanonicalBundle["models"], textures: Set<THREE.Texture>, bytes: Set<Uint8Array>) {
    try { if (sceneToken) cache.retireScene(sceneToken); } catch { broken = true; }
    for (const m of models.values()) try { m.dispose(); } catch { broken = true; }
    for (const t of textures) {
      try { (t.image as HTMLImageElement | null)?.removeAttribute("src"); } catch { broken = true; }
      try { t.dispose(); } catch { broken = true; } finally { t.image = null; }
    }
    for (const b of bytes) try { b.fill(0); } catch { broken = true; }
    bytes.clear(); textures.clear();
  }
  function retire(owned: Owned | null) { if (owned) retireParts(owned.bundle.scene.sceneToken, owned.bundle.models, owned.textures, owned.bytes); }
  function track<T>(work: Promise<T>) { workers.add(work); void work.then(() => workers.delete(work), () => workers.delete(work)); return work; }
  function clear() {
    ++epoch; ++clearSequence; pendingAbort?.abort(); pendingAbort = null; cache.clear();
    if (previewRequest) { previewRequest.cancelled = true; previewRequest.decide(false); previewRequest = null; }
    for (const cancel of [...cancels]) cancel(); if (timer !== null) clearTimeout(timer); timer = null;
    for (const r of [...recipients]) try { r.clear(); } catch { broken = true; }
    retire(active); active = null; publish("empty");
  }
  async function join() {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try { await Promise.race([Promise.all([...workers, cache.join(), ...[...recipients].map(r => r.join())]), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Child renderer cleanup did not join")), 5000); })]); if (broken) throw new Error("Child renderer cleanup failed"); }
    catch (error) { broken = true; throw error; } finally { if (timeout !== null) clearTimeout(timeout); }
  }
  function image(uri: string, skin: boolean, ticket: number, deadline: () => number, owned: Set<THREE.Texture>, model = false): Promise<THREE.Texture | null> {
    const image = new Image(); image.crossOrigin = "anonymous"; image.decoding = "async";
    let settle!: (value: THREE.Texture | null) => void, cancelled = false, finished = false, decoding = false;
    let imageTimer: ReturnType<typeof setTimeout> | null = null;
    const done = new Promise<THREE.Texture | null>(resolve => { settle = resolve; });
    const cancel = () => { cancelled = true; image.onload = null; image.onerror = null; image.removeAttribute("src"); if (!decoding) finish(null); };
    function finish(value: THREE.Texture | null) { if (finished) { value?.dispose(); return; } finished = true; if (imageTimer !== null) clearTimeout(imageTimer); imageTimer = null; cancels.delete(cancel); image.onload = null; image.onerror = null; settle(value); }
    image.onload = () => { if (decoding || finished || cancelled) return; decoding = true; void Promise.resolve().then(() => { if (cancelled || !valid(ticket, deadline())) throw new Error("Image retired before decode"); return image.decode(); }).then(() => {
      if (cancelled || !valid(ticket, deadline()) || image.naturalWidth < 1 || image.naturalHeight < 1 || image.naturalWidth > 4096 || image.naturalHeight > 4096 || image.naturalWidth * image.naturalHeight > 16_777_216 || skin && image.naturalWidth !== 2 * image.naturalHeight) { image.removeAttribute("src"); finish(null); return; }
      const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = !model; texture.wrapS = skin ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.needsUpdate = true; owned.add(texture); finish(texture);
    }).catch(() => { image.removeAttribute("src"); finish(null); }); };
    image.onerror = cancel; cancels.add(cancel); track(done); if (!valid(ticket, deadline())) cancel(); else { imageTimer = setTimeout(cancel, Math.max(1, deadline() - now())); image.src = uri; } return done;
  }
  async function binary(scene: ChildNativeScene, output: ChildNativeModelWebResource, resource: Common3dResource, abort: AbortController, ticket: number, deadline: () => number, narrow: (at: number) => void): Promise<Uint8Array> {
    // acquireModel already returned this exact fresh native output. A cache hit
    // rechecks SHA and the current lease, and carries its earlier expiry.
    const current = () => valid(ticket, deadline()) && !abort.signal.aborted;
    const cached = await cache.read(resource, scene.sceneToken, deadline(), current);
    if (cached) { narrow(cached.absoluteDeadline); if (current()) return cached.bytes; cached.bytes.fill(0); throw new Error("Cached copy retired"); }
    const result = new Uint8Array(resource.encodedBytes), read = controller.scenes?.readModelChunk;
    try {
      if (!read) throw new Error("Native typed resource reader unavailable");
      for (let offset = 0; offset < result.length;) {
        if (!await preloadReady(ticket, deadline, abort.signal) || !current()) throw new Error("Child model retired");
        const length = Math.min(65536, result.length - offset), dispatched = now(), chunk = await read(scene, output, resource, offset, length);
        if (!chunk || chunk.offset !== offset || chunk.totalBytes !== result.length || chunk.mime !== resource.mime || chunk.sceneToken !== scene.sceneToken || chunk.resourceToken !== output.resourceToken
          || !Number.isSafeInteger(chunk.remainingLifetimeMs) || chunk.remainingLifetimeMs < 1 || chunk.remainingLifetimeMs > 60000 || chunk.encodedBase64.length !== Math.ceil(length / 3) * 4) throw new Error("Exact native model chunk required");
        narrow(dispatched + chunk.remainingLifetimeMs);
        if (!current()) throw new Error("Child model retired");
        const decoded = atob(chunk.encodedBase64); if (decoded.length !== length || btoa(decoded) !== chunk.encodedBase64) throw new Error("Exact native chunk framing");
        for (let i = 0; i < length; i++) result[offset + i] = decoded.charCodeAt(i); offset += length;
      }
      if (await digest(result) !== resource.checksum || !current()) throw new Error("Native model checksum mismatch");
      await cache.store(resource, result, scene.sceneToken, deadline(), current);
      if (!current()) throw new Error("Child model retired"); return result;
    } catch (error) { result.fill(0); throw error; }
  }
  async function choose(kind: Intent["kind"], entity?: ChildEntityReference, sceneId?: string, retry?: Retry, preview?: PreviewRequest): Promise<boolean> {
    const scenes = controller.scenes; if (!scenes || !valid() || retry && latestIntent !== retry.intent || kind === "preview" && (!preview || !renderer)) return false;
    const intent = retry?.intent ?? { kind, entity, sceneId }; if (!retry) latestIntent = intent;
    const replacingPreview = previewRequest !== null;
    const ticket = ++epoch, staticFallback = retry?.staticFallback ?? false, originalClear = clearSequence;
    let requestedTier = retry?.tier ?? tier;
    pendingAbort?.abort(); for (const cancel of [...cancels]) cancel(); const abort = new AbortController(); pendingAbort = abort;
    const admission = kind === "restore" && !active ? { abort, wake: undefined as (() => void) | undefined } : null;
    rendererAdmission = admission;
    if (previewRequest && previewRequest !== preview) { previewRequest.cancelled = true; previewRequest.decide(false); }
    previewRequest = preview ?? null;
    if (preview) { if (!preview.revision) preview.revision = ticket; preview.ticket = ticket; preview.phase = "preparing"; preview.owned = null; }
    const cancelDecision = () => {
      if (!preview) return; preview.cancelled = true; preview.decide(false);
      // Notify only after all synchronous renderer abort recipients restored A.
      queueMicrotask(() => { if (previewRequest === preview && preview.cancelled && state.preview) publish(state.phase, active, state.persistence); });
    };
    abort.signal.addEventListener("abort", cancelDecision, { once: true });
    const previousWork = tail; let releaseTail!: () => void; tail = new Promise(resolve => { releaseTail = resolve; });
    let nextRetry: Retry | null = null;
    const work = (async () => {
      await previousWork; if (!valid(ticket, retry?.deadline)) {
        if (rendererAdmission === admission) rendererAdmission = null;
        if (pendingAbort === abort) pendingAbort = null;
        return false;
      }
      let scene: ChildNativeScene | null = null, deadline = retry?.deadline ?? Infinity, candidate: Owned | null = null, stage: ChildCanonicalRenderStage | null = null, committed = false;
      const textures = new Set<THREE.Texture>(), bytes = new Set<Uint8Array>(), models = new Map<"stand" | "background", Common3dImported>();
      const previousPersistence = state.persistence ?? null;
      let rollbackWork: Promise<void> | null = null;
      const rollbackStage = () => rollbackWork ??= (async () => {
        let failed = false;
        if (preview?.owned) preview.cancelled = true;
        try { await stage?.rollback(); } catch { failed = true; }
        try { await stage?.join?.(); } catch { failed = true; }
        if (failed) throw new ChildSceneCleanupError("Renderer rollback or join failed");
      })();
      const current = () => valid(ticket, deadline) && !abort.signal.aborted;
      let requestTimer: ReturnType<typeof setTimeout> | null = null;
      const narrowDeadline = (next: number) => {
        deadline = Math.min(deadline, next); if (requestTimer !== null) clearTimeout(requestTimer);
        requestTimer = setTimeout(() => { abort.abort(); for (const cancel of [...cancels]) cancel(); }, Math.max(1, deadline - now()));
      };
      if (preview) publish(active ? "ready" : "empty", active, previousPersistence);
      else if (!active) publish("preparing", null, kind === "restore" ? "restoring" : "saving");
      try {
        const saved = await scenes.readSelection(); if (!saved || saved.profileId !== parent?.profileId || !current()) return false;
        if (preview && active) {
          const baseline = childNativeAppearanceFromScene(active.bundle.scene);
          if (!baseline || !saved.selection || !sameChildNativeAppearance(baseline, saved.selection)) return false;
          narrowDeadline(active.deadline);
        }
        const start = now();
        if (kind === "restore") {
          const restored = await scenes.restore(saved);
          // A cancelled read may still deliver an owned native lease. Capture
          // it for finally cleanup before rejecting the obsolete presentation.
          if (restored?.status === "restored") scene = restored.scene;
          if (!restored || !current()) return false;
          if (restored.status === "absent") { if (!active) publish("empty"); committed = true; return true; }
          if (restored.status !== "restored") return false;
        } else scene = entity && sceneId ? await scenes.open(entity, sceneId) : null;
        if (!scene || !current()) return false; narrowDeadline(start + scene.remainingLifetimeMs);
        const engine = scene.modelPackage?.engineComposition;
        if (engine && admission && !await awaitRenderer(admission, ticket, deadline)) return false;
        // Attachment supplies the actual tier. No native resources have been
        // acquired, so this is the first admission, not a retry/lease renewal.
        if (admission && !retry) requestedTier = tier;
        if (rendererAdmission === admission) rendererAdmission = null;
        const policy = engine?.tiers.find(p => p.tier === requestedTier);
        if (engine) {
          const view = currentEnvironment();
          if (!view || !policy || !renderer || !childEngineCompatible(engine, scene, view, requestedTier, false)
            || staticFallback && (!engine.fallback.staticAllowed || requestedTier !== "economy")
            || await digest(new TextEncoder().encode(canonicalChildEngineJson(engine))) !== scene.modelPackage?.engineCompositionChecksum || !current()) return false;
        if (!childEngineCompatible(engine, scene, view, requestedTier)) throw new ChildSceneTierError("Signed items exclude this tier");
        } else if (staticFallback) return false;
        let decodedBytes = 0, residentBytes = 0, encodedBytes = 0, triangles = 0;
        const warmBytes = CHILD_ENGINE_FIXED_RESIDENT_BYTES;
        const residentCap = policy?.maxResidentBytes ?? Infinity;
        function checkBudget(extraDecoded = 0, extraEncoded = 0, extraResident = Math.ceil(extraDecoded * 7 / 4)) {
          if (!policy) return;
          const decoded = decodedBytes + extraDecoded, fixed = residentBytes + extraResident + encodedBytes + extraEncoded + (active?.residentBytes ?? 0) + warmBytes;
          cache.setLimit(Math.min(policy.maxEncodedCacheBytes, Math.max(0, Math.floor(residentCap - fixed))));
          if (decoded > policy.maxDecodedBytes || triangles > policy.maxTriangles || fixed + cache.getSnapshot().bytes > residentCap) throw new ChildSceneBudgetError("Actual candidate/active scene exceeds signed memory budget");
        }
        if (engine) {
          const expected = childEngineBaseDecodedBytes(engine, staticFallback);
          if (expected > policy!.maxDecodedBytes || Math.ceil(expected * 7 / 4) + (active?.residentBytes ?? 0) + warmBytes > residentCap) throw new ChildSceneBudgetError("Base image budget requires a lower authorized presentation");
        } else cache.setLimit(0);
        const maps: { skin?: THREE.Texture; stand?: THREE.Texture | null; background?: THREE.Texture } = { stand: staticFallback ? null : undefined };
        const slots = staticFallback ? [scene.skin, scene.background.asset] : [scene.skin, scene.stand.asset, scene.background.asset];
        for (const slot of slots) {
          if (!await preloadReady(ticket, () => deadline, abort.signal)) return false;
          const signed = engine?.textures.find(t => t.slotId === slot.slotId);
          if (signed) checkBudget(childEngineTextureBytes(signed), slot.encodedBytes);
          const dispatched = now(), output = await scenes.acquire(scene, slot); if (!output || !current()) return false;
          narrowDeadline(dispatched + output.remainingLifetimeMs);
          if (output.status === "budget-declined") { if (engine && current()) throw new ChildSceneBudgetError(output.reason); return false; }
          const decoded = await image(output.uri, slot.slotId === "skin", ticket, () => deadline, textures); if (!decoded || !current()) return false;
          const actualImage = decoded.image as HTMLImageElement;
          if (signed && (actualImage.naturalWidth !== signed.width || actualImage.naturalHeight !== signed.height)) return false;
          const imageBytes = Math.ceil(actualImage.naturalWidth * actualImage.naturalHeight * 16 / 3);
          decodedBytes += imageBytes; residentBytes += imageBytes + actualImage.naturalWidth * actualImage.naturalHeight * 4; maps[slot.slotId] = decoded; checkBudget();
        }
        if (!maps.skin || maps.stand === undefined || !maps.background) return false;
        if (scene.modelPackage && !staticFallback) {
          if (!scenes.acquireModel || !scenes.readModelChunk || !renderer) return false;
          const selected = scene.modelPackage.tiers.find(t => t.tier === requestedTier); if (!selected) return false;
          let modelDecodedBytes = 0;
          for (const descriptor of selected.models) {
            const buffers = new Map<string, Uint8Array>(), modelTextures = new Map<string, THREE.Texture>(); let modelBytes: Uint8Array | null = null;
            for (const resource of [descriptor.model, ...descriptor.dependencies]) {
              if (!await preloadReady(ticket, () => deadline, abort.signal)) return false;
              checkBudget(0, resource.encodedBytes); const dispatched = now(), output = await scenes.acquireModel(scene, resource, selected.tier); if (!output || !current()) return false;
              narrowDeadline(dispatched + output.remainingLifetimeMs);
              if (output.status === "budget-declined") { if (engine && current()) throw new ChildSceneBudgetError(output.reason); return false; }
              if (resource.kind === "texture") {
                if (engine) { if (!output.dimensions) return false; checkBudget(childEngineTextureBytes(output.dimensions), resource.encodedBytes); }
                const t = await image(output.uri, false, ticket, () => deadline, textures, true); if (!t || !current()) return false;
                if (output.dimensions && (t.image.naturalWidth !== output.dimensions.width || t.image.naturalHeight !== output.dimensions.height)) return false;
                modelTextures.set(resource.alias, t); const imageBytes = Math.ceil(t.image.naturalWidth * t.image.naturalHeight * 16 / 3);
                modelDecodedBytes += imageBytes; decodedBytes += imageBytes; residentBytes += imageBytes + t.image.naturalWidth * t.image.naturalHeight * 4;
              } else {
                encodedBytes += resource.encodedBytes; checkBudget(0, resource.encodedBytes + Math.min(65_536, resource.encodedBytes) * 6);
                const b = await binary(scene, output, resource, abort, ticket, () => deadline, narrowDeadline); bytes.add(b);
                if (resource.kind === "model") modelBytes = b; else buffers.set(resource.alias, b);
              }
              if (modelDecodedBytes > selected.maxDecodedBytes) { if (engine) throw new ChildSceneBudgetError("Native model decode budget exceeded"); return false; } checkBudget();
            }
            if (!modelBytes || !current()) return false;
            const nativeRemaining = selected.maxDecodedBytes - modelDecodedBytes;
            const decodedRemaining = policy ? policy.maxDecodedBytes - decodedBytes : nativeRemaining;
            const residentRemaining = policy ? Math.floor((residentCap - residentBytes - encodedBytes - (active?.residentBytes ?? 0) - warmBytes - cache.getSnapshot().bytes) / 2) : nativeRemaining;
            const allowed = Math.min(nativeRemaining, decodedRemaining, residentRemaining), remainingTriangles = Math.min(selected.maxTriangles, policy?.maxTriangles ?? selected.maxTriangles) - triangles;
            if (allowed < 1 || remainingTriangles < 1) { if (engine) throw new ChildSceneBudgetError("No room for checked import arrays"); return false; }
            let imported: Common3dImported;
            try { imported = importCommon3dModel(modelBytes, descriptor, buffers, modelTextures, { ...selected, maxDecodedBytes: allowed, maxTriangles: remainingTriangles }); }
            catch (error) { if (engine && error instanceof Error && ["Common 3D: decoded byte budget", "Common 3D: generated normal budget", "Common 3D: triangle budget", "Model sampler decoded budget"].includes(error.message)) throw new ChildSceneBudgetError("Checked import size exceeds remaining peak budget"); throw error; }
            models.set(descriptor.slotId, imported);
            decodedBytes += imported.decodedBytes; modelDecodedBytes += imported.decodedBytes; residentBytes += imported.decodedBytes * 2; triangles += imported.triangles;
            // Independent import arrays coexist with checked encoded buffers
            // during import; charge that peak before wiping transport copies.
            checkBudget();
            for (const encoded of [modelBytes, ...buffers.values()]) { encodedBytes -= encoded.length; encoded.fill(0); bytes.delete(encoded); }
            buffers.clear(); modelBytes = null;
            if (modelDecodedBytes > selected.maxDecodedBytes || triangles > selected.maxTriangles) { if (engine) throw new ChildSceneBudgetError("Native model geometry budget exceeded"); return false; } checkBudget();
          }
        }
        // After the previous branch is retired, the new branch must fit its own
        // final tier cap, independently of the short transition peak allowance.
        if (policy && residentBytes + warmBytes > policy.maxResidentBytes) throw new ChildSceneBudgetError("Final scene residency exceeds tier budget");
        candidate = { bundle: Object.freeze({ scene, textures: Object.freeze(maps as ChildCanonicalTextures), models, tier: requestedTier,
          preparation: Object.freeze({ signal: abort.signal, isCurrent: current, absoluteDeadline: deadline }), ...(staticFallback ? { staticFallback: true } : {}),
          ...(policy ? { residency: Object.freeze({ maxResidentBytes: residentCap, candidateBytes: residentBytes, priorBytes: active?.residentBytes ?? 0, cacheBytes: cache.getSnapshot().bytes }) } : {}) }),
          deadline, decodedBytes, residentBytes, textures, bytes };
        if (renderer) { if (!await preloadReady(ticket, () => deadline, abort.signal)) return false; stage = await renderer(candidate.bundle); if (!stage || !current()) return false;
          if (policy) { const extra = stage.residentBytes; if (typeof extra !== "number" || !Number.isSafeInteger(extra) || extra < 0) return false; residentBytes += extra; candidate.residentBytes = residentBytes; checkBudget(); }
        }
        const projected = childNativeAppearanceFromScene(scene); if (!projected || !current()) return false;
        if (kind === "restore" && (!saved.selection || !sameChildNativeAppearance(saved.selection, projected))) return false;
        if (preview) {
          // The existing serialized worker owns the entire inspection interval.
          // No durable write or prior-resource retirement precedes user apply.
          if (!stage?.presentPreview || !stage.finalize) return false;
          await stage.commit({ signal: abort.signal, isCurrent: () => current() && !!candidate && compatible(candidate.bundle), absoluteDeadline: deadline });
          if (!current() || !compatible(candidate.bundle)) return false;
          preview.owned = candidate;
          await stage.presentPreview();
          if (!current() || !compatible(candidate.bundle)) return false;
          preview.phase = "ready"; publish(active ? "ready" : "empty", active, previousPersistence);
          if (!current() || previewRequest !== preview || preview.cancelled) return false;
          preview.ready(true);
          if (!await preview.decision || !current()) return false;
          const fresh = await scenes.readSelection();
          if (!fresh || !current() || fresh.profileId !== saved.profileId || fresh.revision !== saved.revision
            || (fresh.selection === null) !== (saved.selection === null)
            || fresh.selection && saved.selection && !sameChildNativeAppearance(fresh.selection, saved.selection)) return false;
        }
        const remembered = await scenes.remember(scene, saved.revision);
        if (!remembered || remembered.profileId !== parent?.profileId || remembered.revision !== saved.revision + 1 || !remembered.selection || !sameChildNativeAppearance(remembered.selection, projected)) return false;
        const rollbackNative = async () => {
          // Join the actual renderer rollback before allowing queued C to read
          // the durable choice. The rollback snapshot is native-owned only.
          try { await rollbackStage(); } catch { broken = true; }
          const reverted = await Promise.resolve().then(() => scenes.rollback?.(scene!, remembered.revision)).catch(() => null);
          const same = reverted && reverted.profileId === saved.profileId && (saved.selection === null ? reverted.selection === null : reverted.selection !== null && sameChildNativeAppearance(saved.selection, reverted.selection));
          if (broken || !reverted || !same || reverted.revision !== remembered.revision + 1 || originalClear !== clearSequence || !valid(undefined, deadline)) {
            broken = true; clear(); void controller.suspend().catch(() => undefined);
          }
          return false;
        };
        if (!current()) return await rollbackNative();
        try {
          if (!preview) await stage?.commit({ signal: abort.signal, isCurrent: () => current() && !!candidate && compatible(candidate.bundle), absoluteDeadline: deadline });
          if (!current() || !compatible(candidate.bundle)) return await rollbackNative();
          stage?.finalize?.();
          // Finalization can dispatch synchronous Three/host observers. Never
          // publish a candidate after one of them revoked this exact owner.
          if (!current() || !compatible(candidate.bundle)) { broken = true; return await rollbackNative(); }
        } catch { return await rollbackNative(); }
        const prior = active; active = candidate; candidate = null; committed = true;
        if (previewRequest === preview) previewRequest = null;
        // Always retire/release the prior native lease, even if notification or
        // one disposal observer fails. Unknown cleanup seals the local owner.
        try {
          await stage?.join?.();
          if (active === null || !valid(undefined, active.deadline) || originalClear !== clearSequence || !compatible(active.bundle)) throw new Error("Finalized scene retired before publication");
          publish("ready", active, "saved");
          if (timer !== null) clearTimeout(timer);
          timer = setTimeout(() => { clear(); void join().then(() => scenes.releaseAll()).catch(() => controller.suspend()); }, Math.max(1, deadline - now()));
        } catch { broken = true; }
        finally {
          retire(prior);
          if (prior && prior.bundle.scene.sceneToken !== scene.sceneToken) {
            try { if (!await scenes.release(prior.bundle.scene.sceneToken, prior.bundle.scene)) broken = true; } catch { broken = true; }
          }
        }
        if (broken) { clear(); void controller.suspend().catch(() => undefined); return false; }
        return ticket === epoch;
      } catch (error) {
        if (error instanceof ChildSceneCleanupError) { broken = true; clear(); void controller.suspend().catch(() => undefined); }
        const engine = scene?.modelPackage?.engineComposition;
        // Only measured budget decline or an explicit signed tier exclusion permits fallback. Invalid bytes,
        // metadata, native authority or warm failure never become fallback PASS.
        if ((error instanceof ChildSceneBudgetError || error instanceof ChildSceneTierError) && engine && current() && latestIntent === intent) {
          const choices = childEngineTierCandidates(tier, engine), index = choices.findIndex(c => c.tier === requestedTier && c.staticFallback === staticFallback), next = choices[index + 1];
          if (index >= 0 && next) nextRetry = { ...next, deadline, intent };
        }
        return false;
      } finally {
        if (rendererAdmission === admission) rendererAdmission = null;
        if (requestTimer !== null) clearTimeout(requestTimer);
        abort.signal.removeEventListener("abort", cancelDecision);
        if (!committed) {
          try { await rollbackStage(); } catch { broken = true; clear(); void controller.suspend().catch(() => undefined); }
          if (candidate) retire(candidate);
          else retireParts(scene?.sceneToken, models, textures, bytes);
          if (scene && scene.sceneToken !== active?.bundle.scene.sceneToken) {
            cache.retireScene(scene.sceneToken);
            try { if (!await scenes.release(scene.sceneToken, scene)) { broken = true; clear(); void controller.suspend().catch(() => undefined); } } catch { broken = true; clear(); void controller.suspend().catch(() => undefined); }
          }
          if (ticket === epoch && valid()) {
            const persistence = preview && preview.phase !== "applying" ? previousPersistence : kind === "restore" ? "restore-failed" : "save-failed";
            if (active && valid(undefined, active.deadline)) publish("ready", active, persistence);
            else { retire(active); active = null; publish(preview ? "empty" : "unavailable", null, persistence); }
          }
        }
        if (pendingAbort === abort) pendingAbort = null;
      }
    })();
    const completion = track(work).finally(releaseTail);
    if ((preview || replacingPreview) && ticket === epoch && valid()) publish(active ? "ready" : "empty", active, state.persistence);
    const result = await completion;
    // Fresh native lease, after releasing/joining the declined candidate. The
    // original absolute deadline is carried; a later user intent wins the race.
    const retryNext = nextRetry as Retry | null;
    if (!result && retryNext && ticket === epoch && latestIntent === intent && valid(undefined, retryNext.deadline)) return choose(kind, entity, sceneId, retryNext, preview);
    return result;
  }
  function preview(entity: ChildEntityReference, id: string): Promise<boolean> {
    let ready!: (value: boolean) => void, decide!: (value: boolean) => void, complete!: (value: boolean) => void;
    const readiness = new Promise<boolean>(resolve => { ready = resolve; });
    const request: PreviewRequest = { revision: 0, ticket: 0, phase: "preparing", owned: null, cancelled: false, ready,
      decision: new Promise(resolve => { decide = resolve; }), decide: value => decide(value),
      completion: new Promise(resolve => { complete = resolve; }), complete: value => complete(value) };
    const finish = (result: boolean) => {
      if (broken) { clear(); void controller.suspend().catch(() => undefined); }
      else if (previewRequest === request) { previewRequest = null; publish(state.phase, active, state.persistence); }
      request.ready(false); request.complete(result);
    };
    void choose("preview", entity, id, undefined, request).then(finish, () => { broken = true; clear(); void controller.suspend().catch(() => undefined); finish(false); });
    return readiness;
  }
  async function applyPreview(expectedRevision?: number): Promise<boolean> {
    const request = previewRequest, owned = request?.owned;
    if (!request || request.cancelled || request.phase !== "ready" || expectedRevision !== undefined && expectedRevision !== request.revision
      || !owned) return false;
    if (!valid(request.ticket, owned.deadline) || !compatible(owned.bundle)) { await cancelPreview(request.revision); return false; }
    request.phase = "applying"; publish(state.phase, active, state.persistence); request.decide(true);
    return request.completion;
  }
  async function cancelPreview(expectedRevision?: number): Promise<boolean> {
    const request = previewRequest;
    if (!request || expectedRevision !== undefined && expectedRevision !== request.revision) return false;
    const ticket = epoch + (request.cancelled ? 0 : 1);
    if (!request.cancelled) {
      request.cancelled = true; ++epoch; pendingAbort?.abort(); request.decide(false);
      publish(state.phase, active, state.persistence);
    }
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const joined = await Promise.race([request.completion.then(() => true), new Promise<false>(resolve => {
      timeout = setTimeout(() => resolve(false), 5000);
    })]);
    if (timeout !== undefined) clearTimeout(timeout);
    // A timeout grants no navigation; the original worker still owns cleanup.
    // A later B likewise cannot be consumed by the older cancellation of A.
    return joined && epoch === ticket && previewRequest === null && admitted();
  }
  async function cancelAndWait(): Promise<boolean> {
    if (!admitted()) return false;
    // Capture ownership before abort/publish can synchronously start a newer
    // intent. Public preview=null does not mean its native CAS has joined.
    const request = previewRequest, abort = pendingAbort, pending = [...workers], originalTail = tail, transports = [...cancels];
    const originalClear = clearSequence, intent = latestIntent, ticket = ++epoch;
    if (request) { request.cancelled = true; request.decide(false); }
    abort?.abort();
    for (const cancel of transports) cancel();
    if (pendingAbort === abort) pendingAbort = null;
    // A reentrant subscriber may own B now. Do not publish over that successor.
    if (epoch === ticket) publish(state.phase, active, state.persistence);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const joined = await Promise.race([
      Promise.all([originalTail, ...pending, ...(request ? [request.completion] : [])]).then(() => true, () => false),
      new Promise<false>(resolve => { timeout = setTimeout(() => resolve(false), 5000); }),
    ]);
    if (timeout !== undefined) clearTimeout(timeout);
    // Timeout denies navigation, but leaves the original worker responsible
    // for late compensation/cleanup. Only clear() may retire the baseline.
    return joined && epoch === ticket && clearSequence === originalClear && latestIntent === intent
      && previewRequest === null && admitted();
  }
  function refreshEnvironment() {
    const key = environmentKey(), changed = key !== lastEnvironmentKey; lastEnvironmentKey = key;
    const held = previewRequest?.owned;
    // Inspection changes presentation, not the captured selection or lease.
    // The hidden baseline need not itself support Explore; it must still meet
    // the original age/edition/platform/visibility requirements for rollback.
    if (active && !compatible(active.bundle, !!held)) {
      const scene = active.bundle.scene; clear();
      track(Promise.resolve(controller.scenes?.release(scene.sceneToken, scene)).then(ok => { if (ok === false) return controller.suspend(); }));
    } else if (held) {
      if (!compatible(held.bundle)) void cancelPreview(previewRequest!.revision);
    } else if (rendererAdmission?.abort === pendingAbort) {
      // Until the first acquisition, the current worker admits the freshly
      // attached environment. All later changes retain ordinary cancellation.
      rendererAdmission?.wake?.();
    } else if (pendingAbort && changed) { ++epoch; pendingAbort.abort(); pendingAbort = null; }
  }
  const owner: ChildNativeSceneRecipient = { clear, join }; let detachOwner: (() => void) | undefined;
  return Object.freeze({
    getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    isCurrent: () => {
      const shown = previewRequest?.owned;
      if (shown && !previewRequest!.cancelled) return valid(previewRequest!.ticket, shown.deadline) && compatible(shown.bundle);
      return !!active && state.phase === "ready" && valid(undefined, active.deadline) && compatible(active.bundle, !!shown);
    },
    activate() { if (disposed) throw new Error("Child resources disposed"); if (!detachOwner) detachOwner = controller.scenes?.attachRecipient(owner); return () => { clear(); detachOwner?.(); detachOwner = undefined; }; },
    select: (entity: ChildEntityReference, id: string) => choose("select", entity, id), restore: () => choose("restore"), preview, applyPreview, cancelPreview, cancelAndWait, clear, join, refreshEnvironment,
    attachRenderer(nextTier: Common3dTierId, next: (bundle: ChildCanonicalBundle) => Promise<ChildCanonicalRenderStage | null>, nextEnvironment?: () => ChildCanonicalEnvironment) {
      if (renderer) throw new Error("One original composition renderer required"); tier = nextTier; renderer = next; environment = nextEnvironment ?? null; lastEnvironmentKey = environmentKey();
      rendererAdmission?.wake?.();
      return () => { if (renderer === next) { clear(); renderer = null; environment = null; } };
    },
    setTier(nextTier: Common3dTierId) { if (nextTier === tier || disposed) return; tier = nextTier;
      if (rendererAdmission?.abort === pendingAbort && pendingAbort) { rendererAdmission?.wake?.(); return; }
      if (previewRequest) void choose("restore"); else if (pendingAbort && latestIntent) void choose(latestIntent.kind, latestIntent.entity, latestIntent.sceneId); else if (active) void choose("restore"); },
    attachRecipient(recipient: ChildNativeSceneRecipient) {
      if (disposed) throw new Error("Child resource recipient retired"); recipients.add(recipient);
      return () => { recipient.clear(); recipients.delete(recipient); track(Promise.resolve().then(() => recipient.join()).catch(error => { broken = true; throw error; })); };
    },
    async dispose() { if (disposed) return; clear(); disposed = true; detachOwner?.(); await join(); listeners.clear(); recipients.clear(); },
  });
}
