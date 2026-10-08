import { requireStaff } from "../../../lib/auth";
import { getPronunciationDraftCatalog } from "../../../lib/pronunciation-catalog";
import { previewPronunciationRequest } from "../../../lib/pronunciation-editor-state";
import { PronunciationDraftEditor } from "../../../components/PronunciationDraftEditor";

export const metadata = { title: "Произношение · черновики", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Same readonly current staff/MFA and public-source guard as journey previews.
 * No Supabase content mutation, service key, publication or source-file write. */
async function previewPronunciationDraftAction(serializedRequest: string): Promise<unknown> {
  "use server";
  try {
    const session = await requireStaff();
    if (!session?.user || session.mfa.checkError) return { ok: false };
    const catalog = getPronunciationDraftCatalog();
    const result = catalog && previewPronunciationRequest(serializedRequest, catalog);
    return result ? JSON.parse(JSON.stringify(result)) : { ok: false };
  } catch { return { ok: false }; }
}

export default async function PronunciationPage() {
  const session = await requireStaff();
  if (!session?.user || session.mfa.checkError) return <p role="alert">Нужна подтверждённая сессия редактора.</p>;
  let catalog;
  try { catalog = getPronunciationDraftCatalog(); } catch { catalog = null; }
  if (!catalog) return <section className="panel"><h1>Произношение · черновики</h1>
    <p role="alert">Канонический каталог сейчас недоступен. Экспорт отключён.</p></section>;
  return <>
    <header className="page-heading"><div><span className="eyebrow">Редактор · RU/EN</span>
      <h1>Словарь произношения</h1><p>Пометки для названий стран, имён писателей и произведений. Каноническое написание сохраняется.</p>
    </div></header>
    <PronunciationDraftEditor catalog={catalog} previewAction={previewPronunciationDraftAction} />
  </>;
}
