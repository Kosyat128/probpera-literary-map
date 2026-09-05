import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createImageDeliveryResolver } from "../../src/utils/imageDeliveryModel.ts";

const source = JSON.parse(readFileSync(new URL("../../public/cms/articles/cms-e6bf64b8-53eb-419d-a2e2-0e2e00acf9d8.json", import.meta.url), "utf8"));
const assetRoot = new URL("../../public/", import.meta.url);
const portrait = "/book-reading-fixture/shakespeare.jpg";
const cover = "/book-reading-fixture/hamlet.webp";
const compactText = value => value.replace(/\s/gu, "");
const imageManifest = JSON.parse(readFileSync(new URL("../../src/data/imageDelivery.generated.json", import.meta.url), "utf8"));

function deliveredCoverUrl(articleUrl) {
  const articlePath = new URL(source.url).pathname;
  const basePath = new URL(articleUrl).pathname.slice(0, -articlePath.length) + "/";
  return createImageDeliveryResolver(imageManifest, basePath).url(source.imageUrl, 1280);
}

async function fixtureArticleUrl(request, baseURL, article = source) {
  for (const prefix of ["", "/probpera-literary-map"]) {
    const response = await request.get(new URL(`${prefix}/${article.documentPath}`, baseURL).href);
    const document = await response.json().catch(() => null);
    if (document?.id === article.id) return new URL(prefix + new URL(article.url).pathname, baseURL).href;
  }
  throw new Error("The bilingual article fixture must be available from the local preview.");
}

test("real vocabulary illustrations stay with their own numbered entries at every reader font size", async ({ page, request, baseURL, isMobile }, testInfo) => {
  test.setTimeout(240_000);
  const article = JSON.parse(readFileSync(new URL("../../public/cms/articles/cms-0e262528-70b9-43c4-8160-7cfb5c6b101c.json", import.meta.url), "utf8"));
  const url = await fixtureArticleUrl(request, baseURL, article);
  const articlePath = new URL(article.url).pathname;
  const prefix = new URL(url).pathname.slice(0, -articlePath.length) + "/";
  const delivery = createImageDeliveryResolver(imageManifest, prefix);
  await installEnvironment(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // The narrow viewport also exercises the book's additional readability scale.
  await page.setViewportSize({ width: isMobile ? 320 : 1440, height: 1000 });
  const book = await enterBook(page, url, "ru");
  await expect(book).toHaveAttribute("data-renderer", "three", { timeout: 30_000 });
  await expectPage(book, 0);
  const original = await page.evaluate(html => {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    const entries = [...body.querySelectorAll("h2")].filter(heading => /^\s*\d+\./u.test(heading.textContent)).map(heading => {
      let text = "";
      let source = "";
      for (let node = heading.nextElementSibling; node && node.tagName !== "H2"; node = node.nextElementSibling) {
        text += ` ${node.textContent}`;
        source ||= node.querySelector("img")?.getAttribute("src") || "";
      }
      return { heading: heading.textContent.replace(/\s+/gu, " ").trim(), text: text.replace(/\s+/gu, " ").trim(), source };
    });
    return { entries, text: body.textContent };
  }, article.contentHtml);
  expect(original.entries).toHaveLength(25);
  expect(original.entries[12].heading).toBe("13. Гематология");
  expect(original.entries[13].heading).toBe("14. Гобелен");
  await book.locator("summary").click();
  const reports = [];
  let currentScale = 1;
  for (const scale of [1, 0.9, 1.3]) {
    const change = scale > currentScale ? "Увеличить шрифт" : "Уменьшить шрифт";
    for (let step = 0; step < Math.round(Math.abs(scale - currentScale) * 10); step++) {
      await page.locator(".article-reader-bar").getByRole("button", { name: change, exact: true }).click();
    }
    currentScale = scale;
    await expect.poll(() => book.evaluate(node => Number(node.style.getPropertyValue("--reader-scale")))).toBeCloseTo(scale, 2);
    await settleResize(page, book);
    await expect(book).toHaveAttribute("data-renderer", "three");
    const count = Number(await book.getAttribute("data-page-count"));
    const pages = [];
    for (let index = 0; index < count; index++) {
      await book.locator("select").selectOption(String(index));
      await expectPage(book, index);
      pages.push(await book.locator("[data-article-book-page]").evaluate(node => ({
        text: node.textContent,
        content: [...node.querySelectorAll("h2, h3, h4, h5, h6, p, img")].map(element => element instanceof HTMLImageElement
          ? { source: element.getAttribute("src") }
          : element.tagName === "P" ? { text: element.textContent }
          : { heading: element.textContent.replace(/\s+/gu, " ").trim() }),
      })));
    }
    expect(compactText(pages.map(value => value.text).join("")), `all original text survives at ${scale}`).toBe(compactText(article.title + original.text));
    const associations = [];
    for (const entry of original.entries) {
      const sourceUrl = delivery.url(entry.source, 1280);
      const matches = pages.flatMap((value, index) => value.content.some(item => item.source === sourceUrl) ? [{ ...value, index }] : []);
      expect(matches, `exactly one illustration for ${entry.heading} at ${scale}`).toHaveLength(1);
      const containingPage = matches[0];
      // A long entry may span pages, but its illustration must retain the end
      // of its own definition instead of opening the following entry's page.
      const imagePosition = containingPage.content.findIndex(item => item.source === sourceUrl);
      const precedingText = containingPage.content.slice(0, imagePosition).findLast(item => item.text)?.text || "";
      expect(precedingText, `own definition accompanies ${entry.heading} at ${scale}`).toMatch(/\p{L}{3}/u);
      expect(compactText(entry.text).endsWith(compactText(precedingText)), `the text before the illustration belongs to ${entry.heading} at ${scale}`).toBe(true);
      const precedingHeading = containingPage.content.slice(0, imagePosition).findLast(item => item.heading)?.heading;
      if (precedingHeading) expect(precedingHeading, `preceding heading belongs to ${entry.heading} at ${scale}`).toBe(entry.heading);
      else expect(containingPage.content.filter(item => item.heading), `a continuation illustration cannot introduce the next entry at ${scale}`).toEqual([]);
      if (["13. Гематология", "14. Гобелен"].includes(entry.heading)) {
        expect(containingPage.content.some(item => item.heading === entry.heading), `short entry and its illustration share a page at ${scale}`).toBe(true);
      }
      associations.push({ heading: entry.heading, page: containingPage.index + 1, source: sourceUrl });
    }
    reports.push({ width: isMobile ? 320 : 1440, fontScale: scale, pageCount: count, associations });
    if (scale === 1) {
      for (const entry of [12, 13, 14]) {
        const index = associations[entry - 1].page - 1;
        await book.locator("select").selectOption(String(index));
        await expectPage(book, index);
        await book.locator("summary").click();
        await book.screenshot({ path: testInfo.outputPath(`vocabulary-entry-${entry}.png`) });
        await book.locator("summary").click();
      }
    }
  }
  await testInfo.attach("real-vocabulary-image-associations", { body: JSON.stringify(reports, null, 2), contentType: "application/json" });
});

function illustratedContent(locale) {
  const en = locale === "en";
  const first = en ? "The first passage opens our illustrated reading." : "Первый отрывок открывает наше иллюстрированное чтение.";
  const middle = en ? "The middle passage preserves the complete argument." : "Средний отрывок сохраняет рассуждение полностью.";
  const last = en ? "The final passage completes the illustrated reading." : "Последний отрывок завершает иллюстрированное чтение.";
  const paragraph = en
    ? "The reader follows a character through difficult choices. Careful attention to language reveals how the story changes, while each illustration offers another way to understand the scene. A printed page must preserve every sentence and keep the accompanying image available."
    : "Читатель следит за героем, которому предстоит непростой выбор. Внимание к языку помогает заметить изменения в повествовании, а иллюстрация предлагает ещё один способ понять изображённую сцену. Книжная страница должна сохранять каждое предложение и оставлять сопровождающее изображение доступным.";
  const heading = en ? "An illustrated reading" : "Иллюстрированное чтение";
  const portraitAlt = en ? "William Shakespeare portrait" : "Портрет Уильяма Шекспира";
  const coverAlt = en ? "Hamlet book cover" : "Обложка книги «Гамлет»";
  const html = `<h2 id="illustrated-reading">${heading}</h2><p>${first}</p>`
    + Array.from({ length: 3 }, (_, index) => `<p>${index + 1}. ${paragraph}</p>`).join("")
    + `<figure><img src="${portrait}" alt="${portraitAlt}" width="480" height="640"><figcaption>${portraitAlt}.</figcaption></figure>`
    + `<p>${middle} <strong>${en ? "Every word remains." : "Каждое слово остаётся."}</strong></p>`
    + Array.from({ length: 3 }, (_, index) => `<p>${index + 4}. ${paragraph}</p>`).join("")
    + `<figure><img src="${cover}" alt="${coverAlt}" width="480" height="720"><figcaption>${coverAlt}.</figcaption></figure>`
    + `<p>${last} <a href="https://probpera.ru/">${en ? "Return to the journal" : "Вернуться к журналу"}</a>.</p>`;
  return { html, first, middle, last, portraitAlt, coverAlt, headings: [{ id: "illustrated-reading", level: 2, text: heading }] };
}

async function prepare(page, locale) {
  const ru = illustratedContent("ru");
  const en = illustratedContent("en");
  const document = {
    ...source,
    contentHtml: ru.html,
    plainText: ru.html.replace(/<[^>]+>/gu, " "),
    headings: ru.headings,
    sources: [],
    bibliography: [],
    translations: { en: {
      ...source.translations.en,
      contentHtml: en.html,
      plainText: en.html.replace(/<[^>]+>/gu, " "),
      headings: en.headings,
      sources: [],
      bibliography: [],
    } },
  };
  await page.route("**/cms/articles/cms-e6bf64b8-53eb-419d-a2e2-0e2e00acf9d8.json", route => route.fulfill({ json: document }));
  // Real site illustrations keep the test independent of remote media availability.
  await page.route(`**${portrait}`, route => route.fulfill({ body: readFileSync(new URL("brand/shakespeare.jpg", assetRoot)), contentType: "image/jpeg" }));
  await page.route(`**${cover}`, route => route.fulfill({ body: readFileSync(new URL("brand/book-covers/hamlet-editorial.webp", assetRoot)), contentType: "image/webp" }));
  await page.route(source.imageUrl, route => route.fulfill({ body: readFileSync(new URL("brand/book-covers/hamlet-editorial.webp", assetRoot)), contentType: "image/webp", headers: { "access-control-allow-origin": "*" } }));
  return illustratedContent(locale);
}

async function installEnvironment(page, noWebgl = false) {
  await page.addInitScript(({ disableWebgl }) => {
    const language = new URL(location.href).searchParams.get("bookLocale") || "ru";
    localStorage.clear();
    localStorage.setItem("probpera-interface-language", language);
    localStorage.setItem("probpera-display-mode", "dark");
    window.__articleBookImageDraws = [];
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      if (image instanceof HTMLImageElement && image.src.includes("/book-reading-fixture/")) {
        window.__articleBookImageDraws.push({
          src: image.src,
          complete: image.complete,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          sourceRatio: image.naturalWidth / image.naturalHeight,
          renderedRatio: args.length >= 4 ? args.at(-2) / args.at(-1) : image.naturalWidth / image.naturalHeight,
        });
      }
      return drawImage.call(this, image, ...args);
    };
    if (disableWebgl) {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return String(kind).startsWith("webgl") ? null : getContext.call(this, kind, ...args);
      };
    }
  }, { disableWebgl: noWebgl });
}

async function enterBook(page, url, locale) {
  const localizedUrl = new URL(url);
  localizedUrl.searchParams.set("bookLocale", locale);
  await page.goto(localizedUrl.href);
  await expect(page.locator(".article-reader-content")).toBeVisible({ timeout: 30_000 });
  await page.locator(".article-reader-bar").getByRole("button", { name: locale === "en" ? "Printed book mode" : "Режим печатной книги", exact: true }).click();
  const book = page.locator("[data-article-book-reader]");
  await expect(book).toBeVisible({ timeout: 30_000 });
  await expect(book).toHaveAttribute("lang", locale);
  await expect(page.locator(".article-reader-content")).toBeHidden();
  return book;
}

async function expectPage(book, index) {
  await expect(book).toHaveAttribute("data-page-index", String(index));
  await expect(book.locator("select")).toBeEnabled({ timeout: 15_000 });
  await expect(book.locator("select")).toHaveValue(String(index));
  await expect(book).toHaveAttribute("data-book-ready", "true", { timeout: 15_000 });
}

async function settleResize(page, book) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(() => book.evaluate(node => node.dataset.renderer === "text" ||
    node.dataset.bookReady === "true" && node.querySelector("select")?.disabled === false), { timeout: 20_000 }).toBe(true);
}

async function assertGeometry(page, book, widths) {
  const renderer = await book.getAttribute("data-renderer");
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await settleResize(page, book);
    await expect(book).toHaveAttribute("data-renderer", renderer, { timeout: 20_000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const geometry = await book.evaluate(node => {
      // The decorative blurred backdrop intentionally extends beyond the stage.
      const selectors = [".article-book-reader__stage canvas", ".article-book-reader__controls", ".article-book-reader__text", ".article-book-reader__fallback"];
      const controls = [...node.querySelectorAll("nav button, nav select")].map(control => control.getBoundingClientRect());
      return {
        readerOverflow: document.querySelector(".article-reader").scrollWidth - document.querySelector(".article-reader").clientWidth,
        bookOverflow: node.scrollWidth - node.clientWidth,
        overflowing: [...node.querySelectorAll("*")].filter(element => element.clientWidth && element.scrollWidth > element.clientWidth + 1).map(element => ({
          element: element.className || element.tagName,
          overflow: element.scrollWidth - element.clientWidth,
          text: element.textContent.slice(0, 75),
          font: getComputedStyle(element).fontSize,
        })),
        clipped: selectors.flatMap(selector => [...node.querySelectorAll(selector)]).flatMap(element => {
          const box = element.getBoundingClientRect();
          return element.scrollWidth > element.clientWidth + 1 || box.left < -1 || box.right > innerWidth + 1
            ? [{ element: element.className || element.tagName, overflow: element.scrollWidth - element.clientWidth, left: box.left, right: box.right }] : [];
        }),
        controlMinimum: controls.length ? Math.min(...controls.flatMap(box => [box.width, box.height])) : 44,
      };
    });
    expect(geometry.readerOverflow, `reader overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(geometry.bookOverflow, `book overflow at ${width}px: ${JSON.stringify(geometry.overflowing)}`).toBeLessThanOrEqual(1);
    expect(geometry.clipped, `book content clipping at ${width}px`).toEqual([]);
    expect(geometry.controlMinimum, `book controls at ${width}px`).toBeGreaterThanOrEqual(44);
  }
}

test("illustrated book preserves every page, renders illustrations and supports accessible navigation", async ({ page, request, baseURL, isMobile }, testInfo) => {
  test.setTimeout(180_000);
  await installEnvironment(page);
  const url = await fixtureArticleUrl(request, baseURL);
  for (const locale of ["ru", "en"]) {
    await page.unrouteAll({ behavior: "wait" });
    const content = await prepare(page, locale);
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const book = await enterBook(page, url, locale);
    await expect(book.locator(".article-book-reader__stage canvas")).toBeVisible({ timeout: 30_000 });
    await expect(book).toHaveAttribute("data-renderer", "three");
    await expectPage(book, 0);
    const backdrop = book.locator("[data-article-book-backdrop]");
    await expect(backdrop).toBeVisible();
    expect(await backdrop.evaluate(element => getComputedStyle(element).backgroundImage)).toContain(deliveredCoverUrl(url));
    const count = Number(await book.getAttribute("data-page-count"));
    expect(count).toBeGreaterThan(3);
    const next = book.getByRole("button", { name: locale === "en" ? "Next page" : "Следующая страница", exact: true });
    const previous = book.getByRole("button", { name: locale === "en" ? "Previous page" : "Предыдущая страница", exact: true });
    await expect(previous).toBeDisabled();
    await next.click();
    await expectPage(book, 1);
    await previous.click();
    await expectPage(book, 0);
    await book.focus();
    await page.keyboard.press("ArrowRight");
    await expectPage(book, 1);
    await page.keyboard.press("End");
    await expectPage(book, count - 1);
    await expect(next).toBeDisabled();
    await page.keyboard.press("Home");
    await expectPage(book, 0);
    // A completed bookmark must not override the reader's return to page one.
    const modeControls = page.locator(".article-reader-bar .display-mode-control");
    await modeControls.getByRole("button", { name: locale === "en" ? "Dark mode" : "Тёмный режим", exact: true }).click();
    await expect(book).toHaveCount(0);
    await expect(page.locator(".article-reader-content")).toBeVisible();
    await modeControls.getByRole("button", { name: locale === "en" ? "Printed book mode" : "Режим печатной книги", exact: true }).click();
    await expectPage(book, 0);

    await book.locator("summary").click();
    const pageTexts = [];
    const imagePages = new Map();
    for (let index = 0; index < count; index++) {
      await book.locator("select").selectOption(String(index));
      await expectPage(book, index);
      const current = book.locator("[data-article-book-page]");
      await expect(current).toBeVisible();
      pageTexts.push(await current.textContent());
      for (const src of [portrait, cover]) {
        const image = current.locator(`img[src="${src}"]`);
        if (await image.count()) {
          await image.scrollIntoViewIfNeeded();
          await expect(image).toBeVisible();
          await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
          imagePages.set(src, index);
        }
      }
    }
    const expectedText = await page.evaluate(html => new DOMParser().parseFromString(html, "text/html").body.textContent, content.html);
    const title = locale === "en" ? source.translations.en.title : source.title;
    expect(compactText(pageTexts.join(""))).toBe(compactText(title + expectedText));
    expect(imagePages.size).toBe(2);
    expect(imagePages.get(cover)).toBeGreaterThan(imagePages.get(portrait));
    for (const src of [portrait, cover]) {
      await expect.poll(() => page.evaluate(path => window.__articleBookImageDraws.some(value => value.src.endsWith(path)), src), { timeout: 15_000 }).toBe(true);
      const drawn = await page.evaluate(path => window.__articleBookImageDraws.filter(value => value.src.endsWith(path)), src);
      for (const image of drawn) expect(image.renderedRatio, `undistorted illustration: ${src}`).toBeCloseTo(image.sourceRatio, 4);
    }
    expect(compactText(expectedText).endsWith(compactText(pageTexts.at(-1)))).toBe(true);
    expect(compactText(pageTexts.at(-1)).length).toBeGreaterThan(0);
    await expect(book.locator("[data-article-book-page] p").last()).toHaveCSS("text-align", "justify");
    await expect(book.locator("[data-article-book-page] p").last()).toHaveCSS("text-align-last", "start");
    await assertGeometry(page, book, isMobile ? [390, 320] : [1440, 390, 320]);
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 1000 });
    await settleResize(page, book);
    await book.locator("select").selectOption(String(imagePages.get(portrait)));
    await expectPage(book, imagePages.get(portrait));
    if (await book.locator("details").evaluate(node => node.open)) await book.locator("summary").click();
    await book.scrollIntoViewIfNeeded();
    await book.screenshot({ path: testInfo.outputPath(`illustrated-book-${locale}.png`) });
    // Motion preference changes must not strand an otherwise usable book.
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await next.click();
    await expectPage(book, imagePages.get(portrait) + 1);
  }
});

test("a delayed illustration fills the existing book without blocking reading or resetting its page", async ({ page, request, baseURL, isMobile }, testInfo) => {
  test.setTimeout(60_000);
  await installEnvironment(page);
  const url = await fixtureArticleUrl(request, baseURL);
  await prepare(page, "ru");
  const hotUpdates = [];
  page.on("websocket", socket => socket.on("framereceived", ({ payload }) => {
    if (typeof payload !== "string") return;
    try {
      const message = JSON.parse(payload);
      if (["update", "full-reload"].includes(message.type)) hotUpdates.push(message.type);
    } catch { /* Non-Vite socket messages are unrelated to source stability. */ }
  }));
  let requestedAt = 0;
  let respondedAt = 0;
  let delay;
  let releaseImage;
  const initialPageCaptured = new Promise(resolve => { releaseImage = resolve; });
  const portraitBytes = readFileSync(new URL("brand/shakespeare.jpg", assetRoot));
  await page.route(`**${portrait}`, async route => {
    // The article DOM has its own image request before book mode is entered.
    // Delay only the canvas loader's explicitly anonymous CORS request.
    if (!(await route.request().allHeaders()).origin) {
      await route.fulfill({ body: portraitBytes, contentType: "image/jpeg" });
      return;
    }
    if (!requestedAt) {
      requestedAt = Date.now();
      // This exceeds the old 3.5-second image deadline while remaining a real
      // decoded image response. GPU startup is independent of network latency.
      delay = new Promise(resolve => setTimeout(resolve, 8000));
    }
    await delay;
    await initialPageCaptured;
    await route.fulfill({ body: portraitBytes, contentType: "image/jpeg" });
    respondedAt = Date.now();
  });
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const book = await enterBook(page, url, "ru");
  const canvas = book.locator(".article-book-reader__stage canvas");
  await expect.poll(() => book.getAttribute("data-page-count"), { timeout: 3500 }).not.toBe("0");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expectPage(book, 0);
  expect(requestedAt, "the slow illustration request has started").toBeGreaterThan(0);
  expect(respondedAt, "the complete book is usable before the slow illustration arrives").toBe(0);

  const count = Number(await book.getAttribute("data-page-count"));
  let illustrationPage = -1;
  for (let index = 1; index < count; index++) {
    await book.locator("select").selectOption(String(index));
    await expectPage(book, index);
    if (await book.locator(`[data-article-book-page] img[src="${portrait}"]`).count()) {
      illustrationPage = index;
      break;
    }
  }
  expect(illustrationPage, "a noninitial page contains the slow illustration").toBeGreaterThan(0);
  expect(respondedAt, "reading and page navigation work while the illustration is pending").toBe(0);
  expect(await page.evaluate(path => window.__articleBookImageDraws.some(value => value.src.endsWith(path)), portrait)).toBe(false);
  await canvas.evaluate(element => { window.__delayedArticleBookCanvas = element; });
  const textBeforeArrival = await book.locator("[data-article-book-page]").textContent();
  const countBeforeArrival = await book.getAttribute("data-page-count");
  const savedProgress = await page.evaluate(id => JSON.parse(localStorage.getItem("probpera-reading-progress") || "{}")[`article:${id}`]?.progress, source.id);
  releaseImage();

  await expect.poll(() => page.evaluate(path => window.__articleBookImageDraws.some(value => value.src.endsWith(path)), portrait), { timeout: 15_000 }).toBe(true);
  expect(respondedAt - requestedAt).toBeGreaterThanOrEqual(8000);
  const draws = await page.evaluate(path => window.__articleBookImageDraws.filter(value => value.src.endsWith(path)), portrait);
  for (const image of draws) {
    expect(image.complete).toBe(true);
    expect(image.naturalWidth).toBeGreaterThan(0);
    expect(image.naturalHeight).toBeGreaterThan(0);
    expect(image.renderedRatio, "late illustration keeps its decoded aspect ratio").toBeCloseTo(image.sourceRatio, 4);
  }
  expect(await canvas.evaluate(element => element === window.__delayedArticleBookCanvas && element.isConnected), "late texture refresh keeps the same live canvas").toBe(true);
  await expectPage(book, illustrationPage);
  await expect(book).toHaveAttribute("data-page-count", countBeforeArrival);
  expect(await book.locator("[data-article-book-page]").textContent()).toBe(textBeforeArrival);
  expect(await page.evaluate(id => JSON.parse(localStorage.getItem("probpera-reading-progress") || "{}")[`article:${id}`]?.progress, source.id)).toBe(savedProgress);
  expect(hotUpdates, "source and image manifests stayed frozen during this regression").toEqual([]);
  await testInfo.attach("delayed-image-evidence", { body: JSON.stringify({
    latencyMs: respondedAt - requestedAt,
    illustrationPage,
    pageCount: Number(countBeforeArrival),
    savedProgress,
    draws,
    sameCanvas: true,
    hotUpdates,
  }, null, 2), contentType: "application/json" });
  await book.screenshot({ path: testInfo.outputPath("delayed-illustration-arrived.png") });
});

test("WebGL failure retains the complete illustrated article and responsive reading", async ({ page, request, baseURL, isMobile }) => {
  test.setTimeout(90_000);
  await installEnvironment(page, true);
  const url = await fixtureArticleUrl(request, baseURL);
  for (const locale of ["ru", "en"]) {
    await page.unrouteAll({ behavior: "wait" });
    const content = await prepare(page, locale);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const book = await enterBook(page, url, locale);
    await expect(book).toHaveAttribute("data-renderer", "text", { timeout: 30_000 });
    expect(Number(await book.getAttribute("data-page-count"))).toBeGreaterThan(1);
    await page.evaluate(() => {
      window.__articleFallbackKeys = [];
      window.__articleFallbackKeyListener = event => window.__articleFallbackKeys.push({ key: event.key, prevented: event.defaultPrevented });
      window.addEventListener("keydown", window.__articleFallbackKeyListener);
    });
    await book.focus();
    for (const key of ["Space", "PageDown", "Home", "End"]) await page.keyboard.press(key);
    const fallbackKeys = await page.evaluate(() => {
      window.removeEventListener("keydown", window.__articleFallbackKeyListener);
      return window.__articleFallbackKeys;
    });
    expect(fallbackKeys.map(event => event.key)).toEqual([" ", "PageDown", "Home", "End"]);
    expect(fallbackKeys.every(event => !event.prevented), "text fallback keeps native reading keys").toBe(true);
    const fallback = book.locator(".article-book-reader__fallback > div");
    await expect(fallback).toBeVisible();
    await expect(fallback.locator("p").first()).toHaveCSS("text-align", "justify");
    const initialFontSize = await fallback.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
    await book.evaluate(element => {
      window.__articleBookRendererChanges = [];
      window.__articleBookRendererObserver = new MutationObserver(records => {
        for (const record of records) window.__articleBookRendererChanges.push(record.target.dataset.renderer);
      });
      window.__articleBookRendererObserver.observe(element, { attributes: true, attributeFilter: ["data-renderer"] });
    });
    await page.locator(".article-reader-bar").getByRole("button", { name: locale === "en" ? "Increase font size" : "Увеличить шрифт", exact: true }).click();
    await expect.poll(() => fallback.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThan(initialFontSize);
    await settleResize(page, book);
    await expect(book).toHaveAttribute("data-renderer", "text");
    expect(await page.evaluate(() => window.__articleBookRendererChanges)).not.toContain("three");
    await page.evaluate(() => window.__articleBookRendererObserver.disconnect());
    await page.locator(".article-reader-bar").getByRole("button", { name: locale === "en" ? "Decrease font size" : "Уменьшить шрифт", exact: true }).click();
    await expect.poll(() => fallback.evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBe(initialFontSize);
    const title = locale === "en" ? source.translations.en.title : source.title;
    await expect(fallback.getByRole("heading", { name: title, level: 1, exact: true })).toBeVisible();
    await expect(fallback.locator(`img[src="${deliveredCoverUrl(url)}"]`)).toBeVisible();
    for (const passage of [content.first, content.middle, content.last]) await expect(fallback).toContainText(passage);
    const expectedText = await page.evaluate(html => new DOMParser().parseFromString(html, "text/html").body.textContent, content.html);
    expect(compactText(await fallback.textContent())).toBe(compactText(title + expectedText));
    for (const alt of [content.portraitAlt, content.coverAlt]) {
      const image = fallback.locator(`img[alt="${alt}"]`);
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
    }
    await assertGeometry(page, book, isMobile ? [390, 320] : [1440, 390, 320]);
    await page.locator(".article-reader-scroll").evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
    await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem("probpera-reading-progress") || "{}")[`article:${id}`]?.progress || 0, source.id)).toBeGreaterThanOrEqual(96);
    await expect.poll(() => page.locator(".article-reader-scroll").evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThanOrEqual(2);
  }
});
