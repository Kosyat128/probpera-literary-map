import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { COLOUR_DIFFERENCE_VERSION, deltaE2000, srgbToLab } from "./lib/colour-difference.mjs";

const directory = path.resolve("reports/bookshelf-owner-evidence/materials");
const captureName = process.argv[2] || "physical-row-1720";
const expectedSpineCount = Number(process.argv[3] || 17);
if (![7, 13, 17].includes(expectedSpineCount)) throw new Error("Expected spine count must match the 17, 13 or 7 spine quality limit");
const capture = JSON.parse(await readFile(path.join(directory, `${captureName}.json`), "utf8"));
const imagePath = path.join(directory, `${captureName}.png`);
const referencePath = path.resolve("docs/stage5-reference/OWNER_LOCKED_BOOK_SPINES_EXACT_2026-08-30.png");
const meanRgb = async (file, rect) => {
  const { data, info } = await sharp(file).extract(rect).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const sum = [0, 0, 0];
  for (let pixel = 0; pixel < data.length; pixel += info.channels) for (let channel = 0; channel < 3; channel += 1) sum[channel] += data[pixel + channel];
  return sum.map(value => value / (info.width * info.height));
};
const rectangles = capture.patches;
if (!Array.isArray(rectangles) || rectangles.length !== expectedSpineCount) throw new Error(`Expected exactly ${expectedSpineCount} measured spine rectangles`);
if (new Set(rectangles.map(rectangle => rectangle.slot)).size !== expectedSpineCount || rectangles.some(rectangle => !Number.isInteger(rectangle.slot) || rectangle.slot < 0 || rectangle.slot > 16)) throw new Error("Every measured spine must have a distinct valid owner slot");
const cells = [];
for (const rectangle of rectangles) {
  // Same relative text-free cloth zone as the established 2D comparison.
  const currentRect = {
    left: Math.round(rectangle.x + rectangle.width * (24 / 91)),
    top: Math.round(rectangle.y + rectangle.height * (271 / 411)),
    width: Math.max(1, Math.round(rectangle.width * (40 / 91))),
    height: Math.max(1, Math.round(rectangle.height * (40 / 411))),
  };
  const referenceRect = { left: Math.round(47 + rectangle.slot * 96.875) + 24, top: 365, width: 40, height: 40 };
  const currentRGB = await meanRgb(imagePath, currentRect);
  const referenceRGB = await meanRgb(referencePath, referenceRect);
  cells.push({ key: rectangle.key, slot: rectangle.slot, baseColor: rectangle.baseColor, currentRect, referenceRect, currentRGB, referenceRGB,
    deltaE00: deltaE2000(srgbToLab(currentRGB), srgbToLab(referenceRGB)) });
}
const meanDeltaE00 = cells.reduce((sum, cell) => sum + cell.deltaE00, 0) / cells.length;
const maximumDeltaE00 = Math.max(...cells.map(cell => cell.deltaE00));
const report = { capture: imagePath, reference: referencePath, formulaVersion: COLOUR_DIFFERENCE_VERSION,
  expectedSpineCount, qualityProfile: capture.qualityProfile, lightExposure: capture.lightExposure,
  method: "Actual WebGL screenshot, matched relative text-free cloth regions; sRGB mean -> D65 Lab -> CIEDE2000",
  meanDeltaE00, maximumDeltaE00, patchGatePassed: meanDeltaE00 <= 4 && maximumDeltaE00 <= 7, cells };
await writeFile(path.join(directory, `${captureName}-colour.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ meanDeltaE00, maximumDeltaE00, patchGatePassed: report.patchGatePassed, cells: cells.map(cell => ({ slot: cell.slot, deltaE00: cell.deltaE00, currentRGB: cell.currentRGB, referenceRGB: cell.referenceRGB })) }));
