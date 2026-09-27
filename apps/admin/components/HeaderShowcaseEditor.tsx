"use client";
import { useMemo, useState } from "react";
import type { ArticleCatalogEntry } from "../../../src/data/articles/catalog";
import { parseShowcasePins, readShowcasePins, selectHeaderArticles, type ShowcasePin } from "../../../src/utils/headerArticleSelection";

export default function HeaderShowcaseEditor({ articles, value, now }: { articles: ArticleCatalogEntry[]; value: unknown; now: number }) {
  const [pins, setPins] = useState(readShowcasePins(value));
  const [language, setLanguage] = useState<"ru" | "en">("ru");
  const normalized = pins.map((pin, order) => ({ ...pin, order }));
  const result = useMemo(() => {
    try { return { selection: selectHeaderArticles(articles, language, parseShowcasePins(pins.map((pin, order) => ({ ...pin, order }))), now), error: "" }; }
    catch (error) { return { selection: null, error: error instanceof Error ? error.message : "Проверьте закрепления" }; }
  }, [articles, language, pins, now]);
  const change = (index: number, patch: Partial<ShowcasePin>) => setPins(current => current.map((pin, i) => i === index ? { ...pin, ...patch } : pin));
  const move = (index: number, direction: number) => setPins(current => {
    const next = [...current]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next;
  });
  const utc = (value: string) => value ? `${value.length === 16 ? `${value}:00` : value}Z` : "";
  const add = () => {
    const article = articles.find(item => !pins.some(pin => pin.articleId === item.id));
    if (article) setPins(current => [...current, { articleId: article.id, order: current.length, startsAt: new Date(now).toISOString(), endsAt: new Date(now + 7 * 86400000).toISOString(), timezone: "UTC" }]);
  };
  return <fieldset className="settings-stack"><legend>Верхняя витрина «Статьи» · 1+6</legend>
    <p>Без закреплений витрина выбирает свежие публикации автоматически. Первый закреплённый материал становится главным. Отзыв статьи, отсутствие перевода и истечение срока включают автоматическую замену.</p>
    <input type="hidden" name="header_showcase_pins" value={JSON.stringify(normalized)} />
    {pins.map((pin, index) => <fieldset className="settings-stack" key={index}><legend>{index === 0 ? "Главный материал" : `Дополнительный материал ${index}`}</legend>
      <label className="field"><span>Публикация</span><select value={pin.articleId} onChange={event => change(index, { articleId: event.target.value })}>
        {!articles.some(item => item.id === pin.articleId) && <option value={pin.articleId}>Материал больше не опубликован</option>}
        {articles.map(item => <option key={item.id} value={item.id} disabled={pins.some((other, i) => i !== index && other.articleId === item.id)}>{item.title}</option>)}
      </select></label>
      <div className="dashboard-grid"><label className="field"><span>Начало, UTC</span><input type="datetime-local" required step="1" value={pin.startsAt.slice(0, 19)} onChange={event => change(index, { startsAt: utc(event.target.value) })} /></label>
        <label className="field"><span>Окончание, UTC</span><input type="datetime-local" required step="1" value={pin.endsAt.slice(0, 19)} onChange={event => change(index, { endsAt: utc(event.target.value) })} /></label></div>
      <div className="button-row"><button className="button" type="button" disabled={index === 0} onClick={() => move(index, -1)}>Выше</button><button className="button" type="button" disabled={index === pins.length - 1} onClick={() => move(index, 1)}>Ниже</button><button className="button" type="button" onClick={() => setPins(current => current.filter((_, i) => i !== index))}>Убрать закрепление</button></div>
    </fieldset>)}
    <button className="button" type="button" disabled={pins.length >= 7 || pins.length >= articles.length} onClick={add}>Добавить закрепление</button>
    <label className="field"><span>Язык предпросмотра</span><select value={language} onChange={event => setLanguage(event.target.value as "ru" | "en")}><option value="ru">Русский</option><option value="en">English</option></select></label>
    {result.error ? <p role="alert">{result.error}</p> : <><strong>{result.selection?.editorialChoice ? "Выбор редакции" : "Свежие публикации"}</strong><ol>{[result.selection?.lead, ...(result.selection?.more ?? [])].filter((item): item is ArticleCatalogEntry => Boolean(item)).map(item => <li key={item.id}>{item.title}</li>)}</ol></>}
    <small>Предпросмотр использует опубликованный снимок статей. Новые публикации появятся после штатного обновления сайта; сохранение защищено от перезаписи изменений другой вкладки.</small>
  </fieldset>;
}
