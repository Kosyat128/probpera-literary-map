"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

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

export type PageEditorReadBoundaryProps = {
  pageId: string;
  actorId?: string;
  current: PageEditorProps | null;
  fallback?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  retryHref?: string;
};

export default function PageEditorLoader(props: PageEditorProps | PageEditorReadBoundaryProps) {
  const router = useRouter();
  const boundary = "current" in props ? props : null;
  const pageId = boundary ? boundary.pageId : (props as PageEditorProps).page.id;
  const candidate = boundary ? boundary.current : props as PageEditorProps;
  const actorId = boundary?.actorId ?? candidate?.actorId;
  const current = candidate && typeof candidate.page?.id === "string"
    && candidate.page.id.toLowerCase() === pageId.toLowerCase() && candidate.actorId === actorId ? candidate : null;
  const lastVerified = useRef<{ pageId: string; actorId?: string; props: PageEditorProps } | null>(null);

  useEffect(() => {
    if (current) lastVerified.current = { pageId, actorId, props: current };
    else if (lastVerified.current?.pageId.toLowerCase() !== pageId.toLowerCase() || lastVerified.current?.actorId !== actorId) lastVerified.current = null;
  }, [actorId, current, pageId]);

  const cached = lastVerified.current?.pageId.toLowerCase() === pageId.toLowerCase() && lastVerified.current.actorId === actorId
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
        Повторная загрузка страницы не подтверждена. Введённый текст оставлен в редакторе.
        Сохранение и публикация недоступны до успешной проверки данных.
      </p>
      <button className="button-secondary" type="button" onClick={() => router.refresh()}>
        Повторить проверку страницы
      </button>
    </div>}
    {editorProps ? <PageEditor key={`${pageId}:${editorProps.actorId ?? "legacy"}`} {...editorProps}
      readUnavailable={stale || Boolean(editorProps.readUnavailable)} /> : boundary?.fallback}
    {current && boundary?.after}
  </>;
}
