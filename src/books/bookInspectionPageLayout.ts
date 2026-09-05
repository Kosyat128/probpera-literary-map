import type { BookEditorialDocument, BookEditorialPage } from "./bookEditorialPages";
import type { BookDossierDiagramPreview } from "./bookDossierDiagram";
import {
  BOOK_TYPOGRAPHY_VERSION,
  BookDossierSpacingTokens as spacing,
  BookDossierTypographyTokens as typography,
  ensureBookTypographyReady,
} from "./bookTypography";

export const BOOK_INSPECTION_LAYOUT_VERSION = "book-inspection-layout-v3" as const;
export type BookInspectionTextRole = "title" | "heading" | "body" | "metadata" | "caption";
export type BookInspectionTextCommand = Readonly<{
  text: string;
  x: number;
  y: number;
  width: number;
  role: BookInspectionTextRole;
  sourceId: string;
}>;
export type BookInspectionPageLayout = Readonly<{
  version: typeof BOOK_INSPECTION_LAYOUT_VERSION;
  sourcePageId: string;
  fragmentIndex: number;
  template: string;
  commands: readonly BookInspectionTextCommand[];
  diagram?: Readonly<{ preview: BookDossierDiagramPreview; x: number; y: number; width: number; height: number }>;
}>;
export type BookInspectionPresentationPage = BookEditorialPage & Readonly<{
  inspectionLayout: BookInspectionPageLayout;
}>;
export type BookInspectionTextMeasure = (text: string, role: BookInspectionTextRole) => number;
export type BookInspectionPaginationResult = Readonly<{
  status: "ready" | "needs-design-review" | "fonts-unavailable";
  document: BookEditorialDocument | null;
  sourceDocument: BookEditorialDocument;
  issues: readonly string[];
}>;

export function getBookInspectionPageLayout(page: BookEditorialPage) {
  if (!("inspectionLayout" in page)) return null;
  const layout = (page as BookInspectionPresentationPage).inspectionLayout;
  return layout.version === BOOK_INSPECTION_LAYOUT_VERSION ? layout : null;
}

export function bookInspectionFont(role: BookInspectionTextRole) {
  const token = typography[role];
  const family = role === "caption" || role === "metadata" ? typography.sans : typography.serif;
  return `${token.weight} ${token.size}px ${family}`;
}

function lineHeight(role: BookInspectionTextRole) {
  return typography[role].size * typography[role].leading;
}

/** Preserve complete text; only URLs may break inside a Latin word. */
export function wrapBookInspectionText(
  text: string,
  width: number,
  role: BookInspectionTextRole,
  measure: BookInspectionTextMeasure,
  allowUrlBreak = false
): readonly string[] | null {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (measure(word, role) > width) {
      const urlToken = /^(?:https?:\/\/|\/(?!\/)|\.\.?\/|#)/iu.test(word);
      const domainToken = /^(?:[a-z\d-]+\.)+[a-z]{2,}$/iu.test(word);
      if (!allowUrlBreak && !urlToken && !domainToken && !/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(word)) return null;
      if (current) lines.push(current);
      current = "";
      const units = domainToken ? (word.match(/[^.]+\.?/gu) || [word]).flatMap(part => measure(part, role) <= width ? [part] : Array.from(part)) : Array.from(word);
      for (const glyph of units) {
        if (measure(current + glyph, role) > width) {
          if (!current) return null;
          lines.push(current);
          current = "";
        }
        current += glyph;
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, role) <= width) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return Object.freeze(lines);
}

/** Pure pagination in one design coordinate system, independent of raster quality. */
export function layoutBookInspectionDocument(
  document: BookEditorialDocument,
  measure: BookInspectionTextMeasure,
  options: Readonly<{ maximumPages?: number }> = {}
): BookInspectionPaginationResult {
  const maximumPages = Math.min(36, Math.max(1, options.maximumPages ?? 18));
  const pages: BookInspectionPresentationPage[] = [];
  const issues: string[] = [];
  const width = spacing.designWidth - spacing.outer - spacing.gutter;
  const bottom = spacing.designHeight - spacing.bottom - typography.folio.size * 2;
  for (const sourcePage of document.pages) {
    const template = sourcePage.template || ({ identity: "title", details: "passport", description: "essay", provenance: "sources" }[sourcePage.id] ?? "essay");
    const titleRole = template === "title" ? "title" : "heading";
    const titleLines = wrapBookInspectionText(sourcePage.title, width, titleRole, measure);
    const eyebrowLines = wrapBookInspectionText(sourcePage.eyebrow, width, "caption", measure);
    if (!titleLines || !eyebrowLines) {
      issues.push(`${sourcePage.id}: heading exceeds its safe measure`);
      continue;
    }
    let fragmentIndex = 0;
    let commands: BookInspectionTextCommand[] = [];
    let diagram: BookInspectionPageLayout["diagram"];
    let y = 0;
    const startFragment = () => {
      commands = [];
      diagram = undefined;
      y = spacing.top + typography.caption.size + spacing.baseline;
      if (fragmentIndex > 0) {
        // A complete running title leaves continuation pages room for reading.
        const runningTitle = wrapBookInspectionText(sourcePage.title, width, "caption", measure)!;
        for (const text of runningTitle) {
          commands.push({ text, x: 0, y, width, role: "caption", sourceId: `${sourcePage.id}:title` });
          y += lineHeight("caption");
        }
        y += spacing.section;
        return;
      }
      for (const text of eyebrowLines) {
        commands.push({ text, x: 0, y, width, role: "caption", sourceId: `${sourcePage.id}:eyebrow` });
        y += lineHeight("caption");
      }
      y += spacing.paragraph + typography[titleRole].size;
      for (const text of titleLines) {
        commands.push({ text, x: 0, y, width, role: titleRole, sourceId: `${sourcePage.id}:title` });
        y += lineHeight(titleRole);
      }
      y += spacing.section;
    };
    const finishFragment = () => {
      const index = pages.length;
      const leftInset = index % 2 === 0 ? spacing.outer : spacing.gutter;
      pages.push(Object.freeze({
        ...sourcePage,
        id: fragmentIndex === 0 ? sourcePage.id : `${sourcePage.id}:continuation:${fragmentIndex}`,
        index,
        // Source text and semantic anchors remain intact; commands are a view.
        inspectionLayout: Object.freeze({
          version: BOOK_INSPECTION_LAYOUT_VERSION,
          sourcePageId: sourcePage.id,
          fragmentIndex,
          template,
          ...(diagram ? { diagram: { ...diagram, x: diagram.x + leftInset } } : {}),
          commands: Object.freeze(commands.map((command) => Object.freeze({ ...command, x: command.x + leftInset }))),
        }),
      }));
      fragmentIndex += 1;
    };
    startFragment();
    const headerBottom = y;
    if (headerBottom + lineHeight("body") * 2 > bottom) {
      issues.push(`${sourcePage.id}: heading leaves no readable body area`);
      continue;
    }
    const write = (text: string, role: BookInspectionTextRole, sourceId: string, allowUrlBreak = false) => {
      const lines = wrapBookInspectionText(text, width, role, measure, allowUrlBreak);
      if (!lines) {
        issues.push(`${sourceId}: unbreakable text exceeds its safe measure`);
        return;
      }
      const step = lineHeight(role);
      // Keep at least two lines together across a page turn.
      let offset = 0;
      while (offset < lines.length) {
        let available = Math.floor((bottom - y) / step) + 1;
        const remaining = lines.length - offset;
        if (available < Math.min(2, remaining)) {
          finishFragment();
          startFragment();
          available = Math.floor((bottom - y) / step) + 1;
        }
        let take = Math.min(available, remaining);
        if (remaining - take === 1 && take > 2) take -= 1;
        for (const line of lines.slice(offset, offset + take)) {
          commands.push({ text: line, x: 0, y, width, role, sourceId });
          y += step;
        }
        offset += take;
        if (offset < lines.length) {
          finishFragment();
          startFragment();
        }
        if (pages.length > maximumPages) return;
      }
      y += spacing.paragraph;
    };
    if (sourcePage.diagram) {
      const height = 300;
      if (y + height + lineHeight("caption") > bottom) { finishFragment(); startFragment(); }
      diagram = { preview: sourcePage.diagram, x: 0, y: y - typography.caption.size, width, height };
      y += height;
      for (const node of sourcePage.diagram.nodes) write(`${node.number}. ${node.label}`, "caption", `${node.id}:map-label`);
      for (const group of sourcePage.diagram.groups) {
        const numbers = sourcePage.diagram.nodes.filter(node => node.groupIndex === group.index).map(node => node.number).join(", ");
        write(`${numbers}: ${group.label}`, "caption", `${group.id}:map-group`);
      }
      write(document.locale === "en" ? "Read dossier: open the complete map and relationship details." : "Читать досье: полная схема и описание связей.", "caption", `${sourcePage.id}:map-reader`);
    }
    for (const [index, row] of sourcePage.rows.entries()) {
      // The physical preview is bounded; complete public items remain in the DOM and semantic page.
      if (sourcePage.diagram && ["characters", "relationships"].includes(row.kind)) continue;
      const sourceId = row.id || `${sourcePage.id}:row:${index}`;
      const namedEntry = ["characters", "relationships", "themes", "related-articles", "legal-reading"].includes(template);
      const labelRole = namedEntry ? "heading" : "caption";
      const valueRole = template === "title" || namedEntry || template === "key-points" ? "body" : "metadata";
      if (["passport", "timeline", "contents"].includes(template)) {
        const labelWidth = Math.round(width * .28);
        const valueX = labelWidth + spacing.paragraph;
        const columnLabel = wrapBookInspectionText(row.label, labelWidth, "caption", measure);
        const columnValue = wrapBookInspectionText(row.value, width - valueX, "metadata", measure);
        const columnHeight = Math.max((columnLabel?.length ?? 0) * lineHeight("caption"), (columnValue?.length ?? 0) * lineHeight("metadata")) + spacing.paragraph;
        if (columnLabel && columnValue && columnHeight <= bottom - headerBottom) {
          if (y + columnHeight > bottom) {
            finishFragment();
            startFragment();
          }
          columnLabel.forEach((text, line) => commands.push({ text, x: 0, y: y + line * lineHeight("caption"), width: labelWidth, role: "caption", sourceId: `${sourceId}:label` }));
          columnValue.forEach((text, line) => commands.push({ text, x: valueX, y: y + line * lineHeight("metadata"), width: width - valueX, role: "metadata", sourceId }));
          y += columnHeight;
          continue;
        }
        // An unusually large entry keeps all text in the flowing template.
      }
      // A label always travels with the first two value lines.
      const labelLines = wrapBookInspectionText(row.label, width, labelRole, measure);
      const valueLines = wrapBookInspectionText(row.value, width, valueRole, measure);
      const rowOpeningHeight = (labelLines?.length ?? 1) * lineHeight(labelRole) + spacing.paragraph +
        Math.min(2, valueLines?.length ?? 1) * lineHeight(valueRole);
      if (y > headerBottom && y + rowOpeningHeight > bottom) {
        finishFragment();
        startFragment();
      }
      write(row.label, labelRole, `${sourceId}:label`);
      write(row.value, valueRole, sourceId);
    }
    for (const [index, paragraph] of sourcePage.paragraphs.entries()) {
      write(paragraph, template === "colophon" ? "metadata" : "body", `${sourcePage.id}:paragraph:${index}`);
    }
    for (const [index, source] of sourcePage.sources.entries()) {
      const sourceId = source.id || `${sourcePage.id}:source:${index}`;
      write(source.provider, "caption", `${sourceId}:provider`);
      const title = "title" in source && typeof source.title === "string" ? source.title : "";
      const attribution = "attribution" in source && typeof source.attribution === "string" ? source.attribution : "";
      if (title && title !== source.provider) write(title, "metadata", `${sourceId}:title`);
      write([source.usageLabel, source.license, source.rightsHolder, attribution].filter(Boolean).join(" · "), "metadata", `${sourceId}:rights`);
      // The complete destination stays in page.sources and the accessible link.
      // Printed provenance uses its readable domain instead of a technical path.
      const domain = new URL(source.sourceUrl).hostname.replace(/^www\./u, "");
      write(domain, "metadata", `${sourceId}:domain`, true);
    }
    finishFragment();
    if (pages.length > maximumPages) {
      issues.push(`Pagination exceeds the ${maximumPages}-page design limit`);
      break;
    }
  }
  if (issues.length) return Object.freeze({ status: "needs-design-review", document: null, sourceDocument: document, issues: Object.freeze(issues) });
  return Object.freeze({
    status: "ready",
    sourceDocument: document,
    document: Object.freeze({
      ...document,
      cacheKey: `${document.cacheKey}|${BOOK_TYPOGRAPHY_VERSION}|${BOOK_INSPECTION_LAYOUT_VERSION}`,
      pages: Object.freeze(pages),
    }),
    issues: Object.freeze([]),
  });
}

export async function paginateBookInspectionDocument(
  document: BookEditorialDocument,
  options: Readonly<{ maximumPages?: number }> = {}
): Promise<BookInspectionPaginationResult> {
  if (!await ensureBookTypographyReady()) {
    return { status: "fonts-unavailable", document: null, sourceDocument: document, issues: ["Local book fonts are unavailable"] };
  }
  const context = globalThis.document.createElement("canvas").getContext("2d");
  if (!context) return { status: "needs-design-review", document: null, sourceDocument: document, issues: ["Canvas text measurement is unavailable"] };
  return layoutBookInspectionDocument(document, (text, role) => {
    context.font = bookInspectionFont(role);
    return context.measureText(text).width;
  }, options);
}
