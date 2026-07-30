import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import {
  changePageStatusAction,
  createPageAction,
  softDeletePageAction,
} from "./actions";

export const metadata = { title: "Страницы" };

export default async function PagesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
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
      {query.saved && <p className="form-message form-success">Изменения сохранены.</p>}
      {query.deleted && <p className="form-message form-success">Страница перемещена в корзину.</p>}
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Все страницы</h2>
          {pages.length ? (
            <table className="data-table">
              <thead><tr><th>Название</th><th>Статус</th><th>Обновлено</th><th>Действия</th></tr></thead>
              <tbody>{pages.map((page) => (
                <tr key={page.id}>
                  <td className="data-title">
                    <strong>{page.title}</strong>
                    <small>/stranitsy/{page.slug}/</small>
                  </td>
                  <td>
                    <span className="badge">
                      {page.status === "published"
                        ? "Опубликована"
                        : page.status === "hidden"
                          ? "Скрыта"
                          : "Черновик"}
                    </span>
                  </td>
                  <td>{formatDate(page.updated_at, true)}</td>
                  <td>
                    <div className="table-actions">
                      <a className="button-secondary" href={`/admin/pages/${page.id}`}>
                        Редактировать
                      </a>
                      <form action={changePageStatusAction}>
                        <input name="id" type="hidden" value={page.id} />
                        <input
                          name="status"
                          type="hidden"
                          value={page.status === "published" ? "draft" : "published"}
                        />
                        <button className="button-secondary" type="submit">
                          {page.status === "published" ? "Снять" : "Опубликовать"}
                        </button>
                      </form>
                      <form action={softDeletePageAction}>
                        <input name="id" type="hidden" value={page.id} />
                        <ConfirmSubmitButton message={`Переместить страницу «${page.title}» в корзину?`}>
                          В корзину
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
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
