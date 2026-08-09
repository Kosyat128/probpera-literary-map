export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH23_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 23";

export type WriterBiographyFactReviewDecision = "unchanged" | "corrected" | "held";
export type WriterBiographyClaimVerdict = "supported" | "corrected" | "not-established";

export interface WriterBiographyClaimEvidence {
  readonly provider: string;
  readonly url: string;
  readonly checkedAt: string;
  readonly findingRu: string;
}

export interface WriterBiographyFactReviewClaim {
  readonly textRu: string;
  readonly verdict: WriterBiographyClaimVerdict;
  readonly evidence: readonly WriterBiographyClaimEvidence[];
}

export interface WriterBiographyFactReviewRecord {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly applicableTextRu: string | null;
  readonly claims: readonly WriterBiographyFactReviewClaim[];
  readonly reviewer: string;
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH23_REVIEWER;
const checkedAt = "2026-08-09";

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

const writerBiographyFactReviewBatch23Base = [
  {
    key: "england:anne_bronte",
    originalSha256: "508fb4babcb2051d59ee4a8d2b83c668b98766192d9a5edb4a4aaa76d9b43694",
    reviewedTextRu: "Энн Бронте (1820–1849) — английская писательница и поэтесса, младшая из сестёр Бронте. Она написала романы «Agnes Grey» и «The Tenant of Wildfell Hall».",
    claims: [{
      textRu: "Энн Бронте жила в 1820–1849 годах, была английской писательницей и поэтессой, младшей из сестёр Бронте, и написала Agnes Grey и The Tenant of Wildfell Hall.",
      verdict: "corrected",
      evidence: [
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp00571/anne-bronte", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни, литературные роли, родство с Шарлоттой и Эмили Бронте и авторство двух названных романов." },
        { provider: "Brontë Parsonage Museum", url: "https://www.bronte.org.uk/about-the-brontes/the-lives-of-the-brontes", checkedAt, findingRu: "Музей семьи Бронте независимо подтверждает биографию Энн, её место среди сестёр и литературную деятельность." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "К исходной верной родственной характеристике добавлены годы жизни, поэтическая работа и два документированных романа. Shared country files не изменялись.",
  },
  {
    key: "england:anthony_burgess",
    originalSha256: "657680940dba179af2c5846ea80d7240d5ea919dacc34e91237f2e80c410e87c",
    reviewedTextRu: "Энтони Бёрджесс (1917–1993) — английский писатель и композитор. Среди его романов — антиутопия «A Clockwork Orange», впервые изданная в 1962 году.",
    claims: [{
      textRu: "Энтони Бёрджесс жил в 1917–1993 годах, был английским писателем и композитором, а его роман A Clockwork Orange впервые вышел в 1962 году.",
      verdict: "corrected",
      evidence: [
        { provider: "International Anthony Burgess Foundation", url: "https://www.anthonyburgess.org/about-anthony-burgess/", checkedAt, findingRu: "Фонд Энтони Бёрджесса документирует годы жизни автора и его работу как писателя и композитора." },
        { provider: "Penguin Books", url: "https://www.penguin.co.uk/books/384903/a-clockwork-orange-by-anthony-burgess/9781407058542", checkedAt, findingRu: "Издательская страница атрибутирует Бёрджессу A Clockwork Orange, указывает 1962 год и отмечает его композиторскую деятельность." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективное «самый известный» заменено проверяемыми годами жизни и датой первого издания. Identity recommendation: авторитетные источники подтверждают профиль Бёрджесса; кандидат Q217619 согласуется и использован только для дополнительной сверки. Shared country files не изменялись.",
  },
  {
    key: "england:anthony_trollope",
    originalSha256: "b6e7ab3a7d48144967242c50e762a3c9e83636ab1f465a2caebf6e1b7e464cce",
    reviewedTextRu: "Энтони Троллоп (1815–1882) — английский писатель викторианской эпохи. Роман «Barchester Towers» является второй книгой его цикла «Chronicles of Barsetshire».",
    claims: [{
      textRu: "Энтони Троллоп жил в 1815–1882 годах, был английским романистом викторианской эпохи, а Barchester Towers является второй книгой Chronicles of Barsetshire.",
      verdict: "corrected",
      evidence: [
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person-list?sText=trollope&search=sas", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни Энтони Троллопа и его деятельность романиста." },
        { provider: "The Trollope Society", url: "https://trollopesociety.org/archive/tv-radio/radio/the-barchester-chronicles/", checkedAt, findingRu: "Профильное литературное общество подтверждает место Barchester Towers как второго романа Барсетширских хроник." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочные обобщения о внимательности изображения и нравственном выборе заменены точной библиографической связью романа с циклом. Shared country files не изменялись.",
  },
  {
    key: "england:arthur_conan_doyle",
    originalSha256: "2181f289da836f125516aef94d2e2f2e99ef1377f9af0eeedceaf9ed9dc33f7d",
    reviewedTextRu: "Артур Конан Дойл (1859–1930) — шотландский писатель и врач, создавший персонажа Шерлока Холмса. Холмс впервые появился в повести «A Study in Scarlet».",
    claims: [{
      textRu: "Артур Конан Дойл жил в 1859–1930 годах, был шотландским писателем и врачом, создал Шерлока Холмса и впервые представил его в A Study in Scarlet.",
      verdict: "corrected",
      evidence: [
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person.php?LinkID=mp01351&displayStyle=thumb", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни, эдинбургское происхождение, медицинскую практику, создание Холмса и первую публикацию A Study in Scarlet." },
        { provider: "The Conan Doyle Estate", url: "https://arthurconandoyle.co.uk/author", checkedAt, findingRu: "Официальный семейный литературный архив независимо атрибутирует Конан Дойлу образ Холмса и называет A Study in Scarlet первым произведением цикла." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "К исходной корректной характеристике добавлены годы жизни, медицинская профессия и проверяемое первое появление Холмса. Shared country files не изменялись.",
  },
  {
    key: "england:bede",
    originalSha256: "ec5694cc5ac08c0dcf34155d60b82ab6ba40500b5f8ae03d90dbd44352de7d99",
    reviewedTextRu: "Беда Достопочтенный (ок. 672/673–735) — англосаксонский монах, историк и богослов. В 731 году он завершил «Церковную историю народа англов».",
    claims: [{
      textRu: "Беда Достопочтенный родился около 672/673 года, умер в 735 году, был англосаксонским монахом, историком и богословом и завершил Церковную историю народа англов в 731 году.",
      verdict: "corrected",
      evidence: [
        { provider: "British Library", url: "https://www.bl.uk/stories/blogs/posts/bede-the-greatest-hits", checkedAt, findingRu: "Британская библиотека описывает Беду как англосаксонского монаха и богослова, связывает его с историческим трудом и подтверждает смерть в 735 году." },
        { provider: "Dickinson College Commentaries", url: "https://dcc.dickinson.edu/bede-historia-ecclesiastica/intro/preface", checkedAt, findingRu: "Университетский комментарий указывает приблизительные годы жизни, монастырь Уирмут—Джарроу и завершение Historia Ecclesiastica в 731 году." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Снята неподкреплённая формула «один из главных источников»; добавлены осторожная датировка жизни и документированный год завершения труда. Identity recommendation: источники подтверждают профиль Беды; кандидат Q154938 согласуется и служит только дополнительной сверкой. Shared country files не изменялись.",
  },
  {
    key: "england:ben_jonson",
    originalSha256: "68a12564231fd011a42f0f1f958859caa5184523f069954db67633dd0cbde524",
    reviewedTextRu: "Английский драматург, поэт и литературный критик елизаветинской эпохи, современник Уильяма Шекспира.",
    claims: [{
      textRu: "Бен Джонсон был английским драматургом, поэтом и литературным критиком елизаветинской эпохи и современником Уильяма Шекспира.",
      verdict: "supported",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/ben-jonson", checkedAt, findingRu: "Биографическая справка подтверждает английскую драматургическую, поэтическую и критическую деятельность Джонсона и его связь с эпохой Шекспира." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person.php?LinkID=mp02464&displayStyle=thumb", checkedAt, findingRu: "Национальная портретная галерея независимо определяет Джонсона как поэта и драматурга и современника, связанного с Шекспиром." },
      ],
    }],
    reviewer,
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного краткого текста подтверждены двумя независимыми институциональными источниками; текст сохранён дословно.",
  },
  {
    key: "england:bertrand_russell",
    originalSha256: "f55cba7b5afd47ff252eace06008aa8184f64b9722a887df4d7d530858122e55",
    reviewedTextRu: "Бертран Рассел (1872–1970) — британский философ, логик и общественный деятель. В 1950 году он получил Нобелевскую премию по литературе за сочинения, защищавшие гуманистические идеалы и свободу мысли.",
    claims: [{
      textRu: "Бертран Рассел жил в 1872–1970 годах, был британским философом, логиком и общественным деятелем и получил Нобелевскую премию по литературе 1950 года за гуманистическую и свободомыслящую направленность своих сочинений.",
      verdict: "corrected",
      evidence: [
        { provider: "The Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1950/summary/", checkedAt, findingRu: "Официальный сайт Нобелевской премии подтверждает награждение Рассела в 1950 году и формулировку о гуманистических идеалах и свободе мысли." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/portrait/mw07855/Bertrand-Russell", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни Рассела и его деятельность как философа, математика и общественного реформатора." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективная оценка ясности прозы заменена проверяемыми датами, ролями и официальной формулировкой премии. Shared country files не изменялись.",
  },
  {
    key: "england:celia_rees",
    originalSha256: "5b4a89594a4a7cf461eff7ba5559c895bbfacf67a68ce6cd0e6c6fd0776221ff",
    reviewedTextRu: "Селия Рис — британская писательница, автор книг для подростков. Среди её исторических романов — «Пираты».",
    claims: [{
      textRu: "Селия Рис — британская писательница подростковой литературы и автор исторического романа Pirates.",
      verdict: "supported",
      evidence: [
        { provider: "Bloomsbury Publishing", url: "https://www.bloomsbury.com/uk/pirates-9781526632302/", checkedAt, findingRu: "Издательство атрибутирует Селии Рис исторический роман Pirates и относит её книги к подростковой литературе." },
        { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/25154/celia-rees/", checkedAt, findingRu: "Независимый издательский профиль подтверждает британскую писательницу, её работу для подростков и авторство Pirates." },
      ],
    }],
    reviewer,
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного краткого текста подтверждены двумя независимыми издательскими источниками; текст сохранён дословно.",
  },
  {
    key: "england:charles_dickens",
    originalSha256: "d7b0895fff2f8626ee7fcfcf6a6c7ef9968f5d0aae2ae797c9a6844ba5a7f42a",
    reviewedTextRu: "Чарльз Диккенс (1812–1870) — английский писатель и журналист. Среди его произведений — романы «Oliver Twist» и «Great Expectations» и повесть «A Christmas Carol».",
    claims: [{
      textRu: "Чарльз Диккенс жил в 1812–1870 годах, был английским писателем и журналистом и написал Oliver Twist, Great Expectations и A Christmas Carol.",
      verdict: "corrected",
      evidence: [
        { provider: "Charles Dickens Museum", url: "https://dickensmuseum.com/en-de/pages/about-us", checkedAt, findingRu: "Музей Диккенса подтверждает его писательскую деятельность, общественную журналистику и авторство названных произведений." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp01294/charles-dickens", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни, английскую литературную деятельность и библиографию Диккенса." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлативы «один из величайших» и неопределённое «мастер» заменены датами, профессиями и тремя проверяемыми произведениями. Shared country files не изменялись.",
  },
  {
    key: "england:charlotte_bronte",
    originalSha256: "8f843e3652a30435c571676af6231c5e41404e1db4a361fee737b45fe42e5d96",
    reviewedTextRu: "Шарлотта Бронте (1816–1855) — английская писательница, публиковавшаяся также под именем Каррер Белл. Её роман «Jane Eyre» вышел в 1847 году.",
    claims: [{
      textRu: "Шарлотта Бронте жила в 1816–1855 годах, была английской писательницей, публиковалась под именем Каррер Белл и издала Jane Eyre в 1847 году.",
      verdict: "corrected",
      evidence: [
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/portrait/mw00798/Charlotte-Bront", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни, псевдоним Currer Bell и публикацию Jane Eyre в 1847 году." },
        { provider: "Brontë Parsonage Museum", url: "https://www.bronte.org.uk/about-the-brontes/the-bronte-novels", checkedAt, findingRu: "Музей семьи Бронте независимо атрибутирует Шарлотте Jane Eyre и документирует публикацию романа под мужским именем." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Неопределённое «один из самых известных романов» заменено точными годами, авторским именем и датой издания. Shared country files не изменялись.",
  },
  {
    key: "england:chaucer",
    originalSha256: "577aa05198d29f3d5be03e7334df8fb7deed6ca18632186bbd8bb67e8ca85225",
    reviewedTextRu: "Джеффри Чосер (ок. 1340–1400) — английский поэт и служащий королевской администрации. Его произведение «The Canterbury Tales» осталось незавершённым.",
    claims: [{
      textRu: "Джеффри Чосер жил приблизительно в 1340–1400 годах, был английским поэтом и служащим короны, а The Canterbury Tales осталось незавершённым.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/geoffrey-chaucer", checkedAt, findingRu: "Биографическая справка подтверждает приблизительные годы жизни Чосера, его поэтическую работу, королевские должности и незавершённость The Canterbury Tales." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp00852/geoffrey-chaucer", checkedAt, findingRu: "Национальная портретная галерея независимо подтверждает годы жизни, службу короне и авторство The Canterbury Tales." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Почётное прозвище «отец английской литературы» заменено нейтральными биографическими сведениями. Identity recommendation: источники подтверждают профиль Чосера; кандидат Q5683 согласуется и служит только дополнительной сверкой. Shared country files не изменялись.",
  },
  {
    key: "england:christopher_marlowe",
    originalSha256: "86a5b736a512e0b8537c0ec8646f4886f052707c9beab5e2c59b33d164235c10",
    reviewedTextRu: "Кристофер Марло (1564–1593) — английский драматург и поэт елизаветинской эпохи. Среди его пьес — «Tamburlaine the Great» и «Doctor Faustus».",
    claims: [{
      textRu: "Кристофер Марло жил в 1564–1593 годах, был английским драматургом и поэтом елизаветинской эпохи и написал Tamburlaine the Great и Doctor Faustus.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/christopher-marlowe", checkedAt, findingRu: "Биографическая справка подтверждает годы жизни, английскую поэтическую и драматургическую деятельность Марло и атрибуцию названных пьес." },
        { provider: "Royal Shakespeare Company", url: "https://www.rsc.org.uk/edward-ii/about-the-play/who-was-christopher-marlowe", checkedAt, findingRu: "Королевская шекспировская компания независимо подтверждает годы жизни, елизаветинский контекст и драматургическую деятельность Марло." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Хронологическая оценка «предшественник Шекспира» заменена двумя атрибутированными пьесами. Date recommendation: shared birthDate 1564-02-26 обозначает крещение Марло, а не доказанный день рождения; заменить точную дату на год «1564». Конкурирующая дата 1564-02-23 авторитетно не установлена. Shared country files не изменялись.",
  },
  {
    key: "england:daniel_defoe",
    originalSha256: "6656792b38dd294218744420b19803bbb09eec06c00e74d8d4dfd9d4d9fad32c",
    reviewedTextRu: "Даниель Дефо (ок. 1660–1731) — английский писатель, журналист и публицист. Он написал романы «Robinson Crusoe» и «Moll Flanders».",
    claims: [{
      textRu: "Даниель Дефо жил приблизительно в 1660–1731 годах, был английским писателем, журналистом и публицистом и написал Robinson Crusoe и Moll Flanders.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/daniel-defoe", checkedAt, findingRu: "Биографическая справка подтверждает приблизительные годы жизни Дефо, его журналистскую и публицистическую работу и авторство двух романов." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp01230/daniel-defoe", checkedAt, findingRu: "Национальная портретная галерея независимо подтверждает годы жизни, деятельность романиста и журналиста и авторство Robinson Crusoe." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Спорное обобщение «один из основоположников» заменено приблизительной датировкой жизни и конкретными произведениями. Identity recommendation: источники подтверждают профиль Дефо; кандидат Q40946 согласуется и служит только дополнительной сверкой. Shared country files не изменялись.",
  },
  {
    key: "england:david_mitchell",
    originalSha256: "86be92787774c8cde76b40824664a9b1e1a084e0131e44e197995b77b8258b1d",
    reviewedTextRu: "Дэвид Митчелл — британский писатель, родившийся в 1969 году. Его роман «Cloud Atlas», объединяющий шесть связанных повествований, вошёл в короткий список Букеровской премии 2004 года.",
    claims: [{
      textRu: "Дэвид Митчелл — британский писатель 1969 года рождения; Cloud Atlas состоит из шести связанных повествований и был включён в короткий список Букеровской премии 2004 года.",
      verdict: "corrected",
      evidence: [
        { provider: "The Booker Prizes", url: "https://thebookerprizes.com/the-booker-library/features/everything-you-need-to-know-about-cloud-atlas-by-david-mitchell", checkedAt, findingRu: "Официальный архив Букеровской премии подтверждает год рождения Митчелла, композицию из шести связанных историй и включение романа в короткий список 2004 года." },
        { provider: "Random House Publishing Group", url: "https://www.randomhousebooks.com/books/115429/", checkedAt, findingRu: "Издательский профиль независимо подтверждает рождение Митчелла в 1969 году, авторство Cloud Atlas и два включения его книг в короткие списки Букеровской премии." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Широкие тематические интерпретации исходного текста заменены годом рождения, проверяемой композицией романа и официальным премиальным результатом. Shared country files не изменялись.",
  },
  {
    key: "england:diane_setterfield",
    originalSha256: "3062bc357fa3252dc11aa64e0d501b6dd4c698f13dab47ccbaaf5a0e0fa7b72c",
    reviewedTextRu: "Диана Сеттерфилд — британская писательница. Её дебютный роман «Тринадцатая сказка» обращается к традиции готической прозы.",
    claims: [{
      textRu: "Диана Сеттерфилд — британская писательница, а Тринадцатая сказка является её дебютным романом в традиции готической прозы.",
      verdict: "supported",
      evidence: [
        { provider: "Diane Setterfield — official author site", url: "https://www.dianesetterfield.com/bio/", checkedAt, findingRu: "Официальная биография подтверждает британскую принадлежность писательницы и характеризует её дебют 2006 года как готическую загадочную историю." },
        { provider: "Simon & Schuster", url: "https://www.simonandschuster.com/books/The-Thirteenth-Tale/Diane-Setterfield/9780743298032", checkedAt, findingRu: "Издательская страница независимо подтверждает авторство, дебютный статус и готическую литературную традицию The Thirteenth Tale." },
      ],
    }],
    reviewer,
    decision: "unchanged",
    notes: "Все конкретные утверждения исходного краткого текста подтверждены официальной биографией и независимым издателем; текст сохранён дословно. Identity recommendation: профиль согласуется с кандидатом Q2550958, использованным только для дополнительной сверки. Shared country files не изменялись.",
  },
  {
    key: "england:doris_lessing",
    originalSha256: "ca7ac1f77ee5ecd7f315433d7763d344282f4f2fc52ec057ba321f35a6b5e8dc",
    reviewedTextRu: "Дорис Лессинг (1919–2013) — британская писательница, получившая Нобелевскую премию по литературе в 2007 году. Среди её произведений — роман «The Golden Notebook».",
    claims: [{
      textRu: "Дорис Лессинг жила в 1919–2013 годах, была британской писательницей, получила Нобелевскую премию по литературе 2007 года и написала The Golden Notebook.",
      verdict: "corrected",
      evidence: [
        { provider: "The Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/2007/lessing/", checkedAt, findingRu: "Официальная страница премии подтверждает годы жизни Лессинг, награждение в 2007 году и библиографическую связь с The Golden Notebook." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/portrait/mw197309/Doris-Lessing", checkedAt, findingRu: "Национальная портретная галерея независимо подтверждает годы жизни, писательскую деятельность, роман The Golden Notebook и Нобелевскую премию 2007 года." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Исходная корректная премиальная справка дополнена годами жизни и конкретным произведением по двум официальным источникам. Shared country files не изменялись.",
  },
  {
    key: "england:edmund_spenser",
    originalSha256: "6873c0a6b10bc3de2ffbc1f23fa73ab50523e625fa6d263a1f54f0c3e2edcac0",
    reviewedTextRu: "Эдмунд Спенсер (ок. 1552–1599) — английский поэт елизаветинской эпохи и автор эпической поэмы «The Faerie Queene». Его именем названы спенсерова строфа и спенсеров сонет.",
    claims: [{
      textRu: "Эдмунд Спенсер жил приблизительно в 1552–1599 годах, был английским поэтом елизаветинской эпохи, написал The Faerie Queene и дал имя спенсеровой строфе и спенсерову сонету.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/edmund-spenser", checkedAt, findingRu: "Биографическая справка подтверждает датировку жизни, елизаветинский контекст, авторство The Faerie Queene и названные по имени поэта формы строфы и сонета." },
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp14383/edmund-spenser", checkedAt, findingRu: "Национальная портретная галерея независимо подтверждает приблизительный год рождения, год смерти и деятельность Спенсера как английского поэта." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив «один из крупнейших» заменён конкретным произведением и названными по имени автора поэтическими формами. Identity recommendation: источники подтверждают профиль Спенсера; кандидат Q4352055 согласуется и служит только дополнительной сверкой. Shared country files не изменялись.",
  },
  {
    key: "england:emily_bronte",
    originalSha256: "a3208dba5e22ae290d9154f5604132df9313a5c9b8f73d54ff4813c8e55fd5af",
    reviewedTextRu: "Эмили Бронте (1818–1848) — английская писательница и поэтесса, публиковавшаяся под именем Эллис Белл. Её единственный роман — «Wuthering Heights», изданный в 1847 году.",
    claims: [{
      textRu: "Эмили Бронте жила в 1818–1848 годах, была английской писательницей и поэтессой, публиковалась как Эллис Белл, а её единственный роман Wuthering Heights вышел в 1847 году.",
      verdict: "corrected",
      evidence: [
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp00573/emily-bronte", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни, поэтическую и прозаическую работу, имя Ellis Bell и единственный роман Wuthering Heights 1847 года." },
        { provider: "Brontë Parsonage Museum", url: "https://www.bronte.org.uk/about-the-brontes/the-lives-of-the-brontes", checkedAt, findingRu: "Музей семьи Бронте независимо подтверждает биографию Эмили, её поэтическую деятельность и авторство Wuthering Heights." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочное «классический роман» заменено годами жизни, авторским именем, единственностью романа и датой издания. Shared country files не изменялись.",
  },
  {
    key: "england:evelyn_waugh",
    originalSha256: "fd844a4398bbdea469083bec289ea5fb9828a395eeea901c6f05cbde7eed532a",
    reviewedTextRu: "Ивлин Во (1903–1966) — английский писатель, автор романов, биографий и путевой прозы. Его первый роман «Decline and Fall» вышел в 1928 году.",
    claims: [{
      textRu: "Ивлин Во жил в 1903–1966 годах, писал романы, биографии и путевую прозу, а его первый роман Decline and Fall был опубликован в 1928 году.",
      verdict: "corrected",
      evidence: [
        { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/32590/evelyn-waugh/", checkedAt, findingRu: "Издательский профиль подтверждает годы жизни Во, первую опубликованную биографию, путевые книги и выход первого романа Decline and Fall в 1928 году." },
        { provider: "University of Leicester — Complete Works of Evelyn Waugh", url: "https://le.ac.uk/evelyn-waugh/about", checkedAt, findingRu: "Университетский проект полного собрания независимо перечисляет романы, биографии, путевую прозу, эссе, статьи, репортажи и рецензии Во." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Непроверяемая оценка «точность композиции» заменена нейтральными жанрами, годами жизни и датой дебютного романа. Shared country files не изменялись.",
  },
  {
    key: "england:frederick_forsyth",
    originalSha256: "9a7d6a39023aaef82927fcdb356dd9ec6883899264f20de8b0448c4b0073a8cc",
    reviewedTextRu: "Фредерик Форсайт (1938–2025) — британский писатель и журналист, работавший в жанре политического триллера. Его первый роман «The Day of the Jackal» вышел в 1971 году.",
    claims: [{
      textRu: "Фредерик Форсайт жил в 1938–2025 годах, был британским писателем и журналистом, писал политические триллеры, а его первый роман The Day of the Jackal вышел в 1971 году.",
      verdict: "corrected",
      evidence: [
        { provider: "National Portrait Gallery, London", url: "https://www.npg.org.uk/collections/search/person/mp05961/frederick-forsyth", checkedAt, findingRu: "Национальная портретная галерея подтверждает годы жизни, деятельность романиста и журналиста, жанр триллера и выход первого романа The Day of the Jackal в 1971 году." },
        { provider: "Penguin Random House", url: "https://global.penguinrandomhouse.com/announcements/legendary-thriller-author-frederick-forsyth-passes-away-at-86/", checkedAt, findingRu: "Официальное сообщение издателя независимо подтверждает смерть в 2025 году, журналистскую карьеру, жанр триллера и библиографию Форсайта." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Добавлены подтверждённые годы жизни и дата первого романа; смерть в 2025 году сверена с Национальной портретной галереей и издателем. Identity recommendation: профиль согласуется с кандидатом Q249197, использованным только для дополнительной сверки. Shared country files не изменялись.",
  },
] satisfies readonly ReviewBase[];

function finalizeReviewRecord(record: ReviewBase): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch23: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch23Base.map(finalizeReviewRecord);
