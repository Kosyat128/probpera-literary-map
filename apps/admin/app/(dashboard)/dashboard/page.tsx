import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safeCount } from "@/lib/format";

export const metadata = { title: "Обзор" };

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [
    allArticles,
    publishedArticles,
    reviewArticles,
    comments,
    views,
    media,
  ] = await Promise.all([
    supabase.from("articles").select("*", { count: "exact", head: true }),
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "published"),
    supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("status", "review"),
    supabase
      .from("article_comments")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("content_views")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("media_assets")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null),
  ]);

  const metrics = [
    ["Всего статей", safeCount(allArticles), "в редакционной базе"],
    ["Опубликовано", safeCount(publishedArticles), "доступно читателям"],
    ["На проверке", safeCount(reviewArticles), "ждут решения"],
    ["Комментарии", safeCount(comments), "за всё время"],
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

      <section className="stats-grid" aria-label="Основные показатели">
        {metrics.map(([label, value, note]) => (
          <article className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value.toLocaleString("ru-RU")}</strong>
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
            <div><span>Просмотры</span><strong>{safeCount(views).toLocaleString("ru-RU")}</strong></div>
            <div><span>Медиафайлы</span><strong>{safeCount(media).toLocaleString("ru-RU")}</strong></div>
            <div><span>Защита ролей</span><strong>Включена</strong></div>
            <div><span>История версий</span><strong>Включена</strong></div>
          </div>
        </aside>
      </div>
    </>
  );
}
