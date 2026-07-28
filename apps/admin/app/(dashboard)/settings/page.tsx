import { getStaffSession } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Настройки" };

export default async function SettingsPage() {
  const session = await getStaffSession();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: staffResult } =
    (await supabase.from("staff_memberships").select("*").order("created_at")) || {};
  const staff = staffResult || [];
  const checks = [
    ["Supabase", Boolean(adminEnv.supabaseUrl && adminEnv.supabasePublishableKey)],
    ["Публичный домен", adminEnv.publicSiteUrl === "https://probpera.ru"],
    ["Автопересборка после публикации", Boolean(adminEnv.deployHookUrl)],
    ["Яндекс.Метрика", Boolean(adminEnv.metrikaCounterId)],
  ] as const;
  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Система и доступ</span><h1>Настройки</h1>
        <p>Подключения, домен, редакционные роли и готовность публикационного контура.</p></div></header>
      <div className="dashboard-grid">
        <section className="panel"><h2>Готовность</h2><div className="status-list">
          {checks.map(([label, ready]) => <div key={label}><span>{label}</span><strong style={{ color: ready ? "var(--good)" : "var(--orange-soft)" }}>{ready ? "Готово" : "Нужно подключить"}</strong></div>)}
        </div></section>
        <section className="panel"><h2>Текущая роль</h2><p>{session.user?.email}</p><strong className="badge">{session.role || "Без роли"}</strong>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>Роль сообщества не даёт доступа в редакцию. Права owner/admin/editor хранятся отдельно и защищены политиками базы.</p>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 18 }}><h2>Редакционная команда</h2>
        <table className="data-table"><thead><tr><th>Пользователь</th><th>Роль</th><th>Добавлен</th></tr></thead>
          <tbody>{staff.map((member) => <tr key={member.user_id}><td>{member.user_id}</td><td><span className="badge">{member.role}</span></td><td>{new Date(member.created_at).toLocaleDateString("ru-RU")}</td></tr>)}</tbody>
        </table>
        {!staff.length && <div className="empty-state"><p>После назначения первого владельца команда появится здесь.</p></div>}
      </section>
    </>
  );
}
