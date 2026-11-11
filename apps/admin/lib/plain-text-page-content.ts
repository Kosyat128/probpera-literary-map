// DRAFT ONLY. No imports, typography changes, entity decoding or persistence side effects.
export const PAGE_PLAIN_CONTENT_MAX_LENGTH = 2_000_000;

type PagePlainInline = { type: "text"; text: string } | { type: "hardBreak" };
type PagePlainParagraph = { type: "paragraph"; content?: PagePlainInline[] };
export type PagePlainContent = {
  contentHtml: string;
  contentJson: { type: "doc"; content: PagePlainParagraph[] };
};

const pageTextEntities: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
function escapePageText(value: string) {
  return value.replace(/[&<>"']/gu, character => pageTextEntities[character]);
}

/** Plain textarea input: double LF separates paragraphs; single LF is a hard break.
 * CRLF/CR represent the same line boundaries. No text is trimmed or truncated.
 * Lengths use UTF-16 units, matching the existing page save/recovery string caps.
 * null refuses unrepresentable/oversized input before any canonical insert.
 */
export function plainTextToPageContent(input: string): PagePlainContent | null {
  if (typeof input !== "string" || input.length > PAGE_PLAIN_CONTENT_MAX_LENGTH || input.includes("\u0000")) return null;
  const contentJson: PagePlainContent["contentJson"] = { type: "doc", content: [] };
  const html: string[] = [];
  let htmlLength = 0;
  let jsonLength = JSON.stringify(contentJson).length;
  const paragraphWithContentLength = JSON.stringify({ type: "paragraph", content: [] }).length;
  for (const paragraph of input.replace(/\r\n?/gu, "\n").split("\n\n")) {
    const content: PagePlainInline[] = [];
    const fragments: string[] = [];
    let inlineJsonLength = 0;
    let paragraphHtmlLength = "<p></p>".length;
    const separatorLength = contentJson.content.length > 0 ? 1 : 0;
    const append = (node: PagePlainInline, safeHtml: string) => {
      inlineJsonLength += (content.length > 0 ? 1 : 0) + JSON.stringify(node).length;
      paragraphHtmlLength += safeHtml.length;
      if (jsonLength + separatorLength + paragraphWithContentLength + inlineJsonLength > PAGE_PLAIN_CONTENT_MAX_LENGTH
        || htmlLength + paragraphHtmlLength > PAGE_PLAIN_CONTENT_MAX_LENGTH) return false;
      content.push(node); fragments.push(safeHtml); return true;
    };
    const lines = paragraph.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      if (index > 0 && !append({ type: "hardBreak" }, "<br>")) return null;
      if (lines[index] !== "" && !append({ type: "text", text: lines[index] }, escapePageText(lines[index]))) return null;
    }
    const node: PagePlainParagraph = content.length > 0 ? { type: "paragraph", content } : { type: "paragraph" };
    jsonLength += separatorLength + JSON.stringify(node).length;
    htmlLength += paragraphHtmlLength;
    if (jsonLength > PAGE_PLAIN_CONTENT_MAX_LENGTH || htmlLength > PAGE_PLAIN_CONTENT_MAX_LENGTH) return null;
    contentJson.content.push(node); html.push(`<p>${fragments.join("")}</p>`);
  }
  return { contentHtml: html.join(""), contentJson };
}
