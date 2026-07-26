import { gsap } from "gsap";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Country, Writer } from "../data/countries";

type WriterPanelProps = {
  country: Country;
  selectedWriter?: Writer | null;
  onWriterSelect?: (writer: Writer) => void;
  onClose?: () => void;
};

function getWriterName(writer: Writer) {
  return writer.name || writer.fullName || "Неизвестный автор";
}

function getInitials(writer: Writer) {
  return getWriterName(writer)
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function flagFromCode(code?: string) {
  if (!code || code.length !== 2) return "◈";
  return String.fromCodePoint(
    ...code
      .toUpperCase()
      .split("")
      .map((character) => character.charCodeAt(0) + 127397)
  );
}

function getWriterYear(writer: Writer) {
  const source = writer.birthDate || writer.birth || writer.years || "";
  const match = source.match(/\d{3,4}/);
  return match ? Number(match[0]) : null;
}

function isNobelWriter(writer: Writer) {
  return Boolean(
    writer.nobel ||
      writer.isNobel ||
      writer.nobelYear ||
      writer.nobelPrize ||
      writer.awards?.some((award) => award.toLowerCase().includes("нобел"))
  );
}

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

export default function WriterPanel({
  country,
  selectedWriter,
  onWriterSelect,
  onClose,
}: WriterPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const writers = country.writers || [];
  const [localSelected, setLocalSelected] = useState<Writer | null>(writers[0] || null);

  useEffect(() => {
    const firstWriter = country.writers?.[0] || null;
    setLocalSelected(firstWriter);
    if (firstWriter && selectedWriter === undefined) onWriterSelect?.(firstWriter);
  }, [country.id, country.writers, onWriterSelect, selectedWriter]);

  const activeWriter = selectedWriter ?? localSelected ?? writers[0] ?? null;

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const animation = gsap.fromTo(
      panelRef.current,
      { autoAlpha: 0, x: 42 },
      { autoAlpha: 1, x: 0, duration: 0.7, ease: "power3.out", clearProps: "transform" }
    );
    return () => {
      animation.kill();
    };
  }, [country.id]);

  useLayoutEffect(() => {
    if (!detailRef.current || !activeWriter) return;
    const animation = gsap.fromTo(
      detailRef.current,
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out" }
    );
    return () => {
      animation.kill();
    };
  }, [activeWriter?.id]);

  const sortedWriters = useMemo(
    () =>
      [...writers].sort((first, second) =>
        getWriterName(first).localeCompare(getWriterName(second), "ru")
      ),
    [writers]
  );

  const periods = useMemo(() => {
    const stored = country.literaryPeriods || country.periods;
    if (stored?.length) return stored.slice(0, 7);
    return uniqueValues(writers.flatMap((writer) => writer.tags || [])).slice(0, 7);
  }, [country.literaryPeriods, country.periods, writers]);

  const movements = useMemo(() => {
    if (country.literaryMovements?.length) return country.literaryMovements.slice(0, 7);
    return uniqueValues(writers.flatMap((writer) => writer.genres || [])).slice(0, 7);
  }, [country.literaryMovements, writers]);

  const timeline = useMemo(
    () =>
      writers
        .map((writer) => ({ writer, year: getWriterYear(writer) }))
        .filter((item): item is { writer: Writer; year: number } => item.year !== null)
        .sort((first, second) => first.year - second.year)
        .slice(0, 6),
    [writers]
  );

  const nobelCount =
    country.nobel ?? writers.reduce((count, writer) => count + Number(isNobelWriter(writer)), 0);
  const description =
    country.description ||
    country.history ||
    country.historicalNote ||
    `Архив объединяет ${writers.length} авторов и ключевые произведения литературной традиции страны.`;

  const chooseWriter = (writer: Writer) => {
    setLocalSelected(writer);
    onWriterSelect?.(writer);
  };

  return (
    <aside ref={panelRef} className="country-panel" aria-live="polite">
      <div className="panel-topline">
        <div>
          <span className="eyebrow">Литературный архив</span>
          <span className="archive-code">{country.code?.toUpperCase()}</span>
        </div>
        {onClose && (
          <button className="panel-close" type="button" onClick={onClose} aria-label="Закрыть панель">
            ×
          </button>
        )}
      </div>

      <header className="country-heading">
        <span className="country-flag" aria-hidden="true">
          {flagFromCode(country.code)}
        </span>
        <div>
          <h2>{country.name}</h2>
          <p>{country.capital ? `Столица: ${country.capital}` : "Литературное наследие страны"}</p>
        </div>
      </header>

      <p className="country-description">{description}</p>

      <div className="country-metrics">
        <div>
          <strong>{writers.length}</strong>
          <span>авторов</span>
        </div>
        <div>
          <strong>{nobelCount}</strong>
          <span>Нобелевских лауреатов</span>
        </div>
        <div>
          <strong>{uniqueValues(writers.flatMap((writer) => writer.works || [])).length}</strong>
          <span>произведений</span>
        </div>
      </div>

      {periods.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <span>01</span>
            <h3>Эпохи и направления</h3>
          </div>
          <div className="tag-list">
            {periods.map((period) => (
              <span key={period}>{period}</span>
            ))}
            {movements.map((movement) => (
              <span key={movement}>{movement}</span>
            ))}
          </div>
        </section>
      )}

      <section className="archive-section">
        <div className="section-title">
          <span>02</span>
          <h3>Писатели</h3>
        </div>

        <div className="writer-list">
          {sortedWriters.map((writer) => {
            const active = activeWriter?.id === writer.id;
            return (
              <button
                key={writer.id}
                className={`writer-row${active ? " is-active" : ""}`}
                type="button"
                onClick={() => chooseWriter(writer)}
              >
                <span className="writer-portrait">
                  <span>{getInitials(writer)}</span>
                  {writer.portrait && (
                    <img
                      src={writer.portrait}
                      alt=""
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                </span>
                <span className="writer-copy">
                  <strong>{getWriterName(writer)}</strong>
                  <small>{writer.years || writer.literaryEra || "Биография в архиве"}</small>
                </span>
                <span className="writer-arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {activeWriter && (
        <section ref={detailRef} className="archive-section writer-detail">
          <div className="section-title">
            <span>03</span>
            <h3>Карточка автора</h3>
          </div>

          <span className="writer-era">
            {activeWriter.literaryEra ||
              activeWriter.movement ||
              activeWriter.tags?.[0] ||
              "Литературная традиция"}
          </span>
          <h4>{getWriterName(activeWriter)}</h4>
          <p className="writer-years">{activeWriter.years}</p>
          <p className="writer-bio">
            {activeWriter.biography ||
              activeWriter.bio ||
              activeWriter.description ||
              "Расширенная биография готовится для энциклопедии."}
          </p>

          {activeWriter.works && activeWriter.works.length > 0 && (
            <div className="works-block">
              <span>Основные произведения</span>
              <ol>
                {activeWriter.works.slice(0, 8).map((work) => (
                  <li key={work}>{work}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {timeline.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <span>04</span>
            <h3>Литературная хронология</h3>
          </div>
          <div className="country-timeline">
            {timeline.map(({ writer, year }) => (
              <div key={`${writer.id}-${year}`}>
                <time>{year}</time>
                <span>{getWriterName(writer)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {country.facts && country.facts.length > 0 && (
        <section className="archive-section">
          <div className="section-title">
            <span>05</span>
            <h3>Интересные факты</h3>
          </div>
          <ul className="fact-list">
            {country.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
