import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import bookyPortrait from "../assets/mascots/knizhulyk-green-v1.png";
import Button from "../ui/Button";
import PlanetMascotAvatar from "../host/PlanetMascotAvatar";
import type { BookyGesture, BookyLook } from "../host/bookyAnimation";

const playfulGestures: readonly BookyGesture[] = ["wink", "nod", "curious", "happy", "highfive", "greeting"];

export default function GlobeSkinGuide({ selectRef, disabled = false, calmMotion = true, runtimeActive = true }: { selectRef: RefObject<HTMLSelectElement>; disabled?: boolean; calmMotion?: boolean; runtimeActive?: boolean }) {
  const { language } = useInterfaceLanguage();
  const ru = language === "ru", name = ru ? "Книжулик" : "Mr. Booky";
  const [open, setOpen] = useState(false);
  const [expression, setExpression] = useState<{ gesture: BookyGesture; key: number }>({ gesture: "greeting", key: 0 });
  const [look, setLook] = useState<BookyLook>({ x: 0, y: 0 });
  const root = useRef<HTMLDetailsElement>(null), summary = useRef<HTMLElement>(null);
  const panelId = useId(), headingId = useId();
  const close = useCallback((restoreFocus = false) => {
    if (root.current) root.current.open = false;
    setOpen(false);
    if (restoreFocus) summary.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => { close(); }, [language, close]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) close();
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open, close]);
  const choose = () => {
    close();
    const select = selectRef.current;
    if (!select || select.disabled) return;
    select.focus({ preventScroll: true });
    // Native pickers require this direct user gesture. Older browsers retain
    // the focused real select, which remains operable by touch and keyboard.
    try { select.showPicker?.(); } catch { /* Focused select is the fallback. */ }
  };
  return <details ref={root} className="globe-skin-guide" data-globe-skin-guide="" data-booky-calm={calmMotion ? "true" : undefined}
    onToggle={event => {
      const next = event.currentTarget.open;
      if (next) { setExpression({ gesture: "greeting", key: 0 }); setLook({ x: 0, y: 0 }); }
      setOpen(next);
    }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
    onKeyDown={event => {
      if (event.key === "Escape" && root.current?.open) { event.preventDefault(); event.stopPropagation(); close(true); }
    }}>
    <summary ref={summary} className="globe-skin-guide__trigger" aria-controls={panelId}
      aria-label={ru ? "Книжулик: как менять облики глобуса" : "Mr. Booky: how to change globe skins"}
      title={ru ? "Подсказка Книжулика" : "A tip from Mr. Booky"}>
      <img src={bookyPortrait} alt="" aria-hidden="true" width="34" height="36" />
      <span className="globe-skin-guide__tip-mark" aria-hidden="true">?</span>
    </summary>
    <div id={panelId} className="globe-skin-guide__panel" role="region" aria-labelledby={headingId}>
      <div className="globe-skin-guide__heading">
        <button type="button" className="globe-skin-guide__character" data-globe-skin-character=""
          aria-label={ru ? "Поиграть с Книжуликом: нажми, и он ответит жестом" : "Play with Mr. Booky: tap and he will respond with a gesture"}
          title={ru ? "Поздоровайся с Книжуликом" : "Say hello to Mr. Booky"}
          onClick={() => setExpression(previous => ({ gesture: playfulGestures[previous.key % playfulGestures.length], key: previous.key + 1 }))}
          onPointerMove={event => {
            if (event.pointerType !== "mouse" || calmMotion) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            setLook({ x: Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1)),
              y: Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1)) });
          }}
          onPointerLeave={() => setLook({ x: 0, y: 0 })} onBlur={() => setLook({ x: 0, y: 0 })}>
          {open && <PlanetMascotAvatar src={bookyPortrait} interaction={expression.gesture} reactionKey={expression.key}
            lookAt={look} active={runtimeActive} calmMotion={calmMotion} />}
          <span aria-hidden="true">{ru ? "Нажми" : "Tap me"}</span>
        </button>
        <div><small>{ru ? "Помогу выбрать" : "Let me help you choose"}</small><h2 id={headingId}>{name}</h2></div>
        <button type="button" className="globe-skin-guide__close" onClick={() => close(true)}
          aria-label={ru ? "Закрыть подсказку" : "Close the tip"}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
      </div>
      <p>{ru ? "Здесь можно менять облик глобуса: попробуй старинную карту или вид Земли из космоса. Доступные варианты уже входят в приложение."
        : "Change your globe’s skin here: try an antique map or a view of Earth from space. The available styles are already included with the app."}</p>
      <div className="globe-skin-guide__store-note" data-globe-skin-store-status="planned">
        <strong>{ru ? "Новые коллекции" : "New collections"}</strong>
        <p>{ru ? "Планируем дополнительные облики за внутреннюю валюту. Магазин пока недоступен."
          : "Extra skins using in-app currency are planned. The shop is not available yet."}</p>
      </div>
      <Button className="globe-skin-guide__choose" size="md" surface="light" variant="primary"
        data-globe-skin-guide-choose="" onClick={choose} disabled={disabled}
        endIcon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9h11M10 4l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}>
        {ru ? "Выбрать облик" : "Choose a skin"}
      </Button>
    </div>
  </details>;
}
