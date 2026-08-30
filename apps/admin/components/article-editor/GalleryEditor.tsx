"use client";

import { useId } from "react";

import { useEditorDialogFocus } from "@/components/useEditorDialogFocus";
import {
  EDITORIAL_GALLERY_MAX_ITEMS,
  mergeEditorialGalleryItems,
  parseEditorialGalleryUrls,
  type EditorialGalleryItemInput,
  type EditorialGallerySettings,
} from "@/lib/editorial-gallery";

export type GalleryEditorKind = "gallery" | "slider";

export default function GalleryEditor({
  kind,
  value,
  error,
  contextLabel = "статьи",
  settings,
  items,
  onValueChange,
  onSettingsChange,
  onOpenMediaLibrary,
  onUploadFiles,
  onRemoveItem,
  onCancel,
  onConfirm,
}: {
  kind: GalleryEditorKind | null;
  value: string;
  error: string;
  contextLabel?: string;
  settings: EditorialGallerySettings;
  items: EditorialGalleryItemInput[];
  onValueChange: (value: string) => void;
  onSettingsChange: (settings: EditorialGallerySettings) => void;
  onOpenMediaLibrary: () => void;
  onUploadFiles: () => void;
  onRemoveItem: (index: number) => void;
  onCancel: () => void;
  onConfirm: (settings: EditorialGallerySettings) => void;
}) {
  const titleId = useId();
  const { dialogRef, onDialogKeyDown } = useEditorDialogFocus({
    open: kind !== null,
    onClose: onCancel,
  });

  if (!kind) return null;

  const validUrlCount = parseEditorialGalleryUrls(value).length;
  const totalCount = mergeEditorialGalleryItems(
    items,
    parseEditorialGalleryUrls(value)
  ).length;
  const atLimit = totalCount >= EDITORIAL_GALLERY_MAX_ITEMS;
  const setSetting = <Key extends keyof EditorialGallerySettings>(
    key: Key,
    nextValue: EditorialGallerySettings[Key]
  ) => onSettingsChange({ ...settings, [key]: nextValue });

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
        className="editor-media-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <div className="editor-media-modal-heading">
          <div>
            <span>Изображения {contextLabel}</span>
            <h2 id={titleId}>
              {kind === "slider" ? "Собрать слайдер" : "Собрать галерею"}
            </h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onCancel}>
            ×
          </button>
        </div>
        <p>
          Загрузите файлы или последовательно выберите изображения из медиатеки.
          Порядок выбора станет порядком кадров; после вставки его можно изменить
          в инспекторе блока.
        </p>
        <div className="editor-gallery-source-actions">
          <button
            className="button"
            data-editor-dialog-initial-focus
            type="button"
            disabled={atLimit}
            onClick={onUploadFiles}
          >
            Загрузить с компьютера
          </button>
          <button
            className="button-secondary"
            type="button"
            disabled={atLimit}
            onClick={onOpenMediaLibrary}
          >
            Выбрать в медиатеке
          </button>
        </div>
        {items.length > 0 && (
          <ol
            className="editor-gallery-composer-items"
            aria-label="Выбранные изображения"
          >
            {items.map((item, index) => (
              <li key={`${item.mediaId || item.src}-${index}`}>
                <span>
                  <strong>
                    {index + 1}. {item.alt?.trim() || "Изображение"}
                  </strong>
                  <small>{item.caption?.trim() || item.src}</small>
                </span>
                <button
                  className="text-button"
                  type="button"
                  aria-label={`Убрать изображение ${index + 1} из подборки`}
                  onClick={() => onRemoveItem(index)}
                >
                  Убрать
                </button>
              </li>
            ))}
          </ol>
        )}
        <label className="editor-gallery-legacy-import">
          <span>Дополнительно: импорт по HTTPS-адресам, по одному в строке</span>
          <textarea
            value={value}
            onChange={(event) => onValueChange(event.target.value)}
            rows={5}
            placeholder={
              "https://…/image-1.webp\nhttps://…/image-2.webp\nhttps://…/image-3.webp"
            }
            aria-label="Адреса изображений"
          />
        </label>
        <div className="editor-media-modal-summary">
          <span>
            {totalCount} из {EDITORIAL_GALLERY_MAX_ITEMS} изображений
            {validUrlCount > 0 ? ` · ${validUrlCount} по адресам` : ""}
          </span>
        </div>
        <fieldset className="editor-gallery-settings">
          <legend>Отображение блока</legend>
          {kind === "gallery" && (
            <div className="editor-gallery-settings-grid">
              <label>
                Колонки на компьютере
                <select
                  value={settings.columnsDesktop}
                  onChange={(event) =>
                    setSetting("columnsDesktop", Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4, 5, 6].map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                На планшете
                <select
                  value={settings.columnsTablet}
                  onChange={(event) =>
                    setSetting("columnsTablet", Number(event.target.value))
                  }
                >
                  {[1, 2, 3, 4].map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                На телефоне
                <select
                  value={settings.columnsMobile}
                  onChange={(event) =>
                    setSetting("columnsMobile", Number(event.target.value))
                  }
                >
                  {[1, 2].map((value) => (
                    <option value={value} key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <div className="editor-gallery-settings-grid">
            <label>
              Интервал между кадрами
              <select
                value={settings.gap}
                onChange={(event) =>
                  setSetting(
                    "gap",
                    event.target.value as EditorialGallerySettings["gap"]
                  )
                }
              >
                <option value="compact">Компактный</option>
                <option value="normal">Обычный</option>
                <option value="spacious">Свободный</option>
              </select>
            </label>
            <label>
              Пропорции
              <select
                value={settings.aspect}
                onChange={(event) =>
                  setSetting(
                    "aspect",
                    event.target.value as EditorialGallerySettings["aspect"]
                  )
                }
              >
                <option value="auto">Исходные</option>
                <option value="1-1">1:1</option>
                <option value="4-3">4:3</option>
                <option value="3-2">3:2</option>
                <option value="16-9">16:9</option>
                <option value="2-3">2:3</option>
              </select>
            </label>
            <label>
              Кадрирование
              <select
                value={settings.fit}
                onChange={(event) =>
                  setSetting(
                    "fit",
                    event.target.value as EditorialGallerySettings["fit"]
                  )
                }
              >
                <option value="cover">Заполнять рамку</option>
                <option value="contain">Показывать целиком</option>
              </select>
            </label>
          </div>
          <div className="editor-gallery-toggles">
            <label>
              <input
                type="checkbox"
                checked={settings.captions}
                onChange={(event) => setSetting("captions", event.target.checked)}
              />
              Показывать подписи
            </label>
            <label>
              <input
                type="checkbox"
                checked={settings.lightbox}
                onChange={(event) => setSetting("lightbox", event.target.checked)}
              />
              Открывать крупно
            </label>
            {kind === "slider" && (
              <>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.arrows}
                    onChange={(event) => setSetting("arrows", event.target.checked)}
                  />
                  Стрелки
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.dots}
                    onChange={(event) => setSetting("dots", event.target.checked)}
                  />
                  Точки
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.autoplay}
                    onChange={(event) => setSetting("autoplay", event.target.checked)}
                  />
                  Автопрокрутка
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={settings.loop}
                    onChange={(event) => setSetting("loop", event.target.checked)}
                  />
                  Зациклить
                </label>
              </>
            )}
          </div>
          {kind === "slider" && settings.autoplay && (
            <label className="editor-gallery-interval">
              Интервал автопрокрутки, секунд
              <input
                type="number"
                min={2}
                max={15}
                step={1}
                value={settings.interval / 1000}
                onChange={(event) =>
                  setSetting("interval", Number(event.target.value) * 1000)
                }
              />
            </label>
          )}
        </fieldset>
        {error && (
          <p className="editor-media-modal-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-media-modal-actions">
          <button className="button-secondary" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button
            className="button"
            type="button"
            onClick={() => onConfirm(settings)}
          >
            {kind === "slider" ? "Вставить слайдер" : "Вставить галерею"}
          </button>
        </div>
      </section>
    </div>
  );
}
