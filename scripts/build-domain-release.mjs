import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nodeCommand = process.execPath;
const npmCli =
  process.env.npm_execpath ||
  path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const releaseEnvironment = {
  ...process.env,
  PUBLIC_SITE_ORIGIN: "https://probpera.ru",
  PUBLIC_SITE_BASE_PATH: "/",
  PUBLIC_SITE_URL: "https://probpera.ru",
  VITE_PUBLIC_SITE_URL: "https://probpera.ru",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: releaseEnvironment,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} завершился с кодом ${code}`));
    });
  });
}

await run(nodeCommand, ["scripts/audit-analytics-config.mjs"]);
await run(nodeCommand, [
  npmCli,
  "run",
  process.env.CMS_SNAPSHOT_PREEXPORTED === "true"
    ? "build:from-snapshot"
    : "build",
]);
await fs.writeFile(path.join(projectRoot, "dist", "CNAME"), "probpera.ru\n", "utf8");
await fs.writeFile(path.join(projectRoot, "dist", ".nojekyll"), "", "utf8");
await run(nodeCommand, ["scripts/check-deployed-release-head.mjs", "--write"]);
await run(nodeCommand, ["scripts/audit-domain-release.mjs"]);
await run(nodeCommand, ["scripts/audit-seo-release.mjs"]);

console.log(
  "Доменный пакет готов в dist. DNS и настройки GitHub Pages этим действием не изменены."
);
