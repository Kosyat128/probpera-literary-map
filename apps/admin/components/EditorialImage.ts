import Image from "@tiptap/extension-image";
import type { Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
  editorialImageHtmlAttributes,
  normalizeEditorialImageAttributes,
} from "../lib/editorial-media-content";

import EditorialImageView from "./EditorialImageView";

export type { EditorialImageLayout } from "../lib/editorial-media-content";

export const EditorialImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      layout: {
        default: "wide",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            layout: element.getAttribute("data-image-layout"),
          }).layout,
        renderHTML: (attributes) => editorialImageHtmlAttributes(attributes),
      },
      width: {
        default: 100,
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            width: element.getAttribute("data-image-width"),
          }).width,
        renderHTML: () => ({}),
      },
      maxWidth: {
        default: 0,
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            maxWidth: element.getAttribute("data-image-max-width"),
          }).maxWidth,
        renderHTML: () => ({}),
      },
      aspect: {
        default: "auto",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            aspect: element.getAttribute("data-image-aspect"),
          }).aspect,
        renderHTML: () => ({}),
      },
      fit: {
        default: "contain",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            fit: element.getAttribute("data-image-fit"),
          }).fit,
        renderHTML: () => ({}),
      },
      focusX: {
        default: 0.5,
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            focusX: element.getAttribute("data-focus-x"),
          }).focusX,
        renderHTML: () => ({}),
      },
      focusY: {
        default: 0.5,
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            focusY: element.getAttribute("data-focus-y"),
          }).focusY,
        renderHTML: () => ({}),
      },
      credit: {
        default: "",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            credit: element.getAttribute("data-credit"),
          }).credit,
        renderHTML: () => ({}),
      },
      source: {
        default: "",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            source: element.getAttribute("data-source"),
          }).source,
        renderHTML: () => ({}),
      },
      license: {
        default: "",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            license: element.getAttribute("data-license"),
          }).license,
        renderHTML: () => ({}),
      },
      licenseUrl: {
        default: "",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            licenseUrl: element.getAttribute("data-license-url"),
          }).licenseUrl,
        renderHTML: () => ({}),
      },
      link: {
        default: "",
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            link: element.getAttribute("data-link"),
          }).link,
        renderHTML: () => ({}),
      },
      lightbox: {
        default: true,
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            lightbox: element.getAttribute("data-lightbox"),
          }).lightbox,
        renderHTML: () => ({}),
      },
      decorative: {
        default: false,
        parseHTML: (element) =>
          normalizeEditorialImageAttributes({
            decorative: element.getAttribute("data-decorative"),
          }).decorative,
        renderHTML: () => ({}),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || "",
        renderHTML: ({ caption }) =>
          typeof caption === "string" && caption.trim()
            ? { "data-caption": caption.trim().slice(0, 600) }
            : {},
      },
      mediaId: {
        default: null,
        parseHTML: (element) => {
          const value = element.getAttribute("data-media-id")?.trim();
          return value || null;
        },
        renderHTML: ({ mediaId }) =>
          typeof mediaId === "string" && mediaId.trim()
            ? { "data-media-id": mediaId.trim() }
            : {},
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorialImageView);
  },
}).configure({
  inline: false,
  allowBase64: false,
});

export function updateEditorialImageAt(
  editor: Editor | null,
  position: number,
  attributes: Record<string, unknown>,
  expectedSrc?: string
) {
  if (!editor || !Number.isInteger(position) || position < 0) return false;
  const image = editor.state.doc.nodeAt(position);
  if (!image || image.type.name !== "image") return false;
  const currentSrc =
    typeof image.attrs.src === "string" ? image.attrs.src : "";
  if (expectedSrc !== undefined && currentSrc !== expectedSrc) return false;
  editor.view.dispatch(
    editor.state.tr
      .setNodeMarkup(position, undefined, {
        ...image.attrs,
        ...attributes,
      })
      .scrollIntoView()
  );
  editor.commands.setNodeSelection(position);
  return true;
}
