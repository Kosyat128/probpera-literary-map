import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch53 = {
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
): WriterPublicProfileFactCorrectionBatch53 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch53 = [
  correction(
    "tunisia",
    "ali_douagi",
    {
      "deathDate": "1949-05-27",
      "works": [
        "Sahirtu minhu al-layālī",
        "Jawla bayna ḥānāt al-Baḥr al-Mutawassiṭ"
      ]
    },
    sources(
      ["Национальная библиотека Туниса", "https://kitab.bnt.nat.tn/ar/autorite/92"],
      ["Тунисская академия наук, литературы и искусств «Бейт аль-Хикма»", "https://www.beitalhikma.tn/wp-content/uploads/2023/03/Publications-2011-2015.pdf"],
    ),
    "Исправлена дата смерти: 27 мая, а не 27 ноября 1949 года; неточное русское название произведения заменено оригинальными заглавиями."
  ),
  correction(
    "tunisia",
    "bechir_khraief",
    {
      "birthDate": "1917",
      "deathDate": "1983",
      "works": [
        "Al-Digla fī ʿarājīnihā",
        "Barg el-Lil"
      ]
    },
    sources(
      ["Национальная библиотека Франции", "https://catalogue.bnf.fr/ark:/12148/cb34964193s"],
      ["Open Book Publishers", "https://books.openbookpublishers.com/10.11647/obp.0254.pdf"],
    ),
    "Исходные месяц и день рождения и смерти не подтверждаются выбранными авторитетными источниками и были заменены доказанными годами; «Ад-Дукана» не подтверждена как его произведение."
  ),
  correction(
    "tunisia",
    "habib_selmi",
    {
      "birthDate": "1951",
      "works": [
        "The Scents of Marie-Claire"
      ]
    },
    sources(
      ["International Prize for Arabic Fiction", "https://archive.arabicfiction.org/ar/node/1782"],
      ["American University in Cairo Press", "https://aucpress.com/9789774167409/"],
    ),
    "Оценка известности удалена; искусственная дата 1 января сокращена до подтверждённого года, а название произведения уточнено."
  ),
  correction(
    "turkey",
    "ahmet_hamdi_tanpinar",
    {
      "deathDate": "1962",
      "works": [
        "Saatleri Ayarlama Enstitüsü"
      ]
    },
    sources(
      ["Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/tanpinar-ahmet-hamdi"],
      ["Министерство культуры и туризма Турции", "https://www.ktb.gov.tr/EN-119827/tanpinar-ahmet-hamdi.html"],
    ),
    "Оценочное ранжирование удалено. Авторитетные турецкие источники расходятся в точном дне смерти (23 или 24 января 1962 года), поэтому профиль ограничен годом."
  ),
  correction(
    "turkey",
    "fuzuli",
    {
      "name": "Физули",
      "birthDate": "",
      "deathDate": "1556",
      "works": [
        "Leylî vü Mecnun",
        "Türkçe Divan",
        "Farsça Divan",
        "Arapça Divan"
      ]
    },
    sources(
      ["Encyclopaedia Iranica", "https://www.iranicaonline.org/articles/fozuli/"],
      ["Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/fuzuli"],
      ["Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A4%D0%B8%D0%B7%D1%83%D0%BB%D0%B8"],
    ),
    "Исправлены транслитерация и односторонняя привязка к Турции. Источники существенно расходятся в годе рождения, а точные 1 января 1483 и 1 января 1556 неисторичны; сохранён только надёжный год смерти."
  ),
  correction(
    "turkey",
    "halide_edib",
    {
      "birthDate": "1884",
      "works": [
        "Ateşten Gömlek",
        "Sinekli Bakkal"
      ]
    },
    sources(
      ["Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/adivar-halide-edip"],
      ["Министерство культуры и туризма Турции", "https://www.ktb.gov.tr/EN-118055/adivar-halide-edip.html"],
    ),
    "Субъективное ранжирование удалено; день рождения 11 июня не подтверждён выбранными авторитетными источниками, поэтому оставлен только год."
  ),
  correction(
    "turkey",
    "yunus_emre",
    {
      "birthDate": "ок. 1240",
      "deathDate": "ок. 1320"
    },
    sources(
      ["Турецкая религиозная энциклопедия TDV", "https://islamansiklopedisi.org.tr/yunus-emre"],
      ["Энциклопедия тюркского мира", "https://turkdunyasiansiklopedisi.gov.tr/detay/485/Yunus-Emre--"],
    ),
    "Убраны оценочное ранжирование и ложная точность 1238-01-01/1328-01-01; даты жизни в источниках реконструируются приблизительно."
  ),
  correction(
    "turkmenistan",
    "aman_kekilov",
    {
      "birthDate": "1912-05-09",
      "deathDate": "1974-12-13",
      "works": [
        "Söýgi",
        "Dargan bulutlar",
        "Edebiýat teoriýasy"
      ]
    },
    sources(
      ["Официальный портал города Аркадаг", "https://arkadag-shaheri.gov.tm/about-city/famous-personalities/1"],
      ["Национальная энциклопедия Узбекистана", "https://qomus.info/oz/encyclopedia/k/kekilov/"],
    ),
    "Исправлены обе календарные даты и заменено родовое обозначение «поэтические сборники» на документированные названия произведений."
  ),
  correction(
    "turkmenistan",
    "atajan_tagan",
    {
      "birthDate": "1940-05-15",
      "deathDate": "2025-12-21",
      "works": [
        "Keseki",
        "Saragt galasy"
      ]
    },
    sources(
      ["Министерство культуры и туризма Турции", "https://ekitap.ktb.gov.tr/Eklenti/11832%2Catacantaganpdf.pdf?0="],
      ["Государственное информационное агентство Туркменистана", "https://turkmenistan.gov.tm/tk/habar/51232/atajan-taganyn-keseki-romanynyn-fransuz-nesirinin-jiltinin-dizayny-ses-bermek-arkaly-kesgitlener"],
      ["Zaman Türkmenistan", "https://zamanturkmenistan.com.tm/turkmen-edebiyatynyn-meshur-yazyjysy-atajan-tagan-aradan-cykdy/"],
    ),
    "Исправлен год рождения 1951 на 1940, удалена искусственная дата 1 января и учтена смерть писателя в декабре 2025 года; родовое «современная проза» заменено названиями книг."
  ),
  correction(
    "turkmenistan",
    "berdy_kerbabayev",
    {
      "birthDate": "1894-03-15",
      "works": [
        "Aýgytly ädim",
        "Nebitdag",
        "Aýsoltan"
      ]
    },
    sources(
      ["Министерство культуры Туркменистана", "https://medeniyet.gov.tm/app/tk/art-world/16"],
      ["Государственное информационное агентство Туркменистана", "https://turkmenistan.gov.tm/en/post/83045/"],
    ),
    "Оценочная формулировка заменена фактами; 3 марта в исходном профиле — дата старого стиля, для современного поля указано 15 марта по григорианскому календарю."
  ),
  correction(
    "turkmenistan",
    "chary_ashyrov",
    {
      "birthDate": "1910",
      "deathDate": "2003",
      "works": [
        "Yzçy",
        "Ekizler",
        "Garry serdar",
        "Göreş"
      ]
    },
    sources(
      ["Министерство культуры Туркменистана", "https://medeniyet.gov.tm/app/tk/art-world/169"],
      ["Центрально-Европейский университет", "https://www.etd.ceu.edu/2016/babayeva_maya.pdf"],
    ),
    "Искусственные даты 1 января сокращены до подтверждённых годов; родовое обозначение произведений заменено конкретными названиями."
  ),
  correction(
    "turkmenistan",
    "dowletmammet_azady",
    {
      "birthDate": "",
      "deathDate": "1760",
      "works": [
        "Wagzy-Azat"
      ]
    },
    sources(
      ["Энциклопедия турецкой литературы имени Ахмета Ясави", "https://teis.yesevi.edu.tr/%2Bmadde-detay/azadi-dovletmemmet"],
      ["Академия наук Туркменистана", "https://science.gov.tm/storage/files/journals/104.pdf"],
    ),
    "Ложная точность 1 января удалена; из-за конфликта 1695/1700 поле рождения очищено, а название произведения уточнено."
  ),
  correction(
    "turkmenistan",
    "kemine",
    {
      "name": "Мехметвели Кемине",
      "birthDate": "ок. 1770",
      "deathDate": "1840",
      "works": []
    },
    sources(
      ["Энциклопедия турецкой литературы имени Ахмета Ясави", "https://teis.yesevi.edu.tr/%20madde-detay/kemine"],
      ["Турецкое лингвистическое общество", "https://erdem.gov.tr/eng/full-text-pdf/407/tur"],
    ),
    "Искусственные даты 1 января удалены; «Сатирические стихи» признано жанровым описанием, а не названием произведения."
  ),
  correction(
    "turkmenistan",
    "kerim_kurbannepesov",
    {
      "birthDate": "1929-10-18",
      "deathDate": "1988-09-01",
      "works": [
        "Güýjümiň gözbaşy",
        "Taýmaz baba",
        "Oýlanma baýry"
      ]
    },
    sources(
      ["Министерство культуры Туркменистана", "https://medeniyet.gov.tm/app/tk/posts/92"],
      ["Государственное информационное агентство Туркменистана", "https://www.turkmenistan.gov.tm/ru/post/54023/"],
    ),
    "Искусственные даты 1 января заменены точными подтверждёнными датами; родовое «поэтические сборники» заменено названиями книг."
  ),
  correction(
    "turkmenistan",
    "magtymguly_pyragy",
    {
      "birthDate": "ок. 1724",
      "deathDate": "ок. 1807",
      "works": []
    },
    sources(
      ["Государственная миграционная служба Туркменистана", "https://migration.gov.tm/pages/magtymguly"],
      ["Museum Studies Abroad", "https://museumstudiesabroad.org/magtymguly-pyragy-nation/"],
    ),
    "Оценочное ранжирование и искусственные даты 1 января удалены; годы жизни оставлены приблизительными, а не являющееся авторским заглавием поле works очищено."
  ),
  correction(
    "turkmenistan",
    "mollanepes",
    {
      "birthDate": "ок. 1810",
      "deathDate": "",
      "works": [
        "Zöhre-Tahyr"
      ]
    },
    sources(
      ["Энциклопедия турецкой литературы имени Ахмета Ясави", "https://teis.yesevi.edu.tr/madde-detay/mollanepes"],
      ["Большая российская энциклопедия", "https://bigenc.ru/c/mollanepes-c968f7"],
    ),
    "Оценка масштаба и ложная точность 1 января удалены; конфликтующий год смерти очищен по принципу fail-closed, название дастана дано в оригинальной форме."
  ),
  correction(
    "uae",
    "ahmad_rashid_thani",
    {
      "years": "1962/1963-2012",
      "birthDate": "",
      "deathDate": "2012-02-20",
      "works": [
        "A Wave at the Door"
      ]
    },
    sources(
      ["Центр арабского языка Абу-Даби", "https://alc.ae/media/news/abu-dhabi-arabic-language-centre-s-esdarat-releases-new-edition-of-the-late-emirati-poet-ahmed-rashid-thani-s-a-wave-at-the-door/"],
      ["Департамент культуры и туризма Абу-Даби — Энциклопедия поэзии", "https://poetry.dct.gov.ae/poets/3185-"],
    ),
    "Исправлен ошибочный 2019 год смерти. Два официальных культурных источника расходятся в годе рождения (1962/1963), поэтому поле очищено."
  ),
  correction(
    "uae",
    "habib_al_sayegh",
    {
      "name": "Хабиб Юсеф ас-Сайег",
      "birthDate": "1955-02-08",
      "works": [
        "Qaṣāʾid ʿalā baḥr al-baḥr",
        "Kasr fī al-wazn"
      ]
    },
    sources(
      ["Департамент культуры и туризма Абу-Даби — Энциклопедия поэзии", "https://poetry.dct.gov.ae/poets/3219-"],
      ["Информационное агентство ОАЭ WAM", "https://www.wam.ae/en/article/hszr902i-emirati-poet-writer-habib-sayegh-dies"],
    ),
    "Оценочная характеристика удалена; уточнены русская передача фамилии, дата рождения и конкретные названия сборников."
  ),
  correction(
    "uae",
    "mohammed_al_murr",
    {
      "name": "Мохаммед Ахмед аль-Мурр",
      "works": [
        "Dubai Tales",
        "The Wink of the Mona Lisa"
      ]
    },
    sources(
      ["Emirates Airline Festival of Literature", "https://emirateslitfest.com/services/hemohammedalmurr/"],
      ["Министерство культуры ОАЭ", "https://moc.gov.ae/en/initiative/order-creative-and-culture/"],
    ),
    "Недоказанное упоминание романов убрано: авторитетные профили характеризуют аль-Мурра прежде всего как автора коротких рассказов; родовое поле works заменено названиями книг."
  ),
  correction(
    "uae",
    "ousha_al_suwaidi",
    {
      "works": []
    },
    sources(
      ["Фонд Оши бинт Халифа аль-Сувайди", "https://ousha.ae/biography-en.html"],
      ["Информационное агентство ОАЭ WAM", "https://www.wam.ae/en/article/hszr7agn-emirates-writers-union-mourns-death-poet-ousha"],
    ),
    "Оценочное ранжирование удалено; «Набати-поэзия» перенесена в описание как жанр и удалена из списка названий произведений."
  ),
  correction(
    "uae",
    "sultan_al_owais",
    {
      "name": "Султан бин Али аль-Овайс",
      "works": [
        "Mirrors of the Gulf",
        "Diwan Sultan Al Owais"
      ]
    },
    sources(
      ["Фонд Султана бин Али аль-Овайса", "https://www.alowais.com/en/owaismemory1/"],
      ["UNESCO", "https://articles.unesco.org/sites/default/files/medias/fichiers/2025/09/Program%20of%20the%20Sultan%20Al%20Owais%20Seminar.pdf"],
    ),
    "Расплывчатая оценка заменена проверяемыми фактами; имя дополнено, родовое название произведений заменено библиографическими заглавиями."
  ),
  correction(
    "uganda",
    "byron_kawadwa",
    {
      "name": "Байрон Кавадва",
      "birthDate": "",
      "works": [
        "Oluyimba lwa Wankoko"
      ]
    },
    sources(
      ["AfricaBib / African Studies Centre Leiden", "https://www.africabib.org/rec.php?RID=330185349"],
      ["Университет Макерере", "https://dissertations.mak.ac.ug/bitstream/handle/20.500.12281/20009/Agaba-CHUSS-SLPA.pdf?isAllowed=y&sequence=3"],
    ),
    "Исправлена транслитерация фамилии и добавлено произведение. Год рождения очищен: академическая статья даёт 1937, тогда как университетская работа называет его 37-летним в 1977 году."
  ),
  correction(
    "uganda",
    "jennifer_nansubuga_makumbi",
    {
      "name": "Дженнифер Нансубуга Макумби",
      "birthDate": "",
      "works": [
        "Kintu",
        "The First Woman",
        "Manchester Happened"
      ]
    },
    sources(
      ["Windham-Campbell Prizes, Yale University", "https://windhamcampbell.org/recipients/makumbi-jennifer-nansubuga"],
      ["Commonwealth Foundation", "https://commonwealthfoundation.com/commonwealth-short-story-prize-archives/short-story-prize-2024/"],
    ),
    "Убрано оценочное ранжирование и исправлена русская транслитерация. Надёжные институциональные профили не подтверждают 1967 год рождения, поэтому поле очищено."
  ),
  correction(
    "uganda",
    "mary_karooro_okurut",
    {
      "deathDate": "2025-08-11",
      "works": [
        "The Invisible Weevil",
        "The Official Wife",
        "The Curse of the Sacred Cow"
      ]
    },
    sources(
      ["Фонд Университета Макерере", "https://endowment.mak.ac.ug/pages/mary-karooro-okurut-a-trailblazer-in-the-mak-hall-of-fame/"],
      ["Uganda Broadcasting Corporation", "https://ubc.go.ug/2025/08/12/a-legacy-woven-in-light-mary-karooro-okurut-goes-to-the-lord1954-2025/"],
    ),
    "Учтена смерть 11 августа 2025 года и дополнен перечень произведений. Авторитетные и профильные источники расходятся в точном дне рождения, поэтому сохранён только 1954 год."
  ),
  correction(
    "uganda",
    "moses_isegawa",
    {
      "name": "Мозес Исегава",
      "works": [
        "Abyssinian Chronicles",
        "Snakepit"
      ]
    },
    sources(
      ["Pan Macmillan", "https://www.panmacmillan.com/authors/moses-isegawa/2069"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/14129/moses-isegawa/"],
    ),
    "Исправлена русская транслитерация фамилии; общая формулировка заменена подтверждёнными биографическими сведениями и оригинальными названиями романов."
  ),
  correction(
    "uganda",
    "okot_pbitek",
    {
      "deathDate": "1982"
    },
    sources(
      ["Store norske leksikon", "https://snl.no/Okot_p%27Bitek"],
      ["Большая российская энциклопедия", "https://old.bigenc.ru/literature/text/1872059"],
    ),
    "Оценочное ранжирование удалено. Источники расходятся между 19 и 20 июля 1982 года, поэтому точный день смерти в профиле заменён надёжным годом."
  ),
  correction(
    "uganda",
    "robert_serumaga",
    {
      "works": [
        "The Elephants",
        "Majangwa",
        "Return to the Shadows"
      ]
    },
    sources(
      ["Store norske leksikon", "https://snl.no/Robert_Serumaga"],
      ["Cambridge University Press", "https://www.cambridge.org/core/books/abs/african-theatre-16-six-plays-from-east-west-africa/notions-of-indigeneity-ugandas-robert-serumaga/9361504658F3DFD52B8F3B71671449DD"],
    ),
    "Широкое утверждение об «основателе традиции» заменено проверяемыми профессиями и произведениями."
  ),
  correction(
    "uganda",
    "timothy_wangusa",
    {
      "name": "Тимоти Вангуса",
      "birthDate": "1942-05-20",
      "works": [
        "Upon This Mountain",
        "Salutations",
        "A Pattern of Dust"
      ]
    },
    sources(
      ["Университет Макерере", "https://news.mak.ac.ug/2022/07/makerere-university-celebrates-prof-timothy-wangusa80/"],
      ["Cambridge University Press", "https://www.cambridge.org/core/books/history-of-modern-uganda/refractions/13EDE93689F6810E801FB3A5BAC3EEC3"],
    ),
    "Исправлена ошибочная фамилия «Ваньяра», уточнена дата рождения и удалено не принадлежащее автору произведение «Узник совести»."
  ),
  correction(
    "ukraine",
    "ivan_kotliarevsky",
    {
      "works": [
        "Энеида",
        "Наталка Полтавка",
        "Москаль-чародей"
      ]
    },
    sources(
      ["Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CO%5CKotliarevskyIvan.htm"],
      ["Украинский институт национальной памяти", "https://old.uinp.gov.ua/publication/kotlyarevskii-ivan-petrovich"],
    ),
    "Историографическое определение «один из основателей» заменено конкретными жанрами и произведениями. Даты профиля уже даны по новому стилю; старый стиль — 29 августа и 29 октября."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch53[];
