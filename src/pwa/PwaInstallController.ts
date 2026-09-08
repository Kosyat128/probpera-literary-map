export type PwaInstallPhase = "disabled" | "manual" | "available" | "prompting"
  | "accepted" | "dismissed" | "error" | "installed" | "disposed";
export interface PwaInstallSnapshot {
  readonly phase: PwaInstallPhase;
  /** Browser evidence only, not proof that Android finished creating a WebAPK. */
  readonly installationEvidence: "appinstalled" | "standalone" | null;
}
export type PwaInstallResult = Readonly<{
  status: "accepted" | "dismissed" | "installed" | "error" | "unavailable" | "disabled" | "disposed";
}>;
export type PwaInstallMedia = Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;
export interface PwaInstallOptions {
  readonly controlledDistribution: boolean;
  /** Null explicitly represents unavailable APIs (including server rendering). */
  readonly eventTarget?: Pick<EventTarget, "addEventListener" | "removeEventListener"> | null;
  readonly matchMedia?: ((query: string) => PwaInstallMedia) | null;
}
export interface PwaInstallController {
  getSnapshot(): PwaInstallSnapshot;
  subscribe(callback: () => void): () => void;
  /** Invoke directly in a user activation handler. Never schedule/auto-call it. */
  requestInstall(): Promise<PwaInstallResult>;
  dispose(): void;
}

type Choice = "accepted" | "dismissed";
type ObservedChoice = { value: unknown } | { failed: true };
type DeferredPrompt = { event: Event; prompt: () => unknown; choice: Promise<ObservedChoice> | null };
type Operation = { promise: Promise<PwaInstallResult>; resolve: (value: PwaInstallResult) => void };
const result = (status: PwaInstallResult["status"]): PwaInstallResult => Object.freeze({ status });
function choiceOutcome(value: unknown): Choice | null {
  if (!value || typeof value !== "object") return null;
  const outcome = (value as { outcome?: unknown }).outcome;
  return outcome === "accepted" || outcome === "dismissed" ? outcome : null;
}

/** Create once at controlled-distribution bootstrap, outside React/locale mounts.
 * No module-level browser reads, storage writes, install prompts or auth effects.
 * Missing prompt events mean only that an in-app prompt is unavailable now;
 * they do not prove that this browser cannot install through its own UI. */
export function createPwaInstallController(options: PwaInstallOptions): PwaInstallController {
  const enabled = options.controlledDistribution === true;
  const target = enabled ? options.eventTarget === undefined ? globalThis.window ?? null : options.eventTarget : null;
  const matchMedia = enabled ? options.matchMedia === undefined
    ? globalThis.window?.matchMedia?.bind(globalThis.window) : options.matchMedia : null;
  let media: PwaInstallMedia | null = null;
  try { media = matchMedia?.("(display-mode: standalone)") ?? null; } catch { /* Manual browser guidance remains available. */ }
  let standalone = media?.matches === true;
  let browserReported = false;
  let disposed = false;
  let deferred: DeferredPrompt | null = null;
  let pending: Operation | null = null;
  const seen = new WeakSet<Event>();
  const subscribers = new Map<() => void, number>();
  let snapshot: PwaInstallSnapshot = Object.freeze({
    phase: !enabled ? "disabled" : standalone ? "installed" : "manual",
    installationEvidence: standalone ? "standalone" : null,
  });
  const evidence = () => standalone ? "standalone" as const : browserReported ? "appinstalled" as const : null;
  function publish(phase: PwaInstallPhase) {
    const installationEvidence = phase === "disposed" ? null : evidence();
    if (snapshot.phase === phase && snapshot.installationEvidence === installationEvidence) return;
    snapshot = Object.freeze({ phase, installationEvidence });
    for (const callback of [...subscribers.keys()]) {
      try { callback(); } catch { /* A view cannot break installation lifecycle cleanup. */ }
    }
  }
  function finish(operation: Operation, status: PwaInstallResult["status"]) {
    if (pending !== operation) return;
    pending = null;
    const next = disposed ? "disposed" : evidence() ? "installed" : status;
    if (!disposed) publish(evidence() ? "installed" : deferred ? "available"
      : next === "accepted" || next === "dismissed" ? next : "error");
    operation.resolve(result(next));
  }
  function installed() {
    deferred = null;
    if (pending) finish(pending, "installed");
    else publish("installed");
  }
  const onInstalled: EventListener = () => {
    if (disposed) return;
    browserReported = true;
    installed();
  };
  const onDisplayChange = () => {
    if (disposed) return;
    standalone = media?.matches === true;
    if (evidence()) installed();
    else if (snapshot.phase === "installed") publish("manual");
  };
  const onBeforeInstall: EventListener = event => {
    if (disposed || evidence() || seen.has(event)) return;
    // This experimental event is not in every browser's DOM typings. Validate
    // features, not user-agent strings or the presence of a named constructor.
    const candidate = event as Event & { prompt?: unknown; userChoice?: unknown };
    try {
      if (typeof candidate.prompt !== "function") return;
      const choice = candidate.userChoice;
      if (choice !== undefined && (!choice || typeof (choice as PromiseLike<unknown>).then !== "function")) return;
      event.preventDefault();
      seen.add(event);
      deferred = {
        event, prompt: candidate.prompt as () => unknown,
        // Observe rejections immediately, even if this event is superseded or
        // the user never opens the install UI.
        choice: choice === undefined ? null : Promise.resolve(choice).then(
          value => ({ value }), () => ({ failed: true as const })),
      };
      if (!pending) publish("available");
    } catch { /* Malformed/unsupported events do not suppress normal browser UI. */ }
  };
  if (enabled) {
    target?.addEventListener("beforeinstallprompt", onBeforeInstall);
    target?.addEventListener("appinstalled", onInstalled);
    media?.addEventListener("change", onDisplayChange);
  }

  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(callback: () => void) {
      if (disposed) return () => {};
      subscribers.set(callback, (subscribers.get(callback) ?? 0) + 1);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        const count = subscribers.get(callback) ?? 0;
        if (count <= 1) subscribers.delete(callback); else subscribers.set(callback, count - 1);
      };
    },
    requestInstall() {
      if (disposed) return Promise.resolve(result("disposed"));
      if (!enabled) return Promise.resolve(result("disabled"));
      if (evidence()) return Promise.resolve(result("installed"));
      if (pending) return pending.promise;
      if (!deferred) return Promise.resolve(result("unavailable"));
      const prompt = deferred;
      deferred = null;
      let resolve!: Operation["resolve"];
      const promise = new Promise<PwaInstallResult>(complete => { resolve = complete; });
      const operation = { promise, resolve };
      pending = operation;
      publish("prompting");
      // A subscriber may have disposed the controller or observed installation.
      if (pending !== operation || disposed) return promise;
      try {
        // Deliberately before any await/microtask: preserve the button's user
        // activation. A consumed event is never reused, including after error.
        const returned = prompt.prompt.call(prompt.event);
        void Promise.resolve(returned).then(async value => {
          let outcome = choiceOutcome(value);
          // Legacy implementations return void and expose userChoice instead.
          if (!outcome && value === undefined && prompt.choice) {
            const observed = await prompt.choice;
            outcome = "value" in observed ? choiceOutcome(observed.value) : null;
          }
          finish(operation, outcome ?? "error");
        }).catch(() => finish(operation, "error"));
      } catch { finish(operation, "error"); }
      return promise;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      target?.removeEventListener("beforeinstallprompt", onBeforeInstall);
      target?.removeEventListener("appinstalled", onInstalled);
      media?.removeEventListener("change", onDisplayChange);
      deferred = null;
      // Browser UI already shown cannot be cancelled by this controller; settle
      // its caller now and ignore any eventual browser outcome.
      if (pending) finish(pending, "disposed");
      publish("disposed");
      subscribers.clear();
    },
  });
}
