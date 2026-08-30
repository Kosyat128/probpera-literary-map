import { mergeAttributes, Node, type Editor } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

import {
  editorialGalleryHtmlAttributes,
  normalizeEditorialGalleryItems,
  normalizeEditorialGallerySettings,
  parseEditorialGalleryElement,
  type EditorialGalleryItemInput,
  type EditorialGalleryKind,
  type EditorialGallerySettings,
} from "../lib/editorial-gallery";

import EditorialBlockView from "./EditorialBlockView";

const blockKinds = new Set([
  "fact",
  "accent",
  "columns",
  "timeline",
  "metrics",
  "ornament",
  "gallery",
  "slider",
  "media",
]);
const revealKinds = new Set(["none", "fade-up", "slide-left", "zoom-in"]);

function safeValue(value: unknown, allowed: Set<string>, fallback: string) {
  return typeof value === "string" && allowed.has(value) ? value : fallback;
}

function collectionKind(element: HTMLElement): EditorialGalleryKind {
  return element.getAttribute("data-editorial-block") === "slider"
    ? "slider"
    : "gallery";
}

function parsedGallerySetting(
  element: HTMLElement,
  key: keyof EditorialGallerySettings
) {
  return parseEditorialGalleryElement(element, collectionKind(element))[key];
}

const hiddenGalleryAttribute = (
  key: keyof EditorialGallerySettings,
  defaultValue: unknown
) => ({
  default: defaultValue,
  parseHTML: (element: HTMLElement) => parsedGallerySetting(element, key),
  renderHTML: () => ({}),
});

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
      galleryVersion: hiddenGalleryAttribute("version", 1),
      galleryId: hiddenGalleryAttribute("id", ""),
      galleryColumnsDesktop: hiddenGalleryAttribute("columnsDesktop", 2),
      galleryColumnsTablet: hiddenGalleryAttribute("columnsTablet", 2),
      galleryColumnsMobile: hiddenGalleryAttribute("columnsMobile", 1),
      galleryGap: hiddenGalleryAttribute("gap", "normal"),
      galleryAspect: hiddenGalleryAttribute("aspect", "auto"),
      galleryFit: hiddenGalleryAttribute("fit", "contain"),
      galleryCaptions: hiddenGalleryAttribute("captions", true),
      galleryLightbox: hiddenGalleryAttribute("lightbox", true),
      sliderArrows: hiddenGalleryAttribute("arrows", true),
      sliderDots: hiddenGalleryAttribute("dots", true),
      sliderAutoplay: hiddenGalleryAttribute("autoplay", false),
      sliderInterval: hiddenGalleryAttribute("interval", 5000),
      sliderLoop: hiddenGalleryAttribute("loop", true),
    };
  },

  parseHTML() {
    return [{ tag: "section[data-editorial-block]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const kind = safeValue(node.attrs.kind, blockKinds, "fact");
    const reveal = safeValue(node.attrs.reveal, revealKinds, "none");
    const galleryAttributes =
      kind === "gallery" || kind === "slider"
        ? editorialGalleryHtmlAttributes(
            {
              version: node.attrs.galleryVersion,
              id: node.attrs.galleryId,
              columnsDesktop: node.attrs.galleryColumnsDesktop,
              columnsTablet: node.attrs.galleryColumnsTablet,
              columnsMobile: node.attrs.galleryColumnsMobile,
              gap: node.attrs.galleryGap,
              aspect: node.attrs.galleryAspect,
              fit: node.attrs.galleryFit,
              captions: node.attrs.galleryCaptions,
              lightbox: node.attrs.galleryLightbox,
              arrows: node.attrs.sliderArrows,
              dots: node.attrs.sliderDots,
              autoplay: node.attrs.sliderAutoplay,
              interval: node.attrs.sliderInterval,
              loop: node.attrs.sliderLoop,
            },
            kind
          )
        : {};
    return [
      "section",
      mergeAttributes(HTMLAttributes, {
        class: `article-design-block is-${kind}`,
        "data-editorial-block": kind,
        "data-reveal": reveal,
        ...galleryAttributes,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditorialBlockView);
  },
});

const blockCopy = {
  fact: ["Интересный факт", "Добавьте проверенный факт и укажите источник."],
  accent: ["Ключевая мысль", "Сформулируйте главный редакционный вывод."],
  columns: ["Две перспективы", "Первая колонка.", "Вторая колонка."],
  timeline: ["Хронология", "Год - событие.", "Год - событие."],
  metrics: ["В цифрах", "00 - пояснение показателя.", "00 - пояснение показателя."],
  ornament: ["Новая глава", "Короткая вводная строка к следующей части."],
  media: [
    "Место для изображения",
    "Нажмите на квадрат и выберите файл с компьютера или перетащите его сюда.",
  ],
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

export function insertEditorialGallery(
  editor: Editor | null,
  items: ReadonlyArray<string | EditorialGalleryItemInput>,
  altContext = "статье",
  settings?: Partial<EditorialGallerySettings>
) {
  insertEditorialMediaCollection(editor, items, "gallery", altContext, settings);
}

export function insertEditorialSlider(
  editor: Editor | null,
  items: ReadonlyArray<string | EditorialGalleryItemInput>,
  altContext = "статье",
  settings?: Partial<EditorialGallerySettings>
) {
  insertEditorialMediaCollection(editor, items, "slider", altContext, settings);
}

function insertEditorialMediaCollection(
  editor: Editor | null,
  inputItems: ReadonlyArray<string | EditorialGalleryItemInput>,
  kind: EditorialGalleryKind,
  altContext: string,
  inputSettings?: Partial<EditorialGallerySettings>
) {
  const items = normalizeEditorialGalleryItems(inputItems);
  if (!editor || !items.length) return;
  const settings = normalizeEditorialGallerySettings(
    inputSettings || {},
    kind,
    { createId: true }
  );
  editor
    .chain()
    .focus()
    .insertContent({
      type: "editorialBlock",
      attrs: {
        kind,
        reveal: "fade-up",
        galleryVersion: settings.version,
        galleryId: settings.id,
        galleryColumnsDesktop: settings.columnsDesktop,
        galleryColumnsTablet: settings.columnsTablet,
        galleryColumnsMobile: settings.columnsMobile,
        galleryGap: settings.gap,
        galleryAspect: settings.aspect,
        galleryFit: settings.fit,
        galleryCaptions: settings.captions,
        galleryLightbox: settings.lightbox,
        sliderArrows: settings.arrows,
        sliderDots: settings.dots,
        sliderAutoplay: settings.autoplay,
        sliderInterval: settings.interval,
        sliderLoop: settings.loop,
      },
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [
            {
              type: "text",
              text: kind === "slider" ? "Слайдер изображений" : "Галерея",
            },
          ],
        },
        ...items.map((item, index) => ({
          type: "image",
          attrs: {
            src: item.src,
            mediaId: item.mediaId,
            alt:
              item.alt ||
              `Иллюстрация к ${altContext} - изображение ${index + 1}`,
            caption: item.caption,
            credit: item.credit,
            source: item.source,
            license: item.license,
            licenseUrl: item.licenseUrl,
            link: item.link,
          },
        })),
      ],
    })
    .run();
}

export function replaceSelectedMediaSlot(
  editor: Editor | null,
  attributes: {
    src: string;
    alt: string;
    caption?: string;
    layout?: "wide" | "normal" | "full" | "left" | "right";
  }
) {
  if (!editor) return false;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (
      node.type.name === "editorialBlock" &&
      node.attrs.kind === "media"
    ) {
      const imageType = editor.state.schema.nodes.image;
      if (!imageType) return false;
      const from = $from.before(depth);
      return replaceMediaSlotAt(editor, from, attributes);
    }
  }
  return false;
}

export function replaceMediaSlotAt(
  editor: Editor | null,
  position: number,
  attributes: {
    src: string;
    alt: string;
    caption?: string;
    layout?: "wide" | "normal" | "full" | "left" | "right";
  }
) {
  if (!editor || !Number.isInteger(position) || position < 0) return false;
  const slot = editor.state.doc.nodeAt(position);
  const imageType = editor.state.schema.nodes.image;
  if (
    !slot ||
    slot.type.name !== "editorialBlock" ||
    slot.attrs.kind !== "media" ||
    !imageType
  ) {
    return false;
  }
  editor.view.dispatch(
    editor.state.tr
      .replaceWith(
        position,
        position + slot.nodeSize,
        imageType.create(attributes)
      )
      .scrollIntoView()
  );
  editor.commands.focus();
  return true;
}
