import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import { EditorialImage } from "@/components/EditorialImage";

export type RichEditorExtensionsOptions = {
  placeholder: string;
  afterStarterKit?: Extensions;
  afterImage?: Extensions;
};

/**
 * One ordered extension foundation for Article and Page editors.
 *
 * The two insertion points keep existing product-specific nodes in their
 * original order, so extracting the foundation does not alter the persisted
 * TipTap JSON or generated HTML.
 */
export function createRichEditorExtensions({
  placeholder,
  afterStarterKit = [],
  afterImage = [],
}: RichEditorExtensionsOptions): Extensions {
  return [
    StarterKit.configure({
      link: false,
      underline: false,
    }),
    ...afterStarterKit,
    TableKit,
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
    EditorialImage,
    ...afterImage,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder }),
  ];
}
