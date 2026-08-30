import sanitizeHtml from "sanitize-html";

import {
  editorialImageDataAttributes,
  safeEditorialImageHtmlAttributes,
} from "./editorial-media-content";
import {
  editorialGalleryAttributeNames,
  safeEditorialGalleryHtmlAttributes,
} from "./editorial-gallery";

const safeEditorTemplateHtml = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "mark",
    "aside",
    "section",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": [
      "class",
      "id",
      "data-editorial-block",
      "data-reveal",
      "data-image-layout",
      "data-caption",
      "data-media-id",
      ...editorialImageDataAttributes,
      ...editorialGalleryAttributeNames,
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    img: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeEditorialImageHtmlAttributes(attributes),
    }),
    section: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeEditorialGalleryHtmlAttributes(attributes),
    }),
  },
};

export function sanitizeEditorTemplateHtml(source: string) {
  return sanitizeHtml(source, safeEditorTemplateHtml);
}
