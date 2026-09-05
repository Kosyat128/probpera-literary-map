import type { BookEditorialDocument, BookEditorialPage } from "../books/bookEditorialPages";
import { hyphenateSync as hyphenateRussian } from "hyphen/ru";
import { hyphenateSync as hyphenateEnglish } from "hyphen/en-us";

export const ARTICLE_BOOK_VERSION = "article-book-pages-v4";
export const ARTICLE_BOOK_PAGE = Object.freeze({ width: 1400, height: 2000, left: 136, right: 136, top: 182, bottom: 154 });
export type ArticleBookRole = "title" | "heading" | "body" | "caption" | "quote" | "list" | "table" | "pre";
export type ArticleBookRun = Readonly<{ text: string; bold?: boolean; italic?: boolean; href?: string; underline?: boolean; displayText?: string }>;
export type ArticleBookTree = Readonly<{ tag?: string; text?: string; attributes?: Readonly<Record<string, string>>; children?: readonly ArticleBookTree[] }>;
export type ArticleBookTextBlock = Readonly<{ kind: "text"; id: string; role: ArticleBookRole; runs: readonly ArticleBookRun[]; level?: number; listNumber?: number; ordered?: boolean; depth?: number }>;
export type ArticleBookImageBlock = Readonly<{ kind: "image"; id: string; src: string; alt: string; width?: number; height?: number; semanticHtml?: string; text?: string }>;
export type ArticleBookBlock = ArticleBookTextBlock | ArticleBookImageBlock;
export type ArticleBookTextStyle = Readonly<{ size: number; weight: number; italic: boolean; leading: number }>;
export type ArticleBookMeasure = (text: string, style: ArticleBookTextStyle) => number;
export type ArticleBookDrawRun = Readonly<{ run: ArticleBookRun; text: string; x: number; width: number }>;
export type ArticleBookTextCommand = Readonly<{ kind: "text"; block: ArticleBookTextBlock; runs: readonly ArticleBookRun[]; drawRuns: readonly ArticleBookDrawRun[]; justified: boolean; wordSpacing: number; finalLine: boolean; x: number; y: number; width: number; height: number; size: number; prefix?: string; prefixSize?: number }>;
export type ArticleBookImageCommand = Readonly<{ kind: "image"; block: ArticleBookImageBlock; x: number; y: number; width: number; height: number }>;
export type ArticleBookCommand = ArticleBookTextCommand | ArticleBookImageCommand;
export type ArticleBookPage = BookEditorialPage & Readonly<{ html: string; text: string; articleLayout: readonly ArticleBookCommand[] }>;
export type ArticleBookInput = Readonly<{ articleId: string; title: string; sectionLabel: string; html: string; coverUrl?: string; locale: "ru" | "en"; fontScale?: number }>;

const blocks = new Set(["p", "div", "section", "article", "header", "footer", "aside", "figure", "figcaption", "blockquote", "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "h1", "h2", "h3", "h4", "h5", "h6", "pre"]);
const ignored = new Set(["script", "style", "noscript", "template", "meta", "link", "source"]);

function browserTree(html: string): ArticleBookTree {
  const root = new DOMParser().parseFromString(html, "text/html").body;
  const convert = (node: Node): ArticleBookTree => node.nodeType === 3 ? { text: node.textContent || "" } : {
    tag: node instanceof Element && node.namespaceURI === "http://www.w3.org/2000/svg" ? node.localName : node.nodeName.toLowerCase(),
    attributes: node instanceof Element ? Object.fromEntries([...node.attributes].map(attribute => [attribute.name, attribute.value])) : {},
    children: [...node.childNodes].map(convert),
  };
  return convert(root);
}

function safeHref(value?: string) {
  return value && /^(?:https?:\/\/|mailto:|#|\/(?!\/)|\.\.?\/)/iu.test(value) ? value : undefined;
}

function treeText(node: ArticleBookTree): string {
  return node.text ?? (node.children || []).map(treeText).join("");
}

function svgMarkup(node: ArticleBookTree): string {
  if (node.text !== undefined) return escapeHtml(node.text);
  if (!node.tag || ignored.has(node.tag)) return "";
  const attributes = node.tag === "svg" ? {xmlns: "http://www.w3.org/2000/svg", "xmlns:xlink": "http://www.w3.org/1999/xlink", ...node.attributes} : node.attributes || {};
  return `<${node.tag}${Object.entries(attributes).filter(([name]) => !/^on/iu.test(name)).map(([name, value]) => ` ${name}="${escapeHtml(value)}"`).join("")}>${(node.children || []).map(svgMarkup).join("")}</${node.tag}>`;
}

/** The browser parses already-sanitized HTML. A tree adapter keeps the traversal testable without a browser. */
export function parseArticleBookHtml(html: string, readTree: (html: string) => ArticleBookTree = browserTree): readonly ArticleBookBlock[] {
  const result: ArticleBookBlock[] = [];
  let buffer: ArticleBookRun[] = [];
  let active: Omit<ArticleBookTextBlock, "kind" | "id" | "runs"> = { role: "body" };
  let sequence = 0;
  const flush = () => {
    if (buffer.some(run => run.text.trim())) result.push({ kind: "text", id: `block-${sequence++}`, ...active, runs: buffer });
    buffer = [];
  };
  const append = (text: string, marks: Omit<ArticleBookRun, "text">) => {
    const value = active.role === "pre" ? text : text.replace(/[^\S\n]+/gu, " ").replace(/\n/gu, " ");
    if (value) buffer.push({ text: value, ...marks });
  };
  function visit(node: ArticleBookTree, marks: Omit<ArticleBookRun, "text"> = {}, depth = 0, listNumber?: number, ordered?: boolean) {
    if (node.text !== undefined) { append(node.text, marks); return; }
    const tag = node.tag?.toLowerCase() || "body";
    if (ignored.has(tag)) return;
    const attributes = node.attributes || {};
    if (tag === "svg") {
      flush();
      const markup = svgMarkup(node);
      const viewBox = (attributes.viewBox || attributes.viewbox || "").split(/[\s,]+/u).map(Number);
      result.push({kind: "image", id: `image-${sequence++}`, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`, alt: attributes["aria-label"] || treeText(node), width: Number(attributes.width) || viewBox[2] || undefined, height: Number(attributes.height) || viewBox[3] || undefined, semanticHtml: markup, text: treeText(node)});
      return;
    }
    if (tag === "img") {
      flush();
      if (attributes.src) result.push({ kind: "image", id: `image-${sequence++}`, src: attributes.src, alt: attributes.alt || "", width: Number(attributes.width) || undefined, height: Number(attributes.height) || undefined });
      return;
    }
    if (tag === "br") { buffer.push({ text: "\n", ...marks }); return; }
    if (tag === "hr") { flush(); return; }
    const previous = active;
    if (blocks.has(tag)) {
      flush();
      active = /^h[1-6]$/u.test(tag) ? { role: tag === "h1" ? "title" : "heading", level: Number(tag[1]) } :
        tag === "figcaption" ? { role: "caption" } : tag === "blockquote" ? { role: "quote" } :
        tag === "li" ? { role: "list", depth, listNumber, ordered } :
        tag === "td" || tag === "th" ? { role: "table" } : tag === "pre" ? { role: "pre" } :
        ["p", "div", "section", "article"].includes(tag) && ["quote", "list", "caption", "table"].includes(previous.role) ? previous : { role: "body" };
    }
    const nextMarks = { ...marks,
      ...(["strong", "b", "th", "dt"].includes(tag) ? { bold: true } : {}),
      ...(["em", "i", "cite"].includes(tag) ? { italic: true } : {}),
      ...(tag === "u" ? { underline: true } : {}),
      ...(tag === "a" && safeHref(attributes.href) ? { href: safeHref(attributes.href) } : {}),
    };
    let item = Number(attributes.start) || 1;
    for (const child of node.children || []) {
      if ((tag === "ul" || tag === "ol") && child.tag === "li") visit(child, nextMarks, depth + 1, item++, tag === "ol");
      else visit(child, nextMarks, depth, listNumber, ordered);
    }
    if ((tag === "video" || tag === "audio" || tag === "iframe") && attributes.src) append(` ${attributes.src}`, { href: safeHref(attributes.src) });
    if (blocks.has(tag)) { flush(); active = previous; }
  }
  visit(readTree(html));
  flush();
  return result;
}

export function articleBookTextStyle(role: ArticleBookRole, scale = 1, run?: ArticleBookRun): ArticleBookTextStyle {
  const size = role === "title" ? 96 : role === "heading" ? 78 : role === "caption" ? 48 : 56;
  return { size: size * scale, weight: run?.bold || role === "title" || role === "heading" ? 600 : 400, italic: Boolean(run?.italic || role === "quote"), leading: role === "title" ? 1.16 : role === "heading" ? 1.22 : ["body", "list", "quote"].includes(role) ? 1.4 : 1.45 };
}

export function articleBookFont(style: ArticleBookTextStyle) {
  return `${style.italic ? "italic " : ""}${style.weight} ${style.size}px "Onest Local", sans-serif`;
}

type MeasuredLine = { runs: ArticleBookRun[]; width: number; hardBreak?: boolean };
const wordBreakCache = new Map<string, readonly number[]>();
/** Dictionary markers become source offsets only; they never enter semantic article text. */
export function articleBookHyphenationPoints(token: string, locale: ArticleBookInput["locale"]): readonly number[] {
  const match = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{M}]{5,})([^\p{L}\p{N}]*)$/u);
  if (!match || token.includes("\u00ad") || match[2].length > 128) return [];
  const [, punctuation, word] = match;
  const key = `${locale}:${word}`;
  let offsets = wordBreakCache.get(key);
  if (!offsets) {
    const hyphenated = (locale === "ru" ? hyphenateRussian : hyphenateEnglish)(word, {html: false, minWordLength: 5});
    const parts = hyphenated.split("\u00ad");
    const next: number[] = [];
    if (parts.join("") === word) {
      let offset = 0;
      for (const part of parts.slice(0, -1)) {
        offset += part.length;
        if (Array.from(word.slice(0, offset)).length >= 2 && Array.from(word.slice(offset)).length >= 2) next.push(offset);
      }
    }
    if (wordBreakCache.size >= 2048) wordBreakCache.delete(wordBreakCache.keys().next().value!);
    wordBreakCache.set(key, next);
    offsets = next;
  }
  return offsets.map(offset => punctuation.length + offset);
}

function wrapRuns(runs: readonly ArticleBookRun[], maxWidth: number, style: ArticleBookTextStyle, measure: ArticleBookMeasure, role: ArticleBookRole, locale: ArticleBookInput["locale"]): MeasuredLine[] {
  const lines: MeasuredLine[] = [];
  let current: MeasuredLine = { runs: [], width: 0 };
  const emit = (hardBreak = false) => { lines.push({...current, hardBreak}); current = { runs: [], width: 0 }; };
  const put = (text: string, run: ArticleBookRun, displayText = text.replace(/\u00ad/gu, "")) => {
    const runStyle = { ...style, weight: run.bold ? 600 : style.weight, italic: Boolean(run.italic || style.italic) };
    const width = measure(displayText.replace(/\n/gu, ""), runStyle);
    current.runs.push({ ...run, text, ...(displayText !== text ? {displayText} : {}) }); current.width += width;
  };
  const putWord = (initial: string, run: ArticleBookRun) => {
    let token = initial;
    let consumed = 0;
    let dictionaryPoints: readonly number[] | undefined;
    const compound = initial.match(/^([^\p{L}\p{N}\u2010\u2011-]*)([\p{L}\p{M}]+(?:[-\u2010][\p{L}\p{M}]+)+)([^\p{L}\p{N}\u2010\u2011-]*)$/u);
    const authoredBreaks = compound ? Array.from(compound[2].matchAll(/[-\u2010]/gu), match => compound[1].length + match.index + 1) : [];
    const runStyle = { ...style, weight: run.bold ? 600 : style.weight, italic: Boolean(run.italic || style.italic) };
    while (token) {
      const visible = token.replace(/\u00ad/gu, "");
      if (current.width + measure(visible, runStyle) <= maxWidth) { put(token, run); return; }
      // Authored discretionary breaks take precedence over the language dictionary.
      let breakAt = -1;
      for (let index = token.indexOf("\u00ad"); index >= 0; index = token.indexOf("\u00ad", index + 1)) {
        const prefix = token.slice(0, index).replace(/\u00ad/gu, "");
        const suffix = token.slice(index + 1).replace(/\u00ad/gu, "");
        if (Array.from(prefix).length >= 2 && Array.from(suffix).length >= 2 && measure(`${prefix}-`, runStyle) <= maxWidth - current.width) breakAt = index;
      }
      if (breakAt >= 0) {
        const prefix = token.slice(0, breakAt + 1);
        put(prefix, run, `${prefix.replace(/\u00ad/gu, "")}-`);
        emit(); consumed += breakAt + 1; token = token.slice(breakAt + 1); continue;
      }
      if (!initial.includes("\u00ad") && ["body", "list", "quote"].includes(role)) {
        // Existing compound hyphens are valid candidates; U+2011 stays nonbreaking.
        const fittingAuthoredBreaks = authoredBreaks.filter(offset => {
          const index = offset - consumed;
          return index > 0 && Array.from(token.slice(0, index)).length >= 2 && Array.from(token.slice(index)).length >= 2 && measure(token.slice(0, index), runStyle) <= maxWidth - current.width;
        });
        const authoredBreak = fittingAuthoredBreaks[fittingAuthoredBreaks.length - 1];
        if (!dictionaryPoints) {
          if (compound) {
            let offset = compound[1].length;
            dictionaryPoints = compound[2].split(/[-\u2010]/u).flatMap(word => {
              const points = articleBookHyphenationPoints(word, locale).map(point => offset + point);
              offset += word.length + 1;
              return points;
            });
          } else dictionaryPoints = articleBookHyphenationPoints(initial, locale);
        }
        let dictionaryBreak = -1;
        for (const offset of dictionaryPoints) {
          const index = offset - consumed;
          if (index <= 0) continue;
          const prefix = token.slice(0, index);
          const suffix = token.slice(index);
          if (Array.from(prefix).length >= 2 && Array.from(suffix).length >= 2 && measure(`${prefix}-`, runStyle) <= maxWidth - current.width) dictionaryBreak = index;
        }
        // A later dictionary point avoids a sparse line when the compound's existing
        // hyphen occurs early. Prefer the existing character at an equal/longer fit.
        if (authoredBreak !== undefined && authoredBreak - consumed >= dictionaryBreak) {
          const index = authoredBreak - consumed;
          put(token.slice(0, index), run);
          emit(); consumed = authoredBreak; token = token.slice(index); continue;
        }
        if (dictionaryBreak >= 0) {
          const prefix = token.slice(0, dictionaryBreak);
          put(prefix, run, `${prefix}-`);
          emit(); consumed += dictionaryBreak; token = token.slice(dictionaryBreak); continue;
        }
      }
      if (current.runs.length) { emit(); continue; }
      // Arbitrary source URLs and unbroken strings must not clip or lose characters.
      let fragment = "";
      for (const glyph of Array.from(token)) {
        if (fragment && measure((fragment + glyph).replace(/\u00ad/gu, ""), runStyle) > maxWidth) { put(fragment, run); emit(); fragment = ""; }
        fragment += glyph;
      }
      if (fragment) put(fragment, run);
      return;
    }
  };
  for (const run of runs) for (const token of run.text.match(/\n|[^\S\n]+|[^\s]+/gu) || []) {
    if (token === "\n") { put("\n", run); emit(true); continue; }
    putWord(token, run);
  }
  if (current.runs.length) emit();
  return lines;
}

/** Canvas offsets use final font metrics; semantic runs retain every original character. */
export function layoutArticleBookLine(runs: readonly ArticleBookRun[], maxWidth: number, role: ArticleBookRole, style: ArticleBookTextStyle, measure: ArticleBookMeasure, finalLine: boolean, hardBreak = false) {
  const pieces: Array<{run: ArticleBookRun; text: string; space: boolean; width: number}> = [];
  for (const run of runs) {
    const visible = (run.displayText ?? run.text.replace(/\u00ad/gu, "")).replace(/\n/gu, "");
    const runStyle = {...style, weight: run.bold ? 600 : style.weight, italic: Boolean(run.italic || style.italic)};
    for (const part of visible.match(/\s+|\S+/gu) || []) {
      const space = /^\s+$/u.test(part);
      if (role !== "pre" && space && (!pieces.length || pieces[pieces.length - 1].space)) continue;
      const text = role !== "pre" && space ? " " : part;
      pieces.push({run, text, space, width: measure(text, runStyle)});
    }
  }
  if (role !== "pre") while (pieces[pieces.length - 1]?.space) pieces.pop();
  const naturalWidth = pieces.reduce((sum, piece) => sum + piece.width, 0);
  const gaps = pieces.filter(piece => piece.space);
  const slack = Math.max(0, maxWidth - naturalWidth);
  const requestedSpacing = gaps.length ? slack / gaps.length : 0;
  const justified = ["body", "list", "quote"].includes(role) && !finalLine && !hardBreak && gaps.length > 0 && slack > .01;
  const wordSpacing = justified ? requestedSpacing : 0;
  let width = 0;
  const drawRuns: ArticleBookDrawRun[] = pieces.map(piece => {
    const run = {run: piece.run, text: piece.text, x: width, width: piece.width + (piece.space ? wordSpacing : 0)};
    width += run.width;
    return run;
  });
  return {drawRuns, justified, wordSpacing, width};
}

function escapeHtml(value: string) {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");
}
function runsHtml(runs: readonly ArticleBookRun[]) {
  return runs.map(run => {
    let text = escapeHtml(run.text).replace(/\n/gu, "<br>");
    if (run.bold) text = `<strong>${text}</strong>`;
    if (run.italic) text = `<em>${text}</em>`;
    if (run.underline) text = `<u>${text}</u>`;
    if (run.href) text = `<a href="${escapeHtml(run.href)}">${text}</a>`;
    return text;
  }).join("");
}

function pageContent(commands: readonly ArticleBookCommand[]) {
  let html = "", text = "", blockId = "";
  let lines: ArticleBookTextCommand[] = [];
  const flush = () => {
    if (!lines.length) return;
    const block = lines[0].block;
    const runs = lines.flatMap(line => line.runs);
    text += runs.map(run => run.text).join("") + "\n";
    const contents = runsHtml(runs);
    if (block.role === "list") html += block.ordered ? `<ol start="${block.listNumber || 1}"><li>${contents}</li></ol>` : `<ul><li>${contents}</li></ul>`;
    else { const tag = block.role === "title" ? "h1" : block.role === "heading" ? `h${Math.max(2, Math.min(6, block.level || 2))}` : block.role === "quote" ? "blockquote" : block.role === "pre" ? "pre" : "p"; html += `<${tag}${block.role === "caption" ? ' class="article-book-page-caption"' : ""}>${contents}</${tag}>`; }
    lines = [];
  };
  for (const command of commands) {
    if (command.kind === "image") { flush(); html += `<figure>${command.block.semanticHtml || `<img src="${escapeHtml(command.block.src)}" alt="${escapeHtml(command.block.alt)}" loading="lazy">`}</figure>`; if (command.block.text) text += command.block.text + "\n"; blockId = ""; continue; }
    if (blockId !== command.block.id) flush();
    blockId = command.block.id; lines.push(command);
  }
  flush();
  return { html, text };
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

/** Every command is placed before the bottom margin; pages are never capped. */
export function paginateArticleBook(input: ArticleBookInput, content: readonly ArticleBookBlock[], measure: ArticleBookMeasure): { document: BookEditorialDocument; pages: readonly ArticleBookPage[] } {
  const fontScale = Number.isFinite(input.fontScale) ? Math.min(3.6, Math.max(.8, input.fontScale || 1)) : 1;
  const pageWidth = ARTICLE_BOOK_PAGE.width - ARTICLE_BOOK_PAGE.left - ARTICLE_BOOK_PAGE.right;
  const bottom = ARTICLE_BOOK_PAGE.height - ARTICLE_BOOK_PAGE.bottom;
  const pages: ArticleBookPage[] = [];
  let commands: ArticleBookCommand[] = [];
  let y = ARTICLE_BOOK_PAGE.top;
  const nextPage = () => {
    if (commands.length) {
      const index = pages.length;
      const semantic = pageContent(commands);
      pages.push({ id: `${input.articleId}-page-${index + 1}`, index, eyebrow: input.sectionLabel, title: input.title, rows: [], paragraphs: [semantic.text], sources: [], ...semantic, articleLayout: commands });
    }
    commands = []; y = ARTICLE_BOOK_PAGE.top;
  };
  const source: ArticleBookBlock[] = [{kind: "text", id: "article-title", role: "title", runs: [{text: input.title}] }];
  if (input.coverUrl) source.push({kind: "image", id: "article-cover", src: input.coverUrl, alt: input.title});
  source.push(...content);
  // Measure once so page breaks consider editorial units, not only the next block.
  const prepared = source.map(block => {
    if (block.kind === "image") {
      const ratio = block.width && block.height ? block.width / block.height : 1.4;
      return {kind: "image" as const, height: Math.min(1050, Math.max(300, pageWidth / ratio)), before: 0, after: 30};
    }
    const style = articleBookTextStyle(block.role, fontScale);
    const lineHeight = style.size * style.leading;
    const prefix = block.role === "list" ? block.ordered ? `${block.listNumber || 1}.` : "•" : undefined;
    const prefixSize = prefix ? style.size * Math.min(1, pageWidth * .35 / Math.max(1, measure(prefix, style))) : undefined;
    const prefixWidth = prefix ? measure(prefix, {...style, size: prefixSize!}) : 0;
    const indent = prefix ? Math.min(pageWidth * .6, (Math.min(block.depth || 1, 5) - 1) * 30 * fontScale + prefixWidth + 20 * fontScale) : block.role === "quote" ? 32 * fontScale : 0;
    const availableWidth = pageWidth - indent;
    const lines = wrapRuns(block.runs, availableWidth, style, measure, block.role, input.locale);
    return {kind: "text" as const, style, lineHeight, prefix, prefixSize, indent, availableWidth, lines,
      height: lines.length * lineHeight, before: block.role === "heading" ? 38 : 0, after: block.role === "heading" || block.role === "title" ? 26 : 28};
  });
  const capacity = bottom - ARTICLE_BOOK_PAGE.top;
  const isHeading = (index: number) => source[index]?.kind === "text" && ["heading", "title"].includes((source[index] as ArticleBookTextBlock).role);
  const rangeHeight = (start: number, end: number, hasPrevious = false) => {
    let height = 0;
    for (let index = start; index <= end; index++) {
      const item = prepared[index];
      height += (index > start || hasPrevious ? item.before : 0) + item.height + (index < end ? item.after : 0);
    }
    return height;
  };
  const keepEnds = new Map<number, number>();
  const imageEnds = new Map<number, number>();
  const imageHeadings = new Map<string, string | undefined>();
  let headingId: string | undefined;
  for (let index = 0; index < source.length; index++) {
    if (isHeading(index)) headingId = source[index].id;
    if (source[index].kind !== "image") continue;
    imageHeadings.set(source[index].id, headingId);
    let end = index;
    while (source[end + 1]?.kind === "text" && (source[end + 1] as ArticleBookTextBlock).role === "caption") end++;
    imageEnds.set(index, end);
    // An illustration follows its preceding explanation. Move the whole short
    // section, or the largest fitting tail of a long section, onto the next page.
    let start = index;
    if (rangeHeight(start, end) > capacity) continue;
    while (start > 0 && source[start - 1].kind === "text" && rangeHeight(start - 1, end) <= capacity) {
      start--;
      if (isHeading(start)) break;
    }
    keepEnds.set(start, Math.max(end, keepEnds.get(start) ?? end));
  }
  for (let blockIndex = 0; blockIndex < source.length; blockIndex++) {
    const block = source[blockIndex];
    const item = prepared[blockIndex];
    // A continuation illustration must not look like the next section's opener.
    if (isHeading(blockIndex) && commands.some(command => command.kind === "image" && command.block.id !== "article-cover" &&
      !commands.some(candidate => candidate.kind === "text" && candidate.block.id === imageHeadings.get(command.block.id)))) nextPage();
    const keepEnd = keepEnds.get(blockIndex);
    if (keepEnd !== undefined && commands.length && y + rangeHeight(blockIndex, keepEnd, true) > bottom) nextPage();
    const following = prepared[blockIndex + 1];
    if (isHeading(blockIndex) && following && commands.length) {
      const opening = following.kind === "text" ? following.lineHeight * Math.min(2, following.lines.length) : following.height;
      const headingWithOpening = item.height + item.after + following.before + opening;
      if (headingWithOpening <= capacity && y + item.before + headingWithOpening > bottom) nextPage();
    }
    if (block.kind === "image") {
      const height = item.height;
      const caption = prepared[blockIndex + 1];
      const captionReserve = source[blockIndex + 1]?.kind === "text" && (source[blockIndex + 1] as ArticleBookTextBlock).role === "caption" && caption?.kind === "text"
        ? Math.min(capacity - height, item.after + caption.lineHeight * Math.min(2, caption.lines.length)) : 0;
      if (commands.length && y + height + captionReserve > bottom) nextPage();
      commands.push({ kind: "image", block, x: ARTICLE_BOOK_PAGE.left, y, width: pageWidth, height });
      y += height + 30;
      continue;
    }
    if (item.kind !== "text") continue;
    const {style, lineHeight, prefix, prefixSize, indent, availableWidth, lines} = item;
    if (!lines.length) continue;
    const before = block.role === "heading" ? 38 : 0;
    if (commands.length && y + before + lineHeight * Math.min(lines.length, block.role === "heading" || block.role === "title" ? 3 : 2) > bottom) nextPage();
    y += commands.length ? before : 0;
    const imageEnd = imageEnds.get(blockIndex + 1);
    const imageReserve = imageEnd === undefined ? 0 : item.after + rangeHeight(blockIndex + 1, imageEnd);
    const tailLines = imageReserve ? Math.min(2, lines.length, Math.max(0, Math.floor((capacity - imageReserve) / lineHeight))) : 0;
    for (let index = 0; index < lines.length; index++) {
      if (tailLines && lines.length - index === tailLines && commands.length && y + tailLines * lineHeight + imageReserve > bottom) nextPage();
      if (y + lineHeight > bottom) nextPage();
      const line = lines[index];
      const finalLine = index === lines.length - 1;
      const drawing = layoutArticleBookLine(line.runs, availableWidth, block.role, style, measure, finalLine, line.hardBreak);
      commands.push({kind: "text", block, runs: line.runs, ...drawing, finalLine, x: ARTICLE_BOOK_PAGE.left + indent, y, height: lineHeight, size: style.size, ...(prefix && index === 0 ? {prefix, prefixSize} : {})});
      y += lineHeight;
    }
    y += block.role === "heading" || block.role === "title" ? 26 : 28;
  }
  nextPage();
  const key = fingerprint([input.articleId, input.title, input.sectionLabel, input.locale, fontScale, input.html, input.coverUrl].join("|"));
  const document: BookEditorialDocument = {bookKey: `article:${input.articleId}`, locale: input.locale, themeVersion: "article-paper-v1", pageDataVersion: ARTICLE_BOOK_VERSION, cacheKey: `${ARTICLE_BOOK_VERSION}:${key}`, pages};
  return {document, pages};
}
