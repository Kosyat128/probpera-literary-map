"use client";

import dynamic from "next/dynamic";

import type { PageEditorProps } from "./PageEditor";

const PageEditor = dynamic(() => import("./PageEditor"), {
  ssr: false,
  loading: () => (
    <section className="panel" role="status" aria-live="polite">
      <h2>Редактор страницы</h2>
      <p>Загружаем текст, изображения и параметры публикации…</p>
    </section>
  ),
});

export default function PageEditorLoader(props: PageEditorProps) {
  return <PageEditor {...props} />;
}
