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
import type { CommunityView } from "./community/CommunityHub";
import { useAuth } from "./community/AuthContext";
import GlobalSearch, { writerSearchLabel } from "./components/GlobalSearch";
import HeaderArticlesMenu from "./components/HeaderArticlesMenu";
import InterfaceLanguageControl from "./components/InterfaceLanguageControl";
import CountryFlagIcon from "./components/CountryFlagIcon";
import WriterPortrait from "./components/WriterPortrait";
import {
  CmsHomepageBanners,
  CmsNavigationLinks,
} from "./components/CmsSiteChrome";
import SocialLinks from "./components/SocialLinks";
import type { Country, Writer } from "./data/countries";
import { isNobelLaureate } from "./data/nobel";
import {
  buildBookArchive,
  coverArtworkSrcSet,
  isEditorialCover,
  isCoverArtworkDisplayAllowed,
  resolveBookArchivePublicTarget,
  type BookArchiveEntry,
} from "./data/bookArchive";
import { presentBookArchiveEntry } from "./data/bookArchiveQueue";
import { isPublicBook } from "./data/bookQuality";
import {
  selectBookMetadataLabels,
  selectBookText,
  selectBookWriterName,
  selectWriterDisplayName,
} from "./data/bookLocalization";
import { calculateArchiveStatistics } from "./data/archiveStatistics";
import { articleCatalogEntryForLanguage } from "./data/articles/localization";
import { auditCountryArchive } from "./data/countries/editorialAudit";
import {
  coreHomepageSectionClass,
  coreHomepageSectionStyle,
  getCoreHomepageSection,
} from "./data/cms/homepage";
import { cmsCoreFieldMarker, cmsEntityMarker } from "./cms/directEditBridge";
import ShareLinks from "./editorial/ShareLinks";
import {
  selectInterfacePlural,
  useInterfaceLanguage,
} from "./i18n/InterfaceLanguage";
import {
  articlePath,
  isDirectArticlePath,
  journalPath,
  navigateToArticle,
  navigateToJournal,
  shouldUseClientNavigation,
} from "./utils/articleRoutes";
import {
  getLocalMonthKey,
  getMonthlySelectionIndex,
} from "./utils/monthlySelection";
import {
  literarySearchMatches,
  literarySearchScore,
  normalizeLiterarySearch,
} from "./utils/literarySearch";
import { safePublicHref } from "./utils/publicHref";

const LiteraryWorldMap = lazy(() => import("./components/LiteraryWorldMap"));
const CommunityHub = lazy(() => import("./community/CommunityHub"));
const NobelArchiveStrip = lazy(() => import("./components/NobelArchiveStrip"));
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

type WriterFocusRequest = {
  countryId: string;
  writerId: string;
  token: number;
};

type AtlasSearchResult =
  | { type: "country"; key: string; country: Country; label: string; searchText: string }
  | { type: "writer"; key: string; country: Country; writer: Writer; label: string; searchText: string }
  | { type: "book"; key: string; country: Country; writer: Writer; book: BookArchiveEntry; label: string; searchText: string };

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
    tag: "Литературная планета",
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
    id: "journal",
    group: "Читать",
    title: "Все публикации журнала",
    copy: "Полный авторский архив: статьи, рецензии, эссе, литературные истории и тематические циклы.",
    href: journalPath(),
    image: "brand/magazine-cover.webp",
    metric: "all-articles" as const,
  },
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
    group: "Читать",
    title: "Рассказы и литературные истории",
    copy: "Авторские рассказы и эссе, судьбы произведений, писательские замыслы и культурные открытия.",
    href: journalPath("author-stories"),
    image:
      "https://static.tildacdn.com/tild6333-6433-4634-b862-666436373139/photo.png",
  },
  {
    id: "atlas",
    group: "Энциклопедия",
    title: "Литературная планета",
    copy: "Страны, национальные традиции и писатели, благодаря которым мировая литература говорит разными голосами.",
    href: "#atlas",
    image:
      "https://static.tildacdn.com/tild6138-3239-4335-b166-643935623330/123231.png",
    articleSections: ["writers-world"] as const,
  },
  {
    id: "books",
    group: "Энциклопедия",
    title: "Книжный архив",
    copy: "Книги связаны с авторами, странами, эпохами и статьями журнала — с фильтрами и редакционной проверкой обложек.",
    href: "#books",
    image:
      "https://static.tildacdn.com/tild6239-6339-4864-b864-333636623730/Dj.webp",
    articleSections: ["book-opinions", "book-guides"] as const,
  },
  {
    id: "calendar",
    group: "Сообщество и проект",
    title: "Литературный календарь",
    copy: "Дни рождения и памяти писателей с точными датами и быстрым переходом к карточке автора.",
    href: "#calendar",
    image: "brand/sections/literary-calendar.webp",
  },
  {
    id: "authors",
    group: "Сообщество и проект",
    title: "Указатель писателей",
    copy: "Быстрый вход в биографии, произведения и литературные связи авторов из энциклопедии.",
    href: "#authors",
    image: "brand/chekhov.png",
    articleSections: ["writers-world"] as const,
    metric: "writers" as const,
  },
  {
    id: "community",
    group: "Сообщество и проект",
    title: "Форум читателей",
    copy: "Обсуждения книг, статей, переводов и экранизаций с общей системой рейтинга и профилей.",
    href: "#community",
    image: "brand/sections/readers-forum.webp",
    action: "forum" as const,
    metric: "community" as const,
  },
  {
    id: "account",
    group: "Сообщество и проект",
    title: "Личный кабинет и библиотека",
    copy: "Сохранённые материалы, любимые книги, страны и писатели, оценки и история участия.",
    href: "#community",
    image: "brand/series-2.webp",
    action: "account" as const,
    metric: "account" as const,
  },
  {
    id: "about",
    group: "Сообщество и проект",
    title: "О проекте и редакции",
    copy: "Миссия «Пробы Пера», редакционный стандарт, источники, исправления и авторские права.",
    href: "#about",
    image: "brand/sections/about-editorial.webp",
    metric: "project" as const,
  },
];

const sectionMenuGroups = [
  "Читать",
  "Энциклопедия",
  "Культура и язык",
  "Сообщество и проект",
].map(
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

function writerName(
  writer: Writer,
  fallback = "Автор",
  language: "ru" | "en" = "ru"
) {
  return selectWriterDisplayName(writer, language, fallback);
}

function assetUrl(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function mediaUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : assetUrl(path);
}

function safeHomepageHref(value: string, fallback: string) {
  return safePublicHref(value, fallback);
}

export default function App() {
  const { user } = useAuth();
  const { language, t, countryName, number } = useInterfaceLanguage();
  const [currentPathname, setCurrentPathname] = useState(() =>
    typeof window === "undefined" ? "" : window.location.pathname
  );
  const directArticleRoute = isDirectArticlePath(currentPathname);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);
  const [writerFocusRequest, setWriterFocusRequest] =
    useState<WriterFocusRequest | null>(null);
  const [countryArchive, setCountryArchive] = useState<Country[]>([]);
  const [bookArchiveCountries, setBookArchiveCountries] = useState<Country[]>(
    []
  );
  const [articleCount, setArticleCount] = useState(0);
  const [generatedEditorialQueue, setGeneratedEditorialQueue] = useState(0);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [atlasFilter, setAtlasFilter] = useState<AtlasFilter>("all");
  const [nobelSpotlightCountryId, setNobelSpotlightCountryId] = useState<string | null>(null);
  const [communityOpen, setCommunityOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [requestedBook, setRequestedBook] =
    useState<BookArchiveEntry | null>(null);
  const [communityView, setCommunityView] =
    useState<CommunityView>("account");
  const atlasRef = useRef<HTMLElement>(null);
  const sectionsMenuCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    const syncRoute = () => setCurrentPathname(window.location.pathname);
    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("probpera:navigation", syncRoute);
    return () => {
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("probpera:navigation", syncRoute);
    };
  }, []);

  const cancelSectionsMenuClose = useCallback(() => {
    if (sectionsMenuCloseTimer.current !== null) {
      window.clearTimeout(sectionsMenuCloseTimer.current);
      sectionsMenuCloseTimer.current = null;
    }
  }, []);

  useEffect(() => cancelSectionsMenuClose, [cancelSectionsMenuClose]);

  useEffect(() => {
    if (directArticleRoute) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      import("./data/countries").then((module) => {
        if (active) {
          setCountryArchive(module.countries);
          setBookArchiveCountries(module.bookArchiveCountries);
          setGeneratedEditorialQueue(module.generatedWriterDraftCount);
        }
      });
    }, 240);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [directArticleRoute]);

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

  const archiveStatistics = useMemo(
    () => calculateArchiveStatistics(countryArchive),
    [countryArchive]
  );
  const totalWriters = archiveStatistics.uniqueWriters;
  const bookArchive = useMemo(
    () => buildBookArchive(bookArchiveCountries),
    [bookArchiveCountries]
  );
  const verifiedBookArchive = useMemo(
    () => bookArchive.filter(isPublicBook),
    [bookArchive]
  );
  // The archive counter includes both the 31 fully verified records and the
  // canonical editorial queue. Stable keys promote a record in place rather
  // than adding a second card for the same country/writer/work relation.
  const totalWorks = bookArchive.length;
  const editorialAudit = useMemo(
    () => auditCountryArchive(countryArchive),
    [countryArchive]
  );
  const readyBiographyCount =
    language === "en"
      ? editorialAudit.englishBiographiesReady
      : editorialAudit.russianBiographiesReady;
  const editorialQueueCount =
    editorialAudit.recordsNeedingReview + generatedEditorialQueue;

  const filteredCountries = useMemo(() => {
    if (atlasFilter === "all") return countryArchive;
    if (atlasFilter === "nobel") {
      return countryArchive.filter((country) =>
        country.writers.some(isNobelLaureate)
      );
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
      nobel: countryArchive.filter((country) =>
        country.writers.some(isNobelLaureate)
      ).length,
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

  const atlasSearchIndex = useMemo<AtlasSearchResult[]>(() => {
    const results: AtlasSearchResult[] = [];

    for (const country of countryArchive) {
      const localizedCountryName = countryName(country.code, country.name);
      results.push({
        type: "country",
        key: `country:${country.id}`,
        country,
        label: localizedCountryName,
        searchText: normalizeLiterarySearch(
          [
            country.name,
            localizedCountryName,
            country.id,
            country.code,
            country.region,
            country.continent,
            country.officialLanguage,
            ...(country.literaryPeriods || country.periods || []),
            ...(country.literaryMovements || []),
          ]
            .filter(Boolean)
            .join(" ")
        ),
      });

      for (const writer of country.writers) {
        const label = writerSearchLabel(writer, language);
        if (!label) continue;
        results.push({
          type: "writer",
          key: `writer:${country.id}:${writer.id}`,
          country,
          writer,
          label,
          searchText: normalizeLiterarySearch(
            [
              label,
              writer.name,
              writer.fullName,
              writer.movement,
              writer.literaryEra,
              writer.nationality,
              country.name,
              localizedCountryName,
              country.code,
              ...(writer.genres || []),
              ...(writer.tags || []),
            ]
              .filter(Boolean)
              .join(" ")
          ),
        });
      }
    }

    for (const book of bookArchive) {
      const displayedBook = presentBookArchiveEntry(book, language);
      const verified = isPublicBook(book);
      results.push({
        type: "book",
        key: `book:${book.countryId}:${book.writerId}:${book.id}`,
        country: book.country,
        writer: book.writer,
        book,
        label: displayedBook.title,
        searchText: normalizeLiterarySearch(
          [
            displayedBook.title,
            book.originalTitle,
            ...(book.alternateTitles || []),
            selectBookWriterName(book, language, t("Автор")),
            countryName(book.country.code, book.countryName),
            ...(verified
              ? [
                  displayedBook.description,
                  ...selectBookMetadataLabels(book, language, t),
                ]
              : []),
          ]
            .filter(Boolean)
            .join(" ")
        ),
      });
    }

    return results;
  }, [bookArchive, countryArchive, countryName, language, t]);

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
    const query = normalizeLiterarySearch(search);
    const source = atlasFilter === "all" ? countryArchive : filteredCountries;

    if (!query) {
      return featuredCountryIds
        .map((id) => source.find((country) => country.id === id))
        .filter((country): country is Country => Boolean(country))
        .map<AtlasSearchResult>((country) => ({
          type: "country",
          key: `country:${country.id}`,
          country,
          label: countryName(country.code, country.name),
          searchText: normalizeLiterarySearch(country.name),
        }));
    }

    const allowedIds = new Set(source.map((country) => country.id));
    return atlasSearchIndex
      .filter(
        ({ country, searchText }) =>
          allowedIds.has(country.id) &&
          literarySearchMatches(query, [searchText])
      )
      .map((result) => {
        const score = literarySearchScore(result.label, query);
        return { result, score };
      })
      .sort(
        (first, second) =>
          first.score - second.score ||
          first.result.label.localeCompare(second.result.label, "ru")
      )
      .map(({ result }) => result)
      .slice(0, 12);
  }, [
    atlasSearchIndex,
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

  const [selectionMonthKey, setSelectionMonthKey] = useState(() =>
    getLocalMonthKey()
  );

  useEffect(() => {
    const refreshMonth = () => setSelectionMonthKey(getLocalMonthKey());
    const intervalId = window.setInterval(refreshMonth, 60 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (directArticleRoute) return undefined;
    let active = true;
    import("./data/articles/catalog").then(({ articleCatalog }) => {
      if (active) {
        setArticleCount(
          articleCatalog.filter((article) =>
            articleCatalogEntryForLanguage(article, language)
          ).length
        );
      }
    });
    return () => {
      active = false;
    };
  }, [directArticleRoute, language]);

  const bookOfMonth = useMemo(() => {
    const premiumBooks = verifiedBookArchive.filter(
      (book) =>
        isCoverArtworkDisplayAllowed(book) &&
        Boolean(selectBookText(book, language).description) &&
        ["verified", "reviewed"].includes(book.editorial?.status || "")
    );
    const editorialBooks = verifiedBookArchive.filter((book) =>
      ["verified", "reviewed"].includes(book.editorial?.status || "")
    );
    const describedBooks = verifiedBookArchive.filter((book) =>
      Boolean(selectBookText(book, language).description)
    );
    const books = [
      ...(premiumBooks.length
        ? premiumBooks
        : editorialBooks.length
          ? editorialBooks
          : describedBooks.length
            ? describedBooks
            : verifiedBookArchive),
    ].sort((first, second) =>
      `${first.countryId}:${first.writerId}:${first.id}`.localeCompare(
        `${second.countryId}:${second.writerId}:${second.id}`
      )
    );
    if (!books.length) return null;
    return books[getMonthlySelectionIndex(books.length, selectionMonthKey)];
  }, [language, selectionMonthKey, verifiedBookArchive]);
  const bookOfMonthText = bookOfMonth
    ? selectBookText(bookOfMonth, language)
    : null;
  const bookOfMonthHasCover = Boolean(
    bookOfMonth && isCoverArtworkDisplayAllowed(bookOfMonth)
  );
  const factOfDay = useMemo(() => {
    const dayNumber = Math.floor(Date.now() / 86_400_000);
    return verifiedBookFacts[dayNumber % verifiedBookFacts.length];
  }, []);

  const openBook = useCallback((book: BookArchiveEntry) => {
    setRequestedBook(book);
  }, []);

  const selectCountry = useCallback(
    (country: Country, focusAtlas = false, writer?: Writer) => {
      setSelectedCountry(country);
      setSelectedWriter(writer ?? country.writers[0] ?? null);
      setNobelSpotlightCountryId((current) =>
        current && current !== country.id ? null : current
      );
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

  const selectWriterAndFocus = useCallback(
    (country: Country, writer: Writer) => {
      selectCountry(country, false, writer);
      setWriterFocusRequest((current) => ({
        countryId: country.id,
        writerId: writer.id,
        token: (current?.token || 0) + 1,
      }));
    },
    [selectCountry]
  );

  const selectBookWriterAndCountry = useCallback(
    (book: BookArchiveEntry, focusAtlas = true) => {
      const target = resolveBookArchivePublicTarget(countryArchive, book);
      if (!target) return;
      selectCountry(target.country, focusAtlas, target.writer);
    },
    [countryArchive, selectCountry]
  );

  const selectAtlasSearchResult = useCallback(
    (result: AtlasSearchResult) => {
      if (result.type === "book") {
        selectBookWriterAndCountry(result.book, false);
        openBook(result.book);
        return;
      }
      if (result.type === "writer") {
        selectWriterAndFocus(result.country, result.writer);
        return;
      }
      selectCountry(result.country);
    },
    [openBook, selectBookWriterAndCountry, selectCountry, selectWriterAndFocus]
  );

  const closeCountry = useCallback(() => {
    setSelectedCountry(null);
    setSelectedWriter(null);
    setWriterFocusRequest(null);
    setNobelSpotlightCountryId(null);
  }, []);

  const selectGlobeWriter = useCallback(async (writer: Writer | null) => {
    if (!writer) {
      setSelectedWriter(null);
      return;
    }
    if (isNobelLaureate(writer)) {
      const { findNobelArticle } = await import("./data/articles/nobelArticles");
      const article = findNobelArticle(writer);
      if (article) {
        navigateToArticle(article);
        return;
      }
    }
    setSelectedWriter(writer);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(".country-panel .writer-detail")
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
          block: "start",
        });
    }, 80);
  }, []);

  const openCommunity = useCallback((view: CommunityView) => {
    setCommunityView(view);
    setCommunityOpen(true);
  }, []);

  const readerName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "";
  const coreHero = getCoreHomepageSection("hero");
  const customHeroTitle =
    language === "ru" && coreHero?.title
      ? coreHero.title
          .trim()
          .replace(
            /^Литература\s+[—–-]\s+это целый мир[.!]?$/iu,
            "Литература – это целый мир!"
          )
      : "";
  const customHeroTitleParts = customHeroTitle.match(
    /^(.+?)\s+[—–-]\s+(.+)$/u
  );
  const structuredHeroLead = customHeroTitleParts
    ? customHeroTitleParts[1].trim()
    : t("Литература –").replace(/\s*[—–-]\s*$/u, "").trim();
  const structuredHeroAccent = customHeroTitleParts
    ? customHeroTitleParts[2].trim()
    : t("это целый мир!").trim();
  const structuredHeroAccentParts = structuredHeroAccent.match(
    /^(.+\S)\s+(\S+)$/u
  );
  const structuredHeroDash = language === "ru" ? "– " : "";
  const coreAtlas = getCoreHomepageSection("atlas");
  const coreBookMonth = getCoreHomepageSection("book-month");
  const coreEditorialStandard = getCoreHomepageSection("editorial-standard");
  const coreFeaturedJournal = getCoreHomepageSection("featured-journal");
  const coreCommunity = getCoreHomepageSection("community");
  const coreAuthors = getCoreHomepageSection("authors");
  const coreSections = getCoreHomepageSection("sections");
  const coreTrust = getCoreHomepageSection("trust");
  const coreCalendar = getCoreHomepageSection("calendar");
  const coreSectionsHref = safeHomepageHref(
    coreSections?.buttonUrl || journalPath(),
    journalPath()
  );

  if (directArticleRoute) {
    return (
      <div className="magazine-app article-route-shell">
        <Suspense
          fallback={
            <div className="article-reader-suspense" role="status">
              {t("Открываем режим чтения…")}
            </div>
          }
        >
          <ArticleLibrarySection readerOnly />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="magazine-app">
      <div className="topline">
        <span>{t("Литературный журнал и энциклопедия")}</span>
        <p>{t("Архив пополняется ежедневно")}</p>
        <div aria-label={t("Проба Пера в цифрах")}>
          <span>{articleCount ? number(articleCount) : "…"} {t("публикаций")}</span>
          <span>
            {archiveStatistics.countries ? number(archiveStatistics.countries) : "…"}{" "}
            {t("стран")}
          </span>
        </div>
      </div>

      <header className="site-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label={t("Проба Пера — главная")}
        >
          <img
            src={assetUrl("brand/probpera-logo.png")}
            alt={t("Проба Пера")}
            width="68"
            height="68"
            loading="eager"
            decoding="async"
          />
          <span>
            <strong>{t("Проба Пера")}</strong>
            <small>{t("Литературный журнал")}</small>
          </span>
        </a>

        <nav aria-label={t("Основная навигация")}>
          <a href="#atlas">{t("Литературная планета")}</a>
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
                        onClick={(event) => {
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                          if (section.action) {
                            event.preventDefault();
                            openCommunity(section.action);
                            return;
                          }
                          if (
                            section.href.includes("#journal") &&
                            shouldUseClientNavigation(event)
                          ) {
                            event.preventDefault();
                            navigateToJournal(
                              section.id === "journal" ? "all" : section.id
                            );
                          }
                        }}
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
        <a href="#atlas">{t("Литературная планета")}</a>
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
        <CmsNavigationLinks location="header" mobile />
      </nav>

      <main>
        <CmsHomepageBanners />
        <section
          className={`magazine-hero${coreHomepageSectionClass(coreHero)}`}
          style={coreHomepageSectionStyle(coreHero)}
          {...cmsCoreFieldMarker(
            "hero",
            "backgroundMediaId",
            coreHero?.backgroundImageUrl || "",
            { kind: "image", label: "Фоновое изображение первого экрана" }
          )}
        >
          <div className="hero-editorial">
            <span
              className="section-kicker"
              {...cmsCoreFieldMarker(
                "hero",
                "eyebrow",
                coreHero?.eyebrow || "Журнал о литературе и искусстве слова",
                { label: "Надзаголовок первого экрана" }
              )}
            >
              {language === "ru" && coreHero?.eyebrow
                ? coreHero.eyebrow
                : t("Журнал о литературе и искусстве слова")}
            </span>
            <h1
              {...cmsCoreFieldMarker(
                "hero",
                "title",
                coreHero?.title || "Литература – это целый мир!",
                { label: "Заголовок первого экрана" }
              )}
            >
              {customHeroTitle && !customHeroTitleParts ? (
                customHeroTitle
              ) : (
                <>
                  <span className="hero-title-lead">{structuredHeroLead}</span>
                  <em className="hero-title-accent">
                    {structuredHeroAccentParts ? (
                      <>
                        <span className="hero-title-accent-line">
                          {structuredHeroDash}
                          {structuredHeroAccentParts[1]}
                        </span>
                        <span className="hero-title-accent-line">
                          {structuredHeroAccentParts[2]}
                        </span>
                      </>
                    ) : (
                      <>
                        {structuredHeroDash}
                        {structuredHeroAccent}
                      </>
                    )}
                  </em>
                </>
              )}
            </h1>
            <p
              {...cmsCoreFieldMarker(
                "hero",
                "description",
                coreHero?.description ||
                  "Статьи, биографии, редкие книги и первая интерактивная литературная энциклопедия стран — в одном редакционном пространстве.",
                { kind: "textarea", label: "Описание первого экрана" }
              )}
            >
              {language === "ru" && coreHero?.description
                ? coreHero.description
                : t(
                    "Статьи, биографии, редкие книги и первая интерактивная литературная энциклопедия стран — в одном редакционном пространстве."
                  )}
            </p>
            <div className="hero-actions">
              <a
                className="primary-action"
                href={safeHomepageHref(coreHero?.buttonUrl || "#atlas", "#atlas")}
                {...cmsCoreFieldMarker(
                  "hero",
                  "buttonText",
                  coreHero?.buttonText || "Открыть глобус",
                  { label: "Главная кнопка первого экрана" }
                )}
              >
                {language === "ru" && coreHero?.buttonText
                  ? coreHero.buttonText
                  : t("Открыть глобус")} {" "}
                <span>→</span>
              </a>
              <a className="secondary-action" href={journalPath()}>
                {t("Читать журнал")}
              </a>
            </div>
            <div className="hero-proof">
              <span>
                <strong>
                  {archiveStatistics.countries
                    ? number(archiveStatistics.countries)
                    : "…"}
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
            <picture>
              {!coreHero?.backgroundImageUrl && (
                <>
                  <source
                    media="(max-width: 680px)"
                    type="image/avif"
                    srcSet={assetUrl("brand/magazine-hero-mobile.avif?v=20260813-literary-nature-full")}
                  />
                  <source
                    media="(max-width: 680px)"
                    type="image/webp"
                    srcSet={assetUrl("brand/magazine-hero-mobile.webp?v=20260813-literary-nature-full")}
                  />
                  <source
                    type="image/avif"
                    srcSet={assetUrl("brand/magazine-hero-wide.avif?v=20260813-literary-nature-full")}
                  />
                </>
              )}
              <img
                src={
                  coreHero?.backgroundImageUrl ||
                  assetUrl("brand/magazine-hero-wide.webp?v=20260813-literary-nature-full")
                }
                alt=""
                width={coreHero?.backgroundImageUrl ? undefined : 1774}
                height={coreHero?.backgroundImageUrl ? undefined : 887}
                aria-hidden="true"
                loading="eager"
                decoding="async"
                fetchPriority="high"
              />
            </picture>
            <span>{t("Литературный журнал · с 2025 года")}</span>
          </div>
        </section>

        <Suspense fallback={null}>
          <CmsHomepageBlocks />
        </Suspense>

        <section
          className={`atlas-section${coreHomepageSectionClass(coreAtlas)}`}
          id="atlas"
          ref={atlasRef}
          style={coreHomepageSectionStyle(coreAtlas)}
          {...cmsCoreFieldMarker(
            "atlas",
            "backgroundMediaId",
            coreAtlas?.backgroundImageUrl || "",
            { kind: "image", label: "Фон литературной планеты" }
          )}
        >
          <header className="atlas-heading">
            <div>
              <span
                className="section-kicker"
                {...cmsCoreFieldMarker(
                  "atlas",
                  "eyebrow",
                  coreAtlas?.eyebrow || "Интерактивная энциклопедия",
                  { label: "Надзаголовок литературной планеты" }
                )}
              >
                {language === "ru" && coreAtlas?.eyebrow
                  ? coreAtlas.eyebrow
                  : t("Интерактивная энциклопедия")}
              </span>
              <h2
                {...cmsCoreFieldMarker(
                  "atlas",
                  "title",
                  coreAtlas?.title || "Литературная планета",
                  { label: "Заголовок литературной планеты" }
                )}
              >
                {language === "ru" && coreAtlas?.title
                  ? coreAtlas.title
                  : t("Литературная планета")}
              </h2>
              <p
                {...cmsCoreFieldMarker(
                  "atlas",
                  "description",
                  coreAtlas?.description ||
                    "Выберите страну на интерактивном глобусе — откроются писатели, произведения, эпохи и проверенная редакционная справка.",
                  { kind: "textarea", label: "Описание литературной планеты" }
                )}
              >
                {language === "ru" && coreAtlas?.description
                  ? coreAtlas.description
                  : t(
                      "Выберите страну на интерактивном глобусе — откроются писатели, произведения, эпохи и проверенная редакционная справка."
                    )}
              </p>
            </div>

            <div
              className={`country-search${searchOpen ? " is-open" : ""}`}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
            >
              <label htmlFor="country-search">{t("Найти страну, писателя или книгу")}</label>
              <div className="search-field">
                <span aria-hidden="true">⌕</span>
                <input
                  id="country-search"
                  role="combobox"
                  value={search}
                  placeholder={
                    selectedCountry
                      ? countryName(selectedCountry.code, selectedCountry.name)
                      : t("Россия, Достоевский, «Моби Дик»…")
                  }
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-haspopup="listbox"
                  aria-expanded={searchOpen}
                  aria-controls="country-results"
                  onClick={() => setSearchOpen(true)}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setSearchOpen(false);
                    if (event.key === "Enter" && searchResults[0]) {
                      event.preventDefault();
                      selectAtlasSearchResult(searchResults[0]);
                    }
                  }}
                />
                <kbd>↵</kbd>
              </div>

              {searchOpen && (
                <div className="search-results" id="country-results" role="listbox">
                  <span className="search-caption">
                    {search ? t("Результаты поиска") : t("Избранные архивы")}
                  </span>
                  {searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={
                          selectedCountry?.id === result.country.id &&
                          (result.type !== "writer" || selectedWriter?.id === result.writer.id)
                        }
                        key={result.key}
                        onPointerDown={(event) => {
                          event.preventDefault();
                        }}
                        onClick={() => selectAtlasSearchResult(result)}
                      >
                        <span>
                          {result.type === "country" ? (
                            <CountryFlagIcon
                              className="country-result-flag country-flag-icon--round"
                              code={result.country.code}
                              countryName={result.country.name}
                              size={24}
                              decorative
                            />
                          ) : result.type === "writer" ? (
                            <WriterPortrait
                              writer={result.writer}
                              className="country-result-portrait"
                              decorative
                            />
                          ) : (
                            <span className="country-result-book" aria-hidden="true">▤</span>
                          )}
                          {result.label}
                        </span>
                        <small>
                          {result.type === "country"
                            ? `${number(result.country.writers.length)} ${t(
                                selectInterfacePlural(result.country.writers.length, language, [
                                  "автор",
                                  "автора",
                                  "авторов",
                                ])
                              )}`
                            : result.type === "writer"
                              ? `${t("Писатель")} · ${countryName(result.country.code, result.country.name)}`
                              : `${t("Книга")} · ${selectBookWriterName(
                                  result.book,
                                  language,
                                  t("Автор")
                                )} · ${
                                  isPublicBook(result.book)
                                    ? t("проверено")
                                    : t("Не проверено")
                                }`}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>{t("Ничего не найдено в выбранной коллекции.")}</p>
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
                  ["portrait", "С реальными портретами"],
                  ["verified", "Есть проверенные карточки"],
                ] as Array<[AtlasFilter, string]>
              ).map(([value, label]) => (
                <button
                  className={atlasFilter === value ? "is-active" : ""}
                  type="button"
                  key={value}
                  data-atlas-filter={value}
                  aria-pressed={atlasFilter === value}
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

          {atlasFilter === "nobel" && (
            <Suspense fallback={null}>
              <NobelArchiveStrip
                countries={countryArchive}
                onLaureateSelect={(country, writer) =>
                  selectCountry(country, true, writer)
                }
              />
            </Suspense>
          )}

          <div className={`atlas-layout${selectedCountry ? " has-country" : ""}`}>
            <section className="globe-column" id="globe-stage">
              <div className="globe-copy">
                <span>{t("Интерактивный глобус · ручная навигация")}</span>
                <p>
                  {t("В выбранной коллекции —")} {number(filteredCountries.length)}{" "}
                  {t(
                    selectInterfacePlural(filteredCountries.length, language, [
                      "страна",
                      "страны",
                      "стран",
                    ])
                  )}
                </p>
              </div>
              <div className="atlas-ornaments" aria-hidden="true">
                <span className="atlas-coordinate">
                  <small>{t("Архив мира")}</small>
                  <strong>55°45′ N · 37°37′ E</strong>
                </span>
                <span className="atlas-compass">
                  <i>{t("С")}</i>
                  <b>✦</b>
                  <i>{t("Ю")}</i>
                </span>
              </div>

              {filteredCountries.length > 0 ? (
                <Suspense
                  fallback={
                    <div className="globe-loading" role="status">
                      <span aria-hidden="true">✦</span>
                      <p>{t("Открываем «Литературную планету»…")}</p>
                    </div>
                  }
                >
                  <LiteraryWorldMap
                    countries={filteredCountries}
                    selectedCountry={selectedCountry}
                    selectedWriter={selectedWriter}
                    onCountrySelect={selectCountry}
                    onWriterSelect={selectGlobeWriter}
                    showNobelLaureates={
                      atlasFilter === "nobel" ||
                      nobelSpotlightCountryId === selectedCountry?.id
                    }
                    nobelCountryId={
                      atlasFilter === "nobel" ? null : nobelSpotlightCountryId
                    }
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
                  focusRequestId={
                    writerFocusRequest?.countryId === selectedCountry.id &&
                    writerFocusRequest.writerId === selectedWriter?.id
                      ? writerFocusRequest.token
                      : undefined
                  }
                  onWriterSelect={setSelectedWriter}
                  nobelSpotlightActive={
                    nobelSpotlightCountryId === selectedCountry.id
                  }
                  onNobelSpotlightToggle={() =>
                    setNobelSpotlightCountryId((current) =>
                      current === selectedCountry.id ? null : selectedCountry.id
                    )
                  }
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
                        className="country-result-flag country-flag-icon--round"
                        code={country.code}
                        countryName={country.name}
                        size={24}
                        decorative
                      />
                      {countryName(country.code, country.name)}
                    </span>
                    <small>
                      {number(country.writers.length)}{" "}
                      {t(
                        selectInterfacePlural(country.writers.length, language, [
                          "автор",
                          "автора",
                          "авторов",
                        ])
                      )}
                    </small>
                  </button>
                ))}
            </div>
          </details>
        </section>

        <section
          className={`daily-grid painted-paper-section${coreHomepageSectionClass(coreBookMonth)}`}
          id="book-day"
          style={coreHomepageSectionStyle(coreBookMonth)}
          {...cmsCoreFieldMarker(
            "book-month",
            "backgroundMediaId",
            coreBookMonth?.backgroundImageUrl || "",
            { kind: "image", label: "Фон блока книги месяца" }
          )}
        >
          <article
            className="book-of-day"
            {...(bookOfMonth
              ? cmsEntityMarker(
                  "book",
                  `${bookOfMonth.countryId}:${bookOfMonth.writerId}:${bookOfMonth.id}`,
                  bookOfMonthText?.title || bookOfMonth.title,
                  `/library?country_id=${encodeURIComponent(bookOfMonth.countryId)}&writer_id=${encodeURIComponent(bookOfMonth.writerId)}&work_id=${encodeURIComponent(`${bookOfMonth.countryId}:${bookOfMonth.writerId}:${bookOfMonth.id}`)}`
                )
              : {})}
          >
            <div
              className={`book-cover${bookOfMonthHasCover ? " has-image" : ""}`}
              style={
                bookOfMonth && bookOfMonthHasCover
                  ? { backgroundImage: `url("${bookOfMonth.coverThumbnailUrl || bookOfMonth.coverUrl}")` }
                  : undefined
              }
            >
              {bookOfMonth && bookOfMonthHasCover ? (
                isEditorialCover(bookOfMonth) ? (
                  <div className="book-cover-art">
                    <img
                      src={bookOfMonth.coverUrl}
                      srcSet={coverArtworkSrcSet(bookOfMonth)}
                      sizes="210px"
                      alt={`${t("Обложка книги")} «${bookOfMonthText?.title}»`}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <a
                    href={bookOfMonth.coverSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${t("Источник обложки")} “${bookOfMonthText?.title}”`}
                  >
                  <img
                    src={bookOfMonth.coverUrl}
                    srcSet={coverArtworkSrcSet(bookOfMonth)}
                    sizes="210px"
                    alt={`${t("Обложка книги")} “${bookOfMonthText?.title}”`}
                    loading="lazy"
                    decoding="async"
                  />
                  <small>{t("Источник обложки")}</small>
                  </a>
                )
              ) : (
                <>
                  <span>
                    {bookOfMonth
                      ? writerName(bookOfMonth.writer, t("Автор"), language)
                      : t("Книжный архив")}
                  </span>
                  <strong>{bookOfMonthText?.title || t("Книга месяца")}</strong>
                  <i>✦</i>
                </>
              )}
            </div>
            <div>
              <span
                className="section-kicker"
                {...cmsCoreFieldMarker(
                  "book-month",
                  "eyebrow",
                  coreBookMonth?.eyebrow || "Выбор энциклопедии",
                  { label: "Надзаголовок книги месяца" }
                )}
              >
                {language === "ru" && coreBookMonth?.eyebrow
                  ? coreBookMonth.eyebrow
                  : t("Выбор энциклопедии")}
              </span>
              <h3
                {...cmsCoreFieldMarker(
                  "book-month",
                  "title",
                  coreBookMonth?.title || "Книга месяца",
                  { label: "Заголовок блока книги месяца" }
                )}
              >
                {language === "ru" && coreBookMonth?.title
                  ? coreBookMonth.title
                  : t("Книга месяца")}
              </h3>
              <h4>{bookOfMonthText?.title || t("Открываем библиотеку…")}</h4>
              <p>
                {bookOfMonth
                  ? `${writerName(bookOfMonth.writer, t("Автор"), language)} · ${countryName(
                      bookOfMonth.country.code,
                      bookOfMonth.country.name
                    )}. ${
                      bookOfMonthText?.description ||
                      t(
                        "Начните литературное путешествие с одного из ключевых произведений национальной традиции."
                      )
                    }`
                  : language === "ru" && coreBookMonth?.description
                    ? coreBookMonth.description
                    : t(
                        "Каждый месяц энциклопедия выбирает новое произведение из единой базы стран."
                      )}
              </p>
              {bookOfMonth &&
                selectBookMetadataLabels(bookOfMonth, language, t).length > 0 && (
                <div className="book-tags" aria-label={t("Темы книги")}>
                  {selectBookMetadataLabels(bookOfMonth, language, t)
                    .slice(0, 4)
                    .map((tag) => (
                    <span key={tag}>{tag}</span>
                    ))}
                </div>
              )}
              {bookOfMonth && (
                <div className="book-actions">
                  <button type="button" onClick={() => openBook(bookOfMonth)}>
                    <span
                      {...cmsCoreFieldMarker(
                        "book-month",
                        "buttonText",
                        coreBookMonth?.buttonText || "О книге",
                        { label: "Кнопка книги месяца" }
                      )}
                    >
                      {language === "ru" && coreBookMonth?.buttonText
                        ? coreBookMonth.buttonText
                        : t("О книге")}
                    </span>{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      selectCountry(bookOfMonth.country, true, bookOfMonth.writer)
                    }
                  >
                    {t("Открыть автора и страну")} <span>→</span>
                  </button>
                  {bookOfMonth.sourceUrl && (
                    <a href={bookOfMonth.sourceUrl} target="_blank" rel="noreferrer">
                      {t("Источник сведений")}
                    </a>
                  )}
                </div>
              )}
            </div>
          </article>

          <article
            className={`editorial-standard${coreHomepageSectionClass(coreEditorialStandard)}`}
            id="about"
            style={coreHomepageSectionStyle(coreEditorialStandard)}
            {...cmsCoreFieldMarker(
              "editorial-standard",
              "backgroundMediaId",
              coreEditorialStandard?.backgroundImageUrl || "",
              { kind: "image", label: "Фон редакционного стандарта" }
            )}
          >
            <span
              className="section-kicker"
              {...cmsCoreFieldMarker(
                "editorial-standard",
                "eyebrow",
                coreEditorialStandard?.eyebrow || "Редакционный стандарт",
                { label: "Надзаголовок редакционного стандарта" }
              )}
            >
              {language === "ru" && coreEditorialStandard?.eyebrow
                ? coreEditorialStandard.eyebrow
                : t("Редакционный стандарт")}
            </span>
            <h3
              {...cmsCoreFieldMarker(
                "editorial-standard",
                "title",
                coreEditorialStandard?.title || "Материал, которому можно доверять",
                { label: "Заголовок редакционного стандарта" }
              )}
            >
              {language === "ru" && coreEditorialStandard?.title
                ? coreEditorialStandard.title
                : t("Материал, которому можно доверять")}
            </h3>
            <p
              {...cmsCoreFieldMarker(
                "editorial-standard",
                "description",
                coreEditorialStandard?.description ||
                  "Полное имя, проверяемые даты, человеческая биография, ключевые произведения и открытые источники. Сомнительные сведения не маскируются уверенным тоном.",
                { kind: "textarea", label: "Описание редакционного стандарта" }
              )}
            >
              {language === "ru" && coreEditorialStandard?.description
                ? coreEditorialStandard.description
                : t(
                    "Полное имя, проверяемые даты, человеческая биография, ключевые произведения и открытые источники. Сомнительные сведения не маскируются уверенным тоном."
                  )}
            </p>
            <ul>
              <li>
                {t(
                  selectInterfacePlural(readyBiographyCount, language, [
                    "{count} карточка уже прошла публикационную проверку по открытым авторитетным источникам",
                    "{count} карточки уже прошли публикационную проверку по открытым авторитетным источникам",
                    "{count} карточек уже прошли публикационную проверку по открытым авторитетным источникам",
                  ])
                ).replace("{count}", number(readyBiographyCount))}
              </li>
              <li>
                {t(
                  selectInterfacePlural(
                    editorialAudit.portraitedWriters,
                    language,
                    [
                      "{count} документальный портрет подключён без генерации лиц",
                      "{count} документальных портрета подключены без генерации лиц",
                      "{count} документальных портретов подключены без генерации лиц",
                    ]
                  )
                ).replace("{count}", number(editorialAudit.portraitedWriters))}
              </li>
              <li>
                {t(
                  selectInterfacePlural(editorialQueueCount, language, [
                    "Ещё {count} запись остаётся в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
                    "Ещё {count} записи остаются в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
                    "Ещё {count} записей остаются в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
                  ])
                ).replace("{count}", number(editorialQueueCount))}
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
              <h3>{t(factOfDay.book)}</h3>
              <p>{t(factOfDay.fact)}</p>
              <a
                href={factOfDay.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("Проверить источник")} · {t(factOfDay.sourceLabel)} ↗
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
            requestedBook={requestedBook}
            onRequestedBookHandled={() => setRequestedBook(null)}
            onBookSelect={selectBookWriterAndCountry}
          />
        </Suspense>

        <section
          className={`editorial-section${coreHomepageSectionClass(coreFeaturedJournal)}`}
          id="featured-journal"
          style={coreHomepageSectionStyle(coreFeaturedJournal)}
          {...cmsCoreFieldMarker(
            "featured-journal",
            "backgroundMediaId",
            coreFeaturedJournal?.backgroundImageUrl || "",
            { kind: "image", label: "Фон материалов журнала" }
          )}
        >
          <header className="section-heading">
            <div>
              <span
                className="section-kicker"
                {...cmsCoreFieldMarker(
                  "featured-journal",
                  "eyebrow",
                  coreFeaturedJournal?.eyebrow || "Новые публикации",
                  { label: "Надзаголовок материалов журнала" }
                )}
              >
                {language === "ru" && coreFeaturedJournal?.eyebrow
                  ? coreFeaturedJournal.eyebrow
                  : t("Новые публикации")}
              </span>
              <h2
                {...cmsCoreFieldMarker(
                  "featured-journal",
                  "title",
                  coreFeaturedJournal?.title || "Читать в «Пробе Пера»",
                  { label: "Заголовок материалов журнала" }
                )}
              >
                {language === "ru" && coreFeaturedJournal?.title
                  ? coreFeaturedJournal.title
                  : t("Читать в «Пробе Пера»")}
              </h2>
              {language === "ru" && coreFeaturedJournal?.description && (
                <p
                  {...cmsCoreFieldMarker(
                    "featured-journal",
                    "description",
                    coreFeaturedJournal.description,
                    { kind: "textarea", label: "Описание материалов журнала" }
                  )}
                >
                  {coreFeaturedJournal.description}
                </p>
              )}
            </div>
            <a
              href={safeHomepageHref(
                coreFeaturedJournal?.buttonUrl || journalPath(),
                journalPath()
              )}
            >
              {language === "ru" && coreFeaturedJournal?.buttonText
                ? coreFeaturedJournal.buttonText
                : t("Все публикации")} {" "}
              <span>→</span>
            </a>
          </header>

          <div className="editorial-grid">
            {editorialFeatures.map((feature, index) => (
              <article className={index === 0 ? "is-featured" : ""} key={feature.title}>
                <a href={feature.articleUrl}>
                  <div className="article-image">
                    <img
                      className="article-image-backdrop"
                      src={mediaUrl(feature.image)}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.hidden = true;
                      }}
                    />
                    <img
                      src={mediaUrl(feature.image)}
                      alt={`${t("Иллюстрация к материалу")} “${t(feature.title)}”`}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallbackApplied === "true") return;
                        event.currentTarget.dataset.fallbackApplied = "true";
                        event.currentTarget.classList.add("is-fallback");
                        event.currentTarget.alt = `${t(
                          "Фирменная обложка материала"
                        )} “${t(feature.title)}”`;
                        event.currentTarget.src = `${import.meta.env.BASE_URL}brand/probpera-logo.png`;
                      }}
                    />
                    <span>{t(feature.tag)}</span>
                  </div>
                  <div className="article-copy">
                    <small>{t(feature.readTime)}</small>
                    <h3>{t(feature.title)}</h3>
                    <p>{t(feature.description)}</p>
                    <strong>{t("Читать статью")} →</strong>
                  </div>
                </a>
                <a
                  className="section-link"
                  href={feature.sectionUrl}
                >
                  {t("Все материалы рубрики")}
                </a>
                <ShareLinks url={feature.articleUrl} title={t(feature.title)} />
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

        <section
          className={`community-section${coreHomepageSectionClass(coreCommunity)}`}
          id="community"
          style={coreHomepageSectionStyle(coreCommunity)}
          {...cmsCoreFieldMarker(
            "community",
            "backgroundMediaId",
            coreCommunity?.backgroundImageUrl || "",
            { kind: "image", label: "Фон сообщества" }
          )}
        >
          <div className="community-illustration">
            <div className="community-visual-intro">
              <span className="section-kicker">{t("Разговор после чтения")}</span>
              <blockquote>
                {t(
                  "Чтение становится событием, когда мысль продолжается в разговоре."
                )}
              </blockquote>
              <p>
                {t(
                  "Выберите тему, продолжите мысль из статьи или предложите собственный маршрут чтения."
                )}
              </p>
              <div className="community-visual-rule">
                <span>{t("Редакционный принцип клуба")}</span>
                <i aria-hidden="true" />
              </div>
            </div>
            <div className="community-reading-notes" aria-label={t("Темы для разговора")}>
              <span>{t("С чего начать разговор")}</span>
              <button type="button" onClick={() => openCommunity("forum")}>
                <i aria-hidden="true">01</i>
                <span>
                  <small>{t("Читательский дневник")}</small>
                  <strong>{t("Какая книга не отпускает вас сейчас?")}</strong>
                </span>
              </button>
              <button type="button" onClick={() => openCommunity("forum")}>
                <i aria-hidden="true">02</i>
                <span>
                  <small>{t("Искусство перевода")}</small>
                  <strong>{t("Когда перевод становится новой книгой")}</strong>
                </span>
              </button>
              <button type="button" onClick={() => openCommunity("forum")}>
                <i aria-hidden="true">03</i>
                <span>
                  <small>{t("Литературная планета")}</small>
                  <strong>{t("Соберите собственный маршрут чтения")}</strong>
                </span>
              </button>
            </div>
            <div
              className="community-visual-stats"
              aria-label={t("Энциклопедия сообщества")}
            >
              <span>
                <strong>
                  {totalWriters ? number(totalWriters) : "—"}
                </strong>
                <small>{t("авторов в энциклопедии")}</small>
              </span>
              <span>
                <strong>
                  {totalWorks ? number(totalWorks) : "—"}
                </strong>
                <small>{t("произведений в архиве")}</small>
              </span>
              <span>
                <strong>
                  {archiveStatistics.countries
                    ? number(archiveStatistics.countries)
                    : "—"}
                </strong>
                <small>{t("стран на карте")}</small>
              </span>
            </div>
          </div>
          <div className="community-copy">
            <span
              className="section-kicker"
              {...cmsCoreFieldMarker(
                "community",
                "eyebrow",
                coreCommunity?.eyebrow || "Литературное сообщество",
                { label: "Надзаголовок сообщества" }
              )}
            >
              {language === "ru" && coreCommunity?.eyebrow
                ? coreCommunity.eyebrow
                : t("Литературное сообщество")}
            </span>
            <h2
              {...cmsCoreFieldMarker(
                "community",
                "title",
                coreCommunity?.title || "Клуб внимательных читателей",
                { label: "Заголовок сообщества" }
              )}
            >
              {language === "ru" && coreCommunity?.title
                ? coreCommunity.title
                : t("Клуб внимательных читателей")}
            </h2>
            <p
              {...cmsCoreFieldMarker(
                "community",
                "description",
                coreCommunity?.description ||
                  "Место для спокойного и содержательного разговора о книгах — без шума и случайных рекомендаций. Здесь можно продолжить мысль из статьи, обсудить перевод, собрать читательский маршрут и сохранить историю собственного чтения.",
                { kind: "textarea", label: "Описание сообщества" }
              )}
            >
              {language === "ru" && coreCommunity?.description
                ? coreCommunity.description
                : t(
                    "Место для спокойного и содержательного разговора о книгах — без шума и случайных рекомендаций. Здесь можно продолжить мысль из статьи, обсудить перевод, собрать читательский маршрут и сохранить историю собственного чтения."
                  )}
            </p>
            <p className="community-copy-note">
              {t(
                "Читать обсуждения можно сразу. Профиль нужен только для участия в разговоре, оценок и личной библиотеки."
              )}
            </p>
            <ul>
              <li>{t("Разговоры о книгах, статьях, переводах и экранизациях")}</li>
              <li>{t("Оценки, комментарии и тематические подборки читателей")}</li>
              <li>{t("Личная библиотека, любимые авторы, страны и история участия")}</li>
            </ul>
            <div>
              <button
                type="button"
                onClick={() => openCommunity("forum")}
                {...cmsCoreFieldMarker(
                  "community",
                  "buttonText",
                  coreCommunity?.buttonText || "Открыть форум",
                  { label: "Кнопка сообщества" }
                )}
              >
                {language === "ru" && coreCommunity?.buttonText
                  ? coreCommunity.buttonText
                  : t("Открыть форум")}
              </button>
              {!user && (
                <button type="button" onClick={() => openCommunity("account")}>
                  {t("Вступить в клуб")}
                </button>
              )}
            </div>
          </div>
        </section>

        <section
          className={`authors-section painted-paper-section${coreHomepageSectionClass(coreAuthors)}`}
          id="authors"
          style={coreHomepageSectionStyle(coreAuthors)}
          {...cmsCoreFieldMarker(
            "authors",
            "backgroundMediaId",
            coreAuthors?.backgroundImageUrl || "",
            { kind: "image", label: "Фон блока писателей" }
          )}
        >
          <header className="section-heading">
            <div>
              <span
                className="section-kicker"
                {...cmsCoreFieldMarker(
                  "authors",
                  "eyebrow",
                  coreAuthors?.eyebrow || "Лица мировой литературы",
                  { label: "Надзаголовок блока писателей" }
                )}
              >
                {language === "ru" && coreAuthors?.eyebrow
                  ? coreAuthors.eyebrow
                  : t("Лица мировой литературы")}
              </span>
              <h2
                {...cmsCoreFieldMarker(
                  "authors",
                  "title",
                  coreAuthors?.title || "Авторы, с которых можно начать",
                  { label: "Заголовок блока писателей" }
                )}
              >
                {language === "ru" && coreAuthors?.title
                  ? coreAuthors.title
                  : t("Авторы, с которых можно начать")}
              </h2>
              {language === "ru" && coreAuthors?.description && (
                <p
                  {...cmsCoreFieldMarker(
                    "authors",
                    "description",
                    coreAuthors.description,
                    { kind: "textarea", label: "Описание блока писателей" }
                  )}
                >
                  {coreAuthors.description}
                </p>
              )}
            </div>
          </header>

          <div className="author-showcase">
            {featuredAuthors.map(({ country, writer }) => (
              <article
                key={`${country.id}-${writer.id}`}
                {...cmsEntityMarker(
                  "writer",
                  `${country.id}:${writer.id}`,
                  writerName(writer, "Автор", language),
                  `/library?country_id=${encodeURIComponent(country.id)}&writer_id=${encodeURIComponent(writer.id)}`
                )}
              >
                <button
                  type="button"
                  onClick={() => selectWriterAndFocus(country, writer)}
                >
                  <WriterPortrait
                    writer={writer}
                    className="author-showcase-portrait"
                  />
                  <span className="author-showcase-copy">
                    <small>{countryName(country.code, country.name)}</small>
                    <strong>{writerName(writer, t("Автор"), language)}</strong>
                    <em>{writer.years}</em>
                  </span>
                </button>
                {writer.portraitSourceUrl && (
                  <a
                    href={writer.portraitSourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${t("Источник портрета")}: ${writerName(
                      writer,
                      t("Автор"),
                      language
                    )}`}
                  >
                    {t("Источник изображения")}
                  </a>
                )}
              </article>
            ))}
          </div>
        </section>

        <section
          className={`sections-directory${coreHomepageSectionClass(coreSections)}`}
          id="sections"
          style={coreHomepageSectionStyle(coreSections)}
          {...cmsCoreFieldMarker(
            "sections",
            "backgroundMediaId",
            coreSections?.backgroundImageUrl || "",
            { kind: "image", label: "Фон каталога разделов" }
          )}
        >
          <header className="section-heading">
            <div>
              <span
                className="section-kicker"
                {...cmsCoreFieldMarker(
                  "sections",
                  "eyebrow",
                  coreSections?.eyebrow || "Навигация по журналу",
                  { label: "Надзаголовок каталога разделов" }
                )}
              >
                {language === "ru" && coreSections?.eyebrow
                  ? coreSections.eyebrow
                  : t("Навигация по журналу")}
              </span>
              <h2
                {...cmsCoreFieldMarker(
                  "sections",
                  "title",
                  coreSections?.title || "Основные разделы",
                  { label: "Заголовок каталога разделов" }
                )}
              >
                {language === "ru" && coreSections?.title
                  ? coreSections.title
                  : t("Основные разделы")}
              </h2>
              {language === "ru" && coreSections?.description && (
                <p
                  {...cmsCoreFieldMarker(
                    "sections",
                    "description",
                    coreSections.description,
                    { kind: "textarea", label: "Описание каталога разделов" }
                  )}
                >
                  {coreSections.description}
                </p>
              )}
            </div>
            <a
              className="sections-all-button"
              href={coreSectionsHref}
              {...cmsCoreFieldMarker(
                "sections",
                "buttonText",
                coreSections?.buttonText || "Полный архив публикаций",
                { label: "Кнопка каталога разделов" }
              )}
              onClick={(event) => {
                if (coreSectionsHref !== journalPath()) return;
                if (!shouldUseClientNavigation(event)) return;
                event.preventDefault();
                navigateToJournal();
              }}
            >
              {language === "ru" && coreSections?.buttonText
                ? coreSections.buttonText
                : t("Полный архив публикаций")} {" "}
              <span>→</span>
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
              countryCount={archiveStatistics.countries}
              bookCount={totalWorks}
              writerCount={totalWriters}
              onAction={openCommunity}
            />
          </Suspense>
        </section>

        <section
          className={`trust-center${coreHomepageSectionClass(coreTrust)}`}
          id="editorial-policy"
          style={coreHomepageSectionStyle(coreTrust)}
          {...cmsCoreFieldMarker(
            "trust",
            "backgroundMediaId",
            coreTrust?.backgroundImageUrl || "",
            { kind: "image", label: "Фон редакционной политики" }
          )}
        >
          <header className="section-heading">
            <div>
              <span
                className="section-kicker"
                {...cmsCoreFieldMarker(
                  "trust",
                  "eyebrow",
                  coreTrust?.eyebrow || "Открытая редакция",
                  { label: "Надзаголовок редакционной политики" }
                )}
              >
                {language === "ru" && coreTrust?.eyebrow
                  ? coreTrust.eyebrow
                  : t("Открытая редакция")}
              </span>
              <h2
                {...cmsCoreFieldMarker(
                  "trust",
                  "title",
                  coreTrust?.title || "Как устроено доверие",
                  { label: "Заголовок редакционной политики" }
                )}
              >
                {language === "ru" && coreTrust?.title
                  ? coreTrust.title
                  : t("Как устроено доверие")}
              </h2>
              <p
                {...cmsCoreFieldMarker(
                  "trust",
                  "description",
                  coreTrust?.description ||
                    "Читатель видит не только готовый текст, но и правила, по которым сведения попадают в энциклопедию.",
                  { kind: "textarea", label: "Описание редакционной политики" }
                )}
              >
                {language === "ru" && coreTrust?.description
                  ? coreTrust.description
                  : t(
                      "Читатель видит не только готовый текст, но и правила, по которым сведения попадают в энциклопедию."
                    )}
              </p>
            </div>
            <a
              href={safeHomepageHref(
                coreTrust?.buttonUrl ||
                  "mailto:probperasite@yandex.ru?subject=Исправление%20в%20материале",
                "mailto:probperasite@yandex.ru?subject=Исправление%20в%20материале"
              )}
              {...cmsCoreFieldMarker(
                "trust",
                "buttonText",
                coreTrust?.buttonText || "Сообщить об ошибке",
                { label: "Кнопка редакционной политики" }
              )}
            >
              {language === "ru" && coreTrust?.buttonText
                ? coreTrust.buttonText
                : t("Сообщить об ошибке")} {" "}
              <span>→</span>
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

        <section
          id="calendar"
          className={`calendar-section painted-paper-section${coreHomepageSectionClass(coreCalendar)}`}
          style={coreHomepageSectionStyle(coreCalendar)}
          {...cmsCoreFieldMarker(
            "calendar",
            "backgroundMediaId",
            coreCalendar?.backgroundImageUrl || "",
            { kind: "image", label: "Фон литературного календаря" }
          )}
        >
          <Suspense
            fallback={
              <div className="calendar-card">
                {t("Собираем литературные даты…")}
              </div>
            }
          >
            <LiteraryCalendar
              countries={countryArchive}
              eyebrow={coreCalendar?.eyebrow}
              title={coreCalendar?.title}
              description={coreCalendar?.description}
              onCountrySelect={(country, writer) =>
                writer
                  ? selectWriterAndFocus(country, writer)
                  : selectCountry(country, true)
              }
            />
          </Suspense>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <section className="footer-brand">
            <a
              href={import.meta.env.BASE_URL}
              aria-label={t("Проба Пера — главная")}
            >
              <img
                src={assetUrl("brand/probpera-logo.png")}
                alt=""
                width="68"
                height="68"
                loading="lazy"
                decoding="async"
              />
              <span>
                <strong>{t("Проба Пера")}</strong>
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
              <a href="#atlas">{t("Литературная планета")}</a>
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
        <div className="footer-bottom">
          <p>
            © 2025–2026 {t("«Проба Пера»")}.{" "}
            {t("Авторские публикации защищены законом.")}
          </p>
          <a href="mailto:probperasite@yandex.ru">probperasite@yandex.ru</a>
          <span>{t("Независимый литературный журнал")}</span>
        </div>
      </footer>

      {communityOpen ? (
        <Suspense fallback={null}>
          <CommunityHub
            open
            initialView={communityView}
            countries={countryArchive}
            onClose={() => setCommunityOpen(false)}
          />
        </Suspense>
      ) : null}

      <GlobalSearch
        open={globalSearchOpen}
        countries={countryArchive}
        books={bookArchive}
        articleCount={articleCount}
        onClose={() => setGlobalSearchOpen(false)}
        onCountrySelect={(country, writer) =>
          writer
            ? selectWriterAndFocus(country, writer)
            : selectCountry(country, true)
        }
        onBookSelect={openBook}
      />
    </div>
  );
}
