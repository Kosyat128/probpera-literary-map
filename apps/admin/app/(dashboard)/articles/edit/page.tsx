import { notFound } from "next/navigation";

import EditArticlePage, { metadata } from "../[id]/page";

export { metadata };

export default async function EditArticleByQueryPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string;
    error?: string;
    saved?: string;
  }>;
}) {
  const { id, error, saved } = await searchParams;
  const articleId = id?.trim();

  if (!articleId) notFound();

  return EditArticlePage({
    params: Promise.resolve({ id: articleId }),
    searchParams: Promise.resolve({ error, saved }),
  });
}
