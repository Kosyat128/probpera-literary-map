import type { BookDossierDraft, BookDossierProgressStep } from "./bookDossierDocument";

/** Ordered public prefix only: never disclose an unreached/spoiler checkpoint name or ID. */
export function bookDossierReadingSteps(draft: BookDossierDraft): readonly BookDossierProgressStep[] {
  const safeSections = new Set(draft.sections.filter(section => section.spoiler === "NONE").map(section => section.id));
  const safeItems = new Map(draft.blocks.filter(block => safeSections.has(block.sectionId) && block.spoiler === "NONE" &&
    block.readingModes.includes("BEFORE_READING") && !block.availableAfterItemId).flatMap(block => block.items
    .filter(item => item.spoiler === "NONE" && !item.fromId && !item.toId).map(item => [item.id, item.label] as const)));
  const steps: BookDossierProgressStep[] = [];
  const seen = new Set<string>();
  for (const block of draft.blocks) {
    const id = block.availableAfterItemId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const label = safeItems.get(id);
    if (!label || steps.length >= 24) break;
    steps.push({ id, label });
  }
  return steps;
}
