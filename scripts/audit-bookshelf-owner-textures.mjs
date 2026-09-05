import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { COLOUR_DIFFERENCE_VERSION, deltaE2000, srgbToLab } from "./lib/colour-difference.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4184/";
const out = path.resolve("reports/bookshelf-owner-evidence/materials");
const referencePath = path.resolve("docs/stage5-reference/OWNER_LOCKED_BOOK_SPINES_EXACT_2026-08-30.png");
const reference = await readFile(referencePath);
await mkdir(out, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `export * from './src/books/completeShelfTextures'; export * from './src/books/completeShelfModel'; export * from './src/books/bookOwnerSpineIdentity'; export * from './src/books/bookTypography'; export * from './src/books/bookInspectionPageLayout'; export * from './src/books/bookInspectionTextures'; export * from './src/books/bookEditorialPages';`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, format: "iife", globalName: "OwnerTextureProbe", write: false, platform: "browser", target: "es2020",
});
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 1000 }, deviceScaleFactor: 1, bypassCSP: true });
  await page.goto(baseURL, { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async (referenceURL) => {
    const api = globalThis.OwnerTextureProbe;
    if (!await api.ensureBookTypographyReady()) throw new Error("Local fonts did not load");
    document.body.replaceChildren();
    const titles = ["1984", "451° по Фаренгейту", "Анна-Вероника", "Будденброки", "Война и мир", "Гамлет", "Голодный Дом", "Госпожа Бовари", "Дама с собачкой", "Дуэль", "Дядя Ваня", "История мистера Полли", "Когда спящий проснётся", "Костяные часы", "Литературный призрак", "Лолита", "Люди как боги"];
    const writers = ["Джордж Оруэлл", "Рэй Брэдбери", "Герберт Джордж Уэллс", "Томас Манн", "Лев Николаевич Толстой", "Уильям Шекспир", "Дэвид Стивен Митчелл", "Гюстав Флобер", "Антон Павлович Чехов", "Антон Павлович Чехов", "Антон Павлович Чехов", "Герберт Джордж Уэллс", "Герберт Джордж Уэллс", "Дэвид Стивен Митчелл", "Дэвид Митчелл", "Владимир Набоков", "Герберт Джордж Уэллс"];
    const reference = new Image();
    reference.src = referenceURL;
    await reference.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1720; canvas.height = 582;
    const context = canvas.getContext("2d");
    context.fillStyle = "#251c19";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const referenceCanvas = document.createElement("canvas");
    referenceCanvas.width = reference.width; referenceCanvas.height = reference.height;
    const referenceContext = referenceCanvas.getContext("2d");
    referenceContext.drawImage(reference, 0, 0);
    const sample = (ctx, x, y, width, height) => {
      const { data } = ctx.getImageData(x, y, width, height);
      const sum = [0, 0, 0];
      for (let pixel = 0; pixel < data.length; pixel += 4) for (let channel = 0; channel < 3; channel += 1) sum[channel] += data[pixel + channel];
      return sum.map((value) => value / (width * height));
    };
    const lab = (rgb) => {
      const [r, g, b] = rgb.map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      const xyz = [(r * .4124564 + g * .3575761 + b * .1804375) / .95047, r * .2126729 + g * .7151522 + b * .072175, (r * .0193339 + g * .119192 + b * .9503041) / 1.08883];
      const [x, y, z] = xyz.map((value) => value > .008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
      return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
    };
    const cells = [];
    let frontPNG = null;
    for (let slot = 0; slot < titles.length; slot += 1) {
      const key = api.OWNER_LOCKED_BOOK_KEYS[slot];
      const ownerPaletteSlot = api.ownerPaletteSlotForBookKey(key);
      if (ownerPaletteSlot !== slot) throw new Error(`Canonical owner slot mismatch: ${key}`);
      const spec = api.buildCompleteShelfBookSpec({ key, title: titles[slot], writer: writers[slot], ownerPaletteSlot, baseColor: "#000000", accentColor: "#000000", paperColor: "#ffffff" }, slot);
      const layout = api.resolveCompleteShelfTypography(context, spec);
      const maps = api.createCompleteShelfArtworkTextures(spec, false, slot === 4, { height: 1536, anisotropy: 12 });
      const fits = [layout.title, layout.author, layout.frontTitle, layout.frontAuthor].every((part) => part.fits);
      if (!fits || !maps.spineSurface || !maps.spineFoil) throw new Error(`Owner slot ${slot} does not fit: ${JSON.stringify(layout)}`);
      const x = Math.round(47 + slot * 96.875);
      context.drawImage(maps.spineSurface.image, x, 94, 91, 411);
      context.drawImage(maps.spineFoil.image, x, 94, 91, 411);
      const currentRGB = sample(context, x + 24, 365, 40, 40);
      const referenceRGB = sample(referenceContext, x + 24, 365, 40, 40);
      const currentLab = lab(currentRGB), referenceLab = lab(referenceRGB);
      const deltaE76 = Math.hypot(...currentLab.map((value, index) => value - referenceLab[index]));
      cells.push({ slot, key, title: spec.title, writer: spec.writer, palette: spec.baseColor, layout, patch: { x: x + 24, y: 365, width: 40, height: 40 }, currentRGB, referenceRGB, deltaE76 });
      if (maps.frontFoil) {
        const front = document.createElement("canvas");
        front.width = maps.frontFoil.image.width; front.height = maps.frontFoil.image.height;
        const frontContext = front.getContext("2d");
        frontContext.fillStyle = spec.baseColor; frontContext.fillRect(0, 0, front.width, front.height);
        frontContext.drawImage(maps.frontFoil.image, 0, 0);
        frontPNG = front.toDataURL();
      }
      api.disposeCompleteShelfTextures(Object.values(maps));
    }
    context.fillStyle = "#f4ead1";
    context.font = '14px "Source Sans 3 Local"';
    context.fillText("2D material and typography fixture - not a 3D camera or lighting comparison", 47, 550);
    const meanDeltaE76 = cells.reduce((sum, cell) => sum + cell.deltaE76, 0) / cells.length;
    const sampleDocument = api.buildBookEditorialDocument({
      bookKey: "labelled-typography-fixture", locale: "ru", themeVersion: "fixture-v1",
      title: "Война и мир", writer: "Лев Николаевич Толстой",
      description: { verified: true, value: "Типографический образец редакционного досье. Этот технический текст проверяет размер букв, ритм строк и безопасное расстояние от корешка. Он не является публикацией или описанием произведения. Длинный абзац должен сохраняться полностью при переходе к следующей странице. Уменьшение разрешения текстуры меняет число пикселей, сохраняя состав строк и положение каждого смыслового блока. Читатель получает тот же полный материал в доступной текстовой версии. На листе остаются спокойные поля, ясная иерархия заголовков и заметный номер страницы." },
    });
    const pagination = await api.paginateBookInspectionDocument(sampleDocument);
    if (pagination.status !== "ready") throw new Error(JSON.stringify(pagination.issues));
    const innerStore = new api.BookInspectionTextureStore();
    const generation = innerStore.beginGeneration();
    const innerPages = [];
    for (const page of pagination.document.pages) {
      const resource = await innerStore.request({ documentCacheKey: pagination.document.cacheKey, page, quality: "HIGH" }, generation);
      if (!resource) throw new Error("Inner page texture unavailable");
      const layout = api.getBookInspectionPageLayout(page);
      const glyphBounds = layout.commands.map((command) => {
        context.font = api.bookInspectionFont(command.role);
        const metrics = context.measureText(command.text);
        return { sourceId: command.sourceId, left: command.x - metrics.actualBoundingBoxLeft, right: command.x + metrics.actualBoundingBoxRight, top: command.y - metrics.actualBoundingBoxAscent, bottom: command.y + metrics.actualBoundingBoxDescent };
      });
      if (glyphBounds.some((bounds) => bounds.left < 120 || bounds.right > 1280 || bounds.bottom > 1810)) throw new Error("Inner glyph bounds exceed safe page area");
      innerPages.push({ id: page.id, index: page.index, glyphBounds, png: resource.surface.toDataURL() });
    }
    innerStore.dispose();
    return { cells, meanDeltaE76, maximumDeltaE76: Math.max(...cells.map((cell) => cell.deltaE76)), rowPNG: canvas.toDataURL(), frontPNG, innerPages };
  }, `data:image/png;base64,${reference.toString("base64")}`);
  for (const [key, filename] of [["rowPNG", "owner-material-2d-1720.png"], ["frontPNG", "owner-front-2d.png"]]) {
    if (result[key]) await writeFile(path.join(out, filename), Buffer.from(result[key].split(",")[1], "base64"));
    delete result[key];
  }
  for (const page of result.innerPages) {
    await writeFile(path.join(out, `inner-page-fixture-${page.index}.png`), Buffer.from(page.png.split(",")[1], "base64"));
    delete page.png;
  }
  for (const cell of result.cells) cell.deltaE00 = deltaE2000(srgbToLab(cell.currentRGB), srgbToLab(cell.referenceRGB));
  const meanDeltaE00 = result.cells.reduce((sum, cell) => sum + cell.deltaE00, 0) / result.cells.length;
  const maximumDeltaE00 = Math.max(...result.cells.map(cell => cell.deltaE00));
  const report = {
    method: "CIEDE2000 on D65 Lab from mean sRGB colour of matched 40x40 cloth patches; CIE76 retained separately. Flat 2D texture proof only, excluding scene lighting and camera certification",
    formulaVersion: COLOUR_DIFFERENCE_VERSION,
    reference: referencePath,
    ...result,
    meanDeltaE00,
    maximumDeltaE00,
    patchGatePassed: meanDeltaE00 <= 4 && maximumDeltaE00 <= 7,
  };
  await writeFile(path.join(out, "owner-material-metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ titlesFit: result.cells.length, meanDeltaE00, maximumDeltaE00, patchGatePassed: report.patchGatePassed }));
} finally {
  await browser.close();
}
