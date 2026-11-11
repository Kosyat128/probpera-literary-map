import { describe, expect, it } from "vitest";
import sanitizeHtml from "sanitize-html";
import { load } from "cheerio";

import { PAGE_PLAIN_CONTENT_MAX_LENGTH, plainTextToPageContent } from "./plain-text-page-content";
import { actualPageSchema } from "./page-operation.test-fixture";

const schema = actualPageSchema();
const cases = [
  { name: "empty input stays a valid blank paragraph", input: "", paragraphs: [""] },
  { name: "spaces and tabs are not trimmed", input: "  \t  ", paragraphs: ["  \t  "] },
  { name: "two authored paragraphs", input: "First exact paragraph.\n\nSecond exact paragraph.", paragraphs: ["First exact paragraph.", "Second exact paragraph."] },
  { name: "single line break", input: "first\nsecond", paragraphs: ["first\nsecond"] },
  { name: "extra line break is retained", input: "first\n\n\nsecond", paragraphs: ["first", "\nsecond"] },
  { name: "empty middle paragraph is retained", input: "first\n\n\n\nsecond", paragraphs: ["first", "", "second"] },
  { name: "leading and trailing empty paragraphs", input: "\n\nfirst\n\n", paragraphs: ["", "first", ""] },
  { name: "CRLF paragraph and hard break boundaries", input: "first\r\nline\r\n\r\nsecond", paragraphs: ["first\nline", "second"] },
  { name: "CR line boundaries", input: "first\rsecond", paragraphs: ["first\nsecond"] },
  { name: "literal HTML and script examples", input: "Literal <em>x</em> and <script>window.literal = 1</script>.", paragraphs: ["Literal <em>x</em> and <script>window.literal = 1</script>."] },
  { name: "literal entities stay literal", input: "&lt;em&gt; &amp; &#39; A < B & C > D", paragraphs: ["&lt;em&gt; &amp; &#39; A < B & C > D"] },
  { name: "quotes and unicode remain author text", input: "\"Quoted\" d'été café 😀 \u2014 exact", paragraphs: ["\"Quoted\" d'été café 😀 \u2014 exact"] },
];

describe("Plain page creator content through the actual editor schema and sanitizer", () => {
  it.each(cases)("$name", ({ input, paragraphs }) => {
    const result = plainTextToPageContent(input);
    expect(result).not.toBeNull();
    const document = schema.nodeFromJSON(result!.contentJson);
    expect(() => document.check()).not.toThrow();
    const actualParagraphs: string[] = [];
    document.forEach(node => {
      expect(node.type.name).toBe("paragraph");
      actualParagraphs.push(node.textBetween(0, node.content.size, "", "\n"));
    });
    expect(actualParagraphs).toEqual(paragraphs);
    const sanitized = sanitizeHtml(result!.contentHtml, { allowedTags: ["p", "br"], allowedAttributes: {} });
    const $ = load(sanitized);
    expect($("script,em,iframe,img").length).toBe(0);
    $("br").replaceWith("\n");
    expect($("body > p").map((_, element) => $(element).text()).get()).toEqual(paragraphs);
    expect(result!.contentHtml.length).toBeLessThanOrEqual(PAGE_PLAIN_CONTENT_MAX_LENGTH);
    expect(JSON.stringify(result!.contentJson).length).toBeLessThanOrEqual(PAGE_PLAIN_CONTENT_MAX_LENGTH);
  });

  it("keeps empty content semantically blank without an invalid empty text node", () => {
    expect(plainTextToPageContent("")).toEqual({
      contentHtml: "<p></p>", contentJson: { type: "doc", content: [{ type: "paragraph" }] },
    });
  });
  it("refuses oversized input without truncating it", () => {
    const source = "x".repeat(PAGE_PLAIN_CONTENT_MAX_LENGTH + 1);
    expect(plainTextToPageContent(source)).toBeNull();
    expect(source.length).toBe(PAGE_PLAIN_CONTENT_MAX_LENGTH + 1);
  });
  it("refuses entity-expanded HTML before it exceeds the existing editor cap", () => {
    const source = "&".repeat(400_000);
    expect(source.length).toBeLessThan(PAGE_PLAIN_CONTENT_MAX_LENGTH);
    expect(plainTextToPageContent(source)).toBeNull();
  });
  it("refuses JSON-escaped expansion even when raw input and HTML would fit", () => {
    const source = "\\".repeat(1_000_000);
    expect(source.length).toBeLessThan(PAGE_PLAIN_CONTENT_MAX_LENGTH);
    expect(plainTextToPageContent(source)).toBeNull();
  });
  it("accepts a substantial ordinary document without partial output", () => {
    const source = "Exact authored text. ".repeat(5_000);
    const result = plainTextToPageContent(source)!;
    expect(schema.nodeFromJSON(result.contentJson).textContent).toBe(source);
    expect(result.contentHtml).toBe(`<p>${source}</p>`);
  });
  it.each(["before\u0000after", null, undefined, 3, {}])("refuses unsupported source %j", value => {
    expect(plainTextToPageContent(value as string)).toBeNull();
  });
});
