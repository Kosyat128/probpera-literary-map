import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { ARTICLE_BOOK_PAGE, articleBookHyphenationPoints, articleBookTextStyle, layoutArticleBookLine, paginateArticleBook, parseArticleBookHtml, type ArticleBookInput, type ArticleBookMeasure, type ArticleBookTextCommand, type ArticleBookTree } from "./articleBookPages";

type ParsedNode = {type: string; name?: string; data?: string; attribs?: Record<string, string>; children?: ParsedNode[]};
function readTree(html: string): ArticleBookTree {
  const convert = (node: ParsedNode): ArticleBookTree => node.type === "text" ? {text: node.data || ""} : {tag: node.name || "body", attributes: node.attribs, children: node.children?.map(convert)};
  return convert(load(html).root()[0]);
}
const measure: ArticleBookMeasure = (text, style) => Array.from(text.replace(/\n/gu, "")).length * style.size * (style.weight === 600 ? .57 : .53);
const input = (html: string, overrides: Partial<ArticleBookInput> = {}): ArticleBookInput => ({articleId: "article-test", title: "Полная статья", sectionLabel: "Литература", locale: "ru", html, ...overrides});
const tight = (value: string) => value.replace(/\s/gu, "");

describe("article book pagination", () => {
  it("preserves the complete first, middle and final article text beyond 36 pages, with every image in source order", () => {
    const html = Array.from({length: 180}, (_, index) => `<p>MARKER_${index} ${"Каждое слово исходного текста остаётся доступным читателю. ".repeat(6)}</p>${index % 30 === 0 ? `<figure><img src="/image-${index}.png" alt="Иллюстрация ${index}"><figcaption>Подпись ${index}</figcaption></figure>` : ""}`).join("") + "<p>FINAL_MARKER</p>";
    const blocks = parseArticleBookHtml(html, readTree);
    const {pages} = paginateArticleBook(input(html), blocks, measure);
    expect(pages.length).toBeGreaterThan(36);
    const preserved = pages.flatMap(page => page.articleLayout).flatMap(command => command.kind === "text" && command.block.id !== "article-title" ? command.runs.map(run => run.text) : []).join("");
    const original = blocks.flatMap(block => block.kind === "text" ? block.runs.map(run => run.text) : []).join("");
    expect(tight(preserved)).toBe(tight(original));
    expect(pages[0].text).toContain("MARKER_0");
    expect(pages.some(page => page.text.includes("MARKER_90"))).toBe(true);
    expect(pages.some(page => page.text.includes("MARKER_179"))).toBe(true);
    expect(pages[pages.length - 1]?.text.trim()).toMatch(/FINAL_MARKER$/u);
    const images = pages.flatMap(page => page.articleLayout).flatMap(command => command.kind === "image" ? [command.block.src] : []);
    expect(images).toEqual([0, 30, 60, 90, 120, 150].map(index => `/image-${index}.png`));
    expect(load(pages.map(page => page.html).join("")).root().find("img").toArray().map(image => image.attribs.src)).toEqual(images);
  });

  it("keeps emphasis, links, numbered/nested lists, captions and all table cells", () => {
    const html = '<h2>Глава</h2><p>Обычный <strong>важный</strong> и <em>курсивный</em> <a href="https://example.com/source">источник</a>.</p><ol start="3"><li>Третий пункт<ul><li>Вложенный пункт</li></ul></li><li>Четвёртый пункт</li></ol><figure><img src="/portrait.png" alt="Портрет"><figcaption><p>Полная <em>подпись</em></p></figcaption></figure><table><thead><tr><th>Название</th><th>Год</th></tr></thead><tbody><tr><td>Первая книга</td><td>1900</td></tr><tr><td>Последняя книга</td><td>2026</td></tr></tbody></table><p>Конец.</p>';
    const blocks = parseArticleBookHtml(html, readTree);
    const {pages} = paginateArticleBook(input(html), blocks, measure);
    const markup = load(pages.map(page => page.html).join(""));
    expect(markup("strong").text()).toContain("важный");
    expect(markup("em").text()).toContain("курсивный");
    expect(markup('a[href="https://example.com/source"]').text()).toBe("источник");
    expect(markup("ol").first().attr("start")).toBe("3");
    expect(markup("li").text()).toContain("Вложенный пункт");
    expect(markup(".article-book-page-caption").text()).toBe("Полная подпись");
    for (const cell of ["Название", "Год", "Первая книга", "1900", "Последняя книга", "2026"]) expect(markup.root().text()).toContain(cell);
    expect(markup.root().text()).toContain("Конец.");
  });

  it("splits very long unbroken strings without clipping, dropping characters or exceeding the page bottom", () => {
    const unbroken = "https://example.com/" + "длинныйидентификатор".repeat(600);
    const html = `<p>Начало <a href="https://example.com/">${unbroken}</a> конец</p>`;
    const blocks = parseArticleBookHtml(html, readTree);
    const {pages} = paginateArticleBook(input(html, {fontScale: 1.3}), blocks, measure);
    const commands = pages.flatMap(page => page.articleLayout);
    expect(commands.filter(command => command.kind === "text").map(command => command.runs.map(run => run.text).join("")).join("")).toContain(unbroken);
    for (const command of commands) {
      expect(command.x + command.width).toBeLessThanOrEqual(ARTICLE_BOOK_PAGE.width - ARTICLE_BOOK_PAGE.right + .01);
      expect(command.y + command.height).toBeLessThanOrEqual(ARTICLE_BOOK_PAGE.height - ARTICLE_BOOK_PAGE.bottom + .01);
    }
  });

  it("retains cover and inline occurrences and keys new content, language and font scale separately", () => {
    const html = '<p>Материал</p><img src="/same.png" alt="Иллюстрация">';
    const source = parseArticleBookHtml(html, readTree);
    const base = input(html, {coverUrl: "/same.png"});
    const first = paginateArticleBook(base, source, measure);
    expect(first.pages.flatMap(page => page.articleLayout).filter(command => command.kind === "image")).toHaveLength(2);
    for (const override of [{fontScale: 1.3}, {locale: "en" as const}, {html: `${html}<p>Новый текст</p>`}]) {
      expect(paginateArticleBook({...base, ...override}, source, measure).document.cacheKey).not.toBe(first.document.cacheKey);
    }
  });

  it("fits the mobile reading scale through 3.6 without clipping list markers or creating an empty last page", () => {
    const html = '<h2>Подробное название раздела статьи</h2><ol start="100"><li>Важный пункт с длинным текстом, который переносится на несколько строк.</li></ol><figure><img src="/full.png" alt="Полная иллюстрация" width="600" height="900"><figcaption>Полная подпись к изображению</figcaption></figure><p>Последний короткий абзац.</p>';
    const source = parseArticleBookHtml(html, readTree);
    for (const fontScale of [1.8, 2.2, 2.86, 3.6]) {
      const {pages} = paginateArticleBook(input(html, {fontScale}), source, measure);
      expect(pages[pages.length - 1].articleLayout.length).toBeGreaterThan(0);
      expect(pages[pages.length - 1].text).toContain("абзац.");
      for (const command of pages.flatMap(page => page.articleLayout)) {
        expect(command.y + command.height).toBeLessThanOrEqual(ARTICLE_BOOK_PAGE.height - ARTICLE_BOOK_PAGE.bottom + .01);
        expect(command.x + command.width).toBeLessThanOrEqual(ARTICLE_BOOK_PAGE.width - ARTICLE_BOOK_PAGE.right + .01);
        if (command.kind === "text" && command.block.role === "body") expect(command.size).toBe(56 * fontScale);
        if (command.kind === "text" && command.prefix) expect(command.x - 14 - measure(command.prefix, {size: command.prefixSize || command.size, weight: 400, italic: false, leading: 1.45})).toBeGreaterThanOrEqual(ARTICLE_BOOK_PAGE.left);
      }
    }
  });

  it("preserves inline vector illustrations and their accessible labels", () => {
    const html = '<p>До схемы.</p><svg viewBox="0 0 480 320" aria-label="Схема сюжета"><title>Развитие сюжета</title><path d="M10 10L200 100" stroke="#333"></path><text x="12" y="40">Первая сцена</text><text x="200" y="100">Финал</text></svg><p>После схемы.</p>';
    const source = parseArticleBookHtml(html, readTree);
    const vector = source.find(block => block.kind === "image");
    expect(vector?.kind).toBe("image");
    if (vector?.kind !== "image") throw new Error("Missing vector illustration");
    expect(vector.src).toMatch(/^data:image\/svg\+xml/);
    expect(vector.width).toBe(480);
    expect(vector.height).toBe(320);
    const {pages} = paginateArticleBook(input(html), source, measure);
    const markup = load(pages.map(page => page.html).join(""));
    expect(markup("svg path")).toHaveLength(1);
    expect(markup("svg").text()).toBe("Развитие сюжетаПервая сценаФинал");
    expect(pages.map(page => page.text).join("")).toContain("Первая сценаФинал");
  });

  it("justifies measured prose while preserving styled runs and ignoring visual edge spaces", () => {
    const runs = [{text: "  Первый "}, {text: "важный", bold: true}, {text: " и "}, {text: "полезный", italic: true, href: "https://example.com/"}, {text: " текст  "}];
    const before = JSON.stringify(runs);
    for (const role of ["body", "list", "quote"] as const) {
      const style = articleBookTextStyle(role);
      const natural = layoutArticleBookLine(runs, 2000, role, style, measure, true);
      const gaps = natural.drawRuns.filter(run => run.text === " ").length;
      const width = natural.width + gaps * style.size * .25;
      const line = layoutArticleBookLine(runs, width, role, style, measure, false);
      expect(line.justified).toBe(true);
      expect(line.width).toBeCloseTo(width);
      expect(line.wordSpacing).toBeCloseTo(style.size * .25);
      expect(line.drawRuns[0].text).toBe("Первый");
      expect(line.drawRuns[line.drawRuns.length - 1].text).toBe("текст");
      expect(line.drawRuns.find(run => run.text === "важный")?.run.bold).toBe(true);
      expect(line.drawRuns.find(run => run.text === "полезный")?.run).toMatchObject({italic: true, href: "https://example.com/"});
      line.drawRuns.forEach((run, index) => {
        if (index > 0) expect(run.x).toBeCloseTo(line.drawRuns[index - 1].x + line.drawRuns[index - 1].width);
      });
    }
    expect(JSON.stringify(runs)).toBe(before);
  });

  it("leaves final lines, forced breaks, headings, captions and single tokens aligned left", () => {
    const runs = [{text: "Текст на последней строке"}];
    for (const role of ["title", "heading", "caption", "pre"] as const) {
      expect(layoutArticleBookLine(runs, 1800, role, articleBookTextStyle(role), measure, false).justified).toBe(false);
    }
    const style = articleBookTextStyle("body");
    expect(layoutArticleBookLine(runs, 1800, "body", style, measure, true).justified).toBe(false);
    expect(layoutArticleBookLine(runs, 1800, "body", style, measure, false, true).justified).toBe(false);
    const sparse = layoutArticleBookLine([{text: "Единственноеслово"}], 1128, "body", style, measure, false);
    expect(sparse.justified).toBe(false);
    expect(sparse.wordSpacing).toBe(0);
    expect(sparse.width).toBeLessThan(1128);
    const twoWords = layoutArticleBookLine([{text: "Обычная строка"}], 1128, "body", style, measure, false);
    expect(twoWords.justified).toBe(true);
    expect(twoWords.width).toBeCloseTo(1128);
  });

  it("keeps author-supplied soft hyphens semantic while drawing a hyphen only at the chosen break", () => {
    const html = "<p>Вступление к эксперимен\u00adтально\u00adлитературному исследованию завершено.</p>";
    const source = parseArticleBookHtml(html, readTree);
    const {pages} = paginateArticleBook(input(html), source, measure);
    const commands = pages.flatMap(page => page.articleLayout).filter((command): command is ArticleBookTextCommand => command.kind === "text" && command.block.id !== "article-title");
    const original = source.flatMap(block => block.kind === "text" ? block.runs.map(run => run.text) : []).join("");
    expect(commands.flatMap(command => command.runs.map(run => run.text)).join("")).toBe(original);
    expect(commands.some(command => command.drawRuns.some(run => run.text.endsWith("-")))).toBe(true);
    expect(commands.flatMap(command => command.drawRuns).some(run => run.text.includes("\u00ad"))).toBe(false);
  });

  it("uses language dictionary boundaries while excluding URLs, identifiers and authored soft hyphens", () => {
    expect(articleBookHyphenationPoints("экспериментально", "ru")).toEqual([3, 5, 7, 10, 14]);
    expect(articleBookHyphenationPoints("understanding", "en")).toEqual([2, 5, 10]);
    expect(articleBookHyphenationPoints("«литературному»,", "ru")).toEqual([3, 5, 7, 10, 12]);
    for (const token of ["https://example.com/understanding", "reader@example.com", "literature2026", "экспери\u00adментально", "2026", "мир"]) {
      expect(articleBookHyphenationPoints(token, "ru")).toEqual([]);
      expect(articleBookHyphenationPoints(token, "en")).toEqual([]);
    }
  });

  it("fills large prose gaps with dictionary breaks without changing copied text or inline emphasis", () => {
    const width = ARTICLE_BOOK_PAGE.width - ARTICLE_BOOK_PAGE.left - ARTICLE_BOOK_PAGE.right;
    for (const fixture of [
      {locale: "ru" as const, lead: "Текст для ", word: "экспериментального", tail: " исследования литературы помогает внимательному читателю."},
      {locale: "en" as const, lead: "A book about ", word: "extraordinary", tail: " understanding of literature rewards the attentive reader."},
    ]) {
      const html = `<p>${fixture.lead}<em><a href="https://example.test/source">${fixture.word}</a></em>${fixture.tail}</p>`;
      const source = parseArticleBookHtml(html, readTree);
      const {pages} = paginateArticleBook(input(html, {locale: fixture.locale, fontScale: 1.8}), source, measure);
      const commands = pages.flatMap(page => page.articleLayout).filter((command): command is ArticleBookTextCommand => command.kind === "text" && command.block.id !== "article-title");
      const expected = fixture.lead + fixture.word + fixture.tail;
      expect(commands.flatMap(command => command.runs.map(run => run.text)).join("")).toBe(expected);
      expect(load(pages.map(page => page.html).join("")).text().replace(input(html).title, "")).toBe(expected);
      const first = commands[0];
      const split = first.runs.find(run => run.displayText?.endsWith("-"));
      expect(split).toMatchObject({italic: true, href: "https://example.test/source"});
      expect(articleBookHyphenationPoints(fixture.word, fixture.locale)).toContain(split?.text.length);
      const previous = layoutArticleBookLine([{text: fixture.lead}], width, "body", articleBookTextStyle("body", 1.8), measure, false);
      expect(first.wordSpacing).toBeLessThan(previous.wordSpacing * .25);
      expect(first.width).toBeCloseTo(width);
      expect(pages.map(page => page.html).join("")).not.toContain("\u00ad");
    }
  });

  it("keeps dictionary hyphenation out of headings, captions, tables and preformatted text", () => {
    const html = "<h2>Текст для экспериментального исследования</h2><figure><figcaption>Текст для экспериментального исследования</figcaption></figure><table><tr><td>Текст для экспериментального исследования</td></tr></table><pre>Текст для экспериментального исследования</pre>";
    const {pages} = paginateArticleBook(input(html, {fontScale: 1.8}), parseArticleBookHtml(html, readTree), measure);
    const commands = pages.flatMap(page => page.articleLayout).filter((command): command is ArticleBookTextCommand => command.kind === "text");
    expect(commands.flatMap(command => command.runs).some(run => run.displayText?.endsWith("-"))).toBe(false);
  });

  it("prefers authored compound hyphens, preserves their character and keeps nonbreaking hyphens intact", () => {
    for (const hyphen of ["-", "\u2010", "\u2011"]) {
      const text = `Текст лишь для гонзо${hyphen}журналистики помогает изучению литературы.`;
      const html = `<p>${text}</p>`;
      const {pages} = paginateArticleBook(input(html, {fontScale: 1.8}), parseArticleBookHtml(html, readTree), measure);
      const commands = pages.flatMap(page => page.articleLayout).filter((command): command is ArticleBookTextCommand => command.kind === "text" && command.block.id !== "article-title");
      expect(commands.flatMap(command => command.runs.map(run => run.text)).join("")).toBe(text);
      if (hyphen === "\u2011") {
        expect(commands[0].runs.some(run => run.text.includes("\u2011"))).toBe(false);
        expect(commands.some(command => command.runs[command.runs.length - 1]?.text.endsWith("\u2011"))).toBe(false);
      } else {
        const ending = commands[0].runs[commands[0].runs.length - 1];
        expect(ending.text).toBe(`гонзо${hyphen}`);
        expect(ending.displayText).toBeUndefined();
        expect(commands[0].wordSpacing).toBeLessThan(articleBookTextStyle("body", 1.8).size * 2);
      }
    }
  });

  it("can continue past an early compound hyphen to avoid an unnecessarily sparse justified line", () => {
    const text = "Текст для гонзо-журналистики помогает изучению литературы.";
    const html = `<p>${text}</p>`;
    const {pages} = paginateArticleBook(input(html, {fontScale: 1.8}), parseArticleBookHtml(html, readTree), measure);
    const commands = pages.flatMap(page => page.articleLayout).filter((command): command is ArticleBookTextCommand => command.kind === "text" && command.block.id !== "article-title");
    expect(commands[0].runs[commands[0].runs.length - 1]).toMatchObject({text: "гонзо-жур", displayText: "гонзо-жур-"});
    expect(commands[0].wordSpacing).toBeLessThan(articleBookTextStyle("body", 1.8).size * .6);
    expect(commands.flatMap(command => command.runs.map(run => run.text)).join("")).toBe(text);
  });
});
