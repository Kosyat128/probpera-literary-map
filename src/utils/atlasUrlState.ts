export const ATLAS_URL_FILTERS = [
  "all",
  "nobel",
  "rich",
  "portrait",
  "verified",
] as const;

export type AtlasUrlFilter = (typeof ATLAS_URL_FILTERS)[number];

export type AtlasUrlView = "embedded" | "immersive";

export type AtlasImmersionEntrySource = "embedded" | "hero" | "url";

export const ATLAS_IMMERSIVE_HISTORY_KEY =
  "probperaAtlasImmersiveUiEntry" as const;

export type AtlasUrlState = {
  filter: AtlasUrlFilter;
  countryId: string | null;
  writerId: string | null;
  view: AtlasUrlView;
};

export type AtlasImmersiveHistoryMarker = {
  source: AtlasImmersionEntrySource;
  version: 1;
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
    view:
      url.searchParams.get("atlasView") === "immersive"
        ? "immersive"
        : "embedded",
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

  if (state.view === "immersive") {
    url.searchParams.set("atlasView", "immersive");
  } else {
    url.searchParams.delete("atlasView");
  }

  return url;
}

export function withAtlasImmersiveHistoryMarker(
  historyState: unknown,
  source: AtlasImmersionEntrySource
): Record<string, unknown> & {
  [ATLAS_IMMERSIVE_HISTORY_KEY]: AtlasImmersiveHistoryMarker;
} {
  const current =
    historyState && typeof historyState === "object"
      ? (historyState as Record<string, unknown>)
      : {};

  return {
    ...current,
    [ATLAS_IMMERSIVE_HISTORY_KEY]: {
      source,
      version: 1,
    } satisfies AtlasImmersiveHistoryMarker,
  };
}

export function withoutAtlasImmersiveHistoryMarker(
  historyState: unknown
): Record<string, unknown> {
  const current =
    historyState && typeof historyState === "object"
      ? (historyState as Record<string, unknown>)
      : {};
  const { [ATLAS_IMMERSIVE_HISTORY_KEY]: _marker, ...rest } = current;
  return rest;
}

export function readAtlasImmersiveHistoryMarker(
  historyState: unknown
): AtlasImmersiveHistoryMarker | null {
  if (!historyState || typeof historyState !== "object") return null;
  const marker = (historyState as Record<string, unknown>)[
    ATLAS_IMMERSIVE_HISTORY_KEY
  ];
  if (!marker || typeof marker !== "object") return null;
  const { source, version } = marker as Partial<AtlasImmersiveHistoryMarker>;
  if (
    version !== 1 ||
    !source ||
    !["embedded", "hero", "url"].includes(source)
  ) {
    return null;
  }
  return { source, version };
}

export function commitAtlasUrlState(
  state: AtlasUrlState,
  mode: "push" | "replace" = "push",
  historyState: unknown = typeof window === "undefined"
    ? null
    : window.history.state
) {
  if (typeof window === "undefined") return false;
  const current = new URL(window.location.href);
  const next = withAtlasUrlState(current, state);
  const currentRelative = `${current.pathname}${current.search}${current.hash}`;
  const nextRelative = `${next.pathname}${next.search}${next.hash}`;
  if (currentRelative === nextRelative) return false;

  window.history[mode === "replace" ? "replaceState" : "pushState"](
    historyState,
    "",
    nextRelative
  );
  return true;
}
