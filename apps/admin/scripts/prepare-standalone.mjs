import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
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

