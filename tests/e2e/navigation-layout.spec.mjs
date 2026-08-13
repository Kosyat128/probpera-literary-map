import { expect, test } from "@playwright/test";

test("sticky navigation keeps anchor headings visible and never widens the page", async ({ page }) => {
  for (const { width, height, hash } of [
    { width: 1280, height: 800, hash: "atlas" },
    { width: 320, height: 800, hash: "calendar" },
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(`/#${hash}`);
    await expect(page.locator(`#${hash}`)).toBeVisible();
    await expect
      .poll(async () => {
        return page.locator(`#${hash}`).evaluate((element) => {
          const header = document.querySelector(".site-header");
          const quickNav = document.querySelector(".mobile-nav");
          if (!header || !quickNav) return false;
          const navigationBottom = Math.max(
            header.getBoundingClientRect().bottom,
            quickNav.getBoundingClientRect().bottom
          );
          return element.getBoundingClientRect().top >= navigationBottom - 1;
        });
      })
      .toBe(true);

    const geometry = await page.evaluate((targetId) => {
      const anchor = document.getElementById(targetId);
      const header = document.querySelector(".site-header");
      const quickNav = document.querySelector(".mobile-nav");
      if (!anchor || !header || !quickNav) return null;

      return {
        targetTop: anchor.getBoundingClientRect().top,
        navigationBottom: Math.max(
          header.getBoundingClientRect().bottom,
          quickNav.getBoundingClientRect().bottom
        ),
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
      };
    }, hash);

    expect(geometry).not.toBeNull();
    expect(geometry.targetTop).toBeGreaterThanOrEqual(geometry.navigationBottom - 1);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  }
});
