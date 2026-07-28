import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "SEO и адреса" };

export default async function SeoPage() {
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
      <section className="panel" style={{ marginTop: 18 }}><h2>Последние переадресации</h2>
        {redirects.length ? <table className="data-table"><thead><tr><th>Старый адрес</th><th>Новый адрес</th><th>Код</th></tr></thead>
          <tbody>{redirects.map((item) => <tr key={item.id}><td>{item.source_path}</td><td>{item.destination_path}</td><td>{item.status_code}</td></tr>)}</tbody>
        </table> : <div className="empty-state"><p>Редиректы появятся при переносе или изменении адресов.</p></div>}
      </section>
    </>
  );
}
