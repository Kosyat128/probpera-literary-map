import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);
const appRoot = process.cwd();
const nextBinary = path.join(appRoot, "..", "..", "node_modules", "next", "dist", "bin", "next");
const serverPathCandidates = [
  path.join(appRoot, ".next", "standalone", "apps", "admin", "server.js"),
  path.join(appRoot, ".next", "standalone", "server.js"),
  path.join(appRoot, ".next", "server.js"),
  path.join(appRoot, ".next", "standalone", "apps", "admin", ".next", "server.js"),
];
const standaloneModules = path.join(appRoot, ".next", "standalone", "node_modules");
const requiredStandaloneModules = [
  "react",
  "react-dom",
  "@supabase/supabase-js",
  "@supabase/ssr",
];

function hasRequiredModules() {
  return requiredStandaloneModules.every((moduleName) =>
    existsSync(path.join(standaloneModules, ...moduleName.split("/"))),
  );
}

function selectServerEntrypoint() {
  return serverPathCandidates.find((candidate) => existsSync(candidate));
}

function getFallbackNextBinary() {
  const fallbackCandidates = [
    nextBinary,
    path.join(appRoot, "node_modules", "next", "dist", "bin", "next"),
    path.join(appRoot, "..", "node_modules", "next", "dist", "bin", "next"),
  ];
  return fallbackCandidates.find((candidate) => existsSync(candidate)) ?? nextBinary;
}

try {
  const serverEntrypoint = selectServerEntrypoint();
  const nodePath = `${standaloneModules}${path.delimiter}${process.env.NODE_PATH || ""}`.replace(
    new RegExp(`^${path.delimiter}|${path.delimiter}$`, "gu"),
    "",
  );

  if (serverEntrypoint && hasRequiredModules()) {
    await execFileAsync(process.execPath, [serverEntrypoint], {
      stdio: "inherit",
      env: { ...process.env, NODE_PATH: nodePath },
    });
  } else {
    const reason = serverEntrypoint
      ? "Standalone server is missing required dependencies."
      : "Standalone server entry is not built yet.";
    throw new Error(reason);
  }
} catch (error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[admin] Standalone start unavailable, fallback to next start:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const nextStartBinary = getFallbackNextBinary();
  await execFileAsync(process.execPath, [nextStartBinary, "start"], { stdio: "inherit" });
}
