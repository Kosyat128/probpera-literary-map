"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { duplicateArticleAction } from "@/app/(dashboard)/articles/actions";

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
    .trim();
}

export default function ArticleCopyPicker({
  articles,
}: {
  articles: CopyableArticle[];
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = normalize(query);
    const filtered = needle
      ? articles.filter((article) => normalize(article.title).includes(needle))
      : articles;
    return filtered.slice(0, needle ? 24 : 8);
  }, [articles, query]);

  return (
    <section className="panel article-copy-picker" aria-labelledby="article-copy-title">
      <div className="article-copy-heading">
        <div>
          <span className="eyebrow">Удобный и быстрый старт</span>
          <h2 id="article-copy-title">Скопировать для редактирования</h2>
          <p>
            Выберите уже существующую статью — можно сразу вставлять в новый черновик,
            затем заменить тему, текст и картинки.
          </p>
        </div>
        <strong>{articles.length} статей</strong>
      </div>
      <label className="field article-copy-search">
        <span>Поиск статьи</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Например: Морфий"
          autoComplete="off"
        />
      </label>
      <div className="article-copy-results" role="list">
        {matches.map((article) => (
          <article className="article-copy-item" key={article.id}>
            <div>
              <strong>{article.title}</strong>
              <small>{statusLabels[article.status] || article.status}</small>
            </div>
            <div className="article-copy-actions">
              <form action={duplicateArticleAction}>
                <input type="hidden" name="id" value={article.id} />
                <button type="submit">Скопировать как черновик</button>
              </form>
              <Link
                className="button-secondary"
                href={`/articles/new?copyFrom=${encodeURIComponent(article.id)}`}
              >
                Открыть для переписывания
              </Link>
            </div>
          </article>
        ))}
        {!matches.length && (
          <p className="article-copy-empty">По вашему запросу статей не найдено.</p>
        )}
      </div>
    </section>
  );
}
