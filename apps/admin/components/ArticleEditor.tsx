"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import NextLink from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

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
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";

type Category = { id: string; name: string; slug: string };
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

const articleTemplates = [
  {
    label: "Мнение о книге",
    html: `<aside class="article-lead"><p><strong>Предисловие</strong></p><p>Почему эта книга заслуживает внимательного разговора.</p></aside><h2>История создания и публикации</h2><p></p><h2>О чём произведение</h2><p></p><h2>Темы, герои и художественный мир</h2><p></p><h2>Заключительное мнение о книге</h2><p></p><h2>Источники</h2><p></p>`,
  },
  {
    label: "Биография писателя",
    html: `<aside class="article-lead"><p><strong>Редакционное введение</strong></p><p>Место писателя в литературе и причина обратиться к его судьбе.</p></aside><h2>Детство и образование</h2><p></p><h2>Начало литературного пути</h2><p></p><h2>Главные произведения</h2><p></p><h2>Личная судьба и время</h2><p></p><h2>Наследие</h2><p></p><h2>Источники и библиография</h2><p></p>`,
  },
  {
    label: "Книга и экранизация",
    html: `<aside class="article-lead"><p><strong>Книга против экранизации</strong></p><p>Что именно сравнивается и почему.</p></aside><h2>Литературный первоисточник</h2><p></p><h2>Экранная версия</h2><p></p><h2>Сюжет и композиция</h2><p></p><h2>Герои и актёрские работы</h2><p></p><h2>Что изменилось и что сохранилось</h2><p></p><h2>Вывод</h2><p></p>`,
  },
  {
    label: "Большое эссе",
    html: `<aside class="article-lead"><p><strong>Предисловие</strong></p><p>Главный вопрос и редакционная позиция.</p></aside><h2>Контекст</h2><p></p><h2>Основная идея</h2><p></p><h2>Примеры и аргументы</h2><p></p><blockquote><p>Цитата с обязательным указанием источника.</p></blockquote><h2>Вывод</h2><p></p><h2>Источники</h2><p></p>`,
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
    article.canonical_url || initialCanonical
  );
  const [canonicalEdited, setCanonicalEdited] = useState(
    Boolean(article.canonical_url && article.canonical_url !== initialCanonical)
  );
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
  const [templatePending, startTemplateTransition] = useTransition();
  const [excerpt, setExcerpt] = useState(article.excerpt || "");
  const [status, setStatus] = useState(article.status || "draft");
  const [coverUrl, setCoverUrl] = useState(article.cover_external_url || "");
  const [coverAlt, setCoverAlt] = useState(article.cover_alt || "");
  const [seoDescription, setSeoDescription] = useState(article.seo_description || "");
  const [sourceText, setSourceText] = useState(listValue(article.sources));

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      EditorialBlock,
      TableKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({
        placeholder:
          "Начните писать. Для большого материала используйте подзаголовки — из них автоматически соберётся оглавление.",
      }),
    ],
    content: article.content_json || article.content_html || "",
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
    const url = window.prompt("Адрес изображения из медиатеки");
    if (url && editor) editor.chain().focus().setImage({ src: url }).run();
  };

  const addGallery = () => {
    const value = window.prompt(
      "HTTPS-адреса изображений из медиатеки — по одному в строке (до 6)"
    );
    if (!value) return;
    const urls = value
      .split(/\r?\n/u)
      .map((item) => item.trim())
      .filter((item) => /^https:\/\//iu.test(item));
    if (!urls.length) {
      window.alert("Добавьте хотя бы один корректный HTTPS-адрес.");
      return;
    }
    insertEditorialGallery(editor, urls);
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
    editor.commands.setContent(html);
    setIsDirty(true);
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
                onChange={(event) => setTitle(event.target.value)}
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
              <ToolbarButton label="Появление ↑" onClick={() => setEditorialBlockReveal(editor, "fade-up")} />
              <ToolbarButton label="Появление ←" onClick={() => setEditorialBlockReveal(editor, "slide-left")} />
              <ToolbarButton label="Масштаб" onClick={() => setEditorialBlockReveal(editor, "zoom-in")} />
              <ToolbarButton label="Без анимации" onClick={() => setEditorialBlockReveal(editor, "none")} />
              <ToolbarButton label="Таблица" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
              <ToolbarButton label="Ссылка" active={editor?.isActive("link")} onClick={setLink} />
              <ToolbarButton label="Фото" onClick={addImage} />
              <ToolbarButton label="Галерея" onClick={addGallery} />
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
            <EditorContent editor={editor} />
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
              <small>
                {publicSiteUrl}
                {articlePublicPath(
                  slug || "adres-stati",
                  selectedCategorySlug
                )}
              </small>
            </label>
            <label className="field">
              <span>Старый адрес</span>
              <input
                name="legacy_path"
                defaultValue={article.legacy_path || ""}
                placeholder="/read/page-article/…"
              />
              <small>Оставляем для постоянного 301‑перехода.</small>
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
              <span>Канонический адрес</span>
              <input
                type="url"
                name="canonical_url"
                value={canonicalUrl}
                onChange={(event) => {
                  setCanonicalEdited(true);
                  setCanonicalUrl(event.target.value);
                }}
                placeholder={generatedCanonical}
              />
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
