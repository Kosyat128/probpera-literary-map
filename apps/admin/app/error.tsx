"use client";

import { useEffect } from "react";

import AdminStatusState from "@/components/AdminStatusState";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route rendering failed", error);
  }, [error]);

  return (
    <AdminStatusState
      standalone
      eyebrow="Ошибка раздела"
      title="Не удалось открыть этот раздел"
      description="Данные кабинета не потеряны. Повторите загрузку или вернитесь к работе немного позже."
      action={
        <button className="primary-button" type="button" onClick={reset}>
          Повторить загрузку
        </button>
      }
    />
  );
}
