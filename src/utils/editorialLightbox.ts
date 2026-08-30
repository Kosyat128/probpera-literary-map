export type EditorialLightboxMediaItem = {
  src: string;
  alt: string;
  caption: string;
};

export type EditorialLightboxEligibility = {
  decorative?: string;
  lightbox?: string;
  linked: boolean;
  galleryLightbox?: string;
};

export function editorialLightboxAllowsImage({
  decorative,
  lightbox,
  linked,
  galleryLightbox,
}: EditorialLightboxEligibility) {
  return (
    decorative !== "true" &&
    lightbox !== "false" &&
    !linked &&
    galleryLightbox !== "false"
  );
}

export function editorialImageElementAllowsLightbox(image: HTMLImageElement) {
  const collection = image.closest<HTMLElement>("[data-gallery-lightbox]");
  return editorialLightboxAllowsImage({
    decorative: image.dataset.decorative,
    lightbox: image.dataset.lightbox,
    linked: Boolean(image.closest("a[href]")),
    galleryLightbox: collection?.dataset.galleryLightbox,
  });
}

export function editorialLightboxMediaItem({
  rawSource,
  baseUrl,
  alt = "",
  caption = "",
}: {
  rawSource: string;
  baseUrl: string;
  alt?: string;
  caption?: string;
}): EditorialLightboxMediaItem | null {
  const source = rawSource.trim();
  if (!source || source.startsWith("#") || source.startsWith("//")) return null;

  try {
    const url = new URL(source, baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return {
      src: url.href,
      alt: alt.trim(),
      caption: caption.trim(),
    };
  } catch {
    return null;
  }
}

export function editorialLightboxMediaItems(
  html: string,
  baseUrl: string
): EditorialLightboxMediaItem[] {
  if (!html || typeof DOMParser === "undefined") return [];
  const documentNode = new DOMParser().parseFromString(html, "text/html");

  return [...documentNode.querySelectorAll<HTMLImageElement>("img")]
    .map((image) => {
      if (!editorialImageElementAllowsLightbox(image)) return null;
      return editorialImageElementMediaItem(image, baseUrl);
    })
    .filter((item): item is EditorialLightboxMediaItem => Boolean(item));
}

export function editorialImageElementMediaItem(
  image: HTMLImageElement,
  baseUrl: string
) {
  const figure = image.closest("figure");
  const caption =
    image.dataset.caption?.trim() ||
    figure
      ?.querySelector<HTMLElement>(
        ".article-image-caption, .article-gallery-caption"
      )
      ?.textContent?.trim() ||
    "";
  return editorialLightboxMediaItem({
    rawSource:
      image.getAttribute("data-original") ||
      image.getAttribute("data-src") ||
      image.getAttribute("src") ||
      "",
    baseUrl,
    alt: image.alt,
    caption,
  });
}
