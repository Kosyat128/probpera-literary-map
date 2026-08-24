import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const sourcePath = path.join(process.cwd(), "cloudflare-env.generated.d.ts");
const declarationPath = path.join(process.cwd(), "cloudflare-env.d.ts");
const checkOnly = process.argv.includes("--check");

try {
  const source = (await readFile(sourcePath, "utf8")).replace(/\r\n/gu, "\n");
  const normalized = source.replace(
    /\n\s*interface GlobalProps \{\n\s*mainModule: typeof import\([^\n]+\);\n\s*\}\n/u,
    "\n"
  );

  if (/\.open-next\/worker/u.test(normalized)) {
    throw new Error(
      "Cloudflare type generation retained a build-artifact import"
    );
  }

  if (checkOnly) {
    const current = (await readFile(declarationPath, "utf8")).replace(
      /\r\n/gu,
      "\n"
    );
    if (current !== normalized) {
      throw new Error(
        "cloudflare-env.d.ts is stale; run npm run cf:typegen --workspace @probpera/admin"
      );
    }
    console.log("Verified current Cloudflare binding declarations.");
  } else {
    await writeFile(declarationPath, normalized, "utf8");
    console.log("Updated deterministic Cloudflare binding declarations.");
  }
} finally {
  await rm(sourcePath, { force: true });
}
