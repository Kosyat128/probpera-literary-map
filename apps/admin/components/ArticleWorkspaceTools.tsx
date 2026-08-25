"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  articleWorkspaceAnchor,
  articleWorkspacePanelSection,
  articleWorkspaceQuality,
  type ArticleWorkspaceSection,
} from "@/lib/article-workspace-utils";

import styles from "./ArticleWorkspaceTools.module.css";

type OutlineItem = {
  id: string;
  label: string;
  level: 2 | 3;
};

type WorkspaceSnapshot = {
  locale: "RU" | "EN";
  outline: OutlineItem[];
  ready: number;
  total: number;
  saveState: string;
  canPreview: boolean;
  canPublish: boolean;
};

const sections: { id: ArticleWorkspaceSection; label: string }[] = [
  { id: "basics", label: "Основное" },
  { id: "text", label: "Текст" },
  { id: "media", label: "Медиа" },
  { id: "publish", label: "Публикация" },
  { id: "cover", label: "Обложка" },
  { id: "seo", label: "SEO" },
  { id: "sources", label: "Источники" },
  { id: "quality", label: "Контроль" },
];

function findPanel(
  form: HTMLFormElement,
  section: ArticleWorkspaceSection
): HTMLElement | null {
  if (section === "text") {
    return form.querySelector<HTMLElement>(".editor-content-drop-target");
  }
  if (section === "media") {
    return (
      form.querySelector<HTMLElement>(".editor-direct-upload") ||
      form.querySelector<HTMLElement>(".editor-toolbar")
    );
  }
  if (section === "quality") {
    return form.querySelector<HTMLElement>(".publication-checklist");
  }
  if (section === "basics") {
    return (
      form.querySelector<HTMLElement>(".editor-main .panel") ||
      Array.from(form.querySelectorAll<HTMLElement>(".editor-side .panel")).find(
        (panel) =>
          articleWorkspacePanelSection(
            panel.querySelector("h2")?.textContent || ""
          ) === "basics"
      ) ||
      null
    );
  }

  return (
    Array.from(form.querySelectorAll<HTMLElement>(".editor-side .panel")).find(
      (panel) =>
        articleWorkspacePanelSection(
          panel.querySelector("h2")?.textContent || ""
        ) === section
    ) || null
  );
}

function findActionButton(
  form: HTMLFormElement,
  intent: "save" | "publish"
) {
  const buttons = Array.from(
    form.querySelectorAll<HTMLButtonElement>(
      `.editor-actions button[type="submit"][name="intent"][value="${intent}"]`
    )
  );
  if (intent === "save") return buttons[0] || null;
  return (
    buttons.find(
      (button) => button.textContent?.trim().toLocaleLowerCase("ru") === "опубликовать"
    ) || null
  );
}

export default function ArticleWorkspaceTools() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>({
    locale: "RU",
    outline: [],
    ready: 0,
    total: 0,
    saveState: "Редактор готов",
    canPreview: false,
    canPublish: false,
  });

  const scan = useCallback(() => {
    const form =
      formRef.current || document.querySelector<HTMLFormElement>(".article-form");
    if (!form) return;
    formRef.current = form;
    form.classList.add("article-workspace-enabled");
    form.closest<HTMLElement>(".admin-content")?.classList.add("article-workspace-page");

    const activeLocaleButton = form.querySelector<HTMLButtonElement>(
      ".article-language-tabs button.is-active"
    );
    const locale = activeLocaleButton?.textContent?.includes("EN") ? "EN" : "RU";

    const outline = Array.from(
      form.querySelectorAll<HTMLElement>(
        ".editor-content-drop-target .ProseMirror h2, .editor-content-drop-target .ProseMirror h3"
      )
    )
      .map((heading, index) => {
        const label = heading.textContent?.replace(/\s+/gu, " ").trim() || "";
        if (!label) return null;
        const id = articleWorkspaceAnchor(label, index);
        heading.id = id;
        return {
          id,
          label,
          level: heading.tagName === "H3" ? (3 as const) : (2 as const),
        };
      })
      .filter((item): item is OutlineItem => Boolean(item));

    const checks = Array.from(
      form.querySelectorAll<HTMLElement>(".publication-checklist li")
    );
    const ready = checks.filter((item) => item.classList.contains("is-ready")).length;
    const saveState =
      form.querySelector<HTMLElement>(".editor-save-state small")?.textContent
        ?.replace(/\s+/gu, " ")
        .trim() || "Редактор готов";
    const previewLink = form.querySelector<HTMLAnchorElement>(
      '.editor-actions a[href*="/preview?"]'
    );
    const publishButton = findActionButton(form, "publish");

    setSnapshot({
      locale,
      outline,
      ready,
      total: checks.length,
      saveState,
      canPreview: Boolean(previewLink),
      canPublish: Boolean(publishButton && !publishButton.disabled),
    });
  }, []);

  const scheduleScan = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      scan();
    });
  }, [scan]);

  useEffect(() => {
    scan();
    const form = formRef.current;
    if (!form) return;

    const observer = new MutationObserver(scheduleScan);
    observer.observe(form, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "aria-pressed"],
    });

    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLocaleLowerCase("en") !== "s") {
        return;
      }
      event.preventDefault();
      findActionButton(form, "save")?.click();
    };
    window.addEventListener("keydown", handleShortcut);

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", handleShortcut);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      form.classList.remove("article-workspace-enabled");
      form.closest<HTMLElement>(".admin-content")?.classList.remove("article-workspace-page");
    };
  }, [scan, scheduleScan]);

  const quality = useMemo(
    () => articleWorkspaceQuality(snapshot.ready, snapshot.total),
    [snapshot.ready, snapshot.total]
  );

  const scrollToSection = (section: ArticleWorkspaceSection) => {
    const form = formRef.current;
    if (!form) return;
    const target = findPanel(form, section);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const triggerSave = () => {
    const form = formRef.current;
    if (!form) return;
    findActionButton(form, "save")?.click();
  };

  const triggerPreview = () => {
    const form = formRef.current;
    const link = form?.querySelector<HTMLAnchorElement>(
      '.editor-actions a[href*="/preview?"]'
    );
    if (!link) return;
    window.open(link.href, "_blank", "noopener,noreferrer");
  };

  const triggerPublish = () => {
    const form = formRef.current;
    if (!form) return;
    findActionButton(form, "publish")?.click();
  };

  const toggleFullscreen = () => {
    const form = formRef.current;
    if (!form) return;
    const button = Array.from(
      form.querySelectorAll<HTMLButtonElement>(".editor-tool-menu button")
    ).find((item) => /на весь экран|свернуть редактор/iu.test(item.textContent || ""));
    button?.click();
    scheduleScan();
  };

  const scrollToHeading = (id: string) => {
    const heading = document.getElementById(id);
    heading?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <section className={styles.workspace} aria-label="Редакционный рабочий стол">
      <div className={styles.topline}>
        <div className={styles.identity}>
          <span className={styles.identityMark} aria-hidden="true">П</span>
          <div className={styles.identityText}>
            <strong>Редакционный workspace</strong>
            <small>Навигация, качество и быстрые действия</small>
          </div>
          <span className={styles.localeChip}>{snapshot.locale}</span>
        </div>

        <nav className={styles.nav} aria-label="Разделы редактора">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className={styles.actions}>
          <button className={styles.action} type="button" onClick={triggerSave}>
            Сохранить
          </button>
          <button
            className={styles.action}
            type="button"
            onClick={triggerPreview}
            disabled={!snapshot.canPreview}
            title={snapshot.canPreview ? "Открыть предпросмотр" : "Сначала сохраните новую статью"}
          >
            Предпросмотр
          </button>
          <button className={styles.action} type="button" onClick={toggleFullscreen}>
            Фокус
          </button>
          <button
            className={`${styles.action} ${styles.actionPrimary}`}
            type="button"
            onClick={triggerPublish}
            disabled={!snapshot.canPublish}
            title={snapshot.canPublish ? "Опубликовать материал" : "Сначала завершите контроль готовности"}
          >
            Опубликовать
          </button>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.quality}>
          <strong>
            {snapshot.total ? `${quality.ready}/${quality.total}` : "Черновик"}
          </strong>
          <span className={styles.progress} aria-label={`Готовность ${quality.percent}%`}>
            <span style={{ width: `${quality.percent}%` }} />
          </span>
          <span>{snapshot.total ? `${quality.percent}% готово` : "контроль появится после заполнения"}</span>
        </div>

        <div className={styles.actions}>
          <span className={styles.saveState}>{snapshot.saveState}</span>
          <span className={styles.shortcut}>Ctrl/Cmd + S</span>
          <details className={styles.outline}>
            <summary>
              Оглавление · {snapshot.outline.length}
            </summary>
            <div className={styles.outlinePanel}>
              {snapshot.outline.length ? (
                snapshot.outline.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    data-level={item.level}
                    onClick={() => scrollToHeading(item.id)}
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <button type="button" disabled>
                  Добавьте H2/H3 — здесь появится навигация
                </button>
              )}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
