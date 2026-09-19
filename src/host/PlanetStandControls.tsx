import { useEffect, useId, useRef } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { GLOBE_STAND_IDS, type GlobeStandId } from "../planet/globeStands";
import type { PlanetStandCustomizationController, PlanetStandCustomizationSnapshot } from "./planetStandCustomization";
import "./PlanetStandControls.css";

/** Authored interface copy; editorial and child acceptance remain separate. */
export const planetStandCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      heading: "Подставка глобуса", toggle: "Подставки", close: "Закрыть", label: "Оформление подставки",
      hint: "Вращайте глобус и меняйте масштаб, чтобы рассмотреть подставку.",
      preparing: "Готовим предпросмотр…", preview: "Предпросмотр. Примените выбор или отмените изменения.",
      failed: "Предпросмотр не открылся. Прежняя подставка восстановлена.",
      apply: "Применить", cancel: "Отмена", saving: "Сохраняем выбор…",
      saveFailed: "Сохранение не подтверждено. Подставка применена, но при следующем запуске выбор может сброситься.",
      retry: "Повторить сохранение",
      names: { canonical: "Фирменное оформление", "stand.base.museum": "Музейная", "stand.base.wood": "Деревянная", "stand.base.book-stack": "Стопка книг" },
    },
    en: {
      heading: "Globe stand", toggle: "Stands", close: "Close", label: "Stand appearance",
      hint: "Rotate the globe and adjust the zoom to inspect the stand.",
      preparing: "Preparing preview…", preview: "Preview. Apply your choice or cancel the changes.",
      failed: "The preview could not be shown. Your previous stand has been restored.",
      apply: "Apply", cancel: "Cancel", saving: "Saving your choice…",
      saveFailed: "Saving could not be confirmed. The stand is applied, but your choice may reset the next time you open the app.",
      retry: "Try saving again",
      names: { canonical: "Original frame", "stand.base.museum": "Museum", "stand.base.wood": "Wooden", "stand.base.book-stack": "Stack of books" },
    },
  },
} as const;

export default function PlanetStandControls({ controller, snapshot, onClose }: {
  controller: PlanetStandCustomizationController;
  snapshot: PlanetStandCustomizationSnapshot;
  onClose: () => void;
}) {
  const { language } = useInterfaceLanguage();
  const copy = planetStandCopy.locales[language];
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (snapshot.isOpen) select.current?.focus({ preventScroll: true }); }, [snapshot.isOpen]);
  return <div className="planet-stand-controls" data-planet-stand-controls="">
    <button type="button" className="planet-stand-controls__toggle" data-planet-stand-toggle=""
      aria-expanded={snapshot.isOpen} aria-controls={`${id}-panel`}
      onClick={() => snapshot.isOpen ? onClose() : controller.open()}>{copy.toggle}</button>
    {snapshot.isOpen && <section className="planet-stand-controls__panel" id={`${id}-panel`}
      data-planet-stand-panel="" data-planet-stand-phase={snapshot.phase} aria-labelledby={`${id}-heading`}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      }}>
      <div className="planet-stand-controls__heading">
        <h2 id={`${id}-heading`}>{copy.heading}</h2>
        <button type="button" data-planet-stand-close="" aria-label={copy.close} onClick={onClose}>×</button>
      </div>
      <label htmlFor={`${id}-select`}>{copy.label}</label>
      <select ref={select} id={`${id}-select`} data-planet-stand-select=""
        value={snapshot.previewId ?? snapshot.appliedId}
        onChange={event => controller.preview(event.currentTarget.value as GlobeStandId)}>
        {GLOBE_STAND_IDS.map(stand => <option key={stand} value={stand} data-planet-stand-option={stand}>{copy.names[stand]}</option>)}
      </select>
      <p className="planet-stand-controls__hint">{copy.hint}</p>
      <p className="planet-stand-controls__status" role="status" aria-live="polite" aria-atomic="true">
        {snapshot.phase === "preparing" ? copy.preparing : snapshot.phase === "preview" ? copy.preview : snapshot.phase === "error" ? copy.failed : ""}
      </p>
      <div className="planet-stand-controls__actions">
        <button type="button" data-planet-stand-apply="" disabled={snapshot.phase !== "preview"}
          onClick={() => { select.current?.focus({ preventScroll: true }); controller.apply(); }}>{copy.apply}</button>
        <button type="button" data-planet-stand-cancel="" onClick={onClose}>{copy.cancel}</button>
      </div>
      <p className="planet-stand-controls__status" role="status" aria-live="polite" aria-atomic="true"
        data-planet-stand-save-state={snapshot.saveState}>
        {snapshot.saveState === "saving" ? copy.saving : snapshot.saveState === "failed" ? copy.saveFailed : ""}
      </p>
      {snapshot.saveState === "failed" && <button type="button" data-planet-stand-save-retry="" onClick={() => {
        select.current?.focus({ preventScroll: true });
        controller.retrySave();
      }}>{copy.retry}</button>}
    </section>}
  </div>;
}
