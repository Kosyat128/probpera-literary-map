import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panelSource = readFileSync(
  new URL("./WriterPanel.tsx", import.meta.url),
  "utf8"
);
const profileSource = readFileSync(
  new URL("./WriterProfile.tsx", import.meta.url),
  "utf8"
);
const cardSource = readFileSync(
  new URL("./WriterCard.tsx", import.meta.url),
  "utf8"
);

describe("public writer biography views", () => {
  it.each([
    ["WriterPanel", panelSource],
    ["WriterProfile", profileSource],
    ["WriterCard", cardSource],
  ])("uses the safe display selector in %s", (_name, source) => {
    expect(source).toContain("selectWriterBiographyForDisplay");
    expect(source).not.toContain('from "../data/writerBiography"');
  });

  it("derives the panel status from the biography publication result", () => {
    expect(panelSource).toContain("writerBiographyPublicStatus");
    expect(panelSource).toContain("activeWriterStatus");
    expect(panelSource).toContain('data-biography-status={activeWriterStatus.code}');
    expect(panelSource).not.toMatch(
      /activeWriter\.editorial[\s\S]{0,300}data-biography-status/u
    );
  });

  it("shows sources only from a published biography", () => {
    expect(panelSource).toMatch(
      /activeWriterBiography\?\.kind === "published"[\s\S]*activeWriterBiography\.sources\.length/u
    );
    expect(profileSource).toMatch(
      /biography\?\.kind === "published" && biography\.sources\.length/u
    );
  });
});
