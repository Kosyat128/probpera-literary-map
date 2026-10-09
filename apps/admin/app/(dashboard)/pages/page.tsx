import Link from "next/link";

import { formatDate, safeCount } from "@/lib/format";
import { adminReadMessage, readAdminList } from "@/lib/admin-read-result";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { canMutatePageIdentity, validPageListRead, type PageListRead } from "@/lib/page-load-validation";
import {
  PAGE_CATALOG_PAGE_SIZE,
  pageCatalogHref,
  pageCatalogStatuses,
  pageEditorHref,
  parsePageCatalogQuery,
} from "@/lib/page-catalog-query";
import { redirect } from "@/lib/navigation";
import { AdminDependencyState } from "@/components/AdminStatusState";
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
  searchParams: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
    published?: string;
    q?: string;
    status?: string;
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parsePageCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  let pagesRequest = supabase
    .from("pages")
    .select("id,title,slug,status,updated_at", { count: "exact" })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });
  if (catalog.term) pagesRequest = pagesRequest.ilike("title", catalog.pattern);
  if (catalog.status) pagesRequest = pagesRequest.eq("status", catalog.status);
  const [response] = await Promise.allSettled([pagesRequest.range(
    catalog.from,
    catalog.to
  )]);
  const pagesRead = readAdminList<PageListRead>(response, validPageListRead);
  const pages = pagesRead.status === "success" ? pagesRead.data : [];
  const count = safeCount(response.status === "fulfilled" ? response.value : null);
  const totalPages = count === null ? null : Math.max(1, Math.ceil(count / PAGE_CATALOG_PAGE_SIZE));
  const canMutate = pagesRead.status === "success" && count !== null;
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}${pageCatalogHref(catalog)}`;
  if (canMutate && totalPages !== null && catalog.page > totalPages) {
    redirect(pageCatalogHref(catalog, { page: totalPages }));
  }

  return (
    <>
      <header className="page-heading">
        <div><span className="eyebrow">Постоянные материалы</span><h1>Страницы</h1>
          <p>О проекте, контакты, редакционная политика и другие самостоятельные страницы.</p>
        </div>
      </header>
      {(query.error || query.saved || query.deleted || query.published === "started"
        || query.published === "queued" || query.published === "queue-error") && <p className="form-message">
        Результат изменения и публикации не подтверждён параметрами ссылки. Проверьте текущую страницу и очередь публикаций.
      </p>}
      <section className="panel" style={{ marginBottom: 18 }}>
        <form className="catalog-filter-form" method="get">
          <label className="field">
            <span>Название страницы</span>
            <input name="q" type="search" maxLength={120} defaultValue={catalog.term} placeholder="О проекте" />
          </label>
          <label className="field">
            <span>Статус</span>
            <select name="status" defaultValue={catalog.status}>
              <option value="">Все статусы</option>
              {Object.entries(pageCatalogStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="button" type="submit">Найти</button>
          {(catalog.term || catalog.status) && <Link className="button-secondary" href="/pages">Сбросить</Link>}
        </form>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Все страницы · {count === null ? "Недоступно" : count.toLocaleString("ru-RU")}</h2>
          {!canMutate && <p className="form-message form-error" role="alert">
            {adminReadMessage(pagesRead.status === "failed" ? pagesRead.issue : "invalid")}{" "}
            <a href={retryHref}>Повторить загрузку</a>
          </p>}
          {pagesRead.status === "failed" ? null : pages.length ? (
            <div className="data-table-wrap">
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
                      <Link className="button-secondary" href={pageEditorHref(page.id, catalog)}>
                        Редактировать
                      </Link>
                      {canMutate && canMutatePageIdentity(page) ? <>
                      <form action={changePageStatusAction}>
                        <input name="id" type="hidden" value={page.id} />
                        <input name="expected_updated_at" type="hidden" value={page.updated_at} />
                        <input name="catalog_q" type="hidden" value={catalog.term} />
                        <input name="catalog_status" type="hidden" value={catalog.status} />
                        <input name="catalog_page" type="hidden" value={catalog.page} />
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
                        <input name="expected_updated_at" type="hidden" value={page.updated_at} />
                        <input name="catalog_q" type="hidden" value={catalog.term} />
                        <input name="catalog_status" type="hidden" value={catalog.status} />
                        <input name="catalog_page" type="hidden" value={catalog.page} />
                        <ConfirmSubmitButton message={`Переместить страницу «${page.title}» в корзину?`}>
                          В корзину
                        </ConfirmSubmitButton>
                      </form>
                      </> : <span>Изменение недоступно до проверки данных.</span>}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
            </div>
          ) : <div className={count === null ? undefined : "empty-state"}><p>{count === null
            ? "На текущей странице записей нет. Общее количество страниц неизвестно."
            : "По выбранным условиям страницы не найдены."}</p></div>}
          {canMutate && totalPages !== null && totalPages > 1 && (
            <nav className="pagination catalog-pagination" aria-label="Страницы каталога страниц">
              {catalog.page > 1 ? <Link href={pageCatalogHref(catalog, { page: catalog.page - 1 })}>Назад</Link> : <span aria-disabled="true">Назад</span>}
              <span aria-current="page">Страница {catalog.page} из {totalPages}</span>
              {catalog.page < totalPages ? <Link href={pageCatalogHref(catalog, { page: catalog.page + 1 })}>Вперёд</Link> : <span aria-disabled="true">Вперёд</span>}
            </nav>
          )}
        </section>
        {canMutate && <form className="panel settings-stack" action={createPageAction}>
          <h2>Новая страница</h2>
          <input name="catalog_q" type="hidden" value={catalog.term} />
          <input name="catalog_status" type="hidden" value={catalog.status} />
          <input name="catalog_page" type="hidden" value={catalog.page} />
          <label className="field"><span>Название</span><input name="title" required /></label>
          <label className="field"><span>Адрес</span><input name="slug" placeholder="Создастся автоматически" /></label>
          <label className="field"><span>Краткое описание</span><textarea name="excerpt" /></label>
          <label className="field"><span>Начальный текст</span><textarea name="content" /></label>
          <button className="button" type="submit">Создать черновик</button>
        </form>}
      </div>
    </>
  );
}
