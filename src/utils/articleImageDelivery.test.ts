import { expect, it } from "vitest";
import articleManifest from "../data/imageDelivery.articles.generated.json";
import { expandImageDeliveryManifest, type CompactImageDeliveryManifest } from "./imageDeliveryModel";
import { originalImageUrl, publicImageAttributes, publicImageUrl } from "./imageDelivery";

it("registers article-only images when the lazy reader dependency initializes", async () => {
  const articles = expandImageDeliveryManifest(articleManifest as unknown as CompactImageDeliveryManifest);
  const [source, entry] = Object.entries(articles)[0];
  // Before opening an article, the generic resolver retains unknown live CMS URLs.
  expect(publicImageUrl(source)).toBe(source);
  await import("./articleImageDelivery");
  const attributes = publicImageAttributes(source);
  expect(attributes.width).toBe(entry.width);
  expect(attributes.height).toBe(entry.height);
  expect(attributes.src).toContain("/media/optimized/");
  expect(publicImageUrl(source, Number.MAX_SAFE_INTEGER)).toContain(entry.src);
  expect(publicImageUrl(originalImageUrl(attributes.src), Number.MAX_SAFE_INTEGER)).toContain(entry.src);
  expect(publicImageUrl("https://live-cms.example/new-unpublished-image.webp")).toBe("https://live-cms.example/new-unpublished-image.webp");
});
