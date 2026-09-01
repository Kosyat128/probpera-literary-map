import { createSlug } from "../../lib/slug";

import type {
  ArticleEditorLocale,
  ArticlePanelSectionRef,
  ArticleValueChange,
  MarkArticleDirty,
  MarkRussianSourceChanged,
} from "./ArticleEditorTypes";

export type SeoPanelProps = {
  locale: ArticleEditorLocale;
  sectionRef?: ArticlePanelSectionRef;
  title: string;
  slug: string;
  slugEdited: boolean;
  generatedCanonical: string;
  legacyPath: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  allowIndexing: boolean;
  onSlugChange: ArticleValueChange<string>;
  onSlugEditedChange: ArticleValueChange<boolean>;
  onCanonicalEditedChange: ArticleValueChange<boolean>;
  onLegacyPathChange: ArticleValueChange<string>;
  onSeoTitleChange: ArticleValueChange<string>;
  onSeoDescriptionChange: ArticleValueChange<string>;
  onSeoKeywordsChange: ArticleValueChange<string>;
  onOgTitleChange: ArticleValueChange<string>;
  onOgDescriptionChange: ArticleValueChange<string>;
  onAllowIndexingChange: ArticleValueChange<boolean>;
  markRussianSourceChanged: MarkRussianSourceChanged;
  markDirty: MarkArticleDirty;
};

export default function SeoPanel({
  locale,
  sectionRef,
  title,
  slug,
  slugEdited,
  generatedCanonical,
  legacyPath,
  seoTitle,
  seoDescription,
  seoKeywords,
  canonicalUrl,
  ogTitle,
  ogDescription,
  allowIndexing,
  onSlugChange,
  onSlugEditedChange,
  onCanonicalEditedChange,
  onLegacyPathChange,
  onSeoTitleChange,
  onSeoDescriptionChange,
  onSeoKeywordsChange,
  onOgTitleChange,
  onOgDescriptionChange,
  onAllowIndexingChange,
  markRussianSourceChanged,
  markDirty,
}: SeoPanelProps) {
  const markRussian = () => {
    if (locale === "ru") markRussianSourceChanged();
  };
  const markChanged = () => {
    markRussian();
    markDirty();
  };
  const completedAdvancedFields = [
    legacyPath,
    seoTitle,
    seoDescription,
    seoKeywords,
    ogTitle,
    ogDescription,
  ].filter((value) => value.trim().length > 0).length;

  return (
    <section ref={sectionRef} className="panel settings-stack">
      <h2>
        {locale === "en" ? "Адрес и SEO английской версии" : "Адрес и SEO"}
      </h2>
      <label className="field">
        <span>
          {locale === "en" ? "Адрес английской статьи" : "Адрес статьи"}
        </span>
        <input
          value={slug}
          onChange={(event) => {
            onSlugEditedChange(true);
            onSlugChange(createSlug(event.target.value));
            markChanged();
          }}
          required={locale === "ru"}
        />
        <span className="slug-control-row">
          <small>
            {locale === "en"
              ? !slugEdited
                ? "Адрес автоматически меняется вместе с английским заголовком."
                : "Адрес английской версии закреплён вручную."
              : !slugEdited
                ? "Адрес автоматически меняется вместе с заголовком."
                : "Адрес закреплён вручную и больше не изменится от заголовка."}
          </small>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              onSlugEditedChange(false);
              onSlugChange(createSlug(title));
              onCanonicalEditedChange(false);
              markRussian();
              markDirty();
            }}
          >
            Создавать из заголовка
          </button>
        </span>
        <small>{generatedCanonical}</small>
      </label>
      <details className="editor-panel-disclosure">
        <summary>
          <span>Дополнительные настройки SEO</span>
          <small>
            {completedAdvancedFields > 0
              ? `Заполнено полей: ${completedAdvancedFields}`
              : "Необязательно для сохранения черновика"}
          </small>
        </summary>
        <div className="editor-panel-disclosure-content settings-stack">
          <label className="field">
            <span>Старый адрес - только для совместимости</span>
            <input
              name="legacy_path"
              value={legacyPath}
              onChange={(event) => {
                onLegacyPathChange(event.target.value);
                markChanged();
              }}
              placeholder="/read/page-article/…"
            />
            <small>
              Не показывается читателям и не используется в новых ссылках.
              Нужен только для бесшовного 301‑перехода со старых публикаций.
            </small>
          </label>
          <label className="field">
            <span>SEO-заголовок</span>
            <input
              value={seoTitle}
              onChange={(event) => {
                onSeoTitleChange(event.target.value);
                markChanged();
              }}
              maxLength={180}
            />
          </label>
          <label className="field">
            <span>Описание для поиска</span>
            <textarea
              value={seoDescription}
              onChange={(event) => {
                onSeoDescriptionChange(event.target.value);
                markChanged();
              }}
              maxLength={400}
            />
          </label>
          <label className="field">
            <span>Ключевые слова</span>
            <textarea
              value={seoKeywords}
              onChange={(event) => {
                onSeoKeywordsChange(event.target.value);
                markChanged();
              }}
              maxLength={1000}
              placeholder="литература, автор, название книги"
            />
          </label>
          <label className="field">
            <span>Текущий постоянный адрес</span>
            <input
              type="url"
              value={canonicalUrl}
              readOnly
              placeholder={generatedCanonical}
            />
            <small>
              Формируется автоматически и используется как постоянная ссылка
              на эту языковую версию статьи.
            </small>
          </label>
          <label className="field">
            <span>Заголовок для соцсетей (Open Graph)</span>
            <input
              value={ogTitle}
              onChange={(event) => {
                onOgTitleChange(event.target.value);
                markChanged();
              }}
              maxLength={180}
            />
          </label>
          <label className="field">
            <span>Описание для соцсетей (Open Graph)</span>
            <textarea
              value={ogDescription}
              onChange={(event) => {
                onOgDescriptionChange(event.target.value);
                markChanged();
              }}
              maxLength={400}
            />
          </label>
          <label className="editor-checkbox-row">
            <input
              type="checkbox"
              name="allow_indexing"
              checked={allowIndexing}
              onChange={(event) => {
                onAllowIndexingChange(event.target.checked);
                markChanged();
              }}
            />{" "}
            Разрешить индексацию поисковыми системами
          </label>
        </div>
      </details>
    </section>
  );
}
