import { load } from "cheerio";

const decorativeClassPattern =
  /(?:^|[-_])(avatar|badge|decor|emoji|icon|logo|ornament|pixel|spacer)(?:$|[-_])/iu;

export function safeHttpsImageUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

function imageDimensionsAreUseful(image) {
  const width = Number(image.attr("width"));
  const height = Number(image.attr("height"));
  if (Number.isFinite(width) && width > 0 && width < 64) return false;
  if (Number.isFinite(height) && height > 0 && height < 64) return false;
  return true;
}

function imageIsDecorative(image) {
  const figure = image.closest("figure");
  const classNames = [image.attr("class"), figure.attr("class")]
    .flatMap((value) => String(value || "").split(/\s+/u))
    .filter(Boolean);
  return (
    classNames.some((className) => decorativeClassPattern.test(className)) ||
    image.closest('[aria-hidden="true"], [role="presentation"]').length > 0
  );
}

export function firstSuitableArticleIllustration(
  contentHtml,
  { fallbackAlt = "" } = {}
) {
  const $ = load(String(contentHtml || ""), {}, false);
  let illustration = null;
  $("img").each((_index, element) => {
    if (illustration) return false;
    const image = $(element);
    const url = safeHttpsImageUrl(image.attr("src"));
    const alt = String(image.attr("alt") || fallbackAlt)
      .replace(/\s+/gu, " ")
      .trim();
    if (
      !url ||
      alt.length < 3 ||
      imageIsDecorative(image) ||
      !imageDimensionsAreUseful(image)
    ) {
      return undefined;
    }
    illustration = { url, alt };
    return false;
  });
  return illustration;
}

export function dzenCoverForArticle(article) {
  const articleTitle = String(article?.title || "").replace(/\s+/gu, " ").trim();
  const inline = firstSuitableArticleIllustration(article?.content_html, {
    fallbackAlt: articleTitle
      ? `Иллюстрация к статье «${articleTitle}»`
      : "Иллюстрация к статье",
  });
  if (inline) return { ...inline, source: "first-article-illustration" };
  const fallbackUrl = safeHttpsImageUrl(
    article?.dzenImageUrl || article?.cover_external_url || article?.imageUrl
  );
  if (!fallbackUrl) return null;
  const fallbackAlt = String(
    article?.cover_alt || article?.imageAlt || article?.title || "Иллюстрация к статье"
  )
    .replace(/\s+/gu, " ")
    .trim();
  return {
    url: fallbackUrl,
    alt: fallbackAlt || "Иллюстрация к статье",
    source: "article-cover-fallback",
  };
}

/**
 * Dzen consumes the RSS body independently from the website layout. Keep a
 * direct leading image after the introductory copy and before the first H2.
 * Images belonging to a gallery or a later semantic section are never moved.
 */
export function positionDzenLeadIllustration(contentHtml, illustration) {
  if (!illustration?.url) return String(contentHtml || "");
  const $ = load(String(contentHtml || ""), {}, false);
  const root = $.root();
  const heading = root.children("h2").first();
  const directImages = root.children("img, figure");
  let movable = null;
  directImages.each((_index, element) => {
    if (movable) return false;
    const candidate = $(element);
    const image = candidate.is("img") ? candidate : candidate.find("img").first();
    if (safeHttpsImageUrl(image.attr("src")) === illustration.url) {
      movable = candidate;
      return false;
    }
    return undefined;
  });

  if (movable && heading.length) {
    const movableIndex = root.children().index(movable);
    const headingIndex = root.children().index(heading);
    if (movableIndex >= 0 && movableIndex < headingIndex) {
      const movableElement = movable.get(0);
      movable.remove();
      if (movableElement) heading.before(movableElement);
    }
  } else if (
    !movable &&
    !firstSuitableArticleIllustration(root.html() || "", {
      fallbackAlt: illustration.alt || "Иллюстрация к статье",
    })
  ) {
    const figure = $("<figure></figure>").attr(
      "class",
      "article-feed-lead-image"
    );
    figure.append(
      $("<img>")
        .attr("src", illustration.url)
        .attr("alt", illustration.alt || "Иллюстрация к статье")
    );
    if (heading.length) heading.before(figure);
    else {
      const lead = root.children(".article-lead").first();
      const firstParagraph = root.children("p").first();
      if (lead.length) lead.after(figure);
      else if (firstParagraph.length) firstParagraph.after(figure);
      else root.prepend(figure);
    }
  }

  return root.html() || "";
}
