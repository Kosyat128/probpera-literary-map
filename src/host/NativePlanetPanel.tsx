import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import BrandCloseIcon from "../components/BrandCloseIcon";
import IconButton from "../ui/IconButton";
import InterfaceLanguageControl from "../components/InterfaceLanguageControl";
import { acquireHostInert } from "./hostInert";
import { ProductNoticeSlot } from "./ProductNoticeHost";

type Props = {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  globeRef: RefObject<HTMLElement>;
  returnFocusRef: RefObject<HTMLButtonElement>;
  children: ReactNode;
};

/** Keep canonical collection/reader state mounted above the same globe. */
export default function NativePlanetPanel({ open, onClose, onBack, globeRef, returnFocusRef, children }: Props) {
  const { language } = useInterfaceLanguage();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  useEffect(() => {
    if (!open) return;
    const globe = globeRef.current;
    const releaseGlobe = globe ? acquireHostInert(globe) : undefined;
    const frame = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      // Canonical reader/collection dialogs own their nested Escape and focus.
      const nested = target?.closest('[role="dialog"], dialog');
      if (nested && nested !== panelRef.current) return;
      if (event.key === "Escape") { event.preventDefault(); onBackRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, summary, [tabindex="0"]') ?? [])]
        .filter(item => item.getClientRects().length && !item.matches(':disabled') && !item.closest('[hidden], [inert]'));
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", keydown);
      releaseGlobe?.();
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, globeRef, returnFocusRef]);

  return <section ref={panelRef} className="native-planet-panel" hidden={!open}
    role={open ? "dialog" : undefined} aria-modal={open ? true : undefined} aria-labelledby="native-collection-title">
    <header className="native-planet-panel__header">
      <h1 id="native-collection-title">{language === "ru" ? "Коллекция" : "Collection"}</h1>
      {open && <InterfaceLanguageControl />}
      <IconButton ref={closeRef} icon={<BrandCloseIcon />} size="md"
        aria-label={language === "ru" ? "Вернуться к планете" : "Return to the planet"}
        onClick={onClose} />
    </header>
    <ProductNoticeSlot placement="panel" active={open} />
    <div className="native-planet-panel__content">{children}</div>
  </section>;
}
