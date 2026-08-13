import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch40 = {
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

const checkedAt = "2026-08-14";

function sources(
  provider: string,
  url: string,
  secondProvider: string,
  secondUrl: string
) {
  return [
    { provider, url, checkedAt },
    { provider: secondProvider, url: secondUrl, checkedAt },
  ];
}

export const writerBiographyPublicProfileFactCorrectionsBatch40 = [
  {
    countryId: "mexico",
    writerId: "sor_juana_ines_de_la_cruz",
    patch: {
      works: [
        "Primero sueño",
        "Los empeños de una casa",
        "Respuesta a sor Filotea de la Cruz",
      ],
      genres: ["поэзия", "драма", "проза"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/1161Cruz",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Juana+Ines+de+la+Cruz%22"
    ),
    note: "Оценочные первенствующие формулы заменены тремя каталогизированными произведениями и документированными жанрами.",
  },
  {
    countryId: "mexico",
    writerId: "valeria_luiselli",
    patch: {
      works: [
        "Los ingrávidos",
        "La historia de mis dientes",
        "Lost Children Archive",
      ],
      genres: ["роман", "эссе", "документальная проза"],
      awards: ["Стипендия Мак-Артура, 2019"],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/2825",
      "MacArthur Foundation",
      "https://www.macfound.org/fellows/class-of-2019/valeria-luiselli"
    ),
    note: "Названия приведены к оригиналам, жанры уточнены, а неподтверждённая награда заменена официальной стипендией 2019 года.",
  },
  {
    countryId: "mexico",
    writerId: "yuri_herrera",
    patch: {
      name: "Юри Эррера",
      birthDate: "1970",
      works: [
        "Trabajos del reino",
        "Señales que precederán al fin del mundo",
        "La transmigración de los cuerpos",
      ],
      genres: ["роман", "перевод", "литературные исследования"],
      awards: [],
    },
    evidence: sources(
      "Enciclopedia de la Literatura en México",
      "https://www.elem.mx/autor/datos/3471",
      "Tulane University",
      "https://stonecenter.tulane.edu/yuri-herrera-gutierrez"
    ),
    note: "Имя нормализовано, техническая дата 1 января сведена к году, произведения и роли приведены к источникам; ложная премия удалена.",
  },
  {
    countryId: "moldova",
    writerId: "grigore_vieru",
    patch: {
      works: ["Alarma", "Numele tău", "Taina care mă apără"],
      genres: ["поэзия", "детская литература"],
      awards: ["Почётный диплом имени Х. К. Андерсена, 1988"],
    },
    evidence: sources(
      "MOLDPRES",
      "https://www.moldpres.md/eng/culture/exhibition-dedicated-to-poet-grigore-vieru-opened-at-national-library",
      "Biblioteca Națională a Republicii Moldova",
      "https://www.bnrm.md/?p=3122"
    ),
    note: "Профиль дополнен тремя проверенными сборниками, детской литературой и документированной наградой.",
  },
  {
    countryId: "moldova",
    writerId: "ion_druta",
    patch: {
      works: ["Frunze de dor", "Ultima lună de toamnă", "Povara bunătății noastre"],
      genres: ["проза", "драма", "эссе"],
      awards: ["Государственная премия Молдовы, 2008"],
    },
    evidence: sources(
      "Президенция Республики Молдова",
      "https://presedinte.md/rom/discursuri/necrolog-ion-druta-3-septembrie-1928-28-septembrie-2023",
      "Biblioteca Națională a Republicii Moldova",
      "https://www.bnrm.md/wp-content/uploads/2014/06/TP-2018.pdf"
    ),
    note: "Общие названия заменены оригинальной библиографией, жанры и государственная премия уточнены по официальным источникам.",
  },
  {
    countryId: "moldova",
    writerId: "leonida_lari",
    patch: {
      birthPlace: "Бурсучены, Молдова",
      works: ["Piața Diolei", "Marele vânt", "Mitul trandafirului"],
      genres: ["поэзия", "перевод", "публицистика"],
    },
    evidence: sources(
      "MOLDPRES",
      "https://www.moldpres.md/rom/cultura/sau-implinit-70-de-ani-de-la-nasterea-poetei-leonida-lari",
      "Biblioteca Națională a Republicii Moldova",
      "https://www.bnrm.md/?p=762"
    ),
    note: "Исправлено место рождения; добавлены три сборника и подтверждённые творческие роли.",
  },
  {
    countryId: "moldova",
    writerId: "nicolae_dabija",
    patch: {
      birthPlace: "Кодрены, Молдова",
      works: ["Ochiul al treilea", "Tema pentru acasă"],
      genres: ["поэзия", "проза", "публицистика", "история литературы"],
    },
    evidence: sources(
      "MOLDPRES",
      "https://www.moldpres.md/rom/cultura/scriitorul-nicolae-dabija-isi-sarbatoreste-ziua-de-nastere",
      "Biblioteca Națională a Republicii Moldova",
      "https://www.bnrm.md/?p=3044"
    ),
    note: "Исправлено место рождения; пустая библиография заменена двумя атрибутированными книгами и жанрами.",
  },
  {
    countryId: "moldova",
    writerId: "spiridon_vangheli",
    patch: {
      works: [
        "Isprăvile lui Guguță",
        "Guguță — căpitan de corabie",
        "Steaua lui Ciuboțel",
      ],
      genres: ["детская литература", "поэзия", "перевод"],
    },
    evidence: sources(
      "MOLDPRES",
      "https://www.moldpres.md/rom/cultura/scriitorul-spiridon-vangheli-a-decedat-la-varsta-de-92-de-ani",
      "Biblioteca Națională a Republicii Moldova",
      "https://www.bnrm.md/?p=1110"
    ),
    note: "Обобщённая позиция о Гугуцэ заменена тремя оригинальными названиями и подтверждёнными жанрами.",
  },
  {
    countryId: "monaco",
    writerId: "louis_notari",
    patch: {
      birthDate: "1879-10-02",
      works: ["A legenda de Santa Devota", "Hymne Monégasque"],
      genres: ["поэзия", "песенная лирика"],
    },
    evidence: sources(
      "Княжеский дворец Монако",
      "https://palais.mc/en/the-institution/national-anthem-1-22.html",
      "Comité National des Traditions Monégasques",
      "https://www.traditions-monaco.com/sonotheque/hommage-a-louis-notari-1879-1961"
    ),
    note: "Исправлен день рождения; произведения уточнены по официальной истории гимна и национальному комитету традиций.",
  },
  {
    countryId: "mongolia",
    writerId: "byambyn_rinchen",
    patch: {
      works: ["Үүрийн туяа", "Заан Залуудай", "Их нүүдэл"],
      genres: ["роман", "перевод", "лингвистика", "этнография"],
    },
    evidence: sources(
      "Национальный музей естественной истории Монголии",
      "https://www.nmns.gov.mn/client/en/article/364",
      "MONTSAME",
      "https://montsame.mn/en/read/121730"
    ),
    note: "Служебное название заменено оригинальной библиографией; научные и переводческие роли отражены в жанрах.",
  },
  {
    countryId: "mongolia",
    writerId: "danzanravjaa",
    patch: {
      works: ["Саран хөхөө"],
      genres: ["поэзия", "драма", "музыка"],
    },
    evidence: sources(
      "MONTSAME",
      "https://montsame.mn/en/read/326794",
      "UNESCO World Heritage Centre",
      "https://whc.unesco.org/fr/listesindicatives/6068/"
    ),
    note: "Исправлено название музыкальной драмы; жанры дополнены композиторской деятельностью.",
  },
  {
    countryId: "mongolia",
    writerId: "dashdorj_natsagdorj",
    patch: {
      works: ["Миний нутаг", "Учиртай гурван толгой"],
      genres: ["поэзия", "проза", "драма"],
    },
    evidence: sources(
      "MONTSAME",
      "https://www.montsame.mn/en/read/388525",
      "UNESCO — History of Civilizations of Central Asia, vol. VI",
      "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_1585c732-773d-462a-8c7d-c8cf36ebdca7?_=141275eng.pdf&from=1&to=993"
    ),
    note: "Русская заглушка заменена двумя оригинальными названиями; драматургия добавлена по источникам.",
  },
  {
    countryId: "mongolia",
    writerId: "inzhannashi",
    patch: {
      name: "Ванчинбалын Инжаннаши",
      birthDate: "1837",
      deathDate: "1892",
      works: ["Хөх судар", "Нэгэн давхар асар", "Улаанаа уйлах танхим"],
      genres: ["роман", "поэзия", "история"],
    },
    evidence: sources(
      "Монгольский государственный университет",
      "https://portal.num.edu.mn/Staff/7a05581e-891c-48d8-9e18-264ed0f5878f/Publications",
      "UNESCO — History of Civilizations of Central Asia, vol. VI",
      "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_1585c732-773d-462a-8c7d-c8cf36ebdca7?_=141275eng.pdf&from=1&to=993"
    ),
    note: "Имя дополнено, технические даты 1 января сведены к годам, библиография расширена тремя оригинальными названиями.",
  },
  {
    countryId: "mongolia",
    writerId: "lodoidamba",
    patch: {
      works: ["Тунгалаг Тамир", "Манай сургуулийнхан", "Алтайд"],
      genres: ["роман", "повесть", "драма", "литературоведение"],
    },
    evidence: sources(
      "Библиотека Монгольского государственного университета",
      "https://catalog.num.edu.mn/cgi-bin/koha/opac-detail.pl?biblionumber=142314",
      "University of Szeged",
      "https://doktori.bibl.u-szeged.hu/11942/1/CANN%20dissertation.pdf"
    ),
    note: "Русское переводное название заменено оригиналом и двумя дополнительными произведениями; жанры уточнены.",
  },
  {
    countryId: "mongolia",
    writerId: "mend_ooyo",
    patch: {
      birthDate: "1952",
      works: ["Алтан Овоо", "Гэгээнтэн", "Шилийн Богд"],
      genres: ["поэзия", "проза", "каллиграфия"],
      awards: ["Орден Чингисхана, 2015"],
    },
    evidence: sources(
      "Официальный сайт Г. Мэнд-Ооёо",
      "https://www.mend-ooyo.mn/biography",
      "MONTSAME",
      "https://montsame.mn/en/read/355035"
    ),
    note: "Техническая дата 1 января сведена к году; добавлены три книги, каллиграфия и государственная награда.",
  },
  {
    countryId: "mongolia",
    writerId: "sonomyn_udval",
    patch: {
      years: "",
      deathDate: "",
      works: ["Их хувь заяа", "Одгэрэл", "Анхны арван гурав"],
      genres: ["проза", "поэзия", "драма", "сценарий"],
    },
    evidence: sources(
      "Министерство культуры Монголии",
      "https://mocsty.gov.mn/en/news/W4yP1HYmxCIrgoqAkzHvWp2dLnVCgsgB",
      "UNESCO — History of Civilizations of Central Asia, vol. VI",
      "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_1585c732-773d-462a-8c7d-c8cf36ebdca7?_=141275eng.pdf&from=1&to=993"
    ),
    note: "Конфликтующие сведения о смерти удалены; служебное название заменено тремя произведениями и многожанровой практикой.",
  },
  {
    countryId: "mongolia",
    writerId: "tsendiin_damdinsuren",
    patch: {
      deathDate: "1986",
      works: ["Гологдсон хүүхэн", "Буурал ээж минь"],
      genres: ["проза", "поэзия", "перевод", "филология", "история литературы"],
    },
    evidence: sources(
      "UNESCO — History of Civilizations of Central Asia, vol. VI",
      "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_1585c732-773d-462a-8c7d-c8cf36ebdca7?_=141275eng.pdf&from=1&to=993",
      "Монгольский государственный университет",
      "https://journal.num.edu.mn/ms/article/view/6328"
    ),
    note: "Спорный точный день смерти сведён к году; общие позиции заменены двумя произведениями и подтверждёнными ролями.",
  },
  {
    countryId: "mongolia",
    writerId: "uriankhai",
    patch: {
      birthDate: "1940",
      works: ["Хүн танаа", "Таны шинэ танил", "Өвлийн шувуу"],
      genres: ["поэзия", "проза", "эссе", "драма"],
      awards: ["Азиатская литературная премия, 2017"],
    },
    evidence: sources(
      "MONTSAME",
      "https://www.montsame.mn/en/read/132284",
      "Монгольский государственный университет",
      "https://journal.num.edu.mn/ms/article/view/5866"
    ),
    note: "Техническая дата 1 января сведена к году; добавлены три книги, четыре жанра и подтверждённая премия.",
  },
  {
    countryId: "montenegro",
    writerId: "marko_miljanov",
    patch: {
      name: "Марко Милянов Попович",
      works: [
        "Primjeri čojstva i junaštva",
        "Pleme Kuči u narodnoj priči i pjesmi",
        "Život i običaji Arbanasa",
      ],
      genres: ["проза", "мемуары", "этнография"],
    },
    evidence: sources(
      "University of Montenegro",
      "https://rijec.ucg.ac.me/casopisi/rijec_14.pdf",
      "Национальная библиотека Черногории",
      "https://www.nb-cg.me/en/events/105-book-exhibition-montenegrin-literature-in-foreign-languages"
    ),
    note: "Имя дополнено, переводное название заменено тремя оригинальными произведениями, жанры уточнены.",
  },
  {
    countryId: "montenegro",
    writerId: "miodrag_bulatovic",
    patch: {
      birthPlace: "Оклади близ Биело-Поле, Черногория",
      works: [
        "Crveni petao leti prema nebu",
        "Heroj na magarcu",
        "Ljudi sa četiri prsta",
      ],
      genres: ["роман", "рассказ", "публицистика"],
      awards: ["Премия журнала NIN, 1975"],
    },
    evidence: sources(
      "University of Montenegro",
      "https://ucg.ac.me/objava/blog/6291/objava/71076-nova-objava-09-04-2020-17-29-o-m-bulatovicu",
      "Hrvatska enciklopedija",
      "https://www.enciklopedija.hr/clanak/bulatovic-miodrag"
    ),
    note: "Исправлено место рождения; библиография, жанры и премия приведены к университетскому и энциклопедическому источникам.",
  },
  {
    countryId: "montenegro",
    writerId: "nikola_i_petrovic",
    patch: {
      works: ["Balkanska carica"],
      genres: ["стихотворная драма", "поэзия"],
    },
    evidence: sources(
      "Национальный музей Черногории",
      "https://narodnimuzej.me/wp-content/uploads/2021/02/Plan-rada-Narodnog-muzeja-za-2021.-godinu-fin-sajt-converted.pdf",
      "Национальная библиотека Черногории",
      "https://www.nb-cg.me/me/dogadjaji/858-bibliografija-knjizevni-opus-nikole-i-petrovica-njegosa-predstavljena-u-nbcg"
    ),
    note: "Название драмы приведено к оригиналу, её стихотворная форма отражена в жанрах.",
  },
  {
    countryId: "montenegro",
    writerId: "ognjen_spahic",
    patch: {
      birthDate: "1977",
      works: ["Hansenova djeca", "Puna glava radosti"],
      genres: ["роман", "рассказ", "журналистика"],
      awards: [
        "Премия имени Меши Селимовича, 2005",
        "Литературная премия Европейского союза, 2014",
      ],
    },
    evidence: sources(
      "European Union Prize for Literature",
      "https://euprizeliterature.eu/en/prize-author/ognjen-spahic/",
      "University of Iowa International Writing Program",
      "https://iwp.uiowa.edu/writers/2007-resident/ognjen-spahic"
    ),
    note: "Неподтверждённая точная дата и ложное «Детство» заменены годом, двумя книгами и соответствующими премиями.",
  },
  {
    countryId: "montenegro",
    writerId: "petar_ii_petrovic_njegos",
    patch: {
      works: ["Gorski vijenac"],
      genres: ["поэзия", "стихотворная драма", "философская проза"],
    },
    evidence: sources(
      "Национальный музей Черногории",
      "https://narodnimuzej.me/2020/10/23/gorski-vijenac/",
      "Правительство Черногории",
      "https://www.gov.me/clanak/169782--kulturna-istorija-27-februar-170-godina-stampanja-prvog-izdanja-gorskog-vijenca-petra-ii-petrovica-njegosa"
    ),
    note: "Название поэмы-драмы приведено к оригиналу, жанровый профиль уточнён по национальным источникам.",
  },
  {
    countryId: "montenegro",
    writerId: "stefan_ljubisa",
    patch: {
      works: [
        "Kanjoš Macedonović",
        "Prodaja patrijare Brkića",
        "Pripovijesti crnogorske i primorske",
      ],
      genres: ["повествовательная проза", "рассказ"],
    },
    evidence: sources(
      "Национальная библиотека Черногории",
      "https://www.nb-cg.me/en/events/570-140-years-since-the-death-of-stefan-mitrov-ljubisa-at-nlm",
      "WorldCat",
      "https://search.worldcat.org/search?q=au%3A%22Ljubi%C5%A1a%2C+Stefan+Mitrov%22"
    ),
    note: "Неустановленный «Канцлер» удалён; профиль содержит три каталогизированных произведения и подтверждённые жанры.",
  },
  {
    countryId: "morocco",
    writerId: "abdellatif_laabi",
    patch: {
      birthPlace: "Фес, Марокко",
      works: [],
      genres: ["поэзия", "роман", "драма", "эссе", "перевод"],
      awards: ["Большая премия Французской академии за вклад во франкофонию, 2011"],
    },
    evidence: sources(
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb11910338k",
      "Académie française",
      "https://www.academie-francaise.fr/abdellatif-laabi"
    ),
    note: "Исправлено место рождения; неподтверждённая книжная позиция удалена, творческие роли и официальная премия приведены к источникам.",
  },
  {
    countryId: "morocco",
    writerId: "ahmed_sefrioui",
    patch: {
      birthDate: "1915",
      works: ["Le Chapelet d’ambre", "La Boîte à merveilles"],
      genres: ["рассказ", "автобиографический роман", "журналистика"],
    },
    evidence: sources(
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb119242928",
      "Encyclopædia Universalis",
      "https://www.universalis.fr/encyclopedie/ahmed-sefrioui/"
    ),
    note: "Техническая дата 1 января сведена к году; ошибочное название заменено двумя оригиналами, жанры уточнены.",
  },
  {
    countryId: "morocco",
    writerId: "driss_chraibi",
    patch: {
      works: ["Le Passé simple", "La Civilisation, ma Mère!", "La Mère du printemps"],
      genres: ["роман", "радиопублицистика"],
    },
    evidence: sources(
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb118968037",
      "Encyclopædia Universalis",
      "https://www.universalis.fr/encyclopedie/driss-chraibi/"
    ),
    note: "Неточный перевод названия заменён тремя оригинальными романами; работа радиопродюсера отражена в жанрах.",
  },
  {
    countryId: "morocco",
    writerId: "fatima_mernissi",
    patch: {
      birthDate: "1940",
      deathDate: "2015",
      genres: ["социология", "эссе", "исследования"],
      awards: [
        "Литературная премия принца Астурийского, 2003",
        "Премия Эразма, 2004",
      ],
    },
    evidence: sources(
      "Fundación Princesa de Asturias",
      "https://www.fpa.es/es/premios-princesa-de-asturias/premiados/2003-fatema-mernissi-y-susan-sontag/?texto=trayectoria",
      "Praemium Erasmianum Foundation",
      "https://erasmusprijs.org/en/laureates/fatema-mernissi/"
    ),
    note: "Неподтверждённые точные дни сведены к годам; исследовательский профиль и две официальные премии добавлены.",
  },
  {
    countryId: "morocco",
    writerId: "leila_abouzeid",
    patch: {
      name: "Лейла Абу Зейд",
      birthDate: "1950",
      works: ["عام الفيل", "الفصل الأخير"],
      genres: ["роман", "автобиография", "журналистика"],
    },
    evidence: sources(
      "American University in Cairo Press",
      "https://aucpress.com/9781617971853/",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=14495586&typeNotice=p"
    ),
    note: "Имя нормализовано, техническая дата сведена к году, ложное название заменено двумя арабскими оригиналами.",
  },
  {
    countryId: "morocco",
    writerId: "mohamed_choukri",
    patch: {
      name: "Мохамед Шукри",
      works: ["الخبز الحافي", "زمن الأخطاء"],
      genres: ["роман", "автобиографическая проза"],
      awards: ["Премия франко-арабской дружбы, 1995"],
    },
    evidence: sources(
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb118967854",
      "E-taqafa",
      "https://www.e-taqafa.ma/dossier/mohamed-choukri"
    ),
    note: "Имя и арабские названия нормализованы; добавлена документированная премия 1995 года.",
  },
  {
    countryId: "morocco",
    writerId: "tahar_ben_jelloun",
    patch: {
      years: "",
      birthDate: "",
      works: ["La Nuit sacrée"],
      genres: ["роман", "поэзия", "эссе", "живопись"],
      awards: ["Гонкуровская премия, 1987"],
    },
    evidence: sources(
      "Académie Goncourt",
      "https://www.academiegoncourt.com/tahar-beh-jelloun",
      "Bibliothèque nationale de France",
      "https://catalogue.bnf.fr/ark%3A/12148/cb118911393"
    ),
    note: "Конфликтующие даты рождения удалены; роман, творческие роли и премия приведены к двум авторитетным записям.",
  },
  {
    countryId: "mozambique",
    writerId: "eduardo_white",
    patch: {
      works: ["O País de Mim", "Janela para o Índico"],
      genres: ["поэзия", "проза"],
      awards: ["Литературная премия имени Жозе Кравейриньи, 2004"],
    },
    evidence: sources(
      "Alcance Editores",
      "https://alcanceeditores.co.mz/eduardo-white/",
      "Universidade de São Paulo",
      "https://revistas.usp.br/africa/article/download/115368/113021/210607"
    ),
    note: "Библиография дополнена вторым произведением, прозаической ролью и проверенной премией.",
  },
  {
    countryId: "mozambique",
    writerId: "jose_craveirinha",
    patch: {
      genres: ["поэзия", "журналистика", "рассказ"],
      awards: ["Премия Камоэнса, 1991"],
    },
    evidence: sources(
      "Instituto Camões",
      "https://cvc.instituto-camoes.pt/poemasemana/35/sentimentos1.html",
      "Biblioteca Nacional do Brasil",
      "https://www.gov.br/bn/pt-br/atuacao/cooperacao-e-difusao/premio-camoes-de-literatura"
    ),
    note: "Журналистика и рассказ добавлены к жанрам; формат названия премии нормализован по официальным источникам.",
  },
  {
    countryId: "mozambique",
    writerId: "lilia_momple",
    patch: {
      works: ["Ninguém Matou Suhura", "Neighbours", "Os Olhos da Cobra Verde"],
      genres: ["проза", "роман", "рассказ"],
    },
    evidence: sources(
      "University of Iowa International Writing Program",
      "https://iwp.uiowa.edu/writers/1997/lilia-maria-clara-carriere-momple",
      "Catalogus Moçambique",
      "https://www.catalogus.co.mz/autor/lilia-momple"
    ),
    note: "Библиография дополнена третьей книгой, жанры нормализованы по университетскому и мозамбикскому профилям.",
  },
  {
    countryId: "mozambique",
    writerId: "mia_couto",
    patch: {
      fullName: "António Emílio Leite Couto",
      genres: ["поэзия", "рассказ", "роман"],
      awards: [
        "Премия Камоэнса, 2013",
        "Нейштадтская международная литературная премия, 2014",
      ],
    },
    evidence: sources(
      "Официальный сайт Миа Коуту",
      "https://www.miacouto.org/biografia-bibliografia-e-premiacoes/",
      "Neustadt International Prize for Literature",
      "https://www.neustadtprize.org/2014-mia-couto/"
    ),
    note: "Полное имя, жанры и две премии нормализованы по официальной биографии и профилю Нейштадтской премии.",
  },
  {
    countryId: "mozambique",
    writerId: "orlando_mendes",
    patch: {
      works: ["Portagem"],
      genres: ["поэзия", "роман", "драма", "критика", "неореализм"],
    },
    evidence: sources(
      "Infopédia / Porto Editora",
      "https://www.infopedia.pt/artigos/%24orlando-mendes?uri=lingua-portuguesa%2Fcontador",
      "Revista Tempo",
      "https://revista.tempo.co.mz/orlando-mendes/"
    ),
    note: "Жанровый профиль расширен документированными ролями и неореалистическим направлением.",
  },
  {
    countryId: "mozambique",
    writerId: "paulina_chiziane",
    patch: {
      name: "Паулина Шизиане",
      genres: ["роман", "рассказ"],
      awards: ["Премия Камоэнса, 2021"],
    },
    evidence: sources(
      "Министерство культуры Португалии",
      "https://culturaportugal.gov.pt/pt/saber/2023/04/cerimonia-de-entrega-do-premio-camoes-a-paulina-chiziane/",
      "Universidade de São Paulo",
      "https://www.fflch.usp.br/57051"
    ),
    note: "Русская форма имени, жанры и формат премии нормализованы по официальному и университетскому источникам.",
  },
  {
    countryId: "mozambique",
    writerId: "virgilio_de_lemos",
    patch: {
      birthDate: "1929-11-29",
      deathDate: "2013-12-06",
      genres: ["авангардная поэзия", "журналистика"],
    },
    evidence: sources(
      "Universidade Eduardo Mondlane — диссертация PUC Minas",
      "https://catedraportugues.uem.mz/storage/app/media/2023/abril/luciana-leal-virgilio-de-lemos-poesia-em-transito-1compressed.pdf",
      "Verdade",
      "https://verdade.co.mz/faleceu-virgilio-de-lemos-o-poeta-das-ilhas/"
    ),
    note: "Ошибочные дни рождения и смерти исправлены; авангардная поэзия и журналистика отражены в жанрах.",
  },
  {
    countryId: "myanmar",
    writerId: "dagon_taryar",
    patch: {
      name: "Дагон Тая",
      fullName: "Dagon Taya (Htay Myaing)",
      works: [],
      genres: ["поэзия", "роман", "редакторская работа"],
      awards: ["Премия Manhae, 2013"],
    },
    evidence: sources(
      "The Irrawaddy",
      "https://www.irrawaddy.com/from-the-archive/living-history-dagon-taya-modern-myanmar-literature.html",
      "Ministries of the President's Office, Myanmar",
      "https://presoffministry.gov.mm/en/news/8074"
    ),
    note: "Псевдоним и настоящее имя нормализованы; служебное название удалено, жанры и премия приведены к источникам.",
  },
] satisfies readonly WriterPublicProfileFactCorrectionBatch40[];
