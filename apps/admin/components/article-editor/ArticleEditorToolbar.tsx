"use client";

import type { Editor } from "@tiptap/core";
import type { ReactNode } from "react";

import {
  insertEditorialBlock,
  setEditorialBlockReveal,
} from "@/components/EditorialBlock";
import RichEditorToolbar from "@/components/rich-editor/RichEditorToolbar";
import {
  articleTextTones,
  articleTypographyScopes,
} from "@/lib/article-content-presentation";

type ArticleEditorToolbarState = {
  disabled: boolean;
  imageUploadBusy: boolean;
  fullscreen: boolean;
};

type ArticleEditorToolbarActions = {
  openLink: () => void;
  uploadImage: () => void;
  openMediaLibrary: () => void;
  addImageByUrl: () => void;
  addGallery: () => void;
  addSlider: () => void;
  toggleFullscreen: () => void;
};

function ToolbarButton({
  label,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "is-active" : undefined}
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={typeof active === "boolean" ? active : undefined}
    >
      {label}
    </button>
  );
}

function ToolbarMenu({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="editor-tool-menu">
      <summary>{label}</summary>
      <div className="editor-tool-menu-panel">{children}</div>
    </details>
  );
}

export default function ArticleEditorToolbar({
  editor,
  state,
  actions,
}: {
  editor: Editor | null;
  state: ArticleEditorToolbarState;
  actions: ArticleEditorToolbarActions;
}) {
  return (
    <div
      className="editor-toolbar"
      role="toolbar"
      aria-label="Панель форматирования"
      aria-busy={state.disabled}
      aria-disabled={state.disabled}
      inert={state.disabled ? true : undefined}
    >
      <RichEditorToolbar
        editor={editor}
        onLink={actions.openLink}
        disabled={state.disabled}
      />

      <ToolbarMenu label="＋ Блок">
        <ToolbarButton label="Факт" onClick={() => insertEditorialBlock(editor, "fact")} />
        <ToolbarButton label="Акцент" onClick={() => insertEditorialBlock(editor, "accent")} />
        <ToolbarButton label="2 колонки" onClick={() => insertEditorialBlock(editor, "columns")} />
        <ToolbarButton label="Хронология" onClick={() => insertEditorialBlock(editor, "timeline")} />
        <ToolbarButton label="Цифры" onClick={() => insertEditorialBlock(editor, "metrics")} />
        <ToolbarButton label="Раздел главы" onClick={() => insertEditorialBlock(editor, "ornament")} />
        <ToolbarButton label="Квадрат для изображения" onClick={() => insertEditorialBlock(editor, "media")} />
      </ToolbarMenu>

      <ToolbarMenu label="Роль текста">
        <ToolbarButton
          label="Обычный текст"
          active={!editor?.isActive("typographyScope")}
          onClick={() => editor?.chain().focus().unsetTypographyScope().run()}
        />
        {articleTypographyScopes.map((scope) => (
          <ToolbarButton
            key={scope.id}
            label={scope.label}
            active={editor?.isActive("typographyScope", { scope: scope.id })}
            onClick={() => editor?.chain().focus().setTypographyScope(scope.id).run()}
          />
        ))}
      </ToolbarMenu>

      <ToolbarMenu label="Фото и галереи">
        <ToolbarButton
          label={state.imageUploadBusy ? "Загрузка…" : "Загрузить фото с компьютера"}
          active={state.imageUploadBusy}
          disabled={state.disabled}
          onClick={actions.uploadImage}
        />
        <ToolbarButton
          label="Выбрать из медиатеки"
          disabled={state.disabled}
          onClick={actions.openMediaLibrary}
        />
        <ToolbarButton
          label="Фото по HTTPS-адресу"
          active={editor?.isActive("image")}
          onClick={actions.addImageByUrl}
        />
        <ToolbarButton label="Галерея" onClick={actions.addGallery} />
        <ToolbarButton label="Слайдер" onClick={actions.addSlider} />
      </ToolbarMenu>

      <ToolbarMenu label="Цвет текста">
        <div
          className="editor-text-tone-palette"
          role="group"
          aria-label="Безопасная палитра цвета текста"
        >
          <button
            type="button"
            className={!editor?.isActive("textTone") ? "is-active" : undefined}
            aria-pressed={!editor?.isActive("textTone")}
            onClick={() => editor?.chain().focus().unsetTextTone().run()}
          >
            <span className="editor-text-tone-reset" aria-hidden="true">A</span>
            <span><strong>Основной</strong><small>Цвет темы</small></span>
          </button>
          {articleTextTones.map((tone) => (
            <button
              type="button"
              key={tone.id}
              className={editor?.isActive("textTone", { tone: tone.id }) ? "is-active" : undefined}
              data-text-tone={tone.id}
              aria-pressed={editor?.isActive("textTone", { tone: tone.id })}
              onClick={() => editor?.chain().focus().setTextTone(tone.id).run()}
            >
              <span className="editor-text-tone-swatch" aria-hidden="true" />
              <span><strong>{tone.label}</strong><small>AAA · от {tone.contrastRatio}:1</small></span>
            </button>
          ))}
        </div>
        <small className="editor-text-tone-note">
          24 редакционных оттенка с контрастом AAA на светлой и тёмной теме. Произвольный CSS не сохраняется.
        </small>
      </ToolbarMenu>

      <ToolbarMenu label="Ещё">
        <ToolbarButton label="Зачёркнутый" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()} />
        <ToolbarButton label="Текст слева" active={editor?.isActive({ textAlign: "left" })} onClick={() => editor?.chain().focus().setTextAlign("left").run()} />
        <ToolbarButton label="Текст по центру" active={editor?.isActive({ textAlign: "center" })} onClick={() => editor?.chain().focus().setTextAlign("center").run()} />
        <ToolbarButton label="Появление снизу" onClick={() => setEditorialBlockReveal(editor, "fade-up")} />
        <ToolbarButton label="Появление слева" onClick={() => setEditorialBlockReveal(editor, "slide-left")} />
        <ToolbarButton label="Появление с масштабом" onClick={() => setEditorialBlockReveal(editor, "zoom-in")} />
        <ToolbarButton label="Без анимации" onClick={() => setEditorialBlockReveal(editor, "none")} />
        <ToolbarButton label="Очистить формат" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} />
        <ToolbarButton
          label={state.fullscreen ? "Свернуть редактор" : "На весь экран"}
          active={state.fullscreen}
          onClick={actions.toggleFullscreen}
        />
      </ToolbarMenu>
    </div>
  );
}
