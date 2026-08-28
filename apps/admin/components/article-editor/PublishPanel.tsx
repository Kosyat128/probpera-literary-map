import type {
  ArticleEditorLocale,
  ArticlePanelSectionRef,
  ArticlePublicationStatus,
  ArticleTranslationStatus,
  ArticleValueChange,
} from "./ArticleEditorTypes";

export type PublishPanelProps = {
  locale: ArticleEditorLocale;
  sectionRef?: ArticlePanelSectionRef;
  status: string;
  onStatusChange: ArticleValueChange<ArticlePublicationStatus>;
  scheduledAt: string;
  onScheduledAtChange: ArticleValueChange<string>;
  featured: boolean;
  onFeaturedChange: ArticleValueChange<boolean>;
  showOnHomepage: boolean;
  onShowOnHomepageChange: ArticleValueChange<boolean>;
  pinned: boolean;
  onPinnedChange: ArticleValueChange<boolean>;
  englishEnabled: boolean;
  onEnglishEnabledChange: ArticleValueChange<boolean>;
  englishStatus: string;
  onEnglishStatusChange: ArticleValueChange<ArticleTranslationStatus>;
  englishConfirmedCurrentSource: boolean;
  onEnglishConfirmedCurrentSourceChange: ArticleValueChange<boolean>;
  englishApprovedAt?: string | null;
};

export default function PublishPanel({
  locale,
  sectionRef,
  status,
  onStatusChange,
  scheduledAt,
  onScheduledAtChange,
  featured,
  onFeaturedChange,
  showOnHomepage,
  onShowOnHomepageChange,
  pinned,
  onPinnedChange,
  englishEnabled,
  onEnglishEnabledChange,
  englishStatus,
  onEnglishStatusChange,
  englishConfirmedCurrentSource,
  onEnglishConfirmedCurrentSourceChange,
  englishApprovedAt,
}: PublishPanelProps) {
  return (
    <section ref={sectionRef} className="panel settings-stack">
      <h2>{locale === "en" ? "English publication" : "Публикация"}</h2>
      {locale === "ru" ? (
        <>
          <label className="field">
            <span>Статус</span>
            <select
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value as ArticlePublicationStatus)
              }
            >
              <option value="draft">Черновик</option>
              <option value="review">На проверке</option>
              <option value="scheduled">По расписанию</option>
              <option value="published">Опубликована</option>
              <option value="hidden">Скрыта</option>
              <option value="archived">В архиве</option>
            </select>
          </label>
          <label className="field">
            <span>Дата и время публикации</span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => onScheduledAtChange(event.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={featured}
              onChange={(event) => onFeaturedChange(event.target.checked)}
            />{" "}
            Выбор редакции
          </label>
          <label>
            <input
              type="checkbox"
              checked={showOnHomepage}
              onChange={(event) =>
                onShowOnHomepageChange(event.target.checked)
              }
            />{" "}
            Показывать на главной
          </label>
          <label>
            <input
              type="checkbox"
              checked={pinned}
              onChange={(event) => onPinnedChange(event.target.checked)}
            />{" "}
            Закрепить
          </label>
        </>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={englishEnabled}
              onChange={(event) =>
                onEnglishEnabledChange(event.target.checked)
              }
            />{" "}
            Save the English translation
          </label>
          <label className="field">
            <span>Translation status</span>
            <select
              value={englishStatus}
              onChange={(event) =>
                onEnglishStatusChange(
                  event.target.value as ArticleTranslationStatus
                )
              }
            >
              <option value="draft">Draft</option>
              <option value="review">Ready for review</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="stale">Stale after Russian edit</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={englishConfirmedCurrentSource}
              onChange={(event) =>
                onEnglishConfirmedCurrentSourceChange(event.target.checked)
              }
            />{" "}
            I reviewed this translation against the current Russian source
          </label>
          {englishApprovedAt && <small>Last approved: {englishApprovedAt}</small>}
        </>
      )}
    </section>
  );
}

