import { expect, test } from "@playwright/test";

const monthCounts2026 = [222, 195, 191, 200, 195, 173, 189, 181, 185, 190, 208, 209];

test("Russian calendar exposes every real 2026 event and keeps 29 February in leap years", async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem("probpera-interface-language", "ru"));
  await page.clock.setFixedTime(new Date("2026-10-02T12:00:00+03:00"));
  await page.goto("/#calendar", { waitUntil: "domcontentloaded" });
  const calendar = page.locator("#calendar .calendar-card");
  const coverage = calendar.locator(".calendar-year-summary");
  const monthTotal = calendar.locator(".calendar-summary > div").first();
  const yearView = calendar.getByRole("button", { name: "Год", exact: true });
  await expect(monthTotal.locator("strong")).toHaveText("190", { timeout: 30_000 });
  await expect(monthTotal.locator("span")).toHaveText("дат за месяц");
  await expect(coverage).toContainText("2 340 ежегодных дат");
  await expect(coverage).toContainText("В 2026 году: 2 338 дат");
  await expect(coverage).toContainText("29 февраля");
  await yearView.click();
  const writerContrast = await calendar.locator(".calendar-agenda-writer strong").first().evaluate(element => {
    const channels = value => value.match(/[\d.]+/gu).slice(0, 3).map(Number);
    const luminance = rgb => rgb.map(channel => channel / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    const paper = document.createElement("span");
    paper.style.backgroundColor = "var(--cream)";
    element.appendChild(paper);
    const values = [luminance(channels(getComputedStyle(element).color)), luminance(channels(getComputedStyle(paper).backgroundColor))]
      .sort((a, b) => b - a);
    paper.remove();
    return (values[0] + 0.05) / (values[1] + 0.05);
  });
  expect(writerContrast).toBeGreaterThanOrEqual(4.5);
  for (let month = 0; month < 12; month += 1) {
    const monthDirectory = calendar.getByRole("navigation", { name: "Месяцы 2026 года" });
    await expect(monthDirectory.getByRole("button")).toHaveCount(12);
    await expect(monthDirectory.getByRole("button").nth(month).locator("strong")).toHaveText(String(monthCounts2026[month]));
    await monthDirectory.getByRole("button").nth(month).click();
    await expect(monthTotal.locator("strong")).toHaveText(String(monthCounts2026[month]));
    const days = await calendar.locator(".calendar-day.has-event").evaluateAll(buttons => buttons.map(button => ({
      day: Number(button.querySelector("span").textContent),
      count: Number(button.querySelector("small").textContent),
    })));
    expect(days.reduce((sum, day) => sum + day.count, 0)).toBe(monthCounts2026[month]);
    if (month === 1) expect(days.some(day => day.day === 29)).toBe(false);
    await yearView.click();
  }

  const identities = new Set();
  const pages = calendar.getByRole("navigation", { name: "Страницы годового списка", exact: true });
  const pageCount = Math.ceil(2338 / 20);
  for (let index = 0; index < pageCount; index += 1) {
    await expect(pages.locator("span")).toHaveText(`Страница ${index + 1} из ${pageCount}`);
    const cards = calendar.locator(".calendar-agenda-event");
    const count = Math.min(20, 2338 - index * 20);
    await expect(cards).toHaveCount(count);
    await expect(calendar.locator(".calendar-agenda-writer")).toHaveCount(count);
    for (const identity of await cards.evaluateAll(rows => rows.map(row => row.dataset.calendarEvent))) {
      expect(identity).toBeTruthy();
      expect(identities.has(identity)).toBe(false);
      identities.add(identity);
    }
    if (index < pageCount - 1) await pages.getByRole("button", { name: "Следующая страница", exact: true }).click();
  }
  expect(identities.size).toBe(2338);
  await expect(coverage).toContainText("В 2026 году: 2 338 дат");

  const search = calendar.getByRole("searchbox", { name: "Поиск по писателю, стране или дате", exact: true });
  await search.fill("29.02");
  await expect(calendar.locator(".calendar-year-results")).toHaveText("Найдено дат: 0");
  await expect(calendar.locator(".calendar-empty")).toHaveText("В этом году нет дат по вашему запросу.");
  const nextYear = calendar.getByRole("button", { name: "Следующий год", exact: true });
  await nextYear.click();
  await expect(calendar.locator(".calendar-navigation strong")).toHaveText("2027");
  await expect(calendar.locator(".calendar-year-results")).toHaveText("Найдено дат: 0");
  await nextYear.click();
  await expect(calendar.locator(".calendar-navigation strong")).toHaveText("2028");
  await expect(coverage).toContainText("В 2028 году: 2 340 дат");
  await expect(coverage).not.toContainText("Даты 29 февраля");
  await expect(calendar.locator(".calendar-agenda-event")).toHaveCount(2);
  await expect(calendar.locator(".calendar-agenda-writer")).toContainText(["Стефан", "Тим Пауэрс"]);
  await search.fill("Кристи");
  const christie = calendar.locator(".calendar-agenda-writer").filter({ hasText: "Агата" }).first();
  await expect(christie).toBeVisible();
  await christie.click();
  await expect(page).toHaveURL(/country=england&writer=agatha_christie/u);
});
