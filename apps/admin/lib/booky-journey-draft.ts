import {
  bookyJourneyDialogueContext, bookyJourneyEntityId, getBookyJourneyChecksum,
  type BookyJourneyDefinition, type BookyJourneyNode,
} from "../../../src/host/bookyJourney";
import {
  getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord,
} from "../../../src/host/bookyDialogueRegistry";
import { getBookyJourneyActivityChecksum, type BookyJourneyActivitySpec } from "../../../src/host/bookyJourneyActivity";
import { contentRecordHash, contentTextHash } from "../../../src/planet/contentExportHash";
import type { ContentEntityRef } from "../../../src/planet/contentExportTypes";

export type JourneyDraftCatalog = {
  countries: readonly {
    id: string; label: { ru: string; en: string };
    writers: readonly {
      id: string; label: { ru: string; en: string };
      works: readonly { id: string; label: { ru: string; en: string } }[];
    }[];
  }[];
};
export type JourneyDraftInput = {
  id: string; version: number; countryId: string; writerId: string; workId: string;
  ageRange: { min: number; max: number };
  readingLevel: "plain" | "developing" | "fluent";
  estimatedDurationMinutes: number;
  copy: Record<"ru" | "en", {
    title: string; description: string;
    nodes: Record<"country" | "writer" | "work" | "checkpoint", { title: string; body: string }>;
  }>;
  activity?: JourneyDraftActivityInput;
};
export type JourneyDraftActivityInput = {
  type: "match-work-author";
  choices: readonly { countryId: string; writerId: string }[];
  copy: Record<"ru" | "en", { title: string; body: string }>;
};
export type JourneyDraftError = Readonly<{ field: string; message: string }>;
export type JourneyDraftReviewIssue = Readonly<{
  field: "countryId" | "writerId";
  code: "canonical-english-label-missing";
  message: string;
}>;
type SelectedEntity = Readonly<{ id: string; label: Readonly<{ ru: string; en: string }> }>;
export type JourneyDraftActivityChoiceSnapshot = Readonly<{ country: SelectedEntity; writer: SelectedEntity }>;
export type JourneyDraftAuthoringSource = Readonly<{
  schemaVersion: 1;
  input: JourneyDraftInput;
  selection: Readonly<{
    country: SelectedEntity; writer: SelectedEntity; work: SelectedEntity;
    activityChoices?: readonly JourneyDraftActivityChoiceSnapshot[];
  }>;
}>;
export type BookyJourneyDraft = Readonly<{
  schemaVersion: 1; status: "draft";
  authoringSource: JourneyDraftAuthoringSource;
  authoringSourceChecksum: string;
  definitions: readonly BookyJourneyDefinition[];
  definitionsChecksums: readonly Readonly<{ locale: "ru" | "en"; checksum: string }>[];
  dialogues: readonly BookyDialogueRecord[];
  blockingReviewIssues: readonly JourneyDraftReviewIssue[];
  journeyApprovals: readonly never[];
  dialogueApprovals: readonly never[];
  currentVersions: readonly never[];
  availability: readonly never[];
  releaseReady: false; humanReviewed: false; childApproved: false; narrationApproved: false;
}>;
export type JourneyDraftResult =
  | Readonly<{ ok: true; draft: BookyJourneyDraft }>
  | Readonly<{ ok: false; errors: readonly JourneyDraftError[] }>;
export type JourneyDraftParseResult =
  | Readonly<{ ok: true; input: JourneyDraftInput; draft: BookyJourneyDraft }>
  | Readonly<{ ok: false; errors: readonly JourneyDraftError[] }>;

export const BOOKY_JOURNEY_DRAFT_MAX_BYTES = 524288;

const LOCALES = ["ru", "en"] as const;
const NODE_KINDS = ["country", "writer", "work", "checkpoint"] as const;
const integer = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
const entityId = (value: unknown): value is string => typeof value === "string"
  && value.length > 0 && value.length <= 200 && !/[\s\u0000-\u001f\u007f]/u.test(value);
function text(value: unknown, max: number, paragraphs = false): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && value.trim() === value
    && !(paragraphs ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u : /[\u0000-\u001f\u007f]/u).test(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function ownDataKeys(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== fields.length) return false;
  return fields.every(field => {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    return !!descriptor?.enumerable && "value" in descriptor;
  });
}
function activityInput(value: unknown): JourneyDraftActivityInput | null {
  try {
    if (!ownDataKeys(value, ["type", "choices", "copy"]) || value.type !== "match-work-author"
      || !Array.isArray(value.choices) || Object.getPrototypeOf(value.choices) !== Array.prototype
      || value.choices.length < 2 || value.choices.length > 4
      || Reflect.ownKeys(value.choices).length !== value.choices.length + 1
      || !ownDataKeys(value.copy, LOCALES)) return null;
    for (let index = 0; index < value.choices.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value.choices, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor)
        || !ownDataKeys(descriptor.value, ["countryId", "writerId"])
        || !entityId(descriptor.value.countryId) || !entityId(descriptor.value.writerId)) return null;
    }
    for (const locale of LOCALES) {
      const copy = value.copy[locale];
      if (!ownDataKeys(copy, ["title", "body"]) || !text(copy.title, 160) || !text(copy.body, 1600, true)) return null;
    }
    return value as unknown as JourneyDraftActivityInput;
  } catch { return null; }
}

/** Authoring only. The injected catalog must already be a public-eligible view;
 * this model neither grants publication rights nor supplies missing translations. */
export function createBookyJourneyDraft(input: JourneyDraftInput, catalog: JourneyDraftCatalog): JourneyDraftResult {
  const errors: JourneyDraftError[] = [];
  const fail = (field: string, message: string) => { errors.push({ field, message }); };
  const rejected = (): JourneyDraftResult => freeze({ ok: false as const, errors });
  if (!input || typeof input !== "object") {
    fail("input", "Заполните параметры маршрута.");
    return rejected();
  }
  if (typeof input.id !== "string" || !/^[a-z][a-z0-9_-]{0,47}$/.test(input.id))
    fail("id", "ID: от 1 до 48 латинских строчных букв, цифр, дефисов или подчёркиваний; первая — буква.");
  if (!integer(input.version, 1, 1_000_000)) fail("version", "Версия должна быть целым числом от 1 до 1000000.");
  for (const field of ["countryId", "writerId", "workId"] as const)
    if (!entityId(input[field])) fail(field, "Выберите существующую запись каталога.");
  if (!integer(input.ageRange?.min, 18, 120) || !integer(input.ageRange?.max, input.ageRange?.min ?? 18, 120))
    fail("ageRange", "Укажите взрослый возрастной диапазон от 18 до 120 лет; максимум не меньше минимума.");
  if (!["plain", "developing", "fluent"].includes(input.readingLevel))
    fail("readingLevel", "Выберите уровень чтения.");
  if (!integer(input.estimatedDurationMinutes, 1, 1440))
    fail("estimatedDurationMinutes", "Укажите оценку длительности целым числом от 1 до 1440 минут.");
  for (const locale of LOCALES) {
    const copy = input.copy?.[locale];
    if (!text(copy?.title, 200)) fail(`copy.${locale}.title`, "Заполните название маршрута: до 200 символов без внешних пробелов и переносов строк.");
    if (!text(copy?.description, 800)) fail(`copy.${locale}.description`, "Заполните описание: до 800 символов без внешних пробелов и переносов строк.");
    for (const kind of NODE_KINDS) {
      if (!text(copy?.nodes?.[kind]?.title, 160)) fail(`copy.${locale}.nodes.${kind}.title`, "Заполните название шага: до 160 символов без внешних пробелов и переносов строк.");
      if (!text(copy?.nodes?.[kind]?.body, 1600, true)) fail(`copy.${locale}.nodes.${kind}.body`, "Заполните текст шага: до 1600 символов без внешних пробелов.");
    }
  }
  const activityDescriptor = Object.getOwnPropertyDescriptor(input, "activity");
  const activity = activityDescriptor?.enumerable && "value" in activityDescriptor
    ? activityInput(activityDescriptor.value) : undefined;
  if (activityDescriptor && !activity) {
    fail("activity", "Задание должно содержать тип match-work-author, от двух до четырёх канонических вариантов и тексты RU/EN без лишних полей.");
    return rejected();
  }
  if (!catalog || !Array.isArray(catalog.countries)) {
    fail("catalog", "Канонический каталог недоступен.");
    return rejected();
  }
  const validateLabel = (label: SelectedEntity["label"] | undefined, field: string) => {
    if (!text(label?.ru, 2000) || !(label?.en === "" || text(label?.en, 2000)))
      fail(field, "Сохраните исходные RU/EN названия каталога; отсутствующее EN название обозначается пустой строкой.");
  };
  const countryIds = new Set<string>();
  for (const [ci, country] of catalog.countries.entries()) {
    const field = `catalog.countries.${ci}`;
    if (!country || !entityId(country.id) || countryIds.has(country.id)) {
      fail(field, "ID страны отсутствует или повторяется."); continue;
    }
    countryIds.add(country.id); validateLabel(country.label, `${field}.label`);
    if (!Array.isArray(country.writers)) { fail(`${field}.writers`, "Список писателей недоступен."); continue; }
    const writerIds = new Set<string>();
    for (const [wi, writer] of country.writers.entries()) {
      const writerField = `${field}.writers.${wi}`;
      if (!writer || !entityId(writer.id) || writerIds.has(writer.id)) {
        fail(writerField, "ID писателя отсутствует или повторяется в этой стране."); continue;
      }
      writerIds.add(writer.id); validateLabel(writer.label, `${writerField}.label`);
      if (!Array.isArray(writer.works)) { fail(`${writerField}.works`, "Список книг недоступен."); continue; }
      const workIds = new Set<string>();
      for (const [bi, work] of writer.works.entries()) {
        if (!work || !entityId(work.id) || workIds.has(work.id)) {
          fail(`${writerField}.works.${bi}`, "ID книги отсутствует или повторяется у этого писателя."); continue;
        }
        workIds.add(work.id); validateLabel(work.label, `${writerField}.works.${bi}.label`);
      }
    }
  }
  // IDs remain scoped to their actual canonical parents; no cross-writer lookup.
  const country = catalog.countries.find(item => item?.id === input.countryId);
  const writer = country && Array.isArray(country.writers) ? country.writers.find((item: JourneyDraftCatalog["countries"][number]["writers"][number]) => item?.id === input.writerId) : undefined;
  const work = writer && Array.isArray(writer.works) ? writer.works.find((item: JourneyDraftCatalog["countries"][number]["writers"][number]["works"][number]) => item?.id === input.workId) : undefined;
  if (!country) fail("countryId", "Выбранная страна отсутствует в каноническом каталоге.");
  if (!writer) fail("writerId", "Выбранный писатель не принадлежит этой стране.");
  if (!work) fail("workId", "Выбранная книга не принадлежит этому писателю.");
  else if (!text(work.label?.en, 2000)) fail("workId", "Для выбранной книги требуется подтверждённое EN название.");
  const activitySelections: JourneyDraftActivityChoiceSnapshot[] = [];
  if (activity) {
    const tuples = new Set<string>(), labels = { ru: new Set<string>(), en: new Set<string>() };
    for (const [index, choice] of activity.choices.entries()) {
      const field = `activity.choices.${index}`, tuple = JSON.stringify([choice.countryId, choice.writerId]);
      if (tuples.has(tuple)) { fail(field, "Варианты задания должны ссылаться на разных канонических писателей."); continue; }
      tuples.add(tuple);
      const choiceCountry = catalog.countries.find(item => item?.id === choice.countryId);
      const choiceWriter = choiceCountry && Array.isArray(choiceCountry.writers)
        ? choiceCountry.writers.find((item: JourneyDraftCatalog["countries"][number]["writers"][number]) => item?.id === choice.writerId) : undefined;
      if (!choiceCountry || !choiceWriter) { fail(field, "Писатель варианта отсутствует в выбранной канонической стране."); continue; }
      if (bookyJourneyEntityId({ kind: "writer", countryId: choiceCountry.id, writerId: choiceWriter.id }).length > 200)
        fail(field, "Канонический идентификатор варианта превышает предел реестра.");
      for (const locale of LOCALES) {
        const label = choiceWriter.label?.[locale];
        if (!text(label, 200)) { fail(`${field}.label.${locale}`, "Для каждого варианта требуется исходное подтверждённое имя писателя RU/EN длиной до 200 символов."); continue; }
        const normalized = label.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase(locale);
        if (!normalized || labels[locale].has(normalized)) fail(`${field}.label.${locale}`, "Имена вариантов должны различаться в каждом языке после нормализации пробелов и регистра.");
        labels[locale].add(normalized);
      }
      activitySelections.push({ country: choiceCountry, writer: choiceWriter });
    }
  }
  if (errors.length || !country || !writer || !work) return rejected();

  const refs: Record<(typeof NODE_KINDS)[number], ContentEntityRef | null> = {
    country: { kind: "country", countryId: country.id },
    writer: { kind: "writer", countryId: country.id, writerId: writer.id },
    work: { kind: "work", countryId: country.id, writerId: writer.id, workId: work.id },
    checkpoint: null,
  };
  if (Object.values(refs).some(ref => ref && bookyJourneyEntityId(ref).length > 200)) {
    fail("catalog", "Канонический идентификатор выбранной цепочки превышает предел реестра.");
    return rejected();
  }
  const copySnapshot = (locale: "ru" | "en") => ({
    title: input.copy[locale].title, description: input.copy[locale].description,
    nodes: {
      country: { ...input.copy[locale].nodes.country }, writer: { ...input.copy[locale].nodes.writer },
      work: { ...input.copy[locale].nodes.work }, checkpoint: { ...input.copy[locale].nodes.checkpoint },
    },
  });
  const selected = (entity: SelectedEntity): SelectedEntity => ({ id: entity.id, label: { ru: entity.label.ru, en: entity.label.en } });
  const authoringSource: JourneyDraftAuthoringSource = {
    schemaVersion: 1,
    input: {
      id: input.id, version: input.version, countryId: input.countryId, writerId: input.writerId, workId: input.workId,
      ageRange: { min: input.ageRange.min, max: input.ageRange.max }, readingLevel: input.readingLevel,
      estimatedDurationMinutes: input.estimatedDurationMinutes, copy: { ru: copySnapshot("ru"), en: copySnapshot("en") },
      ...(activity ? { activity: {
        type: activity.type, choices: activity.choices.map(choice => ({ countryId: choice.countryId, writerId: choice.writerId })),
        copy: { ru: { title: activity.copy.ru.title, body: activity.copy.ru.body }, en: { title: activity.copy.en.title, body: activity.copy.en.body } },
      } } : {}),
    },
    selection: { country: selected(country), writer: selected(writer), work: selected(work),
      ...(activity ? { activityChoices: activitySelections.map(choice => ({ country: selected(choice.country), writer: selected(choice.writer) })) } : {}),
    },
  };
  // A routing owner is not an answer key. Current factual authorship is checked
  // separately by the staff server against the authorized public data.
  const activitySpec: BookyJourneyActivitySpec | undefined = activity ? {
    schemaVersion: 1, id: `${input.id}.match-author`, version: input.version, type: "match-work-author",
    targetWork: { kind: "work", countryId: country.id, writerId: writer.id, workId: work.id },
    choices: activity.choices.map((choice, index) => ({ id: `choice-${index + 1}`, writer: { kind: "writer", countryId: choice.countryId, writerId: choice.writerId } })),
  } : undefined;
  if (activitySpec && !getBookyJourneyActivityChecksum(activitySpec)) {
    fail("activity", "Задание не соответствует канонической схеме сопоставления книги и автора.");
    return rejected();
  }
  const authoringSourceChecksum = contentRecordHash(authoringSource);
  const blockingReviewIssues: JourneyDraftReviewIssue[] = [];
  if (country.label.en === "") blockingReviewIssues.push({ field: "countryId", code: "canonical-english-label-missing", message: "Английское название страны пока не подтверждено." });
  if (writer.label.en === "") blockingReviewIssues.push({ field: "writerId", code: "canonical-english-label-missing", message: "Английское имя писателя пока не подтверждено." });
  const definitions: BookyJourneyDefinition[] = [];
  const definitionsChecksums: { locale: "ru" | "en"; checksum: string }[] = [];
  const dialogues: BookyDialogueRecord[] = [];
  const nodeKinds = activitySpec ? ["country", "writer", "work", "activity", "checkpoint"] as const : NODE_KINDS;
  for (const locale of LOCALES) {
    const nodes: BookyJourneyNode[] = [];
    for (const kind of nodeKinds) {
      const node: BookyJourneyNode = {
        id: kind, kind, entity: kind === "activity" ? null : refs[kind], screen: kind === "country" || kind === "writer" || kind === "activity" ? "globe" : "collection",
        dialogue: { id: `${input.id}.${kind}`, version: input.version, contentChecksum: "" },
        ...(kind === "activity" ? { activity: activitySpec! } : {}),
      };
      const context = bookyJourneyDialogueContext(input.id, node);
      const copy = kind === "activity" ? authoringSource.input.activity!.copy[locale] : authoringSource.input.copy[locale].nodes[kind];
      if (!context) { fail("id", "ID маршрута несовместим с контекстом диалога."); return rejected(); }
      const payload: BookyDialoguePayload = {
        id: node.dialogue.id, version: input.version, locale, audience: "adult",
        ageRange: { ...authoringSource.input.ageRange }, readingLevel: input.readingLevel,
        intent: kind === "activity" ? "activity" : "navigation", screens: [node.screen], context,
        entityIds: kind === "activity" ? [...new Set([activitySpec!.targetWork, ...activitySpec!.choices.map(choice => choice.writer)]
          .map(bookyJourneyEntityId))] : node.entity ? [bookyJourneyEntityId(node.entity)] : [],
        claimKind: "interface-guidance", factualSources: [],
        copy: { title: copy.title, body: copy.body, caption: copy.title, reduced: copy.title },
        narration: null, prohibitedTags: [],
        provenance: {
          kind: "editorial", sourcePath: "authoringSource", sourceVersion: 1,
          sourceRef: kind === "activity" ? `/input/activity/copy/${locale}` : `/input/copy/${locale}/nodes/${kind}`,
          sourceSha256: authoringSourceChecksum, copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })),
        },
      };
      const contentChecksum = getBookyDialogueContentChecksum(payload);
      if (!contentChecksum) { fail(`copy.${locale}.nodes.${kind}`, "Диалог не соответствует схеме реестра."); return rejected(); }
      const review = { status: "draft" as const, reviewer: null, reviewedAt: null, contentChecksum };
      const checksum = getBookyDialogueChecksum({ payload, review });
      if (!checksum) { fail(`copy.${locale}.nodes.${kind}`, "Не удалось связать draft диалог с его контрольной суммой."); return rejected(); }
      dialogues.push({ payload, review, checksum });
      nodes.push({ ...node, dialogue: { ...node.dialogue, contentChecksum } });
    }
    const definition: BookyJourneyDefinition = {
      schemaVersion: 1, id: input.id, version: input.version, locale, audience: "adult",
      ageRange: { ...authoringSource.input.ageRange }, readingLevel: input.readingLevel,
      title: authoringSource.input.copy[locale].title,
      overview: { description: authoringSource.input.copy[locale].description, estimatedDurationMinutes: input.estimatedDurationMinutes },
      prerequisites: [], nodes,
    };
    const checksum = getBookyJourneyChecksum(definition);
    if (!checksum) { fail(`copy.${locale}`, "Маршрут не соответствует схеме канонического плана."); return rejected(); }
    definitions.push(definition); definitionsChecksums.push({ locale, checksum });
  }
  return freeze({ ok: true as const, draft: {
    schemaVersion: 1 as const, status: "draft" as const, authoringSource, authoringSourceChecksum,
    definitions, definitionsChecksums, dialogues, blockingReviewIssues,
    journeyApprovals: [], dialogueApprovals: [], currentVersions: [], availability: [],
    releaseReady: false as const, humanReviewed: false as const, childApproved: false as const, narrationApproved: false as const,
  } });
}

/** Reopen only an exact draft rebuilt against the current canonical catalog.
 * Matching hashes bind the snapshot; they do not constitute human review. */
export function parseBookyJourneyDraft(text: string, catalog: JourneyDraftCatalog): JourneyDraftParseResult {
  const rejected = (field: string, message: string): JourneyDraftParseResult =>
    freeze({ ok: false as const, errors: [{ field, message }] });
  try {
    if (typeof text !== "string" || text.length === 0)
      return rejected("file", "Файл черновика пуст или не содержит текст JSON.");
    // Check code units first so oversized text is rejected before UTF-8 allocation.
    if (text.length > BOOKY_JOURNEY_DRAFT_MAX_BYTES
      || new TextEncoder().encode(text).byteLength > BOOKY_JOURNEY_DRAFT_MAX_BYTES)
      return rejected("file", "Размер файла черновика превышает 512 КиБ.");
    let imported: unknown;
    try { imported = JSON.parse(text); }
    catch { return rejected("file", "Файл черновика должен содержать корректный JSON."); }
    const record = (value: unknown): value is Record<string, unknown> => !!value
      && typeof value === "object" && !Array.isArray(value)
      && [Object.prototype, null].includes(Object.getPrototypeOf(value));
    const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
      record(value) && Object.keys(value).length === keys.length
      && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
    if (!record(imported) || imported.schemaVersion !== 1 || imported.status !== "draft")
      return rejected("file", "Откройте объект черновика JSON версии 1 со статусом draft.");
    if (!record(imported.authoringSource) || imported.authoringSource.schemaVersion !== 1)
      return rejected("authoringSource", "В файле отсутствует исходная форма черновика версии 1.");
    const input = imported.authoringSource.input;
    const inputFields = ["id", "version", "countryId", "writerId", "workId", "ageRange",
      "readingLevel", "estimatedDurationMinutes", "copy"];
    const hasActivity = record(input) && Object.prototype.hasOwnProperty.call(input, "activity");
    if (!exactKeys(input, hasActivity ? [...inputFields, "activity"] : inputFields) || !exactKeys(input.ageRange, ["min", "max"])
      || !exactKeys(input.copy, LOCALES))
      return rejected("authoringSource.input", "Исходная форма черновика содержит лишние или отсутствующие поля.");
    if (hasActivity && !activityInput(input.activity))
      return rejected("activity", "Задание содержит неверные, лишние или отсутствующие поля либо неполные тексты RU/EN.");
    for (const locale of LOCALES) {
      const copy = input.copy[locale];
      if (!exactKeys(copy, ["title", "description", "nodes"]) || !exactKeys(copy.nodes, NODE_KINDS))
        return rejected(`copy.${locale}`, "Языковая форма черновика содержит лишние или отсутствующие поля.");
      for (const kind of NODE_KINDS) {
        if (!exactKeys(copy.nodes[kind], ["title", "body"]))
          return rejected(`copy.${locale}.nodes.${kind}`, "Текст шага должен содержать только название и подсказку.");
      }
    }
    const compiled = createBookyJourneyDraft(input as unknown as JourneyDraftInput, catalog);
    if (!compiled.ok) return compiled;
    if (contentRecordHash(imported) !== contentRecordHash(compiled.draft))
      return rejected("file", "Черновик изменён или не соответствует текущему каталогу. Откройте исходный экспорт и проверьте канонические записи.");
    return freeze({ ok: true as const, input: compiled.draft.authoringSource.input, draft: compiled.draft });
  } catch {
    return rejected("file", "Не удалось проверить черновик. Текущая форма не изменена.");
  }
}
