import Link from "next/link";

import { formatDate } from "@/lib/format";
import { redirect } from "@/lib/navigation";
import {
  COMMENTS_CATALOG_PAGE_SIZE,
  commentsCatalogHref,
  parseCommentsCatalogQuery,
} from "@/lib/comments-catalog-query";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { bulkModerateCommentsAction, moderateCommentAction } from "./actions";

export const metadata = { title: "Комментарии" };

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const catalog = parseCommentsCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  let request = supabase
    .from("article_comments")
    .select("id,article_slug,guest_name,body,status,created_at,updated_at,profiles(display_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (catalog.status) request = request.eq("status", catalog.status);
  if (catalog.orFilter) request = request.or(catalog.orFilter);
  const { data: commentsResult, count, error } = await request.range(catalog.from, catalog.to);
  const comments = commentsResult || [];
  const totalCount = count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / COMMENTS_CATALOG_PAGE_SIZE));
  if (!error && catalog.page > totalPages) {
    redirect(commentsCatalogHref(catalog, totalPages));
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Разговор читателей</span>
          <h1>Комментарии</h1>
          <p>
            Комментировать и оценивать материалы может любой читатель.
            Редакция управляет только нарушениями и нежелательным содержимым.
          </p>
        </div>
      </header>
      {query.error && <p className="form-message form-error" role="alert">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Статус комментария сохранён.</p>}
      <section className="panel">
        <form className="toolbar">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={catalog.term}
            placeholder="Текст, читатель или материал"
            maxLength={160}
          />
          <select name="status" defaultValue={catalog.status}>
            <option value="">Все комментарии</option>
            <option value="published">Опубликованные</option>
            <option value="hidden">Скрытые</option>
            <option value="pending">На проверке</option>
          </select>
          <input type="hidden" name="page" value="1" />
          <button className="button-secondary" type="submit">Применить</button>
        </form>
        <p className="catalog-summary">
          Найдено комментариев: <strong>{totalCount.toLocaleString("ru-RU")}</strong>
        </p>
        {comments.length > 0 && (
          <form id="bulk-comment-form" action={bulkModerateCommentsAction} className="toolbar">
            <input type="hidden" name="catalog_q" value={catalog.term} />
            <input type="hidden" name="catalog_status" value={catalog.status} />
            <input type="hidden" name="catalog_page" value={catalog.page} />
            <select name="bulk_status" defaultValue="hidden" aria-label="Статус выбранных комментариев">
              <option value="hidden">Скрыть выбранные</option>
              <option value="published">Опубликовать выбранные</option>
            </select>
            <button className="button-secondary" type="submit">Применить к выбранным</button>
          </form>
        )}
        {error ? (
          <p className="form-message form-error" role="alert">
            Не удалось загрузить комментарии. Обновите страницу или повторите позже.
          </p>
        ) : comments.length === 0 ? (
          <div className="empty-state"><p>В этом разделе пока нет комментариев.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th scope="col">Выбор</th><th>Читатель и текст</th><th>Материал</th><th>Дата</th><th>Действие</th></tr></thead>
            <tbody>
              {comments.map((comment) => {
                const profileValue = comment.profiles as unknown;
                const profile = Array.isArray(profileValue)
                  ? (profileValue[0] as { display_name?: string } | undefined)
                  : (profileValue as { display_name?: string } | null);
                return (
                  <tr key={comment.id}>
                    <td>
                      <input
                        form="bulk-comment-form"
                        type="checkbox"
                        name="selected_comment"
                        value={`${comment.id}|${comment.updated_at}`}
                        aria-label={`Выбрать комментарий ${profile?.display_name || comment.guest_name || "гостя"}`}
                      />
                    </td>
                    <td className="data-title">
                      <strong>{profile?.display_name || comment.guest_name || "Гость"}</strong>
                      <small>{comment.body}</small>
                    </td>
                    <td>{comment.article_slug}</td>
                    <td>{formatDate(comment.created_at, true)}</td>
                    <td>
                      <form action={moderateCommentAction}>
                        <input type="hidden" name="id" value={comment.id} />
                        <input type="hidden" name="expected_updated_at" value={comment.updated_at} />
                        <input type="hidden" name="catalog_q" value={catalog.term} />
                        <input type="hidden" name="catalog_status" value={catalog.status} />
                        <input type="hidden" name="catalog_page" value={catalog.page} />
                        <input type="hidden" name="status" value={comment.status === "hidden" ? "published" : "hidden"} />
                        <button className="button-secondary" type="submit">
                          {comment.status === "hidden" ? "Вернуть" : "Скрыть"}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!error && totalPages > 1 && (
          <nav className="pagination" aria-label="Страницы комментариев">
            {catalog.page > 1 ? (
              <Link href={commentsCatalogHref(catalog, catalog.page - 1)}>← Назад</Link>
            ) : (
              <span aria-disabled="true">← Назад</span>
            )}
            <span aria-current="page">Страница {catalog.page} из {totalPages}</span>
            {catalog.page < totalPages ? (
              <Link href={commentsCatalogHref(catalog, catalog.page + 1)}>Вперёд →</Link>
            ) : (
              <span aria-disabled="true">Вперёд →</span>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
