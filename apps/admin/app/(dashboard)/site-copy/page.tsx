import SiteCopyEditor from "@/components/SiteCopyEditor";
import { adminEnv } from "@/lib/env";
import {
  allSiteCopyCatalog,
  type SiteCopyDefinition,
} from "@/lib/site-copy-catalog";
import {
  readSiteCopyValues,
} from "@/lib/site-copy-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Тексты сайта" };

const SITE_COPY_SYSTEM_KEY = "site-copy-overrides";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default async function SiteCopyPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    published?: string;
  }>;
}) {
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("homepage_blocks")
    .select("id,settings,updated_at")
    .contains("settings", { systemKey: SITE_COPY_SYSTEM_KEY })
    .order("updated_at", { ascending: false })
    .limit(1);
  const settings = objectValue(data?.[0]?.settings);
  const values = readSiteCopyValues(settings.siteCopy);
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
        <a className="button" href={adminEnv.publicSiteUrl} target="_blank" rel="noreferrer">
          Посмотреть сайт ↗
        </a>
      </header>

      {(query.error || error) && (
        <p className="form-message form-error" role="alert">
          {query.error || error?.message}
        </p>
      )}
      {query.saved && (
        <p className="form-message form-success">
          Тексты сохранены в редакционной базе и не будут перезаписаны деплоем.
        </p>
      )}
      {query.published === "started" && (
        <p className="form-message form-success">
          Новая версия сайта собирается. Изменения появятся после публикации.
        </p>
      )}
      {query.published === "queued" && (
        <p className="form-message form-success">
          Изменения сохранены и поставлены в резервную очередь публикации.
        </p>
      )}
      {query.published === "queue-error" && (
        <p className="form-message form-error" role="alert">
          Тексты сохранены, но очередь публикации недоступна. Повторите позже.
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

      <SiteCopyEditor
        definitions={definitions}
        values={values}
        expectedUpdatedAt={data?.[0]?.updated_at}
      />
    </>
  );
}
