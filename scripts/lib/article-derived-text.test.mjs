import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import {
  articleBoundaryBreakProtectedContext,
  articleBoundaryBreakSelector,
  articleBoundaryBreaksToRemove,
} from "../../src/utils/articleBoundaryBreaks.ts";

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
  it("removes legacy outer line breaks without changing article text or interior breaks", () => {
    const $ = load(`<main>
      <h2 id="chapter-1"> \n<br>Вступление<br> \n<br> </h2>
      <div> \n<br><strong>Текст</strong><br><br>Второй абзац <a href="/stati/">и ссылка</a><br> </div>
      <section> <br><div> <br>Nested <em>text</em><br> </div><br> </section>
      <p><br>Первая строка<br>Вторая строка<br><br>Следующая строфа<br></p>
      <blockquote><div><br>Quoted verse<br>Second line<br></div></blockquote>
      <pre><div><br>Preformatted<br>text<br></div></pre>
      <div class="poem"><section><br>Authored verse<br>Second line<br></section></div>
      <div><br></div>
      <h3>Title<br>Subtitle</h3>
      <figure><img src="/cover.webp" alt="Cover"><figcaption>Caption<br>Credit</figcaption></figure>
    </main>`, null, false);
    const preserved = $("p,blockquote,pre,.poem,figure,h3").toArray().map((node) => $.html(node));
    const beforeText = normalizedText($("main").text());
    const normalize = () => {
      $("main").find(articleBoundaryBreakSelector).each((_index, element) => {
        if ($(element).closest(articleBoundaryBreakProtectedContext).length) return;
        articleBoundaryBreaksToRemove(element.children, (node) =>
          node.type === "tag" && node.name === "br"
            ? "break"
            : node.type === "text" && /^\s*$/u.test(node.data)
              ? "whitespace"
              : "content"
        ).forEach((node) => $(node).remove());
      });
    };

    normalize();
    expect($("h2").html()).toBe("Вступление");
    expect($("h2").attr("id")).toBe("chapter-1");
    expect($("main > div").first().html()).toBe('<strong>Текст</strong><br><br>Второй абзац <a href="/stati/">и ссылка</a>');
    expect($("section").html()).toBe("<div>Nested <em>text</em></div>");
    expect($("main > div").last().html()).toBe("<br>");
    expect($("p,blockquote,pre,.poem,figure,h3").toArray().map((node) => $.html(node))).toEqual(preserved);
    expect(normalizedText($("main").text())).toBe(beforeText);
    const once = $("main").html();
    normalize();
    expect($("main").html()).toBe(once);
  });

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
