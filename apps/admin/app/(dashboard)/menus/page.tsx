import { z } from "zod";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, readAdminList, type AdminReadIssue } from "@/lib/admin-read-result";
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
  updated_at: string;
};

function isSqlUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value);
}

function sameId(first: string, second: string) {
  return first.toLowerCase() === second.toLowerCase();
}

function isMenu(value: unknown): value is Menu {
  return isReadRecord(value) && isSqlUuid(value.id) && typeof value.name === "string"
    && (value.location === "header" || value.location === "footer");
}

function isNavigationItem(value: unknown): value is NavigationItem {
  return isReadRecord(value) && isSqlUuid(value.id) && isSqlUuid(value.menu_id)
    && (value.parent_id === null || isSqlUuid(value.parent_id))
    && typeof value.label === "string" && Array.from(value.label).length >= 1
    && Array.from(value.label).length <= 100 && typeof value.href === "string"
    && typeof value.open_in_new_tab === "boolean" && typeof value.is_visible === "boolean"
    && typeof value.display_order === "number" && Number.isInteger(value.display_order)
    && value.display_order >= -2147483648 && value.display_order <= 2147483647
    && typeof value.updated_at === "string" && Number.isFinite(Date.parse(value.updated_at));
}

function uniqueIds(values: readonly { id: string }[]) {
  return new Set(values.map((value) => value.id.toLowerCase())).size === values.length;
}

function canChangeItem(menu: Menu, item?: NavigationItem) {
  return z.string().uuid().safeParse(menu.id).success && (!item || (
    z.string().uuid().safeParse(item.id).success
    && (item.parent_id === null || z.string().uuid().safeParse(item.parent_id).success)
    && z.string().datetime({ offset: true }).safeParse(item.updated_at).success
  ));
}

function ReadOnlyItems({ items }: { items: NavigationItem[] }) {
  return <div className="navigation-item-list">{items.map((item) => (
    <article key={item.id}>
      <header><div><strong>{item.label}</strong><small>{item.href}</small></div>
        <span className="badge">Изменение недоступно</span>
      </header>
    </article>
  ))}</div>;
}

function ItemFields({
  menu,
  item,
  siblings,
  currentParent,
}: {
  menu: Menu;
  item?: NavigationItem;
  siblings: NavigationItem[];
  currentParent?: NavigationItem;
}) {
  const parents = siblings.filter((candidate) => !sameId(candidate.id, item?.id ?? "") && !candidate.parent_id);
  const retainCurrentParent = currentParent && !parents.some((candidate) => sameId(candidate.id, currentParent.id));
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      {item && <input type="hidden" name="expected_updated_at" value={item.updated_at} />}
      <input type="hidden" name="menu_id" value={menu.id} />
      <input type="hidden" name="context_location" value={menu.location} />
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
          {retainCurrentParent && <option value={item?.parent_id ?? currentParent.id}>{currentParent.label}</option>}
          {parents
            .map((candidate) => (
              <option key={candidate.id} value={item?.parent_id && sameId(item.parent_id, candidate.id) ? item.parent_id : candidate.id}>
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
  searchParams: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
    published?: string;
    location?: string;
  }>;
}) {
  const query = await searchParams;
  const requestedLocation = query.location === "header" || query.location === "footer"
    ? query.location
    : "";
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const reads = await Promise.allSettled([
    supabase.from("navigation_menus").select("*").order("location").order("id"),
    supabase
      .from("navigation_items")
      .select("*")
      .order("display_order")
      .order("id"),
  ]);
  let menusRead = readAdminList<Menu>(reads[0], isMenu);
  let itemsRead = readAdminList<NavigationItem>(reads[1], isNavigationItem);
  if (menusRead.status === "success" && (!uniqueIds(menusRead.data)
    || new Set(menusRead.data.map((menu) => menu.location)).size !== menusRead.data.length)) {
    menusRead = { status: "failed", issue: "invalid" };
  }
  if (itemsRead.status === "success" && !uniqueIds(itemsRead.data)) {
    itemsRead = { status: "failed", issue: "invalid" };
  }
  const menus = menusRead.status === "success" ? menusRead.data : [];
  const items = itemsRead.status === "success" ? itemsRead.data : [];
  const itemById = new Map(items.map((item) => [item.id.toLowerCase(), item]));
  const menuById = new Map(menus.map((menu) => [menu.id.toLowerCase(), menu]));
  const completeRelations = menusRead.status === "success" && itemsRead.status === "success"
    && items.every((item) => menuById.has(item.menu_id.toLowerCase())
      && (item.parent_id === null || itemById.has(item.parent_id.toLowerCase())));
  const issues: AdminReadIssue[] = [];
  if (menusRead.status === "failed") issues.push(menusRead.issue);
  if (itemsRead.status === "failed") issues.push(itemsRead.issue);
  if (!issues.length && !completeRelations) issues.push("invalid");
  const canChange = issues.length === 0;
  const unassignedItems = items.filter((item) => !menuById.has(item.menu_id.toLowerCase()));
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)
    + `/menus${requestedLocation ? `?location=${requestedLocation}` : ""}`;
  const publicationHint = query.published === "started" ? "Проверьте актуальную очередь и сборку."
    : query.published === "queued" ? "Проверьте актуальную очередь публикации."
    : query.published === "queue-error" ? "Проверьте очередь перед повторной публикацией." : "";
  const visibleMenus = requestedLocation
    ? menus.filter((menu) => menu.location === requestedLocation)
    : menus;

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
      {(query.error || query.saved || query.deleted || query.published) && <p className="form-message" role="status">
        Результат действия по параметрам страницы не подтверждён. Проверьте актуальные пункты меню перед повторным изменением.{" "}{publicationHint}
      </p>}
      {issues.length > 0 && <p className="form-message form-error" role="alert">
        {adminReadMessage(issues[0])}{" "}Изменение меню недоступно до полной загрузки меню и связей пунктов.{" "}
        <a href={retryHref}>Повторить загрузку</a>
      </p>}

      <nav className="row-actions" aria-label="Фильтр расположения меню">
        <a className="button-secondary" href="/menus">Все меню</a>
        <a className="button-secondary" href="/menus?location=header">Шапка</a>
        <a className="button-secondary" href="/menus?location=footer">Подвал</a>
      </nav>

      <div className="menu-admin-grid">
        {visibleMenus.map((menu) => {
          const menuItems = items.filter((item) => sameId(item.menu_id, menu.id));
          return (
            <section className="panel" key={menu.id}>
              <header className="menu-admin-heading">
                <div>
                  <span className="eyebrow">
                    {menu.location === "header" ? "Шапка" : "Подвал"}
                  </span>
                  <h2>{menu.name}</h2>
                </div>
                <strong>{itemsRead.status === "success" ? menuItems.filter((item) => item.is_visible).length : "Недоступно"}</strong>
              </header>
              <div className="navigation-item-list">
                {menuItems.map((item) => (
                  <article
                    className={item.parent_id ? "is-child" : ""}
                    id={`navigation-item-${item.id}`}
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
                    {canChange && canChangeItem(menu, item) ? <>
                    <details className="admin-editor-details">
                      <summary>Изменить</summary>
                      <form className="settings-stack" action={saveNavigationItemAction}>
                        <ItemFields menu={menu} item={item} siblings={menuItems} currentParent={item.parent_id ? itemById.get(item.parent_id.toLowerCase()) : undefined} />
                      </form>
                    </details>
                    <form action={deleteNavigationItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="expected_updated_at" value={item.updated_at} />
                      <input type="hidden" name="context_location" value={menu.location} />
                      <ConfirmSubmitButton message="Удалить этот пункт и вложенные в него ссылки?">
                        Удалить
                      </ConfirmSubmitButton>
                    </form>
                    </> : <p>Изменение недоступно</p>}
                  </article>
                ))}
              </div>
              {canChange && canChangeItem(menu) && <details className="admin-editor-details create-navigation-item">
                <summary>＋ Добавить пункт</summary>
                <form className="settings-stack" action={saveNavigationItemAction}>
                  <ItemFields menu={menu} siblings={menuItems} />
                </form>
              </details>}
            </section>
          );
        })}
      </div>
      {unassignedItems.length > 0 && <section className="panel">
        <h2>Пункты без загруженного меню</h2>
        <ReadOnlyItems items={unassignedItems} />
      </section>}
      {canChange && visibleMenus.length === 0 && <div className="empty-state"><p>Меню по этим условиям не найдены.</p></div>}
    </>
  );
}
