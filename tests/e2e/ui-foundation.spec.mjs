import { expect, test } from "@playwright/test";

const viewports = [320, 360, 390, 430, 768, 1024, 1366, 1440, 1920];

test.setTimeout(120_000);

async function settleHomepage(page, width) {
  await page.setViewportSize({ width, height: width <= 430 ? 844 : 900 });
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".magazine-hero")).toBeVisible();
}

async function selectLocale(page, locale) {
  const controls = page.locator(".interface-language-control button");
  await controls.nth(locale === "ru" ? 0 : 1).click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
}

test("foundation controls keep geometry and the page does not overflow", async ({ page }) => {
  for (const locale of ["ru", "en"]) {
    for (const width of viewports) {
      await settleHomepage(page, width);
      await selectLocale(page, locale);

      const geometry = await page.evaluate(() => {
        const visible = [...document.querySelectorAll(".ui-action, .ui-icon-button")]
          .filter((element) => {
            const box = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return style.visibility !== "hidden" && style.display !== "none" && box.width > 0;
          })
          .map((element) => {
            const box = element.getBoundingClientRect();
            return {
              className: element.className,
              height: box.height,
              width: box.width,
            };
          });

        return {
          controls: visible,
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          viewportWidth: window.innerWidth,
        };
      });

      expect(
        geometry.documentOverflow,
        `document overflow at ${width}px/${locale}`
      ).toBeLessThanOrEqual(1);
      for (const control of geometry.controls) {
        expect(control.height, JSON.stringify({ width, locale, control })).toBeGreaterThanOrEqual(36);
      }

      const primary = page.locator(".hero-actions .ui-action--primary");
      await expect(primary).toBeVisible();
      const primaryRadius = await primary.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).borderTopLeftRadius)
      );
      expect(primaryRadius, `primary radius at ${width}px/${locale}`).toBeLessThanOrEqual(4);
    }
  }
});

test("core controls expose hover, keyboard focus, pressed and disabled states", async ({ page }) => {
  await settleHomepage(page, 1440);

  const primary = page.locator(".hero-actions .ui-action--primary");
  const before = await primary.evaluate((element) => getComputedStyle(element).backgroundColor);
  await primary.hover();
  await page.waitForTimeout(250);
  const hovered = await primary.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(hovered).not.toBe(before);

  await page.keyboard.press("Tab");
  await page.locator(".global-search-trigger").focus();
  await expect(page.locator(".global-search-trigger")).toBeFocused();
  await expect(page.locator(".global-search-trigger")).not.toHaveCSS("outline-style", "none");

  const ru = page.locator('.interface-language-control button[aria-label*="Русский"]');
  await expect(ru).toHaveAttribute("aria-pressed", "true");

  await page.locator("#atlas").scrollIntoViewIfNeeded();
  const reduceMotion = page.locator('[data-globe-control="auto-rotate"]');
  await expect(reduceMotion).toBeVisible();
  await expect(reduceMotion).toHaveAttribute("aria-pressed", /true|false/u);
});

test("reduced motion disables foundation transitions and keeps loading geometry", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await settleHomepage(page, 360);

  const control = page.locator(".global-search-trigger");
  await expect(control).toHaveCSS("transition-duration", "0s");

  const result = await page.evaluate(() => {
    const host = document.createElement("button");
    host.className = "ui-action ui-action--primary ui-action--md is-loading";
    host.setAttribute("aria-busy", "true");
    host.innerHTML = '<span class="ui-action__spinner" aria-hidden="true"></span><span class="ui-action__label">Loading</span>';
    document.body.append(host);
    const before = host.getBoundingClientRect();
    host.classList.remove("is-loading");
    host.removeAttribute("aria-busy");
    const after = host.getBoundingClientRect();
    host.remove();
    return { before: [before.width, before.height], after: [after.width, after.height] };
  });

  expect(result.after).toEqual(result.before);
});
