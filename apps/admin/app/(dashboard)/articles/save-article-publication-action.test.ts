import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveCanonicalArticleAction } = vi.hoisted(() => ({
  saveCanonicalArticleAction: vi.fn(),
}));

vi.mock("./save-article-action", () => ({
  saveArticleAction: saveCanonicalArticleAction,
}));

import { saveArticleAction } from "./save-article-publication-action";

describe("article publication action adapter", () => {
  beforeEach(() => saveCanonicalArticleAction.mockReset());

  it("passes Russian-only intent through the canonical guarded save", async () => {
    const formData = new FormData();
    formData.set("intent", "publish-ru");
    formData.set("russian_publication_ready", "yes");
    formData.set("english_enabled", "on");
    formData.set("expected_updated_at", "article-version");
    formData.set("english_expected_updated_at", "translation-version");

    await saveArticleAction(formData);

    expect(saveCanonicalArticleAction).toHaveBeenCalledExactlyOnceWith(formData);
    expect(formData.get("intent")).toBe("publish");
    expect(formData.get("publication_ready")).toBe("yes");
    expect(formData.has("english_enabled")).toBe(false);
    expect(formData.get("skip_automatic_translation")).toBe("1");
    expect(formData.get("expected_updated_at")).toBe("article-version");
    expect(formData.get("english_expected_updated_at")).toBe("translation-version");
  });

  it("does not swallow a canonical access, validation or redirect failure", async () => {
    const failure = new Error("canonical save stopped");
    saveCanonicalArticleAction.mockRejectedValueOnce(failure);
    const formData = new FormData();
    formData.set("intent", "save");

    await expect(saveArticleAction(formData)).rejects.toBe(failure);
    expect(formData.get("intent")).toBe("save");
  });
});
