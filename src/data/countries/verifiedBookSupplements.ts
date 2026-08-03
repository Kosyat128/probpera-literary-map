import type { Country, WorkProfile, WriterProfile } from "./types";

const reviewedAt = "2026-08-03";

type VerifiedWork = WorkProfile & { editorial: { status: "verified"; reviewedAt: string } };

function verifiedWork(work: Omit<VerifiedWork, "editorial">): VerifiedWork {
  return {
    ...work,
    editorial: { status: "verified", reviewedAt },
  };
}

const supplements: Record<string, Record<string, VerifiedWork[]>> = {
  chile: {
    pablo_neruda: [
      verifiedWork({
        id: "twenty-love-poems",
        title: "Двадцать стихотворений о любви и одна песня отчаяния",
        originalTitle: "Veinte poemas de amor y una canción desesperada",
        firstPublished: 1924,
        originalLanguage: "испанский",
        genres: ["поэзия", "лирический сборник"],
        tags: ["любовь", "память", "утрата", "молодость"],
        description:
          "Ранний лирический сборник Пабло Неруды, в котором чувственная любовная поэзия соседствует с переживанием разлуки и утраты. Книга вышла в Сантьяго в издательстве Nascimento в 1924 году и стала одним из самых известных произведений поэта.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1971/neruda/bibliography/",
      }),
    ],
  },
  colombia: {
    gabriel_garcia_marquez: [
      verifiedWork({
        id: "one-hundred-years-of-solitude",
        title: "Сто лет одиночества",
        originalTitle: "Cien años de soledad",
        firstPublished: 1967,
        originalLanguage: "испанский",
        genres: ["роман", "магический реализм", "семейная сага"],
        tags: ["Макондо", "семья", "память", "история Латинской Америки"],
        description:
          "История нескольких поколений семьи Буэндиа и основанного ими Макондо соединяет семейную хронику, политическую историю и чудесное как часть повседневного опыта. Первое издание романа вышло в Буэнос-Айресе в издательстве Sudamericana в 1967 году.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1982/marquez/bibliography/",
      }),
    ],
  },
  egypt: {
    naguib_mahfouz: [
      verifiedWork({
        id: "cairo-trilogy",
        title: "Каирская трилогия",
        originalTitle: "الثلاثية",
        firstPublished: 1956,
        originalLanguage: "арабский",
        genres: ["роман", "семейная сага", "социальный реализм"],
        tags: ["Каир", "семья", "история Египта", "общественные перемены"],
        description:
          "Семейная сага Нагиба Махфуза прослеживает жизнь трёх поколений каирской семьи на фоне общественных и политических перемен. Трилогию составляют романы «Бейн аль-Касрейн» (1956), «Каср аш-Шаук» (1957) и «Ас-Суккария» (1957).",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1988/mahfouz/article/",
      }),
      verifiedWork({
        id: "midaq-alley",
        title: "Переулок Мидак",
        originalTitle: "زقاق المدق",
        firstPublished: 1947,
        originalLanguage: "арабский",
        genres: ["роман", "социальный реализм"],
        tags: ["Каир", "Вторая мировая война", "городская жизнь", "выбор"],
        description:
          "Роман о жителях старого каирского переулка в годы Второй мировой войны. Через судьбы Хамиды, Аббаса и их соседей Нагиб Махфуз показывает, как бедность, надежда и соблазны меняющегося города испытывают человеческое достоинство. Оригинал вышел в 1947 году.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1988/mahfouz/prose/",
      }),
      verifiedWork({
        id: "the-thief-and-the-dogs",
        title: "Вор и собаки",
        originalTitle: "اللص والكلاب",
        firstPublished: 1961,
        originalLanguage: "арабский",
        genres: ["роман", "психологическая проза", "социальная проза"],
        tags: ["предательство", "месть", "Каир", "внутренний монолог"],
        description:
          "После освобождения из тюрьмы Саид Махран пытается отомстить тем, кого считает предателями, но его путь всё сильнее превращается в столкновение с самим собой и изменившимся обществом. Роман 1961 года открыл новый этап в прозе Махфуза, где реалистическое повествование соединено с внутренним монологом.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1988/mahfouz/biographical/",
      }),
    ],
  },
  england: {
    jane_austen: [
      verifiedWork({
        id: "pride-and-prejudice",
        title: "Гордость и предубеждение",
        originalTitle: "Pride and Prejudice",
        firstPublished: 1813,
        originalLanguage: "английский",
        genres: ["роман", "роман нравов"],
        tags: ["семья", "брак", "общество", "ирония"],
        description:
          "Роман Джейн Остин о том, как первое впечатление, социальные ожидания и семейные обстоятельства мешают Элизабет Беннет и мистеру Дарси увидеть друг друга без предубеждения. Первое издание вышло анонимно в 1813 году.",
        sourceUrl:
          "https://www.bl.uk/stories/blogs/posts/jane-austen-names-and-notability",
      }),
      verifiedWork({
        id: "persuasion",
        title: "Доводы рассудка",
        alternateTitles: ["Убеждение"],
        originalTitle: "Persuasion",
        firstPublished: 1817,
        originalLanguage: "английский",
        genres: ["роман", "роман нравов"],
        tags: ["второй шанс", "память", "семья", "любовь"],
        description:
          "Последний завершённый роман Джейн Остин — история Энн Эллиот и капитана Уэнтворта, которым спустя годы предстоит заново оценить сделанный когда-то выбор. Книга появилась посмертно в декабре 1817 года с датой 1818 на титульном листе.",
        sourceUrl:
          "https://www.bl.uk/stories/blogs/posts/jane-austen-names-and-notability",
      }),
    ],
    charles_dickens: [
      verifiedWork({
        id: "great-expectations",
        title: "Большие надежды",
        originalTitle: "Great Expectations",
        firstPublished: 1861,
        originalLanguage: "английский",
        genres: ["роман", "роман воспитания"],
        tags: ["взросление", "класс", "совесть", "викторианская Англия"],
        description:
          "Роман воспитания о сироте Пипе, который принимает богатство и положение за путь к счастью, но постепенно учится различать внешнюю респектабельность и нравственную ценность. Впервые печатался частями в 1860–1861 годах.",
        sourceUrl:
          "https://support.bl.uk/book/detail/93c22a09-06f5-469b-9839-9e7d00d87cb9",
      }),
    ],
  },
  france: {
    flaubert: [
      verifiedWork({
        id: "madame-bovary",
        title: "Госпожа Бовари",
        originalTitle: "Madame Bovary",
        firstPublished: 1857,
        originalLanguage: "французский",
        genres: ["роман", "реализм"],
        tags: ["провинция", "иллюзии", "брак", "стиль"],
        description:
          "Роман Гюстава Флобера об Эмме Бовари, чьи представления о любви и красивой жизни сталкиваются с провинциальной повседневностью. После журнальной публикации 1856 года отдельное издание вышло у Мишеля Леви в 1857 году.",
        sourceUrl:
          "https://gallica.bnf.fr/accueil/fr/html/madame-bovary-mise-nu-par-ses-critiques",
      }),
    ],
  },
  italy: {
    umberto_eco: [
      verifiedWork({
        id: "the-name-of-the-rose",
        title: "Имя розы",
        originalTitle: "Il nome della rosa",
        firstPublished: 1980,
        originalLanguage: "итальянский",
        genres: ["исторический роман", "детектив", "интеллектуальная проза"],
        tags: ["Средневековье", "монастырь", "книга", "истолкование"],
        description:
          "Первый роман Умберто Эко соединяет монастырский детектив, историческую реконструкцию и размышление о природе знаков и толкований. Итальянское издание Bompiani вышло в 1980 году.",
        sourceUrl:
          "https://bompiani.it/catalogo/il-nome-della-rosa-9788845278655",
      }),
    ],
  },
  india: {
    rabindranath_tagore: [
      verifiedWork({
        id: "gitanjali",
        title: "Гитанджали",
        originalTitle: "গীতাঞ্জলি",
        firstPublished: 1910,
        originalLanguage: "бенгальский",
        genres: ["поэзия", "лирический сборник"],
        tags: ["духовная поэзия", "природа", "любовь", "внутренняя свобода"],
        description:
          "Бенгальский поэтический сборник Рабиндраната Тагора, в котором молитвенная интонация соединяется с размышлением о природе, любви и внутренней свободе. Оригинальная «Гитанджали» вышла в 1910 году; авторская английская книга «Gitanjali: Song Offerings» 1912 года имела иной состав.",
        sourceUrl:
          "https://www.nobelprize.org/prizes/literature/1913/tagore/bibliography/?print=1",
      }),
    ],
  },
  japan: {
    haruki_murakami: [
      verifiedWork({
        id: "kafka-on-the-shore",
        title: "Кафка на пляже",
        originalTitle: "海辺のカフカ",
        firstPublished: 2002,
        originalLanguage: "японский",
        genres: ["роман", "магический реализм", "современная проза"],
        tags: ["память", "судьба", "библиотека", "параллельные истории"],
        description:
          "Две параллельные истории — подростка Кафки Тамуры и пожилого Накаты — постепенно сближаются в романе о памяти, утрате, предопределении и поиске собственного места. Первое японское издание вышло в 2002 году.",
        sourceUrl: "https://1q84.shinchosha.co.jp/murakami/2002.html",
      }),
    ],
  },
  usa: {
    herman_melville: [
      verifiedWork({
        id: "moby-dick",
        title: "Моби Дик",
        alternateTitles: ["Моби-Дик, или Белый кит"],
        originalTitle: "Moby-Dick; or, The Whale",
        firstPublished: 1851,
        originalLanguage: "английский",
        genres: ["роман", "морская проза"],
        tags: ["море", "одержимость", "китобойный промысел", "символизм"],
        description:
          "Рассказ Измаила о плавании китобойного судна «Пекод» превращается в масштабный роман об одержимости капитана Ахава, границах знания и противостоянии человека непостижимому миру.",
        sourceUrl: "https://www.loc.gov/exhibits/america-reads/1750-to-1899.html#obj006",
      }),
    ],
    francis_scott_fitzgerald: [
      verifiedWork({
        id: "the-great-gatsby",
        title: "Великий Гэтсби",
        originalTitle: "The Great Gatsby",
        firstPublished: 1925,
        originalLanguage: "английский",
        genres: ["роман", "модернизм"],
        tags: ["эпоха джаза", "американская мечта", "богатство", "память"],
        description:
          "Роман о загадочном Джее Гэтсби и его попытке вернуть прошлое показывает блеск и нравственную пустоту эпохи джаза, превращая частную историю в исследование американской мечты.",
        sourceUrl: "https://www.loc.gov/exhibits/america-reads/1900-to-1949.html#obj016",
      }),
      verifiedWork({
        id: "tender-is-the-night",
        title: "Ночь нежна",
        originalTitle: "Tender Is the Night",
        firstPublished: 1934,
        originalLanguage: "английский",
        genres: ["роман", "психологическая проза"],
        tags: ["эмиграция", "брак", "зависимость", "утрата себя"],
        description:
          "История психиатра Дика Дайвера и его жены Николь разворачивается среди состоятельных американцев в Европе и постепенно раскрывает цену эмоциональной зависимости, обаяния и саморазрушения.",
        sourceUrl:
          "https://www.loc.gov/nls/new-materials/book-lists/best-american-fiction-1945/",
      }),
    ],
  },
};

function normalizedTitle(value = "") {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mergeWork(current: WorkProfile | undefined, verified: VerifiedWork) {
  if (!current) return verified;
  return {
    ...current,
    ...verified,
    alternateTitles: [
      ...new Set([
        ...(current.alternateTitles || []),
        ...(verified.alternateTitles || []),
      ]),
    ],
    genres: [...new Set([...(current.genres || []), ...(verified.genres || [])])],
    tags: [...new Set([...(current.tags || []), ...(verified.tags || [])])],
    coverUrl: current.coverUrl,
    coverThumbnailUrl: current.coverThumbnailUrl,
    coverSourceUrl: current.coverSourceUrl,
    coverRights: current.coverRights,
    editorial: verified.editorial,
  };
}

function mergeWriter(writer: WriterProfile, verifiedWorks: VerifiedWork[]) {
  const incoming = new Map(
    verifiedWorks.map((work) => [normalizedTitle(work.title), work])
  );
  const workDetails = (writer.workDetails || []).map((work) => {
    const supplement = incoming.get(normalizedTitle(work.title));
    if (!supplement) return work;
    incoming.delete(normalizedTitle(work.title));
    return mergeWork(work, supplement);
  });
  workDetails.push(...incoming.values());
  const detailedTitles = new Set(
    workDetails.map((work) => normalizedTitle(work.title))
  );

  return {
    ...writer,
    works: (writer.works || []).filter(
      (title) => !detailedTitles.has(normalizedTitle(title))
    ),
    workDetails,
  };
}

export function mergeVerifiedBookSupplements(countries: Country[]): Country[] {
  return countries.map((country) => {
    const countrySupplements = supplements[country.id];
    if (!countrySupplements) return country;
    return {
      ...country,
      writers: country.writers.map((writer) =>
        countrySupplements[writer.id]
          ? mergeWriter(writer, countrySupplements[writer.id])
          : writer
      ),
    };
  });
}

export const verifiedBookSupplementTitles = Object.values(supplements).flatMap(
  (writers) => Object.values(writers).flatMap((works) => works.map((work) => work.title))
);
