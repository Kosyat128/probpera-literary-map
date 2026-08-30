import { describe, expect, it } from "vitest";

import {
  isMediaPurgeConfirmed,
  isOrphanCleanupConfirmed,
  mediaSnapshotSetsMatch,
  parseBulkMediaMetadataPatch,
  parseMediaVersionSnapshots,
} from "./media-bulk-operations";

const first = {
  id: "11111111-1111-4111-8111-111111111111",
  updatedAt: "2026-08-30T10:20:30.000Z",
};
const second = {
  id: "22222222-2222-4222-8222-222222222222",
  updatedAt: "2026-08-30T10:21:30.000Z",
};

describe("Media Studio bulk operations", () => {
  it("parses a bounded, versioned and duplicate-free selection", () => {
    expect(parseMediaVersionSnapshots([JSON.stringify(first), JSON.stringify(second)]))
      .toEqual({ success: true, data: [first, second] });
    expect(parseMediaVersionSnapshots([JSON.stringify(first), JSON.stringify(first)]).success)
      .toBe(false);
    expect(parseMediaVersionSnapshots([]).success).toBe(false);
  });

  it("builds only explicitly enabled metadata fields", () => {
    expect(parseBulkMediaMetadataPatch({
      apply_creator: "1",
      creator: "  Государственный архив  ",
      source_url: "javascript:alert(1)",
      apply_rights_status: "1",
      rights_status: "verified",
    })).toEqual({
      success: true,
      data: { creator: "Государственный архив", rights_status: "verified" },
    });
  });

  it("rejects unsafe enabled URLs and empty patches", () => {
    expect(parseBulkMediaMetadataPatch({
      apply_source_url: "1",
      source_url: "javascript:alert(1)",
    }).success).toBe(false);
    expect(parseBulkMediaMetadataPatch({ creator: "ignored" }).success).toBe(false);
  });

  it("matches the exact preview snapshot independent of row order", () => {
    expect(mediaSnapshotSetsMatch([first, second], [second, first])).toBe(true);
    expect(mediaSnapshotSetsMatch([first], [{ ...first, updatedAt: second.updatedAt }]))
      .toBe(false);
  });

  it("requires the exact explicit cleanup confirmation", () => {
    expect(isOrphanCleanupConfirmed("MOVE_UNUSED_TO_TRASH")).toBe(true);
    expect(isOrphanCleanupConfirmed("on")).toBe(false);
  });

  it("requires the exact Russian permanent-purge phrase", () => {
    expect(isMediaPurgeConfirmed("УДАЛИТЬ ФАЙЛ НАВСЕГДА")).toBe(true);
    expect(isMediaPurgeConfirmed("удалить файл навсегда")).toBe(false);
    expect(isMediaPurgeConfirmed(" УДАЛИТЬ ФАЙЛ НАВСЕГДА ")).toBe(false);
  });
});
