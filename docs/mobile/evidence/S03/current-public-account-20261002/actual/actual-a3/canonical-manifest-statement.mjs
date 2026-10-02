await fs.writeFile(
  path.join(distDirectory, "site.webmanifest"),
  JSON.stringify(
    {
      name: "Проба Пера - литературный журнал",
      short_name: "Проба Пера",
      description:
        "Статьи о книгах, литературная энциклопедия мира и интерактивный 3D-глобус.",
      lang: "ru-RU",
      id: siteRootPath,
      start_url: siteRootPath,
      scope: siteRootPath,
      display: "standalone",
      orientation: "any",
      background_color: "#17001f",
      theme_color: "#4b087c",
      categories: ["books", "education", "magazines"],
      shortcuts: [
        {
          name: "Литературная планета",
          short_name: "Планета",
          url: `${siteRootPath}#atlas`,
        },
        {
          name: "Статьи журнала",
          short_name: "Статьи",
          url: `${siteBasePath || ""}/stati/`,
        },
        {
          name: "Литературный календарь",
          short_name: "Календарь",
          url: `${siteRootPath}#calendar`,
        },
      ],
      icons: [
        {
          src: `${siteBasePath || ""}/brand/probpera-logo.png`,
          sizes: "500x500",
          type: "image/png",
          purpose: "any maskable",
        },
      ],
    },
    null,
    2
  ),
  "utf8"
);
