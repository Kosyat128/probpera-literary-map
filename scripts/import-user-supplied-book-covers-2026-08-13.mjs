import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";
import sharp from "sharp";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const manifestPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "userSuppliedBookCoversBatch20260813.generated.json"
);
const previousManifestPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "userSuppliedBookCovers.generated.json"
);
const reportJsonPath = path.join(
  projectRoot,
  "reports",
  "user-supplied-book-cover-import-2026-08-13.json"
);
const reportMarkdownPath = path.join(
  projectRoot,
  "reports",
  "user-supplied-book-cover-import-2026-08-13.md"
);
const coverDirectory = path.join(projectRoot, "public", "brand", "book-covers");
const thumbnailDirectory = path.join(coverDirectory, "thumbs");

const GENERATED_AT = "2026-08-13T00:00:00.000Z";
const CHECKED_AT = GENERATED_AT.slice(0, 10);
const EDITORIAL_NOTE =
  "Предоставленная пользователем редакционная иллюстрация, созданная в ChatGPT; не является обложкой конкретного издательского издания.";
const OUTPUT = Object.freeze({
  full: Object.freeze({ width: 720, height: 1_080, quality: 55 }),
  thumbnail: Object.freeze({ width: 360, height: 540, quality: 50 }),
});
const ARCHIVE = Object.freeze({
  name: "Новые обложки.rar",
  sha256: "2f6f57c33c94dff8fc2423a9db2caa3ac58603b9843b549fbe3b9db59553234f",
  bytes: 307_935_513,
  entries: 101,
  uniqueImages: 100,
  duplicateEntries: 1,
  uncompressedBytes: 321_363_903,
});

function parseRows(value, columns) {
  return value
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const fields = line.split("|");
      if (fields.length !== columns.length) {
        throw new Error("Некорректная строка решения: " + line);
      }
      return Object.fromEntries(
        columns.map((column, index) => [
          column,
          ["sourceIndex", "selectedSourceIndex"].includes(column)
            ? Number(fields[index])
            : fields[index],
        ])
      );
    });
}

const identities = new Map(
  parseRows(
    `
1|Валентин Катаев|Белеет парус одинокий
2|Вальтер Скотт|Пират
3|Иван Тургенев|Дым
4|Иван Тургенев|Ася
5|Иван Тургенев|Первая любовь
6|Иван Тургенев|Вешние воды
7|Лев Толстой|Смерть Ивана Ильича
8|Лев Толстой|Отец Сергий
9|Лев Толстой|Хаджи-Мурат
10|Лев Толстой|Отрочество
11|Лев Толстой|Юность
12|Алексей Толстой|Пётр Первый
13|Иван Тургенев|Дворянское гнездо
14|Александр Куприн|Олеся
15|Александр Островский|Гроза
16|Николай Гоголь|Вий
17|Николай Гоголь|Ночь перед Рождеством
18|Фёдор Достоевский|Бедные люди
19|Фёдор Достоевский|Подросток
20|Михаил Булгаков|Морфий
21|Лев Толстой|Севастопольские рассказы
22|Антон Чехов|Степь
23|Иван Бунин|Господин из Сан-Франциско
24|Николай Гоголь|Нос
25|Николай Гоголь|Записки сумасшедшего
26|Николай Гоголь|Старосветские помещики
27|Александр Куприн|Гранатовый браслет
28|Антон Чехов|Палата № 6
29|Антон Чехов|Ионыч
30|Лев Толстой|После бала
31|Николай Лесков|Очарованный странник
32|Александр Куприн|Поединок
33|Николай Лесков|Левша
34|Михаил Лермонтов|Мцыри
35|Александр Куприн|Поединок
36|Антон Чехов|Три сестры
37|Фёдор Достоевский|Униженные и оскорблённые
38|Иван Бунин|Господин из Сан-Франциско
39|Николай Гоголь|Майская ночь, или Утопленница
40|Владимир Короленко|Слепой музыкант
41|Максим Горький|На дне
42|Иван Тургенев|Муму
43|Николай Карамзин|Бедная Лиза
44|Гавриил Троепольский|Белый Бим Чёрное ухо
45|Андрей Платонов|Котлован
46|Чингиз Айтматов|Плаха
47|Михаил Булгаков|Записки юного врача
48|Евгений Шварц|Обыкновенное чудо
49|Денис Фонвизин|Недоросль
50|Николай Некрасов|Кому на Руси жить хорошо
51|Валентин Распутин|Живи и помни
52|Михаил Лермонтов|Песня про купца Калашникова
53|Иван Тургенев|Муму
54|Николай Лесков|Левша
55|Владимир Короленко|Слепой музыкант
56|Максим Горький|Детство
57|Иван Шмелёв|Лето Господне
58|Максим Горький|Старуха Изергиль
59|Александр Куприн|Суламифь
60|Александр Солженицын|Один день Ивана Денисовича
61|Валентин Катаев|Белеет парус одинокий
62|Константин Паустовский|Мещёрская сторона
63|Джейн Остин|Доводы рассудка
64|Чарльз Диккенс|Наш общий друг
65|Роберт Льюис Стивенсон|Чёрная стрела
66|Артур Конан Дойл|Белый отряд
67|Герберт Уэллс|Война в воздухе
68|Герберт Уэллс|Тоно-Бенге
69|Вирджиния Вулф|Между актов
70|Джордж Оруэлл|Да здравствует фикус!
71|Грэм Грин|Конец одного романа
72|Энтони Троллоп|Барчестерские башни
73|Уилки Коллинз|Лунный камень
74|Чарльз Диккенс|Мартин Чезлвит
75|Рафаэль Сабатини|Одиссея капитана Блада
76|Рафаэль Сабатини|Морской ястреб
77|Даниэль Дефо|Приключения капитана Сингльтона
78|Герберт Уэллс|Странная орхидея
79|Вирджиния Вулф|Между актов
80|Джордж Оруэлл|Да здравствует фикус!
81|Грэм Грин|Конец одного романа
82|Лоренс Стерн|Жизнь и мнения Тристрама Шенди, джентльмена
83|Джейн Остин|Чувство и чувствительность
84|Генри Джеймс|Портрет дамы
85|Чарльз Диккенс|Крошка Доррит
86|Артур Конан Дойл|Собака Баскервилей
87|Томас Харди|Возвращение на родину
88|Эдвард Бульвер-Литтон|Последние дни Помпеи
89|Гюстав Флобер|Воспитание чувств
90|Фрэнсис Скотт Фицджеральд|Ночь нежна
91|Олдос Хаксли|Остров
92|Николай Гоголь|Портрет
93|Вальтер Скотт|Айвенго
94|Джозеф Конрад|Сердце тьмы
95|Генри Джеймс|Портрет дамы
96|Сомерсет Моэм|Луна и грош
97|Джеймс Фенимор Купер|Последний из могикан
98|Чарльз Диккенс|Повесть о двух городах
99|Иван Бунин|Деревня
100|Томас Харди|Мэр Кэстербриджа
101|Михаил Лермонтов|Бэла
`,
    ["sourceIndex", "author", "title"]
  ).map((entry) => [entry.sourceIndex, entry])
);

const imports = parseRows(
  `
3|russia:turgenev:article-series-men9bv|smoke-turgenev-editorial|exact-author-and-title
4|russia:turgenev:openlibrary-works-ol43357w|asya-editorial|verified-bibliographic-title-alias
5|russia:turgenev:openlibrary-works-ol28645904w|first-love-turgenev-editorial|verified-bibliographic-title-alias
6|russia:turgenev:openlibrary-works-ol43363w|spring-torrents-editorial|verified-bibliographic-title-alias
7|russia:tolstoy:legacy-tolstoy-смерть-ивана-ильича|death-of-ivan-ilyich-editorial|exact-author-and-title
8|russia:tolstoy:openlibrary-works-ol36393350w|father-sergius-editorial|verified-bibliographic-title-alias
9|russia:tolstoy:openlibrary-works-ol267106w|hadji-murad-editorial|verified-bibliographic-title-alias
15|russia:ostrovsky:legacy-ostrovsky-гроза|the-storm-ostrovsky-editorial|exact-author-and-title
17|russia:gogol:openlibrary-works-ol34880357w|christmas-eve-gogol-editorial|verified-bibliographic-title-alias
19|russia:dostoevsky:article-series-cnwr4c|the-adolescent-editorial|exact-author-and-title
22|russia:chekhov:article-series-10x9915|the-steppe-editorial|exact-author-and-title
23|russia:buninin:legacy-buninin-господин-из-сан-франциско|gentleman-from-san-francisco-editorial|exact-author-and-title
24|russia:gogol:openlibrary-works-ol8791626w|the-nose-editorial|verified-bibliographic-title-alias
25|russia:gogol:openlibrary-works-ol40388005w|diary-of-a-madman-editorial|verified-bibliographic-title-alias
28|russia:chekhov:legacy-chekhov-палата-6|ward-no-6-editorial|exact-author-and-title
30|russia:tolstoy:article-series-zqpjjm|after-the-ball-editorial|exact-author-and-title
31|russia:leskov:legacy-leskov-очарованный-странник|enchanted-wanderer-editorial|exact-author-and-title
33|russia:leskov:legacy-leskov-левша|lefty-editorial|exact-author-and-title
34|russia:lermontov:legacy-lermontov-мцыри|mtsyri-editorial|exact-author-and-title
36|russia:chekhov:legacy-chekhov-три-сестры|three-sisters-editorial|exact-author-and-title
42|russia:turgenev:legacy-turgenev-муму|mumu-editorial|exact-author-and-title
43|russia:karamzin:legacy-karamzin-бедная-лиза|poor-liza-editorial|exact-author-and-title
49|russia:fonvizin:legacy-fonvizin-недоросль|the-minor-editorial|exact-author-and-title
50|russia:nekrasov:legacy-nekrasov-кому-на-руси-жить-хорошо|who-is-happy-in-russia-editorial|exact-author-and-title
60|russia:solzhenitsyn:legacy-solzhenitsyn-один-день-ивана-денисовича|one-day-ivan-denisovich-editorial|exact-author-and-title
63|england:jane_austen:persuasion|persuasion-editorial|exact-author-and-title
64|england:charles_dickens:article-series-1tdjfsi|our-mutual-friend-editorial|exact-author-and-title
65|england:robert_louis_stevenson:article-series-1vf17g1|black-arrow-editorial|exact-author-and-title
66|england:arthur_conan_doyle:article-series-nq6wxl|white-company-editorial|exact-author-and-title
67|england:h_g_wells:the-war-in-the-air|war-in-the-air-editorial|exact-author-and-title
68|england:h_g_wells:article-series-15osrun|tono-bungay-editorial|verified-bibliographic-title-alias
69|england:virginia_woolf:article-series-1d76kri|between-the-acts-editorial|exact-author-and-title
70|england:george_orwell:article-series-1ux02ta|keep-the-aspidistra-flying-editorial|exact-author-and-title
71|england:graham_greene:article-series-nps3bc|end-of-the-affair-editorial|exact-author-and-title
72|england:anthony_trollope:article-series-17ulruw|barchester-towers-editorial|exact-author-and-title
73|england:wilkie_collins:article-series-1lpskee|moonstone-editorial|exact-author-and-title
74|england:charles_dickens:article-series-cyoupj|martin-chuzzlewit-editorial|verified-bibliographic-title-alias
75|england:rafael_sabatini:article-catalog-1xrb2ql|captain-blood-odyssey-editorial|exact-author-and-title
76|england:rafael_sabatini:article-catalog-6ofizb|sea-hawk-editorial|exact-author-and-title
77|england:daniel_defoe:article-catalog-9070zv|captain-singleton-editorial|verified-bibliographic-title-alias
78|england:h_g_wells:article-series-wsj9a0|strange-orchid-editorial|exact-author-and-title
82|england:laurence_sterne:article-series-12cg5ce|tristram-shandy-editorial|exact-author-and-title
83|england:jane_austen:legacy-jane_austen-разум-и-чувства|sense-and-sensibility-editorial|verified-bibliographic-title-alias
89|france:flaubert:legacy-flaubert-воспитание-чувств|sentimental-education-editorial|exact-author-and-title
91|england:aldous_huxley:legacy-aldous_huxley-остров|island-huxley-editorial|exact-author-and-title
93|england:walter_scott:legacy-walter_scott-айвенго|ivanhoe-editorial|exact-author-and-title
94|poland:joseph_conrad:openlibrary-works-ol38663w|heart-of-darkness-editorial|verified-bibliographic-title-alias
97|usa:james_fenimore_cooper:legacy-james_fenimore_cooper-последний-из-могикан|last-of-the-mohicans-editorial|exact-author-and-title
98|england:charles_dickens:a-tale-of-two-cities|tale-of-two-cities-editorial|exact-author-and-title
99|russia:buninin:openlibrary-works-ol603367w|the-village-bunin-editorial|verified-bibliographic-title-alias
100|england:thomas_hardy:legacy-thomas_hardy-мэр-кэстербриджа|mayor-of-casterbridge-editorial|exact-author-and-title
`,
  ["sourceIndex", "workKey", "slug", "matchBasis"]
);

const skippedExisting = parseRows(
  `
13|russia:turgenev:legacy-turgenev-дворянское-гнездо|existing-editorial-cover-preserved
84|usa:henry_james:legacy-henry_james-портрет-леди|existing-editorial-cover-preserved
86|england:arthur_conan_doyle:legacy-arthur_conan_doyle-собака-баскервилей|existing-editorial-cover-preserved
90|usa:francis_scott_fitzgerald:tender-is-the-night|existing-editorial-cover-preserved
92|russia:gogol:openlibrary-works-ol40184705w|existing-editorial-cover-preserved
101|russia:lermontov:a-hero-of-our-time-editorial|component-of-covered-work-preserved
`,
  ["sourceIndex", "workKey", "reason"]
);

const alternativeArtwork = parseRows(
  `
35|32|alternative-artwork-for-same-unmatched-work
38|23|alternative-artwork-for-imported-work
53|42|alternative-artwork-for-imported-work
54|33|alternative-artwork-for-imported-work
55|40|alternative-artwork-for-same-unmatched-work
79|69|alternative-artwork-for-imported-work
80|70|alternative-artwork-for-imported-work
81|71|alternative-artwork-for-imported-work
95|84|alternative-artwork-for-existing-covered-work
`,
  ["sourceIndex", "selectedSourceIndex", "reason"]
);

const exactDuplicates = parseRows(
  "1|61|byte-identical-to-chatgpt-named-entry",
  ["sourceIndex", "selectedSourceIndex", "reason"]
);

const rightsQuarantine = parseRows(
  "2|no-generator-or-license-metadata-and-no-provenance-bearing-duplicate",
  ["sourceIndex", "reason"]
);

const unmatched = parseRows(
  `
10|no-exact-standalone-work-only-combined-trilogy
11|no-exact-standalone-work-only-combined-trilogy
12|no-exact-author-work-in-canonical-archive
14|no-exact-author-work-in-canonical-archive
16|no-exact-work-in-canonical-archive
18|no-exact-work-in-canonical-archive
20|no-exact-work-in-canonical-archive
21|no-exact-work-in-canonical-archive
26|no-exact-work-in-canonical-archive
27|no-exact-author-work-in-canonical-archive
29|no-exact-work-in-canonical-archive
32|no-exact-author-work-in-canonical-archive
37|no-exact-work-in-canonical-archive
39|no-exact-work-in-canonical-archive
40|no-exact-author-work-in-canonical-archive
41|no-exact-author-work-in-canonical-archive
44|no-exact-author-work-in-canonical-archive
45|no-exact-author-work-in-canonical-archive
46|no-exact-work-in-canonical-archive
47|no-exact-work-in-canonical-archive
48|no-exact-author-work-in-canonical-archive
51|no-exact-author-work-in-canonical-archive
52|no-exact-work-in-canonical-archive
56|no-exact-author-work-in-canonical-archive
57|no-exact-author-work-in-canonical-archive
58|no-exact-author-work-in-canonical-archive
59|no-exact-author-work-in-canonical-archive
61|no-exact-author-work-in-canonical-archive
62|no-exact-author-work-in-canonical-archive
85|no-exact-work-in-canonical-archive
87|no-exact-work-in-canonical-archive
88|no-exact-author-work-in-canonical-archive
96|no-exact-author-work-in-canonical-archive
`,
  ["sourceIndex", "reason"]
);

const manuallyEquivalentWorkKeys = new Map([
  [
    "russia:turgenev:openlibrary-works-ol28645904w",
    [
      "russia:turgenev:openlibrary-works-ol15578053w",
      "russia:turgenev:openlibrary-works-ol43315w",
    ],
  ],
  [
    "russia:buninin:legacy-buninin-господин-из-сан-франциско",
    [
      "russia:buninin:openlibrary-works-ol603369w",
      "russia:buninin:openlibrary-works-ol7973532w",
    ],
  ],
  [
    "russia:gogol:openlibrary-works-ol40388005w",
    [
      "russia:gogol:openlibrary-works-ol270282w",
      "russia:gogol:openlibrary-works-ol18157220w",
    ],
  ],
  [
    "england:daniel_defoe:article-catalog-9070zv",
    ["england:daniel_defoe:openlibrary-works-ol45307w"],
  ],
  [
    "england:laurence_sterne:article-series-12cg5ce",
    [
      "england:laurence_sterne:legacy-laurence_sterne-жизнь-и-мнения-тристрама-шенди",
      "england:laurence_sterne:openlibrary-works-ol679230w",
      "england:laurence_sterne:openlibrary-works-ol5475749w",
    ],
  ],
  [
    "england:jane_austen:legacy-jane_austen-разум-и-чувства",
    [
      "england:jane_austen:openlibrary-works-ol66562w",
      "england:jane_austen:openlibrary-works-ol37510629w",
      "england:jane_austen:openlibrary-works-ol26417383w",
    ],
  ],
  [
    "france:flaubert:legacy-flaubert-воспитание-чувств",
    ["france:flaubert:openlibrary-works-ol893802w"],
  ],
  [
    "england:aldous_huxley:legacy-aldous_huxley-остров",
    ["england:aldous_huxley:openlibrary-works-ol64462w"],
  ],
  [
    "england:walter_scott:legacy-walter_scott-айвенго",
    ["england:walter_scott:openlibrary-works-ol863808w"],
  ],
  [
    "poland:joseph_conrad:openlibrary-works-ol38663w",
    [
      "poland:joseph_conrad:openlibrary-works-ol15010790w",
      "poland:joseph_conrad:openlibrary-works-ol21920402w",
      "poland:joseph_conrad:openlibrary-works-ol38893w",
      "poland:joseph_conrad:openlibrary-works-ol15010471w",
    ],
  ],
  [
    "england:thomas_hardy:legacy-thomas_hardy-мэр-кэстербриджа",
    ["england:thomas_hardy:openlibrary-works-ol8193406w"],
  ],
]);

function argument(name) {
  const prefix = "--" + name + "=";
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileSha256(filePath) {
  return sha256(await readFile(filePath));
}

function archiveKey(book) {
  return [book.countryId, book.writerId, book.id].join(":");
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/gu, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/gu, " ");
}

function titleTokens(book) {
  return new Set(
    [
      book.title,
      book.originalTitle,
      ...(book.alternateTitles || []),
      ...Object.values(book.translations || {}).map((translation) => translation.title),
    ]
      .map(normalizeTitle)
      .filter(Boolean)
  );
}

function setsIntersect(left, right) {
  return [...left].some((value) => right.has(value));
}

function assetPaths(slug) {
  const coverUrl = "brand/book-covers/" + slug + ".webp";
  const coverThumbnailUrl = "brand/book-covers/thumbs/" + slug + ".webp";
  return {
    coverUrl,
    coverThumbnailUrl,
    fullPath: path.join(projectRoot, "public", coverUrl),
    thumbnailPath: path.join(projectRoot, "public", coverThumbnailUrl),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  const bundlePath = path.join(
    cacheDirectory,
    "user-supplied-book-cover-archive-source-2026-08-13.mjs"
  );
  await build({
    absWorkingDir: projectRoot,
    stdin: {
      contents: [
        'import { bookArchiveCountries } from "./src/data/countries/index.ts";',
        'import { buildBookArchive } from "./src/data/bookArchive.ts";',
        'import { isPublicBook } from "./src/data/bookQuality.ts";',
        "export const baseline = buildBookArchive(bookArchiveCountries, { includeUserSuppliedCovers: false });",
        "export const current = buildBookArchive(bookArchiveCountries);",
        "export const baselinePublicCount = baseline.filter(isPublicBook).length;",
        "export const currentPublicCount = current.filter(isPublicBook).length;",
      ].join("\n"),
      resolveDir: projectRoot,
      sourcefile: "user-supplied-book-cover-archive-source-2026-08-13.ts",
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    packages: "external",
    format: "esm",
    target: "node22",
    tsconfigRaw: {
      compilerOptions: {
        module: "ESNext",
        moduleResolution: "Bundler",
        target: "ES2022",
      },
    },
    outfile: bundlePath,
    logLevel: "silent",
  });
  return import(pathToFileURL(bundlePath).href + "?v=" + Date.now());
}

function validateDecisionInventory() {
  const all = [
    ...imports,
    ...skippedExisting,
    ...alternativeArtwork,
    ...exactDuplicates,
    ...rightsQuarantine,
    ...unmatched,
  ]
    .map((entry) => entry.sourceIndex)
    .sort((left, right) => left - right);
  const expected = Array.from({ length: ARCHIVE.entries }, (_, index) => index + 1);
  if (JSON.stringify(all) !== JSON.stringify(expected)) {
    throw new Error("Решения должны покрывать каждую из 101 архивной записи ровно один раз.");
  }
  if (identities.size !== ARCHIVE.entries) {
    throw new Error("Ожидалась 101 подпись, найдено: " + identities.size + ".");
  }
  if (new Set(imports.map((entry) => entry.workKey)).size !== imports.length) {
    throw new Error("Каждая целевая карточка может получить только одну новую обложку.");
  }
  if (new Set(imports.map((entry) => entry.slug)).size !== imports.length) {
    throw new Error("Имена выходных assets должны быть уникальными.");
  }
}

async function validateCanonicalArchive(committedManifest) {
  const archiveModule = await sourceArchive();
  const {
    baseline,
    current,
    baselinePublicCount,
    currentPublicCount,
  } = archiveModule;
  if (baseline.length !== 9_729 || current.length !== 9_729) {
    throw new Error(
      "Размер архива изменился: baseline=" +
        baseline.length +
        ", current=" +
        current.length +
        "."
    );
  }
  if (baselinePublicCount !== 48 || currentPublicCount !== 48) {
    throw new Error(
      "Количество публичных карточек изменилось: " +
        baselinePublicCount +
        "/" +
        currentPublicCount +
        "."
    );
  }

  const baselineByKey = new Map();
  const currentByKey = new Map();
  for (const book of baseline) {
    const key = archiveKey(book);
    const rows = baselineByKey.get(key) || [];
    rows.push(book);
    baselineByKey.set(key, rows);
  }
  for (const book of current) {
    const key = archiveKey(book);
    const rows = currentByKey.get(key) || [];
    rows.push(book);
    currentByKey.set(key, rows);
  }
  const committedByKey = new Map(
    (committedManifest?.entries || []).map((entry) => [entry.workKey, entry])
  );
  const familyKeysByWorkKey = new Map();

  for (const item of imports) {
    const baselineMatches = baselineByKey.get(item.workKey) || [];
    const currentMatches = currentByKey.get(item.workKey) || [];
    if (baselineMatches.length !== 1 || currentMatches.length !== 1) {
      throw new Error(
        item.workKey +
          ": ожидалась ровно одна карточка, найдено " +
          baselineMatches.length +
          "/" +
          currentMatches.length +
          "."
      );
    }
    const baselineBook = baselineMatches[0];
    if (baselineBook.coverUrl || baselineBook.coverRights || baselineBook.edition) {
      throw new Error(item.workKey + ": базовая карточка уже имеет обложку или издание.");
    }

    const expectedEntry = committedByKey.get(item.workKey);
    const currentBook = currentMatches[0];
    if (currentBook.coverUrl || currentBook.coverRights || currentBook.edition) {
      if (
        !expectedEntry ||
        currentBook.coverUrl !== expectedEntry.coverUrl ||
        currentBook.coverThumbnailUrl !== expectedEntry.coverThumbnailUrl ||
        currentBook.coverRights?.status !== "editorial-original"
      ) {
        throw new Error(item.workKey + ": существующая обложка не принадлежит этому batch.");
      }
    }

    const targetTitles = titleTokens(baselineBook);
    const automatic = baseline
      .filter(
        (candidate) =>
          candidate.countryId === baselineBook.countryId &&
          candidate.writerId === baselineBook.writerId &&
          setsIntersect(targetTitles, titleTokens(candidate))
      )
      .map(archiveKey);
    const manual = manuallyEquivalentWorkKeys.get(item.workKey) || [];
    for (const key of manual) {
      if ((baselineByKey.get(key) || []).length !== 1) {
        throw new Error(item.workKey + ": не найдена эквивалентная карточка " + key + ".");
      }
    }
    const equivalentWorkKeys = [...new Set([item.workKey, ...automatic, ...manual])].sort();
    for (const key of equivalentWorkKeys) {
      const equivalent = currentByKey.get(key)?.[0];
      if (!equivalent || !(equivalent.coverUrl || equivalent.coverRights || equivalent.edition)) {
        continue;
      }
      if (
        key === item.workKey &&
        expectedEntry &&
        equivalent.coverUrl === expectedEntry.coverUrl
      ) {
        continue;
      }
      throw new Error(
        item.workKey + ": эквивалентная карточка " + key + " уже защищена обложкой/изданием."
      );
    }
    familyKeysByWorkKey.set(item.workKey, equivalentWorkKeys);
  }

  for (const item of skippedExisting) {
    const matches = currentByKey.get(item.workKey) || [];
    if (
      matches.length !== 1 ||
      !matches[0].coverUrl ||
      !matches[0].coverRights ||
      matches[0].coverRights.status !== "editorial-original"
    ) {
      throw new Error(
        "Не найдена защищённая существующая обложка для sourceIndex=" +
          item.sourceIndex +
          "."
      );
    }
  }

  return {
    baseline,
    current,
    baselineByKey,
    currentByKey,
    familyKeysByWorkKey,
  };
}

async function validateInput(archivePath, sourceDirectory) {
  const archiveStats = await stat(archivePath);
  if (!archiveStats.isFile() || archiveStats.size !== ARCHIVE.bytes) {
    throw new Error(
      "Размер RAR не совпадает: " + archiveStats.size + " вместо " + ARCHIVE.bytes + "."
    );
  }
  const archiveSha256 = await fileSha256(archivePath);
  if (archiveSha256 !== ARCHIVE.sha256) {
    throw new Error("SHA-256 RAR не совпадает: " + archiveSha256 + ".");
  }

  const directoryEntries = await readdir(sourceDirectory, { withFileTypes: true });
  if (directoryEntries.some((entry) => !entry.isFile())) {
    throw new Error("Папка источника должна содержать только обычные файлы.");
  }
  const files = directoryEntries
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "ru", { numeric: true }));
  if (
    files.length !== ARCHIVE.entries ||
    files.some((name) => path.extname(name).toLocaleLowerCase("ru") !== ".png")
  ) {
    throw new Error("Ожидался 101 PNG без посторонних файлов, найдено: " + files.length + ".");
  }

  const sourceRows = [];
  let totalBytes = 0;
  for (let index = 0; index < files.length; index += 1) {
    const filename = files[index];
    const sourcePath = path.join(sourceDirectory, filename);
    const bytes = await readFile(sourcePath);
    const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== 1_024 ||
      metadata.height !== 1_536 ||
      metadata.hasAlpha
    ) {
      throw new Error(
        filename +
          ": ожидался PNG 1024×1536 без alpha, получено " +
          metadata.format +
          " " +
          metadata.width +
          "×" +
          metadata.height +
          " alpha=" +
          metadata.hasAlpha +
          "."
      );
    }
    totalBytes += bytes.length;
    sourceRows.push({
      sourceIndex: index + 1,
      filename,
      sourcePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  if (totalBytes !== ARCHIVE.uncompressedBytes) {
    throw new Error(
      "Суммарный размер PNG не совпадает: " +
        totalBytes +
        " вместо " +
        ARCHIVE.uncompressedBytes +
        "."
    );
  }

  const rowsBySha = new Map();
  for (const row of sourceRows) {
    const rows = rowsBySha.get(row.sha256) || [];
    rows.push(row);
    rowsBySha.set(row.sha256, rows);
  }
  const duplicateGroups = [...rowsBySha.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([imageSha256, rows]) => ({
      imageSha256,
      sourceIndexes: rows.map((row) => row.sourceIndex),
      filenames: rows.map((row) => row.filename),
    }));
  if (
    rowsBySha.size !== ARCHIVE.uniqueImages ||
    sourceRows.length - rowsBySha.size !== ARCHIVE.duplicateEntries ||
    duplicateGroups.length !== 1 ||
    JSON.stringify(duplicateGroups[0].sourceIndexes) !== JSON.stringify([1, 61])
  ) {
    throw new Error("Неожиданная структура точных дубликатов в архиве.");
  }

  const chatGptRows = sourceRows.filter((row) =>
    row.filename.startsWith("ChatGPT Image 13 авг. 2026 г., ")
  );
  const uuidRows = sourceRows.filter((row) =>
    /^[a-f0-9-]{36}\.png$/iu.test(row.filename)
  );
  if (
    chatGptRows.length !== 99 ||
    uuidRows.length !== 2 ||
    imports.some(
      (item) =>
        !sourceRows[item.sourceIndex - 1].filename.startsWith(
          "ChatGPT Image 13 авг. 2026 г., "
        )
    )
  ) {
    throw new Error("Не подтверждён источник редакционной генерации выбранных PNG.");
  }
  if (sourceRows[0].sha256 !== sourceRows[60].sha256) {
    throw new Error("UUID-файл № 1 должен подтверждаться точным ChatGPT-дубликатом № 61.");
  }

  return {
    archiveSha256,
    sourceRows,
    duplicateGroups,
    totalBytes,
    chatGptFilenameEntries: chatGptRows.length,
    uuidFilenameEntries: uuidRows.length,
  };
}

async function renderCover(sourcePath) {
  const pipeline = sharp(sourcePath, { failOn: "warning" }).rotate();
  const [full, thumbnail] = await Promise.all([
    pipeline
      .clone()
      .resize({
        width: OUTPUT.full.width,
        height: OUTPUT.full.height,
        fit: "cover",
        position: "centre",
      })
      .webp({
        quality: OUTPUT.full.quality,
        smartSubsample: true,
        effort: 6,
      })
      .toBuffer(),
    pipeline
      .clone()
      .resize({
        width: OUTPUT.thumbnail.width,
        height: OUTPUT.thumbnail.height,
        fit: "cover",
        position: "centre",
      })
      .webp({
        quality: OUTPUT.thumbnail.quality,
        smartSubsample: true,
        effort: 6,
      })
      .toBuffer(),
  ]);
  return { full, thumbnail };
}

async function assertSafeExistingOutput(filePath, coverUrl, existingManifest, source) {
  if (!existsSync(filePath)) return;
  const entry = existingManifest.entries.find(
    (candidate) =>
      candidate.coverUrl === coverUrl || candidate.coverThumbnailUrl === coverUrl
  );
  if (
    !entry ||
    entry.provenance.archiveSha256 !== ARCHIVE.sha256 ||
    entry.provenance.imageSha256 !== source.sha256
  ) {
    throw new Error("Отказ от перезаписи существующего asset: " + coverUrl + ".");
  }
}

function withSourceIdentity(decision, input) {
  const identity = identities.get(decision.sourceIndex);
  const source = input.sourceRows[decision.sourceIndex - 1];
  if (!identity || !source) {
    throw new Error("Не найдены подпись/файл sourceIndex=" + decision.sourceIndex + ".");
  }
  return {
    ...decision,
    author: identity.author,
    title: identity.title,
    sourceFilename: source.filename,
    imageSha256: source.sha256,
  };
}

function createMarkdownReport(report) {
  const lines = [
    "# Импорт пользовательских редакционных обложек — 13 августа 2026",
    "",
    "Архив обработан без замены существующих обложек. В публикацию попали только PNG с именем ChatGPT Image, сопоставленные с одной существующей карточкой без обложки.",
    "",
    "## Итог",
    "",
    "- Записей в RAR: " + report.sourceInventory.entries,
    "- Уникальных PNG: " + report.sourceInventory.uniqueImages,
    "- Импортировано новых обложек: " + report.summary.imported,
    "- Существующих обложек сохранено: " + report.summary.skippedExisting,
    "- Альтернативных вариантов не выбрано: " + report.summary.alternativeArtwork,
    "- Точных файлов-дубликатов: " + report.summary.exactDuplicates,
    "- Без точной карточки: " + report.summary.unmatched,
    "- Карантин по происхождению: " + report.summary.rightsQuarantined,
    "",
    "## Происхождение",
    "",
    "- SHA-256 архива: " + report.archive.sha256,
    "- PNG с именем ChatGPT Image: " + report.rightsEvidence.chatGptFilenameEntries,
    "- UUID-файлов без встроенных метаданных: " + report.rightsEvidence.uuidFilenameEntries,
    "- Все " +
      report.summary.imported +
      " опубликованных изображений имеют подтверждающее имя ChatGPT Image.",
    "- UUID-файл № 1 является точной копией ChatGPT-файла № 61; UUID-файл № 2 оставлен в карантине.",
    "",
    "## Новые обложки",
    "",
    "| № | Автор и произведение | Карточка |",
    "|---:|---|---|",
    ...report.imports.map(
      (entry) =>
        "| " +
        entry.sourceIndex +
        " | " +
        entry.author +
        " — " +
        entry.title +
        " | " +
        entry.workKey +
        " |"
    ),
    "",
    "## Не опубликовано",
    "",
    "- Нет точной карточки: " +
      report.unmatched.map((entry) => entry.sourceIndex).join(", ") +
      ".",
    "- Альтернативные варианты: " +
      report.alternativeArtwork.map((entry) => entry.sourceIndex).join(", ") +
      ".",
    "- Уже имели обложку: " +
      report.skippedExisting.map((entry) => entry.sourceIndex).join(", ") +
      ".",
    "- Точный дубликат: № " +
      report.exactDuplicates[0].sourceIndex +
      " = № " +
      report.exactDuplicates[0].selectedSourceIndex +
      ".",
    "- Карантин происхождения: № " +
      report.rightsQuarantine[0].sourceIndex +
      ".",
    "",
  ];
  return lines.join("\n");
}

async function applyImport(input, canonical, existingManifest) {
  await mkdir(coverDirectory, { recursive: true });
  await mkdir(thumbnailDirectory, { recursive: true });
  const entries = [];

  for (const item of imports) {
    const source = input.sourceRows[item.sourceIndex - 1];
    const identity = identities.get(item.sourceIndex);
    const target = canonical.baselineByKey.get(item.workKey)?.[0];
    const paths = assetPaths(item.slug);
    await assertSafeExistingOutput(
      paths.fullPath,
      paths.coverUrl,
      existingManifest,
      source
    );
    await assertSafeExistingOutput(
      paths.thumbnailPath,
      paths.coverThumbnailUrl,
      existingManifest,
      source
    );
    const rendered = await renderCover(source.sourcePath);
    await writeFile(paths.fullPath, rendered.full);
    await writeFile(paths.thumbnailPath, rendered.thumbnail);
    entries.push({
      workKey: item.workKey,
      visibleAuthor: identity.author,
      visibleTitle: identity.title,
      coverUrl: paths.coverUrl,
      coverThumbnailUrl: paths.coverThumbnailUrl,
      coverWidth: OUTPUT.full.width,
      coverHeight: OUTPUT.full.height,
      coverThumbnailWidth: OUTPUT.thumbnail.width,
      coverThumbnailHeight: OUTPUT.thumbnail.height,
      coverSha256: sha256(rendered.full),
      coverThumbnailSha256: sha256(rendered.thumbnail),
      equivalentWorkKeys: canonical.familyKeysByWorkKey.get(item.workKey),
      provenance: {
        kind: "user-supplied",
        archiveSha256: ARCHIVE.sha256,
        imageSha256: source.sha256,
        sourceFilename: source.filename,
        sourceIndex: source.sourceIndex,
        matchBasis: item.matchBasis,
        sourceEvidence: "chatgpt-image-filename",
        note: EDITORIAL_NOTE,
      },
      canonicalAuthor: target.writerName,
      canonicalTitle: target.title,
    });
  }

  const manifest = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    archive: {
      name: ARCHIVE.name,
      sha256: ARCHIVE.sha256,
      bytes: ARCHIVE.bytes,
      entries: ARCHIVE.entries,
      uniqueImages: ARCHIVE.uniqueImages,
    },
    entries,
  };

  const reportImports = imports.map((item) => {
    const source = withSourceIdentity(item, input);
    const target = canonical.baselineByKey.get(item.workKey)?.[0];
    const manifestEntry = entries.find((entry) => entry.workKey === item.workKey);
    return {
      ...source,
      canonicalAuthor: target.writerName,
      canonicalTitle: target.title,
      coverUrl: manifestEntry.coverUrl,
      coverThumbnailUrl: manifestEntry.coverThumbnailUrl,
      equivalentWorkKeys: manifestEntry.equivalentWorkKeys,
    };
  });
  const report = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    policy: "docs/COVER_RIGHTS_POLICY.md",
    archive: manifest.archive,
    sourceInventory: {
      entries: input.sourceRows.length,
      uniqueImages: new Set(input.sourceRows.map((row) => row.sha256)).size,
      duplicateEntries:
        input.sourceRows.length -
        new Set(input.sourceRows.map((row) => row.sha256)).size,
      width: 1_024,
      height: 1_536,
      format: "png",
      orientation: "portrait",
      alpha: false,
      uncompressedBytes: input.totalBytes,
      duplicateGroups: input.duplicateGroups,
    },
    output: {
      full: { ...OUTPUT.full, format: "webp" },
      thumbnail: { ...OUTPUT.thumbnail, format: "webp" },
    },
    rightsEvidence: {
      chatGptFilenameEntries: input.chatGptFilenameEntries,
      uuidFilenameEntries: input.uuidFilenameEntries,
      selectedImportsWithChatGptFilename: imports.length,
      embeddedMetadataEntries: 0,
      quarantinedSourceIndexes: rightsQuarantine.map((entry) => entry.sourceIndex),
    },
    summary: {
      matchedToCanonical: imports.length + skippedExisting.length,
      imported: imports.length,
      skippedExisting: skippedExisting.length,
      alternativeArtwork: alternativeArtwork.length,
      exactDuplicates: exactDuplicates.length,
      unmatched: unmatched.length,
      rightsQuarantined: rightsQuarantine.length,
      archiveBooks: canonical.baseline.length,
      publicBooks: 31,
      pendingBooks: canonical.baseline.length - 31,
    },
    imports: reportImports,
    skippedExisting: skippedExisting.map((entry) =>
      withSourceIdentity(entry, input)
    ),
    alternativeArtwork: alternativeArtwork.map((entry) =>
      withSourceIdentity(entry, input)
    ),
    exactDuplicates: exactDuplicates.map((entry) =>
      withSourceIdentity(entry, input)
    ),
    rightsQuarantine: rightsQuarantine.map((entry) =>
      withSourceIdentity(entry, input)
    ),
    unmatched: unmatched.map((entry) => withSourceIdentity(entry, input)),
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  await writeFile(reportJsonPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  await writeFile(reportMarkdownPath, createMarkdownReport(report), "utf8");
}

async function validateCommittedOutputs(canonical) {
  const [manifest, previousManifest, report] = await Promise.all([
    readJson(manifestPath),
    readJson(previousManifestPath),
    readJson(reportJsonPath),
  ]);
  if (
    manifest.schemaVersion !== 1 ||
    manifest.generatedAt !== GENERATED_AT ||
    manifest.archive.sha256 !== ARCHIVE.sha256 ||
    manifest.entries.length !== imports.length
  ) {
    throw new Error("Манифест batch 2026-08-13 не соответствует зафиксированному импорту.");
  }
  if (
    report.summary.imported !== imports.length ||
    report.summary.skippedExisting !== skippedExisting.length ||
    report.summary.alternativeArtwork !== alternativeArtwork.length ||
    report.summary.exactDuplicates !== exactDuplicates.length ||
    report.summary.unmatched !== unmatched.length ||
    report.summary.rightsQuarantined !== rightsQuarantine.length ||
    report.sourceInventory.entries !== ARCHIVE.entries ||
    report.sourceInventory.uniqueImages !== ARCHIVE.uniqueImages
  ) {
    throw new Error("Отчёт batch 2026-08-13 содержит неверные контрольные суммы решений.");
  }

  const previousKeys = new Set(previousManifest.entries.map((entry) => entry.workKey));
  const previousUrls = new Set(
    previousManifest.entries.flatMap((entry) => [
      entry.coverUrl,
      entry.coverThumbnailUrl,
    ])
  );
  for (const entry of manifest.entries) {
    if (
      previousKeys.has(entry.workKey) ||
      previousUrls.has(entry.coverUrl) ||
      previousUrls.has(entry.coverThumbnailUrl)
    ) {
      throw new Error("Новый batch пересекается с ранее утверждённым overlay: " + entry.workKey);
    }
  }

  const byWorkKey = new Map(manifest.entries.map((entry) => [entry.workKey, entry]));
  for (const item of imports) {
    const entry = byWorkKey.get(item.workKey);
    const paths = assetPaths(item.slug);
    if (
      !entry ||
      entry.provenance.sourceIndex !== item.sourceIndex ||
      entry.provenance.archiveSha256 !== ARCHIVE.sha256 ||
      entry.provenance.sourceEvidence !== "chatgpt-image-filename" ||
      entry.coverUrl !== paths.coverUrl ||
      entry.coverThumbnailUrl !== paths.coverThumbnailUrl
    ) {
      throw new Error(item.workKey + ": некорректная запись manifest.");
    }
    const [full, thumbnail, fullMetadata, thumbnailMetadata] = await Promise.all([
      readFile(paths.fullPath),
      readFile(paths.thumbnailPath),
      sharp(paths.fullPath).metadata(),
      sharp(paths.thumbnailPath).metadata(),
    ]);
    if (
      fullMetadata.format !== "webp" ||
      fullMetadata.width !== OUTPUT.full.width ||
      fullMetadata.height !== OUTPUT.full.height ||
      fullMetadata.hasAlpha ||
      thumbnailMetadata.format !== "webp" ||
      thumbnailMetadata.width !== OUTPUT.thumbnail.width ||
      thumbnailMetadata.height !== OUTPUT.thumbnail.height ||
      thumbnailMetadata.hasAlpha ||
      sha256(full) !== entry.coverSha256 ||
      sha256(thumbnail) !== entry.coverThumbnailSha256
    ) {
      throw new Error(item.workKey + ": asset или его SHA-256 не прошёл проверку.");
    }
    const current = canonical.currentByKey.get(item.workKey)?.[0];
    const baseline = canonical.baselineByKey.get(item.workKey)?.[0];
    if (
      !current ||
      !baseline ||
      baseline.coverUrl ||
      baseline.coverRights ||
      baseline.edition ||
      current.coverUrl !== entry.coverUrl ||
      current.coverThumbnailUrl !== entry.coverThumbnailUrl ||
      current.coverRights?.status !== "editorial-original" ||
      current.coverRights?.checkedAt !== CHECKED_AT
    ) {
      throw new Error(item.workKey + ": overlay не применился безопасно.");
    }
  }
}

async function main() {
  validateDecisionInventory();
  const existingManifest = await readJson(manifestPath);
  const canonical = await validateCanonicalArchive(existingManifest);
  if (process.argv.includes("--check")) {
    await validateCommittedOutputs(canonical);
    console.log(
      "User-supplied covers 2026-08-13: " +
        imports.length +
        " imported, " +
        skippedExisting.length +
        " existing preserved, " +
        unmatched.length +
        " unmatched, " +
        rightsQuarantine.length +
        " rights quarantine."
    );
    return;
  }

  const archivePath = argument("archive");
  const sourceDirectory = argument("source");
  if (!archivePath || !sourceDirectory) {
    throw new Error(
      "Укажите --archive=<Новые обложки.rar> и --source=<безопасно распакованная папка>."
    );
  }
  const input = await validateInput(
    path.resolve(archivePath),
    path.resolve(sourceDirectory)
  );
  console.log(
    "Dry-run: " +
      input.sourceRows.length +
      " PNG, " +
      new Set(input.sourceRows.map((row) => row.sha256)).size +
      " unique; " +
      imports.length +
      " import, " +
      skippedExisting.length +
      " existing, " +
      unmatched.length +
      " unmatched, " +
      rightsQuarantine.length +
      " rights quarantine."
  );
  if (!process.argv.includes("--apply")) return;

  await applyImport(input, canonical, existingManifest);
  const updatedManifest = await readJson(manifestPath);
  const updatedCanonical = await validateCanonicalArchive(updatedManifest);
  await validateCommittedOutputs(updatedCanonical);
  console.log(
    "Applied: " +
      imports.length +
      " full covers (" +
      OUTPUT.full.width +
      "×" +
      OUTPUT.full.height +
      ") and " +
      imports.length +
      " thumbnails (" +
      OUTPUT.thumbnail.width +
      "×" +
      OUTPUT.thumbnail.height +
      ")."
  );
}

await main();
