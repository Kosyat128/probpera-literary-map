"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

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

export type ArticleEditorReadBoundaryProps = {
  editorKey: string;
  actorId?: string;
  current: ArticleEditorProps | null;
  fallback?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  retryHref?: string;
};

function editorIdentity(props: ArticleEditorProps) {
  if (props.article.id) return `article:${props.article.id.toLowerCase()}`;
  const draftKey = props.draftKey?.trim();
  if (draftKey?.startsWith("copy-")) return `copy:${draftKey.slice(5).toLowerCase()}`;
  return draftKey ? `draft:${draftKey}` : "new";
}

export default function ArticleEditorLoader(props: ArticleEditorProps | ArticleEditorReadBoundaryProps) {
  const router = useRouter();
  const boundary = "current" in props ? props : null;
  const editorKey = boundary ? boundary.editorKey : editorIdentity(props as ArticleEditorProps);
  const candidate = boundary ? boundary.current : props as ArticleEditorProps;
  const actorId = boundary?.actorId ?? candidate?.actorId;
  const current = candidate && editorIdentity(candidate) === editorKey
    && candidate.actorId === actorId ? candidate : null;
  const lastVerified = useRef<{ editorKey: string; actorId?: string; props: ArticleEditorProps } | null>(null);

  useEffect(() => {
    if (current) lastVerified.current = { editorKey, actorId, props: current };
    else if (lastVerified.current?.editorKey !== editorKey || lastVerified.current?.actorId !== actorId) lastVerified.current = null;
  }, [actorId, current, editorKey]);

  const cached = lastVerified.current?.editorKey === editorKey && lastVerified.current.actorId === actorId
    ? lastVerified.current.props : null;
  const editorProps = current ?? cached;
  const stale = current === null && editorProps !== null;
  const refreshRetry = (event: MouseEvent<HTMLDivElement>) => {
    if (!stale || !boundary?.retryHref || event.button !== 0
      || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
      || !(event.target instanceof Element)) return;
    const anchor = event.target.closest("a");
    if (!anchor || anchor.target && anchor.target !== "_self" || anchor.hasAttribute("download")) return;
    if (anchor.href !== new URL(boundary.retryHref, window.location.href).href) return;
    event.preventDefault();
    router.refresh();
  };

  return <>
    {current && boundary?.before}
    {stale && <div onClickCapture={refreshRetry}>
      {boundary?.fallback}
      <p className="form-message form-error" role="alert">
        Повторная загрузка статьи не подтверждена. Введённый текст оставлен в редакторе.
        Сохранение и публикация недоступны до успешной проверки данных.
      </p>
      <button className="button-secondary" type="button" onClick={() => router.refresh()}>
        Повторить проверку статьи
      </button>
    </div>}
    {editorProps ? <ArticleEditor key={`${editorKey}:${editorProps.actorId ?? "legacy"}`} {...editorProps}
      readUnavailable={stale || Boolean(editorProps.readUnavailable)} /> : boundary?.fallback}
    {current && boundary?.after}
  </>;
}
