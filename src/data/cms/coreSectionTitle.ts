export function coreSectionTitle(key: string, value: unknown): string {
  const title = typeof value === "string" ? value.trim() : "";
  if (key === "book-archive" && (!title || title === "Книжный архив")) {
    return "Библиотека «Проба Пера»";
  }
  return title;
}
