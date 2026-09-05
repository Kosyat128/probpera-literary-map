import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** Keeps an occasional display preference out of the main discovery controls. */
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
    <button ref={trigger} type="button" aria-expanded={open} aria-controls={id}
      onClick={() => setOpen((value) => !value)}>
      {label}
      <svg className="book-shelf-quality-menu__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="m4 6 4 4 4-4" />
      </svg>
    </button>
    <div id={id} className="book-shelf-quality-menu__panel" role="group" aria-label={label} hidden={!open}>
      {children}
    </div>
  </div>;
}
