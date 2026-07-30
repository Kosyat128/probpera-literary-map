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
import GlobalSearch from "./components/GlobalSearch";
import HeaderArticlesMenu from "./components/HeaderArticlesMenu";
import InterfaceLanguageControl from "./components/InterfaceLanguageControl";
import CountryFlagIcon from "./components/CountryFlagIcon";
import {
  CmsHomepageBanners,
  CmsNavigationLinks,
} from "./components/CmsSiteChrome";
import SocialLinks from "./components/SocialLinks";
import type { Country, Writer } from "./data/countries";
import {
  buildBookArchive,
  getWriterWorkTitles,
  isCoverDisplayAllowed,
} from "./data/bookArchive";
import { auditCountryArchive } from "./data/countries/editorialAudit";
import ShareLinks from "./editorial/ShareLinks";
import { useInterfaceLanguage } from "./i18n/InterfaceLanguage";
import { articlePath, journalPath } from "./utils/articleRoutes";

const LiteraryWorldMap = lazy(() => import("./components/LiteraryWorldMap"));
const WriterPanel = lazy(() => import("./components/WriterPanel"));
const LiteraryCalendar = lazy(() => import("./components/LiteraryCalendar"));
const BookArchiveSection = lazy(
  () => import("./components/BookArchiveSection")
);
const ArticleLibrarySection = lazy(
  () => import("./components/ArticleLibrarySection")
);
const SectionsDirectory = lazy(
  () => import("./components/SectionsDirectory")
);
const CmsHomepageBlocks = lazy(() =>
  import("./components/CmsHomepageContent").then((module) => ({
    default: module.CmsHomepageBlocks,
  }))
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
    image:
      "https://static.tildacdn.com/tild3736-6164-4331-b035-613333656334/33c24c3b-9444-4c08-8.png",
    articleUrl: articlePath(
      "page--article--page--books--22",
      "Мнение о книге Хантера Томпсона «Ангелы ада»",
      "book-opinions"
    ),
    sectionUrl: journalPath("book-opinions"),
    readTime: "12 минут",
  },
  {
    tag: "Литературная карта мира",
    title: "Семь знаковых писателей Японии",
    description:
      "От классической традиции до современной прозы — маршрут по авторам, прославившим японскую литературу.",
    image:
      "https://static.tildacdn.com/tild3564-6330-4630-b434-383662326664/213421.jpg",
    articleUrl: articlePath(
      "page--article--page--writers--world--4",
      "«Литературная карта мира. 7 знаковых писателей, прославивших свою родину». Япония",
      "writers-world"
    ),
    sectionUrl: journalPath("writers-world"),
    readTime: "15 минут",
  },
  {
    tag: "Пополняем словарный запас",
    title: "Редкие слова, которые помогут вам расширить словарный запас",
    description:
      "Не словарь ради словаря, а живые значения, происхождение и примеры употребления в понятной редакционной подаче.",
    image:
      "https://static.tildacdn.com/tild3234-6463-4164-b834-393336393839/76122cbe-d6a0-45d5-a.png",
    articleUrl: journalPath("language"),
    sectionUrl: journalPath("language"),
    readTime: "9 минут",
  },
  {
    tag: "Профессии писателей",
    title: "Кем работали классики до литературной славы",
    description:
      "Неожиданные профессии зарубежных авторов и то, как жизненный опыт становился частью их будущих книг.",
    image:
      "https://static.tildacdn.com/tild6361-3732-4033-b231-316331353336/a15183d3-d8f6-48ad-b.png",
    articleUrl: articlePath(
      "page--article--first--profession--writers--2",
      "Зарубежные классики литературы и их профессии",
      "author-stories"
    ),
    sectionUrl: journalPath("author-stories"),
    readTime: "11 минут",
  },
];

const sectionLinks = [
  {
    id: "book-opinions",
    group: "Читать",
    title: "Мнение о книге",
    copy: "Редкие издания, классика и современная литература — с контекстом и без лишних спойлеров.",
    href: journalPath("book-opinions"),
    image:
      "https://static.tildacdn.com/tild3736-6164-4331-b035-613333656334/33c24c3b-9444-4c08-8.png",
  },
  {
    id: "screen-adaptations",
    group: "Читать",
    title: "Книга и экранизация",
    copy: "Сравниваем текст и экранную версию: что изменилось, что потерялось и что стало сильнее.",
    href: journalPath("screen-adaptations"),
    image:
      "https://static.tildacdn.com/tild3839-3364-4139-a434-386438386638/image.png",
  },
  {
    id: "book-guides",
    group: "Читать",
    title: "Книжный гид и подборки",
    copy: "Тематические маршруты для чтения: классика, современная проза и книги, к которым хочется вернуться.",
    href: journalPath("book-guides"),
    image:
      "https://static.tildacdn.com/tild3037-3130-4065-b839-653563653430/c471b0ab-eb22-48d7-8.png",
  },
  {
    id: "awards",
    group: "Энциклопедия",
    title: "Литературные премии",
    copy: "История крупнейших наград, лауреаты, произведения и культурный контекст.",
    href: journalPath("awards"),
    image:
      "https://static.tildacdn.com/tild6634-3234-4332-b438-663736316139/anastacia-dvi-HRPaX-.jpg",
  },
  {
    id: "writers-world",
    group: "Энциклопедия",
    title: "Биографии и судьбы писателей",
    copy: "Тщательные человеческие биографии: судьба, время, характер и главные тексты автора.",
    href: journalPath("writers-world"),
    image:
      "https://static.tildacdn.com/tild6361-3732-4033-b231-316331353336/a15183d3-d8f6-48ad-b.png",
  },
  {
    id: "literary-essays",
    group: "Культура и язык",
    title: "О литературе и культуре",
    copy: "Большие редакционные эссе о чтении, библиотеках, культурной памяти и будущем книги.",
    href: journalPath("literary-essays"),
    image:
      "https://static.tildacdn.com/tild3162-6534-4936-b966-633930633738/photo.jpg",
  },
  {
    id: "folklore",
    group: "Культура и язык",
    title: "Фольклор и мифология",
    copy: "Персонажи, сюжеты и образы устной традиции — от славянского фольклора до мировых мифологий.",
    href: journalPath("folklore"),
    image:
      "https://static.tildacdn.com/tild6262-3936-4061-b465-623133623265/image.png",
  },
  {
    id: "language",
    group: "Культура и язык",
    title: "Язык и редкие слова",
    copy: "История слов, точные значения и выразительные возможности русского языка без сухой словарной подачи.",
    href: journalPath("language"),
    image:
      "https://static.tildacdn.com/tild3234-6463-4164-b834-393336393839/76122cbe-d6a0-45d5-a.png",
  },
  {
    id: "author-stories",
    group: "Культура и язык",
    title: "Литературные истории",
    copy: "Необычные судьбы произведений, авторские замыслы, профессии писателей и культурные открытия.",
    href: journalPath("author-stories"),
    image:
      "https://static.tildacdn.com/tild6333-6433-4634-b862-666436373139/photo.png",
  },
  {
    id: "atlas",
    group: "Энциклопедия",
    title: "Литературная карта мира",
    copy: "Страны, национальные традиции и писатели, благодаря которым мировая литература говорит разными голосами.",
    href: "#atlas",
    image:
      "https://static.tildacdn.com/tild6138-3239-4335-b166-643935623330/123231.png",
  },
  {
    id: "books",
    group: "Энциклопедия",
    title: "Книжный архив",
    copy: "Книги связаны с авторами, странами, эпохами и статьями журнала — с фильтрами и редакционной проверкой обложек.",
    href: "#books",
    image:
      "https://static.tildacdn.com/tild6239-6339-4864-b864-333636623730/Dj.webp",
  },
  {
    id: "calendar",
    group: "События",
    title: "Литературный календарь",
    copy: "Дни рождения и памяти писателей с точными датами и быстрым переходом к карточке автора.",
    href: "#calendar",
    image: "brand/section-prizes.webp",
  },
];

const sectionMenuGroups = ["Читать", "Энциклопедия", "Культура и язык", "События"].map(
  (group) => ({
    group,
    sections: sectionLinks.filter((section) => section.group === group),
  })
);

const verifiedBookFacts = [
  {
    book: "«Алиса в Стране чудес»",
    fact:
      "Тираж первого издания 1865 года отозвали из-за качества печати иллюстраций Джона Тенниела. Из двух тысяч экземпляров успели раздать лишь около пятидесяти.",
    sourceLabel: "Библиотека Конгресса",
    sourceUrl:
      "https://blogs.loc.gov/loc/2016/05/lcm-page-from-the-past-alices-adventures-in-the-library-of-congress/",
  },
  {
    book: "«Разум и чувства»",
    fact:
      "Первый роман Джейн Остин вышел в 1811 году без имени писательницы: на титульном листе было указано только «By a Lady» — «Написано леди».",
    sourceLabel: "Британская библиотека",
    sourceUrl:
      "https://www.bl.uk/stories/blogs/posts/jane-austen-names-and-notability",
  },
  {
    book: "«Маленький принц»",
    fact:
      "Повесть впервые издали в Нью-Йорке 6 апреля 1943 года сразу на французском и английском языках. Французское издание появилось уже после войны — в 1946 году.",
    sourceLabel: "Национальная библиотека Франции",
    sourceUrl: "https://catalogue.bnf.fr/ark:/12148/cb11962706k",
  },
  {
    book: "«Замок Отранто»",
    fact:
      "Роман Хораса Уолпола 1764 года, считающийся первым готическим романом, первоначально вышел анонимно и выдавался за найденную средневековую рукопись.",
    sourceLabel: "Британская библиотека",
    sourceUrl:
      "https://www.bl.uk/stories/blogs/posts/spine-tingling-stories-in-the-blood-curdling-british-library",
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
  return writer.name || writer.fullName || "Автор";
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

function mediaUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : assetUrl(path);
}

export default function App() {
  const { user } = useAuth();
  const { language, t, countryName, number } = useInterfaceLanguage();
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);
  const [countryArchive, setCountryArchive] = useState<Country[]>([]);
  const [generatedEditorialQueue, setGeneratedEditorialQueue] = useState(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [atlasFilter, setAtlasFilter] = useState<AtlasFilter>("all");
  const [communityOpen, setCommunityOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [communityView, setCommunityView] =
    useState<CommunityView>("account");
  const atlasRef = useRef<HTMLElement>(null);
  const sectionsMenuCloseTimer = useRef<number | null>(null);

  const cancelSectionsMenuClose = useCallback(() => {
    if (sectionsMenuCloseTimer.current !== null) {
      window.clearTimeout(sectionsMenuCloseTimer.current);
      sectionsMenuCloseTimer.current = null;
    }
  }, []);

  useEffect(() => cancelSectionsMenuClose, [cancelSectionsMenuClose]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      import("./data/countries").then((module) => {
        if (active) {
          setCountryArchive(module.countries);
          setGeneratedEditorialQueue(module.generatedWriterDraftCount);
        }
      });
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "/" ||
        target?.matches("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      setGlobalSearchOpen(true);
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, []);

  const allWriters = useMemo(
    () => countryArchive.flatMap((country) => country.writers),
    [countryArchive]
  );
  const totalWriters = allWriters.length;
  const totalWorks = useMemo(
    () => new Set(allWriters.flatMap(getWriterWorkTitles)).size,
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
        [
          country.name,
          countryName(country.code, country.name),
          country.id,
          country.code,
        ]
          .filter(Boolean)
          .some((value) => normalizeSearch(value!).includes(query))
      )
      .sort((first, second) => first.name.localeCompare(second.name, "ru"))
      .slice(0, 9);
  }, [
    atlasFilter,
    countryArchive,
    countryName,
    filteredCountries,
    search,
  ]);

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
  const factOfDay = useMemo(() => {
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    return verifiedBookFacts[dayNumber % verifiedBookFacts.length];
  }, []);

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
        <span>{t("Литературный журнал и энциклопедия")}</span>
        <p>{t("Архив пополняется ежедневно")}</p>
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
            <small>{t("Литературный журнал")}</small>
          </span>
        </a>

        <nav aria-label={t("Основная навигация")}>
          <a href="#atlas">{t("Карта")}</a>
          <HeaderArticlesMenu language={language} />
          <details
            className="sections-menu"
            onPointerEnter={cancelSectionsMenuClose}
            onPointerLeave={(event) => {
              if (event.pointerType !== "mouse") return;
              const details = event.currentTarget;
              cancelSectionsMenuClose();
              sectionsMenuCloseTimer.current = window.setTimeout(() => {
                if (!details.matches(":hover")) details.removeAttribute("open");
                sectionsMenuCloseTimer.current = null;
              }, 140);
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                event.currentTarget.removeAttribute("open");
              }
            }}
          >
            <summary>
              {t("Разделы")} <span aria-hidden="true">⌄</span>
            </summary>
            <div className="sections-mega-menu">
              <header>
                <span>{t("Навигация по «Пробе Пера»")}</span>
                <strong>{t("Все темы и разделы сайта")}</strong>
                <p>
                  {t(
                    "От редакционных статей до мировой литературной энциклопедии."
                  )}
                </p>
              </header>
              <div className="sections-mega-groups">
                {sectionMenuGroups.map(({ group, sections }) => (
                  <section key={group}>
                    <h3>{t(group)}</h3>
                    {sections.map((section) => (
                      <a
                        href={section.href}
                        key={section.id}
                        onClick={(event) =>
                          event.currentTarget.closest("details")?.removeAttribute("open")
                        }
                      >
                        <strong>{t(section.title)}</strong>
                        <small>{t(section.copy)}</small>
                      </a>
                    ))}
                  </section>
                ))}
              </div>
              <footer>
                <a
                  href="#sections"
                  onClick={(event) =>
                    event.currentTarget.closest("details")?.removeAttribute("open")
                  }
                >
                  {t("Открыть интерактивный каталог")}{" "}
                  <span aria-hidden="true">→</span>
                </a>
              </footer>
            </div>
          </details>
          <a href="#calendar">{t("Календарь")}</a>
          <button type="button" onClick={() => openCommunity("forum")}>
            {t("Форум")}
          </button>
          <a href="#about">{t("О проекте")}</a>
          <CmsNavigationLinks location="header" />
        </nav>

        <div className="header-actions">
          <button
            className="global-search-trigger"
            type="button"
            onClick={() => setGlobalSearchOpen(true)}
            aria-label={t("Открыть единый поиск")}
          >
            <span aria-hidden="true">⌕</span>
            <small>{t("Поиск")}</small>
            <kbd>/</kbd>
          </button>
          <InterfaceLanguageControl />
          <SocialLinks />
          <button
            className="reader-button"
            type="button"
            onClick={() => openCommunity("account")}
          >
            <span>
              {readerName.slice(0, 1).toUpperCase() || (
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path d="M12 12.3a4.15 4.15 0 1 0 0-8.3 4.15 4.15 0 0 0 0 8.3Zm-7 7.1c.8-3.3 3.45-5.15 7-5.15s6.2 1.85 7 5.15" />
                </svg>
              )}
            </span>
            {readerName || t("Войти")}
          </button>
        </div>
      </header>

      <nav className="mobile-nav" aria-label={t("Быстрая навигация")}>
        <a href="#atlas">{t("Карта")}</a>
        <a href="#journal">{t("Статьи")}</a>
        <a href="#books">{t("Книги")}</a>
        <a href="#sections">{t("Разделы")}</a>
        <a href="#calendar">{t("Календарь")}</a>
        <button type="button" onClick={() => openCommunity("forum")}>
          {t("Форум")}
        </button>
        <button type="button" onClick={() => setGlobalSearchOpen(true)}>
          {t("Поиск")}
        </button>
      </nav>

      <main>
        <CmsHomepageBanners />
        <section className="magazine-hero">
          <div className="hero-editorial">
            <span className="section-kicker">
              {t("Журнал о литературе и искусстве слова")}
            </span>
            <h1>
              {t("Литература —")}
              <br />
              <em>{t("это целый мир.")}</em>
            </h1>
            <p>
              {t(
                "Статьи, биографии, редкие книги и первая интерактивная литературная энциклопедия стран — в одном редакционном пространстве."
              )}
            </p>
            <div className="hero-actions">
              <a className="primary-action" href="#atlas">
                {t("Открыть глобус")} <span>→</span>
              </a>
              <a className="secondary-action" href={journalPath()}>
                {t("Читать журнал")}
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <strong>
                  {countryArchive.length ? number(countryArchive.length) : "…"}
                </strong>{" "}
                {t("стран")}
              </span>
              <span>
                <strong>{totalWriters ? number(totalWriters) : "…"}</strong>{" "}
                {t("писателей")}
              </span>
              <span>
                <strong>{totalWorks ? number(totalWorks) : "…"}</strong>{" "}
                {t("произведений")}
              </span>
            </div>
          </div>

          <div className="hero-cover">
            <img
              src={assetUrl("brand/magazine-cover.webp")}
              alt={t("Журнал «Проба Пера»")}
              width="1680"
              height="1260"
            />
            <span>{t("Литературный журнал · с 2025 года")}</span>
          </div>
        </section>

        <Suspense fallback={null}>
          <CmsHomepageBlocks />
        </Suspense>

        <section className="atlas-section" id="atlas" ref={atlasRef}>
          <header className="atlas-heading">
            <div>
              <span className="section-kicker">
                {t("Интерактивная энциклопедия")}
              </span>
              <h2>{t("Литературная карта мира")}</h2>
              <p>
                {t(
                  "Выберите страну на старинном глобусе — откроются писатели, произведения, эпохи и проверенная редакционная справка."
                )}
              </p>
            </div>

            <div
              className={`country-search${searchOpen ? " is-open" : ""}`}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            >
              <label htmlFor="country-search">{t("Найти страну")}</label>
              <div className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  id="country-search"
                  value={search}
                  placeholder={
                    selectedCountry
                      ? countryName(selectedCountry.code, selectedCountry.name)
                      : t("Россия, Франция, Япония…")
                  }
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
                    {search ? t("Результаты поиска") : t("Избранные архивы")}
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
                        <span>
                          <CountryFlagIcon
                            className="country-result-flag"
                            code={country.code}
                            countryName={country.name}
                            size={24}
                            decorative
                          />
                          {countryName(country.code, country.name)}
                        </span>
                        <small>
                          {number(country.writers.length)}{" "}
                          {language === "en"
                            ? country.writers.length === 1
                              ? "writer"
                              : "writers"
                            : pluralRu(country.writers.length, [
                                "автор",
                                "автора",
                                "авторов",
                              ])}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>{t("Страна не найдена в выбранной коллекции.")}</p>
                  )}
                </div>
              )}
            </div>
          </header>

          <div className="atlas-toolbar">
            <div className="atlas-filters" aria-label={t("Фильтры глобуса")}>
              {(
                [
                  ["all", "Все страны"],
                  ["nobel", "Нобелевские лауреаты"],
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
                  {t(label)} <span>{number(filterCounts[value])}</span>
                </button>
              ))}
            </div>

            <div className="atlas-ranking">
              <span>{t("Крупнейшие архивы")}</span>
              {topCountries.map((country) => (
                <button type="button" key={country.id} onClick={() => selectCountry(country)}>
                  {countryName(country.code, country.name)}
                  <small>{number(country.writers.length)}</small>
                </button>
              ))}
            </div>
          </div>

          <div className={`atlas-layout${selectedCountry ? " has-country" : ""}`}>
            <section className="globe-column" id="globe-stage">
              <div className="globe-copy">
                <span>{t("Музейный глобус · ручная навигация")}</span>
                <p>
                  {language === "en" ? (
                    <>
                      {number(filteredCountries.length)}{" "}
                      {filteredCountries.length === 1 ? "country" : "countries"} in
                      this collection
                    </>
                  ) : (
                    <>
                      В выбранной коллекции — {number(filteredCountries.length)}{" "}
                      {pluralRu(filteredCountries.length, [
                        "страна",
                        "страны",
                        "стран",
                      ])}
                    </>
                  )}
                </p>
              </div>
              <div className="atlas-ornaments" aria-hidden="true">
                <span className="atlas-coordinate">
                  <small>Архив мира</small>
                  <strong>55°45′ N · 37°37′ E</strong>
                </span>
                <span className="atlas-compass">
                  <i>С</i>
                  <b>✦</b>
                  <i>Ю</i>
                </span>
                <span className="atlas-edition">
                  <small>Издание</small>
                  <strong>MMXXVI</strong>
                </span>
              </div>

              {filteredCountries.length > 0 ? (
                <Suspense
                  fallback={
                    <div className="globe-loading" role="status">
                      <span aria-hidden="true">✦</span>
                      <p>{t("Открываем мировой атлас…")}</p>
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
                  <p>{t("В этой коллекции пока нет стран")}</p>
                </div>
              )}
            </section>

            {selectedCountry && (
              <Suspense
                fallback={
                  <div className="country-panel panel-loading">
                    {t("Открываем архив…")}
                  </div>
                }
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
          <details className="atlas-country-index">
            <summary>
              {t("Текстовый указатель стран")}
              <span>{number(filteredCountries.length)}</span>
            </summary>
            <div>
              {filteredCountries
                .slice()
                .sort((first, second) => first.name.localeCompare(second.name, "ru"))
                .map((country) => (
                  <button
                    type="button"
                    key={country.id}
                    onClick={() => selectCountry(country, true)}
                  >
                    <span>
                      <CountryFlagIcon
                        className="country-result-flag"
                        code={country.code}
                        countryName={country.name}
                        size={24}
                        decorative
                      />
                      {countryName(country.code, country.name)}
                    </span>
                    <small>
                      {number(country.writers.length)}{" "}
                      {language === "en"
                        ? country.writers.length === 1
                          ? "writer"
                          : "writers"
                        : pluralRu(country.writers.length, [
                            "автор",
                            "автора",
                            "авторов",
                          ])}
                    </small>
                  </button>
                ))}
            </div>
          </details>
        </section>

        <section className="daily-grid painted-paper-section" id="book-day">
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
                  <small>{t("Источник обложки")}</small>
                </a>
              ) : (
                <>
                  <span>Проба Пера</span>
                  <strong>{bookOfDay?.title || t("Книга дня")}</strong>
                  <i>✦</i>
                </>
              )}
            </div>
            <div>
              <span className="section-kicker">{t("Выбор энциклопедии")}</span>
              <h3>{t("Книга дня")}</h3>
              <h4>{bookOfDay?.title || t("Открываем библиотеку…")}</h4>
              <p>
                {bookOfDay
                  ? `${writerName(bookOfDay.writer)} · ${bookOfDay.country.name}. ${
                      bookOfDay.description ||
                      t(
                        "Начните литературное путешествие с одного из ключевых произведений национальной традиции."
                      )
                    }`
                  : t(
                      "Каждый день энциклопедия выбирает новое произведение из единой базы стран."
                    )}
              </p>
              {bookOfDay?.tags && (
                <div className="book-tags" aria-label={t("Темы книги")}>
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
                    {t("Открыть автора и страну")} <span>→</span>
                  </button>
                  {bookOfDay.sourceUrl && (
                    <a href={bookOfDay.sourceUrl} target="_blank" rel="noreferrer">
                      {t("Источник сведений")}
                    </a>
                  )}
                </div>
              )}
            </div>
          </article>

          <article className="editorial-standard" id="about">
            <span className="section-kicker">{t("Редакционный стандарт")}</span>
            <h3>{t("Материал, которому можно доверять")}</h3>
            <p>
              {t(
                "Полное имя, проверяемые даты, человеческая биография, ключевые произведения и открытые источники. Сомнительные сведения не маскируются уверенным тоном."
              )}
            </p>
            <ul>
              <li>
                {language === "en" ? (
                  <>
                    {number(editorialAudit.verifiedWriters)} writer{" "}
                    {editorialAudit.verifiedWriters === 1 ? "profile has" : "profiles have"}{" "}
                    been checked against open museum sources
                  </>
                ) : (
                  <>
                    {number(editorialAudit.verifiedWriters)}{" "}
                    {pluralRu(editorialAudit.verifiedWriters, [
                      "карточка",
                      "карточки",
                      "карточек",
                    ])} уже{" "}
                    {editorialAudit.verifiedWriters === 1 ? "прошла" : "прошли"}{" "}
                    проверку по открытым музейным источникам
                  </>
                )}
              </li>
              <li>
                {language === "en" ? (
                  <>
                    {number(editorialAudit.portraitedWriters)} documentary{" "}
                    {editorialAudit.portraitedWriters === 1 ? "portrait is" : "portraits are"}{" "}
                    connected without generated faces
                  </>
                ) : (
                  <>
                    {number(editorialAudit.portraitedWriters)}{" "}
                    {pluralRu(editorialAudit.portraitedWriters, [
                      "документальный портрет",
                      "документальных портрета",
                      "документальных портретов",
                    ])}{" "}
                    {editorialAudit.portraitedWriters === 1
                      ? "подключён"
                      : "подключены"}{" "}
                    без генерации лиц
                  </>
                )}
              </li>
              <li>
                {language === "en" ? (
                  <>
                    {number(
                      editorialAudit.recordsNeedingReview +
                        generatedEditorialQueue
                    )}{" "}
                    records remain in editorial review; automatically assembled drafts
                    are not published before manual verification
                  </>
                ) : (
                  <>
                    Ещё{" "}
                    {number(
                      editorialAudit.recordsNeedingReview +
                        generatedEditorialQueue
                    )}{" "}
                    {pluralRu(
                      editorialAudit.recordsNeedingReview +
                        generatedEditorialQueue,
                      ["запись", "записи", "записей"]
                    )}{" "}
                    {editorialAudit.recordsNeedingReview +
                      generatedEditorialQueue ===
                    1
                      ? "остаётся"
                      : "остаются"}{" "}
                    в редакционной очереди; автоматически собранные черновики не
                    публикуются до ручной проверки
                  </>
                )}
              </li>
            </ul>
          </article>

          <article className="book-fact-card">
            <div className="book-fact-orbit" aria-hidden="true">
              <span>✦</span>
              <i />
            </div>
            <div>
              <span className="section-kicker">{t("Интересный факт о книге")}</span>
              <h3>{factOfDay.book}</h3>
              <p>{factOfDay.fact}</p>
              <a
                href={factOfDay.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("Проверить источник")} · {factOfDay.sourceLabel} ↗
              </a>
            </div>
          </article>
        </section>

        <Suspense
          fallback={
            <section className="book-archive-section">
              <div className="book-archive-empty">
                <strong>{t("Собираем книжный архив…")}</strong>
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
              <span className="section-kicker">{t("Новые публикации")}</span>
              <h2>{t("Читать в «Пробе Пера»")}</h2>
            </div>
            <a href={journalPath()}>
              {t("Все публикации")} <span>→</span>
            </a>
          </header>

          <div className="editorial-grid">
            {editorialFeatures.map((feature, index) => (
              <article className={index === 0 ? "is-featured" : ""} key={feature.title}>
                <a href={feature.articleUrl}>
                  <div className="article-image">
                    <img
                      src={mediaUrl(feature.image)}
                      alt={`Иллюстрация к материалу «${feature.title}»`}
                      loading="lazy"
                    />
                    <span>{feature.tag}</span>
                  </div>
                  <div className="article-copy">
                    <small>{feature.readTime}</small>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                    <strong>{t("Читать статью")} →</strong>
                  </div>
                </a>
                <a
                  className="section-link"
                  href={feature.sectionUrl}
                >
                  {t("Все материалы рубрики")}
                </a>
                <ShareLinks url={feature.articleUrl} title={feature.title} />
              </article>
            ))}
          </div>
          <div className="journal-engagement">
            <div>
              <span className="section-kicker">{t("Обсуждение номера")}</span>
              <h3>{t("Статья заканчивается, разговор — продолжается")}</h3>
              <p>
                {t(
                  "Оценки и комментарии привязаны к конкретной публикации. Авторский текст остаётся неизменным, а читательская дискуссия живёт отдельно."
                )}
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
              <div className="article-library-empty">
                {t("Собираем авторский архив…")}
              </div>
            </section>
          }
        >
          <ArticleLibrarySection />
        </Suspense>

        <section className="community-section" id="community">
          <div className="community-illustration" aria-hidden="true" />
          <div className="community-copy">
            <span className="section-kicker">{t("Литературное сообщество")}</span>
            <h2>{t("Клуб внимательных читателей")}</h2>
            <p>
              {t(
                "Форум для обстоятельного разговора о книгах, переводах и экранизациях. Без случайных виджетов: единый профиль, содержательные комментарии, рейтинги и редакционная модерация."
              )}
            </p>
            <ul>
              <li>{t("Обсуждения книг и публикаций журнала")}</li>
              <li>{t("Оценки материалов и произведений")}</li>
              <li>{t("Профиль читателя и история участия")}</li>
            </ul>
            <div>
              <button type="button" onClick={() => openCommunity("forum")}>
                {t("Открыть форум")}
              </button>
              {!user && (
                <button type="button" onClick={() => openCommunity("account")}>
                  {t("Вступить в клуб")}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="authors-section painted-paper-section" id="authors">
          <header className="section-heading">
            <div>
              <span className="section-kicker">{t("Лица мировой литературы")}</span>
              <h2>{t("Авторы, с которых можно начать")}</h2>
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
                    <small>{countryName(country.code, country.name)}</small>
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
                  {t("Источник изображения")}
                </a>
              </article>
            ))}
          </div>
        </section>

        <section className="sections-directory" id="sections">
          <header className="section-heading">
            <div>
              <span className="section-kicker">{t("Навигация по журналу")}</span>
              <h2>{t("Основные разделы")}</h2>
            </div>
            <a className="sections-all-button" href={journalPath()}>
              {t("Полный архив публикаций")} <span>→</span>
            </a>
          </header>
          <Suspense
            fallback={
              <div className="section-loading">
                {t("Собираем каталог разделов…")}
              </div>
            }
          >
            <SectionsDirectory
              sections={sectionLinks}
              countryCount={countryArchive.length}
              bookCount={bookArchive.length}
            />
          </Suspense>
        </section>

        <section className="trust-center" id="editorial-policy">
          <header className="section-heading">
            <div>
              <span className="section-kicker">{t("Открытая редакция")}</span>
              <h2>{t("Как устроено доверие")}</h2>
              <p>
                {t(
                  "Читатель видит не только готовый текст, но и правила, по которым сведения попадают в энциклопедию."
                )}
              </p>
            </div>
            <a href="mailto:probperasite@yandex.ru?subject=Исправление%20в%20материале">
              {t("Сообщить об ошибке")} <span>→</span>
            </a>
          </header>
          <div>
            <details open>
              <summary>
                {t("Редакционная политика")}
              </summary>
              <p>
                {t(
                  "Авторские статьи сохраняют индивидуальный голос. Фактические утверждения, даты, имена и библиография проверяются отдельно; спорные сведения помечаются, а не выдаются за установленные."
                )}
              </p>
            </details>
            <details>
              <summary>
                {t("Источники и фактчекинг")}
              </summary>
              <p>
                {t(
                  "Приоритет получают библиотеки, музеи, архивы, научные издания и правообладатели. В карточках писателей и книг источник показывается рядом с подтверждаемым сведением."
                )}
              </p>
            </details>
            <details>
              <summary>
                {t("Иллюстрации и права")}
              </summary>
              <p>
                {t(
                  "Портреты не генерируются. Используются документальные изображения и легальные внешние превью; для обложек хранится источник, статус лицензии и дата последней проверки."
                )}
              </p>
            </details>
            <details>
              <summary>
                {t("Исправления и обновления")}
              </summary>
              <p>
                {t(
                  "Существенные исправления проходят редакционную проверку. Читатель может сообщить о неточности по почте, указав страницу, фрагмент и надёжный источник."
                )}
              </p>
            </details>
          </div>
        </section>

        <section id="calendar" className="calendar-section painted-paper-section">
          <Suspense
            fallback={
              <div className="calendar-card">
                {t("Собираем литературные даты…")}
              </div>
            }
          >
            <LiteraryCalendar
              countries={countryArchive}
              onCountrySelect={(country, writer) =>
                selectCountry(country, true, writer)
              }
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
                <small>{t("Литературный журнал и мировая энциклопедия")}</small>
              </span>
            </a>
            <p>
              {t(
                "Авторские статьи и единая интерактивная экосистема о мировой литературе: страны, писатели, книги, эпохи и разговор читателей."
              )}
            </p>
            <SocialLinks />
          </section>

          <nav className="footer-map" aria-label={t("Карта сайта")}>
            <section>
              <h2>{t("Журнал")}</h2>
              <a href={journalPath()}>{t("Все публикации")}</a>
              <a href={journalPath("book-opinions")}>
                {t("Мнение о книге")}
              </a>
              <a href={journalPath("screen-adaptations")}>
                {t("Книга и экранизация")}
              </a>
              <a href={journalPath("language")}>
                {t("Редкие слова")}
              </a>
              <a href={journalPath("awards")}>
                {t("Литературные премии")}
              </a>
            </section>
            <section>
              <h2>{t("Энциклопедия")}</h2>
              <a href="#atlas">{t("Литературная карта")}</a>
              <a href="#authors">{t("Писатели")}</a>
              <a href="#books">{t("Книжный архив")}</a>
              <a href="#calendar">{t("Календарь событий")}</a>
              <a href="#about">{t("Редакционный стандарт")}</a>
              <a href="#editorial-policy">{t("Источники и фактчекинг")}</a>
              <a href="#editorial-policy">{t("Исправления и авторские права")}</a>
            </section>
            <section>
              <h2>{t("Сообщество")}</h2>
              <button type="button" onClick={() => openCommunity("forum")}>
                {t("Форум читателей")}
              </button>
              <button type="button" onClick={() => openCommunity("account")}>
                {user ? t("Личный кабинет") : t("Вход и регистрация")}
              </button>
              <a href="mailto:probperasite@yandex.ru">
                {t("Связаться с редакцией")}
              </a>
              <a href="mailto:probperasite@yandex.ru">{t("Контакты")}</a>
            </section>
            <CmsNavigationLinks location="footer" withHeading />
          </nav>
        </div>
        <p className="graphics-attribution">
          Иконки государственных флагов основаны на графике{" "}
          <a
            href="https://github.com/twitter/twemoji"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twemoji
          </a>
          . © Twitter, Inc. и другие участники. Графика используется по лицензии{" "}
          <a
            href="https://creativecommons.org/licenses/by/4.0/"
            target="_blank"
            rel="license noopener noreferrer"
          >
            Creative Commons Attribution 4.0 International
          </a>
          . Изменения: круглая обрезка, преобразование и упаковка в SVG,
          добавление рамки, русских названий и метаданных.
        </p>
        <div className="footer-bottom">
          <p>© 2025–2026 «Проба Пера». Авторские публикации защищены законом.</p>
          <a href="mailto:probperasite@yandex.ru">probperasite@yandex.ru</a>
          <span>{t("Независимый литературный журнал")}</span>
        </div>
      </footer>

      <CommunityHub
        open={communityOpen}
        initialView={communityView}
        onClose={() => setCommunityOpen(false)}
      />

      <GlobalSearch
        open={globalSearchOpen}
        countries={countryArchive}
        books={bookArchive}
        onClose={() => setGlobalSearchOpen(false)}
        onCountrySelect={(country, writer) =>
          selectCountry(country, true, writer)
        }
        onBookSelect={(book) =>
          selectCountry(book.country, true, book.writer)
        }
      />
    </div>
  );
}
