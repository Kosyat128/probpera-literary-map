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
  const detailButtons = page.locator(".archive-book-detail");
  const firstDetail = detailButtons.first();
  const secondDetail = detailButtons.nth(1);
  await expect(firstDetail).toBeVisible({ timeout: 60_000 });
  await expect(secondDetail).toBeVisible({ timeout: 60_000 });

  await firstDetail.click();
  await expect(page.locator("#book-archive-detail")).toBeVisible();
  await expect(page).toHaveURL(/[?&]book=/u);
  const historyLength = await page.evaluate(() => window.history.length);

  await secondDetail.click();
  await expect(page.locator("#book-archive-detail")).toBeVisible();
  expect(await page.evaluate(() => window.history.length)).toBe(historyLength);

  await page.locator(".book-detail-close").click();
  await expect(page.locator("#book-archive-detail")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]book=/u);
  await expect(secondDetail).toBeFocused();
});
