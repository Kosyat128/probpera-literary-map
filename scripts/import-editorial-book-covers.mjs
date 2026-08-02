import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apply = process.argv.includes("--apply");
const reviewRoot = path.join(root, ".review");
const manifestPath = path.join(reviewRoot, "contact-sheets", "manifest.json");
const archiveModule = await import(
  `${new URL("../scripts/.cache/book-mentions-source.mjs", import.meta.url).href}?v=${Date.now()}`
);

const covers = [
  [181, "usa:ray_bradbury:legacy-ray_bradbury-вино-из-одуванчиков", "Вино из одуванчиков", "dandelion-wine"],
  [182, "poland:stanislaw_lem:legacy-stanislaw_lem-солярис", "Солярис", "solaris"],
  [183, "england:h_g_wells:legacy-h_g_wells-человек-невидимка", "Человек-невидимка", "invisible-man"],
  [184, "usa:ernest_hemingway:legacy-ernest_hemingway-по-ком-звонит-колокол", "По ком звонит колокол", "for-whom-the-bell-tolls"],
  [185, "germany:erich_maria_remarque:legacy-erich_maria_remarque-на-западном-фронте-без-перемен", "На Западном фронте без перемен", "all-quiet-on-the-western-front"],
  [187, "russia:sholokhov:legacy-sholokhov-тихий-дон", "Тихий Дон", "and-quiet-flows-the-don"],
  [188, "france:albert_camus:legacy-albert_camus-чума", "Чума", "the-plague"],
  [189, "russia:bulgakov:legacy-bulgakov-белая-гвардия", "Белая гвардия", "the-white-guard"],
  [190, "england:william_golding:legacy-william_golding-повелитель-мух", "Повелитель мух", "lord-of-the-flies"],
  [191, "usa:jerome_david_salinger:legacy-jerome_david_salinger-над-пропастью-во-ржи", "Над пропастью во ржи", "the-catcher-in-the-rye"],
  [192, "france:flaubert:legacy-flaubert-госпожа-бовари", "Госпожа Бовари", "madame-bovary"],
  [193, "france:victor_hugo:legacy-victor_hugo-собор-парижской-богоматери", "Собор Парижской Богоматери", "the-hunchback-of-notre-dame"],
  [197, "france:saint_exupery:legacy-saint_exupery-ночной-полёт", "Ночной полёт", "night-flight"],
  [198, "england:charlotte_bronte:legacy-charlotte_bronte-джейн-эйр", "Джейн Эйр", "jane-eyre"],
  [199, "russia:goncharov:legacy-goncharov-обломов", "Обломов", "oblomov"],
  [200, "usa:harper_lee:legacy-harper_lee-убить-пересмешника", "Убить пересмешника", "to-kill-a-mockingbird"],
  [201, "england:thomas_hardy:legacy-thomas_hardy-тэсс-из-рода-дэрбервиллей", "Тэсс из рода д'Эрбервиллей", "tess-of-the-durbervilles"],
  [203, "usa:francis_scott_fitzgerald:legacy-francis_scott_fitzgerald-ночь-нежна", "Ночь нежна", "tender-is-the-night"],
  [204, "usa:henry_james:legacy-henry_james-поворот-винта", "Поворот винта", "the-turn-of-the-screw"],
  [205, "russia:bulgakov:legacy-bulgakov-собачье-сердце", "Собачье сердце", "heart-of-a-dog"],
  [206, "usa:kurt_vonnegut:legacy-kurt_vonnegut-бойня-номер-пять", "Бойня номер пять", "slaughterhouse-five"],
  [208, "russia:dostoevsky:legacy-dostoevsky-братья-карамазовы", "Братья Карамазовы", "the-brothers-karamazov"],
  [209, "russia:tolstoy:legacy-tolstoy-анна-каренина", "Анна Каренина", "anna-karenina"],
  [210, "usa:ray_bradbury:legacy-ray_bradbury-451-по-фаренгейту", "451° по Фаренгейту", "fahrenheit-451"],
  [211, "germany:erich_maria_remarque:legacy-erich_maria_remarque-триумфальная-арка", "Триумфальная арка", "arch-of-triumph"],
  [212, "colombia:gabriel_garcia_marquez:legacy-gabriel_garcia_marquez-сто-лет-одиночества", "Сто лет одиночества", "one-hundred-years-of-solitude"],
  [213, "france:jules_verne:legacy-jules_verne-таинственный-остров", "Таинственный остров", "the-mysterious-island"],
  [214, "usa:jack_london:legacy-jack_london-белый-клык", "Белый клык", "white-fang"],
  [216, "italy:umberto_eco:legacy-umberto_eco-имя-розы", "Имя розы", "the-name-of-the-rose"],
  [217, "russia:pasternak:legacy-pasternak-доктор-живаго", "Доктор Живаго", "doctor-zhivago"],
  [218, "russia:pushkin:legacy-pushkin-евгений-онегин", "Евгений Онегин", "eugene-onegin"],
  [219, "russia:dostoevsky:legacy-dostoevsky-бесы", "Бесы", "demons"],
  [220, "england:aldous_huxley:legacy-aldous_huxley-о-дивный-новый-мир", "О дивный новый мир", "brave-new-world"],
  [221, "usa:john_steinbeck:legacy-john_steinbeck-гроздья-гнева", "Гроздья гнева", "the-grapes-of-wrath"],
  [223, "england:virginia_woolf:legacy-virginia_woolf-на-маяк", "На маяк", "to-the-lighthouse"],
  [224, "usa:edgar_allan_poe:legacy-edgar_allan_poe-падение-дома-ашеров", "Падение дома Ашеров", "the-fall-of-the-house-of-usher"],
  [238, "russia:pushkin:legacy-pushkin-капитанская-дочка", "Капитанская дочка", "the-captains-daughter"],
  [239, "russia:lermontov:legacy-lermontov-герой-нашего-времени", "Герой нашего времени", "a-hero-of-our-time"],
  [240, "england:charles_dickens:legacy-charles_dickens-большие-надежды", "Большие надежды", "great-expectations"],
  [241, "england:charles_dickens:legacy-charles_dickens-оливер-твист", "Оливер Твист", "oliver-twist"],
  [242, "france:stendhal:legacy-stendhal-красное-и-чёрное", "Красное и чёрное", "the-red-and-the-black"],
  [243, "france:emile_zola:legacy-emile_zola-жерминаль", "Жерминаль", "germinal"],
  [245, "usa:theodore_dreiser:legacy-theodore_dreiser-американская-трагедия", "Американская трагедия", "an-american-tragedy"],
  [246, "usa:vladimir_nabokov:legacy-vladimir_nabokov-лолита", "Лолита", "lolita"],
  [247, "england:charles_dickens:legacy-charles_dickens-дэвид-копперфильд", "Дэвид Копперфильд", "david-copperfield"],
  [248, "england:daniel_defoe:legacy-daniel_defoe-робинзон-крузо", "Робинзон Крузо", "robinson-crusoe"],
  [249, "england:george_orwell:legacy-george_orwell-скотный-двор", "Скотный двор", "animal-farm"],
  [250, "ireland:james_joyce:legacy-james_joyce-улисс", "Улисс", "ulysses"],
  [251, "germany:thomas_mann:legacy-thomas_mann-будденброки", "Будденброки", "buddenbrooks"],
  [253, "austria:franz_kafka:legacy-franz_kafka-замок", "Замок", "the-castle"],
  [254, "usa:william_faulkner:legacy-william_faulkner-шум-и-ярость", "Шум и ярость", "the-sound-and-the-fury"],
];

const archiveByKey = new Map(
  archiveModule.archive.map((book) => [
    `${book.countryId}:${book.writerId}:${book.id}`,
    book,
  ])
);
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const manifestByIndex = new Map(manifest.map((entry) => [entry.index, entry.file]));

function matchingClose(source, start, open, close) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === open) depth += 1;
    else if (character === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`Unclosed ${open} at ${start}`);
}

function indentJson(value, indentation) {
  return JSON.stringify(value, null, 2)
    .split("\n")
    .map((line) => `${indentation}${line}`)
    .join("\n");
}

function removeLegacyTitles(source, writerId, titles) {
  const idPattern = new RegExp(`\\bid:\\s*["']${writerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "u");
  const idMatch = idPattern.exec(source);
  if (!idMatch) throw new Error(`Writer ${writerId} not found`);
  const writerStart = source.lastIndexOf("{", idMatch.index);
  const writerEnd = matchingClose(source, writerStart, "{", "}");
  const writerBlock = source.slice(writerStart, writerEnd + 1);
  const worksMatch = /\bworks\s*:\s*\[/u.exec(writerBlock);
  if (!worksMatch) return source;

  const arrayStart = writerStart + worksMatch.index + worksMatch[0].lastIndexOf("[");
  const arrayEnd = matchingClose(source, arrayStart, "[", "]");
  let content = source.slice(arrayStart + 1, arrayEnd);
  for (const title of titles) {
    const quotedTitle = JSON.stringify(title).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    content = content.replace(
      new RegExp(`^[ \\t]*${quotedTitle}[ \\t]*,?[ \\t]*(?:\\r?\\n|$)`, "gmu"),
      ""
    );
  }
  return `${source.slice(0, arrayStart + 1)}${content}${source.slice(arrayEnd)}`;
}

function addWorkDetails(source, writerId, entries) {
  const idPattern = new RegExp(`\\bid:\\s*["']${writerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "u");
  const idMatch = idPattern.exec(source);
  if (!idMatch) throw new Error(`Writer ${writerId} not found`);
  const writerStart = source.lastIndexOf("{", idMatch.index);
  const writerEnd = matchingClose(source, writerStart, "{", "}");
  const writerBlock = source.slice(writerStart, writerEnd + 1);
  const pending = entries.filter((entry) => !writerBlock.includes(entry.coverUrl));
  if (!pending.length) {
    return removeLegacyTitles(source, writerId, entries.map((entry) => entry.title));
  }

  const detailsMatch = /\bworkDetails\s*:\s*\[/u.exec(writerBlock);
  if (detailsMatch) {
    const arrayStart = writerStart + detailsMatch.index + detailsMatch[0].lastIndexOf("[");
    const arrayEnd = matchingClose(source, arrayStart, "[", "]");
    const lineStart = source.lastIndexOf("\n", writerStart + detailsMatch.index) + 1;
    const indentation = source.slice(lineStart, writerStart + detailsMatch.index).match(/^\s*/u)?.[0] || "      ";
    const content = source.slice(arrayStart + 1, arrayEnd).trimEnd();
    const separator = content.trim() && !content.trim().endsWith(",") ? "," : "";
    const insertion = `${separator}\n${pending.map((entry) => indentJson(entry, `${indentation}  `)).join(",\n")}\n${indentation}`;
    const updated = `${source.slice(0, arrayEnd)}${insertion}${source.slice(arrayEnd)}`;
    return removeLegacyTitles(updated, writerId, entries.map((entry) => entry.title));
  }

  const worksMatch = /\n(\s*)works\s*:/u.exec(writerBlock);
  const indentation = worksMatch?.[1] || "      ";
  const insertAt = worksMatch ? writerStart + worksMatch.index + 1 : writerEnd;
  const block = `${indentation}workDetails: [\n${pending.map((entry) => indentJson(entry, `${indentation}  `)).join(",\n")}\n${indentation}],\n`;
  const updated = `${source.slice(0, insertAt)}${block}${source.slice(insertAt)}`;
  return removeLegacyTitles(updated, writerId, entries.map((entry) => entry.title));
}

const grouped = new Map();
for (const [imageIndex, key, title, slug] of covers) {
  const book = archiveByKey.get(key);
  if (!book) throw new Error(`Book key not found: ${key}`);
  if (book.title !== title) throw new Error(`Title mismatch for ${key}: ${book.title}`);
  const file = manifestByIndex.get(imageIndex);
  if (!file) throw new Error(`Image ${imageIndex} not found`);
  const [countryId, writerId] = key.split(":");
  const coverUrl = `brand/book-covers/${slug}-editorial.webp`;
  const entry = {
    id: `${slug}-editorial`,
    title,
    coverUrl,
    coverThumbnailUrl: `brand/book-covers/thumbs/${slug}-editorial.webp`,
    coverSourceUrl: coverUrl,
    coverRights: {
      status: "editorial-original",
      licenseName: "Редакционное оформление «Пробы Пера»",
      creator: "Редакция «Пробы Пера»",
      rightsHolder: "Проба Пера",
      sourceUrl: coverUrl,
      checkedAt: "2026-08-02",
      note: "Собственное редакционное оформление; не является обложкой конкретного издательского издания.",
    },
    editorial: { status: "draft" },
  };
  const groupKey = `${countryId}:${writerId}`;
  if (!grouped.has(groupKey)) grouped.set(groupKey, []);
  grouped.get(groupKey).push({ entry, file, slug });
}

console.log(`Validated ${covers.length} exact book-to-cover matches.`);
if (!apply) {
  console.log("Dry run only. Run with --apply to create assets and update countries.");
  process.exit(0);
}

const fullDirectory = path.join(root, "public", "brand", "book-covers");
const thumbDirectory = path.join(fullDirectory, "thumbs");
await fs.mkdir(thumbDirectory, { recursive: true });
for (const items of grouped.values()) {
  for (const { file, slug } of items) {
    const source = path.join(reviewRoot, "covers", file);
    await sharp(source)
      .rotate()
      .resize(800, 1200, { fit: "cover", position: "centre" })
      .webp({ quality: 86, effort: 5 })
      .toFile(path.join(fullDirectory, `${slug}-editorial.webp`));
    await sharp(source)
      .rotate()
      .resize(320, 480, { fit: "cover", position: "centre" })
      .webp({ quality: 82, effort: 5 })
      .toFile(path.join(thumbDirectory, `${slug}-editorial.webp`));
  }
}

for (const [groupKey, items] of grouped) {
  const [countryId, writerId] = groupKey.split(":");
  const countryFile = path.join(root, "src", "data", "countries", `${countryId}.ts`);
  let source = await fs.readFile(countryFile, "utf8");
  source = addWorkDetails(source, writerId, items.map(({ entry }) => entry));
  await fs.writeFile(countryFile, source, "utf8");
}

console.log(`Imported ${covers.length} editorial covers into the country encyclopedia.`);
