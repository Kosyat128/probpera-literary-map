import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import ArticleEditorShell, {
  type ArticleEditorShellHiddenModel,
} from "./ArticleEditorShell";

const hidden: ArticleEditorShellHiddenModel = {
  identity: {
    id: "article-id",
    expectedUpdatedAt: "2026-08-28T10:00:00Z",
    englishExpectedUpdatedAt: "2026-08-28T10:01:00Z",
  },
  publication: {
    previousStatus: "review",
    status: "published",
    scheduledAt: "2026-08-29T09:00:00Z",
    featured: true,
    showOnHomepage: false,
    pinned: true,
    override: "0",
  },
  russian: {
    title: "Заголовок",
    subtitle: "Подзаголовок",
    excerpt: "Описание",
    slug: "zagolovok",
    contentHtml: "<p>Текст</p>",
    contentJson: '{"type":"doc"}',
    coverAlt: "Обложка",
    seoTitle: "SEO",
    seoDescription: "SEO описание",
    seoKeywords: "книга, автор",
    canonicalUrl: "https://probpera.ru/stati/zagolovok/",
    ogTitle: "OG",
    ogDescription: "OG описание",
    sources: "Источник",
    bibliography: "Библиография",
  },
  english: {
    enabled: true,
    title: "Title",
    subtitle: "Subtitle",
    excerpt: "Description",
    slug: "title",
    contentHtml: "<p>Text</p>",
    contentJson: '{"type":"doc"}',
    coverAlt: "Cover",
    seoTitle: "English SEO",
    seoDescription: "English SEO description",
    seoKeywords: "book, author",
    canonicalUrl: "https://probpera.ru/en/articles/title/",
    ogTitle: "English OG",
    ogDescription: "English OG description",
    sources: "Source",
    bibliography: "Bibliography",
    status: "approved",
    confirmedCurrentSource: true,
  },
};

const alwaysPresentNames = [
  "english_expected_updated_at",
  "previous_status",
  "status",
  "scheduled_at",
  "featured",
  "show_on_homepage",
  "pinned",
  "title",
  "subtitle",
  "excerpt",
  "slug",
  "content_html",
  "content_json",
  "cover_alt",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "canonical_url",
  "og_title",
  "og_description",
  "sources",
  "bibliography",
  "english_enabled",
  "english_title",
  "english_subtitle",
  "english_excerpt",
  "english_slug",
  "english_content_html",
  "english_content_json",
  "english_cover_alt",
  "english_seo_title",
  "english_seo_description",
  "english_seo_keywords",
  "english_canonical_url",
  "english_og_title",
  "english_og_description",
  "english_sources",
  "english_bibliography",
  "english_status",
  "english_confirm_current_source",
  "publication_override",
] as const;

function renderShell(model: ArticleEditorShellHiddenModel, fullscreen = false) {
  return renderToStaticMarkup(
    <ArticleEditorShell
      hidden={model}
      formRef={createRef<HTMLFormElement>()}
      action="/save"
      fullscreen={fullscreen}
      onSubmit={() => undefined}
    >
      <button type="submit">Сохранить</button>
    </ArticleEditorShell>
  );
}

describe("ArticleEditorShell form contract", () => {
  it("renders every established hidden field and serialized flag", () => {
    const markup = renderShell(hidden, true);

    for (const name of ["id", "expected_updated_at", ...alwaysPresentNames]) {
      expect(markup).toContain(`type="hidden" name="${name}"`);
    }
    expect(markup).toContain('name="featured" value="on"');
    expect(markup).toContain('name="show_on_homepage" value=""');
    expect(markup).toContain('name="pinned" value="on"');
    expect(markup).toContain(
      'name="expected_updated_at" value="2026-08-28T10:00:00Z"'
    );
    expect(markup).toContain(
      'name="english_expected_updated_at" value="2026-08-28T10:01:00Z"'
    );
    expect(markup).toContain('name="previous_status" value="review"');
    expect(markup).toContain('name="status" value="published"');
    expect(markup).toContain('name="english_enabled" value="on"');
    expect(markup).toContain(
      'name="english_confirm_current_source" value="on"'
    );
    expect(markup).toContain('name="publication_override" value="0"');
    expect(markup).toContain(
      'class="article-form article-workspace-enabled is-fullscreen"'
    );
    expect(markup).toContain("Сохранить");
  });

  it("omits both Russian optimistic identity fields for a new article", () => {
    const markup = renderShell({
      ...hidden,
      identity: {
        ...hidden.identity,
        id: undefined,
        expectedUpdatedAt: "unused-token",
      },
    });

    expect(markup).not.toContain('name="id"');
    expect(markup).not.toContain('name="expected_updated_at"');
    expect(markup).toContain('name="english_expected_updated_at"');
    expect(markup).toContain('class="article-form article-workspace-enabled"');
  });
});
