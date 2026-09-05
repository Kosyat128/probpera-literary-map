import { fileURLToPath } from "node:url";
import { V12_INPUT_PIN, verifyRequirements } from "./requirements.mjs";

const root = fileURLToPath(new URL("../../docs/mobile/requirements/v12/", import.meta.url));
try {
  const report = await verifyRequirements(root, V12_INPUT_PIN);
  console.log(JSON.stringify(report, null, 2));
  if (!report.pass) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }));
  process.exitCode = 1;
}
