import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { executeNativeArchiveRead, validateNativeArchiveWorkflowReceipt }
  from "../lib/literary-archive-native-postflight.mjs";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--receipt-file" || args[2] !== "--output-file") {
  throw new Error("Use --receipt-file reconciliation/receipt.json --output-file reconciliation/postflight.json.");
}
const directory = path.resolve("reconciliation");
function checkedPath(value) {
  const absolute = path.resolve(value), relative = path.relative(directory, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)
    || path.extname(absolute).toLowerCase() !== ".json") {
    throw new Error("Postflight input and output must be JSON files inside reconciliation.");
  }
  return absolute;
}
const input = checkedPath(args[1]), output = checkedPath(args[3]);
if (input === output) throw new Error("The committed workflow receipt must not be overwritten.");
try {
  const source = await readFile(input, "utf8");
  if (Buffer.byteLength(source) > 128 * 1024) throw new Error("Oversized workflow receipt.");
  const receipt = validateNativeArchiveWorkflowReceipt(JSON.parse(source));
  const envelope = await executeNativeArchiveRead("postflight", receipt);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(envelope, null, 2) + "\n", { mode: 0o600 });
  console.log(`Read-only native postflight passed for committed release ${receipt.releaseId}: ${envelope.result.unlockedWorks} unlocked works, ${envelope.result.predecessorPublic} predecessor-public works, current Evidence V2 enforcement, ${envelope.elapsedMs} ms. No archive write was requested.`);
} catch (error) {
  const sqlState = typeof error?.sqlState === "string" && /^[0-9A-Z]{5}$/u.test(error.sqlState)
    ? ` SQLSTATE ${error.sqlState}.` : "";
  console.error(`Read-only archive postflight could not be verified.${sqlState} The committed release was not reapplied or modified.`);
  process.exitCode = 1;
}
