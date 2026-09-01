"use client";

import dynamic from "next/dynamic";

import type { AdminMfaSettingsProps } from "./AdminMfaSettings";

const AdminMfaSettings = dynamic(() => import("./AdminMfaSettings"), {
  ssr: false,
  loading: () => (
    <section className="panel" role="status" aria-live="polite">
      <h2>Двухфакторная защита</h2>
      <p>Загружаем настройки MFA…</p>
    </section>
  ),
});

export default function AdminMfaSettingsLoader(
  props: AdminMfaSettingsProps
) {
  return <AdminMfaSettings {...props} />;
}
