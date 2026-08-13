import { describe, expect, it } from "vitest";

import {
  isManagedCmsArticleSnapshotName,
  staleManagedCmsArticleSnapshotNames,
} from "./cms-article-snapshot-files.mjs";

const current = "cms-42ac59ff-eca6-4fbc-836b-a1f9ebcb8faa.json";
const stale = "cms-bf8881fc-b705-407d-af19-2ff9a14d2720.json";

describe("CMS article snapshot cleanup", () => {
  it("recognizes only UUID-backed CMS article documents", () => {
    expect(isManagedCmsArticleSnapshotName(current)).toBe(true);
    expect(isManagedCmsArticleSnapshotName("legacy-article.json")).toBe(false);
    expect(isManagedCmsArticleSnapshotName("cms-user-note.json")).toBe(false);
    expect(isManagedCmsArticleSnapshotName("../cms-42ac59ff-eca6-4fbc-836b-a1f9ebcb8faa.json")).toBe(false);
  });

  it("removes a withdrawn CMS document but preserves current and unmanaged files", () => {
    expect(
      staleManagedCmsArticleSnapshotNames(
        [stale, "legacy-article.json", current, "cms-user-note.json"],
        [current]
      )
    ).toEqual([stale]);
  });
});
