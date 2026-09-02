import { expect, test } from "@playwright/test";

async function openBookCatalog(page) {
  await page.goto("/#books");
  const catalogButton = page.getByRole("button", {
    name: "Каталог",
    exact: true,
  });
  await expect(catalogButton).toBeVisible({ timeout: 20_000 });
  await catalogButton.click();
  await expect(catalogButton).toHaveAttribute("aria-pressed", "true");
}

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
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openBookCatalog(page);
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

test("архив публикует 46 проверенных книг и не раскрывает редакционную очередь", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop archive queue contract");
  await openBookCatalog(page);
  const filters = page.locator(".book-archive-filters");
  const verified = filters.getByRole("button", {
    name: /Проверено/u,
  });

  await expect(filters).toHaveAttribute("aria-label", /^46\s+результатов$/u, {
    timeout: 40_000,
  });
  await page
    .getByRole("button", { name: "Расширенные фильтры", exact: true })
    .click();
  const filterDialog = page.getByRole("dialog", {
    name: "Расширенные фильтры книжного архива",
  });
  const pending = filterDialog.getByLabel("Не проверено", { exact: true });
  await expect(pending).toBeVisible();
  await pending.check();
  await expect(pending).toBeChecked();
  await filterDialog
    .getByRole("button", { name: "Закрыть фильтры", exact: true })
    .click();
  await expect(filters).toHaveAttribute("aria-label", /^0\s+результатов$/u);
  await expect(page.locator(".archive-book-card")).toHaveCount(0);
  await expect(page.locator(".book-archive-empty")).toContainText(
    "Ничего не найдено"
  );

  await verified.click();
  await expect(filters).toHaveAttribute("aria-label", /^46\s+результатов$/u);
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
  await openBookCatalog(page);
  const grid = page.locator(".book-archive-grid");
  await expect(grid).toBeVisible({ timeout: 20_000 });
  expect(
    await grid.evaluate((element) =>
      getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length
    )
  ).toBe(1);

  await page
    .locator(".book-archive-filters")
    .getByRole("button", { name: /Проверено/u })
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
      const overlaps = (first, second) =>
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top;
      return {
        statusFits: statusElement.scrollWidth <= statusElement.clientWidth,
        detailFits: detailElement.scrollWidth <= detailElement.clientWidth,
        actionsFit: element.scrollWidth <= element.clientWidth,
        saveFromRowCenter: Math.abs(centerX(save) - centerX(row)),
        statusWidth: status.width,
        saveWidth: save.width,
        detailWidth: detail.width,
        statusBeforeSave: status.bottom <= save.top + 0.5,
        saveBeforeDetail: save.bottom <= detail.top + 0.5,
        controlsOverlap:
          overlaps(status, save) ||
          overlaps(status, detail) ||
          overlaps(save, detail),
      };
    });
  expect(mobileActions).not.toBeNull();
  expect(mobileActions.statusFits).toBe(true);
  expect(mobileActions.detailFits).toBe(true);
  expect(mobileActions.actionsFit).toBe(true);
  expect(mobileActions.saveFromRowCenter).toBeLessThanOrEqual(1);
  expect(mobileActions.statusWidth).toBeGreaterThanOrEqual(44);
  expect(mobileActions.saveWidth).toBeGreaterThanOrEqual(44);
  expect(mobileActions.detailWidth).toBeGreaterThanOrEqual(44);
  expect(mobileActions.statusBeforeSave).toBe(true);
  expect(mobileActions.saveBeforeDetail).toBe(true);
  expect(mobileActions.controlsOverlap).toBe(false);

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

test("статус, сохранение и детали книг не пересекаются на адаптивных ширинах", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop responsive archive contract");
  await openBookCatalog(page);
  await page
    .locator(".book-archive-filters")
    .getByRole("button", { name: /Проверено/u })
    .click();
  await expect(page.locator(".archive-book-actions").first()).toBeVisible({
    timeout: 20_000,
  });

  const responsiveCases = [
    { width: 1521, columns: 3, minimumActionWidth: 1 },
    { width: 1451, columns: 3, minimumActionWidth: 1 },
    { width: 1280, columns: 3, minimumActionWidth: 1 },
    { width: 1024, columns: 2, minimumActionWidth: 1 },
    { width: 768, columns: 2, minimumActionWidth: 1 },
    { width: 390, columns: 1, minimumActionWidth: 44 },
    { width: 320, columns: 1, minimumActionWidth: 44 },
  ];

  for (const responsiveCase of responsiveCases) {
    await page.setViewportSize({ width: responsiveCase.width, height: 900 });

    const geometry = await page.evaluate(() => {
      const intersects = (left, right) =>
        Math.min(left.right, right.right) - Math.max(left.left, right.left) > 0.5 &&
        Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 0.5;
      const grid = document.querySelector(".book-archive-grid");
      const rows = [...document.querySelectorAll(".archive-book-actions")].slice(0, 12);
      const filterButtons = [...document.querySelectorAll(".book-archive-filters button")];
      return {
        columns: grid
          ? getComputedStyle(grid).gridTemplateColumns.split(" ").filter(Boolean).length
          : 0,
        overlaps: rows.filter((row) => {
          const status = row.querySelector(".editorial-state")?.getBoundingClientRect();
          const save = row.querySelector(".archive-book-save")?.getBoundingClientRect();
          const detail = row.querySelector(".archive-book-detail")?.getBoundingClientRect();
          return Boolean(
            status &&
              save &&
              detail &&
              (intersects(status, save) || intersects(save, detail) || intersects(status, detail))
          );
        }).length,
        minimumStatusWidth: Math.min(
          ...rows.map(
            (row) => row.querySelector(".editorial-state")?.getBoundingClientRect().width ?? 0
          )
        ),
        minimumDetailWidth: Math.min(
          ...rows.map(
            (row) => row.querySelector(".archive-book-detail")?.getBoundingClientRect().width ?? 0
          )
        ),
        filterCountOverlaps: filterButtons.filter((button) => {
          const copy = button.querySelector(".book-filter-copy")?.getBoundingClientRect();
          const count = button.querySelector(".book-filter-count")?.getBoundingClientRect();
          return Boolean(copy && count && intersects(copy, count));
        }).length,
      };
    });

    expect(geometry.columns).toBe(responsiveCase.columns);
    expect(geometry.overlaps).toBe(0);
    expect(geometry.minimumStatusWidth).toBeGreaterThanOrEqual(
      responsiveCase.minimumActionWidth
    );
    expect(geometry.minimumDetailWidth).toBeGreaterThanOrEqual(
      responsiveCase.minimumActionWidth
    );
    if (responsiveCase.width <= 430) {
      expect(geometry.filterCountOverlaps).toBe(0);
    }
  }
});
