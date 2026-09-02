import Link from "next/link";
import { notFound } from "next/navigation";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import PageEditorLoader from "@/components/PageEditorLoader";
import { adminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import {
  pageCatalogHref,
  pageCatalogPageNumber,
  pageEditorHref,
  parsePageCatalogQuery,
} from "@/lib/page-catalog-query";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { operatorDataError } from "@/lib/operator-data-error";
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
  const { id } = await params;
  const query = await searchParams;
  const catalog = parsePageCatalogQuery(query);
  const revisionPage = pageCatalogPageNumber(query.revision_page);
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const [
    { data: page },
    { data: revisionsResult, error: revisionsError, count: revisionsCount },
  ] = await Promise.all([
    supabase.from("pages").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("page_revisions")
      .select("id,revision_number,created_at", { count: "exact" })
      .eq("page_id", id)
      .order("revision_number", { ascending: false })
      .order("id", { ascending: false })
      .range((revisionPage - 1) * REVISION_PAGE_SIZE, revisionPage * REVISION_PAGE_SIZE - 1),
  ]);
  if (!page) notFound();
  const revisions = revisionsResult || [];
  const revisionPages = Math.max(1, Math.ceil((revisionsCount || 0) / REVISION_PAGE_SIZE));
  if (!revisionsError && revisionPage > revisionPages) {
    redirect(pageEditorHref(id, catalog, { revisionPage: revisionPages }));
  }

  return (
    <>
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
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && (
        <p className="form-message form-success">Изменения сохранены.</p>
      )}
      {query.published === "started" && <p className="form-message form-success">Публичная сборка со страницей запущена.</p>}
      {query.published === "queued" && <p className="form-message form-success">Изменение страницы сохранено в резервной очереди публикации.</p>}
      {query.published === "queue-error" && <p className="form-message form-error" role="alert">Изменение сохранено, но запрос публикации записать не удалось. Повторите публикацию позже.</p>}
      <PageEditorLoader
        page={page}
        publicSiteUrl={adminEnv.publicSiteUrl}
        savedAfterSubmit={Boolean(query.saved)}
        catalogContext={{
          q: catalog.term,
          status: catalog.status,
          page: catalog.page,
          revisionPage,
        }}
      />
      <div className="dashboard-grid article-maintenance">
        <section className="panel">
          <h2>История версий</h2>
          {revisionsError ? (
            <p className="form-message">{operatorDataError("history", "load")}</p>
          ) : revisions.length ? (
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
                      <form action={restorePageRevisionAction}>
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
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>История появится после первого изменения страницы.</p>
          )}
          {revisionPages > 1 && (
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
          <form action={softDeletePageAction}>
            <input name="id" type="hidden" value={id} />
            <input name="expected_updated_at" type="hidden" value={page.updated_at} />
            <input name="catalog_q" type="hidden" value={catalog.term} />
            <input name="catalog_status" type="hidden" value={catalog.status} />
            <input name="catalog_page" type="hidden" value={catalog.page} />
            <ConfirmSubmitButton message="Переместить страницу в корзину?">
              Переместить в корзину
            </ConfirmSubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
