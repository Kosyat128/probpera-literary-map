import MediaUploader from "@/components/MediaUploader";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Медиатека" };

export default async function MediaPage() {
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
