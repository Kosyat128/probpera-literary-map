import { createServerSupabaseClient } from "@/lib/supabase/server";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { createRedirectAction, deleteRedirectAction } from "./actions";

export const metadata = { title: "SEO и адреса" };

export default async function SeoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: articlesResult }, { data: redirectsResult }] = await Promise.all([
    supabase.from("articles").select("id,title,slug,status,legacy_path,seo_title,seo_description,canonical_url").is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("redirects").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const articles = articlesResult || [];
  const redirects = redirectsResult || [];
  const issues = articles.filter((article) =>
    article.status === "published" &&
    (!article.seo_title || !article.seo_description || !article.canonical_url)
  );

  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Поиск и сохранение ссылок</span><h1>SEO и адреса</h1>
        <p>Понятные URL, канонические адреса, сниппеты, карта сайта, микроразметка и постоянные переадресации со старых страниц.</p></div></header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Переадресация создана и отправлена в сборку.</p>}
      {query.deleted && <p className="form-message form-success">Переадресация удалена.</p>}
      <section className="stats-grid">
        <article className="stat-card"><span>Материалов</span><strong>{articles.length}</strong><small>в базе CMS</small></article>
        <article className="stat-card"><span>Требуют SEO-проверки</span><strong>{issues.length}</strong><small>только опубликованные</small></article>
        <article className="stat-card"><span>301-редиректов</span><strong>{redirects.filter((item) => item.status_code === 301).length}</strong><small>сохраняют поисковый вес</small></article>
        <article className="stat-card"><span>Структурированные данные</span><strong>Article</strong><small>готовы для сборщика</small></article>
      </section>
      <div className="dashboard-grid">
        <section className="panel"><h2>Что проверяется</h2><div className="status-list">
          <div><span>Человекочитаемый адрес по заголовку</span><strong>Автоматически</strong></div>
          <div><span>Canonical и Open Graph</span><strong>В редакторе</strong></div>
          <div><span>Старые адреса Tilda</span><strong>Без удаления</strong></div>
          <div><span>sitemap.xml и robots.txt</span><strong>При сборке</strong></div>
          <div><span>Article / BreadcrumbList JSON-LD</span><strong>При сборке</strong></div>
        </div></section>
        <section className="panel"><h2>Материалы с замечаниями</h2><div className="status-list">
          {issues.slice(0, 12).map((article) => <div key={article.id}><span>{article.title}</span><strong>{!article.seo_description ? "нет описания" : "нет canonical"}</strong></div>)}
          {!issues.length && <p>У опубликованных материалов заполнены основные SEO-поля.</p>}
        </div></section>
      </div>
      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <section className="panel"><h2>Последние переадресации</h2>
          {redirects.length ? <table className="data-table"><thead><tr><th>Старый адрес</th><th>Новый адрес</th><th>Код</th><th></th></tr></thead>
            <tbody>{redirects.map((item) => <tr key={item.id}><td>{item.source_path}</td><td>{item.destination_path}</td><td>{item.status_code}</td><td>
              <form action={deleteRedirectAction}>
                <input name="id" type="hidden" value={item.id} />
                <ConfirmSubmitButton message={`Удалить переадресацию ${item.source_path}?`}>Удалить</ConfirmSubmitButton>
              </form>
            </td></tr>)}</tbody>
          </table> : <div className="empty-state"><p>Редиректы появятся при переносе или изменении адресов.</p></div>}
        </section>
        <form className="panel settings-stack" action={createRedirectAction}>
          <h2>Новая переадресация</h2>
          <label className="field"><span>Старый адрес</span><input name="source_path" required placeholder="/staraya-stranitsa" /></label>
          <label className="field"><span>Новый адрес</span><input name="destination_path" required placeholder="/stati/razdel/novyy-adres" /></label>
          <label className="field"><span>Код</span><select name="status_code" defaultValue="301">
            <option value="301">301 · постоянный</option>
            <option value="302">302 · временный</option>
            <option value="307">307 · временный, строгий</option>
            <option value="308">308 · постоянный, строгий</option>
          </select></label>
          <p className="editorial-note">Для смены адреса опубликованной статьи редактор создаёт 301 автоматически. Эта форма нужна для старых и нестандартных ссылок.</p>
          <button className="button" type="submit">Создать переадресацию</button>
        </form>
      </div>
    </>
  );
}
