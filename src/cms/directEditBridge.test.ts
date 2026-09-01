import { describe, expect, it } from "vitest";

import {
  CMS_EDIT_BRIDGE_CHANNEL,
  CMS_EDIT_BRIDGE_CAPABILITIES,
  CMS_EDIT_BRIDGE_LEGACY_VERSION,
  CMS_EDIT_BRIDGE_VERSION,
  cmsEditBreakpointForWidth,
  cmsEditReadyMessage,
  cmsEntityFieldMarker,
  cmsHomepageBlockFieldMarker,
  cmsPageFieldMarker,
  cmsSiteChromeFieldMarker,
  isCmsBridgeMessage,
  isTrustedCmsBridgeEvent,
  isTrustedCmsParentOrigin,
  shouldBypassCmsSelection,
  shouldPreferCmsLeafText,
  shouldRouteCmsFieldToNativeEditor,
  validatedCmsPreviewHref,
} from "./directEditBridge";
import {
  isObservedInterfaceSourceText,
  translateInterfaceText,
} from "../i18n/InterfaceLanguage";

const readyMessage = {
  channel: CMS_EDIT_BRIDGE_CHANNEL,
  version: CMS_EDIT_BRIDGE_VERSION,
  type: "ready",
  capabilities: CMS_EDIT_BRIDGE_CAPABILITIES,
} as const;
const bridgeEnvelope = {
  channel: CMS_EDIT_BRIDGE_CHANNEL,
  version: CMS_EDIT_BRIDGE_VERSION,
} as const;

describe("CMS direct-edit bridge security", () => {
  it("allows only the production admin, same origin, and local admin port", () => {
    expect(
      isTrustedCmsParentOrigin(
        "https://admin.probpera.ru",
        "https://probpera.ru"
      )
    ).toBe(true);
    expect(
      isTrustedCmsParentOrigin("https://probpera.ru", "https://probpera.ru")
    ).toBe(true);
    expect(
      isTrustedCmsParentOrigin(
        "http://127.0.0.1:3000",
        "http://localhost:5173"
      )
    ).toBe(true);
    expect(
      isTrustedCmsParentOrigin("https://attacker.example", "https://probpera.ru")
    ).toBe(false);
    expect(
      isTrustedCmsParentOrigin("http://localhost:9999", "http://localhost:5173")
    ).toBe(false);
  });

  it("requires the exact origin, source window, channel, and protocol version", () => {
    const expectedSource = {} as MessageEventSource;
    expect(
      isTrustedCmsBridgeEvent(
        {
          origin: "https://admin.probpera.ru",
          source: expectedSource,
          data: readyMessage,
        },
        "https://admin.probpera.ru",
        expectedSource
      )
    ).toBe(true);
    expect(
      isTrustedCmsBridgeEvent(
        {
          origin: "https://admin.probpera.ru",
          source: {} as MessageEventSource,
          data: readyMessage,
        },
        "https://admin.probpera.ru",
        expectedSource
      )
    ).toBe(false);
    expect(
      isCmsBridgeMessage({ ...readyMessage, version: 99 })
    ).toBe(false);
    expect(cmsEditReadyMessage()).toEqual(readyMessage);
    expect(isCmsBridgeMessage({ ...readyMessage, arbitrary: true })).toBe(false);
  });

  it("accepts legacy v1 only for inbound preview updates", () => {
    expect(
      isCmsBridgeMessage({
        channel: CMS_EDIT_BRIDGE_CHANNEL,
        version: CMS_EDIT_BRIDGE_LEGACY_VERSION,
        type: "preview-update",
        key: "homepage.title",
        kind: "text",
        value: "Заголовок",
      })
    ).toBe(true);
    expect(
      isCmsBridgeMessage({
        ...readyMessage,
        version: CMS_EDIT_BRIDGE_LEGACY_VERSION,
      })
    ).toBe(false);
  });

  it("validates the complete v2 selection context and owner lock", () => {
    const selection = {
      channel: CMS_EDIT_BRIDGE_CHANNEL,
      version: CMS_EDIT_BRIDGE_VERSION,
      type: "selection",
      key: "book.title",
      copyKey: "",
      sourceText: "Война и мир",
      field: "title",
      kind: "text",
      label: "Название",
      value: "Война и мир",
      href: "",
      entityType: "book",
      entityId: "war-and-peace",
      componentId: "bookshelf",
      instanceId: "bookshelf-books",
      ancestry: [
        { componentId: "magazine", instanceId: "magazine" },
        { componentId: "bookshelf", instanceId: "bookshelf-books" },
      ],
      breakpoint: "desktop",
      state: "selected",
      ownerLocked: true,
    } as const;
    expect(isCmsBridgeMessage(selection)).toBe(true);
    expect(isCmsBridgeMessage({ ...selection, ownerLocked: false })).toBe(false);
    expect(isCmsBridgeMessage({ ...selection, arbitraryCss: "display:none" })).toBe(false);
    expect(cmsEditBreakpointForWidth(639)).toBe("mobile");
    expect(cmsEditBreakpointForWidth(640)).toBe("tablet");
    expect(cmsEditBreakpointForWidth(1024)).toBe("desktop");
  });

  it("prefers a leaf text over an ancestor background marker", () => {
    expect(shouldPreferCmsLeafText("image", false, true)).toBe(true);
    expect(shouldPreferCmsLeafText("image", true, true)).toBe(false);
    expect(shouldPreferCmsLeafText("text", false, true)).toBe(false);
  });

  it("leaves Shift/Alt interactions to the embedded globe and controls", () => {
    expect(shouldBypassCmsSelection({ shiftKey: true, altKey: false })).toBe(true);
    expect(shouldBypassCmsSelection({ shiftKey: false, altKey: true })).toBe(true);
    expect(shouldBypassCmsSelection({ shiftKey: false, altKey: false })).toBe(false);
  });

  it("accepts only declared CMS entity kinds", () => {
    expect(
      isCmsBridgeMessage({
        ...bridgeEnvelope,
        type: "entity-open",
        entityType: "navigation-item",
        entityId: "nav-1",
        label: "Навигация",
        adminHref: "/menus#navigation-item-nav-1",
      })
    ).toBe(true);
    expect(
      isCmsBridgeMessage({
        ...bridgeEnvelope,
        type: "entity-open",
        entityType: "unknown",
        entityId: "x",
        label: "Unknown",
        adminHref: "/settings",
      })
    ).toBe(false);
  });

  it("accepts only a complete allowlisted visual-preview payload", () => {
    const styles = {
      imageFit: "contain",
      imagePosition: "top-right",
      imageZoom: 110,
      imageBrightness: 95,
      imageContrast: 105,
      imageSaturation: 90,
      imageBlur: 0,
      imageOverlay: 20,
      titleFontSize: 54,
      titleAlign: "left",
      titleWeight: 700,
      titleLineHeight: 1.05,
      bodyFontSize: 18,
      bodyAlign: "left",
      bodyWeight: 400,
      bodyLineHeight: 1.55,
    };
    expect(
      isCmsBridgeMessage({
        ...bridgeEnvelope,
        type: "preview-style-update",
        key: "homepage-block.id.title",
        styles,
      })
    ).toBe(true);
    expect(
      isCmsBridgeMessage({
        ...bridgeEnvelope,
        type: "preview-style-update",
        key: "homepage-block.id.title",
        styles: { ...styles, arbitraryCss: "display:none" },
      })
    ).toBe(false);
  });

  it("marks authoritative writer and work fields with stable identities", () => {
    expect(
      cmsEntityFieldMarker("writer", "russia:tolstoy", "name", "Лев Толстой")
    ).toMatchObject({
      "data-cms-key": "writer.russia:tolstoy.name",
      "data-cms-entity": "writer",
      "data-cms-entity-id": "russia:tolstoy",
      "data-cms-field": "name",
      "data-cms-kind": "text",
    });
    expect(
      cmsEntityFieldMarker(
        "book",
        "russia:tolstoy:war-and-peace",
        "title",
        "Война и мир"
      )
    ).toMatchObject({
      "data-cms-entity-id": "russia:tolstoy:war-and-peace",
    });
  });

  it("does not offer false-success inline edits for reviewed biographies or works", () => {
    expect(
      cmsEntityFieldMarker("writer", "russia:tolstoy", "bio", "Текст")
    ).toEqual({});
    expect(
      cmsEntityFieldMarker("writer", "russia:tolstoy", "works", [
        "Война и мир",
      ])
    ).toEqual({});
    expect(
      cmsEntityFieldMarker("writer", "russia:tolstoy", "years", "1828-1910")
    ).toMatchObject({
      "data-cms-field": "years",
      "data-cms-entity-id": "russia:tolstoy",
    });
  });

  it("marks page and site-chrome fields without treating them as interface copy", () => {
    expect(
      cmsPageFieldMarker(
        "94f3858d-7da1-4e64-8429-f34958fbf4dc",
        "title",
        "О проекте"
      )
    ).toMatchObject({
      "data-cms-entity": "page",
      "data-cms-field": "title",
      "data-cms-copy-key": "",
    });
    expect(
      cmsSiteChromeFieldMarker(
        "navigation-item",
        "94f3858d-7da1-4e64-8429-f34958fbf4dc",
        "href",
        "#atlas"
      )
    ).toMatchObject({
      "data-cms-entity": "navigation-item",
      "data-cms-field": "href",
      "data-cms-copy-key": "",
    });
    expect(
      cmsSiteChromeFieldMarker(
        "banner",
        "94f3858d-7da1-4e64-8429-f34958fbf4dc",
        "desktopMediaId",
        "https://probpera.ru/banner.webp",
        { kind: "image", mediaId: "64cf4383-b79f-477a-9754-b4f983a00324" }
      )
    ).toMatchObject({
      "data-cms-kind": "image",
      "data-cms-media-id": "64cf4383-b79f-477a-9754-b4f983a00324",
    });
    expect(
      cmsHomepageBlockFieldMarker(
        "94f3858d-7da1-4e64-8429-f34958fbf4dc",
        "description",
        "Редакционная подборка",
        { kind: "textarea" }
      )
    ).toMatchObject({
      "data-cms-entity": "homepage-block",
      "data-cms-field": "description",
      "data-cms-copy-key": "",
    });
  });

  it("routes only rich page content to the native page editor", () => {
    expect(shouldRouteCmsFieldToNativeEditor("page", "contentHtml")).toBe(true);
    expect(shouldRouteCmsFieldToNativeEditor("page", "title")).toBe(false);
    expect(shouldRouteCmsFieldToNativeEditor("banner", "description")).toBe(false);
  });

  it("registers only text that the runtime translation layer can persist", () => {
    expect(isObservedInterfaceSourceText("Случайный счётчик 2356")).toBe(false);
    expect(translateInterfaceText("Поиск", "ru")).toBeTruthy();
    expect(isObservedInterfaceSourceText("Поиск")).toBe(true);
  });

  it("updates link destinations only for protocols allowed by each CMS field", () => {
    expect(validatedCmsPreviewHref("href", "#atlas")).toBe("#atlas");
    expect(validatedCmsPreviewHref("targetUrl", "/stranitsy/o-proekte/")).toBe(
      "/stranitsy/o-proekte/"
    );
    expect(
      validatedCmsPreviewHref("buttonUrl", "mailto:editor@probpera.ru")
    ).toBe("mailto:editor@probpera.ru");
    expect(validatedCmsPreviewHref("targetUrl", "javascript:alert(1)")).toBeNull();
    expect(validatedCmsPreviewHref("href", "//attacker.example/path")).toBeNull();
    expect(validatedCmsPreviewHref("title", "https://probpera.ru")).toBeNull();
  });
});
