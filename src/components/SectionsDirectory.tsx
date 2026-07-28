import type { CSSProperties } from "react";

import { articleCatalog } from "../data/articles/catalog.generated";

export type SiteSectionLink = {
  id: string;
  group: string;
  title: string;
  copy: string;
  href: string;
  image: string;
};

type Props = {
  sections: SiteSectionLink[];
  countryCount: number;
  bookCount: number;
};

function mediaUrl(path: string) {
  return /^https?:\/\//i.test(path)
    ? path
    : `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function publicationLabel(count: number) {
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
  return `${count} ${form}`;
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
}: Props) {
  return (
    <div className="sections-directory-grid">
      {sections.map((section) => {
        const publications = articleCatalog.filter(
          (article) => article.sectionId === section.id
        );
        const latest = publications.reduce<(typeof publications)[number] | undefined>(
          (current, article) =>
            !current ||
            publicationTime(article.publishedLabel) >
              publicationTime(current.publishedLabel)
              ? article
              : current,
          undefined
        );
        const liveLabel =
          section.id === "atlas"
            ? `${countryCount} стран`
            : section.id === "books"
              ? `${bookCount.toLocaleString("ru-RU")} книг и произведений`
              : section.id === "calendar"
                ? "События на каждый день"
                : publicationLabel(publications.length);

        return (
          <a
            href={section.href}
            key={section.id}
            style={
              {
                "--section-art": `url(${mediaUrl(section.image)})`,
              } as CSSProperties
            }
          >
            <div>
              <span>{section.group} · {liveLabel}</span>
              <h3>{section.title}</h3>
              <p>{section.copy}</p>
              {latest && (
                <small className="section-card-latest">
                  Новое: {latest.title}
                </small>
              )}
              <i aria-hidden="true">→</i>
            </div>
          </a>
        );
      })}
    </div>
  );
}
