import { expect, test } from "@playwright/test";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { createImageDeliveryResolver } from "../../src/utils/imageDeliveryModel.ts";

const publicRoot = new URL("../../public/", import.meta.url);
const published = JSON.parse(readFileSync(new URL("cms/published-articles.json", publicRoot), "utf8"));
const manifest = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.generated.json", import.meta.url), "utf8"));
const provenance = JSON.parse(readFileSync(new URL("../../reports/public-image-delivery.json", import.meta.url), "utf8"));
const sourceRecords = new Map(provenance.images.map(image => [image.sourceUrl, image]));
const documents = published.articles.map(article => JSON.parse(readFileSync(new URL(article.documentPath, publicRoot), "utf8")));
const mostIllustrated = [...documents].sort((a, b) => (b.contentHtml.match(/<img\b/giu) || []).length - (a.contentHtml.match(/<img\b/giu) || []).length)[0];
const articleIds = [...new Set(["cms-e6bf64b8-53eb-419d-a2e2-0e2e00acf9d8", "cms-4c60932a-cd7d-4e43-a83f-5b38dc3e0b02", "cms-0743e614-19bc-4c3d-8eba-7d43fac78d58", mostIllustrated.id])];

async function previewPrefix(request, baseURL) {
  for (const prefix of ["", "/probpera-literary-map"]) {
    const response = await request.get(new URL(`${prefix}/cms/published-articles.json`, baseURL).href);
    if ((await response.json().catch(() => null))?.publication?.articleCount === published.publication.articleCount) return `${prefix}/`;
  }
  throw new Error("The real published catalog must be available from the local preview.");
}

async function isolateImages(page, baseURL) {
  const externalImages = [];
  const hotUpdates = [];
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("probpera-interface-language", "ru");
    localStorage.setItem("probpera-display-mode", "light");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.resourceType() === "image" && /^https?:$/u.test(url.protocol) && url.origin !== new URL(baseURL).origin) {
      externalImages.push(url.href);
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
    if (typeof payload !== "string") return;
    try {
      const value = JSON.parse(payload);
      if (["update", "full-reload"].includes(value.type)) hotUpdates.push(value);
    } catch { /* Other application sockets are outside this image check. */ }
  }));
  return { externalImages, hotUpdates };
}

function inspectedImage(image) {
  const rect = image.getBoundingClientRect();
  return {
    src: image.getAttribute("src"), currentSrc: image.currentSrc || image.src,
    srcSet: image.getAttribute("srcset"), sizes: image.getAttribute("sizes"),
    width: Number(image.getAttribute("width")), height: Number(image.getAttribute("height")),
    naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
    complete: image.complete, alt: image.alt,
    fallback: image.dataset.fallbackApplied === "true" || image.classList.contains("is-fallback"),
    left: rect.left, right: rect.right,
  };
}

function imageIntersectsViewport(image) {
  if (!image.isConnected) return false;
  const rect = image.getBoundingClientRect();
  let left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
  let top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
  for (let ancestor = image; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (ancestor === image) continue;
    const box = ancestor.getBoundingClientRect();
    if (style.overflowX !== "visible") { left = Math.max(left, box.left); right = Math.min(right, box.right); }
    if (style.overflowY !== "visible") { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
  }
  return right - left > 1 && bottom - top > 1;
}

function inspectMappedImage(image, originalSource, prefix, baseURL) {
  const entry = manifest[originalSource];
  expect(entry, `published image has a rendition: ${originalSource}`).toBeTruthy();
  const variants = [...entry.variants, entry];
  const current = variants.find(variant => new URL(`${prefix}${variant.src}`, baseURL).href === image.currentSrc);
  expect(current, `exact original is displayed through its own rendition: ${originalSource} => ${image.currentSrc}`).toBeTruthy();
  expect(image.fallback, `real artwork is retained: ${originalSource}`).toBe(false);
  expect(image.complete).toBe(true);
  expect(image.naturalWidth).toBeGreaterThan(0);
  expect(image.naturalHeight).toBeGreaterThan(0);
  expect(image.width, `intrinsic width: ${originalSource}`).toBe(entry.width);
  expect(image.height, `intrinsic height: ${originalSource}`).toBe(entry.height);
  expect(Math.abs(current.height - entry.height * current.width / entry.width), `uncropped rendition: ${originalSource}`).toBeLessThanOrEqual(1);
  // srcset density makes these browser values CSS pixels, rounded separately.
  // Bound that integer rounding instead of treating a small ratio drift as crop.
  const densityHeight = current.height * image.naturalWidth / current.width;
  expect(Math.abs(image.naturalHeight - densityHeight), `decoded rendition ratio: ${originalSource}`).toBeLessThanOrEqual(1 + current.height / current.width);
  if (new Set(variants.map(variant => variant.width)).size > 1) {
    expect(image.srcSet, `responsive candidates: ${originalSource}`).toBeTruthy();
    expect(image.sizes, `responsive slot: ${originalSource}`).toBeTruthy();
  }
  const source = sourceRecords.get(originalSource);
  expect(source?.status).toBe("ready");
  return { ...image, originalSource, sourceBytes: source.source.bytes, deliveredBytes: statSync(new URL(current.src, publicRoot)).size };
}

async function recordReport(testInfo, report) {
  const originals = new Map(report.images.filter(image => image.originalSource).map(image => [image.originalSource, image.sourceBytes]));
  const renditions = new Map(report.images.filter(image => image.deliveredBytes).map(image => [image.currentSrc, image.deliveredBytes]));
  const sourceBytes = [...originals.values()].reduce((sum, bytes) => sum + bytes, 0);
  const deliveredBytes = [...renditions.values()].reduce((sum, bytes) => sum + bytes, 0);
  const complete = { ...report, summary: {
    inspectedImages: report.images.length, mappedImages: report.images.filter(image => image.originalSource).length,
    uniqueOriginals: originals.size, uniqueRenditions: renditions.size, sourceBytes, deliveredBytes,
    reductionPercent: sourceBytes ? Number(((1 - deliveredBytes / sourceBytes) * 100).toFixed(2)) : 0,
  } };
  writeFileSync(testInfo.outputPath("image-delivery-report.json"), JSON.stringify(complete, null, 2));
  await testInfo.attach("real-image-delivery", { body: JSON.stringify(complete, null, 2), contentType: "application/json" });
}

for (const articleId of articleIds) {
  const document = documents.find(article => article.id === articleId);
  test(`real published illustrations remain local and responsive: ${articleId}`, async ({ page, request, baseURL, isMobile }, testInfo) => {
    test.setTimeout(120_000);
    const prefix = await previewPrefix(request, baseURL);
    const isolation = await isolateImages(page, baseURL);
    const width = isMobile ? 390 : 1440;
    await page.setViewportSize({ width, height: 1000 });
    const path = `${prefix}${new URL(document.url).pathname.replace(/^\//u, "")}`;
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const content = page.locator(".article-reader-content");
    await expect(content).toBeVisible({ timeout: 30_000 });
    const inlineSources = await page.evaluate(html => [...new DOMParser().parseFromString(html, "text/html").querySelectorAll("img")].map(image => image.getAttribute("src")), document.contentHtml);
    const originals = [document.imageUrl, ...inlineSources].filter(Boolean);
    const images = page.locator(".article-reader-cover img, .article-reader-content img");
    await expect(images).toHaveCount(originals.length);
    const inspected = [];
    for (let index = 0; index < originals.length; index++) {
      const image = images.nth(index);
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      const value = await image.evaluate(inspectedImage);
      expect(value.left).toBeGreaterThanOrEqual(-1);
      expect(value.right).toBeLessThanOrEqual(width + 1);
      inspected.push(inspectMappedImage(value, originals[index], prefix, baseURL));
    }
    expect(await page.locator(".article-reader").evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    expect(isolation.externalImages.filter(url => manifest[url]), "mapped artwork never requests an external server").toEqual([]);
    expect(isolation.hotUpdates, "the source and runtime image manifest are stable").toEqual([]);
    await recordReport(testInfo, { articleId, title: document.title, width, inlineImages: inlineSources.length, images: inspected, ...isolation });
    await page.locator(".article-reader-cover").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath("real-article-images.png") });
  });
}

test("homepage images load from top to bottom with external image servers blocked", async ({ page, request, baseURL, isMobile }, testInfo) => {
  test.setTimeout(150_000);
  const prefix = await previewPrefix(request, baseURL);
  const isolation = await isolateImages(page, baseURL);
  const width = isMobile ? 390 : 1440;
  const delivery = createImageDeliveryResolver(manifest, prefix);
  await page.setViewportSize({ width, height: 1000 });
  await page.goto(prefix, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".magazine-hero")).toBeVisible({ timeout: 30_000 });
  const seen = new Map();
  let reachedBottom = false;
  for (let step = 0; step < 100; step++) {
    // Lazy sections insert new image nodes while the page is traversed. Keep
    // each sampled node's identity instead of letting a live nth locator shift.
    const visibleImages = await page.locator("body img").elementHandles();
    for (const image of visibleImages) {
      if (!await image.evaluate(imageIntersectsViewport)) continue;
      const initial = await image.evaluate(inspectedImage);
      await expect.poll(async () => {
        if (!await image.evaluate(imageIntersectsViewport)) return "outside";
        return await image.evaluate(element => element.complete && element.naturalWidth > 0) ? "ready" : "pending";
      }, { timeout: 15_000, message: `visible homepage image decodes: ${initial.currentSrc} (${initial.alt})` }).not.toBe("pending");
      if (!await image.evaluate(imageIntersectsViewport)) continue;
      const value = await image.evaluate(inspectedImage);
      expect(value.fallback, `homepage artwork is retained: ${value.alt}`).toBe(false);
      const original = delivery.original(value.currentSrc);
      seen.set(`${value.currentSrc}:${value.alt}`, manifest[original] ? inspectMappedImage(value, original, prefix, baseURL) : value);
    }
    await Promise.all(visibleImages.map(image => image.dispose()));
    reachedBottom = await page.evaluate(() => {
      const height = document.documentElement.scrollHeight;
      if (scrollY + innerHeight >= height - 2) return true;
      window.scrollTo({ top: Math.min(scrollY + innerHeight * .72, height - innerHeight), behavior: "instant" });
      return false;
    });
    if (reachedBottom) break;
    await page.waitForTimeout(120);
  }
  expect(reachedBottom, "the complete homepage was traversed").toBe(true);
  expect(seen.size, "real homepage images were inspected").toBeGreaterThan(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(isolation.externalImages.filter(url => manifest[url]), "mapped homepage artwork never requests an external server").toEqual([]);
  expect(isolation.hotUpdates).toEqual([]);
  await recordReport(testInfo, { page: "homepage", width, images: [...seen.values()], ...isolation });
  await page.screenshot({ path: testInfo.outputPath("homepage-images-bottom.png") });
});
