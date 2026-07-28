import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "История изменений" };

export default async function HistoryPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: eventsResult }, { count: revisions }] = await Promise.all([
    supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(250),
    supabase.from("article_revisions").select("*", { count: "exact", head: true }),
  ]);
  const events = eventsResult || [];
  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Прозрачность редакции</span><h1>История изменений</h1>
        <p>Кто, когда и что изменил. Перед каждой правкой статьи база автоматически сохраняет предыдущую версию.</p></div></header>
      <section className="stats-grid">
        <article className="stat-card"><span>Версий статей</span><strong>{revisions || 0}</strong><small>можно использовать для восстановления</small></article>
        <article className="stat-card"><span>Событий журнала</span><strong>{events.length}</strong><small>последние 250 операций</small></article>
      </section>
      <section className="panel">
        {events.length ? <table className="data-table"><thead><tr><th>Событие</th><th>Объект</th><th>Дата</th><th>Пользователь</th></tr></thead>
          <tbody>{events.map((event) => <tr key={event.id}><td>{event.action}</td><td>{event.entity_type}{event.entity_id ? ` · ${event.entity_id}` : ""}</td><td>{formatDate(event.created_at, true)}</td><td>{event.actor_id || "Система"}</td></tr>)}</tbody>
        </table> : <div className="empty-state"><p>История начнёт заполняться после первой редакционной операции.</p></div>}
      </section>
    </>
  );
}
