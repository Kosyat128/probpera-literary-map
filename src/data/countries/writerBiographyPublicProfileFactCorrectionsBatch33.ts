import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch33 = {
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

export const writerBiographyPublicProfileFactCorrectionsBatch33 = [
  {
    countryId: "iran",
    writerId: "forugh_farrokhzad",
    patch: {
      years: "1934/1935–1967",
      deathPlace: "Тегеран, Иран",
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Encyclopaedia Iranica", url: "https://www.iranicaonline.org/articles/farrokzad-forug-zaman/", checkedAt },
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/forugh-farrokhzad", checkedAt },
      { provider: "Le Monde", url: "https://www.lemonde.fr/culture/article/2024/12/22/forough-farrokhzad-1934-1967-incarner-la-lumiere-sur-france-culture-la-voix-d-une-poetesse-iranienne-surgie-du-fond-de-la-nuit_6462402_3246.html", checkedAt },
    ],
    note: "Текущие works подтверждаются. Авторитетные источники расходятся по году рождения (1934/1935) и дню смерти (13/14 февраля), поэтому точные birthDate и deathDate нельзя сохранять как бесспорные; место смерти — Тегеран.",
  },
  {
    countryId: "iran",
    writerId: "hafez",
    patch: {
      fullName: "Khwaja Shams al-Din Muhammad Hafez-e Shirazi",
      deathPlace: "Шираз, Иран",
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Encyclopaedia Iranica", url: "https://www.iranicaonline.org/articles/hafez/", checkedAt },
      { provider: "Encyclopaedia Iranica — Life and Times", url: "https://www.iranicaonline.org/articles/hafez-ii/", checkedAt },
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/hafez", checkedAt },
    ],
    note: "Текущие даты 1315-01-01 и 1390-01-01 являются искусственной точностью для приблизительно датированной биографии. «Диван Хафиза» подтверждён; полное имя стоит добавить в латинской нормализованной форме.",
  },
  {
    countryId: "iran",
    writerId: "mahmoud_dowlatabadi",
    patch: {
      birthPlace: "Доулатабад, Хорасан, Иран",
      works: ["Kelidar","Missing Soluch","The Colonel"],
    },
    evidence: [
      { provider: "International Literature Festival Berlin", url: "https://literaturfestival.com/en/authors/mahmud-doulatabadi/", checkedAt },
      { provider: "Haus Publishing", url: "https://www.hauspublishing.com/authors/mahmoud-dowlatabadi/", checkedAt },
      { provider: "Lex.dk", url: "https://lex.dk/Mahmud_Dowlat%C3%A2b%C3%A2di", checkedAt },
    ],
    note: "Текущая точная birthDate поддержана национальной энциклопедией. BirthPlace следует уточнить до Хорасана, а works расширить каноническими романами вместо единственного названия.",
  },
  {
    countryId: "iran",
    writerId: "omar_khayyam",
    patch: {
      years: "ок. 1048–ок. 1131",
      birthPlace: "Нишапур, Хорасан",
      works: ["Рубаи, приписываемые Омару Хайяму"],
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Encyclopaedia Iranica", url: "https://www.iranicaonline.org/articles/khayyam-omar/khayyam-omar-i-life/", checkedAt },
      { provider: "MacTutor History of Mathematics, University of St Andrews", url: "https://mathshistory.st-andrews.ac.uk/Biographies/Khayyam/", checkedAt },
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/omar-khayaam", checkedAt },
    ],
    note: "Текущие точные birthDate и deathDate существуют как традиционная реконструкция, но Iranica прямо показывает их неопределённость. BirthPlace следует исторически обозначить как Нишапур в Хорасане, а works снабдить оговоркой об атрибуции.",
  },
  {
    countryId: "iran",
    writerId: "saadi_shirazi",
    patch: {
      years: "ок. 1210–1291/1292",
      deathPlace: "Шираз, Иран",
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "Encyclopaedia Iranica", url: "https://www.iranicaonline.org/articles/sadi-sirazi/", checkedAt },
      { provider: "Library of Congress", url: "https://blogs.loc.gov/international-collections/2021/01/sa%CA%BBdi-and-his-mystical-humanist-literature-at-the-library-of-congress/", checkedAt },
      { provider: "The Metropolitan Museum of Art", url: "https://www.metmuseum.org/art/collection/search/446557", checkedAt },
    ],
    note: "Текущие works верны. Даты 1210-01-01 и 1292-01-01 создают ложную точность: год рождения приблизителен, а источники расходятся между 1291 и 1292 годами смерти.",
  },
  {
    countryId: "iran",
    writerId: "sadegh_hedayat",
    patch: {
      deathPlace: "Париж, Франция",
    },
    evidence: [
      { provider: "Encyclopaedia Iranica", url: "https://www.iranicaonline.org/articles/hedayat-sadeq/", checkedAt },
      { provider: "Encyclopaedia Iranica — Fiction", url: "https://www.iranicaonline.org/articles/hedayat-sadeq-i/", checkedAt },
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb120669834", checkedAt },
    ],
    note: "Текущая дата рождения подтверждена. Для deathDate сохранена дата 1951-04-09 по профильной Iranica; однодневное расхождение с каталогом BnF явно отмечено. Необходимо добавить отсутствующее deathPlace.",
  },
  {
    countryId: "iran",
    writerId: "shahrnush_parsipur",
    patch: {
      years: "1946–2026",
      deathDate: "2026-07-03",
      works: ["Женщины без мужчин","Touba and the Meaning of Night","Kissing the Sword"],
    },
    evidence: [
      { provider: "Feminist Press", url: "https://feministpress.org/blogs/news/remembering-iranian-author-and-activist-shahrnush-parsipur-1946-2026", checkedAt },
      { provider: "Stanford University", url: "https://events.stanford.edu/event/shahrnush-parsipur-in-memoriam", checkedAt },
      { provider: "The Guardian", url: "https://www.theguardian.com/books/2026/jul/24/shahrnush-parsipur-obituary", checkedAt },
    ],
    note: "Текущая запись устарела: после смерти писательницы в 2026 году нужно закрыть years и заполнить deathDate. BirthDate и birthPlace подтверждены; works следует расширить тремя аттестованными книгами.",
  },
  {
    countryId: "iran",
    writerId: "simin_daneshvar",
    patch: {
      deathPlace: "Тегеран, Иран",
    },
    evidence: [
      { provider: "Encyclopaedia Iranica", url: "https://www.iranicaonline.org/articles/suvashun/", checkedAt },
      { provider: "The Guardian", url: "https://www.theguardian.com/world/2012/mar/22/simin-daneshvar", checkedAt },
      { provider: "Library of Congress", url: "https://www.loc.gov/exhibits/thousand-years-of-the-persian-book/women-writers.html", checkedAt },
    ],
    note: "Текущие имя, точные даты, birthPlace и произведение подтверждены. Требуется только добавить подтверждённое место смерти — Тегеран; формулировку о первенстве следует делать конкретной, без общего суперлатива.",
  },
  {
    countryId: "iraq",
    writerId: "abd_al_wahhab_al_bayati",
    patch: {
      deathPlace: "Дамаск, Сирия",
      works: ["Разбитые кувшины","Любовь, смерть и изгнание"],
    },
    evidence: [
      { provider: "Encyclopédie Larousse", url: "https://www.larousse.fr/encyclopedie/litterature/Abd_al-Wahhab_al-_Bayyati/171331", checkedAt },
      { provider: "The Independent", url: "https://www.independent.co.uk/arts-entertainment/obituary-abdel-wahab-albayati-1111634.html", checkedAt },
      { provider: "Sultan Bin Ali Al Owais Cultural Foundation", url: "https://www.alowais.com/en/abdul-wahhab-al-bayati/", checkedAt },
    ],
    note: "Текущие точные даты совместимы с биографическими источниками; место смерти нужно добавить. Generic work «Диван стихов» следует заменить конкретными аттестованными сборниками.",
  },
  {
    countryId: "iraq",
    writerId: "abu_nuwas",
    patch: {
      fullName: "Abu Ali al-Hasan ibn Hani al-Hakami",
      years: "ок. 756–ок. 814",
      deathPlace: "Багдад",
      birthDate: "",
      deathDate: "",
    },
    evidence: [
      { provider: "The British Museum", url: "https://www.britishmuseum.org/collection/term/BIOG238337", checkedAt },
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/abu-nuwas", checkedAt },
      { provider: "New York University Press", url: "https://nyupress.org/author/abu-nuwas/", checkedAt },
    ],
    note: "Источники дают интервалы, а не бесспорные годы: текущие birthDate «756» и deathDate «814» следует убрать как точные поля. BirthPlace и «Диван Абу Нуваса» поддержаны; добавляются полное имя и место смерти.",
  },
  {
    countryId: "iraq",
    writerId: "al_mutanabbi",
    patch: {
      fullName: "Abu al-Tayyib Ahmad ibn al-Husayn al-Mutanabbi",
      years: "915/916–965",
      birthDate: "",
    },
    evidence: [
      { provider: "Library of Congress", url: "https://www.loc.gov/item/2021666172", checkedAt },
      { provider: "Treccani", url: "https://www.treccani.it/enciclopedia/al-mutanabbi/", checkedAt },
    ],
    note: "DeathDate «965» и «Диван Аль-Мутанабби» поддержаны, но текущая birthDate «915» скрывает засвидетельствованную вариантность 915/916. Полное имя следует добавить, а точный год рождения вынести только в years.",
  },
  {
    countryId: "iraq",
    writerId: "badr_shakir_al_sayyab",
    patch: {
      birthPlace: "Джейкур близ Басры, Ирак",
      deathPlace: "Кувейт",
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb122972090", checkedAt },
      { provider: "Encyclopædia Universalis", url: "https://www.universalis.fr/encyclopedie/badr-shakir-as-sayyab/", checkedAt },
      { provider: "Cambridge University Press", url: "https://www.cambridge.org/core/journals/international-journal-of-middle-east-studies/article/abs/badr-shakir-alsayyab-and-the-free-verse-movement/BE36EDE3207A246796E77B752EBBC842", checkedAt },
    ],
    note: "Текущие точные birthDate и deathDate подтверждены BnF, а «Песнь дождя» — литературной энциклопедией. BirthPlace следует уточнить как Джейкур близ Басры и добавить deathPlace Кувейт.",
  },
  {
    countryId: "iraq",
    writerId: "fuad_al_takarli",
    patch: {
      birthDate: "1927",
      deathPlace: "Амман, Иордания",
      works: ["The Long Way Back","Ring of Sand"],
    },
    evidence: [
      { provider: "The American University in Cairo Press", url: "https://aucpress.com/9781617971914/the-long-way-back/", checkedAt },
      { provider: "Banipal", url: "https://www.banipal.co.uk/contributors/187/fuad-al-takarli/", checkedAt },
      { provider: "Sultan Bin Ali Al Owais Cultural Foundation", url: "https://www.alowais.com/en/fuad-al-takarli/", checkedAt },
    ],
    note: "Выбранные независимые источники подтверждают только год рождения, поэтому текущую birthDate 1927-08-22 следует сократить до 1927. DeathDate подтверждена, добавляется Амман; текущее название «Дальний берег» не соответствует аттестованному The Long Way Back.",
  },
  {
    countryId: "iraq",
    writerId: "nazik_al_malaika",
    patch: {
      deathPlace: "Каир, Египет",
      works: ["Возлюбленная ночи","Осколки и пепел","Холера"],
    },
    evidence: [
      { provider: "The Guardian", url: "https://www.theguardian.com/news/2007/aug/06/guardianobituaries.poetry", checkedAt },
      { provider: "Encyclopædia Universalis", url: "https://www.universalis.fr/encyclopedie/nazik-al-mala-ika/", checkedAt },
      { provider: "University of Diyala", url: "https://basicedu.uodiyala.edu.iq/uploads/DHAMYA5/%D8%B5%D9%88%D8%B1%20%D8%A7%D9%84%D8%AA%D8%AF%D8%B1%D9%8A%D8%B3%D9%8A%20%D8%A7%D9%84%D9%83%D9%84%D9%8A%D8%A9/%D9%82%D8%B3%D9%85%20%D8%A7%D9%84%D8%AD%D8%A7%D8%B3%D8%A8%D8%A7%D8%AA/%D8%A7%D9%86%D9%83%D9%84%D9%8A%D8%B2%D9%8A/Nazik%20Al-%20Malaika%20Perusals%20and%20Translations.pdf", checkedAt },
    ],
    note: "Текущие точные даты и birthPlace подтверждены. Название «Любовь к тебе» не соответствует основной библиографии: заменить на «Возлюбленная ночи», «Осколки и пепел» и «Холера»; добавить место смерти Каир.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrectionBatch33[];
