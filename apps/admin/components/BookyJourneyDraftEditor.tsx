"use client";

import { useState, type FormEvent } from "react";
import { createBookyJourneyDraft, type JourneyDraftCatalog, type JourneyDraftInput, type BookyJourneyDraft } from "@/lib/booky-journey-draft";

type Locale = "ru" | "en";
type NodeKind = "country" | "writer" | "work" | "checkpoint";
const locales = ["ru", "en"] as const;
const steps = [
  { key: "country", title: "Страна", number: 1 },
  { key: "writer", title: "Писатель", number: 2 },
  { key: "work", title: "Книга", number: 3 },
  { key: "checkpoint", title: "Завершение", number: 4 },
] as const;

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
  const country = catalog.countries.find((item) => item.id === input.countryId);
  const writer = country?.writers.find((item) => item.id === input.writerId);
  const work = writer?.works.find((item) => item.id === input.workId);
  const available = catalog.countries.length > 0;
  const previewDefinition = preview?.draft.definitions.find((definition) => definition.locale === preview.locale);
  const previewNode = previewDefinition?.nodes[preview?.step ?? 0];
  const previewDialogue = preview?.draft.dialogues.find((record) => record.payload.locale === preview.locale
    && record.payload.id === previewNode?.dialogue.id);
  const previewEntity = preview ? preview.draft.authoringSource.selection[
    previewNode?.kind === "country" ? "country" : previewNode?.kind === "writer" ? "writer" : "work"
  ] : null;

  function update(change: Partial<JourneyDraftInput>) {
    setPreview(null);
    setInput((current) => ({ ...current, ...change }));
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
  function showPreview() {
    setPreview(null);
    setNotice("");
    const result = createBookyJourneyDraft(input, catalog);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setPreview({ draft: result.draft, locale: "ru", step: 0 });
  }
  function download(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    const result = createBookyJourneyDraft(input, catalog);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
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
        <section className="panel site-copy-card" aria-labelledby={`journey-step-${step.key}`}>
          <header><h2 id={`journey-step-${step.key}`}>{step.number}. {step.title}</h2>
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
            </div>)}
          </div>
        </section>
      </li>)}
    </ol>
    <section className="panel site-copy-card" aria-labelledby="journey-preview-heading" style={{ minWidth: 0 }}>
      <header><h2 id="journey-preview-heading">Предпросмотр маршрута</h2><span className="badge">Взрослый черновик</span></header>
      <p>Просмотрите тексты шагов перед экспортом. Это локальный просмотр; он не запускает маршрут в приложении.</p>
      <button className="button-secondary" type="button" disabled={!available} onClick={showPreview} style={{ minHeight: 44, minWidth: 44 }}>Предпросмотр маршрута</button>
      {preview && previewDefinition && previewNode && previewDialogue && <div data-booky-journey-preview className="site-copy-grid" style={{ marginTop: 18, minWidth: 0 }}>
        <div role="group" aria-label="Язык предпросмотра" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {locales.map((locale) => <button key={locale} className={preview.locale === locale ? "button" : "button-secondary"} type="button" lang={locale}
            aria-pressed={preview.locale === locale} style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => setPreview((current) => current ? { ...current, locale } : null)}>{locale === "ru" ? "Русский" : "English"}</button>)}
        </div>
        <p>Возраст: {previewDefinition.ageRange.min}–{previewDefinition.ageRange.max} лет · Уровень чтения: {
          previewDefinition.readingLevel === "plain" ? "Простой" : previewDefinition.readingLevel === "developing" ? "Развивающийся" : "Свободный"
        } · Оценка: {previewDefinition.overview?.estimatedDurationMinutes} мин</p>
        <p role="status" aria-live="polite">Шаг {preview.step + 1} из {previewDefinition.nodes.length} · {steps[preview.step].title}</p>
        <article lang={preview.locale} aria-label={preview.locale === "ru" ? "Текст выбранного шага" : "Selected step text"}
          data-preview-step={previewNode.id} style={{ minWidth: 0, overflowWrap: "anywhere" }}>
          <h3>{previewDefinition.title}</h3>
          <p>{previewDefinition.overview?.description}</p>
          <p lang="ru">{previewNode.kind === "checkpoint" ? "Книга для завершения" : "Каноническая запись"}: {previewEntity?.label[preview.locale]
            ? <span lang={preview.locale}>{previewEntity.label[preview.locale]}</span>
            : <span>Английское название пока не подтверждено</span>}</p>
          <p lang="ru">Экран: {previewNode.screen === "globe" ? "Глобус" : "Коллекция"}</p>
          <h4>{previewDialogue.payload.copy.title}</h4>
          <p style={{ whiteSpace: "pre-wrap" }}>{previewDialogue.payload.copy.body}</p>
        </article>
        {preview.draft.blockingReviewIssues.length > 0 && <div className="editorial-note" role="note">
          <strong>Перед дальнейшей проверкой</strong>
          <ul>{preview.draft.blockingReviewIssues.map((issue) => <li key={issue.field}>{issue.message}</li>)}</ul>
        </div>}
        <nav aria-label="Шаги предпросмотра" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="button-secondary" type="button" disabled={preview.step === 0} style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => setPreview((current) => current ? { ...current, step: Math.max(0, current.step - 1) } : null)}>Предыдущий шаг</button>
          <button className="button" type="button" disabled={preview.step === previewDefinition.nodes.length - 1} style={{ minHeight: 44, minWidth: 44 }}
            onClick={() => setPreview((current) => current ? { ...current, step: Math.min(current.draft.definitions[0].nodes.length - 1, current.step + 1) } : null)}>Следующий шаг</button>
        </nav>
      </div>}
    </section>
    <section className="panel" aria-label="Экспорт черновика">
      {errors.length > 0 && <div className="form-message" role="alert">
        <strong>Проверьте поля перед просмотром или экспортом:</strong>
        <ul>{errors.map((error, index) => <li key={`${error.field}-${index}`}>{error.message}</li>)}</ul>
      </div>}
      <p role="status" aria-live="polite">{notice}</p>
      <p>JSON содержит два языковых маршрута и восемь черновиков подсказок. Проверка формы не даёт редакционного одобрения.</p>
      <button className="button" type="submit" disabled={!available}>Скачать черновик JSON</button>
    </section>
  </form>;
}
