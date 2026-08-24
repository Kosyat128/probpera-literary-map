import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import {
  atlasCountrySiteCopyKey,
  MODERN_GLOBE_OCEAN_LABELS,
} from "./lib/modern-globe-site-copy.mjs";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sourcePath = path.join(
  projectRoot,
  "src",
  "i18n",
  "InterfaceLanguage.tsx"
);
const outputDirectory = path.join(
  projectRoot,
  "apps",
  "admin",
  "catalog-assets"
);
const outputPath = path.join(outputDirectory, "interface-copy-catalog.json");
const countriesDirectory = path.join(projectRoot, "src", "data", "countries");
const atlasPath = path.join(
  projectRoot,
  "src",
  "data",
  "geo",
  "countries.geojson"
);

const sourceText = await fs.readFile(sourcePath, "utf8");
const sourceFile = ts.createSourceFile(
  sourcePath,
  sourceText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
);

let translationObject = null;
function visit(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.name.text === "englishInterfaceText" &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    translationObject = node.initializer;
    return;
  }
  ts.forEachChild(node, visit);
}
visit(sourceFile);

if (!translationObject) {
  throw new Error("englishInterfaceText was not found in InterfaceLanguage.tsx");
}

const entries = [];
for (const property of translationObject.properties) {
  if (!ts.isPropertyAssignment(property)) {
    throw new Error(
      `Unsupported interface translation entry: ${property.getText(sourceFile)}`
    );
  }
  const name = property.name;
  const russianText =
    ts.isIdentifier(name) || ts.isStringLiteralLike(name)
      ? name.text
      : null;
  const englishText = ts.isStringLiteralLike(property.initializer)
    ? property.initializer.text
    : null;
  if (!russianText || englishText === null) {
    throw new Error(
      `Interface translations must use static string pairs: ${property.getText(sourceFile)}`
    );
  }
  entries.push({
    key: `interface.${russianText}`,
    group: "Весь интерфейс",
    label: russianText,
    defaultRu: russianText,
    defaultEn: englishText,
    multiline: russianText.length > 90 || englishText.length > 90,
  });
}

function staticObjectText(object, propertyName) {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = property.name;
    const key =
      ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : "";
    if (key !== propertyName || !ts.isStringLiteralLike(property.initializer)) {
      continue;
    }
    return property.initializer.text;
  }
  return "";
}

const countryByCode = new Map();
for (const file of await fs.readdir(countriesDirectory)) {
  if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
  const countryPath = path.join(countriesDirectory, file);
  const countrySource = ts.createSourceFile(
    countryPath,
    await fs.readFile(countryPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  function visitCountry(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const code = staticObjectText(node, "code").trim().toUpperCase();
      const name = staticObjectText(node, "name").trim();
      const hasWriters = node.properties.some((property) => {
        if (!ts.isPropertyAssignment(property)) return false;
        const propertyName = property.name;
        return (
          (ts.isIdentifier(propertyName) ||
            ts.isStringLiteralLike(propertyName)) &&
          propertyName.text === "writers"
        );
      });
      if (/^[A-Z]{2}$/u.test(code) && name && hasWriters) {
        countryByCode.set(code, name);
      }
    }
    ts.forEachChild(node, visitCountry);
  }
  visitCountry(countrySource);
}

const englishRegionNames = new Intl.DisplayNames(["en"], { type: "region" });
for (const [code, name] of countryByCode) {
  entries.push({
    key: `country.${code}`,
    group: "Названия стран",
    label: `Название страны: ${name}`,
    defaultRu: name,
    defaultEn: englishRegionNames.of(code) || name,
    multiline: false,
  });
}

const existingCountryKeys = new Set(
  entries.filter((entry) => entry.key.startsWith("country.")).map((entry) => entry.key)
);
const atlas = JSON.parse(await fs.readFile(atlasPath, "utf8"));
for (const feature of atlas.features ?? []) {
  const key = atlasCountrySiteCopyKey(feature.properties);
  if (existingCountryKeys.has(key)) continue;
  const defaultRu = String(feature.properties?.NAME_RU ?? "").trim();
  const defaultEn = String(feature.properties?.NAME_EN ?? "").trim();
  if (!defaultRu || !defaultEn) {
    throw new Error(`${key} is missing a localized modern-globe label.`);
  }
  entries.push({
    key,
    group: "Названия стран и территорий на глобусе",
    label: `Подпись на глобусе: ${defaultRu}`,
    defaultRu,
    defaultEn,
    multiline: false,
  });
  existingCountryKeys.add(key);
}

for (const ocean of MODERN_GLOBE_OCEAN_LABELS) {
  entries.push({
    key: ocean.key,
    group: "Подписи океанов на глобусе",
    label: `Подпись океана: ${ocean.ru}`,
    defaultRu: ocean.ru,
    defaultEn: ocean.en,
    multiline: false,
  });
}

entries.sort((first, second) =>
  first.defaultRu.localeCompare(second.defaultRu, "ru")
);

const generated = `${JSON.stringify(entries, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = await fs.readFile(outputPath, "utf8").catch(() => "");
  if (existing !== generated) {
    throw new Error(
      "The admin interface-copy catalog is stale. Run npm run interface:copy:catalog."
    );
  }
  console.log(`Verified ${entries.length} site-copy fields for the admin.`);
} else {
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(outputPath, generated, "utf8");
  console.log(`Exported ${entries.length} site-copy fields for the admin.`);
}
