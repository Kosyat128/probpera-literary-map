/** Idempotent updates limited to explicitly owned locale metadata. */
export function setMetadataAttribute(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

export function setHeadMetadataValue(
  document: Document,
  tag: "link" | "meta",
  key: "rel" | "name" | "property" | "hreflang",
  selectorValue: string,
  attribute: "href" | "content",
  value: string
) {
  const matches = document.head.querySelectorAll(`${tag}[${key}="${selectorValue}"]`);
  let element = matches[0];
  if (!element) {
    element = document.createElement(tag);
    element.setAttribute(key, selectorValue);
    document.head.appendChild(element);
  }
  if (key === "hreflang") setMetadataAttribute(element, "rel", "alternate");
  setMetadataAttribute(element, attribute, value);
  for (const duplicate of Array.from(matches).slice(1)) duplicate.remove();
}
