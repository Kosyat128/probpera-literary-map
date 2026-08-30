import type { WriterProfile } from "./types";

export type WriterPublicProfileFactCorrectionBatch48 = {
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
): WriterPublicProfileFactCorrectionBatch48 {
  return { countryId, writerId, patch, evidence, note };
}

export const writerBiographyPublicProfileFactCorrectionsBatch48 = [
  correction(
    "seychelles",
    "guy_lionnet",
    {
      "name": "Ги Лионне",
      "years": "1922-2007",
      "birthDate": "1922",
      "deathDate": "2007",
      "birthPlace": "Маврикий"
    },
    sources(
      ["Seychelles Nation", "https://www.nation.sc/archive/218214/guy-lionnet-nest-plus-une-lumiere-du-pays-sest-eteinte"],
      ["Seychelles Islands Foundation", "https://www.sif.sc/sites/default/files/downloads/SIF%20Annual%20Report%202007.pdf"],
    ),
    "Исходные годы 1933–2015 и место рождения на Сейшелах не относятся к Ги Лионне. Они исправлены на подтверждённые годы 1922–2007 и Маврикий; характеристика конкретизирована занятиями и книгами."
  ),
  correction(
    "sierra_leone",
    "delia_jarrett_macauley",
    {
      "years": "",
      "birthDate": "",
      "birthPlace": ""
    },
    sources(
      ["The Orwell Foundation", "https://www.orwellfoundation.com/the-orwell-youth-prize/for-young-writers/future-orwell-youth-prize-2020-2-2-2/"],
      ["University of Warwick", "https://warwick.ac.uk/fac/arts/english/research/currentprojects/multiculturalshakespeare/thehistory/stories/"],
    ),
    "Неподтверждённые год и место рождения удалены. Оставлены только роли, происхождение, произведение и документированная премия."
  ),
  correction(
    "sierra_leone",
    "william_conton",
    {
      "years": "1925-2003",
      "deathDate": "2003"
    },
    sources(
      ["Store norske leksikon", "https://snl.no/William_Conton"],
      ["University of Reading Special Collections", "https://collections.reading.ac.uk/special-collections/wp-content/uploads/sites/5/2020/01/African-Writers-Series-Part-1-min.pdf"],
    ),
    "Ошибочный год смерти 1996 исправлен на 2003; общее утверждение заменено занятиями и двумя изданиями."
  ),
  correction(
    "singapore",
    "claire_tham",
    {
      "years": "",
      "birthDate": ""
    },
    sources(
      ["National Library Board Singapore — BiblioAsia", "https://biblioasia.nlb.gov.sg/vol-10/issue-1/apr-jun-2014/claire-tham-opinion/"],
      ["Singapore Writers Festival", "https://www.singaporewritersfestival.com/images/past-festivals/SWF-2013-Programme-Booklet.pdf"],
    ),
    "Неподтверждённые год и искусственная точная дата 1967-01-01 удалены; оставлены профессии и произведения."
  ),
  correction(
    "singapore",
    "josephine_chia",
    {
      "years": "",
      "birthDate": ""
    },
    sources(
      ["National Library Board Singapore", "https://www.nlb.gov.sg/main/article-detail?cmsuuid=A-cc6f0faa-6936-495e-9feb-6c5cdad3d33c"],
      ["Singapore Book Council", "https://www.bookcouncil.sg/images/uploads/awards/SLP_Commemorative_Book_Digital.pdf"],
    ),
    "Неподтверждённые год и искусственная точная дата 1951-01-01 удалены; добавлены документированные специализация, книга и премия."
  ),
  correction(
    "singapore",
    "kuo_pao_kun",
    {
      "name": "Куо Пао Кун",
      "birthDate": "1939-06-27",
      "birthPlace": "Хэбэй, Китай"
    },
    sources(
      ["Esplanade — Theatres on the Bay", "https://www.esplanade.com/offstage/arts/kuo-pao-kun"],
      ["RootsSG — National Heritage Board Singapore", "https://www.roots.gov.sg/places/places-landing/Places/surveyed-sites/the-substation"],
    ),
    "Исправлены ошибочные русское имя «Куо Пайк Шан», дата 1939-11-12 и место рождения в Малайзии. Официальная биография указывает 27 июня 1939 года и провинцию Хэбэй в Китае."
  ),
  correction(
    "solomon_islands",
    "john_saunana",
    {
      "fullName": "John Selwyn Saunana",
      "years": "1945-2013",
      "birthDate": "1945",
      "deathDate": "2013-04-30"
    },
    sources(
      ["Solomon Islands Historical Encyclopaedia", "https://www.solomonencyclopaedia.net/biogs/E000675b.htm"],
      ["University of Canterbury Library", "https://libcat.canterbury.ac.nz/Record/527728"],
    ),
    "Ошибочный год рождения 1947 исправлен на 1945, добавлен подтверждённый год и день смерти; литературное первенство сформулировано точно."
  ),
  correction(
    "solomon_islands",
    "rex_horoi",
    {
      "name": "Рекс Стивен Хорои",
      "fullName": "Stephen Rex Horoi",
      "years": "",
      "birthDate": "",
      "deathDate": ""
    },
    sources(
      ["University of the South Pacific", "https://www.usp.ac.fj/alumni/wp-content/uploads/sites/4/2021/08/USPAlumniNewsletter_201706_en.pdf"],
      ["ERIC — U.S. Department of Education", "https://eric.ed.gov/?id=ED205042"],
      ["United Nations Digital Library", "https://digitallibrary.un.org/record/398061"],
    ),
    "Профиль ошибочно называет человека «Рексом Хэтчинсом» и приписывает ему годы 1944–2014. Ключ однозначно относится к Рексу Стивену Хорои; надёжные источники расходятся в годе рождения, поэтому годы удалены, а литературная атрибуция заменена документированными занятиями."
  ),
  correction(
    "somalia",
    "abdullahi_diiriye_guuleed",
    {
      "name": "Абдуллахи Диирие Гулед",
      "years": "",
      "birthDate": "",
      "deathDate": ""
    },
    sources(
      ["SOAS University of London", "https://soas-repository.worktribe.com/OutputFile/395247"],
      ["Roma Tre University — ArcAdiA", "https://arcadia.sba.uniroma3.it/bitstream/2307/1528/1/Somali%20Literature%20-%20B.W.%20Andrzejewski.pdf"],
    ),
    "Имя «Абдуллахи Диирие Гулам» исправлено по ключу и академическим публикациям. Профильные годы 1928–1973 несовместимы с документированной работой начиная с 1978 года и поэтому удалены из текста; точные годы жизни не установлены."
  ),
  correction(
    "somalia",
    "farah_mohamed_jama_awl",
    {
      "years": "",
      "deathDate": ""
    },
    sources(
      ["Indiana University Libraries", "https://iucat.iu.edu/iuk/662083"],
      ["Roma Tre University — ArcAdiA", "https://arcadia.sba.uniroma3.it/handle/2307/5613?locale=en"],
    ),
    "Неподтверждённая роль историка удалена; добавлены два библиографически зафиксированных романа. Интервал лет жизни и год смерти очищены, поскольку надёжные справочные источники расходятся в годе смерти."
  ),
  correction(
    "somalia",
    "sayyid_mohammed_abdullah_hassan",
    {
      "years": "",
      "deathDate": ""
    },
    sources(
      ["Roma Tre University — ArcAdiA", "https://arcadia.sba.uniroma3.it/handle/2307/2575?mode=full"],
      ["SOAS University of London", "https://eprints.soas.ac.uk/20911/1/Orwin_Oral_Traditon.pdf"],
    ),
    "Расплывчатая характеристика религиозно-патриотических произведений заменена документированными ролями и историей публикации стихов. Интервал лет жизни и год смерти очищены из-за расхождения 1920/1921 в академических изданиях."
  ),
  correction(
    "south_africa",
    "achmat_dangor",
    {
      "years": "1948-2020",
      "deathDate": "2020"
    },
    sources(
      ["University of Cape Town Libraries", "https://lib.uct.ac.za/articles/2020-09-07-achmat-dangor-memoriam-1948-2020"],
      ["Tydskrif vir Letterkunde", "https://letterkunde.africa/article/view/8905"],
    ),
    "Ошибочный год смерти 2021 исправлен на 2020; общее описание литературы после апартеида заменено жанрами и конкретным произведением."
  ),
] satisfies readonly WriterPublicProfileFactCorrectionBatch48[];
