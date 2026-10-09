import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const override = relative === "app/(dashboard)/editorial-database/page.tsx" ? process.env.M02_EDITORIAL_SOURCE : undefined;
  const compiled = ts.transpileModule(readFileSync(override || filename, "utf8"), {
    fileName: filename, compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/") ? path.join(adminRoot, name.slice(2)) : path.resolve(path.dirname(filename), name);
      const sourceFile = [target, target + ".ts", target + ".tsx"].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const privateError = "PRIVATE_EDITORIAL_SECRET=never_render";
const stamp = "2026\u002d09\u002d23T12:00:00.000Z";
const id = "12345678\u002d1234\u002d4123\u002d8123\u002d123456789abc";
const ru = { locale: "ru", text: "Синтетическая короткая биография.", sourceLanguage: "Russian", status: "draft", method: "editorial\u002doriginal", sources: [] };
const en = { locale: "en", text: "Synthetic short biography.", sourceLanguage: "Russian", status: "draft", method: "human\u002dtranslation", sources: [] };
const biographySource = {
  provider: "Synthetic publisher", url: "https://fixture.invalid/source", fields: ["identity"],
  usage: "fact\u002dcheck", retrievedAt: "2026\u002d09\u002d23",
};
const boundedUrl = (length: number) => "https://fixture.invalid/" + "x".repeat(length - "https://fixture.invalid/".length);
const writerFields = { name: "  Writer original \u2014 exact  ", description: "  Stored description \u2013 exact  ", works: ["  Work original  "], biographyTranslations: { ru, en } };
const catalog = { version: 1, countries: [
  { id: "russia", label: "Россия", fields: { name: "Россия", description: "  Country source \u2014 exact  ", coordinates: [55, 37] }, writers: [{ id: "writer_one", label: "Первый автор", fields: writerFields }] },
  { id: "usa", label: "США", fields: { name: "США" }, writers: [{ id: "writer_two", label: "Другой автор", fields: { name: "Другой автор" } }] },
] };
const countryOverride = { id, country_id: "russia", fields: { name: "  Country override \u2014 exact  ", coordinates: null, nobel: null }, updated_at: stamp };
const writerOverride = { id, country_id: "russia", writer_id: "writer_one", fields: { name: "  Writer override \u2014 exact  ", works: ["  Override work  "], biographyTranslations: { ru, en } }, updated_at: stamp };
const defaults = {
  country: { data: countryOverride, error: null }, writer: { data: writerOverride, error: null },
  countryCount: { data: null, count: 2, error: null }, writerCount: { data: null, count: 3, error: null },
};
type Dependency = keyof typeof defaults;
type Query = Record<string, string | undefined>;
class NextSignal extends Error { constructor(readonly destination: string) { super("Next navigation signal"); } }
async function render(options: {
  response?: Partial<Record<Dependency, unknown>>; rejected?: Set<Dependency>; query?: Query;
  catalogReply?: unknown; catalogRejected?: boolean; noClient?: boolean;
  querySignal?: NextSignal; clientSignal?: NextSignal;
  reviewError?: boolean;
} = {}) {
  const replies = { ...defaults, ...options.response };
  const requests: [string, string, unknown][] = [];
  const from = vi.fn((table: string) => {
    expect(["country_profile_overrides", "writer_profile_overrides"]).toContain(table);
    let countOnly = false;
    const builder = {
      select: (columns: string, args?: { head?: boolean }) => { countOnly = args?.head === true; requests.push([table, "select", columns]); return builder; },
      eq: (key: string, value: unknown) => { requests.push([table, key, value]); return builder; },
      maybeSingle: () => builder,
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) => Promise.resolve().then(() => {
        const dependency: Dependency = table === "country_profile_overrides" ? countOnly ? "countryCount" : "country" : countOnly ? "writerCount" : "writer";
        if (options.rejected?.has(dependency)) throw new TypeError(privateError);
        return replies[dependency];
      }).then(fulfilled, denied),
    };
    return builder;
  });
  const rpc = vi.fn(() => { throw new Error("Mutation RPC on GET"); });
  const actions = Object.fromEntries(["publishEditorialDatabaseAction", "saveEditorialProfileAction", "saveWriterBiographyAction"].map(name => [name, vi.fn()]));
  const reviewActions = { approvePremiumTranslationWorkingDraftAction: vi.fn(), discardPremiumTranslationWorkingDraftAction: vi.fn() };
  const reviewRead = vi.fn(async (name: string, args: { p_entity_type: string; p_entity_id: string }) => {
    if (name !== "get_premium_translation_working_draft") return rpc();
    if (options.reviewError) return { data: null, error: { code: "57014", message: privateError } };
    return { data: { schemaVersion: 1, entityType: args.p_entity_type, entityId: args.p_entity_id, draft: null }, error: null };
  });
  const mocks: Record<string, unknown> = {
    "@/lib/env": { adminEnv: { openAiAutoTranslateProfiles: false } },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : { from, rpc: reviewRead };
    } },
    "./actions": actions,
    "@/app/(dashboard)/translations/premium-review-actions": reviewActions,
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) => createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const realCatalog = loadAdminModule("lib/editorial-catalog.ts", mocks);
  const loadCatalog = vi.fn(async () => {
    if (options.catalogRejected) throw new TypeError(privateError);
    return Object.hasOwn(options, "catalogReply") ? options.catalogReply : catalog;
  });
  mocks["@/lib/editorial-catalog"] = { ...realCatalog, loadEditorialCatalog: loadCatalog };
  const page = loadAdminModule("app/(dashboard)/editorial-database/page.tsx", mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  try {
    const searchParams = options.querySignal ? Promise.reject(options.querySignal)
      : Promise.resolve(options.query ?? { country_id: "russia", writer_id: "writer_one" });
    const markup = renderToStaticMarkup(await page({ searchParams }));
    return { markup, $: load(markup), from, requests, loadCatalog, reviewRead };
  } finally {
    for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
    if (options.querySignal || options.clientSignal || options.catalogRejected) expect(from).not.toHaveBeenCalled();
  }
}
type Rendered = Awaited<ReturnType<typeof render>>;
function countryForms(view: Rendered) { return view.$('form.editorial-profile-form input[name="entity_type"][value="country"]').length; }
function writerForms(view: Rendered) { return view.$('form.editorial-profile-form input[name="entity_type"][value="writer"]').length + view.$("form.writer-biography-editor").length; }
function retry(view: Rendered) { return view.$("a").filter((_i, node) => view.$(node).text() === "Повторить загрузку"); }
function safe(view: Rendered) { expect(view.markup).not.toContain(privateError); expect(view.markup).not.toContain("[object Object]"); }
function failure(view: Rendered, dependency: Dependency) {
  safe(view); expect(view.$("header.page-heading form").length).toBe(0); expect(retry(view).length).toBeGreaterThan(0);
  if (dependency === "country") { expect(countryForms(view)).toBe(0); expect(writerForms(view)).toBe(2); }
  if (dependency === "writer") { expect(writerForms(view)).toBe(0); expect(countryForms(view)).toBe(1); }
  if (dependency === "countryCount" || dependency === "writerCount") {
    expect(view.$(".stat-card strong").eq(dependency === "countryCount" ? 2 : 3).text()).toBe("Недоступно");
    expect(countryForms(view)).toBe(1); expect(writerForms(view)).toBe(2);
  }
}
afterEach(() => vi.unstubAllEnvs());

describe("M02 editorial database real SSR read isolation", () => {
  it.each(Object.keys(defaults) as Dependency[])("isolates %s provider error", async dependency => {
    failure(await render({ response: { [dependency]: { ...defaults[dependency], error: { code: "42501", message: privateError } } } }), dependency);
  });
  it.each(Object.keys(defaults) as Dependency[])("isolates rejected %s", async dependency => {
    failure(await render({ rejected: new Set([dependency]) }), dependency);
  });
  for (const dependency of ["country", "writer"] as const) {
    it.each([{}, null, { data: {} }, { data: [] }, { data: "record" }, { data: [countryOverride] }])("rejects malformed " + dependency + " envelope %j", async response => {
      failure(await render({ response: { [dependency]: response } }), dependency);
    });
    it.each([{ id: "bad" }, { fields: null }, { fields: [] }, { fields: "json" }, { updated_at: null }, { updated_at: "bad" }, { country_id: "usa" }])("rejects damaged " + dependency + " DTO %j", async patch => {
      failure(await render({ response: { [dependency]: { data: { ...defaults[dependency].data, ...patch }, error: null } } }), dependency);
    });
    it("preserves genuinely absent " + dependency + " override", async () => {
      const view = await render({ response: { [dependency]: { data: null, error: null } } }); safe(view);
      expect(countryForms(view)).toBe(1); expect(writerForms(view)).toBe(2);
      const section = dependency === "country" ? view.$('form.editorial-profile-form').first() : view.$('form.editorial-profile-form').last();
      expect(section.find('input[name="expected_updated_at"]').attr("value")).toBe("");
    });
  }
  it("rejects a different writer identity", async () => {
    failure(await render({ response: { writer: { data: { ...writerOverride, writer_id: "writer_two" }, error: null } } }), "writer");
  });
  for (const dependency of ["countryCount", "writerCount"] as const) {
    it.each([null, undefined, -1, 1.5, "0", Infinity, Number.MAX_SAFE_INTEGER + 1])("keeps unknown " + dependency + " %j", async count => {
      failure(await render({ response: { [dependency]: { data: null, count, error: null } } }), dependency);
    });
  }
  it("retains genuine zero counters", async () => {
    const view = await render({ response: { countryCount: { data: null, count: 0, error: null }, writerCount: { data: null, count: 0, error: null } } });
    expect(view.$(".stat-card strong").eq(2).text()).toBe("0"); expect(view.$(".stat-card strong").eq(3).text()).toBe("0");
    expect(view.$("header.page-heading form").length).toBe(1);
  });
  it.each([null, {}, { version: 1, countries: null }, { version: 1, countries: [null] }, { version: 1, countries: [{ ...catalog.countries[0], fields: null }] }, { ...catalog, countries: [catalog.countries[0], catalog.countries[0]] }])("isolates invalid catalog %j", async catalogReply => {
    const view = await render({ catalogReply }); safe(view); expect(view.from).not.toHaveBeenCalled();
    expect(countryForms(view)).toBe(0); expect(writerForms(view)).toBe(0); expect(retry(view).length).toBeGreaterThan(0);
  });
  it("isolates failed catalog read", async () => {
    const view = await render({ catalogRejected: true }); safe(view); expect(retry(view).length).toBeGreaterThan(0);
    expect(countryForms(view)).toBe(0); expect(writerForms(view)).toBe(0);
  });
  it("keeps successful empty catalog explicit", async () => {
    const view = await render({ catalogReply: { version: 1, countries: [] } }); safe(view);
    expect(view.from).not.toHaveBeenCalled(); expect(view.markup).toContain("Каталог стран пуст");
    expect(countryForms(view)).toBe(0); expect(writerForms(view)).toBe(0);
  });
  it("never silently opens the default country for an invalid requested country", async () => {
    const view = await render({ query: { country_id: "missing", writer_id: "writer_one" } }); safe(view);
    expect(countryForms(view)).toBe(0); expect(writerForms(view)).toBe(0);
    expect(view.markup).toContain("Запрошенная страна не найдена");
    expect(view.requests.some(([, field, value]) => field === "country_id" && value === "russia")).toBe(false);
  });
  it("never opens a different author when the requested writer belongs to another country", async () => {
    const view = await render({ query: { country_id: "russia", writer_id: "writer_two" } }); safe(view);
    expect(writerForms(view)).toBe(0); expect(countryForms(view)).toBe(1);
    expect(view.markup).toContain("Запрошенный автор не найден");
  });
  it("preserves intentional country-only selection", async () => {
    const view = await render({ query: { country_id: "russia" } }); safe(view);
    expect(countryForms(view)).toBe(1); expect(writerForms(view)).toBe(0);
    expect(view.from).toHaveBeenCalledTimes(3);
  });
  it("keeps default country only when no country was requested", async () => {
    const view = await render({ query: {} }); safe(view);
    expect(countryForms(view)).toBe(1); expect(writerForms(view)).toBe(0);
    expect(view.requests).toContainEqual(["country_profile_overrides", "country_id", "russia"]);
  });
  it.each([{ name: {} }, { works: [null] }, { description: [] }, { biographyTranslations: [] },
    { biographyTranslations: { ru: { ...ru, text: {} } } }, { biographyTranslations: { ru: { ...ru, locale: "en" } } },
    { biographyTranslations: { ru: { ...ru, sources: [null] } } }, { biographyTranslations: { en: { ...en, sources: "sources" } } },
    { biographyTranslations: { en: { ...en, method: [] } } }, { biographyTranslations: { en: { ...en, translationMeta: [] } } },
  ])("does not render malformed override author fields as blanks %j", async fields => {
    failure(await render({ response: { writer: { data: { ...writerOverride, fields }, error: null } } }), "writer");
  });
  it.each([{}, null, { ru: null, en: null }, { ru, en: null }])("preserves intentional durable locale tombstones %j", async biographyTranslations => {
    const view = await render({ response: { writer: { data: { ...writerOverride, fields: { biographyTranslations } }, error: null } } }); safe(view);
    expect(writerForms(view)).toBe(2);
    expect(view.$('textarea[name="en_text"]').text()).toBe("");
  });
  for (const locale of ["ru", "en"] as const) {
    const original = locale === "ru" ? ru : en;
    const biographyReply = (profile: unknown) => ({
      writer: { data: { ...writerOverride, fields: {
        ...writerOverride.fields, biographyTranslations: { ru, en, [locale]: profile },
      } }, error: null },
    });
    it.each([
      { field: "text", value: "Stored\u0001biography" },
      { field: "sourceLanguage", value: "Russian\u0001language" },
      { field: "reviewer", value: "Stored\u0001reviewer" },
      { field: "text", value: "x".repeat(1601) },
      { field: "sourceLanguage", value: "x".repeat(81) },
      { field: "reviewer", value: "x".repeat(301) },
    ])("holds " + locale + " profile when existing reader would discard $field", async ({ field, value }) => {
      failure(await render({ response: biographyReply({ ...original, [field]: value }) }), "writer");
    });
    it.each([
      { field: "provider", value: "x".repeat(241) },
      { field: "url", value: boundedUrl(1001) },
      { field: "author", value: "x".repeat(301) },
      { field: "title", value: "x".repeat(501) },
      { field: "licenseName", value: "x".repeat(301) },
      { field: "licenseUrl", value: boundedUrl(1001) },
      { field: "provider", value: "Stored\u0001publisher" },
      { field: "url", value: "https://fixture.invalid/sto\u0001red" },
      { field: "author", value: "Stored\u0001author" },
      { field: "title", value: "Stored\u0001title" },
      { field: "licenseName", value: "Stored\u0001license" },
      { field: "licenseUrl", value: "https://fixture.invalid/sto\u0001red" },
    ])("holds " + locale + " source when existing reader would drop $field", async ({ field, value }) => {
      const profile = { ...original, sources: [{ ...biographySource, [field]: value }] };
      failure(await render({ response: biographyReply(profile) }), "writer");
    });
    it("preserves " + locale + " exact reader bounds without imposing publish quality", async () => {
      const profile = { ...original, text: "x".repeat(1600), sourceLanguage: "x".repeat(80), reviewer: "x".repeat(300) };
      const response = biographyReply(profile);
      const before = JSON.stringify(response);
      const view = await render({ response }); safe(view);
      expect(writerForms(view)).toBe(2); expect(countryForms(view)).toBe(1);
      expect(view.$(`textarea[name="${locale}_text"]`).text()).toBe(profile.text);
      expect(view.$(`input[name="${locale}_source_language"]`).attr("value")).toBe(profile.sourceLanguage);
      expect(view.$(`input[name="${locale}_reviewer"]`).attr("value")).toBe(profile.reviewer);
      expect(JSON.stringify(response)).toBe(before);
    });
    it("preserves " + locale + " full source at exact consumed bounds", async () => {
      const source = {
        ...biographySource, provider: "x".repeat(240), url: boundedUrl(1000), author: "x".repeat(300),
        title: "x".repeat(500), licenseName: "x".repeat(300), licenseUrl: boundedUrl(1000),
      };
      const view = await render({ response: biographyReply({ ...original, sources: [source] }) }); safe(view);
      expect(writerForms(view)).toBe(2);
      expect(JSON.parse(view.$(`textarea[name="${locale}_sources_json"]`).text())).toEqual([source]);
    });
    it("preserves " + locale + " legacy whitespace accepted by the unchanged reader", async () => {
      const source = { ...biographySource, provider: "  Publisher  ", url: "  https://fixture.invalid/source  ",
        fields: [" identity "], usage: " fact\u002dcheck ", retrievedAt: " 2026\u002d09\u002d23 ", author: "  Author  " };
      const profile = { ...original, text: "  First line.\r\nSecond line.  ", sourceLanguage: " Russian ",
        status: " draft ", method: ` ${original.method} `, reviewer: "  Reviewer  ", reviewedAt: " 2026\u002d09\u002d23 ",
        translatedFromLocale: " ", sourceTextRights: " ", sources: [source] };
      const response = biographyReply(profile); const before = JSON.stringify(response);
      const view = await render({ response }); safe(view);
      expect(writerForms(view)).toBe(2);
      expect(view.$(`textarea[name="${locale}_text"]`).text()).toBe("First line.\nSecond line.");
      expect(view.$(`input[name="${locale}_reviewer"]`).attr("value")).toBe("Reviewer");
      expect(JSON.parse(view.$(`textarea[name="${locale}_sources_json"]`).text())).toEqual([
        { ...biographySource, provider: "Publisher", author: "Author" },
      ]);
      expect(JSON.stringify(response)).toBe(before);
    });
    it("preserves " + locale + " nullable optional source fields and readable draft", async () => {
      const source = { ...biographySource, author: null, title: null, licenseName: null, licenseUrl: null };
      const profile = { ...original, text: "", reviewer: null, reviewedAt: null, translatedFromLocale: null,
        sourceTextRights: null, sources: [source] };
      const view = await render({ response: biographyReply(profile) }); safe(view);
      expect(writerForms(view)).toBe(2); expect(view.$(`textarea[name="${locale}_text"]`).text()).toBe("");
      expect(JSON.parse(view.$(`textarea[name="${locale}_sources_json"]`).text())).toEqual([biographySource]);
    });
  }
  it.each([{ biographyTranslations: { ru }, ruText: ru.text, enText: "" },
    { biographyTranslations: { en }, ruText: "", enText: en.text },
    { biographyTranslations: { ru: null, en }, ruText: "", enText: en.text },
    { biographyTranslations: { en: null }, ruText: "", enText: "" },
  ])("preserves whole-map ownership for partial durable profiles %j", async ({ biographyTranslations, ruText, enText }) => {
    const view = await render({ response: { writer: {
      data: { ...writerOverride, fields: { biographyTranslations } }, error: null,
    } } }); safe(view);
    expect(writerForms(view)).toBe(2);
    expect(view.$('textarea[name="ru_text"]').text()).toBe(ruText);
    expect(view.$('textarea[name="en_text"]').text()).toBe(enText);
  });
  it("preserves original profile strings and unchanged biography consumer", async () => {
    const view = await render(); safe(view);
    expect(view.$('form.editorial-profile-form input[name="entity_type"][value="country"]').closest("form").find('input[name="name"]').attr("value")).toBe(countryOverride.fields.name);
    expect(view.$('form.editorial-profile-form input[name="entity_type"][value="writer"]').closest("form").find('input[name="name"]').attr("value")).toBe(writerOverride.fields.name);
    expect(view.$('textarea[name="ru_text"]').text()).toBe(ru.text); expect(view.$('textarea[name="en_text"]').text()).toBe(en.text);
    expect(view.$('form.writer-biography-editor input[name="expected_updated_at"]').attr("value")).toBe(stamp);
  });
  it("retry preserves both exact IDs and base path without notice receipts", async () => {
    vi.stubEnv("ADMIN_BASE_PATH", "/staff");
    const view = await render({ query: { country_id: "russia", writer_id: "writer_one", error: privateError, result: "saved" }, rejected: new Set(["writer"]) });
    const link = retry(view).first(); const url = new URL(link.attr("href")!, "https://fixture.invalid");
    expect(url.pathname).toBe("/staff/editorial-database"); expect(url.searchParams.get("country_id")).toBe("russia");
    expect(url.searchParams.get("writer_id")).toBe("writer_one"); expect(url.searchParams.has("error")).toBe(false);
    expect(link.attr("data-next-link")).toBeUndefined(); safe(view);
  });
  it.each(["saved", "removed", "published", "biography\u002dsaved"])("does not treat result=%s and translation notices as receipts", async result => {
    const view = await render({ query: { country_id: "russia", writer_id: "writer_one", result, publication: "started", translation: "translated", warning: "audit", error: privateError } }); safe(view);
    expect(view.$(".form-success").length).toBe(0); expect(view.$('[role="status"]').text()).toContain("не подтверждён");
  });
  it("renders configured dependency failure instead of a blank screen", async () => {
    const view = await render({ noClient: true }); safe(view); expect(view.from).not.toHaveBeenCalled();
    expect(view.markup).toContain("Редакционная база временно недоступна"); expect(countryForms(view)).toBe(0);
  });
  it.each(["querySignal", "clientSignal"] as const)("preserves %s Next control flow", async field => {
    const signal = new NextSignal("/login"); await expect(render({ [field]: signal })).rejects.toBe(signal);
  });
});

describe("M07 private review read stays separate from the loaded country editor", () => {
  it("keeps exact country fields editable when the private draft read fails", async () => {
    const view = await render({ reviewError: true });
    expect(view.reviewRead).toHaveBeenCalledTimes(1);
    expect(countryForms(view)).toBe(1);
    expect(view.$('form.editorial-profile-form input[name="entity_type"][value="country"]').closest("form").find('input[name="name"]').attr("value")).toBe(countryOverride.fields.name);
    expect(view.$("input[name=confirm_human_review]").length).toBe(0);
    expect(view.$("[role=status], [role=alert]").text()).toContain("Машинный кандидат недоступен");
    safe(view);
  });
  it("does not load private review when the canonical country read fails", async () => {
    const view = await render({ rejected: new Set(["country"]) });
    expect(view.reviewRead).not.toHaveBeenCalled();
    expect(countryForms(view)).toBe(0);
    expect(view.$("input[name=confirm_human_review]").length).toBe(0);
    safe(view);
  });
});
