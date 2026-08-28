"use client";

import {
  NodeViewContent,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import type {
  DragEvent as ReactDragEvent,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { requestEditorMediaSlot } from "@/components/editorMediaEvents";

function editorPosition(getPos: NodeViewProps["getPos"]) {
  return typeof getPos === "function" ? getPos() : undefined;
}

export default function EditorialBlockView({
  node,
  getPos,
  selected,
}: NodeViewProps) {
  const kind = typeof node.attrs.kind === "string" ? node.attrs.kind : "fact";
  const reveal =
    typeof node.attrs.reveal === "string" ? node.attrs.reveal : "none";
  const className = `article-design-block is-${kind}${selected ? " is-selected" : ""}`;

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
