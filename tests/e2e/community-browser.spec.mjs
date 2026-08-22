import { expect, test } from "@playwright/test";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openAccount(page) {
  const trigger = page.locator(".site-header .reader-button");
  await expect(trigger).toBeVisible();
  await trigger.click();
  const namedDialog = page.getByRole("dialog", {
    name: "Личный кабинет «Пробы Пера»",
  });
  await expect(namedDialog).toBeVisible();
  return {
    dialog: page.locator('.community-hub[role="dialog"]'),
    trigger,
  };
}

async function openForum(page, isMobile) {
  const scope = isMobile
    ? page.locator(".mobile-nav")
    : page.locator(".site-header > nav");
  const trigger = scope.getByRole("button", { name: "Форум", exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const namedDialog = page.getByRole("dialog", {
    name: "Говорилка — форум «Проба Пера»",
  });
  await expect(namedDialog).toBeVisible();
  return {
    dialog: page.locator('.community-hub[role="dialog"]'),
    trigger,
  };
}

test("личный кабинет удерживает фокус, блокирует фон и возвращает управление", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const { dialog, trigger } = await openAccount(page);
  const close = dialog.getByRole("button", { name: "Закрыть" });

  await expect(close).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");

  await page.keyboard.press("Shift+Tab");
  expect(
    await dialog.evaluate((element) => element.contains(document.activeElement)),
    "Shift+Tab с первой кнопки должен оставлять фокус внутри диалога"
  ).toBe(true);

  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .not.toBe("hidden");
  expect(errors).toEqual([]);
});

test("форма входа и регистрации сохраняет понятные поля и безопасное отключённое состояние", async ({
  page,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const { dialog } = await openAccount(page);
  const form = dialog.locator("form.auth-form");

  await expect(
    form.getByRole("heading", { name: "Войти в «Пробу Пера»" })
  ).toBeVisible();
  await expect(form.getByLabel("Электронная почта")).toHaveAttribute(
    "autocomplete",
    "email"
  );
  const signInPassword = form.locator(
    'input[autocomplete="current-password"]'
  );
  await expect(signInPassword).toHaveAttribute("type", "password");
  await expect(signInPassword).toHaveCount(1);
  await expect(
    form.getByRole("button", { name: "Войти", exact: true })
  ).toBeDisabled();
  await expect(form.locator(".auth-connection-note")).toContainText(
    "Регистрация включится после подключения серверных ключей"
  );

  await form
    .getByRole("button", { name: "Нет аккаунта — зарегистрироваться" })
    .click();
  await expect(
    form.getByRole("heading", { name: "Вступить в литературный клуб" })
  ).toBeVisible();
  await expect(form.getByLabel("Никнейм в сообществе")).toHaveAttribute(
    "minlength",
    "2"
  );
  await expect(form.getByLabel("Никнейм в сообществе")).toHaveAttribute(
    "maxlength",
    "32"
  );
  const newPasswords = form.locator('input[autocomplete="new-password"]');
  const password = newPasswords.first();
  const confirmation = newPasswords.nth(1);
  await expect(newPasswords).toHaveCount(2);
  await expect(form.getByRole("checkbox")).not.toBeChecked();

  await form.getByRole("button", { name: "Показать пароль" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(confirmation).toHaveAttribute("type", "text");
  await form.getByRole("button", { name: "Скрыть пароль" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(confirmation).toHaveAttribute("type", "password");
  await expect(
    form.getByRole("button", { name: "Зарегистрироваться" })
  ).toBeDisabled();
  expect(errors).toEqual([]);
});

test("форум и вход переключаются внутри одного модального окна без потери состояния", async ({
  page,
  isMobile,
}) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const { dialog } = await openForum(page, isMobile);
  const tabs = dialog.getByRole("navigation", { name: "Разделы сообщества" });

  await expect(dialog.locator(".community-setup")).toContainText(
    "Сообщество готово к подключению"
  );
  await tabs.getByRole("button", { name: "Вход и регистрация" }).click();
  await expect(dialog).toHaveAccessibleName("Личный кабинет «Пробы Пера»");
  const email = dialog.getByLabel("Электронная почта");
  await email.fill("reader@example.test");
  await expect(email).toHaveValue("reader@example.test");

  await tabs.getByRole("button", { name: "Форум", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Говорилка — форум «Проба Пера»");
  await expect(dialog.locator(".community-setup")).toBeVisible();

  await tabs.getByRole("button", { name: "Вход и регистрация" }).click();
  await expect(dialog).toHaveAccessibleName("Личный кабинет «Пробы Пера»");
  await expect(email).toHaveValue("reader@example.test");
  expect(errors).toEqual([]);
});

test("мобильный кабинет помещается в экран и сохраняет безопасные размеры полей", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Проверка предназначена для мобильного проекта Playwright");
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  const { dialog } = await openAccount(page);
  const form = dialog.locator("form.auth-form");
  await form
    .getByRole("button", { name: "Нет аккаунта — зарегистрироваться" })
    .click();

  const geometry = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const controls = [
      ...element.querySelectorAll(
        "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
      ),
    ].map((control) => {
      const box = control.getBoundingClientRect();
      return {
        tag: control.tagName,
        type: control.getAttribute("type"),
        width: box.width,
        height: box.height,
        fontSize: Number.parseFloat(getComputedStyle(control).fontSize),
      };
    });
    return {
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      width: bounds.width,
      height: bounds.height,
      dialogOverflow: element.scrollWidth - element.clientWidth,
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      controls,
    };
  });

  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(321);
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(721);
  expect(geometry.width).toBeLessThanOrEqual(320);
  expect(geometry.height).toBeLessThanOrEqual(720);
  expect(geometry.dialogOverflow).toBeLessThanOrEqual(1);
  expect(geometry.documentOverflow).toBeLessThanOrEqual(2);

  const textInputs = geometry.controls.filter(
    (control) => control.tag === "INPUT" && control.type !== "checkbox"
  );
  expect(textInputs.length).toBeGreaterThanOrEqual(4);
  for (const input of textInputs) {
    expect(input.height).toBeGreaterThanOrEqual(44);
    expect(input.fontSize).toBeGreaterThanOrEqual(16);
  }
  const close = dialog.getByRole("button", { name: "Закрыть" });
  const closeBox = await close.boundingBox();
  expect(closeBox?.width ?? 0).toBeGreaterThanOrEqual(44);
  expect(closeBox?.height ?? 0).toBeGreaterThanOrEqual(44);
});
