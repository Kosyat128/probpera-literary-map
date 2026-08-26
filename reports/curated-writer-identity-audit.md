# Аудит соответствий писателей и Wikidata

- Проверено старых соответствий: **1278**.
- Активных соответствий после исправлений: **1271** (1257 уникальных QID).
- Исправлено однозначных QID: **6**; удалено ложных соответствий без безопасной замены: **7**.
- Подтверждённых ложных соответствий из известного набора осталось: **0**.
- Структурно подтверждены: **1164**; требуют ручной проверки: **107**; заблокированы: **0**.
- Из runtime исключено устаревших привязок портретов: **13**; из них реально присутствуют в старом manifest: **6**.

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
| `angola:ana_paula_tavares` | [Q59186426](https://www.wikidata.org/wiki/Q59186426) | Ana Paula Tavares | researcher ORCID ID = 0000-0003-4029-6101 | wikidata-birth-year-missing, literary-role-not-corroborated |
| `australia:gregory_david_roberts` | [Q1370495](https://www.wikidata.org/wiki/Q1370495) | Gregory David Roberts / Грегори Дэвид Робертс | Australian writer and bank robber / австралийский писатель | local-birth-year-missing |
| `australia:terry_hayes` | [Q437121](https://www.wikidata.org/wiki/Q437121) | Terry Hayes / Терри Хейс | British film producer and screenwriter | local-birth-year-missing |
| `bahrain:amin_saleh` | [Q104903512](https://www.wikidata.org/wiki/Q104903512) | Amin Saleh | Bahraini screenwriter, poet, and translator | birth-year-conflict |
| `belarus:francysk_skaryna` | [Q435320](https://www.wikidata.org/wiki/Q435320) | Francysk Skaryna / Франциск Скорина | Ruthenian humanist, bible translator and book printer / белорусский и восточнославянский первопечатник, философ, писатель, общественный деятель, предприниматель и учёный-медик | birth-year-conflict, death-year-conflict |
| `chile:diamela_eltit` | [Q2032745](https://www.wikidata.org/wiki/Q2032745) | Diamela Eltit / Диамела Эльтит | Chilean writer (born 1947) | birth-year-conflict |
| `china:cao_xueqin` | [Q182874](https://www.wikidata.org/wiki/Q182874) | Cao Xueqin / Цао Сюэцинь | Chinese novelist and poet (1710-1765) / китайский писатель | birth-year-conflict |
| `china:confucius` | [Q4604](https://www.wikidata.org/wiki/Q4604) | Confucius / Конфуций | 5th-century BCE Chinese philosopher and politician / древний мыслитель и философ Китая | birth-year-conflict, death-year-conflict |
| `china:du_fu` | [Q33772](https://www.wikidata.org/wiki/Q33772) | Du Fu / Ду Фу | Tang dynasty Chinese poet (712-770) / китайский поэт времен династии Тан | birth-year-conflict, death-year-conflict |
| `china:lao_tzu` | [Q9333](https://www.wikidata.org/wiki/Q9333) | Laozi / Лао-цзы | 6th-century BC semi-legendary Chinese philosopher, founder of Taoism / древнекитайский философ | local-birth-year-missing |
| `china:li_bai` | [Q7071](https://www.wikidata.org/wiki/Q7071) | Li Bai / Ли Бо | Classical Chinese poet of the Tang dynasty (701-762) / китайский поэт времен династии Тан | birth-year-conflict, death-year-conflict |
| `china:shi_naian` | [Q1777502](https://www.wikidata.org/wiki/Q1777502) | Shi Nai'an / Ши Найань | Chinese writer (1296-1372) / китайский писатель | local-birth-year-missing |
| `china:sima_qian` | [Q9372](https://www.wikidata.org/wiki/Q9372) | Sima Qian / Сыма Цянь | 2nd-century BCE Chinese historian and writer | birth-year-conflict |
| `china:tao_yuanming` | [Q314210](https://www.wikidata.org/wiki/Q314210) | Tao Yuanming / Тао Юаньмин | Chinese poet (365-427) | birth-year-conflict, death-year-conflict |
| `china:zhuangzi` | [Q47739](https://www.wikidata.org/wiki/Q47739) | Zhuang Zhou / Чжуан-цзы | Chinese Taoist philosopher (c. 369-286 BC) / китайский философ | birth-year-conflict, death-year-conflict |
| `colombia:santiago_gamboa` | [Q2420039](https://www.wikidata.org/wiki/Q2420039) | Santiago Gamboa / Сантьяго Гамбоа | Colombian writer | birth-year-conflict |
| `costa_rica:carmen_lyra` | [Q2939620](https://www.wikidata.org/wiki/Q2939620) | Carmen Lyra / Кармен Лира | Costa Rican politician and writer | birth-year-conflict |
| `cyprus:alex_michaelides` | [Q62071397](https://www.wikidata.org/wiki/Q62071397) | Alex Michaelides / Алекс Михаэлидес | author and screenwriter | local-birth-year-missing |
| `djibouti:aden_robleh_awaleh` | [Q967740](https://www.wikidata.org/wiki/Q967740) | Aden Robleh Awaleh | Djiboutian politician (1941-2014) | birth-year-conflict, literary-role-not-corroborated |
| `england:agatha_christie` | [Q35064](https://www.wikidata.org/wiki/Q35064) | Agatha Christie / Агата Кристи | English mystery and detective writer (1890-1976) / английская писательница и драматург (1890-1976) | local-birth-year-missing |
| `england:alex_garland` | [Q542634](https://www.wikidata.org/wiki/Q542634) | Alex Garland / Алекс Гарленд | British writer, scriptwriter and film director (born 1970) / британский писатель, режиссёр и сценарист (род. 1970) | local-birth-year-missing |
| `england:anthony_burgess` | [Q217619](https://www.wikidata.org/wiki/Q217619) | Anthony Burgess / Энтони Бёрджесс | English writer and composer (1917-1993) / английский писатель (1917-1993) | local-birth-year-missing |
| `england:bede` | [Q154938](https://www.wikidata.org/wiki/Q154938) | Bede / Беда Достопочтенный | Anglo-Saxon monk, writer and saint (672/3-735) / английский католический бенедиктинский монах и религиозный деятель | birth-year-conflict, death-year-conflict |
| `england:diane_setterfield` | [Q2550958](https://www.wikidata.org/wiki/Q2550958) | Diane Setterfield / Диана Сеттерфилд | English novelist | local-birth-year-missing |
| `england:frederick_forsyth` | [Q249197](https://www.wikidata.org/wiki/Q249197) | Frederick Forsyth / Фредерик Форсайт | English novelist (1938-2025) / английский писатель (1938-2025) | local-birth-year-missing |
| `england:hilary_mantel` | [Q465700](https://www.wikidata.org/wiki/Q465700) | Hilary Mantel / Хилари Мантел | British writer (1952-2022) / британская писательница (1952-2022) | local-birth-year-missing |
| `england:ian_mcewan` | [Q190379](https://www.wikidata.org/wiki/Q190379) | Ian McEwan / Иэн Макьюэн | British author (born 1948) / британский писатель | local-birth-year-missing |
| `england:joanne_harris` | [Q234718](https://www.wikidata.org/wiki/Q234718) | Joanne Harris / Джоанн Харрис | British and French author | local-birth-year-missing |
| `england:john_le_carre` | [Q209641](https://www.wikidata.org/wiki/Q209641) | John le Carré / Джон ле Карре | British novelist and spy (1931-2020) / английский писатель (1931-2020) | local-birth-year-missing |
| `england:john_marrs` | [Q64014274](https://www.wikidata.org/wiki/Q64014274) | John Marrs / Джон Маррс | British science fiction and suspense writer / британский писатель | local-birth-year-missing |
| `england:lee_child` | [Q333719](https://www.wikidata.org/wiki/Q333719) | Lee Child / Ли Чайлд | British thriller writer (born 1954) / британский писатель (род. 1954) | local-birth-year-missing |
| `england:paula_hawkins` | [Q20732317](https://www.wikidata.org/wiki/Q20732317) | Paula Hawkins / Пола Хокинс | British writer | local-birth-year-missing |
| `england:rafael_sabatini` | [Q345104](https://www.wikidata.org/wiki/Q345104) | Rafael Sabatini / Рафаэль Сабатини | Italian-English writer (1875-1950) / английский и итальянский писатель, прославившийся приключенческими историческими романами, в частности, романами о капитане Бладе (1875-1950) | local-birth-year-missing |
| `england:stuart_turton` | [Q55474411](https://www.wikidata.org/wiki/Q55474411) | Stuart Turton / Стюарт Тёртон | UK author / британский писатель | local-birth-year-missing |
| `eritrea:alemseged_tesfai` | [Q55991620](https://www.wikidata.org/wiki/Q55991620) | Alemseged Tesfai |  | birth-year-conflict, literary-role-not-corroborated |
| `fiji:brij_lal` | [Q2925538](https://www.wikidata.org/wiki/Q2925538) | Brij Lal / Бридж Лал | Fijian historian | literary-role-not-corroborated |
| `finland:fredrika_bremer` | [Q262145](https://www.wikidata.org/wiki/Q262145) | Fredrika Bremer / Фредрика Бремер | Swedish writer and feminist (1801-1865) / шведская писательница и феминистка | birth-year-conflict, death-year-conflict |
| `france:franck_thilliez` | [Q779144](https://www.wikidata.org/wiki/Q779144) | Franck Thilliez / Франк Тилье | French writer (born 1973) | local-birth-year-missing |
| `france:racine` | [Q742](https://www.wikidata.org/wiki/Q742) | Jean Racine / Жан Расин | French dramatist (1639-1699) / французский драматург | wikidata-birth-year-missing |
| `georgia:shota_rustaveli` | [Q132984](https://www.wikidata.org/wiki/Q132984) | Shota Rustaveli / Шота Руставели | Georgian poet / грузинский поэт XII века | local-birth-year-missing |
| `germany:sebastian_brant` | [Q60351](https://www.wikidata.org/wiki/Q60351) | Sebastian Brant / Себастьян Брант | German humanist and satirist / немецкий сатирик, прозаик, поэт, юрист | birth-year-conflict |
| `guatemala:luis_cardoza_y_aragon` | [Q6700406](https://www.wikidata.org/wiki/Q6700406) | Luis Cardoza y Aragón / Луис Кардоса-и-Арагон | Guatemalan writer and diplomat | birth-year-conflict |
| `india:bhartrihari` | [Q335161](https://www.wikidata.org/wiki/Q335161) | Bhartṛhari / Бхартрихари | Indian linguist, poet and writer / индийский лингвист, поэт и философ | local-birth-year-missing |
| `india:bhavabhuti` | [Q29057](https://www.wikidata.org/wiki/Q29057) | Bhavabhūti / Бхавабхути | classical Sanskrit scholar, poet, and playwright of 8th century India | local-birth-year-missing |
| `india:kalidasa` | [Q7011](https://www.wikidata.org/wiki/Q7011) | Kalidasa / Калидаса | A classical Sanskrit writer widely regarded as the greatest poet and dramatist of ancient India. / индийский поэт | local-birth-year-missing |
| `india:surdas` | [Q1325652](https://www.wikidata.org/wiki/Q1325652) | Surdas / Сурдас | Indian writer | birth-year-conflict, death-year-conflict |
| `india:valmiki` | [Q715607](https://www.wikidata.org/wiki/Q715607) | Valmiki / Вальмики | Celebrated as the harbinger-poet in Sanskrit literature and the author of the epic Ramayana | local-birth-year-missing |
| `iran:forugh_farrokhzad` | [Q464394](https://www.wikidata.org/wiki/Q464394) | Forugh Farrokhzad / Форуг Фаррохзад | Iranian poet (1935-1967) / Форуг Фаррохзад - иранская поэтесса и кинорежиссёр | birth-year-conflict |
| `iran:hafez` | [Q6240](https://www.wikidata.org/wiki/Q6240) | Hafez / Хафиз Ширази | Persian poet and mystic (1325-1389) / персидский поэт и суфийский мастер | birth-year-conflict, death-year-conflict |
| `iraq:abu_nuwas` | [Q5670](https://www.wikidata.org/wiki/Q5670) | Abu Nuwas / Абу Нувас | 8th-century classical Arabic poet / арабский поэт | birth-year-conflict, death-year-conflict |
| `iraq:al_mutanabbi` | [Q284542](https://www.wikidata.org/wiki/Q284542) | Al-Mutanabbi / Аль-Мутанабби | Arab poet (c. 915 - 965) / арабский поэт | birth-year-conflict, death-year-conflict |
| `iraq:nazik_al_malaika` | [Q446761](https://www.wikidata.org/wiki/Q446761) | Nazik Al-Malaika / Назик аль-Малаика | Iraqi poet (1922-2007) | birth-year-conflict |
| `italy:cesare_beccaria` | [Q223723](https://www.wikidata.org/wiki/Q223723) | Cesare Beccaria / Чезаре Беккариа | jurist, philosopher and politician from Italy (1738-1794) | literary-role-not-corroborated |
| `italy:emilio_salgari` | [Q309786](https://www.wikidata.org/wiki/Q309786) | Emilio Salgari / Эмилио Сальгари | Italian writer (1862-1911) / итальянский писатель | local-birth-year-missing |
| `japan:murasaki_shikibu` | [Q81731](https://www.wikidata.org/wiki/Q81731) | Murasaki Shikibu / Мурасаки Сикибу | Japanese novelist and poet (c.973-c.1014) / японская поэтесса и писательница XI века | birth-year-conflict |
| `japan:sei_shonagon` | [Q231603](https://www.wikidata.org/wiki/Q231603) | Sei Shōnagon / Сэй-Сёнагон | Japanese author and court lady / японская писательница X-XI веков | birth-year-conflict |
| `jordan:munif_al_razzaz` | [Q6936630](https://www.wikidata.org/wiki/Q6936630) | Munif al-Razzaz | Syrian politician (1919-1984) | literary-role-not-corroborated |
| `kenya:billy_kahora` | [Q5897263](https://www.wikidata.org/wiki/Q5897263) | Billy Kahora | Kenyan writer | birth-year-conflict |
| `kyrgyzstan:musa_jangaziev` | [Q20625839](https://www.wikidata.org/wiki/Q20625839) | Musa Jangaziev / Муса Джангазиев | Kyrgyz poet / киргизский советский писатель | birth-year-conflict, death-year-conflict |
| `laos:phoumi_vongvichit` | [Q878933](https://www.wikidata.org/wiki/Q878933) | Phoumi Vongvichit / Пхуми Вонгвичит | President of Laos (1909-1994) | literary-role-not-corroborated |
| `liechtenstein:hansjorg_quaderer` | [Q85101361](https://www.wikidata.org/wiki/Q85101361) | Hansjörg Quaderer | Liechtensteiner painter (born 1958) | birth-year-conflict, literary-role-not-corroborated |
| `liechtenstein:ida_ospelt_amann` | [Q1656540](https://www.wikidata.org/wiki/Q1656540) | Ida Ospelt-Amann | Liechtensteiner vernacular poet, author and writer (1899-1996) | birth-year-conflict, death-year-conflict |
| `liechtenstein:jurg_hanselmann` | [Q15445061](https://www.wikidata.org/wiki/Q15445061) | Jürg Hanselmann | Swiss pianist | literary-role-not-corroborated |
| `madagascar:jean_francois_samlong` | [Q3165880](https://www.wikidata.org/wiki/Q3165880) | Jean-François Samlong | French poet | birth-year-conflict |
| `mali:amadou_hampate_ba` | [Q452299](https://www.wikidata.org/wiki/Q452299) | Amadou Hampâté Bâ / Амаду Ампате Ба | Malian writer, historian and ethnologist | birth-year-conflict |
| `mali:modibo_sounkalo_keita` | [Q15407222](https://www.wikidata.org/wiki/Q15407222) | Modibo Sounkalo Keita | Malian journalist | literary-role-not-corroborated |
| `monaco:jean_baptiste_barla` | [Q2415098](https://www.wikidata.org/wiki/Q2415098) | Jean-Baptiste Barla / Жан-Батист Барла | French botanist (1817-1896) | literary-role-not-corroborated |
| `namibia:gustav_frolich` | [Q5746561](https://www.wikidata.org/wiki/Q5746561) | Gustav Frölich | university teacher (1879-1940) | death-year-conflict, literary-role-not-corroborated |
| `nepal:krishna_dharabasi` | [Q13180208](https://www.wikidata.org/wiki/Q13180208) | Krishna Dharabasi | Nepalese writer | birth-year-conflict |
| `new_zealand:steven_baker` | [Q95312295](https://www.wikidata.org/wiki/Q95312295) | Steven Roger Fischer | New Zealand linguist | birth-year-conflict, literary-role-not-corroborated |
| `niger:abdoulaye_mamani` | [Q308401](https://www.wikidata.org/wiki/Q308401) | Abdoulaye Mamani / Абдулай Мамани | Poet and novelist (1932-1993) | birth-year-conflict |
| `niger:ibrahim_adam` | [Q99929822](https://www.wikidata.org/wiki/Q99929822) | Ibrahim Adam | Ghanaian politician / ганский политик | wikidata-birth-year-missing, literary-role-not-corroborated |
| `niger:mariama_hima` | [Q16937510](https://www.wikidata.org/wiki/Q16937510) | Mariama Hima | Filmmaker, ethnologist and Nigerien politician | birth-year-conflict, literary-role-not-corroborated |
| `north_korea:ri_ki_yong` | [Q485218](https://www.wikidata.org/wiki/Q485218) | Ri Ki-yong / Ли Ги Ён | Korean writer (1896-1984) | birth-year-conflict |
| `oman:abdullah_habib` | [Q25451883](https://www.wikidata.org/wiki/Q25451883) | Abdullah Habib | Omani writer and internet activist | wikidata-birth-year-missing |
| `palau:emelihter_kihleng` | [Q4303636](https://www.wikidata.org/wiki/Q4303636) | Emelihter Kihleng / Эмелитер Киленг | Federated States of Micronesia poet | wikidata-birth-year-missing |
| `panama:ricardo_miro` | [Q5573605](https://www.wikidata.org/wiki/Q5573605) | Ricardo Miró / Рикардо Миро | Panamanian writer (1882-1940) / Панамский поэт, писатель и дипломат | birth-year-conflict |
| `papua_new_guinea:raymond_gat` | [Q29167994](https://www.wikidata.org/wiki/Q29167994) | Raymond Guth / Рэймонд Гат | actor | local-birth-year-missing, literary-role-not-corroborated |
| `russia:sergey_lukyanenko` | [Q52224](https://www.wikidata.org/wiki/Q52224) | Sergey Lukyanenko / Сергей Васильевич Лукьяненко | Russian science fiction writer / российский писатель-фантаст | local-birth-year-missing |
| `samoa:lani_wendt_young` | [Q44217961](https://www.wikidata.org/wiki/Q44217961) | Lani Wendt Young | Samoan writer, editor, publisher and journalist | birth-year-conflict |
| `samoa:tusiata_avia` | [Q7856776](https://www.wikidata.org/wiki/Q7856776) | Tusiata Avia | New Zealand poet | birth-year-conflict |
| `serbia:dositej_obradovic` | [Q347659](https://www.wikidata.org/wiki/Q347659) | Dositej Obradović / Доситей Обрадович | Serbian writer | birth-year-conflict |
| `seychelles:guy_lionnet` | [Q5622424](https://www.wikidata.org/wiki/Q5622424) | Guy Lionnet / Ги Льонне | Seychellois academic | birth-year-conflict, death-year-conflict, literary-role-not-corroborated |
| `sierra_leone:delia_jarrett_macauley` | [Q22957891](https://www.wikidata.org/wiki/Q22957891) | Delia Jarrett-Macauley | British writer, academic and broadcaster | birth-year-conflict |
| `solomon_islands:john_saunana` | [Q124165122](https://www.wikidata.org/wiki/Q124165122) | John Saunana | Solomon Islands writer (born 1945) | birth-year-conflict |
| `south_sudan:taban_lo_liyong` | [Q508335](https://www.wikidata.org/wiki/Q508335) | Taban lo Liyong / Табан Ло Лийонг | African writer poet academic literary critism / Южносуданский поэт, писатель фэнтези и критик | birth-year-conflict |
| `spain:garcilaso_de_la_vega` | [Q311405](https://www.wikidata.org/wiki/Q311405) | Garcilaso de la Vega / Гарсиласо де ла Вега | Spanish poet (1503-1536) / испанский поэт | birth-year-conflict |
| `tajikistan:rudaki` | [Q312954](https://www.wikidata.org/wiki/Q312954) | Rudaki / Рудаки | Persian poet, the father of Persian poetry / персо-таджикский поэт | birth-year-conflict |
| `thailand:kulap_saipradit` | [Q6442803](https://www.wikidata.org/wiki/Q6442803) | Kulap Saipradit / Кулаб Cайпрадит | Thai journalist, novelist, political activist / Тайский романист | birth-year-conflict |
| `turkmenistan:magtymguly_pyragy` | [Q2355095](https://www.wikidata.org/wiki/Q2355095) | Magtymguly Pyragy / Махтумкули | Turkmen spiritual leader and philosophical poet / туркменский поэт | birth-year-conflict |
| `uganda:byron_kawadwa` | [Q134561593](https://www.wikidata.org/wiki/Q134561593) | Byron Kawadwa | playwright and former director of the Uganda National Theatre | birth-year-conflict |
| `usa:blake_crouch` | [Q20630583](https://www.wikidata.org/wiki/Q20630583) | Blake Crouch / Блейк Крауч | American writer (born 1978) / американский писатель (род. 1978) | local-birth-year-missing |
| `usa:dan_simmons` | [Q297538](https://www.wikidata.org/wiki/Q297538) | Dan Simmons / Дэн Симмонс | American novelist (1948-2026) / американский писатель-фантаст (1948-2026) | local-birth-year-missing |
| `usa:daniel_keyes` | [Q185714](https://www.wikidata.org/wiki/Q185714) | Daniel Keyes / Дэниел Киз | American author / американский писатель | local-birth-year-missing |
| `usa:dean_koontz` | [Q272076](https://www.wikidata.org/wiki/Q272076) | Dean Koontz / Дин Кунц | American writer and screenwriter (born 1945) / американский писатель-фантаст | local-birth-year-missing |
| `usa:donna_tartt` | [Q255339](https://www.wikidata.org/wiki/Q255339) | Donna Tartt / Донна Тартт | American writer / американская писательница | local-birth-year-missing |
| `usa:ernest_cline` | [Q3732112](https://www.wikidata.org/wiki/Q3732112) | Ernest Cline / Эрнест Клайн | American novelist, slam poet, and screenwriter (born 1972) / американский писатель (род. 1972) | local-birth-year-missing |
| `usa:gillian_flynn` | [Q311755](https://www.wikidata.org/wiki/Q311755) | Gillian Flynn / Гиллиан Флинн | American author and critic / американская писательница и критик | local-birth-year-missing |
| `usa:howard_pyle` | [Q525713](https://www.wikidata.org/wiki/Q525713) | Howard Pyle / Говард Пайл | American illustrator and author (1853-1911) | local-birth-year-missing |
| `usa:james_rollins` | [Q467404](https://www.wikidata.org/wiki/Q467404) | James Rollins / Джеймс Роллинс | American writer (born 1961) / американский писатель (род. 1961) | local-birth-year-missing |
| `usa:min_jin_lee` | [Q13563026](https://www.wikidata.org/wiki/Q13563026) | Lee Min Jin / Мин Джин Ли | American writer / американская писательница | local-birth-year-missing |
| `usa:patricia_highsmith` | [Q270635](https://www.wikidata.org/wiki/Q270635) | Patricia Highsmith / Патриция Хайсмит | American novelist and short story writer (1921-1995) / американская писательница (1921-1995) | local-birth-year-missing |
| `usa:ralph_ellison` | [Q299965](https://www.wikidata.org/wiki/Q299965) | Ralph Ellison / Ральф Эллисон | American novelist, literary critic, scholar and writer (1914-1994) / американский писатель | birth-year-conflict |
| `usa:robert_ludlum` | [Q224113](https://www.wikidata.org/wiki/Q224113) | Robert Ludlum / Роберт Ладлэм | American novelist (1927-2001) / американский писатель (1927-2001) | local-birth-year-missing |
| `usa:suzanne_collins` | [Q228624](https://www.wikidata.org/wiki/Q228624) | Suzanne Collins / Сьюзен Коллинз | American television writer and novelist / американская писательница и сценарист | local-birth-year-missing |
| `usa:tim_powers` | [Q363810](https://www.wikidata.org/wiki/Q363810) | Tim Powers / Тим Пауэрс | American science fiction writer and actor (born 1952) / американский писатель (род. 1952) | local-birth-year-missing |
| `vietnam:nam_cao` | [Q6961060](https://www.wikidata.org/wiki/Q6961060) | Nam Cao / Нам Као | Vietnamese writer (1917-1951) / вьетнамский писатель | birth-year-conflict |

