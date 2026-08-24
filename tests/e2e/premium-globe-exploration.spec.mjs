import { expect, test } from "@playwright/test";

// The production service worker may otherwise satisfy texture requests before
// Playwright can hold them, hiding the requested -> rendered transaction.
test.use({ serviceWorkers: "block" });

async function openAtlas(page) {
  await page.goto("/");
  const atlas = page.locator("#atlas");
  await atlas.scrollIntoViewIfNeeded();
  const globe = atlas.locator(".literary-globe:not(.is-loading)");
  const canvas = atlas.locator("canvas");
  await expect(globe).toBeVisible({ timeout: 45_000 });
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-engine", /^three\.js r\d+/u);
  await expect
    .poll(() =>
      canvas.evaluate(
        (element) =>
          new Promise((resolve) => {
            const measure = () => {
              const canvasRect = element.getBoundingClientRect();
              const surfaceRect = element.parentElement?.getBoundingClientRect();
              return {
                canvasHeight: canvasRect.height,
                canvasWidth: canvasRect.width,
                surfaceHeight: surfaceRect?.height ?? 0,
                surfaceWidth: surfaceRect?.width ?? 0,
              };
            };
            const first = measure();
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                const second = measure();
                resolve(
                  second.canvasWidth > 0 &&
                    second.canvasHeight > 0 &&
                    Math.abs(second.canvasWidth - second.surfaceWidth) < 0.5 &&
                    Math.abs(second.canvasHeight - second.surfaceHeight) < 0.5 &&
                    Math.abs(second.canvasWidth - first.canvasWidth) < 0.5 &&
                    Math.abs(second.canvasHeight - first.canvasHeight) < 0.5
                );
              })
            );
          })
      )
    )
    .toBe(true);
  return { atlas, globe, canvas };
}

async function openAtlasInterface(page) {
  await page.goto("/");
  const atlas = page.locator("#atlas");
  await atlas.scrollIntoViewIfNeeded();
  await expect(atlas.locator(".atlas-toolbar")).toBeVisible();
  return { atlas };
}

async function selectCountryFromAtlasSearch(page, query) {
  const search = page.locator("#country-search");
  await search.fill(query);
  const result = page.getByRole("option", { name: query, exact: true });
  await expect(result).toBeVisible();
  await result.click();
  // Country selection deliberately hands focus to the responsive presentation
  // after two animation frames. The lazy panel may not exist yet, so focus is
  // not itself a reliable completion signal; crossing the same frame boundary
  // guarantees that callback can no longer blur the next search input.
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  return new URL(page.url()).searchParams.get("country");
}

async function dispatchTouchSequence(page, frames) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: frames[0],
    });
    // Match a real finger gesture: give OrbitControls one rendered frame to
    // establish its pointer owner before the first movement arrives.
    await page.waitForTimeout(50);
    for (const touchPoints of frames.slice(1)) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints,
      });
      await page.waitForTimeout(35);
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  } finally {
    await session.detach();
  }
}

async function centerEmbeddedGlobeForTouchControl({ globe, page }) {
  await globe.evaluate((element) =>
    element.scrollIntoView({ behavior: "instant", block: "center" })
  );
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  await expect
    .poll(() =>
      globe.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
      })
    )
    .toBe(true);
  await expect(globe).not.toHaveAttribute("data-globe-touch-mode", "suspended");
}

async function ensureEmbeddedGlobeControl({ activation, globe, page }) {
  await centerEmbeddedGlobeForTouchControl({ globe, page });
  await expect(activation).toBeVisible();
  if ((await globe.getAttribute("data-globe-touch-mode")) === "page-pan") {
    await expect(activation).toHaveText(/Управлять глобусом|Control globe/iu);
    await activation.click();
  }
  await expect(globe).toHaveAttribute("data-globe-touch-mode", "globe-control");
  await expect(activation).toHaveAttribute("aria-pressed", "true");
  await expect(activation).toHaveText(/Вернуться к прокрутке|Return to page scroll/iu);
}

async function expectImmersiveSurfaceContained({ experience, page }) {
  const geometry = await experience.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    scrollTop: element.scrollTop,
  }));
  expect(geometry.scrollTop).toBe(0);
  expect(geometry.scrollHeight).toBeLessThanOrEqual(geometry.clientHeight);

  const close = experience.locator('[data-atlas-action="exit-immersive"]');
  const closeBox = await close.boundingBox();
  const viewportHeight = await page.evaluate(() => window.innerHeight);
  expect(closeBox).toBeTruthy();
  expect(closeBox?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((closeBox?.y ?? 0) + (closeBox?.height ?? 0)).toBeLessThanOrEqual(
    viewportHeight
  );
}

async function exerciseThreeStateCountrySheet({
  sheet,
  canvas,
  experience,
  page,
}) {
  const toggle = sheet.locator(".atlas-country-sheet-toggle");
  const content = sheet.locator(".atlas-country-sheet-content");

  await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(content).toHaveAttribute("aria-hidden", "true");
  await expect(content).toHaveAttribute("inert", "");
  const collapsedHeight = (await sheet.boundingBox())?.height ?? 0;
  expect(collapsedHeight).toBeGreaterThan(0);

  await toggle.click();
  await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "half");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(content).not.toHaveAttribute("aria-hidden", "true");
  await expect(content).not.toHaveAttribute("inert", "");
  await expect
    .poll(async () => (await sheet.boundingBox())?.height ?? 0)
    .toBeGreaterThan(collapsedHeight + 80);
  if (experience) {
    await expectImmersiveSurfaceContained({ experience, page });
  }
  const halfHeight = (await sheet.boundingBox())?.height ?? 0;

  await toggle.click();
  await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "expanded");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(content).not.toHaveAttribute("aria-hidden", "true");
  await expect(content).not.toHaveAttribute("inert", "");
  await expect
    .poll(async () => (await sheet.boundingBox())?.height ?? 0)
    .toBeGreaterThan(halfHeight + 80);
  if (experience) {
    await expectImmersiveSurfaceContained({ experience, page });
  }

  await toggle.click();
  await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(content).toHaveAttribute("aria-hidden", "true");
  await expect(content).toHaveAttribute("inert", "");
  await expect
    .poll(async () => (await sheet.boundingBox())?.height ?? 0)
    .toBeLessThanOrEqual(collapsedHeight + 2);
  await expect(canvas).toHaveAttribute("data-stage4-sheet-identity", "stable");
}

function settledCameraIntent(intent, countryId) {
  const separator = intent.lastIndexOf(":");
  expect(separator).toBeGreaterThan(0);
  return `${intent.slice(0, separator)}:${countryId}:${intent.slice(separator + 1)}`;
}

test("keyboard candidate selects the optical-centre country without replacing Canvas", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1024, height: 768 });
  const { globe, canvas } = await openAtlas(page);
  await canvas.evaluate((element) => {
    element.dataset.stage4CanvasIdentity = "stable";
  });
  const before = await canvas.boundingBox();

  await globe.focus();
  await expect(globe).toHaveAttribute("data-globe-keyboard-candidate", "inactive");
  await expect(globe.locator(".globe-keyboard-status")).toHaveText("");
  const auto = globe.locator('[data-globe-control="auto-rotate"]');
  if ((await auto.getAttribute("aria-pressed")) === "true") {
    await auto.click();
  }
  await expect(auto).toHaveAttribute("aria-pressed", "false");
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand");

  const coordinateReadout = page.locator(".atlas-coordinate strong");
  await expect(coordinateReadout).not.toHaveText("—");
  let previousCoordinates = await coordinateReadout.textContent();
  let candidateId = "inactive";
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await globe.press("ArrowRight");
    await expect
      .poll(() => coordinateReadout.textContent())
      .not.toBe(previousCoordinates);
    await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");
    candidateId =
      (await globe.getAttribute("data-globe-keyboard-candidate")) ?? "inactive";
    if (candidateId !== "inactive" && candidateId !== "ocean") break;
    previousCoordinates = await coordinateReadout.textContent();
  }
  const liveStatus = globe.locator(".globe-keyboard-status");
  await expect(liveStatus).not.toHaveText("");
  expect(candidateId).not.toBe("inactive");
  expect(candidateId).not.toBe("ocean");
  await globe.evaluate((element) => {
    element.addEventListener(
      "keydown",
      () => {
        element.dataset.stage4KeyboardCandidateAtEnter =
          element.dataset.globeKeyboardCandidate ?? "inactive";
      },
      { capture: true, once: true }
    );
  });
  await globe.press("Enter");
  const candidateAtEnter = await globe.getAttribute(
    "data-stage4-keyboard-candidate-at-enter"
  );
  expect(candidateAtEnter).not.toBeNull();
  expect(candidateAtEnter).not.toBe("inactive");
  expect(candidateAtEnter).not.toBe("ocean");

  await expect
    .poll(() => new URL(page.url()).searchParams.get("country"))
    .toBe(candidateAtEnter);
  if (isMobile) {
    await expect(page.locator(".atlas-country-sheet-toggle")).toBeVisible();
  } else {
    await expect(page.locator(".country-panel")).toBeVisible();
  }
  await expect(
    page.locator('canvas[data-stage4-canvas-identity="stable"]')
  ).toHaveCount(1);
  const after = await canvas.boundingBox();
  expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThan(2);
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);
});

test("style buttons commit only the texture that actually rendered", async ({
  page,
}) => {
  let releaseEarthTexture;
  let markEarthTextureRequested;
  const earthTextureRequested = new Promise((resolve) => {
    markEarthTextureRequested = resolve;
  });
  const earthTextureGate = new Promise((resolve) => {
    releaseEarthTexture = resolve;
  });
  await page.addInitScript(() => {
    localStorage.setItem("probpera.globe-style.v1", "antique");
  });
  await page.route(/earth-blue-marble/u, async (route) => {
    markEarthTextureRequested();
    await earthTextureGate;
    await route.continue();
  });
  const { globe } = await openAtlas(page);
  const antique = globe.locator('[data-globe-style-option="antique"]');
  const earth = globe.locator('[data-globe-style-option="earth"]');
  await expect(antique).toHaveAttribute("aria-pressed", "true");

  // DOM click intentionally skips pointer-hover preloading so the pending
  // lifecycle remains observable while the texture request is held.
  await earth.evaluate((element) => element.click());
  await earthTextureRequested;
  await expect(globe.locator(".globe-style-switch")).toHaveAttribute(
    "aria-busy",
    "true"
  );
  await expect(antique).toHaveAttribute("aria-pressed", "true");
  await expect(earth).toHaveAttribute("aria-pressed", "false");

  releaseEarthTexture();
  await expect(globe).toHaveAttribute("data-globe-style", "earth", {
    timeout: 15_000,
  });
  await expect(earth).toHaveAttribute("aria-pressed", "true");
  await expect(antique).toHaveAttribute("aria-pressed", "false");
});

test("idle atlas does not bulk-load country flags and Auto Off becomes demand", async ({
  page,
}) => {
  const { globe } = await openAtlas(page);
  await page.waitForTimeout(5_200);
  const flagRequests = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) => /\/flags\/[^/]+\.svg(?:$|\?)/u.test(name))
  );
  expect(new Set(flagRequests).size).toBe(0);

  const auto = globe.locator('[data-globe-control="auto-rotate"]');
  await auto.click();
  await expect(auto).toHaveAttribute("aria-pressed", "false");
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand");
});

test("atlas filters stay on one line and rich count matches the collection", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1440, height: 900 });
  // This is an interface contract: waiting for GeoJSON/WebGL readiness makes
  // it depend on an unrelated, CPU-heavy renderer initialization in Linux CI.
  const { atlas } = await openAtlasInterface(page);
  const filters = atlas.locator(".atlas-filters");
  const filterButtons = filters.locator(
    ":scope > .atlas-filter-options > button[data-atlas-filter]"
  );
  const ribbonControls = filters.locator(
    ":scope > .atlas-filter-options > button, :scope > button[data-atlas-archives-toggle]"
  );
  await expect(filterButtons).toHaveCount(5);
  await expect(ribbonControls).toHaveCount(6);
  await expect(atlas.locator(".atlas-ranking, .atlas-filter-status")).toHaveCount(
    0
  );

  const buttonBoxes = await ribbonControls.evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top };
    })
  );
  expect(Math.max(...buttonBoxes.map(({ top }) => top))).toBeLessThan(
    Math.min(...buttonBoxes.map(({ top }) => top)) + 2
  );
  for (let index = 1; index < buttonBoxes.length; index += 1) {
    expect(buttonBoxes[index].left).toBeGreaterThanOrEqual(
      buttonBoxes[index - 1].right - 0.5
    );
  }

  const ribbonMetrics = await filters.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return {
      clientHeight: element.clientHeight,
      clientWidth: element.clientWidth,
      overflowX: style.overflowX,
      scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth,
    };
  });
  if (isMobile) {
    expect(ribbonMetrics.overflowX).toBe("auto");
    expect(ribbonMetrics.scrollWidth).toBeGreaterThan(
      ribbonMetrics.clientWidth + 8
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
    await filters.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    await expect
      .poll(() => filters.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        )
      )
      .toBeLessThanOrEqual(1);
  } else {
    expect(ribbonMetrics.scrollHeight).toBeLessThanOrEqual(
      ribbonMetrics.clientHeight + 2
    );
    expect(ribbonMetrics.scrollWidth).toBeLessThanOrEqual(
      ribbonMetrics.clientWidth + 2
    );
  }

  const rich = filters.locator('[data-atlas-filter="rich"]');
  await expect(rich).toContainText(/10\+ (?:авторов|writers)/iu);
  const richCount = Number(
    ((await rich.locator(".atlas-filter-count").textContent()) ?? "").replace(
      /\D/gu,
      ""
    )
  );
  expect(richCount).toBeGreaterThan(0);
  await rich.click();
  await expect(rich).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/[?&]atlas=rich(?:[&#]|$)/u);

  const countryIndex = atlas.locator(".atlas-country-index");
  await countryIndex.locator("summary").click();
  const filteredCountries = countryIndex.locator(":scope > div > button");
  await expect(filteredCountries).toHaveCount(richCount);
  const writerCounts = await filteredCountries.locator("small").allTextContents();
  expect(writerCounts).toHaveLength(richCount);
  for (const writerCount of writerCounts) {
    expect(Number(writerCount.replace(/\D/gu, ""))).toBeGreaterThanOrEqual(10);
  }

  const archivesToggle = filters.locator("[data-atlas-archives-toggle]");
  await expect(archivesToggle).toContainText(
    /Крупнейшие архивы|Largest archives/iu
  );
  await archivesToggle.click();
  await expect(archivesToggle).toHaveAttribute("aria-expanded", "true");
  const archivesPopover = atlas.locator("#atlas-largest-archives");
  await expect(archivesPopover).toBeVisible();
  await expect(archivesPopover.locator(":scope > button")).toHaveCount(5);
  await expect(page).toHaveURL(/[?&]atlas=rich(?:[&#]|$)/u);
  await page.keyboard.press("Escape");
  await expect(archivesToggle).toBeFocused();
  await expect(archivesToggle).toHaveAttribute("aria-expanded", "false");
  await expect(archivesPopover).toHaveCount(0);

  await atlas.locator('[data-atlas-action="enter-immersive"]').click();
  const surface = atlas.locator(".atlas-experience-surface");
  await expect(surface).toHaveAttribute("data-atlas-view", "immersive");
  await surface.locator('[data-atlas-action="toggle-filters"]').click();
  await expect(surface).toHaveAttribute("data-atlas-filters-open", "true");
  await archivesToggle.click();
  await expect(archivesToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(surface).toHaveAttribute("data-atlas-view", "immersive");
  await expect(surface).toHaveAttribute("data-atlas-filters-open", "true");
  await expect(archivesToggle).toHaveAttribute("aria-expanded", "false");
  await expect(archivesToggle).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(surface).toHaveAttribute("data-atlas-view", "immersive");
  await expect(surface).toHaveAttribute("data-atlas-filters-open", "false");
});

test("immersive random journey respects the current collection and recent picks", async ({
  page,
}) => {
  const { atlas, canvas } = await openAtlas(page);
  await canvas.evaluate((element) => {
    element.dataset.stage4RandomIdentity = "stable";
  });
  const verified = atlas.locator('[data-atlas-filter="verified"]');
  await verified.click();
  await expect(verified).toHaveAttribute("aria-pressed", "true");

  const countryIndex = atlas.locator(".atlas-country-index");
  await countryIndex.locator("summary").click();
  await expect(countryIndex.locator(":scope > div > button").first()).toBeVisible();
  const eligibleCountryNames = (
    await countryIndex.locator(":scope > div > button > span").allTextContents()
  ).map((name) => name.trim());
  expect(eligibleCountryNames.length).toBeGreaterThan(1);

  await atlas.locator('[data-atlas-action="enter-immersive"]').click();
  const experience = page.locator("[data-atlas-experience]");
  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");

  const random = experience.locator('[data-atlas-action="random-journey"]');
  await random.click();
  const presentation = experience.locator(".atlas-country-presentation");
  await expect(presentation).toHaveAttribute("data-atlas-country", /.+/u);
  const first = await presentation.getAttribute("data-atlas-country");
  expect(first).toBeTruthy();
  await expect(page).toHaveURL(/atlas=verified/iu);
  await expect(presentation.locator(".country-heading h2")).toHaveText(/.+/u);
  const firstName = (
    await presentation.locator(".country-heading h2").textContent()
  )?.trim();
  expect(eligibleCountryNames).toContain(firstName);

  await random.click();
  await expect
    .poll(() => presentation.getAttribute("data-atlas-country"))
    .not.toBe(first);
  const second = await presentation.getAttribute("data-atlas-country");
  expect(second).toBeTruthy();
  expect(second).not.toBe(first);
  await expect(presentation.locator(".country-heading h2")).toHaveText(/.+/u);
  const secondName = (
    await presentation.locator(".country-heading h2").textContent()
  )?.trim();
  expect(eligibleCountryNames).toContain(secondName);
  await expect(page).toHaveURL(/atlas=verified/iu);
  await expect(page.locator(".literary-globe")).toHaveAttribute(
    "data-globe-camera-phase",
    "idle",
    { timeout: 5_000 }
  );
  await expect(
    experience.locator('canvas[data-stage4-random-identity="stable"]')
  ).toHaveCount(1);
});

test("coarse embedded globe preserves page pan until explicit full control", async ({
  page,
  isMobile,
}) => {
  const { globe, canvas } = await openAtlas(page);
  if (!isMobile) {
    await expect(globe).toHaveAttribute("data-globe-touch-mode", "globe-control");
    await expect(canvas).toHaveCSS("touch-action", "none");
    await expect(
      globe.locator('[data-globe-control="touch-activation"]')
    ).toHaveCount(0);
    return;
  }

  await expect(globe).toHaveAttribute("data-globe-touch-mode", "page-pan");
  await expect(canvas).toHaveCSS("touch-action", "pan-y pinch-zoom");

  const auto = globe.locator('[data-globe-control="auto-rotate"]');
  if ((await auto.getAttribute("aria-pressed")) === "true") {
    await auto.click();
  }
  await expect(auto).toHaveAttribute("aria-pressed", "false");
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand", {
    timeout: 5_000,
  });

  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const startX = (box?.x ?? 0) + (box?.width ?? 0) * 0.5;
  const startY = Math.min(
    (box?.y ?? 0) + (box?.height ?? 0) * 0.62,
    690
  );
  const countryBeforePan = new URL(page.url()).searchParams.get("country");
  const scrollBeforePan = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    window.__stage4TouchDefaults = [];
    const record = (event) => {
      window.__stage4TouchDefaults.push({
        type: event.type,
        defaultPrevented: event.defaultPrevented,
      });
    };
    document.addEventListener("touchstart", record);
    document.addEventListener("touchmove", record);
    document.addEventListener("touchend", record);
  });
  await dispatchTouchSequence(page, [
    [{ x: startX, y: startY, id: 1 }],
    [{ x: startX + 1, y: startY - 55, id: 1 }],
    [{ x: startX + 2, y: startY - 125, id: 1 }],
  ]);
  const touchDefaults = await page.evaluate(() => window.__stage4TouchDefaults);
  expect(touchDefaults.map((event) => event.type)).toEqual([
    "touchstart",
    "touchmove",
    "touchmove",
    "touchend",
  ]);
  expect(touchDefaults.every((event) => !event.defaultPrevented)).toBe(true);

  // CDP-dispatched touch events do not execute Chromium's compositor scroll in
  // headless mode. A real wheel gesture at the same Canvas point verifies that
  // the page scroll route itself remains available after the unprevented touch.
  await page.mouse.move(startX, startY);
  await page.mouse.wheel(0, 125);
  await expect
    .poll(async () =>
      Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforePan)
    )
    .toBeGreaterThan(12);
  expect(new URL(page.url()).searchParams.get("country")).toBe(countryBeforePan);

  await globe.scrollIntoViewIfNeeded();

  const focusedCountry = await selectCountryFromAtlasSearch(page, "Бразилия");
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 5_000,
  });
  await expect(globe).toHaveAttribute(
    "data-globe-view-country",
    focusedCountry ?? ""
  );
  const sheetToggle = page.locator(".atlas-country-sheet-toggle");
  await sheetToggle.click();
  await page.locator(".country-panel .panel-close").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBeNull();
  await globe.scrollIntoViewIfNeeded();
  const tapBox = await canvas.boundingBox();
  expect(tapBox).toBeTruthy();
  const tapPoints = [
    [0.5, 0.5],
    [0.5, 0.42],
    [0.42, 0.5],
    [0.58, 0.5],
  ];
  for (const [ratioX, ratioY] of tapPoints) {
    await page.touchscreen.tap(
      (tapBox?.x ?? 0) + (tapBox?.width ?? 0) * ratioX,
      (tapBox?.y ?? 0) + (tapBox?.height ?? 0) * ratioY
    );
    await page.waitForTimeout(120);
    if (new URL(page.url()).searchParams.get("country")) break;
  }
  expect(new URL(page.url()).searchParams.get("country")).toBeTruthy();
  await expect(page.locator(".atlas-country-sheet-toggle")).toBeVisible();

  // The selected-country coordinate intentionally has priority over the moving
  // view centre. Close the peek before measuring the camera response itself.
  await page.locator(".atlas-country-sheet-toggle").click();
  await page.locator(".country-panel .panel-close").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBeNull();
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 5_000,
  });

  const activation = globe.locator('[data-globe-control="touch-activation"]');
  await ensureEmbeddedGlobeControl({ activation, globe, page });
  await expect(canvas).toHaveCSS("touch-action", "none");

  const activeBox = await canvas.boundingBox();
  expect(activeBox).toBeTruthy();
  const activeViewport = page.viewportSize();
  expect(activeViewport).toBeTruthy();
  const activeLeft = Math.max((activeBox?.x ?? 0) + 12, 12);
  const activeRight = Math.min(
    (activeBox?.x ?? 0) + (activeBox?.width ?? 0) - 12,
    (activeViewport?.width ?? 0) - 12
  );
  const activeTop = Math.max((activeBox?.y ?? 0) + 24, 24);
  const activeBottom = Math.min(
    (activeBox?.y ?? 0) + (activeBox?.height ?? 0) - 24,
    (activeViewport?.height ?? 0) - 24
  );
  expect(activeRight - activeLeft).toBeGreaterThan(140);
  expect(activeBottom - activeTop).toBeGreaterThan(80);
  const activeX = (activeLeft + activeRight) / 2;
  const activeY = (activeTop + activeBottom) / 2;
  const activeStartX = activeLeft + (activeRight - activeLeft) * 0.2;
  const activeEndX = activeLeft + (activeRight - activeLeft) * 0.8;
  const scrollBeforeDrag = await page.evaluate(() => window.scrollY);
  const coordinateReadout = page.locator(".atlas-coordinate strong");
  await expect(coordinateReadout).not.toHaveText("—");
  const coordinatesBeforeDrag = await coordinateReadout.textContent();
  const revisionBeforeDrag = Number(
    await globe.getAttribute("data-globe-view-revision")
  );
  await dispatchTouchSequence(page, [
    [{ x: activeStartX, y: activeY, id: 1 }],
    [{ x: activeStartX + (activeEndX - activeStartX) * 0.25, y: activeY + 1, id: 1 }],
    [{ x: activeStartX + (activeEndX - activeStartX) * 0.5, y: activeY + 2, id: 1 }],
    [{ x: activeStartX + (activeEndX - activeStartX) * 0.75, y: activeY + 3, id: 1 }],
    [{ x: activeEndX, y: activeY + 4, id: 1 }],
  ]);
  await expect
    .poll(async () => Number(await globe.getAttribute("data-globe-view-revision")))
    .toBeGreaterThan(revisionBeforeDrag);
  await expect
    .poll(() => coordinateReadout.textContent())
    .not.toBe(coordinatesBeforeDrag);
  expect(new URL(page.url()).searchParams.get("country")).toBeNull();
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeDrag)
  ).toBeLessThan(8);

  const radiusBeforePinch = Number(
    await globe.getAttribute("data-globe-camera-radius")
  );
  expect(radiusBeforePinch).toBeGreaterThan(0);
  await dispatchTouchSequence(page, [
    [
      { x: activeX - 25, y: activeY, id: 1 },
      { x: activeX + 25, y: activeY, id: 2 },
    ],
    [
      { x: activeX - 70, y: activeY, id: 1 },
      { x: activeX + 70, y: activeY, id: 2 },
    ],
  ]);
  await expect
    .poll(async () =>
      Math.abs(
        Number(await globe.getAttribute("data-globe-camera-radius")) -
          radiusBeforePinch
      )
    )
    .toBeGreaterThan(0.02);
  expect(new URL(page.url()).searchParams.get("country")).toBeNull();
  expect(
    Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeDrag)
  ).toBeLessThan(8);

  await selectCountryFromAtlasSearch(page, "Япония");
  const activeSheet = page.locator(".atlas-country-presentation");
  await expect(activeSheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");

  // Focusing the responsive country presentation may briefly move the globe
  // outside its IntersectionObserver boundary. The production safety policy
  // intentionally clears embedded touch capture in that case, so establish
  // full control explicitly before exercising the sheet-adjacent deactivate
  // target. Both transitions remain real pointer clicks.
  await ensureEmbeddedGlobeControl({ activation, globe, page });

  const activationBox = await activation.boundingBox();
  const activeSheetBox = await activeSheet.boundingBox();
  expect(activationBox).toBeTruthy();
  expect(activeSheetBox).toBeTruthy();
  expect((activationBox?.y ?? 0) + (activationBox?.height ?? 0)).toBeLessThanOrEqual(
    (activeSheetBox?.y ?? 0) - 8
  );
  await activation.click();
  await expect(globe).toHaveAttribute("data-globe-touch-mode", "page-pan");
  await expect(canvas).toHaveCSS("touch-action", "pan-y pinch-zoom");
  await activeSheet.locator(".atlas-country-sheet-toggle").click();
  await activeSheet.locator(".country-panel .panel-close").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBeNull();

  await page.locator('[data-atlas-action="enter-immersive"]').click();
  const experience = page.locator("[data-atlas-experience]");
  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(globe).toHaveAttribute("data-globe-touch-mode", "globe-control");
  await expect(canvas).toHaveCSS("touch-action", "none");
  const immersiveBox = await canvas.boundingBox();
  expect(immersiveBox).toBeTruthy();
  const immersiveX = (immersiveBox?.x ?? 0) + (immersiveBox?.width ?? 0) * 0.5;
  const immersiveY = (immersiveBox?.y ?? 0) + (immersiveBox?.height ?? 0) * 0.56;
  const immersiveCoordinatesBefore = await page
    .locator(".atlas-coordinate strong")
    .textContent();
  const immersiveScrollBefore = await page.evaluate(() => window.scrollY);
  await dispatchTouchSequence(page, [
    [{ x: immersiveX - 80, y: immersiveY, id: 1 }],
    [{ x: immersiveX, y: immersiveY + 2, id: 1 }],
    [{ x: immersiveX + 110, y: immersiveY + 4, id: 1 }],
  ]);
  await expect
    .poll(() => page.locator(".atlas-coordinate strong").textContent())
    .not.toBe(immersiveCoordinatesBefore);
  expect(new URL(page.url()).searchParams.get("country")).toBeNull();
  expect(await page.evaluate(() => window.scrollY)).toBe(immersiveScrollBefore);
});

test("country selection keeps Canvas stable and exposes the responsive presentation", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize(
    isMobile ? { width: 430, height: 932 } : { width: 1024, height: 768 }
  );
  const { canvas } = await openAtlas(page);
  await canvas.evaluate((element) => {
    element.dataset.stage4SheetIdentity = "stable";
  });
  const before = await canvas.boundingBox();
  await selectCountryFromAtlasSearch(page, "Япония");

  const sheet = page.locator(".atlas-country-presentation");
  const toggle = sheet.locator(".atlas-country-sheet-toggle");
  if (isMobile) {
    await expect(sheet).toHaveAttribute("data-atlas-sheet-state", "collapsed");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeFocused();
    await expect(toggle.locator(".atlas-country-sheet-flag")).toBeVisible();
    await expect(toggle.locator(".atlas-country-sheet-copy small")).toContainText(
      /автор|author/iu
    );
    await expect(toggle.locator(".atlas-country-sheet-action")).toHaveText(
      /Открыть архив|Open archive/iu
    );
    await expect(sheet.locator(".atlas-country-sheet-content")).toHaveAttribute(
      "inert",
      ""
    );
  } else {
    await expect(toggle).toHaveCount(0);
    await expect(sheet.locator(".country-panel")).toBeVisible();
  }
  const after = await canvas.boundingBox();
  expect(Math.abs((after?.width ?? 0) - (before?.width ?? 0))).toBeLessThan(2);
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThan(2);

  if (isMobile) {
    await exerciseThreeStateCountrySheet({ sheet, canvas, page });

    await page.locator('[data-atlas-action="enter-immersive"]').click();
    const experience = page.locator("[data-atlas-experience]");
    await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
    await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
    await exerciseThreeStateCountrySheet({
      sheet,
      canvas,
      experience,
      page,
    });
  }
});

test("Nobel layer keeps selection and its explicit article action separate", async ({
  page,
}) => {
  const { atlas, globe, canvas } = await openAtlas(page);
  await canvas.evaluate((element) => {
    element.dataset.stage4NobelIdentity = "stable";
  });

  const nobelFilter = atlas.locator('[data-atlas-filter="nobel"]');
  await nobelFilter.click();
  await expect(nobelFilter).toHaveAttribute("aria-pressed", "true");

  const nobelStatus = globe.locator(".globe-nobel-status");
  await expect(nobelStatus).toBeVisible();
  await nobelStatus.locator("summary").click();
  await expect(nobelStatus).toHaveAttribute("open", "");
  const nobelIndex = nobelStatus.getByRole("list", {
    name: /Нобелевские лауреаты|Nobel laureates/iu,
  });
  await expect(nobelIndex).toBeVisible();
  const rows = nobelIndex.locator(":scope > li");
  const rowCount = await rows.count();
  expect(rowCount).toBeGreaterThan(0);
  const announcedCount = Number(
    (await nobelStatus.locator("summary strong").textContent())?.trim()
  );
  expect(announcedCount).toBe(rowCount);

  const articleRow = rows
    .filter({ has: page.locator(".globe-nobel-article-action") })
    .first();
  await expect(articleRow).toBeVisible();
  const writerButton = articleRow.locator("button");
  const writerName = (await writerButton.locator("span").textContent())?.trim();
  const articleAction = articleRow.locator(".globe-nobel-article-action");
  await expect(articleAction).toHaveAttribute("href", /\/stati\//u);
  expect(
    await articleAction.evaluate((element) => element.closest("button") === null)
  ).toBe(true);
  const articleHref = await articleAction.getAttribute("href");

  await writerButton.click();
  await expect(page).toHaveURL(/country=[^&#]+.*writer=[^&#]+/u);
  expect(page.url()).not.toContain(articleHref ?? "__missing_article_href__");
  await expect(page.locator(".writer-detail-heading h4")).toHaveText(
    writerName ?? ""
  );
  await expect(
    atlas.locator('canvas[data-stage4-nobel-identity="stable"]')
  ).toHaveCount(1);
  await expect(articleAction).toHaveAttribute("href", articleHref ?? "");
});

test("writer selection stays still until explicit Show on globe", async ({
  page,
  isMobile,
}) => {
  const { atlas, globe, canvas } = await openAtlas(page);
  await canvas.evaluate((element) => {
    element.dataset.stage4WriterIdentity = "stable";
  });

  const japanId = await selectCountryFromAtlasSearch(page, "Япония");
  expect(japanId).toBeTruthy();
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 5_000,
  });
  if (isMobile) {
    await page.locator(".atlas-country-sheet-toggle").click();
    await expect(page.locator(".atlas-country-presentation")).toHaveAttribute(
      "data-atlas-sheet-state",
      "half"
    );
  }

  const inactiveWriter = page
    .locator(".writer-list .writer-row:not(.is-active)")
    .first();
  await inactiveWriter.scrollIntoViewIfNeeded();
  await expect(inactiveWriter).toBeVisible();
  const priorWriter = new URL(page.url()).searchParams.get("writer");
  await inactiveWriter.click();
  await expect
    .poll(() => new URL(page.url()).searchParams.get("writer"))
    .not.toBe(priorWriter);
  const selectedWriter = new URL(page.url()).searchParams.get("writer");
  expect(selectedWriter).toBeTruthy();
  await expect(globe).toHaveAttribute("data-globe-writer-marker", "none");
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle");

  const showOnGlobe = page.locator(".writer-show-on-globe");
  await showOnGlobe.scrollIntoViewIfNeeded();
  await expect(showOnGlobe).toBeVisible();
  await showOnGlobe.click();
  await expect(globe).toHaveAttribute(
    "data-globe-camera-intent",
    /^writer-focus:\d+$/u
  );
  const writerIntent =
    (await globe.getAttribute("data-globe-camera-intent")) ?? "none";
  expect(writerIntent).toMatch(/^writer-focus:\d+$/u);
  const writerIntentKey = settledCameraIntent(writerIntent, japanId ?? "");
  await expect(globe).toHaveAttribute(
    "data-globe-camera-started-intent",
    writerIntentKey
  );
  await expect(globe).toHaveAttribute(
    "data-globe-writer-marker",
    selectedWriter ?? ""
  );
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 5_000,
  });
  await expect(globe).toHaveAttribute(
    "data-globe-camera-settled-intent",
    writerIntentKey
  );
  await expect(
    atlas.locator('canvas[data-stage4-writer-identity="stable"]')
  ).toHaveCount(1);

  if (isMobile) {
    await page.locator(".atlas-country-sheet-toggle").click();
    await expect(page.locator(".atlas-country-presentation")).toHaveAttribute(
      "data-atlas-sheet-state",
      "half"
    );
  }
  await page.locator(".country-panel .panel-close").click();
  await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBeNull();
  await selectCountryFromAtlasSearch(page, "Андорра");
  if (isMobile) {
    await page.locator(".atlas-country-sheet-toggle").click();
  }
  await expect(page.locator(".writer-globe-unavailable")).toBeVisible();
  await expect(page.locator(".writer-show-on-globe")).toHaveCount(0);
  await expect(globe).toHaveAttribute("data-globe-writer-marker", "none");
  await expect(
    atlas.locator('canvas[data-stage4-writer-identity="stable"]')
  ).toHaveCount(1);
});

test("manual drag cancels a country flight before the next frame and never snaps back", async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const { globe, canvas } = await openAtlas(page);
  await page.locator('[data-atlas-action="enter-immersive"]').click();
  const experience = page.locator("[data-atlas-experience]");
  await expect(experience).toHaveAttribute("data-atlas-view", "immersive");
  await expect(experience).toHaveAttribute("data-atlas-transition", "idle");
  await expect(globe).toHaveAttribute("data-globe-touch-mode", "globe-control");
  const auto = globe.locator('[data-globe-control="auto-rotate"]');
  if ((await auto.getAttribute("aria-pressed")) === "true") {
    await auto.click();
  }
  await expect(auto).toHaveAttribute("aria-pressed", "false");
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand");
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  const x = (box?.x ?? 0) + (box?.width ?? 0) * 0.32;
  const y = (box?.y ?? 0) + (box?.height ?? 0) * 0.56;
  const inputSession = await page.context().newCDPSession(page);

  await page.locator('[data-atlas-action="toggle-search"]').click();
  const search = page.locator("#country-search");
  await search.fill("Индонезия");
  const result = page.getByRole("option", {
    name: "Индонезия",
    exact: true,
  });
  await expect(result).toBeVisible();
  const programmaticStart = page.waitForFunction(() =>
    document
      .querySelector(".literary-globe:not(.is-loading)")
      ?.getAttribute("data-globe-camera-phase") === "programmatic"
  );
  const resultClick = result.click();
  await programmaticStart;

  try {
    if (isMobile) {
      await inputSession.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      });
      await inputSession.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + 8, y: y + 2, id: 1 }],
      });
    } else {
      await inputSession.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x,
        y,
        button: "left",
        buttons: 1,
        clickCount: 1,
      });
      await inputSession.send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: x + 8,
        y: y + 2,
        button: "left",
        buttons: 1,
      });
    }

    await resultClick;

    await expect(globe).not.toHaveAttribute(
      "data-globe-camera-cancelled-intent",
      "none"
    );

    if (isMobile) {
      for (const [moveX, moveY] of [
        [x + 64, y + 12],
        [x + 128, y + 24],
        [x + 190, y + 36],
      ]) {
        await inputSession.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: moveX, y: moveY, id: 1 }],
        });
        await page.waitForTimeout(32);
      }
      await inputSession.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      for (const [moveX, moveY] of [
        [x + 64, y + 12],
        [x + 128, y + 24],
        [x + 190, y + 36],
      ]) {
        await inputSession.send("Input.dispatchMouseEvent", {
          type: "mouseMoved",
          x: moveX,
          y: moveY,
          button: "left",
          buttons: 1,
        });
      }
      await inputSession.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: x + 190,
        y: y + 36,
        button: "left",
        buttons: 0,
        clickCount: 1,
      });
    }
  } finally {
    await inputSession.detach();
  }

  const cancelledIntentKey =
    (await globe.getAttribute("data-globe-camera-cancelled-intent")) ?? "none";
  expect(cancelledIntentKey).toMatch(/^country-focus:indonesia:\d+$/u);
  await expect(globe).toHaveAttribute(
    "data-globe-camera-started-intent",
    cancelledIntentKey
  );

  await expect(globe).toHaveAttribute(
    "data-globe-camera-cancelled-intent",
    cancelledIntentKey
  );
  await expect(globe).toHaveAttribute(
    "data-globe-camera-cancellation-source",
    "manual"
  );

  await expect(globe).not.toHaveAttribute(
    "data-globe-camera-phase",
    "programmatic"
  );
  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 4_000,
  });
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand", {
    timeout: 4_000,
  });
  await expect
    .poll(async () => {
      const first = await globe.getAttribute("data-globe-view-revision");
      await page.waitForTimeout(140);
      const second = await globe.getAttribute("data-globe-view-revision");
      return first === second;
    })
    .toBe(true);
  const settledCountry = await globe.getAttribute("data-globe-view-country");
  const settledCoordinates = await page
    .locator(".atlas-coordinate strong")
    .textContent();
  await page.waitForTimeout(1_700);
  await expect(globe).not.toHaveAttribute(
    "data-globe-camera-settled-intent",
    cancelledIntentKey
  );
  await expect(globe).toHaveAttribute(
    "data-globe-view-country",
    settledCountry ?? "ocean"
  );
  await expect(page.locator(".atlas-coordinate strong")).toHaveText(
    settledCoordinates ?? ""
  );
});

test("rapid A to B to high-latitude C selection is latest-wins through resize", async ({
  page,
  isMobile,
}) => {
  if (isMobile) await page.setViewportSize({ width: 1024, height: 768 });
  const { globe, canvas } = await openAtlas(page);
  await canvas.evaluate((element) => {
    element.dataset.stage4RapidIdentity = "stable";
  });

  const firstCountry = await selectCountryFromAtlasSearch(page, "Япония");
  const firstIntent =
    (await globe.getAttribute("data-globe-camera-intent")) ?? "none";
  expect(firstCountry).toBeTruthy();
  expect(firstIntent).toMatch(/^country-focus:\d+$/u);
  await expect(globe).toHaveAttribute(
    "data-globe-camera-started-intent",
    settledCameraIntent(firstIntent, firstCountry ?? "")
  );

  const secondCountry = await selectCountryFromAtlasSearch(page, "Бразилия");
  await expect(globe).not.toHaveAttribute(
    "data-globe-camera-intent",
    firstIntent
  );
  const secondIntent =
    (await globe.getAttribute("data-globe-camera-intent")) ?? "none";
  expect(secondCountry).toBeTruthy();
  expect(secondIntent).toMatch(/^country-focus:\d+$/u);
  await expect(globe).toHaveAttribute(
    "data-globe-camera-started-intent",
    settledCameraIntent(secondIntent, secondCountry ?? "")
  );

  const finalCountry = await selectCountryFromAtlasSearch(page, "Исландия");
  expect(finalCountry).toBeTruthy();
  await expect(globe).not.toHaveAttribute(
    "data-globe-camera-intent",
    secondIntent
  );
  const finalIntent =
    (await globe.getAttribute("data-globe-camera-intent")) ?? "none";
  expect(finalIntent).toMatch(/^country-focus:\d+$/u);
  await expect(globe).toHaveAttribute(
    "data-globe-camera-started-intent",
    settledCameraIntent(finalIntent, finalCountry ?? "")
  );
  expect(new Set([firstIntent, secondIntent, finalIntent]).size).toBe(3);
  await page.setViewportSize({ width: 1180, height: 820 });

  await expect(globe).toHaveAttribute("data-globe-camera-phase", "idle", {
    timeout: 5_000,
  });
  await expect(globe).toHaveAttribute(
    "data-globe-view-country",
    finalCountry ?? ""
  );
  await expect(globe).toHaveAttribute("data-globe-camera-intent", finalIntent);
  await expect(globe).toHaveAttribute(
    "data-globe-camera-settled-intent",
    settledCameraIntent(finalIntent, finalCountry ?? "")
  );
  await expect(
    page.locator('canvas[data-stage4-rapid-identity="stable"]')
  ).toHaveCount(1);
  await expect(page.locator(".country-panel")).toContainText(/Исланд|Iceland/iu);
});
