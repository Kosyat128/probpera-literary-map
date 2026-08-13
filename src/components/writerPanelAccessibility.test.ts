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
    expect(panelSource).toContain("!hasWriterAwards");
    expect(panelSource).toContain("!hasWriterSources && !hasWriterRelatedArticles");
    expect(panelSource).toContain('className="writer-source-empty" role="status"');
    expect(panelSource).toContain('prefers-reduced-motion: reduce');
    expect(panelSource).not.toContain('className="country-panel" aria-live');
  });

  it("labels editorial groups, source links, and record statuses", () => {
    expect(panelSource).toContain("activeWriterWorkGroups.map");
    expect(panelSource).toContain("activeWriterAwardGroups.map");
    expect(panelSource).toContain("aria-labelledby={groupHeadingId}");
    expect(panelSource).toContain("data-editorial-status={work.status}");
    expect(panelSource).toContain("data-editorial-status={award.status}");
    expect(panelSource).toContain('target="_blank"');
    expect(panelSource).toContain('rel="noreferrer"');
    expect(panelSource).toContain('t("Открыть источник")');
    expect(panelSource).not.toContain("activeWriterWorks.slice(0, 8)");
  });
});
