import { expect, test } from "@playwright/test";

const ORDER_SELECTORS = [
  "#journal",
  "#authors",
  "#sections",
  "#calendar",
  "#community",
  "#editorial-policy",
  ".site-footer",
];

const VIEWPORTS = [
  {
    label: "desktop-1440",
    width: 1440,
    height: 900,
    sectionColumns: 4,
    authorColumns: 4,
    emptySlotsVisible: true,
    bookLayout: "split",
  },
  {
    label: "tablet-1024",
    width: 1024,
    height: 768,
    sectionColumns: 2,
    authorColumns: 2,
    emptySlotsVisible: true,
    bookLayout: "supporting-pair",
  },
  {
    label: "mobile-390",
    width: 390,
    height: 844,
    sectionColumns: 1,
    authorColumns: 1,
    emptySlotsVisible: false,
    bookLayout: "stack",
  },
];

const AUTHOR_CARD_HEIGHT_CAP = 420;
const LANDMARK_DELTA = 2;

test.setTimeout(150_000);

async function settleLayout(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  });
}

async function openHomepage(page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".magazine-hero")).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator("#calendar .calendar-card")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("#sections .section-directory-card")).toHaveCount(8);
  await expect(page.locator("#authors .author-showcase article > button")).toHaveCount(4);
  await settleLayout(page);
}

async function collectLayout(page, viewport) {
  return page.evaluate(
    ({ orderSelectors, expectedSectionColumns }) => {
      const box = (element, label) => {
        if (!element) throw new Error(`Missing Stage 5C target: ${label}`);
        const rect = element.getBoundingClientRect();
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      };
      const columns = (element, label) => {
        if (!element) throw new Error(`Missing Stage 5C grid: ${label}`);
        return getComputedStyle(element)
          .gridTemplateColumns.split(/\s+/u)
          .filter(Boolean).length;
      };
      const maxDelta = (values) =>
        values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
      const intersects = (first, second) =>
        Math.min(first.right, second.right) - Math.max(first.left, second.left) > 0.5 &&
        Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 0.5;

      const orderNodes = orderSelectors.map((selector) =>
        document.querySelector(selector)
      );
      const orderCounts = orderSelectors.map(
        (selector) => document.querySelectorAll(selector).length
      );
      const domOrder = orderNodes.slice(0, -1).every((node, index) => {
        const next = orderNodes[index + 1];
        return Boolean(
          node &&
            next &&
            (node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      });
      const orderTops = orderNodes.map((node, index) =>
        box(node, orderSelectors[index]).top + window.scrollY
      );

      const sectionGrid = document.querySelector(
        "#sections .sections-directory-grid"
      );
      if (!sectionGrid) throw new Error("Missing Sections directory grid");
      const sectionCards = [
        ...sectionGrid.querySelectorAll(":scope > .section-directory-card"),
      ];
      const landmarkDefinitions = [
        ["card-top", null, "top"],
        ["card-bottom", null, "bottom"],
        ["content", ":scope > div", "top"],
        ["eyebrow", ".section-card-eyebrow", "top"],
        ["title", ":scope > div > h3", "top"],
        ["description", ":scope > div > p", "top"],
        ["series-slot", ".section-card-series-slot", "top"],
        ["latest-slot", ".section-card-latest-slot", "top"],
        ["footer", ".section-card-action", "top"],
        ["CTA", ".section-card-action > a", "top"],
        ["arrow", ".section-card-action i", "top"],
        ["bottom", ".section-card-action", "bottom"],
      ];
      const sectionRows = [];
      for (
        let start = 0;
        start < sectionCards.length;
        start += expectedSectionColumns
      ) {
        const rowCards = sectionCards.slice(
          start,
          start + expectedSectionColumns
        );
        const deltas = Object.fromEntries(
          landmarkDefinitions.map(([name, selector, edge]) => {
            const coordinates = rowCards.map((card) => {
              const target = selector ? card.querySelector(selector) : card;
              return box(target, `${name} in Sections card`)[edge];
            });
            return [name, maxDelta(coordinates)];
          })
        );
        sectionRows.push({ start, count: rowCards.length, deltas });
      }

      const emptySlots = sectionCards
        .flatMap((card) => [
          ...card.querySelectorAll(
            ".section-card-series-slot, .section-card-latest-slot"
          ),
        ])
        .filter(
          (slot) =>
            slot.childElementCount === 0 && !(slot.textContent || "").trim()
        )
        .map((slot) => {
          const rect = box(slot, `empty .${slot.className}`);
          const cardIndex = sectionCards.indexOf(slot.closest(".section-directory-card"));
          const rowStart = Math.floor(cardIndex / expectedSectionColumns) * expectedSectionColumns;
          const selector = slot.matches(".section-card-series-slot")
            ? ".section-card-series-slot"
            : ".section-card-latest-slot";
          const hasContentInRow = sectionCards.slice(rowStart, rowStart + expectedSectionColumns)
            .some((card) => {
              const neighbor = card.querySelector(selector);
              return neighbor.childElementCount > 0 || Boolean(neighbor.textContent.trim());
            });
          return {
            className: slot.className,
            display: getComputedStyle(slot).display,
            height: rect.height,
            hasContentInRow,
          };
        });

      const bookGrid = document.querySelector("#book-day");
      const bookMain = box(
        document.querySelector("#book-day .book-of-day"),
        ".book-of-day"
      );
      const bookProof = box(
        document.querySelector("#book-day .literary-news-slot"),
        ".literary-news-slot"
      );
      const bookFact = box(
        document.querySelector("#book-day .book-fact-card"),
        ".book-fact-card"
      );

      const promptButtons = [
        ...document.querySelectorAll(
          "#community .community-reading-notes > button"
        ),
      ];
      const promptMetrics = promptButtons.map((button) => {
        const buttonBox = box(button, "Community prompt");
        const style = getComputedStyle(button);
        const small = button.querySelector("small");
        const strong = button.querySelector("strong");
        if (!small || !strong) {
          throw new Error("Community prompt copy is incomplete");
        }
        const baselineOffset = (element) => {
          const marker = document.createElement("span");
          marker.setAttribute("aria-hidden", "true");
          marker.style.cssText =
            "display:inline-block;width:0;height:0;margin:0;padding:0;border:0;vertical-align:baseline";
          element.prepend(marker);
          const offset = marker.getBoundingClientRect().top - buttonBox.top;
          marker.remove();
          return offset;
        };
        return {
          height: buttonBox.height,
          padding: [
            style.paddingTop,
            style.paddingRight,
            style.paddingBottom,
            style.paddingLeft,
          ].map(Number.parseFloat),
          smallBaseline: baselineOffset(small),
          strongBaseline: baselineOffset(strong),
        };
      });

      const authorGrid = document.querySelector("#authors .author-showcase");
      const authorButtons = [
        ...document.querySelectorAll(
          "#authors .author-showcase article > button"
        ),
      ];
      const authorHeights = authorButtons.map(
        (button) => box(button, "Author card").height
      );

      const overflowSelectors = [
        "#book-day",
        "#community .community-reading-notes",
        "#authors .author-showcase",
        "#sections .sections-directory-grid",
      ];
      const componentOverflow = overflowSelectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing overflow target: ${selector}`);
        return {
          selector,
          delta: element.scrollWidth - element.clientWidth,
        };
      });

      return {
        order: { counts: orderCounts, domOrder, tops: orderTops },
        sections: {
          columns: columns(sectionGrid, ".sections-directory-grid"),
          cardCount: sectionCards.length,
          rows: sectionRows,
          emptySlots,
        },
        book: {
          columns: columns(bookGrid, "#book-day"),
          main: bookMain,
          proof: bookProof,
          fact: bookFact,
          overlaps: {
            mainProof: intersects(bookMain, bookProof),
            mainFact: intersects(bookMain, bookFact),
            proofFact: intersects(bookProof, bookFact),
          },
        },
        community: {
          count: promptMetrics.length,
          metrics: promptMetrics,
        },
        authors: {
          columns: columns(authorGrid, ".author-showcase"),
          count: authorHeights.length,
          heights: authorHeights,
        },
        overflow: {
          document:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          components: componentOverflow,
        },
      };
    },
    {
      orderSelectors: ORDER_SELECTORS,
      expectedSectionColumns: viewport.sectionColumns,
    }
  );
}

function delta(values) {
  return values.length > 1 ? Math.max(...values) - Math.min(...values) : 0;
}

test("Stage 5C keeps the final homepage structure and card geometry", async ({
  page,
}) => {
  await openHomepage(page);

  const editorialContext = page.locator("#book-day .news-editorial-context");
  await expect(editorialContext.locator("summary")).toBeVisible();
  await expect(editorialContext.locator(".editorial-standard#about")).toHaveCount(1);
  await expect(editorialContext).not.toHaveAttribute("open", "");

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await settleLayout(page);
    const result = await collectLayout(page, viewport);
    const label = viewport.label;

    expect(result.order.counts, `${label}: unique homepage landmarks`).toEqual(
      ORDER_SELECTORS.map(() => 1)
    );
    expect(result.order.domOrder, `${label}: DOM order`).toBe(true);
    for (let index = 1; index < result.order.tops.length; index += 1) {
      expect(
        result.order.tops[index],
        `${label}: ${ORDER_SELECTORS[index]} visually follows ${ORDER_SELECTORS[index - 1]}`
      ).toBeGreaterThan(result.order.tops[index - 1]);
    }

    expect(result.sections.cardCount, `${label}: Sections card count`).toBe(8);
    expect(result.sections.columns, `${label}: Sections columns`).toBe(
      viewport.sectionColumns
    );
    for (const row of result.sections.rows) {
      for (const [landmark, landmarkDelta] of Object.entries(row.deltas)) {
        expect(
          landmarkDelta,
          `${label}: Sections row ${row.start / viewport.sectionColumns + 1} ${landmark}`
        ).toBeLessThanOrEqual(LANDMARK_DELTA);
      }
    }
    expect(
      result.sections.emptySlots.length,
      `${label}: Sections has real empty landmark slots`
    ).toBeGreaterThan(0);
    for (const slot of result.sections.emptySlots) {
      if (viewport.emptySlotsVisible) {
        expect(slot.display, `${label}: ${slot.className} display`).not.toBe(
          "none"
        );
        if (slot.hasContentInRow) {
          expect(slot.height, `${label}: ${slot.className} shares populated neighbor row`).toBeGreaterThan(0);
        } else {
          expect(slot.height, `${label}: ${slot.className} fully empty row adds no blank band`).toBe(0);
        }
      } else {
        expect(slot.display, `${label}: ${slot.className} compact display`).toBe(
          "none"
        );
        expect(slot.height, `${label}: ${slot.className} compact height`).toBe(0);
      }
    }

    expect(result.book.columns, `${label}: Book Month columns`).toBe(
      viewport.bookLayout === "split" ? 2 : 1
    );
    expect(result.book.overlaps.proofFact, `${label}: proof/fact overlap`).toBe(
      false
    );
    if (viewport.bookLayout === "split") {
      expect(result.book.overlaps.mainProof, `${label}: main/proof overlap`).toBe(
        false
      );
      expect(result.book.overlaps.mainFact, `${label}: main/fact overlap`).toBe(
        false
      );
      expect(result.book.main.right, `${label}: main before proof`).toBeLessThanOrEqual(
        result.book.proof.left + 1
      );
      expect(
        Math.abs(result.book.main.top - result.book.proof.top),
        `${label}: main/proof top alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(
        Math.abs(result.book.main.bottom - result.book.fact.bottom),
        `${label}: main/fact bottom alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(result.book.main.width, `${label}: Book Month remains primary`).toBeGreaterThan(
        result.book.proof.width
      );
      expect(
        Math.abs(result.book.proof.left - result.book.fact.left),
        `${label}: proof/fact left alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(
        Math.abs(result.book.proof.right - result.book.fact.right),
        `${label}: proof/fact right alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(result.book.proof.bottom, `${label}: proof before fact`).toBeLessThanOrEqual(
        result.book.fact.top + 1
      );
    } else if (viewport.bookLayout === "supporting-pair") {
      expect(
        result.book.main.bottom,
        `${label}: main before supporting pair`
      ).toBeLessThanOrEqual(result.book.proof.top + 1);
      expect(
        result.book.main.bottom,
        `${label}: main before Book Fact`
      ).toBeLessThanOrEqual(result.book.fact.top + 1);
      expect(
        result.book.proof.right,
        `${label}: proof before fact`
      ).toBeLessThanOrEqual(result.book.fact.left + 1);
      expect(
        Math.abs(result.book.proof.top - result.book.fact.top),
        `${label}: supporting pair top alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(
        Math.abs(result.book.proof.bottom - result.book.fact.bottom),
        `${label}: supporting pair bottom alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(
        Math.abs(result.book.main.left - result.book.proof.left),
        `${label}: supporting pair left edge`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(
        Math.abs(result.book.main.right - result.book.fact.right),
        `${label}: supporting pair right edge`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
    } else {
      expect(result.book.main.bottom, `${label}: main before proof`).toBeLessThanOrEqual(
        result.book.proof.top + 1
      );
      expect(result.book.proof.bottom, `${label}: proof before fact`).toBeLessThanOrEqual(
        result.book.fact.top + 1
      );
      expect(
        delta([result.book.main.left, result.book.proof.left, result.book.fact.left]),
        `${label}: stacked Book Month left alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
      expect(
        delta([result.book.main.right, result.book.proof.right, result.book.fact.right]),
        `${label}: stacked Book Month right alignment`
      ).toBeLessThanOrEqual(LANDMARK_DELTA);
    }

    expect(result.community.count, `${label}: Community prompt count`).toBe(3);
    expect(
      delta(result.community.metrics.map((metric) => metric.height)),
      `${label}: Community prompt heights`
    ).toBeLessThanOrEqual(LANDMARK_DELTA);
    for (let side = 0; side < 4; side += 1) {
      expect(
        delta(result.community.metrics.map((metric) => metric.padding[side])),
        `${label}: Community prompt padding side ${side}`
      ).toBeLessThanOrEqual(0.1);
    }
    expect(
      delta(result.community.metrics.map((metric) => metric.smallBaseline)),
      `${label}: Community small-text baselines`
    ).toBeLessThanOrEqual(LANDMARK_DELTA);
    expect(
      delta(result.community.metrics.map((metric) => metric.strongBaseline)),
      `${label}: Community strong-text baselines`
    ).toBeLessThanOrEqual(LANDMARK_DELTA);

    expect(result.authors.count, `${label}: Authors card count`).toBe(4);
    expect(result.authors.columns, `${label}: Authors columns`).toBe(
      viewport.authorColumns
    );
    expect(delta(result.authors.heights), `${label}: Authors equal heights`).toBeLessThanOrEqual(
      LANDMARK_DELTA
    );
    expect(Math.max(...result.authors.heights), `${label}: Authors height cap`).toBeLessThanOrEqual(
      AUTHOR_CARD_HEIGHT_CAP
    );

    expect(result.overflow.document, `${label}: document overflow`).toBeLessThanOrEqual(
      2
    );
    for (const component of result.overflow.components) {
      expect(
        component.delta,
        `${label}: component overflow ${component.selector}`
      ).toBeLessThanOrEqual(1);
    }
  }
});
