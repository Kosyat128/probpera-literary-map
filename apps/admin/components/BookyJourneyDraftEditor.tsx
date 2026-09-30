"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { BOOKY_JOURNEY_DRAFT_MAX_BYTES, createBookyJourneyDraft, evaluateBookyJourneyDraftPreviewProfile, parseBookyJourneyDraft, type JourneyDraftCatalog, type JourneyDraftInput, type BookyJourneyDraft } from "@/lib/booky-journey-draft";

import { evaluateBookyJourneyDraftActivityAction, validateBookyJourneyDraftActivityAction } from "@/app/(dashboard)/journeys/actions";
import { contentRecordHash } from "../../../src/planet/contentExportHash";

type Locale = "ru" | "en";
type NodeKind = "country" | "writer" | "work" | "checkpoint";
type CopyKind = NodeKind | "activity" | "sourced-fact";
type PreviewCopyView = "body" | "caption" | "reduced";
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
  const [input, setInput] = useState<JourneyDraftInput>(() => ({
    id: "", version: 1, countryId: "", writerId: "", workId: "",
    ageRange: { min: 18, max: 99 }, readingLevel: "plain", estimatedDurationMinutes: 0,
    copy: initialCopy(),
  }));
  const [errors, setErrors] = useState<readonly { field: string; message: string }[]>([]);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ draft: BookyJourneyDraft; locale: Locale; step: number } | null>(null);
  const [previewCopyView, setPreviewCopyView] = useState<PreviewCopyView>("body");
  const [previewProfile, setPreviewProfile] = useState<PreviewProfile>({ enabled: false, age: "", readingLevel: "" });
  const [answer, setAnswer] = useState<PreviewAnswer>(emptyAnswer);
  const previewOwner = useRef(preview), answerOwner = useRef(answer);
  previewOwner.current = preview; answerOwner.current = answer;
  const [importing, setImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<readonly { field: string; message: string }[]>([]);
  const [importNotice, setImportNotice] = useState("");
  const operationSequence = useRef(0);
  const fileControl = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState(false);
  const choiceWriters = catalog.countries.flatMap((item) => item.writers.map((author) => ({ country: item, writer: author })));
  const choiceKey = (choice: { countryId: string; writerId: string }) => JSON.stringify([choice.countryId, choice.writerId]);
  useEffect(() => () => { operationSequence.current += 1; }, []);
  const country = catalog.countries.find((item) => item.id === input.countryId);
  const writer = country?.writers.find((item) => item.id === input.writerId);
  const work = writer?.works.find((item) => item.id === input.workId);
  const available = catalog.countries.length > 0;
  const previewDefinition = preview?.draft.definitions.find((definition) => definition.locale === preview.locale);
  const previewProfileResult = previewProfile.enabled && previewDefinition ? evaluateBookyJourneyDraftPreviewProfile(previewDefinition, {
    age: previewProfile.age === "" ? NaN : Number(previewProfile.age), readingLevel: previewProfile.readingLevel,
  }) : null;
  const previewProfileMatches = !previewProfile.enabled || previewProfileResult?.status === "matches";
  const previewNode = previewDefinition?.nodes[preview?.step ?? 0];
  const previewChoices = previewNode?.kind === "activity" ? previewNode.activity?.choices ?? [] : [];
  const previewDialogue = preview?.draft.dialogues.find((record) => record.payload.locale === preview.locale
    && record.payload.id === previewNode?.dialogue.id);
  const previewEntity = preview ? preview.draft.authoringSource.selection[
    previewNode?.kind === "country" ? "country" : previewNode?.kind === "writer" ? "writer" : "work"
  ] : null;

  function update(change: Partial<JourneyDraftInput>) {
    operationSequence.current += 1;
    setImporting(false);
    setImportErrors([]);
    setImportNotice(importing ? "Открытие файла отменено: форма была изменена." : "");
    if (fileControl.current) fileControl.current.value = "";
    setPreview(null);
    setAnswer(emptyAnswer());
    setValidating(false);
    setInput((current) => {
      const next = { ...current, ...change };
      if (Object.hasOwn(change, "activity") && change.activity === undefined) delete next.activity;
      if (Object.hasOwn(change, "fact") && change.fact === undefined) delete next.fact;
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
  function changePreviewCopyView(view: PreviewCopyView) {
    if (view === previewCopyView) return;
    beginOperation();
    setPreviewCopyView(view);
  }
  function updatePreviewProfile(change: Partial<PreviewProfile>) {
    const next = { ...previewProfile, ...change };
    if (next.enabled === previewProfile.enabled && next.age === previewProfile.age && next.readingLevel === previewProfile.readingLevel) return;
    beginOperation();
    setPreviewProfile(next);
  }
  async function checkAnswer() {
    const candidate = preview, choiceId = answer.choiceId;
    if (answer.pending || !previewProfileMatches || !candidate || previewNode?.kind !== "activity" || !choiceId || !previewChoices.some((choice) => choice.id === choiceId)) return;
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
  function updateFactSource(locale: Locale, index: number, field: "id" | "url" | "accessedAt", value: string) {
    if (input.fact) update({ fact: { ...input.fact, copy: { ...input.fact.copy, [locale]: {
      ...input.fact.copy[locale], sources: input.fact.copy[locale].sources.map((source, i) => i === index ? { ...source, [field]: value } : source),
    } } } });
  }
  function updateCopyVariant(locale: Locale, kind: CopyKind, field: "caption" | "reduced", value: string) {
    function edit<T extends { caption?: string; reduced?: string }>(copy: T) {
      const next = { ...copy };
      if (value === "") delete next[field];
      else if (field === "caption") next.caption = value;
      else next.reduced = value;
      return next;
    }
    if (kind === "activity") {
      if (input.activity) update({ activity: { ...input.activity, copy: { ...input.activity.copy, [locale]: edit(input.activity.copy[locale]) } } });
    } else if (kind === "sourced-fact") {
      if (input.fact) update({ fact: { ...input.fact, copy: { ...input.fact.copy, [locale]: edit(input.fact.copy[locale]) } } });
    } else {
      update({ copy: { ...input.copy, [locale]: { ...input.copy[locale], nodes: { ...input.copy[locale].nodes, [kind]: edit(input.copy[locale].nodes[kind]) } } } });
    }
  }
  function copyVariantFields(locale: Locale, kind: CopyKind, copy: { caption?: string; reduced?: string }) {
    const captionLabel = locale === "ru" ? `Подпись «${previewStepLabels.ru[kind]}» (RU)` : `Caption “${previewStepLabels.en[kind]}” (EN)`;
    const reducedLabel = locale === "ru" ? `Короткий текст «${previewStepLabels.ru[kind]}» (RU)` : `Short text “${previewStepLabels.en[kind]}” (EN)`;
    return <details lang={locale} data-booky-copy-variants={kind} data-copy-locale={locale} style={{ minWidth: 0 }}>
      <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{locale === "ru" ? "Подпись и короткий текст" : "Caption and short text"}</summary>
      <p>{locale === "ru" ? "Пустое поле использует название шага." : "An empty field uses the step title."}</p>
      <label className="field"><span>{captionLabel}</span>
        <textarea lang={locale} aria-label={captionLabel} maxLength={1600} style={{ minHeight: 44 }} value={copy.caption ?? ""}
          onChange={(event) => updateCopyVariant(locale, kind, "caption", event.target.value)} /></label>
      <label className="field"><span>{reducedLabel}</span>
        <textarea lang={locale} aria-label={reducedLabel} maxLength={320} style={{ minHeight: 44 }} value={copy.reduced ?? ""}
          onChange={(event) => updateCopyVariant(locale, kind, "reduced", event.target.value)} /></label>
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

  return <form className="site-copy-editor" onSubmit={download} noValidate>
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
    </details>

    <section className="panel site-copy-card" aria-labelledby="journey-conditions-heading">
      <header><h2 id="journey-conditions-heading">Маршрут и условия</h2><span className="badge">Черновик · RU / EN</span></header>
      <div className="site-copy-locales">
        <label className="field"><span>Идентификатор маршрута</span>
          <input maxLength={48} value={input.id} onChange={(event) => update({ id: event.target.value })} autoComplete="off" spellCheck={false} /></label>
        <label className="field"><span>Версия</span>
          <input type="number" min={1} max={1000000} step={1} value={input.version || ""} onChange={(event) => update({ version: Number(event.target.value) })} /></label>
        <label className="field"><span>Возраст от</span>
          <input type="number" min={18} max={120} step={1} value={input.ageRange.min || ""} onChange={(event) => update({ ageRange: { ...input.ageRange, min: Number(event.target.value) } })} /></label>
        <label className="field"><span>Возраст до</span>
          <input type="number" min={18} max={120} step={1} value={input.ageRange.max || ""} onChange={(event) => update({ ageRange: { ...input.ageRange, max: Number(event.target.value) } })} /></label>
        <label className="field"><span id="journey-reading-level-label">Уровень чтения</span>
          <select aria-labelledby="journey-reading-level-label" value={input.readingLevel} onChange={(event) => update({ readingLevel: event.target.value as JourneyDraftInput["readingLevel"] })}>
            <option value="plain">Простой</option><option value="developing">Развивающийся</option><option value="fluent">Свободный</option>
          </select></label>
        <label className="field"><span>Примерная длительность (мин)</span>
          <input type="number" min={1} max={1440} step={1} value={input.estimatedDurationMinutes || ""} onChange={(event) => update({ estimatedDurationMinutes: Number(event.target.value) })} /></label>
      </div>
      <p><small>Условия задаёт редактор. Они не назначают возраст или уровень чтения пользователям.</small></p>
      <div className="site-copy-locales">
        {locales.map((locale) => <div className="site-copy-grid" key={locale}>
          <label className="field"><span>Название маршрута ({locale.toUpperCase()})</span>
            <input lang={locale} maxLength={200} value={input.copy[locale].title} onChange={(event) => updateCopy(locale, "title", event.target.value)} /></label>
          <label className="field"><span>Описание маршрута ({locale.toUpperCase()})</span>
            <textarea lang={locale} maxLength={800} value={input.copy[locale].description} onChange={(event) => updateCopy(locale, "description", event.target.value)} /></label>
        </div>)}
      </div>
    </section>

    <ol className="site-copy-grid" aria-label="Путь маршрута" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {steps.map((step) => <li key={step.key}>
        {step.number > 1 && <p aria-hidden="true" style={{ textAlign: "center", margin: "0 0 14px" }}>↓</p>}
        {step.key === "checkpoint" && <details className="panel site-copy-card" aria-labelledby="journey-fact-heading">
          <summary id="journey-fact-heading" style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Необязательный факт · источники</summary>
          <p>Добавьте собственный текст о выбранной книге и источники отдельно для RU и EN. Текст и источники ещё требуют проверки.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={!!input.fact} onChange={(event) => toggleFact(event.target.checked)} />
            Добавить факт об этой книге
          </label>
          {input.fact && <div className="site-copy-grid" data-booky-fact-editor>
            <p>Книга: {work?.label.ru || "Сначала выберите книгу"}</p>
            <div className="site-copy-locales">
              {locales.map((locale) => <div key={locale} className="site-copy-grid">
                <label className="field"><span>Название факта ({locale.toUpperCase()})</span>
                  <input lang={locale} maxLength={160} style={{ minHeight: 44 }} value={input.fact!.copy[locale].title}
                    onChange={(event) => updateFactCopy(locale, "title", event.target.value)} /></label>
                <label className="field"><span>Текст факта ({locale.toUpperCase()})</span>
                  <textarea lang={locale} maxLength={1600} style={{ minHeight: 44 }} value={input.fact!.copy[locale].body}
                    onChange={(event) => updateFactCopy(locale, "body", event.target.value)} /></label>
                {copyVariantFields(locale, "sourced-fact", input.fact!.copy[locale])}
                <p>Источники ({locale.toUpperCase()}): от 1 до 16. Укажите дату обращения вручную в формате UTC, например 2026-09-30T12:00:00.000Z.</p>
                {input.fact!.copy[locale].sources.map((source, index) => <div key={index} className="site-copy-grid">
                  <label className="field"><span>ID источника {index + 1} ({locale.toUpperCase()})</span>
                    <input maxLength={96} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }} value={source.id}
                      onChange={(event) => updateFactSource(locale, index, "id", event.target.value)} /></label>
                  <label className="field"><span>HTTPS URL источника {index + 1} ({locale.toUpperCase()})</span>
                    <input type="url" maxLength={1000} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }} value={source.url}
                      onChange={(event) => updateFactSource(locale, index, "url", event.target.value)} /></label>
                  <label className="field"><span>Дата обращения к источнику {index + 1} ({locale.toUpperCase()})</span>
                    <input maxLength={24} autoComplete="off" spellCheck={false} style={{ minHeight: 44 }} value={source.accessedAt}
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
        {step.key === "checkpoint" && <details className="panel site-copy-card" aria-labelledby="journey-activity-heading">
          <summary id="journey-activity-heading" style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>Необязательное задание · выбрать автора</summary>
          <p>Добавьте вопрос между книгой и завершением. Выберите 2–4 автора из каталога; соответствие книге проверяется перед просмотром и экспортом.</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={!!input.activity} onChange={(event) => toggleActivity(event.target.checked)} />
            Добавить задание «Книга и автор»
          </label>
          {input.activity && <div className="site-copy-grid" data-booky-activity-editor>
            <p>Книга: {work?.label.ru || "Сначала выберите книгу"}</p>
            {input.activity.choices.map((choice, index) => <div key={index} className="site-copy-grid">
              <label className="field"><span id={`journey-choice-${index}`}>Автор · вариант {index + 1}</span>
                <select aria-labelledby={`journey-choice-${index}`} value={choiceKey(choice)} onChange={(event) => {
                  const selected = choiceWriters.find((item) => choiceKey({ countryId: item.country.id, writerId: item.writer.id }) === event.target.value);
                  if (input.activity) update({ activity: { ...input.activity, choices: input.activity.choices.map((item, i) => i === index
                    ? { countryId: selected?.country.id || "", writerId: selected?.writer.id || "" } : item) } });
                }}>
                  <option value={choiceKey({ countryId: "", writerId: "" })}>Выберите автора</option>
                  {choiceWriters.map((item) => {
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
                  <input lang={locale} maxLength={160} value={input.activity!.copy[locale].title} onChange={(event) => updateActivityCopy(locale, "title", event.target.value)} /></label>
                <label className="field"><span>Подсказка задания ({locale.toUpperCase()})</span>
                  <textarea lang={locale} maxLength={1600} value={input.activity!.copy[locale].body} onChange={(event) => updateActivityCopy(locale, "body", event.target.value)} /></label>
                {copyVariantFields(locale, "activity", input.activity!.copy[locale])}
              </div>)}
            </div>
          </div>}
        </details>}
        <section className="panel site-copy-card" aria-labelledby={`journey-step-${step.key}`}>
          <header><h2 id={`journey-step-${step.key}`}>{step.number + (step.key === "checkpoint" ? Number(!!input.fact) + Number(!!input.activity) : 0)}. {step.title}</h2>
            <span className="badge">{step.key === "checkpoint" ? "Завершение" : "Канонический выбор"}</span></header>
          {step.key === "country" && <>
            <label className="field"><span id="journey-country-label">Страна</span>
              <select aria-labelledby="journey-country-label" value={input.countryId} disabled={!available} onChange={(event) => update({ countryId: event.target.value, writerId: "", workId: "" })}>
                <option value="">Выберите страну</option>
                {catalog.countries.map((item) => <option key={item.id} value={item.id}>{item.label.ru}</option>)}
              </select></label>{englishLabel(country?.label)}
          </>}
          {step.key === "writer" && <>
            <label className="field"><span id="journey-writer-label">Писатель</span>
              <select aria-labelledby="journey-writer-label" value={input.writerId} disabled={!country} onChange={(event) => update({ writerId: event.target.value, workId: "" })}>
                <option value="">{country ? "Выберите писателя" : "Сначала выберите страну"}</option>
                {country?.writers.map((item) => <option key={item.id} value={item.id}>{item.label.ru}</option>)}
              </select></label>{englishLabel(writer?.label)}
          </>}
          {step.key === "work" && <>
            <label className="field"><span id="journey-work-label">Книга</span>
              <select aria-labelledby="journey-work-label" value={input.workId} disabled={!writer} onChange={(event) => update({ workId: event.target.value })}>
                <option value="">{writer ? "Выберите книгу" : "Сначала выберите писателя"}</option>
                {writer?.works.map((item) => <option key={item.id} value={item.id}>{item.label.ru}</option>)}
              </select></label>{englishLabel(work?.label)}
          </>}
          {step.key === "checkpoint" && <p>Завершение связано с выбранной книгой. Новая сущность каталога не создаётся.</p>}
          <div className="site-copy-locales">
            {locales.map((locale) => <div className="site-copy-grid" key={locale}>
              <label className="field"><span>Название шага «{step.title}» ({locale.toUpperCase()})</span>
                <input lang={locale} maxLength={160} value={input.copy[locale].nodes[step.key].title} onChange={(event) => updateNode(locale, step.key, "title", event.target.value)} /></label>
              <label className="field"><span>Подсказка шага «{step.title}» ({locale.toUpperCase()})</span>
                <textarea lang={locale} maxLength={1600} value={input.copy[locale].nodes[step.key].body} onChange={(event) => updateNode(locale, step.key, "body", event.target.value)} /></label>
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
        <details data-booky-preview-profile lang={preview.locale} style={{ minWidth: 0 }}>
          <summary style={{ minHeight: 44, padding: "10px 0", cursor: "pointer" }}>{preview.locale === "ru" ? "Профиль предпросмотра" : "Preview profile"}</summary>
          <p>{preview.locale === "ru" ? "Сравнение использует возраст и уровень чтения, заданные для этого черновика." : "This comparison uses the age and reading level declared in this draft."}</p>
          <label style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44 }}>
            <input type="checkbox" checked={previewProfile.enabled} onChange={(event) => updatePreviewProfile({ enabled: event.target.checked })} />
            {preview.locale === "ru" ? "Сравнить взрослый профиль" : "Compare an adult profile"}
          </label>
          {previewProfile.enabled && <div className="site-copy-locales">
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
        <p role="status" aria-live="polite" lang={preview.locale}>{preview.locale === "ru" ? `Шаг ${preview.step + 1} из ${previewDefinition.nodes.length}` : `Step ${preview.step + 1} of ${previewDefinition.nodes.length}`} · {previewStepLabels[preview.locale][previewNode.kind]}</p>
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
                onClick={() => jumpPreviewStep(index)}>{index + 1}. {previewStepLabels[preview.locale][node.kind]}</button>
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
                disabled={!answer.choiceId} aria-disabled={answer.pending || !answer.choiceId || !previewProfileMatches} aria-busy={answer.pending}
                aria-describedby={previewProfile.enabled ? "journey-preview-profile-report" : undefined} onClick={checkAnswer}>
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
      </div>}
    </section>
    <section className="panel" aria-label="Экспорт черновика">
      {errors.length > 0 && <div className="form-message" role="alert">
        <strong>Проверьте поля перед просмотром или экспортом:</strong>
        <ul>{errors.map((error, index) => <li key={`${error.field}-${index}`}>{error.message}</li>)}</ul>
      </div>}
      <p role="status" aria-live="polite">{validating ? "Проверка задания по текущему каталогу…" : notice}</p>
      <p>JSON содержит два языковых маршрута и {input.fact && input.activity ? "двенадцать" : input.fact || input.activity ? "десять" : "восемь"} черновиков подсказок. Проверка формы не даёт редакционного одобрения.</p>
      <button className="button" type="submit" disabled={!available} aria-busy={validating}>Скачать черновик JSON</button>
    </section>
  </form>;
}
