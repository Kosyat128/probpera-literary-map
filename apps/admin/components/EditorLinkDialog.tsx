"use client";

import { useEffect, useId, useRef, useState } from "react";

import {
  searchEditorInternalLinksAction,
  type EditorInternalLinkItem,
} from "@/app/(dashboard)/editor-links/actions";
import {
  editorLinkDraftFromAttributes,
  editorLinkRelFlags,
  normalizeEditorLinkAttributes,
  type EditorLinkAttributes,
  type EditorLinkRelFlag,
} from "@/lib/editor-link";
import { useEditorDialogFocus } from "@/components/useEditorDialogFocus";

function updateRelFlags(
  current: EditorLinkRelFlag[],
  flag: EditorLinkRelFlag,
  checked: boolean
) {
  const next = new Set(current);
  if (checked) next.add(flag);
  else next.delete(flag);
  return editorLinkRelFlags.filter((item) => next.has(item));
}

export default function EditorLinkDialog({
  open,
  initialValue,
  onCancel,
  onApply,
}: {
  open: boolean;
  initialValue: Record<string, unknown>;
  onCancel: () => void;
  onApply: (attributes: EditorLinkAttributes) => void;
}) {
  const titleId = useId();
  const searchRequestRef = useRef(0);
  const [value, setValue] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [relFlags, setRelFlags] = useState<EditorLinkRelFlag[]>([]);
  const [error, setError] = useState("");
  const [internalQuery, setInternalQuery] = useState("");
  const [internalItems, setInternalItems] = useState<EditorInternalLinkItem[]>([]);
  const [internalSearchPending, setInternalSearchPending] = useState(false);
  const [internalSearchError, setInternalSearchError] = useState("");
  const { dialogRef, onDialogKeyDown } = useEditorDialogFocus({
    open,
    onClose: onCancel,
  });

  useEffect(() => {
    if (!open) return;
    const draft = editorLinkDraftFromAttributes(initialValue);
    setValue(draft.href);
    setOpenInNewTab(draft.openInNewTab);
    setRelFlags(draft.relFlags);
    setError("");
    setInternalQuery("");
    setInternalItems([]);
    setInternalSearchPending(false);
    setInternalSearchError("");
    searchRequestRef.current += 1;
  }, [initialValue, open]);

  useEffect(() => {
    if (!open) return;
    const query = internalQuery.replace(/\s+/gu, " ").trim();
    const requestId = ++searchRequestRef.current;
    if (query.length < 2) {
      setInternalItems([]);
      setInternalSearchPending(false);
      setInternalSearchError("");
      return;
    }

    setInternalSearchPending(true);
    setInternalSearchError("");
    const timer = window.setTimeout(() => {
      void searchEditorInternalLinksAction(query)
        .then((result) => {
          if (searchRequestRef.current !== requestId) return;
          setInternalItems(result.items);
          setInternalSearchError(result.error || "");
        })
        .catch(() => {
          if (searchRequestRef.current !== requestId) return;
          setInternalItems([]);
          setInternalSearchError(
            "Поиск по опубликованным материалам временно недоступен."
          );
        })
        .finally(() => {
          if (searchRequestRef.current === requestId) {
            setInternalSearchPending(false);
          }
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [internalQuery, open]);

  if (!open) return null;

  const applyValue = () => {
    const result = normalizeEditorLinkAttributes({
      href: value,
      openInNewTab,
      relFlags,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onApply(result.attributes);
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
        className="editor-media-modal editor-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <div className="editor-media-modal-heading">
          <div>
            <span>Ссылка в тексте</span>
            <h2 id={titleId}>Выберите материал или укажите адрес</h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onCancel}>
            ×
          </button>
        </div>

        <label className="field">
          <span>Найти опубликованную статью или страницу</span>
          <input
            data-editor-dialog-initial-focus
            value={internalQuery}
            onChange={(event) => setInternalQuery(event.target.value)}
            placeholder="Начните вводить название"
            autoComplete="off"
            aria-controls={`${titleId}-internal-results`}
            aria-describedby={`${titleId}-internal-status`}
          />
        </label>
        <div
          id={`${titleId}-internal-status`}
          role="status"
          aria-live="polite"
        >
          {internalSearchPending
            ? "Ищем опубликованные материалы…"
            : internalSearchError ||
              (internalQuery.trim().length >= 2 && !internalItems.length
                ? "Совпадений среди опубликованных материалов нет."
                : "")}
        </div>
        {internalItems.length > 0 && (
          <div
            id={`${titleId}-internal-results`}
            role="listbox"
            aria-label="Найденные материалы"
            aria-busy={internalSearchPending}
          >
            {internalItems.map((item) => (
              <button
                className="button-secondary"
                type="button"
                role="option"
                aria-selected={value === item.href}
                key={`${item.type}-${item.id}`}
                onClick={() => {
                  setValue(item.href);
                  setError("");
                }}
              >
                <span>{item.type === "article" ? "Статья" : "Страница"}</span>
                <strong>{item.title}</strong>
                <small>{item.href}</small>
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Адрес ссылки</span>
          <input
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyValue();
              }
            }}
            placeholder="https://…, /раздел/, #фрагмент или mailto:…"
          />
        </label>

        <fieldset className="field">
          <legend>Открытие и отношение к ссылке</legend>
          <label>
            <input
              type="checkbox"
              checked={openInNewTab}
              onChange={(event) => setOpenInNewTab(event.target.checked)}
            />
            <span>Открывать в новой вкладке</span>
          </label>
          {editorLinkRelFlags.map((flag) => (
            <label key={flag}>
              <input
                type="checkbox"
                checked={relFlags.includes(flag)}
                onChange={(event) =>
                  setRelFlags((current) =>
                    updateRelFlags(current, flag, event.target.checked)
                  )
                }
              />
              <span>
                {flag === "nofollow"
                  ? "nofollow — не передавать поисковый вес"
                  : flag === "sponsored"
                    ? "sponsored — рекламная или партнёрская ссылка"
                    : "ugc — ссылка из пользовательского материала"}
              </span>
            </label>
          ))}
        </fieldset>

        <p>
          Разрешены HTTPS, безопасные внутренние адреса, якоря и mailto.
          JavaScript- и protocol-relative адреса блокируются. Для новой вкладки
          автоматически добавляются noopener и noreferrer.
        </p>
        <p>Оставьте адрес пустым, чтобы удалить ссылку с выделенного текста.</p>
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
