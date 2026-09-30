import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import reviewed from "../data/news/reviewed.json" with { type: "json" };
import withdrawals from "../data/news/withdrawals.json" with { type: "json" };
import { prepareDailyNewsReview } from "./prepare-literary-news-daily-review.mjs";
import { DAILY_NEWS_PROFILE_KEY, DAILY_NEWS_LEDGER_KEY, DAILY_NEWS_OWNER_KEY, DAILY_NEWS_WINDOW } from "./lib/literary-news-daily-profile.mjs";
import { createDailyNewsStorageClient, createDailyWorkersAiClient, mergeDailyLedgers,
  runDailyNewsAutomation, validateDailyNodeOwner } from "./lib/literary-news-daily-automation.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const output = path.join(root, ".tmp", "literary-news-daily");
async function atomicJson(name, value) {
  await mkdir(output, { recursive: true });
  const target = path.join(output, name), temporary = target + "." + process.pid + ".tmp";
  await writeFile(temporary, JSON.stringify(value) + "\n", "utf8"); await rename(temporary, target);
}
async function optionalJson(name) {
  try { return JSON.parse(await readFile(path.join(output, name), "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw new Error("daily_local_checkpoint_invalid"); }
}
/** Operator fallback only. Scheduled CI uses the native preparation writer and runs media/capture. */
export async function runNodeDailyAutomation({ env = process.env, commit = false, ownerAuthorized = false,
  current = null, fetchImpl = fetch, prepareIntake = prepareDailyNewsReview, storage: providedStorage,
  ai: providedAi, local: providedLocal, persist = atomicJson } = {}) {
  if (!ownerAuthorized) throw new Error("daily_node_fallback_authorization_required");
  const storage = providedStorage || createDailyNewsStorageClient({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN, fetchImpl });
  const clock = () => current || new Date();
  const verifyOwner = async () => validateDailyNodeOwner(await storage.read(DAILY_NEWS_OWNER_KEY), clock());
  await verifyOwner();
  const [previous, profile] = await Promise.all([storage.read(DAILY_NEWS_LEDGER_KEY), storage.read(DAILY_NEWS_PROFILE_KEY)]);
  const local = providedLocal === undefined ? await optionalJson("automation-checkpoint.json") : providedLocal;
  const state = await mergeDailyLedgers(previous, profile, local, clock());
  const ai = providedAi || createDailyWorkersAiClient({ accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_API_TOKEN, fetchImpl, maxCalls: 30 });
  const cooling = state.providerStop && Date.parse(state.providerStop.retryAfterAt) > clock().getTime();
  const intake = cooling ? { details: [] } : await prepareIntake({ current: clock(), sourceLimit: 32, detailLimit: 30, reviewed });
  const result = await runDailyNewsAutomation({ intake, previous: state, ai, reviewed, withdrawals,
    current: clock(), saveCheckpoint: value => persist("automation-checkpoint.json", value) });
  await persist("approved-profile.json", result.profile); await persist("automation-report.json", result.report);
  if (commit) {
    // Never create/change owner control. Its drain and expiry are rechecked around both writes.
    await verifyOwner(); await storage.write(DAILY_NEWS_LEDGER_KEY, result.state);
    await verifyOwner(); await storage.write(DAILY_NEWS_PROFILE_KEY, result.profile);
    result.report.publicationConfirmed = true; await persist("automation-report.json", result.report);
  }
  return result;
}
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--plan", "--review", "--commit", "--offline-owner-authorized"].includes(arg)))
    throw new Error("daily_node_argument_invalid");
  if (!args.includes("--review") && !args.includes("--commit")) {
    console.log(JSON.stringify({ status: "plan_only", scheduledWriter: "native-durable-preparation-worker",
      nodeWrites: false, ownerControlRequired: true, sourceLimit: 32, detailLimit: 30, maxProviderCalls: 30,
      minimum: 10, maximum: 15, annualWindow: DAILY_NEWS_WINDOW }));
    return;
  }
  const result = await runNodeDailyAutomation({ commit: args.includes("--commit"), ownerAuthorized: args.includes("--offline-owner-authorized") });
  console.log(JSON.stringify(result.report)); if (result.report.stoppedReason) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch (error) {
    const report = { schemaVersion: 1, status: "automation_unconfirmed", publicationConfirmed: false, deliveryConfirmed: false,
      code: /^daily_[a-z0-9_]+$/.test(error?.message || "") ? error.message : "daily_automation_unavailable" };
    await atomicJson("automation-report.json", report).catch(() => {});
    console.error(JSON.stringify(report)); process.exitCode = 1;
  }
}
