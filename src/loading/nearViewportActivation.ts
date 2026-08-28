import { useCallback, useEffect, useRef, useState } from "react";

export type DeferredLoadStatus = "idle" | "loading" | "ready" | "error";

export type DeferredActivationReason =
  | "direct-hash"
  | "forced-intent"
  | "near-viewport";

export function normalizedHashTarget(hash: string) {
  const rawTarget = hash.replace(/^#/, "").trim();
  if (!rawTarget) return "";
  try {
    return decodeURIComponent(rawTarget).toLocaleLowerCase("en");
  } catch {
    return rawTarget.toLocaleLowerCase("en");
  }
}

export function hashTargetsSection(
  hash: string,
  targets: readonly string[]
) {
  const requestedTarget = normalizedHashTarget(hash);
  return (
    requestedTarget.length > 0 &&
    targets.some(
      (target) => normalizedHashTarget(target) === requestedTarget
    )
  );
}

export function shouldActivateDeferredSection({
  force = false,
  hash = "",
  hashTargets,
}: {
  force?: boolean;
  hash?: string;
  hashTargets: readonly string[];
}) {
  return force || hashTargetsSection(hash, hashTargets);
}

type NearViewportActivationOptions = {
  force?: boolean;
  hashTargets: readonly string[];
  rootMargin?: string;
  onActivate?: (reason: DeferredActivationReason) => void;
};

/**
 * Sticky activation gate for expensive homepage islands. The observed shell is
 * present from the first render; only its heavy implementation waits for a
 * direct address, explicit intent, or proximity to the viewport.
 */
export function useNearViewportActivation({
  force = false,
  hashTargets,
  rootMargin = "480px 0px",
  onActivate,
}: NearViewportActivationOptions) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const activatedRef = useRef(false);

  const activate = useCallback(
    (reason: DeferredActivationReason) => {
      if (activatedRef.current) return;
      activatedRef.current = true;
      setActive(true);
      onActivate?.(reason);
    },
    [onActivate]
  );

  useEffect(() => {
    if (force) activate("forced-intent");
  }, [activate, force]);

  useEffect(() => {
    const activateFromAddress = () => {
      if (hashTargetsSection(window.location.hash, hashTargets)) {
        activate("direct-hash");
      }
    };
    activateFromAddress();
    window.addEventListener("hashchange", activateFromAddress);
    window.addEventListener("popstate", activateFromAddress);
    return () => {
      window.removeEventListener("hashchange", activateFromAddress);
      window.removeEventListener("popstate", activateFromAddress);
    };
  }, [activate, hashTargets]);

  useEffect(() => {
    if (active || !node) return undefined;
    if (!("IntersectionObserver" in window)) {
      activate("near-viewport");
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate("near-viewport");
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [activate, active, node, rootMargin]);

  return { active, setActivationNode: setNode, activate };
}
