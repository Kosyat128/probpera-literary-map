import type { BookInspectionTexturePlan, BookInspectionTextureRequest, BookInspectionTextureResource } from "../books/bookInspectionTextures";
import { publicImageUrl } from "../utils/imageDelivery";
import { createArticleBookImageLoader, type ArticleBookImageState } from "./articleBookImages";
import {
  ARTICLE_BOOK_PAGE,
  articleBookFont,
  articleBookTextStyle,
  paginateArticleBook,
  parseArticleBookHtml,
  type ArticleBookInput,
  type ArticleBookMeasure,
  type ArticleBookPage,
} from "./articleBookPages";

export type ArticleBookTextureRenderer = (request: BookInspectionTextureRequest, plan: BookInspectionTexturePlan, key: string) => BookInspectionTextureResource | null;
export type CompiledArticleBook = Awaited<ReturnType<typeof compileArticleBookDocument>>;

async function ensureOnestMetrics() {
  if (typeof document === "undefined" || !document.fonts) throw new Error("Article book fonts need a browser.");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const ready = await Promise.race([
      Promise.all([400, 600].map(weight => document.fonts.load(`${weight} 64px "Onest Local"`, "Литература Literature Ёж")))
        .then(faces => faces.every(group => group.length > 0 && group.every(face => face.status === "loaded"))),
      new Promise<false>(resolve => { timeout = setTimeout(() => resolve(false), 5000); }),
    ]);
    if (!ready) throw new Error("The article book font is unavailable; use the text reader.");
  } finally { if (timeout) clearTimeout(timeout); }
}

function safeColor(value: string | undefined, fallback: string) {
  return value && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/iu.test(value) ? value : fallback;
}

function placeholderLines(text: string, width: number, measure: (value: string) => number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/u)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= width) { line = candidate; continue; }
    if (line) lines.push(line);
    line = "";
    for (const glyph of Array.from(word)) {
      if (line && measure(line + glyph) > width) { lines.push(line); line = ""; }
      line += glyph;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function createArticleBookTextureRenderer(pages: readonly ArticleBookPage[], images: ReadonlyMap<string, HTMLImageElement>, locale: "ru" | "en", imageState?: (source: string) => ArticleBookImageState): ArticleBookTextureRenderer {
  const byId = new Map(pages.map(page => [page.id, page]));
  return (request, plan, key) => {
    const page = byId.get(request.page.id);
    if (!page || typeof document === "undefined") return null;
    const surface = document.createElement("canvas");
    surface.width = plan.width; surface.height = plan.height;
    const context = surface.getContext("2d");
    if (!context) return null;
    const paper = safeColor(request.theme?.paperColor, "#f6eddb");
    const ink = safeColor(request.theme?.inkColor, "#302638");
    const muted = safeColor(request.theme?.mutedColor, "#6b5967");
    const accent = safeColor(request.theme?.accentColor, "#88421f");
    const design = ARTICLE_BOOK_PAGE;
    context.scale(plan.width / design.width, plan.height / design.height);
    context.fillStyle = paper;
    context.fillRect(0, 0, design.width, design.height);
    const binding = context.createLinearGradient(0, 0, design.width, 0);
    if (page.index % 2 === 0) { binding.addColorStop(0, "rgba(77,51,34,.08)"); binding.addColorStop(.07, "rgba(77,51,34,0)"); }
    else { binding.addColorStop(.93, "rgba(77,51,34,0)"); binding.addColorStop(1, "rgba(77,51,34,.08)"); }
    context.fillStyle = binding; context.fillRect(0, 0, design.width, design.height);
    context.strokeStyle = "rgba(89,58,38,.22)";
    context.lineWidth = 1;
    context.beginPath(); context.moveTo(design.left, 125); context.lineTo(design.width - design.right, 125); context.stroke();
    context.fillStyle = muted;
    context.textBaseline = "alphabetic";
    context.textAlign = "left";
    context.font = '500 32px "Onest Local", sans-serif';
    const headerWidth = design.width - design.left - design.right;
    const headerSize = Math.min(32, 32 * headerWidth / Math.max(headerWidth, context.measureText(page.eyebrow).width));
    context.font = `500 ${headerSize}px "Onest Local", sans-serif`;
    context.fillText(page.eyebrow, design.left, 94);
    for (const command of page.articleLayout) {
      if (command.kind === "image") {
        const image = images.get(command.block.src);
        if (image?.naturalWidth) {
          const ratio = Math.min(command.width / image.naturalWidth, command.height / image.naturalHeight);
          const width = image.naturalWidth * ratio, height = image.naturalHeight * ratio;
          context.drawImage(image, command.x + (command.width - width) / 2, command.y + (command.height - height) / 2, width, height);
        } else {
          context.fillStyle = "rgba(73,45,36,.035)";
          context.fillRect(command.x, command.y, command.width, command.height);
          context.strokeStyle = "rgba(73,45,36,.22)";
          context.strokeRect(command.x, command.y, command.width, command.height);
          context.font = '400 42px "Onest Local", sans-serif';
          context.textAlign = "center";
          context.fillStyle = muted;
          const pending = imageState?.(command.block.src) === "pending";
          const message = pending
            ? locale === "ru" ? "Загружаем иллюстрацию…" : "Loading illustration…"
            : locale === "ru" ? "Не удалось загрузить иллюстрацию" : "Illustration could not be loaded";
          const lines = placeholderLines(message, Math.max(1, command.width - 64), text => context.measureText(text).width);
          const leading = 58;
          const top = command.y + (command.height - lines.length * leading) / 2 + 42;
          lines.forEach((line, index) => context.fillText(line, command.x + command.width / 2, top + index * leading));
          context.textAlign = "left";
        }
        continue;
      }
      const scale = command.size / articleBookTextStyle(command.block.role).size;
      const style = articleBookTextStyle(command.block.role, scale);
      const baseline = command.y + command.size;
      if (command.prefix) {
        context.font = articleBookFont({...style, size: command.prefixSize || style.size});
        context.fillStyle = accent;
        context.textAlign = "right";
        context.fillText(command.prefix, command.x - 14, baseline);
        context.textAlign = "left";
      }
      for (const draw of command.drawRuns) {
        const {run, text, width} = draw;
        const x = command.x + draw.x;
        context.font = articleBookFont({...style, weight: run.bold ? 600 : style.weight, italic: Boolean(run.italic || style.italic)});
        context.fillStyle = run.href ? accent : command.block.role === "caption" ? muted : ink;
        context.fillText(text, x, baseline);
        if (run.underline || run.href) {
          context.strokeStyle = context.fillStyle;
          context.lineWidth = 1.5;
          context.beginPath(); context.moveTo(x, baseline + 5); context.lineTo(x + width, baseline + 5); context.stroke();
        }
      }
    }
    context.fillStyle = muted;
    context.font = '400 36px "Onest Local", sans-serif';
    context.textAlign = page.index % 2 === 0 ? "left" : "right";
    context.fillText(String(page.index + 1), page.index % 2 === 0 ? design.left : design.width - design.right, design.height - 82);
    let disposed = false;
    return Object.freeze({ key, surface, width: plan.width, height: plan.height, dpi: plan.dpi,
      get disposed() { return disposed; },
      dispose() { if (disposed) return; disposed = true; surface.width = 1; surface.height = 1; },
    });
  };
}

export async function compileArticleBookDocument(input: ArticleBookInput, options: {signal?: AbortSignal} = {}) {
  await ensureOnestMetrics();
  if (options.signal?.aborted) throw new Error("Article book compilation cancelled.");
  const source = parseArticleBookHtml(input.html);
  const urls = [...new Set([...(input.coverUrl ? [input.coverUrl] : []), ...source.flatMap(block => block.kind === "image" ? [block.src] : [])])];
  const preload = createArticleBookImageLoader(urls, {resolveUrl: src => publicImageUrl(src, 1920), signal: options.signal});
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Article book canvas is unavailable; use the text reader.");
    const measure: ArticleBookMeasure = (text, style) => { context.font = articleBookFont(style); return context.measureText(text).width; };
    const result = paginateArticleBook(input, source, measure);
    return {...result, renderer: createArticleBookTextureRenderer(result.pages, preload.images, input.locale, preload.getState),
      get unavailableImages() { return urls.filter(src => preload.getState(src) === "failed"); },
      subscribeImages: preload.subscribe, getImageRevision: preload.getRevision, imagesSettled: preload.settled, dispose: preload.dispose};
  } catch (error) { preload.dispose(); throw error; }
}
