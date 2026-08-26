type CatalogNamespaceContract = {
  get(key: string, type: "text"): Promise<string | null>;
};

type Assert<T extends true> = T;
type KvBindingMatchesCatalogLoader = Assert<
  AdminCloudflareBindings["ADMIN_CATALOGS"] extends CatalogNamespaceContract
    ? true
    : false
>;

const kvBindingMatchesCatalogLoader: KvBindingMatchesCatalogLoader = true;
void kvBindingMatchesCatalogLoader;
