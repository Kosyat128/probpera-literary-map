export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH16_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 16";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH16_REVIEWER;
const checkedAt = "2026-08-09";

type ReviewBase = Omit<WriterBiographyFactReviewRecord, "applicableTextRu">;

const writerBiographyFactReviewBatch16Base = [
  {
    key: "cape_verde:manuel_lopes",
    originalSha256: "7aa8ac374718a6488bc3b75cf7021f2bc1be319b8864cdae426c690e6b958225",
    reviewedTextRu: "Кабо-вердианский романист, поэт и эссеист, один из основателей журнала «Claridade». Автор романов «Chuva Braba» и «Os Flagelados do Vento Leste».",
    claims: [{
      textRu: "Мануэл Лопеш был кабо-вердианским романистом, поэтом и эссеистом, участвовал в основании Claridade и написал Chuva Braba и Os Flagelados do Vento Leste.",
      verdict: "corrected",
      evidence: [
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark:/12148/cb133220062", checkedAt, findingRu: "Авторитетная запись BnF подтверждает кабо-вердианскую принадлежность, литературные роли, даты жизни и участие Мануэла Лопеша в создании Claridade." },
        { provider: "Ministério da Educação de Cabo Verde", url: "https://minedu.gov.cv/media/manuais/2020/10/07/Caderno_Experimental_Hist%C3%B3ria_e_Geografia_de_Cabo_Verde_6%C2%BA_Ano.pdf", checkedAt, findingRu: "Учебное издание министерства связывает Лопеша с основанием Claridade и называет Chuva Braba и Os Flagelados do Vento Leste среди его произведений." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочная формула «ведущий автор движения» заменена документированными ролями, журналом и двумя романами. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:ovidio_martins",
    originalSha256: "e721b45e67ea88f12bd78cefccbde56e534bdd9847a5f112be7fd5b8a6dba1e8",
    reviewedTextRu: "Кабо-вердианский поэт, прозаик и журналист Овидиу де Соуза Мартинш. Один из основателей «Suplemento Cultural»; автор книги стихов «Caminhada» и сборника «Gritarei, berrarei, matarei, não vou para Pasárgada».",
    claims: [{
      textRu: "Овидиу де Соуза Мартинш был кабо-вердианским поэтом, прозаиком и журналистом, участвовал в основании Suplemento Cultural и издал Caminhada и Gritarei, berrarei, matarei, não vou para Pasárgada.",
      verdict: "corrected",
      evidence: [
        { provider: "RTP / Agência Lusa", url: "https://www.rtp.pt/noticias/cultura/ovidio-martins-poeta-e-ativista-cabo-verdiano-vai-ser-homenageado-em-lisboa_n478097", checkedAt, findingRu: "Материал RTP на основе сообщения семьи подтверждает полное имя, кабо-вердианскую идентичность, поэзию, основание Suplemento Cultural, второй сборник и точные даты 17 сентября 1928 — 29 апреля 1999." },
        { provider: "Universidade Federal de Santa Catarina", url: "https://literaturabrasileira.ufsc.br/autores?id=21505", checkedAt, findingRu: "Университетская авторская справка подтверждает роли поэта, прозаика и журналиста и атрибутирует Овидиу Мартиншу книгу Caminhada." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date recommendation: заменить shared birthDate 1928-08-17 на 1928-09-17 и deathDate 1999-01-01 на 1999-04-29. Общая формула заменена полным именем, ролями, объединением и книгами. Shared country files не изменялись.",
  },
  {
    key: "cape_verde:virgilio_de_lemos",
    originalSha256: "4117b59e78d89f7bb5249d31b2b2437b718c3ee8b8d37615d57dcf9736b89802",
    reviewedTextRu: "Мозамбикский поэт и журналист Виржилиу де Лемуш, публиковавшийся также под именем Дуарте Галван. Среди его книг — «Poemas do Tempo Presente», «Negra Azul» и «Eroticus Mozambicanus».",
    claims: [{
      textRu: "Виржилиу де Лемуш был мозамбикским поэтом и журналистом, использовал имя Дуарте Галван и написал Poemas do Tempo Presente, Negra Azul и Eroticus Mozambicanus.",
      verdict: "corrected",
      evidence: [
        { provider: "RTP Ensina", url: "https://ensina.rtp.pt/artigo/virgilio-de-lemos/", checkedAt, findingRu: "Образовательная служба RTP сообщает, что поэт родился на острове Ибо в Мозамбике, работал журналистом, использовал гетероним Duarte Galvão и перечисляет три названные книги." },
        { provider: "Universidade de São Paulo — Via Atlântica", url: "https://revistas.usp.br/viaatlantica/article/view/187858", checkedAt, findingRu: "Университетское литературоведческое издание рассматривает Виржилиу де Лемуша в контексте мозамбикской поэзии и подтверждает его авторскую идентичность." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Identity/country recommendation: карточка ошибочно помещена в Кабо-Верде; источник подтверждает рождение и литературную принадлежность Мозамбику. Рекомендуется перенести либо удалить дубль после проверки mozambique key. Shared country files не изменялись.",
  },
  {
    key: "central_african_republic:benoit_ndemba",
    originalSha256: "22a362cb1c4e98bc5308bae3c87e9c0075bf4d0e323c0bcb083ee676bd754f54",
    reviewedTextRu: "Личность автора «Бенуа Н’Демба» и приписанная ему центральноафриканская литературная биография не установлены по проверенным авторитетным каталогам. До появления авторитетной записи или документированной библиографии карточку нельзя применять как фактическую.",
    claims: [{
      textRu: "Не удалось установить литературную личность Benoît N’Demba как центральноафриканского писателя или поэта и найти документированную библиографию.",
      verdict: "not-established",
      evidence: [
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/rechercher.do?motRecherche=Beno%C3%AEt+N%27Demba&critereRecherche=0&depart=0&facetteModifiee=ok", checkedAt, findingRu: "Поиск точного имени в национальном библиотечном каталоге не выявил авторитетной записи или библиографии, позволяющей подтвердить карточку." },
        { provider: "IdRef — ABES", url: "https://www.idref.fr/Search?q=Beno%C3%AEt%20N%27Demba", checkedAt, findingRu: "Поиск во французской университетской сети авторитетных данных не дал идентифицируемой записи автора с указанным именем и биографией." },
      ],
    }],
    reviewer,
    decision: "held",
    notes: "Quarantine recommendation: удерживать карточку до появления институциональной authority record, произведения с надёжной атрибуцией или иной проверяемой идентификации; не угадывать личность. Shared country files не изменялись.",
  },
  {
    key: "central_african_republic:etienne_goyemide",
    originalSha256: "3ef60eb7e99f651d955d7285b900e1e07c23f25552fe130f92e21568acb007c7",
    reviewedTextRu: "Центральноафриканский писатель, драматург и педагог. Автор романов «Le Silence de la forêt» и «Le Dernier Survivant de la caravane».",
    claims: [{
      textRu: "Этьен Гойемиде был центральноафриканским писателем, драматургом и педагогом и написал Le Silence de la forêt и Le Dernier Survivant de la caravane.",
      verdict: "corrected",
      evidence: [
        { provider: "African Union Library", url: "https://library.au.int/le-silence-de-la-for%C3%AAt-2", checkedAt, findingRu: "Каталог библиотеки Африканского союза атрибутирует Этьену Гойемиде роман Le Silence de la forêt и связывает автора с Центральноафриканской Республикой." },
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark:/12148/cb37399180n", checkedAt, findingRu: "Каталог BnF атрибутирует Гойемиде роман Le Dernier Survivant de la caravane и фиксирует его авторскую идентичность." },
        { provider: "The Open University", url: "https://oro.open.ac.uk/5333/1/NJAS2006Ugochukwu.pdf", checkedAt, findingRu: "Университетское исследование характеризует Гойемиде как писателя ЦАР, драматурга, педагога и автора двух названных романов." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный ранг снят, сохранены подтверждённые профессии и добавлены два романа. Identity recommendation: одноимённая карточка cameroon:etienne_goyemide является страновым дублем и должна быть удалена либо перенесена после сверки. Shared country files не изменялись.",
  },
  {
    key: "chad:ahmat_taboye",
    originalSha256: "2ab5008a3acbb9cf10a45765beba85f5df4c21ef6df06e17d12c774b6e492bd4",
    reviewedTextRu: "Чадский писатель, литературовед и преподаватель Ахмад Табойе. Автор исследования «Panorama critique de la littérature tchadienne en langue française», романа «Le Patriarche» и пьесы «Au pays des démocrates ou “La débrouillardise”».",
    claims: [{
      textRu: "Ахмад Табойе — чадский писатель, литературовед и преподаватель, автор Panorama critique de la littérature tchadienne en langue française, Le Patriarche и Au pays des démocrates ou “La débrouillardise”.",
      verdict: "corrected",
      evidence: [
        { provider: "Éditions L’Harmattan", url: "https://www.editions-harmattan.fr/catalogue/auteur/ahmad-taboye/1566", checkedAt, findingRu: "Издательская страница подтверждает написание имени Ahmad Taboye, чадскую принадлежность, литературные и преподавательские роли и атрибутирует три названные книги." },
        { provider: "Radio France Internationale", url: "https://www1.rfi.fr/fichiers/MFI/CultureSociete/1111.asp", checkedAt, findingRu: "RFI подтверждает преподавательскую и литературоведческую работу Ахмада Табойе и авторство Panorama critique de la littérature tchadienne en langue française." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Name recommendation: отображать Ahmad Taboye / Ахмад Табойе вместо Ahmat; роль поэта в выбранных источниках не подтверждена и снята. Год рождения 1959 авторитетно не установлен, поэтому изменение даты не рекомендуется. Shared country files не изменялись.",
  },
  {
    key: "chad:felix_tchikaya",
    originalSha256: "aa95a4f5cf632535726de84e4b9088641c13733c7622fe3e5b5068b0b56346b0",
    reviewedTextRu: "Личность чадского автора «Феликс Чикая», якобы родившегося в 1955 году, по проверенным источникам не установлена. Карточку нельзя отождествлять с конголезским поэтом Тчикайей У Там’си (Жераль-Феликс Чикая, 1931–1988).",
    claims: [{
      textRu: "Указанная карточка не установлена как отдельный чадский автор; близкое имя принадлежит конголезскому поэту Тчикайе У Там’си, жившему в 1931–1988 годах.",
      verdict: "not-established",
      evidence: [
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark:/12148/cb11887681h", checkedAt, findingRu: "BnF связывает варианты Gérald-Félix Tchikaya и Félix Tchicaya с псевдонимом Tchicaya U Tam’si, Республикой Конго и датами 1931–1988, а не с чадским автором 1955 года рождения." },
        { provider: "Encyclopédie Larousse", url: "https://www.larousse.fr/encyclopedie/personnage/G%C3%A9rald_Tchicaya_U_TamSi/146172", checkedAt, findingRu: "Энциклопедия независимо идентифицирует Жераль-Феликса Чикаю как конголезского поэта Тчикайю У Там’си и приводит даты 1931–1988." },
      ],
    }],
    reviewer,
    decision: "held",
    notes: "Quarantine recommendation: вероятна контаминация с Tchicaya U Tam’si; удерживать, не подменять личность и не публиковать как отдельного чадского автора без независимой authority record. Shared country files не изменялись.",
  },
  {
    key: "chad:koulsy_lamko",
    originalSha256: "701e8edd04e17640a3030236b88c952b7f6b98d7b359186026a2428d983c5e00",
    reviewedTextRu: "Чадский драматург, поэт и прозаик, родившийся в Дадуаре в 1959 году. Автор пьес «N’do kela ou l’Initiation avortée» и «Tout bas… si bas», а также романа «La Phalène des collines».",
    claims: [{
      textRu: "Кулси Ламко — родившийся в Дадуаре в 1959 году чадский драматург, поэт и прозаик, автор N’do kela ou l’Initiation avortée, Tout bas… si bas и La Phalène des collines.",
      verdict: "corrected",
      evidence: [
        { provider: "Casa África", url: "https://www.casafrica.es/es/persona/koulsy-lamko", checkedAt, findingRu: "Испанское государственное учреждение культурной дипломатии подтверждает место и год рождения, чадскую идентичность, литературные роли и библиографию Ламко." },
        { provider: "Éditions Philippe Rey", url: "https://www.philippe-rey.fr/auteur-Koulsy_Lamko-167-1-1-0-1.html", checkedAt, findingRu: "Издательская биография независимо подтверждает рождение Ламко в Чаде в 1959 году, его работу драматурга, поэта и романиста и атрибутирует ему La Phalène des collines." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Исходные роли сохранены и дополнены проверяемыми местом и годом рождения и тремя произведениями. Shared country files не изменялись.",
  },
  {
    key: "chad:nimrod",
    originalSha256: "2ec58087052df4a92770728db9a4a71aff17604b7d81f36226a88c0e4fc030ef",
    reviewedTextRu: "Нимрод — литературный псевдоним чадского поэта, романиста и эссеиста Нимрода Бена Джангранга. Автор романов «Les Jambes d’Alice», «Le Départ» и «Le Bal des princes».",
    claims: [{
      textRu: "Нимрод Бена Джангранг — чадский поэт, романист и эссеист, публикующийся как Нимрод и написавший Les Jambes d’Alice, Le Départ и Le Bal des princes.",
      verdict: "corrected",
      evidence: [
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark:/12148/cb12057710d", checkedAt, findingRu: "Авторитетная запись BnF подтверждает настоящее имя, псевдоним, чадскую принадлежность и роли поэта, романиста и эссеиста." },
        { provider: "Actes Sud", url: "https://actes-sud.fr/contributeurs/nimrod", checkedAt, findingRu: "Издательская биография независимо подтверждает происхождение и литературные роли Нимрода и перечисляет три названных романа." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Недоказательный ранг снят; добавлены настоящее имя, статус псевдонима и три романа. Shared country files не изменялись.",
  },
  {
    key: "chile:alberto_blest_gana",
    originalSha256: "a4567cd954f43d1dde6c9e5fe0ac182d21ecebe4a1cd7233b7b0441e1fac96ce",
    reviewedTextRu: "Чилийский романист и дипломат, чья проза развивалась в русле социального реализма. Автор романов «Martín Rivas», «Durante la Reconquista» и «El loco Estero».",
    claims: [{
      textRu: "Альберто Блест Гана был чилийским романистом и дипломатом, работал в русле социального реализма и написал Martín Rivas, Durante la Reconquista и El loco Estero.",
      verdict: "corrected",
      evidence: [
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3273.html", checkedAt, findingRu: "Национальная библиотека Чили подтверждает романную прозу Блеста Ганы, реалистическое направление, дипломатическую карьеру, три произведения и рождение 4 мая 1830 года." },
        { provider: "Universidad de Chile — Revista Chilena de Literatura", url: "https://www.revistas.uchile.cl/index.php/RCL/article/view/47629", checkedAt, findingRu: "Университетское литературоведческое исследование рассматривает реалистические романы Блеста Ганы и подтверждает его место в истории чилийского романа." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочная формула «отец чилийского романа» снята. Date recommendation: сохранить shared birthDate 1830-05-04 — её прямо подтверждает Национальная библиотека Чили; значение Wikidata 1830-06-14 отвергнуть. Точная дата смерти в проверенных источниках расходится или не детализирована, поэтому изменение deathDate не предлагается. Shared country files не изменялись.",
  },
  {
    key: "chile:alejandra_costamagna",
    originalSha256: "aa4274546d368e3844ea9e41626e5970e6b82300dc07f44c783de04bd0dcf68b",
    reviewedTextRu: "Чилийская писательница, журналистка и исследовательница литературы. Автор романов «En voz baja» и «El sistema del tacto», а также сборника рассказов «Últimos fuegos».",
    claims: [{
      textRu: "Алехандра Костаманьи — чилийская писательница, журналистка и исследовательница литературы, автор En voz baja, El sistema del tacto и Últimos fuegos.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad Diego Portales", url: "https://centroparalashumanidades.udp.cl/equipo/alejandra-costamagna/", checkedAt, findingRu: "Университетская биография подтверждает литературную, журналистскую и исследовательскую деятельность Костаманьи и перечисляет её книги." },
        { provider: "Universidad de Chile — Palabra Pública", url: "https://palabrapublica.uchile.cl/author/alejandra-costamagna/", checkedAt, findingRu: "Авторская страница университета независимо подтверждает чилийскую идентичность и писательскую и журналистскую работу Костаманьи." },
        { provider: "Editorial Anagrama", url: "https://www.anagrama-ed.es/libro/narrativas-hispanicas/el-sistema-del-tacto/9788433998651/NH_617", checkedAt, findingRu: "Издатель атрибутирует Костаманьи роман El sistema del tacto и приводит библиографические сведения о книге." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективная заметность и интерпретация тем заменены тремя подтверждёнными ролями и библиографией. Shared country files не изменялись.",
  },
  {
    key: "chile:alejandro_jodorowsky_chile",
    originalSha256: "8e2cc92c718ac06ae2b1da7ee9d26901df4e51694bbfef88104f4990389783a3",
    reviewedTextRu: "Родившийся в чилийском Икике писатель, поэт, кинорежиссёр и сценарист комиксов Алехандро Ходоровски. Режиссёр фильмов «El Topo» и «The Holy Mountain» и сценарист цикла комиксов «The Incal».",
    claims: [{
      textRu: "Алехандро Ходоровски родился в Икике, работает как писатель, поэт, кинорежиссёр и сценарист комиксов, снял El Topo и The Holy Mountain и написал сценарий The Incal.",
      verdict: "corrected",
      evidence: [
        { provider: "Bibliothèque nationale de France", url: "https://catalogue.bnf.fr/ark:/12148/cb11908875w", checkedAt, findingRu: "Авторитетная запись BnF подтверждает рождение Ходоровского в Икике и его роли писателя, поэта, режиссёра и сценариста комиксов." },
        { provider: "Éditions Glénat", url: "https://www.glenat.com/auteur/alejandro-jodorowsky", checkedAt, findingRu: "Издательская биография подтверждает кинематографическую работу Ходоровского, фильмы El Topo и The Holy Mountain и его деятельность в комиксах, включая The Incal." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Недоказательные формулы о национальном авангарде и двойной национальности заменены местом рождения, видами деятельности и конкретными работами. Shared country files не изменялись.",
  },
  {
    key: "chile:alejandro_zambra",
    originalSha256: "23314da138606c51a4f69b514237f159960db09ad92a4e186d9810a9d1a7fd4c",
    reviewedTextRu: "Чилийский писатель, поэт и литературный критик. Автор романов «Bonsái», «La vida privada de los árboles», «Formas de volver a casa» и «Poeta chileno».",
    claims: [{
      textRu: "Алехандро Самбра — чилийский писатель, поэт и литературный критик, автор Bonsái, La vida privada de los árboles, Formas de volver a casa и Poeta chileno.",
      verdict: "corrected",
      evidence: [
        { provider: "Editorial Anagrama", url: "https://www.anagrama-ed.es/autor/zambra-alejandro-1146", checkedAt, findingRu: "Издательская авторская страница подтверждает чилийское происхождение, литературные роли Самбры и перечисляет названные романы." },
        { provider: "Radio Universidad de Chile", url: "https://radio.uchile.cl/2020/07/10/alejandro-zambra-mi-horizonte-de-referencia-siempre-ha-sido-la-poesia/", checkedAt, findingRu: "Университетское интервью подтверждает писательскую и поэтическую деятельность Самбры и обсуждает его роман Poeta chileno." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективный международный ранг и общая характеристика стиля заменены ролями и четырьмя романами. Shared country files не изменялись.",
  },
  {
    key: "chile:baldomero_lillo",
    originalSha256: "2c7978ea3c896199f6923b52cba22d9c72d85d3a405cdfe898af23a7d19cbb4f",
    reviewedTextRu: "Чилийский прозаик, писавший о шахтёрах, сельских жителях и морских рабочих. Автор сборников рассказов «Sub-terra» (1904) и «Sub-sole» (1907).",
    claims: [{
      textRu: "Бальдомеро Лильо был чилийским прозаиком, изображавшим шахтёров, сельских жителей и морских рабочих, и издал сборники Sub-terra в 1904 году и Sub-sole в 1907 году.",
      verdict: "corrected",
      evidence: [
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3313.html", checkedAt, findingRu: "Национальная библиотека Чили подтверждает биографию Лильо, социальные группы в его рассказах и атрибутирует ему Sub-terra и Sub-sole." },
        { provider: "Pontificia Universidad Católica de Chile", url: "https://www.revistadisena.uc.cl/index.php/alch/article/download/51529/42137/142147", checkedAt, findingRu: "Университетское исследование независимо фиксирует Sub-terra (1904) и Sub-sole (1907) как два книжных сборника автора." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Субъективный ранг среди латиноамериканских рассказчиков снят; тематика уточнена и добавлены два датированных сборника. Shared country files не изменялись.",
  },
  {
    key: "chile:diamela_eltit",
    originalSha256: "dda165d305a48822ceff7311c98f59fd358497ba3012b9a1cff9553d1a9b8edc",
    reviewedTextRu: "Чилийская писательница и эссеистка, участница художественного коллектива CADA. Автор романов «Lumpérica», «Por la patria» и «El cuarto mundo»; в 2018 году получила Национальную премию Чили по литературе.",
    claims: [{
      textRu: "Диамела Эльтит — чилийская писательница и эссеистка, участница CADA, автор Lumpérica, Por la patria и El cuarto mundo и лауреат Национальной премии Чили по литературе 2018 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad de Chile", url: "https://uchile.cl/presentacion/historia/grandes-figuras/premios-nacionales/literatura/diamela-eltit-gonzalez", checkedAt, findingRu: "Официальная университетская биография подтверждает роли Эльтит, участие в CADA, три романа, премию и дату рождения 24 августа 1949 года." },
        { provider: "Ministerio de las Culturas, las Artes y el Patrimonio de Chile", url: "https://www.cultura.gob.cl/institucional/ministra-de-las-culturas-anuncia-a-diamela-eltit-como-la-ganadora-del-premio-nacional-de-literatura-2018/", checkedAt, findingRu: "Министерство подтверждает присуждение Эльтит Национальной премии по литературе в 2018 году и её писательскую и эссеистическую деятельность." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Date recommendation: сохранить shared birthDate 1949-08-24; её подтверждают Universidad de Chile и Memoria Chilena, а значение Wikidata 1947-08-24 отвергнуть. Исходная интерпретация тем заменена коллективом, романами и премией. Shared country files не изменялись.",
  },
  {
    key: "chile:gabriela_mistral",
    originalSha256: "5723047b5d0cb6f3e99a78104cf5d0ea5d5a236ab57803611ae895c6bf0ae7ee",
    reviewedTextRu: "Габриэла Мистраль — псевдоним чилийской поэтессы, педагога и дипломата Лусилы Годой Алькаяги. Автор сборников «Desolación», «Ternura» и «Tala»; в 1945 году стала первым лауреатом Нобелевской премии по литературе из Южной Америки.",
    claims: [{
      textRu: "Габриэла Мистраль — псевдоним чилийской поэтессы, педагога и дипломата Лусилы Годой Алькаяги, автора Desolación, Ternura и Tala и первого южноамериканского лауреата Нобелевской премии по литературе 1945 года.",
      verdict: "corrected",
      evidence: [
        { provider: "The Nobel Prize", url: "https://www.nobelprize.org/prizes/literature/1945/mistral/facts/", checkedAt, findingRu: "Официальная нобелевская справка подтверждает полное имя, псевдоним, литературную и дипломатическую деятельность, премию 1945 года и статус первого южноамериканского лауреата по литературе." },
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3429.html", checkedAt, findingRu: "Национальная библиотека Чили подтверждает чилийскую идентичность, педагогическую деятельность и библиографию Мистраль, включая Desolación, Ternura и Tala." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Тематическая интерпретация заменена полным именем, статусом псевдонима, тремя сборниками и точной формулировкой нобелевского первенства. Shared country files не изменялись.",
  },
  {
    key: "chile:hernan_rivera_letelier",
    originalSha256: "6a3860d4952f6c75079bbbaf3094453f13144a32e7d3bd9a58bc271f8e3b7c82",
    reviewedTextRu: "Чилийский писатель, чьи романы обращены к жизни селитряных посёлков и жителей севера страны. Автор «La Reina Isabel cantaba rancheras» и «Santa María de las flores negras»; в 2022 году получил Национальную премию Чили по литературе.",
    claims: [{
      textRu: "Эрнан Ривера Летельер — чилийский романист, пишущий о селитряных посёлках и севере страны, автор La Reina Isabel cantaba rancheras и Santa María de las flores negras и лауреат Национальной премии по литературе 2022 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Ministerio de las Culturas, las Artes y el Patrimonio de Chile", url: "https://www.cultura.gob.cl/actualidad/hernan-rivera-letelier-recibe-el-premio-nacional-de-literatura-2022/", checkedAt, findingRu: "Министерство подтверждает биографическую связь Риверы Летельера с селитряными районами, его литературную работу и Национальную премию 2022 года." },
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-propertyvalue-736142.html", checkedAt, findingRu: "Национальная библиотека Чили подтверждает авторство двух названных романов и устойчивую тематику селитряных поселений севера страны." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Общая социальная интерпретация заменена документированной региональной тематикой, двумя романами и премией. Exact shared birthDate 1950-07-11 в выбранных институциональных источниках не подтверждена; изменения даты не предлагаются. Shared country files не изменялись.",
  },
  {
    key: "chile:isabel_allende",
    originalSha256: "473d51361617ed9df56062078f3a604215af54b74eb4ac4a8936eb23d55fd717",
    reviewedTextRu: "Чилийская писательница, родившаяся в Лиме. Автор романов «La casa de los espíritus», «De amor y de sombra» и «Eva Luna»; в 2010 году получила Национальную премию Чили по литературе.",
    claims: [{
      textRu: "Исабель Альенде — чилийская писательница, родившаяся в Лиме, автор La casa de los espíritus, De amor y de sombra и Eva Luna и лауреат Национальной премии Чили по литературе 2010 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-100654.html", checkedAt, findingRu: "Национальная библиотека Чили подтверждает рождение Альенде в Лиме 2 августа 1942 года, чилийскую литературную идентичность, три романа и премию 2010 года." },
        { provider: "Ministerio de las Culturas, las Artes y el Patrimonio de Chile", url: "https://www.cultura.gob.cl/premiosnacionales/", checkedAt, findingRu: "Официальный перечень министерства фиксирует Исабель Альенде как лауреата Национальной премии по литературе 2010 года." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Мировая известность и жанровая интерпретация заменены местом рождения, тремя романами и государственной премией. Shared birthDate 1942-08-02 подтверждена и сохраняется. Shared country files не изменялись.",
  },
  {
    key: "chile:jose_donoso",
    originalSha256: "2a9a406366f229da7cb9cd803f4ff62e558c4fcbb40d195042fa749bf092aed0",
    reviewedTextRu: "Чилийский романист, связанный с поколением латиноамериканского литературного бума. Автор романов «El lugar sin límites», «El obsceno pájaro de la noche» и «Casa de campo»; в 1990 году получил Национальную премию Чили по литературе.",
    claims: [{
      textRu: "Хосе Доносо был чилийским романистом поколения латиноамериканского бума, написал El lugar sin límites, El obsceno pájaro de la noche и Casa de campo и получил Национальную премию Чили по литературе 1990 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3477.html", checkedAt, findingRu: "Национальная библиотека Чили связывает Доносо с латиноамериканским бумом и подтверждает его авторство трёх названных романов." },
        { provider: "Universidad de Chile", url: "https://uchile.cl/presentacion/historia/grandes-figuras/premios-nacionales/literatura/jose-donoso-yanez", checkedAt, findingRu: "Университетская биография подтверждает чилийскую романную прозу Доносо и присуждение ему Национальной премии по литературе в 1990 году." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Оценочный ранг и широкая интерпретация тем заменены литературным поколением, тремя романами и премией. Shared country files не изменялись.",
  },
  {
    key: "chile:jose_miguel_varas",
    originalSha256: "d31925c92b98f90ba32afd3365bb688196ac96cea1036a3455d37cc1dc1f6aad",
    reviewedTextRu: "Чилийский писатель и журналист, работавший в жанрах романа, рассказа, биографии и хроники. Автор книг «Sucede», «Chacón» и «Lugares comunes»; в 2006 году получил Национальную премию Чили по литературе.",
    claims: [{
      textRu: "Хосе Мигель Варас был чилийским писателем и журналистом, работал в жанрах романа, рассказа, биографии и хроники, написал Sucede, Chacón и Lugares comunes и получил Национальную премию по литературе 2006 года.",
      verdict: "corrected",
      evidence: [
        { provider: "Universidad de Chile", url: "https://uchile.cl/noticias/27666/jose-miguel-varas-galardonado-con-el-premio-nacional-de-literatura-", checkedAt, findingRu: "Университетская биография подтверждает писательскую и журналистскую работу Вараса, названные жанры и книги и Национальную премию 2006 года." },
        { provider: "Memoria Chilena — Biblioteca Nacional de Chile", url: "https://www.memoriachilena.gob.cl/602/w3-article-3481.html", checkedAt, findingRu: "Национальная библиотека Чили независимо подтверждает биографию, журналистскую деятельность и библиографию Вараса." },
      ],
    }],
    reviewer,
    decision: "corrected",
    notes: "Общая тематическая характеристика заменена документированными жанрами, тремя книгами и премией. Shared country files не изменялись.",
  },
] satisfies readonly ReviewBase[];

function finalizeReviewRecord(record: ReviewBase): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu: record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch16: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch16Base.map(finalizeReviewRecord);
