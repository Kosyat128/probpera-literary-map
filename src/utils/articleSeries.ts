export type ArticleSeriesSource = {
  url?: string;
  legacyPath?: string | null;
  sectionLabel?: string;
  source?: "legacy" | "cms";
};

const seriesLabels: Record<string, string> = {
  "nobel-prize": "Лауреаты Нобелевской премии",
  famous_prizes: "Истории литературных премий",
  "page-books": "Мнение о книге",
  folklore: "Мировой фольклор и мифология",
  "page-bookvsmovie": "Книга и экранизация",
  topstories: "Истории из мира литературы",
  "page-writers-world": "Литературная карта мира",
  topbooks: "Лучшие книги и подборки",
  "unrecognized-writers": "Непризнанные современниками",
  "top-books-page-turners": "Книги, от которых не оторваться",
  first_profession_writers: "Профессии писателей",
  "luchshie-ekranizacii-bestsellerov-21-veka":
    "Экранизации бестселлеров XXI века",
  "sucsessful-cinema-adaptation": "Удачные экранизации классики",
  "different-staff": "Литературные факты и явления",
  "krilatie-virageniya": "Крылатые выражения",
  "luchshie-bestselleri-21-veka": "Бестселлеры XXI века",
  "knigniy-gid": "Книжный гид",
  "luchshie-knigi-pisateley": "Лучшие книги писателей",
  cms: "Новые материалы редакции",
  standalone: "Отдельные редакционные материалы",
};

export function articleSeriesId(article: ArticleSeriesSource) {
  if (article.source === "cms") return "cms";
  const source = article.legacyPath || article.url || "";
  try {
    const pathname = new URL(source, "https://probpera.ru").pathname;
    const match = pathname.match(/\/read\/page-article\/([^/]+)/iu);
    return match?.[1] || "standalone";
  } catch {
    return "standalone";
  }
}

export function articleSeriesLabel(
  seriesId: string,
  fallback = "Редакционные материалы"
) {
  return seriesLabels[seriesId] || fallback;
}
