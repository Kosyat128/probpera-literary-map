import type {
  ArticleEditorLocale,
  ArticlePanelSectionRef,
  ArticlePublicationStatus,
  ArticleTranslationStatus,
  ArticleValueChange,
} from "./ArticleEditorTypes";

const PUBLICATION_LABELS: Record<ArticlePublicationStatus, string> = {
  draft: "Черновик",
  review: "На проверке",
  scheduled: "По расписанию",
  published: "Опубликована",
  hidden: "Скрыта",
  archived: "В архиве",
};

const PUBLICATION_DESCRIPTIONS: Record<ArticlePublicationStatus, string> = {
  draft: "Сохранена только в редакции и не видна читателям.",
  review: "Готова к редакционной проверке, но ещё не опубликована.",
  scheduled: "Будет выпущена в указанную дату и время.",
  published: "Доступна читателям на сайте.",
  hidden: "Снята с публичного показа без удаления материалов.",
  archived: "Перенесена в редакционный архив.",
};

const TRANSLATION_LABELS: Record<ArticleTranslationStatus, string> = {
  draft: "Черновик перевода",
  review: "Готов к проверке",
  approved: "Проверен",
  published: "Опубликован",
  stale: "Устарел после правок русской версии",
  archived: "В архиве",
};

const RESTRICTED_PUBLICATION_STATUSES = new Set<ArticlePublicationStatus>([
  "scheduled",
  "published",
  "hidden",
  "archived",
]);

const RESTRICTED_TRANSLATION_STATUSES = new Set<ArticleTranslationStatus>([
  "approved",
  "published",
  "stale",
  "archived",
]);

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
  canPublish: boolean;
  canOverridePublicationChecklist: boolean;
};

function isPublicationStatus(value: string): value is ArticlePublicationStatus {
  return value in PUBLICATION_LABELS;
}

function isTranslationStatus(value: string): value is ArticleTranslationStatus {
  return value in TRANSLATION_LABELS;
}

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
  canPublish,
  canOverridePublicationChecklist,
}: PublishPanelProps) {
  const currentPublicationStatus = isPublicationStatus(status)
    ? status
    : "draft";
  const currentTranslationStatus = isTranslationStatus(englishStatus)
    ? englishStatus
    : "draft";
  const scheduleMissing =
    currentPublicationStatus === "scheduled" && !scheduledAt.trim();

  return (
    <section ref={sectionRef} className="panel settings-stack">
      <h2>
        {locale === "en" ? "Публикация перевода" : "Сохранение и публикация"}
      </h2>
      {locale === "ru" ? (
        <>
          <p className="publication-mode-note">
            <strong>{PUBLICATION_LABELS[currentPublicationStatus]}</strong>
            <span>{PUBLICATION_DESCRIPTIONS[currentPublicationStatus]}</span>
          </p>
          <label className="field">
            <span>Состояние статьи</span>
            <select
              value={currentPublicationStatus}
              onChange={(event) =>
                onStatusChange(event.target.value as ArticlePublicationStatus)
              }
            >
              <option value="draft">Черновик - продолжить позже</option>
              <option value="review">На проверке - передать редактору</option>
              {canPublish ? (
                <>
                  <option value="scheduled">По расписанию</option>
                  <option value="published">Опубликовать</option>
                  <option value="hidden">Скрыть с сайта</option>
                  <option value="archived">Перенести в архив</option>
                </>
              ) : RESTRICTED_PUBLICATION_STATUSES.has(
                  currentPublicationStatus
                ) ? (
                <option value={currentPublicationStatus} disabled>
                  {PUBLICATION_LABELS[currentPublicationStatus]} - только просмотр
                </option>
              ) : null}
            </select>
            <small>
              {canPublish
                ? "Сохранение черновика и выпуск на сайт - разные действия."
                : "Вы можете сохранить черновик или передать статью на проверку. Выпуск выполнит администратор."}
            </small>
          </label>
          {currentPublicationStatus === "scheduled" ? (
            <label className="field">
              <span>Обязательная дата и время публикации</span>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => onScheduledAtChange(event.target.value)}
                aria-invalid={scheduleMissing || undefined}
                aria-describedby={
                  scheduleMissing ? "article-schedule-required" : undefined
                }
              />
              {scheduleMissing ? (
                <small
                  id="article-schedule-required"
                  className="field-error"
                  role="alert"
                >
                  Укажите дату и время, иначе публикацию по расписанию сохранить
                  нельзя.
                </small>
              ) : (
                <small>Дата используется в часовом поясе редакции.</small>
              )}
            </label>
          ) : null}
          <details className="editor-panel-disclosure">
            <summary>
              <span>Дополнительное размещение</span>
              <small>Главная страница и редакционные отметки</small>
            </summary>
            <div className="editor-panel-disclosure-content settings-stack">
              <label className="editor-checkbox-row">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(event) => onFeaturedChange(event.target.checked)}
                />{" "}
                Выбор редакции
              </label>
              <label className="editor-checkbox-row">
                <input
                  type="checkbox"
                  checked={showOnHomepage}
                  onChange={(event) =>
                    onShowOnHomepageChange(event.target.checked)
                  }
                />{" "}
                Показывать на главной
              </label>
              <label className="editor-checkbox-row">
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(event) => onPinnedChange(event.target.checked)}
                />{" "}
                Закрепить
              </label>
              {canOverridePublicationChecklist ? (
                <p className="publication-permission-note">
                  Вам доступно ручное подтверждение редакционного чек-листа.
                  Обязательные проверки безопасности и целостности всё равно
                  выполняются на сервере.
                </p>
              ) : null}
            </div>
          </details>
        </>
      ) : (
        <>
          <p className="publication-mode-note">
            <strong>{TRANSLATION_LABELS[currentTranslationStatus]}</strong>
            <span>
              Английская версия хранится отдельно и не изменяет русскую статью.
            </span>
          </p>
          <label className="editor-checkbox-row">
            <input
              type="checkbox"
              checked={englishEnabled}
              onChange={(event) =>
                onEnglishEnabledChange(event.target.checked)
              }
            />{" "}
            Сохранять английскую версию
          </label>
          <label className="field">
            <span>Состояние перевода</span>
            <select
              value={currentTranslationStatus}
              onChange={(event) =>
                onEnglishStatusChange(
                  event.target.value as ArticleTranslationStatus
                )
              }
            >
              <option value="draft">Черновик перевода</option>
              <option value="review">Готов к проверке</option>
              {currentTranslationStatus === "stale" ? (
                <option value="stale" disabled>
                  {TRANSLATION_LABELS.stale} - только просмотр
                </option>
              ) : null}
              {canPublish ? (
                <>
                  <option value="approved">Проверен</option>
                  <option value="published">Опубликован</option>
                  <option value="archived">В архиве</option>
                </>
              ) : RESTRICTED_TRANSLATION_STATUSES.has(
                  currentTranslationStatus
                ) ? (
                <option value={currentTranslationStatus} disabled>
                  {TRANSLATION_LABELS[currentTranslationStatus]} - только просмотр
                </option>
              ) : null}
            </select>
            <small>
              {canPublish
                ? "Сначала сохраните перевод, затем отдельно подтвердите его выпуск."
                : "Вы можете подготовить перевод и передать его на проверку."}
            </small>
          </label>
          <label className="editor-checkbox-row">
            <input
              type="checkbox"
              checked={englishConfirmedCurrentSource}
              onChange={(event) =>
                onEnglishConfirmedCurrentSourceChange(event.target.checked)
              }
            />{" "}
            Перевод сверен с текущей русской версией
          </label>
          {englishApprovedAt ? (
            <small>Последнее подтверждение: {englishApprovedAt}</small>
          ) : null}
        </>
      )}
    </section>
  );
}
