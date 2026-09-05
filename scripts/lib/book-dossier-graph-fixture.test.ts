import { describe, expect, it } from "vitest";
import { createBookDossierGraphFixture } from "./book-dossier-graph-fixture";
import { parsePublishedBookDossier } from "../../src/books/bookDossierDelivery";

describe("public graph fixture delivery", () => {
  it("keeps endpoint IDs and explicit groups while omitting edges to hidden characters", async () => {
    const { document, now } = await createBookDossierGraphFixture();
    const parsed = parsePublishedBookDossier(document, now)!;
    expect(parsed).not.toBeNull();
    const blocks = parsed.pages.flatMap(page => page.blocks);
    expect(blocks.filter(block => block.kind === "characters").map(block => block.title)).toEqual(["Учебная группа", "Гости"]);
    const edges = blocks.find(block => block.kind === "relationships")!.items;
    expect(edges.map(item => [item.id, item.fromId, item.toId])).toEqual([
      ["relation-ab", "character-a", "character-b"], ["relation-ac", "character-a", "character-c"],
    ]);
    expect(JSON.stringify(parsed)).not.toContain("character-hidden");
    expect(blocks.find(block => block.kind === "themes")!.items.map(item => item.value)).toEqual(["theme", "motif", "symbol"]);
  });

  it("reveals a relationship only with its approved endpoint in the explicit after-reading variant", async () => {
    const { document, now } = await createBookDossierGraphFixture({ readingMode: "AFTER_READING", revealSpoilers: "ENDING" });
    const parsed = parsePublishedBookDossier(document, now)!;
    expect(parsed).not.toBeNull();
    const blocks = parsed.pages.flatMap(page => page.blocks);
    const nodes = blocks.filter(block => block.kind === "characters").flatMap(block => block.items);
    expect(nodes.some(item => item.id === "character-hidden")).toBe(true);
    expect(blocks.find(block => block.kind === "relationships")!.items.find(item => item.id === "relation-hidden")?.toId).toBe("character-hidden");
    expect(JSON.stringify(parsed)).not.toContain("private-test-evidence");
  });
});
