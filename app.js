/* ==========================================
   LiteraryMap
   Main Application
   ========================================== */

document.addEventListener("DOMContentLoaded", () => {

    console.log(`${APP_CONFIG.appName} v${APP_CONFIG.version} запущен`);

    initStats();
    initMap();

});

/* ==========================================
   Статистика
   ========================================== */

function initStats() {

    document.getElementById("countries-count").textContent =
        APP_CONFIG.stats.countries;

    document.getElementById("writers-count").textContent =
        APP_CONFIG.stats.writers;

    document.getElementById("articles-count").textContent =
        APP_CONFIG.stats.articles;

    document.getElementById("awards-count").textContent =
        APP_CONFIG.stats.awards;

}

/* ==========================================
   Карта
   ========================================== */

function initMap() {

    const map = document.getElementById("map-container");

    map.innerHTML = `
        <div style="
            text-align:center;
            padding:60px;
            color:#777;
        ">
            <h2 style="color:#2D124C;margin-bottom:15px;">
                🌍 LiteraryMap
            </h2>

            <p>
                Интерактивная карта будет подключена на следующем этапе.
            </p>
        </div>
    `;

}
