# Аудит соответствий писателей и Wikidata

- Проверено старых соответствий: **1278**.
- Активных соответствий после исправлений: **1420** (1405 уникальных QID).
- Исправлено однозначных QID: **6**; удалено ложных соответствий без безопасной замены: **7**.
- Подтверждённых ложных соответствий из известного набора осталось: **0**.
- Структурно подтверждены: **1295**; требуют ручной проверки: **78**; заблокированы: **47**.
- Из подтверждённых вручную по двум и более авторитетным источникам: **48**.
- Из runtime исключено устаревших привязок портретов: **13**; из них реально присутствуют в старом manifest: **0**.

Wikidata используется как структурированный слой сверки (CC0), а не как источник готового редакционного текста. Конфликт даты сам по себе не исправляет карточку автоматически: он остаётся в очереди до проверки по библиотечному, архивному, издательскому или иному авторитетному источнику.

## Исправленные соответствия

| Карточка | Старый QID | Новый QID | Основание |
| --- | --- | --- | --- |
| `australia:les_murray` | [Q6529770](https://www.wikidata.org/wiki/Q6529770) | [Q259841](https://www.wikidata.org/wiki/Q259841) | The old item describes an Australian sports journalist born in 1945; the corrected item describes the poet Les Murray born in 1938. |
| `dominican_republic:juan_bosch` | [Q1710380](https://www.wikidata.org/wiki/Q1710380) | [Q439980](https://www.wikidata.org/wiki/Q439980) | The old item describes a Spanish film director born in 1926; the corrected item describes the Dominican writer and president born in 1909. |
| `england:t_s_eliot` | [Q3261882](https://www.wikidata.org/wiki/Q3261882) | [Q37767](https://www.wikidata.org/wiki/Q37767) | The old item is Louis Favre (1910-1944); the corrected item is the poet T. S. Eliot (1888-1965). |
| `myanmar:ma_ma_lay` | [Q56254273](https://www.wikidata.org/wiki/Q56254273) | [Q6273845](https://www.wikidata.org/wiki/Q6273845) | The old item describes a Burmese politician born in 1962; the corrected item describes the Burmese writer born in 1917. |
| `sweden:hjalmar_soderberg` | [Q49099212](https://www.wikidata.org/wiki/Q49099212) | [Q331845](https://www.wikidata.org/wiki/Q331845) | The old item describes a Swedish painter born in 1859; the corrected item describes the Swedish writer born in 1869. |
| `finland:fredrika_bremer` | [Q465687](https://www.wikidata.org/wiki/Q465687) | [Q262145](https://www.wikidata.org/wiki/Q262145) | The old item describes Fredrika Runeberg (1807-1879); the corrected item describes Swedish writer Fredrika Bremer (1801-1865). |

## Удалённые ложные соответствия

| Карточка | Ложный QID | Основание |
| --- | --- | --- |
| `antigua_and_barbuda:alison_hughes` | [Q3611840](https://www.wikidata.org/wiki/Q3611840) | The item describes a British tennis umpire born in 1970, not the literary card born in 1962; no safe replacement item was established. |
| `eritrea:khaled_abdalla` | [Q55389631](https://www.wikidata.org/wiki/Q55389631) | The item describes an Egyptian freestyle wrestler born in 1996, not the literary card born in 1960; no safe replacement item was established. |
| `liberia:sylvester_williams` | [Q7660842](https://www.wikidata.org/wiki/Q7660842) | The item describes an American football player born in 1988, not the literary card born in 1940; no safe replacement item was established. |
| `maldives:abdulla_sodiq` | [Q17198026](https://www.wikidata.org/wiki/Q17198026) | The item describes a Maldivian politician born in 1969, not the literary card born in 1946; no safe replacement item was established. |
| `cameroon:jean_roger_essomba` | [Q95950701](https://www.wikidata.org/wiki/Q95950701) | The item describes Jean-Roger Essombe Edimo, not the Cameroonian writer and publisher Jean-Roger Essomba born in 1962; no safe replacement item was established. |
| `chad:ahmat_taboye` | [Q3656879](https://www.wikidata.org/wiki/Q3656879) | The item uses the unverified Ahmat spelling and has no birth-date claim; institutional sources support writer Ahmad Taboye, but the authority identity is not yet strong enough to retain this mapping. |
| `fiji:satendra_nandan` | [Q7426104](https://www.wikidata.org/wiki/Q7426104) | The item has an unsupported 1939 birth year and no literary occupation; institutional sources establish the writer Satendra Nandan with a 1944 birth date, but do not safely establish this Wikidata item as the same person. |

## Очередь ручной проверки

| Карточка | QID | Метки | Описание | Сигналы |
| --- | --- | --- | --- | --- |
| `afghanistan:rabia_balkhi` | [Q469377](https://www.wikidata.org/wiki/Q469377) | Rabia Balkhi / Рабиа Балхи | Persian poet, first woman poet of Islamic period / персидская поэтесса | local-birth-year-missing |
| `australia:gregory_david_roberts` | [Q1370495](https://www.wikidata.org/wiki/Q1370495) | Gregory David Roberts / Грегори Дэвид Робертс | Australian writer and bank robber / австралийский писатель | local-birth-year-missing |
| `australia:terry_hayes` | [Q437121](https://www.wikidata.org/wiki/Q437121) | Terry Hayes / Терри Хейс | British film producer and screenwriter | local-birth-year-missing |
| `azerbaijan:imadaddin_nasimi` | [Q982506](https://www.wikidata.org/wiki/Q982506) | Nasimi / Насими | Azerbaijani poet, c. 1369-1419 / Азербайджанский поэт | label-name-conflict, death-year-conflict |
| `azerbaijan:muhammad_fuzuli` | [Q178379](https://www.wikidata.org/wiki/Q178379) | Fuzuli / Физули | 16th-century Azerbaijani poet / азербайджанский поэт и мыслитель XVI века, происходящий с территории, сегодня относящейся к Ираку | label-name-conflict |
| `bahrain:amin_saleh` | [Q104903512](https://www.wikidata.org/wiki/Q104903512) | Amin Saleh | Bahraini screenwriter, poet, and translator | birth-year-conflict |
| `bahrain:qassim_haddad` | [Q6829735](https://www.wikidata.org/wiki/Q6829735) | Kacem Haddad | Bahraini poet | label-name-conflict |
| `belarus:francisak_bahushevich` | [Q2996666](https://www.wikidata.org/wiki/Q2996666) | Francišak Bahuševič / Франциск Бенедикт Богушевич | Belarusian writer (1840 - 1900) / белорусский и польский поэт, один из основоположников белорусской литературы | label-name-conflict |
| `belarus:francysk_skaryna` | [Q435320](https://www.wikidata.org/wiki/Q435320) | Francysk Skaryna / Франциск Скорина | Ruthenian humanist, bible translator and book printer / белорусский и восточнославянский первопечатник, философ, писатель, общественный деятель, предприниматель и учёный-медик | birth-year-conflict, death-year-conflict |
| `belarus:vintsent_dunin_martsinkevich` | [Q3008609](https://www.wikidata.org/wiki/Q3008609) | Wincenty Dunin-Marcinkiewicz / Дунин-Марцинкевич, Викентий Иванович | Belarusian-Polish writer, poet, dramatist and social activist / белорусский писатель и драматург, классик белорусской литературы | label-name-conflict |
| `chile:marta_brunet` | [Q275648](undefined) |  |  | writer-key-not-found |
| `costa_rica:carmen_lyra` | [Q2939620](https://www.wikidata.org/wiki/Q2939620) | Carmen Lyra / Кармен Лира | Costa Rican politician and writer | birth-year-conflict |
| `cyprus:nikos_nikolaidis` | [Q7030511](https://www.wikidata.org/wiki/Q7030511) | Nikos Nicolaides | Cypriot Greek writer and painter (1884-1956) | label-name-conflict |
| `djibouti:aden_robleh_awaleh` | [Q967740](https://www.wikidata.org/wiki/Q967740) | Aden Robleh Awaleh | Djiboutian politician (1941-2014) | literary-role-not-corroborated |
| `ecuador:demetrio_aguilera_malta` | [Q1185444](https://www.wikidata.org/wiki/Q1185444) | Demetrio Aguilera Malta / Деметрио Агилера Мальта | writer (1909-1981) | label-name-conflict |
| `ecuador:lupe_rumazo` | [Q16094140](https://www.wikidata.org/wiki/Q16094140) | Lupe Rumazo | Ecuadorian writer | label-name-conflict, birth-year-conflict |
| `england:john_fowles` | [Q214660](https://www.wikidata.org/wiki/Q214660) | John Fowles / Джон Роберт Фаулз | English novelist (1926-2005) / английский писатель, романист и эссеист (1926-2005) | local-birth-year-missing |
| `eritrea:alemseged_tesfai` | [Q55991620](https://www.wikidata.org/wiki/Q55991620) | Alemseged Tesfai |  | literary-role-not-corroborated |
| `ethiopia:kebede_michael` | [Q3194578](https://www.wikidata.org/wiki/Q3194578) | Kebede Mikael | Ethiopian writer (1915-1998) | label-name-conflict |
| `fiji:brij_lal` | [Q2925538](https://www.wikidata.org/wiki/Q2925538) | Brij Lal / Бридж Лал | Fijian historian | literary-role-not-corroborated |
| `fiji:subramani` | [Q104141417](https://www.wikidata.org/wiki/Q104141417) | Subramani | Fijian author, essayist, and literary critic | label-name-conflict, birth-year-conflict |
| `france:marie_de_france` | [Q5617](https://www.wikidata.org/wiki/Q5617) | Marie de France / Мария Французская | medieval poet / средневековая поэтесса XII века | local-birth-year-missing |
| `india:amit_chaudhuri` | [Q472352](https://www.wikidata.org/wiki/Q472352) | Amit Chaudhuri | contemporary Indian-English novelist | label-name-conflict |
| `india:bhartrihari` | [Q335161](https://www.wikidata.org/wiki/Q335161) | Bhartṛhari / Бхартрихари | Indian linguist, poet and writer / индийский лингвист, поэт и философ | local-birth-year-missing |
| `india:bhavabhuti` | [Q29057](https://www.wikidata.org/wiki/Q29057) | Bhavabhūti / Бхавабхути | classical Sanskrit scholar, poet, and playwright of 8th century India | local-birth-year-missing |
| `india:kalidasa` | [Q7011](https://www.wikidata.org/wiki/Q7011) | Kalidasa / Калидаса | A classical Sanskrit writer widely regarded as the greatest poet and dramatist of ancient India. / индийский поэт | local-birth-year-missing |
| `india:mirabai` | [Q466330](https://www.wikidata.org/wiki/Q466330) | Meera / Мира Баи | 16th-century Hindu mystic poet, saint and devotee of the god Krishna / индийская святая и поэтесса, виднейшая представительница кришнаитской поэзии в литературе хинди | label-name-conflict |
| `india:munshi_premchand` | [Q174152](https://www.wikidata.org/wiki/Q174152) | Premchand / Премчанд | Indian writer of Hindi and Urdu fiction (1880-1936); pioneer of social realism in Hindustani literature / индийский писатель, публицист, сценарист | label-name-conflict |
| `india:r_k_narayan` | [Q334252](https://www.wikidata.org/wiki/Q334252) | R. K. Narayan / Р. К. Нарайан | Indian English-language writer (1906-2001) / индийский писатель | label-name-conflict |
| `india:surdas` | [Q1325652](https://www.wikidata.org/wiki/Q1325652) | Surdas / Сурдас | Indian writer | birth-year-conflict, death-year-conflict |
| `india:valmiki` | [Q715607](https://www.wikidata.org/wiki/Q715607) | Valmiki / Вальмики | Celebrated as the harbinger-poet in Sanskrit literature and the author of the epic Ramayana | local-birth-year-missing |
| `iran:forugh_farrokhzad` | [Q464394](https://www.wikidata.org/wiki/Q464394) | Forugh Farrokhzad / Форуг Фаррохзад | Iranian poet (1935-1967) / Форуг Фаррохзад - иранская поэтесса и кинорежиссёр | birth-year-conflict |
| `iran:hafez` | [Q6240](https://www.wikidata.org/wiki/Q6240) | Hafez / Хафиз Ширази | Persian poet and mystic (1325-1389) / персидский поэт и суфийский мастер | birth-year-conflict, death-year-conflict |
| `iraq:nazik_al_malaika` | [Q446761](https://www.wikidata.org/wiki/Q446761) | Nazik Al-Malaika / Назик аль-Малаика | Iraqi poet (1922-2007) | birth-year-conflict |
| `italy:cesare_beccaria` | [Q223723](https://www.wikidata.org/wiki/Q223723) | Cesare Beccaria / Чезаре Беккариа | jurist, philosopher and politician from Italy (1738-1794) | literary-role-not-corroborated |
| `italy:emilio_salgari` | [Q309786](https://www.wikidata.org/wiki/Q309786) | Emilio Salgari / Эмилио Сальгари | Italian writer (1862-1911) / итальянский писатель | local-birth-year-missing |
| `japan:kataoka_teppei` | [Q1735602](undefined) |  |  | writer-key-not-found |
| `jordan:munif_al_razzaz` | [Q6936630](https://www.wikidata.org/wiki/Q6936630) | Munif al-Razzaz | Syrian politician (1919-1984) | literary-role-not-corroborated |
| `kazakhstan:ybyrai_altynsarin` | [Q2628401](https://www.wikidata.org/wiki/Q2628401) | Ibrahim Altynsarin / Ибрай Алтынсарин | Kazakh writer (1841-1889) / казахский педагог-просветитель, писатель, фольклорист, общественный деятель, учёный-этнограф | label-name-conflict |
| `kenya:billy_kahora` | [Q5897263](https://www.wikidata.org/wiki/Q5897263) | Billy Kahora | Kenyan writer | birth-year-conflict |
| `kyrgyzstan:musa_jangaziev` | [Q20625839](https://www.wikidata.org/wiki/Q20625839) | Musa Jangaziev / Муса Джангазиев | Kyrgyz poet / киргизский советский писатель | birth-year-conflict, death-year-conflict |
| `laos:phoumi_vongvichit` | [Q878933](https://www.wikidata.org/wiki/Q878933) | Phoumi Vongvichit / Пхуми Вонгвичит | President of Laos (1909-1994) | literary-role-not-corroborated |
| `libya:ahmed_rafiq_al_mahdaoui` | [Q4695975](https://www.wikidata.org/wiki/Q4695975) | Ahmed Rafiq Almhadoui | Libyan poet politician | label-name-conflict |
| `liechtenstein:hansjorg_quaderer` | [Q85101361](https://www.wikidata.org/wiki/Q85101361) | Hansjörg Quaderer | Liechtensteiner painter (born 1958) | birth-year-conflict, literary-role-not-corroborated |
| `liechtenstein:ida_ospelt_amann` | [Q1656540](https://www.wikidata.org/wiki/Q1656540) | Ida Ospelt-Amann | Liechtensteiner vernacular poet, author and writer (1899-1996) | birth-year-conflict, death-year-conflict |
| `liechtenstein:jurg_hanselmann` | [Q15445061](https://www.wikidata.org/wiki/Q15445061) | Jürg Hanselmann | Swiss pianist | literary-role-not-corroborated |
| `madagascar:jean_francois_samlong` | [Q3165880](https://www.wikidata.org/wiki/Q3165880) | Jean-François Samlong | French poet | birth-year-conflict |
| `malaysia:kemala` | [Q4072987](https://www.wikidata.org/wiki/Q4072987) | Ahmad Kamal Abdullah / Ахмад Камал Абдуллах | Malaysian writer (1941-2021) | label-name-conflict |
| `mali:amadou_hampate_ba` | [Q452299](https://www.wikidata.org/wiki/Q452299) | Amadou Hampâté Bâ / Амаду Ампате Ба | Malian writer, historian and ethnologist | birth-year-conflict |
| `mali:modibo_sounkalo_keita` | [Q15407222](https://www.wikidata.org/wiki/Q15407222) | Modibo Sounkalo Keita | Malian journalist | literary-role-not-corroborated |
| `mexico:elena_poniatowska` | [Q261397](https://www.wikidata.org/wiki/Q261397) | Elena Poniatowska / Элена Понятовска | French-born Mexican journalist and author / мексиканская писательница, журналистка, общественно-политическая активистка левого толка | label-name-conflict |
| `mexico:guadalupe_nettel` | [Q3118678](https://www.wikidata.org/wiki/Q3118678) | Guadalupe Nettel / Гуадалупе Неттель | Mexican writer / Писательница | label-name-conflict |
| `monaco:jean_baptiste_barla` | [Q2415098](https://www.wikidata.org/wiki/Q2415098) | Jean-Baptiste Barla / Жан-Батист Барла | French botanist (1817-1896) | literary-role-not-corroborated |
| `morocco:fatima_mernissi` | [Q242376](https://www.wikidata.org/wiki/Q242376) | Fatema Mernissi / Фатима Мерниси | 1940-2015, Moroccan sociologist, writer and feminist / марокканская писательница, социолог, публицист, феминистка | label-name-conflict |
| `namibia:gustav_frolich` | [Q5746561](https://www.wikidata.org/wiki/Q5746561) | Gustav Frölich | university teacher (1879-1940) | death-year-conflict, literary-role-not-corroborated |
| `nepal:krishna_dharabasi` | [Q13180208](https://www.wikidata.org/wiki/Q13180208) | Krishna Dharabasi | Nepalese writer | birth-year-conflict |
| `netherlands:betje_wolff` | [Q183007](https://www.wikidata.org/wiki/Q183007) | Betje Wolff / Элизабет Вольф-Беккер | Dutch writer / голландская писательница | label-name-conflict |
| `new_zealand:bill_manhire` | [Q4910026](https://www.wikidata.org/wiki/Q4910026) | Bill Manhire | New Zealand poet (born 1946) | label-name-conflict |
| `new_zealand:steven_baker` | [Q95312295](https://www.wikidata.org/wiki/Q95312295) | Steven Roger Fischer | New Zealand linguist | birth-year-conflict, literary-role-not-corroborated |
| `niger:abdoulaye_mamani` | [Q308401](https://www.wikidata.org/wiki/Q308401) | Abdoulaye Mamani / Абдулай Мамани | Poet and novelist (1932-1993) | birth-year-conflict |
| `niger:ibrahim_adam` | [Q99929822](https://www.wikidata.org/wiki/Q99929822) | Ibrahim Adam | Ghanaian politician / ганский политик | wikidata-birth-year-missing, literary-role-not-corroborated |
| `niger:mariama_hima` | [Q16937510](https://www.wikidata.org/wiki/Q16937510) | Mariama Hima | Filmmaker, ethnologist and Nigerien politician | birth-year-conflict, literary-role-not-corroborated |
| `north_korea:paek_nam_nyong` | [Q2878832](https://www.wikidata.org/wiki/Q2878832) | Baek Nam-Ryong | North Korean writer | label-name-conflict |
| `north_korea:ri_ki_yong` | [Q485218](https://www.wikidata.org/wiki/Q485218) | Ri Ki-yong / Ли Ги Ён | Korean writer (1896-1984) | birth-year-conflict |
| `oman:abdullah_habib` | [Q25451883](https://www.wikidata.org/wiki/Q25451883) | Abdullah Habib | Omani writer and internet activist | wikidata-birth-year-missing |
| `oman:jokha_alharthi` | [Q6269767](https://www.wikidata.org/wiki/Q6269767) | Jokha al-Harthi / Джоха Аль-Харти | Arabic scholar and writer / оманская писательница | label-name-conflict |
| `palau:emelihter_kihleng` | [Q4303636](https://www.wikidata.org/wiki/Q4303636) | Emelihter Kihleng / Эмелитер Киленг | Federated States of Micronesia poet | wikidata-birth-year-missing |
| `panama:ricardo_miro` | [Q5573605](https://www.wikidata.org/wiki/Q5573605) | Ricardo Miró / Рикардо Миро | Panamanian writer (1882-1940) / Панамский поэт, писатель и дипломат | birth-year-conflict |
| `panama:rogelio_sinan` | [Q9070378](https://www.wikidata.org/wiki/Q9070378) | Rogelio Sinan / Рохелио Синан | Panamanian writer (1902-1994) / па­нам­ский пи­са­тель | label-name-conflict, birth-year-conflict |
| `papua_new_guinea:raymond_gat` | [Q29167994](https://www.wikidata.org/wiki/Q29167994) | Raymond Guth / Рэймонд Гат | actor | local-birth-year-missing, literary-role-not-corroborated |
| `paraguay:gabriel_casaccia` | [Q2639230](https://www.wikidata.org/wiki/Q2639230) | Gabriel Casaccia | Paraguayan novelist (1907-1980) / парагвайский писатель | label-name-conflict |
| `peru:mario_bellatin` | [Q2156253](https://www.wikidata.org/wiki/Q2156253) | Mario Bellatin / Марио Бельятин | Mexican writer | label-name-conflict |
| `russia:robert_shtilmark` | [Q4526879](https://www.wikidata.org/wiki/Q4526879) | Robert Stillmark / Штильмарк, Роберт Александрович | Soviet writer (1909-1985) | local-birth-year-missing |
| `russia:sergey_lukyanenko` | [Q52224](https://www.wikidata.org/wiki/Q52224) | Sergey Lukyanenko / Сергей Васильевич Лукьяненко | Russian science fiction writer / российский писатель-фантаст | local-birth-year-missing |
| `samoa:lani_wendt_young` | [Q44217961](https://www.wikidata.org/wiki/Q44217961) | Lani Wendt Young | Samoan writer, editor, publisher and journalist | birth-year-conflict |
| `samoa:tusiata_avia` | [Q7856776](https://www.wikidata.org/wiki/Q7856776) | Tusiata Avia | New Zealand poet | birth-year-conflict |
| `sao_tome_and_principe:alda_do_espirito_santo` | [Q457401](https://www.wikidata.org/wiki/Q457401) | Alda da Graça | poet and politician from Sao Tome and Principe (1926-2010) / сантомейский писатель | label-name-conflict |
| `serbia:dositej_obradovic` | [Q347659](https://www.wikidata.org/wiki/Q347659) | Dositej Obradović / Доситей Обрадович | Serbian writer | birth-year-conflict |
| `seychelles:guy_lionnet` | [Q5622424](https://www.wikidata.org/wiki/Q5622424) | Guy Lionnet / Ги Льонне | Seychellois academic | birth-year-conflict, death-year-conflict, literary-role-not-corroborated |
| `sierra_leone:delia_jarrett_macauley` | [Q22957891](https://www.wikidata.org/wiki/Q22957891) | Delia Jarrett-Macauley | British writer, academic and broadcaster | birth-year-conflict |
| `solomon_islands:john_saunana` | [Q124165122](https://www.wikidata.org/wiki/Q124165122) | John Saunana | Solomon Islands writer (born 1945) | birth-year-conflict |
| `south_africa:eskia_mphahlele` | [Q1372674](https://www.wikidata.org/wiki/Q1372674) | Es'kia Mphahlele | South African writer and publisher (1919-2008) | label-name-conflict |
| `south_africa:sol_plaatje` | [Q2143151](https://www.wikidata.org/wiki/Q2143151) | Sol Plaatjie / Соломон Плааки | South African intellectual, journalist, linguist, politician, translator and writer; founding member and first General Secretary of the South African Native National Congress; regarded as the first Black South African to write a novel in English | label-name-conflict |
| `south_korea:il_yeon` | [Q484286](https://www.wikidata.org/wiki/Q484286) | Il-yeon / Ирён | Silla Buddhist monk / корейский буддийский монах | label-name-conflict |
| `south_sudan:taban_lo_liyong` | [Q508335](https://www.wikidata.org/wiki/Q508335) | Taban lo Liyong / Табан Ло Лийонг | African writer poet academic literary critism / Южносуданский поэт, писатель фэнтези и критик | birth-year-conflict |
| `spain:garcilaso_de_la_vega` | [Q311405](https://www.wikidata.org/wiki/Q311405) | Garcilaso de la Vega / Гарсиласо де ла Вега | Spanish poet (1503-1536) / испанский поэт | birth-year-conflict |
| `spain:vicente_aleixandre` | [Q134644](https://www.wikidata.org/wiki/Q134644) | Vicente Aleixandre / Висенте Алейсандре | Spanish poet (1898-1984) / испанский поэт, представитель «поколения 27 года» | label-name-conflict |
| `sudan:taj_el_sir` | [Q4746645](https://www.wikidata.org/wiki/Q4746645) | Amir Taj al-Sir | Sudanese writer and physician | label-name-conflict, birth-year-conflict |
| `sweden:stieg_larsson` | [Q186317](https://www.wikidata.org/wiki/Q186317) | Stieg Larsson / Стиг Ларссон | Swedish author (1954-2004) / шведский левый общественный деятель, писатель и журналист | local-birth-year-missing |
| `taiwan:zhong_lihe` | [Q700821](https://www.wikidata.org/wiki/Q700821) | Chûng Lî-fò / Чунг Ли-фо | Taiwanese novelist (1915-1960) / тайваньский писатель | label-name-conflict |
| `tajikistan:rudaki` | [Q312954](https://www.wikidata.org/wiki/Q312954) | Rudaki / Рудаки | Persian poet, the father of Persian poetry / персо-таджикский поэт | birth-year-conflict |
| `thailand:kulap_saipradit` | [Q6442803](https://www.wikidata.org/wiki/Q6442803) | Kulap Saipradit / Кулаб Cайпрадит | Thai journalist, novelist, political activist / Тайский романист | birth-year-conflict |
| `tunisia:aboul_qacem_echebbi` | [Q335543](https://www.wikidata.org/wiki/Q335543) | Abu al-Qasim al-Shabbi / Абуль-Касим аш-Шабби | Tunisian poet (1909-1934) / поэт | label-name-conflict |
| `turkmenistan:magtymguly_pyragy` | [Q2355095](https://www.wikidata.org/wiki/Q2355095) | Magtymguly Pyragy / Махтумкули | Turkmen spiritual leader and philosophical poet / туркменский поэт | birth-year-conflict |
| `uae:ousha_al_suwaidi` | [Q7111346](https://www.wikidata.org/wiki/Q7111346) | Ousha The Poet | Emirati poet (1920-2018) | label-name-conflict |
| `uganda:byron_kawadwa` | [Q134561593](https://www.wikidata.org/wiki/Q134561593) | Byron Kawadwa | playwright and former director of the Uganda National Theatre | birth-year-conflict |
| `uruguay:claudia_amenedo` | [Q1532132](https://www.wikidata.org/wiki/Q1532132) | Claudia Amengual / Клаудия Аменгуаль | Uruguayan writer and translator | label-name-conflict |
| `uruguay:emilio_frugoni` | [Q166298](https://www.wikidata.org/wiki/Q166298) | Emilio Frugoni / Эмилио Фругони | Uruguayan politician (1880-1969) | label-name-conflict |
| `uruguay:jose_enrique_rodo` | [Q734054](https://www.wikidata.org/wiki/Q734054) | José Enrique Rodó / Хосе Энрике Родо | Uruguayan writer (1871-1917) / уругвайский писатель | label-name-conflict |
| `uruguay:mario_levrero` | [Q3293478](https://www.wikidata.org/wiki/Q3293478) | Mario Levrero | Uruguayan writer, photographer, editor, comedian and screenwriter (1940-2004) | label-name-conflict |
| `uruguay:silvia_lago` | [Q1324172](https://www.wikidata.org/wiki/Q1324172) | Sylvia Lago | Uruguayan writer | label-name-conflict |
| `usa:blake_crouch` | [Q20630583](https://www.wikidata.org/wiki/Q20630583) | Blake Crouch / Блейк Крауч | American writer (born 1978) / американский писатель (род. 1978) | local-birth-year-missing |
| `usa:chuck_palahniuk` | [Q268181](https://www.wikidata.org/wiki/Q268181) | Chuck Palahniuk / Чак Паланик | American novelist, essayist / американский писатель и журналист | label-name-conflict |
| `usa:dan_simmons` | [Q297538](https://www.wikidata.org/wiki/Q297538) | Dan Simmons / Дэн Симмонс | American novelist (1948-2026) / американский писатель-фантаст (1948-2026) | local-birth-year-missing |
| `usa:daniel_keyes` | [Q185714](https://www.wikidata.org/wiki/Q185714) | Daniel Keyes / Дэниел Киз | American author / американский писатель | local-birth-year-missing |
| `usa:dean_koontz` | [Q272076](https://www.wikidata.org/wiki/Q272076) | Dean Koontz / Дин Кунц | American writer and screenwriter (born 1945) / американский писатель-фантаст | local-birth-year-missing |
| `usa:dennis_lehane` | [Q311744](https://www.wikidata.org/wiki/Q311744) | Dennis Lehane / Деннис Лихейн | novelist / американский писатель | label-name-conflict, local-birth-year-missing |
| `usa:donna_tartt` | [Q255339](https://www.wikidata.org/wiki/Q255339) | Donna Tartt / Донна Тартт | American writer / американская писательница | local-birth-year-missing |
| `usa:dr_seuss` | [Q298685](https://www.wikidata.org/wiki/Q298685) | Dr. Seuss / Доктор Сьюз | American children's author and cartoonist (1904-1991) / американский детский писатель и мультипликатор (1904-1991) | label-name-conflict |
| `usa:ernest_cline` | [Q3732112](https://www.wikidata.org/wiki/Q3732112) | Ernest Cline / Эрнест Клайн | American novelist, slam poet, and screenwriter (born 1972) / американский писатель (род. 1972) | local-birth-year-missing |
| `usa:gillian_flynn` | [Q311755](https://www.wikidata.org/wiki/Q311755) | Gillian Flynn / Гиллиан Флинн | American author and critic / американская писательница и критик | local-birth-year-missing |
| `usa:howard_pyle` | [Q525713](https://www.wikidata.org/wiki/Q525713) | Howard Pyle / Говард Пайл | American illustrator and author (1853-1911) | local-birth-year-missing |
| `usa:james_rollins` | [Q467404](https://www.wikidata.org/wiki/Q467404) | James Rollins / Джеймс Роллинс | American writer (born 1961) / американский писатель (род. 1961) | local-birth-year-missing |
| `usa:john_irving` | [Q310379](https://www.wikidata.org/wiki/Q310379) | John Irving / Джон Уинслоу Ирвинг | American novelist and screenwriter / американский писатель и сценарист (род. 1942) | local-birth-year-missing |
| `usa:michael_connelly` | [Q313193](https://www.wikidata.org/wiki/Q313193) | Michael Connelly / Майкл Коннелли | American novelist, journalist, crime fiction writer, and screenwriter (born 1956) | local-birth-year-missing |
| `usa:min_jin_lee` | [Q13563026](https://www.wikidata.org/wiki/Q13563026) | Lee Min Jin / Мин Джин Ли | American writer / американская писательница | local-birth-year-missing |
| `usa:patricia_highsmith` | [Q270635](https://www.wikidata.org/wiki/Q270635) | Patricia Highsmith / Патриция Хайсмит | American novelist and short story writer (1921-1995) / американская писательница (1921-1995) | local-birth-year-missing |
| `usa:ralph_ellison` | [Q299965](https://www.wikidata.org/wiki/Q299965) | Ralph Ellison / Ральф Эллисон | American novelist, literary critic, scholar and writer (1914-1994) / американский писатель | birth-year-conflict |
| `usa:robert_ludlum` | [Q224113](https://www.wikidata.org/wiki/Q224113) | Robert Ludlum / Роберт Ладлэм | American novelist (1927-2001) / американский писатель (1927-2001) | local-birth-year-missing |
| `usa:suzanne_collins` | [Q228624](https://www.wikidata.org/wiki/Q228624) | Suzanne Collins / Сьюзен Коллинз | American television writer and novelist / американская писательница и сценарист | local-birth-year-missing |
| `usa:thomas_harris` | [Q313377](https://www.wikidata.org/wiki/Q313377) | Thomas Harris / Томас Харрис | American author and screenwriter / американский писатель, журналист и сценарист, наиболее известен по серии книг про Ганнибала Лектера | local-birth-year-missing |
| `usa:tim_powers` | [Q363810](https://www.wikidata.org/wiki/Q363810) | Tim Powers / Тим Пауэрс | American science fiction writer and actor (born 1952) / американский писатель (род. 1952) | local-birth-year-missing |
| `usa:tom_clancy` | [Q105167](https://www.wikidata.org/wiki/Q105167) | Tom Clancy / Том Клэнси | American author (1947-2013) / американский писатель и сценарист компьютерных игр | local-birth-year-missing |
| `venezuela:eugenio_montejo` | [Q336535](https://www.wikidata.org/wiki/Q336535) | Eugenió Montejo / Эухенио Монтехо | Venezuelan writer (1938-2008) | label-name-conflict |
| `vietnam:nam_cao` | [Q6961060](https://www.wikidata.org/wiki/Q6961060) | Nam Cao / Нам Као | Vietnamese writer (1917-1951) / вьетнамский писатель | birth-year-conflict |

