import { describe, expect, it } from "vitest";

import { parseVisualContentEdit } from "./visual-content-edit";

const PAGE_ID = "94f3858d-7da1-4e64-8429-f34958fbf4dc";
const MEDIA_ID = "64cf4383-b79f-477a-9754-b4f983a00324";

describe("visual CMS content editing policy", () => {
  it("maps only explicitly allowed fields to fixed database columns", () => {
    expect(
      parseVisualContentEdit({
        entityType: "page",
        entityId: PAGE_ID,
        field: "title",
        value: "О проекте",
      })
    ).toMatchObject({ column: "title", value: "О проекте" });
    expect(() =>
      parseVisualContentEdit({
        entityType: "page",
        entityId: PAGE_ID,
        field: "contentHtml",
        value: "<script>alert(1)</script>",
      })
    ).toThrow("нельзя менять");
    expect(() =>
      parseVisualContentEdit({
        entityType: "banner",
        entityId: PAGE_ID,
        field: "updated_by",
        value: "attacker",
      })
    ).toThrow("нельзя менять");
  });

  it("accepts only UUID entity and media identities", () => {
    expect(() =>
      parseVisualContentEdit({
        entityType: "banner",
        entityId: "banner-one",
        field: "title",
        value: "Новость",
      })
    ).toThrow("идентификатор");
    expect(
      parseVisualContentEdit({
        entityType: "banner",
        entityId: PAGE_ID,
        field: "desktopMediaId",
        value: MEDIA_ID,
      })
    ).toMatchObject({ column: "desktop_media_id", value: MEDIA_ID, isMedia: true });
    expect(
      parseVisualContentEdit({
        entityType: "banner",
        entityId: PAGE_ID,
        field: "mobileMediaId",
        value: "",
      }).value
    ).toBeNull();
  });

  it("uses the same safe link policy as the native editors", () => {
    expect(
      parseVisualContentEdit({
        entityType: "navigation-item",
        entityId: PAGE_ID,
        field: "href",
        value: "#atlas",
      }).value
    ).toBe("#atlas");
    expect(
      parseVisualContentEdit({
        entityType: "banner",
        entityId: PAGE_ID,
        field: "targetUrl",
        value: "https://probpera.ru/stranitsy/o-proekte/",
      }).value
    ).toBe("https://probpera.ru/stranitsy/o-proekte/");
    expect(() =>
      parseVisualContentEdit({
        entityType: "navigation-item",
        entityId: PAGE_ID,
        field: "href",
        value: "javascript:alert(1)",
      })
    ).toThrow("Ссылка");
    expect(() =>
      parseVisualContentEdit({
        entityType: "navigation-item",
        entityId: PAGE_ID,
        field: "href",
        value: "//attacker.example/path",
      })
    ).toThrow("Ссылка");
  });

  it("enforces native-editor text limits", () => {
    expect(() =>
      parseVisualContentEdit({
        entityType: "page",
        entityId: PAGE_ID,
        field: "title",
        value: " ",
      })
    ).toThrow("не менее 2");
    expect(() =>
      parseVisualContentEdit({
        entityType: "banner",
        entityId: PAGE_ID,
        field: "description",
        value: "x".repeat(1_201),
      })
    ).toThrow("1200");
  });

  it("validates custom homepage settings without accepting arbitrary JSON", () => {
    expect(
      parseVisualContentEdit({
        entityType: "homepage-block",
        entityId: PAGE_ID,
        field: "buttonUrl",
        value: "mailto:editor@probpera.ru",
      })
    ).toMatchObject({ column: "settings" });
    expect(
      parseVisualContentEdit({
        entityType: "homepage-block",
        entityId: PAGE_ID,
        field: "backgroundStyle",
        value: "paper",
      }).value
    ).toBe("paper");
    expect(() =>
      parseVisualContentEdit({
        entityType: "homepage-block",
        entityId: PAGE_ID,
        field: "articleIds",
        value: [],
      })
    ).toThrow("нельзя менять");
    expect(() =>
      parseVisualContentEdit({
        entityType: "homepage-block",
        entityId: PAGE_ID,
        field: "backgroundStyle",
        value: "url(javascript:alert(1))",
      })
    ).toThrow("стиль");
  });
});
