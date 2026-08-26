import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteBannerAction, saveBannerAction } from "./actions";

export const metadata = { title: "Баннеры" };

type Media = {
  id: string;
  alt_text: string;
  original_name: string;
  bucket: string;
  object_path: string;
};

type Banner = {
  id: string;
  name: string;
  title: string;
  description: string;
  target_url: string | null;
  button_text: string;
  desktop_media_id: string | null;
  tablet_media_id: string | null;
  mobile_media_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  is_active: boolean;
  page_patterns: string[];
  updated_at: string;
};

function escapedLikePattern(value: string) {
  return `%${value.replace(/[\\%_]/gu, "\\$&")}%`;
}

function dateTimeValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function MediaSelect({
  name,
  value,
  media,
}: {
  name: string;
  value?: string | null;
  media: Media[];
}) {
  return (
    <select name={name} defaultValue={value || ""}>
      <option value="">Не выбрано</option>
      {media.map((item) => (
        <option key={item.id} value={item.id}>
          {item.alt_text || item.original_name}
        </option>
      ))}
    </select>
  );
}

function BannerFields({
  banner,
  media,
}: {
  banner?: Banner;
  media: Media[];
}) {
  return (
    <>
      {banner && <input type="hidden" name="id" value={banner.id} />}
      {banner && <input type="hidden" name="expected_updated_at" value={banner.updated_at} />}
      <div className="dashboard-grid">
        <label className="field">
          <span>Служебное название</span>
          <input name="name" defaultValue={banner?.name || ""} required minLength={2} />
        </label>
        <label className="field">
          <span>Порядок</span>
          <input type="number" name="display_order" defaultValue={banner?.display_order || 0} />
        </label>
      </div>
      <label className="field">
        <span>Заголовок</span>
        <input name="title" defaultValue={banner?.title || ""} maxLength={240} />
      </label>
      <label className="field">
        <span>Описание</span>
        <textarea name="description" defaultValue={banner?.description || ""} maxLength={1200} />
      </label>
      <div className="dashboard-grid">
        <label className="field">
          <span>Текст кнопки</span>
          <input name="button_text" defaultValue={banner?.button_text || ""} />
        </label>
        <label className="field">
          <span>Ссылка</span>
          <input name="target_url" defaultValue={banner?.target_url || ""} placeholder="/stati/… или https://…" />
        </label>
      </div>
      <div className="banner-media-fields">
        <label className="field">
          <span>Компьютер</span>
          <MediaSelect name="desktop_media_id" value={banner?.desktop_media_id} media={media} />
        </label>
        <label className="field">
          <span>Планшет</span>
          <MediaSelect name="tablet_media_id" value={banner?.tablet_media_id} media={media} />
        </label>
        <label className="field">
          <span>Телефон</span>
          <MediaSelect name="mobile_media_id" value={banner?.mobile_media_id} media={media} />
        </label>
      </div>
      <div className="dashboard-grid">
        <label className="field">
          <span>Начало показа</span>
          <input type="datetime-local" name="starts_at" defaultValue={dateTimeValue(banner?.starts_at || null)} />
        </label>
        <label className="field">
          <span>Конец показа</span>
          <input type="datetime-local" name="ends_at" defaultValue={dateTimeValue(banner?.ends_at || null)} />
        </label>
      </div>
      <label className="field">
        <span>Страницы показа - по одному шаблону на строку</span>
        <textarea name="page_patterns" defaultValue={(banner?.page_patterns || ["/"]).join("\n")} />
      </label>
      <label>
        <input type="checkbox" name="is_active" defaultChecked={banner?.is_active || false} />{" "}
        Баннер активен
      </label>
      <button className="button" type="submit">
        {banner ? "Сохранить баннер" : "Создать баннер"}
      </button>
    </>
  );
}

export default async function BannersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string; published?: string; media_q?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: bannersResult } = await supabase
    .from("banners")
    .select("*")
    .order("display_order")
    .order("id");
  const banners = (bannersResult || []) as Banner[];
  const mediaTerm = String(query.media_q || "").trim().slice(0, 120);
  const referencedMediaIds = Array.from(
    new Set(
      banners
        .flatMap((banner) => [
          banner.desktop_media_id,
          banner.tablet_media_id,
          banner.mobile_media_id,
        ])
        .filter((id): id is string => Boolean(id))
    )
  );
  const mediaRequests = [
    supabase
      .from("media_assets")
      .select("id,alt_text,original_name,bucket,object_path")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(120),
    ...(mediaTerm
      ? [
          supabase
            .from("media_assets")
            .select("id,alt_text,original_name,bucket,object_path")
            .is("deleted_at", null)
            .ilike("alt_text", escapedLikePattern(mediaTerm))
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(120),
          supabase
            .from("media_assets")
            .select("id,alt_text,original_name,bucket,object_path")
            .is("deleted_at", null)
            .ilike("original_name", escapedLikePattern(mediaTerm))
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(120),
        ]
      : []),
    ...(referencedMediaIds.length
      ? [
          supabase
            .from("media_assets")
            .select("id,alt_text,original_name,bucket,object_path")
            .in("id", referencedMediaIds),
        ]
      : []),
  ];
  const mediaResults = await Promise.all(mediaRequests);
  const media = Array.from(
    new Map(
      mediaResults
        .flatMap((result) => result.data || [])
        .map((asset) => [asset.id, asset as Media] as const)
    ).values()
  );
  const mediaUrls = new Map(
    media.map((item) => [
      item.id,
      supabase.storage.from(item.bucket).getPublicUrl(item.object_path).data.publicUrl,
    ])
  );

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Промо и объявления</span>
          <h1>Баннеры</h1>
          <p>
            Отдельные изображения для компьютера, планшета и телефона,
            расписание, страницы показа и точная ссылка перехода.
          </p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Баннер сохранён.</p>}
      {query.deleted && <p className="form-message form-success">Баннер удалён.</p>}
      {query.published === "started" && <p className="form-message form-success">Публичная сборка с изменениями баннера запущена.</p>}
      {query.published === "queued" && <p className="form-message form-success">Изменение баннера сохранено в резервной очереди публикации.</p>}
      {query.published === "queue-error" && <p className="form-message form-error" role="alert">Изменение сохранено, но запрос публикации записать не удалось. Повторите публикацию позже.</p>}

      <form className="panel media-catalog-search" method="get">
        <label className="field">
          <span>Найти изображение для баннера</span>
          <input
            type="search"
            name="media_q"
            maxLength={120}
            defaultValue={mediaTerm}
            placeholder="Описание или имя файла"
          />
        </label>
        <div className="media-catalog-search-actions">
          <button className="button-secondary" type="submit">Найти</button>
          {mediaTerm && <a className="button-secondary" href="/banners">Сбросить</a>}
          <a className="button-secondary" href="/media">Вся медиатека</a>
        </div>
      </form>

      <div className="module-grid banner-admin-grid">
        {banners.map((banner) => (
          <article
            className="panel banner-admin-card"
            id={`banner-${banner.id}`}
            key={banner.id}
          >
            <div className="banner-admin-preview">
              {banner.desktop_media_id && mediaUrls.get(banner.desktop_media_id) ? (
                <img src={mediaUrls.get(banner.desktop_media_id)} alt="" />
              ) : (
                <span>Изображение не выбрано</span>
              )}
              <div>
                <strong>{banner.title || banner.name}</strong>
                <small>{banner.button_text}</small>
              </div>
            </div>
            <div className="status-list">
              <div><span>Состояние</span><strong>{banner.is_active ? "Активен" : "Выключен"}</strong></div>
              <div><span>Период</span><strong>{formatDate(banner.starts_at)} - {formatDate(banner.ends_at)}</strong></div>
              <div><span>Страницы</span><strong>{banner.page_patterns.length}</strong></div>
            </div>
            <details className="admin-editor-details">
              <summary>Редактировать</summary>
              <form className="settings-stack" action={saveBannerAction}>
                <BannerFields banner={banner} media={media} />
              </form>
            </details>
            <form action={deleteBannerAction}>
              <input type="hidden" name="id" value={banner.id} />
              <input type="hidden" name="expected_updated_at" value={banner.updated_at} />
              <ConfirmSubmitButton message="Удалить баннер? Это действие нельзя отменить через интерфейс.">
                Удалить баннер
              </ConfirmSubmitButton>
            </form>
          </article>
        ))}
      </div>

      <form className="panel settings-stack" action={saveBannerAction}>
        <h2>Новый баннер</h2>
        <BannerFields media={media} />
      </form>
    </>
  );
}
