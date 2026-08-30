// KVNamespace exposes overloaded get signatures. Checking the actual text call
// keeps the loader contract pinned without relying on brittle structural
// assignability between an overload set and a one-signature mock interface.
function assertCatalogTextBinding(
  namespace: AdminCloudflareBindings["ADMIN_CATALOGS"]
) {
  const result: Promise<string | null> = namespace.get(
    "editorial-catalog.json",
    "text"
  );
  void result;
}

void assertCatalogTextBinding;
