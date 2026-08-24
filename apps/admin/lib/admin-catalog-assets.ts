import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AdminCatalogAssetName =
  | "editorial-catalog.json"
  | "interface-copy-catalog.json";

type AdminCatalogObject = {
  text(): Promise<string>;
};

export type AdminCatalogBucket = {
  get(key: string): Promise<AdminCatalogObject | null>;
};

export type AdminCatalogReadOptions = {
  bucket?: AdminCatalogBucket | null;
  localDirectory?: string;
};

function runtimeCatalogBucket(): AdminCatalogBucket | null {
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
 * private R2 binding; local Next.js and tests use the checked-in source files.
 */
export async function readAdminCatalogText(
  name: AdminCatalogAssetName,
  options: AdminCatalogReadOptions = {}
): Promise<string> {
  const bucket =
    options.bucket === undefined ? runtimeCatalogBucket() : options.bucket;
  if (bucket) {
    const object = await bucket.get(name);
    if (!object) {
      throw new Error(`Admin catalog object is unavailable: ${name}`);
    }
    return object.text();
  }
  return readLocalCatalog(name, options.localDirectory);
}
