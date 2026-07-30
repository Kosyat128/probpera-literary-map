export type BookArticleMentionKind = "review" | "feature" | "mention";

export type BookArticleMention = {
  id: string;
  title: string;
  sectionId: string;
  sectionLabel: string;
  readingMinutes: number;
  slug?: string;
  kind: BookArticleMentionKind;
};

type BookMentionIndex = {
  version: number;
  byBook: Record<string, BookArticleMention[]>;
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
