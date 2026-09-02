import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildCollisionTriage, collisionExceptionIds, validateCollisionTriage } from "./book-external-collision-adjudication.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const load = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

describe("book external collision triage", () => {
  it("covers all quarantined cross-writer identities without taking a production action", async () => {
    const [audit, snapshot, triage] = await Promise.all([
      load("reports/book-database-audit.json"),
      load("data/book-collision-snapshots/openlibrary-work-metadata-2026-09-02.json"),
      load("data/book-external-collision-triage.json"),
    ]);
    expect(triage.decisionCount).toBe(97);
    expect(triage.decisions).toHaveLength(97);
    expect(triage.decisions.every((decision) => decision.productionAction === "none")).toBe(true);
    expect(triage.decisions.every((decision) => decision.reviewStatus === "independent-source-review-required")).toBe(true);
    expect(validateCollisionTriage({ audit, snapshot, triage })).toEqual([]);
  });

  it("separates named authorship exceptions from composite import noise", async () => {
    const [audit, snapshot] = await Promise.all([
      load("reports/book-database-audit.json"),
      load("data/book-collision-snapshots/openlibrary-work-metadata-2026-09-02.json"),
    ]);
    const triage = buildCollisionTriage({ audit, snapshot, reviewedAt: "2026-09-02" });
    expect(new Set(collisionExceptionIds).size).toBe(11);
    expect(triage.decisions.find((decision) => decision.externalId === "openlibrary:OL110951W")?.classification).toBe("joint-authored-work");
    expect(triage.decisions.find((decision) => decision.externalId === "openlibrary:OL7910140W")?.expectedDisposition).toBe("consolidate-with-disputed-authorship");
    expect(triage.classifications["composite-edition-or-contributor-import"]).toBe(86);
  });
});
