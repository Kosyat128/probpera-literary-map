import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { redirect } from "@/lib/navigation";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";
import {
  TAXONOMY_TAG_PAGE_SIZE,
  parseTaxonomyCatalogQuery,
  taxonomyCatalogHref,
} from "@/lib/taxonomy-catalog-query";
import {
  createTaxonomyItemAction,
  deleteTaxonomyItemAction,
  updateTaxonomyItemAction,
} from "./actions";

export const metadata = { title: "Рубрики и теги" };

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  seo_title: string | null;
  seo_description: string | null;
  display_order: number;
  is_visible: boolean;
  updated_at: string;
};

type Tag = {
  id: string;
  name: string;
  slug: string;
  description: string;
  updated_at: string;
};

function CatalogContext({
  catalog,
}: {
  catalog: ReturnType<typeof parseTaxonomyCatalogQuery>;
}) {
  return (
    <>
      <input type="hidden" name="catalog_q" value={catalog.term} />
      <input type="hidden" name="catalog_page" value={catalog.page} />
    </>
  );
}

function savedMessage(value?: string) {
  if (value === "category-created") return "Рубрика создана.";
  if (value === "category-updated") return "Рубрика сохранена.";
  if (value === "tag-created") return "Тег создан.";
  if (value === "tag-updated") return "Тег сохранён.";
  return value ? "Изменение сохранено." : "";
}

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
    published?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parseTaxonomyCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;

  let tagsRequest = supabase
    .from("tags")
    .select("id,name,slug,description,updated_at", { count: "exact" })
    .order("name", { ascending: true })
    .order("id", { ascending: true });
  if (catalog.orFilter) tagsRequest = tagsRequest.or(catalog.orFilter);

  const [categoriesResponse, tagsResponse] = await Promise.all([
    supabase
      .from("categories")
      .select(
        "id,name,slug,description,seo_title,seo_description,display_order,is_visible,updated_at"
      )
      .order("display_order", { ascending: true })
      .order("name", { ascending: true })
      .order("id", { ascending: true }),
    tagsRequest.range(catalog.from, catalog.to),
  ]);
  const categories = (categoriesResponse.data || []) as Category[];
  const tags = (tagsResponse.data || []) as Tag[];
  const tagCount = tagsResponse.count || 0;
  const tagPages = Math.max(1, Math.ceil(tagCount / TAXONOMY_TAG_PAGE_SIZE));

  if (!tagsResponse.error && catalog.page > tagPages) {
    redirect(taxonomyCatalogHref(catalog, { page: tagPages }));
  }

  const saved = savedMessage(query.saved);

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

      {query.error && <p className="form-message form-error" role="alert">{query.error}</p>}
      {saved && <p className="form-message form-success">{saved}</p>}
      {query.deleted === "category" && <p className="form-message form-success">Рубрика удалена.</p>}
      {query.deleted === "tag" && <p className="form-message form-success">Тег удалён.</p>}
      {query.published === "started" && (
        <p className="form-message form-success">Публичная сборка с изменениями структуры запущена.</p>
      )}
      {query.published === "queued" && (
        <p className="form-message form-success">
          Изменение сохранено в резервной очереди публикации; запуск сборки пока не подтверждён.
        </p>
      )}
      {query.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Изменение сохранено, но запрос публикации записать не удалось. Повторите публикацию позже.
        </p>
      )}

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Рубрики</h2>
          {categoriesResponse.error ? (
            <p className="form-message form-error" role="alert">
              {operatorDataError("categories", "load")}
            </p>
          ) : categories.length ? (
            <table className="data-table">
              <thead>
                <tr><th>Название</th><th>Адрес</th><th>Состояние</th><th>Действия</th></tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="data-title">
                      <strong>{category.name}</strong>
                      <small>{category.description}</small>
                    </td>
                    <td>/{category.slug}</td>
                    <td><span className="badge">{category.is_visible ? "Показывается" : "Скрыта"}</span></td>
                    <td>
                      <details className="admin-editor-details">
                        <summary>Изменить</summary>
                        <form className="settings-stack taxonomy-edit-form" action={updateTaxonomyItemAction}>
                          <input type="hidden" name="id" value={category.id} />
                          <input type="hidden" name="kind" value="category" />
                          <input type="hidden" name="expected_updated_at" value={category.updated_at} />
                          <CatalogContext catalog={catalog} />
                          <label className="field"><span>Название</span><input name="name" defaultValue={category.name} required maxLength={120} /></label>
                          <label className="field"><span>Адрес</span><input name="slug" defaultValue={category.slug} required maxLength={120} /></label>
                          <label className="field"><span>Описание</span><textarea name="description" defaultValue={category.description} maxLength={1000} /></label>
                          <label className="field"><span>SEO-заголовок</span><input name="seo_title" defaultValue={category.seo_title || ""} maxLength={180} /></label>
                          <label className="field"><span>SEO-описание</span><textarea name="seo_description" defaultValue={category.seo_description || ""} maxLength={400} /></label>
                          <label className="field"><span>Порядок</span><input type="number" name="display_order" defaultValue={category.display_order} min={-10000} max={10000} /></label>
                          <label><input type="checkbox" name="is_visible" defaultChecked={category.is_visible} /> Показывать рубрику</label>
                          <button className="button" type="submit">Сохранить рубрику</button>
                        </form>
                      </details>
                      <form action={deleteTaxonomyItemAction}>
                        <input type="hidden" name="id" value={category.id} />
                        <input type="hidden" name="kind" value="category" />
                        <input type="hidden" name="expected_updated_at" value={category.updated_at} />
                        <CatalogContext catalog={catalog} />
                        <ConfirmSubmitButton message="Удалить рубрику? Статьи сохранятся, но временно останутся без рубрики.">
                          Удалить
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state"><p>Рубрики ещё не созданы.</p></div>
          )}
        </section>

        <form className="panel settings-stack" action={createTaxonomyItemAction}>
          <h2>Добавить рубрику</h2>
          <input type="hidden" name="kind" value="category" />
          <CatalogContext catalog={catalog} />
          <label className="field"><span>Название</span><input name="name" required minLength={2} maxLength={120} /></label>
          <label className="field"><span>Описание</span><textarea name="description" maxLength={1000} /></label>
          <button className="button" type="submit">Создать рубрику</button>
        </form>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <h2>Все теги</h2>
          <form className="settings-stack" method="get">
            <label className="field">
              <span>Поиск по названию или адресу</span>
              <input type="search" name="q" defaultValue={catalog.term} maxLength={120} placeholder="Например, Серебряный век" />
            </label>
            <div>
              <button className="button-secondary" type="submit">Найти</button>{" "}
              {catalog.term && <Link className="button-secondary" href="/categories">Сбросить</Link>}
            </div>
          </form>

          <p>{tagCount ? `Найдено тегов: ${tagCount}` : catalog.term ? "Совпадений нет." : "Тегов пока нет."}</p>
          {tagsResponse.error ? (
            <p className="form-message form-error" role="alert">
              {operatorDataError("categories", "load")}
            </p>
          ) : tags.length ? (
            <table className="data-table">
              <thead><tr><th>Название</th><th>Адрес</th><th>Действия</th></tr></thead>
              <tbody>
                {tags.map((tag) => (
                  <tr key={tag.id}>
                    <td className="data-title"><strong>#{tag.name}</strong><small>{tag.description}</small></td>
                    <td>/{tag.slug}</td>
                    <td>
                      <details className="admin-editor-details">
                        <summary>Изменить</summary>
                        <form className="settings-stack" action={updateTaxonomyItemAction}>
                          <input type="hidden" name="id" value={tag.id} />
                          <input type="hidden" name="kind" value="tag" />
                          <input type="hidden" name="expected_updated_at" value={tag.updated_at} />
                          <CatalogContext catalog={catalog} />
                          <label className="field"><span>Название</span><input name="name" defaultValue={tag.name} required maxLength={80} /></label>
                          <label className="field"><span>Адрес</span><input name="slug" defaultValue={tag.slug} required maxLength={80} /></label>
                          <label className="field"><span>Пояснение</span><textarea name="description" defaultValue={tag.description} maxLength={1000} /></label>
                          <button className="button" type="submit">Сохранить тег</button>
                        </form>
                      </details>
                      <form action={deleteTaxonomyItemAction}>
                        <input type="hidden" name="id" value={tag.id} />
                        <input type="hidden" name="kind" value="tag" />
                        <input type="hidden" name="expected_updated_at" value={tag.updated_at} />
                        <CatalogContext catalog={catalog} />
                        <ConfirmSubmitButton message="Удалить тег и его связи со статьями?">
                          Удалить тег
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>{catalog.term ? "Измените поисковый запрос." : "Теги ещё не созданы."}</p>
            </div>
          )}

          {!tagsResponse.error && tagPages > 1 && (
            <nav className="pagination" aria-label="Страницы тегов">
              {catalog.page > 1 ? <Link href={taxonomyCatalogHref(catalog, { page: 1 })}>Первая</Link> : <span aria-disabled="true">Первая</span>}
              {catalog.page > 1 ? <Link href={taxonomyCatalogHref(catalog, { page: catalog.page - 1 })}>Назад</Link> : <span aria-disabled="true">Назад</span>}
              <span aria-current="page">Страница {catalog.page} из {tagPages}</span>
              {catalog.page < tagPages ? <Link href={taxonomyCatalogHref(catalog, { page: catalog.page + 1 })}>Вперёд</Link> : <span aria-disabled="true">Вперёд</span>}
              {catalog.page < tagPages ? <Link href={taxonomyCatalogHref(catalog, { page: tagPages })}>Последняя</Link> : <span aria-disabled="true">Последняя</span>}
            </nav>
          )}
        </section>

        <form className="panel settings-stack" action={createTaxonomyItemAction}>
          <h2>Добавить тег</h2>
          <input type="hidden" name="kind" value="tag" />
          <CatalogContext catalog={catalog} />
          <label className="field"><span>Название</span><input name="name" required minLength={2} maxLength={80} /></label>
          <label className="field"><span>Пояснение</span><textarea name="description" maxLength={1000} /></label>
          <button className="button" type="submit">Создать тег</button>
        </form>
      </div>
    </>
  );
}
