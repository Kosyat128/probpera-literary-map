"use client";

import { useState, useTransition } from "react";
import { bookDossierAction, type BookDossierActionResult } from "./actions";
import { bookDossierProfiles, bookDossierTemplates, type BookDossierDesignProof, type BookDossierDraft, type BookDossierRecord, type BookDossierReviewStage } from "../../../../../../src/books/bookDossierDocument";
import { validateBookDossierDraft } from "../../../../../../src/books/bookDossierValidation";
import { addBookDossierDraftSection, bookDossierCoreSections } from "../../../../../../src/books/bookDossierDraftBuilder";
import { measureBookDossierDesign } from "./measureDesign";

const stages: readonly [BookDossierReviewStage, string][] = [["facts", "Факты и источники"], ["rights", "Права и перевод"], ["editorial", "Редактура"], ["design", "Макет DOM и 3D"], ["accessibility", "Доступность"], ["final", "Итоговое одобрение"]];
const blank = { schemaVersion: 2, bookKey: "", locale: "ru", dossierVersion: "v1", title: "", writer: "", profile: "ROMAN", tier: "CORE", requiredLocales: ["ru"], translationReadyLocales: [], sections: [], blocks: [], sources: [], rights: [] };

export function BookDossierEditor({ initial, canPublish }: { initial: BookDossierRecord | null; canPublish: boolean }) {
  const [record, setRecord] = useState(initial);
  const [draft, setDraft] = useState<BookDossierDraft>((initial?.draft || blank) as BookDossierDraft);
  const [raw, setRaw] = useState(JSON.stringify(initial?.draft || blank, null, 2));
  const [result, setResult] = useState<BookDossierActionResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [designProof, setDesignProof] = useState<BookDossierDesignProof | undefined>();
  const [pending, startTransition] = useTransition();
  const dirty = Boolean(record && JSON.stringify(draft) !== JSON.stringify(record.draft)) || raw !== JSON.stringify(draft, null, 2);
  const change = (next: BookDossierDraft) => { setDraft(next); setRaw(JSON.stringify(next, null, 2)); setConfirmed(false); setDesignProof(undefined); };
  const run = (action: Parameters<typeof bookDossierAction>[0]["action"], stage?: BookDossierReviewStage, decision?: "APPROVED" | "CHANGES_REQUIRED") => startTransition(async () => {
    const response = await bookDossierAction({ action, draft, bookKey: draft.bookKey, locale: draft.locale,
      expectedRevision: record?.revision || 0, stage, decision, confirmedHumanReview: confirmed, reason, designProof });
    setResult(response);
    if (response.record) { setRecord(response.record); change(response.record.draft); }
    if (response.record && response.designVariants && !response.issues.length) {
      const measured = await measureBookDossierDesign(response.record, response.designVariants);
      setDesignProof(measured.proof || undefined);
      if (measured.issues.length) setResult({ ...response, issues: measured.issues.map(code => ({ code, path: "design" })) });
    }
  });
  return <section aria-labelledby="dossier-edit-heading">
    <h2 id="dossier-edit-heading">{record ? "Досье произведения" : "Новое досье"}</h2>
    <p>Статус: {record?.status || "DRAFT"}. Версия: {record?.revision || 0}. CORE: 4-7 разделов, ENRICHED: 7-12, SIGNATURE: 10-18. Пустые разделы и недоказанные права не проходят публикацию.</p>
    <fieldset disabled={pending}><legend>Паспорт досье</legend>
      <label>Ключ произведения <input value={draft.bookKey} readOnly={Boolean(record)} onChange={event => change({ ...draft, bookKey: event.target.value })} placeholder="страна:писатель:произведение" /></label>
      <label>Язык <select value={draft.locale} disabled={Boolean(record)} onChange={event => change({ ...draft, locale: event.target.value as "ru" | "en" })}><option value="ru">Русский</option><option value="en">English</option></select></label>
      <label>Название <input value={draft.title} onChange={event => change({ ...draft, title: event.target.value })} /></label>
      <label>Автор <input value={draft.writer} onChange={event => change({ ...draft, writer: event.target.value })} /></label>
      <label>Версия текста <input value={draft.dossierVersion} onChange={event => change({ ...draft, dossierVersion: event.target.value })} /></label>
      <label>Профиль <select value={draft.profile} onChange={event => change({ ...draft, profile: event.target.value as BookDossierDraft["profile"] })}>{bookDossierProfiles.map(profile => <option key={profile}>{profile}</option>)}</select></label>
      <label>Объём <select value={draft.tier} onChange={event => change({ ...draft, tier: event.target.value as BookDossierDraft["tier"] })}>{["CORE", "ENRICHED", "SIGNATURE"].map(tier => <option key={tier}>{tier}</option>)}</select></label>
    </fieldset>
    <p><button type="button" disabled={pending} onClick={() => change(bookDossierCoreSections.reduce((value, [purpose, title, template]) => addBookDossierDraftSection(value, { id: purpose, purpose, title, template }), draft))}>Добавить пустые обязательные разделы</button> <button type="button" disabled={pending || draft.sections.length >= 18} onClick={() => change(addBookDossierDraftSection(draft, { id: `context-${draft.sections.length + 1}`, title: "Новый раздел", purpose: "context", template: "essay" }))}>Добавить раздел контекста</button></p>
    {draft.sections.map((section, index) => <details key={section.id}><summary>{index + 1}. {section.title}</summary>
      <label>Заголовок раздела <input value={section.title} onChange={event => change({ ...draft, sections: draft.sections.map(item => item.id === section.id ? { ...item, title: event.target.value } : item) })} /></label>
      <label>Макет <select value={section.template} onChange={event => change({ ...draft, sections: draft.sections.map(item => item.id === section.id ? { ...item, template: event.target.value as typeof item.template } : item) })}>{bookDossierTemplates.map(template => <option key={template}>{template}</option>)}</select></label>
      {draft.blocks.filter(block => block.sectionId === section.id).map(block => <fieldset key={block.id}><legend>{block.title} · {block.kind}</legend>
        <label>Абзацы (пустая строка между абзацами) <textarea rows={6} value={block.paragraphs.join("\n\n")} onChange={event => change({ ...draft, blocks: draft.blocks.map(item => item.id === block.id ? { ...item, paragraphs: event.target.value.split(/\n\s*\n/u).filter(text => text.trim()) } : item) })} /></label>
        <p>Уровень спойлеров: {block.spoiler}. Права: {draft.rights.find(grant => grant.id === block.rightsId)?.classification || "Не заданы"}. Изменение требует повторного подтверждения.</p>
        <label>Уровень спойлеров <select value={block.spoiler} onChange={event => change({ ...draft, blocks: draft.blocks.map(item => item.id === block.id ? { ...item, spoiler: event.target.value as typeof item.spoiler } : item) })}>{["NONE", "LIGHT", "MAJOR", "ENDING"].map(level => <option key={level}>{level}</option>)}</select></label>
        <button type="button" onClick={() => change({ ...draft, blocks: draft.blocks.map(item => item.id === block.id ? { ...item, items: [...item.items, { id: `${block.id}-item-${item.items.length + 1}`, label: "", value: "", sourceIds: [], spoiler: "NONE" }] } : item) })}>Добавить элемент</button>
        {block.items.map(entry => <div key={entry.id}><label>Название элемента <input value={entry.label} onChange={event => change({ ...draft, blocks: draft.blocks.map(item => item.id === block.id ? { ...item, items: item.items.map(value => value.id === entry.id ? { ...value, label: event.target.value } : value) } : item) })} /></label><label>Значение <input value={entry.value || ""} onChange={event => change({ ...draft, blocks: draft.blocks.map(item => item.id === block.id ? { ...item, items: item.items.map(value => value.id === entry.id ? { ...value, value: event.target.value } : value) } : item) })} /></label></div>)}
      </fieldset>)}
    </details>)}
    <details><summary>Структура, элементы, источники и права</summary><p>Здесь задаются стабильные ID, конечные блоки, ссылки и основания прав. Поля reviewedBy и reviewedAt перезаписывает подтверждённое действие редактора. Никакие поля JSON не заменяют проверку человеком.</p>
      <label>Документ V2 <textarea rows={22} maxLength={500000} value={raw} onChange={event => { setRaw(event.target.value); setConfirmed(false); }} /></label>
      <button type="button" disabled={pending} onClick={() => { try { const validated = validateBookDossierDraft(JSON.parse(raw), undefined, true); if (!validated.draft) { setResult({ record: null, issues: validated.issues }); return; } change(validated.draft); setResult(null); } catch { setResult({ record: null, issues: [{ code: "invalid-json", path: "draft" }] }); } }}>Применить структуру к форме</button>
    </details>
    <button type="button" disabled={pending || raw !== JSON.stringify(draft, null, 2)} onClick={() => run("SAVE")}>Сохранить черновик и сбросить одобрения</button>
    {record && <fieldset disabled={pending || dirty}><legend>Проверка и публикация сохранённой версии</legend>
      <p>Перед проверкой сохраните изменения. Проверки относятся только к сохранённой версии и её контрольной сумме.</p>
      <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> Я лично проверил выбранный этап и подтверждаю действие</label>
      {stages.map(([stage, label]) => <p key={stage}>{label}: {record.reviews.find(review => review.stage === stage)?.decision || "Ожидает проверки"} <button type="button" disabled={!confirmed || !canPublish && ["rights", "final"].includes(stage) || stage === "design" && !designProof} onClick={() => run("REVIEW", stage, "APPROVED")}>Подтвердить</button> <button type="button" disabled={!confirmed} onClick={() => run("REVIEW", stage, "CHANGES_REQUIRED")}>Вернуть на доработку</button></p>)}
      <button type="button" onClick={() => run("PREVIEW")}>Предпросмотр и измерение всех макетов</button>
      {designProof && <p role="status">Проверено вариантов: {designProof.variantPages.length}. Максимум страниц после переносов: {Math.max(...designProof.variantPages.map(variant => variant.pageCount))}. Шрифты: локальные Source Serif и Source Sans.</p>}
      <button type="button" disabled={!canPublish || !confirmed || record.status !== "READY"} onClick={() => run("PUBLISH")}>Опубликовать одобренное досье</button>
      <label>Причина снятия <input value={reason} onChange={event => setReason(event.target.value)} /></label>
      <button type="button" disabled={!canPublish || !reason.trim()} onClick={() => run("REVOKE")}>Отозвать права и снять публикацию</button>
      <button type="button" disabled={!canPublish || !reason.trim()} onClick={() => run("ARCHIVE")}>Убрать в архив</button>
    </fieldset>}
    {result?.issues.length ? <ul role="alert">{result.issues.map((issue, index) => <li key={index}>{issue.path}: {issue.code}</li>)}</ul> : result && <p role="status">Действие выполнено.</p>}
    {result?.preview && <article aria-label="Предпросмотр досье">{result.preview.pages.map(page => <section key={page.id}><h3>{page.title}</h3>{page.blocks.map(block => <div key={block.id}>{block.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}{block.items.map(item => <p key={item.id}><strong>{item.label}</strong> {item.value} {item.text} {item.href && <a href={item.href} target="_blank" rel="noopener noreferrer">Источник</a>}</p>)}</div>)}{page.sources.map(source => <p key={source.id}><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.title}</a></p>)}</section>)}</article>}
    {record && <details><summary>История действий</summary><ol>{record.audit.map(event => <li key={event.id}>{event.at} · {event.action} · {event.actorId} · {event.reason}</li>)}</ol></details>}
  </section>;
}
