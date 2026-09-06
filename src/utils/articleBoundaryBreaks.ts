// Only legacy prose wrappers and headings use BR elements as outer spacing.
// Paragraphs, quotations, preformatted text and classed editorial blocks may
// deliberately preserve verse layout and are outside this normalization.
export const articleBoundaryBreakSelector =
  "h1,h2,h3,h4,h5,h6,div:not([class]),section:not([class])";
export const articleBoundaryBreakProtectedContext = "pre,code,blockquote,[class]";

type BoundaryNodeKind = "break" | "whitespace" | "content";

/** Find direct boundary padding in an existing parsed tree; never parse HTML. */
export function articleBoundaryBreaksToRemove<Node>(
  children: readonly Node[],
  classify: (node: Node) => BoundaryNodeKind
): Node[] {
  const kinds = children.map(classify);
  const firstContent = kinds.indexOf("content");
  // Keep intentionally empty blocks, including a lone placeholder BR.
  if (firstContent === -1) return [];
  const lastContent = kinds.lastIndexOf("content");
  const leading = kinds.slice(0, firstContent).includes("break")
    ? children.slice(0, firstContent)
    : [];
  const trailing = kinds.slice(lastContent + 1).includes("break")
    ? children.slice(lastContent + 1)
    : [];
  return [...leading, ...trailing];
}
