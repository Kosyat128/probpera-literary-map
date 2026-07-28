import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { moderateCommentAction } from "./actions";

export const metadata = { title: "Комментарии" };

export default async function CommentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "" } = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  let request = supabase
    .from("article_comments")
    .select("id,article_slug,guest_name,body,status,created_at,profiles(display_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (status === "published" || status === "hidden" || status === "pending") {
    request = request.eq("status", status);
  }
  const { data: commentsResult } = await request;
  const comments = commentsResult || [];

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
      <section className="panel">
        <form className="toolbar">
          <select name="status" defaultValue={status}>
            <option value="">Все комментарии</option>
            <option value="published">Опубликованные</option>
            <option value="hidden">Скрытые</option>
            <option value="pending">На проверке</option>
          </select>
          <button className="button-secondary" type="submit">Применить</button>
        </form>
        {comments.length === 0 ? (
          <div className="empty-state"><p>В этом разделе пока нет комментариев.</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Читатель и текст</th><th>Материал</th><th>Дата</th><th>Действие</th></tr></thead>
            <tbody>
              {comments.map((comment) => {
                const profileValue = comment.profiles as unknown;
                const profile = Array.isArray(profileValue)
                  ? (profileValue[0] as { display_name?: string } | undefined)
                  : (profileValue as { display_name?: string } | null);
                return (
                  <tr key={comment.id}>
                    <td className="data-title">
                      <strong>{profile?.display_name || comment.guest_name || "Гость"}</strong>
                      <small>{comment.body}</small>
                    </td>
                    <td>{comment.article_slug}</td>
                    <td>{formatDate(comment.created_at, true)}</td>
                    <td>
                      <form action={moderateCommentAction}>
                        <input type="hidden" name="id" value={comment.id} />
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
      </section>
    </>
  );
}
