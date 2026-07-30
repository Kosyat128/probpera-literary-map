import MediaUploader from "@/components/MediaUploader";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { updateMediaMetadataAction } from "./actions";

export const metadata = { title: "Медиатека" };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: assetsResult } =
    (await supabase
      ?.from("media_assets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(80)) || {};
  const assets = assetsResult || [];

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

      <div className="dashboard-grid">
        <MediaUploader />
        <aside className="panel">
          <h2>Редакционный стандарт</h2>
          <div className="status-list">
            <div><span>Сгенерированные портреты</span><strong>Не используем</strong></div>
            <div><span>Обложки без источника</span><strong>На проверку</strong></div>
            <div><span>Максимальная сторона</span><strong>2400 px</strong></div>
            <div><span>Публичный формат</span><strong>WebP</strong></div>
          </div>
        </aside>
      </div>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Последние файлы</h2>
        {assets.length === 0 ? (
          <div className="empty-state"><p>Медиатека пока пуста.</p></div>
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
      </section>
    </>
  );
}
