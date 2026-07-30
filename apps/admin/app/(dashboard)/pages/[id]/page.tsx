import { notFound } from "next/navigation";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import PageEditor from "@/components/PageEditor";
import { adminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  restorePageRevisionAction,
  softDeletePageAction,
} from "../actions";

export const metadata = { title: "Редактирование страницы" };

export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const [{ data: page }, { data: revisionsResult }] = await Promise.all([
    supabase.from("pages").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("page_revisions")
      .select("id,revision_number,created_at")
      .eq("page_id", id)
      .order("revision_number", { ascending: false })
      .limit(12),
  ]);
  if (!page) notFound();
  const revisions = revisionsResult || [];

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
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && (
        <p className="form-message form-success">Изменения сохранены.</p>
      )}
      <PageEditor page={page} publicSiteUrl={adminEnv.publicSiteUrl} />
      <div className="dashboard-grid article-maintenance">
        <section className="panel">
          <h2>История версий</h2>
          {revisions.length ? (
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
        </section>
        <aside className="panel settings-stack">
          <h2>Опасная зона</h2>
          <p>
            Удаление мягкое: страница исчезнет с сайта, но останется
            восстановимой в базе.
          </p>
          <form action={softDeletePageAction}>
            <input name="id" type="hidden" value={id} />
            <ConfirmSubmitButton message="Переместить страницу в корзину?">
              Переместить в корзину
            </ConfirmSubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
