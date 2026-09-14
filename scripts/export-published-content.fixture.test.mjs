import { afterEach, describe, expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({ commit: vi.fn(), files: new Map() }));
vi.mock("./lib/atomic-file-set.mjs", () => ({ commitAtomicFileSet: boundary.commit }));
vi.mock("node:fs", async (importOriginal) => ({
  ...await importOriginal(),
  promises: {
    readFile: vi.fn(async path => {
      const key = String(path).replaceAll("\\", "/");
      if (key.endsWith("/editorial-catalog.json")) return '{"countries":[]}';
      if (boundary.files.has(key)) return boundary.files.get(key);
      throw Object.assign(new Error("No fixture baseline"), { code: "ENOENT" });
    }),
    readdir: vi.fn(async () => []),
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("published CMS exporter with isolated I/O boundaries", () => {
  it("executes both real exporters with bounded public sources and preserves RU/EN articles and every book source", async () => {
    boundary.commit.mockImplementation(async ({ writes }) => {
      for (const write of writes) boundary.files.set(write.path.replaceAll("\\", "/"), write.content);
    });
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
    const works = Array.from({ length: 41 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      legacy_id: `england:fixture:work-${index + 1}`, country_id: "england", writer_id: "fixture",
      title: `Work ${index + 1}`, editorial_status: "reviewed", metadata: {},
    }));
    const sources = works.flatMap(work => ["A source", "B source"].map(provider => ({
      work_id: work.id, provider, source_url: `https://example.test/${work.id}`,
      field_names: ["title"], license_name: "CC0", usage: "reference-only", retrieved_at: "2026-09-14", metadata: {},
    })));
    Object.assign(tables, { articles, article_translations: translations, literary_works: works, literary_work_sources: sources });
    let publicParentsRead = false;
    const sourceBatches = [];
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
      if (table === "literary_works") {
        expect(url.searchParams.get("editorial_status")).toBe("in.(reviewed,verified)");
        expect(init.headers.apikey).toBe("fixture-public-key");
        publicParentsRead = true;
      }
      let rows = tables[table];
      if (table === "literary_work_sources") {
        expect(publicParentsRead).toBe(true);
        expect(init.headers.apikey).toBe("fixture-public-key");
        expect(init.headers.Authorization).toBe("Bearer fixture-public-key");
        expect(init.headers.Prefer).toBe("count=exact");
        expect(url.searchParams.get("order")).toBe("work_id.asc,provider.asc,source_url.asc");
        const filter = url.searchParams.get("work_id");
        expect(filter).toMatch(/^in\.\([0-9a-f,-]+\)$/u);
        const ids = filter.slice(4, -1).split(",");
        expect(ids.length).toBeLessThanOrEqual(10);
        expect(ids.every(id => works.some(work => work.id === id))).toBe(true);
        sourceBatches.push(ids);
        rows = rows.filter(row => ids.includes(row.work_id));
      }
      return Response.json(rows, { headers: { "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" } });
    });
    vi.stubGlobal("fetch", fetchFixture);
    vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./export-published-content.mjs");
    expect(fetchFixture).toHaveBeenCalled();
    expect(boundary.commit).toHaveBeenCalledTimes(1);
    expect(sourceBatches.map(ids => ids.length)).toEqual([10, 10, 10, 10, 1]);
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
    for (const work of works) {
      expect(snapshot.literaryWorksByLegacyId[work.legacy_id].sources).toEqual(["A source", "B source"].map(provider => ({
        provider, url: `https://example.test/${work.id}`, fields: ["title"], license: "CC0", usage: "reference-only", retrievedAt: "2026-09-14",
      })));
    }
    sourceBatches.length = 0;
    publicParentsRead = false;
    await import("./export-premium-translations.mjs");
    expect(boundary.commit).toHaveBeenCalledTimes(2);
    expect(sourceBatches.map(ids => ids.length)).toEqual([10, 10, 10, 10, 1]);
    const premiumWrites = boundary.commit.mock.calls[1][0].writes;
    const enriched = JSON.parse(premiumWrites.find(write => write.path.endsWith("published-content.json")).content);
    expect(enriched).toEqual(snapshot);
  });
});
