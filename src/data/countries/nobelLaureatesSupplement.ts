import {
  officialNobelLiteratureRecordForWriterKey,
  officialNobelLiteratureSnapshot,
  type OfficialNobelLiteratureRecord,
} from "./nobelLiteratureRegistry";
import type {
  Country,
  NobelLiteratureAwardProfile,
  WriterProfile,
} from "./types";

type LaureateDraft = WriterProfile & {
  nobelYear: number;
  nobelId: number;
  nobelSlug: string;
};

const checkedAt = "2026-08-01";
const nobelMetadataVerifiedAt = officialNobelLiteratureSnapshot.retrievedAt;
const nobelSignal = /нобел|nobel/iu;

const specialStatusByLaureateId: Partial<
  Record<number, NobelLiteratureAwardProfile["specialStatus"]>
> = {
  604: "posthumous",
  629: "accepted-then-forced-to-decline",
  637: "declined",
};

const specialStatusSourceByLaureateId: Partial<Record<number, string>> = {
  604: "https://www.nobelprize.org/prizes/literature/1931/karlfeldt/facts/",
  629: "https://www.nobelprize.org/prizes/literature/1958/pasternak/facts/",
  637: "https://www.nobelprize.org/prizes/literature/1964/sartre/facts/",
};

function officialAwardSources(record: OfficialNobelLiteratureRecord) {
  const sources = [
    {
      title: `Nobel Prize API — ${record.name}`,
      url: record.apiUrl,
      publisher: "Nobel Prize Outreach" as const,
    },
    {
      title: `${record.name} — Nobel Prize laureate record`,
      url: record.htmlUrl,
      publisher: "Nobel Prize Outreach" as const,
    },
  ];
  const specialStatusSource = specialStatusSourceByLaureateId[record.id];
  return specialStatusSource
    ? [
        ...sources,
        {
          title: `${record.name} — Nobel Prize facts`,
          url: specialStatusSource,
          publisher: "Nobel Prize Outreach" as const,
        },
      ]
    : sources;
}

export function enrichNobelLiteratureWriter(
  writer: WriterProfile,
  record: OfficialNobelLiteratureRecord
): WriterProfile {
  const canonicalAward = `Нобелевская премия по литературе ${record.year} года`;
  const existingAwards = writer.awards || [];
  const hasCorrectYearAward = existingAwards.some(
    (award) => nobelSignal.test(award) && award.includes(String(record.year))
  );
  const tags = writer.tags || [];

  return {
    ...writer,
    nobel: true,
    nobelYear: record.year,
    nobelPrize: canonicalAward,
    nobelAward: {
      category: "literature",
      year: record.year,
      laureateId: record.id,
      portion: record.portion,
      verifiedAt: nobelMetadataVerifiedAt,
      specialStatus: specialStatusByLaureateId[record.id],
      sources: officialAwardSources(record),
    },
    awards: hasCorrectYearAward
      ? existingAwards
      : [canonicalAward, ...existingAwards],
    tags: tags.includes("Нобелевская премия")
      ? tags
      : ["Нобелевская премия", ...tags],
  };
}

function verifiedLaureate(laureate: LaureateDraft): WriterProfile {
  const { nobelId, nobelSlug, nobelYear, ...profile } = laureate;
  const sources = [
    {
      title: `Nobel Prize in Literature ${nobelYear}`,
      url: `https://www.nobelprize.org/prizes/literature/${nobelYear}/${nobelSlug}/facts/`,
      publisher: "Nobel Prize Outreach",
    },
    {
      title: "Nobel Prize API — laureate record",
      url: `https://api.nobelprize.org/2/laureate/${nobelId}`,
      publisher: "Nobel Prize Outreach",
    },
  ];
  const russianBiography = profile.biography || profile.bio || profile.description;
  return {
    ...profile,
    nobel: true,
    nobelYear,
    awards: [
      `Нобелевская премия по литературе ${nobelYear} года`,
      ...(profile.awards || []),
    ],
    tags: ["Нобелевская премия", ...(profile.tags || [])],
    articleUrl: profile.articleUrl || "",
    biographyTranslations: russianBiography
      ? {
          ru: {
            locale: "ru",
            text: russianBiography,
            sourceLanguage: "ru",
            status: "verified",
            method: "editorial-original",
            reviewedAt: checkedAt,
            sources: sources.map((source) => ({
              provider: source.publisher,
              title: source.title,
              url: source.url,
              fields: ["identity", "life-dates", "awards", "works"],
              usage: "fact-check",
              retrievedAt: checkedAt,
            })),
          },
        }
      : undefined,
    editorial: {
      status: "verified",
      reviewedAt: checkedAt,
      sources,
    },
  };
}

// Эти карточки входят в единую базу countries. Файл не является параллельным
// каталогом: при сборке записи добавляются непосредственно к объекту страны.
const laureatesByCountryCode: Record<string, LaureateDraft[]> = {
  pl: [
    {
      id: "wladyslaw_reymont",
      name: "Владислав Станислав Реймонт",
      fullName: "Władysław Stanisław Reymont",
      years: "1867–1925",
      birthDate: "1867-05-07",
      deathDate: "1925-12-05",
      birthPlace: "Радомско, Польша",
      coordinates: { lat: 51.067, lng: 19.445 },
      bio: "Польский прозаик, чьё повествование соединяет широкую социальную панораму с вниманием к повседневному труду, ритуалам и речи народа. Нобелевская премия 1924 года была присуждена ему прежде всего за четырёхтомный роман «Мужики», эпическое изображение деревенской жизни на рубеже веков.",
      works: ["Мужики", "Земля обетованная"],
      genres: ["роман", "реализм"],
      language: "польский",
      nationality: "поляк",
      nobelYear: 1924,
      nobelId: 594,
      nobelSlug: "reymont",
    },
    {
      id: "olga_tokarczuk",
      name: "Ольга Токарчук",
      fullName: "Olga Nawoja Tokarczuk",
      years: "1962–",
      birthDate: "1962-01-29",
      birthPlace: "Сулехув, Польша",
      coordinates: { lat: 52.084, lng: 15.625 },
      bio: "Польская писательница и эссеистка, строящая романы как подвижные созвездия историй, мифов и маршрутов. Премия за 2018 год отметила её повествовательное воображение, с энциклопедической страстью представляющее пересечение границ как форму жизни.",
      works: ["Бегуны", "Книги Иакова", "Веди свой плуг по костям мертвецов"],
      genres: ["роман", "эссе", "магический реализм"],
      language: "польский",
      nationality: "полька",
      nobelYear: 2018,
      nobelId: 979,
      nobelSlug: "tokarczuk",
    },
  ],
  fr: [
    {
      id: "henri_bergson",
      name: "Анри-Луи Бергсон",
      fullName: "Henri-Louis Bergson",
      years: "1859–1941",
      birthDate: "1859-10-18",
      deathDate: "1941-01-04",
      birthPlace: "Париж, Франция",
      coordinates: { lat: 48.857, lng: 2.352 },
      bio: "Французский философ и мастер философской прозы, противопоставивший живую длительность механическому представлению о времени. Нобелевская премия 1927 года отметила богатство его идей и блестящее искусство их изложения.",
      works: ["Творческая эволюция", "Опыт о непосредственных данных сознания", "Два источника морали и религии"],
      genres: ["философская проза", "эссе"],
      language: "французский",
      nationality: "француз",
      nobelYear: 1927,
      nobelId: 600,
      nobelSlug: "bergson",
    },
    {
      id: "roger_martin_du_gard",
      name: "Роже Мартен дю Гар",
      fullName: "Roger Martin du Gard",
      years: "1881–1958",
      birthDate: "1881-03-23",
      deathDate: "1958-08-22",
      birthPlace: "Нёйи-сюр-Сен, Франция",
      coordinates: { lat: 48.884, lng: 2.268 },
      bio: "Французский романист, соединивший архивную точность, психологический анализ и масштаб семейной хроники. Центральный труд писателя — цикл «Семья Тибо», через судьбы двух братьев исследующий нравственные и политические разломы Европы начала XX века.",
      works: ["Семья Тибо", "Жан Баруа"],
      genres: ["роман", "семейная хроника"],
      language: "французский",
      nationality: "француз",
      nobelYear: 1937,
      nobelId: 609,
      nobelSlug: "gard",
    },
    {
      id: "francois_mauriac",
      name: "Франсуа Шарль Мориак",
      fullName: "François Charles Mauriac",
      years: "1885–1970",
      birthDate: "1885-10-11",
      deathDate: "1970-09-01",
      birthPlace: "Бордо, Франция",
      coordinates: { lat: 44.837, lng: -0.579 },
      bio: "Французский писатель и публицист, исследовавший внутреннюю несвободу человека, семейные страсти и нравственный выбор. Его сдержанная, психологически напряжённая проза принесла ему Нобелевскую премию 1952 года.",
      works: ["Тереза Дескейру", "Клубок змей", "Пустыня любви"],
      genres: ["роман", "психологическая проза"],
      language: "французский",
      nationality: "француз",
      nobelYear: 1952,
      nobelId: 623,
      nobelSlug: "mauriac",
    },
    {
      id: "saint_john_perse",
      name: "Сен-Жон Перс (Алексис Леже)",
      fullName: "Alexis Leger (Saint-John Perse)",
      years: "1887–1975",
      birthDate: "1887-05-31",
      deathDate: "1975-09-20",
      birthPlace: "Пуэнт-а-Питр, Гваделупа",
      coordinates: { lat: 16.241, lng: -61.534 },
      bio: "Французский поэт и дипломат, создавший торжественную, насыщенную природными и историческими образами поэзию странствия и изгнания. Нобелевская премия 1960 года была присуждена за высокий полёт и образную силу его стихов.",
      works: ["Анабасис", "Изгнание", "Ветры"],
      genres: ["поэзия"],
      language: "французский",
      nationality: "француз",
      nobelYear: 1960,
      nobelId: 631,
      nobelSlug: "perse",
    },
  ],
  se: [
    {
      id: "erik_axel_karlfeldt",
      name: "Эрик Аксель Карлфельдт",
      fullName: "Erik Axel Karlfeldt",
      years: "1864–1931",
      birthDate: "1864-07-20",
      deathDate: "1931-04-08",
      birthPlace: "Карлбо, Швеция",
      coordinates: { lat: 60.152, lng: 16.201 },
      bio: "Шведский поэт, превративший пейзажи и фольклор Даларны в самостоятельный лирический мир. Премия 1931 года была присуждена посмертно — в признание цельности и музыкальной силы его поэзии.",
      works: ["Песни Фридолина", "Флора и Помона"],
      genres: ["поэзия"],
      language: "шведский",
      nationality: "швед",
      nobelYear: 1931,
      nobelId: 604,
      nobelSlug: "karlfeldt",
    },
    {
      id: "nelly_sachs",
      name: "Нелли Леони Закс",
      fullName: "Nelly Leonie Sachs",
      years: "1891–1970",
      birthDate: "1891-12-10",
      deathDate: "1970-05-12",
      birthPlace: "Берлин, Германия",
      coordinates: { lat: 52.52, lng: 13.405 },
      bio: "Немецкоязычная поэтесса, спасшаяся от нацистских преследований в Швеции и сделавшая память о Катастрофе центром своей лирики. В 1966 году премия была разделена между Нелли Закс и Шмуэлем Йосефом Агноном.",
      works: ["В жилищах смерти", "Бегство и превращение", "Эли"],
      genres: ["поэзия", "драма"],
      language: "немецкий",
      nationality: "шведская писательница немецкого происхождения",
      nobelYear: 1966,
      nobelId: 640,
      nobelSlug: "sachs",
    },
    {
      id: "eyvind_johnson",
      name: "Эйвинд Юнсон",
      fullName: "Eyvind Johnson",
      years: "1900–1976",
      birthDate: "1900-07-29",
      deathDate: "1976-08-25",
      birthPlace: "Свартбьёрнсбюн, Швеция",
      coordinates: { lat: 65.851, lng: 21.688 },
      bio: "Шведский романист-самоучка, выросший в бедной семье на севере страны и рано начавший самостоятельно зарабатывать. Его проза соединяет европейскую историю, античный миф и нравственный опыт человека XX века. Автобиографический цикл о Улофе принёс писателю широкое признание, а в годы Второй мировой войны он открыто выступал против нацизма. Нобелевскую премию по литературе 1974 года Эйвинд Юнсон разделил с Харри Мартинсоном.",
      works: ["Роман об Улофе", "Прибой и берега", "Облака над Метапонтом"],
      genres: ["роман", "историческая проза"],
      language: "шведский",
      nationality: "швед",
      nobelYear: 1974,
      nobelId: 649,
      nobelSlug: "johnson",
    },
    {
      id: "harry_martinson",
      name: "Харри Эдмунд Мартинсон",
      fullName: "Harry Edmund Martinson",
      years: "1904–1978",
      birthDate: "1904-05-06",
      deathDate: "1978-02-11",
      birthPlace: "Йемсхёг, Швеция",
      coordinates: { lat: 56.24, lng: 14.538 },
      bio: "Шведский поэт и прозаик, прошедший путь от юнги и странника до автора одной из важнейших поэм о космическом одиночестве. В «Аниаре» научная фантастика становится философским размышлением о судьбе человечества.",
      works: ["Аниара", "Цветущая крапива", "Путь в Клокрике"],
      genres: ["поэзия", "роман", "научная фантастика"],
      language: "шведский",
      nationality: "швед",
      nobelYear: 1974,
      nobelId: 650,
      nobelSlug: "martinson",
    },
    {
      id: "tomas_transtromer",
      name: "Тумас Йоста Транстрёмер",
      fullName: "Tomas Gösta Tranströmer",
      years: "1931–2015",
      birthDate: "1931-04-15",
      deathDate: "2015-03-26",
      birthPlace: "Стокгольм, Швеция",
      coordinates: { lat: 59.329, lng: 18.069 },
      bio: "Шведский поэт, в коротких и прозрачных образах соединявший повседневность, природу, музыку и глубины памяти. Формулировка премии 2011 года подчеркнула, что его сгущённые образы дают читателю новый доступ к реальности.",
      works: ["Незавершённое небо", "Балтика", "Великая загадка"],
      genres: ["поэзия"],
      language: "шведский",
      nationality: "швед",
      nobelYear: 2011,
      nobelId: 868,
      nobelSlug: "transtromer",
    },
  ],
  gb: [
    {
      id: "john_galsworthy",
      name: "Джон Голсуорси",
      fullName: "John Galsworthy",
      years: "1867–1933",
      birthDate: "1867-08-14",
      deathDate: "1933-01-31",
      birthPlace: "Кингстон-Хилл, Англия",
      coordinates: { lat: 51.415, lng: -0.282 },
      bio: "Английский романист и драматург, наблюдавший за нравами собственнического общества с точностью хрониста и сочувствием гуманиста. Высшей точкой его прозы стала «Сага о Форсайтах», за повествовательное мастерство которой он получил премию 1932 года.",
      works: ["Сага о Форсайтах", "Современная комедия", "Справедливость"],
      genres: ["роман", "драма", "социальная проза"],
      language: "английский",
      nationality: "англичанин",
      nobelYear: 1932,
      nobelId: 605,
      nobelSlug: "galsworthy",
    },
    {
      id: "t_s_eliot",
      name: "Томас Стернз Элиот",
      fullName: "Thomas Stearns Eliot",
      years: "1888–1965",
      birthDate: "1888-09-26",
      deathDate: "1965-01-04",
      birthPlace: "Сент-Луис, США",
      coordinates: { lat: 38.627, lng: -90.199 },
      bio: "Англо-американский поэт, драматург и критик, один из архитекторов литературного модернизма. «Бесплодная земля» и «Четыре квартета» изменили поэтический язык XX века, соединив культурную память с опытом современного разрыва.",
      works: ["Бесплодная земля", "Четыре квартета", "Убийство в соборе"],
      genres: ["поэзия", "драма", "эссе"],
      language: "английский",
      nationality: "британец американского происхождения",
      nobelYear: 1948,
      nobelId: 619,
      nobelSlug: "eliot",
    },
    {
      id: "bertrand_russell",
      name: "Бертран Артур Уильям Рассел",
      fullName: "Bertrand Arthur William Russell",
      years: "1872–1970",
      birthDate: "1872-05-18",
      deathDate: "1970-02-02",
      birthPlace: "Треллек, Уэльс",
      coordinates: { lat: 51.746, lng: -2.722 },
      bio: "Британский философ, логик и общественный мыслитель, умевший превращать сложнейшие идеи в ясную и живую прозу. Премия 1950 года отметила разнообразие его сочинений, защищавших гуманистические идеалы и свободу мысли.",
      works: ["История западной философии", "Проблемы философии", "Почему я не христианин"],
      genres: ["философская проза", "эссе"],
      language: "английский",
      nationality: "британец",
      nobelYear: 1950,
      nobelId: 621,
      nobelSlug: "russell",
    },
    {
      id: "winston_churchill",
      name: "Уинстон Леонард Спенсер Черчилль",
      fullName: "Winston Leonard Spencer Churchill",
      years: "1874–1965",
      birthDate: "1874-11-30",
      deathDate: "1965-01-24",
      birthPlace: "Бленхеймский дворец, Англия",
      coordinates: { lat: 51.842, lng: -1.361 },
      bio: "Британский государственный деятель и автор масштабных историко-мемуарных трудов. Нобелевская премия по литературе 1953 года была присуждена за мастерство исторического и биографического описания и за блестящее ораторское искусство в защиту высоких человеческих ценностей.",
      works: ["Вторая мировая война", "Мальборо: его жизнь и время", "История англоязычных народов"],
      genres: ["мемуары", "историческая проза", "ораторское искусство"],
      language: "английский",
      nationality: "британец",
      nobelYear: 1953,
      nobelId: 624,
      nobelSlug: "churchill",
    },
  ],
  us: [
    {
      id: "pearl_s_buck",
      name: "Перл Сайденстрикер Бак",
      fullName: "Pearl Sydenstricker Buck",
      years: "1892–1973",
      birthDate: "1892-06-26",
      deathDate: "1973-03-06",
      birthPlace: "Хилсборо, США",
      coordinates: { lat: 38.135, lng: -80.212 },
      bio: "Американская писательница, выросшая в Китае и познакомившая западного читателя с жизнью китайской деревни без экзотизирующей дистанции. Роман «Земля» стал центром её широкой эпической картины семьи, труда и социальных перемен.",
      works: ["Земля", "Сыновья", "Разделённый дом"],
      genres: ["роман", "семейная сага"],
      language: "английский",
      nationality: "американка",
      nobelYear: 1938,
      nobelId: 610,
      nobelSlug: "buck",
    },
    {
      id: "saul_bellow",
      name: "Сол Беллоу",
      fullName: "Saul Bellow",
      years: "1915–2005",
      birthDate: "1915-06-10",
      deathDate: "2005-04-05",
      birthPlace: "Лашин, Канада",
      coordinates: { lat: 45.432, lng: -73.676 },
      bio: "Американский романист, в чьих книгах интеллектуальная энергия большого города сочетается с тонким исследованием одиночества и достоинства личности. Его герои ищут нравственную опору среди давления современной культуры.",
      works: ["Приключения Оги Марча", "Герцог", "Дар Гумбольдта"],
      genres: ["роман", "интеллектуальная проза"],
      language: "английский",
      nationality: "американец",
      nobelYear: 1976,
      nobelId: 652,
      nobelSlug: "bellow",
    },
    {
      id: "isaac_bashevis_singer",
      name: "Исаак Башевис-Зингер",
      fullName: "Isaac Bashevis Singer",
      years: "1903–1991",
      birthDate: "1903-11-21",
      deathDate: "1991-07-24",
      birthPlace: "Леончин, Польша",
      coordinates: { lat: 52.395, lng: 20.535 },
      bio: "Американский писатель польско-еврейского происхождения, создававший рассказы и романы на идише. В его прозе исчезнувший мир восточноевропейского еврейства живёт рядом с притчей, фольклором, сомнением и состраданием.",
      works: ["Сатана в Горае", "Семья Москат", "Шоша"],
      genres: ["роман", "рассказ", "притча"],
      language: "идиш",
      nationality: "американец польско-еврейского происхождения",
      nobelYear: 1978,
      nobelId: 654,
      nobelSlug: "singer",
    },
    {
      id: "louise_gluck",
      name: "Луиза Элизабет Глюк",
      fullName: "Louise Elisabeth Glück",
      years: "1943–2023",
      birthDate: "1943-04-22",
      deathDate: "2023-10-13",
      birthPlace: "Нью-Йорк, США",
      coordinates: { lat: 40.713, lng: -74.006 },
      bio: "Американская поэтесса, превращавшая личную память, семейный опыт и античный миф в предельно ясную лирику. Премия 2020 года отметила её безошибочный поэтический голос, строгая красота которого делает индивидуальное существование универсальным.",
      works: ["Дикий ирис", "Аверно", "Верная и добродетельная ночь"],
      genres: ["поэзия"],
      language: "английский",
      nationality: "американка",
      nobelYear: 2020,
      nobelId: 993,
      nobelSlug: "gluck",
    },
  ],
  dk: [
    {
      id: "johannes_v_jensen",
      name: "Йоханнес Вильгельм Йенсен",
      fullName: "Johannes Vilhelm Jensen",
      years: "1873–1950",
      birthDate: "1873-01-20",
      deathDate: "1950-11-25",
      birthPlace: "Фарсё, Дания",
      coordinates: { lat: 56.772, lng: 9.34 },
      bio: "Датский прозаик и поэт, соединявший миф, эволюционные идеи и историю североевропейского человека. Его цикл «Долгое путешествие» охватывает огромный временной диапазон и показывает развитие цивилизации как эпическое странствие.",
      works: ["Долгое путешествие", "Падение короля", "Мифы"],
      genres: ["роман", "поэзия", "эссе"],
      language: "датский",
      nationality: "датчанин",
      nobelYear: 1944,
      nobelId: 614,
      nobelSlug: "jensen",
    },
  ],
  at: [
    {
      id: "elias_canetti",
      name: "Элиас Канетти",
      fullName: "Elias Canetti",
      years: "1905–1994",
      birthDate: "1905-07-25",
      deathDate: "1994-08-14",
      birthPlace: "Русе, Болгария",
      coordinates: { lat: 43.848, lng: 25.954 },
      bio: "Немецкоязычный писатель, эссеист и мыслитель сефардского происхождения, чья жизнь связала Болгарию, Вену, Лондон и Цюрих. В романе «Ослепление» и исследовании «Масса и власть» он изучал механизмы одержимости, страха и коллективного поведения.",
      works: ["Ослепление", "Масса и власть", "Спасённый язык"],
      genres: ["роман", "эссе", "мемуары"],
      language: "немецкий",
      nationality: "британский писатель австрийской культурной традиции",
      nobelYear: 1981,
      nobelId: 658,
      nobelSlug: "canetti",
    },
  ],
  cz: [
    {
      id: "jaroslav_seifert",
      name: "Ярослав Сейферт",
      fullName: "Jaroslav Seifert",
      years: "1901–1986",
      birthDate: "1901-09-23",
      deathDate: "1986-01-10",
      birthPlace: "Прага, Чехия",
      coordinates: { lat: 50.076, lng: 14.438 },
      bio: "Чешский поэт и журналист, прошедший путь от авангарда 1920-х годов к прозрачной лирике памяти, любви и родного города. Нобелевская премия 1984 года отметила свежесть, чувственность и изобретательность его поэзии.",
      works: ["На волнах TSF", "Яблоко с колен", "Чумной столб"],
      genres: ["поэзия", "мемуары"],
      language: "чешский",
      nationality: "чех",
      nobelYear: 1984,
      nobelId: 661,
      nobelSlug: "seifert",
    },
  ],
  by: [
    {
      id: "svetlana_alexievich",
      name: "Светлана Александровна Алексиевич",
      fullName: "Светлана Александровна Алексиевич",
      years: "1948–",
      birthDate: "1948-05-31",
      birthPlace: "Станислав, Украинская ССР",
      coordinates: { lat: 48.922, lng: 24.711 },
      bio: "Белорусская русскоязычная писательница, создавшая полифоническую документальную прозу из свидетельств людей, переживших войну, советский быт, Афганистан и Чернобыль. Её книги сохраняют индивидуальные голоса там, где официальная история склонна говорить безлично.",
      works: ["У войны не женское лицо", "Цинковые мальчики", "Чернобыльская молитва", "Время секонд хэнд"],
      genres: ["документальная проза", "устная история"],
      language: "русский",
      nationality: "белоруска",
      nobelYear: 2015,
      nobelId: 924,
      nobelSlug: "alexievich",
    },
  ],
  no: [
    {
      id: "jon_fosse",
      name: "Юн Улав Фоссе",
      fullName: "Jon Olav Fosse",
      years: "1959–",
      birthDate: "1959-09-29",
      birthPlace: "Хёугесунн, Норвегия",
      coordinates: { lat: 59.413, lng: 5.268 },
      bio: "Норвежский драматург, прозаик и поэт, пишущий на нюнорске. Повторы, паузы и предельно простая речь в его пьесах и «Септологии» превращают молчание, веру и близость смерти в напряжённое сценическое и повествовательное пространство.",
      works: ["Септология", "Кто-то придёт", "Утро и вечер"],
      genres: ["драма", "роман", "поэзия"],
      language: "нюнорск",
      nationality: "норвежец",
      nobelYear: 2023,
      nobelId: 1032,
      nobelSlug: "fosse",
    },
  ],
  hu: [
    {
      id: "laszlo_krasznahorkai",
      name: "Ласло Краснахоркаи",
      fullName: "László Krasznahorkai",
      years: "1954–",
      birthDate: "1954-01-05",
      birthPlace: "Дьюла, Венгрия",
      coordinates: { lat: 46.646, lng: 21.278 },
      bio: "Венгерский прозаик, известный длинными, ритмически выстроенными фразами и тревожными мирами на границе распада и откровения. Нобелевская премия 2025 года отметила его убедительное и визионерское творчество, вновь утверждающее силу искусства среди апокалиптического ужаса.",
      works: ["Сатанинское танго", "Меланхолия сопротивления", "Си-ван-му здесь среди нас"],
      genres: ["роман", "философская проза"],
      language: "венгерский",
      nationality: "венгр",
      nobelYear: 2025,
      nobelId: 1056,
      nobelSlug: "krasznahorkai",
    },
  ],
};

export function mergeNobelLaureates(countries: Country[]): Country[] {
  return countries.map((country) => {
    const additions = laureatesByCountryCode[country.code || country.id] || [];
    const knownIds = new Set(country.writers.map((writer) => writer.id));
    const missing = additions
      .filter((writer) => !knownIds.has(writer.id))
      .map(verifiedLaureate);
    const writers = [...country.writers, ...missing];
    let enriched = false;
    const reconciledWriters = writers.map((writer) => {
      const officialRecord = officialNobelLiteratureRecordForWriterKey(
        `${country.id}:${writer.id}`
      );
      if (!officialRecord) return writer;
      enriched = true;
      return enrichNobelLiteratureWriter(writer, officialRecord);
    });

    return missing.length || enriched
      ? { ...country, writers: reconciledWriters }
      : country;
  });
}
