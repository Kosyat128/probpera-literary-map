import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch34 = {
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

export const writerBiographyPublicProfileFactCorrectionsBatch34 = [
  {
    countryId: "italy",
    writerId: "dante_alighieri",
    patch: {
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/dante-alighieri/", checkedAt },
      { provider: "Stanford Encyclopedia of Philosophy", url: "https://plato.stanford.edu/entries/dante/", checkedAt },
    ],
    note: "Текущие годы, места и произведения подтверждены, но значения 1265-05-21 и 1321-09-14 создают ложную точность: источники дают диапазон рождения и ночь между двумя датами смерти.",
  },
  {
    countryId: "italy",
    writerId: "dario_fo",
    patch: {
      birthPlace: "Санджано (Леджуно), Италия",
    },
    evidence: [
      { provider: "Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1997/fo/facts/", checkedAt },
      { provider: "Treccani - Dizionario Biografico degli Italiani", url: "https://www.treccani.it/enciclopedia/dario-fo_%28Dizionario-Biografico%29/", checkedAt },
    ],
    note: "Все даты, произведения и Нобелевская премия подтверждены; текущее место рождения «Леньяно» ошибочно и должно быть заменено на Санджано в коммуне Леджуно.",
  },
  {
    countryId: "italy",
    writerId: "dino_buzzati",
    patch: {
      birthPlace: "Сан-Пеллегрино-ди-Беллуно, Италия",
    },
    evidence: [
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/dino-buzzati/", checkedAt },
      { provider: "Rai Cultura", url: "https://www.raicultura.it/speciali/dinobuzzati", checkedAt },
    ],
    note: "Даты, место смерти и произведения подтверждены; в текущем birthPlace допущена опечатка «Бельзуно», тогда как город называется Беллуно.",
  },
  {
    countryId: "italy",
    writerId: "elena_ferrante",
    patch: {
      years: "",
      birthDate: "",
      birthPlace: "",
    },
    evidence: [
      { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/2172029/elena-ferrante/", checkedAt },
      { provider: "Padova University Press", url: "https://www.padovauniversitypress.it/it/publications/9788869381300", checkedAt },
      { provider: "Elena Ferrante - официальный каталог произведений", url: "https://elenaferrante.com/works/", checkedAt },
    ],
    note: "Год рождения 1943 и Неаполь как место рождения не подтверждены для скрывающего личность автора и не должны подаваться как биографические факты; произведения подтверждены.",
  },
  {
    countryId: "italy",
    writerId: "emilio_salgari",
    patch: {
      years: "1862-1911",
      birthPlace: "Верона, Италия",
      deathPlace: "Турин, Италия",
      works: ["Чёрный корсар","Тигры Момпрачема","Тайны чёрных джунглей"],
    },
    evidence: [
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/emilio-salgari/", checkedAt },
      { provider: "Bibliothèque nationale de France", url: "https://data.bnf.fr/fr/11923463/emilio_salgari/", checkedAt },
    ],
    note: "В legacy-слое была только краткая заметка без профиля. Точные день и месяц рождения и смерти не добавляются: разные редакции Treccani расходятся в этих датах; надёжно подтверждены годы, города и произведения.",
  },
  {
    countryId: "italy",
    writerId: "francesco_petrarca",
    patch: {
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Treccani - Dizionario Biografico degli Italiani", url: "https://www.treccani.it/enciclopedia/francesco-petrarca_%28Dizionario-Biografico%29/", checkedAt },
      { provider: "University of Bologna", url: "https://www.unibo.it/en/university/who-we-are/our-history/famous-people-and-students/Petrarch", checkedAt },
      { provider: "Academy of American Poets", url: "https://poets.org/poet/petrarch", checkedAt },
    ],
    note: "Годы, города и произведения подтверждены. Точные birthDate и deathDate в базе следует убрать: современная Treccani подчёркивает традиционный и спорный характер первой даты, а смерть относится к ночи между 18 и 19 июля.",
  },
  {
    countryId: "italy",
    writerId: "giacomo_leopardi",
    patch: {
      works: ["Песни","Нравственные очерки","Дзибальдоне"],
    },
    evidence: [
      { provider: "Casa Leopardi", url: "https://www.giacomoleopardi.it/en/life-and-works/", checkedAt },
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/giacomo-leopardi", checkedAt },
    ],
    note: "Даты и места подтверждены. «Бесконечность» - отдельное стихотворение, поэтому для поля works последовательнее перечислить книги и корпуса: «Песни», «Нравственные очерки», «Дзибальдоне».",
  },
  {
    countryId: "italy",
    writerId: "giambattista_marino",
    patch: {
      deathDate: "1625-03-25",
      birthDate: "",
    },
    evidence: [
      { provider: "Treccani - Dizionario Biografico degli Italiani", url: "https://www.treccani.it/enciclopedia/giovan-battista-marino_%28Dizionario-Biografico%29/", checkedAt },
      { provider: "Bibliothèque nationale de France", url: "https://data.bnf.fr/fr/ark:/12148/cb12158025x", checkedAt },
    ],
    note: "Текущая deathDate 1625-03-26 ошибочна. Авторитетные источники расходятся между 14 и 18 октября в дате рождения, поэтому birthDate удаляется вместо выбора одной версии; годы, города и произведения подтверждены.",
  },
  {
    countryId: "italy",
    writerId: "giosue_carducci",
    patch: {
      deathPlace: "Болонья, Италия",
      works: ["Варварские оды","Новые рифмы","Рифмы и ритмы"],
    },
    evidence: [
      { provider: "Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1906/carducci/bibliography/", checkedAt },
      { provider: "University of Bologna - Historical Archive", url: "https://archiviostorico.unibo.it/it/patrimonio-documentario/ritratti-di-docenti?record=132848", checkedAt },
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/giosue-carducci_%28Enciclopedia-dell%27Italiano%29/", checkedAt },
    ],
    note: "Дата, место рождения и премия верны; следует добавить место смерти Болонья и исправить название Rime nuove с неточного «Новые стихи» на «Новые рифмы».",
  },
  {
    countryId: "italy",
    writerId: "giovanni_boccaccio",
    patch: {
      birthPlace: "Флоренция или Чертальдо, Италия",
      works: ["Декамерон","Филоколо","Элегия мадонны Фьяметты"],
      birthDate: "",
    },
    evidence: [
      { provider: "Treccani - Dizionario Biografico degli Italiani", url: "https://www.treccani.it/enciclopedia/giovanni-boccaccio_%28Dizionario-Biografico%29/", checkedAt },
      { provider: "Bibliothèque nationale de France", url: "https://www.bnf.fr/sites/default/files/2018-11/biblio%20boccace.pdf", checkedAt },
    ],
    note: "Точная birthDate 1313-06-16 не подтверждается и должна быть удалена. Место рождения сохраняется как честная альтернатива, а сокращённое «Фьяметта» уточняется до полного названия произведения.",
  },
  {
    countryId: "italy",
    writerId: "grazia_deledda",
    patch: {
      works: ["Тростник на ветру","Матерь","Пепел"],
    },
    evidence: [
      { provider: "Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1926/deledda/biographical/", checkedAt },
      { provider: "Nobel Prize - award summary", url: "https://www.nobelprize.org/prizes/literature/1926/summary/", checkedAt },
      { provider: "Rai Cultura", url: "https://www.raicultura.it/speciali/graziadeledda", checkedAt },
    ],
    note: "Даты, города и премия подтверждены. Произведение «Золото» не находится в авторитетных библиографиях Деледды и заменяется на подтверждённый роман «Пепел» (Cenere).",
  },
  {
    countryId: "italy",
    writerId: "italo_svevo",
    patch: {
      name: "Итало Звево",
      fullName: "Aron Hector Schmitz",
      works: ["Самопознание Дзено","Дряхлость","Одна жизнь"],
    },
    evidence: [
      { provider: "Museo Sveviano", url: "https://www.museosveviano.it/italo-svevo/", checkedAt },
      { provider: "Ministero della Cultura / Sapienza Università di Roma", url: "https://www.movio.beniculturali.it/uniroma1/livesandlibraries/it/svevo", checkedAt },
      { provider: "Большая российская энциклопедия", url: "https://bigenc.ru/c/italo-zvevo-dd8036", checkedAt },
    ],
    note: "Даты и места подтверждены. Русскую форму имени следует привести к энциклопедической «Итало Звево», добавить настоящее имя и заменить неточные названия «Старость» и «Жизнь» на опубликованные формы «Дряхлость» и «Одна жизнь».",
  },
  {
    countryId: "italy",
    writerId: "luigi_capuana",
    patch: {
      works: ["Джачинта","Маркиз Роккавердина"],
      birthDate: "",
    },
    evidence: [
      { provider: "Treccani - Dizionario Biografico degli Italiani", url: "https://www.treccani.it/enciclopedia/luigi-capuana_%28Dizionario-Biografico%29/", checkedAt },
      { provider: "Treccani - Enciclopedia Italiana", url: "https://www.treccani.it/enciclopedia/luigi-capuana_%28Enciclopedia-Italiana%29/", checkedAt },
      { provider: "Università degli Studi G. d’Annunzio Chieti-Pescara", url: "https://www.dilass.unich.it/sites/st06/files/20-_vita_e_opere_di_l._capuana.pdf", checkedAt },
      { provider: "Санкт-Петербургская государственная специальная центральная библиотека", url: "https://www.gbs.spb.ru/ru/search/detail/?id=07c3b00313dd2e85f9bd721d023cb748", checkedAt },
    ],
    note: "В двух статьях Treccani есть расхождение между 28 и 29 мая, поэтому точный birthDate следует убрать, сохранив надёжный год 1839. Ошибочную транслитерацию «Маркези ди Роккавердина» нужно заменить названием русского издания «Маркиз Роккавердина».",
  },
  {
    countryId: "italy",
    writerId: "primo_levi",
    patch: {
      works: ["Человек ли это?","Периодическая система","Передышка"],
    },
    evidence: [
      { provider: "Centro Internazionale di Studi Primo Levi", url: "https://www.primolevi.it/it/biografia", checkedAt },
      { provider: "Centre Primo Levi", url: "https://primolevi.org/en/our-history", checkedAt },
      { provider: "Большая российская энциклопедия", url: "https://old.bigenc.ru/literature/text/2135684", checkedAt },
      { provider: "Санкт-Петербургская государственная специальная центральная библиотека", url: "https://www.gbs.spb.ru/ru/search/detail/?id=e3db4045d1fefcbd0f4a23592692a911", checkedAt },
    ],
    note: "Даты и места подтверждены. Название «Покоя нет» не соответствует проверенной библиографии и должно быть заменено на «Передышку» (La tregua).",
  },
  {
    countryId: "italy",
    writerId: "roberto_saviano",
    patch: {
      name: "Роберто Савьяно",
      works: ["Гоморра","Ноль ноль ноль","Пираньи Неаполя"],
    },
    evidence: [
      { provider: "Encyclopædia Universalis", url: "https://www.universalis.fr/encyclopedie/roberto-saviano/", checkedAt },
      { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/243670/roberto-saviano/", checkedAt },
      { provider: "Corpus", url: "https://www.corpus.ru/products/roberto-savjano-nol-nol-nol.htm", checkedAt },
      { provider: "Санкт-Петербургская государственная специальная центральная библиотека", url: "https://www.gbs.spb.ru/ru/search/detail/?id=cbcf85488b159b1f4b2409042187d775", checkedAt },
    ],
    note: "Дата и место рождения подтверждены. Русское имя следует писать «Роберто Савьяно»; неподтверждённый «Красный карнавал» нужно заменить на документированную книгу «Ноль ноль ноль» и роман «Пираньи Неаполя».",
  },
  {
    countryId: "italy",
    writerId: "silvio_pellico",
    patch: {
      fullName: "Giuseppe Eligio Silvio Felice Pellico",
      birthDate: "",
    },
    evidence: [
      { provider: "Treccani - Dizionario Biografico degli Italiani", url: "https://www.treccani.it/enciclopedia/giuseppe-eligio-silvio-felice-pellico_%28Dizionario-Biografico%29/", checkedAt },
      { provider: "Comune di Saluzzo", url: "https://comune.saluzzo.cn.it/vivere-il-comune/luoghi/casa-pellico-2-2/", checkedAt },
      { provider: "Ministero della Cultura / Archivio di Stato di Roma", url: "https://movio.beniculturali.it/asrm/ilteatronellazio/it/139/documenti/show/26/710", checkedAt },
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb46982719b", checkedAt },
    ],
    note: "Годы, Салуццо, Турин и произведения подтверждены, однако Treccani и муниципальный музей расходятся между 24 и 25 июня. Следует сохранить год 1789, убрать точный birthDate и добавить документированное полное имя.",
  },
  {
    countryId: "italy",
    writerId: "umberto_eco",
    patch: {
      works: ["Имя розы","Маятник Фуко","Остров накануне","Пражское кладбище"],
    },
    evidence: [
      { provider: "University of Bologna", url: "https://www.unibo.it/en/university/who-we-are/our-history/famous-people-and-students/umberto-eco-1", checkedAt },
      { provider: "University of Bologna - Historical Archive", url: "https://archiviostorico.unibo.it/it/patrimonio-documentario/ritratti-di-docenti?record=140809", checkedAt },
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/umberto-eco_%28Enciclopedia-Italiana%29", checkedAt },
      { provider: "University of Bologna - memorial profile", url: "https://www.unibo.it/en/university/the-university-of-bologna-mourns-the-death-of-umberto-eco", checkedAt },
    ],
    note: "Даты и места подтверждены. «Имя розы» уже присутствует в workDetails, но отсутствует в основном массиве works и должно быть добавлено для полноты и единообразного отображения. Координаты текущей записи указывают на Турин, а не на Алессандрию; это отмечено для отдельной географической проверки без неподтверждённой ручной подгонки.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrectionBatch34[];
