"use client";

import type {
  ArticleEditorLocale,
  ArticleTranslationStatus,
} from "./ArticleEditorTypes";

export type TranslationPanelModel = {
  activeLocale: ArticleEditorLocale;
  switchingDisabled: boolean;
  englishEnabled: boolean;
  englishStatus: ArticleTranslationStatus;
  englishLinkedToOriginal: boolean;
  russianSourceChanged: boolean;
};

export type TranslationPanelActions = {
  switchLocale: (locale: ArticleEditorLocale) => void;
};

const translationStatusLabel: Record<ArticleTranslationStatus, string> = {
  draft: "черновик",
  review: "на проверке",
  approved: "проверен",
  published: "опубликован",
  stale: "нужна повторная сверка",
  archived: "в архиве",
};

export default function TranslationPanel({
  model,
  actions,
}: {
  model: TranslationPanelModel;
  actions: TranslationPanelActions;
}) {
  return (
    <nav className="article-language-tabs" aria-label="Язык статьи">
      <button
        type="button"
        className={model.activeLocale === "ru" ? "is-active" : undefined}
        aria-pressed={model.activeLocale === "ru"}
        disabled={model.switchingDisabled}
        onClick={() => actions.switchLocale("ru")}
      >
        RU · авторский оригинал
      </button>
      <button
        type="button"
        className={model.activeLocale === "en" ? "is-active" : undefined}
        aria-pressed={model.activeLocale === "en"}
        disabled={model.switchingDisabled}
        onClick={() => actions.switchLocale("en")}
      >
        EN · необязательный перевод
      </button>
      <span>
        {model.englishEnabled
          ? `EN: ${translationStatusLabel[model.englishStatus]}`
          : "EN: не используется"}
        {model.englishEnabled &&
        model.englishLinkedToOriginal &&
        !model.russianSourceChanged
          ? " · есть привязка к оригиналу"
          : model.englishEnabled && model.russianSourceChanged
            ? " · нужна повторная сверка"
            : ""}
      </span>
    </nav>
  );
}

export function EnglishTranslationNotice() {
  return (
    <div className="english-translation-notice">
      <strong>Английская версия статьи</strong>
      <small>
        Переводите актуальную русскую версию автора. Английский текст хранится и
        проверяется отдельно; русский текст никогда не подставляется вместо
        перевода.
      </small>
    </div>
  );
}
