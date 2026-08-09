import type { Country, WriterProfile } from "./types";

export type WriterBiographyLegacyEvidence = {
  provider: string;
  url: string;
  checkedAt: string;
};

export type WriterBiographyLegacyCorrection = {
  countryId: string;
  writerId: string;
  text: string;
  evidence: WriterBiographyLegacyEvidence[];
};

const checkedAt = "2026-08-09";

function correction(
  countryId: string,
  writerId: string,
  text: string,
  provider: string,
  url: string
): WriterBiographyLegacyCorrection {
  return {
    countryId,
    writerId,
    text,
    evidence: [{ provider, url, checkedAt }],
  };
}

/**
 * Narrow corrections for article-catalog records whose previous `bio` was a
 * service message, not authored biographical prose. Evidence is internal QA
 * metadata only: it does not promote the legacy text to reviewed/verified and
 * is deliberately not exposed as a public badge.
 */
export const writerBiographyLegacyCorrections = [
  correction(
    "australia",
    "gregory_david_roberts",
    "Грегори Дэвид Робертс — писатель, композитор и художник. Его наиболее известный роман — «Шантарам».",
    "Hachette UK",
    "https://www.hachette.co.uk/contributor/gregory-david-roberts/"
  ),
  correction(
    "australia",
    "terry_hayes",
    "Терри Хейс — писатель, сценарист и продюсер. Он написал шпионский роман «Я — Пилигрим».",
    "Simon & Schuster",
    "https://www.simonandschuster.com/authors/Terry-Hayes/15705144"
  ),
  correction(
    "cyprus",
    "alex_michaelides",
    "Алекс Михаэлидес — писатель и сценарист. Его дебютный роман — психологический триллер «Безмолвный пациент».",
    "Library of Congress",
    "https://www.loc.gov/events/2021-national-book-festival/authors/item/n2018066440/alex-michaelides/"
  ),
  correction(
    "dominican_republic",
    "junot_diaz",
    "Джуно Диас — американский писатель доминиканского происхождения. Роман «Краткая фантастическая жизнь Оскара Вао» принёс ему Пулитцеровскую премию за художественную книгу.",
    "The Pulitzer Prizes",
    "https://www.pulitzer.org/winners/junot-diaz"
  ),
  correction(
    "england",
    "rafael_sabatini",
    "Рафаэль Сабатини — писатель итальянского происхождения, создававший историко-приключенческую прозу на английском языке. К его романам относятся «Одиссея капитана Блада» и «Морской ястреб».",
    "Rafael Sabatini Society",
    "https://www.rafaelsabatini.com/rsbio.html"
  ),
  correction(
    "england",
    "celia_rees",
    "Селия Рис — британская писательница, автор книг для подростков. Среди её исторических романов — «Пираты».",
    "Celia Rees",
    "https://www.celiarees.com/about"
  ),
  correction(
    "england",
    "ronald_delderfield",
    "Рональд Делдерфилд — английский писатель и драматург. Он написал роман «Приключения Бена Ганна», продолжающий историю персонажа «Острова сокровищ».",
    "Penguin Books",
    "https://www.penguin.co.uk/authors/311033/rf-delderfield"
  ),
  correction(
    "england",
    "ian_mcewan",
    "Иэн Макьюэн — британский писатель и сценарист. Один из его наиболее известных романов — «Искупление».",
    "Ian McEwan",
    "https://www.ianmcewan.com/books/atonement.html"
  ),
  correction(
    "england",
    "hilary_mantel",
    "Хилари Мантел — британская писательница и литературный критик. Её исторический роман «Волчий зал» удостоен Букеровской премии.",
    "The Booker Prizes",
    "https://thebookerprizes.com/the-booker-library/authors/hilary-mantel"
  ),
  correction(
    "england",
    "joanne_harris",
    "Джоанн Харрис — британская писательница, работающая в разных жанрах. Она написала роман «Пять четвертинок апельсина».",
    "Joanne Harris",
    "https://www.joanne-harris.co.uk/about/"
  ),
  correction(
    "england",
    "anthony_burgess",
    "Энтони Бёрджесс — английский писатель и композитор. Его самый известный роман — антиутопия «Заводной апельсин».",
    "International Anthony Burgess Foundation",
    "https://www.anthonyburgess.org/about-anthony-burgess/"
  ),
  correction(
    "england",
    "paula_hawkins",
    "Пола Хокинс — британская писательница, автор психологических триллеров. Широкую известность ей принёс роман «Девушка в поезде».",
    "Bloomsbury",
    "https://www.bloomsbury.com/uk/author/paula-hawkins/"
  ),
  correction(
    "england",
    "john_marrs",
    "Джон Маррс — британский писатель, автор психологических триллеров и научно-фантастической прозы. Он написал роман «Пассажиры».",
    "John Marrs",
    "https://www.johnmarrsauthor.com/about"
  ),
  correction(
    "england",
    "stuart_turton",
    "Стюарт Тёртон — британский писатель и журналист. Среди его романов — «Семь смертей Эвелины Хардкасл» и «Дьявол и тёмная вода».",
    "Stuart Turton",
    "https://www.stuturton.com/about"
  ),
  correction(
    "england",
    "diane_setterfield",
    "Диана Сеттерфилд — британская писательница. Её дебютный роман «Тринадцатая сказка» обращается к традиции готической прозы.",
    "Diane Setterfield",
    "https://www.dianesetterfield.com/bio/"
  ),
  correction(
    "england",
    "liz_jensen",
    "Лиз Дженсен — британская писательница и автор сценариев. Она написала роман «Девятая жизнь Луи Дракса».",
    "Liz Jensen",
    "https://www.lizjensen.com/test/about-liz/"
  ),
  correction(
    "england",
    "agatha_christie",
    "Агата Кристи — английская писательница и драматург, прославившаяся детективной прозой. К её романам относится «И никого не стало».",
    "Agatha Christie Limited",
    "https://www.agathachristie.com/about-christie"
  ),
  correction(
    "england",
    "lee_child",
    "Ли Чайлд — британский писатель, автор серии романов о Джеке Ричере. «Этаж смерти» стал первой книгой этого цикла.",
    "Macmillan",
    "https://us.macmillan.com/author/leechild"
  ),
  correction(
    "england",
    "frederick_forsyth",
    "Фредерик Форсайт — британский писатель и журналист, известный политическими триллерами. Его дебютный роман — «День Шакала».",
    "Frederick Forsyth",
    "https://www.freddieforsyth.com/"
  ),
  correction(
    "england",
    "john_fowles",
    "Джон Фаулз — английский писатель. Международное признание ему принёс первый опубликованный роман «Коллекционер».",
    "Penguin Books",
    "https://www.penguin.co.uk/books/355032/the-collector-by-john-fowles/9780099470472"
  ),
  correction(
    "england",
    "alex_garland",
    "Алекс Гарленд — британский писатель, сценарист и режиссёр. Его дебютный роман — «Пляж».",
    "Penguin Random House",
    "https://www.penguinrandomhouse.com/authors/227370/alex-garland/"
  ),
  correction(
    "england",
    "john_le_carre",
    "Джон ле Карре — литературный псевдоним британского писателя Дэвида Корнуэлла, автора шпионских романов. Среди его книг — «Маленькая барабанщица».",
    "John le Carré",
    "https://johnlecarre.com/biography/"
  ),
  correction(
    "france",
    "franck_thilliez",
    "Франк Тилье — французский писатель, автор детективов и триллеров. Он написал роман «Головокружение».",
    "Bibliothèque nationale de France",
    "https://www.bnf.fr/fr/mediatheque/franck-thilliez"
  ),
  correction(
    "italy",
    "emilio_salgari",
    "Эмилио Сальгари — итальянский писатель, автор приключенческой прозы. К его книгам относится роман «Чёрный корсар».",
    "Treccani",
    "https://www.treccani.it/enciclopedia/emilio-salgari/"
  ),
  correction(
    "russia",
    "robert_shtilmark",
    "Роберт Александрович Штильмарк — советский писатель и журналист. Он написал историко-приключенческий роман «Наследник из Калькутты».",
    "Национальная электронная библиотека",
    "https://rusneb.ru/catalog/000199_000009_003329369/"
  ),
  correction(
    "russia",
    "sergey_lukyanenko",
    "Сергей Лукьяненко — российский писатель-фантаст. Роман «Лабиринт отражений» положил начало одноимённой трилогии о виртуальной реальности.",
    "Сергей Лукьяненко",
    "https://lukianenko.ru/biography/"
  ),
  correction(
    "sweden",
    "stieg_larsson",
    "Стиг Ларссон — шведский писатель и журналист. Он создал трилогию «Миллениум», открывающуюся романом «Девушка с татуировкой дракона».",
    "Norstedts Agency",
    "https://www.norstedtsagency.se/authors/stieg-larsson/"
  ),
  correction(
    "sweden",
    "lars_kepler",
    "Ларс Кеплер — общий псевдоним шведских писателей Александры Коэльо Андориль и Александра Андориля. Их первый совместный роман — «Гипнотизёр».",
    "Lars Kepler",
    "https://larskepler.com/about/"
  ),
  correction(
    "usa",
    "tim_powers",
    "Тим Пауэрс — американский писатель, работающий в жанрах фантастики и фэнтези. Он написал роман «На странных волнах».",
    "Penguin Random House",
    "https://www.penguinrandomhouse.com/authors/24419/tim-powers/"
  ),
  correction(
    "usa",
    "howard_pyle",
    "Говард Пайл — американский художник, иллюстратор и писатель. В «Книге пиратов» собраны его рассказы и иллюстрации о морских разбойниках.",
    "Delaware Art Museum",
    "https://emuseum.delart.org/people/75/howard-pyle"
  ),
  correction(
    "usa",
    "donna_tartt",
    "Донна Тартт — американская писательница. Её роман «Щегол» удостоен Пулитцеровской премии за художественную книгу.",
    "The Pulitzer Prizes",
    "https://www.pulitzer.org/winners/donna-tartt"
  ),
  correction(
    "usa",
    "george_saunders",
    "Джордж Сондерс — американский писатель и эссеист. Его первый роман «Линкольн в бардо» получил Букеровскую премию.",
    "The Booker Prizes",
    "https://thebookerprizes.com/the-booker-library/books/lincoln-in-the-bardo"
  ),
  correction(
    "usa",
    "min_jin_lee",
    "Мин Джин Ли — американская писательница корейского происхождения. Она написала семейную сагу «Патинко», изданную по-русски как «Дорога в тысячу ли».",
    "Min Jin Lee",
    "https://www.minjinlee.com/about"
  ),
  correction(
    "usa",
    "dan_brown",
    "Дэн Браун — американский писатель, автор интеллектуальных триллеров. Международную известность ему принёс роман «Код да Винчи».",
    "Dan Brown",
    "https://danbrown.com/about/"
  ),
  correction(
    "usa",
    "andy_weir",
    "Энди Вейр — американский писатель-фантаст. Его дебютный роман «Марсианин» сначала публиковался по частям в интернете.",
    "Andy Weir",
    "https://andyweirauthor.com/"
  ),
  correction(
    "usa",
    "suzanne_collins",
    "Сьюзен Коллинз — американская писательница и сценарист. Она создала цикл антиутопических романов «Голодные игры».",
    "Scholastic",
    "https://www.scholastic.com/teachers/teaching-tools/articles/authors/suzanne-collins.html"
  ),
  correction(
    "usa",
    "gillian_flynn",
    "Гиллиан Флинн — американская писательница и сценарист. Она написала психологический триллер «Исчезнувшая».",
    "Penguin Random House",
    "https://www.penguinrandomhouse.com/authors/2191849/gillian-flynn/"
  ),
  correction(
    "usa",
    "dennis_lehane",
    "Деннис Лихэйн — американский писатель и сценарист, автор криминальной прозы. Среди его романов — «Остров проклятых».",
    "Dennis Lehane",
    "https://dennislehane.com/about-dennis/"
  ),
  correction(
    "usa",
    "thomas_harris",
    "Томас Харрис — американский писатель, автор триллеров. Его роман «Молчание ягнят» продолжает цикл о Ганнибале Лектере.",
    "Simon & Schuster",
    "https://www.simonandschuster.com/authors/thomas-harris/1451219"
  ),
  correction(
    "usa",
    "patricia_highsmith",
    "Патриция Хайсмит — американская писательница, известная психологической криминальной прозой. Она создала персонажа Тома Рипли в романе «Талантливый мистер Рипли».",
    "Penguin Random House",
    "https://www.penguinrandomhouse.com/authors/12941/patricia-highsmith/"
  ),
  correction(
    "usa",
    "blaine_harden",
    "Блейн Харден — американский журналист и автор документальных книг. Он написал книгу «Побег из лагеря 14» о северокорейском перебежчике Син Дон Хёке.",
    "Pan Macmillan",
    "https://www.panmacmillan.com/authors/blaine-harden/escape-from-camp-14/9780330519540"
  ),
  correction(
    "usa",
    "ransom_riggs",
    "Рэнсом Риггз — американский писатель и режиссёр. Он создал цикл, начавшийся романом «Дом странных детей мисс Перегрин».",
    "Ransom Riggs",
    "https://www.ransomriggs.com/about"
  ),
  correction(
    "usa",
    "blake_crouch",
    "Блейк Крауч — американский писатель и сценарист. Он написал научно-фантастический триллер «Тёмная материя».",
    "Blake Crouch",
    "https://blakecrouch.com/blake/"
  ),
  correction(
    "usa",
    "ernest_cline",
    "Эрнест Клайн — американский писатель и сценарист. Его дебютный роман — «Первому игроку приготовиться».",
    "Penguin Random House",
    "https://www.penguinrandomhouse.com/authors/130867/ernest-cline/"
  ),
  correction(
    "usa",
    "james_rollins",
    "Джеймс Роллинс — литературный псевдоним американского писателя Джеймса Чайковски, автора приключенческих триллеров. Среди его книг — роман «Царство костей».",
    "James Rollins",
    "https://jamesrollins.com/bio/"
  ),
  correction(
    "usa",
    "n_k_jemisin",
    "Нора Кейт Джемисин — американская писательница-фантаст. Роман «Пятое время года» открывает её трилогию «Расколотая Земля».",
    "N. K. Jemisin",
    "https://nkjemisin.com/writing/the-fifth-season/"
  ),
  correction(
    "usa",
    "robert_ludlum",
    "Роберт Ладлэм — американский писатель, автор шпионских триллеров. Роман «Идентификация Борна» положил начало циклу о Джейсоне Борне.",
    "Macmillan",
    "https://us.macmillan.com/author/robertludlum/"
  ),
  correction(
    "usa",
    "dan_simmons",
    "Дэн Симмонс — американский писатель, работающий в жанрах фантастики, фэнтези и хоррора. Он написал исторический роман «Террор».",
    "Hachette Book Group",
    "https://www.hachettebookgroup.com/contributor/dan-simmons/?lens=hachette-books"
  ),
  correction(
    "usa",
    "daniel_keyes",
    "Дэниел Киз — американский писатель. Он написал документальный роман «Множественные умы Билли Миллигана», известный в русском переводе как «Таинственная история Билли Миллигана».",
    "Daniel Keyes",
    "https://www.danielkeyesauthor.com/dksbio.html"
  ),
  correction(
    "usa",
    "mark_danielewski",
    "Марк Данилевский — американский писатель, экспериментирующий с композицией и оформлением текста. Его дебютный роман — «Дом листьев».",
    "Mark Z. Danielewski",
    "https://www.markzdanielewski.com/about"
  ),
  correction(
    "usa",
    "douglas_preston_lincoln_child",
    "Дуглас Престон и Линкольн Чайлд — американские писатели и многолетние соавторы. Их первый совместный роман — «Реликт».",
    "Preston & Child",
    "https://www.prestonchild.com/"
  ),
  correction(
    "usa",
    "dean_koontz",
    "Дин Кунц — американский писатель, автор триллеров, фантастики и хоррора. Среди его романов — «Ложная память».",
    "Dean Koontz",
    "https://www.deankoontz.com/about/about-dean/"
  ),
  correction(
    "usa",
    "michael_connelly",
    "Майкл Коннелли — американский писатель и журналист, автор криминальных романов. «Пятый свидетель» входит в цикл об адвокате Микки Холлере.",
    "Michael Connelly",
    "https://www.michaelconnelly.com/writing/thefifthwitness/"
  ),
  correction(
    "usa",
    "john_irving",
    "Джон Ирвинг — американский писатель и сценарист. Он написал роман «Правила виноделов».",
    "John Irving",
    "https://john-irving.com/the-cider-house-rules/"
  ),
  correction(
    "usa",
    "tom_clancy",
    "Том Клэнси — американский писатель, известный военно-политическими триллерами. Его дебютный роман — «Охота за „Красным Октябрём“».",
    "Tom Clancy",
    "https://tomclancy.com/"
  ),
] as const satisfies readonly WriterBiographyLegacyCorrection[];

export type WriterIdentityCorrection = {
  countryId: string;
  writerId: string;
  replacement: Partial<WriterProfile> & { id: string; bio: string };
  evidence: WriterBiographyLegacyEvidence[];
  note: string;
};

/** Two records had a real writer behind them but inherited an unrelated id
 * and false fields. They are repaired rather than quarantined because the
 * identity and dates are supported by national-library/university records. */
export const writerIdentityCorrections = [
  {
    countryId: "chile",
    writerId: "carmen_martin_gaite_chile_relation",
    replacement: {
      id: "marta_brunet",
      name: "Марта Брунет",
      fullName: "Marta Brunet",
      years: "1897–1967",
      birthDate: "1897-08-09",
      deathDate: "1967-10-27",
      birthPlace: "Чильян, Чили",
      deathPlace: "Монтевидео, Уругвай",
      bio: "Марта Брунет — чилийская писательница, создавшая в прозе выразительный мир юга Чили и его сельских сообществ. Её первый роман «Montaña adentro» вышел в 1923 году; позднее она также служила культурным представителем Чили за рубежом.",
      works: ["Montaña adentro"],
      genres: ["проза"],
    },
    evidence: [
      {
        provider: "Memoria Chilena — Biblioteca Nacional de Chile",
        url: "https://www.memoriachilena.gob.cl/602/w3-article-3600.html",
        checkedAt,
      },
      {
        provider: "Universidad de Chile",
        url: "https://portaluchile.uchile.cl/extension-y-cultura/vicerrectoria-de-extension-y-comunicaciones/martabrunet/biografia",
        checkedAt,
      },
    ],
    note: "Corrects an unrelated id, misspelled name, birth date, death place, unsupported roles and unverified work titles.",
  },
  {
    countryId: "japan",
    writerId: "yasunari_kawabata_additional",
    replacement: {
      id: "kataoka_teppei",
      name: "Катаока Тэппэй",
      fullName: "Kataoka Teppei",
      years: "1894–1944",
      birthDate: "1894-02-02",
      deathDate: "1944-12-25",
      birthPlace: "префектура Окаяма, Япония",
      deathPlace: "",
      bio: "Катаока Тэппэй — японский писатель, один из участников круга журнала «Бунгэй дзидай» и движения синканкаку-ха. Позднее он обращался к пролетарской, а затем к массовой литературе.",
      works: [],
      genres: ["проза"],
    },
    evidence: [
      {
        provider: "Shinjuku City Library",
        url: "https://www.library.shinjuku.tokyo.jp/database/jinbutuyukari/020/post97.html",
        checkedAt,
      },
      {
        provider: "Aozora Bunko",
        url: "https://www.aozora.gr.jp/index_pages/person491.html",
        checkedAt,
      },
    ],
    note: "Corrects a Kawabata-derived id, false given name, false death year and placeholder work; NDL has a conflicting 1893 authority header, so the two concordant biographical sources are recorded.",
  },
] as const satisfies readonly WriterIdentityCorrection[];

export type WriterPublicProfileFactCorrection = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: WriterBiographyLegacyEvidence[];
  note: string;
};

/**
 * Writer-profile facts corrected after the immutable book source is captured.
 * This lets the public writer card stop showing a proven false attribution
 * without silently changing the 9,712-card editorial book queue.
 */
export const writerPublicProfileFactCorrections = [
  {
    countryId: "england",
    writerId: "hilary_mantel",
    patch: {
      years: "1952–2022",
      birthDate: "1952-07-06",
      deathDate: "2022-09-22",
    },
    evidence: [
      {
        provider: "The Booker Prizes",
        url: "https://thebookerprizes.com/the-booker-library/authors/hilary-mantel",
        checkedAt,
      },
      {
        provider: "Macmillan",
        url: "https://us.macmillan.com/author/hilarymantel/",
        checkedAt,
      },
    ],
    note: "Adds the source-confirmed life dates to the public profile after the immutable book source is captured.",
  },
  {
    countryId: "england",
    writerId: "ian_mcewan",
    patch: {
      years: "1948–",
      birthDate: "1948-06-21",
    },
    evidence: [
      {
        provider: "The Booker Prizes",
        url: "https://thebookerprizes.com/the-booker-library/authors/ian-mcewan",
        checkedAt,
      },
      {
        provider: "Ian McEwan",
        url: "https://www.ianmcewan.com/books/amsterdam.html",
        checkedAt,
      },
    ],
    note: "Adds the source-confirmed birth date to the public profile without changing the separate book-review source.",
  },
  {
    countryId: "england",
    writerId: "joanne_harris",
    patch: {
      years: "1964–",
      birthDate: "1964",
    },
    evidence: [
      {
        provider: "Joanne Harris",
        url: "https://www.joanne-harris.co.uk/about/",
        checkedAt,
      },
      {
        provider: "Hachette UK",
        url: "https://www.hachette.co.uk/contributor/joanne-harris/",
        checkedAt,
      },
    ],
    note: "Publishes only the source-supported birth year; no exact month or day is invented.",
  },
  {
    countryId: "england",
    writerId: "john_le_carre",
    patch: {
      fullName: "David John Moore Cornwell",
      years: "1931–2020",
      birthDate: "1931-10-19",
      deathDate: "2020-12-12",
    },
    evidence: [
      {
        provider: "John le Carré",
        url: "https://johnlecarre.com/biography/",
        checkedAt,
      },
      {
        provider: "Bodleian Libraries, University of Oxford",
        url: "https://archives.bodleian.ox.ac.uk/repositories/2/resources/14397",
        checkedAt,
      },
    ],
    note: "Adds the documented legal name and life dates to the public profile after the immutable book source is captured.",
  },
  {
    countryId: "england",
    writerId: "oliver_goldsmith",
    patch: {
      years: "1728/1730–1774",
      birthDate: "",
    },
    evidence: [
      {
        provider: "Большая российская энциклопедия",
        url: "https://old.bigenc.ru/literature/text/2366524",
        checkedAt,
      },
      {
        provider: "National Portrait Gallery, London",
        url: "https://www.npg.org.uk/collections/search/personExtended/mp01810/oliver-goldsmith?tab=biography",
        checkedAt,
      },
    ],
    note: "Withholds the disputed exact birth date: the Russian encyclopedia gives 10 November 1730, while the National Portrait Gallery uses 1728.",
  },
  {
    countryId: "ecuador",
    writerId: "lupe_rumazo",
    patch: {
      fullName: "Lupe Rumazo",
      years: "1933–",
      birthDate: "1933-10-14",
      deathDate: "",
      deathPlace: "",
      works: ["Carta larga sin final", "Peste blanca, peste negra"],
    },
    evidence: [
      {
        provider: "Academia Ecuatoriana de la Lengua",
        url: "https://www.academiaecuatorianadelalengua.org/sra-d-a-lupe-rumazo-de-alzamora/",
        checkedAt,
      },
      {
        provider: "Biblioteca y Archivo de la Casa de la Cultura Ecuatoriana",
        url: "https://biblioteca.casadelacultura.gob.ec/cgi-bin/koha/opac-authoritiesdetail.pl?authid=7275&marc=1",
        checkedAt,
      },
    ],
    note: "Replaces the false 1904–2004 life dates with the documented 1933 birth date, removes the unsupported death date and publishes two documented works only in the public writer profile.",
  },
  {
    countryId: "egypt",
    writerId: "hamdi_abu_golayyel",
    patch: {
      years: "",
      birthDate: "",
      deathDate: "2023",
      works: ["Thieves in Retirement", "A Dog with No Tail"],
    },
    evidence: [
      {
        provider: "The American University in Cairo Press",
        url: "https://aucpress.com/author/hamdi-abu-golayyel/",
        checkedAt,
      },
      {
        provider: "Words Without Borders",
        url: "https://wordswithoutborders.org/contributors/view/hamdi-abu-golayyel/",
        checkedAt,
      },
    ],
    note: "Adds the source-agreed 2023 death year, withholds the conflicting 1967/1968 birth year, and publishes documented works without changing the book-review queue.",
  },
  {
    countryId: "egypt",
    writerId: "ibrahim_aslan",
    patch: {
      years: "",
      birthDate: "",
      deathDate: "2012",
      works: ["Цапля", "Нильские воробьи"],
    },
    evidence: [
      {
        provider: "The American University in Cairo Press",
        url: "https://aucpress.com/author/ibrahim-aslan/",
        checkedAt,
      },
      {
        provider: "Banipal",
        url: "https://www.banipal.co.uk/book_reviews/22/zuzana-kratka-reviews-two-novels-by-ibrahim-aslan/",
        checkedAt,
      },
    ],
    note: "Keeps the source-agreed 2012 death year, withholds the conflicting 1935/1936/1937 birth year and publishes the two documented novels only in the public profile.",
  },
  {
    countryId: "england",
    writerId: "christopher_marlowe",
    patch: {
      birthDate: "1564",
    },
    evidence: [
      {
        provider: "Poetry Foundation",
        url: "https://www.poetryfoundation.org/poets/christopher-marlowe",
        checkedAt,
      },
      {
        provider: "Royal Shakespeare Company",
        url: "https://www.rsc.org.uk/edward-ii/about-the-play/who-was-christopher-marlowe",
        checkedAt,
      },
    ],
    note: "Reduces the baptism date 26 February 1564 to a birth year instead of presenting it as an established birthday.",
  },
  {
    countryId: "england",
    writerId: "frederick_forsyth",
    patch: {
      fullName: "Frederick Forsyth",
      years: "1938–2025",
      birthDate: "1938",
      deathDate: "2025",
    },
    evidence: [
      {
        provider: "National Portrait Gallery, London",
        url: "https://www.npg.org.uk/collections/search/person/mp05961/frederick-forsyth",
        checkedAt,
      },
      {
        provider: "Penguin Random House",
        url: "https://global.penguinrandomhouse.com/announcements/legendary-thriller-author-frederick-forsyth-passes-away-at-86/",
        checkedAt,
      },
    ],
    note: "Adds the source-confirmed year-level life dates to the public writer profile without modifying its book record.",
  },
  {
    countryId: "republic_of_congo",
    writerId: "sylvain_bemba",
    patch: {
      works: [
        "Le Soleil est parti à M’Pemba",
        "L’Homme qui tua le crocodile",
      ],
    },
    evidence: [
      {
        provider: "Bibliothèque nationale de France",
        url: "https://data.bnf.fr/11891126/sylvain_bemba/fr.pdf",
        checkedAt,
      },
      {
        provider: "OpenEdition Books — EuroPhilosophie Éditions",
        url: "https://books.openedition.org/europhilosophie/1892",
        checkedAt,
      },
    ],
    note: "Publishes the documented works under the corrected Republic of the Congo identity without adding them to the immutable book-review queue.",
  },
  {
    countryId: "denmark",
    writerId: "hans_christian_andersen",
    patch: {
      name: "Ханс Кристиан Андерсен",
    },
    evidence: [
      {
        provider: "Lex — National Encyclopedia of Denmark",
        url: "https://lex.dk/H.C._Andersen",
        checkedAt,
      },
      {
        provider: "Hans Christian Andersen Centre — University of Southern Denmark",
        url: "https://andersen.sdu.dk/liv/",
        checkedAt,
      },
    ],
    note: "Uses the established modern Russian rendering while leaving the internal book-review source unchanged.",
  },
  {
    countryId: "denmark",
    writerId: "jacob_paludan",
    patch: {
      works: ["Fugle omkring Fyret", "Markerne modnes", "Jørgen Stein"],
    },
    evidence: [
      {
        provider: "Lex — National Encyclopedia of Denmark",
        url: "https://lex.dk/Jacob_Paludan",
        checkedAt,
      },
      {
        provider: "Det Danske Akademi",
        url: "https://www.danskeakademi.dk/medlem/jacob-paludan/",
        checkedAt,
      },
    ],
    note: "Removes the false attribution Жюль Верн and publishes three documented novels without changing the separate book-review queue.",
  },
  {
    countryId: "denmark",
    writerId: "peter_hoeg",
    patch: {
      name: "Петер Хёг",
    },
    evidence: [
      {
        provider: "Gyldendal",
        url: "https://www.gyldendal.dk/forfattere/peter-hoeg-f24702",
        checkedAt,
      },
      {
        provider: "Lex — National Encyclopedia of Denmark",
        url: "https://lex.dk/Peter_H%C3%B8eg",
        checkedAt,
      },
    ],
    note: "Corrects the Russian given-name rendering only in the public writer profile.",
  },
  {
    countryId: "djibouti",
    writerId: "aden_robleh_awaleh",
    patch: {
      name: "Аден Робле Авале",
      years: "1941–2014",
      birthDate: "1941",
      deathDate: "2014-10-31",
      birthPlace: "Али-Сабих, Джибути",
      works: ["Djibouti, clef de la mer Rouge"],
      genres: ["публицистика"],
    },
    evidence: [
      {
        provider: "La Nation — République de Djibouti",
        url: "https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/",
        checkedAt,
      },
      {
        provider: "Bibliothèque nationale de France",
        url: "https://catalogue.bnf.fr/ark%3A/12148/cb34933567g",
        checkedAt,
      },
    ],
    note: "Corrects the documented birth year, birthplace, death date and principal work after the book source is captured.",
  },
  {
    countryId: "dominican_republic",
    writerId: "julia_alvarez",
    patch: {
      name: "Джулия Альварес",
      fullName: "Julia Alvarez",
    },
    evidence: [
      {
        provider: "Middlebury College",
        url: "https://www.middlebury.edu/stories/archive/2016/03/alvarez-and-danticat-celebrate-power-story",
        checkedAt,
      },
      {
        provider: "Penguin Random House",
        url: "https://www.penguinrandomhouse.com/authors/476/julia-alvarez/",
        checkedAt,
      },
    ],
    note: "Uses the established Russian name and records the full Latin name in the public writer profile.",
  },
  {
    countryId: "ecuador",
    writerId: "demetrio_aguilera_malta",
    patch: {
      name: "Деметрио Агилера Мальта",
      fullName: "Demetrio Aguilera Malta",
    },
    evidence: [
      {
        provider: "Academia Ecuatoriana de la Lengua",
        url: "https://www.academiaecuatorianadelalengua.org/wp-content/uploads/2024/02/boletin-la-alegria-de-la-palabra-06.pdf",
        checkedAt,
      },
      {
        provider: "Asociación de Funcionarios y Empleados del Servicio Exterior Ecuatoriano",
        url: "https://afese.com/img/revistas/revista55/aguileramalta.pdf",
        checkedAt,
      },
    ],
    note: "Corrects the surname rendering Aguilera without changing uncertain day-level birth metadata.",
  },
  {
    countryId: "ecuador",
    writerId: "ernesto_noboa_caamano",
    patch: {
      works: ["Romanza de las horas", "Emoción vesperal"],
    },
    evidence: [
      {
        provider: "Ministerio de Educación del Ecuador",
        url: "https://adistancia.educacion.gob.ec/wp-content/uploads/2023/11/Guia-de-Estudios-C12-Lengua-y-Literatura-3ro-BGU.pdf",
        checkedAt,
      },
      {
        provider: "Universidad Andina Simón Bolívar",
        url: "https://repositorio.uasb.edu.ec/items/5c7a91ef-af0a-4cb9-9873-5c0a2e5d1fc8",
        checkedAt,
      },
    ],
    note: "Replaces unsupported translated work labels with documented titles while preserving the immutable book-review source.",
  },
  {
    countryId: "ecuador",
    writerId: "juan_montalvo",
    patch: {
      works: [
        "Семь трактатов",
        "Катилинарии",
        "Главы, которые забыл Сервантес",
      ],
    },
    evidence: [
      {
        provider: "Biblioteca y Archivo de la Casa de la Cultura Ecuatoriana",
        url: "https://biblioteca.casadelacultura.gob.ec/cgi-bin/koha/opac-authoritiesdetail.pl?authid=5242",
        checkedAt,
      },
      {
        provider: "Ministerio de Educación del Ecuador",
        url: "https://educacion.gob.ec/wp-content/uploads/downloads/2017/07/Libro-Catedra-Montalvina.pdf",
        checkedAt,
      },
    ],
    note: "Removes the false title Космополитическая геометрия and publishes three documented works without modifying the book-review queue.",
  },
  {
    countryId: "democratic_republic_of_congo",
    writerId: "pie_tshibanda",
    patch: {
      works: ["Un fou noir au pays des Blancs"],
    },
    evidence: [
      {
        provider: "Takam Tikou — Bibliothèque nationale de France",
        url: "https://takamtikou.bnf.fr/sites/default/files/d6/Bibliographie_Afrique_novembre_2011.pdf",
        checkedAt,
      },
      {
        provider: "Université de Lorraine — Écritures",
        url: "https://ecritures.univ-lorraine.fr/sites/default/files/users/documents/livres/lmc_afr_04_bambara_entier.pdf",
        checkedAt,
      },
    ],
    note: "Replaces an unverified Russian work title with the documented original title while preserving the separate book-review queue.",
  },
  {
    countryId: "colombia",
    writerId: "hector_abad_faciolince",
    patch: {
      works: ["Angosta", "El olvido que seremos", "La oculta"],
    },
    evidence: [
      {
        provider: "Instituto Cervantes",
        url: "https://cultura.cervantes.es/casablanca/es/encuentro-con-h%C3%A9ctor-abad-faciolince/118710",
        checkedAt,
      },
      {
        provider: "Penguin Libros",
        url: "https://www.penguinlibros.com/es/literatura-contemporanea/256281-libro-la-oculta-9788466358453",
        checkedAt,
      },
    ],
    note: "Removes the false attribution of Gabriel García Márquez's posthumous novel En agosto nos vemos while preserving the separate book-review queue.",
  },
  {
    countryId: "fiji",
    writerId: "satendra_nandan",
    patch: {
      years: "",
      birthDate: "",
      works: ["Gandhianjali", "Life Journeys: Love & Grief"],
    },
    evidence: [
      {
        provider: "Australian National University",
        url: "https://www.anu.edu.au/events/works-that-shaped-the-world-gandhis-religion",
        checkedAt,
      },
      {
        provider: "University of Canberra",
        url: "https://www.canberra.edu.au/about-uc/learning-at-uc/uc-book/uc-book-of-the-year-room/panel",
        checkedAt,
      },
    ],
    note: "Publishes the two documented books but withholds an unsupported exact birth date and the mismatched Q7426104 identity mapping.",
  },
  {
    countryId: "fiji",
    writerId: "subramani",
    patch: {
      fullName: "Subramani",
      years: "",
      birthDate: "",
      works: ["The Fantasy Eaters", "Dauka Puran"],
      genres: ["рассказ", "роман"],
    },
    evidence: [
      {
        provider: "University of the South Pacific Research Repository",
        url: "https://repository.usp.ac.fj/id/eprint/13951/1/16-FijiHindiAheritagelanguage%20copy.pdf",
        checkedAt,
      },
      {
        provider: "University of Canterbury Library",
        url: "https://libcat.canterbury.ac.nz/Record/275593",
        checkedAt,
      },
      {
        provider: "Fiji National University",
        url: "https://www.fnu.ac.fj/blog/news/fnu-academic-prasad-pens-his-first-book/",
        checkedAt,
      },
    ],
    note: "Uses the institutionally documented mononym and works while withholding the unsupported Ramaswamy surname, exact birth date and Dina attribution.",
  },
  {
    countryId: "eritrea",
    writerId: "alemseged_tesfai",
    patch: {
      name: "Алемсегед Тесфай",
      years: "1944–",
      birthDate: "1944",
      works: ["The Other War", "An African People’s Quest for Freedom and Justice"],
    },
    evidence: [
      {
        provider: "Bloomsbury Publishing",
        url: "https://www.bloomsbury.com/us/author/alemseged-tesfai/",
        checkedAt,
      },
      {
        provider: "C. Hurst & Co. Publishers",
        url: "https://www.hurstpublishers.com/wp-content/uploads/2024/03/LBF24-Hurst-catalogue-lo-res-RGB.pdf",
        checkedAt,
      },
    ],
    note: "Corrects the unsupported 1942 birth year to 1944 and publishes the two documented works without changing the book-review source.",
  },
  {
    countryId: "estonia",
    writerId: "friedrich_robert_faehlmann",
    patch: {
      birthDate: "1798-12-31",
    },
    evidence: [
      {
        provider: "Estonian Writers’ Online Dictionary, University of Tartu",
        url: "https://ewod.ut.ee/f/faehlmann/",
        checkedAt,
      },
      {
        provider: "Estonian Literary Museum",
        url: "https://galerii.kirmus.ee/biblioserver/isik/index.php?id=407",
        checkedAt,
      },
    ],
    note: "Stores 31 December 1798 as the modern Gregorian ISO date; the sources also document 20 December Old Style.",
  },
  {
    countryId: "ethiopia",
    writerId: "bealu_girma",
    patch: {
      years: "1939–1984",
      birthDate: "1939",
    },
    evidence: [
      {
        provider: "Soho Press",
        url: "https://sohopress.com/authors/baalu-girma/",
        checkedAt,
      },
      {
        provider: "Hachette UK",
        url: "https://www.hachette.co.uk/contributor/baalu-girma/",
        checkedAt,
      },
    ],
    note: "Corrects the unsupported 1937 birth year to the 1939 year used by both checked publisher biographies.",
  },
  {
    countryId: "finland",
    writerId: "fredrika_bremer",
    patch: {
      fullName: "Fredrika Bremer",
      years: "1801–1865",
      birthDate: "1801-08-17",
      deathDate: "1865-12-31",
      works: ["Соседи", "Херта"],
      nationality: "шведка",
    },
    evidence: [
      {
        provider: "Nationalmuseum Sweden",
        url: "https://collection.nationalmuseum.se/sv/artists/artist/8980/",
        checkedAt,
      },
      {
        provider: "Svenskt kvinnobiografiskt lexikon, University of Gothenburg",
        url: "https://skbl.se/en/article/FredrikaBremer",
        checkedAt,
      },
    ],
    note: "Corrects the false Runeberg full name, life dates, nationality and work list while preserving Finland as her birthplace connection.",
  },
  {
    countryId: "france",
    writerId: "chretien_de_troyes",
    patch: {
      years: "вторая половина XII века",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
    },
    evidence: [
      {
        provider: "Bibliothèque nationale de France",
        url: "https://cdn.essentiels.bnf.fr/uploads/media/attachment/20220321123022000000_quetesarthuriennes.pdf",
        checkedAt,
      },
      {
        provider: "Yale University Press",
        url: "https://yalebooks.yale.edu/book/9780300133707/the-romances-of-chretien-de-troyes/",
        checkedAt,
      },
    ],
    note: "Replaces invented exact life years and places with the institutionally supported period, the second half of the twelfth century.",
  },
  {
    countryId: "france",
    writerId: "francois_rabelais",
    patch: {
      years: "1483/1494–1553",
      birthDate: "",
      birthPlace: "окрестности Шинона, Франция (предположительно)",
    },
    evidence: [
      {
        provider: "Musée Rabelais — Maison de la Devinière",
        url: "https://www.musee-rabelais.fr/le-musee/rabelais/sa-vie/",
        checkedAt,
      },
      {
        provider: "Bibliothèque nationale de France",
        url: "https://catalogue.bnf.fr/ark%3A/12148/cb11920939s",
        checkedAt,
      },
    ],
    note: "Displays the documented 1483/1494 birth-year uncertainty instead of presenting circa 1494 as the only chronology; the birthplace remains explicitly approximate.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrection[];

export type QuarantinedWriterIdentity = {
  countryId: string;
  writerId: string;
  reason:
    | "duplicate-or-wrong-id"
    | "cross-country-service-record"
    | "cross-country-identity-conflict"
    | "service-record"
    | "identity-not-established";
  note: string;
};

/**
 * Records are hidden from the public country arrays until an authoritative
 * identity/work match is recorded. This is safer than inventing prose around
 * a plausible-looking name. The list is intentionally reviewable and does not
 * delete the source-country data.
 */
export const quarantinedWriterIdentities = [
  ["eritrea", "hadish_haile", "identity-not-established", "No institutional authority record or attributable bibliography establishes the claimed Eritrean writer."],
  ["eritrea", "khaled_abdalla", "identity-not-established", "No institutional catalog establishes the claimed Eritrean literary identity; the name must not be conflated with unrelated people."],
  ["eritrea", "rebkah_haile", "identity-not-established", "No institutional authority match establishes this card; it must not be conflated with Ethiopian-American memoirist Rebecca G. Haile."],
  ["eswatini", "albert_ncube", "identity-not-established", "No institutional catalog establishes the claimed Eswatini writer and literary role."],
  ["eswatini", "gladys_lobola", "identity-not-established", "No institutional catalog establishes the claimed Eswatini author or bibliography."],
  ["eswatini", "sarah_mlotshwa", "identity-not-established", "No institutional catalog establishes the claimed Eswatini writer or the works and themes attributed to the card."],
  ["eswatini", "stanley_madwe", "identity-not-established", "No institutional catalog establishes the claimed Eswatini poet or literary role."],
  ["ethiopia", "hirut_kefele", "identity-not-established", "No institutional authority match establishes the claimed Ethiopian writer, year and literary role."],
  ["eritrea", "sebhat_gebregziabher", "cross-country-identity-conflict", "The card conflates Ethiopian writer Sibhat Gebre-Egziabher with Eritrean general and politician Sebhat Ephrem; its name, dates, country, language and work do not establish one literary identity."],
  ["democratic_republic_of_congo", "sylvain_bemba", "cross-country-identity-conflict", "Sylvain Bemba was born in Sibiti and belongs to the Republic of the Congo corpus; a corrected public card is published there."],
  ["democratic_republic_of_congo", "tshibumba_kanda_matulu", "service-record", "Tshibumba Kanda-Matulu is a documented visual artist; History of Zaire is a painting cycle, not a literary work, so the record is not published as a writer."],
  ["djibouti", "abdourahman_h_yama", "identity-not-established", "The key/fullName and displayed name conflict, and no institutional catalog establishes the claimed Djiboutian literary identity or bibliography."],
  ["comoros", "mahmoud_said_ahmed", "identity-not-established", "No institutional authority record or attributable bibliography establishes the claimed Comorian writer; the card must not be conflated with similarly named artists, historians or writers."],
  ["comoros", "said_ahmed_mohamed", "cross-country-identity-conflict", "The authority identity is the Tanzanian Swahili writer Said Ahmed Mohamed Khamis, now published under Tanzania with corrected dates and birthplace."],
  ["cape_verde", "virgilio_de_lemos", "cross-country-identity-conflict", "The record belongs to the Mozambican poet Virgilio de Lemos; a corrected Mozambique card is published instead."],
  ["central_african_republic", "benoit_ndemba", "identity-not-established", "No authoritative identity or bibliographic work match was established in the checked BnF and IdRef catalogs."],
  ["chad", "felix_tchikaya", "identity-not-established", "The card likely conflates a supposed Chadian author with the Congolese poet Tchicaya U Tam'si; no separate authority identity was established."],
  ["burundi", "jean_pierre_hatungimana", "identity-not-established", "No authoritative literary identity or bibliographic work match was established for this card; the unsupported 1963 birth year must not be published."],
  ["cameroon", "emmanuel_dongala", "cross-country-identity-conflict", "This is a duplicate of the Republic of the Congo writer Emmanuel Dongala and must not be published as a Cameroon record."],
  ["cameroon", "etienne_goyemide", "cross-country-identity-conflict", "This is a duplicate of the Central African Republic writer Etienne Goyemide and must not be published as a Cameroon record."],
  ["botswana", "moshe_motshegwa", "identity-not-established", "No authoritative literary identity or bibliographic work match was established for this card."],
  ["brunei", "awang_mohammad_yassin", "identity-not-established", "No authoritative literary identity or bibliographic work match was established for this card."],
  ["brunei", "masuri_masrun", "identity-not-established", "No authoritative Bruneian literary identity was established; the name must not be conflated with Singaporean poet Masuri S. N."],
  ["burundi", "christophe_nkezabahizi", "identity-not-established", "Authoritative sources identify a Burundian state-television cameraman, not the literary identity claimed by the card."],
  ["burundi", "gaetan_muschimyimana", "identity-not-established", "No authoritative literary identity or bibliographic work match was established for this card."],
  ["bahamas", "cyril_bray", "identity-not-established", "No authoritative catalog match establishes the claimed Bahamian literary identity; the record remains in the internal source archive only."],
  ["bahamas", "wallace_whitfield", "identity-not-established", "No authoritative catalog match establishes the claimed Bahamian literary identity; available results mix the name with other people."],
  ["andorra", "josep_fonbernat", "identity-not-established", "No authoritative source establishes the claimed contemporary Andorran author; the similarly named Josep Fontbernat i Verdaguer (1896–1977) is a different person."],
  ["antigua_and_barbuda", "alison_hughes", "cross-country-identity-conflict", "Institutional publisher biographies identify a Canadian children's writer from Edmonton, not the claimed Antiguan author and works."],
  ["argentina", "adolfo_perez_zelas", "duplicate-or-wrong-id", "The id does not identify the displayed Adolfo Bioy Casares duplicate."],
  ["argentina", "alfredo_bryce_echenique", "cross-country-service-record", "Peruvian writer duplicated in Argentina with an explicit non-inclusion note."],
  ["chile", "paul_auster_chile_connection", "service-record", "The id and displayed name disagree; the prose says the record is excluded."],
  ["uruguay", "maria_ester_vazquez", "cross-country-service-record", "Argentine writer duplicated in Uruguay with an explicit non-inclusion note."],
  ["mexico", "maria_fernanda_ampuero", "cross-country-service-record", "Ecuadorian writer duplicated in Mexico with an explicit non-inclusion note; the Ecuador card is retained."],
  ["peru", "karina_sainz_borgo_peru_relation", "cross-country-service-record", "Venezuelan writer stored as an explicit non-inclusion relation in Peru."],
  ["peru", "oscar_malpica", "identity-not-established", "No authoritative literary identity or work match is recorded."],
  ["uruguay", "juan_jose_moron", "identity-not-established", "No authoritative literary identity or work match is recorded."],
  ["uruguay", "maria_morena", "identity-not-established", "The id/name pair is inconsistent and no authoritative literary identity is recorded."],
  ["venezuela", "krishna_viveros", "identity-not-established", "The id/name pair is inconsistent and no authoritative literary identity is recorded."],
  ["lesotho", "leapo_motsapi", "identity-not-established", "The Russian and Latin names disagree; no authoritative identity is recorded."],
  ["macau", "lo_i_cheng", "identity-not-established", "No authoritative literary identity or work match is recorded."],
  ["micronesia", "peter_sigeo", "identity-not-established", "No authoritative literary identity or work match is recorded."],
  ["micronesia", "marcel_mares", "identity-not-established", "The Russian and Latin names disagree; no authoritative identity is recorded."],
  ["papua_new_guinea", "kati_thambe", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["papua_new_guinea", "raymond_gat", "identity-not-established", "The local authority mapping has no supporting life date or literary work in the card."],
  ["paraguay", "susana_galeano", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["paraguay", "maida_victoria_melgar", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["suriname", "clarrisa_lispenard", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["brunei", "ali_haji_ahmad", "identity-not-established", "No unambiguous Bruneian literary identity is recorded."],
  ["brunei", "haji_muhammad_jaafar", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["cambodia", "mae_khem", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["cambodia", "keo_na", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["cambodia", "kambo_vong", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["laos", "bountheng_thongsavanh", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["laos", "sotheara_soth", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["laos", "douangchandra_souphanouvong", "identity-not-established", "The Russian name conflicts with the Latin name/id and no authoritative literary identity is recorded."],
  ["timor_leste", "jorge_barretto_xavier", "identity-not-established", "No authoritative literary identity or named work is recorded."],
  ["vanuatu", "nicolas_tewes", "identity-not-established", "No authoritative literary identity or named work is recorded."],
].map(([countryId, writerId, reason, note]) => ({
  countryId,
  writerId,
  reason,
  note,
})) as QuarantinedWriterIdentity[];

const correctionsByKey = new Map(
  writerBiographyLegacyCorrections.map((item) => [
    `${item.countryId}:${item.writerId}`,
    item,
  ])
);
const quarantinedKeys = new Set(
  quarantinedWriterIdentities.map(
    (item) => `${item.countryId}:${item.writerId}`
  )
);
const identityCorrectionsByKey = new Map(
  writerIdentityCorrections.map((item) => [
    `${item.countryId}:${item.writerId}`,
    item,
  ])
);
const publicProfileFactCorrectionsByKey = new Map(
  writerPublicProfileFactCorrections.map((item) => [
    `${item.countryId}:${item.writerId}`,
    item,
  ])
);

export function mergeWriterBiographyLegacyCorrections(
  countries: Country[],
  options: { preserveQuarantined?: boolean } = {}
): Country[] {
  return countries.map((country) => ({
    ...country,
    writers: country.writers.flatMap((writer) => {
      const key = `${country.id}:${writer.id}`;
      if (!options.preserveQuarantined && quarantinedKeys.has(key)) return [];

      const identityItem = identityCorrectionsByKey.get(key);
      const identityResolvedWriter = identityItem
        ? { ...writer, ...identityItem.replacement }
        : writer;
      const profileItem = publicProfileFactCorrectionsByKey.get(key);
      const resolvedWriter = profileItem
        ? { ...identityResolvedWriter, ...profileItem.patch }
        : identityResolvedWriter;
      const item = correctionsByKey.get(key);
      return item ? [{ ...resolvedWriter, bio: item.text }] : [resolvedWriter];
    }),
  }));
}
