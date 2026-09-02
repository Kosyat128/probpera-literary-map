import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";
import sharp from "sharp";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheDirectory = path.join(projectRoot, "scripts", ".cache");
const manifestPath = path.join(
  projectRoot,
  "src",
  "data",
  "countries",
  "generated",
  "userSuppliedBookCoversBatch20260820.generated.json"
);
const reportJsonPath = path.join(
  projectRoot,
  "reports",
  "user-supplied-book-cover-import-2026-08-20.json"
);
const reportMarkdownPath = path.join(
  projectRoot,
  "reports",
  "user-supplied-book-cover-import-2026-08-20.md"
);
const coverDirectory = path.join(projectRoot, "public", "brand", "book-covers");
const thumbnailDirectory = path.join(coverDirectory, "thumbs");
const previousManifestPaths = [
  "userSuppliedBookCovers.generated.json",
  "userSuppliedBookCoversBatch20260813.generated.json",
].map((filename) =>
  path.join(projectRoot, "src", "data", "countries", "generated", filename)
);

const GENERATED_AT = "2026-08-20T00:00:00.000Z";
const CHECKED_AT = GENERATED_AT.slice(0, 10);
const EDITORIAL_NOTE =
  "Предоставленная пользователем редакционная иллюстрация; не является обложкой конкретного издательского издания и не содержит вымышленного ISBN.";
const OUTPUT = Object.freeze({
  full: Object.freeze({ width: 720, height: 1_080, quality: 55 }),
  thumbnail: Object.freeze({ width: 360, height: 540, quality: 50 }),
});
const ARCHIVE = Object.freeze({
  name: "Новые обложки.rar",
  sha256: "0ad2a8f1c49573d51418beA2acf023a36b87db6e767b75dc869aa92f59b05cd3".toLocaleLowerCase("en"),
  bytes: 94_728_556,
  entries: 43,
  uniqueImages: 43,
  duplicateEntries: 0,
  uncompressedBytes: 99_527_961,
});
const CREATED_WORK_KEYS = new Set([
  "russia:chekhov:the-duel",
  "russia:chekhov:the-black-monk",
  "russia:chekhov:uncle-vanya",
  "russia:chekhov:the-man-in-a-case",
  "russia:chekhov:the-lady-with-the-dog",
  "england:h_g_wells:when-the-sleeper-wakes",
  "england:h_g_wells:the-first-men-in-the-moon",
  "england:h_g_wells:the-food-of-the-gods",
  "england:h_g_wells:the-world-set-free",
  "england:h_g_wells:men-like-gods",
  "england:h_g_wells:ann-veronica",
  "england:h_g_wells:the-history-of-mr-polly",
  "england:david_mitchell:ghostwritten",
  "england:david_mitchell:number9dream",
  "england:david_mitchell:the-thousand-autumns-of-jacob-de-zoet",
  "england:david_mitchell:the-bone-clocks",
  "england:david_mitchell:slade-house",
]);

const inventory = [
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_03 (1).png", "Дэвид Митчелл", "Литературный призрак", "england:david_mitchell:ghostwritten", "ghostwritten-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_04 (2).png", "Дэвид Митчелл", "Сон № 9", "england:david_mitchell:number9dream", "number9dream-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_04 (3).png", "Дэвид Митчелл", "Облачный атлас", "england:david_mitchell:cloud-atlas", "cloud-atlas-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_04 (4).png", "Дэвид Митчелл", "Под знаком чёрного лебедя", "england:david_mitchell:black-swan-green", "black-swan-green-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_05 (5).png", "Дэвид Митчелл", "Тысяча осеней Якоба де Зута", "england:david_mitchell:the-thousand-autumns-of-jacob-de-zoet", "thousand-autumns-jacob-de-zoet-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_05 (6).png", "Дэвид Митчелл", "Простые смертные", "england:david_mitchell:the-bone-clocks", "simple-mortals-bone-clocks-20260820-alternate", "verified-russian-title-alias"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_06 (7).png", "Дэвид Митчелл", "Голодный дом", "england:david_mitchell:slade-house", "slade-house-20260820-editorial", "verified-russian-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_06 (8).png", "Дэвид Митчелл", "Утопия-авеню", "england:david_mitchell:utopia-avenue", "utopia-avenue-20260820-editorial", "verified-title-punctuation-alias"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_06 (9).png", "Дэвид Митчелл", "Костяные часы", "england:david_mitchell:the-bone-clocks", "bone-clocks-20260820-editorial", "verified-russian-title"],
  ["Лучшие книги Митчелла/ChatGPT Image 19 авг. 2026 г., 17_55_07 (10).png", "Дэвид Митчелл", "Дом Слэйд", "england:david_mitchell:slade-house", "slade-house-russian-title-20260820-alternate", "verified-russian-title-alias"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_14 (1).png", "Харуки Мураками", "Норвежский лес", "japan:haruki_murakami:norwegian-wood", "norwegian-wood-20260820-alternate", "existing-editorial-cover-preserved"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_14 (2).png", "Харуки Мураками", "Кафка на пляже", "japan:haruki_murakami:kafka-on-the-shore", "kafka-on-the-shore-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_15 (3).png", "Харуки Мураками", "1Q84", "japan:haruki_murakami:legacy-haruki_murakami-1q84", "1q84-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_15 (4).png", "Харуки Мураками", "Хроники Заводной Птицы", "japan:haruki_murakami:legacy-haruki_murakami-хроники-заводной-птицы", "wind-up-bird-chronicle-20260820-editorial", "verified-capitalization-alias"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_16 (5).png", "Харуки Мураками", "Охота на овец", "japan:haruki_murakami:legacy-haruki_murakami-охота-на-овец", "wild-sheep-chase-20260820-editorial", "exact-author-and-title"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_16 (6).png", "Харуки Мураками", "К югу от границы, на запад от солнца", "japan:haruki_murakami:openlibrary-works-ol2625405w", "south-of-border-west-of-sun-20260820-editorial", "verified-bibliographic-title-alias"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_16 (7).png", "Харуки Мураками", "Страна Чудес без тормозов и Конец Света", "japan:haruki_murakami:openlibrary-works-ol2625421w", "hard-boiled-wonderland-20260820-editorial", "verified-bibliographic-title-alias"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_17 (8).png", "Харуки Мураками", "Послемрак", "japan:haruki_murakami:openlibrary-works-ol2625402w", "after-dark-murakami-20260820-editorial", "verified-bibliographic-title-alias"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_17 (9).png", "Харуки Мураками", "Бесцветный Цкуру Тадзаки и годы его странствий", "japan:haruki_murakami:openlibrary-works-ol16810121w", "colorless-tsukuru-tazaki-20260820-editorial", "verified-bibliographic-title-alias"],
  ["Лучшие книги Мураками/ChatGPT Image 19 авг. 2026 г., 17_59_17 (10).png", "Харуки Мураками", "Убийство Командора", "japan:haruki_murakami:openlibrary-works-ol19754736w", "killing-commendatore-20260820-editorial", "verified-bibliographic-title-alias"],
  ["Чехов/01_Антон_Чехов_Степь_1888.png", "Антон Чехов", "Степь", "russia:chekhov:article-series-10x9915", "steppe-chekhov-20260820-alternate", "existing-editorial-cover-preserved"],
  ["Чехов/02_Антон_Чехов_Дуэль_1891.png", "Антон Чехов", "Дуэль", "russia:chekhov:the-duel", "the-duel-chekhov-20260820-editorial", "exact-author-and-title"],
  ["Чехов/03_Антон_Чехов_Палата_№6_1892.png", "Антон Чехов", "Палата № 6", "russia:chekhov:legacy-chekhov-палата-6", "ward-no-6-chekhov-20260820-alternate", "existing-editorial-cover-preserved"],
  ["Чехов/04_Антон_Чехов_Чёрный_монах_1894.png", "Антон Чехов", "Чёрный монах", "russia:chekhov:the-black-monk", "the-black-monk-chekhov-20260820-editorial", "exact-author-and-title"],
  ["Чехов/05_Антон_Чехов_Чайка_1896.png", "Антон Чехов", "Чайка", "russia:chekhov:legacy-chekhov-чайка", "seagull-chekhov-20260820-alternate", "existing-editorial-cover-preserved"],
  ["Чехов/06_Антон_Чехов_Дядя_Ваня_1897.png", "Антон Чехов", "Дядя Ваня", "russia:chekhov:uncle-vanya", "uncle-vanya-20260820-editorial", "exact-author-and-title"],
  ["Чехов/07_Антон_Чехов_Человек_в_футляре_1898.png", "Антон Чехов", "Человек в футляре", "russia:chekhov:the-man-in-a-case", "the-man-in-a-case-20260820-editorial", "exact-author-and-title"],
  ["Чехов/08_Антон_Чехов_Дама_с_собачкой_1899.png", "Антон Чехов", "Дама с собачкой", "russia:chekhov:the-lady-with-the-dog", "lady-with-the-dog-20260820-editorial", "exact-author-and-title"],
  ["Чехов/09_Антон_Чехов_Три_сестры_1901.png", "Антон Чехов", "Три сестры", "russia:chekhov:legacy-chekhov-три-сестры", "three-sisters-chekhov-20260820-alternate", "existing-editorial-cover-preserved"],
  ["Чехов/10_Антон_Чехов_Вишнёвый_сад_1904.png", "Антон Чехов", "Вишнёвый сад", "russia:chekhov:the-cherry-orchard", "cherry-orchard-chekhov-20260820-alternate", "existing-editorial-cover-preserved"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_56 (1).png", "Герберт Уэллс", "Машина времени", "england:h_g_wells:legacy-h_g_wells-машина-времени", "time-machine-wells-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_56 (2).png", "Герберт Уэллс", "Остров доктора Моро", "england:h_g_wells:legacy-h_g_wells-остров-доктора-моро", "island-doctor-moreau-wells-20260820-alternate", "existing-editorial-cover-preserved"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_56 (3).png", "Герберт Уэллс", "Человек-невидимка", "england:h_g_wells:invisible-man-editorial", "invisible-man-wells-20260820-alternate", "existing-editorial-cover-preserved"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_57 (4).png", "Герберт Уэллс", "Война миров", "england:h_g_wells:legacy-h_g_wells-война-миров", "war-of-worlds-wells-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_57 (5).png", "Герберт Уэллс", "Когда спящий проснётся", "england:h_g_wells:when-the-sleeper-wakes", "when-sleeper-wakes-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_58 (6).png", "Герберт Уэллс", "Первые люди на Луне", "england:h_g_wells:the-first-men-in-the-moon", "first-men-in-moon-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_58 (7).png", "Герберт Уэллс", "Пища богов", "england:h_g_wells:the-food-of-the-gods", "food-of-gods-wells-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_58 (8).png", "Герберт Уэллс", "Война в воздухе", "england:h_g_wells:the-war-in-the-air", "war-in-air-wells-20260820-alternate", "existing-editorial-cover-preserved"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_59 (9).png", "Герберт Уэллс", "Освобождённый мир", "england:h_g_wells:the-world-set-free", "world-set-free-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 17_44_59 (10).png", "Герберт Уэллс", "Люди как боги", "england:h_g_wells:men-like-gods", "men-like-gods-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 22_10_28 (1).png", "Герберт Уэллс", "Тоно-Бенге", "england:h_g_wells:article-series-15osrun", "tono-bungay-wells-20260820-alternate", "existing-editorial-cover-preserved"],
  ["ChatGPT Image 19 авг. 2026 г., 22_10_28 (2).png", "Герберт Уэллс", "Анна-Вероника", "england:h_g_wells:ann-veronica", "ann-veronica-20260820-editorial", "exact-author-and-title"],
  ["ChatGPT Image 19 авг. 2026 г., 22_10_29 (3).png", "Герберт Уэллс", "История мистера Полли", "england:h_g_wells:the-history-of-mr-polly", "history-mr-polly-20260820-editorial", "exact-author-and-title"],
].map(([relativePath, author, title, workKey, slug, matchBasis], index) => ({
  sourceIndex: index + 1,
  relativePath,
  author,
  title,
  workKey,
  slug,
  matchBasis,
}));

const ALTERNATIVES = new Map([
  [6, { selectedSourceIndex: 9, workKey: "england:david_mitchell:the-bone-clocks", reason: "same-work-russian-title-alias-current-title-kostyanye-chasy" }],
  [10, { selectedSourceIndex: 7, workKey: "england:david_mitchell:slade-house", reason: "same-work-russian-title-alias-current-title-golodny-dom" }],
]);
const SKIPPED_SOURCE_INDEXES = new Set([11, 21, 23, 25, 29, 30, 32, 33, 38, 41]);
const SECONDARY_SOURCE_INDEXES = new Set([
  ...SKIPPED_SOURCE_INDEXES,
  ...ALTERNATIVES.keys(),
]);
const ARTWORKS = inventory;
const IMPORTS = inventory.filter(
  (entry) => !SECONDARY_SOURCE_INDEXES.has(entry.sourceIndex)
);
const SKIPPED = inventory.filter((entry) => SKIPPED_SOURCE_INDEXES.has(entry.sourceIndex));
const MANUAL_EQUIVALENTS = new Map([
  ["japan:haruki_murakami:legacy-haruki_murakami-1q84", [
    "japan:haruki_murakami:openlibrary-works-ol17534240w",
    "japan:haruki_murakami:openlibrary-works-ol20659838w",
    "japan:haruki_murakami:openlibrary-works-ol19352035w",
    "japan:haruki_murakami:openlibrary-works-ol16533021w",
    "japan:haruki_murakami:openlibrary-works-ol37491017w",
  ]],
  ["japan:haruki_murakami:legacy-haruki_murakami-хроники-заводной-птицы", [
    "japan:haruki_murakami:openlibrary-works-ol2625412w",
    "japan:haruki_murakami:openlibrary-works-ol25111252w",
  ]],
  ["japan:haruki_murakami:legacy-haruki_murakami-охота-на-овец", [
    "japan:haruki_murakami:openlibrary-works-ol2625441w",
    "japan:haruki_murakami:openlibrary-works-ol25669302w",
  ]],
  ["japan:haruki_murakami:openlibrary-works-ol2625402w", [
    "japan:haruki_murakami:openlibrary-works-ol31431894w",
  ]],
  ["japan:haruki_murakami:openlibrary-works-ol19754736w", [
    "japan:haruki_murakami:openlibrary-works-ol17937100w",
  ]],
]);

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizedRelativePath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function assetPaths(slug) {
  const coverUrl = `brand/book-covers/${slug}.webp`;
  const coverThumbnailUrl = `brand/book-covers/thumbs/${slug}.webp`;
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

async function readJsonIfPresent(filePath, fallback = null) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(filePath)));
    else if (entry.isFile()) files.push(filePath);
    else throw new Error(`Unsupported archive entry: ${filePath}`);
  }
  return files;
}

async function sourceArchive() {
  await mkdir(cacheDirectory, { recursive: true });
  const bundlePath = path.join(
    cacheDirectory,
    `user-supplied-book-cover-archive-source-2026-08-20-${process.pid}.mjs`
  );
  try {
    await build({
      absWorkingDir: projectRoot,
      stdin: {
        contents: [
          'import { bookArchiveCountries } from "./src/data/countries/index.ts";',
          'import { buildBookArchive } from "./src/data/bookArchive.ts";',
          'import { isPublicBook } from "./src/data/bookQuality.ts";',
          'import { userSuppliedBookWorkBatch20260820Count } from "./src/data/countries/userSuppliedBookWorkSupplementsBatch20260820.ts";',
          'export const baseline = buildBookArchive(bookArchiveCountries, { includeUserSuppliedCovers: false });',
          'export const current = buildBookArchive(bookArchiveCountries);',
          'export const baselinePublicCount = baseline.filter(isPublicBook).length;',
          'export const currentPublicCount = current.filter(isPublicBook).length;',
          'export { userSuppliedBookWorkBatch20260820Count };',
        ].join("\n"),
        resolveDir: projectRoot,
        sourcefile: "user-supplied-book-cover-archive-source-2026-08-20.ts",
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
    return await import(`${pathToFileURL(bundlePath).href}?v=${Date.now()}`);
  } finally {
    await rm(bundlePath, { force: true });
  }
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

async function validateCanonicalArchive(committedManifest) {
  const archiveModule = await sourceArchive();
  const { baseline, current, baselinePublicCount, currentPublicCount } = archiveModule;
  if (baseline.length !== 9_761 || current.length !== 9_761) {
    throw new Error(`Unexpected archive size: ${baseline.length}/${current.length}, expected 9761.`);
  }
  if (baselinePublicCount !== 46 || currentPublicCount !== 46) {
    throw new Error(`Unexpected public book count: ${baselinePublicCount}/${currentPublicCount}, expected 46.`);
  }
  if (archiveModule.userSuppliedBookWorkBatch20260820Count !== 17) {
    throw new Error("Batch must create exactly 17 missing canonical works.");
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
    (committedManifest?.entries || [])
      .filter((entry) => entry.isPrimary !== false)
      .map((entry) => [entry.workKey, entry])
  );
  const familyKeysByWorkKey = new Map();

  for (const item of IMPORTS) {
    const baselineMatches = baselineByKey.get(item.workKey) || [];
    const currentMatches = currentByKey.get(item.workKey) || [];
    if (baselineMatches.length !== 1 || currentMatches.length !== 1) {
      throw new Error(`${item.workKey}: expected one canonical work, found ${baselineMatches.length}/${currentMatches.length}.`);
    }
    const baselineBook = baselineMatches[0];
    if (baselineBook.coverUrl || baselineBook.coverRights || baselineBook.edition) {
      throw new Error(`${item.workKey}: baseline already has protected cover artwork.`);
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
        throw new Error(`${item.workKey}: current cover does not belong to this batch.`);
      }
    }
    const titles = titleTokens(baselineBook);
    const automatic = baseline
      .filter(
        (candidate) =>
          candidate.countryId === baselineBook.countryId &&
          candidate.writerId === baselineBook.writerId &&
          setsIntersect(titles, titleTokens(candidate))
      )
      .map(archiveKey);
    const manual = MANUAL_EQUIVALENTS.get(item.workKey) || [];
    for (const key of manual) {
      if ((baselineByKey.get(key) || []).length !== 1) {
        throw new Error(`${item.workKey}: missing declared equivalent ${key}.`);
      }
    }
    const equivalentWorkKeys = [...new Set([item.workKey, ...automatic, ...manual])].sort();
    for (const key of equivalentWorkKeys) {
      const equivalent = currentByKey.get(key)?.[0];
      if (!equivalent || !(equivalent.coverUrl || equivalent.coverRights || equivalent.edition)) continue;
      if (key === item.workKey && expectedEntry && equivalent.coverUrl === expectedEntry.coverUrl) continue;
      throw new Error(`${item.workKey}: equivalent ${key} already has protected cover artwork.`);
    }
    familyKeysByWorkKey.set(item.workKey, equivalentWorkKeys);
  }

  for (const item of SKIPPED) {
    const matches = currentByKey.get(item.workKey) || [];
    if (
      matches.length !== 1 ||
      !matches[0].coverUrl ||
      matches[0].coverRights?.status !== "editorial-original"
    ) {
      throw new Error(`Source ${item.sourceIndex}: expected protected existing cover for ${item.workKey}.`);
    }
  }
  for (const item of ARTWORKS) {
    const baselineBook = baselineByKey.get(item.workKey)?.[0];
    const currentBook = currentByKey.get(item.workKey)?.[0];
    if (!baselineBook || !currentBook) {
      throw new Error(`Source ${item.sourceIndex}: canonical work ${item.workKey} is missing.`);
    }
    if (!familyKeysByWorkKey.has(item.workKey)) {
      const titles = titleTokens(baselineBook);
      const automatic = baseline
        .filter(
          (candidate) =>
            candidate.countryId === baselineBook.countryId &&
            candidate.writerId === baselineBook.writerId &&
            setsIntersect(titles, titleTokens(candidate))
        )
        .map(archiveKey);
      const manual = MANUAL_EQUIVALENTS.get(item.workKey) || [];
      familyKeysByWorkKey.set(
        item.workKey,
        [...new Set([item.workKey, ...automatic, ...manual])].sort()
      );
    }
  }
  for (const key of CREATED_WORK_KEYS) {
    const work = baselineByKey.get(key)?.[0];
    if (!work || work.editorial?.status !== "verified") {
      throw new Error(`${key}: missing verified newly created work.`);
    }
    if (Object.keys(work.translations || {}).sort().join(",") !== "en,ru") {
      throw new Error(`${key}: newly created work has no complete RU/EN translations.`);
    }
    if (!(work.sources || []).length || !(work.externalIds || []).length) {
      throw new Error(`${key}: newly created work has incomplete provenance/external IDs.`);
    }
  }
  return { baseline, current, baselineByKey, currentByKey, familyKeysByWorkKey };
}

async function validateInput(archivePath, sourceDirectory) {
  const archiveStats = await stat(archivePath);
  if (!archiveStats.isFile() || archiveStats.size !== ARCHIVE.bytes) {
    throw new Error(`RAR size mismatch: ${archiveStats.size}, expected ${ARCHIVE.bytes}.`);
  }
  const archiveSha256 = sha256(await readFile(archivePath));
  if (archiveSha256 !== ARCHIVE.sha256) {
    throw new Error(`RAR SHA-256 mismatch: ${archiveSha256}.`);
  }
  const files = (await walk(sourceDirectory)).sort((left, right) =>
    normalizedRelativePath(sourceDirectory, left).localeCompare(
      normalizedRelativePath(sourceDirectory, right),
      "ru",
      { numeric: true }
    )
  );
  if (files.length !== ARCHIVE.entries) {
    throw new Error(`Expected 43 extracted files, found ${files.length}.`);
  }
  const expectedPaths = inventory.map((entry) => entry.relativePath);
  const actualPaths = files.map((filePath) => normalizedRelativePath(sourceDirectory, filePath));
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("Extracted source paths do not match the reviewed 43-file inventory.");
  }

  const sourceRows = [];
  let totalBytes = 0;
  for (let index = 0; index < files.length; index += 1) {
    const sourcePath = files[index];
    const bytes = await readFile(sourcePath);
    const metadata = await sharp(bytes, { failOn: "warning" }).metadata();
    if (
      metadata.format !== "png" ||
      metadata.width !== 1_024 ||
      metadata.height !== 1_536 ||
      metadata.hasAlpha
    ) {
      throw new Error(`${actualPaths[index]}: expected opaque PNG 1024x1536.`);
    }
    totalBytes += bytes.length;
    sourceRows.push({
      ...inventory[index],
      filename: path.basename(sourcePath),
      sourcePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  const uniqueImages = new Set(sourceRows.map((row) => row.sha256)).size;
  if (totalBytes !== ARCHIVE.uncompressedBytes || uniqueImages !== ARCHIVE.uniqueImages) {
    throw new Error(`Unexpected extracted inventory totals: ${totalBytes} bytes, ${uniqueImages} unique.`);
  }
  const chatGptFilenameEntries = sourceRows.filter((row) => row.filename.startsWith("ChatGPT Image 19 авг. 2026 г., ")).length;
  const editorialRenamedEntries = sourceRows.length - chatGptFilenameEntries;
  if (chatGptFilenameEntries !== 33 || editorialRenamedEntries !== 10) {
    throw new Error("Unexpected source-evidence filename distribution.");
  }
  return { sourceRows, totalBytes, uniqueImages, chatGptFilenameEntries, editorialRenamedEntries };
}

async function renderCover(sourcePath) {
  const pipeline = sharp(sourcePath, { failOn: "warning" }).rotate();
  const [full, thumbnail] = await Promise.all([
    pipeline.clone().resize({ width: OUTPUT.full.width, height: OUTPUT.full.height, fit: "cover", position: "centre" }).webp({ quality: OUTPUT.full.quality, smartSubsample: true, effort: 6 }).toBuffer(),
    pipeline.clone().resize({ width: OUTPUT.thumbnail.width, height: OUTPUT.thumbnail.height, fit: "cover", position: "centre" }).webp({ quality: OUTPUT.thumbnail.quality, smartSubsample: true, effort: 6 }).toBuffer(),
  ]);
  return { full, thumbnail };
}

async function assertSafeOutput(filePath, outputBuffer, protectedUrls, outputUrl) {
  if (protectedUrls.has(outputUrl)) {
    throw new Error(`${outputUrl}: URL is already owned by an earlier immutable manifest.`);
  }
  if (!existsSync(filePath)) return "write";
  const existing = await readFile(filePath);
  if (sha256(existing) !== sha256(outputBuffer)) {
    throw new Error(`${outputUrl}: existing file differs; refusing to overwrite.`);
  }
  return "reuse";
}

function withSource(entry, input) {
  const source = input.sourceRows[entry.sourceIndex - 1];
  return {
    sourceIndex: entry.sourceIndex,
    relativePath: entry.relativePath,
    filename: source.filename,
    imageSha256: source.sha256,
    bytes: source.bytes,
    visibleAuthor: entry.author,
    visibleTitle: entry.title,
    workKey: entry.workKey,
    matchBasis: entry.matchBasis,
  };
}

function createMarkdownReport(report) {
  const lines = [
    "# Импорт пользовательских обложек - 20 августа 2026",
    "",
    `Архив: \`${report.archive.name}\`, SHA-256 \`${report.archive.sha256}\`.`,
    "",
    "## Итог",
    "",
    `- Файлов в архиве: ${report.summary.archiveEntries}.`,
    `- Уникальных произведений: ${report.summary.uniqueWorks}.`,
    `- Импортировано новых artwork-записей: ${report.summary.imported} (${report.summary.assetFiles} WebP).`,
    `- Новых primary-обложек: ${report.summary.primaryArtwork}; secondary-вариантов: ${report.summary.secondaryArtwork}.`,
    `- Сохранено прежних primary-обложек без перезаписи: ${report.summary.skippedExisting}.`,
    `- Объединено альтернативных русских названий: ${report.summary.aliasConsolidated}.`,
    `- Создано отсутствовавших произведений: ${report.summary.createdWorks}.`,
    `- Карантин: ${report.summary.rightsQuarantined}.`,
    "",
    "## Созданные произведения",
    "",
    ...report.createdWorks.map((entry) => `- \`${entry.workKey}\` - ${entry.canonicalTitle}.`),
    "",
    "## Подтверждённые алиасы Митчелла",
    "",
    ...report.alternativeArtwork.map(
      (entry) => `- № ${entry.sourceIndex} «${entry.visibleTitle}» → № ${entry.selectedSourceIndex}, \`${entry.workKey}\`.`
    ),
    "",
    "Обложки являются пользовательскими редакционными иллюстрациями, а не изображениями конкретных издательских изданий; ISBN не создавались.",
    "",
  ];
  return lines.join("\n");
}

async function applyImport(input, canonical, committedManifest, previousManifests) {
  await mkdir(coverDirectory, { recursive: true });
  await mkdir(thumbnailDirectory, { recursive: true });
  const protectedUrls = new Set(
    previousManifests.flatMap((manifest) =>
      manifest.entries.flatMap((entry) => [entry.coverUrl, entry.coverThumbnailUrl])
    )
  );
  const renderedRows = [];
  for (const item of ARTWORKS) {
    const source = input.sourceRows[item.sourceIndex - 1];
    const target = canonical.baselineByKey.get(item.workKey)?.[0];
    const paths = assetPaths(item.slug);
    const rendered = await renderCover(source.sourcePath);
    const fullAction = await assertSafeOutput(paths.fullPath, rendered.full, protectedUrls, paths.coverUrl);
    const thumbnailAction = await assertSafeOutput(paths.thumbnailPath, rendered.thumbnail, protectedUrls, paths.coverThumbnailUrl);
    renderedRows.push({ item, source, target, paths, rendered, fullAction, thumbnailAction });
  }
  for (const row of renderedRows) {
    if (row.fullAction === "write") await writeFile(row.paths.fullPath, row.rendered.full);
    if (row.thumbnailAction === "write") await writeFile(row.paths.thumbnailPath, row.rendered.thumbnail);
  }
  const entries = renderedRows.map(({ item, source, target, paths, rendered }) => ({
    workKey: item.workKey,
    isPrimary: !SECONDARY_SOURCE_INDEXES.has(item.sourceIndex),
    visibleAuthor: item.author,
    visibleTitle: item.title,
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
      sourceRelativePath: source.relativePath,
      sourceIndex: source.sourceIndex,
      matchBasis: item.matchBasis,
      sourceEvidence: source.filename.startsWith("ChatGPT Image 19 авг. 2026 г., ")
        ? "chatgpt-image-filename"
        : "user-supplied-archive-confirmation",
      note: EDITORIAL_NOTE,
    },
    canonicalAuthor: target.writerName,
    canonicalTitle: target.title,
  }));
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
  const alternativeArtwork = [...ALTERNATIVES.entries()].map(([sourceIndex, alias]) => {
    const entry = entries.find(
      (candidate) => candidate.provenance.sourceIndex === sourceIndex
    );
    return {
      ...withSource(inventory[sourceIndex - 1], input),
      ...alias,
      coverUrl: entry.coverUrl,
      coverThumbnailUrl: entry.coverThumbnailUrl,
      isPrimary: false,
    };
  });
  const createdWorks = [...CREATED_WORK_KEYS].sort().map((workKey) => {
    const work = canonical.baselineByKey.get(workKey)?.[0];
    return {
      workKey,
      canonicalAuthor: work.writerName,
      canonicalTitle: work.title,
      titleRu: work.translations.ru.title,
      titleEn: work.translations.en.title,
      sourceUrls: work.sources.map((source) => source.url),
      externalIds: work.externalIds,
    };
  });
  const report = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    policy: "docs/COVER_RIGHTS_POLICY.md",
    archive: manifest.archive,
    sourceInventory: {
      entries: input.sourceRows.length,
      uniqueImages: input.uniqueImages,
      duplicateEntries: input.sourceRows.length - input.uniqueImages,
      width: 1_024,
      height: 1_536,
      format: "png",
      orientation: "portrait",
      alpha: false,
      uncompressedBytes: input.totalBytes,
    },
    output: {
      full: { ...OUTPUT.full, format: "webp" },
      thumbnail: { ...OUTPUT.thumbnail, format: "webp" },
    },
    rightsEvidence: {
      chatGptFilenameEntries: input.chatGptFilenameEntries,
      editorialRenamedEntries: input.editorialRenamedEntries,
      explicitUserArchiveInstruction: true,
      importedChatGptFilenameEntries: ARTWORKS.filter((entry) => entry.relativePath.includes("ChatGPT Image ")).length,
      importedEditorialRenamedEntries: ARTWORKS.filter((entry) => !entry.relativePath.includes("ChatGPT Image ")).length,
      quarantinedSourceIndexes: [],
    },
    summary: {
      archiveEntries: ARCHIVE.entries,
      uniqueWorks: ARCHIVE.entries - ALTERNATIVES.size,
      matchedSourceFiles: ARCHIVE.entries,
      matchedToCanonical: ARCHIVE.entries - ALTERNATIVES.size,
      imported: ARTWORKS.length,
      artworkRecords: ARTWORKS.length,
      assetFiles: ARTWORKS.length * 2,
      primaryArtwork: IMPORTS.length,
      secondaryArtwork: SECONDARY_SOURCE_INDEXES.size,
      skippedExisting: SKIPPED.length,
      aliasConsolidated: ALTERNATIVES.size,
      createdWorks: CREATED_WORK_KEYS.size,
      existingCanonicalWorks: ARCHIVE.entries - ALTERNATIVES.size - CREATED_WORK_KEYS.size,
      unmatched: 0,
      rightsQuarantined: 0,
      archiveBooks: canonical.baseline.length,
      publicBooks: 48,
      pendingBooks: canonical.baseline.length - 48,
    },
    artworks: ARTWORKS.map((item) => {
      const entry = entries.find(
        (candidate) => candidate.provenance.sourceIndex === item.sourceIndex
      );
      return {
        ...withSource(item, input),
        coverUrl: entry.coverUrl,
        coverThumbnailUrl: entry.coverThumbnailUrl,
        equivalentWorkKeys: entry.equivalentWorkKeys,
        isPrimary: entry.isPrimary,
      };
    }),
    imports: IMPORTS.map((item) => {
      const entry = entries.find(
        (candidate) => candidate.provenance.sourceIndex === item.sourceIndex
      );
      return { ...withSource(item, input), coverUrl: entry.coverUrl, coverThumbnailUrl: entry.coverThumbnailUrl, equivalentWorkKeys: entry.equivalentWorkKeys };
    }),
    skippedExisting: SKIPPED.map((item) => {
      const entry = entries.find(
        (candidate) => candidate.provenance.sourceIndex === item.sourceIndex
      );
      return {
        ...withSource(item, input),
        coverUrl: entry.coverUrl,
        coverThumbnailUrl: entry.coverThumbnailUrl,
        isPrimary: false,
      };
    }),
    alternativeArtwork,
    createdWorks,
    unmatched: [],
    rightsQuarantine: [],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(reportMarkdownPath, createMarkdownReport(report), "utf8");
}

async function validateCommittedOutputs(canonical, previousManifests) {
  const [manifest, report] = await Promise.all([readJson(manifestPath), readJson(reportJsonPath)]);
  if (
    manifest.schemaVersion !== 1 ||
    manifest.generatedAt !== GENERATED_AT ||
    manifest.archive.sha256 !== ARCHIVE.sha256 ||
    manifest.entries.length !== ARTWORKS.length
  ) {
    throw new Error("Committed 2026-08-20 cover manifest does not match the reviewed batch.");
  }
  if (
    report.summary.imported !== 43 ||
    report.summary.artworkRecords !== 43 ||
    report.summary.assetFiles !== 86 ||
    report.summary.primaryArtwork !== 31 ||
    report.summary.secondaryArtwork !== 12 ||
    report.summary.skippedExisting !== 10 ||
    report.summary.aliasConsolidated !== 2 ||
    report.summary.createdWorks !== 17 ||
    report.summary.unmatched !== 0 ||
    report.summary.rightsQuarantined !== 0
  ) {
    throw new Error("Committed 2026-08-20 report decision counts are invalid.");
  }
  const previousKeys = new Set(previousManifests.flatMap((item) => item.entries.map((entry) => entry.workKey)));
  const previousUrls = new Set(previousManifests.flatMap((item) => item.entries.flatMap((entry) => [entry.coverUrl, entry.coverThumbnailUrl])));
  const workKeys = new Set();
  const primaryWorkKeys = new Set();
  const sourceIndexes = new Set();
  const urls = new Set();
  for (const entry of manifest.entries) {
    if (sourceIndexes.has(entry.provenance.sourceIndex)) {
      throw new Error(`Source ${entry.provenance.sourceIndex}: duplicate artwork manifest entry.`);
    }
    sourceIndexes.add(entry.provenance.sourceIndex);
    workKeys.add(entry.workKey);
    if (entry.isPrimary) {
      if (primaryWorkKeys.has(entry.workKey) || previousKeys.has(entry.workKey)) {
        throw new Error(`${entry.workKey}: primary work key overlaps another cover manifest.`);
      }
      primaryWorkKeys.add(entry.workKey);
    }
    for (const url of [entry.coverUrl, entry.coverThumbnailUrl]) {
      if (urls.has(url) || previousUrls.has(url)) throw new Error(`${url}: asset URL collision.`);
      urls.add(url);
    }
    const expected = canonical.currentByKey.get(entry.workKey)?.[0];
    if (!expected) {
      throw new Error(`${entry.workKey}: manifest is not linked to a canonical work.`);
    }
    if (
      entry.isPrimary &&
      (expected.coverUrl !== entry.coverUrl ||
        expected.coverThumbnailUrl !== entry.coverThumbnailUrl)
    ) {
      throw new Error(`${entry.workKey}: primary manifest entry is not applied to canonical archive.`);
    }
    const paths = {
      full: path.join(projectRoot, "public", entry.coverUrl),
      thumbnail: path.join(projectRoot, "public", entry.coverThumbnailUrl),
    };
    const [full, thumbnail, fullMetadata, thumbnailMetadata] = await Promise.all([
      readFile(paths.full),
      readFile(paths.thumbnail),
      sharp(paths.full).metadata(),
      sharp(paths.thumbnail).metadata(),
    ]);
    if (
      sha256(full) !== entry.coverSha256 ||
      sha256(thumbnail) !== entry.coverThumbnailSha256 ||
      fullMetadata.format !== "webp" ||
      fullMetadata.width !== OUTPUT.full.width ||
      fullMetadata.height !== OUTPUT.full.height ||
      fullMetadata.hasAlpha ||
      thumbnailMetadata.format !== "webp" ||
      thumbnailMetadata.width !== OUTPUT.thumbnail.width ||
      thumbnailMetadata.height !== OUTPUT.thumbnail.height ||
      thumbnailMetadata.hasAlpha
    ) {
      throw new Error(`${entry.workKey}: generated asset integrity check failed.`);
    }
  }
  if (
    workKeys.size !== 41 ||
    primaryWorkKeys.size !== 31 ||
    sourceIndexes.size !== 43 ||
    urls.size !== 86 ||
    report.artworks?.length !== 43
  ) {
    throw new Error("Committed manifest does not contain the reviewed 43→41 artwork graph.");
  }
  return manifest;
}

async function main() {
  const previousManifests = await Promise.all(previousManifestPaths.map(readJson));
  const committedManifest = await readJsonIfPresent(manifestPath);
  const canonical = await validateCanonicalArchive(committedManifest);
  if (process.argv.includes("--check")) {
    const manifest = await validateCommittedOutputs(canonical, previousManifests);
    console.log(`Cover batch 2026-08-20 verified: ${manifest.entries.length} artworks for 41 works, 31 primary, 12 secondary, 17 created works.`);
    return;
  }
  const archivePath = argument("archive");
  const sourceDirectory = argument("source");
  if (!archivePath || !sourceDirectory) {
    throw new Error("Use --archive=<Новые обложки.rar> and --source=<safely extracted directory>.");
  }
  const input = await validateInput(path.resolve(archivePath), path.resolve(sourceDirectory));
  await applyImport(input, canonical, committedManifest, previousManifests);
  console.log("Cover batch 2026-08-20 generated: 43 artworks for 41 works, 31 primary, 12 secondary, 17 created works.");
  console.log("Wire the generated manifest into userSuppliedBookCovers.ts, then run this script with --check.");
}

await main();
