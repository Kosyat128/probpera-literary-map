"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { withAdminBasePath } from "@/lib/navigation";
import type { AdminNavigationEntry } from "@/lib/admin-module-registry";

function normalizeQuery(value: string) {
  return value.trim().toLocaleLowerCase("ru-RU");
}

export default function AdminCommandPalette({
  entries,
}: {
  entries: readonly AdminNavigationEntry[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return entries.slice(0, 10);
    return entries
      .filter(([, label, href]) =>
        normalizeQuery(`${label} ${href.replaceAll("/", " ")}`).includes(
          normalizedQuery
        )
      )
      .slice(0, 10);
  }, [entries, query]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleGlobalShortcut);
    return () => window.removeEventListener("keydown", handleGlobalShortcut);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    router.push(withAdminBasePath(href));
  }

  return (
    <>
      <button
        type="button"
        className="command-palette-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">⌕</span>
        <span>Быстрый переход</span>
        <kbd>Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="command-palette-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby="command-palette-title"
          >
            <header>
              <div>
                <span className="eyebrow">Навигация по редакции</span>
                <h2 id="command-palette-title">Куда перейти?</h2>
              </div>
              <button
                type="button"
                className="command-palette-close"
                onClick={() => setOpen(false)}
                aria-label="Закрыть быстрый переход"
              >
                ×
              </button>
            </header>
            <label className="command-palette-search">
              <span className="sr-only">Найти раздел админки</span>
              <span aria-hidden="true">⌕</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveIndex((current) =>
                      filteredEntries.length
                        ? (current + 1) % filteredEntries.length
                        : 0
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveIndex((current) =>
                      filteredEntries.length
                        ? (current - 1 + filteredEntries.length) %
                          filteredEntries.length
                        : 0
                    );
                  } else if (event.key === "Enter") {
                    const selected = filteredEntries[activeIndex];
                    if (selected) navigate(selected[2]);
                  }
                }}
                placeholder="Раздел, действие или адрес…"
                autoComplete="off"
              />
            </label>
            <div className="command-palette-results" role="listbox">
              {filteredEntries.map(([icon, label, href], index) => (
                <button
                  type="button"
                  key={href}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => navigate(href)}
                >
                  <span className="command-palette-icon" aria-hidden="true">
                    {icon}
                  </span>
                  <span>
                    <strong>{label}</strong>
                    <small>{href}</small>
                  </span>
                  <span aria-hidden="true">↵</span>
                </button>
              ))}
              {filteredEntries.length === 0 && (
                <p className="command-palette-empty">
                  Раздел не найден. Попробуйте другое слово.
                </p>
              )}
            </div>
            <footer>
              <span>↑↓ выбрать</span>
              <span>Enter открыть</span>
              <span>Esc закрыть</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
