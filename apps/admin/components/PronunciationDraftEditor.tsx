"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { contentPackageCanonicalJson } from "../../../src/planet/contentPackageProtocol.mjs";
import {
  PRONUNCIATION_ENVELOPE_MAX_BYTES, decodePronunciationCatalog, parsePronunciationJson, pronunciationReferenceKey,
  type PronunciationCatalog, type PronunciationReference,
} from "../../../src/planet/pronunciationDictionaryProtocol.mjs";
import { createPronunciationEditorSession, type PronunciationPreviewPort } from "../lib/pronunciation-editor-state";

function workingDictionary(serialized: string) {
  const raw = parsePronunciationJson(serialized);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "entries,kind,schemaVersion,status,version"
    || value.schemaVersion !== 1 || value.kind !== "literary-planet-pronunciation-dictionary-v1" || value.status !== "draft"
    || typeof value.version !== "number" || !Number.isSafeInteger(value.version) || value.version <= 0
    || !Array.isArray(value.entries) || value.entries.length > 256) return null;
  return { ...value, entries: value.entries as Record<string, unknown>[] };
}

export function PronunciationDraftEditor({ catalog, previewAction }: {
  catalog: PronunciationCatalog; previewAction: PronunciationPreviewPort;
}) {
  const owner = useRef<ReturnType<typeof createPronunciationEditorSession> | null>(null);
  if (!owner.current) owner.current = createPronunciationEditorSession(catalog);
  const session = owner.current, state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const prefix = useId(), [query, setQuery] = useState(""), [notice, setNotice] = useState("");
  const currentCatalog = decodePronunciationCatalog(catalog), search = query.trim().toLocaleLowerCase();
  const choices = currentCatalog?.filter(item => [item.spelling.ru, item.spelling.en, pronunciationReferenceKey(item.ref)]
    .some(value => value?.toLocaleLowerCase().includes(search))) ?? [];
  const selected = currentCatalog?.find(item => pronunciationReferenceKey(item.ref) === pronunciationReferenceKey(state.target));
  const working = workingDictionary(state.dictionary);
  const entry = working?.entries.find(item => item && pronunciationReferenceKey(item.ref) === pronunciationReferenceKey(state.target));
  const visibleChoices = choices.slice(0, 100);
  if (selected && !visibleChoices.some(item => pronunciationReferenceKey(item.ref) === pronunciationReferenceKey(selected.ref))) visibleChoices.push(selected);
  useEffect(() => { session.activate(); session.setCatalog(catalog); }, [session, catalog]);
  useEffect(() => {
    if (!state.dirty) return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss); return () => { window.removeEventListener("beforeunload", preventLoss); };
  }, [state.dirty]);
  useEffect(() => () => { session.dispose(); }, [session]);

  function choose(serialized: string) {
    const target = currentCatalog?.find(item => pronunciationReferenceKey(item.ref) === serialized)?.ref ?? null;
    session.edit({ target }); setNotice("");
  }
  function updateAnnotation(locale: "ru" | "en", field: "phonetic" | "notes", value: string) {
    if (!working || !selected) { setNotice("Выберите каноническое название и проверьте рабочий JSON. Текст сохранён."); return; }
    const key = pronunciationReferenceKey(selected.ref), index = working.entries.findIndex(item => item && pronunciationReferenceKey(item.ref) === key);
    const previous = index >= 0 ? working.entries[index] : { ref: selected.ref, spelling: selected.spelling,
      ru: { phonetic: "", notes: "" }, en: { phonetic: "", notes: "" } };
    const annotation = previous[locale] && typeof previous[locale] === "object" && !Array.isArray(previous[locale])
      ? previous[locale] as Record<string, unknown> : { phonetic: "", notes: "" };
    const next = { ...previous, [locale]: { ...annotation, [field]: value } }, entries = [...working.entries];
    if (index >= 0) entries[index] = next; else if (entries.length < 256) entries.push(next); else { setNotice("В рабочем словаре уже 256 записей."); return; }
    session.edit({ dictionary: JSON.stringify({ ...working, entries }, null, 2) }); setNotice("");
  }
  const annotationValue = (locale: "ru" | "en", field: "phonetic" | "notes") => {
    const row = entry?.[locale];
    return row && typeof row === "object" && typeof (row as Record<string, unknown>)[field] === "string"
      ? (row as Record<string, string>)[field] : "";
  };
  function download(name: string, serialized: string) {
    let url: string | null = null;
    try {
      url = URL.createObjectURL(new Blob([serialized], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a"); link.href = url; link.download = name;
      document.body.append(link); try { link.click(); } finally { link.remove(); }
      setNotice("Рабочая копия подготовлена для сохранения. Проверьте сохранённый файл перед закрытием формы.");
      // Preparing a browser download is not an observed disk-save ACK; dirty remains.
    } catch { setNotice("Не удалось подготовить файл. Форма сохранена."); }
    finally { if (url) URL.revokeObjectURL(url); }
  }
  async function importWorkspace(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget, file = input.files?.[0], revision = state.revision;
    if (!file) return;
    try {
      if (file.size > PRONUNCIATION_ENVELOPE_MAX_BYTES) throw new Error("Workspace quota");
      const serialized = await file.text();
      if (!session.importWorkspace(serialized, revision)) throw new Error("Current workspace refused");
      setNotice("Рабочая копия восстановлена. Проверка каталога и источника нужна заново.");
    } catch { setNotice("Импорт отклонён или форма изменилась во время чтения. Текущие RU/EN сохранены."); }
    finally { input.value = ""; }
  }
  return <section className="panel site-copy-editor" aria-busy={state.busy} aria-labelledby={prefix + "-heading"}>
    <h2 id={prefix + "-heading"}>Фонетические пометки RU/EN</h2>
    <p>Только черновик. Произношение вводит редактор; проверка формы не означает редакционного одобрения. Голос не генерируется.</p>
    <label>Найти каноническое название<input value={query} onChange={event => setQuery(event.currentTarget.value)} /></label>
    <label>Страна, писатель или произведение<select value={pronunciationReferenceKey(state.target) ?? ""} onChange={event => choose(event.currentTarget.value)}>
      <option value="">Выберите название</option>
      {visibleChoices.map(item => <option key={pronunciationReferenceKey(item.ref)} value={pronunciationReferenceKey(item.ref) ?? ""}>
        {item.spelling.ru} · {item.spelling.en} · {pronunciationReferenceKey(item.ref)}
      </option>)}
    </select></label>
    <p>{choices.length} доступных названий; показаны первые 100 совпадений. Написание берётся из текущего публичного каталога.</p>
    {selected && <p>Каноническое написание: <span lang="ru">{selected.spelling.ru}</span> / <span lang="en">{selected.spelling.en}</span></p>}
    {(["ru", "en"] as const).map(locale => <fieldset key={locale} disabled={!selected || !working}>
      <legend>{locale.toUpperCase()} · пометки редактора</legend>
      <label>Фонетическая запись {locale.toUpperCase()}<input lang={locale} value={annotationValue(locale, "phonetic")}
        onChange={event => updateAnnotation(locale, "phonetic", event.currentTarget.value)} /></label>
      <label>Примечания {locale.toUpperCase()}<textarea lang={locale} value={annotationValue(locale, "notes")}
        onChange={event => updateAnnotation(locale, "notes", event.currentTarget.value)} /></label>
    </fieldset>)}
    <details><summary>Рабочий JSON словаря</summary><label>Данные RU/EN<textarea value={state.dictionary}
      onChange={event => { session.edit({ dictionary: event.currentTarget.value }); setNotice(""); }} /></label></details>
    <details><summary>Черновик для проверки источника озвучки</summary>
      <p>Вставьте существующий документ narration provenance и точный текст его сценария. Сведения об исполнителе и правах сохраняются.
        После изменения пометок нужна отдельная проверка и обновление исходных хешей; экспорт не разрешает озвучку.</p>
      <label>Исходный narration provenance JSON<textarea value={state.provenance}
        onChange={event => { session.edit({ provenance: event.currentTarget.value }); setNotice(""); }} /></label>
      <label>Точный текст сценария<textarea value={state.scriptText}
        onChange={event => { session.edit({ scriptText: event.currentTarget.value }); setNotice(""); }} /></label>
    </details>
    <div className="button-row">
      <button type="button" disabled={state.busy || !currentCatalog} onClick={() => { setNotice(""); void session.preview(previewAction); }}>Проверить и показать пометки</button>
      <button type="button" onClick={() => download("pronunciation.workspace.json", session.workspace())}>Сохранить рабочую копию</button>
      <button type="button" disabled={!state.validated || state.busy} onClick={() => {
        if (state.validated) download("pronunciation.dictionary.draft.json", contentPackageCanonicalJson(state.validated) + "\n");
      }}>Экспортировать проверенный draft словаря</button>
      <button type="button" disabled={!state.narrationDraft || state.busy} onClick={() => {
        if (state.narrationDraft) download("narration.pronunciation.draft.json", contentPackageCanonicalJson(state.narrationDraft) + "\n");
      }}>Экспортировать draft narration provenance</button>
    </div>
    <label>Открыть рабочую копию<input type="file" accept="application/json,.json" onChange={importWorkspace} /></label>
    {state.error && <p role="alert">{state.error}</p>}{notice && <p role="status">{notice}</p>}
    {state.validated && <section aria-label="Предпросмотр фонетических пометок">
      <h3>Предпросмотр · без воспроизведения голоса</h3>
      {state.validated.entries.map(item => <article key={pronunciationReferenceKey(item.ref)}>
        {(["ru", "en"] as const).map(locale => <p key={locale} lang={locale}>
          <strong>{item.spelling[locale]}</strong> — {item[locale].phonetic}{item[locale].notes && <><br />{item[locale].notes}</>}
        </p>)}
      </article>)}
      {state.narrationDraft && <p>Пометки связаны с точным текстом исходного сценария. Документ остаётся черновиком для отдельной проверки.</p>}
    </section>}
  </section>;
}
