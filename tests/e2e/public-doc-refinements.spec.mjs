import { expect, test } from "@playwright/test";

test("book of the month and the section directory keep a coherent desktop grid", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.locator(".brand small")).toHaveText("Литературный журнал");

  const book = page.locator(".book-of-day");
  await book.scrollIntoViewIfNeeded();
  await expect(book.locator(".section-kicker")).toHaveText("Выбор редакции");
  await expect(book.locator(".book-action-primary")).toBeVisible({
    timeout: 60_000,
  });
  await expect(book.locator(".book-action-secondary")).toBeVisible();
  await expect(book.locator(".book-source-link")).toBeVisible();

  const bookGeometry = await book.evaluate((element) => {
    const copy = element.querySelector(":scope > div:last-child");
    const primaryActions = element.querySelector(".book-actions-primary");
    const source = element.querySelector(".book-source-link");
    if (!copy || !primaryActions || !source) return null;
    const copyBox = copy.getBoundingClientRect();
    const actionBox = primaryActions.getBoundingClientRect();
    const sourceBox = source.getBoundingClientRect();
    return {
      copyWidth: copyBox.width,
      sourceAfterActions: sourceBox.top >= actionBox.bottom - 1,
      overflow: element.scrollWidth - element.clientWidth,
    };
  });
  expect(bookGeometry).not.toBeNull();
  expect(bookGeometry.copyWidth).toBeGreaterThan(540);
  expect(bookGeometry.sourceAfterActions).toBe(true);
  expect(bookGeometry.overflow).toBeLessThanOrEqual(1);

  await page.setViewportSize({ width: 1024, height: 860 });
  const directory = page.locator(".sections-directory-grid");
  await directory.scrollIntoViewIfNeeded();
  const directoryGeometry = await directory.evaluate((element) => {
    const cards = [...element.querySelectorAll(".section-directory-card")];
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").length,
      narrowestCard: Math.min(
        ...cards.map((card) => card.getBoundingClientRect().width)
      ),
      overflow: element.scrollWidth - element.clientWidth,
      documentOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(directoryGeometry.columns).toBe(2);
  expect(directoryGeometry.narrowestCard).toBeGreaterThan(400);
  expect(directoryGeometry.overflow).toBeLessThanOrEqual(1);
  expect(directoryGeometry.documentOverflow).toBeLessThanOrEqual(2);
});

test("mobile search overlay remains compact, scrollable and keyboard-safe", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const searchTrigger = page.locator(".site-header .global-search-trigger");
  const mobileNav = page.locator(".mobile-nav");
  await expect(searchTrigger).toBeVisible();
  await expect(mobileNav).toBeVisible();

  const navGeometry = await mobileNav.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    firstControlHeight:
      element.querySelector("a, button, summary")?.getBoundingClientRect().height ?? 0,
  }));
  expect(navGeometry.height).toBeLessThanOrEqual(54);
  expect(navGeometry.firstControlHeight).toBeGreaterThanOrEqual(44);

  await searchTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Найти в «Пробе Пера»" });
  const input = dialog.getByRole("searchbox");
  const close = dialog.getByRole("button", { name: "Закрыть поиск" });
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();

  const searchGeometry = await dialog.evaluate((element) => {
    const header = element.querySelector(":scope > header");
    const field = element.querySelector(".global-search-field");
    const inputElement = element.querySelector("input");
    const closeButton = header?.querySelector("button");
    if (!header || !field || !inputElement || !closeButton) return null;
    return {
      dialog: element.getBoundingClientRect().toJSON(),
      headerHeight: header.getBoundingClientRect().height,
      fieldHeight: field.getBoundingClientRect().height,
      closeWidth: closeButton.getBoundingClientRect().width,
      closeHeight: closeButton.getBoundingClientRect().height,
      inputFontSize: Number.parseFloat(getComputedStyle(inputElement).fontSize),
      documentOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(searchGeometry).not.toBeNull();
  expect(searchGeometry.dialog.width).toBeLessThanOrEqual(320);
  expect(searchGeometry.dialog.height).toBeLessThanOrEqual(720);
  expect(searchGeometry.headerHeight).toBeLessThan(145);
  expect(searchGeometry.fieldHeight).toBeGreaterThanOrEqual(44);
  expect(searchGeometry.fieldHeight).toBeLessThanOrEqual(70);
  expect(searchGeometry.closeWidth).toBeGreaterThanOrEqual(44);
  expect(searchGeometry.closeHeight).toBeGreaterThanOrEqual(44);
  expect(searchGeometry.inputFontSize).toBe(16);
  expect(searchGeometry.documentOverflow).toBeLessThanOrEqual(2);

  await input.fill("Достоевский");
  await expect(dialog.locator(".global-search-results")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(searchTrigger).toBeFocused();
});

test("desktop header actions remain fully visible around the compact breakpoint", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");

  for (const width of [1451, 1470, 1499, 1504, 1520, 1521]) {
    await page.setViewportSize({ width, height: 800 });
    const geometry = await page.locator(".site-header").evaluate((header) => {
      const actions = header.querySelector(".header-actions");
      const readerButton = header.querySelector(".reader-button");
      const socials = actions?.querySelector(".header-socials");
      if (!actions || !readerButton || !socials) return null;
      const viewportLeft = 0;
      const viewportRight = window.innerWidth;
      const actionsBox = actions.getBoundingClientRect();
      const readerBox = readerButton.getBoundingClientRect();
      return {
        actionsLeft: actionsBox.left,
        actionsRight: actionsBox.right,
        readerLeft: readerBox.left,
        readerRight: readerBox.right,
        socialsVisible: getComputedStyle(socials).display !== "none",
        viewportLeft,
        viewportRight,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry.actionsLeft).toBeGreaterThanOrEqual(geometry.viewportLeft);
    expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.viewportRight);
    expect(geometry.readerLeft).toBeGreaterThanOrEqual(geometry.viewportLeft);
    expect(geometry.readerRight).toBeLessThanOrEqual(geometry.viewportRight);
    if (width <= 1520) expect(geometry.socialsVisible).toBe(false);
  }
});

test("globe controls expose correctly ordered touch targets", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();

  const globe = page.locator(".literary-globe:not(.is-loading)");
  await expect(globe).toBeVisible({ timeout: 60_000 });
  const controls = globe.locator(".globe-controls > button");
  await expect(controls).toHaveCount(5);
  await expect
    .poll(() =>
      controls.evaluateAll((buttons) =>
        buttons.map((button) => button.dataset.globeControl)
      )
    )
    .toEqual([
      "zoom-in",
      "zoom-out",
      "auto-rotate",
      "reset",
      "edition-info",
    ]);

  const geometry = await controls.evaluateAll((buttons) =>
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return { width: bounds.width, height: bounds.height };
    })
  );
  for (const target of geometry) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }

  await expect(controls.nth(0)).toHaveAttribute(
    "aria-label",
    "Увеличить масштаб глобуса"
  );
  await expect(controls.nth(1)).toHaveAttribute(
    "aria-label",
    "Уменьшить масштаб глобуса"
  );
  await expect(controls.nth(2)).toHaveAttribute(
    "aria-label",
    "Остановить автоматическое вращение"
  );
  await expect(controls.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(controls.nth(3)).toHaveAttribute(
    "aria-label",
    "Вернуть исходный вид глобуса"
  );
  await expect(controls.nth(4)).toHaveAttribute(
    "aria-label",
    "Источник и права текущего издания глобуса"
  );
});
