import type {
  WriterBiographySourceProfile,
  WriterProfile,
} from "./types";

const reviewedAt = "2026-08-31";

type SourceSeed = {
  readonly provider: string;
  readonly title: string;
  readonly url: string;
};

type WriterSeed = {
  readonly id: string;
  readonly name: string;
  readonly fullName?: string;
  readonly years: string;
  readonly bio: string;
  readonly works: readonly string[];
  readonly genres: readonly string[];
  readonly tags: readonly string[];
  readonly sources: readonly [SourceSeed, SourceSeed, ...SourceSeed[]];
};

const seeds: readonly WriterSeed[] = [
  {
    id: "fyodor_tyutchev",
    name: "Фёдор Иванович Тютчев",
    years: "1803–1873",
    bio: "Фёдор Тютчев (1803–1873) — русский поэт и дипломат, член-корреспондент Петербургской академии наук. Среди его стихотворений — «Весенняя гроза», «Цицерон» и «Наш век».",
    works: ["Весенняя гроза", "Цицерон", "Наш век"],
    genres: ["поэзия", "лирика"],
    tags: ["XIX век", "романтизм"],
    sources: [
      {
        provider: "Большая российская энциклопедия",
        title: "Тютчев Фёдор Иванович",
        url: "https://bigenc.ru/wiki/%D0%A2%D1%8E%D1%82%D1%87%D0%B5%D0%B2_%D0%A4%D1%91%D0%B4%D0%BE%D1%80_%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2%D0%B8%D1%87",
      },
      {
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        title: "Фёдор Иванович Тютчев",
        url: "https://www.prlib.ru/node/1282929",
      },
    ],
  },
  {
    id: "afanasiy_fet",
    name: "Афанасий Афанасьевич Фет",
    years: "1820–1892",
    bio: "Афанасий Фет (1820–1892) — русский поэт, переводчик и мемуарист, член-корреспондент Петербургской академии наук. Он выпустил первый сборник «Лирический пантеон», а позднее — четыре выпуска сборника «Вечерние огни».",
    works: ["Лирический пантеон", "Вечерние огни", "Мои воспоминания"],
    genres: ["поэзия", "перевод", "мемуары"],
    tags: ["XIX век", "лирика"],
    sources: [
      {
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        title: "Афанасий Афанасьевич Фет",
        url: "https://www.prlib.ru/history/2071338",
      },
      {
        provider: "Культура.РФ",
        title: "Афанасий Фет",
        url: "https://www.culture.ru/persons/8274/afanasii-fet",
      },
    ],
  },
  {
    id: "maxim_gorky",
    name: "Максим Горький",
    fullName: "Алексей Максимович Пешков",
    years: "1868–1936",
    bio: "Максим Горький (Алексей Максимович Пешков; 1868–1936) — русский писатель, публицист и общественный деятель. Среди его произведений — пьеса «На дне», роман «Мать» и автобиографические повести «Детство» и «В людях».",
    works: ["На дне", "Мать", "Детство", "В людях"],
    genres: ["проза", "драматургия", "публицистика"],
    tags: ["XIX век", "XX век"],
    sources: [
      {
        provider: "Большая российская энциклопедия",
        title: "Горький Максим",
        url: "https://bigenc.ru/wiki/%D0%93%D0%BE%D1%80%D1%8C%D0%BA%D0%B8%D0%B9_%D0%9C%D0%B0%D0%BA%D1%81%D0%B8%D0%BC",
      },
      {
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        title: "Максим Горький",
        url: "https://www.prlib.ru/history/1916692",
      },
    ],
  },
  {
    id: "alexander_kuprin",
    name: "Александр Иванович Куприн",
    years: "1870–1938",
    bio: "Александр Куприн (1870–1938) — русский писатель, переводчик и публицист. Среди его произведений — повести «Олеся», «Поединок» и «Гранатовый браслет».",
    works: ["Олеся", "Поединок", "Гранатовый браслет"],
    genres: ["проза", "повесть", "публицистика"],
    tags: ["XIX век", "XX век"],
    sources: [
      {
        provider: "Большая российская энциклопедия",
        title: "Куприн Александр Иванович",
        url: "https://bigenc.ru/wiki/%D0%9A%D1%83%D0%BF%D1%80%D0%B8%D0%BD_%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80_%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2%D0%B8%D1%87",
      },
      {
        provider: "Культура.РФ",
        title: "Александр Куприн",
        url: "https://www.culture.ru/persons/8191/aleksandr-kuprin",
      },
    ],
  },
  {
    id: "andrei_bely",
    name: "Андрей Белый",
    fullName: "Борис Николаевич Бугаев",
    years: "1880–1934",
    bio: "Андрей Белый (Борис Николаевич Бугаев; 1880–1934) — русский поэт, прозаик и теоретик символизма. Он написал роман «Петербург», поэтический сборник «Золото в лазури» и мемуарную книгу «На рубеже двух столетий».",
    works: ["Петербург", "Золото в лазури", "На рубеже двух столетий"],
    genres: ["роман", "поэзия", "мемуары"],
    tags: ["Серебряный век", "символизм"],
    sources: [
      {
        provider: "Государственный музей А. С. Пушкина",
        title: "Мемориальная квартира Андрея Белого",
        url: "https://www.pushkinmuseum.ru/?q=content%2Fmemorialnaya-kvartira-andreya-belogo",
      },
      {
        provider: "Культура.РФ",
        title: "Андрей Белый",
        url: "https://www.culture.ru/persons/8134/andrei-belyi",
      },
    ],
  },
  {
    id: "vladimir_mayakovsky",
    name: "Владимир Владимирович Маяковский",
    years: "1893–1930",
    bio: "Владимир Маяковский (1893–1930) — русский советский поэт, драматург и художник, связанный с кубофутуризмом. Среди его произведений — поэмы «Облако в штанах» и «Про это», а также пьесы «Клоп» и «Баня».",
    works: ["Облако в штанах", "Про это", "Клоп", "Баня"],
    genres: ["поэзия", "поэма", "драматургия"],
    tags: ["XX век", "кубофутуризм"],
    sources: [
      {
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        title: "Владимир Владимирович Маяковский",
        url: "https://www.prlib.ru/history/1894330",
      },
      {
        provider: "Культура.РФ",
        title: "Владимир Маяковский",
        url: "https://www.culture.ru/persons/8266/vladimir-mayakovskii",
      },
    ],
  },
  {
    id: "yevgeny_zamyatin",
    name: "Евгений Иванович Замятин",
    years: "1884–1937",
    bio: "Евгений Замятин (1884–1937) — русский прозаик, драматург, сценарист, критик и публицист, работавший инженером-кораблестроителем. Он написал роман «Мы», повесть «Островитяне» и пьесу «Блоха».",
    works: ["Мы", "Островитяне", "Блоха"],
    genres: ["роман", "повесть", "драматургия"],
    tags: ["XX век", "антиутопия"],
    sources: [
      {
        provider: "Российская национальная библиотека",
        title: "Евгений Иванович Замятин",
        url: "https://expositions.nlr.ru/ex_manus/zamjatin/index.php",
      },
      {
        provider: "Институт мировой литературы имени А. М. Горького РАН",
        title: "Замятин Е. И.",
        url: "https://gorky-vostok.imli.ru/spisok-vsekh-tegov/zamyatin-e-i",
      },
    ],
  },
  {
    id: "andrei_platonov",
    name: "Андрей Платонович Платонов",
    years: "1899–1951",
    bio: "Андрей Платонов (Андрей Платонович Климентов; 1899–1951) — русский писатель, поэт и драматург, работавший также инженером-мелиоратором. Среди его произведений — роман «Чевенгур» и повесть «Котлован».",
    works: ["Чевенгур", "Котлован", "Возвращение"],
    genres: ["роман", "повесть", "рассказ"],
    tags: ["XX век", "советская литература"],
    sources: [
      {
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        title: "Андрей Платонович Платонов",
        url: "https://www.prlib.ru/history/2056240",
      },
      {
        provider: "Культура.РФ",
        title: "Андрей Платонов",
        url: "https://www.culture.ru/persons/13775/andrei-platonov",
      },
    ],
  },
  {
    id: "mikhail_zoshchenko",
    name: "Михаил Михайлович Зощенко",
    years: "1894–1958",
    bio: "Михаил Зощенко (1894–1958) — русский советский писатель, драматург и сценарист, участник литературного объединения «Серапионовы братья». Он создал сатирические рассказы, «Голубую книгу» и повесть «Перед восходом солнца».",
    works: ["Голубая книга", "Перед восходом солнца", "Рассказы Назара Ильича господина Синебрюхова"],
    genres: ["рассказ", "повесть", "сатира"],
    tags: ["XX век", "советская литература"],
    sources: [
      {
        provider: "Культура.РФ",
        title: "Михаил Зощенко",
        url: "https://www.culture.ru/persons/9974/mikhail-zoshenko",
      },
      {
        provider: "Государственный литературный музей «XX век»",
        title: "М. М. Зощенко",
        url: "https://museum-xxvek.ru/mk-zoshhenko",
      },
    ],
  },
  {
    id: "alexander_tvardovsky",
    name: "Александр Трифонович Твардовский",
    years: "1910–1971",
    bio: "Александр Твардовский (1910–1971) — русский поэт, прозаик и журналист, дважды возглавлявший журнал «Новый мир». Он написал поэмы «Василий Тёркин», «Дом у дороги» и «По праву памяти».",
    works: ["Василий Тёркин", "Дом у дороги", "По праву памяти"],
    genres: ["поэзия", "поэма", "проза"],
    tags: ["XX век", "советская литература"],
    sources: [
      {
        provider: "Большая российская энциклопедия",
        title: "Твардовский Александр Трифонович",
        url: "https://bigenc.ru/c/tvardovskii-aleksandr-trifonovich-a2e629",
      },
      {
        provider: "Президентская библиотека имени Б. Н. Ельцина",
        title: "Александр Трифонович Твардовский",
        url: "https://www.prlib.ru/node/658905",
      },
    ],
  },
  {
    id: "varlam_shalamov",
    name: "Варлам Тихонович Шаламов",
    years: "1907–1982",
    bio: "Варлам Шаламов (1907–1982) — русский прозаик и поэт, прошедший многолетнее заключение в советских лагерях. В его наследие входят цикл «Колымские рассказы», автобиографическая повесть «Четвёртая Вологда» и поэтический цикл «Колымские тетради».",
    works: ["Колымские рассказы", "Четвёртая Вологда", "Колымские тетради"],
    genres: ["проза", "рассказ", "поэзия"],
    tags: ["XX век", "лагерная проза"],
    sources: [
      {
        provider: "Большая российская энциклопедия",
        title: "Шаламов Варлам Тихонович",
        url: "https://bigenc.ru/wiki/%D0%A8%D0%B0%D0%BB%D0%B0%D0%BC%D0%BE%D0%B2_%D0%92%D0%B0%D1%80%D0%BB%D0%B0%D0%BC_%D0%A2%D0%B8%D1%85%D0%BE%D0%BD%D0%BE%D0%B2%D0%B8%D1%87",
      },
      {
        provider: "Культура.РФ",
        title: "Варлам Шаламов: стихотворения",
        url: "https://www.culture.ru/materials/202672/varlam-shalamov-stikhotvoreniya",
      },
    ],
  },
  {
    id: "vasily_grossman",
    name: "Василий Семёнович Гроссман",
    years: "1905–1964",
    bio: "Василий Гроссман (1905–1964) — русский советский писатель, работавший военным корреспондентом газеты «Красная звезда» в годы Великой Отечественной войны. Он написал романы «За правое дело» и «Жизнь и судьба», а также документальный очерк «Треблинский ад».",
    works: ["За правое дело", "Жизнь и судьба", "Треблинский ад"],
    genres: ["роман", "очерк", "военная проза"],
    tags: ["XX век", "советская литература"],
    sources: [
      {
        provider: "Российская государственная библиотека",
        title: "Василий Гроссман",
        url: "https://infoculture.rsl.ru/_IK_Archive/OKJ/texts/2005/2005-12-12.htm",
      },
      {
        provider: "Российский государственный архив кинофотодокументов",
        title: "Гроссман Василий Семёнович",
        url: "https://photo.rgakfd.ru/photo/301098",
      },
    ],
  },
];

function biographySource(source: SourceSeed): WriterBiographySourceProfile {
  return {
    provider: source.provider,
    title: source.title,
    url: source.url,
    fields: ["identity", "life-dates", "biography-facts", "works"],
    usage: "fact-check",
    retrievedAt: reviewedAt,
  };
}

export const russianWriterExpansion: readonly WriterProfile[] = seeds.map(
  (seed) => ({
    id: seed.id,
    name: seed.name,
    fullName: seed.fullName ?? seed.name,
    years: seed.years,
    country: "Россия",
    portrait: "",
    bio: seed.bio,
    works: [...seed.works],
    genres: [...seed.genres],
    language: "русский",
    languages: ["русский"],
    nationality: "русский",
    awards: [],
    relatedWriters: [],
    tags: [...seed.tags],
    articleUrl: "",
    biographyTranslations: {
      ru: {
        locale: "ru",
        text: seed.bio,
        sourceLanguage: "ru",
        status: "verified",
        method: "editorial-original",
        reviewedAt,
        reviewer: "Редакционная фактологическая проверка Codex",
        sources: [biographySource(seed.sources[0])],
      },
    },
    editorial: {
      status: "verified",
      reviewedAt,
      sources: seed.sources.map((source) => ({
        title: source.title,
        url: source.url,
        publisher: source.provider,
      })),
    },
  })
);

function birthYear(writer: WriterProfile): number {
  const value = writer.birthDate || writer.birth || writer.years || "";
  const match = String(value).match(/\d{4}/u);
  return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
}

export function mergeRussianWriterExpansion(
  writers: readonly WriterProfile[]
): WriterProfile[] {
  const merged = [...writers, ...russianWriterExpansion];
  const keys = merged.map((writer) => writer.id);
  if (new Set(keys).size !== keys.length) {
    throw new Error("Russian writer expansion contains a duplicate writer id");
  }
  return merged.sort(
    (left, right) =>
      birthYear(left) - birthYear(right) ||
      String(left.name || left.fullName || left.id).localeCompare(
        String(right.name || right.fullName || right.id),
        "ru"
      )
  );
}
