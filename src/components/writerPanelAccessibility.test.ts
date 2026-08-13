import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(
  new URL("./WriterPanel.tsx", import.meta.url),
  "utf8"
);

describe("writer panel accessible relationships", () => {
  it("connects the country region, writer detail, tabs, and tab panels", () => {
    expect(panelSource).toContain('aria-labelledby={countryHeadingId}');
    expect(panelSource).toContain('aria-labelledby={writerDetailHeadingId}');
    expect(panelSource).toContain('role="tablist"');
    expect(panelSource).toContain('role="tab"');
    expect(panelSource).toContain('role="tabpanel"');
    expect(panelSource).toContain("aria-controls={detailPanelId(view)}");
    expect(panelSource).toContain("tabIndex={detailView === view ? 0 : -1}");
    expect(panelSource).toContain("onKeyDown={handleDetailTabKeyDown}");
  });

  it("keeps empty states explicit and honors reduced motion", () => {
    expect(panelSource).toContain("!hasWriterWorks");
    expect(panelSource).toContain("!hasWriterSources && !hasWriterRelatedArticles");
    expect(panelSource).toContain('prefers-reduced-motion: reduce');
    expect(panelSource).not.toContain('className="country-panel" aria-live');
  });
});
