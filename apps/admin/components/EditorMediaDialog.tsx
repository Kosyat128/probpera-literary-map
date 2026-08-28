"use client";

import { useEffect, useId, useState } from "react";

import { withClientAdminPath } from "@/lib/admin-path";

export type EditorMediaAsset = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  creator: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  collectionName: string;
  width: number;
  height: number;
};

export type EditorMediaQueueItem = {
  id: string;
  name: string;
  status: "prepare" | "upload" | "attach" | "done" | "error" | "cancelled";
  progress: number;
  error?: string;
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
  onClose,
  onPickFiles,
  onSelectAsset,
  onCancelItem,
  onRetryItem,
}: {
  open: boolean;
  queue: EditorMediaQueueItem[];
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

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPending(true);
      setError("");
      const query = search.trim()
        ? `?q=${encodeURIComponent(search.trim())}`
        : "";
      void fetch(withClientAdminPath(`/api/media/assets${query}`), {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body = (await response.json().catch(() => ({}))) as {
            assets?: EditorMediaAsset[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(body.error || "Не удалось открыть медиатеку.");
          }
          setAssets(Array.isArray(body.assets) ? body.assets : []);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          setAssets([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось открыть медиатеку."
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, search]);

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
        className="editor-media-modal editor-image-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="editor-media-modal-heading">
          <div>
            <span>Изображение в тексте</span>
            <h2 id={titleId}>Загрузить или выбрать из медиатеки</h2>
          </div>
          <button type="button" aria-label="Закрыть окно" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="editor-media-modal-actions">
          <button className="button" type="button" onClick={onPickFiles}>
            Выбрать файлы с компьютера
          </button>
        </div>

        {queue.length > 0 && (
          <section aria-label="Очередь изображений" aria-live="polite">
            <h3>Очередь</h3>
            <div className="status-list">
              {queue.map((item) => (
                <div key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.error || statusLabels[item.status]}</small>
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
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Описание изображения"
          />
        </label>
        <div role="status" aria-live="polite">
          {pending
            ? "Загружаем медиатеку…"
            : error || (!assets.length ? "Изображения не найдены." : "")}
        </div>
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
                    Вставить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="editor-media-modal-actions">
          <button className="button-secondary" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </section>
    </div>
  );
}
