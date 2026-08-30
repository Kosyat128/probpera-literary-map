"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import { useEffect, useRef } from "react";
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from "react";

import { requestEditorMediaSlot } from "@/components/editorMediaEvents";
import {
  createEditorialGalleryId,
  editorialGalleryHtmlAttributes,
  editorialGalleryNodeAttributes,
  editorialGallerySettingsFromNodeAttributes,
  type EditorialGalleryKind,
  type EditorialGallerySettings,
} from "@/lib/editorial-gallery";

function editorPosition(getPos: NodeViewProps["getPos"]) {
  return typeof getPos === "function" ? getPos() : undefined;
}

export default function EditorialBlockView({
  node,
  editor,
  getPos,
  selected,
  updateAttributes,
}: NodeViewProps) {
  const kind = typeof node.attrs.kind === "string" ? node.attrs.kind : "fact";
  const reveal =
    typeof node.attrs.reveal === "string" ? node.attrs.reveal : "none";
  const className = `article-design-block is-${kind}${selected ? " is-selected" : ""}`;
  const legacyGalleryIdRef = useRef("");
  const collectionKind: EditorialGalleryKind | null =
    kind === "gallery" || kind === "slider" ? kind : null;

  useEffect(() => {
    if (!selected || !collectionKind || node.attrs.galleryId) return;
    if (!legacyGalleryIdRef.current) {
      legacyGalleryIdRef.current = createEditorialGalleryId();
    }
    const settings = editorialGallerySettingsFromNodeAttributes(
      node.attrs,
      collectionKind
    );
    updateAttributes(
      editorialGalleryNodeAttributes(
        { ...settings, id: legacyGalleryIdRef.current },
        collectionKind
      )
    );
  }, [collectionKind, node.attrs, selected, updateAttributes]);

  if (kind === "gallery" || kind === "slider") {
    const galleryKind: EditorialGalleryKind = kind;
    const settings = editorialGallerySettingsFromNodeAttributes(
      node.attrs,
      galleryKind
    );
    const htmlAttributes = editorialGalleryHtmlAttributes(settings, galleryKind);
    const children = Array.from(node.content.content);
    const imageChildren = children.flatMap((child, childIndex) =>
      child.type.name === "image" ? [{ child, childIndex }] : []
    );

    const selectCollection = () => {
      const position = editorPosition(getPos);
      if (typeof position === "number") editor.commands.setNodeSelection(position);
    };

    const handleCollectionClick = (event: ReactMouseEvent<HTMLElement>) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".editorial-image-node")
      ) {
        return;
      }
      selectCollection();
    };

    const replaceChildren = (nextChildren: typeof children) => {
      const position = editorPosition(getPos);
      if (typeof position !== "number") return;
      const replacement = node.type.create(node.attrs, nextChildren, node.marks);
      editor.view.dispatch(
        editor.state.tr
          .replaceWith(position, position + node.nodeSize, replacement)
          .scrollIntoView()
      );
      editor.commands.setNodeSelection(position);
    };

    const moveImage = (imageIndex: number, direction: -1 | 1) => {
      const current = imageChildren[imageIndex];
      const target = imageChildren[imageIndex + direction];
      if (!current || !target) return;
      const nextChildren = [...children];
      [nextChildren[current.childIndex], nextChildren[target.childIndex]] = [
        nextChildren[target.childIndex],
        nextChildren[current.childIndex],
      ];
      replaceChildren(nextChildren);
    };

    const removeImage = (imageIndex: number) => {
      const current = imageChildren[imageIndex];
      if (!current) return;
      replaceChildren(
        children.filter((_, childIndex) => childIndex !== current.childIndex)
      );
    };

    const updateSetting = <Key extends keyof EditorialGallerySettings>(
      key: Key,
      value: EditorialGallerySettings[Key]
    ) => {
      updateAttributes(
        editorialGalleryNodeAttributes(
          { ...settings, [key]: value },
          galleryKind,
          { createId: true }
        )
      );
    };

    return (
      <NodeViewWrapper
        as="section"
        className={className}
        data-editorial-block={galleryKind}
        data-reveal={reveal}
        {...htmlAttributes}
        onClick={handleCollectionClick}
      >
        {selected && (
          <aside
            className="editor-gallery-inspector"
            contentEditable={false}
            aria-label={
              galleryKind === "slider"
                ? "Настройки слайдера"
                : "Настройки галереи"
            }
            onClick={(event) => event.stopPropagation()}
          >
            <div className="editor-gallery-inspector-heading">
              <strong>
                {galleryKind === "slider" ? "Слайдер" : "Галерея"}: {imageChildren.length}
              </strong>
              <span>Версия {settings.version}</span>
            </div>
            {galleryKind === "gallery" && (
              <div className="editor-gallery-inspector-grid">
                {([
                  ["columnsDesktop", "Компьютер", [1, 2, 3, 4, 5, 6]],
                  ["columnsTablet", "Планшет", [1, 2, 3, 4]],
                  ["columnsMobile", "Телефон", [1, 2]],
                ] as const).map(([key, label, options]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={settings[key]}
                      onChange={(event) => updateSetting(key, Number(event.target.value))}
                    >
                      {options.map((value) => (
                        <option value={value} key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
            <div className="editor-gallery-inspector-grid">
              <label>
                Интервал
                <select
                  value={settings.gap}
                  onChange={(event) =>
                    updateSetting(
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
                    updateSetting(
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
                    updateSetting(
                      "fit",
                      event.target.value as EditorialGallerySettings["fit"]
                    )
                  }
                >
                  <option value="cover">Заполнять</option>
                  <option value="contain">Целиком</option>
                </select>
              </label>
            </div>
            <div className="editor-gallery-inspector-toggles">
              <label>
                <input
                  type="checkbox"
                  checked={settings.captions}
                  onChange={(event) => updateSetting("captions", event.target.checked)}
                />
                Подписи
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.lightbox}
                  onChange={(event) => updateSetting("lightbox", event.target.checked)}
                />
                Просмотр крупно
              </label>
              {galleryKind === "slider" && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.arrows}
                      onChange={(event) => updateSetting("arrows", event.target.checked)}
                    />
                    Стрелки
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.dots}
                      onChange={(event) => updateSetting("dots", event.target.checked)}
                    />
                    Точки
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.autoplay}
                      onChange={(event) => updateSetting("autoplay", event.target.checked)}
                    />
                    Автопрокрутка
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.loop}
                      onChange={(event) => updateSetting("loop", event.target.checked)}
                    />
                    Зациклить
                  </label>
                </>
              )}
            </div>
            {galleryKind === "slider" && settings.autoplay && (
              <label className="editor-gallery-inspector-interval">
                Интервал, секунд
                <input
                  type="number"
                  min={2}
                  max={15}
                  value={settings.interval / 1000}
                  onChange={(event) =>
                    updateSetting("interval", Number(event.target.value) * 1000)
                  }
                />
              </label>
            )}
            <ol className="editor-gallery-items" aria-label="Порядок изображений">
              {imageChildren.map(({ child }, imageIndex) => {
                const label =
                  (typeof child.attrs.alt === "string" && child.attrs.alt.trim()) ||
                  `Изображение ${imageIndex + 1}`;
                return (
                  <li key={`${String(child.attrs.mediaId || child.attrs.src)}-${imageIndex}`}>
                    <span title={label}>{imageIndex + 1}. {label}</span>
                    <div>
                      <button
                        type="button"
                        aria-label={`Переместить изображение ${imageIndex + 1} назад`}
                        disabled={imageIndex === 0}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => moveImage(imageIndex, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Переместить изображение ${imageIndex + 1} вперёд`}
                        disabled={imageIndex === imageChildren.length - 1}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => moveImage(imageIndex, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        aria-label={`Удалить изображение ${imageIndex + 1}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => removeImage(imageIndex)}
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>
        )}
        <NodeViewContent />
      </NodeViewWrapper>
    );
  }

  if (kind !== "media") {
    return (
      <NodeViewWrapper
        as="section"
        className={className}
        data-editorial-block={kind}
        data-reveal={reveal}
      >
        <NodeViewContent />
      </NodeViewWrapper>
    );
  }

  const requestFiles = (files?: File[]) => {
    const position = editorPosition(getPos);
    if (typeof position !== "number") return;
    requestEditorMediaSlot({ position, files });
  };

  const handleDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    if (droppedFiles.length > 0) {
      // A file drop must never fall through to the browser's default
      // navigation, even when the file is not a supported image.
      event.preventDefault();
      event.stopPropagation();
    }
    const files = droppedFiles.filter((item) => item.type.startsWith("image/"));
    if (!files.length) return;
    requestFiles(files);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    requestFiles();
  };

  return (
    <NodeViewWrapper
      as="section"
      className={className}
      data-editorial-block="media"
      data-reveal={reveal}
    >
      <div
        className="editor-media-slot-control"
        role="button"
        tabIndex={0}
        contentEditable={false}
        onClick={() => requestFiles()}
        onKeyDown={handleKeyDown}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDrop={handleDrop}
      >
        <span aria-hidden="true">＋</span>
        <strong>Выбрать изображение</strong>
        <small>Нажмите или перетащите файл в этот квадрат</small>
      </div>
      <NodeViewContent className="editor-media-slot-copy" />
    </NodeViewWrapper>
  );
}
