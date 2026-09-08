import { useEffect, useRef, useState } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { acquireHostInert } from "./hostInert";
import "./planetLaunch.css";

type Props = { ready: boolean; failed: boolean };
type LaunchPhase = "loading" | "revealing" | "complete";

/** Reveals the already mounted canonical scene. It never owns a scene or camera. */
export default function NativePlanetLaunch({ ready, failed }: Props) {
  const { t } = useInterfaceLanguage();
  const overlayRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(Date.now());
  const [phase, setPhase] = useState<LaunchPhase>(failed ? "complete" : "loading");
  const [reduceMotion, setReduceMotion] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReduceMotion(query.matches);
    changed();
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }, []);

  useEffect(() => {
    if (failed) setPhase("complete");
    else if (ready) setPhase(current => current === "loading" ? "revealing" : current);
  }, [failed, ready]);

  useEffect(() => {
    if (phase === "complete") return;
    // No artificial wait for a ready scene. The deadline only uncovers the real
    // loading/error/text fallback if the renderer never sends its first sample.
    const deadline = window.setTimeout(() => setPhase("complete"),
      phase === "loading" ? Math.max(0, 8_000 - (Date.now() - startedAt.current)) : reduceMotion ? 250 : 1_250);
    return () => window.clearTimeout(deadline);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase === "complete") return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    // Keep the scene mounted while blocking controls behind the curtain. Shared
    // ownership preserves overlapping panel locks and pre-existing inert state.
    const releases = Array.from(overlay.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== overlay)
      .map(acquireHostInert);
    return () => { for (const release of releases) release(); };
  }, [phase]);

  if (phase === "complete") return null;

  return (
    <div
      ref={overlayRef}
      className="native-planet-launch"
      data-phase={phase}
      data-reduced-motion={reduceMotion ? "true" : "false"}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget && event.animationName === "native-planet-curtain-out") {
          setPhase("complete");
        }
      }}
    >
      <img
        className="native-planet-launch__logo"
        src={`${import.meta.env.BASE_URL}brand/probpera-logo.png`}
        alt=""
        width="56"
        height="56"
        aria-hidden="true"
      />
      <div className="native-planet-launch__copy" role="status" aria-live="polite" aria-atomic="true">
        <h1>{t("Литературная планета")}</h1>
        <p>{t("Открываем «Литературную планету»…")}</p>
      </div>
    </div>
  );
}
