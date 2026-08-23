import { adminEnv } from "@/lib/env";
import { editorialCatalog } from "@/lib/editorial-catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readSiteCopyValues } from "@/lib/site-copy-storage";

import { translatePremiumArticleBatchAction } from "./article-actions";
import {
  translatePremiumLibraryBatchAction,
  translatePremiumSiteCopyBatchAction,
  translatePremiumWriterBatchAction,
} from "./actions";

export const metadata = { title: "Premium English" };
export const dynamic = "force-dynamic";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function eligibleStaticWriterBiographies() {
  let total = 0;
  for (const country of editorialCatalog.countries) {
    for (const writer of country.writers) {
      const translations = objectValue(writer.fields.biographyTranslations);
      const ru = objectValue(translations.ru);
      if (
        ru.locale === "ru" &&
        ru.method === "editorial-original" &&
        new Set(["reviewed", "verified"]).has(String(ru.status)) &&
        typeof ru.text === "string" &&
        ru.text.trim().length >= 120 &&
        Array.isArray(ru.sources) &&
        ru.sources.length > 0
      ) {
        total += 1;
      }
    }
  }
  return total;
}

export default async function PremiumTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    error?: string;
    publication?: string;
  }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();

  const [
    articleCount,
    articleEnglishCount,
    workRussianCount,
    workEnglishCount,
    siteCopyResult,
    machineWorkReadiness,
  ] = supabase
    ? await Promise.all([
        supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .is("deleted_at", null),
        supabase
          .from("article_translations")
          .select("id", { count: "exact", head: true })
          .eq("locale", "en")
          .eq("status", "published")
          .is("deleted_at", null),
        supabase
          .from("literary_work_translations")
          .select("id", { count: "exact", head: true })
          .eq("locale", "ru")
          .in("editorial_status", ["reviewed", "verified"]),
        supabase
          .from("literary_work_translations")
          .select("id", { count: "exact", head: true })
          .eq("locale", "en")
          .in("editorial_status", ["reviewed", "verified"]),
        supabase
          .from("homepage_blocks")
          .select("settings")
          .contains("settings", { systemKey: "site-copy-overrides" })
          .order("updated_at", { ascending: false })
          .limit(1),
        supabase.rpc("premium_machine_translation_ready"),
      ])
    : [null, null, null, null, null, null];

  const siteCopySettings = objectValue(siteCopyResult?.data?.[0]?.settings);
  const siteCopy = readSiteCopyValues(siteCopySettings.siteCopy);
  const premiumState = objectValue(siteCopySettings.premiumTranslation);
  const machineCopy = objectValue(premiumState.siteCopyEn);
  const apiReady = Boolean(adminEnv.openAiApiKey);
  const bookDbReady = machineWorkReadiness?.data === true;
  const eligibleWriters = eligibleStaticWriterBiographies();

  const readinessChecks = [
    ["OpenAI server secret", apiReady],
    ["Модель переводчика", Boolean(adminEnv.openAiTranslationModel)],
    ["Второй редакторский проход", adminEnv.openAiPremiumTranslationReview],
    ["DB: machine-translation для книг", bookDbReady],
  ] as const;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Premium English · OpenAI</span>
          <h1>Премиальный английский перевод</h1>
          <p>
            Первый GPT-5.6 Sol переводит материал, второй GPT-5.6 Sol сверяет его
            с русским оригиналом и редактирует до естественного литературного английского.
            Ручные EN-версии никогда автоматически не перезаписываются.
          </p>
        </div>
      </header>

      {query.error && <p className="form-message">{query.error}</p>}
      {query.success && (
        <p className="form-message form-success">
          {query.success}
          {query.publication === "started" && " Публичная сборка запущена."}
          {query.publication === "queued" && " Публикация поставлена в очередь."}
        </p>
      )}

      <section className="dashboard-grid">
        <article className="panel">
          <span className="eyebrow">Модели</span>
          <h2>{adminEnv.openAiTranslationModel}</h2>
          <p>
            Финальная редактура: <strong>{adminEnv.openAiTranslationReviewModel}</strong>
          </p>
          <p className="editorial-note">
            {adminEnv.openAiPremiumTranslationReview
              ? "Premium review включён: на материал выполняются два модельных прохода."
              : "Premium review отключён переменной окружения."}
          </p>
        </article>
        <article className="panel">
          <span className="eyebrow">Готовность</span>
          <div className="status-list">
            {readinessChecks.map(([label, ready]) => (
              <div key={label}>
                <span>{label}</span>
                <strong style={{ color: ready ? "var(--good)" : "var(--orange-soft)" }}>
                  {ready ? "Готово" : "Нужно подключить"}
                </strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="stats-grid" style={{ marginTop: 18 }}>
        <article className="stat-card">
          <span>Опубликованные статьи</span>
          <strong>{articleCount?.count || 0}</strong>
          <small>EN published: {articleEnglishCount?.count || 0}</small>
        </article>
        <article className="stat-card">
          <span>Книжные RU-карточки</span>
          <strong>{workRussianCount?.count || 0}</strong>
          <small>EN reviewed/verified: {workEnglishCount?.count || 0}</small>
        </article>
        <article className="stat-card">
          <span>Биографии с lawful RU</span>
          <strong>{eligibleWriters}</strong>
          <small>кандидатов на безопасный EN</small>
        </article>
        <article className="stat-card">
          <span>CMS-тексты</span>
          <strong>{Object.keys(siteCopy.ru).length}</strong>
          <small>машинных EN: {Object.keys(machineCopy).length}</small>
        </article>
      </section>

      <section className="dashboard-grid" style={{ marginTop: 18 }}>
        <form className="panel settings-stack" action={translatePremiumArticleBatchAction}>
          <span className="eyebrow">Статьи</span>
          <h2>Догнать опубликованный архив</h2>
          <p>
            За один запуск обрабатываются не более двух устаревших/отсутствующих EN.
            Новые публикации уже переводятся автоматически до сохранения английской версии.
          </p>
          <button className="button" type="submit" disabled={!apiReady}>
            Перевести следующий пакет статей
          </button>
        </form>

        <form className="panel settings-stack" action={translatePremiumLibraryBatchAction}>
          <span className="eyebrow">Книжный архив</span>
          <h2>Премиальный EN книг</h2>
          <p>
            До четырёх проверенных RU-карточек за запуск. Ручной reviewed/verified EN
            имеет абсолютный приоритет и не заменяется моделью.
          </p>
          <button className="button" type="submit" disabled={!apiReady || !bookDbReady}>
            Перевести следующий пакет книг
          </button>
        </form>

        <form className="panel settings-stack" action={translatePremiumWriterBatchAction}>
          <span className="eyebrow">Писатели</span>
          <h2>Премиальный EN биографий</h2>
          <p>
            Переводятся только проверенные редакционные RU-оригиналы с provenance.
            По три новых биографии за запуск.
          </p>
          <button className="button" type="submit" disabled={!apiReady}>
            Перевести следующий пакет биографий
          </button>
        </form>

        <form className="panel settings-stack" action={translatePremiumSiteCopyBatchAction}>
          <span className="eyebrow">Интерфейс</span>
          <h2>Догнать CMS site-copy</h2>
          <p>
            До 50 русских CMS-переопределений за один двухпроходный запрос.
            Существующий ручной английский не меняется.
          </p>
          <button className="button" type="submit" disabled={!apiReady}>
            Перевести site-copy
          </button>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Правила качества</h2>
        <p>
          Переводчик не имеет права менять URL, ISBN, даты, идентификаторы и защищённую
          HTML-структуру. Для статей после модели выполняются обычные release-checks;
          книги и биографии проходят ограничения длины, предложений, provenance и
          отсутствие кириллицы. При конфликте версии результат не записывается.
        </p>
      </section>
    </>
  );
}
