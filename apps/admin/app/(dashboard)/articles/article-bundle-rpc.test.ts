import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  promoteArticleWorkingDraftRpc,
  saveArticleBundleRpc,
  type ArticleBundleRpcInput,
} from "./article-bundle-rpc";
import { UnconfirmedArticleSaveError } from "./article-save-result";

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

function clientWithFetch(fetchImpl: typeof fetch) {
  return createClient("https://editorial-test.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchImpl },
  });
}

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

  it.each([
    ["disconnect", new TypeError("private socket failure")],
    ["timeout", new DOMException("private timeout detail", "TimeoutError")],
  ])("keeps a new insert unconfirmed without retry after a real SDK %s", async (_case, failure) => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(failure);
    const result = saveArticleBundleRpc(clientWithFetch(fetchImpl), {
      ...bundleInput, articleId: null, expectedArticleUpdatedAt: null,
    });
    await expect(result).rejects.toBeInstanceOf(UnconfirmedArticleSaveError);
    await expect(result).rejects.not.toThrow("private");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0][1]?.method).toBe("POST");
  });

  it.each([408, 502, 503, 504])("keeps an interrupted bilingual promotion unconfirmed on HTTP %s", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ message: "private gateway detail" }, { status })
    );
    await expect(promoteArticleWorkingDraftRpc(clientWithFetch(fetchImpl), {
      ...bundleInput, englishMode: "save", englishPayload: { title: "English title" },
      expectedEnglishUpdatedAt: expectedUpdatedAt, expectedWorkingDraftVersion: 4,
    })).rejects.toBeInstanceOf(UnconfirmedArticleSaveError);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      p_article_id: articleId, p_expected_english_updated_at: expectedUpdatedAt,
      p_expected_working_draft_version: 4,
    });
  });

  it.each([
    [402, "", "provider quota", "Редакционная база временно ограничила запросы"],
    [401, "", "expired", "Недостаточно прав"],
    [403, "42501", "permission", "ARTICLE_SAVE_PERMISSION"],
    [400, "P0001", "ARTICLE_CONFLICT", "Статья уже изменена"],
    [400, "P0001", "ENGLISH_CONFLICT", "Английская версия уже изменена"],
    [409, "23505", "duplicate", "уже занят"],
  ])("keeps known HTTP %s %s rejections actionable", async (status, code, provider, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ code, message: `${provider} private data`, details: "private data", hint: "" }, { status })
    );
    const error = await saveArticleBundleRpc(clientWithFetch(fetchImpl), bundleInput).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(UnconfirmedArticleSaveError);
    expect((error as Error).message).toContain(message);
    expect((error as Error).message).not.toContain("private");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it.each([null, [], { article_id: articleId }, {
    article_id: "22222222-2222-4222-8222-222222222222", article_updated_at: expectedUpdatedAt,
  }])("keeps a nonmatching successful save receipt unconfirmed (%j)", async (data) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(data));
    await expect(saveArticleBundleRpc(clientWithFetch(fetchImpl), bundleInput))
      .rejects.toBeInstanceOf(UnconfirmedArticleSaveError);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
