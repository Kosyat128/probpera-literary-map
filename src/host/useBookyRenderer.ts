import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { WebGLRenderer, WebGLRenderTarget } from "three";
import { BOOKY_LOOK_MS, bookyReactionDuration, boundedBookyLook, createBookyPose, hasBookyReactionChanged,
  type BookyInput } from "./bookyAnimation";

import { createBookyAttention, type BookyAttentionKind } from "./bookyAttention";

export type BookyRendererState = "loading" | "live3d" | "fallback";
type RendererSnapshot = Readonly<{ state: BookyRendererState; active: boolean }>;
// recoveryAttempt is fixed for this canvas lifetime. Only explicit recovery uses it.
type RendererInput = BookyInput & Readonly<{ calmMotion?: boolean; recoveryAttempt?: boolean }>;
type Runtime = { update(input: RendererInput): void };
type OwnedModel = ReturnType<typeof import("./bookyModel")["createBookyModel"]>;
const RECOVERY_TIMEOUT_MS = 1800;
const RETRY_FIRST_FRAME_TIMEOUT_MS = 4000;

/** Independent decorative viewport. It never borrows the literary globe's
 * camera, textures or controls, and has no resting animation loop. */
export function useBookyRenderer(canvasRef: RefObject<HTMLCanvasElement | null>, input: RendererInput) {
  const committed = useRef(input), runtime = useRef<Runtime | null>(null);
  const [snapshot, setSnapshot] = useState<RendererSnapshot>({ state: "loading", active: false });
  useLayoutEffect(() => {
    committed.current = input;
    runtime.current?.update(input);
  }, [input.mood, input.interaction, input.lookAt.x, input.lookAt.y, input.reactionKey, input.active, input.calmMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let alive = true, failed = false, contextLost = false, restorationAttempted = false, hasRendered = false;
    let environmentDirty = true;
    const attention = createBookyAttention();
    let attentionTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshAttention: (() => void) | null = null;
    let manualAttentionOwner = () => true;
    const clearAttention = () => {
      attention.clear();
      if (attentionTimer !== null) clearTimeout(attentionTimer);
      attentionTimer = null;
    };
    let intersecting = typeof IntersectionObserver === "undefined", pageVisible = document.visibilityState !== "hidden";
    let renderer: WebGLRenderer | null = null, model: OwnedModel | null = null;
    let environment: WebGLRenderTarget | null = null;
    let disposeShadow: (() => void) | null = null;
    let animationFrame = 0, restoreTimer: ReturnType<typeof setTimeout> | null = null;
    let recoveryDeadline: ReturnType<typeof setTimeout> | null = null;
    let firstFrameDeadline: ReturnType<typeof setTimeout> | null = null;
    let draw: ((time: number) => void) | null = null, refreshSize: (() => void) | null = null;
    let updatePose: ((value: BookyInput) => void) | null = null, settlePose: (() => void) | null = null;
    let lossExtension: WEBGL_lose_context | null = null;
    let observer: ResizeObserver | null = null, intersection: IntersectionObserver | null = null;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motion.matches || committed.current.calmMotion === true;
    const isActive = () => alive && !failed && !contextLost && pageVisible && intersecting && committed.current.active;
    const publish = () => {
      if (!alive) return;
      const state: BookyRendererState = failed ? "fallback" : hasRendered && !contextLost ? "live3d" : "loading";
      const active = state === "live3d" && isActive();
      setSnapshot(previous => previous.state === state && previous.active === active ? previous : { state, active });
    };
    const stopFrame = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      canvas.dataset.bookyAnimating = "false";
    };
    const clearRecovery = () => {
      if (restoreTimer !== null) clearTimeout(restoreTimer);
      if (recoveryDeadline !== null) clearTimeout(recoveryDeadline);
      restoreTimer = recoveryDeadline = null;
    };
    const clearFirstFrameDeadline = () => {
      if (firstFrameDeadline !== null) clearTimeout(firstFrameDeadline);
      firstFrameDeadline = null;
    };
    const disposeGraphics = () => {
      const oldModel = model, oldRenderer = renderer, oldEnvironment = environment;
      model = null; renderer = null; environment = null;
      draw = null; refreshSize = null; updatePose = null; settlePose = null;
      oldModel?.dispose(); oldEnvironment?.dispose();
      disposeShadow?.(); disposeShadow = null;
      if (oldRenderer) {
        oldRenderer.renderLists.dispose(); oldRenderer.dispose();
        if (!oldRenderer.getContext().isContextLost()) oldRenderer.forceContextLoss();
      }
    };
    const fallback = () => {
      if (!alive || failed) return;
      failed = true; clearAttention(); stopFrame(); clearRecovery(); clearFirstFrameDeadline(); disposeGraphics();
      canvas.dataset.bookyContext = "unavailable"; publish();
    };
    const refreshInitialDeadline = () => {
      // Initial loading must also reach a recoverable portrait. An inactive
      // initial viewport is paused; an explicit retry keeps its original deadline.
      if (committed.current.recoveryAttempt) return;
      if (!isActive() || hasRendered) { clearFirstFrameDeadline(); return; }
      if (firstFrameDeadline === null) firstFrameDeadline = setTimeout(fallback, RETRY_FIRST_FRAME_TIMEOUT_MS);
    };
    const requestFrame = () => {
      refreshInitialDeadline();
      if (!isActive() || !draw || animationFrame) return;
      animationFrame = requestAnimationFrame(time => {
        animationFrame = 0;
        if (!isActive()) return;
        try { draw?.(time); } catch { fallback(); }
      });
    };
    const observeAttention = (kind: BookyAttentionKind, x: number, y: number) => {
      if (!isActive() || manualAttentionOwner()) return;
      const deadline = attention.offer(kind, { x, y }, canvas.getBoundingClientRect(),
        { width: window.innerWidth, height: window.innerHeight }, performance.now(), reducedMotion);
      if (deadline === null) return;
      if (attentionTimer !== null) clearTimeout(attentionTimer);
      refreshAttention?.();
      attentionTimer = setTimeout(() => { attentionTimer = null; attention.clear(); refreshAttention?.(); },
        Math.max(0, deadline - performance.now()));
    };
    const targetPoint = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !target.isConnected || target.closest('[hidden], [inert], [aria-hidden="true"]')) return null;
      const bounds = target.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 } : null;
    };
    const onAttentionPointer = (event: PointerEvent) => {
      if (event.isPrimary && (event.pointerType === "mouse" || event.pointerType === "pen") && event.buttons === 0)
        observeAttention("pointer", event.clientX, event.clientY);
    };
    const onAttentionPress = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      const control = event.target instanceof Element ? event.target.closest('button, a, input, select, textarea, [role="button"], [role="tab"]') : null;
      const point = targetPoint(control);
      observeAttention("press", point?.x ?? event.clientX, point?.y ?? event.clientY);
    };
    const onAttentionFocus = (event: FocusEvent) => {
      const point = targetPoint(event.target); if (point) observeAttention("focus", point.x, point.y);
    };
    const onAttentionKeyboardClick = (event: MouseEvent) => {
      if (event.detail !== 0) return;
      const point = targetPoint(event.target); if (point) observeAttention("press", point.x, point.y);
    };
    const leaveAttention = () => { clearAttention(); refreshAttention?.(); };
    const onAttentionLeave = (event: PointerEvent) => {
      if (event.relatedTarget === null && event.pointerType !== "touch") leaveAttention();
    };
    const observeOptions = { capture: true, passive: true } as const;
    document.addEventListener("pointermove", onAttentionPointer, observeOptions);
    document.addEventListener("pointerout", onAttentionLeave, observeOptions);
    window.addEventListener("blur", leaveAttention);
    document.addEventListener("pointerdown", onAttentionPress, observeOptions);
    document.addEventListener("focusin", onAttentionFocus, observeOptions);
    document.addEventListener("click", onAttentionKeyboardClick, observeOptions);
    const visibility = () => {
      pageVisible = document.visibilityState !== "hidden";
      if (!isActive()) { stopFrame(); settlePose?.(); refreshInitialDeadline(); }
      else { refreshSize?.(); requestFrame(); }
      publish();
    };
    const onReducedMotion = () => {
      const next = motion.matches || committed.current.calmMotion === true;
      if (next === reducedMotion) return;
      reducedMotion = next; stopFrame(); settlePose?.(); requestFrame();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      if (!alive || failed) return;
      contextLost = true; canvas.dataset.bookyContext = "lost";
      stopFrame(); settlePose?.(); refreshInitialDeadline(); publish();
      if (restorationAttempted || !lossExtension) { fallback(); return; }
      restorationAttempted = true;
      // One extension request after this event, plus one bounded deadline.
      recoveryDeadline = setTimeout(fallback, RECOVERY_TIMEOUT_MS);
      restoreTimer = setTimeout(() => {
        restoreTimer = null;
        if (!alive || failed || !contextLost) return;
        try { lossExtension?.restoreContext(); } catch { fallback(); }
      }, 0);
    };
    const onContextRestored = () => {
      if (!alive || failed || !contextLost) return;
      clearRecovery(); contextLost = false; hasRendered = false; environmentDirty = true;
      canvas.dataset.bookyContext = "ready";
      refreshSize?.(); requestFrame();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", onReducedMotion);
    runtime.current = { update(value) {
      const nextReduced = motion.matches || value.calmMotion === true;
      const policyChanged = nextReduced !== reducedMotion;
      reducedMotion = nextReduced;
      updatePose?.(value);
      // Both enabling and disabling calm movement retire the old reaction.
      // Only another explicit gesture may start a fresh animation afterward.
      if (policyChanged) { stopFrame(); settlePose?.(); }
      if (!isActive()) { stopFrame(); settlePose?.(); refreshInitialDeadline(); } else requestFrame();
      publish();
    } };
    const ownedRuntime = runtime.current;
    // Observe before imports/initial deadline: an offscreen initial avatar
    // cannot spend its visible-first-frame budget while code is loading.
    if (typeof IntersectionObserver !== "undefined") {
      intersection = new IntersectionObserver(entries => {
        const entry = entries[entries.length - 1];
        if (!entry || !alive) return;
        intersecting = entry.isIntersecting && entry.intersectionRatio > 0; visibility();
      }); intersection.observe(canvas);
    }
    publish();

    // An explicit retry must finish even if imports or the first frame never arrive.
    // A timed-out lifetime cannot later allocate resources or replace the fallback.
    if (committed.current.recoveryAttempt) firstFrameDeadline = setTimeout(fallback, RETRY_FIRST_FRAME_TIMEOUT_MS);
    else refreshInitialDeadline();

    // A discarded StrictMode activation cannot allocate a model or context.
    void Promise.all([import("three"), import("./bookyModel"),
      import("three/addons/environments/RoomEnvironment.js")]).then(([THREE, factory, rooms]) => {
      if (!alive || failed) return;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true,
          powerPreference: "low-power", premultipliedAlpha: true, preserveDrawingBuffer: false });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = .94;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        lossExtension = renderer.getContext().getExtension("WEBGL_lose_context");
        const scene = new THREE.Scene();
        model = factory.createBookyModel(); scene.add(model.group);
        model.group.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          const solid = materials.every(material => !material.transparent);
          object.castShadow = solid; object.receiveShadow = solid;
        });
        // Generate only before a visible frame. GPU render targets lose their
        // pixels on context loss, so this owned environment is rebuilt once
        // after restoration instead of silently using an empty reflection.
        const prepareEnvironment = () => {
          if (!renderer || !environmentDirty) return;
          const room = new rooms.RoomEnvironment();
          let pmrem: InstanceType<typeof THREE.PMREMGenerator> | null = null;
          try {
            pmrem = new THREE.PMREMGenerator(renderer);
            const next = pmrem.fromScene(room, .04, .1, 100, { size: 64 });
            const previous = environment;
            environment = next; scene.environment = next.texture;
            environmentDirty = false; previous?.dispose();
          } finally { pmrem?.dispose(); room.dispose(); }
        };
        scene.environmentIntensity = .28;
        scene.add(new THREE.HemisphereLight(0xfff3dd, 0x465950, .32));
        const key = new THREE.DirectionalLight(0xfff4e4, 3.9);
        key.position.set(-3, 4, 5); key.castShadow = true;
        key.shadow.mapSize.set(512, 512);
        Object.assign(key.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: .1, far: 15 });
        key.shadow.camera.updateProjectionMatrix();
        key.shadow.bias = -.0003; key.shadow.normalBias = .003;
        disposeShadow = () => key.shadow.dispose();
        scene.add(key);
        const fill = new THREE.DirectionalLight(0xe2ecff, .28);
        fill.position.set(3, 1.5, 3); scene.add(fill);
        model.group.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model.group);
        const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        if (bounds.isEmpty() || ![...center.toArray(), ...size.toArray()].every(Number.isFinite)) {
          throw new Error("Booky has no finite visible bounds");
        }
        const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 20);
        camera.position.copy(center).add(new THREE.Vector3(-1.85, 1.8, 6)); camera.lookAt(center);
        const pose = createBookyPose(model.rig);
        let current = committed.current;
        let look = boundedBookyLook(current.lookAt), startLook = look, goalLook = look;
        let lookStarted = 0, reactionStarted: number | null = null;
        let renderCount = 0, lastWidth = 0, lastHeight = 0;
        refreshSize = () => {
          if (!renderer || failed) return;
          const rect = canvas.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return;
          // A tiny character needs clean eyes and curved edges even on a 1x
          // display. Supersample within the same bounded 256px drawing buffer.
          const ratio = Math.min(2, 256 / Math.max(rect.width, rect.height));
          const width = Math.max(1, Math.floor(rect.width * ratio)), height = Math.max(1, Math.floor(rect.height * ratio));
          if (width === lastWidth && height === lastHeight) return;
          lastWidth = width; lastHeight = height;
          renderer.setPixelRatio(1); renderer.setSize(width, height, false);
          const aspect = rect.width / rect.height, halfHeight = Math.max(size.y * .59, size.x * .59 / aspect);
          camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
          camera.top = halfHeight; camera.bottom = -halfHeight; camera.updateProjectionMatrix();
        };
        settlePose = () => {
          clearAttention();
          reactionStarted = null; lookStarted = 0;
          look = goalLook = startLook = boundedBookyLook(committed.current.lookAt);
        };
        const ownedMotion = (value: RendererInput) => value.interaction === "dragging"
          || value.interaction === "walking" || value.interaction === "pointing";
        manualAttentionOwner = () => ownedMotion(current);
        refreshAttention = () => {
          if (!isActive() || reactionStarted !== null || manualAttentionOwner()) return;
          const next = boundedBookyLook(attention.read(performance.now()) ?? current.lookAt);
          if (next.x === goalLook.x && next.y === goalLook.y) return;
          startLook = look; goalLook = next; lookStarted = reducedMotion ? 0 : performance.now();
          if (reducedMotion) look = next;
          requestFrame();
        };
        updatePose = value => {
          if (hasBookyReactionChanged(current, value) || ownedMotion(value) || !value.active) clearAttention();
          const nextLook = boundedBookyLook(reactionStarted !== null || ownedMotion(value)
            ? value.lookAt : attention.read(performance.now()) ?? value.lookAt);
          if (nextLook.x !== goalLook.x || nextLook.y !== goalLook.y) {
            startLook = look; goalLook = nextLook; lookStarted = performance.now();
          }
          if (hasBookyReactionChanged(current, value)) {
            reactionStarted = !reducedMotion && isActive() ? performance.now() : null;
          } else if (value.interaction !== current.interaction) {
            // A new ordinary action replaces the prior gesture immediately.
            reactionStarted = null;
          }
          current = value;
        };
        draw = time => {
          if (!renderer || !model || renderer.getContext().isContextLost()) return;
          prepareEnvironment();
          const blend = reducedMotion || !lookStarted ? 1 : Math.min(1, Math.max(0, (time - lookStarted) / BOOKY_LOOK_MS));
          const eased = blend * blend * (3 - 2 * blend);
          look = { x: startLook.x + (goalLook.x - startLook.x) * eased, y: startLook.y + (goalLook.y - startLook.y) * eased };
          const progress = reactionStarted === null || reducedMotion ? null : (time - reactionStarted) / bookyReactionDuration(current);
          const reactionFinished = progress !== null && progress >= 1;
          if (reactionFinished) reactionStarted = null;
          pose(current, look, reactionStarted === null ? null : progress, reducedMotion);
          renderer.render(scene, camera);
          renderCount += 1; hasRendered = true; clearFirstFrameDeadline();
          canvas.dataset.bookyRenderCount = String(renderCount);
          canvas.dataset.bookyAnimating = String(blend < 1 || reactionStarted !== null);
          canvas.dataset.bookyReducedMotion = String(reducedMotion);
          canvas.dataset.bookyInteraction = current.interaction;
          canvas.dataset.bookyLookX = look.x.toFixed(4); canvas.dataset.bookyLookY = look.y.toFixed(4);
          publish();
          // A recent input may wait behind a finite gesture, but never interrupts it.
          if (reactionFinished) refreshAttention?.();
          if (blend < 1 || reactionStarted !== null) requestFrame();
        };
        canvas.dataset.bookyContext = "ready"; canvas.dataset.bookyRenderCount = "0";
        if (typeof ResizeObserver !== "undefined") {
          observer = new ResizeObserver(() => { refreshSize?.(); requestFrame(); }); observer.observe(canvas);
        }
        window.addEventListener("resize", visibility);
        refreshSize();
        // Recovery restores a still character. Only a fresh action may animate it.
        if (!committed.current.recoveryAttempt && !reducedMotion && isActive()) reactionStarted = performance.now();
        requestFrame();
      } catch { fallback(); }
    }, fallback);

    return () => {
      alive = false; clearAttention(); refreshAttention = null;
      document.removeEventListener("pointermove", onAttentionPointer, true);
      document.removeEventListener("pointerout", onAttentionLeave, true);
      window.removeEventListener("blur", leaveAttention);
      document.removeEventListener("pointerdown", onAttentionPress, true);
      document.removeEventListener("focusin", onAttentionFocus, true);
      document.removeEventListener("click", onAttentionKeyboardClick, true);
      if (runtime.current === ownedRuntime) runtime.current = null;
      stopFrame(); clearRecovery(); clearFirstFrameDeadline(); observer?.disconnect(); intersection?.disconnect();
      window.removeEventListener("resize", visibility);
      document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", onReducedMotion);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      disposeGraphics();
    };
  }, [canvasRef]);
  return snapshot;
}
