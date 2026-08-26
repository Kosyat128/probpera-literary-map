import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch36 = {
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

const checkedAt = "2026-08-11";

export const writerBiographyPublicProfileFactCorrectionsBatch36 = [
  {
    countryId: "kazakhstan",
    writerId: "ybyrai_altynsarin",
    patch: {
      birthPlace: "Аркарагайская волость, Костанайская область",
      works: ["Киргизская хрестоматия","Начальное руководство к обучению киргизов русскому языку"],
      deathDate: "",
    },
    evidence: [
      { provider: "Костанайский региональный университет имени Ахмет Байтұрсынұлы", url: "https://au.edu.kz/index.php/en/about-y-altynsarin", checkedAt },
      { provider: "Национальная академическая библиотека Республики Казахстан", url: "https://library.kz/en/ybyrai-altynsarin-1841-1889/ybyrai-altynsarin-1841-1889-about-him.html", checkedAt },
    ],
    note: "Профильное место рождения уточнено, служебное «Рассказы» заменено названиями документированных учебных изданий. Точный день смерти не подтверждён двумя выбранными источниками, поэтому безопасно оставить только год.",
  },
  {
    countryId: "kazakhstan",
    writerId: "zhussipbek_aimauytov",
    patch: {
      birthPlace: "Кызылтау, Баянаульский уезд, Павлодарская область",
      works: ["Карткожа","Акбилек"],
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Правительство Республики Казахстан", url: "https://www.gov.kz/memleket/entities/aktobe-til/press/news/details/673708", checkedAt },
      { provider: "Восточно-Казахстанская областная библиотека имени А. С. Пушкина", url: "https://www.pushkinlibrary.kz/docs/akbilek.pdf", checkedAt },
      { provider: "Казахский национальный университет имени аль-Фараби", url: "https://philart.kaznu.kz/index.php/1-FIL/en/article/view/1496", checkedAt },
    ],
    note: "В источниках расходятся точные даты рождения и казни, а также встречаются 1930 и 1931 годы смерти. В публичном тексте сохранены поддержанные официальным материалом годы, но точные календарные даты удалены как недостаточно устойчивые.",
  },
  {
    countryId: "kenya",
    writerId: "billy_kahora",
    patch: {
      works: ["The True Story of David Munyakei","The Cape Cod Bicycle War"],
      years: "",
      birthDate: "",
      birthPlace: "",
      coordinates: undefined,
    },
    evidence: [
      { provider: "University of Bristol", url: "https://www.bristol.ac.uk/people/person/Billy-Kahora-1efef03c-bbc3-4ec9-b7ae-5c47af64a5b7", checkedAt },
      { provider: "WritersMosaic - Royal Literary Fund", url: "https://writersmosaic.org.uk/contributors/billy-kahora-at-writersmosaic/", checkedAt },
    ],
    note: "Авторство и редакторская работа подтверждены, но выбранные авторитетные источники не подтверждают профильные 1975 год и Найроби как место рождения. Непроверенную биографическую точность и связанные координаты следует удалить.",
  },
  {
    countryId: "kenya",
    writerId: "binyavanga_wainaina",
    patch: {
      birthPlace: "Накуру, Кения",
    },
    evidence: [
      { provider: "Hurston/Wright Foundation", url: "https://www.hurstonwright.org/authors/binyavanga-wainaina/", checkedAt },
      { provider: "The Caine Prize for African Writing", url: "https://www.caineprize.com/blog/tag/Tributes", checkedAt },
    ],
    note: "Исходная краткая биография дополнена премией и ключевыми публикациями; ошибочное место рождения Найроби исправлено на Накуру.",
  },
  {
    countryId: "kenya",
    writerId: "grace_ogot",
    patch: {
      birthPlace: "Асембо, Ньянза, Кения",
    },
    evidence: [
      { provider: "University of Nairobi", url: "https://erepository.uonbi.ac.ke/bitstream/handle/11295/154778/The%20Journal%20of%20the%20Department%20of%20LiteratureUniversity%20of%20Nairobi.pdf?isAllowed=y&sequence=1", checkedAt },
      { provider: "African Books Collective", url: "https://africanbookscollective.com/books/land-without-thunder/", checkedAt },
    ],
    note: "Опечатка «Алго» в месте рождения исправлена на подтверждённый регион Асембо в Ньянзе; общая оценочная формулировка заменена проверяемыми ролями, языками и книгой.",
  },
  {
    countryId: "kenya",
    writerId: "henry_ole_kulet",
    patch: {
      years: "1946-2021",
      birthDate: "1946",
      deathDate: "2021-02-16",
      birthPlace: "Энкаре-Нгусур (Сийяпей), округ Нарок, Кения",
      deathPlace: "Накуру, Кения",
      works: ["Is It Possible?","Blossoms of the Savannah","Vanishing Herds"],
    },
    evidence: [
      { provider: "University of Nairobi", url: "https://erepository.uonbi.ac.ke/bitstream/handle/11295/18382/Mbugua_Issues%20Of%20Identity%20In%20Ole%20Kulet%27s%20Is%20It%20Possible%20And%20To%20Become%20A%20Man.pdf?sequence=2", checkedAt },
      { provider: "Business Daily Africa - Nation Media Group", url: "https://www.businessdailyafrica.com/bd/news/author-henry-ole-kulet-dies-aged-75-3294428", checkedAt },
    ],
    note: "В профиле ошибочно указан 2022 год смерти и дата 18 февраля. Они исправлены на 16 февраля 2021 года; место рождения уточнено, а перечень произведений расширен только документированными названиями.",
  },
  {
    countryId: "kenya",
    writerId: "marjorie_oludhe_macgoye",
    patch: {
      deathDate: "2015-12-01",
      deathPlace: "Найроби, Кения",
    },
    evidence: [
      { provider: "Marjorie Oludhe Macgoye - официальный семейный архив", url: "https://marjorieoludhe.com/", checkedAt },
      { provider: "Dublin Literary Award", url: "https://dublinliteraryaward.ie/the-library/authors/marjorie-oludhe-macgoye/", checkedAt },
    ],
    note: "Исходная оценочная характеристика заменена фактами о происхождении, переезде и книге. Профильный день смерти 1 ноября исправлен на документированное 1 декабря 2015 года.",
  },
  {
    countryId: "kenya",
    writerId: "meja_mwangi",
    patch: {
      years: "1948-2025",
      birthDate: "1948-12-27",
      deathDate: "2025-12-11",
      birthPlace: "Наньюки, Кения",
      deathPlace: "Малинди, Кения",
    },
    evidence: [
      { provider: "Store norske leksikon", url: "https://snl.no/Meja_Mwangi", checkedAt },
      { provider: "The Standard Kenya", url: "https://www.standardmedia.co.ke/national/article/2001536383/novelist-meja-mwangi-dies-leaving-lasting-literary-legacy", checkedAt },
    ],
    note: "Профиль устарел после смерти автора: годы жизни и место смерти обновлены; место рождения Ньери исправлено на Наньюки. Сообщаемый в некрологе возраст не повторён из-за внутреннего расхождения с подтверждённой датой рождения.",
  },
  {
    countryId: "kenya",
    writerId: "mukoma_wa_ngugi",
    patch: {
      birthPlace: "Эванстон, Иллинойс, США",
    },
    evidence: [
      { provider: "Cornell University", url: "https://as.cornell.edu/index.php/people/mukoma-wa-ngugi", checkedAt },
      { provider: "International Literature Festival Berlin", url: "https://literaturfestival.com/en/authors/mukoma-wa-ngugi/", checkedAt },
    ],
    note: "Общее профильное место рождения «Кения» было неверным: два источника связывают рождение автора с Иллинойсом, а фестивальная биография уточняет Эванстон.",
  },
  {
    countryId: "kenya",
    writerId: "peter_kimani",
    patch: {
      birthDate: "1971",
      birthPlace: "Кения",
      coordinates: undefined,
    },
    evidence: [
      { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/2308255/peter-kimani/", checkedAt },
      { provider: "Aga Khan University", url: "https://www.aku.edu/gsmc/Pages/our-people.aspx", checkedAt },
      { provider: "Africa in Words", url: "https://africainwords.com/2019/05/23/qa-peter-kimani-author-of-dance-of-the-jakaranda-talks-with-maeline-le-lay/", checkedAt },
    ],
    note: "Год рождения поддержан отдельным литературным интервью, однако Найроби как точное место рождения не подтверждён выбранными источниками. Место сведено к Кении, координаты Найроби удалены.",
  },
  {
    countryId: "kenya",
    writerId: "yvonne_adhiambo_owuor",
    patch: {
      birthPlace: "Найроби, Кения",
      works: ["Пыль","Море стрекоз"],
    },
    evidence: [
      { provider: "International Literature Festival Berlin", url: "https://literaturfestival.com/en/authors/yvonne-adhiambo-owuor/", checkedAt },
      { provider: "International Writing Program - University of Iowa", url: "https://iwp.uiowa.edu/writers/2017-resident/owuor-yvonne", checkedAt },
      { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/159826/yvonne-adhiambo-owuor/", checkedAt },
    ],
    note: "Общая характеристика заменена датированными сведениями о премии и конкретных книгах. Место рождения уточнено до Найроби, а русское название второго романа добавлено в список произведений.",
  },
  {
    countryId: "kiribati",
    writerId: "teresia_teaiwa",
    patch: {
      birthPlace: "Гонолулу, Гавайи, США",
      nationality: "и-кирибати и афроамериканка",
      works: ["Searching for Nei Nim’anoa","I Can See Fiji: Poetry and Sound"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "University of California, Santa Cruz", url: "https://histcon.ucsc.edu/uncategorized/2017/09/in-memoriam-teresia-teaiwa/", checkedAt },
      { provider: "Pacific Community (SPC)", url: "https://spc.int/teresia-kieuea-teaiwa", checkedAt },
      { provider: "National Library of New Zealand", url: "https://natlib.govt.nz/records/21656420", checkedAt },
    ],
    note: "Профиль ошибочно указывал Тараву как место рождения и содержал опечатку в национальности; источники подтверждают Гонолулу и смешанное и-кирибатийское и афроамериканское происхождение. Неподтверждённое название «The Art of Being Human» заменено документированным аудиопроектом; дублирующая запись Фиджи относится к той же личности, но страновая связь с Кирибати поддержана происхождением.",
  },
  {
    countryId: "kosovo",
    writerId: "adem_demaci",
    patch: {
      works: ["Gjarpijt e gjakut"],
    },
    evidence: [
      { provider: "Государственное архивное агентство Косова", url: "https://ashak.rks-gov.net/wp-content/uploads/2024/12/Adem-Demaci_Katalogu_web.pdf", checkedAt },
      { provider: "Албанское радио и телевидение (RTSH)", url: "https://rtsh.al/rti/en/adem-demaci-a-symbol-of-national-resistance/", checkedAt },
    ],
    note: "Исходная биография была слишком общей; подтверждены даты, литературная идентичность и конкретное произведение. Официальный архив указывает Приштину как место рождения, поэтому профиль не следует менять на встречающийся во вторичных справочниках Подуево.",
  },
  {
    countryId: "kosovo",
    writerId: "flora_brovina",
    patch: {
      birthPlace: "Скендерай, Косово",
      coordinates: undefined,
    },
    evidence: [
      { provider: "Ассамблея Республики Косово", url: "https://old.kuvendikosoves.org/?cid=2%2C102%2C436", checkedAt },
      { provider: "PEN America", url: "https://pen.org/individual-case/flora-brovina/", checkedAt },
      { provider: "Oral History Kosovo", url: "https://oralhistorykosovo.org/flora-brovina/", checkedAt },
      { provider: "Amnesty International", url: "https://www.amnesty.org/en/wp-content/uploads/2021/06/act750022000en.pdf", checkedAt },
    ],
    note: "Место рождения «Скулан» не подтверждается: собственное свидетельство Бровины и косовский архив устной истории указывают Скендерай. Биография дополнена подтверждёнными профессиональными ролями без оценочных эпитетов.",
  },
  {
    countryId: "kosovo",
    writerId: "mehmet_kraja",
    patch: {
      birthPlace: "Кэштенье, область Края, Черногория",
      coordinates: undefined,
    },
    evidence: [
      { provider: "Академия наук и искусств Косова", url: "https://ashak.org/anetaret/mehmet-kraja/", checkedAt },
      { provider: "Академия наук Албании", url: "https://akad.gov.al/wp-content/uploads/2024/05/Mehmet-Kraja.pdf", checkedAt },
    ],
    note: "Исходное место рождения Печ не соответствует двум академическим биографиям. Оно заменено Кэштенье в Черногории; координаты Печа не должны сохраняться после этой коррекции.",
  },
  {
    countryId: "kosovo",
    writerId: "rexhep_qosja",
    patch: {
      years: "1936-2026",
      deathDate: "2026-04-23",
      birthPlace: "Вутай, Черногория",
      works: ["Смерть приходит ко мне из таких глаз","История албанской литературы: романтизм"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "Академия наук и искусств Косова", url: "https://ashak.org/anetaret/rexhep-qosja/", checkedAt },
      { provider: "Hrvatska enciklopedija", url: "https://www.enciklopedija.hr/clanak/qosja-rexhep", checkedAt },
      { provider: "Правительство Республики Косово", url: "https://kryeministri.rks-gov.net/en/news/fjala-e-kryeministrit-ne-detyre-kurti-ne-takimin-nderues-me-rastin-e-90-vjetorit-te-lindjes-se-profesorit-qosja/", checkedAt },
      { provider: "Албанское радио и телевидение (RTSH)", url: "https://rtsh.al/rti/en/kosovan-literary-figure-and-political-thinker-rexhep-qosja-dies-aged-89/", checkedAt },
    ],
    note: "Профиль устарел: Косья умер 23 апреля 2026 года. Место рождения также было неверно сведено к Косову; академические и энциклопедические источники указывают Вутай в Черногории.",
  },
  {
    countryId: "kuwait",
    writerId: "ahmad_al_adwani",
    patch: {
      fullName: "Ahmad Meshari Al-Adwani",
      years: "1922/1923-1990",
      works: ["Крылья бури","Государственный гимн Кувейта"],
      birthDate: "",
    },
    evidence: [
      { provider: "Национальный совет Кувейта по культуре, искусству и литературе", url: "https://alarabi.nccal.gov.kw/Home/Article/326", checkedAt },
      { provider: "Национальный совет Кувейта по культуре, искусству и литературе - исследование даты рождения", url: "https://alarabi.nccal.gov.kw/Home/Article/19227", checkedAt },
      { provider: "Министерство образования Кувейта", url: "https://elibrary.moe.edu.kw/api/File/download/book/1457", checkedAt },
    ],
    note: "Точный год рождения спорен даже в профильном издании кувейтского культурного совета, поэтому прежнее однозначное «1922» заменено консервативным диапазоном 1922/1923. Уточнены полное имя и конкретное издание.",
  },
  {
    countryId: "kuwait",
    writerId: "fahad_al_askar",
    patch: {
      fullName: "Fahad Saleh Al-Askar",
      deathDate: "1951-08-15",
      birthPlace: "Эль-Кувейт, Кувейт",
    },
    evidence: [
      { provider: "Кувейтское информационное агентство KUNA", url: "https://www.kuna.net.kw/ArticleDetails.aspx?Language=en&id=2518129", checkedAt },
      { provider: "Национальный совет Кувейта по культуре, искусству и литературе", url: "https://alarabi.nccal.gov.kw/Home/Article/5504", checkedAt },
    ],
    note: "Суперлатив заменён содержательной характеристикой. Государственное агентство позволяет уточнить полное имя, место рождения и день смерти.",
  },
  {
    countryId: "kuwait",
    writerId: "ismail_fahd_ismail",
    patch: {
      birthPlace: "Аль-Сабилият близ Басры, Ирак",
      works: ["Небо было голубым","Аль-Сабилият","Феникс и верный друг"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "Кувейтское информационное агентство KUNA", url: "https://www.kuna.net.kw/ArticleDetails.aspx?Language=ar&id=2747952", checkedAt },
      { provider: "International Prize for Arabic Fiction", url: "https://archive.arabicfiction.org/en/node/57", checkedAt },
      { provider: "Gulf News", url: "https://gulfnews.com/entertainment/books/ismail-fahd-ismail-doyen-of-kuwaiti-literature-1.2296113", checkedAt },
    ],
    note: "Исходное место рождения «Кувейт» ошибочно: автор родился в Аль-Сабилият близ Басры. Служебные или неидентифицированные русские названия произведений заменены подтверждёнными библиографическими позициями.",
  },
  {
    countryId: "kuwait",
    writerId: "laila_al_othman",
    patch: {
      fullName: "Laila Abdullah Al-Othman",
      works: ["Женщина в сосуде","Женщина и кошка","Уход"],
    },
    evidence: [
      { provider: "Fiker Institute", url: "https://www.fikerinstitute.org/publications/how-women-shaped-kuwaits-literary-scene", checkedAt },
      { provider: "Кувейтское информационное агентство KUNA", url: "https://www.kuna.net.kw/ArticlePrintPage.aspx?id=1054711&language=en", checkedAt },
      { provider: "Educational Administration: Theory and Practice", url: "https://kuey.net/index.php/kuey/article/download/10556/8189/19693", checkedAt },
    ],
    note: "Служебное «Рассказы» заменено конкретными подтверждёнными книгами; год рождения сохранён без добавления дня, поскольку два выбранных сильных источника подтверждают именно год.",
  },
  {
    countryId: "kuwait",
    writerId: "taleb_al_refai",
    patch: {
      works: ["Тень солнца","Запах моря","Здесь"],
    },
    evidence: [
      { provider: "International Prize for Arabic Fiction", url: "https://archive.arabicfiction.org/en/Taleb-Alrefai-author", checkedAt },
      { provider: "International Writing Program, Университет Айовы", url: "https://iwp.uiowa.edu/writers/2012-resident/al-refai-taleb", checkedAt },
      { provider: "American University of Kuwait", url: "https://www.auk.edu.kw/media-hub/news/auk-hosts-taleb-al-refai-to-teach-creative-arabic-writing/", checkedAt },
    ],
    note: "Общая характеристика заменена проверяемой библиографической и профессиональной справкой; служебное «Романы» заменено названиями конкретных книг.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "aaly_tokombaev",
    patch: {
      deathDate: "1988-06-19",
      deathPlace: "Фрунзе, Киргизская ССР, СССР (ныне Бишкек, Кыргызстан)",
    },
    evidence: [
      { provider: "Большая российская энциклопедия", url: "https://old.bigenc.ru/literature/text/4195375", checkedAt },
      { provider: "Open.kg - биографический архив Кыргызстана", url: "https://open.kg/en/about-kyrgyzstan/famous-personalities/writers-kyrgyzstan/print%3Apage%2C1%2C31559-poet-prozaik-dramaturg-aaly-tokombaev-balka.html", checkedAt },
    ],
    note: "Исходная дата смерти 27 июня неверна; Большая российская энциклопедия указывает 19 июня 1988 года. Оценочная формула заменена жанровой и библиографической справкой.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "kalyk_akiev",
    patch: {
      birthDate: "1883",
      birthPlace: "Кулжыгач (ныне Түгөл-Сай), Джумгальский район, Нарынская область, Кыргызстан",
      works: ["Курманбек","Джаныш-Байыш"],
      coordinates: undefined,
    },
    evidence: [
      { provider: "Кыргызский центр энциклопедии и терминологии", url: "https://encyclopedia.edu.kg/index.php/%D0%9A%D0%90%D0%9B%D0%AB%D0%9A_%D0%90%D0%BA%D1%8B%D0%B5%D0%B2", checkedAt },
      { provider: "Open.kg - биографический архив Кыргызстана", url: "https://open.kg/about-kyrgyzstan/famous-personalities/kyrgyz-musicians/print%3Apage%2C1%2C1598-kalyk-akiev-18831953.html", checkedAt },
      { provider: "UNESCO ICHCAP", url: "https://archive.unesco-ichcap.org/eng/ek/sub1/pdf_file/central_asia/Kyrgyz_2011_02_Intangible_Cultural_Heritage_Inventory.pdf", checkedAt },
    ],
    note: "Точный день рождения 21 сентября не подтверждён выбранными авторитетными источниками и должен быть сокращён до 1883 года. Общее место рождения «Кыргызстан» уточнено, а жанровые заглушки заменены названиями записанных эпосов.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "kasym_tynystanov",
    patch: {
      birthPlace: "село Чырпыкты, Иссык-Кульская область",
      deathDate: "1938",
      works: ["Окуу куралы","Эне тил"],
    },
    evidence: [
      { provider: "Министерство образования и науки Кыргызской Республики - Билим булагы", url: "https://bb.edu.gov.kg/index.php/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7%D1%81%D0%BA%D0%B0%D1%8F_%D0%BB%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%82%D1%83%D1%80%D0%B0%3A_%D0%9B%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%82%D1%83%D1%80%D0%BD%D0%BE%D0%B5_%D0%BF%D1%83%D1%82%D0%B5%D1%88%D0%B5%D1%81%D1%82%D0%B2%D0%B8%D0%B5", checkedAt },
      { provider: "Национальная академия наук Кыргызской Республики", url: "https://naskr.gov.kg/ky/page/79/?page=33", checkedAt },
      { provider: "Кыргызский национальный университет имени Жусупа Баласагына", url: "https://vestnik.knu.kg/wp-content/uploads/2025/06/%D0%92%D0%B5%D1%81%D1%82%D0%BD%D0%B8%D0%BA-%D0%9A%D0%9D%D0%A3-%E2%84%961-2025...pdf", checkedAt },
    ],
    note: "Оценочная формула заменена конкретными ролями и проверяемыми названиями трудов. Выбранные источники уверенно подтверждают годы жизни, но не дают прямого архивного подтверждения точного дня смерти.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "musa_jangaziev",
    patch: {
      name: "Муса Жангазиев",
      years: "1921-1997",
      birthDate: "1921-03-23",
      deathDate: "1997",
      birthPlace: "село Кара-Сакал, Сокулукский район, Чуйская область",
      works: ["Балалык","Детям","Мой дом в золотой долине"],
    },
    evidence: [
      { provider: "Министерство образования и науки Кыргызской Республики - Билим булагы", url: "https://bb.edu.gov.kg/index.php/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7%D1%81%D0%BA%D0%B0%D1%8F_%D0%BB%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%82%D1%83%D1%80%D0%B0%3A_%D0%9B%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%82%D1%83%D1%80%D0%BD%D0%BE%D0%B5_%D0%BF%D1%83%D1%82%D0%B5%D1%88%D0%B5%D1%81%D1%82%D0%B2%D0%B8%D0%B5", checkedAt },
      { provider: "Российская государственная библиотека", url: "https://search.rsl.ru/ru/record/01006110399", checkedAt },
      { provider: "Национальная электронная библиотека России / Российская национальная библиотека", url: "https://rusneb.ru/catalog/000200_000018_RU_NLR_BIBL_A_012097803/", checkedAt },
    ],
    note: "Исходные годы 1930-2010 и обе технические даты 1 января относятся к ошибочной записи. Библиотечные и государственные источники согласуются на 1921-1997 годах и детской поэзии как важной части наследия.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "suranbay_eraliev",
    patch: {
      name: "Сүйүнбай Эралиев",
      fullName: "Süyünbay Eraliev",
      birthDate: "1921-10-15",
      deathDate: "2016-07-16",
      birthPlace: "село Уч-Эмчек, Таласская область",
    },
    evidence: [
      { provider: "Министерство образования и науки Кыргызской Республики - Билим булагы", url: "https://bb.edu.gov.kg/index.php/%D0%9A%D1%8B%D1%80%D0%B3%D1%8B%D0%B7%D1%81%D0%BA%D0%B0%D1%8F_%D0%BB%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%82%D1%83%D1%80%D0%B0%3A_%D0%9B%D0%B8%D1%82%D0%B5%D1%80%D0%B0%D1%82%D1%83%D1%80%D0%BD%D0%BE%D0%B5_%D0%BF%D1%83%D1%82%D0%B5%D1%88%D0%B5%D1%81%D1%82%D0%B2%D0%B8%D0%B5", checkedAt },
      { provider: "Портал государственных наград Кыргызской Республики", url: "https://nagrada.srs.kg/site/celebreties", checkedAt },
    ],
    note: "Исходное имя «Суранбай» и даты 1 января 1921 - 1 апреля 2016 ошибочны; также удалён неподтверждённый суперлатив.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "togolok_moldo",
    patch: {
      fullName: "Байымбет Абдрахман уулу (Тоголок Молдо)",
      birthDate: "1860",
      deathDate: "1942",
      birthPlace: "село Куртка, Ак-Талинский район",
      works: ["Манас (записанные варианты)"],
      genres: ["поэзия","басня","сказка","поэма","эпическая традиция"],
    },
    evidence: [
      { provider: "Министерство образования и науки Кыргызской Республики - Билим булагы", url: "https://bb.edu.gov.kg/index.php/%D0%A8%D0%B0%D0%B1%D0%BB%D0%BE%D0%BD%3AKGmapRU", checkedAt },
      { provider: "Российская государственная библиотека", url: "https://search.rsl.ru/ru/record/01006487563", checkedAt },
      { provider: "Национальная электронная библиотека России / Российская государственная библиотека", url: "https://rusneb.ru/catalog/000199_000009_001063214/", checkedAt },
    ],
    note: "Суперлативы заменены конкретными видами деятельности и жанрами. В институциональных источниках встречаются варианты русского написания фамилии и патронима; кыргызскую форму следует считать основной.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "tologon_kasymbekov",
    patch: {
      birthPlace: "село Ак-Жол, Аксыйский район, Джалал-Абадская область",
      works: ["Сынган кылыч","Келкел","Баскын","Кыргын"],
    },
    evidence: [
      { provider: "Национальная библиотека Кыргызской Республики имени Алыкула Осмонова", url: "https://nlkr.gov.kg/news/85-letie-geroya-kyrgyzskoj-respubliki-to/", checkedAt },
      { provider: "Портал государственных наград Кыргызской Республики", url: "https://nagrada.srs.kg/site/celebreties", checkedAt },
    ],
    note: "Оценочная формула заменена проверяемой жанровой характеристикой и названиями книг. Написание «Сынган кылыч» соответствует форме, используемой государственными источниками.",
  },
  {
    countryId: "kyrgyzstan",
    writerId: "tugolbai_sydykbekov",
    patch: {
      birthPlace: "село Кен-Суу, Тюпский район, Иссык-Кульская область",
      works: ["Кен-Суу","Темир","Люди наших дней"],
    },
    evidence: [
      { provider: "Портал государственных наград Кыргызской Республики", url: "https://nagrada.srs.kg/site/celebreties", checkedAt },
      { provider: "Кыргызская библиотечно-информационная сеть / Кыргызско-Российский Славянский университет", url: "https://arch.kyrlibnet.kg/uploads/KRSUKATSEVAS.27.pdf", checkedAt },
      { provider: "Жалал-Абадский государственный университет", url: "https://msk.edu.kg/wp-content/uploads/2020/04/Kyrgyz-adabiyaty-Usuvalieva-E.M..pdf", checkedAt },
    ],
    note: "Краткая исходная формула конкретизирована жанровой эволюцией и названиями произведений. Государственный источник поясняет, что день рождения был выбран самим писателем позднее, поэтому это не обычная метрическая дата.",
  },
  {
    countryId: "laos",
    writerId: "outhine_bounyavong",
    patch: {
      years: "1942-2000",
      birthDate: "1942",
      deathDate: "2000",
      birthPlace: "провинция Сайнябули, Лаос",
      works: ["Mother’s Beloved"],
    },
    evidence: [
      { provider: "Northern Illinois University - SEAsite", url: "https://seasite.niu.edu/lao/LaoLiterature/short_stories/motherBeloved/mother_author.htm", checkedAt },
      { provider: "University of Washington Press", url: "https://uwapress.uw.edu/book/9780295977362/mothers-beloved/", checkedAt },
      { provider: "Library of Congress", url: "https://blogs.loc.gov/international-collections/?p=13109", checkedAt },
    ],
    note: "Непроверяемый суперлатив удалён; общая формулировка о быте заменена данными конкретного издания и его тематикой. Используемые источники подтверждают годы, но не точные дни рождения и смерти.",
  },
  {
    countryId: "laos",
    writerId: "phoumi_vongvichit",
    patch: {
      years: "1909-1994",
      birthDate: "1909",
      deathDate: "1994",
      category: "политический деятель и автор политико-исторических трудов",
      genres: ["политическая история","публицистика","мемуары"],
      works: ["Laos and the Victorious Struggle of the Lao People against U.S. Neo-colonialism"],
    },
    evidence: [
      { provider: "Library of Congress - Federal Research Division", url: "https://tile.loc.gov/storage-services/master/frd/frdcstdy/la/laoscountrystudy00sava_0/laoscountrystudy00sava_0.pdf", checkedAt },
      { provider: "CiNii Books / National Institute of Informatics, Japan", url: "https://ci.nii.ac.jp/ncid/BB30166320", checkedAt },
      { provider: "Tokyo University of Foreign Studies Repository", url: "https://tufs.repo.nii.ac.jp/records/27139", checkedAt },
      { provider: "United Nations Digital Library", url: "https://digitallibrary.un.org/record/67459/files/S_SUPP_1981_4--%5EOR_SC_1981_IV%5E-EN.pdf", checkedAt },
    ],
    note: "Карточка ошибочно представляет государственного деятеля прежде всего писателем. Авторство политико-исторических книг подтверждается каталогами, но жанровая и профессиональная классификация должна отражать его основную деятельность.",
  },
  {
    countryId: "latvia",
    writerId: "andrejs_upits",
    patch: {
      works: ["Зелёная земля","Женщина","Золото"],
    },
    evidence: [
      { provider: "Объединение мемориальных музеев Латвии", url: "https://memorialiemuzeji.lv/en/personalities/andrejs-upits/", checkedAt },
      { provider: "Literatura.lv - Институт литературы, фольклора и искусства Латвийского университета", url: "https://www.literatura.lv/en/persons/andrejs-upits", checkedAt },
    ],
    note: "Суперлатив удалён, а жанровая характеристика дополнена документированной библиографией. Даты и Скривери подтверждены двумя латвийскими институциональными ресурсами.",
  },
  {
    countryId: "latvia",
    writerId: "aspazija",
    patch: {
      fullName: "Johanna Emīlija Lizete Rozenberga (Aspazija)",
      birthPlace: "Даукшас, Залениекская волость, Латвия",
      works: ["Sarkanās puķes","Серебряная вуаль (Sidraba šķidrauts)"],
    },
    evidence: [
      { provider: "Национальная энциклопедия Латвии", url: "https://enciklopedija.lv/skirklis/31832-Aspazija", checkedAt },
      { provider: "Объединение мемориальных музеев Латвии", url: "https://memorialiemuzeji.lv/en/personalities/aspazija/", checkedAt },
      { provider: "Национальная библиотека Латвии - Rainis un Aspazija", url: "https://runa.lnb.lv/en/142651/", checkedAt },
    ],
    note: "Оценочные формулы заменены проверяемыми ролями, именем и книгами. Текущее место рождения «Джуксте» не соответствует латвийской энциклопедической записи.",
  },
  {
    countryId: "latvia",
    writerId: "janis_jaunsudrabins",
    patch: {
      birthPlace: "Кродзини, Неретская волость",
      works: ["Белая книга"],
    },
    evidence: [
      { provider: "Национальная энциклопедия Латвии", url: "https://enciklopedija.lv/skirklis/36203-J%C4%81nis-Jaunsudrabi%C5%86%C5%A1", checkedAt },
      { provider: "Национальная библиотека Латвии - база деятелей книжного дела", url: "https://lgdb.lnb.lv/index/person/1718/", checkedAt },
      { provider: "Literatura.lv - Институт литературы, фольклора и искусства Латвийского университета", url: "https://www.literatura.lv/darbi/1570286", checkedAt },
    ],
    note: "Оценочное слово «знаменитой» заменено конкретной характеристикой формы книги. Роли автора расширены по латвийским институциональным источникам.",
  },
  {
    countryId: "latvia",
    writerId: "karlis_skalbe",
    patch: {
      deathDate: "1945-04-15",
      deathPlace: "Стокгольм, Швеция",
      birthPlace: "Инцены, Вецпиебалгская волость",
      works: ["Зимние сказки","Мельница котёнка (Kaķīša dzirnavas)"],
    },
    evidence: [
      { provider: "Национальная энциклопедия Латвии", url: "https://enciklopedija.lv/skirklis/97180-K%C4%81rlis-Skalbe", checkedAt },
      { provider: "Literatura.lv - Институт литературы, фольклора и искусства Латвийского университета", url: "https://www.literatura.lv/en/persons/karlis-skalbe", checkedAt },
    ],
    note: "Исходная биография была фактически верной, но слишком общей. Критическая ошибка находится в профиле: смерть наступила 15 апреля 1945 года, а не 14 апреля.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrectionBatch36[];
