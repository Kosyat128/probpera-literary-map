"use client";

import { useEffect, useId, useRef, useState } from "react";

import { withClientAdminPath } from "@/lib/admin-path";
import { useEditorDialogFocus } from "@/components/useEditorDialogFocus";
import { parseEditorMediaAssetsPage, type EditorMediaAsset } from "@/lib/editor-media-assets-contract";
export type { EditorMediaAsset } from "@/lib/editor-media-assets-contract";

export type EditorMediaQueueItem = {
  id: string;
  name: string;
  status: "prepare" | "upload" | "attach" | "done" | "error" | "cancelled";
  progress: number;
  error?: string;
  preparation?: string;
};

const statusLabels: Record<EditorMediaQueueItem["status"], string> = {
  prepare: "Подготовка",
  upload: "Загрузка",
  attach: "Вставка в материал",
  done: "Готово",
  error: "Ошибка",
  cancelled: "Отменено",
};

export default function EditorMediaDialog({
  open,
  queue,
  collectionMode = false,
  onClose,
  onPickFiles,
  onSelectAsset,
  onCancelItem,
  onRetryItem,
}: {
  open: boolean;
  queue: EditorMediaQueueItem[];
  collectionMode?: boolean;
  onClose: () => void;
  onPickFiles: () => void;
  onSelectAsset: (asset: EditorMediaAsset) => void;
  onCancelItem: (id: string) => void;
  onRetryItem: (id: string) => void;
}) {
  const titleId = useId();
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<EditorMediaAsset[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [previousCursors, setPreviousCursors] = useState<(string | null)[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const requestGeneration = useRef(0);
  const completedUploads = queue.filter((item) => item.status === "done").map((item) => item.id).join("\0");
  const seenCompletedUploads = useRef(new Set(completedUploads.split("\0").filter(Boolean)));
  const { dialogRef, onDialogKeyDown } = useEditorDialogFocus({
    open,
    onClose,
  });

  useEffect(() => {
    let newCompletion = false;
    for (const id of completedUploads.split("\0").filter(Boolean)) {
      if (!seenCompletedUploads.current.has(id)) newCompletion = true;
      seenCompletedUploads.current.add(id);
    }
    if (!newCompletion) return;
    setCursor(null);
    setPreviousCursors([]);
    setRefresh((value) => value + 1);
  }, [completedUploads]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    setAssets([]);
    setNextCursor(null);
    if (!open) {
      setPending(false);
      setCursor(null);
      setPreviousCursors([]);
      return;
    }
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && generation === requestGeneration.current;
    setPending(true);
    setError("");
    const timer = window.setTimeout(() => {
      const parameters = new URLSearchParams();
      if (search.trim()) parameters.set("q", search.trim());
      if (cursor) parameters.set("cursor", cursor);
      const query = parameters.toString();
      void fetch(withClientAdminPath(`/api/media/assets${query ? `?${query}` : ""}`), {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body: unknown = await response.json().catch(() => null);
          const page = response.ok ? parseEditorMediaAssetsPage(body) : null;
          if (!page) throw new Error("Не удалось открыть медиатеку. Повторите запрос.");
          if (!isCurrent()) return;
          setAssets(page.assets);
          setNextCursor(page.nextCursor);
        })
        .catch((reason: unknown) => {
          if (!isCurrent()) return;
          setAssets([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось открыть медиатеку."
          );
        })
        .finally(() => {
          if (isCurrent()) setPending(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, search, cursor, refresh]);

  if (!open) return null;

  return (
    <div
      className="editor-media-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="editor-media-modal editor-image-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
      >
        <div className="editor-media-modal-heading">
          <div>
            <span>
              {collectionMode ? "Подборка изображений" : "Изображение в тексте"}
            </span>
            <h2 id={titleId}>
              {collectionMode
                ? "Добавить изображения в галерею"
                : "Загрузить или выбрать из медиатеки"}
            </h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="editor-media-modal-actions">
          <button className="button" type="button" onClick={onPickFiles}>
            {collectionMode
              ? "Загрузить несколько изображений"
              : "Выбрать файлы с компьютера"}
          </button>
        </div>

        {collectionMode && (
          <p className="editor-media-modal-note">
            Можно добавить несколько файлов сразу или выбрать несколько карточек
            по очереди. Окно останется открытым, пока подборка не будет готова.
          </p>
        )}

        {queue.length > 0 && (
          <section aria-label="Очередь изображений" aria-live="polite">
            <h3>Очередь</h3>
            <div className="status-list">
              {queue.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.error || statusLabels[item.status]}</small>
                    {item.preparation && <small>{item.preparation}</small>}
                  </span>
                  <span>
                    <progress max={100} value={item.progress}>
                      {item.progress}%
                    </progress>
                    {(item.status === "prepare" ||
                      item.status === "upload" ||
                      item.status === "attach") && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onCancelItem(item.id)}
                      >
                        Отменить
                      </button>
                    )}
                    {(item.status === "error" || item.status === "cancelled") && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onRetryItem(item.id)}
                      >
                        Повторить
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <label className="field">
          <span>Найти в медиатеке</span>
          <input
            data-editor-dialog-initial-focus
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setCursor(null);
              setPreviousCursors([]);
            }}
            placeholder="Имя файла, описание, подпись или коллекция"
          />
        </label>
        <div role="status" aria-live="polite">
          {pending
            ? "Загружаем медиатеку…"
            : error || (!assets.length ? "Изображения не найдены." : "")}
        </div>
        {error && <button type="button" onClick={() => setRefresh((value) => value + 1)}>Повторить запрос</button>}
        {assets.length > 0 && (
          <div className="media-grid" role="list" aria-label="Изображения медиатеки">
            {assets.map((asset) => (
              <article className="media-card" role="listitem" key={asset.id}>
                <img src={asset.src} alt={asset.alt} />
                <div>
                  <strong>{asset.alt || "Без описания"}</strong>
                  <small>{asset.caption || asset.collectionName || "Без подписи"}</small>
                  <small>Автор: {asset.creator || "не указан"}</small>
                  <small>Источник: {asset.sourceUrl || "не указан"}</small>
                  <small>Лицензия: {asset.licenseName || "не указана"}</small>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => onSelectAsset(asset)}
                  >
                    {collectionMode ? "Добавить" : "Вставить"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {(previousCursors.length > 0 || nextCursor !== null) && (
          <nav className="editor-media-modal-actions" aria-label="Страницы медиатеки">
            <button type="button" disabled={pending || previousCursors.length === 0} onClick={() => {
              setCursor(previousCursors.at(-1) ?? null);
              setPreviousCursors((values) => values.slice(0, -1));
            }}>Предыдущие изображения</button>
            <span>Страница {previousCursors.length + 1}</span>
            <button type="button" disabled={pending || nextCursor === null} onClick={() => {
              if (nextCursor === null) return;
              setPreviousCursors((values) => [...values, cursor]);
              setCursor(nextCursor);
            }}>Следующие изображения</button>
          </nav>
        )}

        <div className="editor-media-modal-actions">
          <button className="button-secondary" type="button" onClick={onClose}>
            {collectionMode ? "Вернуться к галерее" : "Закрыть"}
          </button>
        </div>
      </section>
    </div>
  );
}
