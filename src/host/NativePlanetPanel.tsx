import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
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
  companion?: ReactNode;
  sectionRequest?: NativePlanetSectionRequest | null;
};

/** Keep canonical collection/reader state mounted above the same globe. */
export default function NativePlanetPanel({ open, onClose, onBack, globeRef, returnFocusRef, children, companion, sectionRequest }: Props) {
  const { language } = useInterfaceLanguage();
  const panelRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockLayout, setDockLayout] = useState({ active: false, height: 120 });
  const closeRef = useRef<HTMLButtonElement>(null);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const sectionRequestRef = useRef(sectionRequest);
  sectionRequestRef.current = sectionRequest;
  const handledSectionRequest = useRef<number | null>(null);
  useLayoutEffect(() => {
    const panel = panelRef.current, dock = dockRef.current;
    if (!panel || !dock) return;
    const mobile = window.matchMedia("(max-width: 640px), (max-width: 1024px) and (max-height: 540px) and (orientation: landscape)");
    let observedPet: HTMLElement | null = null, observedHelp: HTMLElement | null = null;
    const measure = () => {
      const pet = dock.querySelector<HTMLElement>("[data-planet-mascot-pet]");
      if (pet !== observedPet) {
        if (observedPet) resize?.unobserve(observedPet);
        observedPet = pet;
        if (pet) resize?.observe(pet);
      }
      const help = pet?.getAttribute("data-booky-help-sheet") === "true"
        ? pet.querySelector<HTMLElement>("[data-planet-mascot-panel]") : null;
      if (help !== observedHelp) {
        if (observedHelp) resize?.unobserve(observedHelp);
        observedHelp = help ?? null;
        if (help) resize?.observe(help);
      }
      // Search and book content retain a scrollable area above the actual
      // companion surface, even when no optional utility section is open.
      const active = open && mobile.matches && Boolean(pet);
      const fallback = pet?.getAttribute("data-planet-mascot-visibility") === "hidden" ? 68 : 88;
      const measured = (help ?? pet)?.getBoundingClientRect().height ?? 0;
      setDockLayout(previous => {
        // Both the compact row and open help are measured in their current
        // layout; disclosure and text reflow update this existing observer.
        const height = active && measured > 0 ? Math.ceil(measured) + 24 : fallback;
        return previous.active === active && previous.height === height ? previous : { active, height };
      });
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mutation?.observe(panel, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["open", "hidden", "inert", "aria-hidden", "data-planet-mascot-visibility",
        "data-booky-help-sheet", "data-booky-actions-open"] });
    mobile.addEventListener("change", measure);
    measure();
    return () => { resize?.disconnect(); mutation?.disconnect(); mobile.removeEventListener("change", measure); };
  }, [open, dockLayout.active]);

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
    const currentSection = () => {
      const panel = panelRef.current, focused = document.activeElement;
      if (interrupted || !request.isCurrent() || !panel?.isConnected
        || panel.closest('[hidden], [inert]') || document.visibilityState === "hidden") return null;
      // Remounting or collapsing the companion focuses its own heading or
      // toggle. Only these exact owned controls may yield to a current request;
      // newer pointer/key input still cancels that request above.
      const companionHeading = panel.querySelector<HTMLElement>('[data-planet-mascot-panel] h2');
      const companionToggle = panel.querySelector<HTMLElement>('[data-planet-mascot-toggle]');
      if (focused && focused !== document.body && focused !== request.origin && focused !== closeRef.current
        && focused !== companionHeading && focused !== companionToggle) return null;
      const details = panel.querySelector<HTMLDetailsElement>(sectionSelectors[request.section]);
      const summary = details?.querySelector<HTMLElement>(":scope > summary");
      return details && summary?.getClientRects().length && !summary.closest('[hidden], [inert]')
        ? { details, summary } : null;
    };
    let frame = requestAnimationFrame(() => {
      const section = currentSection();
      if (!section) { detach(); handledSectionRequest.current = request.id; return; }
      section.details.open = true;
      // Opening a utility reserves the companion row and shortens the scroll
      // area. Reveal its heading after that layout, retaining cancellation and
      // focus ownership while waiting so a newer touch always takes priority.
      frame = requestAnimationFrame(() => {
        detach();
        handledSectionRequest.current = request.id;
        const current = currentSection();
        if (!current) return;
        current.summary.focus({ preventScroll: true });
        current.summary.scrollIntoView({ block: "nearest" });
      });
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
    <div ref={dockRef} className="native-planet-panel__companion" data-booky-dock=""
      data-booky-dock-active={String(dockLayout.active)}
      style={{ "--booky-dock-height": `${dockLayout.height}px` } as CSSProperties}>{companion}</div>
  </section>;
}
