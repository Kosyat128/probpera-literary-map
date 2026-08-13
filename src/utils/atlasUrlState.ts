export const ATLAS_URL_FILTERS = [
  "all",
  "nobel",
  "rich",
  "portrait",
  "verified",
] as const;

export type AtlasUrlFilter = (typeof ATLAS_URL_FILTERS)[number];

export type AtlasUrlState = {
  filter: AtlasUrlFilter;
  countryId: string | null;
  writerId: string | null;
};

function isAtlasUrlFilter(value: string | null): value is AtlasUrlFilter {
  return ATLAS_URL_FILTERS.some((filter) => filter === value);
}

function safeArchiveId(value: string | null) {
  const normalized = value?.trim() || "";
  return normalized && normalized.length <= 160 ? normalized : null;
}

export function readAtlasUrlState(
  input = typeof window === "undefined" ? "https://probpera.ru/" : window.location.href
): AtlasUrlState {
  const url = new URL(input, "https://probpera.ru/");
  const filterValue = url.searchParams.get("atlas");
  const countryId = safeArchiveId(url.searchParams.get("country"));

  return {
    filter: isAtlasUrlFilter(filterValue) ? filterValue : "all",
    countryId,
    writerId: countryId ? safeArchiveId(url.searchParams.get("writer")) : null,
  };
}

export function withAtlasUrlState(input: string | URL, state: AtlasUrlState) {
  const url = new URL(input, "https://probpera.ru/");

  if (state.filter === "all") url.searchParams.delete("atlas");
  else url.searchParams.set("atlas", state.filter);

  if (state.countryId) {
    url.searchParams.set("country", state.countryId);
    if (state.writerId) url.searchParams.set("writer", state.writerId);
    else url.searchParams.delete("writer");
  } else {
    url.searchParams.delete("country");
    url.searchParams.delete("writer");
  }

  return url;
}

export function commitAtlasUrlState(
  state: AtlasUrlState,
  mode: "push" | "replace" = "push"
) {
  if (typeof window === "undefined") return false;
  const current = new URL(window.location.href);
  const next = withAtlasUrlState(current, state);
  const currentRelative = `${current.pathname}${current.search}${current.hash}`;
  const nextRelative = `${next.pathname}${next.search}${next.hash}`;
  if (currentRelative === nextRelative) return false;

  window.history[mode === "replace" ? "replaceState" : "pushState"](
    window.history.state,
    "",
    nextRelative
  );
  return true;
}
