"use client";

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
  review: "На проверке",
  scheduled: "Запланирована",
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
          <span className="eyebrow">Самый быстрый способ</span>
          <h2 id="article-copy-title">Скопировать старую статью</h2>
          <p>
            Найдите готовый материал. Кабинет создаст отдельный черновик со
            всей структурой, текстом и изображениями — оригинал не изменится.
          </p>
        </div>
        <strong>{articles.length} материалов</strong>
      </div>
      <label className="field article-copy-search">
        <span>Название статьи</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Например: Морской волк"
          autoComplete="off"
        />
      </label>
      <div className="article-copy-results" role="list">
        {matches.map((article) => (
          <form action={duplicateArticleAction} key={article.id} role="listitem">
            <input type="hidden" name="id" value={article.id} />
            <button type="submit">
              <span>
                <strong>{article.title}</strong>
                <small>{statusLabels[article.status] || article.status}</small>
              </span>
              <b>Создать копию →</b>
            </button>
          </form>
        ))}
        {!matches.length && (
          <p className="article-copy-empty">По этому названию статьи не найдены.</p>
        )}
      </div>
    </section>
  );
}
