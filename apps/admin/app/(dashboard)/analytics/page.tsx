import { articlePublicPath } from "@/lib/article-route";
import { adminEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeViewPath } from "@/lib/view-path";

export const metadata = { title: "Статистика" };

type ViewRow = {
  path: string;
  session_id?: string | null;
  referrer_host: string | null;
  previous_path?: string | null;
  navigation_source?: string | null;
  utm_source?: string | null;
  created_at: string;
};

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) || 0) + 1);
}

function topEntries(map: Map<string, number>, limit: number) {
  return [...map].sort((first, second) => second[1] - first[1]).slice(0, limit);
}

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const metrikaCounterId = /^\d{1,15}$/u.test(adminEnv.metrikaCounterId)
    ? adminEnv.metrikaCounterId
    : "";
  const geographyReportUrl = metrikaCounterId
    ? `https://metrika.yandex.ru/stat/geo?period=month&id=${encodeURIComponent(metrikaCounterId)}`
    : "https://metrika.yandex.ru/list";

  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const since = sinceDate.toISOString();
  const extendedViewsResult = await supabase
    .from("content_views")
    .select(
      "path,session_id,referrer_host,previous_path,navigation_source,utm_source,created_at",
      { count: "exact" }
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50_000);

  let views = (extendedViewsResult.data || []) as ViewRow[];
  let viewsCount = extendedViewsResult.count || 0;
  let trackingNotice = "";
  if (extendedViewsResult.error) {
    const legacyViewsResult = await supabase
      .from("content_views")
      .select("path,session_id,referrer_host,created_at", { count: "exact" })
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50_000);
    views = (legacyViewsResult.data || []) as ViewRow[];
    viewsCount = legacyViewsResult.count || 0;
    trackingNotice = legacyViewsResult.error
      ? `Счётчик недоступен: ${legacyViewsResult.error.message}`
      : "Базовый счётчик работает. Расширенная аналитика переходов включится после применения последней миграции Supabase.";
  }

  const [
    { data: ratingsResult, count: ratingsCount },
    { count: commentsCount },
    { data: articlesResult },
  ] = await Promise.all([
    supabase
      .from("ratings")
      .select("subject_type,subject_id,score", { count: "exact" })
      .gte("created_at", since)
      .limit(50_000),
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

  const canonicalPath = (path: string) => {
    const normalized = normalizeViewPath(path);
    return currentPathByAlias.get(normalized) || normalized;
  };
  const pathCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();
  const transitionCounts = new Map<string, number>();
  const visitorIds = new Set<string>();
  const dayCounts = new Map<string, number>();

  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - offset);
    dayCounts.set(day.toISOString().slice(0, 10), 0);
  }

  for (const view of views) {
    const path = canonicalPath(view.path);
    increment(pathCounts, path);
    if (view.session_id) visitorIds.add(view.session_id);
    const day = view.created_at.slice(0, 10);
    if (dayCounts.has(day)) increment(dayCounts, day);

    if (view.utm_source) increment(sourceCounts, `Кампания: ${view.utm_source}`);
    else if (view.navigation_source === "internal" || view.previous_path) {
      increment(sourceCounts, "Внутренние переходы");
    } else if (view.referrer_host) increment(sourceCounts, view.referrer_host);
    else increment(sourceCounts, "Прямой переход");

    if (view.previous_path) {
      const previousPath = canonicalPath(view.previous_path);
      if (previousPath !== path) increment(transitionCounts, `${previousPath} → ${path}`);
    }
  }

  const topPaths = topEntries(pathCounts, 12);
  const topSources = topEntries(sourceCounts, 8);
  const topTransitions = topEntries(transitionCounts, 10);
  const dailyViews = [...dayCounts];
  const maxDailyViews = Math.max(1, ...dailyViews.map(([, count]) => count));
  const averageRating = ratings.length
    ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
    : 0;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Собственные данные сайта</span>
          <h1>Статистика</h1>
          <p>
            Просмотры, маршруты читателей, источники переходов, рейтинги и
            комментарии. Тексты, поисковые запросы и полные адреса посетителей
            не сохраняются.
          </p>
        </div>
      </header>

      {trackingNotice && <p className="form-message">{trackingNotice}</p>}

      <section className="panel analytics-geography">
        <div>
          <span className="eyebrow">Яндекс Метрика · точные данные</span>
          <h2>Россия, регионы и другие страны</h2>
          <p>
            Отчёт показывает посетителей, визиты, просмотры и отказы по
            странам, областям/регионам и городам. Язык браузера и часовой пояс
            не используются как выдуманная география.
          </p>
          {!metrikaCounterId && (
            <small>
              ID счётчика не передан этой сборке админки: откроется список
              доступных счётчиков.
            </small>
          )}
        </div>
        <div className="analytics-geography-actions">
          <a
            className="button"
            href={geographyReportUrl}
            target="_blank"
            rel="noreferrer"
          >
            Открыть отчёт «География»
          </a>
          <a
            className="button-secondary"
            href="https://yandex.ru/support/metrica/ru/visitors/geography"
            target="_blank"
            rel="noreferrer"
          >
            Как читать отчёт
          </a>
        </div>
      </section>

      <section className="stats-grid analytics-stats">
        <article className="stat-card">
          <span>Просмотры за 30 дней</span>
          <strong>{viewsCount.toLocaleString("ru-RU")}</strong>
          <small>один просмотр страницы за 30 минут</small>
        </article>
        <article className="stat-card">
          <span>Читатели</span>
          <strong>{visitorIds.size.toLocaleString("ru-RU")}</strong>
          <small>анонимные идентификаторы браузеров</small>
        </article>
        <article className="stat-card">
          <span>Просмотренные страницы</span>
          <strong>{pathCounts.size.toLocaleString("ru-RU")}</strong>
          <small>включая разделы главной и статьи</small>
        </article>
        <article className="stat-card">
          <span>Средняя оценка</span>
          <strong>{averageRating ? averageRating.toFixed(2) : "-"}</strong>
          <small>{ratingsCount || 0} оценок за 30 дней</small>
        </article>
        <article className="stat-card">
          <span>Новые комментарии</span>
          <strong>{(commentsCount || 0).toLocaleString("ru-RU")}</strong>
          <small>за 30 дней</small>
        </article>
      </section>

      <section className="panel analytics-timeline">
        <header>
          <div>
            <span className="eyebrow">Последние 30 дней</span>
            <h2>Динамика чтения</h2>
          </div>
          <small>{viewsCount.toLocaleString("ru-RU")} просмотров</small>
        </header>
        <div className="analytics-bars" aria-label="Просмотры по дням">
          {dailyViews.map(([day, count]) => (
            <div key={day} title={`${day}: ${count}`}>
              <i style={{ height: `${Math.max(4, (count / maxDailyViews) * 100)}%` }} />
              <span>{day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-grid analytics-grid">
        <section className="panel">
          <h2>Самые читаемые страницы</h2>
          <div className="status-list analytics-list">
            {topPaths.length ? topPaths.map(([path, count]) => (
              <div key={path}><span>{path}</span><strong>{count}</strong></div>
            )) : <p>Данные появятся после первых зарегистрированных просмотров.</p>}
          </div>
        </section>
        <section className="panel">
          <h2>Источники переходов</h2>
          <div className="status-list analytics-list">
            {topSources.length ? topSources.map(([source, count]) => (
              <div key={source}><span>{source}</span><strong>{count}</strong></div>
            )) : <p>Источники ещё не накоплены.</p>}
          </div>
        </section>
      </div>

      <section className="panel analytics-transitions">
        <h2>Частые переходы внутри сайта</h2>
        <div className="status-list analytics-list">
          {topTransitions.length ? topTransitions.map(([transition, count]) => (
            <div key={transition}><span>{transition}</span><strong>{count}</strong></div>
          )) : <p>Маршруты появятся после применения миграции и новых переходов читателей.</p>}
        </div>
      </section>
    </>
  );
}
