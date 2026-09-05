import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

// Keep the standalone Node suite available to the repository's normal CI run.
test("literary news collector passes its isolated Node regression suite", async () => {
  await promisify(execFile)(process.execPath, [
    "--test",
    fileURLToPath(new URL("./literary-news-feed.node-test.mjs", import.meta.url)),
  ], { timeout: 20_000, maxBuffer: 1024 * 1024 });
}, 25_000);
