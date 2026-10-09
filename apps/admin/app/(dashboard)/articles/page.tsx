import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { articleEditPath } from "@/lib/admin-routes";
import { articlePublicPath } from "@/lib/article-route";
import { articleStatusLabels, formatDate, safeCount } from "@/lib/format";
import AdminStatusState from "@/components/AdminStatusState";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, readAdminList, readAdminResult, type AdminReadIssue } from "@/lib/admin-read-result";
import { validArticleListRead } from "@/lib/article-load-validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { viewPathVariants } from "@/lib/view-path";
import {
  changeArticleStatusAction,
  duplicateArticleAction,
  importLegacyArticlesAction,
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

function ArticlesLoadState({ issue, retryHref }: { issue: AdminReadIssue; retryHref: string }) {
  return <AdminStatusState
    eyebrow="Редакционный архив"
    title="Не удалось загрузить список статей"
    description={adminReadMessage(issue)}
    action={<a className="button-secondary" href={retryHref}>Повторить загрузку</a>}
  />;
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
    imported?: string;
    skipped?: string;
    error?: string;
    published?: string;
    deleted?: string;
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
  const linkValues = { q, status, category, from, to, sort };
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}${pageLink(linkValues, currentPage)}`;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <><AdminDependencyState /><div className="state-actions"><a className="button-secondary" href={retryHref}>Повторить загрузку</a></div></>;

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
    articlesResult,
    categoriesResult,
  ] = await Promise.allSettled([
    request,
    supabase
      .from("categories")
      .select("id,name")
      .order("display_order"),
  ]);
  const articlesRead = readAdminList(articlesResult, validArticleListRead);
  if (articlesRead.status === "failed") {
    return <ArticlesLoadState issue={articlesRead.issue} retryHref={retryHref} />;
  }
  const articles = articlesRead.data;
  const categoriesRead = readAdminList(categoriesResult, (item) =>
    typeof item.id === "string" && typeof item.name === "string");
  const categories = categoriesRead.status === "success" ? categoriesRead.data : [];
  const articleViewCounts = new Map<string, number | null>();
  const viewResults = await Promise.allSettled(
    articles.map((article) => {
      const articleCategory = relationValue<{ slug?: string }>(article.categories);
      const currentPath = articlePublicPath(
        article.slug,
        articleCategory?.slug
      );
      return supabase.rpc(
        "get_content_view_count",
        {
          p_paths: viewPathVariants(currentPath, article.legacy_path),
        }
      );
    })
  );
  viewResults.forEach((result, index) => {
    const views = readAdminResult(result, (data) =>
      typeof data === "number" && Number.isSafeInteger(data) && data >= 0);
    articleViewCounts.set(articles[index].id, views.status === "success" ? views.data : null);
  });
  const authorIds = [
    ...new Set(articles.map((article) => article.author_id).filter(Boolean)),
  ];
  const [profilesResult] = await Promise.allSettled([authorIds.length
    ? supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", authorIds)
    : Promise.resolve({ data: [], error: null })]);
  const profilesRead = readAdminList(profilesResult, (profile) =>
    typeof profile.id === "string" && (profile.display_name === null || typeof profile.display_name === "string"));
  const profileNames = new Map(
    (profilesRead.status === "success" ? profilesRead.data : []).map((profile) => [profile.id, profile.display_name])
  );
  const total = safeCount(articlesResult.status === "fulfilled" ? articlesResult.value : null);
  const totalPages = total === null ? null : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasNextPage = totalPages === null ? articles.length === PAGE_SIZE : currentPage < totalPages;

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
        <div className="editor-actions">
          <form action={importLegacyArticlesAction}>
            <ConfirmSubmitButton message="Перенести в редактор только отсутствующие статьи из публичного архива? Уже отредактированные материалы не будут перезаписаны.">
              Перенести старый архив
            </ConfirmSubmitButton>
          </form>
          <Link className="button" href="/articles/new">＋ Новая статья</Link>
        </div>
      </header>

      {values.error && <p className="form-message">{values.error}</p>}
      {values.imported !== undefined && (
        <p className="form-message form-success">
          Архив синхронизирован: добавлено {Number(values.imported) || 0}, уже
          находилось в редакторе {Number(values.skipped) || 0}.
        </p>
      )}
      {values.published === "started" && (
        <p className="form-message form-success">
          Публикация запущена. Изменения отправлены на публикацию.
        </p>
      )}
      {values.deleted && (
        <p className="form-message form-success">Статья перемещена в архив.</p>
      )}
      {values.published === "queued" && (
        <p className="form-message form-success">
          Изменение статьи сохранено в резервной очереди публикации.
        </p>
      )}
      {values.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Изменение сохранено, но запрос публикации записать не удалось. Повторите публикацию позже.
        </p>
      )}

      <section className="panel">
        {categoriesRead.status === "failed" && (
          <p className="notice" role="status">Рубрики временно недоступны. <a href={retryHref}>Повторить загрузку</a></p>
        )}
        {profilesRead.status === "failed" && (
          <p className="notice" role="status">Авторы временно недоступны. <a href={retryHref}>Повторить загрузку</a></p>
        )}
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
          {categoriesRead.status === "failed" ? (
            <input type="hidden" name="category" value={category} />
          ) : <select name="category" defaultValue={category} aria-label="Рубрика">
            <option value="">Все рубрики</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>}
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
          <span>Найдено: {total === null ? "Недоступно" : total.toLocaleString("ru-RU")}</span>
          <span>Страница {currentPage}{totalPages === null ? " (общее число недоступно)" : ` из ${totalPages}`}</span>
        </div>
        {articles.length === 0 ? (
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
                const views = articleViewCounts.get(article.id) ?? null;
                return (
                  <tr key={article.id}>
                    <td>
                      <Link
                        className="article-list-title"
                        href={articleEditPath(article.id)}
                        aria-label={`Открыть статью «${article.title}» в редакторе`}
                      >
                        {article.cover_external_url ? (
                          <img src={article.cover_external_url} alt="" />
                        ) : (
                          <span aria-hidden="true">П</span>
                        )}
                        <span className="data-title">
                          <strong>{article.title}</strong>
                          <small>/{article.slug}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="data-title">
                        <strong>{articleCategory?.name || "Без рубрики"}</strong>
                        <small>
                          {profilesRead.status === "failed" && article.author_id
                            ? "Недоступно"
                            : profileNames.get(article.author_id) || "Редакция «Пробы Пера»"}
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
                    <td>{views === null ? "Недоступно" : views.toLocaleString("ru-RU")}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="button article-edit-action" href={articleEditPath(article.id)}>
                          Редактировать
                        </Link>
                        <Link className="button-secondary" href={`/articles/${article.id}/preview`}>
                          Просмотр
                        </Link>
                        <form action={duplicateArticleAction}>
                          <input type="hidden" name="id" value={article.id} />
                          <button className="button-secondary" type="submit">Копировать и редактировать</button>
                        </form>
                        {article.status !== "published" && (
                          <Link className="button" href={articleEditPath(article.id)}>
                            Открыть для публикации
                          </Link>
                        )}
                        {article.status === "published" && (
                          <form action={changeArticleStatusAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <input type="hidden" name="expected_updated_at" value={article.updated_at} />
                            <input type="hidden" name="status" value="hidden" />
                            <ConfirmSubmitButton message="Снять статью с публикации? Адрес и история сохранятся.">
                              Снять
                            </ConfirmSubmitButton>
                          </form>
                        )}
                        <form action={softDeleteArticleAction}>
                          <input type="hidden" name="id" value={article.id} />
                          <input type="hidden" name="expected_updated_at" value={article.updated_at} />
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
        {(currentPage > 1 || hasNextPage) && (
          <nav className="pagination" aria-label="Страницы списка">
            {currentPage > 1 && (
              <Link href={pageLink(linkValues, currentPage - 1)}>← Назад</Link>
            )}
            <span>{currentPage} / {totalPages === null ? "Недоступно" : totalPages}</span>
            {hasNextPage && (
              <Link href={pageLink(linkValues, currentPage + 1)}>Вперёд →</Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
