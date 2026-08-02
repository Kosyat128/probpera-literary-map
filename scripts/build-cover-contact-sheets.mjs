import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const sourceRoot = path.resolve(process.argv[2] || ".review/covers");
const outputRoot = path.resolve(process.argv[3] || ".review/contact-sheets");
const supported = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (supported.has(path.extname(entry.name).toLowerCase())) files.push(target);
  }
  return files;
}

function escapeXml(value) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

await fs.mkdir(outputRoot, { recursive: true });
const files = (await walk(sourceRoot)).sort((first, second) =>
  first.localeCompare(second, "ru", { numeric: true })
);
const manifest = files.map((file, index) => ({
  index: index + 1,
  file: path.relative(sourceRoot, file).replaceAll("\\", "/"),
}));
await fs.writeFile(
  path.join(outputRoot, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

const columns = 5;
const rows = 3;
const tileWidth = 220;
const imageHeight = 300;
const captionHeight = 38;
const tileHeight = imageHeight + captionHeight;
const pageSize = columns * rows;

for (let page = 0; page * pageSize < files.length; page += 1) {
  const start = page * pageSize;
  const current = files.slice(start, start + pageSize);
  const composite = [];
  for (let offset = 0; offset < current.length; offset += 1) {
    const index = start + offset + 1;
    const left = (offset % columns) * tileWidth;
    const top = Math.floor(offset / columns) * tileHeight;
    const thumbnail = await sharp(current[offset])
      .rotate()
      .resize(tileWidth - 12, imageHeight - 12, {
        fit: "contain",
        background: "#17101d",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    composite.push({ input: thumbnail, left: left + 6, top: top + 6 });

    const label = escapeXml(
      `${String(index).padStart(3, "0")} · ${path.basename(current[offset]).slice(0, 25)}`
    );
    composite.push({
      input: Buffer.from(
        `<svg width="${tileWidth}" height="${captionHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#2a0639"/><text x="10" y="24" fill="#fff5e8" font-size="12" font-family="Arial, sans-serif">${label}</text></svg>`
      ),
      left,
      top: top + imageHeight,
    });
  }

  await sharp({
    create: {
      width: columns * tileWidth,
      height: rows * tileHeight,
      channels: 3,
      background: "#0d0711",
    },
  })
    .composite(composite)
    .webp({ quality: 84 })
    .toFile(path.join(outputRoot, `covers-${String(page + 1).padStart(2, "0")}.webp`));
}

console.log(`Created ${Math.ceil(files.length / pageSize)} sheets for ${files.length} images.`);
