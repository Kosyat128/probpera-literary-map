import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import ArticleEngagement from "./community/ArticleEngagement";
import CommunityHub, { type CommunityView } from "./community/CommunityHub";
import { useAuth } from "./community/AuthContext";
import SocialLinks from "./components/SocialLinks";
import type { Country, Writer } from "./data/countries";
import { buildBookArchive, isCoverDisplayAllowed } from "./data/bookArchive";
import { auditCountryArchive } from "./data/countries/editorialAudit";
import ShareLinks from "./editorial/ShareLinks";

const LiteraryWorldMap = lazy(() => import("./components/LiteraryWorldMap"));
const WriterPanel = lazy(() => import("./components/WriterPanel"));
const LiteraryCalendar = lazy(() => import("./components/LiteraryCalendar"));
const BookArchiveSection = lazy(
  () => import("./components/BookArchiveSection")
);
const ArticleLibrarySection = lazy(
  () => import("./components/ArticleLibrarySection")
);

type AtlasFilter = "all" | "nobel" | "rich" | "portrait" | "verified";

const featuredCountryIds = [
  "russia",
  "france",
  "england",
  "germany",
  "italy",
  "japan",
  "usa",
  "india",
];

const editorialFeatures = [
  {
    tag: "Мнение о книге",
    title: "Хантер С. Томпсон «Ангелы ада»",
    description:
      "Первая большая работа основателя гонзо-журналистики: история создания, контекст и честное мнение после прочтения.",
    image: "brand/series-1.webp",
    articleUrl: "https://probpera.ru/read/page-article/page-books/22",
    sectionUrl: "https://probpera.ru/read/page-article/page-books",
    readTime: "12 минут",
  },
  {
    tag: "Литературная карта мира",
    title: "Семь знаковых писателей Японии",
    description:
      "От классической традиции до современной прозы — маршрут по авторам, прославившим японскую литературу.",
    image: "brand/series-3.webp",
    articleUrl: "https://probpera.ru/read/page-article/page-writers-world/",
    sectionUrl: "https://probpera.ru/read/page-article/page-writers-world/",
    readTime: "15 минут",
  },
  {
    tag: "Пополняем словарный запас",
    title: "Редкие слова, которыми хочется пользоваться",
    description:
      "Не словарь ради словаря, а живые значения, происхождение и примеры употребления в понятной редакционной подаче.",
    image: "brand/series-2.webp",
    articleUrl: "https://probpera.ru/read/page-words/",
    sectionUrl: "https://probpera.ru/read/page-words/",
    readTime: "9 минут",
  },
  {
    tag: "Профессии писателей",
    title: "Кем работали классики до литературной славы",
    description:
      "Неожиданные профессии зарубежных авторов и то, как жизненный опыт становился частью их будущих книг.",
    image: "brand/series-4.webp",
    articleUrl: "https://probpera.ru/read/page-article/first_profession_writers/",
    sectionUrl: "https://probpera.ru/read/page-article/first_profession_writers/",
    readTime: "11 минут",
  },
];

const sectionLinks = [
  {
    number: "01",
    title: "Мнение о книге",
    copy: "Редкие издания, классика и современная литература — с контекстом и без лишних спойлеров.",
    href: "https://probpera.ru/read/page-article/page-books",
    image: "brand/series-1.webp",
  },
  {
    number: "02",
    title: "Книга vs экранизация",
    copy: "Сравниваем текст и экранную версию: что изменилось, что потерялось и что стало сильнее.",
    href: "https://probpera.ru/read/page-article/page-bookvsmovie",
    image: "brand/magazine-cover.webp",
  },
  {
    number: "03",
    title: "Литературные премии",
    copy: "История крупнейших наград, лауреаты, произведения и культурный контекст.",
    href: "https://probpera.ru/read/page-article/famous_prizes/",
    image: "brand/section-prizes.webp",
  },
  {
    number: "04",
    title: "Биографии классиков",
    copy: "Тщательные человеческие биографии: судьба, время, характер и главные тексты автора.",
    href: "https://probpera.ru/read",
    image: "brand/series-3.webp",
  },
];

const portraitSourceLinks: Record<string, string> = {
  dostoevsky:
    "https://commons.wikimedia.org/wiki/File:Fyodor_Dostoyevsky_(Laufert,_1872).jpg",
  tolstoy: "https://commons.wikimedia.org/wiki/File:Leo_Tolstoj.jpg",
  chekhov: "https://commons.wikimedia.org/wiki/File:Anton_Chekhov_1889.png",
  william_shakespeare: "https://commons.wikimedia.org/wiki/File:Shakespeare.jpg",
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ru");
}

function pluralRu(count: number, forms: [string, string, string]) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
  if (last === 1) return forms[0];
  if (last >= 2 && last <= 4) return forms[1];
  return forms[2];
}

function writerName(writer: Writer) {
  return writer.fullName || writer.name || "Автор";
}

function hasNobel(writer: Writer) {
  return Boolean(
    writer.nobel ||
      writer.isNobel ||
      writer.nobelYear ||
      writer.nobelPrize ||
      (writer.awards || []).some((award) => /нобел/i.test(award))
  );
}

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

export default function App() {
  const { user } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);
  const [countryArchive, setCountryArchive] = useState<Country[]>([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [atlasFilter, setAtlasFilter] = useState<AtlasFilter>("all");
  const [communityOpen, setCommunityOpen] = useState(false);
  const [communityView, setCommunityView] =
    useState<CommunityView>("account");
  const atlasRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let active = true;
    import("./data/countries").then((module) => {
      if (active) setCountryArchive(module.countries);
    });
    return () => {
      active = false;
    };
  }, []);

  const allWriters = useMemo(
    () => countryArchive.flatMap((country) => country.writers),
    [countryArchive]
  );
  const totalWriters = allWriters.length;
  const totalWorks = useMemo(
    () => new Set(allWriters.flatMap((writer) => writer.works || [])).size,
    [allWriters]
  );
  const bookArchive = useMemo(
    () => buildBookArchive(countryArchive),
    [countryArchive]
  );
  const editorialAudit = useMemo(
    () => auditCountryArchive(countryArchive),
    [countryArchive]
  );

  const filteredCountries = useMemo(() => {
    if (atlasFilter === "all") return countryArchive;
    if (atlasFilter === "nobel") {
      return countryArchive.filter((country) => country.writers.some(hasNobel));
    }
    if (atlasFilter === "rich") {
      return countryArchive.filter((country) => country.writers.length >= 10);
    }
    if (atlasFilter === "portrait") {
      return countryArchive.filter((country) => country.writers.some((writer) => writer.portrait));
    }
    return countryArchive.filter((country) =>
      country.writers.some((writer) => writer.editorial?.status === "verified")
    );
  }, [atlasFilter, countryArchive]);

  const topCountries = useMemo(
    () =>
      [...filteredCountries]
        .sort((first, second) => second.writers.length - first.writers.length)
        .slice(0, 5),
    [filteredCountries]
  );

  const filterCounts = useMemo(
    () => ({
      all: countryArchive.length,
      nobel: countryArchive.filter((country) => country.writers.some(hasNobel)).length,
      rich: countryArchive.filter((country) => country.writers.length >= 10).length,
      portrait: countryArchive.filter((country) =>
        country.writers.some((writer) => writer.portrait)
      ).length,
      verified: countryArchive.filter((country) =>
        country.writers.some((writer) => writer.editorial?.status === "verified")
      ).length,
    }),
    [countryArchive]
  );

  useEffect(() => {
    if (
      selectedCountry &&
      !filteredCountries.some((country) => country.id === selectedCountry.id)
    ) {
      setSelectedCountry(null);
      setSelectedWriter(null);
    }
  }, [filteredCountries, selectedCountry]);

  const searchResults = useMemo(() => {
    const query = normalizeSearch(search);
    const source = atlasFilter === "all" ? countryArchive : filteredCountries;

    if (!query) {
      return featuredCountryIds
        .map((id) => source.find((country) => country.id === id))
        .filter((country): country is Country => Boolean(country));
    }

    return source
      .filter((country) =>
        [country.name, country.id, country.code]
          .filter(Boolean)
          .some((value) => normalizeSearch(value!).includes(query))
      )
      .sort((first, second) => first.name.localeCompare(second.name, "ru"))
      .slice(0, 9);
  }, [atlasFilter, countryArchive, filteredCountries, search]);

  const featuredAuthors = useMemo(() => {
    const requested = [
      ["russia", "dostoevsky"],
      ["russia", "tolstoy"],
      ["russia", "chekhov"],
      ["england", "william_shakespeare"],
    ];

    return requested
      .map(([countryId, writerId]) => {
        const country = countryArchive.find((item) => item.id === countryId);
        const writer = country?.writers.find((item) => item.id === writerId);
        return country && writer ? { country, writer } : null;
      })
      .filter(
        (entry): entry is { country: Country; writer: Writer } => Boolean(entry)
      );
  }, [countryArchive]);

  const bookOfDay = useMemo(() => {
    const editorialBooks = bookArchive.filter(
      (book) =>
        isCoverDisplayAllowed(book) &&
        ["verified", "reviewed"].includes(book.editorial?.status || "")
    );
    const books = editorialBooks.length ? editorialBooks : bookArchive;
    if (!books.length) return null;
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    return books[dayNumber % books.length];
  }, [bookArchive]);
  const bookOfDayHasCover = Boolean(
    bookOfDay && isCoverDisplayAllowed(bookOfDay)
  );

  const selectCountry = useCallback(
    (country: Country, focusAtlas = false, writer?: Writer) => {
      setSelectedCountry(country);
      setSelectedWriter(writer ?? country.writers[0] ?? null);
      setSearch("");
      setSearchOpen(false);
      if (focusAtlas) {
        window.requestAnimationFrame(() =>
          atlasRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        );
      }
    },
    []
  );

  const closeCountry = useCallback(() => {
    setSelectedCountry(null);
    setSelectedWriter(null);
  }, []);

  const openCommunity = useCallback((view: CommunityView) => {
    setCommunityView(view);
    setCommunityOpen(true);
  }, []);

  const readerName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";

  return (
    <div className="magazine-app">
      <div className="topline">
        <span>Литературный журнал и энциклопедия</span>
        <p>Новый выпуск · 2026</p>
        <div>
          <a href="https://t.me/probbaperra" target="_blank" rel="noreferrer">
            Telegram
          </a>
          <a href="https://vk.com/probperaru" target="_blank" rel="noreferrer">
            VK
          </a>
        </div>
      </div>

      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Проба Пера — главная">
          <img src={assetUrl("brand/probpera-logo.png")} alt="Проба Пера" />
          <span>
            <strong>Проба Пера</strong>
            <small>Литературный журнал</small>
          </span>
        </a>

        <nav aria-label="Основная навигация">
          <a href="#atlas">Карта</a>
          <a href="#journal">Статьи</a>
          <a href="#sections">Разделы</a>
          <a href="#calendar">Календарь</a>
          <button type="button" onClick={() => openCommunity("forum")}>
            Форум
          </button>
          <a href="#about">О проекте</a>
        </nav>

        <div className="header-actions">
          <SocialLinks />
          <button
            className="reader-button"
            type="button"
            onClick={() => openCommunity("account")}
          >
            <span>{readerName.slice(0, 1).toUpperCase() || "✦"}</span>
            {readerName || "Войти"}
          </button>
        </div>
      </header>

      <nav className="mobile-nav" aria-label="Быстрая навигация">
        <a href="#atlas">Карта</a>
        <a href="#journal">Статьи</a>
        <a href="#books">Книги</a>
        <a href="#sections">Разделы</a>
        <a href="#calendar">Календарь</a>
        <button type="button" onClick={() => openCommunity("forum")}>
          Форум
        </button>
      </nav>

      <main>
        <section className="magazine-hero">
          <div className="hero-editorial">
            <span className="section-kicker">Журнал о литературе и искусстве слова</span>
            <h1>
              Литература —
              <br />
              <em>это целый мир.</em>
            </h1>
            <p>
              Статьи, биографии, редкие книги и первая интерактивная литературная
              энциклопедия стран — в одном редакционном пространстве.
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#atlas">
                Открыть глобус <span>→</span>
              </a>
              <a
                className="secondary-action"
                href="https://probpera.ru/read"
                target="_blank"
                rel="noreferrer"
              >
                Читать журнал
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <strong>{countryArchive.length || "…"}</strong> стран
              </span>
              <span>
                <strong>{totalWriters ? totalWriters.toLocaleString("ru-RU") : "…"}</strong>{" "}
                писателей
              </span>
              <span>
                <strong>{totalWorks ? totalWorks.toLocaleString("ru-RU") : "…"}</strong>{" "}
                произведений
              </span>
            </div>
          </div>

          <div className="hero-cover">
            <img
              src={assetUrl("brand/magazine-cover.webp")}
              alt="Журнал «Проба Пера»"
              width="1680"
              height="560"
            />
            <span>№ 16 · Май 2026</span>
          </div>
        </section>

        <section className="atlas-section" id="atlas" ref={atlasRef}>
          <header className="atlas-heading">
            <div>
              <span className="section-kicker">Интерактивная энциклопедия</span>
              <h2>Литературная карта мира</h2>
              <p>
                Выберите страну на старинном глобусе — откроются писатели, произведения,
                эпохи и проверенная редакционная справка.
              </p>
            </div>

            <div
              className={`country-search${searchOpen ? " is-open" : ""}`}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            >
              <label htmlFor="country-search">Найти страну</label>
              <div className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  id="country-search"
                  value={search}
                  placeholder={selectedCountry?.name || "Россия, Франция, Япония…"}
                  autoComplete="off"
                  aria-expanded={searchOpen}
                  aria-controls="country-results"
                  onClick={() => setSearchOpen(true)}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSearchOpen(false);
                    if (event.key === "Enter" && searchResults[0]) {
                      event.preventDefault();
                      selectCountry(searchResults[0]);
                    }
                  }}
                />
                <kbd>↵</kbd>
              </div>

              {searchOpen && (
                <div className="search-results" id="country-results">
                  <span className="search-caption">
                    {search ? "Результаты поиска" : "Избранные архивы"}
                  </span>
                  {searchResults.length > 0 ? (
                    searchResults.map((country) => (
                      <button
                        type="button"
                        key={country.id}
                        onPointerDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => selectCountry(country)}
                      >
                        <span>{country.name}</span>
                        <small>
                          {country.writers.length}{" "}
                          {pluralRu(country.writers.length, [
                            "автор",
                            "автора",
                            "авторов",
                          ])}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>Страна не найдена в выбранной коллекции.</p>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="atlas-toolbar">
            <div className="atlas-filters" aria-label="Фильтры глобуса">
              {(
                [
                  ["all", "Все страны"],
                  ["nobel", "Нобелевские"],
                  ["rich", "10+ авторов"],
                  ["portrait", "С портретами"],
                  ["verified", "Проверено"],
                ] as Array<[AtlasFilter, string]>
              ).map(([value, label]) => (
                <button
                  className={atlasFilter === value ? "is-active" : ""}
                  type="button"
                  key={value}
                  onClick={() => setAtlasFilter(value)}
                >
                  {label} <span>{filterCounts[value]}</span>
                </button>
              ))}
            </div>

            <div className="atlas-ranking">
              <span>Крупнейшие архивы</span>
              {topCountries.map((country, index) => (
                <button type="button" key={country.id} onClick={() => selectCountry(country)}>
                  <i>{index + 1}</i>
                  {country.name}
                  <small>{country.writers.length}</small>
                </button>
              ))}
            </div>
          </div>

          <div className={`atlas-layout${selectedCountry ? " has-country" : ""}`}>
            <section className="globe-column" id="globe-stage">
              <div className="globe-copy">
                <span>Музейный глобус · ручная навигация</span>
                <p>
                  В выбранной коллекции — {filteredCountries.length}{" "}
                  {pluralRu(filteredCountries.length, [
                    "страна",
                    "страны",
                    "стран",
                  ])}
                </p>
              </div>

              {filteredCountries.length > 0 ? (
                <Suspense
                  fallback={
                    <div className="globe-loading" role="status">
                      <span aria-hidden="true">✦</span>
                      <p>Открываем мировой атлас…</p>
                    </div>
                  }
                >
                  <LiteraryWorldMap
                    countries={filteredCountries}
                    selectedCountry={selectedCountry}
                    onCountrySelect={selectCountry}
                  />
                </Suspense>
              ) : (
                <div className="globe-loading" role="status">
                  <span aria-hidden="true">✦</span>
                  <p>В этой коллекции пока нет стран</p>
                </div>
              )}
            </section>

            {selectedCountry && (
              <Suspense
                fallback={<div className="country-panel panel-loading">Открываем архив…</div>}
              >
                <WriterPanel
                  key={selectedCountry.id}
                  country={selectedCountry}
                  selectedWriter={selectedWriter}
                  onWriterSelect={setSelectedWriter}
                  onClose={closeCountry}
                />
              </Suspense>
            )}
          </div>
        </section>

        <section className="daily-grid" id="book-day">
          <article className="book-of-day">
            <div className={`book-cover${bookOfDayHasCover ? " has-image" : ""}`}>
              {bookOfDay && bookOfDayHasCover ? (
                <a
                  href={bookOfDay.coverSourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Источник обложки «${bookOfDay.title}»`}
                >
                  <img
                    src={bookOfDay.coverUrl}
                    alt={`Обложка книги «${bookOfDay.title}»`}
                    loading="lazy"
                  />
                  <small>Источник обложки</small>
                </a>
              ) : (
                <>
                  <span>Проба Пера</span>
                  <strong>{bookOfDay?.title || "Книга дня"}</strong>
                  <i>✦</i>
                </>
              )}
            </div>
            <div>
              <span className="section-kicker">Выбор энциклопедии</span>
              <h3>Книга дня</h3>
              <h4>{bookOfDay?.title || "Открываем библиотеку…"}</h4>
              <p>
                {bookOfDay
                  ? `${writerName(bookOfDay.writer)} · ${bookOfDay.country.name}. ${
                      bookOfDay.description ||
                      "Начните литературное путешествие с одного из ключевых произведений национальной традиции."
                    }`
                  : "Каждый день энциклопедия выбирает новое произведение из единой базы стран."}
              </p>
              {bookOfDay?.tags && (
                <div className="book-tags" aria-label="Темы книги">
                  {bookOfDay.tags.slice(0, 4).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
              {bookOfDay && (
                <div className="book-actions">
                  <button
                    type="button"
                    onClick={() =>
                      selectCountry(bookOfDay.country, true, bookOfDay.writer)
                    }
                  >
                    Открыть автора и страну <span>→</span>
                  </button>
                  {bookOfDay.sourceUrl && (
                    <a href={bookOfDay.sourceUrl} target="_blank" rel="noreferrer">
                      Источник сведений
                    </a>
                  )}
                </div>
              )}
            </div>
          </article>

          <article className="editorial-standard" id="about">
            <span className="section-kicker">Редакционный стандарт</span>
            <h3>Материал, которому можно доверять</h3>
            <p>
              Полное имя, проверяемые даты, человеческая биография, ключевые произведения и
              открытые источники. Сомнительные сведения не маскируются уверенным тоном.
            </p>
            <ul>
              <li>
                {editorialAudit.verifiedWriters} карточки уже прошли проверку по
                открытым музейным источникам
              </li>
              <li>
                {editorialAudit.portraitedWriters} документальных портрета подключены
                без генерации лиц
              </li>
              <li>
                Остальные {editorialAudit.recordsNeedingReview.toLocaleString("ru-RU")} записей
                честно остаются в редакционной очереди
              </li>
            </ul>
          </article>
        </section>

        <Suspense
          fallback={
            <section className="book-archive-section">
              <div className="book-archive-empty">
                <strong>Собираем книжный архив…</strong>
              </div>
            </section>
          }
        >
          <BookArchiveSection
            books={bookArchive}
            onBookSelect={(book) =>
              selectCountry(book.country, true, book.writer)
            }
          />
        </Suspense>

        <section className="editorial-section" id="featured-journal">
          <header className="section-heading">
            <div>
              <span className="section-kicker">Новые публикации</span>
              <h2>Читать в «Пробе Пера»</h2>
            </div>
            <a href="https://probpera.ru/read" target="_blank" rel="noreferrer">
              Все публикации <span>→</span>
            </a>
          </header>

          <div className="editorial-grid">
            {editorialFeatures.map((feature, index) => (
              <article className={index === 0 ? "is-featured" : ""} key={feature.title}>
                <a href={feature.articleUrl} target="_blank" rel="noreferrer">
                  <div className="article-image">
                    <img src={assetUrl(feature.image)} alt="" loading="lazy" />
                    <span>{feature.tag}</span>
                  </div>
                  <div className="article-copy">
                    <small>{feature.readTime}</small>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                    <strong>Читать статью →</strong>
                  </div>
                </a>
                <a
                  className="section-link"
                  href={feature.sectionUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Все материалы рубрики
                </a>
                <ShareLinks url={feature.articleUrl} title={feature.title} />
              </article>
            ))}
          </div>
          <div className="journal-engagement">
            <div>
              <span className="section-kicker">Обсуждение номера</span>
              <h3>Статья заканчивается, разговор — продолжается</h3>
              <p>
                Оценки и комментарии привязаны к конкретной публикации. Авторский
                текст остаётся неизменным, а читательская дискуссия живёт отдельно.
              </p>
            </div>
            <ArticleEngagement
              articleSlug="opinion-hells-angels"
              compact
            />
          </div>
        </section>

        <Suspense
          fallback={
            <section className="article-library is-loading">
              <div className="article-library-empty">Собираем авторский архив…</div>
            </section>
          }
        >
          <ArticleLibrarySection />
        </Suspense>

        <section className="community-section" id="community">
          <div className="community-illustration" aria-hidden="true" />
          <div className="community-copy">
            <span className="section-kicker">Литературное сообщество</span>
            <h2>Клуб внимательных читателей</h2>
            <p>
              Форум для обстоятельного разговора о книгах, переводах и
              экранизациях. Без случайных виджетов: единый профиль, содержательные
              комментарии, рейтинги и редакционная модерация.
            </p>
            <ul>
              <li>Обсуждения книг и публикаций журнала</li>
              <li>Оценки материалов и произведений</li>
              <li>Профиль читателя и история участия</li>
            </ul>
            <div>
              <button type="button" onClick={() => openCommunity("forum")}>
                Открыть форум
              </button>
              {!user && (
                <button type="button" onClick={() => openCommunity("account")}>
                  Вступить в клуб
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="authors-section" id="authors">
          <header className="section-heading">
            <div>
              <span className="section-kicker">Лица мировой литературы</span>
              <h2>Авторы, с которых можно начать</h2>
            </div>
          </header>

          <div className="author-showcase">
            {featuredAuthors.map(({ country, writer }) => (
              <article key={`${country.id}-${writer.id}`}>
                <button
                  type="button"
                  onClick={() => selectCountry(country, true, writer)}
                >
                  <img
                    src={assetUrl(writer.portrait || "")}
                    alt={writerName(writer)}
                    loading="lazy"
                  />
                  <span>
                    <small>{country.name}</small>
                    <strong>{writerName(writer)}</strong>
                    <em>{writer.years}</em>
                  </span>
                </button>
                <a
                  href={portraitSourceLinks[writer.id]}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Источник портрета: ${writerName(writer)}`}
                >
                  Источник изображения
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="sections-directory" id="sections">
          <header className="section-heading">
            <div>
              <span className="section-kicker">Навигация по журналу</span>
              <h2>Основные разделы</h2>
            </div>
          </header>
          <div>
            {sectionLinks.map((section) => (
              <a
                href={section.href}
                target="_blank"
                rel="noreferrer"
                key={section.title}
                style={{ "--section-art": `url(${assetUrl(section.image)})` } as React.CSSProperties}
              >
                <div>
                  <span>{section.number}</span>
                  <h3>{section.title}</h3>
                  <p>{section.copy}</p>
                  <i>→</i>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="calendar" className="calendar-section">
          <Suspense fallback={<div className="calendar-card">Собираем литературные даты…</div>}>
            <LiteraryCalendar
              countries={countryArchive}
              onCountrySelect={(country) => selectCountry(country, true)}
            />
          </Suspense>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <section className="footer-brand">
            <a href={import.meta.env.BASE_URL} aria-label="Проба Пера — главная">
              <img src={assetUrl("brand/probpera-logo.png")} alt="" />
              <span>
                <strong>Проба Пера</strong>
                <small>Литературный журнал и мировая энциклопедия</small>
              </span>
            </a>
            <p>
              Авторские статьи и единая интерактивная экосистема о мировой
              литературе: страны, писатели, книги, эпохи и разговор читателей.
            </p>
            <SocialLinks />
          </section>

          <nav className="footer-map" aria-label="Карта сайта">
            <section>
              <h2>Журнал</h2>
              <a href="https://probpera.ru/read">Все публикации</a>
              <a href="https://probpera.ru/read/page-article/page-books">
                Мнение о книге
              </a>
              <a href="https://probpera.ru/read/page-article/page-bookvsmovie">
                Книга и экранизация
              </a>
              <a href="https://probpera.ru/read/page-words">
                Редкие слова
              </a>
              <a href="https://probpera.ru/read/page-article/famous_prizes">
                Литературные премии
              </a>
            </section>
            <section>
              <h2>Энциклопедия</h2>
              <a href="#atlas">Литературная карта</a>
              <a href="#authors">Писатели</a>
              <a href="#books">Книжный архив</a>
              <a href="#calendar">Календарь событий</a>
              <a href="#about">Редакционный стандарт</a>
            </section>
            <section>
              <h2>Сообщество</h2>
              <button type="button" onClick={() => openCommunity("forum")}>
                Форум читателей
              </button>
              <button type="button" onClick={() => openCommunity("account")}>
                {user ? "Личный кабинет" : "Вход и регистрация"}
              </button>
              <a href="mailto:probperasite@yandex.ru">Связаться с редакцией</a>
              <a href="https://probpera.ru/contacts">Контакты</a>
            </section>
          </nav>
        </div>
        <div className="footer-bottom">
          <p>© 2026 «Проба Пера». Авторские публикации защищены законом.</p>
          <a href="mailto:probperasite@yandex.ru">probperasite@yandex.ru</a>
          <span>Независимый литературный журнал</span>
        </div>
      </footer>

      <CommunityHub
        open={communityOpen}
        initialView={communityView}
        onClose={() => setCommunityOpen(false)}
      />
    </div>
  );
}
