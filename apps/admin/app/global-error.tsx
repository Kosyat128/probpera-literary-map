"use client";

import { useEffect } from "react";

import AdminStatusState from "@/components/AdminStatusState";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin application rendering failed", error);
  }, [error]);

  return (
    <html lang="ru">
      <body>
        <AdminStatusState
          standalone
          eyebrow="Системная ошибка"
          title="Кабинет временно недоступен"
          description="Интерфейс не смог завершить загрузку. Повторите попытку - сохранённые материалы останутся в редакционной базе."
          action={
            <button className="primary-button" type="button" onClick={reset}>
              Повторить загрузку
            </button>
          }
        />
      </body>
    </html>
  );
}
