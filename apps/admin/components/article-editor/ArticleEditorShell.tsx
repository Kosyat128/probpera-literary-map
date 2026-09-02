"use client";

import type {
  ComponentProps,
  FormEventHandler,
  ReactNode,
  Ref,
} from "react";

import type { ArticleTranslationStatus } from "./ArticleEditorTypes";

export type ArticleEditorShellHiddenModel = {
  identity: {
    id?: string;
    expectedUpdatedAt: string;
    englishExpectedUpdatedAt: string;
    workingDraftVersion: number;
    previewLocale: "ru" | "en";
  };
  publication: {
    previousStatus: string;
    status: string;
    scheduledAt: string;
    featured: boolean;
    showOnHomepage: boolean;
    pinned: boolean;
    override: string;
  };
  russian: {
    title: string;
    subtitle: string;
    excerpt: string;
    slug: string;
    contentHtml: string;
    contentJson: string;
    coverAlt: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    sources: string;
    bibliography: string;
  };
  english: {
    enabled: boolean;
    title: string;
    subtitle: string;
    excerpt: string;
    slug: string;
    contentHtml: string;
    contentJson: string;
    coverAlt: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    canonicalUrl: string;
    ogTitle: string;
    ogDescription: string;
    sources: string;
    bibliography: string;
    status: ArticleTranslationStatus;
    confirmedCurrentSource: boolean;
  };
};

export default function ArticleEditorShell({
  hidden,
  formRef,
  action,
  fullscreen,
  onSubmit,
  children,
}: {
  hidden: ArticleEditorShellHiddenModel;
  formRef: Ref<HTMLFormElement>;
  action: ComponentProps<"form">["action"];
  fullscreen: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}) {
  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      className={
        fullscreen
          ? "article-form article-workspace-enabled is-fullscreen"
          : "article-form article-workspace-enabled"
      }
    >
      {hidden.identity.id && (
        <input type="hidden" name="id" value={hidden.identity.id} />
      )}
      {hidden.identity.id && (
        <input
          type="hidden"
          name="expected_updated_at"
          value={hidden.identity.expectedUpdatedAt}
        />
      )}
      <input
        type="hidden"
        name="english_expected_updated_at"
        value={hidden.identity.englishExpectedUpdatedAt}
      />
      <input
        type="hidden"
        name="working_draft_version"
        value={hidden.identity.workingDraftVersion}
      />
      <input
        type="hidden"
        name="preview_locale"
        value={hidden.identity.previewLocale}
      />
      <input
        type="hidden"
        name="previous_status"
        value={hidden.publication.previousStatus}
      />
      <input type="hidden" name="status" value={hidden.publication.status} />
      <input
        type="hidden"
        name="scheduled_at"
        value={hidden.publication.scheduledAt}
      />
      <input
        type="hidden"
        name="featured"
        value={hidden.publication.featured ? "on" : ""}
      />
      <input
        type="hidden"
        name="show_on_homepage"
        value={hidden.publication.showOnHomepage ? "on" : ""}
      />
      <input
        type="hidden"
        name="pinned"
        value={hidden.publication.pinned ? "on" : ""}
      />

      <input type="hidden" name="title" value={hidden.russian.title} />
      <input type="hidden" name="subtitle" value={hidden.russian.subtitle} />
      <input type="hidden" name="excerpt" value={hidden.russian.excerpt} />
      <input type="hidden" name="slug" value={hidden.russian.slug} />
      <input
        type="hidden"
        name="content_html"
        value={hidden.russian.contentHtml}
      />
      <input
        type="hidden"
        name="content_json"
        value={hidden.russian.contentJson}
      />
      <input type="hidden" name="cover_alt" value={hidden.russian.coverAlt} />
      <input type="hidden" name="seo_title" value={hidden.russian.seoTitle} />
      <input
        type="hidden"
        name="seo_description"
        value={hidden.russian.seoDescription}
      />
      <input
        type="hidden"
        name="seo_keywords"
        value={hidden.russian.seoKeywords}
      />
      <input
        type="hidden"
        name="canonical_url"
        value={hidden.russian.canonicalUrl}
      />
      <input type="hidden" name="og_title" value={hidden.russian.ogTitle} />
      <input
        type="hidden"
        name="og_description"
        value={hidden.russian.ogDescription}
      />
      <input type="hidden" name="sources" value={hidden.russian.sources} />
      <input
        type="hidden"
        name="bibliography"
        value={hidden.russian.bibliography}
      />

      <input
        type="hidden"
        name="english_enabled"
        value={hidden.english.enabled ? "on" : ""}
      />
      <input type="hidden" name="english_title" value={hidden.english.title} />
      <input
        type="hidden"
        name="english_subtitle"
        value={hidden.english.subtitle}
      />
      <input
        type="hidden"
        name="english_excerpt"
        value={hidden.english.excerpt}
      />
      <input type="hidden" name="english_slug" value={hidden.english.slug} />
      <input
        type="hidden"
        name="english_content_html"
        value={hidden.english.contentHtml}
      />
      <input
        type="hidden"
        name="english_content_json"
        value={hidden.english.contentJson}
      />
      <input
        type="hidden"
        name="english_cover_alt"
        value={hidden.english.coverAlt}
      />
      <input
        type="hidden"
        name="english_seo_title"
        value={hidden.english.seoTitle}
      />
      <input
        type="hidden"
        name="english_seo_description"
        value={hidden.english.seoDescription}
      />
      <input
        type="hidden"
        name="english_seo_keywords"
        value={hidden.english.seoKeywords}
      />
      <input
        type="hidden"
        name="english_canonical_url"
        value={hidden.english.canonicalUrl}
      />
      <input
        type="hidden"
        name="english_og_title"
        value={hidden.english.ogTitle}
      />
      <input
        type="hidden"
        name="english_og_description"
        value={hidden.english.ogDescription}
      />
      <input
        type="hidden"
        name="english_sources"
        value={hidden.english.sources}
      />
      <input
        type="hidden"
        name="english_bibliography"
        value={hidden.english.bibliography}
      />
      <input
        type="hidden"
        name="english_status"
        value={hidden.english.status}
      />
      <input
        type="hidden"
        name="english_confirm_current_source"
        value={hidden.english.confirmedCurrentSource ? "on" : ""}
      />
      <input
        type="hidden"
        name="publication_override"
        value={hidden.publication.override}
      />

      {children}
    </form>
  );
}
