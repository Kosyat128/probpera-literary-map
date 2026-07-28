import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Меню" };

export default async function MenusPage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: menusResult }, { data: itemsResult }] = await Promise.all([
    supabase.from("navigation_menus").select("*").order("location"),
    supabase.from("navigation_items").select("*").order("display_order"),
  ]);
  const menus = menusResult || [];
  const items = itemsResult || [];
  return (
    <>
      <header className="page-heading"><div><span className="eyebrow">Навигация</span><h1>Меню сайта</h1>
        <p>Единая структура шапки и большого подвала-карты сайта. Ссылки проверяются перед публикацией.</p></div></header>
      <div className="module-grid">{menus.map((menu) => (
        <section className="module-card" key={menu.id}>
          <strong>{menu.name}</strong><p>{menu.location === "header" ? "Основная шапка сайта" : "Полная карта сайта в подвале"}</p>
          <small>{items.filter((item) => item.menu_id === menu.id && item.is_visible).length} видимых пунктов</small>
        </section>
      ))}</div>
    </>
  );
}
