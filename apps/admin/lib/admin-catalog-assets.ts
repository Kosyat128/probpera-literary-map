import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AdminCatalogAssetName =
  | "editorial-catalog.json"
  | "interface-copy-catalog.json";

export type AdminCatalogNamespace = {
  get(key: string, type: "text"): Promise<string | null>;
};

export type AdminCatalogReadOptions = {
  namespace?: AdminCatalogNamespace | null;
  localDirectory?: string;
};

function runtimeCatalogNamespace(): AdminCatalogNamespace | null {
  try {
    return getCloudflareContext().env.ADMIN_CATALOGS ?? null;
  } catch {
    return null;
  }
}

async function readLocalCatalog(
  name: AdminCatalogAssetName,
  explicitDirectory?: string
): Promise<string> {
  const [{ readFile }, { join }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  const directories = explicitDirectory
    ? [explicitDirectory]
    : [
        join(process.cwd(), "catalog-assets"),
        join(process.cwd(), "apps", "admin", "catalog-assets"),
      ];

  for (const directory of directories) {
    try {
      return await readFile(join(directory, name), "utf8");
    } catch {
      // Try the next deterministic workspace/standalone location.
    }
  }
  throw new Error(`Admin catalog asset is unavailable: ${name}`);
}

/**
 * Catalogs are bounded, generated JSON files. Production reads them through a
 * private Workers KV binding; local Next.js and tests use checked-in sources.
 */
export async function readAdminCatalogText(
  name: AdminCatalogAssetName,
  options: AdminCatalogReadOptions = {}
): Promise<string> {
  const namespace =
    options.namespace === undefined
      ? runtimeCatalogNamespace()
      : options.namespace;
  if (namespace) {
    const value = await namespace.get(name, "text");
    if (value === null) {
      throw new Error(`Admin catalog key is unavailable: ${name}`);
    }
    return value;
  }
  return readLocalCatalog(name, options.localDirectory);
}
