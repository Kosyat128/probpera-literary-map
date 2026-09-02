import type {
  ArticleEditorLocale,
  ArticlePanelSectionRef,
  ArticleValueChange,
  MarkArticleDirty,
  MarkRussianSourceChanged,
} from "./ArticleEditorTypes";

export type SourceBibliographyEditorProps = {
  locale: ArticleEditorLocale;
  sectionRef?: ArticlePanelSectionRef;
  sourceText: string;
  bibliographyText: string;
  onSourceTextChange: ArticleValueChange<string>;
  onBibliographyTextChange: ArticleValueChange<string>;
  markRussianSourceChanged: MarkRussianSourceChanged;
  markDirty: MarkArticleDirty;
};

export default function SourceBibliographyEditor({
  locale,
  sectionRef,
  sourceText,
  bibliographyText,
  onSourceTextChange,
  onBibliographyTextChange,
  markRussianSourceChanged,
  markDirty,
}: SourceBibliographyEditorProps) {
  const updateRussianSourceState = () => {
    if (locale === "ru") markRussianSourceChanged();
    markDirty();
  };

  return (
    <section ref={sectionRef} className="panel settings-stack">
      <h2>
        {locale === "en"
          ? "Источники английской версии"
          : "Источники и библиография"}
      </h2>
      <details className="editor-panel-disclosure">
        <summary>
          <span>Добавить источники и библиографию</span>
          <small>
            {sourceText.trim() || bibliographyText.trim()
              ? "Раздел заполнен"
              : "Можно заполнить перед публикацией"}
          </small>
        </summary>
        <div className="editor-panel-disclosure-content settings-stack">
          <label className="field">
            <span>
              {locale === "en"
                ? "Источники английской версии - по одному на строку"
                : "Источники - по одному на строку"}
            </span>
            <textarea
              value={sourceText}
              onChange={(event) => {
                onSourceTextChange(event.target.value);
                updateRussianSourceState();
              }}
              placeholder="Название - https://…"
            />
          </label>
          <label className="field">
            <span>
              {locale === "en"
                ? "Библиография английской версии - по одной записи на строку"
                : "Библиография - по одной записи на строку"}
            </span>
            <textarea
              value={bibliographyText}
              onChange={(event) => {
                onBibliographyTextChange(event.target.value);
                updateRussianSourceState();
              }}
            />
          </label>
        </div>
      </details>
    </section>
  );
}

