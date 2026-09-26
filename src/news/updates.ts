import type { NewsFeed, NewsItem } from "./types";

export type NewsUpdatesState = {
  feed: NewsFeed | null;
  latestFeed: NewsFeed | null;
  pendingItems: NewsItem[];
  knownWithdrawals: NonNullable<NewsFeed["withdrawals"]>;
};

export function initialNewsUpdatesState(knownWithdrawals: NonNullable<NewsFeed["withdrawals"]> = []): NewsUpdatesState {
  return { feed: null, latestFeed: null, pendingItems: [], knownWithdrawals };
}

/** Hold new cards for the reader; corrections and withdrawals take effect immediately. */
export function receiveNewsFeed(state: NewsUpdatesState, nextFeed: NewsFeed): NewsUpdatesState {
  if (nextFeed.contractVersion === 2 && (!nextFeed.snapshot?.complete
    || nextFeed.snapshot.count !== nextFeed.items.length)) return state;
  if (state.latestFeed && Date.parse(nextFeed.generatedAt) < Date.parse(state.latestFeed.generatedAt)) return state;
  // Explicit semantic withdrawals survive a stale fallback and future projections.
  const withdrawals = new Map(state.knownWithdrawals.map((row) => [row.id, row]));
  for (const row of nextFeed.withdrawals || []) withdrawals.set(row.id, row);
  if (withdrawals.size) nextFeed = { ...nextFeed, withdrawals: [...withdrawals.values()],
    items: nextFeed.items.filter((item) => !withdrawals.has(item.id)) };
  if (state.feed === null) {
    return { feed: nextFeed, latestFeed: nextFeed, pendingItems: [], knownWithdrawals:[...withdrawals.values()] };
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
    knownWithdrawals:[...withdrawals.values()],
  };
}

export function applyPendingNews(state: NewsUpdatesState): NewsUpdatesState {
  if (state.latestFeed === null) return state;
  return { ...state, feed: state.latestFeed, latestFeed: state.latestFeed, pendingItems: [] };
}
