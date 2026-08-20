import { load } from "cheerio";

function isHeadingLevelTwo(node: unknown) {
  if (!node || typeof node !== "object") return false;
  const record = node as Record<string, unknown>;
  if (record.type !== "heading") return false;
  const attrs = record.attrs;
  return Boolean(
    attrs &&
      typeof attrs === "object" &&
      Number((attrs as Record<string, unknown>).level || 0) === 2
  );
}

export function positionLeadingIllustrationJson(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const document = value as Record<string, unknown>;
  if (document.type !== "doc" || !Array.isArray(document.content)) return value;
  const content = document.content.map((node) =>
    node && typeof node === "object" && !Array.isArray(node)
      ? { ...(node as Record<string, unknown>) }
      : node
  );
  const imageIndex = content.findIndex(
    (node) =>
      node &&
      typeof node === "object" &&
      !Array.isArray(node) &&
      (node as Record<string, unknown>).type === "image"
  );
  const headingIndex = content.findIndex(isHeadingLevelTwo);
  if (
    imageIndex < 0 ||
    headingIndex < 0 ||
    imageIndex >= headingIndex ||
    imageIndex === headingIndex - 1
  ) {
    return value;
  }
  const [image] = content.splice(imageIndex, 1);
  const nextHeadingIndex = content.findIndex(isHeadingLevelTwo);
  content.splice(nextHeadingIndex, 0, image);
  return { ...document, content };
}

/**
 * Move only a direct leading image/figure that precedes the first direct H2.
 * Nested gallery media and illustrations that belong to later sections keep
 * their authored position.
 */
export function positionLeadingIllustrationHtml(value: string) {
  const source = String(value || "");
  const $ = load(source, {}, false);
  const root = $.root();
  const heading = root.children("h2").first();
  const illustration = root.children("img, figure").first();
  if (!heading.length || !illustration.length) return source;
  const children = root.children();
  const imageIndex = children.index(illustration);
  const headingIndex = children.index(heading);
  if (
    imageIndex < 0 ||
    headingIndex < 0 ||
    imageIndex >= headingIndex ||
    imageIndex === headingIndex - 1
  ) {
    return source;
  }
  const element = illustration.get(0);
  illustration.remove();
  if (element) heading.before(element);
  return root.html() || "";
}
