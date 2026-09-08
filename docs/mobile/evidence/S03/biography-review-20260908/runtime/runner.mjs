import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const reportRoot = ".tmp/s03-biography-review-20260908/runtime-unit-a2";
await mkdir(reportRoot, { recursive: true });
const inputs = [
"src/data/countries/types.ts",
"src/data/writerBiography.ts",
"src/data/writerBiography.test.ts",
"src/data/countries/writerBiographyEnglishTranslations.ts",
"src/data/countries/writerBiographyEnglishTranslations.test.ts",
"src/data/biographyEditorialReview.ts",
"src/data/countries/index.ts",
"src/data/cms/editorialOverrides.ts",
"src/data/cms/editorialOverrides.test.ts",
"src/data/countries/generated/writerBiographyEnglishTranslations.generated.json",
"vitest.config.ts","package.json","package-lock.json"
];
const snapshot = async () => Object.fromEntries(await Promise.all(inputs.map(async (file) => [file, createHash("sha256").update(await readFile(file)).digest("hex")])));
const before = await snapshot();
await writeFile(path.join(reportRoot, "source-before.json"), JSON.stringify(before, null, 2) + "\n");
const args = ["node_modules/vitest/vitest.mjs", "run", "src/data/writerBiography.test.ts", "src/data/countries/writerBiographyEnglishTranslations.test.ts", "src/data/cms/editorialOverrides.test.ts", "--reporter=json", "--outputFile=" + reportRoot + "/vitest.json"];
const startedAt = new Date().toISOString();
const start = performance.now();
const child = spawn(process.execPath, args, { cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
let stdout = "", stderr = "";
child.stdout.on("data", (data) => { stdout += data; });
child.stderr.on("data", (data) => { stderr += data; });
const exitCode = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
const after = await snapshot();
await writeFile(path.join(reportRoot, "source-after.json"), JSON.stringify(after, null, 2) + "\n");
await writeFile(path.join(reportRoot, "stdout.log"), stdout);
await writeFile(path.join(reportRoot, "stderr.log"), stderr);
const result = { schemaVersion: 1, command: [process.execPath, ...args], startedAt, finishedAt: new Date().toISOString(), durationMs: Math.round(performance.now()-start), exitCode, inputsUnchanged: JSON.stringify(before)===JSON.stringify(after), changedInputs: inputs.filter((file) => before[file]!==after[file]), sourceSnapshotScope: "Explicit runtime, owned test, helper, integration, and test-config inputs; not a full corpus byte snapshot." };
await writeFile(path.join(reportRoot, "result.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result));
if (stderr) console.log(stderr);
process.exitCode = exitCode;