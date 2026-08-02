import { useMemo, useState } from "react";

import type { Country, Writer } from "../data/countries";
import { articleCatalog } from "../data/articles/catalog";
import { nobelYearArticles } from "../data/articles/nobelArticles";
import { collectNobelLaureates } from "../data/nobel";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { articlePath } from "../utils/articleRoutes";

type Props = {
  countries: Country[];
  onLaureateSelect: (country: Country, writer: Writer) => void;
};

type ArchiveYear = {
  year: number;
  laureates: ReturnType<typeof collectNobelLaureates>;
  article: (typeof nobelYearArticles)[number]["article"] | null;
};

const NO_AWARD_YEARS = [1914, 1918, 1935, 1940, 1941, 1942, 1943];
const nobelPortraitUrl = `${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`;

function laureateName(writer: Writer) {
  return writer.name || writer.fullName || "Лауреат";
}

export default function NobelArchiveStrip({ countries, onLaureateSelect }: Props) {
  const { t } = useInterfaceLanguage();
  const [activeDecade, setActiveDecade] = useState<number | "all">("all");
  const introduction = articleCatalog.find(
    (article) => article.id === "page--article--nobel--prize--1"
  );

  const laureates = useMemo(() => collectNobelLaureates(countries), [countries]);
  const archiveYears = useMemo(() => {
    const byYear = new Map<number, ArchiveYear>();
    const articles = new Map(
      nobelYearArticles.map(({ article, year }) => [year, article])
    );

    for (const laureate of laureates) {
      const record = byYear.get(laureate.year) || {
        year: laureate.year,
        laureates: [],
        article: articles.get(laureate.year) || null,
      };
      record.laureates.push(laureate);
      byYear.set(laureate.year, record);
    }

    return [...byYear.values()].sort((first, second) => first.year - second.year);
  }, [laureates]);
  const decades = useMemo(
    () => [...new Set(archiveYears.map(({ year }) => Math.floor(year / 10) * 10))],
    [archiveYears]
  );
  const visibleYears =
    activeDecade === "all"
      ? archiveYears
      : archiveYears.filter(
          ({ year }) => Math.floor(year / 10) * 10 === activeDecade
        );

  return (
    <section className="nobel-archive-strip" aria-label={t("Нобелевский архив")}>
      <header>
        <span className="nobel-archive-medal" aria-hidden="true">
          <img src={nobelPortraitUrl} alt="" />
        </span>
        <div>
          <small>{t("Редакционная серия")}</small>
          <strong>{t("Лауреаты Нобелевской премии · 1901–2025")}</strong>
          <p>
            {t(
              `${laureates.length} лауреата, ${archiveYears.length} присуждений. Годы с готовыми материалами ведут к статье журнала; остальные имена открывают биографию в энциклопедии.`
            )}
          </p>
        </div>
        {introduction && (
          <a
            className="nobel-archive-intro"
            href={articlePath(
              introduction.id,
              introduction.title,
              introduction.sectionId,
              introduction.slug
            )}
          >
            {t("История премии")} <span>→</span>
          </a>
        )}
      </header>

      <div className="nobel-archive-decades" aria-label={t("Период архива")}>
        <button
          className={activeDecade === "all" ? "is-active" : ""}
          type="button"
          onClick={() => setActiveDecade("all")}
        >
          {t("Все годы")}
        </button>
        {decades.map((decade) => (
          <button
            className={activeDecade === decade ? "is-active" : ""}
            type="button"
            key={decade}
            onClick={() => setActiveDecade(decade)}
          >
            {decade}-е
          </button>
        ))}
      </div>

      <nav aria-label={t("Лауреаты по годам")}>
        {visibleYears.map(({ article, laureates: yearLaureates, year }) => (
          <article
            className={`nobel-archive-year${article ? " has-article" : ""}`}
            key={year}
          >
            {article ? (
              <a
                className="nobel-year-article"
                href={articlePath(
                  article.id,
                  article.title,
                  article.sectionId,
                  article.slug
                )}
                title={article.title}
              >
                <strong>{year}</strong>
                <small>{t("Статья журнала")}</small>
              </a>
            ) : (
              <strong>{year}</strong>
            )}
            <div>
              {yearLaureates.map(({ country, writer }) => (
                <button
                  type="button"
                  key={`${country.id}:${writer.id}`}
                  title={`${laureateName(writer)} · ${country.name}`}
                  onClick={() => onLaureateSelect(country, writer)}
                >
                  <span>{laureateName(writer)}</span>
                  <small>{country.name}</small>
                </button>
              ))}
            </div>
          </article>
        ))}
      </nav>
      <footer>
        <span>
          {t("Премия не присуждалась: ")}
          {NO_AWARD_YEARS.join(", ")}.
        </span>
        <a
          href="https://www.nobelprize.org/prizes/lists/all-nobel-prizes-in-literature/"
          target="_blank"
          rel="noreferrer"
        >
          {t("Сверено с официальным архивом")} ↗
        </a>
      </footer>
    </section>
  );
}
