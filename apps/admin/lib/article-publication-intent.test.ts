import { describe, expect, it } from "vitest";

import { prepareArticlePublicationIntent } from "./article-publication-intent";

describe("explicit Russian article publication", () => {
  it("releases a ready Russian article without submitting the unfinished English draft", () => {
    const formData = new FormData();
    formData.set("intent", "publish-ru");
    formData.set("english_enabled", "on");
    formData.set("english_title", "Unfinished translation");
    formData.set("english_expected_updated_at", "2026-09-04T00:00:00.000Z");
    formData.set("publication_ready", "no");
    formData.set("russian_publication_ready", "yes");

    prepareArticlePublicationIntent(formData);

    expect(formData.get("intent")).toBe("publish");
    expect(formData.has("english_enabled")).toBe(false);
    expect(formData.get("skip_automatic_translation")).toBe("1");
    expect(formData.get("publication_ready")).toBe("yes");
    expect(formData.get("english_title")).toBe("Unfinished translation");
    expect(formData.get("english_expected_updated_at")).toBe("2026-09-04T00:00:00.000Z");
  });

  it("does not mark an incomplete Russian article ready", () => {
    const formData = new FormData();
    formData.set("intent", "publish-ru");
    formData.set("publication_ready", "yes");

    prepareArticlePublicationIntent(formData);

    expect(formData.get("publication_ready")).toBe("no");
  });

  it.each(["save", "preview", "publish"])("preserves the existing %s operation", (intent) => {
    const formData = new FormData();
    formData.set("intent", intent);
    formData.set("english_enabled", "on");
    formData.set("publication_ready", "no");
    const before = Array.from(formData.entries());

    prepareArticlePublicationIntent(formData);

    expect(Array.from(formData.entries())).toEqual(before);
  });
});
