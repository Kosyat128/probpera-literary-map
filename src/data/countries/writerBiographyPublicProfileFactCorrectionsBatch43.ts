import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch43 = {
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

export const writerBiographyPublicProfileFactCorrectionsBatch43 = [
  {
    countryId: "norway",
    writerId: "jonas_lie",
    patch: {
      fullName: "Jonas Lauritz Idemil Lie",
      works: ["Familjen paa Gilje", "Den Fremsynte", "Trold"],
      genres: ["роман", "рассказ", "драматургия", "поэзия"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Jonas_Lie"],
      ["Gyldendal", "https://www.gyldendal.no/forfattere/jonas-lie"]
    ),
    note: "Полное имя раскрыто; единственный переводной заголовок заменён тремя оригинальными названиями, жанры уточнены.",
  },
  {
    countryId: "norway",
    writerId: "jostein_gaarder",
    patch: {
      works: ["Sofies verden", "Kabalmysteriet", "I et speil, i en gåte"],
      genres: ["роман", "детская и юношеская литература", "философская проза"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Jostein_Gaarder"],
      ["Aschehoug", "https://aschehoug.no/Jostein_Gaarder/"]
    ),
    note: "Произведения приведены к оригинальным названиям; возрастная аудитория и литературные формы уточнены.",
  },
  {
    countryId: "norway",
    writerId: "karl_ove_knausgard",
    patch: {
      works: ["Min kamp", "Ute av verden", "Morgenstjernen"],
      genres: ["роман", "автобиографическая проза", "эссе"],
      awards: ["Норвежская премия критиков за Ute av verden, 1998"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Karl_Ove_Knausg%C3%A5rd"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/153167/karl-ove-knausgaard/"]
    ),
    note: "Автобиографический цикл приведён к оригиналу, добавлены два романа, жанры и документированная дебютная премия.",
  },
  {
    countryId: "norway",
    writerId: "knut_hamsun",
    patch: {
      fullName: "Knud Pedersen (Knut Hamsun)",
      birthPlace: "Вого, Норвегия",
      works: ["Sult", "Pan", "Markens Grøde"],
      genres: ["роман", "повесть", "рассказ", "драматургия", "поэзия"],
      awards: ["Нобелевская премия по литературе, 1920"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1920/hamsun/biographical/"],
      ["Store norske leksikon", "https://snl.no/Knut_Hamsun"]
    ),
    note: "Имя при рождении и место рождения исправлены; произведения приведены к оригиналам, жанры и официальная премия уточнены.",
  },
  {
    countryId: "norway",
    writerId: "olav_duun",
    patch: {
      fullName: "Ole Julius Duun",
      works: ["Juvikfolke", "Medmenneske", "Menneske og maktene"],
      genres: ["роман", "повесть", "рассказ"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Olav_Duun"],
      ["Nasjonalbiblioteket", "https://www.nb.no/sbfil/tekst/20230119_bokselskap.pdf"]
    ),
    note: "Полное имя раскрыто; обобщённый перевод цикла заменён тремя оригинальными произведениями, жанры уточнены.",
  },
  {
    countryId: "norway",
    writerId: "sigrid_undset",
    patch: {
      works: ["Kristin Lavransdatter", "Jenny", "Olav Audunssøn"],
      genres: ["роман", "рассказ", "эссе", "историческая проза"],
      awards: ["Нобелевская премия по литературе, 1928"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1928/undset/biographical/"],
      ["Store norske leksikon", "https://snl.no/Sigrid_Undset"]
    ),
    note: "Единственный переводной заголовок заменён тремя оригинальными произведениями; жанры и официальная премия уточнены.",
  },
  {
    countryId: "norway",
    writerId: "tarjei_vesaas",
    patch: {
      works: ["Fuglane", "Is-slottet", "Kimen"],
      genres: ["роман", "рассказ", "поэзия", "драматургия"],
      awards: ["Литературная премия Северного совета за Is-slottet, 1964"],
    },
    evidence: sources(
      ["Store norske leksikon", "https://snl.no/Tarjei_Vesaas"],
      ["Gyldendal", "https://www.gyldendal.no/forfattere/tarjei-vesaas"]
    ),
    note: "Произведения приведены к оригинальным названиям; жанры и премия Северного совета добавлены.",
  },
  {
    countryId: "oman",
    writerId: "abdullah_bin_mohammed_al_taie",
    patch: {
      works: ["ملائكة الجبل الأخضر", "الشراع الكبير", "الفجر الزاحف"],
      genres: ["поэзия", "роман", "эссе", "журналистика"],
    },
    evidence: sources(
      ["Nizwa", "https://www.nizwa.om/%D8%A7%D9%84%D8%B7%D8%A7%D8%A6%D9%8A-%D8%B1%D8%A7%D8%A6%D8%AF%D8%A7%D9%8B-%D9%84%D9%84%D8%B5%D8%AD%D8%A7%D9%81%D8%A9-%D9%88%D8%A7%D9%84%D8%A5%D8%B9%D9%84%D8%A7%D9%85-1924-1973-%D9%8A%D8%B9%D9%83/"],
      ["ArabLit Quarterly", "https://arablit.org/2023/09/13/i-cannot-ignore-the-pain-in-peoples-faces-badriyah-al-badri-on-writing-about-expatriate-workers-in-oman/"]
    ),
    note: "Родовое описание заменено тремя атрибутированными произведениями; жанры дополнены журналистикой и эссеистикой.",
  },
  {
    countryId: "oman",
    writerId: "abdullah_habib",
    patch: {
      genres: ["поэзия", "проза", "кинокритика", "кинорежиссура"],
    },
    evidence: sources(
      ["PEN America", "https://pen.org/writer-at-risk/abdullah-habib/"],
      ["Saudi Film Festival", "https://www.saudifilmfestival.org/_files/ugd/8819ed_f88625280f9b436b95d997937848a602.pdf"]
    ),
    note: "Неподтверждённые культурные исследования заменены документированными литературными и кинематографическими ролями; спорный год рождения не изменялся.",
  },
  {
    countryId: "oman",
    writerId: "abu_muslim_al_bahlani",
    patch: {
      fullName: "ناصر بن سالم بن عديم البهلاني (أبو مسلم البهلاني)",
      birthPlace: "Вади-Мухаррам, Самаиль, Оман",
      works: ["النفس الرحماني في أذكار أبي مسلم البهلاني"],
      genres: ["поэзия", "религиозная проза", "журналистика"],
    },
    evidence: sources(
      ["UNESCO", "https://unesdoc.unesco.org/in/rest/annotationSVC/DownloadWatermarkedAttachment/attach_import_d648d331-7fa2-4ed1-b71e-2cba921c83c5?_=367821eng.pdf"],
      ["Al Saidia Library", "https://alsaidia.com/node/170"]
    ),
    note: "Полное имя и место рождения уточнены; родовое название заменено атрибутированной книгой, жанры дополнены.",
  },
  {
    countryId: "oman",
    writerId: "jokha_alharthi",
    patch: {
      works: ["سيدات القمر", "نارنجة", "حرير الغزالة"],
      genres: ["роман", "рассказ", "академическая проза"],
      awards: ["International Booker Prize за Celestial Bodies, 2019"],
    },
    evidence: sources(
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/celestial-bodies"],
      ["Ministry of Foreign Affairs of Oman", "https://www.fm.gov.om/en/exhibitions/omanis-everywhere/dr-jokha-alharthi/"]
    ),
    note: "Произведения приведены к арабским оригиналам; жанры и премированная книга уточнены.",
  },
  {
    countryId: "oman",
    writerId: "saif_al_rahbi",
    patch: {
      birthPlace: "Сурур, Самаиль, Оман",
      works: ["أجراس القطيعة", "رأس المسافر", "شجرة الفرصاد"],
      genres: ["поэзия", "проза", "эссе"],
    },
    evidence: sources(
      ["Saif al-Rahbi", "https://saifalrahbi.com/"],
      ["Banipal", "https://www.banipal.co.uk/contributors/63/saif_al-rahbi/"]
    ),
    note: "Место рождения уточнено; родовое описание сборников заменено тремя арабскими названиями, жанры дополнены.",
  },
  {
    countryId: "pakistan",
    writerId: "bano_qudsia",
    patch: {
      works: ["Raja Gidh", "Aatish Zair-i-Paa", "Aadhi Baat"],
      genres: ["роман", "рассказ", "драматургия"],
      awards: ["Sitara-e-Imtiaz, 1983", "Hilal-e-Imtiaz, 2010", "Kamal-e-Fun, 2010"],
    },
    evidence: sources(
      ["Radio Pakistan", "https://www.radio.gov.pk/28-11-2022/birth-anniversary-of-bano-qudsia-observed"],
      ["Senate of Pakistan", "https://senate.gov.pk/uploads/documents/resolutions/1487830752_705.pdf"]
    ),
    note: "Библиография дополнена романом и пьесой; литературные формы и три государственные либо литературные награды уточнены.",
  },
  {
    countryId: "pakistan",
    writerId: "faiz_ahmad_faiz",
    patch: {
      birthPlace: "Кала-Кадер, Нароваль, Британская Индия",
      works: ["Naqsh-e-Faryadi", "Dast-e-Saba", "Zindan-Nama"],
      genres: ["поэзия", "журналистика", "эссе"],
      awards: ["Ленинская премия мира", "Nishan-e-Imtiaz, 1990"],
    },
    evidence: sources(
      ["Academy of American Poets", "https://poets.org/poet/faiz-ahmed-faiz"],
      ["Radio Pakistan", "https://www.radio.gov.pk/20-11-2017/remembering-poet-faiz-ahmad-faiz-on-his-33rd-death-anniversary"]
    ),
    note: "Ошибочное место рождения заменено на Кала-Кадер; добавлены сборник, журналистика и посмертная государственная награда без спорной датировки премии мира.",
  },
  {
    countryId: "pakistan",
    writerId: "intizar_husain",
    patch: {
      works: ["Basti", "Aage Samandar Hai", "The Seventh Door"],
      genres: ["роман", "рассказ", "поэзия", "литературная критика"],
      awards: ["Man Booker International Prize, шорт-лист 2013", "Sitara-e-Imtiaz, 2007"],
    },
    evidence: sources(
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/intizar-hussain"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/156966/intizar-husain/"]
    ),
    note: "Библиография и жанровые роли дополнены; шорт-лист международного Букера и государственная награда сформулированы точно.",
  },
  {
    countryId: "pakistan",
    writerId: "kamila_shamsie",
    patch: {
      works: ["In the City by the Sea", "Burnt Shadows", "Home Fire"],
      genres: ["роман", "рассказ", "эссе"],
      awards: ["Women’s Prize for Fiction за Home Fire, 2018"],
    },
    evidence: sources(
      ["Bloomsbury", "https://www.bloomsbury.com/us/author/kamila-shamsie/"],
      ["Women’s Prize for Fiction", "https://www.womensprize.com/where-i-write-kamila-shamsie/"]
    ),
    note: "Библиография дополнена дебютным романом; жанры и премированная книга с годом уточнены.",
  },
  {
    countryId: "pakistan",
    writerId: "mohsin_hamid",
    patch: {
      works: ["Moth Smoke", "The Reluctant Fundamentalist", "Exit West"],
      genres: ["роман", "эссе"],
      awards: ["The Reluctant Fundamentalist - шорт-лист Букеровской премии, 2007", "Exit West - шорт-лист Букеровской премии, 2017"],
    },
    evidence: sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/73741/mohsin-hamid/"],
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/books/exit-west"]
    ),
    note: "Библиография дополнена дебютным романом; эссеистика и два документированных результата Букеровской премии добавлены.",
  },
  {
    countryId: "pakistan",
    writerId: "muhammad_iqbal",
    patch: {
      fullName: "Sir Muhammad Iqbal",
      works: ["Asrar-i-Khudi", "Bang-i-Dara", "Javid Nama"],
      genres: ["поэзия", "философская проза", "эссе"],
    },
    evidence: sources(
      ["Iqbal Academy Pakistan", "https://allamaiqbal.com/biography/en/index.php"],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/mohammed-iqbal"]
    ),
    note: "Почётная форма полного имени раскрыта; названия приведены к каталожным формам, библиография и жанры дополнены.",
  },
  {
    countryId: "pakistan",
    writerId: "saadat_hasan_manto",
    patch: {
      works: ["Toba Tek Singh", "Thanda Gosht", "Khol Do"],
      genres: ["рассказ", "драматургия", "эссе", "радиопьеса"],
      awards: ["Nishan-e-Imtiaz, 2012"],
    },
    evidence: sources(
      ["Associated Press of Pakistan", "https://www.app.com.pk/national/saadat-hasan-manto-honoured-on-71st-death-anniversary-for-his-literary-legacy/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/115526/saadat-hasan-manto/"]
    ),
    note: "Библиография дополнена рассказом; литературные формы и посмертная государственная награда уточнены.",
  },
  {
    countryId: "palau",
    writerId: "emelihter_kihleng",
    patch: {
      fullName: "Emelihter S. Kihleng",
      years: "",
      birthDate: "",
      birthPlace: "Гуам",
      country: "Федеративные Штаты Микронезии",
      coordinates: { lat: 13.47861, lng: 144.81834 },
      works: ["My Urohs", "Indigenous Literatures from Micronesia"],
      genres: ["поэзия", "эссе", "редакторская работа"],
      language: "английский, понпейский",
      nationality: "понпейская",
      tags: ["XXI век", "литература Микронезии", "поэзия"],
    },
    evidence: sources(
      ["Academy of American Poets", "https://poets.org/poet/emelihter-kihleng"],
      ["The Metropolitan Museum of Art", "https://www.metmuseum.org/perspectives/to-swim-with-eels"],
      ["GeoNames", "https://www.geonames.org/4043988/guam.html"]
    ),
    note: "Ошибочные Палау, 1970 год и координаты Палау заменены Гуамом и понпейско-микронезийской идентичностью; оставлены только подтверждённые книга и роли.",
  },
  {
    countryId: "palestine",
    writerId: "edward_said",
    patch: {
      fullName: "Edward Wadie Said",
      deathDate: "2003-09-24",
      works: ["Orientalism", "Culture and Imperialism", "Out of Place"],
      genres: ["литературная критика", "эссе", "мемуары", "музыкальная критика"],
    },
    evidence: sources(
      ["Columbia University Press", "https://cup.columbia.edu/book/humanism-and-democratic-criticism/9780231122641/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/26689/edward-w-said/"]
    ),
    note: "Полное имя раскрыто, дата смерти исправлена с 25 на 24 сентября; библиография и критические жанры дополнены.",
  },
  {
    countryId: "palestine",
    writerId: "fadwa_tuqan",
    patch: {
      birthDate: "1917",
      works: ["Alone with the Days", "The Night and the Horsemen", "A Mountainous Journey"],
      genres: ["поэзия", "автобиография"],
      awards: ["Sultan Bin Ali Al Owais Cultural Award for Poetry, 1988-1989"],
    },
    evidence: sources(
      ["PalQuest", "https://www.palquest.org/en/biography/6580/fadwa-tuqan"],
      ["Embassy of the State of Palestine in Argentina", "https://palestina.int.ar/fadwa-tuqan-1917-2003-es-nuestro-persona-palestino-del-mes/"]
    ),
    note: "Неподтверждённый день рождения снят; добавлены три книги, автобиография и официальная премия поэзии.",
  },
  {
    countryId: "palestine",
    writerId: "ghassan_kanafani",
    patch: {
      fullName: "Ghassan Fayiz Kanafani",
      deathPlace: "Бейрут, Ливан",
      works: ["Men in the Sun", "All That’s Left to You", "Returning to Haifa"],
      genres: ["роман", "рассказ", "драматургия", "журналистика", "литературная критика"],
      awards: ["Friends of the Book Society Prize за All That’s Left to You, 1966"],
    },
    evidence: sources(
      ["PalQuest", "https://www.palquest.org/en/biography/6566/ghassan-kanafani"],
      ["Store norske leksikon", "https://snl.no/Ghassan_Kanafani"]
    ),
    note: "Полное имя раскрыто; библиография, жанры и документированная прижизненная премия дополнены.",
  },
  {
    countryId: "palestine",
    writerId: "ibrahim_nasrallah",
    patch: {
      birthDate: "1954",
      works: ["Time of White Horses", "Lanterns of the King of Galilee", "The Second War of the Dog"],
      genres: ["роман", "поэзия", "автобиография", "кинокритика"],
      nationality: "палестино-иорданская",
      awards: ["International Prize for Arabic Fiction за The Second War of the Dog, 2018", "Neustadt International Prize for Literature, 2026"],
    },
    evidence: sources(
      ["The American University in Cairo Press", "https://aucpress.com/author/ibrahim-nasrallah/"],
      ["King Abdulaziz Center for World Culture", "https://www.ithra.com/en/speakers/ibrahim-nasrallah"],
      ["Neustadt International Prize for Literature", "https://www.neustadtprize.org/2026-ibrahim-nasrallah/"]
    ),
    note: "Неподтверждённый день рождения снят; общая трилогия заменена тремя романами, жанрами и точной премией.",
  },
  {
    countryId: "palestine",
    writerId: "mahmoud_darwish",
    patch: {
      works: ["Why Did You Leave the Horse Alone?", "Mural", "Memory for Forgetfulness"],
      genres: ["поэзия", "проза", "эссе"],
      awards: ["Lannan Cultural Freedom Prize, 2001"],
    },
    evidence: sources(
      ["Academy of American Poets", "https://poets.org/poet/mahmoud-darwish"],
      ["University of California Press", "https://www.ucpress.edu/books/memory-for-forgetfulness/paper"]
    ),
    note: "Два переводных заголовка заменены тремя каталогизированными книгами; проза, эссеистика и две документированные награды добавлены.",
  },
  {
    countryId: "palestine",
    writerId: "sahar_khalifeh",
    patch: {
      works: ["Wild Thorns", "The Image, the Icon, and the Covenant", "Of Noble Origins"],
      genres: ["роман"],
      awards: ["Naguib Mahfouz Medal for Literature за The Image, the Icon, and the Covenant, 2006"],
    },
    evidence: sources(
      ["The American University in Cairo Press", "https://aucpress.com/author/sahar-khalifeh/"],
      ["Interlink Publishing", "https://interlinkbooks.com/brand/sahar-khalifeh/"]
    ),
    note: "Один переводной заголовок заменён тремя библиографически подтверждёнными романами.",
  },
  {
    countryId: "panama",
    writerId: "juan_david_morgan",
    patch: {
      fullName: "Juan David Morgan González",
      birthDate: "1942-04-06",
      birthPlace: "Давид, Чирики, Панама",
      coordinates: { lat: 8.42729, lng: -82.43085 },
      works: ["Fugitivos del paisaje", "El caballo de oro", "El silencio de Gaudí"],
      genres: ["роман", "исторический роман", "рассказ", "драматургия", "поэзия", "эссе"],
    },
    evidence: sources(
      ["Academia Panameña de la Lengua", "https://aplengua.org.pa/juan-david-morgan-gonzalez/"],
      ["Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/morgan_juan_d.html"],
      ["GeoNames", "https://www.geonames.org/advanced-search.html?country=PA&q=David"]
    ),
    note: "Дата, город рождения и координаты исправлены; полное имя, три реальные книги и жанровый диапазон добавлены.",
  },
  {
    countryId: "panama",
    writerId: "ricardo_miro",
    patch: {
      fullName: "Ricardo Miró Denis",
      works: ["Preludios", "Los segundos preludios", "La leyenda del Pacífico", "Caminos silenciosos"],
      genres: ["поэзия", "рассказ", "роман", "дипломатическая проза"],
    },
    evidence: sources(
      ["Academia Panameña de la Lengua", "https://aplengua.org.pa/ricardo-miro-denis/"],
      ["Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/recuento.html"]
    ),
    note: "Полное имя раскрыто; два общих переводных названия заменены четырьмя оригинальными книгами, жанры дополнены.",
  },
  {
    countryId: "panama",
    writerId: "rogelio_sinan",
    patch: {
      name: "Рохелио Синан",
      fullName: "Bernardo Domínguez Alba (Rogelio Sinán)",
      years: "1902-1994",
      birthDate: "1902-04-25",
      works: ["Onda", "Plenilunio", "La isla mágica"],
      genres: ["поэзия", "рассказ", "роман", "драматургия", "эссе"],
      awards: ["Premio Ricardo Miró за Plenilunio, 1943", "Premio Ricardo Miró за La isla mágica, 1977"],
    },
    evidence: sources(
      ["Universidad Tecnológica de Panamá", "https://cultura.utp.ac.pa/escritores/Sinan-Rogelio.html"],
      ["Academia Panameña de la Lengua", "https://aplengua.org.pa/bernardo-dominguez-alba/"]
    ),
    note: "Русское имя и год рождения исправлены; гражданское имя, три книги, жанры и две документированные премии добавлены.",
  },
  {
    countryId: "papua_new_guinea",
    writerId: "vincent_eri",
    patch: {
      fullName: "Sir Vincent Serei Eri",
      years: "1936-1993",
      birthDate: "1936-09-12",
      deathDate: "1993-05-25",
      birthPlace: "Мовеаве, провинция Галф, Папуа - Новая Гвинея",
      deathPlace: "Порт-Морсби, Папуа - Новая Гвинея",
      coordinates: { lat: -8.16667, lng: 146.16667 },
      works: ["The Crocodile"],
      genres: ["роман"],
      awards: ["Companion of the Order of St Michael and St George, 1981", "Knight Bachelor, 1990"],
    },
    evidence: sources(
      ["Australian Dictionary of Biography", "https://adb.anu.edu.au/biography/eri-sir-vincent-serei-29673"],
      ["PNG Literature", "https://png.athabascau.ca/KeyPeople.php"],
      ["GeoNames", "https://www.geonames.org/2090401"]
    ),
    note: "Полное имя, обе даты, места и координаты исправлены; литературный жанр и две государственные награды уточнены.",
  },
  {
    countryId: "paraguay",
    writerId: "augusto_roa_bastos",
    patch: {
      fullName: "Augusto José Antonio Roa Bastos",
      works: ["Hijo de hombre", "Yo el Supremo", "El fiscal"],
      genres: ["роман", "рассказ", "поэзия", "драматургия", "сценарий", "журналистика"],
      awards: ["Премия Сервантеса, 1989"],
    },
    evidence: sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/munich_augusto_roa_bastos.htm"],
      ["Fundación Augusto Roa Bastos", "https://fundacionroabastos.org/augusto-roa-bastos/"]
    ),
    note: "Полное имя раскрыто; произведения приведены к оригинальным названиям, жанры дополнены, дубль премии удалён.",
  },
  {
    countryId: "paraguay",
    writerId: "elvio_romero",
    patch: {
      birthDate: "1926-12-01",
      birthPlace: "Йегрос, Каасапа, Парагвай",
      coordinates: { lat: -26.45554, lng: -56.40377 },
      works: ["Días roturados", "El sol bajo las raíces", "Destierro y atardecer"],
      genres: ["поэзия", "журналистика", "эссе"],
      awards: ["Национальная литературная премия Парагвая, 1991"],
    },
    evidence: sources(
      ["Centro Cultural de la República El Cabildo", "https://cabildoccr.gov.py/publicacion/natalicio-de-elvio-romero-1797"],
      ["Ministerio de Relaciones Exteriores de Paraguay", "https://www2.mre.gov.py/index.php/noticias-de-embajadas-y-consulados/en-la-embajada-del-paraguay-en-la-republica-argentina-rendiran-homenaje-al-poeta-elvio-romero?ccm_paging_p=94"],
      ["GeoNames", "https://www.geonames.org/search.html?country=PY&q=Yegros"]
    ),
    note: "День и место рождения с координатами исправлены; три ложных названия заменены реальными сборниками, добавлена Национальная премия.",
  },
  {
    countryId: "paraguay",
    writerId: "gabriel_casaccia",
    patch: {
      fullName: "Benigno Gabriel Casaccia Bibolini",
      works: ["La babosa", "La llaga", "Los exiliados", "El Guajhú"],
      genres: ["роман", "рассказ", "драматургия", "журналистика"],
    },
    evidence: sources(
      ["Biblioteca y Archivo Central del Congreso Nacional", "https://catalogo.bacn.gov.py/opac_css/index.php?id=4175&lvl=author_see"],
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/el_rinconete/anteriores/abril_07/13042007_02.htm"]
    ),
    note: "Полное имя раскрыто; два неверных названия удалены, четыре документированные книги и жанры добавлены.",
  },
  {
    countryId: "paraguay",
    writerId: "juan_manuel_marcos",
    patch: {
      birthDate: "1950",
      works: ["El invierno de Gunter", "La poética de Hugo Rodríguez-Alcalá: técnica y estilo"],
      genres: ["роман", "поэзия", "эссе", "литературная критика"],
      awards: ["Libro del Año за El invierno de Gunter, 1987"],
    },
    evidence: sources(
      ["Universidad del Norte Paraguay", "https://uninorte.edu.py/despacho-del-director/"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/obras/autor/marcos-juan-manuel-5311"]
    ),
    note: "Ложная точность даты снята до подтверждённого года; общие заглушки и неподтверждённая национальная премия заменены двумя каталогизированными книгами и точной наградой.",
  },
  {
    countryId: "paraguay",
    writerId: "julio_correa",
    patch: {
      fullName: "Julio Arístides Correa Myzkowsky",
      birthDate: "1890",
      deathDate: "1953",
      works: ["Sandía yvyguy", "Karu poka", "Pleito rire"],
      genres: ["драматургия", "поэзия", "рассказ"],
      language: "гуарани, испанский",
    },
    evidence: sources(
      ["Biblioteca y Archivo Central del Congreso Nacional", "https://catalogo.bacn.gov.py/opac_css/index.php?id=3688&lvl=author_see"],
      ["Centro Cultural de la República El Cabildo", "https://cabildoccr.gov.py/publicacion/dramaturgo-don-julio-correa-1064"]
    ),
    note: "Конфликтующая точность дат снята до подтверждённых лет; заглушки заменены каталогизированными произведениями, языки и жанры уточнены.",
  },
  {
    countryId: "paraguay",
    writerId: "lisandro_diaz_leon",
    patch: {
      years: "1889-1928",
      birthDate: "1889",
      deathDate: "1928",
      birthPlace: "Сантисима-Тринидад, Асунсьон, Парагвай",
      deathPlace: "Париж, Франция",
      works: [],
      genres: ["политическая публицистика", "ораторское искусство"],
      category: "политик, дипломат и парламентский оратор",
      tags: ["XIX век", "XX век", "политическая публицистика"],
    },
    evidence: sources(
      ["Universidade Estadual de Maringá", "https://periodicos.uem.br/ojs/index.php/Dialogos/article/download/35556/pdf/"],
      ["Office of the Historian, U.S. Department of State", "https://history.state.gov/historicaldocuments/frus1928v01/d368fn62"]
    ),
    note: "Ложные даты, места, произведения и поэтическая роль заменены документированной личностью 1889-1928 годов; неподтверждённая книга снята.",
  },
  {
    countryId: "paraguay",
    writerId: "liza_haedo",
    patch: {
      name: "Лиз Мария Аэдо",
      fullName: "Liz María Haedo",
      years: "1986-",
      birthDate: "1986",
      deathDate: "",
      birthPlace: "Асунсьон, Парагвай",
      deathPlace: "",
      works: ["Pieles de papel", "Juruguasúlas"],
      genres: ["рассказ", "сценарий"],
      awards: ["PEN/Edward and Lily Tuck Award for Paraguayan Literature за Pieles de papel, 2020"],
      language: "испанский",
      nationality: "парагвайка",
      tags: ["XXI век", "современная литература"],
    },
    evidence: sources(
      ["PEN America", "https://pen.org/literary-awards/pen-edward-lily-tuck-award-paraguayan-literature/"],
      ["Prince Claus Fund", "https://princeclausfund.nl/awardees/liz-haedo"],
      ["Universidad Nacional del Este", "https://www.filosofiaune.edu.py/filemanager/files/revista-buho/Revista%20Digital%20el%20Bu%CC%81ho%20-%202024.pdf"]
    ),
    note: "Ошибочные имя, даты, места и поэтические заглушки заменены подтверждённой современной писательницей; ложная точность даты снята до года, добавлены две книги и премия.",
  },
] satisfies readonly WriterPublicProfileFactCorrectionBatch43[];
