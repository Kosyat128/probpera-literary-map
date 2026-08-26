import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch38 = {
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

const checkedAt = "2026-08-13";

export const writerBiographyPublicProfileFactCorrectionsBatch38 = [
  {
    countryId: "lithuania",
    writerId: "maironis",
    patch: { birthDate: "1862-11-02" },
    evidence: [
      { provider: "Visuotinė lietuvių enciklopedija", url: "https://www.vle.lt/straipsnis/maironis/", checkedAt },
      { provider: "Библиотека Конгресса США", url: "https://id.loc.gov/authorities/names/n50034352.html", checkedAt },
    ],
    note: "Дата 21 октября соответствует старому стилю; современная календарная дата - 2 ноября 1862 года.",
  },
  {
    countryId: "luxembourg",
    writerId: "guy_helminger",
    patch: { name: "Ги Хельмингер", birthDate: "1963-01-20" },
    evidence: [
      { provider: "Centre national de littérature Luxembourg", url: "https://www.autorenlexikon.lu/page/author/490/4909/DEU/index.html", checkedAt },
      { provider: "WorldCat", url: "https://search.worldcat.org/search?q=au%3A%22Helminger%2C+Guy%22", checkedAt },
    ],
    note: "Русская передача фамилии и полная дата рождения нормализованы по национальному литературному профилю.",
  },
  {
    countryId: "madagascar",
    writerId: "charlotte_rafe­nomanjato",
    patch: {
      works: ["Pétales de sortilège", "Le prix de la paix", "Le cinquième sceau"],
      genres: ["роман", "рассказ", "драма"],
    },
    evidence: [
      { provider: "University of Western Australia - African Literature", url: "https://aflit.arts.uwa.edu.au/Rafenomanjatoeng.html", checkedAt },
      { provider: "Words Without Borders", url: "https://wordswithoutborders.org/contributors/view/charlotte-arrisoa-rafenomanjato/", checkedAt },
    ],
    note: "Пустая библиография заменена тремя атрибутированными произведениями, жанры расширены.",
  },
  {
    countryId: "madagascar",
    writerId: "flavien_ranaivo",
    patch: {
      birthDate: "1914-05-13",
      deathDate: "1999-12-20",
      birthPlace: "Аривонимамо, Мадагаскар",
      deathPlace: "Труа, Франция",
      works: ["L’ombre et le vent", "Mes chansons de toujours", "Le retour au bercail"],
      language: "французский",
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb11921117h", checkedAt },
      { provider: "WorldCat", url: "https://search.worldcat.org/search?q=au%3A%22Ranaivo%2C+Flavien%22", checkedAt },
    ],
    note: "Полные даты, места, язык публикаций и библиография уточнены по библиотечным записям.",
  },
  {
    countryId: "madagascar",
    writerId: "jean_joseph_rabearivelo",
    patch: {
      birthDate: "1901-03-04",
      deathDate: "1937-06-23",
      birthPlace: "Антананариву, Мадагаскар",
      deathPlace: "Антананариву, Мадагаскар",
      works: ["Presque-Songes", "Traduit de la nuit"],
      language: "французский, малагасийский",
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb12021877w", checkedAt },
      { provider: "Encyclopædia Britannica", url: "https://www.britannica.com/biography/Jean-Joseph-Rabearivelo", checkedAt },
    ],
    note: "Профиль получает точные даты и места, двуязычие и конкретные поэтические сборники.",
  },
  {
    countryId: "madagascar",
    writerId: "jean_luc_raharimanana",
    patch: {
      birthPlace: "Антананариву, Мадагаскар",
      works: ["Nour, 1947", "Za", "Revenir"],
      genres: ["роман", "поэзия", "драма"],
    },
    evidence: [
      { provider: "La Marelle", url: "https://www.la-marelle.org/en-creation/auteurs-autrices/1609-jean-luc-raharimanana.html", checkedAt },
      { provider: "And Other Stories", url: "https://www.andotherstories.org/authors/jean-luc-raharimanana/", checkedAt },
    ],
    note: "Общее место рождения и пустая библиография заменены атрибутированными данными.",
  },
  {
    countryId: "madagascar",
    writerId: "michele_rakotoson",
    patch: {
      birthPlace: "Антананариву, Мадагаскар",
      works: ["Le bain des reliques", "Lalana", "Elle, au printemps"],
      genres: ["роман", "драма", "эссе"],
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=12012965", checkedAt },
      { provider: "University of Western Australia - African Literature", url: "https://aflit.arts.uwa.edu.au/RakotosonMicheleEng.html", checkedAt },
    ],
    note: "Место рождения, жанры и библиография уточнены.",
  },
  {
    countryId: "madagascar",
    writerId: "regis_rajemisa_raolison",
    patch: {
      name: "Режис Радземиса-Раулизон",
      years: "1913-1990",
      deathDate: "1990",
      works: ["Rakibolana malagasy"],
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://data.bnf.fr/fr/ark%3A/12148/cb12147192w", checkedAt },
      { provider: "Catalogue collectif de France", url: "https://ccfr.bnf.fr/portailccfr/ark%3A/16871/0016934243", checkedAt },
    ],
    note: "Год смерти 1997 исправлен на 1990; русская передача имени и словарь уточнены.",
  },
  {
    countryId: "malawi",
    writerId: "frank_chipasula",
    patch: {
      fullName: "Frank Mkalawile Chipasula",
      birthDate: "1949-10-16",
      works: ["Visions and Reflections", "O Earth, Wait for Me", "Whispers in the Wings"],
    },
    evidence: [
      { provider: "Southern Illinois University", url: "https://faculty.siu.edu/profiles/a-c/chipasula-frank.php", checkedAt },
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/frank-chipasula", checkedAt },
    ],
    note: "Полное имя, день рождения и поэтическая библиография подтверждены.",
  },
  {
    countryId: "malawi",
    writerId: "legson_kayira",
    patch: { years: "ок. 1942-2012", birthDate: "" },
    evidence: [
      { provider: "Skagit Valley College Hall of Fame", url: "https://www.skagit.edu/hall-of-fame/inductees.html", checkedAt },
      { provider: "WorldCat", url: "https://search.worldcat.org/search?q=au%3A%22Kayira%2C+Legson%22", checkedAt },
    ],
    note: "Точный день не подтверждён: 10 мая и 1942 год были выбраны самим автором при отсутствии записи о рождении.",
  },
  {
    countryId: "malawi",
    writerId: "paul_tiyambe_zeleza",
    patch: {
      birthDate: "1955-05-25",
      birthPlace: "Солсбери, Южная Родезия (ныне Хараре, Зимбабве)",
      works: ["The Joys of Exile", "Smouldering Charcoal"],
    },
    evidence: [
      { provider: "Howard University", url: "https://profiles.howard.edu/paul-tiyambe-zeleza", checkedAt },
      { provider: "United States International University-Africa", url: "https://www.usiu.ac.ke/1813/gratitude-reflections-landmark-birthday", checkedAt },
    ],
    note: "Дата и место рождения исправлены по автобиографической университетской публикации; добавлен роман.",
  },
  {
    countryId: "malawi",
    writerId: "steve_chimombo",
    patch: {
      fullName: "Steve Bernard Miles Chimombo",
      birthPlace: "Зомба, Малави",
      works: ["Napolo and the Python", "The Basket Girl", "Malawian Oral Literature"],
      genres: ["поэзия", "проза", "драма", "детская литература"],
    },
    evidence: [
      { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/steve-chimombo", checkedAt },
      { provider: "WorldCat", url: "https://search.worldcat.org/fr/title/malawian-oral-literature-the-aesthetics-of-indigenous-arts/oclc/23532988", checkedAt },
    ],
    note: "Полное имя, место рождения, жанры и библиография дополнены.",
  },
  {
    countryId: "malaysia",
    writerId: "kemala",
    patch: {
      fullName: "Ahmad Kamal Abdullah",
      years: "1941-2021",
      birthDate: "1941-01-30",
      deathDate: "2021-10-27",
      birthPlace: "Гомбак, Селангор, Малайзия",
      coordinates: undefined,
      works: ["Mim", "‘Ayn", "Timbang Terima"],
      genres: ["поэзия", "драма", "литературная критика"],
      awards: ["Sasterawan Negara, 2011"],
    },
    evidence: [
      { provider: "Dewan Bahasa dan Pustaka", url: "https://dewansastera.jendeladbp.my/2021/10/31/2264/", checkedAt },
      { provider: "WorldCat", url: "https://search.worldcat.org/search?q=au%3A%22Kemala%2C+1941-2021%22", checkedAt },
    ],
    note: "Чужое полное имя, дата, место и статус живого автора исправлены; координаты прежнего места удалены.",
  },
  {
    countryId: "malaysia",
    writerId: "tan_twan_eng",
    patch: {
      birthDate: "",
      works: ["The Gift of Rain", "The Garden of Evening Mists", "The House of Doors"],
      awards: ["Короткий список Букеровской премии, 2012", "Длинный список Международной Букеровской премии, 2023"],
    },
    evidence: [
      { provider: "The Booker Prizes", url: "https://thebookerprizes.com/the-booker-library/authors/twan-eng-tan", checkedAt },
      { provider: "British Council Literature", url: "https://literature.britishcouncil.org/writer/tan-twan-eng", checkedAt },
    ],
    note: "Техническая дата 1 января удалена; библиография и премиальные статусы приведены к конкретным данным.",
  },
  {
    countryId: "maldives",
    writerId: "abdulla_sodiq",
    patch: { years: "ок. 1935-", birthDate: "1935", coordinates: undefined },
    evidence: [
      { provider: "SunOnline International", url: "https://english.sun.mv/94453", checkedAt },
      { provider: "Maldives National University Repository", url: "https://saruna.mnu.edu.mv/items/46fe73c3-d96a-4151-803c-86bb204fefb9", checkedAt },
    ],
    note: "Год 1946 противоречит сообщению о 90-летии в январе 2025 года; точный день не добавляется, общие координаты страны удалены.",
  },
  {
    countryId: "maldives",
    writerId: "muhammad_jameel_didi",
    patch: { works: ["Gaumii salaam (текст государственного гимна Мальдив)"] },
    evidence: [
      { provider: "Maldives National University Repository", url: "https://saruna.mnu.edu.mv/bitstreams/b5fa6d10-f16d-40ec-a0e2-cbbf4f52f74e/download", checkedAt },
      { provider: "Maldives Royal Family", url: "https://maldivesroyalfamily.com/maldives_anthem.shtml", checkedAt },
    ],
    note: "Служебное название «Поэтические произведения» заменено атрибутированным текстом гимна.",
  },
  {
    countryId: "mali",
    writerId: "adame_ba_konare",
    patch: { birthPlace: "Сегу, Мали", works: ["Le Wassa ou les secrets d’une reine"] },
    evidence: [
      { provider: "Institut des Sciences Humaines du Mali", url: "https://www.ish-mali.ml/ish-web/storage/app/public/fichiers/a9tuwbTz6BoJJIRHG1GgcIlpk4xuc68PQGOMmBqS.pdf", checkedAt },
      { provider: "University of Western Australia - African Literature", url: "https://aflit.arts.uwa.edu.au/BaKonareAdameEng.html", checkedAt },
    ],
    note: "Место рождения Бамако исправлено на Сегу; добавлен роман.",
  },
  {
    countryId: "mali",
    writerId: "amadou_hampate_ba",
    patch: { works: ["L’Étrange Destin de Wangrin", "Amkoullel, l’enfant peul"] },
    evidence: [
      { provider: "UNESCO", url: "https://www.unesco.org/en/memory-world/amadou-hampate-ba/guardian-african-heritage", checkedAt },
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/rechercher.do?motRecherche=Amadou+Hampate+Ba&critereRecherche=0&depart=0&facetteModifiee=ok", checkedAt },
    ],
    note: "Неточное название «Дающий слово» заменено документированными книгами.",
  },
  {
    countryId: "mali",
    writerId: "fily_dabo_sissoko",
    patch: {
      birthDate: "1900-05-15",
      deathDate: "1964-06-30",
      birthPlace: "Хорокото, Французский Судан (ныне Мали)",
      deathPlace: "Кидаль, Мали",
      works: ["La passion de Djimé", "Sagesse noire"],
    },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark%3A/12148/cb12174728b", checkedAt },
      { provider: "Assemblée nationale française", url: "https://www2.assemblee-nationale.fr/sycomore/fiche/6862", checkedAt },
    ],
    note: "Полные даты и места жизни, а также библиография уточнены по библиотечной и парламентской записям.",
  },
  {
    countryId: "mali",
    writerId: "massa_makan_diabate",
    patch: { works: ["Le lieutenant de Kouta", "Le coiffeur de Kouta", "Le boucher de Kouta"], genres: ["роман", "драма", "устная традиция"] },
    evidence: [
      { provider: "Bibliothèque nationale de France", url: "https://data.bnf.fr/temp-work/d12cdff6e1e499d6c9979e176e9405c6/", checkedAt },
      { provider: "WorldCat", url: "https://search.worldcat.org/search?q=au%3A%22Diabate%2C+Massa+Makan%22", checkedAt },
    ],
    note: "Одна русская позиция заменена полной трилогией о Куте, жанры уточнены.",
  },
] as const satisfies readonly WriterPublicProfileFactCorrectionBatch38[];
