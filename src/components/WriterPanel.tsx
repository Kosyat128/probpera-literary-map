import { gsap } from "gsap";
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
import { articlePath } from "../utils/articleRoutes";
import CountryFlagIcon from "./CountryFlagIcon";
import { getPublicWriterWorkTitles } from "../data/bookArchive";
import { selectWriterBiographyForDisplay } from "../data/writerBiographyDisplay";
import {
  selectWriterDisplayName,
  selectWriterYears,
} from "../data/bookLocalization";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { useSubscriptions } from "../hooks/useSubscriptions";
import {
  cmsEntityFieldMarker,
  cmsEntityMarker,
} from "../cms/directEditBridge";
import BrandCloseIcon from "./BrandCloseIcon";
import WriterPortrait from "./WriterPortrait";
import {
  WRITER_DETAIL_VIEWS,
  writerBiographyPublicStatus,
  writerDetailViewForKey,
  type WriterDetailView,
} from "./writerPanelPresentation";

const nobelPortraitUrl = `${import.meta.env.BASE_URL}brand/alfred-nobel-medallion.png`;

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
    selectedWriterInCountry ?? localWriterInCountry ?? writers[0] ?? null;

  const scrollToWriterDetail = useCallback(() => {
    const detail = detailRef.current;
    if (!detail) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    detail.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
    window.setTimeout(
      () => detail.focus({ preventScroll: true }),
      reducedMotion ? 0 : 420
    );
  }, []);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    const detail = detailRef.current;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reducedMotion) {
      if (requestedWriterId.current === activeWriter.id) {
        requestedWriterId.current = null;
        const frame = window.requestAnimationFrame(scrollToWriterDetail);
        return () => window.cancelAnimationFrame(frame);
      }
      return;
    }
    const animation = gsap.fromTo(
      detail,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out" }
    );
    if (requestedWriterId.current === activeWriter.id) {
      requestedWriterId.current = null;
      const frame = window.requestAnimationFrame(() => {
        scrollToWriterDetail();
      });
      return () => {
        animation.kill();
        window.cancelAnimationFrame(frame);
      };
    }
    return () => {
      animation.kill();
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
  const activeWriterWorks = useMemo(
    () => (activeWriter ? getPublicWriterWorkTitles(activeWriter, language) : []),
    [activeWriter, language]
  );
  const activeWriterBiography = useMemo(
    () =>
      activeWriter
        ? selectWriterBiographyForDisplay(activeWriter, language)
        : null,
    [activeWriter, language]
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
  const hasWriterWorks =
    activeWriterWorks.length > 0 || Boolean(activeWriter?.awards?.length);
  const hasWriterSources = Boolean(
    activeWriterBiography?.kind === "published" &&
      activeWriterBiography.sources.length > 0
  );
  const hasWriterRelatedArticles = otherRelatedArticles.length > 0;
  const countryLabel = countryName(country.code, country.name);
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
          <p
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
            {activeWriterBiography?.text ||
              (language === "en"
                ? t("Проверенный английский перевод биографии ещё готовится.")
                : t("Расширенная биография готовится для энциклопедии."))}
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
          {activeWriterWorks.length > 0 && (
            <div className="works-block">
              <span>{t("Основные произведения")}</span>
              <ol
                {...cmsEntityFieldMarker(
                  "writer",
                  activeWriterSubscriptionId,
                  "works",
                  activeWriter.works?.length
                    ? activeWriter.works
                    : activeWriterWorks,
                  {
                    kind: "textarea",
                    label: "Основные произведения (по одному в строке)",
                    adminHref: activeWriterAdminHref,
                  }
                )}
              >
                {activeWriterWorks.slice(0, 8).map((work) => (
                  <li key={work}>{work}</li>
                ))}
              </ol>
            </div>
          )}

          {activeWriter.awards && activeWriter.awards.length > 0 && (
            <div className="works-block writer-awards-block">
              <span>{t("Премии и награды")}</span>
              <ul
                {...cmsEntityFieldMarker(
                  "writer",
                  activeWriterSubscriptionId,
                  "awards",
                  activeWriter.awards,
                  {
                    kind: "textarea",
                    label: "Премии и награды (по одной в строке)",
                    adminHref: activeWriterAdminHref,
                  }
                )}
              >
                {activeWriter.awards.map((award) => (
                  <li key={award}>{award}</li>
                ))}
              </ul>
            </div>
          )}
          {!hasWriterWorks && (
            <p className="writer-source-empty">
              {t("Для этого автора проверенные произведения и награды пока не опубликованы.")}
            </p>
          )}
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
                    {source.author ? `${source.author} — ` : ""}
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
