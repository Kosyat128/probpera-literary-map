import Link from "next/link";

import MediaUploader from "@/components/MediaUploader";
import { formatDate } from "@/lib/format";
import {
  MEDIA_CATALOG_PAGE_SIZE,
  mediaCatalogPageHref,
  mediaCatalogSearchFields,
  parseMediaCatalogQuery,
} from "@/lib/media-catalog-query";
import { redirect } from "@/lib/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateMediaMetadataAction } from "./actions";

export const metadata = { title: "Медиатека" };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    q?: string;
    search_field?: string;
    page?: string;
    published?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parseMediaCatalogQuery(query);
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  let assetsRequest = supabase
    .from("media_assets")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (catalog.term) {
    assetsRequest = assetsRequest.ilike(catalog.column, catalog.pattern);
  }
  const {
    data: assetsResult,
    error: assetsError,
    count: assetsCount,
  } = await assetsRequest.range(catalog.from, catalog.to);
  const assets = assetsResult || [];
  const totalAssets = assetsCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalAssets / MEDIA_CATALOG_PAGE_SIZE));

  if (!assetsError && catalog.page > totalPages) {
    redirect(mediaCatalogPageHref(catalog, totalPages));
  }

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Изображения и права</span>
          <h1>Медиатека</h1>
          <p>
            Реальные портреты, книжные обложки и редакционные иллюстрации с
            источником, лицензией, подписью и правильным описанием.
          </p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Метаданные изображения сохранены.</p>}
      {query.published === "started" && <p className="form-message form-success">Публичная сборка с обновлённым изображением запущена.</p>}
      {query.published === "queued" && <p className="form-message form-success">Обновление изображения поставлено в резервную очередь публикации.</p>}
      {query.published === "queue-error" && <p className="form-message form-error" role="alert">Метаданные сохранены, но запрос публикации записать не удалось. Повторите публикацию позже.</p>}

      <div className="dashboard-grid">
        <MediaUploader />
        <aside className="panel">
          <h2>Редакционный стандарт</h2>
          <div className="status-list">
            <div><span>Сгенерированные портреты</span><strong>Не используем</strong></div>
            <div><span>Обложки без источника</span><strong>На проверку</strong></div>
            <div><span>Максимальная сторона</span><strong>2400 px</strong></div>
            <div><span>Публичный формат</span><strong>WebP</strong></div>
            <div><span>Кадрирование</span><strong>Фокус X / Y без потери исходника</strong></div>
            <div><span>Эффекты главной</span><strong>Масштаб, яркость, контраст, цвет, размытие</strong></div>
          </div>
        </aside>
      </div>

      <section className="panel media-catalog" style={{ marginTop: 18 }}>
        <div className="media-catalog-heading">
          <div>
            <h2>Все файлы</h2>
            <p>
              {totalAssets > 0
                ? `${totalAssets} ${totalAssets === 1 ? "файл" : "файлов"}`
                : catalog.term
                  ? "Совпадений не найдено"
                  : "Файлов пока нет"}
            </p>
          </div>
          <form className="media-catalog-search" method="get">
            <label className="field">
              <span>Искать</span>
              <input
                name="q"
                type="search"
                maxLength={120}
                defaultValue={catalog.term}
                placeholder="Название, автор или коллекция"
              />
            </label>
            <label className="field">
              <span>В поле</span>
              <select name="search_field" defaultValue={catalog.field}>
                {Object.entries(mediaCatalogSearchFields).map(([value, option]) => (
                  <option key={value} value={value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="media-catalog-search-actions">
              <button className="button-secondary" type="submit">Найти</button>
              {(catalog.term || catalog.field !== "alt") && (
                <Link className="button-secondary" href="/media">Сбросить</Link>
              )}
            </div>
          </form>
        </div>

        {assetsError ? (
          <p className="form-message">
            Не удалось загрузить медиатеку: {assetsError.message}
          </p>
        ) : assets.length === 0 ? (
          <div className="empty-state">
            <p>
              {catalog.term
                ? "Измените запрос или выберите другое поле поиска."
                : "Медиатека пока пуста."}
            </p>
          </div>
        ) : (
          <div className="media-grid">
            {assets.map((asset) => {
              const { data } = supabase.storage
                .from(asset.bucket)
                .getPublicUrl(asset.object_path);
              return (
                <article className="media-card" key={asset.id}>
                  <img src={data.publicUrl} alt={asset.alt_text} />
                  <div>
                    <strong>{asset.alt_text}</strong>
                    <small>{asset.license_name || "Лицензия не указана"}</small>
                    <small>{formatDate(asset.created_at)}</small>
                    <details className="media-metadata-editor">
                      <summary>Проверить сведения</summary>
                      <form className="settings-stack" action={updateMediaMetadataAction}>
                        <input name="id" type="hidden" value={asset.id} />
                        <input name="expected_updated_at" type="hidden" value={asset.updated_at} />
                        <input name="catalog_q" type="hidden" value={catalog.term} />
                        <input name="catalog_search_field" type="hidden" value={catalog.field} />
                        <input name="catalog_page" type="hidden" value={catalog.page} />
                        <label className="field"><span>Описание *</span><textarea name="alt_text" required defaultValue={asset.alt_text} /></label>
                        <label className="field"><span>Подпись</span><textarea name="caption" defaultValue={asset.caption} /></label>
                        <label className="field"><span>Автор</span><input name="creator" defaultValue={asset.creator} /></label>
                        <label className="field"><span>Источник</span><input name="source_url" type="url" defaultValue={asset.source_url || ""} /></label>
                        <label className="field"><span>Лицензия</span><input name="license_name" defaultValue={asset.license_name} /></label>
                        <label className="field"><span>Ссылка на лицензию</span><input name="license_url" type="url" defaultValue={asset.license_url || ""} /></label>
                        <label className="field"><span>Коллекция</span><input name="collection_name" required defaultValue={asset.collection_name} /></label>
                        <div className="media-focus-fields">
                          <label className="field"><span>Фокус X</span><input name="focus_x" type="number" min="0" max="1" step="0.01" defaultValue={asset.focus_x} /></label>
                          <label className="field"><span>Фокус Y</span><input name="focus_y" type="number" min="0" max="1" step="0.01" defaultValue={asset.focus_y} /></label>
                        </div>
                        <button className="button-secondary" type="submit">Сохранить сведения</button>
                      </form>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!assetsError && totalPages > 1 && (
          <nav className="pagination" aria-label="Страницы медиатеки">
            {catalog.page > 1 ? (
              <Link href={mediaCatalogPageHref(catalog, 1)}>Первая</Link>
            ) : (
              <span aria-disabled="true">Первая</span>
            )}
            {catalog.page > 1 ? (
              <Link href={mediaCatalogPageHref(catalog, catalog.page - 1)}>Назад</Link>
            ) : (
              <span aria-disabled="true">Назад</span>
            )}
            <span aria-current="page">Страница {catalog.page} из {totalPages}</span>
            {catalog.page < totalPages ? (
              <Link href={mediaCatalogPageHref(catalog, catalog.page + 1)}>Вперёд</Link>
            ) : (
              <span aria-disabled="true">Вперёд</span>
            )}
            {catalog.page < totalPages ? (
              <Link href={mediaCatalogPageHref(catalog, totalPages)}>Последняя</Link>
            ) : (
              <span aria-disabled="true">Последняя</span>
            )}
          </nav>
        )}
      </section>
    </>
  );
}
