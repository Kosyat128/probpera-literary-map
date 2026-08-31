import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const expectedRuntime = Object.freeze({
  python: "3.12.13",
  numpy: "2.3.5",
  pillow: "12.3.0",
  webp: "1.6.0",
  littlecms2: "2.19",
});

function candidateInterpreters() {
  const candidates = [];
  if (process.env.PROBPERA_PYTHON) {
    candidates.push({ command: process.env.PROBPERA_PYTHON, prefix: [] });
  }
  if (process.platform === "win32") {
    const codexRuntime = process.env.USERPROFILE
      ? path.join(
          process.env.USERPROFILE,
          ".cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe"
        )
      : null;
    if (codexRuntime && existsSync(codexRuntime)) {
      candidates.push({ command: codexRuntime, prefix: [] });
    }
    candidates.push({ command: "py", prefix: ["-3.12"] });
  }
  candidates.push(
    { command: "python3", prefix: [] },
    { command: "python", prefix: [] }
  );
  return candidates.filter(
    (candidate, index, all) =>
      all.findIndex(
        ({ command, prefix }) =>
          command === candidate.command && prefix.join("|") === candidate.prefix.join("|")
      ) === index
  );
}

function inspectRuntime(candidate) {
  const probe = spawnSync(
    candidate.command,
    [
      ...candidate.prefix,
      "-c",
      "import json, platform, numpy; " +
        "from PIL import __version__ as pillow, features; " +
        "print(json.dumps({" +
        "'python': platform.python_version(), " +
        "'numpy': numpy.__version__, " +
        "'pillow': pillow, " +
        "'webp': features.version('webp'), " +
        "'littlecms2': features.version('littlecms2')" +
        "}))",
    ],
    { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }
  );
  if (probe.status !== 0) return null;
  try {
    return JSON.parse(probe.stdout.trim());
  } catch {
    return null;
  }
}

function matchesExpectedRuntime(actual) {
  return Object.entries(expectedRuntime).every(
    ([key, expected]) => actual?.[key] === expected
  );
}

let selected = null;
for (const candidate of candidateInterpreters()) {
  const runtime = inspectRuntime(candidate);
  if (matchesExpectedRuntime(runtime)) {
    selected = candidate;
    break;
  }
}

if (!selected) {
  throw new Error(
    "Historical globe rebuild requires Python 3.12.13, NumPy 2.3.5, " +
      "Pillow 12.3.0, libwebp 1.6.0 and LittleCMS 2.19. " +
      "Install scripts/globe-editions/historical-runtime-requirements.txt " +
      "into that runtime or set PROBPERA_PYTHON to its executable."
  );
}

const result = spawnSync(
  selected.command,
  [
    ...selected.prefix,
    path.join(repositoryRoot, "scripts/build-historical-globe-textures.py"),
    ...process.argv.slice(2),
  ],
  { cwd: repositoryRoot, stdio: "inherit", windowsHide: true }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
