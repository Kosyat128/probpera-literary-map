import { expect, test } from "@playwright/test";
import { installObservers } from "../../scripts/lib/bookshelf-physics-observer.mjs";

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

test("книга из каталога открывается первым нажатием при раскрытых подсказках поиска", async ({
  page,
  isMobile,
}) => {
  await openBookCatalog(page);
  const search = page.getByRole("combobox", {
    name: "Поиск по книге, автору или стране",
    exact: true,
  });
  await search.fill("Хижина дяди Тома");
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await search.press("Tab");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.focus();
  await expect(search).toHaveAttribute("aria-expanded", "true");
  await search.press("Escape");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.click();
  await expect(search).toHaveAttribute("aria-expanded", "true");

  const card = page.locator(".archive-book-card").filter({ hasText: "Хижина дяди Тома" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("Гарриет Бичер-Стоу");
  const details = card.locator(".archive-book-detail");
  if (isMobile) await details.tap();
  else await details.click();

  const detail = page.locator("#book-archive-detail");
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("Когда у мистера Шелби возникают денежные трудности");
  await expect(page).toHaveURL(/book=usa%3Aharriet_beecher_stowe%3Auncle-toms-cabin/u);
  await expect(detail.getByRole("button", { name: "Гарриет Бичер-Стоу", exact: true })).toHaveCount(0);
});

for (const locale of ["ru", "en"]) {
  test(`страна показывает общее количество книг независимо от проверки (${locale})`, async ({ page, isMobile }, testInfo) => {
    await page.addInitScript(language => localStorage.setItem("probpera-interface-language", language), locale);
    await page.goto("/?country=greece#atlas");
    const panel = page.locator('.atlas-country-presentation[data-atlas-country="greece"]');
    if (isMobile) await panel.locator(".atlas-country-sheet-toggle").click();
    const metric = panel.locator(".country-metric--works");
    await expect(metric.locator("strong")).toHaveText("23", { timeout: 20_000 });
    await expect(metric).toHaveAttribute("aria-busy", "false");
    await expect(metric.locator("span")).toHaveText(locale === "ru" ? "произведения" : "works");
    await expect(metric).toBeVisible();
    await metric.scrollIntoViewIfNeeded();
    await metric.screenshot({ path: testInfo.outputPath(`greece-catalog-count-${locale}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });

  test(`готовая непроверенная аннотация доступна в полном каталоге (${locale})`, async ({ page, isMobile }, testInfo) => {
    await page.addInitScript(language => localStorage.setItem("probpera-interface-language", language), locale);
    await page.goto("/#books");
    const catalog = page.locator(".book-shelf-controls__views button").nth(1);
    await expect(catalog).toBeVisible({ timeout: 20_000 });
    await catalog.click();
    await expect(page.locator(".book-archive-reviewed-count")).toHaveAttribute("data-count", "69");
    await expect(page.locator(".book-archive-pending-count")).toHaveAttribute("data-count", "9694");
    const totals = page.locator(".book-archive-total");
    expect(await totals.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await totals.screenshot({ path: testInfo.outputPath(`library-counts-${locale}.png`) });
    const search = page.locator(".book-shelf-controls input[role=combobox]");
    const title = locale === "ru" ? "Маленькие женщины" : "Little Women";
    const status = locale === "ru" ? "Пока не проверено" : "Not yet reviewed";
    await search.fill(title);
    const card = page.locator(".archive-book-card").filter({ hasText: title });
    await expect(card).toHaveCount(1);
    await expect(card.locator(".editorial-state")).toHaveText(status);
    const button = card.locator(".archive-book-detail");
    if (isMobile) await button.tap();
    else await button.click();
    const detail = page.locator("#book-archive-detail");
    await expect(detail).toBeVisible();
    await expect(detail.locator(".book-detail-copy > .section-kicker")).toHaveText(status);
    await expect(detail).toContainText(locale === "ru"
      ? "Четыре сестры Марч — Мег, Джо, Бет и Эми"
      : "The four March sisters—Meg, Jo, Beth and Amy");
    await expect(page).toHaveURL(/book=usa%3Alouisa_may_alcott%3Alittle-women/u);
    const reader = detail.locator(".book-dossier-reader");
    await reader.getByRole("button", { name: locale === "ru" ? "Следующий раздел" : "Next section", exact: true }).click();
    await expect(reader.locator(".book-dossier-reader__eyebrow")).toHaveText(status);
    await expect(reader).toContainText(locale === "ru" ? "Четыре сестры Марч" : "The four March sisters");
    await expect(detail.getByRole("button", { name: locale === "ru" ? "Луиза Мэй Олкотт" : "Louisa May Alcott", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  });
}

test("3D-книга показывает готовую аннотацию с отметкой о непроверенном статусе", async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), "One real 3D rendering contract; bilingual mobile text is covered above");
  await page.addInitScript(`(${installObservers.toString()})(); window.__REACT_DEVTOOLS_GLOBAL_HOOK__.renderers = new Map();`);
  await page.goto("/#books");
  const search = page.locator(".book-shelf-controls input[role=combobox]");
  await expect(search).toBeVisible({ timeout: 20_000 });
  await search.fill("Маленькие женщины");
  await search.press("Escape");
  const workspace = page.locator(".book-shelf-frame__workspace");
  await workspace.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__shelfAudit.read()?.books.length === 1 && window.__shelfAudit.read()?.pendingFrames === 0);
  const point = await page.evaluate(() => window.__shelfAudit.read().books[0]);
  await page.mouse.click(point.x, point.y);
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "INSPECTION_CLOSED");
  await page.locator(".book-detail-open-cover").click();
  await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "BOOK_OPEN");
  const reader = page.locator(".book-dossier-reader");
  await reader.getByRole("button", { name: "Следующий раздел", exact: true }).click();
  await expect(reader.locator(".book-dossier-reader__eyebrow")).toHaveText("Пока не проверено");
  await expect(reader).toContainText("Четыре сестры Марч");
  await expect.poll(() => page.evaluate(() => window.__shelfAudit.read()?.pageIndex)).toBeGreaterThan(0);
  const rendered = await page.evaluate(() => {
    const data = window.__shelfAudit.sceneData();
    return data.books.find(book => book.selectedBookKey === book.layout.spec.key)?.editorialDocument?.pages;
  });
  expect(rendered.some(item => item.eyebrow === "Пока не проверено" && item.paragraphs.some(text => text.includes("Четыре сестры Марч")))).toBe(true);
});

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

test("архив показывает полный каталог и разделяет проверенные и непроверенные карточки", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop archive queue contract");
  await openBookCatalog(page);
  const resultCount = page.locator(".book-filter-panel > span");

  await expect(resultCount).toHaveText(/^9\s?763\s+результата$/u, {
    timeout: 40_000,
  });
  const filterDialog = await openArchiveFilters(page);
  await expect(page.locator(".book-archive-reviewed-count")).toHaveAttribute("data-count", "69");
  await expect(page.locator(".book-archive-pending-count")).toHaveAttribute("data-count", "9694");
  const pending = filterDialog.getByLabel("Пока не проверено", { exact: true });
  await expect(pending).toBeVisible();
  await pending.check();
  await expect(pending).toBeChecked();
  await closeArchiveFilters(page, filterDialog);
  await expect(resultCount).toHaveText(/^9\s?694\s+результата$/u);
  await expect(page.locator(".archive-book-card").first()).toBeVisible();
  await expect(page.locator(".archive-book-card .editorial-state").first()).toHaveText("Пока не проверено");

  await selectVerifiedBooks(page);
  await expect(resultCount).toHaveText(/^69\s+результатов$/u);
  await expect(page.locator(".archive-book-card .editorial-state").first()).toHaveText(
    "Проверено редакцией"
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
