import { writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import reviewed from "../data/news/reviewed.json" with { type: "json" };
import withdrawals from "../data/news/withdrawals.json" with { type: "json" };
import { buildPublishedNewsFeed } from "./lib/literary-news-publication.mjs";
import { pendingNewsSourceState } from "./lib/literary-news-state.mjs";

const release = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const feed = await buildPublishedNewsFeed({ records: reviewed, withdrawals, release,
  state: pendingNewsSourceState(), current: new Date() });
await writeFile(new URL("../public/literary-news-snapshot.json", import.meta.url), `${JSON.stringify(feed)}\n`);
console.log(`Literary-news fallback: ${feed.items.length} records; release ${release}; captured ${feed.generatedAt}.`);
