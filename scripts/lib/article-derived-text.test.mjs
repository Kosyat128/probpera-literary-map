import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "cheerio";

function normalizedText(value = "") {
  return String(value).replace(/\s+/gu, " ").trim();
}

function plainTextFromHtml(contentHtml = "") {
  const $ = load(`<main id="article-test-root">${contentHtml}</main>`, {
    decodeEntities: false,
  });
  return normalizedText($("#article-test-root").text());
}

describe("article derived plain text", () => {
  it("keeps the Fernando Pessoa heading identical to the article HTML", () => {
    const filePath = path.join(
      process.cwd(),
      "public",
      "articles",
      "page--article--unrecognized--writers--6.json"
    );
    const article = JSON.parse(readFileSync(filePath, "utf8"));
    expect(article.plainText).not.toContain(
      "Писатель, создавший множество своих альтер эго?"
    );
    expect(normalizedText(article.plainText)).toBe(
      plainTextFromHtml(article.contentHtml)
    );
  });
});
