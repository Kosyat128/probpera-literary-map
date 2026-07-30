import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Mention = {
  id: string;
  title: string;
  kind: "review" | "feature" | "mention";
};

type MentionIndex = {
  version: number;
  byBook: Record<string, Mention[]>;
};

const index = JSON.parse(
  readFileSync(
    new URL("../../../public/articles/book-mentions.json", import.meta.url),
    "utf8"
  )
) as MentionIndex;

describe("связи книжного архива с журналом", () => {
  it("показывает рецензию на странице «Морского волка»", () => {
    const mentions = index.byBook["usa:jack_london:the-sea-wolf"] || [];

    expect(mentions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Мнение о книге. Джек Лондон «Морской волк»",
          kind: "review",
        }),
      ])
    );
  });

  it("не создаёт дубликаты одной статьи для одной книги", () => {
    const duplicates = Object.entries(index.byBook).flatMap(
      ([bookKey, mentions]) => {
        const ids = mentions.map((mention) => mention.id);
        return ids.length === new Set(ids).size ? [] : [bookKey];
      }
    );

    expect(duplicates).toEqual([]);
  });
});
