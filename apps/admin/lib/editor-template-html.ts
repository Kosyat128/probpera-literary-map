import sanitizeHtml from "sanitize-html";

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
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
};

export function sanitizeEditorTemplateHtml(source: string) {
  return sanitizeHtml(source, safeEditorTemplateHtml);
}
