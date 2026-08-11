export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH34_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 34";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH34_REVIEWER;
const checkedAt = "2026-08-11";

type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const seeds = [
  {
    key: "italy:dante_alighieri",
    originalSha256: "55e4381f425e244d48e896f8dd1e17125a3592e579803ef8d71c29b1cb20b97d",
    reviewedTextRu: "Данте Алигьери — флорентийский поэт и мыслитель, автор «Божественной комедии», «Новой жизни» и «Пира». Точная дата его рождения неизвестна и определяется лишь промежутком между маем и июнем 1265 года; он умер в Равенне в ночь с 13 на 14 сентября 1321 года.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/dante-alighieri/", "Энциклопедия указывает Флоренцию и промежуток между маем и июнем 1265 года как время рождения, Равенну и ночь с 13 на 14 сентября 1321 года как место и время смерти."],
      ["Stanford Encyclopedia of Philosophy", "https://plato.stanford.edu/entries/dante/", "Академическая статья подтверждает Флоренцию и 1265 год, но выводит май–июнь лишь из собственного указания Данте на знак Близнецов; отдельно рассматривает «Божественную комедию», «Новую жизнь» и «Пир»."],
    ],
    decision: "corrected",
    notes: "Текущие годы, места и произведения подтверждены, но значения 1265-05-21 и 1321-09-14 создают ложную точность: источники дают диапазон рождения и ночь между двумя датами смерти.",
  },
  {
    key: "italy:dario_fo",
    originalSha256: "5800e18454cbb5c932b3f948da87b7c648035647216161854a8f9267448b067d",
    reviewedTextRu: "Дарио Фо — итальянский драматург, актёр, режиссёр и сценограф, соединивший традиции средневекового фарса и комедии дель арте с политической сатирой. Его пьесы «Мистерия-буфф» и «Случайная смерть анархиста» предшествовали присуждению Нобелевской премии по литературе 1997 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1997/fo/facts/", "Нобелевский профиль приводит даты 24 марта 1926 — 13 октября 2016, место рождения Leggiuno-Sangiano, место смерти Милан, премию 1997 года и пьесы Mistero Buffo, Accidental Death of an Anarchist и We Won’t Pay, We Won’t Pay!"],
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/dario-fo_%28Dizionario-Biografico%29/", "Биографический словарь подтверждает рождение 24 марта 1926 года в Санджано, смерть 13 октября 2016 года в Милане и многопрофильную работу Фо в театре."],
    ],
    decision: "corrected",
    notes: "Все даты, произведения и Нобелевская премия подтверждены; текущее место рождения «Леньяно» ошибочно и должно быть заменено на Санджано в коммуне Леджуно.",
  },
  {
    key: "italy:dino_buzzati",
    originalSha256: "13de87b0e2aa2d433be1ea068e5f1e9f5b1e4f0fae5181e8b91aab4de53036e7",
    reviewedTextRu: "Дино Буццати — итальянский писатель, журналист и художник; многолетняя работа в Corriere della Sera сосуществовала у него с прозой, соединяющей повседневность и тревожную фантастику. К его основным книгам относятся «Татарская пустыня», сборник «Шестьдесят рассказов» и роман «Любовь».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/dino-buzzati/", "Энциклопедия фиксирует годы 1906–1972, связь писателя с Беллуно и Миланом, журналистскую работу и основные книги, включая «Татарскую пустыню», «Шестьдесят рассказов» и «Любовь»."],
      ["Rai Cultura", "https://www.raicultura.it/speciali/dinobuzzati", "Редакционный профиль RAI сообщает, что Буццати родился 16 октября 1906 года в Сан-Пеллегрино у Беллуно и умер в Милане 28 января 1972 года; отдельно рассматривает его литературные книги и журналистику."],
    ],
    decision: "corrected",
    notes: "Даты, место смерти и произведения подтверждены; в текущем birthPlace допущена опечатка «Бельзуно», тогда как город называется Беллуно.",
  },
  {
    key: "italy:elena_ferrante",
    originalSha256: "b8fa0ea984541f12d58bbb633d28bff7686a6a1d6314fbb261c54bb9b61d62db",
    reviewedTextRu: "Елена Ферранте — литературный псевдоним автора, чья личность не раскрыта публично. Неаполитанский цикл, начинающийся романами «Моя гениальная подруга» и «История нового имени», а также «Дни одиночества» исследуют дружбу, материнство, взросление и социальную среду Италии.",
    evidence: [
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/2172029/elena-ferrante/", "Издательский профиль прямо называет Elena Ferrante псевдонимом итальянского романиста и перечисляет Неаполитанские романы, включая My Brilliant Friend и The Story of a New Name."],
      ["Padova University Press", "https://www.padovauniversitypress.it/it/publications/9788869381300", "Университетское издание подчёркивает, что настоящее имя автора не раскрыто издательством, и рассматривает попытки атрибуции как исследовательские гипотезы, а не установленную биографию."],
      ["Elena Ferrante — официальный каталог произведений", "https://elenaferrante.com/works/", "Официальный каталог подтверждает состав Неаполитанского цикла и отдельный роман The Days of Abandonment."],
    ],
    decision: "corrected",
    notes: "Год рождения 1943 и Неаполь как место рождения не подтверждены для скрывающего личность автора и не должны подаваться как биографические факты; произведения подтверждены.",
  },
  {
    key: "italy:emilio_salgari",
    originalSha256: "e49171ff81ecc34ad15d930e74e3705c7b75d4830f524c8f0d0379704136b14c",
    reviewedTextRu: "Эмилио Сальгари — итальянский автор приключенческих романов, создававший экзотические миры главным образом по книгам, картам и периодике, а не по собственным дальним путешествиям. Среди его книг и циклов — «Чёрный корсар», «Тигры Момпрачема» и «Тайны чёрных джунглей».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/emilio-salgari/", "Энциклопедия указывает годы 1862–1911, Верону и Турин, более восьмидесяти приключенческих романов и перечисляет Il corsaro nero, Le tigri di Mompracem и I misteri della giungla nera."],
      ["Bibliothèque nationale de France", "https://data.bnf.fr/fr/11923463/emilio_salgari/", "Авторитетная запись BnF подтверждает личность и годы Эмилио Сальгари; каталог связывает с ним Il corsaro nero, Le tigri di Mompracem и другие приключенческие произведения."],
    ],
    decision: "corrected",
    notes: "В legacy-слое была только краткая заметка без профиля. Точные день и месяц рождения и смерти не добавляются: разные редакции Treccani расходятся в этих датах; надёжно подтверждены годы, города и произведения.",
  },
  {
    key: "italy:eugenio_montale",
    originalSha256: "e4328c143b9aee878e26a9b9b90a135a8effacd0dcc1c50775f964ef6c8f23dc",
    reviewedTextRu: "Эудженио Монтале — итальянский поэт, критик и переводчик, автор сборников «Кости каракатицы», «Буря и другое» и «Сатура». В 1975 году он получил Нобелевскую премию по литературе за поэзию, соединяющую строгую форму с неиллюзорным взглядом на человеческий опыт.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1975/montale/biographical/", "Нобелевская биография подтверждает годы жизни, литературную и критическую деятельность, основные сборники и Нобелевскую премию 1975 года."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/eugenio-montale", "Литературный профиль фиксирует 1896–1981 годы, рождение в Генуе, работу поэта, переводчика и критика, а также сборники Ossi di seppia и Satura."],
    ],
    decision: "corrected",
    notes: "Текущие даты, города, произведения и премия согласуются с проверенными источниками; требуется только более содержательная редакционная биография.",
  },
  {
    key: "italy:francesco_petrarca",
    originalSha256: "7d4895b9f85081e1c74b52b7d282dc1c84a0decea93b21799f54258a0a779f56",
    reviewedTextRu: "Франческо Петрарка — итальянский поэт, филолог и гуманист, чьи латинские сочинения и лирический «Канцоньере» стали важными ориентирами европейского гуманизма и любовной поэзии. К его основным книгам также относятся «Триумфы» и диалог «Моя тайна».",
    evidence: [
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/francesco-petrarca_%28Dizionario-Biografico%29/", "Современная словарная статья подтверждает Ареццо, 1304 год и смерть в Аркуа в 1374 году, но отмечает сомнения даже вокруг традиционной даты рождения и диапазон дат смерти в ранних источниках."],
      ["University of Bologna", "https://www.unibo.it/en/university/who-we-are/our-history/famous-people-and-students/Petrarch", "Университетский профиль называет Петрарку гуманистом, поэтом, филологом и философом, приводит традиционные даты 20 июля 1304 — 19 июля 1374 и описывает его гуманистическое наследие."],
      ["Academy of American Poets", "https://poets.org/poet/petrarch", "Профиль подтверждает Ареццо, 1304–1374 годы и «Канцоньере», отдельно указывая, что смерть датируется 18 или 19 июля."],
    ],
    decision: "corrected",
    notes: "Годы, города и произведения подтверждены. Точные birthDate и deathDate в базе следует убрать: современная Treccani подчёркивает традиционный и спорный характер первой даты, а смерть относится к ночи между 18 и 19 июля.",
  },
  {
    key: "italy:gabriele_d_annunzio",
    originalSha256: "246faa8057bd81eb6627c5423515ca04833461b20da590886402875061075f44",
    reviewedTextRu: "Габриэле Д’Аннунцио — итальянский поэт, прозаик и драматург, один из заметных представителей европейского декаданса; его литературная деятельность была тесно переплетена с военной и политической публичностью. Романы «Наслаждение» и «Триумф смерти» и драма «Дочь Иорио» показывают разные стороны его эстетизма и мифотворчества.",
    evidence: [
      ["Il Vittoriale degli Italiani", "https://www.vittoriale.it/en/biography/", "Официальная биография музея сообщает о рождении в Пескаре 12 марта 1863 года, литературной и общественной деятельности и смерти в Витториале 1 марта 1938 года."],
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/gabriele-d-annunzio_%28Dizionario-Biografico%29/", "Словарная статья подтверждает точные даты, Пескару и Витториале и подробно рассматривает поэзию, прозу, драматургию и политическую биографию Д’Аннунцио."],
    ],
    decision: "corrected",
    notes: "Текущие даты, места и три произведения подтверждены; новая редакционная формулировка не скрывает неоднозначную общественно-политическую сторону биографии.",
  },
  {
    key: "italy:giacomo_leopardi",
    originalSha256: "7583413e82b0329c34830918ecbf4e16c8029a793e3e4866387358cab77964b6",
    reviewedTextRu: "Джакомо Леопарди — итальянский поэт, мыслитель, филолог и переводчик, чьи «Песни», «Нравственные очерки» и «Дзибальдоне» соединяют лирику с последовательным исследованием человеческого желания, природы и несчастья. Он родился в Реканати 29 июня 1798 года и умер в Неаполе 14 июня 1837 года.",
    evidence: [
      ["Casa Leopardi", "https://www.giacomoleopardi.it/en/life-and-works/", "Официальный биографический ресурс семьи и музея приводит точные даты и места рождения и смерти и связывает с Леопарди Canti, Operette morali и Zibaldone."],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/giacomo-leopardi", "Литературный профиль подтверждает годы 1798–1837, Реканати, смерть в Неаполе и характеризует Леопарди как писателя, переводчика и мыслителя; отдельно рассматривает Canti и Operette morali."],
    ],
    decision: "corrected",
    notes: "Даты и места подтверждены. «Бесконечность» — отдельное стихотворение, поэтому для поля works последовательнее перечислить книги и корпуса: «Песни», «Нравственные очерки», «Дзибальдоне».",
  },
  {
    key: "italy:giambattista_marino",
    originalSha256: "17e305441c9d85de82286a6f4d589616fd7213e8dac334cee3d30a186d13b694",
    reviewedTextRu: "Джамбаттиста Марино — итальянский поэт барокко, чья изощрённая метафорика и стремление к эффектному удивлению дали имя маринизму. Его главные книги — лирическая «Лира» и большая мифологическая поэма «Адонис».",
    evidence: [
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/giovan-battista-marino_%28Dizionario-Biografico%29/", "Современная статья указывает Неаполь, 1569–1625 годы, дату смерти 25 марта 1625 года и основные поэтические книги; при этом датирует рождение 14 октября."],
      ["Bibliothèque nationale de France", "https://data.bnf.fr/fr/ark:/12148/cb12158025x", "Авторитетная запись BnF подтверждает личность, Неаполь и дату смерти 25 марта 1625 года, но приводит 18 октября 1569 года как дату рождения."],
    ],
    decision: "corrected",
    notes: "Текущая deathDate 1625-03-26 ошибочна. Авторитетные источники расходятся между 14 и 18 октября в дате рождения, поэтому birthDate удаляется вместо выбора одной версии; годы, города и произведения подтверждены.",
  },
  {
    key: "italy:giosue_carducci",
    originalSha256: "2465d81a14a437189ceeb0ad82e0961e58906898dd299aa0004b3b1b9fdd485b",
    reviewedTextRu: "Джозуэ Кардуччи — итальянский поэт, литературовед и профессор Болонского университета, развивавший гражданскую и историческую лирику в диалоге с античной метрикой. Сборники «Новые рифмы», «Варварские оды» и «Рифмы и ритмы» предшествовали Нобелевской премии по литературе 1906 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1906/carducci/bibliography/", "Нобелевская библиография подтверждает Rime nuove, три выпуска Odi barbare и Rime e ritmi; материалы премии фиксируют награду 1906 года и смерть 16 февраля 1907 года."],
      ["University of Bologna — Historical Archive", "https://archiviostorico.unibo.it/it/patrimonio-documentario/ritratti-di-docenti?record=132848", "Университетский архив подтверждает даты 27 июля 1835 — 16 февраля 1907 и профессорскую деятельность Кардуччи в Болонье."],
      ["Treccani", "https://www.treccani.it/enciclopedia/giosue-carducci_%28Enciclopedia-dell%27Italiano%29/", "Энциклопедия указывает Вальдикастелло и Болонью, точные даты и сборники Rime nuove, Odi barbare и Rime e ritmi."],
    ],
    decision: "corrected",
    notes: "Дата, место рождения и премия верны; следует добавить место смерти Болонья и исправить название Rime nuove с неточного «Новые стихи» на «Новые рифмы».",
  },
  {
    key: "italy:giovanni_boccaccio",
    originalSha256: "5ca0dbced56aa3a38f07e0d2237cce7900acd51d8545b27e3232048b140280e8",
    reviewedTextRu: "Джованни Боккаччо — итальянский прозаик, поэт и гуманист, автор «Декамерона», а также «Филоколо» и «Элегии мадонны Фьяметты». Он родился в 1313 году — вероятнее всего во Флоренции или Чертальдо — и умер в Чертальдо 21 декабря 1375 года.",
    evidence: [
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/giovanni-boccaccio_%28Dizionario-Biografico%29/", "Современная статья датирует рождение промежутком июня–июля 1313 года и считает Флоренцию более вероятной, чем Чертальдо; подтверждает смерть в Чертальдо 21 декабря 1375 года и основные произведения."],
      ["Bibliothèque nationale de France", "https://www.bnf.fr/sites/default/files/2018-11/biblio%20boccace.pdf", "Библиографический обзор BnF указывает 1313–1375 годы, Флоренцию или Чертальдо как место рождения и перечисляет «Декамерон», «Филоколо» и Elegia di Madonna Fiammetta."],
    ],
    decision: "corrected",
    notes: "Точная birthDate 1313-06-16 не подтверждается и должна быть удалена. Место рождения сохраняется как честная альтернатива, а сокращённое «Фьяметта» уточняется до полного названия произведения.",
  },
  {
    key: "italy:giovanni_verga",
    originalSha256: "4c9de94b07ff2743eb0a84038fb50c289efac32538f849542b20ef78db03ab70",
    reviewedTextRu: "Джованни Верга — итальянский прозаик и драматург, центральная фигура веризма, выработавший обезличенную манеру повествования о социальных конфликтах Сицилии. К его главным произведениям относятся «Семья Малаволья», «Мастро-дон Джезуальдо» и «Сельская честь».",
    evidence: [
      ["Fondazione Verga", "https://www.fondazioneverga.it/wp-content/uploads/2024/02/annali16-ok-1.pdf", "Научное издание фонда воспроизводит вывод из записи гражданского состояния: Верга родился в Катании 2 сентября 1840 года; также фиксирует смерть в Катании 27 января 1922 года."],
      ["Treccani — Storia della civiltà europea", "https://www.treccani.it/enciclopedia/giovanni-verga_%28Storia-della-civilt%C3%A0-europea-a-cura-di-Umberto-Eco%29/", "Статья подтверждает Катанию и дату 2 сентября 1840 года, рассматривает веризм и основные книги, включая I Malavoglia и Mastro-don Gesualdo."],
      ["Treccani — Enciclopedia dell’Italiano", "https://www.treccani.it/enciclopedia/giovanni-verga_%28Enciclopedia-dell%27Italiano%29/", "Лингвистическая энциклопедия характеризует прозу Верги на переходе от натурализма к декадансу и перечисляет I Malavoglia, Mastro-don Gesualdo и Cavalleria rusticana."],
    ],
    decision: "corrected",
    notes: "Текущие даты и города подтверждены записью гражданского состояния, а произведения и связь с веризмом — литературоведческими источниками; профильных исправлений не требуется.",
  },
  {
    key: "italy:grazia_deledda",
    originalSha256: "96465b665c0e366c8e6e6247b70d3f89de1196cff3dc5172fa00e49236ef83f8",
    reviewedTextRu: "Грация Деледда — итальянская писательница с Сардинии, чьи романы соединяют наблюдение за островной жизнью с темами вины, веры и семейного долга. «Тростник на ветру», «Пепел» и «Матерь» входят в её основное наследие; в 1926 году ей была присуждена Нобелевская премия по литературе.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1926/deledda/biographical/", "Нобелевская биография связывает Деледду с Нуоро и Римом и перечисляет Cenere, Canne al vento и La madre среди основных романов."],
      ["Nobel Prize — award summary", "https://www.nobelprize.org/prizes/literature/1926/summary/", "Официальная страница подтверждает присуждение Нобелевской премии по литературе за 1926 год и уточняет, что вручение состоялось в 1927 году."],
      ["Rai Cultura", "https://www.raicultura.it/speciali/graziadeledda", "Редакционный спецпроект RAI подтверждает сардинское происхождение, биографические вехи и центральное место островной культуры в прозе Деледды."],
    ],
    decision: "corrected",
    notes: "Даты, города и премия подтверждены. Произведение «Золото» не находится в авторитетных библиографиях Деледды и заменяется на подтверждённый роман «Пепел» (Cenere).",
  },
  {
    key: "italy:italo_calvino",
    originalSha256: "71b752d482c677dde88517f1429ca9d2d48803ff8f3abfe4f2bf3c27790dc0ad",
    reviewedTextRu: "Итало Кальвино — итальянский прозаик и эссеист, прошедший путь от послевоенного неореализма к аллегории, комбинаторной прозе и литературному эксперименту. «Барон на дереве», «Невидимые города», «Замок скрестившихся судеб» и «Если однажды зимней ночью путник» показывают разные этапы этой эволюции.",
    evidence: [
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/italo-calvino_%28Dizionario-Biografico%29/", "Биографический словарь подтверждает рождение Кальвино 15 октября 1923 года в Сантьяго-де-Лас-Вегас на Кубе, смерть в больнице Сиены в ночь с 18 на 19 сентября 1985 года и основные этапы его творчества."],
      ["Bibliothèque nationale de France", "https://www.bnf.fr/sites/default/files/2023-10/Bibliographie_Italo_Calvino.pdf", "Библиография Национальной библиотеки Франции фиксирует авторство и издания основных книг Кальвино, включая «Барона на дереве», «Замок скрестившихся судеб», «Невидимые города» и «Если однажды зимней ночью путник»."],
    ],
    decision: "corrected",
    notes: "Текущие имя, годы, даты, места и набор основных произведений подтверждены. Формулировка биографии расширена без добавления спорных деталей.",
  },
  {
    key: "italy:italo_svevo",
    originalSha256: "fe5b5fbafe3ad024b823d65722b197493e421ec0cf31072441efda3bfd03cdbe",
    reviewedTextRu: "Итало Звево — псевдоним триестского писателя Арона Гектора Шмица, известного в семье как Этторе; его проза соединила деловую среду многоязычного Триеста с ироническим исследованием памяти, самообмана и психологии. Романы «Одна жизнь», «Дряхлость» и «Самопознание Дзено» составляют ядро его наследия.",
    evidence: [
      ["Museo Sveviano", "https://www.museosveviano.it/italo-svevo/", "Музей Звево называет писателя Ароном Гектором Шмицем, домашнее имя — Этторе, подтверждает рождение в Триесте 19 декабря 1861 года, смерть 13 сентября 1928 года и его три романа."],
      ["Ministero della Cultura / Sapienza Università di Roma", "https://www.movio.beniculturali.it/uniroma1/livesandlibraries/it/svevo", "Государственный университетский ресурс подтверждает псевдоним, полное имя Aron Hector (Ettore) Schmitz, даты 19 декабря 1861 — 13 сентября 1928 и последовательность романов Una vita, Senilità и La coscienza di Zeno."],
      ["Большая российская энциклопедия", "https://bigenc.ru/c/italo-zvevo-dd8036", "Русская энциклопедическая статья даёт нормативную форму «Итало Звево», полное имя Арон Гектор (Этторе) Шмиц и русские названия романов «Одна жизнь», «Дряхлость» и «Самопознание Дзено»."],
    ],
    decision: "corrected",
    notes: "Даты и места подтверждены. Русскую форму имени следует привести к энциклопедической «Итало Звево», добавить настоящее имя и заменить неточные названия «Старость» и «Жизнь» на опубликованные формы «Дряхлость» и «Одна жизнь».",
  },
  {
    key: "italy:jacopone_da_todi",
    originalSha256: "80d6fa62e4ed22aec7272890d6ebc286d4db518fc656f6de638b007fa69bae0d",
    reviewedTextRu: "Якопоне да Тоди — умбрийский францисканский поэт XIII века, один из главных авторов итальянской религиозной лауды. Его «Лауды» соединяют мистическое переживание, покаянную резкость и полемику с церковной властью; многие подробности ранней биографии известны лишь из поздней традиции.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/iacopone-da-todi_%28Enciclopedia-Italiana%29/", "Энциклопедия указывает приблизительное рождение в Тоди около 1230 года, францисканскую деятельность, корпус лауд и смерть в Коллаццоне 25 декабря 1306 года."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12197319d", "Авторитетная запись BnF подтверждает форму имени Jacopone da Todi, приблизительный 1230 год рождения в Тоди, смерть в 1306 году в Коллаццоне и деятельность францисканца и поэта."],
    ],
    decision: "corrected",
    notes: "Текущая осторожная форма «ок. 1230», место рождения, дата и место смерти и «Лауды» подтверждены. Ранние биографические легенды не выдаются за установленные факты.",
  },
  {
    key: "italy:ludovico_ariosto",
    originalSha256: "a922ed91dfabe0bd0e49ddefdc3fb496ddfc209832e6697b175057948a628e36",
    reviewedTextRu: "Лудовико Ариосто — итальянский поэт и придворный деятель эпохи Возрождения, связанный с двором Эсте в Ферраре. Его «Неистовый Роланд», продолживший сюжет Боярдо, превратил рыцарский материал в многоголосую поэму об иллюзиях, любви, войне и изменчивости человеческих желаний.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/ludovico-ariosto_%28Storia-della-civilt%C3%A0-europea-a-cura-di-Umberto-Eco%29/", "Treccani подтверждает рождение Ариосто 8 сентября 1474 года в Реджо-Эмилии, службу при дворе Эсте и работу над тремя редакциями Orlando furioso."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11889084c", "Авторитетная запись BnF приводит даты 8 сентября 1474 — 6 июля 1533, места Реджо-Эмилия и Феррара и связывает Ариосто с Orlando furioso."],
    ],
    decision: "corrected",
    notes: "Текущие имя, даты, города и главное произведение подтверждены двумя независимыми справочными ресурсами.",
  },
  {
    key: "italy:luigi_capuana",
    originalSha256: "a6a9a93289bf50a0c0394ee90feee0e1334fc7e81ab1c3bb80f0fd1c8233bcaa",
    reviewedTextRu: "Луиджи Капуана — итальянский прозаик, критик и теоретик веризма, активно утверждавший в Италии принципы натуралистического романа. В «Джачинте» и «Маркизе Роккавердина» он исследовал психологическое и социальное давление, сохраняя тесную связь с сицилийской средой.",
    evidence: [
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/luigi-capuana_%28Dizionario-Biografico%29/", "Современная биографическая статья указывает Минео, 29 мая 1839 года, смерть 29 ноября 1915 года в Катании и подробно рассматривает Капуану как критика, прозаика и участника становления веризма."],
      ["Treccani — Enciclopedia Italiana", "https://www.treccani.it/enciclopedia/luigi-capuana_%28Enciclopedia-Italiana%29/", "Более ранняя энциклопедическая статья расходится на один день и даёт 28 мая 1839 года; она подтверждает смерть 29 ноября 1915 года, «Джачинту» и Il marchese di Roccaverdina."],
      ["Università degli Studi G. d’Annunzio Chieti-Pescara", "https://www.dilass.unich.it/sites/st06/files/20-_vita_e_opere_di_l._capuana.pdf", "Университетская библиография фиксирует издания Giacinta и Il marchese di Roccaverdina и подтверждает центральное место этих романов в наследии Капуаны."],
      ["Санкт-Петербургская государственная специальная центральная библиотека", "https://www.gbs.spb.ru/ru/search/detail/?id=07c3b00313dd2e85f9bd721d023cb748", "Библиотечная запись русского издания 1987 года подтверждает нормативное название «Маркиз Роккавердина»."],
    ],
    decision: "corrected",
    notes: "В двух статьях Treccani есть расхождение между 28 и 29 мая, поэтому точный birthDate следует убрать, сохранив надёжный год 1839. Ошибочную транслитерацию «Маркези ди Роккавердина» нужно заменить названием русского издания «Маркиз Роккавердина».",
  },
  {
    key: "italy:luigi_pirandello",
    originalSha256: "d067d100d22563eb21f2ad83db010c94deaf105204a63db8c06025958e1413e1",
    reviewedTextRu: "Луиджи Пиранделло — итальянский драматург, прозаик и новеллист, исследовавший расщепление личности, зависимость человека от социальных ролей и неустойчивость сценической реальности. «Шесть персонажей в поисках автора», «Генрих IV» и «Покойный Маттиа Паскаль» предшествовали присуждению ему Нобелевской премии по литературе 1934 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1934/pirandello/facts/", "Нобелевский профиль подтверждает даты 28 июня 1867 — 10 декабря 1936, Агридженто и Рим, премию 1934 года и центральное место пьесы Six Characters in Search of an Author."],
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/luigi-pirandello_%28Dizionario-Biografico%29/", "Биографический словарь подтверждает рождение в Джирдженти 28 июня 1867 года, смерть в Риме 10 декабря 1936 года, роман Il fu Mattia Pascal и драматургию Пиранделло."],
    ],
    decision: "corrected",
    notes: "Текущие имя, даты, города, произведения и Нобелевская премия подтверждены; профиль не требует фактологических изменений.",
  },
  {
    key: "italy:niccolo_machiavelli",
    originalSha256: "c55f29e0a7c9adcb1cf22fafa66fa99eea1c2dacfb181165a6911999d90b0cb6",
    reviewedTextRu: "Никколо Макиавелли — флорентийский государственный служащий, историк, драматург и политический мыслитель эпохи Возрождения. «Государь», «История Флоренции» и комедия «Мандрагора» показывают, что его наследие не сводится к одному трактату о власти.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/niccolo-machiavelli/", "Treccani приводит даты 3 мая 1469 — 21 июня 1527, Флоренцию как место рождения и смерти и рассматривает литературные и политические сочинения, включая «Мандрагору»."],
      ["Stanford Encyclopedia of Philosophy", "https://plato.stanford.edu/archives/fall2022/entries/machiavelli/", "Академическая энциклопедия подтверждает рождение во Флоренции 3 мая 1469 года, смерть 21 июня 1527 года, государственную службу и авторство The Prince, Florentine Histories и пьес."],
    ],
    decision: "corrected",
    notes: "Даты, места и перечисленные произведения подтверждены; профиль не требует исправления.",
  },
  {
    key: "italy:primo_levi",
    originalSha256: "5afe0b76b1c69d8075e18f2363e08cf33963f55fb5b219f0d307d0b0de308797",
    reviewedTextRu: "Примо Леви — итальянский химик, писатель и свидетель Холокоста, переживший депортацию в Аушвиц и сделавший точность языка частью этики памяти. «Человек ли это?», «Передышка» и «Периодическая система» соединяют свидетельство, научное мышление и размышление о человеческой ответственности.",
    evidence: [
      ["Centro Internazionale di Studi Primo Levi", "https://www.primolevi.it/it/biografia", "Международный центр подтверждает рождение Примо Леви в Турине 31 июля 1919 года, его депортацию, возвращение и историю создания Se questo è un uomo и La tregua."],
      ["Centre Primo Levi", "https://primolevi.org/en/our-history", "Независимый парижский центр подтверждает Турин и 1919 год, смерть в 1987 году, значение свидетельской прозы и публикацию The Periodic Table."],
      ["Большая российская энциклопедия", "https://old.bigenc.ru/literature/text/2135684", "Русская энциклопедия фиксирует даты 31 июля 1919 — 11 апреля 1987, Турин и нормативные названия «Человек ли это?», «Передышка» и «Периодическая система»."],
      ["Санкт-Петербургская государственная специальная центральная библиотека", "https://www.gbs.spb.ru/ru/search/detail/?id=e3db4045d1fefcbd0f4a23592692a911", "Библиотечная запись подтверждает русское издание «Передышки» и указывает, что книга продолжает «Человек ли это?»."],
    ],
    decision: "corrected",
    notes: "Даты и места подтверждены. Название «Покоя нет» не соответствует проверенной библиографии и должно быть заменено на «Передышку» (La tregua).",
  },
  {
    key: "italy:roberto_saviano",
    originalSha256: "aef46da443ca61598812a6e5e6175c92c51e61bc6d04c9a82771f67ea8cdbf42",
    reviewedTextRu: "Роберто Савьяно — итальянский писатель и журналист, работающий на границе документальной прозы и расследования организованной преступности. После «Гоморры» он продолжил исследование международной торговли кокаином в книге «Ноль ноль ноль» и обратился к неаполитанским подростковым бандам в романе «Пираньи Неаполя».",
    evidence: [
      ["Encyclopædia Universalis", "https://www.universalis.fr/encyclopedie/roberto-saviano/", "Энциклопедия подтверждает рождение Роберто Савьяно 22 сентября 1979 года в Неаполе, его работу журналиста и писателя и документальный характер «Гоморры»."],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/243670/roberto-saviano/", "Издательский профиль подтверждает Неаполь и 1979 год, авторство Gomorrah и ZeroZeroZero и работу Савьяно в международной журналистике."],
      ["Corpus", "https://www.corpus.ru/products/roberto-savjano-nol-nol-nol.htm", "Страница русского издателя подтверждает форму имени «Роберто Савьяно» и название русского издания «Ноль ноль ноль»."],
      ["Санкт-Петербургская государственная специальная центральная библиотека", "https://www.gbs.spb.ru/ru/search/detail/?id=cbcf85488b159b1f4b2409042187d775", "Каталожная запись подтверждает русское издание романа «Пираньи Неаполя» как перевод La paranza dei bambini Роберто Савьяно."],
    ],
    decision: "corrected",
    notes: "Дата и место рождения подтверждены. Русское имя следует писать «Роберто Савьяно»; неподтверждённый «Красный карнавал» нужно заменить на документированную книгу «Ноль ноль ноль» и роман «Пираньи Неаполя».",
  },
  {
    key: "italy:salvatore_quasimodo",
    originalSha256: "2395572098ac490c49f1b8cc24dd7af1f855cf1b7bf48b791ed5765812acf57a",
    reviewedTextRu: "Сальваторе Квазимодо — итальянский поэт и переводчик, чья ранняя герметическая лирика после войны открылась историческому опыту и гражданскому звучанию. Сборники «Воды и земли», «И вдруг вечер» и «День за днём» предшествовали присуждению ему Нобелевской премии по литературе 1959 года.",
    evidence: [
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1959/quasimodo/facts/", "Нобелевский профиль подтверждает даты 20 августа 1901 — 14 июня 1968, Модику и Неаполь, премию 1959 года и сборник Acque e terre."],
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/salvatore-quasimodo_%28Dizionario-Biografico%29/", "Биографический словарь подтверждает точные даты и места, развитие от герметизма к гражданской поэзии и сборник Giorno dopo giorno."],
    ],
    decision: "corrected",
    notes: "Текущие даты, места, произведения и Нобелевская премия подтверждены; исправление профиля не требуется.",
  },
  {
    key: "italy:silvio_pellico",
    originalSha256: "4c3beddc30b154c5d32e49bba6fe322cfab7288e7e88ca689d1ade921db68ef1",
    reviewedTextRu: "Сильвио Пеллико — итальянский драматург, публицист и участник карбонарского движения, чьё заключение в крепости Шпильберг стало основой мемуаров «Мои темницы». К его пьесам относится трагедия «Франческа да Римини».",
    evidence: [
      ["Treccani — Dizionario Biografico degli Italiani", "https://www.treccani.it/enciclopedia/giuseppe-eligio-silvio-felice-pellico_%28Dizionario-Biografico%29/", "Биографический словарь приводит полное имя Giuseppe Eligio Silvio Felice Pellico, Салуццо и 24 июня 1789 года, а также историю публикации Le mie prigioni."],
      ["Comune di Saluzzo", "https://comune.saluzzo.cn.it/vivere-il-comune/luoghi/casa-pellico-2-2/", "Официальная страница дома-музея в Салуццо указывает другую дату — 25 июня 1789 года — и подтверждает место рождения писателя."],
      ["Ministero della Cultura / Archivio di Stato di Roma", "https://movio.beniculturali.it/asrm/ilteatronellazio/it/139/documenti/show/26/710", "Государственный театральный архив подтверждает авторство Пеллико и первую постановку пятиактной трагедии «Франческа да Римини» в 1815 году."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb46982719b", "Каталог BnF подтверждает годы 1789–1854 и авторство автобиографической книги Le mie prigioni."],
    ],
    decision: "corrected",
    notes: "Годы, Салуццо, Турин и произведения подтверждены, однако Treccani и муниципальный музей расходятся между 24 и 25 июня. Следует сохранить год 1789, убрать точный birthDate и добавить документированное полное имя.",
  },
  {
    key: "italy:torquato_tasso",
    originalSha256: "9db3d1d34cb8e4e05f3c3f67e1aba07a0165a02b88bf17257da259713458fcac",
    reviewedTextRu: "Торквато Тассо — итальянский поэт позднего Возрождения, чья жизнь была связана с двором Эсте, длительным заключением в госпитале Святой Анны и непрерывной переработкой собственных текстов. Пастораль «Аминта» и эпическая поэма «Освобождённый Иерусалим» стали его главными произведениями.",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/torquato-tasso_%28Enciclopedia-machiavelliana%29/", "Treccani подтверждает рождение Тассо в Сорренто 11 марта 1544 года, смерть в Риме 25 апреля 1595 года и работу над Gerusalemme liberata."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb11964564p", "Авторитетная запись BnF подтверждает принадлежность пятиактной пасторальной драмы Aminta Торквато Тассо и её датировку 1573 годом."],
      ["Bibliothèque nationale de France — Héros", "https://classes.bnf.fr/heros/grand/022.htm", "Материал BnF связывает Тассо (1544–1595) с эпической поэмой «Освобождённый Иерусалим» и её европейским влиянием."],
    ],
    decision: "corrected",
    notes: "Текущие имя, даты, места и оба произведения подтверждены; профиль не требует изменений.",
  },
  {
    key: "italy:umberto_eco",
    originalSha256: "5f8e2deb3b3bc726b08f5db0ac179a489f4ef71b908b7ba70aa642c731431ab0",
    reviewedTextRu: "Умберто Эко — итальянский семиотик, медиевист, эссеист и романист, много лет преподававший в Болонском университете. «Имя розы», «Маятник Фуко», «Остров накануне» и «Пражское кладбище» соединяют исторический роман с исследованием знаков, интерпретации и механизмов заблуждения.",
    evidence: [
      ["University of Bologna", "https://www.unibo.it/en/university/who-we-are/our-history/famous-people-and-students/umberto-eco-1", "Болонский университет подтверждает рождение Эко в Алессандрии в 1932 году, смерть в Милане в 2016 году, его работу семиотика и медиевиста и мировой успех «Имени розы»."],
      ["University of Bologna — Historical Archive", "https://archiviostorico.unibo.it/it/patrimonio-documentario/ritratti-di-docenti?record=140809", "Архив университета приводит точные даты 5 января 1932 — 19 февраля 2016 и академические должности Эко в области семиотики."],
      ["Treccani", "https://www.treccani.it/enciclopedia/umberto-eco_%28Enciclopedia-Italiana%29", "Treccani подтверждает рождение Умберто Эко 5 января 1932 года в Алессандрии, его деятельность писателя и семиотика и преподавание в Болонском университете."],
      ["University of Bologna — memorial profile", "https://www.unibo.it/en/university/the-university-of-bologna-mourns-the-death-of-umberto-eco", "Мемориальный профиль перечисляет романы «Имя розы», «Маятник Фуко», «Остров накануне» и «Пражское кладбище» и подтверждает начало литературной прозы Эко в 1980 году."],
    ],
    decision: "corrected",
    notes: "Даты и места подтверждены. «Имя розы» уже присутствует в workDetails, но отсутствует в основном массиве works и должно быть добавлено для полноты и единообразного отображения. Координаты текущей записи указывают на Турин, а не на Алессандрию; это отмечено для отдельной географической проверки без неподтверждённой ручной подгонки.",
  },
  {
    key: "italy:vittorio_alfieri",
    originalSha256: "99e31ea9ada387449bae9c42dcb095799188504196f7ca06b0dd4517935deebb",
    reviewedTextRu: "Витторио Альфьери (1749–1803) — итальянский поэт и драматург, автор девятнадцати трагедий, написанных в 1776–1786 годах. Среди них — «Филиппо», «Саул» и «Мирра»; он также написал автобиографию «Жизнь».",
    evidence: [
      ["Treccani", "https://www.treccani.it/enciclopedia/vittorio-alfieri/", "Подтверждает даты 16 января 1749 — 8 октября 1803, занятия поэзией и драматургией, корпус из девятнадцати трагедий, включая «Саул», «Мирру» и «Филиппо», и автобиографию «Vita»."],
      ["Fondazione Centro Nazionale di Studi Alfieriani", "https://www.fondazionealfieri.it/cronologia-della-vita/", "Специализированный исследовательский центр подтверждает рождение в Асти 16 января 1749 года, создание «Филиппо», «Саула» и «Мирры» и смерть во Флоренции 8 октября 1803 года."],
    ],
    decision: "corrected",
    notes: "Оценочная формула об «одном из основателей» заменена проверяемыми сведениями о жанре, корпусе трагедий и произведениях.",
  },
  {
    key: "jamaica:andrew_salky",
    originalSha256: "1969d8064052c82d5f5a7e9f783bdbcf919fc6d5add1b6cde0b5d8276f181282",
    reviewedTextRu: "Эндрю Солки (1928–1995; полное имя Феликс Эндрю Александер Солки) — родившийся в Панаме ямайский писатель, поэт, преподаватель и радиожурналист. Среди его романов — «A Quality of Violence» и «The Late Emancipation of Jerry Stover».",
    evidence: [
      ["Peepal Tree Press", "https://www.peepaltreepress.com/authors/andrew-salkey", "Подтверждает рождение в Колоне в Панаме в 1928 году в ямайской семье, работу писателем, поэтом, преподавателем и радиожурналистом, а также романы «A Quality of Violence» и «The Late Emancipation of Jerry Stover»."],
      ["AIM25 / London Metropolitan Archives", "https://atom.aim25.com/index.php/salkey-andrew-donated-papers", "Архивная запись приводит полное имя Felix Andrew Alexander Salkey, годы 1928–1995, место рождения Колон и место смерти Амхерст; определяет его как писателя и радиожурналиста BBC."],
    ],
    decision: "corrected",
    notes: "Исходная карточка ошибочно помещает рождение на Ямайку, смерть — в Лондон и датирует её 28 февраля; второе название произведения было сокращено. Суперлатив удалён.",
  },
  {
    key: "jamaica:claude_mckay",
    originalSha256: "f9ffa98322b7a758ba01b8bd20f044a774f7e7cabf84aa391f7c632fb112a7ff",
    reviewedTextRu: "Клод Маккей — родившийся на Ямайке поэт и прозаик, связанный с Гарлемским ренессансом. Среди его книг — поэтические сборники «Spring in New Hampshire» и «Harlem Shadows» и роман «Home to Harlem».",
    evidence: [
      ["National Library of Jamaica", "https://nlj.gov.jm/project/claude-mckay-1889-1948/", "Подтверждает ямайское происхождение, работу в поэзии и прозе и книги «Spring in New Hampshire» и «Harlem Shadows»; библиотека указывает 15 сентября 1889 года как дату рождения."],
      ["New York Public Library", "https://nyplorg-data-archives.s3.amazonaws.com/uploads/collection/generated_finding_aids/scm186113.pdf", "Архивная опись представляет Маккея как родившегося на Ямайке поэта и писателя Гарлемского ренессанса, связывает его с «Spring in New Hampshire», «Harlem Shadows» и «Home to Harlem» и указывает годы 1890–1948."],
    ],
    decision: "corrected",
    notes: "Два институциональных источника расходятся в годе рождения: Национальная библиотека Ямайки указывает 1889, архив NYPL — 1890. Поэтому точная дата не включена в публикуемый текст.",
  },
  {
    key: "jamaica:kerry_yang",
    originalSha256: "3d9b1705b515de59d1a393793283985b56842b0fe0c9da75b72d9f882fe7297b",
    reviewedTextRu: "Керри Янг — родившаяся в Кингстоне писательница китайско-ямайского происхождения. Её взаимосвязанные романы «Pao», «Gloria» и «Show Me a Mountain» обращаются к истории и общественным переменам на Ямайке.",
    evidence: [
      ["Royal Literary Fund", "https://www.rlf.org.uk/writer/kerry-young/", "Представляет Керри Янг как романистку и подтверждает три взаимосвязанные книги «Pao», «Gloria» и «Show Me a Mountain», действие которых разворачивается на Ямайке на фоне социальных и политических перемен."],
      ["Bloomsbury Publishing", "https://www.bloomsbury.com/uk/show-me-a-mountain-9781408844335/", "Издатель подтверждает имя Kerry Young, рождение в Кингстоне на Ямайке, китайско-ямайское семейное происхождение и авторство «Pao» и «Show Me a Mountain»."],
    ],
    decision: "corrected",
    notes: "Карточка содержит опечатку Yang вместо Young и ошибочно приписывает писательнице роман «Jasmine». Год 1955 и фиктивный день 1 января выбранные источники не подтверждают.",
  },
  {
    key: "jamaica:marlon_james",
    originalSha256: "6da62600187a6b205e8a702e4db7211f0d7188ead6cca12a8897c3b1517a581f",
    reviewedTextRu: "Марлон Джеймс (род. 1970) — ямайский писатель, автор романов «John Crow’s Devil», «The Book of Night Women» и «A Brief History of Seven Killings». Последний получил Букеровскую премию 2015 года.",
    evidence: [
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/marlon-james", "Подтверждает авторство «John Crow’s Devil», «The Book of Night Women» и «A Brief History of Seven Killings» и присуждение последнему Букеровской премии 2015 года."],
      ["Macalester College", "https://www.macalester.edu/english-and-creative-writing/facultystaff/marlonjames/", "Университетский профиль указывает, что Марлон Джеймс родился на Ямайке в 1970 году, перечисляет его романы и подтверждает Букеровскую премию за «A Brief History of Seven Killings»."],
    ],
    decision: "corrected",
    notes: "Суперлатив о степени известности удалён; вместо него приведены проверяемые книги и награда.",
  },
  {
    key: "jamaica:roger_mais",
    originalSha256: "57e22c5ca9800790ba71c45c0b22b65bb914f3c8c70da5faff36f2194c58972e",
    reviewedTextRu: "Роджер Майс (1905–1955) — ямайский писатель, журналист, поэт и драматург, участвовавший в антиколониальном и национальном движении. Среди его романов — «The Hills Were Joyful Together», «Brother Man» и «Black Lightning».",
    evidence: [
      ["National Library of Jamaica / University of the West Indies Mona Library", "https://www.nlj.gov.jm/caribbeanregister/docs/jamaica.htm", "Описание архива Роджера Майса подтверждает годы 1905–1955, литературную, журналистскую, политическую и художественную работу, участие в антиколониальном движении и корпус из трёх романов."],
      ["Peepal Tree Press", "https://www.peepaltreepress.com/authors/roger-mais", "Подтверждает ямайскую идентичность, работу журналистом, поэтом и драматургом, националистическую деятельность и романы «The Hills Were Joyful Together», «Brother Man» и «Black Lightning»."],
    ],
    decision: "corrected",
    notes: "Оценочная формула об «основателе» заменена документированными видами деятельности и библиографией. В источниках встречаются разные дни смерти: карточка хранит 21 июня, а библиография на странице архивной номинации приводит заголовок с 15 июня; год 1955 надёжен.",
  },
  {
    key: "japan:akutagawa_ryunosuke",
    originalSha256: "09aca8d0aae5eadf45cf5e0949521f8ebdc26a9e79ed2192f00a860e9386a82e",
    reviewedTextRu: "Рюноскэ Акутагава (1892–1927) — японский писатель, работавший преимущественно в жанре рассказа и переосмыслявший сюжеты классической литературы. Среди его произведений — «Нос», «Расёмон» и «В чаще».",
    evidence: [
      ["National Diet Library, Japan", "https://www.ndl.go.jp/portrait/e/datas/224/", "Подтверждает даты 1 марта 1892 — 24 июля 1927, рождение и смерть в Токио, работу писателем и авторство рассказов «The Nose» и «Rashomon»."],
      ["The Japan Foundation, Toronto", "https://tr.jpf.go.jp/20-authors/", "Характеризует Акутагаву как автора короткой прозы 1892–1927 годов, переосмысливавшего классические произведения, и перечисляет «Rashomon», «The Nose» и «Hell Screen»."],
    ],
    decision: "corrected",
    notes: "Суперлатив заменён нейтральным жанровым описанием и проверяемыми произведениями.",
  },
  {
    key: "japan:banana_yoshimoto",
    originalSha256: "ac3b8c973204a8138e0d34a7b28a5de75ec3982d2495de8d74413188d114828a",
    reviewedTextRu: "Банана Ёсимото (род. 1964; настоящее имя Махоко Ёсимото) — японская писательница, автор книг «Кухня», «TUGUMI» и «Амрита». «Кухня» получила премию журнала Kaien для начинающих писателей в 1987 году.",
    evidence: [
      ["Shinchosha", "https://www.shinchosha.co.jp/writer/3257/", "Издатель подтверждает рождение в Токио в 1964 году, премию Kaien за «Кухню» в 1987 году, премию Ямамото Сюгоро за «TUGUMI» и премию Мурасаки Сикибу за «Амриту»."],
      ["Grove Atlantic", "https://groveatlantic.com/three-books-by-banana-yoshimoto-out-in-paperback-for-the-first-time/", "Издатель подтверждает имя при рождении Mahoko Yoshimoto, 1964 год, выбор псевдонима Banana Yoshimoto и авторство «Kitchen» и «Amrita»."],
    ],
    decision: "corrected",
    notes: "Оценочная формула удалена. Исходная «Премия Умэсаки 1988 года» не соответствует проверенной наградной хронологии и, вероятно, является искажением.",
  },
  {
    key: "japan:chikamatsu_monzaemon",
    originalSha256: "972ea3b99165de8e6a8b55f07b9c0618c2a51658d57cf76e7c042930163ffcc6",
    reviewedTextRu: "Тикамацу Мондзаэмон (1653–1724; настоящее имя Сугимори Нобумори) — японский драматург периода Эдо, писавший для театров нинге-дзёрури и кабуки. Среди его пьес — «Самоубийство влюблённых в Сонэдзаки» и «Битвы Коксинги».",
    evidence: [
      ["National Diet Library Authorities", "https://id.ndl.go.jp/auth/ndlna/00272221", "Authority-запись подтверждает годы 1653–1724, имя Тикамацу Мондзаэмон, настоящее имя Сугимори Нобумори и занятие автора дзёрури."],
      ["Japan Arts Council", "https://www2.ntj.jac.go.jp/unesco/bunraku/en/play/playwright1.html", "Подтверждает годы 1653–1724, работу для нинге-дзёрури и связь пьес с кабуки, а также авторство «The Love Suicides at Sonezaki» и «The Battles of Coxinga»."],
    ],
    decision: "corrected",
    notes: "Исходная дата смерти 1725 противоречит двум японским институциональным источникам. Место рождения «Эхимэ или Киото», первое название произведения и жанровая помета с опечаткой требуют замены.",
  },
  {
    key: "japan:futabatei_shimei",
    originalSha256: "6e319eacec21528a9f6e96f69b197084e88e965bccfedb0a16642d8ed3a3ce0d",
    reviewedTextRu: "Фтабатэй Симэй (1864–1909; настоящее имя Хасэгава Тацунокэ) — японский писатель и переводчик с русского языка. Его роман «Ukigumo» (1887) связан со становлением современной разговорно-письменной прозы; позднее он опубликовал «Sono omokage» и «Heibon».",
    evidence: [
      ["National Diet Library, Japan", "https://www.ndl.go.jp/portrait/e/datas/322/", "Подтверждает годы 1864–1909, рождение в Токио, настоящее имя Hasegawa Tatsunosuke, работу романистом и переводчиком и книги «Ukigumo», «Sono omokage» и «Heibon»."],
      ["Cambridge University Press", "https://www.cambridge.org/core/services/aop-cambridge-core/content/view/D5C76046970C8256D82757799A68015D", "Исследование связывает переводы Фтабатэя с внедрением разговорного стиля в переводы современной западной прозы и с его собственной художественной прозой."],
    ],
    decision: "corrected",
    notes: "В отображаемом имени есть опечатка, а произведения «Плыву по течению» и «Облака над морем» не соответствуют проверенной библиографии автора.",
  },
  {
    key: "japan:haruki_murakami",
    originalSha256: "dd5c8f585e6996e45bb69e32d0144e168143c8d3d94f591836f1d9024ee89d75",
    reviewedTextRu: "Харуки Мураками (род. 1949) — японский писатель и переводчик, автор романов «Охота на овец», «Хроники заводной птицы», «Кафка на пляже» и «1Q84». Он также переводил на японский язык произведения американских писателей.",
    evidence: [
      ["The Japan Foundation", "https://www.jpf.go.jp/e/about/award/archive/2012/profile.html", "Подтверждает рождение в Киото в 1949 году, работу писателем и переводчиком американской литературы и библиографию, включающую «A Wild Sheep Chase», «The Wind-Up Bird Chronicle», «Kafka on the Shore» и «1Q84»."],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/21587/haruki-murakami/", "Издательский профиль подтверждает рождение в Киото в 1949 году, писательскую и переводческую работу и основные романы автора."],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb12206638k", "Authority-запись подтверждает точную дату рождения 12 января 1949 года, место рождения Киото и деятельность романиста и переводчика."],
    ],
    decision: "corrected",
    notes: "Глобальный суперлатив и расплывчатое жанровое описание заменены проверяемыми сведениями о книгах и переводческой работе.",
  },
  {
    key: "japan:hirano_keichiro",
    originalSha256: "624d2b4b61a82e176c6b0c060f86f7bfffe6aa640758a82b681bb38bb9f9abb5",
    reviewedTextRu: "Кэйитиро Хирано (род. 1975) — японский писатель, родившийся в Гамагори и выросший в Китакюсю. Его дебютный роман «Затмение» получил премию Акутагавы в 1999 году; среди последующих книг — «A Man» и «At the End of the Matinee».",
    evidence: [
      ["The Japan Foundation, Toronto", "https://tr.jpf.go.jp/japan-canada-literary-exchange/hirano-keiichiro/", "Подтверждает рождение в Гамагори в 1975 году, взросление в Китакюсю, получение премии Акутагавы за дебютное «Затмение» и книги «A Man» и «At the End of the Matinee»."],
      ["National Diet Library Authorities", "https://id.ndl.go.jp/auth/ndlna/00709718", "Authority-запись подтверждает имя Кэйитиро Хирано, 1975 год рождения и профессию романиста."],
      ["Keiichiro Hirano Official Site", "https://en.k-hirano.com/profileen/", "Официальная биография подтверждает Гамагори, Китакюсю, премию Акутагавы 1999 года за «Eclipse», а также «A Man» и «At the End of the Matinee»."],
    ],
    decision: "corrected",
    notes: "Исходное место рождения Камакура неверно, а «Преступление и наказание» не является романом Хирано. Оценочная формула о «новом поколении» удалена.",
  },
  {
    key: "japan:hiromi_kawakami",
    originalSha256: "fbb2094d31de32efa3fc3fb138dff037ab6b2dab7407f2aab85dfe08b6689cd2",
    reviewedTextRu: "Хироми Каваками (род. 1958) — японская писательница, автор романов и сборников рассказов. Среди её книг — «Strange Weather in Tokyo», «Manazuru» и «People from My Neighborhood»; «Sensei no kaban» получила премию Танидзаки в 2001 году.",
    evidence: [
      ["The Japan Foundation / Japanese Book News", "https://www.bookmark.jpf.go.jp/media/2024/10/JBNPDF52.pdf", "Профиль подтверждает 1958 год рождения, писательскую деятельность, роман «Sensei no kaban», премию Танидзаки 2001 года и книгу «Manazuru»."],
      ["Pushkin Press", "https://pushkinpress.com/book/record-of-a-night-too-brief/", "Издатель подтверждает рождение в Токио в 1958 году, работу в жанрах романа и рассказа и книгу «Strange Weather in Tokyo»."],
      ["The Japan Foundation, New York", "https://ny.jpf.go.jp/event/hiromi-kawakami-and-kelly-link-in-conversation/", "Перечисляет книги Каваками «Manazuru», «Strange Weather in Tokyo» и «People from My Neighborhood»."],
    ],
    decision: "corrected",
    notes: "Оценочное описание заменено библиографией и наградой. Название «Люди из леса» не соответствует подтверждённой книге «People from My Neighborhood».",
  },
] satisfies readonly ReviewSeed[];

function finalizeReviewRecord(seed: ReviewSeed): WriterBiographyFactReviewRecord {
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
    claims: [{
      textRu: seed.reviewedTextRu,
      verdict,
      evidence: seed.evidence.map(([provider, url, findingRu]) => ({
        provider,
        url,
        checkedAt,
        findingRu,
      })),
    }],
    reviewer,
    decision: seed.decision,
    notes: seed.notes,
  };
}

export const writerBiographyFactReviewBatch34: readonly WriterBiographyFactReviewRecord[] =
  seeds.map(finalizeReviewRecord);
