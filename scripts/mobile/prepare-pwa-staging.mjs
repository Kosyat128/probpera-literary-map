import { realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { preparePwaStaging } from "./pwa-staging-package.mjs";

export function parsePwaStagingArgs(args) {
  const options = { writePackage: false, allowQa: false };
  const values = { "--expected-sha": "expectedHead", "--build-id": "expectedBuildId", "--dir": "artifactDir", "--out": "outputDir", "--receipt": "receiptPath", "--receipt-sha256": "receiptSha256", "--validation-root": "validationRoot" };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (seen.has(flag)) throw new Error("INVALID_COMMAND");
    seen.add(flag);
    if (flag === "--write-package") options.writePackage = true;
    else if (flag === "--allow-qa") options.allowQa = true;
    else if (Object.hasOwn(values, flag) && args[index + 1] && !args[index + 1].startsWith("--")) options[values[flag]] = args[++index];
    else throw new Error("INVALID_COMMAND");
  }
  if (Object.values(values).some(key => !options[key])) throw new Error("INVALID_COMMAND");
  if (!/^[a-f0-9]{40}$/u.test(options.expectedHead) || !/^[a-f0-9]{64}$/u.test(options.expectedBuildId) || !/^[a-f0-9]{64}$/u.test(options.receiptSha256)) throw new Error("INVALID_COMMAND");
  options.validationReceipt = { path: options.receiptPath, sha256: options.receiptSha256 };
  delete options.receiptPath; delete options.receiptSha256;
  return options;
}
if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parsePwaStagingArgs(process.argv.slice(2));
    console.log(JSON.stringify({ target: "local-preparation", platform: "Web/PWA", profile: "SAFE_PAID_BILINGUAL_V1", expectedHead: options.expectedHead, buildId: options.expectedBuildId, dryRun: !options.writePackage }));
    console.log(JSON.stringify(await preparePwaStaging(options), null, 2));
  } catch (error) {
    const code = error.message === "INVALID_COMMAND" ? "INVALID_COMMAND" : typeof error.code === "string" && /^[A-Z_]+$/u.test(error.code) ? error.code : "PREPARATION_REJECTED";
    console.log(JSON.stringify({ pass: false, code, productionActionsAuthorized: false, releaseReady: false }));
    process.exitCode = 1;
  }
}
