import { notFound, unstable_rethrow } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";

import ArticleEditorLoader, {
  type CustomTemplate,
} from "@/components/ArticleEditorLoader";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import ArticleLoadState from "@/components/ArticleLoadState";
import { AdminDependencyState } from "@/components/AdminStatusState";
import AdminStatusState from "@/components/AdminStatusState";
import { adminEnv } from "@/lib/env";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { isReadRecord, readAdminList, readAdminResult, rethrowAdminReadControlFlow } from "@/lib/admin-read-result";
import {
  sameArticleId,
  validArticleRead,
  validEnglishRead,
  validRevisionRead,
  validSocialRequestRead,
  validSocialResultRead,
  validTemplateRead,
} from "@/lib/article-load-validation";
import { articlePublicPath } from "@/lib/article-route";
import { requireStaffRead } from "@/lib/admin-read-access";
import { formatDate } from "@/lib/format";
import { safePublicSiteHref } from "@/lib/public-link-boundary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  articleWithWorkingDraft,
  englishTranslationWithWorkingDraft,
  parseArticleWorkingDraft,
} from "../article-working-draft";
import {
  duplicateArticleAction,
  discardArticleWorkingDraftAction,
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
    released?: string;
    replaced?: string;
    social?: string;
    translation?: string;
  }>;
}) {
  const staff = await requireStaffRead();
  if (!staff) return <AdminStatusState eyebrow="Доступ ограничен"
    title="Редакционные данные недоступны"
    description="Не удалось подтвердить редакционную роль. Обратитесь к владельцу сайта." />;
  const { id } = await params;
  const query = await searchParams;
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/articles/${encodeURIComponent(id)}`;
  const editorKey = `article:${id.toLowerCase()}`;
  const unavailableEditor = (fallback: ReactNode) => <ArticleEditorLoader
    key={editorKey} editorKey={editorKey} actorId={staff.user?.id} current={null} fallback={fallback} retryHref={retryHref}
  />;
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    unstable_rethrow(error);
    return unavailableEditor(<ArticleLoadState issue="unavailable" retryHref={retryHref} />);
  }
  if (!supabase) return unavailableEditor(<><AdminDependencyState /><div className="state-actions"><a className="button-secondary" href={retryHref}>Повторить загрузку</a></div></>);
  const [
    articleResult,
    englishResult,
    categoriesResult,
    revisionsResult,
    templatesResult,
    workingDraftResult,
  ] = await Promise.allSettled([
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
    supabase
      .from("article_working_drafts")
      .select(
        "article_id,base_article_updated_at,payload,english_payload,expected_english_updated_at,draft_scope,draft_english_enabled,version,updated_at"
      )
      .eq("article_id", id)
      .maybeSingle(),
  ]);

  rethrowAdminReadControlFlow(articleResult, englishResult, categoriesResult,
    revisionsResult, templatesResult, workingDraftResult);
  const articleRead = readAdminResult(articleResult, (data) =>
    data === null || validArticleRead(data, id, "edit"));
  if (articleRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={articleRead.issue} retryHref={retryHref} />);
  }
  const article = articleRead.data;
  if (!article) notFound();

  const englishRead = readAdminResult(englishResult, (data) =>
    data === null || validEnglishRead(data, id, "edit"));
  if (englishRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={englishRead.issue} retryHref={retryHref} />);
  }
  const categoriesRead = readAdminList(categoriesResult, (item) =>
    typeof item.id === "string" && typeof item.name === "string" && typeof item.slug === "string");
  if (categoriesRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={categoriesRead.issue} retryHref={retryHref} />);
  }
  const workingDraftRead = readAdminResult(workingDraftResult, (data) =>
    data === null || isReadRecord(data));
  if (workingDraftRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={workingDraftRead.issue} retryHref={retryHref} />);
  }
  const englishTranslation = englishRead.data;
  const categories = categoriesRead.data;
  const revisionsRead = readAdminList(revisionsResult, validRevisionRead);
  const revisions = revisionsRead.status === "success" ? revisionsRead.data : [];
  const templatesRead = readAdminList(templatesResult, validTemplateRead);
  const templates: CustomTemplate[] = (templatesRead.status === "success" ? templatesRead.data : []).map((template) => ({
    id: template.id,
    label: template.label,
    html: template.content_html,
    visibility: template.visibility as "personal" | "shared",
    canDelete: template.owner_id === staff.user?.id,
  }));

  let workingDraft = null;
  if (workingDraftRead.data) {
    try {
      workingDraft = parseArticleWorkingDraft(workingDraftRead.data);
    } catch (error) {
      unstable_rethrow(error);
      return unavailableEditor(<ArticleLoadState issue="invalid" retryHref={retryHref} />);
    }
    if (!sameArticleId(workingDraft.article_id, id)) {
      return unavailableEditor(<ArticleLoadState issue="invalid" retryHref={retryHref} />);
    }
  }
  const editableArticle = workingDraft
    ? articleWithWorkingDraft(article, workingDraft)
    : { ...article, working_draft_version: 0 };
  const editableEnglishTranslation = workingDraft
    ? englishTranslationWithWorkingDraft(
        englishTranslation || null,
        workingDraft
      )
    : englishTranslation;
  const [socialRequestResult] = await Promise.allSettled([supabase
    .from("admin_audit_log")
    .select("id,created_at,metadata")
    .eq("action", "social_publish.requested")
    .contains("metadata", { article_id: article.id })
    .order("created_at", { ascending: false })
    .limit(1)]);
  const socialRequestsRead = readAdminList(socialRequestResult, (row) => validSocialRequestRead(row, id));
  const socialRequest = socialRequestsRead.status === "success"
    ? socialRequestsRead.data[0] || null
    : null;
  const [socialResultQuery] = await Promise.allSettled([socialRequest
    ? supabase
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
    : Promise.resolve({ data: [], error: null })]);
  const socialResultsRead = readAdminList(socialResultQuery, validSocialResultRead);
  const socialUnavailable = socialRequestsRead.status === "failed" || socialResultsRead.status === "failed";
  const socialResults = socialResultsRead.status === "success" ? socialResultsRead.data : [];
  const channelState = new Map<
    string,
    { action: string; state: string }
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
    });
  });
  const socialChannels = [
    { id: "dzen", label: "Дзен" },
  ].map((channel) => {
    const result = channelState.get(channel.id);
    if (socialUnavailable) return { ...channel, tone: "error", status: "Недоступно" };
    if (!socialRequest) return { ...channel, tone: "idle", status: "Не отправлялось" };
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
        status: "Ошибка доставки",
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
  const publicArticleUrl = safePublicSiteHref(
    adminEnv.publicSiteUrl,
    articlePublicPath(article.slug, categorySlug)
  );

  return (
    <ArticleEditorLoader
      key={editorKey}
      editorKey={editorKey}
      retryHref={retryHref}
      current={{
        article: editableArticle,
        englishTranslation: editableEnglishTranslation || undefined,
        canonicalEnglishTranslation: englishTranslation || null,
        categories,
        publicSiteUrl: adminEnv.publicSiteUrl,
        templates,
        saveConfirmed: Boolean(query.saved),
        actorId: staff.user?.id,
        canPublish: staff.role === "owner" || staff.role === "admin",
        canOverridePublicationChecklist: staff.role === "owner",
      }}
      before={<>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Админка</span>
          <h1>Редактирование статьи</h1>
          <p>Изменяйте текст, структуру и медиа прямо в редакторе.</p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {workingDraft && (
        <section className="form-message form-success" aria-label="Рабочий черновик">
          <p role="status">
            {workingDraft.draft_scope === "english-only"
              ? "Русская версия открыта в сохранённом состоянии. Английский текст сохранён в отдельном рабочем черновике и не выпущен."
              : "Открыт сохранённый рабочий черновик. Опубликованная версия остаётся без изменений до выпуска."}
          </p>
          <form action={discardArticleWorkingDraftAction}>
            <input type="hidden" name="id" value={id} />
            <input
              type="hidden"
              name="working_draft_version"
              value={workingDraft.version}
            />
            <ConfirmSubmitButton message={workingDraft.draft_scope === "english-only"
              ? "Удалить английский рабочий черновик? Русская версия останется без изменений."
              : "Удалить рабочий черновик и вернуться к опубликованной версии?"}>
              {workingDraft.draft_scope === "english-only" ? "Удалить английский черновик" : "Отменить правки"}
            </ConfirmSubmitButton>
          </form>
        </section>
      )}
      {query.saved && !query.publish && (
        <p className="form-message form-success">Изменения сохранены.</p>
      )}
      {query.publish === "started" && (
        <p className="form-message form-success publication-result">
          Изменения сохранены. Обновление публичного сайта запущено.
          {query.released === "published" && (
            <>{" "}<a href={publicArticleUrl} target="_blank" rel="noreferrer">
              Публичный адрес статьи →
            </a></>
          )}
        </p>
      )}
      {query.publish === "queued" && (
        <p className="form-message form-success publication-result">
          Изменения сохранены и поставлены в очередь. Обновление обычно занимает
          5-10 минут.
          {query.released === "published" && (
            <>{" "}<a href={publicArticleUrl} target="_blank" rel="noreferrer">
              Публичный адрес статьи →
            </a></>
          )}
        </p>
      )}
      {query.publish === "queue-error" && (
        <p className="form-message" role="alert">
          Статья сохранена, но не удалось отправить в очередь публикации. Проверьте
          консоль и повторите позже.
        </p>
      )}
      {query.translation === "deferred" && (
        <p className="form-message form-success" role="status">
          Русская версия опубликована. Английский перевод отложен и не блокирует
          выпуск; его можно подготовить или повторить позже.
        </p>
      )}
      {Number(query.replaced || 0) > 0 && (
        <p className="form-message form-success">
          На главную в выбранной секции была заменена старая статья.
        </p>
      )}
      {query.social === "requested" && (
        <p className="form-message form-success">
          Проверка публикации в RSS Дзена поставлена в очередь.
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
              После публикации сайт проверяет материал и выбранную ведущую
              иллюстрацию в RSS Дзена, фиксирует результат и повторяет временно
              неудавшиеся попытки.
            </p>
          </div>
          {article.status === "published" && !socialUnavailable && (
            <form action={requestSocialPublicationAction}>
              <input type="hidden" name="id" value={article.id} />
              <ConfirmSubmitButton message="Повторить только незавершённую проверку RSS Дзена? Если прежняя проверка уже завершена, будет создано новое задание.">
                Повторить проверку Дзена
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
          <div className="social-channel is-idle">
            <span aria-hidden="true" />
            <strong>ВКонтакте</strong>
            <small>Автопубликация отключена</small>
          </div>
        </div>
        <small className="social-publication-note">
          Для Дзена формируется RSS-канал журнала. Обложкой становится первая
          пригодная иллюстрация в тексте; отдельная обложка статьи используется
          только как резерв. Автопубликация во ВКонтакте отключена редакционной
          политикой и не блокирует выпуск.
        </small>
      </section>
      {templatesRead.status === "failed" && (
        <p className="notice" role="status">
          Шаблоны временно недоступны. <a href={retryHref}>Повторить загрузку</a>
        </p>
      )}
      </>}
      after={<>
      <div className="dashboard-grid article-maintenance">
        <section className="panel">
          <h2>История версии</h2>
          {revisionsRead.status === "failed" ? (
            <p role="status">
              История версий временно недоступна. <a href={retryHref}>Повторить загрузку</a>
            </p>
          ) : revisions.length ? (
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
      </>}
    />
  );
}
