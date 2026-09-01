import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch42 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-20";

function sources(
  ...items: ReadonlyArray<readonly [provider: string, url: string]>
) {
  return items.map(([provider, url]) => ({ provider, url, checkedAt }));
}

export const writerBiographyPublicProfileFactCorrectionsBatch42 = [
  {
    countryId: "new_zealand",
    writerId: "keri_hulme",
    patch: {
      works: ["The Bone People", "Te Kaihau / The Windeater"],
      genres: ["роман", "рассказ", "поэзия"],
      awards: ["Букеровская премия за The Bone People, 1985"],
    },
    evidence: sources(
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/keri-hulme"],
      ["National Library of New Zealand", "https://natlib.govt.nz/records/22396605"]
    ),
    note: "Произведения приведены к оригинальным названиям; рассказ и формулировка Букеровской премии уточнены.",
  },
  {
    countryId: "new_zealand",
    writerId: "loyd_jones",
    patch: {
      birthPlace: "Лоуэр-Хатт, Новая Зеландия",
      coordinates: { lat: -41.2127, lng: 174.8997 },
      works: ["Mister Pip", "The Book of Fame", "Here at the End of the World We Learn to Dance"],
      awards: ["Commonwealth Writers’ Prize за Mister Pip, 2007"],
      genres: ["роман", "проза"],
    },
    evidence: sources(
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/jones-lloyd"],
      ["Massey University Press", "https://www.masseypress.ac.nz/authors/lloyd-jones/"],
      ["GeoNames", "https://www.geonames.org/2188164/lower-hutt.html"]
    ),
    note: "Порт-Морсби и его координаты заменены на Лоуэр-Хатт; библиография и премия приведены к источникам.",
  },
  {
    countryId: "new_zealand",
    writerId: "patricia_grace",
    patch: {
      works: ["Potiki", "Cousins", "Tu"],
      genres: ["роман", "рассказ", "литература маори"],
      awards: ["Neustadt International Prize for Literature, 2008"],
    },
    evidence: sources(
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/grace-patricia"],
      ["Neustadt International Prize for Literature", "https://www.neustadtprize.org/2008-neustadt-prize-laureate-patricia-grace/"]
    ),
    note: "Названия романов сохранены в оригинале, а премия получила официальное название и год.",
  },
  {
    countryId: "new_zealand",
    writerId: "robin_hyde",
    patch: {
      fullName: "Iris Guiver Wilkinson (Robin Hyde)",
      works: ["The Godwits Fly", "Wednesday’s Children"],
      genres: ["роман", "поэзия", "журналистика"],
    },
    evidence: sources(
      ["Dictionary of New Zealand Biography", "https://teara.govt.nz/en/biographies/4h41/hyde-robin"],
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/hyde-robin"]
    ),
    note: "Авторитетная форма настоящего имени соединена с псевдонимом; журналистика и типографика названия уточнены.",
  },
  {
    countryId: "new_zealand",
    writerId: "witi_ihimaera",
    patch: {
      works: ["Tangi", "The Whale Rider", "The Matriarch"],
      genres: ["роман", "рассказ", "эссе", "драматургия", "редакторская работа", "литературная критика"],
    },
    evidence: sources(
      ["Massey University Press", "https://www.masseypress.ac.nz/authors/witi-ihimaera/"],
      ["Read NZ Te Pou Muramura", "https://www.read-nz.org/writers-files/writer/ihimaera-witi"]
    ),
    note: "Библиография сохранена в оригинале; документированные литературные роли добавлены в жанры.",
  },
  {
    countryId: "nicaragua",
    writerId: "ernesto_cardenal",
    patch: {
      works: ["Salmos", "Hora 0", "Cántico cósmico"],
      genres: ["поэзия", "эссе"],
    },
    evidence: sources(
      ["Library of Congress", "https://www.loc.gov/item/n79058833/ernesto-cardenal-nicaragua-1925/"],
      ["Northwestern University Press", "https://nupress.northwestern.edu/9781880684931/cosmic-canticle/"]
    ),
    note: "Переводные заголовки заменены оригинальными названиями трёх книг.",
  },
  {
    countryId: "nicaragua",
    writerId: "gioconda_belli",
    patch: {
      works: ["La mujer habitada", "El país bajo mi piel", "El ojo de la mujer"],
      genres: ["роман", "поэзия", "мемуарная проза"],
    },
    evidence: sources(
      ["Instituto Cervantes", "https://cvc.cervantes.es/benengeli/25/biografias_en.htm"],
      ["Secretaría de Cultura de México", "https://www.gob.mx/cultura/prensa/gioconda-belli-obtiene-el-premio-internacional-carlos-fuentes-a-la-creacion-literaria-en-el-idioma-espanol-2025"]
    ),
    note: "Переводные и неточные рубрики заменены оригинальными названиями романа, мемуаров и поэтического сборника.",
  },
  {
    countryId: "nicaragua",
    writerId: "ruben_dario",
    patch: {
      fullName: "Félix Rubén García Sarmiento (Rubén Darío)",
      works: ["Azul…", "Prosas profanas y otros poemas", "Cantos de vida y esperanza"],
      genres: ["поэзия", "журналистика", "эссе"],
    },
    evidence: sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/servicios/informacion-bibliografica/muestras-bibliograficas/dario_ruben_1867-1916/"],
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/dario_ruben.htm"]
    ),
    note: "Добавлены настоящее имя и оригинальные названия трёх книг; жанры приведены к биографическим источникам.",
  },
  {
    countryId: "nicaragua",
    writerId: "sergio_ramirez",
    patch: {
      works: ["Margarita, está linda la mar", "El cielo llora por mí"],
      genres: ["роман", "рассказ", "эссе", "журналистика"],
      awards: ["Премия Сервантеса, 2017"],
    },
    evidence: sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/ramirez_sergio.htm"],
      ["Real Academia Española", "https://www.rae.es/sites/default/files/180423_NP_Entrega_Premio_Cervantes_a_Sergio_Ramirez.pdf"]
    ),
    note: "Названия романов приведены к оригиналам; жанры и официальная формулировка премии уточнены.",
  },
  {
    countryId: "niger",
    writerId: "abdoulaye_mamani",
    patch: {
      years: "1932-1993",
      birthDate: "1932",
      works: ["Sarraounia"],
      genres: ["роман", "поэзия", "историческая проза"],
    },
    evidence: sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/rechercher.do?index=TOUS3&numNotice=34227375&typeNotice=C"],
      ["WorldCat", "https://search.worldcat.org/title/Sarraounia/oclc/1130985466"]
    ),
    note: "Ошибочный год рождения 1939 заменён на 1932; поэзия добавлена как документированная роль.",
  },
  {
    countryId: "niger",
    writerId: "boubou_hama",
    patch: {
      works: ["Contes et légendes du Niger", "Izé-Gani"],
      genres: ["проза", "эссе", "история"],
    },
    evidence: sources(
      ["Académie des sciences d’outre-mer", "https://academieoutremer.fr/academiciens/?aId=862"],
      ["Centre Culturel Franco-Nigérien Jean Rouch", "https://pmb.ccnigerien.org/opac_css/index.php?id=617&lvl=author_see"]
    ),
    note: "Пустая библиография дополнена двумя каталогизированными книгами; жанры очищены от неподтверждённого обобщения.",
  },
  {
    countryId: "niger",
    writerId: "mariama_hima",
    patch: {
      years: "1951-",
      birthDate: "1951-02-20",
      works: ["Sagesse africaine: proverbes"],
      genres: ["документальное кино", "этнология", "антропология", "дипломатическая работа"],
    },
    evidence: sources(
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb131962985"],
      ["African Film Festival New York", "https://africanfilmny.org/directors/mariama-hima/"]
    ),
    note: "Год рождения 1957 исправлен на 1951; профессии и единственная подтверждённая книга заменили общие литературные рубрики.",
  },
  {
    countryId: "nigeria",
    writerId: "ben_okri",
    patch: {
      works: ["The Famished Road"],
      genres: ["роман", "поэзия", "драматургия", "эссе"],
      awards: ["Букеровская премия за The Famished Road, 1991"],
    },
    evidence: sources(
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/the-famished-road"],
      ["Bloomsbury", "https://www.bloomsbury.com/UK/author/ben-okri/"]
    ),
    note: "Произведение приведено к оригинальному названию; жанры и критерий Букеровской премии уточнены.",
  },
  {
    countryId: "nigeria",
    writerId: "buchi_emecheta",
    patch: {
      works: ["Second-Class Citizen", "The Slave Girl", "The Joys of Motherhood"],
      genres: ["роман", "пьеса", "автобиографическая проза"],
    },
    evidence: sources(
      ["Bloomsbury", "https://www.bloomsbury.com/uk/author/buchi-emecheta/"],
      ["Goldsmiths, University of London / Oxford Dictionary of National Biography", "https://research.gold.ac.uk/id/eprint/31482/1/OxfordDNB%20B%20Emecheta.pdf"]
    ),
    note: "Один переводной заголовок заменён тремя оригинальными романами; документированные жанры дополнены.",
  },
  {
    countryId: "nigeria",
    writerId: "chimamanda_adichie",
    patch: {
      works: ["Purple Hibiscus", "Half of a Yellow Sun", "Americanah"],
      genres: ["роман", "рассказ", "эссе"],
      awards: ["MacArthur Fellowship, 2008"],
    },
    evidence: sources(
      ["Chimamanda Ngozi Adichie", "https://www.chimamanda.com/about/"],
      ["MacArthur Foundation", "https://www.macfound.org/media/files/ar2008.pdf"]
    ),
    note: "Библиография дополнена дебютным романом и приведена к оригиналам; добавлена официально подтверждённая стипендия.",
  },
  {
    countryId: "nigeria",
    writerId: "chinua_achebe",
    patch: {
      works: ["Things Fall Apart", "Arrow of God"],
      genres: ["роман", "поэзия", "эссе", "литературная критика"],
    },
    evidence: sources(
      ["Brown University", "https://archive2.news.brown.edu/2007-2015/articles/2013/03/achebe.html"],
      ["Bard College", "https://alums.bard.edu/news/remembrances/chinua-achebe-1930-2013"]
    ),
    note: "Переводной заголовок заменён двумя оригинальными названиями; жанры дополнены по университетским биографиям.",
  },
  {
    countryId: "nigeria",
    writerId: "christopher_okigbo",
    patch: {
      works: ["Heavensgate", "Limits", "Labyrinths"],
      genres: ["поэзия"],
    },
    evidence: sources(
      ["Harry Ransom Center, The University of Texas at Austin", "https://research.hrc.utexas.edu/fasearch/pdf/01310.pdf"],
      ["Cambridge University Press", "https://www.cambridge.org/core/books/christopher-okigbo-193067/2654FD507580946F54CC5B8665BFC9DA"]
    ),
    note: "Один переводной заголовок заменён тремя библиографически установленными оригинальными названиями.",
  },
  {
    countryId: "nigeria",
    writerId: "d_o_fagunwa",
    patch: {
      fullName: "Daniel Olorunfemi Fagunwa",
      works: ["Ògbójú Ọdẹ nínú Igbó Irúnmalẹ̀"],
      genres: ["роман", "проза на языке йоруба", "фольклорная проза"],
    },
    evidence: sources(
      ["University of Ibadan Repository", "https://repository.ui.edu.ng/server/api/core/bitstreams/535dce3a-1a97-4ed9-a435-5e0f306dd45b/content"],
      ["University of Warsaw", "https://omc.obta.al.uw.edu.pl/myth-survey/creator/877"]
    ),
    note: "Пропущенная часть полного имени восстановлена; переводной заголовок заменён оригинальным названием дебютного романа.",
  },
  {
    countryId: "nigeria",
    writerId: "flora_nwapa",
    patch: {
      works: ["Efuru"],
      genres: ["роман", "поэзия", "издательская работа"],
    },
    evidence: sources(
      ["Bloomsbury", "https://www.bloomsbury.com/UK/author/flora-nwapa/"],
      ["Oxford Academic", "https://academic.oup.com/edited-volume/61663/chapter-abstract/553364942"]
    ),
    note: "Название романа приведено к оригиналу; поэзия и издательская работа добавлены как документированные роли.",
  },
  {
    countryId: "nigeria",
    writerId: "helon_habila",
    patch: {
      works: ["Waiting for an Angel", "Measuring Time", "Oil on Water"],
      genres: ["роман", "рассказ", "творческое письмо"],
      awards: ["Caine Prize for African Writing, 2001"],
    },
    evidence: sources(
      ["George Mason University", "https://cheusecenter.gmu.edu/residencies/cheusecentereventswriters/writers?profile_id=2164"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/266626/helon-habila/"],
      ["The Caine Prize for African Writing", "https://static1.squarespace.com/static/565c3d39e4b027c789ba5b70/t/66586138c2cb205f80258769/1717068102051/Caine%2BPrize%2Bannual%2Breport%2B2019.pdf"]
    ),
    note: "Переводной заголовок заменён тремя оригинальными книгами; официальная премия добавлена с годом.",
  },
  {
    countryId: "nigeria",
    writerId: "teju_cole",
    patch: {
      birthPlace: "Каламазу, Мичиган, США",
      coordinates: { lat: 42.2917, lng: -85.5872 },
      works: ["Open City", "Every Day Is for the Thief"],
      genres: ["роман", "эссе", "фотография", "художественная критика"],
    },
    evidence: sources(
      ["Harvard Graduate School of Design", "https://www.gsd.harvard.edu/2019/05/teju-cole-on-the-unpredictability-and-potential-of-the-city-once-you-give-up-insisting-on-stereotypes-you-can-really-start-to-see/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/91688/teju-cole/"],
      ["GeoNames", "https://www.geonames.org/4997787/kalamazoo.html"]
    ),
    note: "Калабар и его координаты заменены на Каламазу; библиография и творческие роли уточнены.",
  },
  {
    countryId: "nigeria",
    writerId: "wole_soyinka",
    patch: {
      works: ["Death and the King’s Horseman", "The Interpreters"],
      genres: ["драматургия", "поэзия", "роман", "эссе"],
      awards: ["Нобелевская премия по литературе, 1986"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1986/soyinka/biographical/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/2268746/wole-soyinka/"]
    ),
    note: "Библиография приведена к оригинальным названиям; жанры и формулировка Нобелевской премии уточнены.",
  },
  {
    countryId: "niue",
    writerId: "john_pule",
    patch: {
      birthDate: "1962",
      birthPlace: "деревня Лику, Ниуэ",
      works: ["The Shark That Ate the Sun", "Burn My Head in Heaven"],
      genres: ["поэзия", "роман", "изобразительное искусство"],
    },
    evidence: sources(
      ["Arts Foundation of New Zealand", "https://www.thearts.co.nz/artists/john-pule"],
      ["University of Auckland Art Collection", "https://artcollection.auckland.ac.nz/essay/69166"]
    ),
    note: "Неподтверждённый точный день рождения сведен к году; Алофи исправлен на Лику, жанры приведены к источникам.",
  },
  {
    countryId: "north_korea",
    writerId: "choe_myong_ik",
    patch: {
      years: "1903-?",
      birthDate: "1903",
      deathDate: "",
      birthPlace: "Пхеньян, Корея",
      works: ["Patterns of the Heart and Other Stories"],
      genres: ["рассказ", "модернистская проза", "психологическая проза"],
    },
    evidence: sources(
      ["Columbia University Press", "https://cup.columbia.edu/book/patterns-of-the-heart-and-other-stories/9780231202718/"],
      ["Academy of Korean Studies", "https://encykorea.aks.ac.kr/Article/E0057291"]
    ),
    note: "Неподтверждённый 1973 год смерти удалён; рождение в Пхеньяне и проверенное англоязычное издание добавлены осторожно.",
  },
  {
    countryId: "north_korea",
    writerId: "han_sorya",
    patch: {
      birthDate: "1900",
      deathDate: "1976",
      works: [],
      genres: ["роман", "рассказ", "литературное администрирование"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Koreas_litteratur"],
      ["University of Toronto Press Distribution", "https://utpdistribution.com/9780939657841/han-sorya-and-north-korean-literature/"]
    ),
    note: "Техническая точность дней рождения и смерти сведена к годам; неподтверждённые названия произведений удалены.",
  },
  {
    countryId: "north_korea",
    writerId: "paek_nam_nyong",
    patch: {
      works: ["Friend"],
      genres: ["роман", "проза"],
    },
    evidence: sources(
      ["Columbia University Press", "https://cup.columbia.edu/book/friend/9780231195614/"],
      ["Store norske leksikon", "https://snl.no/Koreas_litteratur"]
    ),
    note: "Проверенный роман сохранён; жанровая рубрика уточнена.",
  },
  {
    countryId: "north_korea",
    writerId: "ri_ki_yong",
    patch: {
      years: "1895-1984",
      birthDate: "1895",
      deathDate: "1984",
      works: ["Gohyang (Hometown)", "Ttang (Land)"],
      genres: ["роман", "пролетарская литература", "крестьянская литература"],
    },
    evidence: sources(
      ["LTI Korea Digital Library of Korean Literature", "https://library.ltikorea.or.kr/writer/200282"],
      ["Oxford Academic / University of Hawaiʻi Press", "https://academic.oup.com/hawaii-scholarship-online/book/22072/chapter-abstract/182176344"]
    ),
    note: "Неподтверждённые точные дни сведены к годам; два романа и литературные направления приведены к институциональным источникам.",
  },
  {
    countryId: "north_macedonia",
    writerId: "blazhe_koneski",
    patch: {
      works: ["Мостот", "Земјата и љубовта", "Везилка", "Лозје"],
      genres: ["поэзия", "рассказ", "филология", "языкознание"],
    },
    evidence: sources(
      ["Macedonian Academy of Sciences and Arts", "https://koneski.manu.edu.mk/"],
      ["Hrvatska enciklopedija", "https://www.enciklopedija.hr/clanak/koneski-blaze"]
    ),
    note: "Произведения приведены к македонским оригиналам без дублирующих переводных кавычек; языкознание добавлено как документированная область.",
  },
  {
    countryId: "north_macedonia",
    writerId: "kocho_racin",
    patch: {
      works: ["Бели мугри"],
      genres: ["поэзия", "проза", "эссе"],
    },
    evidence: sources(
      ["Treccani", "https://www.treccani.it/enciclopedia/koco-racin/"],
      ["Hrvatska enciklopedija", "https://enciklopedija.hr/clanak/racin-koco"]
    ),
    note: "Неподтверждённая в выбранных источниках «Антология боли» удалена; основной сборник сохранён в оригинале.",
  },
  {
    countryId: "norway",
    writerId: "aksel_sandemose",
    patch: {
      fullName: "Axel Nielsen (Aksel Sandemose)",
      birthPlace: "Нюкёбинг-Морс, Дания",
      coordinates: { lat: 56.79334, lng: 8.85282 },
      works: ["En flyktning krysser sitt spor"],
      genres: ["роман", "проза"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Aksel_Sandemose"],
      ["WorldCat", "https://search.worldcat.org/title/flyktning-krysser-sitt-spor-fortelling-om-en-morders-barndom-1933-utgaven/oclc/173484460"],
      ["GeoNames", "https://www.geonames.org/2615964/nykobing-mors.html"]
    ),
    note: "Добавлено имя при рождении; неоднозначный Нюкёбинг и ошибочные координаты уточнены до Нюкёбинг-Морса, роман приведён к оригиналу.",
  },
  {
    countryId: "norway",
    writerId: "alexander_kielland",
    patch: {
      fullName: "Alexander Lange Kielland",
      works: ["Garman & Worse", "Skipper Worse", "Gift"],
      genres: ["роман", "новелла", "драматургия", "реализм", "сатира"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Alexander_Kielland"],
      ["Gyldendal", "https://www.gyldendal.no/forfattere/alexander-l-kielland"]
    ),
    note: "Полное имя раскрыто; переводной заголовок заменён тремя оригинальными романами, жанры дополнены.",
  },
  {
    countryId: "norway",
    writerId: "amalie_skram",
    patch: {
      fullName: "Berta Amalie Alver Skram",
      works: ["Hellemyrsfolket", "Constance Ring", "Forrådt"],
      genres: ["роман", "рассказ", "драматургия", "литературная критика", "натурализм"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Amalie_Skram"],
      ["Gyldendal", "https://www.gyldendal.no/forfattere/amalie-skram"]
    ),
    note: "Полное имя и библиография уточнены; жанры дополнены по национальной энциклопедии и издательскому профилю.",
  },
  {
    countryId: "norway",
    writerId: "bjornstjerne_bjornson",
    patch: {
      fullName: "Bjørnstjerne Martinius Bjørnson",
      works: ["Synnøve Solbakken", "Arne", "Ja, vi elsker dette landet"],
      genres: ["роман", "рассказ", "драматургия", "поэзия", "журналистика"],
      awards: ["Нобелевская премия по литературе, 1903"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/themes/bjornson/"],
      ["Store norske leksikon", "https://snl.no/Bj%C3%B8rnstjerne_Bj%C3%B8rnson"]
    ),
    note: "Полное имя раскрыто; произведения приведены к оригиналам, добавлен текст гимна, жанры и премия уточнены.",
  },
  {
    countryId: "norway",
    writerId: "camilla_collett",
    patch: {
      works: ["Amtmandens Døttre", "I de lange Nætter"],
      genres: ["роман", "эссе", "автобиографическая проза", "публицистика"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Camilla_Collett"],
      ["Gyldendal", "https://www.gyldendal.no/forfattere/camilla-collett"]
    ),
    note: "Переводной заголовок заменён двумя оригинальными названиями, жанры дополнены.",
  },
  {
    countryId: "norway",
    writerId: "erlend_loe",
    patch: {
      works: ["Tatt av kvinnen", "Naiv. Super", "Doppler"],
      genres: ["роман", "детская литература", "сценарий", "перевод"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Erlend_Loe"],
      ["Albert Bonniers Förlag", "https://www.albertbonniersforlag.se/forfattare/14129/"]
    ),
    note: "Переводной заголовок заменён тремя оригинальными названиями; жанры приведены к документированным ролям.",
  },
  {
    countryId: "norway",
    writerId: "henrik_ibsen",
    patch: {
      works: ["Et dukkehjem", "Gengangere", "Hedda Gabler", "Peer Gynt"],
      genres: ["драматургия", "поэзия", "театр"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Henrik_Ibsen"],
      ["University of Oslo, Henrik Ibsen’s Writings", "https://www.ibsen.uio.no/VERK_Du.xhtml"]
    ),
    note: "Три переводных заголовка заменены четырьмя оригинальными названиями; жанры уточнены.",
  },
  {
    countryId: "norway",
    writerId: "jo_nesbo",
    patch: {
      works: ["Серия о Харри Холе", "Hodejegerne", "Sønnen"],
      genres: ["детектив", "триллер", "детская литература"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Jo_Nesb%C3%B8"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/68917/jo-nesbo/"]
    ),
    note: "Цикл дополнен двумя самостоятельными романами; набор жанров уточнён по авторитетным профилям.",
  },
  {
    countryId: "norway",
    writerId: "jon_fosse",
    patch: {
      name: "Юн Фоссе",
      works: ["Septologien", "Nokon kjem til å komme", "Morgon og kveld"],
      genres: ["драматургия", "роман", "поэзия", "эссе", "перевод"],
      awards: ["Нобелевская премия по литературе, 2023"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2023/bio-bibliography/"],
      ["Bloomsbury", "https://www.bloomsbury.com/UK/author/jon-fosse/"]
    ),
    note: "Краткая русская форма имени отделена от полного имени; произведения приведены к нюнорским оригиналам, жанры и премия уточнены.",
  },
] satisfies readonly WriterPublicProfileFactCorrectionBatch42[];
