import { afterEach, describe, expect, it, vi } from "vitest";
import { createPwaInstallController, type PwaInstallController, type PwaInstallMedia } from "./PwaInstallController";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class TrackedTarget extends EventTarget {
  listeners = new Set<string>();
  override addEventListener(type: string, callback: EventListenerOrEventListenerObject | null) {
    this.listeners.add(type); super.addEventListener(type, callback);
  }
  override removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null) {
    this.listeners.delete(type); super.removeEventListener(type, callback);
  }
}
class Media extends TrackedTarget {
  constructor(public matches = false) { super(); }
  set(value: boolean) { this.matches = value; this.dispatchEvent(new Event("change")); }
}
const controllers: PwaInstallController[] = [];
function fixture(standalone = false) {
  const target = new TrackedTarget(), media = new Media(standalone);
  const matchMedia = vi.fn(() => media as unknown as PwaInstallMedia);
  const controller = createPwaInstallController({ controlledDistribution: true, eventTarget: target, matchMedia });
  controllers.push(controller);
  return { target, media, controller, matchMedia };
}
function installEvent(prompt: () => unknown, userChoice?: unknown) {
  return Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
    prompt: vi.fn(prompt), ...(userChoice === undefined ? {} : { userChoice }),
  });
}
afterEach(() => { for (const controller of controllers.splice(0)) controller.dispose(); });

describe("controlled PWA install lifecycle", () => {
  it("leaves public/native distributions untouched and reports unavailable browser APIs honestly", async () => {
    const target = new TrackedTarget(), matchMedia = vi.fn(() => new Media(true) as unknown as PwaInstallMedia);
    const disabled = createPwaInstallController({ controlledDistribution: false, eventTarget: target, matchMedia });
    controllers.push(disabled);
    expect(disabled.getSnapshot()).toEqual({ phase: "disabled", installationEvidence: null });
    expect(await disabled.requestInstall()).toEqual({ status: "disabled" });
    expect(target.listeners.size).toBe(0); expect(matchMedia).not.toHaveBeenCalled();
    const unavailable = createPwaInstallController({ controlledDistribution: true, eventTarget: null, matchMedia: null });
    controllers.push(unavailable);
    expect(unavailable.getSnapshot()).toEqual({ phase: "manual", installationEvidence: null });
    expect(await unavailable.requestInstall()).toEqual({ status: "unavailable" });
  });

  it("retains an early deferred prompt across locale/view subscription lifetimes without auto-prompting", async () => {
    const { target, controller } = fixture();
    const event = installEvent(() => Promise.resolve({ outcome: "dismissed" }));
    target.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(event.prompt).not.toHaveBeenCalled();
    const snapshot = controller.getSnapshot();
    expect(Object.isFrozen(snapshot)).toBe(true); expect(controller.getSnapshot()).toBe(snapshot);
    const update = vi.fn(); const first = controller.subscribe(update), second = controller.subscribe(update);
    first(); first();
    expect(target.listeners.size).toBe(2);
    const result = controller.requestInstall();
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(await result).toEqual({ status: "dismissed" });
    expect(update).toHaveBeenCalledTimes(2);
    second();
    target.dispatchEvent(installEvent(() => Promise.resolve({ outcome: "accepted" })));
    expect(update).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().phase).toBe("available");
  });

  it("calls prompt in the user stack, coalesces double clicks, and never equates acceptance with installation", async () => {
    const { target, controller } = fixture(); const choice = deferred<unknown>();
    const event = installEvent(() => Promise.resolve(), choice.promise);
    target.dispatchEvent(event);
    const first = controller.requestInstall();
    expect(event.prompt).toHaveBeenCalledTimes(1); // No awaited turn before invocation.
    expect(controller.requestInstall()).toBe(first);
    choice.resolve({ outcome: "accepted", platform: "web" });
    expect(await first).toEqual({ status: "accepted" });
    expect(controller.getSnapshot()).toEqual({ phase: "accepted", installationEvidence: null });
    target.dispatchEvent(event); // A consumed browser event cannot be reused.
    expect(await controller.requestInstall()).toEqual({ status: "unavailable" });
    expect(event.prompt).toHaveBeenCalledTimes(1);
    target.dispatchEvent(new Event("appinstalled"));
    expect(controller.getSnapshot()).toEqual({ phase: "installed", installationEvidence: "appinstalled" });
  });

  it("keeps a fresh browser prompt when an older dialog dismisses, without opening another automatically", async () => {
    const { target, controller } = fixture(); const oldChoice = deferred<unknown>();
    const old = installEvent(() => oldChoice.promise), fresh = installEvent(() => Promise.resolve({ outcome: "accepted" }));
    target.dispatchEvent(old); const pending = controller.requestInstall();
    target.dispatchEvent(fresh); oldChoice.resolve({ outcome: "dismissed" });
    expect(await pending).toEqual({ status: "dismissed" });
    expect(controller.getSnapshot().phase).toBe("available");
    expect(fresh.prompt).not.toHaveBeenCalled();
    expect(await controller.requestInstall()).toEqual({ status: "accepted" });
    expect(fresh.prompt).toHaveBeenCalledTimes(1);
  });

  it.each(["throw", "reject", "invalid", "choice-reject"])("consumes a failed prompt (%s) and recovers only when the browser offers a new one", async kind => {
    const { target, controller } = fixture();
    const choice = deferred<unknown>();
    const failed = installEvent(() => {
      if (kind === "throw") throw new Error("browser denied prompt");
      if (kind === "reject") return Promise.reject(new Error("browser denied prompt"));
      return Promise.resolve(kind === "invalid" ? { outcome: "unknown" } : undefined);
    }, kind === "choice-reject" ? choice.promise : undefined);
    target.dispatchEvent(failed); const pending = controller.requestInstall();
    if (kind === "choice-reject") choice.reject(new Error("choice unavailable"));
    expect(await pending).toEqual({ status: "error" });
    expect(controller.getSnapshot()).toEqual({ phase: "error", installationEvidence: null });
    expect(await controller.requestInstall()).toEqual({ status: "unavailable" });
    target.dispatchEvent(installEvent(() => Promise.resolve({ outcome: "dismissed" })));
    expect(await controller.requestInstall()).toEqual({ status: "dismissed" });
  });

  it("lets browser installation win races with an outstanding or rejected choice", async () => {
    const { target, controller } = fixture(); const choice = deferred<unknown>();
    target.dispatchEvent(installEvent(() => choice.promise));
    const pending = controller.requestInstall(); target.dispatchEvent(new Event("appinstalled"));
    expect(await pending).toEqual({ status: "installed" });
    const installed = controller.getSnapshot(); choice.reject(new Error("late browser rejection"));
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getSnapshot()).toBe(installed);
    const stale = installEvent(() => Promise.resolve({ outcome: "dismissed" })); target.dispatchEvent(stale);
    expect(await controller.requestInstall()).toEqual({ status: "installed" });
    expect(stale.prompt).not.toHaveBeenCalled();
  });

  it("uses actual standalone media state, and does not persist inferred installation after returning to a tab", async () => {
    const { controller, media, matchMedia } = fixture(true);
    expect(matchMedia).toHaveBeenCalledExactlyOnceWith("(display-mode: standalone)");
    expect(controller.getSnapshot()).toEqual({ phase: "installed", installationEvidence: "standalone" });
    media.set(false);
    expect(controller.getSnapshot()).toEqual({ phase: "manual", installationEvidence: null });
    const stable = controller.getSnapshot(); media.set(false); expect(controller.getSnapshot()).toBe(stable);
    media.set(true); expect(await controller.requestInstall()).toEqual({ status: "installed" });
  });

  it("ignores malformed events without cancelling ordinary browser UI", () => {
    const { target, controller } = fixture();
    const malformed = [new Event("beforeinstallprompt", { cancelable: true }),
      Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt: 1 }),
      installEvent(() => Promise.resolve(), { not: "a promise" })];
    for (const event of malformed) { target.dispatchEvent(event); expect(event.defaultPrevented).toBe(false); }
    expect(controller.getSnapshot().phase).toBe("manual");
  });

  it("settles disposal immediately, detaches listeners, and ignores late dialog outcomes", async () => {
    const { target, media, controller } = fixture(); const choice = deferred<unknown>();
    const event = installEvent(() => choice.promise); target.dispatchEvent(event);
    const pending = controller.requestInstall(), change = vi.fn(); controller.subscribe(change);
    controller.dispose(); controller.dispose();
    expect(await pending).toEqual({ status: "disposed" });
    expect(target.listeners.size).toBe(0); expect(media.listeners.size).toBe(0);
    const disposed = controller.getSnapshot(); expect(change).toHaveBeenCalledTimes(1);
    choice.resolve({ outcome: "accepted" }); target.dispatchEvent(new Event("appinstalled")); media.set(true);
    await Promise.resolve(); await Promise.resolve();
    expect(controller.getSnapshot()).toBe(disposed);
    expect(await controller.requestInstall()).toEqual({ status: "disposed" });
    expect(event.prompt).toHaveBeenCalledTimes(1);
  });

  it("guards reentrant subscribers before invoking the browser prompt", async () => {
    const { target, controller } = fixture();
    const event = installEvent(() => Promise.resolve({ outcome: "accepted" })); target.dispatchEvent(event);
    let nested: Promise<unknown> | undefined;
    controller.subscribe(() => {
      if (controller.getSnapshot().phase === "prompting") { nested = controller.requestInstall(); controller.dispose(); }
    });
    const pending = controller.requestInstall();
    expect(nested).toBe(pending); expect(await pending).toEqual({ status: "disposed" });
    expect(event.prompt).not.toHaveBeenCalled();
  });
});
