import { useState } from "react";
import type { BookDossierDocumentV2, BookDossierReadingMode, BookDossierSemanticAnchor } from "../books/bookDossierDocument";
import { buildBookDossierDiagram, bookDossierConceptKind, bookDossierConceptLabels } from "../books/bookDossierDiagram";
import BookDossierMap from "./BookDossierMap";

const modes: readonly BookDossierReadingMode[] = ["BEFORE_READING", "DURING_READING", "AFTER_READING"];
const modeLabels = {
  ru: ["До чтения", "Читаю", "После чтения"],
  en: ["Before reading", "Reading", "After reading"],
};
const accessibleLabels = {
  ru: { mode: "Режим чтения", contents: "Оглавление досье", previous: "Предыдущий раздел", next: "Следующий раздел", link: "Открыть источник" },
  en: { mode: "Reading mode", contents: "Dossier contents", previous: "Previous section", next: "Next section", link: "Open source" },
};

/** The accessible reader receives only the compiler's public projection. */
export default function BookDossierReader({ dossier, activeAnchor, onNavigate, onReadingModeChange,
  onSpoilersChange, onProgressChange, reachedCount = 0, showingSpoilers = false, unavailable = false, busy = false }: {
  dossier: BookDossierDocumentV2;
  activeAnchor?: BookDossierSemanticAnchor | null;
  onNavigate: (anchor: BookDossierSemanticAnchor) => void;
  onReadingModeChange?: (mode: BookDossierReadingMode) => void;
  onSpoilersChange?: (show: boolean) => void;
  onProgressChange?: (count: number) => void;
  reachedCount?: number;
  showingSpoilers?: boolean;
  unavailable?: boolean;
  busy?: boolean;
}) {
  const [contentsOpen, setContentsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const en = dossier.locale === "en";
  const labels = accessibleLabels[dossier.locale];
  const index = Math.max(0, dossier.pages.findIndex(page =>
    page.anchor.blockId === activeAnchor?.blockId && page.sectionId === activeAnchor?.sectionId));
  const page = dossier.pages[index];
  if (!page) return null;
  const label = en ? "Book dossier" : "Досье книги";
  const rowIds = new Set(page.rows.map(row => row.id));
  const diagram = buildBookDossierDiagram(dossier, page);
  const mappedIds = new Set(diagram ? [...diagram.nodes.map(node => node.item.id), ...diagram.edges.map(edge => edge.item.id)] : []);
  const concepts = page.blocks.filter(block => block.kind === "themes");
  const conceptIds = new Set(concepts.flatMap(block => block.items.map(item => item.id)));
  const interactiveItems = page.blocks.flatMap(block => block.items.filter(item =>
    block.kind !== "relationships" || (!item.fromId && !item.toId) || mappedIds.has(item.id)))
    .filter(item => !rowIds.has(item.id) && !mappedIds.has(item.id) && !conceptIds.has(item.id));
  const searchable = interactiveItems.length > 5;
  const selectedItems = filter.trim() ? interactiveItems.filter(item =>
    `${item.label} ${item.text || ""} ${item.value || ""}`.toLocaleLowerCase(dossier.locale)
      .includes(filter.trim().toLocaleLowerCase(dossier.locale))) : interactiveItems;
  const navigate = (target: number) => {
    const next = dossier.pages[target];
    if (next) { setFilter(""); onNavigate(next.anchor); }
  };
  return (
    <section className="book-dossier-reader" tabIndex={-1} aria-label={label} aria-busy={busy}>
      <header className="book-dossier-reader__header">
        <span>{label}</span>
        <button type="button" aria-expanded={contentsOpen} aria-controls="book-dossier-contents"
          onClick={() => setContentsOpen(value => !value)}>{en ? "Contents" : "Оглавление"}</button>
      </header>
      {onReadingModeChange && dossier.tier ? (
        <div className="book-dossier-reader__modes" role="group" aria-label={labels.mode}>
          {modes.map((mode, modeIndex) => <button type="button" key={mode}
            aria-pressed={dossier.readingMode === mode} disabled={busy}
            onClick={() => onReadingModeChange(mode)}>{modeLabels[dossier.locale][modeIndex]}</button>)}
        </div>
      ) : null}
      {dossier.tier && dossier.readingMode === "DURING_READING" && dossier.progressSteps?.length && onProgressChange ? (
        <label className="book-dossier-reader__progress"><span>{en ? "Read through" : "Прочитано до"}</span>
          <select value={Math.min(dossier.progressSteps.length, Math.max(0, reachedCount))} disabled={busy}
            onChange={event => onProgressChange(Number(event.target.value))}>
            <option value={0}>{en ? "Not started" : "До начала"}</option>
            {dossier.progressSteps.map((step, index) => <option key={step.id} value={index + 1}>{step.label}</option>)}
          </select>
        </label>
      ) : null}
      {onSpoilersChange && dossier.tier && dossier.readingMode !== "BEFORE_READING" ? (
        <label className="book-dossier-reader__spoilers"><input type="checkbox" checked={showingSpoilers}
          disabled={busy} onChange={event => onSpoilersChange(event.target.checked)} />
          <span>{en ? "Show plot details, including the ending" : "Показывать сюжетные подробности, включая финал"}</span>
        </label>
      ) : null}
      {unavailable ? <p className="book-dossier-reader__notice" role="status">
        {en ? "This reading mode is not available yet. The spoiler-free dossier remains open." : "Этот режим пока недоступен. Открыто досье без спойлеров."}
      </p> : null}
      <nav id="book-dossier-contents" hidden={!contentsOpen} aria-label={labels.contents}>
        <ol>{dossier.contents.map(entry => (
          <li key={entry.id}><button type="button"
            aria-current={entry.anchor.sectionId === page.sectionId ? "location" : undefined}
            onClick={() => { setFilter(""); onNavigate(entry.anchor); setContentsOpen(false); }}>
            {entry.title}
          </button></li>
        ))}</ol>
      </nav>
      <div className="book-dossier-reader__page" data-template={page.template} data-section={page.sectionId}>
        <p className="book-dossier-reader__eyebrow">{page.eyebrow}</p>
        <h4>{page.title}</h4>
        {page.rows.length ? <dl>{page.rows.map((row, rowIndex) =>
          <div key={row.id || rowIndex}><dt>{row.label}</dt><dd>{row.value}</dd></div>
        )}</dl> : null}
        {page.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
        {diagram ? <BookDossierMap key={`${dossier.cacheKey}:${page.id}`} diagram={diagram} locale={dossier.locale} /> : null}
        {concepts.map(block => <section className="book-dossier-concepts" key={block.id} aria-label={block.title}>
          <h5>{block.title}</h5><ol>{block.items.map(item => {
            const kind = bookDossierConceptKind(item.value);
            return <li key={item.id}>
              {kind ? <span className="book-dossier-concepts__kind">{bookDossierConceptLabels[dossier.locale][kind]}</span> : null}
              <h6>{item.label}</h6>
              {item.value && !kind ? <p>{item.value}</p> : null}
              {item.text ? <p>{item.text}</p> : null}
              {item.href ? <a href={item.href} rel="noreferrer">{labels.link}</a> : null}
            </li>;
          })}</ol>
        </section>)}
        {searchable ? <label className="book-dossier-reader__search">
          <span>{en ? "Find in this section" : "Найти в разделе"}</span>
          <input type="search" value={filter} maxLength={120} onChange={event => setFilter(event.target.value)} />
        </label> : null}
        {selectedItems.length ? <ul className="book-dossier-reader__items">
          {selectedItems.map(item => <li key={item.id}>
            {item.text ? <details><summary>{item.label}{item.value ? ` · ${item.value}` : ""}</summary>
              <p>{item.text}</p>{item.href ? <a href={item.href} rel="noreferrer">{labels.link}</a> : null}</details>
              : item.href ? <p><a href={item.href} rel="noreferrer">{item.label}</a>{item.value ? ` · ${item.value}` : ""}</p>
                : <p><strong>{item.label}</strong>{item.value ? ` · ${item.value}` : ""}</p>}
          </li>)}
        </ul> : searchable ? <p role="status">{en ? "No matches in this section." : "В этом разделе ничего не найдено."}</p> : null}
        {page.sources.length ? <details className="book-dossier-reader__sources">
          <summary>{en ? "Sources and attribution" : "Источники и атрибуция"} · {page.sources.length}</summary>
          <ol>{page.sources.map(source => <li key={source.id}>
            <a href={source.sourceUrl} rel="noreferrer">{source.title || source.provider}</a>
            <span>{source.usageLabel}</span>
            {source.attribution ? <p>{source.attribution}</p> : null}
          </li>)}</ol>
        </details> : null}
      </div>
      <footer className="book-dossier-reader__pager">
        <button type="button" disabled={index === 0 || busy} onClick={() => navigate(index - 1)}
          aria-label={labels.previous}>←</button>
        <span aria-live="polite" aria-atomic="true">{en ? "Section" : "Раздел"} {index + 1} / {dossier.pages.length}</span>
        <button type="button" disabled={index === dossier.pages.length - 1 || busy} onClick={() => navigate(index + 1)}
          aria-label={labels.next}>→</button>
      </footer>
    </section>
  );
}
