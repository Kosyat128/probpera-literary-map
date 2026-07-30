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
};

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
        <span>Страницы показа — по одному шаблону на строку</span>
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
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: bannersResult }, { data: mediaResult }] = await Promise.all([
    supabase.from("banners").select("*").order("display_order"),
    supabase
      .from("media_assets")
      .select("id,alt_text,original_name,bucket,object_path")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const banners = (bannersResult || []) as Banner[];
  const media = (mediaResult || []) as Media[];
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
      {query.saved && <p className="form-message form-success">Баннер сохранён и отправлен в публикационный контур.</p>}
      {query.deleted && <p className="form-message form-success">Баннер удалён.</p>}

      <div className="module-grid banner-admin-grid">
        {banners.map((banner) => (
          <article className="panel banner-admin-card" key={banner.id}>
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
              <div><span>Период</span><strong>{formatDate(banner.starts_at)} — {formatDate(banner.ends_at)}</strong></div>
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
