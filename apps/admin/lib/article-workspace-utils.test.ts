import { describe, expect, it } from "vitest";

import {
  articleWorkspaceAnchor,
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
});
