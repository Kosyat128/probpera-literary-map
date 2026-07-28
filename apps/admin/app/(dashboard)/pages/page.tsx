import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createPageAction } from "./actions";

export const metadata = { title: "Страницы" };

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: pagesResult } =
    (await supabase.from("pages").select("*").is("deleted_at", null).order("updated_at", { ascending: false })) || {};
  const pages = pagesResult || [];

  return (
    <>
      <header className="page-heading">
        <div><span className="eyebrow">Постоянные материалы</span><h1>Страницы</h1>
          <p>О проекте, контакты, редакционная политика и другие самостоятельные страницы.</p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Страница создана как черновик.</p>}
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Все страницы</h2>
          {pages.length ? (
            <table className="data-table">
              <thead><tr><th>Название</th><th>Статус</th><th>Обновлено</th></tr></thead>
              <tbody>{pages.map((page) => (
                <tr key={page.id}>
                  <td className="data-title"><strong>{page.title}</strong><small>/{page.slug}</small></td>
                  <td><span className="badge">{page.status === "published" ? "Опубликована" : "Черновик"}</span></td>
                  <td>{formatDate(page.updated_at, true)}</td>
                </tr>
              ))}</tbody>
            </table>
          ) : <div className="empty-state"><p>Страницы ещё не перенесены.</p></div>}
        </section>
        <form className="panel settings-stack" action={createPageAction}>
          <h2>Новая страница</h2>
          <label className="field"><span>Название</span><input name="title" required /></label>
          <label className="field"><span>Адрес</span><input name="slug" placeholder="Создастся автоматически" /></label>
          <label className="field"><span>Краткое описание</span><textarea name="excerpt" /></label>
          <label className="field"><span>Начальный текст</span><textarea name="content" /></label>
          <button className="button" type="submit">Создать черновик</button>
        </form>
      </div>
    </>
  );
}
