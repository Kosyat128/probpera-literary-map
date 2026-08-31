import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch55 = {
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
): WriterPublicProfileFactCorrectionBatch55 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch55 = [
  correction(
    "usa",
    "george_saunders",
    {
      "works": [
        "Линкольн в бардо"
      ]
    },
    sources(
      ["Syracuse University", "https://artsandsciences.syracuse.edu/people/faculty/saunders-george/"],
      ["The Booker Prizes", "https://thebookerprizes.com/the-booker-library/prize-years/2017"],
    ),
    "Исходные два предложения нейтральны и точны: премиальный архив подтверждает, что «Линкольн в бардо» был первым романом Сондерса и победил в 2017 году."
  ),
  correction(
    "usa",
    "gillian_flynn",
    {
      "works": [
        "Исчезнувшая",
        "Острые предметы",
        "Тёмные тайны"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/70462/gillian-flynn/"],
      ["Hachette UK", "https://www.hachette.co.uk/contributor/gillian-flynn/"],
    ),
    "Исправлено согласование рода у слова «сценаристка» и добавлены проверяемые сведения о других романах и работе над сценарием экранизации."
  ),
  correction(
    "usa",
    "harper_lee",
    {
      "fullName": "Нелл Харпер Ли",
      "works": [
        "Убить пересмешника",
        "Пойди, поставь сторожа"
      ]
    },
    sources(
      ["National Endowment for the Arts", "https://www.arts.gov/initiatives/nea-big-read/kill-mockingbird"],
      ["The Pulitzer Prizes", "https://www.pulitzer.org/winners/harper-lee"],
    ),
    "Оценочная формула заменена датами, названиями и документированным решением Пулитцеровского комитета; категория Fiction передана как «за художественную литературу», в профиль возвращено главное произведение и добавлено полное имя."
  ),
  correction(
    "usa",
    "henry_james",
    {
      "nationality": "американец; с 1915 года - британский подданный"
    },
    sources(
      ["Smithsonian National Portrait Gallery", "https://npg.si.edu/object/npg_NPG.68.13"],
      ["National Portrait Gallery, London", "https://www.npg.org.uk/collections/search/person/mp02396/henry-james"],
    ),
    "Субъективное ранжирование заменено гражданской биографией и конкретными произведениями; уточнено позднее британское подданство."
  ),
  correction(
    "usa",
    "herman_melville",
    {
      "works": [
        "Моби Дик, или Белый кит",
        "Билли Бадд",
        "Тайпи"
      ]
    },
    sources(
      ["U.S. National Park Service", "https://www.nps.gov/nebe/learn/historyculture/hermanmelville.htm"],
      ["Library of Congress", "https://www.loc.gov/exhibits/america-reads/1750-to-1899.html#obj006"],
    ),
    "Неизмеримая оценка романа заменена датами, названием и связью произведений с морским опытом; «Моби Дик» добавлен в список работ профиля."
  ),
  correction(
    "usa",
    "howard_pyle",
    {
      "years": "1853-1911",
      "birthPlace": "Уилмингтон, Делавэр, США",
      "deathPlace": "Флоренция, Италия",
      "works": [
        "Весёлые приключения Робин Гуда",
        "Книга пиратов"
      ]
    },
    sources(
      ["Delaware Art Museum", "https://emuseum.delart.org/people/75/howard-pyle"],
      ["Smithsonian American Art Museum", "https://americanart.si.edu/artist/howard-pyle-6495"],
    ),
    "Добавлены подтверждённые годы, места жизни и более точный диапазон тем; годовые данные и произведения внесены в ранее пустые поля профиля без вымышленных дня и месяца."
  ),
  correction(
    "usa",
    "hunter_s_thompson",
    {
      "deathPlace": "Вуди-Крик, Колорадо, США",
      "works": [
        "Страх и отвращение в Лас-Вегасе"
      ]
    },
    sources(
      ["EBSCO Research Starters", "https://www.ebsco.com/research-starters/biography/hunter-s-thompson"],
      ["Associated Press", "https://apnews.com/article/822157ef1079bbcd8419254a5c03ea73"],
    ),
    "Исходная характеристика нейтрально и точно описывает документированную роль Томпсона в гонзо-журналистике и её форму; в профиль добавлены место смерти и ключевая книга."
  ),
  correction(
    "usa",
    "isaac_asimov",
    {
      "years": "1919/1920-1992",
      "birthDate": ""
    },
    sources(
      ["Asimov's Science Fiction", "https://www.asimovs.com/wp-content/uploads/2022/09/Editorial_Happy_Birthday_Isaac_Asimov_JanFeb2020.pdf"],
      ["Boston University", "https://www.bu.edu/articles/2020/pov-why-isaac-asimovs-novels-speak-to-us-today/"],
    ),
    "Убрано оценочное ранжирование и раскрыта принципиальная неопределённость даты рождения: 2 января было выбранным днём празднования, а не доказанной датой. Точное поле рождения очищено fail-closed."
  ),
  correction(
    "usa",
    "isaac_bashevis_singer",
    {
      "years": "ок. 1903-1991",
      "birthDate": "",
      "deathPlace": "Серфсайд, Флорида, США"
    },
    sources(
      ["Isaac Bashevis Singer Estate", "https://www.bashevissinger.com/biography"],
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1978/singer/biographical/"],
    ),
    "Поэтическая интерпретация заменена проверяемой биографией. Точная дата 21 ноября 1903 года очищена: официальный сайт наследия указывает 1903 год, а Нобелевский архив - 14 июля 1904 года; год оставлен приблизительным."
  ),
  correction(
    "usa",
    "james_rollins",
    {
      "fullName": "Джим Чайковски (Jim Czajkowski; псевдоним Джеймс Роллинс)",
      "works": [
        "Царство костей"
      ]
    },
    sources(
      ["Veterinary Practice News", "https://www.veterinarypracticenews.com/a-veterinarian-with-write-stuff-james-rollins-dvm/"],
      ["James Rollins official site", "https://jamesrollins.com/bio/"],
    ),
    "Имя приведено в форме, подтверждённой профессиональным источником, и добавлена документированная ветеринарная специальность; существующая атрибуция личности подтверждена, held не требуется."
  ),
  correction(
    "usa",
    "jerome_david_salinger",
    {
      "fullName": "Джером Дэвид Сэлинджер",
      "works": [
        "Над пропастью во ржи",
        "Девять рассказов",
        "Фрэнни и Зуи"
      ]
    },
    sources(
      ["The New York Public Library", "https://www.nypl.org/blog/2010/01/28/jd-salinger-1919-2010"],
      ["The Morgan Library & Museum", "https://www.themorgan.org/exhibitions/letters-by-salinger"],
    ),
    "Вместо описательного намёка названы точно атрибутированные произведения; неточная единая жанровая маркировка «Фрэнни» и «Зуи» убрана, в профиль внесены полное имя и отсутствующие ключевые работы."
  ),
  correction(
    "usa",
    "john_dos_passos",
    {
      "works": [
        "Манхэттенский трансфер",
        "США"
      ]
    },
    sources(
      ["Library of America", "https://www.loa.org/writers/241-john-dos-passos/"],
      ["Johns Hopkins University Libraries", "https://aspace.library.jhu.edu/repositories/3/resources/1160"],
    ),
    "Общие ярлыки модернизма и экспериментальности заменены датами и конкретной библиографией; исправлен неполный заголовок «Манхэттен» на «Манхэттенский трансфер»."
  ),
  correction(
    "usa",
    "john_irving",
    {
      "years": "1942-",
      "birthPlace": "Эксетер, Нью-Гэмпшир, США",
      "works": [
        "Мир глазами Гарпа",
        "Правила виноделов",
        "Молитва об Оуэне Мини"
      ]
    },
    sources(
      ["John Irving official site", "https://john-irving.com/john-irving-bio/"],
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/14109/john-irving/"],
    ),
    "Оба исходных утверждения точны и нейтральны; в профиль добавлены подтверждённые год и место рождения и основные произведения без неподтверждённого дня рождения."
  ),
  correction(
    "usa",
    "john_steinbeck",
    {
      "works": [
        "Гроздья гнева",
        "О мышах и людях",
        "К востоку от Эдема"
      ]
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1962/steinbeck/biographical/"],
      ["National Steinbeck Center", "https://steinbeck.org/learn/"],
    ),
    "Расплывчатая формула «известный произведениями» и тематическое обобщение заменены датами, конкретными романами и подтверждённой Нобелевской премией; список произведений дополнен."
  ),
  correction(
    "usa",
    "kurt_vonnegut",
    {
      "works": [
        "Бойня номер пять, или Крестовый поход детей",
        "Колыбель для кошки",
        "Сирены Титана"
      ]
    },
    sources(
      ["Kurt Vonnegut Museum and Library", "https://www.vonnegutlibrary.org/biography/"],
      ["Library of America", "https://www.loa.org/writers/249-kurt-vonnegut"],
    ),
    "Расплывчатая оценочная формула «известный» заменена датами и конкретными романами; список произведений дополнен романом «Бойня номер пять»."
  ),
  correction(
    "usa",
    "louise_gluck",
    {
      "deathPlace": "Кембридж, Массачусетс, США"
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2020/gluck/"],
      ["Yale University", "https://news.yale.edu/2020/10/08/louise-gluck-awarded-2020-nobel-prize-literature"],
    ),
    "Цитатно-оценочная формулировка мотивации Нобелевской премии заменена нейтральными фактами о темах, книгах и наградах; добавлено подтверждённое место смерти."
  ),
  correction(
    "usa",
    "mario_puzo",
    {
      "works": [
        "Крёстный отец"
      ]
    },
    sources(
      ["Mario Puzo official library", "https://www.mariopuzo.com/"],
      ["Academy of Motion Picture Arts and Sciences", "https://www.oscars.org/collection-highlights/godfather?fid=57041"],
    ),
    "Обобщённая тематическая интерпретация заменена конкретными произведениями и документированными сценарными наградами; в пустой список работ добавлен роман."
  ),
  correction(
    "usa",
    "mark_danielewski",
    {
      "works": [
        "Дом листьев"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/books/36526/house-of-leaves-by-mark-z-danielewski/"],
      ["Mark Z. Danielewski official site", "https://www.markzdanielewski.com/books-new"],
    ),
    "Исходные утверждения нейтральны и точно подтверждаются издательским описанием необычной верстки и официальной библиографией; произведение добавлено в пустой профильный список."
  ),
  correction(
    "usa",
    "mark_twain",
    {
      "fullName": "Сэмюэл Лэнгхорн Клеменс"
    },
    sources(
      ["Library of Congress", "https://guides.loc.gov/world-of-1898/mark-twain"],
      ["National Endowment for the Arts", "https://www.arts.gov/sites/default/files/Reader-Resources-AdventuresofTomSawyer.pdf"],
    ),
    "Оценочное ранжирование заменено настоящим именем, датами и произведениями; полное имя добавлено в профиль."
  ),
  correction(
    "usa",
    "michael_connelly",
    {
      "works": [
        "Пятый свидетель"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/5522/michael-connelly/"],
      ["Hachette Book Group", "https://www.hachettebookgroup.com/contributor/michael-connelly/?lens=mulholland-books"],
    ),
    "Исходные факты точны и нейтральны: издатели подтверждают прежнюю журналистскую работу, криминальные циклы и принадлежность «The Fifth Witness» к серии о Микки Холлере."
  ),
  correction(
    "usa",
    "michael_crichton",
    {
      "works": [
        "Парк юрского периода"
      ]
    },
    sources(
      ["Michael Crichton official site", "https://michaelcrichton.com/biography/"],
      ["Harvard Gazette", "https://news.harvard.edu/gazette/story/2002/04/crichton-informative-and-candid-at-hms/"],
    ),
    "Общая жанровая формула заменена биографическим фактом и конкретными произведениями, подтверждёнными официальным архивом и Гарвардом."
  ),
  correction(
    "usa",
    "min_jin_lee",
    {
      "works": [
        "Патинко",
        "Бесплатная еда для миллионеров"
      ]
    },
    sources(
      ["Min Jin Lee official site", "https://www.minjinlee.com/about"],
      ["Columbia University", "https://weai.columbia.edu/sites/default/files/content/pics/75th%20Anniversary/Min%20Jin%20Lee%20Bio.pdf"],
    ),
    "Убрано непроверенное в использованных источниках утверждение о конкретном русском издательском названии и добавлены подтверждённые происхождение и второй роман."
  ),
  correction(
    "usa",
    "n_k_jemisin",
    {
      "name": "Н. К. Джемисин",
      "fullName": "Нора Кейта Джемисин",
      "works": [
        "Пятое время года",
        "Врата обелиска",
        "Каменные небеса"
      ]
    },
    sources(
      ["MacArthur Foundation", "https://www.macfound.org/fellows/class-of-2020/n-k-jemisin"],
      ["The Hugo Awards", "https://www.thehugoawards.org/2016/08/2016-hugo-awards-announced/"],
      ["Science Fiction and Fantasy Writers Association", "https://nebulas.sfwa.org/grand-masters/n-k-jemisin/"],
    ),
    "Исправлено ошибочное раскрытие имени «Нора Кейт»: профессиональная ассоциация приводит Nora Keita, а публичная форма - N. K. Jemisin. Добавлено точное жанровое и премиальное описание; в профиль внесены имя и три романа цикла."
  ),
  correction(
    "usa",
    "patricia_highsmith",
    {
      "fullName": "Мэри Патриция Плэнгман (Патриция Хайсмит)",
      "years": "1921-1995",
      "birthDate": "1921-01-19",
      "deathDate": "1995-02-04",
      "birthPlace": "Форт-Уэрт, Техас, США",
      "deathPlace": "Локарно, Швейцария",
      "works": [
        "Талантливый мистер Рипли"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/12941/patricia-highsmith/"],
      ["Library of America", "https://womencrime.loa.org/writers/patricia-highsmith/"],
    ),
    "Расплывчатая формула «известная» заменена датами, конкретными романами и проверяемым числом книг о Томе Рипли; ранее пустые профильные поля заполнены документированными данными."
  ),
  correction(
    "usa",
    "pearl_s_buck",
    {
      "deathPlace": "Дэнби, Вермонт, США"
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1938/buck/biographical/"],
      ["West Virginia University", "https://pearlsbuck.lib.wvu.edu/biography"],
    ),
    "Субъективная формула о способе изображения Китая заменена проверяемыми сведениями о биографии, трилогии и Нобелевской премии; добавлено место смерти."
  ),
  correction(
    "usa",
    "philip_roth",
    {
      "works": [
        "Американская пастораль",
        "Людское клеймо",
        "Заговор против Америки",
        "Прощай, Коламбус"
      ]
    },
    sources(
      ["Library of Congress", "https://www.loc.gov/programs/poetry-and-literature/prizes/fiction-prize/item/n79125808/philip-roth/"],
      ["Library of America", "https://www.loa.org/writers/260-philip-roth/"],
    ),
    "Оценочное ранжирование заменено произведениями и официально зафиксированной наградой; существующие даты профиля подтверждены."
  ),
  correction(
    "usa",
    "ralph_ellison",
    {
      "years": "1913/1914-1994",
      "birthDate": ""
    },
    sources(
      ["Library of Congress", "https://www.loc.gov/item/n50010027/ralph-ellison/"],
      ["Library of America", "https://www.loa.org/writers/681-ralph-ellison/"],
    ),
    "Оценочная формула заменена датой романа и наградой. Точная дата рождения очищена fail-closed: Библиотека Конгресса использует 1914 год, а Library of America - 1913 год; диапазон отражён в поле years."
  ),
  correction(
    "usa",
    "ransom_riggs",
    {
      "works": [
        "Дом странных детей мисс Перегрин"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/authors/130726/ransom-riggs/"],
      ["Simon & Schuster", "https://www.simonandschuster.com/books/Miss-Peregrines-Home-for-Peculiar-Children/Ransom-Riggs/Miss-Peregrines-Peculiar-Children/9781594744761"],
    ),
    "Исходные два предложения точны и нейтральны; год рождения намеренно не добавляется, поскольку использованные официальные профили его не приводят."
  ),
  correction(
    "usa",
    "ray_bradbury",
    {
      "works": [
        "451° по Фаренгейту",
        "Марсианские хроники",
        "Вино из одуванчиков"
      ]
    },
    sources(
      ["Library of Congress", "https://www.loc.gov/item/n79139258/ray-bradbury/"],
      ["Library of America", "https://www.loa.org/writers/770-ray-bradbury/"],
    ),
    "Оценочное ранжирование заменено произведениями и документированными видами литературной работы; ключевые книги добавлены в неполный список профиля."
  ),
  correction(
    "usa",
    "richard_matheson",
    {
      "name": "Ричард Матесон",
      "works": [
        "Я - легенда",
        "Куда приводят мечты"
      ]
    },
    sources(
      ["Penguin Random House", "https://www.penguinrandomhouse.com/books/812138/i-am-legend-by-richard-matheson-foreword-by-joe-r-lansdale/"],
      ["Science Fiction and Fantasy Writers Association", "https://sfwa.org/2013/06/25/in-memoriam-richard-matheson/"],
    ),
    "Неизмеримая характеристика влияния заменена произведениями и сценарными работами; русское имя и список книг приведены к согласованной форме."
  ),
  correction(
    "usa",
    "robert_ludlum",
    {
      "years": "1927-2001",
      "birthPlace": "Нью-Йорк, США",
      "works": [
        "Идентификация Борна",
        "Превосходство Борна",
        "Ультиматум Борна"
      ]
    },
    sources(
      ["Macmillan", "https://us.macmillan.com/author/robertludlum/"],
      ["Robert Ludlum official site", "https://robertludlum.com/allbooks/bourne-series/"],
    ),
    "Исходные утверждения нейтральны и подтверждены двумя издательскими источниками; в ранее пустые поля внесены только годовые и библиографические данные."
  ),
  correction(
    "usa",
    "saul_bellow",
    {
      "deathPlace": "Бруклайн, Массачусетс, США"
    },
    sources(
      ["Nobel Prize Outreach", "https://www.nobelprize.org/laureate/652"],
      ["University of Chicago Library", "https://www.lib.uchicago.edu/e/scrc/findingaids/view.php?eadid=ICU.SPCL.BELLOWS"],
    ),
    "Литературно-критическая интерпретация заменена местами жизни, произведениями и наградой; добавлено официально указанное место смерти."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch55[];
