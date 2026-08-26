import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch37 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{
    provider: string;
    url: string;
    checkedAt: string;
  }>;
  note: string;
};

const checkedAt = "2026-08-12";

export const writerBiographyPublicProfileFactCorrectionsBatch37 = [
  {
    countryId: "latvia",
    writerId: "nora_ikstena",
    patch: {
      years: "1969-2026",
      deathDate: "2026-01-04",
    },
    evidence: [
      { provider: "Latvian Literature", url: "https://www.latvianliterature.lv/en/writers/nora-ikstena", checkedAt },
      { provider: "Latvian Public Media (LSM)", url: "https://eng.lsm.lv/article/culture/literature/04.01.2026-latvian-writer-nora-ikstena-dies-aged-56.a628484/", checkedAt },
    ],
    note: "Профиль устарел после смерти писательницы; годы жизни и дата смерти обновлены, общая биография заменена проверяемой литературной справкой.",
  },
  {
    countryId: "latvia",
    writerId: "rainis",
    patch: {
      birthPlace: "Таденава, Дунавская волость, Латвия",
      coordinates: undefined,
    },
    evidence: [
      { provider: "Национальная энциклопедия Латвии", url: "https://enciklopedija.lv/skirklis/55869-", checkedAt },
      { provider: "Literatūra - Институт литературы, фольклора и искусства Латвийского университета", url: "https://www.literatura.lv/personas/rainis", checkedAt },
    ],
    note: "Оценочная формула заменена конкретными ролями и произведениями. Профильное место рождения с опечаткой «Варкавa» исправлено на Таденаву; координаты прежнего места удалены.",
  },
  {
    countryId: "latvia",
    writerId: "rudolfs_blaumanis",
    patch: {
      birthPlace: "Эргльское поместье, Латвия",
    },
    evidence: [
      { provider: "Национальная энциклопедия Латвии", url: "https://enciklopedija.lv/skirklis/37544", checkedAt },
      { provider: "Культурный канон Латвии", url: "https://kulturaskanons.lv/en/archive/rudolfs-blaumanis/", checkedAt },
    ],
    note: "Исходная оценка заменена жанровой, языковой и тематической характеристикой; место рождения уточнено до Эргльского поместья.",
  },
  {
    countryId: "latvia",
    writerId: "zigmunds_skujins",
    patch: {
      years: "1926-2022",
      deathDate: "2022-03-29",
      birthPlace: "Ильгюциемс, Рига, Латвия",
      deathPlace: "Рига, Латвия",
      works: ["Нагота","Кровать с золотой ножкой","Домино телесного цвета"],
    },
    evidence: [
      { provider: "Latvian Literature", url: "https://www.latvianliterature.lv/en/writers/zigmunds-skuji", checkedAt },
      { provider: "Literatūra - Институт литературы, фольклора и искусства Латвийского университета", url: "https://www.literatura.lv/en/persons/zigmunds-skujins", checkedAt },
    ],
    note: "В профиле ошибочно стоял 2012 год смерти, а «Голова золота» не соответствовала названию романа «Gulta ar zelta kāju». Дата, места и произведения исправлены.",
  },
  {
    countryId: "lebanon",
    writerId: "antoine_douaihy",
    patch: {
      works: ["The Bearer of the Purple Rose","Drowning in Lake Morez"],
      genres: ["роман","поэзия"],
    },
    evidence: [
      { provider: "International Prize for Arabic Fiction", url: "https://archive.arabicfiction.org/en/antoine-douaihy", checkedAt },
      { provider: "ArabLit Quarterly", url: "https://arablit.org/2014/02/10/international-prize-for-arabic-fiction-shortlist-countdown-reading-the-bearer-of-the-purple-rose/", checkedAt },
    ],
    note: "Роль литературного критика не подтверждена выбранными источниками; она заменена документированными ролями поэта и антрополога. Служебное название произведения заменено двумя реальными романами.",
  },
  {
    countryId: "lebanon",
    writerId: "georges_schehade",
    patch: {
      works: ["Histoire de Vasco"],
      years: "",
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb11923933f", checkedAt },
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/georges-schehade/", checkedAt },
      { provider: "Encyclopædia Universalis", url: "https://www.universalis.fr/encyclopedie/georges-schehade/", checkedAt },
    ],
    note: "Профильное название «История Василия» неверно переводит «Histoire de Vasco». Год рождения существенно расходится в авторитетных источниках (1905, 1907 и 1910), поэтому годы жизни и точные даты удаляются до отдельной архивной проверки.",
  },
  {
    countryId: "lebanon",
    writerId: "hoda_barakat",
    patch: {
      birthPlace: "Бейрут, Ливан",
      works: ["Камень смеха","Пахарь вод","Ночная почта"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "International Prize for Arabic Fiction", url: "https://archive.arabicfiction.org/en/node/263", checkedAt },
      { provider: "The Booker Prizes", url: "https://thebookerprizes.com/the-booker-library/authors/hoda-barakat", checkedAt },
    ],
    note: "Профиль ошибочно указывал Бшарри, тогда как официальный профиль IPAF указывает Бейрут; координаты прежнего места удалены. Биография дополнена подтверждёнными книгами и темами.",
  },
  {
    countryId: "lebanon",
    writerId: "khalil_gibran",
    patch: {
      fullName: "Gibran Khalil Gibran",
      language: "арабский, английский",
    },
    evidence: [
      { provider: "Gibran National Committee", url: "https://www.gibrankhalilgibran.org/life-of-gibran-kahlil-gibran", checkedAt },
      { provider: "University of Michigan", url: "https://websites.umich.edu/~jrcole/gibran/chrono.htm", checkedAt },
    ],
    note: "Оценочная формула заменена языковой и библиографической справкой. Полная форма имени и второй язык творчества нормализованы; существующие даты, место рождения и книги подтверждены.",
  },
  {
    countryId: "lebanon",
    writerId: "mikhail_naimy",
    patch: {
      works: ["Книга Мирдада"],
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Mikhail Naimy - официальный семейный архив", url: "https://mikhailnaimy.com/pages/shakhroub-a-briefing", checkedAt },
      { provider: "American University of Beirut", url: "https://scholarworks.aub.edu.lb/bitstreams/b292746e-add0-4a20-afa3-8fcbc46266e0/download", checkedAt },
    ],
    note: "В источниках расходятся точные дни рождения и смерти, тогда как год и место рождения устойчивы. Профильные 22 ноября и 28 февраля удалены до календарно-архивной проверки; название книги уточнено.",
  },
  {
    countryId: "lesotho",
    writerId: "masechele_khaketla",
    patch: {
      name: "Нтселисенг «Масечеле» Хакетла",
      fullName: "Ntšeliseng Caroline “Masechele” Khaketla",
      birthPlace: "район Береа, Басутоленд (ныне Лесото)",
      works: ["Mosali eo u ’neileng eena","’Mantsopa","Sedibelo sa nkgono"],
    },
    evidence: [
      { provider: "Университет Форт-Хэр - институциональный репозиторий", url: "https://libdspace.ufh.ac.za/server/api/core/bitstreams/f81a9e6a-99c4-4e8e-b163-4bb97807fa9e/content", checkedAt },
      { provider: "Университет Фри-Стейт", url: "https://scholar.ufs.ac.za/items/ab9c451e-ec1c-4d0a-b5fc-c15b2f81598d", checkedAt },
      { provider: "WorldCat / Архив мировой литературы на плёнке Библиотеки Конгресса США", url: "https://search.worldcat.org/title/Mrs.-Ntseliseng-Masechele-Khaketla-of-Lesotho/oclc/36188445", checkedAt },
    ],
    note: "Исходное русское имя «Масило Мацела» не соответствует документированному Ntšeliseng Masechele. Точные день рождения и день смерти не добавляются: выбранные институциональные источники уверенно подтверждают годы и литературную идентичность, но не согласуют дни.",
  },
  {
    countryId: "lesotho",
    writerId: "thomas_mofolo",
    patch: {
      fullName: "Thomas Mokopu Mofolo",
      birthPlace: "Ходжане, Басутоленд (ныне Лесото)",
      deathPlace: "Теятеяненг, Басутоленд (ныне Лесото)",
      works: ["Moeti oa Bochabela","Pitseng","Chaka"],
    },
    evidence: [
      { provider: "ЮНЕСКО", url: "https://www.unesco.org/en/articles/morija-well-knowledge-preserving-heritage-through-community-stewardship", checkedAt },
      { provider: "Store norske leksikon", url: "https://snl.no/Thomas_Mofolo", checkedAt },
      { provider: "Смитсоновский институт", url: "https://www.si.edu/object/chaka-historical-romance%3Anmaahc_2019.106.1", checkedAt },
    ],
    note: "Исходное место рождения Кутинг неверно; профильные источники указывают Ходжане. Оценочная формула заменена именами и библиографией, подтверждёнными ЮНЕСКО и энциклопедией.",
  },
  {
    countryId: "liberia",
    writerId: "bai_t_moore",
    patch: {
      name: "Бай Тамиа Мур",
      fullName: "Bai Tamiah Moore",
      years: "1916/1920-1988",
      deathDate: "1988-01-10",
      birthPlace: "Диме, близ Монровии, Либерия",
      works: ["Murder in the Cassava Patch","Ebony Dust","The Money Doubler"],
      birthDate: "",
    },
    evidence: [
      { provider: "Библиотеки Индианского университета - Liberian Collections", url: "https://archives.iu.edu/catalog/VAC1412", checkedAt },
      { provider: "Liberian Studies Journal - репозиторий Индианского университета", url: "https://scholarworks.iu.edu/journals/index.php/lsj/article/download/4128/3755", checkedAt },
      { provider: "ЮНЕСКО - The African Book Industry", url: "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_2f37eda8-988b-4e2b-8ebf-1dae1af3eeda?_=394048eng.pdf", checkedAt },
    ],
    note: "Исходный 1916 год нельзя выдавать за точную установленную дату: архив хранителя личного фонда прямо фиксирует альтернативу 1916/октябрь 1920. Суперлатив заменён документированными жанрами и книгами.",
  },
  {
    countryId: "liberia",
    writerId: "wilton_sankawulo",
    patch: {
      name: "Уилтон Санкавуло",
      fullName: "Wilton Gbakolo Sengbe Sankawulo",
      birthDate: "1937-07-26",
      birthPlace: "Хаинди, округ Бонг, Либерия",
      deathPlace: "Монровия, Либерия",
      works: ["The Marriage of Wisdom and Other Tales","The Rain and the Night","Sundown at Dawn"],
    },
    evidence: [
      { provider: "International Writing Program, Университет Айовы", url: "https://iwp.uiowa.edu/writers/1967/wilton-sankawulo", checkedAt },
      { provider: "Исполнительный особняк Республики Либерия", url: "https://www.sirleaf.emansion.gov.lr/doc/2010_ANNUAL_MESSAGE_Final_as_completed_on_4_February_2010.pdf", checkedAt },
      { provider: "LiberiaInfo", url: "https://liberiainfo.dukaw.com/wilton-s-sankawulo/", checkedAt },
    ],
    note: "Текущая дата рождения 26 января ошибочна: документированный день - 26 июля. Общая жанровая справка дополнена проверяемыми книгами и государственным контекстом без смешения литературы и политической должности.",
  },
  {
    countryId: "libya",
    writerId: "ahmed_fagih",
    patch: {
      fullName: "Ahmed Ibrahim al-Fagih",
      years: "1942-2019",
      birthDate: "1942",
      deathDate: "2019-04-30",
      birthPlace: "Мизда, Ливия",
      deathPlace: "Каир, Египет",
      works: ["There Is No Water in the Sea","Gardens of the Night","Maps of the Soul"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "Университет Новой Англии", url: "https://www.une.edu/news/2009/libyan-writer-ahmed-ibrahim-fagih-discuss-his-work-une-feb-23rd", checkedAt },
      { provider: "ArabLit Quarterly", url: "https://arablit.org/2019/05/02/libyan-novelist-ahmed-fagih-76/", checkedAt },
      { provider: "Banipal - журнал современной арабской литературы", url: "https://www.banipal.co.uk/contributors/134/Ahmed%20Fagih/", checkedAt },
    ],
    note: "Исходные годы 1942-2021, обе полные даты и Мисрата ошибочны. Автор умер в 2019 году в Каире и родился в Мизде; точный день рождения сокращён до года, поскольку два сильных источника подтверждают лишь 1942 или декабрь 1942 года.",
  },
  {
    countryId: "libya",
    writerId: "ahmed_rafiq_al_mahdaoui",
    patch: {
      birthDate: "1898",
      deathDate: "1961-07-06",
      birthPlace: "Фассато, горы Нафуса, Ливия",
      deathPlace: "Афины, Греция",
      works: ["Dīwān Shāʿir al-Waṭan al-Kabīr"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "Министерство культуры и развития знаний Ливии", url: "https://www.culture.gov.ly/%D8%A3%D8%AD%D9%85%D8%AF-%D8%B1%D9%81%D9%8A%D9%82-%D8%A7%D9%84%D9%85%D9%87%D8%AF%D8%A7%D9%88%D9%8A/", checkedAt },
      { provider: "Даремский университет - электронные диссертации", url: "https://etheses.dur.ac.uk/8045/1/8045_5045.PDF", checkedAt },
      { provider: "IREMAM / OpenEdition Books", url: "https://books.openedition.org/iremam/5819", checkedAt },
    ],
    note: "Технические даты 1 января и место рождения Триполи неверны. Государственная биография позволяет установить день смерти, а год рождения безопаснее оставить без вымышленного дня.",
  },
  {
    countryId: "libya",
    writerId: "ali_mustafa_al_misrati",
    patch: {
      birthDate: "1926-08-18",
      deathDate: "2021-12-29",
      birthPlace: "Александрия, Египет",
      works: ["Mirsal","A Handful of Ashes","The General in Victoria Station"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "Ливийская академия арабского языка", url: "https://www.majma.ly/922-2/", checkedAt },
      { provider: "Biographical Encyclopedia of the Modern Middle East and North Africa", url: "https://www.encyclopedia.com/international/encyclopedias-almanacs-transcripts-and-maps/musrati-ali-mustafa-al-1926", checkedAt },
      { provider: "Afaq 2020 - исследовательский проект по истории Ливии", url: "https://www.afaq2020.com/single-post/%D8%B9%D9%84%D9%8A-%D9%85%D8%B5%D8%B7%D9%81%D9%89-%D8%A7%D9%84%D9%85%D8%B5%D8%B1%D8%A7%D8%AA%D9%8A-%D9%88%D8%AA%D8%A7%D8%B1%D9%8A%D8%AE-%D9%84%D9%8A%D8%A8%D9%8A%D8%A7-%D8%A7%D9%84%D8%AB%D9%82%D8%A7%D9%81%D9%8A", checkedAt },
    ],
    note: "Исходные даты 1 января и место рождения Мисрата были служебными подстановками. Дата рождения и Александрия документированы; жанровая заглушка заменена конкретными книгами.",
  },
  {
    countryId: "libya",
    writerId: "hassan_al_faqih_hassan",
    patch: {
      name: "Хасан аль-Факих Хасан",
      fullName: "Ḥasan al-Faqīh Ḥasan",
      years: "1783/1784-после 1835",
      birthPlace: "Триполи, Османская Триполитания (ныне Ливия)",
      works: ["Ливийские дневники"],
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Институт исследований современного Магриба / OpenEdition Books", url: "https://books.openedition.org/irmc/4388", checkedAt },
      { provider: "Университет Триполи", url: "https://uot.edu.ly/publication_item.php?pubid=9560", checkedAt },
      { provider: "Google Books - запись издания Университета аль-Фатих", url: "https://books.google.com/books/about/al_Yawm%C4%ABy%C4%81t_al_L%C4%ABb%C4%AByah.html?id=MDYR0QEACAAJ", checkedAt },
    ],
    note: "Исходная карточка 1901-1993 описывала несуществующую современную идентичность. Документированный автор дневников родился в конце XVIII века и был прежде всего купцом и хронистом; точный год смерти выбранные источники не устанавливают.",
  },
  {
    countryId: "libya",
    writerId: "ibrahim_al_koni",
    patch: {
      birthDate: "1948",
      works: ["Gold Dust","The Bleeding of the Stone","The Animist","Anubis"],
    },
    evidence: [
      { provider: "Издательство Американского университета в Каире", url: "https://aucpress.com/author/ibrahim-al-koni/", checkedAt },
      { provider: "Sheikh Zayed Book Award", url: "https://www.zayedaward.ae/DataFolder/Brochures/SZBA_Winners%20Booklet_En_2019_Final.pdf", checkedAt },
      { provider: "Banipal - журнал современной арабской литературы", url: "https://www.banipal.co.uk/contributors/issue_index.cfm", checkedAt },
    ],
    note: "Оценочные суперлативы заменены тематической и библиографической характеристикой. Точный день 2 августа не подтверждён двумя выбранными сильными источниками, поэтому дата сокращена до 1948 года.",
  },
  {
    countryId: "libya",
    writerId: "khalifa_al_tillisi",
    patch: {
      fullName: "Khalifa Muhammad al-Tillisi",
      birthDate: "1930",
      deathDate: "2010",
      works: ["Al-Shabbi wa-Jubran","Rihla ʿabr al-kalimat","Rafiq: Shaʿir al-Watan"],
    },
    evidence: [
      { provider: "Национальный совет Кувейта по культуре, искусству и литературе - Al Arabi", url: "https://alarabi.nccal.gov.kw/Home/Article/484", checkedAt },
      { provider: "Al Jazeera", url: "https://www.aljazeera.net/culture/2010/1/15/%D8%B1%D8%AD%D9%8A%D9%84-%D8%A7%D9%84%D9%85%D8%A4%D8%B1%D8%AE-%D8%A7%D9%84%D9%84%D9%8A%D8%A8%D9%8A-%D8%AE%D9%84%D9%8A%D9%81%D8%A9-%D8%A7%D9%84%D8%AA%D9%84%D9%8A%D8%B3%D9%8A", checkedAt },
      { provider: "Sheikh Zayed Book Award - исторический буклет", url: "https://www.zayedaward.ae/DataFolder/Brochures/SZBA_Winners%20Booklet_En_2019_Final.pdf", checkedAt },
    ],
    note: "Обе даты 1 января были техническими подстановками. Выбранные источники надёжно подтверждают годы, но не оба точных дня, поэтому профиль должен показывать только 1930-2010; общая заглушка произведений заменена документированными направлениями и книгами.",
  },
  {
    countryId: "libya",
    writerId: "sadeq_al_neihum",
    patch: {
      birthDate: "1937",
      deathDate: "1994-11-15",
      birthPlace: "Бенгази, Ливия",
      deathPlace: "Женева, Швейцария",
      works: ["Min Makka ila huna","al-Ramz fi al-Qur’an"],
    },
    evidence: [
      { provider: "Министерство культуры и развития знаний Ливии", url: "https://www.culture.gov.ly/cultural-memory/%D8%A7%D9%84%D8%B5%D8%A7%D8%AF%D9%82-%D8%A7%D9%84%D9%86%D9%8A%D9%87%D9%88%D9%85/", checkedAt },
      { provider: "SOAS University of London", url: "https://eprints.soas.ac.uk/23805/1/Olszok_4317.pdf", checkedAt },
      { provider: "Edinburgh University Press", url: "https://edinburghuniversitypress.com/book-the-libyan-novel.html", checkedAt },
    ],
    note: "Личность, годы жизни и дата смерти подтверждены. Точный день рождения 1937-12-15 в выбранных авторитетных источниках не установлен; исходное «Исследования арабской культуры» не является точным библиографическим названием.",
  },
  {
    countryId: "liechtenstein",
    writerId: "hansjorg_quaderer",
    patch: {
      name: "Хансйорг Квадерер",
      years: "1958-",
      birthDate: "1958",
      birthPlace: "Шан, Лихтенштейн",
    },
    evidence: [
      { provider: "Deutsche Digitale Bibliothek", url: "https://www.deutsche-digitale-bibliothek.de/person/gnd/119554305", checkedAt },
      { provider: "Правительство Лихтенштейна", url: "https://www.llv.li/serviceportal2/amtsstellen/stabstelle-regierungskanzlei/ii_3_gesellschaft_und_kultur_web.pdf", checkedAt },
      { provider: "Правительство Лихтенштейна - конкурс «Самые красивые книги»", url: "https://www.llv.li/de/medienmitteilungen/urkunden-fuer-schoenste-buecher-aus-liechtenstein-2021-uebergeben", checkedAt },
    ],
    note: "Исходное русское имя «Хансйорг Квенцель» не соответствует Hansjörg Quaderer, а год 1955 противоречит библиотечной authority-записи. Литературную роль следует показывать вместе с основной художественной и книжной практикой.",
  },
  {
    countryId: "liechtenstein",
    writerId: "ida_ospelt_amann",
    patch: {
      name: "Ида Оспельт-Аманн",
      years: "1899-1996",
      birthDate: "1899-02-15",
      deathDate: "1996-03-12",
      birthPlace: "Вадуц, Лихтенштейн",
      deathPlace: "Вадуц, Лихтенштейн",
      works: ["S Loob-Bett","S’ischt Suusersunntig","Di aalta Räder"],
      language: "вадуцский алеманнский диалект",
    },
    evidence: [
      { provider: "Исторический лексикон Княжества Лихтенштейн", url: "https://historisches-lexikon.li/Ospelt_%28-Amann%29%2C_Ida", checkedAt },
      { provider: "Муниципалитет Вадуца", url: "https://www.vaduz.li/application/files/1217/7493/5863/Nr._01_-_Fruehling_2026.pdf", checkedAt },
    ],
    note: "Исходные даты 1905-1986 ошибочны. Подтверждены имя при рождении Ida Amann, Вадуц как место рождения и смерти, диалектная поэзия и проза.",
  },
  {
    countryId: "liechtenstein",
    writerId: "jurg_hanselmann",
    patch: {
      name: "Юрг Ханзельман",
      birthDate: "1960-09-23",
      years: "1960-",
      category: "пианист и композитор",
      genres: ["классическая музыка","композиция"],
      birthPlace: "",
      language: "",
    },
    evidence: [
      { provider: "Musinfo - Swiss Music Edition", url: "https://musinfo.ch/en/personen/?abc=H&pers_id=1112", checkedAt },
      { provider: "Carus-Verlag", url: "https://www.carus-verlag.com/en/persons/juerg-hanselmann/", checkedAt },
      { provider: "Историческое общество Лихтенштейна", url: "https://www.historischerverein.li/veranstaltungen/veranstaltungen-1/2019/2019-14-juni-veranstaltung-zu-josef-gabriel-rheinberger", checkedAt },
    ],
    note: "Карточка смешивает музыкального деятеля с писателем и поэтом. Литературные жанры и немецкий язык как язык творчества не соответствуют профилю; запись следует перенести из каталога писателей в каталог деятелей культуры либо исключить из литературной выборки.",
  },
  {
    countryId: "lithuania",
    writerId: "antanas_baranauskas",
    patch: {
      birthPlace: "Аникщяй, Российская империя",
      deathPlace: "Сейны, Российская империя",
      works: ["Аникщяйский бор (Anykščių šilelis)"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/antanas-baranauskas/", checkedAt },
      { provider: "Мемориальный музей Антанаса Баранаускаса и Антанаса Венуолиса-Жукаускаса", url: "https://www.baranauskas.lt/en/", checkedAt },
    ],
    note: "Исходный текст в целом верен, но оценочная формула заменена проверяемыми сведениями. Историческое русское «Оникшты» нормализовано к современному названию Аникщяй.",
  },
  {
    countryId: "lithuania",
    writerId: "antanas_venclova",
    patch: {
      deathPlace: "Вильнюс, Литовская ССР",
      works: ["Draugystė","Gimimo diena"],
      genres: ["поэзия","проза","литературная критика","перевод"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/antanas-venclova/", checkedAt },
      { provider: "Союз писателей Литвы", url: "https://rasytojai.lt/rasytojai/venclova-antanas/", checkedAt },
      { provider: "Академия наук Литвы", url: "https://www.lma.lt/uploads/Biogramos/Venclova_A_red%20.pdf", checkedAt },
    ],
    note: "Даты и Тремпиняй подтверждены. «Рассвет над Нарочью» не найден в авторитетной библиографии этой записи и заменён подтверждёнными романами; политическая деятельность не должна исчезать из справки.",
  },
  {
    countryId: "lithuania",
    writerId: "balys_sruoga",
    patch: {
      name: "Балис Сруога",
      birthPlace: "Байбокай, Российская империя",
      deathPlace: "Вильнюс, Литовская ССР",
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/Straipsnis/balys-sruoga/", checkedAt },
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/balys-sruoga/", checkedAt },
      { provider: "Литовская интегральная музейная информационная система", url: "https://www.limis.lt/e-guide/museums/808294", checkedAt },
    ],
    note: "Исправлена опечатка: в русском имени стояла латинская c. Суперлатив заменён фактами; точное место рождения уточнено до деревни Байбокай.",
  },
  {
    countryId: "lithuania",
    writerId: "ieva_simonaityte",
    patch: {
      birthPlace: "Ванагай, Клайпедский край",
      deathPlace: "Вильнюс, Литовская ССР",
      works: ["Aukštujų Šimonių likimas"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/ieva-simonaityte/", checkedAt },
      { provider: "Библиотека имени Иевы Симонайтите", url: "https://www.ievasimonaityte.lt/apie-ieva-simonaityte/biografija/", checkedAt },
      { provider: "Литовский литературный музей Майрониса", url: "https://maironiomuziejus.lt/post-t-collections/ieva-simonaityte-1897-1978-2/", checkedAt },
    ],
    note: "Исходное «Аукштуолай» не является названием подтверждённого произведения и заменено романом Aukštujų Šimonių likimas. Место рождения нормализовано с ошибочного «Ванаджай» на Ванагай.",
  },
  {
    countryId: "lithuania",
    writerId: "jurga_ivanauskaite",
    patch: {
      deathPlace: "Вильнюс, Литва",
      works: ["Ragana ir lietus","Placebas","Miegančių drugelių tvirtovė"],
      awards: ["Национальная премия Литвы в области культуры и искусства, 2005"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/jurga-ivanauskaite/", checkedAt },
      { provider: "Союз писателей Литвы", url: "https://rasytojai.lt/rasytojai/ivanauskaite-jurga/", checkedAt },
      { provider: "Институт культуры Литвы", url: "https://english.lithuanianculture.lt/lithuanian-culture-guide/2018/05/23/jurga-ivanauskaite/", checkedAt },
    ],
    note: "Даты и Вильнюс подтверждены. «Райские ворота» принадлежит не Иванаускайте и отсутствует в её авторитетных библиографиях; запись заменена проверенными оригинальными названиями.",
  },
  {
    countryId: "lithuania",
    writerId: "jurgis_kuncinas",
    patch: {
      deathPlace: "Вильнюс, Литва",
      works: ["Tūla"],
      genres: ["роман","поэзия","эссе","перевод"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/jurgis-kuncinas/", checkedAt },
      { provider: "Союз писателей Литвы", url: "https://rasytojai.lt/rasytojai/kuncinas-jurgis/", checkedAt },
    ],
    note: "Исходные даты и Алитус подтверждены. Название романа нормализовано к оригинальному Tūla, чтобы его не смешивали с русским названием города Тула.",
  },
  {
    countryId: "lithuania",
    writerId: "kristijonas_donelaitis",
    patch: {
      birthPlace: "Лаздинеляй, Восточная Пруссия",
      deathPlace: "Тольминкемис, Восточная Пруссия",
      works: ["Времена года (Metai)"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/kristijonas-donelaitis/", checkedAt },
      { provider: "Институт литовской литературы и фольклора", url: "https://www.llti.lt/lt/kristijonas_donelaitis/", checkedAt },
    ],
    note: "Даты подтверждены. Место рождения в исходнике записано как Лаздинай, тогда как источники указывают Лаздинеляй; оценочный суперлатив заменён описанием проверенного произведения.",
  },
  {
    countryId: "lithuania",
    writerId: "kristina_sabaliauskaite",
    patch: {
      birthDate: "1974",
      works: ["Silva rerum","Petro imperatorė"],
    },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/kristina-sabaliauskaite/", checkedAt },
      { provider: "Институт культуры Литвы", url: "https://lithuanianculture.lt/lietuvos-kulturos-gidas/2021/01/06/kristina-sabaliauskaite/", checkedAt },
      { provider: "Вильнюсская академия художеств", url: "https://www.vda.lt/garbes-daktarai-profesoriai-ir-emeritai", checkedAt },
    ],
    note: "Авторитетные профили подтверждают только 1974 год, а не дату 1974-06-02. Библиографию следует расширить от одной части Silva rerum до полного цикла и Petro imperatorė.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrectionBatch37[];
