import { expect, test, type Locator, type Page } from "@playwright/test";

const saveControlPattern =
  /(?:сохранить|в библиотек|избранн|закладк|save|bookmark|reading list|library)/iu;
const commentControlPattern = /(?:комментари|обсуждени|comment|discussion)/iu;

async function firstArticleRoute(page: Page) {
  for (const entryRoute of ["/stati/", "/"]) {
    const response = await page.goto(entryRoute, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status() ?? 200).toBeLessThan(400);
    await expect(page.locator("body")).toContainText(/Проба Пера|Proba Pera/iu);

    const routes = await page.locator('a[href*="/stati/"]').evaluateAll((anchors) =>
      anchors
        .map((anchor) => {
          try {
            const url = new URL(
              (anchor as HTMLAnchorElement).href,
              window.location.href
            );
            return `${url.pathname}${url.search}`;
          } catch {
            return "";
          }
        })
        .filter(Boolean)
    );
    const articleRoute = [...new Set(routes)].find((route) => {
      const pathname = new URL(route, window.location.origin).pathname;
      const segments = pathname.split("/").filter(Boolean);
      return segments[0] === "stati" && segments.length >= 3;
    });
    if (articleRoute) return articleRoute;
  }
  throw new Error("Не найден ни один публичный адрес статьи.");
}

async function revealCommentForm(page: Page) {
  const visibleTextarea = page.locator("textarea:visible").first();
  if (await visibleTextarea.isVisible().catch(() => false)) {
    return visibleTextarea;
  }

  const controls = page.locator('button, a, [role="button"]');
  for (let index = 0; index < Math.min(await controls.count(), 120); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    const label = [
      await control.textContent().catch(() => ""),
      await control.getAttribute("aria-label"),
      await control.getAttribute("title"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
    if (!commentControlPattern.test(label)) continue;
    await control.click();
    if (
      await page
        .locator("textarea:visible")
        .first()
        .waitFor({ state: "visible", timeout: 1_500 })
        .then(() => true)
        .catch(() => false)
    ) {
      return page.locator("textarea:visible").first();
    }
  }
  throw new Error("Форма комментария не открылась через публичный интерфейс.");
}

async function findSaveControl(page: Page): Promise<Locator> {
  const controls = page.locator('button, a, [role="button"]');
  for (let index = 0; index < Math.min(await controls.count(), 160); index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible().catch(() => false))) continue;
    const label = [
      await control.textContent().catch(() => ""),
      await control.getAttribute("aria-label"),
      await control.getAttribute("title"),
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();
    if (saveControlPattern.test(label)) return control;
  }
  throw new Error("На странице статьи не найдено управление личной библиотекой.");
}

function storageSnapshot(page: Page) {
  return page.evaluate(() => {
    const output: Record<string, string> = {};
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key) continue;
      output[key] = window.localStorage.getItem(key) || "";
    }
    return output;
  });
}

test("статья поддерживает комментарий и локальную библиотеку без записи в production", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const unexpectedWrites: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (!/\.supabase\.co\//iu.test(request.url())) return;
    if (["GET", "HEAD", "OPTIONS"].includes(request.method())) return;
    unexpectedWrites.push(`${request.method()} ${request.url()}`);
  });

  const route = await firstArticleRoute(page);
  const response = await page.goto(route, { waitUntil: "domcontentloaded" });
  expect(response?.status() ?? 200).toBeLessThan(400);
  await expect(page.locator("article, main").first()).toBeVisible();

  const textarea = await revealCommentForm(page);
  await expect(textarea).toBeVisible();
  const maximumLength = Number((await textarea.getAttribute("maxlength")) || 0);
  expect(maximumLength).toBeGreaterThanOrEqual(500);
  expect(maximumLength).toBeLessThanOrEqual(10_000);
  const commentForm = textarea.locator("xpath=ancestor::form[1]");
  await expect(commentForm).toBeVisible();
  await expect(
    commentForm.getByRole("button", {
      name: /(?:отправить|опубликовать|добавить|send|publish|add)/iu,
    })
  ).toBeVisible();

  const beforeStorage = await storageSnapshot(page);
  const saveControl = await findSaveControl(page);
  const beforePressed = await saveControl.getAttribute("aria-pressed");
  const beforeText = (await saveControl.textContent())?.trim() || "";
  await saveControl.click();

  await expect
    .poll(async () => JSON.stringify(await storageSnapshot(page)), {
      timeout: 3_000,
    })
    .not.toBe(JSON.stringify(beforeStorage));
  const savedStorage = await storageSnapshot(page);
  expect(
    Object.keys(savedStorage).some((key) => /probpera|reading|library|favorite/iu.test(key))
  ).toBe(true);

  const afterPressed = await saveControl.getAttribute("aria-pressed");
  const afterText = (await saveControl.textContent())?.trim() || "";
  expect(
    afterPressed !== beforePressed || afterText !== beforeText,
    "Управление библиотекой не изменило доступное состояние"
  ).toBe(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  expect(await storageSnapshot(page)).toEqual(savedStorage);
  expect(unexpectedWrites).toEqual([]);
  expect(pageErrors).toEqual([]);
});
