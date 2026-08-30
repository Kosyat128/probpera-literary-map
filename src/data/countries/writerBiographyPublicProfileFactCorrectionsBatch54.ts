import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch54 = {
  countryId: string;
  writerId: string;
  patch: Partial<WriterProfile>;
  evidence: Array<{ provider: string; url: string; checkedAt: string }>;
  note: string;
};

const checkedAt = "2026-08-30";

function sources(
  ...items: ReadonlyArray<readonly [provider: string, url: string]>
) {
  return items.map(([provider, url]) => ({ provider, url, checkedAt }));
}

function correction(
  countryId: string,
  writerId: string,
  patch: Partial<WriterProfile>,
  evidence: ReturnType<typeof sources>,
  note: string
): WriterPublicProfileFactCorrectionBatch54 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch54 = [
  correction(
    "ukraine",
    "valerii_shevchuk",
    {
      "years": "1939-2025",
      "deathDate": "2025-05-06",
      "deathPlace": "Киев, Украина"
    },
    sources(
      ["Львовский национальный университет имени Ивана Франко", "https://lnu.edu.ua/vidiyshov-u-vichnist-pochesnyy-doktor-lvivskoho-universytetu-valeriy-shevchuk/"],
      ["Internet Encyclopedia of Ukraine, Canadian Institute of Ukrainian Studies", "https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CS%5CH%5CShevchukValerii.htm"],
    ),
    "Слово «современный» стало фактически неверным после смерти автора; добавлены проверенные занятия, произведение и дата смерти."
  ),
  correction(
    "uruguay",
    "carlos_reyles",
    {
      "birthDate": "1868-10-30",
      "works": [
        "Beba",
        "La raza de Caín",
        "El terruño"
      ]
    },
    sources(
      ["Национальная библиотека Уругвая", "https://bibliotecadigital.bibna.gub.uy/jspui/bitstream/123456789/1098/6/003-reyles_c.pdf"],
      ["Autores.uy", "https://autores.uy/autor/311"],
    ),
    "Удалено субъективное ранжирование; дата рождения исправлена с 30 марта на 30 октября 1868 года, а неточные названия заменены библиографически подтверждёнными."
  ),
  correction(
    "uruguay",
    "claudia_amenedo",
    {
      "name": "Клаудия Аменгуаль",
      "fullName": "Claudia Amengual",
      "birthDate": "1969",
      "birthPlace": "Монтевидео, Уругвай",
      "coordinates": undefined,
      "works": [
        "La rosa de Jericó",
        "Desde las cenizas",
        "Más que una sombra",
        "Falsas ventanas"
      ]
    },
    sources(
      ["Министерство образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/sites/ministerio-educacion-cultura/files/2020-07/catalogo-books-from-uruguay-2013_0.pdf"],
      ["Jacksonville University", "https://www.ju.edu/spanish/latinoture/autores/claudia-amengual.php"],
    ),
    "Карточка была повреждена: фамилия, место рождения и названия книг не соответствовали установленной личности. Искусственная дата 01-01 понижена до доказанного года."
  ),
  correction(
    "uruguay",
    "eduardo_galeano",
    {
      "works": [
        "Las venas abiertas de América Latina",
        "Memoria del fuego",
        "El libro de los abrazos",
        "Los hijos de los días"
      ]
    },
    sources(
      ["Архив Университета Республики, Уругвай", "https://archivosdocumentales.udelar.edu.uy/index.php/actor/browse?page=17&sort=alphabetic&sortDir=desc"],
      ["Historias Universitarias, Universidad de la República", "https://historiasuniversitarias.edu.uy/biografia/hughes-galeano-eduardo-german-maria/"],
    ),
    "Субъективные формулы о мировом уровне и известности заменены занятиями и проверяемой библиографией; ошибочное название «Вена истории» удалено."
  ),
  correction(
    "uruguay",
    "emilio_frugoni",
    {
      "name": "Эмилио Фругони",
      "fullName": "Emilio Frugoni Queirolo",
      "works": [
        "Los himnos",
        "Poemas montevideanos",
        "La esfinge roja"
      ]
    },
    sources(
      ["Autores.uy", "https://autores.uy/autor/606"],
      ["Академия литературы при Министерстве образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/academia-nacional-letras/emilio-frugoni"],
    ),
    "Неточная транслитерация фамилии и родовые обозначения произведений заменены установленным именем и названиями книг."
  ),
  correction(
    "uruguay",
    "felisberto_hernandez",
    {
      "works": [
        "El caballo perdido",
        "Nadie encendía las lámparas",
        "Las hortensias",
        "El cocodrilo"
      ]
    },
    sources(
      ["Архив Фелисберто Эрнандеса, Национальная библиотека Уругвая", "https://archivofelisbertohernandez.bibna.gub.uy/"],
      ["Кабильдо Монтевидео", "https://cabildo.montevideo.gub.uy/sites/cabildo.montevideo.gub.uy/files/articulos/descargas/biografias_escritoras_escritores.pdf"],
    ),
    "Оценочное ранжирование и интерпретации заменены документированными занятиями и библиографией; неточное название произведения устранено."
  ),
  correction(
    "uruguay",
    "idea_vilarino",
    {
      "works": [
        "Nocturnos",
        "Poemas de amor",
        "Pobre mundo"
      ]
    },
    sources(
      ["Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3438"],
      ["Министерство образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/politicas-y-gestion/idea-vilarino"],
    ),
    "Широкое утверждение о культурном влиянии заменено проверяемыми занятиями и принадлежностью к поколению; родовые и неточные названия книг исправлены."
  ),
  correction(
    "uruguay",
    "javier_de_viana",
    {
      "works": [
        "Campo",
        "Gaucha",
        "Gurí"
      ]
    },
    sources(
      ["Академия литературы при Министерстве образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/academia-nacional-letras/sillones-academicos/javier-viana"],
      ["Autores.uy", "https://autores.uy/autor/668"],
    ),
    "Убрана недоказанная формула об основании реалистической традиции; названия произведений приведены по библиографии."
  ),
  correction(
    "uruguay",
    "jose_enrique_rodo",
    {
      "name": "Хосе Энрике Родо",
      "works": [
        "Ariel",
        "Motivos de Proteo",
        "El mirador de Próspero"
      ]
    },
    sources(
      ["Академия литературы при Министерстве образования и культуры Уругвая", "https://www.gub.uy/ministerio-educacion-cultura/academia-nacional-letras/jose-enrique-rodo"],
      ["Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3436"],
    ),
    "Оценочное ранжирование и широкое утверждение о влиянии заменены фактами; исправлены опечатка в русском имени и смешение Протея с Прометеем."
  ),
  correction(
    "uruguay",
    "juan_carlos_onetti",
    {
      "works": [
        "El pozo",
        "La vida breve",
        "El astillero",
        "Juntacadáveres"
      ]
    },
    sources(
      ["Министерство культуры Испании", "https://www.cultura.gob.es/premiado/mostrarDetalleAction.do?cache=init&id=1007219&language=es&layout=premiadoFicha&prev_layout=premiadoResultado"],
      ["Национальная библиотека Уругвая", "https://catalogoarchivoliterario.bibna.gub.uy/index.php/onetti-juan-carlos?sf_culture=es"],
    ),
    "Субъективные оценки и недоказанная формула о влиянии заменены проверяемыми произведениями, литературным пространством Санта-Марии и премией."
  ),
  correction(
    "uruguay",
    "mario_benedetti",
    {
      "works": [
        "La tregua",
        "Gracias por el fuego",
        "Primavera con una esquina rota",
        "Poemas de la oficina"
      ]
    },
    sources(
      ["Национальная администрация государственного образования Уругвая", "https://uruguayeduca.anep.edu.uy/sites/default/files/exelearning/06-2026/14627/biografa_del_autor.html"],
      ["Фонд Марио Бенедетти", "https://fundacionmariobenedetti.uy/"],
    ),
    "Оценочные формулировки заменены биографическими фактами; названия произведений приведены в проверенной форме."
  ),
  correction(
    "uruguay",
    "mario_levrero",
    {
      "fullName": "Jorge Mario Varlotta Levrero",
      "works": [
        "La ciudad",
        "El discurso vacío",
        "La novela luminosa"
      ]
    },
    sources(
      ["Журнал Национального автономного университета Мексики", "https://www.revistadelauniversidad.mx/articles/72a43c8e-2e35-45e4-ac5c-e5f6b2a79436/un-perfil-de-mario-levrero"],
      ["Autores.uy", "https://autores.uy/autor/652"],
    ),
    "Уточнено полное зарегистрированное имя и убраны субъективные характеристики; произведения приведены в оригинальном написании."
  ),
  correction(
    "uruguay",
    "mauricio_rosencof",
    {
      "birthPlace": "Флорида, Уругвай",
      "coordinates": undefined,
      "works": [
        "El Gran Tuleque",
        "Memorias del Calabozo",
        "Las cartas que no llegaron"
      ]
    },
    sources(
      ["Президентство Уругвая", "https://www.gub.uy/presidencia/comunicacion/noticias/presidente-orsi-asistio-homenaje-junta-departamental-montevideo-mauricio"],
      ["Национальный университет Ла-Платы", "https://sedici.unlp.edu.ar/bitstream/handle/10915/162166/Documento_completo.pdf-PDFA.pdf?isAllowed=y&sequence=1"],
    ),
    "Исправлено место рождения, очищены недоказанные координаты и заменены оценочные формулировки проверяемыми фактами."
  ),
  correction(
    "uruguay",
    "silvia_lago",
    {
      "fullName": "Sylvia Lago Carzolio",
      "birthDate": "1932-11-20",
      "coordinates": undefined,
      "works": [
        "Trajano",
        "Detrás del rojo",
        "La última razón"
      ]
    },
    sources(
      ["Библиотека парламента Уругвая", "https://omeka.parlamento.gub.uy/omeka-s/s/biobibliografias/item/3445"],
      ["Университет Республики", "https://www.colibri.udelar.edu.uy/jspui/bitstream/20.500.12008/9270/1/Panisello%2C%20Claudia.pdf"],
    ),
    "Исправлена искусственная дата 1 января на документированную дату 20 ноября, уточнено полное имя и убраны недоказанные координаты."
  ),
  correction(
    "usa",
    "andy_weir",
    {
      "works": [
        "The Martian",
        "Artemis",
        "Project Hail Mary"
      ]
    },
    sources(
      ["Официальный сайт Энди Вейра", "https://andyweirauthor.com/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/184612/andy-weir/"],
    ),
    "Рекламные оценки заменены проверяемыми сведениями об образовании, прежней работе и опубликованных романах."
  ),
  correction(
    "usa",
    "anne_bradstreet",
    {
      "years": "ок. 1612-1672",
      "birthDate": undefined,
      "birthPlace": "Нортгемптоншир, Англия"
    },
    sources(
      ["Государственный департамент США", "https://www.govinfo.gov/content/pkg/GOVPUB-S20-PURL-gpo2329/pdf/GOVPUB-S20-PURL-gpo2329.pdf"],
      ["Университет Торонто", "https://rpo.library.utoronto.ca/poets/bradstreet-anne"],
    ),
    "Точность спорного года рождения снижена до приблизительной, а субъективная оценка заменена фактом первой публикации сборника."
  ),
  correction(
    "usa",
    "blaine_harden",
    {
      "works": [
        "Escape from Camp 14"
      ]
    },
    sources(
      ["Официальный сайт Блейна Хардена", "https://blaineharden.com/escape-from-camp-14-reviews/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/books/307766/escape-from-camp-14-by-blaine-harden/"],
    ),
    "Ключевое позднее уточнение достоверности источника добавлено явно; прежняя безоговорочная передача спорной биографии устранена."
  ),
  correction(
    "usa",
    "blake_crouch",
    {
      "works": [
        "Dark Matter",
        "Recursion",
        "Upgrade",
        "Wayward Pines"
      ]
    },
    sources(
      ["Официальный сайт Блейка Крауча", "https://blakecrouch.com/"],
      ["Apple TV+ Press", "https://www.apple.com/tv-pr/news/2022/03/apple-tv-announces-dark-matter-series-adaptation-with-joel-edgerton-set-to-star/"],
    ),
    "Рекламные характеристики заменены проверяемыми названиями книг и ролью автора в телевизионной адаптации."
  ),
  correction(
    "usa",
    "chuck_palahniuk",
    {
      "name": "Чак Паланик",
      "works": [
        "Fight Club",
        "Invisible Monsters",
        "Choke"
      ]
    },
    sources(
      ["Орегонская энциклопедия", "https://www.oregonencyclopedia.org/articles/palahniuk_chuck_1962_/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/23091/chuck-palahniuk/"],
    ),
    "Публичное авторское имя отделено от полного имени; оценочные тематические характеристики заменены библиографическими фактами."
  ),
  correction(
    "usa",
    "dan_brown",
    {
      "works": [
        "Angels & Demons",
        "The Da Vinci Code",
        "The Lost Symbol",
        "Inferno",
        "Origin"
      ]
    },
    sources(
      ["Официальный сайт Дэна Брауна", "https://danbrown.com/about/"],
      ["Penguin Random House", "https://global.penguinrandomhouse.com/tag/dan-brown/"],
    ),
    "Рекламное определение «интеллектуальные триллеры» и оценка известности заменены проверяемой библиографией серии."
  ),
  correction(
    "usa",
    "dan_simmons",
    {
      "years": "1948-2026",
      "birthDate": "1948-04-04",
      "deathDate": "2026-02-21",
      "works": [
        "Hyperion Cantos",
        "The Terror",
        "Song of Kali"
      ]
    },
    sources(
      ["Macmillan Publishers", "https://us.macmillan.com/author/dansimmons/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/28431/dan-simmons/"],
      ["Writers Guild of America", "https://www.wga.org/news-events/news/in-memoriam"],
      ["Dignity Memorial / Ahlberg Funeral Chapel", "https://www.dignitymemorial.com/obituaries/longmont-co/daniel-simmons-12758871"],
    ),
    "Даты рождения и смерти уточнены по официальному мемориальному списку Гильдии сценаристов США и семейному некрологу; библиография расширена без оценочных формулировок."
  ),
  correction(
    "usa",
    "daniel_keyes",
    {
      "years": "1927-2014",
      "birthDate": "1927",
      "deathDate": "2014-06-15",
      "works": [
        "Flowers for Algernon",
        "The Minds of Billy Milligan"
      ]
    },
    sources(
      ["Университет Огайо", "https://media.library.ohio.edu/digital/collection/archives/id/43496/"],
      ["Science Fiction and Fantasy Writers Association", "https://sfwa.org/2014/06/17/memoriam-daniel-keyes-1927-2014/"],
    ),
    "Биография дополнена датами жизни и основным художественным произведением; неточное русское переименование документальной книги заменено оригинальным названием."
  ),
  correction(
    "usa",
    "dean_koontz",
    {
      "works": [
        "False Memory",
        "Odd Thomas",
        "Jane Hawk series"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/16127/dean-koontz/"],
      ["Simon & Schuster", "https://www.simonandschuster.com/authors/Dean-Koontz/256755223"],
    ),
    "Убрана общая рекламная характеристика и добавлены проверенные серии произведений в оригинальном написании."
  ),
  correction(
    "usa",
    "dennis_lehane",
    {
      "works": [
        "Mystic River",
        "Shutter Island",
        "Gone, Baby, Gone"
      ]
    },
    sources(
      ["Официальный сайт Денниса Лихэйна", "https://dennislehane.com/about-dennis/"],
      ["Бостонский колледж", "https://www.bc.edu/content/bc-web/bcnews/news-archive-2011-to-2015/chronicle/2015/features/for-him--writing-a-matter-of-passion.html"],
    ),
    "Широкая жанровая характеристика заменена проверяемыми произведениями и фактом их экранизации."
  ),
  correction(
    "usa",
    "donna_tartt",
    {
      "works": [
        "The Secret History",
        "The Little Friend",
        "The Goldfinch"
      ]
    },
    sources(
      ["Пулитцеровская премия", "https://www.pulitzer.org/winners/donna-tartt"],
      ["Hachette Book Group", "https://www.hachettebookgroup.com/contributor/donna-tartt/?lens=little-brown"],
    ),
    "Оценка положения в литературе заменена полной проверяемой библиографией романов и точным сведением о награде."
  ),
  correction(
    "usa",
    "douglas_preston_lincoln_child",
    {
      "works": [
        "Relic",
        "The Cabinet of Curiosities",
        "Brimstone"
      ]
    },
    sources(
      ["Официальный сайт Престона и Чайлда", "https://www.prestonchild.com/authors/"],
      ["Macmillan Publishers", "https://us.macmillan.com/books/9781250335265/relic/"],
    ),
    "Карточка явно описана как совместная, убраны рекламные оценки, а серия и её первая книга названы точно."
  ),
  correction(
    "usa",
    "dr_seuss",
    {
      "works": [
        "The Cat in the Hat",
        "Green Eggs and Ham",
        "The Lorax"
      ]
    },
    sources(
      ["Дартмутский колледж", "https://archives-manuscripts.dartmouth.edu/agents/people/1172"],
      ["Библиотека Конгресса США", "https://www.loc.gov/exhibits/america-reads/1950-to-2009.html"],
    ),
    "Псевдоним связан с полным именем автора; оценка популярности заменена датами, занятиями и конкретными книгами."
  ),
  correction(
    "usa",
    "ernest_cline",
    {
      "works": [
        "Ready Player One",
        "Armada",
        "Ready Player Two"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/130867/ernest-cline/"],
      ["Библиотека Конгресса США", "https://www.loc.gov/static/events/2024-national-book-festival/documents/NBF24-Program.pdf"],
    ),
    "Рекламная характеристика заменена проверяемой библиографией и подтверждённой работой над сценарием экранизации."
  ),
  correction(
    "usa",
    "francis_scott_fitzgerald",
    {
      "works": [
        "This Side of Paradise",
        "The Beautiful and Damned",
        "The Great Gatsby",
        "Tender Is the Night"
      ]
    },
    sources(
      ["Библиотека Принстонского университета", "https://static-prod.lib.princeton.edu/sc/aids/fitzadd/"],
      ["Библиотека Конгресса США", "https://www.loc.gov/exhibits/america-reads/1900-to-1949.html"],
    ),
    "Оценка литературного статуса заменена датами, жанрами и проверенной последовательностью четырёх прижизненных романов."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch54[];
