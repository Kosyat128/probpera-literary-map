import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch50 = {
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
): WriterPublicProfileFactCorrectionBatch50 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch50 = [
  correction(
    "spain",
    "alfonso_x_el_sabio",
    {
      "works": [
        "Cantigas de Santa María",
        "Siete Partidas",
        "General estoria"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/agenda-eventos-actividades/exposicion-libros-rey-sabio-viii-centenario-del-nacimiento-alfonso-x"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/alfonso_x_el_sabio/autor_biografia/"],
    ),
    "Неопределённая оценка влияния заменена конкретным описанием покровительства и коллективной книжной программы; личное авторство не преувеличено."
  ),
  correction(
    "spain",
    "arturo_perez_reverte",
    {
      "works": [
        "El capitán Alatriste",
        "El club Dumas",
        "La carta esférica"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://datos.bne.es/resource/XX955194"],
      ["Real Academia Española", "https://www.rae.es/academico/arturo-perez-reverte"],
    ),
    "Исходная характеристика была фактически верна, но текст конкретизирован проверяемой журналистской специализацией и названиями произведений."
  ),
  correction(
    "spain",
    "benito_jeronimo_feijoo",
    {
      "works": [
        "Teatro crítico universal",
        "Cartas eruditas y curiosas"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/benito_jeronimo_feijoo/autor_biografia/"],
      ["Universidad de Oviedo - Instituto Feijoo", "https://www.unioviedo.es/IFESXVIII_digital/wp-content/uploads/2024/11/2014_Trea_Lidiando-con-sombras.pdf"],
    ),
    "Оценочное ранжирование заменено монашеским и академическим статусом и точными названиями основных трудов."
  ),
  correction(
    "spain",
    "calderon_de_la_barca",
    {
      "works": [
        "La vida es sueño",
        "El alcalde de Zalamea",
        "El médico de su honra"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/calderon_de_la_barca/autor_calderon_epoca/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX870107.html"],
    ),
    "Оценочная формула заменена занятиями, историческим контекстом и проверяемыми пьесами."
  ),
  correction(
    "spain",
    "carlos_ruiz_zafon",
    {
      "works": [
        "La sombra del viento",
        "El juego del ángel",
        "El prisionero del cielo"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/noticias/0619-fallece-ruiz-zafon"],
      ["Официальный сайт Карлоса Руиса Сафона", "https://www.carlosruizzafon.com/es/carlos-ruiz-zafon.php?idioma=es"],
    ),
    "Маркетинговое определение «международный бестселлер» заменено проверяемыми датами, профессией и названиями произведений."
  ),
  correction(
    "spain",
    "carmen_laforet",
    {
      "works": [
        "Nada",
        "La isla y los demonios"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/laforet-carmen"],
      ["Indiana University Libraries", "https://collections.libraries.indiana.edu/iulibraries/s/iberoamericancentennials/page/carmenlaforet"],
    ),
    "Субъективное ранжирование заменено биографическими датами, первым романом, премией и вторым подтверждённым произведением."
  ),
  correction(
    "spain",
    "emilia_pardo_bazan",
    {
      "works": [
        "Los pazos de Ulloa",
        "La madre naturaleza",
        "La Tribuna"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/pardo_bazan/autora_biografia/"],
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/pardo-bazan-emilia"],
    ),
    "Оценочная формула удалена; ошибочное название «Трибунал» исправлено на «La Tribuna», остальные названия приведены в оригинале."
  ),
  correction(
    "spain",
    "federico_garcia_lorca",
    {
      "deathDate": "1936-08",
      "works": [
        "Romancero gitano",
        "Bodas de sangre",
        "Yerma",
        "La casa de Bernarda Alba"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/garcia-lorca-federico"],
      ["Centro Federico García Lorca", "https://www.centrofedericogarcialorca.es/es/fgl"],
    ),
    "Субъективная известность заменена литературной группой и произведениями; точный день гибели не утверждается, поскольку институциональные источники расходятся между 18 и 19 августа."
  ),
  correction(
    "spain",
    "francisco_de_quevedo",
    {
      "works": [
        "Historia de la vida del Buscón",
        "Sueños y discursos",
        "Poesía"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/francisco_de_quevedo/vida_y_obra/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX838045.html"],
    ),
    "Жанровая характеристика конкретизирована, а неточные русские обозначения произведений заменены устойчивыми оригинальными названиями."
  ),
  correction(
    "spain",
    "garcilaso_de_la_vega",
    {
      "birthDate": "ок. 1501",
      "works": [
        "Sonetos",
        "Églogas",
        "Elegías"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/garcilaso_de_la_vega/obra/obras-de-garcilaso-de-la-vega/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1030234.html"],
    ),
    "Недоказанная точность года рождения снята: авторитетные справочные записи датируют рождение приблизительно 1501 годом; оценка влияния удалена."
  ),
  correction(
    "spain",
    "gustavo_adolfo_becquer",
    {
      "works": [
        "Rimas",
        "Leyendas"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/gustavo_adolfo_becquer/autor_biografia/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719659.html"],
    ),
    "Субъективное ранжирование удалено; сохранены проверяемая литературная принадлежность и точные названия сборников."
  ),
  correction(
    "spain",
    "jacinto_benavente",
    {
      "works": [
        "Los intereses creados",
        "La malquerida",
        "La noche del sábado"
      ]
    },
    sources(
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1922/benavente/facts/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX835237"],
    ),
    "Интерпретационные оценки заменены премией и произведениями; неподтверждённое название «Злорадство» удалено из профиля."
  ),
  correction(
    "spain",
    "jorge_manrique",
    {
      "deathDate": "1479",
      "works": [
        "Coplas por la muerte de su padre"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/jorge_manrique/autor_biografia/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1021804.html"],
    ),
    "Субъективное место в иерархии поэзии заменено занятиями и конкретным произведением; в биографии используется надёжно установленный год смерти без лишней точности."
  ),
  correction(
    "spain",
    "jose_de_espronceda",
    {
      "works": [
        "El estudiante de Salamanca",
        "Canción del pirata",
        "El diablo mundo"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/jose_de_espronceda/autor_biografia/"],
      ["Biblioteca Nacional de España", "https://www.bne.es/export/sites/BNWEB1/es/Actividades/Exposiciones/Exposiciones/Exposiciones2009/docs_espronceda/folletoespronceda.pdf"],
    ),
    "Субъективное ранжирование удалено; добавлены жанры и точные оригинальные названия произведений, незавершённость El diablo mundo обозначена."
  ),
  correction(
    "spain",
    "jose_echegaray",
    {
      "works": [
        "El gran Galeoto",
        "O locura o santidad",
        "El hijo de Don Juan"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/echegaray-jose"],
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1904/echegaray/facts/"],
    ),
    "Интерпретация драматургии заменена документированными профессиями, совместной Нобелевской премией и произведениями; дата смерти 14 сентября сохранена по испанской национальной записи."
  ),
  correction(
    "spain",
    "jose_ortega_y_gasset",
    {
      "works": [
        "La rebelión de las masas",
        "La deshumanización del arte",
        "Meditaciones del Quijote"
      ]
    },
    sources(
      ["Fundación José Ortega y Gasset-Gregorio Marañón", "https://ortegaygasset.edu/legados/jose-ortega-y-gasset/"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX947193.html"],
    ),
    "Субъективное общеевропейское ранжирование заменено профессией и конкретными трудами."
  ),
  correction(
    "spain",
    "juan_de_la_cruz",
    {
      "birthDate": "1542",
      "works": [
        "Noche oscura",
        "Cántico espiritual",
        "Subida del Monte Carmelo"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/san_juan_de_la_cruz/autor_biografia/"],
      ["Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Juan%20de%20la%20Cruz&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO"],
    ),
    "Оценочное ранжирование снято; точный день рождения не подтверждён ранним документом и заменён надёжно установленным годом."
  ),
  correction(
    "spain",
    "juan_marse",
    {
      "works": [
        "Últimas tardes con Teresa",
        "El amante bilingüe"
      ]
    },
    sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/marse_juan.htm"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719464.html"],
    ),
    "Широкое определение литературной принадлежности заменено местом рождения, жанром, произведениями и премией; неверный русский вариант второго названия исправлен."
  ),
  correction(
    "spain",
    "juan_ramon_jimenez",
    {
      "works": [
        "Platero y yo",
        "Eternidades",
        "Sonetos espirituales"
      ]
    },
    sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/nueva_delhi_juan_ramon_jimenez.htm?authuser=0"],
      ["Nobel Prize", "https://www.nobelprize.org/prizes/literature/1956/jimenez/facts/"],
    ),
    "Субъективное ранжирование удалено; дата рождения 23 декабря сохранена по испанской биографической записи, несмотря на встречающееся в нобелевской карточке расхождение на один день."
  ),
  correction(
    "spain",
    "leopoldo_alas_clarin",
    {
      "works": [
        "La Regenta",
        "Su único hijo",
        "Cuentos morales"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/leopoldo_alas_clarin/autor_biografia/"],
      ["Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Leopoldo%20Alas%20Clarin&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO"],
    ),
    "Субъективное ранжирование заменено профессиями и конкретными библиографическими позициями."
  ),
  correction(
    "spain",
    "lope_de_vega",
    {
      "works": [
        "Fuenteovejuna",
        "El perro del hortelano",
        "El caballero de Olmedo"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/lope_de_vega/autor_biobibliografia/"],
      ["Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Lope%20de%20Vega&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO"],
    ),
    "Гиперболы удалены; «La Estrella de Sevilla» исключена из профиля из-за спорной атрибуции, а перечень заменён бесспорными пьесами."
  ),
  correction(
    "spain",
    "luis_de_gongora",
    {
      "works": [
        "Fábula de Polifemo y Galatea",
        "Soledades",
        "Sonetos"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/luis_de_gongora/autor_biografia/"],
      ["Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Luis%20de%20Gongora&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO"],
    ),
    "Недоказанная формула единоличного «создателя» направления заменена проверяемой связью с культизмом; неопределённые «Оды» заменены точными категориями и названиями."
  ),
  correction(
    "spain",
    "mariano_jose_de_larra",
    {
      "works": [
        "El castellano viejo",
        "Vuelva usted mañana",
        "El día de difuntos de 1836"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/mariano_jose_de_larra/autor_biografia/"],
      ["Biblioteca Nacional de España - каталог", "https://catalogo.bne.es/discovery/search?query=any,contains,Mariano%20Jose%20de%20Larra&tab=LibraryCatalog&search_scope=MyInstitution&vid=34BNE_INST:CATALOGO"],
    ),
    "Субъективное ранжирование заменено жанрами, псевдонимом и конкретными статьями; расплывчатое «Статьи Фигаро» заменено библиографическими названиями."
  ),
  correction(
    "spain",
    "miguel_de_cervantes",
    {
      "birthDate": "1547",
      "works": [
        "El ingenioso hidalgo don Quijote de la Mancha",
        "Novelas ejemplares",
        "Los trabajos de Persiles y Sigismunda"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://cervantes.bne.es/ficheros/exposicion/ESTUDIOS/01_Una_vida_tras_la_sombra_de_un_mito.pdf"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/research/aniversario-cclxii-de-la-muerte-de-miguel-de-cervantes-saavedra-libro-compuesto-para-honrar-la-memoria-del-principe-de-los-ingenios-espanoles/003210b6-82b2-11df-acc7-002185ce6064.pdf"],
    ),
    "Оценочное «величайший» удалено; 29 сентября не является документированной датой рождения, а выводится из даты крещения и дня святого Михаила, поэтому в профиле оставлен только 1547 год."
  ),
  correction(
    "spain",
    "miguel_de_unamuno",
    {
      "works": [
        "Niebla",
        "Abel Sánchez",
        "San Manuel Bueno, mártir"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/unamuno-miguel"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://cervantesvirtual.com/portales/miguel_de_unamuno/autor_biografia/"],
    ),
    "Субъективное ранжирование и интерпретация тем заменены профессиями, литературной группой и произведениями."
  ),
  correction(
    "spain",
    "miguel_delibes",
    {
      "works": [
        "Cinco horas con Mario",
        "Los santos inocentes",
        "El camino"
      ]
    },
    sources(
      ["Fundación Miguel Delibes", "https://fundacionmigueldelibes.es/biografia/"],
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/delibes_miguel.htm"],
    ),
    "Субъективное ранжирование заменено профессиями, членством в RAE, произведениями и документированной премией."
  ),
  correction(
    "spain",
    "pío_baroja",
    {
      "works": [
        "El árbol de la ciencia",
        "Zalacaín el aventurero",
        "Las inquietudes de Shanti Andía"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://datos.bne.es/resource/XX842743"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/pio_baroja/autor_biografia/"],
    ),
    "Субъективная оценка заменена литературной принадлежностью; недостоверные или неточные названия «Лабиринт приключений» и «Зелёная площадь» удалены."
  ),
  correction(
    "spain",
    "rafael_alberti",
    {
      "works": [
        "Marinero en tierra",
        "Sobre los ángeles",
        "La arboleda perdida"
      ]
    },
    sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/alberti_rafael.htm"],
      ["Biblioteca Nacional de España", "https://datos.bne.es/persona/XX1719975.html"],
    ),
    "Субъективное ранжирование снято; ошибочные названия «О человеке и ангеле» и «Потерянная голубка» заменены оригиналами Sobre los ángeles и La arboleda perdida."
  ),
  correction(
    "spain",
    "ramon_del_valle_inclan",
    {
      "works": [
        "Tirano Banderas",
        "Luces de bohemia",
        "Sonatas"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/valle-inclan-ramon"],
      ["Cátedra Valle-Inclán - Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/catedra_valle_inclan/vida_ramon_valle/"],
    ),
    "Оценочная формула заменена конкретной ролью Luces de bohemia в оформлении эсперпенто и точными названиями произведений."
  ),
  correction(
    "spain",
    "teresa_de_avila",
    {
      "works": [
        "Libro de la vida",
        "Las moradas",
        "Camino de perfección"
      ]
    },
    sources(
      ["Biblioteca Nacional de España", "https://www.bne.es/es/autores/teresa-jesus-santa"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/santa_teresa_de_jesus/autor_biografia/"],
    ),
    "Субъективное ранжирование удалено; дата смерти 4 октября сохранена и снабжена необходимым пояснением о переходе с юлианского на григорианский календарь."
  ),
  correction(
    "sri_lanka",
    "anne_ranasinghe",
    {
      "works": [
        "And the Sun That Sucks the Earth to Dry",
        "Against Eternity and Darkness",
        "Not Even Shadows"
      ]
    },
    sources(
      ["Library of Congress", "https://www.loc.gov/acq/overseas-offices/delhi/salrp/anneranasinghe.html"],
      ["New Ceylon Writing", "https://newceylonwriting.com/wp-content/uploads/2020/03/ncw6final9jan2017lite-edited-on-4-march-2020.pdf"],
    ),
    "Субъективная заметность удалена; биографический контекст конкретизирован, а два неподтверждённых названия в профиле заменены документированными сборниками."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch50[];
