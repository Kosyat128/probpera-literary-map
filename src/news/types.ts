export const NEWS_CATEGORIES = [
  "releases", "awards", "adaptations", "anniversaries", "festivals",
  "heritage", "discoveries", "obituaries", "publishing",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
export const NEWS_REGIONS = ["global", "europe", "north-america", "latin-america", "asia", "africa", "oceania"] as const;
export type NewsRegion = (typeof NEWS_REGIONS)[number];
export type NewsText = { ru: string; en: string };
export type NewsItem = {
  id: string;
  category: NewsCategory;
  region?: NewsRegion;
  eventKey?: string;
  kind: "news" | "announcement" | "calendar";
  eventDate: string;
  publishedAt: string | null;
  verifiedAt: string;
  title: NewsText;
  summary: NewsText;
  source: { name: string; url: string; language: string };
  verification: "confirmed";
};

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  status: "pending" | "ok" | "error";
  lastSuccessAt: string | null;
  error?: string;
  candidateCount: number;
  language?: string;
  region?: NewsRegion;
  topics?: NewsCategory[];
};

export type NewsFeed = {
  mode: "local-prototype";
  generatedAt: string;
  lastCheckedAt: string | null;
  refreshIntervalSeconds: number;
  timeZone: string;
  sources: NewsSource[];
  pendingCount: number;
  items: NewsItem[];
};
