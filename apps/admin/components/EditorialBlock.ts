import { mergeAttributes, Node, type Editor } from "@tiptap/core";

const blockKinds = new Set([
  "fact",
  "accent",
  "columns",
  "timeline",
  "metrics",
  "ornament",
  "gallery",
]);
const revealKinds = new Set(["none", "fade-up", "slide-left", "zoom-in"]);

function safeValue(value: unknown, allowed: Set<string>, fallback: string) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

export const EditorialBlock = Node.create({
  name: "editorialBlock",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      kind: {
        default: "fact",
        parseHTML: (element) =>
          safeValue(element.getAttribute("data-editorial-block"), blockKinds, "fact"),
        renderHTML: ({ kind }) => ({
          "data-editorial-block": safeValue(kind, blockKinds, "fact"),
        }),
      },
      reveal: {
        default: "fade-up",
        parseHTML: (element) =>
          safeValue(element.getAttribute("data-reveal"), revealKinds, "none"),
        renderHTML: ({ reveal }) => ({
          "data-reveal": safeValue(reveal, revealKinds, "none"),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-editorial-block]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = safeValue(node.attrs.kind, blockKinds, "fact");
    const reveal = safeValue(node.attrs.reveal, revealKinds, "none");
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: `article-design-block is-${kind}`,
        "data-editorial-block": kind,
        "data-reveal": reveal,
      }),
      0,
    ];
  },
});

const blockCopy = {
  fact: ["Интересный факт", "Добавьте проверенный факт и укажите источник."],
  accent: ["Ключевая мысль", "Сформулируйте главный редакционный вывод."],
  columns: ["Две перспективы", "Первая колонка.", "Вторая колонка."],
  timeline: ["Хронология", "Год — событие.", "Год — событие."],
  metrics: ["В цифрах", "00 — пояснение показателя.", "00 — пояснение показателя."],
  ornament: ["Новая глава", "Короткая вводная строка к следующей части."],
} as const;

export type EditorialBlockKind = keyof typeof blockCopy;

export function insertEditorialBlock(editor: Editor | null, kind: EditorialBlockKind) {
  if (!editor) return;
  const [title, ...paragraphs] = blockCopy[kind];
  editor
    .chain()
    .focus()
    .insertContent({
      type: "editorialBlock",
      attrs: { kind, reveal: "fade-up" },
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: title }],
        },
        ...paragraphs.map((text) => ({
          type: "paragraph",
          content: [{ type: "text", text }],
        })),
      ],
    })
    .run();
}

export function setEditorialBlockReveal(
  editor: Editor | null,
  reveal: "none" | "fade-up" | "slide-left" | "zoom-in"
) {
  editor?.chain().focus().updateAttributes("editorialBlock", { reveal }).run();
}

export function insertEditorialGallery(editor: Editor | null, urls: string[]) {
  if (!editor || !urls.length) return;
  editor
    .chain()
    .focus()
    .insertContent({
      type: "editorialBlock",
      attrs: { kind: "gallery", reveal: "fade-up" },
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Галерея" }],
        },
        ...urls.slice(0, 6).map((src) => ({
          type: "image",
          attrs: { src, alt: "" },
        })),
      ],
    })
    .run();
}
