import { describe, expect, it } from "vitest";

import {
  atomicEnglishMode,
  buildArticleBundleRpcInput,
} from "./article-bundle-payload";

describe("atomic article bundle payload", () => {
  it("normalizes a full bilingual article save into one RPC request", () => {
    const result = buildArticleBundleRpcInput({
      articleId: "00000000-0000-4000-8000-000000000101",
      expectedArticleUpdatedAt: "2026-08-22T09:00:00.000Z",
      articlePayload: { title: "RU", status: "published" },
      englishMode: "save",
      englishPayload: { title: "EN", status: "published" },
      expectedEnglishUpdatedAt: "2026-08-22T09:00:01.000Z",
      previousPublicPath: "/old",
      nextPublicPath: "/new",
      replaceHomepage: true,
      auditAction: "article.updated",
      auditMetadata: { status: "published" },
      socialPublishRequested: true,
      socialMetadata: { platforms: ["dzen"] },
    });

    expect(result.englishMode).toBe("save");
    expect(result.englishPayload).toEqual({
      title: "EN",
      status: "published",
    });
    expect(result.redirectSourcePath).toBe("/old");
    expect(result.redirectDestinationPath).toBe("/new");
    expect(result.replaceHomepage).toBe(true);
    expect(result.socialPublishRequested).toBe(true);
  });

  it("does not create a redirect when the public path is unchanged", () => {
    const result = buildArticleBundleRpcInput({
      articleId: null,
      expectedArticleUpdatedAt: null,
      articlePayload: { title: "Draft" },
      englishMode: "none",
      previousPublicPath: "/same",
      nextPublicPath: "/same",
      auditAction: "article.created",
      auditMetadata: {},
    });

    expect(result.redirectSourcePath).toBeNull();
    expect(result.redirectDestinationPath).toBeNull();
    expect(result.englishPayload).toBeNull();
    expect(result.expectedEnglishUpdatedAt).toBeNull();
  });

  it("selects the English transaction mode from editor state", () => {
    expect(
      atomicEnglishMode({
        hasEnglishDraft: true,
        staleReleasedEnglishOnDisable: false,
      })
    ).toBe("save");
    expect(
      atomicEnglishMode({
        hasEnglishDraft: false,
        staleReleasedEnglishOnDisable: true,
      })
    ).toBe("stale");
    expect(
      atomicEnglishMode({
        hasEnglishDraft: false,
        staleReleasedEnglishOnDisable: false,
      })
    ).toBe("none");
  });
});
