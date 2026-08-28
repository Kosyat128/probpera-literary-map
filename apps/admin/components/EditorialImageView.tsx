"use client";

import {
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { requestEditorImageReplacement } from "@/components/editorMediaEvents";

import type { EditorialImageLayout } from "./EditorialImage";

const layoutLabels: Record<EditorialImageLayout, string> = {
  wide: "Широко",
  normal: "По центру",
  left: "Слева",
  right: "Справа",
};

function safeLayout(value: unknown): EditorialImageLayout {
  return value === "normal" || value === "left" || value === "right"
    ? value
    : "wide";
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
      data-media-id={mediaId}
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
          alt={alt}
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
        </div>
      )}
    </NodeViewWrapper>
  );
}
