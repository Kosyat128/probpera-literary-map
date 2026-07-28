import Link from "next/link";

import { articleStatusLabels, formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Статьи" };

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  let query = supabase
    .from("articles")
    .select("id,title,slug,status,updated_at,published_at,legacy_path,categories(name)")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (q.trim()) query = query.ilike("title", `%${q.trim()}%`);
  if (status && status in articleStatusLabels) query = query.eq("status", status);

  const { data: articlesResult, error } = await query;
  const articles = articlesResult || [];

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Редакционный архив</span>
          <h1>Статьи</h1>
          <p>
            Черновики, публикации, расписание, SEO-адреса и история версий в
            одном списке.
          </p>
        </div>
        <Link className="button" href="/articles/new">＋ Новая статья</Link>
      </header>

      <section className="panel">
        <form className="toolbar">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Поиск по заголовку…"
            aria-label="Поиск статей"
          />
          <select name="status" defaultValue={status} aria-label="Статус">
            <option value="">Все статусы</option>
            {Object.entries(articleStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="button-secondary" type="submit">Найти</button>
        </form>

        {error && <p className="form-message">Не удалось загрузить список: {error.message}</p>}
        {!error && articles.length === 0 ? (
          <div className="empty-state">
            <div>
              <p>Материалы с такими условиями не найдены.</p>
              <Link className="button-secondary" href="/articles">Сбросить фильтры</Link>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th>Рубрика</th>
                <th>Статус</th>
                <th>Обновлено</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const categoryValue = article.categories as unknown;
                const category = Array.isArray(categoryValue)
                  ? (categoryValue[0] as { name?: string } | undefined)
                  : (categoryValue as { name?: string } | null);
                return (
                  <tr key={article.id}>
                    <td>
                      <span className="data-title">
                        <strong>{article.title}</strong>
                        <small>/{article.slug}</small>
                      </span>
                    </td>
                    <td>{category?.name || "Без рубрики"}</td>
                    <td>
                      <span className={`badge badge-${article.status}`}>
                        {articleStatusLabels[article.status] || article.status}
                      </span>
                    </td>
                    <td>{formatDate(article.updated_at, true)}</td>
                    <td>
                      <Link className="button-secondary" href={`/articles/${article.id}`}>
                        Открыть
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
