import { describe, expect, it } from "vitest";

import {
  buildLegacyArticleWithdrawals,
  normalizeLegacyArticleWithdrawals,
  partitionRedirectsByWithdrawnDestination,
} from "./cms-legacy-withdrawals.mjs";

const cmsId = (suffix) =>
  `cms-00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;

describe("CMS legacy article withdrawals", () => {
  it("records a verified CMS withdrawal instead of resurrecting its static fallback", () => {
    const retired = cmsId("14");
    expect(
      buildLegacyArticleWithdrawals({
        candidateArticles: [],
        baseline: {
          articles: [
            {
              id: retired,
              legacyId: "page--article--page--books--14",
              legacyPath: "/read/page-article/page-books/14/",
              canonicalUrl:
                "https://probpera.ru/stati/mnenie-o-knige/mnenie-o-knige-devida-mitchella-pod-znakom-chernogo-lebedya/",
            },
          ],
        },
        removedIds: [retired],
      })
    ).toEqual([
      {
        cmsId: retired,
        canonicalPath:
          "/stati/mnenie-o-knige/mnenie-o-knige-devida-mitchella-pod-znakom-chernogo-lebedya",
        legacyId: "page--article--page--books--14",
        legacyPath: "/read/page-article/page-books/14",
      },
    ]);
  });

  it("carries a deployed tombstone forward until the article is republished", () => {
    const retired = cmsId("14");
    const withdrawal = {
      cmsId: retired,
      canonicalPath: "/stati/mnenie-o-knige/withdrawn",
      legacyId: "page--article--page--books--14",
    };
    const baseline = { articles: [], withdrawnLegacyArticles: [withdrawal] };
    expect(
      buildLegacyArticleWithdrawals({
        candidateArticles: [],
        baseline,
        removedIds: [],
      })
    ).toEqual([withdrawal]);
    expect(
      buildLegacyArticleWithdrawals({
        candidateArticles: [
          { id: retired, legacyId: "page--article--page--books--14" },
        ],
        baseline,
        removedIds: [],
      })
    ).toEqual([]);
  });

  it("tracks CMS-only withdrawals and clears a canonical reused by an active article", () => {
    const retired = cmsId("15");
    const canonicalPath = "/stati/obzor/cms-only";
    const baseline = {
      articles: [
        {
          id: retired,
          canonicalUrl: `https://probpera.ru${canonicalPath}/`,
        },
      ],
    };
    const withdrawal = buildLegacyArticleWithdrawals({
      candidateArticles: [],
      baseline,
      removedIds: [retired],
    });
    expect(withdrawal).toEqual([{ cmsId: retired, canonicalPath }]);
    expect(
      buildLegacyArticleWithdrawals({
        candidateArticles: [
          {
            id: cmsId("16"),
            canonicalUrl: `https://probpera.ru${canonicalPath}`,
          },
        ],
        baseline: { articles: [], withdrawnLegacyArticles: withdrawal },
        removedIds: [],
      })
    ).toEqual([]);
  });

  it("fails closed on malformed or ambiguous deployed tombstones", () => {
    expect(() => normalizeLegacyArticleWithdrawals([{ cmsId: "bad" }])).toThrow(
      "invalid CMS article identity"
    );
    const duplicate = {
      cmsId: cmsId("1"),
      canonicalPath: "/stati/mnenie-o-knige/first",
      legacyId: "legacy-1",
    };
    expect(() =>
      normalizeLegacyArticleWithdrawals([
        duplicate,
        {
          ...duplicate,
          cmsId: cmsId("2"),
          canonicalPath: "/stati/mnenie-o-knige/second",
        },
      ])
    ).toThrow("duplicate legacy article");
    expect(() =>
      normalizeLegacyArticleWithdrawals([
        { cmsId: cmsId("3"), legacyId: "legacy-3" },
      ])
    ).toThrow("no valid canonical article path");
  });

  it("blocks redirects to a withdrawn canonical while retaining unrelated redirects", () => {
    const canonicalPath =
      "/stati/mnenie-o-knige/mnenie-o-knige-devida-mitchella-pod-znakom-chernogo-lebedya";
    const staleRedirect = {
      sourcePath:
        "/stati/mnenie-o-knige/mnenie-o-knige-devida-mitchella-pod-znakom-chernogo-lebedya-1dn9k1",
      destinationPath: canonicalPath,
    };
    const unrelatedRedirect = {
      sourcePath: "/stati/old",
      destinationPath: "/stati/current",
    };

    expect(
      partitionRedirectsByWithdrawnDestination(
        [staleRedirect, unrelatedRedirect],
        [
          {
            cmsId: cmsId("14"),
            canonicalPath,
            legacyId: "page--article--page--books--14",
          },
        ]
      )
    ).toEqual({ allowed: [unrelatedRedirect], blocked: [staleRedirect] });
  });
});
