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

async function openArchiveFilters(page) {
  const trigger = page.getByRole("button", {
    name: "Расширенные фильтры",
    exact: true,
  });
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  const dialog = page.getByRole("dialog", {
    name: "Расширенные фильтры библиотеки",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-controls", await dialog.getAttribute("id"));
  return dialog;
}

async function closeArchiveFilters(page, dialog) {
  await dialog.getByRole("button", { name: "Закрыть фильтры", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Расширенные фильтры", exact: true }))
    .toHaveAttribute("aria-expanded", "false");
}

async function selectVerifiedBooks(page) {
  const dialog = await openArchiveFilters(page);
  const verified = dialog.getByRole("group", { name: "Активные фильтры", exact: true })
    .getByRole("button", { name: "Проверено", exact: true });
  await verified.click();
  await expect(verified).toHaveAttribute("aria-pressed", "true");
  await closeArchiveFilters(page, dialog);
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
  // Scrolling can place the previous Catalog click over a portrait's hover zoom.
  await page.mouse.move(0, 0);
  const portrait = page.locator(".author-showcase-portrait img").first();
  await expect(portrait).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => portrait.evaluate((image) => {
    const button = image.closest(".author-showcase button");
    return button ? button.matches(":hover") : null;
  })).toBe(false);
  await expect.poll(() => portrait.evaluate(async (image) => {
    if (!image.complete || image.naturalWidth === 0) return false;
    try {
      await image.decode();
      return true;
    } catch {
      return false;
    }
  })).toBe(true);
  await expect.poll(() => portrait.evaluate((image) => {
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
  })).toEqual({ objectFit: "cover", sameBounds: true });

  await page.getByRole("button", { name: "Открыть единый поиск" }).click();
  const search = page.getByRole("searchbox", {
    name: "Страна, писатель, книга, статья, эпоха…",
  });
  await search.fill("Преступление и наказание");
  const cover = page.locator(".global-search-book-cover img").first();
  await expect(cover).toBeVisible({ timeout: 20_000 });
  await expect(cover).toHaveCSS("object-fit", "contain");
});

test("архив публикует 56 проверенных книг и не раскрывает редакционную очередь", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop archive queue contract");
  await openBookCatalog(page);
  const resultCount = page.locator(".book-filter-panel > span");

  await expect(resultCount).toHaveText(/^56\s+результатов$/u, {
    timeout: 40_000,
  });
  const filterDialog = await openArchiveFilters(page);
  const pending = filterDialog.getByLabel("Не проверено", { exact: true });
  await expect(pending).toBeVisible();
  await pending.check();
  await expect(pending).toBeChecked();
  await closeArchiveFilters(page, filterDialog);
  await expect(resultCount).toHaveText(/^0\s+результатов$/u);
  await expect(page.locator(".archive-book-card")).toHaveCount(0);
  await expect(page.locator(".book-archive-empty")).toContainText(
    "Ничего не найдено"
  );

  await selectVerifiedBooks(page);
  await expect(resultCount).toHaveText(/^56\s+результатов$/u);
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
      const centerY = (box) => box.top + box.height / 2;
      return {
        saveFromRowStart: Math.abs(save.left - row.left),
        statusFromRowStart: Math.abs(status.left - row.left),
        statusFromRowEnd: Math.abs(status.right - row.right),
        statusBeforeActions: status.bottom < Math.min(save.top, detail.top),
        detailFromSaveBaseline: Math.abs(centerY(detail) - centerY(save)),
        actionGap: detail.left - save.right,
        minimumActionWidth: Math.min(save.width, detail.width),
        minimumActionHeight: Math.min(save.height, detail.height),
        boundsFit: [status, save, detail].every((box) =>
          box.left >= row.left && box.right <= row.right &&
          box.top >= row.top && box.bottom <= row.bottom
        ),
      };
    });

  expect(actionAlignment).not.toBeNull();
  expect(actionAlignment.saveFromRowStart).toBeLessThanOrEqual(1);
  expect(actionAlignment.statusFromRowStart).toBeLessThanOrEqual(1);
  expect(actionAlignment.statusFromRowEnd).toBeLessThanOrEqual(1);
  expect(actionAlignment.statusBeforeActions).toBe(true);
  expect(actionAlignment.detailFromSaveBaseline).toBeLessThanOrEqual(1);
  expect(actionAlignment.actionGap).toBeGreaterThanOrEqual(8);
  expect(actionAlignment.minimumActionWidth).toBeGreaterThanOrEqual(44);
  expect(actionAlignment.minimumActionHeight).toBeGreaterThanOrEqual(44);
  expect(actionAlignment.boundsFit).toBe(true);
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

  await selectVerifiedBooks(page);
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
      const centerY = (box) => box.top + box.height / 2;
      const overlaps = (first, second) =>
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top;
      return {
        statusFits: statusElement.scrollWidth <= statusElement.clientWidth,
        detailFits: detailElement.scrollWidth <= detailElement.clientWidth,
        actionsFit: element.scrollWidth <= element.clientWidth,
        saveFromRowStart: Math.abs(save.left - row.left),
        statusFromRowStart: Math.abs(status.left - row.left),
        statusFromRowEnd: Math.abs(status.right - row.right),
        statusWidth: status.width,
        saveWidth: save.width,
        detailWidth: detail.width,
        minimumActionHeight: Math.min(save.height, detail.height),
        statusBeforeActions: status.bottom < Math.min(save.top, detail.top),
        detailFromSaveBaseline: Math.abs(centerY(detail) - centerY(save)),
        actionGap: detail.left - save.right,
        boundsFit: [status, save, detail].every((box) =>
          box.left >= row.left && box.right <= row.right &&
          box.top >= row.top && box.bottom <= row.bottom
        ),
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
  expect(mobileActions.saveFromRowStart).toBeLessThanOrEqual(1);
  expect(mobileActions.statusFromRowStart).toBeLessThanOrEqual(1);
  expect(mobileActions.statusFromRowEnd).toBeLessThanOrEqual(1);
  expect(mobileActions.statusWidth).toBeGreaterThanOrEqual(44);
  expect(mobileActions.saveWidth).toBeGreaterThanOrEqual(44);
  expect(mobileActions.detailWidth).toBeGreaterThanOrEqual(44);
  expect(mobileActions.minimumActionHeight).toBeGreaterThanOrEqual(44);
  expect(mobileActions.statusBeforeActions).toBe(true);
  expect(mobileActions.detailFromSaveBaseline).toBeLessThanOrEqual(1);
  expect(mobileActions.actionGap).toBeGreaterThanOrEqual(8);
  expect(mobileActions.boundsFit).toBe(true);
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
  await selectVerifiedBooks(page);
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
      // Presets now live in the drawer; measure the visible controls instead
      // of accepting an empty query for the removed toolbar count badges.
      const dialog = await openArchiveFilters(page);
      const presets = dialog.getByRole("group", { name: "Активные фильтры", exact: true })
        .getByRole("button");
      await expect(presets).toHaveText(["Проверено", "Классика"]);
      const filterGeometry = await presets.evaluateAll((buttons) => {
        const boxes = buttons.map((button) => button.getBoundingClientRect());
        return {
          labelsFit: buttons.every((button, index) => {
            const range = document.createRange();
            range.selectNodeContents(button);
            const text = range.getBoundingClientRect();
            const box = boxes[index];
            return text.left >= box.left && text.right <= box.right &&
              text.top >= box.top && text.bottom <= box.bottom &&
              button.scrollWidth <= button.clientWidth;
          }),
          minimumWidth: Math.min(...boxes.map((box) => box.width)),
          minimumHeight: Math.min(...boxes.map((box) => box.height)),
          overlaps: boxes.some((box, index) => boxes.slice(index + 1).some((other) =>
            Math.min(box.right, other.right) - Math.max(box.left, other.left) > 0.5 &&
            Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 0.5
          )),
        };
      });
      expect(filterGeometry.labelsFit).toBe(true);
      expect(filterGeometry.minimumWidth).toBeGreaterThanOrEqual(44);
      expect(filterGeometry.minimumHeight).toBeGreaterThanOrEqual(44);
      expect(filterGeometry.overlaps).toBe(false);
      await closeArchiveFilters(page, dialog);
    }
  }
});
