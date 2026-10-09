import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { load } from "cheerio";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookDossierRecord } from "../../../../../../src/books/bookDossierDocument";
import type { StaffRole } from "../../../../lib/auth";
import { bookDossierFixture, bookDossierFixtureDesignProof } from "../../../../../../scripts/lib/book-dossier-fixtures";
import { BOOK_DOSSIER_REVIEW_STAGES } from "../../../../../../src/books/bookDossierCompiler";
import { publishBookDossier, reviewBookDossier, saveBookDossierDraft } from "../../../../../../src/books/bookDossierWorkflow";

const nativeRequire = createRequire(import.meta.url);
const adminRoot = path.resolve(import.meta.dirname, "../../../..");
type ModuleExports = Record<string, unknown>;

// Execute the real loader, dependency UI and readonly dossier validation.
// Provider, trusted session, Next Link and interactive child/actions are mocked.
function loadAdminModule(relative: string, mocks: Record<string, unknown>): ModuleExports {
  const filename = path.join(adminRoot, relative);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
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

const bookKey = "fixture:writer:work";
const otherKey = "fixture:other:work";
const privateError = "PRIVATE_PROVIDER_SECRET=never\u002drender\u002dthis\u002dfixture";
const exactTitle = "  Авторский текст \u2014 exact  ";
const exactParagraph = "  Original \u2014 paragraph.\nSecond line.  ";
const stamp = "2026\u002d09\u002d23T12:00:00.000Z";
const checksum = "a".repeat(64);
const record: BookDossierRecord = {
  draft: {
    schemaVersion: 2, bookKey, locale: "ru", dossierVersion: "v1", title: exactTitle,
    writer: "  Fixture author  ", profile: "ROMAN", tier: "CORE",
    requiredLocales: ["ru", "en"], translationReadyLocales: ["ru"],
    sections: [{ id: "section1", title: "Context", template: "essay", purpose: "context", spoiler: "NONE", blockIds: ["block1"] }],
    blocks: [{ id: "block1", sectionId: "section1", kind: "editorial", title: "Context",
      paragraphs: [exactParagraph], items: [], sourceIds: ["source1"], rightsId: "rights1", spoiler: "NONE", readingModes: ["BEFORE_READING"] }],
    sources: [{ id: "source1", provider: "Fixture library", title: "Original source", url: "https://loc.gov/item/fixture", kind: "library", reviewedAt: null, reviewedBy: null, attribution: "Exact source credit" }],
    rights: [{ id: "rights1", classification: "EDITORIAL_OWNED", contentType: "editorial",
      author: "Fixture author", rightsBasis: "Original editorial material", rightsHolder: "Fixture owner",
      sourceIds: ["source1"], territories: ["WORLD"], allowedSurfaces: ["HTML", "3D"],
      allow3D: true, allowHTML: true, allowIndexing: false, allowDownload: false, allowOfflineCache: false,
      startsAt: stamp, expiresAt: null, revokedAt: null, recheckAt: stamp,
      attribution: "Original credit", evidenceIds: [], reviewedBy: null, reviewedAt: null, reviewKind: "UNREVIEWED",
      contentChecksum: checksum, originalWork: "Original work", originalAuthor: "Fixture author", sourceLanguage: "ru" }],
  },
  status: "DRAFT", revision: 1, contentChecksum: checksum, reviews: [], audit: [{
    id: "audit1", actorId: "fixtureActor", at: stamp, action: "CREATE", reason: "Created",
    previousChecksum: null, contentChecksum: checksum,
  }],
};
function row(key = bookKey, locale: "ru" | "en" = "ru") {
  return { book_key: key, locale, revision: record.revision,
    record: { ...record, draft: { ...record.draft, bookKey: key, locale } } };
}
const other = row(otherKey);
const selected = row();
const responseDefaults = {
  list: { data: [other], error: null }, selected: { data: selected, error: null },
};
type Query = { book?: string; locale?: string; saved?: string; published?: string };
type Dependency = "list" | "selected";
class NextSignal extends Error {}

async function renderDossiers(options: {
  response?: Partial<Record<Dependency, unknown>>;
  rejected?: Set<Dependency>;
  query?: Query;
  role?: StaffRole;
  sessionSignal?: NextSignal;
  noUser?: boolean;
  noClient?: boolean;
} = {}) {
  const { response = {}, rejected = new Set(), query = { book: bookKey, locale: "ru" }, role = "owner" } = options;
  const replies = { ...responseDefaults, ...response };
  let fromIndex = 0;
  const selectedFilters: [string, unknown][] = [];
  const from = vi.fn((table: string) => {
    expect(table).toBe("book_dossiers");
    const key: Dependency = fromIndex++ === 0 ? "list" : "selected";
    const queryBuilder = {
      select: () => queryBuilder, order: () => queryBuilder, limit: () => queryBuilder,
      eq: (column: string, value: unknown) => { selectedFilters.push([column, value]); return queryBuilder; },
      maybeSingle: () => queryBuilder,
      then: (fulfilled: (value: unknown) => unknown, denied: (reason: unknown) => unknown) =>
        Promise.resolve().then(() => {
          if (rejected.has(key)) throw new TypeError(privateError);
          return replies[key];
        }).then(fulfilled, denied),
    };
    return queryBuilder;
  });
  const rpc = vi.fn();
  const action = vi.fn();
  const editor = vi.fn(({ initial, canPublish }: { initial: BookDossierRecord | null; canPublish: boolean }) =>
    createElement("section", { "data-dossier-editor": "true", "data-can-publish": String(canPublish) },
      createElement("textarea", { "data-initial": "true", defaultValue: JSON.stringify(initial) }),
      createElement("button", { type: "button" }, "Save boundary")));
  const auth = vi.fn(async () => {
    if (options.sessionSignal) throw options.sessionSignal;
    return { user: options.noUser ? null : { id: "fixtureActor", email: "owner@example.test" }, role };
  });
  const mocks = {
    "@/lib/auth": { requireStaff: auth },
    "@/lib/supabase/server": { createServerSupabaseClient: async () => options.noClient ? null : ({ from, rpc }) },
    "./BookDossierEditor": { BookDossierEditor: editor },
    "./actions": { bookDossierAction: action },
    "next/link": { __esModule: true, default: ({ children, ...props }: { children?: ReactNode }) =>
      createElement("a", { ...props, "data-next-link": "true" }, children) },
  };
  const BookDossiersPage = loadAdminModule("app/(dashboard)/library/dossiers/page.tsx", mocks).default as
    (props: { searchParams: Promise<Query> }) => Promise<ReactNode>;
  if (options.sessionSignal) {
    await expect(BookDossiersPage({ searchParams: Promise.resolve(query) })).rejects.toBe(options.sessionSignal);
    expect(from).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    return null;
  }
  const markup = renderToStaticMarkup(await BookDossiersPage({ searchParams: Promise.resolve(query) }));
  expect(auth).toHaveBeenCalledTimes(1);
  expect(rpc).not.toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();
  return { markup, $: load(markup), editor, from, selectedFilters };
}
type RenderedDossiers = NonNullable<Awaited<ReturnType<typeof renderDossiers>>>;
async function render(options?: Parameters<typeof renderDossiers>[0]) {
  const dossiers = await renderDossiers(options);
  expect(dossiers).not.toBeNull();
  return dossiers as RenderedDossiers;
}
function expectBlocked(dossiers: RenderedDossiers) {
  expect(dossiers.editor).not.toHaveBeenCalled();
  expect(dossiers.$('[data-dossier-editor="true"]').length).toBe(0);
  expect(dossiers.markup).not.toContain(privateError);
  expect(dossiers.markup).not.toContain("требуется миграция");
  const retry = dossiers.$("a").filter((_index, node) => /Повторить/i.test(dossiers.$(node).text()));
  expect(retry.length).toBeGreaterThan(0);
  expect(retry.attr("data-next-link")).toBeUndefined();
}
function expectIndependentList(dossiers: RenderedDossiers) {
  const links = dossiers.$('nav[aria-label="Последние досье"] a').filter((_index, node) =>
    dossiers.$(node).attr("href")?.includes("?book=") === true);
  expect(links.length).toBe(1);
  const url = new URL(links.attr("href")!, "https://admin.example.test");
  expect(url.searchParams.get("book")).toBe(otherKey);
  expect(links.text()).toContain(other.record.draft.title);
}

afterEach(() => vi.unstubAllEnvs());

describe("M02 dossier loader actual SSR failures", () => {
  it.each(["list", "selected"] as const)("isolates provider %s error", async (dependency) => {
    const dossiers = await render({ response: { [dependency]: { data: null, error: { code: "57014", message: privateError } } } });
    expectBlocked(dossiers);
    if (dependency === "selected") {
      expectIndependentList(dossiers);
      expect(dossiers.markup).not.toContain("Запрошенное досье не найдено");
    } else {
      expect(dossiers.markup).toContain(exactTitle);
    }
  });

  it.each(["list", "selected"] as const)("isolates rejected %s transport", async (dependency) => {
    const dossiers = await render({ rejected: new Set([dependency]) });
    expectBlocked(dossiers);
    if (dependency === "selected") expectIndependentList(dossiers);
  });

  it.each(["list", "selected"] as const)("ignores successful-looking %s data together with an error", async (dependency) => {
    const dossiers = await render({ response: { [dependency]: { ...responseDefaults[dependency], error: { code: "42501", message: privateError } } } });
    expectBlocked(dossiers);
  });

  it.each(["list", "selected"] as const)("treats null %s response as corrupt rather than empty", async (dependency) => {
    expectBlocked(await render({ response: { [dependency]: null } }));
  });

  it.each([
    ["null data", null], ["object data", {}], ["null row", [null]],
    ["object row title", [{ ...other, record: { ...other.record, draft: { ...other.record.draft, title: {} } } }]],
    ["object row status", [{ ...other, record: { ...other.record, status: {} } }]],
    ["object revision", [{ ...other, revision: {} }]],
    ["unsafe revision", [{ ...other, revision: Number.MAX_SAFE_INTEGER + 1 }]],
    ["record/key mismatch", [{ ...other, book_key: bookKey }]],
  ])("keeps list %s unavailable", async (_label, data) => {
    expectBlocked(await render({ response: { list: { data, error: null } } }));
  });

  it.each([
    ["missing record", { book_key: bookKey, locale: "ru", revision: 1 }],
    ["array record", { ...selected, record: [] }],
    ["null draft", { ...selected, record: { ...record, draft: null } }],
    ["null RU/EN readiness", { ...selected, record: { ...record, draft: { ...record.draft, translationReadyLocales: null } } }],
    ["invalid locale readiness", { ...selected, record: { ...record, draft: { ...record.draft, requiredLocales: ["ru", "xx"] } } }],
    ["null sections", { ...selected, record: { ...record, draft: { ...record.draft, sections: null } } }],
    ["null blocks", { ...selected, record: { ...record, draft: { ...record.draft, blocks: null } } }],
    ["null source bundle", { ...selected, record: { ...record, draft: { ...record.draft, sources: null } } }],
    ["null rights/media bundle", { ...selected, record: { ...record, draft: { ...record.draft, rights: null } } }],
    ["bad paragraphs", { ...selected, record: { ...record, draft: { ...record.draft, blocks: [{ ...record.draft.blocks[0], paragraphs: [{}] }] } } }],
    ["null source IDs", { ...selected, record: { ...record, draft: { ...record.draft, blocks: [{ ...record.draft.blocks[0], sourceIds: null }] } } }],
    ["null reviews", { ...selected, record: { ...record, reviews: null } }],
    ["null audit", { ...selected, record: { ...record, audit: null } }],
    ["object review decision", { ...selected, record: { ...record, reviews: [{ stage: "facts", actorId: "fixtureActor", actorKind: "HUMAN", reviewedAt: stamp, dossierVersion: "v1", contentChecksum: checksum, decision: {} }] } }],
    ["object audit reason", { ...selected, record: { ...record, audit: [{ ...record.audit[0], reason: {} }] } }],
    ["wrong requested identity", row(otherKey)],
    ["wrong requested locale", row(bookKey, "en")],
    ["unsafe revision", { ...selected, revision: Number.MAX_SAFE_INTEGER + 1, record: { ...record, revision: Number.MAX_SAFE_INTEGER + 1 } }],
    ["string revision", { ...selected, revision: "1" }],
    ["zero revision", { ...selected, revision: 0, record: { ...record, revision: 0 } }],
    ["revision mismatch", { ...selected, revision: 2 }],
    ["missing checksum", { ...selected, record: { ...record, contentChecksum: undefined } }],
    ["unknown status", { ...selected, record: { ...record, status: "SUCCESS" } }],
  ])("blocks selected %s without losing the independent list", async (_label, data) => {
    const dossiers = await render({ response: { selected: { data, error: null } } });
    expectBlocked(dossiers);
    expectIndependentList(dossiers);
  });

  it.each([
    ["42P01", "не соответствует запросу"], ["57014", "временно недоступна"], ["42501", "проверить доступ"],
  ])("keeps selected %s safe and distinct from missing data", async (code, message) => {
    const dossiers = await render({ response: { selected: { data: null, error: { code, message: privateError } } } });
    expectBlocked(dossiers);
    expect(dossiers.markup).toContain(message);
    expect(dossiers.markup).not.toContain("Запрошенное досье не найдено");
  });

  it("accepts confirmed empty list and opens only a new blank record", async () => {
    const dossiers = await render({ query: {}, response: { list: { data: [], error: null } } });
    expect(dossiers.editor).toHaveBeenCalledTimes(1);
    expect(dossiers.editor.mock.calls[0][0].initial).toBeNull();
    expect(dossiers.markup).toContain("Досье ещё не зарегистрированы.");
    expect(dossiers.markup).not.toContain("Повторить загрузку");
  });

  it("does not replace a confirmed unavailable selection with a blank editor", async () => {
    const dossiers = await render({ response: { selected: { data: null, error: null } } });
    expectBlocked(dossiers);
    expectIndependentList(dossiers);
    expect(dossiers.markup).toContain("Досье не найдено или недоступно");
  });

  it("preserves exact raw title, prose, rights and sources from the requested record outside recent 50", async () => {
    const dossiers = await render();
    expect(dossiers.editor).toHaveBeenCalledTimes(1);
    const initial = dossiers.editor.mock.calls[0][0].initial;
    expect(initial).toBe(selected.record);
    expect(initial).toEqual(selected.record);
    expect(initial?.draft.title).toBe(exactTitle);
    expect(initial?.draft.blocks[0].paragraphs[0]).toBe(exactParagraph);
    expect(dossiers.selectedFilters).toEqual([["book_key", bookKey], ["locale", "ru"]]);
    expect(dossiers.from).toHaveBeenCalledTimes(2);
  });

  it.each(["owner", "admin", "editor"] as const)("preserves existing canPublish mapping for %s", async (role) => {
    const dossiers = await render({ role });
    expect(dossiers.editor.mock.calls[0][0].canPublish).toBe(role !== "editor");
  });

  it("accepts the independent English dossier without borrowing a Russian record", async () => {
    const english = row(bookKey, "en");
    const dossiers = await render({ query: { book: bookKey, locale: "en" }, response: { selected: { data: english, error: null } } });
    expect(dossiers.editor.mock.calls[0][0].initial).toBe(english.record);
    expect(dossiers.selectedFilters).toEqual([["book_key", bookKey], ["locale", "en"]]);
  });

  it("retains valid incomplete draft arrays and nullable unreviewed rights without normalization", async () => {
    const incomplete = { ...selected, record: { ...record, draft: { ...record.draft, sections: [], blocks: [], sources: [], rights: [], translationReadyLocales: [] } } };
    const dossiers = await render({ response: { selected: { data: incomplete, error: null } } });
    expect(dossiers.editor.mock.calls[0][0].initial).toBe(incomplete.record);
  });

  it.each(["READY", "PUBLISHED"] as const)("retains workflow-produced %s records with old private design evidence", async (status) => {
    const now = Date.parse("2026\u002d09\u002d05T10:00:00Z");
    const actor = { id: "11111111\u002d1111\u002d4111\u002d8111\u002d111111111111", role: "owner" as const };
    let saved = await saveBookDossierDraft(bookDossierFixture(), null, { actor, now, expectedRevision: 0 });
    expect(saved.issues).toEqual([]);
    expect(saved.record).not.toBeNull();
    let produced = saved.record!;
    for (const stage of BOOK_DOSSIER_REVIEW_STAGES) {
      saved = await reviewBookDossier(produced, stage, "APPROVED", true, {
        actor, now, expectedRevision: produced.revision,
        ...(stage === "design" ? { designProof: bookDossierFixtureDesignProof(produced, now) } : {}),
      });
      expect(saved.issues, stage).toEqual([]);
      expect(saved.record).not.toBeNull();
      produced = saved.record!;
    }
    if (status === "PUBLISHED") {
      saved = await publishBookDossier(produced, { actor, now, expectedRevision: produced.revision });
      expect(saved.issues).toEqual([]);
      expect(saved.record).not.toBeNull();
      produced = saved.record!;
    }
    expect(produced.status).toBe(status);
    expect(produced.reviews).toHaveLength(6);
    const legacyRecord: BookDossierRecord = { ...produced, reviews: produced.reviews.map((review) =>
      review.stage === "design" ? { ...review, designProof: { ...review.designProof!,
        fontVersion: "owner\u002dbook\u002dtypography\u002dv2",
        layoutVersion: "book\u002dinspection\u002dlayout\u002dv3",
        measuredAt: "2026\u002d09\u002d01T00:00:00Z",
      } } : review) };
    const selectedRow = { book_key: legacyRecord.draft.bookKey, locale: legacyRecord.draft.locale,
      revision: legacyRecord.revision, record: legacyRecord };
    const dossiers = await render({ query: { book: selectedRow.book_key, locale: selectedRow.locale },
      response: { selected: { data: selectedRow, error: null } } });
    expect(dossiers.editor).toHaveBeenCalledTimes(1);
    expect(dossiers.editor.mock.calls[0][0].initial).toBe(legacyRecord);
    expect(dossiers.editor.mock.calls[0][0].initial?.reviews).toEqual(legacyRecord.reviews);
    expect(dossiers.markup).not.toContain("Повторить загрузку");
  });

  it.each([
    ["/", "/library/dossiers"], ["/admin", "/admin/library/dossiers"], ["/staff/panel", "/staff/panel/library/dossiers"],
  ])("retries fresh GET while retaining requested book/locale under base path %s", async (basePath, expectedPath) => {
    vi.stubEnv("ADMIN_BASE_PATH", basePath);
    const dossiers = await render({ query: { book: bookKey, locale: "en" }, response: { selected: { data: null, error: { code: "57014" } } } });
    expectBlocked(dossiers);
    const retry = dossiers.$("a").filter((_index, node) => /Повторить/i.test(dossiers.$(node).text()));
    const url = new URL(retry.attr("href")!, "https://admin.example.test");
    expect(url.pathname).toBe(expectedPath);
    expect(url.searchParams.get("book")).toBe(bookKey);
    expect(url.searchParams.get("locale")).toBe("en");
  });

  it("keeps missing client safe with a retry and no mutation controls", async () => {
    expectBlocked(await render({ noClient: true }));
  });

  it.each([
    { book: "invalid\u002dkey", locale: "ru" }, { book: bookKey, locale: "xx" },
  ])("does not open a blank editor or read a mismatched request", async (query) => {
    const dossiers = await render({ query });
    expectBlocked(dossiers);
    expect(dossiers.selectedFilters).toEqual([]);
    expect(dossiers.markup).toContain("Проверьте ключ произведения и язык");
  });

  it("does not treat saved/publication query flags as a dossier receipt", async () => {
    const dossiers = await render({ query: { book: bookKey, saved: "1", published: "1" } });
    expect(dossiers.editor.mock.calls[0][0].initial).toBe(selected.record);
    expect(dossiers.$(".form-success").length).toBe(0);
  });

  it("retains the staff gate before every database lookup", async () => {
    const dossiers = await render({ noUser: true });
    expect(dossiers.from).not.toHaveBeenCalled();
    expect(dossiers.editor).not.toHaveBeenCalled();
    expect(dossiers.markup).toContain("Нужна сессия редактора.");
  });

  it.each(["redirect", "notFound"])("leaves auth %s signals intact", async (message) => {
    await renderDossiers({ sessionSignal: new NextSignal(message) });
  });
});
