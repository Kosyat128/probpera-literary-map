"use client";

import { useEffect, useId, useState } from "react";

import { validateEditorLinkHref } from "@/lib/editor-link";

export default function EditorLinkDialog({
  open,
  initialValue,
  onCancel,
  onApply,
}: {
  open: boolean;
  initialValue: string;
  onCancel: () => void;
  onApply: (href: string) => void;
}) {
  const titleId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setError("");
  }, [initialValue, open]);

  if (!open) return null;

  const applyValue = () => {
    const result = validateEditorLinkHref(value);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(result.href);
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
        className="editor-media-modal editor-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      >
        <div className="editor-media-modal-heading">
          <div>
            <span>Ссылка в тексте</span>
            <h2 id={titleId}>Укажите адрес</h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onCancel}>
            ×
          </button>
        </div>
        <label className="field">
          <span>Адрес ссылки</span>
          <input
            autoFocus
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") onCancel();
              if (event.key === "Enter") {
                event.preventDefault();
                applyValue();
              }
            }}
            placeholder="https://…, /раздел/, #фрагмент или mailto:…"
          />
        </label>
        <p>
          Оставьте поле пустым, чтобы удалить ссылку с выделенного текста.
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
            {value.trim() ? "Применить ссылку" : "Удалить ссылку"}
          </button>
        </div>
      </section>
    </div>
  );
}
