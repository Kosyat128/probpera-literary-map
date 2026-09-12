import { describe, expect, it } from "vitest";
import { coreSectionTitle } from "./coreSectionTitle";

import {
  coreHomepageSectionClass,
  type CoreHomepageSection,
} from "./homepage";

function section(
  backgroundStyle: CoreHomepageSection["backgroundStyle"],
  backgroundImageUrl = ""
): CoreHomepageSection {
  return {
    key: "atlas",
    title: "",
    eyebrow: "",
    description: "",
    buttonText: "",
    buttonUrl: "",
    backgroundStyle,
    backgroundImageUrl,
  };
}

describe("core homepage CMS background", () => {
  it("exposes the selected background style as a public section class", () => {
    expect(coreHomepageSectionClass(section("orange"))).toContain("is-orange");
    expect(coreHomepageSectionClass(section("orange"))).toContain(
      "cms-core-editable"
    );
  });

  it("adds the image class only when a CMS background image exists", () => {
    expect(coreHomepageSectionClass(section("paper"))).not.toContain(
      "has-cms-background"
    );
    expect(
      coreHomepageSectionClass(section("paper", "https://example.com/bg.webp"))
    ).toContain("has-cms-background");
  });
});

describe("library name in saved homepage content", () => {
  it("replaces the legacy default and handles an empty saved title", () => {
    for (const title of ["Книжный архив", " Книжный архив ", "", null]) {
      expect(coreSectionTitle("book-archive", title)).toBe("Библиотека «Проба Пера»");
    }
  });

  it("preserves custom editorial titles and titles of other sections", () => {
    expect(coreSectionTitle("book-archive", "Редкие издания")).toBe("Редкие издания");
    expect(coreSectionTitle("hero", "Книжный архив")).toBe("Книжный архив");
  });
});
