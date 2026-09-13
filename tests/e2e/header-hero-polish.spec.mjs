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

test("section mega-menu shares title and description rows without clipping text", async ({ page }) => {
  await openHomepage(page, 1440, 900);
  await page.locator(".sections-menu > summary").click();
  const facesLoaded = await page.evaluate(async () => {
    const faces = await document.fonts.load('500 18px "Onest Local"', "Навигация по разделам");
    return faces.length > 0 && faces.every(face => face.status === "loaded");
  });
  expect(facesLoaded).toBe(true);
  const groups = await page.locator(".sections-mega-groups > section").evaluateAll(sections => {
    const textRects = element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].filter(rect => rect.width > 0).map(rect => ({
        left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      }));
    };
    return sections.map(section => [...section.querySelectorAll("a")].map(anchor => {
      const title = anchor.querySelector("strong");
      const description = anchor.querySelector("small");
      const bounds = anchor.getBoundingClientRect();
      return { bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom },
        title: textRects(title), description: textRects(description),
        titleFont: getComputedStyle(title).fontFamily, titleWeight: getComputedStyle(title).fontWeight,
        descriptionFont: getComputedStyle(description).fontFamily, descriptionSize: parseFloat(getComputedStyle(description).fontSize),
      };
    }));
  });
  expect(groups).toHaveLength(4);
  for (let index = 0; index < Math.max(...groups.map(group => group.length)); index += 1) {
    const row = groups.flatMap(group => group[index] ? [group[index]] : []);
    for (const role of ["title", "description"]) {
      const baselines = row.map(item => item[role][0].top);
      expect(Math.max(...baselines) - Math.min(...baselines), `${role}/${index}`).toBeLessThanOrEqual(1);
    }
  }
  for (const item of groups.flat()) {
    expect(item.titleFont).toContain("Onest Local");
    expect(item.titleWeight).toBe("500");
    expect(item.descriptionFont).toContain("Onest Local");
    expect(item.descriptionSize).toBeGreaterThanOrEqual(12);
    for (const box of [...item.title, ...item.description]) {
      expect(box.left).toBeGreaterThanOrEqual(item.bounds.left - 1);
      expect(box.right).toBeLessThanOrEqual(item.bounds.right + 1);
      expect(box.top).toBeGreaterThanOrEqual(item.bounds.top - 1);
      expect(box.bottom).toBeLessThanOrEqual(item.bounds.bottom + 1);
    }
    expect(Math.max(...item.title.map(box => box.bottom))).toBeLessThanOrEqual(item.description[0].top + 1);
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

test("publication showcase fits complete previews without nested or panel scrolling", async ({ page }) => {
  for (const locale of ["ru", "en"]) {
    await openHomepage(page, 1547, 900, locale);
    for (const [width, height] of [[1280, 600], [1280, 720], [1366, 768], [1547, 900], [1920, 1080]]) {
      await page.setViewportSize({ width, height });
      const summary = page.locator(".articles-menu > summary");
      const panel = page.locator(".articles-mega-menu");
      await summary.focus();
      await page.keyboard.press("Enter");
      await expect(panel).toBeVisible();
      await expect(panel.locator(".articles-mega-lead")).toBeVisible();
      const geometry = await panel.evaluate(element => {
        const box = node => node.getBoundingClientRect().toJSON();
        const content = element.querySelector(".articles-mega-content");
        const list = content.querySelector("section");
        const lead = content.querySelector(".articles-mega-lead");
        const cards = [...list.querySelectorAll("a")].filter(card => card.getClientRects().length);
        return {
          panel: box(element),
          image: box(lead.querySelector("img")),
          cards: cards.map(box),
          cardCount: list.querySelectorAll("a").length,
          footer: box(element.querySelector("footer")),
          scroll: [element, content, list].map(node => node.scrollHeight - node.clientHeight),
          text: [lead, ...cards].flatMap(card => [...card.querySelectorAll("strong, p, small, em, section span")].flatMap(copy => {
            const range = document.createRange();
            range.selectNodeContents(copy);
            return [...range.getClientRects()].filter(rect => rect.width > 0).map(rect => ({
              bounds: box(card),
              left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            }));
          })),
        };
      });
      expect(geometry.panel.left, `${locale}/${width}/${height}`).toBeGreaterThanOrEqual(0);
      expect(geometry.panel.right).toBeLessThanOrEqual(width);
      expect(geometry.panel.bottom, `${locale}/${width}/${height}`).toBeLessThanOrEqual(height);
      for (const overflow of geometry.scroll) expect(overflow).toBeLessThanOrEqual(1);
      expect(geometry.image.width).toBeLessThan(geometry.panel.width * .4);
      expect(geometry.image.height).toBeLessThanOrEqual(height <= 740 ? 96 : 180);
      expect(geometry.cards).toHaveLength(Math.min(geometry.cardCount, height <= 740 ? 4 : 6));
      for (const card of geometry.cards) expect(card.bottom).toBeLessThanOrEqual(geometry.footer.top + 1);
      for (const text of geometry.text) {
        expect(text.left).toBeGreaterThanOrEqual(text.bounds.left - 1);
        expect(text.right).toBeLessThanOrEqual(text.bounds.right + 1);
        expect(text.top).toBeGreaterThanOrEqual(text.bounds.top - 1);
        expect(text.bottom).toBeLessThanOrEqual(text.bounds.bottom + 1);
      }
      await expect(panel.locator("footer a")).toBeVisible();
      await expect(panel.locator("footer a")).toHaveAttribute("href", /\/stati\/$/u);
      await page.keyboard.press("Escape");
      await expect(panel).not.toBeVisible();
    }
    await page.setViewportSize({ width: 1260, height: 600 });
    await expect(page.locator(".articles-menu > summary")).not.toBeVisible();
    await expect(page.locator('.mobile-nav a[href*="journal"]')).toBeVisible();
  }
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
