const blockedElements =
  "script,style,iframe,object,embed,form,input,button,textarea,select,link,meta";
const allowedTextTones = new Set([
  "garnet",
  "forest",
  "ocean",
  "indigo",
  "amber",
  "slate",
]);
const allowedTextToneClasses = new Set([
  "article-text-tone",
  ...[...allowedTextTones].map((tone) => `is-tone-${tone}`),
]);
const allowedAttributes = new Set([
  "alt",
  "class",
  "height",
  "href",
  "id",
  "loading",
  "src",
  "title",
  "width",
  "data-editorial-block",
  "data-reveal",
  "data-image-layout",
  "data-caption",
  "data-text-tone",
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

    if (element.hasAttribute("class")) {
      const safeClasses = [...element.classList].filter(
        (className) =>
          allowedTextToneClasses.has(className) ||
          [
            "article-media-split",
            "article-gallery",
            "article-design-block",
            "article-leading-label",
            "is-fact",
            "is-accent",
            "is-columns",
            "is-timeline",
            "is-metrics",
            "is-ornament",
            "is-gallery",
            "is-slider",
            "article-inline-image",
            "is-wide",
            "is-normal",
            "is-left",
            "is-right",
          ].includes(className)
      );
      if (safeClasses.length) element.className = safeClasses.join(" ");
      else element.removeAttribute("class");
    }

    const textTone = element.dataset.textTone || "";
    const expectedToneClass = `is-tone-${textTone}`;
    const hasSafeTextTone =
      element.tagName === "SPAN" &&
      allowedTextTones.has(textTone) &&
      element.classList.contains("article-text-tone") &&
      element.classList.contains(expectedToneClass);
    if (hasSafeTextTone) {
      allowedTextTones.forEach((tone) => {
        if (tone !== textTone) element.classList.remove(`is-tone-${tone}`);
      });
    } else {
      element.removeAttribute("data-text-tone");
      allowedTextToneClasses.forEach((className) =>
        element.classList.remove(className)
      );
      if (!element.classList.length) element.removeAttribute("class");
    }

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
      const layout = ["wide", "normal", "left", "right"].includes(
        element.dataset.imageLayout || ""
      )
        ? element.dataset.imageLayout || "wide"
        : "wide";
      // `article-image` belongs to homepage cards and carries a fixed 16:10
      // frame. Never reuse it for editorial images with their own proportions.
      element.classList.remove("article-image");
      element.classList.add(`is-${layout}`);
      const inCollection = element.closest(
        ".article-design-block.is-gallery, .article-design-block.is-slider"
      );
      if (!inCollection && element.parentElement?.tagName !== "FIGURE") {
        const figure = document.createElement("figure");
        figure.className = `article-inline-image is-${layout}`;
        const caption = (element.dataset.caption || "").trim();
        element.replaceWith(figure);
        figure.append(element);
        if (caption) {
          const captionElement = document.createElement("figcaption");
          captionElement.textContent = caption;
          figure.append(captionElement);
        }
      }
    }
  });

  // Legacy articles sometimes store a short section label (for example,
  // “Предисловие”) as the first <strong> inside an ordinary paragraph.
  // Mark it explicitly so the reader can style it as a heading instead of
  // turning its first letter into an accidental decorative drop cap.
  const firstParagraph = document.body.querySelector("p:first-of-type");
  const firstElement = firstParagraph?.firstElementChild;
  if (
    firstParagraph instanceof HTMLParagraphElement &&
    firstElement instanceof HTMLElement &&
    firstElement.tagName === "STRONG" &&
    (firstElement.textContent || "").trim().length > 0 &&
    (firstElement.textContent || "").trim().length <= 48
  ) {
    firstParagraph.classList.add("article-leading-label");
  }

  return document.body.innerHTML;
}
