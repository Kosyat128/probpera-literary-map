import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const appUrl =
  process.env.STAGE5D1_CAPTURE_URL || "http://127.0.0.1:4173/#books";
const readinessTimeout = Number(
  process.env.STAGE5D1_CAPTURE_TIMEOUT_MS || 20_000
);
const outputDirectory = process.env.STAGE5_CAPTURE_OUTPUT
  ? resolve(process.env.STAGE5_CAPTURE_OUTPUT)
  : fileURLToPath(
      new URL("../reports/stage5d1-library-frame/browser/", import.meta.url)
    );

await mkdir(outputDirectory, { recursive: true });

const browserOptions = {
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist", "--use-angle=swiftshader"],
};
let browser = await chromium.launch(browserOptions);

const evidence = {
  generatedAt: new Date().toISOString(),
  scope:
    process.env.STAGE5_CAPTURE_SCOPE ||
    "Stage 5D-1 final production-build visual evidence",
  source: { url: appUrl, server: "local Vite preview" },
  checks: [],
  screenshots: [],
  screenshotSha256: {},
};

async function waitForShelf(page) {
  const startedAt = Date.now();
  await page.goto(appUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const frame = page.locator("#books .book-shelf-frame");
  await frame.waitFor({ state: "visible", timeout: 60_000 });
  await page.locator("#books").scrollIntoViewIfNeeded();
  // The Canvas is intentionally mounted only while its scene viewport is
  // near the screen. Centre that viewport before waiting for lazy WebGL.
  await page.locator(".book-shelf-scene").evaluate((scene) =>
    scene.scrollIntoView({ block: "center", inline: "nearest" })
  );
  await page.waitForTimeout(250);
  try {
    await page.waitForFunction(
      () =>
        document.querySelector(".book-shelf-scene")?.getAttribute(
          "data-book-shelf-phase"
        ) === "SHELF_IDLE" &&
        document.querySelectorAll(".book-shelf-scene canvas").length === 1,
      undefined,
      { timeout: readinessTimeout }
    );
  } catch (error) {
    console.error(
      "Shelf readiness diagnostic:",
      await page.evaluate(() => ({
        phase: document
          .querySelector(".book-shelf-scene")
          ?.getAttribute("data-book-shelf-phase"),
        canvasCount: document.querySelectorAll(".book-shelf-scene canvas").length,
        catalogHidden: document
          .querySelector(".book-shelf-frame__catalog")
          ?.hasAttribute("hidden"),
        sceneHidden: document
          .querySelector(".book-shelf-frame__scene")
          ?.hasAttribute("hidden"),
        text: document.querySelector("#books")?.textContent?.slice(0, 300),
      }))
    );
    throw error;
  }
  const readinessMs = Date.now() - startedAt;
  await page.waitForTimeout(2_500);
  return { frame, readinessMs };
}

async function captureFrame(page, frame, name) {
  const buffer = await frame.screenshot({
    animations: "disabled",
    caret: "hide",
    style: ".site-header, .mobile-nav { visibility: hidden !important; }",
    type: "png",
  });
  await writeFile(`${outputDirectory}/${name}`, buffer);
  evidence.screenshots.push(name);
  evidence.screenshotSha256[name] = createHash("sha256")
    .update(buffer)
    .digest("hex")
    .toUpperCase();
}

async function measure(page) {
  return page.evaluate(() => {
    const frame = document.querySelector(".book-shelf-frame");
    const rect = frame?.getBoundingClientRect();
    return {
      frame: rect
        ? { width: Math.round(rect.width), height: Math.round(rect.height) }
        : null,
      documentOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ),
      frameOverflow: frame
        ? Math.max(0, frame.scrollWidth - frame.clientWidth)
        : null,
      canvasCount: document.querySelectorAll(".book-shelf-scene canvas").length,
      detailCount: document.querySelectorAll("#book-archive-detail").length,
      phase:
        document
          .querySelector(".book-shelf-scene")
          ?.getAttribute("data-book-shelf-phase") || null,
      brandCount: document.querySelectorAll(".book-shelf-controls__brand").length,
      audioElements: document.querySelectorAll("audio").length,
    };
  });
}

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const desktopReady = await waitForShelf(desktop);
  await captureFrame(desktop, desktopReady.frame, "ru-desktop-1440x900-shelf.png");
  evidence.checks.push({
    case: "ru-desktop-1440x900",
    state: "idle",
    evidence: {
      ...(await measure(desktop)),
      readinessMs: desktopReady.readinessMs,
    },
  });

  await desktop.locator(".book-shelf-scene-hint").click();
  await desktop.locator("#book-archive-detail").waitFor({
    state: "visible",
    timeout: 30_000,
  });
  await desktop.waitForFunction(
    () =>
      document.querySelector(".book-shelf-scene")?.getAttribute(
        "data-book-shelf-phase"
      ) === "INSPECTION_CLOSED",
    undefined,
    { timeout: 30_000 }
  );
  await desktop.waitForTimeout(500);
  await captureFrame(desktop, desktopReady.frame, "ru-desktop-1440x900-selected.png");
  evidence.checks.push({
    case: "ru-desktop-1440x900",
    state: "selected",
    evidence: await measure(desktop),
  });
  if (process.env.STAGE5_CAPTURE_INSPECTION === "true") {
    const openCover = desktop.locator(".book-detail-open-cover");
    await openCover.scrollIntoViewIfNeeded();
    await openCover.click();
    await desktop.waitForFunction(
      () =>
        document.querySelector(".book-shelf-scene")?.getAttribute(
          "data-book-shelf-phase"
        ) === "BOOK_OPEN",
      undefined,
      { timeout: 30_000 }
    );
    await desktop.waitForTimeout(1_200);
    await captureFrame(
      desktop,
      desktopReady.frame,
      "ru-desktop-1440x900-book-open.png"
    );
    evidence.checks.push({
      case: "ru-desktop-1440x900",
      state: "book-open",
      evidence: await measure(desktop),
    });

    const nextPage = desktop.locator(
      ".book-detail-page-navigation .book-detail-page-turn.is-next"
    );
    if (
      process.env.STAGE5_CAPTURE_PAGE_TURN !== "false" &&
      (await nextPage.isEnabled())
    ) {
      const priorPosition = await desktop
        .locator(".book-detail-page-navigation [role='status']")
        .textContent();
      await nextPage.click();
      await desktop.waitForFunction(
        (previous) => {
          const phase = document
            .querySelector(".book-shelf-scene")
            ?.getAttribute("data-book-shelf-phase");
          const position = document.querySelector(
            ".book-detail-page-navigation [role='status']"
          )?.textContent;
          return phase === "BOOK_OPEN" && position !== previous;
        },
        priorPosition,
        { timeout: 30_000 }
      );
      await desktop.waitForTimeout(500);
      await captureFrame(
        desktop,
        desktopReady.frame,
        "ru-desktop-1440x900-page-2.png"
      );
      evidence.checks.push({
        case: "ru-desktop-1440x900",
        state: "page-2",
        evidence: await measure(desktop),
      });
    }
  }
  await desktop.close();

  if (process.env.STAGE5_CAPTURE_DESKTOP_ONLY !== "true") {
    // A fresh browser keeps the mobile proof independent from the two desktop
    // WebGL contexts and mirrors a real phone navigation instead of context reuse.
    await browser.close();
    browser = await chromium.launch(browserOptions);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const mobileReady = await waitForShelf(mobile);
    // Capturing the entire tall mobile frame makes Playwright scroll it while
    // painting. That legitimately trips the scene's IntersectionObserver and
    // can unmount WebGL halfway through the screenshot. Keep the active scene
    // centred and capture its real 368x480 viewport instead.
    const mobileScene = mobile.locator(".book-shelf-scene");
    await mobileScene.scrollIntoViewIfNeeded();
    await mobile.waitForFunction(
      () =>
        document.querySelector(".book-shelf-scene")?.getAttribute(
          "data-book-shelf-phase"
        ) === "SHELF_IDLE" &&
        document.querySelectorAll(".book-shelf-scene canvas").length === 1,
      undefined,
      { timeout: readinessTimeout }
    );
    await mobile.waitForTimeout(750);
    await captureFrame(mobile, mobileScene, "ru-mobile-390x844-shelf.png");
    evidence.checks.push({
      case: "ru-mobile-390x844",
      state: "idle",
      evidence: {
        ...(await measure(mobile)),
        readinessMs: mobileReady.readinessMs,
      },
    });
    await mobile.close();
  }

  await writeFile(
    `${outputDirectory}/qa-results.json`,
    `${JSON.stringify(evidence, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `Captured ${evidence.screenshots.length} bookshelf screenshots in ${outputDirectory}`
  );
} finally {
  await browser.close().catch(() => undefined);
}
