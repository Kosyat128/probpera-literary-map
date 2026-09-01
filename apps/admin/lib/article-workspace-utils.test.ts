import { describe, expect, it } from "vitest";

import {
  articleWorkspaceAnchor,
  articleWorkspaceCheckLocale,
  articleWorkspaceCheckSection,
  articleWorkspaceDocumentMetrics,
  articleWorkspacePanelSection,
  articleWorkspaceQuality,
} from "./article-workspace-utils";

describe("article workspace helpers", () => {
  it("maps editor inspector headings to stable workspace sections", () => {
    expect(articleWorkspacePanelSection("Публикация")).toBe("publish");
    expect(articleWorkspacePanelSection("English publication")).toBe("publish");
    expect(articleWorkspacePanelSection("Обложка")).toBe("cover");
    expect(articleWorkspacePanelSection("SEO и соцсети")).toBe("seo");
    expect(articleWorkspacePanelSection("Источники и библиография")).toBe("sources");
    expect(articleWorkspacePanelSection("Контроль перед публикацией")).toBe("quality");
    expect(articleWorkspacePanelSection("Рубрика")).toBe("basics");
    expect(articleWorkspacePanelSection("Что-то другое")).toBeNull();
  });

  it("routes publication checklist issues to useful editor sections", () => {
    expect(articleWorkspaceCheckSection("Заголовок и постоянный адрес")).toBe("basics");
    expect(articleWorkspaceCheckSection("Не менее 250 слов")).toBe("text");
    expect(articleWorkspaceCheckSection("Есть смысловые подзаголовки H2")).toBe("text");
    expect(articleWorkspaceCheckSection("Обложка и её описание")).toBe("cover");
    expect(articleWorkspaceCheckSection("SEO-описание - от 80 знаков")).toBe("seo");
    expect(articleWorkspaceCheckSection("Указан хотя бы один источник")).toBe("sources");
    expect(articleWorkspaceCheckSection("Все места для изображений заменены")).toBe("media");
    expect(
      articleWorkspaceCheckSection(
        "Английская версия: статус «проверен» или «опубликован»"
      )
    ).toBe("publish");
  });

  it("detects the locale behind publication checklist issues", () => {
    expect(articleWorkspaceCheckLocale("Рубрика выбрана")).toBe("ru");
    expect(
      articleWorkspaceCheckLocale("Английская версия: указан источник")
    ).toBe("en");
  });

  it("builds deterministic outline anchors from Russian headings", () => {
    expect(articleWorkspaceAnchor("История создания и публикации", 0)).toBe(
      "article-heading-история-создания-и-публикации-1"
    );
    expect(articleWorkspaceAnchor("***", 2)).toBe("article-heading-section-3");
  });

  it("calculates bounded publication readiness", () => {
    expect(articleWorkspaceQuality(7, 10)).toEqual({
      ready: 7,
      total: 10,
      percent: 70,
      complete: false,
    });
    expect(articleWorkspaceQuality(12, 10)).toEqual({
      ready: 10,
      total: 10,
      percent: 100,
      complete: true,
    });
    expect(articleWorkspaceQuality(0, 0)).toEqual({
      ready: 0,
      total: 0,
      percent: 0,
      complete: false,
    });
  });

  it("summarizes active document metrics without overfitting editor state", () => {
    expect(articleWorkspaceDocumentMetrics("one two   three", 2, 4)).toEqual({
      words: 3,
      headings: 2,
      images: 4,
      readingMinutes: 1,
    });
    expect(articleWorkspaceDocumentMetrics("слово ".repeat(401), 3.9, -2)).toEqual({
      words: 401,
      headings: 3,
      images: 0,
      readingMinutes: 3,
    });
  });
});
