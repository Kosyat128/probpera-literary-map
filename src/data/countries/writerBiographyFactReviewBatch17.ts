export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH17_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 17";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH17_REVIEWER;
const checkedAt = "2026-08-09";

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

const writerBiographyFactReviewBatch17Base = [
  {
    key: "chile:lina_meruane",
    originalSha256: "c84ac17770fe452f42070f6d78c5b65f6bfc489218bfbc92f55ba9443a20452f",
    reviewedTextRu: "Лина Меруане — чилийская писательница и эссеистка, преподаватель Нью-Йоркского университета. Её роман «Sangre en el ojo» получил премию Сор Хуаны Инес де ла Крус в 2012 году.",
    claims: [{
      textRu: "Лина Меруане — чилийская писательница, эссеистка и преподаватель Нью-Йоркского университета; роман Sangre en el ojo принёс ей премию Сор Хуаны Инес де ла Крус в 2012 году.",
      verdict: "corrected",
      evidence: [
        { provider: "New York University — Creative Writing in Spanish", url: "https://wp.nyu.edu/cwskjcc/autores/lina-meruane/", checkedAt, findingRu: "Университетская биография подтверждает чилийскую идентичность Меруане, её писательскую и преподавательскую работу, роман Sangre en el ojo и премию 2012 года." },
        { provider: "Deep Vellum Publishing", url: "https://www.deepvellum.org/authors/lina-meruane", checkedAt, findingRu: "Издательская справка независимо подтверждает роли романиста и эссеиста, преподавание в NYU и присуждение премии Сор Хуаны за Sangre en el ojo." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный ранг заменён документированными ролями, романом и премией. Date recommendation: авторитетные институциональные и издательские источники подтверждают только 1970 год; ни shared birthDate 1970-05-25, ни конкурирующая дата 1970-09-20 не установлены. Рекомендуется хранить только 1970 до появления надёжного источника точного дня. Shared country files не изменялись.",
  },
  {
    key: "chile:luis_sepúlveda",
    originalSha256: "0d078be7199328168cea7d88554446c0e8fca8ee9e74190ef6b16e4a5f4a0035",
    reviewedTextRu: "Луис Сепульведа — чилийский писатель и журналист, сотрудничавший с Greenpeace. Среди его книг — «Старик, который читал любовные романы» и «История о чайке и коте, который научил её летать».",
    claims: [{
      textRu: "Луис Сепульведа был чилийским писателем и журналистом, сотрудничал с Greenpeace и написал Un viejo que leía novelas de amor и Historia de una gaviota y del gato que le enseñó a volar.",
      verdict: "corrected",
      evidence: [
        { provider: "Instituto Cervantes", url: "https://cultura.cervantes.es/atenas/es/homenaje-a-luis-sep%C3%BAlveda/161339", checkedAt, findingRu: "Институт Сервантеса подтверждает место рождения Сепульведы, писательскую и журналистскую деятельность и сотрудничество с Greenpeace." },
        { provider: "Tusquets Editores / Planeta", url: "https://www.planetadelibros.com/autor/luis-sepulveda/000002861", checkedAt, findingRu: "Издательская страница подтверждает чилийскую идентичность автора и атрибутирует ему два названных произведения." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Широкая интерпретация идей заменена проверяемыми профессиями, экологической работой и двумя книгами. Shared country files не изменялись.",
  },
  {
    key: "chile:marcela_serrano",
    originalSha256: "6bd9aac6956aed26546d477ab9a2e3e344b72f06108c3a6bf76312d7b4395214",
    reviewedTextRu: "Марцела Серрано — чилийская писательница. В её прозе важное место занимает женский опыт; среди её романов — «Nosotras que nos queremos tanto» и «El albergue de las mujeres tristes».",
    claims: [{
      textRu: "Марцела Серрано — чилийская писательница, обращающаяся к женскому опыту в романах Nosotras que nos queremos tanto и El albergue de las mujeres tristes.",
      verdict: "corrected",
      evidence: [
        { provider: "Centro Virtual Cervantes", url: "https://cvc.cervantes.es/ensenanza/biblioteca_ele/publicaciones_centros/PDF/brasilia_2012/22_blanco.pdf", checkedAt, findingRu: "Материал Института Сервантеса рассматривает Nosotras que nos queremos tanto как роман Марселы Серрано о жизненном опыте четырёх чилийских женщин." },
        { provider: "Penguin Random House Grupo Editorial", url: "https://www.penguinlibros.com/mx/literatura-contemporanea/314031-libro-el-albergue-de-las-mujeres-tristes-9786073822701", checkedAt, findingRu: "Издательская справка подтверждает чилийскую идентичность Серрано и атрибутирует ей оба названных романа и их женскую проблематику." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Недоказательный ранг среди современных авторов и слишком широкий перечень тем заменены подтверждённой литературной ролью, направленностью и двумя романами. Shared country files не изменялись.",
  },
  {
    key: "chile:marta_brunet",
    originalSha256: "a665f65a477c09d558463fab7bba7a3b4dc2c06b02a22c87869f72f26b8998bd",
    reviewedTextRu: "Марта Брунет — чилийская писательница, чья проза обращена к жизни сельских сообществ юга Чили. Её первый роман «Montaña adentro» вышел в 1923 году; позднее она работала на дипломатической службе Чили.",
    claims: [{
      textRu: "Марта Брунет была чилийской писательницей, изображала сельский юг страны, издала Montaña adentro в 1923 году и позднее работала на дипломатической службе.",
      verdict: "corrected",
      evidence: [
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3600.html", checkedAt, findingRu: "Национальная библиотека подтверждает биографию Брунет, связь прозы с сельским югом Чили и место Montaña adentro в её раннем творчестве." },
        { provider: "Universidad de Chile", url: "https://uchile.cl/extension-y-cultura/vicerrectoria-de-extension-y-comunicaciones/martabrunet/biografia", checkedAt, findingRu: "Университетская биография независимо фиксирует выход Montaña adentro в 1923 году и последующую дипломатическую службу писательницы." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективное описание художественного мира снято; формулировка государственной работы уточнена до дипломатической службы. Shared country files не изменялись.",
  },
  {
    key: "chile:nicanor_parra",
    originalSha256: "62f3f2f5ed536a7008035a010de1fec578a36d51d6d55cd637a72ff40ad92be4",
    reviewedTextRu: "Никанор Парра — чилийский поэт, получивший образование в области математики и физики и связанный с формированием антипоэзии. В 2011 году ему присудили премию Сервантеса.",
    claims: [{
      textRu: "Никанор Парра был чилийским поэтом с образованием в области математики и физики, сформировал собственную антипоэзию и получил премию Сервантеса за 2011 год.",
      verdict: "corrected",
      evidence: [
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3629.html", checkedAt, findingRu: "Национальная библиотека подтверждает обучение Парры математике и физике, его поэтическую работу и развитие антипоэзии." },
        { provider: "Ministerio de Cultura de España", url: "https://www.cultura.gob.es/en/actualidad/2012/04/20120423-cult-principe-asturias-premio-nicanor-parra.html", checkedAt, findingRu: "Министерство подтверждает чилийскую идентичность поэта, физико-математическое образование, создание антипоэзии и присуждение премии Сервантеса 2011 года." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив о влиянии снят; сохранены образование и документированная связь с антипоэзией, добавлена официальная премия. Shared country files не изменялись.",
  },
  {
    key: "chile:pablo_neruda",
    originalSha256: "e953b239adb343c93e73f3d733223aa28ea829a65d27df8a3b545b0c331ebd39",
    reviewedTextRu: "Пабло Неруда — чилийский поэт и дипломат. В 1971 году он получил Нобелевскую премию по литературе.",
    claims: [{
      textRu: "Пабло Неруда был чилийским поэтом и дипломатом и получил Нобелевскую премию по литературе в 1971 году.",
      verdict: "corrected",
      evidence: [
        { provider: "The Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1971/neruda/facts/", checkedAt, findingRu: "Официальная нобелевская справка подтверждает чилийскую принадлежность Неруды, поэтическую и дипломатическую деятельность и премию 1971 года." },
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3638.html", checkedAt, findingRu: "Национальная библиотека Чили независимо подтверждает литературную и дипломатическую биографию Неруды и получение Нобелевской премии." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективный ранг среди поэтов века снят; полностью сохранены подтверждённые профессии и премия. Shared country files не изменялись.",
  },
  {
    key: "chile:raul_zurita",
    originalSha256: "8b296579a376a71831a7f50289940f6aed4adecfc2f7e0a48ab2ed8edae88b67",
    reviewedTextRu: "Рауль Сурита — чилийский поэт и преподаватель литературы. В 2000 году он получил Национальную премию Чили по литературе; среди его книг — «Purgatorio» и «Anteparaíso».",
    claims: [{
      textRu: "Рауль Сурита — чилийский поэт и преподаватель литературы, автор Purgatorio и Anteparaíso и лауреат Национальной премии Чили по литературе 2000 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad Diego Portales", url: "https://www.udp.cl/academico/raul-zurita-3/", checkedAt, findingRu: "Университетская страница подтверждает поэтическую и преподавательскую деятельность Суриты и его книгу Purgatorio." },
        { provider: "Ministerio de las Culturas, las Artes y el Patrimonio de Chile", url: "https://www.cultura.gob.cl/wp-content/uploads/2025/01/juego-de-cartas.pdf", checkedAt, findingRu: "Официальное издание министерства подтверждает Национальную премию 2000 года и называет Anteparaíso среди произведений Суриты." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный статус и общая интерпретация тем заменены профессиями, двумя книгами и государственной премией. Shared country files не изменялись.",
  },
  {
    key: "chile:roberto_bolano",
    originalSha256: "02cc1e3b386b130dcc4857c98e646cb1a673e9668c08598e30ba40b7d4a405ed",
    reviewedTextRu: "Роберто Боланьо — чилийский писатель и поэт. Среди его произведений — романы «Дикие детективы» и «2666» и поэтический сборник «Los perros románticos».",
    claims: [{
      textRu: "Роберто Боланьо был чилийским писателем и поэтом, автором романов Los detectives salvajes и 2666 и сборника Los perros románticos.",
      verdict: "corrected",
      evidence: [
        { provider: "Editorial Anagrama", url: "https://www.anagrama-ed.es/autor/bolano-roberto-134", checkedAt, findingRu: "Издательская авторская страница подтверждает чилийскую идентичность Боланьо и атрибутирует ему Los detectives salvajes, 2666 и Los perros románticos." },
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/people/roberto-bolano", checkedAt, findingRu: "Литературная институция независимо подтверждает работу Боланьо в прозе и поэзии и перечисляет названные произведения." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективные формулы о влиянии и символическом статусе заменены литературными ролями и тремя произведениями. Shared country files не изменялись.",
  },
  {
    key: "chile:vicente_huidobro",
    originalSha256: "408a8b6431b1e8cfe5f95539bd42a68b8ff982ae321fe005d30acf201ae1b93f",
    reviewedTextRu: "Висенте Уидобро — чилийский поэт-авангардист, создатель литературного направления креасьонизма. Среди его произведений — поэма «Альтазор».",
    claims: [{
      textRu: "Висенте Уидобро был чилийским поэтом-авангардистом, создал креасьонизм и написал поэму Altazor.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/vicente-huidobro", checkedAt, findingRu: "Литературная институция подтверждает чилийскую идентичность Уидобро, его авангардную поэтику, креасьонизм и Altazor." },
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-propertyvalue-3027.html", checkedAt, findingRu: "Национальная библиотека независимо связывает Уидобро с основанием креасьонизма и атрибутирует ему Altazor." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив о месте в авангарде и теоретическая перифраза сняты; сохранены направление и конкретное произведение. Shared country files не изменялись.",
  },
  {
    key: "china:ai_qing",
    originalSha256: "0b9ec3788d868efd7292003678678a578517361ac1a4a6b56f4dd400207fd231",
    reviewedTextRu: "Ай Цин (1910–1996) — китайский поэт, работавший в форме свободного стиха. Среди его книг — сборники «К солнцу» и «Факел».",
    claims: [{
      textRu: "Ай Цин жил в 1910–1996 годах, был китайским поэтом свободного стиха и издал сборники 向太阳 и 火把.",
      verdict: "corrected",
      evidence: [
        { provider: "China Writers Association", url: "https://www.chinawriter.com.cn/fwzj/wxds/8.shtml", checkedAt, findingRu: "Справка Союза китайских писателей подтверждает даты, поэтическую деятельность и атрибутирует Ай Цину сборники 向太阳 и 火把." },
        { provider: "Penguin Random House", url: "https://www.penguinrandomhouse.com/authors/2260921/ai-qing/", checkedAt, findingRu: "Издательская биография независимо подтверждает даты жизни, китайскую поэтическую идентичность и работу со свободным стихом." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Недоказательный ранг заменён датами, формой стиха и двумя сборниками. Shared country files не изменялись.",
  },
  {
    key: "china:ba_jin",
    originalSha256: "fdabffc45fe24ede9d8237ae5e7cdff1fd00ea78fb482526935b6d10f2cdd698",
    reviewedTextRu: "Ба Цзинь (1904–2005) — китайский писатель; его настоящее имя — Ли Яотан. Романы «Семья», «Весна» и «Осень» составляют трилогию «Бурный поток».",
    claims: [{
      textRu: "Ба Цзинь — китайский писатель Ли Яотан, живший в 1904–2005 годах; его романы 家, 春 и 秋 образуют трилогию 激流三部曲.",
      verdict: "corrected",
      evidence: [
        { provider: "China Writers Association", url: "https://www.chinawriter.com.cn/fwzj/wxds/5.shtml", checkedAt, findingRu: "Союз китайских писателей подтверждает настоящее имя Ба Цзиня, его авторскую биографию и романы 家 и 春." },
        { provider: "Academy of Chinese Studies", url: "https://chiculture.org.hk/en/node/1704", checkedAt, findingRu: "Образовательная академическая организация подтверждает, что 家, 春 и 秋 образуют трилогию 激流三部曲 Ба Цзиня." },
        { provider: "Guangdong Songshan Polytechnic College Library", url: "https://tsg.gdsspt.edu.cn/info/1036/2053.htm", checkedAt, findingRu: "Библиотечная справка независимо фиксирует настоящее имя Ли Яотан, даты 1904–2005 и состав трилогии из трёх названных романов." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив о статусе заменён настоящим именем и составом трилогии. Shared country files не изменялись.",
  },
  {
    key: "china:bai_juyi",
    originalSha256: "838ebd4429c2ab631d1a56d5a69f9ecebb6dd865c06551f6913e0eda524e65fe",
    reviewedTextRu: "Бо Цзюйи (772–846) — китайский поэт эпохи Тан и государственный служащий. Среди его произведений — «Песнь о вечной печали».",
    claims: [{
      textRu: "Бо Цзюйи жил в 772–846 годах, был поэтом эпохи Тан и государственным служащим и написал 長恨歌.",
      verdict: "corrected",
      evidence: [
        { provider: "China Biographical Database — Harvard University", url: "https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=32227", checkedAt, findingRu: "Университетская биографическая база подтверждает личность, даты жизни и служебную карьеру Бо Цзюйи." },
        { provider: "The Metropolitan Museum of Art", url: "https://resources.metmuseum.org/resources/metpublications/pdf/The_Tale_of_Genji_A_Japanese_Classic_Illuminated.pdf", checkedAt, findingRu: "Музейное научное издание характеризует Бо Цзюйи как танского поэта и атрибутирует ему поэму 長恨歌, известную как «Песнь о вечной печали»." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив и широкая стилистическая характеристика заменены датами, эпохой, службой и конкретной поэмой. Shared country files не изменялись.",
  },
  {
    key: "china:bei_dao",
    originalSha256: "84cb4fcd0fcc57f9d67ede1524bb19ffb1e4aac7c832010d3d28122895afe990",
    reviewedTextRu: "Бэй Дао — литературный псевдоним китайского поэта Чжао Чжэнькая, связанного с направлением «туманной поэзии». В 1978 году он участвовал в создании журнала «Сегодня» (Jintian).",
    claims: [{
      textRu: "Бэй Дао — псевдоним китайского поэта Чжао Чжэнькая, участника туманной поэзии и одного из создателей журнала Jintian в 1978 году.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/bio/bei-dao/", checkedAt, findingRu: "Литературная институция подтверждает настоящее имя, псевдоним, связь с туманной поэзией и участие Бэй Дао в создании Jintian." },
        { provider: "Chinese University of Hong Kong Library — Archival Collections", url: "https://archives.lib.cuhk.edu.hk/agents/people/415", checkedAt, findingRu: "Университетский архив независимо фиксирует личность Бэй Дао, имя Чжао Чжэнькай и создание журнала Jintian в 1978 году." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Ранг внутри направления снят; добавлены настоящее имя, статус псевдонима и документированный журнал. Shared country files не изменялись.",
  },
  {
    key: "china:can_xue",
    originalSha256: "85eda123017ce11c126d0585375d3f1e51af1cdb125743b713e21e65f74e5d41",
    reviewedTextRu: "Цань Сюэ — псевдоним китайской писательницы Дэн Сяохуа, автора экспериментальной прозы. Среди её книг — «Улица пяти специй» и «Любовь в новом тысячелетии».",
    claims: [{
      textRu: "Цань Сюэ — псевдоним китайской писательницы Дэн Сяохуа, работающей с экспериментальной прозой и написавшей Five Spice Street и Love in the New Millennium.",
      verdict: "corrected",
      evidence: [
        { provider: "The Booker Prizes", url: "https://thebookerprizes.com/the-booker-library/authors/can-xue", checkedAt, findingRu: "Официальная страница премии подтверждает настоящее имя, псевдоним, китайскую писательскую идентичность и атрибутирует Цань Сюэ Love in the New Millennium." },
        { provider: "Yale University Press", url: "https://drupal.yalebooks.yale.edu/sites/default/files/spring_2020_catalogue_web_final.pdf", checkedAt, findingRu: "Университетский издатель характеризует прозу Цань Сюэ как экспериментальную и подтверждает книги Five Spice Street и Love in the New Millennium." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный ранг среди авангардистов заменён настоящим именем, статусом псевдонима и двумя книгами. Shared country files не изменялись.",
  },
  {
    key: "china:cao_xueqin",
    originalSha256: "2287492a0018962c953e89eed42d506058d10b92cc143b5c2b648749fb963d0f",
    reviewedTextRu: "Цао Сюэцинь (ок. 1715 — ок. 1763) — китайский писатель эпохи Цин. Он является автором романа «Сон в красном тереме», также известного как «История камня».",
    claims: [{
      textRu: "Цао Сюэцинь, живший приблизительно в 1715–1763 годах при династии Цин, написал роман 紅樓夢, известный как Dream of the Red Chamber и The Story of the Stone.",
      verdict: "corrected",
      evidence: [
        { provider: "Library of Congress", url: "https://www.loc.gov/resource/gdcwdl.wdl_13547/?sp=5&st=list", checkedAt, findingRu: "Библиотека Конгресса атрибутирует Цао Сюэциню роман 紅樓夢 и приводит ориентировочные даты жизни около 1715–1763 годов." },
        { provider: "Fairbank Center for Chinese Studies — Harvard University", url: "https://fairbank.fas.harvard.edu/events/wei-shang-the-story-of-the-stone-and-the-visual-culture-of-the-manchu-court/", checkedAt, findingRu: "Гарвардский центр независимо называет Цао Сюэциня автором The Story of the Stone / Dream of the Red Chamber и использует приблизительные даты 1715–1763." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив и внешняя формула канона сняты; авторство и варианты названия подтверждены. Date recommendation: вместо shared years 1715/1724–1763 и birthDate «1715 или 1724» институциональные источники поддерживают осторожную форму «ок. 1715 — ок. 1763»; применять её только после редакционного решения о формате приблизительных дат. Shared country files не изменялись.",
  },
  {
    key: "china:chi_ziqiang",
    originalSha256: "6fdc3cbc1ee173c3299be930b5038ccb0a9171d53f46b1437edc7f607faa9ce9",
    reviewedTextRu: "Чи Цзыцзянь — китайская писательница и выпускница Литературного института имени Лу Синя. Её роман «Правый берег Аргуни» получил премию Мао Дуня.",
    claims: [{
      textRu: "Чи Цзыцзянь — китайская писательница и выпускница Литературного института имени Лу Синя; её роман 额尔古纳河右岸 получил премию Мао Дуня.",
      verdict: "corrected",
      evidence: [
        { provider: "China Writers Association", url: "https://tag.chinawriter.com.cn/member/chizijian.html", checkedAt, findingRu: "Справка Союза китайских писателей подтверждает женскую авторскую идентичность Чи Цзыцзянь, роман 额尔古纳河右岸 и присуждение ему премии Мао Дуня." },
        { provider: "University of Iowa — International Writing Program", url: "https://iwp.uiowa.edu/writers/2005-resident/chi-zijian-chizijian", checkedAt, findingRu: "Университетская биография независимо подтверждает написание имени Chi Zijian, китайскую писательскую идентичность и обучение в Lu Xun Academy." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Identity/date recommendation: shared карточка ошибочно задаёт мужскую формулу и 1948 год. Авторитетные источники устанавливают писательницу Chi Zijian / Чи Цзыцзянь, родившуюся в 1964 году. Рекомендуется обновить years и birthDate до 1964 и мигрировать key chi_ziqiang в chi_zijian с сохранением алиаса и связей. Shared country files не изменялись.",
  },
  {
    key: "china:chiang_sheng_tao",
    originalSha256: "841dc80123fac7898f88e95cd6bc017d11518320a0f3fef2ee45be4f33c32d7b",
    reviewedTextRu: "Чжоу Цзожэнь (1885–1967) — китайский писатель, эссеист и переводчик. Его работа связана с развитием современной китайской эссеистики и переводом зарубежной литературы.",
    claims: [{
      textRu: "Чжоу Цзожэнь жил в 1885–1967 годах, был китайским писателем, эссеистом и переводчиком и участвовал в развитии современной китайской эссеистики.",
      verdict: "corrected",
      evidence: [
        { provider: "Chinese University of Hong Kong Press", url: "https://cup.cuhk.edu.hk/index.php?product_id=670&route=product%2Fproduct", checkedAt, findingRu: "Университетское издательство подтверждает даты жизни Чжоу Цзожэня и его роль автора современной китайской эссеистики." },
        { provider: "China Writers Association", url: "https://www.chinawriter.com.cn/n1/2018/0125/c404064-29787401.html", checkedAt, findingRu: "Материал Союза китайских писателей независимо подтверждает работу Чжоу Цзожэня в эссеистике, литературном письме и переводе." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный ранг снят; роли и значение для эссеистики сформулированы нейтрально. Identity recommendation: display name и даты соответствуют Zhou Zuoren, но key chiang_sheng_tao семантически не совпадает с личностью. Рекомендуется миграция в key zhou_zuoren с сохранением алиаса и связей. Shared country files не изменялись.",
  },
  {
    key: "china:confucius",
    originalSha256: "1c53cd14098d546c6ffbf258edce7ca917c937cf01b432b16a16a3778a2092db",
    reviewedTextRu: "Конфуций (551–479 до н. э.) — древнекитайский мыслитель и учитель. «Лунь юй» («Беседы и суждения») содержит высказывания, приписываемые ему, и рассказы о его учениках.",
    claims: [{
      textRu: "Конфуций жил в 551–479 годах до н. э. и был древнекитайским мыслителем и учителем; Лунь юй содержит приписываемые ему высказывания и сведения о его учениках.",
      verdict: "corrected",
      evidence: [
        { provider: "Indiana University ScholarWorks", url: "https://scholarworks.iu.edu/dspace/bitstreams/d1f62d31-9082-41d0-999f-4c3efa0c8857/download", checkedAt, findingRu: "Университетское научное введение подтверждает традиционные даты Конфуция и описывает Лунь юй как собрание высказываний, диалогов и рассказов о нём и учениках." },
        { provider: "Princeton University", url: "https://mkern.scholar.princeton.edu/document/147", checkedAt, findingRu: "Принстонское научное издание независимо фиксирует даты 551–479 до н. э. и роль Лунь юй как руководства к учению Конфуция." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Недоказательная формула масштаба влияния заменена датами, ролью учителя и аккуратной атрибуцией Лунь юй. Датированные audit-конфликты 551/0551 и 479/0479 являются только разницей нулевого дополнения; фактическое изменение shared дат не требуется. Shared country files не изменялись.",
  },
  {
    key: "china:du_fu",
    originalSha256: "b0e7d6375758468eb072b27125ca5b83fce1bd980e1212a03816a96774f4276c",
    reviewedTextRu: "Ду Фу (712–770) — китайский поэт эпохи Тан. В его стихах отразились восстание Ань Лушаня, голод, политические потрясения и личные утраты.",
    claims: [{
      textRu: "Ду Фу жил в 712–770 годах, был поэтом эпохи Тан и писал о восстании Ань Лушаня, голоде, политических потрясениях и личных утратах.",
      verdict: "corrected",
      evidence: [
        { provider: "Poetry Foundation", url: "https://www.poetryfoundation.org/poets/tu-fu", checkedAt, findingRu: "Литературная институция подтверждает даты, танскую поэтическую идентичность и присутствие в стихах Ду Фу восстания, голода, политических событий и личных трагедий." },
        { provider: "Chinese University of Hong Kong — Renditions", url: "https://www.cuhk.edu.hk/renditions/authors/duf.html", checkedAt, findingRu: "Университетская справка независимо фиксирует даты и поэтическую деятельность Ду Фу, а также его испытания во время восстания Ань Лушаня и внимание к страданиям людей." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Суперлативы, парное ранжирование с Ли Бо и широкая оценка гуманизма заменены датами и документированными историческими темами. Audit-различия 712/0712 и 770/0770 являются только нулевым дополнением; фактическое изменение shared дат не требуется. Shared country files не изменялись.",
  },
  {
    key: "china:gao_xingjian",
    originalSha256: "119c2f797e13bce9f0e19cf3e75fbf7855737ad5f483cf1197503f256cd86ad9",
    reviewedTextRu: "Китайский писатель, драматург и художник, лауреат Нобелевской премии по литературе 2000 года.",
    claims: [{
      textRu: "Гао Синцзянь — писатель китайского происхождения, драматург и художник, получивший Нобелевскую премию по литературе в 2000 году.",
      verdict: "supported",
      evidence: [
        { provider: "The Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/2000/gao/facts/", checkedAt, findingRu: "Официальная нобелевская справка подтверждает китайское происхождение, деятельность писателя, драматурга и художника и премию 2000 года." },
        { provider: "Chinese University Press", url: "https://cup.cuhk.edu.hk/image/data/preview/9789629966508_intro.pdf", checkedAt, findingRu: "Университетское издательское введение независимо подтверждает литературную, театральную и художественную деятельность Гао Синцзяня и Нобелевскую премию." },
      ],
    }],
    reviewer,
    decision: "unchanged",
    notes: "Исходный короткий русский текст нейтрален и полностью подтверждён; формулировка «китайский» сохранена как характеристика происхождения и языка творчества. Shared country files не изменялись.",
  },
] satisfies readonly ReviewBase[];

function finalizeReviewRecord(record: ReviewBase): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch17: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch17Base.map(finalizeReviewRecord);
