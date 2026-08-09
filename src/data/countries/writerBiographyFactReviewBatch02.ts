export const WRITER_BIOGRAPHY_FACT_REVIEW_BATCH02_REVIEWER =
  "Codex independent claim-by-claim factual review, batch 02";

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

const reviewer = WRITER_BIOGRAPHY_FACT_REVIEW_BATCH02_REVIEWER;
const checkedAt = "2026-08-09";

const writerBiographyFactReviewBatch02Base = [
  {
    key: "argentina:andres_neuman",
    originalSha256:
      "92d5d7d8e0b55b3f6ca4bc2ec9f0b3024012b049766815a43975988290404f68",
    reviewedTextRu:
      "Аргентинско-испанский писатель и поэт, лауреат премии «Альфагуара» 2009 года.",
    claims: [
      {
        textRu: "Андрес Нейман — аргентинско-испанский писатель и поэт.",
        verdict: "supported",
        evidence: [
          {
            provider: "Институт Сервантеса",
            url: "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/neuman_andres.htm",
            checkedAt,
            findingRu:
              "Биографическая справка подтверждает рождение в Буэнос-Айресе, жизнь в Испании и работу в прозе и поэзии.",
          },
        ],
      },
      {
        textRu:
          "Субъективная оценка заметности заменена проверяемым достижением: Нейман получил премию «Альфагуара» в 2009 году.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Институт Сервантеса",
            url: "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/neuman_andres.htm",
            checkedAt,
            findingRu:
              "Биографическая справка фиксирует присуждение премии «Альфагуара» за роман «Путешественник века» в 2009 году.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочный рейтинг заменён датированным фактом о литературной премии.",
  },
  {
    key: "argentina:cesar_aira",
    originalSha256:
      "5955f9fe3b405294282794b10cef99092b91ad930ed55d8fda13937fd204edcc",
    reviewedTextRu:
      "Аргентинский писатель и переводчик, автор более ста книг. Известен экспериментальной прозой и короткими романами.",
    claims: [
      {
        textRu: "Сесар Айра — аргентинский писатель и переводчик.",
        verdict: "supported",
        evidence: [
          {
            provider: "New Directions Publishing",
            url: "https://www.ndbooks.com/author/cesar-aira/",
            checkedAt,
            findingRu:
              "Издательская биография прямо подтверждает аргентинское происхождение, писательскую и переводческую работу.",
          },
        ],
      },
      {
        textRu:
          "Сравнительная оценка продуктивности заменена измеримым фактом: Айра написал более ста книг; значительную часть составляют короткие романы.",
        verdict: "corrected",
        evidence: [
          {
            provider: "New Directions Publishing",
            url: "https://www.ndbooks.com/author/cesar-aira/",
            checkedAt,
            findingRu:
              "Профиль отмечает более ста книг, преимущественно небольшие романы, и характеризует автора как одного из наиболее продуктивных в Аргентине.",
          },
          {
            provider: "Penguin Random House Grupo Editorial",
            url: "https://www.penguinlibros.com/es/990-cesar-aira",
            checkedAt,
            findingRu:
              "Издатель подтверждает обширную библиографию, переводы и международное распространение произведений.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив заменён проверяемым количеством книг; жанровая характеристика сохранена.",
  },
  {
    key: "argentina:claudia_pineiro",
    originalSha256:
      "ad14afe57b4ee78afaa7a13fac20dee30d7fab236a6bfbdd89424a97e28eb21b",
    reviewedTextRu:
      "Аргентинская писательница, драматург и сценарист, чьи романы издаются и переводятся за пределами Аргентины.",
    claims: [
      {
        textRu:
          "Клаудия Пиньейро — аргентинская писательница, драматург и сценарист.",
        verdict: "supported",
        evidence: [
          {
            provider: "Penguin Random House Grupo Editorial",
            url: "https://www.penguinlibros.com/es/2196-claudia-pineiro",
            checkedAt,
            findingRu:
              "Авторский профиль подтверждает литературную, драматургическую и сценарную деятельность.",
          },
        ],
      },
      {
        textRu:
          "Субъективная оценка известности заменена проверяемым международным распространением романов Пиньейро.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Министерство культуры Аргентины",
            url: "https://www.cultura.gob.ar/noticias/en-mis-novelas-siempre-hay-un-guino-a-galicia/",
            checkedAt,
            findingRu:
              "Государственная публикация подтверждает, что Пиньейро относится к широко переводимым и издаваемым за рубежом аргентинским авторам.",
          },
          {
            provider: "Институт Сервантеса",
            url: "https://cultura.cervantes.es/portoalegre/es/claudia-pi%C3%B1eiro-en-la-70%C2%AA-feria-del-libro-de-porto-alegre/172796",
            checkedAt,
            findingRu:
              "Институт подтверждает международное распространение и признание её литературных произведений.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив заменён проверяемым фактом об издании и переводах книг за рубежом.",
  },
  {
    key: "argentina:domingo_faustino_sarmiento",
    originalSha256:
      "1fbe0bd2d33f3439e86ee0fd628e2e631a8d9d5be9184b2d7e5c63a7619dd53e",
    reviewedTextRu:
      "Аргентинский писатель, педагог и политический деятель, занимавший пост президента Аргентины с 1868 по 1874 год. Автор «Факундо», одной из ключевых книг аргентинской литературы.",
    claims: [
      {
        textRu:
          "Доминго Фаустино Сармьенто был аргентинским писателем, педагогом, политическим деятелем и президентом Аргентины.",
        verdict: "supported",
        evidence: [
          {
            provider: "Правительство Аргентины",
            url: "https://www.argentina.gob.ar/node/492106",
            checkedAt,
            findingRu:
              "Официальная справка подтверждает президентство в 1868–1874 годах, педагогическую, политическую и писательскую деятельность.",
          },
        ],
      },
      {
        textRu:
          "Недоказанная сравнительная оценка заменена проверяемыми фактами: Сармьенто — автор «Факундо», одной из ключевых книг аргентинской литературы.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Центр виртуального Сервантеса",
            url: "https://cvc.cervantes.es/literatura/quijote_america/argentina/notas.htm",
            checkedAt,
            findingRu:
              "Биобиблиографическая справка называет «Факундо» одной из фундаментальных книг Аргентины и подтверждает авторство Сармьенто.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Недоказанный сравнительный суперлатив заменён датами президентства и проверяемым значением «Факундо»; новая формулировка пригодна к применению.",
  },
  {
    key: "argentina:ernesto_sabato",
    originalSha256:
      "44a635945101e876768dce9a130ccfa21f0e4a81164b76091d5d320e1879dddd",
    reviewedTextRu:
      "Аргентинский писатель, эссеист и физик. Его роман «Туннель» исследует одиночество и духовный кризис современного человека; в 1984 году Сабато получил премию Сервантеса.",
    claims: [
      {
        textRu: "Эрнесто Сабато — аргентинский писатель, эссеист и физик.",
        verdict: "supported",
        evidence: [
          {
            provider: "Институт Сервантеса",
            url: "https://cultura.cervantes.es/londres/es/ernesto-s%C3%A1bato/159606",
            checkedAt,
            findingRu:
              "Институциональная справка подтверждает аргентинское происхождение, писательскую и физическую подготовку.",
          },
          {
            provider: "Архивы Национального университета Ла-Платы",
            url: "https://atom.sedici.unlp.edu.ar/index.php/sabato-ernesto",
            checkedAt,
            findingRu:
              "Университетская архивная запись отдельно подтверждает заметную эссеистическую работу Сабато.",
          },
        ],
      },
      {
        textRu:
          "Недоказанная сравнительная оценка заменена проверяемым фактом: в 1984 году Сабато получил премию Сервантеса.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Институт Сервантеса",
            url: "https://cultura.cervantes.es/londres/es/ernesto-s%C3%A1bato/159606",
            checkedAt,
            findingRu:
              "Институциональная биография подтверждает присуждение Сабато премии Сервантеса в 1984 году.",
          },
        ],
      },
      {
        textRu:
          "Обобщение о всех романах заменено проверяемой характеристикой «Туннеля»: роман исследует одиночество и духовный кризис современного человека.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Центр виртуального Сервантеса",
            url: "https://cvc.cervantes.es/actcult/obras/literatura_xx/descripcion_obras.htm",
            checkedAt,
            findingRu:
              "Описание произведения прямо связывает «Туннель» с одиночеством, отчуждением и духовным кризисом современности.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Широкий рейтинг и тематическое обобщение заменены проверяемыми фактами о «Туннеле» и премии Сервантеса; новая формулировка пригодна к применению.",
  },
  {
    key: "argentina:esteban_echeverria",
    originalSha256:
      "fcbdec5f3838eac83fdb74b94368f2063f8d6ee8eb7c63b5a410daee5cd14bad",
    reviewedTextRu:
      "Аргентинский писатель и поэт, один из основателей романтизма в аргентинской литературе.",
    claims: [
      {
        textRu: "Эстебан Эчеверрия — аргентинский писатель и поэт.",
        verdict: "supported",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/noticias/2-de-septiembre-de-1805-nace-esteban-echeverria",
            checkedAt,
            findingRu:
              "Национальная библиотека характеризует Эчеверрию как поэта и прозаика аргентинской традиции.",
          },
        ],
      },
      {
        textRu:
          "Эчеверрия стоял у истоков романтизма в аргентинской литературе.",
        verdict: "supported",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/noticias/2-de-septiembre-de-1805-nace-esteban-echeverria",
            checkedAt,
            findingRu:
              "Библиотечная справка связывает с ним введение романтизма в Аргентине и начало современной национальной литературы.",
          },
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes: "Короткая формулировка полностью подтверждена национальной библиотекой.",
  },
  {
    key: "argentina:jorge_luis_borges",
    originalSha256:
      "a3a0d7ba0450bec493eecd2be628169de3d763ef2503b3aea1ef0ab38bc4d508",
    reviewedTextRu:
      "Аргентинский писатель, поэт и эссеист XX века. Его проза соединяет фантастические и философские мотивы и повлияла на развитие постмодернизма.",
    claims: [
      {
        textRu:
          "Субъективные суперлативы заменены нейтральной профессиональной характеристикой: Борхес — аргентинский писатель, поэт и эссеист XX века.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/agenda-cultural/el-metodo-borges",
            checkedAt,
            findingRu:
              "Национальная библиотека подтверждает жанровый диапазон и исключительную международную влиятельность Борхеса в литературе XX века.",
          },
        ],
      },
      {
        textRu:
          "Творчество Борхеса существенно повлияло на фантастическую, постмодернистскую и философскую прозу.",
        verdict: "supported",
        evidence: [
          {
            provider: "Институт Сервантеса",
            url: "https://cultura.cervantes.es/estocolmo/es/Entrevista-a-Jorge-Luis-Borges/133519",
            checkedAt,
            findingRu:
              "Институт называет Борхеса ключевой фигурой литературы XX века и связывает его прозу с фантастикой, метафизикой и философскими вопросами.",
          },
          {
            provider: "Центр виртуального Сервантеса",
            url: "https://cvc.cervantes.es/literatura/tradicion_rupturas/eisemann.htm",
            checkedAt,
            findingRu:
              "Литературоведческий материал рассматривает Борхеса в связи с метаповествованием и формированием постмодернистской практики.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Слова «великий», «самый влиятельный» и «огромное» сняты; сохранены проверяемые роль, мотивы и влияние.",
  },
  {
    key: "argentina:julio_cortazar",
    originalSha256:
      "e1a646967ffae22fd0f6bac7c0064b04ecaee8f97e4efe413ce5cc84cc006f87",
    reviewedTextRu:
      "Аргентинский писатель и переводчик, чьи произведения стали частью латиноамериканского литературного бума. Его творчество сочетает экспериментальную форму, фантастику и философскую проблематику.",
    claims: [
      {
        textRu: "Хулио Кортасар — аргентинский писатель и переводчик.",
        verdict: "supported",
        evidence: [
          {
            provider: "Институт Сервантеса",
            url: "https://www.cervantes.es/bibliotecas_documentacion_espanol/creadores/cortazar_julio.htm",
            checkedAt,
            findingRu:
              "Биография подтверждает писательскую деятельность и профессиональную переводческую работу, включая работу для ЮНЕСКО.",
          },
        ],
      },
      {
        textRu:
          "Сравнительный суперлатив заменён проверяемой связью творчества Кортасара с латиноамериканским бумом; формальный эксперимент и фантастика подтверждены отдельно.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/micrositios/admin_assets/issues/files/2f4c33e1aca8b1b5f32df6b303e97a25.pdf",
            checkedAt,
            findingRu:
              "Выставочный каталог национальной библиотеки фиксирует центральное место Кортасара в латиноамериканском литературном буме.",
          },
          {
            provider: "Центр виртуального Сервантеса",
            url: "https://cvc.cervantes.es/actcult/obras/literatura_xx/descripcion_autores.htm",
            checkedAt,
            findingRu:
              "Справка описывает жанровый и формальный эксперимент, сюрреалистические и фантастические элементы его прозы.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Сравнительный рейтинг снят; историко-литературная принадлежность и особенности прозы сохранены.",
  },
  {
    key: "argentina:manuel_puig",
    originalSha256:
      "3ad8b8034f4da8605bd3ab700bffad636a0f35c3d33091f3b6d96b20ab2ed23e",
    reviewedTextRu:
      "Аргентинский писатель второй половины XX века. В прозе соединял элементы массовой культуры, кино и разговорной речи.",
    claims: [
      {
        textRu:
          "Субъективная оценка оригинальности заменена нейтральным фактом: Мануэль Пуиг — аргентинский писатель второй половины XX века.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/noticias/28-de-diciembre-de-1932-nace-manuel-puig",
            checkedAt,
            findingRu:
              "Национальная библиотека называет Пуига центральной и оригинальной фигурой аргентинской литературы его времени.",
          },
        ],
      },
      {
        textRu:
          "В прозе Пуига соединены массовая культура, кино и разговорная речь.",
        verdict: "supported",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/noticias/la-biblioteca-nacional-recuerda-a-manuel-puig-1932-1990",
            checkedAt,
            findingRu:
              "Библиотечная публикация подтверждает использование кино, радиосериалов, популярной культуры и разговорных голосов.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Субъективный рейтинг снят; подтверждённые художественные приёмы сохранены.",
  },
  {
    key: "argentina:mariana_enriquez",
    originalSha256:
      "8e1628509fcaf4b146b4770392e50ca99cbe9b5a628f20f2ce0fd37a61c03ec3",
    reviewedTextRu:
      "Аргентинская писательница и журналистка, лауреат премии Эрральде 2019 года. Известна мрачной прозой, сочетающей социальные темы и элементы хоррора.",
    claims: [
      {
        textRu: "Мариана Энрикес — аргентинская писательница и журналистка.",
        verdict: "supported",
        evidence: [
          {
            provider: "Фонд Букеровской премии",
            url: "https://thebookerprizes.com/the-booker-library/authors/mariana-enriquez",
            checkedAt,
            findingRu:
              "Премиальный профиль подтверждает аргентинское происхождение и работу как прозаика, автора рассказов и журналиста.",
          },
        ],
      },
      {
        textRu:
          "Оценка положения в литературе заменена проверяемой премией Эрральде 2019 года; мрачная проза, социальный контекст и хоррор подтверждены отдельно.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Editorial Anagrama",
            url: "https://www.anagrama-ed.es/autor/enriquez-mariana-1418",
            checkedAt,
            findingRu:
              "Издатель фиксирует крупные международные награды, переводы более чем на тридцать языков и устойчивую связь прозы с тёмной фантастической традицией.",
          },
          {
            provider: "Фонд Букеровской премии",
            url: "https://thebookerprizes.com/the-booker-library/authors/mariana-enriquez",
            checkedAt,
            findingRu:
              "Профиль и описание номинированной книги подтверждают макабрические образы на фоне современной городской Аргентины.",
          },
        ],
      },
      {
        textRu:
          "Отдельная проверка поля birthDate установила, что отображаемое значение 1973-12-08 неверно: авторитетные источники указывают 1973-12-06.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Муниципалитет Лануса",
            url: "https://www.lanus.gob.ar/mariana-enriquez",
            checkedAt,
            findingRu:
              "Официальная муниципальная биография указывает, что Мариана Энрикес родилась 6 декабря 1973 года.",
          },
          {
            provider: "Фонд Konex",
            url: "https://www.fundacionkonex.org/upload/descargar_archivo/?file=202410290339376b1f60b9c00500fa21a2073d02983129.pdf",
            checkedAt,
            findingRu:
              "Официальный каталог премии Konex приводит дату рождения 06.12.1973.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Оценочная формула заменена датированной премией; жанровая характеристика сохранена. Рекомендация для отдельной правки данных: заменить birthDate 1973-12-08 на 1973-12-06; общий файл страны в этой партии не изменялся.",
  },
  {
    key: "argentina:samanta_schweblin",
    originalSha256:
      "18090fdb7dcc06c8af3a926829db0ecbf245b180a01922380e769d62c665bd75",
    reviewedTextRu:
      "Аргентинская писательница: одно её произведение вошло в короткий и два — в длинный список Международной Букеровской премии. Её книги сочетают психологическую прозу, фантастику и элементы хоррора.",
    claims: [
      {
        textRu:
          "Субъективная оценка известности заменена проверяемым фактом: одно произведение Швеблин вошло в короткий и два — в длинный список Международной Букеровской премии.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Фонд Букеровской премии",
            url: "https://thebookerprizes.com/the-booker-library/authors/samanta-schweblin",
            checkedAt,
            findingRu:
              "Профиль подтверждает происхождение из Буэнос-Айреса, три номинации на Международную Букеровскую премию, многочисленные награды и переводы более чем на тридцать языков.",
          },
          {
            provider: "Министерство культуры Аргентины",
            url: "https://www.cultura.gob.ar/argentina-y-los-libros_5495/",
            checkedAt,
            findingRu:
              "Государственный обзор включает Швеблин в представительный круг современных аргентинских авторов.",
          },
        ],
      },
      {
        textRu:
          "Её произведения соединяют психологическую напряжённость, фантастическое и элементы хоррора.",
        verdict: "supported",
        evidence: [
          {
            provider: "Фонд Букеровской премии",
            url: "https://thebookerprizes.com/the-booker-library/authors/samanta-schweblin",
            checkedAt,
            findingRu:
              "Описания произведений отмечают психологическую угрозу, потустороннюю реальность, призрачный сюжет и смешение сюрреального с повседневным.",
          },
        ],
      },
      {
        textRu:
          "Отдельная проверка поля birthDate установила, что отображаемое значение 1978-04-19 неверно: официальный профиль премии указывает 1978-03-08.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Фонд Konex",
            url: "https://www.fundacionkonex.org/b4645-samanta_schweblin",
            checkedAt,
            findingRu:
              "Официальный профиль лауреата премии Konex приводит дату рождения 08.03.1978.",
          },
          {
            provider: "Фонд Konex",
            url: "https://www.fundacionkonex.org/upload/descargar_archivo/?file=202410290339376b1f60b9c00500fa21a2073d02983129.pdf",
            checkedAt,
            findingRu:
              "Официальный каталог премии Konex независимо фиксирует дату рождения 08.03.1978.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив заменён числом включений в официальные списки премии. Рекомендация для отдельной правки данных: заменить birthDate 1978-04-19 на 1978-03-08; общий файл страны в этой партии не изменялся.",
  },
  {
    key: "argentina:victoria_ocampo",
    originalSha256:
      "af5ed312fc993ad85e84505d090f7d5fc51cf986d927948c703d8a2ac2ac0633",
    reviewedTextRu:
      "Аргентинская писательница, переводчица, редактор и культурный деятель. Основательница журнала «Sur», сыгравшего важную роль в развитии литературы Латинской Америки.",
    claims: [
      {
        textRu:
          "Виктория Окампо — аргентинская писательница, переводчица, редактор и культурный деятель.",
        verdict: "supported",
        evidence: [
          {
            provider: "Национальная библиотека Аргентины",
            url: "https://www.bn.gov.ar/noticias/7-de-abril-de-1890-nace-victoria-ocampo",
            checkedAt,
            findingRu:
              "Национальная библиотека подтверждает писательскую, переводческую, редакторскую и общественно-культурную деятельность Окампо.",
          },
        ],
      },
      {
        textRu:
          "Окампо основала журнал «Sur», имевший важное значение для латиноамериканской литературы.",
        verdict: "supported",
        evidence: [
          {
            provider: "ЮНЕСКО, Вилла Окампо",
            url: "https://www.unesco.org/es/villa-ocampo/victoria-ocampo",
            checkedAt,
            findingRu:
              "ЮНЕСКО подтверждает основание журнала в 1931 году и роль Окампо как культурного посредника.",
          },
          {
            provider: "ЮНЕСКО, Центр документации Виллы Окампо",
            url: "https://www.unesco.org/en/villa-ocampo/documentation-centre",
            checkedAt,
            findingRu:
              "Описание архива фиксирует значение «Sur» как одного из важных литературных проектов испаноязычного мира.",
          },
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes: "Факты о профессиях, основании и значении журнала подтверждены.",
  },
  {
    key: "armenia:avetik_isahakyan",
    originalSha256:
      "a81b61f49c8478b8d9f485ac409821fd3c6184baa72d19dd7e18557b12b03a36",
    reviewedTextRu:
      "Армянский поэт, писатель и общественный деятель, живший в 1875–1957 годах.",
    claims: [
      {
        textRu:
          "Субъективный суперлатив заменён проверяемыми биографическими фактами: Исаакян был армянским поэтом, писателем и общественным деятелем и жил в 1875–1957 годах.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Дом-музей Аветика Исаакяна",
            url: "https://isahakyanmuseum.am/htmls_eng/isahakyan_about.html",
            checkedAt,
            findingRu:
              "Официальный музейный профиль датирует жизнь поэта 1875–1957 годами и характеризует его как выдающегося армянского поэта и писателя.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Сравнительный рейтинг заменён нейтральной ролью и датами жизни.",
  },
  {
    key: "armenia:hrant_matevosyan",
    originalSha256:
      "b13f066f442c8ea3924a5f6723a5fc93776fc0b469a96b2b8ec888faba2ff1d7",
    reviewedTextRu:
      "Армянский прозаик XX века, по произведениям которого были сняты фильмы.",
    claims: [
      {
        textRu:
          "Субъективный суперлатив заменён проверяемыми фактами: Матевосян — армянский прозаик XX века, по произведениям которого были сняты фильмы.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Ереванский государственный университет",
            url: "https://www.ysu.am/en/news/76058",
            checkedAt,
            findingRu:
              "Университетская публикация называет Матевосяна армянским прозаиком и сообщает об экранизациях нескольких его произведений.",
          },
          {
            provider: "Президент Республики Армения",
            url: "https://president.am/en/press-release/item/2019/07/20/President-Armen-Sarkissian-in-Ahnidzor/",
            checkedAt,
            findingRu:
              "Официальное сообщение характеризует Матевосяна как признанного писателя с продолжающимся национальным значением.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Оценочный рейтинг заменён нейтральным перечнем литературных форм.",
  },
  {
    key: "armenia:khachatur_abovian",
    originalSha256:
      "efae6202b391f8cd3d56e39afdc44c2937572411aa5894311d3166446dac8ee1",
    reviewedTextRu:
      "Основоположник новой армянской литературы и автор первого армянского светского романа.",
    claims: [
      {
        textRu: "Хачатур Абовян — основоположник новой армянской литературы.",
        verdict: "supported",
        evidence: [
          {
            provider: "Официальный туристический портал Еревана",
            url: "https://www.visityerevan.am/places/details/623/en/",
            checkedAt,
            findingRu:
              "Муниципальный портал называет Абовяна основателем новой армянской литературы и педагогики.",
          },
          {
            provider: "Библиотека Конгресса США",
            url: "https://www.loc.gov/item/00507185",
            checkedAt,
            findingRu:
              "Библиотечная запись связывает публикацию «Ран Армении» с началом современной армянской литературы.",
          },
        ],
      },
      {
        textRu: "Абовян — автор первого армянского светского романа.",
        verdict: "supported",
        evidence: [
          {
            provider: "Издательство Antares",
            url: "https://antares.am/portfolio-item/wounds-of-armenia/?lang=en",
            checkedAt,
            findingRu:
              "Издательская справка определяет «Раны Армении» как первый армянский светский роман.",
          },
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes:
      "Дополнительная проверка устранила сомнение: профильное армянское издательство прямо подтверждает формулу о первом светском романе, поэтому текст не исправлялся.",
  },
  {
    key: "armenia:mesrop_mashtots",
    originalSha256:
      "51186c480c7cb84886c387c7a2e881e69a6ddba440cae60da6283b3357d179bd",
    reviewedTextRu:
      "Создатель армянского алфавита и основатель армянской письменной культуры. Его деятельность заложила основу развития армянской литературы.",
    claims: [
      {
        textRu:
          "Месроп Маштоц создал армянский алфавит и стоял у истоков армянской письменной культуры.",
        verdict: "supported",
        evidence: [
          {
            provider: "ЮНЕСКО, Репрезентативный список нематериального наследия",
            url: "https://ich.unesco.org/es/RL/el-arte-armenio-de-la-escritura-y-sus-expresiones-culturales-01513",
            checkedAt,
            findingRu:
              "ЮНЕСКО датирует создание армянского алфавита Маштоцем 405 годом и связывает его с устойчивой письменной традицией.",
          },
        ],
      },
      {
        textRu:
          "Деятельность Маштоца заложила основу последующего развития армянской литературы.",
        verdict: "supported",
        evidence: [
          {
            provider: "ЮНЕСКО, реестр «Память мира»",
            url: "https://media.unesco.org/sites/default/files/webform/mow001/armenia_mashtots.pdf",
            checkedAt,
            findingRu:
              "Номинационное досье связывает создание алфавита, школу переводчиков и формирование армянской рукописной и литературной культуры.",
          },
        ],
      },
    ],
    reviewer,
    decision: "unchanged",
    notes: "Оба предложения подтверждены материалами ЮНЕСКО.",
  },
  {
    key: "armenia:william_saroyan",
    originalSha256:
      "97a87bd819ff4e71ba8dd78e4eb87c19e7d3f2f477260518f477034ab78f28e3",
    reviewedTextRu:
      "Армяно-американский писатель и драматург, лауреат Пулитцеровской премии 1940 года.",
    claims: [
      {
        textRu:
          "Субъективная оценка известности заменена профессиональной характеристикой: Вильям Сароян — армяно-американский писатель и драматург.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Библиотека Конгресса США",
            url: "https://loc.gov/loc/lcib/090910/saroyan.html",
            checkedAt,
            findingRu:
              "Библиотека Конгресса характеризует Сарояна как прославленного армяно-американского автора и описывает масштаб его наследия.",
          },
        ],
      },
      {
        textRu: "Сароян — лауреат Пулитцеровской премии.",
        verdict: "supported",
        evidence: [
          {
            provider: "Пулитцеровские премии",
            url: "https://www.pulitzer.org/winners/william-saroyan",
            checkedAt,
            findingRu:
              "Официальный реестр фиксирует Сарояна как победителя 1940 года в категории драматургии.",
          },
          {
            provider: "Дом-музей Вильяма Сарояна",
            url: "https://saroyanhouse.com/saroyan",
            checkedAt,
            findingRu:
              "Музей подтверждает присуждение премии и уточняет, что писатель отказался принять денежную часть и связанные условия.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes:
      "Суперлатив снят; профессиональная роль и год Пулитцеровской премии подтверждены. Отказ Сарояна принять премию не отменяет факт официального присуждения.",
  },
  {
    key: "australia:christos_tsiolkas",
    originalSha256:
      "26bd0489a57ef2532d7d6377b5cc25315813f6bf8e9c6e021bbdb66a66149333",
    reviewedTextRu:
      "Австралийский писатель греческого происхождения. Его произведения посвящены вопросам семьи, общества, культуры и идентичности.",
    claims: [
      {
        textRu:
          "Субъективная оценка заметности снята; подтверждены австралийская литературная деятельность и происхождение из семьи греческих иммигрантов.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Australian Broadcasting Corporation",
            url: "https://www.abc.net.au/news/2013-10-17/race-and-racism-drive-tsiolkas-after-the-slap/5030010",
            checkedAt,
            findingRu:
              "Национальный вещатель подтверждает происхождение из семьи греческих иммигрантов и характеризует Циолкаса как одного из наиболее известных австралийских писателей и мыслителей.",
          },
          {
            provider: "State Library Victoria",
            url: "https://www.slv.vic.gov.au/stories/writers-writers-stan-grant-thomas-keneally",
            checkedAt,
            findingRu:
              "Библиотека подтверждает его статус австралийского автора романов, пьес, эссе и сценариев.",
          },
        ],
      },
      {
        textRu:
          "Произведения Циолкаса обращаются к семье, обществу, культуре и идентичности.",
        verdict: "supported",
        evidence: [
          {
            provider: "Australian Broadcasting Corporation",
            url: "https://www.abc.net.au/news/2017-08-01/close-up-of-john-tsiavis-portrait-of-christos-tsiolkas/8737422",
            checkedAt,
            findingRu:
              "Материал национального вещателя прямо связывает его книги с темами семьи, класса, расы, сексуальности и общественной идентичности.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Оценка заметности удалена; биографическая и тематическая части сохранены.",
  },
  {
    key: "australia:gerald_murnane",
    originalSha256:
      "d69461290dc14026559f31aadb4e4050a0f3c1356af755421e3e21208f773d8d",
    reviewedTextRu:
      "Австралийский писатель, лауреат национальных литературных премий, в том числе Премии Патрика Уайта и награды Аделаидского фестиваля за литературные инновации.",
    claims: [
      {
        textRu:
          "Джеральд Мёрнейн — австралийский писатель.",
        verdict: "supported",
        evidence: [
          {
            provider: "Text Publishing",
            url: "https://www.textpublishing.com.au/news/1681-articles/gerald-murnane-receives-2026-kings-birthday-honour",
            checkedAt,
            findingRu:
              "Издатель подтверждает австралийскую писательскую карьеру Мёрнейна.",
          },
        ],
      },
      {
        textRu:
          "Субъективная оценка оригинальности заменена проверяемыми фактами о Премии Патрика Уайта и награде Аделаидского фестиваля за литературные инновации.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Text Publishing",
            url: "https://www.textpublishing.com.au/news/1681-articles/gerald-murnane-receives-2026-kings-birthday-honour",
            checkedAt,
            findingRu:
              "Издатель перечисляет обе награды наряду с другими национальными литературными премиями.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив и субъективная характеристика стиля заменены двумя проверяемыми наградами.",
  },
  {
    key: "australia:greg_egan",
    originalSha256:
      "1a30acdf0796945f98e994b902b2141edfda6efdd69d11d5359635c977b2f760",
    reviewedTextRu:
      "Австралийский писатель-фантаст, работающий в традиции твёрдой научной фантастики. Его произведения исследуют сознание, технологии и будущее человечества.",
    claims: [
      {
        textRu:
          "Субъективный рейтинг заменён проверяемой жанровой характеристикой: Грег Иган — австралийский автор твёрдой научной фантастики.",
        verdict: "corrected",
        evidence: [
          {
            provider: "Официальный сайт Грега Игана",
            url: "https://www.gregegan.net/",
            checkedAt,
            findingRu:
              "Автор прямо определяет себя как писателя-фантаста и публикует проверяемую библиографию.",
          },
          {
            provider: "Orion / Gollancz",
            url: "https://www.orionbooks.co.uk/contributor/greg-egan/",
            checkedAt,
            findingRu:
              "Издатель подтверждает писательскую карьеру Игана, его связь с Пертом в Западной Австралии, библиографию и основные жанровые премии.",
          },
          {
            provider: "Официальный сайт Грега Игана",
            url: "https://www.gregegan.net/INTERVIEWS/Interviews.html",
            checkedAt,
            findingRu:
              "В размещённом автором интервью Иган прямо обсуждает требования твёрдой научной фантастики и исследовательскую работу с физическими и математическими темами.",
          },
        ],
      },
      {
        textRu:
          "Произведения Игана исследуют сознание, технологии и возможные варианты будущего человечества.",
        verdict: "supported",
        evidence: [
          {
            provider: "Официальный сайт Грега Игана",
            url: "https://www.gregegan.net/INTERVIEWS/Interviews.html",
            checkedAt,
            findingRu:
              "В авторских интервью Иган связывает свои книги с сознанием, искусственным интеллектом, виртуальной реальностью, технологиями и моделями будущего.",
          },
        ],
      },
    ],
    reviewer,
    decision: "corrected",
    notes: "Суперлатив снят; жанровая принадлежность и тематический диапазон подтверждены.",
  },
] as const;

function finalizeReviewRecord(
  record: Omit<WriterBiographyFactReviewRecord, "applicableTextRu">
): WriterBiographyFactReviewRecord {
  return {
    ...record,
    applicableTextRu:
      record.decision === "held" ? null : record.reviewedTextRu,
  };
}

export const writerBiographyFactReviewBatch02: readonly WriterBiographyFactReviewRecord[] =
  writerBiographyFactReviewBatch02Base.map(finalizeReviewRecord);
