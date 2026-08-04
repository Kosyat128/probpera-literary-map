"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import NextLink from "next/link";
import type { DragEvent as ReactDragEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { createSlug } from "@/lib/slug";
import { saveArticleAction } from "@/app/(dashboard)/articles/actions";
import {
  deleteEditorTemplateAction,
  saveEditorTemplateAction,
} from "@/app/(dashboard)/articles/template-actions";
import { articlePublicPath } from "@/lib/article-route";
import {
  EditorialBlock,
  insertEditorialBlock,
  insertEditorialGallery,
  insertEditorialSlider,
  replaceSelectedMediaSlot,
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";
import {
  EditorialImage,
  type EditorialImageLayout,
} from "@/components/EditorialImage";

type Category = { id: string; name: string; slug: string };
type ImageUploadTarget = "article" | "cover";
type ImageSelectionContext = {
  selectedImage: boolean;
  attributes: Record<string, unknown>;
  insertionPos?: number;
};
type Article = {
  id?: string;
  title?: string;
  subtitle?: string;
  excerpt?: string;
  slug?: string;
  content_html?: string;
  content_json?: unknown;
  category_id?: string | null;
  status?: string;
  scheduled_at?: string | null;
  cover_external_url?: string | null;
  cover_alt?: string;
  legacy_path?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  featured?: boolean;
  show_on_homepage?: boolean;
  pinned?: boolean;
  sources?: unknown;
  bibliography?: unknown;
  seo_keywords?: string[];
  og_title?: string | null;
  og_description?: string | null;
  allow_indexing?: boolean;
};

function mediaSlot(label: string, hint: string) {
  return `<section class="article-design-block is-media" data-editorial-block="media" data-reveal="fade-up"><h3>${label}</h3><p>${hint}</p></section>`;
}

function suggestedAltText(file: File) {
  const label = file.name
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return label.length >= 3 ? label.slice(0, 500) : "Иллюстрация к статье";
}

function adminApiPath(path: string) {
  if (typeof window === "undefined") return path;
  const hasAdminPrefix =
    window.location.pathname === "/admin" ||
    window.location.pathname.startsWith("/admin/");
  return `${hasAdminPrefix ? "/admin" : ""}${path}`;
}

const articleTemplates = [
  {
    label: "Мнение о книге",
    html: `<aside class="article-lead"><p><strong>Предисловие</strong></p><p>Замените этот текст своим вступлением: почему книга заслуживает внимательного разговора.</p></aside>${mediaSlot("Обложка или главное изображение", "Поставьте курсор сюда и нажмите «Заменить место для фото».")}<h2>История создания и публикации</h2><p>Вставьте подготовленный текст раздела.</p><h2>О чём произведение</h2><p>Расскажите о завязке без лишних спойлеров.</p>${mediaSlot("Иллюстрация к сюжету", "Выберите изображение из медиатеки и добавьте точное описание.")}<h2>Темы, герои и художественный мир</h2><p>Вставьте основной разбор произведения.</p><section class="article-design-block is-accent" data-editorial-block="accent" data-reveal="fade-up"><h3>Ключевая мысль</h3><p>Замените этот текст главным редакционным выводом.</p></section><h2>Заключительное мнение о книге</h2><p>Сформулируйте итоговую оценку.</p><h2>Источники</h2><p>Источники также указываются в отдельном поле справа.</p>`,
  },
  {
    label: "Биография писателя",
    html: `<aside class="article-lead"><p><strong>Редакционное введение</strong></p><p>Замените текст: место писателя в литературе и причина обратиться к его судьбе.</p></aside>${mediaSlot("Портрет писателя", "Используйте проверенный портрет с понятным источником и лицензией.")}<h2>Детство и образование</h2><p>Вставьте текст раздела.</p><h2>Начало литературного пути</h2><p>Вставьте текст раздела.</p><section class="article-design-block is-timeline" data-editorial-block="timeline" data-reveal="fade-up"><h3>Хронология</h3><p>Год — важное событие.</p><p>Год — важное событие.</p></section><h2>Главные произведения</h2><p>Вставьте текст раздела.</p>${mediaSlot("Архивное изображение или рукопись", "Замените место изображением и добавьте содержательную подпись в медиатеке.")}<h2>Личная судьба и время</h2><p>Вставьте текст раздела.</p><h2>Наследие</h2><p>Сформулируйте взвешенный редакционный вывод.</p><h2>Источники и библиография</h2><p>Укажите проверяемые источники.</p>`,
  },
  {
    label: "Книга и экранизация",
    html: `<aside class="article-lead"><p><strong>Книга и её экранная версия</strong></p><p>Замените текст: что именно сравнивается и почему.</p></aside>${mediaSlot("Обложка литературного первоисточника", "Поставьте курсор сюда и замените место изображением.")}<h2>Литературный первоисточник</h2><p>Вставьте текст о книге.</p>${mediaSlot("Кадр или официальный постер экранизации", "Добавляйте только изображение с проверенным основанием использования.")}<h2>Экранная версия</h2><p>Вставьте текст об экранизации.</p><h2>Сюжет и композиция</h2><p>Сопоставьте решения книги и фильма.</p><section class="article-design-block is-columns" data-editorial-block="columns" data-reveal="fade-up"><h3>Книга и экран</h3><p>Книга: замените этот текст.</p><p>Экранизация: замените этот текст.</p></section><h2>Герои и актёрские работы</h2><p>Вставьте текст раздела.</p><h2>Что изменилось и что сохранилось</h2><p>Вставьте выводы сравнения.</p><h2>Итог</h2><p>Сформулируйте редакционную оценку.</p>`,
  },
  {
    label: "Большое эссе",
    html: `<aside class="article-lead"><p><strong>Предисловие</strong></p><p>Замените текст главным вопросом и редакционной позицией.</p></aside>${mediaSlot("Главное изображение эссе", "Поставьте курсор сюда и нажмите «Заменить место для фото».")}<h2>Контекст</h2><p>Вставьте текст раздела.</p><h2>Основная идея</h2><p>Разверните центральный тезис.</p><h2>Примеры и аргументы</h2><p>Вставьте основную часть эссе.</p><blockquote><p>Замените цитату и обязательно укажите источник.</p></blockquote>${mediaSlot("Вторая иллюстрация", "Используйте изображение как смысловую паузу, а не как украшение.")}<h2>Вывод</h2><p>Сформулируйте итог.</p><h2>Источники</h2><p>Укажите проверяемые источники.</p>`,
  },
] as const;

const LEGACY_TEMPLATES_KEY = "probpera-editor-custom-templates";
export type CustomTemplate = {
  id: string;
  label: string;
  html: string;
  visibility?: "personal" | "shared";
  canDelete?: boolean;
  localOnly?: boolean;
};

function listValue(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object" && "text" in item
          ? String(item.text || "")
          : ""
    )
    .filter(Boolean)
    .join("\n");
}

function hasStructuredContent(value: unknown): value is JSONContent {
  if (!value || typeof value !== "object" || !("content" in value)) return false;
  return Array.isArray(value.content) && value.content.length > 0;
}

function ToolbarButton({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : undefined}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {label}
    </button>
  );
}

export default function ArticleEditor({
  article,
  categories,
  publicSiteUrl,
  templates = [],
}: {
  article: Article;
  categories: Category[];
  publicSiteUrl: string;
  templates?: CustomTemplate[];
}) {
  const [title, setTitle] = useState(article.title || "");
  const [slug, setSlug] = useState(article.slug || "");
  const [categoryId, setCategoryId] = useState(article.category_id || "");
  const initialCategorySlug = categories.find(
    (category) => category.id === (article.category_id || "")
  )?.slug;
  const initialCanonical = `${publicSiteUrl}${articlePublicPath(
    article.slug || "adres-stati",
    initialCategorySlug
  )}`;
  const [canonicalUrl, setCanonicalUrl] = useState(
    initialCanonical
  );
  const [canonicalEdited, setCanonicalEdited] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(article.id));
  const [contentHtml, setContentHtml] = useState(article.content_html || "");
  const [contentJson, setContentJson] = useState(
    JSON.stringify(article.content_json || { type: "doc", content: [] })
  );
  const [savedLocallyAt, setSavedLocallyAt] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRecoveryCopy, setHasRecoveryCopy] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>(templates);
  const [templateMessage, setTemplateMessage] = useState("");
  const [mediaComposerKind, setMediaComposerKind] = useState<
    "gallery" | "slider" | null
  >(null);
  const [mediaComposerValue, setMediaComposerValue] = useState("");
  const [mediaComposerError, setMediaComposerError] = useState("");
  const [templatePending, startTemplateTransition] = useTransition();
  const [excerpt, setExcerpt] = useState(article.excerpt || "");
  const [status, setStatus] = useState(article.status || "draft");
  const [coverUrl, setCoverUrl] = useState(article.cover_external_url || "");
  const [coverAlt, setCoverAlt] = useState(article.cover_alt || "");
  const [imageUploadTarget, setImageUploadTarget] = useState<ImageUploadTarget | null>(null);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const [isImageDraggingOverEditor, setIsImageDraggingOverEditor] = useState(false);
  const articleFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const imageSelectionRef = useRef<ImageSelectionContext>({
    selectedImage: false,
    attributes: {},
  });
  const [seoDescription, setSeoDescription] = useState(article.seo_description || "");
  const [sourceText, setSourceText] = useState(listValue(article.sources));
  const initialEditorContent = hasStructuredContent(article.content_json)
    ? article.content_json
    : article.content_html || "";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      EditorialBlock,
      TableKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      EditorialImage,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder:
          "Начните писать. Для большого материала используйте подзаголовки — из них автоматически соберётся оглавление.",
      }),
    ],
    content: initialEditorContent,
    onUpdate({ editor: currentEditor }) {
      setContentHtml(currentEditor.getHTML());
      setContentJson(JSON.stringify(currentEditor.getJSON()));
      setIsDirty(true);
    },
  });

  useEffect(() => {
    if (!slugEdited) setSlug(createSlug(title));
  }, [slugEdited, title]);

  const selectedCategorySlug = categories.find(
    (category) => category.id === categoryId
  )?.slug;
  const generatedCanonical = `${publicSiteUrl}${articlePublicPath(
    slug || "adres-stati",
    selectedCategorySlug
  )}`;

  useEffect(() => {
    if (!canonicalEdited) setCanonicalUrl(generatedCanonical);
  }, [canonicalEdited, generatedCanonical]);

  useEffect(() => {
    const recoveryKey = `probpera-editor-${article.id || "new"}`;
    setHasRecoveryCopy(Boolean(window.localStorage.getItem(recoveryKey)));
  }, [article.id]);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        window.localStorage.getItem(LEGACY_TEMPLATES_KEY) || "[]"
      );
      if (Array.isArray(stored) && stored.length) {
        const legacy = stored.slice(0, 12).map((template: CustomTemplate) => ({
          ...template,
          id: `local-${template.id}`,
          localOnly: true,
          canDelete: true,
        }));
        setCustomTemplates((current) => [
          ...current,
          ...legacy.filter((item: CustomTemplate) =>
            !current.some((saved) => saved.label.toLocaleLowerCase("ru") === item.label.toLocaleLowerCase("ru"))
          ),
        ]);
      }
    } catch {
      window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
    }
  }, []);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const recoveryKey = `probpera-editor-${article.id || "new"}`;
      window.localStorage.setItem(
        recoveryKey,
        JSON.stringify({ title, slug, contentHtml, contentJson, savedAt: Date.now() })
      );
      setSavedLocallyAt(
        new Intl.DateTimeFormat("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
      setHasRecoveryCopy(true);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [article.id, contentHtml, contentJson, slug, title]);

  const wordCount = useMemo(() => {
    const text = editor?.getText().trim() || "";
    return text ? text.split(/\s+/u).length : 0;
  }, [contentHtml, editor]);

  const publicationChecks = useMemo(() => [
    { label: "Заголовок и постоянный адрес", ok: title.trim().length >= 3 && slug.length >= 2 },
    { label: "Рубрика выбрана", ok: Boolean(categoryId) },
    { label: "Не менее 250 слов", ok: wordCount >= 250 },
    { label: "Есть смысловые подзаголовки H2", ok: /<h2(?:\s|>)/iu.test(contentHtml) },
    { label: "Описание карточки — от 80 знаков", ok: excerpt.trim().length >= 80 },
    { label: "Обложка и её описание", ok: /^https:\/\//iu.test(coverUrl) && coverAlt.trim().length >= 10 },
    { label: "SEO-описание — от 80 знаков", ok: seoDescription.trim().length >= 80 },
    { label: "Указан хотя бы один источник", ok: sourceText.split(/\r?\n/u).some((item) => item.trim().length >= 5) },
    { label: "Все места для изображений заменены", ok: !/data-editorial-block=["']media["']/iu.test(contentHtml) },
  ], [categoryId, contentHtml, coverAlt, coverUrl, excerpt, seoDescription, slug, sourceText, title, wordCount]);
  const publicationReady = publicationChecks.every((item) => item.ok);

  const setLink = () => {
    const previousUrl = editor?.getAttributes("link").href || "";
    const url = window.prompt("Адрес ссылки", previousUrl);
    if (url === null || !editor) return;
    if (!url) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const addImage = () => {
    if (!editor) return;
    const selectedImage = editor.isActive("image")
      ? editor.getAttributes("image")
      : {};
    const url = window.prompt(
      editor.isActive("image")
        ? "Новый адрес выбранного изображения"
        : "Адрес изображения из медиатеки",
      typeof selectedImage.src === "string" ? selectedImage.src : ""
    );
    if (!url || !editor) return;
    const alt = window.prompt(
      "Кратко опишите изображение для читателей и поисковых систем",
      typeof selectedImage.alt === "string" ? selectedImage.alt : ""
    );
    if (alt === null) return;
    const caption = window.prompt(
      "Подпись под изображением (необязательно)",
      typeof selectedImage.caption === "string" ? selectedImage.caption : ""
    );
    if (caption === null) return;
    const attributes = {
      src: url,
      alt: alt.trim(),
      caption: caption.trim(),
      layout:
        typeof selectedImage.layout === "string"
          ? (selectedImage.layout as EditorialImageLayout)
          : "wide",
    };
    if (editor.isActive("image")) {
      editor.chain().focus().updateAttributes("image", attributes).run();
      setTemplateMessage("Выбранное изображение заменено.");
      return;
    }
    if (replaceSelectedMediaSlot(editor, attributes)) {
      setTemplateMessage("Место для изображения заполнено.");
      return;
    }
    editor.chain().focus().setImage(attributes).run();
    setTemplateMessage("Изображение вставлено в материал.");
  };

  const rememberImageSelection = () => {
    const selectedImage = Boolean(editor?.isActive("image"));
    imageSelectionRef.current = {
      selectedImage,
      attributes: selectedImage ? editor?.getAttributes("image") || {} : {},
      insertionPos: undefined,
    };
  };

  const handleEditorImageDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const file = Array.from(event.dataTransfer.files || []).find((item) =>
      item.type.startsWith("image/")
    );
    if (!file || !editor) return;

    event.preventDefault();
    event.stopPropagation();
    const coordinates = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    imageSelectionRef.current = {
      selectedImage: false,
      attributes: {},
      insertionPos: coordinates?.pos,
    };
    setIsImageDraggingOverEditor(false);
    void uploadImageFile(file, "article");
  };

  const openImagePicker = (target: ImageUploadTarget) => {
    setImageUploadError("");
    setImageUploadMessage("");
    if (target === "article") {
      rememberImageSelection();
      articleFileInputRef.current?.click();
      return;
    }
    coverFileInputRef.current?.click();
  };

  const uploadImageFile = async (file: File, target: ImageUploadTarget) => {
    const acceptedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ]);
    if (!acceptedTypes.has(file.type)) {
      setImageUploadError("Выберите изображение JPEG, PNG, WebP или AVIF.");
      return;
    }
    if (file.size <= 0 || file.size > 12 * 1024 * 1024) {
      setImageUploadError("Размер изображения должен быть не больше 12 МБ.");
      return;
    }

    const selection = imageSelectionRef.current;
    const currentAlt =
      target === "cover"
        ? coverAlt.trim()
        : typeof selection.attributes.alt === "string"
          ? selection.attributes.alt.trim()
          : "";
    const altText = currentAlt.length >= 3 ? currentAlt : suggestedAltText(file);
    const caption =
      target === "article" && typeof selection.attributes.caption === "string"
        ? selection.attributes.caption.trim()
        : "";
    const formData = new FormData();
    formData.set("file", file);
    formData.set("alt_text", altText);
    formData.set("caption", caption);
    formData.set("creator", "");
    formData.set("source_url", "");
    formData.set("license_name", "");
    formData.set("license_url", "");
    formData.set("collection_name", target === "cover" ? "Обложки статей" : "Статьи");
    formData.set("image_usage", target);

    setImageUploadTarget(target);
    setImageUploadError("");
    setImageUploadMessage("Изображение загружается и оптимизируется…");
    try {
      const response = await fetch(adminApiPath("/api/media/upload"), {
        method: "POST",
        body: formData,
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.url) {
        throw new Error(result.error || "Не удалось загрузить изображение.");
      }

      if (target === "cover") {
        setCoverUrl(result.url);
        if (!coverAlt.trim()) setCoverAlt(altText);
        setImageUploadMessage("Обложка загружена, оптимизирована в WebP и установлена.");
        setIsDirty(true);
        return;
      }

      if (!editor) throw new Error("Редактор ещё не готов. Повторите загрузку.");
      const attributes = {
        src: result.url,
        alt: altText,
        caption,
        layout:
          typeof selection.attributes.layout === "string"
            ? (selection.attributes.layout as EditorialImageLayout)
            : "wide",
      };
      if (selection.selectedImage) {
        editor.chain().focus().updateAttributes("image", attributes).run();
        setImageUploadMessage("Выбранное изображение заменено файлом с компьютера.");
      } else if (typeof selection.insertionPos === "number") {
        const insertionPos = Math.max(
          0,
          Math.min(selection.insertionPos, editor.state.doc.content.size)
        );
        editor
          .chain()
          .focus()
          .insertContentAt(insertionPos, { type: "image", attrs: attributes })
          .run();
        setImageUploadMessage("Изображение вставлено точно в выбранное место текста.");
      } else if (replaceSelectedMediaSlot(editor, attributes)) {
        setImageUploadMessage("Место для фотографии заполнено загруженным изображением.");
      } else {
        editor.chain().focus().setImage(attributes).run();
        setImageUploadMessage("Изображение загружено и вставлено в статью.");
      }
      setTemplateMessage("Изображение готово. При необходимости выберите его и измените расположение.");
      setIsDirty(true);
    } catch (error) {
      setImageUploadMessage("");
      setImageUploadError(
        error instanceof Error ? error.message : "Не удалось загрузить изображение."
      );
    } finally {
      setImageUploadTarget(null);
      if (articleFileInputRef.current) articleFileInputRef.current.value = "";
      if (coverFileInputRef.current) coverFileInputRef.current.value = "";
    }
  };

  const setImageLayout = (layout: EditorialImageLayout) => {
    if (!editor?.isActive("image")) {
      setTemplateMessage(
        "Сначала щёлкните по изображению в тексте, затем выберите его положение."
      );
      return;
    }
    editor.chain().focus().updateAttributes("image", { layout }).run();
    const labels: Record<EditorialImageLayout, string> = {
      wide: "на всю ширину",
      normal: "по центру",
      left: "слева с обтеканием",
      right: "справа с обтеканием",
    };
    setTemplateMessage(`Изображение расположено ${labels[layout]}.`);
  };

  const addMediaCollection = (kind: "gallery" | "slider") => {
    setMediaComposerKind(kind);
    setMediaComposerValue("");
    setMediaComposerError("");
  };

  const confirmMediaCollection = () => {
    if (!mediaComposerKind) return;
    const urls = mediaComposerValue
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter((item) => /^https:\/\//iu.test(item))
      .slice(0, 8);
    if (!urls.length) {
      setMediaComposerError("Добавьте хотя бы один корректный HTTPS-адрес.");
      return;
    }
    if (mediaComposerKind === "slider") insertEditorialSlider(editor, urls);
    else insertEditorialGallery(editor, urls);
    setTemplateMessage(
      mediaComposerKind === "slider"
        ? "Слайдер вставлен: на сайте появятся стрелки, точки и свайп."
        : "Галерея вставлена в материал."
    );
    setMediaComposerKind(null);
    setMediaComposerValue("");
    setMediaComposerError("");
  };

  const applyTemplate = (html: string, label: string) => {
    if (!editor) return;
    if (
      editor.getText().trim() &&
      !window.confirm(
        `Заменить текущий текст шаблоном «${label}»? Локальная резервная копия сохранится.`
      )
    ) {
      return;
    }
    const recoveryKey = `probpera-editor-${article.id || "new"}`;
    window.localStorage.setItem(
      recoveryKey,
      JSON.stringify({
        title,
        slug,
        contentHtml: editor.getHTML(),
        contentJson: JSON.stringify(editor.getJSON()),
        savedAt: Date.now(),
        reason: `before-template:${label}`,
      })
    );
    editor.commands.setContent(html);
    editor.chain().focus("start").run();
    setIsDirty(true);
    setHasRecoveryCopy(true);
    setTemplateMessage(
      `Шаблон «${label}» вставлен. Замените редакционные подсказки своим текстом и изображениями.`
    );
  };

  const saveCustomTemplate = () => {
    if (!editor || !editor.getText().trim()) {
      window.alert("Сначала подготовьте структуру материала в редакторе.");
      return;
    }
    const label = window.prompt("Название собственного шаблона")?.trim();
    if (!label) return;
    const visibility = window.confirm("Сделать шаблон общим для всей редакции?") ? "shared" : "personal";
    setTemplateMessage("");
    startTemplateTransition(async () => {
      const result = await saveEditorTemplateAction({
        label: label.slice(0, 80),
        html: editor.getHTML(),
        json: editor.getJSON(),
        visibility,
      });
      if (result.error || !result.template) {
        setTemplateMessage(result.error || "Шаблон не сохранён.");
        return;
      }
      setCustomTemplates((current) => [
        ...current.filter((template) => template.label.toLocaleLowerCase("ru") !== result.template!.label.toLocaleLowerCase("ru")),
        result.template as CustomTemplate,
      ]);
      const legacy = customTemplates.filter((item) => item.localOnly && item.label !== result.template!.label);
      window.localStorage.setItem(LEGACY_TEMPLATES_KEY, JSON.stringify(legacy));
      setTemplateMessage("Шаблон сохранён в редакционной базе.");
    });
  };

  const clearCustomTemplates = () => {
    if (!customTemplates.length || !window.confirm("Удалить доступные собственные шаблоны? Общие шаблоны других редакторов сохранятся.")) return;
    startTemplateTransition(async () => {
      const deletable = customTemplates.filter((template) => template.canDelete && !template.localOnly);
      const results = await Promise.all(deletable.map((template) => deleteEditorTemplateAction(template.id)));
      const failedIds = new Set(deletable.filter((_, index) => results[index]?.error).map((item) => item.id));
      setCustomTemplates((current) => current.filter((template) => !template.localOnly && (!template.canDelete || failedIds.has(template.id))));
      window.localStorage.removeItem(LEGACY_TEMPLATES_KEY);
      setTemplateMessage(failedIds.size ? "Часть шаблонов не удалось удалить." : "Собственные шаблоны удалены.");
    });
  };

  const restoreLocalCopy = () => {
    const stored = window.localStorage.getItem(
      `probpera-editor-${article.id || "new"}`
    );
    if (!stored || !editor) return;
    try {
      const recovery = JSON.parse(stored) as {
        title?: string;
        slug?: string;
        contentHtml?: string;
      };
      if (
        !window.confirm(
          "Восстановить локальную резервную копию? Текущий текст в редакторе будет заменён."
        )
      ) {
        return;
      }
      if (recovery.title) setTitle(recovery.title);
      if (recovery.slug) {
        setSlugEdited(true);
        setSlug(recovery.slug);
      }
      editor.commands.setContent(recovery.contentHtml || "");
      setIsDirty(true);
    } catch {
      window.alert("Локальная копия повреждена и не может быть восстановлена.");
    }
  };

  return (
    <form
      action={saveArticleAction}
      onSubmit={() => setIsDirty(false)}
      className={isFullscreen ? "article-form is-fullscreen" : "article-form"}
    >
      {article.id && <input type="hidden" name="id" value={article.id} />}
      <input type="hidden" name="previous_status" value={article.status || "draft"} />
      <input type="hidden" name="content_html" value={contentHtml} />
      <input type="hidden" name="content_json" value={contentJson} />

      <div className="article-editor">
        <div className="editor-main">
          <section className="panel">
            <label className="field">
              <span>Заголовок</span>
              <input
                className="editor-title"
                name="title"
                value={title}
                maxLength={240}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setIsDirty(true);
                }}
                placeholder="Заголовок материала"
                required
              />
            </label>
            <label className="field">
              <span>Подзаголовок</span>
              <input
                name="subtitle"
                defaultValue={article.subtitle}
                maxLength={360}
                placeholder="Необязательная строка под заголовком"
              />
            </label>
            <label className="field">
              <span>Краткое описание</span>
              <textarea
                name="excerpt"
                value={excerpt}
                onChange={(event) => setExcerpt(event.target.value)}
                maxLength={700}
                placeholder="Для карточек, поиска и социальных сетей"
              />
            </label>
          </section>

          <section className="panel editor-surface">
            <div className="editor-template-bar">
              <span>Начать с редакционного шаблона</span>
              <small>
                Выберите структуру — она сразу появится в редакторе. Затем
                замените подсказки своим текстом, фотографиями и галереями.
              </small>
              <div>
                {articleTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.label}
                    onClick={() => applyTemplate(template.html, template.label)}
                  >
                    {template.label}
                  </button>
                ))}
                {customTemplates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => applyTemplate(template.html, template.label)}
                    title={template.localOnly ? "Локальный шаблон — сохраните его заново, чтобы перенести в базу" : template.visibility === "shared" ? "Общий шаблон редакции" : "Личный шаблон"}
                  >
                    {template.visibility === "shared" ? "◆" : "★"} {template.label}{template.localOnly ? " · локальный" : ""}
                  </button>
                ))}
                <button type="button" onClick={saveCustomTemplate} disabled={templatePending}>
                  ＋ Сохранить как шаблон
                </button>
                <NextLink className="editor-template-link" href="/media" target="_blank">
                  Медиатека ↗
                </NextLink>
                {customTemplates.length > 0 && (
                  <button type="button" onClick={clearCustomTemplates} disabled={templatePending}>
                    Удалить мои шаблоны
                  </button>
                )}
              </div>
              {templateMessage && <small role="status">{templateMessage}</small>}
            </div>
            <div className="editor-toolbar" aria-label="Панель форматирования">
              <ToolbarButton label="Ж" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
              <ToolbarButton label="К" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
              <ToolbarButton label="Ч" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
              <ToolbarButton label="Зачёркнутый" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} />
              <ToolbarButton label="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
              <ToolbarButton label="H3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
              <ToolbarButton label="H4" active={editor?.isActive("heading", { level: 4 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()} />
              <ToolbarButton label="• Список" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
              <ToolbarButton label="1. Список" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
              <ToolbarButton label="Цитата" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
              <ToolbarButton label="Разделитель" onClick={() => editor?.chain().focus().setHorizontalRule().run()} />
              <ToolbarButton label="Факт" onClick={() => insertEditorialBlock(editor, "fact")} />
              <ToolbarButton label="Акцент" onClick={() => insertEditorialBlock(editor, "accent")} />
              <ToolbarButton label="2 колонки" onClick={() => insertEditorialBlock(editor, "columns")} />
              <ToolbarButton label="Хронология" onClick={() => insertEditorialBlock(editor, "timeline")} />
              <ToolbarButton label="Цифры" onClick={() => insertEditorialBlock(editor, "metrics")} />
              <ToolbarButton label="Фигура-разделитель" onClick={() => insertEditorialBlock(editor, "ornament")} />
              <ToolbarButton label="Место для фото" onClick={() => insertEditorialBlock(editor, "media")} />
              <ToolbarButton label="Появление ↑" onClick={() => setEditorialBlockReveal(editor, "fade-up")} />
              <ToolbarButton label="Появление ←" onClick={() => setEditorialBlockReveal(editor, "slide-left")} />
              <ToolbarButton label="Масштаб" onClick={() => setEditorialBlockReveal(editor, "zoom-in")} />
              <ToolbarButton label="Без анимации" onClick={() => setEditorialBlockReveal(editor, "none")} />
              <ToolbarButton label="Таблица" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
              <ToolbarButton label="Ссылка" active={editor?.isActive("link")} onClick={setLink} />
              <ToolbarButton
                label={imageUploadTarget === "article" ? "Загрузка…" : "Загрузить фото"}
                active={imageUploadTarget === "article"}
                onClick={() => openImagePicker("article")}
              />
              <ToolbarButton label="Фото / заменить" active={editor?.isActive("image")} onClick={addImage} />
              <ToolbarButton label="Фото широко" onClick={() => setImageLayout("wide")} />
              <ToolbarButton label="Фото центр" onClick={() => setImageLayout("normal")} />
              <ToolbarButton label="Фото слева" onClick={() => setImageLayout("left")} />
              <ToolbarButton label="Фото справа" onClick={() => setImageLayout("right")} />
              <ToolbarButton label="Галерея" onClick={() => addMediaCollection("gallery")} />
              <ToolbarButton label="Слайдер" onClick={() => addMediaCollection("slider")} />
              <ToolbarButton label="Слева" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
              <ToolbarButton label="Центр" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
              <ToolbarButton label="Очистить формат" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
              <ToolbarButton label="↶" onClick={() => editor?.chain().focus().undo().run()} />
              <ToolbarButton label="↷" onClick={() => editor?.chain().focus().redo().run()} />
              <ToolbarButton
                label={isFullscreen ? "Свернуть редактор" : "На весь экран"}
                active={isFullscreen}
                onClick={() => setIsFullscreen((value) => !value)}
              />
            </div>
            <input
              ref={articleFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImageFile(file, "article");
              }}
            />
            <button
              className={
                imageUploadTarget === "article"
                  ? "editor-direct-upload is-uploading"
                  : "editor-direct-upload"
              }
              type="button"
              onClick={() => openImagePicker("article")}
              onDragEnter={rememberImageSelection}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void uploadImageFile(file, "article");
              }}
              disabled={imageUploadTarget !== null}
            >
              <strong>
                {imageUploadTarget === "article"
                  ? "Оптимизируем изображение…"
                  : "Нажмите или перетащите фотографию сюда"}
              </strong>
              <span>
                Она загрузится с компьютера, преобразуется в WebP и появится в месте курсора.
                Если выбрана старая фотография, новая заменит её.
              </span>
            </button>
            {imageUploadMessage && (
              <p className="upload-feedback is-success" role="status">{imageUploadMessage}</p>
            )}
            {imageUploadError && (
              <p className="upload-feedback is-error" role="alert">{imageUploadError}</p>
            )}
            <div
              className={
                isImageDraggingOverEditor
                  ? "editor-content-drop-target is-dragging"
                  : "editor-content-drop-target"
              }
              onDragEnterCapture={(event) => {
                if (Array.from(event.dataTransfer.items || []).some(
                  (item) => item.kind === "file" && item.type.startsWith("image/")
                )) {
                  setIsImageDraggingOverEditor(true);
                }
              }}
              onDragOverCapture={(event) => {
                if (Array.from(event.dataTransfer.items || []).some(
                  (item) => item.kind === "file" && item.type.startsWith("image/")
                )) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsImageDraggingOverEditor(false);
                }
              }}
              onDropCapture={handleEditorImageDrop}
            >
              <EditorContent editor={editor} />
              {isImageDraggingOverEditor && (
                <span className="editor-drop-hint" aria-hidden="true">
                  Отпустите изображение — оно появится в этом месте статьи
                </span>
              )}
            </div>
          </section>
        </div>

        <aside className="editor-side">
          <section className="panel settings-stack">
            <h2>Публикация</h2>
            <label className="field">
              <span>Статус</span>
              <select name="status" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="draft">Черновик</option>
                <option value="review">На проверке</option>
                <option value="scheduled">По расписанию</option>
                <option value="published">Опубликована</option>
                <option value="hidden">Скрыта</option>
                <option value="archived">В архиве</option>
              </select>
            </label>
            <label className="field">
              <span>Дата и время публикации</span>
              <input
                type="datetime-local"
                name="scheduled_at"
                defaultValue={article.scheduled_at?.slice(0, 16) || ""}
              />
            </label>
            <label><input type="checkbox" name="featured" defaultChecked={article.featured} /> Выбор редакции</label>
            <label><input type="checkbox" name="show_on_homepage" defaultChecked={article.show_on_homepage} /> Показывать на главной</label>
            <label><input type="checkbox" name="pinned" defaultChecked={article.pinned} /> Закрепить</label>
          </section>

          <section className="panel settings-stack">
            <h2>Рубрика</h2>
            <label className="field">
              <span>Основная рубрика</span>
              <select
                name="category_id"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Без рубрики</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
          </section>

          <section className="panel settings-stack">
            <h2>Обложка</h2>
            <input
              ref={coverFileInputRef}
              className="visually-hidden-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadImageFile(file, "cover");
              }}
            />
            <button
              className={
                imageUploadTarget === "cover"
                  ? "cover-upload-zone is-uploading"
                  : "cover-upload-zone"
              }
              type="button"
              onClick={() => openImagePicker("cover")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void uploadImageFile(file, "cover");
              }}
              disabled={imageUploadTarget !== null}
            >
              {coverUrl ? (
                <img src={coverUrl} alt={coverAlt || "Предпросмотр обложки статьи"} />
              ) : (
                <span className="cover-upload-mark" aria-hidden="true">＋</span>
              )}
              <strong>
                {imageUploadTarget === "cover"
                  ? "Загружаем обложку…"
                  : coverUrl
                    ? "Нажмите, чтобы заменить обложку"
                    : "Выбрать обложку с компьютера"}
              </strong>
              <small>
                Автоподгонка без обрезки · JPEG, PNG, WebP или AVIF · до 12 МБ
              </small>
            </button>
            <label className="field">
              <span>Адрес изображения</span>
              <input
                type="url"
                name="cover_external_url"
                value={coverUrl}
                onChange={(event) => setCoverUrl(event.target.value)}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span>Описание изображения</span>
              <textarea
                name="cover_alt"
                value={coverAlt}
                onChange={(event) => setCoverAlt(event.target.value)}
                maxLength={500}
                placeholder="Что изображено — для доступности и поиска"
              />
            </label>
          </section>

          <section className="panel settings-stack">
            <h2>Адрес и SEO</h2>
            <label className="field">
              <span>Адрес статьи</span>
              <input
                name="slug"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(createSlug(event.target.value));
                }}
                required
              />
              <span className="slug-control-row">
                <small>
                  {!slugEdited
                    ? "Адрес автоматически меняется вместе с заголовком."
                    : "Адрес закреплён вручную и больше не изменится от заголовка."}
                </small>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setSlugEdited(false);
                    setSlug(createSlug(title));
                    setCanonicalEdited(false);
                    setIsDirty(true);
                  }}
                >
                  Создавать из заголовка
                </button>
              </span>
              <small>
                {publicSiteUrl}
                {articlePublicPath(
                  slug || "adres-stati",
                  selectedCategorySlug
                )}
              </small>
            </label>
            <label className="field">
              <span>Старый адрес — только совместимость</span>
              <input
                name="legacy_path"
                defaultValue={article.legacy_path || ""}
                placeholder="/read/page-article/…"
              />
              <small>
                Не показывается читателям и не используется в новых ссылках.
                Нужен только для бесшовного 301‑перехода со старых публикаций.
              </small>
            </label>
            <label className="field">
              <span>SEO-заголовок</span>
              <input name="seo_title" defaultValue={article.seo_title || ""} maxLength={180} />
            </label>
            <label className="field">
              <span>Описание для поиска</span>
              <textarea name="seo_description" value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} maxLength={400} />
            </label>
            <label className="field">
              <span>Ключевые слова</span>
              <textarea
                name="seo_keywords"
                defaultValue={(article.seo_keywords || []).join(", ")}
                maxLength={1000}
                placeholder="литература, автор, название книги"
              />
            </label>
            <label className="field">
              <span>Текущий постоянный адрес</span>
              <input
                type="url"
                name="canonical_url"
                value={canonicalUrl}
                readOnly
                placeholder={generatedCanonical}
              />
              <small>
                Строится автоматически из рубрики и названия. Новые публикации
                всегда используют этот понятный адрес.
              </small>
            </label>
            <label className="field">
              <span>Open Graph — заголовок</span>
              <input name="og_title" defaultValue={article.og_title || ""} maxLength={180} />
            </label>
            <label className="field">
              <span>Open Graph — описание</span>
              <textarea name="og_description" defaultValue={article.og_description || ""} maxLength={400} />
            </label>
            <label>
              <input
                type="checkbox"
                name="allow_indexing"
                defaultChecked={article.allow_indexing !== false}
              />{" "}
              Разрешить индексацию поисковыми системами
            </label>
          </section>

          <section className="panel settings-stack publication-checklist" aria-labelledby="publication-checklist-title">
            <h2 id="publication-checklist-title">Контроль перед публикацией</h2>
            <ul>
              {publicationChecks.map((item) => (
                <li className={item.ok ? "is-ready" : "is-missing"} key={item.label}>
                  <span aria-hidden="true">{item.ok ? "✓" : "○"}</span>{item.label}
                </li>
              ))}
            </ul>
            <p>{publicationReady ? "Материал готов к выпуску." : "Черновик можно сохранять. Для выпуска завершите отмеченные пункты."}</p>
            <input type="hidden" name="publication_ready" value={publicationReady ? "yes" : "no"} />
          </section>

          <section className="panel settings-stack">
            <h2>Источники и библиография</h2>
            <label className="field">
              <span>Источники — по одному на строку</span>
              <textarea
                name="sources"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                placeholder="Название — https://…"
              />
            </label>
            <label className="field">
              <span>Библиография — по одной записи на строку</span>
              <textarea
                name="bibliography"
                defaultValue={listValue(article.bibliography)}
              />
            </label>
          </section>
        </aside>
      </div>

      {mediaComposerKind && (
        <div
          className="editor-media-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setMediaComposerKind(null);
          }}
        >
          <section
            className="editor-media-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-media-modal-title"
          >
            <div className="editor-media-modal-heading">
              <div>
                <span>Изображения статьи</span>
                <h2 id="editor-media-modal-title">
                  {mediaComposerKind === "slider"
                    ? "Собрать слайдер"
                    : "Собрать галерею"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Закрыть окно"
                onClick={() => setMediaComposerKind(null)}
              >
                ×
              </button>
            </div>
            <p>
              Вставьте до восьми HTTPS-адресов — по одному в строке. Изображения
              останутся одним блоком; порядок строк станет порядком кадров.
              После вставки выберите каждый кадр и уточните его описание через
              «Фото / заменить».
            </p>
            <textarea
              autoFocus
              value={mediaComposerValue}
              onChange={(event) => {
                setMediaComposerValue(event.target.value);
                setMediaComposerError("");
              }}
              rows={9}
              placeholder={
                "https://…/image-1.webp\nhttps://…/image-2.webp\nhttps://…/image-3.webp"
              }
              aria-label="Адреса изображений"
            />
            <div className="editor-media-modal-summary">
              <span>
                {
                  mediaComposerValue
                    .split(/\r?\n/u)
                    .map((item) => item.trim())
                    .filter((item) => /^https:\/\//iu.test(item))
                    .slice(0, 8).length
                }{" "}
                из 8 изображений
              </span>
              <NextLink href="/media" target="_blank">
                Открыть медиатеку ↗
              </NextLink>
            </div>
            {mediaComposerError && (
              <p className="editor-media-modal-error" role="alert">
                {mediaComposerError}
              </p>
            )}
            <div className="editor-media-modal-actions">
              <button
                className="button-secondary"
                type="button"
                onClick={() => setMediaComposerKind(null)}
              >
                Отмена
              </button>
              <button className="button" type="button" onClick={confirmMediaCollection}>
                {mediaComposerKind === "slider"
                  ? "Вставить слайдер"
                  : "Вставить галерею"}
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="editor-footer">
        <small>
          {wordCount.toLocaleString("ru-RU")} слов
          {savedLocallyAt ? ` · резервная копия ${savedLocallyAt}` : ""}
          {isDirty ? " · есть несохранённые изменения" : ""}
        </small>
        <div className="editor-actions">
          {hasRecoveryCopy && (
            <button
              className="button-secondary"
              type="button"
              onClick={restoreLocalCopy}
            >
              Восстановить локальную копию
            </button>
          )}
          {article.id && (
            <NextLink
              className="button-secondary"
              href={`/articles/${article.id}/preview`}
              target="_blank"
              rel="noreferrer"
            >
              Предпросмотр
            </NextLink>
          )}
          <button className="button-secondary" type="submit" name="intent" value="save">
            Сохранить
          </button>
          <button className="button" type="submit" name="intent" value="publish" disabled={!publicationReady} title={publicationReady ? "Опубликовать материал" : "Завершите редакционную проверку"}>
            Опубликовать
          </button>
        </div>
      </footer>
    </form>
  );
}
