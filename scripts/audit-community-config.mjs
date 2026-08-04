import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const requireEnvironment = process.argv.includes("--require-env");

const requiredSql = new Map([
  [
    "supabase/schema.sql",
    [
      "create table public.profiles",
      "create table public.forum_topics",
      "create table public.forum_replies",
      "create table public.article_comments",
      "create table public.ratings",
      "alter table public.profiles enable row level security",
    ],
  ],
  [
    "supabase/migrations/20260801_reader_profiles_and_forum_votes.sql",
    ["community_votes"],
  ],
  [
    "supabase/migrations/20260801_forum_reports.sql",
    ["forum_reports"],
  ],
  [
    "supabase/migrations/20260802_reader_journey.sql",
    ["reader_subscriptions", "reader_progress", "reader_notifications"],
  ],
  [
    "supabase/migrations/20260728_cms_foundation.sql",
    ["staff_memberships", "is_staff", "set_updated_at"],
  ],
  [
    "supabase/migrations/20260730_literary_archive.sql",
    ["literary_works", "book_editions", "cover_rights_status"],
  ],
  [
    "supabase/migrations/20260802_client_errors.sql",
    ["client_errors", "submit_client_error"],
  ],
  [
    "supabase/migrations/20260802_editor_templates.sql",
    ["editor_templates"],
  ],
  [
    "supabase/migrations/20260803_public_article_view_counts.sql",
    ["get_content_view_count", "grant execute"],
  ],
  [
    "supabase/migrations/20260804_content_analytics.sql",
    ["previous_path", "navigation_source", "utm_source"],
  ],
]);

const failures = [];

for (const [relativePath, markers] of requiredSql) {
  const absolutePath = path.join(projectRoot, relativePath);
  let sql = "";
  try {
    sql = (await readFile(absolutePath, "utf8")).toLowerCase();
  } catch {
    failures.push(`Отсутствует обязательный SQL-файл: ${relativePath}`);
    continue;
  }

  for (const marker of markers) {
    if (!sql.includes(marker.toLowerCase())) {
      failures.push(`${relativePath}: не найден объект ${marker}`);
    }
  }
}

if (requireEnvironment) {
  const url = String(process.env.VITE_SUPABASE_URL || "").trim();
  const publishableKey = String(
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ""
  ).trim();

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/iu.test(url)) {
    failures.push("VITE_SUPABASE_URL отсутствует или имеет неверный формат");
  }
  if (
    !publishableKey ||
    (!publishableKey.startsWith("sb_publishable_") &&
      publishableKey.split(".").length !== 3)
  ) {
    failures.push(
      "VITE_SUPABASE_PUBLISHABLE_KEY отсутствует или не является publishable/anon-ключом"
    );
  }

  if (publishableKey.split(".").length === 3) {
    try {
      const payload = JSON.parse(
        Buffer.from(publishableKey.split(".")[1], "base64url").toString("utf8")
      );
      if (payload.role === "service_role") {
        failures.push("В публичную сборку передан секретный service_role-ключ");
      }
    } catch {
      failures.push("Публичный JWT-ключ Supabase повреждён");
    }
  }
}

if (failures.length > 0) {
  console.error("Проверка регистрации и форума не пройдена:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Сообщество и редакционная система: структура проверена${
      requireEnvironment ? ", публичная конфигурация присутствует" : ""
    }.`
  );
}
