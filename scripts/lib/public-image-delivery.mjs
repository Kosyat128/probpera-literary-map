import { load } from "cheerio";
import { createImageDeliveryResolver } from "../../src/utils/imageDeliveryModel.ts";
import { editorialInlineImageSizes, editorialInlineImageAspectRatio } from "../../src/utils/editorialImagePresentation.ts";
import { safeHttpsImageUrl } from "./article-publication-images.mjs";
import { publicRenditionPath } from "./public-image-rendition-plan.mjs";

const editorialOriginalPrefix = "https://sjqejjmwpzfsczxdghvw.supabase.co/storage/v1/object/public/editorial-media/";

export function createPublicImageHtmlRenderer(manifest, base) {
  const delivery = createImageDeliveryResolver(manifest, base);
  return (html) => {
    const $ = load(html, {}, false);
    $("img[src]").each((_index, element) => {
      const image = $(element);
      const attributes = delivery.attributes(image.attr("src"), 1280, editorialInlineImageSizes(image.attr()));
      image.attr("src", attributes.src).attr("loading", "lazy").attr("decoding", "async");
      if (attributes.width && attributes.height) {
        image.attr("width", attributes.width).attr("height", attributes.height);
        const ratio = editorialInlineImageAspectRatio(image.attr(), attributes.width, attributes.height);
        if (ratio) image.css("aspect-ratio", ratio);
      }
      if (attributes.srcSet) image.attr("srcset", attributes.srcSet).attr("sizes", attributes.sizes);
    });
    return $.html();
  };
}

export function createPublicationImageDelivery(manifest, siteOrigin, base, availableRenditions) {
  const entries = {};
  for (const [source, entry] of Object.entries(manifest)) {
    if (!source.startsWith(editorialOriginalPrefix)) continue;
    const variants = [entry, ...entry.variants].filter(variant =>
      publicRenditionPath.test(variant.src) && /\.(?:jpe?g|png|webp)$/u.test(variant.src) &&
      availableRenditions.has(variant.src)
    );
    const largest = variants.toSorted((left, right) => right.width - left.width)[0];
    if (largest) entries[source] = { ...largest, variants };
  }

  const delivery = createImageDeliveryResolver(entries, base);
  const url = source => Object.hasOwn(entries, source)
    ? new URL(delivery.url(source), siteOrigin).href
    : source;

  function rssHtml(html, leadOriginal) {
    const $ = load(html, {}, false);
    let changed = false;
    $("img[src]").each((_index, element) => {
      const image = $(element);
      const source = image.attr("src");
      // Dzen verifies the original selected illustration against the feed.
      if (leadOriginal && safeHttpsImageUrl(source) === leadOriginal) return;
      const rendition = url(source);
      if (rendition === source) return;
      image.attr("src", rendition);
      changed = true;
    });
    return changed ? $.html() : html;
  }

  return { url, rssHtml };
}
