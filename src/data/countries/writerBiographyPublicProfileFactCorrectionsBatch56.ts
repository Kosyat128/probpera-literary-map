import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch56 = {
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
): WriterPublicProfileFactCorrectionBatch56 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch56 = [
  correction(
    "usa",
    "stephen_king",
    {
      "works": [
        "Оно",
        "Сияние",
        "Зелёная миля",
        "Рита Хейуорт, или Побег из Шоушенка"
      ]
    },
    sources(
      ["Stephen King — официальный сайт", "https://stephenking.com/the-author/"],
      ["National Endowment for the Arts", "https://www.arts.gov/honors/medals/stephen-king"],
    ),
    "Сняты непроверяемые оценки популярности и мастерства; жанры и примеры произведений приведены по институциональным источникам. Уточнено полное русское название повести о Рите Хейуорт."
  ),
  correction(
    "usa",
    "suzanne_collins",
    {
      "works": [
        "Голодные игры",
        "И вспыхнет пламя",
        "Сойка-пересмешница"
      ]
    },
    sources(
      ["Scholastic", "https://www.scholastic.com/teachers/teaching-tools/articles/authors/suzanne-collins.html"],
      ["Library of Congress", "https://loc.gov/loc/lcib/1011/authors.html"],
    ),
    "Исходные сведения подтверждены; исправлена грамматическая форма названия профессии и нормализована типографика. В профиль добавлены доказанные названия трёх основных романов цикла."
  ),
  correction(
    "usa",
    "theodore_dreiser",
    {
      "works": [
        "Сестра Керри",
        "Финансист",
        "Американская трагедия"
      ]
    },
    sources(
      ["University of Pennsylvania Libraries", "https://www.library.upenn.edu/collections/notable/theodore-dreiser-collection"],
      ["Library of Congress", "https://www.loc.gov/item/98031433/"],
    ),
    "Удалена субъективная иерархическая оценка; оставлены профессии и проверяемые названия романов."
  ),
  correction(
    "usa",
    "thomas_harris",
    {
      "works": [
        "Чёрное воскресенье",
        "Красный дракон",
        "Молчание ягнят",
        "Ганнибал"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/12046/thomas-harris/"],
      ["University of Mississippi Libraries", "https://egrove.olemiss.edu/exhibit/exhibits/murder-with-southern-hospitality/the-silence-of-the-lambs-thomas-harris-1988/"],
    ),
    "Смысл исходного текста подтверждён; формулировка о месте романа в цикле сделана точнее. В профиль добавлены только надёжно атрибутированные произведения."
  ),
  correction(
    "usa",
    "tim_powers",
    {
      "works": [
        "На странных волнах"
      ]
    },
    sources(
      ["Simon & Schuster", "https://www.simonandschuster.com/authors/Tim-Powers/2140708258"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/24419/tim-powers/"],
    ),
    "Факты исходной карточки подтверждены; в профиль добавлено доказанное произведение."
  ),
  correction(
    "usa",
    "tom_clancy",
    {
      "works": [
        "Охота за «Красным Октябрём»"
      ]
    },
    sources(
      ["U.S. Naval Institute", "https://www.usni.org/people/thomas-clancy"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/5003/tom-clancy/"],
    ),
    "Исходные сведения подтверждены; унифицированы пунктуация и типографика. В профиль добавлен дебютный роман."
  ),
  correction(
    "usa",
    "winston_groom",
    {
      "works": [
        "Форрест Гамп"
      ]
    },
    sources(
      ["Alabama Heritage", "https://www.alabamaheritage.com/authors/authors-g/winston-groom/"],
      ["Groom family obituary via Mobile Register", "https://obits.al.com/us/obituaries/mobile/name/winston-groom-obituary?id=7474034"],
    ),
    "Исходная характеристика подтверждена и конкретизирована документированным романом; профильные даты согласуются с семейным некрологом."
  ),
  correction(
    "uzbekistan",
    "abdulla_qahhor",
    {
      "works": [
        "Мираж",
        "Синчалак",
        "Сказки о прошлом"
      ]
    },
    sources(
      ["Uzbekistan National News Agency", "https://uza.uz/oz/posts/adib-tilidagi-kishini-maftun-qiladigan-birinchi-xislat_636348"],
      ["Alisher Navo‘i Tashkent State University of Uzbek Language and Literature", "https://aphil.tsuull.uz/index.php/language-and-culture/article/view/39"],
    ),
    "Оценочные слова «классик» и «мастер» заменены проверяемыми видами деятельности и конкретными произведениями; обобщённое поле «Рассказы» удалено."
  ),
  correction(
    "uzbekistan",
    "cholpon",
    {
      "name": "Абдулхамид Чулпан",
      "birthDate": "1897"
    },
    sources(
      ["Uzbekistan National News Agency", "https://uza.uz/en/posts/cholponning-fojiali-taqdirini-yodga-soluvchi-hujjat-uning-pasporti-qayerda_308583"],
      ["Tashkent State University of Oriental Studies", "https://aps.tsuos.uz/storage/users/137/books/BQFLHBGLEJ4u5i92oGevFZHAfPPSEyKQxi7zYJaG.pdf"],
    ),
    "Удалена ранговая оценка; восстановлено полное имя и перечислены доказанные виды деятельности. Надёжные институциональные источники подтверждают 1897 год, но не единообразно подтверждают точный день рождения, поэтому точность снижена до года."
  ),
  correction(
    "uzbekistan",
    "erkin_vohidov",
    {
      "works": [
        "Nido",
        "Ruhlar isyoni",
        "Oltin devor",
        "Istanbul fojiasi"
      ]
    },
    sources(
      ["Uzbekistan National News Agency", "https://uza.uz/uz/posts/istiqlol-kuychisi_673118"],
      ["Erkin Vohidov Memorial Park", "https://erkinvohidovpark.uz/uz"],
    ),
    "Исходное описание расширено доказанными видами деятельности и произведениями. Неоднозначное обобщённое название «Слово» заменено четырьмя названиями на языке оригинала, которые оба источника прямо атрибутируют автору."
  ),
  correction(
    "uzbekistan",
    "gafur_gulyam",
    {
      "works": [
        "Шум бола"
      ]
    },
    sources(
      ["Uzbekistan National News Agency", "https://uza.uz/en/posts/gafur-gulom-uy-muzeyidan-fotoreportaj_688750"],
      ["Alisher Navo‘i Tashkent State University of Uzbek Language and Literature", "https://tsuull.uz/sites/default/files/anjuman_materiallari._19.11._2020.pdf"],
    ),
    "Оценочное «известный» заменено проверяемыми видами деятельности; нормализовано раздельное написание названия повести."
  ),
  correction(
    "uzbekistan",
    "hamid_ismailov",
    {
      "works": [
        "Железная дорога",
        "Мёртвое озеро",
        "Подземка"
      ]
    },
    sources(
      ["National Book Foundation", "https://www.nationalbook.org/people/hamid-ismailov/"],
      ["European Bank for Reconstruction and Development", "https://www.ebrd.com/home/news-and-events/news/2019/the-devils-dance-wins-the-2019-ebrd-literature-prize.html"],
    ),
    "Удалена оценка «международного уровня»; уточнены профессии, языки и библиография. Не подтверждённое источниками название «Дорога в Самарканд» удалено."
  ),
  correction(
    "uzbekistan",
    "mahmudhoja_behbudi",
    {
      "birthDate": "1875",
      "deathDate": ""
    },
    sources(
      ["Turkiston Muxtoriyati memorial portal", "https://muxtoriyat.uz/index.php/en-us/members-of-the-government/members-of-the-national-assembly?catid=42&id=385&view=article"],
      ["Directorate for Culture and Arts under the Cabinet of Ministers of Uzbekistan", "https://dkm.gov.uz/ru/mamudhuza-bebudij"],
    ),
    "Категоричное утверждение об основании отдельной «джадидской литературы» заменено проверяемой связью с движением. Точный день рождения в официальных источниках расходится, а 25 марта 1919 года один из них называет днём захвата, не смерти; поэтому профиль снижен до 1875 года, а точная дата смерти очищена fail-closed."
  ),
  correction(
    "uzbekistan",
    "odil_yoqubov",
    {
      "years": "1926/1927-2009",
      "birthDate": "",
      "works": [
        "Сокровище Улугбека"
      ]
    },
    sources(
      ["Uzbekistan National News Agency", "https://uza.uz/en/posts/odil-yoqubov-mohir-tarjimon-munaqqid-va-publitsist-xotirasi_417713"],
      ["UniLibrary Uzbekistan", "https://api.unilibrary.uz/storage/PublisherResourceFile/231678/images/1676014705.pdf"],
    ),
    "Субъективная ранговая оценка удалена; название романа нормализовано. Источники прямо фиксируют противоречие между документальной датой 20 октября 1926 года и биографическим 1927 годом, поэтому поле рождения очищено, а диапазон лет сохраняет обе версии fail-closed."
  ),
  correction(
    "vanuatu",
    "grace_mera_molisa",
    {
      "birthDate": "1946-02-17",
      "deathDate": "2002-01-04"
    },
    sources(
      ["Poetry Foundation", "https://www.poetryfoundation.org/poets/grace-mera-molisa"],
      ["Australian Department of Foreign Affairs and Trade", "https://www.dfat.gov.au/sites/default/files/focus-magazine-june-2002.pdf"],
      ["University of Canterbury Library", "https://libcat.canterbury.ac.nz/Record/520750"],
    ),
    "Удалены оценочные формулы и широкое тематическое обобщение; оставлены проверяемые роли и книга. Обе профильные даты исправлены: исходные 17 января 1946 и 20 января 2002 года не подтверждаются источниками."
  ),
  correction(
    "venezuela",
    "adriano_gonzalez_leon",
    {
      "birthDate": "1931-11-14",
      "works": [
        "País portátil",
        "Las hogueras más altas",
        "Viejo"
      ]
    },
    sources(
      ["Centro Virtual Cervantes", "https://cvc.cervantes.es/el_rinconete/anteriores/junio_08/27062008_02.asp"],
      ["Ministry of Culture of Venezuela", "https://www.mincultura.gob.ve/noticias/14-de-noviembre-nace-adriano-gonzalez-leon/"],
    ),
    "Сняты оценочные и неподтверждённые профессиональные характеристики; дата рождения исправлена с 13 на 14 ноября 1931 года, а ошибочные русские названия произведений заменены оригинальными доказанными названиями."
  ),
  correction(
    "venezuela",
    "andres_bello",
    {
      "works": [
        "Gramática de la lengua castellana destinada al uso de los americanos",
        "Alocución a la poesía",
        "Silva a la agricultura de la zona tórrida"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/andres_bello/autor_apunte/"],
      ["University of Chile", "https://uchile.cl/presentacion/historia/rectores-de-la-u-de-chile/andres-bello-lopez-1843-1865"],
    ),
    "Удалены ранговые и расплывчатые утверждения; оставлены конкретные роли, ректорство и издание грамматики. Обобщённые названия работ заменены библиографически установленными."
  ),
  correction(
    "venezuela",
    "arturo_uslar_pietri",
    {
      "works": [
        "Las lanzas coloradas",
        "El camino de El Dorado",
        "Oficio de difuntos"
      ]
    },
    sources(
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/arturo_uslar_pietri/autor_biografia/"],
      ["Princess of Asturias Foundation", "https://www.fpa.es/es/premios-princesa-de-asturias/premiados/?identificador=537&texto=trayectoria"],
    ),
    "Удалены оценочные формулировки и широкое утверждение о влиянии; ошибочное «Чёрное золото» заменено доказанными произведениями, названия оставлены в оригинале во избежание ложной переводной атрибуции."
  ),
  correction(
    "venezuela",
    "eduardo_blanco",
    {
      "deathDate": "1912-01-30",
      "works": [
        "Venezuela heroica",
        "Zárate"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/b/blanco-eduardo/"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/descargaPdf/quienes-escriben-en-venezuela-diccionario-abreviado-de-escritores-venezolanos-siglos-xviii-a-xxi--0/021555_7.pdf"],
    ),
    "Удалены ранговая оценка, недоказанное обобщение тематики и не подтверждённое источниками определение «Venezuela heroica» как цикла; неверная дата смерти 30 июня заменена на 30 января 1912 года, а ошибочное произведение — на доказанный роман."
  ),
  correction(
    "venezuela",
    "eugenio_montejo",
    {
      "name": "Эухенио Монтехо",
      "deathDate": "",
      "deathPlace": "",
      "works": [
        "Élegos",
        "Muerte y memoria",
        "Terredad",
        "Trópico absoluto"
      ]
    },
    sources(
      ["Fundación Empresas Polar", "https://bibliofep.fundacionempresaspolar.org/media/16771/coleccion_lenguaje_lw_fasciculo_25.pdf"],
      ["National Autonomous University of Mexico", "https://periodicodepoesia.unam.mx/010-entrevistas-eugenio-montejo/"],
      ["University of Carabobo", "https://poesia.uc.edu.ve/el-acertijo-de-un-sueno-eugenio-montejo-y-las-nubes/"],
    ),
    "Убраны субъективная оценка и недоказанное тематическое толкование; имя передано по испанскому произношению, а сомнительные русские названия заменены оригинальными. Источники расходятся в точном дне и месте смерти, поэтому оба профильных поля очищены fail-closed."
  ),
  correction(
    "venezuela",
    "fermin_toro",
    {
      "works": [
        "Los mártires",
        "La viuda de Corinto",
        "Reflexiones sobre la Ley del 10 de abril de 1834"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/t/toro-fermin/"],
      ["Biblioteca Abierta Venezolana", "https://bibav.org/books/los-martires-toro-2017-6sduxnsc.html"],
    ),
    "Удалены оценочные и жанрово-исторические обобщения; три неатрибутируемых названия профиля заменены документированными произведениями."
  ),
  correction(
    "venezuela",
    "juan_vicente_gonzalez",
    {
      "works": [
        "Biografía del general José Félix Ribas",
        "Manual de historia universal",
        "Mesenianas"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/g/gonzalez-juan-vicente/"],
      ["Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb32180515w"],
    ),
    "Непроверяемое утверждение об основании национальной исторической прозы удалено; профессии и конкретные труды подтверждены."
  ),
  correction(
    "venezuela",
    "manuel_diaz_rodriguez",
    {
      "years": "1871-1927",
      "birthDate": "1871-02-28",
      "birthPlace": "Чакао, Венесуэла",
      "deathDate": "",
      "works": [
        "Ídolos rotos",
        "Sangre patricia",
        "Camino de perfección"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/d/diaz-rodriguez-manuel/"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/ruben_dario/obra/el-movimiento-de-los-nombres-en-idolos-rotos-de-manuel-diaz-rodriguez/"],
      ["National Library of Spain", "https://datos.bne.es/resource/XX881051"],
    ),
    "Удалена ранговая оценка; год и дата рождения исправлены с 1868 на 1871 год, место рождения — на Чакао, а неверные переводные названия заменены оригинальными. Авторитетная историческая энциклопедия указывает 23 августа 1927 года вместо 24 августа в исходном профиле; при отсутствии второго независимого подтверждения дневная точность очищена fail-closed."
  ),
  correction(
    "venezuela",
    "miguel_otero_silva",
    {
      "works": [
        "Casas muertas",
        "Cuando quiero llorar no lloro",
        "Lope de Aguirre, príncipe de la libertad"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/o/otero-silva-miguel/"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/descargaPdf/quienes-escriben-en-venezuela-diccionario-abreviado-de-escritores-venezolanos-siglos-xviii-a-xxi--0/021555_7.pdf"],
    ),
    "Удалены субъективная оценка и неподтверждённое обобщение тематики; «Путь к Эльдорадо», принадлежащий Артуро Услару Пьетри, заменён романом самого Отеро Сильвы."
  ),
  correction(
    "venezuela",
    "rafael_cadenas",
    {
      "works": [
        "Los cuadernos del destierro",
        "Falsas maniobras",
        "Intemperie",
        "Memorial"
      ]
    },
    sources(
      ["Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/cadenas_rafael.htm"],
      ["Ministry of Culture of Spain", "https://www.cultura.gob.es/mcd/actualidad/2023/04/230424-premio-cervantes-2022.html"],
    ),
    "Удалены ранговая оценка и интерпретация стиля; добавлены документированные роли и премия. Сомнительные русские названия заменены оригинальными библиографическими названиями."
  ),
  correction(
    "venezuela",
    "romulo_gallegos",
    {
      "works": [
        "Doña Bárbara",
        "Cantaclaro",
        "Canaima"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/g/gallegos-romulo/"],
      ["Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/portal_nacional_venezuela/obra/dona-barbara--1/"],
    ),
    "Удалены ранговая и каноническая оценки; добавлена проверяемая президентская должность. Ошибочное «Поднимающийся ветер» заменено доказанным романом «Cantaclaro»."
  ),
  correction(
    "venezuela",
    "simon_rodriguez",
    {
      "deathPlace": "Амотапе, Перу",
      "works": [
        "Sociedades americanas en 1828",
        "Luces y virtudes sociales"
      ]
    },
    sources(
      ["Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/r/rodriguez-simon/"],
      ["Real Academia de la Historia", "https://historia-hispanica.rah.es/biografias/39456-simon-rodriguez"],
    ),
    "Расплывчатое тематическое резюме заменено двумя конкретными трудами; характеристика наставничества уточнена до документированного учительства. Опечатка в месте смерти «Амота» исправлена на подтверждённое источниками «Амотапе»."
  ),
  correction(
    "venezuela",
    "teresa_de_la_parra",
    {
      "works": [
        "Ifigenia",
        "Las memorias de Mamá Blanca"
      ]
    },
    sources(
      ["Instituto Cervantes", "https://cervantes.org/es/sobre-nosotros/publicaciones/teresa-parra-textos-recuperados"],
      ["Fundación Empresas Polar", "https://bibliofep.fundacionempresaspolar.org/media/1378306/1venezuela_en_la_literatura_190-376.pdf"],
    ),
    "Удалена субъективная оценка значимости; конкретизированы место рождения, связь с Венесуэлой и два романа. Названия в профиле приведены в оригинальной библиографической форме."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch56[];
