/** A cover overlay may not add/remove identities or change publication status.
 * Both sides use the same current CMS snapshot; its public count is not frozen.
 */
export function assertCoverOverlayPublicationInvariant(baseline, current, isPublicBook) {
  if (!Array.isArray(baseline) || !Array.isArray(current) || typeof isPublicBook !== "function")
    throw new Error("cover_overlay_archive_invalid");
  const collect = (books) => {
    const identities = new Set(), publicIdentities = new Set();
    for (const book of books) {
      const parts = [book?.countryId, book?.writerId, book?.id];
      if (parts.some(value => typeof value !== "string" || !value.trim()))
        throw new Error("cover_overlay_identity_missing");
      const identity = JSON.stringify(parts);
      if (identities.has(identity)) throw new Error("cover_overlay_identity_duplicate");
      identities.add(identity);
      if (isPublicBook(book)) publicIdentities.add(identity);
    }
    return { identities, publicIdentities };
  };
  const before = collect(baseline), after = collect(current);
  const same = (left, right) => left.size === right.size && [...left].every(key => right.has(key));
  if (!same(before.identities, after.identities)) throw new Error("cover_overlay_archive_identity_changed");
  if (!same(before.publicIdentities, after.publicIdentities)) throw new Error("cover_overlay_publication_changed");
}
