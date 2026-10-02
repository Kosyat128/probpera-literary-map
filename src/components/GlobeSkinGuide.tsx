import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import bookyPortrait from "../assets/mascots/knizhulyk-green-v1.png";
import Button from "../ui/Button";

export default function GlobeSkinGuide({ selectRef, disabled = false }: { selectRef: RefObject<HTMLSelectElement>; disabled?: boolean }) {
  const { language } = useInterfaceLanguage();
  const ru = language === "ru", name = ru ? "Книжулик" : "Mr. Booky";
  const [open, setOpen] = useState(false);
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
  return <details ref={root} className="globe-skin-guide" data-globe-skin-guide=""
    onToggle={event => setOpen(event.currentTarget.open)}
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
        <img src={bookyPortrait} alt="" aria-hidden="true" width="48" height="52" />
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
