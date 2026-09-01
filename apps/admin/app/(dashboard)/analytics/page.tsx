import { adminEnv } from "@/lib/env";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  analyticsPeriods,
  normalizeAnalyticsReport,
  resolveAnalyticsRange,
} from "@/lib/analytics-report";

export const metadata = { title: "Статистика" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const query = await searchParams;
  const range = resolveAnalyticsRange(query.period);

  const metrikaCounterId = /^\d{1,15}$/u.test(adminEnv.metrikaCounterId)
    ? adminEnv.metrikaCounterId
    : "";
  const geographyReportUrl = metrikaCounterId
    ? `https://metrika.yandex.ru/stat/geo?period=month&id=${encodeURIComponent(metrikaCounterId)}`
    : "https://metrika.yandex.ru/list";

  const { data: reportData, error: reportError } = await supabase.rpc(
    "get_admin_analytics_report",
    { p_from: range.from, p_to: range.to }
  );
  const report = normalizeAnalyticsReport(reportData, range.from, range.to);
  const trackingNotice = reportError
    ? "Статистика временно недоступна: примените актуальную production-схему."
    : "";
  const maxDailyViews = Math.max(1, ...report.daily.map((item) => item.views));

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

      <section className="panel analytics-period-controls" aria-label="Период отчёта">
        <form method="get">
          <label className="field">
            <span>Период</span>
            <select name="period" defaultValue={String(range.period)}>
              {analyticsPeriods.map((days) => (
                <option key={days} value={days}>Последние {days} дней</option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">Показать</button>
          {!reportError && (
            <a
              className="button-secondary"
              href={`/analytics/export?period=${range.period}`}
            >
              Скачать CSV
            </a>
          )}
        </form>
      </section>

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
          <span>Просмотры за период</span>
          <strong>{report.views.toLocaleString("ru-RU")}</strong>
          <small>агрегация выполняется в базе данных</small>
        </article>
        <article className="stat-card">
          <span>Читатели</span>
          <strong>{report.visitors.toLocaleString("ru-RU")}</strong>
          <small>анонимные идентификаторы браузеров</small>
        </article>
        <article className="stat-card">
          <span>Просмотренные страницы</span>
          <strong>{report.pages.toLocaleString("ru-RU")}</strong>
          <small>включая разделы главной и статьи</small>
        </article>
        <article className="stat-card">
          <span>Средняя оценка</span>
          <strong>{report.averageRating ? report.averageRating.toFixed(2) : "-"}</strong>
          <small>{report.ratings.toLocaleString("ru-RU")} оценок за период</small>
        </article>
        <article className="stat-card">
          <span>Новые комментарии</span>
          <strong>{report.comments.toLocaleString("ru-RU")}</strong>
          <small>за выбранный период</small>
        </article>
      </section>

      <section className="panel analytics-timeline">
        <header>
          <div>
            <span className="eyebrow">Последние {range.period} дней</span>
            <h2>Динамика чтения</h2>
          </div>
          <small>{report.views.toLocaleString("ru-RU")} просмотров</small>
        </header>
        <div
          className="analytics-bars"
          aria-label="Просмотры по дням"
          style={{
            gridTemplateColumns: `repeat(${Math.max(1, report.daily.length)}, minmax(4px, 1fr))`,
          }}
        >
          {report.daily.map((item) => (
            <div key={item.day} title={`${item.day}: ${item.views}`}>
              <i style={{ height: `${Math.max(4, (item.views / maxDailyViews) * 100)}%` }} />
              <span>{item.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-grid analytics-grid">
        <section className="panel">
          <h2>Самые читаемые страницы</h2>
          <div className="status-list analytics-list">
            {report.topPaths.length ? report.topPaths.slice(0, 12).map((item) => (
              <div key={item.path}><span>{item.path}</span><strong>{item.views}</strong></div>
            )) : <p>Данные появятся после первых зарегистрированных просмотров.</p>}
          </div>
        </section>
        <section className="panel">
          <h2>Источники переходов</h2>
          <div className="status-list analytics-list">
            {report.topSources.length ? report.topSources.slice(0, 8).map((item) => (
              <div key={item.source}><span>{item.source}</span><strong>{item.views}</strong></div>
            )) : <p>Источники ещё не накоплены.</p>}
          </div>
        </section>
      </div>

      <section className="panel analytics-transitions">
        <h2>Частые переходы внутри сайта</h2>
        <div className="status-list analytics-list">
          {report.topTransitions.length ? report.topTransitions.slice(0, 10).map((item) => (
            <div key={`${item.from}\u0000${item.to}`}><span>{item.from} → {item.to}</span><strong>{item.views}</strong></div>
          )) : <p>Маршруты появятся после применения миграции и новых переходов читателей.</p>}
        </div>
      </section>
    </>
  );
}
