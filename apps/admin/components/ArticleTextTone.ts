import { Mark, mergeAttributes } from "@tiptap/core";

import {
  articleTextTone,
  type ArticleTextTone as ArticleTextToneValue,
} from "@/lib/article-content-presentation";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textTone: {
      setTextTone: (tone: ArticleTextToneValue) => ReturnType;
      unsetTextTone: () => ReturnType;
    };
  }
}

export const ArticleTextTone = Mark.create({
  name: "textTone",

  addAttributes() {
    return {
      tone: {
        default: null,
        parseHTML: (element) =>
          articleTextTone(element.getAttribute("data-text-tone")),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-text-tone]",
        getAttrs: (element) =>
          typeof element === "object" &&
          element !== null &&
          "getAttribute" in element &&
          articleTextTone(
            (element as { getAttribute: (name: string) => string | null }).getAttribute(
              "data-text-tone"
            )
          )
            ? null
            : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const tone = articleTextTone(HTMLAttributes.tone);
    if (!tone) return ["span", {}, 0];
    return [
      "span",
      mergeAttributes({
        class: `article-text-tone is-tone-${tone}`,
        "data-text-tone": tone,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setTextTone:
        (tone: ArticleTextToneValue) =>
        ({ commands }) =>
          Boolean(articleTextTone(tone)) && commands.setMark(this.name, { tone }),
      unsetTextTone:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
