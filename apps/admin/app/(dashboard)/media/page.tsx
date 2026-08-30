import Link from "next/link";

import MediaFocalEditor from "@/components/MediaFocalEditor";
import MediaUploader from "@/components/MediaUploader";
import { articleEditPath } from "@/lib/admin-routes";
import { getStaffSession } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  MEDIA_PURGE_CONFIRMATION,
  MAX_ORPHAN_CLEANUP_ASSETS,
  ORPHAN_CLEANUP_CONFIRMATION,
} from "@/lib/media-bulk-operations";
import {
  MEDIA_CATALOG_PAGE_SIZE,
  mediaCatalogPageHref,
  mediaCatalogSearchFields,
  mediaCatalogStates,
  mediaCatalogViews,
  parseMediaCatalogQuery,
} from "@/lib/media-catalog-query";
import { redirect } from "@/lib/navigation";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  applyOrphanCleanupAction,
  bulkUpdateMediaMetadataAction,
  permanentlyPurgeMediaAction,
  restoreMediaAction,
  replaceMediaCurrentUsagesAction,
  trashMediaAction,
  updateMediaMetadataAction,
} from "./actions";

export const metadata = { title: "Медиатека" };

type MediaUsage = {
  media_id: string;
  entity_type: string;
  entity_id: string;
  field_name: string;
  is_revision?: boolean;
};

type MediaStudioAsset = {
  id: string;
  bucket: string;
  object_path: string;
  original_name: string;
  mime_type: string;
  byte_size: number | string | null;
  width: number | null;
  height: number | null;
  alt_text: string;
  caption: string;
  creator: string;
  source_url: string | null;
  license_name: string;
  license_url: string | null;
  focus_x: number;
  focus_y: number;
  collection_name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  rights_status: string;
  sha256_hex: string | null;
  replacement_of_media_id: string | null;
  replaced_by_media_id: string | null;
  usage_count: number | string | null;
  duplicate_count: number | string | null;
  total_count: number | string | null;
};

type ReplacementUsageRef = {
  entity_type: "article" | "page" | "homepage" | "banner";
  entity_id: string;
  field_name: string;
};

type ReplacementPreview = {
  old_media_id: string;
  new_media_id: string;
  old_updated_at: string;
  new_updated_at: string;
  new_original_name: string;
  new_alt_text: string;
  new_sha256_hex: string;
  current_usage_refs: ReplacementUsageRef[];
  history_usage_count: number | string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function normalizedUuid(value: unknown) {
  const candidate = String(value || "").trim();
  return uuidPattern.test(candidate) ? candidate : "";
}

const mediaRightsLabels = {
  verified: "Права проверены",
  editorial: "Редакционное использование",
  "public-domain": "Общественное достояние",
  licensed: "По лицензии",
  unknown: "Происхождение не подтверждено",
} as const;

const mediaEntityLabels: Record<string, string> = {
  article: "Статья",
  page: "Страница",
  banner: "Баннер",
  homepage: "Главная страница",
  category: "Категория",
  article_revision: "Версия статьи",
  article_translation_revision: "Версия перевода",
  page_revision: "Версия страницы",
  homepage_revision: "Версия главной",
  chrome_revision: "Версия оформления",
  editor_autosave: "Резервная копия редактора",
};

const mediaFieldLabels: Record<string, string> = {
  cover_media_id: "Обложка",
  og_media_id: "Изображение для публикации в соцсетях",
  "content:ru": "Текст на русском",
  "content:en": "Текст на английском",
  content: "Текст материала",
  settings: "Настройки блока",
  background_media_id: "Фон",
  desktop_media_id: "Версия для компьютера",
  tablet_media_id: "Версия для планшета",
  mobile_media_id: "Версия для телефона",
};

function mediaUsageFieldLabel(value: string) {
  if (mediaFieldLabels[value]) return mediaFieldLabels[value];
  const revision = value.match(/revision:(\d+)$/u);
  if (revision) return `История, версия ${revision[1]}`;
  if (value.includes(":revision:")) {
    return `История, версия ${value.split(":revision:").at(-1)}`;
  }
  return value;
}

function formatFileSize(value: number | string | null | undefined) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Размер не определён";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`;
}

function replacementPreviewMessage(error: { code?: string; message?: string }) {
  if (error.code === "P0002") return "Исходный или новый файл не найден.";
  if (error.code === "23514") return "Новый файл не прошёл проверку SHA-256.";
  if (error.code === "23505") return "Для файла уже зарегистрирована другая цепочка замены.";
  if (error.code === "55000") return "Для замены можно выбрать только активные файлы.";
  if (error.code === "42501") return "Предпросмотр доступен только владельцу или администратору.";
  return error.message || "Не удалось подготовить предпросмотр.";
}

function replacementResultCount(value: unknown) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function mediaUsageHref(usage: MediaUsage) {
  if (usage.entity_type === "article") return articleEditPath(usage.entity_id);
  if (usage.entity_type === "page") return `/pages/${encodeURIComponent(usage.entity_id)}`;
  if (usage.entity_type === "banner") return "/banners";
  if (usage.entity_type === "homepage") return "/homepage";
  if (usage.entity_type === "category") return "/categories";
  if (usage.is_revision || usage.entity_type.endsWith("_revision")) {
    return "/history";
  }
  return "";
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    q?: string;
    search_field?: string;
    state?: string;
    view?: string;
    page?: string;
    published?: string;
    replacement_for?: string;
    replacement_with?: string;
    replacement_count?: string;
    bulk_count?: string;
    skipped_count?: string;
    orphan_count?: string;
    orphan_cleanup?: string;
  }>;
}) {
  const query = await searchParams;
  const catalog = parseMediaCatalogQuery(query);
  const staff = await getStaffSession();
  const canManageLifecycle = staff.role === "owner" || staff.role === "admin";
  const canPermanentlyPurge = staff.role === "owner";
  const renderedAt = Date.now();
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;

  const {
    data: assetsResult,
    error: assetsError,
  } = await supabase.rpc("list_media_studio_assets", {
    p_state: catalog.state,
    p_search_column: catalog.column,
    p_search_pattern: catalog.pattern || null,
    p_offset: catalog.from,
    p_limit: MEDIA_CATALOG_PAGE_SIZE,
  });
  const assets = (assetsResult || []) as MediaStudioAsset[];
  const { data: usagesResult, error: usagesError } = assets.length
    ? await supabase.rpc("list_media_asset_usages", {
        p_media_ids: assets.map((asset) => asset.id),
      })
    : { data: [], error: null };
  const usagesByMedia = new Map<string, MediaUsage[]>();
  const addUsage = (usage: MediaUsage) => {
    const current = usagesByMedia.get(usage.media_id) || [];
    if (current.some((item) =>
      item.entity_type === usage.entity_type &&
      item.entity_id === usage.entity_id &&
      item.field_name === usage.field_name
    )) return;
    current.push(usage);
    usagesByMedia.set(usage.media_id, current);
  };
  for (const usage of usagesResult || []) addUsage(usage);
  const totalAssets = Number(assets[0]?.total_count || 0);
  const totalPages = Math.max(1, Math.ceil(totalAssets / MEDIA_CATALOG_PAGE_SIZE));
  const showOrphanPreview = canManageLifecycle && query.orphan_cleanup === "preview";
  let orphanCandidates: MediaStudioAsset[] = [];
  let orphanTotal = 0;
  let orphanPreviewError = "";
  if (showOrphanPreview) {
    const { data, error } = await supabase.rpc("list_media_studio_assets", {
      p_state: "unused",
      p_search_column: "alt_text",
      p_search_pattern: null,
      p_offset: 0,
      p_limit: MAX_ORPHAN_CLEANUP_ASSETS,
    });
    if (error) {
      orphanPreviewError = error.message;
    } else {
      const candidateRows = (data || []) as MediaStudioAsset[];
      orphanTotal = Number(candidateRows[0]?.total_count || 0);
      const { data: orphanUsages, error: orphanUsagesError } = candidateRows.length
        ? await supabase.rpc("list_media_asset_usages", {
            p_media_ids: candidateRows.map((asset) => asset.id),
          })
        : { data: [], error: null };
      if (orphanUsagesError) {
        orphanPreviewError = orphanUsagesError.message;
      } else {
        const referencedIds = new Set(
          ((orphanUsages || []) as MediaUsage[]).map((usage) => String(usage.media_id))
        );
        orphanCandidates = candidateRows.filter((asset) =>
          !asset.deleted_at
          && Number(asset.usage_count || 0) === 0
          && !referencedIds.has(asset.id)
        );
      }
    }
  }
  const replacementFor = normalizedUuid(query.replacement_for);
  const replacementWith = normalizedUuid(query.replacement_with);
  let replacementPreview: ReplacementPreview | null = null;
  let replacementPreviewError = "";
  if (canManageLifecycle && query.replacement_for && !replacementFor) {
    replacementPreviewError = "Не удалось определить исходный файл для замены.";
  } else if (canManageLifecycle && query.replacement_with && !replacementWith) {
    replacementPreviewError = "Введите корректный UUID нового файла из медиатеки.";
  } else if (canManageLifecycle && replacementFor && replacementWith) {
    const { data, error } = await supabase.rpc("preview_media_asset_replacement", {
      p_old_media_id: replacementFor,
      p_new_media_id: replacementWith,
    });
    if (error) {
      replacementPreviewError = replacementPreviewMessage(error);
    } else {
      const candidate = data?.[0];
      if (candidate) {
        replacementPreview = {
          ...candidate,
          current_usage_refs: Array.isArray(candidate.current_usage_refs)
            ? candidate.current_usage_refs
            : [],
        } as ReplacementPreview;
      }
    }
  }

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
      {query.error && <p className="form-message form-error" role="alert">{query.error}</p>}
      {query.saved === "1" && <p className="form-message form-success">Метаданные изображения сохранены.</p>}
      {query.saved === "trash" && <p className="form-message form-success">Файл перемещён в корзину без удаления исходного объекта.</p>}
      {query.saved === "restore" && <p className="form-message form-success">Файл восстановлен из корзины.</p>}
      {query.saved === "replacement" && (
        <p className="form-message form-success">
          Безопасная замена завершена: обновлено {replacementResultCount(query.replacement_count)} текущих связей. Старый файл и история версий сохранены.
        </p>
      )}
      {query.saved === "bulk" && (
        <p className="form-message form-success">
          Массовые метаданные сохранены для {replacementResultCount(query.bulk_count)} файлов.
        </p>
      )}
      {query.saved === "orphan-cleanup" && (
        <p className="form-message form-success">
          В корзину перемещено {replacementResultCount(query.orphan_count)} неиспользуемых файлов. Объекты Storage не удалены.
        </p>
      )}
      {query.saved === "purge" && (
        <p className="form-message form-success">
          Файл и его точный Storage-объект удалены безвозвратно после полной проверки зависимостей.
        </p>
      )}
      {query.published === "started" && <p className="form-message form-success">Публичная сборка с обновлённым изображением запущена.</p>}
      {query.published === "queued" && <p className="form-message form-success">Обновление изображения поставлено в резервную очередь публикации.</p>}
      {query.published === "queue-error" && <p className="form-message form-error" role="alert">Метаданные сохранены, но запрос публикации записать не удалось. Повторите публикацию позже.</p>}
      {usagesError && <p className="form-message form-error" role="alert">Не удалось загрузить места использования изображений: {usagesError.message}</p>}

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
              <span>Состояние</span>
              <select name="state" defaultValue={catalog.state}>
                {Object.entries(mediaCatalogStates).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
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
            <label className="field">
              <span>Вид</span>
              <select name="view" defaultValue={catalog.view}>
                {Object.entries(mediaCatalogViews).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="media-catalog-search-actions">
              <button className="button-secondary" type="submit">Найти</button>
              {(catalog.term || catalog.field !== "alt") && (
                <Link
                  className="button-secondary"
                  href={catalog.state === "active" ? "/media" : `/media?state=${catalog.state}`}
                >
                  Сбросить поиск
                </Link>
              )}
            </div>
          </form>
        </div>

        {assets.length > 0 && (
          <details className="media-bulk-editor">
            <summary>Массово изменить метаданные выбранных файлов</summary>
            <form
              action={bulkUpdateMediaMetadataAction}
              className="settings-stack"
              id="media-bulk-metadata"
            >
              <input name="catalog_q" type="hidden" value={catalog.term} />
              <input name="catalog_search_field" type="hidden" value={catalog.field} />
              <input name="catalog_state" type="hidden" value={catalog.state} />
              <input name="catalog_view" type="hidden" value={catalog.view} />
              <input name="catalog_page" type="hidden" value={catalog.page} />
              <p>
                Сначала отметьте карточки ниже. Изменятся только поля с включённым флажком;
                версии файлов повторно проверяются перед записью.
              </p>
              <div className="media-bulk-fields">
                <label className="field media-bulk-field">
                  <span><input name="apply_caption" type="checkbox" value="1" /> Подпись</span>
                  <textarea name="caption" maxLength={1000} />
                </label>
                <label className="field media-bulk-field">
                  <span><input name="apply_creator" type="checkbox" value="1" /> Автор / правообладатель</span>
                  <input name="creator" maxLength={240} />
                </label>
                <label className="field media-bulk-field">
                  <span><input name="apply_source_url" type="checkbox" value="1" /> Страница источника</span>
                  <input name="source_url" type="url" placeholder="https://…" />
                </label>
                <label className="field media-bulk-field">
                  <span><input name="apply_license_name" type="checkbox" value="1" /> Лицензия</span>
                  <input name="license_name" maxLength={180} />
                </label>
                <label className="field media-bulk-field">
                  <span><input name="apply_license_url" type="checkbox" value="1" /> Ссылка на лицензию</span>
                  <input name="license_url" type="url" placeholder="https://…" />
                </label>
                <label className="field media-bulk-field">
                  <span><input name="apply_collection_name" type="checkbox" value="1" /> Коллекция</span>
                  <input name="collection_name" minLength={2} maxLength={180} />
                </label>
                <label className="field media-bulk-field">
                  <span><input name="apply_rights_status" type="checkbox" value="1" /> Статус прав</span>
                  <select name="rights_status" defaultValue="unknown">
                    {Object.entries(mediaRightsLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="button" type="submit">Применить к выбранным файлам</button>
            </form>
          </details>
        )}

        {canManageLifecycle && (
          <details className="media-orphan-cleanup" open={showOrphanPreview}>
            <summary>Очистка неиспользуемых файлов</summary>
            {!showOrphanPreview ? (
              <div className="settings-stack">
                <p>
                  Сначала будет показан точный список кандидатов. Очистка только перемещает
                  подтверждённые сироты в корзину и никогда не удаляет Storage-объекты.
                </p>
                <Link
                  className="button-secondary"
                  href={mediaCatalogPageHref(catalog, catalog.page, { orphanPreview: true })}
                >
                  Подготовить предпросмотр
                </Link>
              </div>
            ) : orphanPreviewError ? (
              <div className="settings-stack">
                <p className="form-message form-error" role="alert">{orphanPreviewError}</p>
                <Link className="button-secondary" href={mediaCatalogPageHref(catalog, catalog.page)}>
                  Закрыть предпросмотр
                </Link>
              </div>
            ) : orphanCandidates.length === 0 ? (
              <div className="settings-stack">
                <p>Безопасных неиспользуемых файлов сейчас нет.</p>
                <Link className="button-secondary" href={mediaCatalogPageHref(catalog, catalog.page)}>
                  Закрыть предпросмотр
                </Link>
              </div>
            ) : (
              <form className="settings-stack" action={applyOrphanCleanupAction}>
                <input name="catalog_q" type="hidden" value={catalog.term} />
                <input name="catalog_search_field" type="hidden" value={catalog.field} />
                <input name="catalog_state" type="hidden" value={catalog.state} />
                <input name="catalog_view" type="hidden" value={catalog.view} />
                <input name="catalog_page" type="hidden" value={catalog.page} />
                <input name="orphan_preview_total" type="hidden" value={orphanTotal} />
                {orphanCandidates.map((asset) => (
                  <input
                    key={`snapshot:${asset.id}`}
                    name="orphan_preview_snapshot"
                    type="hidden"
                    value={JSON.stringify({ id: asset.id, updatedAt: asset.updated_at })}
                  />
                ))}
                <p>
                  После проверки текущих и исторических связей в этом пакете найдено
                  {` ${orphanCandidates.length}`} безопасных сирот.
                  {orphanTotal > MAX_ORPHAN_CLEANUP_ASSETS
                    ? ` Всего без текущих связей: ${orphanTotal}; за раз проверяются первые ${MAX_ORPHAN_CLEANUP_ASSETS}.`
                    : ""}
                </p>
                <fieldset className="media-orphan-list">
                  <legend>Проверьте и оставьте отмеченными файлы для корзины</legend>
                  {orphanCandidates.map((asset) => (
                    <label key={asset.id}>
                      <input
                        name="orphan_selection"
                        type="checkbox"
                        defaultChecked
                        value={JSON.stringify({ id: asset.id, updatedAt: asset.updated_at })}
                      />
                      <span>
                        <strong>{asset.alt_text}</strong>
                        <small>{asset.original_name} · {asset.id}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                <label className="media-orphan-confirmation">
                  <input
                    name="confirm_orphan_cleanup"
                    type="checkbox"
                    required
                    value={ORPHAN_CLEANUP_CONFIRMATION}
                  />
                  <span>
                    Подтверждаю повторную серверную проверку и перемещение выбранных файлов
                    в обратимую корзину без физического удаления.
                  </span>
                </label>
                <div className="media-replacement-actions">
                  <button className="button" type="submit">Переместить подтверждённые сироты</button>
                  <Link className="button-secondary" href={mediaCatalogPageHref(catalog, catalog.page)}>
                    Отменить
                  </Link>
                </div>
              </form>
            )}
          </details>
        )}

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
          <div className={`media-grid${catalog.view === "list" ? " is-list" : ""}`}>
            {assets.map((asset) => {
              const { data } = supabase.storage
                .from(asset.bucket)
                .getPublicUrl(asset.object_path);
              const usages = usagesByMedia.get(asset.id) || [];
              const usageCount = Math.max(
                Number(asset.usage_count || 0),
                usages.length
              );
              const rightsStatus = asset.rights_status as keyof typeof mediaRightsLabels;
              const purgeAvailableAt = asset.deleted_at
                ? new Date(new Date(asset.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1_000)
                : null;
              const retentionElapsed = Boolean(
                purgeAvailableAt
                && Number.isFinite(purgeAvailableAt.getTime())
                && purgeAvailableAt.getTime() <= renderedAt
              );
              return (
                <article className="media-card" key={asset.id}>
                  <img src={data.publicUrl} alt={asset.alt_text} />
                  <div>
                    <label className="media-card-selection">
                      <input
                        form="media-bulk-metadata"
                        name="media_selection"
                        type="checkbox"
                        value={JSON.stringify({ id: asset.id, updatedAt: asset.updated_at })}
                      />
                      <span>Выбрать для массовой правки</span>
                    </label>
                    <strong>{asset.alt_text}</strong>
                    <small>{mediaRightsLabels[rightsStatus] || mediaRightsLabels.unknown}</small>
                    <small>
                      {asset.width && asset.height
                        ? `${asset.width} × ${asset.height} пикс.`
                        : "Размеры не определены"}
                      {` · ${formatFileSize(asset.byte_size)}`}
                    </small>
                    <small>{asset.mime_type} · {asset.original_name}</small>
                    <small>ID: {asset.id}</small>
                    {asset.sha256_hex && (
                      <small title={asset.sha256_hex}>
                        SHA-256: {asset.sha256_hex.slice(0, 12)}…
                        {Number(asset.duplicate_count || 0) > 1
                          ? ` · совпадений: ${asset.duplicate_count}`
                          : ""}
                      </small>
                    )}
                    {asset.replacement_of_media_id && (
                      <small>Новая версия файла {asset.replacement_of_media_id}</small>
                    )}
                    {asset.replaced_by_media_id && (
                      <small>Заменён файлом {asset.replaced_by_media_id}</small>
                    )}
                    {asset.deleted_at && <small>В корзине с {formatDate(asset.deleted_at)}</small>}
                    <small>{asset.license_name || "Лицензия не указана"}</small>
                    <small>{formatDate(asset.created_at)}</small>
                    <details className="media-metadata-editor">
                      <summary>Проверить сведения</summary>
                      <form className="settings-stack" action={updateMediaMetadataAction}>
                        <input name="id" type="hidden" value={asset.id} />
                        <input name="expected_updated_at" type="hidden" value={asset.updated_at} />
                        <input name="catalog_q" type="hidden" value={catalog.term} />
                        <input name="catalog_search_field" type="hidden" value={catalog.field} />
                        <input name="catalog_state" type="hidden" value={catalog.state} />
                        <input name="catalog_view" type="hidden" value={catalog.view} />
                        <input name="catalog_page" type="hidden" value={catalog.page} />
                        <label className="field"><span>Описание *</span><textarea name="alt_text" required defaultValue={asset.alt_text} /></label>
                        <label className="field"><span>Подпись</span><textarea name="caption" defaultValue={asset.caption} /></label>
                        <label className="field"><span>Автор</span><input name="creator" defaultValue={asset.creator} /></label>
                        <label className="field"><span>Источник</span><input name="source_url" type="url" defaultValue={asset.source_url || ""} /></label>
                        <label className="field"><span>Лицензия</span><input name="license_name" defaultValue={asset.license_name} /></label>
                        <label className="field"><span>Ссылка на лицензию</span><input name="license_url" type="url" defaultValue={asset.license_url || ""} /></label>
                        <label className="field">
                          <span>Статус прав</span>
                          <select name="rights_status" defaultValue={rightsStatus || "unknown"}>
                            {Object.entries(mediaRightsLabels).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <label className="field"><span>Коллекция</span><input name="collection_name" required defaultValue={asset.collection_name} /></label>
                        <MediaFocalEditor
                          src={data.publicUrl}
                          alt={asset.alt_text}
                          initialX={asset.focus_x}
                          initialY={asset.focus_y}
                          width={asset.width}
                          height={asset.height}
                        />
                        <section className="media-usage-readout" aria-label="Места использования изображения">
                          <strong>Используется: {usageCount}</strong>
                          {usages.length ? (
                            <ul>
                              {usages.map((usage) => {
                                const href = mediaUsageHref(usage);
                                const label = `${mediaEntityLabels[usage.entity_type] || usage.entity_type} · ${mediaUsageFieldLabel(usage.field_name)}`;
                                return (
                                  <li key={`${usage.entity_type}:${usage.entity_id}:${usage.field_name}`}>
                                    {href ? <Link href={href}>{label}</Link> : <span>{label}</span>}
                                    <small>{usage.entity_id}</small>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <small>Изображение пока не привязано к опубликованным сущностям.</small>
                          )}
                        </section>
                        <button className="button-secondary" type="submit">Сохранить сведения</button>
                      </form>
                    </details>
                    {canManageLifecycle && !asset.deleted_at && (
                      <details className="media-replacement-editor">
                        <summary>Безопасно заменить файл</summary>
                        {replacementFor === asset.id ? (
                          <div className="settings-stack">
                            {replacementPreviewError && (
                              <p className="form-message form-error" role="alert">
                                Предпросмотр не выполнен: {replacementPreviewError}
                              </p>
                            )}
                            {replacementPreview && (
                              <>
                                <div className="media-replacement-summary">
                                  <strong>Новый файл: {replacementPreview.new_alt_text}</strong>
                                  <small>{replacementPreview.new_original_name}</small>
                                  <small>SHA-256: {replacementPreview.new_sha256_hex.slice(0, 16)}…</small>
                                  <small>
                                    Исторических связей сохранится: {Number(replacementPreview.history_usage_count || 0)}
                                  </small>
                                </div>
                                <form className="settings-stack" action={replaceMediaCurrentUsagesAction}>
                                  <input name="old_media_id" type="hidden" value={replacementPreview.old_media_id} />
                                  <input name="new_media_id" type="hidden" value={replacementPreview.new_media_id} />
                                  <input name="expected_old_updated_at" type="hidden" value={replacementPreview.old_updated_at} />
                                  <input name="expected_new_updated_at" type="hidden" value={replacementPreview.new_updated_at} />
                                  <input
                                    name="expected_usage_refs"
                                    type="hidden"
                                    value={JSON.stringify(replacementPreview.current_usage_refs)}
                                  />
                                  <input name="catalog_q" type="hidden" value={catalog.term} />
                                  <input name="catalog_search_field" type="hidden" value={catalog.field} />
                                  <input name="catalog_state" type="hidden" value={catalog.state} />
                                  <input name="catalog_view" type="hidden" value={catalog.view} />
                                  <input name="catalog_page" type="hidden" value={catalog.page} />
                                  <label className="media-replacement-all">
                                    <input name="replace_all_current" type="checkbox" value="1" defaultChecked />
                                    <span>Заменить во всех текущих местах из предпросмотра</span>
                                  </label>
                                  {replacementPreview.current_usage_refs.length ? (
                                    <fieldset className="media-replacement-usages">
                                      <legend>Или снимите флажок выше и выберите отдельные связи</legend>
                                      {replacementPreview.current_usage_refs.map((usage) => (
                                        <label key={`${usage.entity_type}:${usage.entity_id}:${usage.field_name}`}>
                                          <input
                                            name="usage_ref"
                                            type="checkbox"
                                            value={JSON.stringify(usage)}
                                            defaultChecked
                                          />
                                          <span>
                                            {mediaEntityLabels[usage.entity_type] || usage.entity_type}
                                            {` · ${mediaUsageFieldLabel(usage.field_name)}`}
                                            <small>{usage.entity_id}</small>
                                          </span>
                                        </label>
                                      ))}
                                    </fieldset>
                                  ) : (
                                    <small>Текущих связей нет: будет зарегистрирована новая версия, старый объект останется доступен.</small>
                                  )}
                                  <p className="media-replacement-warning">
                                    Операция атомарна. Ревизии и резервные копии не переписываются, старый объект Storage не удаляется.
                                  </p>
                                  <div className="media-replacement-actions">
                                    <button className="button" type="submit">Выполнить безопасную замену</button>
                                    <Link className="button-secondary" href={mediaCatalogPageHref(catalog, catalog.page)}>
                                      Отменить
                                    </Link>
                                  </div>
                                </form>
                              </>
                            )}
                            {!replacementPreview && (
                              <Link className="button-secondary" href={mediaCatalogPageHref(catalog, catalog.page)}>
                                Закрыть предпросмотр
                              </Link>
                            )}
                          </div>
                        ) : (
                          <form className="settings-stack" method="get">
                            {catalog.term && <input name="q" type="hidden" value={catalog.term} />}
                            {catalog.field !== "alt" && <input name="search_field" type="hidden" value={catalog.field} />}
                            {catalog.state !== "active" && <input name="state" type="hidden" value={catalog.state} />}
                            {catalog.view !== "grid" && <input name="view" type="hidden" value={catalog.view} />}
                            {catalog.page > 1 && <input name="page" type="hidden" value={catalog.page} />}
                            <input name="replacement_for" type="hidden" value={asset.id} />
                            <label className="field">
                              <span>UUID уже загруженного нового файла</span>
                              <input
                                name="replacement_with"
                                required
                                pattern="[0-9a-fA-F-]{36}"
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                              />
                              <small>Сначала загрузите новую версию обычной формой. Повторная загрузка и перезапись объекта не выполняются.</small>
                            </label>
                            <button className="button-secondary" type="submit">Показать текущие связи</button>
                          </form>
                        )}
                      </details>
                    )}
                    {canManageLifecycle && (
                      <form action={asset.deleted_at ? restoreMediaAction : trashMediaAction}>
                        <input name="id" type="hidden" value={asset.id} />
                        <input name="expected_updated_at" type="hidden" value={asset.updated_at} />
                        <input name="catalog_q" type="hidden" value={catalog.term} />
                        <input name="catalog_search_field" type="hidden" value={catalog.field} />
                        <input name="catalog_state" type="hidden" value={catalog.state} />
                        <input name="catalog_view" type="hidden" value={catalog.view} />
                        <input name="catalog_page" type="hidden" value={catalog.page} />
                        <button
                          className="button-secondary"
                          type="submit"
                          disabled={!asset.deleted_at && usageCount > 0}
                          title={!asset.deleted_at && usageCount > 0
                            ? "Сначала удалите все активные и исторические связи"
                            : undefined}
                        >
                          {asset.deleted_at ? "Восстановить" : "В корзину"}
                        </button>
                      </form>
                    )}
                    {canPermanentlyPurge && asset.deleted_at && (
                      <details className="media-purge-editor">
                        <summary>Удалить навсегда</summary>
                        <div className="settings-stack">
                          <p className="media-purge-warning">
                            Это действие необратимо и доступно только владельцу после 30 дней
                            в корзине. Сервер повторно проверит текущие, исторические,
                            автосохранённые связи и цепочку замен, затем удалит только один
                            точный Storage-объект.
                          </p>
                          {!retentionElapsed && purgeAvailableAt && (
                            <p>
                              Срок хранения завершится не ранее {formatDate(purgeAvailableAt.toISOString())}.
                            </p>
                          )}
                          {usageCount > 0 && (
                            <p>Сначала устраните все {usageCount} текущих или исторических связей.</p>
                          )}
                          <p>
                            Если Storage или финализация временно не ответят, обновите страницу
                            и повторите действие: защищённая заявка продолжится с тем же токеном.
                          </p>
                          <form className="settings-stack" action={permanentlyPurgeMediaAction}>
                            <input name="id" type="hidden" value={asset.id} />
                            <input name="expected_updated_at" type="hidden" value={asset.updated_at} />
                            <input name="catalog_q" type="hidden" value={catalog.term} />
                            <input name="catalog_search_field" type="hidden" value={catalog.field} />
                            <input name="catalog_state" type="hidden" value={catalog.state} />
                            <input name="catalog_view" type="hidden" value={catalog.view} />
                            <input name="catalog_page" type="hidden" value={catalog.page} />
                            <label className="field">
                              <span>Введите без изменений: {MEDIA_PURGE_CONFIRMATION}</span>
                              <input
                                name="purge_confirmation"
                                type="text"
                                required
                                autoComplete="off"
                                disabled={!retentionElapsed || usageCount > 0}
                                pattern={MEDIA_PURGE_CONFIRMATION}
                              />
                            </label>
                            <button
                              className="button-secondary media-purge-button"
                              type="submit"
                              disabled={!retentionElapsed || usageCount > 0}
                            >
                              Безвозвратно удалить файл
                            </button>
                          </form>
                        </div>
                      </details>
                    )}
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
