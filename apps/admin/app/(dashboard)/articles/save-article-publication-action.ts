"use server";

import { prepareArticlePublicationIntent } from "../../../lib/article-publication-intent";

import { saveArticleAction as saveCanonicalArticleAction } from "./save-article-action";

/** Adapt the editor intent without changing the guarded atomic save pipeline. */
export async function saveArticleAction(formData: FormData) {
  prepareArticlePublicationIntent(formData);
  return saveCanonicalArticleAction(formData);
}
