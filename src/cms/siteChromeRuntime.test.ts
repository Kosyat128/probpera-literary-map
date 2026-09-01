import { describe, expect, it } from "vitest";

import {
  buildCmsNavigationForest,
  cmsBannerIsActiveAt,
  cmsBannerMatchesPath,
  cmsPagePatternMatches,
  normalizeCmsPathname,
  type CmsNavigationNode,
} from "./siteChromeRuntime";

function flatten(nodes: readonly CmsNavigationNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...flatten(node.children)]);
}

describe("CMS navigation runtime", () => {
  it("keeps editorial hierarchy and stable sibling order", () => {
    const forest = buildCmsNavigationForest([
      { id: "child-b", parentId: "root", label: "Б", href: "/b", displayOrder: 20 },
      { id: "root", label: "Раздел", href: "/section", displayOrder: 10 },
      { id: "child-a", parentId: "root", label: "А", href: "/a", displayOrder: 10 },
      { id: "first", label: "Первый", href: "/first", displayOrder: 0 },
    ]);

    expect(forest.map((node) => node.id)).toEqual(["first", "root"]);
    expect(forest[1]?.children.map((node) => node.id)).toEqual([
      "child-a",
      "child-b",
    ]);
  });

  it("publishes orphans and breaks cycles without hiding or duplicating items", () => {
    const forest = buildCmsNavigationForest([
      { id: "a", parentId: "b", label: "А", href: "/a", displayOrder: 1 },
      { id: "b", parentId: "a", label: "Б", href: "/b", displayOrder: 2 },
      { id: "child", parentId: "a", label: "Дочерний", href: "/child", displayOrder: 1 },
      { id: "orphan", parentId: "missing", label: "Сирота", href: "/orphan", displayOrder: 3 },
      { id: "self", parentId: "self", label: "Сам", href: "/self", displayOrder: 4 },
    ]);

    expect(new Set(flatten(forest))).toEqual(
      new Set(["a", "b", "child", "orphan", "self"])
    );
    expect(flatten(forest)).toHaveLength(5);
    expect(forest.find((node) => node.id === "a")?.children[0]?.id).toBe(
      "child"
    );
  });
});

describe("CMS banner route matching", () => {
  it("normalizes the deployed base path, encoding and trailing slash", () => {
    expect(
      normalizeCmsPathname(
        "/probpera-literary-map/stranitsy/%D0%BE-%D0%BD%D0%B0%D1%81/",
        "/probpera-literary-map/"
      )
    ).toBe("/stranitsy/о-нас");
  });

  it("treats root and exact patterns as exact routes", () => {
    expect(cmsPagePatternMatches("/", "/")).toBe(true);
    expect(cmsPagePatternMatches("/", "/stati")).toBe(false);
    expect(cmsPagePatternMatches("/stati", "/stati/")).toBe(true);
    expect(cmsPagePatternMatches("/stati", "/stati/slug")).toBe(false);
  });

  it("supports global and segment-safe prefix globs", () => {
    expect(cmsPagePatternMatches("*", "/anything")).toBe(true);
    expect(cmsPagePatternMatches("/*", "/anything")).toBe(true);
    expect(cmsPagePatternMatches("/stati/*", "/stati")).toBe(true);
    expect(cmsPagePatternMatches("/stati/*", "/stati/slug")).toBe(true);
    expect(cmsPagePatternMatches("/stati/*", "/statistika")).toBe(false);
  });

  it("matches exported patterns against a base-prefixed browser pathname", () => {
    expect(
      cmsBannerMatchesPath(
        ["/stranitsy/*", "/stati/*"],
        "/probpera-literary-map/stati/example",
        "/probpera-literary-map/"
      )
    ).toBe(true);
    expect(
      cmsBannerMatchesPath(
        ["/"],
        "/probpera-literary-map/stati/example",
        "/probpera-literary-map/"
      )
    ).toBe(false);
  });
});

describe("CMS banner scheduling", () => {
  const startsAt = "2026-09-01T09:00:00.000Z";
  const endsAt = "2026-09-01T10:00:00.000Z";

  it("uses an inclusive start and exclusive end like the public RLS policy", () => {
    expect(
      cmsBannerIsActiveAt({ startsAt, endsAt }, new Date(startsAt))
    ).toBe(true);
    expect(
      cmsBannerIsActiveAt(
        { startsAt, endsAt },
        new Date("2026-09-01T09:30:00.000Z")
      )
    ).toBe(true);
    expect(cmsBannerIsActiveAt({ startsAt, endsAt }, new Date(endsAt))).toBe(
      false
    );
  });

  it("hides banners before and after their configured window", () => {
    expect(
      cmsBannerIsActiveAt(
        { startsAt, endsAt },
        new Date("2026-09-01T08:59:59.999Z")
      )
    ).toBe(false);
    expect(
      cmsBannerIsActiveAt(
        { startsAt, endsAt },
        new Date("2026-09-01T10:00:00.001Z")
      )
    ).toBe(false);
  });

  it("supports open windows and fails closed for malformed boundaries", () => {
    expect(cmsBannerIsActiveAt({}, new Date(startsAt))).toBe(true);
    expect(
      cmsBannerIsActiveAt({ startsAt: "not-a-timestamp" }, new Date(startsAt))
    ).toBe(false);
    expect(
      cmsBannerIsActiveAt({ endsAt: "not-a-timestamp" }, new Date(startsAt))
    ).toBe(false);
  });
});
