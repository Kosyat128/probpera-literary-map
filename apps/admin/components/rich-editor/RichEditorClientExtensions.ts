"use client";

import { ReactNodeViewRenderer } from "@tiptap/react";
import EditorialBlockView from "@/components/EditorialBlockView";
import EditorialImageView from "@/components/EditorialImageView";
import {
  createRichEditorExtensions as createSchemaExtensions,
  type RichEditorExtensionsOptions,
} from "./RichEditorExtensions";

/** Attach browser views to the same ordered schema used by server validation. */
export function createRichEditorExtensions(options: RichEditorExtensionsOptions) {
  return createSchemaExtensions(options).map((extension) => {
    if (extension.name === "editorialBlock") {
      return extension.extend({
        addNodeView() { return ReactNodeViewRenderer(EditorialBlockView); },
      });
    }
    if (extension.name === "image") {
      return extension.extend({
        addNodeView() { return ReactNodeViewRenderer(EditorialImageView); },
      });
    }
    return extension;
  });
}
