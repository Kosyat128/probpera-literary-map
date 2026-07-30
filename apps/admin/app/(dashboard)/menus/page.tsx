import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  deleteNavigationItemAction,
  saveNavigationItemAction,
} from "./actions";

export const metadata = { title: "Меню" };

type Menu = {
  id: string;
  name: string;
  location: "header" | "footer";
};

type NavigationItem = {
  id: string;
  menu_id: string;
  parent_id: string | null;
  label: string;
  href: string;
  open_in_new_tab: boolean;
  is_visible: boolean;
  display_order: number;
};

function ItemFields({
  menu,
  item,
  siblings,
}: {
  menu: Menu;
  item?: NavigationItem;
  siblings: NavigationItem[];
}) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <input type="hidden" name="menu_id" value={menu.id} />
      <div className="dashboard-grid">
        <label className="field">
          <span>Название пункта</span>
          <input name="label" defaultValue={item?.label || ""} required maxLength={100} />
        </label>
        <label className="field">
          <span>Порядок</span>
          <input type="number" name="display_order" defaultValue={item?.display_order || 0} />
        </label>
      </div>
      <label className="field">
        <span>Ссылка</span>
        <input name="href" defaultValue={item?.href || ""} required placeholder="/stati/…, #atlas или https://…" />
      </label>
      <label className="field">
        <span>Родительский пункт</span>
        <select name="parent_id" defaultValue={item?.parent_id || ""}>
          <option value="">Верхний уровень</option>
          {siblings
            .filter((candidate) => candidate.id !== item?.id && !candidate.parent_id)
            .map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label}
              </option>
            ))}
        </select>
      </label>
      <div className="checkbox-row">
        <label>
          <input type="checkbox" name="is_visible" defaultChecked={item?.is_visible ?? true} /> Видимый
        </label>
        <label>
          <input type="checkbox" name="open_in_new_tab" defaultChecked={item?.open_in_new_tab || false} /> Новая вкладка
        </label>
      </div>
      <button className="button" type="submit">
        {item ? "Сохранить пункт" : "Добавить пункт"}
      </button>
    </>
  );
}

export default async function MenusPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; deleted?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: menusResult }, { data: itemsResult }] = await Promise.all([
    supabase.from("navigation_menus").select("*").order("location"),
    supabase
      .from("navigation_items")
      .select("*")
      .order("display_order"),
  ]);
  const menus = (menusResult || []) as Menu[];
  const items = (itemsResult || []) as NavigationItem[];

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Навигация</span>
          <h1>Меню сайта</h1>
          <p>
            Управление шапкой, выпадающими пунктами и полной картой сайта в
            подвале. Ссылки применяются после безопасной пересборки.
          </p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Навигация сохранена.</p>}
      {query.deleted && <p className="form-message form-success">Пункт удалён.</p>}

      <div className="menu-admin-grid">
        {menus.map((menu) => {
          const menuItems = items.filter((item) => item.menu_id === menu.id);
          return (
            <section className="panel" key={menu.id}>
              <header className="menu-admin-heading">
                <div>
                  <span className="eyebrow">
                    {menu.location === "header" ? "Шапка" : "Подвал"}
                  </span>
                  <h2>{menu.name}</h2>
                </div>
                <strong>{menuItems.filter((item) => item.is_visible).length}</strong>
              </header>
              <div className="navigation-item-list">
                {menuItems.map((item) => (
                  <article
                    className={item.parent_id ? "is-child" : ""}
                    key={item.id}
                  >
                    <header>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.href}</small>
                      </div>
                      <span className="badge">
                        {item.is_visible ? "Видимый" : "Скрытый"}
                      </span>
                    </header>
                    <details className="admin-editor-details">
                      <summary>Изменить</summary>
                      <form className="settings-stack" action={saveNavigationItemAction}>
                        <ItemFields menu={menu} item={item} siblings={menuItems} />
                      </form>
                    </details>
                    <form action={deleteNavigationItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmSubmitButton message="Удалить этот пункт и вложенные в него ссылки?">
                        Удалить
                      </ConfirmSubmitButton>
                    </form>
                  </article>
                ))}
              </div>
              <details className="admin-editor-details create-navigation-item">
                <summary>＋ Добавить пункт</summary>
                <form className="settings-stack" action={saveNavigationItemAction}>
                  <ItemFields menu={menu} siblings={menuItems} />
                </form>
              </details>
            </section>
          );
        })}
      </div>
    </>
  );
}
