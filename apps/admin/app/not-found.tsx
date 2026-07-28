import Link from "next/link";

export default function NotFound() {
  return (
    <main className="admin-state-page">
      <div className="state-card">
        <span className="brand-feather" aria-hidden="true">
          ◆
        </span>
        <p className="eyebrow">Ошибка 404</p>
        <h1>Такого раздела нет</h1>
        <p>Вернитесь на главную страницу редакционного кабинета.</p>
        <Link className="primary-button" href="/dashboard">
          На главную
        </Link>
      </div>
    </main>
  );
}
