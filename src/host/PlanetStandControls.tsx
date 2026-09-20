import { useEffect, useId, useRef, useState } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import { GLOBE_STAND_IDS, type GlobeStandId } from "../planet/globeStands";
import { GLOBE_BACKGROUND_IDS, type GlobeBackgroundId } from "../planet/globeBackgrounds";
import type { PlanetStandCustomizationController, PlanetStandCustomizationSnapshot } from "./planetStandCustomization";
import type { PlanetBackgroundCustomizationController, PlanetBackgroundCustomizationSnapshot } from "./planetBackgroundCustomization";
import "./PlanetStandControls.css";

/** Authored interface copy; editorial and child acceptance remain separate. */
export const planetStandCopy = {
  reviewStatus: "draft",
  productionReady: false,
  locales: {
    ru: {
      heading: "Подставка глобуса", toggle: "Подставки", close: "Закрыть", label: "Оформление подставки",
      hint: "Вращайте глобус и меняйте масштаб, чтобы рассмотреть подставку.",
      preparing: "Готовим предпросмотр…", preview: "Предпросмотр. Подставка и фон применяются вместе.",
      failed: "Предпросмотр не открылся. Прежнее оформление восстановлено.",
      apply: "Применить", cancel: "Отмена", saving: "Сохраняем выбор…",
      saveFailed: "Сохранение не подтверждено. Оформление применено, но при следующем запуске выбор может сброситься.",
      retry: "Повторить сохранение",
      names: { canonical: "Фирменное оформление", "stand.base.three-whales": "Три кита",
        "stand.base.portrait-pushkin": "Александр Пушкин", "stand.base.portrait-hemingway": "Эрнест Хемингуэй", "stand.base.portrait-tolstoy": "Лев Толстой", "stand.base.museum": "Музейная", "stand.base.wood": "Деревянная", "stand.base.book-stack": "Стопка книг", "stand.base.child-book-cloud": "Книга на облаке" },
    },
    en: {
      heading: "Globe stand", toggle: "Stands", close: "Close", label: "Stand appearance",
      hint: "Rotate the globe and adjust the zoom to inspect the stand.",
      preparing: "Preparing preview…", preview: "Preview. The stand and background will be applied together.",
      failed: "The preview could not be shown. Your previous appearance has been restored.",
      apply: "Apply", cancel: "Cancel", saving: "Saving your choice…",
      saveFailed: "Saving could not be confirmed. The appearance is applied, but your choice may reset the next time you open the app.",
      retry: "Try saving again",
      names: { canonical: "Original frame", "stand.base.three-whales": "Three whales",
        "stand.base.portrait-pushkin": "Alexander Pushkin", "stand.base.portrait-hemingway": "Ernest Hemingway", "stand.base.portrait-tolstoy": "Leo Tolstoy", "stand.base.museum": "Museum", "stand.base.wood": "Wooden", "stand.base.book-stack": "Stack of books", "stand.base.child-book-cloud": "Book on a cloud" },
    },
  },
} as const;

export const planetBackgroundCopy = {
  reviewStatus: "draft", productionReady: false,
  locales: {
    ru: {
      close: "Закрыть", label: "Пространство вокруг глобуса",
      hint: "Вращайте глобус, чтобы рассмотреть окружение.",
      preparing: "Готовим предпросмотр…", preview: "Предпросмотр. Подставка и фон применяются вместе.",
      failed: "Предпросмотр не открылся. Прежнее оформление восстановлено.",
      apply: "Применить", cancel: "Отмена", saving: "Сохраняем выбор…",
      saveFailed: "Сохранение не подтверждено. Оформление применено, но при следующем запуске выбор может сброситься.",
      retry: "Повторить сохранение",
      names: { "background.base.site-starfield": "Звёздное небо", "background.base.library": "Библиотека", "background.base.writer-study": "Кабинет писателя" },
    },
    en: {
      close: "Close", label: "Space around the globe",
      hint: "Rotate the globe to explore the surrounding space.",
      preparing: "Preparing preview…", preview: "Preview. The stand and background will be applied together.",
      failed: "The preview could not be shown. Your previous appearance has been restored.",
      apply: "Apply", cancel: "Cancel", saving: "Saving your choice…",
      saveFailed: "Saving could not be confirmed. The appearance is applied, but your choice may reset the next time you open the app.",
      retry: "Try saving again",
      names: { "background.base.site-starfield": "Starry sky", "background.base.library": "Library", "background.base.writer-study": "Writer's study" },
    },
  },
} as const;

export default function PlanetStandControls({ controller, snapshot, backgroundController, backgroundSnapshot, onClose }: {
  controller: Pick<PlanetStandCustomizationController, "open" | "preview" | "apply" | "cancel" | "retrySave">;
  snapshot: PlanetStandCustomizationSnapshot;
  backgroundController: Pick<PlanetBackgroundCustomizationController, "open" | "preview" | "apply" | "cancel" | "retrySave">;
  backgroundSnapshot: PlanetBackgroundCustomizationSnapshot;
  onClose: () => void;
}) {
  const { language } = useInterfaceLanguage();
  const [tab, setTab] = useState<"stand" | "background">("stand");
  const isStand = tab === "stand";
  const current = isStand ? snapshot : backgroundSnapshot;
  const copy = isStand ? planetStandCopy.locales[language] : planetBackgroundCopy.locales[language];
  const title = language === "ru" ? "Оформление глобуса" : "Globe appearance";
  const options = isStand
    ? GLOBE_STAND_IDS.map(value => ({ value, label: planetStandCopy.locales[language].names[value] }))
    : GLOBE_BACKGROUND_IDS.map(value => ({ value, label: planetBackgroundCopy.locales[language].names[value] }));
  const id = useId();
  const select = useRef<HTMLSelectElement>(null);
  const activeController = isStand ? controller : backgroundController;
  useEffect(() => { if (current.isOpen) select.current?.focus({ preventScroll: true }); }, [current.isOpen, tab]);
  const switchTab = (next: "stand" | "background") => {
    if (next === tab) return;
    // Both tabs edit the same draft. Closing the panel owns whole-draft rollback.
    if ((next === "stand" ? controller : backgroundController).open()) setTab(next);
  };
  return <div className="planet-stand-controls" data-planet-stand-controls="">
    <button type="button" className="planet-stand-controls__toggle" data-planet-stand-toggle=""
      aria-expanded={current.isOpen} aria-controls={`${id}-panel`}
      onClick={() => current.isOpen ? onClose() : activeController.open()}>{language === "ru" ? "Оформление" : "Appearance"}</button>
    {current.isOpen && <section className="planet-stand-controls__panel" id={`${id}-panel`}
      data-planet-stand-panel={isStand ? "" : undefined} data-planet-stand-phase={isStand ? current.phase : undefined}
      data-planet-background-panel={isStand ? undefined : ""} data-planet-background-phase={isStand ? undefined : current.phase}
      aria-labelledby={`${id}-heading`}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
      }}>
      <div className="planet-stand-controls__heading">
        <h2 id={`${id}-heading`}>{title}</h2>
        <button type="button" data-planet-stand-close={isStand ? "" : undefined}
          data-planet-background-close={isStand ? undefined : ""} aria-label={copy.close} onClick={onClose}>×</button>
      </div>
      <div className="planet-stand-controls__tabs" role="group" aria-label={language === "ru" ? "Раздел оформления" : "Appearance category"}>
        <button type="button" data-planet-customization-tab="stand" aria-pressed={isStand}
          onClick={() => switchTab("stand")}>{language === "ru" ? "Подставка" : "Stand"}</button>
        <button type="button" data-planet-customization-tab="background" aria-pressed={!isStand}
          onClick={() => switchTab("background")}>{language === "ru" ? "Фон" : "Background"}</button>
      </div>
      <label htmlFor={`${id}-select`}>{copy.label}</label>
      <select ref={select} id={`${id}-select`} data-planet-stand-select={isStand ? "" : undefined}
        data-planet-background-select={isStand ? undefined : ""}
        value={current.previewId ?? current.appliedId}
        onChange={event => isStand ? controller.preview(event.currentTarget.value as GlobeStandId)
          : backgroundController.preview(event.currentTarget.value as GlobeBackgroundId)}>
        {options.map(option => <option key={option.value} value={option.value}
          data-planet-stand-option={isStand ? option.value : undefined}
          data-planet-background-option={isStand ? undefined : option.value}>{option.label}</option>)}
      </select>
      <p className="planet-stand-controls__summary" data-planet-composition-summary="">
        {language === "ru" ? "Подставка: " : "Stand: "}{planetStandCopy.locales[language].names[snapshot.displayedId]}
        {" · "}{language === "ru" ? "Фон: " : "Background: "}{planetBackgroundCopy.locales[language].names[backgroundSnapshot.displayedId]}
      </p>
      <p className="planet-stand-controls__hint">{copy.hint}</p>
      <p className="planet-stand-controls__status" role="status" aria-live="polite" aria-atomic="true">
        {current.phase === "preparing" ? copy.preparing : current.phase === "preview" ? copy.preview : current.phase === "error" ? copy.failed : ""}
      </p>
      <div className="planet-stand-controls__actions">
        <button type="button" data-planet-stand-apply={isStand ? "" : undefined} data-planet-background-apply={isStand ? undefined : ""}
          disabled={current.phase !== "preview"}
          onClick={() => { select.current?.focus({ preventScroll: true }); activeController.apply(); }}>{copy.apply}</button>
        <button type="button" data-planet-stand-cancel={isStand ? "" : undefined}
          data-planet-background-cancel={isStand ? undefined : ""} onClick={onClose}>{copy.cancel}</button>
      </div>
      <p className="planet-stand-controls__status" role="status" aria-live="polite" aria-atomic="true"
        data-planet-stand-save-state={isStand ? current.saveState : undefined}
        data-planet-background-save-state={isStand ? undefined : current.saveState}>
        {current.saveState === "saving" ? copy.saving : current.saveState === "failed" ? copy.saveFailed : ""}
      </p>
      {current.saveState === "failed" && <button type="button" data-planet-stand-save-retry={isStand ? "" : undefined}
        data-planet-background-save-retry={isStand ? undefined : ""} onClick={() => {
        select.current?.focus({ preventScroll: true });
        activeController.retrySave();
      }}>{copy.retry}</button>}
    </section>}
  </div>;
}
