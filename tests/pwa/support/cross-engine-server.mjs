import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { lstat, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { startPwaQaServer } from "./local-server.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
export function crossEngineSettings(environment = process.env) {
  const runId = environment.PWA_CROSS_ENGINE_RUN_ID;
  if (!/^[a-z0-9][a-z0-9-]{5,47}$/u.test(runId ?? "")) throw new Error("Set a unique PWA_CROSS_ENGINE_RUN_ID (6-48 lowercase letters, digits or hyphens)");
  const port = Number(environment.PWA_CROSS_ENGINE_PORT ?? 4296);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid cross-engine loopback port");
  return Object.freeze({
    root, runId, port, origin: "http://127.0.0.1:" + port,
    authorityPath: `.tmp/pwa-qa/cross-engine-${runId}-authority.json`,
    controlPath: `.tmp/pwa-qa/cross-engine-${runId}-server.json`,
    outputPath: path.join(root, ".tmp/pwa-cross-engine-results", runId),
    browserPath: path.join(root, ".tmp/browser-engines"),
  });
}

/** Read-only executable inventory. Descriptor versions are not runtime observations. */
export async function crossEngineAvailability() {
  const { chromium, firefox, webkit } = await import("playwright");
  const registry = JSON.parse(await readFile(path.join(root, "node_modules/playwright-core/browsers.json"), "utf8"));
  const packageInfo = JSON.parse(await readFile(path.join(root, "node_modules/playwright/package.json"), "utf8"));
  return {
    capturedAt: new Date().toISOString(), host: { platform: process.platform, architecture: process.arch, release: os.release() },
    playwrightVersion: packageInfo.version, requestedBrowserPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
    engines: [chromium, firefox, webkit].map(engine => ({
      engine: engine.name(), executablePath: engine.executablePath(), executableExists: existsSync(engine.executablePath()),
      descriptor: registry.browsers.find(item => item.name === engine.name()), runtimeVersion: null,
    })),
    chromeWindowsCandidates: process.platform === "win32" ? ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"]
      .map(filename => ({ executablePath: filename, executableExists: existsSync(filename), runtimeVersion: null })) : [],
    verdict: "Inventory only: no browser or native installation UI was started.",
  };
}

async function mustBeAbsent(filename) {
  try { await lstat(filename); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  throw new Error("Preserve the previous evidence first; refusing to overwrite " + filename);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length === 3 && process.argv[2] === "--inventory") {
    console.log(JSON.stringify(await crossEngineAvailability(), null, 2));
  } else {
    if (process.argv.length !== 3 || process.argv[2] !== "--serve") throw new Error("Use --inventory, or --serve after the coordinated fresh-build checkpoint");
    if (process.env.PWA_CROSS_ENGINE_ALLOW_BUILD !== "1") throw new Error("Fresh QA build is disabled; set PWA_CROSS_ENGINE_ALLOW_BUILD=1 only after preserving the prior artifact");
    const settings = crossEngineSettings();
    // The shared builder writes dist-pwa. Never silently replace the earlier
    // accepted local evidence or reuse an ephemeral authority from a prior run.
    for (const filename of [path.join(root, "dist-pwa"), path.join(root, settings.authorityPath), path.join(root, settings.controlPath), path.join(settings.outputPath, "session.json")]) await mustBeAbsent(filename);
    const availability = await crossEngineAvailability();
    const instance = await startPwaQaServer({ port: settings.port, authorityPath: settings.authorityPath, controlPath: settings.controlPath, buildQa: true });
    try {
      const artifact = JSON.parse(await readFile(path.join(root, "dist-pwa/artifact.json"), "utf8"));
      await mkdir(settings.outputPath, { recursive: true });
      await writeFile(path.join(settings.outputPath, "session.json"), JSON.stringify({
        schemaVersion: 1, runId: settings.runId, localQaOnly: true, origin: instance.origin, availability,
        artifact: { buildId: artifact.buildId, authoritySha256: artifact.authoritySha256, sourceCommit: artifact.sourceCommit, sourceInputsSha256: artifact.sourceInputs?.sha256, localQaAuthority: artifact.localQaAuthority, releaseReady: artifact.releaseReady },
        limits: ["One fresh loopback QA authority signs fixture access only.", "No production identity/payment, native installation, Safari or physical mobile claim."],
      }, null, 2) + "\n");
      console.log(JSON.stringify({ ready: true, localQaOnly: true, origin: instance.origin, runId: settings.runId, controlPath: settings.controlPath }));
    } catch (error) { await instance.close(); throw error; }
    for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void instance.close().then(() => process.exit(0)); });
  }
}
