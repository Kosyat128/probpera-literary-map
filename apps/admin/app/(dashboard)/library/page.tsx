import { lookupEditionByIsbn, normalizeIsbn } from "@/lib/isbn";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveBookEditionAction } from "./actions";

export const metadata = { title: "Книжный архив" };

type LibrarySearchParams = {
  isbn?: string;
  error?: string;
  saved?: string;
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibrarySearchParams>;
}) {
  const query = await searchParams;
  const requestedIsbn = normalizeIsbn(query.isbn || "");
  const candidate = requestedIsbn
    ? await lookupEditionByIsbn(requestedIsbn).catch(() => null)
    : null;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const [
    { data: worksResult, error: worksError, count: worksCount },
    { data: editionsResult, error: editionsError, count: editionsCount },
    { count: verifiedCoversCount, error: coversError },
  ] = await Promise.all([
    supabase
      .from("literary_works")
      .select(
        "id,title,original_title,writer_id,country_id,editorial_status,metadata",
        { count: "exact" }
      )
      .order("title")
      .limit(5000),
    supabase
      .from("book_editions")
      .select(
        "id,title,isbn_10,isbn_13,publisher,publication_year,language,cover_url,cover_rights_status,is_primary,literary_works(title,metadata)",
        { count: "exact" }
      )
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("book_editions")
      .select("id", { count: "exact", head: true })
      .not("cover_url", "is", null)
      .in("cover_rights_status", [
        "public-domain",
        "licensed",
        "permission",
        "external-preview",
      ]),
  ]);
  const works = worksResult || [];
  const editions = editionsResult || [];
  const schemaError = worksError || editionsError || coversError;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Произведение → точное издание → обложка</span>
          <h1>Книжный архив</h1>
          <p>
            Произведение хранится отдельно от издательских тиражей. Обложка
            привязывается только к точному ISBN, источнику и записи о правах —
            так изображение одного издания не выдаётся за все остальные.
          </p>
        </div>
      </header>

      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && (
        <p className="form-message form-success">Издание сохранено.</p>
      )}
      {schemaError && (
        <p className="form-message">
          Книжные таблицы ещё не применены в Supabase. Сначала выполните
          миграцию 20260730_literary_archive.sql и синхронизацию countries.
        </p>
      )}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Произведения</span>
          <strong>{(worksCount || 0).toLocaleString("ru-RU")}</strong>
          <small>из единой структуры countries</small>
        </article>
        <article className="stat-card">
          <span>Точные издания</span>
          <strong>{(editionsCount || 0).toLocaleString("ru-RU")}</strong>
          <small>с отдельными ISBN</small>
        </article>
        <article className="stat-card">
          <span>Проверенные обложки</span>
          <strong>{(verifiedCoversCount || 0).toLocaleString("ru-RU")}</strong>
          <small>источник и права заполнены</small>
        </article>
        <article className="stat-card">
          <span>Принцип импорта</span>
          <strong>ISBN</strong>
          <small>только точное совпадение</small>
        </article>
      </section>

      <div className="dashboard-grid">
        <section className="panel settings-stack">
          <div>
            <span className="eyebrow">Без угадывания по названию</span>
            <h2>Найти конкретное издание</h2>
            <p>
              Введите ISBN-10 или ISBN-13 с самой книги. Система проверит
              контрольную цифру, найдёт точное совпадение и покажет данные до
              сохранения.
            </p>
          </div>
          <form className="isbn-search" method="get">
            <label className="field">
              <span>ISBN</span>
              <input
                name="isbn"
                defaultValue={requestedIsbn}
                inputMode="numeric"
                placeholder="978517..."
                minLength={10}
                maxLength={20}
                required
              />
            </label>
            <button className="button" type="submit">
              Проверить издание
            </button>
          </form>
          <div className="editorial-note">
            <strong>Почему так безопаснее</strong>
            <p>
              Поиск по одному названию часто возвращает иностранный перевод,
              переиздание или фанатское изображение. ISBN однозначно связывает
              обложку с конкретным издателем и годом.
            </p>
          </div>
        </section>

        <section className="panel">
          <h2>Редакционная политика обложек</h2>
          <div className="status-list">
            <div>
              <span>Редакционная иллюстрация «Пробы Пера»</span>
              <strong>Не считается обложкой издания</strong>
            </div>
            <div>
              <span>Open Library по точному ISBN</span>
              <strong>Внешнее превью</strong>
            </div>
            <div>
              <span>Обложка без источника</span>
              <strong>Не публикуется</strong>
            </div>
            <div>
              <span>Портреты писателей</span>
              <strong>Только реальные</strong>
            </div>
          </div>
        </section>
      </div>

      {requestedIsbn && !candidate && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="empty-state">
            <p>
              Точное издание не найдено либо ISBN не прошёл контрольную
              проверку. Никакая приблизительная обложка подставлена не будет.
            </p>
          </div>
        </section>
      )}

      {candidate && (
        <section className="panel isbn-candidate" style={{ marginTop: 18 }}>
          <div className="isbn-candidate-cover">
            {candidate.coverUrl ? (
              <img
                src={candidate.coverUrl}
                alt={`Обложка точного издания «${candidate.title}»`}
              />
            ) : (
              <span>Обложка в Open Library не найдена</span>
            )}
          </div>
          <div className="isbn-candidate-copy">
            <span className="eyebrow">Совпадение ISBN подтверждено</span>
            <h2>{candidate.title}</h2>
            {candidate.subtitle && <p>{candidate.subtitle}</p>}
            <dl className="edition-facts">
              <div>
                <dt>Автор</dt>
                <dd>{candidate.authors.join(", ") || "Не указан"}</dd>
              </div>
              <div>
                <dt>Издатель</dt>
                <dd>{candidate.publisher || "Не указан"}</dd>
              </div>
              <div>
                <dt>Дата издания</dt>
                <dd>{candidate.publishedDate || "Не указана"}</dd>
              </div>
              <div>
                <dt>ISBN</dt>
                <dd>{candidate.isbn13 || candidate.isbn10}</dd>
              </div>
            </dl>
            <form
              className="settings-stack edition-save-form"
              action={saveBookEditionAction}
            >
              <label className="field">
                <span>Связать с произведением</span>
                <select name="work_id" required defaultValue="">
                  <option value="" disabled>
                    Выберите произведение
                  </option>
                  {works.map((work) => {
                    const metadata =
                      work.metadata && typeof work.metadata === "object"
                        ? (work.metadata as Record<string, string>)
                        : {};
                    return (
                      <option key={work.id} value={work.id}>
                        {work.title} — {metadata.writerName || work.writer_id}
                      </option>
                    );
                  })}
                </select>
              </label>
              <input type="hidden" name="title" value={candidate.title} />
              <input
                type="hidden"
                name="isbn_10"
                value={candidate.isbn10 || ""}
              />
              <input
                type="hidden"
                name="isbn_13"
                value={candidate.isbn13 || ""}
              />
              <input
                type="hidden"
                name="publisher"
                value={candidate.publisher}
              />
              <input
                type="hidden"
                name="publication_year"
                value={candidate.publicationYear || ""}
              />
              <input
                type="hidden"
                name="language"
                value={candidate.language}
              />
              <input
                type="hidden"
                name="page_count"
                value={candidate.pageCount || ""}
              />
              <input
                type="hidden"
                name="cover_url"
                value={candidate.coverUrl || ""}
              />
              <input
                type="hidden"
                name="cover_source_url"
                value={candidate.coverUrl ? candidate.openLibraryUrl : ""}
              />
              <input
                type="hidden"
                name="source_url"
                value={candidate.googleBooksUrl || candidate.openLibraryUrl}
              />
              <label className="check-field">
                <input type="checkbox" name="is_primary" />
                <span>Сделать основным изданием произведения</span>
              </label>
              <button className="button" type="submit" disabled={!works.length}>
                Сохранить точное издание
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 18 }}>
        <h2>Последние издания</h2>
        {editions.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Произведение / издание</th>
                <th>ISBN</th>
                <th>Издатель</th>
                <th>Обложка</th>
              </tr>
            </thead>
            <tbody>
              {editions.map((edition) => {
                const work = Array.isArray(edition.literary_works)
                  ? edition.literary_works[0]
                  : edition.literary_works;
                return (
                  <tr key={edition.id}>
                    <td className="data-title">
                      <strong>{work?.title || edition.title}</strong>
                      <small>
                        {edition.publication_year || "год не указан"} ·{" "}
                        {edition.language || "язык не указан"}
                      </small>
                    </td>
                    <td>{edition.isbn_13 || edition.isbn_10 || "—"}</td>
                    <td>{edition.publisher || "—"}</td>
                    <td>
                      <span className="badge">
                        {edition.cover_url
                          ? edition.cover_rights_status
                          : "нет обложки"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <p>Точные издания появятся после первого импорта ISBN.</p>
          </div>
        )}
      </section>
    </>
  );
}
