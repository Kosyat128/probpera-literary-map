export type OfflineData = {
  supported: boolean;
  cachedResources: number;
  cacheNames: string[];
};

export async function readOfflineData(): Promise<OfflineData> {
  if (typeof window === "undefined" || !("caches" in window)) {
    return { supported: false, cachedResources: 0, cacheNames: [] };
  }

  const cacheNames = await window.caches.keys();
  const resourceLists = await Promise.all(
    cacheNames
      .filter((name) => name.startsWith("probpera-"))
      .map(async (name) => (await window.caches.open(name)).keys())
  );
  return {
    supported: "serviceWorker" in navigator,
    cachedResources: resourceLists.reduce(
      (total, resources) => total + resources.length,
      0
    ),
    cacheNames,
  };
}
