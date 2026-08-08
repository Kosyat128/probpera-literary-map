import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

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

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `Admin server stopped by signal ${signal}.`
            : `Admin server exited with code ${code ?? "unknown"}.`,
        ),
      );
    });
  });
}

try {
  const serverEntrypoint = selectServerEntrypoint();
  const nodePath = `${standaloneModules}${path.delimiter}${process.env.NODE_PATH || ""}`.replace(
    new RegExp(`^${path.delimiter}|${path.delimiter}$`, "gu"),
    "",
  );

  if (serverEntrypoint && hasRequiredModules()) {
    await run(process.execPath, [serverEntrypoint], {
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
  await run(process.execPath, [nextStartBinary, "start"]);
}
