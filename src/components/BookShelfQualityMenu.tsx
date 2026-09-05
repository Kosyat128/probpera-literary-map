import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Collection actions and display preferences share one keyboard-accessible disclosure. */
export default function BookShelfQualityMenu({ label, children }: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return <div
    ref={root}
    className="book-shelf-quality-menu"
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}
    onKeyDown={(event) => {
      if (event.key !== "Escape" || !open) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    }}
  >
    <button ref={trigger} type="button" aria-label={label} title={label} aria-expanded={open} aria-controls={id}
      onClick={() => setOpen((value) => !value)}>
      <svg className="book-shelf-quality-menu__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" />
      </svg>
    </button>
    <div id={id} className="book-shelf-quality-menu__panel" role="group" aria-label={label} hidden={!open}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button")) {
          trigger.current?.focus({ preventScroll: true });
          setOpen(false);
        }
      }}>
      {children}
    </div>
  </div>;
}
