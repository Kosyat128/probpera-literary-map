import type { NewsFeed, NewsItem } from "./types";

export type NewsUpdatesState = {
  feed: NewsFeed | null;
  latestFeed: NewsFeed | null;
  pendingItems: NewsItem[];
};

export function initialNewsUpdatesState(): NewsUpdatesState {
  return { feed: null, latestFeed: null, pendingItems: [] };
}

/** Hold new cards for the reader; corrections and withdrawals take effect immediately. */
export function receiveNewsFeed(state: NewsUpdatesState, nextFeed: NewsFeed): NewsUpdatesState {
  if (state.feed === null) {
    return { feed: nextFeed, latestFeed: nextFeed, pendingItems: [] };
  }

  const latestItems = new Map(nextFeed.items.map((item) => [item.id, item]));
  const visibleIds = new Set(state.feed.items.map((item) => item.id));
  const visibleItems = state.feed.items.flatMap((item) => {
    const latest = latestItems.get(item.id);
    return latest ? [latest] : [];
  });

  return {
    feed: { ...nextFeed, items: visibleItems },
    latestFeed: nextFeed,
    pendingItems: nextFeed.items.filter((item) => !visibleIds.has(item.id)),
  };
}

export function applyPendingNews(state: NewsUpdatesState): NewsUpdatesState {
  if (state.latestFeed === null) return state;
  return { feed: state.latestFeed, latestFeed: state.latestFeed, pendingItems: [] };
}
