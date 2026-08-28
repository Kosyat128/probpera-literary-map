export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH03_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 03";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH03_REVIEWER;
const checkedAt = "2026-08-09";

function evidence(
  provider: string,
  url: string,
  findingRu: string
): WriterBiographyClaimEvidence {
  return { provider, url, checkedAt, findingRu };
}

const writerBiographyFactReviewBatch03Base: readonly Omit<
  WriterBiographyFactReviewRecord,
  "applicableTextRu"
>[] = [
  {
    key: "australia:gregory_david_roberts",
    originalSha256:
      "ed6d7f3b333b1f6a31f753f03f337d3327fb906264725e267765e3abaa4d693e",
    reviewedTextRu:
      "Австралийский писатель, композитор и художник, автор романов «Шантарам» и «Тень горы».",
    claims: [
      {
        textRu:
          "Грегори Дэвид Робертс - австралийский писатель, композитор и художник.",
        verdict: "supported",
        evidence: [
          evidence(
            "Hachette UK",
            "https://www.hachette.co.uk/contributor/gregory-david-roberts/",
            "Издательский профиль называет Робертса автором, композитором и художником."
          ),
          evidence(
            "Macmillan",
            "https://us.macmillan.com/author/gregorydavidroberts",
            "Профиль издателя подтверждает, что Робертс родился в Мельбурне и является профессиональным писателем."
          ),
        ],
      },
      {
        textRu:
          "Субъективная формула «наиболее известный роман» заменена проверяемым авторством романов «Шантарам» и «Тень горы».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Hachette UK",
            "https://www.hachette.co.uk/contributor/gregory-david-roberts/",
            "Издатель перечисляет «Шантарам» и его продолжение The Mountain Shadow среди книг Робертса."
          ),
          evidence(
            "Macmillan",
            "https://us.macmillan.com/author/gregorydavidroberts",
            "Macmillan прямо называет Робертса автором Shantaram и продолжения The Mountain Shadow."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity queue: имя, мельбурнское происхождение и обе книги подтверждают, что кандидат Q1370495 относится к нужному автору; рекомендация - сохранить mapping. В публичной карточке нет дат рождения или смерти; авторитетные издательские профили полной даты не приводят, поэтому даты следует оставить незаполненными. Shared country files не изменялись.",
  },
  {
    key: "australia:henry_lawson",
    originalSha256:
      "b15eb14d10b8a8c83cb5e45d910e5c24fdefbe60de50bfcaac8431d24a0eb3bd",
    reviewedTextRu:
      "Австралийский писатель, поэт и автор рассказов. Его проза обращена к повседневности рабочих и жителей австралийского буша, включая суровые стороны этой жизни.",
    claims: [
      {
        textRu: "Генри Лоусон - австралийский писатель, поэт и автор рассказов.",
        verdict: "supported",
        evidence: [
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/lawson-henry-7118",
            "Национальный биографический словарь описывает Лоусона как поэта и автора рассказов."
          ),
          evidence(
            "State Library of New South Wales",
            "https://www.sl.nsw.gov.au/stories/henry-lawson-poet-people",
            "Библиотечная справка подтверждает его работу в поэзии и прозе."
          ),
        ],
      },
      {
        textRu:
          "Недоказанная формула об «одном из основателей» снята; сохранена подтверждённая тема рабочих и суровой повседневности австралийского буша.",
        verdict: "corrected",
        evidence: [
          evidence(
            "State Library of New South Wales",
            "https://www.sl.nsw.gov.au/stories/henry-lawson-poet-people/young-author",
            "Библиотека связывает рассказы Лоусона с рабочими буша, городской беднотой и рабочим классом."
          ),
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/lawson-henry-7118",
            "Биография отмечает документальную конкретность и реалистическое изображение тяжёлой жизни в буше."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Сравнительная роль в основании национальной прозы не была сохранена без двух прямых институциональных подтверждений; авторская тематическая связка сохранена.",
  },
  {
    key: "australia:joseph_furphy",
    originalSha256:
      "dd40079c0049b9a939a327a0f465a9609aaeb397c00fc9c1a6f538128c5990a3",
    reviewedTextRu:
      "Австралийский писатель, автор романа «Такова жизнь» (Such Is Life), основанного на наблюдениях за бытом и обычаями колониальной Австралии.",
    claims: [
      {
        textRu:
          "Джозеф Фёрфи - австралийский писатель и автор романа «Такова жизнь» (Such Is Life).",
        verdict: "supported",
        evidence: [
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/furphy-joseph-6261",
            "Словарь подтверждает профессию романиста и публикацию Such Is Life в 1903 году."
          ),
          evidence(
            "University of Queensland",
            "https://communication-arts.uq.edu.au/node/90",
            "Университетский проект архива Фёрфи подтверждает авторство и текстовую историю Such Is Life."
          ),
        ],
      },
      {
        textRu:
          "Недоказанное утверждение об основании австралийского романа заменено подтверждённой связью Such Is Life с опытом и обычаями колониальной Австралии.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/furphy-joseph-6261",
            "Биография связывает материал романа с опытом Фёрфи как погонщика и его наблюдениями за колониальным бытом."
          ),
          evidence(
            "James Cook University Research Repository",
            "https://researchonline.jcu.edu.au/69774/",
            "Университетская запись исследования описывает Such Is Life как австралийский роман, связанный с национальной историей и культурой."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив об основании жанра снят; название и документированная основа романа сохранены.",
  },
  {
    key: "australia:judith_wright",
    originalSha256:
      "832c484656a9dcb948732c5802563afcc773e2536654c2061eb8db1b7eaeec84",
    reviewedTextRu:
      "Австралийская поэтесса и общественная деятельница. В её поэзии важное место занимают природа, австралийский ландшафт и связь человека с землёй.",
    claims: [
      {
        textRu: "Джудит Райт - австралийская поэтесса и общественная деятельница.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/wright-judith-arundell-34325",
            "Словарь характеризует Райт как поэта, автора и активистку."
          ),
          evidence(
            "National Library of Australia",
            "https://www.library.gov.au/discover/nla-publishing/birds",
            "Национальная библиотека называет Райт поэтом, эссеистом, природоохранной активисткой и защитницей прав аборигенов."
          ),
        ],
      },
      {
        textRu:
          "Суперлатив снят; подтверждена центральная роль природы, австралийского ландшафта и связи с землёй в её поэзии.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/wright-judith-arundell-34325",
            "Биография прямо связывает поэтическое мышление Райт с австралийским ландшафтом и природоохранной деятельностью."
          ),
          evidence(
            "National Portrait Gallery of Australia",
            "https://www.portrait.gov.au/people/judith-wright-1915",
            "Государственная галерея подтверждает её поэтическую и природоохранную работу и связь стихов с австралийской природой."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Недоказанный рейтинг удалён; слово «культура» заменено на документированную связь поэзии с ландшафтом и землёй.",
  },
  {
    key: "australia:les_murray",
    originalSha256:
      "1a6d0fcef8e14675f373101efa1c3028a739fe86074bd853bf88752f75cd26ca",
    reviewedTextRu:
      "Австралийский поэт, лауреат премии Т. С. Элиота и обладатель Золотой медали королевы за поэзию.",
    claims: [
      {
        textRu: "Лес Мюррей - австралийский поэт.",
        verdict: "supported",
        evidence: [
          evidence(
            "National Portrait Gallery of Australia",
            "https://www.portrait.gov.au/people/les-murray-1938",
            "Государственная галерея идентифицирует Лесли Аллана «Леса» Мюррея (1938-2019) как австралийского поэта."
          ),
          evidence(
            "Academy of American Poets",
            "https://poets.org/poet/les-murray",
            "Академический профиль подтверждает полное имя, дату рождения, австралийское происхождение и поэтическую деятельность."
          ),
        ],
      },
      {
        textRu:
          "Сравнительный рейтинг заменён проверяемыми наградами: премией Т. С. Элиота и Золотой медалью королевы за поэзию.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Poetry Archive",
            "https://poetryarchive.org/poet/les-murray/",
            "Архив перечисляет победу в T. S. Eliot Prize и Queen's Gold Medal for Poetry."
          ),
          evidence(
            "National Portrait Gallery of Australia",
            "https://www.portrait.gov.au/people/les-murray-1938",
            "Государственный профиль независимо перечисляет обе награды."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity queue: исправленный mapping Q259841 соответствует поэту Leslie Allan Murray; варианты русской передачи «Мюррей/Маррей» не означают другую личность. Даты карточки 1938-10-17 и 2019-04-29 совпадают с Academy of American Poets; рекомендация - сохранить mapping и даты. Shared country files не изменялись.",
  },
  {
    key: "australia:nevil_shute",
    originalSha256:
      "9371baf324bc877e2dd772cde7249b49cc532ebded3469be0d8b46b475c52657",
    reviewedTextRu:
      "Англо-австралийский писатель и авиационный инженер, публиковавшийся под именем Невил Шют. В его романах инженерный опыт соединяется с темами человеческих отношений и последствий технологического развития.",
    claims: [
      {
        textRu:
          "Невил Шют Норуэй - англо-австралийский писатель и авиационный инженер, публиковавшийся под именем Невил Шют.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Nevil Shute Norway Foundation / Dictionary of National Biography",
            "https://www.nevilshute.org/Biography/dictionarynationalbio.php",
            "Биографическая статья подтверждает полное имя, литературный псевдоним, британское происхождение, инженерную профессию и эмиграцию в Австралию."
          ),
          evidence(
            "Penguin Random House",
            "https://www.penguinrandomhouse.com/authors/28278/nevil-shute/",
            "Издательский профиль подтверждает сочетание карьеры авиационного инженера и романиста."
          ),
        ],
      },
      {
        textRu:
          "Недоказанный рейтинг популярности и расплывчатое «научное прогнозирование» заменены подтверждённой связью инженерного опыта с человеческими отношениями и последствиями технологий.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Nevil Shute Norway Foundation / Dictionary of National Biography",
            "https://www.nevilshute.org/Biography/dictionarynationalbio.php",
            "Статья связывает техническое знание автора с сюжетами о людях, машинах, авиации и угрозе глобального уничтожения в On the Beach."
          ),
          evidence(
            "Nevil Shute Norway Foundation",
            "https://www.nevilshute.org/Biography/alanbesterbio.php",
            "Фонд подробно документирует инженерную карьеру Шюта и её отражение в романах."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Date discrepancy queue: Dictionary of National Biography фиксирует смерть 12 января 1960 года. В текущем рабочем дереве публичная карточка уже показывает 1960-01-12 и годы 1899-1960; рекомендация - сохранить эти значения и считать старое значение 1961-01-12 в QA-очереди устаревшим. Shared country files не изменялись.",
  },
  {
    key: "australia:oodgeroo_noonuccal",
    originalSha256:
      "aff1a7ed64257a361b5e2459c4f13a5bd2150e7d6fb32b28c8a2f61ec3b246e2",
    reviewedTextRu:
      "Австралийская поэтесса, художница и правозащитница из клана нунуццал народа куандамока. Её сборник «We Are Going» стал первой поэтической книгой, опубликованной автором - представителем коренных народов Австралии.",
    claims: [
      {
        textRu:
          "Уджеру Нунуккал - австралийская поэтесса, художница и правозащитница из клана нунуццал народа куандамока, а не из народа нунгари.",
        verdict: "corrected",
        evidence: [
          evidence(
            "State Library of Queensland",
            "https://www.slq.qld.gov.au/blog/oodgeroo-noonuccal-remembrance-day-2024",
            "Библиотека указывает, что её отец был мужчиной народа Quandamooka из клана Noonuccal на Минджеррибе."
          ),
          evidence(
            "State Library of Queensland",
            "https://www.slq.qld.gov.au/blog/bancroft-traeger-proposed-new-electorates-honour-significant-contributions-queensland",
            "Библиотечная справка подтверждает роли поэтессы, художницы, политической активистки и защитницы прав аборигенов."
          ),
          evidence(
            "National Portrait Gallery of Australia",
            "https://www.portrait.gov.au/people/oodgeroo-noonuccal-1920",
            "Государственная галерея идентифицирует Уджеру как женщину народа Quandamooka, поэта и активистку."
          ),
        ],
      },
      {
        textRu:
          "«We Are Going» стала первой поэтической публикацией в виде книги, созданной представителем коренных народов Австралии.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Australian Dictionary of Biography",
            "https://adb.anu.edu.au/biography/noonuccal-oodgeroo-18057",
            "Национальный биографический словарь прямо называет издание 1964 года первой поэтической публикацией Aboriginal Australian."
          ),
          evidence(
            "National Portrait Gallery of Australia",
            "https://www.portrait.gov.au/people/oodgeroo-noonuccal-1920",
            "Государственный профиль независимо подтверждает первенство сборника We Are Going."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Исправлена существенная этнокультурная ошибка: Noongar/нунгари - другой народ Западной Австралии; Уджеру принадлежала к клану Noonuccal народа Quandamooka.",
  },
  {
    key: "australia:patrick_white",
    originalSha256:
      "103f1a16f1eab0888f4ea705f046e082049d1bab9208bf3193e7e225791ae68d",
    reviewedTextRu:
      "Австралийский писатель, лауреат Нобелевской премии по литературе 1973 года. В его романах эпическое повествование соединяется с психологическим исследованием человека.",
    claims: [
      {
        textRu:
          "Патрик Уайт - австралийский писатель и лауреат Нобелевской премии по литературе 1973 года.",
        verdict: "supported",
        evidence: [
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/1973/white/facts/",
            "Официальная страница фиксирует лауреата, страну и год премии."
          ),
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/1973/white/press-release/",
            "Официальное сообщение подтверждает присуждение премии Уайту в 1973 году."
          ),
        ],
      },
      {
        textRu:
          "Суперлатив снят; характеристика прозы уточнена как соединение эпического повествования с психологическим исследованием человека.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/1973/white/press-release/",
            "Формулировка премии отмечает эпическое и психологическое повествовательное искусство Уайта."
          ),
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/1973/white/article/",
            "Нобелевский очерк рассматривает психологическое измерение и эпический масштаб его романов."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Недоказанный национальный рейтинг удалён; награда и характеристика повествования сохранены в проверяемой форме.",
  },
  {
    key: "australia:peter_carey",
    originalSha256:
      "42725b0261db6243eb59da35cafb78075ae2262eb0b95f372df71b5b85770fd9",
    reviewedTextRu:
      "Австралийский писатель, дважды лауреат Букеровской премии - за романы «Оскар и Люсинда» и «Истинная история шайки Келли».",
    claims: [
      {
        textRu: "Питер Кэри - австралийский писатель.",
        verdict: "supported",
        evidence: [
          evidence(
            "Booker Prize Foundation",
            "https://thebookerprizes.com/the-booker-library/authors/peter-carey",
            "Официальный профиль премии называет Кэри австралийским автором."
          ),
          evidence(
            "Penguin Books Australia",
            "https://www.penguin.com.au/authors/peter-carey",
            "Издательский каталог подтверждает авторство его романов и австралийскую литературную карьеру."
          ),
        ],
      },
      {
        textRu:
          "Суперлативы и широкая стилевая оценка заменены точным фактом: Кэри дважды получил Букеровскую премию - за «Оскара и Люсинду» и «Истинную историю шайки Келли».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Booker Prize Foundation",
            "https://thebookerprizes.com/the-booker-library/authors/peter-carey",
            "Официальный профиль перечисляет обе победы Кэри и названия романов."
          ),
          evidence(
            "Booker Prize Foundation",
            "https://thebookerprizes.com/the-booker-library/books/oscar-and-lucinda",
            "Карточка романа подтверждает победу Oscar and Lucinda в 1988 году и вторую победу автора за True History of the Kelly Gang."
          ),
          evidence(
            "Penguin Books Australia",
            "https://www.penguin.com.au/books/lists/peter-carey-re-jacketed",
            "Издатель независимо перечисляет две Букеровские премии и соответствующие романы."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочные формулы заменены двумя конкретными наградами; принят общеупотребительный русский заголовок «Истинная история шайки Келли».",
  },
  {
    key: "australia:richard_flanagan",
    originalSha256:
      "8c4dfad2590fdfa681c03a7c32bae9bfdc2f91cfcd0ea9e2ac9f104bfaf81018",
    reviewedTextRu:
      "Австралийский писатель, историк и кинорежиссёр, лауреат Букеровской премии 2014 года за роман «Узкая дорога на дальний север».",
    claims: [
      {
        textRu:
          "Ричард Флэнаган - австралийский писатель, историк и кинорежиссёр; исходное «сценарист» заменено документированной профессией.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Booker Prize Foundation",
            "https://thebookerprizes.com/the-booker-library/authors/richard-flanagan",
            "Официальный профиль называет Флэнагана романистом, историком и кинорежиссёром из Тасмании."
          ),
          evidence(
            "Pan Macmillan",
            "https://www.panmacmillan.com/authors/richard-flanagan/1835",
            "Издатель независимо подтверждает роли автора, историка и кинорежиссёра."
          ),
        ],
      },
      {
        textRu:
          "Флэнаган получил Букеровскую премию 2014 года за роман «Узкая дорога на дальний север».",
        verdict: "supported",
        evidence: [
          evidence(
            "Booker Prize Foundation",
            "https://thebookerprizes.com/the-booker-library/authors/richard-flanagan",
            "Официальный реестр указывает год победы и роман."
          ),
          evidence(
            "Booker Prize Foundation",
            "https://thebookerprizes.com/the-booker-library/books/the-narrow-road-to-the-deep-north",
            "Карточка книги фиксирует победу в Booker Prize 2014."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Профессия уточнена по двум профилям; расплывчатая тематическая фраза заменена точным названием награждённого романа.",
  },
  {
    key: "australia:tim_winton",
    originalSha256:
      "dc86e4a5a5935719f119a163cd879a7cb16cfd97ec4ef80e63f37c5e27144266",
    reviewedTextRu:
      "Австралийский писатель, четырежды лауреат премии Майлза Франклина. В его произведениях природа, море и жизнь побережья Западной Австралии становятся частью человеческих историй.",
    claims: [
      {
        textRu:
          "Субъективная оценка лидерства заменена точным фактом: Тим Уинтон - австралийский писатель, четырежды лауреат премии Майлза Франклина.",
        verdict: "corrected",
        evidence: [
          evidence(
            "State Library of Western Australia",
            "https://slwa.wa.gov.au/whats-on/awards-fellowships/western-australian-writers-hall-fame/tim-winton",
            "Библиотека называет Уинтона западноавстралийским автором и перечисляет четыре победы в Miles Franklin Award."
          ),
          evidence(
            "Simon & Schuster",
            "https://www.simonandschuster.com/authors/tim-winton/698930",
            "Издательский профиль независимо подтверждает четыре победы."
          ),
        ],
      },
      {
        textRu:
          "Природа, море и побережье Западной Австралии являются устойчивыми темами и местом действия произведений Уинтона.",
        verdict: "supported",
        evidence: [
          evidence(
            "State Library of Western Australia",
            "https://slwa.wa.gov.au/whats-on/awards-fellowships/western-australian-writers-hall-fame/tim-winton",
            "Библиотека отмечает роль ландшафта и частое действие историй в Западной Австралии."
          ),
          evidence(
            "Penguin Books Australia",
            "https://www.penguin.com.au/books/lands-edge-a-coastal-memoir-9780143785972",
            "Описание Land's Edge связывает море, берег и прибрежную жизнь с биографией и романами автора."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "«Один из ведущих» заменено точной наградной формулой; исходные темы сохранены и географически уточнены.",
  },
  {
    key: "austria:elfriede_jelinek",
    originalSha256:
      "1ee2a1ca6da4fcb8dd7b2ed6c787ec5e3f55a8e284a5f44071e8ac85abcb61cd",
    reviewedTextRu:
      "Австрийская писательница, лауреат Нобелевской премии по литературе 2004 года.",
    claims: [
      {
        textRu:
          "Эльфрида Елинек - австрийская писательница и лауреат Нобелевской премии по литературе 2004 года.",
        verdict: "supported",
        evidence: [
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/2004/press-release/",
            "Официальное сообщение называет Елинек австрийской писательницей и лауреатом 2004 года."
          ),
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/2004/bio-bibliography/",
            "Официальная биобиблиография подтверждает происхождение и литературную деятельность."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes: "Краткая исходная формулировка полностью подтверждена Нобелевским комитетом.",
  },
  {
    key: "austria:franz_kafka",
    originalSha256:
      "d0c0b4d14b0b781820f0f082ad2aadebf0e3d0e53cecacb9b0e352ababe8d76d",
    reviewedTextRu:
      "Немецкоязычный писатель из Праги, один из основоположников литературного модернизма.",
    claims: [
      {
        textRu: "Франц Кафка - немецкоязычный писатель из Праги.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Franz Kafka Museum",
            "https://kafkamuseum.cz/en/biography",
            "Музейная биография фиксирует рождение и литературную жизнь Кафки в Праге и его принадлежность к пражской немецкой литературе."
          ),
          evidence(
            "Goethe-Institut Czech Republic",
            "https://www.goethe.de/ins/cz/en/kul/the/kfk/25322516.html",
            "Институт прямо характеризует Кафку как немецкоязычного писателя Праги."
          ),
        ],
      },
      {
        textRu:
          "Субъективный рейтинг заменён институционально подтверждённой ролью одного из основоположников литературного модернизма.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Goethe-Institut Czech Republic",
            "https://www.goethe.de/ins/cz/de/kul/the/kfk/25323158.html",
            "Материал Института называет Кафку одним из основателей литературного модернизма."
          ),
          evidence(
            "Franz Kafka Museum",
            "https://kafkamuseum.cz/en/biography",
            "Профиль музея подтверждает его место в немецкоязычной прозе XX века."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Широкая государственная атрибуция «писатель Австро-Венгрии» заменена точной языково-городской формулой; сравнительный суперлатив снят.",
  },
  {
    key: "austria:hugo_von_hofmannsthal",
    originalSha256:
      "a42a4c08a7bdf266af85f7689a39c9efe3ccf0af8b24645b24b244a0d8751f60",
    reviewedTextRu:
      "Австрийский поэт, драматург и один из основателей Зальцбургского фестиваля.",
    claims: [
      {
        textRu: "Гуго фон Гофмансталь - австрийский поэт и драматург.",
        verdict: "supported",
        evidence: [
          evidence(
            "Hugo von Hofmannsthal-Gesellschaft",
            "https://gesellschaft.hofmannsthal.de/biographie/",
            "Профильное общество документирует поэтические и драматургические произведения Гофмансталя и его венское происхождение."
          ),
          evidence(
            "Salzburg Festival",
            "https://www.salzburgerfestspiele.at/en/about-us",
            "Официальный сайт фестиваля называет Гофмансталя австрийским поэтом."
          ),
        ],
      },
      {
        textRu: "Гофмансталь был одним из основателей Зальцбургского фестиваля.",
        verdict: "supported",
        evidence: [
          evidence(
            "Salzburg Festival",
            "https://www.salzburgerfestspiele.at/en/about-us",
            "Официальная история относит Гофмансталя к основателям вместе с Максом Рейнхардтом и Рихардом Штраусом."
          ),
          evidence(
            "Hugo von Hofmannsthal-Gesellschaft",
            "https://gesellschaft.hofmannsthal.de/biographie/",
            "Профильное общество подтверждает, что Гофмансталь и Рейнхардт основали фестиваль в 1920-е годы."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes: "Обе части исходного предложения подтверждены двумя профильными институциями.",
  },
  {
    key: "austria:peter_handke",
    originalSha256:
      "e0461100692366702f41179253eefab17431a51066cf54612033cdb01f71b5ac",
    reviewedTextRu:
      "Австрийский писатель, лауреат Нобелевской премии по литературе 2019 года.",
    claims: [
      {
        textRu:
          "Петер Хандке - австрийский писатель и лауреат Нобелевской премии по литературе 2019 года.",
        verdict: "supported",
        evidence: [
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/prizes/literature/2019/handke/facts/-/?gallery_style=page",
            "Официальная карточка фиксирует лауреата и год премии."
          ),
          evidence(
            "Nobel Prize Outreach",
            "https://www.nobelprize.org/uploads/2019/10/biobibliography-literatureprize2019.pdf",
            "Официальная биобиблиография подтверждает рождение Хандке в Каринтии и его литературную карьеру."
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes: "Краткая исходная формулировка подтверждена официальными материалами Нобелевской премии.",
  },
  {
    key: "azerbaijan:anar_rzayev",
    originalSha256:
      "b31e227208f1ba74caec6031077652c761476b194cc00c3656fddf2ed938bdf4",
    reviewedTextRu:
      "Азербайджанский писатель, драматург и сценарист, автор повести «Белая пристань».",
    claims: [
      {
        textRu: "Анар Рзаев - азербайджанский писатель, драматург и сценарист.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/94",
            "Государственный литературный обзор называет Анара прозаиком, драматургом и киносценаристом."
          ),
          evidence(
            "Национальная библиотека Азербайджана",
            "https://anl.az/down/anar70.pdf",
            "Национальный библиографический указатель документирует литературную, драматургическую и сценарную деятельность Анара."
          ),
        ],
      },
      {
        textRu:
          "Субъективный рейтинг заменён проверяемым фактом: Анар - автор повести «Белая пристань».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/94",
            "Официальный обзор называет «Белую пристань» (1967) одним из ранних произведений Анара."
          ),
          evidence(
            "Национальная библиотека Азербайджана",
            "https://anl.az/down/anar70.pdf",
            "Библиография включает повесть «Ağ liman» в корпус произведений автора."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив снят; вместо него сохранены профессиональные роли и конкретное произведение.",
  },
  {
    key: "azerbaijan:huseyn_javid",
    originalSha256:
      "aacced383a0228118ef0809731204584b427bf353999ecb64c212ee73167d2e1",
    reviewedTextRu:
      "Азербайджанский поэт и драматург, один из основоположников азербайджанского романтизма XX века.",
    claims: [
      {
        textRu: "Гусейн Джавид - азербайджанский поэт и драматург.",
        verdict: "supported",
        evidence: [
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/97",
            "Государственный профиль прямо называет Джавида поэтом и драматургом Азербайджана."
          ),
          evidence(
            "Официальный сайт Президента Азербайджана",
            "https://president.az/ru/articles/view/57353",
            "Распоряжение о юбилее подтверждает его поэтическую и драматургическую деятельность."
          ),
        ],
      },
      {
        textRu:
          "Сравнительная оценка «один из крупнейших» заменена документированной ролью одного из основоположников азербайджанского романтизма XX века.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/97",
            "Государственный литературный профиль прямо относит Джавида к основоположникам азербайджанского романтизма XX века."
          ),
          evidence(
            "Национальная библиотека Азербайджана",
            "https://anl.az/down/H.Cavid.bib.pdf",
            "Национальная библиография документирует романтическую поэзию и стихотворную драматургию Джавида."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Субъективный суперлатив заменён точной историко-литературной ролью, прямо зафиксированной официальным источником.",
  },
  {
    key: "azerbaijan:imadaddin_nasimi",
    originalSha256:
      "20f0814e625df93b29adc612a087f474bd581ac566fc3154cf5d5232260e9dea",
    reviewedTextRu:
      "Азербайджанский поэт и мыслитель, чьё творчество стало особым этапом в истории азербайджанской литературы и обогатило поэзию гуманистическими идеями.",
    claims: [
      {
        textRu: "Имадеддин Насими - азербайджанский поэт и мыслитель.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный сайт Президента Азербайджана",
            "https://president.az/ru/articles/view/30722",
            "Юбилейное распоряжение прямо называет Насими азербайджанским поэтом и мыслителем."
          ),
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/253",
            "Государственный обзор помещает Насими в историю азербайджанской литературы и гуманистической мысли."
          ),
        ],
      },
      {
        textRu:
          "Широкие суперлативы и спорная формула об основании традиции заменены подтверждённой ролью творчества Насими в истории литературы и развитии гуманистической поэзии.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный сайт Президента Азербайджана",
            "https://president.az/ru/articles/view/30722",
            "Официальный текст называет наследие Насими особым этапом истории азербайджанской литературы и отмечает обогащение поэзии гуманистическими идеями."
          ),
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/92",
            "Государственный обзор средневековой литературы связывает творчество Насими с гуманизмом и защитой достоинства человека."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Нейтрализованы оценочные и историографически широкие формулы; сохранены две прямо подтверждённые характеристики.",
  },
  {
    key: "azerbaijan:jalil_mammadguluzadeh",
    originalSha256:
      "123ef7ca70b92073e02842fda5e47e9956fa64e347b2087762ccab76ebc3bbbf",
    reviewedTextRu:
      "Азербайджанский писатель, драматург и сатирик, создатель литературной школы критического реализма и учредитель журнала «Молла Насреддин».",
    claims: [
      {
        textRu: "Джалил Мамедкулизаде - азербайджанский писатель, драматург и сатирик.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный сайт Президента Азербайджана",
            "https://president.az/ru/articles/view/31565",
            "Юбилейное распоряжение подтверждает его писательскую, драматургическую, публицистическую и сатирическую деятельность."
          ),
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/97",
            "Государственный литературный профиль называет Мамедкулизаде писателем, драматургом и журналистом-новатором."
          ),
        ],
      },
      {
        textRu:
          "Расплывчатая формула об основании современной прозы заменена точными фактами: Мамедкулизаде создал школу критического реализма и учредил журнал «Молла Насреддин».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/97",
            "Официальный профиль прямо фиксирует обе роли - основателя школы критического реализма и учредителя журнала."
          ),
          evidence(
            "Официальный сайт Президента Азербайджана",
            "https://president.az/ru/articles/view/31565",
            "Распоряжение подтверждает центральную роль писателя в критическом реализме и создании сатирического журнала."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Слово «крупный» снято; литературно-историческая роль изложена через две конкретные институции.",
  },
  {
    key: "azerbaijan:mirza_fatali_akhundov",
    originalSha256:
      "80841a5d3c4927611a1940094686a7b4d035228033e6bcb8a6315e6a31b5c0c8",
    reviewedTextRu:
      "Азербайджанский писатель, драматург и просветитель, заложивший своими комедиями 1850-х годов основы национальной драматургии.",
    claims: [
      {
        textRu: "Мирза Фатали Ахундов - азербайджанский писатель, драматург и просветитель.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Большая российская энциклопедия",
            "https://old.bigenc.ru/literature/text/1842787",
            "Энциклопедия подтверждает писательскую, драматургическую, общественную и просветительскую деятельность Ахундова."
          ),
          evidence(
            "Президентская библиотека Азербайджана",
            "https://www.preslib.az/ru/historical/page/Mf23E9Q",
            "Библиотечная биография называет его писателем-драматургом, философом и общественным деятелем."
          ),
        ],
      },
      {
        textRu:
          "Суперлатив снят; подтверждена роль комедий 1850-х годов в формировании национальной драматургии.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Большая российская энциклопедия",
            "https://old.bigenc.ru/literature/text/1842787",
            "БРЭ прямо сообщает, что Ахундов заложил основы азербайджанской национальной драматургии пьесами 1850-1855 годов."
          ),
          evidence(
            "Официальный портал Азербайджана",
            "https://azerbaijan.az/ru/related-information/97",
            "Государственный профиль связывает шесть комедий 1850-х годов с основанием национальной драматургии."
          ),
          evidence(
            "Президентская библиотека Азербайджана",
            "https://www.preslib.az/ru/historical/page/Mf23E9Q",
            "Библиотека подтверждает, что комедии 1850-1855 годов заложили основу драматургии."
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Date discrepancy queue: БРЭ даёт 30.6(12.7).1812 и 26.2(10.3).1878. Рекомендация для публичной карточки - заменить birthDate 1812-07-30 на 1812-07-12 и deathDate 1878-03-09 на 1878-03-10 (новый стиль); years 1812-1878 оставить. Shared country files в этом batch не изменялись.",
  },
];

function finalizeReviewRecord(
  record: Omit<WriterBiographyFactReviewRecord, "applicableTextRu">
): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu:
      record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch03: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch03Base.map(finalizeReviewRecord);
