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
          ? "English sources and bibliography"
          : "Источники и библиография"}
      </h2>
      <label className="field">
        <span>
          {locale === "en"
            ? "Sources - one per line"
            : "Источники - по одному на строку"}
        </span>
        <textarea
          value={sourceText}
          onChange={(event) => {
            onSourceTextChange(event.target.value);
            updateRussianSourceState();
          }}
          placeholder={
            locale === "en" ? "Title - https://…" : "Название - https://…"
          }
        />
      </label>
      <label className="field">
        <span>
          {locale === "en"
            ? "Bibliography - one entry per line"
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
    </section>
  );
}

