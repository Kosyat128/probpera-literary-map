"use client";

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { BOOKY_JOURNEY_DRAFT_MAX_BYTES, createBookyJourneyDraft, createBookyJourneyWorkspace, evaluateBookyJourneyDraftPreviewProfile, parseBookyJourneyDraft, parseBookyJourneyWorkspace, type JourneyDraftCatalog, type JourneyDraftInput, type BookyJourneyDraft } from "@/lib/booky-journey-draft";

import { evaluateBookyJourneyDraftActivityAction, validateBookyJourneyDraftActivityAction } from "@/app/(dashboard)/journeys/actions";
import { contentRecordHash } from "../../../src/planet/contentExportHash";

type Locale = "ru" | "en";
type NodeKind = "country" | "writer" | "work" | "checkpoint";
type EntityKind = "country" | "writer" | "work";
type CopyKind = NodeKind | "activity" | "sourced-fact";
type OptionalNodeKind = "sourced-fact" | "activity";
type PreviewCopyView = "body" | "caption" | "reduced";
type PreviewWidth = "available" | "320" | "768";
type PreviewProfile = Readonly<{ enabled: boolean; age: string; readingLevel: string }>;
type PreviewAnswer = Readonly<{ choiceId: string | null; verdict: boolean | null; pending: boolean; error: string }>;
const emptyAnswer = (choiceId: string | null = null): PreviewAnswer => ({ choiceId, verdict: null, pending: false, error: "" });
const locales = ["ru", "en"] as const;
const steps = [
  { key: "country", title: "Страна", number: 1 },
  { key: "writer", title: "Писатель", number: 2 },
  { key: "work", title: "Книга", number: 3 },
  { key: "checkpoint", title: "Завершение", number: 4 },
] as const;
const previewStepLabels = {
  ru: { country: "Страна", writer: "Писатель", work: "Книга", "sourced-fact": "Факт", activity: "Задание", checkpoint: "Завершение", character: "Персонаж" },
  en: { country: "Country", writer: "Writer", work: "Work", "sourced-fact": "Fact", activity: "Activity", checkpoint: "Finish", character: "Character" },
} as const;

function entitySearchOptions<T extends { id: string; label: { ru: string; en: string } }>(items: readonly T[], query: string, selectedId: string) {
  const term = query.trim().toLowerCase();
  const matches = (item: T) => [item.label.ru, item.label.en, item.id].some((value) => value.toLowerCase().includes(term));
  return { options: items.filter((item) => matches(item) || item.id === selectedId),
    count: items.filter(matches).length, retainedSelected: items.some((item) => item.id === selectedId && !matches(item)) };
}

function initialCopy(): JourneyDraftInput["copy"] {
  return {
    ru: { title: "", description: "", nodes: {
      country: { title: "Начните со страны", body: "Откройте выбранную страну на глобусе." },
      writer: { title: "Перейдите к писателю", body: "Откройте выбранного писателя." },
      work: { title: "Откройте книгу", body: "Перейдите к выбранной книге в коллекции." },
      checkpoint: { title: "Подведите итог", body: "Отметьте завершение этого маршрута." },
    } },
    en: { title: "", description: "", nodes: {
      country: { title: "Start with the country", body: "Open the selected country on the globe." },
      writer: { title: "Go to the writer", body: "Open the selected writer." },
      work: { title: "Open the book", body: "Go to the selected book in the collection." },
      checkpoint: { title: "Finish the journey", body: "Mark this journey as complete." },
    } },
  };
}

export function BookyJourneyDraftEditor({ catalog }: { catalog: JourneyDraftCatalog }) {
  const errorPrefix = useId();
  const [input, setInput] = useState<JourneyDraftInput>(() => ({
    id: "", version: 1, countryId: "", writerId: "", workId: "",
    ageRange: { min: 18, max: 99 }, readingLevel: "plain", estimatedDurationMinutes: 0,
    copy: initialCopy(),
  }));
  const [errors, setErrors] = useState<readonly { field: string; message: string }[]>([]);
  const [entityQueries, setEntityQueries] = useState({ country: "", writer: "", work: "" });
  const [authorQuery, setAuthorQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ draft: BookyJourneyDraft; locale: Locale; step: number } | null>(null);
  const [previewCopyView, setPreviewCopyView] = useState<PreviewCopyView>("body");
  const [previewWidth, setPreviewWidth] = useState<PreviewWidth>("available");
  const [previewProfile, setPreviewProfile] = useState<PreviewProfile>({ enabled: false, age: "", readingLevel: "" });
  const [modeledPrerequisites, setModeledPrerequisites] = useState<readonly string[]>([]);
  const [answer, setAnswer] = useState<PreviewAnswer>(emptyAnswer);
  const previewOwner = useRef(preview), answerOwner = useRef(answer);
  previewOwner.current = preview; answerOwner.current = answer;
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<readonly { field: string; message: string }[]>([]);
  const [importNotice, setImportNotice] = useState("");
  const [workspaceImporting, setWorkspaceImporting] = useState(false);
  const [workspaceErrors, setWorkspaceErrors] = useState<readonly { field: string; message: string }[]>([]);
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const workspaceReadSequence = useRef(0);
  const workspaceHelpId = errorPrefix + "-workspace-help", workspaceErrorId = errorPrefix + "-workspace-errors";
  const operationSequence = useRef(0);
  const formControl = useRef<HTMLFormElement>(null);
  const fileControl = useRef<HTMLInputElement>(null);
  const optionalOrderFocus = useRef<HTMLButtonElement | null>(null);
  const additionalOrderFocus = useRef<HTMLElement | null>(null);
  const [validating, setValidating] = useState(false);
  const choiceWriters = catalog.countries.flatMap((item) => item.writers.map((author) => ({ country: item, writer: author })));
  const choiceKey = (choice: { countryId: string; writerId: string }) => JSON.stringify([choice.countryId, choice.writerId]);
  const authorSearchTerm = authorQuery.trim().toLowerCase();
  const matchesAuthor = (item: (typeof choiceWriters)[number]) => [item.writer.label.ru, item.writer.label.en,
    item.country.label.ru, item.country.label.en, item.writer.id, item.country.id].some((value) => value.toLowerCase().includes(authorSearchTerm));
  const authorMatchCount = choiceWriters.filter(matchesAuthor).length;
  const retainsAuthorSelection = choiceWriters.some((item) => !matchesAuthor(item) && input.activity?.choices.some((choice) =>
    choiceKey(choice) === choiceKey({ countryId: item.country.id, writerId: item.writer.id })));
  const authorSearchId = errorPrefix + "-search-activity-authors";
  useEffect(() => () => { operationSequence.current += 1; workspaceReadSequence.current += 1; }, []);
  useEffect(() => {
    const control = optionalOrderFocus.current;
    optionalOrderFocus.current = null;
    if (control?.isConnected) control.focus({ preventScroll: true });
  }, [input.optionalNodeOrder]);
  useEffect(() => {
    const control = additionalOrderFocus.current;
    additionalOrderFocus.current = null;
    if (control?.isConnected) control.focus({ preventScroll: true });
  }, [input.additionalWorks]);
  const country = catalog.countries.find((item) => item.id === input.countryId);
  const writer = country?.writers.find((item) => item.id === input.writerId);
  const work = writer?.works.find((item) => item.id === input.workId);
  const available = catalog.countries.length > 0;
  const countrySearch = entitySearchOptions(catalog.countries, entityQueries.country, input.countryId);
  const writerSearch = entitySearchOptions(country?.writers ?? [], entityQueries.writer, input.writerId);
  const workSearch = entitySearchOptions(writer?.works ?? [], entityQueries.work, input.workId);
  const defaultOptionalNodeOrder: OptionalNodeKind[] = [...(input.fact ? ["sourced-fact" as const] : []), ...(input.activity ? ["activity" as const] : [])];
  const optionalNodeOrder = input.optionalNodeOrder ?? defaultOptionalNodeOrder;
  function draftErrorTarget(field: string): string | null {
    if (field === "ageRange") return "ageRange.min";
    if (field === "prerequisites") return field;
    const prerequisite = /^prerequisites\.(\d+)\.(?:id|version)$/u.exec(field);
    if (prerequisite) return input.prerequisites?.[Number(prerequisite[1])] ? field : null;
    if (field === "additionalWorks") return field;
    const additional = /^additionalWorks\.(\d+)\.(?:workId|copy\.(?:ru|en)\.(?:title|body|caption|reduced))$/u.exec(field);
    if (additional) return input.additionalWorks?.[Number(additional[1])] ? field.endsWith(".workId") && !writer ? "additionalWorks" : field : null;
    if (/^additionalWorks\./u.test(field)) return "additionalWorks";
    if (field === "fact") return input.fact ? "fact" : null;
    if (["activity", "activity.auth", "activity.choices"].includes(field)) return input.activity ? "activity" : null;
    if (field === "optionalNodeOrder") return optionalNodeOrder.length ? "optionalNodeOrder" : null;
    const choice = /^activity\.choices\.(\d+)(?:\.label\.(?:ru|en)|\.(?:ru|en))?$/u.exec(field);
    if (choice) return input.activity?.choices[Number(choice[1])] ? "activity.choices." + Number(choice[1]) : null;
    if (field === "countryId") return available ? field : null;
    if (field === "writerId") return country ? field : null;
    if (field === "workId") return writer ? field : null;
    if (["id", "version", "readingLevel", "estimatedDurationMinutes"].includes(field)
      || /^copy\.(?:ru|en)\.(?:title|description)$/u.test(field)
      || /^copy\.(?:ru|en)\.nodes\.(?:country|writer|work|checkpoint)\.(?:title|body|caption|reduced)$/u.test(field)) return field;
    return null;
  }
  function draftFieldId(field: string) { return errorPrefix + "-field-" + field.replaceAll(".", "-"); }
  function fieldProps(field: string, sharedErrors: readonly string[] = []) {
    const errorIds = errors.flatMap((error, index) => error.field === field || sharedErrors.includes(error.field)
      || draftErrorTarget(error.field) === field ? [errorPrefix + "-error-" + index] : []);
    return {
      id: draftFieldId(field),
      "data-booky-draft-field": field,
      "aria-invalid": errorIds.length ? true as const : undefined,
      "aria-describedby": errorIds.length ? errorIds.join(" ") : undefined,
    };
  }
  function draftErrorLabel(field: string) {
    const target = draftErrorTarget(field);
    const labels: Record<string, string> = { id: "Идентификатор маршрута", version: "Версия", "ageRange.min": "Возрастной диапазон",
      readingLevel: "Уровень чтения", estimatedDurationMinutes: "Примерная длительность", countryId: "Страна", writerId: "Писатель", workId: "Книга",
      fact: "Необязательный факт · источники", activity: "Необязательное задание · выбрать автора", optionalNodeOrder: "Порядок необязательных шагов",
      prerequisites: "Предварительные маршруты · ссылки", additionalWorks: "Дополнительные книги" };
    if (target && labels[target]) return labels[target];
    const prerequisite = /^prerequisites\.(\d+)\.(id|version)$/u.exec(field);
    if (prerequisite) return (prerequisite[2] === "id" ? "ID" : "Версия") + " предварительного маршрута " + (Number(prerequisite[1]) + 1);
    const additional = /^additionalWorks\.(\d+)\.(workId|copy\.(ru|en)\.(title|body|caption|reduced))$/u.exec(field);
    if (additional) {
      const names: Record<string, string> = { title: "Название", body: "Подсказка", caption: "Подпись", reduced: "Короткий текст" };
      return "Дополнительная книга " + (Number(additional[1]) + 1) + " · " + (additional[2] === "workId" ? "канонический выбор" : names[additional[4]] + " (" + additional[3].toUpperCase() + ")");
    }
    const choice = target && /^activity\.choices\.(\d+)$/u.exec(target);
    if (choice) return "Автор · вариант " + (Number(choice[1]) + 1);
    const route = /^copy\.(ru|en)\.(title|description)$/u.exec(field);
    if (route) return (route[2] === "title" ? "Название" : "Описание") + " маршрута (" + route[1].toUpperCase() + ")";
    const copy = /^copy\.(ru|en)\.nodes\.(country|writer|work|checkpoint)\.(title|body|caption|reduced)$/u.exec(field);
    if (copy) {
      const locale = copy[1] as Locale, kind = copy[2] as NodeKind;
      const names: Record<string, string> = locale === "ru" ? { title: "Название шага", body: "Подсказка", caption: "Подпись", reduced: "Короткий текст" }
        : { title: "Step title", body: "Full text", caption: "Caption", reduced: "Short text" };
      return names[copy[3]] + " · " + previewStepLabels[locale][kind] + " (" + locale.toUpperCase() + ")";
    }
    return "Поле маршрута";
  }
  function focusDraftError(field: string) {
    const target = draftErrorTarget(field);
    if (!target) return;
    const control = Array.from(formControl.current?.querySelectorAll<HTMLElement>("[data-booky-draft-field]") ?? [])
      .find((element) => element.dataset.bookyDraftField === target);
    if (!control) return;
    for (let ancestor: HTMLElement | null = control.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      if (ancestor === formControl.current) break;
    }
    control.focus();
  }
  function entitySearchFields(kind: EntityKind, disabled: boolean, result: { count: number; retainedSelected: boolean }) {
    const names = { country: "страны", writer: "писателя", work: "книги" };
    const summaryNames = { country: "страну", writer: "писателя", work: "книгу" };
    const searchId = errorPrefix + "-search-" + kind;
    return <details data-booky-entity-search={kind} style={{ minWidth: 0 }}>
      <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Найти {summaryNames[kind]} в списке</summary>
      <label className="field"><span>Поиск {names[kind]} (RU / EN / ID)</span>
        <input id={searchId} type="search" value={entityQueries[kind]} disabled={disabled} autoComplete="off" spellCheck={false}
          aria-describedby={searchId + "-help " + searchId + "-result"} style={{ minHeight: 44 }}
          onChange={(event) => { const value = event.target.value; setEntityQueries((current) => ({ ...current, [kind]: value })); }}
          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
      <p id={searchId + "-help"}>Поиск по доступным названиям RU, EN и ID. Выбор меняется только в списке ниже.</p>
      <p id={searchId + "-result"} data-booky-search-result role="status" aria-live="polite" style={{ overflowWrap: "anywhere" }}>
        Совпадений: {result.count}.{result.retainedSelected && " Текущий выбор остаётся в списке и не входит в число совпадений."}
      </p>
      <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, maxWidth: "100%" }}
        disabled={disabled || entityQueries[kind] === ""} onClick={() => setEntityQueries((current) => ({ ...current, [kind]: "" }))}>Очистить поиск</button>
    </details>;
  }
  const previewDefinition = preview?.draft.definitions.find((definition) => definition.locale === preview.locale);
  const previewProfileResult = previewProfile.enabled && previewDefinition ? evaluateBookyJourneyDraftPreviewProfile(previewDefinition, {
    age: previewProfile.age === "" ? NaN : Number(previewProfile.age), readingLevel: previewProfile.readingLevel,
  }) : null;
  const previewProfileMatches = !previewProfile.enabled || previewProfileResult?.status === "matches";
  const previewPrerequisites = previewDefinition?.prerequisites ?? [];
  const prerequisiteKey = (reference: { id: string; version: number }) => JSON.stringify([reference.id, reference.version]);
  const missingPreviewPrerequisites = previewPrerequisites.filter((reference) => !modeledPrerequisites.includes(prerequisiteKey(reference)));
  const modeledPrerequisiteCount = previewPrerequisites.length - missingPreviewPrerequisites.length;
  const prerequisitePreviewMatches = !previewProfile.enabled || missingPreviewPrerequisites.length === 0;
  const prerequisitePreviewReportId = errorPrefix + "-preview-prerequisites-report";
  const prerequisitePreviewHelpId = errorPrefix + "-preview-prerequisites-help";
  const previewNode = previewDefinition?.nodes[preview?.step ?? 0];
  const previewChoices = previewNode?.kind === "activity" ? previewNode.activity?.choices ?? [] : [];
  const previewDialogue = preview?.draft.dialogues.find((record) => record.payload.locale === preview.locale
    && record.payload.id === previewNode?.dialogue.id);
  const previewEntity = previewNode?.kind === "work" && previewNode.id !== "work"
    ? preview?.draft.authoringSource.selection.additionalWorks?.find((item) => item.nodeId === previewNode.id)?.work
    : preview ? preview.draft.authoringSource.selection[previewNode?.entity?.kind === "country" ? "country" : previewNode?.entity?.kind === "writer" ? "writer" : "work"] : null;
  function previewNodeLabel(locale: Locale, id: string, kind: CopyKind | "character") {
    const additional = preview?.draft.authoringSource.selection.additionalWorks?.find((item) => item.nodeId === id);
    if (kind === "sourced-fact") {
      const entity = preview?.draft.definitions.find(definition => definition.locale === locale)?.nodes.find(node => node.id === id)?.entity;
      if (entity?.kind === "country" || entity?.kind === "writer") {
        const subject = preview!.draft.authoringSource.selection[entity.kind];
        return (locale === "ru" ? entity.kind === "country" ? "Факт о стране · " : "Факт о писателе · "
          : entity.kind === "country" ? "Country fact · " : "Writer fact · ") + (subject.label[locale] || (locale === "ru" ? "Название пока не подтверждено" : "Name is not confirmed"));
      }
    }
    return additional ? (locale === "ru" ? "Доп. книга · " : "Additional work · ") + additional.work.label[locale] : previewStepLabels[locale][kind];
  }
  function previewFactSubjectLabel(locale: Locale) {
    const entity = preview?.draft.definitions.find(definition => definition.locale === locale)?.nodes.find(node => node.kind === "sourced-fact")?.entity;
    if (!preview || !entity || !["country", "writer", "work"].includes(entity.kind)) return null;
    const kind = entity.kind as "country" | "writer" | "work", selected = preview.draft.authoringSource.selection[kind];
    return (locale === "ru" ? kind === "country" ? "Страна: " : kind === "writer" ? "Писатель: " : "Основная книга: "
      : kind === "country" ? "Country: " : kind === "writer" ? "Writer: " : "Main work: ")
      + (selected.label[locale] || (locale === "ru" ? "Название пока не подтверждено" : "Name is not confirmed"));
  }
  const reviewRows = preview && previewDefinition ? previewDefinition.nodes.map((node, step) => ({
    id: node.id, kind: node.kind, step,
    copies: locales.map((locale) => {
      const authored = preview.draft.authoringSource.input;
      const additionalIndex = preview.draft.authoringSource.selection.additionalWorks?.findIndex((item) => item.nodeId === node.id) ?? -1;
      const copy = additionalIndex >= 0 ? authored.additionalWorks?.[additionalIndex]?.copy[locale] : node.kind === "activity" ? authored.activity?.copy[locale]
        : node.kind === "sourced-fact" ? authored.fact?.copy[locale]
          : node.kind === "country" || node.kind === "writer" || node.kind === "work" || node.kind === "checkpoint"
            ? node.kind === "work" && node.id !== "work" ? undefined : authored.copy[locale].nodes[node.kind] : undefined;
      return { locale, supplied: !!copy,
        captionAuthored: !!copy && Object.hasOwn(copy, "caption"), reducedAuthored: !!copy && Object.hasOwn(copy, "reduced"),
        sourceCount: node.kind === "sourced-fact" ? authored.fact?.copy[locale].sources.length ?? 0 : null };
    }),
  })) : [];
  const comparisonCopies = preview && previewNode ? locales.flatMap((locale) => {
    const node = preview.draft.definitions.find((definition) => definition.locale === locale)?.nodes.find((item) => item.id === previewNode.id);
    const dialogue = preview.draft.dialogues.find((record) => record.payload.locale === locale && record.payload.id === node?.dialogue.id);
    const supplied = reviewRows.find((row) => row.id === previewNode.id)?.copies.find((copy) => copy.locale === locale);
    return dialogue && supplied ? [{ locale, copy: dialogue.payload.copy,
      presence: previewCopyView === "body" || (previewCopyView === "caption" ? supplied.captionAuthored : supplied.reducedAuthored) ? "authored" : "title-fallback" }] : [];
  }) : [];

  function update(change: Partial<JourneyDraftInput>) {
    operationSequence.current += 1;
    setImporting(false);
    setImportErrors([]);
    setImportNotice(importing ? "Открытие файла отменено: форма была изменена." : "");
    if (fileControl.current) fileControl.current.value = "";
    setPreview(null);
    setModeledPrerequisites([]);
    setAnswer(emptyAnswer());
    setValidating(false);
    setInput((current) => {
      const next = { ...current, ...change };
      if (Object.hasOwn(change, "activity") && change.activity === undefined) delete next.activity;
      if (Object.hasOwn(change, "fact") && change.fact === undefined) delete next.fact;
      if (Object.hasOwn(change, "optionalNodeOrder") && change.optionalNodeOrder === undefined) delete next.optionalNodeOrder;
      if (Object.hasOwn(change, "prerequisites") && change.prerequisites === undefined) delete next.prerequisites;
      if (Object.hasOwn(change, "additionalWorks") && change.additionalWorks === undefined) delete next.additionalWorks;
      if (!!next.fact !== !!current.fact || !!next.activity !== !!current.activity) delete next.optionalNodeOrder;
      return next;
    });
    setErrors([]);
    setNotice("");
  }
  function updateCopy(locale: Locale, field: "title" | "description", value: string) {
    update({ copy: { ...input.copy, [locale]: { ...input.copy[locale], [field]: value } } });
  }
  function updateNode(locale: Locale, node: NodeKind, field: "title" | "body", value: string) {
    update({ copy: { ...input.copy, [locale]: { ...input.copy[locale], nodes: {
      ...input.copy[locale].nodes,
      [node]: { ...input.copy[locale].nodes[node], [field]: value },
    } } } });
  }
  function moveOptionalNode(kind: OptionalNodeKind, direction: -1 | 1, control: HTMLButtonElement) {
    const index = optionalNodeOrder.indexOf(kind), target = index + direction;
    if (index < 0 || target < 0 || target >= optionalNodeOrder.length) return;
    const next = [...optionalNodeOrder];
    [next[index], next[target]] = [next[target], next[index]];
    if (next.every((item, i) => item === optionalNodeOrder[i])) return;
    if (control === document.activeElement) optionalOrderFocus.current = control;
    update({ optionalNodeOrder: next.every((item, i) => item === defaultOptionalNodeOrder[i]) ? undefined : next });
  }
  function restoreOptionalNodeOrder() {
    if (!Object.hasOwn(input, "optionalNodeOrder")) return;
    update({ optionalNodeOrder: undefined });
  }
  function beginOperation(keepAnswerChoice = false) {
    const sequence = ++operationSequence.current;
    setImporting(false);
    setValidating(false);
    setAnswer((current) => emptyAnswer(keepAnswerChoice ? current.choiceId : null));
    if (fileControl.current) fileControl.current.value = "";
    return sequence;
  }
  function chooseAnswer(choiceId: string) {
    if (!previewChoices.some((choice) => choice.id === choiceId)) return;
    beginOperation();
    setAnswer(emptyAnswer(choiceId));
  }
  function changePreviewLocale(locale: Locale) {
    beginOperation();
    setPreview((current) => current ? { ...current, locale } : null);
  }
  function changePreviewStep(direction: -1 | 1) {
    beginOperation();
    setPreview((current) => current ? { ...current,
      step: Math.max(0, Math.min(current.draft.definitions[0].nodes.length - 1, current.step + direction)),
    } : null);
  }
  function jumpPreviewStep(step: number) {
    if (!preview || !previewDefinition || !Number.isInteger(step) || step < 0 || step >= previewDefinition.nodes.length || step === preview.step) return;
    beginOperation();
    setPreview((current) => current ? { ...current, step } : null);
  }
  function inspectReviewNode(locale: Locale, step: number) {
    if (!preview || !previewDefinition || !Number.isInteger(step) || step < 0 || step >= previewDefinition.nodes.length
      || (locale === preview.locale && step === preview.step)) return;
    beginOperation();
    setPreview((current) => current ? { ...current, locale, step } : null);
  }
  function changePreviewCopyView(view: PreviewCopyView) {
    if (view === previewCopyView) return;
    beginOperation();
    setPreviewCopyView(view);
  }
  function changePreviewWidth(width: PreviewWidth) {
    if (width === previewWidth) return;
    setPreviewWidth(width);
  }
  function updatePreviewProfile(change: Partial<PreviewProfile>) {
    const next = { ...previewProfile, ...change };
    if (next.enabled === previewProfile.enabled && next.age === previewProfile.age && next.readingLevel === previewProfile.readingLevel) return;
    beginOperation();
    if (next.enabled !== previewProfile.enabled) setModeledPrerequisites([]);
    setPreviewProfile(next);
  }
  function updateModeledPrerequisite(key: string, completed: boolean) {
    if (!previewProfile.enabled || !previewPrerequisites.some((reference) => prerequisiteKey(reference) === key)
      || modeledPrerequisites.includes(key) === completed) return;
    beginOperation();
    setModeledPrerequisites((current) => completed ? [...current, key] : current.filter((item) => item !== key));
  }
  async function checkAnswer() {
    const candidate = preview, choiceId = answer.choiceId;
    if (answer.pending || !previewProfileMatches || !prerequisitePreviewMatches || !candidate || previewNode?.kind !== "activity" || !choiceId || !previewChoices.some((choice) => choice.id === choiceId)) return;
    const sequence = beginOperation(true), draftChecksum = contentRecordHash(candidate.draft);
    setAnswer({ choiceId, verdict: null, pending: true, error: "" });
    const report = (stale = false) => setAnswer({ choiceId, verdict: null, pending: false, error: candidate.locale === "ru"
      ? stale ? "Ответ проверки устарел. Повторите действие." : "Не удалось проверить ответ. Выбор сохранён; повторите проверку."
      : stale ? "The check is out of date. Try again." : "Could not check the answer. Your choice is preserved; try again." });
    try {
      const result = await evaluateBookyJourneyDraftActivityAction(JSON.stringify(candidate.draft), choiceId);
      if (sequence !== operationSequence.current) return;
      const current = previewOwner.current, currentDefinition = current?.draft.definitions.find((item) => item.locale === current?.locale);
      const currentNode = currentDefinition?.nodes[current?.step ?? 0];
      if (!current || current.locale !== candidate.locale || current.step !== candidate.step || currentNode?.kind !== "activity"
        || answerOwner.current.choiceId !== choiceId || contentRecordHash(current.draft) !== draftChecksum) return;
      if (!result.ok) { report(); return; }
      if (result.draftChecksum !== draftChecksum || result.choiceId !== choiceId || typeof result.correct !== "boolean") { report(true); return; }
      setAnswer({ choiceId, verdict: result.correct, pending: false, error: "" });
    } catch {
      if (sequence === operationSequence.current) report();
    } finally {
      if (sequence === operationSequence.current) setAnswer((current) => ({ ...current, pending: false }));
    }
  }
  async function validateActivity(draft: BookyJourneyDraft, sequence: number, importingFile = false) {
    if (!draft.authoringSource.input.activity) return true;
    setValidating(true);
    const report = (message: string) => {
      const items = [{ field: "activity", message }];
      if (importingFile) setImportErrors(items); else setErrors(items);
    };
    try {
      const result = await validateBookyJourneyDraftActivityAction(JSON.stringify(draft));
      if (sequence !== operationSequence.current) return false;
      if (!result.ok) {
        if (importingFile) setImportErrors(result.errors); else setErrors(result.errors);
        return false;
      }
      if (result.draftChecksum !== contentRecordHash(draft)) {
        report("Каталог или черновик изменился во время проверки. Проверьте форму и повторите действие.");
        return false;
      }
      return true;
    } catch {
      if (sequence === operationSequence.current) report("Проверка задания сейчас недоступна. Форма сохранена; повторите действие.");
      return false;
    } finally {
      if (sequence === operationSequence.current) setValidating(false);
    }
  }
  function toggleActivity(enabled: boolean) {
    setAuthorQuery("");
    update({ activity: enabled ? {
      type: "match-work-author", choices: [{ countryId: "", writerId: "" }, { countryId: "", writerId: "" }],
      copy: {
        ru: { title: "Кто автор этой книги?", body: "Выберите имя автора среди предложенных вариантов." },
        en: { title: "Who wrote this book?", body: "Choose the author's name from the options." },
      },
    } : undefined });
  }
  function updateActivityCopy(locale: Locale, field: "title" | "body", value: string) {
    if (input.activity) update({ activity: { ...input.activity, copy: {
      ...input.activity.copy, [locale]: { ...input.activity.copy[locale], [field]: value },
    } } });
  }
  function toggleFact(enabled: boolean) {
    update({ fact: enabled ? { copy: {
      ru: { title: "", body: "", sources: [{ id: "", url: "", accessedAt: "" }] },
      en: { title: "", body: "", sources: [{ id: "", url: "", accessedAt: "" }] },
    } } : undefined });
  }
  function updateFactCopy(locale: Locale, field: "title" | "body", value: string) {
    if (input.fact) update({ fact: { ...input.fact, copy: {
      ...input.fact.copy, [locale]: { ...input.fact.copy[locale], [field]: value },
    } } });
  }
  function updateFactSubject(subject: "country" | "writer" | "work") {
    if (!input.fact || ((input.fact.subject ?? "work") === subject && !(subject === "work" && Object.hasOwn(input.fact, "subject")))) return;
    const fact = { ...input.fact };
    if (subject === "work") delete fact.subject;
    else fact.subject = subject;
    update({ fact });
  }
  function updateFactSource(locale: Locale, index: number, field: "id" | "url" | "accessedAt", value: string) {
    if (input.fact) update({ fact: { ...input.fact, copy: { ...input.fact.copy, [locale]: {
      ...input.fact.copy[locale], sources: input.fact.copy[locale].sources.map((source, i) => i === index ? { ...source, [field]: value } : source),
    } } } });
  }
  function updateAdditionalWorkCopy(index: number, locale: Locale, field: "title" | "body", value: string) {
    if (input.additionalWorks?.[index]) update({ additionalWorks: input.additionalWorks.map((row, i) => i === index
      ? { ...row, copy: { ...row.copy, [locale]: { ...row.copy[locale], [field]: value } } } : row) });
  }
  function moveAdditionalWork(index: number, direction: -1 | 1, control: HTMLButtonElement) {
    const rows = input.additionalWorks, target = index + direction;
    if (!rows || target < 0 || target >= rows.length) return;
    const next = [...rows]; [next[index], next[target]] = [next[target], next[index]];
    if (control === document.activeElement) additionalOrderFocus.current = formControl.current?.querySelector<HTMLButtonElement>(
      `[data-booky-additional-order-index="${target}"][data-booky-additional-order-direction="${direction}"]`) ?? null;
    update({ additionalWorks: next });
  }
  function updateCopyVariant(locale: Locale, kind: CopyKind, field: "caption" | "reduced", value: string, additionalIndex?: number) {
    function edit<T extends { caption?: string; reduced?: string }>(copy: T) {
      const next = { ...copy };
      if (value === "") delete next[field];
      else if (field === "caption") next.caption = value;
      else next.reduced = value;
      return next;
    }
    if (additionalIndex !== undefined) {
      if (input.additionalWorks?.[additionalIndex]) update({ additionalWorks: input.additionalWorks.map((row, i) => i === additionalIndex
        ? { ...row, copy: { ...row.copy, [locale]: edit(row.copy[locale]) } } : row) });
    } else if (kind === "activity") {
      if (input.activity) update({ activity: { ...input.activity, copy: { ...input.activity.copy, [locale]: edit(input.activity.copy[locale]) } } });
    } else if (kind === "sourced-fact") {
      if (input.fact) update({ fact: { ...input.fact, copy: { ...input.fact.copy, [locale]: edit(input.fact.copy[locale]) } } });
    } else {
      update({ copy: { ...input.copy, [locale]: { ...input.copy[locale], nodes: { ...input.copy[locale].nodes, [kind]: edit(input.copy[locale].nodes[kind]) } } } });
    }
  }
  function copyVariantFields(locale: Locale, kind: CopyKind, copy: { caption?: string; reduced?: string }, additionalIndex?: number) {
    const fieldBase = additionalIndex !== undefined ? "additionalWorks." + additionalIndex + ".copy." + locale : kind === "activity" ? "activity.copy." + locale : kind === "sourced-fact"
      ? "fact.copy." + locale : "copy." + locale + ".nodes." + kind;
    const ruLabel = additionalIndex !== undefined ? "Дополнительная книга " + (additionalIndex + 1) : previewStepLabels.ru[kind];
    const enLabel = additionalIndex !== undefined ? "Additional work " + (additionalIndex + 1) : previewStepLabels.en[kind];
    const captionLabel = locale === "ru" ? `Подпись «${ruLabel}» (RU)` : `Caption “${enLabel}” (EN)`;
    const reducedLabel = locale === "ru" ? `Короткий текст «${ruLabel}» (RU)` : `Short text “${enLabel}” (EN)`;
    return <details lang={locale} data-booky-copy-variants={kind} data-copy-locale={locale} style={{ minWidth: 0 }}>
      <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{locale === "ru" ? "Подпись и короткий текст" : "Caption and short text"}</summary>
      <p>{locale === "ru" ? "Пустое поле использует название шага." : "An empty field uses the step title."}</p>
      <label className="field"><span>{captionLabel}</span>
        <textarea {...fieldProps(fieldBase + ".caption")} lang={locale} aria-label={captionLabel} maxLength={1600} style={{ minHeight: 44 }} value={copy.caption ?? ""}
          onChange={(event) => updateCopyVariant(locale, kind, "caption", event.target.value, additionalIndex)} /></label>
      <label className="field"><span>{reducedLabel}</span>
        <textarea {...fieldProps(fieldBase + ".reduced")} lang={locale} aria-label={reducedLabel} maxLength={320} style={{ minHeight: 44 }} value={copy.reduced ?? ""}
          onChange={(event) => updateCopyVariant(locale, kind, "reduced", event.target.value, additionalIndex)} /></label>
    </details>;
  }
  async function openDraft(event: ChangeEvent<HTMLInputElement>) {
    const control = event.currentTarget, file = control.files?.[0];
    const sequence = beginOperation();
    setImporting(false);
    setImportErrors([]);
    setImportNotice("");
    if (!file) {
      setImportNotice("Файл не выбран. Текущая форма сохранена.");
      control.value = "";
      return;
    }
    if (file.size === 0 || file.size > BOOKY_JOURNEY_DRAFT_MAX_BYTES) {
      setImportErrors([{ field: "file", message: file.size === 0
        ? "Выбранный файл пуст. Текущая форма сохранена."
        : "Размер файла превышает 512 КиБ. Текущая форма сохранена." }]);
      control.value = "";
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      if (sequence !== operationSequence.current) return;
      const result = parseBookyJourneyDraft(text, catalog);
      if (!result.ok) {
        setImportErrors(result.errors);
        return;
      }
      if (result.input.activity && !(await validateActivity(result.draft, sequence, true))) return;
      if (sequence !== operationSequence.current) return;
      setInput(result.input);
      setEntityQueries({ country: "", writer: "", work: "" });
      setAuthorQuery("");
      setModeledPrerequisites([]);
      setPreview(null);
      setErrors([]);
      setNotice("");
      setImportNotice("Черновик открыт. Проверьте форму и запустите предпросмотр заново.");
    } catch {
      if (sequence === operationSequence.current) {
        setImportErrors([{ field: "file", message: "Не удалось прочитать файл. Текущая форма сохранена." }]);
      }
    } finally {
      if (sequence === operationSequence.current) {
        setImporting(false);
        control.value = "";
      }
    }
  }
  function saveWorkspace() {
    setWorkspaceErrors([]);
    setWorkspaceNotice("");
    const result = createBookyJourneyWorkspace(input);
    if (!result.ok) { setWorkspaceErrors(result.errors); return; }
    let objectUrl: string | undefined;
    try {
      objectUrl = URL.createObjectURL(new Blob([JSON.stringify(result.workspace, null, 2) + "\n"], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = objectUrl; link.download = "booky-journey.workspace.json";
      document.body.appendChild(link); link.click(); link.remove();
      setWorkspaceNotice("Форма подготовлена для скачивания. Незавершённые поля сохранены в рабочем файле.");
    } catch { setWorkspaceErrors([{ field: "workspace", message: "Не удалось скачать рабочий файл. Повторите сохранение." }]); }
    finally { if (objectUrl) { const completedUrl = objectUrl; window.setTimeout(() => URL.revokeObjectURL(completedUrl), 1000); } }
  }
  async function openWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const control = event.currentTarget, file = control.files?.[0], readSequence = ++workspaceReadSequence.current;
    const sourceSequence = operationSequence.current;
    setWorkspaceImporting(false); setWorkspaceErrors([]); setWorkspaceNotice("");
    if (!file || file.size === 0 || file.size > BOOKY_JOURNEY_DRAFT_MAX_BYTES) {
      if (!file) setWorkspaceNotice("Файл не выбран. Текущая форма сохранена.");
      else setWorkspaceErrors([{ field: "workspace", message: file.size === 0 ? "Рабочий файл пуст. Текущая форма сохранена." : "Размер рабочего файла превышает 512 КиБ. Текущая форма сохранена." }]);
      control.value = ""; return;
    }
    setWorkspaceImporting(true);
    try {
      const text = await file.text();
      if (readSequence !== workspaceReadSequence.current) return;
      if (sourceSequence !== operationSequence.current) { setWorkspaceNotice("Открытие рабочего файла отменено: форма или предпросмотр изменились."); return; }
      const result = parseBookyJourneyWorkspace(text);
      if (!result.ok) { setWorkspaceErrors(result.errors); return; }
      beginOperation();
      setInput(result.workspace.input);
      setEntityQueries({ country: "", writer: "", work: "" }); setAuthorQuery(""); setModeledPrerequisites([]);
      setPreview(null); setErrors([]); setNotice(""); setImportErrors([]); setImportNotice("");
      setWorkspaceNotice("Форма открыта для продолжения. Перед экспортом черновика проверьте маршрут.");
    } catch {
      if (readSequence === workspaceReadSequence.current) setWorkspaceErrors([{ field: "workspace", message: "Не удалось прочитать рабочий файл. Текущая форма сохранена." }]);
    } finally {
      if (readSequence === workspaceReadSequence.current) { setWorkspaceImporting(false); control.value = ""; }
    }
  }
  async function showPreview() {
    const sequence = beginOperation();
    setPreview(null);
    setNotice("");
    const result = createBookyJourneyDraft(input, catalog);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (input.activity && !(await validateActivity(result.draft, sequence))) return;
    if (sequence !== operationSequence.current) return;
    setPreviewCopyView("body");
    setModeledPrerequisites([]);
    setPreview({ draft: result.draft, locale: "ru", step: 0 });
  }
  async function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sequence = beginOperation();
    setNotice("");
    const result = createBookyJourneyDraft(input, catalog);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    if (input.activity && !(await validateActivity(result.draft, sequence))) return;
    if (sequence !== operationSequence.current) return;
    let objectUrl: string | undefined;
    try {
      const blob = new Blob([JSON.stringify(result.draft, null, 2) + "\n"], { type: "application/json;charset=utf-8" });
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${input.id}-v${input.version}-draft.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice("Черновик JSON подготовлен для скачивания. Он не сохранён в базе и не опубликован.");
    } catch {
      setErrors([{ field: "export", message: "Не удалось скачать файл. Проверьте доступ к загрузкам и повторите действие." }]);
    } finally {
      if (objectUrl) {
        const completedUrl = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(completedUrl), 1000);
      }
    }
  }

  function englishLabel(label: { ru: string; en: string } | undefined) {
    if (!label) return null;
    return <p><small>{label.en || "Английское название пока не подтверждено"}</small></p>;
  }

  return <form ref={formControl} className="site-copy-editor" onSubmit={download} noValidate>
    <section className="editorial-note" aria-label="Границы черновика">
      <strong>Локальный черновик для взрослой аудитории</strong>
      <p>Экспорт сохраняет файл на вашем устройстве. Изменения не записываются в базу или историю редакции.
        Тексты ещё требуют проверки; публикация, детский доступ и озвучка отключены.</p>
    </section>
    {!available && <p className="form-message" role="alert">Нет доступных канонических путей страна → писатель → книга. Экспорт отключён.</p>}

    <details className="panel site-copy-card" aria-labelledby="journey-open-heading">
      <summary id="journey-open-heading" style={{ minHeight: 44, cursor: "pointer", padding: "10px 0" }}>Открыть локальный черновик</summary>
      <p><span className="badge">JSON · до 512 КиБ</span></p>
      <p id="journey-open-description">Выберите ранее экспортированный файл JSON. Только успешная проверка заменит текущую форму.
        При ошибке форма и предпросмотр сохранятся.</p>
      <label className="field"><span id="journey-open-file-label">Открыть черновик JSON</span>
        <input ref={fileControl} className="journey-draft-open-file" type="file" accept=".json" aria-labelledby="journey-open-file-label"
          aria-describedby="journey-open-description" aria-busy={importing} onChange={openDraft} /></label>
      <p aria-live="polite">{importing ? "Чтение и проверка черновика…" : importNotice}</p>
      {importErrors.length > 0 && <div className="form-message" role="alert">
        <strong>Черновик не открыт:</strong>
        <ul>{importErrors.map((error, index) => <li key={`${error.field}-${index}`}>{error.message}</li>)}</ul>
      </div>}
      <details data-booky-workspace style={{ minWidth: 0 }}>
        <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Форма для продолжения</summary>
        <p id={workspaceHelpId}>Рабочий файл .workspace.json сохраняет незавершённые поля. Готовый черновик маршрута открывается и экспортируется отдельно.</p>
        <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, maxWidth: "100%", whiteSpace: "normal" }} onClick={saveWorkspace}>Сохранить форму для продолжения</button>
        <label className="field"><span>Открыть форму для продолжения</span>
          <input id={errorPrefix + "-workspace-file"} className="journey-draft-open-file" type="file" accept=".json" style={{ minHeight: 44, maxWidth: "100%" }}
            aria-describedby={workspaceHelpId + (workspaceErrors.length ? " " + workspaceErrorId : "")} aria-busy={workspaceImporting} onChange={openWorkspace} /></label>
        <p role="status" aria-live="polite">{workspaceImporting ? "Чтение рабочего файла…" : workspaceNotice}</p>
        {workspaceErrors.length > 0 && <div id={workspaceErrorId} className="form-message" role="alert">
          <strong>Рабочий файл:</strong><ul>{workspaceErrors.map((error, index) => <li key={index}>{error.message}</li>)}</ul>
        </div>}
      </details>
    </details>

    <section className="panel site-copy-card" aria-labelledby="journey-conditions-heading">
      <header><h2 id="journey-conditions-heading">Маршрут и условия</h2><span className="badge">Черновик · RU / EN</span></header>
      <div className="site-copy-locales">
        <label className="field"><span>Идентификатор маршрута</span>
          <input {...fieldProps("id")} maxLength={48} value={input.id} onChange={(event) => update({ id: event.target.value })} autoComplete="off" spellCheck={false} /></label>
        <label className="field"><span>Версия</span>
          <input {...fieldProps("version")} type="number" min={1} max={1000000} step={1} value={input.version || ""} onChange={(event) => update({ version: Number(event.target.value) })} /></label>
        <label className="field"><span>Возраст от</span>
          <input {...fieldProps("ageRange.min", ["ageRange"])} type="number" min={18} max={120} step={1} value={input.ageRange.min || ""} onChange={(event) => update({ ageRange: { ...input.ageRange, min: Number(event.target.value) } })} /></label>
        <label className="field"><span>Возраст до</span>
          <input {...fieldProps("ageRange.max", ["ageRange"])} type="number" min={18} max={120} step={1} value={input.ageRange.max || ""} onChange={(event) => update({ ageRange: { ...input.ageRange, max: Number(event.target.value) } })} /></label>
        <label className="field"><span id="journey-reading-level-label">Уровень чтения</span>
          <select {...fieldProps("readingLevel")} aria-labelledby="journey-reading-level-label" value={input.readingLevel} onChange={(event) => update({ readingLevel: event.target.value as JourneyDraftInput["readingLevel"] })}>
            <option value="plain">Простой</option><option value="developing">Развивающийся</option><option value="fluent">Свободный</option>
          </select></label>
        <label className="field"><span>Примерная длительность (мин)</span>
          <input {...fieldProps("estimatedDurationMinutes")} type="number" min={1} max={1440} step={1} value={input.estimatedDurationMinutes || ""} onChange={(event) => update({ estimatedDurationMinutes: Number(event.target.value) })} /></label>
      </div>
      <p><small>Условия задаёт редактор. Они не назначают возраст или уровень чтения пользователям.</small></p>
      <details data-booky-prerequisites aria-labelledby={draftFieldId("prerequisites")} style={{ minWidth: 0 }}>
        <summary {...fieldProps("prerequisites")} style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Предварительные маршруты · неподтверждённые ссылки</summary>
        <p>Это ссылки на другие маршруты. Их существование и прохождение здесь не проверяются; редакционная проверка выполняется отдельно.</p>
        {!input.prerequisites?.length && <p>Ссылки не заданы.</p>}
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {input.prerequisites?.map((reference, index) => <li key={index} className="site-copy-grid" style={{ minWidth: 0 }}>
            <div className="site-copy-locales">
              <label className="field"><span>ID предварительного маршрута {index + 1}</span>
                <input {...fieldProps("prerequisites." + index + ".id")} value={reference.id} maxLength={96} autoComplete="off" spellCheck={false}
                  style={{ minHeight: 44 }} onChange={(event) => update({ prerequisites: input.prerequisites!.map((item, i) => i === index ? { ...item, id: event.target.value } : item) })} /></label>
              <label className="field"><span>Версия предварительного маршрута {index + 1}</span>
                <input {...fieldProps("prerequisites." + index + ".version")} type="number" min={1} max={1000000} step={1} value={reference.version || ""}
                  style={{ minHeight: 44 }} onChange={(event) => update({ prerequisites: input.prerequisites!.map((item, i) => i === index ? { ...item, version: Number(event.target.value) } : item) })} /></label>
            </div>
            <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, maxWidth: "100%" }} onClick={() => {
              const remaining = input.prerequisites!.filter((_, i) => i !== index); update({ prerequisites: remaining.length ? remaining : undefined });
            }}>Удалить ссылку {index + 1}</button>
          </li>)}
        </ol>
        {(input.prerequisites?.length ?? 0) < 16 && <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, maxWidth: "100%", marginTop: 12 }}
          onClick={() => update({ prerequisites: [...(input.prerequisites ?? []), { id: "", version: 1 }] })}>Добавить предварительный маршрут</button>}
      </details>
      <div className="site-copy-locales">
        {locales.map((locale) => <div className="site-copy-grid" key={locale}>
          <label className="field"><span>Название маршрута ({locale.toUpperCase()})</span>
            <input {...fieldProps("copy." + locale + ".title")} lang={locale} maxLength={200} value={input.copy[locale].title} onChange={(event) => updateCopy(locale, "title", event.target.value)} /></label>
          <label className="field"><span>Описание маршрута ({locale.toUpperCase()})</span>
            <textarea {...fieldProps("copy." + locale + ".description")} lang={locale} maxLength={800} value={input.copy[locale].description} onChange={(event) => updateCopy(locale, "description", event.target.value)} /></label>
        </div>)}
      </div>
    </section>

    <ol className="site-copy-grid" aria-label="Путь маршрута" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((step) => <li key={step.key}>
        {step.number > 1 && <p aria-hidden="true" style={{ textAlign: "center", margin: "0 0 14px" }}>↓</p>}
        {step.key === "checkpoint" && <details className="panel site-copy-card" aria-labelledby={draftFieldId("fact")}>
          <summary {...fieldProps("fact")} style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Необязательный факт · источники</summary>
          <p>Добавьте собственный текст о выбранной стране, писателе или основной книге и источники отдельно для RU и EN. Текст и источники ещё требуют проверки.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={!!input.fact} onChange={(event) => toggleFact(event.target.checked)} />
            Добавить факт с источниками
          </label>
          {input.fact && <div className="site-copy-grid" data-booky-fact-editor>
            <label className="field"><span>Объект факта</span>
              <select {...fieldProps("fact.subject")} aria-describedby={[fieldProps("fact.subject")["aria-describedby"], draftFieldId("fact.subject") + "-help"].filter(Boolean).join(" ")}
                style={{ minHeight: 44, width: "100%", minWidth: 0 }} value={input.fact.subject ?? "work"}
                onChange={(event) => updateFactSubject(event.target.value as "country" | "writer" | "work")}>
                <option value="work">Основная книга</option><option value="country">Страна</option><option value="writer">Писатель</option>
              </select></label>
            <p id={draftFieldId("fact.subject") + "-help"}>Факт остаётся после основной книги. Дополнительные книги не являются объектами этого факта.</p>
            <p data-booky-fact-subject>{input.fact.subject === "country" ? "Страна: " : input.fact.subject === "writer" ? "Писатель: " : "Основная книга: "}{
              (input.fact.subject === "country" ? country : input.fact.subject === "writer" ? writer : work)?.label.ru || "Сначала выберите объект маршрута"}</p>
            <div className="site-copy-locales">
              {locales.map((locale) => <div key={locale} className="site-copy-grid">
                <label className="field"><span>Название факта ({locale.toUpperCase()})</span>
                  <input {...fieldProps("fact.copy." + locale + ".title")} lang={locale} maxLength={160} style={{ minHeight: 44 }} value={input.fact!.copy[locale].title}
                    onChange={(event) => updateFactCopy(locale, "title", event.target.value)} /></label>
                <label className="field"><span>Текст факта ({locale.toUpperCase()})</span>
                  <textarea {...fieldProps("fact.copy." + locale + ".body")} lang={locale} maxLength={1600} style={{ minHeight: 44 }} value={input.fact!.copy[locale].body}
                    onChange={(event) => updateFactCopy(locale, "body", event.target.value)} /></label>
                {copyVariantFields(locale, "sourced-fact", input.fact!.copy[locale])}
                <p>Источники ({locale.toUpperCase()}): от 1 до 16. Укажите дату обращения вручную в формате UTC, например 2026-09-30T12:00:00.000Z.</p>
                {input.fact!.copy[locale].sources.map((source, index) => <div key={index} className="site-copy-grid">
                  <label className="field"><span>ID источника {index + 1} ({locale.toUpperCase()})</span>
                    <input {...fieldProps("fact.copy." + locale + ".sources." + index + ".id")} maxLength={96} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }} value={source.id}
                      onChange={(event) => updateFactSource(locale, index, "id", event.target.value)} /></label>
                  <label className="field"><span>HTTPS URL источника {index + 1} ({locale.toUpperCase()})</span>
                    <input {...fieldProps("fact.copy." + locale + ".sources." + index + ".url")} type="text" inputMode="url" maxLength={1000} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }} value={source.url}
                      onChange={(event) => updateFactSource(locale, index, "url", event.target.value)} /></label>
                  <label className="field"><span>Дата обращения к источнику {index + 1} ({locale.toUpperCase()})</span>
                    <input {...fieldProps("fact.copy." + locale + ".sources." + index + ".accessedAt")} maxLength={24} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }} value={source.accessedAt}
                      onChange={(event) => updateFactSource(locale, index, "accessedAt", event.target.value)} /></label>
                  {input.fact!.copy[locale].sources.length > 1 && <button className="button-secondary" type="button" style={{ minHeight: 44 }} onClick={() => {
                    if (input.fact) update({ fact: { ...input.fact, copy: { ...input.fact.copy, [locale]: {
                      ...input.fact.copy[locale], sources: input.fact.copy[locale].sources.filter((_, i) => i !== index),
                    } } } });
                  }}>Удалить источник {index + 1} ({locale.toUpperCase()})</button>}
                </div>)}
                {input.fact!.copy[locale].sources.length < 16 && <button className="button-secondary" type="button" style={{ minHeight: 44 }} onClick={() => {
                  if (input.fact) update({ fact: { ...input.fact, copy: { ...input.fact.copy, [locale]: {
                    ...input.fact.copy[locale], sources: [...input.fact.copy[locale].sources, { id: "", url: "", accessedAt: "" }],
                  } } } });
                }}>Добавить источник ({locale.toUpperCase()})</button>}
              </div>)}
            </div>
          </div>}
        </details>}
        {step.key === "checkpoint" && <details className="panel site-copy-card" aria-labelledby={draftFieldId("activity")}>
          <summary {...fieldProps("activity")} style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Необязательное задание · выбрать автора</summary>
          <p>Добавьте вопрос между книгой и завершением. Выберите 2–4 автора из каталога; соответствие книге проверяется перед просмотром и экспортом.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={!!input.activity} onChange={(event) => toggleActivity(event.target.checked)} />
            Добавить задание «Книга и автор»
          </label>
          {input.activity && <div className="site-copy-grid" data-booky-activity-editor>
            <p>Книга: {work?.label.ru || "Сначала выберите книгу"}</p>
            <div data-booky-author-search style={{ minWidth: 0 }}>
              <label className="field"><span>Поиск авторов задания (RU / EN / ID)</span>
                <input id={authorSearchId} type="search" value={authorQuery} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }}
                  aria-describedby={authorSearchId + "-help " + authorSearchId + "-result"}
                  onChange={(event) => setAuthorQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /></label>
              <p id={authorSearchId + "-help"}>Автор или страна: названия RU, EN и ID. Выбирайте автора в вариантах ниже.
                Авторы без подтверждённого EN или уже выбранные в другом варианте недоступны.</p>
              <p id={authorSearchId + "-result"} data-booky-author-search-result role="status" aria-live="polite" style={{ overflowWrap: "anywhere" }}>
                Совпадений: {authorMatchCount}.{retainsAuthorSelection && " Выбранные авторы вне результатов остаются в своих списках и не входят в число совпадений."}
              </p>
              <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, maxWidth: "100%" }}
                disabled={authorQuery === ""} onClick={() => setAuthorQuery("")}>Очистить поиск авторов</button>
            </div>
            {input.activity.choices.map((choice, index) => <div key={index} className="site-copy-grid">
              <label className="field"><span id={`journey-choice-${index}`}>Автор · вариант {index + 1}</span>
                <select {...fieldProps("activity.choices." + index)} aria-labelledby={`journey-choice-${index}`} value={choiceKey(choice)} onChange={(event) => {
                  const selected = choiceWriters.find((item) => choiceKey({ countryId: item.country.id, writerId: item.writer.id }) === event.target.value);
                  if (input.activity) update({ activity: { ...input.activity, choices: input.activity.choices.map((item, i) => i === index
                    ? { countryId: selected?.country.id || "", writerId: selected?.writer.id || "" } : item) } });
                }}>
                  <option value={choiceKey({ countryId: "", writerId: "" })}>Выберите автора</option>
                  {(choice.countryId || choice.writerId) && !choiceWriters.some(item => choiceKey({ countryId: item.country.id, writerId: item.writer.id }) === choiceKey(choice))
                    && <option value={choiceKey(choice)} disabled>{choice.countryId} / {choice.writerId} · недоступный автор</option>}
                  {choiceWriters.filter((item) => matchesAuthor(item)
                    || choiceKey(choice) === choiceKey({ countryId: item.country.id, writerId: item.writer.id })).map((item) => {
                    const key = choiceKey({ countryId: item.country.id, writerId: item.writer.id });
                    return <option key={key} value={key} disabled={!item.writer.label.en || input.activity?.choices.some((other, i) => i !== index && choiceKey(other) === key)}>
                      {item.writer.label.ru} · {item.country.label.ru}{!item.writer.label.en ? " · EN пока не подтверждён" : ""}
                    </option>;
                  })}
                </select>
              </label>
              {input.activity!.choices.length > 2 && <button className="button-secondary" type="button" style={{ minHeight: 44 }} onClick={() => {
                if (input.activity) update({ activity: { ...input.activity, choices: input.activity.choices.filter((_, i) => i !== index) } });
              }}>Удалить вариант {index + 1}</button>}
            </div>)}
            {input.activity.choices.length < 4 && <button className="button-secondary" type="button" style={{ minHeight: 44 }} onClick={() => {
              if (input.activity) update({ activity: { ...input.activity, choices: [...input.activity.choices, { countryId: "", writerId: "" }] } });
            }}>Добавить вариант автора</button>}
            <div className="site-copy-locales">
              {locales.map((locale) => <div key={locale} className="site-copy-grid">
                <label className="field"><span>Вопрос задания ({locale.toUpperCase()})</span>
                  <input {...fieldProps("activity.copy." + locale + ".title")} lang={locale} maxLength={160} value={input.activity!.copy[locale].title} onChange={(event) => updateActivityCopy(locale, "title", event.target.value)} /></label>
                <label className="field"><span>Подсказка задания ({locale.toUpperCase()})</span>
                  <textarea {...fieldProps("activity.copy." + locale + ".body")} lang={locale} maxLength={1600} value={input.activity!.copy[locale].body} onChange={(event) => updateActivityCopy(locale, "body", event.target.value)} /></label>
                {copyVariantFields(locale, "activity", input.activity!.copy[locale])}
              </div>)}
            </div>
          </div>}
        </details>}
        {step.key === "checkpoint" && optionalNodeOrder.length > 0 && <details className="panel site-copy-card" data-booky-optional-order aria-labelledby={draftFieldId("optionalNodeOrder")}>
          <summary {...fieldProps("optionalNodeOrder")} style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Порядок необязательных шагов</summary>
          <p>Эти шаги идут после книги и перед завершением. Страна, писатель и книга сохраняют свои места.</p>
          <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
            {optionalNodeOrder.map((kind, index) => <li key={optionalNodeOrder.indexOf(kind) === optionalNodeOrder.lastIndexOf(kind) ? kind : kind + "-" + index} data-optional-node-kind={kind} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ minWidth: 0, flex: "1 1 100%", overflowWrap: "anywhere" }}>{index + 4 + (input.additionalWorks?.length ?? 0)}. {previewStepLabels.ru[kind]}</span>
              <button className="button-secondary" type="button" aria-label={`Переместить шаг «${previewStepLabels.ru[kind]}» раньше`} aria-disabled={index === 0}
                style={{ minHeight: 44, minWidth: 44 }} onClick={(event) => moveOptionalNode(kind, -1, event.currentTarget)}>Раньше</button>
              <button className="button-secondary" type="button" aria-label={`Переместить шаг «${previewStepLabels.ru[kind]}» позже`} aria-disabled={index === optionalNodeOrder.length - 1}
                style={{ minHeight: 44, minWidth: 44 }} onClick={(event) => moveOptionalNode(kind, 1, event.currentTarget)}>Позже</button>
            </li>)}
          </ol>
          {Object.hasOwn(input, "optionalNodeOrder") && <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, marginTop: 12 }} onClick={restoreOptionalNodeOrder}>Вернуть обычный порядок</button>}
        </details>}
        <section className="panel site-copy-card" aria-labelledby={`journey-step-${step.key}`}>
          <header><h2 id={`journey-step-${step.key}`}>{step.number + (step.key === "checkpoint" ? Number(!!input.fact) + Number(!!input.activity) + (input.additionalWorks?.length ?? 0) : step.key === "work" ? input.additionalWorks?.length ?? 0 : 0)}. {step.title}</h2>
            <span className="badge">{step.key === "checkpoint" ? "Завершение" : "Канонический выбор"}</span></header>
          {step.key === "country" && <>
            {entitySearchFields("country", !available, countrySearch)}
            <label className="field"><span id="journey-country-label">Страна</span>
              <select {...fieldProps("countryId")} aria-labelledby="journey-country-label" value={input.countryId} disabled={!available} style={{ minHeight: 44 }} onChange={(event) => {
                if (event.target.value !== input.countryId) setEntityQueries((current) => ({ ...current, writer: "", work: "" }));
                update({ countryId: event.target.value, writerId: "", workId: "" });
              }}>
                <option value="">Выберите страну</option>
                {input.countryId && !country && <option value={input.countryId} disabled>{input.countryId} · недоступная страна</option>}
                {countrySearch.options.map((item) => <option key={item.id} value={item.id}>{item.label.ru}</option>)}
              </select></label>{englishLabel(country?.label)}
          </>}
          {step.key === "writer" && <>
            {entitySearchFields("writer", !country, writerSearch)}
            <label className="field"><span id="journey-writer-label">Писатель</span>
              <select {...fieldProps("writerId")} aria-labelledby="journey-writer-label" value={input.writerId} disabled={!country} style={{ minHeight: 44 }} onChange={(event) => {
                if (event.target.value !== input.writerId) setEntityQueries((current) => ({ ...current, work: "" }));
                update({ writerId: event.target.value, workId: "" });
              }}>
                <option value="">{country ? "Выберите писателя" : "Сначала выберите страну"}</option>
                {input.writerId && !writer && <option value={input.writerId} disabled>{input.writerId} · недоступный писатель этой страны</option>}
                {writerSearch.options.map((item) => <option key={item.id} value={item.id}>{item.label.ru}</option>)}
              </select></label>{englishLabel(writer?.label)}
          </>}
          {step.key === "work" && <>
            {entitySearchFields("work", !writer, workSearch)}
            <label className="field"><span id="journey-work-label">Книга</span>
              <select {...fieldProps("workId")} aria-labelledby="journey-work-label" value={input.workId} disabled={!writer} style={{ minHeight: 44 }} onChange={(event) => update({ workId: event.target.value })}>
                <option value="">{writer ? "Выберите книгу" : "Сначала выберите писателя"}</option>
                {input.workId && !work && <option value={input.workId} disabled>{input.workId} · недоступная книга этого писателя</option>}
                {workSearch.options.map((item) => <option key={item.id} value={item.id}>{item.label.ru}</option>)}
              </select></label>{englishLabel(work?.label)}
            <details data-booky-additional-works aria-labelledby={draftFieldId("additionalWorks")} style={{ minWidth: 0 }}>
              <summary {...fieldProps("additionalWorks")} style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Дополнительные книги ({input.additionalWorks?.length ?? 0})</summary>
              <p>До восьми книг выбранного писателя в вашем порядке, перед основной книгой. Задание и завершение относятся к основной книге; объект факта выбирается отдельно. При изменении выбора тексты сохраняются; недоступную ссылку исправьте или удалите.</p>
              {(input.additionalWorks ?? []).map((row, index) => <fieldset key={index} data-booky-additional-work={index}
                style={{ minWidth: 0, margin: "12px 0", padding: 12 }}>
                <legend>Дополнительная книга {index + 1}</legend>
                <label className="field"><span>Книга · дополнение {index + 1}</span>
                  <select {...fieldProps("additionalWorks." + index + ".workId")} value={row.workId} disabled={!writer} style={{ minHeight: 44 }}
                    onChange={(event) => update({ additionalWorks: input.additionalWorks!.map((item, i) => i === index ? { ...item, workId: event.target.value } : item) })}>
                    <option value="">{writer ? "Выберите дополнительную книгу" : "Сначала выберите писателя"}</option>
                    {row.workId && !writer?.works.some((item) => item.id === row.workId) && <option value={row.workId} disabled>{row.workId} · не принадлежит выбранному писателю</option>}
                    {(writer?.works ?? []).map((item) => {
                      const reason = item.id === input.workId ? "основная книга" : input.additionalWorks!.some((other, i) => i !== index && other.workId === item.id)
                        ? "уже добавлена" : !item.label.ru || !item.label.en ? "нет названия RU/EN" : "";
                      return <option key={item.id} value={item.id} disabled={!!reason}>{item.label.ru || item.id}{reason ? " · " + reason : ""}</option>;
                    })}
                  </select></label>
                {englishLabel(writer?.works.find((item) => item.id === row.workId)?.label)}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {([-1, 1] as const).map((direction) => <button key={direction} className="button-secondary" type="button"
                    data-booky-additional-order-index={index} data-booky-additional-order-direction={direction}
                    aria-label={`Дополнительная книга ${index + 1} · ${direction === -1 ? "раньше" : "позже"}`} aria-disabled={direction === -1 ? index === 0 : index === (input.additionalWorks?.length ?? 0) - 1}
                    style={{ minHeight: 44, minWidth: 44, maxWidth: "100%" }} onClick={(event) => moveAdditionalWork(index, direction, event.currentTarget)}>{direction === -1 ? "Раньше" : "Позже"}</button>)}
                  <button className="button-secondary" type="button" style={{ minHeight: 44, minWidth: 44, maxWidth: "100%" }} onClick={(event) => {
                    const remaining = input.additionalWorks!.filter((_, i) => i !== index);
                    if (!remaining.length && event.currentTarget === document.activeElement) additionalOrderFocus.current = document.getElementById(draftFieldId("additionalWorks"));
                    update({ additionalWorks: remaining.length ? remaining : undefined });
                  }}>Удалить дополнение {index + 1}</button>
                </div>
                <div className="site-copy-locales">
                  {locales.map((locale) => <div key={locale} className="site-copy-grid">
                    <label className="field"><span>Название дополнительной книги {index + 1} ({locale.toUpperCase()})</span>
                      <input {...fieldProps("additionalWorks." + index + ".copy." + locale + ".title")} lang={locale} maxLength={160} style={{ minHeight: 44 }} value={row.copy[locale].title}
                        onChange={(event) => updateAdditionalWorkCopy(index, locale, "title", event.target.value)} /></label>
                    <label className="field"><span>Подсказка дополнительной книги {index + 1} ({locale.toUpperCase()})</span>
                      <textarea {...fieldProps("additionalWorks." + index + ".copy." + locale + ".body")} lang={locale} maxLength={1600} style={{ minHeight: 44 }} value={row.copy[locale].body}
                        onChange={(event) => updateAdditionalWorkCopy(index, locale, "body", event.target.value)} /></label>
                    {copyVariantFields(locale, "work", row.copy[locale], index)}
                  </div>)}
                </div>
              </fieldset>)}
              {(input.additionalWorks?.length ?? 0) < 8 && <button className="button-secondary" type="button" disabled={!writer}
                style={{ minHeight: 44, minWidth: 44, maxWidth: "100%" }} onClick={() => update({ additionalWorks: [...(input.additionalWorks ?? []), { workId: "", copy: {
                  ru: { title: "Откройте дополнительную книгу", body: "Просмотрите выбранную дополнительную книгу." },
                  en: { title: "Open the additional work", body: "Explore the selected additional work." },
                } }] })}>Добавить книгу</button>}
            </details>
          </>}
          {step.key === "checkpoint" && <p>Завершение связано с выбранной книгой. Новая сущность каталога не создаётся.</p>}
          <div className="site-copy-locales">
            {locales.map((locale) => <div className="site-copy-grid" key={locale}>
              <label className="field"><span>Название шага «{step.title}» ({locale.toUpperCase()})</span>
                <input {...fieldProps("copy." + locale + ".nodes." + step.key + ".title")} lang={locale} maxLength={160} value={input.copy[locale].nodes[step.key].title} onChange={(event) => updateNode(locale, step.key, "title", event.target.value)} /></label>
              <label className="field"><span>Подсказка шага «{step.title}» ({locale.toUpperCase()})</span>
                <textarea {...fieldProps("copy." + locale + ".nodes." + step.key + ".body")} lang={locale} maxLength={1600} value={input.copy[locale].nodes[step.key].body} onChange={(event) => updateNode(locale, step.key, "body", event.target.value)} /></label>
              {copyVariantFields(locale, step.key, input.copy[locale].nodes[step.key])}
            </div>)}
          </div>
        </section>
      </li>)}
    </ol>
    <section className="panel site-copy-card" aria-labelledby="journey-preview-heading" style={{ minWidth: 0 }}>
      <header><h2 id="journey-preview-heading">Предпросмотр маршрута</h2><span className="badge">Взрослый черновик</span></header>
      <p>Просмотрите тексты шагов перед экспортом. Это локальный просмотр; он не запускает маршрут в приложении.</p>
      <button className="button-secondary" type="button" disabled={!available} onClick={showPreview} aria-busy={validating} style={{ minHeight: 44, minWidth: 44 }}>Предпросмотр маршрута</button>
      {preview && previewDefinition && previewNode && previewDialogue && <div data-booky-journey-preview className="site-copy-grid" style={{ marginTop: 18, minWidth: 0 }}>
        <details data-booky-preview-width lang={preview.locale} style={{ minWidth: 0 }}>
          <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{preview.locale === "ru" ? "Ширина предпросмотра" : "Preview width"}</summary>
          <label className="field" style={{ maxWidth: 320, minWidth: 0 }}><span>{preview.locale === "ru" ? "Ширина области предпросмотра" : "Preview frame width"}</span>
            <select lang={preview.locale} data-booky-preview-width-choice value={previewWidth} style={{ minHeight: 44 }}
              onChange={(event) => changePreviewWidth(event.target.value as PreviewWidth)}>
              <option value="available">{preview.locale === "ru" ? "По доступной ширине" : "Available width"}</option>
              <option value="320">{preview.locale === "ru" ? "320 пикс." : "320 px"}</option>
              <option value="768">{preview.locale === "ru" ? "768 пикс." : "768 px"}</option>
            </select>
          </label>
          <p>{preview.locale === "ru" ? "Область помещается в доступное место." : "The frame fits the available space."}</p>
        </details>
        <div data-booky-preview-frame data-preview-width={previewWidth} className="site-copy-grid" style={{
          width: "100%", maxWidth: previewWidth === "available" ? "100%" : Number(previewWidth), minWidth: 0,
          boxSizing: "border-box", padding: 12, border: "1px solid rgba(87, 54, 123, 0.2)", borderRadius: 12,
        }}>
        <div role="group" aria-label="Язык предпросмотра" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {locales.map((locale) => <button key={locale} className={preview.locale === locale ? "button" : "button-secondary"} type="button" lang={locale}
            aria-pressed={preview.locale === locale} style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => changePreviewLocale(locale)}>{locale === "ru" ? "Русский" : "English"}</button>)}
        </div>
        <p lang={preview.locale}>{preview.locale === "ru" ? "Возраст" : "Age"}: {previewDefinition.ageRange.min}–{previewDefinition.ageRange.max} {preview.locale === "ru" ? "лет" : "years"} · {preview.locale === "ru" ? "Уровень чтения" : "Reading level"}: {
          preview.locale === "ru"
            ? previewDefinition.readingLevel === "plain" ? "Простой" : previewDefinition.readingLevel === "developing" ? "Развивающийся" : "Свободный"
            : previewDefinition.readingLevel === "plain" ? "Plain" : previewDefinition.readingLevel === "developing" ? "Developing" : "Fluent"
        } · {preview.locale === "ru" ? "Оценка" : "Estimate"}: {previewDefinition.overview?.estimatedDurationMinutes} {preview.locale === "ru" ? "мин" : "min"}</p>
        <details data-booky-review-report lang={preview.locale} style={{ minWidth: 0 }}>
          <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{preview.locale === "ru" ? "Отчёт по черновику" : "Draft review report"} ({reviewRows.length})</summary>
          <p>{preview.locale === "ru" ? "Указанные тексты и источники по шагам. Редакционная проверка остаётся отдельной." : "Supplied copy and sources by step. Editorial review remains separate."}</p>
          <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {reviewRows.map((row) => <li key={row.id} data-review-node={row.id} style={{ minWidth: 0, padding: "10px 0", borderTop: "1px solid rgba(87, 54, 123, 0.2)" }}>
              <strong>{row.step + 1}. {previewNodeLabel(preview.locale, row.id, row.kind)}</strong>
              {row.kind === "sourced-fact" && <p data-review-subject>{previewFactSubjectLabel(preview.locale)}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 12, marginTop: 8 }}>
                {row.copies.map((copy) => <div key={copy.locale} lang={copy.locale} data-review-locale={copy.locale} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                  <strong>{copy.locale.toUpperCase()}</strong>
                  <dl style={{ margin: "6px 0" }}>
                    <div><dt style={{ display: "inline" }}>{copy.locale === "ru" ? "Заголовок и полный текст: " : "Title and full text: "}</dt><dd data-review-copy="main" data-copy-presence={copy.supplied ? "authored" : "absent"} style={{ display: "inline", margin: 0 }}>{copy.locale === "ru" ? copy.supplied ? "указаны" : "не указаны" : copy.supplied ? "supplied" : "absent"}</dd></div>
                    <div><dt style={{ display: "inline" }}>{copy.locale === "ru" ? "Подпись: " : "Caption: "}</dt><dd data-review-copy="caption" data-copy-presence={copy.captionAuthored ? "authored" : "title-fallback"} style={{ display: "inline", margin: 0 }}>{copy.locale === "ru" ? copy.captionAuthored ? "авторский текст" : "название шага" : copy.captionAuthored ? "authored" : "title fallback"}</dd></div>
                    <div><dt style={{ display: "inline" }}>{copy.locale === "ru" ? "Короткий текст: " : "Short text: "}</dt><dd data-review-copy="reduced" data-copy-presence={copy.reducedAuthored ? "authored" : "title-fallback"} style={{ display: "inline", margin: 0 }}>{copy.locale === "ru" ? copy.reducedAuthored ? "авторский текст" : "название шага" : copy.reducedAuthored ? "authored" : "title fallback"}</dd></div>
                  </dl>
                  {copy.sourceCount !== null && <p data-review-sources data-source-count={copy.sourceCount} style={{ margin: "6px 0" }}>{copy.locale === "ru" ? `Указано источников (не проверены): ${copy.sourceCount}` : `Supplied sources (unreviewed): ${copy.sourceCount}`}</p>}
                  <button className="button-secondary" type="button" data-review-inspect={copy.locale} aria-current={preview.locale === copy.locale && preview.step === row.step ? "step" : undefined}
                    style={{ minHeight: 44, minWidth: 44, maxWidth: "100%", whiteSpace: "normal", textAlign: "start" }}
                    onClick={() => inspectReviewNode(copy.locale, row.step)}>{copy.locale === "ru" ? `Просмотреть RU · ${row.step + 1}` : `Inspect EN · ${row.step + 1}`}</button>
                </div>)}
              </div>
            </li>)}
          </ol>
        </details>
        <details data-booky-preview-profile lang={preview.locale} style={{ minWidth: 0 }}>
          <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{preview.locale === "ru" ? "Профиль предпросмотра" : "Preview profile"}</summary>
          <p>{preview.locale === "ru" ? "Сравнение использует возраст и уровень чтения, заданные для этого черновика." : "This comparison uses the age and reading level declared in this draft."}</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={previewProfile.enabled} onChange={(event) => updatePreviewProfile({ enabled: event.target.checked })} />
            {preview.locale === "ru" ? "Сравнить взрослый профиль" : "Compare an adult profile"}
          </label>
          {previewProfile.enabled && <div className="site-copy-locales" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
            <label className="field"><span>{preview.locale === "ru" ? "Возраст для предпросмотра" : "Preview age"}</span>
              <input type="number" min={18} max={120} step={1} value={previewProfile.age} style={{ minHeight: 44 }}
                onChange={(event) => updatePreviewProfile({ age: event.target.value })} /></label>
            <label className="field"><span>{preview.locale === "ru" ? "Уровень чтения для предпросмотра" : "Preview reading level"}</span>
              <select value={previewProfile.readingLevel} style={{ minHeight: 44 }} onChange={(event) => updatePreviewProfile({ readingLevel: event.target.value })}>
                <option value="">{preview.locale === "ru" ? "Выберите уровень" : "Choose a level"}</option>
                <option value="plain">{preview.locale === "ru" ? "Простой" : "Plain"}</option>
                <option value="developing">{preview.locale === "ru" ? "Развивающийся" : "Developing"}</option>
                <option value="fluent">{preview.locale === "ru" ? "Свободный" : "Fluent"}</option>
              </select>
            </label>
          </div>}
          {previewProfile.enabled && previewPrerequisites.length > 0 && <fieldset data-booky-preview-prerequisites
            aria-describedby={prerequisitePreviewHelpId + " " + prerequisitePreviewReportId} style={{ minWidth: 0, margin: "12px 0 0", padding: 12 }}>
            <legend>{preview.locale === "ru" ? "Модель завершений" : "Modeled completions"}</legend>
            <p id={prerequisitePreviewHelpId}>{preview.locale === "ru"
              ? "Только локальная модель для точных ID и версий. Существование и реальное завершение маршрутов не проверяются."
              : "A local scenario for exact IDs and versions only. Journey existence and real completion are not verified."}</p>
            {previewPrerequisites.map((reference, index) => {
              const key = prerequisiteKey(reference), id = errorPrefix + "-preview-prerequisite-" + index;
              return <label key={key} htmlFor={id} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, overflowWrap: "anywhere" }}>
                <input id={id} type="checkbox" checked={modeledPrerequisites.includes(key)}
                  aria-describedby={prerequisitePreviewHelpId + " " + prerequisitePreviewReportId}
                  onChange={(event) => updateModeledPrerequisite(key, event.target.checked)} />
                <span style={{ minWidth: 0 }}>{preview.locale === "ru" ? "Считать завершённым" : "Model as completed"} · {reference.id} · {preview.locale === "ru" ? "версия" : "version"} {reference.version}</span>
              </label>;
            })}
          </fieldset>}
        </details>
        {previewProfile.enabled && previewProfileResult && <p id="journey-preview-profile-report" data-booky-preview-profile-report data-profile-status={previewProfileResult.status}
          role="status" aria-live="polite" lang={preview.locale}>
          {previewProfileResult.status === "invalid"
            ? preview.locale === "ru" ? "Укажите целый возраст от 18 до 120 лет и выберите уровень чтения." : "Enter a whole age from 18 to 120 and choose a reading level."
            : previewProfileResult.status === "matches"
              ? preview.locale === "ru" ? "Возраст и уровень чтения совпадают с условиями черновика." : "Age and reading level match the draft conditions."
              : [
                previewProfileResult.ageMatches === false ? preview.locale === "ru" ? "Этот возраст не входит в диапазон черновика." : "This age is outside the draft range." : "",
                previewProfileResult.readingLevelMatches === false ? preview.locale === "ru" ? "Уровень чтения отличается от заданного в черновике." : "The reading level differs from the draft." : "",
              ].filter(Boolean).join(" ")}
        </p>}
        {previewProfile.enabled && <p id={prerequisitePreviewReportId} data-booky-preview-prerequisites-report
          data-prerequisite-status={previewPrerequisites.length === 0 ? "none" : missingPreviewPrerequisites.length === 0 ? "all" : modeledPrerequisiteCount === 0 ? "missing" : "partial"}
          role="status" aria-live="polite" lang={preview.locale} style={{ overflowWrap: "anywhere" }}>
          {previewPrerequisites.length === 0
            ? preview.locale === "ru" ? "В черновике нет предварительных маршрутов; модель завершений не ограничивает проверку."
              : "This draft has no prerequisites; the completion scenario does not limit checking."
            : <>{preview.locale === "ru" ? `Модель завершений: ${modeledPrerequisiteCount} из ${previewPrerequisites.length}. ` : `Modeled completions: ${modeledPrerequisiteCount} of ${previewPrerequisites.length}. `}
              {missingPreviewPrerequisites.length === 0
                ? preview.locale === "ru" ? "Все ссылки отмечены в локальной модели. " : "All references are marked in the local scenario. "
                : <>{preview.locale === "ru" ? "Не смоделированы: " : "Not modeled: "}{missingPreviewPrerequisites.map((reference) => reference.id + " · " + (preview.locale === "ru" ? "версия " : "version ") + reference.version).join("; ")}. </>}
              {preview.locale === "ru" ? "Фактическое завершение не проверено." : "Real completion has not been verified."}</>}
        </p>}
        <p role="status" aria-live="polite" lang={preview.locale}>{preview.locale === "ru" ? `Шаг ${preview.step + 1} из ${previewDefinition.nodes.length}` : `Step ${preview.step + 1} of ${previewDefinition.nodes.length}`} · {previewNodeLabel(preview.locale, previewNode.id, previewNode.kind)}</p>
        <details data-booky-journey-step-overview lang={preview.locale} style={{ minWidth: 0 }}>
          <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>
            {preview.locale === "ru" ? "Шаги маршрута" : "Journey steps"} ({previewDefinition.nodes.length})
          </summary>
          <ol aria-label={preview.locale === "ru" ? "Выбор шага предпросмотра" : "Choose a preview step"}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, listStyle: "none", padding: 0, margin: "8px 0" }}>
            {previewDefinition.nodes.map((node, index) => <li key={node.id} style={{ minWidth: 0, maxWidth: "100%" }}>
              <button className={index === preview.step ? "button" : "button-secondary"} type="button" lang={preview.locale}
                data-preview-step-choice={node.id} aria-current={index === preview.step ? "step" : undefined}
                style={{ minHeight: 44, minWidth: 44, maxWidth: "100%", whiteSpace: "normal", textAlign: "start" }}
                onClick={() => jumpPreviewStep(index)}>{index + 1}. {previewNodeLabel(preview.locale, node.id, node.kind)}</button>
            </li>)}
          </ol>
        </details>
        <article lang={preview.locale} aria-label={preview.locale === "ru" ? "Текст выбранного шага" : "Selected step text"}
          data-preview-step={previewNode.id} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <h3>{previewDefinition.title}</h3>
          <p>{previewDefinition.overview?.description}</p>
          <p lang={preview.locale}>{preview.locale === "ru" ? previewNode.kind === "checkpoint" ? "Книга для завершения" : "Каноническая запись" : previewNode.kind === "checkpoint" ? "Work for completion" : "Canonical record"}: {previewEntity?.label[preview.locale]
            ? <span lang={preview.locale}>{previewEntity.label[preview.locale]}</span>
            : <span>{preview.locale === "ru" ? "Английское название пока не подтверждено" : "English title is not confirmed"}</span>}</p>
          <p lang={preview.locale}>{preview.locale === "ru" ? "Экран" : "Screen"}: {preview.locale === "ru" ? previewNode.screen === "globe" ? "Глобус" : "Коллекция" : previewNode.screen === "globe" ? "Globe" : "Collection"}</p>
          <h4>{previewDialogue.payload.copy.title}</h4>
          <label className="field" style={{ maxWidth: 320 }}><span>{preview.locale === "ru" ? "Вариант текста предпросмотра" : "Preview text view"}</span>
            <select lang={preview.locale} data-booky-preview-copy-view value={previewCopyView} style={{ minHeight: 44 }}
              onChange={(event) => changePreviewCopyView(event.target.value as PreviewCopyView)}>
              <option value="body">{preview.locale === "ru" ? "Полный текст" : "Full text"}</option>
              <option value="caption">{preview.locale === "ru" ? "Подпись" : "Caption"}</option>
              <option value="reduced">{preview.locale === "ru" ? "Короткий текст" : "Short text"}</option>
            </select>
          </label>
          <p data-booky-preview-copy={previewCopyView} style={{ whiteSpace: "pre-wrap" }}>{previewDialogue.payload.copy[previewCopyView]}</p>
          <details data-booky-copy-comparison data-comparison-node={previewNode.id} lang={preview.locale} style={{ minWidth: 0 }}>
            <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{preview.locale === "ru" ? "Сравнить тексты RU и EN" : "Compare RU and EN copy"}</summary>
            {previewNode.kind === "sourced-fact" && <p data-booky-comparison-subject>{previewFactSubjectLabel(preview.locale)}</p>}
            <p>{preview.locale === "ru" ? "Тексты текущего шага для сопоставления. Проверка перевода и редакционная проверка остаются отдельными." : "Current-step copy for comparison. Translation and editorial review remain separate."}</p>
            <div data-booky-comparison-columns style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16 }}>
              {comparisonCopies.map((copy) => <section key={copy.locale} lang={copy.locale} data-comparison-locale={copy.locale}
                aria-label={copy.locale === "ru" ? "Текст шага RU для сравнения" : "EN step copy for comparison"} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                <strong>{copy.locale.toUpperCase()}</strong>
                <h5 lang={copy.locale} data-comparison-title style={{ margin: "8px 0", fontSize: "inherit" }}>{copy.copy.title}</h5>
                <p data-comparison-presence={copy.presence} style={{ margin: "8px 0" }}>{copy.locale === "ru"
                  ? `${previewCopyView === "body" ? "Полный текст" : previewCopyView === "caption" ? "Подпись" : "Короткий текст"}: ${copy.presence === "authored" ? "авторский текст" : "название шага"}`
                  : `${previewCopyView === "body" ? "Full text" : previewCopyView === "caption" ? "Caption" : "Short text"}: ${copy.presence === "authored" ? "authored" : "title fallback"}`}</p>
                <p lang={copy.locale} data-comparison-copy={previewCopyView} style={{ margin: "8px 0", whiteSpace: "pre-wrap" }}>{copy.copy[previewCopyView]}</p>
              </section>)}
            </div>
          </details>
          {previewNode.kind === "sourced-fact" && <section data-booky-fact-sources aria-label={preview.locale === "ru" ? "Источники факта" : "Fact sources"}>
            <p role="note">{preview.locale === "ru" ? "Черновик факта — источники ещё требуют проверки" : "Draft fact — sources still need review"}</p>
            <ul>
              {previewDialogue.payload.factualSources.map((source) => <li key={source.id} style={{ marginBottom: 12, overflowWrap: "anywhere" }}>
                <p>{preview.locale === "ru" ? "ID источника" : "Source ID"}: {source.id}</p>
                <p><a href={source.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", minHeight: 44, padding: "10px 0", overflowWrap: "anywhere" }}>{source.url}</a></p>
                <p>{preview.locale === "ru" ? "Дата обращения" : "Accessed at"}: <time dateTime={source.accessedAt}>{source.accessedAt}</time></p>
              </li>)}
            </ul>
          </section>}
          {previewNode.kind === "activity" && <div data-booky-activity-answer>
            <ol aria-label="Варианты ответа">
              {previewChoices.map((choice, index) => {
                const label = preview.draft.authoringSource.selection.activityChoices?.[index]?.writer.label[preview.locale];
                return <li key={choice.id} lang={preview.locale} style={{ marginBottom: 8 }}>
                  <button className={answer.choiceId === choice.id ? "button" : "button-secondary"} type="button" lang={preview.locale}
                    data-answer-choice-id={choice.id} aria-pressed={answer.choiceId === choice.id} disabled={!label}
                    style={{ minHeight: 44, minWidth: 44, width: "100%", textAlign: "start", whiteSpace: "normal" }}
                    onClick={() => chooseAnswer(choice.id)}>{label || (preview.locale === "ru" ? "Имя пока не подтверждено" : "Name not confirmed")}</button>
                </li>;
              })}
            </ol>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button className="button" type="button" lang={preview.locale} style={{ minHeight: 44, minWidth: 44 }}
                disabled={!answer.choiceId} aria-disabled={answer.pending || !answer.choiceId || !previewProfileMatches || !prerequisitePreviewMatches} aria-busy={answer.pending}
                aria-describedby={previewProfile.enabled ? "journey-preview-profile-report " + prerequisitePreviewReportId : undefined} onClick={checkAnswer}>
                {preview.locale === "ru" ? "Проверить ответ" : "Check answer"}</button>
              <button className="button-secondary" type="button" lang={preview.locale} style={{ minHeight: 44, minWidth: 44 }} onClick={() => beginOperation()}>
                {preview.locale === "ru" ? "Сбросить ответ" : "Reset answer"}</button>
            </div>
            {answer.pending && <p role="status" aria-live="polite" lang={preview.locale} data-booky-activity-answer-pending>
              {preview.locale === "ru" ? "Проверяем ответ…" : "Checking the answer…"}</p>}
            {answer.verdict !== null && <p role="status" aria-live="polite" lang={preview.locale}
              data-booky-activity-verdict data-verdict={answer.verdict ? "correct" : "wrong"}>
              {preview.locale === "ru" ? answer.verdict ? "Верно." : "Этот вариант не подходит. Попробуйте другой."
                : answer.verdict ? "Correct." : "This option does not match. Try another."}</p>}
            {answer.error && <p className="form-message" role="alert" lang={preview.locale} data-booky-activity-answer-error>{answer.error}</p>}
          </div>}
        </article>
        {preview.draft.blockingReviewIssues.length > 0 && <div className="editorial-note" role="note">
          <strong>Перед дальнейшей проверкой</strong>
          <ul>{preview.draft.blockingReviewIssues.map((issue) => <li key={issue.field}>{issue.message}</li>)}</ul>
        </div>}
        <nav aria-label={preview.locale === "ru" ? "Шаги предпросмотра" : "Preview steps"} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="button-secondary" type="button" disabled={preview.step === 0} style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => changePreviewStep(-1)}>{preview.locale === "ru" ? "Предыдущий шаг" : "Previous step"}</button>
          <button className="button" type="button" disabled={preview.step === previewDefinition.nodes.length - 1} style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => changePreviewStep(1)}>{preview.locale === "ru" ? "Следующий шаг" : "Next step"}</button>
        </nav>
        </div>
      </div>}
    </section>
    <section className="panel" aria-label="Экспорт черновика">
      {errors.length > 0 && <div className="form-message" role="alert">
        <strong>Проверьте поля перед просмотром или экспортом:</strong>
        <ul>{errors.map((error, index) => <li key={`${error.field}-${index}`} id={errorPrefix + "-error-" + index} style={{ overflowWrap: "anywhere" }}>
          {draftErrorTarget(error.field) ? <button className="button-secondary" type="button" data-booky-error-target={error.field}
            style={{ minHeight: 44, minWidth: 44, maxWidth: "100%", whiteSpace: "normal", textAlign: "left" }}
            aria-label={"Перейти к полю: " + draftErrorLabel(error.field) + ". " + error.message}
            onClick={() => focusDraftError(error.field)}>{draftErrorLabel(error.field)}: {error.message}</button> : error.message}
        </li>)}</ul>
      </div>}
      <p role="status" aria-live="polite">{validating ? "Проверка задания по текущему каталогу…" : notice}</p>
      <p>JSON содержит два языковых маршрута и {8 + 2 * ((input.additionalWorks?.length ?? 0) + Number(!!input.fact) + Number(!!input.activity))} черновиков подсказок. Проверка формы не даёт редакционного одобрения.</p>
      <button className="button" type="submit" disabled={!available} aria-busy={validating}>Скачать черновик JSON</button>
    </section>
  </form>;
}
