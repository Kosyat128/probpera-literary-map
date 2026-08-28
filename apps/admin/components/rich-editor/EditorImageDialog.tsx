"use client";

import { useEffect, useId, useState } from "react";

import { useEditorDialogFocus } from "@/components/useEditorDialogFocus";

export type EditorImageDialogValue = {
  src: string;
  alt: string;
  caption: string;
};

function validateHttpsImageSource(value: string) {
  const source = value.trim();
  if (!source) return "Укажите HTTPS-адрес изображения.";
  try {
    if (new URL(source).protocol !== "https:") {
      return "Адрес изображения должен начинаться с https://.";
    }
  } catch {
    return "Проверьте адрес изображения.";
  }
  return "";
}

export default function EditorImageDialog({
  open,
  initialValue,
  onCancel,
  onApply,
}: {
  open: boolean;
  initialValue: EditorImageDialogValue;
  onCancel: () => void;
  onApply: (value: EditorImageDialogValue) => void;
}) {
  const titleId = useId();
  const [src, setSrc] = useState(initialValue.src);
  const [alt, setAlt] = useState(initialValue.alt);
  const [caption, setCaption] = useState(initialValue.caption);
  const [error, setError] = useState("");
  const { dialogRef, onDialogKeyDown } = useEditorDialogFocus({
    open,
    onClose: onCancel,
  });

  useEffect(() => {
    if (!open) return;
    setSrc(initialValue.src);
    setAlt(initialValue.alt);
    setCaption(initialValue.caption);
    setError("");
  }, [initialValue, open]);

  if (!open) return null;

  const applyValue = () => {
    const sourceError = validateHttpsImageSource(src);
    if (sourceError) {
      setError(sourceError);
      return;
    }
    onApply({
      src: src.trim(),
      alt: alt.trim(),
      caption: caption.trim(),
    });
  };

  return (
    <div
      className="editor-media-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="editor-media-modal editor-image-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <div className="editor-media-modal-heading">
          <div>
            <span>Изображение в тексте</span>
            <h2 id={titleId}>Добавить по HTTPS-адресу</h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onCancel}>
            ×
          </button>
        </div>
        <label className="field">
          <span>HTTPS-адрес изображения *</span>
          <input
            data-editor-dialog-initial-focus
            type="url"
            value={src}
            onChange={(event) => {
              setSrc(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyValue();
              }
            }}
            placeholder="https://…/image.webp"
          />
        </label>
        <label className="field">
          <span>Описание изображения</span>
          <input
            value={alt}
            maxLength={500}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="Что изображено — для доступности и поиска"
          />
        </label>
        <label className="field">
          <span>Подпись</span>
          <input
            value={caption}
            maxLength={600}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Необязательно"
          />
        </label>
        <p>
          Файл по ссылке не копируется в медиатеку. Для редакционного хранения
          используйте загрузку с компьютера.
        </p>
        {error && (
          <p className="editor-media-modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-media-modal-actions">
          <button className="button-secondary" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className="button" type="button" onClick={applyValue}>
            {initialValue.src ? "Обновить изображение" : "Добавить изображение"}
          </button>
        </div>
      </section>
    </div>
  );
}
