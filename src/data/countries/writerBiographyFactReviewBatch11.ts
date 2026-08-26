export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH11_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 11";

export type WriterBiographyFactReviewDecision =
  | "unchanged"
  | "corrected"
  | "held";

export type WriterBiographyClaimVerdict =
  | "supported"
  | "corrected"
  | "not-established";

export interface WriterBiographyClaimEvidence {
  readonly provider: string;
  readonly url: string;
  readonly checkedAt: string;
  readonly findingRu: string;
}

export interface WriterBiographyFactReviewClaim {
  readonly textRu: string;
  readonly verdict: WriterBiographyClaimVerdict;
  readonly evidence: readonly WriterBiographyClaimEvidence[];
}

export interface WriterBiographyFactReviewRecord {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly applicableTextRu: string | null;
  readonly claims: readonly WriterBiographyFactReviewClaim[];
  readonly reviewer: string;
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const checkedAt = "2026-08-09";
const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH11_REVIEWER;

type EvidenceTuple = readonly [
  provider: string,
  url: string,
  findingRu: string,
];

const evidenceByAuthor = {
  narekatsi: [
    ["Первопрестольный Святой Эчмиадзин", "https://www.armenianchurch.org/en/news/new-publication-27/10806", "Официальная публикация Армянской апостольской церкви подтверждает авторство Григора Нарекаци и название «Книги скорбных песнопений» («Книги плача»)."],
    ["Святой Престол", "https://www.vatican.va/news_services/liturgy/libretti/2015/20150412-libretto-messa-armeni.pdf", "Ватиканская справка характеризует Григора Нарекаци как армянского монаха, поэта, богослова и мистика и атрибутирует ему «Книгу скорбных песнопений»."],
  ],
  tumanyan: [
    ["ЮНЕСКО", "https://www.unesco.org/en/articles/hovhannes-tumanyan-passion-storytelling", "Материал ЮНЕСКО подтверждает армянское происхождение Туманяна и его работу в поэзии, сказке и прозаическом повествовании."],
    ["Центральный банк Армении", "https://www.cba.am/en/collector-coins/303/", "Официальная памятная справка перечисляет поэмы, баллады, сказки и рассказы Туманяна."],
  ],
  abgaryan: [
    ["Национальная литературная премия «Большая книга»", "https://bigbook.ru/person/abgaryan-narine", "Премиальная справка подтверждает место и дату рождения Наринэ Абгарян и библиографию, включая цикл «Манюня» и роман «С неба упали три яблока»."],
    ["Издательство АСТ", "https://ast.ru/book/s-neba-upali-tri-yabloka-832813/", "Издатель называет Абгарян современной российской писательницей армянского происхождения и подтверждает авторство указанных книг."],
  ],
  sayatNova: [
    ["Первопрестольный Святой Эчмиадзин", "https://www.armenianchurch.org/en/videos/vardaton-in-the-armenian-diocese-of-georgia/597", "Армянская апостольская церковь подтверждает армянскую поэтическую и ашугскую традицию Саят-Новы."],
    ["Национальная парламентская библиотека Грузии", "https://dspace.nplg.gov.ge/bitstream/1234/352385/1/Armenian_Georgian_Relations.pdf", "Институциональное издание документирует песни Саят-Новы на армянском, грузинском и азербайджанском языках."],
  ],
  wright: [
    ["Мельбурнский университет", "https://www.unimelb.edu.au/newsroom/news/2024/august/university-of-melbourne-confers-honorary-doctorate-to-waanyi-writer-dr-alexis-wright", "Университет подтверждает принадлежность Алексис Райт к народу вааньи, авторство «Карпентарии» и «Praiseworthy» и получение обоими романами премии Майлз Франклин."],
    ["Университет Западного Сиднея", "https://www.westernsydney.edu.au/news-centre/stories/2023/internationally-acclaimed-author-alexis-wright-releases-ground-breaking-new-novel", "Университетская справка независимо подтверждает идентичность писательницы, принадлежность к народу вааньи и библиографию романов."],
  ],
  paterson: [
    ["Австралийский биографический словарь, Австралийский национальный университет", "https://adb.anu.edu.au/biography/tucker-thomas-george-8869/paterson-andrew-barton-banjo-7972", "Национальная биографическая статья подтверждает работу Патерсона поэтом, прозаиком и журналистом и авторство «The Man from Snowy River» и «Waltzing Matilda»."],
    ["Национальная библиотека Австралии", "https://catalogue.nla.gov.au/catalog/3546045", "Каталог национальной библиотеки атрибутирует текст «Waltzing Matilda» Эндрю Бартону Патерсону."],
  ],
  pascoe: [
    ["Австралийский национальный университет", "https://www.anu.edu.au/events/meet-the-author-bruce-pascoe", "Университетская справка подтверждает писательскую деятельность Брюса Паско и библиографию, включая «Dark Emu» и «Young Dark Emu»."],
    ["Magabala Books", "https://www.magabala.com/products/young-dark-emu-a-truer-history", "Издатель подтверждает работу Паско в художественной и документальной прозе, поэзии, эссеистике и детской литературе и авторство обеих книг."],
  ],
  stead: [
    ["Австралийский биографический словарь, Австралийский национальный университет", "https://adb.anu.edu.au/biography/stead-christina-ellen-15545", "Национальная биографическая статья подтверждает австралийскую идентичность Кристины Стед и её работу в романах и рассказах."],
    ["Государственная библиотека Нового Южного Уэльса", "https://www.sl.nsw.gov.au/awards/nsw-literary-awards/christina-stead-prize-fiction", "Библиотека подтверждает, что Стед была австралийской романисткой и автором рассказов, и атрибутирует ей роман «Человек, который любил детей» 1940 года."],
  ],
  clavell: [
    ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/5096/james-clavell/", "Издатель подтверждает рождение Джеймса Клавелла в Сиднее, его работу романистом, сценаристом, режиссёром и продюсером и цикл «Азиатская сага»."],
    ["Американская телевизионная академия", "https://www.televisionacademy.com/bios/james-clavell", "Официальная премиальная запись подтверждает роль Клавелла как исполнительного продюсера экранизации «Сёгуна» и связь произведения с его именем."],
  ],
  grenville: [
    ["Государственная библиотека Нового Южного Уэльса", "https://archival.sl.nsw.gov.au/Details/archive/110332353", "Архивная опись подтверждает австралийскую идентичность Кейт Гренвилл и документирует исследование и создание исторического романа «Тайная река»."],
    ["Text Publishing", "https://www.textpublishing.com.au/authors/kategrenville", "Издатель подтверждает авторство Гренвилл исторических романов о колониальной Австралии, включая «Тайную реку», «Лейтенанта» и «Комнату из листьев»."],
  ],
  zusak: [
    ["Государственная библиотека Нового Южного Уэльса", "https://www.sl.nsw.gov.au/whats/recorded-events/author-talks/nicole-abadee-conversation-markus-zusak", "Библиотека подтверждает австралийскую писательскую идентичность Маркуса Зусака, международный успех «Книжного вора» и переводы более чем на пятьдесят языков."],
    ["Penguin Books Australia", "https://www.penguin.com.au/authors/markus-zusak", "Издатель независимо атрибутирует Маркусу Зусаку роман «Книжный вор» и другие книги."],
  ],
  franklin: [
    ["Австралийский биографический словарь, Австралийский национальный университет", "https://adb.anu.edu.au/biography/franklin-miles-6235", "Национальная биографическая статья подтверждает, что Майлз Франклин была австралийской писательницей и автором «Моей блестящей карьеры»."],
    ["Премия Майлз Франклин", "https://cms-prd.milesfranklin.com.au/globalassets/_au-site-media/01-documents/03-wealth-management/03-campaign/mfla/2024/2024-award-guidelines.pdf", "Официальные правила премии подтверждают её учреждение по завещанию писательницы Стеллы Марии Сары Майлз Франклин, автора «Моей блестящей карьеры»."],
  ],
  park: [
    ["Государственная библиотека Нового Южного Уэльса", "https://archival.sl.nsw.gov.au/Details/archive/110328426", "Архивная опись фиксирует рождение Рут Парк 24 августа 1917 года в Окленде, её писательскую работу и создание романа «The Harp in the South» о Сиднее."],
    ["Te Ara - Энциклопедия Новой Зеландии", "https://teara.govt.nz/mi/1966/expatriates-biographies/page-3", "Национальная энциклопедия независимо подтверждает дату и место рождения Парк, её журналистскую карьеру и работу романисткой."],
  ],
  hayes: [
    ["Penguin Books Australia", "https://www.penguin.com.au/authors/terry-hayes", "Издатель подтверждает работу Терри Хейса писателем и сценаристом, авторство «Я - Пилигрим» и его участие в сценарии фильма «Безумный Макс 2»."],
    ["ACMI - Австралийский музей экранной культуры", "https://www.acmi.net.au/stories-and-ideas/how-they-filmed-road-warriors-chase-scene/", "Национальный музей экранной культуры независимо идентифицирует Хейса как журналиста и сценариста, работавшего с Джорджем Миллером над «Безумным Максом 2»."],
  ],
  schnitzler: [
    ["Австрийская национальная библиотека", "https://data.onb.ac.at/nlv_lex/perslex/Sch/Schnitzler_Arthur.html", "Литературный архив подтверждает, что Артур Шницлер был австрийским писателем и драматургом венской эпохи модерна."],
    ["Австрийская академия наук", "https://www.oeaw.ac.at/acdh/oebl/biographien-des-monats/2022/mai", "Академическая биография независимо связывает Шницлера с литературным модернизмом и документирует его прозу и драматургию."],
  ],
  kehlmann: [
    ["Rowohlt Verlag", "https://www.rowohlt.de/autor/daniel-kehlmann-1390", "Издатель подтверждает идентичность Даниэля Кельмана и его романы «Die Vermessung der Welt» и «Tyll»."],
    ["Goethe-Institut", "https://www.goethe.de/ins/in/en/kul/lak/art/27002128.html", "Гёте-Институт характеризует Кельмана как немецко-австрийского автора и подтверждает авторство «Измеряя мир»."],
  ],
  canetti: [
    ["Нобелевская премия", "https://www.nobelprize.org/prizes/literature/1981/canetti/biographical/", "Официальная биография подтверждает немецкоязычные произведения «Ослепление» и «Масса и власть» и Нобелевскую премию 1981 года."],
    ["Австрийская национальная библиотека", "https://www.onb.ac.at/museen/literaturmuseum/kalender/elias-canetti-fuer-die-gegenwart", "Литературный музей независимо подтверждает писательскую и эссеистическую работу Канетти, указанные произведения и статус нобелевского лауреата."],
  ],
  rilke: [
    ["Fondation Rilke", "https://www.fondationrilke.ch/en/decouvrir", "Фонд наследия подтверждает рождение Рильке в Праге, его поэтическую и прозаическую работу, «Дуинские элегии» и «Записки Мальте Лауридса Бригге»."],
    ["Goethe-Institut", "https://www.goethe.de/ins/ee/de/kul/ser/uak/per.cfm?personId=637", "Гёте-Институт независимо определяет Рильке как немецкоязычного писателя и поэта и атрибутирует ему оба произведения."],
  ],
  musil: [
    ["Австрийская национальная библиотека", "https://data.onb.ac.at/nlv_lex/perslex/M/Musil_Robert.htm", "Литературный архив подтверждает работу Роберта Музиля австрийским писателем и эссеистом и незавершённость романа «Человек без свойств»."],
    ["Университет Клагенфурта, Институт Роберта Музиля", "https://www.aau.at/musil/literaturforschung/musilforschung/", "Профиль специализированного института независимо подтверждает авторство и незавершённый статус «Человека без свойств»."],
  ],
  zweig: [
    ["Австрийская национальная библиотека", "https://data.onb.ac.at/nlv_lex/perslex/XZ/Zweig_Stefan.htm", "Литературный архив подтверждает, что Стефан Цвейг был австрийским писателем и автором эссе и биографических произведений."],
    ["Центр Стефана Цвейга Зальцбургского университета", "https://stefan-zweig-zentrum.at/stefan-zweig/leben-werke", "Официальный центр наследия независимо документирует новеллы, эссе и исторические биографии Цвейга."],
  ],
} as const satisfies Record<string, readonly EvidenceTuple[]>;

type ReviewInput = {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly sourceKey: keyof typeof evidenceByAuthor;
  readonly claims: readonly {
    readonly textRu: string;
    readonly verdict: WriterBiographyClaimVerdict;
  }[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
};

const inputs: readonly ReviewInput[] = [
  {
    key: "armenia:grigor_narekatsi",
    originalSha256: "406c809b4679958bed19d2b81551f4c09ff97cc80f848900cfd0693d7e90e133",
    reviewedTextRu: "Армянский поэт, богослов и христианский мистик X века. Автор «Книги скорбных песнопений».",
    sourceKey: "narekatsi",
    claims: [
      { textRu: "Григор Нарекаци был армянским поэтом, богословом и христианским мистиком X века.", verdict: "corrected" },
      { textRu: "Нарекаци - автор «Книги скорбных песнопений».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив и сравнительная оценка произведения заменены профессиональными ролями, эпохой и подтверждённым названием книги.",
  },
  {
    key: "armenia:hovhannes_tumanyan",
    originalSha256: "8f24bf59f0a85a27eb303fe98f044d0d933ba5a989cd096940456c6191fadecb",
    reviewedTextRu: "Армянский поэт и прозаик, автор поэм, баллад, сказок и рассказов.",
    sourceKey: "tumanyan",
    claims: [{ textRu: "Ованес Туманян был армянским поэтом и прозаиком и писал поэмы, баллады, сказки и рассказы.", verdict: "corrected" }],
    decision: "corrected",
    notes: "Неоформленный титул «национальный поэт» заменён институционально подтверждёнными ролями и жанрами.",
  },
  {
    key: "armenia:narine_abgaryan",
    originalSha256: "31b800052b944af185697289b7f7157aa572def47e8536ad10b8db4c87a0b6f2",
    reviewedTextRu: "Российская писательница армянского происхождения, автор цикла «Манюня» и романа «С неба упали три яблока».",
    sourceKey: "abgaryan",
    claims: [{ textRu: "Наринэ Абгарян - российская писательница армянского происхождения, автор цикла «Манюня» и романа «С неба упали три яблока».", verdict: "corrected" }],
    decision: "corrected",
    notes: "Расплывчатое тематическое описание заменено точной литературной принадлежностью и двумя подтверждёнными произведениями.",
  },
  {
    key: "armenia:sayat_nova",
    originalSha256: "8785c640f4020a5d0b8ee33b29dd6676a98cec20681ef1bdcc0a693bd33f3e91",
    reviewedTextRu: "Армянский поэт и ашуг XVIII века. Писал и исполнял песни на армянском, грузинском и азербайджанском языках.",
    sourceKey: "sayatNova",
    claims: [
      { textRu: "Саят-Нова был армянским поэтом и ашугом XVIII века.", verdict: "corrected" },
      { textRu: "Он писал и исполнял песни на армянском, грузинском и азербайджанском языках.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Суперлатив снят; профессиональная роль, эпоха и три языка творчества сохранены и подтверждены.",
  },
  {
    key: "australia:alexis_wright",
    originalSha256: "bc14006ac8732e1ce2d27af39f42f7059b505a6c481326f748d3377697ff0c30",
    reviewedTextRu: "Австралийская писательница народа вааньи, автор романов «Карпентария» и «Praiseworthy». Оба романа получили премию Майлз Франклин.",
    sourceKey: "wright",
    claims: [
      { textRu: "Алексис Райт - австралийская писательница народа вааньи и автор романов «Карпентария» и «Praiseworthy».", verdict: "corrected" },
      { textRu: "Оба названных романа получили премию Майлз Франклин.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Обобщённые темы заменены двумя произведениями и официально подтверждёнными наградами.",
  },
  {
    key: "australia:banjo_paterson",
    originalSha256: "549049b842c1c32c99999a3a69a8d3f2801d9f522e6e65571c45cd43bc5b2aa5",
    reviewedTextRu: "Австралийский поэт, прозаик и журналист, автор баллады «Человек со Снежной реки» и текста песни «Вальсирующая Матильда».",
    sourceKey: "paterson",
    claims: [{ textRu: "Банджо Патерсон был австралийским поэтом, прозаиком и журналистом и написал «Человека со Снежной реки» и текст «Вальсирующей Матильды».", verdict: "corrected" }],
    decision: "corrected",
    notes: "Оценка символического статуса и широкое наследие заменены профессиональными ролями и двумя конкретными произведениями.",
  },
  {
    key: "australia:bruce_pascoe",
    originalSha256: "bcb6ccdd282d0f986885e356e547c1a5f9118a92a4997923923d4672b543b74f",
    reviewedTextRu: "Австралийский писатель, работающий в художественной и документальной прозе, поэзии и детской литературе. Автор книг «Dark Emu» и «Young Dark Emu».",
    sourceKey: "pascoe",
    claims: [
      { textRu: "Брюс Паско - австралийский писатель, работающий в художественной и документальной прозе, поэзии и детской литературе.", verdict: "corrected" },
      { textRu: "Паско - автор книг «Dark Emu» и «Young Dark Emu».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Неоднозначные обозначения «историк» и «исследователь культуры» заменены подтверждёнными жанрами и книгами.",
  },
  {
    key: "australia:christina_stead",
    originalSha256: "562dbd9444cfcad5d6e1c7730c541da240d414448f383c5b068d1d7d182761ff",
    reviewedTextRu: "Австралийская писательница, автор романов и рассказов. Её роман «Человек, который любил детей» вышел в 1940 году.",
    sourceKey: "stead",
    claims: [
      { textRu: "Кристина Стед была австралийской писательницей и автором романов и рассказов.", verdict: "corrected" },
      { textRu: "Роман Стед «Человек, который любил детей» вышел в 1940 году.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Непроверяемые оценки интеллектуальности и глубины прозы заменены жанрами и конкретным романом.",
  },
  {
    key: "australia:james_clavell",
    originalSha256: "bb96efd3e22c24e073de937764a85ee4610bb604aaa05b8727369f2255d1563e",
    reviewedTextRu: "Родившийся в Сиднее писатель, сценарист, режиссёр и продюсер. Автор цикла исторических романов «Азиатская сага», в который входит «Сёгун».",
    sourceKey: "clavell",
    claims: [
      { textRu: "Джеймс Клавелл родился в Сиднее и работал писателем, сценаристом, режиссёром и продюсером.", verdict: "corrected" },
      { textRu: "Клавелл - автор цикла исторических романов «Азиатская сага», включающего «Сёгуна».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Формула о всемирной известности заменена местом рождения, профессиональными ролями и проверяемой библиографией.",
  },
  {
    key: "australia:kate_grenville",
    originalSha256: "57d0d916feaef8945aed82c30a0e48d9411bb4e8acfbe7fea830055758092191",
    reviewedTextRu: "Австралийская писательница, известная историческими романами и произведениями о колониальном прошлом Австралии.",
    sourceKey: "grenville",
    claims: [{ textRu: "Кейт Гренвилл - австралийская писательница, известная историческими произведениями о колониальном прошлом Австралии.", verdict: "supported" }],
    decision: "unchanged",
    notes: "Текст сохранён дословно: профессиональная роль, жанр и связь произведений с колониальным прошлым подтверждены архивом и издателем.",
  },
  {
    key: "australia:markus_zusak",
    originalSha256: "1221fdd05ce3a03e5ebb693b3e3412b86ccaafb18d50ab067371615562092d4d",
    reviewedTextRu: "Австралийский писатель, получивший мировую известность благодаря роману «Книжный вор». Его произведения переведены на десятки языков.",
    sourceKey: "zusak",
    claims: [
      { textRu: "Маркус Зусак - австралийский писатель, получивший международную известность благодаря «Книжному вору».", verdict: "supported" },
      { textRu: "Книги Зусака переведены на десятки языков.", verdict: "supported" },
    ],
    decision: "unchanged",
    notes: "Текст сохранён дословно. Рекомендация: исправить displayName «Маркос Зусак» на нормативное «Маркус Зусак»; общий файл не изменён.",
  },
  {
    key: "australia:miles_franklin",
    originalSha256: "112a3be0cfdd451e85d792ec406f637d0f34330743eb5d187ec936faa23c1bb1",
    reviewedTextRu: "Австралийская писательница, автор романа «Моя блестящая карьера». В её честь названа одна из главных литературных премий Австралии.",
    sourceKey: "franklin",
    claims: [
      { textRu: "Майлз Франклин была австралийской писательницей и автором романа «Моя блестящая карьера».", verdict: "supported" },
      { textRu: "Премия Майлз Франклин учреждена по завещанию писательницы и носит её имя.", verdict: "supported" },
    ],
    decision: "unchanged",
    notes: "Текст сохранён дословно: авторство романа и происхождение одной из главных литературных премий Австралии подтверждены независимо.",
  },
  {
    key: "australia:ruth_park",
    originalSha256: "9a5b970eb7fd2eeecd6fea1a6c97facd7f2e0083cc6617357ab3ac2c9206d4ad",
    reviewedTextRu: "Родившаяся в Новой Зеландии австралийская писательница и журналистка. Автор романа «Южная арфа», действие которого происходит в Сиднее.",
    sourceKey: "park",
    claims: [
      { textRu: "Рут Парк родилась в Новой Зеландии и стала австралийской писательницей и журналисткой.", verdict: "corrected" },
      { textRu: "Парк - автор романа «Южная арфа», действие которого происходит в Сиднее.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Обобщение о проблемах мигрантов заменено конкретным романом. Рекомендация: заменить birthDate 1917-08-04 на подтверждённую двумя национальными источниками 1917-08-24; общий файл не изменён.",
  },
  {
    key: "australia:terry_hayes",
    originalSha256: "36868366b0e1f69f62f2827e721f933d99a767eeb1382de04ee6dc3fee280c3e",
    reviewedTextRu: "Терри Хейс - писатель и сценарист. Он написал шпионский роман «Я - Пилигрим» и участвовал в создании сценария фильма «Безумный Макс 2: Воин дороги».",
    sourceKey: "hayes",
    claims: [
      { textRu: "Терри Хейс - писатель и сценарист, автор романа «Я - Пилигрим».", verdict: "corrected" },
      { textRu: "Хейс участвовал в создании сценария фильма «Безумный Макс 2: Воин дороги».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Роль продюсера убрана из краткой формулы, а сценарная работа уточнена конкретным фильмом. Издатель и ACMI подтверждают одну личность Терри Хейса; ключ сохраняется, точная birthDate институционально не установлена.",
  },
  {
    key: "austria:arthur_schnitzler",
    originalSha256: "c9ce4aa9ecda634fc64c8553788c814ed629e949536eb700dbe8442b48eb3b2c",
    reviewedTextRu: "Австрийский писатель и драматург эпохи модернизма.",
    sourceKey: "schnitzler",
    claims: [{ textRu: "Артур Шницлер был австрийским писателем и драматургом эпохи модернизма.", verdict: "supported" }],
    decision: "unchanged",
    notes: "Текст сохранён дословно: национальная принадлежность, профессиональные роли и литературная эпоха подтверждены австрийскими институциями.",
  },
  {
    key: "austria:daniel_kehlmann",
    originalSha256: "bf4c335e85f95126049846735667fccc14390b9315ad05a2af00f48a0237d6da",
    reviewedTextRu: "Немецкоязычный австрийско-немецкий писатель, автор романов «Измеряя мир» и «Тиль».",
    sourceKey: "kehlmann",
    claims: [{ textRu: "Даниэль Кельман - немецкоязычный австрийско-немецкий писатель и автор романов «Измеряя мир» и «Тиль».", verdict: "corrected" }],
    decision: "corrected",
    notes: "Расплывчатая формула о литературной традиции заменена точной писательской идентичностью и двумя романами.",
  },
  {
    key: "austria:elias_canetti",
    originalSha256: "37d0a25d04264372786e9b682b80b539c22a3013e35f279c0cb54b5ba57ed68b",
    reviewedTextRu: "Немецкоязычный писатель и эссеист сефардского происхождения. Автор романа «Ослепление» и исследования «Масса и власть»; лауреат Нобелевской премии по литературе 1981 года.",
    sourceKey: "canetti",
    claims: [
      { textRu: "Элиас Канетти был немецкоязычным писателем и эссеистом сефардского происхождения.", verdict: "corrected" },
      { textRu: "Канетти - автор «Ослепления» и «Массы и власти» и лауреат Нобелевской премии по литературе 1981 года.", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Интерпретация тем и длинная географическая формула заменены произведениями и наградой. Пересечение с Нобелевским реестром намеренное: exact gap-fill Batch11 требует отдельной claim-by-claim проверки, а Nobel Prize дополнен независимой Австрийской национальной библиотекой.",
  },
  {
    key: "austria:rainer_maria_rilke",
    originalSha256: "759c6ad453d18084fcb78448f9e8519a18bbf3895d081d1ca436c1de6fb1b0df",
    reviewedTextRu: "Немецкоязычный поэт и прозаик, родившийся в Праге. Автор цикла «Дуинские элегии» и романа «Записки Мальте Лауридса Бригге».",
    sourceKey: "rilke",
    claims: [
      { textRu: "Райнер Мария Рильке был немецкоязычным поэтом и прозаиком и родился в Праге.", verdict: "corrected" },
      { textRu: "Рильке - автор «Дуинских элегий» и романа «Записки Мальте Лауридса Бригге».", verdict: "supported" },
    ],
    decision: "corrected",
    notes: "Неясная формула «австро-центральноевропейская традиция» заменена местом рождения, жанрами и двумя произведениями.",
  },
  {
    key: "austria:robert_musil",
    originalSha256: "d9bfdd05559350841b76d9b77c314e6a4cd90dd71c1ed97f9e32079769a1093a",
    reviewedTextRu: "Австрийский писатель и эссеист, автор незавершённого романа «Человек без свойств».",
    sourceKey: "musil",
    claims: [{ textRu: "Роберт Музиль был австрийским писателем и эссеистом и автором незавершённого романа «Человек без свойств».", verdict: "corrected" }],
    decision: "corrected",
    notes: "Недоказанный рейтинг романа заменён профессиональными ролями, названием и документированным незавершённым статусом произведения.",
  },
  {
    key: "austria:stefan_zweig",
    originalSha256: "96b43aae4ddb6b68b9f75603dedd867b09b8f2536d578ab6a03a0df35dd3d31a",
    reviewedTextRu: "Австрийский писатель, биограф и эссеист.",
    sourceKey: "zweig",
    claims: [{ textRu: "Стефан Цвейг был австрийским писателем, биографом и эссеистом.", verdict: "supported" }],
    decision: "unchanged",
    notes: "Текст сохранён дословно: все три профессиональные роли подтверждены национальным архивом и центром наследия.",
  },
];

function finalizeReviewRecord(input: ReviewInput): WriterBiographyFactReviewRecord {
  const evidence = evidenceByAuthor[input.sourceKey].map(
    ([provider, url, findingRu]) => ({ provider, url, checkedAt, findingRu })
  );
  return {
    key: input.key,
    originalSha256: input.originalSha256,
    reviewedTextRu: input.reviewedTextRu,
    applicableTextRu:
      input.decision === "held" ? null : input.reviewedTextRu,
    claims: input.claims.map((claim) => ({ ...claim, evidence })),
    reviewer,
    decision: input.decision,
    notes: input.notes,
  };
}

export const writerBiographyFactReviewBatch11: readonly WriterBiographyFactReviewRecord[] =
  inputs.map(finalizeReviewRecord);
