#!/usr/bin/env node
// Explicit local/operator entrypoint. Default is dry-run with zero service calls.
// --execute must NEVER be used against production without separate authorization.
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

try {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const result = await build({ entryPoints: [fileURLToPath(new URL("../../server/planet/deletionProcessorCli.ts", import.meta.url))],
    bundle: true, write: false, platform: "node", format: "esm", packages: "external", logLevel: "silent" });
  // Compilation stays in memory. Node resolves installed server dependencies from
  // this repository; no generated key, executable artifact or secret is written.
  const command = result.outputFiles[0].text + "\nconst commandResult = await runReaderDeletionCommand(process.argv.slice(2), process.env);\nprocess.stdout.write(JSON.stringify(commandResult) + '\\n');\nprocess.exitCode = ['dry-run','completed'].includes(commandResult.status) ? 0 : 1;\n";
  const child = spawn(process.execPath, ["--input-type=module", "-", ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: ["pipe", "inherit", "inherit"], windowsHide: true });
  child.stdin.on("error", () => {});
  child.stdin.end(command);
  child.once("error", () => { process.stdout.write('{"status":"invalid-command","codes":["local-runtime-unavailable"]}\n'); process.exitCode = 1; });
  child.once("exit", code => { process.exitCode = code ?? 1; });
} catch {
  process.stdout.write('{"status":"invalid-command","codes":["local-runtime-unavailable"]}\n');
  process.exitCode = 1;
}
