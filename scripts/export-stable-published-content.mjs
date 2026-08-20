import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exporter = path.join(projectRoot, "scripts", "export-published-content.mjs");
const attempts = Number(process.env.CMS_EXPORT_MAX_ATTEMPTS || "5");

if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10) {
  throw new Error("CMS_EXPORT_MAX_ATTEMPTS must be an integer from 1 to 10.");
}

function runExporter(attempt) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [exporter], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CMS_EXPORT_ATTEMPT: String(attempt),
      },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  const result = await runExporter(attempt);
  if (result.code === 0) process.exit(0);
  if (result.code !== 75) {
    throw new Error(
      `CMS export failed on attempt ${attempt}${
        result.signal ? ` (${result.signal})` : ` with exit code ${result.code}`
      }.`
    );
  }
  if (attempt === attempts) break;
  const delay = Math.min(5000, 250 * 2 ** (attempt - 1));
  console.warn(
    `CMS changed during export attempt ${attempt}; retrying the complete snapshot in ${delay} ms.`
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}

throw new Error(
  `CMS kept changing for ${attempts} consecutive export attempts; publication stopped without replacing the previous snapshot.`
);
