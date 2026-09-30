import { selectWriterDisplayName } from "../../../src/data/bookLocalization";
import { contentRecordHash } from "../../../src/planet/contentExportHash";
import {
  getBookyJourneyActivityChecksum, resolveBookyJourneyActivity,
  type BookyJourneyActivityPublicData, type BookyJourneyActivitySpec,
} from "../../../src/host/bookyJourneyActivity";
import {
  parseBookyJourneyDraft,
  type BookyJourneyDraft, type JourneyDraftCatalog, type JourneyDraftError,
} from "./booky-journey-draft";

export type JourneyDraftActivityValidationResult =
  | Readonly<{ ok: true; draftChecksum: string }>
  | Readonly<{ ok: false; errors: readonly JourneyDraftError[] }>;

export type JourneyDraftActivityEvaluationResult =
  | Readonly<{ ok: true; draftChecksum: string; choiceId: string; correct: boolean }>
  | Extract<JourneyDraftActivityValidationResult, { ok: false }>;

function rejected(field: string, message: string): Extract<JourneyDraftActivityValidationResult, { ok: false }> {
  return Object.freeze({ ok: false as const,
    errors: Object.freeze([Object.freeze({ field, message })]) });
}

/** Keep the source-field and label rules of bookyJourney.ts activityChoices.
 * A catalog label alone cannot attest the current public writer's source shape.
 * No getters or newly authored names supply a different identity. */
function validateChoiceLabels(spec: BookyJourneyActivitySpec, draft: BookyJourneyDraft,
  publicData: BookyJourneyActivityPublicData): Extract<JourneyDraftActivityValidationResult, { ok: false }> | null {
  const selected = draft.authoringSource.selection.activityChoices;
  if (!selected || selected.length !== spec.choices.length)
    return rejected("activity.choices", "Не удалось связать варианты задания с каноническими записями.");
  for (const locale of ["ru", "en"] as const) {
    const labels = new Set<string>();
    for (const [index, choice] of spec.choices.entries()) {
      const country = publicData.publicCountries.find(item => item.id === choice.writer.countryId);
      const writer = country?.writers.find(item => item.id === choice.writer.writerId);
      const source = selected[index];
      const field = `activity.choices.${index}.${locale}`;
      if (!writer || !source || source.country.id !== choice.writer.countryId
        || source.writer.id !== choice.writer.writerId)
        return rejected(field, "Вариант задания больше не соответствует текущему публичному писателю.");
      const names: { id: string; name?: string; fullName?: string } = { id: choice.writer.writerId };
      for (const name of ["name", "fullName"] as const) {
        const descriptor = Object.getOwnPropertyDescriptor(writer, name);
        if (!descriptor) continue;
        if (!descriptor.enumerable || !("value" in descriptor))
          return rejected(field, "Каноническое имя варианта недоступно для проверки.");
        if (descriptor.value === undefined) continue;
        if (typeof descriptor.value !== "string" || descriptor.value.length > 200
          || /[\u0000-\u001f\u007f]/u.test(descriptor.value))
          return rejected(field, "Каноническое имя варианта не соответствует схеме задания.");
        names[name] = descriptor.value;
      }
      const label = selectWriterDisplayName(names, locale, "");
      const normalized = label.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(locale);
      if (!normalized || labels.has(normalized))
        return rejected(field, locale === "en"
          ? "Для задания нужны подтверждённые разные английские имена всех вариантов."
          : "Для задания нужны разные канонические русские имена всех вариантов.");
      labels.add(normalized);
      if (source.writer.label[locale] !== label)
        return rejected(field, "Имя варианта изменилось в текущем публичном каталоге. Откройте каталог заново.");
    }
  }
  return null;
}

/** Current, read-only semantic validation of one adult draft activity.
 * The digest is only a response binding for the caller's current operation.
 * It is not saved, a review receipt, an answer key or admission authority. */
export function validateBookyJourneyDraftActivity(serializedDraft: string, catalog: JourneyDraftCatalog,
  publicData: BookyJourneyActivityPublicData): JourneyDraftActivityValidationResult {
  try {
    const parsed = parseBookyJourneyDraft(serializedDraft, catalog);
    if (!parsed.ok) return Object.freeze({ ok: false as const,
      errors: Object.freeze(parsed.errors.map(error => Object.freeze({ ...error }))) });
    const { draft } = parsed;
    if (!draft.authoringSource.input.activity)
      return rejected("activity", "Добавьте задание перед его серверной проверкой.");
    const definitions = (["ru", "en"] as const).map(locale =>
      draft.definitions.filter(definition => definition.locale === locale));
    if (definitions.some(items => items.length !== 1))
      return rejected("activity", "Заданию нужны два исходных маршрута RU и EN.");
    const nodes = definitions.map(items => items[0].nodes.filter(node => node.kind === "activity"));
    if (nodes.some(items => items.length !== 1 || items[0].entity !== null || items[0].screen !== "globe"))
      return rejected("activity", "В каждом языке требуется одно каноническое задание.");
    const ru = nodes[0][0].activity, en = nodes[1][0].activity;
    const checksum = getBookyJourneyActivityChecksum(ru);
    if (!ru || !en || !checksum || checksum !== getBookyJourneyActivityChecksum(en)
      || nodes[0][0].id !== nodes[1][0].id
      || ru.targetWork.countryId !== draft.authoringSource.input.countryId
      || ru.targetWork.writerId !== draft.authoringSource.input.writerId
      || ru.targetWork.workId !== draft.authoringSource.input.workId)
      return rejected("activity", "Задания RU и EN должны связывать одну выбранную книгу и одинаковые варианты.");
    const resolved = resolveBookyJourneyActivity(ru, publicData);
    if (!resolved || resolved.definitionChecksum !== checksum)
      return rejected("activity", "Текущий публичный каталог не подтверждает единственный ответ для этого задания.");
    const labelError = validateChoiceLabels(resolved.spec, draft, publicData);
    if (labelError) return labelError;
    return Object.freeze({ ok: true as const, draftChecksum: contentRecordHash(draft) });
  } catch {
    return rejected("activity", "Не удалось проверить задание. Предпросмотр и экспорт не подтверждены.");
  }
}

/** Evaluate only the explicitly selected current option in an unapproved draft.
 * The boolean is temporary preview feedback, never completion, review, a saved
 * answer, or authority to publish/admit the route. No answer key leaves here. */
export function evaluateBookyJourneyDraftActivity(serializedDraft: string, choiceId: string,
  catalog: JourneyDraftCatalog, publicData: BookyJourneyActivityPublicData): JourneyDraftActivityEvaluationResult {
  try {
    if (typeof choiceId !== "string" || choiceId.length > 96 || /[\u0000-\u001f\u007f]/u.test(choiceId)
      || !/^[a-z][a-z0-9._:-]{0,95}$/.test(choiceId))
      return rejected("activity.choiceId", "Выберите существующий вариант задания с корректным ID длиной до 96 символов.");
    const validated = validateBookyJourneyDraftActivity(serializedDraft, catalog, publicData);
    if (!validated.ok) return validated;
    const parsed = parseBookyJourneyDraft(serializedDraft, catalog);
    if (!parsed.ok) return Object.freeze({ ok: false as const,
      errors: Object.freeze(parsed.errors.map(error => Object.freeze({ ...error }))) });
    const { draft } = parsed;
    if (contentRecordHash(draft) !== validated.draftChecksum)
      return rejected("activity", "Черновик изменился во время проверки. Выберите вариант заново.");
    const spec = draft.definitions.find(definition => definition.locale === "ru")?.nodes
      .find(node => node.kind === "activity")?.activity;
    if (!spec || !spec.choices.some(choice => choice.id === choiceId))
      return rejected("activity.choiceId", "Выбранный вариант отсутствует в текущем задании.");
    // Derive current credit again; a previous semantic check supplies no answer
    // authority after a public work/credit change, even within this operation.
    const resolved = resolveBookyJourneyActivity(spec, publicData);
    if (!resolved || resolved.definitionChecksum !== getBookyJourneyActivityChecksum(spec))
      return rejected("activity", "Текущий публичный каталог не подтверждает ответ для этого задания.");
    const labelError = validateChoiceLabels(resolved.spec, draft, publicData);
    if (labelError) return labelError;
    return Object.freeze({ ok: true as const, draftChecksum: validated.draftChecksum, choiceId,
      correct: resolved.correctChoiceId === choiceId });
  } catch {
    return rejected("activity", "Не удалось проверить выбранный ответ. Выберите вариант и повторите действие.");
  }
}
