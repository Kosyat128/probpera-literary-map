import Link from "next/link";

import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeCount } from "@/lib/format";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";

export const metadata = { title: "Обзор" };

const displayCount = (value: number | null) =>
  value === null ? "Недоступно" : value.toLocaleString("ru-RU");

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const queries = await Promise.allSettled([
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "review")
      .is("deleted_at", null),
    supabase
      .from("articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .is("deleted_at", null),
    supabase
      .from("article_comments")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("content_views")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("media_assets")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase.from("literary_works").select("id", { count: "exact", head: true }),
    supabase.from("book_editions").select("id", { count: "exact", head: true }),
    supabase
      .from("book_editions")
      .select("id", { count: "exact", head: true })
      .not("cover_url", "is", null)
      .in("cover_rights_status", [
        "public-domain",
        "licensed",
        "permission",
        "external-preview",
      ]),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("ratings").select("id", { count: "exact", head: true }),
  ]);
  const results = queries.map((result) =>
    result.status === "fulfilled" ? result.value : null
  );
  const [
    allArticles,
    publishedArticles,
    reviewArticles,
    scheduledArticles,
    comments,
    views,
    media,
    works,
    editions,
    verifiedCovers,
    readers,
    ratings,
  ] = results;
  const hasUnavailableCount = results.some((result) => safeCount(result) === null);
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/dashboard`;

  const metrics = [
    ["Всего статей", safeCount(allArticles), "в редакционной базе"],
    ["Опубликовано", safeCount(publishedArticles), "доступно читателям"],
    ["На проверке", safeCount(reviewArticles), "ждут решения"],
    ["По расписанию", safeCount(scheduledArticles), "опубликуются автоматически"],
    ["Комментарии", safeCount(comments), "за всё время"],
    ["Произведения", safeCount(works), "синхронизировано из countries"],
    ["Точные издания", safeCount(editions), "привязано по ISBN"],
    ["Реальные обложки", safeCount(verifiedCovers), "с источником и проверкой прав"],
    ["Читатели", safeCount(readers), "зарегистрированные профили"],
  ] as const;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Редакционный центр</span>
          <h1>Обзор журнала</h1>
          <p>
            Состояние материалов, быстрые действия и реальные показатели
            экосистемы «Проба Пера».
          </p>
        </div>
        <Link className="button" href="/articles/new">＋ Новая статья</Link>
      </header>

      {hasUnavailableCount && (
        <p className="notice" role="status">
          Некоторые показатели сейчас недоступны.{" "}
          <a href={retryHref}>Повторить загрузку</a>
        </p>
      )}

      <section className="stats-grid" aria-label="Основные показатели">
        {metrics.map(([label, value, note]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{displayCount(value)}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <h2>Быстрые действия</h2>
          <div className="quick-actions">
            <Link href="/articles/new">
              <strong>✎</strong>
              <span>Создать и оформить публикацию</span>
            </Link>
            <Link href="/media">
              <strong>▧</strong>
              <span>Загрузить иллюстрацию с указанием прав</span>
            </Link>
            <Link href="/comments">
              <strong>◌</strong>
              <span>Проверить новые комментарии</span>
            </Link>
            <Link href="/homepage">
              <strong>⌘</strong>
              <span>Изменить блоки главной страницы</span>
            </Link>
          </div>
        </section>

        <aside className="panel">
          <h2>Состояние системы</h2>
          <div className="status-list">
            <div><span>Просмотры</span><strong>{displayCount(safeCount(views))}</strong></div>
            <div><span>Медиафайлы</span><strong>{displayCount(safeCount(media))}</strong></div>
            <div><span>Оценки книг и статей</span><strong>{displayCount(safeCount(ratings))}</strong></div>
            <div><span>Плановая публикация</span><strong>Каждые 30 минут</strong></div>
            <div><span>Защита ролей</span><strong>Включена</strong></div>
            <div><span>История версий</span><strong>Включена</strong></div>
          </div>
        </aside>
      </div>
    </>
  );
}
