import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const dist = path.join(root, "dist");
const budget = JSON.parse(
  await readFile(path.join(root, "performance-budget.json"), "utf8")
);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? filesIn(target) : Promise.resolve([target]);
    })
  );
  return nested.flat();
}

const files = await filesIn(dist);
const measured = await Promise.all(
  files.map(async (file) => ({
    file,
    relative: path.relative(dist, file).replaceAll("\\", "/"),
    bytes: (await stat(file)).size,
  }))
);
const failures = [];
const total = measured.reduce((sum, item) => sum + item.bytes, 0);
const scripts = measured.filter((item) => item.relative.endsWith(".js"));
const images = measured.filter((item) => /\.(?:avif|jpe?g|png|webp)$/iu.test(item.relative));
const writerPortraits = images.filter((item) =>
  item.relative.startsWith("assets/writer-portraits/")
);
const bookCovers = images.filter((item) =>
  item.relative.startsWith("brand/book-covers/")
);
const largestScript = scripts.toSorted((a, b) => b.bytes - a.bytes)[0];
const mainScript = scripts
  .filter((item) => /^assets\/index-/u.test(item.relative))
  .toSorted((a, b) => b.bytes - a.bytes)[0];
const globeTexture = measured.find((item) =>
  item.relative.endsWith("textures/antique-world-1887.webp")
);
const oversizedImages = images.filter(
  (item) =>
    item.relative !== globeTexture?.relative &&
    item.bytes > budget.individualImageBytes
);

async function compressedBytes(item) {
  if (!item) return 0;
  return gzipSync(await readFile(item.file), { level: 9 }).byteLength;
}

const writerPortraitTotal = writerPortraits.reduce(
  (sum, item) => sum + item.bytes,
  0
);
const writerPortraitAverage = writerPortraits.length
  ? Math.ceil(writerPortraitTotal / writerPortraits.length)
  : 0;
const writerPortraitMaximum = writerPortraits.reduce(
  (maximum, item) => Math.max(maximum, item.bytes),
  0
);
const bookCoverTotal = bookCovers.reduce((sum, item) => sum + item.bytes, 0);
const bookCoverAverage = bookCovers.length
  ? Math.ceil(bookCoverTotal / bookCovers.length)
  : 0;
const bookCoverMaximum = bookCovers.reduce(
  (maximum, item) => Math.max(maximum, item.bytes),
  0
);
const distExcludingBookCovers = total - bookCoverTotal;
const largestScriptGzip = await compressedBytes(largestScript);
const mainScriptGzip = await compressedBytes(mainScript);

function githubCommandValue(value) {
  return String(value)
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

function annotateFailure(label, actual, limit, unit) {
  if (process.env.GITHUB_ACTIONS !== "true") return;
  const detail = githubCommandValue(`${label}: ${actual} / ${limit} ${unit}`);
  console.error(`::error title=Performance budget exceeded::${detail}`);
}

function enforce(label, actual, limit, unit = "bytes") {
  const ok = actual <= limit;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual} / ${limit} ${unit}`);
  if (!ok) {
    failures.push(label);
    annotateFailure(label, actual, limit, unit);
  }
}

enforce("dist total", total, budget.distTotalBytes);
enforce(
  "dist excluding book covers",
  distExcludingBookCovers,
  budget.distExcludingBookCoversBytes
);
if (largestScript) enforce(`largest JS (${largestScript.relative})`, largestScript.bytes, budget.largestJavaScriptBytes);
if (largestScript) enforce(`largest JS gzip (${largestScript.relative})`, largestScriptGzip, budget.largestJavaScriptGzipBytes);
if (mainScript) enforce(`main JS (${mainScript.relative})`, mainScript.bytes, budget.mainJavaScriptBytes);
if (mainScript) enforce(`main JS gzip (${mainScript.relative})`, mainScriptGzip, budget.mainJavaScriptGzipBytes);
if (globeTexture) enforce("antique globe texture", globeTexture.bytes, budget.globeTextureBytes);
enforce("writer portraits total", writerPortraitTotal, budget.writerPortraitTotalBytes);
enforce("writer portrait average", writerPortraitAverage, budget.writerPortraitAverageBytes);
enforce("writer portrait maximum", writerPortraitMaximum, budget.writerPortraitMaximumBytes);
enforce("book cover count", bookCovers.length, budget.bookCoverCount, "files");
enforce("book covers total", bookCoverTotal, budget.bookCoverTotalBytes);
enforce("book cover average", bookCoverAverage, budget.bookCoverAverageBytes);
enforce("book cover maximum", bookCoverMaximum, budget.bookCoverMaximumBytes);
for (const image of oversizedImages) {
  const label = `oversized image ${image.relative}`;
  failures.push(label);
  console.error(`FAIL ${label}: ${image.bytes} bytes`);
  annotateFailure(label, image.bytes, budget.individualImageBytes, "bytes");
}

if (failures.length) {
  throw new Error(`Performance budget exceeded: ${failures.join(", ")}`);
}

console.log(`Performance budget passed for ${measured.length} production files.`);
