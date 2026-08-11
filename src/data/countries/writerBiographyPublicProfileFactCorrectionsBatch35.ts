import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch35 = {
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

export const writerBiographyPublicProfileFactCorrectionsBatch35 = [
  {
    countryId: "japan",
    writerId: "ihara_saikaku",
    patch: {
      works: ["Мужчина, предавшийся любви","Пять женщин, предавшихся любви","Женщина, предавшаяся любви"],
    },
    evidence: [
      { provider: "Web NDL Authorities — National Diet Library of Japan", url: "https://id.ndl.go.jp/auth/ndlna/00269930", checkedAt },
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/saikaku-ihara/", checkedAt },
    ],
    note: "В текущем списке два названия передавали один и тот же роман Kōshoku ichidai otoko; список заменён тремя различными произведениями. Биография избавлена от расплывчатого жанрового ярлыка «городской реалистический роман».",
  },
  {
    countryId: "japan",
    writerId: "ishikawa_takuboku",
    patch: {
      birthPlace: "деревня Хиното (ныне Мориока), префектура Иватэ, Япония",
    },
    evidence: [
      { provider: "National Diet Library of Japan — Portraits of Modern Japanese Historical Figures", url: "https://www.ndl.go.jp/portrait/e/datas/6251", checkedAt },
      { provider: "Iwate Prefectural Library", url: "https://www.library.pref.iwate.jp/english/intro-t.html", checkedAt },
    ],
    note: "Исправлена русская передача названия префектуры «Иваитэ» на «Иватэ» и уточнено подтверждённое место рождения без изменения дат.",
  },
  {
    countryId: "japan",
    writerId: "kamo_no_chomei",
    patch: {
      years: "ок. 1153/1155–1216",
      birthPlace: "Киото, Япония",
      deathPlace: "Тоёма близ Киото, Япония",
      birthDate: "",
    },
    evidence: [
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/kamo-no-chomei/", checkedAt },
      { provider: "Web NDL Authorities — National Diet Library of Japan", url: "https://id.ndl.go.jp/auth/ndlna/00270230", checkedAt },
      { provider: "CiNii Research", url: "https://cir.nii.ac.jp/crid/1390282680262950528", checkedAt },
    ],
    note: "Точный год рождения спорен: NDL принимает 1153, Treccani — 1155. Поэтому ложная точность удалена, а диапазон и места сформулированы консервативно.",
  },
  {
    countryId: "japan",
    writerId: "kanae_minato",
    patch: {
      birthDate: "1973",
      birthPlace: "префектура Хиросима, Япония",
      works: ["Признания","Искупление"],
      awards: ["Премия японских книготорговцев 2009 года"],
    },
    evidence: [
      { provider: "Futabasha — официальный профиль автора", url: "https://fr.futabasha.co.jp/special/minatokanae/author/", checkedAt },
      { provider: "Japanese Book News — Japan Foundation", url: "https://www.bookmark.jpf.go.jp/media/2024/10/JBNPDF60.pdf", checkedAt },
      { provider: "Hachette UK", url: "https://www.hachette.co.uk/contributor/kanae-minato/", checkedAt },
    ],
    note: "Дата 1973-01-01 была неподтверждённой технической подстановкой: официальные профили публикуют только год. Удалены не подтверждённые в проверенных источниках названия «Пчелиная матка» и «Казнь», а ошибочная премия заменена документированной.",
  },
  {
    countryId: "japan",
    writerId: "kawabata_yasunari",
    patch: {
      birthDate: "1899-06-14",
    },
    evidence: [
      { provider: "Kawabata Yasunari Literature Museum / Ibaraki City", url: "https://www.city.ibaraki.osaka.jp/kikou/shimin/bunka/menu/kawabata/bungakuknnnituite/profilekawabata.html", checkedAt },
      { provider: "National Diet Library of Japan — Portraits", url: "https://www.ndl.go.jp/portrait/e/datas/6086/", checkedAt },
      { provider: "Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1968/kawabata/biographical/", checkedAt },
    ],
    note: "Два японских официальных источника указывают 14 июня, тогда как в текущей карточке стояло 11 июня. Для профильного поля принят согласованный японский музейно-библиотечный вариант; расхождение с частью международных справочников явно зафиксировано.",
  },
  {
    countryId: "japan",
    writerId: "keigo_higashino",
    patch: {
      years: "1958–2026",
      deathDate: "2026-07-23",
      works: ["Преданность подозреваемого X","Злодеяние","Чудеса магазина «Намия»"],
    },
    evidence: [
      { provider: "Kodansha", url: "https://www.kodansha.co.jp/notices", checkedAt },
      { provider: "Shinchosha — профиль автора", url: "https://www.shinchosha.co.jp/writer/2592/", checkedAt },
      { provider: "Macmillan", url: "https://academic.macmillan.com/author/keigohigashino/", checkedAt },
    ],
    note: "Карточка была устаревшей: смерть 23 июля 2026 года подтверждена издательством. Неподтверждённое название «Убийство в Белом доме» удалено, список заменён документированными произведениями.",
  },
  {
    countryId: "japan",
    writerId: "makoto_ooga",
    patch: {
      birthPlace: "Мисима, префектура Сидзуока, Япония",
      deathPlace: "Мисима, префектура Сидзуока, Япония",
      works: ["Kioku to genzai","Haru shōjo ni","Utage to koshin"],
    },
    evidence: [
      { provider: "Tokyo National Research Institute for Cultural Properties", url: "https://www.tobunken.go.jp/materials/bukko/824216.html", checkedAt },
      { provider: "Poetry International", url: "https://www.poetryinternational.com/en/poets-poems/article/104-3773_Welcome-to-Japanese-poetry-April-2006", checkedAt },
      { provider: "Japan Policy Forum", url: "https://www.japanpolicyforum.jp/culture/pt201707311316056959.html", checkedAt },
    ],
    note: "Токио в полях рождения и смерти был ошибочным: оба события документированы в Мисиме. Обобщающие заглушки в works заменены проверяемыми названиями.",
  },
  {
    countryId: "japan",
    writerId: "matsuo_basho",
    patch: {
      birthPlace: "Ига, префектура Миэ, Япония",
      works: ["По тропинкам Севера"],
    },
    evidence: [
      { provider: "Bashō Memorial Association, Iga", url: "https://www.basho-bp.jp/?page_id=16", checkedAt },
      { provider: "Web NDL Authorities — National Diet Library of Japan", url: "https://id.ndl.go.jp/auth/ndlna/00270778", checkedAt },
      { provider: "Government of Japan — Highlighting Japan", url: "https://www.gov-online.go.jp/eng/publicity/book/hlj/html/202205/202205_12_en.html", checkedAt },
    ],
    note: "«Путешествие на Северную дорогу» и «Тропы Севера» в текущем списке дублировали Oku no hosomichi; оставлено одно редакционно единообразное название. Место рождения уточнено до современного административного обозначения.",
  },
  {
    countryId: "japan",
    writerId: "mitsuyo_kakuta",
    patch: {
      works: ["Женщина на другом берегу","Цикада восьмого дня","Бумажная луна"],
    },
    evidence: [
      { provider: "Japan International Translation Competition / JLPP", url: "https://www.jlpp.go.jp/en/works/author02_10.html", checkedAt },
      { provider: "Japan Foundation — Worth Sharing", url: "https://www.worthsharing.jpf.go.jp/en/vol_1/tree-house/", checkedAt },
      { provider: "Japan Foundation Toronto", url: "https://tr.jpf.go.jp/event/writers-on-writing/", checkedAt },
    ],
    note: "Текущие названия «Дом на берегу», «Женщина в зеркале» и «Маленький дом» не совпадают с подтверждённой библиографией и частично относятся к другим авторам. Они заменены тремя документированными произведениями; год премии Наоки в карточке уже соответствует году вручения.",
  },
  {
    countryId: "japan",
    writerId: "murasaki_shikibu",
    patch: {
      years: "конец X — начало XI века",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
      coordinates: undefined,
    },
    evidence: [
      { provider: "Kyoto National Museum", url: "https://www.kyohaku.go.jp/eng/exhibitions/special/2026_genji/", checkedAt },
      { provider: "Columbia University — Asia for Educators", url: "https://afe.easia.columbia.edu/special/japan_600ce_genji.htm", checkedAt },
    ],
    note: "Годы ок. 973–ок. 1014 являются реконструкцией, а не установленными датами; профиль не должен показывать их как проверенный диапазон. Оценку «величайшее произведение» заменяет проверяемое авторство и исторический контекст.",
  },
  {
    countryId: "japan",
    writerId: "osamu_dazai",
    patch: {
      fullName: "Tsushima Shūji",
    },
    evidence: [
      { provider: "National Diet Library of Japan", url: "https://www.ndl.go.jp/portrait/e/datas/4149", checkedAt },
      { provider: "Goshogawara City", url: "https://www.city.goshogawara.lg.jp/kyouiku/bunka/dazai.html", checkedAt },
    ],
    note: "Исходные даты и произведения подтверждены; добавлено настоящее имя и убрана оценочная формула «один из самых известных».",
  },
  {
    countryId: "japan",
    writerId: "ryu_murakami",
    patch: {
      birthDate: "1952",
      works: ["Все оттенки голубого","Дети из камеры хранения","Пирсинг","Мисо-суп"],
    },
    evidence: [
      { provider: "Japan Literature Publishing Project", url: "https://www.jlpp.go.jp/en/works/author05_13.html", checkedAt },
      { provider: "Shinchosha", url: "https://www.shinchosha.co.jp/writer/2986/", checkedAt },
      { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/73150/ryu-murakami/", checkedAt },
    ],
    note: "Выбранные authoritative-профили подтверждают только год рождения, поэтому точный день 19 февраля не следует публиковать как проверенный. Название «Монстры» не сопоставлено с подтверждённой библиографией и заменено документированными романами.",
  },
  {
    countryId: "japan",
    writerId: "sachio_ito",
    patch: {
      birthDate: "1864-09-18",
      deathDate: "1913-07-30",
      birthPlace: "деревня Тонодай, провинция Кадзуса (ныне город Самму, префектура Тиба), Япония",
      works: ["Могила дикой хризантемы"],
    },
    evidence: [
      { provider: "National Diet Library of Japan", url: "https://www.ndl.go.jp/portrait/e/datas/6064", checkedAt },
      { provider: "Sammu City Board of Education", url: "https://www.city.sammu.lg.jp/kyouiku/bunkazai-rekishi/siryoukan/page001450.html", checkedAt },
    ],
    note: "Годовые заглушки заменяются точными подтверждёнными датами и местом рождения; служебное «Поэтические сборники» заменяется конкретным произведением.",
  },
  {
    countryId: "japan",
    writerId: "shotaro_yasuoka",
    patch: {
      works: ["Inki na tanoshimi","Warui nakama","Kaihen no kōkei"],
    },
    evidence: [
      { provider: "Japan Literature Publishing Project", url: "https://www.jlpp.go.jp/en/works/author02_39.html", checkedAt },
      { provider: "Shinchosha", url: "https://www.shinchosha.co.jp/writer/3071/", checkedAt },
    ],
    note: "Названия «Слабый человек» и «Смертельный путь» не подтверждены источниками и заменяются названиями документированных произведений в латинской транслитерации, пока не будет установлено русское издание.",
  },
  {
    countryId: "japan",
    writerId: "shusaku_endo",
    patch: {
      works: ["Море и яд","Молчание","Самурай","Глубокая река"],
    },
    evidence: [
      { provider: "Endo Shusaku Literary Museum, Nagasaki City", url: "https://www.city.nagasaki.lg.jp/site/endou/6678.html", checkedAt },
      { provider: "Shinchosha", url: "https://www.shinchosha.co.jp/writer/977/?template=L", checkedAt },
    ],
    note: "Даты и места подтверждены; оценочная иерархия заменена содержательным описанием, а список произведений дополнен проверенными романами.",
  },
  {
    countryId: "japan",
    writerId: "yasushi_inoue",
    patch: {
      works: ["Охотничье ружьё","Бой быков","Дуньхуан","Лоулань"],
    },
    evidence: [
      { provider: "Hokkaido Government — Red Brick Office Exhibition Guide", url: "https://akarenga-exhibitionguide.pref.hokkaido.lg.jp/archives/predecessors/62/", checkedAt },
      { provider: "Yasushi Inoue Memorial Hall", url: "https://www.inoue.abs-tomonokai.jp/biography", checkedAt },
      { provider: "Japan Literature Publishing Project", url: "https://www.jlpp.go.jp/en/works/author02_05.html", checkedAt },
    ],
    note: "Исходное «Охота» неточно передаёт название Ryōjū; «Мечта о Китае» не сопоставлена с подтверждённой библиографией и заменена документированными произведениями.",
  },
  {
    countryId: "japan",
    writerId: "yosa_buson",
    patch: {
      birthPlace: "деревня Кэма, провинция Сэтцу (ныне район Миякодзима, Осака), Япония",
      works: ["Shin hana tsumi","Yahan raku","Tamamo shu"],
    },
    evidence: [
      { provider: "Osaka City, Miyakojima Ward", url: "https://www.city.osaka.lg.jp/miyakojima/page/0000083259.html", checkedAt },
      { provider: "Kyoto National Museum", url: "https://www.kyohaku.go.jp/old/eng/theme/floor2_4/past/2016_buson.html", checkedAt },
      { provider: "Japan Search", url: "https://jpsearch.go.jp/en/gallery/ndl-DMVvnVqP2ZHbK0", checkedAt },
    ],
    note: "Разница 1783/1784 объясняется датой смерти в двенадцатом месяце Тэммэй 3 и её григорианским соответствием 1784 году; текущую григорианскую дату можно сохранить. Родина уточнена, а служебные жанровые подписи заменены названиями книг.",
  },
  {
    countryId: "japan",
    writerId: "yosano_akiko",
    patch: {
      works: ["Спутанные волосы","Не отдавай жизнь, любимый","Новое переложение «Повести о Гэндзи»"],
    },
    evidence: [
      { provider: "National Diet Library of Japan", url: "https://www.ndl.go.jp/portrait/e/datas/347", checkedAt },
      { provider: "Sakai City", url: "https://www.city.sakai.lg.jp/foreign-language/english/visitors/about/historicfigures/yosanoakiko.html", checkedAt },
    ],
    note: "Список произведений нормализован: неопределённые «Песня о любви» и «Современные женщины» заменены документированными текстами; оценочная иерархия убрана.",
  },
  {
    countryId: "japan",
    writerId: "yoshida_kenko",
    patch: {
      years: "конец XIII — середина XIV века",
      birthDate: "",
      deathDate: "",
      birthPlace: "",
      deathPlace: "",
      coordinates: undefined,
    },
    evidence: [
      { provider: "Japan Search", url: "https://jpsearch.go.jp/en/gallery/ndl-XjR7MlEdAv4", checkedAt },
      { provider: "Suntory Museum of Art", url: "https://www.suntory.com/sma/exhibition/2014_3/display.html", checkedAt },
      { provider: "National Diet Library of Japan Authorities", url: "https://id.ndl.go.jp/auth/ndlna/00272639", checkedAt },
    ],
    note: "Источники расходятся между 1282–1350 и ок. 1283 — после 1352; точный диапазон 1283–1352 не следует публиковать как установленный. Места рождения и смерти надёжно не подтверждены.",
  },
  {
    countryId: "japan",
    writerId: "yukio_mishima",
    patch: {
      works: ["Исповедь маски","Золотой храм","Запретные цвета","Весенний снег","Несущие кони","Храм рассвета","Падение ангела"],
    },
    evidence: [
      { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/20849/yukio-mishima/", checkedAt },
      { provider: "The Japan Foundation / Japanese Book News", url: "https://www.bookmark.jpf.go.jp/media/2024/10/JBNPDF47.pdf", checkedAt },
      { provider: "National Diet Library, Japan", url: "https://ndlsearch.ndl.go.jp/books/R100000002-I000003232837", checkedAt },
    ],
    note: "Оценочная формула об известности заменена проверяемой библиографией. Текущее название «Запретные удовольствия» не соответствует роману «Forbidden Colors» и должно быть исправлено на «Запретные цвета».",
  },
  {
    countryId: "jordan",
    writerId: "ghalib_halasa",
    patch: {
      name: "Галиб Халаса",
      years: "1932–1989",
      birthDate: "1932",
      deathDate: "1989",
      birthPlace: "Маин, близ Мадабы, Иордания",
      works: ["Sultana"],
    },
    evidence: [
      { provider: "Министерство культуры Иордании", url: "https://www.culture.gov.jo/AR/ListDetails/%D8%AC%D9%88%D8%A7%D8%A6%D8%B2_%D8%A7%D9%84%D8%AF%D9%88%D9%84%D8%A9_%D8%A7%D9%84%D8%AA%D9%82%D8%AF%D9%8A%D8%B1%D9%8A%D8%A9_%D9%88%D8%A7%D9%84%D8%AA%D8%B4%D8%AC%D9%8A%D8%B9%D9%8A%D8%A9/92/19", checkedAt },
      { provider: "Mazda Publishers", url: "https://www.mazdapublishers.com/book/sultana", checkedAt },
    ],
    note: "Суперлатив удалён. Текущие даты 1932-12-27 и 1989-10-25 расходятся с доступными справочными версиями и не подтверждены выбранными институциональными источниками; русское имя следует нормализовать с «Халса» на «Халаса».",
  },
  {
    countryId: "jordan",
    writerId: "ibrahim_nasrallah",
    patch: {
      birthDate: "1954",
      nationality: "палестино-иорданская",
      works: ["Время белых лошадей","The Second Dog War"],
      awards: ["Международная премия арабской литературы, 2018"],
    },
    evidence: [
      { provider: "International Prize for Arabic Fiction", url: "https://archive.arabicfiction.org/en/node/67", checkedAt },
      { provider: "The American University in Cairo Press", url: "https://aucpress.com/9781617971754/", checkedAt },
      { provider: "International Prize for Arabic Fiction", url: "https://archive.arabicfiction.org/en/node/1328", checkedAt },
    ],
    note: "Оценочный суперлатив заменён сведениями о происхождении, жанрах, книге и награде. Выбранные источники подтверждают год рождения, но не точный день 2 декабря.",
  },
  {
    countryId: "jordan",
    writerId: "munif_al_razzaz",
    patch: {
      category: "политический мыслитель и публицист",
      genres: ["политическая мысль","эссе","публицистика"],
      works: ["Развитие значения национализма","Горький опыт"],
    },
    evidence: [
      { provider: "The National Library of Israel", url: "https://www.nli.org.il/en/books/NNL_ALEPH990021602560205171/NLI", checkedAt },
      { provider: "Cambridge University Press", url: "https://www.cambridge.org/core/journals/modern-intellectual-history/article/metaphysical-universe-of-michel-aflaq-and-his-party-a-reappraisal-of-the-bath/265B91D651F7AF2CAB6C513D57A66173", checkedAt },
      { provider: "Sharjah Art Foundation", url: "https://www.sharjahart.org/en/resources/collections/details/munif-al-razzaz/", checkedAt },
    ],
    note: "Карточка ошибочно создаёт впечатление о художественном писателе; Муниф ар-Раззаз известен прежде всего как политический мыслитель и автор политических трудов. Его нельзя смешивать с сыном Мунисом ар-Раззазом, иорданским романистом.",
  },
  {
    countryId: "jordan",
    writerId: "mustafa_wahbi_al_tal_arar",
    patch: {
      aliases: ["Арар"],
      works: ["Вечера в Вади аль-Ябис","Рубаи Омара Хайяма (перевод)"],
    },
    evidence: [
      { provider: "Министерство культуры Иордании", url: "https://culture.gov.jo/AR/ListDetails/____%D8%B1%D9%88%D8%A7%D8%AF_%D8%A7%D9%84%D8%AD%D8%B1%D9%83%D8%A9_%D8%A7%D9%84%D8%AB%D9%82%D8%A7%D9%81%D9%8A%D8%A9_%D9%81%D9%8A_%D8%A7%D9%84%D8%A3%D8%B1%D8%AF%D9%86/114/10", checkedAt },
      { provider: "Yarmouk University", url: "https://www.yu.edu.jo/index.php/newarcat/4423-2023-06-04-12-31-13", checkedAt },
    ],
    note: "Суперлатив и статусная формула заменены проверяемыми сведениями о псевдониме, книге и переводческой работе.",
  },
  {
    countryId: "jordan",
    writerId: "zuleikha_abu_risha",
    patch: {
      works: ["Ghajarul ma’a"],
      birthDate: "",
      birthPlace: "",
    },
    evidence: [
      { provider: "Abdul Hameed Shoman Foundation", url: "https://shoman.org/en/Latest-News/ArticleID/4175/en/zuleikha-abu-risha-seagulls-want-clear-ideas-launch-shoman", checkedAt },
      { provider: "Darat al Funun / Khalid Shoman Foundation", url: "https://daratalfunun.org/?event=book-launch-and-conversation-the-smell-of-zinco", checkedAt },
      { provider: "Banipal Magazine of Modern Arab Literature", url: "https://www.banipal.co.uk/contributors/contributor.cfm?contributor_id=105", checkedAt },
    ],
    note: "Исходная биография верна, но слишком кратка. Выбранные источники не подтверждают год и место рождения, поэтому они намеренно не включены в публикуемый текст.",
  },
  {
    countryId: "kazakhstan",
    writerId: "abai_qunanbaiuly",
    patch: {
      name: "Абай Кунанбайулы",
      aliases: ["Абай Кунанбаев"],
      works: ["Стихотворения","Слова назидания"],
    },
    evidence: [
      { provider: "Abai Institute", url: "https://oq.gov.kz/en/abai/abai-bio", checkedAt },
      { provider: "Library of Congress", url: "https://www.loc.gov/item/2021666152", checkedAt },
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/ru/kazakhstanika/show/9819", checkedAt },
    ],
    note: "Панегирические эпитеты заменены проверяемым описанием роли и состава наследия. Русская форма имени приведена ближе к казахской персональной форме.",
  },
  {
    countryId: "kazakhstan",
    writerId: "abdizhamil_nurpeisov",
    patch: {
      works: ["Кровь и пот (трилогия)","Последний долг"],
      awards: ["Государственная премия СССР за трилогию «Кровь и пот», 1974"],
    },
    evidence: [
      { provider: "Акимат Кызылординской области", url: "https://www.gov.kz/memleket/entities/kyzylorda/press/news/details/322271?lang=ru", checkedAt },
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/en/calendar/show/27587", checkedAt },
      { provider: "Национальная академическая библиотека Республики Казахстан", url: "https://nabrk.kz/kk/e-catalog?country_edition=&language=rus&page=7&publication_type=0&title_first_letter=%D0%9A&topic=8", checkedAt },
    ],
    note: "Суперлатив заменён фактами о биографии и двух крупных произведениях. Текущая карточка не отражает «Последний долг» и связь прозы с Аральским морем.",
  },
  {
    countryId: "kazakhstan",
    writerId: "akhmet_baitursynov",
    patch: {
      name: "Ахмет Байтурсынулы",
      aliases: ["Ахмет Байтурсынов"],
      birthDate: "1872-09-05",
      birthPlace: "Сартубек, Тургайский уезд, Российская империя",
      works: ["Оқу құралы","Маса"],
    },
    evidence: [
      { provider: "Правительство Республики Казахстан", url: "https://www.gov.kz/memleket/entities/mfa-budapest/press/article/details/74563?lang=en", checkedAt },
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/kz/history-of-kazakhstan/show/9024", checkedAt },
      { provider: "Правительство Республики Казахстан / юбилейный проект ЮНЕСКО", url: "https://www.gov.kz/memleket/entities/mfa-helsinki/press/news/details/338208?lang=en", checkedAt },
    ],
    note: "Текущая дата рождения 1872-01-05 ошибочна. В официальных публикациях встречаются календарные расхождения, но современная государственная памятная дата — 5 сентября 1872 года; суперлатив заменён конкретными трудами.",
  },
  {
    countryId: "kazakhstan",
    writerId: "dulat_isabekov",
    patch: {
      years: "1942–2025",
      deathDate: "2025-02-22",
      birthPlace: "село Ленинский путь, Арысский район, Южно-Казахстанская область",
      works: ["Гаухартас","Дермене","Каргын","Старшая сестра"],
    },
    evidence: [
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/kz/news/show/50000084", checkedAt },
      { provider: "Министерство культуры и информации Республики Казахстан", url: "https://www.gov.kz/memleket/entities/mam/press/news/details/912063?lang=ru", checkedAt },
      { provider: "Cambridge University Press", url: "https://www.cambridge.org/sites/default/files/media/documents/Kazakh_Prose_Book_PRINT-no-crops-1.pdf", checkedAt },
    ],
    note: "Карточка устарела: писатель умер в феврале 2025 года. Краткое описание расширено проверяемой библиографией без оценочных формул.",
  },
  {
    countryId: "kazakhstan",
    writerId: "ilyas_zhansugurov",
    patch: {
      works: ["Кюй","Кюйши","Кулагер"],
      genres: ["поэзия","проза","драматургия","перевод"],
    },
    evidence: [
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/ru/prominent-figures/show/12627", checkedAt },
      { provider: "Национальная государственная книжная палата Республики Казахстан", url: "https://kitap-palatasy.gov.kz/personal/20?lang=3", checkedAt },
      { provider: "Национальная академическая библиотека Республики Казахстан", url: "https://nabrk.kz/FileStore/dataFiles/a3/31/97379/content/pdf24.pdf?isPortal=true&key=af241e56750ec98f8d3fa7f3dd4e3fd9&time=1770231143347", checkedAt },
    ],
    note: "Оценочные слова удалены, а описание дополнено жанрами, должностью, произведениями и обстоятельствами смерти. Текущая дата смерти подтверждена документом о расстреле.",
  },
  {
    countryId: "kazakhstan",
    writerId: "magzhan_zhumabayev",
    patch: {
      birthPlace: "урочище Сасыкколь, Петропавловский уезд, Российская империя",
      works: ["Шолпан","Батыр Баян","Педагогика"],
    },
    evidence: [
      { provider: "Акимат Северо-Казахстанской области", url: "https://www.gov.kz/memleket/entities/sko-madeniet/press/article/details/37711", checkedAt },
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/ru/kazakhstanika/show/10215", checkedAt },
      { provider: "Национальная академическая библиотека Республики Казахстан", url: "https://nabrk.kz/index.php/ru/e-catalog?catalog=6&country_edition=UZ&sphere=8&title_first_letter=%D3%A8&topic=0", checkedAt },
    ],
    note: "Суперлатив заменён сведениями о жанрах, общественной деятельности и конкретных книгах. Точные даты текущей карточки подтверждаются официальным региональным источником.",
  },
  {
    countryId: "kazakhstan",
    writerId: "mukhtar_auyezov",
    patch: {
      birthPlace: "урочище Каскабулак, Чингизская волость, Семипалатинская область",
      works: ["Путь Абая (четырёхтомная эпопея)","Енлик-Кебек"],
      genres: ["роман","драматургия","литературоведение","фольклористика"],
    },
    evidence: [
      { provider: "Qazaqstan Tarihy", url: "https://e-history.kz/en/prominent-figures/show/12712", checkedAt },
      { provider: "Правительство Республики Казахстан", url: "https://www.gov.kz/memleket/entities/mfa-doha/press/article/details/88261", checkedAt },
      { provider: "UNESCO Digital Library", url: "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_f105a696-693f-480d-98f7-c7445bf0fb5e?_=101803eng.pdf", checkedAt },
    ],
    note: "Суперлативы удалены; описание расширено точными жанрами, произведениями и исследовательской работой.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrectionBatch35[];
