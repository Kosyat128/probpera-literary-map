const blockedElements =
  "script,style,iframe,object,embed,form,input,button,textarea,select,link,meta";
const allowedAttributes = new Set([
  "alt",
  "height",
  "href",
  "id",
  "loading",
  "src",
  "title",
  "width",
]);

function isSafeUrl(value: string) {
  const normalized = value.trim().toLocaleLowerCase("en");
  return (
    normalized.startsWith("https://") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("/") ||
    normalized.startsWith("#")
  );
}

export function sanitizeArticleHtml(source: string) {
  const document = new DOMParser().parseFromString(source, "text/html");
  document.querySelectorAll(blockedElements).forEach((element) => element.remove());

  document.body.querySelectorAll<HTMLElement>("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLocaleLowerCase("en");
      if (!allowedAttributes.has(name) || name.startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    });

    for (const attributeName of ["href", "src"]) {
      const value = element.getAttribute(attributeName);
      if (value && !isSafeUrl(value)) element.removeAttribute(attributeName);
    }

    if (element instanceof HTMLAnchorElement) {
      element.rel = "noopener noreferrer";
      if (/^https?:\/\//i.test(element.href)) element.target = "_blank";
    }

    if (element instanceof HTMLImageElement) {
      element.loading = "lazy";
      element.decoding = "async";
    }
  });

  return document.body.innerHTML;
}
