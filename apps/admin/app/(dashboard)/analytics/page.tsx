import { createServerSupabaseClient } from "@/lib/supabase/server";
import { articlePublicPath } from "@/lib/article-route";
import { normalizeViewPath } from "@/lib/view-path";

export const metadata = { title: "Статистика" };

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [
    { data: viewsResult, count: viewsCount },
    { data: ratingsResult, count: ratingsCount },
    { count: commentsCount },
    { data: articlesResult },
  ] =
    await Promise.all([
      supabase
        .from("content_views")
        .select("path,referrer_host,created_at", { count: "exact" })
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10_000),
      supabase
        .from("ratings")
        .select("subject_type,subject_id,score", { count: "exact" })
        .gte("created_at", since)
        .limit(10_000),
      supabase
        .from("article_comments")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      supabase
        .from("articles")
        .select("slug,legacy_path,categories(slug)")
        .eq("status", "published")
        .is("deleted_at", null),
    ]);
  const views = viewsResult || [];
  const ratings = ratingsResult || [];

  const currentPathByAlias = new Map<string, string>();
  for (const article of articlesResult || []) {
    const category = Array.isArray(article.categories)
      ? article.categories[0]
      : article.categories;
    const currentPath = normalizeViewPath(
      articlePublicPath(article.slug, category?.slug)
    );
    currentPathByAlias.set(currentPath, currentPath);
    if (article.legacy_path) {
      currentPathByAlias.set(normalizeViewPath(article.legacy_path), currentPath);
    }
  }

  const pathCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  for (const view of views) {
    const normalizedPath = normalizeViewPath(view.path);
    const path = currentPathByAlias.get(normalizedPath) || normalizedPath;
    pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
    const source = view.referrer_host || "Прямой переход";
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  const topPaths = [...pathCounts].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const topSources = [...sourceCounts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
    : 0;

  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Собственные данные сайта</span><h1>Статистика</h1>
        <p>Просмотры, источники переходов, рейтинги и комментарии без посреднического виджета. Персональные тексты и адреса пользователей здесь не собираются.</p></div></header>
      <section className="stats-grid">
        <article className="stat-card"><span>Просмотры за 30 дней</span><strong>{(viewsCount || 0).toLocaleString("ru-RU")}</strong><small>точный автоматический счётчик</small></article>
        <article className="stat-card"><span>Уникальных страниц</span><strong>{pathCounts.size.toLocaleString("ru-RU")}</strong><small>с зарегистрированными просмотрами</small></article>
        <article className="stat-card"><span>Средняя оценка</span><strong>{averageRating ? averageRating.toFixed(2) : "—"}</strong><small>{ratingsCount || 0} оценок за 30 дней</small></article>
        <article className="stat-card"><span>Новые комментарии</span><strong>{(commentsCount || 0).toLocaleString("ru-RU")}</strong><small>за 30 дней</small></article>
      </section>
      <div className="dashboard-grid">
        <section className="panel"><h2>Самые читаемые адреса</h2><div className="status-list">
          {topPaths.length ? topPaths.map(([path, count]) => <div key={path}><span>{path}</span><strong>{count}</strong></div>) : <p>Данные появятся после подключения Supabase на опубликованном сайте.</p>}
        </div></section>
        <section className="panel"><h2>Источники переходов</h2><div className="status-list">
          {topSources.length ? topSources.map(([source, count]) => <div key={source}><span>{source}</span><strong>{count}</strong></div>) : <p>Источники ещё не накоплены.</p>}
        </div></section>
      </div>
    </>
  );
}
