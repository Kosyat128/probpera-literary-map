import Image from "@tiptap/extension-image";
import type { Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import EditorialImageView from "./EditorialImageView";

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
