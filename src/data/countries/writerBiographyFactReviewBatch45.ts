export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH45_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 45";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH45_REVIEWER;
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
    key: "portugal:alexandre_herculano",
    originalSha256: "c3a91234da22f30a0c29f69e30c6be0003f3f6c671397185fba68c54ec0be08e",
    reviewedTextRu: "Александре Эркулану (1810–1877) — португальский писатель, историк, поэт и журналист эпохи романтизма. Автор исторических романов «Eurico, o Presbítero», «O Monge de Cister» и многотомной «História de Portugal».",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/conhecer/bases-tematicas/figuras-da-cultura-portuguesa/1279-alexandre-herculano.html", "Государственный институт подтверждает годы жизни, литературные и исторические роли, романтизм и произведения Эркулану."),
      e("Hemeroteca Municipal de Lisboa", "https://hemerotecadigital.cm-lisboa.pt/recursosinformativos/biografias/Textos/AHerculano.pdf", "Муниципальная библиотека Лиссабона независимо подтверждает биографию, журналистскую деятельность и библиографию автора."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено годами, четырьмя документированными ролями и оригинальными названиями трёх произведений.",
  },
  {
    key: "portugal:almeida_garrett",
    originalSha256: "103e166551e54428142cfb6a7c79c6657441d1523b0bc7605bf63b56eae3cbe6",
    reviewedTextRu: "Жуан Батишта да Силва Лейтан де Алмейда Гаррет (1799–1854) — португальский поэт, прозаик, драматург и политический деятель, сыгравший ключевую роль в утверждении романтизма и обновлении национального театра. Автор «Viagens na Minha Terra» и драмы «Frei Luís de Sousa».",
    evidence: [
      e("Camões, I.P.", "https://www.instituto-camoes.pt/activity/centro-virtual/bases-tematicas/figuras-da-cultura-portuguesa/almeida-garrett", "Государственный институт подтверждает полное имя, годы, жанры, романтизм, театральную деятельность и произведения Гарретта."),
      e("Assembleia da República", "https://livraria.parlamento.pt/products/almeida-garrett", "Парламентское издание независимо подтверждает политическую и литературную биографию Алмейды Гарретта."),
    ],
    decision: "corrected",
    notes: "Однофразовая характеристика дополнена полным именем, видами деятельности, ролью в театре и двумя конкретными произведениями.",
  },
  {
    key: "portugal:antonio_lobo_antunes",
    originalSha256: "3d65a5ce12ab83d0793093b85b4e5100f9d23ea10355cdd51ef20b4c70daeddd",
    reviewedTextRu: "Антониу Лобу Антунеш (1942–2026) — португальский романист и врач-психиатр, служивший военным врачом в Анголе во время колониальной войны. Автор «Memória de Elefante», «Os Cus de Judas» и «Manual dos Inquisidores»; лауреат Премии Камоэнса 2007 года.",
    evidence: [
      e("Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/antonio-lobo-antunes-1942-2026", "Государственный институт подтверждает годы жизни, профессии, службу в Анголе, книги и Премию Камоэнса."),
      e("Universidade de Lisboa", "https://www.ulisboa.pt/noticia/falecimento-do-doutor-honoris-antonio-lobo-antunes", "Лиссабонский университет независимо сообщает о смерти 5 марта 2026 года и подтверждает литературную и медицинскую биографию."),
    ],
    decision: "corrected",
    notes: "Открытые годы актуализированы после смерти автора; субъективное ранжирование заменено профессиями, службой, тремя романами и точной премией.",
  },
  {
    key: "portugal:augusto_abreu",
    originalSha256: "2023678b594a0a315af07b4ed7a15ae7adbf812ebe3d3a82e4dc7d0a022f65ad",
    reviewedTextRu: "Личность португальского писателя Аугушту Абреу с датами 1927–2011 и приписанными ему поэтическими сборниками и эссе не установлена по проверенным авторитетным каталогам.",
    evidence: [
      e("Biblioteca Nacional de Portugal", "https://catalogo.bnportugal.gov.pt/ipac20/ipac.jsp?profile=bn&index=AUTHOR&term=Augusto+Abreu", "Поиск национальной библиотеки не даёт однозначной авторитетной записи, связывающей точное имя с датами и библиографией карточки."),
      e("VIAF", "https://viaf.org/viaf/search?query=local.names%20all%20%22Augusto%20Abreu%22&maximumRecords=20&httpAccept=application/json", "Международный файл авторитетных записей не устанавливает единую литературную личность, соответствующую всем утверждениям карточки."),
    ],
    decision: "held",
    notes: "Карточка помещена в карантин до появления первичного идентификатора: имя распространено, а даты, литературная роль и произведения не получили однозначной атрибуции.",
  },
  {
    key: "portugal:branquinho_da_fonseca",
    originalSha256: "8de4ccd56866e8d2d05326b2c8742ee5733111355408a9913cdf92d82e5dba3a",
    reviewedTextRu: "Антониу Жозе Бранкинью да Фонсека (1905–1974) — португальский прозаик, поэт и драматург, один из основателей журнала «Presença». Автор новеллы «O Barão» и книг «Zonas», «Caminhos Magnéticos» и «Mar Santo».",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/teatro-em-portugal-pessoas/branquinho-da-fonseca-dp9.html", "Государственный институт подтверждает полное имя, годы, литературные роли, связь с Presença и основные произведения."),
      e("Câmara Municipal de Mortágua", "https://www.cm-mortagua.pt/cmmortagua/uploads/document/file/1371/ata03_2019.pdf", "Муниципальный официальный документ независимо подтверждает рождение в Мортагуа 4 мая 1905 года и смерть в Малвейра-да-Серра 16 мая 1974 года."),
    ],
    decision: "corrected",
    notes: "Исправлены место рождения, дата и место смерти; родовые названия заменены четырьмя документированными произведениями и связью с Presença.",
  },
  {
    key: "portugal:eca_de_queiros",
    originalSha256: "4efe52d05b7fd5ecf599cc38a2a49b9274facc2f1d314214f866fa971d9fb17e",
    reviewedTextRu: "Жозе Мария Эса де Кейрош (1845–1900) — португальский романист, журналист и дипломат, один из центральных авторов португальского реализма. Автор романов «O Crime do Padre Amaro», «O Primo Basílio» и «Os Maias».",
    evidence: [
      e("Fundação Eça de Queiroz", "https://feq.pt/eca-de-queiroz/vida-e-obra/", "Фонд писателя подтверждает полное имя, годы, профессии, реализм и библиографию Эсы де Кейроша."),
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/autores-e-antologia/eca-de-queiros-34063-dp19.html", "Государственный институт независимо подтверждает биографию, реалистический контекст и названные романы."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено полным именем, профессиями, литературным направлением и тремя романами в оригинальном написании.",
  },
  {
    key: "portugal:fernando_pessoa",
    originalSha256: "b8a9494935531b270ad9a9a1eecd08a7c07ffb9dd5e6a5ba7f9e470e0cd7a4cc",
    reviewedTextRu: "Фернанду Пессоа (1888–1935) — португальский поэт и прозаик эпохи модернизма. Он создавал литературные гетеронимы, среди которых Алберту Каэйру, Рикарду Рейш и Алвару де Кампуш; при жизни издал на португальском книгу «Mensagem».",
    evidence: [
      e("Casa Fernando Pessoa", "https://www.casafernandopessoa.pt/pt/fernando-pessoa/obra/fernando-pessoa", "Дом-музей писателя подтверждает годы, жанры, гетеронимы и публикацию Mensagem."),
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/seculo-xx/fernando-pessoa-70179.html", "Государственный институт независимо подтверждает модернистский контекст, гетеронимы и библиографию Пессоа."),
    ],
    decision: "corrected",
    notes: "Субъективные превосходные степени заменены годами, жанрами, именами трёх гетеронимов и документированным прижизненным изданием.",
  },
  {
    key: "portugal:gil_vicente",
    originalSha256: "b5532ea12cf9f7df0e160c909defd1c603064d201346df0ce4ef8d1fb5e05390",
    reviewedTextRu: "Жил Висенте (ок. 1465 — ок. 1536) — португальский драматург и поэт, чьи пьесы соединяют средневековые жанры с ренессансной сатирой. Автор «Auto da Índia», цикла «Autos das Barcas» и «Farsa de Inês Pereira».",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/autores-e-antologia/gil-vicente-6254-dp12.html", "Государственный институт подтверждает приблизительные годы, жанры, переходный историко-литературный контекст и пьесы Висенте."),
      e("Biblioteca Nacional de Portugal", "https://bibliografia.bnportugal.gov.pt/bnp/bnp.exe/q?mfn=305287&qf_AU=%3DVICENTE%2C+GIL%2C+CA.+1465-CA.+1536", "Национальная библиография независимо фиксирует авторитетную форму имени, приблизительные годы и произведения драматурга."),
    ],
    decision: "corrected",
    notes: "Общее оценочное описание заменено осторожными приблизительными годами, литературным контекстом и тремя оригинальными названиями.",
  },
  {
    key: "portugal:goncalo_m_tavares",
    originalSha256: "c047611a36ebaca526648c6c73b6015bfe25f4cbb6ce7c44c082f674d7626482",
    reviewedTextRu: "Гонсалу Тавареш (род. 1970) — португальский писатель и университетский преподаватель. Автор романа «Jerusalém» и поэмы-романа «Uma Viagem à Índia»; лауреат премии Жозе Сарамаго 2005 года и премии Форментор 2026 года.",
    evidence: [
      e("Universidade de Lisboa", "https://www.ulisboa.pt/noticia/goncalo-m-tavares-distinguido-com-o-premio-formentor-das-letras-2026", "Лиссабонский университет подтверждает писательскую и преподавательскую деятельность, произведения и премию Форментор 2026 года."),
      e("Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/goncalo-m-tavares-em-toronto", "Государственный институт независимо подтверждает год рождения, португальскую литературную принадлежность, книги и премию Жозе Сарамаго."),
    ],
    decision: "corrected",
    notes: "Субъективное описание заменено профессиями, двумя произведениями и двумя датированными премиями; точный день рождения снят как не подтверждённый этими источниками.",
  },
  {
    key: "portugal:helia_correa",
    originalSha256: "38518c8a59e2dd9a5f2fbcdf8150c40e26167e8f5d4d4d1a7ef4d588bb96ff5b",
    reviewedTextRu: "Элия Коррея (род. 1949) — португальская прозаик, поэтесса и драматург. Автор романов «Lillias Fraser» и «Adoecer», а также поэмы «A Terceira Miséria»; лауреат Премии Камоэнса 2015 года.",
    evidence: [
      e("Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/helia-correia-vence-premio-camoes-2015", "Государственный институт подтверждает год рождения, жанры, книги и Премию Камоэнса 2015 года."),
      e("Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://livro.dglab.gov.pt/sites/DGLB/Portugues/divulgacaoEstrangeiro/apoioDivulgacaoAutores/Documents/GramBemQuerer_PT_ES.pdf", "Государственная книжная дирекция независимо подтверждает литературную биографию и библиографию Элии Корреи."),
    ],
    decision: "corrected",
    notes: "Субъективная формула заменена годом, жанрами, тремя произведениями и точной премией; неподтверждённый день рождения снят.",
  },
  {
    key: "portugal:herberto_helder",
    originalSha256: "a05f6acf5f023e80e233810b9ca8d44fef0a826abae56cd561fcb129830a056b",
    reviewedTextRu: "Эрберту Элдер Луиш Бернардеш де Оливейра (1930–2015) — португальский поэт и переводчик. Среди его книг — «O Amor em Visita», «Electronicolírica», «Photomaton & Vox» и сборник прозы «Os Passos em Volta».",
    evidence: [
      e("Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://livro.dglab.gov.pt/sites/DGLB/Portugues/autores/Paginas/PesquisaAutores1.aspx?AutorId=8056", "Государственная книжная дирекция подтверждает полное имя, годы, литературные роли, место смерти и библиографию Элдера."),
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/autores-e-antologia/herberto-helder-dp17.html", "Государственный институт независимо подтверждает биографию, переводческую работу и оригинальные названия книг."),
    ],
    decision: "corrected",
    notes: "Исправлено место смерти; субъективное ранжирование и ненадёжные переводы названий заменены полным именем, ролями и четырьмя оригинальными книгами.",
  },
  {
    key: "portugal:jose_luis_peixoto",
    originalSha256: "e37ba0a763201b8c30574307be4936a5b64c62ada7a564aab7a948f4f16be36b",
    reviewedTextRu: "Жозе Луиш Пейшоту (род. 1974) — португальский прозаик, поэт и драматург, уроженец Галвейаша. Роман «Nenhum Olhar» получил премию Жозе Сарамаго 2001 года; в 2026 году писатель удостоен премии Вержилиу Феррейры за совокупность творчества.",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/poemasemana/36/dascasas4.html", "Государственный институт подтверждает год и место рождения, жанры, роман Nenhum Olhar и премию Жозе Сарамаго."),
      e("Universidade de Évora", "https://www.uevora.pt/ue-media/noticias?item=45551", "Университет независимо подтверждает литературные роли и присуждение премии Вержилиу Феррейры 2026 года."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено жанрами, местом рождения, оригинальным названием романа и двумя датированными премиями; точный день рождения снят.",
  },
  {
    key: "portugal:jose_rodrigues_dos_santos",
    originalSha256: "7cfff71484cae3a0d134f851c457e3af6b1df55a4db9093a5e4939f1d8ffb179",
    reviewedTextRu: "Жозе Родригеш душ Сантуш (род. 1964) — португальский журналист, университетский преподаватель и романист, родившийся в Бейре, Мозамбик. Работал в Rádio Macau, BBC, CNN и RTP; автор романов «Codex 632» и «A Fórmula de Deus».",
    evidence: [
      e("José Rodrigues dos Santos official site", "https://joserodriguesdossantos.com/o-autor/", "Официальная авторская биография подтверждает происхождение, журналистскую, преподавательскую и писательскую деятельность, международные редакции и романы."),
      e("Camões, I.P.", "https://www.instituto-camoes.pt/images/img_noticias2024/PROGRAMA_AF_ADV_JORNAL_V3_web.pdf", "Государственный институт независимо подтверждает преподавательскую и писательскую деятельность и библиографию душ Сантуша."),
    ],
    decision: "corrected",
    notes: "Субъективная популярность заменена профессиями, местом рождения, документированными редакциями и двумя романами; точный день рождения снят.",
  },
  {
    key: "portugal:jose_saramago",
    originalSha256: "4a511c5234c4847861f740f06a30838b4b7b05cd31f41a51a2bf509d09675286",
    reviewedTextRu: "Жозе Сарамаго (1922–2010) — португальский романист, драматург и эссеист, лауреат Премии Камоэнса 1995 года. В 1998 году он получил Нобелевскую премию по литературе; автор романов «Memorial do Convento», «O Evangelho segundo Jesus Cristo» и «Ensaio sobre a Cegueira».",
    evidence: [
      e("Nobel Prize Outreach", "https://www.nobelprize.org/prizes/literature/1998/press-release/", "Официальный Нобелевский архив подтверждает литературную премию 1998 года и характеристику творчества Сарамаго."),
      e("Fundação José Saramago", "https://www.josesaramago.org/biografia/", "Фонд писателя независимо подтверждает годы, жанры, Премию Камоэнса и библиографию."),
    ],
    decision: "corrected",
    notes: "Оценочная характеристика стиля заменена жанрами, двумя точными премиями и тремя романами в оригинальном написании.",
  },
  {
    key: "portugal:lidia_jorge",
    originalSha256: "a98e0eb3ece946c13ee238c8a682bb158fa087cece4fba761d4519150b8e8fd4",
    reviewedTextRu: "Лидия Жоржи (род. 1946) — португальская писательница, родившаяся в Боликейме, Алгарви. Её романы «O Dia dos Prodígios» и «A Costa dos Murmúrios» обращены к памяти о революции, колониальной войне и общественным переменам; лауреат Премии Камоэнса 2026 года.",
    evidence: [
      e("Camões, I.P.", "https://www.instituto-camoes.pt/sobre/comunicacao/noticias/lidia-jorge-distinguida-com-o-premio-camoes-2026", "Государственный институт подтверждает год и место рождения, романы, тематику и Премию Камоэнса 2026 года."),
      e("Universidade de Lisboa", "https://www.letras.ulisboa.pt/pt/noticias/candidaturas-e-premios/3101-lidia-jorge-recebe-o-premio-camoes-2026", "Филологический факультет независимо подтверждает биографию и присуждение Премии Камоэнса в 2026 году."),
    ],
    decision: "corrected",
    notes: "Исправлены место рождения и ошибочный год Премии Камоэнса 2023; оценочное ранжирование заменено двумя романами и их тематическим контекстом.",
  },
  {
    key: "portugal:luis_de_camoes",
    originalSha256: "6f7ce35b309ef4b8967f9d1349d097a3e540c90ee3ce55a19a105db5a43b0289",
    reviewedTextRu: "Луиш Ваш де Камоэнс (ок. 1524/1525–1580) — португальский поэт эпохи Возрождения, автор эпической поэмы «Os Lusíadas» (1572), посвящённой путешествию Васко да Гамы и португальским открытиям, а также лирики, собранной в «Rimas».",
    evidence: [
      e("Assembleia da República", "https://www.parlamento.pt/VisitaParlamento/Paginas/BiogLuisdeCamoes.aspx", "Парламентская биография подтверждает полное имя, осторожную датировку рождения, смерть, эпоху и Os Lusíadas."),
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/camoes-dp2.html", "Государственный институт независимо подтверждает биографию, эпическую и лирическую библиографию; источники расходятся между 1524 и 1525 годами рождения."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование снято; год рождения оставлен диапазоном, спорное место рождения очищено, произведения даны в оригинальном написании.",
  },
  {
    key: "portugal:manuel_de_aranha",
    originalSha256: "5559b2591cc3fc909f6243b8f53fde1dcfae773d9afcb96a648d5be1f21edd38",
    reviewedTextRu: "Мануэл Жозе де Арриага Брум да Силвейра (1840–1917) — португальский адвокат, писатель и политический деятель, первый конституционно избранный президент Португальской республики; занимал пост с 1911 по 1915 год. Публиковал поэзию и политико-социальные сочинения, в том числе «Cantos Sagrados», «Irradiações» и мемуары «Na Primeira Presidência da República Portuguesa».",
    evidence: [
      e("Presidência da República Portuguesa", "https://www.presidencia.pt/presidente-da-republica/a-presidencia/antigos-presidentes/manuel-de-arriaga/", "Официальная президентская биография подтверждает полное имя, годы, юридическую, литературную и политическую деятельность и президентство."),
      e("Assembleia da República", "https://app.parlamento.pt/COMUNICAR/Artigo.aspx?ID=592", "Парламентский материал независимо подтверждает биографию Мануэла де Арриаги и его публикации."),
    ],
    decision: "corrected",
    notes: "Публичное имя и произведения исправлены по официальным источникам; унаследованный id manuel_de_aranha сохранён без молчаливого переименования.",
  },
  {
    key: "portugal:mario_de_sa_carneiro",
    originalSha256: "1c5f11fa66dc9662af305e6fa5d6ed96e82c96d0f4512d0a45395b9cc9f3f02f",
    reviewedTextRu: "Мариу де Са-Карнейру (1890–1916) — португальский поэт и прозаик, один из ключевых участников модернистского журнала «Orpheu». Автор поэтической книги «Dispersão», повести «A Confissão de Lúcio» и посмертного сборника «Indícios de Oiro».",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/contomes/03/escreveu.html", "Государственный институт подтверждает годы, жанры, участие в Orpheu и книги Са-Карнейру."),
      e("Biblioteca Nacional de Portugal", "https://www.bnportugal.gov.pt/index.php?Itemid=259&catid=49%3Aaquisicoes&id=229%3Aindiciosdeouromariosacarneiro&lang=pt&option=com_content&view=article", "Национальная библиотека независимо подтверждает авторскую биографию и посмертную историю Indícios de Oiro."),
    ],
    decision: "corrected",
    notes: "Общая характеристика модернизма дополнена связью с Orpheu; переводные и родовые заголовки заменены тремя оригинальными книгами.",
  },
  {
    key: "portugal:miguel_torga",
    originalSha256: "b8b53b3ddd338f6e7564af5fac2c484144f54ff814011d2bdff5efdb6c958b15",
    reviewedTextRu: "Мигел Торга — литературный псевдоним врача Адолфу Коррейи да Роши (1907–1995), португальского поэта, прозаика и автора дневников. Среди его книг — «Bichos», «Novos Contos da Montanha» и шестнадцатитомный «Diário»; лауреат первой Премии Камоэнса 1989 года.",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/seculo-xx/miguel-torga-3700-dp21.html", "Государственный институт подтверждает настоящее имя, годы, профессии, произведения и первую Премию Камоэнса."),
      e("Espaço Miguel Torga", "https://www.espacomigueltorga.pt/p70-miguel-torga-vida-e-obra-pt", "Мемориальный центр независимо подтверждает биографию, рождение в Сан-Мартинью-ди-Анта и библиографию Торги."),
    ],
    decision: "corrected",
    notes: "Раскрыто настоящее имя, уточнено место рождения; ошибочный перевод «Блаженные» заменён на Bichos, дневниковый цикл и премия указаны точно.",
  },
  {
    key: "portugal:sofia_de_mello_breyner",
    originalSha256: "faa1770efa9a00965103bf63f585058d031fb0db90e2246fbb6c64db670516c5",
    reviewedTextRu: "София де Мелло Брейнер Андресен (1919–2004) — португальская поэтесса, прозаик, автор детских книг, эссеистка и переводчица. Среди её книг — «Dia do Mar», «Livro Sexto», «O Nome das Coisas» и «A Menina do Mar»; лауреат Премии Камоэнса 1999 года.",
    evidence: [
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/seculo-xx/sophia-de-mello-breyner-andresen-53148-dp20.html", "Государственный институт подтверждает годы, литературные роли, произведения и Премию Камоэнса."),
      e("Biblioteca Nacional de Portugal", "https://acpc.bnportugal.gov.pt/espolios_autores/e64_andresen_sofia_melo_breyner.html", "Национальная библиотека независимо подтверждает авторскую идентичность, жанры и библиографию Андресен."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование заменено пятью литературными ролями, четырьмя оригинальными названиями и точной премией.",
  },
  {
    key: "portugal:vergilio_ferreira",
    originalSha256: "bf131f4c8e08978ea0b9d6b7ead22d033502b63aeb6ac8db98adbdbcd151492d",
    reviewedTextRu: "Вержилиу Феррейра (1916–1996) — португальский писатель и преподаватель, в прозе которого важное место занимает экзистенциальная проблематика. Среди его романов — «Aparição», «Manhã Submersa» и «Signo sinal»; в 1992 году он получил Премию Камоэнса.",
    evidence: [
      e("Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://adevr.dglab.gov.pt/2016/01/28/comemoracao-do-centenario-do-nascimento-do-professor-e-escritor-vergilio-ferreira/", "Государственный архив подтверждает годы, рождение в Мелу, преподавательскую и писательскую деятельность Феррейры."),
      e("Camões, I.P.", "https://cvc.instituto-camoes.pt/a-galinha/quem-escreveu-23555-dp11.html", "Государственный институт независимо подтверждает биографию, экзистенциальную проблематику, романы и Премию Камоэнса."),
    ],
    decision: "corrected",
    notes: "Место рождения уточнено до Мелу; неподтверждённое название удалено, вместо него указаны три документированных романа и точная премия.",
  },
  {
    key: "portugal:walter_hugo_mae",
    originalSha256: "79c9dc400c6b121483c928c4acd484930b2001ef983c324a5d1936df7424aefb",
    reviewedTextRu: "Валтер Угу Маэ (род. 1971) — португальский писатель и поэт, родившийся в Сауримо, Ангола. Среди его романов — «o remorso de baltazar serapião», «a máquina de fazer espanhóis», «o filho de mil homens» и «o apocalipse dos trabalhadores»; за первый из них он получил Литературную премию Жозе Сарамаго 2007 года.",
    evidence: [
      e("Direção-Geral do Livro, dos Arquivos e das Bibliotecas", "https://livro.dglab.gov.pt/sites/DGLB/English/BookDepartment/PromotionAbroad/PromotionalMaterials/Documents/SightsfromtheSouth_6.pdf", "Государственная книжная дирекция подтверждает год и место рождения, литературные роли и библиографию Маэ."),
      e("Prémio Literário José Saramago", "https://www.premiojosesaramago.pt/vencedores/2007/valter-hugo-mae", "Официальный архив премии независимо подтверждает роман o remorso de baltazar serapião и победу 2007 года."),
    ],
    decision: "corrected",
    notes: "Компрометированный valterhugomae.com исключён; неподтверждённые точный день и имя при рождении сняты, книги и премия сохранены по двум безопасным источникам.",
  },
  {
    key: "puerto_rico:esmeralda_santiago",
    originalSha256: "cb9793f9d7368959b4b5a9938eca3711a04ee3e5f955e0d31140294424312334",
    reviewedTextRu: "Эсмеральда Сантьяго (род. 1948) — пуэрто-риканская писательница, автор мемуаров и романов. В книгах «When I Was Puerto Rican» и «Almost a Woman» она обращается к опыту переезда из Пуэрто-Рико в Нью-Йорк; среди её романов — «América’s Dream» и «Conquistadora».",
    evidence: [
      e("Harvard Gazette", "https://news.harvard.edu/gazette/story/2013/04/an-author-finds-her-voice/", "Гарвардский университет подтверждает год рождения, переезд, мемуарные книги и литературную деятельность Сантьяго."),
      e("Library of Congress", "https://www.loc.gov/item/n93064183/esmeralda-santiago/", "Библиотека Конгресса независимо подтверждает авторскую идентичность и библиографию, включая мемуары и романы."),
    ],
    decision: "corrected",
    notes: "Ошибочная классификация América’s Dream как мемуаров исправлена; точный день и место рождения сняты, произведения приведены в оригинальном написании.",
  },
  {
    key: "puerto_rico:jose_luis_gonzalez",
    originalSha256: "93f6432d184d828e8c56a6c43635870136c0a25a08c71234b5be298053f72900",
    reviewedTextRu: "Хосе Луис Гонсалес (1926–1996) — пуэрто-риканский писатель, эссеист, переводчик и преподаватель, родившийся в Санто-Доминго и выросший в Сан-Хуане. Среди его книг — сборник «El hombre en la calle», романы «Balada de otro tiempo» и «La llegada», а также эссе «El país de cuatro pisos».",
    evidence: [
      e("Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/jose-luis-gonzalez/", "Национальная энциклопедия подтверждает годы, место рождения, профессии и произведения Гонсалеса."),
      e("Universidad de Puerto Rico", "https://sacayey.upr.edu/pluginfile.php/339/mod_glossary/attachment/2045/Certificaci%C3%B3n%20%23048%20%281997-98%29%20SA.pdf", "Университетский официальный документ независимо подтверждает биографию, преподавательскую работу и библиографию писателя."),
    ],
    decision: "corrected",
    notes: "Место рождения исправлено с Сан-Хуана на Санто-Доминго, заголовок El hombre en la calle и жанры уточнены, добавлены две книги.",
  },
  {
    key: "puerto_rico:julia_de_burgos",
    originalSha256: "e9b1dcaf0438dd86ac009be37856927a88b5cf8ef013f84ebfcff667724bd5c3",
    reviewedTextRu: "Хулия де Бургос (1914–1953) — пуэрто-риканская поэтесса, педагог и участница движения за независимость Пуэрто-Рико. Её основные сборники — «Poema en veinte surcos» и «Canción de la verdad sencilla»; к самым известным стихотворениям относится «Río Grande de Loíza».",
    evidence: [
      e("Academy of American Poets", "https://poets.org/poet/julia-de-burgos", "Литературная академия подтверждает годы, педагогическую деятельность, политическое участие, сборники и стихотворение Бургос."),
      e("Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/julia-de-burgos/", "Национальная энциклопедия независимо подтверждает биографию, литературные роли и различие между книгами и отдельными стихотворениями."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и тематические обобщения заменены профессиями и политическим участием; сборники отделены от отдельного стихотворения.",
  },
  {
    key: "puerto_rico:manuel_ramos_otero",
    originalSha256: "f5cb6995cea082da1877a5db324c3f82c11a783da16045965e34171812354342",
    reviewedTextRu: "Мануэль Рамос Отеро (1948–1990) — пуэрто-риканский прозаик, поэт и преподаватель, один из новаторов квир-литературы острова. Среди его книг — роман «La novelabingo», сборник «Página en blanco y staccato» и посмертный поэтический сборник «Invitación al polvo».",
    evidence: [
      e("Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/manuel-ramos-otero/", "Национальная энциклопедия подтверждает дату рождения 20 июля 1948 года, роли, квир-литературный контекст и книги Отеро."),
      e("Columbia University Libraries", "https://library.columbia.edu/about/news/libraries/2014/2014-3-12_RBML_Acquires_Ramos_Otero_Archive.html", "Университетский архив независимо подтверждает биографию, преподавание и библиографию писателя."),
    ],
    decision: "corrected",
    notes: "Дата рождения исправлена с 22 на 20 июля; жанры уточнены, а список произведений дополнен посмертным поэтическим сборником.",
  },
  {
    key: "puerto_rico:rene_marques",
    originalSha256: "86746526905e5b2a149ad2027bce1e913f06272a999e4f075a9968b9db355a3d",
    reviewedTextRu: "Рене Маркес (1919–1979) — пуэрто-риканский драматург, прозаик и эссеист. Среди его пьес — «La carreta» и «Los soles truncos», а среди романов — «La víspera del hombre» и «La mirada».",
    evidence: [
      e("Enciclopedia de Puerto Rico", "https://enciclopediapr.org/content/rene-marques/", "Национальная энциклопедия подтверждает годы, жанры и основные пьесы и романы Маркеса."),
      e("Universidad de Puerto Rico", "https://www.upr.edu/ac/catedratica-del-rum-de-la-upr-prologa-obra-inedita-de-rene-marques/", "Университет независимо подтверждает литературную биографию и роман La mirada."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование и широкая тематическая интерпретация заменены жанрами и четырьмя произведениями с чётким разделением пьес и романов.",
  },
  {
    key: "qatar:abdulaziz_al_mahmoud",
    originalSha256: "72a9a023e196b2edfa77bbef2a764fced325678cdfbb131ba1dd7aab015a8289",
    reviewedTextRu: "Абдулазиз Аль-Махмуд (род. 1961) — катарский писатель и журналист, автор исторических романов. Его дебютный роман «Al Qursan» («The Corsair») посвящён борьбе в Персидском заливе в начале XIX века; второй роман — «The Holy Sail».",
    evidence: [
      e("Katara Publishing House", "https://kataranovels.com/novelist/%D8%B9%D8%A8%D8%AF%D8%A7%D9%84%D8%B9%D8%B2%D9%8A%D8%B2-%D8%A2%D9%84-%D9%85%D8%AD%D9%85%D9%88%D8%AF/", "Катарское издательство подтверждает 1961 год рождения, журналистскую работу и оба исторических романа Аль-Махмуда."),
      e("Qatar National Library", "https://www.qnl.qa/en/node/8380", "Национальная библиотека независимо подтверждает катарскую писательскую идентичность и романы The Corsair и The Holy Sail."),
    ],
    decision: "corrected",
    notes: "Год рождения исправлен с 1965 на 1961, добавлены журналистская роль, Доха и второй роман; имя нормализовано.",
  },
  {
    key: "qatar:ahmad_al_mahmoud",
    originalSha256: "65dd2228342ff4b20da834d9e70343d1b5f7dcdacd824b7ab97f6d75e115a779",
    reviewedTextRu: "Личность катарского писателя и поэта Ахмада аль-Махмуда с 1957 годом рождения не установлена: доступные источники описывают других людей со сходными именами.",
    evidence: [
      e("Qatar Authors Forum", "https://www.qauthors.qa/en/authors-2/list-of-authors/", "Официальный перечень катарских авторов не устанавливает заявленную мужскую литературную личность с датой и произведениями карточки."),
      e("Qatar University", "https://qspace.qu.edu.qa/bitstream/handle/10576/11502/%D9%85%D8%B1%D8%B3%D9%84%20%D8%AE%D9%84%D9%81%20%D8%A7%D9%84%D8%AF%D9%88%D8%A7%D8%B3%20_%20%D8%A7%D9%84%D9%86%D8%B3%D8%AE%D8%A9%20%D8%A7%D9%84%D9%85%D9%82%D8%A8%D9%88%D9%84%D8%A9%20%D9%84%D9%84%D8%B1%D8%B3%D8%A7%D9%84%D8%A9_%D9%85%D9%83%D8%AA%D8%A8%20%D8%A7%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D8%A7%20.pdf?isAllowed=y&sequence=1", "Университетское исследование литературы Катара не подтверждает сочетание имени, 1957 года и заявленных литературных ролей."),
    ],
    decision: "held",
    notes: "Карточка помещена в карантин: имя может смешивать Ахмеда Абдул-Малика, Шейху Ахмед Аль-Махмуд или дипломата; безопасная атрибуция невозможна.",
  },
  {
    key: "qatar:jamal_fayiz_al_maliki",
    originalSha256: "8eaf9840c8fedb55a8141a122fd6cfc88d9ce38ae63f2010a2a0a8af9afa91c5",
    reviewedTextRu: "Личность катарского поэта Джамаля Файза аль-Малики с 1953 годом рождения не установлена; авторитетные источники описывают прозаика Джамаля Файза Хамиса аль-Саида, родившегося в Дохе в 1964 году.",
    evidence: [
      e("Qatar Authors Forum", "https://www.qauthors.qa/en/authors-2/list-of-authors/", "Официальный перечень авторов фиксирует Джамаля Файза аль-Саида, но не подтверждает фамилию аль-Малики, 1953 год или поэтический профиль карточки."),
      e("Katara Publishing House", "https://kataranovels.com/novelist/%D8%AC%D9%85%D8%A7%D9%84-%D9%81%D8%A7%D9%8A%D8%B2-%D8%A7%D9%84%D8%B3%D8%B9%D9%8A%D8%AF/", "Катарское издательство независимо подтверждает прозаика Джамаля Файза аль-Саида, Доху, 1964 год и его книги, отличающиеся от текущей карточки."),
    ],
    decision: "held",
    notes: "Карточка помещена в карантин; возможное исправление требует явного merge/remap/delete, а унаследованный slug нельзя молча переименовывать.",
  },
  {
    key: "qatar:kulthum_jaber",
    originalSha256: "3a6c5de9a4d4c51384e0188c205b3ac96fa7a1d8666424b65da5c33951a0c6b7",
    reviewedTextRu: "Кульсум Джабр аль-Кувари (род. около 1958 года) — катарская писательница, поэтесса и преподавательница. В 1978 году она стала первой женщиной Катара, выпустившей сборник рассказов — «Anyā wa-ghābāt al-ṣamt wa-l-taraddud»; позднее опубликовала роман «Фаридж бин Дирхам».",
    evidence: [
      e("Qatar National Library", "https://qnl.qa/ar/about/news/hdwr-kthyf-lljmhwr-fy-alywm-alakhyr-lmhrjan-jaybwr-aladby-aldwht-balmktbt-alwtnyt", "Национальная библиотека подтверждает полное имя, литературные роли, ранний сборник рассказов и роман аль-Кувари."),
      e("Università degli Studi di Torino", "https://iris.unito.it/retrieve/43ec8c7d-6baa-4e78-8a11-27550f2c7a5b/2023.%20Kervan%2C%20I%20racconti%20brevi%20di%20Dalal%20Khalifa.pdf", "Университетское исследование независимо подтверждает её место в истории катарского рассказа, дату публикации 1978 года и библиографию."),
    ],
    decision: "corrected",
    notes: "Полное имя, роли и приблизительный год уточнены; ошибочная характеристика романистки заменена документированным первенством в публикации женского сборника рассказов.",
  },
  {
    key: "republic_of_congo:alain_mabanckou",
    originalSha256: "f2bbd903064ce72cf5fa836768a556d0ef83b857713ed7fb09d951db4d287423",
    reviewedTextRu: "Ален Мабанку (род. 1966) — конголезский прозаик, поэт и эссеист, профессор франкоязычной литературы в UCLA. Среди его романов — «Verre cassé», «Black Bazar» и «Mémoires de porc-épic»; последний получил премию Ренодо 2006 года.",
    evidence: [
      e("Collège de France", "https://www.college-de-france.fr/fr/chaire/alain-mabanckou-creation-artistique-chaire-annuelle/biography", "Коллеж де Франс подтверждает год рождения, жанры, профессорскую должность в UCLA и библиографию Мабанку."),
      e("Académie française", "https://www.academie-francaise.fr/alain-mabanckou", "Французская академия независимо подтверждает произведения и премию Ренодо за Mémoires de porc-épic."),
    ],
    decision: "corrected",
    notes: "Субъективное ранжирование снято; ошибочное «Трещины» заменено тремя оригинальными романами, а премия точно связана с Mémoires de porc-épic.",
  },
  {
    key: "republic_of_congo:daniel_biyaoula",
    originalSha256: "5a54d4c3989319b2ee9e0e43a01dc845484a57e6fbbd42c4fd676b8852772166",
    reviewedTextRu: "Даниэль Бийаула (1953–2014) — конголезский франкоязычный писатель, родившийся в Браззавиле. Его дебютный роман «L’Impasse» получил Grand Prix littéraire d’Afrique noire 1997 года; затем вышли романы «Agonies» и «La Source de joies».",
    evidence: [
      e("Library and Archives Canada", "https://central.bac-lac.gc.ca/.item?app=Library&id=TC-QMUQ-4622&oclc_number=793510627&op=pdf", "Канадская национальная библиотека подтверждает годы, место рождения и библиографию Бийаулы."),
      e("Africultures", "https://africultures.com/limpasse-362/", "Специализированный культурный ресурс независимо подтверждает роман L’Impasse и его Grand Prix littéraire d’Afrique noire."),
    ],
    decision: "corrected",
    notes: "Место рождения уточнено до Браззавиля; неподтверждённая «Мать» заменена тремя романами и документированной премией.",
  },
  {
    key: "republic_of_congo:emmanuel_dongala",
    originalSha256: "ac1aede238993d8bde76cf21709e478fdf00da65eb4f57865af392396d670323",
    reviewedTextRu: "Эммануэль Донгала (род. 1941) — конголезский романист и химик, родившийся в Центральноафриканской Республике и много лет живший в Республике Конго. Среди его книг — «Le Feu des origines», «Johnny chien méchant» и «Photo de groupe au bord du fleuve»; в 2023 году он получил Grand Prix Hervé Deluen Французской академии.",
    evidence: [
      e("Académie française", "https://www.academie-francaise.fr/discours-sur-les-prix-litteraires-2023", "Французская академия подтверждает писательскую биографию, книги и Grand Prix Hervé Deluen 2023 года."),
      e("Bard College", "https://www.bard.edu/news/releases/pr/fstory.php?id=9599", "Университет независимо подтверждает рождение в Центральноафриканской Республике, жизнь в Конго, профессию химика и библиографию Донгалы."),
    ],
    decision: "corrected",
    notes: "Место рождения исправлено с общего «Конго» на Центральноафриканскую Республику; переводные заголовки заменены оригинальными, добавлены профессия и премия.",
  },
  {
    key: "republic_of_congo:guy_menga",
    originalSha256: "10ace59fd5c269eaac46f24775e062fd50099bb3c44c15b4e8e450f320cd2635",
    reviewedTextRu: "Ги Менга (род. 1935) — конголезский драматург, прозаик и журналист, родившийся в Манкононго. Среди его произведений — пьесы «La Marmite de Koka-Mbala» и «L’Oracle», а также роман «La Palabre stérile», получивший Grand Prix littéraire d’Afrique noire 1969 года.",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb11915578k", "Национальная библиотека Франции подтверждает полное имя, год, место рождения и библиографию Ги Менги."),
      e("Les Francophonies", "https://www.lesfrancophonies.fr/MENGA-Guy", "Франкофонный театральный институт независимо подтверждает жанры, пьесы, роман и премию 1969 года."),
    ],
    decision: "corrected",
    notes: "Добавлены полное имя и место рождения; ошибочно приписанное Demain, un autre jour удалено и заменено двумя пьесами и премированным романом.",
  },
  {
    key: "republic_of_congo:henri_lopes",
    originalSha256: "fa854047c0536670de545f1a7fa348cca92eea0d20b98787da447c1d9a346287",
    reviewedTextRu: "Анри Лопес (1937–2023) — конголезский писатель и дипломат, бывший премьер-министр Республики Конго и заместитель генерального директора ЮНЕСКО по культуре. Среди его книг — «Le Pleurer-rire», «Le Chercheur d’Afriques» и «Sur l’autre rive»; в 1993 году он получил Grand Prix de la Francophonie Французской академии.",
    evidence: [
      e("Académie française", "https://www.academie-francaise.fr/henri-lopes", "Французская академия подтверждает годы, литературную и дипломатическую деятельность, книги и Grand Prix de la Francophonie."),
      e("Organisation internationale de la Francophonie", "https://www.francophonie.org/sites/default/files/2023-11/CMF44_releve-decisions.pdf", "Межправительственная организация независимо подтверждает смерть 2 ноября 2023 года и государственные и международные должности Лопеса."),
    ],
    decision: "corrected",
    notes: "Общая оценка заменена конкретными должностями, тремя книгами и премией; неподтверждённый «Чёрный человек» удалён.",
  },
  {
    key: "republic_of_congo:jean_baptiste_tati_loutard",
    originalSha256: "cfa679d0cfbb16876f622560e5c200e89d0fcce30f04c455eed487c791c7d1d0",
    reviewedTextRu: "Жан-Батист Тати Лутар (1938–2009) — конголезский поэт, прозаик, преподаватель и государственный деятель. Среди его книг — «Les Normes du temps», «Le Récit de la mort» и «Chroniques congolaises»; в 1992 году он получил медаль Prix du Rayonnement de la langue et de la littérature françaises.",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb119260748", "Национальная библиотека Франции подтверждает годы, смерть 4 июля 2009 года в Париже, роли и библиографию Тати Лутара."),
      e("Académie française", "https://www.academie-francaise.fr/jean-baptiste-tati-loutard", "Французская академия независимо подтверждает произведения и медаль 1992 года."),
    ],
    decision: "corrected",
    notes: "Дата смерти исправлена с 12 на 4 июля и добавлен Париж; смешанное произведение удалено, добавлены три книги и точная медаль.",
  },
  {
    key: "republic_of_congo:jean_malonga",
    originalSha256: "df35b07dde1f28e8b2b8c9166647cf47fe6be6f9c4ec2151d9339a965faf9b82",
    reviewedTextRu: "Жан Малонга (1907–1985) — конголезский писатель и бывший сенатор, которого относят к основоположникам современной литературы Республики Конго. Его основные произведения — «Cœur d’Aryenne» и «La Légende de M’Pfoumou Ma Mazono».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb12175704k", "Национальная библиотека Франции подтверждает годы, писательскую идентичность и два произведения Малонги."),
      e("Sénat français", "https://www.senat.fr/senateur-4eme-republique/malonga_jean0127r4.html", "Официальный архив Сената независимо подтверждает биографию и сенаторскую деятельность; источники расходятся в точном дне смерти."),
    ],
    decision: "corrected",
    notes: "Сохранён только год смерти из-за расхождения 1 августа и 1 декабря; ошибочное «Сердце африканца» заменено двумя оригинальными названиями.",
  },
  {
    key: "republic_of_congo:sony_labou_tansi",
    originalSha256: "4fae9ad449ed6d25ecba669c0d58f94bcb0256759c141faec6f62b7ec464a36a",
    reviewedTextRu: "Сони Лабу Танси (1947–1995) — конголезский романист, драматург и поэт, основатель театра Rocado Zulu. Среди его произведений — романы «La Vie et demie» и «L’Anté-peuple», а также пьесы «La Parenthèse de sang» и «Je soussigné cardiaque».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb11910402v", "Национальная библиотека Франции подтверждает рождение 5 июня 1947 года в Киншасе, смерть в Браззавиле, жанры и библиографию."),
      e("Les Francophonies", "https://www.lesfrancophonies.fr/SONY-LABOU-TANSI", "Франкофонный театральный институт независимо подтверждает театр Rocado Zulu, романы и пьесы Танси."),
    ],
    decision: "corrected",
    notes: "Дата и место рождения исправлены; добавлено место смерти и театр, переводные заголовки заменены четырьмя оригинальными произведениями.",
  },
  {
    key: "republic_of_congo:sylvain_bemba",
    originalSha256: "31b77a8790d853d36eb6a7d862df1beccc73c91681bc66b06d5f9a060900c0b6",
    reviewedTextRu: "Сильвен Бемба (1934–1995) — конголезский прозаик, драматург, журналист и музыковед, родившийся в Сибити. Среди его произведений — «Le Soleil est parti à M’Pemba», «L’Homme qui tua le crocodile» и «Léopolis».",
    evidence: [
      e("Bibliothèque nationale de France", "https://catalogue.bnf.fr/ark:/12148/cb11891126r", "Национальная библиотека Франции подтверждает точные даты, Сибити, литературные и музыковедческую роли и библиографию Бембы."),
      e("Les Francophonies", "https://www.lesfrancophonies.fr/BEMBA-Sylvain", "Франкофонный театральный институт независимо подтверждает биографию, драматургию и произведения Бембы."),
    ],
    decision: "corrected",
    notes: "К ранее исправленной межстрановой идентичности добавлены точные даты, место смерти, дополнительные жанры и третье произведение.",
  },
] satisfies readonly ReviewSeed[];

export const writerBiographyFactReviewBatch45: readonly WriterBiographyFactReviewRecord[] =
  seeds.map((seed) => ({
    key: seed.key,
    originalSha256: seed.originalSha256,
    reviewedTextRu: seed.reviewedTextRu,
    applicableTextRu: seed.decision === "held" ? null : seed.reviewedTextRu,
    claims: [
      {
        textRu: seed.reviewedTextRu,
        verdict: seed.decision === "held" ? "not-established" : "corrected",
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
