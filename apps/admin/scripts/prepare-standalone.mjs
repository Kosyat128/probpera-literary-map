import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const standaloneRoot = path.join(appRoot, ".next", "standalone");
const standaloneApp = path.join(
  appRoot,
  ".next",
  "standalone",
  "apps",
  "admin"
);

await mkdir(path.join(standaloneApp, ".next"), { recursive: true });
await cp(
  path.join(appRoot, ".next", "static"),
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
  "react",
  "react-dom",
  "@supabase/supabase-js",
  "@supabase/ssr",
];

function hasModule(moduleName) {
  return existsSync(path.join(standaloneModules, ...moduleName.split("/")));
}

function hasRequiredModules() {
  return requiredStandaloneModules.every((moduleName) => hasModule(moduleName));
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
  await copyModules(workspaceNodeModules, "workspace node_modules");
}

if (!hasRequiredModules()) {
  console.warn(
    "[admin] Critical standalone dependencies are still missing after copy fallback:",
    requiredStandaloneModules
      .filter((moduleName) => !hasModule(moduleName))
      .join(", "),
  );
}
