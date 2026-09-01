import { expect, test } from "@playwright/test";

const experienceSelector = "[data-atlas-experience]";
const canvasIdentity = "stage-3-stable-canvas";

function boxesOverlap(first, second) {
  return !(
    first.x + first.width <= second.x ||
    second.x + second.width <= first.x ||
    first.y + first.height <= second.y ||
    second.y + second.height <= first.y
  );
}

async function urlState(page) {
  return page.evaluate(() => {
    const url = new URL(window.location.href);
    return {
      atlasView: url.searchParams.get("atlasView"),
      country: url.searchParams.get("country"),
      hash: url.hash,
    };
  });
}

async function openEmbeddedAtlas(page) {
  await page.goto("/");
  const atlas = page.locator("#atlas");
  await expect(atlas).toBeAttached();
  await atlas.scrollIntoViewIfNeeded();

  const experience = page.locator(experienceSelector);
  const globe = experience.locator(".literary-globe:not(.is-loading)");
  const canvas = experience.locator("canvas");
  await expect(globe).toBeVisible({ timeout: 45_000 });
  await expect(canvas).toHaveCount(1);
  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");

  return { atlas, canvas, experience, globe };
}

async function enterFromEmbedded(page) {
  const atlas = await openEmbeddedAtlas(page);
  const launch = atlas.experience.locator(
    '[data-atlas-action="enter-immersive"]'
  );
  await expect(launch).toBeVisible();
  await launch.scrollIntoViewIfNeeded();
  await launch.focus();
  await launch.click();

  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-view",
    "immersive"
  );
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-transition",
    "idle"
  );
  await expect(atlas.experience).toHaveAttribute("role", "dialog");
  await expect(atlas.experience).toHaveAttribute("aria-modal", "true");
  await expect
    .poll(async () => (await urlState(page)).atlasView)
    .toBe("immersive");
  await expect(atlas.canvas).toHaveCount(1);

  return { ...atlas, launch };
}

async function markCanvas(canvas) {
  await canvas.evaluate((element, identity) => {
    element.dataset.stage3CanvasIdentity = identity;
  }, canvasIdentity);
}

async function expectMarkedCanvas(experience) {
  await expect(experience.locator("canvas")).toHaveCount(1);
  await expect(
    experience.locator(
      `canvas[data-stage3-canvas-identity="${canvasIdentity}"]`
    )
  ).toHaveCount(1);
}

async function selectCountryFromImmersiveSearch(
  page,
  experience,
  query,
  accessibleName
) {
  const searchToggle = experience.locator(
    '[data-atlas-action="toggle-search"]'
  );
  await searchToggle.click();
  await expect(experience).toHaveAttribute("data-atlas-search-open", "true");

  const input = experience.locator("[data-atlas-search-input]");
  await expect(input).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill(query);

  const option = experience.getByRole("option", {
    name: accessibleName,
    exact: true,
  });
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.click();
  await expect(experience).toHaveAttribute("data-atlas-search-open", "false");
}

test("embedded atlas enters one-canvas immersion and Escape restores scroll and focus", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  test.skip(isMobile, "Desktop covers the full modal keyboard contract.");

  const atlas = await openEmbeddedAtlas(page);
  await markCanvas(atlas.canvas);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const historyBefore = await page.evaluate(() => window.history.length);

  const launch = atlas.experience.locator(
    '[data-atlas-action="enter-immersive"]'
  );
  await launch.focus();
  await launch.click();

  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-view",
    "immersive"
  );
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-transition",
    "idle"
  );
  await expect(atlas.experience).toHaveAttribute("role", "dialog");
  await expect(atlas.experience).toHaveAttribute("aria-modal", "true");
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-entry-source",
    "embedded"
  );
  await expectMarkedCanvas(atlas.experience);
  await expect
    .poll(() => page.evaluate(() => window.history.length))
    .toBe(historyBefore + 1);
  await expect
    .poll(async () => (await urlState(page)).atlasView)
    .toBe("immersive");

  const close = atlas.experience.locator(
    '[data-atlas-action="exit-immersive"]'
  );
  await expect(close).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyPosition: document.body.style.position,
        htmlOverflow: document.documentElement.style.overflow,
      }))
    )
    .toEqual({ bodyPosition: "fixed", htmlOverflow: "hidden" });

  const firstModalControl = atlas.experience.locator(
    '[data-atlas-action="toggle-search"]'
  );
  await firstModalControl.focus();
  await page.keyboard.press("Shift+Tab");
  expect(
    await atlas.experience.evaluate(
      (element) => element.contains(document.activeElement)
    )
  ).toBe(true);

  await firstModalControl.click();
  const searchInput = atlas.experience.locator("[data-atlas-search-input]");
  await expect(searchInput).toBeFocused();
  await searchInput.press("Escape");
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-search-open",
    "false"
  );
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-view",
    "immersive"
  );
  await expect(firstModalControl).toBeFocused();

  const filtersToggle = atlas.experience.locator(
    '[data-atlas-action="toggle-filters"]'
  );
  await filtersToggle.click();
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-filters-open",
    "true"
  );
  await page.keyboard.press("Escape");
  await expect(atlas.experience).toHaveAttribute(
    "data-atlas-filters-open",
    "false"
  );
  await expect(filtersToggle).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(atlas.experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(atlas.experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect
    .poll(async () => (await urlState(page)).atlasView)
    .toBeNull();
  await expectMarkedCanvas(atlas.experience);
  await expect(launch).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        bodyPosition: document.body.style.position,
        htmlOverflow: document.documentElement.style.overflow,
      }))
    )
    .toEqual({ bodyPosition: "", htmlOverflow: "" });
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(scrollBefore, -1);
});

test("country selection replaces the immersive entry and survives Back/Forward without remounting Canvas", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  test.skip(isMobile, "Mobile country presentation has a dedicated sheet test.");

  await page.goto("/");
  const historyBefore = await page.evaluate(() => window.history.length);
  const atlasSection = page.locator("#atlas");
  await atlasSection.scrollIntoViewIfNeeded();
  const experience = page.locator(experienceSelector);
  const canvas = experience.locator("canvas");
  await expect(experience.locator(".literary-globe:not(.is-loading)")).toBeVisible({
    timeout: 45_000,
  });
  await expect(canvas).toHaveCount(1);
  await markCanvas(canvas);

  const launch = experience.locator('[data-atlas-action="enter-immersive"]');
  await launch.click();
  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");

  await selectCountryFromImmersiveSearch(page, experience, "Россия", "Россия");
  const countryPresentation = experience.locator(
    '.atlas-country-presentation[data-atlas-country="russia"]'
  );
  await expect(countryPresentation).toBeVisible({ timeout: 30_000 });
  await expect(countryPresentation).toContainText("Россия");
  await expectMarkedCanvas(experience);
  await expect
    .poll(() => page.evaluate(() => window.history.length))
    .toBe(historyBefore + 1);
  await expect.poll(async () => (await urlState(page)).country).toBe("russia");

  const englishButton = experience
    .locator(".interface-language-control button")
    .filter({ hasText: "EN" });
  await englishButton.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    experience.locator(".atlas-immersive-identity strong")
  ).toHaveText("Literary Planet");
  await expect(
    experience.locator('[data-atlas-action="exit-immersive"]')
  ).toHaveAttribute("aria-label", "Close the Literary Planet");
  await expect(countryPresentation).toContainText("Russia");

  await page.goBack();
  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect.poll(async () => (await urlState(page)).atlasView).toBeNull();
  await expect.poll(async () => (await urlState(page)).country).toBe("russia");
  await expect(
    experience.locator(
      '.atlas-country-presentation[data-atlas-country="russia"]'
    )
  ).toBeVisible({ timeout: 30_000 });
  await expectMarkedCanvas(experience);

  await page.goForward();
  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect.poll(async () => (await urlState(page)).country).toBe("russia");
  await expect(
    experience.locator(
      '.atlas-country-presentation[data-atlas-country="russia"]'
    )
  ).toBeVisible({ timeout: 30_000 });
  await expectMarkedCanvas(experience);
});

test("the default Hero CTA opens the existing atlas surface directly", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The desktop project is sufficient for the Hero source contract.");

  await page.goto("/");
  const experience = page.locator(experienceSelector);
  await expect(experience).toBeAttached();
  await experience.evaluate((element) => {
    element.dataset.stage3SurfaceIdentity = "hero-reuses-atlas";
  });

  const heroCta = page.locator(".hero-actions .primary-action");
  await expect(heroCta).toHaveAttribute("href", "#atlas");
  await heroCta.click();

  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-entry-source", "hero");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect(
    page.locator(
      '[data-atlas-experience][data-stage3-surface-identity="hero-reuses-atlas"]'
    )
  ).toHaveCount(1);
  await expect(experience.locator("canvas")).toHaveCount(1, {
    timeout: 45_000,
  });
  await expect(page.locator(`${experienceSelector} canvas`)).toHaveCount(1);
  await expect
    .poll(async () => (await urlState(page)).atlasView)
    .toBe("immersive");

  const exitAnimation = await experience
    .locator('[data-atlas-action="exit-immersive"]')
    .evaluate(async (button) => {
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const surface = button.closest("[data-atlas-experience]");
      return {
        name: getComputedStyle(surface).animationName,
        transition: surface.dataset.atlasTransition,
      };
    });
  expect(exitAnimation).toEqual({
    name: "atlas-space-expand",
    transition: "exiting",
  });
  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect.poll(async () => (await urlState(page)).hash).toBe("#atlas");
  await expect(experience.locator('[data-atlas-action="enter-immersive"]')).toBeFocused();
});

test("a direct immersive URL closes by replace without adding or consuming history", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Direct-entry history semantics are viewport independent.");

  await page.goto("/?atlasView=immersive");
  const historyBefore = await page.evaluate(() => window.history.length);
  const experience = page.locator(experienceSelector);
  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-entry-source", "url");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect(experience.locator("canvas")).toHaveCount(1, {
    timeout: 45_000,
  });

  const immersiveBox = await experience.boundingBox();
  const viewport = page.viewportSize();
  expect(immersiveBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(Math.abs(immersiveBox.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(immersiveBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(immersiveBox.width - viewport.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(immersiveBox.height - viewport.height)).toBeLessThanOrEqual(1);

  const origin = await experience.evaluate((element) => ({
    height: Number.parseFloat(element.style.getPropertyValue("--atlas-origin-height")),
    width: Number.parseFloat(element.style.getPropertyValue("--atlas-origin-width")),
  }));
  expect(origin.width).toBeGreaterThan(0);
  expect(origin.height).toBeGreaterThan(0);

  const exitAnimation = await experience
    .locator('[data-atlas-action="exit-immersive"]')
    .evaluate(async (button) => {
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const surface = button.closest("[data-atlas-experience]");
      return {
        name: getComputedStyle(surface).animationName,
        transition: surface.dataset.atlasTransition,
      };
    });
  expect(exitAnimation).toEqual({
    name: "atlas-space-expand",
    transition: "exiting",
  });
  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect.poll(async () => (await urlState(page)).atlasView).toBeNull();
  await expect.poll(async () => (await urlState(page)).hash).toBe("#atlas");
  await expect
    .poll(() => page.evaluate(() => window.history.length))
    .toBe(historyBefore);
});

test("embedded launch keeps a dedicated touch-safe row above the globe on narrow layouts", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The desktop project owns the exact responsive matrix.");

  for (const viewport of [
    { width: 360, height: 800 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    const { experience } = await openEmbeddedAtlas(page);
    const geometry = await experience.evaluate((element) => {
      const box = (selector) => {
        const target = element.querySelector(selector);
        if (!target) throw new Error(`Missing ${selector}`);
        const rect = target.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      };
      return {
        copy: box(".globe-copy"),
        launch: box(".atlas-immersion-launch"),
        stage: box(".world-map-stage"),
        style: box(".globe-style-switch"),
      };
    });

    expect(
      geometry.launch.y + geometry.launch.height,
      `${viewport.width}px launch must end before the globe stage`
    ).toBeLessThanOrEqual(geometry.stage.y);
    expect(boxesOverlap(geometry.launch, geometry.copy)).toBe(false);
    expect(boxesOverlap(geometry.launch, geometry.style)).toBe(false);
    expect(geometry.launch.height).toBeGreaterThanOrEqual(44);
  }
});

test("premium globe controls stay balanced and inside every viewport", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(90_000);
  test.skip(isMobile, "The desktop project owns the exact responsive matrix.");

  for (const viewport of [
    { width: 320, height: 720 },
    { width: 820, height: 900 },
    { width: 1366, height: 768 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/?atlasView=immersive");
    const experience = page.locator(experienceSelector);
    await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
    await expect(experience.locator("canvas")).toHaveCount(1, {
      timeout: 45_000,
    });
    const geometry = await experience.evaluate((element) => {
      const rect = (target) => {
        const box = target.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          right: box.right,
          bottom: box.bottom,
        };
      };
      const select = (selector) => {
        const target = element.querySelector(selector);
        if (!target) throw new Error(`Missing ${selector}`);
        return rect(target);
      };
      const controlButtons = Array.from(
        element.querySelectorAll(".globe-controls button")
      ).map(rect);
      return {
        chrome: select(".atlas-immersive-chrome"),
        search: select(".atlas-immersive-search-toggle"),
        filters: select(".atlas-immersive-filter-toggle"),
        random: select(".atlas-immersive-random"),
        languageButtons: Array.from(
          element.querySelectorAll(".interface-language-control button")
        ).map(rect),
        close: select(".atlas-immersive-close"),
        styleSwitch: select(".globe-style-switch"),
        controls: select(".globe-controls"),
        controlButtons,
        identityDisplay: getComputedStyle(
          element.querySelector(".atlas-immersive-identity")
        ).display,
      };
    });

    for (const group of [geometry.chrome, geometry.styleSwitch, geometry.controls]) {
      expect(group.x).toBeGreaterThanOrEqual(0);
      expect(group.right).toBeLessThanOrEqual(viewport.width);
    }
    expect(
      Math.abs(geometry.chrome.x + geometry.chrome.width / 2 - viewport.width / 2)
    ).toBeLessThanOrEqual(1);
    expect(
      Math.abs(
        geometry.controls.x + geometry.controls.width / 2 - viewport.width / 2
      )
    ).toBeLessThanOrEqual(1);
    expect(
      Math.max(geometry.search.width, geometry.filters.width, geometry.random.width) -
        Math.min(geometry.search.width, geometry.filters.width, geometry.random.width)
    ).toBeLessThanOrEqual(1);
    for (const control of [
      geometry.search,
      geometry.filters,
      geometry.random,
      ...geometry.languageButtons,
      geometry.close,
      ...geometry.controlButtons,
    ]) {
      expect(Math.round(control.height)).toBeGreaterThanOrEqual(44);
      expect(control.x).toBeGreaterThanOrEqual(0);
      expect(control.right).toBeLessThanOrEqual(viewport.width);
    }
    expect(geometry.chrome.bottom).toBeLessThanOrEqual(geometry.styleSwitch.y);
    expect(geometry.identityDisplay).toBe(viewport.width <= 980 ? "none" : "grid");

  }
});

test("responsive exit remeasures the current embedded slot instead of using the entry height", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The desktop project owns the exact resize contract.");

  await page.setViewportSize({ width: 360, height: 800 });
  const { experience } = await enterFromEmbedded(page);
  const entryHeight = await experience.evaluate((element) =>
    Number.parseFloat(element.style.getPropertyValue("--atlas-origin-height"))
  );

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect
    .poll(() =>
      experience.evaluate((element) =>
        Number.parseFloat(element.style.getPropertyValue("--atlas-origin-width"))
      )
    )
    .toBeGreaterThan(600);
  const exitHeight = await experience.evaluate((element) =>
    Number.parseFloat(element.style.getPropertyValue("--atlas-origin-height"))
  );
  expect(Math.abs(exitHeight - entryHeight)).toBeGreaterThan(1);

  await experience.locator('[data-atlas-action="exit-immersive"]').click();
  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  const embeddedBox = await experience.boundingBox();
  expect(embeddedBox).not.toBeNull();
  expect(Math.abs(embeddedBox.height - exitHeight)).toBeLessThanOrEqual(1);
});

test("mobile country archive is a collapsed, expandable bottom sheet over the stable globe", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "This contract applies below the tablet breakpoint.");

  const { canvas, experience } = await enterFromEmbedded(page);
  await markCanvas(canvas);

  const searchToggle = experience.locator(
    '[data-atlas-action="toggle-search"]'
  );
  await searchToggle.tap();
  const input = experience.locator("[data-atlas-search-input]");
  await expect(input).toBeVisible();
  await input.fill("Россия");
  const option = experience.getByRole("option", {
    name: "Россия",
    exact: true,
  });
  await expect(option).toBeVisible({ timeout: 30_000 });
  await option.tap();

  const sheet = experience.locator(
    '.atlas-country-presentation[data-atlas-country="russia"]'
  );
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
  const toggle = sheet.locator(".atlas-country-sheet-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).toHaveAttribute(
    "aria-controls",
    "atlas-country-sheet-content"
  );
  const sheetContent = sheet.locator("#atlas-country-sheet-content");
  await expect(sheetContent).toHaveAttribute("aria-hidden", "true");
  await expect(sheetContent).toHaveAttribute("inert", "");
  const collapsedBox = await sheet.boundingBox();
  const toggleBox = await toggle.boundingBox();
  expect(collapsedBox).not.toBeNull();
  expect(toggleBox).not.toBeNull();
  expect(collapsedBox.height).toBeLessThanOrEqual(160);
  expect(toggleBox.height).toBeGreaterThanOrEqual(44);

  await toggle.tap();
  await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(sheetContent).not.toHaveAttribute("aria-hidden", "true");
  await expect(sheetContent).not.toHaveAttribute("inert", "");
  await expect
    .poll(async () => (await sheet.boundingBox())?.height ?? 0)
    .toBeGreaterThan(collapsedBox.height + 80);
  await expect(sheet.locator(".country-panel")).toBeVisible();
  await expectMarkedCanvas(experience);
  expect(
    await experience.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test("repeated Close is idempotent and cannot pop past the embedded entry", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "The history race is viewport independent.");

  const { experience } = await enterFromEmbedded(page);
  const close = experience.locator('[data-atlas-action="exit-immersive"]');
  await close.evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect.poll(async () => (await urlState(page)).atlasView).toBeNull();
  await expect(page.locator("#atlas")).toBeAttached();
});

test("reduced motion enters and exits immersion without transition states", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Reduced-motion behavior is shared by both layouts.");
  await page.emulateMedia({ reducedMotion: "reduce" });

  const { canvas, experience } = await enterFromEmbedded(page);
  await expect(experience).toHaveAttribute("data-atlas-reduced-motion", "true");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect(canvas).toHaveCount(1);

  const motionStyles = await experience.evaluate((element) => {
    const surface = getComputedStyle(element);
    const cosmicLayer = getComputedStyle(
      element.querySelector(".atlas-cosmic-layer")
    );
    return {
      animationDuration: surface.animationDuration,
      transitionDuration: surface.transitionDuration,
      cosmicTransitionDuration: cosmicLayer.transitionDuration,
    };
  });
  expect(motionStyles).toEqual({
    animationDuration: "0s",
    transitionDuration: "0s",
    cosmicTransitionDuration: "0s",
  });

  await experience.locator('[data-atlas-action="exit-immersive"]').click();
  await expect(experience).toHaveAttribute("data-atlas-view", "embedded");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect.poll(async () => (await urlState(page)).atlasView).toBeNull();
  await expect(experience.locator("canvas")).toHaveCount(1);
});
