import TranslationSubmitButton from "@/components/TranslationSubmitButton";
import { adminEnv } from "@/lib/env";
import { formatDate } from "@/lib/format";
import {
  loadEditorialCatalog,
  type EditorialCatalog,
} from "@/lib/editorial-catalog";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readSiteCopyValues } from "@/lib/site-copy-storage";
import { premiumTranslationRuntimeReadiness } from "@/lib/premium-english-translation";
import { premiumTranslationSelfTestFresh } from "@/lib/translation-runtime-gate";
import { translationErrorMessage } from "@/lib/translation-errors";

import { translatePremiumArticleBatchAction } from "./article-actions";
import {
  translatePremiumLibraryBatchAction,
  translatePremiumSiteCopyBatchAction,
  translatePremiumWriterBatchAction,
} from "./actions";
import { translatePremiumCountryBatchAction } from "./country-actions";
import { runPremiumTranslationSelfTestAction } from "./self-test-action";
import { resumeTranslationJobAction } from "./resume-action";

export const metadata = { title: "Premium English" };
export const dynamic = "force-dynamic";

type BackfillCursorQuery = {
  articleCursor?: string;
  libraryCursor?: string;
  writerCursor?: string;
  countryCursor?: string;
};

function BackfillCursorFields({ query }: { query: BackfillCursorQuery }) {
  return (
    <>
      <input type="hidden" name="articleCursor" value={query.articleCursor || "0"} />
      <input type="hidden" name="libraryCursor" value={query.libraryCursor || "0"} />
      <input type="hidden" name="writerCursor" value={query.writerCursor || "0"} />
      <input type="hidden" name="countryCursor" value={query.countryCursor || "0"} />
    </>
  );
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function boundedCount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item && typeof item === "object" && !Array.isArray(item))
      )
    : [];
}

const translationKindLabels: Record<string, string> = {
  article: "Статьи",
  literary_work: "Книги",
  writer: "Биографии",
  country: "Страны",
  site_copy: "Тексты интерфейса",
};

function eligibleStaticWriterBiographies(
  editorialCatalog: EditorialCatalog
) {
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

function eligibleStaticCountries(
  editorialCatalog: EditorialCatalog
) {
  return editorialCatalog.countries.filter((country) => {
    const fields = country.fields;
    return (
      typeof fields.name === "string" &&
      fields.name.trim().length > 0 &&
      [fields.description, fields.history, fields.historicalNote].some(
        (value) => typeof value === "string" && value.trim().length > 0
      )
    );
  }).length;
}

export default async function PremiumTranslationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    success?: string;
    errorCode?: string;
    publication?: string;
    articleCursor?: string;
    libraryCursor?: string;
    writerCursor?: string;
    countryCursor?: string;
    selfTest?: string;
  }>;
}) {
  const [query, editorialCatalog] = await Promise.all([
    searchParams,
    loadEditorialCatalog(),
  ]);
  const supabase = await createServerSupabaseClient();

  const [
    articleCount,
    articleEnglishCount,
    workRussianCount,
    workEnglishCount,
    siteCopyResult,
    machineWorkReadiness,
    translationOperationsReadiness,
    translationOperationsStatus,
    providerSelfTestResult,
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
        supabase.rpc("translation_operations_ready"),
        supabase.rpc("get_translation_operations_status"),
        supabase
          .from("translation_provider_self_tests")
          .select(
            "provider,configured,binding_found,test_passed,model,latency_ms,last_error_code,last_test_at,cooldown_until,test_in_progress"
          )
          .eq("provider", adminEnv.premiumTranslationProvider)
          .maybeSingle(),
      ])
    : [null, null, null, null, null, null, null, null, null];

  const siteCopySettings = objectValue(siteCopyResult?.data?.[0]?.settings);
  const siteCopy = readSiteCopyValues(siteCopySettings.siteCopy);
  const premiumState = objectValue(siteCopySettings.premiumTranslation);
  const machineCopy = objectValue(premiumState.siteCopyEn);
  const runtimeReadiness = premiumTranslationRuntimeReadiness();
  const workersAi = adminEnv.premiumTranslationProvider === "cloudflare";
  const translatorModel = workersAi
    ? adminEnv.cloudflareTranslationModel
    : adminEnv.openAiTranslationModel;
  const reviewerModel = workersAi
    ? adminEnv.cloudflareTranslationReviewModel
    : adminEnv.openAiTranslationReviewModel;
  const bookDbReady = machineWorkReadiness?.data === true;
  const operationsReady = translationOperationsReadiness?.data === true;
  const operations = objectValue(translationOperationsStatus?.data);
  const recentJobs = arrayValue(operations.recent);
  const providerProbe = objectValue(providerSelfTestResult?.data);
  const translationReady = Boolean(
    runtimeReadiness.configured &&
      runtimeReadiness.bindingFound &&
      providerProbe.test_passed === true &&
      providerProbe.model === translatorModel &&
      premiumTranslationSelfTestFresh(providerProbe.last_test_at)
  );
  const eligibleWriters = eligibleStaticWriterBiographies(editorialCatalog);
  const eligibleCountries = eligibleStaticCountries(editorialCatalog);

  const readinessChecks = [
    [
      workersAi ? "Cloudflare Workers AI binding" : "OpenAI server secret",
      translationReady,
    ],
    ["Модель переводчика", Boolean(translatorModel)],
    ["Второй редакторский проход", adminEnv.openAiPremiumTranslationReview],
    ["DB: machine-translation для книг", bookDbReady],
    ["Журнал и очередь Translation Operations", operationsReady],
  ] as const;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Premium English · {workersAi ? "Cloudflare Workers AI" : "OpenAI"}
          </span>
          <h1>Премиальный английский перевод</h1>
          <p>
            {workersAi
              ? "Gemma 4 делает полный литературный перевод, а Cloudflare-hosted OpenAI gpt-oss-120b независимо сверяет его с русским оригиналом и выполняет финальную редактуру до естественного литературного английского. Платный OpenAI API для этого режима не требуется."
              : "Первый OpenAI-проход переводит материал, второй сверяет его с русским оригиналом и редактирует до естественного литературного английского."}{" "}
            Ручные EN-версии никогда автоматически не перезаписываются.
          </p>
        </div>
      </header>

      {translationErrorMessage(query.errorCode) && (
        <p className="form-message">{translationErrorMessage(query.errorCode)}</p>
      )}
      {query.success && (
        <p className="form-message form-success">
          {query.success}
          {query.publication === "started" && " Публичная сборка запущена."}
          {query.publication === "queued" && " Публикация поставлена в очередь."}
        </p>
      )}
      {query.selfTest === "passed" && (
        <p className="form-message form-success">Контрольный запрос провайдера выполнен успешно.</p>
      )}
      {query.selfTest === "failed" && (
        <p className="form-message form-error" role="alert">Контрольный запрос завершился безопасной ошибкой. Сырой ответ провайдера не сохранён.</p>
      )}

      <section className="dashboard-grid">
        <article className="panel">
          <span className="eyebrow">Модели</span>
          <h2>{translatorModel}</h2>
          <p>
            Финальная редактура: <strong>{reviewerModel}</strong>
          </p>
          <p className="editorial-note">
            {adminEnv.openAiPremiumTranslationReview
              ? "Premium review включён: на материал выполняются два независимых модельных прохода."
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

      <section className="panel" style={{ marginTop: 18 }}>
        <span className="eyebrow">Translation Operations</span>
        <h2>{operationsReady ? "Долговечный контур заданий готов" : "Нужна миграция очереди переводов"}</h2>
        <p>
          {operationsReady
            ? "Каждый малый пакет сохраняет задания, элементы, попытки, статусы и следующий курсор в приватной базе без исходных текстов и сырых ответов провайдера. Кнопка продолжения - активный ограниченный staff-runner с сохранённой позиции. Service-role lease API также закрыт от браузера и готов для отдельного фонового worker, но расписание worker в этом интерфейсе не заявляется."
            : "Пока миграция Translation Operations не применена, доступны только малые ограниченные пакеты в текущем запросе. Интерфейс не выдаёт их за фоновые задания."}
        </p>
        {operationsReady && (
          <div className="status-list">
            <div><span>В очереди</span><strong>{boundedCount(operations.queued)}</strong></div>
            <div><span>В работе</span><strong>{boundedCount(operations.running)}</strong></div>
            <div><span>Завершено</span><strong>{boundedCount(operations.completed)}</strong></div>
            <div><span>Требуют внимания</span><strong>{boundedCount(operations.attention)}</strong></div>
            <div><span>Dead-letter элементов</span><strong>{boundedCount(operations.deadLetterItems)}</strong></div>
          </div>
        )}
        {operationsReady && recentJobs.length > 0 && (
          <div className="settings-stack" style={{ marginTop: 16 }}>
            <h3>Последние пакеты</h3>
            {recentJobs.slice(0, 6).map((job) => {
              const id = typeof job.id === "string" ? job.id : "";
              if (!id) return null;
              return (
                <form className="status-list" action={resumeTranslationJobAction} key={id}>
                  <input type="hidden" name="job_id" value={id} />
                  <div>
                    <span>{translationKindLabels[String(job.kind)] || "Перевод"} · {String(job.status || "unknown")}</span>
                    <strong>{boundedCount(job.succeededItems)} / {boundedCount(job.totalItems)}</strong>
                  </div>
                  <button className="button-secondary" type="submit">Продолжить со следующего курсора</button>
                </form>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <span className="eyebrow">Runtime self-test</span>
        <h2>Реальная проверка провайдера</h2>
        <div className="status-list">
          <div><span>CONFIGURED</span><strong>{runtimeReadiness.configured ? "ДА" : "НЕТ"}</strong></div>
          <div><span>BINDING FOUND</span><strong>{runtimeReadiness.bindingFound ? "ДА" : "НЕТ"}</strong></div>
          <div><span>TEST PASSED</span><strong>{translationReady ? "ДА" : providerProbe.test_passed === false ? "НЕТ" : "НЕ ЗАПУСКАЛСЯ"}</strong></div>
          <div><span>LAST TEST</span><strong>{typeof providerProbe.last_test_at === "string" ? formatDate(providerProbe.last_test_at, true) : "-"}</strong></div>
          <div><span>LATENCY</span><strong>{typeof providerProbe.latency_ms === "number" ? `${providerProbe.latency_ms} мс` : "-"}</strong></div>
          <div><span>LAST ERROR</span><strong>{translationErrorMessage(providerProbe.last_error_code) || "-"}</strong></div>
        </div>
        <p>
          Self-test делает настоящий короткий запрос к выбранной модели, проверяет binding,
          JSON Schema и задержку. Ответ и секреты не сохраняются; повторный запуск ограничен
          серверной паузой в пять минут.
        </p>
        <form action={runPremiumTranslationSelfTestAction}>
          <button className="button-secondary" type="submit" disabled={!operationsReady || providerProbe.test_in_progress === true}>
            Выполнить self-test
          </button>
        </form>
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
          <span>Страны с содержательным профилем</span>
          <strong>{eligibleCountries}</strong>
          <small>готовы к premium EN</small>
        </article>
        <article className="stat-card">
          <span>CMS-тексты</span>
          <strong>{Object.keys(siteCopy.ru).length}</strong>
          <small>машинных EN: {Object.keys(machineCopy).length}</small>
        </article>
      </section>

      <section className="dashboard-grid" style={{ marginTop: 18 }}>
        <form className="panel settings-stack" action={translatePremiumArticleBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Статьи</span>
          <h2>Догнать опубликованный архив</h2>
          <p>
            За один запуск обрабатываются не более двух устаревших/отсутствующих EN.
            Новые публикации уже переводятся автоматически до сохранения английской версии.
          </p>
          <TranslationSubmitButton disabled={!translationReady}>
            Перевести следующий пакет статей
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumLibraryBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Книжный архив</span>
          <h2>Премиальный EN книг</h2>
          <p>
            До четырёх проверенных RU-карточек за запуск. Ручной reviewed/verified EN
            имеет абсолютный приоритет и не заменяется моделью. Позиция обхода сохраняется
            между пакетами, поэтому архив постепенно проходит целиком.
          </p>
          <TranslationSubmitButton disabled={!translationReady || !bookDbReady}>
            Перевести следующий пакет книг
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumWriterBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Писатели</span>
          <h2>Премиальный EN биографий</h2>
          <p>
            Переводятся только проверенные редакционные RU-оригиналы с provenance.
            По три новых биографии за запуск; следующий пакет продолжает с места,
            на котором закончился предыдущий.
          </p>
          <TranslationSubmitButton disabled={!translationReady}>
            Перевести следующий пакет биографий
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumCountryBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Страны</span>
          <h2>Премиальный EN профилей стран</h2>
          <p>
            История, описание, литературные периоды, движения, факты и места переводятся
            по две страны за запуск. Курсор переносится между пакетами; коды, координаты,
            годы и числовые показатели не меняются.
          </p>
          <TranslationSubmitButton disabled={!translationReady}>
            Перевести следующий пакет стран
          </TranslationSubmitButton>
        </form>

        <form className="panel settings-stack" action={translatePremiumSiteCopyBatchAction}>
          <BackfillCursorFields query={query} />
          <span className="eyebrow">Интерфейс</span>
          <h2>Догнать CMS site-copy</h2>
          <p>
            До 50 русских CMS-переопределений за один двухпроходный запрос.
            Существующий ручной английский не меняется.
          </p>
          <TranslationSubmitButton disabled={!translationReady}>
            Перевести site-copy
          </TranslationSubmitButton>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Правила качества</h2>
        <p>
          Переводчик не имеет права менять URL, ISBN, даты, идентификаторы, координаты
          и защищённую HTML-структуру. Для статей после модели выполняются обычные
          release-checks; книги, биографии и страны проходят структурные ограничения,
          provenance/source-hash проверки и отсутствие случайной кириллицы. При конфликте
          версии результат не записывается.
        </p>
      </section>
    </>
  );
}
