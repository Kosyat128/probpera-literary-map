"use client";

import dynamic from "next/dynamic";

import type { TypographyWorkspaceProps } from "./TypographyWorkspace";

const TypographyWorkspace = dynamic(() => import("./TypographyWorkspace"), {
  ssr: false,
  loading: () => (
    <section
      className="state-card state-card-embedded"
      role="status"
      aria-live="polite"
    >
      <span className="eyebrow">Site Studio · Шрифты</span>
      <h1>Загружаем редактор типографики</h1>
      <p>Подготавливаем шрифты, правила и историю изменений.</p>
    </section>
  ),
});

export default function TypographyWorkspaceLoader(
  props: TypographyWorkspaceProps
) {
  return <TypographyWorkspace {...props} />;
}
