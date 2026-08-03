import Image from "@tiptap/extension-image";

export type EditorialImageLayout = "wide" | "normal" | "left" | "right";

const layouts = new Set<EditorialImageLayout>([
  "wide",
  "normal",
  "left",
  "right",
]);

function imageLayout(value: unknown): EditorialImageLayout {
  return typeof value === "string" && layouts.has(value as EditorialImageLayout)
    ? (value as EditorialImageLayout)
    : "wide";
}

export const EditorialImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      layout: {
        default: "wide",
        parseHTML: (element) => imageLayout(element.getAttribute("data-image-layout")),
        renderHTML: ({ layout }) => ({
          class: `article-image is-${imageLayout(layout)}`,
          "data-image-layout": imageLayout(layout),
        }),
      },
      caption: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-caption") || "",
        renderHTML: ({ caption }) =>
          typeof caption === "string" && caption.trim()
            ? { "data-caption": caption.trim().slice(0, 600) }
            : {},
      },
    };
  },
}).configure({
  inline: false,
  allowBase64: false,
});
