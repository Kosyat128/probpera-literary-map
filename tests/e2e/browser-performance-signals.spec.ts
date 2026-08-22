import { expect, test } from "@playwright/test";

type PerformanceSignals = {
  cls: number;
  lcp: number;
  longTaskMax: number;
  longTaskTotal: number;
  layoutShiftSupported: boolean;
  lcpSupported: boolean;
  longTaskSupported: boolean;
};

test("mobile homepage stays within the first-load performance budget", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await page.addInitScript(() => {
    const state: PerformanceSignals = {
      cls: 0,
      lcp: 0,
      longTaskMax: 0,
      longTaskTotal: 0,
      layoutShiftSupported: false,
      lcpSupported: false,
      longTaskSupported: false,
    };
    Object.defineProperty(window, "__probperaPerformanceSignals", {
      configurable: true,
      value: state,
    });

    try {
      const observer = new PerformanceObserver((list) => {
        state.layoutShiftSupported = true;
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          };
          if (!shift.hadRecentInput) state.cls += shift.value || 0;
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    } catch {
      // The test asserts support below on the Chromium release used in CI.
    }

    try {
      const observer = new PerformanceObserver((list) => {
        state.lcpSupported = true;
        const entries = list.getEntries();
        const latest = entries.at(-1);
        if (latest) state.lcp = latest.startTime;
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // The test asserts support below on the Chromium release used in CI.
    }

    try {
      const observer = new PerformanceObserver((list) => {
        state.longTaskSupported = true;
        for (const entry of list.getEntries()) {
          state.longTaskTotal += entry.duration;
          state.longTaskMax = Math.max(state.longTaskMax, entry.duration);
        }
      });
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      // Long Tasks are supplementary; absence of support is reported only.
    }
  });

  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("main").first()).toBeVisible();
  await page.evaluate(async () => {
    if ("fonts" in document) await document.fonts.ready;
  });
  await page.waitForTimeout(1_000);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming | undefined;
    const signals = (
      window as Window & {
        __probperaPerformanceSignals?: PerformanceSignals;
      }
    ).__probperaPerformanceSignals;

    return {
      cls: signals?.cls ?? null,
      lcp: signals?.lcp ?? null,
      longTaskMax: signals?.longTaskMax ?? null,
      longTaskTotal: signals?.longTaskTotal ?? null,
      layoutShiftSupported: signals?.layoutShiftSupported ?? false,
      lcpSupported: signals?.lcpSupported ?? false,
      longTaskSupported: signals?.longTaskSupported ?? false,
      domContentLoaded: navigation?.domContentLoadedEventEnd ?? null,
      responseStart: navigation?.responseStart ?? null,
    };
  });

  expect(metrics.layoutShiftSupported).toBe(true);
  expect(metrics.lcpSupported).toBe(true);
  expect(metrics.domContentLoaded).not.toBeNull();
  expect(metrics.responseStart).not.toBeNull();
  expect(metrics.lcp).not.toBeNull();
  expect(metrics.cls).not.toBeNull();

  expect(metrics.responseStart!).toBeLessThanOrEqual(2_500);
  expect(metrics.domContentLoaded!).toBeLessThanOrEqual(6_000);
  expect(metrics.lcp!).toBeGreaterThan(0);
  expect(metrics.lcp!).toBeLessThanOrEqual(6_000);
  expect(metrics.cls!).toBeLessThanOrEqual(0.15);

  if (metrics.longTaskSupported) {
    expect(metrics.longTaskMax!).toBeLessThanOrEqual(1_500);
    expect(metrics.longTaskTotal!).toBeLessThanOrEqual(4_000);
  }
});
