"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(dialog: HTMLElement) {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(focusableSelector)
  ).filter(
    (element) =>
      !element.hidden &&
      element.getAttribute("aria-hidden") !== "true" &&
      !element.closest("[inert]")
  );
}

export function trapEditorDialogFocus(
  event: ReactKeyboardEvent<HTMLElement>,
  dialog: HTMLElement
) {
  if (event.key !== "Tab") return;

  const focusableElements = getFocusableElements(dialog);
  if (!focusableElements.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1) ?? firstElement;
  const activeElement = document.activeElement;
  const focusIsOutside = !activeElement || !dialog.contains(activeElement);

  if (event.shiftKey && (focusIsOutside || activeElement === firstElement)) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (!event.shiftKey && (focusIsOutside || activeElement === lastElement)) {
    event.preventDefault();
    firstElement.focus();
  }
}

export function useEditorDialogFocus({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    const initialFocus =
      dialog?.querySelector<HTMLElement>(
        "[data-editor-dialog-initial-focus]"
      ) ?? (dialog ? getFocusableElements(dialog)[0] : null);
    (initialFocus ?? dialog)?.focus({ preventScroll: true });

    return () => {
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocus?.isConnected) {
        returnFocus.focus({ preventScroll: true });
      }
    };
  }, [open]);

  const onDialogKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      trapEditorDialogFocus(event, dialog);
    },
    []
  );

  return { dialogRef, onDialogKeyDown };
}
