import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import type { PlatformNavigation } from "../platform/ports";
import {
  createNativeBackBroker, createNativeNavigationIntake,
  type NativeBackActionResult, type NativeNavigationOptions, type NativeNavigationReadiness,
} from "./NativeNavigation";

export type NativeNavigationController<T> = ReturnType<typeof createNativeNavigationIntake<T>>;
export interface NativeNavigationBinding<T> extends Omit<NativeNavigationOptions<T>, "source"> {
  source?: PlatformNavigation;
  readiness: NativeNavigationReadiness;
  handleBack(): NativeBackActionResult;
  goBack(): void;
}

/** Each React effect lifetime owns its own native listeners and intake. */
export function useNativeNavigation<T>(
  options: NativeNavigationBinding<T>,
  controllerRef: MutableRefObject<NativeNavigationController<T> | null>,
) {
  const latest = useRef(options);
  useLayoutEffect(() => { latest.current = options; });
  useEffect(() => {
    const source = options.source;
    if (!source) return;
    let applying = false;
    const intake = createNativeNavigationIntake<T>({
      source,
      resolve: (intent, context) => latest.current.resolve(intent, context),
      apply: (value, intent, context) => {
        applying = true;
        try { return latest.current.apply(value, intent, context); }
        finally { applying = false; }
      },
      onOutcome: outcome => latest.current.onOutcome?.(outcome),
    });
    controllerRef.current = intake;
    intake.setReadiness(latest.current.readiness);
    intake.start();
    const userSelection = () => { if (!applying) intake.cancelPending(); };
    const userInput = (event: Event) => { if (event.isTrusted) userSelection(); };
    window.addEventListener("probpera:interface-language", userSelection);
    document.addEventListener("pointerdown", userInput, true);
    document.addEventListener("keydown", userInput, true);
    let alive = true;
    let canGoBack = false;
    let removeBack: (() => void | Promise<void>) | undefined;
    const back = source.subscribeBack ? createNativeBackBroker({
      history: { canGoBack: () => canGoBack, goBack: () => latest.current.goBack() },
    }) : null;
    back?.register({ id: "canonical-ui", priority: 1000, handle: () => latest.current.handleBack() });
    // Every Back invalidates delayed links, including root/history-only Back.
    if (source.subscribeBack && back) {
      void Promise.resolve().then(() => source.subscribeBack!(event => {
        if (!alive) return;
        intake.cancelPending();
        canGoBack = event.canGoBack;
        void back.requestBack();
      })).then(handle => {
        const remove = () => handle.remove();
        if (alive) removeBack = remove;
        else void Promise.resolve().then(remove).catch(() => {});
      }, () => {});
    }
    return () => {
      alive = false;
      if (controllerRef.current === intake) controllerRef.current = null;
      intake.dispose();
      window.removeEventListener("probpera:interface-language", userSelection);
      document.removeEventListener("pointerdown", userInput, true);
      document.removeEventListener("keydown", userInput, true);
      back?.dispose();
      if (removeBack) void Promise.resolve().then(removeBack).catch(() => {});
    };
  }, [controllerRef, options.source]);
  useEffect(() => {
    controllerRef.current?.setReadiness(options.readiness);
  }, [controllerRef, options.readiness.bootstrap, options.readiness.policy]);
}
