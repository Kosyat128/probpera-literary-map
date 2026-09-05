import type { BookDossierDocumentV2, BookDossierReadingMode, BookDossierSpoiler } from "./bookDossierDocument";
import { parseBookDossierPublicRequest, parsePublishedBookDossier } from "./bookDossierDelivery";
import { supabaseConnection } from "../lib/supabaseConfig";

export async function fetchPublishedBookDossier(options: {
  bookKey: string; locale: "ru" | "en"; mode?: BookDossierReadingMode;
  revealSpoilers?: BookDossierSpoiler; reachedItemIds?: readonly string[]; signal?: AbortSignal;
}): Promise<BookDossierDocumentV2 | null> {
  const request = parseBookDossierPublicRequest({ bookKey: options.bookKey, locale: options.locale,
    mode: options.mode, revealSpoilers: options.revealSpoilers, reachedItemIds: options.reachedItemIds });
  if (!request) return null;
  const configured = supabaseConnection.url;
  if (!configured || !supabaseConnection.publishableKey) return null;
  let endpoint: URL;
  try {
    endpoint = new URL(`${configured.replace(/\/+$/u, "")}/rest/v1/rpc/get_published_book_dossier`);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password) return null;
  } catch { return null; }
  try {
    const response = await fetch(endpoint, { method: "POST", credentials: "omit", cache: "no-store", signal: options.signal,
      headers: { "Content-Type": "application/json", apikey: supabaseConnection.publishableKey }, body: JSON.stringify({ p_request: request }) });
    if (!response.ok || Number(response.headers.get("content-length") || 0) > 256_000) return null;
    const body = await response.text();
    if (body.length > 256_000) return null;
    const document = parsePublishedBookDossier(JSON.parse(body));
    return document && document.bookKey === options.bookKey && document.locale === options.locale && document.readingMode === request.mode ? document : null;
  } catch { return null; }
}
