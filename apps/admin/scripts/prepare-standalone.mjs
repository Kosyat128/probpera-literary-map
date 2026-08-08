import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const standaloneRoot = path.join(appRoot, ".next", "standalone");
const buildIdPath = path.join(appRoot, ".next", "BUILD_ID");
const staticRoot = path.join(appRoot, ".next", "static");
const standaloneApp = path.join(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "admin"
);

if (
  !existsSync(buildIdPath) ||
  !existsSync(staticRoot) ||
  !existsSync(standaloneRoot)
) {
  throw new Error(
    "Admin build is incomplete. Stop the running admin process and run `npm run build --workspace @probpera/admin` before starting it.",
  );
}

await mkdir(path.join(standaloneApp, ".next"), { recursive: true });
await cp(
  staticRoot,
  path.join(standaloneApp, ".next", "static"),
  { recursive: true, force: true }
);

// Standalone output on some environments does not copy traced external modules
// for workspace-dependencies consistently. Copying the traced node_modules fallback
// ensures modules like @supabase/supabase-js are available at runtime.
const tracedModules = path.join(appRoot, ".next", "node_modules");
const workspaceNodeModules = path.join(appRoot, "..", "..", "node_modules");
const standaloneModules = path.join(standaloneRoot, "node_modules");
const requiredStandaloneModules = [
  "next",
  "react",
  "react-dom",
  "@supabase/supabase-js",
  "@supabase/ssr",
];

const requiredRuntimeFiles = [
  "next/dist/server/require-hook.js",
  "react/package.json",
  "react-dom/package.json",
  "@supabase/supabase-js/package.json",
  "@supabase/ssr/package.json",
];

function hasModule(moduleName) {
  return existsSync(path.join(standaloneModules, ...moduleName.split("/")));
}

function hasRequiredModules() {
  return (
    requiredStandaloneModules.every((moduleName) => hasModule(moduleName)) &&
    requiredRuntimeFiles.every((filePath) =>
      existsSync(path.join(standaloneModules, ...filePath.split("/")))
    )
  );
}

async function copyModules(source, label) {
  try {
    console.info("[admin] Copying", label, "→", standaloneModules);
    await cp(source, standaloneModules, {
      recursive: true,
      force: true,
    });
    return true;
  } catch (error) {
    console.warn(
      "[admin] Failed to copy dependencies from",
      source,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

if (existsSync(tracedModules)) {
  await copyModules(tracedModules, "traced node_modules");
}

if (!hasRequiredModules() && existsSync(workspaceNodeModules)) {
  for (const moduleName of requiredStandaloneModules) {
    const source = path.join(workspaceNodeModules, ...moduleName.split("/"));
    const destination = path.join(standaloneModules, ...moduleName.split("/"));

    if (!existsSync(source)) {
      continue;
    }

    try {
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(source, destination, { recursive: true, force: true });
    } catch (error) {
      console.warn(
        "[admin] Failed to copy runtime module",
        moduleName,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

if (!hasRequiredModules()) {
  const missingModules = requiredStandaloneModules.filter(
    (moduleName) => !hasModule(moduleName)
  );
  const missingRuntimeFiles = requiredRuntimeFiles.filter(
    (filePath) =>
      !existsSync(path.join(standaloneModules, ...filePath.split("/")))
  );
  console.warn(
    "[admin] Critical standalone dependencies are still missing after copy fallback:",
    [...missingModules, ...missingRuntimeFiles].join(", ")
  );
}
