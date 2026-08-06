import Link from "next/link";

import { withAdminBasePath } from "@/lib/navigation";

export default function NotFound() {
  return (
    <main className="admin-state-page">
      <div className="state-card">
        <span className="brand-feather" aria-hidden="true">
          ✦
        </span>
        <p className="eyebrow">Ошибка 404</p>
        <h1>Страница не найдена</h1>
        <p>Перейдите в панель административной редакции.</p>
        <Link className="primary-button" href={withAdminBasePath("/dashboard")}>
          На панель
        </Link>
      </div>
    </main>
  );
}

