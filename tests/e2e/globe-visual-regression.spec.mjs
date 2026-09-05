import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

const stabilityStyles = fileURLToPath(
  new URL("./helpers/globe-visual-stability.css", import.meta.url)
);

const screenshotOptions = {
  animations: "disabled",
  caret: "hide",
  maxDiffPixelRatio: 0.03,
  scale: "css",
  stylePath: stabilityStyles,
  threshold: 0.3,
};

async function waitForStableAtlas(page) {
  const experience = page.locator("[data-atlas-experience]");
  const globe = experience.locator(".literary-globe:not(.is-loading)");

  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect(globe).toBeVisible({ timeout: 60_000 });
  await expect(globe.locator("canvas")).toHaveCount(1);
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 15_000,
  });
  await expect(globe.locator(".globe-style-switch")).toHaveAttribute(
    "aria-busy",
    "false"
  );

  await page.evaluate(async () => {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => window.setTimeout(resolve, 2_000)),
    ]);
    await Promise.all(
      [...document.images]
        .filter((image) => image.complete)
        .map((image) => image.decode().catch(() => undefined))
    );
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
  });

  return experience;
}

async function normalizeQuietChrome(page, experience) {
  // Wake the real activity owner; a DOM attribute alone is overwritten by React.
  await page.mouse.move(2, 2);
  await page.clock.runFor(100);
  await expect(experience).toHaveAttribute("data-atlas-quiet", "false");
}

async function setVisualContract(experience, contract) {
  await experience.evaluate((element, value) => {
    if (value) {
      element.setAttribute("data-atlas-visual-contract", value);
    } else {
      element.removeAttribute("data-atlas-visual-contract");
    }
  }, contract);
}

async function revealEditionRail(globe) {
  const rail = globe.locator(".globe-style-switch");
  if ((await rail.getAttribute("aria-hidden")) === "true") {
    await globe.locator(".globe-style-switch-toggle").click();
  }
  await expect(globe).toHaveAttribute("data-globe-edition-rail", "visible");
  await expect(rail).toHaveAttribute("aria-hidden", "false");
  await expect(rail).toBeVisible();
  return rail;
}

async function combinedViewportClip(page, locators, padding = 6) {
  const boxes = await Promise.all(
    locators.map((locator) => locator.boundingBox())
  );
  if (boxes.some((box) => !box)) {
    throw new Error("Visual contract locator is outside the viewport");
  }

  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Visual contract requires a fixed viewport");

  const visibleBoxes = boxes.filter(Boolean);
  const x = Math.max(
    0,
    Math.floor(Math.min(...visibleBoxes.map((box) => box.x)) - padding)
  );
  const y = Math.max(
    0,
    Math.floor(Math.min(...visibleBoxes.map((box) => box.y)) - padding)
  );
  const right = Math.min(
    viewport.width,
    Math.ceil(
      Math.max(...visibleBoxes.map((box) => box.x + box.width)) + padding
    )
  );
  const bottom = Math.min(
    viewport.height,
    Math.ceil(
      Math.max(...visibleBoxes.map((box) => box.y + box.height)) + padding
    )
  );

  return { x, y, width: right - x, height: bottom - y };
}

test.describe("globe visual regression", () => {
  test.describe.configure({ mode: "serial" });

  test("keeps premium chrome and country cards aligned at desktop and mobile sizes", async ({
    page,
    isMobile,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(
      isMobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto(
      "/?atlas=verified&atlasView=immersive&country=maldives#atlas",
      { waitUntil: "domcontentloaded" }
    );

    const experience = await waitForStableAtlas(page);
    const globe = experience.locator(".literary-globe");
    const sheet = experience.locator(".atlas-country-presentation");
    const sheetContent = sheet.locator("#atlas-country-sheet-content");

    // Freeze inactivity only after the real scene is ready. Resume immediately
    // after the chrome capture so subsequent writer interactions run normally.
    await page.clock.pauseAt(new Date(Date.now() + 1_000));
    await normalizeQuietChrome(page, experience);
    const editionRail = await revealEditionRail(globe);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    });
    const immersiveChrome = experience.locator(".atlas-immersive-chrome");
    await expect(immersiveChrome).toBeVisible();
    await setVisualContract(experience, "top");
    const topChromeClip = await combinedViewportClip(page, [
      immersiveChrome,
      editionRail,
    ]);
    try {
      await expect(page).toHaveScreenshot(
        isMobile
          ? "globe-mobile-top-chrome-edition-rail.png"
          : "globe-desktop-top-chrome-edition-rail.png",
        { ...screenshotOptions, clip: topChromeClip }
      );
      await expect(experience).toHaveAttribute("data-atlas-quiet", "false");
    } finally {
      await page.clock.resume();
    }
    await setVisualContract(experience, null);

    if (isMobile) {
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
      const sheetToggle = sheet.locator(".atlas-country-sheet-toggle");
      await expect(sheetToggle).toBeVisible();
      await expect(sheetToggle).toHaveAttribute("aria-expanded", "false");
      await expect(sheetContent).toHaveAttribute("aria-hidden", "true");
      await expect(sheetContent).toHaveAttribute("inert", "");

      await sheetToggle.click();
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
      await expect(sheetToggle).toHaveAttribute("aria-expanded", "true");
      await expect(sheetContent).not.toHaveAttribute("aria-hidden", "true");
      await expect(sheetContent).not.toHaveAttribute("inert", "");
      await expect(sheet.locator(".country-panel")).toBeVisible();

      // The compact card is visually reviewed in the fully expanded sheet so
      // overflow clipping from the intentional half-height viewport does not
      // become empty pixels in the baseline.
      await sheetToggle.click();
      await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "expanded");
    } else {
      await expect(sheet.locator(".country-panel")).toBeVisible();
    }

    await expect(sheet).toHaveAttribute("data-atlas-country", "maldives");
    await expect(sheet.getByRole("heading", { name: "Мальдивы" })).toBeVisible();
    await expect(sheet.locator(".writer-row")).toHaveCount(2);

    const firstWriter = sheet.locator(".writer-row").first();
    await firstWriter.scrollIntoViewIfNeeded();
    await firstWriter.click();
    const writerDetail = sheet.locator(".writer-detail");
    await expect(writerDetail.locator(".writer-detail-tabs")).toBeVisible();
    await expect(writerDetail).toBeFocused();
    if (isMobile) {
      // Check the real, unstabilized UI before the compact screenshot contract.
      const tabs = writerDetail.getByRole("tab");
      await expect(tabs).toHaveCount(3);
      for (let index = 0; index < 3; index += 1) {
        const tab = tabs.nth(index);
        await tab.scrollIntoViewIfNeeded();
        await expect(tab).toBeInViewport({ ratio: 1 });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        const panelId = await tab.getAttribute("aria-controls");
        await expect(writerDetail.locator(`[id="${panelId}"]`)).toBeVisible();
      }
      await tabs.first().click();
    }
    await setVisualContract(experience, "writer");
    // Hide the long tab panel before scrolling: screenshot-time reflow alone
    // could leave the compact card's last row below the sheet's scrollport.
    const writerStability = await page.addStyleTag({ path: stabilityStyles });
    try {
      await writerDetail.scrollIntoViewIfNeeded();
      await expect(writerDetail.locator(".writer-detail-tabs")).toBeInViewport({ ratio: 1 });
      await expect(writerDetail).toHaveScreenshot(
        isMobile
          ? "globe-mobile-writer-card.png"
          : "globe-desktop-writer-card.png",
        screenshotOptions
      );
    } finally {
      await writerStability.evaluate(style => style.remove());
    }
    await setVisualContract(experience, null);
  });
});
