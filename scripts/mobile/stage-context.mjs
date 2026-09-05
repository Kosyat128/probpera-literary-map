import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { routeStage, V12_INPUT_PIN, verifyRequirements } from "./requirements.mjs";

const root = fileURLToPath(new URL("../../docs/mobile/requirements/v12/", import.meta.url));
try {
  const verified = await verifyRequirements(root, V12_INPUT_PIN);
  if (!verified.pass) throw new Error("V12 input integrity failed; do not load stage documents");
  const routing = JSON.parse(await readFile(path.join(root, "95_STAGE_DOCUMENT_ROUTING.json"), "utf8"));
  const context = routeStage(routing, process.argv[2]);
  for (const name of context.documents) await readFile(path.join(root, name));
  console.log(JSON.stringify({ ...context, manifestSha256: verified.manifestSha256,
    instruction: "Read these documents and active state; do not read the standalone fallback again." }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error.message }));
  process.exitCode = 1;
}
