# QA фактов в коротких русских биографиях писателей

Источник данных: `sha256:4b18c58b507b96e3edfea5c591c6f9f2f941988b9debde8c082cd17707763824`. Отчёт детерминирован: в нём нет текущей даты и при неизменных входных файлах он воспроизводится побайтно.

> Этот аудит не маркирует карточки, не меняет тексты и не утверждает, что весь корпус фактологически проверен. Он выполняет полную автоматическую инвентаризацию, находит внутренние противоречия и строит очередь ручной сверки.

## Покрытие

- Карточек и русских bio проверено алгоритмом: 1684; bio присутствует: 1684.
- Надёжных identity-match с локальным staging: 238.
- Из них source-confirmed structured cross-check: 237 (14.1%).
- Offline Wikidata snapshot содержит candidate QID для 1410 карточек, но label+birth-year identity corroborated только у 1190 (70.7% корпуса); identity-discrepant: 0, требуют дополнительной identity-проверки: 220.
- Сопоставлено полей дат со snapshot: 2271; exact Gregorian: 1821; совместимы при общей precision: 206; несовместимых строк после curated resolutions: 44. Из них 13 сначала требуют identity repair, а 23 - современные referenced-противоречия для проверки по авторитетному источнику.
- Ручных source-resolution с сохранёнными доказательствами: 74 в 62 карточках.
- Карточек с high-confidence противоречиями: 0; отдельных противоречий: 0.
- Отдельно допустимые календарные/precision/source расхождения: 0 карточек, 0 полей.
- Metadata gaps (это не доказанные ошибки): 0.
- Bio, где хотя бы один тип утверждений всё ещё требует выбранного человеком источника: 1678.
- Статусов `reviewed`/`verified`, UI-плашек и текстов изменено: 0.

## Типы утверждений во всём корпусе

- `awards`: 112
- `critical-ranking`: 2
- `identity-role`: 1628
- `language`: 208
- `life-dates`: 790
- `movement-era`: 61
- `national-cultural-affiliation`: 1084
- `nobel`: 124
- `places`: 55
- `priority-claim`: 91
- `reception-influence`: 17
- `themes-style`: 391
- `works`: 1503

## High-confidence противоречия

Сюда попадают только внутренние конфликты (например, bio/years/nobelYear против структурированного поля) и расхождения **года** с source-confirmed staging при надёжном identity-match. Wikidata candidate-расхождения сюда намеренно не включаются до отдельной label+birth-year identity validation; поэтому ноль в этой таблице не означает отсутствия snapshot-очереди ниже. Значения не исправляются автоматически.

| Ключ | Писатель | Поле | Код | Значения | Безопасный кандидат исправления |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | Не найдено | Исправление не требуется |

## Календарные и source-precision расхождения

Эти записи совпадают по году, но расходятся по месяцу или дню. Причиной может быть старый/новый стиль, неполная точность источника или ошибка данных. Они не считаются доказанной ошибкой текста.

| Ключ | Писатель | Поле | Код | Значения | Безопасный кандидат исправления |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | Не найдено | Исправление не требуется |

## Разрешённые расхождения с более сильным источником

Эти записи не считаются ошибками карточки: указанное значение вручную сопоставлено с более прямым или авторитетным источником. Решение ограничено конкретным полем и не означает полной проверки bio.

| Ключ | Поле | Значение карточки | Staging | Решение | Источники |
| --- | --- | --- | --- | --- | --- |
| `angola:pepetela` | `birthDate` | `1941-10-19` | `1941-10-19` | corrected-card | Пепетела - Большая российская энциклопедия: https://old.bigenc.ru/text/2711021 |
| `armenia:narine_abgaryan` | `birthDate` | `1971-01-14` | `1971-01-14` | corrected-card | Наринэ Абгарян - издательство АСТ: https://ast.ru/authors/abgaryan-narine-ast011330/ |
| `bosnia:mehmed_beg_kapetanovic` | `deathDate` | `1902-07-29` | `` | retain-current-card | Mehmed-beg Kapetanović Ljubušak - ANUBiH: https://bastina.anubih.ba/bitstreams/8a324c15-6395-44c8-a07b-6daa7c61339a/download; Kapetanović Ljubušak, Mehmed-beg - Hrvatska enciklopedija: https://www.enciklopedija.hr/clanak/kapetanovic-ljubusak-mehmed-beg |
| `cambodia:rim_kin` | `birthDate` | `1911-11-08` | `1911-01-01` | corrected-card | Rim, Kin (1911-1959) - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark:/12148/cb12285967d |
| `cambodia:rim_kin` | `deathDate` | `1959-01-27` | `1959-01-01` | corrected-card | Rim, Kin (1911-1959) - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark:/12148/cb12285967d |
| `cameroon:calixthe_beyala` | `birthDate` | `1961-10-26` | `1961-10-26` | corrected-card | Calixthe Beyala - Le Livre de Poche: https://www.livredepoche.com/auteur/calixthe-beyala |
| `cape_verde:manuel_de_novas` | `birthDate` | `1938-02-24` | `` | retain-current-card | Manuel d'Novas - Government of Cabo Verde, Ministry of Culture: https://www.governo.cv/ministerio-da-cultura-manifesta-pesar-e-consternacao-pela-morte-de-manuel-dnovas/; Manel d'Novas - Inforpress, Agência Cabo-verdiana de Notícias: https://inforpress.cv/en/maneldnovasrecebetributoemlisboaparamarcaros15anossobreoseufalecimento |
| `cape_verde:ovidio_martins` | `birthDate` | `1928-09-17` | `` | corrected-card | Ovídio Martins - RTP / Agência Lusa: https://www.rtp.pt/noticias/cultura/ovidio-martins-poeta-e-ativista-cabo-verdiano-vai-ser-homenageado-em-lisboa_n478097 |
| `cape_verde:ovidio_martins` | `deathDate` | `1999-04-29` | `` | corrected-card | Ovídio Martins - RTP / Agência Lusa: https://www.rtp.pt/noticias/cultura/ovidio-martins-poeta-e-ativista-cabo-verdiano-vai-ser-homenageado-em-lisboa_n478097 |
| `chile:alberto_blest_gana` | `birthDate` | `1830-05-04` | `` | retain-current-card | Alberto Blest Gana - Memoria Chilena, Biblioteca Nacional de Chile: https://www.memoriachilena.gob.cl/602/w3-article-3273.html; Don Alberto Blest Gana - Memoria Chilena: https://www.memoriachilena.gob.cl/archivos2/pdfs/MC0009737.pdf |
| `chile:alberto_blest_gana` | `deathDate` | `1920-11-09` | `` | retain-current-card | Don Alberto Blest Gana - Memoria Chilena: https://www.memoriachilena.gob.cl/archivos2/pdfs/MC0009737.pdf |
| `chile:diamela_eltit` | `birthDate` | `1949-08-24` | `` | retain-current-card | Diamela Eltit González - Universidad de Chile: https://uchile.cl/presentacion/historia/grandes-figuras/premios-nacionales/literatura/diamela-eltit-gonzalez |
| `chile:lina_meruane` | `birthDate` | `1970` | `` | reduced-unsupported-precision | Lina Meruane - New York University Creative Writing in Spanish: https://wp.nyu.edu/cwskjcc/autores/lina-meruane/; Lina Meruane - Deep Vellum Publishing: https://www.deepvellum.org/authors/lina-meruane |
| `china:su_tong` | `birthDate` | `1963-01-23` | `` | corrected-card | Su Tong - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark%3A/12148/cb122453866; Su Tong - Store norske leksikon: https://snl.no/Su_Tong |
| `china:zhang_ling` | `birthPlace` | `Ханчжоу, Чжэцзян, Китай` | `` | corrected-card | Ling Zhang - Penguin Random House: https://www.penguinrandomhouse.com/authors/252959/ling-zhang/; Zhang Ling - official author biography: https://zhanglingwriter.com/ |
| `colombia:hector_rojas_herazo` | `deathDate` | `2002-04-11` | `` | corrected-card | Héctor Rojas Herazo - Editorial Universidad del Norte: https://editorial.uninorte.edu.co/simeh/authors/view/id/16; Héctor Rojas Herazo anthology - Universidad Externado de Colombia: https://www.uexternado.edu.co/wp-content/uploads/2017/01/16-antologia-HectorRojasHerazo.pdf |
| `colombia:juan_carlos_botero` | `birthDate` | `1960` | `` | reduced-unsupported-precision | Juan Carlos Botero - Biblioteca Virtual del Banco de la República: https://babel.banrepcultural.org/digital/collection/hernan-diaz/id/197/; Juan Carlos Botero - Editorial Planeta: https://www.planetadelibros.com.co/autor/juan-carlos-botero/000039139 |
| `colombia:laura_restrepo` | `birthDate` | `1950` | `` | reduced-unsupported-precision | Laura Restrepo - Instituto Cervantes: https://cultura.cervantes.es/estambul/es/laura-restrepo/166110; Laura Restrepo - Penguin Libros: https://www.penguinlibros.com/us/tematicas/367712-ebook-la-multitud-errante-9788410496613 |
| `colombia:ricardo_silva_romero` | `birthDate` | `1975-08-14` | `` | corrected-card | Ricardo Silva Romero - Gobernación de Antioquia / Universidad Santo Tomás biography: https://antioquia.gov.co/images/PDF2/Decretos/2023/12/2023070005714.pdf; Ricardo Silva Romero - Penguin Libros: https://www.penguinlibros.com/co/tematicas/83502-ebook-historia-oficial-del-amor-9789588948201 |
| `colombia:santiago_gamboa` | `birthDate` | `1965-12-30` | `` | corrected-card | Santiago Gamboa - Instituto Cervantes de Lyon: https://cultura.cervantes.es/lyon/es/Santiago-Gamboa/185167; Santiago Gamboa - Europa Editions: https://www.europaeditions.com/author/119/santiago-gamboa |
| `comoros:salim_hatubou` | `birthPlace` | `Хахайя, Нгазиджа, Коморы` | `` | corrected-card | Salim Hatubou - Ville de Marseille: https://www.marseille.fr/culture/actualites/salim-hatubou-le-passeur-de-memoire; Salim Hatubou - Takam Tikou, Bibliothèque nationale de France: https://takamtikou.bnf.fr/actualites/2015-04-02/hommage-salim-hatubou-crivain-et-conteur-franco-comorien |
| `cyprus:kostas_montis` | `birthDate` | `1914-02-18` | `1914-02-18` | corrected-card | Κώστας Μόντης - University of Cyprus Library: https://lekythos.library.ucy.ac.cy/archive/item/174854?lang=el |
| `democratic_republic_of_congo:v_y_mudimbe` | `deathDate` | `2025-04-21` | `` | retain-authority-confirmed-card | Valentin-Yves Mudimbe - Duke University: https://trinity.duke.edu/news/literature-professor-valentin-yves-mudimbe-passes-away; The life and work of V.-Y. Mudimbe - Cambridge University Press: https://www.cambridge.org/core/journals/africa/article/life-and-work-of-vy-mudimbe-8-december-194121-april-2025/E7E89FC89E5B6CDAF870EA8B54A0D5E0 |
| `djibouti:aden_robleh_awaleh` | `birthDate` | `1941` | `` | corrected-card | Aden Robleh Awaleh - La Nation, République de Djibouti: https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/; Aden Robleh Awaleh - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark%3A/12148/cb34933567g |
| `djibouti:aden_robleh_awaleh` | `deathDate` | `2014-10-31` | `` | corrected-card | Aden Robleh Awaleh - La Nation, République de Djibouti: https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/; Aden Robleh Awaleh - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark%3A/12148/cb34933567g |
| `djibouti:aden_robleh_awaleh` | `birthPlace` | `Али-Сабих, Джибути` | `` | corrected-card | Aden Robleh Awaleh - La Nation, République de Djibouti: https://www.lanation.dj/des-partis-et-des-hommes-les-artisans-de-lindependance-la-lpai-ou-lunion-sacree/; Aden Robleh Awaleh - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark%3A/12148/cb34933567g |
| `ecuador:lupe_rumazo` | `birthDate` | `1933-10-14` | `` | corrected-card | Lupe Rumazo - Academia Ecuatoriana de la Lengua: https://www.academiaecuatorianadelalengua.org/sra-d-a-lupe-rumazo-de-alzamora/; Lupe Rumazo - Casa de la Cultura Ecuatoriana authority record: https://biblioteca.casadelacultura.gob.ec/cgi-bin/koha/opac-authoritiesdetail.pl?authid=7275&marc=1 |
| `ecuador:lupe_rumazo` | `deathDate` | `` | `` | removed-unsupported-value | Lupe Rumazo - Academia Ecuatoriana de la Lengua: https://www.academiaecuatorianadelalengua.org/sra-d-a-lupe-rumazo-de-alzamora/; Lupe Rumazo - Casa de la Cultura Ecuatoriana authority record: https://biblioteca.casadelacultura.gob.ec/cgi-bin/koha/opac-authoritiesdetail.pl?authid=7275&marc=1 |
| `egypt:hamdi_abu_golayyel` | `birthDate` | `` | `` | withheld-conflicting-sources | Hamdi Abu Golayyel - AUC Press: https://aucpress.com/author/hamdi-abu-golayyel/; Hamdi Abu Golayyel - Words Without Borders: https://wordswithoutborders.org/contributors/view/hamdi-abu-golayyel/ |
| `egypt:hamdi_abu_golayyel` | `deathDate` | `2023` | `` | corrected-card | Hamdi Abu Golayyel - AUC Press: https://aucpress.com/author/hamdi-abu-golayyel/; Hamdi Abu Golayyel - Words Without Borders: https://wordswithoutborders.org/contributors/view/hamdi-abu-golayyel/ |
| `egypt:ibrahim_aslan` | `birthDate` | `` | `` | withheld-conflicting-sources | Ibrahim Aslan - AUC Press: https://aucpress.com/author/ibrahim-aslan/; Ibrahim Aslan - Banipal: https://www.banipal.co.uk/book_reviews/22/zuzana-kratka-reviews-two-novels-by-ibrahim-aslan/ |
| `egypt:ibrahim_aslan` | `deathDate` | `2012` | `` | retained-source-agreement | Ibrahim Aslan - AUC Press: https://aucpress.com/author/ibrahim-aslan/; Ibrahim Aslan - Banipal: https://www.banipal.co.uk/book_reviews/22/zuzana-kratka-reviews-two-novels-by-ibrahim-aslan/ |
| `england:christopher_marlowe` | `birthDate` | `1564` | `` | reduced-unsupported-precision | Christopher Marlowe - Poetry Foundation: https://www.poetryfoundation.org/poets/christopher-marlowe; Christopher Marlowe - Royal Shakespeare Company: https://www.rsc.org.uk/edward-ii/about-the-play/who-was-christopher-marlowe |
| `french_guiana:leon_gontran_damas` | `birthDate` | `1912-03-28` | `` | corrected-card | Leon-Gontran Damas - Bibliotheque nationale de France: https://catalogue.bnf.fr/ark:/12148/cb11898508m; Leon Damas - Assemblee nationale: https://www2.assemblee-nationale.fr/sycomore/fiche/2113 |
| `georgia:galaktion_tabidze` | `birthDate` | `1891-11-17` | `` | corrected-card | Galaktion Tabidze - National Archives of Georgia: https://www.archive.gov.ge/en/galaktioni-1 |
| `georgia:otar_chiladze` | `deathDate` | `2009-10-01` | `2009-10-01` | corrected-card | Чиладзе Отар Иванович - Большая российская энциклопедия: https://bigenc.ru/c/chiladze-otar-ivanovich-b371ff; Умер грузинский писатель Отар Чиладзе - Российская газета: https://rg.ru/2009/10/01/chiladze-anons.html; Умер грузинский писатель Отар Чиладзе - Коммерсантъ: https://www.kommersant.ru/doc/1720449 |
| `germany:sebastian_brant` | `birthDate` | `1458` | `` | corrected-card | Sebastian Brant - Deutsche Biographie: https://www.deutsche-biographie.de/gnd118514474.html; Sebastian Brant - Deutsche Nationalbibliothek: https://d-nb.info/gnd/118514474 |
| `ghana:joseph_casely_hayford` | `birthDate` | `1866` | `` | reduced-conflicting-day-precision | Joseph Ephraim Casely Hayford - Inner Temple: https://www.innertemple.org.uk/celebrating-diversity-at-the-bar/joseph-ephraim-casely-hayford/; J. E. Casely Hayford - Encyclopaedia Africana: https://encyclopaediaafricana.com/hayford-j-e-casely/ |
| `ghana:joseph_casely_hayford` | `deathDate` | `1930-08-11` | `` | corrected-card | J. E. Casely Hayford - Encyclopaedia Africana: https://encyclopaediaafricana.com/hayford-j-e-casely/ |
| `ghana:martin_egblewogbe` | `birthDate` | `1975` | `` | reduced-unsupported-precision | Martin Egblewogbe - Writers Project of Ghana: https://www.writersprojectghana.com/megblewogbe/; Against Ethnography - Cambridge University Press: https://www.cambridge.org/core/books/decolonizing-the-english-literary-curriculum/against-ethnography/B3D295B83E9DE2EEE9F559DA4E34568B; The Waiting - CiNii Books: https://ci.nii.ac.jp/ncid/BD00490608 |
| `ghana:nii_ayikwei_parkes` | `birthDate` | `1974` | `` | reduced-unsupported-precision | Nii Ayikwei Parkes - Peepal Tree Press: https://www.peepaltreepress.com/authors/nii-ayikwei-parkes; Nii Ayikwei Parkes - official curriculum vitae: https://niiparkes.com/open/profile/cv/?aid=235&sa=0 |
| `greece:andreas_kalvos` | `birthDate` | `1792` | `` | reduced-unsupported-precision | Andreas Kalvos - Capodistrias Museum: https://www.capodistriasmuseum.gr/en/persons/andreas-kalvos/; Andreas Kalvos - Ionian University POLYSEMi: https://polysemi.di.ionio.gr/index.php/2019/08/29/andreas-kalvos-2/ |
| `grenada:george_brizan` | `birthDate` | `1942-10-31` | `` | corrected-card | George Brizan - National Democratic Congress of Grenada: https://www.ndcgrenada.org/past-leaders/ |
| `grenada:george_brizan` | `deathDate` | `2012` | `` | reduced-unsupported-precision | George Brizan - CARICOM: https://caricom.org/caricom-remembers-rt-hon-george-brizan/ |
| `guatemala:francisco_alejandro_mendez` | `deathDate` | `2026-03-28` | `` | added-source-confirmed-date | Francisco Alejandro Méndez - Prensa Libre: https://www.prensalibre.com/vida/escenario/fallece-francisco-alejandro-mendez-premio-nacional-de-literatura-2017/; Francisco Alejandro Méndez Castañeda - Academia Guatemalteca de la Lengua: https://agl.org.gt/academicos/francisco-alejandro-mendez-castaneda/ |
| `guatemala:luis_cardoza_y_aragon` | `birthDate` | `1901-06-21` | `` | retain-current-card | Luis Cardoza y Aragon - Registro Nacional de las Personas de Guatemala: https://www.renap.gob.gt/sites/default/files/publicaciones-renap/luis-cardoza-y-aragon-web.pdf; Luis Cardoza y Aragon - Ministerio de Cultura y Deportes de Guatemala: https://mcd.gob.gt/wp-content/uploads/2022/05/7-Poesi%E2%95%A0ua-de-Luis-Cardoza-y-Arago%E2%95%A0un-Lecturas-Bicentenarias.pdf |
| `iraq:badr_shakir_al_sayyab` | `birthDate` | `1926-12-24` | `1926-12-24` | corrected-card | al-Sayyab, Badr Shakir - Institut national d'histoire de l'art: https://agorha.inha.fr/ark:/54721/ab33f4f3-f62a-4390-bd1f-862a09ca276c?database=71 |
| `iraq:nazik_al_malaika` | `birthDate` | `1923-08-23` | `1922-08-23` | retain-current-card | Вестник Таджикского национального университета, 2025: https://msu.tj/file/vestnik/vestnik_t2%2852%29_4_2025.pdf |
| `israel:zeruya_shalev` | `birthDate` | `1959-04-13` | `1959-04-13` | corrected-card | צרויה שלו - פרויקט בן־יהודה: https://benyehuda.org/lexicon/00036.php; Zeruya Shalev - Humanitas: https://humanitas.ro/autori/zeruya-shalev |
| `kosovo:ali_podrimja` | `birthDate` | `1942-08-28` | `1942-08-01` | retain-current-card | Ali Podrimja - Library of Congress authority record n85829191: https://lccn.loc.gov/n85829191 |
| `kyrgyzstan:tugolbai_sydykbekov` | `birthDate` | `1912-05-14` | `1912-05-01` | retain-current-card | Кабинет Министров Кыргызской Республики - 100-летие Тугельбая Сыдыкбекова: https://www.gov.kg/ru/post/s/sostoyalos-torzhestvennoe-otkrytie-memorialnoj-doski-v-chest-100-letiya-narodnogo-pisatelya-tugelbaya-sydykbekova; Мэрия Бишкека - день памяти Туголбая Сыдыкбекова: https://www.bishkek.gov.kg/ru/post/15582 |
| `latvia:andrejs_upits` | `birthDate` | `1877-12-04` | `1877-11-22` | retain-current-card-calendar-normalized | Упит (Упитс) Андрейс - Большая российская энциклопедия: https://old.bigenc.ru/literature/text/4700066 |
| `latvia:rainis` | `birthDate` | `1865-09-11` | `1865-08-30` | retain-current-card-calendar-normalized | Покачать колыбель Райниса - Latvijas Sabiedriskais medijs: https://rus.lsm.lv/statja/kultura/kultura/pokachat-kolibel-raynisa.a292372/ |
| `lithuania:vincas_kreve` | `deathDate` | `1954-07-07` | `1954-07-17` | retain-current-card | Vincas Krėvė - Visuotinė lietuvių enciklopedija: https://www.vle.lt/straipsnis/vincas-kreve/; Vincas Krėvė-Mickevičius - Lietuvos mokslų akademija: https://www.lma.lt/uploads/Biogramos/Kr%C4%97v%C4%97_V_red..pdf |
| `mali:amadou_hampate_ba` | `birthDate` | `1901` | `1900` | retain-current-card | Послание человечеству - Амаду Ампате Ба: https://www.unesco.org/ru/articles/poslanie-chelovechestvu; Library of Congress authority record n84149759: https://lccn.loc.gov/n84149759 |
| `mongolia:dashdorj_natsagdorj` | `deathDate` | `1937-07-13` | `1937-06-13` | retain-current-card | Дашдоржийн Нацагдорж - Монголын кино урлагийн зөвлөл: https://www.mfi.mn/artist/natsagdorj-dashdorj/detail |
| `mongolia:lodoidamba` | `birthDate` | `1917-08-20` | `1917-01-01` | corrected-card | Чадраабалын Лодойдамба - Монголын түүхийн тайлбар толь: https://mongoltoli.mn/history/timeline?day=20&month=08&year=1917; Чадраабалын Лодойдамба - M-book: https://www.m-book.mn/authors/1256 |
| `mongolia:lodoidamba` | `deathDate` | `1970-01-11` | `1970-01-01` | corrected-card | Чадраабалын Лодойдамба - M-book: https://www.m-book.mn/authors/1256; Чадраабалын Лодойдамба - Монголын түүхийн тайлбар толь: https://mongoltoli.mn/history/timeline?day=20&month=08&year=1917 |
| `myanmar:ma_ma_lay` | `birthDate` | `1917-04-13` | `1917-04-13` | corrected-card | Biography of Journal Kyaw Ma Ma Lay - Cornell University Press: https://api.pageplace.de/preview/DT0400.9781501719356_A33947823/preview-9781501719356_A33947823.pdf; Journal Kyaw Ma Ma Lay - Wikidata Q6273845: https://www.wikidata.org/wiki/Q6273845 |
| `nepal:laxmi_prasad_devkota` | `birthDate` | `1909-11-12` | `1909-11-12` | corrected-card-calendar-conversion | English Composition Grade 9-12 - Curriculum Development Centre, Government of Nepal: https://giwmscdnone.gov.np/media/pdf_upload/English%20Composition%20Grade%209%20-%2012%20%28%E0%A4%B8%E0%A4%A8%E0%A5%8D%E0%A4%A6%E0%A4%B0%E0%A5%8D%E0%A4%AD%20%E0%A4%8F%E0%A4%B5%E0%A4%AE%E0%A5%8D%20%E0%A4%B8%E0%A5%8D%E0%A4%B5%20%E0%A4%85%E0%A4%A7%E0%A5%8D%E0%A4%AF%E0%A4%AF%E0%A4%A8%20%E0%A4%B8%E0%A4%BE%E0%A4%AE%E0%A4%97%E0%A5%8D%E0%A4%B0%E0%A5%80%29_h2lkhrs.pdf |
| `new_zealand:loyd_jones` | `birthDate` | `1955-03-23` | `1955-03-23` | corrected-card | Lloyd Jones - Christchurch City Libraries: https://my.christchurchcitylibraries.com/new-zealand-childrens-authors/lloyd-jones/ |
| `nigeria:buchi_emecheta` | `birthDate` | `1944-07-21` | `1944-07-21` | corrected-card | Buchi Emecheta - South African History Online: https://sahistory.org.za/people/buchi-emecheta; Buchi Emecheta - Cambridge Orlando: https://orlando.cambridge.org/people/f75322f4-8804-43a3-888f-c1a5058e2756 |
| `nigeria:christopher_okigbo` | `birthDate` | `1932-08-16` | `1930-08-16` | retain-current-card | Christopher Okigbo: https://www.poetryfoundation.org/poets/christopher-okigbo; Christopher Okigbo Papers - UNESCO Memory of the World: https://media.unesco.org/sites/default/files/webform/mow001/50africaokigbopapers.pdf |
| `nigeria:helon_habila` | `birthDate` | `1967-11` | `1967-01-01` | corrected-card-reduced-precision | Helon Habila, Writers on Writing - Lancaster University Transcultural Writing Archive: https://www.lancaster.ac.uk/transculturalwriting-archive/radiophonics/contents/writersonwriting/helonhabila/index.html |
| `nigeria:helon_habila` | `birthPlace` | `Калтунго, Нигерия` | `` | corrected-card | Helon Habila, Writers on Writing - Lancaster University Transcultural Writing Archive: https://www.lancaster.ac.uk/transculturalwriting-archive/radiophonics/contents/writersonwriting/helonhabila/index.html |
| `republic_of_congo:sony_labou_tansi` | `birthDate` | `1947-06-05` | `1947-07-05` | corrected-card | Sony Labou Tansi - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark:/12148/cb11910402v; Sony Labou Tansi - Les Francophonies: https://www.lesfrancophonies.fr/SONY-LABOU-TANSI |
| `samoa:albert_wendt` | `birthDate` | `1939-10-27` | `1939-10-27` | corrected-card | Albert Wendt - Academy of New Zealand Literature: https://www.anzliterature.com/member/albert-wendt/; Albert Wendt - Wikidata Q1235864: https://www.wikidata.org/wiki/Q1235864 |
| `senegal:birago_diop` | `birthDate` | `1906-12-11` | `1906-12-12` | retain-current-card | Birago Diop - Bibliothèque nationale de France authority record: https://catalogue.bnf.fr/ark:/12148/cb11900243p |
| `south_sudan:taban_lo_liyong` | `birthDate` | `1939` | `1938-01-01` | retain-current-card | Табан Ло Лийонг - Большая российская энциклопедия: https://old.bigenc.ru/literature/text/2173989 |
| `taiwan:li_ang` | `birthDate` | `1952-04-07` | `1952-04-07` | corrected-card | Li Ang - Ministry of Culture, Taiwan: https://www.moc.gov.tw/en/News_Content2.aspx?n=491&s=17978; Li Ang - National Chung Hsing University: https://taiwan.nchu.edu.tw/content.php?a=%E9%A7%90%E6%A0%A1%E4%BD%9C%E5%AE%B6&b=%E7%B3%BB%E6%89%80%E6%88%90%E5%93%A1&c=ut&id=50d652d4-bc15-4b9d-9b54-f4e52c8fd393 |
| `tajikistan:muhammadjon_shakuri` | `birthDate` | `1925-02` | `1925-02` | corrected-card | Таджикский национальный университет - диссертация Т. Х. Каримовой: https://tnu.tj/Dissertatsii/KarimovaTKh/KarimovaTKh.pdf; ŠOKUROV, MOḤAMMADJĀN - Encyclopaedia Iranica: https://www.iranicaonline.org/articles/shokurov-mohammadjan/ |
| `tanzania:said_ahmed_mohamed` | `birthDate` | `1947-12-12` | `` | corrected-card-and-country | Said Ahmed Mohamed Khamis - Universität Bayreuth: https://www.presse.uni-bayreuth.de/de/archiv/2012/194-Swahili-Kolloquium.pdf; Said Ahmed Mohamed Khamis - University of Nairobi: https://erepository.uonbi.ac.ke/server/api/core/bitstreams/1a972ff5-f647-4f39-9791-4f705e98abdf/content |
| `uganda:timothy_wangusa` | `birthDate` | `1942-05-20` | `1942-01-01` | retain-current-card | Timothy Wangusa at 80 - Makerere University: https://news.mak.ac.ug/2022/07/makerere-university-celebrates-prof-timothy-wangusa80/; Timothy Wangusa - Bibliothèque nationale de France: https://catalogue.bnf.fr/ark:/12148/cb122319918 |
| `uzbekistan:odil_yoqubov` | `deathDate` | `2009-12-21` | `2009-12-22` | retain-current-card | Одил Ёқубов - Muzaffar.uz: https://muzaffar.uz/mashhurlar-hayotidan/2644-odil-yoqubov.html |

## Offline Wikidata snapshot: структурированная очередь сверки

Snapshot `ad60e0b097803f1c71aa1a53d18fb3ea996ac5be8775e4993b6a27b243d770f3` содержит 1405 сущностей и даёт 1410 candidate-сопоставлений, но identity corroborated только у 1190. Сравнение сохраняет RU/EN labels, rank, precision, calendar model и наличие ссылок. Совпадение с Wikidata не означает, что русский текст проверен; расхождение не исправляется автоматически.

| Ключ | Писатель | QID | Класс | Поле | Карточка | Лучшие Wikidata claims | Источник |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `azerbaijan:imadaddin_nasimi` | Имадеддин Насими | `Q982506` | c: likely-bad-qid-mapping-or-identity | `deathDate` | `1417-01-01` | 1419 (year, Q1985786, normal, refs:1) | https://www.wikidata.org/wiki/Q982506 |
| `bahrain:amin_saleh` | Амин Салих | `Q104903512` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1949` | 1950 (year, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q104903512 |
| `belarus:vintsent_dunin_martsinkevich` | Винцент Дунин-Марцинкевич | `Q3008609` | c: likely-bad-qid-mapping-or-identity | `deathDate` | `1884-12-21` | 1884-12-17 (day, Q1985786, normal, refs:1) | https://www.wikidata.org/wiki/Q3008609 |
| `bolivia:augusto_cespedes` | Аугусто Сеспедес | `Q4821286` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1997-05-11` | 1997-05-09 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q4821286 |
| `bolivia:jaime_saenz` | Хайме Саэнс | `Q706773` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1921-10-08` | 1921-10-29 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q706773 |
| `cape_verde:jorge_barbosa` | Жоржи Барбоза | `Q1984024` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1902-05-22` | 1902-05-25 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q1984024 |
| `colombia:rafael_pombo` | Рафаэль Помбо | `Q1661285` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1912-05-05` | 1912-05-15 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q1661285 |
| `costa_rica:carmen_lyra` | Кармен Лира | `Q2939620` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1888-01-15` | 1887-01-15 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q2939620 |
| `guyana:edgar_mittelholzer` | Эдгар Миттельхольцер | `Q181618` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1965-05-05` | 1965-05-06 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q181618 |
| `hungary:imre_madach` | Имре Мадач | `Q366331` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1823-01-20` | 1823-01-21 (day, Q1985727, preferred, refs:4) | https://www.wikidata.org/wiki/Q366331 |
| `italy:cesare_beccaria` | Чезаре Беккариа | `Q223723` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1794-11-28` | 1794-11-20 (day, Q1985727, normal, refs:3) | https://www.wikidata.org/wiki/Q223723 |
| `japan:kawabata_yasunari` | Кавабата Ясунари | `Q43736` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1899-06-14` | 1899-06-11 (day, Q1985727, normal, refs:7) | https://www.wikidata.org/wiki/Q43736 |
| `kazakhstan:akhmet_baitursynov` | Ахмет Байтурсынулы | `Q1047477` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1872-09-05` | 1872-01-28 (day, Q1985727, preferred, refs:1) | https://www.wikidata.org/wiki/Q1047477 |
| `latvia:karlis_skalbe` | Карлис Скалбе | `Q1069984` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1945-04-15` | 1945-04-14 (day, Q1985727, normal, refs:1); 1945-04-06 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q1069984 |
| `lithuania:vincas_putinas` | Винцас Миколайтис-Путинас | `Q1124485` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1893-01-06` | 1893-05-20 (day, Q1985786, normal, refs:1) | https://www.wikidata.org/wiki/Q1124485 |
| `mongolia:byambyn_rinchen` | Бямбын Ринчен | `Q879330` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1905-11-21` | 1905-12-25 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q879330 |
| `mongolia:danzanravjaa` | Дулдуйтын Данзанравжаа | `Q1264761` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1856-10-25` | 1857 (year, Q1985727, preferred, refs:1) | https://www.wikidata.org/wiki/Q1264761 |
| `mongolia:sonomyn_udval` | Сономын Удвал | `Q7562208` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1921-02-23` | 1921-02-21 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q7562208 |
| `montenegro:marko_miljanov` | Марко Милянов Попович | `Q3132479` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1901-02-02` | 1901-02-15 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q3132479 |
| `new_zealand:kate_de_goldi` | Кейт де Голди | `Q1735679` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1959-11-24` | 1959-08-18 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q1735679 |
| `north_korea:ri_ki_yong` | Ли Ги Ён | `Q485218` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1895` | 1896-05-06 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q485218 |
| `pakistan:intizar_husain` | Интизар Хусейн | `Q6057750` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1923-12-21` | 1925-12-21 (day, Q1985727, normal, refs:2); 1923-12-07 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q6057750 |
| `panama:ricardo_miro` | Рикардо Миро | `Q5573605` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1883-11-05` | 1882-11-05 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q5573605 |
| `panama:rogelio_sinan` | Рохелио Синан | `Q9070378` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1994-10-04` | 1994-10-07 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q9070378 |
| `paraguay:gabriel_casaccia` | Габриэль Касаксиа | `Q2639230` | c: likely-bad-qid-mapping-or-identity | `deathDate` | `1980-11-24` | 1980-11-23 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q2639230 |
| `philippines:edith_tiempo` | Эдит Тьемпо | `Q2577431` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `2011-08-16` | 2011-08-21 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q2577431 |
| `romania:mircea_eliade` | Мирча Элиаде | `Q41590` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1907-03-13` | 1907-03-09 (day, Q1985786, normal, refs:7) | https://www.wikidata.org/wiki/Q41590 |
| `russia:mandelstam` | Осип Эмильевич Мандельштам | `Q189950` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1891-01-15` | 1891-01-02 (day, Q1985786, normal, refs:1) | https://www.wikidata.org/wiki/Q189950 |
| `slovenia:tone_pavcek` | Тоне Павчек | `Q5243720` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1928-01-29` | 1928-09-29 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q5243720 |
| `slovenia:tone_pavcek` | Тоне Павчек | `Q5243720` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `2011-10-21` | 2011-10-20 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q5243720 |
| `south_korea:jeong_cheol` | Чон Чхоль | `Q484978` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1536-12-18` | 1536-12-06 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q484978 |
| `south_korea:jeong_cheol` | Чон Чхоль | `Q484978` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1593-02-07` | 1593-12 (month, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q484978 |
| `south_korea:kim_so_wol` | Ким Соволь | `Q496828` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1902-09-07` | 1902-08-06 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q496828 |
| `south_korea:park_kyung_ni` | Пак Кённи | `Q39963` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1926-12-02` | 1926-10-28 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q39963 |
| `sudan:tayeb_salih` | Аль-Тайиб Салих | `Q561434` | c: likely-bad-qid-mapping-or-identity | `deathDate` | `2009-02-18` | 2009-02-19 (day, Q1985727, normal, refs:5) | https://www.wikidata.org/wiki/Q561434 |
| `tajikistan:rudaki` | Рудаки | `Q312954` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `0858` | 0859 (year, Q1985786, normal, refs:1) | https://www.wikidata.org/wiki/Q312954 |
| `thailand:kulap_saipradit` | Кулап Сайпрадит (Сибурапа) | `Q6442803` | c: likely-bad-qid-mapping-or-identity | `birthDate` | `1905-03-31` | 1906-03-31 (day, Q1985727, normal, refs:0) | https://www.wikidata.org/wiki/Q6442803 |
| `timor_leste:francisco_borja_da_costa` | Франсишку Боржа да Кошта | `Q1441897` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1975-12-07` | 1975-12-08 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q1441897 |
| `tunisia:abdelwahab_meddeb` | Абдельвахаб Меддеб | `Q308021` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `2014-11-05` | 2014-11-06 (day, Q1985727, normal, refs:4) | https://www.wikidata.org/wiki/Q308021 |
| `tunisia:ali_douagi` | Али Дуаги | `Q2836198` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1909-01-04` | 1909-01-06 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q2836198 |
| `turkmenistan:aman_kekilov` | Аман Кекилов | `Q2349508` | d: date-contradiction-requiring-authoritative-source | `birthDate` | `1912-05-09` | 1912-10-09 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q2349508 |
| `uzbekistan:abdulla_qahhor` | Абдулла Каххар | `Q4217805` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1968-05-25` | 1968-05-24 (day, Q1985727, normal, refs:1) | https://www.wikidata.org/wiki/Q4217805 |
| `venezuela:eduardo_blanco` | Эдуардо Бланко | `Q5340538` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1912-01-30` | 1912-06-30 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q5340538 |
| `venezuela:simon_rodriguez` | Симон Родригес | `Q1358685` | d: date-contradiction-requiring-authoritative-source | `deathDate` | `1854-02-28` | 1853-02-28 (day, Q1985727, normal, refs:2) | https://www.wikidata.org/wiki/Q1358685 |

### QID identity discrepancies

Эти QID нельзя использовать для исправления дат или изображений: RU/EN label и/или birth year противоречат карточке. Портрет, пришедший только через такой QID, должен быть изолирован до ремонта mapping.

| Ключ | Писатель | QID | Labels | Год карточки | Годы Wikidata | Риск портрета |
| --- | --- | --- | --- | --- | --- | --- |
| - | - | - | - | - | - | Высокоуверенных identity discrepancies нет |

## Пробелы metadata: не доказанные ошибки

Здесь утверждение в bio не противоречит известному факту, но ему не соответствует локальное структурированное поле. Это отдельная очередь проверки; отсутствие metadata само по себе не опровергает текст.

| Ключ | Писатель | Поле | Код | Значения | Безопасный кандидат исправления |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | Не найдено | Исправление не требуется |

## Что реально автоматизируется

Полностью автоматизируются: обход всех карточек, выделение типов утверждений, проверка внутренней согласованности dates/years/nobelYear/works и сравнение структурированных дат там, где личность надёжно сопоставлена с source-confirmed staging.

Не автоматизируются без ложной уверенности: истинность оценок вроде «крупнейший», темы и влияние, полнота списка произведений, выбор между конфликтующими датами и подтверждение каждой фразы. Для этого нужны claim-level источники и редактор. Полная машинная проверка текста: 0 карточек; полная машинная **триаж-проверка**: весь текущий корпус.

Полная стабильная очередь находится в `writer-biography-fact-qa.json`; каждый элемент содержит hash bio, типы утверждений, evidence, issues и приоритет, но не меняет публикационный статус.
