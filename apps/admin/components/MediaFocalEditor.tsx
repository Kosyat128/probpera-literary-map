"use client";

import {
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";

import { clampMediaFocus, mediaFocusFromPoint } from "@/lib/media-focus";

function initialCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0.5;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clampMediaFocus(parsed) : 0.5;
}

export default function MediaFocalEditor({
  src,
  alt,
  initialX,
  initialY,
  width,
  height,
}: {
  src: string;
  alt: string;
  initialX: number | string | null;
  initialY: number | string | null;
  width?: number | null;
  height?: number | null;
}) {
  const [focusX, setFocusX] = useState(() => initialCoordinate(initialX));
  const [focusY, setFocusY] = useState(() => initialCoordinate(initialY));
  const [imageAspect, setImageAspect] = useState(() =>
    width && height && width > 0 && height > 0 ? width / height : 1.5
  );

  const choosePoint = (event: MouseEvent<HTMLButtonElement>) => {
    const plane = event.currentTarget.querySelector<HTMLElement>(
      "[data-media-focal-plane]"
    );
    if (!plane) return;
    const point = mediaFocusFromPoint(
      event.clientX,
      event.clientY,
      plane.getBoundingClientRect()
    );
    if (!point) return;
    setFocusX(point.x);
    setFocusY(point.y);
  };

  const nudgePoint = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 0.05 : 0.01;
    if (event.key === "ArrowLeft") setFocusX((value) => clampMediaFocus(value - step));
    else if (event.key === "ArrowRight") setFocusX((value) => clampMediaFocus(value + step));
    else if (event.key === "ArrowUp") setFocusY((value) => clampMediaFocus(value - step));
    else if (event.key === "ArrowDown") setFocusY((value) => clampMediaFocus(value + step));
    else return;
    event.preventDefault();
  };

  const objectPosition = `${focusX * 100}% ${focusY * 100}%`;
  const previewFormats = [
    { key: "card", label: "Карточка 4:3", className: "is-card" },
    { key: "cover", label: "Обложка 2:3", className: "is-cover" },
    { key: "hero", label: "Баннер 16:9", className: "is-hero" },
    { key: "mobile", label: "Мобильный 9:16", className: "is-mobile" },
  ] as const;

  return (
    <section className="media-focal-editor" aria-label="Фокус и кадрирование изображения">
      <div className="media-focal-heading">
        <strong>Фокус кадрирования</strong>
        <span>{Math.round(focusX * 100)}% · {Math.round(focusY * 100)}%</span>
      </div>
      <button
        className="media-focal-stage"
        type="button"
        onClick={choosePoint}
        onKeyDown={nudgePoint}
        aria-label="Выбрать точку фокуса. Используйте стрелки для точной настройки"
      >
        <span
          className="media-focal-image-plane"
          data-media-focal-plane
          style={{ "--media-focal-aspect": imageAspect } as CSSProperties}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setImageAspect(naturalWidth / naturalHeight);
              }
            }}
          />
          <span
            className="media-focal-marker"
            aria-hidden="true"
            style={{ left: objectPosition.split(" ")[0], top: objectPosition.split(" ")[1] }}
          />
        </span>
      </button>
      <small>
        Нажмите на главный объект. Стрелки двигают точку на 1%, Shift + стрелка - на 5%.
        {width && height ? ` Исходник: ${width} × ${height} px.` : ""}
      </small>
      <div className="media-focus-fields">
        <label className="field">
          <span>Фокус X <output>{focusX.toFixed(2)}</output></span>
          <input name="focus_x" type="range" min="0" max="1" step="0.01" value={focusX} onChange={(event) => setFocusX(clampMediaFocus(Number(event.target.value)))} />
        </label>
        <label className="field">
          <span>Фокус Y <output>{focusY.toFixed(2)}</output></span>
          <input name="focus_y" type="range" min="0" max="1" step="0.01" value={focusY} onChange={(event) => setFocusY(clampMediaFocus(Number(event.target.value)))} />
        </label>
      </div>
      <div className="media-focal-previews" aria-label="Предпросмотр форматов">
        {previewFormats.map((format) => (
          <figure key={format.key} className={format.className}>
            <img src={src} alt={`Предпросмотр: ${format.label}. ${alt}`} style={{ objectPosition }} />
            <figcaption>{format.label}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
