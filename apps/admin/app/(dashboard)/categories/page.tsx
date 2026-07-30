import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import {
  createTaxonomyItemAction,
  deleteTaxonomyItemAction,
  updateTaxonomyItemAction,
} from "./actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Рубрики и теги" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
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
      {query.deleted && <p className="form-message form-success">Элемент удалён.</p>}

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Рубрики</h2>
          <table className="data-table">
            <thead><tr><th>Название</th><th>Адрес</th><th>Состояние</th><th>Действие</th></tr></thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id}>
                  <td className="data-title"><strong>{category.name}</strong><small>{category.description}</small></td>
                  <td>/{category.slug}</td>
                  <td><span className="badge">{category.is_visible ? "Показывается" : "Скрыта"}</span></td>
                  <td>
                    <details className="admin-editor-details">
                      <summary>Изменить</summary>
                      <form className="settings-stack taxonomy-edit-form" action={updateTaxonomyItemAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <input type="hidden" name="kind" value="category" />
                        <label className="field"><span>Название</span><input name="name" defaultValue={category.name} required /></label>
                        <label className="field"><span>Адрес</span><input name="slug" defaultValue={category.slug} required /></label>
                        <label className="field"><span>Описание</span><textarea name="description" defaultValue={category.description} /></label>
                        <label className="field"><span>SEO-заголовок</span><input name="seo_title" defaultValue={category.seo_title || ""} /></label>
                        <label className="field"><span>SEO-описание</span><textarea name="seo_description" defaultValue={category.seo_description || ""} /></label>
                        <label className="field"><span>Порядок</span><input type="number" name="display_order" defaultValue={category.display_order} /></label>
                        <label><input type="checkbox" name="is_visible" defaultChecked={category.is_visible} /> Показывать рубрику</label>
                        <button className="button" type="submit">Сохранить</button>
                      </form>
                    </details>
                    <form action={deleteTaxonomyItemAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <input type="hidden" name="kind" value="category" />
                      <ConfirmSubmitButton message="Удалить рубрику? Статьи сохранятся, но временно останутся без рубрики.">
                        Удалить
                      </ConfirmSubmitButton>
                    </form>
                  </td>
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
          <div className="tag-admin-list">
            {tags.length ? tags.map((tag) => (
              <details className="admin-editor-details" key={tag.id}>
                <summary>#{tag.name}</summary>
                <form className="settings-stack" action={updateTaxonomyItemAction}>
                  <input type="hidden" name="id" value={tag.id} />
                  <input type="hidden" name="kind" value="tag" />
                  <label className="field"><span>Название</span><input name="name" defaultValue={tag.name} required /></label>
                  <label className="field"><span>Адрес</span><input name="slug" defaultValue={tag.slug} required /></label>
                  <label className="field"><span>Пояснение</span><textarea name="description" defaultValue={tag.description} /></label>
                  <button className="button" type="submit">Сохранить тег</button>
                </form>
                <form action={deleteTaxonomyItemAction}>
                  <input type="hidden" name="id" value={tag.id} />
                  <input type="hidden" name="kind" value="tag" />
                  <ConfirmSubmitButton message="Удалить тег и его связи со статьями?">
                    Удалить тег
                  </ConfirmSubmitButton>
                </form>
              </details>
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
