import * as THREE from "three";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";
import type { ChildNativeScene, ChildNativeSceneRecipient, ChildNativeModelWebResource } from "./childNativeScene";
import { childNativeAppearanceFromScene, sameChildNativeAppearance } from "./childNativeAppearance";
import { importCommon3dModel, type Common3dImported } from "./childCommon3dImport";
import type { Common3dTierId, Common3dResource } from "./childCommon3d";

export interface ChildCanonicalTextures { readonly skin: THREE.Texture; readonly stand: THREE.Texture; readonly background: THREE.Texture }
export interface ChildCanonicalBundle { readonly scene: ChildNativeScene; readonly textures: ChildCanonicalTextures; readonly models: ReadonlyMap<"stand" | "background", Common3dImported>; readonly tier: Common3dTierId }
export interface ChildCanonicalRenderStage { commit(): void; rollback(): void }
export interface ChildCanonicalSnapshot {
  readonly phase: "empty" | "preparing" | "ready" | "unavailable"; readonly revision: number; readonly scene: ChildNativeScene | null; readonly textures: ChildCanonicalTextures | null;
  readonly models?: ChildCanonicalBundle["models"]; readonly persistence?: "restoring" | "saving" | "saved" | "restore-failed" | "save-failed" | null;
}
export interface ChildCanonicalResources {
  getSnapshot(): ChildCanonicalSnapshot; subscribe(listener: () => void): () => void; isCurrent(): boolean;
  select(owner: ChildEntityReference, sceneId: string): Promise<boolean>; restore?(): Promise<boolean>;
  attachRenderer?(tier: Common3dTierId, stage: (bundle: ChildCanonicalBundle) => Promise<ChildCanonicalRenderStage | null>): () => void;
  setTier?(tier: Common3dTierId): void;
  attachRecipient(recipient: ChildNativeSceneRecipient): () => void; clear(): void; join(): Promise<void>; dispose(): Promise<void>; activate(): () => void;
}
type Owned = { bundle: ChildCanonicalBundle; deadline: number; textures: Set<THREE.Texture>; bytes: Set<Uint8Array> };
/** Previous valid composition remains live until the actual original renderer
 * warms and commits a replacement. Native admission remains independent. */
export function createChildCanonicalResources(controller: ChildNativeAppController, contextToken: string, clock: () => number = () => performance.now()): ChildCanonicalResources {
  let state: ChildCanonicalSnapshot = Object.freeze({ phase: "empty", revision: 0, scene: null, textures: null });
  let epoch = 0, clearSequence = 0, active: Owned | null = null, disposed = false, broken = false, lastNow = -1;
  let tier: Common3dTierId = "balanced", renderer: ((bundle: ChildCanonicalBundle) => Promise<ChildCanonicalRenderStage | null>) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null, pendingAbort: AbortController | null = null, tail = Promise.resolve();
  let latestIntent: { kind: "select" | "restore"; entity?: ChildEntityReference; sceneId?: string } | null = null;
  const listeners = new Set<() => void>(), recipients = new Set<ChildNativeSceneRecipient>(), workers = new Set<Promise<unknown>>(), cancels = new Set<() => void>();
  const parent = controller.getSnapshot().context;
  function now() { const at = clock(); if (!Number.isFinite(at) || at < lastNow) { broken = true; throw new Error("Child monotonic clock unavailable"); } lastNow = at; return at; }
  function admitted() { const s = controller.getSnapshot(); return !broken && !disposed && s.phase === "ready" && s.status === "child" && s.context === parent && parent?.token === contextToken; }
  function valid(ticket?: number, deadline = Infinity) { try { return admitted() && (ticket === undefined || ticket === epoch) && now() < deadline; } catch { return false; } }
  function publish(phase: ChildCanonicalSnapshot["phase"], owned: Owned | null = null, persistence: ChildCanonicalSnapshot["persistence"] = null) {
    state = Object.freeze({ phase, revision: epoch, scene: owned?.bundle.scene ?? null, textures: owned?.bundle.textures ?? null, ...(owned ? { models: owned.bundle.models } : {}), persistence });
    for (const listener of [...listeners]) if (listeners.has(listener)) listener();
  }
  function retire(owned: Owned | null) { if (!owned) return; for (const m of owned.bundle.models.values()) m.dispose(); for (const t of owned.textures) { (t.image as HTMLImageElement | null)?.removeAttribute("src"); t.dispose(); t.image = null; } for (const b of owned.bytes) b.fill(0); owned.bytes.clear(); owned.textures.clear(); }
  function clear() { ++epoch; ++clearSequence; pendingAbort?.abort(); pendingAbort = null; for (const cancel of [...cancels]) cancel(); if (timer !== null) clearTimeout(timer); timer = null; for (const r of [...recipients]) try { r.clear(); } catch { broken = true; } retire(active); active = null; publish("empty"); }
  async function join() {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try { await Promise.race([Promise.all([...workers, ...[...recipients].map(r => r.join())]), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Child renderer cleanup did not join")), 5000); })]); if (broken) throw new Error("Child renderer cleanup failed"); }
    catch (error) { broken = true; throw error; } finally { if (timeout !== null) clearTimeout(timeout); }
  }
  function image(uri: string, skin: boolean, ticket: number, deadline: () => number, owned: Set<THREE.Texture>, model = false): Promise<THREE.Texture | null> {
    const image = new Image(); image.crossOrigin = "anonymous"; image.decoding = "async";
    let settle!: (value: THREE.Texture | null) => void, cancelled = false, finished = false, decoding = false;
    const done = new Promise<THREE.Texture | null>(resolve => { settle = resolve; });
    const cancel = () => { cancelled = true; image.onload = null; image.onerror = null; image.removeAttribute("src"); if (!decoding) finish(null); };
    function finish(value: THREE.Texture | null) { if (finished) { value?.dispose(); return; } finished = true; cancels.delete(cancel); image.onload = null; image.onerror = null; settle(value); }
    image.onload = () => { decoding = true; void Promise.resolve().then(() => image.decode()).then(() => {
      if (cancelled || !valid(ticket, deadline()) || image.naturalWidth < 1 || image.naturalHeight < 1 || image.naturalWidth > 4096 || image.naturalHeight > 4096 || image.naturalWidth * image.naturalHeight > 16_777_216 || skin && image.naturalWidth !== 2 * image.naturalHeight) { image.removeAttribute("src"); finish(null); return; }
      const texture = new THREE.Texture(image); texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = !model; texture.wrapS = skin ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.needsUpdate = true; owned.add(texture); finish(texture);
    }).catch(() => { image.removeAttribute("src"); finish(null); }); };
    image.onerror = () => { image.removeAttribute("src"); finish(null); }; cancels.add(cancel); workers.add(done); void done.then(() => workers.delete(done)); if (!valid(ticket, deadline())) cancel(); else image.src = uri; return done;
  }
  async function binary(scene: ChildNativeScene, output: ChildNativeModelWebResource, resource: Common3dResource, abort: AbortController, ticket: number, deadline: () => number, narrow: (at: number) => void): Promise<Uint8Array> {
    const result = new Uint8Array(resource.encodedBytes), read=controller.scenes?.readModelChunk;
    try {
      if (!read) throw new Error("Native typed resource reader unavailable");
      for(let offset=0;offset<result.length;) {
        if(!valid(ticket,deadline()) || abort.signal.aborted)throw new Error("Child model retired");
        const length=Math.min(65536,result.length-offset), dispatched=now(), chunk=await read(scene,output,resource,offset,length);
        if(!chunk || chunk.offset!==offset || chunk.totalBytes!==result.length || chunk.mime!==resource.mime || chunk.sceneToken!==scene.sceneToken || chunk.resourceToken!==output.resourceToken
          || !Number.isSafeInteger(chunk.remainingLifetimeMs) || chunk.remainingLifetimeMs<1 || chunk.remainingLifetimeMs>60000 || chunk.encodedBase64.length!==Math.ceil(length/3)*4)throw new Error("Exact native model chunk required");
        narrow(dispatched+chunk.remainingLifetimeMs);
        if(!valid(ticket,deadline()) || abort.signal.aborted)throw new Error("Child model retired");
        const decoded=atob(chunk.encodedBase64);if(decoded.length!==length || btoa(decoded)!==chunk.encodedBase64)throw new Error("Exact native chunk framing");
        for(let i=0;i<length;i++)result[offset+i]=decoded.charCodeAt(i);offset+=length;
      }
      const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",result))].map(b=>b.toString(16).padStart(2,"0")).join("");
      if(hash!==resource.checksum || !valid(ticket,deadline()) || abort.signal.aborted)throw new Error("Native model checksum mismatch");return result;
    } catch(error) { result.fill(0);throw error; }
  }
  async function choose(kind: "select" | "restore", entity?: ChildEntityReference, sceneId?: string): Promise<boolean> {
    const scenes = controller.scenes; if (!scenes || !valid()) return false;
    latestIntent = { kind, entity, sceneId };
    const ticket = ++epoch, requestedTier = tier, originalClear = clearSequence; pendingAbort?.abort(); for (const cancel of [...cancels]) cancel(); const abort = new AbortController(); pendingAbort = abort;
    const previousWork = tail; let releaseTail!: () => void; tail = new Promise(resolve => { releaseTail = resolve; });
    const work = (async () => {
      await previousWork; if (!valid(ticket)) return false;
      let scene: ChildNativeScene | null = null, deadline = Infinity, candidate: Owned | null = null, stage: ChildCanonicalRenderStage | null = null, committed = false;
      const textures = new Set<THREE.Texture>(), bytes = new Set<Uint8Array>(), models = new Map<"stand" | "background", Common3dImported>();
      const current = () => valid(ticket, deadline) && !abort.signal.aborted;
      if (!active) publish("preparing", null, kind === "restore" ? "restoring" : "saving");
      try {
        const saved = await scenes.readSelection(); if (!saved || saved.profileId !== parent?.profileId || !current()) return false;
        const start = now();
        if (kind === "restore") { const restored = await scenes.restore(saved); if (!restored || !current()) return false; if (restored.status === "absent") { if (!active) publish("empty"); committed = true; return true; } if (restored.status !== "restored") return false; scene = restored.scene; }
        else scene = entity && sceneId ? await scenes.open(entity, sceneId) : null;
        if (!scene || !current()) return false; deadline = start + scene.remainingLifetimeMs;
        const maps: Partial<ChildCanonicalTextures> = {};
        for (const slot of [scene.skin, scene.stand.asset, scene.background.asset]) { const dispatched = now(), output = await scenes.acquire(scene, slot); if (!output || !current()) return false; deadline = Math.min(deadline, dispatched + output.remainingLifetimeMs); const decoded = await image(output.uri, slot.slotId === "skin", ticket, () => deadline, textures); if (!decoded || !current()) return false; maps[slot.slotId] = decoded; }
        if (!maps.skin || !maps.stand || !maps.background) return false;
        if (scene.modelPackage) {
          if (!scenes.acquireModel || !scenes.readModelChunk || !renderer) return false; const selected = scene.modelPackage.tiers.find(t => t.tier === requestedTier); if (!selected) return false;
          let decodedBytes = 0, triangles = 0;
          for (const descriptor of selected.models) {
            const buffers = new Map<string, Uint8Array>(), modelTextures = new Map<string, THREE.Texture>(); let modelBytes: Uint8Array | null = null;
            for (const resource of [descriptor.model, ...descriptor.dependencies]) { const dispatched = now(), output = await scenes.acquireModel(scene, resource, selected.tier); if (!output || !current()) return false; deadline = Math.min(deadline, dispatched + output.remainingLifetimeMs);
              if (resource.kind === "texture") { const t = await image(output.uri, false, ticket, () => deadline, textures, true); if (!t || !current()) return false; modelTextures.set(resource.alias, t); decodedBytes += Math.ceil(t.image.naturalWidth * t.image.naturalHeight * 16 / 3); if (decodedBytes > selected.maxDecodedBytes) return false; }
              else { const b = await binary(scene, output, resource, abort, ticket, () => deadline,at=>{deadline=Math.min(deadline,at);}); bytes.add(b); if (resource.kind === "model") modelBytes = b; else buffers.set(resource.alias, b); }
            }
            if (!modelBytes || !current()) return false; const imported = importCommon3dModel(modelBytes, descriptor, buffers, modelTextures, selected); models.set(descriptor.slotId, imported);
            // Three geometry owns independent decoded arrays. No raw model or
            // buffer copy is needed after import; retire it before GPU warm.
            for (const encoded of [modelBytes, ...buffers.values()]) { encoded.fill(0); bytes.delete(encoded); } buffers.clear(); modelBytes = null;
            decodedBytes += imported.decodedBytes; triangles += imported.triangles; if (decodedBytes > selected.maxDecodedBytes || triangles > selected.maxTriangles) return false;
          }
        }
        candidate = { bundle: Object.freeze({ scene, textures: Object.freeze(maps as ChildCanonicalTextures), models, tier: requestedTier }), deadline, textures, bytes };
        if (renderer) { stage = await renderer(candidate.bundle); if (!stage || !current()) return false; }
        const projected = childNativeAppearanceFromScene(scene); if (!projected || !current()) return false;
        if (kind === "restore" && (!saved.selection || !sameChildNativeAppearance(saved.selection, projected))) return false;
        // Restore is also a staged native lease. Promote it through the same
        // current-authority CAS only after the original renderer has warmed.
        const remembered = await scenes.remember(scene, saved.revision); if (!remembered || remembered.profileId !== parent?.profileId || remembered.revision !== saved.revision + 1 || !remembered.selection || !sameChildNativeAppearance(remembered.selection, projected)) return false;
        const rollback = async () => {
          // The native owner captured the exact previous protected choice
          // under its CAS lock. JavaScript cannot supply or authorize a choice.
          const reverted = await Promise.resolve().then(() => scenes.rollback?.(scene!, remembered.revision)).catch(() => null);
          const same = reverted && (saved.selection === null ? reverted.selection === null
            : reverted.selection !== null && sameChildNativeAppearance(saved.selection, reverted.selection));
          if (!reverted || !same || reverted.revision !== remembered.revision + 1
            || originalClear !== clearSequence || !valid(undefined, deadline)) {
            // Do not acknowledge an unknown durable rollback. Clearing is
            // synchronous; suspend joins this worker after its final return.
            broken = true; clear(); void controller.suspend().catch(() => undefined);
          }
          return false;
        };
        // A later A->B->C intent can arrive while native CAS is returning.
        // Revert that acknowledged native-only write before the queued intent
        // starts; never install its obsolete group or retire the live snapshot.
        if (!current()) return await rollback();
        try { stage?.commit(); } catch { return await rollback(); }
        const prior = active; active = candidate; candidate = null; committed = true; publish("ready", active, "saved");
        if (timer !== null) clearTimeout(timer); timer = setTimeout(() => { clear(); void join().then(() => scenes.releaseAll()).catch(() => controller.suspend()); }, Math.max(1, deadline - now()));
        retire(prior); if (prior && prior.bundle.scene.sceneToken !== scene.sceneToken && !await scenes.release(prior.bundle.scene.sceneToken)) { void controller.suspend(); return false; } return ticket === epoch;
      } catch { return false; }
      finally {
        if (!committed) { try { stage?.rollback(); } catch { broken = true; clear(); void controller.suspend().catch(() => undefined); } if (candidate) retire(candidate); else { for (const m of models.values()) m.dispose(); for (const t of textures) { (t.image as HTMLImageElement | null)?.removeAttribute("src"); t.dispose(); t.image = null; } for (const b of bytes) b.fill(0); }
          if (scene && scene.sceneToken !== active?.bundle.scene.sceneToken) try { if (!await scenes.release(scene.sceneToken)) void controller.suspend(); } catch { void controller.suspend(); }
          if (ticket === epoch && valid()) { if (active && valid(undefined, active.deadline)) publish("ready", active, kind === "restore" ? "restore-failed" : "save-failed"); else { retire(active); active = null; publish("unavailable", null, kind === "restore" ? "restore-failed" : "save-failed"); } }
        }
        if (pendingAbort === abort) pendingAbort = null;
      }
    })(); workers.add(work); try { return await work; } finally { workers.delete(work); releaseTail(); }
  }
  const owner: ChildNativeSceneRecipient = { clear, join }; let detachOwner: (() => void) | undefined;
  return Object.freeze({ getSnapshot: () => state, subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, isCurrent: () => !!active && state.phase === "ready" && valid(undefined, active.deadline),
    activate() { if (disposed) throw new Error("Child resources disposed"); if (!detachOwner) detachOwner = controller.scenes?.attachRecipient(owner); return () => { clear(); detachOwner?.(); detachOwner = undefined; }; },
    select: (entity: ChildEntityReference, id: string) => choose("select", entity, id), restore: () => choose("restore"), clear, join,
    attachRenderer(nextTier: Common3dTierId, next: (bundle: ChildCanonicalBundle) => Promise<ChildCanonicalRenderStage | null>) { if (renderer) throw new Error("One original composition renderer required"); tier = nextTier; renderer = next; return () => { if (renderer === next) { clear(); renderer = null; } }; },
    setTier(nextTier: Common3dTierId) { if (nextTier === tier || disposed) return; tier = nextTier; if (pendingAbort && latestIntent) void choose(latestIntent.kind, latestIntent.entity, latestIntent.sceneId); else if (active) void choose("restore"); },
    attachRecipient(recipient: ChildNativeSceneRecipient) { if (disposed) throw new Error("Child resource recipient retired"); recipients.add(recipient); return () => { recipient.clear(); recipients.delete(recipient); const drain = Promise.resolve().then(() => recipient.join()); workers.add(drain); void drain.then(() => workers.delete(drain), () => { broken = true; }); }; },
    async dispose() { if (disposed) return; clear(); disposed = true; detachOwner?.(); await join(); listeners.clear(); recipients.clear(); },
  });
}
