import type { BookDossierDocumentV2, BookDossierItem, BookDossierPage, BookDossierPublicSource, BookDossierSemanticAnchor } from "./bookDossierDocument";

export type BookDossierDiagramNode = Readonly<{
  item: BookDossierItem; number: number; groupId: string; groupLabel: string; groupIndex: number;
  anchor: BookDossierSemanticAnchor; sources: readonly BookDossierPublicSource[];
}>;
export type BookDossierDiagramEdge = Readonly<{
  item: BookDossierItem; from: BookDossierDiagramNode; to: BookDossierDiagramNode;
  anchor: BookDossierSemanticAnchor; sources: readonly BookDossierPublicSource[];
}>;
export type BookDossierDiagram = Readonly<{
  title: string; anchor: BookDossierSemanticAnchor;
  nodes: readonly BookDossierDiagramNode[]; edges: readonly BookDossierDiagramEdge[];
  groups: readonly Readonly<{ id: string; label: string; index: number }>[];
}>;
export type BookDossierDiagramPreview = Readonly<{
  nodes: readonly Readonly<{ id: string; number: number; label: string; groupIndex: number }>[];
  edges: readonly Readonly<{ from: number; to: number; label: string }>[];
  groups: readonly Readonly<{ id: string; label: string; index: number }>[];
  totalNodes: number;
}>;

/** Consume only the already-filtered public projection; never infer missing people. */
export function buildBookDossierDiagram(document: Pick<BookDossierDocumentV2, "pages">, page: BookDossierPage): BookDossierDiagram | null {
  if (!["characters", "relationships"].includes(page.template)) return null;
  const blocks = document.pages.flatMap(candidate => candidate.blocks);
  const characterBlocks = blocks.filter(block => block.kind === "characters");
  const allNodes = new Map<string, BookDossierDiagramNode>();
  characterBlocks.forEach((block, groupIndex) => block.items.forEach(item => {
    if (allNodes.has(item.id) || item.fromId || item.toId) return;
    allNodes.set(item.id, { item, number: allNodes.size + 1, groupId: block.id, groupLabel: block.title, groupIndex,
      anchor: { ...block.anchor, itemId: item.id }, sources: block.sources.filter(source => item.sourceIds.includes(source.id)) });
  }));
  const localNodes = new Set(page.blocks.filter(block => block.kind === "characters").flatMap(block => block.items.map(item => item.id)));
  const edges: BookDossierDiagramEdge[] = [];
  for (const block of blocks.filter(candidate => candidate.kind === "relationships")) for (const item of block.items) {
    if (!item.fromId || !item.toId) continue;
    const from = allNodes.get(item.fromId), to = allNodes.get(item.toId);
    if (!from || !to) continue;
    if (block.sectionId !== page.sectionId && !localNodes.has(from.item.id) && !localNodes.has(to.item.id)) continue;
    edges.push({ item, from, to, anchor: { ...block.anchor, itemId: item.id }, sources: block.sources.filter(source => item.sourceIds.includes(source.id)) });
  }
  const relevant = new Set([...localNodes, ...edges.flatMap(edge => [edge.from.item.id, edge.to.item.id])]);
  const nodes = [...allNodes.values()].filter(node => relevant.has(node.item.id));
  if (!nodes.length) return null;
  return { title: page.title, anchor: page.anchor, nodes, edges,
    groups: characterBlocks.flatMap((block, index) => nodes.some(node => node.groupId === block.id) ? [{ id: block.id, label: block.title, index }] : []) };
}

export function bookDossierDiagramPreview(diagram: BookDossierDiagram, maximumNodes = 4): BookDossierDiagramPreview {
  const nodes = diagram.nodes.slice(0, Math.min(8, Math.max(1, maximumNodes)));
  const ids = new Set(nodes.map(node => node.item.id));
  return { totalNodes: diagram.nodes.length,
    nodes: nodes.map(node => ({ id: node.item.id, number: node.number, label: node.item.label, groupIndex: node.groupIndex })),
    edges: diagram.edges.filter(edge => ids.has(edge.from.item.id) && ids.has(edge.to.item.id)).map(edge => ({ from: edge.from.number, to: edge.to.number, label: edge.item.label })),
    groups: diagram.groups.filter(group => nodes.some(node => node.groupId === group.id)) };
}

export function bookDossierDiagramHeight(count: number) { return count > 6 ? 400 : 300; }

export function bookDossierDiagramPoint(index: number, count: number) {
  const columns = count === 1 ? 1 : 2;
  const rows = Math.ceil(count / columns);
  const height = bookDossierDiagramHeight(count);
  return { x: columns === 1 ? 200 : 100 + (index % columns) * 200, y: rows === 1 ? height / 2 : 60 + Math.floor(index / columns) * ((height - 120) / (rows - 1)) };
}

export function bookDossierConceptKind(value?: string) {
  const candidate = value?.trim().toLowerCase();
  return candidate === "theme" || candidate === "motif" || candidate === "symbol" ? candidate : null;
}

export const bookDossierConceptLabels = {
  ru: { theme: "Тема", motif: "Мотив", symbol: "Символ" },
  en: { theme: "Theme", motif: "Motif", symbol: "Symbol" },
} as const;
