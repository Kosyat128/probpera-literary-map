import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import { bookDossierDiagramHeight, bookDossierDiagramPoint, bookDossierDiagramPreview, type BookDossierDiagram, type BookDossierDiagramPreview } from "../books/bookDossierDiagram";
import type { BookDossierDocumentV2, BookDossierItem, BookDossierPublicSource } from "../books/bookDossierDocument";
import { bookDossierCharacterRequestToken, consumeBookDossierCharacterViewToken, resolveBookDossierCharacterView,
  sameBookDossierCharacterView, type BookDossierCharacterViewRequest, type BookDossierCharacterViewReceipt,
  type BookDossierCharacterViewTarget, type BookDossierCharacterViewToken } from "../books/bookDossierCharacterView";

const copyByLocale = {
  ru: { open: "Открыть схему", close: "Закрыть", people: "Персонажи", relations: "Связи", groups: "Группы и обозначения", relation: "Связь", details: "Сведения", sources: "Источники", source: "Открыть источник", shown: "На схеме", list: "Полный список", find: "Найти персонажа", noMatches: "Нет совпадений" },
  en: { open: "Open map", close: "Close", people: "Characters", relations: "Relationships", groups: "Groups and legend", relation: "Relationship", details: "Details", sources: "Sources", source: "Open source", shown: "Shown in the map", list: "Complete list", find: "Find a character", noMatches: "No matches" },
};

function SymbolShape({ x, y, group, radius = 24 }: { x: number; y: number; group: number; radius?: number }) {
  if (group % 3 === 1) return <rect x={x - radius} y={y - radius} width={radius * 2} height={radius * 2} rx={4} />;
  if (group % 3 === 2) return <path d={`M ${x} ${y - radius - 4} L ${x + radius + 4} ${y} L ${x} ${y + radius + 4} L ${x - radius - 4} ${y} Z`} />;
  return <circle cx={x} cy={y} r={radius} />;
}

export function BookDossierMapDrawing({ preview }: { preview: BookDossierDiagramPreview }) {
  const marker = useId();
  const points = new Map(preview.nodes.map((node, index) => [node.number, bookDossierDiagramPoint(index, preview.nodes.length)]));
  return <svg className="book-dossier-map__drawing" viewBox={`0 0 400 ${bookDossierDiagramHeight(preview.nodes.length)}`} aria-hidden="true">
    <defs><marker id={marker} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="currentColor" /></marker></defs>
    <g className="book-dossier-map__lines">{preview.edges.map((edge, index) => {
      const from = points.get(edge.from)!, to = points.get(edge.to)!;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const dx = length ? (to.x - from.x) / length : 0, dy = length ? (to.y - from.y) / length : 0;
      const d = length ? `M${from.x + dx * 28} ${from.y + dy * 28}L${to.x - dx * 32} ${to.y - dy * 32}`
        : `M${from.x - 18} ${from.y - 20}C${from.x - 60} ${from.y - 80} ${from.x + 60} ${from.y - 80} ${from.x + 18} ${from.y - 20}`;
      return <path key={index} d={d} markerEnd={`url(#${marker})`} />;
    })}</g>
    {preview.nodes.map(node => {
      const point = points.get(node.number)!;
      return <g className="book-dossier-map__symbol" key={node.id}>
        <SymbolShape x={point.x} y={point.y} group={node.groupIndex} />
        <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central">{node.number}</text>
      </g>;
    })}
  </svg>;
}

function PublicItemDetails({ item, sources, sourceLabel }: { item: BookDossierItem; sources: readonly BookDossierPublicSource[]; sourceLabel: string }) {
  return <>
    {item.value ? <p>{item.value}</p> : null}
    {item.text && item.text !== item.value ? <p>{item.text}</p> : null}
    {item.href ? <p><a href={item.href} rel="noreferrer">{sourceLabel}</a></p> : null}
    {sources.length ? <ul className="book-dossier-map__sources">{sources.map(source => <li key={source.id}>
      <a href={source.sourceUrl} rel="noreferrer">{source.title || source.provider}</a>
      {source.attribution ? <p>{source.attribution}</p> : null}
    </li>)}</ul> : null}
  </>;
}

/** The full map and details use the public document; selection does not navigate it. */
export default function BookDossierMap({ diagram, locale, characterDocument, characterRequest, onCharacterViewChange }: {
  diagram: BookDossierDiagram; locale: "ru" | "en";
  characterDocument?: BookDossierDocumentV2 | null;
  characterRequest?: BookDossierCharacterViewRequest | null;
  /** UI observation only. A future journey bridge needs a caller-owned action
   * inside this modal; a Next button behind a native dialog is inert. */
  onCharacterViewChange?: (view: BookDossierCharacterViewReceipt | null) => void;
}) {
  const copy = copyByLocale[locale];
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(diagram.nodes[0].item.id);
  const [filter, setFilter] = useState("");
  const [, invalidateView] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  // Native close may be followed by an intentional outside focus change before
  // its queued event arrives. Only our Close/Escape or owned invalidation may
  // request an additional trigger-focus restoration.
  const restoreFocus = useRef(false);
  const closingFocusOwned = useRef(false);
  const titleId = useId(), detailId = useId();
  const callback = useRef(onCharacterViewChange); callback.current = onCharacterViewChange;
  const activation = useRef<BookDossierCharacterViewTarget | null>(null);
  const handledToken = useRef<BookDossierCharacterViewToken | null>(null);
  const reported = useRef<BookDossierCharacterViewReceipt | null>(null);
  const token = bookDossierCharacterRequestToken(characterRequest);
  const target = useMemo(() => characterDocument?.locale === locale
    ? resolveBookDossierCharacterView(characterDocument, diagram, characterRequest, Date.now()) : null,
  [characterDocument, diagram, characterRequest, locale]);
  const report = useCallback((view: BookDossierCharacterViewReceipt | null) => {
    if (reported.current === null && view === null || reported.current && view && sameBookDossierCharacterView(reported.current, view)) return;
    reported.current = view;
    callback.current?.(view);
  }, []);
  const revoke = useCallback((closeDialog: boolean) => {
    const owned = activation.current !== null;
    activation.current = null;
    if (owned) invalidateView(value => value + 1);
    if (owned && closeDialog) {
      restoreFocus.current = (!!dialogRef.current?.contains(document.activeElement) || closingFocusOwned.current)
        && document.visibilityState !== "hidden";
      closingFocusOwned.current = false;
      setOpen(false); dialogRef.current?.close();
      if (restoreFocus.current && triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
    }
    report(null);
  }, [report]);
  const preview = bookDossierDiagramPreview(diagram);
  const fullPreview = bookDossierDiagramPreview(diagram, 8);
  const selectedNode = diagram.nodes.find(node => node.item.id === selectedId);
  const selectedEdge = diagram.edges.find(edge => edge.item.id === selectedId);
  const selected = selectedNode || selectedEdge || (activation.current ? null : diagram.nodes[0]);
  const requestedCurrent = !activation.current || !!target && sameBookDossierCharacterView(activation.current.receipt, target.receipt);
  const visible = open && requestedCurrent;
  const filteredNodes = diagram.nodes.filter(node => `${node.item.label} ${node.item.value || ""}`.toLocaleLowerCase(locale).includes(filter.toLocaleLowerCase(locale).trim()));
  useLayoutEffect(() => {
    if (!token) {
      revoke(true);
      if (characterRequest) setOpen(false);
      return;
    }
    if (handledToken.current !== token) {
      handledToken.current = token;
      const fresh = consumeBookDossierCharacterViewToken(token);
      revoke(false); setOpen(false);
      if (fresh && target && target.expiresAt > Date.now() && document.visibilityState !== "hidden") {
        activation.current = target;
        restoreFocus.current = false;
        setSelectedId(target.node.item.id); setFilter(""); setOpen(true);
      }
    } else if (activation.current) {
      if (!target || !sameBookDossierCharacterView(activation.current.receipt, target.receipt) || target.expiresAt <= Date.now()) revoke(true);
      else activation.current = target;
    }
  }, [token, target, characterRequest, revoke]);
  useLayoutEffect(() => {
    if (!visible) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    closingFocusOwned.current = false;
    if (!dialog.open) dialog.showModal();
    closeRef.current?.focus();
    return () => {
      // Ref detachment can precede invalidation effects. Capture focus while
      // the old dialog still exists, before native close restores its opener.
      closingFocusOwned.current = dialog.contains(document.activeElement);
      if (dialog.open) dialog.close();
    };
  }, [visible]);
  useLayoutEffect(() => {
    const current = activation.current;
    if (visible && dialogRef.current?.open && current && target && sameBookDossierCharacterView(current.receipt, target.receipt)
      && selectedNode === target.node && selectedId === target.receipt.anchor.itemId
      && target.expiresAt > Date.now() && document.visibilityState !== "hidden") report(target.receipt);
    else report(null);
  }, [visible, target, selectedId, selectedNode, report]);
  useEffect(() => {
    const current = activation.current;
    if (!current || !visible) return;
    const timer = window.setTimeout(() => revoke(true), Math.max(0, current.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [visible, target, selectedId, revoke]);
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === "hidden") revoke(true); };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [revoke]);
  useLayoutEffect(() => () => { activation.current = null; report(null); }, [report]);
  const close = () => { restoreFocus.current = true; revoke(false); dialogRef.current?.close(); };
  const select = (id: string) => {
    revoke(false);
    setSelectedId(id);
    if (window.matchMedia("(max-width: 639px)").matches) requestAnimationFrame(() => {
      const detail = detailRef.current;
      const bounds = detail?.getBoundingClientRect();
      if (bounds && (bounds.top >= window.innerHeight || bounds.bottom <= 0)) detail?.scrollIntoView({ block: "nearest" });
    });
  };
  const restore = (event: SyntheticEvent<HTMLDialogElement>) => {
    // An older removed dialog can deliver a queued close after a new explicit
    // request opens its replacement. That event does not own the current view.
    if (event.currentTarget !== dialogRef.current || event.currentTarget.open) return;
    revoke(false);
    setOpen(false);
    if (restoreFocus.current && triggerRef.current?.isConnected && document.visibilityState !== "hidden") triggerRef.current.focus({ preventScroll: true });
  };
  return <div className="book-dossier-map" data-section-anchor={diagram.anchor.sectionId}>
    <button className="book-dossier-map__preview" ref={triggerRef} type="button" aria-haspopup="dialog"
      onClick={() => { restoreFocus.current = false; setOpen(true); }}>
      <BookDossierMapDrawing preview={preview} />
      <span className="book-dossier-map__preview-labels">{preview.nodes.map(node => <span key={node.id}>{node.number}. {node.label}</span>)}</span>
      <span className="book-dossier-map__open-label">{copy.open} <span aria-hidden="true">↗</span></span>
      <span className="book-dossier-map__count">{copy.shown}: {preview.nodes.length} / {diagram.nodes.length}</span>
    </button>
    {visible ? createPortal(<dialog className="book-dossier-reader book-dossier-map-dialog" ref={dialogRef} aria-labelledby={titleId}
      onClose={restore} onCancel={event => { event.preventDefault(); close(); }}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <header className="book-dossier-map-dialog__header"><h2 id={titleId}>{diagram.title}</h2><button type="button" ref={closeRef} onClick={close}>{copy.close}</button></header>
      <div className="book-dossier-map-dialog__workspace">
        <div>
          <div className="book-dossier-map__interactive-drawing">
            <BookDossierMapDrawing preview={fullPreview} />
            {fullPreview.nodes.map((node, index) => {
              const point = bookDossierDiagramPoint(index, fullPreview.nodes.length);
              return <button className="book-dossier-map__node" type="button" key={node.id}
                style={{ left: `${point.x / 4}%`, top: `${point.y / bookDossierDiagramHeight(fullPreview.nodes.length) * 100}%` }}
                aria-label={node.label} aria-pressed={selectedId === node.id} aria-controls={detailId}
                onClick={() => select(node.id)} />;
            })}
          </div>
          <p className="book-dossier-map__count">{copy.shown}: {fullPreview.nodes.length} / {diagram.nodes.length}</p>
          <h3>{copy.groups}</h3>
          <ul className="book-dossier-map__legend">{diagram.groups.map(group => <li key={group.id}>
            <svg viewBox="-32 -32 64 64" aria-hidden="true"><g className="book-dossier-map__symbol"><SymbolShape x={0} y={0} group={group.index} /></g></svg><span>{group.label}</span>
          </li>)}<li><span aria-hidden="true">→</span><span>{copy.relation}</span></li></ul>
          <h3>{copy.list}</h3>
          {diagram.nodes.length > 8 ? <label className="book-dossier-map__search"><span>{copy.find}</span><input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label> : null}
          {diagram.groups.map(group => <section className="book-dossier-map__group" key={group.id}>
            <h4>{group.label}</h4><ul>{filteredNodes.filter(node => node.groupId === group.id).map(node => <li key={node.item.id}>
              <button type="button" aria-pressed={selectedId === node.item.id} aria-controls={detailId} onClick={() => select(node.item.id)}>
                <span className="book-dossier-map__number" aria-hidden="true">{node.number}</span><span>{node.item.label}</span>
              </button>
            </li>)}</ul>
          </section>)}
          {!filteredNodes.length ? <p role="status">{copy.noMatches}</p> : null}
          {diagram.edges.length ? <section className="book-dossier-map__group"><h3>{copy.relations}</h3><ul>{diagram.edges.map(edge => <li key={edge.item.id}>
            <button type="button" aria-pressed={selectedId === edge.item.id} aria-controls={detailId} onClick={() => select(edge.item.id)}>
              <span><strong>{edge.item.label}</strong><span className="book-dossier-map__endpoints">{edge.from.item.label} → {edge.to.item.label}</span></span>
            </button>
          </li>)}</ul></section> : null}
        </div>
        {selected && <aside className="book-dossier-map__detail" ref={detailRef} id={detailId} aria-live="polite" aria-atomic="true"
          data-dossier-character-view={activation.current?.receipt.anchor.itemId ?? ""}>
          <span className="book-dossier-map__count">{copy.details}</span><h3>{selected.item.label}</h3>
          {selectedNode ? <p className="book-dossier-map__count">{selectedNode.groupLabel}</p> : null}
          {selectedEdge ? <p>{selectedEdge.from.item.label} → {selectedEdge.to.item.label}</p> : null}
          <PublicItemDetails item={selected.item} sources={selected.sources} sourceLabel={copy.source} />
        </aside>}
      </div>
    </dialog>, document.body) : null}
  </div>;
}
