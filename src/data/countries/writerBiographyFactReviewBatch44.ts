export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH44_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 44";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH44_REVIEWER;
const checkedAt = "2026-08-21";

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

const seeds = [
  {
    key: "paraguay:manuel_ortiz_guerrero",
    originalSha256: "a03a32ed33e6db861b6e44c56f6b1e7416965711d7c576ff0ba9c41144ed0d91",
    reviewedTextRu: "Мануэль Ортис Герреро - парагвайский поэт и драматург, писавший на испанском и гуарани. Его стихи стали текстами гуараний «India», «Panambí Verá» и «Nerendápe aju», созданных вместе с композитором Хосе Асунсьоном Флоресом.",
    evidence: [
      e("Municipalidad de Asunción", "https://www.asuncion.gov.py/historia-de-mis-calles/manuel-ortiz-guerrero-calle-que-la-ciudad-de-asuncion-ha-nominado-con-gran-afecto", "Муниципальная биография подтверждает поэтическую и драматургическую деятельность Ортиса Герреро, но указывает дату рождения 16 июля 1894 года."),
      e("Secretaría Nacional de Cultura", "https://cultura.gov.py/2021/08/agostope-jaguerohory-nee-guarani/", "Государственный культурный портал независимо подтверждает поэзию, драматургию, сотрудничество с Хосе Асунсьоном Флоресом и произведения автора, но указывает другую дату рождения - 16 июля 1897 года."),
    ],
    decision: "corrected",
    notes: "Официальные источники расходятся в годе рождения - 1894 и 1897, поэтому год и полная дата рождения удержаны от публикации; субъективное ранжирование заменено языками, жанрами и тремя документированными песенными текстами.",
  },
  {
    key: "paraguay:mario_ruben_alvarez",
    originalSha256: "55408aecd40537d77960cc83fea6434e35581ba7150c2fc5f9c7ef38423858bc",
    reviewedTextRu: "Марио Рубен Альварес Бенитес (род. 1954) - парагвайский поэт, журналист, переводчик и исследователь народной культуры, пишущий на испанском и гуарани. Среди его книг - «La sangre insurrecta», «Ñe’ẽ apytere / A flor de ausencia» и цикл «Las voces de la memoria».",
    evidence: [
      e("Secretaría de Políticas Lingüísticas", "https://spl.gov.py/es/academia-de-la-lengua-guarani/", "Официальный языковой орган подтверждает членство Альвареса в Академии языка гуарани и его работу с двуязычной культурой."),
      e("Secretaría Nacional de Cultura", "https://cultura.gov.py/2014/05/amplio-abanico-de-la-poesia-popular-se-abrio-en-la-libroferia/", "Государственный культурный портал независимо подтверждает литературную и исследовательскую деятельность и книги автора."),
    ],
    decision: "corrected",
    notes: "Общая формула заменена полным именем, ролями, языками и тремя реальными книгами; фиктивная дата 1 января исправлена отдельно.",
  },
  {
    key: "paraguay:natalicio_gonzalez",
    originalSha256: "e1ddc45d517759e481badaae12193136b4ce3ecc438164e02ac114b0c4eec45f",
    reviewedTextRu: "Хуан Наталисио Гонсалес Паредес (1897-1966) - парагвайский писатель, журналист и политический деятель, занимавший пост президента страны в 1948-1949 годах. В книгах «El Paraguay eterno», «Proceso y formación de la cultura paraguaya» и «Baladas guaraníes» он обращался к истории и культуре Парагвая.",
    evidence: [
      e("Municipalidad de Asunción", "https://www.asuncion.gov.py/historia-de-mis-calles/la-calle-natalicio-gonzalez-recuerda-a-quien-fue-presidente-del-paraguay-gran-escritor-y-politico", "Муниципальная биография подтверждает полное имя, годы, писательскую и президентскую деятельность Гонсалеса."),
      e("Biblioteca y Archivo Central del Congreso Nacional", "https://catalogo.bacn.gov.py/opac_css/index.php?id=9614&lvl=notice_display", "Каталог парламентской библиотеки независимо подтверждает авторство и библиографию Гонсалеса."),
    ],
    decision: "corrected",
    notes: "Субъективная интеллектуальная оценка заменена президентским сроком, полным именем и тремя каталогизированными книгами.",
  },
  {
    key: "paraguay:rafael_barrett",
    originalSha256: "083aa26f01a0e195c3805d6aead05bb06a9b6b7be047b96bec91c71ab8628b85",
    reviewedTextRu: "Рафаэль Баррет (1876-1910) - испанский писатель, журналист и общественный мыслитель, чья литературная работа была тесно связана с Парагваем. В очерках «El dolor paraguayo» и «Lo que son los yerbales» он писал об условиях труда и социальном неравенстве.",
    evidence: [
      e("Secretaría Nacional de Cultura", "https://cultura.gov.py/2018/02/premian-a-ganadores-del-iv-concurso-nacional-de-ensayos-rafael-barrett/", "Государственный культурный портал подтверждает писательскую и общественную роль Баррета в Парагвае."),
      e("Municipalidad de Asunción", "https://www.asuncion.gov.py/tesoros-de-mi-ciudad/el-edificio-de-la-industrial-paraguaya-en-el-centro-de-asuncion-recuerda-a-los-mensu-de-nuestra-historia-que-malgastaron-su-vida-en-los-yerbales", "Муниципальный исторический материал независимо связывает Баррета и его очерки с эксплуатацией работников на мате-плантациях."),
    ],
    decision: "corrected",
    notes: "Субъективное влияние заменено происхождением, документированными жанрами и двумя очерковыми книгами; место смерти исправлено отдельно.",
  },
  {
    key: "paraguay:rubén_bareiro_saguier",
    originalSha256: "3e616c612916b5bba3383028f5502ac6db2a9fdf64ff1e9867d3ec3908f73fee",
    reviewedTextRu: "Рубен Барейро Сагьер (1930-2014) - парагвайский поэт, прозаик, эссеист, преподаватель и дипломат. Сборник рассказов «Ojo por diente» получил премию Casa de las Américas, а книга «La rosa azul» - Национальную литературную премию Парагвая.",
    evidence: [
      e("Centro Cultural de la República El Cabildo", "https://cabildoccr.gov.py/biografia-maestro/ruben-bareiro-saguier", "Государственный культурный центр подтверждает годы, место рождения, профессии, книги и награды Барейро Сагьера."),
      e("Secretaría Nacional de Cultura", "https://cultura.gov.py/2017/03/recuerdan-3-anos-del-fallecimiento-del-escritor-ruben-bareiro-saguier/", "Государственный культурный портал независимо подтверждает смерть в Асунсьоне, литературные роли и наследие автора."),
    ],
    decision: "corrected",
    notes: "Общая тематическая оценка заменена ролями, двумя книгами и точными премиями; неверные дата и места исправлены отдельно.",
  },
  {
    key: "peru:alfredo_bryce_echenique",
    originalSha256: "2d9d8adf1626eb30a484584c4cf8ff6d3a97c7c116853ff86d9d2d8641865056",
    reviewedTextRu: "Альфредо Брис Эченике (1939-2026) - перуанский прозаик и мемуарист, в книгах которого ирония сочетается с вниманием к памяти и социальной среде Лимы. Среди его произведений - «Un mundo para Julius», «La vida exagerada de Martín Romaña» и «El huerto de mi amada».",
    evidence: [
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/adios-alfredo-bryce-echenique-1939-2026/", "Национальный литературный центр подтверждает годы 1939-2026, литературные роли и основные книги Брис Эченике."),
      e("Centro Virtual Cervantes", "https://cvc.cervantes.es/benengeli/22/biografias.htm", "Институт Сервантеса независимо подтверждает биографию, жанры и библиографию писателя."),
    ],
    decision: "corrected",
    notes: "Карточка обновлена после смерти автора; субъективное ранжирование и ошибочная библиография заменены жанрами и тремя романами.",
  },
  {
    key: "peru:cesar_vallejo",
    originalSha256: "f9e9a3432bf9346f02aebc1ba557fbdb08b47ee79cdce19765b30136e31ed25b",
    reviewedTextRu: "Сесар Вальехо (1892-1938) - перуанский поэт, прозаик и драматург; книга «Trilce» относится к латиноамериканскому авангарду. Среди его поэтических сборников также «Los heraldos negros», «Poemas humanos» и «España, aparta de mí este cáliz».",
    evidence: [
      e("Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/bnp-rinde-homenaje-a-cesar-vallejo-al-cumplirse-131-anos-de-su-natalicio/", "Национальная библиотека Перу подтверждает годы, жанровые роли и произведения Вальехо."),
      e("Poetry Foundation", "https://www.poetryfoundation.org/poets/cesar-vallejo", "Литературная организация независимо подтверждает биографию, авангардный контекст Trilce и библиографию."),
    ],
    decision: "corrected",
    notes: "Субъективное мировое ранжирование заменено годами, жанрами и четырьмя конкретными сборниками.",
  },
  {
    key: "peru:claudia_salazar_jimenez",
    originalSha256: "56ac63d194855f61fe9761402f9569f27c8fdc5d619efb698ebb8fafce497ff5",
    reviewedTextRu: "Клаудия Салазар Хименес (род. 1976) - перуанская писательница, исследовательница и преподавательница. Её роман «La sangre de la aurora» о женщинах во время внутреннего вооружённого конфликта в Перу получил Premio Las Américas de Narrativa 2014 года.",
    evidence: [
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/novela-genero-memoria-dialogo-claudia-salazar/claudia-salazar/", "Национальный литературный центр подтверждает год рождения, профессии, роман и его тематику."),
      e("California State University, Long Beach", "https://www.csulb.edu/university-library/article/claudia-salazar-jimenez-to-speak-at-csulb", "Университет независимо подтверждает академическую деятельность, роман и Premio Las Américas 2014 года."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и ложные названия заменены профессиями, романом и премией; неподтверждённый точный день рождения снят.",
  },
  {
    key: "peru:eduardo_gonzalez_viana",
    originalSha256: "7833d097d07451280e3a030f913c387837211bb586498d95f1d1e3f6594c911c",
    reviewedTextRu: "Эдуардо Гонсалес Вьяна (род. 1941) - перуанский писатель, журналист и преподаватель, родившийся в Чепене. Роман «El corrido de Dante» и другие его книги обращаются к опыту латиноамериканской миграции в США.",
    evidence: [
      e("Instituto Cervantes", "https://cultura.cervantes.es/palermo/es/espa%C3%B1a-y-el-per%C3%BA/149880", "Институт Сервантеса подтверждает место рождения, профессии и литературную деятельность Гонсалеса Вьяны."),
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/homenaje-al-escritor-eduardo-gonzalez-viana-sabado-2-marzo/", "Национальный литературный центр независимо подтверждает биографию и роман El corrido de Dante."),
    ],
    decision: "corrected",
    notes: "Ошибочное место рождения и вымышленные названия заменены Чепеном, профессиями и документированным романом.",
  },
  {
    key: "peru:fernando_iwasaki",
    originalSha256: "14098332a91ee95758e7492aea9c083ca400e16a83cc48312f58febf9ffab5e1",
    reviewedTextRu: "Фернандо Ивасаки (род. 1961) - перуанско-испанский писатель, историк, эссеист и профессор Университета Лойола Андалусия. Среди его книг - «Ajuar funerario», «Neguijón» и «Libro de mal amor».",
    evidence: [
      e("Universidad Loyola Andalucía", "https://www.uloyola.es/en/scientific-offer/researchers/fernando-iwasaki-cauti", "Университетский профиль подтверждает полное имя, год рождения, профессии и академическую должность Ивасаки."),
      e("Instituto Cervantes", "https://www.cervantes.es/FichasCultura/Ficha89015_00_1.htm", "Институт Сервантеса независимо подтверждает литературную деятельность и библиографию автора."),
    ],
    decision: "corrected",
    notes: "Родовое описание и ложные заголовки заменены профессиями и тремя книгами; неподтверждённый точный день рождения снят.",
  },
  {
    key: "peru:inca_garcilaso_de_la_vega",
    originalSha256: "5d8987d18809ac4b3ab67ba67c881373c4026de651ca96483acc2b9dd3924c49",
    reviewedTextRu: "Инка Гарсиласо де ла Вега (1539-1616), родившийся под именем Гомес Суарес де Фигероа, - хронист и переводчик, сын испанского капитана и инкской принцессы. В «Comentarios reales de los incas» и «Historia General del Perú» он соединил устную андскую традицию с письменной историографией.",
    evidence: [
      e("Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/bnp-se-cumplen-485-anos-del-nacimiento-del-inca-garcilaso-de-la-vega/", "Национальная библиотека подтверждает имя при рождении, годы, происхождение и основные хроники Гарсиласо."),
      e("Casa de la Literatura Peruana", "https://intensidadyaltura.casadelaliteratura.gob.pe/inca-garcilaso/desencuentros/", "Национальный литературный центр независимо подтверждает двукультурную биографию и историографическую работу хрониста."),
    ],
    decision: "corrected",
    notes: "Субъективная первостепенность заменена именем при рождении, ролями, происхождением и двумя хрониками.",
  },
  {
    key: "peru:ivan_thays",
    originalSha256: "dbc77392469548e9350674da8a38c8ab719de373d684f3fba249d22b82abe96a",
    reviewedTextRu: "Иван Тайс (род. 1968) - перуанский прозаик, преподаватель и автор литературных программ. Среди его книг - сборник «Las fotografías de Frances Farmer» и романы «Un lugar llamado Oreja de Perro» и «La disciplina de la vanidad»; в 2000 году он получил премию Принца Клауса.",
    evidence: [
      e("Centro Virtual Cervantes", "https://cvc.cervantes.es/benengeli/26/biografias.htm", "Институт Сервантеса подтверждает год рождения, литературную и преподавательскую деятельность и книги Тайса."),
      e("Hay Festival", "https://www.hayfestival.com/artist.aspx?artistid=1829", "Международная литературная организация независимо подтверждает профессии, библиографию и премию Принца Клауса."),
    ],
    decision: "corrected",
    notes: "Общее поколенческое ранжирование и ложная премия Эрральде заменены ролями, тремя книгами и точной премией; день рождения снят.",
  },
  {
    key: "peru:jose_maria_arguedas",
    originalSha256: "a6ecadce3f235c7f3ffc79c2e0c2858fc95a07cf6976f9e7a49e30213e2447f5",
    reviewedTextRu: "Хосе Мария Аргедас (1911-1969) - перуанский писатель, этнолог, переводчик и преподаватель. В романах «Los ríos profundos», «Yawar Fiesta» и «El zorro de arriba y el zorro de abajo» он изображал взаимодействие испаноязычного и андского миров Перу.",
    evidence: [
      e("Biblioteca Nacional del Perú", "https://memoriaperu.bnp.gob.pe/micrositio/jose-maria-arguedas", "Национальная библиотека подтверждает годы, литературные и этнологические роли и библиографию Аргедаса."),
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/jose-maria-arguedas-puentes-vida-los-rios-profundos/", "Национальный литературный центр независимо подтверждает роман Los ríos profundos и связь испаноязычного и андского миров."),
    ],
    decision: "corrected",
    notes: "Широкое ранжирование заменено профессиями и тремя романами; ошибочное название «Шестьдесят» снято в структурной карточке.",
  },
  {
    key: "peru:jose_watanabe",
    originalSha256: "d9e2a8e1b77561ec9011b35817aaad2262a4b82717f986a286322dde57f18393",
    reviewedTextRu: "Хосе Ватанабе (1945-2007) - перуанский поэт, прозаик и сценарист японского происхождения, родившийся в Ларедо. Среди его поэтических книг - «Álbum de familia», «El huso de la palabra» и «Historia natural».",
    evidence: [
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/poesia-facetas-jose-watanabe-10-anos-sin-vate/cosas_full/", "Национальный литературный центр подтверждает рождение в Ларедо в 1945 году, профессии и книги Ватанабе."),
      e("Biblioteca Nacional del Perú", "https://isbn.bnp.gob.pe/catalogo.php?mode=detalle&nt=101762", "Национальная ISBN-база независимо подтверждает авторскую идентичность и библиографию Ватанабе."),
    ],
    decision: "corrected",
    notes: "Неверные год и место рождения, субъективное ранжирование и три ошибочных названия заменены точными данными и реальными книгами.",
  },
  {
    key: "peru:juan_espinosa_medrano",
    originalSha256: "241aec598db94a47ec18147e7f9dad4d333daffa80f2b90a268494eab1601b02",
    reviewedTextRu: "Хуан де Эспиноса Медрано, известный как Лунарехо (ок. 1632-1688), - перуанский проповедник, богослов, драматург и писатель эпохи барокко. Среди его произведений - «Apologético en favor de don Luis de Góngora» и посмертный сборник проповедей «La novena maravilla».",
    evidence: [
      e("Revista Fénix, Biblioteca Nacional del Perú", "https://revistafenix.bnp.gob.pe/index.php/fenix/article/view/327", "Научное издание Национальной библиотеки подтверждает приблизительный год рождения, годы жизни, роли и произведения Эспиносы Медрано."),
      e("Centro Virtual Cervantes", "https://cvc.cervantes.es/literatura/criticon/PDF/116/116_147.pdf", "Рецензируемое исследование Института Сервантеса независимо подтверждает барочную деятельность и библиографию Лунарехо."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено приблизительными годами, ролями и двумя произведениями; спорные точные даты и узкое место рождения сняты.",
  },
  {
    key: "peru:julio_ortega",
    originalSha256: "6b824773222d5461878e65faf1cb6d15db2e2c45ff3f94368858456b29fc3d32",
    reviewedTextRu: "Хулио Ортега (род. 1942) - перуанский литературовед, критик, поэт, драматург и прозаик, почётный профессор Брауновского университета. Среди его книг - «El discurso de la abundancia», «La mesa del padre» и «Ayacucho, Good Bye».",
    evidence: [
      e("Brown University", "https://vivo.brown.edu/display/jortega", "Университетский профиль подтверждает год рождения, профессии, академическую должность и библиографию Ортеги."),
      e("Centro Virtual Cervantes", "https://cvc.cervantes.es/lengua/anuario/anuario_08/pdf/literatura20.pdf", "Институт Сервантеса независимо подтверждает литературоведческую и художественную деятельность перуанского автора."),
    ],
    decision: "corrected",
    notes: "Субъективная известность заменена профессиями, должностью и тремя книгами; неподтверждённые день и узкое место рождения сняты.",
  },
  {
    key: "peru:julio_ramon_ribeyro",
    originalSha256: "29e2666c75be6518460f0efed41694a2956f330cfed9d6b2c73b7d43beea7177",
    reviewedTextRu: "Хулио Рамон Рибейро (1929-1994) - перуанский прозаик, драматург и эссеист, работавший прежде всего с коротким рассказом. Его рассказы собраны в цикле «La palabra del mudo»; в 1994 году он получил Премию латиноамериканской и карибской литературы имени Хуана Рульфо.",
    evidence: [
      e("Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/obras-de-julio-ramon-ribeyro-son-declaradas-patrimonio-cultural-de-la-nacion/", "Национальная библиотека подтверждает годы, жанры, произведения и значение корпуса рассказов Рибейро."),
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/seminario-sobre-julio-ramon-ribeyro/", "Национальный литературный центр независимо подтверждает жанровую деятельность, La palabra del mudo и премию Хуана Рульфо."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и ложная премия Сервантеса заменены жанрами, циклом рассказов и точной премией 1994 года.",
  },
  {
    key: "peru:manuel_gonzalez_prada",
    originalSha256: "cc9ad333789e9c21ccaa494c4c52ad4eade2c449cd4f8f8a7e14ecc1a2e72559",
    reviewedTextRu: "Мануэль Гонсалес Прада (1844-1918) - перуанский поэт, эссеист, журналист и общественный мыслитель, руководивший Национальной библиотекой Перу. В книгах «Pájinas libres» и «Horas de lucha» он выступал за обновление литературы и критиковал социальное неравенство и политический консерватизм.",
    evidence: [
      e("Biblioteca Nacional del Perú", "https://memoriaperu.bnp.gob.pe/micrositio/manuel-gonzalez-prada", "Национальная библиотека подтверждает годы, литературные роли, директорскую должность и произведения Гонсалеса Прады."),
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/publicacion-la-semana-horas-lucha-manuel-gonzalez-prada/", "Национальный литературный центр независимо подтверждает Horas de lucha, публицистику и общественную критику автора."),
    ],
    decision: "corrected",
    notes: "Субъективная реформаторская оценка заменена профессиями, библиотечной должностью и двумя книгами в оригинальной орфографии.",
  },
  {
    key: "peru:mario_bellatin",
    originalSha256: "6bfc2e3b5a525576a3b48bb128a5e4706d26d2f86c1b44b0891d8379095b0d94",
    reviewedTextRu: "Марио Беллатин (род. 1960) - мексиканский писатель, родившийся в Мехико и опубликовавший первые книги в Перу. Среди его произведений - «Salón de belleza», «Flores», «El gran vidrio» и «Shiki Nagaoka: una nariz de ficción».",
    evidence: [
      e("Instituto Cervantes", "https://libroselectronicos.cervantes.es/resources/6113b88e4e753100017cb0e5", "Институт Сервантеса подтверждает год и место рождения, мексиканскую идентичность, перуанский период и библиографию Беллатина."),
      e("University of Iowa", "https://iowaliteraria.lib.uiowa.edu/article/colaboran/", "Университетский литературный ресурс независимо подтверждает биографию, профессии и произведения писателя."),
    ],
    decision: "corrected",
    notes: "Субъективная оригинальность заменена национальностью, местом рождения, перуанским периодом и четырьмя книгами; спорный день снят.",
  },
  {
    key: "peru:mario_vargas_llosa",
    originalSha256: "bd7baafef9a664956da0c921352feabd3c494e7f1010a5cd2700406278d63210",
    reviewedTextRu: "Марио Варгас Льоса (1936-2025) - перуанский прозаик, эссеист и журналист, связанный с латиноамериканским литературным бумом. Он получил Нобелевскую премию по литературе 2010 года.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2010/vargas_llosa/25160-mario-vargas-llosa-biografia/", "Официальная Нобелевская биография подтверждает годы 1936-2025, литературные роли и премию 2010 года."),
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/biografias/berlin_mario_vargas_llosa.htm", "Институт Сервантеса независимо подтверждает происхождение, профессии, библиографию и награды Варгаса Льосы."),
    ],
    decision: "corrected",
    notes: "Карточка обновлена после смерти автора; субъективное ранжирование заменено историко-литературной связью и точной наградой.",
  },
  {
    key: "peru:oscar_colchado_lucio",
    originalSha256: "0ab60aa6ce28dea434fa48d7e13909aafc1e4ee8636f93219942a71b0133438d",
    reviewedTextRu: "Оскар Кольчадо Лусио (1947-2023) - перуанский писатель, поэт и педагог, обращавшийся к устной традиции и мифологии Анд. В его прозе, включая роман «Rosa Cuchillo» и цикл о Чолито, андское мировидение связано с социальной историей Перу.",
    evidence: [
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/oscar-colchado-lucio-renovador-la-mirada-mundo-andino/", "Национальный литературный центр подтверждает точные даты, место рождения, профессии, книги и андскую тематику Кольчадо."),
      e("Ministerio de Cultura del Perú", "https://transparencia.cultura.gob.pe/sites/default/files/transparencia/2023/05/resoluciones-ministeriales/rm000201-2023-mc.pdf", "Официальное постановление Министерства культуры независимо подтверждает годы жизни и литературный вклад автора."),
    ],
    decision: "corrected",
    notes: "Ошибочные дата, место рождения и открытые годы исправлены; общая региональная оценка заменена профессиями, романом и циклом.",
  },
  {
    key: "peru:ricardo_palma",
    originalSha256: "6ecc6ea4bfcf352f462b64fb05d8dff2294f50ea62bbd4d80a74d4a803e75d9e",
    reviewedTextRu: "Рикардо Пальма (1833-1919) - перуанский писатель, журналист и библиотекарь, автор многотомного цикла «Tradiciones peruanas», соединяющего литературный рассказ с историческим материалом. После войны с Чили он руководил восстановлением Национальной библиотеки Перу.",
    evidence: [
      e("Biblioteca Nacional del Perú", "https://www.bnp.gob.pe/bnp-realza-figura-de-ricardo-palma-al-cumplirse-191-anos-de-su-natalicio/", "Национальная библиотека подтверждает годы, жанры, Tradiciones peruanas и руководство восстановлением библиотеки."),
      e("Casa de la Literatura Peruana", "https://www.casadelaliteratura.gob.pe/ricardo-palma/", "Национальный литературный центр независимо подтверждает биографию и сочетание исторического материала с литературой в Tradiciones."),
    ],
    decision: "corrected",
    notes: "Абсолютное утверждение о создании жанра заменено профессиями, многотомным циклом и документированной работой в Национальной библиотеке.",
  },
  {
    key: "peru:santiago_roncagliolo",
    originalSha256: "8c8425b78946c88bc6756699f9e3ca2ba876a77ea31dff486a66a8aace0f01cd",
    reviewedTextRu: "Сантьяго Ронкальоло (род. 1975) - перуанский писатель, журналист, переводчик и сценарист. Роман «Abril rojo» принёс ему премию «Альфагуара» 2006 года; в его прозе важны политическая история и опыт насилия в Перу.",
    evidence: [
      e("Instituto Cervantes", "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/roncagliolo_santiago.htm", "Институт Сервантеса подтверждает дату рождения 29 марта 1975 года, профессии, Abril rojo и премию Альфагуара."),
      e("Penguin Random House Grupo Editorial", "https://www.penguinlibros.com/es/4398-santiago-roncagliolo", "Издательский профиль независимо подтверждает литературную деятельность, библиографию и политико-исторические темы автора."),
    ],
    decision: "corrected",
    notes: "Ошибочный месяц рождения и субъективная известность заменены точной датой, профессиями, романом и премией.",
  },
  {
    key: "philippines:edith_tiempo",
    originalSha256: "3a3c66823408a035b138d819a6ee4ee2e65294f41b399e538f40e008c1ae61bf",
    reviewedTextRu: "Эдит Тьемпо (1919-2011) - филиппинская поэтесса и прозаик, удостоенная звания Национального художника Филиппин в области литературы в 1999 году. Вместе с Эдильберто Тьемпо она основала Национальную писательскую мастерскую Силлиман и много лет руководила ею.",
    evidence: [
      e("Lawphil", "https://lawphil.net/executive/proc/proc1999/proc_218_1999.html", "Официальная президентская прокламация подтверждает литературную деятельность и звание Национального художника 1999 года."),
      e("University of Santo Tomas", "https://www.ust.edu.ph/hidalgo-lectures-on-edith-l-tiempos-fiction-for-nccas-national-artists-for-literature-series/", "Университет независимо подтверждает годы, прозу, звание и соучредительство писательской мастерской Силлиман."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено официальным званием и документированной писательской мастерской; русское имя нормализовано.",
  },
  {
    key: "philippines:f_sionil_jose",
    originalSha256: "d0ede57d41981a66f92236d2d63d43c85a8057160283f8624592cbae80be243e",
    reviewedTextRu: "Франсиско Сиониль Хосе (1924-2022) - филиппинский прозаик и эссеист, Национальный художник Филиппин в области литературы. Его романы, в том числе цикл «Rosales Saga», обращены к социальной истории страны, неравенству и наследию колониализма.",
    evidence: [
      e("Cultural Center of the Philippines", "https://hanggangsamuli.culturalcenter.gov.ph/obituaries/f-sionil-jose/", "Государственный культурный центр подтверждает годы, жанры, звание Национального художника и библиографию Хосе."),
      e("University of the Philippines", "https://up.edu.ph/celebrating-the-life-of-national-artist-f-sionil-jose-97/", "Национальный университет независимо подтверждает жизнь, литературные роли, Rosales Saga и социальную тематику."),
    ],
    decision: "corrected",
    notes: "Субъективная известность заменена годами, жанрами, официальным званием и тематикой документированного романного цикла.",
  },
  {
    key: "philippines:francisco_balagtas",
    originalSha256: "cc6df036cbd585fc797ad74bafb6053fe71cd5983d732a48d9edfcf286f3c5ce",
    reviewedTextRu: "Франсиско Балагтас (1788-1862) - филиппинский поэт и драматург XIX века, автор произведений на тагальском языке. Ему принадлежат поэма «Florante at Laura» и пьеса «Orosmán at Zafira».",
    evidence: [
      e("National Historical Commission of the Philippines", "https://philhistoricsites.nhcp.gov.ph/registry_database/francisco-c-baltazar-balagtas-1788-1862/", "Официальный реестр подтверждает полное имя, точное место рождения, годы и произведения Балагтаса."),
      e("Lawphil", "https://lawphil.net/executive/proc/proc1986/proc_5_1986.html", "Официальная президентская прокламация независимо подтверждает тагальскую поэзию и авторство Florante at Laura."),
    ],
    decision: "corrected",
    notes: "Вольное утверждение об основании литературы заменено годами, языком, поэмой и пьесой; неверное место рождения исправлено отдельно.",
  },
  {
    key: "philippines:jose_rizal",
    originalSha256: "1211007cb7877c41d10af34131b724c7c650a6fc38c8727ae53ad4a9d3e608c3",
    reviewedTextRu: "Хосе Рисаль (1861-1896) - филиппинский писатель, врач и реформатор, автор романов «Noli me tangere» и «El filibusterismo», обличавших колониальное угнетение. Его казнь в 1896 году сделала Рисаля символом национального движения.",
    evidence: [
      e("National Historical Commission of the Philippines", "https://philhistoricsites.nhcp.gov.ph/registry_database/jose-protacio-rizal-1861-1896/", "Официальный реестр подтверждает полное имя, годы, профессии, романы и казнь Рисаля."),
      e("Library of Congress", "https://guides.loc.gov/world-of-1898/jose-rizal", "Библиотека Конгресса независимо подтверждает реформаторскую деятельность, два романа и обстоятельства казни."),
    ],
    decision: "corrected",
    notes: "Общая национальная значимость заменена профессиями, двумя романами, их антиколониальной направленностью и фактом казни.",
  },
  {
    key: "philippines:miguel_syjuco",
    originalSha256: "62b33a77af339ff0629a79a0829a4b6800c1a23bd711db320064dc535c532d32",
    reviewedTextRu: "Мигель Сихуко (род. 1976) - филиппинский писатель и журналист. Его дебютный роман «Ilustrado» получил Man Asian Literary Prize и главный приз литературной премии Паланка.",
    evidence: [
      e("New York University Abu Dhabi", "https://nyuad.nyu.edu/en/academics/divisions/arts-and-humanities/faculty/miguel-syjuco.html", "Университетский профиль подтверждает происхождение, писательскую и журналистскую деятельность, роман и обе премии."),
      e("Harvard Radcliffe Institute", "https://www.radcliffe.harvard.edu/people/miguel-syjuco", "Гарвардский институт независимо подтверждает авторскую идентичность, Ilustrado, Man Asian Literary Prize и Palanca Grand Prize."),
    ],
    decision: "corrected",
    notes: "Родовое международное признание заменено профессиями, дебютным романом и двумя конкретными премиями.",
  },
  {
    key: "philippines:nick_joaquin",
    originalSha256: "143551ad54482c1270f03fbeb7a30bf4dba985f9fe635a1f6d8b77134bafd1a9",
    reviewedTextRu: "Никомедес Маркес Хоакин (1917-2004) - филиппинский писатель, драматург и эссеист, удостоенный звания Национального художника Филиппин в 1976 году. Среди его произведений - «The Woman Who Had Two Navels» и «A Portrait of the Artist as Filipino».",
    evidence: [
      e("Lawphil", "https://lawphil.net/executive/proc/proc1976/proc_1539_1976.html", "Официальная президентская прокламация подтверждает полное имя, жанры и звание Национального художника 1976 года."),
      e("Cultural Center of the Philippines", "https://culturalcenter.gov.ph/listicle/find-your-next-favorite-literary-masterpiece/", "Государственный культурный центр независимо подтверждает авторскую идентичность, звание и названные произведения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено полным именем, жанрами, официальным званием и двумя произведениями.",
  },
  {
    key: "poland:adam_mickiewicz",
    originalSha256: "8cc064252d6353ae67918b91b1c76f03f82558f61095dc02672b731a9ca16017",
    reviewedTextRu: "Адам Мицкевич (1798-1855) - польский поэт и драматург эпохи романтизма. Он написал поэму «Пан Тадеуш» и драматический цикл «Дзяды».",
    evidence: [
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/adam-mickiewicz", "Национальный институт культуры подтверждает годы, романтический контекст, жанры и произведения Мицкевича."),
      e("Muzeum Literatury im. Adama Mickiewicza", "https://muzeumliteratury.pl/adam-mickiewicz-1798-1855/", "Государственный литературный музей независимо подтверждает биографию, Дзяды и Пан Тадеуш."),
    ],
    decision: "corrected",
    notes: "Однострочное субъективное ранжирование заменено годами, литературной эпохой, жанрами и двумя произведениями.",
  },
  {
    key: "poland:boleslaw_prus",
    originalSha256: "02d797dd7edbab49a42f04dba80aaab708532ec5f5eb8e1af1426e9d9c300883",
    reviewedTextRu: "Болеслав Прус - литературный псевдоним Александра Гловацкого (1847-1912), польского прозаика и журналиста, связанного с движением позитивизма. Среди его романов - «Кукла» и «Фараон».",
    evidence: [
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/boleslaw-prus-aleksander-glowacki", "Национальный институт культуры подтверждает настоящее имя, годы, журналистику, позитивизм и романы Пруса."),
      e("Muzeum Literatury im. Adama Mickiewicza", "https://archiwum.muzeumliteratury.pl/warszawa-lalki-boleslawa-prusa/", "Государственный литературный музей независимо подтверждает биографию и роман Кукла."),
    ],
    decision: "corrected",
    notes: "Краткий ярлык реализма заменён настоящим именем, годами, профессиями, литературным движением и двумя романами.",
  },
  {
    key: "poland:czeslaw_milosz",
    originalSha256: "a5c3a936903126f37ac9e8b3575fcbb9e690cbb62124eab3da669c9a2a700a26",
    reviewedTextRu: "Чеслав Милош (1911-2004) - польский поэт, эссеист и переводчик, автор книги «Порабощённый разум» и поэтических сборников. Он получил Нобелевскую премию по литературе 1980 года.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1980/milosz/facts/", "Официальный Нобелевский архив подтверждает годы, поэтическую деятельность и премию 1980 года."),
      e("Academy of American Poets", "https://poets.org/poet/czeslaw-milosz", "Литературная организация независимо подтверждает поэзию, прозу, переводческую деятельность и библиографию Милоша."),
    ],
    decision: "corrected",
    notes: "Премиальная формула дополнена годами, эссеистикой, переводческой деятельностью и конкретной книгой.",
  },
  {
    key: "poland:henryk_sienkiewicz",
    originalSha256: "c5966ab40f082e9ad7b04f5ddaa93a102744987d5a1ed5310617ead7298b3a57",
    reviewedTextRu: "Генрик Сенкевич (1846-1916) - польский прозаик, автор исторических романов «Камо грядеши» и трилогии о Речи Посполитой XVII века. Он получил Нобелевскую премию по литературе 1905 года.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1905/sienkiewicz/facts/", "Официальный Нобелевский архив подтверждает годы, писательскую деятельность и премию 1905 года."),
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/henryk-sienkiewicz", "Национальный институт культуры независимо подтверждает биографию, исторические романы и библиографию Сенкевича."),
    ],
    decision: "corrected",
    notes: "Краткая премиальная формула дополнена годами, жанром и конкретными историческими романами.",
  },
  {
    key: "poland:jan_kochanowski",
    originalSha256: "80d6d5cea4c66b4e07a14c607f1465cf50f00d82449677717409ccaa87c962f3",
    reviewedTextRu: "Ян Кохановский (1530-1584) - польский поэт эпохи Возрождения, сыгравший важную роль в становлении польского литературного языка. Он написал циклы «Фрашки» и «Трены».",
    evidence: [
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/jan-kochanowski", "Национальный институт культуры подтверждает годы, эпоху, языковое значение и произведения Кохановского."),
      e("Muzeum Jana Kochanowskiego", "https://muzeumkochanowski.pl/", "Государственный музей независимо документирует биографию, творчество и наследие поэта."),
    ],
    decision: "corrected",
    notes: "Оценочные «великий» и «основатель» заменены годами, эпохой, ролью в развитии языка и двумя циклами.",
  },
  {
    key: "poland:joseph_conrad",
    originalSha256: "334203c3b313ff0809efcf35c20d117aee691b983b4e267baecea05418ad0e0e",
    reviewedTextRu: "Джозеф Конрад (1857-1924) - польско-британский писатель, писавший по-английски после многолетней службы в торговом флоте. Он написал «Сердце тьмы», «Лорда Джима» и «Ностромо».",
    evidence: [
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/joseph-conrad-jozef-teodor-konrad-korzeniowski", "Национальный институт культуры подтверждает годы, польско-британскую биографию, морскую службу, язык и произведения Конрада."),
      e("British Museum", "https://www.britishmuseum.org/collection/term/BIOG23446", "Британский музей независимо подтверждает происхождение, годы и библиографию писателя."),
    ],
    decision: "corrected",
    notes: "Интерпретативная формула и центральность одного романа заменены годами, документированным морским опытом и тремя книгами.",
  },
  {
    key: "poland:juliusz_slowacki",
    originalSha256: "1ed6ebe6aa5119b808523e3f3285e2162059725af0c78b88056e5bd20f6bb6b1",
    reviewedTextRu: "Юлиуш Словацкий (1809-1849) - польский поэт и драматург эпохи романтизма, которого относят к трём национальным поэтам-вещунам. Он написал драмы «Кордиан» и «Балладина».",
    evidence: [
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/juliusz-slowacki", "Национальный институт культуры подтверждает годы, романтический контекст, жанры и произведения Словацкого."),
      e("Muzeum Literatury im. Adama Mickiewicza", "https://slowackiwlibanie.muzeumliteratury.pl/en/", "Государственный литературный музей независимо подтверждает годы, статус одного из трёх поэтов-вещунов и биографию."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, эпохой, жанрами, историко-культурным статусом и двумя драмами.",
  },
  {
    key: "poland:olga_tokarczuk",
    originalSha256: "2c4ce22343d30c656d12035038c8bdc6c782f0b469249867e894246b6676299f",
    reviewedTextRu: "Ольга Токарчук (род. 1962) - польская писательница и эссеистка, получившая Нобелевскую премию по литературе за 2018 год. Её роман «Бегуны» получил Международную Букеровскую премию 2018 года.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/2018/tokarczuk/biographical/", "Официальная Нобелевская биография подтверждает год рождения, литературные роли и премию за 2018 год."),
      e("The Booker Prizes", "https://thebookerprizes.com/the-booker-library/authors/olga-tokarczuk", "Официальный архив Букеровской премии независимо подтверждает автора и победу романа Flights в 2018 году."),
    ],
    decision: "corrected",
    notes: "Метафорическое описание заменено годом рождения, явным названием Нобелевской премии и точной Международной Букеровской премией.",
  },
  {
    key: "poland:stanislaw_lem",
    originalSha256: "2c54a798e4956ab2e8f0dbb6585c56b034717bd3ca6ce61918301aee48103e98",
    reviewedTextRu: "Станислав Лем (1921-2006) - польский писатель-фантаст и эссеист, исследовавший в прозе границы научного знания, технологии и возможность контакта с иным разумом. Он написал роман «Солярис» и цикл «Кибериада».",
    evidence: [
      e("Stanisław Lem official site", "https://english.lem.pl/home/biography/abouthimself", "Официальный авторский ресурс подтверждает годы, биографию, литературные роли и произведения Лема."),
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/stanislaw-lem", "Национальный институт культуры независимо подтверждает библиографию и научно-философские темы прозы Лема."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, жанрами, тематикой и двумя конкретными произведениями.",
  },
  {
    key: "poland:wislawa_szymborska",
    originalSha256: "1edd12d14bf4e4238ee947e0a1b357c3f63ef3e13ea5f11a23745f7d041e2beb",
    reviewedTextRu: "Вислава Шимборская (1923-2012) - польская поэтесса и эссеистка, получившая Нобелевскую премию по литературе 1996 года. Она выпустила тринадцать поэтических сборников, а её стихи переведены более чем на сорок языков.",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1996/szymborska/facts/", "Официальный Нобелевский архив подтверждает годы, поэтическую деятельность и премию 1996 года."),
      e("Wisława Szymborska Foundation", "https://www.szymborska.org.pl/en/wislawa/chronology/", "Официальный фонд независимо подтверждает эссеистику, тринадцать сборников и переводы более чем на сорок языков."),
    ],
    decision: "corrected",
    notes: "Краткая премиальная формула дополнена годами, эссеистикой, числом сборников и распространением переводов.",
  },
  {
    key: "poland:wladyslaw_reymont",
    originalSha256: "2dbe32ccc370860b75b6d3f1783471a23feacb322f00b186667504934e4f58a3",
    reviewedTextRu: "Владислав Реймонт (1867-1925) - польский прозаик, автор романов «Мужики» и «Земля обетованная». Нобелевская премия по литературе 1924 года была присуждена ему прежде всего за эпопею «Мужики».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1924/reymont/facts/", "Официальный Нобелевский архив подтверждает годы, премию 1924 года и её связь с романом Chłopi."),
      e("Adam Mickiewicz Institute", "https://culture.pl/en/artist/wladyslaw-stanislaw-reymont", "Национальный институт культуры независимо подтверждает биографию и романы Реймонта."),
    ],
    decision: "corrected",
    notes: "Орнаментальное описание упрощено до годов, двух романов и точного основания Нобелевской премии.",
  },
] satisfies readonly ReviewSeed[];

export const writerBiographyFactReviewBatch44: readonly WriterBiographyFactReviewRecord[] =
  seeds.map((seed) => ({
    key: seed.key,
    originalSha256: seed.originalSha256,
    reviewedTextRu: seed.reviewedTextRu,
    applicableTextRu: seed.reviewedTextRu,
    claims: [
      {
        textRu: seed.reviewedTextRu,
        verdict: "corrected",
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
  }));
