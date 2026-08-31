export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH47_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 47";

export type WriterBiographyFactReviewDecision = "unchanged" | "corrected" | "held";
export type WriterBiographyClaimVerdict = "supported" | "corrected" | "not-established";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH47_REVIEWER;
const checkedAt = "2026-08-30";

type EvidenceSeed = readonly [
  provider: string,
  url: string,
  findingRu: string,
  evidenceCheckedAt?: string,
];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

function e(
  provider: string,
  url: string,
  findingRu: string,
  evidenceCheckedAt: string = checkedAt
): EvidenceSeed {
  return [provider, url, findingRu, evidenceCheckedAt];
}

const seeds: readonly ReviewSeed[] = [
  {
    key: "russia:sergey_ivanovich_ozhegov",
    originalSha256: "405808ec4978bbd81f05b3b2fcbeb1bf6feeb9575a9f13f85a0bb8c9a163d0de",
    reviewedTextRu: "Сергей Ожегов (1900-1964) - советский языковед и лексикограф, участвовавший в подготовке «Толкового словаря русского языка» под редакцией Дмитрия Ушакова. Его однотомный «Словарь русского языка» впервые вышел в 1949 году и после смерти автора продолжал дополняться его учениками.",
    evidence: [
      e("Большая российская энциклопедия", "https://old.bigenc.ru/linguistics/text/2289570", "Энциклопедия подтверждает годы жизни Ожегова, его работу как языковеда и лексикографа, участие в словаре под редакцией Ушакова и первое издание однотомного словаря в 1949 году."),
      e("Институт русского языка имени В. В. Виноградова РАН - журнал «Вопросы языкознания»", "https://vja.ruslang.ru/ru/archive/2000-5/81-92", "Академическая публикация независимо характеризует Ожегова как лексикографа и исследователя культуры русской речи и рассматривает историю его словаря."),
    ],
    decision: "corrected",
    notes: "Субъективная формула об известности справочника заменена датой первого издания и проверяемыми сведениями об участии в словаре Ушакова и последующей редакционной работе.",
  },
  {
    key: "russia:sergey_lukyanenko",
    originalSha256: "631ab884e30147ac72119c3f20aa115ee98993495a9603ffdd8fe47caf1f5481",
    reviewedTextRu: "Сергей Лукьяненко (род. 1968) - российский писатель-фантаст, автор серии книг о Дозорах. К произведениям о Диптауне относятся «Лабиринт отражений», «Фальшивые зеркала» и «Прозрачные витражи».",
    evidence: [
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%9B%D1%83%D0%BA%D1%8C%D1%8F%D0%BD%D0%B5%D0%BD%D0%BA%D0%BE_%D0%A1%D0%B5%D1%80%D0%B3%D0%B5%D0%B9_%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D1%8C%D0%B5%D0%B2%D0%B8%D1%87", "Энциклопедия подтверждает 1968 год рождения, профессию писателя-фантаста и цикл романов о Дозорах."),
      e("Российская государственная библиотека", "https://search.rsl.ru/ru/record/01003387655", "Каталог РГБ подтверждает авторство Лукьяненко и библиографические данные издания «Лабиринта отражений»."),
      e("Официальный сайт Сергея Лукьяненко", "https://lukianenko.ru/biography/", "Авторский сайт относит «Лабиринт отражений», «Фальшивые зеркала» и «Прозрачные витражи» к произведениям о Диптауне, при этом первые две книги обозначает как дилогию."),
    ],
    decision: "corrected",
    notes: "Формула «одноимённая трилогия» неточна: сам автор называет «Лабиринт отражений» и «Фальшивые зеркала» дилогией, а «Прозрачные витражи» - отдельной повестью того же цикла о Диптауне.",
  },
  {
    key: "russia:sholokhov",
    originalSha256: "f6b98fbb6ba64caeb9137a41fcb57bd2f2d44acc7f02478b182d73be2889bed8",
    reviewedTextRu: "Михаил Шолохов (1905-1984) - русский советский писатель, лауреат Нобелевской премии по литературе 1965 года. Он написал романы «Тихий Дон» и «Поднятая целина», а также рассказ «Судьба человека».",
    evidence: [
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A8%D0%BE%D0%BB%D0%BE%D1%85%D0%BE%D0%B2_%D0%9C%D0%B8%D1%85%D0%B0%D0%B8%D0%BB_%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80%D0%BE%D0%B2%D0%B8%D1%87", "Энциклопедия подтверждает литературную деятельность и годы жизни Шолохова, отмечая существование иной версии года рождения, а также авторство «Тихого Дона», «Поднятой целины» и «Судьбы человека».", "2026-08-31"),
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1965/sholokhov/facts/", "Нобелевский архив подтверждает присуждение Михаилу Шолохову премии по литературе 1965 года."),
      e("Государственный музей-заповедник М. А. Шолохова", "https://sholokhov.ru/sholokhov/biography", "Официальная биография музея подтверждает литературную деятельность Шолохова в советский период и получение Нобелевской премии в 1965 году."),
    ],
    decision: "corrected",
    notes: "Краткая исходная строка расширена по БРЭ до двух предложений с именем, датами и произведениями. В БРЭ отмечена альтернативная версия года рождения; карточка сохраняет официально используемый музеем 1905 год.",
  },
  {
    key: "russia:solzhenitsyn",
    originalSha256: "1ec253629066895f9c75ab644defec9a7b7027ba6411ea0ec2de67b5fe5250f5",
    reviewedTextRu: "Александр Солженицын (1918-2008) - русский писатель, публицист и общественный деятель, лауреат Нобелевской премии по литературе 1970 года. Он написал рассказ «Один день Ивана Денисовича» и художественно-документальное исследование «Архипелаг ГУЛАГ».",
    evidence: [
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A1%D0%BE%D0%BB%D0%B6%D0%B5%D0%BD%D0%B8%D1%86%D1%8B%D0%BD_%D0%90%D0%BB%D0%B5%D0%BA%D1%81%D0%B0%D0%BD%D0%B4%D1%80_%D0%98%D1%81%D0%B0%D0%B5%D0%B2%D0%B8%D1%87", "Энциклопедия подтверждает годы жизни, литературную, публицистическую и общественную деятельность Солженицына, Нобелевскую премию, рассказ «Один день Ивана Денисовича» и «Архипелаг ГУЛАГ».", "2026-08-31"),
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1970/summary/", "Нобелевский архив подтверждает присуждение Александру Солженицыну премии по литературе 1970 года."),
      e("Официальный сайт Александра Солженицына", "https://solzhenitsyn.ru/zhizn_soljzenizina/avtobiografiya/", "Автобиографические материалы официального архива документируют писательскую, историческую и общественную деятельность Солженицына."),
    ],
    decision: "corrected",
    notes: "Краткая исходная строка расширена по БРЭ: добавлены имя, даты, уточнённые литературные роли и два произведения без оценочных формулировок.",
  },
  {
    key: "russia:tolstoy",
    originalSha256: "d39d15edc97f3b6bd35a05f8d773d566334843515ab6b37ca9e386fba4b7f789",
    reviewedTextRu: "Лев Толстой (1828-1910) - русский писатель и публицист. Он написал романы «Война и мир», «Анна Каренина» и «Воскресение».",
    evidence: [
      e("Государственный музей Л. Н. Толстого", "https://tolstoymuseum.ru/news/2026/06/10/85783/", "Материал государственного музея подтверждает годы жизни Толстого и называет «Войну и мир», «Анну Каренину» и «Воскресение» среди его основных романов."),
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9_%D0%9B%D0%B5%D0%B2_%D0%9D%D0%B8%D0%BA%D0%BE%D0%BB%D0%B0%D0%B5%D0%B2%D0%B8%D1%87", "Энциклопедия независимо подтверждает даты 1828-1910, определяет Толстого как русского писателя и публициста и перечисляет три романа."),
    ],
    decision: "corrected",
    notes: "Интерпретационные оценки содержания и влияния заменены краткими проверяемыми сведениями о профессии, датах и произведениях.",
  },
  {
    key: "russia:trediakovsky",
    originalSha256: "5dbe62f8d85e15030296542df9de64e1f8fb1037c3683e8fdac742583f93e81f",
    reviewedTextRu: "Василий Тредиаковский (1703-1768) - русский поэт, переводчик, литературный теоретик и языковед. В трактате «Новый и краткий способ к сложению российских стихов» он изложил принципы силлабо-тонического стихосложения.",
    evidence: [
      e("Президентская библиотека имени Б. Н. Ельцина", "https://www.prlib.ru/Great_Russia/cultural_XVIII/Trediakovsky", "Президентская библиотека подтверждает годы 1703-1768, работу Тредиаковского как поэта, переводчика и филолога и его роль в реформировании русского стиха."),
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A2%D1%80%D0%B5%D0%B4%D0%B8%D0%B0%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9_%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D0%B8%D0%B9_%D0%9A%D0%B8%D1%80%D0%B8%D0%BB%D0%BB%D0%BE%D0%B2%D0%B8%D1%87", "БРЭ приводит двойные календарные даты 22 февраля/5 марта 1703 года и 6/17 августа 1768 года и описывает содержание трактата о русском стихосложении."),
    ],
    decision: "corrected",
    notes: "Исправлен ошибочный год смерти 1769 на 1768 и субъективное ранжирование заменено конкретным трактатом. Даты профиля приведены к новому стилю: БРЭ даёт 22 февраля/5 марта 1703 года и 6/17 августа 1768 года; Президентская библиотека независимо подтверждает 1703-1768.",
  },
  {
    key: "russia:tsvetaeva",
    originalSha256: "95d16b43cbf422437319fdc20cce40b4641b893f52d0583c55ac6b1fcabf2a03",
    reviewedTextRu: "Марина Цветаева (1892-1941) - русский поэт, прозаик и драматург. Её первый сборник «Вечерний альбом» вышел в 1910 году, а книга «Вёрсты» (выпуск 1) - в 1922 году.",
    evidence: [
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A6%D0%B2%D0%B5%D1%82%D0%B0%D0%B5%D0%B2%D0%B0_%D0%9C%D0%B0%D1%80%D0%B8%D0%BD%D0%B0_%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2%D0%BD%D0%B0", "Энциклопедия подтверждает годы жизни Цветаевой, её работу в поэзии, прозе и драматургии, выход «Вечернего альбома» в 1910 году и точное название книги «Вёрсты» (выпуск 1, 1922).", "2026-08-31"),
      e("Дом-музей Марины Цветаевой", "https://dommuseum.ru/museum/house-history/1914/kvartira", "Материалы официального музея документируют биографию и творческую работу Цветаевой; музейная хронология подтверждает издания её ранних сборников."),
    ],
    decision: "corrected",
    notes: "Описание уточнено по БРЭ: добавлена драматургия и указано, что в 1922 году вышел первый выпуск книги «Вёрсты», чтобы не смешивать его с другим изданием «Вёрст».",
  },
  {
    key: "russia:turgenev",
    originalSha256: "8ca2cc2505a8690dfbbdd089ea0421dd9c7d42c81694f2ffceaf8a4ea136afc1",
    reviewedTextRu: "Иван Тургенев (1818-1883) - русский писатель, поэт и драматург. Он написал цикл «Записки охотника» и романы «Дворянское гнездо» и «Отцы и дети».",
    evidence: [
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%A2%D1%83%D1%80%D0%B3%D0%B5%D0%BD%D0%B5%D0%B2_%D0%98%D0%B2%D0%B0%D0%BD_%D0%A1%D0%B5%D1%80%D0%B3%D0%B5%D0%B5%D0%B2%D0%B8%D1%87", "БРЭ подтверждает даты 1818-1883, литературные роли Тургенева, цикл «Записки охотника» и романы «Дворянское гнездо» и «Отцы и дети».", "2026-08-31"),
      e("Орловский объединённый государственный литературный музей И. С. Тургенева", "https://turgenevmus.ru/proishozhdenie-zapisok-ohotnika-po-vospominaniyam-m-p-s-oj/", "Официальный музейный материал независимо подтверждает авторство и историю создания цикла «Записки охотника»."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование удалено; карточка конкретизирована датами и произведениями.",
  },
  {
    key: "russia:zhukovsky",
    originalSha256: "0f0501e91803a038963886eb5bd44d0fcf0261b6c2204a51512a40c2993732a8",
    reviewedTextRu: "Василий Жуковский (1783-1852) - русский поэт и переводчик. Он написал балладу «Светлана» и выполнил русский перевод «Одиссеи», опубликованный в 1849 году.",
    evidence: [
      e("Большая российская энциклопедия", "https://bigenc.ru/wiki/%D0%96%D1%83%D0%BA%D0%BE%D0%B2%D1%81%D0%BA%D0%B8%D0%B9_%D0%92%D0%B0%D1%81%D0%B8%D0%BB%D0%B8%D0%B9_%D0%90%D0%BD%D0%B4%D1%80%D0%B5%D0%B5%D0%B2%D0%B8%D1%87", "Энциклопедия подтверждает даты 1783-1852, литературные роли Жуковского, балладу «Светлана» и перевод «Одиссеи», опубликованный в 1849 году.", "2026-08-31"),
      e("Президентская библиотека имени Б. Н. Ельцина", "https://www.prlib.ru/history/1845699", "Президентская библиотека независимо подтверждает годы жизни Жуковского, его работу поэта и переводчика и публикацию перевода «Одиссеи» в 1849 году."),
    ],
    decision: "corrected",
    notes: "Оценочные формулы о наставничестве и основоположничестве заменены датами и двумя документированными произведениями.",
  },
  {
    key: "rwanda:alexis_kagame",
    originalSha256: "3f0e47a5de1cd912aa558fb1ef3ad8fe25bac10602474c2af105a9ec73909995",
    reviewedTextRu: "Алексис Кагаме (1912-1981) - руандийский священник, поэт, историк, философ и исследователь языка. Он преподавал руандийскую литературу и историю и публиковал труды на киньяруанда и французском языке.",
    evidence: [
      e("UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_2f37eda8-988b-4e2b-8ebf-1dae1af3eeda?_=394048eng.pdf", "Библиографический обзор UNESCO подтверждает годы жизни Кагаме, его священническое служение, работу поэта, историка, философа и лингвиста и публикации на киньяруанда и французском."),
      e("Académie des sciences d’outre-mer", "https://www.academieoutremer.fr/academiciens/?aId=896", "Академическая биографическая запись независимо подтверждает даты 1912-1981, научные занятия Кагаме и преподавание истории и литературы Руанды."),
    ],
    decision: "corrected",
    notes: "Субъективное национальное ранжирование заменено датами, проверяемыми профессиями, преподаванием и языками публикаций.",
  },
  {
    key: "rwanda:benjamin_sehene",
    originalSha256: "f9ff0cbd371f90b2d311f73d605ec53644e8401cfc58eccc011d1acb57f0dbf4",
    reviewedTextRu: "Бенжамен Сехене - руандийский романист и эссеист. Его книга «Le Feu sous la soutane» (2005) представляет художественное осмысление геноцида против тутси в Руанде.",
    evidence: [
      e("UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_2f37eda8-988b-4e2b-8ebf-1dae1af3eeda?_=394048eng.pdf", "Обзор UNESCO относит Сехене к руандийским авторам и документирует его работу в прозе и эссеистике."),
      e("University of St Andrews", "https://research-portal.st-andrews.ac.uk/en/publications/benjamin-sehene-vs-father-wenceslas-munyeshyaka-the-fictional-tri/", "Университетская публикация анализирует «Le Feu sous la soutane» Бенжамена Сехене как художественное произведение о геноциде в Руанде и подтверждает издание 2005 года."),
    ],
    decision: "corrected",
    notes: "Неподтверждённая формула о канадской национальной принадлежности заменена документированными литературными ролями и произведением. Открытый интервал жизни очищен из-за спорных сообщений о смерти, не подтверждённых двумя авторитетными источниками.",
  },
  {
    key: "rwanda:saverio_naigiziki",
    originalSha256: "cd10cdcf11fc757f37cf2b643e443c71187576b2a607ce2d34395240e26147ce",
    reviewedTextRu: "Саверио Найгизики (1915-1984) - руандийский педагог и писатель. Его «Escapade rwandaise» была издана в 1949 году, а расширенная версия текста вышла в 1955 году под названием «Mes transes à trente ans».",
    evidence: [
      e("UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_2f37eda8-988b-4e2b-8ebf-1dae1af3eeda?_=394048eng.pdf", "Обзор UNESCO подтверждает годы 1915-1984, педагогическую и писательскую деятельность Найгизики и библиографию его прозы."),
      e("Université Cheikh Anta Diop de Dakar - Revue d’Études Africaines", "https://rea.ucad.sn/index.php/rea/article/download/12/11/45", "Академическая статья независимо описывает «Escapade rwandaise» 1949 года и её расширенное издание «Mes transes à trente ans» 1955 года."),
    ],
    decision: "corrected",
    notes: "Субъективная и расплывчатая формула о первенстве заменена датами, профессиями и проверяемой историей двух изданий.",
  },
  {
    key: "rwanda:scholastique_mukasonga",
    originalSha256: "4f9b39f3c5a72829f1a745577c6e403caa5d8452db951a5ca1a98cfb9df1b20c",
    reviewedTextRu: "Шоластик Мукасонга (род. 1956) - руандийская писательница, живущая во Франции. Среди её книг - «Inyenzi ou les Cafards», «La femme aux pieds nus» и роман «Notre-Dame du Nil».",
    evidence: [
      e("UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_2f37eda8-988b-4e2b-8ebf-1dae1af3eeda?_=394048eng.pdf", "Обзор UNESCO подтверждает руандийское происхождение Мукасонги, её жизнь во Франции и книги «Inyenzi ou les Cafards» и «La femme aux pieds nus»."),
      e("National Book Foundation", "https://www.nationalbook.org/people/scholastique-mukasonga/", "Биографическая запись фонда подтверждает 1956 год рождения, литературную деятельность Мукасонги и роман «Notre-Dame du Nil»."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка известности заменена годом рождения, местом проживания и тремя документированными книгами.",
  },
  {
    key: "saint_kitts_and_nevis:caryl_phillips",
    originalSha256: "4feea7424f7d9e2c80df6142901efde932c53223f3cfc7a2eb2e1c94984c97e1",
    reviewedTextRu: "Кэрил Филлипс (род. 1958) - британский писатель, родившийся на Сент-Китсе и выросший в Лидсе. Он написал романы «Crossing the River» и «A Distant Shore».",
    evidence: [
      e("Yale University", "https://english.yale.edu/people/tenured-and-tenure-track-faculty-professors-creative-writers/caryl-phillips", "Профиль Йельского университета подтверждает рождение Филлипса на Сент-Китсе в 1958 году, детство в Лидсе и его писательскую деятельность."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/crossing-the-river", "Архив Букеровской премии подтверждает авторство романа «Crossing the River» и библиографические сведения о Филлипсе; перечень его книг включает «A Distant Shore»."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка заметности и тематическая интерпретация заменены проверяемыми биографическими фактами и названиями романов.",
  },
  {
    key: "saint_lucia:derek_walcott",
    originalSha256: "2d4dca2a28945bc08b1b9f26778d9c4d400906417d69973232a3ceceddcbc940",
    reviewedTextRu: "Дерек Уолкотт (1930-2017) - сент-люсийский поэт и драматург, лауреат Нобелевской премии по литературе 1992 года. Среди его произведений - поэма «Omeros» и пьеса «Dream on Monkey Mountain».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1992/walcott/facts/", "Нобелевский архив подтверждает годы 1930-2017, рождение на Сент-Люсии, литературные роли и премию 1992 года."),
      e("The University of the West Indies, St Augustine", "https://sta.uwi.edu/news/releases/release.asp?id=1664", "Университетский материал независимо подтверждает сент-люсийское происхождение Уолкотта и называет «Omeros» и «Dream on Monkey Mountain» среди его произведений."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и литературоведческая интерпретация заменены датами, премией и двумя конкретными произведениями.",
  },
  {
    key: "saint_lucia:john_robert_lee",
    originalSha256: "586507b8970eedbfdcc1d58a3759557d7a57f23d946c18f6446c603c7c8de1ad",
    reviewedTextRu: "Джон Роберт Ли (род. 1948) - сент-люсийский поэт, писатель и библиотекарь. Он опубликовал более двадцати поэтических книг, включая «Vocation» и «Collected Poems 1975-2015».",
    evidence: [
      e("The University of the West Indies - Caribbean Literary Journal", "https://journals.sta.uwi.edu/ojs/index.php/clj/article/download/8862/7284/14112", "Университетская публикация подтверждает 1948 год рождения, сент-люсийское происхождение и литературную и библиотечную работу Ли."),
      e("Brinkerhoff Poetry Foundation", "https://www.brinkerhoffpoetry.org/poets/john-robert-lee", "Биографическая запись фонда независимо перечисляет более двадцати поэтических книг Ли, включая «Vocation» и «Collected Poems 1975-2015»."),
    ],
    decision: "corrected",
    notes: "Общие тематические оценки заменены годом рождения, профессиями и библиографическими фактами; искусственная точная дата 1948-01-01 сокращена до подтверждённого года.",
  },
  {
    key: "saint_vincent_and_the_grenadines:michael_anthony",
    originalSha256: "95bdebc17d71bb108c87226e23b2af70eeaf73659b453dadb68072b9de2cf0b0",
    reviewedTextRu: "Карточка в разделе Сент-Винсента относится к Майклу Энтони (1930-2023), писателю и историку из Тринидада и Тобаго, родившемуся в Маяро на Тринидаде. Авторитетные источники не подтверждают её страновую атрибуцию, поэтому запись требует переноса, а не публикации в текущем разделе.",
    evidence: [
      e("National Library and Information System Authority of Trinidad and Tobago", "https://www.nalis.gov.tt/press-release/biographical-note-michael-anthony-d-litt/", "Национальная библиотека Тринидада и Тобаго указывает рождение Майкла Энтони 10 февраля 1930 года в Маяро и перечисляет романы «The Year in San Fernando» и «Green Days by the River»."),
      e("The University of the West Indies, St Augustine", "https://sta.uwi.edu/fhe/dlcc/lccs-mourns-passing-late-michael-anthony", "Университетский некролог независимо называет Энтони тринидадским писателем и историком и подтверждает даты 10 февраля 1930 - 24 августа 2023 года."),
    ],
    decision: "held",
    notes: "Fail-closed: исходная карточка ошибочно относит автора к Сент-Винсенту и указывает смерть в 2019 году. Источники подтверждают тринидадскую личность и смерть 24 августа 2023 года; до явного переноса карточка изолируется как межстрановой конфликт.",
  },
  {
    key: "samoa:albert_wendt",
    originalSha256: "ac9fb3f5ee00702cc88fbc5523744294c250983c67abbe575b1b0e5979bf08c9",
    reviewedTextRu: "Альберт Вендт (род. 1939) - самоанский писатель, поэт и литературовед, почётный профессор Оклендского университета. Среди его книг - романы «Leaves of the Banyan Tree» и «Pouliuli».",
    evidence: [
      e("Te Ara - The Encyclopedia of New Zealand", "https://teara.govt.nz/mi/speech/1616/albert-wendt", "Государственная энциклопедия Новой Зеландии подтверждает самоанское происхождение Вендта и его работу в прозе, поэзии и литературоведении."),
      e("University of Auckland", "https://www.auckland.ac.nz/assets/about-us/about-the-university/the-university/official-publications/uninews/2009/uoanews-issue16-2009.pdf", "Издание Оклендского университета подтверждает 1939 год рождения, статус почётного профессора и романы «Leaves of the Banyan Tree» и «Pouliuli»."),
    ],
    decision: "corrected",
    notes: "Субъективное утверждение об основоположничестве и тематическое обобщение заменены годом рождения, академическим статусом и произведениями.",
  },
  {
    key: "samoa:lani_wendt_young",
    originalSha256: "76195a95037f46ee4a0dd3a869e98ba27884666047898dc74a0f33177635738e",
    reviewedTextRu: "Лани Вендт Янг (род. 1973) - самоанская писательница, автор подросткового цикла «Telesā». Она также написала документальную книгу «Pacific Tsunami “Galu Afi”» о цунами 2009 года.",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/young-lani-wendt", "Национальная организация поддержки чтения указывает 1973 год рождения, самоанское происхождение, цикл «Telesā» и документальную книгу о цунами."),
      e("University of Auckland", "https://www.auckland.ac.nz/assets/about-us/the-university/official-publications/uninews/2010/uoa_news_issue_20_2010.pdf", "Издание Оклендского университета независимо документирует работу Лани Вендт Янг над книгой «Pacific Tsunami “Galu Afi”» о событиях 2009 года."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка заметности удалена. Авторитетная биография указывает 1973, а не 1968 год рождения; точный день не установлен, поэтому birthDate сокращён до доказанного года.",
  },
  {
    key: "samoa:selina_tusitala_marsh",
    originalSha256: "224a3e72f0ee40197d7032b8ff15982ffbc6f2f79924a1dc4bbedca805afd102",
    reviewedTextRu: "Селина Туситала Марш (род. 1971) - новозеландская поэтесса и исследовательница самоанского и тувалуанского происхождения. Она опубликовала сборники «Fast Talking PI», «Dark Sparring» и «Tightrope».",
    evidence: [
      e("University of Auckland", "https://www.auckland.ac.nz/en/research/about-our-research/pacific-research/dr-selina-tusitala-marsh.html", "Профиль университета подтверждает работу Марш как поэтессы и исследовательницы, её самоанское и тувалуанское происхождение и книги «Fast Talking PI» и «Tightrope»."),
      e("Poetry Archive", "https://poetryarchive.org/poet/selina-tusitala-marsh/", "Архив поэзии независимо указывает 1971 год рождения в Окленде и подтверждает поэтическую деятельность и сборники Марш, включая «Dark Sparring»."),
    ],
    decision: "corrected",
    notes: "Тематическая интерпретация заменена годом рождения, документированным происхождением, профессиями и названиями книг; конфликтующая точная дата сокращена до подтверждённого года.",
  },
  {
    key: "samoa:sia_figiel",
    originalSha256: "bba299755080f0d8370630c9a09217cacd08915923d1e8816ef5ad0db8c7b3dc",
    reviewedTextRu: "Сиа Фигиэль (род. 1967) - самоанская писательница и поэтесса, автор романа «Where We Once Belonged». В 2023 году вышел её перевод романа Альберта Вендта «Pouliuli» на самоанский язык.",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/figiel-sia", "Национальная организация поддержки чтения указывает 1967 год рождения, самоанское происхождение и авторство романа «Where We Once Belonged»."),
      e("University of Hawaiʻi Press", "https://uhpress.hawaii.edu/title/pouliuli-2/", "Университетское издательство подтверждает, что самоанский перевод «Pouliuli», выполненный Сиа Фигиэль, был опубликован в 2023 году."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка известности и тематическая интерпретация заменены годом рождения, романом и документированным переводом. Искусственная точная дата 1967-01-01 сокращена до подтверждённого года.",
  },
  {
    key: "samoa:tusiata_avia",
    originalSha256: "927b91c6447521a2079c3ffab15029601cdfd0db3ebc7a3824fe276e141d0c0b",
    reviewedTextRu: "Тусиата Авиа (род. 1966) - новозеландская поэтесса, писательница и исполнительница самоанского происхождения. Среди её книг - «Wild Dogs Under My Skirt» и «The Savage Coloniser Book».",
    evidence: [
      e("Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/avia-tusiata", "Биографическая запись указывает 1966 год рождения, самоанское происхождение, работу в поэзии и перформансе и книгу «Wild Dogs Under My Skirt»."),
      e("National Library of New Zealand", "https://natlib.govt.nz/records/51564895", "Национальная библиотека независимо фиксирует авторитетную форму «Avia, Tusiata, 1966-» и подтверждает авторство «The Savage Coloniser Book»."),
    ],
    decision: "corrected",
    notes: "Тематическое обобщение заменено проверяемыми ролями и книгами. Национальные источники указывают 1966, а не 1969 год рождения; точный день не установлен.",
  },
  {
    key: "san_marino:marino_fattori",
    originalSha256: "62bcdd16b4411c7b5402b16ca6b4c8ba5a4245c2b5d8bee955e8d3a9a73a1ec7",
    reviewedTextRu: "Марино Фаттори (1832-1896) - саммаринский писатель, историк и политический деятель. Его книга «Ricordi storici della Repubblica di San Marino» впервые вышла в 1869 году.",
    evidence: [
      e("Treccani - Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/marino-fattori_%28Dizionario-Biografico%29/", "Биографический словарь подтверждает даты 1832-1896, писательскую, историческую и политическую деятельность Фаттори и издание «Ricordi storici» в 1869 году."),
      e("Università di Bologna", "https://amsacta.unibo.it/id/eprint/877/1/annale_1999-2000.pdf", "Университетское издание независимо идентифицирует Марино Фаттори 1832-1896 годов как деятеля истории и культуры Сан-Марино и рассматривает его исторические труды."),
    ],
    decision: "corrected",
    notes: "Не подтверждённая источниками роль поэта и оценочная формула о национальной традиции заменены документированными профессиями и историческим трудом.",
  },
  {
    key: "sao_tome_and_principe:alda_do_espirito_santo",
    originalSha256: "5c79891c55e6d05ee5ac809f895182906358ef4ed27b0a618c29373cef4ee87f",
    reviewedTextRu: "Алда ду Эшпириту Санту (1926-2010) - поэтесса, педагог и государственный деятель Сан-Томе и Принсипи. Она занимала посты министра образования и культуры и депутата, а её поэзия связана с антиколониальной борьбой и национальной идентичностью.",
    evidence: [
      e("Universidade de Lisboa", "https://repositorio.ulisboa.pt/bitstream/10451/29963/7/ulfl236837_tm_Sebenta_12-parte3.pdf", "Университетское исследование подтверждает даты 1926-2010, педагогическую, поэтическую и политическую деятельность Алды и антиколониальный контекст её стихов."),
      e("Instituto Internacional da Língua Portuguesa - CPLP", "https://iilp.cplp.org/2026/03/10/conferencia-internacional-centenario-de-alda-espirito-santo-2026/", "Межгосударственный институт независимо подтверждает столетие со дня рождения в 2026 году, годы 1926-2010 и её деятельность как поэтессы, педагога, министра и депутата."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено датами и конкретными государственными должностями; тематическая формулировка сохранена только в объёме, прямо подтверждённом академическими источниками.",
  },
  {
    key: "sao_tome_and_principe:francisco_jose_tenreiro",
    originalSha256: "e411890c69a70525f6f1a1fdf071f9680a8c280e7dd1e7eb3388a549b149e9d0",
    reviewedTextRu: "Франсишку Жозе Тенрейру (1921-1963) - поэт и географ, родившийся на Сан-Томе. Он написал сборники «Ilha de Nome Santo» и «Coração em África» и защитил исследование по географии острова Сан-Томе.",
    evidence: [
      e("Universidade de Lisboa", "https://repositorio.ulisboa.pt/entities/publication/6766374f-c47b-429e-8f03-d71e392144fe", "Университетский репозиторий подтверждает годы 1921-1963, деятельность Тенрейру как поэта и географа, его происхождение с Сан-Томе и географическое исследование острова."),
      e("Assembleia da República Portuguesa", "https://app.parlamento.pt/webutils/docs/doc.pdf?Inline=&fich=11_12_08_Lan%C3%A7amento+livro+Pr+ANSTP+_+11+Dez+08.pdf&path=6148523063446f764c324679626d56304c334e706447567a4c31684d5255637652304643554546534c306442516c4242556b467963585670646d3876535735305a584a325a57374470384f315a584d6c4d6a424a626e526c636d356c6443395159584a735957316c626e52764c7a4578587a4579587a41345830786862734f6e5957316c626e52764a54497762476c32636d386c4d6a4251636955794d45464f553152514a544977587955794d4445784a544977524756364a5449774d4467756347526d", "Материалы парламента Португалии независимо подтверждают биографию Тенрейру и сборники «Ilha de Nome Santo» и «Coração em África»."),
    ],
    decision: "corrected",
    notes: "Литературоведческая интерпретация и утверждение о формировании направления заменены датами, произведениями и проверяемой научной работой.",
  },
  {
    key: "senegal:birago_diop",
    originalSha256: "6d023fb1703a59bed0e7aca8448ad760f6308b48584e99dbf237a2e5459e3437",
    reviewedTextRu: "Бираго Диоп (1906-1989) - сенегальский писатель, поэт и ветеринар. Он опубликовал сборники «Les Contes d’Amadou Koumba» и «Les Nouveaux Contes d’Amadou Koumba», переработав материал устной традиции.",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11900243p", "Авторитетная запись BnF подтверждает даты 11 декабря 1906 - 25 ноября 1989 года, профессию ветеринарного врача и литературную деятельность Диопа."),
      e("Université Cheikh Anta Diop de Dakar - Revue d’Études Africaines", "https://rea.ucad.sn/index.php/rea/article/download/16/15/61", "Академическая публикация подтверждает переработку Диопом устных рассказов гриота Амаду Кумба и роль этого материала в его книгах."),
    ],
    decision: "corrected",
    notes: "Общее утверждение об известности конкретизировано профессиями и двумя книгами; написание имени приведено к форме «Бираго». Текущие даты профиля подтверждены BnF.",
  },
  {
    key: "senegal:boubacar_boris_diop",
    originalSha256: "fd9369045f7321179a0ce6daf4ee2a4696888eb60d6a7de9a66d4accfed60339",
    reviewedTextRu: "Бубакар Борис Диоп (род. 1946) - сенегальский романист, драматург, эссеист и журналист. Среди его книг - «Les Tambours de la mémoire» и «Murambi, le livre des ossements».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119002441", "Авторитетная запись BnF подтверждает 1946 год рождения, сенегальское авторство и библиографию романов и эссе Диопа."),
      e("University of Oklahoma", "https://www.ou.edu/insideou/articles/2022/october/senegalese-writer-boubacar-boris-diop-to-headline-2022-neustadt-festival.html", "Университетская биография независимо подтверждает работу Диопа как романиста, драматурга, эссеиста и журналиста и называет «Les Tambours de la mémoire» и «Murambi»."),
    ],
    decision: "corrected",
    notes: "Расплывчатая роль «интеллектуал» заменена документированными литературными занятиями и двумя произведениями; русская передача имени нормализована.",
  },
  {
    key: "senegal:cheikh_hamidou_kane",
    originalSha256: "874fd475c127aa25abb383f45035009a6c2fac2c808902ef870fba8446b008a8",
    reviewedTextRu: "Шейх Хамиду Кан (род. 1928) - сенегальский писатель. Он написал романы «L’Aventure ambiguë» и «Les Gardiens du temple».",
    evidence: [
      e("Bibliothèque nationale de France", "https://data.bnf.fr/fr/11909378/cheikh_hamidou_kane/", "Авторитетная запись BnF подтверждает 1928 год рождения, сенегальское происхождение и авторство двух романов Кана."),
      e("Indiana University Press - Journal of World Philosophies", "https://scholarworks.iu.edu/iupjournals/index.php/jwp/article/view/4043", "Университетская публикация независимо идентифицирует Шейха Хамиду Кана как автора «L’Aventure ambiguë» и рассматривает этот роман."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование романа удалено; карточка дополнена годом рождения и двумя произведениями.",
  },
  {
    key: "senegal:david_diop",
    originalSha256: "50b31e733ebc8c2529247a7470940c4fed74847cbe8afe9f9fdc165b83b30d29",
    reviewedTextRu: "Давид Мандесси Диоп (1927-1960) - сенегальский поэт, связанный с движением негритюда. Его основной прижизненный сборник - «Coups de pilon».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11900245c", "Авторитетная запись BnF подтверждает полное имя, даты 1927-1960 и авторство сборника «Coups de pilon»."),
      e("Smithsonian Institution Libraries", "https://www.si.edu/object/siris_sil_37119", "Каталог Смитсоновского института независимо подтверждает библиографию «Coups de pilon» Давида Диопа и его связь с франкоязычной африканской поэзией."),
    ],
    decision: "corrected",
    notes: "Исходный факт сохранён и конкретизирован полным именем, датами и названием поэтического сборника.",
  },
  {
    key: "senegal:fatou_diome",
    originalSha256: "1e510bec49532b385e49fcb1c013d6c801d1d414f3da29112612b625e9f45507",
    reviewedTextRu: "Фату Диом (род. 1968) - франко-сенегальская писательница. Она написала сборник «La Préférence nationale» и романы «Le Ventre de l’Atlantique» и «Celles qui attendent».",
    evidence: [
      e("Bibliothèque nationale de France", "https://data.bnf.fr/ark%3A/12148/cb136132003", "Авторитетная запись BnF подтверждает 1968 год рождения, сенегальское происхождение и библиографию книг Фату Диом."),
      e("Université de Strasbourg", "https://prix-louiseweiss2015.unistra.fr/index577b.html?id=22284", "Университетская биография независимо подтверждает франко-сенегальскую писательскую деятельность и книги «La Préférence nationale», «Le Ventre de l’Atlantique» и «Celles qui attendent»."),
    ],
    decision: "corrected",
    notes: "Краткое исходное описание дополнено годом рождения и тремя документированными книгами; искусственная точная дата 1968-01-01 сокращена до подтверждённого года.",
  },
  {
    key: "senegal:felwine_sarr",
    originalSha256: "0f7d6224e68a0afffcc2670bcf9a6f7fd87441ad1cce86fbd58c02bd4f55a295",
    reviewedTextRu: "Фелвин Сарр (род. 1972) - сенегальский экономист, философ, писатель и музыкант, профессор Университета Дьюка. Он написал эссе «Afrotopia» и сборник рассказов «105, rue Carnot».",
    evidence: [
      e("Duke University - Forum for Scholars and Publics", "https://fsp.duke.edu/speakers/felwine-sarr/", "Профиль Университета Дьюка подтверждает работу Сарра как философа, экономиста, музыканта и профессора и книги «Afrotopia» и «105, rue Carnot»."),
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb475687112", "Каталог BnF независимо подтверждает 1972 год рождения в Ниодиоре и авторство сборника рассказов «105, rue Carnot»."),
      e("Réseau français des instituts d’études avancées", "https://rfiea.fr/sites/default/files/newsletters/rfiea-fellows-annuaire2018_web.pdf", "Академический справочник указывает точную дату и место рождения: 11 сентября 1972 года, Ниодиор, Сенегал."),
    ],
    decision: "corrected",
    notes: "Расплывчатая роль «интеллектуал» заменена документированными профессиями, университетской должностью и книгами. Исправлены дата рождения с 12 на 11 сентября 1972 года и ошибочное место рождения «Нгай» на Ниодиор.",
  },
  {
    key: "senegal:ken_bugul",
    originalSha256: "421b948addd0aff7aee12a67b5084952bd71725bb94997e88ae72f73e255a006",
    reviewedTextRu: "Кен Бугул - литературный псевдоним сенегальской писательницы Мариэту Мбайе Билеомы. Она написала романы «Le Baobab fou» и «Riwan ou le chemin de sable».",
    evidence: [
      e("University of Iowa - International Writing Program", "https://iwp.uiowa.edu/writers/2006-resident/ken-bugul", "Университетский профиль подтверждает, что Кен Бугул - псевдоним сенегальской писательницы Мариэту Мбайе Билеомы, и перечисляет её романы."),
      e("Harvard University Center for African Studies", "https://africa.harvard.edu/event/panel-african-literatures-bridging-languages-places-and-times", "Гарвардский материал независимо идентифицирует Кен Бугул как сенегальскую писательницу и автора «Le Baobab fou» и «Riwan ou le chemin de sable»."),
    ],
    decision: "corrected",
    notes: "Общее утверждение об известности заменено документированными настоящим именем, характером псевдонима и двумя романами. Спорные дата и место рождения очищены, русское написание псевдонима исправлено.",
  },
  {
    key: "senegal:leopold_sedar_senghor",
    originalSha256: "87c484cee5d540379f8d2ec62dba11088aacfe6486ac89c5e1e78199a37f4c0e",
    reviewedTextRu: "Леопольд Седар Сенгор (1906-2001) - сенегальский поэт и государственный деятель, один из создателей концепции негритюда. В 1960-1980 годах он был первым президентом Сенегала, а в 1983 году избран во Французскую академию.",
    evidence: [
      e("Académie française", "https://www.academie-francaise.fr/les-immortels/leopold-sedar-senghor", "Французская академия подтверждает годы 1906-2001, поэтическую и государственную деятельность, президентство в 1960-1980 годах и избрание в 1983 году."),
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb119244261", "Авторитетная запись BnF независимо подтверждает даты, сенегальскую государственную и литературную деятельность Сенгора и его связь с негритюдом."),
    ],
    decision: "corrected",
    notes: "Исходные факты сохранены и конкретизированы датами президентского срока и избрания в Академию; формула о негритюде привязана к подтверждённой концепции.",
  },
  {
    key: "senegal:mariama_ba",
    originalSha256: "f26d2e44d297b8f4a02b126d488bbe9126c5c64078fc73764f31bde9868af4a0",
    reviewedTextRu: "Мариама Ба (1929-1981) - сенегальская писательница и педагог. Она написала романы «Une si longue lettre» и «Un chant écarlate».",
    evidence: [
      e("Yale University", "https://campuspress.yale.edu/languedecesaire/authors-ecrivain-e-s/mariama-ba/", "Йельский университет подтверждает годы 1929-1981, работу Мариамы Ба как писательницы и педагога и два её романа."),
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb473155629", "Каталог BnF независимо подтверждает авторство «Une si longue lettre» и «Un chant écarlate» и библиографические данные Мариамы Ба."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено датами, профессиями и двумя романами.",
  },
  {
    key: "senegal:ousmane_sembene",
    originalSha256: "c00754e2ad820aab21008eba470b6c15b2a84ebb4b05d07dc55bcc4d5487a384",
    reviewedTextRu: "Усман Сембен (1923-2007) - сенегальский писатель и кинорежиссёр. Он написал роман «Les Bouts de bois de Dieu» и снял фильмы «La Noire de…» и «Xala».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11924383k", "Авторитетная запись BnF подтверждает годы 1923-2007, сенегальскую писательскую и режиссёрскую деятельность Сембена и его произведения."),
      e("Harvard Film Archive", "https://harvardfilmarchive.org/programs/ousmane-sembene-cinematic-revolutionary-2/3", "Архив Гарвардского университета независимо подтверждает работу Сембена в литературе и кино и фильмы «La Noire de…» и «Xala»."),
    ],
    decision: "corrected",
    notes: "Субъективная формула об основоположничестве заменена датами, профессиями, романом и двумя фильмами.",
  },
  {
    key: "serbia:branko_radicevic",
    originalSha256: "4f4e85e891f55bdf4df618936e828ef562048e6cb1b5ecb154710b5b80af2f15",
    reviewedTextRu: "Бранко Радичевич (1824-1853) - сербский поэт-романтик и сторонник языковой реформы Вука Караджича. Его первый сборник «Pesme» вышел в 1847 году.",
    evidence: [
      e("National Library of Serbia - Digital Collections", "https://digital.nb.rs/sf/NBS/TematskeZbirke/Branko_Radicevic", "Национальная библиотека подтверждает даты 1824-1853, деятельность Радичевича как сербского поэта-романтика и значение его первой книги."),
      e("University of Belgrade - Virtual Museum of the Serbian Language", "https://muzejsrpskogjezika.fil.bg.ac.rs/?cat=-1", "Университетский музей подтверждает поддержку Радичевичем реформы Вука Караджича и публикацию первого сборника «Pesme» в 1847 году."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено датами, литературным направлением, отношением к языковой реформе и первым сборником.",
  },
  {
    key: "serbia:danilo_kis",
    originalSha256: "20718cb053de39ebb0d5b90596aa966c066797f204b37fa71a8c315035e4a720",
    reviewedTextRu: "Данило Киш (1935-1989) - югославский писатель, выпускник кафедры сравнительного литературоведения Белградского университета. Он написал книги «Bašta, pepeo», «Grobnica za Borisa Davidoviča» и «Enciklopedija mrtvih».",
    evidence: [
      e("National Library of Serbia", "https://nb.rs/ostavstina-danilo-kis/", "Национальная библиотека описывает архив Киша, содержащий его биографию, библиографию и литературное наследие, и подтверждает идентичность писателя."),
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=11909794", "Каталог BnF независимо подтверждает годы 1935-1989 и авторство «Grobnica za Borisa Davidoviča» и «Enciklopedija mrtvih»."),
      e("University of Belgrade - Faculty of Philology", "https://www.fil.bg.ac.rs/en/departments/department-of-comparative-literature-and-literary-theory", "История кафедры Белградского университета подтверждает обучение Киша на первой в Югославии программе сравнительного литературоведения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено датами, образованием и тремя книгами.",
  },
  {
    key: "serbia:dositej_obradovic",
    originalSha256: "fca24b06876f007fe2e05236eca6d76780fd1e974531e2ee37ae0b1787ebc385",
    reviewedTextRu: "Доситей Обрадович (1739/1742-1811) - сербский писатель-просветитель и первый министр просвещения Сербии. Он был одним из основателей Великой школы в Белграде и автором автобиографической книги «Život i priključenija».",
    evidence: [
      e("National Museum of Serbia - Museum of Vuk and Dositej", "https://www.narodnimuzej.rs/about-museum/locations-of-the-national-museum/museum-of-vuk-and-dositej/?lang=en", "Национальный музей подтверждает просветительскую и писательскую деятельность Обрадовича, его пост первого министра просвещения и книгу «Život i priključenija»."),
      e("Serbian Academy of Sciences and Arts - Virtual Museum", "https://www.mi.sanu.ac.rs/muzej.beograd/d/eng/sad/znaml_21.htm", "Виртуальный музей САНУ независимо связывает Обрадовича с основанием Великой школы и приводит основные биографические сведения."),
    ],
    decision: "corrected",
    notes: "Общая оценочная формула заменена государственным постом, участием в создании Великой школы и произведением. Национальный музей приводит варианты 1739/1742, поэтому профильный год рождения и неустойчивая точная дата смерти очищены, а интервал лет передаёт разночтение.",
  },
  {
    key: "serbia:ivo_andric",
    originalSha256: "547942fda61afc3a5e9352067f2d2a46202dc574ea346422b182a338bebf981b",
    reviewedTextRu: "Иво Андрич (1892-1975) - югославский писатель и дипломат, лауреат Нобелевской премии по литературе 1961 года. Он написал романы «Мост на Дрине» и «Травницкая хроника».",
    evidence: [
      e("Nobel Prize", "https://www.nobelprize.org/prizes/literature/1961/andric/biographical/", "Нобелевский архив подтверждает годы 1892-1975, писательскую и дипломатическую деятельность Андрича и премию 1961 года."),
      e("Ivo Andrić Foundation", "https://ivoandric.org.rs/english/biography", "Официальный фонд независимо подтверждает биографию Андрича и авторство романов «Мост на Дрине» и «Травницкая хроника»."),
    ],
    decision: "corrected",
    notes: "Верный исходный факт дополнен датами, дипломатической деятельностью и двумя романами.",
  },
  {
    key: "serbia:laza_kostic",
    originalSha256: "ca7cc8d2d4e06c8b18de4e65bda2a84f4d8f22f1d7bd22a3ff154bfc92fc44c4",
    reviewedTextRu: "Лаза Костич (1841-1910) - сербский писатель, поэт, драматург и переводчик. Он написал драму «Maksim Crnojević» и поэму «Santa Maria della Salute».",
    evidence: [
      e("Serbian Academy of Sciences and Arts", "https://www.sanu.ac.rs/en/member/kostic-laza/", "САНУ подтверждает роли писателя, поэта и драматурга и приводит двойную дату рождения 31 января/12 февраля 1841 года, смерть в Вене 26 ноября 1910 года по старому стилю."),
      e("National Library of Serbia - DOI Serbia", "https://doiserbia.nb.rs/Article.aspx?id=0350-66732288051V", "Академическая статья Белградского университета подтверждает авторство поэмы «Santa Maria della Salute», даты 1841-1910 и её публикацию в 1909 году."),
      e("National Library of Serbia - DOI Serbia", "https://doiserbia.nb.rs/Article.aspx?id=1450-98140808151M", "Другая академическая публикация подтверждает авторство драмы «Maksim Crnojević» и работу Костича как переводчика Шекспира."),
    ],
    decision: "corrected",
    notes: "Исходные роли подтверждены и дополнены двумя произведениями. САНУ приводит рождение 31 января/12 февраля 1841 года; для профиля выбран новый стиль 12 февраля. Дата смерти в карточке 9 декабря соответствует новому стилю для указанного САНУ 26 ноября 1910 года.",
  },
];

export const writerBiographyFactReviewBatch47: readonly WriterBiographyFactReviewRecord[] = seeds.map(
  (seed) => {
    const verdict: WriterBiographyClaimVerdict =
      seed.decision === "held"
        ? "not-established"
        : seed.decision === "unchanged"
          ? "supported"
          : "corrected";
    return {
      key: seed.key,
      originalSha256: seed.originalSha256,
      reviewedTextRu: seed.reviewedTextRu,
      applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
      claims: [
        {
          textRu: seed.reviewedTextRu,
          verdict,
          evidence: seed.evidence.map(([provider, url, findingRu, evidenceCheckedAt]) => ({
            provider,
            url,
            checkedAt: evidenceCheckedAt || checkedAt,
            findingRu,
          })),
        },
      ],
      reviewer,
      decision: seed.decision,
      notes: seed.notes,
    };
  }
);
