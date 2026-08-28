import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildBookSceneThemeManifest,
  serializeBookSceneThemeManifest,
} from "./lib/book-scene-theme-manifest.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const outputPath = path.join(projectRoot, "src", "books", "bookCoverPalettes.generated.json");
const write = process.argv.includes("--write");
const check = process.argv.includes("--check") || !write;
const output = serializeBookSceneThemeManifest(
  await buildBookSceneThemeManifest(projectRoot)
);

if (write) {
  await writeFile(outputPath, output, "utf8");
  console.log(`Wrote ${path.relative(projectRoot, outputPath)}.`);
}

if (check) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== output) {
    throw new Error(
      "Book-scene palette manifest is stale. Run npm run books:themes:build."
    );
  }
  console.log("Book-scene palette manifest is current.");
}
