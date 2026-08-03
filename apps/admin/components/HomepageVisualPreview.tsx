"use client";

import { useState } from "react";

export default function HomepageVisualPreview({ url }: { url: string }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [revision, setRevision] = useState(0);
  const separator = url.includes("?") ? "&" : "?";

  return (
    <section className="panel homepage-visual-editor" aria-labelledby="homepage-preview-title">
      <header>
        <div>
          <span className="eyebrow">Визуальный контроль</span>
          <h2 id="homepage-preview-title">Главная рядом с настройками</h2>
          <p>
            Измените текст или изображение в блоке ниже, сохраните его и обновите этот экран.
            Так сразу видно результат на компьютере и телефоне.
          </p>
        </div>
        <div className="editor-actions">
          <button
            className={viewport === "desktop" ? "button" : "button-secondary"}
            type="button"
            onClick={() => setViewport("desktop")}
          >
            Компьютер
          </button>
          <button
            className={viewport === "mobile" ? "button" : "button-secondary"}
            type="button"
            onClick={() => setViewport("mobile")}
          >
            Телефон
          </button>
          <button className="button-secondary" type="button" onClick={() => setRevision(Date.now())}>
            Обновить
          </button>
        </div>
      </header>
      <div className={`homepage-preview-frame is-${viewport}`}>
        <iframe
          key={revision}
          src={`${url}${separator}admin-preview=${revision}`}
          title="Предпросмотр главной страницы"
          loading="lazy"
        />
      </div>
    </section>
  );
}
