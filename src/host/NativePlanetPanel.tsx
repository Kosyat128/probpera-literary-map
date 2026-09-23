import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import BrandCloseIcon from "../components/BrandCloseIcon";
import IconButton from "../ui/IconButton";
import InterfaceLanguageControl from "../components/InterfaceLanguageControl";
import { acquireHostInert } from "./hostInert";
import { ProductNoticeSlot } from "./ProductNoticeHost";

export type NativePlanetSectionRequest = Readonly<{
  id: number;
  section: "recent" | "downloads" | "graphics";
  origin: Element | null;
  isCurrent: () => boolean;
}>;

const sectionSelectors = {
  recent: "[data-recent-history]",
  downloads: "[data-planet-downloads]",
  graphics: "[data-planet-graphics-settings]",
} as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onBack: () => void;
  globeRef: RefObject<HTMLElement>;
  returnFocusRef: RefObject<HTMLButtonElement>;
  children: ReactNode;
  sectionRequest?: NativePlanetSectionRequest | null;
};

/** Keep canonical collection/reader state mounted above the same globe. */
export default function NativePlanetPanel({ open, onClose, onBack, globeRef, returnFocusRef, children, sectionRequest }: Props) {
  const { language } = useInterfaceLanguage();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const sectionRequestRef = useRef(sectionRequest);
  sectionRequestRef.current = sectionRequest;
  const handledSectionRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const globe = globeRef.current;
    const releaseGlobe = globe ? acquireHostInert(globe) : undefined;
    const sectionOwnsFocus = Boolean(sectionRequestRef.current);
    const frame = requestAnimationFrame(() => {
      // Cancellation of an explicit request must not fall back to another
      // delayed focus after the user has already chosen a different control.
      if (!sectionOwnsFocus && !sectionRequestRef.current) closeRef.current?.focus({ preventScroll: true });
    });
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

  useEffect(() => {
    if (!open || !sectionRequest || handledSectionRequest.current === sectionRequest.id) return;
    const request = sectionRequest;
    let interrupted = false;
    const interrupt = () => { interrupted = true; handledSectionRequest.current = request.id; };
    document.addEventListener("pointerdown", interrupt, true);
    document.addEventListener("keydown", interrupt, true);
    const detach = () => {
      document.removeEventListener("pointerdown", interrupt, true);
      document.removeEventListener("keydown", interrupt, true);
    };
    const frame = requestAnimationFrame(() => {
      detach();
      handledSectionRequest.current = request.id;
      const panel = panelRef.current, focused = document.activeElement;
      if (interrupted || !request.isCurrent() || !panel?.isConnected
        || panel.closest('[hidden], [inert]') || document.visibilityState === "hidden") return;
      // Remounting or collapsing the companion focuses its own heading or
      // toggle. Only these exact owned controls may yield to a current request;
      // newer pointer/key input still cancels that request above.
      const companionHeading = panel.querySelector<HTMLElement>('[data-planet-mascot-panel] h2');
      const companionToggle = panel.querySelector<HTMLElement>('[data-planet-mascot-toggle]');
      if (focused && focused !== document.body && focused !== request.origin && focused !== closeRef.current
        && focused !== companionHeading && focused !== companionToggle) return;
      const details = panel.querySelector<HTMLDetailsElement>(sectionSelectors[request.section]);
      const summary = details?.querySelector<HTMLElement>(":scope > summary");
      if (!details || !summary?.getClientRects().length || summary.closest('[hidden], [inert]')) return;
      details.open = true;
      summary.focus({ preventScroll: true });
      summary.scrollIntoView({ block: "nearest" });
    });
    return () => { cancelAnimationFrame(frame); detach(); };
  }, [open, sectionRequest]);

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
