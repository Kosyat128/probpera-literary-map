import Link from "next/link";

import LiteraryWorkWorkspace, {
  type LiteraryWorkWorkspaceContext,
} from "@/components/LiteraryWorkWorkspace";
import { bookEditionRightsStatuses } from "@/lib/book-edition-edit";
import { adminEnv } from "@/lib/env";
import { lookupEditionByIsbn, normalizeIsbn } from "@/lib/isbn";
import {
  LIBRARY_CATALOG_PAGE_SIZE,
  LIBRARY_WORK_PICKER_PAGE_SIZE,
  libraryCatalogHref,
  libraryEditorialStatuses,
  mergeLibraryWorkOptions,
  normalizeLibraryIdentifier,
  parseLibraryCatalogQuery,
  type LibraryCatalogHrefOptions,
} from "@/lib/library-catalog-query";
import {
  editorialArtworkAssetUrl,
  editorialArtworkCountFromRelation,
  editorialArtworkDigest,
  editorialArtworkProvenanceView,
  editorialArtworkSecondaryCount,
} from "@/lib/literary-work-cover-artwork";
import { redirect } from "@/lib/navigation";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveBookEditionAction, updateBookEditionAction } from "./actions";
import { saveVisualEntityFieldFormAction } from "../visual-entity-actions";

export const metadata = { title: "Книжный архив" };

type LibrarySearchParams = {
  isbn?: string;
  error?: string;
  notice?: string;
  saved?: string;
  work_id?: string;
  writer_id?: string;
  country_id?: string;
  edition_id?: string;
  published?: string;
  q?: string;
  country?: string;
  writer?: string;
  status?: string;
  works_page?: string;
  editions_page?: string;
  work_picker_q?: string;
  work_picker_page?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function listValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

type LibraryFormContext = {
  catalog: ReturnType<typeof parseLibraryCatalogQuery>;
  isbn: string;
  workId: string;
  writerId: string;
  countryId: string;
  editionId: string;
  entityExpectedUpdatedAt: string;
};

function LibraryActionContextFields({
  catalog,
  isbn,
  workId,
  writerId,
  countryId,
  editionId,
}: LibraryFormContext) {
  return (
    <>
      <input type="hidden" name="catalog_q" value={catalog.term} />
      <input type="hidden" name="catalog_country" value={catalog.country} />
      <input type="hidden" name="catalog_writer" value={catalog.writer} />
      <input type="hidden" name="catalog_status" value={catalog.status} />
      <input type="hidden" name="catalog_works_page" value={catalog.worksPage} />
      <input type="hidden" name="catalog_editions_page" value={catalog.editionsPage} />
      <input type="hidden" name="catalog_work_picker_q" value={catalog.workPickerTerm} />
      <input type="hidden" name="catalog_work_picker_page" value={catalog.workPickerPage} />
      <input type="hidden" name="catalog_isbn" value={isbn} />
      <input type="hidden" name="catalog_work_id" value={workId} />
      <input type="hidden" name="catalog_writer_id" value={writerId} />
      <input type="hidden" name="catalog_country_id" value={countryId} />
      <input type="hidden" name="catalog_edition_id" value={editionId} />
    </>
  );
}

function CatalogPagination({
  label,
  page,
  totalPages,
  href,
}: {
  label: string;
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination library-pagination" aria-label={label}>
      {page > 1 ? <Link href={href(1)}>Первая</Link> : <span aria-disabled="true">Первая</span>}
      {page > 1 ? <Link href={href(page - 1)}>Назад</Link> : <span aria-disabled="true">Назад</span>}
      <span aria-current="page">Страница {page} из {totalPages}</span>
      {page < totalPages ? <Link href={href(page + 1)}>Вперёд</Link> : <span aria-disabled="true">Вперёд</span>}
      {page < totalPages ? <Link href={href(totalPages)}>Последняя</Link> : <span aria-disabled="true">Последняя</span>}
    </nav>
  );
}

function VisualEntityFieldForm({
  entityType,
  entityId,
  field,
  label,
  value,
  multiline = false,
  hint,
  formContext,
}: {
  entityType: "writer" | "book";
  entityId: string;
  field: string;
  label: string;
  value: string;
  multiline?: boolean;
  hint?: string;
  formContext: LibraryFormContext;
}) {
  return (
    <form className="visual-entity-field-form" action={saveVisualEntityFieldFormAction}>
      <LibraryActionContextFields {...formContext} />
      <input
        type="hidden"
        name="expected_updated_at"
        value={formContext.entityExpectedUpdatedAt}
      />
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <input type="hidden" name="field" value={field} />
      <label className="field">
        <span>{label}</span>
        {multiline ? (
          <textarea name="value" defaultValue={value} />
        ) : (
          <input
            name="value"
            defaultValue={value}
            inputMode={field === "firstPublished" ? "numeric" : undefined}
          />
        )}
        {hint && <small>{hint}</small>}
      </label>
      <button className="button-secondary" type="submit">
        Сохранить поле
      </button>
    </form>
  );
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const query = await searchParams;
  const requestedIsbn = normalizeIsbn(query.isbn || "");
  const requestedWorkId = normalizeLibraryIdentifier(query.work_id, 180);
  const requestedWriterId = normalizeLibraryIdentifier(query.writer_id, 180);
  const requestedCountryId = normalizeLibraryIdentifier(query.country_id, 120);
  const editionIdDraft = String(query.edition_id || "").trim().slice(0, 180);
  const requestedEditionId = UUID_PATTERN.test(editionIdDraft)
    ? editionIdDraft.toLowerCase()
    : "";
  const catalog = parseLibraryCatalogQuery({
    q: query.q,
    country: query.country || requestedCountryId,
    writer: query.writer || requestedWriterId,
    status: query.status,
    works_page: query.works_page,
    editions_page: query.editions_page,
    work_picker_q: query.work_picker_q,
    work_picker_page: query.work_picker_page,
  });
  const candidate = requestedIsbn
    ? await lookupEditionByIsbn(requestedIsbn).catch(() => null)
    : null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;

  let worksCatalogQuery = supabase
    .from("literary_works")
    .select(
      "id,legacy_id,title,original_title,first_published,original_language,description,genres,tags,source_url,writer_id,country_id,editorial_status,metadata,updated_at,literary_work_cover_artworks(count)",
      { count: "exact" }
    )
    .order("title")
    .order("id");
  if (catalog.term) worksCatalogQuery = worksCatalogQuery.ilike("title", catalog.pattern);
  if (catalog.country) worksCatalogQuery = worksCatalogQuery.eq("country_id", catalog.country);
  if (catalog.writer) worksCatalogQuery = worksCatalogQuery.eq("writer_id", catalog.writer);
  if (catalog.status) worksCatalogQuery = worksCatalogQuery.eq("editorial_status", catalog.status);

  // This query is intentionally independent from the catalog filters above.
  // It powers reassignment of an edition to any work in the complete archive.
  let workPickerQuery = supabase
    .from("literary_works")
    .select(
      "id,legacy_id,title,original_title,first_published,original_language,description,genres,tags,source_url,writer_id,country_id,editorial_status,metadata,updated_at",
      { count: "exact" }
    )
    .order("title")
    .order("id");
  if (catalog.workPickerTerm) {
    workPickerQuery = workPickerQuery.ilike(
      "title",
      catalog.workPickerPattern
    );
  }

  let editionsCatalogQuery = supabase
    .from("book_editions")
    .select(
      "id,title,isbn_10,isbn_13,publisher,publication_year,language,cover_url,cover_rights_status,is_primary,updated_at,literary_works!inner(id,legacy_id,title,country_id,writer_id,editorial_status,metadata)",
      { count: "exact" }
    )
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  if (catalog.term) editionsCatalogQuery = editionsCatalogQuery.ilike("title", catalog.pattern);
  if (catalog.country) {
    editionsCatalogQuery = editionsCatalogQuery.eq(
      "literary_works.country_id",
      catalog.country
    );
  }
  if (catalog.writer) {
    editionsCatalogQuery = editionsCatalogQuery.eq(
      "literary_works.writer_id",
      catalog.writer
    );
  }
  if (catalog.status) {
    editionsCatalogQuery = editionsCatalogQuery.eq(
      "literary_works.editorial_status",
      catalog.status
    );
  }

  let selectedWorkQuery = supabase
    .from("literary_works")
    .select(
      "id,legacy_id,title,original_title,first_published,original_language,description,genres,tags,source_url,writer_id,country_id,editorial_status,metadata,updated_at"
    );
  if (requestedWorkId) {
    selectedWorkQuery = UUID_PATTERN.test(requestedWorkId)
      ? selectedWorkQuery.eq("id", requestedWorkId)
      : selectedWorkQuery.eq("legacy_id", requestedWorkId);
  }
  const selectedWorkPromise = requestedWorkId
    ? selectedWorkQuery.maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const selectedEditionPromise = requestedEditionId
    ? supabase
        .from("book_editions")
        .select(
          "id,legacy_id,work_id,title,isbn_10,isbn_13,publisher,publication_year,language,format,page_count,cover_url,cover_source_url,cover_rights_status,license_name,license_url,creator,rights_holder,rights_checked_at,source_url,is_primary,updated_at"
        )
        .eq("id", requestedEditionId)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });
  const [
    { data: worksResult, error: worksError, count: filteredWorksCount },
    { data: editionsResult, error: editionsError, count: filteredEditionsCount },
    { data: workPickerResult, error: workPickerError, count: workPickerCount },
    totalWorksResult,
    totalEditionsResult,
    { count: verifiedEditionCoversCount, error: editionCoversError },
    { count: editorialArtworksCount, error: editorialArtworksCountError },
    { count: primaryEditorialArtworksCount, error: primaryEditorialArtworksCountError },
    selectedWorkResult,
    selectedEditionResult,
  ] = await Promise.all([
    worksCatalogQuery.range(catalog.worksFrom, catalog.worksTo),
    editionsCatalogQuery.range(catalog.editionsFrom, catalog.editionsTo),
    workPickerQuery.range(catalog.workPickerFrom, catalog.workPickerTo),
    supabase.from("literary_works").select("id", { count: "exact", head: true }),
    supabase.from("book_editions").select("id", { count: "exact", head: true }),
    supabase
      .from("book_editions")
      .select("id", { count: "exact", head: true })
      .not("cover_url", "is", null)
      .in("cover_rights_status", [
        "public-domain",
        "licensed",
        "permission",
        "external-preview",
      ]),
    supabase
      .from("literary_work_cover_artworks")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("literary_work_cover_artworks")
      .select("id", { count: "exact", head: true })
      .eq("is_primary", true),
    selectedWorkPromise,
    selectedEditionPromise,
  ]);
  const works = worksResult || [];
  const editions = editionsResult || [];
  const workPickerWorks = workPickerResult || [];
  const worksTotalPages = Math.max(
    1,
    Math.ceil((filteredWorksCount || 0) / LIBRARY_CATALOG_PAGE_SIZE)
  );
  const editionsTotalPages = Math.max(
    1,
    Math.ceil((filteredEditionsCount || 0) / LIBRARY_CATALOG_PAGE_SIZE)
  );
  const workPickerTotalPages = Math.max(
    1,
    Math.ceil((workPickerCount || 0) / LIBRARY_WORK_PICKER_PAGE_SIZE)
  );
  const secondaryEditorialArtworksCount = editorialArtworkSecondaryCount(
    editorialArtworksCount,
    primaryEditorialArtworksCount
  );
  if (
    !worksError &&
    !editionsError &&
    !workPickerError &&
    (catalog.worksPage > worksTotalPages ||
      catalog.editionsPage > editionsTotalPages ||
      catalog.workPickerPage > workPickerTotalPages)
  ) {
    redirect(
      libraryCatalogHref(catalog, {
        worksPage: Math.min(catalog.worksPage, worksTotalPages),
        editionsPage: Math.min(catalog.editionsPage, editionsTotalPages),
        workPickerPage: Math.min(
          catalog.workPickerPage,
          workPickerTotalPages
        ),
        isbn: requestedIsbn,
        workId: requestedWorkId,
        writerId: requestedWriterId,
        countryId: requestedCountryId,
        editionId: requestedEditionId,
      })
    );
  }
  const selectedWork = selectedWorkResult.data;
  const selectedEdition = selectedEditionResult.data;
  const currentEditionWorkResult = selectedEdition
    ? await supabase
        .from("literary_works")
        .select(
          "id,legacy_id,title,original_title,first_published,original_language,description,genres,tags,source_url,writer_id,country_id,editorial_status,metadata"
        )
        .eq("id", selectedEdition.work_id)
        .maybeSingle()
    : { data: null, error: null };
  const writerOverrideResult =
    requestedCountryId && requestedWriterId
      ? await supabase
          .from("writer_profile_overrides")
          .select("id,fields,is_enabled,updated_at")
          .eq("country_id", requestedCountryId)
          .eq("writer_id", requestedWriterId)
          .maybeSingle()
      : { data: null, error: null };
  const writerOverrideFields = objectValue(writerOverrideResult.data?.fields);
  const [
    workTranslationsResult,
    workSourcesResult,
    workExternalIdsResult,
    workImportCandidatesResult,
    workEditorialArtworksResult,
  ] = selectedWork
    ? await Promise.all([
        supabase
          .from("literary_work_translations")
          .select("id,locale,title,description,source_language,translation_method,editorial_status,source_urls,reviewed_at,updated_at")
          .eq("work_id", selectedWork.id)
          .order("locale"),
        supabase
          .from("literary_work_sources")
          .select("id,provider,source_url,field_names,license_name,usage,retrieved_at,updated_at")
          .eq("work_id", selectedWork.id)
          .order("provider")
          .order("id"),
        supabase
          .from("literary_work_external_ids")
          .select("id,scheme,external_id,source_url")
          .eq("work_id", selectedWork.id)
          .order("scheme")
          .order("external_id"),
        supabase
          .from("book_import_candidates")
          .select("id,provider,external_id,title,source_url,quality_score,status,rejection_reasons,promoted_work_id,updated_at")
          .eq("country_id", selectedWork.country_id)
          .eq("writer_id", selectedWork.writer_id)
          .order("quality_score", { ascending: false })
          .order("updated_at", { ascending: false })
          .order("id"),
        supabase
          .from("literary_work_cover_artworks")
          .select(
            "id,cover_url,thumbnail_url,cover_width,cover_height,thumbnail_width,thumbnail_height,rights_status,cover_source_url,rights_checked_at,source_archive_sha256,source_image_sha256,source_filename,source_relative_path,source_index,is_primary,provenance,created_at,updated_at"
          )
          .eq("work_id", selectedWork.id)
          .order("is_primary", { ascending: false })
          .order("source_index")
          .order("id"),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];
  const workOptions = mergeLibraryWorkOptions(
    currentEditionWorkResult.data,
    selectedWork,
    workPickerWorks
  );
  const selectedWriterEntityId =
    requestedCountryId && requestedWriterId
      ? `${requestedCountryId}:${requestedWriterId}`
      : "";
  const schemaError =
    worksError ||
    editionsError ||
    workPickerError ||
    totalWorksResult.error ||
    totalEditionsResult.error ||
    editionCoversError ||
    editorialArtworksCountError ||
    primaryEditorialArtworksCountError ||
    selectedWorkResult.error ||
    selectedEditionResult.error ||
    currentEditionWorkResult.error ||
    writerOverrideResult.error ||
    workTranslationsResult.error ||
    workSourcesResult.error ||
    workExternalIdsResult.error ||
    workImportCandidatesResult.error ||
    workEditorialArtworksResult.error;
  const formContext: LibraryFormContext = {
    catalog,
    isbn: requestedIsbn,
    workId: requestedWorkId,
    writerId: requestedWriterId,
    countryId: requestedCountryId,
    editionId: requestedEditionId,
    entityExpectedUpdatedAt:
      selectedWork?.updated_at || writerOverrideResult.data?.updated_at || "",
  };
  const workspaceContext: LiteraryWorkWorkspaceContext = {
    catalogQ: catalog.term,
    catalogCountry: catalog.country,
    catalogWriter: catalog.writer,
    catalogStatus: catalog.status,
    catalogWorksPage: catalog.worksPage,
    catalogEditionsPage: catalog.editionsPage,
    catalogWorkPickerQ: catalog.workPickerTerm,
    catalogWorkPickerPage: catalog.workPickerPage,
    catalogIsbn: requestedIsbn,
    catalogWorkId: requestedWorkId,
    catalogWriterId: requestedWriterId,
    catalogCountryId: requestedCountryId,
    catalogEditionId: requestedEditionId,
  };
  const pageHref = (overrides: LibraryCatalogHrefOptions = {}) =>
    libraryCatalogHref(catalog, {
      isbn: requestedIsbn,
      workId: requestedWorkId,
      writerId: requestedWriterId,
      countryId: requestedCountryId,
      editionId: requestedEditionId,
      ...overrides,
    });

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Произведение → иллюстрация / точное издание → обложка</span>
          <h1>Книжный архив</h1>
          <Link href="/library/dossiers">Редакционные досье книг</Link>
          <p>
            Обложка издания всегда привязана к точному ISBN, источнику и правам.
            Редакционная иллюстрация хранится отдельно на уровне произведения и не
            считается обложкой конкретного издания.
          </p>
        </div>
      </header>

      {query.error && <p className="form-message">{query.error}</p>}
      {query.notice === "edition-exists" && (
        <p className="form-message" role="status">
          Издание с этим ISBN уже есть в архиве. Открыта существующая запись; её ручные данные не изменены.
        </p>
      )}
      {editionIdDraft && !requestedEditionId && (
        <p className="form-message form-error" role="alert">
          Некорректный идентификатор издания.
        </p>
      )}
      {query.saved && (
        <p className="form-message form-success">
          {query.saved === "entity"
            ? "Изменение сохранено и передано в публикацию."
            : query.saved === "workspace"
              ? "Редакционная запись произведения сохранена."
              : "Издание сохранено."}
        </p>
      )}
      {schemaError && (
        <p className="form-message">
          Книжные таблицы ещё не применены в Supabase. Выполните миграции
          20260730_literary_archive.sql, 20260808_book_translations_and_import_staging.sql
          и 20260820_literary_work_cover_artworks.sql,
          затем синхронизируйте countries.
        </p>
      )}
      {query.published === "started" && (
        <p className="form-message form-success">
          Публичная сборка с обновлённым изданием запущена.
        </p>
      )}
      {query.published === "queued" && (
        <p className="form-message form-success">
          Обновление издания поставлено в очередь публикации.
        </p>
      )}
      {query.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Изменение сохранено, но запрос публикации записать не удалось. Повторите публикацию позже.
        </p>
      )}

      {(requestedWorkId || requestedWriterId || requestedCountryId) && (
        <section className="panel visual-entity-context">
          <div>
            <span className="eyebrow">Переход из визуального редактора</span>
            <h2>
              {requestedWorkId
                ? "Выбранная книга"
                : "Произведения выбранного писателя"}
            </h2>
            <p>
              Найдено записей: {(filteredWorksCount || 0).toLocaleString("ru-RU")}. Фильтр
              использует постоянные идентификаторы страны, автора и произведения.
            </p>
          </div>
          <Link className="button-secondary" href="/library">
            Показать весь архив
          </Link>
        </section>
      )}

      {selectedWork && (
        <section className="panel visual-entity-editor">
          <header>
            <div>
              <span className="eyebrow">Редактор произведения</span>
              <h2>{selectedWork.title}</h2>
              <p>
                Каждое поле сохраняется отдельно, получает запись в истории и
                сразу ставит публичную сборку в очередь.
              </p>
            </div>
            <span className="badge">{selectedWork.legacy_id}</span>
          </header>
          <div className="visual-entity-fields">
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="title"
              label="Название"
              value={selectedWork.title}
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="originalTitle"
              label="Название на языке оригинала"
              value={selectedWork.original_title || ""}
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="firstPublished"
              label="Год первой публикации"
              value={selectedWork.first_published?.toString() || ""}
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="originalLanguage"
              label="Язык оригинала"
              value={selectedWork.original_language || ""}
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="description"
              label="Описание"
              value={selectedWork.description || ""}
              multiline
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="genres"
              label="Жанры"
              value={(selectedWork.genres || []).join("\n")}
              multiline
              hint="Один жанр в строке."
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="tags"
              label="Теги"
              value={(selectedWork.tags || []).join("\n")}
              multiline
              hint="Один тег в строке."
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="sourceUrl"
              label="Источник сведений"
              value={selectedWork.source_url || ""}
              hint="HTTPS-адрес проверяемого источника."
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="book"
              entityId={selectedWork.legacy_id}
              field="editorialStatus"
              label="Статус публикации"
              value={selectedWork.editorial_status}
              hint="draft, reviewed или verified."
            />
          </div>
        </section>
      )}

      {selectedWork && (
        <section
          className="panel editorial-artwork-panel"
          aria-labelledby="editorial-artworks-heading"
        >
          <div className="library-catalog-heading">
            <div>
              <span className="eyebrow">Отдельно от изданий и ISBN</span>
              <h2 id="editorial-artworks-heading">Редакционные иллюстрации «{selectedWork.title}»</h2>
              <p>
                Это визуальные материалы карточки произведения, а не обложки
                издательских тиражей. Данные показаны только для проверки: их
                происхождение неизменяемо.
              </p>
            </div>
            <span className="badge">
              {(workEditorialArtworksResult.data || []).length.toLocaleString("ru-RU")} шт.
            </span>
          </div>

          {workEditorialArtworksResult.error ? (
            <p className="form-message form-error" role="alert">
              Не удалось загрузить редакционные иллюстрации: {workEditorialArtworksResult.error.message}
            </p>
          ) : (workEditorialArtworksResult.data || []).length ? (
            <div className="editorial-artwork-grid">
              {(workEditorialArtworksResult.data || []).map((artwork) => {
                const previewUrl =
                  editorialArtworkAssetUrl(
                    artwork.thumbnail_url,
                    adminEnv.publicSiteUrl
                  ) ||
                  editorialArtworkAssetUrl(
                    artwork.cover_url,
                    adminEnv.publicSiteUrl
                  );
                const fullSizeUrl = editorialArtworkAssetUrl(
                  artwork.cover_url,
                  adminEnv.publicSiteUrl
                );
                const sourceUrl = editorialArtworkAssetUrl(
                  artwork.cover_source_url,
                  adminEnv.publicSiteUrl
                );
                const provenance = editorialArtworkProvenanceView(
                  artwork.provenance
                );
                return (
                  <article className="editorial-artwork-card" key={artwork.id}>
                    <div className="editorial-artwork-preview">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt={`Редакционная иллюстрация «${selectedWork.title}»`}
                          loading="lazy"
                        />
                      ) : (
                        <span>Предпросмотр недоступен</span>
                      )}
                    </div>
                    <div className="editorial-artwork-copy">
                      <header>
                        <div>
                          <span className="eyebrow">
                            Файл №{artwork.source_index.toLocaleString("ru-RU")}
                          </span>
                          <h3>{artwork.source_filename}</h3>
                        </div>
                        <span className="badge">
                          {artwork.is_primary ? "Основная" : "Дополнительная"}
                        </span>
                      </header>
                      <dl className="editorial-artwork-facts">
                        <div>
                          <dt>Размер</dt>
                          <dd>{artwork.cover_width} × {artwork.cover_height} px</dd>
                        </div>
                        <div>
                          <dt>Статус прав</dt>
                          <dd>{artwork.rights_status}</dd>
                        </div>
                        <div>
                          <dt>Права проверены</dt>
                          <dd><time dateTime={artwork.rights_checked_at}>{artwork.rights_checked_at}</time></dd>
                        </div>
                        <div>
                          <dt>Путь в архиве</dt>
                          <dd>{artwork.source_relative_path}</dd>
                        </div>
                      </dl>
                      <div className="editorial-artwork-links">
                        {fullSizeUrl && (
                          <a href={fullSizeUrl} target="_blank" rel="noreferrer">
                            Открыть полный размер
                          </a>
                        )}
                        {sourceUrl && sourceUrl !== fullSizeUrl && (
                          <a href={sourceUrl} target="_blank" rel="noreferrer">
                            Открыть зафиксированный источник
                          </a>
                        )}
                      </div>
                      <details className="editorial-artwork-provenance">
                        <summary>Происхождение и хеши</summary>
                        <dl>
                          <div>
                            <dt>Тип источника</dt>
                            <dd>{provenance.kind || "-"}</dd>
                          </div>
                          <div>
                            <dt>Основание сопоставления</dt>
                            <dd>{provenance.matchBasis || "-"}</dd>
                          </div>
                          <div>
                            <dt>SHA-256 архива</dt>
                            <dd><code title={artwork.source_archive_sha256}>{editorialArtworkDigest(artwork.source_archive_sha256)}</code></dd>
                          </div>
                          <div>
                            <dt>SHA-256 исходника</dt>
                            <dd><code title={artwork.source_image_sha256}>{editorialArtworkDigest(artwork.source_image_sha256)}</code></dd>
                          </div>
                        </dl>
                        {provenance.sourceEvidence && (
                          <p>Свидетельство: {provenance.sourceEvidence}</p>
                        )}
                        {provenance.note && <p>{provenance.note}</p>}
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <p>Для этого произведения редакционные иллюстрации не загружены.</p>
            </div>
          )}
        </section>
      )}

      {selectedWork && !workTranslationsResult.error && !workSourcesResult.error && !workExternalIdsResult.error && !workImportCandidatesResult.error && (
        <LiteraryWorkWorkspace
          work={{ id: selectedWork.id, title: selectedWork.title }}
          translations={workTranslationsResult.data || []}
          sources={workSourcesResult.data || []}
          externalIds={workExternalIdsResult.data || []}
          candidates={workImportCandidatesResult.data || []}
          context={workspaceContext}
        />
      )}

      {selectedWriterEntityId && !selectedWork && (
        <section className="panel visual-entity-editor">
          <header>
            <div>
              <span className="eyebrow">Редактор писателя</span>
              <h2>{textValue(writerOverrideFields.name) || requestedWriterId}</h2>
              <p>
                Здесь показаны редакционные переопределения. Пустое поле ещё не
                заменяет исходные сведения из базы countries.
              </p>
            </div>
            <span className="badge">{selectedWriterEntityId}</span>
          </header>
          <div className="visual-entity-fields">
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="writer"
              entityId={selectedWriterEntityId}
              field="name"
              label="Имя"
              value={textValue(writerOverrideFields.name)}
            />
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="writer"
              entityId={selectedWriterEntityId}
              field="years"
              label="Годы жизни"
              value={textValue(writerOverrideFields.years)}
            />
            <p className="editorial-note">
              Портрет и его атрибуция публикуются только из проверенного каталога
              и недоступны для быстрой раздельной правки.
            </p>
            <VisualEntityFieldForm
              formContext={formContext}
              entityType="writer"
              entityId={selectedWriterEntityId}
              field="awards"
              label="Премии и награды"
              value={listValue(writerOverrideFields.awards)}
              multiline
              hint="Одна награда в строке."
            />
          </div>
          <div className="editor-actions">
            <Link
              className="button"
              href={`/editorial-database?country_id=${encodeURIComponent(requestedCountryId)}&writer_id=${encodeURIComponent(requestedWriterId)}`}
            >
              Открыть полный профиль автора
            </Link>
            <span className="form-message">
              Полная биография, произведения, источники и остальные поля доступны
              в единой базе стран и авторов.
            </span>
          </div>
        </section>
      )}

      <section className="stats-grid library-stats-grid">
        <article className="stat-card">
          <span>Произведения</span>
          <strong>{(totalWorksResult.count || 0).toLocaleString("ru-RU")}</strong>
          <small>из единой структуры countries</small>
        </article>
        <article className="stat-card">
          <span>Точные издания</span>
          <strong>{(totalEditionsResult.count || 0).toLocaleString("ru-RU")}</strong>
          <small>с отдельными ISBN</small>
        </article>
        <article className="stat-card">
          <span>Обложки точных изданий</span>
          <strong>{(verifiedEditionCoversCount || 0).toLocaleString("ru-RU")}</strong>
          <small>источник и права подтверждены; отдельно от иллюстраций</small>
        </article>
        <article className="stat-card">
          <span>Редакционные иллюстрации</span>
          <strong>{(editorialArtworksCount || 0).toLocaleString("ru-RU")}</strong>
          <small>
            {(primaryEditorialArtworksCount || 0).toLocaleString("ru-RU")} основных ·{" "}
            {secondaryEditorialArtworksCount.toLocaleString("ru-RU")} дополнительных
          </small>
        </article>
        <article className="stat-card">
          <span>Принцип импорта</span>
          <strong>ISBN</strong>
          <small>только точное совпадение</small>
        </article>
      </section>

      <section className="panel library-catalog" style={{ marginTop: 18 }}>
        <div className="library-catalog-heading">
          <div>
            <span className="eyebrow">Полный архив без обрезки</span>
            <h2>Фильтры произведений и изданий</h2>
            <p>
              Название ищется на сервере; страна, автор и статус применяются
              только как проверенные точные фильтры.
            </p>
          </div>
          {(catalog.term || catalog.country || catalog.writer || catalog.status) && (
            <Link className="button-secondary" href="/library">Сбросить фильтры</Link>
          )}
        </div>
        <form className="library-catalog-filters" method="get">
          {requestedIsbn && <input type="hidden" name="isbn" value={requestedIsbn} />}
          {requestedWorkId && <input type="hidden" name="work_id" value={requestedWorkId} />}
          {requestedWriterId && <input type="hidden" name="writer_id" value={requestedWriterId} />}
          {requestedCountryId && <input type="hidden" name="country_id" value={requestedCountryId} />}
          {requestedEditionId && <input type="hidden" name="edition_id" value={requestedEditionId} />}
          <label className="field library-catalog-query">
            <span>Название произведения или издания</span>
            <input name="q" type="search" maxLength={120} defaultValue={catalog.term} placeholder="Например, Война и мир" />
          </label>
          <label className="field">
            <span>ID страны</span>
            <input name="country" maxLength={120} defaultValue={catalog.country} placeholder="russia" />
          </label>
          <label className="field">
            <span>ID автора</span>
            <input name="writer" maxLength={180} defaultValue={catalog.writer} placeholder="leo-tolstoy" />
          </label>
          <label className="field">
            <span>Статус произведения</span>
            <select name="status" defaultValue={catalog.status}>
              <option value="">Все статусы</option>
              {Object.entries(libraryEditorialStatuses).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">Применить</button>
        </form>
      </section>

      <section className="panel library-catalog" style={{ marginTop: 18 }}>
        <div className="library-catalog-heading">
          <div>
            <span className="eyebrow">Каталог произведений</span>
            <h2>Все произведения</h2>
            <p>Найдено: {(filteredWorksCount || 0).toLocaleString("ru-RU")}</p>
          </div>
        </div>
        {worksError ? (
          <p className="form-message">Не удалось загрузить произведения: {worksError.message}</p>
        ) : works.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Произведение</th>
                  <th>Автор / страна</th>
                  <th>Год</th>
                  <th>Статус</th>
                  <th>Ред. иллюстрации</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {works.map((work) => {
                  const metadata = objectValue(work.metadata);
                  return (
                    <tr key={work.id}>
                      <td className="data-title">
                        <strong>{work.title}</strong>
                        <small>{work.original_title || work.legacy_id}</small>
                      </td>
                      <td className="data-title">
                        <strong>{textValue(metadata.writerName) || work.writer_id}</strong>
                        <small>{textValue(metadata.countryName) || work.country_id}</small>
                      </td>
                      <td>{work.first_published ?? "-"}</td>
                      <td><span className="badge">{work.editorial_status}</span></td>
                      <td>
                        <span className="badge">
                          {editorialArtworkCountFromRelation(
                            work.literary_work_cover_artworks
                          ).toLocaleString("ru-RU")}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="button-secondary"
                          href={pageHref({
                            isbn: "",
                            workId: work.legacy_id,
                            writerId: work.writer_id,
                            countryId: work.country_id,
                            editionId: "",
                          })}
                        >
                          Редактировать
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><p>Произведения по этим фильтрам не найдены.</p></div>
        )}
        <CatalogPagination
          label="Страницы произведений"
          page={catalog.worksPage}
          totalPages={worksTotalPages}
          href={(worksPage) => pageHref({ worksPage })}
        />
      </section>

      <div className="dashboard-grid">
        <section className="panel settings-stack">
          <div>
            <span className="eyebrow">Без угадывания по названию</span>
            <h2>Найти конкретное издание</h2>
            <p>
              Введите ISBN-10 или ISBN-13 с самой книги. Система проверит
              контрольную цифру, найдёт точное совпадение и покажет данные до
              сохранения.
            </p>
          </div>
          <form className="isbn-search" method="get">
            {catalog.term && <input type="hidden" name="q" value={catalog.term} />}
            {catalog.country && <input type="hidden" name="country" value={catalog.country} />}
            {catalog.writer && <input type="hidden" name="writer" value={catalog.writer} />}
            {catalog.status && <input type="hidden" name="status" value={catalog.status} />}
            {catalog.worksPage > 1 && <input type="hidden" name="works_page" value={catalog.worksPage} />}
            {catalog.editionsPage > 1 && <input type="hidden" name="editions_page" value={catalog.editionsPage} />}
            <label className="field">
              <span>ISBN</span>
              <input
                name="isbn"
                defaultValue={requestedIsbn}
                inputMode="numeric"
                placeholder="978517..."
                minLength={10}
                maxLength={20}
                required
              />
            </label>
            <button className="button" type="submit">
              Проверить издание
            </button>
          </form>
          <div className="editorial-note">
            <strong>Почему так безопаснее</strong>
            <p>
              Поиск по одному названию часто возвращает иностранный перевод,
              переиздание или фанатское изображение. ISBN однозначно связывает
              обложку с конкретным издателем и годом.
            </p>
          </div>
        </section>

        <section className="panel">
          <h2>Редакционная политика обложек</h2>
          <div className="status-list">
            <div>
              <span>Редакционная иллюстрация «Пробы Пера»</span>
              <strong>Не считается обложкой издания</strong>
            </div>
            <div>
              <span>Open Library по точному ISBN</span>
              <strong>Внешнее превью</strong>
            </div>
            <div>
              <span>Обложка без источника</span>
              <strong>Не публикуется</strong>
            </div>
            <div>
              <span>Портреты писателей</span>
              <strong>Только реальные</strong>
            </div>
          </div>
        </section>
      </div>

      {requestedIsbn && !candidate && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="empty-state">
            <p>
              Точное издание не найдено либо ISBN не прошёл контрольную
              проверку. Никакая приблизительная обложка подставлена не будет.
            </p>
          </div>
        </section>
      )}

      {(candidate || selectedEdition) && (
        <section className="panel library-catalog" style={{ marginTop: 18 }}>
          <div className="library-catalog-heading">
            <div>
              <span className="eyebrow">Весь каталог произведений</span>
              <h2>Найти произведение для привязки</h2>
              <p>
                Поиск не зависит от фильтров таблицы и охватывает весь архив.
                Найдено: {(workPickerCount || 0).toLocaleString("ru-RU")}.
              </p>
            </div>
            {catalog.workPickerTerm && (
              <Link
                className="button-secondary"
                href={pageHref({ workPickerTerm: "", workPickerPage: 1 })}
              >
                Сбросить поиск
              </Link>
            )}
          </div>
          <form className="library-catalog-filters" method="get">
            {catalog.term && <input type="hidden" name="q" value={catalog.term} />}
            {catalog.country && <input type="hidden" name="country" value={catalog.country} />}
            {catalog.writer && <input type="hidden" name="writer" value={catalog.writer} />}
            {catalog.status && <input type="hidden" name="status" value={catalog.status} />}
            {catalog.worksPage > 1 && <input type="hidden" name="works_page" value={catalog.worksPage} />}
            {catalog.editionsPage > 1 && <input type="hidden" name="editions_page" value={catalog.editionsPage} />}
            {requestedIsbn && <input type="hidden" name="isbn" value={requestedIsbn} />}
            {requestedWorkId && <input type="hidden" name="work_id" value={requestedWorkId} />}
            {requestedWriterId && <input type="hidden" name="writer_id" value={requestedWriterId} />}
            {requestedCountryId && <input type="hidden" name="country_id" value={requestedCountryId} />}
            {requestedEditionId && <input type="hidden" name="edition_id" value={requestedEditionId} />}
            <label className="field library-catalog-query">
              <span>Название произведения</span>
              <input
                name="work_picker_q"
                type="search"
                maxLength={120}
                defaultValue={catalog.workPickerTerm}
                placeholder="Например, Мастер и Маргарита"
              />
              <small>Можно вводить полное название или его часть.</small>
            </label>
            <button className="button" type="submit">Найти во всём архиве</button>
          </form>
          {workPickerError && (
            <p className="form-message form-error" role="alert">
              Поиск произведений недоступен: {workPickerError.message}
            </p>
          )}
          <CatalogPagination
            label="Страницы поиска произведения для привязки"
            page={catalog.workPickerPage}
            totalPages={workPickerTotalPages}
            href={(workPickerPage) => pageHref({ workPickerPage })}
          />
        </section>
      )}

      {candidate && (
        <section className="panel isbn-candidate" style={{ marginTop: 18 }}>
          <div className="isbn-candidate-cover">
            {candidate.coverUrl ? (
              <img
                src={candidate.coverUrl}
                alt={`Обложка точного издания «${candidate.title}»`}
              />
            ) : (
              <span>Обложка в Open Library не найдена</span>
            )}
          </div>
          <div className="isbn-candidate-copy">
            <span className="eyebrow">Совпадение ISBN подтверждено</span>
            <h2>{candidate.title}</h2>
            {candidate.subtitle && <p>{candidate.subtitle}</p>}
            <dl className="edition-facts">
              <div>
                <dt>Автор</dt>
                <dd>{candidate.authors.join(", ") || "Не указан"}</dd>
              </div>
              <div>
                <dt>Издатель</dt>
                <dd>{candidate.publisher || "Не указан"}</dd>
              </div>
              <div>
                <dt>Дата издания</dt>
                <dd>{candidate.publishedDate || "Не указана"}</dd>
              </div>
              <div>
                <dt>ISBN</dt>
                <dd>{candidate.isbn13 || candidate.isbn10}</dd>
              </div>
            </dl>
            <form
              className="settings-stack edition-save-form"
              action={saveBookEditionAction}
            >
              <LibraryActionContextFields {...formContext} />
              <label className="field">
                <span>Связать с произведением</span>
                <select name="work_id" required defaultValue={selectedWork?.id || ""}>
                  <option value="" disabled>
                    Выберите произведение
                  </option>
                  {workOptions.map((work) => {
                    const metadata =
                      work.metadata && typeof work.metadata === "object"
                        ? (work.metadata as Record<string, string>)
                        : {};
                    return (
                      <option key={work.id} value={work.id}>
                        {work.title} - {metadata.writerName || work.writer_id} · {work.legacy_id}
                      </option>
                    );
                  })}
                </select>
              </label>
              <input type="hidden" name="title" value={candidate.title} />
              <input
                type="hidden"
                name="isbn_10"
                value={candidate.isbn10 || ""}
              />
              <input
                type="hidden"
                name="isbn_13"
                value={candidate.isbn13 || ""}
              />
              <input
                type="hidden"
                name="publisher"
                value={candidate.publisher}
              />
              <input
                type="hidden"
                name="publication_year"
                value={candidate.publicationYear || ""}
              />
              <input
                type="hidden"
                name="language"
                value={candidate.language}
              />
              <input
                type="hidden"
                name="page_count"
                value={candidate.pageCount || ""}
              />
              <input
                type="hidden"
                name="cover_url"
                value={candidate.coverUrl || ""}
              />
              <input
                type="hidden"
                name="cover_source_url"
                value={candidate.coverUrl ? candidate.openLibraryUrl : ""}
              />
              <input
                type="hidden"
                name="source_url"
                value={candidate.googleBooksUrl || candidate.openLibraryUrl}
              />
              <label className="check-field">
                <input type="checkbox" name="is_primary" />
                <span>Сделать основным изданием произведения</span>
              </label>
              <button className="button" type="submit" disabled={!workOptions.length}>
                Сохранить точное издание
              </button>
            </form>
          </div>
        </section>
      )}

      {requestedEditionId && !selectedEdition && !selectedEditionResult.error && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="empty-state">
            <p>Издание не найдено или было удалено.</p>
            <Link className="button-secondary" href={pageHref({ editionId: "" })}>
              Вернуться к списку
            </Link>
          </div>
        </section>
      )}

      {selectedEdition && (
        <section id="edition-editor" className="panel edition-editor" style={{ marginTop: 18 }}>
          <header>
            <div>
              <span className="eyebrow">Точное издание</span>
              <h2>Редактировать «{selectedEdition.title}»</h2>
              <p>
                Сохранение создаёт снимок предыдущей версии, запись аудита и
                сразу запускает публикацию сайта.
              </p>
            </div>
            <div className="editor-actions">
              <span className="badge">{selectedEdition.legacy_id}</span>
              <Link className="button-secondary" href={pageHref({ editionId: "" })}>
                Закрыть
              </Link>
            </div>
          </header>

          <form className="settings-stack edition-edit-form" action={updateBookEditionAction}>
            <LibraryActionContextFields {...formContext} />
            <input type="hidden" name="edition_id" value={selectedEdition.id} />
            <input type="hidden" name="expected_updated_at" value={selectedEdition.updated_at} />
            <fieldset>
              <legend>Издание и ISBN</legend>
              <div className="edition-edit-grid">
                <label className="field edition-edit-wide">
                  <span>Произведение</span>
                  <select name="work_id" defaultValue={selectedEdition.work_id} required>
                    {!workOptions.some((work) => work.id === selectedEdition.work_id) && (
                      <option value={selectedEdition.work_id}>
                        Текущее произведение · {selectedEdition.work_id}
                      </option>
                    )}
                    {workOptions.map((work) => {
                      const metadata = objectValue(work.metadata);
                      return (
                        <option key={work.id} value={work.id}>
                          {work.title} - {textValue(metadata.writerName) || work.writer_id} · {work.legacy_id}
                        </option>
                      );
                    })}
                  </select>
                  <small>
                    Текущее произведение всегда остаётся в списке. Поиск выше
                    работает по всему архиву, независимо от страницы таблицы.
                  </small>
                </label>
                <label className="field edition-edit-wide">
                  <span>Название этого издания</span>
                  <input name="title" defaultValue={selectedEdition.title} maxLength={300} required />
                </label>
                <label className="field">
                  <span>ISBN-10</span>
                  <input name="isbn_10" defaultValue={selectedEdition.isbn_10 || ""} maxLength={32} inputMode="text" />
                </label>
                <label className="field">
                  <span>ISBN-13</span>
                  <input name="isbn_13" defaultValue={selectedEdition.isbn_13 || ""} maxLength={32} inputMode="numeric" />
                </label>
                <label className="field">
                  <span>Издатель</span>
                  <input name="publisher" defaultValue={selectedEdition.publisher} maxLength={240} />
                </label>
                <label className="field">
                  <span>Год издания</span>
                  <input name="publication_year" type="number" min={1400} max={2100} defaultValue={selectedEdition.publication_year || ""} />
                </label>
                <label className="field">
                  <span>Язык</span>
                  <input name="language" defaultValue={selectedEdition.language} maxLength={120} />
                </label>
                <label className="field">
                  <span>Формат</span>
                  <input name="format" defaultValue={selectedEdition.format} maxLength={120} placeholder="Твёрдый переплёт" />
                </label>
                <label className="field">
                  <span>Количество страниц</span>
                  <input name="page_count" type="number" min={1} max={100000} defaultValue={selectedEdition.page_count || ""} />
                </label>
                <label className="check-field edition-edit-primary">
                  <input name="is_primary" type="checkbox" defaultChecked={selectedEdition.is_primary} />
                  <span>Основное издание этого произведения</span>
                </label>
              </div>
              <small>Хотя бы один ISBN обязателен и проверяется по контрольной цифре.</small>
            </fieldset>

            <fieldset>
              <legend>Обложка, источник и права</legend>
              <div className="edition-edit-grid">
                {selectedEdition.cover_url && (
                  <div className="edition-edit-cover">
                    <img src={selectedEdition.cover_url} alt={`Обложка «${selectedEdition.title}»`} />
                  </div>
                )}
                <label className="field edition-edit-wide">
                  <span>HTTPS-адрес обложки</span>
                  <input name="cover_url" type="url" defaultValue={selectedEdition.cover_url || ""} maxLength={2000} />
                </label>
                <label className="field edition-edit-wide">
                  <span>Страница - источник обложки</span>
                  <input name="cover_source_url" type="url" defaultValue={selectedEdition.cover_source_url || ""} maxLength={2000} />
                </label>
                <label className="field">
                  <span>Статус прав</span>
                  <select name="cover_rights_status" defaultValue={selectedEdition.cover_rights_status}>
                    {bookEditionRightsStatuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Дата проверки прав</span>
                  <input name="rights_checked_at" type="date" defaultValue={selectedEdition.rights_checked_at || ""} />
                </label>
                <label className="field">
                  <span>Название лицензии</span>
                  <input name="license_name" defaultValue={selectedEdition.license_name} maxLength={240} />
                </label>
                <label className="field">
                  <span>Ссылка на лицензию</span>
                  <input name="license_url" type="url" defaultValue={selectedEdition.license_url || ""} maxLength={2000} />
                </label>
                <label className="field">
                  <span>Автор изображения</span>
                  <input name="creator" defaultValue={selectedEdition.creator} maxLength={240} />
                </label>
                <label className="field">
                  <span>Правообладатель</span>
                  <input name="rights_holder" defaultValue={selectedEdition.rights_holder} maxLength={240} />
                </label>
              </div>
              <small>
                Обложка публикуется только вместе с HTTPS-источником,
                подтверждённым статусом прав и датой проверки.
              </small>
            </fieldset>

            <fieldset>
              <legend>Источник сведений</legend>
              <label className="field">
                <span>Страница каталога или издателя</span>
                <input name="source_url" type="url" defaultValue={selectedEdition.source_url || ""} maxLength={2000} />
              </label>
            </fieldset>

            <div className="editor-actions">
              <button className="button" type="submit">
                Сохранить, записать версию и опубликовать
              </button>
              <Link className="button-secondary" href="/history">
                Открыть историю версий
              </Link>
            </div>
          </form>
        </section>
      )}

      <section className="panel library-catalog" style={{ marginTop: 18 }}>
        <div className="library-catalog-heading">
          <div>
            <span className="eyebrow">Каталог точных изданий</span>
            <h2>Все издания</h2>
            <p>Найдено: {(filteredEditionsCount || 0).toLocaleString("ru-RU")}</p>
          </div>
        </div>
        {editionsError ? (
          <p className="form-message">Не удалось загрузить издания: {editionsError.message}</p>
        ) : editions.length ? (
          <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Произведение / издание</th>
                <th>ISBN</th>
                <th>Издатель</th>
                <th>Обложка</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {editions.map((edition) => {
                const work = Array.isArray(edition.literary_works)
                  ? edition.literary_works[0]
                  : edition.literary_works;
                return (
                  <tr key={edition.id}>
                    <td className="data-title">
                      <strong>{work?.title || edition.title}</strong>
                      <small>
                        {edition.publication_year || "год не указан"} ·{" "}
                        {edition.language || "язык не указан"}
                      </small>
                    </td>
                    <td>{edition.isbn_13 || edition.isbn_10 || "-"}</td>
                    <td>{edition.publisher || "-"}</td>
                    <td>
                      <span className="badge">
                        {edition.cover_url
                          ? edition.cover_rights_status
                          : "нет обложки"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="button-secondary"
                        href={pageHref({ isbn: "", workId: "", writerId: "", countryId: "", editionId: edition.id })}
                      >
                        Редактировать
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>Точные издания по этим фильтрам не найдены.</p>
          </div>
        )}
        <CatalogPagination
          label="Страницы изданий"
          page={catalog.editionsPage}
          totalPages={editionsTotalPages}
          href={(editionsPage) => pageHref({ editionsPage })}
        />
      </section>
    </>
  );
}
