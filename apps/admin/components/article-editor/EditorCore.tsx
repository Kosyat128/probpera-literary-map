"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import NextLink from "next/link";
import type {
  ClipboardEvent as ReactClipboardEvent,
  DragEvent as ReactDragEvent,
  Ref,
  RefCallback,
} from "react";

import { CLIENT_IMAGE_ACCEPT_ATTRIBUTE } from "../../lib/client-image-upload";

import ArticleEditorToolbar from "./ArticleEditorToolbar";
import { EnglishTranslationNotice } from "./TranslationPanel";
import type { ArticleEditorLocale } from "./ArticleEditorTypes";

export type EditorCoreTemplate = {
  label: string;
  description: string;
  html: string;
};

export type EditorCoreCustomTemplate = {
  id: string;
  label: string;
  html: string;
  visibility?: "personal" | "shared";
  canDelete?: boolean;
  localOnly?: boolean;
};

export type EditorCoreModel = {
  activeLocale: ArticleEditorLocale;
  editor: Editor | null;
  templates: readonly EditorCoreTemplate[];
  customTemplates: readonly EditorCoreCustomTemplate[];
  templatePending: boolean;
  templateMessage: string;
  imageUploadActive: boolean;
  imageUploadBusy: boolean;
  imageUploadMessage: string;
  imageUploadError: string;
  fullscreen: boolean;
  imageDraggingOverEditor: boolean;
};

export type EditorCoreActions = {
  applyTemplate: (html: string, label: string) => void;
  saveCustomTemplate: () => void;
  clearCustomTemplates: () => void;
  openLink: () => void;
  uploadImage: () => void;
  openMediaLibrary: () => void;
  addImageByUrl: () => void;
  addGallery: () => void;
  addSlider: () => void;
  toggleFullscreen: () => void;
  handleFileInput: (files: FileList | null) => void;
  rememberMediaSelection: () => void;
  enqueueFiles: (files: File[]) => void;
  handleEditorDrop: (event: ReactDragEvent<HTMLElement>) => void;
  handleEditorPaste: (event: ReactClipboardEvent<HTMLElement>) => void;
  setImageDraggingOverEditor: (dragging: boolean) => void;
};

export type EditorCoreRefs = {
  fileInputRef: Ref<HTMLInputElement>;
  mediaSectionRef: RefCallback<HTMLButtonElement>;
  textSectionRef: RefCallback<HTMLDivElement>;
};

export default function EditorCore({
  model,
  actions,
  refs,
}: {
  model: EditorCoreModel;
  actions: EditorCoreActions;
  refs: EditorCoreRefs;
}) {
  return (
    <section
      className={`panel editor-surface${
        model.imageUploadActive ? " is-media-uploading" : ""
      }`}
      aria-busy={model.imageUploadActive}
    >
      {model.activeLocale === "ru" ? (
        <details className="editor-template-bar">
          <summary>
            <span>Или начать с готовой структуры</span>
            <small>
              7 редакционных форматов - выберите основу и замените содержимое
            </small>
          </summary>
          <div className="editor-template-options">
            {model.templates.map((template) => (
              <button
                type="button"
                className="editor-template-card"
                key={template.label}
                onClick={() => actions.applyTemplate(template.html, template.label)}
              >
                <strong>{template.label}</strong>
                <small>{template.description}</small>
              </button>
            ))}
            {model.customTemplates.map((template) => (
              <button
                type="button"
                key={template.id}
                onClick={() => actions.applyTemplate(template.html, template.label)}
                title={
                  template.localOnly
                    ? "Локальный шаблон - сохраните его заново, чтобы перенести в базу"
                    : template.visibility === "shared"
                      ? "Общий шаблон редакции"
                      : "Личный шаблон"
                }
              >
                {template.visibility === "shared" ? "◆" : "★"}{" "}
                {template.label}
                {template.localOnly ? " · локальный" : ""}
              </button>
            ))}
            <button
              type="button"
              onClick={actions.saveCustomTemplate}
              disabled={model.templatePending}
            >
              ＋ Сохранить как шаблон
            </button>
            <NextLink className="editor-template-link" href="/media" target="_blank">
              Медиатека ↗
            </NextLink>
            {model.customTemplates.length > 0 && (
              <button
                type="button"
                onClick={actions.clearCustomTemplates}
                disabled={model.templatePending}
              >
                Удалить мои шаблоны
              </button>
            )}
          </div>
          {model.templateMessage && (
            <small role="status">{model.templateMessage}</small>
          )}
        </details>
      ) : (
        <EnglishTranslationNotice />
      )}

      <ArticleEditorToolbar
        editor={model.editor}
        state={{
          disabled: model.imageUploadActive,
          imageUploadBusy: model.imageUploadBusy,
          fullscreen: model.fullscreen,
        }}
        actions={{
          openLink: actions.openLink,
          uploadImage: actions.uploadImage,
          openMediaLibrary: actions.openMediaLibrary,
          addImageByUrl: actions.addImageByUrl,
          addGallery: actions.addGallery,
          addSlider: actions.addSlider,
          toggleFullscreen: actions.toggleFullscreen,
        }}
      />

      <input
        ref={refs.fileInputRef}
        className="visually-hidden-file"
        type="file"
        multiple
        accept={CLIENT_IMAGE_ACCEPT_ATTRIBUTE}
        onChange={(event) => actions.handleFileInput(event.target.files)}
      />
      <button
        ref={refs.mediaSectionRef}
        className={
          model.imageUploadBusy
            ? "editor-direct-upload is-uploading"
            : "editor-direct-upload"
        }
        type="button"
        onClick={actions.uploadImage}
        onDragEnter={actions.rememberMediaSelection}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          actions.rememberMediaSelection();
          actions.enqueueFiles(Array.from(event.dataTransfer.files || []));
        }}
        disabled={model.imageUploadActive}
      >
        <strong>
          {model.imageUploadBusy
            ? "Оптимизируем изображение…"
            : "Нажмите или перетащите фотографию сюда"}
        </strong>
        <span>
          Она загрузится с компьютера, преобразуется в WebP и появится в месте
          курсора. Если выбрана старая фотография, новая заменит её.
        </span>
      </button>
      {model.imageUploadMessage && (
        <p className="upload-feedback is-success" role="status">
          {model.imageUploadMessage}
        </p>
      )}
      {model.imageUploadError && (
        <p className="upload-feedback is-error" role="alert">
          {model.imageUploadError}
        </p>
      )}

      <div
        ref={refs.textSectionRef}
        className={
          model.imageDraggingOverEditor
            ? "editor-content-drop-target is-dragging"
            : "editor-content-drop-target"
        }
        inert={model.imageUploadActive ? true : undefined}
        onDragEnterCapture={(event) => {
          if (
            Array.from(event.dataTransfer.items || []).some(
              (item) =>
                item.kind === "file" && item.type.startsWith("image/")
            )
          ) {
            actions.setImageDraggingOverEditor(true);
          }
        }}
        onDragOverCapture={(event) => {
          if (
            Array.from(event.dataTransfer.items || []).some(
              (item) =>
                item.kind === "file" && item.type.startsWith("image/")
            )
          ) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }
        }}
        onDragLeave={(event) => {
          if (
            !event.currentTarget.contains(event.relatedTarget as Node | null)
          ) {
            actions.setImageDraggingOverEditor(false);
          }
        }}
        onDropCapture={(event) => {
          actions.setImageDraggingOverEditor(false);
          actions.handleEditorDrop(event);
        }}
        onPasteCapture={actions.handleEditorPaste}
      >
        <EditorContent editor={model.editor} />
        {model.imageDraggingOverEditor && (
          <span className="editor-drop-hint" aria-hidden="true">
            Отпустите изображение - оно появится в этом месте статьи
          </span>
        )}
      </div>
    </section>
  );
}
