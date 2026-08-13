import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import {
  workEditorialStatuses,
  workImportStatuses,
  workSourceUsages,
  workTranslationMethods,
} from "@/lib/literary-work-workspace";
import {
  addWorkExternalIdAction,
  deleteWorkExternalIdAction,
  deleteWorkImportCandidateAction,
  deleteWorkSourceAction,
  deleteWorkTranslationAction,
  reviewWorkImportCandidateAction,
  saveWorkSourceAction,
  saveWorkTranslationAction,
  updateWorkExternalIdAction,
} from "@/app/(dashboard)/library/actions";

export type LiteraryWorkWorkspaceContext = {
  catalogQ: string;
  catalogCountry: string;
  catalogWriter: string;
  catalogStatus: string;
  catalogWorksPage: number;
  catalogEditionsPage: number;
  catalogWorkPickerQ: string;
  catalogWorkPickerPage: number;
  catalogIsbn: string;
  catalogWorkId: string;
  catalogWriterId: string;
  catalogCountryId: string;
  catalogEditionId: string;
};

type TranslationRow = {
  id: string;
  locale: "ru" | "en";
  title: string;
  description: string;
  source_language: string;
  translation_method: string;
  editorial_status: string;
  source_urls: string[] | null;
  reviewed_at: string | null;
  updated_at: string;
};

type SourceRow = {
  id: string;
  provider: string;
  source_url: string;
  field_names: string[] | null;
  license_name: string | null;
  usage: string;
  retrieved_at: string;
  updated_at: string;
};

type ExternalIdRow = {
  id: string;
  scheme: string;
  external_id: string;
  source_url: string;
};

type CandidateRow = {
  id: string;
  provider: string;
  external_id: string;
  title: string;
  source_url: string;
  quality_score: number;
  status: string;
  rejection_reasons: string[] | null;
  promoted_work_id: string | null;
  updated_at: string;
};

function WorkspaceContextFields({
  context,
  workId,
}: {
  context: LiteraryWorkWorkspaceContext;
  workId: string;
}) {
  return (
    <>
      <input type="hidden" name="work_id" value={workId} />
      <input type="hidden" name="catalog_q" value={context.catalogQ} />
      <input type="hidden" name="catalog_country" value={context.catalogCountry} />
      <input type="hidden" name="catalog_writer" value={context.catalogWriter} />
      <input type="hidden" name="catalog_status" value={context.catalogStatus} />
      <input type="hidden" name="catalog_works_page" value={context.catalogWorksPage} />
      <input type="hidden" name="catalog_editions_page" value={context.catalogEditionsPage} />
      <input type="hidden" name="catalog_work_picker_q" value={context.catalogWorkPickerQ} />
      <input type="hidden" name="catalog_work_picker_page" value={context.catalogWorkPickerPage} />
      <input type="hidden" name="catalog_isbn" value={context.catalogIsbn} />
      <input type="hidden" name="catalog_work_id" value={context.catalogWorkId} />
      <input type="hidden" name="catalog_writer_id" value={context.catalogWriterId} />
      <input type="hidden" name="catalog_country_id" value={context.catalogCountryId} />
      <input type="hidden" name="catalog_edition_id" value={context.catalogEditionId} />
    </>
  );
}

function TranslationEditor({
  locale,
  translation,
  workId,
  context,
}: {
  locale: "ru" | "en";
  translation?: TranslationRow;
  workId: string;
  context: LiteraryWorkWorkspaceContext;
}) {
  return (
    <article className="work-workspace-card">
      <header>
        <div>
          <span className="eyebrow">{locale === "ru" ? "Русская версия" : "English version"}</span>
          <h4>{translation ? "Редактировать перевод" : "Добавить перевод"}</h4>
        </div>
        <span className="badge">{translation?.editorial_status || "draft"}</span>
      </header>
      <form className="settings-stack" action={saveWorkTranslationAction}>
        <WorkspaceContextFields context={context} workId={workId} />
        <input type="hidden" name="translation_id" value={translation?.id || ""} />
        <input type="hidden" name="expected_updated_at" value={translation?.updated_at || ""} />
        <input type="hidden" name="locale" value={locale} />
        <label className="field">
          <span>Название *</span>
          <input name="title" required maxLength={300} defaultValue={translation?.title || ""} />
        </label>
        <label className="field">
          <span>Редакционное описание *</span>
          <textarea
            name="description"
            required
            minLength={140}
            maxLength={900}
            rows={7}
            defaultValue={translation?.description || ""}
          />
          <small>Для публикации: 140–900 знаков и 2–3 законченных предложения.</small>
        </label>
        <div className="work-workspace-grid">
          <label className="field">
            <span>Исходный язык *</span>
            <input
              name="source_language"
              required
              minLength={2}
              maxLength={40}
              defaultValue={translation?.source_language || locale}
            />
          </label>
          <label className="field">
            <span>Метод перевода</span>
            <select name="translation_method" defaultValue={translation?.translation_method || "editorial-original"}>
              {workTranslationMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Статус</span>
            <select name="editorial_status" defaultValue={translation?.editorial_status || "draft"}>
              {workEditorialStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Дата проверки</span>
            <input name="reviewed_at" type="date" defaultValue={translation?.reviewed_at || ""} />
          </label>
        </div>
        <label className="field">
          <span>Источники перевода</span>
          <textarea
            name="source_urls"
            rows={3}
            placeholder="https://… — один адрес в строке"
            defaultValue={(translation?.source_urls || []).join("\n")}
          />
        </label>
        <button className="button" type="submit">Сохранить и сразу опубликовать</button>
      </form>
      {translation && (
        <form className="work-workspace-delete" action={deleteWorkTranslationAction}>
          <WorkspaceContextFields context={context} workId={workId} />
          <input type="hidden" name="translation_id" value={translation.id} />
          <input type="hidden" name="expected_updated_at" value={translation.updated_at} />
          <ConfirmSubmitButton message={`Удалить перевод ${locale.toUpperCase()}? Публичная версия может перестать проходить условия публикации.`}>
            Удалить перевод
          </ConfirmSubmitButton>
        </form>
      )}
    </article>
  );
}

function SourceEditor({
  source,
  workId,
  context,
}: {
  source?: SourceRow;
  workId: string;
  context: LiteraryWorkWorkspaceContext;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <details className="work-workspace-record" open={!source}>
      <summary>{source ? `${source.provider} · ${source.usage}` : "Добавить проверяемый источник"}</summary>
      <form className="settings-stack" action={saveWorkSourceAction}>
        <WorkspaceContextFields context={context} workId={workId} />
        <input type="hidden" name="source_id" value={source?.id || ""} />
        <input type="hidden" name="expected_updated_at" value={source?.updated_at || ""} />
        <div className="work-workspace-grid">
          <label className="field"><span>Поставщик *</span><input name="provider" required minLength={2} maxLength={160} defaultValue={source?.provider || ""} /></label>
          <label className="field"><span>Назначение</span><select name="usage" defaultValue={source?.usage || "reference-only"}>{workSourceUsages.map((usage) => <option key={usage} value={usage}>{usage}</option>)}</select></label>
          <label className="field work-workspace-wide"><span>HTTPS-адрес *</span><input name="source_url" type="url" required maxLength={2000} defaultValue={source?.source_url || ""} /></label>
          <label className="field"><span>Лицензия</span><input name="license_name" maxLength={240} defaultValue={source?.license_name || ""} /></label>
          <label className="field"><span>Дата получения *</span><input name="retrieved_at" type="date" required defaultValue={source?.retrieved_at || today} /></label>
        </div>
        <label className="field"><span>Какие поля подтверждает *</span><textarea name="field_names" rows={3} required placeholder="title&#10;description" defaultValue={(source?.field_names || []).join("\n")} /></label>
        <button className="button-secondary" type="submit">{source ? "Сохранить источник" : "Добавить источник"}</button>
      </form>
      {source && (
        <form className="work-workspace-delete" action={deleteWorkSourceAction}>
          <WorkspaceContextFields context={context} workId={workId} />
          <input type="hidden" name="source_id" value={source.id} />
          <input type="hidden" name="expected_updated_at" value={source.updated_at} />
          <ConfirmSubmitButton message="Удалить источник? Это может снять произведение с публикации.">Удалить источник</ConfirmSubmitButton>
        </form>
      )}
    </details>
  );
}

export default function LiteraryWorkWorkspace({
  work,
  translations,
  sources,
  externalIds,
  candidates,
  context,
}: {
  work: { id: string; title: string };
  translations: TranslationRow[];
  sources: SourceRow[];
  externalIds: ExternalIdRow[];
  candidates: CandidateRow[];
  context: LiteraryWorkWorkspaceContext;
}) {
  const translationByLocale = new Map(translations.map((item) => [item.locale, item]));
  return (
    <section id="work-workspace" className="panel work-workspace">
      <header className="work-workspace-heading">
        <div>
          <span className="eyebrow">Полная редакционная запись</span>
          <h3>Переводы, источники и внешние базы</h3>
          <p>
            Здесь хранятся публичные RU/EN-описания, происхождение сведений и связи с каталогами.
            Каждое сохранение защищено версией записи и сразу ставит обновление сайта в очередь.
          </p>
        </div>
        <span className="badge">{work.title}</span>
      </header>

      <div className="work-workspace-section">
        <div className="work-workspace-section-heading"><h3>RU / EN</h3><p>{translations.length}/2 языковых версий заведено</p></div>
        <div className="work-translation-grid">
          <TranslationEditor locale="ru" translation={translationByLocale.get("ru")} workId={work.id} context={context} />
          <TranslationEditor locale="en" translation={translationByLocale.get("en")} workId={work.id} context={context} />
        </div>
      </div>

      <div className="work-workspace-section">
        <div className="work-workspace-section-heading"><h3>Источники</h3><p>{sources.length} записей</p></div>
        <div className="work-workspace-records">
          {sources.map((source) => <SourceEditor key={source.id} source={source} workId={work.id} context={context} />)}
          <SourceEditor workId={work.id} context={context} />
        </div>
      </div>

      <div className="work-workspace-section">
        <div className="work-workspace-section-heading"><h3>Внешние идентификаторы</h3><p>Wikidata, Open Library, ISBNdb и другие проверяемые каталоги</p></div>
        {externalIds.length > 0 && (
          <div className="work-external-id-list">
            {externalIds.map((item) => (
              <details key={item.id} className="work-workspace-record work-external-id-record">
                <summary>{item.scheme} · {item.external_id}</summary>
                <form className="settings-stack" action={updateWorkExternalIdAction}>
                  <WorkspaceContextFields context={context} workId={work.id} />
                  <input type="hidden" name="external_id_row_id" value={item.id} />
                  <input type="hidden" name="expected_scheme" value={item.scheme} />
                  <input type="hidden" name="expected_external_id" value={item.external_id} />
                  <input type="hidden" name="expected_source_url" value={item.source_url} />
                  <div className="work-workspace-grid">
                    <label className="field"><span>Схема *</span><input name="scheme" required pattern="[a-z0-9][a-z0-9_-]{1,39}" defaultValue={item.scheme} /></label>
                    <label className="field"><span>Идентификатор *</span><input name="external_id" required maxLength={180} defaultValue={item.external_id} /></label>
                    <label className="field work-workspace-wide"><span>HTTPS-источник *</span><input name="source_url" type="url" required maxLength={2000} defaultValue={item.source_url} /></label>
                  </div>
                  <div className="editor-actions">
                    <button className="button-secondary" type="submit">Сохранить связь</button>
                    <a className="button-secondary" href={item.source_url} target="_blank" rel="noreferrer">Открыть источник</a>
                  </div>
                </form>
                <form className="work-workspace-delete" action={deleteWorkExternalIdAction}>
                  <WorkspaceContextFields context={context} workId={work.id} />
                  <input type="hidden" name="external_id_row_id" value={item.id} />
                  <input type="hidden" name="scheme" value={item.scheme} />
                  <input type="hidden" name="external_id" value={item.external_id} />
                  <input type="hidden" name="source_url" value={item.source_url} />
                  <ConfirmSubmitButton message={`Удалить связь ${item.scheme}: ${item.external_id}?`}>Удалить</ConfirmSubmitButton>
                </form>
              </details>
            ))}
          </div>
        )}
        <form className="settings-stack work-external-id-add" action={addWorkExternalIdAction}>
          <WorkspaceContextFields context={context} workId={work.id} />
          <div className="work-workspace-grid">
            <label className="field"><span>Схема *</span><input name="scheme" required pattern="[a-z0-9][a-z0-9_-]{1,39}" placeholder="openlibrary" /></label>
            <label className="field"><span>Идентификатор *</span><input name="external_id" required maxLength={180} placeholder="OL…W" /></label>
            <label className="field work-workspace-wide"><span>HTTPS-источник *</span><input name="source_url" type="url" required maxLength={2000} /></label>
          </div>
          <button className="button-secondary" type="submit">Добавить идентификатор</button>
        </form>
      </div>

      <div className="work-workspace-section">
        <div className="work-workspace-section-heading"><h3>Очередь импорт-кандидатов</h3><p>{candidates.length} записей для этого автора и страны</p></div>
        {candidates.length === 0 ? (
          <div className="empty-state"><p>Новых кандидатов из внешних каталогов нет.</p></div>
        ) : (
          <div className="work-workspace-records">
            {candidates.map((candidate) => (
              <details className="work-workspace-record" key={candidate.id}>
                <summary>{candidate.title} · {candidate.provider} · {candidate.quality_score}/100</summary>
                <div className="work-candidate-source">
                  <span className="badge">{candidate.status}</span>
                  <a href={candidate.source_url} target="_blank" rel="noreferrer">Открыть исходную запись</a>
                  {candidate.promoted_work_id && <small>Связано: {candidate.promoted_work_id}</small>}
                </div>
                <form className="settings-stack" action={reviewWorkImportCandidateAction}>
                  <WorkspaceContextFields context={context} workId={work.id} />
                  <input type="hidden" name="candidate_id" value={candidate.id} />
                  <input type="hidden" name="expected_updated_at" value={candidate.updated_at} />
                  <div className="work-workspace-grid">
                    <label className="field"><span>Качество 0–100</span><input name="quality_score" type="number" min={0} max={100} required defaultValue={candidate.quality_score} /></label>
                    <label className="field"><span>Статус</span><select name="status" defaultValue={candidate.status}>{workImportStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                  </div>
                  <label className="field"><span>Причины отклонения</span><textarea name="rejection_reasons" rows={3} placeholder="Одна причина в строке" defaultValue={(candidate.rejection_reasons || []).join("\n")} /></label>
                  <small>Статус promoted привязывает кандидата к открытому произведению; исходные данные не переписываются.</small>
                  <button className="button-secondary" type="submit">Сохранить решение</button>
                </form>
                {(candidate.status === "candidate" || candidate.status === "rejected") && (
                  <form className="work-workspace-delete" action={deleteWorkImportCandidateAction}>
                    <WorkspaceContextFields context={context} workId={work.id} />
                    <input type="hidden" name="candidate_id" value={candidate.id} />
                    <input type="hidden" name="expected_updated_at" value={candidate.updated_at} />
                    <ConfirmSubmitButton message="Удалить импорт-кандидата без возможности восстановления?">Удалить кандидата</ConfirmSubmitButton>
                  </form>
                )}
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
