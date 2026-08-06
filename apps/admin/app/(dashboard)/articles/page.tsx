import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { articleEditPath } from "@/lib/admin-routes";
import { articlePublicPath } from "@/lib/article-route";
import { articleStatusLabels, formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { viewPathVariants } from "@/lib/view-path";
import {
  changeArticleStatusAction,
  duplicateArticleAction,
  importLegacyArticlesAction,
  softDeleteArticleAction,
} from "./actions";

export const metadata = { title: "РЎС‚Р°С‚СЊРё" };

const PAGE_SIZE = 40;

function pageLink(
  values: Record<string, string>,
  page: number
) {
  const params = new URLSearchParams(
    Object.entries(values).filter(([, value]) => Boolean(value))
  );
  params.set("page", String(page));
  return `/articles?${params.toString()}`;
}

function relationValue<T>(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as T | null | undefined;
}

export default async function ArticlesPage({
  searchParams,
  }: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    category?: string;
    from?: string;
    to?: string;
    sort?: string;
    page?: string;
    imported?: string;
    skipped?: string;
    error?: string;
    published?: string;
  }>;
}) {
  const values = await searchParams;
  const q = (values.q || "").trim();
  const status = values.status || "";
  const category = values.category || "";
  const from = values.from || "";
  const to = values.to || "";
  const sort = ["updated", "published", "title"].includes(values.sort || "")
    ? values.sort || "updated"
    : "updated";
  const currentPage = Math.max(1, Number.parseInt(values.page || "1", 10) || 1);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  let request = supabase
    .from("articles")
    .select(
      "id,title,slug,status,author_id,cover_external_url,created_at,updated_at,published_at,legacy_path,categories(id,name,slug)",
      { count: "exact" }
    )
    .is("deleted_at", null);

  if (q) {
    const safeQuery = q.replace(/[,()%]/gu, " ").slice(0, 120);
    request = request.or(
      `title.ilike.%${safeQuery}%,subtitle.ilike.%${safeQuery}%,excerpt.ilike.%${safeQuery}%,content_html.ilike.%${safeQuery}%`
    );
  }
  if (status && status in articleStatusLabels) {
    request = request.eq("status", status);
  }
  if (/^[0-9a-f-]{36}$/iu.test(category)) {
    request = request.eq("category_id", category);
  }
  if (/^\d{4}-\d{2}-\d{2}$/u.test(from)) {
    request = request.gte("created_at", `${from}T00:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/u.test(to)) {
    request = request.lte("created_at", `${to}T23:59:59.999Z`);
  }
  if (sort === "title") {
    request = request.order("title", { ascending: true });
  } else if (sort === "published") {
    request = request.order("published_at", {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    request = request.order("updated_at", { ascending: false });
  }
  request = request.range(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE - 1
  );

  const [
    { data: articlesResult, error, count },
    { data: categoriesResult },
  ] = await Promise.all([
    request,
    supabase
      .from("categories")
      .select("id,name")
      .order("display_order"),
  ]);
  const articles = articlesResult || [];
  const categories = categoriesResult || [];
  const articleViewCounts = new Map<string, number>();
  await Promise.all(
    articles.map(async (article) => {
      const articleCategory = relationValue<{ slug?: string }>(article.categories);
      const currentPath = articlePublicPath(
        article.slug,
        articleCategory?.slug
      );
      const { data: articleViews } = await supabase.rpc(
        "get_content_view_count",
        {
          p_paths: viewPathVariants(currentPath, article.legacy_path),
        }
      );
      articleViewCounts.set(article.id, Number(articleViews || 0));
    })
  );
  const authorIds = [
    ...new Set(articles.map((article) => article.author_id).filter(Boolean)),
  ];
  const { data: profilesResult } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", authorIds)
    : { data: [] };
  const profileNames = new Map(
    (profilesResult || []).map((profile) => [profile.id, profile.display_name])
  );
  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkValues = { q, status, category, from, to, sort };

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Р РµРґР°РєС†РёРѕРЅРЅС‹Р№ Р°СЂС…РёРІ</span>
          <h1>РЎС‚Р°С‚СЊРё</h1>
          <p>
            РџРѕРёСЃРє РїРѕ С‚РµРєСЃС‚Сѓ, С„РёР»СЊС‚СЂС‹, СЂРµР°Р»СЊРЅС‹Рµ РїСЂРѕСЃРјРѕС‚СЂС‹, РїСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ,
            РґСѓР±Р»РёСЂРѕРІР°РЅРёРµ, РїСѓР±Р»РёРєР°С†РёСЏ Рё РёСЃС‚РѕСЂРёСЏ РІРµСЂСЃРёР№.
          </p>
        </div>
        <div className="editor-actions">
          <form action={importLegacyArticlesAction}>
            <ConfirmSubmitButton message="РџРµСЂРµРЅРµСЃС‚Рё РІ СЂРµРґР°РєС‚РѕСЂ С‚РѕР»СЊРєРѕ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‰РёРµ СЃС‚Р°С‚СЊРё РёР· РїСѓР±Р»РёС‡РЅРѕРіРѕ Р°СЂС…РёРІР°? РЈР¶Рµ РѕС‚СЂРµРґР°РєС‚РёСЂРѕРІР°РЅРЅС‹Рµ РјР°С‚РµСЂРёР°Р»С‹ РЅРµ Р±СѓРґСѓС‚ РїРµСЂРµР·Р°РїРёСЃР°РЅС‹.">
              РџРµСЂРµРЅРµСЃС‚Рё СЃС‚Р°СЂС‹Р№ Р°СЂС…РёРІ
            </ConfirmSubmitButton>
          </form>
          <Link className="button" href="/articles/new">пј‹ РќРѕРІР°СЏ СЃС‚Р°С‚СЊСЏ</Link>
        </div>
      </header>

      {values.error && <p className="form-message">{values.error}</p>}
      {values.imported !== undefined && (
        <p className="form-message form-success">
          РђСЂС…РёРІ СЃРёРЅС…СЂРѕРЅРёР·РёСЂРѕРІР°РЅ: РґРѕР±Р°РІР»РµРЅРѕ {Number(values.imported) || 0}, СѓР¶Рµ
          РЅР°С…РѕРґРёР»РѕСЃСЊ РІ СЂРµРґР°РєС‚РѕСЂРµ {Number(values.skipped) || 0}.
        </p>
      )}
      {values.published === "started" && (
        <p className="form-message form-success">
          Публикация запущена. Изменения отправлены на публикацию.
        </p>
      )}
      {values.published === "queue-error" && (
        <p className="form-message form-error">
          Публикация поставлена в очередь вручную.
        </p>
      )}

      <section className="panel">
        <form className="toolbar article-filter-toolbar">
          <input
            className="search-input"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="РџРѕРёСЃРє РїРѕ Р·Р°РіРѕР»РѕРІРєСѓ Рё С‚РµРєСЃС‚СѓвЂ¦"
            aria-label="РџРѕРёСЃРє СЃС‚Р°С‚РµР№"
          />
          <select name="status" defaultValue={status} aria-label="РЎС‚Р°С‚СѓСЃ">
            <option value="">Р’СЃРµ СЃС‚Р°С‚СѓСЃС‹</option>
            {Object.entries(articleStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select name="category" defaultValue={category} aria-label="Р СѓР±СЂРёРєР°">
            <option value="">Р’СЃРµ СЂСѓР±СЂРёРєРё</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={from} aria-label="Р”Р°С‚Р° РѕС‚" />
          <input type="date" name="to" defaultValue={to} aria-label="Р”Р°С‚Р° РґРѕ" />
          <select name="sort" defaultValue={sort} aria-label="РЎРѕСЂС‚РёСЂРѕРІРєР°">
            <option value="updated">РќРµРґР°РІРЅРѕ РёР·РјРµРЅС‘РЅРЅС‹Рµ</option>
            <option value="published">РџРѕ РґР°С‚Рµ РїСѓР±Р»РёРєР°С†РёРё</option>
            <option value="title">РџРѕ Р·Р°РіРѕР»РѕРІРєСѓ</option>
          </select>
          <button className="button-secondary" type="submit">РџСЂРёРјРµРЅРёС‚СЊ</button>
          <Link className="button-secondary" href="/articles">РЎР±СЂРѕСЃРёС‚СЊ</Link>
        </form>

        <div className="table-summary">
          <span>РќР°Р№РґРµРЅРѕ: {total.toLocaleString("ru-RU")}</span>
          <span>РЎС‚СЂР°РЅРёС†Р° {currentPage} РёР· {totalPages}</span>
        </div>
        {error && <p className="form-message">РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРїРёСЃРѕРє: {error.message}</p>}
        {!error && articles.length === 0 ? (
          <div className="empty-state">
            <div>
              <p>РњР°С‚РµСЂРёР°Р»С‹ СЃ С‚Р°РєРёРјРё СѓСЃР»РѕРІРёСЏРјРё РЅРµ РЅР°Р№РґРµРЅС‹.</p>
              <Link className="button-secondary" href="/articles">РЎР±СЂРѕСЃРёС‚СЊ С„РёР»СЊС‚СЂС‹</Link>
            </div>
          </div>
        ) : (
          <table className="data-table article-table">
            <thead>
              <tr>
                <th>РњР°С‚РµСЂРёР°Р»</th>
                <th>Р СѓР±СЂРёРєР° Рё Р°РІС‚РѕСЂ</th>
                <th>РЎС‚Р°С‚СѓСЃ</th>
                <th>Р”Р°С‚С‹</th>
                <th>РџСЂРѕСЃРјРѕС‚СЂС‹</th>
                <th>Р”РµР№СЃС‚РІРёСЏ</th>
              </tr>
            </thead>
            <tbody>
              {articles.map((article) => {
                const articleCategory = relationValue<{
                  name?: string;
                  slug?: string;
                }>(article.categories);
                const views = articleViewCounts.get(article.id) || 0;
                return (
                  <tr key={article.id}>
                    <td>
                      <Link
                        className="article-list-title"
                        href={articleEditPath(article.id)}
                        aria-label={`РћС‚РєСЂС‹С‚СЊ СЃС‚Р°С‚СЊСЋ В«${article.title}В» РІ СЂРµРґР°РєС‚РѕСЂРµ`}
                      >
                        {article.cover_external_url ? (
                          <img src={article.cover_external_url} alt="" />
                        ) : (
                          <span aria-hidden="true">Рџ</span>
                        )}
                        <span className="data-title">
                          <strong>{article.title}</strong>
                          <small>/{article.slug}</small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="data-title">
                        <strong>{articleCategory?.name || "Р‘РµР· СЂСѓР±СЂРёРєРё"}</strong>
                        <small>
                          {profileNames.get(article.author_id) || "Р РµРґР°РєС†РёСЏ В«РџСЂРѕР±С‹ РџРµСЂР°В»"}
                        </small>
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${article.status}`}>
                        {articleStatusLabels[article.status] || article.status}
                      </span>
                    </td>
                    <td>
                      <span className="data-title">
                        <strong>{formatDate(article.updated_at, true)}</strong>
                        <small>
                          {article.published_at
                            ? `РѕРїСѓР±Р»РёРєРѕРІР°РЅР° ${formatDate(article.published_at)}`
                            : `СЃРѕР·РґР°РЅР° ${formatDate(article.created_at)}`}
                        </small>
                      </span>
                    </td>
                    <td>{views.toLocaleString("ru-RU")}</td>
                    <td>
                      <div className="row-actions">
                        <Link className="button article-edit-action" href={articleEditPath(article.id)}>
                          Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ
                        </Link>
                        <Link className="button-secondary" href={`/articles/${article.id}/preview`}>
                          РџСЂРѕСЃРјРѕС‚СЂ
                        </Link>
                        <form action={duplicateArticleAction}>
                          <input type="hidden" name="id" value={article.id} />
                          <button className="button-secondary" type="submit">РЎРѕР·РґР°С‚СЊ РєРѕРїРёСЋ</button>
                        </form>
                        {article.status !== "published" && (
                          <form action={changeArticleStatusAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <input type="hidden" name="status" value="published" />
                            <button className="button" type="submit">
                              Опубликовать
                            </button>
                          </form>
                        )}
                        {article.status === "published" && (
                          <form action={changeArticleStatusAction}>
                            <input type="hidden" name="id" value={article.id} />
                            <input type="hidden" name="status" value="hidden" />
                            <ConfirmSubmitButton message="РЎРЅСЏС‚СЊ СЃС‚Р°С‚СЊСЋ СЃ РїСѓР±Р»РёРєР°С†РёРё? РђРґСЂРµСЃ Рё РёСЃС‚РѕСЂРёСЏ СЃРѕС…СЂР°РЅСЏС‚СЃСЏ.">
                              РЎРЅСЏС‚СЊ
                            </ConfirmSubmitButton>
                          </form>
                        )}
                        <form action={softDeleteArticleAction}>
                          <input type="hidden" name="id" value={article.id} />
                          <ConfirmSubmitButton message="РџРµСЂРµРјРµСЃС‚РёС‚СЊ СЃС‚Р°С‚СЊСЋ РІ РєРѕСЂР·РёРЅСѓ? Р”Р°РЅРЅС‹Рµ РѕСЃС‚Р°РЅСѓС‚СЃСЏ РІРѕСЃСЃС‚Р°РЅРѕРІРёРјС‹РјРё.">
                            Р’ РєРѕСЂР·РёРЅСѓ
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <nav className="pagination" aria-label="РЎС‚СЂР°РЅРёС†С‹ СЃРїРёСЃРєР°">
            {currentPage > 1 && (
              <Link href={pageLink(linkValues, currentPage - 1)}>в†ђ РќР°Р·Р°Рґ</Link>
            )}
            <span>{currentPage} / {totalPages}</span>
            {currentPage < totalPages && (
              <Link href={pageLink(linkValues, currentPage + 1)}>Р’РїРµСЂС‘Рґ в†’</Link>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
