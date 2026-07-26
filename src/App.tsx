import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import type { Country, Writer } from "./data/countries";

const LiteraryWorldMap = lazy(() => import("./components/LiteraryWorldMap"));
const WriterPanel = lazy(() => import("./components/WriterPanel"));

const featuredCountryIds = [
  "russia",
  "france",
  "england",
  "germany",
  "italy",
  "japan",
  "usa",
  "india",
];

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("ru");
}

export default function App() {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);
  const [countryArchive, setCountryArchive] = useState<Country[]>([]);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    let active = true;
    import("./data/countries").then((module) => {
      if (active) setCountryArchive(module.countries);
    });
    return () => {
      active = false;
    };
  }, []);

  const totalWriters = useMemo(
    () => countryArchive.reduce((total, country) => total + country.writers.length, 0),
    [countryArchive]
  );

  const searchResults = useMemo(() => {
    const query = normalizeSearch(search);

    if (!query) {
      return featuredCountryIds
        .map((id) => countryArchive.find((country) => country.id === id))
        .filter((country): country is Country => Boolean(country));
    }

    return countryArchive
      .filter((country) =>
        [country.name, country.id, country.code]
          .filter(Boolean)
          .some((value) => normalizeSearch(value!).includes(query))
      )
      .sort((first, second) => first.name.localeCompare(second.name, "ru"))
      .slice(0, 9);
  }, [countryArchive, search]);

  const selectCountry = useCallback((country: Country) => {
    setSelectedCountry(country);
    setSelectedWriter(country.writers[0] ?? null);
    setSearch("");
    setSearchOpen(false);
  }, []);

  const closeCountry = useCallback(() => {
    setSelectedCountry(null);
    setSelectedWriter(null);
  }, []);

  return (
    <div className="museum-app">
      <header className="site-header">
        <a className="brand" href={import.meta.env.BASE_URL} aria-label="Проба Пера — главная">
          <span className="brand-seal" aria-hidden="true">
            ПП
          </span>
          <span>
            <strong>Проба Пера</strong>
            <small>Литературный атлас мира</small>
          </span>
        </a>

        <div
          className={`country-search${searchOpen ? " is-open" : ""}`}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
        >
          <label htmlFor="country-search">Найти страну</label>
          <div className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              id="country-search"
              value={search}
              placeholder={selectedCountry?.name || "Россия, Франция, Япония…"}
              autoComplete="off"
              aria-expanded={searchOpen}
              aria-controls="country-results"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setSearchOpen(false);
                if (event.key === "Enter" && searchResults[0]) {
                  event.preventDefault();
                  selectCountry(searchResults[0]);
                }
              }}
            />
            <kbd>↵</kbd>
          </div>

          {searchOpen && (
            <div className="search-results" id="country-results">
              <span className="search-caption">
                {search ? "Результаты поиска" : "Избранные архивы"}
              </span>
              {searchResults.length > 0 ? (
                searchResults.map((country) => (
                  <button
                    type="button"
                    key={country.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCountry(country)}
                  >
                    <span>{country.name}</span>
                    <small>{country.writers.length} авторов</small>
                  </button>
                ))
              ) : (
                <p>Страна не найдена в архиве.</p>
              )}
            </div>
          )}
        </div>

        <div className="archive-totals" aria-label="Объём энциклопедии">
          <span>{countryArchive.length || "…"}</span>
          <small>стран</small>
          <i aria-hidden="true" />
          <span>{totalWriters ? totalWriters.toLocaleString("ru-RU") : "…"}</span>
          <small>автора</small>
        </div>
      </header>

      <main className={`atlas-layout${selectedCountry ? " has-country" : ""}`}>
        <section className="globe-column">
          <div className="hero-copy">
            <span className="eyebrow">Интерактивная энциклопедия</span>
            <h1>
              Мир, рассказанный
              <br />
              <em>голосами писателей</em>
            </h1>
            <p>
              Вращайте старинный глобус и выберите страну, чтобы открыть её литературный архив.
            </p>
          </div>

          {countryArchive.length > 0 ? (
            <Suspense
              fallback={
                <div className="globe-loading" role="status">
                  <span aria-hidden="true">✦</span>
                  <p>Открываем мировой атлас…</p>
                </div>
              }
            >
              <LiteraryWorldMap
                countries={countryArchive}
                selectedCountry={selectedCountry}
                onCountrySelect={selectCountry}
              />
            </Suspense>
          ) : (
            <div className="globe-loading" role="status">
              <span aria-hidden="true">✦</span>
              <p>Читаем каталог стран…</p>
            </div>
          )}

          <div className="museum-note">
            <span aria-hidden="true">✦</span>
            <p>
              Страны без подписей. Наведите на территорию, чтобы увидеть название и объём архива.
            </p>
          </div>
        </section>

        {selectedCountry && (
          <Suspense fallback={<div className="country-panel panel-loading">Открываем архив…</div>}>
            <WriterPanel
              key={selectedCountry.id}
              country={selectedCountry}
              selectedWriter={selectedWriter}
              onWriterSelect={setSelectedWriter}
              onClose={closeCountry}
            />
          </Suspense>
        )}
      </main>

      <footer className="site-footer">
        <span>MMXXVI</span>
        <p>Цифровая коллекция мировой литературы</p>
        <span>Архив открыт</span>
      </footer>
    </div>
  );
}
