import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { adminReadMessage, isReadRecord, readAdminList, readAdminResult } from "@/lib/admin-read-result";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BookDossierRecord } from "../../../../../../src/books/bookDossierDocument";
import { validateBookDossierDraft } from "../../../../../../src/books/bookDossierValidation";
import { BookDossierEditor } from "./BookDossierEditor";

export const metadata = { title: "Редакционные досье книг", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type DossierRow = { book_key: string; locale: "ru" | "en"; revision: number; record: BookDossierRecord };
type DossierQuery = { book?: string; locale?: string };
const dossierStatuses = ["DRAFT", "FACT_REVIEW", "RIGHTS_REVIEW", "EDITORIAL_REVIEW", "DESIGN_REVIEW", "ACCESSIBILITY_REVIEW", "READY", "PUBLISHED", "RE_REVIEW_REQUIRED", "BLOCKED", "ARCHIVED"];
const reviewStages = ["facts", "rights", "editorial", "design", "accessibility", "final"];
const auditActions = ["CREATE", "EDIT", "REVIEW", "PUBLISH", "REVOKE", "ARCHIVE"];
const text = (value: unknown): value is string => typeof value === "string";
const date = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));
const digest = (value: unknown) => text(value) && /^[a-f0-9]{64}$/u.test(value);
const positiveRevision = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function isBookKey(value: unknown): value is string {
  return text(value) && value.length <= 240 && value.split(":").length === 3
    && /^[^\s<>/?#\\:]+:[^\s<>/?#\\:]+:[^\s<>/?#\\:]+$/u.test(value);
}

function isDesignProof(value: unknown): boolean {
  return isReadRecord(value) && value.version === "book-dossier-design-v1"
    && digest(value.contentChecksum) && text(value.fontVersion) && text(value.layoutVersion)
    && date(value.measuredAt) && value.method === "CANVAS_LOCAL_FONTS"
    && Array.isArray(value.variantPages) && value.variantPages.length <= 128
    && value.variantPages.every((page) => isReadRecord(page) && text(page.id)
      && typeof page.pageCount === "number" && Number.isSafeInteger(page.pageCount) && page.pageCount > 0);
}

function isDossierReview(value: unknown): boolean {
  return isReadRecord(value) && text(value.stage) && reviewStages.includes(value.stage)
    && text(value.actorId) && value.actorKind === "HUMAN" && date(value.reviewedAt)
    && text(value.dossierVersion) && digest(value.contentChecksum)
    && (value.decision === "APPROVED" || value.decision === "CHANGES_REQUIRED")
    && (value.designProof === undefined || isDesignProof(value.designProof));
}

function isDossierAudit(value: unknown): boolean {
  return isReadRecord(value) && text(value.id) && text(value.actorId) && date(value.at)
    && text(value.action) && auditActions.includes(value.action) && text(value.reason)
    && (value.previousChecksum === null || digest(value.previousChecksum)) && digest(value.contentChecksum);
}

// Read validation preserves the exact record object. It does not approve rights,
// rewrite prose, advance a revision, or replace the authoritative action/CAS gates.
function isDossierRow(row: DossierRow): boolean {
  const record: unknown = row.record;
  if (!isBookKey(row.book_key) || !["ru", "en"].includes(row.locale) || !positiveRevision(row.revision)
    || !isReadRecord(record) || !positiveRevision(record.revision) || record.revision !== row.revision
    || !text(record.status) || !dossierStatuses.includes(record.status) || !digest(record.contentChecksum)
    || !Array.isArray(record.reviews) || record.reviews.length > 6 || !record.reviews.every(isDossierReview)
    || !Array.isArray(record.audit) || record.audit.length > 256 || !record.audit.every(isDossierAudit)) return false;
  const { draft } = validateBookDossierDraft(record.draft, undefined, true);
  return draft !== null && draft.bookKey === row.book_key && draft.locale === row.locale;
}

function retryPath(query: DossierQuery): string {
  const params = new URLSearchParams();
  if (text(query.book) && query.book) params.set("book", query.book);
  if (text(query.locale) && query.locale) params.set("locale", query.locale);
  const queryString = params.toString();
  return `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/library/dossiers${queryString ? `?${queryString}` : ""}`;
}

export default async function BookDossiersPage({ searchParams }: { searchParams: Promise<DossierQuery> }) {
  const session = await requireStaff();
  if (!session?.user) return <p role="alert">Нужна сессия редактора.</p>;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const retryHref = retryPath(query);
  const hasSelection = Boolean(query.book);
  const queryValid = (!hasSelection || isBookKey(query.book)) && (!query.locale || ["ru", "en"].includes(query.locale));
  const locale = query.locale || "ru";
  const reads = supabase ? await Promise.allSettled([
    supabase.from("book_dossiers").select("book_key,locale,revision,record").order("updated_at", { ascending: false }).limit(50),
    hasSelection && queryValid
      ? supabase.from("book_dossiers").select("book_key,locale,revision,record").eq("book_key", query.book).eq("locale", locale).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ] as const) : null;
  const listRead = readAdminList<DossierRow>(reads?.[0] ?? { status: "rejected", reason: null }, isDossierRow);
  const selectedRead = readAdminResult<DossierRow | null>(reads?.[1] ?? { status: "rejected", reason: null },
    (data) => data === null || (isReadRecord(data) && isDossierRow(data as DossierRow)
      && data.book_key === query.book && data.locale === locale));
  const selected = selectedRead.status === "success" ? selectedRead.data : null;
  const canEdit = queryValid && listRead.status === "success"
    && (!hasSelection || selectedRead.status === "success" && selected !== null);
  const hasUnavailableRead = listRead.status === "failed" || hasSelection && selectedRead.status === "failed";

  return <>
    <header className="page-heading"><div><span className="eyebrow">Библиотека «Проба Пера»</span><h1>Редакционные досье</h1>
      <p>Конечные разделы для чтения на сайте и в 3D. Факты, права, перевод и качество подтверждаются отдельно. Полные тексты, цитаты и сторонние изображения здесь не публикуются.</p>
      <Link href="/library">К произведениям и изданиям</Link></div></header>
    {hasUnavailableRead && <section className="panel" role="alert">
      <p>Данные досье сейчас недоступны. Изменение закрыто до успешной загрузки. <a href={retryHref}>Повторить загрузку</a></p>
      {listRead.status === "failed" && <p>Список досье недоступен. {adminReadMessage(listRead.issue)}</p>}
      {hasSelection && selectedRead.status === "failed" && <p>Выбранное досье недоступно. {adminReadMessage(selectedRead.issue)}</p>}
    </section>}
    {listRead.status === "success" && <nav aria-label="Последние досье">
      <Link href="/library/dossiers">Новое досье</Link>
      {listRead.data.length === 0 && <p>Досье ещё не зарегистрированы.</p>}
      {listRead.data.map((row) => <p key={`${row.book_key}:${row.locale}`}><Link href={`/library/dossiers?book=${encodeURIComponent(row.book_key)}&locale=${row.locale}`}>{row.record.draft.title || row.book_key} ({row.locale})</Link> · {row.record.status} · v{row.revision}</p>)}
    </nav>}
    {!queryValid && <p role="alert">Проверьте ключ произведения и язык. <a href={retryHref}>Повторить загрузку</a></p>}
    {queryValid && hasSelection && selectedRead.status === "success" && !selected && <p role="alert">Досье не найдено или недоступно. <a href={retryHref}>Повторить загрузку</a></p>}
    {listRead.status === "failed" && selected && <section className="panel" aria-label="Загруженное досье"><h2>{selected.record.draft.title}</h2><p>{selected.record.status} · v{selected.revision}. Редактирование закрыто до загрузки списка.</p></section>}
    {canEdit && <BookDossierEditor key={`${selected?.book_key || "new"}:${selected?.locale || "ru"}`} initial={selected?.record || null} canPublish={session.role !== "editor"} />}
  </>;
}
