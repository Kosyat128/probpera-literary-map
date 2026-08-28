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
          ? `EN: ${model.englishStatus}`
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
    <div className="editor-template-bar">
      <span>English translation</span>
      <small>
        Translate the author&apos;s current Russian version. The English text is
        stored and reviewed independently; Russian text is never inserted as an
        English fallback.
      </small>
    </div>
  );
}
