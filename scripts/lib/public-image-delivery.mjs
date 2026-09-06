import { load } from "cheerio";
import { createImageDeliveryResolver } from "../../src/utils/imageDeliveryModel.ts";

/** Optimize only the site's HTML. Publication feeds retain their original media URLs. */
export function createPublicImageHtmlRenderer(manifest, base) {
  const delivery = createImageDeliveryResolver(manifest, base);
  return (html) => {
    const $ = load(html, {}, false);
    $("img[src]").each((_index, element) => {
      const image = $(element);
      const attributes = delivery.attributes(image.attr("src"), 1280, "(max-width: 1000px) calc(100vw - 48px), 880px");
      image.attr("src", attributes.src).attr("loading", "lazy").attr("decoding", "async");
      if (attributes.width && attributes.height) image.attr("width", attributes.width).attr("height", attributes.height);
      if (attributes.srcSet) image.attr("srcset", attributes.srcSet).attr("sizes", attributes.sizes);
    });
    return $.html();
  };
}
