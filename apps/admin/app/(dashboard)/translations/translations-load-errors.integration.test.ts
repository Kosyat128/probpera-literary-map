import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load, type CheerioAPI } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../..");
type ModuleExports = Record<string, unknown>;

// Execute the actual server page and read helpers; only external reads,
// server actions and the submit-button boundary are replaced.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as ModuleExports };
  const require = (name: string): unknown => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/") || name.startsWith(".")) {
      const target = name.startsWith("@/")
        ? path.join(adminRoot, name.slice(2))
        : path.resolve(path.dirname(filename), name);
      const sourceFile = [target, `${target}.ts`, `${target}.tsx`].find(existsSync);
      if (sourceFile) return loadAdminModule(path.relative(adminRoot, sourceFile), mocks);
    }
    return nativeRequire(name);
  };
  new Function("require", "module", "exports", compiled)(require, module, module.exports);
  return module.exports;
}

const privateError = "PRIVATE_PROVIDER_SECRET=never-render-this-fixture";
const unavailable = "Недоступно";
const model = "fixture-translator";
const timestamp = new Date().toISOString();
const job = {
  id: "11111111-1111-4111-8111-111111111111", kind: "article", status: "partial",
  totalItems: 3, succeededItems: 1, failedItems: 1, resumeCursor: { articleScan: {
    version: 1, order: "id", upperId: "11111111-1111-4111-8111-111111111111",
    afterId: null, pendingIds: ["11111111-1111-4111-8111-111111111111"],
    nextIndex: 0, lastWindow: true, exhausted: false,
  } },
  createdAt: timestamp, updatedAt: timestamp,
};
const operations = {
  queued: 2, running: 1, completed: 3, attention: 1, deadLetterItems: 0,
  recent: [job], runnerMode: "staff-bounded-sync-resume",
};
const probe = {
  provider: "cloudflare", configured: true, binding_found: true,
  test_passed: true, model, latency_ms: 0, last_error_code: null,
  last_test_at: timestamp, cooldown_until: null, test_in_progress: false,
  configuration_identity: null as unknown,
};
const cms = [{ settings: {
  systemKey: "site-copy-overrides", siteCopy: { ru: { first: "Первый", second: "Второй" }, en: { first: "First" } },
  premiumTranslation: { siteCopyEn: { first: { sourceHash: "fixture", model } } },
} }];
const catalog = { version: 1, countries: [{
  id: "fixture-country", label: "Fixture country",
  fields: { name: "Fixture country", description: "Exact country description\u2014unchanged" },
  writers: [{ id: "fixture-writer", label: "Fixture writer", fields: { biographyTranslations: {
    ru: { locale: "ru", method: "editorial-original", status: "verified", text: "Exact lawful biography\u2014unchanged. ".repeat(6), sources: [{ url: "https://example.org/source" }] },
  } } }],
} ] };
const countKeys = ["article", "articleEnglish", "workRussian", "workEnglish"] as const;
const queryKeys = [...countKeys, "cms", "machineReady", "operationsReady", "operations", "probe", "articleSyncReady"] as const;
type QueryKey = typeof queryKeys[number];
type QueryResponse = { data?: unknown; count?: unknown; error?: unknown };
class RedirectSignal extends Error {}

function fixture(options: {
  responses?: Partial<Record<QueryKey, QueryResponse>>;
  rejected?: QueryKey[];
  catalog?: unknown;
  catalogError?: Error;
  noClient?: boolean;
  clientSignal?: Error;
} = {}) {
  const defaults: Record<QueryKey, QueryResponse> = {
    article: { data: null, count: 8, error: null }, articleEnglish: { data: null, count: 6, error: null },
    workRussian: { data: null, count: 5, error: null }, workEnglish: { data: null, count: 4, error: null },
    cms: { data: cms, error: null }, machineReady: { data: true, error: null },
    operationsReady: { data: true, error: null }, operations: { data: operations, error: null }, probe: { data: probe, error: null },
    articleSyncReady: { data: true, error: null },
  };
  const called = vi.fn();
  function queryFor(initialKey: QueryKey) {
    let key = initialKey;
    const query = {
      select: () => query, contains: () => query, is: () => query, in: () => query,
      order: () => query, limit: () => query, maybeSingle: () => query,
      eq: (field: string, value: unknown) => {
        if (key === "workRussian" && field === "locale" && value === "en") key = "workEnglish";
        return query;
      },
      then: (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => {
          called(key);
          if (options.rejected?.includes(key)) throw new TypeError(privateError);
          return options.responses?.[key] || defaults[key];
        }).then(fulfilled, rejected),
    };
    return query;
  }
  const from = vi.fn((table: string) => {
    const key = ({ articles: "article", article_translations: "articleEnglish", literary_work_translations: "workRussian", homepage_blocks: "cms", translation_provider_self_tests: "probe" } as const)[table as "articles"];
    if (!key) throw new Error(`Unexpected table ${table}`);
    return queryFor(key);
  });
  const rpc = vi.fn((name: string) => {
    const key = ({ premium_machine_translation_ready: "machineReady", translation_operations_ready: "operationsReady", get_translation_operations_status: "operations", article_translation_sync_ready: "articleSyncReady" } as const)[name as "translation_operations_ready"];
    if (!key) throw new Error(`Unexpected RPC ${name}`);
    return queryFor(key);
  });
  const actionNames = ["translatePremiumArticleBatchAction", "translatePremiumLibraryBatchAction", "translatePremiumWriterBatchAction", "translatePremiumCountryBatchAction", "translatePremiumSiteCopyBatchAction", "runPremiumTranslationSelfTestAction", "resumeTranslationJobAction"];
  const actions = Object.fromEntries(actionNames.map((name) => [name, vi.fn()]));
  const providerRun = vi.fn();
  const runtimeEnv = { premiumTranslationProvider: "cloudflare", cloudflareTranslationModel: model,
    cloudflareTranslationReviewModel: "fixture-reviewer", openAiPremiumTranslationReview: true };
  const mocks = {
    "@/components/TranslationSubmitButton": {
      __esModule: true,
      default: ({ children, disabled }: { children?: ReactNode; disabled?: boolean }) => createElement("button", { type: "submit", disabled }, children),
    },
    "@/lib/env": { adminEnv: runtimeEnv }, "./env": { adminEnv: runtimeEnv },
    "@/lib/editorial-catalog": { loadEditorialCatalog: async () => {
      if (options.catalogError) throw options.catalogError;
      return Object.hasOwn(options, "catalog") ? options.catalog : catalog;
    } },
    "@opennextjs/cloudflare": { getCloudflareContext: () => ({ env: { AI: { run: providerRun } } }) },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => {
      if (options.clientSignal) throw options.clientSignal;
      return options.noClient ? null : { from, rpc };
    } },
    "./actions": actions, "./article-actions": actions, "./country-actions": actions,
    "./self-test-action": actions, "./resume-action": actions,
  };
  const Page = loadAdminModule("app/(dashboard)/translations/page.tsx", mocks).default as
    (args: { searchParams: Promise<Record<string, string>> }) => Promise<ReactNode>;
  return {
    actions, called,
    async render(query: Record<string, string> = {}) {
      const identity = loadAdminModule("lib/premium-translation-probe.ts", mocks).premiumTranslationConfigurationIdentity as
        () => Promise<unknown>;
      probe.configuration_identity = await identity();
      const markup = renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
      for (const action of Object.values(actions)) expect(action).not.toHaveBeenCalled();
      expect(providerRun).not.toHaveBeenCalled();
      expect(markup).not.toContain(privateError);
      return { markup, $: load(markup) };
    },
  };
}

function section($: CheerioAPI, eyebrow: string) {
  return $("section.panel").filter((_index, element) => $(element).children("span.eyebrow").text() === eyebrow);
}
function batchDisabled($: CheerioAPI, index: number) {
  return $("form.panel.settings-stack").eq(index).find("button").is(":disabled");
}
function selfTestDisabled($: CheerioAPI) {
  return section($, "Runtime self-test").find("button").is(":disabled");
}

describe("M02 actual translation page dependency reads", () => {
  it("complete valid reads keep all five bounded actions and actual metrics", async () => {
    const { $ } = await fixture().render();
    expect($(".stats-grid .stat-card").eq(0).find("strong").text()).toBe("8");
    expect($(".stats-grid .stat-card").eq(4).find("strong").text()).toBe("2");
    for (let index = 0; index < 5; index++) expect(batchDisabled($, index)).toBe(false);
    expect(selfTestDisabled($)).toBe(false);
    expect(section($, "Translation Operations").find("form button").is(":disabled")).toBe(false);
  });

  it.each(queryKeys.flatMap((key) => ["error", "rejected"].map((mode) => [key, mode] as const)))(
    "%s %s does not hide an independent model or expose a provider error",
    async (key, mode) => {
      const options = mode === "rejected" ? { rejected: [key] } : { responses: { [key]: { data: null, count: null, error: { code: "57014", message: privateError } } } };
      const { $ } = await fixture(options).render();
      expect($("body").text()).toContain(model);
      expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
      if (!countKeys.includes(key as typeof countKeys[number])) {
        expect($(".stats-grid .stat-card").eq(0).find("strong").text()).toBe("8");
      }
      if (["operationsReady", "operations", "probe"].includes(key)) {
        for (let index = 0; index < 5; index++) expect(batchDisabled($, index)).toBe(true);
        expect(selfTestDisabled($)).toBe(true);
        expect(section($, "Translation Operations").find("form button:not(:disabled)").length).toBe(0);
      }
      if (key === "articleSyncReady") {
        expect(batchDisabled($, 0)).toBe(true);
        for (let index = 1; index < 5; index++) expect(batchDisabled($, index)).toBe(false);
        expect(selfTestDisabled($)).toBe(false);
      }
    },
  );

  it.each(countKeys)("%s failed count remains unavailable while independent domain metrics survive", async (key) => {
    const { $ } = await fixture({ responses: { [key]: { data: null, count: 0, error: { message: privateError } } } }).render();
    const cardIndex = key.startsWith("article") ? 0 : 1;
    const count = $(".stats-grid .stat-card").eq(cardIndex).find(key === "article" || key === "workRussian" ? "strong" : "small").text();
    expect(count).toContain(unavailable);
    expect($(".stats-grid .stat-card").eq(2).find("strong").text()).toBe("1");
    expect(batchDisabled($, cardIndex)).toBe(true);
    expect(batchDisabled($, 2)).toBe(false);
  });

  it.each([null, undefined, -1, "0", 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "malformed article count %s cannot be displayed as a real zero", async (count) => {
      const { $ } = await fixture({ responses: { article: { data: null, count, error: null } } }).render();
      expect($(".stats-grid .stat-card").eq(0).find("strong").text()).toBe(unavailable);
      expect(batchDisabled($, 0)).toBe(true);
    },
  );

  it("confirmed zero counts remain real zeros with no count error", async () => {
    const responses = Object.fromEntries(countKeys.map((key) => [key, { data: null, count: 0, error: null }]));
    const { $ } = await fixture({ responses }).render();
    expect($(".stats-grid .stat-card").eq(0).find("strong").text()).toBe("0");
    expect($(".stats-grid .stat-card").eq(1).find("strong").text()).toBe("0");
    expect(batchDisabled($, 0)).toBe(false);
  });

  it.each(["operationsReady", "machineReady"] as const)("confirmed false %s remains capability-off without pretending read failure", async (key) => {
    const { $ } = await fixture({ responses: { [key]: { data: false, error: null } } }).render();
    expect($(".page-heading").length).toBe(1);
    expect(batchDisabled($, 0)).toBe(false);
    if (key === "operationsReady") {
      expect(selfTestDisabled($)).toBe(true);
      expect(section($, "Translation Operations").find("form").length).toBe(0);
    } else expect(batchDisabled($, 1)).toBe(true);
  });

  it.each(["operationsReady", "machineReady"] as const)("malformed scalar %s cannot become confirmed false", async (key) => {
    const { $ } = await fixture({ responses: { [key]: { data: "false", error: null } } }).render();
    expect($('[role="status"], [role="alert"]').text()).toContain("Повторить загрузку");
    expect(batchDisabled($, key === "machineReady" ? 1 : 0)).toBe(true);
  });

  it.each(["42P01", "57014", "42501"])("readiness error %s has a safe distinct dependency state", async (code) => {
    const { $ } = await fixture({ responses: { operationsReady: { data: false, error: { code, message: privateError } } } }).render();
    const messages = $('[role="status"], [role="alert"]').text();
    expect(messages).toContain(code === "42P01" ? "Структура редакционной базы" : code === "42501" ? "права" : "временно недоступна");
    expect(section($, "Translation Operations").find("h2").text()).not.toMatch(/Нужна (схема|миграция)/u);
    expect(selfTestDisabled($)).toBe(true);
  });

  it.each([null, {}, { ...operations, queued: null }, { ...operations, recent: null }, { ...operations, recent: [{ ...job, succeededItems: "1" }] }, { ...operations, recent: [{ ...job, kind: privateError }] }])(
    "malformed operations status %j cannot become zero totals or an active resume", async (data) => {
      const { $ } = await fixture({ responses: { operations: { data, error: null } } }).render();
      expect(section($, "Translation Operations").text()).toContain(unavailable);
      expect(section($, "Translation Operations").find("form button:not(:disabled)").length).toBe(0);
      expect(selfTestDisabled($)).toBe(true);
    },
  );

  it("confirmed empty operations have zero totals and an honest empty recent list", async () => {
    const data = { ...operations, queued: 0, running: 0, completed: 0, attention: 0, deadLetterItems: 0, recent: [] };
    const { $ } = await fixture({ responses: { operations: { data, error: null } } }).render();
    expect(section($, "Translation Operations").find(".status-list strong").map((_i, item) => $(item).text()).get()).toEqual(["0", "0", "0", "0", "0"]);
    expect(section($, "Translation Operations").find("form").length).toBe(0);
    expect(selfTestDisabled($)).toBe(false);
  });

  it("legacy operations retain confirmed counts and the job, with continuation safely disabled", async () => {
    const legacyJob: Record<string, unknown> = { ...job };
    delete legacyJob.resumeCursor;
    const data: Record<string, unknown> = { ...operations, recent: [legacyJob] };
    delete data.runnerMode;
    const snapshot = structuredClone(data);
    const { $ } = await fixture({ responses: { operations: { data, error: null } } }).render();
    const queue = section($, "Translation Operations");
    expect(queue.children(".status-list").find("strong").map((_index, element) => $(element).text()).get()).toEqual(["2", "1", "3", "1", "0"]);
    expect(queue.find('input[name="job_id"]').attr("value")).toBe(job.id);
    expect(queue.find("form button").is(":disabled")).toBe(true);
    expect(queue.text()).toContain("Начните новый обход архива");
    expect(data).toEqual(snapshot);
  });

  it.each(["111111ab-cdef-7111-8abc-111111abcdef", "111111AB-CDEF-F111-0ABC-111111ABCDEF"])(
    "SQL-valid job UUID %s keeps its bytes and counts while only unsupported resume is disabled", async (id) => {
      const data = { ...operations, recent: [{ ...job, id }] };
      const { $ } = await fixture({ responses: { operations: { data, error: null } } }).render();
      const queue = section($, "Translation Operations");
      expect(queue.children(".status-list").find("strong").first().text()).toBe("2");
      expect(queue.find('input[name="job_id"]').attr("value")).toBe(id);
      expect(queue.find("form button").is(":disabled")).toBe(true);
      expect(batchDisabled($, 0)).toBe(false);
    },
  );

  it.each([{ resumeCursor: null }, { resumeCursor: [] }])(
    "invalid present resumeCursor %j remains unavailable", async (cursor) => {
      const data = { ...operations, recent: [{ ...job, ...cursor }] };
      const { $ } = await fixture({ responses: { operations: { data, error: null } } }).render();
      expect(section($, "Translation Operations").text()).toContain(unavailable);
      expect(section($, "Translation Operations").find("form").length).toBe(0);
      expect(batchDisabled($, 0)).toBe(true);
    },
  );

  it.each([
    { ...probe, test_passed: false, last_error_code: ["provider_unavailable"] },
    { ...probe, last_error_code: "provider_unavailable" },
  ])("invalid provider error or success coherence %j blocks provider actions", async (data) => {
    const { $ } = await fixture({ responses: { probe: { data, error: null } } }).render();
    expect(section($, "Runtime self-test").text()).toContain(unavailable);
    expect(selfTestDisabled($)).toBe(true);
    expect(batchDisabled($, 0)).toBe(true);
  });

  it("a confirmed absent optional provider probe is not a failed read", async () => {
    const { $ } = await fixture({ responses: { probe: { data: null, error: null } } }).render();
    expect(section($, "Runtime self-test").text()).toContain("НУЖНА ПРОВЕРКА");
    expect(selfTestDisabled($)).toBe(false);
    for (let index = 0; index < 5; index++) expect(batchDisabled($, index)).toBe(true);
  });

  it.each([{}, { ...probe, test_in_progress: "false" }, { ...probe, last_test_at: "not-a-date" }, { ...probe, test_passed: "true" }, { ...probe, provider: "openai" }, { ...probe, latency_ms: -1 }])(
    "malformed provider probe %j does not allow a new provider request", async (data) => {
      const { $ } = await fixture({ responses: { probe: { data, error: null } } }).render();
      expect(section($, "Runtime self-test").text()).toContain(unavailable);
      expect(selfTestDisabled($)).toBe(true);
      expect(batchDisabled($, 0)).toBe(true);
    },
  );

  it("a valid probe in progress keeps self-test disabled", async () => {
    const { $ } = await fixture({ responses: { probe: { data: { ...probe, test_in_progress: true }, error: null } } }).render();
    expect(selfTestDisabled($)).toBe(true);
  });

  it.each([null, [{}], [{ settings: null }], [{ settings: { siteCopy: { ru: { first: {} } } } }], [{ settings: { premiumTranslation: { siteCopyEn: [] } } }]].map((data) => ({ data })))(
    "malformed CMS rows %j cannot become a successful empty site-copy", async ({ data }) => {
      const { $ } = await fixture({ responses: { cms: { data, error: null } } }).render();
      expect($(".stats-grid .stat-card").eq(4).find("strong").text()).toBe(unavailable);
      expect(batchDisabled($, 4)).toBe(true);
      expect(batchDisabled($, 0)).toBe(false);
    },
  );

  it.each([[], [{ settings: { systemKey: "site-copy-overrides" } }]].map((data) => ({ data })))("confirmed empty CMS shape %j keeps a real zero", async ({ data }) => {
    const { $ } = await fixture({ responses: { cms: { data, error: null } } }).render();
    expect($(".stats-grid .stat-card").eq(4).find("strong").text()).toBe("0");
    expect(batchDisabled($, 4)).toBe(false);
  });

  it("a failed static catalog leaves the four DB counts and article batch available", async () => {
    const { $ } = await fixture({ catalogError: new TypeError(privateError) }).render();
    expect($(".stats-grid .stat-card").eq(0).find("strong").text()).toBe("8");
    expect($(".stats-grid .stat-card").eq(2).find("strong").text()).toBe(unavailable);
    expect($(".stats-grid .stat-card").eq(3).find("strong").text()).toBe(unavailable);
    expect(batchDisabled($, 0)).toBe(false);
    expect(batchDisabled($, 2)).toBe(true);
    expect(batchDisabled($, 3)).toBe(true);
  });

  it.each([null, {}, { version: 1, countries: null }, { version: 1, countries: [{ fields: null, writers: [] }] }])(
    "malformed static catalog %j is an unavailable count rather than an SSR crash", async (data) => {
      const { $ } = await fixture({ catalog: data }).render();
      expect($(".stats-grid .stat-card").eq(2).find("strong").text()).toBe(unavailable);
      expect(batchDisabled($, 2)).toBe(true);
    },
  );

  it("an absent database client preserves the independent static catalog", async () => {
    const { $ } = await fixture({ noClient: true }).render();
    expect($(".stats-grid .stat-card").eq(0).find("strong").text()).toBe(unavailable);
    expect($(".stats-grid .stat-card").eq(2).find("strong").text()).toBe("1");
    expect(selfTestDisabled($)).toBe(true);
    for (let index = 0; index < 5; index++) expect(batchDisabled($, index)).toBe(true);
  });

  it("a framework redirect from client creation propagates intact", async () => {
    const signal = new RedirectSignal("NEXT_REDIRECT");
    await expect(fixture({ clientSignal: signal }).render()).rejects.toBe(signal);
  });

  it.each(["started", "queued"])("a forged publication=%s URL is not a commit receipt", async (publication) => {
    const { $ } = await fixture().render({ success: "FORGED_OPERATION_RECEIPT", publication });
    expect($("body").text()).not.toContain("FORGED_OPERATION_RECEIPT");
    expect($("body").text()).not.toContain("Публичная сборка запущена.");
    expect($("body").text()).not.toContain("Публикация поставлена в очередь.");
  });

  it("a raw success query value cannot echo provider details", async () => {
    await fixture().render({ success: privateError });
  });

  it.each(["passed", "failed"])("selfTest=%s URL cannot manufacture a persisted provider result", async (selfTest) => {
    const { $ } = await fixture({ rejected: ["probe"] }).render({ selfTest });
    expect($("body").text()).not.toContain("Контрольный запрос провайдера выполнен успешно.");
    expect($("body").text()).not.toContain("Контрольный запрос завершился безопасной ошибкой.");
    expect(section($, "Runtime self-test").text()).toContain(unavailable);
    expect(selfTestDisabled($)).toBe(true);
  });

  it.each([["/", ""], ["/admin", "/admin"], ["/staff/panel", "/staff/panel"]])(
    "plain GET retry retains every backfill cursor under %s", async (basePath, prefix) => {
      vi.stubEnv("ADMIN_BASE_PATH", basePath);
      const cursors = { articleCursor: "41", libraryCursor: "17", writerCursor: "23", countryCursor: "9" };
      try {
        const { $ } = await fixture({ rejected: ["operationsReady"] }).render(cursors);
        const retries = $("a").filter((_index, item) => $(item).text() === "Повторить загрузку");
        expect(retries.length).toBeGreaterThan(0);
        for (const element of retries.toArray()) {
          const link = $(element);
          const url = new URL(link.attr("href")!, "https://example.org");
          expect(url.pathname).toBe(`${prefix}/translations`);
          for (const [key, value] of Object.entries(cursors)) expect(url.searchParams.get(key)).toBe(value);
          expect(link.attr("data-next-link")).toBeUndefined();
        }
        const articleForm = $("form.panel.settings-stack").first();
        expect(articleForm.find('input[name="articleCursor"]').length).toBe(0);
        expect(articleForm.find('button[name="articleScanIntent"]').attr("value")).toBe("fresh");
      } finally { vi.unstubAllEnvs(); }
    },
  );
});
