import { describe, expect, it } from "vitest";

import {
  authorshipReplacementPayloadsFromArchive,
  authorshipRowsFromArchive,
  groupPublishedAuthorRows,
  publishedWorkAuthorship,
} from "./book-authorship-roundtrip.mjs";

const multipleWork = {
  id: "twelve-chairs",
  countryId: "russia",
  writerId: "routing-author",
  authorship: {
    kind: "multiple",
    authors: [
      { countryId: "russia", writerId: "ilf" },
      {
        countryId: "russia",
        writerId: "petrov",
        creditNames: { ru: "Евгений Петров", en: "Yevgeny Petrov" },
        attribution: "credited",
      },
    ],
  },
};

describe("literary-work authorship persistence round-trip", () => {
  it("round-trips one multiple-author card in stable editorial order", () => {
    const legacyId = "russia:routing-author:twelve-chairs";
    const workIds = new Map([[legacyId, "work-1"]]);
    const rows = authorshipRowsFromArchive([multipleWork], workIds);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.position)).toEqual([0, 1]);
    expect(rows.map((row) => row.writer_id)).toEqual(["ilf", "petrov"]);

    const restored = publishedWorkAuthorship(
      {
        id: "work-1",
        legacy_id: legacyId,
        authorship_kind: "multiple",
      },
      groupPublishedAuthorRows([...rows].reverse())
    );
    expect(restored).toEqual({
      kind: "multiple",
      authors: [
        {
          countryId: "russia",
          writerId: "ilf",
          attribution: "credited",
        },
        {
          countryId: "russia",
          writerId: "petrov",
          creditNames: { ru: "Евгений Петров", en: "Yevgeny Petrov" },
          attribution: "credited",
        },
      ],
    });
  });

  it("preserves legacy fallback, anonymous and traditional authorship distinctly", () => {
    const workStates = new Map([
      ["russia:legacy:legacy-work", {
        id: "legacy-uuid",
        updatedAt: "2026-09-02T10:00:00.000Z",
      }],
      ["world:routing:anonymous-work", {
        id: "anonymous-uuid",
        updatedAt: "2026-09-02T10:01:00.000Z",
      }],
      ["world:routing:traditional-work", {
        id: "traditional-uuid",
        updatedAt: "2026-09-02T10:02:00.000Z",
      }],
    ]);
    const payloads = authorshipReplacementPayloadsFromArchive(
      [
        { countryId: "russia", writerId: "legacy", id: "legacy-work" },
        {
          countryId: "world",
          writerId: "routing",
          id: "anonymous-work",
          authorship: { kind: "anonymous", authors: [] },
        },
        {
          countryId: "world",
          writerId: "routing",
          id: "traditional-work",
          authorship: { kind: "traditional", authors: [] },
        },
      ],
      workStates
    );

    expect(payloads).toEqual([
      {
        workId: "legacy-uuid",
        expectedUpdatedAt: "2026-09-02T10:00:00.000Z",
        kind: null,
        authors: [],
      },
      {
        workId: "anonymous-uuid",
        expectedUpdatedAt: "2026-09-02T10:01:00.000Z",
        kind: "anonymous",
        authors: [],
      },
      {
        workId: "traditional-uuid",
        expectedUpdatedAt: "2026-09-02T10:02:00.000Z",
        kind: "traditional",
        authors: [],
      },
    ]);
    expect(
      publishedWorkAuthorship(
        { id: "legacy-uuid", authorship_kind: null },
        new Map()
      )
    ).toBeUndefined();
    expect(
      publishedWorkAuthorship(
        { id: "anonymous-uuid", authorship_kind: "anonymous" },
        new Map()
      )
    ).toEqual({ kind: "anonymous", authors: [] });
    expect(
      publishedWorkAuthorship(
        { id: "traditional-uuid", authorship_kind: "traditional" },
        new Map()
      )
    ).toEqual({ kind: "traditional", authors: [] });
  });

  it("defaults a linked author country to the legacy routing country", () => {
    const payload = authorshipReplacementPayloadsFromArchive(
      [{
        countryId: "usa",
        writerId: "routing",
        id: "federalist",
        authorship: {
          kind: "single",
          authors: [{ writerId: "hamilton" }],
        },
      }],
      new Map([["usa:routing:federalist", {
        id: "work-federalist",
        updatedAt: "2026-09-02T11:00:00.000Z",
      }]])
    )[0];
    expect(payload.authors[0]).toEqual({
      countryId: "usa",
      writerId: "hamilton",
      attribution: "credited",
    });
  });

  it("fails closed on invalid explicit compositions", () => {
    expect(() =>
      authorshipRowsFromArchive(
        [{
          countryId: "world",
          writerId: "routing",
          id: "broken",
          authorship: { kind: "multiple", authors: [{ writerId: "one" }] },
        }],
        new Map([["world:routing:broken", "broken-uuid"]])
      )
    ).toThrow(/at least two authors/u);
  });
});
