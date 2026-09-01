import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const forbiddenClientEnvironmentIdentifiers = [
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "PUBLIC_SITE_DEPLOY_HOOK_URL",
  "VITE_PUBLIC_SITE_DEPLOY_HOOK_URL",
  "PUBLIC_DEPLOY_HOOK_URL",
  "PUBLIC_SITE_DEPLOY_HOOK_TOKEN",
  "VITE_PUBLIC_SITE_DEPLOY_HOOK_TOKEN",
  "PUBLIC_DEPLOY_HOOK_TOKEN",
  "GITHUB_DEPLOY_TOKEN",
  "PUBLIC_GITHUB_DEPLOY_TOKEN",
  "PREMIUM_TRANSLATION_PROVIDER",
  "CLOUDFLARE_TRANSLATION_MODEL",
  "CLOUDFLARE_TRANSLATION_REVIEW_MODEL",
  "OPENAI_TRANSLATION_MODEL",
  "OPENAI_TRANSLATION_REVIEW_MODEL",
  "OPENAI_TRANSLATION_REASONING_EFFORT",
  "OPENAI_TRANSLATION_REASONING_MODE",
  "OPENAI_TRANSLATION_REVIEW_REASONING_EFFORT",
  "OPENAI_TRANSLATION_REVIEW_REASONING_MODE",
  "OPENAI_PREMIUM_TRANSLATION_REVIEW",
  "OPENAI_AUTO_TRANSLATE_ARTICLES",
  "OPENAI_AUTO_TRANSLATE_LIBRARY",
  "OPENAI_AUTO_TRANSLATE_SITE_COPY",
  "OPENAI_AUTO_TRANSLATE_PROFILES",
];

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? files(absolute) : [absolute];
  });
}

export function secretClientAssetFindings({ directory, environment = process.env }) {
  if (!existsSync(directory)) return [{ file: directory, token: "STATIC_ASSETS_MISSING" }];
  const secretValues = forbiddenClientEnvironmentIdentifiers
    .map((name) => String(environment[name] || "").trim())
    .filter((value) => value.length >= 8);
  const forbidden = [...forbiddenClientEnvironmentIdentifiers, ...secretValues];
  const findings = [];
  for (const filename of files(directory)) {
    if (!/\.(?:js|css|json|map)$/u.test(filename)) continue;
    const source = readFileSync(filename, "utf8");
    for (const token of forbidden) {
      if (source.includes(token)) findings.push({ file: filename, token });
    }
  }
  return findings;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const directory = path.join(root, "apps/admin/.next/static");
  const findings = secretClientAssetFindings({ directory });
  if (!findings.length) {
    console.log("Admin client static assets contain no server-secret identifiers or configured values.");
    return;
  }
  const summary = findings
    .slice(0, 20)
    .map(({ file, token }) => `${path.relative(root, file)}: ${token}`)
    .join("\n");
  throw new Error(`Admin client secret boundary failed:\n${summary}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
