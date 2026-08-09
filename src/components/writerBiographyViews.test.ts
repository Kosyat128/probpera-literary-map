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

  it("does not render any public biography or editorial status marker", () => {
    expect(panelSource).not.toContain("writer-biography-notice");
    expect(profileSource).not.toContain("writer-biography-notice");
    expect(panelSource).not.toContain(
      "Архивная справка · не проверено редакцией"
    );
    expect(profileSource).not.toContain(
      "Архивная справка · не проверено редакцией"
    );
    expect(panelSource).not.toContain("Проверено редакцией");
    expect(panelSource).not.toContain("Редакционная карточка");
    expect(panelSource).not.toContain(
      "Справочная карточка · требует расширения"
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
