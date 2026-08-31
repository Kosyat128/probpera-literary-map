import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch57 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-30";

function sources(
  ...items: ReadonlyArray<readonly [provider: string, url: string]>
) {
  return items.map(([provider, url]) => ({ provider, url, checkedAt }));
}

function correction(
  countryId: string,
  writerId: string,
  patch: Partial<WriterProfile>,
  evidence: ReturnType<typeof sources>,
  note: string
): WriterPublicProfileFactCorrectionBatch57 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch57 = [
  correction(
    "vietnam",
    "bao_ninh",
    {
      "birthPlace": "провинция Нгеан, Вьетнам",
      "coordinates": undefined
    },
    sources(
      ["NXB Trẻ", "https://www.nxbtre.com.vn/en/authors/bao-ninh-4641.html"],
      ["VietnamPlus", "https://en.vietnamplus.vn/vietnamese-novel-about-war-wins-asia-literature-award-2018-post141895.vnp"],
    ),
    "Расплывчатая характеристика заменена установленными именем, биографическим опытом и произведением. Сведения Penguin Random House о рождении в Ханое расходятся с биографией вьетнамского издательства NXB Trẻ, которая указывает 18 октября 1952 года и провинцию Нгеан; для профильных данных выбран локальный издательский источник, а неподтверждённые координаты очищены."
  ),
  correction(
    "vietnam",
    "duong_thu_huong",
    {
      "birthDate": "1947",
      "awards": [
        "Всемирная премия Чино дель Дука 2023"
      ]
    },
    sources(
      ["PEN America", "https://pen.org/profile/duong-thu-huong/"],
      ["Institut de France", "https://www.institutdefrance.fr/actualites/le-prix-mondial-cino-del-duca-2023-remis-a-duong-thu-huong/"],
    ),
    "Общие темы заменены проверяемыми произведениями и премией; точность даты рождения снижена до подтверждённого года."
  ),
  correction(
    "vietnam",
    "nam_cao",
    {
      "years": "1917-1951",
      "birthDate": "1917-10-29",
      "works": [
        "Chí Phèo",
        "Lão Hạc",
        "Sống mòn"
      ]
    },
    sources(
      ["Vietnam Writers Association", "https://vanvn.vn/nha-van-nam-cao-1917-1951-tieu-su-van-hoc/"],
      ["Bibliothèque nationale de France", "https://data.bnf.fr/en/12057076/nam_cao/"],
    ),
    "Исправлен ошибочный 1915 год рождения, удалено оценочное ранжирование и добавлены настоящее имя и документированные произведения."
  ),
  correction(
    "vietnam",
    "nguyen_cong_hoan",
    {
      "birthPlace": "Суанкау, Хынгйен, Вьетнам",
      "coordinates": {
        "lat": 20.9551,
        "lng": 105.98384
      },
      "works": [
        "Kép Tư Bền",
        "Bước đường cùng"
      ]
    },
    sources(
      ["Провинция Хынгйен", "https://en.hungyen.gov.vn/nguyen-cong-hoan-1903-1977-c257.html"],
      ["Vietnam Writers Association", "https://vanvn.vn/phat-hien-che-phong-cua-vua-bao-dai-ban-khen-nha-van-nguyen-cong-hoan/"],
      ["OpenStreetMap", "https://www.openstreetmap.org/node/13347246643"],
    ),
    "Субъективное ранжирование заменено жанрами и названиями книг; место рождения исправлено с Ханоя на деревню Суанкау в провинции Хынгйен."
  ),
  correction(
    "vietnam",
    "nguyen_du",
    {
      "years": "1765/1766-1820",
      "birthDate": "",
      "birthPlace": "Тханглонг (ныне Ханой), Дайвьет",
      "coordinates": {
        "lat": 21.0285,
        "lng": 105.8542
      },
      "works": [
        "Truyện Kiều (Повесть о Киеу)"
      ]
    },
    sources(
      ["Library of Congress", "https://www.loc.gov/resource/gdcwdl.wdl_14287/?st=gallery"],
      ["Институт исследований Хан-Ном, Вьетнамская академия общественных наук", "https://hannom.vass.gov.vn/web/tchn/DATA1/0201v.htm"],
      ["Правительство Вьетнама", "https://baochinhphu.vn/nguyen-du-thi-hao-nhan-dao-chu-nghia-cua-nhan-loai-102153381.htm"],
    ),
    "Оценочные превосходные степени удалены, название исправлено и авторство сформулировано точно. Источники расходятся между традиционным 1765 годом и пересчётом предполагаемой лунной даты в 3 января 1766 года; исследование Института Хан-Ном считает позднюю приписку с точным днём недостаточно надёжной, поэтому точный год и день в профиле очищены. Место рождения приведено только к подтверждённому уровню Тханглонга, без неподтверждённой конкретизации квартала."
  ),
  correction(
    "yemen",
    "abdullah_al_baradouni",
    {
      "years": "ок. 1929/1930-1999",
      "birthDate": "",
      "birthPlace": "деревня Аль-Бардуна, район Аль-Хада, провинция Дамар, Йемен",
      "coordinates": undefined
    },
    sources(
      ["Sultan Bin Ali Al Owais Cultural Foundation", "https://www.alowais.com/wp-content/uploads/2020/05/%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D9%84%D9%87-%D8%A7%D9%84%D8%A8%D8%B1%D8%AF%D9%88%D9%86%D9%8A-%D8%A7%D9%84%D8%B4%D8%A7%D8%B9%D8%B1-%D8%A7%D9%84%D8%A8%D8%B5%D9%8A%D8%B1-21.pdf"],
      ["Al-Babtain Central Library for Arabic Poetry", "https://albabtainlibrary.org/wp-content/uploads/2020/10/Book-2.pdf"],
    ),
    "Субъективное ранжирование заменено занятиями и библиографическим фактом. Исследование фонда Аль-Овайса прямо указывает, что точный год рождения не установлен и оценивается как 1929 или 1930; искусственное 1 января и однозначный год очищены. Число сборников не фиксируется, поскольку справочные источники по-разному считают прижизненные и посмертные издания. Место рождения исправлено на деревню Аль-Бардуна, а прежние координаты Саны удалены как относящиеся к другому месту."
  ),
  correction(
    "yemen",
    "ali_ahmad_bakathir",
    {
      "works": [
        "Wa Islamah",
        "al-Tha'ir al-Ahmar (The Red Revolutionary)"
      ]
    },
    sources(
      ["Журнал Al Arabi", "https://alarabi.nccal.gov.kw/Home/Article/13881"],
      ["University of Edinburgh", "https://era.ed.ac.uk/server/api/core/bitstreams/c74f323f-a8f6-4dc0-b6dc-a3960c8d5685/content"],
    ),
    "Оценочная формула заменена проверяемыми происхождением, жанрами и произведениями; неподтверждённая «Трагедия Ухуда» удалена из профиля."
  ),
  correction(
    "yemen",
    "habib_abdulrab_sarori",
    {
      "works": [
        "Suslov's Daughter (Дочь Суслова)"
      ]
    },
    sources(
      ["Banipal", "https://www.banipal.co.uk/contributors/649/habib_abdulrab__sarori/"],
      ["International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/node/157"],
    ),
    "Неясная «научная проза» заменена документированной академической профессией; ошибочное название «Дочь Сусанны» исправлено. Точный день рождения, приведённый только на личном сайте автора, не подтверждён независимыми источниками и не добавляется в профиль."
  ),
  correction(
    "yemen",
    "mohammed_abdul_wali",
    {
      "years": "1939/1940-1973",
      "birthDate": "",
      "deathDate": "1973-04",
      "birthPlace": "Дэбрэ-Бырхан, Эфиопия",
      "coordinates": {
        "lat": 9.6795,
        "lng": 39.5326
      },
      "works": [
        "They Die Strangers",
        "Sana'a: An Open City"
      ]
    },
    sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12107281p"],
      ["University of Texas Press", "https://utpress.utexas.edu/9780292705081/they-die-strangers/"],
      ["University of California, Merced", "https://escholarship.org/content/qt3td73577/qt3td73577_noSplash_b59089ce14383b34f14bd53ab77a27a1.pdf"],
    ),
    "Общее утверждение заменено проверяемыми местом рождения, профессией и произведениями. BnF указывает 12 ноября 1939 года, тогда как независимые академические исследования Калифорнийского университета в Мерседе и другие работы приводят 1940 год; точная дата и однозначный год рождения поэтому очищены. Месяц смерти оставлен по каталогу BnF."
  ),
  correction(
    "yemen",
    "wajdi_al_ahdal",
    {
      "birthPlace": "Ходейда, Йемен",
      "coordinates": {
        "lat": 14.7979,
        "lng": 42.9545
      },
      "works": [
        "Mountain Boats",
        "A Land Without Jasmine",
        "A Land of Happy Conspiracies"
      ]
    },
    sources(
      ["International Prize for Arabic Fiction", "https://archive.arabicfiction.org/en/Wajdi-al-Ahdal-Nadwa2010"],
      ["Katara Prize for Arabic Novel", "https://kataranovels.com/novelist/%D9%88%D8%AC%D8%AF%D9%8A-%D8%A7%D9%84%D8%A3%D9%87%D8%AF%D9%84/"],
    ),
    "Оценочная характеристика удалена, место рождения конкретизировано, а ошибочное название «Счастливая земля» заменено документированными произведениями; конфликтующая точная дата не утверждается."
  ),
  correction(
    "zambia",
    "dominic_mulaisho",
    {
      "birthDate": "1933",
      "deathDate": "2013"
    },
    sources(
      ["University of Zambia", "https://dspace.unza.zm/bitstream/handle/123456789/7186/The%20Final%20Copy%20of%20the%20%20Dissertation-Trevor%20Mwansa.pdf"],
      ["Lusaka Times", "https://www.lusakatimes.com/2013/07/02/president-sata-mourns-dominic-mulaisho/"],
      ["National Assembly of Zambia", "https://www.parliament.gov.zm/node/677"],
    ),
    "Интерпретационные и оценочные фразы заменены проверяемыми занятиями, датами и произведениями. Точный день рождения 15 августа не подтверждён независимыми авторитетными источниками, поэтому профиль приведён к установленному 1933 году. Дата смерти в справочниках расходится между 30 июня и 1 июля 2013 года, а современное сообщение говорит о вечере воскресенья 30 июня; профиль безопасно снижен до года без ложного выбора дня."
  ),
  correction(
    "zambia",
    "ellen_banda_aaku",
    {
      "birthDate": "1965",
      "birthPlace": "Великобритания"
    },
    sources(
      ["Bloomsbury", "https://www.bloomsbury.com/UK/author/ellen-bandaaaku/"],
      ["University of Cape Town", "https://www.news.uct.ac.za/article/-2015-03-26-uct-great-minds-18-of-the-best-local-contemporary-writers"],
    ),
    "Интерпретация тем заменена проверяемыми биографическими данными, произведениями и премиями; точность даты рождения снижена до года. Уокинг как точное место рождения не подтверждён используемыми авторитетными источниками, поэтому в профиле оставлен установленный уровень страны."
  ),
  correction(
    "zimbabwe",
    "charles_mungoshi",
    {
      "works": [
        "Waiting for the Rain"
      ]
    },
    sources(
      ["Bloomsbury", "https://www.bloomsbury.com/UK/author/charles-mungoshi/"],
      ["Store norske leksikon", "https://snl.no/Charles_Mungoshi"],
    ),
    "Субъективное ранжирование заменено датами, языками, жанрами и произведением."
  ),
  correction(
    "zimbabwe",
    "chenjerai_hove",
    {
      "years": "1954/1956-2015",
      "birthDate": "",
      "birthPlace": "Мазвихва, Южная Родезия",
      "coordinates": undefined,
      "works": [
        "Bones (Кости)"
      ]
    },
    sources(
      ["Store norske leksikon", "https://snl.no/Chenjerai_Hove"],
      ["London School of Economics", "https://eprints.lse.ac.uk/75965/1/Africa%20at%20LSE%20%E2%80%93%20Renowned%20Zimbabwe%20Writer%20Chenjerai%20Hove%20Remembered.pdf"],
    ),
    "Исходное описание конкретизировано произведением; конфликт авторитетных источников о годе рождения зафиксирован без ложного выбора одной даты. Координаты очищены: источники подтверждают район Мазвихва, но не точку рождения, а исходная пара обозначала лишь приблизительную область."
  ),
  correction(
    "zimbabwe",
    "doris_lessing",
    {
      "deathPlace": "Лондон, Великобритания",
      "coordinates": {
        "lat": 34.3142,
        "lng": 47.065
      },
      "nationality": "британка"
    },
    sources(
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/2007/lessing/"],
      ["University of East Anglia Archives", "https://archivecollections.uea.ac.uk/dl"],
    ),
    "Описание полностью подтверждено; отдельно исправлены ошибочные координаты места рождения, национальность и отсутствующее место смерти."
  ),
  correction(
    "zimbabwe",
    "peter_godwin",
    {
      "birthDate": "1957",
      "works": [
        "Mukiwa",
        "When a Crocodile Eats the Sun",
        "The Fear"
      ]
    },
    sources(
      ["PEN America", "https://pen.org/profile/peter-godwin/"],
      ["Oslo Freedom Forum", "https://oslofreedomforum.com/speaker/peter-godwin/"],
      ["Georgia Political Review, University of Georgia", "https://georgiapoliticalreview.com/exclusive-interview-with-peter-godwin-author/"],
    ),
    "Слишком общее исходное описание конкретизировано проверяемыми названиями книг; неподтверждённая точность дня рождения снижена до 1957 года."
  ),
  correction(
    "zimbabwe",
    "solomon_mutswairo",
    {
      "deathDate": "2005-11",
      "birthPlace": "Заву, округ Мазове, Южная Родезия",
      "coordinates": undefined,
      "works": [
        "Feso",
        "Simudzai Mureza wedu WeZimbabwe"
      ]
    },
    sources(
      ["Store norske leksikon", "https://snl.no/Zimbabwes_litteratur"],
      ["The Herald Zimbabwe", "https://www.heraldonline.co.zw/mutsvairo-quiet-student-who-became-a-guru/"],
      ["Journal of Pan African Studies", "https://www.jpanafrican.org/docs/vol3no4/3.4SolomonMutsvairo.pdf"],
    ),
    "Неопределённое «первый известный романист» заменено точным библиографическим фактом; добавлено документированное авторство гимна, а точность даты смерти снижена до подтверждённого месяца. Место рождения исправлено на Заву в округе Мазове; координаты Хараре удалены как относящиеся к другому месту."
  ),
  correction(
    "zimbabwe",
    "tsitsi_dangarembga",
    {
      "birthDate": "1959",
      "works": [
        "Nervous Conditions",
        "The Book of Not",
        "This Mournable Body"
      ]
    },
    sources(
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/tsitsi-dangarembga"],
      ["Peace Prize of the German Book Trade", "https://www.friedenspreis-des-deutschen-buchhandels.de/en/alle-preistraeger-seit-1950/2020-2029/tsitsi-dangarembga"],
    ),
    "Слово «современная» заменено устойчивыми биографическими фактами и названиями произведений; конфликт источников между 4 и 14 февраля не позволяет сохранять точный день рождения, поэтому оставлен только 1959 год."
  ),
  correction(
    "zimbabwe",
    "yvonne_vera",
    {
      "deathPlace": "Торонто, Канада",
      "works": [
        "Under the Tongue",
        "Butterfly Burning",
        "The Stone Virgins"
      ],
      "genres": [
        "роман",
        "рассказ"
      ]
    },
    sources(
      ["International Literature Festival Berlin", "https://literaturfestival.com/en/authors/yvonne-vera/"],
      ["The Guardian", "https://www.theguardian.com/news/2005/apr/27/guardianobituaries.books"],
      ["York University Archives", "https://atom.library.yorku.ca/yvonne-vera-fonds"],
    ),
    "Ошибочная характеристика как поэтессы и оценочная формула удалены; жанры и произведения приведены по биографическим источникам. Точные даты 19 сентября 1964 года и 7 апреля 2005 года независимо подтверждены некрологом The Guardian и поэтому сохранены; место смерти исправлено на Торонто."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch57[];
