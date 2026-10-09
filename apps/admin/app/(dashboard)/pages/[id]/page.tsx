import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import PageEditorLoader from "@/components/PageEditorLoader";
import AdminStatusState from "@/components/AdminStatusState";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { adminReadMessage, readAdminList, readAdminResult, rethrowAdminReadControlFlow } from "@/lib/admin-read-result";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { canEditPageBundle, canRestorePageRevision, validPageEditorRead, validPageRevisionRead,
  type PageEditorRead, type PageRevisionRead } from "@/lib/page-load-validation";
import { adminEnv } from "@/lib/env";
import { requireStaffRead } from "@/lib/admin-read-access";
import { formatDate, safeCount } from "@/lib/format";
import {
  pageCatalogHref,
  pageCatalogPageNumber,
  pageEditorHref,
  parsePageCatalogQuery,
} from "@/lib/page-catalog-query";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  restorePageRevisionAction,
  softDeletePageAction,
} from "../actions";

export const metadata = { title: "Редактирование страницы" };
const REVISION_PAGE_SIZE = 20;

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    published?: string;
    q?: string;
    status?: string;
    page?: string;
    revision_page?: string;
  }>;
}) {
  const staff = await requireStaffRead();
  if (!staff) return <AdminStatusState eyebrow="Доступ ограничен"
    title="Редакционные данные недоступны"
    description="Не удалось подтвердить редакционную роль. Обратитесь к владельцу сайта." />;
  const { id } = await params;
  const query = await searchParams;
  const catalog = parsePageCatalogQuery(query);
  const revisionPage = pageCatalogPageNumber(query.revision_page);
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}${pageEditorHref(id, catalog, { revisionPage })}`;
  const unavailableEditor = (fallback: ReactNode) => <PageEditorLoader key={id}
    pageId={id} actorId={staff.user?.id} current={null} fallback={fallback} retryHref={retryHref} />;
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try { supabase = await createServerSupabaseClient(); }
  catch (error) {
    unstable_rethrow(error);
    return unavailableEditor(<AdminStatusState eyebrow="Редактор страницы"
      title="Не удалось загрузить страницу" description={adminReadMessage("unavailable")}
      action={<a href={retryHref}>Повторить загрузку</a>} />);
  }
  if (!supabase) return unavailableEditor(<AdminDependencyState />);
  const [pageResponse, revisionsResponse] = await Promise.allSettled([
    supabase.from("pages").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("page_revisions")
      .select("id,page_id,revision_number,created_at", { count: "exact" })
      .eq("page_id", id)
      .order("revision_number", { ascending: false })
      .order("id", { ascending: false })
      .range((revisionPage - 1) * REVISION_PAGE_SIZE, revisionPage * REVISION_PAGE_SIZE - 1),
  ]);
  rethrowAdminReadControlFlow(pageResponse, revisionsResponse);
  const pageRead = readAdminResult<PageEditorRead | null>(pageResponse,
    value => value === null || validPageEditorRead(value, id));
  if (pageRead.status === "failed") return unavailableEditor(<AdminStatusState eyebrow="Редактор страницы"
    title="Не удалось загрузить страницу" description={adminReadMessage(pageRead.issue)}
    action={<a href={retryHref}>Повторить загрузку</a>} />);
  if (pageRead.data === null) notFound();
  const page = pageRead.data;
  const canEdit = canEditPageBundle(page);
  const revisionsRead = readAdminList<PageRevisionRead>(revisionsResponse, value => validPageRevisionRead(value, id));
  const revisions = revisionsRead.status === "success" ? revisionsRead.data : [];
  const revisionsCount = safeCount(revisionsResponse.status === "fulfilled" ? revisionsResponse.value : null);
  const revisionPages = revisionsCount === null ? null : Math.max(1, Math.ceil(revisionsCount / REVISION_PAGE_SIZE));
  const canRestore = canEdit && revisionsRead.status === "success" && revisionsCount !== null;
  if (revisionsRead.status === "success" && revisionPages !== null && revisionPage > revisionPages) {
    redirect(pageEditorHref(id, catalog, { revisionPage: revisionPages }));
  }

  return (
    <PageEditorLoader
      key={id}
      pageId={id}
      actorId={staff.user?.id}
      current={canEdit ? {
        page,
        actorId: staff.user?.id,
        publicSiteUrl: adminEnv.publicSiteUrl,
        savedAfterSubmit: false,
        catalogContext: { q: catalog.term, status: catalog.status, page: catalog.page, revisionPage },
      } : null}
      retryHref={retryHref}
      fallback={<p className="form-message form-error" role="alert">
        Формат документа или версия записи не позволяют безопасно открыть редактор. Содержание сохранено без замены.
        {" "}<a href={retryHref}>Повторить загрузку</a>
      </p>}
      before={<>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Постоянный материал</span>
          <h1>Редактор страницы</h1>
          <p>
            Публичный адрес: /stranitsy/{page.slug}/. Все изменения сохраняются
            в истории.
          </p>
        </div>
        <Link className="button-secondary" href={pageCatalogHref(catalog)}>← К списку страниц</Link>
      </header>
      {(query.error || query.saved || query.published === "started" || query.published === "queued" || query.published === "queue-error") && (
        <p className="form-message">Результат изменения и публикации не подтверждён параметрами ссылки. Проверьте текущие данные и очередь публикаций.</p>
      )}
      </>}
      after={<div className="dashboard-grid article-maintenance">
        <section className="panel">
          <h2>История версий</h2>
          <p>Всего версий: {revisionsCount === null ? "Недоступно" : revisionsCount.toLocaleString("ru-RU")}</p>
          {(revisionsRead.status === "failed" || revisionsCount === null) && <p className="form-message form-error" role="alert">
            {adminReadMessage(revisionsRead.status === "failed" ? revisionsRead.issue : "invalid")}{" "}
            <a href={retryHref}>Повторить загрузку</a>
          </p>}
          {revisionsRead.status === "failed" ? null : revisions.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Версия</th>
                  <th>Сохранена</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.id}>
                    <td>
                      <strong>Версия {revision.revision_number}</strong>
                    </td>
                    <td>{formatDate(revision.created_at, true)}</td>
                    <td>
                      {canRestore && canRestorePageRevision(revision) ? <form action={restorePageRevisionAction}>
                        <input name="id" type="hidden" value={id} />
                        <input name="expected_updated_at" type="hidden" value={page.updated_at} />
                        <input name="catalog_q" type="hidden" value={catalog.term} />
                        <input name="catalog_status" type="hidden" value={catalog.status} />
                        <input name="catalog_page" type="hidden" value={catalog.page} />
                        <input name="editor_revision_page" type="hidden" value={revisionPage} />
                        <input
                          name="revision_id"
                          type="hidden"
                          value={revision.id}
                        />
                        <ConfirmSubmitButton
                          message={`Восстановить версию ${revision.revision_number}? Текущее состояние останется в истории.`}
                        >
                          Восстановить
                        </ConfirmSubmitButton>
                      </form> : <span>Восстановление недоступно до проверки данных и версии.</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>{revisionsCount === null ? "На текущей странице версий нет. Общее количество версий неизвестно."
              : revisionsCount === 0 ? "История появится после первого изменения страницы."
                : "На текущей странице версий нет."}</p>
          )}
          {revisionsRead.status === "success" && revisionPages !== null && revisionPages > 1 && (
            <nav className="pagination catalog-pagination" aria-label="Страницы истории версии">
              {revisionPage > 1 ? (
                <Link href={pageEditorHref(id, catalog, { revisionPage: revisionPage - 1 })}>Назад</Link>
              ) : <span aria-disabled="true">Назад</span>}
              <span aria-current="page">Страница {revisionPage} из {revisionPages}</span>
              {revisionPage < revisionPages ? (
                <Link href={pageEditorHref(id, catalog, { revisionPage: revisionPage + 1 })}>Вперёд</Link>
              ) : <span aria-disabled="true">Вперёд</span>}
            </nav>
          )}
        </section>
        <aside className="panel settings-stack">
          <h2>Опасная зона</h2>
          <p>
            Удаление мягкое: страница исчезнет с сайта, но останется
            восстановимой в базе.
          </p>
          {canEdit && <form action={softDeletePageAction}>
            <input name="id" type="hidden" value={id} />
            <input name="expected_updated_at" type="hidden" value={page.updated_at} />
            <input name="catalog_q" type="hidden" value={catalog.term} />
            <input name="catalog_status" type="hidden" value={catalog.status} />
            <input name="catalog_page" type="hidden" value={catalog.page} />
            <ConfirmSubmitButton message="Переместить страницу в корзину?">
              Переместить в корзину
            </ConfirmSubmitButton>
          </form>}
        </aside>
      </div>}
    />
  );
}
