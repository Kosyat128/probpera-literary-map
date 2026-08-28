"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";

import { savePageAction } from "@/app/(dashboard)/pages/actions";
import { createSlug } from "@/lib/slug";
import {
  EditorialBlock,
  insertEditorialBlock,
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";
import {
  EditorialImage,
  updateEditorialImageAt,
  type EditorialImageLayout,
} from "@/components/EditorialImage";
import EditorLinkDialog from "@/components/EditorLinkDialog";
import {
  EDITOR_IMAGE_REPLACE_EVENT,
  type EditorImageReplaceDetail,
} from "@/components/editorMediaEvents";
import { uploadEditorImage } from "@/lib/editor-image-upload";

type PageRecord = {
  id: string;
  updated_at: string;
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

type PageImageSelection = {
  attributes: Record<string, unknown>;
  expectedSrc?: string;
  nodePos?: number;
  insertionPos?: number;
};

function suggestedPageImageAlt(file: File) {
  const label = file.name
    .replace(/\.[^.]+$/u, "")
    .replace(/[_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return label.length >= 3 ? label.slice(0, 500) : "Иллюстрация к странице";
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

export default function PageEditor({
  page,
  publicSiteUrl,
  catalogContext,
  savedAfterSubmit = false,
}: {
  page: PageRecord;
  publicSiteUrl: string;
  catalogContext: { q: string; status: string; page: number; revisionPage: number };
  savedAfterSubmit?: boolean;
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
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkDialogInitialValue, setLinkDialogInitialValue] = useState("");
  const [imageUploadPending, setImageUploadPending] = useState(false);
  const [imageUploadMessage, setImageUploadMessage] = useState("");
  const [imageUploadError, setImageUploadError] = useState("");
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const imageUploadInFlightRef = useRef(false);
  const imageSelectionRef = useRef<PageImageSelection>({ attributes: {} });
  const previewParams = new URLSearchParams();
  if (catalogContext.q) previewParams.set("q", catalogContext.q);
  if (catalogContext.status) previewParams.set("status", catalogContext.status);
  if (catalogContext.page > 1) previewParams.set("page", String(catalogContext.page));
  if (catalogContext.revisionPage > 1) {
    previewParams.set("revision_page", String(catalogContext.revisionPage));
  }
  const previewHref = `/pages/${page.id}/preview${previewParams.size ? `?${previewParams.toString()}` : ""}`;

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
    if (!savedAfterSubmit) return;
    window.localStorage.removeItem(`probpera-page-editor-${page.id}`);
    setHasRecoveryCopy(false);
  }, [page.id, savedAfterSubmit]);

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
    setLinkDialogInitialValue(typeof current === "string" ? current : "");
    setLinkDialogOpen(true);
  }

  function rememberImageSelection() {
    if (!editor) return;
    const selectedImage = editor.isActive("image");
    const attributes = selectedImage ? editor.getAttributes("image") || {} : {};
    imageSelectionRef.current = {
      attributes,
      expectedSrc:
        selectedImage && typeof attributes.src === "string"
          ? attributes.src
          : undefined,
      nodePos: selectedImage ? editor.state.selection.from : undefined,
      insertionPos: selectedImage ? undefined : editor.state.selection.from,
    };
  }

  function openImagePicker() {
    if (imageUploadInFlightRef.current) return;
    setImageUploadError("");
    setImageUploadMessage("");
    rememberImageSelection();
    imageFileInputRef.current?.click();
  }

  async function uploadImageFile(file: File) {
    if (imageUploadInFlightRef.current) {
      setImageUploadError(
        "Одно изображение уже загружается. Дождитесь завершения."
      );
      return;
    }
    if (!editor) {
      setImageUploadError("Редактор ещё загружается. Повторите через секунду.");
      return;
    }

    const selection = imageSelectionRef.current;
    const currentAlt =
      typeof selection.attributes.alt === "string"
        ? selection.attributes.alt.trim()
        : "";
    const altText =
      currentAlt.length >= 3 ? currentAlt : suggestedPageImageAlt(file);
    const caption =
      typeof selection.attributes.caption === "string"
        ? selection.attributes.caption.trim()
        : "";

    imageUploadInFlightRef.current = true;
    setImageUploadPending(true);
    setImageUploadError("");
    setImageUploadMessage("Подготавливаем изображение без обрезки…");
    try {
      const result = await uploadEditorImage(file, {
        usage: "inline",
        altText,
        caption,
        collectionName: "Страницы сайта",
      });
      setImageUploadMessage("Изображение загружено. Добавляем его в страницу…");
      const attributes = {
        src: result.url,
        mediaId: result.mediaId,
        alt: altText,
        caption,
        layout:
          typeof selection.attributes.layout === "string"
            ? (selection.attributes.layout as EditorialImageLayout)
            : "wide",
      };
      if (typeof selection.nodePos === "number") {
        if (
          !updateEditorialImageAt(
            editor,
            selection.nodePos,
            attributes,
            selection.expectedSrc
          )
        ) {
          throw new Error(
            "Выбранное изображение изменилось во время загрузки. Файл сохранён в медиатеке, но страница не изменена. Выберите изображение ещё раз."
          );
        }
        setImageUploadMessage("Выбранное изображение точно заменено новым файлом.");
      } else {
        const insertionPos = Math.max(
          0,
          Math.min(
            selection.insertionPos ?? editor.state.selection.from,
            editor.state.doc.content.size
          )
        );
        editor
          .chain()
          .focus()
          .insertContentAt(insertionPos, { type: "image", attrs: attributes })
          .run();
        setImageUploadMessage("Изображение загружено и вставлено в место курсора.");
      }
      setIsDirty(true);
    } catch (error) {
      setImageUploadMessage("");
      setImageUploadError(
        error instanceof Error ? error.message : "Не удалось загрузить изображение."
      );
    } finally {
      imageUploadInFlightRef.current = false;
      setImageUploadPending(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  }

  useEffect(() => {
    const replaceImage = (event: Event) => {
      if (!editor || imageUploadInFlightRef.current) return;
      const detail = (event as CustomEvent<EditorImageReplaceDetail>).detail;
      if (!detail || typeof detail.position !== "number") return;
      imageSelectionRef.current = {
        attributes: detail.attributes || {},
        expectedSrc:
          typeof detail.attributes?.src === "string"
            ? detail.attributes.src
            : undefined,
        nodePos: detail.position,
      };
      editor.commands.setNodeSelection(detail.position);
      setImageUploadError("");
      setImageUploadMessage("");
      imageFileInputRef.current?.click();
    };

    window.addEventListener(EDITOR_IMAGE_REPLACE_EVENT, replaceImage);
    return () => window.removeEventListener(EDITOR_IMAGE_REPLACE_EVENT, replaceImage);
  }, [editor]);

  return (
    <form
      action={savePageAction}
      className={`article-editor${isFullscreen ? " is-fullscreen" : ""}`}
      onSubmit={(event) => {
        if (imageUploadInFlightRef.current) {
          event.preventDefault();
          setImageUploadError(
            "Дождитесь завершения загрузки изображения перед сохранением страницы."
          );
          return;
        }
        window.localStorage.setItem(
          `probpera-page-editor-${page.id}`,
          JSON.stringify({
            title,
            slug,
            contentHtml,
            contentJson,
            savedAt: new Date().toISOString(),
          })
        );
        setIsDirty(false);
      }}
    >
      <input name="id" type="hidden" value={page.id} />
      <input name="expected_updated_at" type="hidden" value={page.updated_at} />
      <input name="catalog_q" type="hidden" value={catalogContext.q} />
      <input name="catalog_status" type="hidden" value={catalogContext.status} />
      <input name="catalog_page" type="hidden" value={catalogContext.page} />
      <input name="editor_revision_page" type="hidden" value={catalogContext.revisionPage} />
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
          <ToolbarButton
            label={imageUploadPending ? "Загрузка изображения…" : "Изображение с компьютера"}
            onClick={openImagePicker}
          />
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
        <input
          ref={imageFileInputRef}
          className="visually-hidden-file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadImageFile(file);
          }}
        />
        {imageUploadMessage && (
          <p className="upload-feedback is-success" role="status">
            {imageUploadMessage}
          </p>
        )}
        {imageUploadError && (
          <p className="upload-feedback is-error" role="alert">
            {imageUploadError}
          </p>
        )}
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
            <button
              className="button-secondary"
              disabled={imageUploadPending}
              name="intent"
              value="save"
            >
              Сохранить
            </button>
            <button
              className="button"
              disabled={imageUploadPending}
              name="intent"
              value="publish"
            >
              Опубликовать
            </button>
          </div>
          <NextLink
            className="button-secondary"
            href={previewHref}
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
      <EditorLinkDialog
        open={linkDialogOpen}
        initialValue={linkDialogInitialValue}
        onCancel={() => setLinkDialogOpen(false)}
        onApply={(href) => {
          setLinkDialogOpen(false);
          if (!editor) return;
          if (!href) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
          } else {
            editor
              .chain()
              .focus()
              .extendMarkRange("link")
              .setLink({ href })
              .run();
          }
          setIsDirty(true);
        }}
      />
    </form>
  );
}
