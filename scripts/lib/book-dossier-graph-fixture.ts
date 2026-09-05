import { bookDossierFixture, bookDossierFixtureDesignProof } from "./book-dossier-fixtures";
import { BOOK_DOSSIER_REVIEW_STAGES, compileBookDossier, type BookDossierCompileOptions } from "../../src/books/bookDossierCompiler";
import type { BookDossierBlock, BookDossierDraft, BookDossierRecord } from "../../src/books/bookDossierDocument";
import { publishBookDossier, reviewBookDossier, saveBookDossierDraft } from "../../src/books/bookDossierWorkflow";

/** Synthetic graph for UI tests only. These names, facts and approvals are not catalogue content. */
export function bookDossierGraphDraftFixture(): BookDossierDraft {
  const base = bookDossierFixture();
  const sectionId = "graph-context";
  const item = (id: string, label: string, value: string) => ({ id, label, value, sourceIds: ["source-one"], spoiler: "NONE" as const });
  const graphBlocks: BookDossierBlock[] = [
    { ...base.blocks[1], id: "graph-team", sectionId, title: "Учебная группа", kind: "characters", rightsId: "graph-team-rights", paragraphs: [],
      items: [item("character-a", "Персонаж А", "Первый участник"), item("character-b", "Персонаж Б", "Второй участник")] },
    { ...base.blocks[1], id: "graph-guests", sectionId, title: "Гости", kind: "characters", rightsId: "graph-guests-rights", paragraphs: [],
      items: [item("character-c", "Персонаж В", "Приглашённый участник"), { ...item("character-hidden", "Скрытый персонаж", "Тестовый спойлер"), spoiler: "LIGHT" }] },
    { ...base.blocks[1], id: "graph-relations", sectionId, title: "Отношения", kind: "relationships", rightsId: "graph-relations-rights", paragraphs: [],
      items: [{ ...item("relation-ab", "Сотрудничество", "Работают вместе"), fromId: "character-a", toId: "character-b" },
        { ...item("relation-ac", "Знакомство", "Встречаются в учебном примере"), fromId: "character-a", toId: "character-c" },
        { ...item("relation-hidden", "Скрытая связь", "Не показывать без второго узла"), fromId: "character-a", toId: "character-hidden" }] },
    { ...base.blocks[1], id: "graph-themes", sectionId, title: "Темы, мотивы и символы", kind: "themes", rightsId: "graph-themes-rights", paragraphs: [],
      items: [{ ...item("concept-theme", "Выбор", "theme"), text: "Синтетический пример темы." },
        { ...item("concept-motif", "Повторение встречи", "motif"), text: "Синтетический пример мотива." },
        { ...item("concept-symbol", "Ключ", "symbol"), text: "Синтетический пример символа." }] },
  ];
  for (const [index, anchor] of ["character-a", "character-b"].entries()) graphBlocks.push({ ...base.blocks[1],
    id: `graph-progress-${index}`, sectionId, title: `Synthetic reading checkpoint ${index + 1}`, kind: "editorial",
    paragraphs: [`Synthetic reading progress detail ${index + 1}.`], items: [],
    rightsId: `graph-progress-rights-${index}`, availableAfterItemId: anchor,
  });
  return { ...base,
    sections: [...base.sections, { id: sectionId, title: "Карта учебного примера", template: "relationships", purpose: "context", spoiler: "NONE", blockIds: graphBlocks.map(block => block.id) }],
    blocks: [...base.blocks, ...graphBlocks],
    rights: [...base.rights, ...graphBlocks.map(block => ({ ...base.rights[1], id: block.rightsId }))],
  };
}

/** Uses the actual local workflow/compiler with explicitly synthetic test attestations. */
export async function createBookDossierGraphFixture(options: Partial<BookDossierCompileOptions> = {}) {
  const now = options.now ?? Date.parse("2026-09-05T10:00:00Z");
  const context = (record: BookDossierRecord | null) => ({ now, actor: { id: "11111111-1111-4111-8111-111111111111", role: "owner" as const }, expectedRevision: record?.revision || 0 });
  const checked = (result: Awaited<ReturnType<typeof saveBookDossierDraft>>) => {
    if (!result.record || result.issues.length) throw new Error(`Synthetic graph fixture: ${JSON.stringify(result.issues)}`);
    return result.record;
  };
  let record = checked(await saveBookDossierDraft(bookDossierGraphDraftFixture(), null, context(null)));
  for (const stage of BOOK_DOSSIER_REVIEW_STAGES) {
    record = checked(await reviewBookDossier(record, stage, "APPROVED", true, { ...context(record),
      ...(stage === "design" ? { designProof: bookDossierFixtureDesignProof(record, now) } : {}) }));
  }
  record = checked(await publishBookDossier(record, context(record)));
  const result = await compileBookDossier(record, { themeVersion: "synthetic-graph-test", ...options, now });
  if (!result.document || result.issues.length) throw new Error(`Synthetic graph projection: ${JSON.stringify(result.issues)}`);
  return { record, document: result.document, now };
}
