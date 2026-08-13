import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { redirect } from "@/lib/navigation";
import {
  SEO_REDIRECT_PAGE_SIZE,
  parseSeoCatalogQuery,
  seoCatalogHref,
  seoRedirectCodes,
  seoRedirectStatuses,
} from "@/lib/seo-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  createRedirectAction,
  deleteRedirectAction,
  updateRedirectAction,
} from "./actions";

export const metadata = { title: "SEO и адреса" };

type RedirectRecord = {
  id: string;
  source_path: string;
  destination_path: string;
  status_code: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SeoIssue = {
  id: string;
  title: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
};

const SEO_ISSUES_FILTER =
  'seo_title.is.null,seo_title.eq."",seo_description.is.null,seo_description.eq."",canonical_url.is.null,canonical_url.eq.""';

function CatalogContext({ catalog }: { catalog: ReturnType<typeof parseSeoCatalogQuery> }) {
  return (
    <>
      <input type="hidden" name="catalog_q" value={catalog.term} />
      <input type="hidden" name="catalog_status" value={catalog.status} />
      <input type="hidden" name="catalog_code" value={catalog.code} />
      <input type="hidden" name="catalog_page" value={catalog.page} />
    </>
  );
}

function issueLabel(article: SeoIssue) {
  const missing = [];
  if (!article.seo_title) missing.push("заголовок");
  if (!article.seo_description) missing.push("описание");
  if (!article.canonical_url) missing.push("canonical");
  return `нет: ${missing.join(", ")}`;
}

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
    published?: string;
    q?: string;
    status?: string;
    code?: string;
    page?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parseSeoCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  let redirectsRequest = supabase
    .from("redirects")
    .select(
      "id,source_path,destination_path,status_code,is_active,created_at,updated_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (catalog.orFilter) redirectsRequest = redirectsRequest.or(catalog.orFilter);
  if (catalog.status !== "all") {
    redirectsRequest = redirectsRequest.eq("is_active", catalog.status === "active");
  }
  if (catalog.code !== "all") {
    redirectsRequest = redirectsRequest.eq("status_code", Number(catalog.code));
  }

  const [
    articlesCountResponse,
    issuesCountResponse,
    issuesPreviewResponse,
    redirectsResponse,
    permanentRedirectsResponse,
  ] = await Promise.all([
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "published")
      .or(SEO_ISSUES_FILTER),
    supabase
      .from("articles")
      .select("id,title,seo_title,seo_description,canonical_url")
      .is("deleted_at", null)
      .eq("status", "published")
      .or(SEO_ISSUES_FILTER)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(12),
    redirectsRequest.range(catalog.from, catalog.to),
    supabase
      .from("redirects")
      .select("id", { count: "exact", head: true })
      .eq("status_code", 301)
      .eq("is_active", true),
  ]);

  const redirects = (redirectsResponse.data || []) as RedirectRecord[];
  const issues = (issuesPreviewResponse.data || []) as SeoIssue[];
  const redirectCount = redirectsResponse.count || 0;
  const redirectPages = Math.max(1, Math.ceil(redirectCount / SEO_REDIRECT_PAGE_SIZE));
  if (!redirectsResponse.error && catalog.page > redirectPages) {
    redirect(seoCatalogHref(catalog, { page: redirectPages }));
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Поиск и сохранение ссылок</span>
          <h1>SEO и адреса</h1>
          <p>
            Понятные URL, канонические адреса, сниппеты, карта сайта,
            микроразметка и переадресации со старых страниц.
          </p>
        </div>
      </header>

      {query.error && <p className="form-message form-error" role="alert">{query.error}</p>}
      {query.saved === "created" && <p className="form-message form-success">Переадресация создана.</p>}
      {query.saved === "updated" && <p className="form-message form-success">Переадресация сохранена.</p>}
      {query.deleted && <p className="form-message form-success">Переадресация удалена.</p>}
      {query.published === "started" && (
        <p className="form-message form-success">Публичная сборка с изменениями адресов запущена.</p>
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

      <section className="stats-grid">
        <article className="stat-card">
          <span>Материалов</span>
          <strong>{articlesCountResponse.error ? "—" : articlesCountResponse.count || 0}</strong>
          <small>в базе CMS</small>
        </article>
        <article className="stat-card">
          <span>Требуют SEO-проверки</span>
          <strong>{issuesCountResponse.error ? "—" : issuesCountResponse.count || 0}</strong>
          <small>только опубликованные</small>
        </article>
        <article className="stat-card">
          <span>Активных 301-редиректов</span>
          <strong>{permanentRedirectsResponse.error ? "—" : permanentRedirectsResponse.count || 0}</strong>
          <small>сохраняют поисковый вес</small>
        </article>
        <article className="stat-card">
          <span>Структурированные данные</span>
          <strong>Article</strong>
          <small>готовы для сборщика</small>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Что проверяется</h2>
          <div className="status-list">
            <div><span>Человекочитаемый адрес по заголовку</span><strong>Автоматически</strong></div>
            <div><span>Canonical и Open Graph</span><strong>В редакторе</strong></div>
            <div><span>Старые адреса Tilda</span><strong>Без удаления</strong></div>
            <div><span>sitemap.xml и robots.txt</span><strong>При сборке</strong></div>
            <div><span>Article / BreadcrumbList JSON-LD</span><strong>При сборке</strong></div>
          </div>
        </section>
        <section className="panel">
          <h2>Материалы с замечаниями</h2>
          {issuesPreviewResponse.error ? (
            <p className="form-message form-error" role="alert">
              Не удалось получить SEO-проверку: {issuesPreviewResponse.error.message}
            </p>
          ) : (
            <div className="status-list">
              {issues.map((article) => (
                <div key={article.id}><span>{article.title}</span><strong>{issueLabel(article)}</strong></div>
              ))}
              {!issues.length && <p>У опубликованных материалов заполнены основные SEO-поля.</p>}
            </div>
          )}
        </section>
      </div>

      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="panel">
          <h2>Все переадресации</h2>
          <form className="settings-stack" method="get">
            <label className="field">
              <span>Поиск по старому или новому адресу</span>
              <input name="q" type="search" maxLength={180} defaultValue={catalog.term} placeholder="/staraya-stranitsa" />
            </label>
            <div className="dashboard-grid">
              <label className="field">
                <span>Состояние</span>
                <select name="status" defaultValue={catalog.status}>
                  {Object.entries(seoRedirectStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Код ответа</span>
                <select name="code" defaultValue={catalog.code}>
                  {Object.entries(seoRedirectCodes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
            </div>
            <div>
              <button className="button-secondary" type="submit">Применить</button>{" "}
              {(catalog.term || catalog.status !== "all" || catalog.code !== "all") && (
                <Link className="button-secondary" href="/seo">Сбросить</Link>
              )}
            </div>
          </form>

          <p>{redirectCount ? `Найдено переадресаций: ${redirectCount}` : "Переадресации не найдены."}</p>
          {redirectsResponse.error ? (
            <p className="form-message form-error" role="alert">
              Не удалось загрузить переадресации: {redirectsResponse.error.message}
            </p>
          ) : redirects.length ? (
            <table className="data-table">
              <thead><tr><th>Старый адрес</th><th>Новый адрес</th><th>Код</th><th>Состояние</th><th>Действия</th></tr></thead>
              <tbody>
                {redirects.map((item) => (
                  <tr key={item.id}>
                    <td>{item.source_path}</td>
                    <td>{item.destination_path}</td>
                    <td>{item.status_code}</td>
                    <td><span className="badge">{item.is_active ? "Активна" : "Выключена"}</span></td>
                    <td>
                      <details className="admin-editor-details">
                        <summary>Изменить</summary>
                        <form className="settings-stack" action={updateRedirectAction}>
                          <input name="id" type="hidden" value={item.id} />
                          <input name="expected_updated_at" type="hidden" value={item.updated_at} />
                          <CatalogContext catalog={catalog} />
                          <label className="field"><span>Старый адрес</span><input name="source_path" required maxLength={500} defaultValue={item.source_path} /></label>
                          <label className="field"><span>Новый адрес</span><input name="destination_path" required maxLength={500} defaultValue={item.destination_path} /></label>
                          <label className="field"><span>Код</span><select name="status_code" defaultValue={String(item.status_code)}>
                            <option value="301">301 · постоянный</option>
                            <option value="302">302 · временный</option>
                            <option value="307">307 · временный, строгий</option>
                            <option value="308">308 · постоянный, строгий</option>
                          </select></label>
                          <label><input name="is_active" type="checkbox" defaultChecked={item.is_active} /> Переадресация активна</label>
                          <button className="button" type="submit">Сохранить переадресацию</button>
                        </form>
                      </details>
                      <form action={deleteRedirectAction}>
                        <input name="id" type="hidden" value={item.id} />
                        <input name="expected_updated_at" type="hidden" value={item.updated_at} />
                        <CatalogContext catalog={catalog} />
                        <ConfirmSubmitButton message={`Удалить переадресацию ${item.source_path}?`}>Удалить</ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state"><p>Измените фильтры или создайте новую переадресацию.</p></div>
          )}

          {!redirectsResponse.error && redirectPages > 1 && (
            <nav className="pagination" aria-label="Страницы переадресаций">
              {catalog.page > 1 ? <Link href={seoCatalogHref(catalog, { page: 1 })}>Первая</Link> : <span aria-disabled="true">Первая</span>}
              {catalog.page > 1 ? <Link href={seoCatalogHref(catalog, { page: catalog.page - 1 })}>Назад</Link> : <span aria-disabled="true">Назад</span>}
              <span aria-current="page">Страница {catalog.page} из {redirectPages}</span>
              {catalog.page < redirectPages ? <Link href={seoCatalogHref(catalog, { page: catalog.page + 1 })}>Вперёд</Link> : <span aria-disabled="true">Вперёд</span>}
              {catalog.page < redirectPages ? <Link href={seoCatalogHref(catalog, { page: redirectPages })}>Последняя</Link> : <span aria-disabled="true">Последняя</span>}
            </nav>
          )}
        </section>

        <form className="panel settings-stack" action={createRedirectAction}>
          <h2>Новая переадресация</h2>
          <CatalogContext catalog={catalog} />
          <label className="field"><span>Старый адрес</span><input name="source_path" required maxLength={500} placeholder="/staraya-stranitsa" /></label>
          <label className="field"><span>Новый адрес</span><input name="destination_path" required maxLength={500} placeholder="/stati/razdel/novyy-adres" /></label>
          <label className="field"><span>Код</span><select name="status_code" defaultValue="301">
            <option value="301">301 · постоянный</option>
            <option value="302">302 · временный</option>
            <option value="307">307 · временный, строгий</option>
            <option value="308">308 · постоянный, строгий</option>
          </select></label>
          <label><input name="is_active" type="checkbox" defaultChecked /> Переадресация активна</label>
          <p className="editorial-note">
            Для смены адреса опубликованной статьи редактор создаёт 301 автоматически.
            Эта форма нужна для старых и нестандартных ссылок.
          </p>
          <button className="button" type="submit">Создать переадресацию</button>
        </form>
      </div>
    </>
  );
}
