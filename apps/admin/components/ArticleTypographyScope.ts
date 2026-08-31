import { Mark, mergeAttributes } from "@tiptap/core";

import {
  articleTypographyScope,
  type ArticleTypographyScope as ArticleTypographyScopeValue,
} from "@/lib/article-content-presentation";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    typographyScope: {
      setTypographyScope: (scope: ArticleTypographyScopeValue) => ReturnType;
      unsetTypographyScope: () => ReturnType;
    };
  }
}

export const ArticleTypographyScope = Mark.create({
  name: "typographyScope",

  addAttributes() {
    return {
      scope: {
        default: null,
        parseHTML: (element) =>
          articleTypographyScope(element.getAttribute("data-typography-scope")),
      },
    };
  },

  parseHTML() {
    return [{
      tag: "span[data-typography-scope]",
      getAttrs: (element) =>
        typeof element === "object" && element !== null && "getAttribute" in element &&
        articleTypographyScope(
          (element as { getAttribute: (name: string) => string | null }).getAttribute(
            "data-typography-scope"
          )
        )
          ? null
          : false,
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const scope = articleTypographyScope(HTMLAttributes.scope);
    if (!scope) return ["span", {}, 0];
    return [
      "span",
      mergeAttributes({
        class: `article-typography-scope is-scope-${scope}`,
        "data-typography-scope": scope,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setTypographyScope:
        (scope: ArticleTypographyScopeValue) =>
        ({ commands }) =>
          Boolean(articleTypographyScope(scope)) &&
          commands.setMark(this.name, { scope }),
      unsetTypographyScope:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
});
