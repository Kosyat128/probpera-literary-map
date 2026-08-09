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
  republishHomepageAction,
  saveCoreHomepageSectionAction,
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
  "literary-map": "Литературная планета",
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

const coreSectionDefaults = [
  {
    key: "hero",
    label: "Первый экран",
    eyebrow: "Журнал о литературе и искусстве слова",
    title: "Литература – это целый мир!",
    description:
      "Статьи, биографии, редкие книги и интерактивная литературная энциклопедия стран — в одном редакционном пространстве.",
    buttonText: "Открыть глобус",
    buttonUrl: "#atlas",
    backgroundStyle: "violet",
  },
  {
    key: "atlas",
    label: "Литературная планета",
    eyebrow: "Интерактивная энциклопедия",
    title: "Литературная планета",
    description:
      "Выберите страну на интерактивном глобусе — откроются писатели, произведения, эпохи и проверенная редакционная справка.",
    buttonText: "",
    buttonUrl: "#atlas",
    backgroundStyle: "violet",
  },
  {
    key: "book-month",
    label: "Книга месяца",
    eyebrow: "Выбор энциклопедии",
    title: "Книга месяца",
    description:
      "Каждый месяц энциклопедия выбирает новое произведение из единой базы стран.",
    buttonText: "О книге",
    buttonUrl: "#book-day",
    backgroundStyle: "paper",
  },
  {
    key: "editorial-standard",
    label: "Редакционный стандарт",
    eyebrow: "Редакционный стандарт",
    title: "Материал, которому можно доверять",
    description:
      "Полное имя, проверяемые даты, человеческая биография, ключевые произведения и открытые источники.",
    buttonText: "",
    buttonUrl: "#editorial-policy",
    backgroundStyle: "paper",
  },
  {
    key: "featured-journal",
    label: "Материалы журнала",
    eyebrow: "Главное в журнале",
    title: "Статьи и редакционные подборки",
    description: "Свежие публикации и основные рубрики «Пробы Пера».",
    buttonText: "Все статьи",
    buttonUrl: "#journal",
    backgroundStyle: "light",
  },
  {
    key: "community",
    label: "Сообщество",
    eyebrow: "Литературное сообщество",
    title: "Обсуждайте книги внутри журнала",
    description:
      "Форум, комментарии, рейтинги и личные подборки читателей.",
    buttonText: "Открыть форум",
    buttonUrl: "#community",
    backgroundStyle: "violet",
  },
  {
    key: "authors",
    label: "Писатели",
    eyebrow: "Авторы энциклопедии",
    title: "Писатели мира",
    description: "Биографии, произведения и литературные маршруты.",
    buttonText: "Открыть карту",
    buttonUrl: "#atlas",
    backgroundStyle: "paper",
  },
  {
    key: "sections",
    label: "Разделы",
    eyebrow: "Навигация по журналу",
    title: "Все темы и разделы",
    description: "Выберите рубрику и сразу переходите к нужным статьям.",
    buttonText: "Все статьи",
    buttonUrl: "#journal",
    backgroundStyle: "light",
  },
  {
    key: "trust",
    label: "Редакционная политика",
    eyebrow: "Открытая редакция",
    title: "Как мы проверяем материалы",
    description:
      "Источники, права на изображения и история исправлений доступны читателю.",
    buttonText: "Сообщить об ошибке",
    buttonUrl: "mailto:probperasite@yandex.ru?subject=Исправление%20в%20материале",
    backgroundStyle: "violet",
  },
  {
    key: "calendar",
    label: "Литературный календарь",
    eyebrow: "Литературный календарь",
    title: "Даты, премии и памятные события",
    description: "События литературной истории в единой хронологии.",
    buttonText: "",
    buttonUrl: "#calendar",
    backgroundStyle: "paper",
  },
] as const;

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

export default async function HomepagePage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    deleted?: string;
    published?: string;
  }>;
}) {
  const query = await searchParams;
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
  const coreBlockByKey = new Map(
    blocks
      .map((block) => {
        const key = settingText(settingsObject(block.settings), "coreSectionKey");
        return key ? [key, block] as const : null;
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  );
  const customBlocks = blocks.filter(
    (block) => !settingText(settingsObject(block.settings), "coreSectionKey")
  );
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
            Меняйте тексты и изображения уже существующих секций, добавляйте
            новые редакционные блоки и публикуйте результат без работы с кодом.
          </p>
        </div>
        <div className="editor-actions">
          <Link className="button-secondary" href="/media">
            Открыть медиатеку
          </Link>
          <form action={republishHomepageAction}>
            <button className="button-secondary" type="submit">
              Повторно опубликовать главную
            </button>
          </form>
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

      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && (
        <p className="form-message form-success">
          Изменения сохранены в редакционной базе.
        </p>
      )}
      {query.published === "started" && (
        <p className="form-message form-success">
          Публикация главной запущена. Новая версия появится после сборки сайта.
        </p>
      )}
      {query.published === "queued" && (
        <p className="form-message form-success">
          Изменения поставлены в резервную очередь публикации. Обычно сайт
          обновляется в течение 5–10 минут.
        </p>
      )}
      {query.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Изменения сохранены, но очередь публикации недоступна. Повторите
          публикацию после проверки подключения.
        </p>
      )}
      {query.published === "disabled" && (
        <p className="form-message form-error">
          Публикация сейчас недоступна. Проверьте настройки запуска сборки.
        </p>
      )}

      {query.deleted && (
        <p className="form-message form-success">
          Блок удалён и изменение поставлено в очередь публикации.
        </p>
      )}

      <HomepageVisualPreview url={adminEnv.publicSiteUrl} />

      <section className="panel homepage-core-editor">
        <header className="homepage-editor-heading">
          <div>
            <span className="eyebrow">Основная композиция</span>
            <h2>Существующие блоки главной</h2>
            <p>
              Эти формы меняют тексты и фоновые изображения текущей главной,
              сохраняя глобус, календарь, архив и фирменную вёрстку.
            </p>
          </div>
          <span className="badge">{coreSectionDefaults.length} блоков</span>
        </header>
        <div className="homepage-core-grid">
          {coreSectionDefaults.map((section) => {
            const block = coreBlockByKey.get(section.key);
            const settings = settingsObject(block?.settings);
            const backgroundMediaId = block?.background_media_id || null;
            const previewMedia = backgroundMediaId
              ? mediaById.get(backgroundMediaId)
              : null;
            return (
              <article
                className="homepage-core-card"
                id={`core-${section.key}`}
                key={section.key}
              >
                <header>
                  <div>
                    <span className="badge">{section.label}</span>
                    <strong>
                      {block ? "Подключён к редактору" : "Исходный текст сайта"}
                    </strong>
                  </div>
                  <a href={`${adminEnv.publicSiteUrl}${section.buttonUrl}`} target="_blank" rel="noreferrer">
                    На сайте ↗
                  </a>
                </header>
                {previewMedia && (
                  <img
                    className="homepage-block-preview"
                    src={previewMedia.publicUrl}
                    alt={`Фон блока «${section.label}»`}
                  />
                )}
                <form
                  className="settings-stack"
                  action={saveCoreHomepageSectionAction}
                >
                  <input
                    type="hidden"
                    name="core_section_key"
                    value={section.key}
                  />
                  <label className="field">
                    <span>Надзаголовок</span>
                    <input
                      name="eyebrow"
                      defaultValue={settingText(settings, "eyebrow") || section.eyebrow}
                    />
                  </label>
                  <label className="field">
                    <span>Заголовок</span>
                    <input name="title" defaultValue={block?.title || section.title} />
                  </label>
                  <label className="field">
                    <span>Описание</span>
                    <textarea
                      name="description"
                      defaultValue={
                        settingText(settings, "description") || section.description
                      }
                    />
                  </label>
                  <div className="dashboard-grid">
                    <label className="field">
                      <span>Текст кнопки</span>
                      <input
                        name="button_text"
                        defaultValue={
                          settingText(settings, "buttonText") || section.buttonText
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Ссылка кнопки</span>
                      <input
                        name="button_url"
                        defaultValue={
                          settingText(settings, "buttonUrl") || section.buttonUrl
                        }
                      />
                    </label>
                  </div>
                  <div className="dashboard-grid">
                    <label className="field">
                      <span>Стиль фона</span>
                      <BackgroundSelect
                        value={block?.background_style || section.backgroundStyle}
                      />
                    </label>
                    <div className="field">
                      <span>Фоновое изображение</span>
                      <HomepageMediaField value={backgroundMediaId} media={media} />
                    </div>
                  </div>
                  <button className="button" type="submit">
                    Сохранить и опубликовать
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>

      <header className="homepage-editor-heading homepage-custom-heading">
        <div>
          <span className="eyebrow">Дополнительная витрина</span>
          <h2>Добавленные редакционные блоки</h2>
          <p>Их можно переставлять, временно скрывать и удалять.</p>
        </div>
      </header>

      {customBlocks.length ? (
        <div className="module-grid">
          {customBlocks.map((block, index) => {
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
                        disabled={index === customBlocks.length - 1}
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
