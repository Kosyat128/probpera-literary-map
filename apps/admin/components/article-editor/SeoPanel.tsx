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
  onSeoTitleChange: ArticleValueChange<string>;
  onSeoDescriptionChange: ArticleValueChange<string>;
  onSeoKeywordsChange: ArticleValueChange<string>;
  onOgTitleChange: ArticleValueChange<string>;
  onOgDescriptionChange: ArticleValueChange<string>;
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
  onSeoTitleChange,
  onSeoDescriptionChange,
  onSeoKeywordsChange,
  onOgTitleChange,
  onOgDescriptionChange,
  markRussianSourceChanged,
  markDirty,
}: SeoPanelProps) {
  const markRussian = () => {
    if (locale === "ru") markRussianSourceChanged();
  };

  return (
    <section ref={sectionRef} className="panel settings-stack">
      <h2>{locale === "en" ? "English URL and SEO" : "Адрес и SEO"}</h2>
      <label className="field">
        <span>{locale === "en" ? "English article slug" : "Адрес статьи"}</span>
        <input
          value={slug}
          onChange={(event) => {
            onSlugEditedChange(true);
            onSlugChange(createSlug(event.target.value));
            markRussian();
            markDirty();
          }}
          required={locale === "ru"}
        />
        <span className="slug-control-row">
          <small>
            {locale === "en"
              ? !slugEdited
                ? "The slug follows the English title automatically."
                : "The English slug is fixed manually."
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
            {locale === "en" ? "Generate from title" : "Создавать из заголовка"}
          </button>
        </span>
        <small>{generatedCanonical}</small>
      </label>
      <label className="field">
        <span>Старый адрес - только совместимость</span>
        <input
          name="legacy_path"
          defaultValue={legacyPath}
          placeholder="/read/page-article/…"
        />
        <small>
          Не показывается читателям и не используется в новых ссылках. Нужен
          только для бесшовного 301‑перехода со старых публикаций.
        </small>
      </label>
      <label className="field">
        <span>{locale === "en" ? "SEO title" : "SEO-заголовок"}</span>
        <input
          value={seoTitle}
          onChange={(event) => {
            onSeoTitleChange(event.target.value);
            markRussian();
          }}
          maxLength={180}
        />
      </label>
      <label className="field">
        <span>{locale === "en" ? "Search description" : "Описание для поиска"}</span>
        <textarea
          value={seoDescription}
          onChange={(event) => {
            onSeoDescriptionChange(event.target.value);
            markRussian();
          }}
          maxLength={400}
        />
      </label>
      <label className="field">
        <span>{locale === "en" ? "Keywords" : "Ключевые слова"}</span>
        <textarea
          value={seoKeywords}
          onChange={(event) => {
            onSeoKeywordsChange(event.target.value);
            markRussian();
          }}
          maxLength={1000}
          placeholder={
            locale === "en"
              ? "literature, author, book title"
              : "литература, автор, название книги"
          }
        />
      </label>
      <label className="field">
        <span>
          {locale === "en" ? "English canonical URL" : "Текущий постоянный адрес"}
        </span>
        <input
          type="url"
          value={canonicalUrl}
          readOnly
          placeholder={generatedCanonical}
        />
        <small>
          {locale === "en"
            ? "Generated automatically from the English article slug and used as its dedicated public address."
            : "Строится автоматически из рубрики и названия. Новые публикации всегда используют этот понятный адрес."}
        </small>
      </label>
      <label className="field">
        <span>Open Graph - {locale === "en" ? "title" : "заголовок"}</span>
        <input
          value={ogTitle}
          onChange={(event) => {
            onOgTitleChange(event.target.value);
            markRussian();
          }}
          maxLength={180}
        />
      </label>
      <label className="field">
        <span>Open Graph - {locale === "en" ? "description" : "описание"}</span>
        <textarea
          value={ogDescription}
          onChange={(event) => {
            onOgDescriptionChange(event.target.value);
            markRussian();
          }}
          maxLength={400}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="allow_indexing"
          defaultChecked={allowIndexing}
        />{" "}
        Разрешить индексацию поисковыми системами
      </label>
    </section>
  );
}
