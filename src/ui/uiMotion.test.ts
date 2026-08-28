import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const writerPanelSource = readFileSync(
  new URL("../components/WriterPanel.tsx", import.meta.url),
  "utf8"
);

function motionToken(name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)ms`, "u"));
  if (!match) throw new Error(`Missing motion token: ${name}`);
  return Number(match[1]);
}

describe("Stage 5E common UI motion", () => {
  it("defines bounded MICRO, STANDARD and PANEL tiers", () => {
    expect([
      motionToken("ui-motion-micro-min"),
      motionToken("ui-motion-micro"),
      motionToken("ui-motion-micro-max"),
    ]).toEqual([80, 120, 160]);
    expect([
      motionToken("ui-motion-standard-min"),
      motionToken("ui-motion-standard"),
      motionToken("ui-motion-standard-max"),
    ]).toEqual([160, 200, 240]);
    expect([
      motionToken("ui-motion-panel-min"),
      motionToken("ui-motion-panel"),
      motionToken("ui-motion-panel-max"),
    ]).toEqual([220, 280, 320]);
  });

  it("keeps idle decoration static while retaining interaction motion", () => {
    expect(css).not.toMatch(
      /animation:\s*(?:social-invite|social-glint|archive-subscribe-shine)/u
    );
    expect(css).toContain(".archive-subscribe:hover::before");
    expect(css).toContain("opacity var(--ui-transition-fast)");
  });

  it("keeps WriterPanel motion bounded, immediate and reduced-motion safe", () => {
    expect(writerPanelSource).not.toContain('from "gsap"');
    expect(writerPanelSource).not.toContain("setTimeout(");
    expect(writerPanelSource).toContain("const WRITER_PANEL_MOTION_MS = 280");
    expect(writerPanelSource).toContain("const WRITER_DETAIL_MOTION_MS = 200");
    expect(writerPanelSource).toContain('transform: "translateY(6px)"');
    expect(writerPanelSource.indexOf("detail.focus({ preventScroll: true })"))
      .toBeLessThan(writerPanelSource.indexOf("detail.scrollIntoView({"));
    expect(css).toContain("animation: writer-detail-tab-in var(--ui-motion-standard)");
    expect(css).toContain("transform: translateY(6px)");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.writer-detail-tab-panel\s*\{[\s\S]*?animation: none !important;/u
    );
  });

  it("presents biography copy as readable paragraphs across panel sizes", () => {
    expect(writerPanelSource).toContain("activeWriterBiographyParagraphs.map");
    expect(css).toContain("max-width: 62ch");
    expect(css).toContain(".writer-bio p + p");
    expect(css).toContain(".writer-detail-portrait");
    expect(css).toContain("@media (max-width: 480px)");
  });
});
