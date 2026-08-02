import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

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

function enforce(label, actual, limit) {
  const ok = actual <= limit;
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${actual} / ${limit} bytes`);
  if (!ok) failures.push(label);
}

enforce("dist total", total, budget.distTotalBytes);
if (largestScript) enforce(`largest JS (${largestScript.relative})`, largestScript.bytes, budget.largestJavaScriptBytes);
if (mainScript) enforce(`main JS (${mainScript.relative})`, mainScript.bytes, budget.mainJavaScriptBytes);
if (globeTexture) enforce("antique globe texture", globeTexture.bytes, budget.globeTextureBytes);
for (const image of oversizedImages) {
  failures.push(`oversized image ${image.relative}`);
  console.error(`FAIL oversized image ${image.relative}: ${image.bytes} bytes`);
}

if (failures.length) {
  throw new Error(`Performance budget exceeded: ${failures.join(", ")}`);
}

console.log(`Performance budget passed for ${measured.length} production files.`);
