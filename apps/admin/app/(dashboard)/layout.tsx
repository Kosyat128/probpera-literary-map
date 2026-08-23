import type { ReactNode } from "react";

import AdminShell from "@/components/AdminShell";
import { logoutAction } from "@/app/(auth)/login/actions";
import { getStaffSession } from "@/lib/auth";
import { adminEnv } from "@/lib/env";
import { redirect as adminRedirect } from "@/lib/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getStaffSession();

  if (!session.configured) {
    return (
      <main className="setup-screen">
        <section className="setup-card">
          <span className="eyebrow">Первичная настройка</span>
          <h1>Кабинет готов к подключению</h1>
          <p>
            Интерфейс собран, но для входа нужно применить миграцию Supabase,
            заполнить переменные окружения и назначить первую учётную запись
            владельцем. Пошаговая инструкция находится в документации проекта.
          </p>
        </section>
      </main>
    );
  }

  if (!session.user) adminRedirect("/login");
  if (session.mfa.required) adminRedirect("/mfa");

  if (!session.role) {
    return (
      <main className="setup-screen">
        <section className="setup-card">
          <span className="eyebrow">Доступ ограничен</span>
          <h1>Учётная запись подтверждена</h1>
          <p>
            У пользователя {session.user.email} нет редакционной роли.
            Владелец сайта должен добавить его в команду как редактора,
            администратора или владельца.
          </p>
          <form action={logoutAction}>
            <button className="button-secondary" type="submit">
              Выйти и сменить учётную запись
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AdminShell
      publicSiteUrl={adminEnv.publicSiteUrl}
      session={{
        ...session,
        user: session.user,
        role: session.role,
      }}
    >
      {children}
    </AdminShell>
  );
}
