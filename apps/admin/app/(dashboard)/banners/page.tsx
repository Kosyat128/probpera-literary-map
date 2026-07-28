import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Баннеры" };

export default async function BannersPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: bannersResult } =
    (await supabase.from("banners").select("*").order("display_order")) || {};
  const banners = bannersResult || [];
  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Промо и объявления</span><h1>Баннеры</h1>
        <p>Отдельные изображения для компьютера, планшета и телефона, расписание показа и точная ссылка перехода.</p></div></header>
      <section className="panel">
        {banners.length ? <table className="data-table">
          <thead><tr><th>Название</th><th>Период</th><th>Состояние</th><th>Ссылка</th></tr></thead>
          <tbody>{banners.map((banner) => <tr key={banner.id}>
            <td className="data-title"><strong>{banner.name}</strong><small>{banner.title}</small></td>
            <td>{formatDate(banner.starts_at)} — {formatDate(banner.ends_at)}</td>
            <td><span className="badge">{banner.is_active ? "Активен" : "Выключен"}</span></td>
            <td>{banner.target_url || "—"}</td>
          </tr>)}</tbody>
        </table> : <div className="empty-state"><div><p>Активных баннеров нет.</p><small>Создание будет доступно после загрузки изображений в медиатеку.</small></div></div>}
      </section>
    </>
  );
}
