import type { BookDossierDocumentV2, BookDossierReadingMode, BookDossierSpoiler } from "./bookDossierDocument";
import { parseBookDossierPublicRequest, parsePublishedBookDossier } from "./bookDossierDelivery";
import { supabaseConnection } from "../lib/supabaseConfig";
import { isControlledWebEdition } from "../platform/distribution";

function publicationEndpoint(): URL | null {
  if (isControlledWebEdition || !supabaseConnection.url || !supabaseConnection.publishableKey) return null;
  try {
    const endpoint = new URL(supabaseConnection.url.replace(/\/+$/u, "") + "/rest/v1/rpc/get_published_book_dossier");
    return endpoint.protocol === "https:" && !endpoint.username && !endpoint.password ? endpoint : null;
  } catch { return null; }
}
/** Transport capability only. A document, its current lease and editorial
 * admission must still be checked separately; this never initiates a request. */
export function isPublishedBookDossierAvailable(): boolean { return publicationEndpoint() !== null; }

export async function fetchPublishedBookDossier(options: {
  bookKey: string; locale: "ru" | "en"; mode?: BookDossierReadingMode;
  revealSpoilers?: BookDossierSpoiler; reachedItemIds?: readonly string[]; signal?: AbortSignal;
}): Promise<BookDossierDocumentV2 | null> {
  if (isControlledWebEdition) return null;
  const request = parseBookDossierPublicRequest({ bookKey: options.bookKey, locale: options.locale,
    mode: options.mode, revealSpoilers: options.revealSpoilers, reachedItemIds: options.reachedItemIds });
  if (!request) return null;
  const endpoint = publicationEndpoint();
  const apikey = supabaseConnection.publishableKey;
  if (!endpoint || !apikey) return null;
  try {
    const response = await fetch(endpoint, { method: "POST", credentials: "omit", cache: "no-store", signal: options.signal,
      headers: { "Content-Type": "application/json", apikey }, body: JSON.stringify({ p_request: request }) });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 256_000) return null;
    const body = await response.text();
    if (body.length > 256_000) return null;
    const document = parsePublishedBookDossier(JSON.parse(body));
    return document && document.bookKey === options.bookKey && document.locale === options.locale && document.readingMode === request.mode ? document : null;
  } catch { return null; }
}
