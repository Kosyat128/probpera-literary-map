import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BookDossierRecord } from "../../../../../../src/books/bookDossierDocument";
import { BookDossierEditor } from "./BookDossierEditor";

export const metadata = { title: "Редакционные досье книг", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function BookDossiersPage({ searchParams }: { searchParams: Promise<{ book?: string; locale?: string }> }) {
  const session = await requireStaff();
  if (!session?.user) return <p role="alert">Нужна сессия редактора.</p>;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const result = supabase ? await supabase.from("book_dossiers").select("book_key,locale,revision,record").order("updated_at", { ascending: false }).limit(50) : null;
  const requested = supabase && query.book ? await supabase.from("book_dossiers").select("book_key,locale,record").eq("book_key", query.book).eq("locale", query.locale || "ru").maybeSingle() : null;
  const selected = requested?.data;
  return <>
    <header className="page-heading"><div><span className="eyebrow">Книжный архив</span><h1>Редакционные досье</h1>
      <p>Конечные разделы для чтения на сайте и в 3D. Факты, права, перевод и качество подтверждаются отдельно. Полные тексты, цитаты и сторонние изображения здесь не публикуются.</p>
      <Link href="/library">К произведениям и изданиям</Link></div></header>
    {!result || result.error ? <p role="alert" className="form-message">Хранилище досье пока недоступно. Для этого раздела требуется миграция book_dossiers_v2; существующий каталог продолжает работать.</p> : <>
      <nav aria-label="Последние досье"><Link href="/library/dossiers">Новое досье</Link>{result.data.map(row => <p key={`${row.book_key}:${row.locale}`}><Link href={`/library/dossiers?book=${encodeURIComponent(row.book_key)}&locale=${row.locale}`}>{row.record?.draft?.title || row.book_key} ({row.locale})</Link> · {row.record?.status} · v{row.revision}</p>)}</nav>
      {query.book && (!selected || requested?.error) ? <p role="alert">Запрошенное досье не найдено или недоступно. Обновите список.</p> : <BookDossierEditor key={`${selected?.book_key || "new"}:${selected?.locale || "ru"}`} initial={(selected?.record || null) as BookDossierRecord | null} canPublish={session.role !== "editor"} />}
    </>}
  </>;
}
