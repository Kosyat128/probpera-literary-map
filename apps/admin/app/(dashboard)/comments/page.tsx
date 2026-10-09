import Link from "next/link";

import { formatDate, safeCount } from "@/lib/format";
import { adminReadMessage, isReadRecord, readAdminList } from "@/lib/admin-read-result";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
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

type CommentRead = {
  id: string; article_slug: string; guest_name: string | null; body: string;
  status: "published" | "hidden" | "pending"; created_at: string; updated_at: string;
  profiles: { display_name: string } | { display_name: string }[] | null;
};
function validCommentRead(row: CommentRead) {
  const profile = (value: unknown) => isReadRecord(value) && typeof value.display_name === "string";
  return typeof row.id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(row.id)
    && typeof row.article_slug === "string" && typeof row.body === "string"
    && (row.guest_name === null || typeof row.guest_name === "string")
    && ["published", "hidden", "pending"].includes(row.status)
    && [row.created_at, row.updated_at].every(value => typeof value === "string" && Number.isFinite(Date.parse(value)))
    && (row.profiles === null || profile(row.profiles)
      || Array.isArray(row.profiles) && row.profiles.length <= 1 && row.profiles.every(profile));
}

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
  const [response] = await Promise.allSettled([request.range(catalog.from, catalog.to)]);
  const commentsRead = readAdminList<CommentRead>(response, validCommentRead);
  const comments = commentsRead.status === "success" ? commentsRead.data : [];
  const totalCount = safeCount(response.status === "fulfilled" ? response.value : null);
  const totalPages = totalCount === null ? null : Math.max(1, Math.ceil(totalCount / COMMENTS_CATALOG_PAGE_SIZE));
  // The existing moderation action accepts an ISO timestamp with a timezone.
  // Keep other readable values out of mutation forms without rewriting them.
  const versionPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
  const versionsSupported = comments.every(comment => versionPattern.test(comment.updated_at));
  const canModerate = commentsRead.status === "success" && totalCount !== null && versionsSupported;
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}${commentsCatalogHref(catalog, catalog.page)}`;
  if (canModerate && totalPages !== null && catalog.page > totalPages) {
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
      {query.error && <p className="form-message form-error" role="alert">Не удалось подтвердить изменение комментария. Проверьте текущие данные перед повтором.</p>}
      {query.saved && <p className="form-message">Результат изменения не подтверждён параметрами ссылки. Проверьте текущие данные.</p>}
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
          Найдено комментариев: <strong>{totalCount === null ? "Недоступно" : totalCount.toLocaleString("ru-RU")}</strong>
        </p>
        {commentsRead.status === "success" && totalCount === null && <p className="form-message form-error" role="alert">
          Не удалось проверить количество комментариев. <a href={retryHref}>Повторить загрузку</a>
        </p>}
        {commentsRead.status === "success" && !versionsSupported && <p className="form-message form-error" role="alert">
          Версия комментария не позволяет безопасно изменить статус. <a href={retryHref}>Повторить загрузку</a>
        </p>}
        {canModerate && comments.length > 0 && (
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
        {commentsRead.status === "failed" ? (
          <p className="form-message form-error" role="alert">
            {adminReadMessage(commentsRead.issue)} <a href={retryHref}>Повторить загрузку</a>
          </p>
        ) : comments.length === 0 ? (
          <div className={totalCount === null ? undefined : "empty-state"}><p>{totalCount === null
            ? "На текущей странице комментариев нет. Общее количество комментариев неизвестно."
            : "В этом разделе пока нет комментариев."}</p></div>
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
                      {canModerate && <input
                        form="bulk-comment-form"
                        type="checkbox"
                        name="selected_comment"
                        value={`${comment.id}|${comment.updated_at}`}
                        aria-label={`Выбрать комментарий ${profile?.display_name || comment.guest_name || "гостя"}`}
                      />}
                    </td>
                    <td className="data-title">
                      <strong>{profile?.display_name || comment.guest_name || "Гость"}</strong>
                      <small>{comment.body}</small>
                    </td>
                    <td>{comment.article_slug}</td>
                    <td>{formatDate(comment.created_at, true)}</td>
                    <td>
                      {canModerate ? <form action={moderateCommentAction}>
                        <input type="hidden" name="id" value={comment.id} />
                        <input type="hidden" name="expected_updated_at" value={comment.updated_at} />
                        <input type="hidden" name="catalog_q" value={catalog.term} />
                        <input type="hidden" name="catalog_status" value={catalog.status} />
                        <input type="hidden" name="catalog_page" value={catalog.page} />
                        <input type="hidden" name="status" value={comment.status === "hidden" ? "published" : "hidden"} />
                        <button className="button-secondary" type="submit">
                          {comment.status === "hidden" ? "Вернуть" : "Скрыть"}
                        </button>
                      </form> : <span>Изменение статуса недоступно до проверки данных.</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {canModerate && totalPages !== null && totalPages > 1 && (
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
