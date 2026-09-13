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

test("header social links and language controls remain reachable across responsive layouts", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  for (const locale of ["ru", "en"]) {
    await page.locator(".site-header .interface-language-control button").nth(locale === "ru" ? 0 : 1).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    for (const width of [320, 390, 680, 681, 768, 900, 901, 1260, 1280, 1366, 1520, 1521, 1547, 1600, 1601, 1700, 1701, 1920]) {
      await page.setViewportSize({ width, height: 800 });
      const geometry = await page.locator(".site-header").evaluate((header) => {
        const actions = header.querySelector(".header-actions");
        const readerButton = header.querySelector(".reader-button");
        const socials = actions?.querySelector(".header-socials");
        const language = actions?.querySelector(".interface-language-control");
        const mobileNav = document.querySelector(".mobile-nav");
        if (!actions || !readerButton || !socials || !language || !mobileNav) return null;
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
          footerSocialLinks: [...document.querySelectorAll(".footer-brand .header-socials a")].map(link => ({
            visible: !!link.getClientRects().length,
            href: link.href,
          })),
          links: [...socials.querySelectorAll("a")].map(link => ({
            visible: !!link.getClientRects().length,
            href: link.href,
            ...link.getBoundingClientRect().toJSON(),
          })),
          languageButtons: [...language.querySelectorAll("button")].map(button => ({
            fontSize: getComputedStyle(button).fontSize,
            fontWeight: getComputedStyle(button).fontWeight,
            ...button.getBoundingClientRect().toJSON(),
          })),
          coarsePointer: matchMedia("(pointer: coarse)").matches,
          controls: [header.querySelector(".brand"), header.querySelector(":scope > nav"), ...actions.children]
            .filter(element => element && getComputedStyle(element).display !== "none")
            .map(element => ({ selector: element.className || element.tagName, ...element.getBoundingClientRect().toJSON() })),
          headerBottom: header.getBoundingClientRect().bottom,
          mobileVisible: getComputedStyle(mobileNav).display !== "none",
          mobileTop: mobileNav.getBoundingClientRect().top,
          overflow: document.documentElement.scrollWidth - innerWidth,
          viewportLeft,
          viewportRight,
        };
      });

      expect(geometry).not.toBeNull();
      expect(geometry.actionsLeft).toBeGreaterThanOrEqual(geometry.viewportLeft);
      expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.viewportRight);
      expect(geometry.readerLeft).toBeGreaterThanOrEqual(geometry.viewportLeft);
      expect(geometry.readerRight).toBeLessThanOrEqual(geometry.viewportRight);
      expect(geometry.socialsVisible, `${locale}/${width}`).toBe(width > 680);
      expect(geometry.links).toHaveLength(5);
      expect(geometry.links.every(link => link.visible === (width > 680))).toBe(true);
      expect(geometry.links.some(link => new URL(link.href).hostname === "boosty.to")).toBe(true);
      expect(geometry.footerSocialLinks).toHaveLength(5);
      expect(geometry.footerSocialLinks.every(link => link.visible)).toBe(true);
      expect(geometry.footerSocialLinks.some(link => new URL(link.href).hostname === "boosty.to")).toBe(true);
      expect(geometry.overflow, `${locale}/${width}`).toBeLessThanOrEqual(1);
      for (const control of geometry.controls) {
        expect(control.left, `${locale}/${width} ${control.selector}`).toBeGreaterThanOrEqual(0);
        expect(control.right, `${locale}/${width} ${control.selector}`).toBeLessThanOrEqual(width);
      }
      for (const [index, first] of geometry.controls.entries()) {
        for (const second of geometry.controls.slice(index + 1)) {
          const overlap = first.left < second.right - 1 && first.right > second.left + 1 && first.top < second.bottom - 1 && first.bottom > second.top + 1;
          expect(overlap, `${locale}/${width} ${first.selector} / ${second.selector}`).toBe(false);
        }
      }
      for (const button of geometry.languageButtons) {
        expect(button.fontSize).toBe("10px");
        expect(button.fontWeight).toBe("900");
      }
      if (width <= 680 || geometry.coarsePointer) {
        for (const control of [...geometry.links.filter(link => link.visible), ...geometry.languageButtons]) {
          expect(control.width, `${locale}/${width}`).toBeGreaterThanOrEqual(44);
          expect(control.height, `${locale}/${width}`).toBeGreaterThanOrEqual(44);
        }
      }
      if (geometry.mobileVisible) expect(geometry.mobileTop).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
      if ([320, 768, 1280, 1547, 1701].includes(width)) {
        await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
        await expect.poll(() => page.locator(".site-header").evaluate(header => header.getBoundingClientRect().top)).toBe(0);
        if (geometry.mobileVisible) {
          const stickyGap = await page.locator(".mobile-nav").evaluate(nav => nav.getBoundingClientRect().top - document.querySelector(".site-header").getBoundingClientRect().bottom);
          expect(Math.abs(stickyGap), `${locale}/${width} sticky navigation`).toBeLessThanOrEqual(1);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      }
    }
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
      "zoom-out",
      "zoom-in",
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
    /^Уменьшить масштаб глобуса\. Текущий масштаб \d+%$/u
  );
  await expect(controls.nth(1)).toHaveAttribute(
    "aria-label",
    /^Увеличить масштаб глобуса\. Текущий масштаб \d+%$/u
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
