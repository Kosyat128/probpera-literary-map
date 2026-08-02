import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { articleCatalog } from "../data/articles/catalog";
import {
  findNobelArticle,
  getNobelYear,
  isNobelLaureate,
} from "../data/articles/nobelArticles";
import type { Country, Writer } from "../data/countries";
import { articlePath } from "../utils/articleRoutes";
import CountryFlagIcon from "./CountryFlagIcon";
import { getWriterWorkTitles } from "../data/bookArchive";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { useSubscriptions } from "../hooks/useSubscriptions";
import BrandCloseIcon from "./BrandCloseIcon";
import WriterPortrait from "./WriterPortrait";

const nobelPortraitUrl = `${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`;

type WriterPanelProps = {
  country: Country;
  selectedWriter?: Writer | null;
  onWriterSelect?: (writer: Writer) => void;
  nobelSpotlightActive?: boolean;
  onNobelSpotlightToggle?: () => void;
  onClose?: () => void;
};

function getWriterName(writer: Writer) {
  return writer.name || writer.fullName || "Неизвестный автор";
}

function getWriterYear(writer: Writer) {
  const source = writer.birthDate || writer.birth || writer.years || "";
  const match = source.match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
}

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function relatedArticlesFor(writer: Writer) {
  const nameParts = getWriterName(writer)
    .toLocaleLowerCase("ru")
    .replace(/[^\p{L}\s-]/gu, " ")
    .split(/\s+/)
    .filter((part) => part.length >= 4);
  const surname = nameParts[nameParts.length - 1];
  if (!surname) return [];
  return articleCatalog
    .filter((article) =>
      `${article.title} ${article.description}`
        .toLocaleLowerCase("ru")
        .includes(surname)
    )
    .slice(0, 4);
}

export default function WriterPanel({
  country,
  selectedWriter,
  onWriterSelect,
  nobelSpotlightActive = false,
  onNobelSpotlightToggle,
  onClose,
}: WriterPanelProps) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const { toggle: toggleSubscription, isSubscribed } = useSubscriptions();
  const panelRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const writers = country.writers || [];
  const [localSelected, setLocalSelected] = useState<Writer | null>(writers[0] || null);

  useEffect(() => {
    const firstWriter = country.writers?.[0] || null;
    setLocalSelected(firstWriter);
    if (firstWriter && selectedWriter === undefined) onWriterSelect?.(firstWriter);
  }, [country.id, country.writers, onWriterSelect, selectedWriter]);

  const activeWriter = selectedWriter ?? localSelected ?? writers[0] ?? null;

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const animation = gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0, x: 42 },
      { autoAlpha: 1, x: 0, duration: 0.7, ease: "power3.out", clearProps: "transform" }
    );
    return () => {
      animation.kill();
    };
  }, [country.id]);

  useLayoutEffect(() => {
    if (!detailRef.current || !activeWriter) return;
    const animation = gsap.fromTo(
      detailRef.current,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out" }
    );
    return () => {
      animation.kill();
    };
  }, [activeWriter?.id]);

  const sortedWriters = useMemo(
    () =>
      [...writers].sort((first, second) =>
        getWriterName(first).localeCompare(getWriterName(second), "ru")
      ),
    [writers]
  );

  const periods = useMemo(() => {
    const stored = country.literaryPeriods || country.periods;
    if (stored?.length) return stored.slice(0, 7);
    return uniqueValues(writers.flatMap((writer) => writer.tags || [])).slice(0, 7);
  }, [country.literaryPeriods, country.periods, writers]);

  const movements = useMemo(() => {
    if (country.literaryMovements?.length) return country.literaryMovements.slice(0, 7);
    return uniqueValues(writers.flatMap((writer) => writer.genres || [])).slice(0, 7);
  }, [country.literaryMovements, writers]);

  const timeline = useMemo(
    () =>
      writers
        .map((writer) => ({ writer, year: getWriterYear(writer) }))
        .filter((item): item is { writer: Writer; year: number } => item.year !== null)
        .sort((first, second) => first.year - second.year)
        .slice(0, 6),
    [writers]
  );
  const relatedArticles = useMemo(
    () => (activeWriter ? relatedArticlesFor(activeWriter) : []),
    [activeWriter]
  );
  const activeNobelYear = activeWriter ? getNobelYear(activeWriter) : null;
  const activeNobelArticle = activeWriter
    ? findNobelArticle(activeWriter)
    : null;
  const otherRelatedArticles = activeNobelArticle
    ? relatedArticles.filter((article) => article.id !== activeNobelArticle.id)
    : relatedArticles;
  const activeWriterWorks = useMemo(
    () => (activeWriter ? getWriterWorkTitles(activeWriter) : []),
    [activeWriter]
  );
  const countryLabel = countryName(country.code, country.name);
  const countrySubscribed = isSubscribed("country", country.id);
  const activeWriterSubscriptionId = activeWriter
    ? `${country.id}:${activeWriter.id}`
    : "";
  const activeWriterSubscribed = activeWriter
    ? isSubscribed("writer", activeWriterSubscriptionId)
    : false;

  const nobelWriters = writers.filter(isNobelLaureate);
  const nobelCount = nobelWriters.length;
  const description =
    country.description ||
    country.history ||
    country.historicalNote ||
    `Архив объединяет ${writers.length} авторов и ключевые произведения литературной традиции страны.`;

  const chooseWriter = (writer: Writer) => {
    setLocalSelected(writer);
    onWriterSelect?.(writer);
  };

  return (
    <aside ref={panelRef} className="country-panel" aria-live="polite">
      <div className="panel-topline">
        <div>
          <span className="eyebrow">{t("Литературный архив")}</span>
          <span className="archive-code">{country.code?.toUpperCase()}</span>
        </div>
        {onClose && (
          <button
            className="panel-close"
            type="button"
            onClick={onClose}
            aria-label={t("Закрыть панель")}
          >
            <BrandCloseIcon />
          </button>
        )}
      </div>

      <header className="country-heading">
        <CountryFlagIcon
          className="country-flag"
          code={country.code}
          countryName={country.name}
          size={52}
          priority
        />
        <div>
          <h2>{countryName(country.code, country.name)}</h2>
          <p>
            {country.capital
              ? `${t("Столица")}: ${country.capital}`
              : t("Литературное наследие страны")}
          </p>
        </div>
      </header>

      <p className="country-description">{description}</p>
      <button
        className={`archive-subscribe${countrySubscribed ? " is-active" : ""}`}
        type="button"
        aria-pressed={countrySubscribed}
        onClick={() =>
          toggleSubscription({
            type: "country",
            id: country.id,
            label: countryLabel,
          })
        }
      >
        <span aria-hidden="true">✦</span>
        {countrySubscribed
          ? t("Вы следите за архивом страны")
          : t("Следить за новыми материалами страны")}
      </button>
      {language === "en" && (
        <p className="archive-original-language">
          {t(
            "Справочные тексты энциклопедии представлены в оригинале на русском языке."
          )}
        </p>
      )}

      <div className="country-metrics">
        <div>
          <strong>{number(writers.length)}</strong>
          <span>
            {language === "en"
              ? writers.length === 1
                ? "writer"
                : "writers"
              : pluralRu(writers.length, ["автор", "автора", "авторов"])}
          </span>
        </div>
        <button
          className={`country-metric-button${nobelSpotlightActive ? " is-active" : ""}`}
          type="button"
          disabled={!nobelWriters.length}
          onClick={onNobelSpotlightToggle}
          aria-pressed={nobelSpotlightActive}
          title={t(
            nobelSpotlightActive
              ? "Скрыть метки Нобелевских лауреатов этой страны"
              : "Показать всех Нобелевских лауреатов этой страны на глобусе"
          )}
        >
          <strong>{number(nobelCount)}</strong>
          <span>
            {language === "en"
              ? nobelCount === 1
                ? "Nobel laureate"
                : "Nobel laureates"
              : pluralRu(nobelCount, [
                  "Нобелевский лауреат",
                  "Нобелевских лауреата",
                  "Нобелевских лауреатов",
                ])}
          </span>
        </button>
        <div>
          {(() => {
            const worksCount = uniqueValues(
              writers.flatMap(getWriterWorkTitles)
            ).length;
            return (
              <>
                <strong>{number(worksCount)}</strong>
                <span>
                  {language === "en"
                    ? worksCount === 1
                      ? "work"
                      : "works"
                    : pluralRu(worksCount, [
                        "произведение",
                        "произведения",
                        "произведений",
                      ])}
                </span>
              </>
            );
          })()}
        </div>
      </div>

      {periods.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <h3>{t("Эпохи и направления")}</h3>
          </div>
          <div className="tag-list">
            {periods.map((period) => (
              <span key={period}>{period}</span>
            ))}
            {movements.map((movement) => (
              <span key={movement}>{movement}</span>
            ))}
          </div>
        </section>
      )}

      <section className="archive-section">
        <div className="section-title">
          <h3>{t("Писатели")}</h3>
        </div>

        <div className="writer-list">
          {sortedWriters.map((writer) => {
            const active = activeWriter?.id === writer.id;
            return (
              <button
                key={writer.id}
                className={`writer-row${active ? " is-active" : ""}`}
                type="button"
                onClick={() => chooseWriter(writer)}
              >
                <WriterPortrait
                  writer={writer}
                  className="writer-portrait"
                  decorative
                />
                <span className="writer-copy">
                  <strong>{getWriterName(writer)}</strong>
                  <small>
                    {writer.years || writer.literaryEra || t("Биография в архиве")}
                  </small>
                </span>
                <span className="writer-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeWriter && (
        <section ref={detailRef} className="archive-section writer-detail">
          <div className="section-title">
            <h3>{t("Карточка автора")}</h3>
          </div>

          <div className="writer-detail-heading">
            <WriterPortrait
              writer={activeWriter}
              className="writer-detail-portrait"
            />
            <div>
              <span className="writer-era">
                {activeWriter.literaryEra ||
                  activeWriter.movement ||
                  activeWriter.tags?.[0] ||
                  t("Литературная традиция")}
              </span>
              {activeWriter.editorial?.status === "verified" && (
                <span className="editorial-badge">{t("Проверено редакцией")}</span>
              )}
              {activeWriter.editorial?.status === "reviewed" && (
                <span className="editorial-badge is-reviewed">
                  {t("Редакционная карточка")}
                </span>
              )}
              {activeWriter.editorial?.status === "draft" && (
                <span className="editorial-badge is-draft">
                  {t("Справочная карточка · требует расширения")}
                </span>
              )}
              <h4>{getWriterName(activeWriter)}</h4>
              <p className="writer-years">{activeWriter.years}</p>
            </div>
          </div>
          <button
            className={`archive-subscribe is-writer${activeWriterSubscribed ? " is-active" : ""}`}
            type="button"
            aria-pressed={activeWriterSubscribed}
            onClick={() =>
              toggleSubscription({
                type: "writer",
                id: activeWriterSubscriptionId,
                label: getWriterName(activeWriter),
              })
            }
          >
            <span aria-hidden="true">✦</span>
            {activeWriterSubscribed
              ? t("Вы следите за автором")
              : t("Следить за новыми материалами автора")}
          </button>
          <p className="writer-bio">
            {activeWriter.biography ||
              activeWriter.bio ||
              activeWriter.description ||
              t("Расширенная биография готовится для энциклопедии.")}
          </p>

          {activeNobelYear && (
            <div className="writer-nobel-feature">
              {activeNobelArticle ? (
                <a
                  className="writer-nobel-medal"
                  href={articlePath(
                    activeNobelArticle.id,
                    activeNobelArticle.title,
                    activeNobelArticle.sectionId,
                    activeNobelArticle.slug
                  )}
                  aria-label={t("Открыть статью о лауреате")}
                >
                  <img src={nobelPortraitUrl} alt="" />
                </a>
              ) : (
                <span className="writer-nobel-medal" aria-hidden="true">
                  <img src={nobelPortraitUrl} alt="" />
                </span>
              )}
              <div>
                <small>{t("Нобелевский архив")}</small>
                <strong>
                  {t("Лауреат Нобелевской премии по литературе")} · {activeNobelYear}
                </strong>
                {activeNobelArticle ? (
                  <a
                    href={articlePath(
                      activeNobelArticle.id,
                      activeNobelArticle.title,
                      activeNobelArticle.sectionId,
                      activeNobelArticle.slug
                    )}
                  >
                    {t("Читать редакционный материал года")} <span>→</span>
                  </a>
                ) : (
                  <em>{t("Годовая статья готовится редакцией")}</em>
                )}
              </div>
            </div>
          )}

          {activeWriterWorks.length > 0 && (
            <div className="works-block">
              <span>{t("Основные произведения")}</span>
              <ol>
                {activeWriterWorks.slice(0, 8).map((work) => (
                  <li key={work}>{work}</li>
                ))}
              </ol>
            </div>
          )}

          {otherRelatedArticles.length > 0 && (
            <div className="writer-articles">
              <span>{t("Материалы журнала")}</span>
              {otherRelatedArticles.map((article) => (
                <a
                  key={article.id}
                  href={articlePath(
                    article.id,
                    article.title,
                    article.sectionId,
                    article.slug
                  )}
                >
                  <strong>{article.title}</strong>
                  <small>
                    {article.sectionLabel} · {article.readingMinutes} {t("мин.")}
                  </small>
                </a>
              ))}
            </div>
          )}

          {activeWriter.editorial?.sources && activeWriter.editorial.sources.length > 0 && (
            <div className="source-block">
              <span>{t("Источники")}</span>
              {activeWriter.editorial.sources.map((source) => (
                <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                  {source.publisher || source.title}
                </a>
              ))}
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <h3>{t("Литературная хронология")}</h3>
          </div>
          <div className="country-timeline">
            {timeline.map(({ writer, year }) => (
              <div key={`${writer.id}-${year}`}>
                <time>{year}</time>
                <span>{getWriterName(writer)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {country.facts && country.facts.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <h3>{t("Интересные факты")}</h3>
          </div>
          <ul className="fact-list">
            {country.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
