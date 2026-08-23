import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exporter = path.join(projectRoot, "scripts", "export-published-content.mjs");
const premiumExporter = path.join(
  projectRoot,
  "scripts",
  "export-premium-translations.mjs"
);
const attempts = Number(process.env.CMS_EXPORT_MAX_ATTEMPTS || "5");

if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 10) {
  throw new Error("CMS_EXPORT_MAX_ATTEMPTS must be an integer from 1 to 10.");
}

function runScript(target, attempt, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [target], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CMS_EXPORT_ATTEMPT: String(attempt),
        ...(options.hideGithubOutput ? { GITHUB_OUTPUT: "" } : {}),
      },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

function failedMessage(label, attempt, result) {
  return `${label} failed on attempt ${attempt}${
    result.signal ? ` (${result.signal})` : ` with exit code ${result.code}`
  }.`;
}

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  // The ordinary exporter must not publish its intermediate content hash. The
  // premium stage enriches the same atomic snapshot and writes the final
  // GitHub outputs only after all English records have passed public RLS.
  const ordinary = await runScript(exporter, attempt, {
    hideGithubOutput: true,
  });
  if (ordinary.code !== 0 && ordinary.code !== 75) {
    throw new Error(failedMessage("CMS export", attempt, ordinary));
  }

  if (ordinary.code === 0) {
    const premium = await runScript(premiumExporter, attempt);
    if (premium.code === 0) process.exit(0);
    if (premium.code !== 75) {
      throw new Error(
        failedMessage("Premium translation export", attempt, premium)
      );
    }
  }

  if (attempt === attempts) break;
  const delay = Math.min(5000, 250 * 2 ** (attempt - 1));
  console.warn(
    `CMS changed during complete export attempt ${attempt}; retrying the ordinary and premium snapshots together in ${delay} ms.`
  );
  await new Promise((resolve) => setTimeout(resolve, delay));
}

throw new Error(
  `CMS kept changing for ${attempts} consecutive export attempts; publication stopped without replacing the previous snapshot.`
);
