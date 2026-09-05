import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createNewsStorageClient, syncNewsStorage } from "./lib/literary-news-kv-sync.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".tmp", "literary-news-sync");
await mkdir(output, { recursive: true });
const storage = createNewsStorageClient({
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  apiToken: process.env.CLOUDFLARE_API_TOKEN,
});

const state = await syncNewsStorage({
  storage,
  async collect({ previousState, previousQueue }) {
    const bulkPath = path.join(output, "bulk.json");
    const args = ["scripts/refresh-literary-news.mjs", `--output=${bulkPath}`];
    if (previousState !== null) {
      const statePath = path.join(output, "previous-state.json");
      const queuePath = path.join(output, "previous-queue.json");
      await writeFile(statePath, previousState, "utf8");
      await writeFile(queuePath, previousQueue, "utf8");
      args.push(`--previous-state=${statePath}`, `--previous-queue=${queuePath}`);
    }
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", code => code === 0 ? resolve() : reject(new Error(`News collection failed (${code})`)));
    });
    return JSON.parse(await readFile(bulkPath, "utf8"));
  },
});
await writeFile(path.join(output, "source-health.json"), `${JSON.stringify(state, null, 2)}\n`, "utf8");
const summary = `Checked ${state.sources.length} literary sources; ${state.sources.filter(source => source.status === "ok").length} available. ${state.pendingCount} discoveries remain in the private editorial queue. No discoveries were automatically published.\n`;
console.log(summary.trim());
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary, "utf8");
if (!state.sources.some(source => source.status === "ok")) process.exitCode = 1;
