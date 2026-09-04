import { expect, test } from "@playwright/test";

const editorialWidths = [320, 360, 390, 768, 1366, 1440, 1920];

test.setTimeout(150_000);

async function openHomepage(page, width, height, locale = "ru") {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await expect(page.locator(".magazine-hero")).toBeVisible();
  const localeButton = page.locator(".interface-language-control button").nth(locale === "ru" ? 0 : 1);
  await localeButton.click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await page.evaluate(() => document.fonts.ready);
}

function intersects(first, second) {
  return !(
    first.right <= second.left ||
    second.right <= first.left ||
    first.bottom <= second.top ||
    second.bottom <= first.top
  );
}

test("RU and EN hero copy, calls to action and proof stay readable across the matrix", async ({ page }) => {
  for (const locale of ["ru", "en"]) {
    for (const width of editorialWidths) {
      const height = width <= 430 ? 844 : width === 768 ? 1024 : 900;
      await openHomepage(page, width, height, locale);

      const result = await page.locator(".magazine-hero").evaluate((hero) => {
        const heading = hero.querySelector("h1");
        const paragraph = hero.querySelector(".hero-editorial > p");
        const actions = hero.querySelector(".hero-actions");
        const proof = hero.querySelector(".hero-proof");
        const callsToAction = [...hero.querySelectorAll(".hero-actions .ui-action")];
        if (!heading || !paragraph || !actions || !proof || callsToAction.length !== 2) return null;
        const box = (element) => element.getBoundingClientRect().toJSON();
        return {
          headingText: heading.textContent?.replace(/\s+/gu, " ").trim(),
          heading: box(heading),
          paragraph: box(paragraph),
          actions: box(actions),
          proof: box(proof),
          hero: box(hero),
          ctas: callsToAction.map(box),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });

      expect(result, `${locale}/${width}`).not.toBeNull();
      expect(result.headingText).toBe(
        locale === "ru" ? "Литература - это целый мир!" : "Literature is a world of its own!"
      );
      expect(result.overflow, `${locale}/${width}`).toBeLessThanOrEqual(2);
      expect(intersects(result.heading, result.paragraph), `${locale}/${width} heading/paragraph`).toBe(false);
      expect(intersects(result.paragraph, result.actions), `${locale}/${width} paragraph/actions`).toBe(false);
      expect(intersects(result.actions, result.proof), `${locale}/${width} actions/proof`).toBe(false);
      expect(result.heading.left).toBeGreaterThanOrEqual(result.hero.left - 1);
      expect(result.heading.right).toBeLessThanOrEqual(result.hero.right + 1);
      expect(result.proof.bottom).toBeLessThanOrEqual(result.hero.bottom + 1);
      for (const cta of result.ctas) expect(cta.height).toBeGreaterThanOrEqual(44);
      expect(Math.abs(result.ctas[0].height - result.ctas[1].height)).toBeLessThanOrEqual(1);
    }
  }
});

test("mobile controls and the original lower navigation remain reachable", async ({ page }) => {
  for (const width of [320, 360, 390]) {
    await openHomepage(page, width, 844);
    const navigation = page.locator(".mobile-nav");
    const controls = page.locator(
      ".site-header .global-search-trigger, .site-header .interface-language-control button, .site-header .reader-button"
    );
    await expect(navigation).toBeVisible();

    const geometry = await controls.evaluateAll((items) =>
      items.map((item) => {
        const rect = item.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
      })
    );
    for (const target of geometry) {
      expect(target.width, `${width}`).toBeGreaterThanOrEqual(44);
      expect(target.height, `${width}`).toBeGreaterThanOrEqual(44);
      expect(target.left, `${width}`).toBeGreaterThanOrEqual(0);
      expect(target.right, `${width}`).toBeLessThanOrEqual(width);
    }

    await navigation.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect(navigation.locator("a, button").last()).toBeInViewport();
  }
});

test("desktop menus stay viewport-safe and return keyboard focus on Escape", async ({ page }) => {
  for (const width of [1366, 1440, 1920]) {
    await openHomepage(page, width, 900);
    for (const menuClass of ["articles", "sections"]) {
      const details = page.locator(`.${menuClass}-menu`);
      const summary = details.locator(":scope > summary");
      const panel = details.locator(`.${menuClass}-mega-menu`);
      await summary.focus();
      await expect(panel).not.toBeVisible();
      await page.keyboard.press("Enter");
      await expect(details).toHaveAttribute("open", "");
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds.x, `${menuClass}/${width}`).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width, `${menuClass}/${width}`).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
      await expect(details).not.toHaveAttribute("open", "");
      await expect(summary).toBeFocused();
      await expect(panel).not.toBeVisible();
    }
  }
});

test("protected header bands, Hero art direction and reduced motion remain deterministic", async ({ page }) => {
  await openHomepage(page, 768, 1024);
  await expect.poll(() => page.locator(".hero-cover img").evaluate((image) => image.currentSrc)).toContain(
    "?v=20260813-literary-nature-final"
  );

  await openHomepage(page, 1024, 768);
  await expect.poll(() => page.locator(".hero-cover img").evaluate((image) => image.currentSrc)).toContain(
    "?v=20260813-literary-nature-final"
  );

  for (const width of [1366, 1440, 1920]) {
    await openHomepage(page, width, 900);
    const bands = await page.evaluate(() => {
      const topline = document.querySelector(".topline")?.getBoundingClientRect();
      const header = document.querySelector(".site-header")?.getBoundingClientRect();
      const mobile = document.querySelector(".mobile-nav");
      return {
        toplineHeight: topline?.height ?? 0,
        toplineBottom: topline?.bottom ?? -1,
        headerTop: header?.top ?? -1,
        headerHeight: header?.height ?? 0,
        mobileDisplay: mobile ? getComputedStyle(mobile).display : "missing",
      };
    });
    expect(bands.toplineHeight, `${width}`).toBeGreaterThan(0);
    expect(bands.headerHeight, `${width}`).toBeGreaterThan(0);
    expect(Math.abs(bands.toplineBottom - bands.headerTop), `${width}`).toBeLessThanOrEqual(1);
    expect(bands.mobileDisplay, `${width}`).toBe("none");
  }

  await openHomepage(page, 1920, 900);
  const actions = page.locator(".site-header .header-actions");
  await expect(actions.locator(".global-search-trigger")).toBeVisible();
  await expect(actions.locator(".interface-language-control")).toBeVisible();
  await expect(actions.locator(".header-socials a")).toHaveCount(5);
  await expect(actions.locator(".header-socials a").first()).toBeVisible();
  await expect(actions.locator(".reader-button")).toBeVisible();
  const actionOrder = await actions.locator(
    ":scope > .global-search-trigger, :scope > .interface-language-control, :scope > .header-socials, :scope > .reader-button"
  ).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().left));
  expect(actionOrder).toHaveLength(4);
  expect(actionOrder).toEqual([...actionOrder].sort((first, second) => first - second));

  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHomepage(page, 1440, 900);
  const motion = await page.evaluate(() => {
    const social = document.querySelector(".site-header .header-socials a");
    return {
      socialAnimation: social ? getComputedStyle(social).animationName : "none",
      socialIterations: social ? getComputedStyle(social).animationIterationCount : "1",
    };
  });
  expect(motion.socialAnimation === "none" || motion.socialIterations === "1").toBe(true);
});

test("footer menu keeps the approved tighter vertical rhythm", async ({ page }) => {
  await openHomepage(page, 1440, 900);
  const columns = page.locator(".footer-map > section");
  await expect(columns).toHaveCount(3);
  const rowGaps = await columns.evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).rowGap)
  );
  expect(rowGaps).toEqual(["5px", "5px", "5px"]);
});
