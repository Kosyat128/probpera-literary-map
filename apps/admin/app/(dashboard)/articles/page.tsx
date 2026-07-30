import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { articlePublicPath } from "@/lib/article-route";
import { articleStatusLabels, formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  changeArticleStatusAction,
  duplicateArticleAction,
  softDeleteArticleAction,
} from "./actions";

export const metadata = { title: "Статьи" };

const PAGE_SIZE = 40;

function pageLink(
  values: Record<string, string>,
  page: number
) {
  const params = new URLSearchParams(
    Object.entries(values).filter(([, value]) => Boolean(value))
  );
  params.set("page", String(page));
  return `/articles?${params.toString()}`;
}

function relationValue<T>(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as T | null | undefined;
}

export default async function ArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const values = await searchParams;
  const q = (values.q || "").trim();
  const status = values.status || "";
  const category = values.category || "";
  const from = values.from || "";
  const to = values.to || "";
  const sort = ["updated", "published", "title"].includes(values.sort || "")
    ? values.sort || "updated"
    : "updated";
  const currentPage = Math.max(1, Number.parseInt(values.page || "1", 10) || 1);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  let request = supabase
    .from("articles")
    .select(
      "id,title,slug,status,author_id,cover_external_url,created_at,updated_at,published_at,legacy_path,categories(id,name,slug)",
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (q) {
    const safeQuery = q.replace(/[,()%]/gu, " ").slice(0, 120);
    request = request.or(
      `title.ilike.%${safeQuery}%,subtitle.ilike.%${safeQuery}%,excerpt.ilike.%${safeQuery}%,content_html.ilike.%${safeQuery}%`
    );
  }
  if (status && status in articleStatusLabels) {
    request = request.eq("status", status);
  }
  if (/^[0-9a-f-]{36}$/iu.test(category)) {
    request = request.eq("category_id", category);
  }
  if (/^\d{4}-\d{2}-\d{2}$/u.test(from)) {
    request = request.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/u.test(to)) {
    request = request.lte("created_at", `${to}T23:59:59.999Z`);
  }
  if (sort === "title") {
    request = request.order("title", { ascending: true });
  } else if (sort === "published") {
    request = request.order("published_at", {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    request = request.order("updated_at", { ascending: false });
  }
  request = request.range(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE - 1
  );

  const [
    { data: articlesResult, error, count },
    { data: categoriesResult },
    { data: viewsResult },
  ] = await Promise.all([
    request,
    supabase
      .from("categories")
      .select("id,name")
      .order("display_order"),
    supabase
      .from("content_views")
      .select("path")
      .order("created_at", { ascending: false })
      .limit(10_000),
  ]);
  const articles = articlesResult || [];
  const categories = categoriesResult || [];
  const viewCounts = new Map<string, number>();
  for (const view of viewsResult || []) {
    const path = String(view.path || "").replace(/\/+$/u, "");
    viewCounts.set(path, (viewCounts.get(path) || 0) + 1);
  }
  const authorIds = [
    ...new Set(articles.map((article) => article.author_id).filter(Boolean)),
  ];
  const { data: profilesResult } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", authorIds)
    : { data: [] };
  const profileNames = new Map(
    (profilesResult || []).map((profile) => [profile.id, profile.display_name])
  );
  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkValues = { q, status, category, from, to, sort };

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Редакционный архив</span>
          <h1>Статьи</h1>
          <p>
            Поиск по тексту, фильтры, реальные просмотры, предпросмотр,
            дублирование, публикация и история версий.
          </p>
        </div>
        <Link className="button" href="/articles/new">＋ Новая статья</Link>
      </header>

      <section className="panel">
        <form className="toolbar article-filter-toolbar">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Поиск по заголовку и тексту…"
            aria-label="Поиск статей"
          />
          <select name="status" defaultValue={status} aria-label="Статус">
            <option value="">Все статусы</option>
            {Object.entries(articleStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="category" defaultValue={category} aria-label="Рубрика">
            <option value="">Все рубрики</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={from} aria-label="Дата от" />
          <input type="date" name="to" defaultValue={to} aria-label="Дата до" />
          <select name="sort" defaultValue={sort} aria-label="Сортировка">
            <option value="updated">Недавно изменённые</option>
            <option value="published">По дате публикации</option>
            <option value="title">По заголовку</option>
          </select>
          <button className="button-secondary" type="submit">Применить</button>
          <Link className="button-secondary" href="/articles">Сбросить</Link>
        </form>

        <div className="table-summary">
          <span>Найдено: {total.toLocaleString("ru-RU")}</span>
          <span>Страница {currentPage} из {totalPages}</span>
        </div>
        {error && <p className="form-message">Не удалось загрузить список: {error.message}</p>}
        {!error && articles.length === 0 ? (
          <div className="empty-state">
            <div>
              <p>Материалы с такими условиями не найдены.</p>
              <Link className="button-secondary" href="/articles">Сбросить фильтры</Link>
            </div>
          </div>
        ) : (
          <table className="data-table article-table">
            <thead>
              <tr>
                <th>Материал</th>
                <th>Рубрика и автор</th>
                <th>Статус</th>
                <th>Даты</th>
                <th>Просмотры</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const articleCategory = relationValue<{
                  name?: string;
                  slug?: string;
                }>(article.categories);
                const publicPath = articlePublicPath(
                  article.slug,
                  articleCategory?.slug
                ).replace(/\/+$/u, "");
                const views = [...viewCounts].reduce(
                  (sum, [path, pathCount]) =>
                    path.endsWith(publicPath) ? sum + pathCount : sum,
                  0
                );
                return (
                  <tr key={article.id}>
                    <td>
                      <span className="article-list-title">
                        {article.cover_external_url ? (
                          <img src={article.cover_external_url} alt="" />
                        ) : (
                          <span aria-hidden="true">П</span>
                        )}
                        <span className="data-title">
                          <strong>{article.title}</strong>
                          <small>/{article.slug}</small>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className="data-title">
                        <strong>{articleCategory?.name || "Без рубрики"}</strong>
                        <small>
                          {profileNames.get(article.author_id) || "Редакция «Пробы Пера»"}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${article.status}`}>
                        {articleStatusLabels[article.status] || article.status}
                      </span>
                    </td>
                    <td>
                      <span className="data-title">
                        <strong>{formatDate(article.updated_at, true)}</strong>
                        <small>
                          {article.published_at
                            ? `опубликована ${formatDate(article.published_at)}`
                            : `создана ${formatDate(article.created_at)}`}
                        </small>
                      </span>
                    </td>
                    <td>{views.toLocaleString("ru-RU")}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="button-secondary" href={`/articles/${article.id}`}>
                          Редактор
                        </Link>
                        <Link className="button-secondary" href={`/articles/${article.id}/preview`}>
                          Просмотр
                        </Link>
                        <form action={duplicateArticleAction}>
                          <input type="hidden" name="id" value={article.id} />
                          <button className="button-secondary" type="submit">Копия</button>
                        </form>
                        {article.status === "published" && (
                          <form action={changeArticleStatusAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <input type="hidden" name="status" value="hidden" />
                            <ConfirmSubmitButton message="Снять статью с публикации? Адрес и история сохранятся.">
                              Снять
                            </ConfirmSubmitButton>
                          </form>
                        )}
                        <form action={softDeleteArticleAction}>
                          <input type="hidden" name="id" value={article.id} />
                          <ConfirmSubmitButton message="Переместить статью в корзину? Данные останутся восстановимыми.">
                            В корзину
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <nav className="pagination" aria-label="Страницы списка">
            {currentPage > 1 && (
              <Link href={pageLink(linkValues, currentPage - 1)}>← Назад</Link>
            )}
            <span>{currentPage} / {totalPages}</span>
            {currentPage < totalPages && (
              <Link href={pageLink(linkValues, currentPage + 1)}>Вперёд →</Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
