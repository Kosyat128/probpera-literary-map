const categoryRouteSlugs: Record<string, string> = {
  "book-opinions": "mnenie-o-knige",
  "screen-adaptations": "kniga-i-ekranizatsiya",
  "writers-world": "pisateli-mira",
  "book-guides": "knizhnyy-gid",
  awards: "literaturnye-premii",
  folklore: "folklor-i-mifologiya",
  language: "russkiy-yazyk",
  "literary-essays": "o-literature",
  "author-stories": "literaturnye-istorii",
};

export function articleSectionSlug(categorySlug?: string | null) {
  return categoryRouteSlugs[categorySlug || ""] || "materialy";
}

export function articlePublicPath(slug: string, categorySlug?: string | null) {
  return `/stati/${articleSectionSlug(categorySlug)}/${slug}`;
}
