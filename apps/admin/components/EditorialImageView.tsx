"use client";

import {
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { requestEditorImageReplacement } from "@/components/editorMediaEvents";
import {
  editorialImageWidthPresets,
  normalizeEditorialImageAttributes,
  type EditorialImageAspect,
  type EditorialImageFit,
} from "@/lib/editorial-media-content";

import type { EditorialImageLayout } from "./EditorialImage";

const layoutLabels: Record<EditorialImageLayout, string> = {
  wide: "Широко",
  normal: "По центру",
  full: "На весь экран",
  left: "Слева",
  right: "Справа",
};

function safeLayout(value: unknown): EditorialImageLayout {
  return value === "normal" || value === "full" || value === "left" || value === "right"
    ? value
    : "wide";
}

const aspectLabels: Record<EditorialImageAspect, string> = {
  auto: "Исходные пропорции",
  "1-1": "Квадрат 1:1",
  "4-3": "Альбом 4:3",
  "3-2": "Фото 3:2",
  "16-9": "Широкий 16:9",
  "2-3": "Портрет 2:3",
};

const fitLabels: Record<EditorialImageFit, string> = {
  contain: "Показывать целиком",
  cover: "Заполнять с кадрированием",
};

function aspectRatio(value: EditorialImageAspect) {
  return value === "auto" ? undefined : value.replace("-", " / ");
}

export default function EditorialImageView({
  node,
  editor,
  getPos,
  selected,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  const position = typeof getPos === "function" ? getPos() : undefined;
  const layout = safeLayout(node.attrs.layout);
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";
  const caption =
    typeof node.attrs.caption === "string" ? node.attrs.caption : "";
  const mediaId =
    typeof node.attrs.mediaId === "string" && node.attrs.mediaId.trim()
      ? node.attrs.mediaId.trim()
      : undefined;
  const media = normalizeEditorialImageAttributes(node.attrs);
  const wrapperStyle = {
    "--editorial-image-width": `${media.width}%`,
    "--editorial-image-max-width": media.maxWidth
      ? `${media.maxWidth}px`
      : "2400px",
  } as CSSProperties;
  const previewStyle: CSSProperties = {
    aspectRatio: aspectRatio(media.aspect),
    objectFit: media.fit,
    objectPosition: `${Math.round(media.focusX * 100)}% ${Math.round(
      media.focusY * 100
    )}%`,
  };

  const selectImage = () => {
    if (typeof position === "number") {
      editor.commands.setNodeSelection(position);
    }
  };

  const replaceImage = () => {
    if (typeof position !== "number") return;
    selectImage();
    requestEditorImageReplacement({
      position,
      attributes: { ...node.attrs },
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectImage();
      return;
    }
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    event.preventDefault();
    if (window.confirm("Удалить это изображение из статьи?")) deleteNode();
  };

  return (
    <NodeViewWrapper
      as="figure"
      className={`editorial-image-node is-${layout}${selected ? " is-selected" : ""}`}
      data-image-layout={layout}
      data-image-width={media.width}
      data-image-max-width={media.maxWidth}
      data-image-aspect={media.aspect}
      data-image-fit={media.fit}
      data-focus-x={media.focusX}
      data-focus-y={media.focusY}
      data-lightbox={String(media.lightbox)}
      data-decorative={String(media.decorative)}
      data-media-id={mediaId}
      style={wrapperStyle}
      tabIndex={0}
      aria-label={alt ? `Изображение: ${alt}` : "Изображение в статье"}
      onClick={selectImage}
      onFocus={(event: ReactFocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) selectImage();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="editorial-image-stage">
        <img
          className="editorial-image-preview"
          src={String(node.attrs.src || "")}
          alt={media.decorative ? "" : alt}
          role={media.decorative ? "presentation" : undefined}
          style={previewStyle}
          draggable={false}
        />
        <div
          className="editorial-image-quick-actions"
          contentEditable={false}
          aria-label="Действия с изображением"
        >
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              replaceImage();
            }}
          >
            Заменить изображение
          </button>
          <button
            type="button"
            className="is-danger"
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.stopPropagation();
              if (window.confirm("Удалить это изображение из статьи?")) {
                deleteNode();
              }
            }}
          >
            Удалить
          </button>
        </div>
      </div>

      {selected && (
        <div
          className="editorial-image-inspector"
          contentEditable={false}
          onClick={(event) => event.stopPropagation()}
        >
          <label>
            <span>Описание изображения</span>
            <input
              value={alt}
              maxLength={500}
              onChange={(event) =>
                updateAttributes({ alt: event.target.value })
              }
              placeholder="Что изображено - для доступности и поиска"
            />
          </label>
          <label>
            <span>Подпись под изображением</span>
            <input
              value={caption}
              maxLength={600}
              onChange={(event) =>
                updateAttributes({ caption: event.target.value })
              }
              placeholder="Необязательно"
            />
          </label>
          <div
            className="editorial-image-layouts"
            role="group"
            aria-label="Расположение изображения"
          >
            {(
              Object.entries(layoutLabels) as Array<
                [EditorialImageLayout, string]
              >
            ).map(([value, label]) => (
              <button
                type="button"
                className={layout === value ? "is-active" : undefined}
                aria-pressed={layout === value}
                key={value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateAttributes({ layout: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <fieldset className="editorial-image-widths">
            <legend>Ширина изображения</legend>
            <div role="group" aria-label="Готовые размеры изображения">
              {editorialImageWidthPresets.map((value) => (
                <button
                  type="button"
                  className={media.width === value ? "is-active" : undefined}
                  aria-pressed={media.width === value}
                  key={value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => updateAttributes({ width: value })}
                >
                  {value}%
                </button>
              ))}
            </div>
            <label>
              <span>Своя ширина, 20-100%</span>
              <input
                type="number"
                min={20}
                max={100}
                step={1}
                value={media.width}
                onChange={(event) =>
                  updateAttributes({
                    width: Math.min(100, Math.max(20, Number(event.target.value) || 20)),
                  })
                }
              />
            </label>
            <label>
              <span>Максимум в пикселях (0 - без ограничения)</span>
              <input
                type="number"
                min={0}
                max={2400}
                step={10}
                value={media.maxWidth}
                onChange={(event) =>
                  updateAttributes({
                    maxWidth: Math.min(2400, Math.max(0, Number(event.target.value) || 0)),
                  })
                }
              />
            </label>
          </fieldset>
          <label>
            <span>Пропорции</span>
            <select
              value={media.aspect}
              onChange={(event) => updateAttributes({ aspect: event.target.value })}
            >
              {(Object.entries(aspectLabels) as Array<[EditorialImageAspect, string]>).map(
                ([value, label]) => <option key={value} value={value}>{label}</option>
              )}
            </select>
          </label>
          <label>
            <span>Вписывание</span>
            <select
              value={media.fit}
              onChange={(event) => updateAttributes({ fit: event.target.value })}
            >
              {(Object.entries(fitLabels) as Array<[EditorialImageFit, string]>).map(
                ([value, label]) => <option key={value} value={value}>{label}</option>
              )}
            </select>
          </label>
          <label>
            <span>Фокус по горизонтали: {Math.round(media.focusX * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={media.focusX}
              onChange={(event) => updateAttributes({ focusX: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Фокус по вертикали: {Math.round(media.focusY * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={media.focusY}
              onChange={(event) => updateAttributes({ focusY: Number(event.target.value) })}
            />
          </label>
          <label>
            <span>Автор / правообладатель</span>
            <input
              value={media.credit}
              maxLength={300}
              onChange={(event) => updateAttributes({ credit: event.target.value })}
              placeholder="Имя автора изображения"
            />
          </label>
          <label>
            <span>Источник</span>
            <input
              value={media.source}
              maxLength={600}
              onChange={(event) => updateAttributes({ source: event.target.value })}
              placeholder="Архив, коллекция или URL"
            />
          </label>
          <label>
            <span>Лицензия</span>
            <input
              value={media.license}
              maxLength={300}
              onChange={(event) => updateAttributes({ license: event.target.value })}
              placeholder="Например, общественное достояние"
            />
          </label>
          <label>
            <span>Ссылка на лицензию</span>
            <input
              value={media.licenseUrl}
              maxLength={2000}
              onChange={(event) => updateAttributes({ licenseUrl: event.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="editorial-image-inspector-wide">
            <span>Ссылка при нажатии</span>
            <input
              value={media.link}
              maxLength={2000}
              onChange={(event) => updateAttributes({ link: event.target.value })}
              placeholder="Необязательно: https://… или /страница/"
            />
          </label>
          <div className="editorial-image-toggles">
            <label>
              <input
                type="checkbox"
                checked={media.lightbox}
                onChange={(event) => updateAttributes({ lightbox: event.target.checked })}
              />
              <span>Открывать крупно</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={media.decorative}
                onChange={(event) =>
                  updateAttributes({
                    decorative: event.target.checked,
                    ...(event.target.checked ? { alt: "" } : {}),
                  })
                }
              />
              <span>Декоративное изображение</span>
            </label>
          </div>
        </div>
      )}
    </NodeViewWrapper>
  );
}
