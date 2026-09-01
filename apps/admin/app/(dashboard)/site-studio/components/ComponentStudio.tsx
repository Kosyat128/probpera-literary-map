"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  canMutateSiteStudioComponent,
  siteStudioComponentRegistry,
  siteStudioEffectRegistry,
  type SiteStudioComponentId,
  type SiteStudioEffectName,
  type SiteStudioRole,
} from "@/lib/site-studio-contract";

import styles from "./components.module.css";

const componentLabels: Record<SiteStudioComponentId, string> = {
  "site-header": "Шапка сайта",
  magazine: "Литературный журнал",
  journal: "Каталог журнала",
  "article-reader": "Чтение статьи",
  "cms-page-reader": "Обычная страница",
  "literary-globe": "Литературный глобус",
  bookshelf: "Книжная полка",
  "site-footer": "Подвал сайта",
};

const capabilityLabels = {
  tokens: "Токены",
  layout: "Сетка",
  effects: "Эффекты",
  visibility: "Видимость",
  content: "Контент",
} as const;

const stateLabels = {
  default: "Обычное",
  hover: "Наведение",
  focus: "Фокус",
  active: "Активное",
  selected: "Выбрано",
  open: "Открыто",
  disabled: "Отключено",
} as const;

const viewportLabels = {
  desktop: "Компьютер",
  tablet: "Планшет",
  mobile: "Телефон",
} as const;

const effectLabels: Record<SiteStudioEffectName, string> = {
  none: "Без эффекта",
  fade: "Мягкое появление",
  "reveal-up": "Появление снизу",
  "zoom-soft": "Мягкое приближение",
};

type Viewport = keyof typeof viewportLabels;

export default function ComponentStudio({ role }: { role: SiteStudioRole }) {
  const ids = Object.keys(siteStudioComponentRegistry) as SiteStudioComponentId[];
  const [selectedId, setSelectedId] = useState<SiteStudioComponentId>("magazine");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [effect, setEffect] = useState<SiteStudioEffectName>("none");
  const [previewRevision, setPreviewRevision] = useState(0);
  const component = siteStudioComponentRegistry[selectedId];
  const canMutate = canMutateSiteStudioComponent(selectedId, role);
  const canvasClass = useMemo(
    () =>
      `${styles.canvas} ${styles[viewport]} ${
        effect === "none" ? "" : styles[`effect-${effect}`]
      }`,
    [effect, viewport]
  );

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Site Studio · Компоненты</span>
          <h1>Слои, холст и инспектор</h1>
          <p>
            Выберите управляемый компонент, проверьте его состояния и экран,
            затем переходите к типизированным токенам. Здесь нельзя вводить CSS
            или JavaScript.
          </p>
        </div>
        <Link className="button-secondary" href="/site-studio">К разделам студии</Link>
      </header>

      <div className={styles.workspace}>
        <aside className={styles.layers} aria-label="Слои страницы">
          <header>
            <span className="eyebrow">Layers</span>
            <h2>Компоненты</h2>
          </header>
          <div className={styles.layerList} role="listbox" aria-label="Компоненты сайта">
            {ids.map((id) => {
              const item = siteStudioComponentRegistry[id];
              return (
                <button
                  type="button"
                  key={id}
                  role="option"
                  aria-selected={id === selectedId}
                  onClick={() => {
                    setSelectedId(id);
                    setEffect("none");
                    setPreviewRevision((value) => value + 1);
                  }}
                >
                  <span aria-hidden="true">{item.ownerLocked ? "◆" : "◇"}</span>
                  <span>
                    <strong>{componentLabels[id]}</strong>
                    <small>{id}</small>
                  </span>
                  {item.ownerLocked && <span className={styles.lock}>Системный</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <main className={styles.canvasPanel}>
          <header className={styles.canvasToolbar}>
            <div>
              <span className="eyebrow">Canvas</span>
              <strong>{componentLabels[selectedId]}</strong>
            </div>
            <div className={styles.viewportSwitch} role="group" aria-label="Размер экрана">
              {(Object.keys(viewportLabels) as Viewport[]).map((value) => (
                <button
                  type="button"
                  key={value}
                  className={viewport === value ? styles.active : undefined}
                  aria-pressed={viewport === value}
                  onClick={() => setViewport(value)}
                >
                  {viewportLabels[value]}
                </button>
              ))}
            </div>
          </header>

          <div className={styles.canvasStage}>
            <section
              className={canvasClass}
              key={`${selectedId}-${effect}-${previewRevision}`}
              aria-label={`Предпросмотр: ${componentLabels[selectedId]}`}
            >
              <div className={styles.previewHeader}>
                <span>Проба пера</span>
                <span>{viewportLabels[viewport]}</span>
              </div>
              <div className={styles.previewBody}>
                <span className={styles.previewEyebrow}>Компонент</span>
                <h2>{componentLabels[selectedId]}</h2>
                <p>
                  Безопасный схематический предпросмотр сетки, типографики,
                  интервалов и разрешённых эффектов.
                </p>
                <div className={styles.previewSlots}>
                  {component.slots.map((slot) => <span key={slot}>{slot}</span>)}
                </div>
              </div>
            </section>
          </div>
          <footer className={styles.breadcrumbs} aria-label="Путь выбранного компонента">
            <span>Сайт</span><span aria-hidden="true">›</span>
            <span>Страница</span><span aria-hidden="true">›</span>
            <strong>{componentLabels[selectedId]}</strong>
          </footer>
        </main>

        <aside className={styles.inspector} aria-label="Инспектор компонента">
          <header>
            <span className="eyebrow">Inspector</span>
            <h2>{componentLabels[selectedId]}</h2>
            <code>{selectedId}</code>
          </header>

          {component.ownerLocked && (
            <p className={styles.notice}>
              Системный компонент. Геометрия и поведение защищены; изменение
              возможно только в специально назначенной задаче владельца.
            </p>
          )}

          <section>
            <h3>Возможности</h3>
            <div className={styles.chips}>
              {component.capabilities.map((capability) => (
                <span key={capability}>{capabilityLabels[capability]}</span>
              ))}
            </div>
          </section>

          <section>
            <h3>Состояния</h3>
            <div className={styles.chips}>
              {component.states.map((state) => (
                <span key={state}>{stateLabels[state]}</span>
              ))}
            </div>
          </section>

          <section>
            <label className="field">
              <span>Эффект предпросмотра</span>
              <select
                value={effect}
                disabled={
                  !(component.capabilities as readonly string[]).includes("effects")
                }
                onChange={(event) => {
                  setEffect(event.target.value as SiteStudioEffectName);
                  setPreviewRevision((value) => value + 1);
                }}
              >
                {(Object.keys(siteStudioEffectRegistry) as SiteStudioEffectName[]).map(
                  (name) => <option key={name} value={name}>{effectLabels[name]}</option>
                )}
              </select>
            </label>
            <small>
              Для пользователей с уменьшенным движением анимация отключается автоматически.
            </small>
          </section>

          <div className={styles.inspectorActions}>
            <Link
              className={canMutate ? "button" : "button-secondary"}
              aria-disabled={!canMutate}
              href={
                canMutate
                  ? `/site-studio/tokens?layer=component&target=${encodeURIComponent(selectedId)}`
                  : "/site-studio/components"
              }
            >
              {canMutate ? "Настроить токены" : "Только просмотр"}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
