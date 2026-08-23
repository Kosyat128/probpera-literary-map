from pathlib import Path
import textwrap

root = Path(".")


def replace_once(path: str, old: str, new: str) -> None:
    target = root / path
    source = target.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one target, found {count}")
    target.write_text(source.replace(old, new, 1), encoding="utf-8")


def write(path: str, content: str) -> None:
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip(), encoding="utf-8")


generator = root / "scripts/export-interface-copy-catalog.mjs"
source = generator.read_text(encoding="utf-8")
source = source.replace(
    '''const outputPath = path.join(
  projectRoot,
  "apps",
  "admin",
  "lib",
  "interface-copy-catalog.generated.json"
);''',
    '''const outputDirectory = path.join(
  projectRoot,
  "apps",
  "admin",
  "public",
  "interface-copy-catalog"
);
const outputPath = path.join(outputDirectory, "catalog.json");''',
    1,
)
source = source.replace(
    '''} else {
  await fs.writeFile(outputPath, generated, "utf8");
  console.log(`Exported ${entries.length} site-copy fields for the admin.`);
}''',
    '''} else {
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.writeFile(outputPath, generated, "utf8");
  console.log(`Exported ${entries.length} site-copy fields for the admin.`);
}''',
    1,
)
if "interface-copy-catalog.generated.json" in source:
    raise SystemExit("interface catalog generator still targets the Worker bundle")
generator.write_text(source, encoding="utf-8")

catalog = root / "apps/admin/lib/site-copy-catalog.ts"
source = catalog.read_text(encoding="utf-8")
source = source.replace(
    'import interfaceCopyCatalog from "./interface-copy-catalog.generated.json";\n',
    'import { getCloudflareContext } from "@opennextjs/cloudflare";\n\nimport { adminEnv } from "./env";\n',
    1,
)
marker = "const curatedSourceTexts = new Set<string>("
position = source.find(marker)
if position < 0:
    raise SystemExit("site-copy-catalog.ts: generated catalog block not found")
source = source[:position] + textwrap.dedent(r'''
    type FetchImplementation = typeof fetch;
    type StaticAssetsBinding = {
      fetch(request: Request): Promise<Response>;
    };

    const interfaceCatalogPath = "/interface-copy-catalog/catalog.json";
    let catalogPromise: Promise<readonly SiteCopyDefinition[]> | null = null;

    function objectValue(value: unknown): Record<string, unknown> {
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    }

    function text(value: unknown) {
      return typeof value === "string" ? value.trim() : "";
    }

    function parseDefinition(value: unknown): SiteCopyDefinition | null {
      const row = objectValue(value);
      const key = text(row.key);
      const group = text(row.group);
      const label = text(row.label);
      const defaultRu = text(row.defaultRu);
      const defaultEn =
        typeof row.defaultEn === "string" ? row.defaultEn : undefined;
      if (
        !key ||
        !group ||
        !label ||
        !defaultRu ||
        key.length > 1_200 ||
        !/^(?:interface|country|globe)\./u.test(key)
      ) {
        return null;
      }
      return {
        key,
        group,
        label,
        defaultRu,
        ...(defaultEn !== undefined ? { defaultEn } : {}),
        ...(row.multiline === true ? { multiline: true } : {}),
      };
    }

    function parseGeneratedCatalog(value: unknown) {
      if (!Array.isArray(value)) {
        throw new Error("Interface copy catalog has an invalid shape");
      }
      const parsed = value.flatMap((item) => {
        const definition = parseDefinition(item);
        return definition ? [definition] : [];
      });
      if (parsed.length !== value.length || parsed.length < 100) {
        throw new Error("Interface copy catalog failed validation");
      }
      const keys = parsed.map((item) => item.key);
      if (new Set(keys).size !== keys.length) {
        throw new Error("Interface copy catalog contains duplicate keys");
      }
      return parsed;
    }

    async function cloudflareAsset(pathname: string) {
      try {
        const context = getCloudflareContext();
        const assets = (context.env as { ASSETS?: StaticAssetsBinding }).ASSETS;
        if (!assets) return null;
        return await assets.fetch(new Request(`https://assets.local${pathname}`));
      } catch {
        return null;
      }
    }

    async function fetchGeneratedCatalog(options: {
      fetchImpl?: FetchImplementation;
      url?: string;
    } = {}) {
      let response =
        options.fetchImpl || options.url
          ? null
          : await cloudflareAsset(interfaceCatalogPath);
      if (!response || !response.ok) {
        const base = `${adminEnv.adminSiteUrl.replace(/\/+$/u, "")}/`;
        const url =
          options.url ||
          new URL(interfaceCatalogPath.replace(/^\/+/, ""), base).href;
        response = await (options.fetchImpl || fetch)(url, {
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
      }
      if (!response.ok) {
        throw new Error(`Interface copy catalog asset failed (${response.status})`);
      }
      return parseGeneratedCatalog(await response.json());
    }

    export async function loadAllSiteCopyCatalog(options: {
      fetchImpl?: FetchImplementation;
      url?: string;
    } = {}): Promise<readonly SiteCopyDefinition[]> {
      if (options.fetchImpl || options.url) {
        const generated = await fetchGeneratedCatalog(options);
        const curatedSourceTexts = new Set(
          siteCopyCatalog.map((definition) => definition.defaultRu)
        );
        return [
          ...siteCopyCatalog,
          ...generated.filter(
            (definition) => !curatedSourceTexts.has(definition.defaultRu)
          ),
        ];
      }
      if (!catalogPromise) {
        catalogPromise = fetchGeneratedCatalog()
          .then((generated) => {
            const curatedSourceTexts = new Set(
              siteCopyCatalog.map((definition) => definition.defaultRu)
            );
            return [
              ...siteCopyCatalog,
              ...generated.filter(
                (definition) => !curatedSourceTexts.has(definition.defaultRu)
              ),
            ];
          })
          .catch((error) => {
            catalogPromise = null;
            throw error;
          });
      }
      return catalogPromise;
    }

    export async function loadAllSiteCopyKeys(options: {
      fetchImpl?: FetchImplementation;
      url?: string;
    } = {}) {
      return new Set(
        (await loadAllSiteCopyCatalog(options)).map(
          (definition) => definition.key
        )
      );
    }
''').lstrip()
catalog.write_text(source, encoding="utf-8")

legacy = root / "apps/admin/lib/interface-copy-catalog.generated.json"
if legacy.exists():
    legacy.unlink()

page = root / "apps/admin/app/(dashboard)/site-copy/page.tsx"
source = page.read_text(encoding="utf-8")
source = source.replace(
    '''import {
  allSiteCopyCatalog,
  type SiteCopyDefinition,
} from "@/lib/site-copy-catalog";''',
    '''import {
  loadAllSiteCopyCatalog,
  type SiteCopyDefinition,
} from "@/lib/site-copy-catalog";''',
    1,
)
source = source.replace(
    '''  const query = await searchParams;
  const supabase = await createServerSupabaseClient();''',
    '''  const [query, allSiteCopyCatalog] = await Promise.all([
    searchParams,
    loadAllSiteCopyCatalog(),
  ]);
  const supabase = await createServerSupabaseClient();''',
    1,
)
page.write_text(source, encoding="utf-8")

actions = root / "apps/admin/app/(dashboard)/site-copy/actions.ts"
source = actions.read_text(encoding="utf-8")
source = source.replace(
    'import { allSiteCopyKeys } from "@/lib/site-copy-catalog";',
    'import { loadAllSiteCopyKeys } from "@/lib/site-copy-catalog";',
    1,
)
source = source.replace(
    "function isAllowedCopyKey(key: string) {",
    "function isAllowedCopyKey(key: string, allowedKeys: ReadonlySet<string>) {",
    1,
)
source = source.replace("    allSiteCopyKeys.has(key) ||", "    allowedKeys.has(key) ||", 1)
source = source.replace(
    "function submittedRows(formData: FormData) {",
    "function submittedRows(\n  formData: FormData,\n  allowedKeys: ReadonlySet<string>\n) {",
    1,
)
source = source.replace(
    "    keys.length > allSiteCopyKeys.size + 100",
    "    keys.length > allowedKeys.size + 100",
    1,
)
source = source.replace(
    "    if (!isAllowedCopyKey(row.key)) {",
    "    if (!isAllowedCopyKey(row.key, allowedKeys)) {",
    1,
)
source = source.replace(
    "    rows = submittedRows(formData);",
    "    const allowedKeys = await loadAllSiteCopyKeys();\n    rows = submittedRows(formData, allowedKeys);",
    1,
)
actions.write_text(source, encoding="utf-8")

package = root / "apps/admin/package.json"
source = package.read_text(encoding="utf-8")
source = source.replace(
    '"build": "node ../../scripts/export-editorial-catalog.mjs && next build"',
    '"build": "node ../../scripts/export-editorial-catalog.mjs && node ../../scripts/export-interface-copy-catalog.mjs && next build --webpack"',
    1,
)
package.write_text(source, encoding="utf-8")

write(
    "apps/admin/lib/site-copy-catalog.test.ts",
    r'''
    import { describe, expect, it, vi } from "vitest";

    import {
      loadAllSiteCopyCatalog,
      loadAllSiteCopyKeys,
    } from "./site-copy-catalog";

    function definition(key: string, defaultRu: string) {
      return {
        key,
        group: "Весь интерфейс",
        label: defaultRu,
        defaultRu,
        defaultEn: `English ${defaultRu}`,
        multiline: false,
      };
    }

    describe("external interface-copy catalog asset", () => {
      it("loads, validates and merges generated definitions", async () => {
        const generated = Array.from({ length: 100 }, (_, index) =>
          definition(`interface.generated-${index}`, `Текст ${index}`)
        );
        const fetchImpl = vi.fn(async () =>
          new Response(JSON.stringify(generated), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        ) as unknown as typeof fetch;
        const catalog = await loadAllSiteCopyCatalog({
          fetchImpl,
          url: "https://assets.test/interface-copy-catalog/catalog.json",
        });
        expect(catalog.length).toBeGreaterThan(generated.length);
        expect(
          catalog.some((item) => item.key === "interface.generated-99")
        ).toBe(true);
        const keys = await loadAllSiteCopyKeys({
          fetchImpl,
          url: "https://assets.test/interface-copy-catalog/catalog.json",
        });
        expect(keys.has("interface.generated-0")).toBe(true);
      });

      it("rejects incomplete generated assets", async () => {
        const fetchImpl = vi.fn(async () =>
          new Response(JSON.stringify([definition("bad", "Текст")]), {
            status: 200,
          })
        ) as unknown as typeof fetch;
        await expect(loadAllSiteCopyCatalog({ fetchImpl })).rejects.toThrow(
          "failed validation"
        );
      });
    });
    ''',
)

for path in [
    "apps/admin/lib/site-copy-catalog.ts",
    "apps/admin/app/(dashboard)/site-copy/page.tsx",
    "apps/admin/app/(dashboard)/site-copy/actions.ts",
    "scripts/export-interface-copy-catalog.mjs",
]:
    content = (root / path).read_text(encoding="utf-8")
    if "interface-copy-catalog.generated.json" in content:
        raise SystemExit(f"{path}: monolithic interface catalog remains")
