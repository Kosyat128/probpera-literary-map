import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch44 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-21";

function sources(
  ...items: ReadonlyArray<readonly [provider: string, url: string]>
) {
  return items.map(([provider, url]) => ({ provider, url, checkedAt }));
}

export const writerBiographyPublicProfileFactCorrectionsBatch44 = [
  {
    countryId: "paraguay",
    writerId: "manuel_ortiz_guerrero",
    patch: {
      years: "",
      birthDate: "",
      works: ["Surgente", "El Crimen de Tintalila", "La Conquista"],
      genres: ["поэзия", "драматургия", "песенная лирика"],
    },
    evidence: sources(
      ["Municipalidad de Asunción", "https://www.asuncion.gov.py/historia-de-mis-calles/manuel-ortiz-guerrero-calle-que-la-ciudad-de-asuncion-ha-nominado-con-gran-afecto"],
      ["Secretaría Nacional de Cultura", "https://cultura.gov.py/2021/08/agostope-jaguerohory-nee-guarani/"]
    ),
    note: "Официальные источники расходятся между 1894 и 1897 годами, поэтому год и полная дата рождения очищены; родовые заглушки заменены тремя подтверждёнными произведениями, жанры дополнены песенной лирикой.",
  },
  {
    countryId: "paraguay",
    writerId: "mario_ruben_alvarez",
    patch: {
      fullName: "Mario Rubén Álvarez Benítez",
      birthDate: "1954-09-07",
      birthPlace: "Потреро-Ивате, Вейнтисинко-де-Дисьембре, Парагвай",
      works: ["La sangre insurrecta", "Ñe’ẽ apytere / A flor de ausencia", "Las voces de la memoria"],
      genres: ["поэзия", "эссе", "исследование культуры", "перевод"],
    },
    evidence: sources(
      ["Secretaría de Políticas Lingüísticas", "https://spl.gov.py/es/academia-de-la-lengua-guarani/"],
      ["Secretaría Nacional de Cultura", "https://cultura.gov.py/2014/05/amplio-abanico-de-la-poesia-popular-se-abrio-en-la-libroferia/"]
    ),
    note: "Фиктивная дата 1 января, общее место рождения и родовые заглушки заменены документированными сведениями и книгами.",
  },
  {
    countryId: "paraguay",
    writerId: "natalicio_gonzalez",
    patch: {
      fullName: "Juan Natalicio González Paredes",
      works: ["El Paraguay eterno", "Proceso y formación de la cultura paraguaya", "Baladas guaraníes"],
      genres: ["эссе", "история", "поэзия", "журналистика"],
    },
    evidence: sources(
      ["Municipalidad de Asunción", "https://www.asuncion.gov.py/historia-de-mis-calles/la-calle-natalicio-gonzalez-recuerda-a-quien-fue-presidente-del-paraguay-gran-escritor-y-politico"],
      ["Biblioteca y Archivo Central del Congreso Nacional", "https://catalogo.bacn.gov.py/opac_css/index.php?id=9614&lvl=notice_display"]
    ),
    note: "Полное имя раскрыто; переводные заглушки заменены тремя каталогизированными книгами, жанры уточнены.",
  },
  {
    countryId: "paraguay",
    writerId: "rafael_barrett",
    patch: {
      deathPlace: "Аркашон, Франция",
      works: ["El dolor paraguayo", "Moralidades actuales", "Lo que son los yerbales"],
      genres: ["эссе", "журналистика", "социальная проза"],
    },
    evidence: sources(
      ["Secretaría Nacional de Cultura", "https://cultura.gov.py/2018/02/premian-a-ganadores-del-iv-concurso-nacional-de-ensayos-rafael-barrett/"],
      ["Municipalidad de Asunción", "https://www.asuncion.gov.py/tesoros-de-mi-ciudad/el-edificio-de-la-industrial-paraguaya-en-el-centro-de-asuncion-recuerda-a-los-mensu-de-nuestra-historia-que-malgastaron-su-vida-en-los-yerbales"]
    ),
    note: "Опечатка в месте смерти исправлена; вольные переводы заменены тремя оригинальными названиями, публицистика уточнена как журналистика.",
  },
  {
    countryId: "paraguay",
    writerId: "rubén_bareiro_saguier",
    patch: {
      name: "Рубен Барейро Сагьер",
      birthDate: "1930-01-22",
      birthPlace: "Вильета, Парагвай",
      deathPlace: "Асунсьон, Парагвай",
      works: ["Ojo por diente", "El séptimo pétalo del viento", "La rosa azul"],
      genres: ["рассказ", "поэзия", "эссе", "литературная критика"],
      awards: ["Premio Casa de las Américas за Ojo por diente, 1971", "Национальная литературная премия Парагвая за La rosa azul, 2005"],
    },
    evidence: sources(
      ["Centro Cultural de la República El Cabildo", "https://cabildoccr.gov.py/biografia-maestro/ruben-bareiro-saguier"],
      ["Secretaría Nacional de Cultura", "https://cultura.gov.py/2017/03/recuerdan-3-anos-del-fallecimiento-del-escritor-ruben-bareiro-saguier/"]
    ),
    note: "Русское имя, дата и места исправлены; заглушки заменены тремя книгами и двумя документированными премиями.",
  },
  {
    countryId: "peru",
    writerId: "alfredo_bryce_echenique",
    patch: {
      years: "1939–2026",
      deathDate: "2026-03-10",
      works: ["Un mundo para Julius", "La vida exagerada de Martín Romaña", "El huerto de mi amada"],
      genres: ["роман", "рассказ", "мемуары"],
      awards: ["Национальная литературная премия Перу, 1972", "Premio Planeta за El huerto de mi amada, 2002", "Premio FIL de Literatura en Lenguas Romances, 2012"],
    },
    evidence: sources(
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/adios-alfredo-bryce-echenique-1939-2026/"],
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/benengeli/22/biografias.htm"]
    ),
    note: "Открытые годы обновлены после смерти автора; ошибочные названия и премия заменены книгами и тремя документированными наградами.",
  },
  {
    countryId: "peru",
    writerId: "cesar_vallejo",
    patch: {
      works: ["Los heraldos negros", "Trilce", "Poemas humanos", "España, aparta de mí este cáliz"],
      genres: ["поэзия", "проза", "драматургия", "авангард"],
    },
    evidence: sources(
      ["Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/bnp-rinde-homenaje-a-cesar-vallejo-al-cumplirse-131-anos-de-su-natalicio/"],
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/cesar-vallejo"]
    ),
    note: "Произведения приведены к оригинальным названиям; проза и драматургия добавлены к жанровому описанию.",
  },
  {
    countryId: "peru",
    writerId: "claudia_salazar_jimenez",
    patch: {
      birthDate: "1976",
      works: ["La sangre de la aurora", "Coordenadas temporales", "1814, año de la independencia"],
      genres: ["роман", "рассказ", "историческая проза"],
      awards: ["Premio Las Américas de Narrativa за La sangre de la aurora, 2014"],
    },
    evidence: sources(
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/novela-genero-memoria-dialogo-claudia-salazar/claudia-salazar/"],
      ["California State University, Long Beach", "https://www.csulb.edu/university-library/article/claudia-salazar-jimenez-to-speak-at-csulb"]
    ),
    note: "Неподтверждённый точный день снят; три ложных названия и неточная премия заменены реальными книгами и наградой.",
  },
  {
    countryId: "peru",
    writerId: "eduardo_gonzalez_viana",
    patch: {
      birthPlace: "Чепен, Перу",
      works: ["El corrido de Dante", "Siete noches en California", "Kutimuy, Garcilaso"],
      genres: ["роман", "рассказ", "журналистика"],
    },
    evidence: sources(
      ["Instituto Cervantes", "https://cultura.cervantes.es/palermo/es/espa%C3%B1a-y-el-per%C3%BA/149880"],
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/homenaje-al-escritor-eduardo-gonzalez-viana-sabado-2-marzo/"]
    ),
    note: "Ошибочное место рождения и три вымышленных перевода заменены Чепеном и документированной библиографией.",
  },
  {
    countryId: "peru",
    writerId: "fernando_iwasaki",
    patch: {
      fullName: "Fernando Iwasaki Cauti",
      birthDate: "1961",
      works: ["Ajuar funerario", "Neguijón", "Libro de mal amor"],
      genres: ["рассказ", "роман", "эссе", "история"],
      awards: ["Premio Rey de España de Periodismo, 2015"],
    },
    evidence: sources(
      ["Universidad Loyola Andalucía", "https://www.uloyola.es/en/scientific-offer/researchers/fernando-iwasaki-cauti"],
      ["Instituto Cervantes", "https://www.cervantes.es/FichasCultura/Ficha89015_00_1.htm"]
    ),
    note: "Полное имя раскрыто, неподтверждённый точный день снят; ложные заголовки заменены тремя книгами, жанры и премия уточнены.",
  },
  {
    countryId: "peru",
    writerId: "inca_garcilaso_de_la_vega",
    patch: {
      fullName: "Gómez Suárez de Figueroa (Inca Garcilaso de la Vega)",
      works: ["Comentarios reales de los incas", "Historia General del Perú", "La Florida del Inca"],
      genres: ["хроника", "история", "перевод"],
    },
    evidence: sources(
      ["Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/bnp-se-cumplen-485-anos-del-nacimiento-del-inca-garcilaso-de-la-vega/"],
      ["Casa de la Literatura Peruana", "https://intensidadyaltura.casadelaliteratura.gob.pe/inca-garcilaso/desencuentros/"]
    ),
    note: "Имя при рождении раскрыто; вольные переводы заменены тремя оригинальными названиями, переводческая деятельность добавлена.",
  },
  {
    countryId: "peru",
    writerId: "ivan_thays",
    patch: {
      birthDate: "1968",
      works: ["Las fotografías de Frances Farmer", "Un lugar llamado Oreja de Perro", "La disciplina de la vanidad"],
      genres: ["роман", "рассказ", "эссе", "литературная критика"],
      awards: ["Премия Принца Клауса, 2000"],
    },
    evidence: sources(
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/benengeli/26/biografias.htm"],
      ["Hay Festival", "https://www.hayfestival.com/artist.aspx?artistid=1829"]
    ),
    note: "Неподтверждённый точный день и ложная премия Эрральде сняты; заглушки заменены тремя книгами и точной премией.",
  },
  {
    countryId: "peru",
    writerId: "jose_maria_arguedas",
    patch: {
      works: ["Los ríos profundos", "Yawar Fiesta", "El Sexto", "El zorro de arriba y el zorro de abajo"],
      genres: ["роман", "рассказ", "поэзия", "этнология", "перевод"],
    },
    evidence: sources(
      ["Biblioteca Nacional del Perú", "https://memoriaperu.bnp.gob.pe/micrositio/jose-maria-arguedas"],
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/jose-maria-arguedas-puentes-vida-los-rios-profundos/"]
    ),
    note: "Ошибочное название «Шестьдесят» и переводные заголовки заменены четырьмя оригинальными названиями; жанры и перевод добавлены.",
  },
  {
    countryId: "peru",
    writerId: "jose_watanabe",
    patch: {
      years: "1945–2007",
      birthDate: "1945-03-17",
      birthPlace: "Ларедо, Ла-Либертад, Перу",
      works: ["Álbum de familia", "El huso de la palabra", "Historia natural"],
      genres: ["поэзия", "проза", "сценарий"],
      awards: ["Premio El Poeta Joven del Perú, 1970"],
    },
    evidence: sources(
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/poesia-facetas-jose-watanabe-10-anos-sin-vate/cosas_full/"],
      ["Biblioteca Nacional del Perú", "https://isbn.bnp.gob.pe/catalogo.php?mode=detalle&nt=101762"]
    ),
    note: "Год и место рождения исправлены; три ложных заголовка заменены книгами, жанры и документированная премия добавлены.",
  },
  {
    countryId: "peru",
    writerId: "juan_espinosa_medrano",
    patch: {
      years: "ок. 1632–1688",
      birthDate: "1632",
      deathDate: "1688",
      birthPlace: "провинция Аймараэс, Вице-королевство Перу",
      works: ["Apologético en favor de don Luis de Góngora", "La novena maravilla", "El hijo pródigo"],
      genres: ["проповедь", "богословие", "эссе", "драматургия"],
    },
    evidence: sources(
      ["Revista Fénix, Biblioteca Nacional del Perú", "https://revistafenix.bnp.gob.pe/index.php/fenix/article/view/327"],
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/literatura/criticon/PDF/116/116_147.pdf"]
    ),
    note: "Спорные точные даты и место понижены до подтверждённых приблизительных данных; заглушки заменены тремя произведениями.",
  },
  {
    countryId: "peru",
    writerId: "julio_ortega",
    patch: {
      birthDate: "1942",
      birthPlace: "Перу",
      works: ["El discurso de la abundancia", "La mesa del padre", "Ayacucho, Good Bye"],
      genres: ["литературная критика", "эссе", "поэзия", "драматургия", "проза"],
    },
    evidence: sources(
      ["Brown University", "https://vivo.brown.edu/display/jortega"],
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/lengua/anuario/anuario_08/pdf/literatura20.pdf"]
    ),
    note: "Неподтверждённые точный день и узкое место рождения сняты; родовые заглушки заменены тремя книгами, жанры уточнены.",
  },
  {
    countryId: "peru",
    writerId: "julio_ramon_ribeyro",
    patch: {
      works: ["La palabra del mudo", "Los gallinazos sin plumas", "Prosas apátridas"],
      genres: ["рассказ", "роман", "драматургия", "эссе"],
      awards: ["Премия латиноамериканской и карибской литературы имени Хуана Рульфо, 1994"],
    },
    evidence: sources(
      ["Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/obras-de-julio-ramon-ribeyro-son-declaradas-patrimonio-cultural-de-la-nacion/"],
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/seminario-sobre-julio-ramon-ribeyro/"]
    ),
    note: "Библиография приведена к оригинальным названиям; ложная премия Сервантеса заменена точной премией Хуана Рульфо.",
  },
  {
    countryId: "peru",
    writerId: "manuel_gonzalez_prada",
    patch: {
      works: ["Pájinas libres", "Horas de lucha", "Nuestros indios", "Minúsculas"],
      genres: ["эссе", "поэзия", "журналистика"],
    },
    evidence: sources(
      ["Biblioteca Nacional del Perú", "https://memoriaperu.bnp.gob.pe/micrositio/manuel-gonzalez-prada"],
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/publicacion-la-semana-horas-lucha-manuel-gonzalez-prada/"]
    ),
    note: "Переводные заголовки заменены четырьмя оригинальными названиями; жанры уточнены.",
  },
  {
    countryId: "peru",
    writerId: "mario_bellatin",
    patch: {
      fullName: "Mario Bellatin Cavigiolo",
      birthDate: "1960",
      nationality: "мексиканец",
      works: ["Salón de belleza", "Flores", "El gran vidrio", "Shiki Nagaoka: una nariz de ficción"],
      genres: ["роман", "экспериментальная проза"],
    },
    evidence: sources(
      ["Instituto Cervantes", "https://libroselectronicos.cervantes.es/resources/6113b88e4e753100017cb0e5"],
      ["University of Iowa", "https://iowaliteraria.lib.uiowa.edu/article/colaboran/"]
    ),
    note: "Полное имя и мексиканская идентичность уточнены, неподтверждённый день снят; ложные названия заменены четырьмя книгами.",
  },
  {
    countryId: "peru",
    writerId: "mario_vargas_llosa",
    patch: {
      years: "1936–2025",
      deathDate: "2025-04-13",
      works: ["La ciudad y los perros", "La casa verde", "Conversación en La Catedral", "La fiesta del Chivo"],
      genres: ["роман", "эссе", "журналистика", "драматургия"],
      awards: ["Нобелевская премия по литературе, 2010", "Премия Сервантеса, 1994"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2010/vargas_llosa/25160-mario-vargas-llosa-biografia/"],
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/berlin_mario_vargas_llosa.htm"]
    ),
    note: "Открытые годы обновлены после смерти автора; библиография, жанры и официальные премии приведены к проверенным формам.",
  },
  {
    countryId: "peru",
    writerId: "oscar_colchado_lucio",
    patch: {
      years: "1947–2023",
      birthDate: "1947-11-14",
      deathDate: "2023-01-20",
      birthPlace: "Уальянка, Анкаш, Перу",
      works: ["Rosa Cuchillo", "Cordillera Negra", "Cholito en los Andes mágicos"],
      genres: ["роман", "рассказ", "поэзия", "детская литература"],
    },
    evidence: sources(
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/oscar-colchado-lucio-renovador-la-mirada-mundo-andino/"],
      ["Ministerio de Cultura del Perú", "https://transparencia.cultura.gob.pe/sites/default/files/transparencia/2023/05/resoluciones-ministeriales/rm000201-2023-mc.pdf"]
    ),
    note: "Ошибочные день и место рождения и открытые годы исправлены; заглушки заменены романом, сборником и книгой цикла о Чолито.",
  },
  {
    countryId: "peru",
    writerId: "ricardo_palma",
    patch: {
      works: ["Tradiciones peruanas", "Anales de la Inquisición de Lima", "Verbos y gerundios"],
      genres: ["рассказ", "историческая проза", "поэзия", "журналистика"],
    },
    evidence: sources(
      ["Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/bnp-realza-figura-de-ricardo-palma-al-cumplirse-191-anos-de-su-natalicio/"],
      ["Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/ricardo-palma/"]
    ),
    note: "Родовое название цикла дополнено двумя книгами и приведено к оригиналу; жанры уточнены.",
  },
  {
    countryId: "peru",
    writerId: "santiago_roncagliolo",
    patch: {
      birthDate: "1975-03-29",
      works: ["Abril rojo", "Pudor", "La noche de los alfileres"],
      genres: ["роман", "журналистика", "сценарий", "перевод"],
      awards: ["Premio Alfaguara за Abril rojo, 2006"],
    },
    evidence: sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/roncagliolo_santiago.htm"],
      ["Penguin Random House Grupo Editorial", "https://www.penguinlibros.com/es/4398-santiago-roncagliolo"]
    ),
    note: "Ошибочный месяц рождения исправлен; библиография приведена к оригинальным названиям, перевод и точная премия добавлены.",
  },
  {
    countryId: "philippines",
    writerId: "edith_tiempo",
    patch: {
      name: "Эдит Тьемпо",
      works: ["A Blade of Fern", "The Tracks of Babylon and Other Poems", "The Builder"],
      genres: ["поэзия", "роман", "рассказ", "литературное преподавание"],
      awards: ["National Artist of the Philippines for Literature, 1999"],
    },
    evidence: sources(
      ["Lawphil", "https://lawphil.net/executive/proc/proc1999/proc_218_1999.html"],
      ["University of Santo Tomas", "https://www.ust.edu.ph/hidalgo-lectures-on-edith-l-tiempos-fiction-for-nccas-national-artists-for-literature-series/"]
    ),
    note: "Русская транслитерация нормализована; библиография, жанры и официальное звание добавлены.",
  },
  {
    countryId: "philippines",
    writerId: "f_sionil_jose",
    patch: {
      works: ["Rosales Saga", "The Pretenders", "Mass"],
      genres: ["роман", "рассказ", "эссе"],
      awards: ["National Artist of the Philippines for Literature, 2001"],
    },
    evidence: sources(
      ["Cultural Center of the Philippines", "https://hanggangsamuli.culturalcenter.gov.ph/obituaries/f-sionil-jose/"],
      ["University of the Philippines", "https://up.edu.ph/celebrating-the-life-of-national-artist-f-sionil-jose-97/"]
    ),
    note: "Библиография дополнена циклом и двумя романами; эссеистика и официальное звание добавлены.",
  },
  {
    countryId: "philippines",
    writerId: "francisco_balagtas",
    patch: {
      fullName: "Francisco Baltazar y de la Cruz",
      birthPlace: "Пангинай, Бигаа (ныне Балагтас), Булакан, Филиппины",
      works: ["Florante at Laura", "Orosmán at Zafira"],
      genres: ["поэзия", "драматургия"],
    },
    evidence: sources(
      ["National Historical Commission of the Philippines", "https://philhistoricsites.nhcp.gov.ph/registry_database/francisco-c-baltazar-balagtas-1788-1862/"],
      ["Lawphil", "https://lawphil.net/executive/proc/proc1986/proc_5_1986.html"]
    ),
    note: "Полное имя и неверное место рождения исправлены; родовые заглушки заменены поэмой и пьесой.",
  },
  {
    countryId: "philippines",
    writerId: "jose_rizal",
    patch: {
      fullName: "José Protasio Rizal Mercado y Alonso Realonda",
      works: ["Noli me tangere", "El filibusterismo", "Mi último adiós"],
      genres: ["роман", "эссе", "поэзия", "политическая публицистика"],
    },
    evidence: sources(
      ["National Historical Commission of the Philippines", "https://philhistoricsites.nhcp.gov.ph/registry_database/jose-protacio-rizal-1861-1896/"],
      ["Library of Congress", "https://guides.loc.gov/world-of-1898/jose-rizal"]
    ),
    note: "Полное имя раскрыто; библиография и литературные формы дополнены.",
  },
  {
    countryId: "philippines",
    writerId: "miguel_syjuco",
    patch: {
      works: ["Ilustrado"],
      genres: ["роман", "журналистика"],
      awards: ["Man Asian Literary Prize за Ilustrado, 2008", "Palanca Grand Prize за Ilustrado, 2008"],
    },
    evidence: sources(
      ["New York University Abu Dhabi", "https://nyuad.nyu.edu/en/academics/divisions/arts-and-humanities/faculty/miguel-syjuco.html"],
      ["Harvard Radcliffe Institute", "https://www.radcliffe.harvard.edu/people/miguel-syjuco"]
    ),
    note: "Международное признание конкретизировано двумя премиями за дебютный роман; журналистика добавлена.",
  },
  {
    countryId: "philippines",
    writerId: "nick_joaquin",
    patch: {
      fullName: "Nicomedes Márquez Joaquín",
      works: ["The Woman Who Had Two Navels", "A Portrait of the Artist as Filipino", "May Day Eve"],
      genres: ["роман", "рассказ", "драматургия", "эссе"],
      awards: ["National Artist of the Philippines for Literature, 1976"],
    },
    evidence: sources(
      ["Lawphil", "https://lawphil.net/executive/proc/proc1976/proc_1539_1976.html"],
      ["Cultural Center of the Philippines", "https://culturalcenter.gov.ph/listicle/find-your-next-favorite-literary-masterpiece/"]
    ),
    note: "Неполное имя раскрыто; три произведения, жанры и официальное звание добавлены.",
  },
  {
    countryId: "poland",
    writerId: "adam_mickiewicz",
    patch: {
      works: ["Пан Тадеуш", "Дзяды", "Конрад Валленрод"],
      genres: ["поэзия", "драматургия", "эпическая поэма"],
    },
    evidence: sources(
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/adam-mickiewicz"],
      ["Muzeum Literatury im. Adama Mickiewicza", "https://muzeumliteratury.pl/adam-mickiewicz-1798-1855/"]
    ),
    note: "Одно произведение дополнено двумя книгами; драматургия и эпическая поэма добавлены к жанрам.",
  },
  {
    countryId: "poland",
    writerId: "boleslaw_prus",
    patch: {
      fullName: "Aleksander Głowacki (Bolesław Prus)",
      works: ["Кукла", "Фараон", "Форпост"],
      genres: ["роман", "рассказ", "журналистика", "реализм"],
    },
    evidence: sources(
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/boleslaw-prus-aleksander-glowacki"],
      ["Muzeum Literatury im. Adama Mickiewicza", "https://archiwum.muzeumliteratury.pl/warszawa-lalki-boleslawa-prusa/"]
    ),
    note: "Псевдоним раскрыт через настоящее имя; библиография и жанры дополнены.",
  },
  {
    countryId: "poland",
    writerId: "czeslaw_milosz",
    patch: {
      works: ["Порабощённый разум", "Долина Иссы", "Спасение"],
      genres: ["поэзия", "эссе", "роман", "перевод"],
      awards: ["Нобелевская премия по литературе, 1980"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1980/milosz/facts/"],
      ["Academy of American Poets", "https://poets.org/poet/czeslaw-milosz"]
    ),
    note: "Библиография дополнена тремя книгами; эссе, роман и перевод добавлены к жанрам, премия нормализована.",
  },
  {
    countryId: "poland",
    writerId: "henryk_sienkiewicz",
    patch: {
      works: ["Камо грядеши", "Огнём и мечом", "Потоп", "Пан Володыёвский"],
      genres: ["роман", "историческая проза", "рассказ"],
      awards: ["Нобелевская премия по литературе, 1905"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1905/sienkiewicz/facts/"],
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/henryk-sienkiewicz"]
    ),
    note: "Библиография дополнена полной исторической трилогией; жанры и премия нормализованы.",
  },
  {
    countryId: "poland",
    writerId: "jan_kochanowski",
    patch: {
      works: ["Фрашки", "Трены", "Отправа греческих послов"],
      genres: ["поэзия", "драматургия"],
    },
    evidence: sources(
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/jan-kochanowski"],
      ["Muzeum Jana Kochanowskiego", "https://muzeumkochanowski.pl/"]
    ),
    note: "Библиография дополнена двумя циклами и драмой; драматургия добавлена к жанрам.",
  },
  {
    countryId: "poland",
    writerId: "joseph_conrad",
    patch: {
      works: ["Сердце тьмы", "Лорд Джим", "Ностромо"],
      genres: ["роман", "повесть", "рассказ", "морская проза", "модернизм"],
    },
    evidence: sources(
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/joseph-conrad-jozef-teodor-konrad-korzeniowski"],
      ["British Museum", "https://www.britishmuseum.org/collection/term/BIOG23446"]
    ),
    note: "Пустой список произведений заполнен тремя романами и повестью; жанры дополнены.",
  },
  {
    countryId: "poland",
    writerId: "juliusz_slowacki",
    patch: {
      works: ["Кордиан", "Балладина", "Бенёвский"],
      genres: ["поэзия", "драматургия"],
    },
    evidence: sources(
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/juliusz-slowacki"],
      ["Muzeum Literatury im. Adama Mickiewicza", "https://slowackiwlibanie.muzeumliteratury.pl/en/"]
    ),
    note: "Единственная драма дополнена ещё одной драмой и поэмой; жанр нормализован.",
  },
  {
    countryId: "poland",
    writerId: "olga_tokarczuk",
    patch: {
      awards: ["Нобелевская премия по литературе за 2018 год", "Международная Букеровская премия за роман «Бегуны», 2018"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2018/tokarczuk/biographical/"],
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/olga-tokarczuk"]
    ),
    note: "Список наград дополнен точной Международной Букеровской премией и явно датированной Нобелевской премией.",
  },
  {
    countryId: "poland",
    writerId: "stanislaw_lem",
    patch: {
      works: ["Солярис", "Кибериада", "Глас Господа"],
      genres: ["научная фантастика", "эссе", "философская проза"],
    },
    evidence: sources(
      ["Stanisław Lem official site", "https://english.lem.pl/home/biography/abouthimself"],
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/stanislaw-lem"]
    ),
    note: "Единственный заголовок заменён тремя документированными книгами; эссе и философская проза добавлены.",
  },
  {
    countryId: "poland",
    writerId: "wislawa_szymborska",
    patch: {
      genres: ["поэзия", "эссе"],
      awards: ["Нобелевская премия по литературе, 1996"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1996/szymborska/facts/"],
      ["Wisława Szymborska Foundation", "https://www.szymborska.org.pl/en/wislawa/chronology/"]
    ),
    note: "Эссеистика добавлена к жанрам; дублирующиеся формулировки Нобелевской премии сведены к одной точной записи.",
  },
  {
    countryId: "poland",
    writerId: "wladyslaw_reymont",
    patch: {
      works: ["Мужики", "Земля обетованная"],
      genres: ["роман", "реализм", "натурализм"],
      awards: ["Нобелевская премия по литературе, 1924"],
    },
    evidence: sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1924/reymont/facts/"],
      ["Adam Mickiewicz Institute", "https://culture.pl/en/artist/wladyslaw-stanislaw-reymont"]
    ),
    note: "Нобелевский роман добавлен к списку произведений; жанры и премия нормализованы.",
  },
] satisfies readonly WriterPublicProfileFactCorrectionBatch44[];
