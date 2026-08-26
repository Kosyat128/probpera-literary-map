import type { WorkProfile, WriterProfile } from "./types";

const reviewedAt = "2026-08-01";

type CatalogEntry = readonly [
  title: string,
  articleUrl: string,
  form?: string,
  alternateTitles?: readonly string[],
];

function stableId(title: string, articleUrl: string) {
  const source = `${title}|${articleUrl}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `article-catalog-${(hash >>> 0).toString(36)}`;
}

function catalogWork([
  title,
  articleUrl,
  form = "проза",
  alternateTitles,
]: CatalogEntry): WorkProfile {
  return {
    id: stableId(title, articleUrl),
    title,
    alternateTitles: alternateTitles ? [...alternateTitles] : undefined,
    genres: [form],
    tags: ["редакционная подборка", "упоминается в статье"],
    description:
      "Произведение представлено в редакционной книжной подборке «Пробы Пера». Карточка связана с исходной статьёй и её иллюстрациями.",
    sourceUrl: articleUrl,
    editorial: { status: "reviewed", reviewedAt },
  };
}

function writer(
  id: string,
  name: string,
  entries: CatalogEntry[],
  details: Partial<WriterProfile> = {}
): WriterProfile {
  const workDetails = entries.map(catalogWork);
  return {
    id,
    name,
    fullName: name,
    portrait: "",
    bio: `${name} представлен в книжном архиве произведениями из авторских подборок «Пробы Пера». Расширенная биографическая карточка проходит редакционную проверку; неподтверждённые даты и факты не публикуются.`,
    genres: ["проза"],
    ...details,
    works: workDetails.map((work) => work.title),
    workDetails,
    articles: [...new Set(entries.map(([, articleUrl]) => articleUrl))],
    editorial: details.editorial || {
      status: "draft",
      reviewedAt,
      sources: [
        {
          title: "Редакционная публикация «Пробы Пера»",
          url: entries[0][1],
          publisher: "Проба Пера",
        },
      ],
    },
  };
}

const pirates = "https://probpera.ru/read/page-article/knigniy-gid/1";
const century =
  "https://probpera.ru/read/page-article/luchshie-bestselleri-21-veka/1";
const jackLondon =
  "https://probpera.ru/read/page-article/luchshie-knigi-pisateley/1";
const pageTurner = (part: number) =>
  `https://probpera.ru/read/page-article/top-books-page-turners/${part}`;

export const articleCatalogWriters: Record<string, WriterProfile[]> = {
  afghanistan: [
    writer("khaled_hosseini", "Халед Хоссейни", [
      ["Бегущий за ветром", pageTurner(2), "роман"],
    ]),
  ],
  argentina: [
    writer("ernesto_sabato", "Эрнесто Сабато", [
      ["Тоннель", pageTurner(5), "роман"],
    ]),
  ],
  australia: [
    writer("gregory_david_roberts", "Грегори Дэвид Робертс", [
      ["Шантарам", pageTurner(1), "роман"],
    ]),
    writer("terry_hayes", "Терри Хейс", [
      ["Я - Пилигрим", pageTurner(3), "роман", ["Я Пилигрим"]],
    ]),
  ],
  cyprus: [
    writer("alex_michaelides", "Алекс Михаэлидес", [
      ["Безмолвный пациент", pageTurner(2), "роман"],
    ]),
  ],
  dominican_republic: [
    writer("junot_diaz", "Джуно Диас", [
      ["Краткая фантастическая жизнь Оскара Вао", century, "роман"],
    ]),
  ],
  england: [
    writer("rafael_sabatini", "Рафаэль Сабатини", [
      ["Одиссея капитана Блада", pirates, "роман"],
      ["Морской ястреб", pirates, "роман"],
    ]),
    writer("walter_scott", "Вальтер Скотт", [
      ["Пират", pirates, "роман"],
    ]),
    writer("arthur_conan_doyle", "Артур Конан Дойл", [
      ["Капитан Шарки", pirates, "цикл рассказов"],
    ]),
    writer("daniel_defoe", "Даниель Дефо", [
      [
        "Жизнь и пиратские приключения славного капитана Сингльтона",
        pirates,
        "роман",
      ],
    ]),
    writer("celia_rees", "Селия Рис", [["Пираты", pirates, "роман"]]),
    writer("ronald_delderfield", "Рональд Делдерфилд", [
      ["Приключения Бена Ганна", pirates, "роман"],
    ]),
    writer("ian_mcewan", "Иэн Макьюэн", [
      ["Искупление", century, "роман"],
    ]),
    writer("hilary_mantel", "Хилари Мантел", [
      ["Волчий зал", century, "роман"],
    ]),
    writer("joanne_harris", "Джоанн Харрис", [
      ["Пять четвертинок апельсина", pageTurner(1), "роман"],
    ]),
    writer("anthony_burgess", "Энтони Бёрджесс", [
      ["Заводной апельсин", pageTurner(1), "роман"],
    ]),
    writer("paula_hawkins", "Пола Хокинс", [
      ["Девушка в поезде", pageTurner(1), "роман"],
    ]),
    writer("john_marrs", "Джон Маррс", [
      ["Пассажиры", pageTurner(3), "роман"],
    ]),
    writer("stuart_turton", "Стюарт Тёртон", [
      ["Семь смертей Эвелины Хардкасл", pageTurner(3), "роман"],
      ["Дьявол и тёмная вода", pageTurner(6), "роман"],
    ]),
    writer("diane_setterfield", "Диана Сеттерфилд", [
      ["Тринадцатая сказка", pageTurner(3), "роман"],
    ]),
    writer("liz_jensen", "Лиз Дженсен", [
      ["Девятая жизнь Луи Дракса", pageTurner(4), "роман"],
    ]),
    writer("agatha_christie", "Агата Кристи", [
      [
        "И никого не стало",
        pageTurner(4),
        "роман",
        ["Десять негритят"],
      ],
    ]),
    writer("lee_child", "Ли Чайлд", [
      ["Этаж смерти", pageTurner(4), "роман"],
    ]),
    writer("frederick_forsyth", "Фредерик Форсайт", [
      ["День Шакала", pageTurner(5), "роман"],
    ]),
    writer("john_fowles", "Джон Фаулз", [
      ["Коллекционер", pageTurner(5), "роман"],
    ]),
    writer("alex_garland", "Алекс Гарленд", [
      ["Пляж", pageTurner(5), "роман"],
    ]),
    writer("john_le_carre", "Джон ле Карре", [
      ["Маленькая барабанщица", pageTurner(6), "роман"],
    ]),
  ],
  france: [
    writer("albert_camus", "Альбер Камю", [
      ["Посторонний", pageTurner(3), "повесть", ["Чужак"]],
    ]),
    writer("franck_thilliez", "Франк Тилье", [
      ["Головокружение", pageTurner(3), "роман"],
    ]),
  ],
  germany: [
    writer("erich_maria_remarque", "Эрих Мария Ремарк", [
      ["Чёрный обелиск", pageTurner(6), "роман"],
    ]),
  ],
  italy: [
    writer("emilio_salgari", "Эмилио Сальгари", [
      ["Чёрный корсар", pirates, "роман"],
    ]),
  ],
  norway: [
    writer("jo_nesbo", "Ю Несбё", [
      ["Снеговик", pageTurner(3), "роман"],
    ]),
  ],
  russia: [
    writer("robert_shtilmark", "Роберт Александрович Штильмарк", [
      ["Наследник из Калькутты", pirates, "роман"],
    ]),
    writer("sergey_lukyanenko", "Сергей Васильевич Лукьяненко", [
      ["Лабиринт отражений", pageTurner(4), "роман"],
    ]),
  ],
  sweden: [
    writer("stieg_larsson", "Стиг Ларссон", [
      ["Девушка с татуировкой дракона", pageTurner(1), "роман"],
    ]),
    writer("lars_kepler", "Ларс Кеплер", [
      ["Гипнотизёр", pageTurner(6), "роман"],
    ]),
  ],
  usa: [
    writer("james_fenimore_cooper", "Джеймс Фенимор Купер", [
      ["Красный корсар", pirates, "роман"],
    ]),
    writer("tim_powers", "Тим Пауэрс", [
      ["На странных волнах", pirates, "роман"],
    ]),
    writer("michael_crichton", "Майкл Крайтон", [
      ["Пиратские широты", pirates, "роман"],
      ["Сфера", pageTurner(2), "роман"],
    ]),
    writer("john_steinbeck", "Джон Стейнбек", [
      ["Золотая чаша", pirates, "роман"],
    ]),
    writer("howard_pyle", "Говард Пайл", [
      ["Книга пиратов", pirates, "сборник"],
    ]),
    writer("donna_tartt", "Донна Тартт", [["Щегол", century, "роман"]]),
    writer("george_saunders", "Джордж Сондерс", [
      ["Линкольн в бардо", century, "роман"],
    ]),
    writer("min_jin_lee", "Мин Джин Ли", [
      ["Дорога в тысячу ли", century, "роман"],
    ]),
    writer("jack_london", "Джек Лондон", [
      ["Железная пята", jackLondon, "роман"],
      ["Сердца трёх", jackLondon, "роман"],
      ["Лунная долина", jackLondon, "роман"],
      ["Люди бездны", jackLondon, "документальная проза"],
      ["Смок Беллью", jackLondon, "цикл рассказов"],
      ["Время-не-ждёт", jackLondon, "роман"],
    ]),
    writer("dan_brown", "Дэн Браун", [
      ["Код да Винчи", pageTurner(1), "роман"],
    ]),
    writer("andy_weir", "Энди Вейр", [
      ["Марсианин", pageTurner(1), "роман"],
    ]),
    writer("stephen_king", "Стивен Кинг", [
      ["Рита Хейуорт, или Побег из Шоушенка", pageTurner(1), "повесть"],
      ["Кладбище домашних животных", pageTurner(3), "роман"],
    ]),
    writer("suzanne_collins", "Сьюзен Коллинз", [
      ["Голодные игры", pageTurner(1), "роман"],
    ]),
    writer("gillian_flynn", "Гиллиан Флинн", [
      ["Исчезнувшая", pageTurner(2), "роман"],
    ]),
    writer("dennis_lehane", "Деннис Лихэйн", [
      ["Остров проклятых", pageTurner(2), "роман"],
    ]),
    writer("thomas_harris", "Томас Харрис", [
      ["Молчание ягнят", pageTurner(2), "роман"],
    ]),
    writer("ray_bradbury", "Рэй Брэдбери", [
      [
        "451° по Фаренгейту",
        pageTurner(2),
        "роман",
        ["451 градус по Фаренгейту"],
      ],
    ]),
    writer("patricia_highsmith", "Патриция Хайсмит", [
      ["Талантливый мистер Рипли", pageTurner(2), "роман"],
    ]),
    writer("blaine_harden", "Блейн Харден", [
      ["Побег из лагеря 14", pageTurner(2), "документальная проза"],
    ]),
    writer("ransom_riggs", "Рэнсом Риггз", [
      ["Дом странных детей мисс Перегрин", pageTurner(3), "роман"],
    ]),
    writer("blake_crouch", "Блейк Крауч", [
      ["Тёмная материя", pageTurner(4), "роман", ["Темная материя"]],
    ]),
    writer("ernest_cline", "Эрнест Клайн", [
      ["Первому игроку приготовиться", pageTurner(4), "роман"],
    ]),
    writer("james_rollins", "Джеймс Роллинс", [
      ["Царство костей", pageTurner(4), "роман"],
    ]),
    writer("n_k_jemisin", "Нора Кейт Джемисин", [
      ["Пятое время года", pageTurner(4), "роман"],
    ]),
    writer("robert_ludlum", "Роберт Ладлэм", [
      ["Идентификация Борна", pageTurner(4), "роман"],
    ]),
    writer("dan_simmons", "Дэн Симмонс", [
      ["Террор", pageTurner(4), "роман"],
    ]),
    writer("daniel_keyes", "Дэниел Киз", [
      ["Таинственная история Билли Миллигана", pageTurner(5), "документальная проза"],
    ]),
    writer("mark_danielewski", "Марк Данилевский", [
      ["Дом листьев", pageTurner(5), "роман"],
    ]),
    writer("douglas_preston_lincoln_child", "Дуглас Престон и Линкольн Чайлд", [
      ["Реликт", pageTurner(5), "роман"],
    ]),
    writer("dean_koontz", "Дин Кунц", [
      ["Ложная память", pageTurner(6), "роман"],
    ]),
    writer("michael_connelly", "Майкл Коннелли", [
      ["Пятый свидетель", pageTurner(6), "роман"],
    ]),
    writer("john_irving", "Джон Ирвинг", [
      ["Правила виноделов", pageTurner(6), "роман"],
    ]),
    writer("tom_clancy", "Том Клэнси", [
      ["Охота за „Красным Октябрём“", pageTurner(6), "роман"],
    ]),
  ],
};
