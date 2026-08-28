"use client";

import type { Editor } from "@tiptap/core";

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : undefined}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={typeof active === "boolean" ? active : undefined}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function RichEditorToolbar({
  editor,
  onLink,
  disabled = false,
}: {
  editor: Editor | null;
  onLink: () => void;
  disabled?: boolean;
}) {
  const unavailable = disabled || !editor;

  return (
    <div className="editor-toolbar-primary">
      <ToolbarButton
        label="Жирный"
        active={Boolean(editor?.isActive("bold"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        label="Курсив"
        active={Boolean(editor?.isActive("italic"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        label="Подчёркнутый"
        active={Boolean(editor?.isActive("underline"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      />
      {([2, 3, 4] as const).map((level) => (
        <ToolbarButton
          key={level}
          label={`H${level}`}
          active={Boolean(editor?.isActive("heading", { level }))}
          disabled={unavailable}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level }).run()
          }
        />
      ))}
      <ToolbarButton
        label="• Список"
        active={Boolean(editor?.isActive("bulletList"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        label="1. Список"
        active={Boolean(editor?.isActive("orderedList"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        label="Цитата"
        active={Boolean(editor?.isActive("blockquote"))}
        disabled={unavailable}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      />
      <ToolbarButton
        label="Ссылка"
        active={Boolean(editor?.isActive("link"))}
        disabled={unavailable}
        onClick={onLink}
      />
      <ToolbarButton
        label="↶ Отменить"
        disabled={unavailable}
        onClick={() => editor?.chain().focus().undo().run()}
      />
      <ToolbarButton
        label="↷ Повторить"
        disabled={unavailable}
        onClick={() => editor?.chain().focus().redo().run()}
      />
    </div>
  );
}
