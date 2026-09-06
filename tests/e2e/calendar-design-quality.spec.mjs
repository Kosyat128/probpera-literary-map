import { expect, test } from "@playwright/test";

test("calendar keeps readable date states and every compact-day event remains reachable", async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: isMobile ? 844 : 1000 });
  await page.clock.setFixedTime(new Date("2026-09-05T12:00:00+03:00"));
  await page.goto("/#calendar", { waitUntil: "domcontentloaded" });
  const calendar = page.locator(".calendar-card");
  await expect(calendar.locator(".calendar-agenda-day-more").first()).toBeVisible({ timeout: 25_000 });

  for (const locale of ["ru", "en"]) {
    await page.locator(".site-header .interface-language-control button").nth(locale === "ru" ? 0 : 1).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await calendar.scrollIntoViewIfNeeded();
    const agenda = calendar.getByRole("region", { name: locale === "ru" ? /Хронология месяца/u : /Month chronology/u });
    await expect(agenda).toHaveAttribute("tabindex", "0");

    const today = calendar.locator('.calendar-day[aria-current="date"]');
    await expect(today).toBeEnabled();
    const todayBackground = await today.evaluate((element) => getComputedStyle(element).backgroundColor);
    await today.hover();
    await today.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
    await expect(today).toHaveCSS("background-color", todayBackground);

    const compactDays = await agenda.locator(".calendar-agenda-day").count();
    const fullMonth = calendar.locator(".calendar-agenda-more");
    await fullMonth.click();
    await expect(fullMonth).toHaveAttribute("aria-expanded", "true");
    const monthDayCount = await calendar.locator(".calendar-day.has-event").count();
    expect(monthDayCount).toBeGreaterThan(compactDays);
    await expect(agenda.locator(".calendar-agenda-day")).toHaveCount(monthDayCount);
    await expect.poll(() => agenda.evaluate((element) => element.scrollTop)).toBe(0);
    await agenda.focus();
    await expect(agenda).toBeFocused();
    await agenda.press("PageDown");
    await expect.poll(() => agenda.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await agenda.locator(".calendar-agenda-day").last().scrollIntoViewIfNeeded();
    await fullMonth.click();
    await expect(fullMonth).toHaveAttribute("aria-expanded", "false");
    await expect(agenda.locator(".calendar-agenda-day")).toHaveCount(compactDays);
    await fullMonth.click();
    await expect(fullMonth).toHaveAttribute("aria-expanded", "true");

    const candidates = await agenda.locator(".calendar-agenda-day-more").evaluateAll((buttons) => buttons.map((button, index) => ({
      index,
      total: Number(button.textContent.replace(/\D/gu, "")) + 3,
    })).sort((first, second) => second.total - first.total));
    const densest = candidates[0];
    expect(densest.total).toBeGreaterThan(8);
    await agenda.locator(".calendar-agenda-day-more").nth(densest.index).click();

    const selectedAgenda = calendar.getByRole("region", { name: locale === "ru" ? /Выбранный день/u : /Selected day/u });
    await expect(selectedAgenda).toBeFocused();
    await expect(selectedAgenda.locator(".calendar-agenda-day")).toHaveCount(1);
    await expect(selectedAgenda.locator(".calendar-agenda-event")).toHaveCount(densest.total);
    await expect(selectedAgenda.locator(".calendar-agenda-day-more")).toHaveCount(0);
    const bounds = await selectedAgenda.evaluate((element) => ({
      height: element.getBoundingClientRect().height,
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(bounds.height).toBeLessThanOrEqual(520);
    const lastWriter = selectedAgenda.locator(".calendar-agenda-writer").last();
    await lastWriter.scrollIntoViewIfNeeded();
    const lastIsInside = await lastWriter.evaluate((element) => {
      const row = element.getBoundingClientRect();
      const scroll = element.closest('[role="region"]').getBoundingClientRect();
      return row.top >= scroll.top - 1 && row.bottom <= scroll.bottom + 1;
    });
    expect(lastIsInside).toBe(true);

    const selected = calendar.locator('.calendar-day[aria-pressed="true"]');
    const selectedBackground = await selected.evaluate((element) => getComputedStyle(element).backgroundColor);
    await selected.hover();
    await selected.evaluate((element) => element.getAnimations().forEach((animation) => animation.finish()));
    await expect(selected).toHaveCSS("background-color", selectedBackground);
    const contrast = await selected.evaluate((element) => {
      const color = (value) => value.match(/[\d.]+/gu).slice(0, 3).map(Number);
      const luminance = (rgb) => rgb.map((channel) => channel / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const style = getComputedStyle(element);
      const values = [luminance(color(style.color)), luminance(color(style.backgroundColor))].sort((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await selected.click();
    await expect(calendar.locator('.calendar-day[aria-pressed="true"]')).toHaveCount(0);
  }
});
