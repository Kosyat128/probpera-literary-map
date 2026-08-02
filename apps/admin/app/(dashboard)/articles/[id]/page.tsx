import { notFound } from "next/navigation";

import ArticleEditor, { type CustomTemplate } from "@/components/ArticleEditor";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { adminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  duplicateArticleAction,
  restoreArticleRevisionAction,
  softDeleteArticleAction,
} from "../actions";

export const metadata = { title: "Редактирование статьи" };

export default async function EditArticlePage({
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
  const [
    { data: article },
    { data: categoriesResult },
    { data: revisionsResult },
    { data: templatesResult },
    { data: authResult },
  ] = await Promise.all([
    supabase.from("articles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("categories")
      .select("id,name,slug")
      .eq("is_visible", true)
      .order("display_order"),
    supabase
      .from("article_revisions")
      .select("id,revision_number,created_at,change_summary,changed_by")
      .eq("article_id", id)
      .order("revision_number", { ascending: false })
      .limit(12),
    supabase
      .from("editor_templates")
      .select("id,label,content_html,visibility,owner_id")
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase.auth.getUser(),
  ]);
  const categories = categoriesResult || [];
  const revisions = revisionsResult || [];
  const templates: CustomTemplate[] = (templatesResult || []).map((template) => ({
    id: template.id,
    label: template.label,
    html: template.content_html,
    visibility: template.visibility as "personal" | "shared",
    canDelete: template.owner_id === authResult.user?.id,
  }));

  if (!article) notFound();

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Редактирование</span>
          <h1>Редактор статьи</h1>
          <p>Изменения фиксируются в истории версий автоматически.</p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Изменения сохранены.</p>}
      <ArticleEditor
        article={article}
        categories={categories}
        publicSiteUrl={adminEnv.publicSiteUrl}
        templates={templates}
      />
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
                      <span className="data-title">
                        <strong>Версия {revision.revision_number}</strong>
                        <small>{revision.change_summary || "Автоматическая копия перед изменением"}</small>
                      </span>
                    </td>
                    <td>{formatDate(revision.created_at, true)}</td>
                    <td>
                      <form action={restoreArticleRevisionAction}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="revision_id" value={revision.id} />
                        <ConfirmSubmitButton message={`Восстановить версию ${revision.revision_number}? Текущее состояние тоже сохранится в истории.`}>
                          Восстановить
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Предыдущие версии появятся после первого изменения статьи.</p>
          )}
        </section>
        <aside className="panel settings-stack">
          <h2>Дополнительные действия</h2>
          <form action={duplicateArticleAction}>
            <input type="hidden" name="id" value={id} />
            <button className="button-secondary" type="submit">
              Создать копию-черновик
            </button>
          </form>
          <form action={softDeleteArticleAction}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmitButton message="Переместить статью в корзину? Опубликованный материал исчезнет с сайта, но останется восстановимым в базе.">
              Переместить в корзину
            </ConfirmSubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
