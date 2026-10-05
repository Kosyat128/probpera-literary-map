import * as THREE from "three";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";
import type { ChildNativeScene, ChildNativeSceneSlot, ChildNativeSceneRecipient } from "./childNativeScene";
import { childNativeAppearanceFromScene, sameChildNativeAppearance } from "./childNativeAppearance";

export interface ChildCanonicalTextures { readonly skin: THREE.Texture; readonly stand: THREE.Texture; readonly background: THREE.Texture }
export interface ChildCanonicalSnapshot {
  readonly phase: "empty" | "preparing" | "ready" | "unavailable";
  readonly revision: number; readonly scene: ChildNativeScene | null; readonly textures: ChildCanonicalTextures | null;
  readonly persistence?: "restoring" | "saving" | "saved" | "restore-failed" | "save-failed" | null;
}
export interface ChildCanonicalResources {
  getSnapshot(): ChildCanonicalSnapshot;
  subscribe(listener: () => void): () => void;
  isCurrent(): boolean;
  select(owner: ChildEntityReference, sceneId: string): Promise<boolean>;
  restore?(): Promise<boolean>;
  /** Renderer attaches its ACTUAL material/group cleanup, never a recipient ID. */
  attachRecipient(recipient: ChildNativeSceneRecipient): () => void;
  clear(): void;
  join(): Promise<void>;
  dispose(): Promise<void>;
  activate(): () => void;
}
type Decoder = { image: HTMLImageElement; cancel(): void; done: Promise<THREE.Texture | null> };
/** Original WebView decoder -> owned texture resources. This factory cannot
 * admit content: every acquisition must independently pass the native scene
 * lease, original package/asset/slot and original absolute native deadline. */
export function createChildCanonicalResources(controller: ChildNativeAppController, contextToken: string,
  clock: () => number = () => performance.now()): ChildCanonicalResources {
  let state: ChildCanonicalSnapshot = Object.freeze({phase:"empty",revision:0,scene:null,textures:null});
  let epoch = 0, limit = 0, disposed = false, broken=false,lastNow=-1,timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>(), recipients = new Set<ChildNativeSceneRecipient>();
  const decoders = new Set<Decoder>(), workers = new Set<Promise<unknown>>(), textures = new Set<THREE.Texture>();
  const parent = controller.getSnapshot().context;
  function current(ticket = epoch): boolean {
    const snap = controller.getSnapshot();
    let at:number;try{at=clock();if(!Number.isFinite(at)||at<lastNow){broken=true;return false;}lastNow=at;}catch{broken=true;return false;}
    return !broken && !disposed && ticket===epoch && snap.phase==="ready" && snap.status==="child" && snap.context===parent
      && parent?.token===contextToken && Number.isFinite(at) && (limit===0 || at<limit);
  }
  function publish(phase: ChildCanonicalSnapshot["phase"], scene: ChildNativeScene | null = null, maps: ChildCanonicalTextures | null = null,
    persistence: ChildCanonicalSnapshot["persistence"] = null) {
    state=Object.freeze({phase,revision:epoch,scene,textures:maps,persistence});
    for(const listener of [...listeners]) if(listeners.has(listener)) listener();
  }
  function clear() {
    ++epoch; limit=0; if(timer!==null) clearTimeout(timer); timer=null;
    // Imperative detach runs before any observer can schedule the next frame.
    let failed=false;
    for(const recipient of [...recipients]) { try { recipient.clear(); } catch { failed=true; } }
    for(const decoder of [...decoders]) decoder.cancel();
    for(const texture of textures) {try{const image=texture.image as HTMLImageElement|null;image?.removeAttribute("src");texture.dispose();texture.image=null;}catch{failed=true;}}
    if(failed)broken=true;textures.clear(); publish(failed?"unavailable":"empty");
  }
  async function join() {
    const cleanup = Promise.all([...workers, ...[...recipients].map(recipient=>Promise.resolve().then(()=>recipient.join()))]);
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([cleanup, new Promise<never>((_resolve,reject)=>{
        timeout=setTimeout(()=>reject(new Error("Child renderer cleanup did not join")),5000);
      })]);
      if(broken)throw new Error("Child renderer cleanup failed");
    } catch(error) { broken=true;throw error; } finally { if(timeout!==null) clearTimeout(timeout); }
  }
  function decode(uri: string, slot: ChildNativeSceneSlot, ticket: number): Promise<THREE.Texture | null> {
    const image = new Image(); image.crossOrigin="anonymous"; image.decoding="async";
    let finish!: (texture: THREE.Texture | null) => void, cancelled=false, settled=false;
    const done = new Promise<THREE.Texture | null>(resolve=>{ finish=resolve; });
    const decoder: Decoder={image,done,cancel() {
      cancelled=true; image.onload=null; image.onerror=null; image.removeAttribute("src");
      // decode() completion remains tracked below; cancelling an Image before
      // onload has started performs no asynchronous decode worker.
      if(!decoding) complete(null);
    }};
    let decoding=false;
    function complete(texture: THREE.Texture | null) {
      if(settled) { texture?.dispose(); return; } settled=true;
      decoders.delete(decoder); image.onload=null; image.onerror=null; finish(texture);
    }
    image.onload=()=>{
      decoding=true;
      void Promise.resolve().then(()=>image.decode()).then(()=>{
        if(cancelled || !current(ticket) || image.naturalWidth<1 || image.naturalHeight<1
          || image.naturalWidth>4096 || image.naturalHeight>4096 || image.naturalWidth*image.naturalHeight>16_777_216
          || slot.slotId==="skin" && image.naturalWidth!==2*image.naturalHeight) { image.removeAttribute("src"); complete(null); return; }
        const texture=new THREE.Texture(image); texture.name="child-native:"+slot.slotId;
        texture.colorSpace=THREE.SRGBColorSpace; texture.flipY=true;
        texture.wrapS=slot.slotId==="skin"?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping;
        texture.wrapT=THREE.ClampToEdgeWrapping; texture.generateMipmaps=true; texture.needsUpdate=true;
        if(!current(ticket)) { texture.dispose(); texture.image=null; complete(null); return; }
        textures.add(texture); complete(texture);
      }).catch(()=>{ image.removeAttribute("src"); complete(null); });
    };
    image.onerror=()=>{ image.removeAttribute("src"); complete(null); };
    decoders.add(decoder); workers.add(done); void done.finally(()=>workers.delete(done));
    if(!current(ticket)) decoder.cancel(); else image.src=uri;
    return done;
  }
  async function prepare(scene: ChildNativeScene, ticket: number): Promise<ChildCanonicalTextures | null> {
    const maps: { -readonly [K in keyof ChildCanonicalTextures]?: ChildCanonicalTextures[K] }={};
    for(const slot of [scene.skin,scene.stand.asset,scene.background.asset]) {
      const start=clock(),output=await controller.scenes!.acquire(scene,slot);
      if(!output || !current(ticket))return null;
      limit=Math.min(limit,start+output.remainingLifetimeMs);
      const texture=await decode(output.uri,slot,ticket);
      if(!texture || !current(ticket))return null;
      maps[slot.slotId]=texture;
    }
    return maps.skin&&maps.stand&&maps.background&&current(ticket)?Object.freeze(maps as ChildCanonicalTextures):null;
  }
  async function choose(kind: "select" | "restore", entity?: ChildEntityReference, sceneId?: string): Promise<boolean> {
    const scenes=controller.scenes;
    if(!scenes || !current())return false;
    clear();const ticket=epoch;let completed=false;
    publish("preparing",null,null,kind==="restore"?"restoring":"saving");
    try {
      await join();
      if(!current(ticket)||!await scenes.releaseAll()||!current(ticket))return false;
      const saved=await scenes.readSelection();
      if(!saved||saved.profileId!==parent?.profileId||!current(ticket))return false;
      const dispatched=clock();
      let scene:ChildNativeScene|null;
      if(kind==="restore") {
        const restored=await scenes.restore(saved);
        if(!restored||!current(ticket))return false;
        if(restored.status==="absent") {completed=true;publish("empty");return true;}
        if(restored.status!=="restored"||!restored.scene)return false;
        scene=restored.scene;
      } else scene=entity&&sceneId?await scenes.open(entity,sceneId):null;
      if(!scene||!current(ticket))return false;
      limit=dispatched+scene.remainingLifetimeMs;
      if(!current(ticket))return false;
      const maps=await prepare(scene,ticket);
      if(!maps||!current(ticket))return false;
      const projected=childNativeAppearanceFromScene(scene);
      if(!projected)return false;
      if(kind==="select") {
        const remembered=await scenes.remember(scene,saved.revision);
        if(!remembered||remembered.profileId!==saved.profileId||remembered.revision!==saved.revision+1
          ||!remembered.selection||!sameChildNativeAppearance(remembered.selection,projected)||!current(ticket))return false;
      } else if(!saved.selection||!sameChildNativeAppearance(saved.selection,projected))return false;
      publish("ready",scene,maps,"saved");completed=true;
      timer=setTimeout(()=>{
        clear();void join().then(()=>scenes.releaseAll()).catch(()=>controller.suspend());
      },Math.max(1,limit-clock()));
      return true;
    } catch {return false;}
    finally {
      if(ticket===epoch&&(!completed||!current(ticket))) {
        clear();const cleanupTicket=epoch;
        try {
          await join();
          // A later explicit choice owns cleanup from this point onward.
          // The retiring attempt must neither revoke its native leases nor
          // overwrite its preparing/ready publication after a delayed join.
          if(cleanupTicket===epoch)await scenes.releaseAll();
        } catch {await controller.suspend();}
        if(cleanupTicket===epoch&&!disposed&&controller.getSnapshot().context===parent)
          publish("unavailable",null,null,kind==="restore"?"restore-failed":"save-failed");
      }
    }
  }
  const select=(entity:ChildEntityReference,sceneId:string)=>choose("select",entity,sceneId);
  const restore=()=>choose("restore");
  const owner: ChildNativeSceneRecipient={clear,join};
  let detachOwner:(()=>void)|undefined;
  return Object.freeze({getSnapshot:()=>state,subscribe(listener:()=>void) {listeners.add(listener);return()=>{listeners.delete(listener);};},
    isCurrent:()=>current() && state.phase==="ready",
    activate() {if(disposed)throw new Error("Child resources disposed");if(!detachOwner)detachOwner=controller.scenes?.attachRecipient(owner);return()=>{clear();detachOwner?.();detachOwner=undefined;};},
    select, restore, clear, join,
    attachRecipient(recipient:ChildNativeSceneRecipient) {
      if(disposed) throw new Error("Child resource recipient retired"); recipients.add(recipient);
      return()=>{try{recipient.clear();}catch{broken=true;}recipients.delete(recipient);const work=Promise.resolve().then(()=>recipient.join());workers.add(work);void work.then(()=>workers.delete(work),()=>{broken=true;});};
    },
    async dispose() { if(disposed)return;clear();disposed=true;detachOwner?.();await join();listeners.clear();recipients.clear(); },
  });
}
