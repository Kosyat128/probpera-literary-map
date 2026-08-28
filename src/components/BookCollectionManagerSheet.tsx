import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createPortal } from "react-dom";

import {
  BOOK_ARCHIVE_SORTS,
  type BookArchiveSort,
} from "../books/bookArchiveFacets";
import {
  bookScenePresetIds,
  type BookScenePresetId,
} from "../books/bookArchiveSceneSettings";
import {
  normalizeBookCollectionManagerDraft,
  reorderBookCollectionManagerItems,
  reorderBookCollectionManagerItemsByDrop,
  type BookCollectionManagerBookItem,
  type BookCollectionManagerUpdate,
  type BookCollectionMoveCommand,
} from "../books/bookCollectionManager";
import {
  BOOK_COLLECTION_ICON_IDS,
  type BookCollection,
  type BookCollectionIconId,
} from "../books/bookCollections";
import "../styles/stage5-book-collection-manager.css";

export type ManagedBookCollection = BookCollection &
  Readonly<{
    kind: "manual" | "smart";
    visibility: "private";
  }>;

type AsyncCallbackResult = void | Promise<void>;

type Props = Readonly<{
  collection: ManagedBookCollection;
  orderedItems: readonly BookCollectionManagerBookItem[];
  onSave: (
    collectionId: string,
    update: BookCollectionManagerUpdate
  ) => AsyncCallbackResult;
  onReorder: (
    collectionId: string,
    orderedBookKeys: readonly string[]
  ) => AsyncCallbackResult;
  onRemoveBook: (collectionId: string, bookKey: string) => AsyncCallbackResult;
  onDelete: (collectionId: string) => AsyncCallbackResult;
  onClose: () => void;
  translate?: (value: string) => string;
  locale?: "ru" | "en";
}>;

const presetLabels: Readonly<Record<BookScenePresetId, string>> = Object.freeze({
  dynamic: "Динамическая тема",
  "violet-library": "Фиолетовая библиотека",
  "warm-paper": "Тёплая бумага",
  "museum-ivory": "Музейная слоновая кость",
  "midnight-archive": "Полуночный архив",
  "amber-reading-room": "Янтарный читальный зал",
  "orange-violet-twilight": "Оранжево-фиолетовые сумерки",
  "ink-room": "Чернильный кабинет",
  "deep-blue-study": "Синий кабинет",
  "muted-green-library": "Приглушённая зелёная библиотека",
  "burgundy-edition": "Бордовое издание",
  "charcoal-gallery": "Угольная галерея",
  "cream-publishing-room": "Кремовый издательский зал",
});

const sortLabels: Readonly<Record<BookArchiveSort, string>> = Object.freeze({
  "editorial-relevance": "Редакционная релевантность",
  title: "По названию",
  writer: "По автору",
  oldest: "Сначала старые",
  newest: "Сначала новые",
  "cover-first": "Сначала с обложкой",
  manual: "Ручной порядок",
  recent: "Недавно добавленные",
});

const iconLabels: Readonly<Record<BookCollectionIconId, string>> = Object.freeze({
  book: "Книга",
  star: "Звезда",
  quill: "Перо",
  archive: "Архив",
  heart: "Сердце",
});

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function BookCollectionManagerSheet({
  collection,
  orderedItems,
  onSave,
  onReorder,
  onRemoveBook,
  onDelete,
  onClose,
  translate = (value) => value,
  locale = "ru",
}: Props) {
  const t = translate;
  const dialogRef = useRef<HTMLElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const pendingActionRef = useRef("");
  const deleteArmedRef = useRef(false);
  const headingId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description || "");
  const [icon, setIcon] = useState<BookCollectionIconId>(
    collection.icon || "book"
  );
  const [backgroundPreset, setBackgroundPreset] = useState<BookScenePresetId>(
    collection.backgroundPreset || "dynamic"
  );
  const [dynamicBookThemes, setDynamicBookThemes] = useState(
    collection.dynamicBookThemes
  );
  const [themeIntensity, setThemeIntensity] = useState(collection.themeIntensity);
  const [sortMode, setSortMode] = useState<BookArchiveSort>(collection.sortMode);
  const [pendingAction, setPendingAction] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState("");
  const [draggedBookKey, setDraggedBookKey] = useState("");

  useEffect(() => {
    pendingActionRef.current = pendingAction;
    deleteArmedRef.current = deleteArmed;
  }, [deleteArmed, pendingAction]);

  useEffect(() => {
    setTitle(collection.title);
    setDescription(collection.description || "");
    setIcon(collection.icon || "book");
    setBackgroundPreset(collection.backgroundPreset || "dynamic");
    setDynamicBookThemes(collection.dynamicBookThemes);
    setThemeIntensity(collection.themeIntensity);
    setSortMode(collection.sortMode);
    setDeleteArmed(false);
    setError("");
  }, [collection]);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (deleteArmedRef.current) setDeleteArmed(false);
        else if (!pendingActionRef.current) onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ].filter(
        (element) =>
          !element.hidden && element.getAttribute("aria-hidden") !== "true"
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const draft = useMemo(
    () =>
      normalizeBookCollectionManagerDraft({
        title,
        description,
        icon,
        backgroundPreset,
        dynamicBookThemes,
        themeIntensity,
        sortMode,
      }),
    [
      backgroundPreset,
      description,
      icon,
      dynamicBookThemes,
      sortMode,
      themeIntensity,
      title,
    ]
  );

  const runAction = async (key: string, callback: () => AsyncCallbackResult) => {
    if (pendingAction) return;
    setError("");
    setPendingAction(key);
    try {
      await callback();
    } catch {
      setError(t("Не удалось сохранить изменение. Попробуйте ещё раз."));
    } finally {
      setPendingAction("");
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) {
      setError(t("Проверьте название и настройки полки."));
      return;
    }
    void runAction("save", () => onSave(collection.id, draft));
  };

  const moveBook = (
    bookKey: string,
    command: BookCollectionMoveCommand
  ) => {
    const reordered = reorderBookCollectionManagerItems(
      orderedItems,
      bookKey,
      command
    );
    if (reordered === orderedItems) return;
    void runAction(`move:${bookKey}`, () =>
      onReorder(
        collection.id,
        reordered.map((item) => item.bookKey)
      )
    );
  };

  const dropBook = (
    targetBookKey: string,
    placement: "before" | "after",
  ) => {
    if (!draggedBookKey || draggedBookKey === targetBookKey) return;
    const reordered = reorderBookCollectionManagerItemsByDrop(
      orderedItems,
      draggedBookKey,
      targetBookKey,
      placement,
    );
    setDraggedBookKey("");
    if (reordered === orderedItems) return;
    void runAction(`move:${draggedBookKey}`, () =>
      onReorder(
        collection.id,
        reordered.map((item) => item.bookKey),
      ),
    );
  };

  const dialog = (
    <div
      className="book-collection-manager__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pendingAction) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="book-collection-manager"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={descriptionId}
        aria-busy={Boolean(pendingAction)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="book-collection-manager__header">
          <div>
            <span>{t("Личная библиотека")}</span>
            <h2 id={headingId}>{t("Настроить полку")}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(pendingAction)}
            aria-label={t("Закрыть настройки полки")}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <p id={descriptionId} className="book-collection-manager__description">
          {t("Оформление и порядок этой полки видны только вам.")}
        </p>

        <form className="book-collection-manager__form" onSubmit={save}>
          <label>
            <span>{t("Название")}</span>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
              required
              autoComplete="off"
            />
          </label>

          <label>
            <span>{t("Описание")} <small>{t("(необязательно)")}</small></span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={800}
              rows={3}
            />
          </label>

          <div className="book-collection-manager__settings">
            <label>
              <span>{t("Знак полки")}</span>
              <select
                value={icon}
                onChange={(event) =>
                  setIcon(event.target.value as BookCollectionIconId)
                }
              >
                {BOOK_COLLECTION_ICON_IDS.map((iconId) => (
                  <option key={iconId} value={iconId}>
                    {t(iconLabels[iconId])}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("Фон полки")}</span>
              <select
                value={backgroundPreset}
                onChange={(event) =>
                  setBackgroundPreset(event.target.value as BookScenePresetId)
                }
              >
                {bookScenePresetIds.map((preset) => (
                  <option key={preset} value={preset}>
                    {t(presetLabels[preset])}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>{t("Сортировка")}</span>
              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as BookArchiveSort)
                }
              >
                {BOOK_ARCHIVE_SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {t(sortLabels[sort])}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="book-collection-manager__checkbox">
            <input
              type="checkbox"
              checked={dynamicBookThemes}
              onChange={(event) => setDynamicBookThemes(event.target.checked)}
            />
            <span>{t("Подстраивать оформление под выбранную книгу")}</span>
          </label>

          <label className="book-collection-manager__range">
            <span>
              {t("Интенсивность оформления")}
              <output>{themeIntensity}%</output>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={themeIntensity}
              onChange={(event) => setThemeIntensity(Number(event.target.value))}
            />
          </label>

          <button
            className="book-collection-manager__save"
            type="submit"
            disabled={!draft || Boolean(pendingAction)}
          >
            {pendingAction === "save"
              ? t("Сохранение…")
              : t("Сохранить настройки")}
          </button>
        </form>

        {collection.kind === "manual" ? (
          <section className="book-collection-manager__books" aria-labelledby={`${headingId}-books`}>
            <header>
              <h3 id={`${headingId}-books`}>{t("Книги на полке")}</h3>
              <span>{orderedItems.length.toLocaleString(locale)}</span>
            </header>
            {orderedItems.length ? (
              <ol>
                {orderedItems.map((item, index) => {
                  const actionPending = pendingAction.endsWith(item.bookKey);
                  return (
                    <li
                      key={item.bookKey}
                      data-book-key={item.bookKey}
                      className={
                        draggedBookKey === item.bookKey ? "is-dragging" : ""
                      }
                      draggable={!pendingAction}
                      onDragStart={(event) => {
                        setDraggedBookKey(item.bookKey);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item.bookKey);
                      }}
                      onDragEnd={() => setDraggedBookKey("")}
                      onDragOver={(event) => {
                        if (!draggedBookKey) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        dropBook(
                          item.bookKey,
                          event.clientY >= bounds.top + bounds.height / 2
                            ? "after"
                            : "before",
                        );
                      }}
                    >
                      <span className="book-collection-manager__position">
                        {index + 1}
                      </span>
                      <span className="book-collection-manager__book-copy">
                        <strong>{item.title}</strong>
                        <small>
                          {item.missing
                            ? t("Книга недоступна в текущем архиве")
                            : item.writer || t("Автор не указан")}
                        </small>
                      </span>
                      <span className="book-collection-manager__moves">
                        <button
                          type="button"
                          onClick={() => moveBook(item.bookKey, "first")}
                          disabled={index === 0 || Boolean(pendingAction)}
                          aria-label={`${t("Переместить")} «${item.title}» ${t("в начало")}`}
                          title={t("В начало")}
                        >
                          ⇤
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBook(item.bookKey, "up")}
                          disabled={index === 0 || Boolean(pendingAction)}
                          aria-label={`${t("Переместить")} «${item.title}» ${t("выше")}`}
                          title={t("Выше")}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBook(item.bookKey, "down")}
                          disabled={index === orderedItems.length - 1 || Boolean(pendingAction)}
                          aria-label={`${t("Переместить")} «${item.title}» ${t("ниже")}`}
                          title={t("Ниже")}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => moveBook(item.bookKey, "last")}
                          disabled={index === orderedItems.length - 1 || Boolean(pendingAction)}
                          aria-label={`${t("Переместить")} «${item.title}» ${t("в конец")}`}
                          title={t("В конец")}
                        >
                          ⇥
                        </button>
                        <button
                          type="button"
                          className="is-remove"
                          onClick={() =>
                            void runAction(`remove:${item.bookKey}`, () =>
                              onRemoveBook(collection.id, item.bookKey)
                            )
                          }
                          disabled={Boolean(pendingAction)}
                          aria-label={`${t("Убрать")} «${item.title}» ${t("с полки")}`}
                          title={t("Убрать с полки")}
                        >
                          {actionPending ? "…" : "×"}
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p>{t("На этой полке пока нет книг.")}</p>
            )}
          </section>
        ) : (
          <p className="book-collection-manager__smart-note">
            {t("Состав умной полки формируется автоматически по сохранённым фильтрам.")}
          </p>
        )}

        <p
          id={errorId}
          className="book-collection-manager__error"
          role={error ? "alert" : undefined}
          hidden={!error}
        >
          {error}
        </p>

        <footer className="book-collection-manager__danger">
          {!deleteArmed ? (
            <button
              type="button"
              onClick={() => setDeleteArmed(true)}
              disabled={Boolean(pendingAction)}
            >
              {t("Удалить полку")}
            </button>
          ) : (
            <div role="alert" aria-live="assertive">
              <p>
                {t("Удалить полку")} «{collection.title}»? {t("Книги останутся в архиве.")}
              </p>
              <span>
                <button type="button" onClick={() => setDeleteArmed(false)}>
                  {t("Отмена")}
                </button>
                <button
                  type="button"
                  className="is-danger"
                  disabled={Boolean(pendingAction)}
                  onClick={() =>
                    void runAction("delete", () => onDelete(collection.id))
                  }
                >
                  {pendingAction === "delete"
                    ? t("Удаление…")
                    : t("Удалить окончательно")}
                </button>
              </span>
            </div>
          )}
        </footer>
      </section>
    </div>
  );

  return typeof document === "undefined"
    ? dialog
    : createPortal(dialog, document.body);
}
