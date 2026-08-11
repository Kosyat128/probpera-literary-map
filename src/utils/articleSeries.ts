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
  "page-writers-world": "Литературная планета",
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

const englishSeriesLabels: Record<string, string> = {
  "nobel-prize": "Nobel Prize laureates",
  famous_prizes: "Stories of literary prizes",
  "page-books": "Book opinion",
  folklore: "World folklore and mythology",
  "page-bookvsmovie": "Book and screen adaptation",
  topstories: "Stories from the literary world",
  "page-writers-world": "Literary Planet",
  topbooks: "Best books and reading lists",
  "unrecognized-writers": "Unrecognized in their lifetime",
  "top-books-page-turners": "Page-turners",
  first_profession_writers: "Writers' professions",
  "luchshie-ekranizacii-bestsellerov-21-veka":
    "21st-century bestseller adaptations",
  "sucsessful-cinema-adaptation": "Successful adaptations of classics",
  "different-staff": "Literary facts and phenomena",
  "krilatie-virageniya": "Famous expressions",
  "luchshie-bestselleri-21-veka": "21st-century bestsellers",
  "knigniy-gid": "Book guide",
  "luchshie-knigi-pisateley": "Best books by authors",
  cms: "New editorial publications",
  standalone: "Standalone editorial publications",
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
  fallback = "Редакционные материалы",
  locale: "ru" | "en" = "ru"
) {
  return (locale === "en" ? englishSeriesLabels : seriesLabels)[seriesId] || fallback;
}
