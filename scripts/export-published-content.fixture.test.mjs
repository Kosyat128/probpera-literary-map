import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("./lib/atomic-file-set.mjs", () => ({ commitAtomicFileSet: boundary.commit }));
vi.mock("node:fs", async (importOriginal) => ({
  ...await importOriginal(),
  promises: {
    readFile: vi.fn(async () => { throw Object.assign(new Error("No fixture baseline"), { code: "ENOENT" }); }),
    readdir: vi.fn(async () => []),
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("published CMS exporter with isolated I/O boundaries", () => {
  it("executes the real RU and EN cover-alt projection and captures the complete export without network or file writes", async () => {
    for (const [name, value] of Object.entries({
      SUPABASE_URL: "https://fixture-probpera.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "fixture-public-key",
      SUPABASE_SERVICE_ROLE_KEY: "",
      CMS_EXPORT_REQUIRE_STABLE: "false",
      CMS_PUBLICATION_BASELINE_URL: "",
      PUBLIC_SITE_URL: "https://probpera.ru",
      GITHUB_OUTPUT: "",
    })) vi.stubEnv(name, value);

    const alts = [
      { ru: "upload-123", en: "photo_456", expectedRu: "Иллюстрация к статье «Статья 1»", expectedEn: 'Illustration for the article "Article 1"' },
      { ru: "Авторская подпись", en: "An authored caption", expectedRu: "Авторская подпись", expectedEn: "An authored caption" },
      { ru: "", en: "", expectedRu: "Иллюстрация к статье «Статья 3»", expectedEn: 'Illustration for the article "Article 3"' },
    ];
    const articles = alts.map((alt, index) => ({
      id: `00000000-0000-4000-8000-00000000000${index + 1}`,
      title: `Статья ${index + 1}`, slug: `fixture-article-${index + 1}`,
      excerpt: "Краткое описание статьи.", content_html: '<h2 id="kept-heading">Раздел</h2><p>Текст статьи.</p>',
      cover_external_url: `https://probpera.ru/media/fixture-${index + 1}.webp`, cover_alt: alt.ru,
      published_at: "2026-09-14T00:00:00Z", updated_at: "2026-09-14T00:00:00Z",
      categories: { name: "Литература", slug: "literary-essays" },
    }));
    const translations = articles.map((article, index) => ({
      article_id: article.id, locale: "en", title: `Article ${index + 1}`, slug: article.slug,
      excerpt: "A short article description.", content_html: '<h2 id="kept-heading">Section</h2><p>Article text.</p>',
      cover_alt: alts[index].en, status: "published",
      source_content_hash: "fixture-source-fingerprint", source_article_updated_at: article.updated_at,
      approved_at: article.updated_at, published_at: article.published_at, updated_at: article.updated_at,
    }));
    const tables = Object.fromEntries([
      "media_assets", "homepage_blocks", "banners", "navigation_menus", "navigation_items", "pages", "redirects",
      "country_profile_overrides", "writer_profile_overrides", "literary_works", "literary_work_authors",
      "literary_work_translations", "literary_work_sources", "book_editions",
    ].map(name => [name, []]));
    Object.assign(tables, { articles, article_translations: translations });
    const fetchFixture = vi.fn(async (input, init) => {
      const url = new URL(input);
      expect(url.origin).toBe("https://fixture-probpera.supabase.co");
      expect(init?.method || "GET").toBe("GET");
      if (url.pathname === "/rest/v1/rpc/get_published_site_typography") {
        return Response.json({ overrides: [], fonts: [] });
      }
      if (url.pathname === "/rest/v1/rpc/get_published_site_design") {
        return Response.json({ release: null, tokens: [], components: [] });
      }
      const table = url.pathname.replace("/rest/v1/", "");
      if (!(table in tables)) throw new Error(`Unexpected exporter fixture request: ${url.pathname}`);
      const rows = tables[table];
      return Response.json(rows, { headers: { "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" } });
    });
    vi.stubGlobal("fetch", fetchFixture);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./export-published-content.mjs");
    expect(fetchFixture).toHaveBeenCalled();
    expect(boundary.commit).toHaveBeenCalledTimes(1);
    const { writes, deletes } = boundary.commit.mock.calls[0][0];
    expect(deletes).toEqual([]);
    const snapshot = JSON.parse(writes.find(write => write.path.endsWith("published-content.json")).content);
    expect(snapshot.articles).toHaveLength(3);
    for (let index = 0; index < articles.length; index += 1) {
      const id = `cms-${articles[index].id}`;
      const entry = snapshot.articles.find(article => article.id === id);
      expect(entry.imageAlt).toBe(alts[index].expectedRu);
      expect(entry.translations.en.imageAlt).toBe(alts[index].expectedEn);
      const document = JSON.parse(writes.find(write => write.path.endsWith(`${id}.json`)).content);
      expect(document.imageAlt).toBe(entry.imageAlt);
      expect(document.translations.en.imageAlt).toBe(entry.translations.en.imageAlt);
      expect(document.headings[0].id).toBe("kept-heading");
      expect(document.translations.en.headings[0].id).toBe("kept-heading");
      expect(document.translations.en.sourceContentHash).toBe("fixture-source-fingerprint");
    }
  });
});
