"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";

import { createSlug } from "@/lib/slug";
import { saveArticleAction } from "@/app/(dashboard)/articles/actions";
import { articlePublicPath } from "@/lib/article-route";

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
}: {
  article: Article;
  categories: Category[];
  publicSiteUrl: string;
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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
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
                defaultValue={article.excerpt}
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
              </div>
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
              <ToolbarButton label="Таблица" onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
              <ToolbarButton label="Ссылка" active={editor?.isActive("link")} onClick={setLink} />
              <ToolbarButton label="Фото" onClick={addImage} />
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
              <select name="status" defaultValue={article.status || "draft"}>
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
                defaultValue={article.cover_external_url || ""}
                placeholder="https://…"
              />
            </label>
            <label className="field">
              <span>Описание изображения</span>
              <textarea
                name="cover_alt"
                defaultValue={article.cover_alt}
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
              <textarea name="seo_description" defaultValue={article.seo_description || ""} maxLength={400} />
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

          <section className="panel settings-stack">
            <h2>Источники и библиография</h2>
            <label className="field">
              <span>Источники — по одному на строку</span>
              <textarea
                name="sources"
                defaultValue={listValue(article.sources)}
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
            <a
              className="button-secondary"
              href={`/admin/articles/${article.id}/preview`}
              target="_blank"
              rel="noreferrer"
            >
              Предпросмотр
            </a>
          )}
          <button className="button-secondary" type="submit" name="intent" value="save">
            Сохранить
          </button>
          <button className="button" type="submit" name="intent" value="publish">
            Опубликовать
          </button>
        </div>
      </footer>
    </form>
  );
}
