import { useMemo, useState, type CSSProperties, type MouseEvent } from "react";

import { articleCatalog } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  articlePath,
  journalPath,
  navigateToJournal,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import {
  articleSeriesId,
  articleSeriesLabel,
} from "../utils/articleSeries";
import BrandArrowIcon from "./BrandArrowIcon";

export type SiteSectionLink = {
  id: string;
  group: string;
  title: string;
  copy: string;
  href: string;
  image: string;
  articleSections?: readonly string[];
  action?: "forum" | "account";
  metric?: "all-articles" | "writers" | "community" | "account" | "project";
};

type Props = {
  sections: SiteSectionLink[];
  countryCount: number;
  bookCount: number;
  writerCount: number;
  onAction?: (action: "forum" | "account") => void;
};

function mediaUrl(path: string) {
  return /^https?:\/\//i.test(path)
    ? path
    : `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function publicationLabel(count: number, formattedCount = String(count)) {
  const lastTwo = count % 100;
  const last = count % 10;
  const form =
    lastTwo >= 11 && lastTwo <= 14
      ? "публикаций"
      : last === 1
        ? "публикация"
        : last >= 2 && last <= 4
          ? "публикации"
          : "публикаций";
  return `${formattedCount} ${form}`;
}

function workLabel(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  const form =
    lastTwo >= 11 && lastTwo <= 14
      ? "произведений"
      : last === 1
        ? "произведение"
        : last >= 2 && last <= 4
          ? "произведения"
          : "произведений";
  return `${count} ${form} в архиве`;
}

function localizedWorkLabel(count: number, formattedCount: string) {
  return workLabel(count).replace(String(count), formattedCount);
}

export function sectionActionKind(
  section: Pick<SiteSectionLink, "id" | "action" | "metric">,
  publicationCount: number
) {
  if (section.id === "atlas") return "explore" as const;
  if (section.id === "calendar") return "view" as const;
  if (
    section.id === "books" ||
    section.metric === "writers" ||
    section.metric === "community" ||
    section.metric === "account" ||
    section.metric === "project" ||
    section.action
  ) {
    return "open" as const;
  }
  return publicationCount > 0 ? ("read" as const) : ("open" as const);
}

const directoryGatewayIds = new Set(["atlas", "books", "calendar"]);

export function featuredSectionIds(
  sections: readonly Pick<SiteSectionLink, "id" | "action" | "metric">[]
) {
  const featured = sections.filter(
    (section) =>
      directoryGatewayIds.has(section.id) || Boolean(section.metric || section.action)
  );

  // A small custom catalogue can omit metrics entirely. In that case keeping
  // its original order is clearer than unexpectedly hiding arbitrary links.
  return (featured.length ? featured : sections).map((section) => section.id);
}

const russianMonths: Record<string, number> = {
  ЯНВАРЯ: 0,
  ФЕВРАЛЯ: 1,
  МАРТА: 2,
  АПРЕЛЯ: 3,
  МАЯ: 4,
  ИЮНЯ: 5,
  ИЮЛЯ: 6,
  АВГУСТА: 7,
  СЕНТЯБРЯ: 8,
  ОКТЯБРЯ: 9,
  НОЯБРЯ: 10,
  ДЕКАБРЯ: 11,
};

function publicationTime(label: string) {
  const match = label.toUpperCase().match(/(\d{1,2})\s+([А-ЯЁ]+)\s+(\d{4})/u);
  if (!match) return 0;
  const month = russianMonths[match[2]];
  return month === undefined
    ? 0
    : new Date(Number(match[3]), month, Number(match[1])).getTime();
}

export default function SectionsDirectory({
  sections,
  countryCount,
  bookCount,
  writerCount,
  onAction,
}: Props) {
  const { language, t, number } = useInterfaceLanguage();
  const [showAllSections, setShowAllSections] = useState(false);
  const sectionCards = useMemo(() => {
    const usedRecommendations = new Set<string>();
    const localizedCatalog = articleCatalog.flatMap((article) => {
      const localized = articleCatalogEntryForLanguage(article, language);
      return localized ? [localized] : [];
    });

    return sections.map((section) => {
      const articleSectionIds = section.articleSections || [section.id];
      const publications =
        section.metric === "all-articles"
          ? localizedCatalog
          : localizedCatalog.filter((article) =>
              articleSectionIds.includes(article.sectionId)
            );
      const sorted = [...publications].sort(
        (first, second) =>
          (second.publishedAt
            ? new Date(second.publishedAt).getTime()
            : publicationTime(second.publishedLabel)) -
          (first.publishedAt
            ? new Date(first.publishedAt).getTime()
            : publicationTime(first.publishedLabel))
      );
      const latest =
        sorted.find((article) => !usedRecommendations.has(article.id)) ||
        sorted[0];
      if (latest) usedRecommendations.add(latest.id);
      const series =
        section.metric === "all-articles"
          ? []
          : [
              ...new Map(
                publications.map((article) => {
                  const id = articleSeriesId(article);
                  return [
                    id,
                    {
                      id,
                      label: articleSeriesLabel(
                        id,
                        article.sectionLabel,
                        language
                      ),
                    },
                  ];
                })
              ).values(),
            ];
      return { section, publications, latest, series };
    });
  }, [language, sections]);
  const featuredIds = useMemo(
    () => new Set(featuredSectionIds(sections)),
    [sections]
  );
  const visibleSectionCards = showAllSections
    ? sectionCards
    : sectionCards.filter(({ section }) => featuredIds.has(section.id));
  const hiddenSectionCount = sectionCards.length - visibleSectionCards.length;

  return (
    <div className="sections-directory-grid" id="sections-directory-list">
      {visibleSectionCards.map(({ section, publications, latest, series }) => {
        const liveLabel =
          section.id === "atlas"
            ? language === "en"
              ? `${number(countryCount)} countries`
              : `${number(countryCount)} стран`
            : section.id === "books"
              ? language === "en"
                ? `${number(bookCount)} works in the archive`
                : localizedWorkLabel(bookCount, number(bookCount))
              : section.id === "calendar"
                ? t("События на каждый день")
                : section.metric === "writers"
                  ? language === "en"
                    ? `${number(writerCount)} writers`
                    : `${number(writerCount)} авторов`
                  : section.metric === "community"
                    ? t("Форум, оценки и обсуждения")
                    : section.metric === "account"
                      ? t("Профиль и личная библиотека")
                      : section.metric === "project"
                        ? t("Редакция, источники и правила")
                : language === "en"
                  ? `${number(publications.length)} ${
                      publications.length === 1
                        ? "publication"
                        : "publications"
                    }`
                  : publicationLabel(
                      publications.length,
                      number(publications.length)
                    );
        const actionKind = sectionActionKind(section, publications.length);
        const actionLabel =
          actionKind === "read"
            ? t("Читать")
            : actionKind === "explore"
              ? t("Исследовать")
              : actionKind === "view"
                ? t("Смотреть")
                : t("Открыть");

        const handleSectionClick = (
          event: MouseEvent<HTMLAnchorElement>
        ) => {
          if (section.action) {
            event.preventDefault();
            onAction?.(section.action);
            return;
          }
          const journalSectionId =
            section.id === "journal" ? "all" : section.id;
          if (
            section.href === journalPath(journalSectionId) &&
            shouldUseClientNavigation(event)
          ) {
            event.preventDefault();
            navigateToJournal(journalSectionId);
          }
        };

        return (
          <article
            className="section-directory-card"
            key={section.id}
            style={
              {
                "--section-art": `url(${mediaUrl(section.image)})`,
              } as CSSProperties
            }
          >
            <div>
              <span className="section-card-eyebrow">
                {latest ? t("Новое") : t(section.group)}
              </span>
              <h3>
                <a href={section.href} onClick={handleSectionClick}>
                  {t(section.title)}
                </a>
              </h3>
              <p>{t(section.copy)}</p>
              <div className="section-card-series-slot">
                {series.length > 1 && (
                  <nav
                    className="section-card-series"
                    aria-label={`${t("Рубрики")}: ${t(section.title)}`}
                  >
                    {series.map((item) => (
                      <a
                        key={item.id}
                        href={journalPath(section.id, item.id)}
                        onClick={(event) => {
                          if (!shouldUseClientNavigation(event)) return;
                          event.preventDefault();
                          navigateToJournal(section.id, false, item.id);
                        }}
                      >
                        {t(item.label)}
                      </a>
                    ))}
                  </nav>
                )}
              </div>
              <div className="section-card-latest-slot">
                {latest && (
                  <a
                    className="section-card-latest"
                    href={articlePath(
                      latest.id,
                      latest.title,
                      latest.sectionId,
                      latest.slug
                    )}
                    aria-label={`${t("Статья по теме")}: ${latest.title}`}
                  >
                    <span>{t("Статья по теме")}</span>
                    <strong>{latest.title}</strong>
                  </a>
                )}
              </div>
              <footer className="section-card-action">
                <a href={section.href} onClick={handleSectionClick}>
                  <strong>
                    {actionLabel} <span aria-hidden="true">·</span> {liveLabel}
                  </strong>
                  <i aria-hidden="true">
                    <BrandArrowIcon />
                  </i>
                </a>
              </footer>
            </div>
          </article>
        );
      })}
      {!showAllSections && hiddenSectionCount > 0 && (
        <button
          className="section-directory-more"
          type="button"
          aria-controls="sections-directory-list"
          aria-expanded="false"
          onClick={() => setShowAllSections(true)}
        >
          <span>
            {language === "en" ? "Show all sections" : "Показать все разделы"}
          </span>
          <strong>+{number(hiddenSectionCount)}</strong>
          <BrandArrowIcon />
        </button>
      )}
    </div>
  );
}
