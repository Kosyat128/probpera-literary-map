import { notFound } from "next/navigation";
import Link from "next/link";

import ArticleEditor, { type CustomTemplate } from "@/components/ArticleEditor";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { adminEnv } from "@/lib/env";
import { articlePublicPath } from "@/lib/article-route";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  duplicateArticleAction,
  requestSocialPublicationAction,
  restoreArticleRevisionAction,
  softDeleteArticleAction,
} from "../actions";

export const metadata = { title: "Редактирование статьи" };

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    saved?: string;
    publish?: string;
    replaced?: string;
    social?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const [
    { data: article },
    { data: englishTranslation },
    { data: categoriesResult },
    { data: revisionsResult },
    { data: templatesResult },
    { data: authResult },
  ] = await Promise.all([
    supabase.from("articles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("article_translations")
      .select("*")
      .eq("article_id", id)
      .eq("locale", "en")
      .maybeSingle(),
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
  const { data: socialRequests } = await supabase
    .from("admin_audit_log")
    .select("id,created_at,metadata")
    .eq("action", "social_publish.requested")
    .contains("metadata", { article_id: id })
    .order("created_at", { ascending: false })
    .limit(1);
  const socialRequest = socialRequests?.[0] || null;
  const { data: socialResultRows } = socialRequest
    ? await supabase
        .from("admin_audit_log")
        .select("action,created_at,metadata")
        .eq("entity_type", "social_publication")
        .eq("entity_id", String(socialRequest.id))
        .in("action", [
          "social_publish.succeeded",
          "social_publish.pending",
          "social_publish.failed",
          "social_publish.completed",
        ])
        .order("created_at", { ascending: true })
    : { data: [] };
  const socialResults = socialResultRows || [];
  const channelState = new Map<
    string,
    { action: string; state: string; error: string }
  >();
  socialResults.forEach((result) => {
    const metadata =
      result.metadata && typeof result.metadata === "object"
        ? (result.metadata as Record<string, unknown>)
        : {};
    const platform = typeof metadata.platform === "string" ? metadata.platform : "";
    if (!platform) return;
    channelState.set(platform, {
      action: result.action,
      state: typeof metadata.state === "string" ? metadata.state : "",
      error:
        typeof metadata.error === "string"
          ? metadata.error.slice(0, 180)
          : "",
    });
  });
  const socialChannels = [
    { id: "vk", label: "ВКонтакте" },
    { id: "ok", label: "Одноклассники", optional: true },
    { id: "dzen", label: "Дзен" },
  ].map((channel) => {
    const result = channelState.get(channel.id);
    if (!socialRequest) return { ...channel, tone: "idle", status: "Не отправлялось" };
    if (!result && channel.optional) {
      return { ...channel, tone: "idle", status: "Подключается позже" };
    }
    if (!result) return { ...channel, tone: "waiting", status: "Ожидает отправки" };
    if (result.action === "social_publish.succeeded") {
      return {
        ...channel,
        tone: "success",
        status: result.state === "rss-ready" ? "RSS готов" : "Опубликовано",
      };
    }
    if (result.action === "social_publish.failed") {
      return {
        ...channel,
        tone: "error",
        status: result.error ? `Ошибка: ${result.error}` : "Ошибка доставки",
      };
    }
    return {
      ...channel,
      tone: result.state === "not-configured" ? "error" : "waiting",
      status:
        result.state === "not-configured" ? "Нужны доступы" : "Повторная попытка",
    };
  });
  const categorySlug = categories.find(
    (category) => category.id === article.category_id
  )?.slug;
  const publicArticleUrl = `${adminEnv.publicSiteUrl}${articlePublicPath(
    article.slug,
    categorySlug
  )}`;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Админка</span>
          <h1>Редактирование статьи</h1>
          <p>Изменяйте текст, структуру и медиа прямо в редакторе.</p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && !query.publish && (
        <p className="form-message form-success">Изменения сохранены.</p>
      )}
      {query.publish === "started" && (
        <p className="form-message form-success publication-result">
          Статья опубликована. Проверка доставки в очередь выполнена.{" "}
          <a href={publicArticleUrl} target="_blank" rel="noreferrer">
            Публичный адрес статьи →
          </a>
        </p>
      )}
      {query.publish === "queued" && (
        <p className="form-message form-success publication-result">
          Статья поставлена в очередь публикации. Обновление обычно занимает 5–10 минут.{" "}
          <a href={publicArticleUrl} target="_blank" rel="noreferrer">
            Публичный адрес статьи →
          </a>
        </p>
      )}
      {query.publish === "queue-error" && (
        <p className="form-message" role="alert">
          Статья сохранена, но не удалось отправить в очередь публикации. Проверьте
          консоль и повторите позже.
        </p>
      )}
      {Number(query.replaced || 0) > 0 && (
        <p className="form-message form-success">
          На главную в выбранной секции была заменена старая статья.
        </p>
      )}
      {query.social === "requested" && (
        <p className="form-message form-success">
          Отправка во «ВКонтакте» и RSS Дзена поставлена в очередь.
        </p>
      )}
      {query.social === "retrying" && (
        <p className="form-message form-success">
          Незавершённая отправка возобновлена без создания дубликата.
        </p>
      )}

      <section className="panel social-publication-card" aria-labelledby="social-publication-title">
        <header>
          <div>
            <span className="eyebrow">Распространение</span>
            <h2 id="social-publication-title">Автопостинг публикации</h2>
            <p>
              После публикации сайт сам передаёт материал в подключённые каналы,
              фиксирует результат и повторяет временно неудавшиеся попытки.
            </p>
          </div>
          {article.status === "published" && (
            <form action={requestSocialPublicationAction}>
              <input type="hidden" name="id" value={article.id} />
              <ConfirmSubmitButton message="Повторить только незавершённую отправку? Если прежняя доставка уже полностью завершена, будет создана новая публикация.">
                Повторить отправку
              </ConfirmSubmitButton>
            </form>
          )}
        </header>
        <div className="social-channel-list">
          {socialChannels.map((channel) => (
            <div className={`social-channel is-${channel.tone}`} key={channel.id}>
              <span aria-hidden="true" />
              <strong>{channel.label}</strong>
              <small>{channel.status}</small>
            </div>
          ))}
        </div>
        <small className="social-publication-note">
          Для Дзена формируется RSS-канал журнала. VK получает текст и ссылку от
          имени сообщества; обложка прикрепляется при наличии пользовательского
          токена администратора. «Одноклассники» будут подключены отдельным этапом.
        </small>
      </section>
      <ArticleEditor
        article={article}
        englishTranslation={englishTranslation || undefined}
        categories={categories}
        publicSiteUrl={adminEnv.publicSiteUrl}
        templates={templates}
        saveConfirmed={Boolean(query.saved)}
      />

      <div className="dashboard-grid article-maintenance">
        <section className="panel">
          <h2>История версии</h2>
          {revisions.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Версия</th>
                  <th>Событие</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision) => (
                  <tr key={revision.id}>
                    <td>
                      <span className="data-title">
                        <strong>Версия {revision.revision_number}</strong>
                        <small>{revision.change_summary || "Нет заметки к сохранению"}</small>
                      </span>
                    </td>
                    <td>{revision.changed_by || "Система"}</td>
                    <td>{formatDate(revision.created_at, true)}</td>
                    <td>
                      <form action={restoreArticleRevisionAction}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="expected_updated_at" value={article.updated_at} />
                        <input type="hidden" name="revision_id" value={revision.id} />
                        <ConfirmSubmitButton
                          message={`Восстановить версию ${revision.revision_number}? Это заменит текущий текст.`}
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
            <p>Нет сохранённых версий для этой статьи.</p>
          )}
        </section>
        <aside className="panel settings-stack">
          <h2>Дополнительные действия</h2>
          <form action={duplicateArticleAction}>
            <input type="hidden" name="id" value={id} />
            <button className="button" type="submit">
              Создать копию и редактировать
            </button>
          </form>
          <Link className="button-secondary" href={`/articles/new?copyFrom=${id}`}>
            Открыть без создания копии
          </Link>
          <form action={softDeleteArticleAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="expected_updated_at" value={article.updated_at} />
            <ConfirmSubmitButton message="Перенести статью в архив? После этого её не будет в общем списке статей, но в личном архиве она останется.">
              Архивировать
            </ConfirmSubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
