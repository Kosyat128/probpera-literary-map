import { describe, expect, it, vi } from "vitest";

import {
  promoteArticleWorkingDraftRpc,
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
});
