import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("../index.css", import.meta.url), "utf8");

function rule(pattern: RegExp) {
  const match = styles.match(pattern);
  expect(match, `CSS rule not found: ${pattern}`).not.toBeNull();
  return match?.[1] || "";
}

describe("Stage 5E vertical scroll ownership", () => {
  it("keeps WriterPanel scrolling on the country panel only", () => {
    const writerList = rule(/\.writer-list\s*\{([^}]*)\}/u);
    expect(writerList).toContain("max-height: none");
    expect(writerList).toContain("overflow-y: visible");
  });

  it("keeps ArticleReader scrolling on its main surface only", () => {
    const readerSidebars = rule(
      /\.article-reader-toc,\s*\.article-reader-related\s*\{([^}]*)\}/u
    );
    expect(readerSidebars).toContain("max-height: none");
    expect(readerSidebars).toContain("overflow-y: visible");
  });

  it("gives each Community view one vertical body scroller", () => {
    const hub = rule(/\.community-hub\s*\{([^}]*)\}/u);
    expect(hub).toContain("overflow: hidden");
    expect(hub).not.toContain("overflow: hidden auto");

    const accountLibrary = rule(/\.account-library > div\s*\{([^}]*)\}/u);
    expect(accountLibrary).not.toMatch(/max-height|overflow-y/u);

    const accountPanel = rule(/\.account-panel\s*\{([^}]*)\}/u);
    expect(accountPanel).toContain("overflow-y: auto");

    expect(styles).toMatch(
      /\.community-setup,\s*\.forum-view,\s*\.admin-view\s*\{[^}]*overflow-y: auto/u
    );
    expect(styles).toMatch(
      /\.community-hub\.is-account \.account-view\s*\{[^}]*overflow: hidden/u
    );
  });
});
