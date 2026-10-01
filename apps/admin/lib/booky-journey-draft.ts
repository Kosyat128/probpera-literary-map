import {
  bookyJourneyDialogueContext, bookyJourneyEntityId, getBookyJourneyChecksum,
  type BookyJourneyDefinition, type BookyJourneyNode, type BookyJourneyPrerequisite,
} from "../../../src/host/bookyJourney";
import {
  getBookyDialogueChecksum, getBookyDialogueContentChecksum,
  type BookyDialoguePayload, type BookyDialogueRecord,
} from "../../../src/host/bookyDialogueRegistry";
import { getBookyJourneyActivityChecksum, type BookyJourneyActivitySpec } from "../../../src/host/bookyJourneyActivity";
import { getBookyJourneyFactChecksum, type BookyJourneyFactSpec } from "../../../src/host/bookyJourneyFact";
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
export type JourneyDraftNodeCopy = { title: string; body: string; caption?: string; reduced?: string };
export type JourneyDraftInput = {
  id: string; version: number; countryId: string; writerId: string; workId: string;
  ageRange: { min: number; max: number };
  readingLevel: "plain" | "developing" | "fluent";
  estimatedDurationMinutes: number;
  copy: Record<"ru" | "en", {
    title: string; description: string;
    nodes: Record<"country" | "writer" | "work" | "checkpoint", JourneyDraftNodeCopy>;
  }>;
  activity?: JourneyDraftActivityInput;
  fact?: JourneyDraftFactInput;
  optionalNodeOrder?: readonly ("sourced-fact" | "activity")[];
  prerequisites?: readonly BookyJourneyPrerequisite[];
  additionalWorks?: readonly JourneyDraftAdditionalWorkInput[];
};
export type JourneyDraftAdditionalWorkInput = {
  workId: string;
  copy: Record<"ru" | "en", JourneyDraftNodeCopy>;
};
export type JourneyDraftActivityInput = {
  type: "match-work-author";
  choices: readonly { countryId: string; writerId: string }[];
  copy: Record<"ru" | "en", JourneyDraftNodeCopy>;
};
export type JourneyDraftFactInput = {
  subject?: "country" | "writer" | "work";
  copy: Record<"ru" | "en", JourneyDraftNodeCopy & {
    sources: readonly { id: string; url: string; accessedAt: string }[];
  }>;
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
    additionalWorks?: readonly Readonly<{ nodeId: string; work: SelectedEntity }>[];
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
export type JourneyDraftPreviewProfileEvaluation = Readonly<{
  status: "matches" | "outside" | "invalid";
  ageMatches: boolean | null;
  readingLevelMatches: boolean | null;
}>;

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

/** Local adult preview only; matching conditions do not admit or approve a journey. */
export function evaluateBookyJourneyDraftPreviewProfile(
  definition: BookyJourneyDefinition, scenario: unknown,
): JourneyDraftPreviewProfileEvaluation {
  const invalid = (): JourneyDraftPreviewProfileEvaluation => freeze({ status: "invalid" as const, ageMatches: null, readingLevelMatches: null });
  try {
    if (!ownDataKeys(scenario, ["age", "readingLevel"]) || !integer(scenario.age, 18, 120)
      || typeof scenario.readingLevel !== "string" || !["plain", "developing", "fluent"].includes(scenario.readingLevel)) return invalid();
    const age = scenario.age as number;
    const ageMatches = age >= definition.ageRange.min && age <= definition.ageRange.max;
    const readingLevelMatches = scenario.readingLevel === definition.readingLevel;
    const status = ageMatches && readingLevelMatches ? "matches" as const : "outside" as const;
    return freeze({ status, ageMatches, readingLevelMatches });
  } catch { return invalid(); }
}

function nodeCopyKeys(value: unknown, extraFields: readonly string[] = []): value is Record<string, unknown> {
  try {
    const optional = ["caption", "reduced"].filter(field => !!value && Object.prototype.hasOwnProperty.call(value, field));
    return ownDataKeys(value, ["title", "body", ...extraFields, ...optional]);
  } catch { return false; }
}
function nodeCopyInput(value: unknown, extraFields: readonly string[] = []): value is Record<string, unknown> {
  return nodeCopyKeys(value, extraFields) && text(value.title, 160) && text(value.body, 1600, true)
    && (!Object.prototype.hasOwnProperty.call(value, "caption") || text(value.caption, 1600, true))
    && (!Object.prototype.hasOwnProperty.call(value, "reduced") || text(value.reduced, 320, true));
}
function nodeCopySnapshot(copy: JourneyDraftNodeCopy): JourneyDraftNodeCopy {
  return { title: copy.title, body: copy.body,
    ...(Object.prototype.hasOwnProperty.call(copy, "caption") ? { caption: copy.caption } : {}),
    ...(Object.prototype.hasOwnProperty.call(copy, "reduced") ? { reduced: copy.reduced } : {}),
  };
}
function payloadCopy(copy: JourneyDraftNodeCopy): BookyDialoguePayload["copy"] {
  return { title: copy.title, body: copy.body, caption: copy.caption ?? copy.title, reduced: copy.reduced ?? copy.title };
}
const additionalWorkNodeId = (index: number) => `work-extra-${index + 1}`;
function additionalWorksInput(value: unknown):
  | { ok: true; works: JourneyDraftAdditionalWorkInput[] }
  | { ok: false; errors: JourneyDraftError[] } {
  const malformed = () => ({ ok: false as const, errors: [{ field: "additionalWorks", message: "Дополнительные книги: от одной до восьми исходных строк с workId и текстами RU/EN, без пропусков, лишних полей или вычисляемых свойств." }] });
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < 1 || value.length > 8
      || Reflect.ownKeys(value).length !== value.length + 1) return malformed();
    const works: JourneyDraftAdditionalWorkInput[] = [], errors: JourneyDraftError[] = [];
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index)), field = `additionalWorks.${index}`;
      if (!descriptor?.enumerable || !("value" in descriptor) || !ownDataKeys(descriptor.value, ["workId", "copy"])) return malformed();
      const row = descriptor.value;
      if (!entityId(row.workId)) errors.push({ field: field + ".workId", message: "Выберите существующую дополнительную книгу этого писателя." });
      if (!ownDataKeys(row.copy, LOCALES)) return malformed();
      for (const locale of LOCALES) {
        const copy = row.copy[locale], copyField = field + ".copy." + locale;
        if (!nodeCopyKeys(copy)) return malformed();
        const names = { title: "Название шага", body: "Подсказка", caption: "Подпись", reduced: "Короткий текст" };
        for (const [key, max, paragraphs] of [["title", 160, false], ["body", 1600, true], ["caption", 1600, true], ["reduced", 320, true]] as const) {
          if ((key === "title" || key === "body" || Object.hasOwn(copy, key)) && !text(copy[key], max, paragraphs))
            errors.push({ field: copyField + "." + key, message: `${names[key]} (${locale.toUpperCase()}): от 1 до ${max} символов без внешних пробелов и неподдерживаемых управляющих символов.` });
        }
      }
      if (errors.length === 0) works.push({ workId: row.workId as string,
        copy: { ru: nodeCopySnapshot(row.copy.ru as JourneyDraftNodeCopy), en: nodeCopySnapshot(row.copy.en as JourneyDraftNodeCopy) } });
    }
    return errors.length ? { ok: false, errors } : { ok: true, works };
  } catch { return malformed(); }
}
function optionalNodeOrderInput(value: unknown, hasFact: boolean, hasActivity: boolean): ("sourced-fact" | "activity")[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
      || value.length < 1 || value.length > 2 || Reflect.ownKeys(value).length !== value.length + 1) return null;
    const order: ("sourced-fact" | "activity")[] = [];
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor)
        || (descriptor.value !== "sourced-fact" && descriptor.value !== "activity") || order.includes(descriptor.value)) return null;
      order.push(descriptor.value);
    }
    return order.length === Number(hasFact) + Number(hasActivity)
      && order.includes("sourced-fact") === hasFact && order.includes("activity") === hasActivity ? order : null;
  } catch { return null; }
}
/** References only: shape and direct self-reference checks do not establish existence or completion. */
function prerequisitesInput(value: unknown, routeId: unknown):
  { ok: true; references: BookyJourneyPrerequisite[] } | { ok: false; errors: JourneyDraftError[] } {
  const malformed = () => ({ ok: false as const, errors: [{ field: "prerequisites",
    message: "Укажите от одной до шестнадцати ссылок с исходными полями ID и версии, без лишних полей и вычисляемых свойств." }] });
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
      || value.length < 1 || value.length > 16 || Reflect.ownKeys(value).length !== value.length + 1) return malformed();
    const references: BookyJourneyPrerequisite[] = [], errors: JourneyDraftError[] = [], ids = new Set<string>();
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor) || !ownDataKeys(descriptor.value, ["id", "version"])) return malformed();
      const id = Object.getOwnPropertyDescriptor(descriptor.value, "id")!.value;
      const version = Object.getOwnPropertyDescriptor(descriptor.value, "version")!.value;
      if (typeof id !== "string" || !/^[a-z][a-z0-9._:-]{0,95}$/.test(id))
        errors.push({ field: `prerequisites.${index}.id`, message: "ID ссылки: от 1 до 96 строчных латинских букв, цифр, точек, дефисов, подчёркиваний или двоеточий; первая — буква." });
      else {
        if (id === routeId) errors.push({ field: `prerequisites.${index}.id`, message: "Маршрут не может ссылаться на себя как на предварительный." });
        if (ids.has(id)) errors.push({ field: `prerequisites.${index}.id`, message: "ID предварительного маршрута уже указан; разные версии одного ID не создают отдельные ссылки." });
        ids.add(id);
      }
      if (!integer(version, 1, 1_000_000)) errors.push({ field: `prerequisites.${index}.version`, message: "Версия ссылки должна быть целым числом от 1 до 1000000." });
      if (typeof id === "string" && integer(version, 1, 1_000_000)) references.push({ id, version: version as number });
    }
    return errors.length ? { ok: false, errors } : { ok: true, references };
  } catch { return malformed(); }
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
      if (!nodeCopyInput(copy)) return null;
    }
    return value as unknown as JourneyDraftActivityInput;
  } catch { return null; }
}

/** Citation metadata is structurally bound to draft copy, not verified here. */
function factInput(value: unknown): JourneyDraftFactInput | null {
  try {
    const hasSubject = !!value && Object.prototype.hasOwnProperty.call(value, "subject");
    if (!ownDataKeys(value, ["copy", ...(hasSubject ? ["subject"] : [])])
      || (hasSubject && !["country", "writer", "work"].includes(value.subject as string))
      || !ownDataKeys(value.copy, LOCALES)) return null;
    for (const locale of LOCALES) {
      const copy = value.copy[locale];
      if (!nodeCopyInput(copy, ["sources"])
        || !Array.isArray(copy.sources) || Object.getPrototypeOf(copy.sources) !== Array.prototype
        || copy.sources.length < 1 || copy.sources.length > 16
        || Reflect.ownKeys(copy.sources).length !== copy.sources.length + 1) return null;
      const ids = new Set<string>();
      for (let index = 0; index < copy.sources.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(copy.sources, String(index));
        if (!descriptor?.enumerable || !("value" in descriptor)
          || !ownDataKeys(descriptor.value, ["id", "url", "accessedAt"])) return null;
        const source = descriptor.value;
        if (typeof source.id !== "string" || !/^[a-z][a-z0-9._:-]{0,95}$/.test(source.id) || ids.has(source.id)
          || !text(source.url, 1000) || typeof source.accessedAt !== "string"
          || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source.accessedAt)
          || !Number.isFinite(Date.parse(source.accessedAt)) || new Date(source.accessedAt).toISOString() !== source.accessedAt) return null;
        const url = new URL(source.url);
        if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return null;
        ids.add(source.id);
      }
    }
    return value as unknown as JourneyDraftFactInput;
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
  const copyDescriptor = Object.getOwnPropertyDescriptor(input, "copy");
  const authoredCopy = copyDescriptor?.enumerable && "value" in copyDescriptor ? copyDescriptor.value : undefined;
  if (!ownDataKeys(authoredCopy, LOCALES)) {
    fail("copy", "Тексты маршрута должны содержать исходные формы RU/EN без лишних полей и вычисляемых свойств.");
    return rejected();
  }
  for (const locale of LOCALES) {
    const copy = authoredCopy[locale];
    if (!ownDataKeys(copy, ["title", "description", "nodes"]) || !ownDataKeys(copy.nodes, NODE_KINDS)) {
      fail(`copy.${locale}`, "Языковая форма должна содержать название, описание и четыре исходных шага без лишних полей.");
      continue;
    }
    if (!text(copy?.title, 200)) fail(`copy.${locale}.title`, "Заполните название маршрута: до 200 символов без внешних пробелов и переносов строк.");
    if (!text(copy?.description, 800)) fail(`copy.${locale}.description`, "Заполните описание: до 800 символов без внешних пробелов и переносов строк.");
    for (const kind of NODE_KINDS) {
      const node = copy.nodes[kind];
      if (!nodeCopyKeys(node)) {
        fail(`copy.${locale}.nodes.${kind}`, "Текст шага должен содержать название и текст, а также необязательные подпись и короткий текст без лишних полей и вычисляемых свойств.");
        continue;
      }
      if (!text(node.title, 160)) fail(`copy.${locale}.nodes.${kind}.title`, "Заполните название шага: до 160 символов без внешних пробелов и переносов строк.");
      if (!text(node.body, 1600, true)) fail(`copy.${locale}.nodes.${kind}.body`, "Заполните текст шага: до 1600 символов без внешних пробелов.");
      if (Object.prototype.hasOwnProperty.call(node, "caption") && !text(node.caption, 1600, true))
        fail(`copy.${locale}.nodes.${kind}.caption`, "Подпись: от 1 до 1600 символов без внешних пробелов и неподдерживаемых управляющих символов.");
      if (Object.prototype.hasOwnProperty.call(node, "reduced") && !text(node.reduced, 320, true))
        fail(`copy.${locale}.nodes.${kind}.reduced`, "Короткий текст: от 1 до 320 символов без внешних пробелов и неподдерживаемых управляющих символов.");
    }
  }
  const activityDescriptor = Object.getOwnPropertyDescriptor(input, "activity");
  const activity = activityDescriptor?.enumerable && "value" in activityDescriptor
    ? activityInput(activityDescriptor.value) : undefined;
  if (activityDescriptor && !activity) {
    fail("activity", "Задание должно содержать тип match-work-author, от двух до четырёх канонических вариантов и тексты RU/EN без лишних полей.");
    return rejected();
  }
  const factDescriptor = Object.getOwnPropertyDescriptor(input, "fact");
  const fact = factDescriptor?.enumerable && "value" in factDescriptor
    ? factInput(factDescriptor.value) : undefined;
  if (factDescriptor && !fact) {
    fail("fact", "Факт должен содержать тексты RU/EN, необязательный объект country, writer или work и от одного до шестнадцати источников каждого языка: уникальный ID, HTTPS URL без учётных данных и дату UTC в формате YYYY-MM-DDTHH:mm:ss.sssZ.");
    return rejected();
  }
  const orderDescriptor = Object.getOwnPropertyDescriptor(input, "optionalNodeOrder");
  const optionalNodeOrder = orderDescriptor?.enumerable && "value" in orderDescriptor
    ? optionalNodeOrderInput(orderDescriptor.value, !!fact, !!activity) : undefined;
  if (orderDescriptor && !optionalNodeOrder) {
    fail("optionalNodeOrder", "Порядок должен содержать каждый включённый необязательный шаг ровно один раз: sourced-fact и/или activity, без лишних полей и вычисляемых свойств.");
    return rejected();
  }
  const prerequisitesDescriptor = Object.getOwnPropertyDescriptor(input, "prerequisites");
  let prerequisites: BookyJourneyPrerequisite[] | undefined;
  if (prerequisitesDescriptor) {
    if (!prerequisitesDescriptor.enumerable || !("value" in prerequisitesDescriptor)) {
      fail("prerequisites", "Ссылки на предварительные маршруты должны быть исходным полем, без вычисляемых или скрытых свойств."); return rejected();
    }
    const checked = prerequisitesInput(prerequisitesDescriptor.value, input.id);
    if (!checked.ok) { checked.errors.forEach((error) => fail(error.field, error.message)); return rejected(); }
    prerequisites = checked.references;
  }
  const additionalWorksDescriptor = Object.getOwnPropertyDescriptor(input, "additionalWorks");
  let additionalWorks: JourneyDraftAdditionalWorkInput[] | undefined;
  if (additionalWorksDescriptor) {
    if (!additionalWorksDescriptor.enumerable || !("value" in additionalWorksDescriptor)) {
      fail("additionalWorks", "Дополнительные книги должны быть исходным полем, без вычисляемых или скрытых свойств."); return rejected();
    }
    const checked = additionalWorksInput(additionalWorksDescriptor.value);
    if (!checked.ok) { checked.errors.forEach((error) => fail(error.field, error.message)); return rejected(); }
    additionalWorks = checked.works;
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
  const additionalSelections: SelectedEntity[] = [], additionalIds = new Set<string>();
  for (const [index, row] of (additionalWorks ?? []).entries()) {
    const field = `additionalWorks.${index}.workId`, selectedWork = writer && Array.isArray(writer.works) ? writer.works.find((item: JourneyDraftCatalog["countries"][number]["writers"][number]["works"][number]) => item.id === row.workId) : undefined;
    if (row.workId === input.workId || additionalIds.has(row.workId)) fail(field, "Дополнительная книга должна отличаться от основной и остальных дополнительных книг.");
    additionalIds.add(row.workId);
    if (!selectedWork) { fail(field, "Дополнительная книга не принадлежит выбранному каноническому писателю."); continue; }
    if (!text(selectedWork.label?.ru, 2000) || !text(selectedWork.label?.en, 2000)) fail(field, "Для дополнительной книги требуются исходные подтверждённые названия RU/EN.");
    if (country && writer && bookyJourneyEntityId({ kind: "work", countryId: country.id, writerId: writer.id, workId: selectedWork.id }).length > 200)
      fail(field, "Канонический идентификатор дополнительной книги превышает предел реестра.");
    additionalSelections.push(selectedWork);
  }
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
        copy: { ru: nodeCopySnapshot(activity.copy.ru), en: nodeCopySnapshot(activity.copy.en) },
      } } : {}),
      ...(fact ? { fact: { ...(Object.hasOwn(fact, "subject") ? { subject: fact.subject } : {}), copy: {
        ru: { ...nodeCopySnapshot(fact.copy.ru), sources: fact.copy.ru.sources.map(source => ({ ...source })) },
        en: { ...nodeCopySnapshot(fact.copy.en), sources: fact.copy.en.sources.map(source => ({ ...source })) },
      } } } : {}),
      ...(optionalNodeOrder ? { optionalNodeOrder: [...optionalNodeOrder] } : {}),
      ...(prerequisites ? { prerequisites: prerequisites.map((reference) => ({ ...reference })) } : {}),
      ...(additionalWorks ? { additionalWorks: additionalWorks.map(row => ({ workId: row.workId,
        copy: { ru: nodeCopySnapshot(row.copy.ru), en: nodeCopySnapshot(row.copy.en) } })) } : {}),
    },
    selection: { country: selected(country), writer: selected(writer), work: selected(work),
      ...(activity ? { activityChoices: activitySelections.map(choice => ({ country: selected(choice.country), writer: selected(choice.writer) })) } : {}),
      ...(additionalWorks ? { additionalWorks: additionalSelections.map((item, index) => ({ nodeId: additionalWorkNodeId(index), work: selected(item) })) } : {}),
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
  let factSpec: BookyJourneyFactSpec | undefined;
  const factRecords: Partial<Record<"ru" | "en", BookyDialogueRecord>> = {};
  const factSubject = fact?.subject ?? "work";
  const factEntity = refs[factSubject]!;
  const factScreen = factSubject === "work" ? "collection" as const : "globe" as const;
  if (fact) {
    // Context deliberately excludes the binding table. Valid transient hashes
    // let the existing helper bind identity/anchor before both payloads exist.
    // This table is replaced with real payload hashes before any output.
    const contextSpec: BookyJourneyFactSpec = {
      schemaVersion: 1, id: `${input.id}.${factSubject}-fact`, version: input.version,
      dialogues: [
        { locale: "ru", id: `${input.id}.sourced-fact`, version: input.version, contentChecksum: "0".repeat(64) },
        { locale: "en", id: `${input.id}.sourced-fact`, version: input.version, contentChecksum: "0".repeat(64) },
      ],
    };
    const contextNode: BookyJourneyNode = {
      id: "sourced-fact", kind: "sourced-fact", entity: factEntity, screen: factScreen,
      dialogue: { id: `${input.id}.sourced-fact`, version: input.version, contentChecksum: "" }, fact: contextSpec,
    };
    const context = bookyJourneyDialogueContext(input.id, contextNode);
    if (!context) { fail("fact", "Факт несовместим с контекстом выбранного объекта."); return rejected(); }
    for (const locale of LOCALES) {
      const copy = authoringSource.input.fact!.copy[locale];
      const payload: BookyDialoguePayload = {
        id: contextNode.dialogue.id, version: input.version, locale, audience: "adult",
        ageRange: { ...authoringSource.input.ageRange }, readingLevel: input.readingLevel,
        intent: "sourced-fact", screens: [factScreen], context, entityIds: [bookyJourneyEntityId(factEntity)],
        claimKind: "factual", factualSources: copy.sources.map(source => ({ ...source })),
        copy: payloadCopy(copy),
        narration: null, prohibitedTags: [],
        provenance: {
          kind: "editorial", sourcePath: "authoringSource", sourceVersion: 1,
          sourceRef: `/input/fact/copy/${locale}`, sourceSha256: authoringSourceChecksum,
          copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })),
        },
      };
      const contentChecksum = getBookyDialogueContentChecksum(payload);
      if (!contentChecksum) { fail(`fact.copy.${locale}`, "Диалог факта не соответствует схеме реестра."); return rejected(); }
      const review = { status: "draft" as const, reviewer: null, reviewedAt: null, contentChecksum };
      const checksum = getBookyDialogueChecksum({ payload, review });
      if (!checksum) { fail(`fact.copy.${locale}`, "Не удалось связать draft факт с его контрольной суммой."); return rejected(); }
      factRecords[locale] = { payload, review, checksum };
    }
    factSpec = {
      ...contextSpec,
      dialogues: [
        { ...contextSpec.dialogues[0], contentChecksum: factRecords.ru!.review.contentChecksum },
        { ...contextSpec.dialogues[1], contentChecksum: factRecords.en!.review.contentChecksum },
      ],
    };
    if (!getBookyJourneyFactChecksum(factSpec, factEntity, factScreen)
      || bookyJourneyDialogueContext(input.id, { ...contextNode, fact: factSpec }) !== context) {
      fail("fact", "Не удалось связать тексты RU/EN с выбранным объектом."); return rejected();
    }
  }
  const nodeSteps: readonly { kind: (typeof NODE_KINDS)[number] | "activity" | "sourced-fact"; id: string; additionalIndex?: number }[] = [
    { kind: "country", id: "country" }, { kind: "writer", id: "writer" },
    ...(additionalWorks ?? []).map((_, index) => ({ kind: "work" as const, id: additionalWorkNodeId(index), additionalIndex: index })),
    { kind: "work", id: "work" }, ...(optionalNodeOrder ?? [
      ...(factSpec ? ["sourced-fact" as const] : []), ...(activitySpec ? ["activity" as const] : []),
    ]).map(kind => ({ kind, id: kind })), { kind: "checkpoint", id: "checkpoint" },
  ];
  for (const locale of LOCALES) {
    const nodes: BookyJourneyNode[] = [];
    for (const { kind, id, additionalIndex } of nodeSteps) {
      if (kind === "sourced-fact") {
        const record = factRecords[locale]!;
        dialogues.push(record);
        nodes.push({
          id: kind, kind, entity: { ...factEntity }, screen: factScreen,
          fact: { ...factSpec!, dialogues: [{ ...factSpec!.dialogues[0] }, { ...factSpec!.dialogues[1] }] },
          dialogue: { id: record.payload.id, version: input.version, contentChecksum: record.review.contentChecksum },
        });
        continue;
      }
      const node: BookyJourneyNode = {
        id, kind, entity: additionalIndex !== undefined ? { kind: "work", countryId: country.id, writerId: writer.id, workId: additionalSelections[additionalIndex].id }
          : kind === "activity" ? null : refs[kind], screen: kind === "country" || kind === "writer" || kind === "activity" ? "globe" : "collection",
        dialogue: { id: `${input.id}.${id}`, version: input.version, contentChecksum: "" },
        ...(kind === "activity" ? { activity: activitySpec! } : {}),
      };
      const context = bookyJourneyDialogueContext(input.id, node);
      const copy = additionalIndex !== undefined ? authoringSource.input.additionalWorks![additionalIndex].copy[locale]
        : kind === "activity" ? authoringSource.input.activity!.copy[locale] : authoringSource.input.copy[locale].nodes[kind];
      const copyField = additionalIndex !== undefined ? `additionalWorks.${additionalIndex}.copy.${locale}` : `copy.${locale}.nodes.${kind}`;
      if (!context) { fail("id", "ID маршрута несовместим с контекстом диалога."); return rejected(); }
      const payload: BookyDialoguePayload = {
        id: node.dialogue.id, version: input.version, locale, audience: "adult",
        ageRange: { ...authoringSource.input.ageRange }, readingLevel: input.readingLevel,
        intent: kind === "activity" ? "activity" : "navigation", screens: [node.screen], context,
        entityIds: kind === "activity" ? [...new Set([activitySpec!.targetWork, ...activitySpec!.choices.map(choice => choice.writer)]
          .map(bookyJourneyEntityId))] : node.entity ? [bookyJourneyEntityId(node.entity)] : [],
        claimKind: "interface-guidance", factualSources: [],
        copy: payloadCopy(copy),
        narration: null, prohibitedTags: [],
        provenance: {
          kind: "editorial", sourcePath: "authoringSource", sourceVersion: 1,
          sourceRef: additionalIndex !== undefined ? `/input/additionalWorks/${additionalIndex}/copy/${locale}`
            : kind === "activity" ? `/input/activity/copy/${locale}` : `/input/copy/${locale}/nodes/${kind}`,
          sourceSha256: authoringSourceChecksum, copySha256: contentTextHash(JSON.stringify({ title: copy.title, body: copy.body })),
        },
      };
      const contentChecksum = getBookyDialogueContentChecksum(payload);
      if (!contentChecksum) { fail(copyField, "Диалог не соответствует схеме реестра."); return rejected(); }
      const review = { status: "draft" as const, reviewer: null, reviewedAt: null, contentChecksum };
      const checksum = getBookyDialogueChecksum({ payload, review });
      if (!checksum) { fail(copyField, "Не удалось связать draft диалог с его контрольной суммой."); return rejected(); }
      dialogues.push({ payload, review, checksum });
      nodes.push({ ...node, dialogue: { ...node.dialogue, contentChecksum } });
    }
    const definition: BookyJourneyDefinition = {
      schemaVersion: 1, id: input.id, version: input.version, locale, audience: "adult",
      ageRange: { ...authoringSource.input.ageRange }, readingLevel: input.readingLevel,
      title: authoringSource.input.copy[locale].title,
      overview: { description: authoringSource.input.copy[locale].description, estimatedDurationMinutes: input.estimatedDurationMinutes },
      prerequisites: prerequisites?.map((reference) => ({ ...reference })) ?? [], nodes,
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
    const hasFact = record(input) && Object.prototype.hasOwnProperty.call(input, "fact");
    const hasOrder = record(input) && Object.prototype.hasOwnProperty.call(input, "optionalNodeOrder");
    const hasPrerequisites = record(input) && Object.prototype.hasOwnProperty.call(input, "prerequisites");
    const hasAdditionalWorks = record(input) && Object.prototype.hasOwnProperty.call(input, "additionalWorks");
    if (!exactKeys(input, [...inputFields, ...(hasActivity ? ["activity"] : []), ...(hasFact ? ["fact"] : []), ...(hasOrder ? ["optionalNodeOrder"] : []), ...(hasPrerequisites ? ["prerequisites"] : []), ...(hasAdditionalWorks ? ["additionalWorks"] : [])]) || !exactKeys(input.ageRange, ["min", "max"])
      || !exactKeys(input.copy, LOCALES))
      return rejected("authoringSource.input", "Исходная форма черновика содержит лишние или отсутствующие поля.");
    if (hasActivity && !activityInput(input.activity))
      return rejected("activity", "Задание содержит неверные, лишние или отсутствующие поля либо неполные тексты RU/EN.");
    if (hasFact && !factInput(input.fact))
      return rejected("fact", "Факт содержит неверные, лишние или отсутствующие тексты RU/EN либо источники.");
    if (hasOrder && !optionalNodeOrderInput(input.optionalNodeOrder, hasFact, hasActivity))
      return rejected("optionalNodeOrder", "Порядок необязательных шагов не соответствует включённым факту и заданию либо содержит лишние или отсутствующие поля.");
    if (hasPrerequisites) {
      const checked = prerequisitesInput(input.prerequisites, input.id);
      if (!checked.ok) return freeze({ ok: false as const, errors: checked.errors });
    }
    if (hasAdditionalWorks) {
      const checked = additionalWorksInput(input.additionalWorks);
      if (!checked.ok) return freeze({ ok: false as const, errors: checked.errors });
    }
    for (const locale of LOCALES) {
      const copy = input.copy[locale];
      if (!exactKeys(copy, ["title", "description", "nodes"]) || !exactKeys(copy.nodes, NODE_KINDS))
        return rejected(`copy.${locale}`, "Языковая форма черновика содержит лишние или отсутствующие поля.");
      for (const kind of NODE_KINDS) {
        if (!nodeCopyKeys(copy.nodes[kind]))
          return rejected(`copy.${locale}.nodes.${kind}`, "Текст шага должен содержать название и текст, а необязательные подпись и короткий текст должны соответствовать установленным ограничениям.");
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
