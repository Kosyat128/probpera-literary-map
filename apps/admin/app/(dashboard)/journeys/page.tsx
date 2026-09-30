import { requireStaff } from "@/lib/auth";
import { getBookyJourneyDraftCatalog } from "@/lib/booky-journey-catalog";
import { BookyJourneyDraftEditor } from "@/components/BookyJourneyDraftEditor";

export const metadata = {
  title: "Маршруты Книжулика · черновики",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BookyJourneysPage() {
  const session = await requireStaff();
  if (!session?.user) return <p role="alert">Нужна сессия редактора.</p>;
  let catalog;
  try {
    catalog = getBookyJourneyDraftCatalog();
  } catch {
    return <section className="panel"><h1>Маршруты Книжулика · черновики</h1>
      <p role="alert" className="form-message">Канонический каталог маршрутов сейчас недоступен. Экспорт отключён.</p>
    </section>;
  }
  return <>
    <header className="page-heading"><div><span className="eyebrow">Книжулик · редактор</span>
      <h1>Маршруты Книжулика</h1>
      <p>Соберите простой путь: страна → писатель → книга → завершение. Тексты RU и EN обязательны.</p>
    </div></header>
    <BookyJourneyDraftEditor catalog={catalog} />
  </>;
}
