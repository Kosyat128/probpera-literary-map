import Link from "next/link";

import HomepageMediaField, {
  type HomepageMediaOption,
} from "@/components/HomepageMediaField";
import HomepageVisualPreview from "@/components/HomepageVisualPreview";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { adminEnv } from "@/lib/env";
import {
  createHomepageBlockAction,
  deleteHomepageBlockAction,
  moveHomepageBlockAction,
  toggleHomepageBlockAction,
  updateHomepageBlockAction,
} from "./actions";

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

const backgroundLabels: Record<string, string> = {
  violet: "Фиолетовый",
  orange: "Оранжевый",
  paper: "Бумага с мазками",
  light: "Светлый",
  transparent: "Прозрачный",
};

function settingsObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function settingText(settings: Record<string, unknown>, key: string) {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function articleIds(settings: Record<string, unknown>) {
  const value = settings.articleIds;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join("\n")
    : "";
}

function BackgroundSelect({ value }: { value: string }) {
  return (
    <select name="background_style" defaultValue={value}>
      {Object.entries(backgroundLabels).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

export default async function HomepagePage() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [{ data: blocksResult }, { data: mediaResult }] = await Promise.all([
    supabase.from("homepage_blocks").select("*").order("display_order"),
    supabase
      .from("media_assets")
      .select("id,bucket,object_path,alt_text,collection_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(240),
  ]);
  const blocks = blocksResult || [];
  const media: HomepageMediaOption[] = (mediaResult || []).map((asset) => ({
    id: asset.id,
    label:
      asset.alt_text || asset.collection_name || asset.object_path.split("/").pop() || "Изображение",
    publicUrl: supabase.storage.from(asset.bucket).getPublicUrl(asset.object_path).data.publicUrl,
  }));
  const mediaById = new Map(media.map((asset) => [asset.id, asset]));

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Витрина журнала</span>
          <h1>Главная страница</h1>
          <p>
            Здесь настраиваются опубликованные редакционные блоки. После
            сохранения панель запускает безопасную пересборку сайта, а глобус и
            основные разделы остаются постоянной частью главной.
          </p>
        </div>
        <div className="editor-actions">
          <Link className="button-secondary" href="/media">
            Открыть медиатеку
          </Link>
          <a
            className="button"
            href={adminEnv.publicSiteUrl}
            target="_blank"
            rel="noreferrer"
          >
            Посмотреть главную ↗
          </a>
        </div>
      </header>

      <HomepageVisualPreview url={adminEnv.publicSiteUrl} />

      {blocks.length ? (
        <div className="module-grid">
          {blocks.map((block, index) => {
            const settings = settingsObject(block.settings);
            return (
              <article className="panel settings-stack" key={block.id}>
                <div className="page-heading">
                  <div>
                    <span className="badge">
                      {index + 1}.{" "}
                      {blockLabels[block.block_type] || block.block_type}
                    </span>
                    <h2>{block.title || "Без заголовка"}</h2>
                  </div>
                  <div className="editor-actions">
                    <form action={moveHomepageBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <button
                        className="button-secondary"
                        type="submit"
                        name="direction"
                        value="up"
                        disabled={index === 0}
                        aria-label="Поднять блок"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveHomepageBlockAction}>
                      <input type="hidden" name="id" value={block.id} />
                      <button
                        className="button-secondary"
                        type="submit"
                        name="direction"
                        value="down"
                        disabled={index === blocks.length - 1}
                        aria-label="Опустить блок"
                      >
                        ↓
                      </button>
                    </form>
                  </div>
                </div>

                <form
                  className="settings-stack"
                  action={updateHomepageBlockAction}
                >
                  <input type="hidden" name="id" value={block.id} />
                  <label className="field">
                    <span>Заголовок</span>
                    <input name="title" defaultValue={block.title} />
                  </label>
                  <label className="field">
                    <span>Надзаголовок</span>
                    <input
                      name="eyebrow"
                      defaultValue={settingText(settings, "eyebrow")}
                      placeholder="Например: Выбор редакции"
                    />
                  </label>
                  <label className="field">
                    <span>Описание</span>
                    <textarea
                      name="description"
                      defaultValue={
                        settingText(settings, "description") ||
                        settingText(settings, "copy")
                      }
                      placeholder="Короткий текст блока"
                    />
                  </label>
                  <label className="field">
                    <span>Фон</span>
                    <BackgroundSelect value={block.background_style} />
                  </label>
                  <div className="field">
                    <span>Фоновое изображение из медиатеки</span>
                    <HomepageMediaField value={block.background_media_id} media={media} />
                    <small>
                      Изображение применяется на всю ширину блока и адаптируется
                      для мобильного экрана.
                    </small>
                  </div>
                  {block.background_media_id && mediaById.get(block.background_media_id) && (
                    <img
                      className="homepage-block-preview"
                      src={mediaById.get(block.background_media_id)!.publicUrl}
                      alt="Предпросмотр фонового изображения блока"
                    />
                  )}
                  <div className="dashboard-grid">
                    <label className="field">
                      <span>Текст кнопки</span>
                      <input
                        name="button_text"
                        defaultValue={settingText(settings, "buttonText")}
                      />
                    </label>
                    <label className="field">
                      <span>Ссылка кнопки</span>
                      <input
                        name="button_url"
                        defaultValue={settingText(settings, "buttonUrl")}
                        placeholder="#atlas или https://…"
                      />
                    </label>
                  </div>
                  <label className="field">
                    <span>Статьи блока</span>
                    <textarea
                      name="article_ids"
                      defaultValue={articleIds(settings)}
                      placeholder="По одному ID статьи на строку. Если оставить пустым, сайт выберет свежие публикации."
                    />
                  </label>
                  <button className="button" type="submit">
                    Сохранить блок
                  </button>
                </form>

                <div className="editor-actions">
                  <form action={toggleHomepageBlockAction}>
                    <input type="hidden" name="id" value={block.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={block.is_enabled ? "false" : "true"}
                    />
                    <button className="button-secondary" type="submit">
                      {block.is_enabled ? "Скрыть на сайте" : "Показать на сайте"}
                    </button>
                  </form>
                  <form action={deleteHomepageBlockAction}>
                    <input type="hidden" name="id" value={block.id} />
                    <button className="button-secondary" type="submit">
                      Удалить
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel empty-state">
          <div>
            <h2>Управляемых блоков пока нет</h2>
            <p>
              Текущая главная продолжает работать. Добавьте первый блок, чтобы
              управлять дополнительной редакционной витриной из панели.
            </p>
          </div>
        </section>
      )}

      <form
        className="panel settings-stack"
        action={createHomepageBlockAction}
      >
        <h2>Добавить блок</h2>
        <div className="dashboard-grid">
          <label className="field">
            <span>Тип</span>
            <select name="block_type">
              {Object.entries(blockLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Фон</span>
            <BackgroundSelect value="paper" />
          </label>
          <div className="field">
            <span>Фоновое изображение</span>
            <HomepageMediaField media={media} />
          </div>
        </div>
        <label className="field">
          <span>Заголовок</span>
          <input name="title" />
        </label>
        <label className="field">
          <span>Надзаголовок</span>
          <input name="eyebrow" />
        </label>
        <label className="field">
          <span>Описание</span>
          <textarea name="description" />
        </label>
        <div className="dashboard-grid">
          <label className="field">
            <span>Текст кнопки</span>
            <input name="button_text" />
          </label>
          <label className="field">
            <span>Ссылка кнопки</span>
            <input name="button_url" />
          </label>
        </div>
        <label className="field">
          <span>ID выбранных статей</span>
          <textarea name="article_ids" />
        </label>
        <button className="button" type="submit">
          Добавить в конец главной
        </button>
      </form>
    </>
  );
}
