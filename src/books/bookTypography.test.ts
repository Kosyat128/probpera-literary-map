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
