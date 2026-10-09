import { z } from "zod";
import { isReadRecord, isReadRecordList } from "@/lib/admin-read-result";

export type SeoRedirectRecord = {
  id: string; source_path: string; destination_path: string; status_code: number;
  is_active: boolean; created_at: string; updated_at: string;
};
export type SeoIssueRecord = {
  id: string; title: string; seo_title: string | null;
  seo_description: string | null; canonical_url: string | null;
};

// SQL uuid accepts all versions; read historical identities without rewriting them.
function isSqlUuid(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value);
}
function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
function nullableText(value: unknown, max?: number): boolean {
  return value === null || typeof value === "string" && (max === undefined || Array.from(value).length <= max);
}
export function isSeoRedirectList(value: unknown): value is SeoRedirectRecord[] {
  return isReadRecordList(value) && value.every((row) =>
    isSqlUuid(row.id) && typeof row.source_path === "string" && row.source_path.startsWith("/")
    && typeof row.destination_path === "string"
    && (row.destination_path.startsWith("/") || row.destination_path.startsWith("https://"))
    && typeof row.status_code === "number" && [301, 302, 307, 308].includes(row.status_code)
    && typeof row.is_active === "boolean" && isTimestamp(row.created_at) && isTimestamp(row.updated_at))
    && new Set(value.map((row) => String(row.id).toLowerCase())).size === value.length;
}
export function isSeoIssueList(value: unknown): value is SeoIssueRecord[] {
  return isReadRecordList(value) && value.every((row) =>
    isSqlUuid(row.id) && typeof row.title === "string"
    && Array.from(row.title).length >= 3 && Array.from(row.title).length <= 240
    && nullableText(row.seo_title, 180) && nullableText(row.seo_description, 400)
    && nullableText(row.canonical_url))
    && new Set(value.map((row) => String(row.id).toLowerCase())).size === value.length;
}

// Keep the existing action identity contract; an unsupported legacy identity is readable only.
const actionIdentity = z.object({ id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }) });
export function canEditSeoRedirect(value: SeoRedirectRecord): boolean {
  return isReadRecord(value) && actionIdentity.safeParse(value).success;
}
