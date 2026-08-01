import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const sourceDirectory = process.argv[2];

if (!sourceDirectory) {
  throw new Error(
    "Укажите папку с исходными PNG: node scripts/process-editorial-covers.mjs <папка>"
  );
}

const covers = [
  ["ChatGPT Image 1 авг. 2026 г., 11_19_40 (1).png", "beloved-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_19_40 (2).png", "hamlet-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_19_41 (4).png", "norwegian-wood-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_19_41 (5).png", "les-miserables-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_19_41 (6).png", "the-stranger-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_19_42 (7).png", "crime-and-punishment-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_20_50.png", "war-and-peace-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_21_02 (1).png", "nineteen-eighty-four-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_21_03 (2).png", "cherry-orchard-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_21_03 (3).png", "sea-wolf-editorial"],
  ["ChatGPT Image 1 авг. 2026 г., 11_21_04 (4).png", "fathers-and-sons-editorial"],
];

const outputDirectory = path.resolve("public/brand/book-covers");
const thumbnailDirectory = path.join(outputDirectory, "thumbs");
await mkdir(thumbnailDirectory, { recursive: true });

for (const [sourceName, slug] of covers) {
  const input = path.join(sourceDirectory, sourceName);
  const fullOutput = path.join(outputDirectory, `${slug}.webp`);
  const thumbnailOutput = path.join(thumbnailDirectory, `${slug}.webp`);

  await sharp(input)
    .rotate()
    .resize({ width: 800, height: 1200, fit: "cover", position: "centre" })
    .sharpen({ sigma: 0.55, m1: 0.7, m2: 1.5 })
    .webp({ quality: 88, smartSubsample: true, effort: 6 })
    .toFile(fullOutput);

  await sharp(input)
    .rotate()
    .resize({ width: 400, height: 600, fit: "cover", position: "centre" })
    .sharpen({ sigma: 0.65, m1: 0.8, m2: 1.65 })
    .webp({ quality: 86, smartSubsample: true, effort: 6 })
    .toFile(thumbnailOutput);
}

console.log(`Подготовлено ${covers.length} обложек и ${covers.length} миниатюр.`);
