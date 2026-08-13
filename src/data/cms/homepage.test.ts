import { describe, expect, it } from "vitest";

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
