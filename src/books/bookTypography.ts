export const BOOK_TYPOGRAPHY_VERSION = "owner-book-typography-v2" as const;

export const BookDossierTypographyTokens = Object.freeze({
  version: BOOK_TYPOGRAPHY_VERSION,
  serif: '"Source Serif 4 Local", Georgia, serif',
  sans: '"Source Sans 3 Local", "Segoe UI", sans-serif',
  title: Object.freeze({ size: 120, weight: 600, leading: 1.16 }),
  heading: Object.freeze({ size: 120, weight: 600, leading: 1.2 }),
  body: Object.freeze({ size: 92, weight: 400, leading: 1.5 }),
  metadata: Object.freeze({ size: 88, weight: 400, leading: 1.4 }),
  caption: Object.freeze({ size: 84, weight: 600, leading: 1.4 }),
  folio: Object.freeze({ size: 76, weight: 400, leading: 1.4 }),
});

export const BookDossierPaperTokens = Object.freeze({
  paper: "#f3ead8",
  ink: "#302827",
  muted: "#67574c",
  accent: "#86502c",
  fiberOpacity: 0.025,
});

export const BookDossierSpacingTokens = Object.freeze({
  designWidth: 1400,
  designHeight: 2000,
  outer: 132,
  gutter: 164,
  top: 150,
  bottom: 150,
  baseline: 14,
  paragraph: 42,
  section: 70,
});

export const OwnerBookTypographyTokens = Object.freeze({
  version: BOOK_TYPOGRAPHY_VERSION,
  ivory: "#f4ead1",
  sepia: "#46362b",
  rule: "#d9c58c",
  titleCenter: 0.27,
  authorCenter: 0.565,
  titleZone: Object.freeze({ top: 0.15, bottom: 0.40 }),
  authorZone: Object.freeze({ top: 0.465, bottom: 0.675 }),
  topRule: 0.09,
  bottomRule: 0.91,
  safeWidth: 0.88,
  referenceHeight: 411,
  title: Object.freeze({ maximum: 25, minimum: 10.25, leading: 1.16, weight: 600 }),
  author: Object.freeze({ maximum: 19, minimum: 11, leading: 1.16, weight: 600 }),
});

const fontStates = new WeakMap<FontFaceSet, { ready: boolean; pending: Promise<boolean> }>();
const fontSample = "Пробы пера Автор Ёж Atlas Author 1984";
const fontRequests = [
  '400 16px "Source Serif 4 Local"',
  '600 16px "Source Serif 4 Local"',
  '400 16px "Source Sans 3 Local"',
  '600 16px "Source Sans 3 Local"',
] as const;

export function bookTypographyIsReady() {
  return typeof document !== "undefined" && Boolean(fontStates.get(document.fonts)?.ready);
}

export function ensureBookTypographyReady(): Promise<boolean> {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve(false);
  const fonts = document.fonts;
  const existing = fontStates.get(fonts);
  if (existing) return existing.pending;
  const state = { ready: false, pending: Promise.resolve(false) };
  state.pending = (async () => {
    try {
      // FontFaceSet.check alone also returns true for absent font families.
      // Require actual local faces, then rasterize once with final metrics.
      const loaded = await Promise.all(fontRequests.map((font) => fonts.load(font, fontSample)));
      await fonts.ready;
      state.ready = loaded.every((faces) => faces.length > 0 && faces.every((face) => face.status === "loaded")) &&
        fontRequests.every((font) => fonts.check(font, fontSample));
      return state.ready;
    } catch {
      return false;
    }
  })();
  fontStates.set(fonts, state);
  return state.pending;
}

export type BookTextLayout = Readonly<{
  text: string;
  lines: readonly string[];
  fontSize: number;
  lineHeight: number;
  width: number;
  height: number;
  fits: boolean;
}>;

export type BookTextMeasure = (text: string, fontSize: number) => number;

type TextPart = Readonly<{ text: string; separator: string }>;

function textParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const cjk = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u.test(word);
    const segments = cjk ? Array.from(word) : word.match(/[^-]+-?|-/gu) ?? [word];
    segments.forEach((segment, index) => parts.push({
      text: segment,
      separator: index === 0 && parts.length ? " " : "",
    }));
  }
  return parts;
}

function joinedParts(parts: readonly TextPart[], start: number, end: number) {
  return parts.slice(start, end).map((part, index) => `${index ? part.separator : ""}${part.text}`).join("");
}

/** Balanced, measured lines preserve every glyph and only use legal breaks. */
export function balanceBookTextLines(
  text: string,
  maximumWidth: number,
  maximumLines: number,
  measure: (line: string) => number
): readonly string[] | null {
  const parts = textParts(text);
  if (!parts.length) return Object.freeze([]);
  const count = parts.length;
  const widths = new Map<string, number>();
  const widthOf = (start: number, end: number) => {
    const key = `${start}:${end}`;
    if (!widths.has(key)) widths.set(key, measure(joinedParts(parts, start, end)));
    return widths.get(key) ?? Infinity;
  };
  for (let lineCount = 1; lineCount <= Math.min(maximumLines, count); lineCount += 1) {
    const costs = Array.from({ length: lineCount + 1 }, () => Array<number>(count + 1).fill(Infinity));
    const previous = Array.from({ length: lineCount + 1 }, () => Array<number>(count + 1).fill(-1));
    costs[0][0] = 0;
    for (let line = 1; line <= lineCount; line += 1) {
      for (let end = line; end <= count; end += 1) {
        for (let start = line - 1; start < end; start += 1) {
          if (!Number.isFinite(costs[line - 1][start])) continue;
          const width = widthOf(start, end);
          if (width > maximumWidth) continue;
          const finalWord = parts[end - 1].text;
          const orphan = end < count && /^(?:[а-яёa-z]{1,2}|и|или|the|of|and|to)$/iu.test(finalWord) ? maximumWidth ** 2 : 0;
          const tail = line === lineCount && end === count && end - start === 1 && lineCount > 1 ? maximumWidth ** 2 * 0.2 : 0;
          const cost = costs[line - 1][start] + (maximumWidth - width) ** 2 + orphan + tail;
          if (cost < costs[line][end]) {
            costs[line][end] = cost;
            previous[line][end] = start;
          }
        }
      }
    }
    if (!Number.isFinite(costs[lineCount][count])) continue;
    const lines: string[] = [];
    let end = count;
    for (let line = lineCount; line > 0; line -= 1) {
      const start = previous[line][end];
      lines.unshift(joinedParts(parts, start, end));
      end = start;
    }
    return Object.freeze(lines);
  }
  return null;
}

export function fitBookText(options: Readonly<{
  text: string;
  width: number;
  height: number;
  maximumFontSize: number;
  minimumFontSize: number;
  leading: number;
  maximumLines: number;
  measure: BookTextMeasure;
}>): BookTextLayout {
  const text = options.text.replace(/\s+/gu, " ").trim();
  const minimum = Math.max(1, options.minimumFontSize);
  const maximum = Math.max(minimum, options.maximumFontSize);
  // Quarter-pixel steps are in design space, independent of the texture LOD.
  for (let size = maximum; size >= minimum - 0.001; size = Math.max(minimum, size - 0.25)) {
    const lineHeight = size * options.leading;
    const count = Math.min(options.maximumLines, Math.floor(options.height / lineHeight));
    const lines = balanceBookTextLines(text, options.width, count, (line) => options.measure(line, size));
    if (lines) return Object.freeze({
      text, lines, fontSize: size, lineHeight,
      width: Math.max(0, ...lines.map((line) => options.measure(line, size))),
      height: lines.length * lineHeight,
      fits: true,
    });
    if (size === minimum) break;
  }
  return Object.freeze({ text, lines: Object.freeze([]), fontSize: minimum, lineHeight: minimum * options.leading, width: 0, height: 0, fits: false });
}
