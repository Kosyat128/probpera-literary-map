"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import NextLink from "next/link";
import { useEffect, useState } from "react";

import { savePageAction } from "@/app/(dashboard)/pages/actions";
import { createSlug } from "@/lib/slug";
import {
  EditorialBlock,
  insertEditorialBlock,
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";
import { EditorialImage } from "@/components/EditorialImage";

type PageRecord = {
  id: string;
  title?: string;
  excerpt?: string;
  slug?: string;
  content_html?: string;
  content_json?: unknown;
  status?: string;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  allow_indexing?: boolean;
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

export default function PageEditor({
  page,
  publicSiteUrl,
}: {
  page: PageRecord;
  publicSiteUrl: string;
}) {
  const [title, setTitle] = useState(page.title || "");
  const [slug, setSlug] = useState(page.slug || "");
  const [slugEdited, setSlugEdited] = useState(true);
  const generatedCanonical = `${publicSiteUrl}/stranitsy/${slug || "adres"}/`;
  const [canonicalUrl, setCanonicalUrl] = useState(
    page.canonical_url || generatedCanonical
  );
  const [canonicalEdited, setCanonicalEdited] = useState(
    Boolean(page.canonical_url && page.canonical_url !== generatedCanonical)
  );
  const [contentHtml, setContentHtml] = useState(page.content_html || "");
  const [contentJson, setContentJson] = useState(
    JSON.stringify(page.content_json || { type: "doc", content: [] })
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasRecoveryCopy, setHasRecoveryCopy] = useState(false);

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
          "Напишите содержимое страницы. Подзаголовки, списки и ссылки помогут сделать материал удобным.",
      }),
    ],
    content: page.content_json || page.content_html || "",
    onUpdate({ editor: currentEditor }) {
      setContentHtml(currentEditor.getHTML());
      setContentJson(JSON.stringify(currentEditor.getJSON()));
      setIsDirty(true);
    },
  });

  useEffect(() => {
    if (!slugEdited) setSlug(createSlug(title));
  }, [slugEdited, title]);

  useEffect(() => {
    if (!canonicalEdited) {
      setCanonicalUrl(`${publicSiteUrl}/stranitsy/${slug || "adres"}/`);
    }
  }, [canonicalEdited, publicSiteUrl, slug]);

  useEffect(() => {
    const recoveryKey = `probpera-page-editor-${page.id}`;
    setHasRecoveryCopy(Boolean(window.localStorage.getItem(recoveryKey)));
  }, [page.id]);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const recoveryKey = `probpera-page-editor-${page.id}`;
    const timer = window.setInterval(() => {
      window.localStorage.setItem(
        recoveryKey,
        JSON.stringify({
          title,
          slug,
          contentHtml,
          contentJson,
          savedAt: new Date().toISOString(),
        })
      );
      setHasRecoveryCopy(true);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [contentHtml, contentJson, isDirty, page.id, slug, title]);

  function restoreLocalCopy() {
    const raw = window.localStorage.getItem(`probpera-page-editor-${page.id}`);
    if (!raw || !editor) return;
    try {
      const recovery = JSON.parse(raw) as {
        title?: string;
        slug?: string;
        contentHtml?: string;
      };
      if (recovery.title) setTitle(recovery.title);
      if (recovery.slug) setSlug(recovery.slug);
      if (recovery.contentHtml) editor.commands.setContent(recovery.contentHtml);
      setIsDirty(true);
    } catch {
      window.localStorage.removeItem(`probpera-page-editor-${page.id}`);
      setHasRecoveryCopy(false);
    }
  }

  function setLink() {
    if (!editor) return;
    const current = editor.getAttributes("link").href || "";
    const href = window.prompt("Адрес ссылки", current);
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  }

  function addImage() {
    if (!editor) return;
    const src = window.prompt("HTTPS-адрес изображения");
    if (!src?.startsWith("https://")) return;
    const alt = window.prompt("Описание изображения для читателей", "") || "";
    editor.chain().focus().setImage({ src, alt }).run();
  }

  return (
    <form
      action={savePageAction}
      className={`article-editor${isFullscreen ? " is-fullscreen" : ""}`}
      onSubmit={() => {
        setIsDirty(false);
        window.localStorage.removeItem(`probpera-page-editor-${page.id}`);
      }}
    >
      <input name="id" type="hidden" value={page.id} />
      <input name="content_html" type="hidden" value={contentHtml} />
      <input name="content_json" type="hidden" value={contentJson} />
      <section className="editor-main panel">
        <div className="editor-kicker">
          <span>Страница сайта</span>
          {isDirty && <small>Есть несохранённые изменения</small>}
        </div>
        <input
          aria-label="Название страницы"
          className="title-input"
          name="title"
          onChange={(event) => {
            setTitle(event.target.value);
            setIsDirty(true);
          }}
          placeholder="Название страницы"
          required
          value={title}
        />
        <textarea
          className="lead-input"
          defaultValue={page.excerpt || ""}
          name="excerpt"
          onChange={() => setIsDirty(true)}
          placeholder="Краткое описание страницы"
        />
        <div className="editor-toolbar" aria-label="Форматирование текста">
          <ToolbarButton
            active={editor?.isActive("bold")}
            label="Жирный"
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            active={editor?.isActive("italic")}
            label="Курсив"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            active={editor?.isActive("underline")}
            label="Подчёркивание"
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            active={editor?.isActive("heading", { level: 2 })}
            label="Заголовок 2"
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <ToolbarButton
            active={editor?.isActive("heading", { level: 3 })}
            label="Заголовок 3"
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />
          <ToolbarButton
            active={editor?.isActive("bulletList")}
            label="Список"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            active={editor?.isActive("blockquote")}
            label="Цитата"
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton label="Факт" onClick={() => insertEditorialBlock(editor, "fact")} />
          <ToolbarButton label="Акцент" onClick={() => insertEditorialBlock(editor, "accent")} />
          <ToolbarButton label="2 колонки" onClick={() => insertEditorialBlock(editor, "columns")} />
          <ToolbarButton label="Хронология" onClick={() => insertEditorialBlock(editor, "timeline")} />
          <ToolbarButton label="Цифры" onClick={() => insertEditorialBlock(editor, "metrics")} />
          <ToolbarButton label="Фигура-разделитель" onClick={() => insertEditorialBlock(editor, "ornament")} />
          <ToolbarButton label="Анимация ↑" onClick={() => setEditorialBlockReveal(editor, "fade-up")} />
          <ToolbarButton label="Анимация ←" onClick={() => setEditorialBlockReveal(editor, "slide-left")} />
          <ToolbarButton label="Масштаб" onClick={() => setEditorialBlockReveal(editor, "zoom-in")} />
          <ToolbarButton label="Ссылка" onClick={setLink} />
          <ToolbarButton label="Изображение" onClick={addImage} />
          <ToolbarButton
            label="Таблица"
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          />
          <ToolbarButton
            label="Без форматирования"
            onClick={() =>
              editor?.chain().focus().unsetAllMarks().clearNodes().run()
            }
          />
        </div>
        <EditorContent className="editor-canvas" editor={editor} />
      </section>
      <aside className="editor-side">
        <section className="panel settings-stack">
          <h2>Публикация</h2>
          <label className="field">
            <span>Статус</span>
            <select defaultValue={page.status || "draft"} name="status">
              <option value="draft">Черновик</option>
              <option value="published">Опубликована</option>
              <option value="hidden">Скрыта</option>
            </select>
          </label>
          <label className="field">
            <span>Адрес</span>
            <input
              name="slug"
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(createSlug(event.target.value));
                setIsDirty(true);
              }}
              onFocus={() => setSlugEdited(true)}
              value={slug}
            />
          </label>
          <div className="editor-actions">
            <button className="button-secondary" name="intent" value="save">
              Сохранить
            </button>
            <button className="button" name="intent" value="publish">
              Опубликовать
            </button>
          </div>
          <NextLink
            className="button-secondary"
            href={`/pages/${page.id}/preview`}
            target="_blank"
            rel="noreferrer"
          >
            Предпросмотр ↗
          </NextLink>
          <button
            className="button-secondary"
            type="button"
            onClick={() => setIsFullscreen((value) => !value)}
          >
            {isFullscreen ? "Закрыть полный экран" : "Развернуть редактор"}
          </button>
          {hasRecoveryCopy && (
            <button
              className="button-secondary"
              type="button"
              onClick={restoreLocalCopy}
            >
              Восстановить локальную копию
            </button>
          )}
        </section>
        <section className="panel settings-stack">
          <h2>Поисковые системы</h2>
          <label className="field">
            <span>SEO-заголовок</span>
            <input defaultValue={page.seo_title || ""} name="seo_title" />
          </label>
          <label className="field">
            <span>SEO-описание</span>
            <textarea
              defaultValue={page.seo_description || ""}
              name="seo_description"
            />
          </label>
          <label className="field">
            <span>Канонический адрес</span>
            <input
              name="canonical_url"
              onChange={(event) => {
                setCanonicalEdited(true);
                setCanonicalUrl(event.target.value);
              }}
              value={canonicalUrl}
            />
          </label>
          <label className="check-field">
            <input
              defaultChecked={page.allow_indexing !== false}
              name="allow_indexing"
              type="checkbox"
            />
            <span>Разрешить индексацию</span>
          </label>
        </section>
      </aside>
    </form>
  );
}
