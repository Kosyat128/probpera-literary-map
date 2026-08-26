import { useEffect } from "react";

import { cmsSiteContent } from "../data/cms/site.generated";
import {
  cmsHomepageVisualCssProperties,
  cmsHomepageVisualCssVariables,
  isCompleteCmsHomepageVisualSettings,
  type CmsHomepageVisualSettings,
} from "../data/cms/homepageVisualSettings";
import { isObservedInterfaceSourceText } from "../i18n/InterfaceLanguage";

export const CMS_EDIT_BRIDGE_CHANNEL = "probpera:cms-edit";
export const CMS_EDIT_BRIDGE_VERSION = 1;

export type CmsEditableKind = "text" | "textarea" | "image" | "richtext";

type CmsBridgeEnvelope = {
  channel: typeof CMS_EDIT_BRIDGE_CHANNEL;
  version: typeof CMS_EDIT_BRIDGE_VERSION;
};

export type CmsSelectionMessage = CmsBridgeEnvelope & {
  type: "selection";
  key: string;
  copyKey: string;
  sourceText: string;
  field: string;
  kind: CmsEditableKind;
  label: string;
  value: string;
  href: string;
  entityType: string;
  entityId: string;
  mediaId?: string;
};

export type CmsEntityOpenMessage = CmsBridgeEnvelope & {
  type: "entity-open";
  entityType:
    | "article"
    | "book"
    | "writer"
    | "page"
    | "homepage-block"
    | "banner"
    | "navigation-item";
  entityId: string;
  label: string;
  adminHref: string;
};

export type CmsPreviewUpdateMessage = CmsBridgeEnvelope & {
  type: "preview-update";
  key: string;
  kind: CmsEditableKind;
  value: string;
  mediaId?: string;
};

export type CmsPreviewStyleUpdateMessage = CmsBridgeEnvelope & {
  type: "preview-style-update";
  key: string;
  styles: CmsHomepageVisualSettings;
  reset?: boolean;
};

export type CmsBridgeMessage =
  | CmsSelectionMessage
  | CmsEntityOpenMessage
  | CmsPreviewUpdateMessage
  | CmsPreviewStyleUpdateMessage
  | (CmsBridgeEnvelope & { type: "ready" });

export type CmsMarkerAttributes = Record<`data-cms-${string}`, string>;

function safeMarkerValue(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function cmsCoreFieldMarker(
  section: string,
  field: string,
  value: unknown,
  options: {
    kind?: CmsEditableKind;
    label?: string;
    copyKey?: string;
    sourceText?: string;
  } = {}
): CmsMarkerAttributes {
  return {
    "data-cms-key": `homepage.${section}.${field}`,
    "data-cms-entity": "homepage-core",
    "data-cms-entity-id": section,
    "data-cms-field": field,
    "data-cms-kind": options.kind || "text",
    "data-cms-label": options.label || field,
    "data-cms-value": safeMarkerValue(value),
    "data-cms-copy-key": options.copyKey || "",
    "data-cms-source-text": options.sourceText || safeMarkerValue(value),
  };
}

export function cmsPageFieldMarker(
  pageId: string,
  field: "title" | "excerpt" | "contentHtml",
  value: unknown,
  options: { kind?: CmsEditableKind; label?: string } = {}
): CmsMarkerAttributes {
  return {
    "data-cms-key": `page.${pageId}.${field}`,
    "data-cms-entity": "page",
    "data-cms-entity-id": pageId,
    "data-cms-field": field,
    "data-cms-kind": options.kind || "text",
    "data-cms-label": options.label || field,
    "data-cms-value": safeMarkerValue(value),
    "data-cms-copy-key": "",
    "data-cms-source-text": safeMarkerValue(value),
    "data-cms-admin-href": `/pages/${encodeURIComponent(pageId)}`,
  };
}

type CmsSiteChromeField =
  | {
      entityType: "navigation-item";
      field: "label" | "href";
    }
  | {
      entityType: "banner";
      field:
        | "title"
        | "description"
        | "buttonText"
        | "targetUrl"
        | "desktopMediaId"
        | "tabletMediaId"
        | "mobileMediaId";
    };

export function cmsSiteChromeFieldMarker(
  entityType: CmsSiteChromeField["entityType"],
  entityId: string,
  field: string,
  value: unknown,
  options: {
    kind?: CmsEditableKind;
    label?: string;
    adminHref?: string;
    mediaId?: string | null;
  } = {}
): CmsMarkerAttributes {
  const allowedFields =
    entityType === "navigation-item"
      ? new Set(["label", "href"])
      : new Set([
          "title",
          "description",
          "buttonText",
          "targetUrl",
          "desktopMediaId",
          "tabletMediaId",
          "mobileMediaId",
        ]);
  if (!allowedFields.has(field)) {
    throw new Error("Unsupported CMS site-chrome field marker.");
  }
  return {
    "data-cms-key": `${entityType}.${entityId}.${field}`,
    "data-cms-entity": entityType,
    "data-cms-entity-id": entityId,
    "data-cms-field": field,
    "data-cms-kind": options.kind || "text",
    "data-cms-label": options.label || field,
    "data-cms-value": safeMarkerValue(value),
    "data-cms-copy-key": "",
    "data-cms-source-text": safeMarkerValue(value),
    "data-cms-admin-href": options.adminHref || "",
    "data-cms-media-id": options.mediaId || "",
  };
}

export function cmsHomepageBlockFieldMarker(
  blockId: string,
  field:
    | "title"
    | "eyebrow"
    | "description"
    | "copy"
    | "buttonText"
    | "buttonUrl"
    | "backgroundMediaId"
    | "backgroundStyle",
  value: unknown,
  options: {
    kind?: CmsEditableKind;
    label?: string;
    adminHref?: string;
    mediaId?: string | null;
  } = {}
): CmsMarkerAttributes {
  return {
    "data-cms-key": `homepage-block.${blockId}.${field}`,
    "data-cms-entity": "homepage-block",
    "data-cms-entity-id": blockId,
    "data-cms-field": field,
    "data-cms-kind": options.kind || "text",
    "data-cms-label": options.label || field,
    "data-cms-value": safeMarkerValue(value),
    "data-cms-copy-key": "",
    "data-cms-source-text": safeMarkerValue(value),
    "data-cms-admin-href":
      options.adminHref || `/homepage#block-${encodeURIComponent(blockId)}`,
    "data-cms-media-id": options.mediaId || "",
  };
}

export function cmsEntityMarker(
  entityType:
    | "article"
    | "book"
    | "writer"
    | "homepage-block"
    | "banner"
    | "navigation-item",
  entityId: string,
  label: string,
  adminHref: string
): CmsMarkerAttributes {
  return {
    "data-cms-entity": entityType,
    "data-cms-entity-id": entityId,
    "data-cms-label": label,
    "data-cms-admin-href": adminHref,
  };
}

export function cmsEntityFieldMarker(
  entityType: "writer" | "book",
  entityId: string,
  field: string,
  value: unknown,
  options: {
    kind?: CmsEditableKind;
    label?: string;
    adminHref?: string;
  } = {}
): CmsMarkerAttributes {
  // Published biographies come from the reviewed translation/source selector,
  // and published work lists come from verified workDetails. A quick override
  // of `bio` or `works` would therefore save successfully without changing
  // what readers see. Leave those nodes unmarked so the enclosing writer
  // entity opens the canonical library editor instead of offering a false
  // inline edit.
  if (
    entityType === "writer" &&
    (field === "bio" || field === "works")
  ) {
    return {};
  }
  return {
    "data-cms-key": `${entityType}.${entityId}.${field}`,
    "data-cms-entity": entityType,
    "data-cms-entity-id": entityId,
    "data-cms-field": field,
    "data-cms-kind": options.kind || "text",
    "data-cms-label": options.label || field,
    "data-cms-value": Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").join("\n")
      : safeMarkerValue(value),
    "data-cms-copy-key": "",
    "data-cms-source-text": safeMarkerValue(value),
    "data-cms-admin-href": options.adminHref || "",
  };
}

export function isTrustedCmsParentOrigin(
  candidate: string,
  currentOrigin: string
) {
  let parent: URL;
  let current: URL;
  try {
    parent = new URL(candidate);
    current = new URL(currentOrigin);
  } catch {
    return false;
  }

  if (parent.origin === current.origin) return true;
  if (parent.origin === "https://admin.probpera.ru") return true;

  const localHosts = new Set(["localhost", "127.0.0.1"]);
  return (
    localHosts.has(parent.hostname) &&
    localHosts.has(current.hostname) &&
    parent.protocol === "http:" &&
    parent.port === "3000"
  );
}

export function cmsParentOriginFromLocation(location: Location) {
  const search = new URLSearchParams(location.search);
  if (search.get("cms-edit") !== "1") return null;
  const candidate = search.get("cms-parent-origin")?.trim() || "";
  return isTrustedCmsParentOrigin(candidate, location.origin)
    ? new URL(candidate).origin
    : null;
}

export function prepareCmsEditDocument(location: Location = window.location) {
  if (!cmsParentOriginFromLocation(location)) return false;
  document.documentElement.dataset.routeLanguage = "ru";
  return true;
}

export function isCmsBridgeMessage(value: unknown): value is CmsBridgeMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  if (
    message.channel !== CMS_EDIT_BRIDGE_CHANNEL ||
    message.version !== CMS_EDIT_BRIDGE_VERSION ||
    typeof message.type !== "string"
  ) {
    return false;
  }
  if (message.type === "ready") return true;
  if (message.type === "preview-update") {
    return (
      typeof message.key === "string" &&
      typeof message.value === "string" &&
      (message.mediaId === undefined || typeof message.mediaId === "string") &&
      ["text", "textarea", "image", "richtext"].includes(
        String(message.kind)
      )
    );
  }
  if (message.type === "preview-style-update") {
    return (
      typeof message.key === "string" &&
      message.key.length > 0 &&
      message.key.length <= 520 &&
      (message.reset === undefined || typeof message.reset === "boolean") &&
      isCompleteCmsHomepageVisualSettings(message.styles)
    );
  }
  if (message.type === "selection") {
    return (
      typeof message.key === "string" &&
      typeof message.field === "string" &&
      typeof message.value === "string" &&
      (message.mediaId === undefined || typeof message.mediaId === "string")
    );
  }
  if (message.type === "entity-open") {
    return (
      [
        "article",
        "book",
        "writer",
        "page",
        "homepage-block",
        "banner",
        "navigation-item",
      ].includes(
        String(message.entityType)
      ) &&
      typeof message.entityId === "string" &&
      typeof message.adminHref === "string"
    );
  }
  return false;
}

export function isTrustedCmsBridgeEvent(
  event: Pick<MessageEvent<unknown>, "origin" | "source" | "data">,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null
) {
  return (
    event.origin === expectedOrigin &&
    event.source === expectedSource &&
    isCmsBridgeMessage(event.data)
  );
}

function markerText(marker: HTMLElement, kind: CmsEditableKind) {
  if (marker.dataset.cmsValue !== undefined) return marker.dataset.cmsValue;
  if (kind === "image") {
    const image = marker.matches("img")
      ? (marker as HTMLImageElement)
      : marker.querySelector<HTMLImageElement>("img");
    return image?.currentSrc || image?.src || "";
  }
  return marker.textContent?.trim() || "";
}

const LEAF_TEXT_SELECTOR = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "blockquote",
  "figcaption",
  "summary",
  "label",
  "button",
  "a",
  "li",
  "dt",
  "dd",
  "strong",
  "small",
  "span",
].join(",");

function existingCopyIdentity(renderedText: string) {
  const snapshot = (
    cmsSiteContent as typeof cmsSiteContent & {
      siteCopy?: { ru?: Record<string, unknown> };
    }
  ).siteCopy?.ru;
  if (snapshot) {
    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value === "string" && value.trim() === renderedText) {
        return {
          key,
          sourceText: key.startsWith("interface.")
            ? key.slice("interface.".length)
            : renderedText,
        };
      }
    }
  }
  if (!isObservedInterfaceSourceText(renderedText)) return null;
  return { key: `interface.${renderedText}`, sourceText: renderedText };
}

function fallbackTextMarker(target: Element) {
  const marker = target.closest<HTMLElement>(LEAF_TEXT_SELECTOR);
  if (!marker || marker.closest("[data-cms-ignore]")) return null;
  // Text rendered by a CMS entity must be handled by an explicit field marker
  // or by that entity's native editor. Treating it as generic interface copy
  // would report a successful save without changing the owning CMS record.
  if (marker.closest("[data-cms-entity]")) return null;
  const sourceText = marker.textContent?.replace(/\s+/gu, " ").trim() || "";
  if (!sourceText || sourceText.length > 1_190) return null;

  const identity = existingCopyIdentity(sourceText);
  if (!identity) return null;
  const key = identity.key;
  marker.dataset.cmsKey = key;
  marker.dataset.cmsField = "siteCopy";
  marker.dataset.cmsKind = sourceText.length > 120 ? "textarea" : "text";
  marker.dataset.cmsLabel = "Текст интерфейса";
  marker.dataset.cmsValue = sourceText;
  marker.dataset.cmsCopyKey = key;
  marker.dataset.cmsSourceText = identity.sourceText;
  return marker;
}

export function shouldPreferCmsLeafText(
  explicitKind: string | undefined,
  clickedExplicitMarker: boolean,
  hasLeafText: boolean
) {
  return explicitKind === "image" && !clickedExplicitMarker && hasLeafText;
}

export function shouldBypassCmsSelection(
  modifiers: Pick<MouseEvent, "shiftKey" | "altKey">
) {
  return modifiers.shiftKey || modifiers.altKey;
}

export function shouldRouteCmsFieldToNativeEditor(
  entityType: string | undefined,
  field: string | undefined
) {
  return entityType === "page" && field === "contentHtml";
}

export function validatedCmsPreviewHref(field: string, value: string) {
  if (!["href", "targetUrl", "buttonUrl"].includes(field)) return null;
  const normalized = value.trim();
  if (!normalized) return "";
  if (
    normalized.startsWith("/") &&
    !normalized.startsWith("//") &&
    !normalized.includes("\\")
  ) {
    return normalized;
  }
  if (
    (field === "href" || field === "buttonUrl") &&
    normalized.startsWith("#")
  ) {
    return normalized;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === "https:") return url.toString();
    if (field === "buttonUrl" && url.protocol === "mailto:") {
      return url.toString();
    }
  } catch {
    // Invalid drafts stay visible in the inspector but never reach href.
  }
  return null;
}

function updateLinkTargetPreview(
  marker: HTMLElement,
  message: CmsPreviewUpdateMessage
) {
  const field = marker.dataset.cmsField || "";
  if (!["href", "targetUrl", "buttonUrl"].includes(field)) return false;
  const href = validatedCmsPreviewHref(field, message.value);
  if (href === null) return true;
  const anchor = marker.matches("a")
    ? (marker as HTMLAnchorElement)
    : marker.closest<HTMLAnchorElement>("a");
  if (!anchor) return true;
  if (href) anchor.setAttribute("href", href);
  else anchor.removeAttribute("href");
  return true;
}

function updateBannerMediaPreview(
  marker: HTMLElement,
  message: CmsPreviewUpdateMessage
) {
  if (
    marker.dataset.cmsEntity !== "banner" ||
    ![
      "desktopMediaId",
      "tabletMediaId",
      "mobileMediaId",
    ].includes(marker.dataset.cmsField || "")
  ) {
    return false;
  }
  const banner = marker.closest<HTMLElement>(".cms-banner");
  const picture = banner?.querySelector<HTMLPictureElement>("picture");
  if (!banner || !picture) return true;
  const field = marker.dataset.cmsField;
  if (field === "desktopMediaId") {
    const image = picture.querySelector<HTMLImageElement>("img");
    if (message.value) image?.setAttribute("src", message.value);
    else image?.removeAttribute("src");
  } else {
    const media = field === "mobileMediaId" ? "640px" : "1024px";
    const source = Array.from(
      picture.querySelectorAll<HTMLSourceElement>("source")
    ).find((item) => item.media.includes(media));
    if (message.value) source?.setAttribute("srcset", message.value);
    else source?.removeAttribute("srcset");
  }
  const hasImage = Boolean(
    picture.querySelector('img[src], source[srcset]')
  );
  banner.classList.toggle("has-image", hasImage);
  return true;
}

function updateHomepageBlockPreview(
  marker: HTMLElement,
  message: CmsPreviewUpdateMessage
) {
  if (marker.dataset.cmsEntity !== "homepage-block") return false;
  const block = marker.closest<HTMLElement>(".cms-home-block");
  if (!block) return true;
  if (marker.dataset.cmsField === "backgroundStyle") {
    ["light", "violet", "orange", "paper", "transparent"].forEach((style) =>
      block.classList.remove(`is-${style}`)
    );
    block.classList.add(`is-${message.value}`);
    return true;
  }
  if (marker.dataset.cmsField === "backgroundMediaId") {
    if (message.value) {
      block.style.setProperty(
        "--cms-background-image",
        `url(${JSON.stringify(message.value)})`
      );
      block.classList.add("has-cms-background");
    } else {
      block.style.removeProperty("--cms-background-image");
      block.classList.remove("has-cms-background");
    }
    return true;
  }
  return false;
}

function updatePreviewMarker(message: CmsPreviewUpdateMessage) {
  const markers = document.querySelectorAll<HTMLElement>("[data-cms-key]");
  markers.forEach((marker) => {
    if (marker.dataset.cmsKey !== message.key) return;
    marker.dataset.cmsValue = message.value;
    if (message.mediaId !== undefined) {
      marker.dataset.cmsMediaId = message.mediaId;
    }
    if (updateHomepageBlockPreview(marker, message)) return;
    if (updateLinkTargetPreview(marker, message)) return;
    if (message.kind === "image") {
      if (
        marker.dataset.cmsEntity === "homepage-core" &&
        marker.dataset.cmsField === "backgroundMediaId"
      ) {
        if (message.value) {
          marker.style.setProperty(
            "--cms-core-background",
            `url(${JSON.stringify(message.value)})`
          );
          marker.classList.add("has-cms-background");
        } else {
          marker.style.removeProperty("--cms-core-background");
          marker.classList.remove("has-cms-background");
        }
        return;
      }
      if (updateBannerMediaPreview(marker, message)) return;
      let image = marker.matches("img")
        ? (marker as HTMLImageElement)
        : marker.querySelector<HTMLImageElement>("img");
      if (
        !image &&
        message.value &&
        marker.dataset.cmsEntity === "writer" &&
        marker.dataset.cmsField === "portrait"
      ) {
        image = document.createElement("img");
        image.alt = "";
        image.decoding = "async";
        marker.append(image);
      }
      if (image && message.value) image.src = message.value;
      if (
        marker.dataset.cmsEntity === "writer" &&
        marker.dataset.cmsField === "portrait"
      ) {
        if (message.value) {
          marker.classList.add("has-image");
          marker.classList.remove("is-placeholder");
        } else {
          image?.remove();
          marker.classList.remove("has-image");
          marker.classList.add("is-placeholder");
        }
      }
      if (message.value) {
        marker.style.setProperty(
          "--cms-core-background",
          `url(${JSON.stringify(message.value)})`
        );
        marker.classList.add("has-cms-background");
      } else {
        marker.style.removeProperty("--cms-core-background");
        marker.classList.remove("has-cms-background");
      }
      return;
    }
    if (marker.matches("ol, ul")) {
      const items = message.value
        .split(/\r?\n/gu)
        .map((item) => item.trim())
        .filter(Boolean);
      marker.replaceChildren(
        ...items.map((item) => {
          const child = document.createElement("li");
          child.textContent = item;
          return child;
        })
      );
      return;
    }
    marker.textContent = message.value;
  });
}

function updatePreviewStyles(message: CmsPreviewStyleUpdateMessage) {
  const markers = document.querySelectorAll<HTMLElement>("[data-cms-key]");
  const blocks = new Set<HTMLElement>();
  markers.forEach((marker) => {
    if (marker.dataset.cmsKey !== message.key) return;
    if (
      marker.dataset.cmsEntity !== "homepage-block" &&
      marker.dataset.cmsEntity !== "homepage-core"
    ) return;
    const block = marker.closest<HTMLElement>(
      ".cms-home-block, .cms-core-editable"
    );
    if (block) blocks.add(block);
  });
  blocks.forEach((block) => {
    cmsHomepageVisualCssVariables.forEach((property) =>
      block.style.removeProperty(property)
    );
    if (message.reset) return;
    Object.entries(cmsHomepageVisualCssProperties(message.styles)).forEach(
      ([property, value]) => block.style.setProperty(property, value)
    );
  });
}

function makeEnvelope() {
  return {
    channel: CMS_EDIT_BRIDGE_CHANNEL,
    version: CMS_EDIT_BRIDGE_VERSION,
  } as const;
}

export default function CmsDirectEditBridge() {
  useEffect(() => {
    if (window.parent === window) return;
    const parentOrigin = cmsParentOriginFromLocation(window.location);
    if (!parentOrigin) return;

    document.documentElement.classList.add("cms-edit-mode");

    const post = (message: CmsBridgeMessage) => {
      window.parent.postMessage(message, parentOrigin);
    };

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      // Shift/Alt temporarily switches the preview back to its normal
      // interactive behaviour (globe, accordions, sliders, etc.). The bridge
      // must not cancel or stop that event in capture phase.
      if (shouldBypassCmsSelection(event)) return;
      const navigationAnchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if ((event.ctrlKey || event.metaKey) && navigationAnchor) {
        const target = new URL(navigationAnchor.href, window.location.href);
        if (target.origin === window.location.origin) {
          target.searchParams.set("cms-edit", "1");
          target.searchParams.set("cms-parent-origin", parentOrigin);
          event.preventDefault();
          event.stopPropagation();
          window.location.assign(target);
        }
        return;
      }
      const explicitMarker = event.target.closest<HTMLElement>(
        "[data-cms-key], [data-cms-entity]"
      );
      const fallbackMarker =
        !explicitMarker || explicitMarker.dataset.cmsKind === "image"
          ? fallbackTextMarker(event.target)
          : null;
      const marker = shouldPreferCmsLeafText(
        explicitMarker?.dataset.cmsKind,
        explicitMarker === event.target,
        Boolean(fallbackMarker)
      )
        ? fallbackMarker
        : explicitMarker || fallbackMarker;
      if (!marker) return;

      event.preventDefault();
      event.stopPropagation();
      document
        .querySelectorAll<HTMLElement>(".is-cms-selected")
        .forEach((item) => item.classList.remove("is-cms-selected"));
      marker.classList.add("is-cms-selected");

      const key = marker.dataset.cmsKey;
      if (
        key &&
        shouldRouteCmsFieldToNativeEditor(
          marker.dataset.cmsEntity,
          marker.dataset.cmsField
        ) &&
        marker.dataset.cmsAdminHref
      ) {
        post({
          ...makeEnvelope(),
          type: "entity-open",
          entityType: "page",
          entityId: marker.dataset.cmsEntityId || "",
          label: marker.dataset.cmsLabel || "Страница",
          adminHref: marker.dataset.cmsAdminHref,
        });
        return;
      }
      if (key) {
        const kind = (["text", "textarea", "image", "richtext"].includes(
          marker.dataset.cmsKind || ""
        )
          ? marker.dataset.cmsKind
          : "text") as CmsEditableKind;
        post({
          ...makeEnvelope(),
          type: "selection",
          key,
          copyKey: marker.dataset.cmsCopyKey || "",
          sourceText: marker.dataset.cmsSourceText || markerText(marker, kind),
          field: marker.dataset.cmsField || "",
          kind,
          label: marker.dataset.cmsLabel || marker.dataset.cmsField || key,
          value: markerText(marker, kind),
          href:
            marker instanceof HTMLAnchorElement
              ? marker.getAttribute("href") || ""
              : "",
          entityType: marker.dataset.cmsEntity || "",
          entityId: marker.dataset.cmsEntityId || "",
          mediaId: marker.dataset.cmsMediaId || "",
        });
        return;
      }

      const entityType = marker.dataset.cmsEntity;
      if (
        !entityType ||
        ![
          "article",
          "book",
          "writer",
          "page",
          "homepage-block",
          "banner",
          "navigation-item",
        ].includes(
          entityType
        )
      ) {
        return;
      }
      post({
        ...makeEnvelope(),
        type: "entity-open",
        entityType: entityType as CmsEntityOpenMessage["entityType"],
        entityId: marker.dataset.cmsEntityId || "",
        label: marker.dataset.cmsLabel || marker.dataset.cmsEntityId || "",
        adminHref: marker.dataset.cmsAdminHref || "",
      });
    };

    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isTrustedCmsBridgeEvent(event, parentOrigin, window.parent)) return;
      const message = event.data;
      if (!isCmsBridgeMessage(message)) return;
      if (message.type === "preview-update") {
        updatePreviewMarker(message);
      }
      if (message.type === "preview-style-update") {
        updatePreviewStyles(message);
      }
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("message", onMessage);
    post({ ...makeEnvelope(), type: "ready" });

    return () => {
      document.documentElement.classList.remove("cms-edit-mode");
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
