import type {
  Country,
  WorkProfile,
  WorkSourceProfile,
  WriterProfile,
} from "./types";

const reviewedAt = "2026-08-20";

type BatchWorkDraft = {
  id: string;
  titleRu: string;
  titleEn: string;
  originalTitle: string;
  alternateTitles?: string[];
  firstPublished: number;
  genres: string[];
  tags: string[];
  descriptionRu: string;
  descriptionEn: string;
  sources: Array<{
    provider: string;
    url: string;
    fields: WorkSourceProfile["fields"];
    usage: "structured-data" | "reference-only";
    license?: string;
  }>;
  externalIds?: Array<{
    scheme: "openlibrary" | "other";
    value: string;
    sourceUrl: string;
  }>;
};

function verifiedBatchWork(draft: BatchWorkDraft): WorkProfile {
  const sourceUrls = draft.sources.map((source) => source.url);
  return {
    id: draft.id,
    title: draft.titleRu,
    alternateTitles: [
      ...new Set([
        ...(draft.alternateTitles || []),
        draft.titleEn,
        draft.originalTitle,
      ]),
    ].filter((title) => title !== draft.titleRu),
    originalTitle: draft.originalTitle,
    firstPublished: draft.firstPublished,
    originalLanguage:
      draft.originalTitle === draft.titleRu ? "русский" : "английский",
    genres: draft.genres,
    tags: [
      ...draft.tags,
      "редакционно проверено",
      "обложка из пользовательского редакционного архива 2026-08-20",
    ],
    description: draft.descriptionRu,
    translations: {
      ru: {
        locale: "ru",
        title: draft.titleRu,
        description: draft.descriptionRu,
        sourceLanguage: "ru",
        status: "verified",
        sourceUrls,
        method: "editorial-original",
        reviewedAt,
      },
      en: {
        locale: "en",
        title: draft.titleEn,
        description: draft.descriptionEn,
        sourceLanguage: "en",
        status: "verified",
        sourceUrls,
        method: "editorial-original",
        reviewedAt,
      },
    },
    sources: draft.sources.map((source) => ({
      ...source,
      retrievedAt: reviewedAt,
    })),
    externalIds: draft.externalIds,
    sourceUrl: sourceUrls[0],
    editorial: { status: "verified", reviewedAt },
  };
}

const chekhovMuseumHistory =
  "https://chekhovmuseum.com/en/museum/about/history";
const chekhovMuseumStudy =
  "https://api.chekhovmuseum.com/upload/iblock/d2d/9rstowxr0fgko7arb4mf553lwfjytr3q/Sbornik_statey.pdf";
const chekhovMuseumMelikhovo =
  "https://chekhovmuseum.com/museum/objects/17/871?type=section";
const chekhovMuseumEstate =
  "https://chekhovmuseum.com/museum/objects/17/849?type=section";
const ladyWithDogEvidence =
  "https://ar.culture.ru/ru/subject/illyustracii-k-dame-s-sobachkoy";
const wellsGutenberg =
  "https://www.gutenberg.org/ebooks/author/30?sort_order=downloads";
const mitchellOfficial = "https://davidmitchellbooks.com/books/";
const mitchellRussianPublisher = "https://azbooka.ru/books/kostyanye-chasy";

function openLibrarySource(workId: string) {
  return {
    provider: "Open Library",
    url: `https://openlibrary.org/works/${workId}`,
    fields: [
      "identity",
      "authorship",
      "title",
      "original-title",
      "publication-year",
      "language",
    ] as WorkSourceProfile["fields"],
    usage: "structured-data" as const,
  };
}

function openLibraryId(workId: string) {
  return {
    scheme: "openlibrary" as const,
    value: workId,
    sourceUrl: `https://openlibrary.org/works/${workId}`,
  };
}

function editorialArchiveId(workId: string, coverSlug: string) {
  return {
    scheme: "other" as const,
    value: `probpera-cover-batch-20260820:${workId}`,
    sourceUrl: `https://probpera.ru/brand/book-covers/${coverSlug}.webp`,
  };
}

export const userSuppliedBookWorkSupplementsBatch20260820: Record<
  string,
  Record<string, WorkProfile[]>
> = {
  russia: {
    chekhov: [
      verifiedBatchWork({
        id: "the-duel",
        titleRu: "Дуэль",
        titleEn: "The Duel",
        originalTitle: "Дуэль",
        firstPublished: 1891,
        genres: ["повесть", "психологическая проза"],
        tags: ["нравственный выбор", "конфликт", "Кавказ"],
        descriptionRu:
          "Лаевский мечтает бежать от наскучившей связи и приморского города, но его уклончивость сталкивается с непримиримым осуждением зоолога фон Корена. Дуэль превращает личный конфликт в исследование ответственности, сострадания и возможности нравственной перемены.",
        descriptionEn:
          "Laevsky longs to flee a failing relationship and a provincial seaside town, but his evasions collide with the zoologist von Koren's severe moral judgment. Their duel turns a personal quarrel into an inquiry about responsibility, compassion, and the possibility of ethical change.",
        sources: [
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumStudy,
            fields: ["identity", "authorship", "title"],
            usage: "reference-only",
          },
        ],
        externalIds: [
          editorialArchiveId("the-duel", "the-duel-chekhov-20260820-editorial"),
        ],
      }),
      verifiedBatchWork({
        id: "the-black-monk",
        titleRu: "Чёрный монах",
        titleEn: "The Black Monk",
        originalTitle: "Чёрный монах",
        alternateTitles: ["Черный монах"],
        firstPublished: 1894,
        genres: ["повесть", "психологическая проза"],
        tags: ["талант", "видения", "безумие", "сад"],
        descriptionRu:
          "Учёный Андрей Коврин приезжает отдыхать в усадьбу опекуна и начинает видеть чёрного монаха, который убеждает его в собственной избранности. История связывает творческое честолюбие, душевный разлад и разрушение близких отношений, не сводя видения героя к простой разгадке.",
        descriptionEn:
          "Scholar Andrey Kovrin visits his former guardian's estate and begins seeing a black monk who assures him that he is one of humanity's chosen minds. The story binds artistic ambition, mental disturbance, and damaged intimacy without reducing Kovrin's visions to a simple answer.",
        sources: [
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumEstate,
            fields: ["identity", "authorship", "title"],
            usage: "reference-only",
          },
        ],
        externalIds: [
          editorialArchiveId(
            "the-black-monk",
            "the-black-monk-chekhov-20260820-editorial"
          ),
        ],
      }),
      verifiedBatchWork({
        id: "uncle-vanya",
        titleRu: "Дядя Ваня",
        titleEn: "Uncle Vanya",
        originalTitle: "Дядя Ваня",
        firstPublished: 1897,
        genres: ["пьеса", "драма"],
        tags: ["усадьба", "несбывшаяся жизнь", "труд", "любовь"],
        descriptionRu:
          "Войницкий и Соня годами содержат имение профессора Серебрякова, пока его приезд не обнажает чувство напрасно прожитой жизни и безответную любовь. Чеховская драма соединяет бытовой конфликт с темами труда, утраты надежд и тихой выносливости.",
        descriptionEn:
          "Voynitsky and Sonya have spent years sustaining Professor Serebryakov's estate, until his visit exposes their sense of wasted life and unreturned love. Chekhov's drama joins domestic conflict to questions of labor, lost hope, and quiet endurance.",
        sources: [
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumMelikhovo,
            fields: ["identity", "authorship", "title", "publication-year"],
            usage: "reference-only",
          },
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumHistory,
            fields: ["identity", "authorship", "title"],
            usage: "reference-only",
          },
        ],
        externalIds: [
          editorialArchiveId("uncle-vanya", "uncle-vanya-20260820-editorial"),
        ],
      }),
      verifiedBatchWork({
        id: "the-man-in-a-case",
        titleRu: "Человек в футляре",
        titleEn: "The Man in a Case",
        originalTitle: "Человек в футляре",
        firstPublished: 1898,
        genres: ["рассказ", "сатирическая проза"],
        tags: ["страх", "конформизм", "провинция", "свобода"],
        descriptionRu:
          "Учитель Беликов окружает себя правилами, запретами и буквальными футлярами, а его тревога постепенно подчиняет жизнь целого города. Рассказ показывает, как страх перед свободой становится общественной привычкой и переживает самого носителя этого страха.",
        descriptionEn:
          "Teacher Belikov shields himself with regulations, prohibitions, and literal cases, while his anxiety gradually governs an entire town. The story shows how fear of freedom becomes a social habit that can outlive the person who embodied it.",
        sources: [
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumMelikhovo,
            fields: ["identity", "authorship", "title", "publication-year"],
            usage: "reference-only",
          },
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumHistory,
            fields: ["identity", "authorship", "title"],
            usage: "reference-only",
          },
        ],
        externalIds: [
          editorialArchiveId(
            "the-man-in-a-case",
            "the-man-in-a-case-20260820-editorial"
          ),
        ],
      }),
      verifiedBatchWork({
        id: "the-lady-with-the-dog",
        titleRu: "Дама с собачкой",
        titleEn: "The Lady with the Dog",
        originalTitle: "Дама с собачкой",
        alternateTitles: ["Дама с собачкой"],
        firstPublished: 1899,
        genres: ["рассказ", "психологическая проза"],
        tags: ["Ялта", "любовь", "двойная жизнь", "открытый финал"],
        descriptionRu:
          "Курортное знакомство Дмитрия Гурова и Анны Сергеевны неожиданно перерастает в чувство, которое не помещается в их прежние семейные роли. Открытый финал переносит внимание с тайного романа на трудный вопрос о честной жизни и цене перемен.",
        descriptionEn:
          "A holiday acquaintance between Dmitri Gurov and Anna Sergeyevna unexpectedly becomes a love that no longer fits their established family roles. The open ending shifts attention from a secret affair to the difficult question of honest life and the cost of change.",
        sources: [
          {
            provider: "Artefact, Ministry of Culture of Russia",
            url: ladyWithDogEvidence,
            fields: ["identity", "authorship", "title", "publication-year"],
            usage: "reference-only",
          },
          {
            provider: "Chekhov Museum Melikhovo",
            url: chekhovMuseumStudy,
            fields: ["identity", "authorship", "title"],
            usage: "reference-only",
          },
        ],
        externalIds: [
          editorialArchiveId(
            "the-lady-with-the-dog",
            "lady-with-the-dog-20260820-editorial"
          ),
        ],
      }),
    ],
  },
  england: {
    h_g_wells: [
      verifiedBatchWork({
        id: "when-the-sleeper-wakes",
        titleRu: "Когда спящий проснётся",
        titleEn: "When the Sleeper Wakes",
        originalTitle: "When the Sleeper Wakes",
        alternateTitles: ["The Sleeper Awakes", "Спящий просыпается"],
        firstPublished: 1899,
        genres: ["научно-фантастический роман", "антиутопия"],
        tags: ["будущее", "власть", "массовое общество", "революция"],
        descriptionRu:
          "Грэм впадает в необычайно долгий сон и просыпается через два столетия владельцем состояния, на котором держится мировая власть. Его пробуждение превращается в политический кризис и проверку того, способен ли символ освобождения действовать самостоятельно.",
        descriptionEn:
          "Graham falls into an extraordinary sleep and wakes two centuries later as the legal owner of a fortune underpinning global power. His return becomes a political crisis and a test of whether a symbol of liberation can act independently of those who control his image.",
        sources: [openLibrarySource("OL52151W"), {
          provider: "Project Gutenberg",
          url: wellsGutenberg,
          fields: ["identity", "authorship", "title", "language"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL52151W")],
      }),
      verifiedBatchWork({
        id: "the-first-men-in-the-moon",
        titleRu: "Первые люди на Луне",
        titleEn: "The First Men in the Moon",
        originalTitle: "The First Men in the Moon",
        firstPublished: 1901,
        genres: ["научно-фантастический роман", "приключенческая проза"],
        tags: ["Луна", "космическое путешествие", "селениты", "наука"],
        descriptionRu:
          "Изобретатель Кэйвор создаёт вещество, нейтрализующее гравитацию, и вместе с деловым Бедфордом отправляется на Луну. Встреча с подземной цивилизацией селенитов превращает приключение в сатиру на земное общество, специализацию и империализм.",
        descriptionEn:
          "Inventor Cavor creates a substance that cancels gravity and travels to the Moon with the commercially minded Bedford. Their encounter with the subterranean Selenites turns an adventure into a satire on earthly society, specialization, and imperial ambition.",
        sources: [openLibrarySource("OL52260W"), {
          provider: "Project Gutenberg",
          url: wellsGutenberg,
          fields: ["identity", "authorship", "title", "language"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL52260W")],
      }),
      verifiedBatchWork({
        id: "the-food-of-the-gods",
        titleRu: "Пища богов",
        titleEn: "The Food of the Gods and How It Came to Earth",
        originalTitle: "The Food of the Gods and How It Came to Earth",
        firstPublished: 1904,
        genres: ["научно-фантастический роман", "социальная сатира"],
        tags: ["рост", "научный эксперимент", "гиганты", "общественный конфликт"],
        descriptionRu:
          "Экспериментальная пища вызывает неуправляемый рост растений, животных и детей, создавая поколение гигантов. Уэллс превращает биологическое допущение в конфликт между новым масштабом жизни и обществом, которое пытается сохранить привычный порядок.",
        descriptionEn:
          "An experimental food causes uncontrolled growth in plants, animals, and children, producing a generation of giants. Wells turns the biological premise into a conflict between a new scale of life and a society determined to preserve its familiar order.",
        sources: [openLibrarySource("OL52195W"), {
          provider: "Project Gutenberg",
          url: wellsGutenberg,
          fields: ["identity", "authorship", "title", "language"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL52195W")],
      }),
      verifiedBatchWork({
        id: "the-world-set-free",
        titleRu: "Освобождённый мир",
        titleEn: "The World Set Free",
        originalTitle: "The World Set Free",
        alternateTitles: ["Освобожденный мир"],
        firstPublished: 1914,
        genres: ["научно-фантастический роман", "социальная фантастика"],
        tags: ["атомная энергия", "война", "мировое правительство", "будущее"],
        descriptionRu:
          "Открытие управляемой атомной энергии даёт человечеству новый источник силы, но вскоре приводит к мировой войне с продолжительными ядерными взрывами. После катастрофы роман воображает попытку построить международный порядок, способный ограничить национальное насилие.",
        descriptionEn:
          "The discovery of controllable atomic energy gives humanity a new source of power but soon leads to a world war fought with continuously exploding bombs. After catastrophe, the novel imagines an attempt to build an international order capable of restraining national violence.",
        sources: [openLibrarySource("OL52257W"), {
          provider: "Project Gutenberg",
          url: "https://www.gutenberg.org/ebooks/1059",
          fields: ["identity", "authorship", "title", "publication-year", "language"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL52257W")],
      }),
      verifiedBatchWork({
        id: "men-like-gods",
        titleRu: "Люди как боги",
        titleEn: "Men Like Gods",
        originalTitle: "Men Like Gods",
        firstPublished: 1923,
        genres: ["научно-фантастический роман", "утопия"],
        tags: ["параллельный мир", "утопия", "наука", "политика"],
        descriptionRu:
          "Журналист Барнстейпл и несколько случайных спутников попадают в параллельный мир Утопию, где наука и общественное устройство развивались без привычных земных институтов. Столкновение миров проверяет не только утопический идеал, но и стремление гостей навязать ему собственную власть.",
        descriptionEn:
          "Journalist Barnstaple and several accidental companions enter a parallel world called Utopia, where science and social organization developed without familiar earthly institutions. The encounter tests both the utopian ideal and the visitors' impulse to impose their own authority upon it.",
        sources: [openLibrarySource("OL52237W")],
        externalIds: [openLibraryId("OL52237W")],
      }),
      verifiedBatchWork({
        id: "ann-veronica",
        titleRu: "Анна-Вероника",
        titleEn: "Ann Veronica",
        originalTitle: "Ann Veronica",
        alternateTitles: ["Анна Вероника"],
        firstPublished: 1909,
        genres: ["роман", "социальная проза"],
        tags: ["женская независимость", "образование", "суфражизм", "Лондон"],
        descriptionRu:
          "Молодая Анна Вероника покидает отцовский дом, чтобы самостоятельно учиться и жить в Лондоне, несмотря на общественные и семейные запреты. Роман связывает личное взросление героини с дискуссиями о женском образовании, труде, любви и политической свободе.",
        descriptionEn:
          "Young Ann Veronica leaves her father's home to study and live independently in London despite family and social restrictions. The novel connects her personal maturation with debates about women's education, work, love, and political freedom.",
        sources: [openLibrarySource("OL52258W"), {
          provider: "Project Gutenberg",
          url: wellsGutenberg,
          fields: ["identity", "authorship", "title", "language"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL52258W")],
      }),
      verifiedBatchWork({
        id: "the-history-of-mr-polly",
        titleRu: "История мистера Полли",
        titleEn: "The History of Mr. Polly",
        originalTitle: "The History of Mr. Polly",
        firstPublished: 1910,
        genres: ["роман", "социальная комедия"],
        tags: ["маленький человек", "лавочник", "побег", "самоопределение"],
        descriptionRu:
          "Разочарованный лавочник Альфред Полли чувствует себя пленником неудачного брака, бедности и случайно выбранного занятия. Неудачная попытка уничтожить прежнюю жизнь приводит его к неожиданному побегу и возможности заново определить собственное место.",
        descriptionEn:
          "Disappointed shopkeeper Alfred Polly feels trapped by an unhappy marriage, poverty, and an occupation chosen almost by accident. His failed attempt to destroy his former life leads to an unexpected escape and a chance to define his place anew.",
        sources: [openLibrarySource("OL52262W"), {
          provider: "Project Gutenberg",
          url: wellsGutenberg,
          fields: ["identity", "authorship", "title", "language"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL52262W")],
      }),
    ],
    david_mitchell: [
      verifiedBatchWork({
        id: "ghostwritten",
        titleRu: "Литературный призрак",
        titleEn: "Ghostwritten",
        originalTitle: "Ghostwritten",
        firstPublished: 1999,
        genres: ["роман", "современная проза"],
        tags: ["связанные истории", "глобальный роман", "идентичность", "случай"],
        descriptionRu:
          "Девять голосов ведут повествование через Восточную Азию, Россию, Европу и США, постепенно обнаруживая связи между на первый взгляд отдельными судьбами. Дебютный роман исследует случай, ответственность и движение историй через границы культур и сознаний.",
        descriptionEn:
          "Nine voices carry the narrative across East Asia, Russia, Europe, and the United States, gradually revealing connections among apparently separate lives. The debut novel examines chance, responsibility, and the movement of stories across cultural and mental borders.",
        sources: [openLibrarySource("OL271981W"), {
          provider: "David Mitchell official site",
          url: mitchellOfficial,
          fields: ["identity", "authorship", "title", "description"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL271981W")],
      }),
      verifiedBatchWork({
        id: "number9dream",
        titleRu: "Сон № 9",
        titleEn: "Number9Dream",
        originalTitle: "Number9Dream",
        alternateTitles: ["Сон №9"],
        firstPublished: 2001,
        genres: ["роман", "современная проза"],
        tags: ["Токио", "поиск отца", "сны", "идентичность"],
        descriptionRu:
          "Юный Эйдзи Миякэ приезжает в Токио, чтобы разыскать отца, которого никогда не знал, и оказывается между городской реальностью, фантазиями и снами. Поиск происхождения превращается в историю взросления, где память и вымысел постоянно меняют значение происходящего.",
        descriptionEn:
          "Young Eiji Miyake comes to Tokyo to find the father he has never known and moves between urban reality, fantasy, and dreams. His search for origins becomes a coming-of-age story in which memory and invention repeatedly alter the meaning of events.",
        sources: [openLibrarySource("OL271980W"), {
          provider: "David Mitchell official site",
          url: mitchellOfficial,
          fields: ["identity", "authorship", "title", "description"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL271980W")],
      }),
      verifiedBatchWork({
        id: "the-thousand-autumns-of-jacob-de-zoet",
        titleRu: "Тысяча осеней Якоба де Зута",
        titleEn: "The Thousand Autumns of Jacob de Zoet",
        originalTitle: "The Thousand Autumns of Jacob de Zoet",
        firstPublished: 2010,
        genres: ["исторический роман", "современная проза"],
        tags: ["Дэдзима", "Япония", "торговля", "власть"],
        descriptionRu:
          "Голландский клерк Якоб де Зут прибывает на торговый остров Дэдзима в конце XVIII века и сталкивается с коррупцией, культурными границами и запретной привязанностью. Исторический роман соединяет частную судьбу с конфликтом имперской торговли, медицины и закрытого общества.",
        descriptionEn:
          "Dutch clerk Jacob de Zoet arrives at the trading island of Dejima at the end of the eighteenth century and encounters corruption, cultural boundaries, and forbidden attachment. The historical novel joins a private fate to conflicts involving imperial commerce, medicine, and a closed society.",
        sources: [openLibrarySource("OL15233654W"), {
          provider: "David Mitchell official site",
          url: mitchellOfficial,
          fields: ["identity", "authorship", "title", "description"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL15233654W")],
      }),
      verifiedBatchWork({
        id: "the-bone-clocks",
        titleRu: "Костяные часы",
        titleEn: "The Bone Clocks",
        originalTitle: "The Bone Clocks",
        alternateTitles: ["Простые смертные"],
        firstPublished: 2014,
        genres: ["роман", "фэнтези", "современная проза"],
        tags: ["Холли Сайкс", "время", "бессмертие", "связанные истории"],
        descriptionRu:
          "Жизнь Холли Сайкс прослеживается на протяжении десятилетий, от подросткового побега до старости в изменившемся мире. За частной биографией постепенно раскрывается тайная борьба групп, по-разному понимающих бессмертие, память и цену человеческой жизни.",
        descriptionEn:
          "Holly Sykes's life unfolds across decades, from a teenage escape to old age in a transformed world. Behind her personal history, a hidden conflict gradually emerges between groups with opposing ideas about immortality, memory, and the value of human life.",
        sources: [openLibrarySource("OL17078738W"), {
          provider: "David Mitchell official site",
          url: mitchellOfficial,
          fields: ["identity", "authorship", "title", "description"],
          usage: "reference-only",
        }, {
          provider: "Azbooka-Atticus",
          url: mitchellRussianPublisher,
          fields: ["identity", "authorship", "title", "description"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL17078738W")],
      }),
      verifiedBatchWork({
        id: "slade-house",
        titleRu: "Голодный дом",
        titleEn: "Slade House",
        originalTitle: "Slade House",
        alternateTitles: ["Дом Слэйд", "Дом Слейд"],
        firstPublished: 2015,
        genres: ["роман", "готическая проза", "фэнтези"],
        tags: ["дом с привидениями", "девятилетний цикл", "исчезновения", "бессмертие"],
        descriptionRu:
          "Неприметная дверь в лондонском переулке раз в девять лет впускает нового гостя в дом, из которого почти невозможно выбраться. Пять связанных эпизодов переосмысляют историю дома с привидениями через память, хищное бессмертие и повторяющуюся ловушку.",
        descriptionEn:
          "An inconspicuous door in a London alley admits a new guest every nine years into a house that is almost impossible to leave. Five linked episodes recast the haunted-house story through memory, predatory immortality, and a repeating trap.",
        sources: [openLibrarySource("OL17801648W"), {
          provider: "David Mitchell official site",
          url: mitchellOfficial,
          fields: ["identity", "authorship", "title", "description"],
          usage: "reference-only",
        }],
        externalIds: [openLibraryId("OL17801648W")],
      }),
    ],
  },
};

function normalizedTitle(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mergeWriter(writer: WriterProfile, additions: WorkProfile[]) {
  const existing = new Map(
    (writer.workDetails || []).map((work) => [normalizedTitle(work.title), work])
  );
  for (const work of additions) {
    if (existing.has(normalizedTitle(work.title))) {
      throw new Error(
        `Batch 2026-08-20 cannot replace existing work ${writer.id}:${work.title}.`
      );
    }
  }
  const addedTitles = new Set(additions.map((work) => normalizedTitle(work.title)));
  return {
    ...writer,
    works: (writer.works || []).filter(
      (title) => !addedTitles.has(normalizedTitle(title))
    ),
    workDetails: [...(writer.workDetails || []), ...additions],
  };
}

export function mergeUserSuppliedBookWorkSupplementsBatch20260820(
  countries: Country[]
): Country[] {
  return countries.map((country) => {
    const writers = userSuppliedBookWorkSupplementsBatch20260820[country.id];
    if (!writers) return country;
    return {
      ...country,
      writers: country.writers.map((writer) =>
        writers[writer.id] ? mergeWriter(writer, writers[writer.id]) : writer
      ),
    };
  });
}

export const userSuppliedBookWorkBatch20260820Count = Object.values(
  userSuppliedBookWorkSupplementsBatch20260820
).reduce(
  (total, writers) =>
    total + Object.values(writers).reduce((count, works) => count + works.length, 0),
  0
);
