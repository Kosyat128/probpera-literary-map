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
  "userSuppliedBookCovers.generated.json"
);
const reportJsonPath = path.join(
  projectRoot,
  "reports",
  "user-supplied-book-cover-import-2026-08-11.json"
);
const reportMarkdownPath = path.join(
  projectRoot,
  "reports",
  "user-supplied-book-cover-import-2026-08-11.md"
);
const coverDirectory = path.join(projectRoot, "public", "brand", "book-covers");
const thumbnailDirectory = path.join(coverDirectory, "thumbs");

const GENERATED_AT = "2026-08-11T00:00:00.000Z";
const EDITORIAL_NOTE =
  "Предоставленная пользователем редакционная иллюстрация; не является обложкой конкретного издательского издания.";
const OUTPUT = Object.freeze({
  full: Object.freeze({ width: 720, height: 1_080, quality: 88 }),
  thumbnail: Object.freeze({ width: 360, height: 540, quality: 86 }),
});
const ARCHIVE = Object.freeze({
  name: "Новые обложки.rar",
  sha256: "7778202af51486bc609b24b98997735bcfb211b309f257734618aae1be93857b",
  bytes: 244_810_832,
  entries: 87,
  uniqueImages: 77,
  duplicateEntries: 10,
  uncompressedBytes: 252_320_122,
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
        throw new Error(`Некорректная строка решения: ${line}`);
      }
      return Object.fromEntries(
        columns.map((column, index) => [
          column,
          column === "sourceIndex" ? Number(fields[index]) : fields[index],
        ])
      );
    });
}

const imports = parseRows(
  `
1|germany:johann_wolfgang_goethe:legacy-johann_wolfgang_goethe-фауст|faust-editorial|exact-author-and-title
2|russia:tolstoy:legacy-tolstoy-воскресение|resurrection-editorial|exact-author-and-title
3|usa:jack_london:legacy-jack_london-мартин-иден|martin-eden-editorial|exact-author-and-title
4|france:victor_hugo:legacy-victor_hugo-человек-который-смеётся|the-man-who-laughs-editorial|exact-author-and-title
6|france:jean_paul_sartre:legacy-jean_paul_sartre-тошнота|nausea-editorial|exact-author-and-title
8|england:john_fowles:article-catalog-1f3vwe6|the-collector-editorial|exact-author-and-title
9|germany:patrick_suskind:legacy-patrick_suskind-парфюмер|perfume-editorial|exact-author-and-title
10|england:anthony_burgess:article-catalog-uud44v|a-clockwork-orange-editorial|exact-author-and-title
11|italy:dante_alighieri:legacy-dante_alighieri-божественная-комедия|divine-comedy-editorial|exact-author-and-title
12|england:charles_dickens:openlibrary-works-ol14868510w|bleak-house-editorial|verified-author-and-bibliographic-title-alias
13|usa:theodore_dreiser:legacy-theodore_dreiser-сестра-керри|sister-carrie-editorial|exact-author-and-title
15|france:jules_verne:openlibrary-works-ol1099364w|children-of-captain-grant-editorial|verified-author-and-bibliographic-title-alias
16|russia:sholokhov:legacy-sholokhov-поднятая-целина|virgin-soil-upturned-editorial|exact-author-and-title
17|usa:edgar_allan_poe:openlibrary-works-ol40962w|arthur-gordon-pym-editorial|verified-author-and-bibliographic-title-alias
18|poland:joseph_conrad:openlibrary-works-ol38684w|lord-jim-editorial|verified-author-and-bibliographic-title-alias
20|france:maupassant:legacy-maupassant-милый-друг|bel-ami-editorial|exact-author-and-title
23|france:emile_zola:openlibrary-works-ol118984w|nana-editorial|verified-author-and-bibliographic-title-alias
24|england:william_thackeray:legacy-william_thackeray-ярмарка-тщеславия|vanity-fair-editorial|exact-author-and-title
27|russia:goncharov:legacy-goncharov-обыкновенная-история|a-common-story-editorial|exact-author-and-title
28|germany:heinrich_boell:legacy-heinrich_boell-глазами-клоуна|the-clown-editorial|exact-author-and-title
29|usa:ernest_hemingway:legacy-ernest_hemingway-прощай-оружие|a-farewell-to-arms-editorial|exact-author-and-title
31|colombia:gabriel_garcia_marquez:legacy-gabriel_garcia_marquez-любовь-во-время-чумы|love-in-the-time-of-cholera-editorial|verified-author-and-bibliographic-title-alias
32|usa:ernest_hemingway:the-old-man-and-the-sea|the-old-man-and-the-sea-editorial|exact-author-and-title
34|usa:jack_london:legacy-jack_london-зов-предков|the-call-of-the-wild-editorial|exact-author-and-title
36|usa:john_steinbeck:legacy-john_steinbeck-о-мышах-и-людях|of-mice-and-men-editorial|exact-author-and-title
38|russia:leskov:legacy-leskov-леди-макбет-мценского-уезда|lady-macbeth-of-mtsensk-editorial|exact-author-and-title
39|russia:pushkin:openlibrary-works-ol623479w|queen-of-spades-editorial|verified-author-and-bibliographic-title-alias
40|russia:dostoevsky:openlibrary-works-ol21025633w|notes-from-underground-editorial|verified-author-and-bibliographic-title-alias
42|russia:chekhov:legacy-chekhov-чайка|the-seagull-editorial|exact-author-and-title
43|russia:gogol:openlibrary-works-ol40184705w|the-portrait-editorial|verified-author-and-bibliographic-title-alias
45|russia:ostrovsky:legacy-ostrovsky-бесприданница|without-a-dowry-editorial|exact-author-and-title
46|russia:turgenev:legacy-turgenev-записки-охотника|a-sportsmans-sketches-editorial|exact-author-and-title
48|russia:dostoevsky:openlibrary-works-ol166923w|the-gambler-editorial|verified-author-and-bibliographic-title-alias
51|england:arthur_conan_doyle:legacy-arthur_conan_doyle-собака-баскервилей|the-hound-of-the-baskervilles-editorial|exact-author-and-title
52|france:marcel_proust:legacy-marcel_proust-в-поисках-утраченного-времени|in-search-of-lost-time-editorial|exact-author-and-title
53|usa:vladimir_nabokov:legacy-vladimir_nabokov-приглашение-на-казнь|invitation-to-a-beheading-editorial|exact-author-and-title
54|england:h_g_wells:legacy-h_g_wells-остров-доктора-моро|island-of-doctor-moreau-editorial|exact-author-and-title
56|norway:henrik_ibsen:legacy-henrik_ibsen-кукольный-дом|a-dolls-house-editorial|exact-author-and-title
57|usa:henry_james:legacy-henry_james-портрет-леди|the-portrait-of-a-lady-editorial|verified-author-and-bibliographic-title-alias
58|france:flaubert:legacy-flaubert-саламбо|salammbo-editorial|exact-author-and-title
61|russia:buninin:legacy-buninin-тёмные-аллеи|dark-avenues-editorial|exact-author-and-title
63|england:thomas_hardy:legacy-thomas_hardy-вдали-от-обезумевшей-толпы|far-from-the-madding-crowd-editorial|exact-author-and-title
64|usa:theodore_dreiser:legacy-theodore_dreiser-финансист|the-financier-editorial|exact-author-and-title
65|usa:william_faulkner:legacy-william_faulkner-свет-в-августе|light-in-august-editorial|exact-author-and-title
66|germany:erich_maria_remarque:article-catalog-rdkl2z|the-black-obelisk-editorial|exact-author-and-title
67|russia:turgenev:legacy-turgenev-дворянское-гнездо|home-of-the-gentry-editorial|exact-author-and-title
69|france:jules_verne:legacy-jules_verne-вокруг-света-за-80-дней|around-the-world-in-eighty-days-editorial|verified-author-and-bibliographic-title-alias
70|russia:dostoevsky:openlibrary-works-ol36196411w|white-nights-editorial|verified-author-and-bibliographic-title-alias
71|russia:gogol:openlibrary-works-ol270278w|taras-bulba-editorial|verified-author-and-bibliographic-title-alias
72|russia:pushkin:openlibrary-works-ol623491w|dubrovsky-editorial|verified-author-and-bibliographic-title-alias
73|england:jane_austen:legacy-jane_austen-эмма|emma-editorial|exact-author-and-title
74|england:virginia_woolf:legacy-virginia_woolf-миссис-дэллоуэй|mrs-dalloway-editorial|exact-author-and-title
76|usa:edith_wharton:legacy-edith_wharton-эпоха-невинности|the-age-of-innocence-editorial|verified-author-and-bibliographic-title-alias
77|usa:john_steinbeck:openlibrary-works-ol23190w|the-winter-of-our-discontent-editorial|verified-author-and-bibliographic-title-alias
  `,
  ["sourceIndex", "workKey", "slug", "matchBasis"]
);

const skippedExisting = parseRows(
  `
21|england:charles_dickens:oliver-twist-editorial
22|usa:vladimir_nabokov:lolita-editorial
33|usa:ray_bradbury:dandelion-wine-editorial
35|usa:john_steinbeck:the-grapes-of-wrath-editorial
47|usa:francis_scott_fitzgerald:tender-is-the-night
59|russia:bulgakov:heart-of-a-dog-editorial
  `,
  ["sourceIndex", "workKey"]
);

const duplicateArtwork = [
  {
    sourceIndex: 50,
    selectedSourceIndex: 23,
    workKey: "france:emile_zola:openlibrary-works-ol118984w",
    reason: "second-artwork-for-same-work",
  },
];

const ambiguous = [
  {
    sourceIndex: 5,
    candidates: [
      "germany:hermann_hesse:legacy-hermann_hesse-степной-волк",
      "switzerland:hermann_hesse:legacy-hermann_hesse-степной-волк",
    ],
    reason: "same-work-country-duplicates-without-canonical-authority",
  },
  {
    sourceIndex: 68,
    candidates: [
      "germany:hermann_hesse:legacy-hermann_hesse-степной-волк",
      "switzerland:hermann_hesse:legacy-hermann_hesse-степной-волк",
    ],
    reason: "same-work-country-duplicates-without-canonical-authority",
  },
];

const unmatched = parseRows(
  `
7|no-exact-author-work-in-canonical-archive
14|no-exact-author-work-in-canonical-archive
19|no-exact-author-work-in-canonical-archive
25|standalone-work-absent-only-composite-collection-found
26|no-exact-author-work-in-canonical-archive
30|no-exact-author-work-in-canonical-archive
37|no-exact-author-work-in-canonical-archive
41|no-exact-author-work-in-canonical-archive
44|no-exact-author-work-in-canonical-archive
49|no-exact-author-work-in-canonical-archive
55|no-exact-author-work-in-canonical-archive
60|no-exact-author-work-in-canonical-archive
62|no-exact-author-work-in-canonical-archive
75|no-exact-author-work-in-canonical-archive
  `,
  ["sourceIndex", "reason"]
);

const identified = new Map(
  parseRows(
    `
1|Иоганн Вольфганг Гёте|Фауст
2|Лев Толстой|Воскресение
3|Джек Лондон|Мартин Иден
4|Виктор Гюго|Человек, который смеётся
5|Герман Гессе|Степной волк
6|Жан-Поль Сартр|Тошнота
7|Евгений Замятин|Мы
8|Джон Фаулз|Коллекционер
9|Патрик Зюскинд|Парфюмер
10|Энтони Бёрджесс|Заводной апельсин
11|Данте Алигьери|Божественная комедия
12|Чарльз Диккенс|Холодный дом
13|Теодор Драйзер|Сестра Керри
14|Александр Грин|Бегущая по волнам
15|Жюль Верн|Дети капитана Гранта
16|Михаил Шолохов|Поднятая целина
17|Эдгар Аллан По|Повесть о приключениях Артура Гордона Пима
18|Джозеф Конрад|Лорд Джим
19|Сомерсет Моэм|Бремя страстей человеческих
20|Ги де Мопассан|Милый друг
21|Чарльз Диккенс|Оливер Твист
22|Владимир Набоков|Лолита
23|Эмиль Золя|Нана
24|Уильям Мейкпис Теккерей|Ярмарка тщеславия
25|Лев Толстой|Крейцерова соната
26|Александр Куприн|Гранатовый браслет
27|Иван Гончаров|Обыкновенная история
28|Генрих Бёлль|Глазами клоуна
29|Эрнест Хемингуэй|Прощай, оружие!
30|Ромен Гари|Обещание на рассвете
31|Габриэль Гарсиа Маркес|Любовь во время холеры
32|Эрнест Хемингуэй|Старик и море
33|Рэй Брэдбери|Вино из одуванчиков
34|Джек Лондон|Зов предков
35|Джон Стейнбек|Гроздья гнева
36|Джон Стейнбек|О мышах и людях
37|Колин Маккалоу|Поющие в терновнике
38|Николай Лесков|Леди Макбет Мценского уезда
39|Александр Пушкин|Пиковая дама
40|Фёдор Достоевский|Записки из подполья
41|Маргарет Митчелл|Унесённые ветром
42|Антон Чехов|Чайка
43|Николай Гоголь|Портрет
44|Уильям Сомерсет Моэм|Луна и грош
45|Александр Островский|Бесприданница
46|Иван Тургенев|Записки охотника
47|Фрэнсис Скотт Фицджеральд|Ночь нежна
48|Фёдор Достоевский|Игрок
49|Фрэнсис Ходжсон Бёрнетт|Таинственный сад
50|Эмиль Золя|Нана
51|Артур Конан Дойл|Собака Баскервилей
52|Марсель Пруст|В поисках утраченного времени
53|Владимир Набоков|Приглашение на казнь
54|Герберт Уэллс|Остров доктора Моро
55|Джером К. Джером|Трое в лодке, не считая собаки
56|Генрик Ибсен|Кукольный дом
57|Генри Джеймс|Портрет дамы
58|Гюстав Флобер|Саламбо
59|Михаил Булгаков|Собачье сердце
60|Михаил Лермонтов|Маскарад
61|Иван Бунин|Тёмные аллеи
62|Александр Куприн|Олеся
63|Томас Гарди|Вдали от обезумевшей толпы
64|Теодор Драйзер|Финансист
65|Уильям Фолкнер|Свет в августе
66|Эрих Мария Ремарк|Чёрный обелиск
67|Иван Тургенев|Дворянское гнездо
68|Герман Гессе|Степной волк
69|Жюль Верн|Вокруг света за восемьдесят дней
70|Фёдор Достоевский|Белые ночи
71|Николай Гоголь|Тарас Бульба
72|Александр Пушкин|Дубровский
73|Джейн Остин|Эмма
74|Вирджиния Вулф|Миссис Дэллоуэй
75|Оноре де Бальзак|Шагреневая кожа
76|Эдит Уортон|Век невинности
77|Джон Стейнбек|Зима тревоги нашей
    `,
    ["sourceIndex", "author", "title"]
  ).map((entry) => [entry.sourceIndex, entry])
);

const manuallyEquivalentWorkKeys = new Map([
  [
    "usa:henry_james:legacy-henry_james-портрет-леди",
    ["usa:henry_james:openlibrary-works-ol276365w"],
  ],
  [
    "france:jules_verne:legacy-jules_verne-вокруг-света-за-80-дней",
    [
      "france:jules_verne:openlibrary-works-ol1100007w",
      "france:jules_verne:openlibrary-works-ol20984945w",
    ],
  ],
  [
    "usa:edith_wharton:legacy-edith_wharton-эпоха-невинности",
    ["usa:edith_wharton:openlibrary-works-ol98491w"],
  ],
]);

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileSha256(filePath) {
  return sha256(await readFile(filePath));
}

function archiveKey(book) {
  return `${book.countryId}:${book.writerId}:${book.id}`;
}

function normalizeTitle(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("ru")
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

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  const bundlePath = path.join(
    cacheDirectory,
    "user-supplied-book-cover-archive-source.mjs"
  );
  await build({
    absWorkingDir: projectRoot,
    stdin: {
      contents: `
        import { bookArchiveCountries } from "./src/data/countries/index.ts";
        import { buildBookArchive } from "./src/data/bookArchive.ts";
        import { isPublicBook } from "./src/data/bookQuality.ts";

        export const baseline = buildBookArchive(bookArchiveCountries, {
          includeUserSuppliedCovers: false,
        });
        export const current = buildBookArchive(bookArchiveCountries);
        export const baselinePublicCount = baseline.filter(isPublicBook).length;
        export const currentPublicCount = current.filter(isPublicBook).length;
      `,
      resolveDir: projectRoot,
      sourcefile: "user-supplied-book-cover-archive-source.ts",
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
  return import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
}

function validateDecisionInventory() {
  const all = [
    ...imports.map(({ sourceIndex }) => sourceIndex),
    ...skippedExisting.map(({ sourceIndex }) => sourceIndex),
    ...duplicateArtwork.map(({ sourceIndex }) => sourceIndex),
    ...ambiguous.map(({ sourceIndex }) => sourceIndex),
    ...unmatched.map(({ sourceIndex }) => sourceIndex),
  ].sort((left, right) => left - right);
  const expected = Array.from({ length: ARCHIVE.uniqueImages }, (_, index) => index + 1);
  if (JSON.stringify(all) !== JSON.stringify(expected)) {
    throw new Error("Решения не покрывают каждое из 77 уникальных изображений ровно один раз.");
  }
  if (identified.size !== ARCHIVE.uniqueImages) {
    throw new Error(`Ожидалось 77 подписей, найдено ${identified.size}.`);
  }
  if (new Set(imports.map(({ slug }) => slug)).size !== imports.length) {
    throw new Error("Имена выходных assets должны быть уникальными.");
  }
  if (new Set(imports.map(({ workKey }) => workKey)).size !== imports.length) {
    throw new Error("Каждое произведение можно импортировать только один раз.");
  }
}

async function validateCanonicalArchive() {
  const archiveModule = await sourceArchive();
  const { baseline, current, baselinePublicCount, currentPublicCount } = archiveModule;
  if (baseline.length !== 9_768 || current.length !== 9_768) {
    throw new Error(
      `Размер архива изменился: baseline=${baseline.length}, current=${current.length}.`
    );
  }
  if (
    baselinePublicCount !== 48 ||
    currentPublicCount !== 48 ||
    baseline.length - baselinePublicCount !== 9_720 ||
    current.length - currentPublicCount !== 9_720
  ) {
    throw new Error(
      `Публичные/ожидающие карточки изменились: baseline=${baselinePublicCount}/${baseline.length - baselinePublicCount}, current=${currentPublicCount}/${current.length - currentPublicCount}.`
    );
  }

  const byKey = new Map();
  for (const book of baseline) {
    const key = archiveKey(book);
    const entries = byKey.get(key) || [];
    entries.push(book);
    byKey.set(key, entries);
  }

  for (const item of imports) {
    const matches = byKey.get(item.workKey) || [];
    if (matches.length !== 1) {
      throw new Error(`${item.workKey}: ожидалась ровно одна карточка, найдено ${matches.length}.`);
    }
    const [book] = matches;
    if (book.coverUrl || book.coverRights || book.edition) {
      throw new Error(`${item.workKey}: целевая карточка уже имеет обложку или издание.`);
    }
  }

  for (const item of skippedExisting) {
    const matches = byKey.get(item.workKey) || [];
    if (matches.length !== 1 || !matches[0].coverUrl || !matches[0].coverRights) {
      throw new Error(`${item.workKey}: ожидаемая неизменяемая обложка не найдена.`);
    }
  }

  for (const item of ambiguous) {
    if (item.candidates.some((key) => (byKey.get(key) || []).length !== 1)) {
      throw new Error(`Не найдены обе неоднозначные карточки для sourceIndex=${item.sourceIndex}.`);
    }
  }

  const allBooks = baseline;
  const familyKeysByWorkKey = new Map();
  for (const item of imports) {
    const target = byKey.get(item.workKey)[0];
    const targetTitles = titleTokens(target);
    const automatic = allBooks
      .filter(
        (candidate) =>
          candidate.countryId === target.countryId &&
          candidate.writerId === target.writerId &&
          setsIntersect(targetTitles, titleTokens(candidate))
      )
      .map(archiveKey);
    const manual = manuallyEquivalentWorkKeys.get(item.workKey) || [];
    for (const key of manual) {
      if ((byKey.get(key) || []).length !== 1) {
        throw new Error(`${item.workKey}: не найдена ручная эквивалентная карточка ${key}.`);
      }
    }
    const equivalentWorkKeys = [...new Set([item.workKey, ...automatic, ...manual])].sort();
    const protectedEquivalent = equivalentWorkKeys.find((key) => {
      const book = byKey.get(key)?.[0];
      return book?.coverUrl || book?.coverRights || book?.edition;
    });
    if (protectedEquivalent) {
      throw new Error(
        `${item.workKey}: эквивалентная карточка ${protectedEquivalent} уже имеет обложку/издание.`
      );
    }
    familyKeysByWorkKey.set(item.workKey, equivalentWorkKeys);
  }

  return { baseline, current, byKey, familyKeysByWorkKey };
}

async function validateInput(archivePath, sourceDirectory) {
  const archiveStats = await stat(archivePath);
  if (!archiveStats.isFile() || archiveStats.size !== ARCHIVE.bytes) {
    throw new Error(`Размер RAR не совпадает: ${archiveStats.size} вместо ${ARCHIVE.bytes}.`);
  }
  const archiveSha256 = await fileSha256(archivePath);
  if (archiveSha256 !== ARCHIVE.sha256) {
    throw new Error(`SHA-256 RAR не совпадает: ${archiveSha256}.`);
  }

  const dirEntries = await readdir(sourceDirectory, { withFileTypes: true });
  if (dirEntries.some((entry) => !entry.isFile())) {
    throw new Error("Папка источника должна содержать только обычные файлы.");
  }
  const files = dirEntries
    .map(({ name }) => name)
    .filter((name) => name.toLocaleLowerCase("ru").endsWith(".png"))
    .sort((left, right) => left.localeCompare(right, "ru", { numeric: true }));
  if (files.length !== ARCHIVE.entries || files.length !== dirEntries.length) {
    throw new Error(`Ожидалось 87 PNG без посторонних файлов, найдено ${files.length}/${dirEntries.length}.`);
  }

  const sourceRows = [];
  let totalBytes = 0;
  for (const filename of files) {
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
        `${filename}: ожидался PNG 1024×1536 без alpha, получено ${metadata.format} ${metadata.width}×${metadata.height} alpha=${metadata.hasAlpha}.`
      );
    }
    totalBytes += bytes.length;
    sourceRows.push({ filename, sourcePath, bytes: bytes.length, sha256: sha256(bytes) });
  }
  if (totalBytes !== ARCHIVE.uncompressedBytes) {
    throw new Error(
      `Суммарный размер PNG не совпадает: ${totalBytes} вместо ${ARCHIVE.uncompressedBytes}.`
    );
  }

  const rowsBySha = new Map();
  for (const row of sourceRows) {
    const rows = rowsBySha.get(row.sha256) || [];
    rows.push(row);
    rowsBySha.set(row.sha256, rows);
  }
  const uniqueRows = [...rowsBySha.values()].map(([first], index) => ({
    ...first,
    sourceIndex: index + 1,
  }));
  if (
    uniqueRows.length !== ARCHIVE.uniqueImages ||
    sourceRows.length - uniqueRows.length !== ARCHIVE.duplicateEntries
  ) {
    throw new Error(
      `Ожидалось 77 уникальных PNG и 10 дублей, найдено ${uniqueRows.length}/${sourceRows.length - uniqueRows.length}.`
    );
  }
  const duplicateGroups = [...rowsBySha.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([imageSha256, rows]) => ({
      imageSha256,
      selectedFilename: rows[0].filename,
      duplicateFilenames: rows.slice(1).map(({ filename }) => filename),
    }));
  return {
    archiveSha256,
    sourceRows,
    uniqueRows,
    duplicateGroups,
    totalBytes,
  };
}

function outputPaths(slug) {
  return {
    coverUrl: `brand/book-covers/${slug}.webp`,
    coverThumbnailUrl: `brand/book-covers/thumbs/${slug}.webp`,
    fullPath: path.join(coverDirectory, `${slug}.webp`),
    thumbnailPath: path.join(thumbnailDirectory, `${slug}.webp`),
  };
}

async function renderCover(sourcePath) {
  const full = await sharp(sourcePath, { failOn: "warning" })
    .rotate()
    .resize({
      width: OUTPUT.full.width,
      height: OUTPUT.full.height,
      fit: "cover",
      position: "centre",
    })
    .sharpen({ sigma: 0.55, m1: 0.7, m2: 1.5 })
    .webp({ quality: OUTPUT.full.quality, smartSubsample: true, effort: 6 })
    .toBuffer();
  const thumbnail = await sharp(sourcePath, { failOn: "warning" })
    .rotate()
    .resize({
      width: OUTPUT.thumbnail.width,
      height: OUTPUT.thumbnail.height,
      fit: "cover",
      position: "centre",
    })
    .sharpen({ sigma: 0.65, m1: 0.8, m2: 1.65 })
    .webp({
      quality: OUTPUT.thumbnail.quality,
      smartSubsample: true,
      effort: 6,
    })
    .toBuffer();
  return { full, thumbnail };
}

async function assertSafeExistingOutput(filePath, expectedUrl, existingManifest) {
  if (!existsSync(filePath)) return;
  const entry = existingManifest.entries?.find(
    (candidate) =>
      candidate.coverUrl === expectedUrl || candidate.coverThumbnailUrl === expectedUrl
  );
  if (!entry) {
    throw new Error(`Отказ от перезаписи существующего неманифестного asset: ${filePath}`);
  }
  const expectedSha256 =
    entry.coverUrl === expectedUrl
      ? entry.coverSha256
      : entry.coverThumbnailSha256;
  const actualSha256 = await fileSha256(filePath);
  if (!expectedSha256 || actualSha256 !== expectedSha256) {
    throw new Error(`Отказ от перезаписи изменённого редакционного asset: ${filePath}`);
  }
}

function withIdentification(entry) {
  const label = identified.get(entry.sourceIndex);
  if (!label) throw new Error(`Нет подписи для sourceIndex=${entry.sourceIndex}.`);
  return { ...entry, author: label.author, title: label.title };
}

function markdownTable(rows, columns) {
  return [
    `| ${columns.map(([label]) => label).join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map(
      (row) =>
        `| ${columns
          .map(([, key]) => String(row[key] ?? "").replaceAll("|", "\\|"))
          .join(" | ")} |`
    ),
  ].join("\n");
}

function createMarkdownReport(report) {
  const importedRows = report.imports.map((entry) => ({
    sourceIndex: entry.sourceIndex,
    author: entry.author,
    title: entry.title,
    workKey: entry.workKey,
    basis: entry.matchBasis,
  }));
  const existingRows = report.skippedExisting.map((entry) => ({
    sourceIndex: entry.sourceIndex,
    author: entry.author,
    title: entry.title,
    workKey: entry.workKey,
  }));
  const unresolvedRows = [
    ...report.ambiguous.map((entry) => ({
      sourceIndex: entry.sourceIndex,
      author: entry.author,
      title: entry.title,
      reason: entry.reason,
    })),
    ...report.unmatched.map((entry) => ({
      sourceIndex: entry.sourceIndex,
      author: entry.author,
      title: entry.title,
      reason: entry.reason,
    })),
  ];
  return [
    "# Импорт пользовательских редакционных обложек - 11 августа 2026",
    "",
    "Архив получен непосредственно от пользователя. Изображения помечены как редакционные иллюстрации, а не как обложки конкретных издательских изданий. Автор, правообладатель и внешняя лицензия не заявляются.",
    "",
    `- SHA-256 архива: \`${report.archive.sha256}\``,
    `- Файлов PNG: ${report.sourceInventory.entries}`,
    `- Уникальных изображений: ${report.sourceInventory.uniqueImages}`,
    `- Полные assets: ${report.output.full.width}×${report.output.full.height}, WebP q${report.output.full.quality}`,
    `- Миниатюры: ${report.output.thumbnail.width}×${report.output.thumbnail.height}, WebP q${report.output.thumbnail.quality}`,
    `- Точных импортов в пустые карточки: ${report.summary.imported}`,
    `- Пропущено из-за существующей обложки: ${report.summary.skippedExisting}`,
    `- Пропущено как второй вариант того же произведения: ${report.summary.skippedDuplicateArtwork}`,
    `- Оставлено неоднозначными: ${report.summary.ambiguous}`,
    `- Не сопоставлено: ${report.summary.unmatched}`,
    "",
    "## Импортировано",
    "",
    markdownTable(importedRows, [
      ["№", "sourceIndex"],
      ["Автор", "author"],
      ["Произведение", "title"],
      ["Ключ карточки", "workKey"],
      ["Основание", "basis"],
    ]),
    "",
    "## Существующие обложки сохранены",
    "",
    markdownTable(existingRows, [
      ["№", "sourceIndex"],
      ["Автор", "author"],
      ["Произведение", "title"],
      ["Ключ карточки", "workKey"],
    ]),
    "",
    "## Не импортировано",
    "",
    markdownTable(unresolvedRows, [
      ["№", "sourceIndex"],
      ["Автор", "author"],
      ["Произведение", "title"],
      ["Причина", "reason"],
    ]),
    "",
    `Отдельный второй вариант «Нана» (№ ${report.skippedDuplicateArtwork[0].sourceIndex}) не импортирован; выбран более ранний точный вариант № ${report.skippedDuplicateArtwork[0].selectedSourceIndex}.`,
    "",
  ].join("\n");
}

async function applyImport(input, canonical) {
  await mkdir(coverDirectory, { recursive: true });
  await mkdir(thumbnailDirectory, { recursive: true });
  await mkdir(path.dirname(reportJsonPath), { recursive: true });

  const existingManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const uniqueByIndex = new Map(input.uniqueRows.map((row) => [row.sourceIndex, row]));
  const withSourceIdentification = (entry) => {
    const source = uniqueByIndex.get(entry.sourceIndex);
    if (!source) {
      throw new Error(`Нет исходного PNG для sourceIndex=${entry.sourceIndex}.`);
    }
    return {
      ...withIdentification(entry),
      sourceFilename: source.filename,
      imageSha256: source.sha256,
    };
  };
  const manifestEntries = [];
  const reportImports = [];

  for (const item of imports) {
    const source = uniqueByIndex.get(item.sourceIndex);
    const book = canonical.byKey.get(item.workKey)[0];
    const paths = outputPaths(item.slug);
    await assertSafeExistingOutput(paths.fullPath, paths.coverUrl, existingManifest);
    await assertSafeExistingOutput(
      paths.thumbnailPath,
      paths.coverThumbnailUrl,
      existingManifest
    );
    const rendered = await renderCover(source.sourcePath);
    await writeFile(paths.fullPath, rendered.full);
    await writeFile(paths.thumbnailPath, rendered.thumbnail);

    const entry = {
      workKey: item.workKey,
      visibleAuthor: book.writerName,
      visibleTitle: book.title,
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
        note: EDITORIAL_NOTE,
      },
    };
    manifestEntries.push(entry);
    reportImports.push({
      ...withSourceIdentification(item),
      canonicalAuthor: book.writerName,
      canonicalTitle: book.title,
      coverUrl: paths.coverUrl,
      coverThumbnailUrl: paths.coverThumbnailUrl,
      equivalentWorkKeys: entry.equivalentWorkKeys,
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
    entries: manifestEntries,
  };

  const report = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    archive: manifest.archive,
    sourceInventory: {
      entries: input.sourceRows.length,
      uniqueImages: input.uniqueRows.length,
      duplicateEntries: input.sourceRows.length - input.uniqueRows.length,
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
    summary: {
      identified: identified.size,
      imported: imports.length,
      skippedExisting: skippedExisting.length,
      skippedDuplicateArtwork: duplicateArtwork.length,
      ambiguous: ambiguous.length,
      unmatched: unmatched.length,
      archiveBooks: canonical.baseline.length,
      publicBooks: 31,
      pendingBooks: canonical.baseline.length - 31,
    },
    imports: reportImports,
    skippedExisting: skippedExisting.map((entry) => ({
      ...withSourceIdentification(entry),
      reason: "immutable-existing-cover",
    })),
    skippedDuplicateArtwork: duplicateArtwork.map(withSourceIdentification),
    ambiguous: ambiguous.map(withSourceIdentification),
    unmatched: unmatched.map(withSourceIdentification),
  };

  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportMarkdownPath, createMarkdownReport(report), "utf8");
  return { manifest, report };
}

async function validateCommittedOutputs(canonical) {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const report = JSON.parse(await readFile(reportJsonPath, "utf8"));
  if (manifest.schemaVersion !== 1 || manifest.entries.length !== imports.length) {
    throw new Error(`Манифест должен содержать ${imports.length} записей.`);
  }
  if (
    manifest.archive.sha256 !== ARCHIVE.sha256 ||
    manifest.archive.bytes !== ARCHIVE.bytes ||
    report.summary.imported !== imports.length ||
    report.summary.skippedExisting !== skippedExisting.length ||
    report.summary.skippedDuplicateArtwork !== duplicateArtwork.length ||
    report.summary.ambiguous !== ambiguous.length ||
    report.summary.unmatched !== unmatched.length ||
    report.sourceInventory.duplicateEntries !== ARCHIVE.duplicateEntries ||
    report.sourceInventory.duplicateGroups?.length !== ARCHIVE.duplicateEntries ||
    report.output?.full?.width !== OUTPUT.full.width ||
    report.output?.full?.height !== OUTPUT.full.height ||
    report.output?.full?.quality !== OUTPUT.full.quality ||
    report.output?.full?.format !== "webp" ||
    report.output?.thumbnail?.width !== OUTPUT.thumbnail.width ||
    report.output?.thumbnail?.height !== OUTPUT.thumbnail.height ||
    report.output?.thumbnail?.quality !== OUTPUT.thumbnail.quality ||
    report.output?.thumbnail?.format !== "webp"
  ) {
    throw new Error("Манифест или отчёт не совпадает с зафиксированными решениями.");
  }
  const reportedImages = [
    ...report.imports,
    ...report.skippedExisting,
    ...report.skippedDuplicateArtwork,
    ...report.ambiguous,
    ...report.unmatched,
  ];
  if (
    reportedImages.length !== ARCHIVE.uniqueImages ||
    reportedImages.some(
      (entry) =>
        !entry.sourceFilename ||
        !/^[a-f0-9]{64}$/u.test(entry.imageSha256 || "")
    )
  ) {
    throw new Error("Отчёт не содержит полный filename/SHA inventory для 77 изображений.");
  }

  const manifestByWorkKey = new Map(
    manifest.entries.map((entry) => [entry.workKey, entry])
  );
  for (const item of imports) {
    const entry = manifestByWorkKey.get(item.workKey);
    if (
      !entry ||
      entry.provenance.kind !== "user-supplied" ||
      entry.provenance.archiveSha256 !== ARCHIVE.sha256 ||
      entry.provenance.sourceIndex !== item.sourceIndex ||
      entry.provenance.matchBasis !== item.matchBasis ||
      entry.provenance.note !== EDITORIAL_NOTE ||
      entry.coverWidth !== OUTPUT.full.width ||
      entry.coverHeight !== OUTPUT.full.height ||
      entry.coverThumbnailWidth !== OUTPUT.thumbnail.width ||
      entry.coverThumbnailHeight !== OUTPUT.thumbnail.height ||
      !entry.equivalentWorkKeys.includes(item.workKey)
    ) {
      throw new Error(`${item.workKey}: запись манифеста неполна или недетерминирована.`);
    }
    const paths = outputPaths(item.slug);
    if (
      entry.coverUrl !== paths.coverUrl ||
      entry.coverThumbnailUrl !== paths.coverThumbnailUrl
    ) {
      throw new Error(`${item.workKey}: пути assets не совпадают с решениями.`);
    }
    const [fullMetadata, thumbnailMetadata, fullSha, thumbnailSha] = await Promise.all([
      sharp(paths.fullPath).metadata(),
      sharp(paths.thumbnailPath).metadata(),
      fileSha256(paths.fullPath),
      fileSha256(paths.thumbnailPath),
    ]);
    if (
      fullMetadata.format !== "webp" ||
      fullMetadata.width !== OUTPUT.full.width ||
      fullMetadata.height !== OUTPUT.full.height ||
      fullMetadata.hasAlpha !== false ||
      thumbnailMetadata.format !== "webp" ||
      thumbnailMetadata.width !== OUTPUT.thumbnail.width ||
      thumbnailMetadata.height !== OUTPUT.thumbnail.height ||
      thumbnailMetadata.hasAlpha !== false ||
      fullSha !== entry.coverSha256 ||
      thumbnailSha !== entry.coverThumbnailSha256
    ) {
      throw new Error(`${item.workKey}: asset, размер или SHA-256 не прошёл проверку.`);
    }
  }

  const baselineByKey = new Map(canonical.baseline.map((book) => [archiveKey(book), book]));
  const currentByKey = new Map(canonical.current.map((book) => [archiveKey(book), book]));
  for (const item of imports) {
    const baseline = baselineByKey.get(item.workKey);
    const current = currentByKey.get(item.workKey);
    const entry = manifestByWorkKey.get(item.workKey);
    if (
      current?.coverUrl !== entry.coverUrl ||
      current?.coverThumbnailUrl !== entry.coverThumbnailUrl ||
      current?.coverRights?.status !== "editorial-original" ||
      current?.edition
    ) {
      throw new Error(`${item.workKey}: overlay не применился как редакционная иллюстрация.`);
    }
    for (const field of [
      "id",
      "title",
      "originalTitle",
      "firstPublished",
      "originalLanguage",
      "genres",
      "tags",
      "description",
      "translations",
      "sources",
      "externalIds",
      "distinctions",
      "sourceUrl",
      "editorial",
    ]) {
      if (JSON.stringify(current?.[field]) !== JSON.stringify(baseline?.[field])) {
        throw new Error(`${item.workKey}: overlay изменил запрещённое поле ${field}.`);
      }
    }
  }
  for (const item of skippedExisting) {
    const baseline = baselineByKey.get(item.workKey);
    const current = currentByKey.get(item.workKey);
    if (
      current?.coverUrl !== baseline?.coverUrl ||
      JSON.stringify(current?.coverRights) !== JSON.stringify(baseline?.coverRights)
    ) {
      throw new Error(`${item.workKey}: существующая обложка была изменена.`);
    }
  }
  return { manifest, report };
}

async function main() {
  validateDecisionInventory();
  const canonical = await validateCanonicalArchive();
  const checkOnly = process.argv.includes("--check");
  if (checkOnly) {
    await validateCommittedOutputs(canonical);
    console.log(
      `User-supplied cover check: ${imports.length} imported, ${skippedExisting.length} existing preserved, ${ambiguous.length} ambiguous, ${unmatched.length} unmatched.`
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
  const input = await validateInput(path.resolve(archivePath), path.resolve(sourceDirectory));
  console.log(
    `Dry-run: ${input.sourceRows.length} PNG, ${input.uniqueRows.length} unique; ${imports.length} import, ${skippedExisting.length} existing, ${duplicateArtwork.length} duplicate artwork, ${ambiguous.length} ambiguous, ${unmatched.length} unmatched.`
  );
  if (!process.argv.includes("--apply")) return;

  await applyImport(input, canonical);
  const updatedCanonical = await validateCanonicalArchive();
  await validateCommittedOutputs(updatedCanonical);
  console.log(
    `Applied: ${imports.length} full covers (${OUTPUT.full.width}×${OUTPUT.full.height}) and ${imports.length} thumbnails (${OUTPUT.thumbnail.width}×${OUTPUT.thumbnail.height}).`
  );
}

await main();
