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
  createBookCollectionMembershipDialogModel,
  normalizeNewBookCollectionTitle,
  type BookCollectionMembershipShelf,
} from "../books/bookCollectionMembershipDialog";
import "../styles/stage5-book-collection-dialog.css";

export type BookCollectionMembershipDialogCopy = Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  shelfLegend: string;
  emptyShelves: string;
  readOnlyHint: string;
  newShelfLabel: string;
  newShelfPlaceholder: string;
  createAction: string;
  closeLabel: string;
  invalidTitle: string;
  actionError: string;
}>;

const defaultCopy: BookCollectionMembershipDialogCopy = Object.freeze({
  eyebrow: "Личная библиотека",
  title: "Добавить на полку",
  description: "Отметьте полки, на которых должна находиться книга.",
  shelfLegend: "Доступные полки",
  emptyShelves: "Создайте первую личную полку для этой книги.",
  readOnlyHint: "Умные и редакционные полки обновляются автоматически.",
  newShelfLabel: "Новая личная полка",
  newShelfPlaceholder: "Например, Русская классика",
  createAction: "Создать и добавить",
  closeLabel: "Закрыть",
  invalidTitle: "Введите корректное название длиной до 120 символов.",
  actionError: "Не удалось сохранить изменение. Попробуйте ещё раз.",
});

type Props = Readonly<{
  bookKey: string;
  bookLabel: string;
  shelves: readonly BookCollectionMembershipShelf[];
  onToggle: (shelfId: string, checked: boolean) => void | Promise<void>;
  onCreateShelf: (title: string) => void | Promise<void>;
  onClose: () => void;
  copy?: Partial<BookCollectionMembershipDialogCopy>;
  createDisabled?: boolean;
}>;

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export default function BookCollectionMembershipDialog({
  bookKey,
  bookLabel,
  shelves,
  onToggle,
  onCreateShelf,
  onClose,
  copy: copyOverride,
  createDisabled = false,
}: Props) {
  const copy = useMemo(
    () => ({ ...defaultCopy, ...copyOverride }),
    [copyOverride],
  );
  const model = useMemo(
    () => createBookCollectionMembershipDialogModel(shelves),
    [shelves],
  );
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const errorId = useId();
  const [newShelfTitle, setNewShelfTitle] = useState("");
  const [pendingShelfIds, setPendingShelfIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [createPending, setCreatePending] = useState(false);
  const [error, setError] = useState("");

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
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const controls = [
        ...dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ].filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
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
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const toggleShelf = async (shelf: BookCollectionMembershipShelf) => {
    if (shelf.disabled || pendingShelfIds.has(shelf.id)) return;
    setError("");
    setPendingShelfIds((current) => new Set(current).add(shelf.id));
    try {
      await onToggle(shelf.id, !shelf.checked);
    } catch {
      setError(copy.actionError);
    } finally {
      setPendingShelfIds((current) => {
        const next = new Set(current);
        next.delete(shelf.id);
        return next;
      });
    }
  };

  const createShelf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = normalizeNewBookCollectionTitle(newShelfTitle);
    if (!title) {
      setError(copy.invalidTitle);
      return;
    }
    setError("");
    setCreatePending(true);
    try {
      await onCreateShelf(title);
      setNewShelfTitle("");
    } catch {
      setError(copy.actionError);
    } finally {
      setCreatePending(false);
    }
  };

  const dialog = (
    <div
      className="book-collection-dialog__backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="book-collection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={createPending || pendingShelfIds.size > 0}
        data-book-key={bookKey}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="book-collection-dialog__header">
          <div>
            <span>{copy.eyebrow}</span>
            <h2 id={titleId}>{copy.title}</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="book-collection-dialog__close"
            onClick={onClose}
            aria-label={copy.closeLabel}
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <p id={descriptionId} className="book-collection-dialog__description">
          <strong>«{bookLabel}»</strong>
          <span>{copy.description}</span>
        </p>

        <fieldset className="book-collection-dialog__shelves">
          <legend>{copy.shelfLegend}</legend>
          {model.writableShelves.length ? (
            <div className="book-collection-dialog__shelf-list">
              {model.writableShelves.map((shelf) => {
                const pending = pendingShelfIds.has(shelf.id);
                return (
                  <label
                    key={shelf.id}
                    className={`book-collection-dialog__shelf${
                      shelf.checked ? " is-checked" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={shelf.checked}
                      disabled={shelf.disabled || pending}
                      onChange={() => void toggleShelf(shelf)}
                    />
                    <span className="book-collection-dialog__check" aria-hidden="true" />
                    <span className="book-collection-dialog__shelf-copy">
                      <strong>{shelf.title}</strong>
                      {shelf.description && <small>{shelf.description}</small>}
                    </span>
                    {typeof shelf.count === "number" && (
                      <span className="book-collection-dialog__count">
                        {shelf.count.toLocaleString("ru-RU")}
                      </span>
                    )}
                    {pending && (
                      <span className="book-collection-dialog__pending" aria-hidden="true" />
                    )}
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="book-collection-dialog__empty">{copy.emptyShelves}</p>
          )}
        </fieldset>

        {model.readOnlyShelfCount > 0 && (
          <p className="book-collection-dialog__readonly">{copy.readOnlyHint}</p>
        )}

        <form className="book-collection-dialog__create" onSubmit={createShelf}>
          <label htmlFor={`${titleId}-new-shelf`}>{copy.newShelfLabel}</label>
          <div>
            <input
              id={`${titleId}-new-shelf`}
              type="text"
              value={newShelfTitle}
              onChange={(event) => {
                setNewShelfTitle(event.target.value);
                if (error) setError("");
              }}
              placeholder={copy.newShelfPlaceholder}
              maxLength={120}
              autoComplete="off"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              disabled={createDisabled || createPending}
            />
            <button
              type="submit"
              disabled={
                createDisabled ||
                createPending ||
                normalizeNewBookCollectionTitle(newShelfTitle) === null
              }
            >
              <span aria-hidden="true">＋</span>
              {copy.createAction}
            </button>
          </div>
        </form>

        <p
          id={errorId}
          className="book-collection-dialog__error"
          role={error ? "alert" : undefined}
          hidden={!error}
        >
          {error}
        </p>
      </section>
    </div>
  );

  return typeof document === "undefined"
    ? dialog
    : createPortal(dialog, document.body);
}
