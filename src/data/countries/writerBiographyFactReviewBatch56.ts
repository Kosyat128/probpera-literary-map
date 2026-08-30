export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH56_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 56";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH56_REVIEWER;
const checkedAt = "2026-08-30";

type EvidenceSeed = readonly [provider: string, url: string, findingRu: string];

interface ReviewSeed {
  readonly key: string;
  readonly originalSha256: string;
  readonly reviewedTextRu: string;
  readonly evidence: readonly EvidenceSeed[];
  readonly decision: WriterBiographyFactReviewDecision;
  readonly notes: string;
}

function e(provider: string, url: string, findingRu: string): EvidenceSeed {
  return [provider, url, findingRu];
}

const seeds: readonly ReviewSeed[] = [
  {
    key: "usa:sinclair_lewis",
    originalSha256: "1ff502a8a16f8e4d33a7cec006c5bda85689629a9edf3663e0921d353214f63f",
    reviewedTextRu: "Американский писатель, первый американец, получивший Нобелевскую премию по литературе.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1930/summary/", "Официальная страница премии фиксирует присуждение Синклеру Льюису Нобелевской премии по литературе 1930 года."),
      e("Library of America", "https://www.loa.org/writers/277-sinclair-lewis/", "Биографическая справка называет Льюиса первым американцем, получившим Нобелевскую премию по литературе, и перечисляет его основные романы."),
    ],
    decision: "unchanged",
    notes: "Формулировка нейтральна; статус первого американского лауреата Нобелевской премии по литературе подтверждён.",
  },
  {
    key: "usa:stephen_king",
    originalSha256: "ed8279b4f840fcd262c8c37e5acb46aab7bc269b536230e1743d114f3830d5a9",
    reviewedTextRu: "Стивен Кинг — американский писатель, работающий в жанрах ужасов, саспенса, научной фантастики и фэнтези. Среди его произведений — «Сияние», «Оно» и «Зелёная миля».",
    evidence: [
      e("Stephen King — официальный сайт", "https://stephenking.com/the-author/", "Официальная биография подтверждает профессию писателя, дату рождения и библиографию Кинга."),
      e("National Endowment for the Arts", "https://www.arts.gov/honors/medals/stephen-king", "Страница Национальной медали искусств характеризует Кинга как автора произведений в жанрах ужасов, саспенса, научной фантастики и фэнтези."),
    ],
    decision: "corrected",
    notes: "Сняты непроверяемые оценки популярности и мастерства; жанры и примеры произведений приведены по институциональным источникам. Уточнено полное русское название повести о Рите Хейуорт.",
  },
  {
    key: "usa:suzanne_collins",
    originalSha256: "05051b584a067547862d07634f03f7c63a52176d7ba2630ddc7c980d2acfe017",
    reviewedTextRu: "Сьюзен Коллинз — американская писательница и сценаристка, автор цикла «Голодные игры».",
    evidence: [
      e("Scholastic", "https://www.scholastic.com/teachers/teaching-tools/articles/authors/suzanne-collins.html", "Издательская биография подтверждает, что Сьюзен Коллинз — писательница и телевизионная сценаристка, автор серии «Голодные игры»."),
      e("Library of Congress", "https://loc.gov/loc/lcib/1011/authors.html", "Библиотека Конгресса представляет Коллинз как автора трилогии «Голодные игры» и упоминает её сценарную работу."),
    ],
    decision: "corrected",
    notes: "Исходные сведения подтверждены; исправлена грамматическая форма названия профессии и нормализована типографика. В профиль добавлены доказанные названия трёх основных романов цикла.",
  },
  {
    key: "usa:theodore_dreiser",
    originalSha256: "28fc63552bb612376c747c3f91a9a7155238918eaf10b98466020d93016a67f7",
    reviewedTextRu: "Теодор Драйзер — американский писатель и журналист. Его романы включают «Сестру Керри», «Финансиста» и «Американскую трагедию».",
    evidence: [
      e("University of Pennsylvania Libraries", "https://www.library.upenn.edu/collections/notable/theodore-dreiser-collection", "Описание архивной коллекции подтверждает биографические данные Драйзера и называет «Сестру Керри», «Финансиста» и «Американскую трагедию»."),
      e("Library of Congress", "https://www.loc.gov/item/98031433/", "Каталог Библиотеки Конгресса атрибутирует роман «Sister Carrie» Теодору Драйзеру."),
    ],
    decision: "corrected",
    notes: "Удалена субъективная иерархическая оценка; оставлены профессии и проверяемые названия романов.",
  },
  {
    key: "usa:thomas_harris",
    originalSha256: "2befdfe9588f990bcfb292a0632f90f2acdd9803976d6660a7a815ba8c3cb0de",
    reviewedTextRu: "Томас Харрис — американский писатель, автор криминальных триллеров. «Молчание ягнят» входит в цикл романов о Ганнибале Лектере.",
    evidence: [
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/12046/thomas-harris/", "Издательская страница называет Харриса автором «Чёрного воскресенья», «Красного дракона», «Молчания ягнят» и «Ганнибала»."),
      e("University of Mississippi Libraries", "https://egrove.olemiss.edu/exhibit/exhibits/murder-with-southern-hospitality/the-silence-of-the-lambs-thomas-harris-1988/", "Университетская выставка атрибутирует «Молчание ягнят» Томасу Харрису и связывает роман с персонажем Ганнибалом Лектером."),
    ],
    decision: "corrected",
    notes: "Смысл исходного текста подтверждён; формулировка о месте романа в цикле сделана точнее. В профиль добавлены только надёжно атрибутированные произведения.",
  },
  {
    key: "usa:thomas_jefferson",
    originalSha256: "18de9f5a9a4d9afbe414450c279204282a300bd48a30317f04368868a0c20c86",
    reviewedTextRu: "Томас Джефферсон — американский государственный деятель и автор первоначального проекта Декларации независимости США.",
    evidence: [
      e("U.S. National Archives", "https://www.archives.gov/milestone-documents/declaration-of-independence", "Национальный архив указывает, что Джефферсон подготовил первоначальный проект Декларации независимости."),
      e("Thomas Jefferson Foundation — Monticello", "https://www.monticello.org/the-declaration-of-independence/jefferson-and-the-declaration", "Материалы Монтичелло подробно подтверждают работу Джефферсона над проектом Декларации и последующее редактирование текста."),
    ],
    decision: "corrected",
    notes: "Исходная атрибуция подтверждена; формулировка уточнена до авторства первоначального проекта, поскольку окончательный текст редактировался комитетом и Конгрессом.",
  },
  {
    key: "usa:thomas_paine",
    originalSha256: "c5ee09750fb0ddd95d8b3a6485e62094b858bd98bdf729a4f9d7783103dc467b",
    reviewedTextRu: "Томас Пейн — англо-американский политический публицист. Он написал «Здравый смысл», «Права человека» и «Век разума».",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/exhibitions/declarations-promise/about-this-exhibition/drafting-the-declaration/common-sense/", "Библиотека Конгресса атрибутирует Томасу Пейну памфлет «Common Sense» и описывает его роль в революционной публицистике."),
      e("U.S. National Archives", "https://www.archives.gov/news/articles/thomas-paine-attitudes-biography", "Национальный архив подтверждает англо-американскую биографию Пейна и авторство «Common Sense», «Rights of Man» и «Age of Reason»."),
    ],
    decision: "corrected",
    notes: "Удалены субъективная оценка значимости и слишком широкое жанровое определение трёх разных произведений; оставлены проверяемая профессиональная характеристика и авторство.",
  },
  {
    key: "usa:tim_powers",
    originalSha256: "aed9c59ff2063e182cf4eeff22eaaad36870d6e384e3a987fc8f44e643a262d8",
    reviewedTextRu: "Тим Пауэрс — американский автор фантастики и фэнтези. Он написал роман «На странных волнах».",
    evidence: [
      e("Simon & Schuster", "https://www.simonandschuster.com/authors/Tim-Powers/2140708258", "Издательская справка представляет Тима Пауэрса как американского автора научной фантастики и фэнтези."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/24419/tim-powers/", "Издательская библиография атрибутирует Тиму Пауэрсу роман «On Stranger Tides»."),
    ],
    decision: "corrected",
    notes: "Факты исходной карточки подтверждены; в профиль добавлено доказанное произведение.",
  },
  {
    key: "usa:tom_clancy",
    originalSha256: "dabc4420203c54c6e5bc97073f21d46a57ad287cd811a8894df4570c70a615fd",
    reviewedTextRu: "Том Клэнси — американский писатель, создававший военно-политические триллеры. Его дебютным романом была «Охота за „Красным Октябрём“».",
    evidence: [
      e("U.S. Naval Institute", "https://www.usni.org/people/thomas-clancy", "Военно-морской институт подтверждает авторство Клэнси и публикацию его первого романа «The Hunt for Red October»."),
      e("Penguin Random House", "https://www.penguinrandomhouse.com/authors/5003/tom-clancy/", "Издательская биография называет «The Hunt for Red October» первой литературной работой Клэнси и первым романом цикла о Джеке Райане."),
    ],
    decision: "corrected",
    notes: "Исходные сведения подтверждены; унифицированы пунктуация и типографика. В профиль добавлен дебютный роман.",
  },
  {
    key: "usa:tony_morrison",
    originalSha256: "6489c801e14b80e6d17356535fb38e35863de29cadc745440f8c7b5bc1f55068",
    reviewedTextRu: "Тони Моррисон — американская писательница, получившая Нобелевскую премию по литературе в 1993 году. Среди её романов — «The Bluest Eye» и «Песнь Соломона».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1993/morrison/biographical/", "Официальная биография подтверждает присуждение Тони Моррисон Нобелевской премии по литературе 1993 года и перечисляет её романы."),
      e("Princeton University", "https://aas.princeton.edu/people/toni-morrison", "Университетская страница подтверждает работу Моррисон как писательницы и её связь с Принстоном."),
    ],
    decision: "corrected",
    notes: "Удалена субъективная оценка масштаба; Нобелевский статус и произведения подтверждены.",
  },
  {
    key: "usa:vladimir_nabokov",
    originalSha256: "b79ac4f82a905bd1650326278c1c69d7a7e54735653ca0b702747e0873f61f6a",
    reviewedTextRu: "Владимир Набоков — русско-американский писатель, поэт и литературовед, писавший по-русски и по-английски. К его русским романам относятся «Защита Лужина», «Приглашение на казнь» и «Дар».",
    evidence: [
      e("International Vladimir Nabokov Society", "https://nabokovsociety.org/life/chronology", "Хронология общества подтверждает русско-американскую биографию Набокова, переход от русскоязычного к англоязычному творчеству и даты жизни."),
      e("Cornell University Library", "https://ecommons.cornell.edu/bitstream/1813/27996/1/086_04.pdf", "Университетское исследование рассматривает русские романы Набокова, включая «Защиту Лужина», «Приглашение на казнь» и «Дар»."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка литературного ранга удалена; оставлены языки творчества, виды деятельности и проверяемые произведения.",
  },
  {
    key: "usa:walt_whitman",
    originalSha256: "114562719ba8a2f3068bb05c37e10408647ef77fe1822ca4bd5f2a3ea2789c0b",
    reviewedTextRu: "Уолт Уитмен — американский поэт, эссеист и журналист. Он впервые издал «Листья травы» в 1855 году и затем неоднократно перерабатывал сборник.",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/collections/feinberg-whitman/articles-and-essays/timeline/", "Хронология Библиотеки Конгресса датирует первое издание «Leaves of Grass» 1855 годом и подтверждает последующие многократные переработки сборника."),
      e("Poetry Foundation", "https://www.poetryfoundation.org/poets/walt-whitman", "Биографическая справка представляет Уитмена как американского поэта, эссеиста и журналиста и связывает его наследие со сборником «Leaves of Grass»."),
    ],
    decision: "corrected",
    notes: "Сняты оценочные формулировки о масштабе, реформаторстве и месте сборника в наследии; приведены профессии и проверяемые сведения о первом издании и переработках.",
  },
  {
    key: "usa:washington_irving",
    originalSha256: "8963d183af73a534b685a31e5343ab53242b8a4fbb9e6f7f5f9466182f4d1e65",
    reviewedTextRu: "Вашингтон Ирвинг — американский писатель и эссеист. Он написал рассказы «Рип ван Винкль» и «Легенда о Сонной Лощине».",
    evidence: [
      e("Library of Congress", "https://www.loc.gov/item/45048083/", "Каталог Библиотеки Конгресса атрибутирует Вашингтону Ирвингу произведения «Rip Van Winkle» и «The Legend of Sleepy Hollow»."),
      e("Historic Hudson Valley", "https://hudsonvalley.org/historic-sites/washington-irvings-sunnyside/", "Официальная страница дома-музея Ирвинга связывает писателя и его наследие с Рипом ван Винклем и Всадником без головы из «Легенды о Сонной Лощине»."),
    ],
    decision: "corrected",
    notes: "Удалены спорные ранговые характеристики; авторство двух рассказов подтверждено независимыми институциональными источниками.",
  },
  {
    key: "usa:william_bradford",
    originalSha256: "0f906a706cb6caf3d1cf777c899efc646d49cd49a959c2038adfd26defcf4e28",
    reviewedTextRu: "Уильям Брэдфорд — английский переселенец, многолетний губернатор Плимутской колонии и автор хроники, известной как «История Плимутской плантации».",
    evidence: [
      e("Massachusetts Archives", "https://archives.lib.state.ma.us/server/api/core/bitstreams/910a620e-104f-40af-b22a-99dc9fe64084/content", "Архивное издание текста «Of Plimoth Plantation» атрибутирует хронику Уильяму Брэдфорду и документирует его связь с Плимутской колонией."),
      e("Smithsonian Institution", "https://www.si.edu/collections/snapshot/plymouth-rock-piece", "Смитсоновский институт называет Брэдфорда губернатором Плимутской колонии и автором раннего описания её истории."),
    ],
    decision: "corrected",
    notes: "Исходные сведения подтверждены; уточнены происхождение, длительность губернаторской службы и принятое название хроники.",
  },
  {
    key: "usa:william_faulkner",
    originalSha256: "b62f4075e23ec64833e042d2cf2c933038cbe00b525f6ea7fc4b2a5f005c4fc6",
    reviewedTextRu: "Уильям Фолкнер — американский писатель, удостоенный Нобелевской премии по литературе за 1949 год. Среди его романов — «Когда я умирала», «Свет в августе» и «Авессалом, Авессалом!».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1949/faulkner/biographical/", "Официальная биография подтверждает присуждение Фолкнеру Нобелевской премии по литературе за 1949 год и его библиографию."),
      e("The Pulitzer Prizes", "https://www.pulitzer.org/article/many-guises-william-faulkner", "Материал Пулитцеровской премии подтверждает деятельность Фолкнера как американского романиста и обсуждает его литературное наследие."),
    ],
    decision: "corrected",
    notes: "Удалена субъективная ранговая оценка; оставлены Нобелевский статус и проверяемые произведения.",
  },
  {
    key: "usa:winston_groom",
    originalSha256: "dd86c79e66f5c166fd67a93512ccfdff940ed5fc84bc2164b38e51ef87a72e55",
    reviewedTextRu: "Уинстон Грум — американский писатель и журналист, автор романа «Форрест Гамп». Он также писал документальные книги об истории США и войнах.",
    evidence: [
      e("Alabama Heritage", "https://www.alabamaheritage.com/authors/authors-g/winston-groom/", "Историко-культурное издание Алабамы представляет Грума как писателя и автора «Forrest Gump», писавшего также книги по военной истории."),
      e("Groom family obituary via Mobile Register", "https://obits.al.com/us/obituaries/mobile/name/winston-groom-obituary?id=7474034", "Семейный некролог подтверждает даты 23 марта 1943 — 17 сентября 2020 года, журналистскую работу и авторство «Forrest Gump»."),
    ],
    decision: "corrected",
    notes: "Исходная характеристика подтверждена и конкретизирована документированным романом; профильные даты согласуются с семейным некрологом.",
  },
  {
    key: "uzbekistan:abdulla_qahhor",
    originalSha256: "53cd1a74044fb54a97e2e0cc4938a9f86d054cc2c3430299912311defe810371",
    reviewedTextRu: "Абдулла Каххар — узбекский писатель, драматург и переводчик. Среди его произведений — роман «Мираж» и повести «Синчалак» и «Сказки о прошлом».",
    evidence: [
      e("Uzbekistan National News Agency", "https://uza.uz/oz/posts/adib-tilidagi-kishini-maftun-qiladigan-birinchi-xislat_636348", "Национальное агентство подтверждает биографию Каххара и называет «Sarob», «Sinchalak» и «O‘tmishdan ertaklar»."),
      e("Alisher Navo‘i Tashkent State University of Uzbek Language and Literature", "https://aphil.tsuull.uz/index.php/language-and-culture/article/view/39", "Университетская публикация рассматривает Абдуллу Каххара как узбекского писателя, драматурга и переводчика."),
    ],
    decision: "corrected",
    notes: "Оценочные слова «классик» и «мастер» заменены проверяемыми видами деятельности и конкретными произведениями; обобщённое поле «Рассказы» удалено.",
  },
  {
    key: "uzbekistan:abdulla_qodiriy",
    originalSha256: "e56b6288a64d5fcf8706e29a19e232f8409ad1cc4fd6a27822b1bd809772586e",
    reviewedTextRu: "Абдулла Кадыри — узбекский писатель, автор романов «Минувшие дни» и «Скорпион из алтаря». «Минувшие дни» относится к ранним узбекским романам.",
    evidence: [
      e("Uzbekistan National News Agency", "https://uza.uz/oz/posts/jaholatga-qarshi-maydonga-chiqqan-marifatparvar_587692", "Национальное агентство подтверждает биографию Кадыри и авторство романов «O‘tkan kunlar» и «Mehrobdan chayon»."),
      e("Alisher Navo‘i Tashkent State University of Uzbek Language and Literature", "https://tsuull.uz/sites/default/files/2022-2-son_yan_1_merged.pdf", "Университетское издание рассматривает «O‘tkan kunlar» как один из первых узбекских романов и связывает его с Кадыри."),
    ],
    decision: "corrected",
    notes: "Категоричное «основоположник» заменено более точной проверяемой формулировкой; авторство двух романов подтверждено.",
  },
  {
    key: "uzbekistan:alisher_navoi",
    originalSha256: "a4683be7d6b105e977e8abb0658af590831e563c2e4c5c668cb641e7c47eca23",
    reviewedTextRu: "Алишер Навои — поэт и государственный деятель эпохи Тимуридов, писавший прежде всего на чагатайском языке. Его «Хамса» состоит из пяти поэм, включая «Фархад и Ширин» и «Лейли и Меджнун».",
    evidence: [
      e("British Library", "https://searcharchives.bl.uk/catalog/032-003573865", "Каталог Британской библиотеки описывает Навои как чагатайского поэта и фиксирует рукописную традицию его произведений."),
      e("Government of Uzbekistan", "https://gov.uz/en/cirns/news/view/130357", "Официальный материал подтверждает деятельность Навои как поэта и государственного деятеля и его пятерицу «Хамса»."),
    ],
    decision: "corrected",
    notes: "Убраны оценочные определения и спорная национально-литературная формула; добавлены историко-языковой контекст и проверяемый состав цикла.",
  },
  {
    key: "uzbekistan:babur",
    originalSha256: "764c8da54fcaadf936bdfd3b411a13664d82f41de56cec6744a255d3e17024a0",
    reviewedTextRu: "Захириддин Мухаммад Бабур — правитель и основатель династии Великих Моголов, писавший на чагатайском языке. Он оставил мемуары, известные как «Бабур-наме».",
    evidence: [
      e("Smithsonian National Museum of Asian Art", "https://asia.si.edu/explore-art-culture/collections/collections-areas/southasian-himalayan/discovering-babur/", "Смитсоновский музей описывает Бабура как основателя династии Моголов и автора мемуаров «Baburnama»."),
      e("The Metropolitan Museum of Art", "https://www.metmuseum.org/art/collection/search/451959?od=on", "Метрополитен-музей атрибутирует рукопись «Baburnama» Бабуру и подтверждает её мемуарный характер."),
    ],
    decision: "corrected",
    notes: "Субъективная оценка литературного ранга удалена; уточнены историческая роль, язык и характер «Бабур-наме».",
  },
  {
    key: "uzbekistan:cholpon",
    originalSha256: "1afd619ee2852046332e78738f8267e69c9e7c258291ff09543a426ed0c9b0bd",
    reviewedTextRu: "Абдулхамид Чулпан — узбекский поэт, прозаик, драматург и переводчик. Он написал роман «Ночь и день» и был расстрелян 4 октября 1938 года.",
    evidence: [
      e("Uzbekistan National News Agency", "https://uza.uz/en/posts/cholponning-fojiali-taqdirini-yodga-soluvchi-hujjat-uning-pasporti-qayerda_308583", "Материал о паспортном документе подтверждает имя Абдулхамид Сулейманов Чулпан, 1897 год рождения и литературную деятельность."),
      e("Tashkent State University of Oriental Studies", "https://aps.tsuos.uz/storage/users/137/books/BQFLHBGLEJ4u5i92oGevFZHAfPPSEyKQxi7zYJaG.pdf", "Университетское издание датирует жизнь Чулпана 1897–1938 годами и указывает расстрел 4 октября 1938 года."),
    ],
    decision: "corrected",
    notes: "Удалена ранговая оценка; восстановлено полное имя и перечислены доказанные виды деятельности. Надёжные институциональные источники подтверждают 1897 год, но не единообразно подтверждают точный день рождения, поэтому точность снижена до года.",
  },
  {
    key: "uzbekistan:erkin_vohidov",
    originalSha256: "e3d33722f2d9c2bde92e05f9c25ec8b27ac41bca29945b3a233bc26899941390",
    reviewedTextRu: "Эркин Вахидов (1936–2016) — узбекский поэт, драматург и переводчик. Среди его произведений — поэма «Ruhlar isyoni» и пьеса «Oltin devor».",
    evidence: [
      e("Uzbekistan National News Agency", "https://uza.uz/uz/posts/istiqlol-kuychisi_673118", "Национальное агентство подтверждает даты жизни и деятельность Вахидова, а также называет «Nido», «Ruhlar isyoni», «Oltin devor» и «Istanbul fojiasi»."),
      e("Erkin Vohidov Memorial Park", "https://erkinvohidovpark.uz/uz", "Официальный мемориальный ресурс перечисляет «Nido» и «Ruhlar isyoni», а «Oltin devor» и «Istanbul fojiasi» относит к драматическим произведениям Вахидова."),
    ],
    decision: "corrected",
    notes: "Исходное описание расширено доказанными видами деятельности и произведениями. Неоднозначное обобщённое название «Слово» заменено четырьмя названиями на языке оригинала, которые оба источника прямо атрибутируют автору.",
  },
  {
    key: "uzbekistan:gafur_gulyam",
    originalSha256: "1bb9832d5a0e866cb865d28d16d024e9cb7ea7229edb64bb1d4d28eef9b52f0e",
    reviewedTextRu: "Гафур Гулям — узбекский поэт, прозаик и переводчик. Он написал повесть «Шум бола».",
    evidence: [
      e("Uzbekistan National News Agency", "https://uza.uz/en/posts/gafur-gulom-uy-muzeyidan-fotoreportaj_688750", "Материал государственного агентства о доме-музее подтверждает даты жизни и деятельность Гафура Гуляма как поэта, писателя и переводчика."),
      e("Alisher Navo‘i Tashkent State University of Uzbek Language and Literature", "https://tsuull.uz/sites/default/files/anjuman_materiallari._19.11._2020.pdf", "Университетское издание атрибутирует Гафуру Гуляму повесть «Shum bola»."),
    ],
    decision: "corrected",
    notes: "Оценочное «известный» заменено проверяемыми видами деятельности; нормализовано раздельное написание названия повести.",
  },
  {
    key: "uzbekistan:hamid_ismailov",
    originalSha256: "ce106634d613f6c101105d0d737a3fca6e5675c7206987165d72b5b2fc290e73",
    reviewedTextRu: "Хамид Исмаилов — узбекский писатель и журналист, пишущий по-узбекски и по-русски. Среди его романов — «Железная дорога», «Мёртвое озеро» и «Подземка».",
    evidence: [
      e("National Book Foundation", "https://www.nationalbook.org/people/hamid-ismailov/", "Биография фонда подтверждает узбекское происхождение, журналистскую работу, языки творчества и романы «The Railway», «The Dead Lake» и «The Underground»."),
      e("European Bank for Reconstruction and Development", "https://www.ebrd.com/home/news-and-events/news/2019/the-devils-dance-wins-the-2019-ebrd-literature-prize.html", "ЕБРР представляет Исмаилова как узбекского писателя и сообщает о награде за роман «The Devil’s Dance»."),
    ],
    decision: "corrected",
    notes: "Удалена оценка «международного уровня»; уточнены профессии, языки и библиография. Не подтверждённое источниками название «Дорога в Самарканд» удалено.",
  },
  {
    key: "uzbekistan:mahmudhoja_behbudi",
    originalSha256: "1077db611303c046cb9e8fe61e881d2a3a5ea91852f086179bd6e10350e10224",
    reviewedTextRu: "Махмудходжа Бехбуди — просветитель, публицист и драматург, связанный с джадидским движением в Туркестане. Он написал пьесу «Падаркуш».",
    evidence: [
      e("Turkiston Muxtoriyati memorial portal", "https://muxtoriyat.uz/index.php/en-us/members-of-the-government/members-of-the-national-assembly?catid=42&id=385&view=article", "Официальный мемориальный ресурс связывает Бехбуди с джадидизмом, атрибутирует ему «Падаркуш» и сообщает, что 25 марта 1919 года он был захвачен, а убит позднее."),
      e("Directorate for Culture and Arts under the Cabinet of Ministers of Uzbekistan", "https://dkm.gov.uz/ru/mamudhuza-bebudij", "Государственная биографическая справка подтверждает 1875 год рождения, просветительскую деятельность и пьесу «Падаркуш»."),
    ],
    decision: "corrected",
    notes: "Категоричное утверждение об основании отдельной «джадидской литературы» заменено проверяемой связью с движением. Точный день рождения в официальных источниках расходится, а 25 марта 1919 года один из них называет днём захвата, не смерти; поэтому профиль снижен до 1875 года, а точная дата смерти очищена fail-closed.",
  },
  {
    key: "uzbekistan:odil_yoqubov",
    originalSha256: "b70e73a2f6bb293810e622d66d41a2d221c2c34d9efd6dcf0b088fb12976bfed",
    reviewedTextRu: "Одил Якубов — узбекский писатель и публицист. Его роман «Сокровище Улугбека» был опубликован в 1973 году.",
    evidence: [
      e("Uzbekistan National News Agency", "https://uza.uz/en/posts/odil-yoqubov-mohir-tarjimon-munaqqid-va-publitsist-xotirasi_417713", "Национальное агентство подтверждает писательскую и публицистическую деятельность Якубова, документальную дату 20 октября 1926 года, смерть 21 декабря 2009 года и публикацию романа «Ulug‘bek xazinasi» в 1973 году."),
      e("UniLibrary Uzbekistan", "https://api.unilibrary.uz/storage/PublisherResourceFile/231678/images/1676014705.pdf", "Издание государственной библиотечной системы отмечает: в документах стоит 20 октября 1926 года, тогда как фактическим годом рождения называется 1927-й."),
    ],
    decision: "corrected",
    notes: "Субъективная ранговая оценка удалена; название романа нормализовано. Источники прямо фиксируют противоречие между документальной датой 20 октября 1926 года и биографическим 1927 годом, поэтому поле рождения очищено, а диапазон лет сохраняет обе версии fail-closed.",
  },
  {
    key: "vanuatu:grace_mera_molisa",
    originalSha256: "a98ecc885540a0575c0e4b8ba7a6f18f8c649344489cc67276f99e40a24692a7",
    reviewedTextRu: "Грейс Мера Молиса — поэтесса, издательница и общественная деятельница Вануату. В 1987 году она выпустила сборник «Colonised People: Poems».",
    evidence: [
      e("Poetry Foundation", "https://www.poetryfoundation.org/poets/grace-mera-molisa", "Биография подтверждает, что Молиса была поэтессой, издательницей, политической фигурой и активисткой Вануату."),
      e("Australian Department of Foreign Affairs and Trade", "https://www.dfat.gov.au/sites/default/files/focus-magazine-june-2002.pdf", "Официальный некролог подтверждает даты 17 февраля 1946 — 4 января 2002 года и общественную деятельность Молисы."),
      e("University of Canterbury Library", "https://libcat.canterbury.ac.nz/Record/520750", "Университетский каталог атрибутирует Молисе сборник «Colonised People: Poems», изданный в Порт-Виле в 1987 году."),
    ],
    decision: "corrected",
    notes: "Удалены оценочные формулы и широкое тематическое обобщение; оставлены проверяемые роли и книга. Обе профильные даты исправлены: исходные 17 января 1946 и 20 января 2002 года не подтверждаются источниками.",
  },
  {
    key: "venezuela:adriano_gonzalez_leon",
    originalSha256: "5f661aa1682ed04582c05ca71fcb90e901e67820bc8192f79f3669c1e31edcfe",
    reviewedTextRu: "Адриано Гонсалес Леон — венесуэльский писатель и преподаватель. Его роман «País portátil» получил премию Biblioteca Breve в 1968 году.",
    evidence: [
      e("Centro Virtual Cervantes", "https://cvc.cervantes.es/el_rinconete/anteriores/junio_08/27062008_02.asp", "Институт Сервантеса подтверждает биографию Гонсалеса Леона и победу романа «País portátil» в конкурсе Biblioteca Breve 1968 года."),
      e("Ministry of Culture of Venezuela", "https://www.mincultura.gob.ve/noticias/14-de-noviembre-nace-adriano-gonzalez-leon/", "Министерство культуры фиксирует рождение писателя 14 ноября 1931 года и перечисляет «País portátil», «Las hogueras más altas» и «Viejo»."),
    ],
    decision: "corrected",
    notes: "Сняты оценочные и неподтверждённые профессиональные характеристики; дата рождения исправлена с 13 на 14 ноября 1931 года, а ошибочные русские названия произведений заменены оригинальными доказанными названиями.",
  },
  {
    key: "venezuela:andres_bello",
    originalSha256: "55d5cec07d5d16edaa0af3bedb497b048776f462a4ed78860b554b3dbc513b89",
    reviewedTextRu: "Андрес Бельо — родившийся в Каракасе поэт, филолог, юрист и педагог, ставший первым ректором Чилийского университета. Он издал «Грамматику кастильского языка для американцев» в 1847 году.",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/andres_bello/autor_apunte/", "Биографический портал подтверждает рождение Бельо в Каракасе, его работу как поэта, филолога, юриста и педагога и основные сочинения."),
      e("University of Chile", "https://uchile.cl/presentacion/historia/rectores-de-la-u-de-chile/andres-bello-lopez-1843-1865", "Чилийский университет называет Бельо своим первым ректором и подтверждает публикацию грамматики в 1847 году."),
    ],
    decision: "corrected",
    notes: "Удалены ранговые и расплывчатые утверждения; оставлены конкретные роли, ректорство и издание грамматики. Обобщённые названия работ заменены библиографически установленными.",
  },
  {
    key: "venezuela:arturo_uslar_pietri",
    originalSha256: "2245781edea1d5a3e0782c592eaac8c5ed0e701c001d94539a6366f256c6265f",
    reviewedTextRu: "Артуро Услар Пьетри — венесуэльский писатель, эссеист и государственный деятель. Среди его романов — «Las lanzas coloradas» и «El camino de El Dorado».",
    evidence: [
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/arturo_uslar_pietri/autor_biografia/", "Биография подтверждает писательскую, эссеистическую и политическую деятельность Услара Пьетри и перечисляет его романы."),
      e("Princess of Asturias Foundation", "https://www.fpa.es/es/premios-princesa-de-asturias/premiados/?identificador=537&texto=trayectoria", "Фонд премии подтверждает биографию Услара Пьетри и называет «Las lanzas coloradas», «El camino de El Dorado» и другие произведения."),
    ],
    decision: "corrected",
    notes: "Удалены оценочные формулировки и широкое утверждение о влиянии; ошибочное «Чёрное золото» заменено доказанными произведениями, названия оставлены в оригинале во избежание ложной переводной атрибуции.",
  },
  {
    key: "venezuela:eduardo_blanco",
    originalSha256: "c61fb4dfe1444afd493ad550c80f6987d1aff1793ed5b74ac144d74ed5e889b1",
    reviewedTextRu: "Эдуардо Бланко — венесуэльский писатель. Он написал книгу «Venezuela heroica» и роман «Zárate».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/b/blanco-eduardo/", "Академическая историческая энциклопедия подтверждает даты 25 декабря 1838 — 30 января 1912 года и атрибутирует Бланко «Venezuela heroica» и «Zárate»."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/descargaPdf/quienes-escriben-en-venezuela-diccionario-abreviado-de-escritores-venezolanos-siglos-xviii-a-xxi--0/021555_7.pdf", "Справочник венесуэльских писателей подтверждает профессию, годы жизни и основные произведения Эдуардо Бланко."),
    ],
    decision: "corrected",
    notes: "Удалены ранговая оценка, недоказанное обобщение тематики и не подтверждённое источниками определение «Venezuela heroica» как цикла; неверная дата смерти 30 июня заменена на 30 января 1912 года, а ошибочное произведение — на доказанный роман.",
  },
  {
    key: "venezuela:eugenio_montejo",
    originalSha256: "9c247e867dfe5bf05620cdd5ef8163745f130bb4411e4b2226aeb51973264beb",
    reviewedTextRu: "Эухенио Монтехо — венесуэльский поэт и эссеист. Среди его сборников — «Élegos», «Muerte y memoria», «Terredad» и «Trópico absoluto».",
    evidence: [
      e("Fundación Empresas Polar", "https://bibliofep.fundacionempresaspolar.org/media/16771/coleccion_lenguaje_lw_fasciculo_25.pdf", "Научно-просветительское издание фонда подтверждает биографию Эухенио Монтехо и сборники «Élegos», «Muerte y memoria», «Terredad» и «Trópico absoluto»."),
      e("National Autonomous University of Mexico", "https://periodicodepoesia.unam.mx/010-entrevistas-eugenio-montejo/", "Университетское издание представляет Eugenio Montejo как венесуэльского поэта и эссеиста и датирует его смерть 7 июня 2008 года."),
      e("University of Carabobo", "https://poesia.uc.edu.ve/el-acertijo-de-un-sueno-eugenio-montejo-y-las-nubes/", "Университет Карабобо указывает, что Монтехо родился 19 октября 1938 года в Каракасе и умер 5 июня 2008 года в Валенсии, что подтверждает конфликт точных данных о смерти."),
    ],
    decision: "corrected",
    notes: "Убраны субъективная оценка и недоказанное тематическое толкование; имя передано по испанскому произношению, а сомнительные русские названия заменены оригинальными. Источники расходятся в точном дне и месте смерти, поэтому оба профильных поля очищены fail-closed.",
  },
  {
    key: "venezuela:fermin_toro",
    originalSha256: "e8cf0d76f8f746dbf2f4159bb60f7326cd320de4ec86078dcafea7c4fcedfac3",
    reviewedTextRu: "Фермин Торо — венесуэльский писатель, педагог, политик и дипломат XIX века. Он написал роман «Los mártires» и эссе «Reflexiones sobre la Ley del 10 de abril de 1834».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/t/toro-fermin/", "Историческая энциклопедия подтверждает биографию Торо как писателя, педагога, политика и дипломата и перечисляет его произведения."),
      e("Biblioteca Abierta Venezolana", "https://bibav.org/books/los-martires-toro-2017-6sduxnsc.html", "Венесуэльская цифровая библиотека атрибутирует Фермину Торо роман «Los mártires»."),
    ],
    decision: "corrected",
    notes: "Удалены оценочные и жанрово-исторические обобщения; три неатрибутируемых названия профиля заменены документированными произведениями.",
  },
  {
    key: "venezuela:juan_vicente_gonzalez",
    originalSha256: "b40f5af9643c6e3f57231c79759d7ec8bd559fc3f6199db7761b3a93bea3f794",
    reviewedTextRu: "Хуан Висенте Гонсалес — венесуэльский писатель, историк, журналист и педагог. Среди его работ — «Biografía del general José Félix Ribas» и «Manual de historia universal».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/g/gonzalez-juan-vicente/", "Историческая энциклопедия подтверждает даты и деятельность Гонсалеса как писателя, историка, журналиста и педагога и перечисляет его труды."),
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark%3A/12148/cb32180515w", "Каталог Национальной библиотеки Франции подтверждает авторство Хуана Висенте Гонсалеса и библиографическую атрибуцию его работ."),
    ],
    decision: "corrected",
    notes: "Непроверяемое утверждение об основании национальной исторической прозы удалено; профессии и конкретные труды подтверждены.",
  },
  {
    key: "venezuela:manuel_diaz_rodriguez",
    originalSha256: "346dd618cc0fb141db684717571371903068eb5d7f0bd8c2e0191ffdf616b310",
    reviewedTextRu: "Мануэль Диас Родригес — венесуэльский писатель и эссеист, связанный с испаноамериканским модернизмом. Он написал романы «Ídolos rotos» и «Sangre patricia».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/d/diaz-rodriguez-manuel/", "Энциклопедия указывает Чакао и даты 28 февраля 1871 — 23 августа 1927 года и атрибутирует Диасу Родригесу «Ídolos rotos», «Sangre patricia» и «Camino de perfección»."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/ruben_dario/obra/el-movimiento-de-los-nombres-en-idolos-rotos-de-manuel-diaz-rodriguez/", "Научная публикация библиотеки подтверждает авторство романа «Ídolos rotos» и его связь с модернизмом."),
      e("National Library of Spain", "https://datos.bne.es/resource/XX881051", "Авторитетная запись Национальной библиотеки Испании фиксирует 1871 год рождения, Чакао как место рождения и 1927 год смерти Мануэля Диаса Родригеса."),
    ],
    decision: "corrected",
    notes: "Удалена ранговая оценка; год и дата рождения исправлены с 1868 на 1871 год, место рождения — на Чакао, а неверные переводные названия заменены оригинальными. Авторитетная историческая энциклопедия указывает 23 августа 1927 года вместо 24 августа в исходном профиле; при отсутствии второго независимого подтверждения дневная точность очищена fail-closed.",
  },
  {
    key: "venezuela:miguel_otero_silva",
    originalSha256: "adae7a96c89f9cc6d6f8d3331071c750347be5bd1ad73e669923ab322a8f662a",
    reviewedTextRu: "Мигель Отеро Сильва — венесуэльский писатель, поэт и журналист. Среди его романов — «Casas muertas», «Cuando quiero llorar no lloro» и «Lope de Aguirre, príncipe de la libertad».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/o/otero-silva-miguel/", "Историческая энциклопедия подтверждает деятельность Отеро Сильвы и атрибутирует ему «Casas muertas», «Cuando quiero llorar no lloro» и «Lope de Aguirre, príncipe de la libertad»."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/descargaPdf/quienes-escriben-en-venezuela-diccionario-abreviado-de-escritores-venezolanos-siglos-xviii-a-xxi--0/021555_7.pdf", "Справочник венесуэльских писателей подтверждает биографию и основные романы Мигеля Отеро Сильвы."),
    ],
    decision: "corrected",
    notes: "Удалены субъективная оценка и неподтверждённое обобщение тематики; «Путь к Эльдорадо», принадлежащий Артуро Услару Пьетри, заменён романом самого Отеро Сильвы.",
  },
  {
    key: "venezuela:rafael_cadenas",
    originalSha256: "59d98d30eda57d9613028033bf4d4928b119e74c2e99aca6a1360b17744b37e7",
    reviewedTextRu: "Рафаэль Каденас — венесуэльский поэт, эссеист, переводчик и преподаватель. Он получил премию Сервантеса за 2022 год; среди его книг — «Los cuadernos del destierro» и «Falsas maniobras».",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/cadenas_rafael.htm", "Институт Сервантеса подтверждает биографию Каденаса как поэта, эссеиста, переводчика и преподавателя и перечисляет его сборники."),
      e("Ministry of Culture of Spain", "https://www.cultura.gob.es/mcd/actualidad/2023/04/230424-premio-cervantes-2022.html", "Официальное сообщение министерства подтверждает вручение Рафаэлю Каденасу премии Сервантеса за 2022 год."),
    ],
    decision: "corrected",
    notes: "Удалены ранговая оценка и интерпретация стиля; добавлены документированные роли и премия. Сомнительные русские названия заменены оригинальными библиографическими названиями.",
  },
  {
    key: "venezuela:romulo_gallegos",
    originalSha256: "785745cd7a6f6ddd158087309bf63dbb851838b703e6fd6a4d37887cbc2073f2",
    reviewedTextRu: "Ромуло Гальегос — венесуэльский писатель, педагог и политик, занимавший пост президента страны в 1948 году. Он написал романы «Doña Bárbara», «Cantaclaro» и «Canaima».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/g/gallegos-romulo/", "Историческая энциклопедия подтверждает литературную, педагогическую и политическую деятельность Гальегоса, президентство в 1948 году и его романы."),
      e("Biblioteca Virtual Miguel de Cervantes", "https://www.cervantesvirtual.com/portales/portal_nacional_venezuela/obra/dona-barbara--1/", "Цифровая библиотека атрибутирует Ромуло Гальегосу роман «Doña Bárbara»."),
    ],
    decision: "corrected",
    notes: "Удалены ранговая и каноническая оценки; добавлена проверяемая президентская должность. Ошибочное «Поднимающийся ветер» заменено доказанным романом «Cantaclaro».",
  },
  {
    key: "venezuela:simon_rodriguez",
    originalSha256: "48eff82ffbc1bd23e395c6352fee5fc086400c78fe2fbb51c0d1a2331d14b8cd",
    reviewedTextRu: "Симон Родригес — венесуэльский педагог и мыслитель, учитель Симона Боливара. Среди его работ — «Sociedades americanas en 1828» и «Luces y virtudes sociales».",
    evidence: [
      e("Fundación Empresas Polar — Diccionario de Historia de Venezuela", "https://bibliofep.fundacionempresaspolar.org/dhv/entradas/r/rodriguez-simon/", "Историческая энциклопедия подтверждает деятельность Родригеса как педагога и мыслителя, его связь с Боливаром, основные труды и смерть в Амотапе, Перу."),
      e("Real Academia de la Historia", "https://historia-hispanica.rah.es/biografias/39456-simon-rodriguez", "Биографическая база Королевской академии истории подтверждает педагогическую деятельность, роль учителя Симона Боливара и смерть Родригеса 28 февраля 1854 года в Амотапе, Перу."),
    ],
    decision: "corrected",
    notes: "Расплывчатое тематическое резюме заменено двумя конкретными трудами; характеристика наставничества уточнена до документированного учительства. Опечатка в месте смерти «Амота» исправлена на подтверждённое источниками «Амотапе».",
  },
  {
    key: "venezuela:teresa_de_la_parra",
    originalSha256: "80b1bd0ce97121cdbe38824d2636022c5be1bf0d059a72f41df0de119d286958",
    reviewedTextRu: "Тереса де ла Парра — венесуэльская писательница, родившаяся в Париже и выросшая в Венесуэле. Она написала романы «Ifigenia» и «Las memorias de Mamá Blanca».",
    evidence: [
      e("Instituto Cervantes", "https://cervantes.org/es/sobre-nosotros/publicaciones/teresa-parra-textos-recuperados", "Институт Сервантеса подтверждает венесуэльскую принадлежность Тересы де ла Парры и авторство «Ifigenia» и «Las memorias de Mamá Blanca»."),
      e("Fundación Empresas Polar", "https://bibliofep.fundacionempresaspolar.org/media/1378306/1venezuela_en_la_literatura_190-376.pdf", "Литературоведческое издание фонда подтверждает рождение писательницы в Париже, её воспитание в Венесуэле и библиографию."),
    ],
    decision: "corrected",
    notes: "Удалена субъективная оценка значимости; конкретизированы место рождения, связь с Венесуэлой и два романа. Названия в профиле приведены в оригинальной библиографической форме.",
  },
];

export const writerBiographyFactReviewBatch56: readonly WriterBiographyFactReviewRecord[] = seeds.map(
  (seed) => {
    const verdict: WriterBiographyClaimVerdict =
      seed.decision === "held"
        ? "not-established"
        : seed.decision === "unchanged"
          ? "supported"
          : "corrected";
    return {
      key: seed.key,
      originalSha256: seed.originalSha256,
      reviewedTextRu: seed.reviewedTextRu,
      applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
      claims: [
        {
          textRu: seed.reviewedTextRu,
          verdict,
          evidence: seed.evidence.map(([provider, url, findingRu]) => ({
            provider,
            url,
            checkedAt,
            findingRu,
          })),
        },
      ],
      reviewer,
      decision: seed.decision,
      notes: seed.notes,
    };
  }
);
