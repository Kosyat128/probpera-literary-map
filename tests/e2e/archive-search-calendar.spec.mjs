import { expect, test } from "@playwright/test";

test("календарь открывает и фокусирует карточку выбранного писателя", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop focus contract");
  await page.goto("/#calendar");
  const event = page.locator(".calendar-agenda-day button").first();
  await expect(event).toBeVisible({ timeout: 20_000 });
  const writerName = (await event.locator("strong").innerText()).trim();

  await event.click();

  const detail = page.locator(".writer-detail");
  await expect(detail.locator("h4")).toHaveText(writerName, {
    timeout: 20_000,
  });
  await expect(detail).toBeFocused({ timeout: 5_000 });
});

test("единый поиск доступен, находит Достоевского по латинице и завершает загрузку", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop search contract");
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть единый поиск" }).click();
  const search = page.getByRole("searchbox", {
    name: "Страна, писатель, книга, статья, эпоха…",
  });
  await expect(search).toBeFocused();

  await search.fill("Dostoevsky");
  await expect(
    page.locator(".global-search-results button").filter({ hasText: /Достоевск/u }).first()
  ).toBeVisible({ timeout: 20_000 });

  await search.fill("zzzz-no-such-literary-record");
  await expect(page.locator(".global-search-empty:not(.is-loading)")).toBeVisible({
    timeout: 20_000,
  });
});

test("архив и изображения сохраняют desktop-сетку и исходные пропорции", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop layout contract");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/#books");
  const grid = page.locator(".book-archive-grid");
  await expect(grid).toBeVisible({ timeout: 20_000 });
  expect(
    await grid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
    )
  ).toBe(3);

  await page.locator("#authors").scrollIntoViewIfNeeded();
  const portrait = page.locator(".author-showcase-portrait img").first();
  await expect(portrait).toBeVisible({ timeout: 20_000 });
  const portraitContract = await portrait.evaluate((image) => {
    const media = image.closest(".author-showcase-portrait");
    const imageBox = image.getBoundingClientRect();
    const mediaBox = media?.getBoundingClientRect();
    return {
      objectFit: getComputedStyle(image).objectFit,
      sameBounds: Boolean(
        mediaBox &&
          Math.abs(imageBox.width - mediaBox.width) <= 1 &&
          Math.abs(imageBox.height - mediaBox.height) <= 1
      ),
    };
  });
  expect(portraitContract).toEqual({ objectFit: "cover", sameBounds: true });

  await page.getByRole("button", { name: "Открыть единый поиск" }).click();
  const search = page.getByRole("searchbox", {
    name: "Страна, писатель, книга, статья, эпоха…",
  });
  await search.fill("Преступление и наказание");
  const cover = page.locator(".global-search-book-cover img").first();
  await expect(cover).toBeVisible({ timeout: 20_000 });
  await expect(cover).toHaveCSS("object-fit", "contain");
});

test("архив разделяет 48 проверенных книг и 9 681 карточку в очереди", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop archive queue contract");
  await page.goto("/#books");
  const filters = page.locator(".book-archive-filters");
  const all = filters.getByRole("button", { name: /Весь архив/u });
  const verified = filters.getByRole("button", {
    name: /Проверено редакцией/u,
  });
  const pending = filters.getByRole("button", { name: /Непроверенные/u });

  await expect(all).toContainText(/9\s*729/u, { timeout: 40_000 });
  await expect(verified).toContainText(/48/u);
  await expect(pending).toContainText(/9\s*681/u);

  await pending.click();
  await expect(page.locator(".book-filter-heading small")).toContainText(
    /9\s*681/u
  );
  await expect(page.locator(".archive-book-card .editorial-state").first()).toHaveText(
    "Не проверено"
  );

  await verified.click();
  await expect(page.locator(".book-filter-heading small")).toContainText(/48/u);
  await expect(page.locator(".archive-book-card .editorial-state").first()).toHaveText(
    "проверено"
  );

  const actionAlignment = await page
    .locator(".archive-book-actions")
    .first()
    .evaluate((element) => {
      const row = element.getBoundingClientRect();
      const status = element.querySelector(".editorial-state")?.getBoundingClientRect();
      const save = element.querySelector(".archive-book-save")?.getBoundingClientRect();
      const detail = element.querySelector(".archive-book-detail")?.getBoundingClientRect();
      if (!status || !save || !detail) return null;
      const centerX = (box) => box.left + box.width / 2;
      const centerY = (box) => box.top + box.height / 2;
      return {
        saveFromRowCenter: Math.abs(centerX(save) - centerX(row)),
        statusFromSaveBaseline: Math.abs(centerY(status) - centerY(save)),
        detailFromSaveBaseline: Math.abs(centerY(detail) - centerY(save)),
      };
    });

  expect(actionAlignment).not.toBeNull();
  expect(actionAlignment.saveFromRowCenter).toBeLessThanOrEqual(1);
  expect(actionAlignment.statusFromSaveBaseline).toBeLessThanOrEqual(1);
  expect(actionAlignment.detailFromSaveBaseline).toBeLessThanOrEqual(1);
});

test("на мобильном архив и изображения не растягиваются", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Mobile media contract");
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/#books");
  const grid = page.locator(".book-archive-grid");
  await expect(grid).toBeVisible({ timeout: 20_000 });
  expect(
    await grid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
    )
  ).toBe(1);

  await page
    .locator(".book-archive-filters")
    .getByRole("button", { name: /Проверено редакцией/u })
    .click();
  const mobileActions = await page
    .locator(".archive-book-actions")
    .first()
    .evaluate((element) => {
      const row = element.getBoundingClientRect();
      const statusElement = element.querySelector(".editorial-state");
      const saveElement = element.querySelector(".archive-book-save");
      const detailElement = element.querySelector(".archive-book-detail");
      const status = statusElement?.getBoundingClientRect();
      const save = saveElement?.getBoundingClientRect();
      const detail = detailElement?.getBoundingClientRect();
      if (!statusElement || !saveElement || !detailElement || !status || !save || !detail) {
        return null;
      }
      const centerX = (box) => box.left + box.width / 2;
      const centerY = (box) => box.top + box.height / 2;
      return {
        statusFits: statusElement.scrollWidth <= statusElement.clientWidth,
        detailFits: detailElement.scrollWidth <= detailElement.clientWidth,
        saveFromRowCenter: Math.abs(centerX(save) - centerX(row)),
        statusFromSaveBaseline: Math.abs(centerY(status) - centerY(save)),
        detailFromSaveBaseline: Math.abs(centerY(detail) - centerY(save)),
      };
    });
  expect(mobileActions).not.toBeNull();
  expect(mobileActions.statusFits).toBe(true);
  expect(mobileActions.detailFits).toBe(true);
  expect(mobileActions.saveFromRowCenter).toBeLessThanOrEqual(1);
  expect(mobileActions.statusFromSaveBaseline).toBeLessThanOrEqual(1);
  expect(mobileActions.detailFromSaveBaseline).toBeLessThanOrEqual(1);

  await page.locator("#authors").scrollIntoViewIfNeeded();
  const portrait = page.locator(".author-showcase-portrait img").first();
  await expect(portrait).toBeVisible({ timeout: 20_000 });
  await expect(portrait).toHaveCSS("object-fit", "cover");

  await page
    .locator(".mobile-nav")
    .getByRole("button", { name: "Поиск" })
    .click();
  await page
    .getByRole("searchbox", { name: "Страна, писатель, книга, статья, эпоха…" })
    .fill("Преступление и наказание");
  const cover = page.locator(".global-search-book-cover img").first();
  await expect(cover).toBeVisible({ timeout: 20_000 });
  await expect(cover).toHaveCSS("object-fit", "contain");
});
