# Фактологическая проверка биографий писателей - Batch 15

Изолированная claim-by-claim проверка следующей лексикографической границы final reviewQueue. Runtime и общие country-файлы не подключались и не изменялись.

## Итог

- Записей: 20
- Без изменений: 5
- Исправлено: 12
- Удержано в карантине: 3

## Метод и граница

Ключи получены сортировкой и дедупликацией `reports/writer-biography-fact-qa.json.reviewQueue` после исключения frozen/assigned Batch 01-14 и существовавших на момент назначения `quarantinedWriterIdentities`. Граница зафиксирована до фактологической проверки: 20 уникальных ключей, пересечение с исключёнными ключами - 0.

Каждое смысловое утверждение проверено минимум по двум независимым HTTPS-источникам институционального, официального, библиотечного, академического, издательского либо премиального происхождения. Wikidata и Wikipedia не использовались как доказательные источники. Неподдержанные ранги и суперлативы сняты; исходный текст сохранён дословно только там, где он полностью подтверждён.

Held означает, что исходная карточка не может быть безопасно применена: литературная идентичность не установлена либо доказана неверная страна/дублирующая привязка. В таких записях `applicableTextRu` равен `null`; `reviewedTextRu` является только редакционным объяснением и не предназначен для публичного применения.

## Записи

### `burundi:jean_pierre_hatungimana`

- Решение: `held`
- SHA-256 исходного русского текста: `cedf743b5e7ddf717a5a7eccd4c965b1391b30e2c483a826f4e782f5be3b370d`
- Применимый текст: - (held; публичное применение запрещено)
- Примечание: Held: отсутствие совпадений в двух независимых каталогах не доказывает несуществование автора, поэтому исходный текст не заменяется догадкой и не применяется публично. Identity registry: not-mapped. Рекомендация по датам - убрать неподтверждённый birthDate 1963 до установления личности. Shared country files не изменялись.
- Проверенные утверждения:
  - Надёжно связать имя Жан-Пьера Хатунгиманы с заявленной карточкой бурундийского писателя не удалось. (`not-established`)
    - [Library of Congress Online Catalog](https://catalog.loc.gov/vwebv/search?searchArg=Jean-Pierre+Hatungimana&searchCode=GKEY%5E*&searchType=0&recCount=25) - Поиск по точному имени не выявил авторитетной библиографической записи, которую можно однозначно связать с заявленным бурундийским писателем. Проверено: 2026-08-09.
    - [WorldCat - OCLC](https://search.worldcat.org/search?q=%22Jean-Pierre%20Hatungimana%22%20Burundi) - Поиск имени вместе со страной не выявил изданий или authority identity, подтверждающих исходную карточку. Проверено: 2026-08-09.

### `burundi:roland_rugero`

- Решение: `corrected`
- SHA-256 исходного русского текста: `ceabe13be8c72591495a3638f3c24a4924c3de54271eb02f3ae81a8b19a9c9f3`
- Применимый текст: Бурундийский писатель и журналист, автор романов «Les Oniriques» и «Baho!». В 2009 году получил бронзовую медаль литературного конкурса Игр Франкофонии.
- Примечание: Неподтверждённая сравнительная оценка заметности снята и заменена конкретными произведениями и наградой. Identity audit corroborated. Доказанная рекомендация - уточнить birthDate с годового 1986 до 1986-02-22. Shared country files не изменялись.
- Проверенные утверждения:
  - Ролан Ружеро - бурундийский писатель и журналист, автор романов «Les Oniriques» и «Baho!», бронзовый призёр литературного конкурса Игр Франкофонии 2009 года. (`corrected`)
    - [International Writing Program - University of Iowa](https://iwp.uiowa.edu/writers/2013-resident/rugero-roland) - Университетский профиль называет Ружеро бурундийским прозаиком и журналистом и перечисляет романы Les Oniriques и Baho. Проверено: 2026-08-09.
    - [Éditions Vents d'ailleurs](https://www.ventsdailleurs.com/index.php/les-auteurs/item/roland-rugero) - Профиль издателя подтверждает авторство двух романов, журналистскую работу и рождение 22 февраля 1986 года. Проверено: 2026-08-09.
    - [Jeux de la Francophonie - OIF](https://www.jeux.francophonie.org/sites/default/files/public/CV/cv_roland_rugero.pdf) - Официальная справка Игр Франкофонии фиксирует бронзовую медаль литературного конкурса 2009 года и библиографию автора. Проверено: 2026-08-09.

### `cambodia:ang_duong`

- Решение: `corrected`
- SHA-256 исходного русского текста: `4b838cd15e4e9b3d520981bb48481f904ba401f03f0ac5897d34d77138790a76`
- Применимый текст: Король Камбоджи Анг Дуонг - автор кхмерской стихотворной повести «Ка Кей». В середине XIX века он поддерживал восстановление кхмерской буддийской литературы.
- Примечание: Расплывчатая формулировка заменена конкретным литературным произведением и документированной культурной деятельностью. Identity audit corroborated. Рекомендация - сохранить годовые birthDate 1796 и deathDate 1860: выбранные главные источники не дают достаточной опоры для искусственной точности дня и месяца. Shared country files не изменялись.
- Проверенные утверждения:
  - Анг Дуонг был королём Камбоджи, написал кхмерскую повесть «Ка Кей» и поддерживал восстановление буддийской письменной культуры. (`corrected`)
    - [Office of the Council of Ministers of Cambodia](https://pressocm.gov.kh/en/archives/60114) - Официальный материал правительства Камбоджи связывает короля Анг Дуонга с авторством истории Ka Key. Проверено: 2026-08-09.
    - [Cambridge University Press](https://www.cambridge.org/core/product/identifier/CBO9789814519076A034/type/BOOK_PART) - Академическая глава подтверждает правление Анг Дуонга и его поддержку восстановления кхмерской буддийской литературы и переводов. Проверено: 2026-08-09.

### `cambodia:nou_hach`

- Решение: `corrected`
- SHA-256 исходного русского текста: `d85f402a627beb25e8e191db0c334bf68b015f8b6a0a6d06b9964b2b57202c9d`
- Применимый текст: Камбоджийский писатель, автор романов «Увядший цветок» (Phka Srapoun) и «Гирлянда сердца» (Mealea Doung Chet).
- Примечание: Оценочный ранг «классик» заменён проверяемой библиографией. Identity audit corroborated. Рекомендация - оставить birthDate 1916 и deathDate 1975 на уровне годов; точные дни выбранными источниками не установлены. Shared country files не изменялись.
- Проверенные утверждения:
  - Ноу Хач - камбоджийский писатель, автор романов Phka Srapoun и Mealea Doung Chet. (`corrected`)
    - [Center for Khmer Studies Library](https://library.khmerstudies.org/bib/8993) - Институциональный каталог фиксирует Ноу Хача как автора романа Phka Srapoun, известного по английскому названию Wilted Flower. Проверено: 2026-08-09.
    - [Words Without Borders](https://wordswithoutborders.org/read/article/2015-11/cambodia-from-angkor-to-year-zero/) - Литературная некоммерческая организация относит Wilted Flower Ноу Хача к ранним камбоджийским романам, сохраняющим читательское значение. Проверено: 2026-08-09.
    - [Center for Khmer Studies Library](https://library.khmerstudies.org/bib/5494) - Каталог Центра кхмерских исследований подтверждает авторскую связь Ноу Хача с Mealea Doung Chet. Проверено: 2026-08-09.

### `cambodia:soth_polin`

- Решение: `corrected`
- SHA-256 исходного русского текста: `b6410c0981895123b8182a57673b90fa1c18865499ff321f9c5f05064f87586a`
- Применимый текст: Камбоджийский писатель и журналист, автор романов «Бессмысленная жизнь» и «Анархист». В конце 1960-х годов основал газету и издательство Nokor Thom.
- Примечание: Оценка заметности заменена ролями, произведениями и издательской деятельностью. Identity audit corroborated. Рекомендация - сохранить годовой birthDate 1943: оба источника подтверждают год, но не дают дня и месяца. Shared country files не изменялись.
- Проверенные утверждения:
  - Сот Полин - камбоджийский писатель и журналист, автор романов A Meaningless Life и The Anarchist и основатель газеты и издательства Nokor Thom. (`corrected`)
    - [Words Without Borders](https://wordswithoutborders.org/contributors/view/soth-polin/) - Профиль автора подтверждает рождение в Камбодже в 1943 году, романы A Meaningless Life и The Anarchist и основание Nokor Thom. Проверено: 2026-08-09.
    - [Center for Khmer Studies](https://khmerstudies.org/wp-content/uploads/2021/06/modern-short-story3-en.pdf) - Институциональное издание представляет Сот Полина как камбоджийского журналиста и романиста, называет дебютный роман и его издательскую деятельность. Проверено: 2026-08-09.

### `cameroon:calixthe_beyala`

- Решение: `corrected`
- SHA-256 исходного русского текста: `d32b0ae9a9bcba7800102b27407546dba860fd7d9c382872c57238a31b3b79e7`
- Применимый текст: Камерунская франкоязычная писательница, автор романов «Assèze l’Africaine» и «Les Honneurs perdus». Роман «Les Honneurs perdus» получил Большую премию Французской академии в 1996 году.
- Примечание: Оценка известности снята и заменена конкретными романами и наградой. Identity audit corroborated. Доказанная рекомендация - заменить чрезмерно точный birthDate 1961-10-26 на годовой 1961: Hachette и BnF подтверждают год, но не этот день и месяц. Shared country files не изменялись.
- Проверенные утверждения:
  - Каликст Бейяла - родившаяся в Камеруне франкоязычная писательница; её роман Les Honneurs perdus получил Большую премию Французской академии в 1996 году. (`corrected`)
    - [Hachette](https://www.hachette.fr/auteur/calixthe-beyala/) - Профиль издателя подтверждает рождение в Камеруне в 1961 году, романы Assèze l’Africaine и Les Honneurs perdus и литературные награды. Проверено: 2026-08-09.
    - [Académie française](https://www.academie-francaise.fr/calixthe-beyala) - Официальная страница Академии фиксирует оба романа и Большую премию за Les Honneurs perdus в 1996 году. Проверено: 2026-08-09.
    - [Bibliothèque nationale de France](https://catalogue.bnf.fr/rechercher.do?index=AUT3&numNotice=12072936) - Национальный каталог подтверждает авторство Бейялы и год рождения 1961. Проверено: 2026-08-09.

### `cameroon:emmanuel_dongala`

- Решение: `held`
- SHA-256 исходного русского текста: `f59b33e5c4594662437e23c28978f72553682d26e5c3674de2479b5af8a5b050`
- Применимый текст: - (held; публичное применение запрещено)
- Примечание: Held: identity established, but country association is false. Canonical duplicate exists as republic_of_congo:emmanuel_dongala; применять текст к Cameroon нельзя. Рекомендация - удалить или перенаправить камерунский дубль, сохранив year-level birthDate 1941 только в канонической карточке. Shared country files не изменялись.
- Проверенные утверждения:
  - Эмманюэль Донгала связан с Республикой Конго, а не с Камеруном; камерунская карточка является межстрановым дублем. (`not-established`)
    - [Bard College](https://www.bard.edu/news/releases/pr/fstory.php?id=9599) - Университетский профиль называет Донгалу романистом из Республики Конго и профессором химии. Проверено: 2026-08-09.
    - [Bard College Human Rights Project](https://hrp.bard.edu/emmanuel-dongala-billy-kahora-and-nnedi-okorafor/) - Институциональная биография характеризует Эмманюэля Бундзеки Донгалу как конголезского химика и романиста и перечисляет его книги. Проверено: 2026-08-09.
    - [Bibliothèque nationale de France](https://data.bnf.fr/fr/ark%3A/12148/cb165745777.pdf) - Национальная библиотека связывает Эмманюэля Донгалу с романом Un fusil dans la main, un poème dans la poche и подтверждает авторскую идентичность. Проверено: 2026-08-09.

### `cameroon:etienne_goyemide`

- Решение: `held`
- SHA-256 исходного русского текста: `c349a04de5899b004dd0ef07492906037fb127ccc23bc601838fa4d916b5eebd`
- Применимый текст: - (held; публичное применение запрещено)
- Примечание: Held: identity established, but country association is false. Canonical duplicate exists as central_african_republic:etienne_goyemide; применять текст к Cameroon нельзя. Доказанная рекомендация для канонической карточки - birthDate 1942-01-22 и deathDate 1997-03-17 по двум профильным записям; камерунский дубль удалить или перенаправить. Shared country files не изменялись.
- Проверенные утверждения:
  - Этьен Гойемиде связан с Центральноафриканской Республикой, а не с Камеруном; камерунская карточка является межстрановым дублем. (`not-established`)
    - [Africultures](https://africultures.com/personnes/?no=3527) - Профиль указывает Центральноафриканскую Республику, роли писателя и драматурга, годы жизни 1942-1997 и библиографию. Проверено: 2026-08-09.
    - [Bibliothèque nationale de France](https://catalogue.bnf.fr/ark%3A/12148/cb37399180n) - Национальный каталог подтверждает авторство Étienne Goyémidé, годы 1942-1997 и роман Le dernier survivant de la caravane. Проверено: 2026-08-09.
    - [Les Francophonies](https://www.lesfrancophonies.fr/IMG/pdf/plaquette-25ans-2.pdf) - Архив фестиваля относит Этьена Гойемиде к Центральноафриканской Республике. Проверено: 2026-08-09.

### `cameroon:ferdinand_oyono`

- Решение: `corrected`
- SHA-256 исходного русского текста: `139be8e5e12dc9eae79e165271d202d7534a9150f1ffd39d89b14d82c5cd67d7`
- Применимый текст: Камерунский писатель и дипломат, автор романов «Une vie de boy», «Le Vieux Nègre et la Médaille» и «Chemin d’Europe».
- Примечание: Оценочный ранг «классик» заменён конкретной библиографией; писательская и дипломатическая роли сохранены. Identity audit corroborated. Рекомендация - сохранить birthDate 1929-09-14 и deathDate 2010-06-10: даты согласуются с авторитетными биографическими и дипломатическими записями. Shared country files не изменялись.
- Проверенные утверждения:
  - Фердинанд Ойоно был камерунским писателем и дипломатом, автором трёх опубликованных романов. (`corrected`)
    - [United Nations](https://www.un.org/sg/en/content/former-secretary-general/statements/2010-06-10/secretary-generals-remarks-the-republic-of-cameroon-national-assembly-delivered) - Генеральный секретарь ООН назвал Ойоно бывшим министром, писателем и бывшим постоянным представителем Камеруна при ООН и зафиксировал смерть 10 июня 2010 года. Проверено: 2026-08-09.
    - [United Nations Digital Library](https://digitallibrary.un.org/record/3808623?ln=en) - Биографическая запись ООН подтверждает дипломатическую идентичность Фердинанда Леопольда Ойоно и его руководство Исполнительным советом ЮНИСЕФ. Проверено: 2026-08-09.
    - [Bibliothèque nationale de France](https://data.bnf.fr/en/see_all_activities/12170141/page1) - Национальная библиотека подтверждает годы жизни 1929-2010 и перечисляет роман Une vie de boy (1956) в библиографии Ойоно. Проверено: 2026-08-09.

### `cameroon:jean_roger_essomba`

- Решение: `corrected`
- SHA-256 исходного русского текста: `b1b264d79a19971ffa0848aaf2e614a832c318bb9a7431d1a9618a86e6d37c04`
- Применимый текст: Камерунский писатель и издатель, автор романов «Le Dernier Gardien de l’arbre» и «Le Paradis du Nord».
- Примечание: Общая тавтологичная формула заменена конкретными ролями и произведениями. Identity audit identity-discrepant: речь идёт о Jean-Roger Essomba, а не Jean-Roger Essombe Edimo. Доказанная рекомендация - заменить ошибочный birthDate 1950 на годовой 1962. Shared country files не изменялись.
- Проверенные утверждения:
  - Жан-Роже Эссомба - родившийся в Камеруне писатель и издатель, автор нескольких романов. (`corrected`)
    - [EJR Éditions](https://www.ejreditions.com/auteurs) - Профиль издательства указывает рождение Ж.-Р. Эссомбы в Камеруне в 1962 году, авторство романов и его работу в издательском деле. Проверено: 2026-08-09.
    - [Africultures](https://africultures.com/la-plume-de-jean-roger-essomba/) - Профиль подтверждает рождение в Камеруне в 1962 году, девять романов и последующую работу в литературе и издательстве. Проверено: 2026-08-09.

### `cameroon:leonora_miano`

- Решение: `unchanged`
- SHA-256 исходного русского текста: `ed9c1b741aa8fc5d06067441b542c96a2b0c859b2cc406307f4c4f572b10cb56`
- Применимый текст: Франкоязычная писательница камерунского происхождения.
- Примечание: Исходная нейтральная формулировка подтверждена двумя издательскими институциями. Identity audit corroborated. Рекомендация - сохранить birthDate 1973-03-12; год и личность подтверждены, расхождений не обнаружено. Shared country files не изменялись.
- Проверенные утверждения:
  - Леонора Миано - франкоязычная писательница, родившаяся в Камеруне. (`supported`)
    - [University of Chicago Press](https://press.uchicago.edu/ucp/books/author/M/L/au27417094.html) - Университетское издательство называет Миано автором художественной и документальной прозы и подтверждает рождение в Камеруне в 1973 году. Проверено: 2026-08-09.
    - [Éditions du Seuil](https://www.seuil.com/ouvrage/l-oppose-de-la-blancheur-leonora-miano/9782021540710) - Издатель представляет Леонору Миано как романиста, драматурга и эссеиста и перечисляет её франкоязычные произведения и награды. Проверено: 2026-08-09.

### `cameroon:patrice_nganang`

- Решение: `unchanged`
- SHA-256 исходного русского текста: `f83ae329c6fb095423e2f57cc617e9b5dc8f9d78d0868ed6ab67c06b34c51335`
- Применимый текст: Камерунский писатель и литературовед.
- Примечание: Обе исходные роли подтверждены без оценочного ранжирования. Identity audit corroborated. Рекомендация - сохранить годовой birthDate 1970: точный день не нужен для биографии и не подтверждён обоими главными источниками. Shared country files не изменялись.
- Проверенные утверждения:
  - Патрис Нгананг - родившийся в Камеруне писатель и исследователь литературы и культуры. (`supported`)
    - [Farrar, Straus and Giroux - Macmillan](https://us.macmillan.com/author/patricenganang/) - Профиль издателя подтверждает камерунское происхождение и работу Нгананга как романиста, поэта и эссеиста. Проверено: 2026-08-09.
    - [Stony Brook University](https://www.stonybrook.edu/africana-studies/people/indvidfacpage/nganang.html) - Университетский профиль фиксирует научную работу Нгананга по постколониальной африканской литературе, театру и культуре и его писательскую деятельность. Проверено: 2026-08-09.

### `cameroon:paul_dakeyo`

- Решение: `unchanged`
- SHA-256 исходного русского текста: `72359c2a5fd7d35768191e2ef3dc01709cb9ee1c45dd2ddb93d09509b9feb6be`
- Применимый текст: Камерунский поэт и издатель.
- Примечание: Краткий исходный текст полностью подтверждён. Identity audit corroborated. Доказанная рекомендация - уточнить birthDate с годового 1948 до 1948-02-18. Shared country files не изменялись.
- Проверенные утверждения:
  - Поль Дакейо - камерунский поэт и издатель. (`supported`)
    - [Africultures](https://africultures.com/personnes/?no=6704) - Профиль прямо называет Поля Дакейо камерунским поэтом и издателем. Проверено: 2026-08-09.
    - [Revue Possibles - Université de Montréal](https://revuepossibles.ojs.umontreal.ca/index.php/revuepossibles/article/download/738/1105/2276) - Университетское издание подтверждает роли поэта и издателя, рождение 18 февраля 1948 года и основание Éditions Silex. Проверено: 2026-08-09.

### `cameroon:rene_philombe`

- Решение: `unchanged`
- SHA-256 исходного русского текста: `43843f116b1bfc3ebbbce7a54fdbbaef71c2f7a601a1c80c664f878ff42594e6`
- Применимый текст: Камерунский писатель, поэт и общественный деятель.
- Примечание: Исходные роли подтверждены литературным корпусом и организационной деятельностью. Identity audit corroborated. Рекомендация - сохранить birthDate 1930-11-13 и deathDate 2001-10-25; годы подтверждены институционально, а текущая точность не конфликтует с identity mapping. Shared country files не изменялись.
- Проверенные утверждения:
  - Рене Филомб был камерунским писателем и поэтом и участвовал в организации литературной и общественной жизни страны. (`supported`)
    - [University of Western Australia - Peuples Noirs Peuples Africains archive](https://mongobeti.arts.uwa.edu.au/issues/pnpa51/pnpa51_05.html) - Университетский архив документирует прозу, поэзию, драматургию Филомба, его издательскую работу и руководство Ассоциацией поэтов и писателей Камеруна. Проверено: 2026-08-09.
    - [Académie française](https://www.academie-francaise.fr/rene-philombe) - Официальная страница фиксирует литературную премию Рене Филомбу за совокупность произведений и связь с Ассоциацией камерунских поэтов. Проверено: 2026-08-09.
    - [Bibliothèque nationale de France](https://data.bnf.fr/fr/see_all_activities/11887262/page1) - Национальная библиотека подтверждает авторскую идентичность, годы жизни 1930-2001 и корпус произведений. Проверено: 2026-08-09.

### `cameroon:werewere_liking`

- Решение: `unchanged`
- SHA-256 исходного русского текста: `30c70b66aef217081a397f672bf9deaa67c9ccc2c9fdfa60c0dfd4595ed45d4a`
- Применимый текст: Камерунская писательница, поэтесса и драматург.
- Примечание: Исходный текст полностью подтверждён и не содержит сравнительной оценки. Identity audit corroborated. Доказанная рекомендация - уточнить birthDate с годового 1950 до 1950-05-01. Shared country files не изменялись.
- Проверенные утверждения:
  - Веревер Ликинг - родившаяся в Камеруне писательница, поэтесса и драматург. (`supported`)
    - [University of Western Australia](https://aflit.arts.uwa.edu.au/WerewereLikingEng.html) - Университетский профиль подтверждает рождение в Камеруне в 1950 году и произведения Ликинг в прозе, поэзии и драматургии. Проверено: 2026-08-09.
    - [Africultures](https://africultures.com/personnes/?no=3646) - Профиль подтверждает рождение 1 мая 1950 года в Камеруне и роли писательницы и драматурга наряду с театральной работой. Проверено: 2026-08-09.

### `canada:chris_hadfield`

- Решение: `corrected`
- SHA-256 исходного русского текста: `00cf4ba4178ab86fa79e19dc00c1a9d53c974f540af40de369b2e41af0e6e50c`
- Применимый текст: Канадский астронавт, инженер и лётчик-испытатель, совершивший три космических полёта. Автор книг «Руководство астронавта по жизни на Земле» и «Ты здесь: вокруг света за 92 минуты».
- Примечание: Интерпретация тем книг заменена проверяемыми биографическими и библиографическими фактами. Identity source - articleReferencedBooks; identity established directly. Рекомендация - сохранить birthDate 1959-08-29: расхождений не обнаружено. Shared country files не изменялись.
- Проверенные утверждения:
  - Крис Хэдфилд - канадский астронавт, инженер и лётчик-испытатель, совершивший три космических полёта и опубликовавший документальные книги о космосе. (`corrected`)
    - [Canadian Space Agency](https://www.csa-asc.gc.ca/eng/astronauts/canadian/retired/bio-chris-hadfield.asp) - Официальная биография подтверждает инженерную и лётно-испытательную подготовку, космические миссии и начало авторской карьеры с An Astronaut's Guide to Life on Earth. Проверено: 2026-08-09.
    - [Penguin Random House](https://www.penguinrandomhouse.com/authors/187799/chris-hadfield/) - Профиль издателя подтверждает три космических полёта и книги An Astronaut's Guide to Life on Earth и You Are Here. Проверено: 2026-08-09.

### `canada:margaret_laurence`

- Решение: `corrected`
- SHA-256 исходного русского текста: `3db1b8d9439b336114c96ec0c258b50b8ee4d0a7413c8421c3fbdda172ca9c66`
- Применимый текст: Канадская писательница, автор романов «Каменный ангел» (The Stone Angel) и «Прорицатели» (The Diviners).
- Примечание: Сравнительный статус и обобщённая интерпретация тем заменены конкретными произведениями. Identity audit corroborated. Рекомендация - сохранить birthDate 1926-07-18 и deathDate 1987-01-05: обе даты прямо подтверждены университетским архивом. Shared country files не изменялись.
- Проверенные утверждения:
  - Маргарет Лоренс была канадской писательницей и написала романы The Stone Angel и The Diviners. (`corrected`)
    - [Government of Canada](https://www.canada.ca/en/women-gender-equality/commemorations-celebrations/women-impact/arts/margaret-laurence.html) - Официальная биография называет Лоренс канадским романистом и рассматривает The Stone Angel и The Diviners. Проверено: 2026-08-09.
    - [McMaster University Archives](https://archives.mcmaster.ca/index.php/margaret-laurence-fonds) - Архивный фонд подтверждает даты 18 июля 1926 - 5 января 1987 года, авторскую идентичность и библиографию романов. Проверено: 2026-08-09.

### `canada:miriam_toews`

- Решение: `corrected`
- SHA-256 исходного русского текста: `51336d7c31f00797ce160551c4ad2d4138463e415d919c66c07a42c849dfbadf`
- Применимый текст: Канадская писательница, автор романов «A Complicated Kindness», «All My Puny Sorrows» и «Women Talking». Роман «A Complicated Kindness» получил Премию генерал-губернатора Канады за художественную прозу.
- Примечание: Широкая тематическая интерпретация заменена конкретными произведениями и наградой. Identity audit corroborated. Рекомендация - сохранить birthDate 1964-05-21: расхождений identity/date audit не выявил. Shared country files не изменялись.
- Проверенные утверждения:
  - Мириам Тейвз - канадская писательница, автор A Complicated Kindness, All My Puny Sorrows и Women Talking; A Complicated Kindness получил Премию генерал-губернатора за художественную прозу. (`corrected`)
    - [Penguin Random House](https://www.penguinrandomhouse.com/authors/2246932/miriam-toews/) - Профиль издателя перечисляет три романа и подтверждает Премию генерал-губернатора за художественную прозу. Проверено: 2026-08-09.
    - [Writers' Trust of Canada](https://www.writerstrust.com/authors/miriam-toews?book=a-complicated-kindness) - Канадская литературная организация подтверждает библиографию Тейвз, Премию генерал-губернатора и другие награды. Проверено: 2026-08-09.
    - [Canada Council for the Arts](https://canadacouncil.ca/-/media/Files/CCA/Research/2014/10/03/2004-2005/2004-05-MBProvProfile20042005EN.pdf) - Официальный отчёт фиксирует награждение Мириам Тейвз за A Complicated Kindness в 2004-2005 годах. Проверено: 2026-08-09.

### `canada:yann_martel`

- Решение: `corrected`
- SHA-256 исходного русского текста: `8ab4a79fe2d57175fa97019755d0a2c2d1032be09b48a25fc4351822605e6420`
- Применимый текст: Канадский писатель, автор романа «Жизнь Пи», удостоенного Букеровской премии в 2002 году.
- Примечание: Недоказанный сравнительный ранг и лишняя семейная характеристика сняты; сохранены авторство и награда. Identity audit corroborated. Рекомендация - сохранить birthDate 1963-06-25: точная дата подтверждена Library and Archives Canada. Shared country files не изменялись.
- Проверенные утверждения:
  - Янн Мартел - канадский писатель; его роман Life of Pi получил Букеровскую премию в 2002 году. (`corrected`)
    - [The Booker Prizes](https://thebookerprizes.com/the-booker-library/books/life-of-pi) - Официальная страница премии подтверждает авторство Янна Мартела и победу Life of Pi в 2002 году. Проверено: 2026-08-09.
    - [Library and Archives Canada](https://recherche-collection-search.bac-lac.gc.ca/eng/home/record?app=fonandcol&idnumber=3721039) - Национальный архив называет Мартела канадским романистом и новеллистом, подтверждает дату рождения 25 июня 1963 года и премию за Life of Pi. Проверено: 2026-08-09.
    - [Official website of Yann Martel](https://www.yannmartel.com/about) - Авторская биография подтверждает канадскую литературную идентичность, библиографию и Букеровскую премию за Life of Pi. Проверено: 2026-08-09.

### `cape_verde:manuel_de_novas`

- Решение: `corrected`
- SHA-256 исходного русского текста: `ebdb70c62b7d86d7b70a4414ce2e6f140636dc5146520d2bc3de0c1ac3e3bcf2`
- Применимый текст: Кабовердианский поэт и композитор, автор морн и коладейр о повседневной жизни и общественных темах Кабо-Верде.
- Примечание: Оценка известности заменена конкретными ролями, жанрами и тематикой. Identity audit corroborated. Рекомендация - сохранить birthDate 1938-02-24 и deathDate 2009-09-28; официальный некролог и государственная хроника не выявляют конфликта идентичности, а дата смерти соответствует дню поминальной годовщины. Shared country files не изменялись.
- Проверенные утверждения:
  - Мануэл де Новаш был кабовердианским поэтом и композитором, писавшим морны и коладейры о повседневной жизни и общественных явлениях. (`corrected`)
    - [Government of Cabo Verde - Ministry of Culture](https://www.governo.cv/ministerio-da-cultura-manifesta-pesar-e-consternacao-pela-morte-de-manuel-dnovas/) - Официальный некролог описывает поэтическую, лирическую и музыкальную работу Мануэла д’Новаша и его сатирическое изображение повседневности Кабо-Верде. Проверено: 2026-08-09.
    - [Inforpress - Agência Cabo-verdiana de Notícias](https://inforpress.cv/en/maneldnovasrecebetributoemlisboaparamarcaros15anossobreoseufalecimento) - Государственное информационное агентство называет его кабовердианским поэтом и композитором, связывает его с морной и коладейрой и подтверждает годы 1938-2009. Проверено: 2026-08-09.

## Рекомендации по идентичности и датам

Рекомендации находятся только в отчёте и `notes`; shared country-файлы не изменялись. Доказанные либо требующие редакционного решения случаи:

- `burundi:jean_pierre_hatungimana` - убрать неподтверждённый `birthDate: 1963` до установления личности.
- `burundi:roland_rugero` - уточнить `birthDate` до `1986-02-22`.
- `cameroon:calixthe_beyala` - заменить чрезмерно точный `1961-10-26` на подтверждённый год `1961`.
- `cameroon:emmanuel_dongala` - удалить либо перенаправить неверный камерунский дубль на `republic_of_congo:emmanuel_dongala`.
- `cameroon:etienne_goyemide` - удалить либо перенаправить неверный камерунский дубль на `central_african_republic:etienne_goyemide`; для канонической карточки рекомендованы `1942-01-22` и `1997-03-17`.
- `cameroon:jean_roger_essomba` - исправить identity mapping (Jean-Roger Essomba, не Jean-Roger Essombe Edimo) и заменить `birthDate: 1950` на `1962`.
- `cameroon:paul_dakeyo` - уточнить `birthDate` до `1948-02-18`.
- `cameroon:werewere_liking` - уточнить `birthDate` до `1950-05-01`.
