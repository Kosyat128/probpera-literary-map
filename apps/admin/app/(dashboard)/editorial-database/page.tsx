import Link from "next/link";

import {
  loadEditorialCatalog,
  editorialCountry,
  editorialWriter,
} from "@/lib/editorial-catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  publishEditorialDatabaseAction,
  saveEditorialProfileAction,
} from "./actions";

export const metadata = { title: "Страны и авторы" };

type SearchParams = {
  country_id?: string;
  writer_id?: string;
  result?: string;
  publication?: string;
  error?: string;
  warning?: string;
};

const countryFieldGroups = [
  ["Основное", ["name", "code", "flag", "capital", "region", "continent", "officialLanguage", "coordinates"]],
  ["Литературная карта", ["literaryPeriods", "literaryMovements", "periods", "literaryPlaces", "nobel", "places", "influence"]],
  ["Тексты и факты", ["description", "history", "historicalNote", "facts", "timeline", "chronology"]],
] as const;

const writerFieldGroups = [
  ["Имя и годы жизни", ["name", "fullName", "birth", "death", "years", "birthDate", "deathDate", "birthPlace", "deathPlace", "country", "nationality"]],
  ["Литературный профиль", ["movement", "literaryEra", "genres", "languages", "language", "tags", "category", "works", "awards", "places", "relatedWriters", "articleUrl"]],
  ["Биография и изображения", ["bio", "biography", "description", "portrait", "portraitAlt", "portraitSourceUrl"]],
] as const;

const labels: Record<string, string> = {
  name: "Название / имя",
  code: "Код страны",
  flag: "Флаг",
  coordinates: "Координаты",
  region: "Регион",
  continent: "Континент",
  officialLanguage: "Официальный язык",
  literaryPeriods: "Литературные периоды",
  literaryMovements: "Литературные направления",
  periods: "Периоды",
  capital: "Столица",
  description: "Описание",
  history: "История",
  historicalNote: "Историческая справка",
  facts: "Факты",
  literaryPlaces: "Литературные места",
  timeline: "Литературная хронология",
  chronology: "Общая хронология",
  nobel: "Нобелевские лауреаты",
  places: "Места",
  influence: "Индекс влияния",
  fullName: "Полное имя",
  birth: "Рождение",
  death: "Смерть",
  years: "Годы жизни",
  birthDate: "Дата рождения",
  deathDate: "Дата смерти",
  birthPlace: "Место рождения",
  deathPlace: "Место смерти",
  portrait: "Портрет",
  portraitAlt: "Описание портрета",
  portraitSourceUrl: "Источник портрета",
  country: "Страна в карточке",
  movement: "Направление",
  literaryEra: "Литературная эпоха",
  genres: "Жанры",
  languages: "Языки",
  language: "Основной язык",
  nationality: "Национальность",
  tags: "Теги",
  category: "Категория",
  bio: "Основная биография",
  biography: "Расширенная биография",
  works: "Основные произведения",
  awards: "Премии",
  relatedWriters: "Связанные авторы",
  articleUrl: "Ссылка на материал",
};

const listFields = new Set([
  "literaryPeriods",
  "literaryMovements",
  "periods",
  "facts",
  "literaryPlaces",
  "genres",
  "languages",
  "tags",
  "works",
  "awards",
  "places",
  "relatedWriters",
]);
const longTextFields = new Set([
  "description",
  "history",
  "historicalNote",
  "bio",
  "biography",
  "timeline",
  "chronology",
]);
const integerFields = new Set(["nobel", "places", "influence"]);

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function timelineText(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      const row = plainRecord(item);
      return [row.year, row.title, row.description]
        .map((part) => String(part ?? "").trim())
        .join(" | ")
        .replace(/(?:\s*\|\s*)+$/u, "");
    })
    .filter(Boolean)
    .join("\n");
}

function fieldText(field: string, value: unknown) {
  if (field === "timeline" || field === "chronology") return timelineText(value);
  if (Array.isArray(value)) return value.map(String).join("\n");
  if (value === null || value === undefined) return "";
  return String(value);
}

function sourceHint(field: string, value: unknown) {
  const text = fieldText(field, value).replace(/\s+/gu, " ").trim();
  if (!text) return "В исходной базе поле не заполнено.";
  return `Исходное: ${text.length > 180 ? `${text.slice(0, 177)}…` : text}`;
}

function OverrideField({
  field,
  sourceFields,
  overrideFields,
  expectedUpdatedAt,
}: {
  field: string;
  sourceFields: Record<string, unknown>;
  overrideFields: Record<string, unknown>;
  expectedUpdatedAt?: string | null;
}) {
  const overridden = Object.hasOwn(overrideFields, field);
  const value = overridden ? overrideFields[field] : sourceFields[field];
  if (field === "coordinates") {
    const coordinateValue = value;
    const coordinates = Array.isArray(coordinateValue)
      ? { lat: coordinateValue[0], lng: coordinateValue[1] }
      : plainRecord(coordinateValue);
    return (
      <fieldset className="editorial-override-field">
        <legend>{labels[field]}</legend>
        <label className="check-field">
          <input name="enabled_fields" type="checkbox" value={field} defaultChecked={overridden} />
          <span>Публиковать значение из админки</span>
        </label>
        <div className="coordinate-grid">
          <label className="field"><span>Широта</span><input name="coordinates_lat" inputMode="decimal" defaultValue={fieldText(field, coordinates.lat)} /></label>
          <label className="field"><span>Долгота</span><input name="coordinates_lng" inputMode="decimal" defaultValue={fieldText(field, coordinates.lng)} /></label>
        </div>
        <small>{sourceHint(field, sourceFields[field])}</small>
      </fieldset>
    );
  }

  const textarea = listFields.has(field) || longTextFields.has(field);
  return (
    <div className="editorial-override-field">
      <label className="check-field">
        <input name="enabled_fields" type="checkbox" value={field} defaultChecked={overridden} />
        <span>{labels[field] || field} · публиковать из админки</span>
      </label>
      <label className="field">
        <span className="sr-only">{labels[field] || field}</span>
        {textarea ? (
          <textarea
            name={field}
            defaultValue={fieldText(field, value)}
            rows={longTextFields.has(field) ? 7 : 4}
            placeholder={
              field === "timeline" || field === "chronology"
                ? "Год | Заголовок | Описание — одна запись в строке"
                : listFields.has(field)
                  ? "Одно значение в строке"
                  : undefined
            }
          />
        ) : (
          <input
            name={field}
            type={integerFields.has(field) ? "number" : "text"}
            inputMode={integerFields.has(field) ? "numeric" : undefined}
            defaultValue={fieldText(field, value)}
          />
        )}
        <small>{sourceHint(field, sourceFields[field])}</small>
      </label>
    </div>
  );
}

function ProfileEditor({
  entityType,
  countryId,
  writerId,
  sourceFields,
  overrideFields,
  expectedUpdatedAt,
}: {
  entityType: "country" | "writer";
  countryId: string;
  writerId?: string;
  sourceFields: Record<string, unknown>;
  overrideFields: Record<string, unknown>;
  expectedUpdatedAt?: string | null;
}) {
  const groups = entityType === "country" ? countryFieldGroups : writerFieldGroups;
  return (
    <form className="settings-stack editorial-profile-form" action={saveEditorialProfileAction}>
      <input name="entity_type" type="hidden" value={entityType} />
      <input name="country_id" type="hidden" value={countryId} />
      {writerId && <input name="writer_id" type="hidden" value={writerId} />}
      <input
        name="expected_updated_at"
        type="hidden"
        value={expectedUpdatedAt || ""}
      />
      {groups.map(([title, fields]) => (
        <section className="editorial-field-group" key={title}>
          <header><h3>{title}</h3><p>Отметьте только те поля, которыми должна управлять админка.</p></header>
          <div className="editorial-field-grid">
            {fields.map((field) => (
              <OverrideField
                key={field}
                field={field}
                sourceFields={sourceFields}
                overrideFields={overrideFields}
              />
            ))}
          </div>
        </section>
      ))}
      <div className="editorial-save-bar">
        <p>
          После сохранения новая публичная сборка ставится в очередь автоматически.
          Чтобы вернуться к проверенному исходнику, снимите отметку с поля.
        </p>
        <button className="button" type="submit">Сохранить и опубликовать</button>
      </div>
    </form>
  );
}

export default async function EditorialDatabasePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, editorialCatalog] = await Promise.all([
    searchParams,
    loadEditorialCatalog(),
  ]);
  const defaultCountryId = editorialCountry(editorialCatalog, "russia")?.id || editorialCatalog.countries[0]?.id || "";
  const countryId = editorialCountry(editorialCatalog, query.country_id || "")?.id || defaultCountryId;
  const selectedCountry = editorialCountry(editorialCatalog, countryId);
  const writerId = editorialWriter(editorialCatalog, countryId, query.writer_id || "")?.id || "";
  const selectedWriter = writerId ? editorialWriter(editorialCatalog, countryId, writerId) : null;
  const supabase = await createServerSupabaseClient();
  if (!supabase || !selectedCountry) return null;

  const [countryOverrideResult, writerOverrideResult, countryCountResult, writerCountResult] = await Promise.all([
    supabase.from("country_profile_overrides").select("id,fields,updated_at").eq("country_id", countryId).maybeSingle(),
    writerId
      ? supabase.from("writer_profile_overrides").select("id,fields,updated_at").eq("country_id", countryId).eq("writer_id", writerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("country_profile_overrides").select("id", { count: "exact", head: true }),
    supabase.from("writer_profile_overrides").select("id", { count: "exact", head: true }),
  ]);
  const countryOverrideFields = plainRecord(countryOverrideResult.data?.fields);
  const writerOverrideFields = plainRecord(writerOverrideResult.data?.fields);
  const schemaError = countryOverrideResult.error || writerOverrideResult.error || countryCountResult.error || writerCountResult.error;
  const totalWriters = editorialCatalog.countries.reduce((total, country) => total + country.writers.length, 0);

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Единая редакционная база</span>
          <h1>Страны и авторы</h1>
          <p>
            Полное редактирование карточек поверх проверенного архива: исходные данные
            остаются резервом, а отмеченные поля сразу публикуются через CMS.
          </p>
        </div>
        <form action={publishEditorialDatabaseAction}>
          <input name="country_id" type="hidden" value={countryId} />
          <input name="writer_id" type="hidden" value={writerId} />
          <button className="button-secondary" type="submit">Опубликовать все изменения</button>
        </form>
      </header>

      {query.error && <p className="form-message">{query.error}</p>}
      {query.result && (
        <p className="form-message form-success">
          {query.result === "removed"
            ? "Переопределение удалено; сайт снова использует проверенную исходную запись."
            : query.result === "published"
              ? "Публикация всех сохранённых изменений запрошена."
              : "Профиль сохранён и передан в публикацию."}
          {query.publication === "started" && " Сборка запущена."}
          {query.publication === "queued" && " Запрос сохранён в резервной очереди."}
          {query.publication === "queue-error" && " Не удалось записать резервную очередь — проверьте журнал."}
        </p>
      )}
      {query.warning === "audit" && <p className="form-message">Профиль и публикация сохранены, но запись журнала требует проверки.</p>}
      {schemaError && (
        <p className="form-message">
          Для полного редактора нужно применить миграции 20260812_writer_and_work_revisions.sql
          и 20260813_editorial_database_admin.sql. Исходный каталог доступен, но сохранение
          стран пока не заработает.
        </p>
      )}

      <section className="stats-grid">
        <article className="stat-card"><span>Страны</span><strong>{editorialCatalog.countries.length}</strong><small>в исходном каталоге</small></article>
        <article className="stat-card"><span>Авторы</span><strong>{totalWriters.toLocaleString("ru-RU")}</strong><small>доступны для выбора</small></article>
        <article className="stat-card"><span>Правки стран</span><strong>{countryCountResult.count || 0}</strong><small>активных записей CMS</small></article>
        <article className="stat-card"><span>Правки авторов</span><strong>{writerCountResult.count || 0}</strong><small>активных записей CMS</small></article>
      </section>

      <section className="panel editorial-database-picker">
        <div>
          <span className="eyebrow">Шаг 1</span>
          <h2>Выберите карточку</h2>
        </div>
        <form method="get">
          <label className="field"><span>Страна</span><select name="country_id" defaultValue={countryId}>
            {editorialCatalog.countries.map((country) => <option key={country.id} value={country.id}>{country.label}</option>)}
          </select></label>
          <button className="button-secondary" type="submit">Открыть страну</button>
        </form>
        <form method="get">
          <input name="country_id" type="hidden" value={countryId} />
          <label className="field"><span>Автор</span><select name="writer_id" defaultValue={writerId}>
            <option value="">Выберите автора</option>
            {selectedCountry.writers.map((writer) => <option key={writer.id} value={writer.id}>{writer.label}</option>)}
          </select></label>
          <button className="button-secondary" type="submit">Открыть автора</button>
        </form>
      </section>

      <section className="panel editorial-profile-editor">
        <header>
          <div><span className="eyebrow">Карточка страны</span><h2>{selectedCountry.label}</h2><p>{countryId}</p></div>
          <span className="badge">{Object.keys(countryOverrideFields).length} полей CMS</span>
        </header>
        <ProfileEditor entityType="country" countryId={countryId} sourceFields={selectedCountry.fields} overrideFields={countryOverrideFields} expectedUpdatedAt={countryOverrideResult.data?.updated_at} />
      </section>

      {selectedWriter && (
        <section className="panel editorial-profile-editor">
          <header>
            <div><span className="eyebrow">Карточка автора</span><h2>{selectedWriter.label}</h2><p>{countryId}:{writerId}</p></div>
            <div className="heading-actions">
              <span className="badge">{Object.keys(writerOverrideFields).length} полей CMS</span>
              <Link className="button-secondary" href={`/library?country_id=${encodeURIComponent(countryId)}&writer_id=${encodeURIComponent(writerId)}`}>Произведения и книги</Link>
            </div>
          </header>
          <ProfileEditor entityType="writer" countryId={countryId} writerId={writerId} sourceFields={selectedWriter.fields} overrideFields={writerOverrideFields} expectedUpdatedAt={writerOverrideResult.data?.updated_at} />
        </section>
      )}

      <section className="panel">
        <h2>Остальные редакционные базы</h2>
        <div className="quick-actions">
          <Link href="/articles"><strong>✎</strong><span>Статьи и публикации</span></Link>
          <Link href="/pages"><strong>◫</strong><span>Постоянные страницы</span></Link>
          <Link href="/homepage"><strong>⌘</strong><span>Главная, изображения и эффекты</span></Link>
          <Link href="/library"><strong>▥</strong><span>Произведения, издания и обложки</span></Link>
          <Link href="/media"><strong>▧</strong><span>Медиатека и права</span></Link>
          <Link href="/menus"><strong>☷</strong><span>Меню и навигация</span></Link>
          <Link href="/banners"><strong>▱</strong><span>Баннеры</span></Link>
          <Link href="/site-copy"><strong>Aa</strong><span>Все тексты интерфейса</span></Link>
        </div>
      </section>
    </>
  );
}
