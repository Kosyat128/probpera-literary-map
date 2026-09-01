import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function readEnvSetting(relativePath, settingName) {
  const source = readFileSync(path.join(root, relativePath), "utf8").replace(
    /\r\n?/gu,
    "\n"
  );
  const values = source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${settingName}=`))
    .map((line) => line.slice(settingName.length + 1).trim());
  return values.length === 1 ? values[0] : null;
}

const overlayPath =
  "src/data/countries/generated/writerBiographyEnglishTranslations.generated.json";
const adminWranglerPath = "apps/admin/wrangler.jsonc";
const adminEnvExamplePath = "apps/admin/.env.example";
const overlay = readJson(overlayPath);
const adminWrangler = readJson(adminWranglerPath);
const issues = [];

const translations =
  overlay?.translations &&
  typeof overlay.translations === "object" &&
  !Array.isArray(overlay.translations)
    ? overlay.translations
    : null;

if (!translations) {
  issues.push(`${overlayPath}: translations must be an object`);
} else if (Object.keys(translations).length !== 0) {
  issues.push(`${overlayPath}: translations must remain empty while EN is paused`);
}
if (overlay?.translatedCount !== 0) {
  issues.push(`${overlayPath}: translatedCount must be 0 while EN is paused`);
}
if (adminWrangler?.vars?.OPENAI_AUTO_TRANSLATE_PROFILES !== "false") {
  issues.push(
    `${adminWranglerPath}: OPENAI_AUTO_TRANSLATE_PROFILES must be the string \"false\"`
  );
}
if (
  readEnvSetting(adminEnvExamplePath, "OPENAI_AUTO_TRANSLATE_PROFILES") !==
  "false"
) {
  issues.push(
    `${adminEnvExamplePath}: OPENAI_AUTO_TRANSLATE_PROFILES must default to false`
  );
}

if (issues.length > 0) {
  process.stderr.write(
    `English biography pause contract failed (${issues.length}):\n${issues
      .map((issue) => `- ${issue}`)
      .join("\n")}\n`
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    "English biography translations are explicitly paused: public generated overlay is empty and automatic profile translation is disabled. This pause check made no external AI requests.\n"
  );
}
