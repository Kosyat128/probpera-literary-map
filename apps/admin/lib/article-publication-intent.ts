/** Keep the explicit Russian release independent of an unfinished translation. */
export function prepareArticlePublicationIntent(formData: FormData) {
  if (formData.get("intent") !== "publish-ru") return;

  formData.set("intent", "publish");
  formData.delete("english_enabled");
  formData.set("skip_automatic_translation", "1");
  formData.set(
    "publication_ready",
    formData.get("russian_publication_ready") === "yes" ? "yes" : "no"
  );
}
