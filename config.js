/* ==========================================
   LiteraryMap Configuration
   ========================================== */

const APP_CONFIG = {

    // Основная информация
    appName: "LiteraryMap",
    version: "0.1.0",

    // Сайт
    siteName: "Проба Пера",
    siteUrl: "https://probpera.ru",

    // Цветовая схема
    colors: {
        background: "#F6F1EB",
        primary: "#2D124C",
        secondary: "#59327D",
        accent: "#FD7E14"
    },

    // Карта
    map: {
        defaultZoom: 1,
        minZoom: 1,
        maxZoom: 8,
        animationSpeed: 300
    },

    // Статистика (временно)
    stats: {
        countries: 195,
        writers: 0,
        articles: 0,
        awards: 0
    },

    // Пути к данным
    data: {
        countries: "data/countries.json",
        writers: "data/writers.json",
        awards: "data/awards.json"
    }

};
