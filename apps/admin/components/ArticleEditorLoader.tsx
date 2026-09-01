"use client";

import dynamic from "next/dynamic";

import type { ArticleEditorProps } from "./ArticleEditor";

export type {
  ArticleTranslation,
  CustomTemplate,
} from "./ArticleEditor";

const ArticleEditor = dynamic(() => import("./ArticleEditor"), {
  ssr: false,
  loading: () => (
    <section className="panel" role="status" aria-live="polite">
      <h2>Редактор статьи</h2>
      <p>Загружаем текст, изображения и инструменты публикации…</p>
    </section>
  ),
});

export default function ArticleEditorLoader(props: ArticleEditorProps) {
  return <ArticleEditor {...props} />;
}
