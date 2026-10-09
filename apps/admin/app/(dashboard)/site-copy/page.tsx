import SiteCopyEditor from "@/components/SiteCopyEditor";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, readAdminList, readAdminResult } from "@/lib/admin-read-result";
import { adminEnv } from "@/lib/env";
import {
  loadAllSiteCopyCatalog,
  type SiteCopyDefinition,
} from "@/lib/site-copy-catalog";
import {
  readSiteCopyValues,
} from "@/lib/site-copy-storage";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safePublicSiteOrigin } from "@/lib/public-link-boundary";

export const metadata = { title: "Тексты сайта" };

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

type SiteCopyBlock = {
  id: string;
  settings: Record<string, unknown>;
  updated_at: string;
};

function validLocale(value: unknown) {
  // The existing storage reader explicitly supports absent/null legacy locales.
  return value === undefined || value === null || (isReadRecord(value)
    && Object.values(value).every((entry) => typeof entry === "string"));
}

function isSiteCopyBlock(value: unknown): value is SiteCopyBlock {
  if (!isReadRecord(value) || typeof value.id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value.id)
    || !isReadRecord(value.settings) || value.settings.systemKey !== SITE_COPY_SYSTEM_KEY
    || typeof value.updated_at !== "string" || !Number.isFinite(Date.parse(value.updated_at))) return false;
  const copy = value.settings.siteCopy;
  if (copy !== undefined && copy !== null
    && (!isReadRecord(copy) || !validLocale(copy.ru) || !validLocale(copy.en))) return false;
  const premium = value.settings.premiumTranslation;
  if (premium !== undefined && premium !== null) {
    if (!isReadRecord(premium)) return false;
    const machine = premium.siteCopyEn;
    if (machine !== undefined && machine !== null && (!isReadRecord(machine)
      || !Object.values(machine).every(isReadRecord))) return false;
  }
  return true;
}

function isCatalog(value: unknown): value is readonly SiteCopyDefinition[] {
  return Array.isArray(value) && value.length > 0
    && value.every((definition) => isReadRecord(definition)
      && ["key", "group", "label", "defaultRu"].every((field) =>
        typeof definition[field] === "string" && definition[field].trim().length > 0)
      && (definition.defaultEn === undefined || typeof definition.defaultEn === "string")
      && (definition.multiline === undefined || typeof definition.multiline === "boolean"))
    && new Set(value.map((definition) => definition.key)).size === value.length;
}

export default async function SiteCopyPage({
  searchParams,
}: {
  searchParams: Promise<{
    errorCode?: string;
    saved?: string;
    published?: string;
  }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const reads = await Promise.allSettled([
    Promise.resolve().then(async () => ({ data: await loadAllSiteCopyCatalog(), error: null })),
    supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(1),
  ]);
  const catalogRead = readAdminResult(reads[0], isCatalog);
  let storageRead = readAdminList<SiteCopyBlock>(reads[1], isSiteCopyBlock);
  if (storageRead.status === "success" && storageRead.data.length > 1) {
    storageRead = { status: "failed", issue: "invalid" };
  }
  const allSiteCopyCatalog = catalogRead.status === "success" ? catalogRead.data : [];
  const data = storageRead.status === "success" ? storageRead.data : [];
  const settings = objectValue(data?.[0]?.settings);
  const values = readSiteCopyValues(settings.siteCopy);
  const loadIssue = catalogRead.status === "failed" ? catalogRead.issue
    : storageRead.status === "failed" ? storageRead.issue : null;
  const canEdit = loadIssue === null;
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH) + "/site-copy";
  const knownKeys = new Set(allSiteCopyCatalog.map((item) => item.key));
  const additionalDefinitions: SiteCopyDefinition[] = Array.from(
    new Set([...Object.keys(values.ru), ...Object.keys(values.en)])
  )
    .filter((key) => !knownKeys.has(key) && key.startsWith("interface."))
    .map((key) => {
      const source = key.slice("interface.".length);
      return {
        key,
        group: "Добавленные вручную",
        label: source,
        defaultRu: source,
        multiline: source.length > 90,
      };
    });
  const definitions = [...allSiteCopyCatalog, ...additionalDefinitions];

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Единый словарь интерфейса</span>
          <h1>Тексты сайта</h1>
          <p>
            Меняйте подписи главной, разделов, глобуса и всплывающих панелей.
            Русский текст публикуется самостоятельно; английская версия каждого
            поля необязательна.
          </p>
        </div>
        <a className="button" href={safePublicSiteOrigin(adminEnv.publicSiteUrl)} target="_blank" rel="noreferrer">
          Посмотреть сайт ↗
        </a>
      </header>

      {loadIssue !== null && (
        <p className="form-message form-error" role="alert">
          {adminReadMessage(loadIssue)}{" "}Редактор недоступен до полной загрузки исходного словаря и сохранённых текстов.{" "}
          <a href={retryHref}>Повторить загрузку</a>
        </p>
      )}
      {(query.errorCode || query.saved || query.published) && (
        <p className="form-message" role="status">
          Результат действия по параметрам страницы не подтверждён. Проверьте актуальные тексты и очередь публикации перед повторным изменением.
        </p>
      )}

      <section className="panel site-copy-note">
        <strong>Как работает сохранение</strong>
        <p>
          В базе лежат только ваши замены. Исходные тексты остаются безопасным
          запасным вариантом, поэтому обновление кода не стирает редакционные
          правки. Пустой English автоматически берётся из действующего перевода.
        </p>
      </section>

      {canEdit && <SiteCopyEditor
        definitions={definitions}
        values={values}
        expectedUpdatedAt={data?.[0]?.updated_at}
      />}
    </>
  );
}
