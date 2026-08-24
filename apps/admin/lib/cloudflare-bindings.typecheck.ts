type CatalogObjectContract = {
  text(): Promise<string>;
};

type CatalogBucketContract = {
  get(key: string): Promise<CatalogObjectContract | null>;
};

type Assert<T extends true> = T;
type R2BindingMatchesCatalogLoader = Assert<
  AdminCloudflareBindings["ADMIN_CATALOGS"] extends CatalogBucketContract
    ? true
    : false
>;

const r2BindingMatchesCatalogLoader: R2BindingMatchesCatalogLoader = true;
void r2BindingMatchesCatalogLoader;
