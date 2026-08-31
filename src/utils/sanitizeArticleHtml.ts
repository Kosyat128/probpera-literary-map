import { normalizeShortHyphens } from "./shortHyphens";
import {
  canonicalEditorialImageData,
  editorialImageDataAttributes,
  editorialImageElementStyle,
  editorialImageFigureStyle,
  normalizeEditorialImagePublicAttributes,
  safeEditorialMediaUrl,
  type EditorialImagePublicAttributes,
} from "./editorialImagePresentation";

const blockedElements =
  "script,style,iframe,object,embed,form,input,button,textarea,select,link,meta,base";
const allowedTextTones = new Set([
  "garnet",
  "coral",
  "rose",
  "berry",
  "plum",
  "violet",
  "indigo",
  "navy",
  "cobalt",
  "ocean",
  "teal",
  "emerald",
  "forest",
  "olive",
  "moss",
  "ochre",
  "amber",
  "bronze",
  "umber",
  "cocoa",
  "slate",
  "steel",
  "graphite",
  "charcoal",
]);
const allowedTextToneClasses = new Set([
  "article-text-tone",
  ...[...allowedTextTones].map((tone) => `is-tone-${tone}`),
]);
const allowedTypographyScopes = new Set(["lead", "quote", "caption"]);
const allowedTypographyScopeClasses = new Set([
  "article-typography-scope",
  ...[...allowedTypographyScopes].map((scope) => `is-scope-${scope}`),
]);
const galleryAttributeNames = [
  "data-gallery-version",
  "data-gallery-id",
  "data-gallery-mode",
  "data-gallery-columns-desktop",
  "data-gallery-columns-tablet",
  "data-gallery-columns-mobile",
  "data-gallery-gap",
  "data-gallery-aspect",
  "data-gallery-fit",
  "data-gallery-captions",
  "data-gallery-lightbox",
  "data-slider-arrows",
  "data-slider-dots",
  "data-slider-autoplay",
  "data-slider-interval",
  "data-slider-loop",
] as const;
const editorialGalleryMaxItems = 100;
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
  "data-text-tone",
  "data-typography-scope",
  ...editorialImageDataAttributes,
  ...galleryAttributeNames,
]);

const editorialImageLayoutClasses = [
  "is-wide",
  "is-normal",
  "is-full",
  "is-left",
  "is-right",
];
const editorialImageAspectClasses = [
  "is-aspect-auto",
  "is-aspect-1-1",
  "is-aspect-4-3",
  "is-aspect-3-2",
  "is-aspect-16-9",
  "is-aspect-2-3",
];
const editorialImageFitClasses = ["is-fit-contain", "is-fit-cover"];

function boundedInteger(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number
) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function booleanData(value: string | undefined, fallback: boolean) {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function normalizeEditorialCollection(element: HTMLElement) {
  const declaredKind = element.dataset.editorialBlock;
  const classKind = element.classList.contains("is-slider")
    ? "slider"
    : element.classList.contains("is-gallery")
      ? "gallery"
      : "";
  const kind =
    element.tagName === "SECTION" &&
    (declaredKind === "gallery" || declaredKind === "slider")
      ? declaredKind
      : element.tagName === "SECTION"
        ? classKind
        : "";

  if (!kind) {
    galleryAttributeNames.forEach((name) => element.removeAttribute(name));
    return;
  }

  element.dataset.editorialBlock = kind;
  element.classList.remove("is-gallery", "is-slider");
  element.classList.add(`is-${kind}`);
  element.dataset.galleryVersion = "1";
  element.dataset.galleryMode = kind;

  const galleryId = (element.dataset.galleryId || "").trim();
  if (/^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(galleryId)) {
    element.dataset.galleryId = galleryId;
  } else {
    element.removeAttribute("data-gallery-id");
  }

  element.dataset.galleryColumnsDesktop = String(
    boundedInteger(element.dataset.galleryColumnsDesktop, 1, 6, kind === "gallery" ? 2 : 1)
  );
  element.dataset.galleryColumnsTablet = String(
    boundedInteger(element.dataset.galleryColumnsTablet, 1, 4, kind === "gallery" ? 2 : 1)
  );
  element.dataset.galleryColumnsMobile = String(
    boundedInteger(element.dataset.galleryColumnsMobile, 1, 2, 1)
  );
  element.dataset.galleryGap = ["compact", "normal", "spacious"].includes(
    element.dataset.galleryGap || ""
  )
    ? element.dataset.galleryGap || "normal"
    : "normal";
  element.dataset.galleryAspect = [
    "auto",
    "1-1",
    "4-3",
    "3-2",
    "16-9",
    "2-3",
  ].includes(element.dataset.galleryAspect || "")
    ? element.dataset.galleryAspect || "auto"
    : "auto";
  element.dataset.galleryFit = ["contain", "cover"].includes(
    element.dataset.galleryFit || ""
  )
    ? element.dataset.galleryFit || "contain"
    : "contain";
  element.dataset.galleryCaptions = String(
    booleanData(element.dataset.galleryCaptions, true)
  );
  element.dataset.galleryLightbox = String(
    booleanData(element.dataset.galleryLightbox, true)
  );
  element.dataset.sliderArrows = String(
    booleanData(element.dataset.sliderArrows, true)
  );
  element.dataset.sliderDots = String(booleanData(element.dataset.sliderDots, true));
  element.dataset.sliderAutoplay = String(
    booleanData(element.dataset.sliderAutoplay, false)
  );
  element.dataset.sliderInterval = String(
    boundedInteger(element.dataset.sliderInterval, 2000, 15000, 5000)
  );
  element.dataset.sliderLoop = String(booleanData(element.dataset.sliderLoop, true));
}

function isSafeUrl(value: string) {
  return Boolean(safeEditorialMediaUrl(value));
}

function sourceImageAttributes(element: HTMLImageElement) {
  return Object.fromEntries(
    editorialImageDataAttributes.map((name) => [
      name,
      element.getAttribute(name) || undefined,
    ])
  );
}

function applyCanonicalImageAttributes(
  element: HTMLImageElement,
  attributes: EditorialImagePublicAttributes
) {
  editorialImageDataAttributes.forEach((name) => element.removeAttribute(name));
  Object.entries(canonicalEditorialImageData(attributes)).forEach(
    ([name, value]) => element.setAttribute(name, value)
  );

  element.classList.remove(
    "article-image",
    "article-editorial-image",
    "has-custom-width",
    ...editorialImageLayoutClasses,
    ...editorialImageAspectClasses,
    ...editorialImageFitClasses
  );
  element.classList.add(
    "article-editorial-image",
    `is-${attributes.layout}`,
    `is-aspect-${attributes.aspect}`,
    `is-fit-${attributes.fit}`
  );
  element.style.cssText = editorialImageElementStyle(attributes);
  element.loading = "lazy";
  element.decoding = "async";

  if (attributes.decorative) {
    element.alt = "";
    element.setAttribute("role", "presentation");
    element.setAttribute("aria-hidden", "true");
  } else {
    element.removeAttribute("role");
    element.removeAttribute("aria-hidden");
  }
}

function configureSafeAnchor(anchor: HTMLAnchorElement, href: string) {
  anchor.href = href;
  anchor.rel = "noopener noreferrer";
  if (/^https?:\/\//iu.test(href)) anchor.target = "_blank";
  else anchor.removeAttribute("target");
}

function ensureImageLink(
  image: HTMLImageElement,
  href: string,
  document: Document
) {
  const currentAnchor =
    image.parentElement instanceof HTMLAnchorElement
      ? image.parentElement
      : null;
  if (!href) {
    if (currentAnchor) currentAnchor.classList.add("article-image-link");
    return currentAnchor;
  }

  const anchor = currentAnchor || document.createElement("a");
  anchor.classList.add("article-image-link");
  configureSafeAnchor(anchor, href);
  if (!currentAnchor) {
    image.replaceWith(anchor);
    anchor.append(image);
  }
  return anchor;
}

function appendProvenancePart(
  container: HTMLElement,
  text: string,
  className: string,
  document: Document,
  href = ""
) {
  if (!text) return;
  const element = href
    ? document.createElement("a")
    : document.createElement("span");
  element.className = className;
  element.textContent = text;
  if (element instanceof HTMLAnchorElement) configureSafeAnchor(element, href);
  container.append(element);
}

function normalizeInlineEditorialImage(
  image: HTMLImageElement,
  document: Document
) {
  const attributes = normalizeEditorialImagePublicAttributes(
    sourceImageAttributes(image)
  );
  const inCollection = image.closest(
    ".article-design-block.is-gallery, .article-design-block.is-slider"
  );
  const linkedVisual = ensureImageLink(image, attributes.link, document) || image;
  if (inCollection) return;

  let figure = image.closest("figure");
  const legacyCaption =
    figure?.querySelector(":scope > figcaption")?.textContent?.trim() || "";
  if (!figure) {
    figure = document.createElement("figure");
    linkedVisual.replaceWith(figure);
    figure.append(linkedVisual);
  }

  figure.classList.remove(
    "article-gallery-item",
    "has-custom-width",
    ...editorialImageLayoutClasses,
    ...editorialImageAspectClasses,
    ...editorialImageFitClasses
  );
  figure.classList.add(
    "article-inline-image",
    `is-${attributes.layout}`,
    `is-aspect-${attributes.aspect}`,
    `is-fit-${attributes.fit}`
  );
  if (attributes.width < 100) figure.classList.add("has-custom-width");
  figure.style.cssText = editorialImageFigureStyle(attributes);
  figure.querySelectorAll(":scope > figcaption").forEach((caption) =>
    caption.remove()
  );

  const caption = attributes.caption || legacyCaption;
  const hasProvenance = Boolean(
    attributes.credit ||
      attributes.source ||
      attributes.license ||
      attributes.licenseUrl
  );
  if (!caption && !hasProvenance) return;

  const details = document.createElement("figcaption");
  details.className = "article-image-details";
  if (caption) {
    const captionElement = document.createElement("span");
    captionElement.className = "article-image-caption";
    captionElement.textContent = caption;
    details.append(captionElement);
  }
  if (hasProvenance) {
    const provenance = document.createElement("small");
    provenance.className = "article-image-provenance";
    appendProvenancePart(
      provenance,
      attributes.credit,
      "article-image-credit",
      document
    );
    const safeSourceUrl = safeEditorialMediaUrl(attributes.source);
    appendProvenancePart(
      provenance,
      attributes.source,
      "article-image-source",
      document,
      safeSourceUrl
    );
    appendProvenancePart(
      provenance,
      attributes.license || attributes.licenseUrl,
      "article-image-license",
      document,
      attributes.licenseUrl
    );
    details.append(provenance);
  }
  figure.append(details);
}

function removeEditorialCollectionImage(
  image: HTMLImageElement,
  collection: HTMLElement
) {
  const directFigure = image.closest("figure");
  if (directFigure?.parentElement === collection) {
    directFigure.remove();
    return;
  }
  const directLink = image.closest("a");
  if (directLink?.parentElement === collection) {
    directLink.remove();
    return;
  }
  image.remove();
}

export function sanitizeArticleHtml(source: string) {
  const document = new DOMParser().parseFromString(
    normalizeShortHyphens(source),
    "text/html"
  );
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
          allowedTypographyScopeClasses.has(className) ||
          [
            "article-media-split",
            "article-gallery",
            "article-gallery-item",
            "article-gallery-caption",
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
            "article-editorial-image",
            "article-image-link",
            "article-image-details",
            "article-image-caption",
            "article-image-provenance",
            "article-image-credit",
            "article-image-source",
            "article-image-license",
            "has-custom-width",
            "is-wide",
            "is-normal",
            "is-full",
            "is-left",
            "is-right",
            ...editorialImageAspectClasses,
            ...editorialImageFitClasses,
          ].includes(className)
      );
      if (safeClasses.length) element.className = safeClasses.join(" ");
      else element.removeAttribute("class");
    }

    const textTone = element.dataset.textTone || "";
    const expectedToneClass = `is-tone-${textTone}`;
    const typographyScope = element.dataset.typographyScope || "";
    const expectedScopeClass = `is-scope-${typographyScope}`;
    const hasSafeTextTone =
      element.tagName === "SPAN" &&
      allowedTextTones.has(textTone) &&
      element.classList.contains("article-text-tone") &&
      element.classList.contains(expectedToneClass);
    const hasSafeTypographyScope =
      element.tagName === "SPAN" &&
      allowedTypographyScopes.has(typographyScope) &&
      element.classList.contains("article-typography-scope") &&
      element.classList.contains(expectedScopeClass);
    const canonicalPresentationClasses: string[] = [];
    if (hasSafeTextTone) {
      canonicalPresentationClasses.push("article-text-tone", expectedToneClass);
    } else {
      element.removeAttribute("data-text-tone");
    }
    if (hasSafeTypographyScope) {
      canonicalPresentationClasses.push(
        "article-typography-scope",
        expectedScopeClass
      );
    } else {
      element.removeAttribute("data-typography-scope");
    }
    if (canonicalPresentationClasses.length) {
      element.className = canonicalPresentationClasses.join(" ");
    } else {
      allowedTextToneClasses.forEach((className) => element.classList.remove(className));
      allowedTypographyScopeClasses.forEach((className) =>
        element.classList.remove(className)
      );
    }
    if (!element.classList.length) element.removeAttribute("class");

    for (const attributeName of ["href", "src"]) {
      const value = element.getAttribute(attributeName);
      const fragmentOnlyImageSource =
        attributeName === "src" && value?.trim().startsWith("#");
      if (value && (!isSafeUrl(value) || fragmentOnlyImageSource)) {
        element.removeAttribute(attributeName);
      }
    }

    if (element instanceof HTMLAnchorElement) {
      element.rel = "noopener noreferrer";
      if (/^https?:\/\//i.test(element.href)) element.target = "_blank";
    }

    if (element instanceof HTMLImageElement) {
      applyCanonicalImageAttributes(
        element,
        normalizeEditorialImagePublicAttributes(sourceImageAttributes(element))
      );
    } else {
      editorialImageDataAttributes.forEach((name) =>
        element.removeAttribute(name)
      );
    }

    normalizeEditorialCollection(element);
  });

  document.body
    .querySelectorAll<HTMLElement>(
      "section.article-design-block.is-gallery, section.article-design-block.is-slider"
    )
    .forEach((collection) => {
      const captionsEnabled = collection.dataset.galleryCaptions !== "false";
      const descendantImages = [
        ...collection.querySelectorAll<HTMLImageElement>("img"),
      ];
      descendantImages
        .slice(editorialGalleryMaxItems)
        .forEach((image) => removeEditorialCollectionImage(image, collection));
      let itemCount = 0;
      [...collection.children].forEach((child) => {
        const image = child instanceof HTMLImageElement ? child : null;
        const existingFigure =
          child instanceof HTMLElement &&
          child.tagName === "FIGURE"
            ? child
            : null;
        const itemImage =
          image ||
          (child instanceof HTMLElement
            ? child.querySelector<HTMLImageElement>("img")
            : null);
        if (!itemImage) return;
        if (child instanceof HTMLElement && child !== itemImage) {
          [...child.querySelectorAll<HTMLImageElement>("img")]
            .filter((candidate) => candidate !== itemImage)
            .forEach((candidate) => candidate.remove());
        }
        if (itemCount >= editorialGalleryMaxItems) {
          child.remove();
          return;
        }
        itemCount += 1;

        const figure = existingFigure || document.createElement("figure");
        figure.className = "article-gallery-item";
        if (!existingFigure) {
          child.replaceWith(figure);
          figure.append(child);
        }
        figure
          .querySelectorAll(":scope > figcaption, :scope > .article-image-provenance")
          .forEach((details) => details.remove());
        const attributes = normalizeEditorialImagePublicAttributes(
          sourceImageAttributes(itemImage)
        );
        const caption = attributes.caption;
        if (captionsEnabled && caption) {
          const captionElement = document.createElement("figcaption");
          captionElement.className = "article-gallery-caption";
          captionElement.textContent = caption;
          figure.append(captionElement);
        }
        if (
          attributes.credit ||
          attributes.source ||
          attributes.license ||
          attributes.licenseUrl
        ) {
          const provenance = document.createElement("small");
          provenance.className = "article-image-provenance";
          appendProvenancePart(
            provenance,
            attributes.credit,
            "article-image-credit",
            document
          );
          appendProvenancePart(
            provenance,
            attributes.source,
            "article-image-source",
            document,
            safeEditorialMediaUrl(attributes.source)
          );
          appendProvenancePart(
            provenance,
            attributes.license || attributes.licenseUrl,
            "article-image-license",
            document,
            attributes.licenseUrl
          );
          figure.append(provenance);
        }
      });
    });

  document.body
    .querySelectorAll<HTMLImageElement>("img")
    .forEach((image) => normalizeInlineEditorialImage(image, document));

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
