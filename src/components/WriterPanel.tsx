import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { articleCatalog } from "../data/articles/catalog";
import { articleCatalogEntryForLanguage } from "../data/articles/localization";
import {
  findNobelArticle,
  getNobelYear,
  isNobelLaureate,
} from "../data/articles/nobelArticles";
import type { Country, Writer } from "../data/countries";
import {
  articlePath,
  navigateToArticle,
  shouldUseClientNavigation,
} from "../utils/articleRoutes";
import CountryFlagIcon from "./CountryFlagIcon";
import { getPublicWriterWorkTitles } from "../data/bookArchive";
import { selectWriterBiographyForDisplay } from "../data/writerBiographyDisplay";
import {
  selectWriterDisplayName,
  selectWriterYears,
} from "../data/bookLocalization";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { useSubscriptions } from "../hooks/useSubscriptions";
import { createGlobeCoordinates } from "./globeCoordinates";
import {
  cmsEntityFieldMarker,
  cmsEntityMarker,
} from "../cms/directEditBridge";
import BrandCloseIcon from "./BrandCloseIcon";
import WriterPortrait from "./WriterPortrait";
import Button from "../ui/Button";
import {
  WRITER_DETAIL_VIEWS,
  groupWriterRecordsByStatus,
  writerAwardsForPanel,
  writerBiographyPublicStatus,
  writerDetailViewForKey,
  writerRecordStatusPresentation,
  writerWorksForPanel,
  type WriterDetailView,
} from "./writerPanelPresentation";

const nobelPortraitUrl = `${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`;
const WRITER_PANEL_MOTION_MS = 280;
const WRITER_DETAIL_MOTION_MS = 200;
const WRITER_MOTION_EASING = "cubic-bezier(0.2, 0.72, 0.22, 1)";

function animateWriterSurface(
  element: HTMLElement,
  keyframes: Keyframe[],
  duration: number
) {
  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof element.animate !== "function"
  ) {
    return null;
  }
  return element.animate(keyframes, {
    duration,
    easing: WRITER_MOTION_EASING,
    fill: "both",
  });
}

function FollowBellIcon({ active = false }: { active?: boolean }) {
  return (
    <span className="archive-subscribe-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M7.4 10.2c0-3.1 1.8-5.1 4.6-5.1s4.6 2 4.6 5.1v3.1l1.6 2.2H5.8l1.6-2.2v-3.1Z" />
        <path d="M10 18.2c.5.8 1.1 1.2 2 1.2s1.5-.4 2-1.2" />
        {active ? <path d="m9.5 11.1 1.6 1.6 3.5-3.7" /> : <path d="M12 2.6v1.1" />}
      </svg>
    </span>
  );
}

type WriterPanelProps = {
  country: Country;
  selectedWriter?: Writer | null;
  focusRequestId?: number;
  onWriterSelect?: (writer: Writer) => void;
  onWorkSelect?: (
    countryId: string,
    writerId: string,
    workId: string,
    returnFocus: HTMLElement
  ) => void;
  onShowWriterOnGlobe?: (writer: Writer) => void;
  onNavigateWorld?: () => void;
  onNavigateCountry?: () => void;
  nobelSpotlightActive?: boolean;
  onNobelSpotlightToggle?: () => void;
  onClose?: () => void;
};

function getWriterName(
  writer: Writer,
  fallback = "Неизвестный автор",
  language: "ru" | "en" = "ru"
) {
  return selectWriterDisplayName(writer, language, fallback);
}

function getWriterYears(writer: Writer, language: "ru" | "en") {
  return selectWriterYears(writer, language);
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

function relatedArticlesFor(writer: Writer, language: "ru" | "en") {
  const nameParts = getWriterName(writer, "", language)
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
    .flatMap((article) => {
      const localizedArticle = articleCatalogEntryForLanguage(article, language);
      return localizedArticle ? [localizedArticle] : [];
    })
    .slice(0, 4);
}

export default function WriterPanel({
  country,
  selectedWriter,
  focusRequestId,
  onWriterSelect,
  onWorkSelect,
  onShowWriterOnGlobe,
  onNavigateWorld,
  onNavigateCountry,
  nobelSpotlightActive = false,
  onNobelSpotlightToggle,
  onClose,
}: WriterPanelProps) {
  const { language, t, countryName, number } = useInterfaceLanguage();
  const { toggle: toggleSubscription, isSubscribed } = useSubscriptions();
  const panelRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const detailTabRefs = useRef<Record<WriterDetailView, HTMLButtonElement | null>>({
    biography: null,
    works: null,
    sources: null,
  });
  const requestedWriterId = useRef<string | null>(null);
  const handledFocusRequest = useRef<number | null>(null);
  const writers = country.writers || [];
  const [localSelected, setLocalSelected] = useState<Writer | null>(writers[0] || null);
  const [detailView, setDetailView] = useState<WriterDetailView>("biography");

  useEffect(() => {
    const firstWriter = country.writers?.[0] || null;
    setLocalSelected(firstWriter);
    if (firstWriter && selectedWriter === undefined) onWriterSelect?.(firstWriter);
  }, [country.id, country.writers, onWriterSelect, selectedWriter]);

  const selectedWriterInCountry = selectedWriter
    ? writers.find((writer) => writer.id === selectedWriter.id) ?? null
    : null;
  const localWriterInCountry = localSelected
    ? writers.find((writer) => writer.id === localSelected.id) ?? null
    : null;
  const activeWriter =
    selectedWriter === undefined
      ? localWriterInCountry ?? writers[0] ?? null
      : selectedWriterInCountry;

  const scrollToWriterDetail = useCallback(() => {
    const detail = detailRef.current;
    if (!detail) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    detail.focus({ preventScroll: true });
    detail.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const animation = animateWriterSurface(
      panel,
      [
        { opacity: 0, transform: "translateX(8px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      WRITER_PANEL_MOTION_MS
    );
    return () => animation?.cancel();
  }, [country.id]);

  useLayoutEffect(() => {
    if (!detailRef.current || !activeWriter) return;
    const detail = detailRef.current;
    const animation = animateWriterSurface(
      detail,
      [
        { opacity: 0, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      WRITER_DETAIL_MOTION_MS
    );
    let frame: number | null = null;
    if (requestedWriterId.current === activeWriter.id) {
      requestedWriterId.current = null;
      frame = window.requestAnimationFrame(scrollToWriterDetail);
    }
    return () => {
      animation?.cancel();
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [activeWriter?.id, scrollToWriterDetail]);

  useLayoutEffect(() => {
    if (
      focusRequestId === undefined ||
      handledFocusRequest.current === focusRequestId ||
      !activeWriter
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      handledFocusRequest.current = focusRequestId;
      scrollToWriterDetail();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeWriter, focusRequestId, scrollToWriterDetail]);

  const sortedWriters = useMemo(
    () =>
      [...writers].sort((first, second) =>
        getWriterName(first, "", language).localeCompare(
          getWriterName(second, "", language),
          language
        )
      ),
    [language, writers]
  );

  const periods = useMemo(() => {
    if (language === "en") return [];
    const stored = country.literaryPeriods || country.periods;
    if (stored?.length) return stored.slice(0, 7);
    return uniqueValues(writers.flatMap((writer) => writer.tags || [])).slice(0, 7);
  }, [country.literaryPeriods, country.periods, language, writers]);

  const movements = useMemo(() => {
    if (language === "en") return [];
    if (country.literaryMovements?.length) return country.literaryMovements.slice(0, 7);
    return uniqueValues(writers.flatMap((writer) => writer.genres || [])).slice(0, 7);
  }, [country.literaryMovements, language, writers]);
  const periodsAndMovements = useMemo(
    () => uniqueValues([...periods, ...movements]),
    [movements, periods]
  );

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
    () => (activeWriter ? relatedArticlesFor(activeWriter, language) : []),
    [activeWriter, language]
  );
  const activeNobelYear = activeWriter ? getNobelYear(activeWriter) : null;
  const activeNobelArticleSource = activeWriter
    ? findNobelArticle(activeWriter)
    : null;
  const activeNobelArticle = activeNobelArticleSource
    ? articleCatalogEntryForLanguage(activeNobelArticleSource, language)
    : null;
  const otherRelatedArticles = activeNobelArticle
    ? relatedArticles.filter((article) => article.id !== activeNobelArticle.id)
    : relatedArticles;
  const activeWriterBiography = useMemo(
    () =>
      activeWriter
        ? selectWriterBiographyForDisplay(activeWriter, language)
        : null,
    [activeWriter, language]
  );
  const activeWriterWorks = useMemo(
    () => (activeWriter ? writerWorksForPanel(activeWriter, language) : []),
    [activeWriter, language]
  );
  const activeWriterAwards = useMemo(
    () =>
      activeWriter
        ? writerAwardsForPanel(
            activeWriter,
            activeWriterBiography,
            language
          )
        : [],
    [activeWriter, activeWriterBiography, language]
  );
  const activeWriterWorkGroups = useMemo(
    () => groupWriterRecordsByStatus(activeWriterWorks),
    [activeWriterWorks]
  );
  const activeWriterAwardGroups = useMemo(
    () => groupWriterRecordsByStatus(activeWriterAwards),
    [activeWriterAwards]
  );
  const writerBiographyDisplays = useMemo(
    () =>
      new Map(
        sortedWriters.map((writer) => [
          writer.id,
          selectWriterBiographyForDisplay(writer, language),
        ])
      ),
    [language, sortedWriters]
  );
  const publishedBiographyCount = useMemo(
    () =>
      [...writerBiographyDisplays.values()].filter(
        (biography) => biography?.kind === "published"
      ).length,
    [writerBiographyDisplays]
  );
  const activeWriterStatus = writerBiographyPublicStatus(activeWriterBiography);
  const activeWriterBiographyText =
    activeWriterBiography?.text ||
    (language === "en"
      ? t("Проверенный английский перевод биографии ещё готовится.")
      : t("Расширенная биография готовится для энциклопедии."));
  const activeWriterBiographyParagraphs = activeWriterBiographyText
    .split(/\r?\n+/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const hasWriterWorks = activeWriterWorks.length > 0;
  const hasWriterAwards = activeWriterAwards.length > 0;
  const hasWriterSources = Boolean(
    activeWriterBiography?.kind === "published" &&
      activeWriterBiography.sources.length > 0
  );
  const hasWriterRelatedArticles = otherRelatedArticles.length > 0;
  const countryLabel = countryName(country.code, country.name);
  const activeWriterLabel = activeWriter
    ? getWriterName(activeWriter, t("Неизвестный автор"), language)
    : null;
  const activeWriterGlobeCoordinates = activeWriter?.coordinates
    ? createGlobeCoordinates(
        activeWriter.coordinates.lat,
        activeWriter.coordinates.lng
      )
    : null;
  const countrySubscribed = isSubscribed("country", country.id);
  const activeWriterSubscriptionId = activeWriter
    ? `${country.id}:${activeWriter.id}`
    : "";
  const activeWriterAdminHref = activeWriter
    ? `/library?country_id=${encodeURIComponent(country.id)}&writer_id=${encodeURIComponent(activeWriter.id)}`
    : "";
  const activeWriterSubscribed = activeWriter
    ? isSubscribed("writer", activeWriterSubscriptionId)
    : false;

  useEffect(() => {
    setDetailView("biography");
  }, [activeWriter?.id]);

  const nobelWriters = writers.filter(isNobelLaureate);
  const nobelCount = nobelWriters.length;
  const description =
    language === "en"
      ? t("Проверенный английский перевод справки о стране ещё готовится.")
      : country.description ||
        country.history ||
        country.historicalNote ||
        `Архив объединяет ${number(writers.length)} ${pluralRu(writers.length, [
          "автора",
          "авторов",
          "авторов",
        ])} и ключевые произведения литературной традиции страны.`;

  const chooseWriter = (writer: Writer) => {
    if (activeWriter?.id === writer.id) {
      scrollToWriterDetail();
      return;
    }
    requestedWriterId.current = writer.id;
    setLocalSelected(writer);
    onWriterSelect?.(writer);
  };

  const writerDetailId = `writer-biography-${country.id}`;
  const writerDetailHeadingId = `${writerDetailId}-heading`;
  const countryHeadingId = `country-heading-${country.id}`;
  const detailTabId = (view: WriterDetailView) =>
    `${writerDetailId}-tab-${view}`;
  const detailPanelId = (view: WriterDetailView) =>
    `${writerDetailId}-panel-${view}`;
  const selectDetailView = (view: WriterDetailView, moveFocus = false) => {
    setDetailView(view);
    if (moveFocus) {
      window.requestAnimationFrame(() => detailTabRefs.current[view]?.focus());
    }
  };
  const handleDetailTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>
  ) => {
    const nextView = writerDetailViewForKey(detailView, event.key);
    if (!nextView) return;
    event.preventDefault();
    selectDetailView(nextView, true);
  };

  return (
    <aside
      ref={panelRef}
      className="country-panel"
      role="region"
      tabIndex={-1}
      aria-labelledby={countryHeadingId}
    >
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

      <nav
        className="country-panel-breadcrumbs"
        aria-label={t("Навигация по Литературной планете")}
      >
        <ol>
          <li>
            {onNavigateWorld ? (
              <button
                type="button"
                onClick={onNavigateWorld}
              >
                {t("Мир")}
              </button>
            ) : (
              <span>{t("Мир")}</span>
            )}
          </li>
          <li aria-current={activeWriterLabel ? undefined : "page"}>
            {activeWriterLabel && onNavigateCountry ? (
              <button type="button" onClick={onNavigateCountry}>
                {countryLabel}
              </button>
            ) : (
              <span>{countryLabel}</span>
            )}
          </li>
          {activeWriterLabel && (
            <li aria-current="page">{activeWriterLabel}</li>
          )}
        </ol>
      </nav>

      <header className="country-heading">
        <CountryFlagIcon
          className="country-flag"
          code={country.code}
          countryName={country.name}
          size={52}
          decorative
          priority
        />
        <div>
          <h2 id={countryHeadingId}>{countryName(country.code, country.name)}</h2>
          <p>
            {country.capital
              ? `${t("Столица")}: ${country.capital}`
              : t("Литературное наследие страны")}
          </p>
        </div>
      </header>

      <p className="country-description">{description}</p>
      <div
        className={`country-verification-summary${publishedBiographyCount ? "" : " is-empty"}`}
        data-verified-biographies={publishedBiographyCount}
        data-total-biographies={writers.length}
      >
        <span className="country-verification-icon" aria-hidden="true">
          {publishedBiographyCount ? "✓" : "i"}
        </span>
        <div>
          <strong>
            {number(publishedBiographyCount)} {" "}
            {language === "en"
              ? publishedBiographyCount === 1
                ? "biography has passed editorial review"
                : "biographies have passed editorial review"
              : pluralRu(publishedBiographyCount, [
                  "биография прошла редакционную проверку",
                  "биографии прошли редакционную проверку",
                  "биографий прошли редакционную проверку",
                ])}
          </strong>
          <small>
            {t("Для каждой биографии показан её фактический статус")}
          </small>
        </div>
      </div>
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
        <FollowBellIcon active={countrySubscribed} />
        <span className="archive-subscribe-label">
          {countrySubscribed
            ? t("Вы следите за архивом страны")
            : t("Следить за новыми материалами страны")}
        </span>
      </button>
      {language === "en" && (
        <p className="archive-original-language">
          {t(
            "Тексты без проверенного перевода скрыты в английской версии."
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
              writers.flatMap((writer) =>
                getPublicWriterWorkTitles(writer, language)
              )
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

      {periodsAndMovements.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <h3>{t("Эпохи и направления")}</h3>
          </div>
          <div className="tag-list">
            {periodsAndMovements.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </section>
      )}

      <section className="archive-section">
        <div className="section-title">
          <h3>{t("Писатели")}</h3>
        </div>

        <div className="writer-list">
          {sortedWriters.length === 0 && (
            <p className="writer-list-empty" role="status">
              {t("В архиве этой страны пока нет опубликованных карточек писателей.")}
            </p>
          )}
          {sortedWriters.map((writer) => {
            const active = activeWriter?.id === writer.id;
            const writerEntityId = `${country.id}:${writer.id}`;
            const writerAdminHref = `/library?country_id=${encodeURIComponent(country.id)}&writer_id=${encodeURIComponent(writer.id)}`;
            const biographyStatus = writerBiographyPublicStatus(
              writerBiographyDisplays.get(writer.id) ?? null
            );
            return (
              <button
                key={writer.id}
                className={`writer-row${active ? " is-active" : ""}`}
                type="button"
                onClick={() => chooseWriter(writer)}
                aria-pressed={active}
                aria-controls={writerDetailId}
                aria-label={`${t("Открыть карточку автора")}: ${getWriterName(
                  writer,
                  t("Неизвестный автор"),
                  language
                )}. ${t(biographyStatus.label)}`}
                {...cmsEntityMarker(
                  "writer",
                  writerEntityId,
                  getWriterName(writer, t("Неизвестный автор"), language),
                  writerAdminHref
                )}
              >
                <WriterPortrait
                  writer={writer}
                  className="writer-portrait"
                  decorative
                  cmsMarker={cmsEntityFieldMarker(
                    "writer",
                    writerEntityId,
                    "portrait",
                    writer.portrait || "",
                    {
                      kind: "image",
                      label: "Портрет писателя",
                      adminHref: writerAdminHref,
                    }
                  )}
                />
                <span className="writer-copy">
                  <strong
                    {...cmsEntityFieldMarker(
                      "writer",
                      writerEntityId,
                      "name",
                      writer.name || getWriterName(writer, "", language),
                      {
                        label: "Имя писателя",
                        adminHref: writerAdminHref,
                      }
                    )}
                  >
                    {getWriterName(writer, t("Неизвестный автор"), language)}
                  </strong>
                  <small
                    {...cmsEntityFieldMarker(
                      "writer",
                      writerEntityId,
                      "years",
                      writer.years || getWriterYears(writer, language),
                      {
                        label: "Годы жизни",
                        adminHref: writerAdminHref,
                      }
                    )}
                  >
                    {getWriterYears(writer, language) ||
                      (language === "ru" ? writer.literaryEra : undefined) ||
                      t("Биография в архиве")}
                  </small>
                  <span
                    className={`writer-row-status is-${biographyStatus.code}`}
                    data-biography-status={biographyStatus.code}
                  >
                    <i aria-hidden="true" />
                    {t(biographyStatus.label)}
                  </span>
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
        <section
          ref={detailRef}
          id={writerDetailId}
          className="archive-section writer-detail"
          tabIndex={-1}
          aria-labelledby={writerDetailHeadingId}
          {...cmsEntityMarker(
            "writer",
            activeWriterSubscriptionId,
            getWriterName(
              activeWriter,
              t("Неизвестный автор"),
              language
            ),
            activeWriterAdminHref
          )}
        >
          <div className="section-title">
            <h3>{t("Карточка автора")}</h3>
          </div>

          <div className="writer-detail-heading">
            <WriterPortrait
              writer={activeWriter}
              className="writer-detail-portrait"
              cmsMarker={cmsEntityFieldMarker(
                "writer",
                activeWriterSubscriptionId,
                "portrait",
                activeWriter.portrait || "",
                {
                  kind: "image",
                  label: "Портрет писателя",
                  adminHref: activeWriterAdminHref,
                }
              )}
            />
            <div>
              <span className="writer-era">
                {language === "ru"
                  ? activeWriter.literaryEra ||
                    activeWriter.movement ||
                    activeWriter.tags?.[0] ||
                    t("Литературная традиция")
                  : t("Литературная традиция")}
              </span>
              <h4
                id={writerDetailHeadingId}
                {...cmsEntityFieldMarker(
                  "writer",
                  activeWriterSubscriptionId,
                  "name",
                  activeWriter.name || getWriterName(activeWriter, "", language),
                  {
                    label: "Имя писателя",
                    adminHref: activeWriterAdminHref,
                  }
                )}
              >
                {getWriterName(
                  activeWriter,
                  t("Неизвестный автор"),
                  language
                )}
              </h4>
              <p
                className="writer-years"
                {...cmsEntityFieldMarker(
                  "writer",
                  activeWriterSubscriptionId,
                  "years",
                  activeWriter.years || getWriterYears(activeWriter, language),
                  {
                    label: "Годы жизни",
                    adminHref: activeWriterAdminHref,
                  }
                )}
              >
                {getWriterYears(activeWriter, language)}
              </p>
            </div>
          </div>
          {onShowWriterOnGlobe && activeWriterGlobeCoordinates ? (
            <Button
              className="writer-show-on-globe"
              type="button"
              size="md"
              variant="secondary"
              onClick={() => onShowWriterOnGlobe(activeWriter)}
              aria-label={`${t("Показать на глобусе")}: ${activeWriterLabel}`}
            >
              {t("Показать на глобусе")}
            </Button>
          ) : onShowWriterOnGlobe ? (
            <p className="writer-source-empty writer-globe-unavailable">
              {t("Место писателя на глобусе пока не указано")}
            </p>
          ) : null}
          <div
            className={`writer-verification-status is-${activeWriterStatus.code}`}
            role="status"
            data-biography-status={activeWriterStatus.code}
          >
            <span aria-hidden="true">
              {activeWriterStatus.code === "verified" ||
              activeWriterStatus.code === "reviewed"
                ? "✓"
                : "i"}
            </span>
            <div>
              <strong>{t(activeWriterStatus.label)}</strong>
              <small>
                {t(activeWriterStatus.detail)}
                {activeWriterStatus.sourceCount > 0
                  ? ` · ${number(activeWriterStatus.sourceCount)}`
                  : ""}
              </small>
            </div>
          </div>
          <div
            className="writer-detail-tabs"
            role="tablist"
            aria-label={t("Разделы карточки автора")}
          >
            {WRITER_DETAIL_VIEWS.map((view) => {
              const label =
                view === "biography"
                  ? t("Биография")
                  : view === "works"
                    ? t("Произведения и награды")
                    : t("Источники и материалы");
              return (
                <button
                  key={view}
                  ref={(element) => {
                    detailTabRefs.current[view] = element;
                  }}
                  id={detailTabId(view)}
                  type="button"
                  role="tab"
                  tabIndex={detailView === view ? 0 : -1}
                  aria-selected={detailView === view}
                  aria-controls={detailPanelId(view)}
                  className={detailView === view ? "is-active" : undefined}
                  onClick={() => selectDetailView(view)}
                  onKeyDown={handleDetailTabKeyDown}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {detailView === "biography" && (
            <div
              id={detailPanelId("biography")}
              className="writer-detail-tab-panel"
              role="tabpanel"
              aria-labelledby={detailTabId("biography")}
            >
          <button
            className={`archive-subscribe is-writer${activeWriterSubscribed ? " is-active" : ""}`}
            type="button"
            aria-pressed={activeWriterSubscribed}
            onClick={() =>
              toggleSubscription({
                type: "writer",
                id: activeWriterSubscriptionId,
                label: getWriterName(
                  activeWriter,
                  t("Неизвестный автор"),
                  language
                ),
              })
            }
          >
            <FollowBellIcon active={activeWriterSubscribed} />
            <span className="archive-subscribe-label">
              {activeWriterSubscribed
                ? t("Вы следите за автором")
                : t("Следить за новыми материалами автора")}
            </span>
          </button>
          <div
            className="writer-bio"
            {...cmsEntityFieldMarker(
              "writer",
              activeWriterSubscriptionId,
              "bio",
              activeWriterBiography?.text || activeWriter.bio || "",
              {
                kind: "textarea",
                label: "Биография",
                adminHref: activeWriterAdminHref,
              }
            )}
          >
            {activeWriterBiographyParagraphs.map((paragraph, index) => (
              <p key={`${activeWriter.id}-biography-${index}`}>
                {paragraph}
              </p>
            ))}
          </div>

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
                  onClick={(event) => {
                    if (!shouldUseClientNavigation(event)) return;
                    event.preventDefault();
                    navigateToArticle(activeNobelArticle);
                  }}
                >
                  <img
                    src={nobelPortraitUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                </a>
              ) : (
                <span className="writer-nobel-medal" aria-hidden="true">
                  <img
                    src={nobelPortraitUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
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
                    onClick={(event) => {
                      if (!shouldUseClientNavigation(event)) return;
                      event.preventDefault();
                      navigateToArticle(activeNobelArticle);
                    }}
                  >
                    {t("Читать редакционный материал года")} <span>→</span>
                  </a>
                ) : (
                  <em>{t("Годовая статья готовится редакцией")}</em>
                )}
              </div>
            </div>
          )}

            </div>
          )}

          {detailView === "works" && (
            <div
              id={detailPanelId("works")}
              className="writer-detail-tab-panel"
              role="tabpanel"
              aria-labelledby={detailTabId("works")}
            >
              <section
                className="writer-record-section is-works"
                aria-labelledby={`${detailPanelId("works")}-works-heading`}
                {...cmsEntityFieldMarker(
                  "writer",
                  activeWriterSubscriptionId,
                  "works",
                  activeWriter.works?.length
                    ? activeWriter.works
                    : activeWriterWorks.map((work) => work.title),
                  {
                    kind: "textarea",
                    label: "Основные произведения (по одному в строке)",
                    adminHref: activeWriterAdminHref,
                  }
                )}
              >
                <header className="writer-record-section-heading">
                  <div>
                    <span>{t("Редакционный архив")}</span>
                    <h5 id={`${detailPanelId("works")}-works-heading`}>
                      {t("Опубликованные произведения")}
                    </h5>
                  </div>
                  <strong aria-label={`${t("Произведения")}: ${number(activeWriterWorks.length)}`}>
                    {number(activeWriterWorks.length)}
                  </strong>
                </header>
                <p className="writer-record-note">
                  {t("Здесь показаны только произведения, прошедшие редакционную проверку.")}
                </p>

                {activeWriterWorkGroups.map((group) => {
                  const status = writerRecordStatusPresentation(group.status);
                  const groupHeadingId = `${detailPanelId("works")}-works-${group.status}`;
                  return (
                    <section
                      key={group.status}
                      className={`writer-record-group is-${group.status}`}
                      aria-labelledby={groupHeadingId}
                    >
                      <h6 id={groupHeadingId}>
                        <span aria-hidden="true" />
                        {t(status.label)}
                        <small>{number(group.records.length)}</small>
                      </h6>
                      <ol className="writer-record-list is-works">
                        {group.records.map((work) => (
                          <li
                            key={work.id}
                            data-editorial-status={work.status}
                          >
                            <div className="writer-record-primary">
                              <strong>{work.title}</strong>
                              <span
                                className={`writer-record-status is-${work.status}`}
                              >
                                {t(
                                  writerRecordStatusPresentation(work.status)
                                    .label
                                )}
                              </span>
                            </div>
                            <div className="writer-record-meta">
                              <span>
                                {work.sourceCount > 0
                                  ? `${t("Источники зафиксированы")} · ${number(work.sourceCount)}`
                                  : t(
                                      writerRecordStatusPresentation(work.status)
                                        .detail
                                    )}
                              </span>
                              {onWorkSelect && (
                                <button
                                  className="writer-record-open-book"
                                  type="button"
                                  aria-label={`${t("Книжный архив")}: ${work.title}`}
                                  onClick={(event) =>
                                    onWorkSelect(
                                      country.id,
                                      activeWriter.id,
                                      work.id,
                                      event.currentTarget
                                    )
                                  }
                                >
                                  {t("Книжный архив")} <span aria-hidden="true">→</span>
                                </button>
                              )}
                              {work.sourceUrl && (
                                <a
                                  href={work.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`${t("Открыть источник")}: ${work.title}`}
                                >
                                  {t("Источник")} <span aria-hidden="true">↗</span>
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  );
                })}

                {!hasWriterWorks && (
                  <p className="writer-source-empty" role="status">
                    {t("Проверенные произведения этого автора пока не опубликованы.")}
                  </p>
                )}
              </section>

              <section
                className="writer-record-section is-awards"
                aria-labelledby={`${detailPanelId("works")}-awards-heading`}
                {...cmsEntityFieldMarker(
                  "writer",
                  activeWriterSubscriptionId,
                  "awards",
                  activeWriter.awards || [],
                  {
                    kind: "textarea",
                    label: "Премии и награды (по одной в строке)",
                    adminHref: activeWriterAdminHref,
                  }
                )}
              >
                <header className="writer-record-section-heading">
                  <div>
                    <span>{t("Редакционная фиксация")}</span>
                    <h5 id={`${detailPanelId("works")}-awards-heading`}>
                      {t("Награды и отличия")}
                    </h5>
                  </div>
                  <strong aria-label={`${t("Награды и отличия")}: ${number(activeWriterAwards.length)}`}>
                    {number(activeWriterAwards.length)}
                  </strong>
                </header>
                <p className="writer-record-note">
                  {t("Награды автора и отличия произведений показаны с их фактическим редакционным статусом.")}
                </p>

                {activeWriterAwardGroups.map((group) => {
                  const status = writerRecordStatusPresentation(group.status);
                  const groupHeadingId = `${detailPanelId("works")}-awards-${group.status}`;
                  return (
                    <section
                      key={group.status}
                      className={`writer-record-group is-${group.status}`}
                      aria-labelledby={groupHeadingId}
                    >
                      <h6 id={groupHeadingId}>
                        <span aria-hidden="true" />
                        {t(status.label)}
                        <small>{number(group.records.length)}</small>
                      </h6>
                      <ul className="writer-record-list is-awards">
                        {group.records.map((award) => (
                          <li
                            key={award.id}
                            data-editorial-status={award.status}
                          >
                            <div className="writer-record-primary">
                              <strong>{award.label}</strong>
                              <span
                                className={`writer-record-status is-${award.status}`}
                              >
                                {t(
                                  writerRecordStatusPresentation(award.status)
                                    .label
                                )}
                              </span>
                            </div>
                            {award.kind === "work-distinction" && (
                              <p className="writer-record-context">
                                <span>{t("Отличие произведения")}</span>
                                <cite>{award.workTitle}</cite>
                                {(award.organization || award.year) && (
                                  <small>
                                    {[award.organization, award.year]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </small>
                                )}
                              </p>
                            )}
                            <div className="writer-record-meta">
                              <span>
                                {award.sourceCount > 0
                                  ? `${t("Источники зафиксированы")} · ${number(award.sourceCount)}`
                                  : t(status.detail)}
                              </span>
                              {award.sourceUrl && (
                                <a
                                  href={award.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`${t("Открыть источник")}: ${award.label}`}
                                >
                                  {t("Источник")} <span aria-hidden="true">↗</span>
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}

                {!hasWriterAwards && (
                  <p className="writer-source-empty" role="status">
                    {t("Награды и отличия этого автора пока не зафиксированы.")}
                  </p>
                )}
              </section>
            </div>
          )}

          {detailView === "sources" && (
            <div
              id={detailPanelId("sources")}
              className="writer-detail-tab-panel"
              role="tabpanel"
              aria-labelledby={detailTabId("sources")}
            >
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
                  onClick={(event) => {
                    if (!shouldUseClientNavigation(event)) return;
                    event.preventDefault();
                    navigateToArticle(article);
                  }}
                >
                  <strong>{article.title}</strong>
                  <small>
                    {article.sectionLabel} · {article.readingMinutes} {t("мин.")}
                  </small>
                </a>
              ))}
            </div>
          )}

          {hasWriterSources && activeWriterBiography?.kind === "published" && (
            <div className="source-block">
              <span>{t("Источники")}</span>
              {activeWriterBiography.sources.map((source) => (
                <div key={source.url}>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.author ? `${source.author} - ` : ""}
                    {source.title || source.provider}
                  </a>
                  {source.licenseUrl && source.licenseName ? (
                    <a
                      href={source.licenseUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {source.licenseName}
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          )}
            {!hasWriterSources && !hasWriterRelatedArticles && (
              <p className="writer-source-empty">
                {t("Для этой архивной справки источники ещё не зафиксированы.")}
              </p>
            )}
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
                <span>
                  {getWriterName(writer, t("Неизвестный автор"), language)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {language === "ru" && country.facts && country.facts.length > 0 && (
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
