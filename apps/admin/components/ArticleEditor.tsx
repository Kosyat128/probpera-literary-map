"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
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
};

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

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
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

  return (
    <form action={saveArticleAction}>
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
            <div className="editor-toolbar" aria-label="Панель форматирования">
              <ToolbarButton label="Ж" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
              <ToolbarButton label="К" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
              <ToolbarButton label="Ч" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()} />
              <ToolbarButton label="H2" active={editor?.isActive("heading", { level: 2 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
              <ToolbarButton label="H3" active={editor?.isActive("heading", { level: 3 })} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
              <ToolbarButton label="• Список" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
              <ToolbarButton label="1. Список" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
              <ToolbarButton label="Цитата" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
              <ToolbarButton label="Ссылка" active={editor?.isActive("link")} onClick={setLink} />
              <ToolbarButton label="Фото" onClick={addImage} />
              <ToolbarButton label="Слева" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
              <ToolbarButton label="Центр" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
              <ToolbarButton label="↶" onClick={() => editor?.chain().focus().undo().run()} />
              <ToolbarButton label="↷" onClick={() => editor?.chain().focus().redo().run()} />
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
          </section>
        </aside>
      </div>

      <footer className="editor-footer">
        <small>
          {wordCount.toLocaleString("ru-RU")} слов
          {savedLocallyAt ? ` · резервная копия ${savedLocallyAt}` : ""}
        </small>
        <div className="editor-actions">
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
