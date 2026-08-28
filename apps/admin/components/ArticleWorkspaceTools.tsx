"use client";

import { useEffect, useMemo, useState } from "react";

import {
  useArticleEditorWorkspace,
  type ArticleWorkspaceSnapshot,
} from "@/components/ArticleEditorContext";
import {
  articleWorkspaceQuality,
  type ArticleWorkspaceSection,
} from "@/lib/article-workspace-utils";

import styles from "./ArticleWorkspaceTools.module.css";

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

const emptySnapshot: ArticleWorkspaceSnapshot = {
  locale: "ru",
  outline: [],
  missing: [],
  metrics: {
    words: 0,
    headings: 0,
    images: 0,
    readingMinutes: 0,
  },
  ready: 0,
  total: 0,
  saveState: "Редактор готов",
  canSave: false,
  canPreview: false,
  canPublish: false,
};

export default function ArticleWorkspaceTools() {
  const workspace = useArticleEditorWorkspace();
  const snapshot = workspace?.snapshot ?? emptySnapshot;
  const actions = workspace?.actions;
  const save = actions?.save;
  const [guidanceOpen, setGuidanceOpen] = useState(false);

  useEffect(() => {
    if (!save) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLocaleLowerCase("en") !== "s"
      ) {
        return;
      }
      event.preventDefault();
      save();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [save]);

  const quality = useMemo(
    () => articleWorkspaceQuality(snapshot.ready, snapshot.total),
    [snapshot.ready, snapshot.total]
  );

  return (
    <section className={styles.workspace} aria-label="Редакционный рабочий стол">
      <div className={styles.topline}>
        <div className={styles.identity}>
          <span className={styles.identityMark} aria-hidden="true">П</span>
          <div className={styles.identityText}>
            <strong>Редакционный workspace</strong>
            <small>Навигация, качество и быстрые действия</small>
          </div>
          <span className={styles.localeChip}>{snapshot.locale.toUpperCase()}</span>
        </div>

        <nav className={styles.nav} aria-label="Разделы редактора">
          {sections.map((section) => (
            <button
              type="button"
              key={section.id}
              disabled={!actions}
              onClick={() => actions?.goToSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className={styles.actions}>
          <button
            className={styles.action}
            type="button"
            onClick={actions?.save}
            disabled={!snapshot.canSave}
          >
            Сохранить
          </button>
          <button
            className={styles.action}
            type="button"
            onClick={actions?.preview}
            disabled={!snapshot.canPreview}
            title={snapshot.canPreview ? "Открыть предпросмотр" : "Сначала сохраните новую статью"}
          >
            Предпросмотр
          </button>
          <button
            className={styles.action}
            type="button"
            onClick={actions?.toggleFullscreen}
            disabled={!actions}
          >
            Фокус
          </button>
          <button
            className={`${styles.action} ${styles.actionPrimary}`}
            type="button"
            onClick={actions?.publish}
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
          <span className={styles.metrics}>
            {snapshot.metrics.words.toLocaleString(snapshot.locale === "en" ? "en-US" : "ru-RU")} слов
            {` · ${snapshot.metrics.readingMinutes || 0} мин · ${snapshot.metrics.headings} H2/H3 · ${snapshot.metrics.images} фото`}
          </span>
        </div>

        <div className={styles.actions}>
          <span className={styles.saveState}>{snapshot.saveState}</span>
          <span className={styles.shortcut}>Ctrl/Cmd + S</span>
          <details
            className={styles.guidance}
            open={guidanceOpen}
            onToggle={(event) => setGuidanceOpen(event.currentTarget.open)}
          >
            <summary className={snapshot.missing.length ? styles.guidanceAlert : undefined}>
              {snapshot.missing.length
                ? `Требует внимания · ${snapshot.missing.length}`
                : "Контроль пройден"}
            </summary>
            <div className={styles.guidancePanel}>
              {snapshot.missing.length ? (
                snapshot.missing.map((item, index) => (
                  <button
                    type="button"
                    key={`${item.locale}-${item.label}-${index}`}
                    onClick={() => {
                      setGuidanceOpen(false);
                      actions?.goToIssue(item);
                    }}
                  >
                    <span>{item.locale.toUpperCase()}</span>
                    <strong>{item.label}</strong>
                  </button>
                ))
              ) : (
                <p>Все обязательные пункты текущего чек-листа выполнены.</p>
              )}
            </div>
          </details>
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
                    onClick={() => actions?.goToHeading(item.id)}
                  >
                    {item.label}
                  </button>
                ))
              ) : (
                <button type="button" disabled>
                  Добавьте H2/H3 - здесь появится навигация
                </button>
              )}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}
