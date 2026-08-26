import type {
  Country,
  WorkProfile,
  WorkSourceProfile,
  WriterProfile,
} from "./types";

const reviewedAt = "2026-08-08";

type VerifiedWork = WorkProfile & { editorial: { status: "verified"; reviewedAt: string } };

function verifiedWork(work: Omit<VerifiedWork, "editorial">): VerifiedWork {
  return {
    ...work,
    editorial: { status: "verified", reviewedAt },
  };
}

type NobelLandmarkDraft = Omit<
  VerifiedWork,
  | "description"
  | "translations"
  | "sources"
  | "externalIds"
  | "distinctions"
  | "sourceUrl"
  | "editorial"
> & {
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  nobelYear: number;
  nobelSlug: string;
  wikidataId: string;
  wikidataFields: WorkSourceProfile["fields"];
};

function nobelLandmark({
  titleEn,
  descriptionRu,
  descriptionEn,
  nobelYear,
  nobelSlug,
  wikidataId,
  wikidataFields,
  ...work
}: NobelLandmarkDraft): VerifiedWork {
  const sourceUrl = `https://www.nobelprize.org/prizes/literature/${nobelYear}/${nobelSlug}/facts/`;
  const wikidataUrl = `https://www.wikidata.org/wiki/${wikidataId}`;
  const sourceUrls = [sourceUrl, wikidataUrl];
  return verifiedWork({
    ...work,
    description: descriptionRu,
    tags: [
      ...(work.tags || []),
      "произведение, особо отмеченное Шведской академией",
    ],
    translations: {
      ru: {
        locale: "ru",
        title: work.title,
        description: descriptionRu,
        sourceLanguage: "ru",
        status: "verified",
        sourceUrls,
        method: "editorial-original",
        reviewedAt,
      },
      en: {
        locale: "en",
        title: titleEn,
        description: descriptionEn,
        sourceLanguage: "en",
        status: "verified",
        sourceUrls,
        method: "editorial-original",
        reviewedAt,
      },
    },
    sources: [
      {
        provider: "Nobel Prize Outreach",
        url: sourceUrl,
        fields: ["identity", "title", "award-criterion"],
        usage: "reference-only",
        retrievedAt: reviewedAt,
      },
      {
        provider: "Wikidata",
        url: wikidataUrl,
        fields: wikidataFields,
        license: "CC0 1.0",
        usage: "structured-data",
        retrievedAt: reviewedAt,
      },
    ],
    externalIds: [
      {
        scheme: "wikidata",
        value: wikidataId,
        sourceUrl: wikidataUrl,
      },
    ],
    distinctions: [
      {
        criterion: "award-cited-work",
        label: `Nobel Prize in Literature ${nobelYear}: work cited in the prize motivation`,
        organization: "Swedish Academy",
        year: nobelYear,
        sourceUrl,
      },
    ],
    sourceUrl,
  });
}

type BestsellerEvidenceDraft = Omit<
  VerifiedWork,
  | "description"
  | "translations"
  | "sources"
  | "distinctions"
  | "sourceUrl"
  | "editorial"
> & {
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  descriptionSourceProvider: string;
  descriptionSourceUrl: string;
  evidenceLabel: string;
  evidenceYear: number;
  evidenceUrl: string;
};

function bestsellerEvidence({
  titleEn,
  descriptionRu,
  descriptionEn,
  descriptionSourceProvider,
  descriptionSourceUrl,
  evidenceLabel,
  evidenceYear,
  evidenceUrl,
  ...work
}: BestsellerEvidenceDraft): VerifiedWork {
  const sourceUrls = [descriptionSourceUrl, evidenceUrl];
  return verifiedWork({
    ...work,
    description: descriptionRu,
    tags: [...(work.tags || []), "бестселлер: подтверждённый критерий"],
    translations: {
      ru: {
        locale: "ru",
        title: work.title,
        description: descriptionRu,
        sourceLanguage: "ru",
        status: "verified",
        sourceUrls,
        method: "editorial-original",
        reviewedAt,
      },
      en: {
        locale: "en",
        title: titleEn,
        description: descriptionEn,
        sourceLanguage: "en",
        status: "verified",
        sourceUrls,
        method: "editorial-original",
        reviewedAt,
      },
    },
    sources: [
      {
        provider: descriptionSourceProvider,
        url: descriptionSourceUrl,
        fields: ["identity", "title", "publication-year", "description"],
        usage: "reference-only",
        retrievedAt: reviewedAt,
      },
      {
        provider: "Guinness World Records",
        url: evidenceUrl,
        fields: ["bestseller-evidence", "market", "period", "measurement"],
        usage: "reference-only",
        retrievedAt: reviewedAt,
      },
    ],
    distinctions: [
      {
        criterion: "bestseller-evidence",
        label: evidenceLabel,
        organization: "Guinness World Records",
        year: evidenceYear,
        sourceUrl: evidenceUrl,
      },
    ],
    sourceUrl: descriptionSourceUrl,
  });
}

const supplements: Record<string, Record<string, VerifiedWork[]>> = {
  poland: {
    wladyslaw_reymont: [
      nobelLandmark({
        id: "the-peasants",
        title: "Мужики",
        alternateTitles: ["Крестьяне"],
        titleEn: "The Peasants",
        originalTitle: "Chłopi",
        firstPublished: 1904,
        originalLanguage: "польский",
        genres: ["роман", "семейная хроника", "натурализм"],
        tags: ["деревня", "труд", "земля", "времена года"],
        descriptionRu:
          "Четырёхчастный роман следует за жителями польской деревни Липце, где земля, труд, семейные обязательства и общинные обряды определяют повседневную жизнь. Композиция по временам года превращает множество частных судеб в широкую картину повторения и перемен.",
        descriptionEn:
          "Across four seasonal volumes, the novel follows the people of the Polish village of Lipce, where land, labour, family obligations and communal rituals shape daily life. Its cyclical structure turns many individual destinies into a broad portrait of repetition and change.",
        nobelYear: 1924,
        nobelSlug: "reymont",
        wikidataId: "Q2896338",
        wikidataFields: ["identity", "title", "publication-year", "language"],
      }),
    ],
  },
  norway: {
    knut_hamsun: [
      nobelLandmark({
        id: "growth-of-the-soil",
        title: "Соки земли",
        alternateTitles: ["Плоды земли"],
        titleEn: "Growth of the Soil",
        originalTitle: "Markens Grøde",
        firstPublished: 1917,
        originalLanguage: "норвежский",
        genres: ["роман", "эпическая проза"],
        tags: ["земля", "труд", "поселенцы", "природа"],
        descriptionRu:
          "Роман рассказывает, как Исак осваивает удалённый участок земли и постепенно создаёт хозяйство, вокруг которого возникает новая община. Повседневный физический труд получает эпический масштаб, а отношения человека с природой показаны одновременно как источник силы и испытание.",
        descriptionEn:
          "The novel follows Isak as he clears a remote tract of land and gradually builds a farm around which a new community takes shape. Everyday physical labour acquires an epic scale, while the bond between people and nature appears as both a source of strength and a test.",
        nobelYear: 1920,
        nobelSlug: "hamsun",
        wikidataId: "Q2266122",
        wikidataFields: ["identity", "title", "publication-year", "language"],
      }),
    ],
  },
  switzerland: {
    carl_spitteler: [
      nobelLandmark({
        id: "olympian-spring",
        title: "Олимпийская весна",
        titleEn: "Olympian Spring",
        originalTitle: "Olympischer Frühling",
        firstPublished: 1900,
        originalLanguage: "немецкий",
        genres: ["эпическая поэма", "мифологическая поэзия"],
        tags: ["античная мифология", "аллегория", "боги", "свобода"],
        descriptionRu:
          "Эпическая поэма заново разыгрывает мир греческих богов, соединяя мифологический сюжет с фантастическими, религиозными и натуралистическими образами. Шпиттелер использует античный материал как самостоятельную аллегорию власти, выбора и внутренней свободы.",
        descriptionEn:
          "The epic poem restages the world of the Greek gods, combining mythic action with fantastic, religious and naturalistic imagery. Spitteler treats antiquity as the basis for an independent allegory about power, choice and inner freedom.",
        nobelYear: 1919,
        nobelSlug: "spitteler",
        wikidataId: "Q6548960",
        wikidataFields: ["identity", "title"],
      }),
    ],
  },
  germany: {
    theodor_mommsen: [
      nobelLandmark({
        id: "history-of-rome",
        title: "Римская история",
        titleEn: "A History of Rome",
        originalTitle: "Römische Geschichte",
        firstPublished: 1854,
        originalLanguage: "немецкий",
        genres: ["историография", "историческая проза"],
        tags: ["Древний Рим", "республика", "источниковедение", "политика"],
        descriptionRu:
          "Моммзен прослеживает развитие Рима от ранней Италии до падения республики, объединяя политическую историю, право, экономику и анализ источников. Научная аргументация сочетается с выразительным повествованием и ясными оценками исторических деятелей и институтов.",
        descriptionEn:
          "Mommsen traces Rome from early Italy to the fall of the Republic, combining political history with law, economics and close analysis of sources. Scholarly argument is joined to forceful narrative and sharply drawn judgments of historical figures and institutions.",
        nobelYear: 1902,
        nobelSlug: "mommsen",
        wikidataId: "Q1500229",
        wikidataFields: ["identity", "title", "publication-year", "language"],
      }),
    ],
    thomas_mann: [
      nobelLandmark({
        id: "buddenbrooks-editorial",
        title: "Будденброки",
        titleEn: "Buddenbrooks",
        originalTitle: "Buddenbrooks: Verfall einer Familie",
        firstPublished: 1901,
        originalLanguage: "немецкий",
        genres: ["роман", "семейная хроника", "реализм"],
        tags: ["семья", "Любек", "торговый дом", "упадок"],
        descriptionRu:
          "Семейная хроника прослеживает четыре поколения любекской купеческой династии и постепенное расхождение между деловым долгом, личными желаниями и художественной чувствительностью. История упадка семьи становится точным исследованием общественной роли, наследования и цены респектабельности.",
        descriptionEn:
          "The family chronicle follows four generations of a Lübeck merchant dynasty as commercial duty, private desire and artistic sensitivity move steadily apart. The family's decline becomes a precise study of social role, inheritance and the cost of respectability.",
        nobelYear: 1929,
        nobelSlug: "mann",
        wikidataId: "Q326909",
        wikidataFields: ["identity", "title", "publication-year", "language"],
      }),
    ],
  },
  canada: {
    yann_martel: [
      bestsellerEvidence({
        id: "life-of-pi",
        title: "Жизнь Пи",
        titleEn: "Life of Pi",
        originalTitle: "Life of Pi",
        firstPublished: 2001,
        originalLanguage: "английский",
        genres: ["роман", "приключенческая проза", "философская проза"],
        tags: ["кораблекрушение", "выживание", "тигр", "вера"],
        descriptionRu:
          "После кораблекрушения подросток Пи Патель оказывается в спасательной шлюпке посреди Тихого океана вместе с бенгальским тигром Ричардом Паркером. История выживания превращается в размышление о вере, воображении и о том, как человек придаёт смысл пережитому.",
        descriptionEn:
          "After a shipwreck, the teenage Pi Patel is stranded in a Pacific lifeboat with a Bengal tiger named Richard Parker. The survival story becomes a meditation on faith, imagination and the ways people give meaning to what they have endured.",
        descriptionSourceProvider: "Canongate Books",
        descriptionSourceUrl: "https://canongate.co.uk/books/318-life-of-pi/",
        evidenceLabel:
          "Nielsen BookScan UK: 1,319,061 copies sold by 13 October 2012; Guinness category: best-selling Booker Prize-winning novel.",
        evidenceYear: 2012,
        evidenceUrl:
          "https://www.guinnessworldrecords.com/world-records/73483-best-selling-booker-prize-winning-novel",
      }),
    ],
  },
  chile: {
    pablo_neruda: [
      verifiedWork({
        id: "twenty-love-poems",
        title: "Двадцать стихотворений о любви и одна песня отчаяния",
        originalTitle: "Veinte poemas de amor y una canción desesperada",
        firstPublished: 1924,
        originalLanguage: "испанский",
        genres: ["поэзия", "лирический сборник"],
        tags: ["любовь", "память", "утрата", "молодость"],
        description:
          "Ранний лирический сборник Пабло Неруды, в котором чувственная любовная поэзия соседствует с переживанием разлуки и утраты. Книга вышла в Сантьяго в издательстве Nascimento в 1924 году и стала одним из самых известных произведений поэта.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1971/neruda/bibliography/",
      }),
    ],
  },
  colombia: {
    gabriel_garcia_marquez: [
      verifiedWork({
        id: "one-hundred-years-of-solitude",
        title: "Сто лет одиночества",
        originalTitle: "Cien años de soledad",
        firstPublished: 1967,
        originalLanguage: "испанский",
        genres: ["роман", "магический реализм", "семейная сага"],
        tags: ["Макондо", "семья", "память", "история Латинской Америки"],
        description:
          "История нескольких поколений семьи Буэндиа и основанного ими Макондо соединяет семейную хронику, политическую историю и чудесное как часть повседневного опыта. Первое издание романа вышло в Буэнос-Айресе в издательстве Sudamericana в 1967 году.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1982/marquez/bibliography/",
      }),
    ],
  },
  egypt: {
    naguib_mahfouz: [
      verifiedWork({
        id: "cairo-trilogy",
        title: "Каирская трилогия",
        originalTitle: "الثلاثية",
        firstPublished: 1956,
        originalLanguage: "арабский",
        genres: ["роман", "семейная сага", "социальный реализм"],
        tags: ["Каир", "семья", "история Египта", "общественные перемены"],
        description:
          "Семейная сага Нагиба Махфуза прослеживает жизнь трёх поколений каирской семьи на фоне общественных и политических перемен. Трилогию составляют романы «Бейн аль-Касрейн» (1956), «Каср аш-Шаук» (1957) и «Ас-Суккария» (1957).",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1988/mahfouz/article/",
      }),
      verifiedWork({
        id: "midaq-alley",
        title: "Переулок Мидак",
        originalTitle: "زقاق المدق",
        firstPublished: 1947,
        originalLanguage: "арабский",
        genres: ["роман", "социальный реализм"],
        tags: ["Каир", "Вторая мировая война", "городская жизнь", "выбор"],
        description:
          "Роман о жителях старого каирского переулка в годы Второй мировой войны. Через судьбы Хамиды, Аббаса и их соседей Нагиб Махфуз показывает, как бедность, надежда и соблазны меняющегося города испытывают человеческое достоинство. Оригинал вышел в 1947 году.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1988/mahfouz/prose/",
      }),
      verifiedWork({
        id: "the-thief-and-the-dogs",
        title: "Вор и собаки",
        originalTitle: "اللص والكلاب",
        firstPublished: 1961,
        originalLanguage: "арабский",
        genres: ["роман", "психологическая проза", "социальная проза"],
        tags: ["предательство", "месть", "Каир", "внутренний монолог"],
        description:
          "После освобождения из тюрьмы Саид Махран пытается отомстить тем, кого считает предателями, но его путь всё сильнее превращается в столкновение с самим собой и изменившимся обществом. Роман 1961 года открыл новый этап в прозе Махфуза, где реалистическое повествование соединено с внутренним монологом.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1988/mahfouz/biographical/",
      }),
    ],
  },
  england: {
    john_galsworthy: [
      nobelLandmark({
        id: "the-forsyte-saga",
        title: "Сага о Форсайтах",
        titleEn: "The Forsyte Saga",
        originalTitle: "The Forsyte Saga",
        firstPublished: 1922,
        originalLanguage: "английский",
        genres: ["цикл романов", "семейная хроника", "реализм"],
        tags: ["семья", "собственность", "викторианская Англия", "перемены"],
        descriptionRu:
          "Цикл прослеживает несколько поколений состоятельной семьи Форсайтов, для которой собственность становится мерой успеха, брака и общественного положения. Через семейные конфликты Голсуорси показывает, как викторианские ценности сталкиваются с меняющимися представлениями о свободе и близости.",
        descriptionEn:
          "The cycle follows several generations of the prosperous Forsyte family, for whom property becomes a measure of success, marriage and social standing. Through their conflicts, Galsworthy shows Victorian values meeting changing ideas of freedom and intimacy.",
        nobelYear: 1932,
        nobelSlug: "galsworthy",
        wikidataId: "Q735319",
        wikidataFields: ["identity", "title"],
      }),
    ],
    jane_austen: [
      verifiedWork({
        id: "pride-and-prejudice",
        title: "Гордость и предубеждение",
        originalTitle: "Pride and Prejudice",
        firstPublished: 1813,
        originalLanguage: "английский",
        genres: ["роман", "роман нравов"],
        tags: ["семья", "брак", "общество", "ирония"],
        description:
          "Роман Джейн Остин о том, как первое впечатление, социальные ожидания и семейные обстоятельства мешают Элизабет Беннет и мистеру Дарси увидеть друг друга без предубеждения. Первое издание вышло анонимно в 1813 году.",
        sourceUrl:
          "https://www.bl.uk/stories/blogs/posts/jane-austen-names-and-notability",
      }),
      verifiedWork({
        id: "persuasion",
        title: "Доводы рассудка",
        alternateTitles: ["Убеждение"],
        originalTitle: "Persuasion",
        firstPublished: 1817,
        originalLanguage: "английский",
        genres: ["роман", "роман нравов"],
        tags: ["второй шанс", "память", "семья", "любовь"],
        description:
          "Последний завершённый роман Джейн Остин - история Энн Эллиот и капитана Уэнтворта, которым спустя годы предстоит заново оценить сделанный когда-то выбор. Книга появилась посмертно в декабре 1817 года с датой 1818 на титульном листе.",
        sourceUrl:
          "https://www.bl.uk/stories/blogs/posts/jane-austen-names-and-notability",
      }),
    ],
    charles_dickens: [
      bestsellerEvidence({
        id: "a-tale-of-two-cities",
        title: "Повесть о двух городах",
        titleEn: "A Tale of Two Cities",
        originalTitle: "A Tale of Two Cities",
        firstPublished: 1859,
        originalLanguage: "английский",
        genres: ["роман", "историческая проза", "социальная проза"],
        tags: ["Французская революция", "Лондон", "Париж", "самопожертвование"],
        descriptionRu:
          "На фоне Французской революции судьбы Люси Манетт, Чарльза Дарнея и Сидни Картона связывают Лондон и Париж в историю любви, насилия и политической мести. Диккенс противопоставляет массовую жестокость личной верности и показывает, какую цену человек готов заплатить за спасение другого.",
        descriptionEn:
          "Against the French Revolution, the lives of Lucie Manette, Charles Darnay and Sydney Carton bind London and Paris in a story of love, violence and political revenge. Dickens sets collective brutality against personal loyalty and asks what one person may sacrifice to save another.",
        descriptionSourceProvider: "Penguin Books",
        descriptionSourceUrl:
          "https://www.penguin.co.uk/books/396923/a-tale-of-two-cities-by-dickens-charles/9780099511854",
        evidenceLabel:
          "Guinness cites an estimate above 200 million copies, while explicitly stating that unaudited historical figures make the single best-selling work of fiction impossible to establish.",
        evidenceYear: 2008,
        evidenceUrl:
          "https://www.guinnessworldrecords.com/world-records/67377-best-selling-book-of-fiction",
      }),
      verifiedWork({
        id: "great-expectations",
        title: "Большие надежды",
        originalTitle: "Great Expectations",
        firstPublished: 1861,
        originalLanguage: "английский",
        genres: ["роман", "роман воспитания"],
        tags: ["взросление", "класс", "совесть", "викторианская Англия"],
        description:
          "Роман воспитания о сироте Пипе, который принимает богатство и положение за путь к счастью, но постепенно учится различать внешнюю респектабельность и нравственную ценность. Впервые печатался частями в 1860-1861 годах.",
        sourceUrl:
          "https://support.bl.uk/book/detail/93c22a09-06f5-469b-9839-9e7d00d87cb9",
      }),
    ],
  },
  france: {
    roger_martin_du_gard: [
      nobelLandmark({
        id: "the-thibaults",
        title: "Семья Тибо",
        alternateTitles: ["Тибо"],
        titleEn: "The Thibaults",
        originalTitle: "Les Thibault",
        firstPublished: 1922,
        originalLanguage: "французский",
        genres: ["цикл романов", "семейная хроника", "реализм"],
        tags: ["братья", "семья", "Первая мировая война", "убеждения"],
        descriptionRu:
          "Роман-цикл сопоставляет судьбы братьев Антуана и Жака Тибо, выросших в строгой католической буржуазной семье и выбравших разные жизненные пути. Их частная история постепенно раскрывается на фоне политического кризиса и приближения Первой мировой войны.",
        descriptionEn:
          "The novel cycle contrasts Antoine and Jacques Thibault, brothers raised in a strict Catholic bourgeois family who choose sharply different paths. Their private history gradually opens onto the political crisis and approach of the First World War.",
        nobelYear: 1937,
        nobelSlug: "gard",
        wikidataId: "Q2915845",
        wikidataFields: ["identity", "title"],
      }),
    ],
    flaubert: [
      verifiedWork({
        id: "madame-bovary",
        title: "Госпожа Бовари",
        originalTitle: "Madame Bovary",
        firstPublished: 1857,
        originalLanguage: "французский",
        genres: ["роман", "реализм"],
        tags: ["провинция", "иллюзии", "брак", "стиль"],
        description:
          "Роман Гюстава Флобера об Эмме Бовари, чьи представления о любви и красивой жизни сталкиваются с провинциальной повседневностью. После журнальной публикации 1856 года отдельное издание вышло у Мишеля Леви в 1857 году.",
        sourceUrl:
          "https://gallica.bnf.fr/accueil/fr/html/madame-bovary-mise-nu-par-ses-critiques",
      }),
    ],
  },
  italy: {
    umberto_eco: [
      verifiedWork({
        id: "the-name-of-the-rose",
        title: "Имя розы",
        originalTitle: "Il nome della rosa",
        firstPublished: 1980,
        originalLanguage: "итальянский",
        genres: ["исторический роман", "детектив", "интеллектуальная проза"],
        tags: ["Средневековье", "монастырь", "книга", "истолкование"],
        description:
          "Первый роман Умберто Эко соединяет монастырский детектив, историческую реконструкцию и размышление о природе знаков и толкований. Итальянское издание Bompiani вышло в 1980 году.",
        sourceUrl:
          "https://bompiani.it/catalogo/il-nome-della-rosa-9788845278655",
      }),
    ],
  },
  india: {
    rabindranath_tagore: [
      verifiedWork({
        id: "gitanjali",
        title: "Гитанджали",
        originalTitle: "গীতাঞ্জলি",
        firstPublished: 1910,
        originalLanguage: "бенгальский",
        genres: ["поэзия", "лирический сборник"],
        tags: ["духовная поэзия", "природа", "любовь", "внутренняя свобода"],
        description:
          "Бенгальский поэтический сборник Рабиндраната Тагора, в котором молитвенная интонация соединяется с размышлением о природе, любви и внутренней свободе. Оригинальная «Гитанджали» вышла в 1910 году; авторская английская книга «Gitanjali: Song Offerings» 1912 года имела иной состав.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1913/tagore/bibliography/?print=1",
      }),
    ],
  },
  japan: {
    haruki_murakami: [
      verifiedWork({
        id: "kafka-on-the-shore",
        title: "Кафка на пляже",
        originalTitle: "海辺のカフカ",
        firstPublished: 2002,
        originalLanguage: "японский",
        genres: ["роман", "магический реализм", "современная проза"],
        tags: ["память", "судьба", "библиотека", "параллельные истории"],
        description:
          "Две параллельные истории - подростка Кафки Тамуры и пожилого Накаты - постепенно сближаются в романе о памяти, утрате, предопределении и поиске собственного места. Первое японское издание вышло в 2002 году.",
        sourceUrl: "https://1q84.shinchosha.co.jp/murakami/2002.html",
      }),
    ],
  },
  usa: {
    suzanne_collins: [
      bestsellerEvidence({
        id: "the-hunger-games",
        title: "Голодные игры",
        titleEn: "The Hunger Games",
        originalTitle: "The Hunger Games",
        firstPublished: 2008,
        originalLanguage: "английский",
        genres: ["роман", "антиутопия", "подростковая литература"],
        tags: ["Панем", "выживание", "насилие", "сопротивление"],
        descriptionRu:
          "В государстве Панем Китнисс Эвердин добровольно занимает место младшей сестры в ежегодном состязании, где подростков заставляют сражаться насмерть перед телекамерами. Борьба за выживание ставит героиню перед выбором между правилами Капитолия, человечностью и зарождающимся сопротивлением.",
        descriptionEn:
          "In Panem, Katniss Everdeen volunteers in place of her younger sister for an annual televised contest that forces teenagers to fight to the death. Her struggle to survive becomes a choice between the Capitol's rules, her humanity and the first signs of resistance.",
        descriptionSourceProvider: "Scholastic",
        descriptionSourceUrl:
          "https://www.scholastic.com/newsroom/all-news/press-release/the-hunger-games-by-suzanne-collins.html",
        evidenceLabel:
          "Guinness and Publishers Weekly: 27.7 million print and ebook copies sold in the United States during 2012 for the entire Hunger Games trilogy, not for this volume alone.",
        evidenceYear: 2012,
        evidenceUrl:
          "https://www.guinnessworldrecords.com/world-records/73517-best-selling-book-series-for-children-in-one-year",
      }),
    ],
    ernest_hemingway: [
      nobelLandmark({
        id: "the-old-man-and-the-sea",
        title: "Старик и море",
        titleEn: "The Old Man and the Sea",
        originalTitle: "The Old Man and the Sea",
        firstPublished: 1952,
        originalLanguage: "английский",
        genres: ["повесть", "морская проза", "модернизм"],
        tags: ["море", "рыбак", "стойкость", "достоинство"],
        descriptionRu:
          "Старый кубинский рыбак Сантьяго после долгой полосы неудач выходит далеко в море и вступает в изнурительную борьбу с огромным марлином. Лаконичная повесть исследует стойкость, одиночество и достоинство человека перед силами природы и неизбежной утратой.",
        descriptionEn:
          "After a long run of bad luck, the ageing Cuban fisherman Santiago sails far into the Gulf Stream and enters an exhausting struggle with a giant marlin. The spare novella examines endurance, solitude and human dignity in the face of nature and inevitable loss.",
        nobelYear: 1954,
        nobelSlug: "hemingway",
        wikidataId: "Q26505",
        wikidataFields: ["identity", "title", "publication-year", "language"],
      }),
    ],
    herman_melville: [
      verifiedWork({
        id: "moby-dick",
        title: "Моби Дик",
        alternateTitles: ["Моби-Дик, или Белый кит"],
        originalTitle: "Moby-Dick; or, The Whale",
        firstPublished: 1851,
        originalLanguage: "английский",
        genres: ["роман", "морская проза"],
        tags: ["море", "одержимость", "китобойный промысел", "символизм"],
        description:
          "Рассказ Измаила о плавании китобойного судна «Пекод» превращается в масштабный роман об одержимости капитана Ахава, границах знания и противостоянии человека непостижимому миру.",
        sourceUrl: "https://www.loc.gov/exhibits/america-reads/1750-to-1899.html#obj006",
      }),
    ],
    francis_scott_fitzgerald: [
      verifiedWork({
        id: "the-great-gatsby",
        title: "Великий Гэтсби",
        originalTitle: "The Great Gatsby",
        firstPublished: 1925,
        originalLanguage: "английский",
        genres: ["роман", "модернизм"],
        tags: ["эпоха джаза", "американская мечта", "богатство", "память"],
        description:
          "Роман о загадочном Джее Гэтсби и его попытке вернуть прошлое показывает блеск и нравственную пустоту эпохи джаза, превращая частную историю в исследование американской мечты.",
        sourceUrl: "https://www.loc.gov/exhibits/america-reads/1900-to-1949.html#obj016",
      }),
      verifiedWork({
        id: "tender-is-the-night",
        title: "Ночь нежна",
        originalTitle: "Tender Is the Night",
        firstPublished: 1934,
        originalLanguage: "английский",
        genres: ["роман", "психологическая проза"],
        tags: ["эмиграция", "брак", "зависимость", "утрата себя"],
        description:
          "История психиатра Дика Дайвера и его жены Николь разворачивается среди состоятельных американцев в Европе и постепенно раскрывает цену эмоциональной зависимости, обаяния и саморазрушения.",
        sourceUrl:
          "https://www.loc.gov/nls/new-materials/book-lists/best-american-fiction-1945/",
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

function mergeWork(current: WorkProfile | undefined, verified: VerifiedWork) {
  if (!current) return verified;
  return {
    ...current,
    ...verified,
    alternateTitles: [
      ...new Set([
        ...(current.alternateTitles || []),
        ...(verified.alternateTitles || []),
      ]),
    ],
    genres: [...new Set([...(current.genres || []), ...(verified.genres || [])])],
    tags: [...new Set([...(current.tags || []), ...(verified.tags || [])])],
    coverUrl: current.coverUrl,
    coverThumbnailUrl: current.coverThumbnailUrl,
    coverSourceUrl: current.coverSourceUrl,
    coverRights: current.coverRights,
    editorial: verified.editorial,
  };
}

function mergeWriter(writer: WriterProfile, verifiedWorks: VerifiedWork[]) {
  const incoming = new Map(
    verifiedWorks.map((work) => [normalizedTitle(work.title), work])
  );
  const workDetails = (writer.workDetails || []).map((work) => {
    const supplement = incoming.get(normalizedTitle(work.title));
    if (!supplement) return work;
    incoming.delete(normalizedTitle(work.title));
    return mergeWork(work, supplement);
  });
  workDetails.push(...incoming.values());
  const detailedTitles = new Set(
    workDetails.map((work) => normalizedTitle(work.title))
  );

  return {
    ...writer,
    works: (writer.works || []).filter(
      (title) => !detailedTitles.has(normalizedTitle(title))
    ),
    workDetails,
  };
}

export function mergeVerifiedBookSupplements(countries: Country[]): Country[] {
  return countries.map((country) => {
    const countrySupplements = supplements[country.id];
    if (!countrySupplements) return country;
    return {
      ...country,
      writers: country.writers.map((writer) =>
        countrySupplements[writer.id]
          ? mergeWriter(writer, countrySupplements[writer.id])
          : writer
      ),
    };
  });
}

export const verifiedBookSupplementTitles = Object.values(supplements).flatMap(
  (writers) => Object.values(writers).flatMap((works) => works.map((work) => work.title))
);

export const verifiedBilingualLandmarkTitles = Object.values(supplements).flatMap(
  (writers) =>
    Object.values(writers).flatMap((works) =>
      works
        .filter((work) =>
          work.distinctions?.some(
            (distinction) => distinction.criterion === "award-cited-work"
          )
        )
        .map((work) => work.title)
  )
);

export const verifiedBestsellerEvidenceTitles = Object.values(supplements).flatMap(
  (writers) =>
    Object.values(writers).flatMap((works) =>
      works
        .filter((work) =>
          work.distinctions?.some(
            (distinction) => distinction.criterion === "bestseller-evidence"
          )
        )
        .map((work) => work.title)
    )
);
