import { afterEach, describe, expect, it, vi } from "vitest";

import {
  promoteArticleWorkingDraftRpc,
  saveArticleBundleRpc,
  type ArticleBundleRpcInput,
} from "./article-bundle-rpc";

const articleId = "11111111-1111-4111-8111-111111111111";
const expectedUpdatedAt = "2026-09-02T10:00:00.000Z";
const bundleInput: ArticleBundleRpcInput = {
  articleId,
  expectedArticleUpdatedAt: expectedUpdatedAt,
  articlePayload: { status: "published", title: "Статья" },
  englishMode: "none",
  englishPayload: null,
  expectedEnglishUpdatedAt: null,
  redirectSourcePath: null,
  redirectDestinationPath: null,
  replaceHomepage: false,
  auditAction: "article.updated",
  auditMetadata: {},
  socialPublishRequested: false,
  socialMetadata: {},
};

describe("article working-draft promotion RPC client", () => {
  afterEach(() => vi.restoreAllMocks());
  it("sends the exact working-draft CAS version with the bundle", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          article_id: articleId,
          article_updated_at: "2026-09-02T10:05:00.000Z",
          english_updated_at: null,
          homepage_replaced: 0,
        },
      ],
      error: null,
    });

    await expect(
      promoteArticleWorkingDraftRpc({ rpc } as never, {
        ...bundleInput,
        expectedWorkingDraftVersion: 4,
      })
    ).resolves.toMatchObject({ articleId, homepageReplaced: 0 });
    expect(rpc).toHaveBeenCalledWith(
      "promote_article_working_draft",
      expect.objectContaining({
        p_article_id: articleId,
        p_expected_article_updated_at: expectedUpdatedAt,
        p_expected_working_draft_version: 4,
        p_article_payload: bundleInput.articlePayload,
      })
    );
  });

  it("maps a stale working draft to safe actionable copy", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "private detail: WORKING_DRAFT_CONFLICT" },
    });
    await expect(
      promoteArticleWorkingDraftRpc({ rpc } as never, {
        ...bundleInput,
        expectedWorkingDraftVersion: 0,
      })
    ).rejects.toThrow("Рабочий черновик уже изменён в другой вкладке");
  });

  it("rejects an incomplete promotion before contacting the database", async () => {
    const rpc = vi.fn();
    await expect(
      promoteArticleWorkingDraftRpc({ rpc } as never, {
        ...bundleInput,
        articleId: null,
        expectedWorkingDraftVersion: 0,
      })
    ).rejects.toThrow("Не удалось безопасно подтвердить выпуск статьи");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a permission failure without blaming English or exposing server details", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "private SQL and credential details" },
    });
    await expect(saveArticleBundleRpc({ rpc } as never, bundleInput))
      .rejects.toThrow("ARTICLE_SAVE_PERMISSION");
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith("article-publication-rpc-failed", {
      operation: "save_article_bundle", code: "42501",
    });
    expect(JSON.stringify(diagnostic.mock.calls)).not.toContain("private");
  });

  it("explains an address conflict and logs no arbitrary provider content", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => {});
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "private-value", message: "REDIRECT_LIVE_ROUTE_COLLISION: private SQL" },
    });
    await expect(saveArticleBundleRpc({ rpc } as never, bundleInput))
      .rejects.toThrow("прежний адрес связан с другой страницей");
    expect(diagnostic).toHaveBeenCalledExactlyOnceWith("article-publication-rpc-failed", {
      operation: "save_article_bundle", code: "unknown",
    });
  });
  const validReply = { article_id: articleId, article_updated_at: "2026-09-02T10:05:00.123456+00:00",
    english_updated_at: "2026-09-02T10:04:00.654321+00:00", homepage_replaced: 2 };
  it.each([validReply, [validReply]])("preserves the exact typed SQL receipt and microsecond bytes %#", async data => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    expect(await saveArticleBundleRpc({ rpc } as never, bundleInput)).toEqual({ articleId,
      articleUpdatedAt: validReply.article_updated_at, englishUpdatedAt: validReply.english_updated_at,
      homepageReplaced: 2 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each([[], [validReply, validReply], { ...validReply, article_id: [articleId] },
    { ...validReply, article_id: "PRIVATE_TOKEN=do_not_render" }, { ...validReply, article_updated_at: "invalid" },
    { ...validReply, english_updated_at: false }, { ...validReply, english_updated_at: 0 },
    { ...validReply, english_updated_at: undefined }, { ...validReply, homepage_replaced: "2" },
    { ...validReply, homepage_replaced: null }, { ...validReply, homepage_replaced: -1 },
    { ...validReply, homepage_replaced: 1.5 }, { ...validReply, homepage_replaced: 2_147_483_648 },
    { ...validReply, undocumented: "PRIVATE_TOKEN=do_not_render" },
  ])("refuses damaged SQL receipt without coercing it into acknowledgement %#", async data => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    await expect(saveArticleBundleRpc({ rpc } as never, bundleInput)).rejects.toThrow("неполный результат");
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["save", "promote"])("refuses a receipt for another article on %s", async operation => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...validReply, article_id: "22222222-2222-4222-8222-222222222222" }], error: null });
    const run = operation === "save" ? saveArticleBundleRpc({ rpc } as never, bundleInput)
      : promoteArticleWorkingDraftRpc({ rpc } as never, { ...bundleInput, expectedWorkingDraftVersion: 4 });
    await expect(run).rejects.toThrow("неверный идентификатор"); expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("accepts new-article identity and case-equivalent existing identity without changing original receipt bytes", async () => {
    const uuid = "abcdef00-1111-4111-8111-000000000001";
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...validReply, article_id: uuid.toUpperCase() }], error: null });
    expect((await saveArticleBundleRpc({ rpc } as never, { ...bundleInput, articleId: null })).articleId).toBe(uuid.toUpperCase());
    expect((await saveArticleBundleRpc({ rpc } as never, { ...bundleInput, articleId: uuid })).articleId).toBe(uuid.toUpperCase());
  });
});
