import { expect, test, type Locator, type Page } from "@playwright/test";

async function isVisible(locator: Locator) {
  return locator.isVisible().catch(() => false);
}

async function revealAccountForm(page: Page) {
  const form = page.locator("form.auth-form");
  if (await isVisible(form)) return form;

  const directSelectors = [
    "[data-community-trigger]",
    'button[aria-label*="сообщ" i]',
    'button[aria-label*="клуб" i]',
    'button[aria-label*="проф" i]',
    'button[title*="сообщ" i]',
    'button[title*="клуб" i]',
    'button[class*="community" i]',
    'button[class*="account" i]',
    'button[class*="profile" i]',
  ];

  for (const selector of directSelectors) {
    const candidates = page.locator(selector);
    const count = Math.min(await candidates.count(), 5);
    for (let index = 0; index < count; index += 1) {
      await candidates.nth(index).click().catch(() => undefined);
      if (await isVisible(form)) return form;
    }
  }

  const textCandidates = page
    .locator('button, [role="button"]')
    .filter({ hasText: /сообщество|клуб|читател|профиль|войти|community|account|sign in/iu });
  const textCount = Math.min(await textCandidates.count(), 12);
  for (let index = 0; index < textCount; index += 1) {
    await textCandidates.nth(index).click().catch(() => undefined);
    if (await isVisible(form)) return form;
  }

  for (const hash of ["#community", "#club", "#account"]) {
    await page.goto(`/${hash}`, { waitUntil: "domcontentloaded" });
    if (await isVisible(form)) return form;
  }

  throw new Error("The public community account form could not be opened.");
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(
    Math.max(dimensions.document, dimensions.body) - dimensions.viewport
  ).toBeLessThanOrEqual(2);
}

test("reader can switch between sign-in and registration without client errors", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  const form = await revealAccountForm(page);
  await expect(form).toBeVisible();

  const email = form.locator('input[type="email"]');
  const password = form.locator('input[type="password"]').first();
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toBeVisible();
  await expect(password).toHaveAttribute("minlength", "10");

  const switchMode = form.locator("button.auth-switch");
  await expect(switchMode).toBeVisible();
  await switchMode.click();

  const nickname = form.locator('input[autocomplete="nickname"]');
  const newPasswords = form.locator('input[autocomplete="new-password"]');
  const terms = form.locator('input[type="checkbox"]');
  await expect(nickname).toBeVisible();
  await expect(nickname).toHaveAttribute("minlength", "2");
  await expect(nickname).toHaveAttribute("maxlength", "32");
  await expect(newPasswords).toHaveCount(2);
  await expect(terms).toBeVisible();

  const passwordField = newPasswords.first();
  await expect(passwordField).toHaveAttribute("type", "password");
  await form.locator(".auth-password-field button").click();
  await expect(passwordField).toHaveAttribute("type", "text");

  await expect(form.locator('button[type="submit"]')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("community account shell fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const form = await revealAccountForm(page);
  await expect(form).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await form.locator('input[type="email"]').focus();
  await expect(form.locator('input[type="email"]')).toBeFocused();
  expect(pageErrors).toEqual([]);
});
