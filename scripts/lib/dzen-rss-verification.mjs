import { load } from "cheerio";
import { safeHttpsImageUrl } from "./article-publication-images.mjs";

function readItems(rss) {
  const $ = load(rss, { xml: true });
  if ($("rss > channel").length !== 1) {
    throw new Error("RSS Дзена вернул ленту в неожиданном формате.");
  }
  const items = new Map();
  for (const element of $("rss > channel > item").toArray()) {
    const item = $(element);
    const link = item.children("link");
    if (link.length !== 1) continue;
    const url = link.text().trim();
    const cover = item.children("media\\:content").filter((_index, image) =>
      $(image).attr("medium") === "image"
    ).first();
    items.set(url, items.has(url) ? null : { cover: safeHttpsImageUrl(cover.attr("url")) });
  }
  return items;
}

export function createDzenRssVerifier(readRss) {
  let snapshot;
  let failedReads = 0;
  return async function verifyDzenRssEntry(canonicalUrl, expectedCover) {
    snapshot ??= readRss().then(readItems).catch((error) => {
      failedReads += 1;
      if (failedReads < 2) snapshot = undefined;
      throw error;
    });
    const item = (await snapshot).get(canonicalUrl);
    if (!item) {
      throw new Error("Новая статья ещё не появилась в RSS как отдельная запись.");
    }
    if (expectedCover && item.cover !== expectedCover.url) {
      throw new Error("Первая пригодная иллюстрация статьи ещё не стала обложкой её записи в RSS Дзена.");
    }
  };
}
