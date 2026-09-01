import { describe, expect, it, vi } from "vitest";

import {
  articleWithWorkingDraft,
  articleWorkingDraftEnglishEnvelope,
  discardArticleWorkingDraftRpc,
  englishTranslationWithWorkingDraft,
  parseArticleWorkingDraft,
  previewEnglishTranslationWithWorkingDraft,
  saveArticleWorkingDraftRpc,
} from "./article-working-draft";

const articlePayload = {
  title: "Рабочий черновик",
  subtitle: "",
  excerpt: "Описание",
  slug: "rabochiy-chernovik",
  content_html: "<p>Текст</p>",
  content_json: { type: "doc", content: [] },
  category_id: null,
  status: "draft" as const,
  scheduled_at: null,
  published_at: null,
  cover_external_url: null,
  cover_alt: "",
  legacy_path: null,
  seo_title: "Рабочий черновик",
  seo_description: "Описание",
  seo_keywords: [],
  canonical_url: "https://example.test/articles/rabochiy-chernovik",
  og_title: "Рабочий черновик",
  og_description: "Описание",
  allow_indexing: true,
  sources: [],
  bibliography: [],
  featured: false,
  show_on_homepage: false,
  pinned: false,
};

const row = {
  article_id: "11111111-1111-4111-8111-111111111111",
  base_article_updated_at: "2026-09-02T10:00:00.000Z",
  payload: articlePayload,
  english_payload: { mode: "disabled" as const },
  expected_english_updated_at: "2026-09-02T09:00:00.000Z",
  version: 2,
  updated_at: "2026-09-02T10:05:00.000Z",
};

describe("published article working drafts", () => {
  it("overlays only private payload while preserving the captured live CAS", () => {
    const draft = parseArticleWorkingDraft(row);
    expect(
      articleWithWorkingDraft(
        {
          id: row.article_id,
          title: "Публичная версия",
          updated_at: "2026-09-02T11:00:00.000Z",
        },
        draft
      )
    ).toMatchObject({
      id: row.article_id,
      title: "Рабочий черновик",
      updated_at: row.base_article_updated_at,
      working_draft_version: 2,
      status: "draft",
    });
  });

  it("represents a disabled English draft without re-enabling the editor", () => {
    const draft = parseArticleWorkingDraft(row);
    expect(
      englishTranslationWithWorkingDraft(
        { id: "live-en", title: "Live", updated_at: row.expected_english_updated_at },
        draft
      )
    ).toEqual({ updated_at: row.expected_english_updated_at });
    expect(
      previewEnglishTranslationWithWorkingDraft(
        { id: "live-en", title: "Live" },
        draft
      )
    ).toBeNull();
  });

  it("rejects malformed or public-status payloads instead of overlaying them", () => {
    expect(() =>
      parseArticleWorkingDraft({
        ...row,
        payload: { ...articlePayload, status: "published" },
      })
    ).toThrow("Рабочий черновик повреждён");
  });

  it("calls the CAS RPC with a bounded English envelope", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        articleId: row.article_id,
        version: 1,
        updatedAt: row.updated_at,
      },
      error: null,
    });
    const result = await saveArticleWorkingDraftRpc(
      { rpc } as never,
      {
        articleId: row.article_id,
        baseArticleUpdatedAt: row.base_article_updated_at,
        articlePayload,
        englishEnvelope: articleWorkingDraftEnglishEnvelope(null),
        expectedEnglishUpdatedAt: row.expected_english_updated_at,
        expectedVersion: 0,
      }
    );
    expect(result.version).toBe(1);
    expect(rpc).toHaveBeenCalledWith("save_article_working_draft", {
      p_article_id: row.article_id,
      p_base_article_updated_at: row.base_article_updated_at,
      p_payload: articlePayload,
      p_english_payload: { mode: "disabled" },
      p_expected_english_updated_at: row.expected_english_updated_at,
      p_expected_version: 0,
    });
  });

  it("maps provider errors to stable operator copy", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "secret detail: english-version-conflict" },
    });
    await expect(
      saveArticleWorkingDraftRpc({ rpc } as never, {
        articleId: row.article_id,
        baseArticleUpdatedAt: row.base_article_updated_at,
        articlePayload,
        englishEnvelope: { mode: "disabled" },
        expectedEnglishUpdatedAt: row.expected_english_updated_at,
        expectedVersion: 0,
      })
    ).rejects.toThrow("Английская версия уже изменена");
  });

  it("discards only the expected draft version", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { articleId: row.article_id, discarded: true },
      error: null,
    });
    await expect(
      discardArticleWorkingDraftRpc({ rpc } as never, {
        articleId: row.article_id,
        expectedVersion: 2,
      })
    ).resolves.toEqual({ articleId: row.article_id, discarded: true });
    expect(rpc).toHaveBeenCalledWith("discard_article_working_draft", {
      p_article_id: row.article_id,
      p_expected_version: 2,
    });
  });
});
