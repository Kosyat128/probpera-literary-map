import { afterEach, describe, expect, it, vi } from "vitest";
import { balanceBookTextLines, bookTypographyIsReady, ensureBookTypographyReady, fitBookText } from "./bookTypography";

afterEach(() => vi.unstubAllGlobals());

describe("owner book typography", () => {
  it("preserves full Cyrillic text and uses an explicit hyphen as a legal break", () => {
    const text = "Анна-Вероника";
    const layout = fitBookText({ text, width: 100, height: 70, minimumFontSize: 14, maximumFontSize: 20, leading: 1.2, maximumLines: 3, measure: (line, size) => line.length * size * 0.6 });
    expect(layout.fits).toBe(true);
    expect(layout.lines).toEqual(["Анна-", "Вероника"]);
    expect(layout.lines.join("")).toBe(text);
    expect(layout.fontSize).toBeGreaterThanOrEqual(14);
    expect(layout.width).toBeLessThanOrEqual(100);
  });

  it("reports impossible titles instead of truncating or squeezing glyphs", () => {
    const text = "Сверхдлинноенеразделимословобезместадляпереноса";
    const layout = fitBookText({ text, width: 80, height: 100, minimumFontSize: 12, maximumFontSize: 24, leading: 1.2, maximumLines: 6, measure: (line, size) => line.length * size * 0.6 });
    expect(layout).toMatchObject({ fits: false, text, lines: [], fontSize: 12 });
    expect(JSON.stringify(layout)).not.toContain("…");
  });

  it.each(["Освобожденный мир", "Убить пересмешника…", "Гордость и предубеждение"])("keeps the complete long title on a narrow spine: %s", (text) => {
    const options = { text, width: 79, height: 103, minimumFontSize: 10.25, maximumFontSize: 25, leading: 1.16, maximumLines: 8, measure: (line: string, size: number) => line.length * size * .62 };
    expect(fitBookText(options).fits).toBe(false);
    const layout = fitBookText({ ...options, discretionaryHyphens: true });
    expect(layout.fits).toBe(true);
    expect(layout.text).toBe(text);
    expect(layout.lines.join("").replace(/[-\s]/gu, "")).toBe(text.replace(/\s/gu, ""));
    expect(layout.lines.some((line) => line.endsWith("-"))).toBe(true);
    expect(layout.width).toBeLessThanOrEqual(options.width);
    expect(layout.height).toBeLessThanOrEqual(options.height);
    expect(layout.fontSize).toBeGreaterThanOrEqual(options.minimumFontSize);
  });

  it("keeps signs with their syllable and does not invent a break in Latin words", () => {
    const text = "Объявление майский";
    const lines = balanceBookTextLines(text, 5, 8, (line) => line.length, true);
    expect(lines).not.toBeNull();
    expect(lines?.some((line) => /^[ьъй]/iu.test(line))).toBe(false);
    expect(lines?.some((line) => /^[а-яё]-$/iu.test(line))).toBe(false);
    expect(lines?.join("").replace(/[-\s]/gu, "")).toBe(text.replace(/\s/gu, ""));
    expect(balanceBookTextLines("Unbreakable", 5, 8, (line) => line.length, true)).toBeNull();
  });

  it("wraps a written CamelCase boundary without adding a Latin hyphen", () => {
    const text = "Number9Dream";
    const options = { text, width: 79, height: 103, minimumFontSize: 10.25, maximumFontSize: 25, leading: 1.16, maximumLines: 8, measure: (line: string, size: number) => line.length * size * .65 };
    expect(fitBookText(options).fits).toBe(false);
    const layout = fitBookText({ ...options, discretionaryHyphens: true });
    expect(layout.fits).toBe(true);
    expect(layout.text).toBe(text);
    expect(layout.lines).toEqual(["Number9", "Dream"]);
    expect(layout.lines.join("")).toBe(text);
    expect(layout.width).toBeLessThanOrEqual(options.width);
    expect(layout.height).toBeLessThanOrEqual(options.height);
  });

  it("balances words without leaving a short preposition at a line end", () => {
    const lines = balanceBookTextLines("Война и мир", 9, 3, (line) => line.length);
    expect(lines).toEqual(["Война", "и мир"]);
    expect(lines?.join(" ")).toBe("Война и мир");
  });

  it("keeps CJK glyphs complete", () => {
    const text = "走ることについて語るときに僕の語ること";
    const lines = balanceBookTextLines(text, 6, 8, (line) => Array.from(line).length);
    expect(lines?.join("")).toBe(text);
    expect(lines?.every((line) => Array.from(line).length <= 6)).toBe(true);
  });

  it("waits for actual local font faces and shares concurrent requests", async () => {
    let resolveReady: () => void = () => undefined;
    const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
    const fonts = { load: vi.fn(async () => [{ status: "loaded" }]), check: vi.fn(() => true), ready };
    vi.stubGlobal("document", { fonts });
    const first = ensureBookTypographyReady();
    expect(ensureBookTypographyReady()).toBe(first);
    expect(bookTypographyIsReady()).toBe(false);
    resolveReady();
    await expect(first).resolves.toBe(true);
    expect(fonts.load).toHaveBeenCalledTimes(4);
    expect(bookTypographyIsReady()).toBe(true);
  });

  it("does not accept a missing family merely because FontFaceSet.check passes", async () => {
    vi.stubGlobal("document", { fonts: { load: async () => [], check: () => true, ready: Promise.resolve() } });
    await expect(ensureBookTypographyReady()).resolves.toBe(false);
    expect(bookTypographyIsReady()).toBe(false);
  });
});
