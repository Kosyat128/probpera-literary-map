import { describe, expect, it } from "vitest";
import { createBookDossierGraphFixture } from "../../scripts/lib/book-dossier-graph-fixture";
import { buildBookDossierDiagram, bookDossierDiagramPreview, bookDossierConceptKind } from "./bookDossierDiagram";
import { toBookEditorialDocument } from "./bookDossierLegacyAdapter";
import { getBookInspectionPageLayout, layoutBookInspectionDocument } from "./bookInspectionPageLayout";
import { BookDossierTypographyTokens } from "./bookTypography";

describe("public dossier symbolic map", () => {
  it("keeps only filtered character endpoints, full labels, groups and semantic anchors", async () => {
    const { document } = await createBookDossierGraphFixture();
    const page = document.pages.find(page => page.sectionId === "graph-context")!;
    const diagram = buildBookDossierDiagram(document, page)!;
    expect(diagram.nodes).toHaveLength(3);
    expect(diagram.groups).toHaveLength(2);
    expect(diagram.edges).toHaveLength(2);
    expect(JSON.stringify(diagram)).not.toContain("character-hidden");
    expect(diagram.nodes.every(node => node.anchor.itemId === node.item.id)).toBe(true);
    expect(diagram.edges.every(edge => diagram.nodes.includes(edge.from) && diagram.nodes.includes(edge.to))).toBe(true);
    const preview = bookDossierDiagramPreview(diagram, 2);
    expect(preview.nodes).toHaveLength(2);
    expect(preview.totalNodes).toBe(3);
    expect(preview.nodes[0].label).toBe(diagram.nodes[0].item.label);
    expect(preview.edges.every(edge => preview.nodes.some(node => node.number === edge.from) && preview.nodes.some(node => node.number === edge.to))).toBe(true);
  });
  it("never creates nodes for malformed cross-kind or dangling public references", async () => {
    const { document } = await createBookDossierGraphFixture();
    const page = document.pages.find(page => page.sectionId === "graph-context")!;
    const poisoned = { ...page, blocks: page.blocks.map(block => block.kind === "relationships" ? { ...block,
      items: block.items.map((item, index) => ({ ...item, toId: index ? "concept-theme" : "unavailable-character" })) } : block) };
    const changed = { ...document, pages: document.pages.map(candidate => candidate === page ? poisoned : candidate) };
    expect(buildBookDossierDiagram(changed, poisoned)!.edges).toHaveLength(0);
    expect(bookDossierConceptKind("motif")).toBe("motif");
    expect(bookDossierConceptKind("arbitrary editorial group")).toBeNull();
  });
  it("paginates an actual bounded diagram and retains all source items outside its visual preview", async () => {
    const { document } = await createBookDossierGraphFixture();
    const source = toBookEditorialDocument(document);
    const result = layoutBookInspectionDocument(source, (text, role) => text.length * BookDossierTypographyTokens[role].size * .45, { maximumPages: 36 });
    expect(result.status, result.issues.join("; ")).toBe("ready");
    const rendered = result.document!.pages.filter(page => page.sectionId === "graph-context");
    const drawings = rendered.flatMap(page => getBookInspectionPageLayout(page)!.diagram || []);
    expect(drawings).toHaveLength(1);
    expect(drawings[0].preview.nodes).toHaveLength(3);
    expect(drawings[0].preview.edges).toHaveLength(2);
    expect(drawings[0].x).toBeGreaterThanOrEqual(132);
    expect(drawings[0].y + drawings[0].height).toBeLessThan(1800);
    expect(rendered[0].anchor).toEqual(source.pages.find(page => page.sectionId === "graph-context")!.anchor);
    expect(rendered[0].rows.some(row => row.id === "relation-ab")).toBe(true);
    expect(result.sourceDocument).toBe(source);
  });
});
