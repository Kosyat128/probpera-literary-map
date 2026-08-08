export type BookArticleMentionKind = "review" | "feature" | "mention";

export type BookArticleMention = {
  id: string;
  title: string;
  sectionId: string;
  sectionLabel: string;
  readingMinutes: number;
  slug?: string;
  imageUrl?: string;
  kind: BookArticleMentionKind;
};

export type ArticleBookMentionLocalization = {
  title: string;
  writerName: string;
};

export type ArticleBookMention = {
  key: string;
  countryId: string;
  writerId: string;
  bookId: string;
  firstPublished?: number;
  coverUrl?: string;
  kind: BookArticleMentionKind;
  localizations: {
    ru: ArticleBookMentionLocalization;
    en: ArticleBookMentionLocalization;
  };
};

export type BookMentionIndex = {
  version: number;
  byBook: Record<string, BookArticleMention[]>;
  byArticle: Record<string, ArticleBookMention[]>;
};

let mentionIndexPromise: Promise<BookMentionIndex> | null = null;

function mentionIndexUrl() {
  return `${import.meta.env.BASE_URL}articles/book-mentions.json`;
}

export function loadBookMentionIndex() {
  if (!mentionIndexPromise) {
    mentionIndexPromise = fetch(mentionIndexUrl()).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Book mention index: ${response.status}`);
      }
      return (await response.json()) as BookMentionIndex;
    });
  }
  return mentionIndexPromise;
}

export async function getBookArticleMentions(bookKey: string) {
  const index = await loadBookMentionIndex();
  return index.byBook[bookKey] || [];
}

export async function getArticleBookMentions(articleId: string) {
  const index = await loadBookMentionIndex();
  return index.byArticle?.[articleId] || [];
}

export async function getBookMentionIndex() {
  return loadBookMentionIndex();
}
