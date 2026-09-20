import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import mascotImage from "../assets/mascots/knizhulyk-green-v1.png";
import PlanetMascotAvatar from "./PlanetMascotAvatar";
import type { PlanetMascotController, PlanetMascotSnapshot } from "./planetMascot";
import { PLANET_MASCOT_ROUTES, getPlanetMascotStep, type PlanetMascotAction,
  type PlanetMascotScreen, type PlanetMascotTarget } from "./planetMascotRoutes";
import "./PlanetMascotControls.css";

type Position = Readonly<{ left: number; top: number }>;
type Rect = Position & Readonly<{ width: number; height: number }>;
export type PlanetMascotControlsProps = {
  controller: PlanetMascotController;
  snapshot: PlanetMascotSnapshot;
  screen: PlanetMascotScreen;
  countryLabel: string | null;
  writerLabel: string | null;
  onAction: (action: PlanetMascotAction) => void;
  position: Position | null;
  onPositionChange: (position: Position | null) => void;
};
const MARGIN = 12;
const arrowDirections: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};
const selectors: Record<PlanetMascotTarget, readonly string[]> = {
  search: ['.atlas-immersive-chrome [data-atlas-action="toggle-search"]', '#country-search'],
  country: [".atlas-country-presentation", ".literary-globe canvas"],
  writer: [".atlas-country-presentation .writer-list", ".atlas-country-presentation"],
  books: [".book-archive-heading", '.atlas-immersive-chrome [data-atlas-action="open-collection"]'],
  appearance: ["[data-planet-stand-toggle]"],
};
function viewport(): Rect {
  const view = window.visualViewport;
  return { left: view?.offsetLeft ?? 0, top: view?.offsetTop ?? 0,
    width: view?.width ?? window.innerWidth, height: view?.height ?? window.innerHeight };
}
function sameRect(a: Rect | null, b: Rect | null) {
  return a === b || Boolean(a && b && Math.abs(a.left - b.left) < .5 && Math.abs(a.top - b.top) < .5
    && Math.abs(a.width - b.width) < .5 && Math.abs(a.height - b.height) < .5);
}
function clamped(position: Position, width: number, height: number, view: Rect): Position {
  return { left: Math.max(view.left + MARGIN, Math.min(position.left, view.left + view.width - width - MARGIN)),
    top: Math.max(view.top + MARGIN, Math.min(position.top, view.top + view.height - height - MARGIN)) };
}
function visibleRect(element: Element, view: Rect): Rect | null {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return null;
  const style = getComputedStyle(element), bounds = element.getBoundingClientRect();
  if (style.display === "none" || style.visibility !== "visible" || Number(style.opacity) === 0
    || bounds.width < 2 || bounds.height < 2) return null;
  let left = Math.max(bounds.left, view.left), top = Math.max(bounds.top, view.top);
  let right = Math.min(bounds.right, view.left + view.width), bottom = Math.min(bounds.bottom, view.top + view.height);
  let clipAncestors = style.position !== "fixed";
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const parentStyle = getComputedStyle(parent);
    if (parentStyle.display === "none" || Number(parentStyle.opacity) === 0) return null;
    // The fixed globe/panel escapes the surrounding document's overflow boxes.
    // During scroll lock body is fixed and html can have zero content height;
    // neither root box is the viewport that clips these visible controls.
    if (clipAncestors && parent !== document.body && parent !== document.documentElement
      && /hidden|clip|scroll|auto/.test(parentStyle.overflowX + parentStyle.overflowY)) {
      const clip = parent.getBoundingClientRect();
      if (/hidden|clip|scroll|auto/.test(parentStyle.overflowX)) { left = Math.max(left, clip.left); right = Math.min(right, clip.right); }
      if (/hidden|clip|scroll|auto/.test(parentStyle.overflowY)) { top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom); }
    }
    if (parentStyle.position === "fixed") clipAncestors = false;
  }
  return right - left >= 2 && bottom - top >= 2 ? { left, top, width: right - left, height: bottom - top } : null;
}
function overlap(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
}

export default function PlanetMascotControls({ controller, snapshot, screen, countryLabel, writerLabel,
  onAction, position, onPositionChange }: PlanetMascotControlsProps) {
  const { language } = useInterfaceLanguage();
  const ru = language === "ru", name = ru ? "Книжулик" : "Mr. Booky";
  const id = useId(), root = useRef<HTMLDivElement>(null), card = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const tourHeading = useRef<HTMLHeadingElement>(null), focusAfterNavigation = useRef(false);
  const [view, setView] = useState<Rect>(() => typeof window === "undefined"
    ? { left: 0, top: 0, width: 1024, height: 768 } : viewport());
  const [petSize, setPetSize] = useState({ width: 156, height: 194 });
  const [cardHeight, setCardHeight] = useState(360);
  const [highlight, setHighlight] = useState<Rect | null>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Position } | null>(null);
  const prior = useRef({ panel: snapshot.panel, visibility: snapshot.visibility });
  const shown = snapshot.visibility === "shown", open = shown && snapshot.panel === "open";
  const step = getPlanetMascotStep(snapshot.route, snapshot.step);
  const tour = snapshot.mode === "tour" && step && snapshot.route ? PLANET_MASCOT_ROUTES[snapshot.route] : null;

  useLayoutEffect(() => {
    const measure = () => setView(previous => { const next = viewport(); return sameRect(previous, next) ? previous : next; });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    measure();
    return () => { window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure); window.visualViewport?.removeEventListener("scroll", measure); };
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      const bounds = root.current?.getBoundingClientRect();
      if (bounds) setPetSize(previous => Math.abs(previous.width - bounds.width) < .5 && Math.abs(previous.height - bounds.height) < .5
        ? previous : { width: bounds.width, height: bounds.height });
      const cardBounds = card.current?.getBoundingClientRect();
      if (cardBounds) setCardHeight(previous => Math.abs(previous - cardBounds.height) < .5 ? previous : cardBounds.height);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (root.current) observer?.observe(root.current);
    if (card.current) observer?.observe(card.current);
    measure();
    return () => observer?.disconnect();
  }, [snapshot.available, shown, open, language, view.width, view.height]);

  useLayoutEffect(() => {
    const previous = prior.current;
    prior.current = { panel: snapshot.panel, visibility: snapshot.visibility };
    if (!snapshot.available) return;
    if (open && previous.panel !== "open") heading.current?.focus({ preventScroll: true });
    else if ((!open && previous.panel === "open") || (!shown && previous.visibility === "shown")) toggle.current?.focus({ preventScroll: true });
  }, [snapshot.available, snapshot.panel, snapshot.visibility, shown, open]);

  useLayoutEffect(() => {
    if (!focusAfterNavigation.current) return;
    focusAfterNavigation.current = false;
    if (open && snapshot.available) (tourHeading.current ?? heading.current)?.focus({ preventScroll: true });
  }, [snapshot.revision, snapshot.available, open]);

  useLayoutEffect(() => {
    if (!snapshot.available || !open || !snapshot.highlight) { setHighlight(null); return; }
    let observed: Element | null = null, alive = true;
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    function measure() {
      if (!alive) return;
      let target: Element | null = null, next: Rect | null = null;
      for (const selector of selectors[snapshot.highlight!]) {
        for (const candidate of document.querySelectorAll(selector)) {
          const bounds = visibleRect(candidate, viewport());
          if (bounds) { target = candidate; next = bounds; break; }
        }
        if (target) break;
      }
      if (target !== observed) { resize?.disconnect(); observed = target; if (target) resize?.observe(target); }
      setHighlight(previous => sameRect(previous, next) ? previous : next);
    }
    // Async archive loading can replace the real target after the step opens.
    // No mutation writes or animation-frame polling belong to this observer.
    const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mutation?.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["hidden", "inert", "aria-hidden", "data-atlas-sheet-state"] });
    window.addEventListener("resize", measure); window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure); window.visualViewport?.addEventListener("scroll", measure);
    measure();
    return () => { alive = false; resize?.disconnect(); mutation?.disconnect(); window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true); window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure); };
  }, [snapshot.available, snapshot.highlight, snapshot.revision, open, screen, countryLabel, writerLabel]);

  const petPosition = clamped(position ?? { left: view.left + view.width - petSize.width - 20,
    top: view.top + view.height - petSize.height - 20 }, petSize.width, petSize.height, view);
  const petRect = { ...petPosition, ...petSize };
  const cardWidth = Math.min(340, Math.max(180, view.width - MARGIN * 2));
  const sideRoom = view.width >= petSize.width + cardWidth + MARGIN * 3;
  const maxCardHeight = Math.max(100, view.height - MARGIN * 2 - (sideRoom ? 0 : petSize.height + MARGIN));
  const height = Math.min(cardHeight, maxCardHeight);
  const cardCandidates = [
    { left: petPosition.left - cardWidth - MARGIN, top: petPosition.top + petSize.height - height },
    { left: petPosition.left + petSize.width + MARGIN, top: petPosition.top + petSize.height - height },
    { left: petPosition.left + petSize.width - cardWidth, top: petPosition.top - height - MARGIN },
    { left: petPosition.left + petSize.width - cardWidth, top: petPosition.top + petSize.height + MARGIN },
  ].map(candidate => ({ ...clamped(candidate, cardWidth, height, view), width: cardWidth, height }));
  const score = (candidate: Rect) => overlap(candidate, petRect) * 4
    + (highlight && highlight.width * highlight.height < view.width * view.height * .45 ? overlap(candidate, highlight) : 0);
  const cardPosition = cardCandidates.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best);
  const perform = (action: PlanetMascotAction) => controller.act(action, snapshot.revision, () => onAction(action));
  const navigateTips = (action: () => boolean) => {
    focusAfterNavigation.current = Boolean(card.current?.contains(document.activeElement));
    if (!action()) focusAfterNavigation.current = false;
  };
  const move = (next: Position) => onPositionChange(clamped(next, petSize.width, petSize.height, view));
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const contextual = writerLabel ?? countryLabel;
  const primaryAction: PlanetMascotAction | null = step?.requiredScreen && step.requiredScreen !== screen
    ? step.requiredScreen === "globe" ? "return-globe" : "books" : step?.action ?? null;
  const actionLabel = (action: PlanetMascotAction) => ({
    search: ru ? "Поиск" : "Search", country: ru ? "Выбрать страну" : "Choose a country",
    writer: ru ? "Писатели страны" : "Country writers", books: ru ? "К книгам" : "Explore books",
    "writer-books": ru ? "Книги писателя" : "Books by this writer",
    appearance: ru ? "Оформление" : "Appearance", "return-globe": ru ? "К глобусу" : "Return to globe",
  })[action];
  const tipKind = screen === "collection" ? "collection" : writerLabel ? "writer" : countryLabel ? "country" : "globe";
  const helpTip = {
    globe: ru ? "Начните со страны на глобусе или найдите писателя через поиск. Могу показать путь от страны к книгам."
      : "Start with a country on the globe or search for a writer. I can show you the route from a country to books.",
    country: ru ? "Страна выбрана. В её архиве можно выбрать писателя, а затем перейти к его книгам."
      : "A country is selected. Choose a writer in its archive, then explore their books.",
    writer: ru ? "Писатель выбран. Откройте его книги или продолжите исследовать архив страны."
      : "A writer is selected. Open their books or keep exploring the country's archive.",
    collection: ru ? "Вы в коллекции. Здесь можно искать книги, менять фильтры и открывать карточки. К глобусу можно вернуться в любой момент."
      : "You are in the collection. Search books, adjust filters and open their details. You can return to the globe at any time.",
  }[tipKind];
  const authorFeedback = {
    idle: null,
    loading: ru ? "Готовим список книг писателя. Если открыта книга, закройте её, чтобы продолжить."
      : "Preparing the writer's books. If a book is open, close it to continue.",
    applied: ru ? "Список книг писателя готов." : "The writer's book list is ready.",
    "no-books": ru ? "В каталоге пока нет доступных книг этого писателя." : "This writer has no available books in the catalog yet.",
    "filtered-empty": ru ? "Выбранные фильтры скрывают книги этого писателя. Измените фильтры в коллекции и повторите попытку."
      : "The current filters hide this writer's books. Adjust the collection filters and try again.",
    invalid: ru ? "Выберите писателя заново, чтобы открыть его книги." : "Select the writer again to open their books.",
    "load-failed": ru ? "Не удалось загрузить книги. Повторите попытку." : "Could not load the books. Please try again.",
  }[snapshot.authorBooksStatus];
  const stepStatus = snapshot.canAdvance ? ru ? "Этот шаг готов — можно продолжить." : "This step is ready. You can continue."
    : step?.requiredScreen === "globe" && screen !== "globe" ? ru ? "Вернитесь к глобусу, чтобы продолжить." : "Return to the globe to continue."
    : snapshot.route === "country-to-book" && step?.requirement === "collection" && snapshot.authorBooksStatus !== "applied" && authorFeedback ? authorFeedback
    : step?.requiredScreen === "collection" && screen !== "collection" ? ru ? "Откройте коллекцию, чтобы продолжить." : "Open the collection to continue."
    : step?.requirement === "country" ? ru ? "Сначала выберите страну." : "Choose a country first."
    : step?.requirement === "writer" ? ru ? "Сначала выберите писателя в архиве страны." : "Choose a writer in the country's archive first."
    : ru ? "Откройте книги писателя, чтобы завершить этот шаг." : "Open the writer's books to complete this step.";

  if (!snapshot.available) return null;
  return <>
    {open && highlight && snapshot.highlight && <div className="planet-mascot-highlight" aria-hidden="true"
      data-planet-mascot-highlight={snapshot.highlight} style={highlight as CSSProperties} />}
    <div ref={root} className="planet-mascot-controls" data-planet-mascot-pet=""
      data-planet-mascot-active={shown ? "true" : "false"} data-planet-mascot-visibility={snapshot.visibility}
      data-planet-mascot-mode={snapshot.mode} data-planet-mascot-current-route={snapshot.route ?? "none"}
      data-planet-mascot-step={snapshot.step} data-planet-mascot-screen={screen}
      style={petPosition} onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()}
      onPointerMove={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        // Native collection owns its Tab loop; an already collapsed companion
        // must also let Escape reach that surrounding panel.
        if (event.key === "Tab") return;
        if (event.key === "Escape") {
          if (open) { event.preventDefault(); event.stopPropagation(); controller.togglePanel(); }
          return;
        }
        event.stopPropagation();
      }}>
      <button ref={toggle} type="button" className={shown ? "planet-mascot-controls__avatar-button" : "planet-mascot-controls__show"}
        data-planet-mascot-toggle="" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={shown ? ru ? `Подсказки: ${name}` : `Tips from ${name}` : ru ? `Показать: ${name}` : `Show ${name}`}
        onClick={() => controller.togglePanel()}>
        {shown ? <PlanetMascotAvatar src={mascotImage} mood={snapshot.completedRoute ? "celebrate" : snapshot.mode === "tour" ? "guiding" : "idle"} /> : name}
      </button>
      {shown && <div className="planet-mascot-controls__tools">
        <button type="button" data-planet-mascot-move="" className="planet-mascot-controls__move"
          aria-label={ru ? "Переместить помощника" : "Move the companion"} aria-describedby={`${id}-move`}
          title={ru ? "Перетащите или используйте стрелки. Home — исходное место." : "Drag or use arrow keys. Home resets the position."}
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return;
            event.preventDefault(); event.currentTarget.focus({ preventScroll: true });
            drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: petPosition };
            event.currentTarget.setPointerCapture(event.pointerId);
          }} onPointerMove={event => {
            const intent = drag.current; if (!intent || intent.pointerId !== event.pointerId) return;
            event.preventDefault(); move({ left: intent.origin.left + event.clientX - intent.x, top: intent.origin.top + event.clientY - intent.y });
          }} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }}
          onKeyDown={event => {
            if (event.key === "Home") { event.preventDefault(); onPositionChange(null); return; }
            const direction = arrowDirections[event.key];
            if (!direction) return;
            event.preventDefault(); const distance = event.shiftKey ? 30 : 10;
            move({ left: petPosition.left + direction[0] * distance, top: petPosition.top + direction[1] * distance });
          }}><span aria-hidden="true">↔</span></button>
        <button type="button" data-planet-mascot-hide="" onClick={() => controller.hide()}
          aria-label={ru ? "Скрыть помощника" : "Hide the companion"} title={ru ? "Скрыть" : "Hide"}>
          <span aria-hidden="true">×</span></button>
        <span id={`${id}-move`} className="planet-mascot-controls__sr-only">
          {ru ? "Перетащите кнопку или нажимайте стрелки. Home возвращает исходное положение."
            : "Drag this button or use the arrow keys. Home restores the default position."}
        </span>
      </div>}
      {open && <section ref={card} id={id} role="region" aria-labelledby={`${id}-title`} data-planet-mascot-panel=""
        className="planet-mascot-controls__panel" style={{ left: cardPosition.left, top: cardPosition.top,
          width: cardWidth, maxHeight: maxCardHeight }}>
        <header className="planet-mascot-controls__heading">
          <h2 id={`${id}-title`} ref={heading} tabIndex={-1}>{name}</h2>
          <button type="button" data-planet-mascot-collapse="" onClick={() => controller.togglePanel()}
            aria-label={ru ? "Свернуть подсказки" : "Collapse tips"}>×</button>
        </header>
        {contextual && <p className="planet-mascot-controls__context">{ru ? "Выбрано: " : "Selected: "}{contextual}</p>}
        {tour && step ? <>
          <p className="planet-mascot-controls__progress">
            {ru ? `Шаг ${snapshot.step + 1} из ${tour.steps.length}` : `Step ${snapshot.step + 1} of ${tour.steps.length}`}
          </p>
          <h3 ref={tourHeading} tabIndex={-1}>{step.title[language]}</h3><p>{step.body[language]}</p>
          <p className="planet-mascot-controls__feedback" data-planet-mascot-step-status={snapshot.canAdvance ? "ready" : "waiting"}
            data-planet-mascot-author-books-status={step.requirement === "collection" ? snapshot.authorBooksStatus : undefined}
            role="status" aria-live="polite" aria-atomic="true">{stepStatus}</p>
          {primaryAction && <button type="button" className="planet-mascot-controls__primary"
            data-planet-mascot-action={primaryAction} disabled={!controller.canAct(primaryAction)} onClick={() => perform(primaryAction)}>
            {primaryAction === step.action ? step.actionLabel?.[language] ?? actionLabel(primaryAction) : actionLabel(primaryAction)}
          </button>}
          <div className="planet-mascot-controls__navigation">
            <button type="button" data-planet-mascot-back="" disabled={snapshot.step === 0}
              onClick={() => navigateTips(() => controller.back(snapshot.revision))}>{ru ? "Назад" : "Back"}</button>
            <button type="button" data-planet-mascot-next="" disabled={!snapshot.canAdvance}
              onClick={() => navigateTips(() => controller.next(snapshot.revision))}>
              {snapshot.step + 1 === tour.steps.length ? ru ? "Готово" : "Done" : ru ? "Далее" : "Next"}
            </button>
          </div>
          <button type="button" data-planet-mascot-finish="" className="planet-mascot-controls__quiet"
            onClick={() => navigateTips(() => controller.finish(snapshot.revision))}>{ru ? "Выйти из маршрута" : "Leave the tour"}</button>
        </> : <>
          {snapshot.completedRoute && <p className="planet-mascot-controls__feedback" role="status" aria-live="polite"
            data-planet-mascot-completion={snapshot.completedRoute}>
            {ru ? `Маршрут «${PLANET_MASCOT_ROUTES[snapshot.completedRoute].title.ru}» завершён. Можно продолжить самостоятельно или выбрать другой.`
              : `The “${PLANET_MASCOT_ROUTES[snapshot.completedRoute].title.en}” tour is complete. Continue exploring or choose another tour.`}
          </p>}
          <p data-planet-mascot-context-tip={tipKind}>{helpTip}</p>
          {authorFeedback && <p className="planet-mascot-controls__feedback" role="status" aria-live="polite" aria-atomic="true"
            data-planet-mascot-author-books-status={snapshot.authorBooksStatus}>{authorFeedback}</p>}
          <div className="planet-mascot-controls__routes">
            {(["overview", "country-to-book"] as const).map(route => <button key={route} type="button"
              data-planet-mascot-route={route} onClick={() => navigateTips(() => controller.start(route))}>{PLANET_MASCOT_ROUTES[route].title[language]}</button>)}
          </div>
          <div className="planet-mascot-controls__actions">
            {(["search", "books", ...(countryLabel ? ["writer" as const] : []),
              ...(writerLabel ? ["writer-books" as const] : []),
              screen === "collection" ? "return-globe" : "appearance"] as PlanetMascotAction[]).map(action => (
              <button key={action} type="button" data-planet-mascot-action={action}
                disabled={!controller.canAct(action)} onClick={() => perform(action)}>{actionLabel(action)}</button>
            ))}
          </div>
        </>}
      </section>}
    </div>
  </>;
}
