import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const pickerSource = readFileSync(
  new URL("./ArticleCopyPicker.tsx", import.meta.url),
  "utf8"
);

describe("article copy workflow", () => {
  it("makes the safe persisted copy the primary action", () => {
    expect(pickerSource).toContain("Создать копию и редактировать");
    expect(pickerSource).toContain("duplicateArticleAction");
    expect(pickerSource).toContain("исходная статья не изменится");
  });

  it("keeps the existing copyFrom route available", () => {
    expect(pickerSource).toContain(
      "/articles/new?copyFrom=${encodeURIComponent(article.id)}"
    );
    expect(pickerSource).toContain("Открыть без создания копии");
  });
});
