import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createHomepageBlockAction, toggleHomepageBlockAction } from "./actions";

export const metadata = { title: "Главная страница" };

const blockLabels: Record<string, string> = {
  hero: "Первый экран",
  "article-grid": "Сетка статей",
  carousel: "Карусель",
  "editors-choice": "Выбор редакции",
  popular: "Популярное",
  latest: "Новое",
  categories: "Разделы",
  "book-vs-screen": "Книга и экранизация",
  "literary-map": "Литературная карта",
  awards: "Премии",
  subscription: "Подписка",
  text: "Текстовый блок",
};

export default async function HomepagePage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data: blocksResult } =
    (await supabase.from("homepage_blocks").select("*").order("display_order")) || {};
  const blocks = blocksResult || [];
  return (
    <>
      <header className="page-heading">
        <div><span className="eyebrow">Витрина журнала</span><h1>Главная страница</h1>
          <p>Блоки идут сверху вниз. Глобус остаётся центральным объектом, а статьи, календарь и книжные находки создают вокруг него редакционный ритм.</p>
        </div>
      </header>
      <div className="dashboard-grid">
        <section className="panel">
          <h2>Порядок блоков</h2>
          <div className="status-list">
            {blocks.length ? blocks.map((block, index) => (
              <div key={block.id}>
                <span>{index + 1}. {block.title || blockLabels[block.block_type] || block.block_type}</span>
                <form action={toggleHomepageBlockAction}>
                  <input type="hidden" name="id" value={block.id} />
                  <input type="hidden" name="enabled" value={block.is_enabled ? "false" : "true"} />
                  <button className="button-secondary" type="submit">{block.is_enabled ? "Скрыть" : "Показать"}</button>
                </form>
              </div>
            )) : <p>Конфигурация пока берётся из текущего сайта. Добавьте первый управляемый блок.</p>}
          </div>
        </section>
        <form className="panel settings-stack" action={createHomepageBlockAction}>
          <h2>Добавить блок</h2>
          <label className="field"><span>Тип</span><select name="block_type">
            {Object.entries(blockLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label className="field"><span>Заголовок</span><input name="title" /></label>
          <label className="field"><span>Фон</span><select name="background_style">
            <option value="violet">Фиолетовый</option><option value="orange">Оранжевый</option>
            <option value="paper">Бумага с мазками</option><option value="light">Светлый</option>
            <option value="transparent">Прозрачный</option>
          </select></label>
          <button className="button" type="submit">Добавить в конец</button>
        </form>
      </div>
    </>
  );
}
