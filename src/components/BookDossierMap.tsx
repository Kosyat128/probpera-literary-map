import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { bookDossierDiagramHeight, bookDossierDiagramPoint, bookDossierDiagramPreview, type BookDossierDiagram, type BookDossierDiagramPreview } from "../books/bookDossierDiagram";
import type { BookDossierItem, BookDossierPublicSource } from "../books/bookDossierDocument";

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
export default function BookDossierMap({ diagram, locale }: { diagram: BookDossierDiagram; locale: "ru" | "en" }) {
  const copy = copyByLocale[locale];
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(diagram.nodes[0].item.id);
  const [filter, setFilter] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const titleId = useId(), detailId = useId();
  const preview = bookDossierDiagramPreview(diagram);
  const fullPreview = bookDossierDiagramPreview(diagram, 8);
  const selectedNode = diagram.nodes.find(node => node.item.id === selectedId);
  const selectedEdge = diagram.edges.find(edge => edge.item.id === selectedId);
  const selected = selectedNode || selectedEdge || diagram.nodes[0];
  const filteredNodes = diagram.nodes.filter(node => `${node.item.label} ${node.item.value || ""}`.toLocaleLowerCase(locale).includes(filter.toLocaleLowerCase(locale).trim()));
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    closeRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);
  const close = () => dialogRef.current?.close();
  const select = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 639px)").matches) requestAnimationFrame(() => {
      const detail = detailRef.current;
      const bounds = detail?.getBoundingClientRect();
      if (bounds && (bounds.top >= window.innerHeight || bounds.bottom <= 0)) detail?.scrollIntoView({ block: "nearest" });
    });
  };
  const restore = () => {
    setOpen(false);
    if (triggerRef.current?.isConnected) triggerRef.current.focus({ preventScroll: true });
  };
  return <div className="book-dossier-map" data-section-anchor={diagram.anchor.sectionId}>
    <button className="book-dossier-map__preview" ref={triggerRef} type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <BookDossierMapDrawing preview={preview} />
      <span className="book-dossier-map__preview-labels">{preview.nodes.map(node => <span key={node.id}>{node.number}. {node.label}</span>)}</span>
      <span className="book-dossier-map__open-label">{copy.open} <span aria-hidden="true">↗</span></span>
      <span className="book-dossier-map__count">{copy.shown}: {preview.nodes.length} / {diagram.nodes.length}</span>
    </button>
    {open ? createPortal(<dialog className="book-dossier-reader book-dossier-map-dialog" ref={dialogRef} aria-labelledby={titleId}
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
        <aside className="book-dossier-map__detail" ref={detailRef} id={detailId} aria-live="polite" aria-atomic="true">
          <span className="book-dossier-map__count">{copy.details}</span><h3>{selected.item.label}</h3>
          {selectedNode ? <p className="book-dossier-map__count">{selectedNode.groupLabel}</p> : null}
          {selectedEdge ? <p>{selectedEdge.from.item.label} → {selectedEdge.to.item.label}</p> : null}
          <PublicItemDetails item={selected.item} sources={selected.sources} sourceLabel={copy.source} />
        </aside>
      </div>
    </dialog>, document.body) : null}
  </div>;
}
