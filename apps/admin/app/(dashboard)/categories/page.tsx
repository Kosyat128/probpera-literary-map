import { createTaxonomyItemAction } from "./actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Рубрики и теги" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: categoriesResult }, { data: tagsResult }] = await Promise.all([
    supabase.from("categories").select("*").order("display_order"),
    supabase.from("tags").select("*").order("name").limit(200),
  ]);
  const categories = categoriesResult || [];
  const tags = tagsResult || [];

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Структура журнала</span>
          <h1>Рубрики и теги</h1>
          <p>
            Рубрика задаёт главный раздел, а теги связывают писателей, книги,
            страны, эпохи и темы между материалами.
          </p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Элемент добавлен.</p>}

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Рубрики</h2>
          <table className="data-table">
            <thead><tr><th>Название</th><th>Адрес</th><th>Состояние</th></tr></thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="data-title"><strong>{category.name}</strong><small>{category.description}</small></td>
                  <td>/{category.slug}</td>
                  <td><span className="badge">{category.is_visible ? "Показывается" : "Скрыта"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <form className="panel settings-stack" action={createTaxonomyItemAction}>
          <h2>Добавить рубрику</h2>
          <input type="hidden" name="kind" value="category" />
          <label className="field"><span>Название</span><input name="name" required minLength={2} /></label>
          <label className="field"><span>Описание</span><textarea name="description" maxLength={1000} /></label>
          <button className="button" type="submit">Создать рубрику</button>
        </form>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <h2>Теги</h2>
          <div className="quick-actions">
            {tags.length ? tags.map((tag) => (
              <span className="button-secondary" key={tag.id}>#{tag.name}</span>
            )) : <p>Теги ещё не созданы.</p>}
          </div>
        </section>
        <form className="panel settings-stack" action={createTaxonomyItemAction}>
          <h2>Добавить тег</h2>
          <input type="hidden" name="kind" value="tag" />
          <label className="field"><span>Название</span><input name="name" required minLength={2} /></label>
          <label className="field"><span>Пояснение</span><textarea name="description" maxLength={1000} /></label>
          <button className="button" type="submit">Создать тег</button>
        </form>
      </div>
    </>
  );
}
