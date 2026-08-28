import type {
  ArticlePanelSectionRef,
  ArticleValidationCheck,
} from "./ArticleEditorTypes";

export type ValidationChecklistProps = {
  sectionRef?: ArticlePanelSectionRef;
  englishEnabled: boolean;
  checks: ArticleValidationCheck[];
  ready: boolean;
};

export default function ValidationChecklist({
  sectionRef,
  englishEnabled,
  checks,
  ready,
}: ValidationChecklistProps) {
  return (
    <section
      ref={sectionRef}
      className="panel settings-stack publication-checklist"
      aria-labelledby="publication-checklist-title"
    >
      <h2 id="publication-checklist-title">Контроль перед публикацией</h2>
      <p>
        {englishEnabled
          ? "Проверяется русский оригинал и включённый английский перевод."
          : "Английский перевод не включён: можно выпустить только русский оригинал."}
      </p>
      <ul>
        {checks.map((item) => (
          <li
            className={item.ok ? "is-ready" : "is-missing"}
            key={item.label}
          >
            <span aria-hidden="true">{item.ok ? "✓" : "○"}</span>
            {item.label}
          </li>
        ))}
      </ul>
      <p>
        {ready
          ? "Материал готов к выпуску."
          : "Черновик можно сохранять. Для выпуска завершите отмеченные пункты."}
      </p>
      <input
        type="hidden"
        name="publication_ready"
        value={ready ? "yes" : "no"}
      />
    </section>
  );
}

