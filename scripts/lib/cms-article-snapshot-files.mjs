const managedCmsArticleSnapshotPattern =
  /^cms-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.json$/iu;

export function isManagedCmsArticleSnapshotName(name) {
  return managedCmsArticleSnapshotPattern.test(String(name || ""));
}

export function staleManagedCmsArticleSnapshotNames(
  existingNames,
  expectedNames
) {
  const expected = new Set(expectedNames);
  return existingNames
    .filter(
      (name) =>
        isManagedCmsArticleSnapshotName(name) && !expected.has(name)
    )
    .sort((left, right) => left.localeCompare(right, "en"));
}
