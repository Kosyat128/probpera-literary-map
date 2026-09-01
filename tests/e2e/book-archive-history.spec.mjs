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

test("switching book details keeps one history entry and close returns to the archive", async ({
  page,
  isMobile,
}) => {
  test.skip(Boolean(isMobile), "Desktop history contract");
  await openBookCatalog(page);
  await expect(page.locator(".book-archive-filters")).toHaveAttribute(
    "aria-label",
    /9\s*768/u,
    { timeout: 60_000 }
  );
  const detailButtons = page.locator(".archive-book-detail");
  await expect(detailButtons.first()).toBeVisible({ timeout: 20_000 });

  await detailButtons.first().click();
  await expect(page.locator("#book-archive-detail")).toBeVisible();
  await expect(page).toHaveURL(/[?&]book=/u);
  const historyLength = await page.evaluate(() => window.history.length);

  await detailButtons.nth(1).click();
  await expect(page.locator("#book-archive-detail")).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);

  await page.locator(".book-detail-close").click();
  await expect(page.locator("#book-archive-detail")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]book=/u);
  await expect(detailButtons.nth(1)).toBeFocused();
});
