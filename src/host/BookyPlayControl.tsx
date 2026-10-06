import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import PlanetMascotAvatar from "./PlanetMascotAvatar";
import type { BookyGesture } from "./bookyAnimation";
import type { BookyRendererState } from "./useBookyRenderer";
import "./BookyPlayControl.css";

const gestures: readonly BookyGesture[] = ["wink", "nod", "curious", "happy", "highfive", "greeting"];
const responses = {
  ru: ["Книжулик подмигивает.", "Книжулик кивает.", "Книжулик смотрит с любопытством.", "Книжулик радуется.", "Книжулик даёт пять.", "Книжулик приветствует тебя."],
  en: ["Mr. Booky winks.", "Mr. Booky nods.", "Mr. Booky looks curious.", "Mr. Booky is happy.", "Mr. Booky gives you a high five.", "Mr. Booky says hello."],
} as const;
type Character = Readonly<{ attempt: number; recoveryAttempt: boolean; state: BookyRendererState }>;

/** Local play and recovery for the existing guide/child avatar. No navigation,
 * preferences, content, profile rights or native commands are accepted here. */
export default function BookyPlayControl({ src, active, calmMotion, className = "", context }: {
  src: string; active: boolean; calmMotion: boolean; className?: string; context: "guide" | "child";
}) {
  const { language } = useInterfaceLanguage(), ru = language === "ru";
  const [character, setCharacter] = useState<Character>({ attempt: 0, recoveryAttempt: false, state: "loading" });
  const [expression, setExpression] = useState<{ gesture: BookyGesture | "rest"; key: number }>({ gesture: context === "guide" ? "greeting" : "rest", key: 0 });
  const owner = useRef(character), mounted = useRef(false), available = useRef(active);
  const playButton = useRef<HTMLButtonElement>(null), retryButton = useRef<HTMLButtonElement>(null), restorePlayFocus = useRef(false);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useLayoutEffect(() => { available.current = active; }, [active]);
  useLayoutEffect(() => {
    if (!restorePlayFocus.current) return;
    restorePlayFocus.current = false;
    if (active && character.state === "live3d" && document.activeElement === document.body) playButton.current?.focus({ preventScroll: true });
  }, [active, character.state]);
  const onRendererState = useCallback((attempt: number, state: BookyRendererState) => {
    const current = owner.current;
    if (!mounted.current || current.attempt !== attempt || current.state === state) return;
    if (state === "live3d" && document.activeElement === retryButton.current) restorePlayFocus.current = true;
    const next = { ...current, state }; owner.current = next; setCharacter(next);
  }, []);
  const usable = () => mounted.current && available.current && !document.hidden;
  const play = () => {
    if (!usable() || owner.current.state !== "live3d") return;
    setExpression(previous => ({ gesture: gestures[previous.key % gestures.length], key: previous.key + 1 }));
  };
  const retry = () => {
    const current = owner.current;
    if (!usable() || current.state !== "fallback") return;
    // Claim this lifetime before React commits, so repeated presses cannot queue contexts.
    const next: Character = { attempt: current.attempt + 1, recoveryAttempt: true, state: "loading" };
    owner.current = next; setExpression({ gesture: "rest", key: 0 }); setCharacter(next);
  };
  const status = character.state === "fallback"
    ? ru ? "Пока показываю портрет." : "Showing the portrait for now."
    : character.state === "loading" ? ru ? "Открываю 3D…" : "Opening 3D…"
    : expression.key > 0 ? responses[language][(expression.key - 1) % gestures.length] : "";
  return <div className="booky-play-control" data-booky-play-context={context}>
    <button ref={playButton} type="button" className={className} data-globe-skin-character={context === "guide" ? "" : undefined}
      data-booky-play="" disabled={!active || character.state !== "live3d"}
      aria-label={ru ? "Поиграть с Книжуликом: нажми, и он ответит жестом" : "Play with Mr. Booky: tap and he will respond with a gesture"}
      title={ru ? "Поздоровайся с Книжуликом" : "Say hello to Mr. Booky"} onClick={play}>
      <PlanetMascotAvatar key={character.attempt} attempt={character.attempt} recoveryAttempt={character.recoveryAttempt}
        onRendererState={onRendererState} src={src} interaction={expression.gesture} reactionKey={expression.key}
        active={active} calmMotion={calmMotion} />
      <span aria-hidden="true">{ru ? "Нажми" : "Tap me"}</span>
    </button>
    <span className="booky-play-control__status" role="status" aria-live="polite" aria-atomic="true"
      data-booky-play-state={character.state}>{status}</span>
    {(character.state === "fallback" || character.recoveryAttempt && character.state === "loading") && <button
      ref={retryButton} type="button" className="booky-play-control__retry" data-booky-play-retry=""
      aria-disabled={!active || character.state !== "fallback"} onClick={retry}>
      {character.state === "loading" ? ru ? "Включаю 3D…" : "Opening 3D…" : ru ? "Включить 3D снова" : "Try 3D again"}
    </button>}
  </div>;
}
