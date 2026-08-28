import type { ReactNode } from "react";

type AdminStatusStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  standalone?: boolean;
};

export default function AdminStatusState({
  eyebrow,
  title,
  description,
  action,
  standalone = false,
}: AdminStatusStateProps) {
  const card = (
    <section
      className={`state-card${standalone ? "" : " state-card-embedded"}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
      {action && <div className="state-actions">{action}</div>}
    </section>
  );

  return standalone ? <main className="admin-state-page">{card}</main> : card;
}

export function AdminDependencyState() {
  return (
    <AdminStatusState
      eyebrow="Подключение данных"
      title="Редакционная база временно недоступна"
      description="Не удалось подключиться к данным кабинета. Проверьте конфигурацию Supabase и повторите загрузку страницы."
    />
  );
}
