import { expect, test, type Page } from "@playwright/test";

const accountControlPattern =
  /(?:сообщество|клуб(?: читателей)?|войти|вход|аккаунт|профиль|community|club|sign in|account|profile)/iu;

async function waitForPublicShell(page: Page) {
  await page.goto("/");
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("body")).toContainText(/Проба Пера|Proba Pera/iu);
}

async function revealAccountForm(page: Page) {
  const form = page.locator("form.auth-form");
  if (await form.isVisible().catch(() => false)) return form;

  const explicitCandidates = page.locator(
    [
      'button[class*="community"]',
      'a[class*="community"]',
      'button[aria-label*="сообщ" i]',
      'button[aria-label*="войти" i]',
      'button[title*="сообщ" i]',
      '[data-community-trigger]',
    ].join(",")
  );

  for (
    let index = 0;
    index < Math.min(await explicitCandidates.count(), 20);
    index += 1
  ) {
    const candidate = explicitCandidates.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    await candidate.click();
    if (await form.isVisible().catch(() => false)) return form;
  }

  const controls = page.locator('button, a, [role="button"]');
  const inspected: string[] = [];
  for (
    let index = 0;
    index < Math.min(await controls.count(), 160);
    index += 1
  ) {
    const candidate = controls.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    const label = [
      await candidate.textContent().catch(() => ""),
      await candidate.getAttribute("aria-label"),
      await candidate.getAttribute("title"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
    if (label) inspected.push(label);
    if (!accountControlPattern.test(label)) continue;
    await candidate.click();
    if (await form.isVisible().catch(() => false)) return form;
  }

  throw new Error(
    `Не удалось открыть форму аккаунта. Проверенные элементы: ${inspected
      .slice(0, 30)
      .join(" | ")}`
  );
}

function collectFatalBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/favicon|Failed to load resource.*404/iu.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

test.describe("публичные пользовательские сценарии", () => {
  test("запускается при полностью заблокированном Web Storage", async ({
    page,
  }) => {
    const browserErrors = collectFatalBrowserErrors(page);
    await page.addInitScript(() => {
      const blocked = (name: string) => {
        throw new DOMException(
          `${name} blocked by privacy mode`,
          "SecurityError"
        );
      };
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        get: () => blocked("localStorage"),
      });
      Object.defineProperty(window, "sessionStorage", {
        configurable: true,
        get: () => blocked("sessionStorage"),
      });
    });

    await waitForPublicShell(page);
    await expect(page.locator("body")).not.toContainText(
      /не удалось запустить|application failed to start/iu
    );
    expect(browserErrors).toEqual([]);
  });

  test("форма входа и регистрации сохраняет доступный контракт", async ({
    page,
  }) => {
    const browserErrors = collectFatalBrowserErrors(page);
    await waitForPublicShell(page);
    const form = await revealAccountForm(page);

    const email = form.locator('input[type="email"]');
    const password = form.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(password.first()).toBeVisible();
    await expect(password.first()).toHaveAttribute("minlength", "10");
    await expect(password.first()).toHaveAttribute(
      "autocomplete",
      "current-password"
    );

    const modeSwitch = form.getByRole("button", {
      name: /нет аккаунта|зарегистрироваться|new reader|sign up/iu,
    });
    await expect(modeSwitch).toBeVisible();
    await modeSwitch.click();

    await expect(form.locator('input[autocomplete="nickname"]')).toBeVisible();
    await expect(form.locator('input[autocomplete="new-password"]')).toHaveCount(
      2
    );
    await expect(form.locator('input[type="checkbox"]')).toBeVisible();
    await expect(
      form.getByRole("button", { name: /зарегистрироваться|sign up/iu })
    ).toBeVisible();
    expect(browserErrors).toEqual([]);
  });

  test("мобильная главная не создаёт горизонтальную прокрутку", async ({
    page,
  }) => {
    const browserErrors = collectFatalBrowserErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await waitForPublicShell(page);
    await page.evaluate(() => document.fonts?.ready);

    const overflow = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(overflow.document).toBeLessThanOrEqual(overflow.viewport + 2);
    expect(overflow.body).toBeLessThanOrEqual(overflow.viewport + 2);

    await page.keyboard.press("Tab");
    const activeTag = await page.evaluate(
      () => document.activeElement?.tagName || ""
    );
    expect(activeTag).not.toBe("BODY");
    expect(browserErrors).toEqual([]);
  });
});
