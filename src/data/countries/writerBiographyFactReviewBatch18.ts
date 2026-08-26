export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH18_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 18";

export type WriterBiographyFactReviewDecision =
  | "unchanged"
  | "corrected"
  | "held";

export type WriterBiographyClaimVerdict =
  | "supported"
  | "corrected"
  | "not-established";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH18_REVIEWER;
const checkedAt = "2026-08-09";

function evidence(
  provider: string,
  url: string,
  findingRu: string,
): WriterBiographyClaimEvidence {
  return { provider, url, checkedAt, findingRu };
}

const writerBiographyFactReviewBatch18Base: readonly Omit<
  WriterBiographyFactReviewRecord,
  "applicableTextRu"
>[] = [
  {
    key: "china:gong_zi_zhen",
    originalSha256:
      "16c1b80bd6610653915429945499b82eda8acddbf543e200f4d96dfc78291621",
    reviewedTextRu:
      "Китайский поэт эпохи Цин, живший в 1792-1841 годах.",
    claims: [
      {
        textRu:
          "Гун Цзычжэнь был китайским поэтом эпохи Цин и жил в 1792-1841 годах.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Library of Congress",
            "https://www.loc.gov/aba/publications/Archived-LCC01/PL-PM-text.pdf",
            "Классификация китайской литературы Библиотеки Конгресса фиксирует авторитетную форму Gong Zizhen и годы жизни 1792-1841 в корпусе литературы эпохи Цин.",
          ),
          evidence(
            "Harvard University - Stephen Owen",
            "https://scholar.harvard.edu/files/sowen/files/owen_stephen_-_an_anthology_of_chinese_literature_-_beginnings_to_1911.pdf",
            "Университетская антология называет Гун Цзычжэня поэтом и датирует его жизнь 1792-1841 годами.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Широкая оценка роли в интеллектуальных преобразованиях XIX века заменена подтверждаемыми ролью, эпохой и годами жизни. Shared country files не изменялись.",
  },
  {
    key: "china:han_han",
    originalSha256:
      "d0be2c719593fc63a2916d2970e9dbe28b9ff79d363b135c9584f02dc0425bb1",
    reviewedTextRu:
      "Китайский писатель и режиссёр, автор дебютного романа «The Triple Door».",
    claims: [
      {
        textRu:
          "Хань Хань - китайский писатель и режиссёр, дебютировавший романом «The Triple Door».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Simon & Schuster",
            "https://www.simonandschuster.com/authors/Han-Han/85454623",
            "Официальная страница издателя называет Хань Ханя писателем и режиссёром и сообщает, что его дебютным романом был The Triple Door.",
          ),
          evidence(
            "University of Southern California Digital Library",
            "https://digitallibrary.usc.edu/API/Download/v1_0/GetOriginalLimited?Identifier=UC11290375&SourceAction=API_VIEW_DETAILS_TRX&UsePreviewPdf=False",
            "Исследование USC подтверждает авторство романа The Triple Door и его публикацию как раннего произведения Хань Ханя.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Неподтверждённая сравнительная формула «один из самых известных» снята; сохранены роли и конкретное произведение. Shared country files не изменялись.",
  },
  {
    key: "china:jia_pingwa",
    originalSha256:
      "4f6b7c3cd98ec6b63c814c093a6c2ba94247004a1886f668da0a5f0781d25943",
    reviewedTextRu:
      "Китайский писатель, автор романов «Turbulence» и «Ruined City».",
    claims: [
      {
        textRu:
          "Цзя Пинва - китайский писатель, автор романов «Turbulence» и «Ruined City».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Grove Atlantic",
            "https://groveatlantic.com/author/jia-pingwa/",
            "Официальный профиль издателя идентифицирует Цзя Пинва как китайского писателя и связывает его библиографию с романом Turbulence.",
          ),
          evidence(
            "University of Oklahoma - Newman Prize for Chinese Literature",
            "https://www.ou.edu/cis/research/institute-for-us-china-issues/us-china-cultural-issues/newman-prize-for-chinese-literature.html",
            "Архив литературной премии Университета Оклахомы включает Цзя Пинва и роман Ruined City в документированный список автора и произведения.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценка известности и обобщение о «жизни китайской провинции» заменены двумя документированными романами. Shared country files не изменялись.",
  },
  {
    key: "china:lao_she",
    originalSha256:
      "0a92fdaac992a3da7d1cc7d25834406c3879f9d8362f4dcc2f93dcf38ff3c070",
    reviewedTextRu:
      "Китайский писатель и драматург, автор романа «Рикша» и пьесы «Чайная».",
    claims: [
      {
        textRu:
          "Лао Шэ был китайским писателем и драматургом, автором романа «Рикша» и пьесы «Чайная».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Большая российская энциклопедия",
            "https://bigenc.ru/c/lao-she-298f7e",
            "Энциклопедическая статья подтверждает точные даты жизни, литературные роли и авторство произведений «Рикша» и «Чайная».",
          ),
          evidence(
            "Columbia University Press",
            "https://cup.columbia.edu/book/teahouse/9789629961251/",
            "Университетское издательство называет Лао Шэ романистом и драматургом, указывает годы жизни 1899-1966 и атрибутирует ему пьесу Teahouse.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Субъективная характеристика масштаба заменена ролями и двумя произведениями; shared birthDate/deathDate подтверждены БРЭ. Shared country files не изменялись.",
  },
  {
    key: "china:lao_tzu",
    originalSha256:
      "321615e64e1b04c43d894af096913ee826caf3ac87227f0e5966606cfa713f43",
    reviewedTextRu:
      "Древнекитайский философ, которому традиционно приписывают авторство «Дао дэ цзин»; его образ связан с истоками даосской традиции.",
    claims: [
      {
        textRu:
          "Лао-цзы - традиционный древнекитайский философский образ; традиция связывает с ним «Дао дэ цзин» и истоки даосизма.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Stanford Encyclopedia of Philosophy",
            "https://plato.stanford.edu/archives/spr2026/entries/laozi/",
            "Академическая энциклопедия описывает Лао-цзы как древнего философа, которому традиционно приписывается текст, позднее названный Daodejing, и отдельно оговаривает сложность авторства.",
          ),
          evidence(
            "Большая российская энциклопедия",
            "https://bigenc.ru/c/lao-tszy-e153da",
            "БРЭ излагает традиционную биографию Лао-цзы, связь с «Дао дэ цзин» и место этой традиции в становлении даосизма.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity/date queue: атрибуция сохранена как традиционная, а грамматически двусмысленная формула об «основах даосизма» уточнена. Рекомендация - не показывать birthDate и deathDate «VI век до н. э.» как две установленные даты; заменить единым периодом «традиционно VI век до н. э.; историчность и датировка спорны». Shared country files не изменялись.",
  },
  {
    key: "china:li_bai",
    originalSha256:
      "50f43fdf9ab03e1bd0dab58e0a3c500cb274b3e1afbcdff806cb7ba7a1382c59",
    reviewedTextRu:
      "Китайский поэт эпохи Тан, живший в 701-762 годах.",
    claims: [
      {
        textRu:
          "Ли Бо был китайским поэтом эпохи Тан и жил в 701-762 годах.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Poetry Foundation",
            "https://www.poetryfoundation.org/poets/li-po",
            "Профиль поэта фиксирует форму Li Po, годы 701-762 и его принадлежность к поэзии эпохи Тан.",
          ),
          evidence(
            "Library of Congress",
            "https://www.loc.gov/catdir/cpso/CJKChap25-1.pdf",
            "Руководство Библиотеки Конгресса приводит авторитетную запись Li Bai, 701-762, и связывает её с его поэтическими произведениями.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив и неуниверсальное прозвище сняты; сохранены эпоха, роль и даты. Shared country files не изменялись.",
  },
  {
    key: "china:lu_xun",
    originalSha256:
      "8ab333854bdb27422a4c472c6ac95184dfdf8cd2292b60589e6a5b4c3115d6cd",
    reviewedTextRu:
      "Китайский писатель, мыслитель и общественный деятель, один из основателей современной китайской литературы.",
    claims: [
      {
        textRu:
          "Лу Синь был китайским писателем, мыслителем и общественным деятелем и относится к основателям современной китайской литературы.",
        verdict: "supported",
        evidence: [
          evidence(
            "Большая российская энциклопедия",
            "https://bigenc.ru/c/lu-sin-ce6db4",
            "БРЭ подтверждает точные даты, роли писателя, публициста и общественного деятеля и прямо относит Лу Синя к основоположникам современной китайской литературы.",
          ),
          evidence(
            "Columbia University - Asia for Educators",
            "https://afe.easia.columbia.edu/special/china_1900_luxun.htm",
            "Университетская образовательная справка характеризует Лу Синя как центрального современного китайского писателя и подтверждает годы жизни 1881-1936.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Все элементы краткого текста подтверждены независимыми энциклопедическим и университетским источниками; точные даты карточки подтверждены БРЭ. Shared country files не изменялись.",
  },
  {
    key: "china:luo_guanzhong",
    originalSha256:
      "ddbbdc99cde1f157881501584e7317c5b4b60d3d4dae24e09f9c0d84826fa5e3",
    reviewedTextRu:
      "Китайский писатель XIV века, которому традиционно приписывают исторический роман «Троецарствие».",
    claims: [
      {
        textRu:
          "Ло Гуаньчжун - китайский писатель XIV века, которому традиционно приписывают «Троецарствие».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Library of Congress",
            "https://www.loc.gov/catdir/cpso/CJKChap26.pdf",
            "Библиотека Конгресса фиксирует авторитетную форму Luo Guanzhong, приблизительные годы 1330-1400 и связь с San guo zhi yan yi.",
          ),
          evidence(
            "Columbia University - Asia for Educators",
            "https://video.afe.easia.columbia.edu/teaching-guides/romance-of-the-three-kingdoms-teaching-guide/",
            "Учебный материал Колумбийского университета датирует Ло Гуаньчжуна XIV веком и прямо отмечает, что роман ему приписывается.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity/date queue: личность и приблизительные даты ок. 1330 - ок. 1400 подтверждены LOC; категоричное «эпохи Мин» заменено нейтральным «XIV века», атрибуция сохранена как традиционная. Shared country files не изменялись.",
  },
  {
    key: "china:mao_dun",
    originalSha256:
      "1bf9b3181acc1f5be34375e1371ef5d7a1c9f081b8d90e9de9024994919914da",
    reviewedTextRu:
      "Китайский писатель и литературный критик, автор романа «Перед рассветом» («Цзы е»).",
    claims: [
      {
        textRu:
          "Мао Дунь был китайским писателем и литературным критиком, автором романа «Перед рассветом» («Цзы е»).",
        verdict: "corrected",
        evidence: [
          evidence(
            "Большая российская энциклопедия",
            "https://bigenc.ru/c/mao-dun-e9d65c",
            "БРЭ подтверждает точные даты, литературную личность и русское заглавие романа «Перед рассветом» («Цзы е»), а также фиксирует литературно-критические статьи автора.",
          ),
          evidence(
            "Columbia University Press",
            "https://cup.columbia.edu/book/the-shop-of-the-lin-family-and-spring-silkworms/9789629960452/",
            "Университетское издательство независимо идентифицирует Мао Дуня (Шэнь Яньбина), годы жизни 1896-1981 и роли критика и романиста.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Сравнительная оценка места в реализме заменена профессиями и конкретным романом; shared birthDate/deathDate подтверждены. Shared country files не изменялись.",
  },
  {
    key: "china:mo_yan",
    originalSha256:
      "2f947088e0d3134ea95148f53c8811cbbdf3ac3f946962638a2542992b24c390",
    reviewedTextRu:
      "Китайский писатель, лауреат Нобелевской премии по литературе 2012 года, автор романа «Красный гаолян».",
    claims: [
      {
        textRu:
          "Мо Янь - китайский писатель, лауреат Нобелевской премии по литературе 2012 года и автор романа «Красный гаолян».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Nobel Prize",
            "https://www.nobelprize.org/prizes/literature/2012/bio-bibliography/",
            "Официальная биобиблиография Нобелевской премии подтверждает награду 2012 года, литературную личность и роман Red Sorghum.",
          ),
          evidence(
            "Penguin Random House",
            "https://www.penguinrandomhouse.com/books/315347/red-sorghum-by-mo-yan/",
            "Официальная страница издателя атрибутирует Мо Яню роман Red Sorghum и подтверждает его статус китайского автора.",
          ),
        ],
      },
      {
        textRu:
          "Опубликованные авторитетные источники расходятся в точной дате рождения Мо Яня, поэтому shared дату нельзя исправлять автоматически.",
        verdict: "not-established",
        evidence: [
          evidence(
            "Nobel Prize - Facts",
            "https://www.nobelprize.org/laureate/880?from=NobelPress.org",
            "Текущая официальная карточка Nobel Facts указывает 25 марта 1956 года.",
          ),
          evidence(
            "Penguin Random House",
            "https://www.penguinrandomhouse.com/books/315347/red-sorghum-by-mo-yan/",
            "Официальная страница издателя указывает год рождения 1955, не согласующийся с текущей карточкой Nobel Facts.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Обобщённая характеристика поэтики заменена наградой и произведением. Date recommendation: shared birthDate 1955-02-17 не подтверждается согласованно - текущая Nobel Facts и автобиография дают 1956-03-25, тогда как нобелевская биобиблиография и издатель указывают 1955; точную дату не менять автоматически и временно показывать только год после редакционного разрешения конфликта. Shared country files не изменялись.",
  },
  {
    key: "china:pu_songling",
    originalSha256:
      "ad9e11bc72e50f8e6415d523c71b991fdaeb029316337a80acaa2e92c9f93180",
    reviewedTextRu:
      "Китайский писатель эпохи Цин, автор сборника «Странные истории из Кабинета Неудачника» («Ляо Чжай чжи и»).",
    claims: [
      {
        textRu:
          "Пу Сунлин был китайским писателем эпохи Цин и автором сборника «Странные истории из Кабинета Неудачника» («Ляо Чжай чжи и»).",
        verdict: "corrected",
        evidence: [
          evidence(
            "Большая российская энциклопедия",
            "https://old.bigenc.ru/literature/text/3484121",
            "Энциклопедия подтверждает точные даты, роль китайского писателя и авторство сборника «Странные истории из кабинета разговорчивого» («Ляо чжай чжи и»).",
          ),
          evidence(
            "Национальная электронная библиотека России",
            "https://rusneb.ru/catalog/000199_000009_011187821/",
            "Каталог НЭБ атрибутирует Пу Сунлину полное собрание «Ляо Чжай Чжи и. Странные истории из Кабинета Неудачника» в научном издании СПбГУ.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочное «знаменитого» и расплывчатое описание заменены установленным русским заглавием сборника; точные даты карточки подтверждены БРЭ. Shared country files не изменялись.",
  },
  {
    key: "china:shi_naian",
    originalSha256:
      "c5b4ff6277b3f76881e29d6bcfb6b3aecfc278be249dfc2a3069e5730ceb7f43",
    reviewedTextRu:
      "Китайский писатель XIV века, которому традиционно приписывают роман «Речные заводи».",
    claims: [
      {
        textRu:
          "Ши Найань - традиционное имя автора XIV века, которому приписывают роман «Речные заводи».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Library of Congress",
            "https://blogs.loc.gov/international-collections/2017/07/the-story-of-water-margin-%E6%B0%B4%E6%BB%B8%E5%82%B3/",
            "Специалист Азиатского отдела LOC сообщает, что Water Margin традиционно приписывают Ши Найаню (1290-1365) и Ло Гуаньчжуну.",
          ),
          evidence(
            "Indiana University ScholarWorks",
            "https://scholarworks.iu.edu/iuswrrest/api/core/bitstreams/26a1a210-0ac4-4c83-9c3b-705fec901748/content",
            "Университетский учебный материал отмечает неясность авторства и наиболее распространённую среди исследователей атрибуцию романа Ши Найаню.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity/date queue: историчность биографии ограниченно документирована; birthDate/deathDate «XIV век» допустимы только как приблизительный период, не как две точные даты. Формула «эпохи Мин» заменена веком, атрибуция оставлена традиционной. Shared country files не изменялись.",
  },
  {
    key: "china:sima_qian",
    originalSha256:
      "68859c46487ac0e573e61ef9079e1730db4fa1b740a3361231e1df7202576b76",
    reviewedTextRu:
      "Китайский историк эпохи Хань, автор «Исторических записок» («Ши цзи»).",
    claims: [
      {
        textRu:
          "Сыма Цянь был историком эпохи Хань и автором «Исторических записок» («Ши цзи»).",
        verdict: "corrected",
        evidence: [
          evidence(
            "Smithsonian Libraries and Archives",
            "https://www.si.edu/object/records-grand-historian-han-dynasty-sima-qian-translated-burton-watson%3Asiris_sil_886567",
            "Каталог Смитсоновских библиотек атрибутирует Сыма Цяню Records of the Grand Historian и фиксирует приблизительные годы 145-86 до н. э. в контексте Хань.",
          ),
          evidence(
            "Harvard University - Companion to Chinese History",
            "https://puett.scholars.harvard.edu/sites/g/files/omnuum3361/files/puett/files/puett_classical_chinese_historical_thought_8.pdf",
            "Академическое издание называет Сыма Цяня автором Shiji и относит его к эпохе императора У-ди династии Хань.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity/date queue: личность подтверждена; источники дают варианты ок. 145/135 и ок. 86/85 до н. э., поэтому сохранить приблизительные shared даты и не повышать их точность. Непроверяемое «первого масштабного труда» снято. Shared country files не изменялись.",
  },
  {
    key: "china:su_tong",
    originalSha256:
      "77c90bdfc373b4badae9f0c841c54b018e26fe4a299c4513be882a731f179df4",
    reviewedTextRu:
      "Китайский писатель, автор романа «Рис» и сборника повестей «Подними красный фонарь».",
    claims: [
      {
        textRu:
          "Су Тун - китайский писатель, автор романа Rice («Рис») и сборника повестей Raise the Red Lantern («Подними красный фонарь»).",
        verdict: "corrected",
        evidence: [
          evidence(
            "International Writing Program - University of Iowa",
            "https://iwp.uiowa.edu/writers/2001/su-tong-sutong",
            "Университетский профиль называет Су Туна китайским прозаиком, автором романа Rice и повести, экранизированной как Raise the Red Lantern.",
          ),
          evidence(
            "Hachette Book Group",
            "https://www.hachettebookgroup.com/contributor/su-tong/",
            "Официальный профиль издателя подтверждает авторство романа Rice и сборника трёх повестей Raise the Red Lantern.",
          ),
        ],
      },
      {
        textRu:
          "Су Тун родился 23 января 1963 года; shared birthDate 1963-01-01 является placeholder и требует исправления.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Bibliothèque nationale de France",
            "https://catalogue.bnf.fr/ark%3A/12148/cb122453866",
            "Авторитетная запись BnF указывает дату рождения Су Туна 1963-01-23.",
          ),
          evidence(
            "Store norske leksikon",
            "https://snl.no/Su_Tong",
            "Национальная энциклопедия Норвегии независимо фиксирует 23 января 1963 года и идентифицирует того же китайского писателя.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Date discrepancy queue: доказанная рекомендация - заменить placeholder birthDate 1963-01-01 на 1963-01-23; точную дату фиксирует Store norske leksikon, а BnF authority corroboration отражена в identity data. Оценка направления заменена произведениями. Shared country files не изменялись.",
  },
  {
    key: "china:tao_yuanming",
    originalSha256:
      "ff6c04682cb5ae74fbaaeca30dff661e7ab3ca29544214e9d9b6986250e5cec4",
    reviewedTextRu:
      "Китайский поэт IV-V веков, автор «Персикового источника».",
    claims: [
      {
        textRu:
          "Тао Юаньмин был китайским поэтом IV-V веков и написал «Персиковый источник».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Columbia University - Asia for Educators",
            "https://afe.easia.columbia.edu/ps/china/taoqian_peachblossom.pdf",
            "Учебное издание Колумбийского университета идентифицирует Тао Цяня (Тао Юаньмина) как поэта и автора Peach Blossom Spring.",
          ),
          evidence(
            "The Metropolitan Museum of Art",
            "https://www.metmuseum.org/exhibitions/listings/2012/chinese-gardens",
            "Музейная справка называет Тао Юаньмина поэтом, датирует его жизнь 365-427 годами и связывает с текстом Peach Blossom Spring.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив и широкая формула об основоположничестве заменены веком и произведением. Date recommendation: академические источники расходятся в годе рождения (365 и 376), поэтому при следующем shared review показывать «ок. 365 - 427», не точную дату. Shared country files не изменялись.",
  },
  {
    key: "china:wang_meng",
    originalSha256:
      "9ee86084c996b6fa6c5336d67a059cf8491bb931e93446d37a6a029845cf4cbd",
    reviewedTextRu:
      "Китайский писатель и государственный деятель; в 1986-1989 годах занимал пост министра культуры КНР.",
    claims: [
      {
        textRu:
          "Ван Мэн - китайский писатель и государственный деятель, занимавший пост министра культуры КНР в 1986-1989 годах.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Chinese University of Hong Kong - Renditions",
            "https://cuhk.edu.hk/rct/renditions/authors/wangm.html",
            "Университетский авторский профиль подтверждает писательскую деятельность Ван Мэна и назначение министром культуры в 1986 году.",
          ),
          evidence(
            "USC U.S.-China Institute",
            "https://china.usc.edu/event/wang-meng-wangmeng-speaks-tracing-genes-culture-wenmingjiyintanzong-2nd-nishan-forum",
            "Институт Университета Южной Калифорнии называет Ван Мэна китайским автором и указывает его службу министром культуры с 1986 по 1989 год.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Неподтверждённый суперлатив заменён конкретной государственной должностью и периодом её исполнения. Shared country files не изменялись.",
  },
  {
    key: "china:wang_wei",
    originalSha256:
      "8b65e1778a87a8bb05474961e58a6f51ae788004587a9a123adf3cb1464c884a",
    reviewedTextRu:
      "Китайский поэт, художник и государственный деятель эпохи Тан; в стихах часто обращался к образам природы.",
    claims: [
      {
        textRu:
          "Ван Вэй был поэтом, художником и государственным деятелем эпохи Тан; природные образы занимали важное место в его стихах.",
        verdict: "corrected",
        evidence: [
          evidence(
            "Poetry Foundation",
            "https://www.poetryfoundation.org/poets/wei-wang",
            "Профиль подтверждает годы 701-761, роли поэта, художника и государственного деятеля эпохи Тан и характерную природную образность стихов.",
          ),
          evidence(
            "The Metropolitan Museum of Art",
            "https://www.metmuseum.org/exhibitions/listings/2012/chinese-gardens",
            "Метрополитен-музей датирует Ван Вэя приблизительно 701-761 годами и рассматривает его цикл стихов о природном ландшафте Ванчуань.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Сравнительная формула «один из главных мастеров» заменена подтверждёнными ролями и особенностью тематики. Shared country files не изменялись.",
  },
  {
    key: "china:wu_chengen",
    originalSha256:
      "4dc5209dc0baf9e803d2ad79b7d2b71d41092d7e224e331ad0863852fe13eb8f",
    reviewedTextRu:
      "Китайский писатель эпохи Мин, которому традиционно приписывают роман «Путешествие на Запад».",
    claims: [
      {
        textRu:
          "У Чэнъэнь был китайским писателем эпохи Мин; роман «Путешествие на Запад» традиционно приписывают ему.",
        verdict: "corrected",
        evidence: [
          evidence(
            "British Museum",
            "https://www.britishmuseum.org/collection/object/A_1947-0712-160",
            "Музейный каталог называет У Чэнъэня автором приблизительно 1500-1582 годов и формулирует связь Xi Youji как атрибуцию.",
          ),
          evidence(
            "University of Southern California - Chinese Rare Books",
            "https://scalar.usc.edu/works/chinese-rare-books/media/xiyouzhenquan",
            "Университетская коллекция идентифицирует У Чэнъэня как минского романиста и поэта приблизительно 1500-1582 годов и отмечает общепринятую атрибуцию Journey to the West.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Identity/date queue: личность и приблизительные даты ок. 1500 - ок. 1582 подтверждены, однако авторство романа не следует подавать без оговорки; категоричное «автор» заменено «традиционно приписывают». Shared country files не изменялись.",
  },
  {
    key: "china:yan_lianke",
    originalSha256:
      "4ef93f180f8e9031eea65f44c3d0e4c41324fbe6f42b82ecef8c17a377288a2a",
    reviewedTextRu:
      "Китайский писатель, известный сатирической и социально-критической прозой.",
    claims: [
      {
        textRu:
          "Янь Лянькэ - китайский писатель, в прозе которого используются сатира и социальная критика.",
        verdict: "supported",
        evidence: [
          evidence(
            "Duke University Press",
            "https://www.dukeupress.edu/sound-and-silence",
            "Университетское издательство называет Янь Лянькэ автором романов, рассказов и эссе, чьи тексты исследуют повседневную реальность современного Китая и цензуру.",
          ),
          evidence(
            "The Booker Prizes",
            "https://thebookerprizes.com/the-booker-library/authors/yan-lianke",
            "Официальный профиль премии подтверждает китайскую литературную личность и прямо характеризует The Explosion Chronicles как фантастическую сатиру.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Краткое исходное описание нейтрально и подтверждается университетским издательством и премиальной организацией. Shared country files не изменялись.",
  },
  {
    key: "china:yu_hua",
    originalSha256:
      "08f1e9152ebfc1c2950ff0025412d6345edb34c6c10cc44e92c147c61d1c5cfe",
    reviewedTextRu:
      "Китайский писатель, автор романов «Жить» и «Братья».",
    claims: [
      {
        textRu:
          "Юй Хуа - китайский писатель, автор романов «Жить» и «Братья».",
        verdict: "corrected",
        evidence: [
          evidence(
            "Penguin Random House",
            "https://www.penguinrandomhouse.com/authors/42988/yu-hua/",
            "Официальная страница издателя идентифицирует Юй Хуа как автора и включает To Live и Brothers в его библиографию.",
          ),
          evidence(
            "National Endowment for the Arts",
            "https://www.arts.gov/sites/default/files/Reader-Resources-ToLive.pdf",
            "Читательский материал федерального фонда искусств подтверждает авторство To Live и перечисляет Brothers среди произведений Юй Хуа.",
          ),
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Сравнительная оценка известности заменена двумя документированными романами. Shared country files не изменялись.",
  },
];

export const writerBiographyFactReviewBatch18: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch18Base.map((record) => ({
    ...record,
    applicableTextRu:
      record.decision === "held" ? null : record.reviewedTextRu,
  }));
