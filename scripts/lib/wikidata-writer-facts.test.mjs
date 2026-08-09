import { describe, expect, it } from "vitest";

import {
  buildSnapshot,
  normalizeEntity,
  normalizeStatement,
  serializeSnapshot,
} from "../refresh-wikidata-writer-facts.mjs";

function statement({
  id,
  property,
  rank = "normal",
  value,
  type,
  snaktype = "value",
  references = [],
}) {
  return {
    id,
    rank,
    references,
    mainsnak: {
      property,
      snaktype,
      ...(snaktype === "value"
        ? {
            datavalue: {
              type,
              value,
            },
          }
        : {}),
    },
  };
}

describe("Wikidata writer-facts snapshot", () => {
  it("preserves time precision, calendar, rank, claim ID, and reference counts", () => {
    const normalized = normalizeStatement(
      "P569",
      statement({
        id: "Q1$birth",
        property: "P569",
        rank: "preferred",
        type: "time",
        value: {
          time: "+1901-00-00T00:00:00Z",
          precision: 9,
          calendarmodel: "http://www.wikidata.org/entity/Q1985727",
        },
        references: [{}, {}],
      })
    );

    expect(normalized).toEqual({
      claimId: "Q1$birth",
      rank: "preferred",
      referenced: true,
      referenceCount: 2,
      time: "+1901-00-00T00:00:00Z",
      precision: 9,
      calendarmodel: "http://www.wikidata.org/entity/Q1985727",
    });
  });

  it("keeps compact entity values and excludes deprecated statements", () => {
    const kept = statement({
      id: "Q1$occupation",
      property: "P106",
      type: "wikibase-entityid",
      value: { id: "Q49757", "entity-type": "item", "numeric-id": 49757 },
    });
    const deprecated = statement({
      id: "Q1$old-occupation",
      property: "P106",
      rank: "deprecated",
      type: "wikibase-entityid",
      value: { id: "Q36180", "entity-type": "item", "numeric-id": 36180 },
    });

    const entity = normalizeEntity("Q1", {
      id: "Q1",
      lastrevid: 123,
      modified: "2026-08-09T00:00:00Z",
      labels: {
        en: { language: "en", value: "Test Writer" },
        ru: { language: "ru", value: "Тестовый писатель" },
        fr: { language: "fr", value: "Écrivain test" },
      },
      descriptions: {
        en: { language: "en", value: "test writer" },
        ru: { language: "ru", value: "test writer in Russian" },
        fr: { language: "fr", value: "auteur test" },
      },
      claims: { P106: [deprecated, kept] },
    });

    expect(entity).toEqual({
      qid: "Q1",
      lastrevid: 123,
      modified: "2026-08-09T00:00:00Z",
      labels: {
        en: "Test Writer",
        ru: "Тестовый писатель",
      },
      descriptions: {
        en: "test writer",
        ru: "test writer in Russian",
      },
      claims: {
        P106: [
          {
            claimId: "Q1$occupation",
            rank: "normal",
            referenced: false,
            referenceCount: 0,
            entityId: "Q49757",
          },
        ],
      },
    });
  });

  it("sorts QIDs numerically and serializes the same structured input deterministically", () => {
    const input = {
      curatedWriterKeys: 3,
      qids: ["Q10", "Q2", "Q1"],
      entitiesByQid: {
        Q1: { id: "Q1", claims: {} },
        Q2: { id: "Q2", claims: {} },
        Q10: { id: "Q10", missing: "" },
      },
      retrievedAt: "2026-08-09T00:00:00.000Z",
    };

    const first = buildSnapshot(input);
    const second = buildSnapshot(input);
    expect(first.entities.map((entity) => entity.qid)).toEqual(["Q1", "Q2", "Q10"]);
    expect(first.missingQids).toEqual(["Q10"]);
    expect(first.counts).toMatchObject({
      curatedWriterKeys: 3,
      requestedQids: 3,
      returnedEntities: 2,
      missingEntities: 1,
    });
    expect(serializeSnapshot(first)).toBe(serializeSnapshot(second));
  });
});
