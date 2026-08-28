"use client";

import NextLink from "next/link";

export type GalleryEditorKind = "gallery" | "slider";

export default function GalleryEditor({
  kind,
  value,
  error,
  onValueChange,
  onCancel,
  onConfirm,
}: {
  kind: GalleryEditorKind | null;
  value: string;
  error: string;
  onValueChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!kind) return null;

  const validUrlCount = value
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter((item) => /^https:\/\//iu.test(item))
    .slice(0, 8).length;

  return (
    <div
      className="editor-media-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
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
              {kind === "slider" ? "Собрать слайдер" : "Собрать галерею"}
            </h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onCancel}>
            ×
          </button>
        </div>
        <p>
          Вставьте до восьми HTTPS-адресов - по одному в строке. Изображения
          останутся одним блоком; порядок строк станет порядком кадров. После
          вставки выберите каждый кадр и уточните его описание через «Фото /
          заменить».
        </p>
        <textarea
          autoFocus
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          rows={9}
          placeholder={
            "https://…/image-1.webp\nhttps://…/image-2.webp\nhttps://…/image-3.webp"
          }
          aria-label="Адреса изображений"
        />
        <div className="editor-media-modal-summary">
          <span>{validUrlCount} из 8 изображений</span>
          <NextLink href="/media" target="_blank">
            Открыть медиатеку ↗
          </NextLink>
        </div>
        {error && (
          <p className="editor-media-modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-media-modal-actions">
          <button className="button-secondary" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button className="button" type="button" onClick={onConfirm}>
            {kind === "slider" ? "Вставить слайдер" : "Вставить галерею"}
          </button>
        </div>
      </section>
    </div>
  );
}
