import { describe, expect, it, vi } from "vitest";
import { createDzenRssVerifier } from "./dzen-rss-verification.mjs";

const firstUrl = "https://probpera.ru/stati/literatura/pervaya/";
const secondUrl = "https://probpera.ru/stati/literatura/vtoraya/";
const firstCover = "https://cdn.example/lead.jpg?width=1600&height=1000";
const secondCover = "https://cdn.example/second.jpg";

const media = (url) => `<media:content medium="image" url="${url.replaceAll("&", "&amp;")}" />`;
const item = (url, contents = "") => `<item><link>${url}</link>${contents}</item>`;
const feed = (...items) => `<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>${items.join("")}</channel>
</rss>`;

describe("Dzen RSS publication confirmation", () => {
  it("checks exact items and their XML-decoded cover using one public feed snapshot", async () => {
    const readRss = vi.fn(async () => feed(
      item(firstUrl, media(firstCover)),
      item(secondUrl, media(secondCover))
    ));
    const verify = createDzenRssVerifier(readRss);
    await Promise.all([
      verify(firstUrl, { url: firstCover }),
      verify(secondUrl, { url: secondCover }),
    ]);
    expect(readRss).toHaveBeenCalledOnce();
  });

  it("does not accept a canonical URL cited inside another article", async () => {
    const verify = createDzenRssVerifier(async () => feed(item(secondUrl,
      `<content:encoded><![CDATA[<a href="${firstUrl}">Первая статья</a>]]></content:encoded>`
    )));
    await expect(verify(firstUrl)).rejects.toThrow("отдельная запись");
  });

  it("requires the expected lead cover on the matching entry itself", async () => {
    const verify = createDzenRssVerifier(async () => feed(
      item(firstUrl, media(secondCover) + media(firstCover)),
      item(secondUrl, media(firstCover))
    ));
    await expect(verify(firstUrl, { url: firstCover })).rejects.toThrow("обложкой её записи");
  });

  it("rejects ambiguous duplicate links and retries after a malformed feed", async () => {
    const readRss = vi.fn()
      .mockResolvedValueOnce("<html></html>")
      .mockResolvedValueOnce(feed(item(firstUrl), item(firstUrl, media(firstCover))));
    const verify = createDzenRssVerifier(readRss);
    await expect(verify(firstUrl)).rejects.toThrow("неожиданном формате");
    await expect(verify(firstUrl, { url: firstCover })).rejects.toThrow("отдельная запись");
    expect(readRss).toHaveBeenCalledTimes(2);
  });

  it("allows one retry for an unavailable feed across the entire queue", async () => {
    const readRss = vi.fn().mockRejectedValue(new Error("RSS unavailable"));
    const verify = createDzenRssVerifier(readRss);
    await expect(verify(firstUrl)).rejects.toThrow("RSS unavailable");
    await expect(verify(secondUrl)).rejects.toThrow("RSS unavailable");
    await expect(verify(firstUrl)).rejects.toThrow("RSS unavailable");
    expect(readRss).toHaveBeenCalledTimes(2);
  });
});
