import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Load the real library page, workspace and read helpers. Only external reads,
// framework navigation and server-action/submit-control boundaries are mocked.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const sourceFile = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const privateError = "PRIVATE_LIBRARY_PROVIDER_SECRET=never-render-this-fixture";
const timestamp = "2026-09-23T12:00:00.123456+00:00";
const workId = "aaaa1111-bbbb-4ccc-8ddd-eeee11111111";
const editionId = "bbbb2222-cccc-4ddd-8eee-ffff22222222";
const rowId = "cccc3333-dddd-4eee-8fff-aaaa33333333";
const work = {
  id: workId, legacy_id: "fixture-country:fixture-writer:fixture-work", title: "Original work\u2014unchanged",
  original_title: "  Exact original  ", first_published: 1923, original_language: "ru",
  description: "  Exact author description\u2014unchanged.\nSecond line.  ", genres: ["Exact genre"], tags: ["Exact tag"],
  source_url: "https://example.org/source", writer_id: "fixture-writer", country_id: "fixture-country", editorial_status: "verified",
  metadata: { writerName: "Exact writer", countryName: "Exact country" }, updated_at: timestamp,
  literary_work_cover_artworks: [{ count: 2 }],
};
const edition = {
  id: editionId, legacy_id: "isbn:9780140328721", work_id: workId, title: "Exact edition\u2014unchanged",
  isbn_10: "0140328726", isbn_13: "9780140328721", publisher: "Exact publisher", publication_year: 2001, language: "ru", format: "Exact format", page_count: 208,
  cover_url: "https://example.org/exact-cover.jpg", cover_source_url: "https://example.org/cover-source", cover_rights_status: "permission",
  license_name: "Exact license", license_url: "https://example.org/license", creator: "Exact creator", rights_holder: "Exact holder", rights_checked_at: "2026-09-23",
  source_url: "https://example.org/edition", is_primary: true, updated_at: timestamp, literary_works: work,
};
const writer = { id: rowId, country_id: work.country_id, writer_id: work.writer_id, fields: { name: "Exact writer", years: "1900-1980", awards: ["Exact award"] }, is_enabled: true, updated_at: timestamp };
const translation = { id: rowId, work_id: workId, locale: "ru", title: "Exact RU title\u2014unchanged", description: "  Exact RU text\u2014unchanged.\nSecond line.  ", source_language: "ru", translation_method: "editorial-original", editorial_status: "verified", source_urls: ["https://example.org/source"], reviewed_at: "2026-09-23", updated_at: timestamp };
const english = { ...translation, id: "dddd4444-eeee-4fff-8aaa-bbbb44444444", locale: "en", title: "Exact EN title\u2014unchanged", description: "  Exact English\u2014unchanged.\nSecond line.  ", translation_method: "human-translation" };
const source = { id: rowId, work_id: workId, provider: "fixture", source_url: "https://example.org/source", field_names: ["title", "description"], license_name: null, usage: "reference-only", retrieved_at: "2026-09-23", updated_at: timestamp };
const external = { id: rowId, work_id: workId, scheme: "openlibrary", external_id: "OL123W", source_url: "https://example.org/catalog" };
const candidate = { id: rowId, country_id: work.country_id, writer_id: work.writer_id, provider: "fixture", external_id: "fixture-book", title: "Exact discovery", source_url: "https://example.org/candidate", quality_score: 85, status: "candidate", rejection_reasons: [], promoted_work_id: null, updated_at: timestamp };
const artwork = {
  id: rowId, work_id: workId, cover_url: "brand/book-covers/fixture.webp", thumbnail_url: "brand/book-covers/thumbs/fixture.webp", cover_width: 600, cover_height: 900, thumbnail_width: 200, thumbnail_height: 300,
  rights_status: "editorial-original", cover_source_url: "https://example.org/artwork", rights_checked_at: "2026-09-23", source_archive_sha256: "a".repeat(64), source_image_sha256: "b".repeat(64),
  source_filename: "Exact source.webp", source_relative_path: "Exact source.webp", source_index: 1, is_primary: true,
  provenance: { kind: "user-supplied", archiveSha256: "a".repeat(64), imageSha256: "b".repeat(64), note: "Exact rights evidence" }, created_at: timestamp, updated_at: timestamp,
};
const isbnCandidate = { isbn10: edition.isbn_10, isbn13: edition.isbn_13, title: "Exact found edition", subtitle: "Exact subtitle", authors: ["Exact writer"], publisher: edition.publisher, publishedDate: "2001", publicationYear: 2001, language: "ru", pageCount: 208, googleBooksUrl: "https://example.org/volume", openLibraryUrl: "https://openlibrary.org/isbn/9780140328721", coverUrl: edition.cover_url };
const keys = ["works", "editions", "picker", "totalWorks", "totalEditions", "editionCovers", "artCount", "primaryArtCount", "selectedWork", "selectedEdition", "currentWork", "writer", "translations", "sources", "external", "candidates", "artworks"] as const;
type QueryKey = typeof keys[number];
type Response = { data?: unknown; count?: unknown; error?: unknown };
class RedirectSignal extends Error { constructor(public href: string) { super("NEXT_REDIRECT"); } }

function fixture(options: { responses?: Partial<Record<QueryKey, Response>>; rejected?: QueryKey[]; noClient?: boolean; clientSignal?: Error; isbnCandidate?: unknown; isbnError?: Error; reviewError?: boolean } = {}) {
  const defaults: Record<QueryKey, Response> = {
    works: { data: [work], count: 23, error: null }, editions: { data: [edition], count: 17, error: null }, picker: { data: [work], count: 23, error: null },
    totalWorks: { data: null, count: 23, error: null }, totalEditions: { data: null, count: 17, error: null }, editionCovers: { data: null, count: 10, error: null }, artCount: { data: null, count: 6, error: null }, primaryArtCount: { data: null, count: 4, error: null },
    selectedWork: { data: work, error: null }, selectedEdition: { data: edition, error: null }, currentWork: { data: work, error: null }, writer: { data: writer, error: null },
    translations: { data: [translation, english], error: null }, sources: { data: [source], error: null }, external: { data: [external], error: null }, candidates: { data: [candidate], error: null }, artworks: { data: [artwork], error: null },
  };
  const reads = vi.fn();
  const from = vi.fn((table: string) => {
    let key: QueryKey = ({ literary_works: "works", book_editions: "editions", writer_profile_overrides: "writer", literary_work_translations: "translations", literary_work_sources: "sources", literary_work_external_ids: "external", book_import_candidates: "candidates", literary_work_cover_artworks: "artworks" } as const)[table as "literary_works"];
    if (!key) throw new Error(`Unexpected table ${table}`);
    const filters: Array<[string, unknown]> = [];
    let selection = "";
    const query = {
      select: (columns: string, config?: { head?: boolean; count?: string }) => {
        selection = columns;
        if (table === "literary_works") key = config?.head ? "totalWorks" : config?.count ? columns.includes("cover_artworks(count)") ? "works" : "picker" : columns.includes("updated_at") ? "selectedWork" : "currentWork";
        if (table === "book_editions") key = config?.head ? "totalEditions" : config?.count ? "editions" : "selectedEdition";
        if (table === "literary_work_cover_artworks") key = config?.head ? "artCount" : "artworks";
        return query;
      },
      eq: (field: string, value: unknown) => { filters.push([field, value]); if (table === "literary_work_cover_artworks" && field === "is_primary") key = "primaryArtCount"; return query; },
      not: () => { if (table === "book_editions") key = "editionCovers"; return query; },
      order: () => query, ilike: () => query, in: () => query, range: () => query, maybeSingle: () => query,
      then: (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        reads({ key, selection, filters });
        if (options.rejected?.includes(key)) throw new TypeError(privateError);
        return options.responses?.[key] || defaults[key];
      }).then(fulfilled, rejected),
    };
    return query;
  });
  const names = ["saveBookEditionAction", "updateBookEditionAction", "saveVisualEntityFieldFormAction", "saveWorkTranslationWithPremiumEnglishAction", "deleteWorkTranslationAction", "saveWorkSourceAction", "deleteWorkSourceAction", "addWorkExternalIdAction", "updateWorkExternalIdAction", "deleteWorkExternalIdAction", "reviewWorkImportCandidateAction", "deleteWorkImportCandidateAction"];
  const actions = Object.fromEntries(names.map((name) => [name, vi.fn()]));
  const reviewActions = { approvePremiumTranslationWorkingDraftAction: vi.fn(), discardPremiumTranslationWorkingDraftAction: vi.fn() };
  const reviewRead = vi.fn(async (name: string, args: { p_entity_type: string; p_entity_id: string }) => {
    if (name !== "get_premium_translation_working_draft") throw new Error("Mutation RPC on GET");
    if (options.reviewError) return { data: null, error: { code: "57014", message: privateError } };
    return { data: { schemaVersion: 1, entityType: args.p_entity_type, entityId: args.p_entity_id, draft: null }, error: null };
  });
  const isbn = loadAdminModule("lib/isbn.ts", {});
  const mocks = {
    "@/lib/env": { adminEnv: { publicSiteUrl: "https://probpera.ru" } },
    "@/lib/isbn": { ...isbn, lookupEditionByIsbn: async () => { if (options.isbnError) throw options.isbnError; return Object.hasOwn(options, "isbnCandidate") ? options.isbnCandidate : isbnCandidate; } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => { if (options.clientSignal) throw options.clientSignal; return options.noClient ? null : { from, rpc: reviewRead }; } },
    "@/lib/navigation": { redirect: (href: string) => { throw new RedirectSignal(href); } },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
    "@/components/ConfirmSubmitButton": { __esModule: true, default: ({ children }: { children?: ReactNode }) => createElement("button", { type: "submit" }, children) },
    "./actions": actions, "../visual-entity-actions": actions,
    "@/app/(dashboard)/library/actions": actions, "@/app/(dashboard)/library/premium-translation-actions": actions,
    "@/app/(dashboard)/translations/premium-review-actions": reviewActions,
  };
  const Page = loadAdminModule("app/(dashboard)/library/page.tsx", mocks).default as (args: { searchParams: Promise<Record<string, string>> }) => Promise<ReactNode>;
  return { reads, actions, reviewRead, async render(query: Record<string, string> = {}) {
    const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ work_id: work.legacy_id, edition_id: editionId, country_id: work.country_id, writer_id: work.writer_id, ...query }) }));
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    expect(markup).not.toContain(privateError);
    return { markup, $: load(markup) };
  } };
}

describe("M02 real library loader and workspace read boundaries", () => {
  it("valid reads preserve actual author/EN/edition fields without a GET action", async () => {
    const { $ } = await fixture().render();
    expect($(".library-stats-grid .stat-card").first().find("strong").text()).toBe("23");
    expect($("#edition-editor input[name=title]").attr("value")).toBe(edition.title);
    expect($("#work-workspace form input[name=locale][value=en]").closest("form").find("textarea[name=description]").text()).toBe(english.description);
    expect($(".visual-entity-field-form input[name=field][value=description]").closest("form").find("textarea").text()).toBe(work.description);
  });

  it.each(keys.flatMap((key) => ["error", "rejected"].map((mode) => [key, mode] as const)))("%s %s remains a safe partial page with a retry", async (key, mode) => {
    const options = mode === "rejected" ? { rejected: [key] } : { responses: { [key]: { data: null, count: null, error: { code: "57014", message: privateError } } } };
    const { $ } = await fixture(options).render();
    expect($(".page-heading h1").text()).toContain("Библиотека");
    expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
    expect($("body").text()).not.toContain("Выполните миграции");
    const card = $(".library-stats-grid .stat-card").eq(key === "totalWorks" ? 1 : 0);
    expect(card.find("strong").text()).toBe(key === "totalWorks" ? "17" : "23");
  });

  it.each(["translations", "sources", "external", "candidates", "artworks"] as const)("failed %s closes selected work edits and every workspace mutation", async (key) => {
    const { $ } = await fixture({ rejected: [key] }).render();
    expect($("#work-workspace").length).toBe(0);
    expect($(".visual-entity-field-form input[name=entity_type][value=book]").length).toBe(0);
    expect($("#edition-editor input[name=title]").attr("value")).toBe(edition.title);
  });

  it.each(["picker", "currentWork"] as const)("failed %s blocks edition reassignment and full save without losing the catalogs", async (key) => {
    const { $ } = await fixture({ rejected: [key] }).render();
    expect($("#edition-editor form").length).toBe(0);
    expect($(".library-catalog h2").text()).toContain("Все издания");
    expect($("#work-workspace").length).toBe(1);
  });

  it.each(["totalWorks", "totalEditions", "editionCovers", "artCount", "primaryArtCount"] as const)("failed %s KPI is unavailable while another real count survives", async (key) => {
    const { $ } = await fixture({ responses: { [key]: { data: null, count: 0, error: { code: "57014", message: privateError } } } }).render();
    const index = { totalWorks: 0, totalEditions: 1, editionCovers: 2, artCount: 3, primaryArtCount: 3 }[key];
    expect($(".library-stats-grid .stat-card").eq(index).text()).toContain("Недоступно");
    expect($(".library-stats-grid .stat-card").eq(key === "totalWorks" ? 1 : 0).find("strong").text()).toBe(key === "totalWorks" ? "17" : "23");
  });

  it.each([null, undefined, -1, "0", Number.MAX_SAFE_INTEGER + 1])("malformed total %s cannot become zero", async (count) => {
    const { $ } = await fixture({ responses: { totalWorks: { data: null, count, error: null } } }).render();
    expect($(".library-stats-grid .stat-card").first().find("strong").text()).toBe("Недоступно");
  });

  it("confirmed zero KPIs preserve real zeros", async () => {
    const responses = Object.fromEntries(["totalWorks", "totalEditions", "editionCovers", "artCount", "primaryArtCount"].map((key) => [key, { data: null, count: 0, error: null }]));
    const { $ } = await fixture({ responses }).render();
    expect($(".library-stats-grid .stat-card strong").map((_index, item) => $(item).text()).get()).toEqual(["0", "0", "0", "0", "ISBN"]);
  });

  it.each(["works", "editions", "picker", "translations", "sources", "external", "candidates", "artworks"] as const)("successful null %s data is malformed, not a confirmed empty list", async (key) => {
    const { $ } = await fixture({ responses: { [key]: { data: null, count: 0, error: null } } }).render();
    expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
    if (["translations", "sources", "external", "candidates", "artworks"].includes(key)) expect($("#work-workspace").length).toBe(0);
  });

  it("confirmed empty editorial collections keep an honest editable empty workspace", async () => {
    const responses = Object.fromEntries(["translations", "sources", "external", "candidates", "artworks"].map((key) => [key, { data: [], error: null }]));
    const { $ } = await fixture({ responses }).render();
    expect($("#work-workspace").length).toBe(1);
    expect($(".editorial-artwork-panel .empty-state").text()).toContain("не загружены");
  });

  it.each(["selectedWork", "selectedEdition", "currentWork"] as const)("wrong %s identity does not open a different record", async (key) => {
    const data = { ...(key === "selectedEdition" ? edition : work), id: rowId };
    const { $ } = await fixture({ responses: { [key]: { data, error: null } } }).render(key === "selectedWork" ? { work_id: workId } : {});
    if (key === "selectedWork") expect($("#work-workspace").length).toBe(0);
    else expect($("#edition-editor form").length).toBe(0);
    expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
  });

  it.each(["translations", "sources", "external", "artworks"] as const)("foreign work_id in %s blocks the selected bundle", async (key) => {
    const data = { translations: [translation], sources: [source], external: [external], artworks: [artwork] }[key].map((item) => ({ ...item, work_id: rowId }));
    const { $ } = await fixture({ responses: { [key]: { data, error: null } } }).render();
    expect($("#work-workspace").length).toBe(0);
    expect($(".visual-entity-field-form input[name=entity_type][value=book]").length).toBe(0);
  });

  it("foreign author import candidates cannot be edited under this selected work", async () => {
    const { $ } = await fixture({ responses: { candidates: { data: [{ ...candidate, writer_id: "different-writer" }], error: null } } }).render();
    expect($("#work-workspace").length).toBe(0);
  });

  it("duplicate locale rows are invalid instead of silently choosing one EN version", async () => {
    const { $ } = await fixture({ responses: { translations: { data: [translation, english, { ...english, id: rowId }], error: null } } }).render();
    expect($("#work-workspace").length).toBe(0);
  });

  it.each([{ field: "genres", value: {} }, { field: "metadata", value: undefined }, { field: "updated_at", value: "not-a-date" }, { field: "description", value: undefined }])("malformed selected work field $field blocks any empty replacement", async ({ field, value }) => {
    const { $ } = await fixture({ responses: { selectedWork: { data: { ...work, [field]: value }, error: null } } }).render();
    expect($("#work-workspace").length).toBe(0);
    expect($(".visual-entity-field-form input[name=entity_type][value=book]").length).toBe(0);
  });

  it.each([{ field: "publisher", value: undefined }, { field: "is_primary", value: "false" }, { field: "cover_rights_status", value: {} }, { field: "updated_at", value: "not-a-date" }])("malformed selected edition field $field blocks full-form default values", async ({ field, value }) => {
    const { $ } = await fixture({ responses: { selectedEdition: { data: { ...edition, [field]: value }, error: null } } }).render();
    expect($("#edition-editor form").length).toBe(0);
  });

  it.each(["works", "editions", "picker"] as const)("unknown %s total never redirects a valid requested page to page one", async (key) => {
    const responses: Partial<Record<QueryKey, Response>> = {
      works: { data: [work], count: 200, error: null }, editions: { data: [edition], count: 200, error: null }, picker: { data: [work], count: 200, error: null },
      [key]: { data: key === "editions" ? [edition] : [work], count: null, error: null },
    };
    const { $ } = await fixture({ responses }).render({ works_page: "2", editions_page: "2", work_picker_page: "2" });
    expect($(".page-heading").length).toBe(1);
  });

  it("confirmed out-of-range pages keep the existing Next redirect signal", async () => {
    await expect(fixture().render({ works_page: "2" })).rejects.toBeInstanceOf(RedirectSignal);
  });
  it("an auth/framework redirect from client creation is not converted to a query error", async () => {
    const signal = new RedirectSignal("/login");
    await expect(fixture({ clientSignal: signal }).render()).rejects.toBe(signal);
  });

  it.each(["selectedWork", "selectedEdition"] as const)("confirmed absent %s has a truthful state without an unsafe replacement", async (key) => {
    const { $ } = await fixture({ responses: { [key]: { data: null, error: null } } }).render();
    expect($('[role="status"]').text()).toContain("не найден");
    if (key === "selectedWork") expect($("#work-workspace").length).toBe(0);
    else expect($("#edition-editor form").length).toBe(0);
  });

  it("uppercase SQL UUIDs accept the same work and edition without changing field bytes", async () => {
    const { $ } = await fixture().render({ work_id: workId.toUpperCase(), edition_id: editionId.toUpperCase() });
    expect($("#edition-editor input[name=title]").attr("value")).toBe(edition.title);
    expect($("#work-workspace").length).toBe(1);
  });

  it.each(["00000000-0000-0000-0000-000000000000", "aaaaaaaa-bbbb-fccc-fddd-eeee11111111"])("SQL UUID %s remains visible in read lists while unsupported mutation controls are closed", async (id) => {
    const selected = { ...work, id };
    const fullEdition = { ...edition, work_id: id, literary_works: selected };
    const responses = {
      selectedWork: { data: selected, error: null }, currentWork: { data: selected, error: null }, selectedEdition: { data: fullEdition, error: null },
      works: { data: [selected], count: 23, error: null }, picker: { data: [selected], count: 23, error: null }, editions: { data: [fullEdition], count: 17, error: null },
      translations: { data: [{ ...translation, work_id: id }], error: null }, sources: { data: [{ ...source, work_id: id }], error: null },
      external: { data: [{ ...external, work_id: id }], error: null }, artworks: { data: [{ ...artwork, work_id: id }], error: null },
    };
    const { $ } = await fixture({ responses }).render({ work_id: id });
    expect($(".data-table").text()).toContain(work.title);
    expect($(".data-table").text()).toContain(edition.isbn_13);
    expect($(".editorial-artwork-panel .editorial-artwork-card").length).toBe(1);
    expect($("#work-workspace, #edition-editor form").length).toBe(0);
    expect($(".library-stats-grid .stat-card strong").first().text()).toBe("23");
  });

  it.each(["0", "2"])("producer aggregate count string %s retains its confirmed value", async (count) => {
    const { $ } = await fixture({ responses: { works: { data: [{ ...work, literary_work_cover_artworks: [{ count }] }], count: 23, error: null } } }).render();
    const row = $(".data-table tr").filter((_index, item) => $(item).find("td").first().text().includes(work.title));
    expect(row.find("td").eq(4).text().trim()).toBe(count);
  });

  it("actual SQL nullable work, edition and reviewed-date fields preserve valid edit forms", async () => {
    const nullableWork = { ...work, first_published: null, source_url: null };
    const nullableEdition = { ...edition, isbn_10: null, publication_year: null, page_count: null, cover_url: null, cover_source_url: null, license_url: null, source_url: null, rights_checked_at: null, cover_rights_status: "unverified", is_primary: false, literary_works: nullableWork };
    const responses = {
      selectedWork: { data: nullableWork, error: null }, currentWork: { data: nullableWork, error: null }, selectedEdition: { data: nullableEdition, error: null },
      works: { data: [nullableWork], count: 23, error: null }, picker: { data: [nullableWork], count: 23, error: null }, editions: { data: [nullableEdition], count: 17, error: null },
      translations: { data: [{ ...translation, editorial_status: "draft", source_urls: [], reviewed_at: null }, english], error: null },
    };
    const { $ } = await fixture({ responses }).render();
    expect($("#work-workspace").length).toBe(1);
    expect($("#edition-editor form").length).toBe(1);
    expect($("#edition-editor input[name=rights_checked_at]").attr("value")).toBe("");
    expect($("#edition-editor input[name=expected_updated_at]").attr("value")).toBe(timestamp);
  });

  it.each([{ metadata: null }, { metadata: [] }, { metadata: "opaque legacy metadata" }])("SQL JSON metadata $metadata is retained without closing unrelated text fields", async ({ metadata }) => {
    const selected = { ...work, metadata };
    const responses = {
      selectedWork: { data: selected, error: null }, currentWork: { data: selected, error: null },
      works: { data: [selected], count: 23, error: null }, picker: { data: [selected], count: 23, error: null },
      editions: { data: [{ ...edition, literary_works: selected }], count: 17, error: null },
    };
    const { $ } = await fixture({ responses }).render({ isbn: edition.isbn_13 });
    expect($("#work-workspace").length).toBe(1);
    expect($(".edition-save-form").length).toBe(1);
    expect($(".visual-entity-field-form input[name=field][value=description]").closest("form").find("textarea").text()).toBe(work.description);
  });

  it("opaque metadata writer name object cannot crash edition-link options", async () => {
    const selected = { ...work, metadata: { writerName: { opaque: "legacy JSON" } } };
    const responses = { picker: { data: [selected], count: 23, error: null }, selectedWork: { data: selected, error: null }, currentWork: { data: selected, error: null } };
    const { $ } = await fixture({ responses }).render({ isbn: edition.isbn_13 });
    expect($(".edition-save-form option").text()).toContain(work.writer_id);
    expect($("#work-workspace").length).toBe(1);
  });

  it.each([["translations", "source_urls", translation], ["sources", "field_names", source], ["candidates", "rejection_reasons", candidate]] as const)("SQL NOT NULL %s.%s cannot be treated as an empty authored collection", async (key, field, row) => {
    const { $ } = await fixture({ responses: { [key]: { data: [{ ...row, [field]: null }], error: null } } }).render();
    expect($("#work-workspace").length).toBe(0);
    expect($('[role="status"]').text()).toContain("Повторить загрузку");
  });

  it("inconsistent confirmed artwork totals do not invent zero secondary artworks", async () => {
    const { $ } = await fixture({ responses: { artCount: { data: null, count: 2, error: null }, primaryArtCount: { data: null, count: 4, error: null } } }).render();
    expect($(".library-stats-grid .stat-card").eq(3).find("small").text()).toContain("Недоступно дополнительных");
  });

  it.each([{ relation: [] }, { relation: [{ count: "9007199254740992" }] }])("malformed artwork aggregate $relation never becomes a confirmed zero", async ({ relation }) => {
    const { $ } = await fixture({ responses: { works: { data: [{ ...work, literary_work_cover_artworks: relation }], count: 23, error: null } } }).render();
    expect($(".data-table").text()).toContain(edition.isbn_13);
    expect($('[role="status"]').text()).toContain("Повторить загрузку");
  });

  it("missing DB client retains independent ISBN data without exposing a save form", async () => {
    const state = fixture({ noClient: true });
    const { $ } = await state.render({ isbn: edition.isbn_13 });
    expect($(".isbn-candidate h2").text()).toBe(isbnCandidate.title);
    expect($("form").length).toBe(0);
    expect($("a").text()).toContain("Повторить загрузку");
    expect(state.reads).not.toHaveBeenCalled();
  });

  it("failed picker dependency retains ISBN preview while closing its save form", async () => {
    const { $ } = await fixture({ rejected: ["picker"] }).render({ isbn: edition.isbn_13 });
    expect($(".isbn-candidate h2").text()).toBe(isbnCandidate.title);
    expect($(".edition-save-form").length).toBe(0);
  });

  it("SQL-valid unsupported source row ID is readable but cannot open mutation forms", async () => {
    const { $ } = await fixture({ responses: { sources: { data: [{ ...source, id: "00000000-0000-0000-0000-000000000000" }], error: null } } }).render();
    expect($("#work-workspace").length).toBe(0);
    expect($(".editorial-artwork-card").length).toBe(1);
    expect($('[role="status"]').text()).toContain("не поддерживается формами редактирования");
  });

  it("a writer override read failure cannot open an empty writer patch form", async () => {
    const { $ } = await fixture({ rejected: ["writer"] }).render({ work_id: "", edition_id: "" });
    expect($(".visual-entity-field-form input[name=entity_type][value=writer]").length).toBe(0);
    expect($(".library-stats-grid .stat-card").first().find("strong").text()).toBe("23");
  });
  it("a different writer override identity cannot be edited as this author", async () => {
    const { $ } = await fixture({ responses: { writer: { data: { ...writer, writer_id: "different-writer" }, error: null } } }).render({ work_id: "", edition_id: "" });
    expect($(".visual-entity-field-form input[name=entity_type][value=writer]").length).toBe(0);
  });
  it("confirmed absent writer override permits explicit creation fields", async () => {
    const { $ } = await fixture({ responses: { writer: { data: null, error: null } } }).render({ work_id: "", edition_id: "" });
    expect($(".visual-entity-field-form input[name=entity_type][value=writer]").length).toBe(3);
  });

  it("rejected ISBN lookup is unavailable rather than a missing exact edition", async () => {
    const { $ } = await fixture({ isbnError: new TypeError(privateError) }).render({ isbn: edition.isbn_13 });
    expect($("body").text()).not.toContain("Точное издание не найдено либо ISBN");
    expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
    expect($(".library-stats-grid .stat-card").first().find("strong").text()).toBe("23");
  });
  it("confirmed absent ISBN result retains the existing missing-edition explanation", async () => {
    const { $ } = await fixture({ isbnCandidate: null }).render({ isbn: edition.isbn_13 });
    expect($("body").text()).toContain("Точное издание не найдено либо ISBN");
  });
  it("malformed ISBN candidate cannot create a broken edition save form", async () => {
    const { $ } = await fixture({ isbnCandidate: { ...isbnCandidate, authors: {}, isbn13: "9789999999999" } }).render({ isbn: edition.isbn_13 });
    expect($(".edition-save-form").length).toBe(0);
    expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
  });

  it("URL error and saved/publication flags are not receipts or raw provider messages", async () => {
    const { $ } = await fixture().render({ error: privateError, saved: "workspace", published: "started" });
    expect($("body").text()).not.toContain("Редакционная запись произведения сохранена.");
    expect($("body").text()).not.toContain("Публичная сборка с обновлённым изданием запущена.");
  });

  it.each([["/", ""], ["/admin", "/admin"], ["/staff/panel", "/staff/panel"]])("plain GET retry preserves selection, filters and picker context under %s", async (basePath, prefix) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    try {
      const query = { q: "Exact title", country: work.country_id, writer: work.writer_id, status: "verified", works_page: "2", editions_page: "2", work_picker_q: "Exact picker", work_picker_page: "2", isbn: edition.isbn_13 };
      const responses = { works: { data: [work], count: 200, error: null }, editions: { data: [edition], count: 200, error: null }, picker: { data: [work], count: 200, error: null } };
      const { $ } = await fixture({ rejected: ["totalWorks"], responses }).render(query);
      const retry = $("a").filter((_index, item) => $(item).text() === "Повторить загрузку");
      expect(retry.length).toBeGreaterThan(0);
      for (const item of retry.toArray()) {
        const link = $(item); const url = new URL(link.attr("href")!, "https://example.org");
        expect(url.pathname).toBe(`${prefix}/library`);
        for (const [key, value] of Object.entries(query)) expect(url.searchParams.get(key)).toBe(value);
        expect(url.searchParams.get("work_id")).toBe(work.legacy_id);
        expect(url.searchParams.get("edition_id")).toBe(editionId);
        expect(link.attr("data-next-link")).toBeUndefined();
      }
    } finally { vi.unstubAllEnvs(); }
  });
});

describe("M07 private review read stays separate from the loaded library editor", () => {
  it("keeps exact canonical English editable when the private draft read fails", async () => {
    const state = fixture({ reviewError: true });
    const { $ } = await state.render();
    expect(state.reviewRead).toHaveBeenCalledTimes(1);
    expect($("#work-workspace form input[name=locale][value=en]").closest("form").find("textarea[name=description]").text()).toBe(english.description);
    expect($("input[name=confirm_human_review]").length).toBe(0);
    expect($("[role=status], [role=alert]").text()).toContain("Машинный кандидат недоступен");
  });
  it("does not load private review when a required canonical bundle read fails", async () => {
    const state = fixture({ rejected: ["translations"] });
    const { $ } = await state.render();
    expect(state.reviewRead).not.toHaveBeenCalled();
    expect($("#work-workspace").length).toBe(0);
    expect($("input[name=confirm_human_review]").length).toBe(0);
  });
});
