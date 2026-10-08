import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PronunciationDraftEditor } from "./PronunciationDraftEditor";

const catalog = [{ ref: { kind: "writer", countryId: "Country.One", writerId: "Writer.One" } as const,
  spelling: { ru: "Тестовый писатель", en: "Synthetic Writer" } }];

describe("manual pronunciation editor presentation", () => {
  it("shows canonical RU/EN names and separate empty manual fields without voice controls", () => {
    const port = vi.fn(async (_request: string) => ({ ok: false }));
    const html = renderToStaticMarkup(<PronunciationDraftEditor catalog={catalog} previewAction={port} />);
    expect(html).toContain("Тестовый писатель"); expect(html).toContain("Synthetic Writer");
    expect(html).toContain("Фонетическая запись RU"); expect(html).toContain("Фонетическая запись EN");
    expect(html).toContain('lang="ru"'); expect(html).toContain('lang="en"');
    expect(html).not.toMatch(/<(audio|iframe|canvas)\b/u); expect(html).not.toContain("autoplay");
    expect(html).not.toContain("RU test notation"); expect(port).not.toHaveBeenCalled();
  });
  it("keeps reviewed dictionary and narration export disabled before any current server response", () => {
    const html = renderToStaticMarkup(<PronunciationDraftEditor catalog={catalog} previewAction={async () => ({ ok: false })} />);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Экспортировать проверенный draft словаря/u);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Экспортировать draft narration provenance/u);
    expect(html).toContain("Сохранить рабочую копию"); expect(html).toContain("Открыть рабочую копию");
    expect(html).toContain("Голос не генерируется"); expect(html).toContain("не означает редакционного одобрения");
  });
  it("refuses malformed canonical catalog at the actual component without rendering supplied annotations", () => {
    const port = vi.fn(async (_request: string) => ({ ok: false }));
    const malformed = [{ ...catalog[0], spelling: { ...catalog[0].spelling, en: "" } }];
    const html = renderToStaticMarkup(<PronunciationDraftEditor catalog={malformed} previewAction={port} />);
    expect(html).toContain('role="alert"'); expect(html).toContain("Канонический каталог недоступен");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Проверить и показать пометки/u);
    expect(html).not.toContain("Synthetic Writer"); expect(port).not.toHaveBeenCalled();
  });
});
