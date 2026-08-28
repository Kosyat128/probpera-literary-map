import AdminMfaSettings from "@/components/AdminMfaSettings";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { adminMfaStatusLabel } from "@/lib/admin-mfa-policy";
import { getStaffSession } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  removeStaffMemberAction,
  saveStaffMemberAction,
} from "./actions";

export const metadata = { title: "Настройки" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const session = await getStaffSession();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const { data: staffResult } =
    (await supabase.from("staff_memberships").select("*").order("created_at")) || {};
  const staff = staffResult || [];
  const checks = [
    ["Supabase", Boolean(adminEnv.supabaseUrl && adminEnv.supabasePublishableKey)],
    ["Публичный домен", adminEnv.publicSiteUrl === "https://probpera.ru"],
    [
      "Мгновенный запуск публикации",
      Boolean(adminEnv.deployHookUrl || adminEnv.githubDeployToken),
    ],
    ["Резервная очередь публикации", Boolean(adminEnv.supabaseUrl)],
    ["Яндекс.Метрика", Boolean(adminEnv.metrikaCounterId)],
  ] as const;
  const mfaStatus = session.mfa.checkError
    ? "Проверка недоступна"
    : adminMfaStatusLabel({
        currentLevel: session.mfa.currentLevel,
        nextLevel: session.mfa.nextLevel,
      });

  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Система и доступ</span><h1>Настройки</h1>
        <p>Подключения, домен, редакционные роли и готовность публикационного контура.</p></div></header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Доступ редакции обновлён.</p>}
      {query.deleted && <p className="form-message form-success">Доступ редакции отозван.</p>}
      <div className="dashboard-grid">
        <section className="panel"><h2>Готовность</h2><div className="status-list">
          {checks.map(([label, ready]) => <div key={label}><span>{label}</span><strong style={{ color: ready ? "var(--good)" : "var(--orange-soft)" }}>{ready ? "Готово" : "Нужно подключить"}</strong></div>)}
          <div><span>MFA редакции</span><strong>{mfaStatus}</strong></div>
        </div></section>
        <section className="panel"><h2>Текущая роль</h2><p>{session.user?.email}</p><strong className="badge">{session.role || "Без роли"}</strong>
          <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>Роль сообщества не даёт доступа в редакцию. Права owner/admin/editor хранятся отдельно и защищены политиками базы.</p>
        </section>
      </div>
      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <AdminMfaSettings
          initialCurrentLevel={session.mfa.currentLevel}
          initialNextLevel={session.mfa.nextLevel}
          initialCheckError={session.mfa.checkError}
        />
        <section className="panel"><h2>Редакционная команда</h2>
          <table className="data-table"><thead><tr><th>Пользователь</th><th>Роль</th><th>Добавлен</th><th></th></tr></thead>
            <tbody>{staff.map((member) => <tr key={member.user_id}><td>{member.user_id}</td><td><span className="badge">{member.role}</span></td><td>{new Date(member.created_at).toLocaleDateString("ru-RU")}</td><td>
              {session.role === "owner" && member.user_id !== session.user?.id && (
                <form action={removeStaffMemberAction}>
                  <input name="user_id" type="hidden" value={member.user_id} />
                  <ConfirmSubmitButton message="Отозвать доступ к редакционной панели?">Отозвать</ConfirmSubmitButton>
                </form>
              )}
            </td></tr>)}</tbody>
          </table>
          {!staff.length && <div className="empty-state"><p>После назначения первого владельца команда появится здесь.</p></div>}
        </section>
      </div>
      {session.role === "owner" && (
        <form className="panel settings-stack" action={saveStaffMemberAction} style={{ marginTop: 18 }}>
          <h2>Добавить или изменить участника</h2>
          <p className="editorial-note">Человек сначала регистрируется на сайте. Затем владелец указывает здесь тот же email и назначает редакционную роль.</p>
          <label className="field"><span>Email учётной записи</span><input name="email" type="email" required /></label>
          <label className="field"><span>Роль</span><select name="role" defaultValue="editor">
            <option value="editor">Редактор · материалы и контент</option>
            <option value="admin">Администратор · контент и система</option>
            <option value="owner">Владелец · полный доступ</option>
          </select></label>
          <button className="button" type="submit">Сохранить доступ</button>
        </form>
      )}
    </>
  );
}
