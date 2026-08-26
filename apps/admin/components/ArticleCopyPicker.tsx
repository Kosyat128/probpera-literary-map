"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { duplicateArticleAction } from "@/app/(dashboard)/articles/actions";
import {
  searchArticleCopyOptionsAction,
  type ArticleCopySearchItem,
} from "@/app/(dashboard)/articles/article-copy-search-action";

export type CopyableArticle = {
  id: string;
  title: string;
  status: string;
  updatedAt?: string | null;
};

const statusLabels: Record<string, string> = {
  draft: "Черновик",
  review: "На редактировании",
  scheduled: "К расписанию",
  published: "Опубликована",
  hidden: "Скрыта",
  archived: "В архиве",
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/\s+/gu, " ")
    .trim();
}

export default function ArticleCopyPicker({
  articles,
}: {
  articles: CopyableArticle[];
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [remoteArticles, setRemoteArticles] = useState<ArticleCopySearchItem[] | null>(
    null
  );
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, startSearch] = useTransition();
  const searchRequestRef = useRef(0);
  const needle = normalize(query);

  useEffect(() => {
    if (!expanded || needle.length < 2) {
      searchRequestRef.current += 1;
      setRemoteArticles(null);
      setSearchError(null);
      return;
    }

    const requestId = ++searchRequestRef.current;
    const timeout = window.setTimeout(() => {
      startSearch(async () => {
        const result = await searchArticleCopyOptionsAction(query);
        if (requestId !== searchRequestRef.current) return;
        setRemoteArticles(result.items);
        setSearchError(result.error);
      });
    }, 260);

    return () => window.clearTimeout(timeout);
  }, [expanded, needle, query]);

  const matches = useMemo(() => {
    if (needle.length >= 2 && remoteArticles) return remoteArticles;
    const filtered = needle
      ? articles.filter((article) => normalize(article.title).includes(needle))
      : articles;
    return filtered.slice(0, needle ? 24 : 8);
  }, [articles, needle, remoteArticles]);

  const jumpToEditor = () => {
    document
      .querySelector<HTMLElement>(".article-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="panel article-copy-picker" aria-labelledby="article-copy-title">
      <div className="article-copy-heading">
        <div>
          <span className="eyebrow">Старт статьи</span>
          <h2 id="article-copy-title">Как начать материал</h2>
          <p>
            Для обычной статьи сразу переходите к редактору. Если нужен образец,
            безопасная копия сохраняет структуру и медиа, а исходная статья не изменится.
          </p>
        </div>
        <strong>{articles.length} свежих · весь архив по поиску</strong>
      </div>

      <div className="article-copy-mode-actions">
        <button className="button" type="button" onClick={jumpToEditor}>
          Начать с чистого листа
        </button>
        <button
          className="button-secondary"
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Скрыть поиск образца" : "Найти статью-образец"}
        </button>
      </div>
      <small className="article-copy-compact-note">
        Готовые редакционные шаблоны «Мнение о книге», «Биография», «Книга и
        экранизация» и «Большое эссе» находятся уже внутри редактора ниже.
      </small>

      {expanded && (
        <>
          <label className="field article-copy-search">
            <span>Поиск статьи во всём архиве</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Например: Морфий"
              autoComplete="off"
              autoFocus
            />
            <small>
              {needle.length < 2
                ? "Показаны последние материалы. Введите минимум 2 символа для поиска по всему архиву."
                : isSearching
                  ? "Ищем по архиву…"
                  : remoteArticles
                    ? `Найдено: ${remoteArticles.length}`
                    : "Поиск запускается автоматически."}
            </small>
          </label>
          {searchError && <p className="form-message">{searchError}</p>}
          <div className="article-copy-results" role="list" aria-busy={isSearching}>
            {matches.map((article) => (
              <article className="article-copy-item" key={article.id}>
                <div>
                  <strong>{article.title}</strong>
                  <small>{statusLabels[article.status] || article.status}</small>
                </div>
                <div className="article-copy-actions">
                  <form action={duplicateArticleAction}>
                    <input type="hidden" name="id" value={article.id} />
                    <button type="submit">Создать копию и редактировать</button>
                  </form>
                  <Link
                    className="button-secondary"
                    href={`/articles/new?copyFrom=${encodeURIComponent(article.id)}`}
                  >
                    Открыть без создания копии
                  </Link>
                </div>
              </article>
            ))}
            {!matches.length && !isSearching && !searchError && (
              <p className="article-copy-empty">По вашему запросу статей не найдено.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
